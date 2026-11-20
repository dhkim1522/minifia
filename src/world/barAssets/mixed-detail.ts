import { Color, type Group, MathUtils, Vector3 } from "three";
import { bell, eyes, face, markExpressionPart, oval, sculptRoot, stroke, surface, type HeadDensity, type Point } from "./head-sculpt";

const { smoothstep } = MathUtils;

function frontMask(unit: Vector3): number {
  return smoothstep(unit.z, 0.03, 0.72);
}

function tracedMouth(
  head: Group, front: (x: number, y: number) => number, color: string,
  halfWidth: number, middleY: number, lift: number, width: number,
): void {
  const curve: Point[] = [];
  for (let index = -4; index <= 4; index++) {
    const t = index / 4;
    const x = halfWidth * t;
    const y = middleY + lift * t * t;
    curve.push([x, y, front(x, y) + 0.003]);
  }
  markExpressionPart(stroke(head, color, curve, width, 0.30), "mouth", [0, middleY, 0]);
}

export function makePenguinDetail(density: HeadDensity = "close"): Group {
  const head = sculptRoot(density);
  const blue = new Color("#3a435a");
  const crown = new Color("#626f8c");
  const ivory = new Color("#f3eadb");
  const rose = new Color("#dfa99e");
  const front = face(head, [0.492, 0.479, 0.452], (x, y) => {
    const cheek = bell(Math.abs(x) - 0.247, 0.14) * bell(y + 0.127, 0.135);
    const orbit = bell(Math.abs(x) - 0.171, 0.07) * bell(y - 0.036, 0.07);
    return 0.058 * cheek - 0.018 * orbit;
  }, (unit, point, out) => {
    const { x, y } = point;
    const side = Math.abs(x);
    const center = 0.139 + 0.052 * smoothstep(y, -0.17, 0.19);
    const vertical = ((y + 0.06) / 0.292) ** 2;
    const left = smoothstep(((x + center) / 0.244) ** 2 + vertical, 0.60, 1.25);
    const right = smoothstep(((x - center) / 0.244) ** 2 + vertical, 0.60, 1.25);
    const mask = (1 - left * right) * smoothstep(unit.z, 0.18, 0.53);
    const cheek = bell(side - 0.258, 0.071) * bell(y + 0.13, 0.058) * mask;
    out.copy(blue).lerp(crown, 0.40 * smoothstep(unit.y, 0.05, 0.87)).lerp(ivory, mask).lerp(rose, 0.67 * cheek);
  });

  const gold = new Color("#ecac54");
  const ochre = new Color("#ab6539");
  surface(head, (unit, out) => {
    const t = 0.5 + 0.5 * unit.z;
    out.set(unit.x * (0.186 - 0.103 * t), -0.085 + unit.y * (0.073 - 0.018 * t) - 0.030 * t * t, 0.386 + 0.254 * t);
  }, (unit, _point, out) => {
    const lower = 1 - smoothstep(unit.y, -0.64, 0.23);
    const line = 0.25 * bell(unit.y + 0.109, 0.118) * smoothstep(unit.z, -0.22, 0.51);
    out.copy(gold).lerp(ochre, lower * 0.73 + line);
  }, 40, 28, 0.69);
  eyes(head, [0.174, 0.043, front(0.174, 0.043) - 0.002], "#9c948e", 0.078, [0.047, 0.062]);
  return head;
}

