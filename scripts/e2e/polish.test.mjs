// 18.1 화면 E2E 순수 판정 단위 테스트 (18.1-08). 실행: node --test scripts/e2e/polish.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  CARD_INNER_INSET,
  REVEAL_DOCK_GAP,
  ROLE_ART_MIN_H,
  ROLE_CARD_MAX_LINES,
  ROLE_CARD_MAX_LINES_SHORT_DOCTOR,
  ROLE_SHEET_MAX_LINES,
  TOD_BOX,
  TOD_BY_PHASE,
  TOD_HEADER_Y,
  TOD_IDS,
  TOD_ABSENT_PHASES,
  TUTORIAL_ROLE_MAX_LINES,
  revealCardChecks,
  revealStageChecks,
  roleLineBoxChecks,
  todAbsentChecks,
  todChecks,
} from "./polish.mjs";
import { ROLE_LINES } from "./lib.mjs";

const box = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });
const ids = (rows) => rows.map((r) => r.id);
const failing = (rows) => rows.filter((r) => !r.ok).map((r) => r.id);

// ---- 상수 ----

test("상수: UI-SPEC 값 그대로", () => {
  assert.equal(ROLE_CARD_MAX_LINES, 3);
  assert.equal(ROLE_CARD_MAX_LINES_SHORT_DOCTOR, 4);
  assert.equal(ROLE_SHEET_MAX_LINES, 4);
  assert.equal(TUTORIAL_ROLE_MAX_LINES, 4);
  assert.equal(ROLE_ART_MIN_H, 64);
  assert.equal(CARD_INNER_INSET, 14);
  assert.equal(TOD_BOX, 44);
  assert.deepEqual([...TOD_HEADER_Y], [8, 52]);
  assert.equal(REVEAL_DOCK_GAP, 8);
  assert.deepEqual([...TOD_IDS], ["morning", "day", "dusk", "night"]);
});

test("TOD_BY_PHASE 키 11개·TOD_ABSENT_PHASES 5개, 값은 네 시간대 안", () => {
  assert.equal(Object.keys(TOD_BY_PHASE).length, 11);
  assert.deepEqual([...TOD_ABSENT_PHASES].sort(), ["assigning", "ended", "lobby", "roleReveal", "tutorial"]);
  for (const v of Object.values(TOD_BY_PHASE)) assert.ok(TOD_IDS.includes(v));
  assert.equal(TOD_BY_PHASE.night, "night");
  assert.equal(TOD_BY_PHASE.morning, "morning");
  assert.equal(TOD_BY_PHASE.nomination, "dusk");
});

// ---- revealCardChecks ----

// 360×640 시민: 카드 222×333 (left 69, top 200), 안쪽 틀 14
const cardGood = (role = "citizen") => {
  const face = box(69, 200, 222, 333);
  const inner = box(69 + 14, 200 + 14, 222 - 28, 333 - 28);
  return {
    face,
    inner,
    children: [
      { kind: "art", rect: box(100, 230, 160, 130) },
      { kind: "name", rect: box(100, 370, 160, 43) },
      { kind: "desc", rect: box(100, 420, 160, 72) },
    ],
    desc: { height: 72, lineHeight: 24, whiteSpace: "pre-line", text: ROLE_LINES[role], firstLines: 1, secondNewLine: true },
    blocks: 2,
    goalCount: 0,
    domText: ROLE_LINES[role],
  };
};
const cardCheck = (over = {}, ctx = {}) => revealCardChecks({ ...cardGood(ctx.role ?? "citizen"), ...over }, { size: { w: 360, h: 640 }, role: "citizen", ...ctx });

test("revealCardChecks: 정상 입력은 A1a~A1e 가 모두 통과한다", () => {
  const rows = cardCheck();
  assert.deepEqual(ids(rows), ["A1a", "A1b", "A1c", "A1d", "A1e"]);
  for (const r of rows) assert.equal(r.ok, true, `${r.id}: ${r.detail}`);
});

test("revealCardChecks: 마피아는 글 덩어리 셋(+동료 줄)이 정상", () => {
  const rows = cardCheck({ blocks: 3 }, { role: "mafia" });
  assert.deepEqual(failing(rows), []);
  assert.deepEqual(failing(cardCheck({ blocks: 2 }, { role: "mafia" })), ["A1a"]);
});

test("revealCardChecks: 목표 줄 1개면 A1a 실패", () => {
  assert.deepEqual(failing(cardCheck({ goalCount: 1 })), ["A1a"]);
});

test("revealCardChecks: 글 덩어리가 3개(시민)면 A1a 실패", () => {
  assert.deepEqual(failing(cardCheck({ blocks: 3 })), ["A1a"]);
});

