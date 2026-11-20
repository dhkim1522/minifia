import {
  AdditiveBlending, DirectionalLight, Mesh, MeshBasicMaterial, MeshPhysicalMaterial,
  MeshStandardMaterial, PlaneGeometry, SpotLight,
} from "three";
import type { Scene, Texture, Vector3 } from "three";
import { Bundle, tf } from "../../../src/world/maps/bar";
import type { BarScene } from "../../../src/world/maps/bar";
import { addRoomDetail } from "../../../src/world/barAssets/room-detail";
import { addFinishedTable, softEdge, tableReflection } from "../../../src/world/barAssets/table-finish";

function addWallDetails(root: Scene, wood: Texture | null): void {
  const walnut = new Bundle();
  const brass = new Bundle();
  const glass = new Bundle();
  const backlit = new Bundle();
  const shelfX = 2.5;
  const wallZ = -4.50;
  walnut.box(1.75, 1.67, 0.08, "#372021", tf(shelfX, 1.74, wallZ));
  backlit.box(1.54, 1.36, 0.01, "#42302d", tf(shelfX, 1.74, wallZ + 0.047));
  for (const x of [shelfX - 0.84, shelfX + 0.84]) {
    walnut.box(0.09, 1.68, 0.31, "#53382d", tf(x, 1.74, wallZ + 0.144));
    brass.box(0.008, 1.40, 0.02, "#a87c51", tf(x, 1.75, wallZ + 0.308));
  }
  const bottleColors = ["#812c28", "#926039", "#485134", "#536672", "#5e3b39"] as const;
  for (const [row, y] of [1.04, 1.48, 1.92, 2.43].entries()) {
    walnut.box(1.73, 0.064, 0.38, "#6e4837", tf(shelfX, y, wallZ + 0.15));
    brass.box(1.70, 0.016, 0.021, "#a37b55", tf(shelfX, y + 0.012, wallZ + 0.342));
    if (row === 3) continue;
    for (let i = 0; i < 6; i++) {
      const x = shelfX + (i - 2.5) * 0.22;
      const z = wallZ + 0.18 + (i % 2) * 0.065;
      const radius = 0.046 + ((i + row) % 3) * 0.005;
      const height = 0.13 + ((i * 3 + row * 5) % 7) * 0.013;
      const tint = bottleColors[(i + row * 2) % bottleColors.length]!;
      glass.cyl(radius, radius, height, 12, tint, tf(x, y + 0.035 + height / 2, z));
      glass.cyl(radius * 0.43, radius, 0.037, 12, tint, tf(x, y + 0.052 + height, z));
      glass.cyl(radius * 0.39, radius * 0.39, 0.063, 10, tint, tf(x, y + 0.096 + height, z));
      brass.cyl(radius * 0.43, radius * 0.43, 0.017, 10, i % 2 ? "#af7145" : "#86766b", tf(x, y + 0.126 + height, z));
      if (i % 3 !== 2) backlit.box(radius * 1.13, 0.048, 0.004, "#a58b66", tf(x, y + 0.059 + height / 2, z + radius));
    }
  }

  for (let i = 0; i < 8; i++) {
    const x = -4.12 + i * 1.12;
    walnut.box(1.06, 0.69, 0.06, i % 2 ? "#513326" : "#4e3128", tf(x, 0.47, -4.51));
    walnut.box(0.89, 0.51, 0.035, "#5a3b2d", tf(x, 0.45, -4.472));
    for (const dx of [-0.44, 0.44]) brass.box(0.010, 0.53, 0.013, "#79573d", tf(x + dx, 0.45, -4.45));
  }
  const woodDetail = new MeshPhysicalMaterial({ vertexColors: true, map: wood, roughness: 0.62, clearcoat: 0.16, clearcoatRoughness: 0.68,
    emissive: "#805039", emissiveIntensity: 0.29 });
  const woodMesh = walnut.build(woodDetail, "walnut-wall-and-shelf");
  woodMesh.receiveShadow = true;
  root.add(woodMesh,
    brass.build(new MeshStandardMaterial({ vertexColors: true, metalness: 0.65, roughness: 0.32 }), "shelf-brass-trim"),
    glass.build(new MeshPhysicalMaterial({ vertexColors: true, roughness: 0.26, clearcoat: 0.65 }), "shelf-glassware"),
    backlit.build(new MeshStandardMaterial({ vertexColors: true, emissive: "#bd8046", emissiveIntensity: 0.095, roughness: 0.91 }), "shelf-warm-backlight"));

  for (const y of [1.27, 1.72, 2.17]) {
    const glow = new Mesh(new PlaneGeometry(2.0, 0.64), new MeshBasicMaterial({
      color: "#c2814a", map: softEdge, transparent: true, opacity: 0.15,
      blending: AdditiveBlending, depthWrite: false,
    }));
    glow.position.set(shelfX, y, wallZ + 0.053);
    root.add(glow);
  }
}

export function addFinishedRoom(bar: BarScene, seats: readonly Vector3[], tableY: number, crafted = false): void {
  const root = bar.root;
  root.environment = tableReflection;
  root.environmentIntensity = 0.47;
  bar.lights.hemi.intensity *= 0.50;
  bar.lights.hemi.color.set("#bdc8e1");
  bar.lights.hemi.groundColor.set("#735445");
  bar.lights.moon.intensity *= 0.38;
  bar.lights.moon.color.set("#9ab2e2");
  bar.lights.stage.intensity *= 0.65;
  bar.lights.pendantA.intensity *= 0.76;
  const beam = bar.meshes.windowBeam;
  if (beam?.material instanceof MeshBasicMaterial) beam.material.opacity *= 0.34;

  const key = new SpotLight("#ffcc98", 30, 8, Math.PI / 3.4, 0.75, 2);
  key.position.set(-1.78, 2.88, 0.76);
  key.target.position.set(-0.22, 0.96, -1.25);
  const rim = new DirectionalLight("#9cb7ff", 1.02);
  rim.position.set(1.73, 2.15, -3.98);
  root.add(key, key.target, rim);

  const floor = bar.meshes.woodFloor;
  const wood = floor?.material instanceof MeshStandardMaterial ? floor.material.map : null;
  if (floor?.material instanceof MeshStandardMaterial) floor.material.roughness = 0.72;
  addFinishedTable(root, seats, tableY, wood);
  if (crafted) addRoomDetail(root, wood);
  else addWallDetails(root, wood);
}
