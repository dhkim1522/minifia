// 심부름 화면의 순수 판정(15-04): 장소 낱말·아이콘, 진행·다음 장소·처리 가능, 표지 배치 계획.
// 실패 출력은 한 줄이어야 해서(TAP) 목록 비교는 JSON 문자열로 한다.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { actErrand } from "../../shared/game/errand";
import { BAR_PLACES, UNIT } from "../../shared/game/map";
import { PLAZA_PLACES } from "../../shared/game/mapPlaza";
import { ERRAND_ACT_R } from "../../shared/game/phases";
import type { Player, RoomState } from "../../shared/game/room";
import { PLACE_IDS } from "../../shared/protocol";
import type { PlaceId, RoomView } from "../../shared/protocol";
import { V2Icon } from "../../src/components/v2/V2Icon";
import type { V2IconName } from "../../src/components/v2/V2Icon";
import { ERRAND_TEXT, actablePlaceOf, errandProgress, nextPlaceOf, placeCentersOf, placeMarkerPlan, progressLabel } from "../../src/game/errandView";
import type { Rect } from "../../src/game/errandView";
import { PLACE_NAME, placeIconOf, placeLabel } from "../../src/game/placeText";
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
    const placeIcons = PLACE_IDS.map((id) => placeIconOf(id));
    expect(new Set(placeIcons).size).toBe(16);
    // 새 아이콘 이름은 모두 18개: 장소 16 + arrow + thread
    expect(placeIcons.length + ["arrow", "thread"].length).toBe(18);
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

  it("placeIconOf 는 'place' + id 첫 글자 대문자이고 V2Icon 이 실제로 그린다(16개 전부)", () => {
    expect(placeIconOf("clock")).toBe("placeClock");
    expect(placeIconOf("glass")).toBe("placeGlass");
    for (const id of PLACE_IDS) {
      const name = placeIconOf(id);
      expect(name).toBe(`place${id.charAt(0).toUpperCase()}${id.slice(1)}`);
      const html = renderToStaticMarkup(createElement(V2Icon, { name, size: 20 }));
      expect(html).toContain("<svg");
      expect(html).toMatch(/<(path|circle)/);
    }
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

// ---- 표지 배치 계획 ----
const STAGE: Rect = { left: 0, top: 123, right: 360, bottom: 476 };
const DOCK: Rect = { left: 296, top: 131, right: 344, bottom: 175 };
const overlap = (a: Rect, b: Rect): boolean => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
const boxOf = (x: number, y: number, size: number): Rect => ({ left: x - size / 2, top: y - size / 2, right: x + size / 2, bottom: y + size / 2 });

describe("표지 배치 계획", () => {
  const inside = { id: "glass" as PlaceId, x: 100, y: 300 };

  it("(a) 안쪽 8 inset 안·독 줄과 안 겹치는 장소는 pins 에 들어가고 화살표는 없다", () => {
    const plan = placeMarkerPlan({ stage: STAGE, dock: DOCK, items: [inside, { id: "piano", x: 250, y: 400 }], nextId: "glass" });
    expect(JSON.stringify(plan.pins.map((p) => p.id))).toBe(JSON.stringify(["glass", "piano"]));
    expect(plan.arrow).toBeNull();
    expect(plan.pins[0]).toEqual({ id: "glass", x: 100, y: 300 });
  });

  it("누르기 상자 44 가 inset 8 안에 정확히 들어가는 경계는 그리고, 1px 라도 넘으면 그리지 않는다", () => {
    const edgeOk = { id: "glass" as PlaceId, x: 8 + 22, y: 300 };
    const edgeBad = { id: "piano" as PlaceId, x: 8 + 22 - 1, y: 300 };
    const plan = placeMarkerPlan({ stage: STAGE, dock: null, items: [edgeOk, edgeBad], nextId: null });
    expect(JSON.stringify(plan.pins.map((p) => p.id))).toBe(JSON.stringify(["glass"]));
  });

  it("(b) 다음 장소가 화면 밖이면 pins 에서 빠지고 arrow 가 그 id·스테이지 가장자리(안쪽 26)에 붙고 angle 이 중심→장소 방향", () => {
    const plan = placeMarkerPlan({ stage: STAGE, dock: DOCK, items: [inside, { id: "sax", x: 700, y: 299.5 }], nextId: "sax" });
    expect(JSON.stringify(plan.pins.map((p) => p.id))).toBe(JSON.stringify(["glass"]));
    expect(plan.arrow?.id).toBe("sax");
    // 중심(180, 299.5)에서 오른쪽(+x)을 향한다 → 오른쪽 가장자리: right - 26, 각도 90°(위 0°, 시계 방향)
    expect(plan.arrow?.x).toBe(STAGE.right - 26);
    expect(plan.arrow?.y).toBeCloseTo(299.5, 5);
    expect(plan.arrow?.angle).toBeCloseTo(90, 5);
    const down = placeMarkerPlan({ stage: STAGE, dock: DOCK, items: [{ id: "sax", x: 180, y: 900 }], nextId: "sax" });
    expect(down.arrow?.angle).toBeCloseTo(180, 5);
    expect(down.arrow?.y).toBe(STAGE.bottom - 26);
    const left = placeMarkerPlan({ stage: STAGE, dock: null, items: [{ id: "sax", x: -300, y: 299.5 }], nextId: "sax" });
    expect(left.arrow?.x).toBe(STAGE.left + 26);
    expect(left.arrow?.angle).toBeCloseTo(-90, 5);
  });

  it("(c) 다음 장소가 독 줄과 겹치면 pins 에서 빠지고 arrow", () => {
    const plan = placeMarkerPlan({ stage: STAGE, dock: DOCK, items: [{ id: "glass", x: 320, y: 153 }], nextId: "glass" });
    expect(plan.pins).toEqual([]);
    expect(plan.arrow?.id).toBe("glass");
  });

  it("(d) 다음이 아닌 장소가 밖이면 그냥 그리지 않고, 화살표는 항상 하나뿐이다", () => {
    const items = [
      { id: "glass" as PlaceId, x: -200, y: 300 },
      { id: "piano" as PlaceId, x: 900, y: 300 },
      { id: "sax" as PlaceId, x: 100, y: 300 },
    ];
    const plan = placeMarkerPlan({ stage: STAGE, dock: DOCK, items, nextId: "piano" });
    expect(JSON.stringify(plan.pins.map((p) => p.id))).toBe(JSON.stringify(["sax"]));
    expect(plan.arrow?.id).toBe("piano");
    const none = placeMarkerPlan({ stage: STAGE, dock: DOCK, items, nextId: "sax" });
    expect(none.arrow).toBeNull();
    expect(none.pins.map((p) => p.id)).toEqual(["sax"]);
  });

  it("(e) 화살표 칩이 독 줄 사각형과 겹치면 아래로 밀려 겹침 0, 띠 아래(stage.top + 8) 위로는 안 올라간다", () => {
    // 위쪽 오른쪽 구석 방향 → 원래 자리가 독 줄과 겹친다
    const target = { id: "glass" as PlaceId, x: 450, y: 20 };
    const plan = placeMarkerPlan({ stage: STAGE, dock: DOCK, items: [target], nextId: "glass" });
    const a = plan.arrow!;
    expect(overlap(boxOf(a.x, a.y, 36), DOCK)).toBe(false);
    expect(a.y - 18).toBeGreaterThanOrEqual(STAGE.top + 8);
    // 독 줄이 없으면 밀리지 않는다 — 윗 가장자리
    const free = placeMarkerPlan({ stage: STAGE, dock: null, items: [target], nextId: "glass" }).arrow!;
    expect(free.y).toBe(STAGE.top + 26);
    expect(a.y).toBeGreaterThan(free.y);
    // 각도는 중심→장소 방향 그대로
    expect(a.angle).toBeCloseTo(free.angle, 9);
    // 가로 가장자리에 붙어도 독 줄 칩 상자와 겹침 0
    for (const y of [140, 160, 170, 190]) {
      const p = placeMarkerPlan({ stage: STAGE, dock: DOCK, items: [{ id: "glass", x: 900, y }], nextId: "glass" }).arrow!;
      expect(overlap(boxOf(p.x, p.y, 36), DOCK), `y=${y}`).toBe(false);
      expect(p.y - 18).toBeGreaterThanOrEqual(STAGE.top + 8);
    }
  });

  it("(f) nextId 가 null 이면 arrow null", () => {
    const plan = placeMarkerPlan({ stage: STAGE, dock: DOCK, items: [{ id: "glass", x: -500, y: 300 }], nextId: null });
    expect(plan.arrow).toBeNull();
    expect(plan.pins).toEqual([]);
  });

  it("nextId 가 items 에 없으면(투영 불가) arrow 도 없다", () => {
    const plan = placeMarkerPlan({ stage: STAGE, dock: DOCK, items: [inside], nextId: "sax" });
    expect(plan.arrow).toBeNull();
  });

  it("(g) 같은 입력 두 번 같은 출력", () => {
    const input = { stage: STAGE, dock: DOCK, items: [inside, { id: "sax" as PlaceId, x: 700, y: 20 }], nextId: "sax" as PlaceId };
    expect(JSON.stringify(placeMarkerPlan(input))).toBe(JSON.stringify(placeMarkerPlan(input)));
  });

  it("크기 인자(pin·tap·inset·chip)가 기본값(36·44·8·36)을 바꾼다", () => {
    const plan = placeMarkerPlan({ stage: STAGE, dock: null, items: [{ id: "sax", x: -50, y: 300 }], nextId: "sax", inset: 4, chip: 24 });
    expect(plan.arrow?.x).toBe(STAGE.left + 4 + 12);
  });
});
