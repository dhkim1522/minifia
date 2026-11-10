// 결과 화면 E2E 순수 판정 단위 테스트 (11-05). 실행: node --test scripts/e2e/result.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { awardChecks, AWARD_PLATE, READY_PILL, SHORT_PHONE_H, rematchChecks, RESULT_JOB_OUTFIT, RESULT_MARKERS, RESULT_PANEL_H, RESULT_WIN_TITLE, resultHiddenChecks, resultSkipChecks, resultStageChecks, TIMELINE_CARD } from "./result.mjs";

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
  panel: 160,
  panelWant: 160,
  stageBottom: 504,
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

test("RS5: 패널 높이가 160(기록 칸 68 + 92, 방 높이와 무관) ±1 이 아니면 RS5 만 실패한다", () => {
  assert.deepEqual(failing({ panel: 162, stageBottom: 502 }), ["RS5"]);
  assert.deepEqual(failing({ panel: 161, stageBottom: 503 }), []); // ±1 안
  assert.equal(RESULT_PANEL_H, 160);
  // panelWant 없이 기대를 계산: 방 높이 600·844 어느 쪽이어도 160
  for (const roomH of [600, 664, 844]) {
    const ok = { ...good(), panelWant: undefined, roomH, panel: 160, stageBottom: roomH - 160 };
    assert.deepEqual(resultStageChecks(ok).filter((r) => !r.ok), [], `방 ${roomH}`);
    assert.deepEqual(resultStageChecks({ ...ok, panel: 188, stageBottom: roomH - 188 }).filter((r) => !r.ok).map((r) => r.id), ["RS5"], `방 ${roomH} 옛 188`);
    assert.deepEqual(resultStageChecks({ ...ok, panel: 244, stageBottom: roomH - 244 }).filter((r) => !r.ok).map((r) => r.id), ["RS5"], `방 ${roomH} 옛 244`);
  }
});

test("RS6: 스테이지 아래 끝이 방 높이 − 패널과 다르면 RS6 만 실패한다", () => {
  assert.deepEqual(failing({ stageBottom: 498 }), ["RS6"]);
  assert.deepEqual(failing({ stageBottom: 505 }), []); // ±1 안
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
  assert.deepEqual([...RESULT_MARKERS], ["data-result-stage", "data-result-panel", "data-result-announce", "__mfResult", "data-result-tab", "data-result-dot", "data-result-divider", "data-award-plate", "data-award-id", "data-float-count", "data-day-card", "data-day-detail", "data-whisper-pair", "data-ready-pill", "data-ready", "data-ready-count", "data-bench-view"]);
  assert.deepEqual({ ...RESULT_WIN_TITLE }, { citizenWin: "시민 승리", mafiaWin: "마피아 승리" });
  assert.deepEqual({ ...RESULT_JOB_OUTFIT }, { mafia: "mafia", police: "police", doctor: "doctor", citizen: "coat" });
});

test("RESULT_MARKERS 에 탭 표식이 더해졌다", () => {
  for (const m of ["data-result-tab", "data-result-dot", "data-result-divider"]) assert.ok(RESULT_MARKERS.includes(m), m);
});

// ---------- 11-09 시상식 판정 (AW1~AW10) ----------

// 4명판 시민 승: 서버 정렬 = 진 팀(0 마피아) → 이긴 팀. 마지막 패(좌석 3)는 이긴 팀
const awardsGood = () => ({
  viewport: { w: 390, h: 844 },
  stageTop: 62,
  panelTop: 600,
  plateBox: { top: 70, left: 31, width: 328, height: 96 },
  floatBox: { left: 326, top: 480, width: 48, height: AWARD_PLATE.floatH, bottom: 480 + AWARD_PLATE.floatH },
  progress: ["1 / 4", "2 / 4", "3 / 4", "4 / 4"],
  awards: [[0, "whiff"], [2, "detective"], [1, "talker"], [3, "survivor"]],
  observed: ["whiff", "detective", "talker", "survivor"],
  participants: 4,
  winnerTeamSeats: [1, 2, 3],
  winner: "citizenWin",
  titleDuring: "시상식",
  titleAfter: "시민 승리",
  floatAfter: 0,
  costumesDuring: { 0: "mafia", 1: "coat", 2: "police", 3: "doctor" },
  costumesAfter: {},
  jobBySeat: { 0: "mafia", 1: "citizen", 2: "police", 3: "doctor" },
});
const awFailing = (over) => awardChecks({ ...awardsGood(), ...over }).filter((r) => !r.ok).map((r) => r.id);

