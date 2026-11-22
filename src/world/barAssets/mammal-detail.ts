import {
  CatmullRomCurve3, Color, Float32BufferAttribute, Group, MathUtils, Mesh,
  MeshStandardMaterial, TubeGeometry, Vector3,
} from "three";
import { bell, eyes, face, markExpressionPart, oval, sculptRoot, sculptSegments, stroke, surface, type HeadDensity, type Point } from "./head-sculpt";

type Front = (x: number, y: number) => number;
type Pair = readonly [number, number];
const sides = [-1, 1] as const;
const white = new Color("#f6eee7");
const lavender = new Color("#bdacd8");
const ink = "#382538";
const ramp = MathUtils.smoothstep;

function place(front: Front, x: number, y: number, lift = 0): Point {
  return [x, y, front(x, y) + lift];
}

function line(head: Group, front: Front, points: readonly Pair[], tint: string, width = 0.008): Mesh {
  return stroke(head, tint, points.map(([x, y]) => place(front, x, y, width * 0.38)), width, 0.25);
}

function smallSmile(head: Group, front: Front, center: number, tint: string): void {
  const lips = markExpressionPart(new Group(), "mouth", [0, center, 0]);
  head.add(lips);
  for (const side of sides) {
    line(lips, front, [[0, center], [side * 0.045, center - 0.023],
      [side * 0.084, center - 0.021], [side * 0.113, center + 0.007]], tint);
  }
}

interface EarProfile {
  root: Point;
  tip: Point;
  width: Pair;
  depth: Pair;
  inner: Color;
  tint: Color;
  recess: number;
  bend?: number;
}

/** Rim and recessed lining share the ear surface, including the base buried in the head. */
function ears(head: Group, spec: EarProfile): void {
  const { root, tip, width, depth, inner, tint, recess, bend = 0 } = spec;
  for (const side of sides) {
    const dx = side * (tip[0] - root[0]);
    const dy = tip[1] - root[1];
    const length = Math.hypot(dx, dy);
    const pocket = (y: number, z: number) =>
      ramp(z, 0.48, 0.86) * ramp(y, -0.81, -0.46) * (1 - ramp(y, 0.68, 0.96));
    surface(head, (u, p) => {
      const t = (u.y + 1) / 2;
      const cross = u.x * MathUtils.lerp(...width, t);
      p.set(
        side * root[0] + dx * t + dy / length * cross,
        root[1] + dy * t - dx / length * cross,
        MathUtils.lerp(root[2], tip[2], t) + u.z * MathUtils.lerp(...depth, t)
          + bend * t * t - recess * pocket(u.y, u.z),
      );
    }, (u, _p, out) => {
      const hollow = pocket(u.y, u.z);
      out.copy(tint).lerp(inner, hollow * (0.84 + 0.16 * bell(u.y, 0.48)));
    }, 30, 26);
  }
}

const rabbitBlush = new Color("#e3a1a9");
const rabbitLid = "#cbb7c6";

export function makeRabbitDetail(density: HeadDensity = "close"): Group {
  const head = sculptRoot(density);
  head.name = "rabbit-detail";
  ears(head, {
    root: [0.161, 0.233, -0.025], tip: [0.309, 0.943, -0.065],
    width: [0.149, 0.108], depth: [0.128, 0.083],
    tint: white, inner: lavender, recess: 0.024, bend: 0.018,
  });
  const front = face(head, [0.519, 0.460, 0.470],
    (x, y) => 0.052 * bell(x, 0.26) * bell(y + 0.134, 0.149)
      + 0.057 * bell(Math.abs(x) - 0.26, 0.207) * bell(y + 0.145, 0.144)
      - 0.014 * bell(Math.abs(x) - 0.183, 0.087) * bell(y - 0.016, 0.081),
    (u, p, out) => {
      const cheek = bell(Math.abs(p.x) - 0.293, 0.065) * bell(p.y + 0.123, 0.052) * ramp(u.z, 0.37, 0.7);
      out.copy(white).lerp(lavender, 0.14 * ramp(-p.y, 0.06, 0.44)).lerp(rabbitBlush, cheek * 0.58);
    });
  eyes(head, place(front, 0.177, 0.019), rabbitLid, 0.04, [0.049, 0.069]);
  oval(head, "#ac7584", place(front, 0, -0.093, 0.011), [0.056, 0.035, 0.025], 0, 0.54);
  line(head, front, [[0, -0.12], [0, -0.144], [0, -0.154]], "#846473", 0.007);
  smallSmile(head, front, -0.154, "#846473");
  const tooth = oval(head, "#fff0d8", place(front, 0, -0.181, 0.005), [0.020, 0.022, 0.008]);
  tooth.rotation.x = 0.16;
  return head;
}

