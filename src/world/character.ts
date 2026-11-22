// 공유 재질(bodyMaterial 등)은 건드리지 않는다 — 반투명이 필요한 캐릭터만 복제 재질을 쓴다(RESEARCH Anti-Pattern, 08-10).
// 달빛 누아르의 조립 인물. 새 외형도 기존 관절에 버텍스 컬러로 병합해
// 한 명을 몸통·머리·팔 2·다리 2와 발밑 원판으로 그린다.
import {
  BackSide,
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Object3D,
  RingGeometry,
  Shape,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  CatmullRomCurve3,
  Uint32BufferAttribute,
  Vector2,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ANIMALS, type AnimalId } from "../../shared/game/animals";
import { animalHatFit, animalLayout, animalSkin, buildAnimalBody, buildAnimalHead } from "./animalGeometry";
import { animalMaterial, FINISH, type Finish } from "./animalFinish";
import { applyDetailedFace, detailedAnimalHead } from "./barAssets/animal-detail";
import type { HeadDensity } from "./barAssets/head-sculpt";
import { MOVE_SPEED } from "../../shared/game/world";
import { buildGhost3d, type Ghost3d } from "./ghost3d";
import { createNoteRig, type NoteRig } from "./postit";
import { emoteCycles, REDUCED_Y_SCALE } from "./emoteCap";
import { EMOTE_KEYS, EMOTES, EYE, type EmoteId, FACE_IDS, type FaceId, type Fig, FIGS, GHOST_SCALE, type KnownFaceId, MAFIA_FIG_INDEX, MOUTH, type Outfit, OUTFITS, type OutfitId, type PoseKey, SKIN } from "./characterData";

/** 맵 위 크기 — 원래 키 약 2.1 단위를 약 1.7 로 줄여 쓴다 */
export const CHAR_SCALE = 0.83;
/** 걸음 위상 증가율(rad/s). 보드 기준 11 rad/s @ 1.245 단위/초를 로비 이동 속도에 비례시켜 발이 미끄러지지 않게 한다 */
export const WALK_PHASE_RATE = (11 * MOVE_SPEED) / 1.245;
/** 걷기·서기 전환 섞기(ms) — 결정 0059-3 짧은 자세 섞기 */
export const POSE_BLEND_MS = 120;

export { figForSeat } from "./characterData";

// ---------- 부품 → 관절 병합 ----------

type JointName = "torso" | "head" | "armA" | "armB" | "legA" | "legB";
const JOINTS: readonly JointName[] = ["torso", "head", "armA", "armB", "legA", "legB"];

/** 관절 기준 좌표로 구워 둔 부품 하나. 색은 slot(의상 따라 바뀜) 또는 고정색이다 */
interface Part {
  tag: string;
  slot: string;
  color: Color | null;
  geo: BufferGeometry;
  /** 돋보기 유리처럼 투명한 조각 — 병합에서 빼고 따로 둔다 */
  glass: boolean;
  finish: Finish;
}

const SLOTS = new Set(["coat", "coatLight", "coatShade", "shirt", "tie", "pants", "shoe", "skin", "hand", "hair"]);
const FABRIC_SLOTS = new Set(["coat", "coatLight", "coatShade", "shirt", "tie", "pants"]);
const DUMMY = new MeshBasicMaterial();
const colorCache = new Map<string, Color>();
function col(hex: string): Color {
  let c = colorCache.get(hex);
  if (!c) {
    c = new Color(hex);
    colorCache.set(hex, c);
  }
  return c;
}

/** 템플릿 부품 하나(원문 mesh(geo, mat)). spec 은 '#rrggbb' 고정색 또는 slot 이름, tag 는 보이기 규칙 이름 */
function part(parent: Object3D, geo: BufferGeometry, spec: string, tag?: string, finish?: Finish): Mesh {
  const m = new Mesh(geo, DUMMY);
  m.userData.spec = spec;
  if (tag) m.userData.tag = tag;
  if (finish !== undefined) m.userData.finish = finish;
  parent.add(m);
  return m;
}
function tagged<T extends Object3D>(o: T, tag: string): T {
  o.userData.tag = tag;
  return o;
}

/** 열린 면(챙·후드)을 앞뒤 모두 보이게: 뒤집힌 복사본을 덧붙인다(원문 DoubleSide 와 같은 모양, 재질은 하나로 유지) */
function twoSided(g: BufferGeometry): BufferGeometry {
  const pos = g.getAttribute("position").array as ArrayLike<number>;
  const nor = g.getAttribute("normal").array as ArrayLike<number>;
  const idx = g.index;
  if (!idx) throw new Error("twoSided: 인덱스 지오메트리만 받는다");
  const n = pos.length / 3;
  const P = new Float32Array(pos.length * 2);
  const N = new Float32Array(nor.length * 2);
  for (let i = 0; i < pos.length; i++) {
    P[i] = P[pos.length + i] = pos[i];
    N[i] = nor[i];
    N[nor.length + i] = -nor[i];
  }
  const ic = idx.count;
  const I = new Uint32Array(ic * 2);
  for (let i = 0; i < ic; i++) I[i] = idx.getX(i);
  for (let i = 0; i < ic; i += 3) {
    I[ic + i] = idx.getX(i) + n;
    I[ic + i + 1] = idx.getX(i + 2) + n;
    I[ic + i + 2] = idx.getX(i + 1) + n;
  }
  const out = new BufferGeometry();
  out.setAttribute("position", new Float32BufferAttribute(P, 3));
  out.setAttribute("normal", new Float32BufferAttribute(N, 3));
  out.setIndex(new Uint32BufferAttribute(I, 1));
  return out;
}

// ---------- 얼굴 (원문 buildFaces) ----------

function faceSphere(r: number, color: string, sx = 1, sy = 1, sz = 1): Mesh {
  const m = new Mesh(new SphereGeometry(r, 12, 10), DUMMY);
  m.userData.spec = color;
  m.scale.set(sx, sy, sz);
  return m;
}
function faceBox(w: number, h: number, color: string): Mesh {
  const m = new Mesh(new BoxGeometry(w, h, 0.02), DUMMY);
  m.userData.spec = color;
  return m;
}
function arc(r: number, tube: number, color: string, full?: boolean): Mesh {
  const m = new Mesh(new TorusGeometry(r, tube, 8, 20, full ? Math.PI * 2 : Math.PI), DUMMY);
  m.userData.spec = color;
  return m;
}
/** 머리 구 표면에 붙이고 바깥을 보게 한다. 돌리기는 붙인 뒤 local z 축으로 */
function onHead(obj: Object3D, x: number, y: number, R: number, out?: number, rz?: number): Group {
  const z = Math.sqrt(Math.max(0, R * R - x * x - y * y)) + (out === undefined ? 0.005 : out);
  const holder = new Group();
  holder.position.set(x, y, z);
  holder.lookAt(x * 2, y * 2, z * 2 + 0.0001);
  obj.rotation.z = rz || 0;
  holder.add(obj);
  return holder;
}

/** browR: 앞머리 바깥 반지름. 눈썹은 앞머리에 묻히지 않게 그 위에 붙인다 */
function buildFaces(head: Object3D, R: number, browR: number): void {
  function grp(name: string): Group {
    const g = new Group();
    head.add(g);
    g.userData.tag = `face:${name}`;
    return g;
  }
  const ex = 0.194;
  const ey = 0.037;
  let g = grp("base");
  for (const x of [-ex, ex]) {
    g.add(onHead(faceSphere(0.065, EYE, 0.86, 1.28, 0.42), x, ey, R));
    g.add(onHead(faceSphere(0.014, "#efd9bd", 1, 1, 0.6), x - 0.017, ey + 0.024, R, 0.031));
  }
  g.add(onHead(arc(0.078, 0.015, MOUTH), 0, -0.155, R, 0.005, Math.PI));
  g = grp("happy");
  for (const x of [-ex, ex]) g.add(onHead(arc(0.055, 0.017, EYE), x, ey - 0.02, R));
  g.add(onHead(faceSphere(0.085, MOUTH, 1, 0.75, 0.3), 0, -0.17, R));
  g = grp("angry");
  for (const x of [-ex, ex]) g.add(onHead(faceSphere(0.052, EYE, 1, 1.1, 0.5), x, ey, R));
  for (const s of [-1, 1]) g.add(onHead(faceBox(0.15, 0.03, EYE), s * ex, 0.13, browR, 0.006, s * 0.45));
  g.add(onHead(faceBox(0.13, 0.026, MOUTH), 0, -0.18, R));
  g = grp("cry");
  for (const x of [-ex, ex]) g.add(onHead(arc(0.055, 0.017, EYE), x, ey + 0.01, R, 0.005, Math.PI));
  for (const x of [-ex, ex]) g.add(onHead(faceSphere(0.04, "#9ec2ff", 1, 1.9, 0.6), x + (x > 0 ? 0.02 : -0.02), -0.11, R, 0.02));
  g.add(onHead(faceSphere(0.06, MOUTH, 1.2, 0.8, 0.3), 0, -0.19, R));
  g = grp("surprise");
  for (const x of [-ex, ex]) {
    g.add(onHead(faceSphere(0.075, EYE, 1, 1.15, 0.5), x, ey + 0.01, R));
    g.add(onHead(faceSphere(0.022, "#ffffff"), x + 0.025, ey + 0.045, R, 0.03));
  }
  g.add(onHead(arc(0.05, 0.02, MOUTH, true), 0, -0.19, R));
  g = grp("sus");
  for (const x of [-ex, ex]) g.add(onHead(faceBox(0.12, 0.034, EYE), x, ey, R));
  g.add(onHead(faceBox(0.15, 0.03, EYE), ex, 0.14, browR, 0.006, 0.25));
  g.add(onHead(arc(0.06, 0.017, MOUTH), 0.05, -0.17, R, 0.005, Math.PI + 0.45));
  g = grp("dead");
  for (const x of [-ex, ex]) for (const r of [0.78, -0.78]) g.add(onHead(faceBox(0.13, 0.028, EYE), x, ey, R, 0.005, r));
  g.add(onHead(faceBox(0.1, 0.024, MOUTH), 0, -0.18, R));
  head.add(onHead(faceSphere(0.052, "#d98670", 1.06, 0.84, 0.88), 0, -0.065, R, 0.01));
  for (const x of [-0.31, 0.31]) head.add(onHead(faceSphere(0.081, "#d48676", 1.3, 0.68, 0.3), x, -0.107, R, 0));
}