test("awardChecks: 정상 입력은 AW1~AW8·AW10 이 모두 통과한다", () => {
  const rows = awardChecks(awardsGood());
  assert.deepEqual(rows.map((r) => r.id), ["AW1", "AW2", "AW3", "AW4", "AW5", "AW6", "AW7", "AW8", "AW10"]);
  for (const r of rows) assert.equal(r.ok, true, `${r.id}: ${r.detail}`);
});

test("AW-PLATE 상수: 폭 min(328, 폭 − 32), 높이 96, 윗변 + 8, 패 아래 150, [넘기기] 상자 48x48(16-06: 상자가 곧 면, 열 밖 제자리)", () => {
  assert.deepEqual({ ...AWARD_PLATE, floatH: Math.round(AWARD_PLATE.floatH * 10) / 10 }, { maxW: 328, sideMargin: 32, h: 96, topGap: 8, belowMin: 150, float: 48, floatH: 48, floatRight: 16, floatGap: 8 });
});

test("AW1: 패 수가 참가자 수·훅 목록 길이와 다르면 AW1 이 실패한다", () => {
  assert.deepEqual(awFailing({ participants: 5 }), ["AW1"]);
  // 관찰한 패가 하나 모자라면 훅 목록 길이와도 다르고 순서 열도 짧아진다
  assert.deepEqual(awFailing({ observed: ["whiff", "detective", "talker"] }), ["AW1", "AW2"]);
});

test("AW2: 관찰한 순서가 훅 순서와 다르면 AW2 만 실패한다", () => {
  assert.deepEqual(awFailing({ observed: ["detective", "whiff", "talker", "survivor"] }), ["AW2"]);
});

test("AW3: 마지막 패가 이긴 팀이 아니면 AW3 만 실패한다", () => {
  assert.deepEqual(awFailing({ winnerTeamSeats: [1, 2] }), ["AW3"]);
});

test("AW4(AW-PLATE): 폭·높이·윗변·가운데·패 아래 스테이지, 한 값씩 어긋나면 AW4 만 실패한다", () => {
  assert.deepEqual(awFailing({ plateBox: { top: 70, left: 31, width: 300, height: 96 } }), ["AW4"]);
  assert.deepEqual(awFailing({ plateBox: { top: 70, left: 31, width: 328, height: 80 } }), ["AW4"]);
  assert.deepEqual(awFailing({ plateBox: { top: 80, left: 31, width: 328, height: 96 } }), ["AW4"]);
  assert.deepEqual(awFailing({ plateBox: { top: 70, left: 20, width: 328, height: 96 } }), ["AW4"]);
  assert.deepEqual(awFailing({ panelTop: 300, floatBox: { left: 326, top: 180, width: 48, height: AWARD_PLATE.floatH, bottom: 180 + AWARD_PLATE.floatH } }), ["AW4"]); // 패 아래 134 < 150
  // 작은 폰: 폭 − 32
  const small = { viewport: { w: 360, h: 560 }, plateBox: { top: 70, left: 16, width: 328, height: 96 }, panelTop: 372, floatBox: { left: 296, top: 252, width: 48, height: AWARD_PLATE.floatH, bottom: 252 + AWARD_PLATE.floatH } };
  assert.deepEqual(awFailing(small), []); // 폭 360: 328 = min(328, 360 − 32), 372 − 166 = 206 ≥ 150
  assert.deepEqual(awFailing({ ...small, panelTop: 300 }), ["AW4", "AW5"]); // 패 아래 134 < 150, 그리고 [넘기기]가 아래 칸에 걸림
});