export function makeFrogDetail(density: HeadDensity = "close"): Group {
  const head = sculptRoot(density);
  const green = new Color("#aabd53");
  const moss = new Color("#7c943c");
  const throat = new Color("#d6da87");
  const blush = new Color("#cc9770");
  const freckles = new Color("#84964d");
  function crownLift(x: number, unitY: number): number {
    return 0.154 * bell(Math.abs(x) - 0.285, 0.133) * smoothstep(unitY, 0.13, 0.76);
  }
  function shape(x: number, unitY: number, unitZ: number, out: Vector3): void {
    const y = 0.364 * unitY + crownLift(x, unitY);
    const brows = bell(Math.abs(x) - 0.285, 0.128) * bell(y - 0.285, 0.116);
    const cheeks = bell(Math.abs(x) - 0.348, 0.151) * bell(y + 0.11, 0.123);
    const lips = bell(x, 0.41) * bell(y + 0.123, 0.07);
    const z = 0.418 * unitZ + smoothstep(unitZ, 0.04, 0.69) * (0.133 * brows + 0.072 * cheeks + 0.032 * lips);
    out.set(x, y, z);
  }
  const point = new Vector3();
  function front(x: number, y: number): number {
    const belt = Math.sqrt(Math.max(0, 1 - (x / 0.562) ** 2));
    let lo = -belt;
    let hi = belt;
    for (let i = 0; i < 15; i++) {
      const mid = (lo + hi) / 2;
      if (0.364 * mid + crownLift(x, mid) < y) lo = mid;
      else hi = mid;
    }
    const unitY = (lo + hi) / 2;
    shape(x, unitY, Math.sqrt(Math.max(0, belt * belt - unitY * unitY)), point);
    return point.z;
  }
  surface(head, (unit, out) => shape(0.562 * unit.x, unit.y, unit.z, out), (unit, position, out) => {
    const { x, y } = position;
    const side = Math.abs(x);
    const bellyEdge = -0.125 + 0.085 * smoothstep(side, 0.1, 0.52);
    const belly = (1 - smoothstep(y, bellyEdge - 0.066, bellyEdge + 0.046)) * smoothstep(unit.z, -0.38, 0.45);
    const cheek = bell(side - 0.375, 0.079) * bell(y + 0.055, 0.053) * frontMask(unit);
    out.copy(green).lerp(moss, 0.44 * smoothstep(unit.y, 0.53, 1)).lerp(throat, belly).lerp(blush, 0.64 * cheek);
    for (const [dx, dy] of [[0.36, -0.026], [0.398, -0.014], [0.416, -0.045]] as const) {
      out.lerp(freckles, 0.64 * bell(side - dx, 0.012) * bell(y - dy, 0.011) * frontMask(unit));
    }
  }, 64, 44, 0.8);

  eyes(head, [0.273, 0.303, front(0.273, 0.303) - 0.011], "#87994e", 0.055, [0.064, 0.074]);
  tracedMouth(head, front, "#62713c", 0.413, -0.137, 0.078, 0.012);
  return head;
}

