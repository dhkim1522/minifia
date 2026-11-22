import {
  CatmullRomCurve3, Color, DataTexture, Float32BufferAttribute, Group, LinearFilter,
  LinearMipmapLinearFilter, MathUtils, Mesh, MeshStandardMaterial, RepeatWrapping,
  RGBAFormat, SphereGeometry, TubeGeometry, Vector3,
} from "three";
import { markExpressionPart, sculptRoot, sculptSegments, type HeadDensity } from "./head-sculpt";

function feltTexture(): DataTexture {
  const size = 96;
  const pixels = new Uint8Array(size * size * 4);
  let seed = 173;
  for (let i = 0; i < pixels.length; i += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const value = 96 + (seed >>> 25);
    pixels.set([value, value, value, 255], i);
  }
  const texture = new DataTexture(pixels, size, size, RGBAFormat);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(3, 2);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

const felt = new MeshStandardMaterial({
  vertexColors: true, roughness: 0.91, bumpMap: feltTexture(), bumpScale: 0.015,
});
const eyes = new MeshStandardMaterial({ color: "#27232a", roughness: 0.34 });
const nose = new MeshStandardMaterial({ color: "#3d3031", roughness: 0.45 });
const lids = new MeshStandardMaterial({ color: "#b97751", roughness: 0.95 });
const mouth = new MeshStandardMaterial({ color: "#8b6250", roughness: 0.95 });
const glint = new MeshStandardMaterial({ color: "#f7e6d1", roughness: 0.38 });
const orange = new Color("#dc8b4e");
const burntOrange = new Color("#b36743");
const cream = new Color("#f2dfba");
const pink = new Color("#d99979");
const innerEar = new Color("#dda98c");
const bridge = new Color("#ebaa65");
const fur = new Color("#b9724d");
const forward = new Vector3(0, 0, 1);
const up = new Vector3(0, 1, 0);

type Surface = (unit: Vector3, out: Vector3) => Vector3;

function gaussian(value: number, radius: number): number {
  return Math.exp(-((value / radius) ** 2));
}

function faceWidth(unitY: number): number {
  return 0.534 * (1 + 0.16 * gaussian(unitY + 0.23, 0.42) - 0.078 * MathUtils.smoothstep(-unitY, 0.31, 1));
}

function faceZ(x: number, y: number, unitZ: number): number {
  const front = MathUtils.smoothstep(unitZ, 0.06, 0.72);
  const muzzle = 0.106 * gaussian(x, 0.267) * gaussian(y + 0.133, 0.151);
  const cheeks = 0.102 * gaussian(Math.abs(x) - 0.313, 0.191) * gaussian(y + 0.132, 0.147);
  const brow = 0.023 * gaussian(Math.abs(x) - 0.19, 0.11) * gaussian(y - 0.092, 0.07);
  const eyeSocket = 0.013 * gaussian(Math.abs(x) - 0.201, 0.094) * gaussian(y - 0.017, 0.077);
  return unitZ * 0.438 + front * (muzzle + cheeks + brow - eyeSocket);
}

function frontZ(x: number, y: number): number {
  const unitY = y / 0.42;
  const unitX = x / faceWidth(unitY);
  return faceZ(x, y, Math.sqrt(Math.max(0, 1 - unitX ** 2 - unitY ** 2)));
}

const faceSurface: Surface = (unit, out) => {
  const x = unit.x * faceWidth(unit.y);
  const y = unit.y * 0.42;
  return out.set(x, y, faceZ(x, y, unit.z));
};

function faceColor(unit: Vector3, position: Vector3, out: Color): void {
  const { x, y } = position;
  const side = Math.abs(x);
  const whiteEdge = -0.073 + 0.082 * MathUtils.smoothstep(side, 0.025, 0.49);
  const creamMask = (1 - MathUtils.smoothstep(y, whiteEdge - 0.052, whiteEdge + 0.036)) * MathUtils.smoothstep(unit.z, -0.55, 0.39);
  const shade = 0.24 * gaussian(side - 0.46, 0.19) + 0.18 * MathUtils.smoothstep(y, 0.21, 0.42);
  const bridgeLight = 0.48 * gaussian(side, 0.21) * gaussian(y - 0.12, 0.17) * MathUtils.smoothstep(unit.z, 0.24, 0.79);
  out.copy(orange).lerp(burntOrange, shade).lerp(bridge, bridgeLight).lerp(cream, creamMask);
  const blush = 0.51 * gaussian(side - 0.348, 0.081) * gaussian(y + 0.115, 0.062) * MathUtils.smoothstep(unit.z, 0.22, 0.72);
  out.lerp(pink, blush);
  for (const [dx, dy] of [[0.133, -0.152], [0.166, -0.169], [0.172, -0.127]] as const) {
    const spot = gaussian(side - dx, 0.013) * gaussian(y - dy, 0.013);
    out.lerp(fur, 0.34 * spot * MathUtils.smoothstep(unit.z, 0.5, 0.8));
  }
}

function earLining(unit: Vector3): number {
  return MathUtils.smoothstep(unit.z, 0.49, 0.84) * MathUtils.smoothstep(unit.y, -0.8, -0.39)
    * (1 - MathUtils.smoothstep(unit.y, 0.54, 0.91));
}

function earSurface(side: number): Surface {
  return (unit, out) => {
    const t = (unit.y + 1) / 2;
    return out.set(
      side * (0.273 + 0.16 * t) + unit.x * (0.234 - 0.127 * t),
      0.118 + 0.555 * t,
      0.009 - 0.067 * t + unit.z * (0.132 - 0.049 * t) - 0.033 * earLining(unit),
    );
  };
}

function earColor(unit: Vector3, _position: Vector3, out: Color): void {
  out.copy(orange).lerp(burntOrange, 0.22 + 0.49 * MathUtils.smoothstep(unit.y, 0.36, 0.92));
  out.lerp(innerEar, earLining(unit) * 0.96);
}

/** A single sculpted surface, with numerical smooth normals across the sphere seam. */
function sculpt(group: Group, surface: Surface, paint: (unit: Vector3, position: Vector3, color: Color) => void, width: number, height: number): SphereGeometry {
  width = sculptSegments(group, width, 20);
  height = sculptSegments(group, height, 12);
  const geometry = new SphereGeometry(1, width, height);
  const positions = geometry.attributes.position!;
  const normals = geometry.attributes.normal!;
  const colors = new Float32Array(positions.count * 3);
  const unit = new Vector3();
  const point = new Vector3();
  const tangent = new Vector3();
  const binormal = new Vector3();
  const sample = new Vector3();
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const d = new Vector3();
  const color = new Color();
  for (let i = 0; i < positions.count; i++) {
    unit.fromBufferAttribute(positions, i).normalize();
    surface(unit, point);
    paint(unit, point, color);
    positions.setXYZ(i, point.x, point.y, point.z);
    colors.set([color.r, color.g, color.b], i * 3);

    tangent.crossVectors(Math.abs(unit.y) < 0.96 ? up : forward, unit).normalize();
    binormal.crossVectors(unit, tangent);
    surface(sample.copy(unit).addScaledVector(tangent, 0.002).normalize(), a);
    surface(sample.copy(unit).addScaledVector(tangent, -0.002).normalize(), b);
    surface(sample.copy(unit).addScaledVector(binormal, 0.002).normalize(), c);
    surface(sample.copy(unit).addScaledVector(binormal, -0.002).normalize(), d);
    a.sub(b).cross(c.sub(d)).normalize();
    normals.setXYZ(i, a.x, a.y, a.z);
  }
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

function insetSphere(group: Group, x: number, y: number, size: readonly [number, number, number], material: MeshStandardMaterial, offset = 0): Mesh {
  const mesh = new Mesh(new SphereGeometry(1, sculptSegments(group, 20, 12), sculptSegments(group, 14, 8)), material);
  mesh.scale.set(...size);
  mesh.position.set(x, y, frontZ(x, y) + offset);
  const dx = (frontZ(x + 0.003, y) - frontZ(x - 0.003, y)) / 0.006;
  const dy = (frontZ(x, y + 0.003) - frontZ(x, y - 0.003)) / 0.006;
  mesh.quaternion.setFromUnitVectors(forward, new Vector3(-dx, -dy, 1).normalize());
  group.add(mesh);
  return mesh;
}

function expression(group: Group, points: readonly (readonly [number, number])[], radius: number, material: MeshStandardMaterial): void {
  const path = new CatmullRomCurve3(points.map(([x, y]) => new Vector3(x, y, frontZ(x, y) + radius * 0.15)));
  const segments = sculptSegments(group, 16, 10);
  const sides = sculptSegments(group, 6, 5);
  const geometry = new TubeGeometry(path, segments, radius, sides, false);
  const positions = geometry.attributes.position!;
  const center = new Vector3();
  const vertex = new Vector3();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    path.getPointAt(t, center);
    const thickness = MathUtils.smoothstep(Math.min(t, 1 - t), 0, 0.18);
    for (let j = 0; j <= sides; j++) {
      const index = i * (sides + 1) + j;
      vertex.fromBufferAttribute(positions, index).lerp(center, 0.96 * (1 - thickness));
      positions.setXYZ(index, vertex.x, vertex.y, vertex.z);
    }
  }
  group.add(new Mesh(geometry, material));
}

/** Origin is the head center, with +Z facing the table. */
export function makeFoxDetail(density: HeadDensity = "close"): Group {
  const group = sculptRoot(density);
  group.name = "fox-detail";
  group.add(new Mesh(sculpt(group, faceSurface, faceColor, 84, 56), felt));
  const lips = markExpressionPart(new Group(), "mouth", [0, -0.161, 0]);
  group.add(lips);
  for (const side of [-1, 1]) {
    group.add(new Mesh(sculpt(group, earSurface(side), earColor, 42, 34), felt));
    const x = side * 0.201;
    const y = 0.021;
    const eye = markExpressionPart(insetSphere(group, x, y, [0.050, 0.064, 0.032], eyes, -0.003), "eye");
    const highlight = new Mesh(new SphereGeometry(1, sculptSegments(group, 10, 8), sculptSegments(group, 7, 5)), glint);
    highlight.scale.set(0.083, 0.066, 0.036);
    highlight.position.set(-0.27, 0.28, 0.94);
    eye.add(highlight);
    expression(group, [[x - 0.049, y + 0.022], [x - 0.032, y + 0.056], [x, y + 0.065], [x + 0.031, y + 0.052], [x + 0.048, y + 0.018]], 0.003, lids);
    expression(lips, [[0, -0.154], [side * 0.027, -0.17], [side * 0.064, -0.174], [side * 0.106, -0.158]], 0.006, mouth);
  }
  insetSphere(group, 0, -0.099, [0.065, 0.041, 0.032], nose, 0.006);
  expression(group, [[0, -0.119], [0, -0.140], [0, -0.153]], 0.006, mouth);
  group.traverse(object => {
    if (object instanceof Mesh) object.receiveShadow = true;
  });
  return group;
}
