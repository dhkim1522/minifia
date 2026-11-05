// 결과 화면 E2E 순수 판정 단위 테스트 (11-05). 실행: node --test scripts/e2e/result.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { RESULT_JOB_OUTFIT, RESULT_MARKERS, RESULT_PANEL_H, RESULT_WIN_TITLE, RESULT_TAB_IDS, resultSkipChecks, resultStageChecks, resultTabChecks } from "./result.mjs";

// 4명판 시민 승: 좌석 0 마피아(진 팀) · 1 시민 · 2 경찰 · 3 의사
const good = () => ({
  winner: "citizenWin",
  header: "시민 승리",
  chips: 4,
  seats: 4,
  dimmed: [0],
  loserSeats: [0],
  costumes: { 0: "mafia", 1: "coat", 2: "police", 3: "doctor" },
  jobBySeat: { 0: "mafia", 1: "citizen", 2: "police", 3: "doctor" },
  panel: 188,
  panelWant: 188,
  stageBottom: 476,
  roomH: 664,
  hasLegacy: [],
  chatEcho: true,
});
const byId = (rows) => Object.fromEntries(rows.map((r) => [r.id, r]));
/** 한 값만 바꿔 어떤 항목이 실패하는지 본다 */
const failing = (over) => resultStageChecks({ ...good(), ...over }).filter((r) => !r.ok).map((r) => r.id);

test("resultStageChecks: 정상 입력은 RS1~RS8 이 모두 통과한다", () => {
  const rows = resultStageChecks(good());
  assert.deepEqual(rows.map((r) => r.id), ["RS1", "RS2", "RS3", "RS4", "RS5", "RS6", "RS7", "RS8"]);
  for (const r of rows) assert.equal(r.ok, true, `${r.id}: ${r.detail}`);
  assert.equal(resultStageChecks({ ...good(), winner: "mafiaWin", header: "마피아 승리", dimmed: [1, 2, 3], loserSeats: [1, 2, 3] }).every((r) => r.ok), true);
});

test("RS1: 헤더가 승리 한 줄이 아니면 RS1 만 실패한다", () => {
  assert.deepEqual(failing({ header: "결과" }), ["RS1"]);
  assert.deepEqual(failing({ header: "마피아 승리" }), ["RS1"]);
  assert.match(resultStageChecks({ ...good(), header: "결과" })[0].detail, /결과/);
});

test("RS2: 칩 수가 참가자 수와 다르면 RS2 만 실패한다", () => {
  assert.deepEqual(failing({ chips: 3 }), ["RS2"]);
  assert.deepEqual(failing({ chips: 5 }), ["RS2"]);
});

test("RS3: 어두운 좌석 집합이 진 팀과 다르면 RS3 만 실패한다 (많아도 적어도)", () => {
  assert.deepEqual(failing({ dimmed: [] }), ["RS3"]);
  assert.deepEqual(failing({ dimmed: [0, 1] }), ["RS3"]);
  assert.deepEqual(failing({ dimmed: [1] }), ["RS3"]);
});

test("RS4: 의상이 직업 표와 다르거나 빠지거나 남으면 RS4 만 실패한다", () => {
  assert.deepEqual(failing({ costumes: { 0: "coat", 1: "coat", 2: "police", 3: "doctor" } }), ["RS4"]);
  assert.deepEqual(failing({ costumes: { 0: "mafia", 1: "coat", 2: "police" } }), ["RS4"]);
  assert.deepEqual(failing({ costumes: { 0: "mafia", 1: "coat", 2: "police", 3: "doctor", 4: "coat" } }), ["RS4"]);
  assert.deepEqual(failing({ jobBySeat: { 0: "wizard", 1: "citizen", 2: "police", 3: "doctor" } }), ["RS4"]);
});

test("RS5: 패널 높이가 188(짧은 방) · 244(방 높이 780 이상) ±1 이 아니면 RS5 만 실패한다", () => {
  assert.deepEqual(failing({ panel: 190, stageBottom: 474 }), ["RS5"]);
  assert.deepEqual(failing({ panel: 189, stageBottom: 475 }), []); // ±1 안
  // panelWant 없이 방 높이로 계산: 780 이상이면 244
  const tall = { ...good(), panelWant: undefined, roomH: 800, panel: 244, stageBottom: 556 };
  assert.deepEqual(resultStageChecks(tall).filter((r) => !r.ok), []);
  assert.deepEqual(resultStageChecks({ ...tall, panel: 188, stageBottom: 612 }).filter((r) => !r.ok).map((r) => r.id), ["RS5"]);
  assert.deepEqual(RESULT_PANEL_H, { short: 188, tall: 244, tallRoomMinH: 780 });
});

