// 맵 선택 E2E 순수 판정 단위 테스트 (11-13). 실행: node --test scripts/e2e/mapselect.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { MAP_CHIP, MAP_CARD, MAP_MARKERS, mapChoiceChecks } from "./mapselect.mjs";

const box = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });

// 360×560 폰: 헤더 아래 62, 칩 시각 원 36 은 (16, 70), 누르기 영역 44 는 한 칸씩 바깥(12, 66)
const good = () => ({
  viewport: { w: 360, h: 560 },
  headerBottom: 62,
  chip: { disc: box(16, 70, 36, 36), hit: box(12, 66, 44, 44), label: "맵 랜덤", ariaDisabled: false },
  guest: { ariaDisabled: true, sheetOpened: false },
  sheet: box(0, 310, 360, 250),
  tabs: [box(4, 322, 44, 44), box(48, 322, 44, 44)],
  guestTabs: 0,
  cards: [box(28, 378, 96, 112), box(132, 378, 96, 112), box(236, 378, 96, 112)],
  selected: 1,
  selectedId: "random",
  testBtn: null,
  tags: [box(150, 250, 80, 28), box(230, 300, 70, 28)],
});
// 테스트 버튼이 있으면 칩은 그 오른쪽(+8)으로 비킨다: 버튼 (16..112) → 칩 시각 원 왼쪽 120, 누르기 영역 116(바깥 4)
const withTest = () => ({ ...good(), testBtn: box(16, 70, 96, 44), chip: { ...good().chip, disc: box(120, 70, 36, 36), hit: box(116, 66, 44, 44) } });
const failing = (over, base = good()) => mapChoiceChecks({ ...base, ...over }).filter((r) => !r.ok).map((r) => r.id);

test("mapChoiceChecks: 정상 입력은 MS1~MS6 이 모두 통과한다", () => {
  const rows = mapChoiceChecks(good());
  assert.deepEqual(rows.map((r) => r.id), ["MS1", "MS2", "MS3", "MS4", "MS5", "MS6"]);
  for (const r of rows) assert.equal(r.ok, true, `${r.id}: ${r.detail}`);
});

test("상수: 칩 시각 36·누르기 44·왼쪽 16·헤더 아래 8, 카드 96×112 간격 8 합 304", () => {
  assert.deepEqual({ ...MAP_CHIP }, { disc: 36, hit: 44, left: 16, below: 8 });
  assert.deepEqual({ ...MAP_CARD }, { w: 96, h: 112, gap: 8, total: 304 });
});

test("표식 이름 목록", () => {
  assert.deepEqual([...MAP_MARKERS], ["data-map-chip", "data-map-card", "data-map-tab", "__mfMap"]);
});

test("MS1: 칩 시각 지름·누르기 영역·왼쪽·위가 어긋나면 MS1 만 실패한다", () => {
  const c = good().chip;
  assert.deepEqual(failing({ chip: { ...c, disc: box(16, 70, 40, 40) } }), ["MS1"]);
  assert.deepEqual(failing({ chip: { ...c, hit: box(12, 66, 40, 40) } }), ["MS1"]);
  assert.deepEqual(failing({ chip: { ...c, disc: box(20, 70, 36, 36) } }), ["MS1"]);
  assert.deepEqual(failing({ chip: { ...c, disc: box(16, 90, 36, 36) } }), ["MS1"]);
  assert.deepEqual(failing({ headerBottom: 80 }), ["MS1"]);
  assert.deepEqual(failing({ chip: null }), ["MS1", "MS6"]);
});

test("MS1: [테스트] 버튼이 있으면 칩은 그 오른쪽으로 비킨다(왼쪽 16 대신 버튼 오른쪽 + 8)", () => {
  assert.deepEqual(failing({}, withTest()), []);
  // 비키지 않았다: 왼쪽이 버튼 오른쪽 + 8 이 아니고(MS1) 버튼과 겹친다(MS6)
  assert.deepEqual(failing({ testBtn: box(16, 70, 96, 44) }), ["MS1", "MS6"]);
});

test("MS2: 손님 칩이 aria-disabled 가 아니거나 눌러서 시트가 열리면 MS2 만 실패한다", () => {
  assert.deepEqual(failing({ guest: { ariaDisabled: false, sheetOpened: false } }), ["MS2"]);
  assert.deepEqual(failing({ guest: { ariaDisabled: true, sheetOpened: true } }), ["MS2"]);
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
  assert.deepEqual(failing({ tags: [box(40, 80, 80, 28)] }), ["MS6"]);
  assert.deepEqual(failing({ tags: [box(60, 68, 80, 28)] }), []); // 누르기 영역 오른쪽 끝(56)을 넘으면 닿지 않는다
  assert.deepEqual(failing({ tags: [box(50, 68, 80, 28)] }), ["MS6"]);
});

test("측정값이 없으면 해당 항목이 실패한다(거짓 통과 없음)", () => {
  const rows = mapChoiceChecks({ viewport: { w: 360, h: 560 } });
  assert.equal(rows.length, 6);
  for (const r of rows) assert.equal(r.ok, false, r.id);
});
