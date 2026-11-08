// 심부름 화면의 순수 판정(15-04): 장소 낱말·아이콘, 진행·다음 장소·처리 가능, 표지 배치 계획.
// 실패 출력은 한 줄이어야 해서(TAP) 목록 비교는 JSON 문자열로 한다.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { actErrand } from "../../shared/game/errand";
import { BAR_PLACES, UNIT } from "../../shared/game/map";
import { PLAZA_PLACES } from "../../shared/game/mapPlaza";
import { ERRAND_ACT_R, ERRAND_MS } from "../../shared/game/phases";
import type { Player, RoomState } from "../../shared/game/room";
import { PLACE_IDS } from "../../shared/protocol";
import type { PlaceId, RoomView } from "../../shared/protocol";
import { V2Icon } from "../../src/components/v2/V2Icon";
import type { V2IconName } from "../../src/components/v2/V2Icon";
import { ERRAND_CARD_MS, ERRAND_TEXT, actablePlaceOf, errandProgress, nextPlaceOf, placeCentersOf, placeMarkerPlan, progressLabel, startCardOn } from "../../src/game/errandView";
import type { Rect } from "../../src/game/errandView";
import { PLACE_NAME, placeLabel } from "../../src/game/placeText";
import { seededRandInt } from "../helpers/seededRandom";
import { startedAt } from "../helpers/voteState";
import { tick } from "../../shared/game/tick";

const BAR_IDS = BAR_PLACES.map((p) => p.id);
const PLAZA_IDS = PLAZA_PLACES.map((p) => p.id);

/** 심부름 view 하나(필요한 필드만). 시험에서 RoomView 로 단언한다. */
function viewOf(map: "bar" | "plaza" | undefined, errand: { places: PlaceId[]; done: PlaceId[] } | undefined): RoomView {
  const me: Record<string, unknown> = { seat: 0, isHost: false };
  if (errand !== undefined) me.errand = errand;
  const v: Record<string, unknown> = { phase: "errand", players: [], me };
  if (map !== undefined) v.map = map;
  return v as unknown as RoomView;
}

describe("장소 낱말·아이콘", () => {
  it("장소 아이콘은 16개다 — PLACE_IDS 16 = 재즈 바 후보 8 + 광장 후보 8 (계획의 16·18 불일치는 16 이 맞다: 18 은 arrow·thread 를 더한 새 아이콘 이름 수)", () => {
    expect(PLACE_IDS.length).toBe(16);
    expect(BAR_PLACES.length + PLAZA_PLACES.length).toBe(16);
    expect(new Set([...BAR_IDS, ...PLAZA_IDS]).size).toBe(16);
    expect(JSON.stringify([...BAR_IDS, ...PLAZA_IDS].sort())).toBe(JSON.stringify([...PLACE_IDS].sort()));
  });

  it("PLACE_NAME 은 16개 id 모두의 키를 가지고 같은 맵 안의 낱말이 서로 다르다", () => {
    expect(JSON.stringify(Object.keys(PLACE_NAME).sort())).toBe(JSON.stringify([...PLACE_IDS].sort()));
    for (const ids of [BAR_IDS, PLAZA_IDS]) {
      const words = ids.map((id) => PLACE_NAME[id as PlaceId]);
      expect(new Set(words).size).toBe(ids.length);
      for (const w of words) expect(w.length).toBeGreaterThan(0);
    }
    expect(JSON.stringify(BAR_IDS.map((id) => PLACE_NAME[id as PlaceId]))).toBe(JSON.stringify(["술잔", "피아노", "색소폰", "의자", "문", "포스터", "전축", "촛불"]));
    expect(JSON.stringify(PLAZA_IDS.map((id) => PLACE_NAME[id as PlaceId]))).toBe(JSON.stringify(["시계탑", "분수", "벤치", "가로등", "우체통", "나무", "꽃", "가판"]));
  });

  it("V2Icon: arrow·thread 가 그려지고 크기 prop 이 따른다", () => {
    for (const name of ["arrow", "thread"] as V2IconName[]) {
      const html = renderToStaticMarkup(createElement(V2Icon, { name, size: 36 }));
      expect(html).toContain('width="36"');
      expect(html).toContain('height="36"');
      expect(html.match(/<svg/g)?.length).toBe(1);
      expect(html).toMatch(/<(path|circle)/);
    }
  });

  it("placeLabel", () => {
    expect(placeLabel("clock", false)).toBe("시계탑 장소");
    expect(placeLabel("clock", true)).toBe("시계탑 장소, 처리함");
  });
});

