// 승인 원화의 얼굴 윤곽을 머리와 몸통 관절에 붙일 수 있는 작은 도형으로 옮긴다.
import { CatmullRomCurve3, ConeGeometry, LatheGeometry, SphereGeometry, TubeGeometry, Vector2, Vector3 } from "three";
import type { BufferGeometry, Mesh, Object3D } from "three";
import { ANIMALS, type AnimalId } from "../../shared/game/animals";
import { FINISH } from "./animalFinish";

type Point = readonly [x: number, y: number, z: number];
type AddPart = (parent: Object3D, geometry: BufferGeometry, color: string, tag?: string) => Mesh;

interface HeadLayout {
  radii: Point;
  eye: Point; // 양쪽 눈은 x만 반대
  mouth: Point;
}

const WHITE = "#f6f0ea";
const CREAM = "#f2dfbc";
const INK = "#252633";
const PINK = "#d98683";
const BODY_COLORS: Readonly<Partial<Record<AnimalId, string>>> = {
  rabbit: WHITE,
  penguin: "#303443",
  hedgehog: "#e4b78f",
  bat: "#6b5a88",
};

export function animalSkin(animal: AnimalId): string {
  return BODY_COLORS[animal] ?? ANIMALS[animal].color;
}

const LAYOUTS: Readonly<Record<AnimalId, HeadLayout>> = {
  rabbit:    { radii: [0.52, 0.465, 0.48], eye: [0.181, 0.019, 0.46], mouth: [0, -0.15, 0.47] },
  elephant:  { radii: [0.52, 0.46, 0.48], eye: [0.205, 0.062, 0.460], mouth: [0, -0.17, 0.45] },
  crocodile: { radii: [0.52, 0.42, 0.47], eye: [0.217, 0.209, 0.482], mouth: [0, -0.22, 0.78] },
  penguin:   { radii: [0.504, 0.475, 0.46], eye: [0.174, 0.043, 0.448], mouth: [0, -0.16, 0.47] },
  fox:       { radii: [0.558, 0.42, 0.454], eye: [0.201, 0.021, 0.464], mouth: [0, -0.157, 0.53] },
  pig:       { radii: [0.53, 0.45, 0.48], eye: [0.221, 0.035, 0.449], mouth: [0, -0.23, 0.41] },
  lion:      { radii: [0.471, 0.418, 0.44], eye: [0.175, 0.034, 0.447], mouth: [0, -0.16, 0.43] },
  ram:       { radii: [0.45, 0.414, 0.45], eye: [0.178, -0.030, 0.449], mouth: [0, -0.19, 0.40] },
  frog:      { radii: [0.579, 0.34, 0.441], eye: [0.286, 0.252, 0.411], mouth: [0, -0.131, 0.448] },
  parrot:    { radii: [0.485, 0.468, 0.45], eye: [0.217, 0.035, 0.444], mouth: [0, -0.17, 0.50] },
  hedgehog:  { radii: [0.502, 0.408, 0.416], eye: [0.192, 0.031, 0.445], mouth: [0, -0.174, 0.49] },
  bat:       { radii: [0.508, 0.423, 0.46], eye: [0.184, 0.029, 0.442], mouth: [0, -0.16, 0.43] },
};

// 귀·뿔·눈 옆에 모자를 얹는 자리. 기울기는 챙의 접촉점을 중심으로 적용한다.
interface HatFit {
  radius: number;
  y: number;
  z: number;
  tilt?: number;
  scale?: Point;
  brim?: number;
}