test("revealCardChecks: 4줄(높이 96)은 360×560 의사만 통과", () => {
  const four = { desc: { ...cardGood("doctor").desc, height: 96 } };
  const d = (size, role) => failing(revealCardChecks({ ...cardGood(role), ...four }, { size, role }));
  assert.deepEqual(d({ w: 360, h: 560 }, "doctor"), []);
  assert.deepEqual(d({ w: 360, h: 640 }, "doctor"), ["A1b"]);
  assert.ok(d({ w: 360, h: 560 }, "citizen").includes("A1b"));
});

test("revealCardChecks: pre-line 이 아니면 A1b 실패", () => {
  assert.deepEqual(failing(cardCheck({ desc: { ...cardGood().desc, whiteSpace: "normal" } })), ["A1b"]);
});

test("revealCardChecks: 첫 문장이 두 줄이거나 둘째 문장이 새 줄이 아니면 A1b 실패", () => {
  assert.deepEqual(failing(cardCheck({ desc: { ...cardGood().desc, firstLines: 2 } })), ["A1b"]);
  assert.deepEqual(failing(cardCheck({ desc: { ...cardGood().desc, secondNewLine: false } })), ["A1b"]);
});

test("revealCardChecks: 문구가 ROLE_LINES 와 다르면 A1c 실패", () => {
  assert.deepEqual(failing(cardCheck({ desc: { ...cardGood().desc, text: "당신은 시민입니다. 추리로 마피아를 찾아내세요." } })), ["A1c"]);
});

test("revealCardChecks: 다른 직업 문장이 DOM 에 있으면 A1d 실패", () => {
  assert.deepEqual(failing(cardCheck({ domText: `${ROLE_LINES.citizen}\n${ROLE_LINES.mafia}` })), ["A1d"]);
});

test("revealCardChecks: 자식이 안쪽 틀 밖이면 A1e 실패", () => {
  const children = cardGood().children.map((c) => (c.kind === "desc" ? { ...c, rect: box(75, 420, 160, 72) } : c));
  assert.deepEqual(failing(cardCheck({ children })), ["A1e"]);
});

test("revealCardChecks: 자식끼리 겹치면 A1e 실패", () => {
  const children = cardGood().children.map((c) => (c.kind === "name" ? { ...c, rect: box(100, 400, 160, 43) } : c));
  assert.deepEqual(failing(cardCheck({ children })), ["A1e"]);
});

test("revealCardChecks: 그림 높이 64 통과·63 실패", () => {
  const withArt = (h) => cardGood().children.map((c) => (c.kind === "art" ? { ...c, rect: box(100, 230, 160, h) } : c));
  // 그림이 줄면 아래 글이 위로 갈 일은 없으니 사각형만 바꾼다(교차 없음 유지)
  assert.deepEqual(failing(cardCheck({ children: withArt(64) })), []);
  assert.deepEqual(failing(cardCheck({ children: withArt(63) })), ["A1e"]);
});

test("revealCardChecks: 측정값이 없으면 각 줄이 측정값 없음으로 실패한다", () => {
  const rows = revealCardChecks(null, { size: { w: 360, h: 640 }, role: "citizen" });
  assert.deepEqual(ids(rows), ["A1a", "A1b", "A1c", "A1d", "A1e"]);
  for (const r of rows) {
    assert.equal(r.ok, false);
    assert.match(r.detail, /측정값 없음/);
  }
  const partial = revealCardChecks({ ...cardGood(), desc: null }, { size: { w: 360, h: 640 }, role: "citizen" });
  assert.ok(failing(partial).includes("A1b"));
  assert.match(partial.find((r) => r.id === "A1b").detail, /측정값 없음/);
});

// ---- revealStageChecks ----

// 360×640: 소리 단추 독 아랫변 189, 카드 위 끝 197 이상
const stageGood = () => ({
  tagsVisible: 0,
  card: box(69, 197, 222, 333),
  headerButtons: [box(16, 8, 96, 44)],
  band: box(16, 62, 328, 60),
  soundButtons: [box(292, 130, 52, 52)],
  dock: box(16, 124, 328, 65),
});

test("revealStageChecks: 정상 입력은 A2a·A2b 통과", () => {
  const rows = revealStageChecks(stageGood());
  assert.deepEqual(ids(rows), ["A2a", "A2b"]);
  for (const r of rows) assert.equal(r.ok, true, `${r.id}: ${r.detail}`);
});

test("revealStageChecks: 보이는 이름표가 있으면 A2a 실패", () => {
  assert.deepEqual(failing(revealStageChecks({ ...stageGood(), tagsVisible: 1 })), ["A2a"]);
});

test("revealStageChecks: 카드 위 끝이 독 + 7 이면 A2b 실패, + 8 이면 통과", () => {
  assert.deepEqual(failing(revealStageChecks({ ...stageGood(), card: box(69, 196, 222, 333) })), ["A2b"]);
  assert.deepEqual(failing(revealStageChecks({ ...stageGood(), card: box(69, 197, 222, 333) })), []);
});

