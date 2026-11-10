// 시계탑 광장 장면(maps/plaza.ts, MAP-06, 결정 D-22). design/v2.0/blockout/plaza.js 의 좌표·치수·색을 그대로 옮기되 bar.ts 와 같은 구조로 만든다:
//   재질별·버텍스 컬러 병합 · 그림자 한 번 · 점광원 3개(무대 위·가로등 하나·내 캐릭터) — 나머지 가로등은 emissive 와 빛 무리 쿼드로 표현한다.
// three 를 값으로 쓰므로 정적 import 경로에 두지 않는다(threeRenderer 와 함께 import() 로만 열린다). WebGL 없이 node 에서 만들어지고 검사된다.
// 핀 조명·긴장 연출·유령 안개·단계 조명은 재즈 바와 같은 규칙으로 돈다 — 새 연출 코드를 만들지 않고, 같은 인터페이스(MapScene)를 같은 의미로 구현한다.
//
// 그리기 단위(보이는 메시, 모두 병합):  1 shell(바닥 판·자갈 칸, 그림자 받기만)  2 furniture(연단·시계탑 몸·가로등 기둥·갓·건물 앞면·벤치 몸·나무 몸)
//   2b furnitureFar(벤치 다리·나무 가지)  3 brass(서는 자리 표시 8)  4 emissiveRoom(가로등 구)  4b emissiveRoomFar(건물 불 켜진 창)
//   5 emissiveTower(시계판 두 면·시계탑 조명 구, PhaseTune.emissive.vote 칸을 쓴다)  6 glowRoom(가로등 빛 무리)·glowTower(시계탑 조명 빛 무리, glow.vote 칸)
//   7 plate(연장 판)  8 hands(시계 바늘 4, 시침·분침 × 두 면).  강등 사다리 4단계(props reduced)는 2b·4b 를 끈다.
// 칸 이름 대응(PhaseTune 구조를 그대로 쓰기 위해): emissive.room/glow.room = 가로등, emissive.vote/glow.vote = 시계탑 조명(blockout 의 trial 그룹), stage = 무대 점광원, pendant = 가로등 점광원.
import {
  AdditiveBlending,
  BoxGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  Color,
  ConeGeometry,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  Material,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  Scene,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from "three";
import { cameraBasis, PLATE_FAR } from "../camera";
import { CHAR_SCALE } from "../character";
import { PLAZA_PALETTE as P, TOKEN_COLORS } from "../palette";
import type { Budget, LightingPhase } from "../renderer";
import { ALBEDO_NONE, albedoGrader, Bundle, CHALK_OPACITY, CHALK_POINTS, CHALK_RADIUS, makeGlowTexture, tf, under } from "./bar";
import type { MarkerRing, PhaseTune } from "./bar";
import type { MapScene } from "./types";

// ---------- 조명 시작값 ----------
// 단위 변환은 bar 와 같다(반구·방향광 = 시안 세기 × π, 점광원 = 시안 세기 × 4). 값은 기본값이고 육안 조정은 실기기 묶음(999.6)의 몫이다.
// 노출·점광 세기는 bar 의 같은 단계 값을 기준으로 두고, 반구·달빛의 상대 비율만 blockout plaza.js 의 env 를 따른다.
// 낮 = 회백~살짝 따뜻, 아침 = 서늘한 옅은 푸른빛, 저녁 = 노을(결정 0081-1, D-03). 재질 색은 albedo 로 단계마다 섞는다(18-12, G-18-1). 밤 쪽 행은 그대로.
// 하늘·안개 색은 모두 talk 의 같은 칸보다 밝지 않다 — 낮도 마피아 분위기(밝고 맑은 하늘 없음, 진홍 없음).
const LAMP_ON = 1.0 * 4;
export const PLAZA_LIGHT_TUNE: Readonly<Record<LightingPhase, PhaseTune>> & {
  point: {
    stage: { x: number; y: number; z: number; distance: number };
    pendantA: { x: number; y: number; z: number; distance: number };
    self: { x: number; y: number; z: number; distance: number };
    decay: number;
  };
  tension: { lead: number; halfRoom: number };
  moonPos: { x: number; y: number; z: number };
  moonTarget: { x: number; y: number; z: number };
} = {
  /** 흐린 낮: 가로등·시계탑 조명 꺼짐, 반구가 높다 */
  talk: {
    hemi: 1.05 * Math.PI,
    moon: 0.9 * Math.PI,
    moonColor: "#eadfd0",
    exposure: 1.25,
    sky: ["#c2beb6", "#6a665e", "#a29e96"],
    fog: { near: 20, far: 44 },
    stage: 0,
    pendant: 0,
    emissive: { room: 0, vote: 0 },
    glow: { room: 0, vote: 0 },
    self: 0,
    albedo: { tint: "#9a948a", mix: 0.45 },
  },
  /** 저녁 지목: 가로등 켜짐, 반구·달빛 낮춤, 무대 점광원이 연단을 비춘다 */
  vote: {
    hemi: 0.6 * Math.PI,
    moon: 0.4 * Math.PI,
    moonColor: "#d8b48a",
    exposure: 1.25,
    sky: ["#a8968e", "#3a2e2e", "#6a585a"],
    fog: { near: 20, far: 44 },
    stage: 2.0 * 4,
    pendant: LAMP_ON,
    emissive: { room: 1, vote: 0 },
    glow: { room: 1, vote: 0 },
    self: 0,
    albedo: { tint: "#8c766c", mix: 0.3 },
  },
  /** 변론·처형: 시계탑 조명(무대 점광원)이 연단의 변론자만 비춘다, 가로등은 거의 꺼짐 */
  trial: {
    hemi: 0.3 * Math.PI,
    moon: 0.2 * Math.PI,
    moonColor: TOKEN_COLORS.moon,
    exposure: 1.25,
    sky: ["#3a3464", "#1c1428", "#100d19"],
    fog: { near: 20, far: 44 },
    stage: 2.0 * 4,
    pendant: LAMP_ON * 0.06,
    emissive: { room: 0.06, vote: 1 },
    glow: { room: 0.06, vote: 1 },
    self: 0,
    albedo: ALBEDO_NONE,
  },
  /** 밤: 가로등 희미 + 달빛 */
  night: {
    hemi: 0.45 * Math.PI,
    moon: 0.7 * Math.PI,
    moonColor: TOKEN_COLORS.moon,
    exposure: 1.25,
    sky: ["#2c2c58", "#15122a", "#0a0b16"],
    fog: { near: 20, far: 44 },
    stage: 0,
    pendant: LAMP_ON * 0.7,
    emissive: { room: 0.7, vote: 0 },
    glow: { room: 0.7, vote: 0 },
    self: 0,
    albedo: ALBEDO_NONE,
  },
  /** 밤·산 시민 편: bar 와 같은 거의 깜깜한 광장 + 내 캐릭터 빛 */
  nightCitizen: {
    hemi: 0.05 * Math.PI,
    moon: 0.08 * Math.PI,
    moonColor: TOKEN_COLORS.moon,
    exposure: 0.75,
    sky: ["#1a1a36", "#0c0a1a", "#05060c"],
    fog: { near: 20, far: 44 },
    stage: 0,
    pendant: 0,
    emissive: { room: 0, vote: 0 },
    glow: { room: 0, vote: 0 },
    self: 1.4 * 4,
    albedo: ALBEDO_NONE,
  },
  /** 밤·유령: 마피아 화면(night)과 같은 달빛·반구·가로등, 모두 보인다 */
  nightGhost: {
    hemi: 0.45 * Math.PI,
    moon: 0.7 * Math.PI,
    moonColor: TOKEN_COLORS.moon,
    exposure: 1.25,
    sky: ["#2c2c58", "#15122a", "#0a0b16"],
    fog: { near: 20, far: 44 },
    stage: 0,
    pendant: LAMP_ON * 0.7,
    emissive: { room: 0.7, vote: 0 },
    glow: { room: 0.7, vote: 0 },
    self: 0,
    albedo: ALBEDO_NONE,
  },
  /** 아침: talk 와 같은 반구·낮은 달빛(18-07 렌더 측정으로 올림), 채도 낮은 흐린 하늘, 가로등은 이미 꺼져 있다 */
  morning: {
    hemi: 1.05 * Math.PI,
    moon: 0.7 * Math.PI,
    moonColor: "#e0dad8",
    exposure: 1.25,
    sky: ["#aab4c2", "#545c66", "#8a94a2"],
    fog: { near: 20, far: 44 },
    stage: 0,
    pendant: 0,
    emissive: { room: 0, vote: 0 },
    glow: { room: 0, vote: 0 },
    self: 0,
    albedo: { tint: "#8e98a6", mix: 0.35 },
  },
  tension: { lead: 2.0 * 4 * 1.5, halfRoom: 0.5 },
  point: {
    stage: { x: 0, y: 3.2, z: 0, distance: 6 },
    // 가로등 대표 하나: 모이는 자리 가까운 왼쪽 가로등 위. 나머지 셋은 emissive 와 빛 무리만 낸다
    pendantA: { x: -3.6, y: 2.4, z: 1.0, distance: 5 },
    self: { x: 0, y: 2.0, z: 0, distance: 4 },
    decay: 2,
  },
  // 시안 blockout.js: moon.position = (t0.x − 5, 12, t0.z + 7), target = t0 = (−1.8, −1.8)
  moonPos: { x: -6.8, y: 12, z: 5.2 },
  moonTarget: { x: -1.8, y: 0, z: -1.8 },
};

/** 시계 시침 목표 시각(시): setLighting 이 목표를 정하고 update 가 감쇠 3/초로 따라간다. trial 의 분침은 벽시계 30초 주기로 18.5~19 사이를 돈다 */
export const PLAZA_CLOCK_HOURS: Readonly<Record<LightingPhase, number>> = { talk: 13, vote: 18, trial: 18.75, night: 0, nightCitizen: 0, nightGhost: 0, morning: 6 };
const CLOCK_FOLLOW = 3;

/** 방 안 좌표 그대로(plaza.js) */
const TOWER = { x: -4.3, z: -4.3 } as const;
const LAMPS: readonly (readonly [number, number])[] = [
  [3.8, -2.4],
  [-2.4, 3.8],
  [-3.6, 1.0],
  [1.0, -3.6],
];
const SEAT_RADIUS = 2.6;

export function buildPlazaScene(budget: Budget): MapScene {
  const root = new Scene();

  // ----- 재질 -----
  const matProp = new MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
  const matBrass = new MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.5 });
  const matEmRoom = new MeshBasicMaterial({ vertexColors: true });
  const matEmTower = new MeshBasicMaterial({ vertexColors: true });
  const matHand = new MeshBasicMaterial({ color: P.clockHand });
  const glowMap = makeGlowTexture();
  const glowMat = (): MeshBasicMaterial =>
    new MeshBasicMaterial({ vertexColors: true, map: glowMap, transparent: true, blending: AdditiveBlending, depthWrite: false, fog: false });
  const matGlowRoom = glowMat();
  const matGlowTower = glowMat();
  const matPlate = new MeshStandardMaterial({ color: P.floor, roughness: 0.85, metalness: 0 });

  // ----- 묶음 -----
  const shell = new Bundle();
  const furniture = new Bundle();
  const furnitureFar = new Bundle();
  const brass = new Bundle();
  const emRoom = new Bundle();
  const emRoomFar = new Bundle();
  const emTower = new Bundle();
  const glowRoom = new Bundle(true);
  const glowTower = new Bundle(true);

  const basis = cameraBasis();
  const facing = new Matrix4().makeBasis(new Vector3(basis.right.x, basis.right.y, basis.right.z), new Vector3(basis.up.x, basis.up.y, basis.up.z), new Vector3(basis.back.x, basis.back.y, basis.back.z));
  const glow = (b: Bundle, hex: string, size: number, x: number, y: number, z: number, k: number): void => {
    const m = facing.clone().setPosition(x, y, z);
    b.add(new PlaneGeometry(size, size), hex, m, 1, k);
  };

  // 바닥 판 40 × 40(y −0.06, 높이 0.1)과 자갈 14 × 14 칸(칸 0.96, 높이 0.08, 색 3가지 순환)
  shell.box(40, 0.1, 40, P.floor, tf(0, -0.06, 0));
  for (let ix = 0; ix < 14; ix++) for (let iz = 0; iz < 14; iz++) shell.box(0.96, 0.08, 0.96, P.cobbles[(ix * 3 + iz * 5) % 3]!, tf(-6.5 + ix, 0.04, -6.5 + iz));

  // 연단: 아래 단 반지름 1.4/1.45 높이 0.18, 위 단 1.05/1.08 높이 0.2(윗면 0.46)
  furniture.cyl(1.4, 1.45, 0.18, 48, P.daisLow, tf(0, 0.17, 0));
  furniture.cyl(1.05, 1.08, 0.2, 48, P.daisHigh, tf(0, 0.36, 0));

  // 서는 자리 8개: 놋쇠 표시(반지름 2.6 원 위 8등분, 첫 자리는 카메라 쪽)
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 4 + (i / 8) * Math.PI * 2;
    brass.cyl(0.36, 0.36, 0.02, 24, P.brass, tf(Math.sin(a) * SEAT_RADIUS, 0.09, Math.cos(a) * SEAT_RADIUS));
  }

  // 시계탑(뒤 구석): 상자 셋과 띠 둘, 사각뿔 지붕
  const tw = tf(TOWER.x, 0, TOWER.z);
  furniture.box(2.6, 0.8, 2.6, P.stoneL, under(tw, tf(0, 0.4, 0)));
  furniture.box(2.0, 1.6, 2.0, P.stoneD, under(tw, tf(0, 1.6, 0)));
  furniture.box(2.4, 1.9, 2.4, P.stoneL, under(tw, tf(0, 3.35, 0)));
  furniture.box(2.6, 0.18, 2.6, P.cream, under(tw, tf(0, 2.4, 0)));
  furniture.box(2.6, 0.18, 2.6, P.cream, under(tw, tf(0, 4.3, 0)));
  furniture.add(new ConeGeometry(1.8, 1.4, 4), P.roof, under(tw, tf(0, 5.1, 0, 0, Math.PI / 4, 0)));
  // 시계판 두 면(원 반지름 0.72, 발광 크림색): 앞(+z)면과 옆(+x)면
  const faces: readonly (readonly [number, number, number])[] = [
    [0, 1.21, 0],
    [1.21, 0, Math.PI / 2],
  ];
  for (const [fx, fz, ry] of faces) emTower.add(new CircleGeometry(0.72, 40), P.clockFace, under(tw, tf(fx, 3.35, fz, 0, ry, 0)), 1);
  // 시계탑 조명: 변론 때 연단을 비춘다(구 + 빛 무리)
  emTower.sph(0.14, P.flood, under(tw, tf(1.25, 4.5, 1.25)), 1.6);
  glow(glowTower, P.flood, 1.3, TOWER.x + 1.25, 4.5, TOWER.z + 1.25, 0.8);

  // 시계 바늘 4개: 시침(0.06 × 0.4)·분침(0.04 × 0.58), 면마다 한 쌍. 피벗이 밑동이라 지오메트리를 위로 옮겨 두고 z 축으로 돌린다
  const hourHands: Mesh[] = [];
  const minuteHands: Mesh[] = [];
  const handsGroup = new Group();
  handsGroup.name = "hands";
  handsGroup.position.set(TOWER.x, 0, TOWER.z);
  faces.forEach(([fx, fz, ry], i) => {
    const fg = new Group();
    fg.position.set(fx, 3.35, fz);
    fg.rotation.y = ry;
    handsGroup.add(fg);
    const hour = new Mesh(new BoxGeometry(0.06, 0.4, 0.02).translate(0, 0.17, 0), matHand);
    hour.name = `handHour${i}`;
    hour.position.z = 0.02;
    const minute = new Mesh(new BoxGeometry(0.04, 0.58, 0.02).translate(0, 0.26, 0), matHand);
    minute.name = `handMinute${i}`;
    minute.position.z = 0.03;
    fg.add(hour, minute);
    hourHands.push(hour);
    minuteHands.push(minute);
  });

  // 가로등 4개: 기둥 높이 2.6, 갓 0.3, 발광 구 반지름 0.13 y 2.6
  for (const [x, z] of LAMPS) {
    furniture.cyl(0.06, 0.08, 2.6, 8, P.lampPost, tf(x, 1.3, z));
    furniture.cyl(0.16, 0.12, 0.3, 8, P.lampPost, tf(x, 2.7, z));
    emRoom.sph(0.13, P.lampBulb, tf(x, 2.6, z), 1.5);
    glow(glowRoom, P.lampBulb, 1.4, x, 2.6, z, 0.7);
  }

  // 건물 앞면 4(뒤 두 가장자리): 몸 + 지붕띠 + 창 칸(일부만 발광)
  const facade = (x: number, z: number, w: number, h: number, ry: number, body: string): void => {
    const g = tf(x, 0, z, 0, ry, 0);
    furniture.box(w, h, 1.2, body, under(g, tf(0, h / 2, 0)));
    furniture.box(w + 0.1, 0.16, 1.3, P.facadeCap, under(g, tf(0, h, 0)));
    for (let fx = 0; fx < Math.floor(w / 0.9); fx++) {
      for (let fy = 0; fy < Math.floor((h - 1) / 1.1); fy++) {
        const lit = (fx * 7 + fy * 3 + Math.round(x)) % 4 === 0;
        const m = under(g, tf(-w / 2 + 0.45 + fx * 0.9, 1.4 + fy * 1.1, 0.61));
        if (lit) emRoomFar.add(new PlaneGeometry(0.4, 0.6), P.paneLit, m, 0.5);
        else furniture.add(new PlaneGeometry(0.4, 0.6), P.paneDark, m);
      }
    }
  };
  facade(-1.0, -7.4, 4.2, 4.6, 0, P.facades[0]!);
  facade(3.4, -7.4, 3.6, 3.8, 0, P.facades[1]!);
  facade(-7.4, -0.6, 4.2, 4.2, Math.PI / 2, P.facades[2]!);
  facade(-7.4, 3.6, 3.6, 5.0, Math.PI / 2, P.facades[3]!);

  // 벤치 2: 앉는 널·등널은 몸, 다리는 먼 소품
  for (const [bx, bz, bry] of [
    [4.6, -3.4, 0],
    [-3.4, 4.6, Math.PI / 2],
  ] as const) {
    const g = tf(bx, 0.08, bz, 0, bry, 0);
    furniture.box(1.4, 0.08, 0.42, P.bench, under(g, tf(0, 0.42, 0)));
    furniture.box(1.4, 0.3, 0.06, P.bench, under(g, tf(0, 0.66, -0.18)));
    for (const lx of [-0.6, 0.6]) furnitureFar.box(0.06, 0.42, 0.36, P.benchLeg, under(g, tf(lx, 0.21, 0)));
  }
  // 나무 2: 화단 + 줄기는 몸, 가지는 먼 소품
  for (const [tx, tz] of [
    [-4.6, 4.4],
    [4.4, -4.6],
  ] as const) {
    furniture.box(0.9, 0.4, 0.9, P.planter, tf(tx, 0.28, tz));
    furniture.cyl(0.07, 0.11, 1.9, 7, P.treeDark, tf(tx, 1.4, tz));
    for (const [bx, by, bz, bk] of [
      [0.4, 1.9, 0.2, 0.7],
      [-0.5, 2.1, -0.3, 0.6],
      [0.2, 2.5, -0.5, 0.5],
    ] as const)
      furnitureFar.cyl(0.025, 0.05, 1.0, 6, P.treeDark, tf(tx + bx / 2, by, tz + bz / 2, bz, 0, -bk));
  }

  // ----- 메시 만들기 -----
  const meshes: Record<string, Mesh> = {
    shell: shell.build(matProp, "shell"),
    furniture: furniture.build(matProp, "furniture"),
    furnitureFar: furnitureFar.build(matProp, "furnitureFar"),
    brass: brass.build(matBrass, "brass"),
    emissiveRoom: emRoom.build(matEmRoom, "emissiveRoom"),
    emissiveRoomFar: emRoomFar.build(matEmRoom, "emissiveRoomFar"),
    emissiveTower: emTower.build(matEmTower, "emissiveTower"),
    glowRoom: glowRoom.build(matGlowRoom, "glowRoom"),
    glowTower: glowTower.build(matGlowTower, "glowTower"),
  };
  meshes.shell!.receiveShadow = true;
  for (const n of ["furniture", "furnitureFar"] as const) {
    meshes[n]!.castShadow = true;
    meshes[n]!.receiveShadow = true;
  }
  meshes.brass!.castShadow = true;
  meshes.brass!.receiveShadow = true;
  // 빛 무리는 투명 합성이라 불투명 메시 뒤에 그린다
  meshes.glowRoom!.renderOrder = 2;
  meshes.glowTower!.renderOrder = 2;
  for (const m of Object.values(meshes)) root.add(m);
  // 재질 보정(18-12): 조명을 받는 정점 색 묶음과 연장 판 재질 color 를 단계가 바뀔 때만 다시 쓴다
  const grade = albedoGrader([meshes.shell!, meshes.furniture!, meshes.furnitureFar!], [matPlate]);
  let gradedFor: LightingPhase | null = null;
  root.add(handsGroup);
  for (const h of [...hourHands, ...minuteHands]) meshes[h.name] = h;

  // 분필 윤곽: 처음부터 만들어 두고 숨긴다(bar 와 같은 모양·규칙)
  const chalk = new Mesh(
    new TubeGeometry(
      new CatmullRomCurve3(
        CHALK_POINTS.map(([px, pz]) => new Vector3(px * CHAR_SCALE, 0, -pz * CHAR_SCALE + 0.75 * CHAR_SCALE)),
        true,
        "catmullrom",
        0.2,
      ),
      120,
      CHALK_RADIUS,
      6,
      true,
    ),
    new MeshBasicMaterial({ color: "#e8e6dc", transparent: true, opacity: CHALK_OPACITY }),
  );
  chalk.name = "chalk";
  chalk.rotation.y = 0.7;
  chalk.visible = false;
  chalk.castShadow = false;
  chalk.receiveShadow = false;
  meshes.chalk = chalk;
  root.add(chalk);

  // 연장 판: 바닥 판(윗면 −0.01, 아랫면 −0.11) 바로 아래의 정사각형 한 장 — 바닥 판 밖(걸을 수 없는 영역)을 어둠으로 채운다
  const plate = new Mesh(new PlaneGeometry(PLATE_FAR * 2, PLATE_FAR * 2), matPlate);
  plate.name = "plate";
  plate.rotation.x = -Math.PI / 2;
  plate.position.y = -0.115;
  plate.receiveShadow = false;
  meshes.plate = plate;
  root.add(plate);

  // 링·손짓 링: bar 와 같은 두 겹
  const makeMarker = (): MarkerRing => {
    const group = new Group();
    group.position.y = 0.02;
    group.visible = false;
    const ring = new Mesh(new TorusGeometry(0.45, 0.04, 8, 40), new MeshBasicMaterial({ color: TOKEN_COLORS.ring, transparent: true, depthWrite: false }));
    const outline = new Mesh(new TorusGeometry(0.5, 0.05, 8, 40), new MeshBasicMaterial({ color: TOKEN_COLORS.ringOutline, transparent: true, opacity: 0.6, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    outline.rotation.x = -Math.PI / 2;
    ring.position.y = 0.012;
    outline.position.y = -0.008;
    ring.renderOrder = 4;
    outline.renderOrder = 3;
    group.add(outline, ring);
    root.add(group);
    return { group, ring, outline };
  };
  const markers = { ring: makeMarker(), cue: makeMarker() };

  // ----- 조명 -----
  const T = PLAZA_LIGHT_TUNE;
  const hemi = new HemisphereLight(T.talk.sky[0], T.talk.sky[1], T.talk.hemi);
  const moon = new DirectionalLight(T.talk.moonColor, T.talk.moon);
  moon.position.set(T.moonPos.x, T.moonPos.y, T.moonPos.z);
  moon.target.position.set(T.moonTarget.x, T.moonTarget.y, T.moonTarget.z);
  moon.castShadow = budget.shadowMap !== 0;
  const shadowSize = budget.shadowMap === 0 ? 1024 : budget.shadowMap;
  moon.shadow.mapSize.set(shadowSize, shadowSize);
  moon.shadow.bias = -0.0015;
  const sc = moon.shadow.camera;
  sc.left = -12;
  sc.right = 12;
  sc.top = 12;
  sc.bottom = -12;
  sc.near = 1;
  sc.far = 60;
  const point = (c: { x: number; y: number; z: number; distance: number }): PointLight => {
    const l = new PointLight(TOKEN_COLORS.lamp, 0, c.distance, T.point.decay);
    l.position.set(c.x, c.y, c.z);
    return l;
  };
  const stage = point(T.point.stage);
  stage.color.set(P.lampBulb);
  const pendantA = point(T.point.pendantA);
  // 내 캐릭터 빛: 세기 0 으로 처음부터 만든다 — 광원 수가 변하지 않아 셰이더를 다시 컴파일하지 않는다(연구 Pitfall 7)
  const self = point(T.point.self);
  root.add(hemi, moon, moon.target, stage, pendantA, self);

  const background = new Color(T.talk.sky[2]);
  const fog = new Fog(T.talk.sky[2], T.talk.fog.near, T.talk.fog.far);
  root.background = background;
  root.fog = fog;

  let exposure = T.talk.exposure;
  let disposed = false;
  let current = budget;
  let phase: LightingPhase = "talk";
  let tensionLevel: 0 | 1 | 2 = 0;
  let tensionFocus: { x: number; z: number } | null = null;
  let pinState: { x: number; z: number; strength: number } | null = null;
  let pinDim = 1;
  const base = { stage: 0, x: T.point.stage.x, z: T.point.stage.z, room: 0, vote: 0 };
  // 시계 탑 발광은 꺼진 단계에도 시계판이 읽히게 바닥값을 둔다(0 이면 까만 원판이 된다)
  const TOWER_FLOOR = 0.25;

  const applyPin = (): void => {
    if (pinState === null) {
      stage.intensity = base.stage;
      stage.position.set(base.x, T.point.stage.y, base.z);
      matEmRoom.color.setScalar(base.room);
      matEmTower.color.setScalar(TOWER_FLOOR + (1 - TOWER_FLOOR) * base.vote);
      return;
    }
    const k = Math.min(1, Math.max(0, pinState.strength));
    stage.intensity = base.stage + (T.tension.lead - base.stage) * k;
    stage.position.set(pinState.x, T.point.stage.y, pinState.z);
    matEmRoom.color.setScalar(base.room * pinDim);
    matEmTower.color.setScalar(TOWER_FLOOR + (1 - TOWER_FLOOR) * base.vote * pinDim);
  };

  const applyLook = (): void => {
    const t = T[phase];
    const b = current;
    if (gradedFor !== phase) {
      grade(t.albedo);
      gradedFor = phase;
    }
    hemi.color.set(t.sky[0]);
    hemi.groundColor.set(t.sky[1]);
    hemi.intensity = t.hemi;
    background.set(t.sky[2]);
    fog.color.set(t.sky[2]);
    fog.near = t.fog.near;
    fog.far = t.fog.far;
    moon.intensity = t.moon;
    moon.color.set(t.moonColor);
    self.intensity = t.self;
    const lead = tensionLevel >= 1;
    base.stage = lead ? T.tension.lead : t.stage;
    if (lead && tensionFocus) {
      base.x = tensionFocus.x;
      base.z = tensionFocus.z;
    } else {
      base.x = T.point.stage.x;
      base.z = T.point.stage.z;
    }
    // 점광원 core: 가로등 점광원은 세기 0 + 장면 광원 목록에서 뺀다(셰이더 광원 수가 줄어든다). 나머지 가로등과 같이 emissive·빛 무리가 이미 낸다
    const lamp = b.lights === "full" ? t.pendant : 0;
    pendantA.intensity = lamp;
    pendantA.visible = b.lights === "full";
    base.room = t.emissive.room * (tensionLevel === 2 ? T.tension.halfRoom : 1);
    base.vote = t.emissive.vote;
    applyPin();
    matGlowRoom.opacity = t.glow.room;
    matGlowTower.opacity = t.glow.vote;
    meshes.glowRoom!.visible = b.glows && t.glow.room > 0;
    meshes.glowTower!.visible = b.glows && t.glow.vote > 0;
    root.fog = b.fog ? fog : null;
    exposure = t.exposure;
  };

  // ----- 시계: setLighting 이 목표를 정하고 update 틱이 따라간다 -----
  let clockShown = PLAZA_CLOCK_HOURS.talk;
  let clockWant = PLAZA_CLOCK_HOURS.talk;
  const setHands = (): void => {
    const hr = -((clockShown % 12) / 12) * Math.PI * 2;
    const mn = -(clockShown % 1) * Math.PI * 2;
    for (const h of hourHands) h.rotation.z = hr;
    for (const m of minuteHands) m.rotation.z = mn;
  };
  setHands();
  const update = (dt: number, t: number): void => {
    if (disposed) return;
    // 변론 때는 분침이 벽시계 30초 주기로 18.5~19 사이를 돈다
    const goal = phase === "trial" ? 18.5 + ((((t % 30) + 30) % 30) / 30) * 0.5 : clockWant;
    clockShown += (goal - clockShown) * Math.min(1, Math.max(0, dt) * CLOCK_FOLLOW);
    setHands();
  };

  const setLighting = (next: LightingPhase): void => {
    phase = next;
    clockWant = PLAZA_CLOCK_HOURS[next];
    applyLook();
  };
  const setSelfLight = (at: { x: number; z: number } | null): void => {
    if (at === null) self.position.set(T.point.self.x, T.point.self.y, T.point.self.z);
    else self.position.set(at.x, T.point.self.y, at.z);
  };
  const setChalk = (at: { x: number; z: number } | null, opacity: number): void => {
    if (at === null) {
      chalk.visible = false;
      return;
    }
    chalk.visible = true;
    chalk.position.set(at.x, 0.015, at.z);
    (chalk.material as MeshBasicMaterial).opacity = opacity;
  };
  const setTension = (level: 0 | 1 | 2, focus?: { x: number; z: number }): void => {
    tensionLevel = level;
    tensionFocus = level >= 1 && focus ? { x: focus.x, z: focus.z } : null;
    applyLook();
  };
  const setPin = (pin: { x: number; z: number; strength: number } | null, dim: number): void => {
    pinState = pin === null ? null : { x: pin.x, z: pin.z, strength: pin.strength };
    pinDim = Number.isFinite(dim) ? Math.min(1, Math.max(0, dim)) : 1;
    applyPin();
  };

  const applyBudget = (b: Budget): void => {
    const prevSize = moon.shadow.mapSize.x;
    const prevCast = moon.castShadow;
    current = b;
    if (b.shadowMap === 0) {
      moon.castShadow = false;
    } else {
      moon.castShadow = true;
      if (prevSize !== b.shadowMap) moon.shadow.mapSize.set(b.shadowMap, b.shadowMap);
    }
    if (moon.shadow.mapSize.x !== prevSize || prevCast !== moon.castShadow) {
      moon.shadow.map?.dispose();
      moon.shadow.map = null;
    }
    // 소품 reduced: 먼 소품(벤치 다리·나무 가지·불 켜진 창)을 뺀다
    const far = b.props === "full";
    meshes.furnitureFar!.visible = far;
    meshes.emissiveRoomFar!.visible = far;
    setLighting(phase);
  };
  applyBudget(budget);

  return {
    root,
    lights: { hemi, moon, stage, pendantA, self },
    meshes,
    markers,
    plate,
    get exposure(): number {
      return exposure;
    },
    setLighting,
    setChalk,
    setSelfLight,
    setTension,
    setPin,
    applyBudget,
    update,
    get budget(): Budget {
      return current;
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      const mats = new Set<Material>();
      root.traverse((o) => {
        const m = o as Mesh;
        if (!m.isMesh) return;
        m.geometry.dispose();
        for (const x of Array.isArray(m.material) ? m.material : [m.material]) mats.add(x);
      });
      for (const x of mats) x.dispose();
      glowMap.dispose();
      moon.shadow.map?.dispose();
    },
  };
}