const HAT_FITS: Readonly<Record<AnimalId, HatFit>> = {
  rabbit:    { radius: 0.268, y: 0.378, z: 0.237, tilt: 0.21, scale: [0.89, 0.77, 0.69], brim: 0.42 },
  elephant:  { radius: 0.38,  y: 0.392, z: 0.01,  scale: [1, 0.88, 0.92], brim: 0.75 },
  crocodile: { radius: 0.34,  y: 0.369, z: -0.11, tilt: -0.26, scale: [0.98, 0.82, 0.94], brim: 0.70 },
  penguin:   { radius: 0.37,  y: 0.421, z: -0.024, scale: [1, 0.83, 0.91], brim: 0.78 },
  fox:       { radius: 0.297, y: 0.349, z: 0.18,  tilt: 0.15, scale: [0.79, 0.77, 0.72], brim: 0.46 },
  pig:       { radius: 0.373, y: 0.394, z: -0.008, scale: [0.99, 0.85, 0.91], brim: 0.72 },
  lion:      { radius: 0.37,  y: 0.467, z: -0.035, tilt: 0.08, scale: [1, 0.85, 0.94], brim: 0.67 },
  ram:       { radius: 0.31,  y: 0.48,  z: 0.042, tilt: 0.06, scale: [0.89, 0.82, 0.96], brim: 0.52 },
  frog:      { radius: 0.34,  y: 0.345, z: -0.17, tilt: -0.36, scale: [1, 0.83, 0.93], brim: 0.61 },
  parrot:    { radius: 0.347, y: 0.398, z: 0.024, scale: [1, 0.82, 0.93], brim: 0.65 },
  hedgehog:  { radius: 0.343, y: 0.440, z: 0.063, tilt: 0.14, scale: [0.91, 0.83, 0.80], brim: 0.51 },
  bat:       { radius: 0.296, y: 0.346, z: 0.057, scale: [0.79, 0.78, 0.89], brim: 0.48 },
};

export function animalHatFit(animal: AnimalId): HatFit {
  return HAT_FITS[animal];
}

function sphere(add: AddPart, parent: Object3D, color: string, center: Point, radii: Point, tilt = 0, tag?: string, divisions = 10): Mesh {
  const mesh = add(parent, new SphereGeometry(1, divisions + 4, divisions), color, tag);
  mesh.position.set(...center);
  mesh.scale.set(...radii);
  mesh.rotation.z = tilt;
  return mesh;
}

function tube(add: AddPart, parent: Object3D, color: string, points: readonly Point[], width: number, taper = 1): void {
  const path = new CatmullRomCurve3(points.map((point) => new Vector3(...point)));
  const segments = 14;
  const sides = 8;
  const geo = new TubeGeometry(path, segments, width, sides, false);
  if (taper !== 1) {
    const positions = geo.getAttribute("position");
    const center = new Vector3();
    const p = new Vector3();
    for (let ring = 0; ring <= segments; ring++) {
      const t = ring / segments;
      path.getPointAt(t, center);
      for (let side = 0; side <= sides; side++) {
        const i = ring * (sides + 1) + side;
        p.fromBufferAttribute(positions, i).sub(center).multiplyScalar(1 + (taper - 1) * t).add(center);
        positions.setXYZ(i, p.x, p.y, p.z);
      }
    }
    geo.computeVertexNormals();
  }
  add(parent, geo, color);
  const end = points[points.length - 1]!;
  const r = width * taper;
  sphere(add, parent, color, end, [r, r, r]);
}

function spike(add: AddPart, parent: Object3D, color: string, start: Point, tip: Point, radius: number, tag?: string): void {
  const base = new Vector3(...start);
  const direction = new Vector3(...tip).sub(base);
  const mesh = add(parent, new ConeGeometry(radius, direction.length(), 9), color, tag);
  mesh.position.copy(base).addScaledVector(direction, 0.5);
  mesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize());
}

function roundQuill(add: AddPart, parent: Object3D, color: string, start: Point, tip: Point, tag?: string): void {
  const from = new Vector3(...start);
  const axis = new Vector3(...tip).sub(from);
  const outline = [[0, 0], [0.91, 0.03], [1, 0.20], [0.70, 0.60], [0.35, 0.88], [0, 1]] as const;
  const quill = add(parent, new LatheGeometry(outline.map(([r, y]) => new Vector2(r, y)), 10), color, tag);
  quill.position.copy(from);
  quill.scale.set(0.163, axis.length(), 0.163);
  quill.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), axis.normalize());
}

function ears(add: AddPart, head: Object3D, color: string, lining: string, x: number, y: number, z: number, radius: Point, tilt: number): void {
  for (const side of [-1, 1]) {
    sphere(add, head, color, [side * x, y, z], radius, -side * tilt);
    sphere(add, head, lining, [side * x, y + 0.005, z + radius[2] * 0.65],
      [radius[0] * 0.70, radius[1] * 0.77, radius[2] * 0.39], -side * tilt);
  }
}