describe("진행·다음 장소·처리 가능", () => {
  it("ERRAND_TEXT·progressLabel", () => {
    expect(ERRAND_TEXT).toEqual({ act: "처리", done: "완료" });
    expect(progressLabel(1, 3)).toBe("진행 1/3");
  });

  it("errandProgress: me.errand 가 없으면 null, 1/3, 3/3 은 complete, 빈 배열은 total 0·complete false", () => {
    expect(errandProgress(viewOf("bar", undefined))).toBeNull();
    const a = errandProgress(viewOf("bar", { places: ["glass", "piano", "sax"], done: ["piano"] }));
    expect(JSON.stringify(a)).toBe(JSON.stringify({ places: ["glass", "piano", "sax"], done: ["piano"], n: 1, total: 3, complete: false }));
    const b = errandProgress(viewOf("bar", { places: ["glass", "piano", "sax"], done: ["glass", "piano", "sax"] }));
    expect(b?.complete).toBe(true);
    expect(b?.n).toBe(3);
    const c = errandProgress(viewOf("bar", { places: [], done: [] }));
    expect(c?.total).toBe(0);
    expect(c?.complete).toBe(false);
  });

  it("placeCentersOf: bar 는 BAR_PLACES 좌표, plaza 는 PLAZA_PLACES 좌표, map 이 없으면 빈 배열, 맵에 없는 id 만 빠진다", () => {
    const bar = placeCentersOf(viewOf("bar", { places: ["sax", "glass", "door"], done: [] }));
    expect(JSON.stringify(bar)).toBe(JSON.stringify(["sax", "glass", "door"].map((id) => {
      const p = BAR_PLACES.find((q) => q.id === id)!;
      return { id, x: p.x, z: p.z };
    })));
    const plaza = placeCentersOf(viewOf("plaza", { places: ["clock", "tree", "stand"], done: [] }));
    expect(JSON.stringify(plaza.map((c) => [c.id, c.x, c.z]))).toBe(
      JSON.stringify(["clock", "tree", "stand"].map((id) => {
        const p = PLAZA_PLACES.find((q) => q.id === id)!;
        return [id, p.x, p.z];
      })),
    );
    expect(placeCentersOf(viewOf(undefined, { places: ["glass"], done: [] }))).toEqual([]);
    expect(placeCentersOf(viewOf(undefined, undefined))).toEqual([]);
    // 재즈 바 맵에 광장 id 가 섞이면 그 id 만 빠진다
    const mixed = placeCentersOf(viewOf("bar", { places: ["glass", "clock", "piano"], done: [] }));
    expect(JSON.stringify(mixed.map((c) => c.id))).toBe(JSON.stringify(["glass", "piano"]));
  });

  const C = [
    { id: "glass" as PlaceId, x: 0, z: 0 },
    { id: "piano" as PlaceId, x: 4, z: 0 },
    { id: "sax" as PlaceId, x: 8, z: 0 },
  ];

  it("nextPlaceOf: 가장 가까운 미완료, 같은 거리면 목록 앞, 완료는 건너뜀, pos null 이면 첫 미완료, 모두 완료면 null", () => {
    expect(nextPlaceOf({ x: 7, z: 0 }, C, [])).toBe("sax");
    expect(nextPlaceOf({ x: 7, z: 0 }, C, ["sax"])).toBe("piano");
    expect(nextPlaceOf({ x: 2, z: 0 }, C, [])).toBe("glass"); // glass·piano 같은 거리 → 목록 앞
    expect(nextPlaceOf({ x: 6, z: 0 }, C, [])).toBe("piano"); // piano·sax 같은 거리 → 목록 앞
    expect(nextPlaceOf(null, C, ["glass"])).toBe("piano");
    expect(nextPlaceOf(null, C, [])).toBe("glass");
    expect(nextPlaceOf({ x: 1, z: 1 }, C, ["glass", "piano", "sax"])).toBeNull();
    expect(nextPlaceOf(null, [], [])).toBeNull();
  });

  it("actablePlaceOf: 반경 ERRAND_ACT_R 안 미완료만(경계 포함), 둘이면 더 가까운 쪽, 완료한 곳 곁이면 null", () => {
    expect(ERRAND_ACT_R).toBe(1.2);
    expect(actablePlaceOf({ x: 1.2, z: 0 }, C, [])).toBe("glass"); // 경계 포함
    expect(actablePlaceOf({ x: 1.21, z: 0 }, C, [])).toBeNull();
    expect(actablePlaceOf({ x: 0, z: 0.5 }, C, ["glass"])).toBeNull(); // 완료한 곳 곁
    expect(actablePlaceOf(null, C, [])).toBeNull();
    const close = [
      { id: "glass" as PlaceId, x: 0, z: 0 },
      { id: "piano" as PlaceId, x: 1.5, z: 0 },
    ];
    expect(actablePlaceOf({ x: 0.9, z: 0 }, close, [])).toBe("piano"); // 둘 다 반경 안, piano 가 더 가깝다
    expect(actablePlaceOf({ x: 0.5, z: 0 }, close, [])).toBe("glass");
    expect(actablePlaceOf({ x: 0.9, z: 0 }, close, ["piano"])).toBe("glass");
    expect(actablePlaceOf({ x: 0, z: 0 }, C, [], 0.1)).toBe("glass"); // 반경 인자
  });

  it("actablePlaceOf 는 서버 actErrand 와 같은 표본 20개에서 같은 판정이다(화면 거울, T-15-18)", () => {
    const day = { ...startedAt(6, 11, "dayAnnounce"), map: "bar" as const };
    const dealt: RoomState = tick(day, day.phaseEndsAt!, seededRandInt(12));
    expect(dealt.phase).toBe("errand");
    // 화면은 서버 전용 가짜 장소(errandFake, 16페이즈 D-08)를 모른다 — 거울은 기본 처리 규칙만 견준다. 가짜 제외는 errand.test 가 본다.
    const state: RoomState = { ...dealt, players: dealt.players.map(({ errandFake: _fake, ...rest }) => rest) };
    const player = state.players.find((p): p is Player => p.errandPlaces !== undefined)!;
    const places = player.errandPlaces!;
    const view = viewOf("bar", { places: [...places], done: [] });
    const centers = placeCentersOf(view);
    expect(centers.length).toBe(places.length);
    const rnd = seededRandInt(5);
    const R = Math.round(ERRAND_ACT_R * UNIT);
    let hits = 0;
    for (let i = 0; i < 20; i++) {
      const target = centers[rnd(centers.length)]!;
      // 반경 안팎 경계 근처 표본: 거리 R-3 .. R+3 점(고정소수점)
      const dist = R - 3 + rnd(7);
      const angle = (rnd(360) * Math.PI) / 180;
      const fx = { x: Math.round(target.x * UNIT + Math.cos(angle) * dist), z: Math.round(target.z * UNIT + Math.sin(angle) * dist) };
      const server = actErrand(state, player.id, fx);
      const client = actablePlaceOf({ x: fx.x / UNIT, z: fx.z / UNIT }, centers, []);
      if (server.ok) {
        const done = server.state.players.find((p) => p.id === player.id)!.errandDone!;
        expect(client, `표본 ${i}`).toBe(done[done.length - 1]);
        hits++;
      } else {
        expect(client, `표본 ${i}`).toBeNull();
      }
    }
    expect(hits).toBeGreaterThan(0);
    expect(hits).toBeLessThan(20);
  });
});