/** 동물의 눈·입·안경을 고유 얼굴 위치에 맞춘다. 모든 표정은 기존 병합 캐시와 같은 이름으로 선택한다. */
function buildAnimalFaces(head: Object3D, animal: AnimalId): void {
  const eyeColor = "#302826";
  const mouthColor = "#634741";
  const layout = animalLayout(animal);
  const [x, y, z] = layout.eye;
  const [mx, my, mz] = layout.mouth;
  const scenePart = (parent: Object3D, mesh: Mesh, px: number, py: number, pz: number, roll = 0): void => {
    mesh.position.set(px, py, pz);
    mesh.rotation.z = roll;
    mesh.userData.finish = FINISH.smooth;
    parent.add(mesh);
  };
  const group = (tag: string): Group => {
    const next = tagged(new Group(), tag);
    head.add(next);
    return next;
  };

  for (const face of FACE_IDS) {
    const expression = group(`face:${face}`);
    for (const side of [-1, 1]) {
      const px = side * x;
      if (face === "happy" || face === "cry") {
        scenePart(expression, arc(0.050, 0.012, eyeColor), px, y, z + 0.023, face === "cry" ? Math.PI : 0);
        if (face === "cry") scenePart(expression, faceSphere(0.030, "#9ec2ff", 1, 1.55, 0.63), px, y - 0.11, z + 0.045);
      } else if (face === "dead") {
        for (const tilt of [0.8, -0.8]) scenePart(expression, faceBox(0.12, 0.022, eyeColor), px, y, z + 0.017, tilt);
      } else if (face === "sus") {
        scenePart(expression, faceBox(0.113, 0.028, eyeColor), px, y + 0.008, z + 0.018, side * 0.12);
      } else {
        const wide = face === "surprise";
        scenePart(expression, faceSphere(wide ? 0.075 : 0.064, eyeColor, 0.94, wide ? 1.12 : 1.14, 0.43), px, y, z + 0.015);
        scenePart(expression, faceSphere(0.010, "#eddfcc"), px - 0.016, y + 0.020, z + 0.044);
        if (face === "angry") scenePart(expression, faceBox(0.137, 0.024, eyeColor), px, y + 0.095, z - 0.016, side * 0.36);
      }
    }
    // 주둥이·부리·코 자체가 입인 동물은 그 위에 다른 입을 겹쳐 쓰지 않는다.
    if (animal === "crocodile" || animal === "elephant" || animal === "parrot" || animal === "penguin") continue;
    if (face === "surprise") scenePart(expression, faceSphere(0.051, mouthColor, 1, 1.13, 0.37), mx, my, mz + 0.004);
    else if (face === "angry" || face === "dead") scenePart(expression, faceBox(0.110, 0.019, mouthColor), mx, my, mz);
    else {
      const smile = arc(animal === "frog" ? 0.15 : 0.062, 0.011, mouthColor);
      smile.scale.y = animal === "frog" ? 0.42 : 0.79;
      scenePart(expression, smile, mx, my, mz, Math.PI);
    }
  }

  const fit = animalHatFit(animal);
  const hatRest = new Group();
  hatRest.position.set(0, fit.y, fit.z);
  hatRest.rotation.x = fit.tilt ?? 0;
  hatRest.scale.set(...(fit.scale ?? [1, 1, 1]));
  head.add(hatRest);
  const hatMount = new Group();
  hatMount.position.y = -HAT_Y;
  hatRest.add(hatMount);
  buildHats(hatMount, fit.radius, "", 28, fit.brim, false);

  const shades = group("acc:shades");
  for (const side of [-1, 1]) {
    const px = side * x;
    const frame = new Group();
    frame.position.set(px, y + 0.005, z + 0.037);
    frame.rotation.y = side * 0.17;
    shades.add(frame);
    scenePart(frame, faceSphere(0.133, "#14161c", 1.04, 0.78, 0.31), 0, 0, 0);
    scenePart(frame, faceBox(0.068, 0.012, "#78889b"), -0.020, 0.033, 0.042, 0.23);
    const from = new Vector3(0.105 * side, 0.008, 0).applyEuler(frame.rotation).add(frame.position);
    const templeDepth = animal === "frog" ? 0.22 : animal === "crocodile" ? 0.19 : 0.16;
    const to = new Vector3(side * (x + 0.113), y - 0.008, z - templeDepth);
    const direction = to.clone().sub(from);
    const temple = part(shades, new CylinderGeometry(0.014, 0.014, direction.length(), 8), "#14161c");
    temple.position.copy(from).addScaledVector(direction, 0.5);
    temple.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize());
  }
  if (animal !== "parrot") scenePart(shades, faceBox(x * 1.22, 0.028, "#14161c"), 0, y + 0.02, z + 0.052);
}

// ---------- 모자 (원문 brimGeo·buildHats) ----------

/** 모자는 머리띠 높이 HAT_Y 에 얹는다. 챙은 아이소 카메라(약 36° 위)에서 눈을 가리지 않을 만큼만 내민다 */
const HAT_Y = 0.26;

