import {
  BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, LatheGeometry, MeshBasicMaterial,
  MeshPhysicalMaterial, MeshStandardMaterial, Shape, ShapeGeometry, TorusGeometry,
  TubeGeometry, Vector2, Vector3,
} from "three";
import type { Object3D } from "three";
import { Bundle, tf, under } from "../maps/bar";

type Profile = readonly (readonly [radius: number, height: number])[];

function lathe(profile: Profile, segments: number): LatheGeometry {
  return new LatheGeometry(profile.map(([radius, height]) => new Vector2(radius, height)), segments);
}

const shadeProfile: Profile = [
  [0.139, 0.162], [0.150, 0.166], [0.149, 0.177], [0.140, 0.195],
  [0.125, 0.215], [0.103, 0.230], [0.076, 0.243], [0.050, 0.249],
  [0.022, 0.251], [0, 0.251],
];

function opalShade(): LatheGeometry {
  const segments = 64;
  const geometry = lathe(shadeProfile, segments);
  const positions = geometry.getAttribute("position");
  for (let ring = 0; ring <= segments; ring++) {
    const flute = Math.cos(ring * 16 * Math.PI * 2 / segments);
    for (let j = 0; j < shadeProfile.length; j++) {
      const i = ring * shadeProfile.length + j;
      const radius = shadeProfile[j]![0];
      const ridge = 1 + 0.035 * flute * Math.min(1, radius / 0.1);
      positions.setXYZ(i, positions.getX(i) * ridge, positions.getY(i), positions.getZ(i) * ridge);
    }
  }
  geometry.computeVertexNormals();
  return geometry;
}

function addLamp(brass: Bundle, glass: Bundle, inner: Bundle, tableY: number): void {
  const pedestal: Profile = [
    [0, 0.006], [0.139, 0.006], [0.150, 0.009], [0.153, 0.016],
    [0.148, 0.024], [0.116, 0.025], [0.114, 0.033], [0.106, 0.038],
    [0.079, 0.039], [0.073, 0.049], [0.037, 0.052], [0.026, 0.067],
    [0.024, 0.121], [0.033, 0.136], [0.047, 0.139], [0.051, 0.149],
    [0.047, 0.159], [0.021, 0.168], [0, 0.168],
  ];
  brass.add(lathe(pedestal, 36), "#a17849", tf(0, tableY, 0));
  brass.add(new TorusGeometry(0.129, 0.0035, 6, 36), "#d7ac72", tf(0, tableY + 0.025, 0, -Math.PI / 2));
  brass.add(new TorusGeometry(0.148, 0.004, 7, 48), "#b88d58", tf(0, tableY + 0.166, 0, -Math.PI / 2));
  brass.add(lathe([[0.026, 0.249], [0.026, 0.254], [0.018, 0.259], [0.013, 0.267], [0, 0.267]], 20),
    "#aa7847", tf(0, tableY, 0));
  glass.add(opalShade(), "#d9ae75", tf(0, tableY, 0));
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    const curve = new CatmullRomCurve3(shadeProfile.slice(1, -2).map(([radius, height]) => {
      const ridge = radius * (1 + 0.035 * Math.min(1, radius / 0.1));
      return new Vector3(Math.sin(angle) * ridge, height, Math.cos(angle) * ridge);
    }));
    brass.add(new TubeGeometry(curve, 10, 0.0027, 5, false), "#98663d", tf(0, tableY, 0));
  }
  inner.cyl(0.141, 0.130, 0.009, 32, "#f7d89a", tf(0, tableY + 0.163, 0));
}

function paperShape(width: number, depth: number, fold: number): ShapeGeometry {
  const x = width / 2;
  const y = depth / 2;
  const shape = new Shape();
  shape.moveTo(-x, -y + 0.004);
  shape.quadraticCurveTo(-x, -y, -x + 0.004, -y);
  shape.lineTo(x - 0.004, -y);
  shape.quadraticCurveTo(x, -y, x, -y + 0.004);
  shape.lineTo(x, y - fold);
  shape.lineTo(x - fold, y);
  shape.lineTo(-x + 0.004, y);
  shape.quadraticCurveTo(-x, y, -x, y - 0.004);
  shape.closePath();
  return new ShapeGeometry(shape, 3);
}

function foldedCorner(): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([
    0.062, 0.065, 0, 0.088, 0.039, 0, 0.063, 0.042, 0.012,
  ], 3));
  geometry.setAttribute("uv", new Float32BufferAttribute([0, 1, 1, 0, 0, 0], 2));
  geometry.setIndex([0, 2, 1]);
  geometry.computeVertexNormals();
  return geometry;
}