// ---- 타일·화살표·[처리] 알약 배치 계획 (16-07, D-06·V-20~V-22) ----
const STAGE: Rect = { left: 0, top: 123, right: 360, bottom: 476 };
/** 소리 열 첫 칸(오른쪽 위 52 원) */
const SOUND: Rect = { left: 292, top: 131, right: 344, bottom: 183 };
const overlap = (a: Rect, b: Rect): boolean => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
const boxOf = (x: number, y: number, w: number, h: number = w): Rect => ({ left: x - w / 2, top: y - h / 2, right: x + w / 2, bottom: y + h / 2 });

describe("타일·화살표·알약 배치 계획", () => {
  const inside = { id: "glass" as PlaceId, x: 100, y: 300 };
  const base = { stage: STAGE, avoid: [SOUND], items: [inside], me: null, nextId: null, actId: null } as const;

  it("(a) 타일 상자 64 가 안쪽 8 안이고 avoid 와 안 겹치는 장소만 pins 에 든다", () => {
    const plan = placeMarkerPlan({ ...base, items: [inside, { id: "piano", x: 250, y: 400 }] });
    expect(JSON.stringify(plan.pins.map((p) => p.id))).toBe(JSON.stringify(["glass", "piano"]));
    expect(plan.pins[0]).toEqual({ id: "glass", x: 100, y: 300 });
    expect(plan.arrow).toBeNull();
    expect(plan.act).toBeNull();
  });

  it("(b) 타일 64 가 inset 8 안에 정확히 들어가는 경계는 그리고 1px 라도 넘으면 그리지 않는다", () => {
    const edgeOk = { id: "glass" as PlaceId, x: 8 + 32, y: 300 };
    const edgeBad = { id: "piano" as PlaceId, x: 8 + 32 - 1, y: 300 };
    const topBad = { id: "sax" as PlaceId, x: 180, y: 123 + 8 + 32 - 1 };
    const bottomOk = { id: "stool" as PlaceId, x: 180, y: 476 - 8 - 32 };
    const plan = placeMarkerPlan({ ...base, avoid: [], items: [edgeOk, edgeBad, topBad, bottomOk] });
    expect(JSON.stringify(plan.pins.map((p) => p.id))).toBe(JSON.stringify(["glass", "stool"]));
  });

  it("(c) 소리 열 사각형과 겹치는 타일은 빠지고 맞닿기만 하면 남는다", () => {
    const hit = { id: "glass" as PlaceId, x: 318, y: 190 }; // 상자 286..350 × 158..222 — 소리 열과 겹침
    const touch = { id: "piano" as PlaceId, x: 318, y: 183 + 32 }; // 윗변 183 = 소리 열 아랫변
    const plan = placeMarkerPlan({ ...base, items: [hit, touch] });
    expect(JSON.stringify(plan.pins.map((p) => p.id))).toBe(JSON.stringify(["piano"]));
  });

  it("(d) 화살표: actId 가 null 이고 me·nextId 가 있으면 내 위치에서 56 떨어진 자리, 각도는 목표 방향(위 0°·오른쪽 90°·아래 180°·왼쪽 -90°)", () => {
    const me = { x: 180, y: 300 };
    const at = (x: number, y: number) => placeMarkerPlan({ ...base, avoid: [], items: [{ id: "sax", x, y }], me, nextId: "sax" }).arrow!;
    const up = at(180, 100);
    expect(up.id).toBe("sax");
    expect(up.x).toBeCloseTo(180, 6);
    expect(up.y).toBeCloseTo(300 - 56, 6);
    expect(up.angle).toBeCloseTo(0, 6);
    const right = at(600, 300);
    expect(right.x).toBeCloseTo(180 + 56, 6);
    expect(right.angle).toBeCloseTo(90, 6);
    const down = at(180, 460);
    expect(down.y).toBeCloseTo(356, 6);
    expect(down.angle).toBeCloseTo(180, 6);
    const left = at(-100, 300);
    expect(left.x).toBeCloseTo(124, 6);
    expect(left.angle).toBeCloseTo(-90, 6);
    // 내 위치와 목표가 같아도 정해진 값(위)
    expect(at(180, 300).angle).toBe(0);
  });

  it("(e) 화살표 40 상자가 avoid·arrowAvoid 와 겹치면 48 로 한 번만 당긴다(다시 겹쳐도 더 당기지 않는다)", () => {
    const items = [{ id: "sax" as PlaceId, x: 318, y: 60 }];
    // 내 위치 (318, 240): 위쪽 56 → 중심 (318, 184), 상자 164..204 가 소리 열(~183)과 겹친다
    const near = placeMarkerPlan({ ...base, items, me: { x: 318, y: 240 }, nextId: "sax" }).arrow!;
    expect(near.y).toBeCloseTo(240 - 48, 6);
    // 겹치지 않으면 56
    const far = placeMarkerPlan({ ...base, items, me: { x: 318, y: 300 }, nextId: "sax" }).arrow!;
    expect(far.y).toBeCloseTo(300 - 56, 6);
    // arrowAvoid(내 이름표 사각형)도 같다: 이름표가 발밑 위쪽에 있으면 48
    const tag: Rect = { left: 150, top: 230, right: 210, bottom: 270 };
    const tagged = placeMarkerPlan({ ...base, avoid: [], arrowAvoid: [tag], items: [{ id: "sax", x: 180, y: 60 }], me: { x: 180, y: 300 }, nextId: "sax" }).arrow!;
    expect(tagged.y).toBeCloseTo(300 - 48, 6);
    // arrowAvoid 는 타일 판정에는 쓰지 않는다
    const tile = placeMarkerPlan({ ...base, avoid: [], arrowAvoid: [tag], items: [{ id: "glass", x: 180, y: 250 }] });
    expect(tile.pins.map((p) => p.id)).toEqual(["glass"]);
  });

  it("(f) 화살표는 스테이지 안쪽 8 + 20 밖으로 나가지 않는다", () => {
    const a = placeMarkerPlan({ ...base, avoid: [], items: [{ id: "sax", x: 700, y: 200 }], me: { x: 350, y: 130 }, nextId: "sax" }).arrow!;
    expect(a.x - 20).toBeGreaterThanOrEqual(STAGE.left + 8);
    expect(a.x + 20).toBeLessThanOrEqual(STAGE.right - 8);
    expect(a.y - 20).toBeGreaterThanOrEqual(STAGE.top + 8);
  });

  it("(g) 화살표가 없는 경우: actId 가 있다·nextId null·me null·nextId 가 items 에 없다", () => {
    const items = [inside, { id: "sax" as PlaceId, x: 250, y: 400 }];
    const me = { x: 180, y: 300 };
    expect(placeMarkerPlan({ ...base, items, me, nextId: "sax", actId: "glass" }).arrow).toBeNull();
    expect(placeMarkerPlan({ ...base, items, me, nextId: null }).arrow).toBeNull();
    expect(placeMarkerPlan({ ...base, items, me: null, nextId: "sax" }).arrow).toBeNull();
    expect(placeMarkerPlan({ ...base, items: [inside], me, nextId: "sax" }).arrow).toBeNull();
  });

  it("(h) 알약: 타일 위 8 + 22 중심. 타일과 겹치지 않는다", () => {
    const plan = placeMarkerPlan({ ...base, avoid: [], actId: "glass", pillW: 96 });
    expect(plan.act).toEqual({ id: "glass", x: 100, y: 300 - 32 - 8 - 22 });
    expect(overlap(boxOf(plan.act!.x, plan.act!.y, 96, 44), boxOf(100, 300, 64))).toBe(false);
    expect(plan.arrow).toBeNull();
  });

  it("(i) 위가 stage.top + 8 을 넘으면 아래로 뒤집는다(경계 포함은 위)", () => {
    const stays = placeMarkerPlan({ ...base, avoid: [], items: [{ id: "glass", x: 180, y: 123 + 8 + 44 + 8 + 32 }], actId: "glass", pillW: 96 });
    expect(stays.act!.y).toBe(123 + 8 + 22);
    const flips = placeMarkerPlan({ ...base, avoid: [], items: [{ id: "glass", x: 180, y: 123 + 8 + 44 + 8 + 32 - 1 }], actId: "glass", pillW: 96 });
    expect(flips.act!.y).toBe(123 + 8 + 44 + 8 + 32 - 1 + 32 + 8 + 22);
  });

  it("(j) 위가 소리 열에 막히면 아래로 뒤집고 좌우는 안쪽 8 안으로 민다", () => {
    const plan = placeMarkerPlan({ ...base, items: [{ id: "glass", x: 322, y: 260 }], actId: "glass", pillW: 96 });
    // 위쪽 중심 y = 198 → 상자 176..220 이 소리 열(131..183)과 겹침 → 아래
    expect(plan.act!.y).toBe(260 + 32 + 8 + 22);
    // 오른쪽 안쪽 8(= 352)을 넘지 않게 민다: x = 352 - 48
    expect(plan.act!.x).toBe(352 - 48);
    const left = placeMarkerPlan({ ...base, avoid: [], items: [{ id: "glass", x: 40, y: 300 }], actId: "glass", pillW: 100 });
    expect(left.act!.x).toBe(8 + 50);
  });

  it("(k) 타일이 그려지지 않는 자리(화면 밖)여도 알약은 투영 점을 안쪽으로 당긴 곳에 선다", () => {
    const plan = placeMarkerPlan({ ...base, avoid: [], items: [{ id: "glass", x: -100, y: 900 }], actId: "glass", pillW: 100 });
    expect(plan.pins).toEqual([]);
    // 타일 중심을 (8+32, bottom-8-32) 로 당기고 그 위 8 + 22
    expect(plan.act).toEqual({ id: "glass", x: 8 + 50, y: 476 - 8 - 32 - 32 - 8 - 22 });
  });

  it("(l) actId 가 items 에 없으면(투영 불가) act 도 없다", () => {
    expect(placeMarkerPlan({ ...base, actId: "sax" }).act).toBeNull();
  });

  it("(m) 같은 입력 두 번 같은 출력", () => {
    const input = { ...base, items: [inside, { id: "sax" as PlaceId, x: 700, y: 20 }], me: { x: 180, y: 300 }, nextId: "sax" as PlaceId };
    expect(JSON.stringify(placeMarkerPlan(input))).toBe(JSON.stringify(placeMarkerPlan(input)));
  });

  it("(n) 크기 인자(tile·inset·arrow·reach·reachShort·pillH·gap)가 기본값(64·8·40·56·48·44·8)을 바꾼다", () => {
    const small = placeMarkerPlan({ ...base, avoid: [], items: [{ id: "glass", x: 20, y: 300 }], tile: 24, inset: 8 });
    expect(small.pins.map((p) => p.id)).toEqual(["glass"]);
    const reach = placeMarkerPlan({ ...base, avoid: [], items: [{ id: "sax", x: 180, y: 100 }], me: { x: 180, y: 300 }, nextId: "sax", reach: 30 }).arrow!;
    expect(reach.y).toBeCloseTo(270, 6);
    const pill = placeMarkerPlan({ ...base, avoid: [], actId: "glass", pillW: 90, pillH: 40, gap: 4 });
    expect(pill.act!.y).toBe(300 - 32 - 4 - 20);
  });
});

