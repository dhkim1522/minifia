// 결과 화면 E2E 순수 판정 단위 테스트 (11-05). 실행: node --test scripts/e2e/result.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { RESULT_JOB_OUTFIT, RESULT_MARKERS, RESULT_PANEL_H, RESULT_WIN_TITLE, resultSkipChecks, resultStageChecks } from "./result.mjs";

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