/** 챙: 안쪽 반지름 rIn, 바깥은 각도 a(0 이 앞)마다 outR(a), bend(a, d) 는 안쪽에서 d 만큼 나간 곳의 높이 변화. 위·아래 면과 테두리를 한 메시로 */
function brimGeo(rIn: number, outR: (a: number) => number, a0: number, a1: number, thick: number, bend: (a: number, d: number) => number, AS: number): BufferGeometry {
  const RS = AS < 40 ? 3 : 4;
  const W = RS + 1;
  const pos: number[] = [];
  const idx: number[] = [];
  function sheet(off: number): void {
    for (let i = 0; i <= AS; i++) {
      const a = a0 + ((a1 - a0) * i) / AS;
      const ro = outR(a);
      for (let j = 0; j <= RS; j++) {
        const r = rIn + ((ro - rIn) * j) / RS;
        pos.push(Math.sin(a) * r, off + bend(a, r - rIn), Math.cos(a) * r);
      }
    }
  }
  sheet(0);
  const B = pos.length / 3;
  sheet(-thick);
  for (let i = 0; i < AS; i++) {
    for (let j = 0; j < RS; j++) {
      const k = i * W + j;
      idx.push(k, k + 1, k + W, k + 1, k + W + 1, k + W, B + k, B + k + W, B + k + 1, B + k + 1, B + k + W, B + k + W + 1);
    }
    const o = i * W + RS;
    const n = i * W;
    idx.push(o, B + o, o + W, o + W, B + o, B + o + W, n, n + W, B + n, n + W, B + n + W, B + n);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
/** 앞(또는 뒤)으로 내민 챙의 바깥 둘레: 가운데가 len 만큼 길고 양 끝(±half)에서 0 */
function visorR(F: number, len: number, half: number): (a: number) => number {
  return (a) => {
    const k = Math.min(1, Math.abs(a) / half);
    return F + len * Math.cos((k * Math.PI) / 2) ** 0.6;
  };
}

interface BrimmedOpts {
  crown: string;
  band: string;
  crease: string;
  h: number;
  taper: number;
  dome: number;
  brim: number;
  lift: number;
  flip: number;
  curl: number;
}

function buildHats(head: Object3D, F: number, defaultHat: string, brimSegments = 48, brimScale = 1, uprightHood = true): void {
  function grp(n: string): Group {
    const g = new Group();
    g.userData.tag = `hat:${n}`;
    head.add(g);
    return g;
  }
  function add(g: Object3D, geo: BufferGeometry, spec: string, x = 0, y = 0, z = 0, dbl = false): Mesh {
    const o = part(g, dbl ? twoSided(geo) : geo, spec);
    o.position.set(x, y, z);
    return o;
  }
  function dome(r: number, k: number): BufferGeometry {
    const d = new SphereGeometry(r, 32, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    d.scale(1, k, 1);
    return d;
  }
  // 챙 모자(페도라·밀짚): 위로 살짝 좁아지는 몸통, 둥근 윗면, 띠, 뒤가 말려 올라간 챙
  function brimmed(n: string, o: BrimmedOpts): void {
    const g = grp(n);
    const H = o.h;
    const top = F - o.taper;
    add(g, new CylinderGeometry(top, F + 0.005, H, 32), o.crown, 0, HAT_Y + H / 2);
    add(g, dome(top, o.dome), o.crown, 0, HAT_Y + H);
    if (o.crease) {
      const cr = add(g, new SphereGeometry(0.2, 16, 8), o.crease, 0, HAT_Y + H + top * o.dome - 0.035);
      cr.scale.set(0.42, 0.28, 1.45);
    }
    add(g, new CylinderGeometry(F + 0.014, F + 0.018, 0.09, 32), o.band, 0, HAT_Y + 0.07);
    add(
      g,
      brimGeo(F - 0.03, () => F + o.brim * brimScale, -Math.PI, Math.PI, 0.035, (a, d) => {
        const c = Math.cos(a);
        return d * (c > 0 ? o.lift : o.lift - o.flip * c) + d * d * o.curl;
      }, brimSegments),
      o.crown,
      0,
      HAT_Y + 0.03,
      0,
      true,
    );
  }
  const fedora = { h: 0.33, taper: 0.07, dome: 0.26, brim: 0.27, lift: 0.02, flip: 0.3, curl: 0.4 };
  brimmed("fedoraDark", { ...fedora, crown: "#3d4357", band: "#22252e", crease: "#30354a" });
  brimmed("fedoraTan", { ...fedora, crown: "#a98559", band: "#5a3a26", crease: "#8f7048" });
  brimmed("fedoraMafia", { ...fedora, crown: "#1a1d24", band: "#8e0b21", crease: "#14161c" });
  // 클로슈는 윗면이 둥글고 좁은 챙이 아래로 향한다.
  if (defaultHat === "cloche") {
    brimmed("cloche", {
      ...fedora, h: 0.14, taper: 0.02, dome: 0.68, brim: 0.075,
      lift: -0.65, flip: 0, curl: 0, crown: "#395b60", band: "#a5826b", crease: "",
    });
  }

  // 경찰 모자: 검은 띠, 위로 퍼지는 윗판(앞이 살짝 들림), 은빛 휘장·턱끈, 반짝이는 검은 챙
  let g = grp("police");
  add(g, new CylinderGeometry(F + 0.012, F + 0.012, 0.14, 32), "#16213d", 0, HAT_Y + 0.07);
  add(g, new CylinderGeometry(F + 0.022, F + 0.022, 0.026, 32), "#c9d3ea", 0, HAT_Y + 0.03);
  const crown = new Group();
  crown.position.y = HAT_Y + 0.13;
  crown.rotation.x = -0.1;
  g.add(crown);
  add(crown, new CylinderGeometry(F + 0.1, F + 0.008, 0.17, 32), "#2a4372", 0, 0.085);
  add(crown, dome(F + 0.1, 0.16), "#2a4372", 0, 0.17);
  const emb = add(crown, new SphereGeometry(0.075, 14, 10), "#c9d3ea", 0, 0.075, F + 0.05);
  emb.scale.z = 0.35;
  add(g, brimGeo(F - 0.03, visorR(F, 0.22 * brimScale, 1.2), -1.2, 1.2, 0.03, (_a, d) => -d * 0.3, brimSegments), "#121a30", 0, HAT_Y + 0.012, 0, true);

  // 탐정 모자(디어스토커): 머리를 감싸는 둥근 몸통, 앞뒤 짧은 챙, 위로 묶어 올린 귀덮개와 매듭
  g = grp("deer");
  const Rd = Math.sqrt(F * F + HAT_Y * HAT_Y);
  add(g, new SphereGeometry(Rd, 32, 14, 0, Math.PI * 2, 0, Math.acos(HAT_Y / Rd)), "#8a6a45");
  for (const rot of [0, Math.PI]) {
    const v = add(g, brimGeo(F - 0.03, visorR(F, 0.17 * brimScale, 1.15), -1.15, 1.15, 0.03, (_a, d) => -d * 0.4, brimSegments), "#6b5236", 0, HAT_Y + 0.012, 0, true);
    v.rotation.y = rot;
  }
  // 귀덮개는 몸통 옆면에 납작하게 붙인다(얇은 축을 면의 바깥 방향으로)
  const fa = Math.acos((HAT_Y + 0.1) / Rd);
  for (const s of [-1, 1]) {
    const flap = add(g, new SphereGeometry(0.2, 16, 10), "#7d6040", s * (Rd + 0.012) * Math.sin(fa), (Rd + 0.012) * Math.cos(fa), 0);
    flap.scale.set(0.16, 0.7, 0.9);
    flap.rotation.z = s * (Math.PI / 2 - fa);
  }
  add(g, new SphereGeometry(0.045, 10, 8), "#4a3a28", 0, Rd + 0.01, 0);
  for (const s of [-1, 1]) {
    const loop = add(g, new TorusGeometry(0.05, 0.016, 6, 14), "#4a3a28", s * 0.07, Rd - 0.005, 0);
    loop.scale.y = 0.7;
  }

  // 기자 모자(뉴스보이): 띠 위에 앞으로 쏠려 부푼 윗면, 꼭지 단추, 짧은 앞 챙
  g = grp("news");
  add(g, new CylinderGeometry(F + 0.008, F + 0.008, 0.1, 32), "#3a3f4b", 0, HAT_Y + 0.05);
  const puff = new Group();
  puff.position.set(0, HAT_Y + 0.1, 0.04);
  g.add(puff);
  add(puff, dome(F + 0.07, 0.62), "#4a4f5c");
  const rim = add(puff, new TorusGeometry(F + 0.035, 0.045, 8, 40), "#4a4f5c");
  rim.rotation.x = Math.PI / 2;
  add(puff, new SphereGeometry(0.05, 10, 8), "#3a3f4b", 0, (F + 0.07) * 0.62, 0);
  add(g, brimGeo(F - 0.03, visorR(F, 0.18 * brimScale, 1.15), -1.15, 1.15, 0.03, (_a, d) => -d * 0.3, brimSegments), "#3a3f4b", 0, HAT_Y + 0.02, 0, true);

  // 후드: 머리카락보다 큰 두건. 앞은 이마부터 목까지 트고(가장자리 테), 아래는 어깨로 내려간다
  if (!uprightHood) return;
  g = grp("hood");
  const Rh = F + 0.1;
  const open = 1.0;
  const tilt = 0.35;
  const hoodGeo = new SphereGeometry(Rh, 32, 20, 0, Math.PI * 2, open, Math.PI - open);
  hoodGeo.rotateX(Math.PI / 2 + tilt);
  add(g, hoodGeo, "#5a5f6c", 0, 0, 0, true);
  const rimH = add(g, new TorusGeometry(Rh * Math.sin(open), 0.045, 8, 40), "#4e5360", 0, -Math.sin(tilt) * Rh * Math.cos(open), Math.cos(tilt) * Rh * Math.cos(open));
  rimH.rotation.x = tilt;
}

// ---------- 템플릿 조립 → 관절별 부품 ----------

/** Sweep the raised front edge into a side part. The hat variant keeps only the hair below the brim. */
function sculptedHair(radius: number, bob: boolean, hat: boolean, crop: boolean): BufferGeometry {
  const columns = 32;
  const rows = 14;
  const start = hat ? Math.acos((HAT_Y + 0.025) / radius) : 0;
  const shell = new SphereGeometry(radius, columns, rows, 0, Math.PI * 2, start, Math.PI - start - 0.1);
  const positions = shell.getAttribute("position");
  for (let row = 0; row <= rows; row++) {
    for (let column = 0; column <= columns; column++) {
      const angle = (column / columns) * Math.PI * 2;
      const side = -Math.cos(angle);
      const towardFace = Math.min(1, Math.max(0, (Math.sin(angle) - 0.32) / 0.68));
      const sweep = crop ? 1.02 - side * 0.16 : 1.19 + side * 0.26 + Math.sin(angle * 3) * 0.065;
      const backEdge = bob ? 2.36 : crop ? 1.63 : 1.82;
      const edge = backEdge * (1 - towardFace) + sweep * towardFace;
      const theta = start + (Math.max(start, edge) - start) * (row / rows);
      const wave = hat ? 1 : 1 + 0.022 * Math.sin(angle * 2 + theta * 3) * Math.sin(theta);
      const r = radius * wave;
      positions.setXYZ(row * (columns + 1) + column, side * Math.sin(theta) * r, Math.cos(theta) * r, Math.sin(angle) * Math.sin(theta) * r);
    }
  }
  shell.computeVertexNormals();
  return shell;
}

/** Folded coat lapel, cut as a single piece and joined to the torso batch. */
function coatLapel(rounded: boolean): ExtrudeGeometry {
  const edge = new Shape();
  edge.moveTo(0.025, -0.18);
  edge.lineTo(0.022, 0.145);
  edge.lineTo(0.15, 0.123);
  edge.lineTo(0.09, 0.04);
  edge.lineTo(0.124, 0.015);
  edge.closePath();
  const lapel = new ExtrudeGeometry(edge, { depth: 0.014, bevelEnabled: rounded, bevelSize: 0.007, bevelThickness: 0.006, bevelSegments: 2 });
  lapel.setIndex(Array.from({ length: lapel.getAttribute("position").count }, (_, i) => i));
  return lapel;
}

/** 동물의 옷은 밑단/소매 위에 곡면을 이어 조인트가 움직일 때도 부피가 연속된다. */
function clothProfile(points: readonly (readonly [radius: number, y: number])[], segments: number): LatheGeometry {
  return new LatheGeometry(points.map(([radius, y]) => new Vector2(radius, y)), segments);
}
const ANIMAL_COAT_PROFILE = [
  [0, 0.221], [0.154, 0.225], [0.275, 0.239], [0.341, 0.252], [0.365, 0.273], [0.381, 0.296],
  [0.388, 0.355], [0.382, 0.41], [0.362, 0.53], [0.338, 0.67], [0.318, 0.81], [0.316, 0.91],
  [0.303, 0.968], [0.273, 1.021], [0.221, 1.063], [0.155, 1.097], [0.083, 1.115], [0, 1.12],
] as const;
const ANIMAL_SLEEVE_PROFILE = [
  [0, -0.418], [0.071, -0.416], [0.089, -0.397], [0.098, -0.36], [0.103, -0.28],
  [0.113, -0.17], [0.128, -0.052], [0.136, 0.012], [0.120, 0.064],
  [0.090, 0.094], [0.047, 0.115], [0, 0.122],
] as const;
const ANIMAL_TROUSER_PROFILE = [
  [0, -0.251], [0.072, -0.245], [0.090, -0.229], [0.095, -0.187],
  [0.106, -0.064], [0.112, 0.02], [0.098, 0.071], [0.063, 0.103], [0, 0.12],
] as const;

function coatFront(x: number, y: number): number {
  const next = ANIMAL_COAT_PROFILE.findIndex((p) => y < p[1]);
  const [r0, y0] = ANIMAL_COAT_PROFILE[next - 1]!;
  const [r1, y1] = ANIMAL_COAT_PROFILE[next]!;
  const radius = r0 + (r1 - r0) * ((y - y0) / (y1 - y0));
  return Math.sqrt(Math.max(0, radius ** 2 - x ** 2));
}

function fitCoatPanel(geometry: BufferGeometry, relief: number, height = 0): void {
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox!;
  const position = geometry.getAttribute("position");
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i) + height;
    // 앞판의 뒷면을 몸통에 넣고 표면만 솟게 해 옆에서 뜬 선이 생기지 않게 한다.
    const depth = (position.getZ(i) - min.z) / (max.z - min.z);
    position.setXYZ(i, x, y, coatFront(x, y) - 0.020 + depth * (relief + 0.020));
  }
  geometry.computeVertexNormals();
  geometry.boundingBox = null;
}

function cutCoatPanel(points: readonly (readonly [number, number])[], offset: number): BufferGeometry {
  const profile = new Shape(points.map(([x, y]) => new Vector2(x, y)));
  profile.closePath();
  const geometry = new ExtrudeGeometry(profile, { depth: 0.01, bevelEnabled: false });
  geometry.setIndex(Array.from({ length: geometry.getAttribute("position").count }, (_, i) => i));
  fitCoatPanel(geometry, offset);
  return geometry;
}

/** 여밈, 포켓, 단추는 코트 곡면에 맞춘다. 딱지를 붙이는 왼쪽 가슴은 비워 둔다. */
function addCoatDetails(body: Group): void {
  const opening = new CatmullRomCurve3([[0.007, 0.254], [0.02, 0.43], [0.025, 0.61], [0.005, 0.79]].map(([x, y]) =>
    new Vector3(x, y, coatFront(x, y) + 0.003)));
  part(body, new TubeGeometry(opening, 9, 0.007, 5, false), "coatShade");

  for (const side of [-1, 1]) {
    const x = side * 0.202;
    const y = 0.386;
    const patch = part(body, new SphereGeometry(1, 8, 5), "coatShade");
    patch.scale.set(0.083, 0.057, 0.013);
    patch.position.set(x, y, coatFront(x, y));
    patch.rotation.y = side * 0.58;
    const welt = part(body, new SphereGeometry(1, 8, 4), "coatLight");
    welt.scale.set(0.084, 0.011, 0.016);
    welt.position.set(x, y + 0.042, coatFront(x, y + 0.042) + 0.005);
    welt.rotation.y = patch.rotation.y;
    welt.rotation.z = side * 0.13;
  }

  for (const y of [0.615, 0.484, 0.319]) {
    const x = 0.065;
    const button = part(body, clothProfile([[0, -0.008], [0.024, -0.008], [0.033, 0.0], [0.027, 0.012], [0, 0.014]], 10), "#b58958", undefined, FINISH.brass);
    button.rotation.x = Math.PI / 2;
    button.position.set(x, y, coatFront(x, y) + 0.006);
    const stitch = part(body, new BoxGeometry(0.014, 0.005, 0.004), "#6e4c39", undefined, FINISH.smooth);
    stitch.position.copy(button.position).add(new Vector3(0, 0, 0.016));
  }
}

/** 접어 둔 후드는 고개를 따라가지 않고 코트 뒷목에 붙는다. */
function addFoldedAnimalHood(body: Group): void {
  const hood = tagged(new Group(), "hat:hood");
  body.add(hood);
  const fabric = part(hood, new SphereGeometry(1, 14, 8), "coat");
  fabric.scale.set(0.264, 0.115, 0.174);
  fabric.position.set(0, 0.906, -0.305);
  const fold = part(hood, new TorusGeometry(0.20, 0.034, 6, 18), "coatShade");
  fold.scale.set(1.04, 0.79, 0.71);
  fold.rotation.x = Math.PI * 0.59;
  fold.position.set(0, 0.958, -0.332);
}

/** 원문 create(fig) 의 부품을 Mesh 대신 "지오메트리 + 색 + 보이기 이름" 으로 모은 관절별 목록 */
function bakeFig(fig: Fig, animal?: AnimalId): Record<JointName, Part[]> {
  const root = new Group();
  const body = new Group();
  root.add(body);
  const R = 0.56;
  const girl = fig.style === "girl";

  // 다리
  function leg(x: number): Group {
    const g = new Group();
    g.position.set(x, 0.38, 0);
    body.add(g);
    if (animal === undefined) {
      const l = part(g, new CylinderGeometry(0.1, 0.1, 0.26, 12), "pants");
      l.position.y = -0.12;
    } else {
      part(g, clothProfile(ANIMAL_TROUSER_PROFILE, 14), "pants");
    }
    const s = part(g, new SphereGeometry(0.13, 14, 10), "shoe");
    s.scale.set(0.9, 0.55, 1.3);
    s.position.set(0, -0.25, 0.05);
    return g;
  }
  const legA = leg(0.13);
  const legB = leg(-0.13);

  // 코트 아래의 곡면은 포스트잇 부착 좌표와 공유한다.
  if (animal === undefined) {
    part(body, new CylinderGeometry(0.29, 0.39, 0.6, 24), "coat").position.y = 0.66;
    part(body, new SphereGeometry(0.39, 24, 10, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.18), "coat").position.y = 0.38;
    const shoulder = part(body, new SphereGeometry(0.3, 24, 14), "coat");
    shoulder.scale.set(1.18, 0.55, 1);
    shoulder.position.y = 0.94;
  } else {
    // 앞쪽 곡률은 의심딱지를 붙이는 원통과 같게 맞춘다.
    part(body, clothProfile(ANIMAL_COAT_PROFILE, 24), "coat");
    const collar = part(body, new SphereGeometry(1, 14, 9), "shirt");
    collar.scale.set(0.176, 0.154, 0.169);
    collar.position.set(0, 1.054, 0.010);
    const neckJoin = part(body, new SphereGeometry(1, 12, 7), "skin");
    neckJoin.scale.set(0.132, 0.139, 0.129);
    neckJoin.position.y = 1.106;
  }
  if (animal === undefined) {
    const shirt = part(body, new ConeGeometry(0.12, 0.3, 3), "shirt");
    shirt.rotation.x = Math.PI;
    shirt.scale.set(1, 1, 0.25);
    shirt.position.set(0, 0.88, 0.27);
    const tie = part(body, new BoxGeometry(0.06, 0.24, 0.025), "tie", "tie");
    tie.position.set(0, 0.8, 0.305);
    tie.rotation.x = -0.18;
  } else {
    part(body, cutCoatPanel([[-0.133, 1.014], [0, 0.762], [0.133, 1.014], [0, 1.037]], 0.038), "shirt");
    part(body, cutCoatPanel([[-0.037, 0.984], [0.037, 0.984], [0.027, 0.928], [0.049, 0.791], [0, 0.748],
      [-0.049, 0.791], [-0.027, 0.928]], 0.046), "tie", "tie");
  }
  for (const s of [-1, 1]) {
    const lapel = coatLapel(animal !== undefined);
    if (s < 0) lapel.rotateY(Math.PI);
    const lap = part(body, lapel, animal === undefined ? "coat" : "coatLight");
    if (animal === undefined) {
      lap.position.set(0, 0.86, s < 0 ? 0.315 : 0.298);
      lap.rotation.x = -0.11;
    } else {
      fitCoatPanel(lapel, 0.054, 0.86);
    }
  }
  if (animal === undefined) {
    for (const [x, y] of [[0.055, 0.66], [0.045, 0.545]] as const) {
      const button = part(body, new CylinderGeometry(0.025, 0.025, 0.014, 10), "#9a8065");
      button.rotation.x = Math.PI / 2;
      button.position.set(x, y, 0.39 - (0.1 * (y - 0.36)) / 0.6);
    }
  } else {
    addCoatDetails(body);
    addFoldedAnimalHood(body);
  }
  const star = part(body, new SphereGeometry(0.05, 10, 8), "#c9d3ea", "badge:star");
  star.scale.z = 0.4;
  star.position.set(0.17, 0.8, 0.29);
  const cross = tagged(new Group(), "badge:cross");
  cross.position.set(0.17, 0.8, 0.3);
  body.add(cross);
  part(cross, new BoxGeometry(0.03, 0.1, 0.02), "#2FA4A0");
  part(cross, new BoxGeometry(0.1, 0.03, 0.02), "#2FA4A0");
  const press = part(body, new BoxGeometry(0.1, 0.07, 0.02), "#f1f2f5", "badge:press");
  press.position.set(0.16, 0.78, 0.3);

  // 머리: neck(y 1.0) > head(y 0.48)
  const neck = new Group();
  neck.position.y = 1.0;
  body.add(neck);
  const head = new Group();
  head.position.y = animal === undefined ? 0.48 : 0.431;
  neck.add(head);
  if (animal === undefined) {
    const skull = part(head, new SphereGeometry(R, 28, 22), "skin");
    skull.scale.set(1.04, 0.96, 0.98);
    // 단발은 귀를 덮는다. 귀를 그리면 머리카락을 뚫고 나온다
    if (!girl) {
      for (const s of [-1, 1]) {
        const ear = part(head, new SphereGeometry(0.15, 14, 10), "skin", "ear");
        ear.scale.set(0.57, 0.88, 0.83);
        ear.position.set(s * (R + 0.012), -0.035, 0.019);
        const inside = part(head, new SphereGeometry(0.085, 12, 8), "#d79078", "ear");
        inside.scale.set(0.62, 0.86, 0.46);
        inside.position.set(s * (R + 0.026), -0.035, 0.115);
      }
    }
    const hairRadius = R + (girl ? 0.055 : 0.041);
    const crop = fig.haircut === "crop";
    part(head, sculptedHair(hairRadius, girl, false, crop), "hair", "hair");
    part(head, sculptedHair(hairRadius, girl, true, crop), "hair", "hatHair");
    if (fig.haircut === "bun") {
      const bun = part(head, new SphereGeometry(0.21, 16, 12), "hair", "bun");
      bun.scale.set(1, 0.82, 0.9);
      bun.position.set(-0.29, 0.54, -0.14);
    }
    buildFaces(head, R * 0.98, hairRadius + 0.008);
    buildHats(head, Math.sqrt(hairRadius ** 2 - HAT_Y ** 2) + 0.018, fig.hat);

    // 선글라스·수염
    const FR = R * 0.98;
    const shades = tagged(new Group(), "acc:shades");
    const beard = tagged(new Group(), "acc:beard");
    head.add(shades);
    head.add(beard);
    for (const s of [-1, 1]) {
      shades.add(onHead(faceSphere(0.14, "#14161c", 1.24, 0.78, 0.3), s * 0.21, 0.03, FR, 0.04));
      shades.add(onHead(faceBox(0.092, 0.017, "#78889b"), s * 0.21 - 0.026, 0.067, FR, 0.084, 0.26));
      const a = new Vector3(s * 0.33, 0.05, Math.sqrt(FR * FR - 0.33 * 0.33 - 0.0025) + 0.02);
      const b = new Vector3(s * (R + 0.01), 0.06, 0.04);
      const d = new Vector3().subVectors(b, a);
      const armM = part(shades, new CylinderGeometry(0.014, 0.014, d.length(), 6), "#14161c");
      armM.position.copy(a).addScaledVector(d, 0.5);
      armM.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), d.normalize());
    }
    shades.add(onHead(faceBox(0.23, 0.036, "#14161c"), 0, 0.06, FR, 0.043));
    beard.add(onHead(faceSphere(0.075, "#eef0f4", 1.9, 0.55, 0.5), 0, -0.118, FR, 0.012));
    beard.add(onHead(faceSphere(0.17, "#e6e8ee", 1.6, 1.0, 0.5), 0, -0.37, FR, -0.03));
  } else {
    buildAnimalHead(head, animal, part);
    buildAnimalFaces(head, animal);
    buildAnimalBody(body, animal, part);
  }

  // 팔
  function armOf(x: number): Group {
    const g = new Group();
    g.position.set(x, 0.9, 0);
    body.add(g);
    if (animal === undefined) {
      part(g, new CylinderGeometry(0.101, 0.086, 0.4, 14), "coat").position.y = -0.2;
      part(g, new CylinderGeometry(0.088, 0.086, 0.039, 12), "shirt").position.y = -0.393;
      part(g, new SphereGeometry(0.1, 14, 10), "hand").position.y = -0.43;
    } else {
      const sleeve = new Group();
      sleeve.position.x = -Math.sign(x) * 0.026;
      sleeve.rotation.z = Math.sign(x) * 0.060;
      g.add(sleeve);
      part(sleeve, clothProfile(ANIMAL_SLEEVE_PROFILE, 16), "coat");
      part(sleeve, clothProfile([[0.074, -0.419], [0.085, -0.415], [0.094, -0.405], [0.100, -0.378], [0.092, -0.373]], 14), "coatLight");
      const hand = part(sleeve, new SphereGeometry(1, 14, 10), "hand");
      hand.position.y = -0.426;
      hand.scale.set(0.092, 0.088, 0.093);
    }
    return g;
  }
  const armA = armOf(0.37);
  const armB = armOf(-0.37);
  // 소품(오른손): 돋보기·카메라·지팡이
  const mag = tagged(new Group(), "prop:mag");
  mag.position.set(0, -0.48, 0.08);
  armB.add(mag);
  part(mag, new CylinderGeometry(0.025, 0.025, 0.2, 8), "#4a3a28").position.y = -0.05;
  part(mag, new TorusGeometry(0.1, 0.025, 8, 20), "#6b5236").position.y = -0.22;
  const glass = part(mag, new CircleGeometry(0.09, 20), "#9ec2ff");
  glass.position.y = -0.22;
  glass.userData.glass = true;
  const cam = tagged(new Group(), "prop:cam");
  cam.position.set(0, -0.5, 0.1);
  armB.add(cam);
  part(cam, new BoxGeometry(0.24, 0.15, 0.12), "#2b2f38");
  const lens = part(cam, new CylinderGeometry(0.05, 0.05, 0.08, 14), "#6b7180");
  lens.rotation.x = Math.PI / 2;
  lens.position.z = 0.08;
  const cane = tagged(new Group(), "prop:cane");
  cane.position.set(0, -0.45, 0.04);
  armB.add(cane);
  part(cane, new CylinderGeometry(0.025, 0.025, 0.5, 8), "#7a5236").position.y = -0.2;
  part(cane, new TorusGeometry(0.06, 0.022, 6, 12, Math.PI), "#7a5236").position.set(0.06, 0.05, 0);

  // 구워 내기: 부품마다 속한 관절 기준 좌표로 지오메트리를 옮긴다
  root.updateMatrixWorld(true);
  const jointNode: Record<JointName, Object3D> = { torso: body, head: neck, armA, armB, legA, legB };
  const owners: [JointName, Object3D][] = [
    ["head", neck],
    ["armA", armA],
    ["armB", armB],
    ["legA", legA],
    ["legB", legB],
  ];
  const out: Record<JointName, Part[]> = { torso: [], head: [], armA: [], armB: [], legA: [], legB: [] };
  const inv: Record<JointName, Matrix4> = {} as Record<JointName, Matrix4>;
  for (const j of JOINTS) inv[j] = jointNode[j].matrixWorld.clone().invert();
  root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    let joint: JointName = "torso";
    let tag = "always";
    let found = false;
    for (let p: Object3D | null = m; p; p = p.parent) {
      if (!found && typeof p.userData.tag === "string") {
        tag = p.userData.tag;
        found = true;
      }
    }
    for (const [name, node] of owners) {
      for (let p: Object3D | null = m; p; p = p.parent) {
        if (p === node) joint = name;
      }
    }
    const g = m.geometry.clone();
    g.applyMatrix4(inv[joint].clone().multiply(m.matrixWorld));
    const spec: string = m.userData.spec;
    const finish = (m.userData.finish as Finish | undefined) ?? (
      FABRIC_SLOTS.has(spec) || tag.startsWith("hat:") ? FINISH.cloth
        : spec === "shoe" || tag.startsWith("prop:") || tag.startsWith("badge:") || tag === "acc:shades" ? FINISH.smooth
          : FINISH.felt
    );
    if (animal !== undefined && !m.userData.glass) {
      const uv = g.getAttribute("uv");
      const pos = g.getAttribute("position");
      const coordinates = new Float32Array(pos.count * 2);
      const repeat = finish === FINISH.cloth ? 3 : 4;
      for (let i = 0; i < pos.count; i++) {
        coordinates[i * 2] = uv ? uv.getX(i) * repeat : (pos.getX(i) + pos.getZ(i) * 0.35) * 2;
        coordinates[i * 2 + 1] = uv ? uv.getY(i) * repeat : pos.getY(i) * 2;
      }
      g.setAttribute("animalUv", new Float32BufferAttribute(coordinates, 2));
    }
    g.deleteAttribute("uv");
    out[joint].push({ tag, slot: SLOTS.has(spec) ? spec : "fixed", color: SLOTS.has(spec) ? null : col(spec), geo: g, glass: m.userData.glass === true, finish });
  });
  return out;
}