describe("시작 카드 표시 판정 (16-08, V-19)", () => {
  const START = 1_000_000;
  const at = (over: Record<string, unknown> = {}, errand: { places: PlaceId[]; done: PlaceId[] } | null = { places: ["glass", "piano", "sax"], done: [] }): RoomView =>
    ({ ...(viewOf("bar", errand ?? undefined) as unknown as Record<string, unknown>), phaseEndsAt: START + ERRAND_MS, ...over }) as unknown as RoomView;

  it("카드 시간은 2초(클라이언트 상수)", () => {
    expect(ERRAND_CARD_MS).toBe(2_000);
  });
  it("단계 시작부터 2초 안(경계 전까지)이면 참", () => {
    expect(startCardOn(at(), START)).toBe(true);
    expect(startCardOn(at(), START + 1_000)).toBe(true);
    expect(startCardOn(at(), START + ERRAND_CARD_MS - 1)).toBe(true);
  });
  it("2초가 지났으면(재접속·새로 고침으로 늦게 들어옴) 거짓", () => {
    expect(startCardOn(at(), START + ERRAND_CARD_MS)).toBe(false);
    expect(startCardOn(at(), START + 3_000)).toBe(false);
  });
  it("다른 단계·목록 없음(유령 포함)·phaseEndsAt 없음이면 거짓", () => {
    expect(startCardOn(at({ phase: "discussion" }), START + 500)).toBe(false);
    expect(startCardOn(at({}, null), START + 500)).toBe(false);
    expect(startCardOn(at({}, { places: [], done: [] }), START + 500)).toBe(false);
    expect(startCardOn(at({ phaseEndsAt: null }), START + 500)).toBe(false);
  });
});