function pointedEars(add: AddPart, head: Object3D, color: string, lining: string, x: number, tipX: number, tipY: number): void {
  const edge = ([width, height]: readonly [number, number]) => new Vector2(width, height);
  const profile = [[0, 0], [0.76, 0.035], [1, 0.18], [0.90, 0.39], [0.67, 0.62], [0.40, 0.82], [0.19, 0.96], [0, 1]] as const;
  function ear(tint: string, from: Point, to: Point, radius: number, depth: number): void {
    const base = new Vector3(...from);
    const direction = new Vector3(...to).sub(base);
    const mesh = add(head, new LatheGeometry(profile.map(edge), 14), tint);
    mesh.position.copy(base);
    mesh.scale.set(radius, direction.length(), depth);
    mesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize());
  }
  for (const side of [-1, 1]) {
    ear(color, [side * x, 0.22, 0], [side * tipX, tipY, -0.04], 0.19, 0.105);
    ear(lining, [side * x, 0.25, 0.077], [side * tipX, tipY - 0.042, 0.012], 0.132, 0.041);
  }
}

function cheeks(add: AddPart, head: Object3D, color: string, x = 0.30, y = -0.10, z = 0.39): void {
  for (const side of [-1, 1]) sphere(add, head, color, [side * x, y, z], [0.071, 0.052, 0.036], side * 0.2);
}

export function animalLayout(animal: AnimalId): HeadLayout {
  return LAYOUTS[animal];
}

