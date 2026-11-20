import {
  BackSide, CircleGeometry, Color, DataTexture, EquirectangularReflectionMapping, FloatType,
  LatheGeometry, LinearFilter, LinearMipmapLinearFilter, Mesh, MeshBasicMaterial,
  MeshPhysicalMaterial, MeshStandardMaterial, PlaneGeometry, RepeatWrapping, RGBAFormat,
  TorusGeometry, Vector2,
} from "three";
import type { Object3D, Texture, Vector3 } from "three";
import { Bundle, tf, makeGlowTexture } from "../maps/bar";

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

export const tableReflection = makeReflectionMap();
const fabric = makeFabricTexture();
export const softEdge = makeGlowTexture();

function addContactShadows(root: Object3D, seats: readonly Vector3[], tableY: number): void {
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

export function addFinishedTable(root: Object3D, seats: readonly Vector3[], tableY: number, wood: Texture | null): void {
  const rail = new Mesh(new LatheGeometry([
    new Vector2(1.47, 0.692), new Vector2(1.57, 0.692), new Vector2(1.61, 0.713),
    new Vector2(1.635, 0.747), new Vector2(1.635, 0.772), new Vector2(1.609, 0.791),
    new Vector2(1.54, 0.796), new Vector2(1.485, 0.793), new Vector2(1.46, 0.789),
    new Vector2(1.46, 0.704), new Vector2(1.47, 0.692),
  ], 96), new MeshPhysicalMaterial({ color: "#7b4a2e", map: wood, roughness: 0.62,
    clearcoat: 0.14, clearcoatRoughness: 0.68, envMapIntensity: 0.39, specularIntensity: 0.46,
    emissive: "#6a391d", emissiveIntensity: 0.18 }));
  rail.castShadow = rail.receiveShadow = true;
  rail.userData.tableBlocker = true;
  const tableTop = new Mesh(new CircleGeometry(1.49, 96), new MeshPhysicalMaterial({
    color: "#183329", roughness: 0.92, sheen: 0.28, sheenColor: new Color("#477269"), sheenRoughness: 0.86,
    map: fabric, bumpMap: fabric, bumpScale: 0.009,
  }));
  tableTop.rotation.x = -Math.PI / 2;
  tableTop.position.y = tableY + 0.004;
  tableTop.receiveShadow = true;
  tableTop.userData.tableBlocker = true;
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
}
