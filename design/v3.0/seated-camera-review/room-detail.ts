import {
  AdditiveBlending, DataTexture, LatheGeometry, LinearFilter, LinearMipmapLinearFilter, MathUtils,
  Mesh, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, PlaneGeometry, RGBAFormat,
  SRGBColorSpace, Vector2,
} from "three";
import type { Matrix4, Scene, Texture } from "three";
import { BAR_COUNTER, BAR_ROOM_HALF } from "../../../shared/game/map";
import { Bundle, makeGlowTexture, tf, under } from "../../../src/world/maps/bar";

const northWall = -BAR_ROOM_HALF;
const windowX = 0.42;
const windowY = 1.96;
const glassZ = northWall + 0.231;

/** 밤하늘과 원거리 창 한두 점만 그려 창살과 상대의 눈이 먼저 읽히게 한다. */
function makeNightView(): DataTexture {
  const width = 256;
  const height = 192;
  const pixels = new Uint8Array(width * height * 4);
  const skyline = [
    [0, 17, 11], [16, 34, 14], [39, 48, 27], [48, 63, 36], [63, 74, 29],
    [78, 101, 13], [106, 136, 23], [138, 156, 18], [160, 188, 33], [173, 180, 40],
    [190, 214, 15], [218, 230, 24], [231, 249, 19], [249, 256, 12],
  ] as const;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const horizon = Math.exp(-(((y - 38) / 83) ** 2));
      const moonHalo = Math.exp(-(((x - 184) / 84) ** 2 + ((y - 135) / 70) ** 2));
      const reflection = Math.exp(-(((x + y * 0.43 - 145) / 24) ** 2));
      const textureGrain = ((x * 123 + y * 341 + x * y * 17) % 29) / 29;
      let r = 26 + 19 * horizon + 12 * moonHalo + 3 * reflection + textureGrain;
      let g = 39 + 23 * horizon + 15 * moonHalo + 5 * reflection + textureGrain;
      let b = 71 + 32 * horizon + 23 * moonHalo + 7 * reflection + textureGrain;
      const farRoof = 10 + 5 * Math.sin(x / 15) + 2 * Math.sin(x / 5);
      if (y < farRoof + 23) {
        r *= 0.66;
        g *= 0.71;
        b *= 0.78;
      }
      for (const [left, right, roof] of skyline) {
        if (x < left || x >= right || y >= roof + 7) continue;
        [r, g, b] = [22 + textureGrain, 31 + textureGrain, 51 + textureGrain];
        const windowColumn = Math.floor((x - left) / 6);
        const windowRow = Math.floor(y / 8);
        if (x % 6 >= 3 && y % 8 >= 4 && y % 8 < 7 && (left + windowRow * 5 + windowColumn * 17) % 7 === 0) {
          [r, g, b] = [94, 78, 65];
        }
      }
      pixels.set([r, g, b, 255], (y * width + x) * 4);
    }
  }
  const map = new DataTexture(pixels, width, height, RGBAFormat);
  map.colorSpace = SRGBColorSpace;
  map.magFilter = LinearFilter;
  map.minFilter = LinearMipmapLinearFilter;
  map.generateMipmaps = true;
  map.needsUpdate = true;
  return map;
}

const nightView = makeNightView();
const cabinetGlow = makeGlowTexture();

function surround(
  bundle: Bundle, frame: Matrix4, w: number, h: number, border: number, depth: number, color: string,
): void {
  for (const side of [-1, 1]) {
    bundle.box(border, h, depth, color, under(frame, tf(side * (w - border) / 2, 0, 0)));
    bundle.box(w - border * 2, border, depth, color, under(frame, tf(0, side * (h - border) / 2, 0)));
  }
}