export function buildAnimalHead(head: Object3D, animal: AnimalId, add: AddPart): void {
  const color = animalSkin(animal);
  const layout = LAYOUTS[animal];
  const nose = (at: Point, radii: Point = [0.067, 0.044, 0.039], tint = "#604343") => {
    const mesh = sphere(add, head, tint, at, radii);
    mesh.userData.finish = FINISH.smooth;
  };
  const baseColor = animal === "lion" ? "#e3ad5d" : color;
  sphere(add, head, baseColor, [0, 0, 0], layout.radii);

  switch (animal) {
    case "rabbit":
      ears(add, head, WHITE, ANIMALS.rabbit.color, 0.22, 0.625, -0.04, [0.125, 0.335, 0.104], 0.23);
      nose([0, -0.078, 0.485], [0.055, 0.035, 0.042], "#ad767e");
      cheeks(add, head, "#e6a7a3");
      break;
    case "elephant":
      ears(add, head, color, "#839fc2", 0.52, -0.01, -0.08, [0.245, 0.32, 0.158], 0.30);
      tube(add, head, color, [[0, -0.08, 0.44], [0, -0.19, 0.53], [0.025, -0.36, 0.61],
        [0.07, -0.45, 0.69], [0.07, -0.43, 0.72]], 0.134, 0.68);
      for (const side of [-1, 1]) nose([0.07 + 0.035 * side, -0.413, 0.801], [0.021, 0.026, 0.013], "#617da3");
      cheeks(add, head, "#c58f96", 0.33, -0.073, 0.361);
      break;
    case "crocodile":
      for (const side of [-1, 1]) sphere(add, head, color, [0.22 * side, 0.20, 0.25], [0.205, 0.202, 0.26]);
      sphere(add, head, "#d4bc87", [0, -0.195, 0.51], [0.409, 0.126, 0.344]);
      sphere(add, head, color, [0, -0.08, 0.53], [0.408, 0.16, 0.38]);
      for (const side of [-1, 1]) {
        nose([side * 0.15, 0.038, 0.771], [0.047, 0.024, 0.026], "#254b47");
        sphere(add, head, WHITE, [side * 0.26, -0.161, 0.76], [0.035, 0.053, 0.034], side * 0.1);
      }
      cheeks(add, head, PINK, 0.37, -0.035, 0.57);
      break;
    case "penguin":
      for (const side of [-1, 1]) sphere(add, head, "#f2e5d5", [side * 0.15, -0.07, 0.316], [0.242, 0.284, 0.174], side * 0.25);
      sphere(add, head, "#d98b45", [0, -0.093, 0.501], [0.128, 0.083, 0.134]);
      sphere(add, head, "#f2a94b", [0, -0.063, 0.55], [0.105, 0.048, 0.102]);
      cheeks(add, head, "#d69b94", 0.294, -0.144, 0.426);
      break;
    case "fox":
      pointedEars(add, head, "#c18052", "#e8c3a4", 0.32, 0.42, 0.665);
      for (const side of [-1, 1]) {
        sphere(add, head, CREAM, [side * 0.259, -0.138, 0.31], [0.299, 0.141, 0.167], side * -0.22);
        sphere(add, head, CREAM, [side * 0.13, -0.148, 0.394], [0.228, 0.123, 0.125], side * -0.14);
      }
      nose([0, -0.097, 0.529], [0.064, 0.041, 0.032], "#3d3031");
      cheeks(add, head, "#dea084", 0.320, -0.125, 0.452);
      break;
    case "pig":
      ears(add, head, color, "#d48b9b", 0.40, 0.29, -0.012, [0.172, 0.107, 0.14], -0.55);
      sphere(add, head, "#db8799", [0, -0.105, 0.456], [0.216, 0.14, 0.130]);
      for (const side of [-1, 1]) nose([side * 0.079, -0.096, 0.571], [0.040, 0.052, 0.022], "#8f515a");
      cheeks(add, head, "#db8b97", 0.345, -0.121, 0.376);
      break;
    case "lion":
      sphere(add, head, "#a96c3c", [0, 0, -0.167], [0.60, 0.52, 0.36]);
      for (let i = 0; i < 9; i++) {
        const a = 2 * Math.PI * i / 9;
        sphere(add, head, i % 3 === 0 ? "#ba7942" : "#ae6d3a", [0.46 * Math.sin(a), 0.40 * Math.cos(a), -0.115],
          [0.203, 0.218, 0.21], -a, i === 0 ? "highFeather" : undefined, 8);
      }
      ears(add, head, "#e5af61", "#be8350", 0.34, 0.27, 0.175, [0.114, 0.106, 0.089], 0.2);
      for (const side of [-1, 1]) sphere(add, head, "#e9bc77", [side * 0.07, -0.107, 0.406], [0.136, 0.099, 0.061]);
      nose([0, -0.066, 0.47], [0.076, 0.043, 0.034]);
      cheeks(add, head, "#d08b73", 0.27, -0.116, 0.346);
      break;
    case "ram":
      sphere(add, head, WHITE, [0, 0.14, -0.09], [0.479, 0.405, 0.395]);
      for (const [x, y, z, r] of [[-0.23, 0.28, 0.25, 0.18], [0, 0.33, 0.30, 0.16],
        [0.23, 0.28, 0.25, 0.18], [-0.33, 0.10, 0.19, 0.14], [0.33, 0.10, 0.19, 0.14]] as const) {
        sphere(add, head, "#f0e2cf", [x, y, z], [r * 1.1, r, r * 0.85]);
      }
      for (const side of [-1, 1]) {
        tube(add, head, "#76503b", [[side * 0.26, 0.38, -0.075], [side * 0.47, 0.29, -0.04],
          [side * 0.59, 0.075, 0.11], [side * 0.54, -0.11, 0.21], [side * 0.37, -0.115, 0.27],
          [side * 0.39, 0.045, 0.302]], 0.138, 0.72);
      }
      nose([0, -0.109, 0.432], [0.064, 0.037, 0.038], "#b27c69");
      cheeks(add, head, "#de9d87", 0.253, -0.13, 0.354);
      break;
    case "frog":
      sphere(add, head, "#b7cb9e", [0, -0.141, 0.143], [0.493, 0.207, 0.316]);
      for (const side of [-1, 1]) {
        sphere(add, head, color, [side * 0.29, 0.212, 0.19], [0.192, 0.164, 0.187]);
        nose([side * 0.072, -0.010, 0.436], [0.018, 0.012, 0.010], "#477c70");
      }
      cheeks(add, head, "#c0947d", 0.391, -0.074, 0.369);
      break;
    case "parrot":
      for (const side of [-1, 1]) sphere(add, head, "#ecd1b9", [side * 0.19, -0.024, 0.331], [0.205, 0.236, 0.135], side * 0.19);
      for (const [y, z, r] of [[0.385, -0.19, 0.29], [0.463, -0.20, 0.23], [0.515, -0.17, 0.16]] as const) {
        const plume = sphere(add, head, color, [0, y, z], [0.146, 0.104, r], 0, "highFeather");
        plume.rotation.x = -0.50;
      }
      sphere(add, head, "#f1ba5f", [0, -0.063, 0.47], [0.192, 0.199, 0.208]);
      tube(add, head, "#e5a449", [[0, -0.06, 0.56], [0, -0.13, 0.644], [0, -0.25, 0.608]], 0.116, 0.42);
      sphere(add, head, "#b97d45", [0, -0.186, 0.493], [0.096, 0.064, 0.11]);
      cheeks(add, head, "#d7947f", 0.302, -0.11, 0.419);
      break;
    case "hedgehog":
      sphere(add, head, "#8a6047", [0, 0.024, -0.159], [0.551, 0.436, 0.352]);
      for (let i = 0; i < 10; i++) {
        const a = (2 * Math.PI * i) / 10;
        const y = 0.541 * Math.cos(a) - (i === 0 ? 0.030 : 0);
        roundQuill(add, head, i % 2 ? "#8a6047" : "#a57759", [0.426 * Math.sin(a), 0.33 * Math.cos(a), -0.18],
          [0.612 * Math.sin(a), y, -0.32], i === 0 ? "highFeather" : undefined);
      }
      ears(add, head, color, "#bc8c77", 0.37, 0.199, 0.102, [0.106, 0.114, 0.084], 0.18);
      sphere(add, head, "#e9bf98", [0, -0.108, 0.361], [0.196, 0.144, 0.164]);
      nose([0, -0.09, 0.526], [0.061, 0.044, 0.036], "#423336");
      cheeks(add, head, "#d39581", 0.299, -0.122, 0.341);
      break;
    case "bat":
      pointedEars(add, head, "#62558d", "#a27cb2", 0.40, 0.61, 0.54);
      sphere(add, head, "#9876ab", [0, -0.080, 0.444], [0.107, 0.073, 0.056]);
      for (const side of [-1, 1]) {
        nose([side * 0.035, -0.076, 0.495], [0.016, 0.026, 0.014], "#503952");
        spike(add, head, WHITE, [side * 0.113, -0.132, 0.429], [side * 0.092, -0.198, 0.433], 0.026);
      }
      cheeks(add, head, "#b96f8c", 0.30, -0.113, 0.381);
      break;
  }
}