const pigPink = new Color("#efaebd");
const pigEar = new Color("#d48298");
const pigSnout = new Color("#d27e94");
const pigNostril = new Color("#6e384f");
const pigBlush = new Color("#de8695");

function snoutHoles(x: number, y: number): number {
  const fromCenter = ((Math.abs(x) - 0.077) / 0.039) ** 2 + ((y + 0.114) / 0.047) ** 2;
  return Math.exp(-(fromCenter ** 1.36));
}

export function makePigDetail(density: HeadDensity = "close"): Group {
  const head = sculptRoot(density);
  head.name = "pig-detail";
  ears(head, {
    root: [0.246, 0.264, 0.012], tip: [0.560, 0.210, 0.100],
    width: [0.151, 0.075], depth: [0.125, 0.069],
    tint: pigPink, inner: pigEar, recess: 0.020, bend: 0.082,
  });
  const front = face(head, [0.528, 0.438, 0.461],
    (x, y) => 0.137 * Math.exp(-(((x / 0.243) ** 2 + ((y + 0.115) / 0.147) ** 2) ** 2))
      + 0.048 * bell(Math.abs(x) - 0.33, 0.175) * bell(y + 0.142, 0.154)
      - 0.054 * snoutHoles(x, y) - 0.010 * bell(Math.abs(x) - 0.222, 0.087) * bell(y - 0.027, 0.079),
    (u, p, out) => {
      const nose = Math.exp(-(((p.x / 0.213) ** 2 + ((p.y + 0.115) / 0.121) ** 2) ** 2));
      const front = ramp(u.z, 0.39, 0.84);
      const cheek = bell(Math.abs(p.x) - 0.335, 0.068) * bell(p.y + 0.12, 0.05);
      out.copy(pigPink).lerp(pigBlush, 0.46 * front * cheek)
        .lerp(pigSnout, 0.94 * front * nose)
        .lerp(pigNostril, front * ramp(snoutHoles(p.x, p.y), 0.13, 0.71));
    });
  eyes(head, place(front, 0.221, 0.035), "#d98d9e", 0.07, [0.046, 0.069]);
  markExpressionPart(line(head, front, [[-0.131, -0.215], [-0.071, -0.248], [0, -0.259], [0.071, -0.248], [0.131, -0.215]], "#976471"),
    "mouth", [0, -0.235, 0]);
  return head;
}

const lionGold = new Color("#e5ab5f");
const lionOchre = new Color("#c2854d");
const lionCream = new Color("#f1c27f");
const lionBlush = new Color("#d4876b");
const lionFreckles = new Color("#a87155");
const maneLight = new Color("#b47544");
const maneShade = new Color("#793f2b");

function mane(head: Group): void {
  surface(head, (u, p) => {
    const angle = Math.atan2(u.x, u.y);
    const edge = Math.hypot(u.x, u.y);
    const curl = 0.075 * Math.cos(angle * 9 + 1.32 * u.z) + 0.023 * Math.sin(angle * 5 - 1.5 * u.z);
    const rim = 1 + curl * edge * edge;
    p.set(u.x * 0.598 * rim, u.y * 0.544 * rim + 0.006, -0.171 + u.z * (0.335 + curl * 0.41 * edge));
  }, (u, _p, out) => {
    const angle = Math.atan2(u.x, u.y);
    const edge = Math.hypot(u.x, u.y);
    const rill = 0.5 + 0.5 * Math.cos(angle * 9 + u.z * 3.25);
    out.copy(maneLight).lerp(maneShade, 0.16 + 0.21 * rill * edge + 0.14 * ramp(-u.y, 0, 1));
  }, 58, 34);
}