const bakedFigs: (Record<JointName, Part[]> | undefined)[] = [];
function figParts(figIndex: number): Record<JointName, Part[]> {
  let b = bakedFigs[figIndex];
  if (!b) {
    b = bakeFig(FIGS[figIndex]);
    bakedFigs[figIndex] = b;
  }
  return b;
}

const bakedAnimals = new Map<AnimalId, { fig: Fig; parts: Record<JointName, Part[]> }>();
function animalParts(animal: AnimalId): { fig: Fig; parts: Record<JointName, Part[]> } {
  let accessory = bakedAnimals.get(animal);
  if (!accessory) {
    const { name, color } = ANIMALS[animal];
    const fig: Fig = { id: animal, name, style: "boy", hair: animalSkin(animal), hat: "", tie: color };
    accessory = { fig, parts: bakeFig(fig, animal) };
    bakedAnimals.set(animal, accessory);
  }
  return accessory;
}

/** 의상·표정에 따라 이 부품을 병합에 넣을지(원문 applyOutfit 의 visible 전환 규칙) */
function isShown(tag: string, o: Outfit, fig: Fig, face: string): boolean {
  const hat = o.hat === null ? fig.hat : o.hat;
  const cut = !!hat && hat !== "hood";
  const tie = o.tie === null ? fig.tie : o.tie;
  if (tag === "always") return true;
  if (tag === "tie") return !!tie;
  if (tag === "hair" || tag === "highFeather") return !cut;
  if (tag === "hatHair") return cut;
  if (tag === "bun") return !hat;
  if (tag === "ear") return hat !== "hood";
  const [kind, name] = tag.split(":");
  switch (kind) {
    case "badge":
      return name === o.badge;
    case "prop":
      return name === o.prop;
    case "hat":
      return name === hat;
    case "acc":
      return name === o.acc;
    case "face":
      return name === face;
    default:
      return false;
  }
}
function slotColor(p: Part, o: Outfit, fig: Fig, skin: string): Color {
  switch (p.slot) {
    case "coat":
      return col(o.coat);
    case "coatLight":
      return col(o.coat).clone().lerp(col("#bdb8ac"), 0.075);
    case "coatShade":
      return col(o.coat).clone().multiplyScalar(0.78);
    case "shirt":
      return col(o.shirt);
    case "pants":
      return col(o.pants);
    case "shoe":
      return col(o.shoe);
    case "skin":
      return col(skin);
    case "hand":
      return col(o.glove || skin);
    case "hair":
      return col(o.hair || fig.hair);
    case "tie":
      return col((o.tie === null ? fig.tie : o.tie) || fig.tie);
    default:
      return p.color as Color;
  }
}

