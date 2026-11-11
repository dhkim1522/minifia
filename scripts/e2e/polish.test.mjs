// 18.1 화면 E2E 순수 판정 단위 테스트 (18.1-08). 실행: node --test scripts/e2e/polish.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  CARD_INNER_INSET,
  CHAT_CONTROL_H,
  CHAT_FADE_H,
  CHAT_LOG_H,
  CHAT_MIN_LINES,
  CHAT_SHEET_CLOSE_MS,
  CHAT_SHEET_DRAG_PX,
  CHAT_WINDOW_MAX_LINES,
  GHOST_JOB_OUTFIT_E2E,
  GHOST_STILL_TOL,
  LIVE_GHOST_ABSENT_PHASES,
  REVEAL_DOCK_GAP,
  ROLE_ART_MIN_H,
  ROLE_CARD_MAX_LINES,
  ROLE_CARD_MAX_LINES_SHORT_DOCTOR,
  ROLE_SHEET_MAX_LINES,
  TOD_BY_PHASE,
  TOD_IDS,
  TOD_ABSENT_PHASES,
  TOD_LINE_MAX_H,
  TOD_WORD,
  TUTORIAL_ROLE_MAX_LINES,
  revealCardChecks,
  chatSheetChecks,
  chatWindowChecks,
  ghostStillChecks,
  ghostViewChecks,
  liveGhostChecks,
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
  assert.equal(TOD_LINE_MAX_H, 40);
  assert.deepEqual({ ...TOD_WORD }, { morning: "아침", day: "낮", dusk: "저녁", night: "밤" });
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

const WORD_OF = { day: "낮", dusk: "저녁", night: null, morning: null };
const TITLE_OF = { dayAnnounce: "토론", errand: "심부름", discussion: "토론", nomination: "투표", runoff: "결선", showdown: "마지막 3인", defense: "최후 변론", verdict: "찬반", execution: "처형", night: "밤", morning: "아침" };
const todGood = (phase = "discussion") => {
  const tod = TOD_BY_PHASE[phase];
  return {
    count: 1,
    tod,
    word: WORD_OF[tod],
    titleText: TITLE_OF[phase],
    line: box(16, 18, 150, 29),
    title: box(76, 18, 90, 29),
    header: box(0, 0, 360, 62),
    headerButtons: [box(300, 8, 44, 44)],
    oldBadges: 0,
    weatherImgs: 0,
  };
};

test("todChecks: 정상 입력은 D1·D4·D5 통과", () => {
  const rows = todChecks(todGood(), { phase: "discussion" });
  assert.deepEqual(ids(rows), ["D1", "D4", "D5"]);
  for (const r of rows) assert.equal(r.ok, true, `${r.id}: ${r.detail}`);
});

test("todChecks: 모든 맵 단계의 기대 입력이 통과", () => {
  for (const phase of Object.keys(TOD_BY_PHASE)) assert.deepEqual(failing(todChecks(todGood(phase), { phase })), [], phase);
});

test("todChecks: 값이 단계 기대와 다르면 D1 실패", () => {
  assert.deepEqual(failing(todChecks({ ...todGood("discussion"), tod: "night" }, { phase: "discussion" })), ["D1"]);
});

test("todChecks: [data-tod] 가 0개거나 2개면 D1 실패", () => {
  assert.ok(failing(todChecks({ ...todGood(), count: 0 }, { phase: "discussion" })).includes("D1"));
  assert.ok(failing(todChecks({ ...todGood(), count: 2 }, { phase: "discussion" })).includes("D1"));
});

test("todChecks: 밤인데 낱말 요소가 있으면 D1 실패, 아침도 같다", () => {
  assert.deepEqual(failing(todChecks({ ...todGood("night"), word: "밤" }, { phase: "night" })), ["D1"]);
  assert.deepEqual(failing(todChecks({ ...todGood("morning"), word: "아침" }, { phase: "morning" })), ["D1"]);
});

test("todChecks: 토론인데 낱말이 없거나 '저녁' 이면 D1 실패", () => {
  assert.deepEqual(failing(todChecks({ ...todGood(), word: null }, { phase: "discussion" })), ["D1"]);
  assert.deepEqual(failing(todChecks({ ...todGood(), word: "저녁" }, { phase: "discussion" })), ["D1"]);
});