export function makeLionDetail(density: HeadDensity = "close"): Group {
  const head = sculptRoot(density);
  head.name = "lion-detail";
  mane(head);
  ears(head, {
    root: [0.302, 0.176, 0.177], tip: [0.433, 0.347, 0.227],
    width: [0.102, 0.092], depth: [0.089, 0.061],
    tint: lionGold, inner: lionOchre, recess: 0.019,
  });
  const front = face(head, [0.471, 0.414, 0.438],
    (x, y) => 0.072 * bell(x, 0.25) * bell(y + 0.10, 0.152)
      + 0.060 * bell(Math.abs(x) - 0.207, 0.206) * bell(y + 0.141, 0.142)
      - 0.013 * bell(Math.abs(x) - 0.174, 0.091) * bell(y - 0.027, 0.087),
    (u, p, out) => {
      const front = ramp(u.z, 0.29, 0.8);
      const muzzle = bell(p.x, 0.264) * bell(p.y + 0.14, 0.16);
      const cheek = bell(Math.abs(p.x) - 0.272, 0.068) * bell(p.y + 0.116, 0.051);
      const freckles = bell(Math.abs(p.x) - 0.112, 0.018) * bell(p.y + 0.145, 0.016)
        + bell(Math.abs(p.x) - 0.151, 0.016) * bell(p.y + 0.116, 0.016);
      out.copy(lionGold).lerp(lionOchre, 0.31 * ramp(-p.y, 0.18, 0.40))
        .lerp(lionCream, 0.77 * muzzle * front).lerp(lionBlush, 0.66 * cheek * front)
        .lerp(lionFreckles, 0.41 * freckles * front);
    });
  eyes(head, place(front, 0.175, 0.034), "#b88250", 0.045, [0.053, 0.074]);
  oval(head, "#5d3940", place(front, 0, -0.077, 0.009), [0.079, 0.047, 0.031], 0, 0.44);
  line(head, front, [[0, -0.108], [0, -0.131], [0, -0.153]], "#794e46");
  smallSmile(head, front, -0.153, "#794e46");
  return head;
}

const wool = new Color("#f5e8d5");
const woolShade = new Color("#c1a38a");
const ramFur = new Color("#e5c3a5");
const ramBlush = new Color("#d99c8d");
const hornBase = new Color("#9b6a52");
const hornRib = new Color("#6c493e");
const hornMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.78 });

function horn(head: Group, side: number): void {
  const knots = Array.from({ length: 15 }, (_, i) => {
    const t = i / 14;
    const theta = -0.74 + t * 5.7;
    const radius = 0.244 - 0.151 * t;
    return new Vector3(
      side * (0.414 + Math.sin(theta) * radius), 0.108 + Math.cos(theta) * radius, -0.117 + 0.419 * t + 0.068 * t ** 4,
    );
  });
  const path = new CatmullRomCurve3(knots);
  const segments = sculptSegments(head, 64, 30);
  const around = sculptSegments(head, 14, 8);
  const geometry = new TubeGeometry(path, segments, 0.138, around, false);
  const vertices = geometry.attributes.position!;
  const vertex = new Vector3();
  const center = new Vector3();
  const colors: number[] = [];
  const color = new Color();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    path.getPointAt(t, center);
    const seam = (0.5 + 0.5 * Math.cos((t * 9.3 + t * t * 2) * Math.PI * 2)) ** 3;
    const taper = MathUtils.lerp(1, 0.41, t) * (1 - 0.94 * ramp(t, 0.88, 1)) - 0.019 * seam;
    for (let j = 0; j <= around; j++) {
      const idx = i * (around + 1) + j;
      vertex.fromBufferAttribute(vertices, idx).lerp(center, 1 - taper);
      vertices.setXYZ(idx, vertex.x, vertex.y, vertex.z);
      color.copy(hornBase).lerp(hornRib, 0.16 * seam + 0.22 * ramp(t, 0.64, 1) + 0.13 * Math.abs(j / around - 0.5));
      colors.push(color.r, color.g, color.b);
    }
  }
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  head.add(new Mesh(geometry, hornMaterial));
}

function woolLine(x: number): number {
  return 0.184 - 0.029 * Math.cos(x * 27.5) - 0.046 * ramp(x, 0.12, 0.37);
}

function woolTufts(x: number, y: number): number {
  return Math.max(
    bell(x, 0.101) * bell(y - 0.235, 0.084),
    bell(Math.abs(x) - 0.175, 0.083) * bell(y - 0.258, 0.091),
    bell(Math.abs(x) - 0.310, 0.076) * bell(y - 0.224, 0.117),
    bell(Math.abs(x) - 0.071, 0.095) * bell(y - 0.372, 0.078),
  );
}