export function makeHedgehogDetail(density: HeadDensity = "close"): Group {
  const head = sculptRoot(density);
  const bark = new Color("#765342");
  const tips = new Color("#a37a5c");
  const roots = new Color("#583e34");
  function quillPeaks(unit: Vector3): number {
    const pitch = Math.atan2(unit.y, unit.x);
    const ring = Math.cos(11 * pitch - 4 * unit.z);
    const ridge = ((1 + ring) / 2) ** 3.6;
    return ridge * smoothstep(1 - Math.abs(unit.z), 0.42, 0.95);
  }
  surface(head, (unit, out) => {
    const peak = quillPeaks(unit);
    out.set(unit.x * (0.520 + 0.130 * peak), 0.046 + unit.y * (0.448 + 0.124 * peak),
      -0.124 + 0.366 * unit.z - 0.225 * peak);
  }, (unit, _point, out) => {
    const peak = quillPeaks(unit);
    out.copy(bark).lerp(roots, 0.44 * smoothstep(unit.z, -0.13, 0.60)).lerp(tips, 0.68 * peak);
  }, 96, 40);

  const biscuit = new Color("#e7bb91");
  const chin = new Color("#f0d0a3");
  const blush = new Color("#cc8e7e");
  const front = face(head, [0.486, 0.397, 0.391], (x, y) => {
    const snout = 0.242 * bell(x, 0.192) * bell(y + 0.106, 0.136);
    const cheek = 0.060 * bell(Math.abs(x) - 0.265, 0.133) * bell(y + 0.1, 0.11);
    return snout + cheek;
  }, (unit, p, out) => {
    const side = Math.abs(p.x);
    out.copy(biscuit).lerp(chin, (0.50 + 0.50 * bell(p.x, 0.24)) * (1 - smoothstep(p.y, -0.23, 0.02)) * frontMask(unit));
    out.lerp(blush, 0.56 * bell(side - 0.28, 0.086) * bell(p.y + 0.105, 0.053) * frontMask(unit));
  });
  const lining = new Color("#b98877");
  for (const side of [-1, 1]) {
    surface(head, (unit, out) => {
      const well = smoothstep(unit.z, 0.51, 0.97);
      out.set(side * 0.379 + 0.115 * unit.x + side * 0.026 * unit.y,
        0.212 + 0.128 * unit.y, 0.094 + 0.078 * unit.z - 0.044 * well);
    }, (unit, _point, out) => {
      out.copy(biscuit).lerp(lining, 0.90 * smoothstep(unit.z, 0.56, 0.91));
    }, 28, 20);
  }
  oval(head, "#35292f", [0, -0.089, front(0, -0.089) + 0.006], [0.067, 0.048, 0.043], 0, 0.41);
  eyes(head, [0.181, 0.026, front(0.181, 0.026)], "#9b745b", 0.054, [0.048, 0.063]);
  tracedMouth(head, front, "#8e5d58", 0.105, -0.174, 0.025, 0.009);
  return head;
}

export function makeParrotDetail(density: HeadDensity = "close"): Group {
  const head = sculptRoot(density);
  const cherry = new Color("#cc555b");
  const feathers = new Color("#a43d51");
  const scarlet = new Color("#e08372");
  const ivory = new Color("#f0dcc0");
  const warm = new Color("#d9a48e");
  const front = face(head, [0.473, 0.470, 0.445], (x, y) => {
    const lobe = bell(Math.abs(x) - 0.228, 0.137) * bell(y + 0.086, 0.16);
    const orbit = bell(Math.abs(x) - 0.213, 0.071) * bell(y - 0.035, 0.068);
    return 0.048 * lobe - 0.019 * orbit;
  }, (unit, p, out) => {
    const { x, y } = p;
    const field = ((Math.abs(x) - (0.193 - 0.12 * y)) / 0.170) ** 2 + ((y + 0.032) / 0.221) ** 2;
    const patch = (1 - smoothstep(field, 0.63, 1.18)) * smoothstep(unit.z, 0.16, 0.60);
    out.copy(cherry).lerp(scarlet, 0.35 * smoothstep(unit.y, 0.02, 0.89)).lerp(ivory, patch);
    out.lerp(warm, 0.38 * bell(Math.abs(x) - 0.267, 0.061) * bell(y + 0.132, 0.072) * patch);
  });

  for (const [side, size] of [[-1, 0.95], [1, 0.98], [0, 1.16]] as const) {
    surface(head, (unit, out) => {
      const t = (unit.z + 1) / 2;
      out.set(side * (0.042 + 0.069 * t) + unit.x * (0.119 - 0.058 * t),
        0.328 + 0.218 * size * t + 0.097 * unit.y, 0.031 - size * 0.388 * t);
    }, (unit, _point, out) => {
      out.copy(cherry).lerp(feathers, 0.45 * smoothstep(-unit.z, -0.12, 0.95)).lerp(scarlet, 0.18 * smoothstep(unit.y, 0.07, 0.89));
    }, 30, 21);
  }

  const gold = new Color("#efb255");
  const honey = new Color("#b6773e");
  oval(head, "#b97b4c", [0, -0.173, 0.508], [0.127, 0.071, 0.112], 0, 0.70);
  surface(head, (unit, out) => {
    const t = (1 - unit.y) / 2;
    const pull = 0.174 * Math.sin(Math.PI * t * 0.86) + 0.068 * t;
    const root = 0.172 * bell(t - 0.38, 0.32) * smoothstep(-unit.z, 0.03, 0.79);
    const depth = 0.136 * (1 - 0.69 * t) + root;
    out.set(0.187 * unit.x * (1 - 0.73 * t), 0.122 - 0.403 * t, 0.451 + pull + depth * unit.z);
  }, (unit, _point, out) => {
    out.copy(gold).lerp(honey, 0.50 * smoothstep(-unit.y, -0.18, 1) + 0.30 * smoothstep(-unit.z, -0.47, 0.93));
  }, 48, 36, 0.68);
  eyes(head, [0.217, 0.035, front(0.217, 0.035)], "#ae8c77", 0.101, [0.048, 0.061]);
  return head;
}

