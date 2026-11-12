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

// ---- 20-07: [맵] 숨김 mapRailChecks (TM11, D-02·P20-16) — 확장판은 늘 마을이라 [맵] 단추·맵 탭이 없고, 기본 마피아로 되돌리면 이전 맵 선택과 함께 다시 있다 ----

/** 확장판 대기실(테스트 방) 정상값: 줄은 판 종류·봇·튜토리얼, [옷장]으로 연 시트에 맵 탭·카드 0 */
const hidden = (over = {}) => ({ screen: "lobby", mode: "extended", viewMode: "extended", railButtons: ["mode", "bots", "tutorial"], tabs: 0, ...over });
/** 기본 마피아로 되돌린 대기실 정상값: 줄은 판 종류·맵·봇, 맵 선택은 이전 값 그대로이고 칩도 그 값 */
const shown = (over = {}) => ({ screen: "lobby", mode: "basic", viewMode: "basic", railButtons: ["mode", "map", "bots"], mapChoice: "plaza", prevChoice: "plaza", chipId: "plaza", ...over });
/** 판정 줄은 늘 하나다 */
const one = (m) => {
  const rows = mapRailChecks(m);
  assert.equal(rows.length, 1, `판정 줄 ${rows.length}개`);
  return rows[0];
};

test("TM11a: 확장판 줄에 map 이 없고 시트에 맵 탭이 없으면 통과한다", () => {
  const r = one({ mode: "extended", railButtons: ["mode", "bots"], tabs: 0 });
  assert.equal(r.id, "TM11a");
  assert.equal(r.ok, true, r.detail);
  assert.deepEqual(Object.keys(r).sort(), ["detail", "id", "label", "ok"]);
  assert.equal(one(hidden()).ok, true);
  assert.equal(one(hidden({ railButtons: ["mode"] })).ok, true); // 봇 도구가 꺼진 방·튜토리얼이 없는 화면도 [맵] 만 없으면 된다
});

test("TM11a: 확장판 줄에 map 이 있으면 실패하고 개수와 줄 이름을 말한다. 시트에 맵 탭·카드가 있어도, 서버 판 종류가 다른 값이어도 실패한다", () => {
  const r = one(hidden({ railButtons: ["mode", "map", "bots", "tutorial"] }));
  assert.equal(r.id, "TM11a");
  assert.equal(r.ok, false);
  assert.match(r.detail, /map 1개/);
  assert.match(r.detail, /mode·map·bots·tutorial/);
  const t = one(hidden({ tabs: 2 }));
  assert.equal(t.ok, false);
  assert.match(t.detail, /맵 탭·카드 2개/);
  const v = one(hidden({ viewMode: "basic" }));
  assert.equal(v.ok, false);
  assert.match(v.detail, /basic/);
});

test("TM11a·TM11b: 줄을 못 읽었으면(단추 0·mode 없음) [맵] 이 없어도 통과하지 않는다", () => {
  const empty = one(hidden({ railButtons: [] }));
  assert.equal(empty.ok, false);
  assert.match(empty.detail, /mode 단추 없음/);
  assert.equal(one(hidden({ railButtons: ["bots", "tutorial"] })).ok, false);
  assert.equal(one(shown({ railButtons: ["map", "bots"] })).ok, false);
});

test("TM11b: 기본 마피아 줄에 map 이 하나 있고 맵 선택이 이전 값과 같으면 통과, 다르면 두 값을 말하며 실패한다", () => {
  const r = one(shown());
  assert.equal(r.id, "TM11b");
  assert.equal(r.ok, true, r.detail);
  assert.equal(one({ mode: "basic", railButtons: ["mode", "map"], mapChoice: "random", prevChoice: "random" }).ok, true); // 칩 값·서버 판 종류는 주면 본다
  const changed = one(shown({ mapChoice: "random", chipId: "random" }));
  assert.equal(changed.ok, false);
  assert.match(changed.detail, /random/);
  assert.match(changed.detail, /plaza/);
});

test("TM11b: 기본 마피아인데 map 이 없거나 둘이면, 칩 값이 맵 선택과 다르면, 서버 판 종류가 다른 값이면 실패한다", () => {
  const none = one(shown({ railButtons: ["mode", "bots"] }));
  assert.equal(none.ok, false);
  assert.match(none.detail, /map 0개/);
  assert.equal(one(shown({ railButtons: ["mode", "map", "map", "bots"] })).ok, false);
  const chip = one(shown({ chipId: "bar" }));
  assert.equal(chip.ok, false);
  assert.match(chip.detail, /bar/);
  assert.equal(one(shown({ chipId: null })).ok, false); // 칩을 못 읽음
  assert.equal(one(shown({ viewMode: "extended" })).ok, false);
});

test("TM11c: 결과 화면은 같은 판정을 TM11c-숨김(확장판)·TM11c-복귀(기본 마피아)로 낸다", () => {
  const hide = one(hidden({ screen: "result", railButtons: ["mode"] }));
  assert.equal(hide.id, "TM11c-숨김");
  assert.equal(hide.ok, true, hide.detail);
  assert.match(hide.label, /결과 화면/);
  assert.equal(one(hidden({ screen: "result", railButtons: ["mode", "map"] })).ok, false);
  const back = one(shown({ screen: "result", railButtons: ["mode", "map"] }));
  assert.equal(back.id, "TM11c-복귀");
  assert.equal(back.ok, true, back.detail);
  assert.equal(one(shown({ screen: "result", railButtons: ["mode"] })).ok, false);
});

test("mapRailChecks: 못 잰 입력은 측정값 없음으로 실패한다(공허 통과 금지)", () => {
  for (const m of [undefined, {}, { mode: "x", railButtons: [], tabs: 0 }, hidden({ railButtons: null }), hidden({ railButtons: [1] }), hidden({ tabs: undefined }), shown({ mapChoice: undefined }), shown({ prevChoice: null })]) {
    const r = one(m);
    assert.equal(r.ok, false);
    assert.match(r.detail, /측정값 없음/);
  }
});