export function makeRamDetail(density: HeadDensity = "close"): Group {
  const head = sculptRoot(density);
  head.name = "ram-detail";
  const front = face(head, [0.456, 0.474, 0.446],
    (x, y) => {
      const fleece = ramp(y, woolLine(Math.abs(x)) - 0.02, 0.337);
      const tufts = woolTufts(x, y);
      return 0.028 * fleece + 0.055 * tufts * ramp(y, 0.12, 0.23)
        + 0.054 * bell(x, 0.271) * bell(y + 0.15, 0.151);
    }, (u, p, out) => {
      const lineY = woolLine(Math.abs(p.x)) - 0.101 * ramp(-u.z, 0.12, 0.70);
      const fleece = ramp(p.y, lineY - 0.033, lineY + 0.035);
      const tufts = woolTufts(p.x, p.y);
      const cheek = bell(Math.abs(p.x) - 0.238, 0.071) * bell(p.y + 0.133, 0.061);
      out.copy(ramFur).lerp(ramBlush, 0.73 * cheek * ramp(u.z, 0.35, 0.79))
        .lerp(woolShade, 0.71 * fleece).lerp(wool, fleece * (0.42 + 0.58 * tufts));
    });
  for (const side of sides) horn(head, side);
  eyes(head, place(front, 0.178, -0.030), "#b79176", 0.055, [0.049, 0.066]);
  oval(head, "#9f6c62", place(front, 0, -0.108, 0.010), [0.066, 0.038, 0.024], 0, 0.56);
  line(head, front, [[0, -0.138], [0, -0.153], [0, -0.172]], "#8b665b");
  smallSmile(head, front, -0.172, "#8b665b");
  return head;
}

const batPurple = new Color("#6b5a88");
const batEar = new Color("#a784a9");
const batWing = new Color("#423457");
const batNose = new Color("#be90b7");
const batNostril = new Color("#38294b");
const batBlush = new Color("#b878a0");
const ivory = new Color("#f0dfd4");

function batFang(head: Group, front: Front, side: number): void {
  surface(head, (u, p) => {
    const t = (1 - u.y) / 2;
    const width = MathUtils.lerp(0.029, 0.004, t);
    const x = side * MathUtils.lerp(0.110, 0.081, t) + u.x * width;
    const y = -0.142 - 0.090 * t;
    const z = front(x, y) + MathUtils.lerp(-0.008, 0.018, t) + u.z * width * 0.82;
    p.set(x, y, z);
  }, (_u, _p, out) => out.copy(ivory), 18, 12, 0.55);
}

export function makeBatDetail(density: HeadDensity = "close"): Group {
  const head = sculptRoot(density);
  head.name = "bat-detail";
  ears(head, {
    root: [0.245, 0.096, -0.022], tip: [0.644, 0.504, 0.020],
    width: [0.222, 0.090], depth: [0.148, 0.062],
    tint: batPurple, inner: batEar, recess: 0.026, bend: 0.037,
  });
  const front = face(head, [0.508, 0.423, 0.440],
    (x, y) => 0.083 * bell(x, 0.148) * bell(y + 0.073, 0.091)
      - 0.033 * bell(Math.abs(x) - 0.037, 0.025) * bell(y + 0.078, 0.029)
      + 0.046 * bell(Math.abs(x) - 0.27, 0.197) * bell(y + 0.132, 0.14),
    (u, p, out) => {
      const front = ramp(u.z, 0.31, 0.78);
      const muzzle = bell(p.x, 0.131) * bell(p.y + 0.073, 0.077);
      const nostril = bell(Math.abs(p.x) - 0.037, 0.025) * bell(p.y + 0.078, 0.028);
      const cheek = bell(Math.abs(p.x) - 0.302, 0.059) * bell(p.y + 0.113, 0.049);
      out.copy(batPurple).lerp(batWing, 0.22 * ramp(-p.y, 0.19, 0.4))
        .lerp(batNose, 0.96 * muzzle * front).lerp(batNostril, ramp(nostril, 0.12, 0.77) * front)
        .lerp(batBlush, 0.67 * cheek * front);
    });
  eyes(head, place(front, 0.184, 0.029), "#84709b", 0.06, [0.05, 0.070]);
  markExpressionPart(line(head, front, [[-0.12, -0.152], [-0.057, -0.181], [0, -0.186], [0.057, -0.181], [0.12, -0.152]], ink),
    "mouth", [0, -0.167, 0]);
  for (const side of sides) batFang(head, front, side);
  return head;
}