test("AW5: [넘기기] 48×48 원·오른쪽 16·위 칸, 한 값씩 어긋나면 AW5 만 실패한다", () => {
  const H = AWARD_PLATE.floatH;
  assert.deepEqual(awFailing({ floatBox: { left: 326, top: 480, width: 44, height: H, bottom: 480 + H } }), ["AW5"]);
  assert.deepEqual(awFailing({ floatBox: { left: 320, top: 480, width: 48, height: H, bottom: 480 + H } }), ["AW5"]);
  assert.deepEqual(awFailing({ floatBox: { left: 326, top: 480, width: 48, height: 71.6, bottom: 551.6 } }), ["AW5"]); // 이름표가 붙은 옛 71.6 높이
  assert.deepEqual(awFailing({ floatBox: { left: 322, top: 480, width: 52, height: 52, bottom: 532 } }), ["AW5"]); // 열 단추 52 원이 아니다(시상 [넘기기]는 48)
  assert.deepEqual(awFailing({ floatBox: { left: 326, top: 530, width: 48, height: H, bottom: 530 + H } }), ["AW5"]); // 아래 칸 자리를 침범(윗변이 위 칸보다 아래)
  assert.deepEqual(awFailing({ floatBox: { left: 326, top: 480, width: 48, height: H, bottom: 600 } }), ["AW5"]); // 아랫변이 패널 윗변 − 8 을 넘음
  assert.deepEqual(awFailing({ floatBox: null }), ["AW5"]);
});

test("AW6: 진행 숫자가 'k / n' 꼴이고 1씩 오르며 n 이 참가자 수", () => {
  assert.deepEqual(awFailing({ progress: ["1 / 4", "2 / 4", "4 / 4", "5 / 4"] }), ["AW6"]);
  assert.deepEqual(awFailing({ progress: ["1/4", "2 / 4", "3 / 4", "4 / 4"] }), ["AW6"]);
  assert.deepEqual(awFailing({ progress: ["1 / 3", "2 / 3", "3 / 3", "4 / 3"] }), ["AW6"]);
});

test("AW7: 시상 중 '시상식', 끝난 뒤 승리 한 줄", () => {
  assert.deepEqual(awFailing({ titleDuring: "결과" }), ["AW7"]);
  assert.deepEqual(awFailing({ titleAfter: "시상식" }), ["AW7"]);
  assert.deepEqual(awFailing({ winner: "mafiaWin" }), ["AW7"]);
});

test("AW8: 끝난 뒤 [넘기기]가 남아 있으면 AW8 만 실패한다", () => {
  assert.deepEqual(awFailing({ floatAfter: 1 }), ["AW8"]);
});

test("AW10: 시상 중에는 직업 의상, 끝난 뒤에는 의상이 걷힘(고른 look)", () => {
  assert.deepEqual(awFailing({ costumesDuring: { 0: "coat", 1: "coat", 2: "police", 3: "doctor" } }), ["AW10"]);
  assert.deepEqual(awFailing({ costumesAfter: { 0: "mafia" } }), ["AW10"]);
});

test("측정값이 없으면 조용히 통과하지 않고 해당 항목이 `측정값 없음` 으로 실패한다", () => {
  const rows = awardChecks({});
  assert.equal(rows.length, 9);
  for (const r of rows) {
    assert.equal(r.ok, false, r.id);
    assert.match(r.detail, /측정값 없음/, r.id);
  }
  assert.match(awardChecks(undefined)[0].detail, /측정값 없음/);
});

test("RS4 afterCeremony(11-09): 시상식 뒤에는 직업 의상이 모두 걷혀야 통과, 남아 있으면 RS4 만 실패, 기본 입력은 그대로", () => {
  assert.equal(resultStageChecks({ ...good(), afterCeremony: true, costumes: {} }).every((r) => r.ok), true);
  assert.deepEqual(failing({ afterCeremony: true }), ["RS4"]); // good() 의 costumes 는 아직 직업 의상
  assert.deepEqual(failing({ afterCeremony: true, costumes: { 0: "mafia" } }), ["RS4"]);
  assert.equal(failing({}).includes("RS4"), false);
});