export function buildAnimalBody(body: Object3D, animal: AnimalId, add: AddPart): void {
  const color = animalSkin(animal);
  switch (animal) {
    case "rabbit":
      sphere(add, body, color, [0, 0.48, -0.372], [0.107, 0.105, 0.09]);
      break;
    case "crocodile":
      tube(add, body, color, [[0, 0.46, -0.26], [0.10, 0.32, -0.47], [0.26, 0.27, -0.61], [0.37, 0.31, -0.69]], 0.149, 0.28);
      break;
    case "fox": {
      const tail = sphere(add, body, color, [0.25, 0.45, -0.37], [0.16, 0.17, 0.41], 0.36);
      tail.rotation.y = -0.63;
      const tip = sphere(add, body, WHITE, [0.44, 0.51, -0.60], [0.136, 0.138, 0.185], 0.36);
      tip.rotation.y = -0.63;
      break;
    }
    case "lion":
      tube(add, body, color, [[0, 0.49, -0.31], [0.11, 0.36, -0.51], [0.29, 0.44, -0.60], [0.35, 0.62, -0.58]], 0.058, 0.68);
      sphere(add, body, "#9f6036", [0.358, 0.66, -0.59], [0.071, 0.108, 0.062], -0.36);
      break;
    case "bat":
      for (const side of [-1, 1]) {
        sphere(add, body, "#615089", [side * 0.34, 0.71, -0.175], [0.147, 0.28, 0.091], side * 0.51);
        sphere(add, body, "#786295", [side * 0.32, 0.70, -0.104], [0.091, 0.20, 0.043], side * 0.53);
      }
      break;
  }
}
