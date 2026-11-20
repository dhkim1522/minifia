import {
  CatmullRomCurve3, Color, Float32BufferAttribute, Group, MathUtils, Mesh,
  MeshStandardMaterial, SphereGeometry, TubeGeometry, Vector3,
} from "three";

export type Point = readonly [x: number, y: number, z: number];
type Outline = (unit: Vector3, out: Vector3) => void;
type Shade = (unit: Vector3, position: Vector3, out: Color) => void;

export function bell(value: number, radius: number): number {
  return Math.exp(-((value / radius) ** 2));
}

export function surface(
  parent: Group, map: Outline, shade: Shade, slices = 52, rings = 34, roughness = 0.91,
): Mesh {
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

export function oval(
  parent: Group, color: string, at: Point, radii: Point, tilt = 0, roughness = 0.88,
): Mesh {
  const mesh = new Mesh(ovalShape, new MeshStandardMaterial({ color, roughness }));
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
    const eye = new Group();
    eye.position.set(side * x, y, z);
    eye.rotation.set(-0.05, side * 0.31, side * tilt);
    oval(eye, lidTint, [0, 0.004, -0.017], [rx * 1.27, ry * 1.19, 0.040]);
    oval(eye, "#241c25", [0, 0, 0.004], [rx, ry, 0.035], 0, 0.27);
    oval(eye, "#f8dec3", [-rx * 0.26, ry * 0.30, 0.034], [0.011, 0.014, 0.006], 0, 0.31);
    parent.add(eye);
  }
}

export function stroke(
  parent: Group, color: string, points: readonly Point[], width: number, taper = 0.28,
): void {
  const path = new CatmullRomCurve3(points.map(point => new Vector3(...point)));
  const steps = 24;
  const sides = 6;
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
  parent.add(new Mesh(geometry, new MeshStandardMaterial({ color, roughness: 0.86 })));
}