test("todChecks: 헤더 높이가 62 가 아니면 D4 실패, ±1 은 허용", () => {
  assert.deepEqual(failing(todChecks({ ...todGood(), header: box(0, 0, 360, 70) }, { phase: "discussion" })), ["D4"]);
  assert.deepEqual(failing(todChecks({ ...todGood(), header: box(0, 0, 360, 63) }, { phase: "discussion" })), []);
});

test("todChecks: 헤더 줄이 두 줄 높이면 D4 실패", () => {
  assert.deepEqual(failing(todChecks({ ...todGood(), line: box(16, 18, 90, 58), title: box(16, 47, 90, 29) }, { phase: "discussion" })), ["D4"]);
});

test("todChecks: 헤더 줄 오른쪽 끝이 헤더 단추 왼쪽 끝을 넘으면 D4 실패", () => {
  assert.deepEqual(failing(todChecks({ ...todGood(), title: box(76, 18, 240, 29) }, { phase: "discussion" })), ["D4"]);
  assert.deepEqual(failing(todChecks({ ...todGood(), headerButtons: [box(100, 8, 44, 44)] }, { phase: "discussion" })), ["D4"]);
  assert.deepEqual(failing(todChecks({ ...todGood(), headerButtons: [] }, { phase: "discussion" })), []);
});

test("todChecks: 옛 배지 수 1 이거나 날씨 그림 수 1 이면 D5 실패", () => {
  assert.deepEqual(failing(todChecks({ ...todGood(), oldBadges: 1 }, { phase: "discussion" })), ["D5"]);
  assert.deepEqual(failing(todChecks({ ...todGood(), weatherImgs: 1 }, { phase: "discussion" })), ["D5"]);
});