function addWindow(root: Scene, joinery: Bundle, casing: Bundle, metal: Bundle): void {
  const art = new Mesh(new PlaneGeometry(1.60, 1.30), new MeshBasicMaterial({
    map: nightView, toneMapped: false,
  }));
  art.name = "seated-window-after-dark";
  art.position.set(windowX, windowY, glassZ);
  root.add(art);

  // 원래 창 전면을 덮는 케이싱과 서로 다른 깊이의 창틀, 창턱.
  surround(casing, tf(windowX, windowY, northWall + 0.225), 1.91, 1.56, 0.157, 0.19, "#3a3c50");
  surround(joinery, tf(windowX, windowY, glassZ + 0.064), 1.75, 1.45, 0.082, 0.12, "#444150");
  surround(casing, tf(windowX, windowY, glassZ + 0.11), 1.62, 1.33, 0.043, 0.058, "#4d5365");
  surround(metal, tf(windowX, windowY, glassZ + 0.148), 1.77, 1.47, 0.011, 0.008, "#7b6b57");
  for (const x of [windowX - 0.34, windowX + 0.34]) {
    casing.box(0.042, 1.30, 0.066, "#353b51", tf(x, windowY, glassZ + 0.034));
    casing.box(0.009, 1.27, 0.012, "#596071", tf(x - 0.009, windowY, glassZ + 0.072));
  }
  casing.box(1.61, 0.040, 0.051, "#363d53", tf(windowX, windowY - 0.26, glassZ + 0.030));
  joinery.box(1.89, 0.055, 0.33, "#454252", tf(windowX, windowY - 0.723, glassZ + 0.052));
  casing.box(1.81, 0.021, 0.025, "#666073", tf(windowX, windowY - 0.710, glassZ + 0.220));
  metal.box(0.072, 0.024, 0.031, "#ac8457", tf(windowX, windowY - 0.28, glassZ + 0.069));
  metal.box(0.12, 0.009, 0.028, "#bd9d70", tf(windowX + 0.021, windowY - 0.281, glassZ + 0.090));
}

const profiles = {
  carafe: [[0, 0], [0.83, 0], [1, 0.05], [1, 0.43], [0.76, 0.58], [0.33, 0.7], [0.3, 0.91], [0.42, 0.94], [0.42, 1], [0, 1]],
  round: [[0, 0], [0.79, 0], [0.96, 0.08], [1, 0.28], [0.94, 0.54], [0.73, 0.67], [0.42, 0.77], [0.39, 1], [0, 1]],
  tall: [[0, 0], [0.91, 0], [1, 0.05], [0.98, 0.63], [0.82, 0.74], [0.48, 0.82], [0.4, 1], [0, 1]],
} as const;

const bottleGroups = [
  [
    [-0.68, 0.28, 0.089, "#754f38", "round"], [-0.42, 0.37, 0.078, "#505844", "tall"],
    [0.24, 0.32, 0.104, "#835737", "carafe"], [0.56, 0.235, 0.077, "#586575", "round"],
  ], [
    [-0.55, 0.26, 0.119, "#785249", "carafe"], [0.13, 0.36, 0.071, "#676d51", "tall"],
    [0.36, 0.30, 0.082, "#79684c", "tall"], [0.62, 0.255, 0.076, "#4b6168", "round"],
  ], [
    [-0.66, 0.26, 0.067, "#57695f", "tall"], [-0.46, 0.31, 0.085, "#775244", "round"],
    [0.38, 0.275, 0.095, "#816047", "carafe"], [0.64, 0.22, 0.064, "#59646a", "round"],
  ],
] as const;

type Bottle = readonly [x: number, height: number, radius: number, color: string, profile: keyof typeof profiles];

