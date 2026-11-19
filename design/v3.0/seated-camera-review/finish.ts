import {
  AdditiveBlending, BackSide, CircleGeometry, Color, CylinderGeometry, DataTexture, DirectionalLight,
  EquirectangularReflectionMapping, FloatType, LatheGeometry, LinearFilter, LinearMipmapLinearFilter,
  Mesh, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, PlaneGeometry, RepeatWrapping,
  RGBAFormat, SpotLight, TorusGeometry, Vector2,
} from "three";
import type { Scene, Texture, Vector3 } from "three";
import { Bundle, tf, makeGlowTexture } from "../../../src/world/maps/bar";
import type { BarScene } from "../../../src/world/maps/bar";

/** 작은 실내 광원을 구면으로 베이크한다. 창과 램프의 반사는 실제 표면 거칠기를 따른다. */
function makeReflectionMap(): DataTexture {
  const width = 128;
  const height = width / 2;
  const pixels = new Float32Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const pitch = (y + 0.5) / height * Math.PI - Math.PI / 2;
    const cosPitch = Math.cos(pitch);
    const z = Math.sin(pitch);
    for (let x = 0; x < width; x++) {
      const yaw = (x + 0.5) / width * Math.PI * 2;
      const warm = 1.62 * Math.max(0, -Math.cos(yaw) * cosPitch * 0.73 + z * 0.68) ** 18;
      const blue = 0.60 * Math.max(0, Math.sin(yaw) * cosPitch * 0.89 + z * 0.46) ** 12;
      const ambient = 0.055 + 0.063 * Math.max(0, z);
      const i = 4 * (y * width + x);
      pixels.set([ambient + warm + blue * 0.32, ambient + warm * 0.57 + blue * 0.64, ambient + warm * 0.30 + blue, 1], i);
    }
  }
  const texture = new DataTexture(pixels, width, height, RGBAFormat, FloatType);
  texture.mapping = EquirectangularReflectionMapping;
  texture.needsUpdate = true;
  return texture;
}

function makeFabricTexture(): DataTexture {
  const size = 128;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const weave = Math.cos(x * Math.PI / 4) * Math.cos(y * Math.PI / 4);
      const variation = Math.sin((x - y) * Math.PI / 64) * Math.sin((x + y) * Math.PI / 32);
      const value = Math.round(229 + weave * 11 + variation * 8);
      pixels.set([value, value, value, 255], (y * size + x) * 4);
    }
  }
  const texture = new DataTexture(pixels, size, size, RGBAFormat);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(6, 6);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

const reflection = makeReflectionMap();
const fabric = makeFabricTexture();
const softEdge = makeGlowTexture();

function addContactShadows(root: Scene, seats: readonly Vector3[], tableY: number): void {
  const floorShadows = new Bundle(true);
  for (const pos of seats) {
    floorShadows.add(new PlaneGeometry(1.43, 1.40), "#100c13", tf(pos.x, 0.023, pos.z, -Math.PI / 2), 1, 0.62);
  }
  floorShadows.add(new PlaneGeometry(2.25, 1.90), "#130d14", tf(0, 0.026, 0, -Math.PI / 2), 1, 0.82);
  const topShadows = new Bundle(true);
  for (const [i, pos] of seats.entries()) {
    const radius = i === 0 ? 0.51 : 0.655;
    const yaw = Math.atan2(-pos.x, -pos.z);
    const x = pos.x * radius;
    const z = pos.z * radius;
    topShadows.add(new PlaneGeometry(0.31, 0.25), "#090e0e",
      tf(x + 0.20 * Math.cos(yaw), tableY + 0.007, z - 0.20 * Math.sin(yaw), -Math.PI / 2), 1, 0.63);
    for (const side of [-1, 1]) {
      const tangent = side * 0.24;
      topShadows.add(new PlaneGeometry(0.28, 0.25), "#12180f",
        tf(pos.x * 0.725 + tangent * Math.cos(yaw), tableY + 0.006,
          pos.z * 0.725 - tangent * Math.sin(yaw), -Math.PI / 2), 1, 0.36);
    }
  }
  topShadows.add(new PlaneGeometry(0.84, 0.67), "#12120b", tf(0, tableY + 0.006, 0, -Math.PI / 2), 1, 0.88);
  const material = new MeshBasicMaterial({ vertexColors: true, map: softEdge, transparent: true, depthWrite: false });
  root.add(floorShadows.build(material, "soft-chair-contact"), topShadows.build(material, "soft-table-contact"));
}

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

export function addFinishedRoom(bar: BarScene, seats: readonly Vector3[], tableY: number): void {
  const root = bar.root;
  root.environment = reflection;
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
  const rail = new Mesh(new LatheGeometry([
    new Vector2(1.47, 0.692), new Vector2(1.57, 0.692), new Vector2(1.61, 0.713),
    new Vector2(1.635, 0.747), new Vector2(1.635, 0.772), new Vector2(1.609, 0.791),
    new Vector2(1.54, 0.796), new Vector2(1.485, 0.793), new Vector2(1.46, 0.789),
    new Vector2(1.46, 0.704), new Vector2(1.47, 0.692),
  ], 96), new MeshPhysicalMaterial({ color: "#7b4a2e", map: wood, roughness: 0.62,
    clearcoat: 0.14, clearcoatRoughness: 0.68, envMapIntensity: 0.39, specularIntensity: 0.46,
    emissive: "#6a391d", emissiveIntensity: 0.18 }));
  rail.castShadow = rail.receiveShadow = true;
  const tableTop = new Mesh(new CircleGeometry(1.49, 96), new MeshPhysicalMaterial({
    color: "#183329", roughness: 0.92, sheen: 0.28, sheenColor: new Color("#477269"), sheenRoughness: 0.86,
    map: fabric, bumpMap: fabric, bumpScale: 0.009,
  }));
  tableTop.rotation.x = -Math.PI / 2;
  tableTop.position.y = tableY + 0.004;
  tableTop.receiveShadow = true;
  const rug = new Mesh(new CircleGeometry(2.78, 84), new MeshStandardMaterial({
    color: "#442a2d", map: fabric, roughness: 0.97,
  }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.y = 0.017;
  rug.receiveShadow = true;

  const edging = new Bundle();
  edging.add(new TorusGeometry(1.515, 0.008, 7, 96), "#b99461", tf(0, 0.796, 0, -Math.PI / 2));
  edging.add(new TorusGeometry(1.617, 0.006, 6, 96), "#947149", tf(0, 0.730, 0, -Math.PI / 2));
  const rugTrim = new Bundle();
  for (const r of [2.64, 2.69]) {
    rugTrim.add(new TorusGeometry(r, 0.007, 5, 84), "#735256", tf(0, 0.019, 0, -Math.PI / 2));
  }
  root.add(rail, tableTop, rug,
    edging.build(new MeshStandardMaterial({ vertexColors: true, roughness: 0.43, metalness: 0.52,
      emissive: "#99713c", emissiveIntensity: 0.24 }), "table-brass-inlay"),
    rugTrim.build(new MeshBasicMaterial({ vertexColors: true, side: BackSide }), "rug-embroidered-edge"));
  addContactShadows(root, seats, tableY);
  addWallDetails(root, wood);
}
