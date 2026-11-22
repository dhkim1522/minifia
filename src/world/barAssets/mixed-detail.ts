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
  const crown = new Color("#637287");
  const ivory = new Color("#f3eadb");
  const rose = new Color("#dfa99e");
  const front = face(head, [0.504, 0.475, 0.452], (x, y) => {
    const cheek = bell(Math.abs(x) - 0.242, 0.175) * bell(y + 0.126, 0.150);
    const orbit = bell(Math.abs(x) - 0.173, 0.08) * bell(y - 0.04, 0.077);
    return 0.066 * cheek - 0.013 * orbit;
  }, (unit, point, out) => {
    const { x, y } = point;
    const side = Math.abs(x);
    const center = 0.139 + 0.052 * smoothstep(y, -0.17, 0.19);
    const vertical = ((y + 0.06) / 0.292) ** 2;
    const left = smoothstep(((x + center) / 0.244) ** 2 + vertical, 0.60, 1.25);
    const right = smoothstep(((x - center) / 0.244) ** 2 + vertical, 0.60, 1.25);
    const mask = (1 - left * right) * smoothstep(unit.z, 0.18, 0.53);
    const cheek = bell(side - 0.258, 0.071) * bell(y + 0.13, 0.058) * mask;
    out.copy(blue).lerp(crown, 0.38 * smoothstep(unit.y, 0.05, 0.87)).lerp(ivory, mask).lerp(rose, 0.52 * cheek);
  });

  const gold = new Color("#e7ab64");
  const ochre = new Color("#bc8150");
  surface(head, (unit, out) => {
    const t = 0.5 + 0.5 * unit.z;
    out.set(unit.x * (0.183 - 0.098 * t), -0.085 + unit.y * (0.071 - 0.014 * t) - 0.026 * t * t, 0.378 + 0.235 * t);
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
  const green = new Color("#5d9e85");
  const moss = new Color("#438571");
  const throat = new Color("#b7cb9e");
  const blush = new Color("#c0947d");
  const nostril = new Color("#477c70");
  const width = 0.579;
  const height = 0.340;
  function crownLift(x: number, unitY: number): number {
    return 0.112 * bell(Math.abs(x) - 0.295, 0.141) * smoothstep(unitY, 0.14, 0.80);
  }
  function shape(x: number, unitY: number, unitZ: number, out: Vector3): void {
    const y = height * unitY + crownLift(x, unitY);
    const brows = bell(Math.abs(x) - 0.295, 0.14) * bell(y - 0.249, 0.128);
    const cheeks = bell(Math.abs(x) - 0.322, 0.186) * bell(y + 0.103, 0.151);
    const lips = bell(x, 0.44) * bell(y + 0.118, 0.088);
    const z = 0.428 * unitZ + smoothstep(unitZ, 0.04, 0.69) * (0.095 * brows + 0.099 * cheeks + 0.027 * lips);
    out.set(x, y, z);
  }
  const point = new Vector3();
  function front(x: number, y: number): number {
    const belt = Math.sqrt(Math.max(0, 1 - (x / width) ** 2));
    let lo = -belt;
    let hi = belt;
    for (let i = 0; i < 15; i++) {
      const mid = (lo + hi) / 2;
      if (height * mid + crownLift(x, mid) < y) lo = mid;
      else hi = mid;
    }
    const unitY = (lo + hi) / 2;
    shape(x, unitY, Math.sqrt(Math.max(0, belt * belt - unitY * unitY)), point);
    return point.z;
  }
  surface(head, (unit, out) => shape(width * unit.x, unit.y, unit.z, out), (unit, position, out) => {
    const { x, y } = position;
    const side = Math.abs(x);
    const bellyEdge = -0.157 + 0.052 * smoothstep(side, 0.1, 0.53);
    const belly = (1 - smoothstep(y, bellyEdge - 0.082, bellyEdge + 0.069)) * smoothstep(unit.z, -0.38, 0.45);
    const cheek = bell(side - 0.387, 0.099) * bell(y + 0.07, 0.065) * frontMask(unit);
    const nose = bell(side - 0.074, 0.021) * bell(y + 0.012, 0.019) * frontMask(unit);
    out.copy(green).lerp(moss, 0.34 * smoothstep(unit.y, 0.46, 1)).lerp(throat, belly)
      .lerp(blush, 0.52 * cheek).lerp(nostril, 0.76 * nose);
  }, 64, 44, 0.8);

  eyes(head, [0.286, 0.252, front(0.286, 0.252) + 0.003], "#5c9580", 0.034, [0.054, 0.061]);
  tracedMouth(head, front, "#406f61", 0.369, -0.131, 0.036, 0.010);
  return head;
}

export function makeHedgehogDetail(density: HeadDensity = "close"): Group {
  const head = sculptRoot(density);
  const bark = new Color("#8a6047");
  const tips = new Color("#b08868");
  const roots = new Color("#674631");
  function quillPeaks(unit: Vector3): number {
    const pitch = Math.atan2(unit.y, unit.x);
    const ring = Math.cos(11 * pitch - 4 * unit.z);
    const ridge = ((1 + ring) / 2) ** 2.38;
    return ridge * smoothstep(1 - Math.abs(unit.z), 0.42, 0.95);
  }
  surface(head, (unit, out) => {
    const peak = quillPeaks(unit);
    const crown = smoothstep(unit.y, 0.67, 0.94) * (1 - smoothstep(unit.z, 0.19, 0.54));
    out.set(unit.x * (0.533 + 0.102 * peak), 0.046 + unit.y * (0.445 + 0.099 * peak) - 0.044 * crown,
      -0.124 + 0.366 * unit.z - 0.179 * peak);
  }, (unit, _point, out) => {
    const peak = quillPeaks(unit);
    out.copy(bark).lerp(roots, 0.40 * smoothstep(unit.z, -0.13, 0.60)).lerp(tips, 0.58 * peak);
  }, 96, 40);

  const biscuit = new Color("#e4b78f");
  const chin = new Color("#f2cfab");
  const blush = new Color("#cf9581");
  const front = face(head, [0.502, 0.408, 0.402], (x, y) => {
    const snout = 0.155 * bell(x, 0.239) * bell(y + 0.103, 0.146);
    const cheek = 0.086 * bell(Math.abs(x) - 0.264, 0.180) * bell(y + 0.123, 0.143);
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
      out.set(side * 0.370 + 0.107 * unit.x + side * 0.025 * unit.y,
        0.199 + 0.117 * unit.y, 0.102 + 0.080 * unit.z - 0.034 * well);
    }, (unit, _point, out) => {
      out.copy(biscuit).lerp(lining, 0.90 * smoothstep(unit.z, 0.56, 0.91));
    }, 28, 20);
  }
  oval(head, "#423336", [0, -0.091, front(0, -0.091) + 0.004], [0.061, 0.044, 0.036], 0, 0.45);
  eyes(head, [0.192, 0.031, front(0.192, 0.031)], "#c19173", 0.043, [0.049, 0.060]);
  tracedMouth(head, front, "#926d62", 0.098, -0.174, 0.019, 0.008);
  return head;
}