function addNotebook(paper: Bundle, trim: Bundle, setting: ReturnType<typeof tf>, near: boolean, active: boolean): void {
  const book = under(setting, tf(-0.087, 0, -0.009, 0, 0.11));
  paper.box(0.185, 0.007, 0.133, "#635043", under(book, tf(0, 0.004, 0)));
  paper.box(0.175, 0.006, 0.126, "#a99470", under(book, tf(0.001, 0.010, 0.001)));
  paper.add(paperShape(0.176, 0.130, near ? 0.026 : 0.010), active ? "#e7c88e" : "#d5bd93",
    under(book, tf(0, 0.014, 0, -Math.PI / 2)));
  if (near) {
    paper.add(foldedCorner(), "#e7cda3", under(book, tf(0, 0.014, 0, -Math.PI / 2)));
    paper.box(0.159, 0.0014, 0.0012, "#c2a57a", under(book, tf(0, 0.011, 0.064)));
    paper.box(0.0014, 0.002, 0.106, "#bd9e72", under(book, tf(-0.086, 0.009, 0)));
  }
  for (const [i, z] of [-0.038, -0.018, 0.002, 0.022, 0.042].entries()) {
    if (!near && i % 2 !== 0) continue;
    paper.box(0.130, 0.0007, 0.0017, "#b59a72", under(book, tf(-0.005, 0.0144, z)));
  }
  if (near) {
    paper.box(0.0017, 0.0007, 0.108, "#bc9873", under(book, tf(-0.062, 0.0145, 0)));
  }
  const pencil = under(setting, tf(-0.199, 0.012, 0.115, 0, -0.37, 0));
  paper.cyl(0.006, 0.006, 0.098, 6, "#8e5739", under(pencil, tf(0, 0, 0, 0, 0, -Math.PI / 2)));
  paper.cyl(0.0025, 0.006, 0.016, 6, "#caa678", under(pencil, tf(0.057, 0, 0, 0, 0, -Math.PI / 2)));
  paper.cyl(0.0008, 0.0025, 0.005, 6, "#352b32", under(pencil, tf(0.067, 0, 0, 0, 0, -Math.PI / 2)));
  trim.cyl(0.0065, 0.0065, 0.011, 8, "#a98d69", under(pencil, tf(-0.050, 0, 0, 0, 0, -Math.PI / 2)));
  paper.cyl(0.006, 0.0065, 0.008, 8, "#835b54", under(pencil, tf(-0.059, 0, 0, 0, 0, -Math.PI / 2)));
}

function addGlass(
  glass: Bundle, trim: Bundle, liquid: Bundle, coaster: Bundle, setting: ReturnType<typeof tf>, near: boolean,
): void {
  const cup = under(setting, tf(0.20, 0, 0.025));
  coaster.cyl(0.077, 0.073, 0.009, 20, "#342928", under(cup, tf(0, 0.006, 0)));
  trim.add(new TorusGeometry(0.067, 0.0019, 5, 20), "#9d754f", under(cup, tf(0, 0.0105, 0, -Math.PI / 2)));
  const walls: Profile = [
    [0, 0.011], [0.031, 0.011], [0.037, 0.015], [0.040, 0.027],
    [0.048, 0.070], [0.049, 0.081], [0.046, 0.083],
    [0.043, 0.080], [0.042, 0.071], [0.035, 0.034],
    [0.031, 0.027], [0, 0.027],
  ];
  glass.add(lathe(walls, near ? 14 : 12), "#85715f", cup);
  glass.add(new TorusGeometry(0.046, 0.002, 6, near ? 28 : 20), "#c4ab8c",
    under(cup, tf(0, 0.081, 0, -Math.PI / 2)));
  liquid.cyl(0.041, 0.035, 0.026, 20, "#56301e", under(cup, tf(0, 0.053, 0)));
  liquid.add(new TorusGeometry(0.039, 0.0013, 5, 20), "#a86c3b",
    under(cup, tf(0, 0.066, 0, -Math.PI / 2)));
}

export function addDetailedTable(root: Object3D, seats: readonly Vector3[], tableY: number, speaker: number): void {
  const brass = new Bundle();
  const shade = new Bundle();
  const lampGlow = new Bundle();
  const glasses = new Bundle();
  const liquid = new Bundle();
  const paper = new Bundle();
  const coasters = new Bundle();
  addLamp(brass, shade, lampGlow, tableY);
  for (const [i, pos] of seats.entries()) {
    const radius = i === 0 ? 0.51 : 0.655;
    const setting = tf(pos.x * radius, tableY + 0.009, pos.z * radius, 0, Math.atan2(-pos.x, -pos.z));
    const near = i === 0 || i === 1 || i === 3;
    addNotebook(paper, brass, setting, near, i === speaker);
    addGlass(glasses, brass, liquid, coasters, setting, near);
  }
  const meshes = [
    brass.build(new MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.62,
      emissive: "#a37248", emissiveIntensity: 0.12 }), "seated-detailed-table-brass"),
    shade.build(new MeshPhysicalMaterial({ vertexColors: true, roughness: 0.37, clearcoat: 0.36, clearcoatRoughness: 0.42,
      emissive: "#a16e42", emissiveIntensity: 0.25 }), "seated-opal-shade"),
    lampGlow.build(new MeshBasicMaterial({ vertexColors: true }), "seated-opal-inner"),
    glasses.build(new MeshPhysicalMaterial({ vertexColors: true, roughness: 0.28, clearcoat: 0.76, clearcoatRoughness: 0.21,
      flatShading: true, envMapIntensity: 0.72 }), "seated-cut-glass"),
    liquid.build(new MeshStandardMaterial({ vertexColors: true, roughness: 0.23 }), "seated-drink"),
    paper.build(new MeshStandardMaterial({ vertexColors: true, roughness: 0.94,
      emissive: "#765f3b", emissiveIntensity: 0.11 }), "seated-notebooks"),
    coasters.build(new MeshStandardMaterial({ vertexColors: true, roughness: 0.91 }), "seated-leather-coasters"),
  ];
  for (const mesh of meshes) mesh.receiveShadow = true;
  for (const mesh of meshes.slice(0, 4)) mesh.userData.tableBlocker = true;
  root.add(...meshes);
}