export function makeCrocodileDetail(density: HeadDensity = "close"): Group {
  const head = sculptRoot(density);
  const green = new Color("#458b77");
  const deep = new Color("#2c6258");
  const sage = new Color("#82a470");
  const chin = new Color("#cfbc8c");
  const blush = new Color("#bb8b74");
  const nostril = new Color("#244c48");
  const noseY = -0.027;
  const jawAt = (x: number) => -0.192 + 0.060 * (x / 0.388) ** 2;
  const front = face(head, [0.515, 0.416, 0.447], (x, y) => {
    const snout = Math.exp(-((x / 0.367) ** 4) - (((y + 0.078) / 0.209) ** 4));
    const brows = bell(Math.abs(x) - 0.223, 0.145) * bell(y - 0.216, 0.100);
    const cheeks = bell(Math.abs(x) - 0.301, 0.136) * bell(y + 0.018, 0.18);
    const dimple = bell(Math.abs(x) - 0.141, 0.037) * bell(y - noseY, 0.034);
    const slit = bell(y - jawAt(x), 0.019) * bell(x, 0.335);
    return 0.424 * snout + 0.111 * brows + 0.058 * cheeks - 0.050 * dimple - 0.024 * slit;
  }, (unit, p, out) => {
    const { x, y } = p;
    const side = Math.abs(x);
    const light = bell(x, 0.30) * bell(y + 0.035, 0.127) * frontMask(unit);
    const jaw = (1 - smoothstep(y, jawAt(x) - 0.040, jawAt(x) + 0.005)) * smoothstep(unit.z, 0.03, 0.60);
    const dark = bell(side - 0.141, 0.031) * bell(y - noseY, 0.026) * frontMask(unit);
    const cheek = bell(side - 0.337, 0.08) * bell(y + 0.063, 0.061) * frontMask(unit);
    out.copy(green).lerp(deep, 0.35 * smoothstep(unit.y, 0.31, 0.96)).lerp(sage, 0.48 * light);
    out.lerp(chin, jaw).lerp(blush, 0.56 * cheek).lerp(nostril, 0.92 * dark);
  });

  tracedMouth(head, front, "#435b49", 0.386, -0.192, 0.060, 0.010);
  for (const side of [-1, 1]) {
    const x = side * 0.262;
    const y = jawAt(x) - 0.018;
    const z = front(x, y);
    const tooth = new Color("#f1e0bb");
    surface(head, (unit, out) => {
      const t = (unit.y + 1) / 2;
      out.set(x + side * 0.019 * t + unit.x * (0.022 + 0.019 * t), y + 0.062 * unit.y,
        z - 0.013 + 0.018 * (1 - t) + 0.035 * unit.z);
    }, (_unit, _point, out) => { out.copy(tooth); }, 23, 16, 0.69);
  }
  eyes(head, [0.217, 0.209, front(0.217, 0.209)], "#47705b", 0.058, [0.054, 0.062]);
  return head;
}
