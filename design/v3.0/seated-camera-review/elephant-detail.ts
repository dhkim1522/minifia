import {
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from "three";
import { MarchingCubes } from "three/addons/objects/MarchingCubes.js";

type Point = readonly [number, number, number];
const blue = new Color("#90b6df");
const crownBlue = new Color("#a0bfe0");
const pink = new Color("#b18d9e");
const foldBlue = new Color("#7195be");
const nostrilBlue = new Color("#465b7b");

const trunkPath = [
  [0, -0.035, 0.357, 0.177],
  [0, -0.156, 0.477, 0.158],
  [0.018, -0.292, 0.59, 0.131],
  [0.053, -0.404, 0.67, 0.112],
  [0.103, -0.47, 0.738, 0.102],
  [0.126, -0.45, 0.779, 0.101],
] as const;

const trunkSegments = trunkPath.slice(1).map(([x, y, z, radius], i) => {
  const [sx, sy, sz, startRadius] = trunkPath[i]!;
  const dx = x - sx;
  const dy = y - sy;
  const dz = z - sz;
  return { sx, sy, sz, startRadius, dx, dy, dz, radiusDelta: radius - startRadius,
    inverseLengthSquared: 1 / (dx * dx + dy * dy + dz * dz) };
});

function ellipsoid(x: number, y: number, z: number, rx: number, ry: number, rz: number): number {
  const a = x / rx;
  const b = y / ry;
  const c = z / rz;
  const u = a / rx;
  const v = b / ry;
  const w = c / rz;
  const k = Math.sqrt(u * u + v * v + w * w);
  const r = Math.sqrt(a * a + b * b + c * c);
  return k > 1e-8 ? r * (r - 1) / k : -Math.min(rx, ry, rz);
}

function blend(a: number, b: number, width: number): number {
  const h = Math.max(0, width - Math.abs(a - b)) / width;
  return Math.min(a, b) - width * h * h * 0.25;
}

/** 가까이서만 드러나는 얕은 가로 주름. 콧대 중앙의 곡선을 따라간다. */
function foldField(x: number, y: number, z: number): number {
  if (z < 0.45 || y > -0.13 || y < -0.46) return 0;
  const xx = x - (-y - 0.13) * 0.18;
  const crossTrunk = Math.exp(-((xx / 0.151) ** 4));
  const arc = 1.9 * xx * xx;
  return crossTrunk * (
    Math.exp(-(((y + 0.207 + arc) / 0.016) ** 2)) +
    Math.exp(-(((y + 0.28 + arc) / 0.016) ** 2)) +
    Math.exp(-(((y + 0.356 + arc) / 0.018) ** 2))
  );
}

/** 머리, 볼, 콧등, 코끝을 하나의 등치면으로 만들고 코끝을 안으로 파낸다. */
function faceField(x: number, y: number, z: number): number {
  const cranium = ellipsoid(x, y - 0.025, z + 0.018, 0.506, 0.45, 0.46);
  const cheek = ellipsoid(Math.abs(x) - 0.264, y + 0.104, z - 0.248, 0.236, 0.211, 0.208);
  let d = blend(cranium, cheek, 0.107);
  const bridge = ellipsoid(x, y + 0.074, z - 0.356, 0.207, 0.204, 0.196);
  d = blend(d, bridge, 0.112);

  let trunk = Infinity;
  for (const { sx, sy, sz, startRadius, dx, dy, dz, radiusDelta, inverseLengthSquared } of trunkSegments) {
    const rx = x - sx;
    const ry = y - sy;
    const rz = z - sz;
    const t = Math.max(0, Math.min(1, (rx * dx + ry * dy + rz * dz) * inverseLengthSquared));
    const px = rx - dx * t;
    const py = ry - dy * t;
    const pz = rz - dz * t;
    trunk = Math.min(trunk, Math.sqrt(px * px + py * py + pz * pz) - (startRadius + radiusDelta * t));
  }
  d = blend(d, trunk, 0.102) + foldField(x, y, z) * 0.012;
  if (z > 0.77 && y < -0.365) {
    const opening = ellipsoid(Math.abs(x - 0.127) - 0.037, y + 0.425, z - 0.869, 0.024, 0.028, 0.046);
    d = -blend(-d, opening, 0.010);
  }
  return d;
}

function sculptFace(): BufferGeometry {
  const resolution = 72;
  const half = resolution / 2;
  const size = 0.88;
  const offsetZ = 0.15;
  const cubes = new MarchingCubes(resolution, skin, false, false, 24_000);
  cubes.isolation = 0;
  for (let k = 0; k < resolution; k++) {
    const z = (k / half - 1) * size + offsetZ;
    for (let j = 0; j < resolution; j++) {
      const y = (j / half - 1) * size;
      for (let i = 0; i < resolution; i++) {
        const x = (i / half - 1) * size;
        cubes.field[(k * resolution + j) * resolution + i] = -faceField(x, y, z);
      }
    }
  }
  cubes.update();

  const used = cubes.geometry.drawRange.count * 3;
  const positions = cubes.positionArray.slice(0, used);
  const normals = cubes.normalArray.slice(0, used);
  cubes.geometry.dispose();
  const positionsAttr = new Float32BufferAttribute(positions, 3);
  const normalsAttr = new Float32BufferAttribute(normals, 3);
  const colors = new Float32Array(used);
  const tint = new Color();
  const normal = new Vector3();
  for (let i = 0; i < positionsAttr.count; i++) {
    const x = positionsAttr.getX(i) * size;
    const y = positionsAttr.getY(i) * size;
    const z = positionsAttr.getZ(i) * size + offsetZ;
    positionsAttr.setXYZ(i, x, y, z);
    normal.fromBufferAttribute(normalsAttr, i).normalize();
    normalsAttr.setXYZ(i, normal.x, normal.y, normal.z);
    const blush = z > 0.305 ? Math.exp(-(((Math.abs(x) - 0.348) / 0.085) ** 2 + ((y + 0.118) / 0.077) ** 2)) : 0;
    const nostril = z > 0.80 && y < -0.375
      ? Math.exp(-((Math.abs(x - 0.127) - 0.037) ** 2 / 0.00048 + (y + 0.425) ** 2 / 0.00059))
      : 0;
    const pores = 0.019 * Math.sin(x * 86 + Math.sin(z * 64)) * Math.sin(y * 85 - z * 61);
    const crown = Math.max(0, y + 0.07);
    tint.copy(blue).lerp(crownBlue, crown).lerp(pink, blush * 0.57).lerp(foldBlue, Math.min(1, foldField(x, y, z)) * 0.45)
      .lerp(nostrilBlue, nostril * 0.9).multiplyScalar(1 + pores);
    tint.toArray(colors, i * 3);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", positionsAttr);
  geometry.setAttribute("normal", normalsAttr);
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

function sculptEar(side: number): SphereGeometry {
  const geometry = new SphereGeometry(1, 36, 26);
  const position = geometry.getAttribute("position");
  const colors = new Float32Array(position.count * 3);
  const lining = new Color("#748aae");
  const tint = new Color();
  const angle = -side * 0.24;
  for (let i = 0; i < position.count; i++) {
    const u = position.getX(i);
    const v = position.getY(i);
    const w = position.getZ(i);
    const lateral = u * (0.26 + 0.036 * v) - side * 0.024 * Math.max(0, -v);
    const vertical = v * 0.341;
    const x = side * 0.522 + lateral * Math.cos(angle) - vertical * Math.sin(angle);
    const y = -0.011 + lateral * Math.sin(angle) + vertical * Math.cos(angle);
    const well = Math.max(w, 0) ** 3 * 0.085;
    const ridge = Math.max(w, 0) * 0.040 * Math.exp(-(((u + side * 0.37 + v * 0.23) / 0.20) ** 2));
    const z = -0.068 + w * 0.127 + side * u * 0.072 - well + ridge;
    position.setXYZ(i, x, y, z);
    const inside = Math.max(0, Math.min(1, (w - 0.28) / 0.57));
    tint.copy(blue).lerp(lining, inside).multiplyScalar(1 - inside * 0.059 + ridge);
    tint.toArray(colors, i * 3);
  }
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function volume(parent: Group, color: string, at: Point, scale: Point, roughness = 0.79): Mesh {
  const mesh = new Mesh(new SphereGeometry(1, 24, 16), new MeshStandardMaterial({ color, roughness }));
  mesh.position.set(...at);
  mesh.scale.set(...scale);
  parent.add(mesh);
  return mesh;
}

function crease(parent: Group, color: string, points: readonly Point[], radius: number): void {
  const path = new CatmullRomCurve3(points.map((point) => new Vector3(...point)));
  parent.add(new Mesh(new TubeGeometry(path, 16, radius, 8), new MeshStandardMaterial({ color, roughness: 0.91 })));
}

const skin = new MeshPhysicalMaterial({ vertexColors: true, roughness: 0.82, sheen: 0.23, sheenColor: new Color("#7e9aba"), sheenRoughness: 0.84 });
let faceGeometry: BufferGeometry | undefined;
let earGeometries: [SphereGeometry, SphereGeometry] | undefined;

/** 목 관절에 기존 머리 중심 좌표로 부착한다. */
export function makeElephantDetail(): Group {
  const head = new Group();
  head.name = "elephant-detail";
  faceGeometry ??= sculptFace();
  earGeometries ??= [sculptEar(-1), sculptEar(1)];
  const face = new Mesh(faceGeometry, skin);
  face.name = "elephant-face-and-trunk";
  head.add(face);
  for (const ear of earGeometries) head.add(new Mesh(ear, skin));

  for (const side of [-1, 1]) {
    const socket = new Group();
    socket.position.set(side * 0.203, 0.063, 0.438);
    socket.rotation.y = side * 0.38;
    head.add(socket);
    volume(socket, "#769ac2", [0, -0.005, -0.006], [0.089, 0.105, 0.033]);
    volume(socket, "#344d69", [0, -0.001, 0.014], [0.062, 0.081, 0.025], 0.51);
    volume(socket, "#202637", [0, -0.006, 0.032], [0.052, 0.068, 0.016], 0.32);
    volume(socket, "#f1eee4", [-0.017, 0.025, 0.046], [0.014, 0.017, 0.006], 0.42);
    volume(socket, "#9eb8c9", [0.016, -0.025, 0.045], [0.006, 0.007, 0.003], 0.49);
    crease(socket, "#a1c0df", [[-0.068, 0.026, 0.009], [-0.044, 0.075, 0.020], [0.008, 0.086, 0.021], [0.054, 0.059, 0.012]], 0.010);
    crease(head, "#6083a9", [[side * 0.16, -0.18, 0.46], [side * 0.226, -0.205, 0.437], [side * 0.274, -0.187, 0.432]], 0.008);
  }
  head.traverse((node) => {
    if (node instanceof Mesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });
  return head;
}
