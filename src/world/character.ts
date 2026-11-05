// 공유 재질(bodyMaterial 등)은 건드리지 않는다 — 반투명이 필요한 캐릭터만 복제 재질을 쓴다(RESEARCH Anti-Pattern, 08-10).
// 3D 조립 인물 — 원본 design/v2.0/blockout/character.js(r128 전역 THREE, 결정 0047·0048)를 three ES 모듈로 옮겼다.
// 지오메트리·위치·크기·색·자세는 원문과 같고, 그리기 묶음만 바꿨다: 부품(구·원통)을 관절 단위로
// 버텍스 컬러 병합해 한 명이 보이는 메시 6개(몸통·머리·팔 2·다리 2) + 발밑 원판 1개다(RESEARCH 개정 B).
import {
  BackSide,
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Object3D,
  RingGeometry,
  SphereGeometry,
  TorusGeometry,
  Uint32BufferAttribute,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { MOVE_SPEED } from "../../shared/game/world";
import { emoteCycles, REDUCED_Y_SCALE } from "./emoteCap";
import { EMOTE_KEYS, EMOTES, EYE, type EmoteId, FACE_IDS, type FaceId, type Fig, FIGS, MOUTH, type Outfit, OUTFITS, type OutfitId, type PoseKey, SKIN } from "./characterData";

/** 맵 위 크기 — 원래 키 약 2.1 단위를 약 1.7 로 줄여 쓴다 */
export const CHAR_SCALE = 0.83;
/** 걸음 위상 증가율(rad/s). 보드 기준 11 rad/s @ 1.245 단위/초를 로비 이동 속도에 비례시켜 발이 미끄러지지 않게 한다 */
export const WALK_PHASE_RATE = (11 * MOVE_SPEED) / 1.245;
/** 걷기·서기 전환 섞기(ms) — 결정 0059-3 짧은 자세 섞기 */
export const POSE_BLEND_MS = 120;

/** 인물 5명 중 자리 번호가 가리키는 인물 — 같은 방 같은 자리면 어느 폰에서나 같은 인물이다 */
export function figForSeat(seat: number): number {
  return ((seat % FIGS.length) + FIGS.length) % FIGS.length;
}

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
}

const SLOTS = new Set(["coat", "shirt", "tie", "pants", "shoe", "skin", "hand", "hair"]);
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
function part(parent: Object3D, geo: BufferGeometry, spec: string, tag?: string): Mesh {
  const m = new Mesh(geo, DUMMY);
  m.userData.spec = spec;
  if (tag) m.userData.tag = tag;
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
  const ex = 0.21;
  const ey = 0.02;
  let g = grp("base");
  for (const x of [-ex, ex]) g.add(onHead(faceSphere(0.058, EYE, 1, 1.25, 0.5), x, ey, R));
  g.add(onHead(arc(0.075, 0.018, MOUTH), 0, -0.16, R, 0.005, Math.PI));
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
  head.add(onHead(faceSphere(0.05, "#ef9a7c", 1, 1, 0.8), 0, -0.065, R, 0.01));
  for (const x of [-0.31, 0.31]) head.add(onHead(faceSphere(0.085, "#f2988a", 1.35, 0.8, 0.25), x, -0.11, R, 0));
}

// ---------- 모자 (원문 brimGeo·buildHats) ----------

/** 모자는 머리띠 높이 HAT_Y 에 얹는다. 챙은 아이소 카메라(약 36° 위)에서 눈을 가리지 않을 만큼만 내민다 */
const HAT_Y = 0.26;