test("TIMELINE_CARD 상수: 카드 72×112, 간격 8", () => {
  assert.deepEqual({ ...TIMELINE_CARD }, { w: 72, h: 112, gap: 8 });
});

test("RESULT_MARKERS: 기록 탭 표식 3개가 더해져 있다 (11-11)", () => {
  for (const m of ["data-day-card", "data-day-detail", "data-whisper-pair"]) assert.equal(RESULT_MARKERS.includes(m), true, m);
});


// ---------- 11-12: 다시 하기 (rematchChecks RM1~RM12) ----------
// 방장 360×560 + 손님 430×932. 5명판(방장·봇·손님 셋) 중 둘이 준비 → 참가자 4, 쉬는 사람 1.
const rmGood = () => ({
  viewport: { w: 360, h: 560 },
  pillBox: { width: 96, height: 48 },
  inputWidth: 168,
  guestPill: { before: { ready: "false", pressed: "false" }, after: { ready: "true", pressed: "true" } },
  count: { text: "2/5", dim: true, disabled: true },
  countWant: { n: 2, m: 5, minPlayers: 4 },
  countFull: { text: "4/5", dim: false, disabled: false },
  countFullWant: { n: 4, m: 5, minPlayers: 4 },
  toast: "4명부터 시작해요",
  minPlayers: 4,
  roundUnchanged: true,
  sheet: { title: "이번 판은 쉬어요", buttons: ["시작", "취소"], faces: 1, extraText: "" },
  restingWant: 1,
  round: { before: 1, after: 2, phases: ["assigning", "assigning", "assigning"] },
  benchView: true,
  bench: { timers: 0, chatInputs: 0, floats: 0, text: "이번 판은 쉬어요", buttons: ["나가기"] },
  looks: { 2: "noir" },
  looksWant: { 2: "noir" },
  chat: { before: 1, old: 0 },
  sat: { seats: [4], want: [4], chipsOnSat: 0, chips: 4, participants: 4 },
  ceremony: { pillActive: true, plateVsPill: false, skipVsPill: false },
  early: { disabled: true },
});
const rmFailing = (over) => rematchChecks({ ...rmGood(), ...over }).filter((r) => !r.ok).map((r) => r.id);

test("READY_PILL: 알약 96×48, 입력줄 여백 192(보내기 48 원)", () => {
  assert.deepEqual({ ...READY_PILL }, { w: 96, h: 48, inputExtra: 192 });
});

test("rematchChecks: 정상 입력은 RM1~RM12 가 모두 통과한다", () => {
  const rows = rematchChecks(rmGood());
  assert.deepEqual(rows.map((r) => r.id), ["RM1", "RM2", "RM3", "RM4", "RM5", "RM6", "RM7", "RM8", "RM9", "RM10", "RM11", "RM12"]);
  for (const r of rows) assert.equal(r.ok, true, `${r.id}: ${r.detail}`);
});

test("RM1: 알약 96×48 ±1 이고 입력칸 폭 = 폭 − 192 ±2", () => {
  assert.deepEqual(rmFailing({ pillBox: { width: 100, height: 48 } }), ["RM1"]);
  assert.deepEqual(rmFailing({ pillBox: { width: 96, height: 44 } }), ["RM1"]);
  assert.deepEqual(rmFailing({ inputWidth: 180 }), ["RM1"]);
  assert.deepEqual(rmFailing({ inputWidth: 169.5, pillBox: { width: 96.9, height: 48.9 } }), []); // 오차 안
  assert.deepEqual(rmFailing({ viewport: { w: 430, h: 932 }, inputWidth: 238 }), []);
  assert.deepEqual(rmFailing({ viewport: { w: 430, h: 932 }, inputWidth: 242 }), ["RM1"]); // 이름표 단추(44) 기준 188 이면 실패
});