test("todChecks: 측정값이 없으면 측정값 없음으로 실패(공허 통과 금지)", () => {
  const rows = todChecks(null, { phase: "discussion" });
  assert.deepEqual(ids(rows), ["D1", "D4", "D5"]);
  for (const r of rows) {
    assert.equal(r.ok, false);
    assert.match(r.detail, /측정값 없음/);
  }
  const g = todGood();
  delete g.line;
  assert.match(todChecks(g, { phase: "discussion" }).find((r) => r.id === "D4").detail, /측정값 없음/);
  const h = todGood();
  delete h.oldBadges;
  assert.match(todChecks(h, { phase: "discussion" }).find((r) => r.id === "D5").detail, /측정값 없음/);
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

// ---- B 채팅 두 줄 창 (18.1-09) ----

test("채팅 상수: UI-SPEC 값 그대로", () => {
  assert.equal(CHAT_LOG_H, 68);
  assert.equal(CHAT_FADE_H, 12);
  assert.equal(CHAT_WINDOW_MAX_LINES, 2);
  assert.equal(CHAT_CONTROL_H, 48);
  assert.equal(CHAT_SHEET_DRAG_PX, 120);
  assert.equal(CHAT_SHEET_CLOSE_MS, 300);
  assert.equal(CHAT_MIN_LINES, 6);
});

// 기록 칸 {top 500, bottom 568}, 줄 높이 24(16px × 1.5)·줄 틈 4·아래 안쪽 여백 8. 띠(흐림 12 아래) = [512, 568].
// 맨 아래 두 줄이 띠 안(536~560, 508~532 중 512 아래 20px), 위 줄들은 띠 위로 잘려 나간다
const winGood = () => ({
  log: box(16, 500, 328, 68),
  input: box(16, 580, 270, 48),
  send: box(292, 580, 48, 48),
  lineHeight: 24,
  msgs: [box(16, 396, 328, 24), box(16, 424, 328, 24), box(16, 452, 328, 24), box(16, 480, 328, 24), box(16, 508, 328, 24), box(16, 536, 328, 24)],
});

test("chatWindowChecks: 정상(6줄 중 맨 아래 둘만 보임)은 B1·B2 통과", () => {
  const rows = chatWindowChecks(winGood());
  assert.deepEqual(ids(rows), ["B1", "B2"]);
  assert.deepEqual(failing(rows), []);
  assert.match(rows[1].detail + rows[1].label, /2/);
});

test("chatWindowChecks: 줄 셋이 띠 안이면 B2 실패", () => {
  const m = winGood();
  m.msgs[3] = box(16, 484, 328, 24); // 띠 위 끝 512 에 닿지 않음 — 안 셈
  assert.deepEqual(failing(chatWindowChecks(m)), []);
  m.msgs[3] = box(16, 490, 328, 24); // 490~514 → 보이는 2
  m.msgs[4] = box(16, 516, 328, 24);
  m.msgs[5] = box(16, 542, 328, 24);
  assert.deepEqual(failing(chatWindowChecks(m)), []); // 490~514 는 2px 만 걸쳐 안 셈 — 보이는 건 둘
  m.msgs[3] = box(16, 500, 328, 24); // 500~524 → 보이는 12 = 절반
  assert.deepEqual(failing(chatWindowChecks(m)), ["B2"]);
});

test("chatWindowChecks: 줄 높이 절반 이상 보이는 줄만 센다(절반은 셈, 절반 미만은 안 셈)", () => {
  const m = winGood();
  m.msgs[3] = box(16, 500, 328, 24); // 띠 시작 512 → 보이는 높이 12 = 절반 → 센다
  assert.deepEqual(failing(chatWindowChecks(m)), ["B2"]);
  m.msgs[3] = box(16, 499, 328, 24); // 499~523 → 보이는 높이 11 < 12
  assert.deepEqual(failing(chatWindowChecks(m)), []);
});

test("chatWindowChecks: 줄이 6 미만이면 측정 조건 미달로 B2 실패(공허 통과 금지)", () => {
  const m = winGood();
  m.msgs = m.msgs.slice(0, 5);
  const rows = chatWindowChecks(m);
  assert.deepEqual(failing(rows), ["B2"]);
  assert.match(rows[1].detail, /측정 조건 미달/);
});

test("chatWindowChecks: 보이는 줄이 0 이면 B2 실패(창이 비어 있음)", () => {
  const m = winGood();
  m.msgs = m.msgs.map((r, i) => box(16, 100 + i * 28, 328, 24));
  assert.deepEqual(failing(chatWindowChecks(m)), ["B2"]);
});

test("chatWindowChecks: 기록 칸 68±1·입력칸 48·보내기 48×48 아니면 B1 실패", () => {
  assert.deepEqual(failing(chatWindowChecks({ ...winGood(), log: box(16, 500, 328, 69) })), []);
  assert.deepEqual(failing(chatWindowChecks({ ...winGood(), log: box(16, 500, 328, 70) })), ["B1"]);
  assert.deepEqual(failing(chatWindowChecks({ ...winGood(), input: box(16, 580, 270, 44) })), ["B1"]);
  assert.deepEqual(failing(chatWindowChecks({ ...winGood(), send: box(292, 580, 44, 48) })), ["B1"]);
});

test("chatWindowChecks: 측정값이 없으면 측정값 없음으로 실패", () => {
  const rows = chatWindowChecks(null);
  assert.deepEqual(ids(rows), ["B1", "B2"]);
  for (const r of rows) assert.match(r.detail, /측정값 없음/);
});

test("chatWindowChecks: long 은 가장 새 줄의 보이는 글줄 ≤ 2 와 칸 안에 끝남을 B2L 로 더한다", () => {
  // 긴 줄: 3글줄(72px)이 칸 아래(바닥 여백 8)에 끝 맞춤 → 맨 위 글줄(488~512)은 띠 위라 보이는 글줄 2
  const longMsg = box(16, 488, 328, 72);
  const long = { ...winGood(), msgs: [...winGood().msgs.slice(0, 5), longMsg] };
  const rows = chatWindowChecks(long, { long: true });
  assert.deepEqual(ids(rows), ["B1", "B2", "B2L"]);
  assert.equal(rows[2].ok, true, rows[2].detail);
  // 칸 밖으로 넘치면(아래 끝이 칸 아래 +1 초과) 실패
  const over = { ...winGood(), msgs: [...winGood().msgs.slice(0, 5), box(16, 500, 328, 72)] };
  assert.equal(chatWindowChecks(over, { long: true })[2].ok, false);
  // 글줄 셋이 다 보이면 실패 (줄 높이 20, 505~565: 첫 글줄 13px 보임)
  const three = { ...winGood(), lineHeight: 20, msgs: [...winGood().msgs.slice(0, 5), box(16, 505, 328, 60)] };
  assert.equal(chatWindowChecks(three, { long: true })[2].ok, false);
  // long 이 아니면 B2L 줄이 없다
  assert.deepEqual(ids(chatWindowChecks(long)), ["B1", "B2"]);
});

// ---- B 기록 시트 (18.1-09) ----

const sheetGood = () => ({
  open: { dialog: true, sheetClass: true, sheetLines: 7, windowLines: 7 },
  closes: [
    { via: "button", closed: true, focusOnOpenBtn: true },
    { via: "escape", closed: true, focusOnOpenBtn: true },
    { via: "drag", closed: true, focusOnOpenBtn: true },
  ],
  draft: { before: "쓰던 글", after: ["쓰던 글", "쓰던 글", "쓰던 글"] },
});

test("chatSheetChecks: 정상은 B3·B4 통과", () => {
  const rows = chatSheetChecks(sheetGood());
  assert.deepEqual(ids(rows), ["B3", "B4"]);
  assert.deepEqual(failing(rows), []);
});

test("chatSheetChecks: 시트가 안 열리거나 .mf-sheet--chatlog 가 아니면 B3 실패", () => {
  const a = sheetGood();
  a.open.dialog = false;
  assert.deepEqual(failing(chatSheetChecks(a)), ["B3"]);
  const b = sheetGood();
  b.open.sheetClass = false;
  assert.deepEqual(failing(chatSheetChecks(b)), ["B3"]);
});

test("chatSheetChecks: 시트 줄 수가 칸 줄 수보다 적으면 B3 실패", () => {
  const m = sheetGood();
  m.open.sheetLines = 5;
  assert.deepEqual(failing(chatSheetChecks(m)), ["B3"]);
});

test("chatSheetChecks: 닫히지 않는 길이 하나라도 있으면 B3 실패, 세 길이 다 있어야 한다", () => {
  const m = sheetGood();
  m.closes[2].closed = false;
  assert.deepEqual(failing(chatSheetChecks(m)), ["B3"]);
  const n = sheetGood();
  n.closes = n.closes.slice(0, 2);
  assert.deepEqual(failing(chatSheetChecks(n)), ["B3"]);
});

test("chatSheetChecks: 포커스가 [data-chat-open] 으로 안 돌아오면 B3 실패", () => {
  const m = sheetGood();
  m.closes[1].focusOnOpenBtn = false;
  const rows = chatSheetChecks(m);
  assert.deepEqual(failing(rows), ["B3"]);
  assert.match(rows[0].detail, /escape/);
});

test("chatSheetChecks: 입력 글이 바뀌거나 비면 B4 실패, 처음부터 비어 있어도 실패", () => {
  const a = sheetGood();
  a.draft.after[1] = "";
  assert.deepEqual(failing(chatSheetChecks(a)), ["B4"]);
  const b = sheetGood();
  b.draft = { before: "", after: ["", "", ""] };
  assert.deepEqual(failing(chatSheetChecks(b)), ["B4"]);
});

test("chatSheetChecks: 측정값이 없으면 측정값 없음으로 실패", () => {
  const rows = chatSheetChecks(null);
  assert.deepEqual(ids(rows), ["B3", "B4"]);
  for (const r of rows) assert.match(r.detail, /측정값 없음/);
});

// ---- C 산 사람 화면 유령 (18.1-09) ----

test("유령 상수: 직업 의상 표·밤/심부름 단계·위치 허용 오차", () => {
  assert.deepEqual({ ...GHOST_JOB_OUTFIT_E2E }, { mafia: "mafia", police: "police", doctor: "doctor", citizen: "coat" });
  assert.deepEqual([...LIVE_GHOST_ABSENT_PHASES].sort(), ["errand", "night"]);
  assert.equal(GHOST_STILL_TOL, 0.05);
});

// 산 사람 화면: 죽은 좌석 [3] 이 마지막 자리에 코트 안개 유령으로 남아 있다
const liveGood = () => ({
  hook: true,
  seats: [{ seat: 3, shown: { x: 1.5, z: -2 }, ghostTags: 1, chips: 0 }],
  outfits: {},
  roleChips: 0,
  ghostSeats: 0,
});
const liveRows = (over = {}, ctx = {}) => liveGhostChecks({ ...liveGood(), ...over }, { deadSeats: [3], phase: "discussion", ...ctx });

test("liveGhostChecks: 정상(shown·is-ghost 이름표 1·빈 의상 표·칩 0·표식 0)은 C1·C2 통과", () => {
  const rows = liveRows();
  assert.deepEqual(ids(rows), ["C1", "C2"]);
  assert.deepEqual(failing(rows), []);
});

test("liveGhostChecks: 의상 표가 없는 페이지(null)도 통과, 빈 표도 통과", () => {
  assert.deepEqual(failing(liveRows({ outfits: null })), []);
});

test("liveGhostChecks: shown 이 null 이면 C1 실패", () => {
  assert.deepEqual(failing(liveRows({ seats: [{ seat: 3, shown: null, ghostTags: 1, chips: 0 }] })), ["C1"]);
});

test("liveGhostChecks: is-ghost 이름표가 0개거나 2개면 C1 실패", () => {
  assert.deepEqual(failing(liveRows({ seats: [{ seat: 3, shown: { x: 0, z: 0 }, ghostTags: 0, chips: 0 }] })), ["C1"]);
  assert.deepEqual(failing(liveRows({ seats: [{ seat: 3, shown: { x: 0, z: 0 }, ghostTags: 2, chips: 0 }] })), ["C1"]);
});

test("liveGhostChecks: 의상 표에 그 좌석이 있으면 C1 실패(산 사람 화면은 늘 빈 표)", () => {
  assert.deepEqual(failing(liveRows({ outfits: { 3: "coat" } })), ["C1"]);
});

test("liveGhostChecks: 직업 칩·죽은 자리 표식이 있으면 C2 실패", () => {
  assert.deepEqual(failing(liveRows({ roleChips: 1 })), ["C2"]);
  assert.deepEqual(failing(liveRows({ ghostSeats: 1 })), ["C2"]);
  assert.deepEqual(failing(liveRows({ seats: [{ seat: 3, shown: { x: 0, z: 0 }, ghostTags: 1, chips: 1 }] })), ["C2"]);
});

test("liveGhostChecks: 밤·심부름은 기대가 반대 — shown null·유령 이름표 0 이어야 통과", () => {
  for (const phase of LIVE_GHOST_ABSENT_PHASES) {
    const none = { seats: [{ seat: 3, shown: null, ghostTags: 0, chips: 0 }] };
    assert.deepEqual(failing(liveRows(none, { phase })), [], phase);
    assert.deepEqual(failing(liveRows({}, { phase })), ["C1"], phase);
    assert.deepEqual(failing(liveRows({ ...none, seats: [{ seat: 3, shown: null, ghostTags: 1, chips: 0 }] }, { phase })), ["C1"], phase);
  }
});

test("liveGhostChecks: 밤에도 직업 칩·표식은 0 이어야 한다(C2)", () => {
  const none = { seats: [{ seat: 3, shown: null, ghostTags: 0, chips: 0 }], roleChips: 1 };
  assert.deepEqual(failing(liveRows(none, { phase: "night" })), ["C2"]);
});

test("liveGhostChecks: 좌석이 둘이면 둘 다 판정, 하나만 빠져도 C1 실패", () => {
  const two = { seats: [{ seat: 3, shown: { x: 0, z: 0 }, ghostTags: 1, chips: 0 }, { seat: 5, shown: { x: 1, z: 1 }, ghostTags: 1, chips: 0 }] };
  assert.deepEqual(failing(liveGhostChecks({ ...liveGood(), ...two }, { deadSeats: [3, 5], phase: "discussion" })), []);
  const bad = { seats: [two.seats[0], { seat: 5, shown: null, ghostTags: 1, chips: 0 }] };
  const rows = liveGhostChecks({ ...liveGood(), ...bad }, { deadSeats: [3, 5], phase: "discussion" });
  assert.deepEqual(failing(rows), ["C1"]);
  assert.match(rows[0].detail, /5/);
});

test("liveGhostChecks: 죽은 좌석을 읽지 못했거나 훅이 없으면 측정값 없음", () => {
  assert.match(liveRows({ seats: [] })[0].detail, /측정값 없음/);
  assert.match(liveGhostChecks({ ...liveGood(), hook: false }, { deadSeats: [3], phase: "discussion" })[0].detail, /측정값 없음/);
  assert.match(liveGhostChecks(null, { deadSeats: [3], phase: "discussion" })[0].detail, /측정값 없음/);
  assert.match(liveGhostChecks(liveGood(), { deadSeats: [], phase: "discussion" })[0].detail, /측정값 없음/);
});

// ---- C3 유령 화면 ----

const viewGood = () => ({
  seats: [
    { seat: 1, chips: 1, ghostTags: 1 },
    { seat: 3, chips: 1, ghostTags: 1 },
    { seat: 4, chips: 1, ghostTags: 1 },
  ],
  outfits: { 1: "mafia", 3: "coat", 4: "doctor" },
});
const viewJobs = { 1: "mafia", 3: "citizen", 4: "doctor" };

test("ghostViewChecks: 칩 1·is-ghost 1·의상 = 직업 대응이면 C3 통과", () => {
  const rows = ghostViewChecks(viewGood(), { jobs: viewJobs });
  assert.deepEqual(ids(rows), ["C3"]);
  assert.deepEqual(failing(rows), []);
});

test("ghostViewChecks: 한 좌석 의상이 직업 대응과 다르면 실패, 사람 모습(표에 없음)도 실패", () => {
  const a = viewGood();
  a.outfits[1] = "coat"; // 기대 mafia
  assert.deepEqual(failing(ghostViewChecks(a, { jobs: viewJobs })), ["C3"]);
  const b = viewGood();
  delete b.outfits[4];
  const rows = ghostViewChecks(b, { jobs: viewJobs });
  assert.deepEqual(failing(rows), ["C3"]);
  assert.match(rows[0].detail, /4/);
});

test("ghostViewChecks: 직업을 모르면(spectate 없음) coat 가 기대", () => {
  const m = { seats: [{ seat: 2, chips: 1, ghostTags: 1 }], outfits: { 2: "coat" } };
  assert.deepEqual(failing(ghostViewChecks(m, { jobs: {} , seats: [2] })), []);
});

test("ghostViewChecks: 칩이 0 이거나 is-ghost 이름표가 0 이면 실패", () => {
  const a = viewGood();
  a.seats[1].chips = 0;
  assert.deepEqual(failing(ghostViewChecks(a, { jobs: viewJobs })), ["C3"]);
  const b = viewGood();
  b.seats[2].ghostTags = 0;
  assert.deepEqual(failing(ghostViewChecks(b, { jobs: viewJobs })), ["C3"]);
});

test("ghostViewChecks: 의상 표가 없거나(null) 좌석 읽기가 빠졌으면 측정값 없음·실패", () => {
  assert.match(ghostViewChecks({ ...viewGood(), outfits: null }, { jobs: viewJobs })[0].detail, /측정값 없음/);
  const m = viewGood();
  m.seats = m.seats.slice(0, 2);
  assert.equal(ghostViewChecks(m, { jobs: viewJobs })[0].ok, false);
  assert.match(ghostViewChecks(null, { jobs: viewJobs })[0].detail, /측정값 없음/);
});

test("ghostViewChecks: 직업 대응은 GHOST_JOB_OUTFIT_E2E 와 같다(시민 coat)", () => {
  const m = { seats: [{ seat: 0, chips: 1, ghostTags: 1 }], outfits: { 0: GHOST_JOB_OUTFIT_E2E.citizen } };
  assert.deepEqual(failing(ghostViewChecks(m, { jobs: { 0: "citizen" } })), []);
  assert.deepEqual(failing(ghostViewChecks({ ...m, outfits: { 0: "mafia" } }, { jobs: { 0: "citizen" } })), ["C3"]);
});

// ---- GH12 (뜻 바뀜: 산 사람 화면 유령 자리 고정, C-6) ----

test("ghostStillChecks: 같은 자리면 통과, 허용 오차 안이면 통과, 벗어나면 실패", () => {
  const a = { x: 1.5, z: -2 };
  assert.equal(ghostStillChecks(a, { x: 1.5, z: -2 }).ok, true);
  assert.equal(ghostStillChecks(a, { x: 1.52, z: -2.03 }).ok, true);
  const bad = ghostStillChecks(a, { x: 2.5, z: -2 });
  assert.equal(bad.ok, false);
  assert.equal(bad.id, "GH12");
});

test("ghostStillChecks: 한쪽이 null 이면 실패(유령이 사라졌거나 처음부터 없음), 측정값 없음", () => {
  assert.equal(ghostStillChecks({ x: 0, z: 0 }, null).ok, false);
  assert.equal(ghostStillChecks(null, { x: 0, z: 0 }).ok, false);
  assert.match(ghostStillChecks(null, null).detail, /측정값 없음/);
});