test("revealStageChecks: 카드가 띠·소리 단추·헤더 단추와 겹치면 A2b 실패", () => {
  assert.deepEqual(failing(revealStageChecks({ ...stageGood(), card: box(69, 100, 222, 333), dock: box(16, 20, 328, 10) })), ["A2b"]);
  assert.deepEqual(failing(revealStageChecks({ ...stageGood(), headerButtons: [box(100, 190, 96, 44)] })), ["A2b"]);
  assert.deepEqual(failing(revealStageChecks({ ...stageGood(), soundButtons: [box(250, 300, 52, 52)] })), ["A2b"]);
});

test("revealStageChecks: 측정값이 없으면 측정값 없음으로 실패", () => {
  const rows = revealStageChecks(null);
  assert.deepEqual(ids(rows), ["A2a", "A2b"]);
  for (const r of rows) {
    assert.equal(r.ok, false);
    assert.match(r.detail, /측정값 없음/);
  }
  assert.deepEqual(failing(revealStageChecks({ ...stageGood(), dock: null })), ["A2b"]);
});

// ---- roleLineBoxChecks ----

const lineGood = () => ({ height: 60, lineHeight: 20, whiteSpace: "pre-line", firstLines: 1, secondNewLine: true, goalCount: 0 });

test("roleLineBoxChecks: pre-line·3줄·둘째 문장 새 줄이면 통과", () => {
  const r = roleLineBoxChecks([lineGood()], { max: 4, id: "A1s" });
  assert.equal(r.id, "A1s");
  assert.equal(r.ok, true, r.detail);
});

test("roleLineBoxChecks: 4줄 상한 — 80/20 통과, 100/20 실패", () => {
  assert.equal(roleLineBoxChecks([{ ...lineGood(), height: 80 }], { max: 4, id: "x" }).ok, true);
  assert.equal(roleLineBoxChecks([{ ...lineGood(), height: 100 }], { max: 4, id: "x" }).ok, false);
});

test("roleLineBoxChecks: white-space normal 이면 실패", () => {
  assert.equal(roleLineBoxChecks([{ ...lineGood(), whiteSpace: "normal" }], { max: 4, id: "x" }).ok, false);
});

test("roleLineBoxChecks: 둘째 문장이 새 줄이 아니거나 첫 문장이 접히면 실패", () => {
  assert.equal(roleLineBoxChecks([{ ...lineGood(), secondNewLine: false }], { max: 4, id: "x" }).ok, false);
  assert.equal(roleLineBoxChecks([{ ...lineGood(), firstLines: 2 }], { max: 4, id: "x" }).ok, false);
});

test("roleLineBoxChecks: 목표 줄이 남아 있으면 실패", () => {
  assert.equal(roleLineBoxChecks([{ ...lineGood(), goalCount: 1 }], { max: 4, id: "x" }).ok, false);
});

test("roleLineBoxChecks: height 가 없으면 lines 로 센다(튜토리얼 인라인 글)", () => {
  assert.equal(roleLineBoxChecks([{ lines: 4, whiteSpace: "pre-line", firstLines: 1, secondNewLine: true }], { max: 4, id: "x" }).ok, true);
  assert.equal(roleLineBoxChecks([{ lines: 5, whiteSpace: "pre-line", firstLines: 1, secondNewLine: true }], { max: 4, id: "x" }).ok, false);
});

test("roleLineBoxChecks: 상자가 없거나 비면 측정값 없음으로 실패, expect 개수를 지키지 않아도 실패", () => {
  assert.match(roleLineBoxChecks([], { max: 4, id: "x" }).detail, /측정값 없음/);
  assert.match(roleLineBoxChecks(null, { max: 4, id: "x" }).detail, /측정값 없음/);
  assert.equal(roleLineBoxChecks([lineGood()], { max: 4, id: "x", count: 4 }).ok, false);
  assert.equal(roleLineBoxChecks([lineGood(), lineGood(), lineGood(), lineGood()], { max: 4, id: "x", count: 4 }).ok, true);
});

// ---- todChecks ----

const todGood = (phase = "discussion") => {
  const tod = TOD_BY_PHASE[phase];
  return {
    count: 1,
    tod,
    rect: box(248, 8, 44, 44),
    radius: 9999,
    imgs: TOD_IDS.map((x) => ({ src: `/weather/weather-${x}.svg?v=1`, naturalWidth: 88, opacity: x === tod ? 1 : 0 })),
    title: box(16, 8, 150, 29),
    roleBtn: box(300, 8, 44, 44),
    band: box(16, 62, 328, 60),
    soundButtons: [box(292, 130, 52, 52)],
    header: box(0, 0, 360, 62),
  };
};