test("RM2: 손님 토글 전후로 data-ready 와 aria-pressed 가 반대로 바뀌고 서로 같다", () => {
  assert.deepEqual(rmFailing({ guestPill: { before: { ready: "false", pressed: "false" }, after: { ready: "false", pressed: "false" } } }), ["RM2"]);
  assert.deepEqual(rmFailing({ guestPill: { before: { ready: "false", pressed: "false" }, after: { ready: "true", pressed: "false" } } }), ["RM2"]);
  assert.deepEqual(rmFailing({ guestPill: { before: { ready: "true", pressed: "true" }, after: { ready: "false", pressed: "false" } } }), []);
});

test("RM3: 방장 data-ready-count 가 'n/m' 꼴이고 준비 상태와 같다 — n < 최소면 흐림, 이상이면 흐림 없음", () => {
  assert.deepEqual(rmFailing({ count: { text: "2 / 5", dim: true, disabled: true } }), ["RM3"]); // 꼴이 다르다
  assert.deepEqual(rmFailing({ count: { text: "3/5", dim: true, disabled: true } }), ["RM3"]); // 값이 다르다
  assert.deepEqual(rmFailing({ count: { text: "2/5", dim: false, disabled: false } }), ["RM3"]); // 4 미만인데 흐리지 않다
  assert.deepEqual(rmFailing({ countFull: { text: "4/5", dim: true, disabled: true } }), ["RM3"]); // 4 이상인데 흐리다
  assert.deepEqual(rmFailing({ countFull: { text: "4/6", dim: false, disabled: false } }), ["RM3"]);
});

test("RM4: 4명 미만에서 방장이 탭하면 토스트 '4명부터 시작해요' 만 — 판은 시작하지 않는다", () => {
  assert.deepEqual(rmFailing({ toast: "" }), ["RM4"]);
  assert.deepEqual(rmFailing({ toast: "5명부터 시작해요" }), ["RM4"]);
  assert.deepEqual(rmFailing({ roundUnchanged: false }), ["RM4"]);
});

test("RM5: 쉬게 될 사람이 있으면 시트가 뜨고 얼굴 수 = 쉬는 사람 수, 글은 '이번 판은 쉬어요' 하나 + [시작][취소]", () => {
  assert.deepEqual(rmFailing({ sheet: { ...rmGood().sheet, faces: 2 } }), ["RM5"]);
  assert.deepEqual(rmFailing({ sheet: { ...rmGood().sheet, title: "쉬어요" } }), ["RM5"]);
  assert.deepEqual(rmFailing({ sheet: { ...rmGood().sheet, buttons: ["취소", "시작"] } }), ["RM5"]);
  assert.deepEqual(rmFailing({ sheet: { ...rmGood().sheet, extraText: "하준" } }), ["RM5"]); // 이름 글자가 보인다
  assert.deepEqual(rmFailing({ sheet: null }), ["RM5"]);
});

test("RM6: 시작 뒤 참가자 round 가 이전 + 1 이고 단계가 assigning, 쉬는 페이지에 BenchView", () => {
  assert.deepEqual(rmFailing({ round: { before: 1, after: 1, phases: ["assigning"] } }), ["RM6"]);
  assert.deepEqual(rmFailing({ round: { before: 1, after: 2, phases: ["assigning", "ended"] } }), ["RM6"]);
  assert.deepEqual(rmFailing({ benchView: false }), ["RM6"]);
});

test("RM7: 쉬는 페이지에 타이머·채팅 입력·떠 있는 버튼·꾸미기가 없고 글은 한 줄 + [나가기]", () => {
  assert.deepEqual(rmFailing({ bench: { ...rmGood().bench, timers: 1 } }), ["RM7"]);
  assert.deepEqual(rmFailing({ bench: { ...rmGood().bench, chatInputs: 1 } }), ["RM7"]);
  assert.deepEqual(rmFailing({ bench: { ...rmGood().bench, floats: 1 } }), ["RM7"]);
  assert.deepEqual(rmFailing({ bench: { ...rmGood().bench, text: "대기실" } }), ["RM7"]);
  assert.deepEqual(rmFailing({ bench: { ...rmGood().bench, buttons: ["나가기", "꾸미기"] } }), ["RM7"]);
});

