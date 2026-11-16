// 맵 선택 E2E 순수 판정 단위 테스트 (11-13). 실행: node --test scripts/e2e/mapselect.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { MAP_CHIP, MAP_CARD, MAP_MARKERS, mapChoiceChecks, mapRailChecks } from "./mapselect.mjs";

const box = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });

// 360×560 폰: 칩은 왼쪽 방장 줄의 둘째 칸 — 52 원, 왼쪽 16, 위 138(줄 안 자리는 hostRailChecks HR2 가 잰다)
const good = () => ({
  viewport: { w: 360, h: 560 },
  chip: { disc: box(16, 138, 52, 52), hit: box(16, 138, 52, 52), label: "맵 랜덤" },
  guest: { chipCount: 0 },
  sheet: box(0, 310, 360, 250),
  tabs: [box(4, 322, 44, 44), box(48, 322, 44, 44)],
  guestTabs: 0,
  cards: [box(28, 378, 96, 112), box(132, 378, 96, 112), box(236, 378, 96, 112)],
  selected: 1,
  selectedId: "random",
  testBtn: null,
  tags: [box(150, 250, 80, 28), box(230, 300, 70, 28)],
});
// [테스트] 버튼은 왼쪽 위(16, 70), 칩은 그 아래 줄에 있어 겹치지 않는다
const withTest = () => ({ ...good(), testBtn: box(16, 70, 96, 44) });
const failing = (over, base = good()) => mapChoiceChecks({ ...base, ...over }).filter((r) => !r.ok).map((r) => r.id);

test("mapChoiceChecks: 정상 입력은 MS1~MS6 이 모두 통과한다", () => {
  const rows = mapChoiceChecks(good());
  assert.deepEqual(rows.map((r) => r.id), ["MS1", "MS2", "MS3", "MS4", "MS5", "MS6"]);
  for (const r of rows) assert.equal(r.ok, true, `${r.id}: ${r.detail}`);
});

test("상수: 칩 52 원(자리는 방장 줄 판정이 잰다), 카드 96×112 간격 8 합 304", () => {
  assert.deepEqual({ ...MAP_CHIP }, { disc: 52, hit: 52 });
  assert.deepEqual({ ...MAP_CARD }, { w: 96, h: 112, gap: 8, total: 304 });
});

test("표식 이름 목록", () => {
  assert.deepEqual([...MAP_MARKERS], ["data-map-chip", "data-map-card", "data-map-tab", "__mfMap"]);
});

test("MS1: 칩 지름이 어긋나거나 칩이 화면 오른쪽(옛 오른쪽 열 자리)에 있으면 MS1 만 실패한다", () => {
  const c = good().chip;
  assert.deepEqual(failing({ chip: { ...c, disc: box(16, 138, 36, 36) } }), ["MS1"]);
  assert.deepEqual(failing({ chip: { ...c, hit: box(16, 138, 44, 44) } }), ["MS1"]);
  assert.deepEqual(failing({ chip: { disc: box(292, 138, 52, 52), hit: box(292, 138, 52, 52), label: "맵 랜덤" }, tags: [] }), ["MS1"]); // 오른쪽 열 자리
  assert.deepEqual(failing({ chip: { ...c, disc: box(80, 138, 52, 52) } }), []); // 접힌 줄의 둘째 열(왼쪽 80)도 왼쪽 절반이다
  assert.deepEqual(failing({ chip: null }), ["MS1", "MS6"]);
  assert.deepEqual(failing({ viewport: null }), ["MS1"]);
});

test("MS1·MS6: [테스트] 버튼이 왼쪽 위에 있어도 그 아래 줄의 칩과 겹치지 않는다. 버튼이 칩 위로 오면 MS6 이 실패한다", () => {
  assert.deepEqual(failing({}, withTest()), []);
  assert.deepEqual(failing({ testBtn: box(16, 120, 96, 44) }), ["MS6"]);
});

test("MS2: 손님 화면에 칩이 있으면 MS2 만 실패한다", () => {
  assert.deepEqual(failing({ guest: { chipCount: 1 } }), ["MS2"]);
  assert.deepEqual(failing({ guest: null }), ["MS2"]);
});

test("MS3: 방장 탭이 둘이 아니거나 44 미만이거나 손님에게 탭이 있으면 MS3 만 실패한다", () => {
  assert.deepEqual(failing({ tabs: [box(4, 322, 44, 44)] }), ["MS3"]);
  assert.deepEqual(failing({ tabs: [box(4, 322, 40, 44), box(48, 322, 44, 44)] }), ["MS3"]);
  assert.deepEqual(failing({ tabs: [box(4, 322, 44, 40), box(48, 322, 44, 44)] }), ["MS3"]);
  assert.deepEqual(failing({ guestTabs: 2 }), ["MS3"]);
});