function addBottle(
  glass: Bundle, metal: Bundle, casing: Bundle, light: Bundle, frame: Matrix4, bottle: Bottle,
  base: number, depth: number, alternateLabel: boolean,
): void {
  const [x, height, radius, color, profile] = bottle;
  const neck = profiles[profile].map(([r, y]) => new Vector2(r * radius, y * height));
  glass.add(new LatheGeometry(neck, 16), color, under(frame, tf(x, base, depth)));
  metal.cyl(radius * 0.40, radius * 0.42, 0.019, 10, "#967361", under(frame, tf(x, base + height, depth)));
  if (profile === "round") return;
  const label = alternateLabel ? "#a58d6f" : "#9c8066";
  casing.box(radius * 0.92, height * 0.25, 0.003, label,
    under(frame, tf(x, base + height * 0.35, depth + radius * 0.935)));
  light.box(radius * 0.45, 0.004, 0.003, "#baa181",
    under(frame, tf(x, base + height * 0.39, depth + radius * 0.967)));
}

function addCabinet(joinery: Bundle, casing: Bundle, metal: Bundle, glass: Bundle, light: Bundle): void {
  const x = 2.66;
  const z = northWall + 0.25;
  const frame = tf(x, 0, z);
  joinery.box(2.33, 1.65, 0.14, "#483025", tf(x, 1.80, z - 0.075));
  casing.box(2.02, 1.51, 0.02, "#302728", tf(x, 1.80, z + 0.005));
  for (const side of [-1, 1]) {
    joinery.box(0.138, 1.65, 0.34, "#5e3a2c", tf(x + side * 1.09, 1.80, z + 0.137));
    joinery.box(0.075, 1.57, 0.041, "#815443", tf(x + side * 1.09, 1.80, z + 0.314));
    metal.box(0.012, 1.48, 0.012, "#a17c54", tf(x + side * 1.059, 1.80, z + 0.342));
  }
  for (const [y, w, depth] of [[2.63, 2.35, 0.35], [2.685, 2.23, 0.28], [2.735, 2.08, 0.22]] as const) {
    joinery.box(w, 0.05, depth, "#5a3a2e", tf(x, y, z + 0.135));
  }
  metal.box(2.22, 0.014, 0.013, "#a5825e", tf(x, 2.628, z + 0.315));

  for (let row = 0; row < bottleGroups.length; row++) {
    const shelfY = 1.05 + row * 0.515;
    joinery.box(2.08, 0.072, 0.37, "#624232", tf(x, shelfY, z + 0.149));
    metal.box(2.035, 0.012, 0.014, "#9b7451", tf(x, shelfY + 0.012, z + 0.338));
    light.box(1.86, 0.010, 0.013, "#ba8a57", tf(x, shelfY + 0.40, z + 0.285));
    for (const [i, bottle] of bottleGroups[row]!.entries()) {
      addBottle(glass, metal, casing, light, frame, bottle, shelfY + 0.038, 0.170 + (i % 2) * 0.065, i % 2 === 1);
    }
  }
}

function addSideCabinet(joinery: Bundle, casing: Bundle, metal: Bundle, glass: Bundle, light: Bundle): void {
  // 오른쪽 벽에 남아 있던 정렬된 병 모형을 덮고 어두운 그릇장 안으로 물린다.
  const frame = tf(4.37, 0, BAR_COUNTER.z, 0, -Math.PI / 2);
  casing.box(2.21, 1.26, 0.084, "#362b37", under(frame, tf(0, 1.73, 0)));
  surround(joinery, under(frame, tf(0, 1.73, 0.15)), 2.24, 1.26, 0.095, 0.25, "#563b34");
  surround(metal, under(frame, tf(0, 1.73, 0.279)), 2.14, 1.16, 0.010, 0.007, "#936d4f");
  for (const [row, y] of [1.23, 1.74].entries()) {
    joinery.box(2.08, 0.045, 0.25, "#55382e", under(frame, tf(0, y, 0.145)));
    metal.box(2.05, 0.010, 0.009, "#876247", under(frame, tf(0, y, 0.275)));
    for (const [i, bottle] of bottleGroups[row + 1]!.entries()) {
      addBottle(glass, metal, casing, light, frame, bottle, y + 0.024, 0.129 + (i % 2) * 0.038, i % 2 === 1);
    }
  }
}