export function makeParrotDetail(density: HeadDensity = "close"): Group {
  const head = sculptRoot(density);
  const cherry = new Color("#c95d60");
  const feathers = new Color("#a34b57");
  const scarlet = new Color("#df8875");
  const ivory = new Color("#f0dcc0");
  const warm = new Color("#d9a48e");
  const front = face(head, [0.485, 0.468, 0.448], (x, y) => {
    const lobe = bell(Math.abs(x) - 0.235, 0.154) * bell(y + 0.096, 0.168);
    const orbit = bell(Math.abs(x) - 0.213, 0.077) * bell(y - 0.035, 0.073);
    return 0.059 * lobe - 0.013 * orbit;
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
        0.317 + 0.216 * size * t + 0.097 * unit.y, 0.024 - size * 0.375 * t);
    }, (unit, _point, out) => {
      out.copy(cherry).lerp(feathers, 0.45 * smoothstep(-unit.z, -0.12, 0.95)).lerp(scarlet, 0.18 * smoothstep(unit.y, 0.07, 0.89));
    }, 30, 21);
  }

  const gold = new Color("#efb255");
  const honey = new Color("#b6773e");
  oval(head, "#c39063", [0, -0.174, 0.484], [0.128, 0.068, 0.106], 0, 0.74);
  surface(head, (unit, out) => {
    const t = (1 - unit.y) / 2;
    const pull = 0.155 * Math.sin(Math.PI * t * 0.86) + 0.062 * t;
    const root = 0.172 * bell(t - 0.38, 0.32) * smoothstep(-unit.z, 0.03, 0.79);
    const depth = 0.136 * (1 - 0.69 * t) + root;
    out.set(0.187 * unit.x * (1 - 0.69 * t), 0.122 - 0.39 * t, 0.437 + pull + depth * unit.z);
  }, (unit, _point, out) => {
    out.copy(gold).lerp(honey, 0.50 * smoothstep(-unit.y, -0.18, 1) + 0.30 * smoothstep(-unit.z, -0.47, 0.93));
  }, 48, 36, 0.68);
  eyes(head, [0.217, 0.035, front(0.217, 0.035)], "#ae8c77", 0.101, [0.048, 0.061]);
  return head;
}

export function makeCrocodileDetail(density: HeadDensity = "close"): Group {
  const head = sculptRoot(density);
  const green = new Color("#518e7d");
  const deep = new Color("#376a5f");
  const sage = new Color("#8ba879");
  const chin = new Color("#cfbc8c");
  const blush = new Color("#bb8b74");
  const nostril = new Color("#244c48");
  const noseY = -0.027;
  const jawAt = (x: number) => -0.192 + 0.060 * (x / 0.388) ** 2;
  const front = face(head, [0.522, 0.419, 0.448], (x, y) => {
    const snout = Math.exp(-((x / 0.373) ** 4) - (((y + 0.082) / 0.211) ** 4));
    const brows = bell(Math.abs(x) - 0.223, 0.154) * bell(y - 0.216, 0.109);
    const cheeks = bell(Math.abs(x) - 0.301, 0.153) * bell(y + 0.028, 0.181);
    const dimple = bell(Math.abs(x) - 0.141, 0.037) * bell(y - noseY, 0.034);
    const slit = bell(y - jawAt(x), 0.019) * bell(x, 0.335);
    return 0.394 * snout + 0.092 * brows + 0.071 * cheeks - 0.043 * dimple - 0.018 * slit;
  }, (unit, p, out) => {
    const { x, y } = p;
    const side = Math.abs(x);
    const light = bell(x, 0.30) * bell(y + 0.035, 0.127) * frontMask(unit);
    const jaw = (1 - smoothstep(y, jawAt(x) - 0.048, jawAt(x) + 0.016)) * smoothstep(unit.z, 0.03, 0.60);
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