test("todChecks: 정상 입력은 D1·D4·D5 통과", () => {
  const rows = todChecks(todGood(), { phase: "discussion" });
  assert.deepEqual(ids(rows), ["D1", "D4", "D5"]);
  for (const r of rows) assert.equal(r.ok, true, `${r.id}: ${r.detail}`);
});

test("todChecks: 모든 맵 단계의 기대값이 통과", () => {
  for (const phase of Object.keys(TOD_BY_PHASE)) assert.deepEqual(failing(todChecks(todGood(phase), { phase })), [], phase);
});

test("todChecks: 값이 단계 기대와 다르면 D1 실패", () => {
  assert.deepEqual(failing(todChecks({ ...todGood("discussion"), tod: "night" }, { phase: "discussion" })), ["D1"]);
});

test("todChecks: 배지가 0개거나 2개면 D1 실패", () => {
  assert.ok(failing(todChecks({ ...todGood(), count: 0 }, { phase: "discussion" })).includes("D1"));
  assert.ok(failing(todChecks({ ...todGood(), count: 2 }, { phase: "discussion" })).includes("D1"));
});

test("todChecks: 헤더 밖(y 8~52 벗어남)이면 D1 실패, ±1 은 허용", () => {
  assert.deepEqual(failing(todChecks({ ...todGood(), rect: box(248, 20, 44, 44) }, { phase: "discussion" })).includes("D1"), true);
  assert.deepEqual(failing(todChecks({ ...todGood(), rect: box(248, 9, 44, 44) }, { phase: "discussion" })), []);
});

test("todChecks: 배지가 [역할 카드]·제목과 겹치면 D1 실패", () => {
  assert.ok(failing(todChecks({ ...todGood(), rect: box(290, 8, 44, 44) }, { phase: "discussion" })).includes("D1"));
  assert.ok(failing(todChecks({ ...todGood(), rect: box(100, 8, 44, 44) }, { phase: "discussion" })).includes("D1"));
});

test("todChecks: img 하나가 naturalWidth 0 이면 D5 실패", () => {
  const g = todGood();
  g.imgs[2] = { ...g.imgs[2], naturalWidth: 0 };
  assert.deepEqual(failing(todChecks(g, { phase: "discussion" })), ["D5"]);
});

test("todChecks: 불투명도 1 이 둘이거나 지금 그림이 아니면 D5 실패", () => {
  const g = todGood();
  g.imgs[3] = { ...g.imgs[3], opacity: 1 };
  assert.deepEqual(failing(todChecks(g, { phase: "discussion" })), ["D5"]);
  const h = todGood();
  h.imgs = h.imgs.map((i) => ({ ...i, opacity: i.src.includes("night") ? 1 : 0 }));
  assert.deepEqual(failing(todChecks(h, { phase: "discussion" })), ["D5"]);
});

test("todChecks: 크기가 44×44 가 아니거나 원이 아니면 D5 실패", () => {
  assert.deepEqual(failing(todChecks({ ...todGood(), rect: box(248, 8, 40, 44) }, { phase: "discussion" })).includes("D5"), true);
  assert.deepEqual(failing(todChecks({ ...todGood(), radius: 4 }, { phase: "discussion" })), ["D5"]);
});

test("todChecks: 배지가 소리 단추와 겹치거나 헤더 높이가 62 가 아니면 D4 실패", () => {
  assert.deepEqual(failing(todChecks({ ...todGood(), soundButtons: [box(250, 20, 52, 52)] }, { phase: "discussion" })), ["D4"]);
  assert.deepEqual(failing(todChecks({ ...todGood(), header: box(0, 0, 360, 70) }, { phase: "discussion" })), ["D4"]);
});

test("todChecks: 측정값이 없으면 측정값 없음으로 실패", () => {
  const rows = todChecks(null, { phase: "discussion" });
  assert.deepEqual(ids(rows), ["D1", "D4", "D5"]);
  for (const r of rows) {
    assert.equal(r.ok, false);
    assert.match(r.detail, /측정값 없음/);
  }
});

test("todChecks: 게임 맵 밖 단계를 부르면 D1 실패(호출 실수)", () => {
  assert.ok(failing(todChecks(todGood(), { phase: "lobby" })).includes("D1"));
});

// ---- todAbsentChecks ----

test("todAbsentChecks: 0개면 통과, 1개면 D2 실패, 숫자가 아니면 측정값 없음", () => {
  assert.equal(todAbsentChecks(0, { screen: "lobby" }).ok, true);
  const r = todAbsentChecks(1, { screen: "lobby" });
  assert.equal(r.ok, false);
  assert.equal(r.id, "D2");
  assert.match(todAbsentChecks(null, { screen: "lobby" }).detail, /측정값 없음/);
});