function addWallPanels(joinery: Bundle, casing: Bundle, metal: Bundle): void {
  for (const side of [-1, 1]) {
    const wall = tf(side * 4.585, 0, 0, 0, -side * Math.PI / 2);
    for (const [i, across] of [-3.38, -1.13, 1.13, 3.38].entries()) {
      const panel = under(wall, tf(across, 1.90, 0.045));
      casing.box(2.20, 1.96, 0.042, i % 2 ? "#303247" : "#35354b", panel);
      surround(casing, under(panel, tf(0, 0, 0.022)), 2.08, 1.83, 0.050, 0.031, "#3d3b51");
      surround(casing, under(panel, tf(0, 0, 0.047)), 1.94, 1.69, 0.018, 0.015, "#484255");
      const low = under(wall, tf(across, 0.43, 0.095));
      joinery.box(2.12, 0.71, 0.058, "#533729", low);
      surround(joinery, under(low, tf(0, 0, 0.03)), 1.93, 0.55, 0.039, 0.023, "#654839");
    }
    casing.box(9.08, 0.078, 0.099, "#3d3b4f", under(wall, tf(0, 2.97, 0.074)));
    metal.box(9.06, 0.014, 0.016, "#867057", under(wall, tf(0, 2.938, 0.137)));
    joinery.box(9.12, 0.071, 0.108, "#664334", under(wall, tf(0, 0.846, 0.092)));
    metal.box(9.10, 0.009, 0.013, "#88634b", under(wall, tf(0, 0.835, 0.153)));
  }
  for (const [x, w] of [[-2.20, 4.56], [3.89, 0.82]] as const) {
    joinery.box(w, 0.70, 0.064, "#513427", tf(x, 0.455, northWall + 0.18));
    surround(joinery, tf(x, 0.455, northWall + 0.22), w - 0.12, 0.49, 0.04, 0.03, "#634536");
  }
}

export function addRoomDetail(root: Scene, wood: Texture | null): void {
  const joinery = new Bundle();
  const casing = new Bundle();
  const metal = new Bundle();
  const glass = new Bundle();
  const light = new Bundle();
  addWindow(root, joinery, casing, metal);
  addCabinet(joinery, casing, metal, glass, light);
  addSideCabinet(joinery, casing, metal, glass, light);
  addWallPanels(joinery, casing, metal);

  const oak = joinery.build(new MeshPhysicalMaterial({
    vertexColors: true, map: wood, roughness: 0.66, clearcoat: 0.15, clearcoatRoughness: 0.68,
    emissive: "#6d4331", emissiveIntensity: 0.19,
  }), "seated-deco-walnut");
  oak.receiveShadow = true;
  root.add(
    oak,
    casing.build(new MeshStandardMaterial({
      vertexColors: true, roughness: 0.88, emissive: "#332f43", emissiveIntensity: 0.27,
    }), "seated-deco-plaster"),
    metal.build(new MeshStandardMaterial({
      vertexColors: true, metalness: 0.46, roughness: 0.46, emissive: "#71533d", emissiveIntensity: 0.14,
    }), "seated-deco-aged-brass"),
    glass.build(new MeshPhysicalMaterial({
      vertexColors: true, roughness: 0.32, clearcoat: 0.48, emissive: "#775039", emissiveIntensity: 0.21,
    }), "seated-cabinet-glass"),
    light.build(new MeshBasicMaterial({ vertexColors: true }), "seated-cabinet-inset-light"),
  );

  const bounce = new Bundle(true);
  for (let row = 0; row < bottleGroups.length; row++) {
    const y = 1.33 + row * 0.514;
    bounce.add(new PlaneGeometry(1.87, 0.49), "#ad7046", tf(2.66, y, northWall + 0.268), 1,
      MathUtils.lerp(0.36, 0.23, row / (bottleGroups.length - 1)));
  }
  root.add(bounce.build(new MeshBasicMaterial({
    vertexColors: true, map: cabinetGlow, transparent: true, depthWrite: false, blending: AdditiveBlending,
  }), "seated-cabinet-baked-bounce"));
}