test("RM8: 시작 전에 고른 look 이 새 판에서도 같다", () => {
  assert.deepEqual(rmFailing({ looks: { 2: "coat" } }), ["RM8"]);
  assert.deepEqual(rmFailing({ looks: {} }), ["RM8"]);
  assert.deepEqual(rmFailing({ looksWant: {} }), ["RM8"]); // 기대가 비면 검사가 비어 있다
});

test("RM9: 새 판 기록 칸에 이전 판 채팅 본문이 0줄 (이전에는 있었다)", () => {
  assert.deepEqual(rmFailing({ chat: { before: 1, old: 1 } }), ["RM9"]);
  assert.deepEqual(rmFailing({ chat: { before: 0, old: 0 } }), ["RM9"]); // 보낸 줄이 없었으면 검사가 비어 있다
});

test("RM10: 다음 결과에서 쉬었던 사람이 sat 이고 칩이 없다 (칩 수 = 참가자 수)", () => {
  assert.deepEqual(rmFailing({ sat: { ...rmGood().sat, seats: [] } }), ["RM10"]);
  assert.deepEqual(rmFailing({ sat: { ...rmGood().sat, seats: [3] } }), ["RM10"]);
  assert.deepEqual(rmFailing({ sat: { ...rmGood().sat, chipsOnSat: 1 } }), ["RM10"]);
  assert.deepEqual(rmFailing({ sat: { ...rmGood().sat, chips: 5 } }), ["RM10"]);
});

test("RM11: 시상식 중 알약이 활성이고 패·[넘기기]와 겹치지 않는다", () => {
  assert.deepEqual(rmFailing({ ceremony: { pillActive: false, plateVsPill: false, skipVsPill: false } }), ["RM11"]);
  assert.deepEqual(rmFailing({ ceremony: { pillActive: true, plateVsPill: true, skipVsPill: false } }), ["RM11"]);
  assert.deepEqual(rmFailing({ ceremony: { pillActive: true, plateVsPill: false, skipVsPill: true } }), ["RM11"]);
});

test("RM12: 승리 조명 전에는 알약이 비활성(aria-disabled)", () => {
  assert.deepEqual(rmFailing({ early: { disabled: false } }), ["RM12"]);
});

test("rematchChecks: 측정값이 없으면 조용히 통과하지 않고 측정값 없음으로 실패한다", () => {
  const rows = rematchChecks({});
  assert.equal(rows.length, 12);
  for (const r of rows) {
    assert.equal(r.ok, false, r.id);
    assert.match(r.detail, /측정값 없음/, r.id);
  }
  assert.match(rematchChecks(undefined)[0].detail, /측정값 없음/);
});

test("RESULT_MARKERS: 다시 하기 표식 4개가 더해져 있다 (11-12)", () => {
  for (const m of ["data-ready-pill", "data-ready", "data-ready-count", "data-bench-view"]) assert.equal(RESULT_MARKERS.includes(m), true, m);
});

test("AW4 knownShortLimit(14-08 UI#14): 낮은 폰은 '패 아래 150' 미만만 판정에서 빼 AW4k 정보 줄로 남기고, 다른 AW4 어긋남은 그대로 실패한다", () => {
  const small = { ...awardsGood(), viewport: { w: 360, h: 560 }, plateBox: { top: 139, left: 16, width: 328, height: 96 }, stageTop: 131, panelTop: 360, floatBox: { left: 296, top: 200, width: 48, height: AWARD_PLATE.floatH, bottom: 200 + AWARD_PLATE.floatH } };
  assert.deepEqual(awardChecks(small).filter((r) => !r.ok).map((r) => r.id), ["AW4"]); // 360 − 235 = 125 < 150
  const known = awardChecks({ ...small, knownShortLimit: true });
  assert.deepEqual(known.filter((r) => !r.ok).map((r) => r.id), []);
  const k = known.find((r) => r.id === "AW4k");
  assert.equal(k.ok, true);
  assert.equal(k.info, true);
  assert.match(k.detail, /125/);
  // 폭이 틀리면 한계가 아니라 실패
  assert.deepEqual(awardChecks({ ...small, knownShortLimit: true, plateBox: { ...small.plateBox, width: 300 } }).filter((r) => !r.ok).map((r) => r.id), ["AW4"]);
  assert.equal(SHORT_PHONE_H, 575);
});