/** 병합 결과 하나와 원래 색 배열(어둡게 껐다 켜기용) */
interface Merged {
  geo: BufferGeometry;
  base: Float32Array;
}

/** 한 관절의 보이는 부품을 버텍스 컬러로 병합한다(투명 조각은 제외) */
function mergeJoint(parts: readonly Part[], o: Outfit, fig: Fig, face: string, skin = SKIN, sculpted?: BufferGeometry): Merged {
  const list: BufferGeometry[] = sculpted === undefined ? [] : [sculpted];
  for (const p of parts) {
    if (sculpted && !p.tag.startsWith("hat:") && !p.tag.startsWith("acc:")) continue;
    if (p.glass || !isShown(p.tag, o, fig, face)) continue;
    const g = new BufferGeometry();
    const pos = p.geo.getAttribute("position");
    g.setAttribute("position", pos);
    g.setAttribute("normal", p.geo.getAttribute("normal"));
    const uv = p.geo.getAttribute("animalUv");
    if (uv) {
      g.setAttribute("animalUv", uv);
      g.setAttribute("animalFinish", new Float32BufferAttribute(new Float32Array(pos.count).fill(p.finish), 1));
    }
    g.setIndex(p.geo.index);
    const c = slotColor(p, o, fig, skin);
    const arr = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    g.setAttribute("color", new Float32BufferAttribute(arr, 3));
    list.push(g);
  }
  const geo = mergeGeometries(list, false);
  if (!geo) throw new Error("캐릭터 병합 실패");
  if (sculpted) geo.computeBoundingBox();
  return { geo, base: (geo.getAttribute("color").array as Float32Array).slice() };
}

// ---------- 자세 (원문 idlePose·walkPose·applyPose) ----------

type Pose = Record<PoseKey, number> & { face: string };

function idlePose(t: number, posX: number, fig: Fig): Pose {
  return { aAx: 0, aAz: 0.12, aBx: 0, aBz: -0.12, fA: 0, fB: 0, lA: 0, lB: 0, hx: 0, hy: 0, hz: Math.sin(t * 0.7 + posX) * 0.03, y: Math.sin(t * 2 + fig.name.length) * 0.012, s: 1, ry: 0, face: "base" };
}
function walkPose(walkPhase: number): Pose {
  const sw = Math.sin(walkPhase);
  return { aAx: sw * 0.5, aAz: 0.12, aBx: -sw * 0.5, aBz: -0.12, fA: 0, fB: 0, lA: -sw * 0.6, lB: sw * 0.6, hx: 0.04, hy: 0, hz: 0, y: Math.abs(Math.cos(walkPhase)) * 0.06, s: 1, ry: 0, face: "base" };
}

/** 두 자세의 숫자 키를 k(0~1)로 선형 보간한 새 자세. 표정은 기본이다 */
function blendPose(a: Pose, b: Pose, k: number): Pose {
  const out = { ...a };
  for (const key of EMOTE_KEYS) out[key] = a[key] + (b[key] - a[key]) * k;
  out.face = "base";
  return out;
}

/** 재생 중인 동작: id 와 시작 뒤 경과 시간 */
interface Emote {
  id: EmoteId;
  t: number;
  /** stopEmote 뒤 경과 시간(ms). null 이면 멈추는 중이 아니다 */
  stopT: number | null;
  /** 모션 줄이기 변형(O-5): 반복 2 이하, surprise·dance 의 몸 위아래(y) 진폭 절반 */
  reduced: boolean;
}
/** 원문 emotePose — 프레임 사이를 smoothstep(k = l²(3 − 2l))으로 잇고, 프레임에 없는 키는 base 자세 값을 쓴다 */
function emotePose(e: Emote, base: Pose): Pose {
  const d = EMOTES[e.id];
  const n = d.frames.length;
  const cycles = emoteCycles(e.id, e.reduced);
  const last = n * cycles - 1;
  const total = n * d.seg * cycles;
  const t = Math.min(e.t, total);
  const idx = Math.min(Math.floor(t / d.seg), last);
  const local = Math.min(1, (t - idx * d.seg) / d.seg);
  const fa = d.frames[idx % n];
  const fb = idx >= last ? fa : d.frames[(idx + 1) % n];
  const k = local * local * (3 - 2 * local);
  const out = { ...base };
  for (const key of EMOTE_KEYS) {
    const a = typeof fa[key] === "number" ? (fa[key] as number) : base[key];
    const b = typeof fb[key] === "number" ? (fb[key] as number) : base[key];
    out[key] = a + (b - a) * k;
  }
  // 모션 줄이기: 뛰어오름·몸 위아래는 서 있는 높이에서 벗어난 만큼의 절반만
  if (e.reduced && (e.id === "surprise" || e.id === "dance")) out.y = base.y + (out.y - base.y) * REDUCED_Y_SCALE;
  const face = k < 0.5 ? fa.face : fb.face;
  out.face = typeof face === "string" && face ? face : "base";
  return out;
}
/** 원문 emoteDone — 모든 프레임을 돌고 붙들기(hold)까지 끝났는지 */
function emoteDone(e: Emote): boolean {
  const d = EMOTES[e.id];
  return e.t > d.frames.length * d.seg * emoteCycles(e.id, e.reduced) + d.hold;
}

// ---------- 공개 모양 ----------