test("MS4: 카드가 셋이 아니거나 폭·높이·간격·합·시트 밖이면 MS4 만 실패한다", () => {
  const c = good().cards;
  assert.deepEqual(failing({ cards: c.slice(0, 2) }), ["MS4"]);
  assert.deepEqual(failing({ cards: [box(28, 378, 90, 112), c[1], c[2]] }), ["MS4"]);
  assert.deepEqual(failing({ cards: [box(28, 378, 96, 100), c[1], c[2]] }), ["MS4"]);
  assert.deepEqual(failing({ cards: [c[0], box(140, 378, 96, 112), c[2]] }), ["MS4"]);
  assert.deepEqual(failing({ cards: [box(28, 378, 96, 112), box(140, 378, 96, 112), box(252, 378, 96, 112)] }), ["MS4"]);
  assert.deepEqual(failing({ cards: [c[0], c[1], box(236, 500, 96, 112)] }), ["MS4"]);
});

test("MS5: 선택 카드가 하나가 아니거나 기대 값(기본 random)과 다르면 MS5 만 실패한다", () => {
  assert.deepEqual(failing({ selected: 0 }), ["MS5"]);
  assert.deepEqual(failing({ selected: 2 }), ["MS5"]);
  assert.deepEqual(failing({ selectedId: "bar" }), ["MS5"]);
  assert.deepEqual(failing({ selectedId: "bar", selectedWant: "bar" }), []);
});

test("MS6: 칩이 이름표와 겹치면 MS6 만 실패한다", () => {
  assert.deepEqual(failing({ tags: [box(40, 150, 80, 28)] }), ["MS6"]);
  assert.deepEqual(failing({ tags: [box(68, 150, 80, 28)] }), []); // 칩 오른쪽 끝(68)에 맞닿기만 하면 닿지 않는다
  assert.deepEqual(failing({ tags: [box(0, 150, 30, 28)] }), ["MS6"]);
});

test("측정값이 없으면 해당 항목이 실패한다(거짓 통과 없음)", () => {
  const rows = mapChoiceChecks({ viewport: { w: 360, h: 560 } });
  assert.equal(rows.length, 6);
  for (const r of rows) assert.equal(r.ok, false, r.id);
});

// ---- 22-07: [맵] 단추 mapRailChecks (TM11) — 판 종류가 없어 방장 줄에 [맵] 이 하나 있고 칩이 서버 맵 선택을 보인다 ----

/** 대기실(테스트 방) 정상값: 줄은 맵·봇, 칩은 서버 맵 선택(광장) 그대로 */
const shown = (over = {}) => ({ screen: "lobby", railButtons: ["map", "bots"], mapChoice: "plaza", chipId: "plaza", ...over });
/** 판정 줄은 늘 하나다 */
const one = (m) => {
  const rows = mapRailChecks(m);
  assert.equal(rows.length, 1, `판정 줄 ${rows.length}개`);
  return rows[0];
};

test("TM11: 대기실 줄에 map 이 하나 있고 칩이 맵 선택과 같으면 통과한다", () => {
  const r = one(shown());
  assert.equal(r.id, "TM11");
  assert.equal(r.ok, true, r.detail);
  assert.deepEqual(Object.keys(r).sort(), ["detail", "id", "label", "ok"]);
  assert.equal(one({ railButtons: ["map"], mapChoice: "random" }).ok, true); // 봇 도구가 꺼진 방·칩 값 없음
});

test("TM11: map 이 없거나 둘이면, 줄을 못 읽었으면(단추 0) 실패하고 개수와 줄 이름을 말한다", () => {
  const none = one(shown({ railButtons: ["bots"] }));
  assert.equal(none.ok, false);
  assert.match(none.detail, /map 0개/);
  assert.match(none.detail, /bots/);
  assert.equal(one(shown({ railButtons: ["map", "map", "bots"] })).ok, false);
  const empty = one(shown({ railButtons: [] }));
  assert.equal(empty.ok, false);
  assert.match(empty.detail, /단추 0/);
});

test("TM11: 칩 값이 맵 선택과 다르거나 칩을 못 읽으면 두 값을 말하며 실패한다", () => {
  const chip = one(shown({ chipId: "bar" }));
  assert.equal(chip.ok, false);
  assert.match(chip.detail, /bar/);
  assert.match(chip.detail, /plaza/);
  assert.equal(one(shown({ chipId: null })).ok, false); // 칩을 못 읽음
});

test("TM11c: 결과 화면은 같은 판정을 TM11c 로 낸다", () => {
  const ok = one(shown({ screen: "result", railButtons: ["map"] }));
  assert.equal(ok.id, "TM11c");
  assert.equal(ok.ok, true, ok.detail);
  assert.match(ok.label, /결과 화면/);
  assert.equal(one(shown({ screen: "result", railButtons: [] })).ok, false);
  assert.equal(one(shown({ screen: "result", railButtons: ["bots"] })).ok, false);
});

test("mapRailChecks: 못 잰 입력은 측정값 없음으로 실패한다(공허 통과 금지)", () => {
  for (const m of [undefined, {}, { railButtons: null, mapChoice: "plaza" }, shown({ railButtons: [1] }), shown({ mapChoice: undefined })]) {
    const r = one(m);
    assert.equal(r.ok, false);
    assert.match(r.detail, /측정값 없음/);
  }
});