/** 챙: 안쪽 반지름 rIn, 바깥은 각도 a(0 이 앞)마다 outR(a), bend(a, d) 는 안쪽에서 d 만큼 나간 곳의 높이 변화. 위·아래 면과 테두리를 한 메시로 */
function brimGeo(rIn: number, outR: (a: number) => number, a0: number, a1: number, thick: number, bend: (a: number, d: number) => number): BufferGeometry {
  const AS = 48;
  const RS = 4;
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

function buildHats(head: Object3D, F: number): void {
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
      brimGeo(F - 0.03, () => F + o.brim, -Math.PI, Math.PI, 0.035, (a, d) => {
        const c = Math.cos(a);
        return d * (c > 0 ? o.lift : o.lift - o.flip * c) + d * d * o.curl;
      }),
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
  add(g, brimGeo(F - 0.03, visorR(F, 0.22, 1.2), -1.2, 1.2, 0.03, (_a, d) => -d * 0.3), "#121a30", 0, HAT_Y + 0.012, 0, true);

  // 탐정 모자(디어스토커): 머리를 감싸는 둥근 몸통, 앞뒤 짧은 챙, 위로 묶어 올린 귀덮개와 매듭
  g = grp("deer");
  const Rd = Math.sqrt(F * F + HAT_Y * HAT_Y);
  add(g, new SphereGeometry(Rd, 32, 14, 0, Math.PI * 2, 0, Math.acos(HAT_Y / Rd)), "#8a6a45");
  for (const rot of [0, Math.PI]) {
    const v = add(g, brimGeo(F - 0.03, visorR(F, 0.17, 1.15), -1.15, 1.15, 0.03, (_a, d) => -d * 0.4), "#6b5236", 0, HAT_Y + 0.012, 0, true);
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
  add(g, brimGeo(F - 0.03, visorR(F, 0.18, 1.15), -1.15, 1.15, 0.03, (_a, d) => -d * 0.3), "#3a3f4b", 0, HAT_Y + 0.02, 0, true);

  // 후드: 머리카락보다 큰 두건. 앞은 이마부터 목까지 트고(가장자리 테), 아래는 어깨로 내려간다
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

interface HairSpec {
  r: number;
  sc: [number, number, number];
  phi: [number, number];
  th: [number, number];
  top?: boolean;
}

/** 원문 create(fig) 의 부품을 Mesh 대신 "지오메트리 + 색 + 보이기 이름" 으로 모은 관절별 목록 */
function bakeFig(fig: Fig): Record<JointName, Part[]> {
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
    const l = part(g, new CylinderGeometry(0.1, 0.1, 0.26, 12), "pants");
    l.position.y = -0.12;
    const s = part(g, new SphereGeometry(0.13, 14, 10), "shoe");
    s.scale.set(0.9, 0.55, 1.3);
    s.position.set(0, -0.25, 0.05);
    return g;
  }
  const legA = leg(0.13);
  const legB = leg(-0.13);

  // 몸통
  part(body, new CylinderGeometry(0.29, 0.39, 0.6, 24), "coat").position.y = 0.66;
  part(body, new SphereGeometry(0.39, 24, 10, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.18), "coat").position.y = 0.38;
  const shoulder = part(body, new SphereGeometry(0.3, 24, 14), "coat");
  shoulder.scale.set(1.18, 0.55, 1);
  shoulder.position.y = 0.94;
  const shirt = part(body, new ConeGeometry(0.12, 0.3, 3), "shirt");
  shirt.rotation.x = Math.PI;
  shirt.scale.set(1, 1, 0.25);
  shirt.position.set(0, 0.88, 0.27);
  const tie = part(body, new BoxGeometry(0.06, 0.24, 0.025), "tie", "tie");
  tie.position.set(0, 0.8, 0.305);
  tie.rotation.x = -0.18;
  for (const s of [-1, 1]) {
    const lap = part(body, new BoxGeometry(0.1, 0.32, 0.03), "coat");
    lap.position.set(s * 0.085, 0.88, 0.29);
    lap.rotation.set(-0.15, 0, s * 0.42);
  }
  for (const y of [0.68, 0.55]) part(body, new SphereGeometry(0.025, 8, 6), "#22252e").position.set(0.07, y, 0.33);
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
  head.position.y = 0.48;
  neck.add(head);
  const skull = part(head, new SphereGeometry(R, 32, 24), "skin");
  skull.scale.set(1.04, 0.96, 0.98);
  // 단발은 귀를 덮는다. 귀를 그리면 머리카락을 뚫고 나온다
  if (!girl) {
    for (const s of [-1, 1]) {
      const ear = part(head, new SphereGeometry(0.15, 14, 10), "skin", "ear");
      ear.scale.set(0.6, 1, 0.8);
      ear.position.set(s * (R + 0.02), 0, 0);
    }
  }
  // 머리카락 조각: r 반지름, sc 비율, phi·th 범위(phi = π/2 가 앞). top 은 정수리라 모자를 쓰면 통째로 감춘다
  const hair: HairSpec[] = girl
    ? [
        { r: R + 0.058, sc: [1.04, 1.02, 1], phi: [Math.PI / 2 - 1.1, 2.2], th: [0, Math.PI * 0.4], top: true },
        { r: R + 0.07, sc: [1.04, 1.02, 1], phi: [Math.PI / 2 - 1.05, 2.1], th: [Math.PI * 0.3, Math.PI * 0.16] },
        { r: R + 0.06, sc: [1.04, 1.02, 1], phi: [Math.PI / 2 + 1.05, Math.PI * 2 - 2.1], th: [0, Math.PI * 0.8] },
      ]
    : [
        { r: R + 0.035, sc: [1, 1, 1], phi: [0, Math.PI * 2], th: [0, Math.PI * 0.4], top: true },
        { r: R + 0.04, sc: [1, 1, 1], phi: [Math.PI / 2 - 1.15, 2.3], th: [Math.PI * 0.3, Math.PI * 0.16] },
        { r: R + 0.03, sc: [1, 1, 1], phi: [Math.PI / 2 + 1.2, Math.PI * 2 - 2.4], th: [0, Math.PI * 0.55] },
      ];
  function hairMesh(h: HairSpec, th0: number, th1: number, tag: string): void {
    const m = part(head, new SphereGeometry(h.r, 32, 16, h.phi[0], h.phi[1], th0, th1 - th0), "hair", tag);
    m.scale.set(h.sc[0], h.sc[1], h.sc[2]);
  }
  // 모자를 쓰면 띠(HAT_Y)보다 조금 위(HAT_CUT)를 잘라 낸 머리카락으로 바꾼다. 모자 둘레(fit)는 그 높이의 머리카락 바깥에 맞춘다
  const HAT_CUT = HAT_Y + 0.03;
  let fit = 1.04 * Math.sqrt(R * R - (HAT_Y / 0.96) ** 2);
  for (const h of hair) {
    hairMesh(h, h.th[0], h.th[0] + h.th[1], "hair");
    if (h.top) continue;
    const cut = Math.max(h.th[0], Math.acos(Math.min(1, HAT_CUT / h.sc[1] / h.r)));
    hairMesh(h, cut, h.th[0] + h.th[1], "hatHair");
    fit = Math.max(fit, h.sc[0] * Math.sqrt(h.r * h.r - (HAT_Y / h.sc[1]) ** 2));
  }
  buildFaces(head, R * 0.98, hair[1].r + 0.006);
  buildHats(head, fit + 0.012);

  // 선글라스·수염
  const FR = R * 0.98;
  const shades = tagged(new Group(), "acc:shades");
  const beard = tagged(new Group(), "acc:beard");
  head.add(shades);
  head.add(beard);
  for (const s of [-1, 1]) {
    shades.add(onHead(faceSphere(0.11, "#14161c", 1.15, 0.7, 0.3), s * 0.21, 0.03, FR, 0.025));
    const a = new Vector3(s * 0.33, 0.05, Math.sqrt(FR * FR - 0.33 * 0.33 - 0.0025) + 0.02);
    const b = new Vector3(s * (R + 0.01), 0.06, 0.04);
    const d = new Vector3().subVectors(b, a);
    const armM = part(shades, new CylinderGeometry(0.014, 0.014, d.length(), 6), "#14161c");
    armM.position.copy(a).addScaledVector(d, 0.5);
    armM.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), d.normalize());
  }
  shades.add(onHead(faceBox(0.14, 0.03, "#14161c"), 0, 0.06, FR, 0.03));
  beard.add(onHead(faceSphere(0.075, "#eef0f4", 1.9, 0.55, 0.5), 0, -0.118, FR, 0.012));
  beard.add(onHead(faceSphere(0.17, "#e6e8ee", 1.6, 1.0, 0.5), 0, -0.37, FR, -0.03));

  // 팔
  function armOf(x: number): Group {
    const g = new Group();
    g.position.set(x, 0.9, 0);
    body.add(g);
    part(g, new CylinderGeometry(0.085, 0.095, 0.4, 12), "coat").position.y = -0.2;
    part(g, new SphereGeometry(0.1, 14, 10), "hand").position.y = -0.43;
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
    g.deleteAttribute("uv");
    g.applyMatrix4(inv[joint].clone().multiply(m.matrixWorld));
    const spec: string = m.userData.spec;
    out[joint].push({ tag, slot: SLOTS.has(spec) ? spec : "fixed", color: SLOTS.has(spec) ? null : col(spec), geo: g, glass: m.userData.glass === true });
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

/** 의상·표정에 따라 이 부품을 병합에 넣을지(원문 applyOutfit 의 visible 전환 규칙) */
function isShown(tag: string, o: Outfit, fig: Fig, face: string): boolean {
  const hat = o.hat === null ? fig.hat : o.hat;
  const cut = !!hat && hat !== "hood";
  const tie = o.tie === null ? fig.tie : o.tie;
  if (tag === "always") return true;
  if (tag === "tie") return !!tie;
  if (tag === "hair") return !cut;
  if (tag === "hatHair") return cut;
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
function slotColor(p: Part, o: Outfit, fig: Fig): Color {
  switch (p.slot) {
    case "coat":
      return col(o.coat);
    case "shirt":
      return col(o.shirt);
    case "pants":
      return col(o.pants);
    case "shoe":
      return col(o.shoe);
    case "skin":
      return col(SKIN);
    case "hand":
      return col(o.glove || SKIN);
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
function mergeJoint(parts: readonly Part[], o: Outfit, fig: Fig, face: string): Merged {
  const list: BufferGeometry[] = [];
  for (const p of parts) {
    if (p.glass || !isShown(p.tag, o, fig, face)) continue;
    const g = new BufferGeometry();
    const pos = p.geo.getAttribute("position");
    g.setAttribute("position", pos);
    g.setAttribute("normal", p.geo.getAttribute("normal"));
    g.setIndex(p.geo.index);
    const c = slotColor(p, o, fig);
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
   * 유령(처형당한 사람): 이 캐릭터 관절 메시만 복제 재질(transparent·depthWrite false·opacity 기본 0.6)로 바꾸고 발밑 원판을 숨긴다.
   * 끄면 공유 재질로 돌아오고 복제 재질은 해제한다. 켠 채 다시 켜면 불투명도·발광만 바꾼다(GHOST-01).
   * glow(09.1-09, 안개 유령)가 있으면 복제 재질의 emissive·emissiveIntensity 를 정한다 — 색은 의상 원래 색을 두고 발광이 덮는다. 없으면 발광 0
   */
  setGhost(on: boolean, opacity?: number, glow?: GhostGlow): void;
  /** 유령일 때만 복제 재질의 불투명도를 바꾼다(유령이 아니면 무시) */
  setOpacity(alpha: number): void;
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
  setPickMark(on: boolean, opts?: { color: string; animate: boolean }): void;
  /**
   * 동작이 쓰는 표정(angry·sus·surprise·happy·cry)의 머리 병합을 현재 의상으로 미리 만들어 캐시에 둔다(10-03, O-10). 보이는 표정은 바꾸지 않는다.
   * face 를 주면 그 표정 하나만 한다(동작이 쓰지 않는 이름은 무시). 이미 있으면 다시 만들지 않는다
   */
  prewarm(face?: FaceId): void;
  /** 이 캐릭터가 만든 병합 지오메트리 수(관절 6 + 머리 표정 변형 + 돋보기 유리). dispose 뒤 0 */
  ownedGeometryCount(): number;
  /** 지금 보이는 메시 수(관절 6 + 발밑 원판 + 투명 조각) */
  meshCount(): number;
  /** 이 캐릭터가 만든 지오메트리를 해제한다. 공유 재질·발밑 원판은 건드리지 않는다 */
  dispose(): void;
}

/** 동작이 쓰는 표정 — 첫 동작 재생에서 머리 병합이 생기지 않게 유휴 시간에 미리 만든다(O-10) */
const PREWARM_FACES = ["angry", "sus", "surprise", "happy", "cry"] as const;

/** 안개 유령의 발광(09.1-09, 시안 GhostCostume 'mist'): 복제 재질의 emissive 색과 세기 */
export interface GhostGlow {
  color: string;
  intensity: number;
}

/** 모든 캐릭터가 함께 쓰는 병합 재질(버텍스 컬러). 피부 0.7·놋쇠 금속감의 작은 차이는 합친다(가정 A1) */
const bodyMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0 });
/** 돋보기 유리처럼 투명한 조각만 따로 둔다(가정 A1) */
const glassMaterial = new MeshStandardMaterial({ color: "#9ec2ff", transparent: true, opacity: 0.6 });
const shadowMaterial = new MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.3, depthWrite: false });
const shadowGeometry = new CircleGeometry(0.42, 24);
/** 유령 기본 불투명도(UI-SPEC 유령 모양, presence.ts GHOST_OPACITY 와 같은 값) */
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

/** 인물 figIndex(0~4)를 만든다 — 원문 MFChar.create. 병합 재질은 모든 캐릭터가 공유한다 */
export function createCharacter(figIndex: number, outfit: OutfitId = "coat"): WorldCharacter {
  const fig = FIGS[figIndex];
  const parts = figParts(figIndex);
  let outfitId: OutfitId = Object.hasOwn(OUTFITS, outfit) ? outfit : "coat";
  let face = "base";
  let lastPoseFace = "base";
  let dim = false;
  let disposed = false;
  /** 유령일 때만 있는 이 캐릭터 전용 복제 재질 */
  let ghostMat: MeshStandardMaterial | null = null;
  /** 발밑 고리(있을 때만) */
  let ring: Mesh | null = null;
  /** 밤 선택 표시: 켜짐 · 고리 조임·맥박 여부 · 켠 뒤 지난 시간(s) · 윤곽 껍질 재질과 껍질들(관절 메시마다 하나) */
  let pickOn = false;
  let pickAnimate = false;
  let pickAge = 0;
  let pickMat: MeshBasicMaterial | null = null;
  const pickShells = new Map<JointName, Mesh>();

  const root = new Group();
  root.scale.setScalar(CHAR_SCALE);
  const body = new Group();
  body.name = "body";
  root.add(body);
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
    const key = j === "head" ? `${j}|${outfitId}|${faceId}` : `${j}|${outfitId}`;
    let m = cache.get(key);
    if (!m) {
      m = mergeJoint(parts[j], OUTFITS[outfitId], fig, faceId);
      owned.add(m.geo);
      if (dim) paint(m, true);
      cache.set(key, m);
    }
    return m;
  }
  const meshes = {} as Record<JointName, Mesh>;
  for (const j of JOINTS) {
    const mesh = new Mesh(merged(j).geo, bodyMaterial);
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
    const shown = parts.armB.filter((p) => p.glass && isShown(p.tag, o, fig, face));
    if (shown.length === 0) {
      if (glassMesh) glassMesh.visible = false;
      return;
    }
    let geo = glassGeos.get(outfitId);
    if (!geo) {
      const list = shown.map((p) => p.geo);
      geo = list.length === 1 ? list[0].clone() : (mergeGeometries(list, false) as BufferGeometry);
      owned.add(geo);
      glassGeos.set(outfitId, geo);
    }
    if (!glassMesh) {
      glassMesh = new Mesh(geo, glassMaterial);
      glassMesh.castShadow = false;
      groups.armB.add(glassMesh);
    }
    glassMesh.geometry = geo;
    glassMesh.visible = true;
  }
  refreshGlass();

  function refresh(js: readonly JointName[]): void {
    for (const j of js) {
      meshes[j].geometry = merged(j).geo;
      const shell = pickShells.get(j);
      if (shell) shell.geometry = meshes[j].geometry;
    }
    refreshGlass();
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
    const f = (FACE_IDS as readonly string[]).includes(id) ? id : "base";
    if (f === face) return;
    face = f;
    refresh(["head"]);
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
    groups.armB.rotation.set(p.aBx, 0, p.aBz);
    groups.armA.position.z = p.fA;
    groups.armB.position.z = p.fB;
    groups.legA.rotation.x = p.lA;
    groups.legB.rotation.x = p.lB;
    groups.head.rotation.set(p.hx, p.hy, p.hz);
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
      if (moving) walkPhase += dt * WALK_PHASE_RATE;
      walkMix = Math.min(1, Math.max(0, walkMix + ((moving ? 1 : -1) * dt * 1000) / POSE_BLEND_MS));
      // 0 이하는 서 있는 자세 객체, 1 이상은 걷기 자세 객체 그대로(보간 오차 없음)
      const base = walkMix >= 1 ? walkPose(walkPhase) : walkMix <= 0 ? idlePose(t, root.position.x, fig) : blendPose(idlePose(t, root.position.x, fig), walkPose(walkPhase), walkMix);
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
      // 밤 선택 표시의 고리: 켠 동안만 배율을 정한다(꺼진 뒤 한 번 1 로 돌리는 것은 setPickMark). 고리가 나중에 붙어도 이 줄이 맞춘다
      if (pickOn) {
        pickAge += dt;
        if (ring) ring.scale.setScalar(pickAnimate ? pickRingScale(pickAge, t) : 1);
      }
      return { headY: (2.45 + pose.y) * CHAR_SCALE };
    },
    setYaw(yaw) {
      root.rotation.y = yaw;
    },
    setDim(on) {
      if (disposed || on === dim) return;
      dim = on;
      for (const m of cache.values()) paint(m, on);
    },
    applyOutfit(id) {
      if (disposed || !Object.hasOwn(OUTFITS, id) || id === outfitId) return;
      outfitId = id;
      refresh(JOINTS);
    },
    playEmote(id, opts) {
      if (!disposed && Object.hasOwn(EMOTES, id)) emote = { id, t: 0, stopT: null, reduced: opts?.reduced === true };
    },
    prewarm(faceId) {
      if (disposed) return;
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
    setGhost(on, opacity = GHOST_DEFAULT_OPACITY, glow) {
      if (disposed) return;
      if (!on) {
        if (!ghostMat) return;
        for (const j of JOINTS) meshes[j].material = bodyMaterial;
        ghostMat.dispose();
        ghostMat = null;
        disc.visible = true;
        return;
      }
      if (!ghostMat) {
        ghostMat = bodyMaterial.clone();
        ghostMat.transparent = true;
        ghostMat.depthWrite = false;
        for (const j of JOINTS) meshes[j].material = ghostMat;
        disc.visible = false;
      }
      ghostMat.opacity = clamp01(opacity);
      // 발광은 복제 재질에만 — 공유 재질(bodyMaterial)은 건드리지 않는다
      if (glow) {
        ghostMat.emissive.set(glow.color);
        ghostMat.emissiveIntensity = glow.intensity;
      } else {
        ghostMat.emissive.set(0x000000);
        ghostMat.emissiveIntensity = 0;
      }
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
      if (!wasOn) pickAge = 0;
      if (!pickMat) pickMat = new MeshBasicMaterial({ color, side: BackSide });
      else pickMat.color.set(color);
      for (const j of JOINTS) {
        if (pickShells.has(j)) continue;
        const shell = new Mesh(meshes[j].geometry, pickMat);
        shell.userData.isOutline = true;
        shell.scale.setScalar(PICK_SHELL_SCALE);
        shell.castShadow = false;
        meshes[j].add(shell);
        pickShells.set(j, shell);
      }
      if (ring) ring.scale.setScalar(pickAnimate ? pickRingScale(pickAge, 0) : 1);
    },
    setOpacity(alpha) {
      if (disposed || !ghostMat) return;
      ghostMat.opacity = clamp01(alpha);
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
      if (ghostMat) {
        ghostMat.dispose();
        ghostMat = null;
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
  create(figIndex: number, outfitId: string): WorldCharacter {
    return createCharacter(figIndex, Object.hasOwn(OUTFITS, outfitId) ? (outfitId as OutfitId) : "coat");
  },
};