/** 6페이즈 로비 렌더러(06-10 CharacterKit)가 쓰는 구조 + 10페이즈의 의상·동작·표정 */
export interface WorldCharacter {
  root: Group;
  /** 한 프레임 움직인다(원문 animate). moving 이면 걷기, 아니면 숨쉬기. headY 는 이름표를 놓을 머리 꼭대기 높이 */
  update(dt: number, t: number, moving: boolean): { headY: number };
  /** 바라보는 방향(yaw = atan2(dx, dz)) */
  setYaw(yaw: number): void;
  /** 끊긴 사람 표시: 채도 0 + 밝기 × 0.6, 투명하게 만들지 않는다 */
  setDim(on: boolean): void;
  /** 의상 바꾸기(원문 applyOutfit) — 해당 관절만 다시 병합(캐시) */
  applyOutfit(id: OutfitId): void;
  /** 대기실에서 같은 자리의 동물을 바꾼다. 이동과 자세는 계속 이어진다. */
  applyAnimal(animal: AnimalId | undefined): void;
  /** 동작 재생(원문 playEmote). reduced 면 모션 줄이기 변형(반복 2 이하, surprise·dance 의 y 진폭 절반)이다 */
  playEmote(id: EmoteId, opts?: { reduced?: boolean }): void;
  /**
   * 재생 중인 동작을 POSE_BLEND_MS 에 걸쳐 서 있는 자세(유지 자세가 있으면 유지 자세)로 돌리고 끝낸다(10-03, D-13).
   * 방향(yaw)은 건드리지 않는다. 동작이 없으면 아무 일도 없다. 멈추는 중 playEmote 는 새 동작을 처음부터 시작한다
   */
  stopEmote(): void;
  /** 표정 바꾸기(원문 setFace) — 머리만 다시 병합(캐시). 모르는 이름은 기본 표정 */
  setFace(id: FaceId): void;
  /**
   * 유령(탈락한 사람, 0083-2): 켜면 관절 메시·투명 조각·발밑 원판을 숨기고 유령 그림 3D 묶음(산 캐릭터의 75%, 이동 방향을 본다) 하나를 캐릭터 뿌리에 세운다.
   * 로컬 높이 2.45(머리 꼭대기 = 화면에서 캐릭터만큼의 키)·폭 높이 × 0.75·아래 가운데가 발밑. opts.opacity 는 불투명도(기본 0.88), opts.tint 는 밝기 배율(회색, 기본 1)이다.
   * 켠 채 다시 부르면 준 값만 바꾼다. 끄면 스프라이트를 숨기고 몸·원판이 돌아온다.
   * 그림(setGhostArt)이 아직 없거나 불러오지 못했으면 스프라이트 없이 예전 반투명 몸(불투명도 0.6, 발광 없음)으로 대신하고, 그림이 오면 다음 update 부터 그림으로 바뀐다.
   */
  setGhost(on: boolean, opts?: GhostOpts & { animalForm?: boolean }): void;
  setDetailedHead(on: boolean): void;
  setHeadDensity(density: HeadDensity): void;
  setSeated(on: boolean, firstPerson: boolean): void;
  setGaze(yaw: number, pitch: number, pointYaw?: number): void;
  /** 유령일 때만 유령 그림(또는 대체 몸)의 불투명도를 바꾼다(유령이 아니면 무시) */
  setOpacity(alpha: number, allowLiving?: boolean): void;
  /**
   * 동작의 마지막 자세를 해제할 때까지 유지한다(DAY-04 손가락). POSE_BLEND_MS 에 걸쳐 섞여 들어가고 null 이면 섞여 나온다.
   * 유지 중 playEmote 는 유지 자세 위에서 한 번 재생되고 끝나면 유지로 돌아온다. 동작 표(characterData)는 바꾸지 않는다
   */
  holdPose(id: "point" | null): void;
  /** 발밑 고리 하나를 붙이거나(색 문자열) 뗀다(null). 이미 붙어 있으면 같은 메시의 색만 바꾼다 */
  setRing(color: string | null): void;
  /**
   * 마피아 밤 선택 표시(결정 0065): 켜면 관절 메시마다 붉은 뒷면 껍질(배율 PICK_SHELL_SCALE)을 붙여 몸 윤곽을 만든다.
   * animate 가 참이면 발밑 고리가 PICK_RING_FROM 배에서 PICK_LOCK_MS 에 걸쳐 1 배로 조여진 뒤 가볍게 맥박친다. 거짓(움직임 줄이기)이면 윤곽만 있고 고리는 늘 1 배다.
   * 끄면 껍질과 재질을 해제하고 고리 배율을 1 로 돌린다. 켠 채 다시 켜면 색·animate 만 바꾸고(조임은 처음부터 다시 하지 않는다) 껍질은 늘지 않는다.
   */
  setPickMark(on: boolean, opts?: { color: string; animate: boolean; pulseOutline?: boolean }): void;
  bodyMeshes(): readonly Mesh[];
  /** 머리 위에 받은 의심 고깔을 최대 세 개 쌓는다. animate 거짓이면 즉시 배치한다. */
  setNotes(fromSeats: readonly number[], opts: { animate: boolean }): void;
  setNoteView(yaw: number | undefined): void;
  /** 받은 의심 수(total)와 붙어 있는 고깔 메시 수(visible) */
  noteCounts(): { total: number; visible: number };
  /**
   * 동작이 쓰는 표정(angry·sus·surprise·happy·cry)의 머리 병합을 현재 의상으로 미리 만들어 캐시에 둔다(10-03, O-10). 보이는 표정은 바꾸지 않는다.
   * face 를 주면 그 표정 하나만 한다(동작이 쓰지 않는 이름은 무시). 이미 있으면 다시 만들지 않는다
   */
  prewarm(face?: FaceId): void;
  /** 이 캐릭터가 만든 병합 지오메트리 수(관절 6 + 머리 표정 변형 + 돋보기 유리). dispose 뒤 0 */
  ownedGeometryCount(): number;
  /** 지금 보이는 메시 수(관절 6 + 발밑 원판 + 투명 조각 + 붙은 종이) */
  meshCount(): number;
  /** 이 캐릭터가 만든 지오메트리를 해제한다. 공유 재질·발밑 원판은 건드리지 않는다 */
  dispose(): void;
}

/** 동작이 쓰는 표정 — 첫 동작 재생에서 머리 병합이 생기지 않게 유휴 시간에 미리 만든다(O-10) */
const PREWARM_FACES = ["angry", "sus", "surprise", "happy", "cry"] as const;

/** 유령 그림 값(0083-2): 불투명도(0~1)와 밝기 배율(0~1 회색). 주지 않은 값은 그대로 둔다(처음엔 0.88·1) */
export interface GhostOpts {
  opacity?: number;
  tint?: number;
}

// ---------- 3D 유령 (결정 0084: 2D 그림 → 3D 조립 유령) ----------

/** 3D 유령을 쓰나. 켜져 있는 것이 기본이고, false 면 예전 반투명 몸으로 대신한다(시험·비상용) */
let ghostArt = true;
/** 3D 유령이 준비됐나(E2E 훅 window.__mfGhosts 의 ready) — 불러올 파일이 없으니 늘 참이다 */
export function ghostArtReady(): boolean {
  return ghostArt;
}
/** 3D 유령 사용 여부를 정한다. null 이면 없는 것으로 돌아간다(대체 몸) */
export function setGhostArt(art: unknown): void {
  ghostArt = art !== null;
}

/** 유령 그림 기본 불투명도(presence.ts GHOST_SPRITE.opacity 와 같은 값) */
const GHOST_ART_OPACITY = 1;
/** 유령 그림의 로컬 높이(머리 꼭대기 값, update 의 headY 와 같다)와 폭 비(3:4) */
const GHOST_ART_H = 2.45;
/** 동작을 받은 유령이 한 번 튀는 높이(로컬)와 시간(ms) */
const GHOST_HOP_H = 0.18;
const GHOST_HOP_MS = 420;

/** 모든 캐릭터가 함께 쓰는 병합 재질(버텍스 컬러). 피부 0.7·놋쇠 금속감의 작은 차이는 합친다(가정 A1) */
const bodyMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.64, metalness: 0 });
/** 돋보기 유리처럼 투명한 조각만 따로 둔다(가정 A1) */
const glassMaterial = new MeshStandardMaterial({ color: "#9ec2ff", transparent: true, opacity: 0.6 });
const shadowMaterial = new MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.3, depthWrite: false });
const shadowGeometry = new CircleGeometry(0.42, 24);
/** 대체 몸(그림이 없을 때)의 불투명도(UI-SPEC 유령 모양, presence.ts GHOST_OPACITY 와 같은 값) */
const GHOST_DEFAULT_OPACITY = 0.6;
/** 발밑 고리 모양(그림자 원판 반지름 0.42 바깥) */
const RING_INNER = 0.5;
const RING_OUTER = 0.62;
const RING_OPACITY = 0.85;
/** 밤 선택 표시(결정 0065): 윤곽 껍질 배율, 고리가 조여지는 시작 배율·시간, 조여진 뒤 맥박의 크기·빠르기(시안 NightAim) */
const PICK_SHELL_SCALE = 1.14;
const PICK_RING_FROM = 2.4;
const PICK_LOCK_MS = 420;
const PICK_PULSE_AMP = 0.07;
const PICK_PULSE_RATE = 5;
/** 밤 선택 표시의 고리 배율: age(s) 동안 PICK_RING_FROM → 1 로 ease-out 으로 조여지고, 다 조여진 뒤에는 1 ± PICK_PULSE_AMP 로 맥박친다 */
function pickRingScale(age: number, t: number): number {
  const k = Math.min(1, (age * 1000) / PICK_LOCK_MS);
  const e = 1 - (1 - k) ** 3;
  const lock = PICK_RING_FROM - (PICK_RING_FROM - 1) * e;
  return k >= 1 ? 1 + Math.sin(t * PICK_PULSE_RATE) * PICK_PULSE_AMP : lock;
}
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** 병합 색을 원래대로 또는 어둡게(채도 0 + 휘도 × 0.6) 쓴다 */
function paint(m: Merged, dim: boolean): void {
  const a = m.geo.getAttribute("color");
  const arr = a.array as Float32Array;
  if (!dim) {
    arr.set(m.base);
  } else {
    const b = m.base;
    for (let i = 0; i < b.length; i += 3) {
      const g = (0.2126 * b[i] + 0.7152 * b[i + 1] + 0.0722 * b[i + 2]) * 0.6;
      arr[i] = arr[i + 1] = arr[i + 2] = g;
    }
  }
  a.needsUpdate = true;
}

