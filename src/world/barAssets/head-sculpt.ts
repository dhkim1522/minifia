import {
  CatmullRomCurve3, Color, Float32BufferAttribute, Group, MathUtils, Mesh,
  MeshStandardMaterial, SphereGeometry, TubeGeometry, Vector3,
} from "three";
import type { Object3D } from "three";

export type Point = readonly [x: number, y: number, z: number];
export type ExpressionKind = "eye" | "mouth";
export type HeadDensity = "close" | "world";

export function sculptRoot(density: HeadDensity): Group {
  const root = new Group();
  root.userData.headDensity = density;
  return root;
}

export function sculptSegments(parent: Object3D, count: number, minimum: number): number {
  let node: Object3D | null = parent;
  while (node && node.userData.headDensity === undefined) node = node.parent;
  return node?.userData.headDensity === "world" ? Math.max(minimum, Math.round(count * 0.56)) : count;
}

export function markExpressionPart<T extends Object3D>(part: T, kind: ExpressionKind, pivot?: Point): T {
  part.userData.expressionKind = kind;
  if (pivot) part.userData.expressionPivot = pivot;
  return part;
}
type Outline = (unit: Vector3, out: Vector3) => void;
type Shade = (unit: Vector3, position: Vector3, out: Color) => void;

export function bell(value: number, radius: number): number {
  return Math.exp(-((value / radius) ** 2));
}

export function surface(
  parent: Group, map: Outline, shade: Shade, slices = 52, rings = 34, roughness = 0.91,
): Mesh {
  slices = sculptSegments(parent, slices, 12);
  rings = sculptSegments(parent, rings, 8);
  const geometry = new SphereGeometry(1, slices, rings);
  const positions = geometry.getAttribute("position");
  const colors = new Float32Array(positions.count * 3);
  const unit = new Vector3();
  const point = new Vector3();
  const color = new Color();
  for (let i = 0; i < positions.count; i++) {
    unit.fromBufferAttribute(positions, i);
    map(unit, point);
    shade(unit, point, color);
    positions.setXYZ(i, point.x, point.y, point.z);
    color.toArray(colors, i * 3);
  }
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const normals = geometry.getAttribute("normal");
  const sum = new Vector3();
  const row = slices + 1;
  for (let y = 0; y <= rings; y++) {
    const first = y * row;
    const last = first + slices;
    const pole = y === 0 || y === rings;
    sum.set(0, 0, 0);
    for (let i = first; i <= last; i += pole ? 1 : slices) {
      sum.add(unit.fromBufferAttribute(normals, i));
    }
    sum.normalize();
    for (let i = first; i <= last; i += pole ? 1 : slices) {
      normals.setXYZ(i, sum.x, sum.y, sum.z);
    }
  }
  const mesh = new Mesh(geometry, new MeshStandardMaterial({ vertexColors: true, roughness }));
  parent.add(mesh);
  return mesh;
}

/** 얼굴 자체에 주둥이나 눈 언덕을 내고 장식 위치의 앞쪽 깊이를 같이 반환한다. */
export function face(
  parent: Group, [rx, ry, rz]: Point, relief: (x: number, y: number) => number, shade: Shade,
): (x: number, y: number) => number {
  function depth(x: number, y: number, unitZ: number): number {
    return rz * unitZ + MathUtils.smoothstep(unitZ, 0, 0.75) * relief(x, y);
  }
  surface(parent, (unit, out) => {
    const x = unit.x * rx;
    const y = unit.y * ry;
    out.set(x, y, depth(x, y, unit.z));
  }, shade, 64, 44);
  return (x, y) => depth(x, y, Math.sqrt(Math.max(0, 1 - (x / rx) ** 2 - (y / ry) ** 2)));
}

const ovalShape = new SphereGeometry(1, 24, 16);
const worldOvalShape = new SphereGeometry(1, 14, 9);

export function oval(
  parent: Group, color: string, at: Point, radii: Point, tilt = 0, roughness = 0.88,
): Mesh {
  const shape = sculptSegments(parent, 24, 14) === 24 ? ovalShape : worldOvalShape;
  const mesh = new Mesh(shape, new MeshStandardMaterial({ color, roughness }));
  mesh.position.set(...at);
  mesh.scale.set(...radii);
  mesh.rotation.z = tilt;
  parent.add(mesh);
  return mesh;
}

export function eyes(
  parent: Group, [x, y, z]: Point, lidTint: string, tilt = 0, [rx, ry]: readonly [number, number] = [0.052, 0.068],
): void {
  for (const side of [-1, 1]) {
    const eye = markExpressionPart(new Group(), "eye");
    eye.position.set(side * x, y, z);
    eye.rotation.set(-0.05, side * 0.31, side * tilt);
    parent.add(eye);
    oval(eye, lidTint, [0, 0.004, -0.017], [rx * 1.27, ry * 1.19, 0.040]);
    oval(eye, "#241c25", [0, 0, 0.004], [rx, ry, 0.035], 0, 0.27);
    oval(eye, "#f8dec3", [-rx * 0.26, ry * 0.30, 0.034], [0.011, 0.014, 0.006], 0, 0.31);
  }
}

export function stroke(
  parent: Group, color: string, points: readonly Point[], width: number, taper = 0.28,
): Mesh {
  const path = new CatmullRomCurve3(points.map(point => new Vector3(...point)));
  const steps = sculptSegments(parent, 24, 10);
  const sides = sculptSegments(parent, 6, 5);
  const geometry = new TubeGeometry(path, steps, width, sides, false);
  const positions = geometry.getAttribute("position");
  const center = new Vector3();
  const vertex = new Vector3();
  for (let ring = 0; ring <= steps; ring++) {
    const t = ring / steps;
    const scale = MathUtils.lerp(taper, 1, MathUtils.smoothstep(Math.min(t, 1 - t), 0, 0.22));
    path.getPointAt(t, center);
    for (let side = 0; side <= sides; side++) {
      const i = ring * (sides + 1) + side;
      vertex.fromBufferAttribute(positions, i).sub(center).multiplyScalar(scale).add(center);
      positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }
  }
  geometry.computeVertexNormals();
  const mesh = new Mesh(geometry, new MeshStandardMaterial({ color, roughness: 0.86 }));
  parent.add(mesh);
  return mesh;
}