// ---------- 18.1 결과 화면 기록 숨김 (RH1~RH4, UI-SPEC E1·E2) ----------
const SENT = ["오늘 밤은 조용히 정해요", "나는 유령이에요 억울해요"];
const hiddenGood = () => ({ tabs: 0, tabRows: 0, bodies: 0, chLines: 0, domText: "시민 승리 전체 대화 안녕하세요", expanded: "false", panelH: 160 });
const rhFailing = (over, sent = SENT) => resultHiddenChecks({ ...hiddenGood(), ...over }, { sent }).filter((r) => !r.ok).map((r) => r.id);

test("resultHiddenChecks: 정상 입력은 RH1~RH4 가 모두 통과한다", () => {
  const rows = resultHiddenChecks(hiddenGood(), { sent: SENT });
  assert.deepEqual(rows.map((r) => r.id), ["RH1", "RH2", "RH3", "RH4"]);
  for (const r of rows) assert.equal(r.ok, true, `${r.id}: ${r.detail}`);
});

test("RH1: 탭 단추가 하나라도 있거나 탭 행이 있으면 RH1 만 실패한다", () => {
  assert.deepEqual(rhFailing({ tabs: 1 }), ["RH1"]);
  assert.deepEqual(rhFailing({ tabRows: 1 }), ["RH1"]);
});

test("RH2: 기록 본문이 하나라도 있으면 RH2 만 실패한다", () => {
  assert.deepEqual(rhFailing({ bodies: 1 }), ["RH2"]);
});

test("RH3: 마피아·유령 줄이 있거나 보낸 문장이 화면 글자에 있으면 RH3 만 실패한다, 결과 줄에는 문장을 싣지 않는다", () => {
  assert.deepEqual(rhFailing({ chLines: 1 }), ["RH3"]);
  assert.deepEqual(rhFailing({ domText: `시민 승리 ${SENT[0]}` }), ["RH3"]);
  assert.deepEqual(rhFailing({ domText: `시민 승리 ${SENT[1]}` }), ["RH3"]);
  const row = resultHiddenChecks({ ...hiddenGood(), domText: `끝 ${SENT[1]}` }, { sent: SENT }).find((r) => r.id === "RH3");
  assert.ok(!row.detail.includes(SENT[1]));
  assert.deepEqual(rhFailing({ domText: `끝 ${SENT[1]}` }, []), []);
});

test("RH4: 확장 상태이거나 패널 높이가 160 ±1 이 아니면 RH4 만 실패한다", () => {
  assert.deepEqual(rhFailing({ expanded: "true" }), ["RH4"]);
  assert.deepEqual(rhFailing({ panelH: 188 }), ["RH4"]);
  assert.deepEqual(rhFailing({ panelH: 161 }), []);
  assert.deepEqual(rhFailing({ panelH: 162 }), ["RH4"]);
});

test("resultHiddenChecks: 입력이 없거나 값이 비면 측정값 없음으로 실패한다", () => {
  for (const r of resultHiddenChecks(null)) {
    assert.equal(r.ok, false);
    assert.match(r.detail, /측정값 없음/);
  }
  assert.deepEqual(rhFailing({ tabs: undefined }), ["RH1"]);
  assert.deepEqual(rhFailing({ expanded: null }), ["RH4"]);
  assert.deepEqual(rhFailing({ panelH: Number.NaN }), ["RH4"]);
});