/** 인물 번호에 맞는 모형을 만든다. 동물은 펠트·천의 재질을 공유한다. */
export function createCharacter(
  figIndex: number,
  outfit: OutfitId = "coat",
  portraitColors?: Partial<Pick<Outfit, "coat" | "shirt" | "tie" | "pants" | "shoe">>,
  animal?: AnimalId,
  { detailedHead = true, headDensity = "close" }: { detailedHead?: boolean; headDensity?: HeadDensity } = {},
): WorldCharacter {
  let outfitId: OutfitId = Object.hasOwn(OUTFITS, outfit) ? outfit : "coat";
  const figureForOutfit = (id: OutfitId) => id === "mafia" ? MAFIA_FIG_INDEX : figIndex;
  let visibleFigure = figureForOutfit(outfitId);
  let species = animal;
  const model = () => species !== undefined ? animalParts(species) : { fig: FIGS[visibleFigure], parts: figParts(visibleFigure) };
  const surfaceMaterial = () => species === undefined ? bodyMaterial : animalMaterial;
  const appearanceKey = () => `${species ?? visibleFigure}|${outfitId}`;
  const initialOutfit = outfitId;
  // 에셋 렌더에서만 카드 팔레트를 덮는다. 공개 의상 표와 지오메트리 캐시는 공유 상태를 바꾸지 않는다.
  const portraitOutfit = portraitColors === undefined ? undefined : { ...OUTFITS[initialOutfit], ...portraitColors };
  let face: KnownFaceId = "base";
  let lastPoseFace = "base";
  let dim = false;
  let disposed = false;
  let seated = false;
  let firstPerson = false;
  let gazeYaw = 0;
  let gazePitch = 0;
  let pointYaw = 0;
  /** 대체 몸(그림이 없는 유령)일 때만 있는 이 캐릭터 전용 복제 재질 */
  let ghostMat: MeshStandardMaterial | null = null;
  /** 유령 상태(켜짐·불투명도·밝기 배율)와 유령 그림 스프라이트(그림이 준비된 뒤 처음 켤 때 만든다) */
  let ghostOn = false;
  let animalGhost = false;
  let transitionMat: MeshStandardMaterial | null = null;
  let ghostAlpha = GHOST_ART_OPACITY;
  let ghostTint = 1;
  let sprite: Ghost3d | null = null;
  /** 유령이 동작을 받은 뒤 지난 시간(ms, null = 튀지 않음)과 그 동작이 모션 줄이기인지 */
  let hopAge: number | null = null;
  /** 발밑 고리(있을 때만) */
  let ring: Mesh | null = null;
  /** 밤 선택 표시: 켜짐 · 고리 조임·맥박 여부 · 켠 뒤 지난 시간(s) · 윤곽 껍질 재질과 껍질들(관절 메시마다 하나) */
  let pickOn = false;
  let pickAnimate = false;
  let pulseOutline = false;
  const pickColor = new Color();
  let pickAge = 0;
  let pickMat: MeshBasicMaterial | null = null;
  const pickShells = new Map<JointName, Mesh>();

  const root = new Group();
  root.scale.setScalar(CHAR_SCALE);
  const body = new Group();
  body.name = "body";
  root.add(body);
  /** 의심 고깔을 처음 받을 때 목 관절 아래에 별도의 리그를 붙인다. */
  let noteRig: NoteRig | null = null;
  let noteView: number | undefined;
  const disc = new Mesh(shadowGeometry, shadowMaterial);
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.012;
  disc.castShadow = false;
  root.add(disc);

  // 관절 그룹(원문과 같은 계층·피벗)과 그 안의 병합 메시
  const at: Record<Exclude<JointName, "torso">, [string, number, number]> = {
    head: ["neck", 0, 1.0],
    armA: ["armA", 0.37, 0.9],
    armB: ["armB", -0.37, 0.9],
    legA: ["legA", 0.13, 0.38],
    legB: ["legB", -0.13, 0.38],
  };
  const groups = { torso: body } as unknown as Record<JointName, Object3D>;
  for (const j of JOINTS) {
    if (j === "torso") continue;
    const [name, x, y] = at[j];
    const g = new Group();
    g.name = name;
    g.position.set(x, y, 0);
    body.add(g);
    groups[j] = g;
  }

  // 병합 캐시: 몸통·팔·다리는 의상 키, 머리는 (의상, 표정) 키. 이 캐릭터가 만든 지오메트리는 owned 에 모은다
  const cache = new Map<string, Merged>();
  const owned = new Set<BufferGeometry>();
  function merged(j: JointName, faceId: string = face): Merged {
    const detailed = j === "head" && species !== undefined && detailedHead;
    const key = j === "head" ? `${appearanceKey()}|${j}|${detailed ? headDensity : faceId}` : `${appearanceKey()}|${j}`;
    let m = cache.get(key);
    if (!m) {
      const colors = (outfitId === initialOutfit ? portraitOutfit : undefined) ?? OUTFITS[outfitId];
      const { fig, parts } = model();
      m = mergeJoint(parts[j], colors, fig, faceId, species === undefined ? SKIN : animalSkin(species),
        detailed ? detailedAnimalHead(species!, headDensity) : undefined);
      owned.add(m.geo);
      if (dim) paint(m, true);
      cache.set(key, m);
    }
    return m;
  }
  const meshes = {} as Record<JointName, Mesh>;
  for (const j of JOINTS) {
    const mesh = new Mesh(merged(j).geo, surfaceMaterial());
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    groups[j].add(mesh);
    meshes[j] = mesh;
  }

  // 투명 조각(돋보기 유리): 의상별 지오메트리를 한 번씩만 만든다
  const glassGeos = new Map<string, BufferGeometry>();
  let glassMesh: Mesh | null = null;
  function refreshGlass(): void {
    const o = OUTFITS[outfitId];
    const { fig, parts } = model();
    const shown = parts.armB.filter((p) => p.glass && isShown(p.tag, o, fig, face));
    if (shown.length === 0 || spriteShown()) {
      if (glassMesh) glassMesh.visible = false;
      return;
    }
    const key = appearanceKey();
    let geo = glassGeos.get(key);
    if (!geo) {
      const list = shown.map((p) => p.geo);
      geo = list.length === 1 ? list[0].clone() : (mergeGeometries(list, false) as BufferGeometry);
      owned.add(geo);
      glassGeos.set(key, geo);
    }
    if (!glassMesh) {
      glassMesh = new Mesh(geo, glassMaterial);
      glassMesh.castShadow = false;
      groups.armB.add(glassMesh);
    }
    glassMesh.geometry = geo;
    glassMesh.visible = true;
  }
  /** 지금 몸 대신 유령 그림이 보이나 */
  function spriteShown(): boolean {
    return ghostOn && ghostArt && !animalGhost;
  }
  refreshGlass();

  function detailExpression(): void {
    const geo = meshes.head.geometry;
    if (species === undefined || !detailedHead || (geo.userData.face ?? "base") === face) return;
    applyDetailedFace(geo, species, headDensity, face);
    geo.userData.face = face;
  }

  function fitNoteCrown(): void {
    if (!noteRig) return;
    const geometry = meshes.head.geometry;
    const positions = geometry.getAttribute("position");
    // 머리 가운데만 재서 토끼 귀나 가장자리 장식에 고깔이 올라가지 않게 한다.
    let crown = -Infinity;
    const radius = species === "rabbit" ? 0.06 : 0.16;
    for (let i = 0; i < positions.count; i++) {
      if (Math.abs(positions.getX(i)) <= radius && Math.abs(positions.getZ(i)) <= 0.12) {
        crown = Math.max(crown, positions.getY(i));
      }
    }
    if (crown === -Infinity) {
      if (geometry.boundingBox === null) geometry.computeBoundingBox();
      crown = geometry.boundingBox?.max.y ?? 1;
    }
    noteRig.setBaseY(crown - 0.025);
  }

  function refresh(js: readonly JointName[]): void {
    for (const j of js) {
      meshes[j].geometry = merged(j).geo;
      const shell = pickShells.get(j);
      if (shell) shell.geometry = meshes[j].geometry;
    }
    if (js.includes("head")) {
      detailExpression();
      fitNoteCrown();
    }
    refreshGlass();
  }
  /**
   * 의상을 바꾼 뒤 이전 의상의 병합·돋보기 유리 지오메트리를 해제한다(최근 의상 하나만 남긴다, UI-SPEC B-3, 위험 3).
   * refresh 가 보이는 메시와 pickShells 의 지오메트리를 이미 새 의상 것으로 바꾼 뒤에 부른다 — 해제된 것을 가리키는 메시는 없다.
   */
  function releaseOtherAppearances(): void {
    const keyPrefix = appearanceKey();
    for (const [key, m] of cache) {
      if (key.startsWith(`${keyPrefix}|`)) continue;
      m.geo.dispose();
      owned.delete(m.geo);
      cache.delete(key);
    }
    for (const [key, geo] of glassGeos) {
      if (key === keyPrefix) continue;
      geo.dispose();
      owned.delete(geo);
      glassGeos.delete(key);
    }
  }
  function dropPickShells(): void {
    for (const [j, shell] of pickShells) meshes[j].remove(shell);
    pickShells.clear();
    if (pickMat) {
      pickMat.dispose();
      pickMat = null;
    }
  }
  function showFace(id: string): void {
    const f = (FACE_IDS as readonly string[]).includes(id) ? id as KnownFaceId : "base";
    if (f === face) return;
    face = f;
    if (species !== undefined && detailedHead) detailExpression();
    else refresh(["head"]);
  }

  /** 지금 화면에 올린 유령 모습이 그림인가(그림이 나중에 오거나 사라지면 update 가 다시 맞춘다) */
  let appliedSprite = false;
  /** 유령 상태를 보이는 것에 맞춘다: 그림이 있으면 몸을 숨기고 스프라이트, 없으면 예전 반투명 몸(0.6) */
  function applyGhost(): void {
    if (!ghostOn) {
      if (ghostMat) {
        for (const j of JOINTS) meshes[j].material = surfaceMaterial();
        ghostMat.dispose();
        ghostMat = null;
      }
      for (const j of JOINTS) meshes[j].visible = true;
      if (sprite) sprite.root.visible = false;
      disc.visible = true;
      appliedSprite = false;
      refreshGlass();
      return;
    }
    disc.visible = false;
    if (spriteShown()) {
      if (ghostMat) {
        for (const j of JOINTS) meshes[j].material = surfaceMaterial();
        ghostMat.dispose();
        ghostMat = null;
      }
      for (const j of JOINTS) meshes[j].visible = false;
      if (!sprite) {
        sprite = buildGhost3d();
        sprite.root.scale.setScalar(GHOST_SCALE);
        root.add(sprite.root);
      }
      sprite.setOpacity(ghostAlpha);
      sprite.setTint(ghostTint);
      sprite.root.visible = true;
      appliedSprite = true;
      refreshGlass();
      return;
    }
    // 대체 몸: 그림이 오기 전·불러오기 실패 — 탈락자가 사라지지 않는다(T-18.1-42)
    if (sprite) sprite.root.visible = false;
    for (const j of JOINTS) meshes[j].visible = true;
    if (!ghostMat) {
      const source = animalGhost ? surfaceMaterial() : bodyMaterial;
      ghostMat = source.clone();
      ghostMat.onBeforeCompile = source.onBeforeCompile;
      ghostMat.customProgramCacheKey = source.customProgramCacheKey;
      ghostMat.transparent = true;
      ghostMat.depthWrite = false;
      for (const j of JOINTS) meshes[j].material = ghostMat;
    }
    ghostMat.opacity = Math.min(ghostAlpha, GHOST_DEFAULT_OPACITY);
    if (animalGhost) ghostMat.color.setScalar(ghostTint);
    appliedSprite = false;
    refreshGlass();
  }

  let walkPhase = 0;
  /** 걷기 자세가 섞인 비율(0 = 서 있는 자세, 1 = 걷기 자세). POSE_BLEND_MS 에 걸쳐 오간다 */
  let walkMix = 0;
  let emote: Emote | null = null;
  /** 유지하라고 한 동작(null = 해제 요청), 섞는 중 보이는 동작, 유지 자세가 섞인 비율(0~1, POSE_BLEND_MS 에 걸쳐 오간다) */
  let holdId: EmoteId | null = null;
  let holdShown: EmoteId | null = null;
  let holdMix = 0;
  function applyPose(p: Pose): void {
    groups.armA.rotation.set(p.aAx, 0, p.aAz);
    groups.armB.rotation.set(p.aBx, pointYaw, p.aBz, "YXZ");
    const shoulderTravel = species === undefined ? 1 : 0.66;
    // 반대편 좌석을 가리킬 때 소매가 가슴을 통과하지 않게 어깨를 옷 앞쪽으로 조금 옮긴다.
    const acrossChest = species === undefined || firstPerson ? 0 : Math.max(0, Math.sin(pointYaw)) * 0.13;
    groups.armA.position.z = p.fA * shoulderTravel + (firstPerson ? 0.31 : 0);
    groups.armB.position.z = p.fB * shoulderTravel + acrossChest + (firstPerson ? 0.29 : 0);
    groups.legA.rotation.x = p.lA;
    groups.legB.rotation.x = p.lB;
    groups.head.rotation.set(p.hx + gazePitch, p.hy + gazeYaw, p.hz);
    body.position.y = p.y;
    body.scale.set(1 + (1 - p.s) * 0.6, p.s, 1 + (1 - p.s) * 0.6);
    body.rotation.y = p.ry;
    // 자세가 정한 표정이 바뀔 때만 적용한다 — 서 있는 동안 바깥에서 정한 표정은 그대로 둔다
    if (p.face !== lastPoseFace) {
      lastPoseFace = p.face;
      showFace(p.face);
    }
  }

  return {
    root,
    update(dt, t, moving) {
      noteRig?.update(dt * 1000);
      if (ghostOn && spriteShown() !== appliedSprite) applyGhost(); // 그림이 나중에 왔다(또는 사라졌다)
      if (ghostOn && appliedSprite && sprite) {
        // 유령 그림: 몸 자세는 재생하지 않는다. 동작을 받았으면 한 번 통통 튄다
        if (hopAge !== null) {
          hopAge += dt * 1000;
          const k = hopAge / GHOST_HOP_MS;
          if (k >= 1) {
            hopAge = null;
            sprite.root.position.y = 0;
          } else sprite.root.position.y = Math.sin(Math.PI * k) * GHOST_HOP_H;
        }
        sprite.update(t);
        // 산 캐릭터처럼 이동 방향을 본다: 묶음은 root 의 자식이라 root.rotation.y 를 그대로 따른다(결정 0089-17, 0084-3 개정)
        return { headY: GHOST_ART_H * CHAR_SCALE * GHOST_SCALE };
      }
      if (moving) walkPhase += dt * WALK_PHASE_RATE;
      walkMix = Math.min(1, Math.max(0, walkMix + ((moving ? 1 : -1) * dt * 1000) / POSE_BLEND_MS));
      // 0 이하는 서 있는 자세 객체, 1 이상은 걷기 자세 객체 그대로(보간 오차 없음)
      const fig = species === undefined ? FIGS[visibleFigure] : animalParts(species).fig;
      const idle = idlePose(t, root.position.x, fig);
      const still = seated && !moving ? {
        ...idle, aAx: -1.33, aAz: 0.17, aBx: -1.30, aBz: -0.18, lA: -1.33, lB: -1.33,
        hx: 0.018, hz: 0, y: 0,
      } : idle;
      const base = walkMix >= 1 ? walkPose(walkPhase) : walkMix <= 0 ? still : blendPose(still, walkPose(walkPhase), walkMix);
      // 유지 자세: 동작의 마지막 프레임을 목표로 base 와 섞는다. 1 이상은 목표 그대로, 0 이하는 base 그대로(보간 오차 없음)
      holdMix = Math.min(1, Math.max(0, holdMix + ((holdId ? 1 : -1) * dt * 1000) / POSE_BLEND_MS));
      if (holdMix <= 0 && !holdId) holdShown = null;
      let held = base;
      if (holdShown && holdMix > 0) {
        const target = emotePose({ id: holdShown, t: Number.POSITIVE_INFINITY, stopT: null, reduced: false }, base);
        if (holdMix >= 1) held = target;
        else {
          held = blendPose(base, target, holdMix);
          if (holdMix >= 0.5) held.face = target.face;
        }
      }
      let pose = held;
      if (emote && moving) emote = null; // 걷기 시작하면 동작이 끊긴다
      if (emote) {
        if (emote.stopT !== null) {
          // 멈추는 중: 동작 시간은 멈춘 채 그 자세에서 held 로 POSE_BLEND_MS 에 걸쳐 섞는다. 1 이상은 held 그대로(보간 오차 없음)
          emote.stopT += dt * 1000;
          const k = emote.stopT / POSE_BLEND_MS;
          if (k >= 1) emote = null;
          else {
            const from = emotePose(emote, held);
            pose = blendPose(from, held, k);
            pose.face = k < 0.5 ? from.face : held.face;
          }
        } else {
          emote.t += dt;
          if (emoteDone(emote)) emote = null;
          else pose = emotePose(emote, held);
        }
      }
      applyPose(pose);
      if (noteRig) noteRig.face(noteView === undefined ? 0 : noteView - pose.ry - groups.head.rotation.y);
      // 밤 선택 표시의 고리: 켠 동안만 배율을 정한다(꺼진 뒤 한 번 1 로 돌리는 것은 setPickMark). 고리가 나중에 붙어도 이 줄이 맞춘다
      if (pickOn && pulseOutline && pickMat) {
        const pulse = pickAnimate ? 0.58 + 0.42 * (0.5 - 0.5 * Math.cos(t * Math.PI * 2 / 1.2)) : 0.86;
        pickMat.color.copy(pickColor).multiplyScalar(pulse);
      } else if (pickOn) {
        pickAge += dt;
        if (ring) ring.scale.setScalar(pickAnimate ? pickRingScale(pickAge, t) : 1);
      }
      const headTop = detailedHead && species !== undefined && meshes.head.geometry.boundingBox ? 1 + meshes.head.geometry.boundingBox.max.y : GHOST_ART_H;
      const noteTop = noteRig?.top();
      const tagAnchor = noteTop === undefined ? headTop : Math.max(headTop, groups.head.position.y + noteTop);
      return { headY: (tagAnchor + (ghostOn ? 0 : pose.y)) * CHAR_SCALE };
    },
    setYaw(yaw) {
      root.rotation.y = yaw;
    },
    setDetailedHead(on) {
      if (disposed || detailedHead === on) return;
      detailedHead = on;
      if (species !== undefined) refresh(["head"]);
    },
    setHeadDensity(density) {
      if (disposed || headDensity === density) return;
      headDensity = density;
      if (species !== undefined && detailedHead) refresh(["head"]);
    },
    setSeated(on, ownEye) {
      if (disposed) return;
      seated = on;
      if (firstPerson !== ownEye) {
        firstPerson = ownEye;
        for (const child of body.children) child.visible = !ownEye || child === groups.armA || child === groups.armB;
        disc.visible = !ownEye && !ghostOn;
      }
    },
    setGaze(yaw, pitch, aim = 0) {
      gazeYaw = yaw;
      gazePitch = pitch;
      pointYaw = aim;
    },
    setDim(on) {
      if (disposed || on === dim) return;
      dim = on;
      for (const m of cache.values()) paint(m, on);
    },
    applyOutfit(id) {
      if (disposed || !Object.hasOwn(OUTFITS, id) || id === outfitId) return;
      outfitId = id;
      visibleFigure = figureForOutfit(id);
      refresh(JOINTS);
      releaseOtherAppearances();
    },
    applyAnimal(next) {
      if (disposed || species === next) return;
      species = next;
      refresh(JOINTS);
      if (!ghostMat) for (const j of JOINTS) meshes[j].material = surfaceMaterial();
      releaseOtherAppearances();
    },
    playEmote(id, opts) {
      if (disposed || !Object.hasOwn(EMOTES, id)) return;
      // 유령 그림은 몸 자세가 없다 — 대신 한 번 튀어 "보냈는데 아무 일도 없음" 을 막는다(모션 줄이기면 없다)
      if (ghostOn && spriteShown()) {
        if (opts?.reduced !== true) hopAge = 0;
        return;
      }
      emote = { id, t: 0, stopT: null, reduced: opts?.reduced === true };
    },
    prewarm(faceId) {
      if (disposed || (species !== undefined && detailedHead)) return;
      for (const f of PREWARM_FACES) if (faceId === undefined || faceId === f) merged("head", f);
    },
    ownedGeometryCount() {
      return owned.size;
    },
    stopEmote() {
      if (emote && emote.stopT === null) emote.stopT = 0;
    },
    setFace(id) {
      if (!disposed) showFace(id);
    },
    setGhost(on, opts) {
      if (disposed) return;
      if (!on) {
        if (!ghostOn) return;
        ghostOn = false;
        animalGhost = false;
        hopAge = null;
        if (sprite) sprite.root.position.y = 0;
        applyGhost();
        return;
      }
      if (!ghostOn) {
        ghostOn = true;
        transitionMat?.dispose();
        transitionMat = null;
        ghostAlpha = GHOST_ART_OPACITY;
        ghostTint = 1;
        noteRig?.clear();
      }
      if (opts?.animalForm !== undefined && opts.animalForm !== animalGhost) {
        animalGhost = opts.animalForm;
        ghostMat?.dispose();
        ghostMat = null;
      }
      if (opts?.opacity !== undefined) ghostAlpha = clamp01(opts.opacity);
      if (opts?.tint !== undefined) ghostTint = clamp01(opts.tint);
      applyGhost();
    },
    holdPose(id) {
      if (disposed) return;
      if (id !== null && Object.hasOwn(EMOTES, id)) {
        holdId = id;
        holdShown = id;
      } else holdId = null;
    },
    setRing(color) {
      if (disposed) return;
      if (color === null) {
        if (!ring) return;
        root.remove(ring);
        ring.geometry.dispose();
        (ring.material as MeshBasicMaterial).dispose();
        ring = null;
        return;
      }
      if (!ring) {
        ring = new Mesh(new RingGeometry(RING_INNER, RING_OUTER, 32), new MeshBasicMaterial({ color, transparent: true, opacity: RING_OPACITY, depthWrite: false }));
        ring.name = "ring";
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.016; // 발밑 그림자 원판(0.012) 바로 위
        ring.castShadow = false;
        root.add(ring);
        return;
      }
      (ring.material as MeshBasicMaterial).color.set(color);
    },
    setPickMark(on, opts) {
      if (disposed) return;
      if (!on) {
        if (!pickOn) return;
        pickOn = false;
        pickAge = 0;
        dropPickShells();
        if (ring) ring.scale.setScalar(1);
        return;
      }
      const color = opts?.color ?? "#e0344b";
      const wasOn = pickOn;
      pickOn = true;
      pickAnimate = opts?.animate === true;
      pulseOutline = opts?.pulseOutline === true;
      if (!wasOn) pickAge = 0;
      if (!pickMat) pickMat = new MeshBasicMaterial({ color, side: BackSide });
      else pickMat.color.set(color);
      pickMat.toneMapped = !pulseOutline;
      pickColor.set(color);
      for (const j of JOINTS) {
        if (pickShells.has(j)) continue;
        const shell = new Mesh(meshes[j].geometry, pickMat);
        shell.userData.isOutline = true;
        shell.scale.setScalar(PICK_SHELL_SCALE);
        shell.castShadow = false;
        meshes[j].add(shell);
        pickShells.set(j, shell);
      }
      if (ring) ring.scale.setScalar(pickAnimate && !pulseOutline ? pickRingScale(pickAge, 0) : 1);
    },
    bodyMeshes() {
      return JOINTS.map((joint) => meshes[joint]);
    },
    setOpacity(alpha, allowLiving = false) {
      if (disposed) return;
      if (ghostOn) {
        ghostAlpha = clamp01(alpha);
        applyGhost();
      } else if (allowLiving && alpha < 1) {
        if (!transitionMat) {
          const source = surfaceMaterial();
          transitionMat = source.clone();
          transitionMat.onBeforeCompile = source.onBeforeCompile;
          transitionMat.customProgramCacheKey = source.customProgramCacheKey;
          transitionMat.transparent = true;
          transitionMat.depthWrite = false;
          for (const j of JOINTS) meshes[j].material = transitionMat;
        }
        transitionMat.opacity = clamp01(alpha);
      } else if (allowLiving && transitionMat) {
        for (const j of JOINTS) meshes[j].material = surfaceMaterial();
        transitionMat.dispose();
        transitionMat = null;
      }
    },
    setNotes(fromSeats, opts) {
      if (disposed || ghostOn) return;
      if (!noteRig) {
        if (fromSeats.length === 0) return;
        noteRig = createNoteRig(groups.head);
        fitNoteCrown();
      }
      noteRig.set(fromSeats, opts);
    },
    setNoteView(yaw) {
      noteView = yaw;
    },
    noteCounts() {
      return noteRig ? noteRig.counts() : { total: 0, visible: 0 };
    },
    meshCount() {
      let n = 0;
      root.traverse((x) => {
        if ((x as Mesh).isMesh && x.visible) n++;
      });
      return n;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      transitionMat?.dispose();
      transitionMat = null;
      noteRig?.detach();
      noteRig = null;
      if (ghostMat) {
        ghostMat.dispose();
        ghostMat = null;
      }
      if (sprite) {
        root.remove(sprite.root);
        sprite.dispose();
        sprite = null;
      }
      dropPickShells();
      if (ring) {
        root.remove(ring);
        ring.geometry.dispose();
        (ring.material as MeshBasicMaterial).dispose();
        ring = null;
      }
      for (const g of owned) g.dispose();
      owned.clear();
      cache.clear();
      glassGeos.clear();
    },
  };
}

/** 06-10 렌더러의 CharacterKit 모양에 맞춘 생성기 — 의상 id 를 모르면 기본 코트로 만든다 */
export const characterKit = {
  /** 유령 그림 텍스처가 준비됐나 — 런타임이 E2E 훅 window.__mfGhosts 의 ready 로 알린다 */
  ghostReady: ghostArtReady,
  create(figIndex: number, outfitId: string, animal?: AnimalId): WorldCharacter {
    return createCharacter(figIndex, Object.hasOwn(OUTFITS, outfitId) ? (outfitId as OutfitId) : "coat",
      undefined, animal, { headDensity: "world" });
  },
};