test("RS6: 스테이지 아래 끝이 방 높이 − 패널과 다르면 RS6 만 실패한다", () => {
  assert.deepEqual(failing({ stageBottom: 470 }), ["RS6"]);
  assert.deepEqual(failing({ stageBottom: 477 }), []); // ±1 안
});

test("RS7: 옛 요소가 하나라도 남으면 RS7 만 실패하고 이름을 알려 준다", () => {
  assert.deepEqual(failing({ hasLegacy: [".mf-result__grid", "[처음으로]"] }), ["RS7"]);
  assert.match(resultStageChecks({ ...good(), hasLegacy: ["[처음으로]"] })[6].detail, /\[처음으로\]/);
});

test("RS8: 보낸 채팅 한 줄이 보이지 않으면 RS8 만 실패한다", () => {
  assert.deepEqual(failing({ chatEcho: false }), ["RS8"]);
});

test("측정값이 없으면 조용히 통과하지 않고 해당 항목이 `측정값 없음` 으로 실패한다", () => {
  const rows = byId(resultStageChecks({}));
  for (const id of ["RS1", "RS2", "RS3", "RS4", "RS5", "RS6", "RS7", "RS8"]) {
    assert.equal(rows[id].ok, false, id);
    assert.match(rows[id].detail, /측정값 없음/);
  }
  assert.match(resultStageChecks({ ...good(), chips: undefined })[1].detail, /측정값 없음\(chips/);
  assert.match(resultStageChecks({ ...good(), dimmed: undefined })[2].detail, /측정값 없음\(dimmed/);
  assert.match(resultStageChecks(undefined)[0].detail, /측정값 없음/);
});

test("resultSkipChecks: 연출 구간에서 탭하면 light 이후 · 전원 칩, 구간을 놓쳤거나 점프하지 않았으면 실패", () => {
  assert.equal(resultSkipChecks({ before: { stage: "flip", chips: 2 }, after: { stage: "light", chips: 4 }, seats: 4 }).ok, true);
  assert.equal(resultSkipChecks({ before: { stage: "gather", chips: 0 }, after: { stage: "announce", chips: 4 }, seats: 4 }).ok, true);
  assert.equal(resultSkipChecks({ before: { stage: "flip", chips: 2 }, after: { stage: "flip", chips: 2 }, seats: 4 }).ok, false);
  assert.equal(resultSkipChecks({ before: { stage: "flip", chips: 2 }, after: { stage: "light", chips: 3 }, seats: 4 }).ok, false);
  const missed = resultSkipChecks({ before: { stage: "final", chips: 4 }, after: { stage: "final", chips: 4 }, seats: 4 });
  assert.equal(missed.ok, false);
  assert.match(missed.detail, /측정값 없음/);
  assert.match(resultSkipChecks({}).detail, /측정값 없음/);
});

test("상수: 표식 목록·승리 한 줄·직업 의상 표", () => {
  assert.deepEqual([...RESULT_MARKERS], ["data-result-stage", "data-result-panel", "data-result-announce", "__mfResult"]);
  assert.deepEqual({ ...RESULT_WIN_TITLE }, { citizenWin: "시민 승리", mafiaWin: "마피아 승리" });
  assert.deepEqual({ ...RESULT_JOB_OUTFIT }, { mafia: "mafia", police: "police", doctor: "doctor", citizen: "coat" });
});

// ---------- 11-07 탭 패널 판정 (RT1~RT13) ----------
const goodLayout = () => ({
  roomH: 664,
  tabBoxes: RESULT_TAB_IDS.map((id) => ({ id, w: 44, h: 44 })),
  panelCollapsedH: 188,
  panelExpandedH: 465, // min(round(0.7 × 664), 520)
  inputPresent: false,
  iconColors: { all: "rgb(200, 200, 200)", mafia: "rgb(230, 100, 100)", ghost: "rgb(200, 200, 200)", whisper: "rgb(200, 200, 200)", log: "rgb(200, 200, 200)" },
  crimson: "rgb(230, 100, 100)",
  separators: ["1밤", "2밤"],
  dots: { before: ["mafia", "ghost", "whisper"], after: ["ghost", "whisper"] },
  headerBottom: 62,
  panelTop: 199,
});
const goodReveal = () => ({
  tabsBefore: { stage: "gather", count: 1 },
  tabsAfter: { stage: "flip", count: 5 },
  live: [
    { phase: "nomination", count: 0 },
    { phase: "night", count: 0 },
  ],
  paused: { stageAtOpen: "flip", chipsAtOpen: 2, stageLater: "flip", chipsLater: 2, waitedMs: 1500 },
  tapExpanded: { expandedBefore: true, expandedAfter: false, stageBefore: "flip", stageAfter: "flip" },
  tapCollapsed: { stageBefore: "flip", stageAfter: "light" },
});
const tabFailing = (m) => resultTabChecks(m).filter((r) => !r.ok).map((r) => r.id);
const withLayout = (over) => ({ layout: { ...goodLayout(), ...over } });
const withReveal = (over) => ({ reveal: { ...goodReveal(), ...over } });

test("resultTabChecks: 정상 layout 은 RT1·RT3~RT9 가 통과하고 reveal 은 RT2·RT10~RT13 이 통과한다", () => {
  const l = resultTabChecks({ layout: goodLayout() });
  assert.deepEqual(l.map((r) => r.id), ["RT1", "RT3", "RT4", "RT5", "RT6", "RT7", "RT8", "RT9"]);
  for (const r of l) assert.equal(r.ok, true, `${r.id}: ${r.detail}`);
  const v = resultTabChecks({ reveal: goodReveal() });
  assert.deepEqual(v.map((r) => r.id), ["RT2", "RT10", "RT11", "RT12", "RT13"]);
  for (const r of v) assert.equal(r.ok, true, `${r.id}: ${r.detail}`);
  assert.equal(resultTabChecks({ layout: goodLayout(), reveal: goodReveal() }).length, 13);
  assert.deepEqual(resultTabChecks({}), []);
});

test("RT1: 탭 버튼이 44×44 미만이거나 다섯 개가 아니면 RT1 만 실패한다", () => {
  assert.deepEqual(tabFailing(withLayout({ tabBoxes: goodLayout().tabBoxes.map((b, i) => (i === 2 ? { ...b, w: 40 } : b)) })), ["RT1"]);
  assert.deepEqual(tabFailing(withLayout({ tabBoxes: goodLayout().tabBoxes.slice(0, 4) })), ["RT1"]);
});

test("RT3: 접힌 패널 높이는 188(방 780 미만)·244(780 이상) ±1", () => {
  assert.deepEqual(tabFailing(withLayout({ panelCollapsedH: 200 })), ["RT3"]);
  assert.deepEqual(tabFailing(withLayout({ panelCollapsedH: 189 })), []);
  assert.deepEqual(tabFailing(withLayout({ roomH: 932, panelCollapsedH: 244, panelExpandedH: 520 })), []);
  assert.deepEqual(tabFailing(withLayout({ roomH: 932, panelCollapsedH: 188, panelExpandedH: 520 })), ["RT3"]);
});

test("RT4: 확장 높이 = min(round(0.7 × 방 높이), 520) ±2", () => {
  assert.deepEqual(tabFailing(withLayout({ panelExpandedH: 400 })), ["RT4"]);
  assert.deepEqual(tabFailing(withLayout({ panelExpandedH: 467 })), []);
  assert.deepEqual(tabFailing(withLayout({ panelExpandedH: 468 })), ["RT4"]);
  assert.deepEqual(tabFailing(withLayout({ roomH: 560, panelExpandedH: 392, panelCollapsedH: 188 })), []);
  assert.deepEqual(tabFailing(withLayout({ roomH: 932, panelCollapsedH: 244, panelExpandedH: 652 })), ["RT4"]);
});

test("RT5: 확장에서 입력칸이 있으면 RT5 만 실패한다", () => {
  assert.deepEqual(tabFailing(withLayout({ inputPresent: true })), ["RT5"]);
});

test("RT6: 마피아 탭 아이콘만 진홍 — 진홍이 아니거나 다른 탭도 진홍이면 RT6 만 실패한다", () => {
  const c = goodLayout().iconColors;
  assert.deepEqual(tabFailing(withLayout({ iconColors: { ...c, mafia: "rgb(1, 2, 3)" } })), ["RT6"]);
  assert.deepEqual(tabFailing(withLayout({ iconColors: { ...c, ghost: "rgb(230, 100, 100)" } })), ["RT6"]);
});

test("RT7: 구분선은 `{n}밤` 꼴이고 한 개 이상이어야 한다", () => {
  assert.deepEqual(tabFailing(withLayout({ separators: ["1일차"] })), ["RT7"]);
  assert.deepEqual(tabFailing(withLayout({ separators: [] })), ["RT7"]);
  assert.deepEqual(tabFailing(withLayout({ separators: ["1밤", "밤"] })), ["RT7"]);
});

test("RT8: 새 탭 점은 열기 전 마피아·유령·귓속말 셋, 마피아를 연 뒤 유령·귓속말 둘", () => {
  assert.deepEqual(tabFailing(withLayout({ dots: { before: ["mafia", "ghost"], after: ["ghost", "whisper"] } })), ["RT8"]);
  assert.deepEqual(tabFailing(withLayout({ dots: { before: ["mafia", "ghost", "whisper", "log"], after: ["ghost", "whisper"] } })), ["RT8"]);
  assert.deepEqual(tabFailing(withLayout({ dots: { before: ["mafia", "ghost", "whisper"], after: ["mafia", "ghost", "whisper"] } })), ["RT8"]);
});

test("RT9: 헤더 아래 62 이상, 확장 패널이 헤더를 가리지 않는다", () => {
  assert.deepEqual(tabFailing(withLayout({ headerBottom: 50 })), ["RT9"]);
  assert.deepEqual(tabFailing(withLayout({ panelTop: 40 })), ["RT9"]);
});

test("RT2: 탭은 첫 뒤집기 전 1개, 뒤집기 시작 뒤 5개 — 구간을 놓치면 측정값 없음으로 실패", () => {
  assert.deepEqual(tabFailing(withReveal({ tabsBefore: { stage: "gather", count: 5 } })), ["RT2"]);
  assert.deepEqual(tabFailing(withReveal({ tabsAfter: { stage: "flip", count: 1 } })), ["RT2"]);
  const miss = resultTabChecks(withReveal({ tabsBefore: { stage: "flip", count: 5 } })).find((r) => r.id === "RT2");
  assert.equal(miss.ok, false);
  assert.match(miss.detail, /측정값 없음/);
});

test("RT10: 판이 도는 동안 탭이 한 번이라도 있으면 RT10 만 실패, 표본이 없으면 측정값 없음", () => {
  assert.deepEqual(tabFailing(withReveal({ live: [{ phase: "night", count: 1 }] })), ["RT10"]);
  assert.deepEqual(tabFailing(withReveal({ live: [] })), ["RT10"]);
});

test("RT11: 확장 중 연출 시계가 멈춘다 — 단계·칩 수가 늘면 RT11 만 실패, 충분히 기다리지 않았으면 측정값 없음", () => {
  assert.deepEqual(tabFailing(withReveal({ paused: { stageAtOpen: "flip", chipsAtOpen: 2, stageLater: "flip", chipsLater: 3, waitedMs: 1500 } })), ["RT11"]);
  assert.deepEqual(tabFailing(withReveal({ paused: { stageAtOpen: "flip", chipsAtOpen: 2, stageLater: "light", chipsLater: 2, waitedMs: 1500 } })), ["RT11"]);
  assert.deepEqual(tabFailing(withReveal({ paused: { stageAtOpen: "flip", chipsAtOpen: 2, stageLater: "flip", chipsLater: 2, waitedMs: 300 } })), ["RT11"]);
});

test("RT12: 확장 중 무대 탭은 접기만 한다 — 접히지 않았거나 건너뛰었으면 RT12 만 실패", () => {
  assert.deepEqual(tabFailing(withReveal({ tapExpanded: { expandedBefore: true, expandedAfter: true, stageBefore: "flip", stageAfter: "flip" } })), ["RT12"]);
  assert.deepEqual(tabFailing(withReveal({ tapExpanded: { expandedBefore: true, expandedAfter: false, stageBefore: "flip", stageAfter: "light" } })), ["RT12"]);
  assert.deepEqual(tabFailing(withReveal({ tapExpanded: { expandedBefore: false, expandedAfter: false, stageBefore: "flip", stageAfter: "flip" } })), ["RT12"]);
});

test("RT13: 접힌 상태의 무대 탭은 4600 이후로 건너뛴다", () => {
  assert.deepEqual(tabFailing(withReveal({ tapCollapsed: { stageBefore: "flip", stageAfter: "flip" } })), ["RT13"]);
  assert.deepEqual(tabFailing(withReveal({ tapCollapsed: { stageBefore: "flip", stageAfter: "final" } })), []);
  assert.deepEqual(tabFailing(withReveal({ tapCollapsed: { stageBefore: "final", stageAfter: "final" } })), ["RT13"]);
});

test("RESULT_MARKERS 에 탭 표식이 더해졌다", () => {
  for (const m of ["data-result-tab", "data-result-dot", "data-result-divider"]) assert.ok(RESULT_MARKERS.includes(m), m);
});
