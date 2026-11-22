// scripts/e2e/day.mjs 의 순수 판정 단위 시험(22-13): 찬반 숫자 줄(VC)·유언 시트(WF).
import assert from "node:assert/strict";
import test from "node:test";
import { EMPTY_WILL_CARD_TEXT, WILL_REVEAL_MS_COPY, voteCountChecks, willCarryChecks, willLockChecks, willRevealChecks, willSheetChecks } from "./day.mjs";

const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });
const ids = (lines) => Object.fromEntries(lines.map((l) => [l.id, l.ok]));
const page = (over = {}) => ({ who: "방장", counts: { yes: 2, no: 1 }, nameTexts: 0, doneMarks: 0, recordMarks: 0, buttons: 2, wantButtons: 2, ...over });

test("voteCountChecks: 모든 페이지가 같은 숫자·단추 2개·이름 글 0·표식 0 이면 VC1~VC4 통과", () => {
  const lines = voteCountChecks([page(), page({ who: "손님" })], { yes: 2, no: 1 });
  assert.deepEqual(lines.map((l) => l.id), ["VC1", "VC2", "VC3", "VC4"]);
  assert.deepEqual(ids(lines), { VC1: true, VC2: true, VC3: true, VC4: true });
  for (const l of lines) assert.deepEqual(Object.keys(l).sort(), ["detail", "id", "label", "ok"]);
});

test("VC1: 한 페이지의 숫자가 다르거나 숫자 줄이 없으면 실패한다", () => {
  assert.equal(ids(voteCountChecks([page(), page({ counts: { yes: 1, no: 1 } })], { yes: 2, no: 1 })).VC1, false);
  assert.equal(ids(voteCountChecks([page({ counts: null })], { yes: 2, no: 1 })).VC1, false);
});

test("VC2: 유령은 단추 0개(wantButtons 0), 투표자에 단추가 없으면 실패", () => {
  assert.equal(ids(voteCountChecks([page({ who: "유령", buttons: 0, wantButtons: 0 })], { yes: 2, no: 1 })).VC2, true);
  assert.equal(ids(voteCountChecks([page({ buttons: 0 })], { yes: 2, no: 1 })).VC2, false);
});

test("VC3·VC4: 후보 이름 글이나 개인 표 표식(data-done·기록 표식)이 하나라도 있으면 실패한다", () => {
  assert.equal(ids(voteCountChecks([page({ nameTexts: 1 })], { yes: 2, no: 1 })).VC3, false);
  assert.equal(ids(voteCountChecks([page({ doneMarks: 1 })], { yes: 2, no: 1 })).VC4, false);
  assert.equal(ids(voteCountChecks([page({ recordMarks: 2 })], { yes: 2, no: 1 })).VC4, false);
});

test("voteCountChecks: 측정값이 없으면 통과시키지 않는다", () => {
  const lines = voteCountChecks([], { yes: 1, no: 0 });
  assert.equal(lines.length, 4);
  assert.ok(lines.every((l) => !l.ok && /측정값 없음/.test(l.detail)));
});

test("willCarryChecks: 시트가 하나 열려 있고 미리 쓴 글이 채워져 있으면 통과, 시트 0·2개나 다른 글은 실패", () => {
  assert.deepEqual(ids(willCarryChecks({ sheets: 1, value: "글", wantValue: "글" })), { WF1: true, WF2: true });
  assert.equal(ids(willCarryChecks({ sheets: 0, value: "글", wantValue: "글" })).WF1, false);
  assert.equal(ids(willCarryChecks({ sheets: 2, value: "글", wantValue: "글" })).WF1, false);
  assert.equal(ids(willCarryChecks({ sheets: 1, value: "", wantValue: "글" })).WF2, false);
  assert.ok(willCarryChecks(null).every((l) => !l.ok));
});

test("willLockChecks: 시트 0·잠금 1·화면 안 패널·핀이 처형자면 통과한다", () => {
  const panel = { left: 8, top: 510, width: 374, height: 280, right: 382, bottom: 790 };
  const available = { left: 0, top: 80, width: 390, height: 720, right: 390, bottom: 800 };
  const ok = { who: "손님", sheets: 0, locked: 1, panel, available, pinSeat: 3 };
  assert.equal(willLockChecks([ok], { condemned: 3 })[0].ok, true);
  for (const bad of [{ sheets: 1 }, { locked: 0 }, { panel: { ...panel, bottom: 801 } }, { pinSeat: 2 }, { pinSeat: null }]) assert.equal(willLockChecks([{ ...ok, ...bad }], { condemned: 3 })[0].ok, false, JSON.stringify(bad));
  assert.equal(willLockChecks([], { condemned: 3 })[0].ok, false);
});

test("willRevealChecks: 모든 페이지가 같은 글 하나를 3.0초(±0.6) 보면 통과 — 다른 글·시간 어긋남·글 둘은 실패", () => {
  const p = (over = {}) => ({ who: "방장", texts: ["안녕"], visibleMs: 3000, ...over });
  assert.equal(WILL_REVEAL_MS_COPY, 3000);
  assert.equal(willRevealChecks([p(), p({ who: "손님", visibleMs: 3400 })], "안녕")[0].ok, true);
  assert.equal(willRevealChecks([p({ texts: ["다른 글"] })], "안녕")[0].ok, false);
  assert.equal(willRevealChecks([p({ texts: ["안녕", "또"] })], "안녕")[0].ok, false);
  assert.equal(willRevealChecks([p({ visibleMs: 2300 })], "안녕")[0].ok, false);
  assert.equal(willRevealChecks([p({ visibleMs: 3700 })], "안녕")[0].ok, false);
  assert.equal(willRevealChecks([p({ texts: [], visibleMs: null })], "안녕")[0].ok, false);
  assert.equal(willRevealChecks([p({ texts: [EMPTY_WILL_CARD_TEXT] })], EMPTY_WILL_CARD_TEXT)[0].ok, true);
});

/** 360×560 키보드 닫힘 모양: 시트 윗변 y = 324(방 560 − 시트 236), 글칸·[남기기]·[닫기] 가 겹치지 않는다 */
const sheetGood = (over = {}) => ({
  vw: 360,
  vh: 560,
  sheet: rect(10, 324, 340, 236),
  area: rect(22, 380, 316, 84),
  save: rect(244, 500, 96, 48),
  close: rect(296, 336, 44, 44),
  ...over,
});

test("willSheetChecks: 화면 안·겹침 없음·44 이상이면 WF-G1~WF-G4 통과", () => {
  const lines = willSheetChecks(sheetGood());
  assert.deepEqual(lines.map((l) => l.id), ["WF-G1", "WF-G2", "WF-G3", "WF-G4"]);
  assert.deepEqual(ids(lines), { "WF-G1": true, "WF-G2": true, "WF-G3": true, "WF-G4": true });
});

test("WF-G1: 시트 윗변이 화면 위로 나가거나 아랫변이 보이는 높이를 넘으면 실패 (키보드 올림은 vh − K)", () => {
  assert.equal(ids(willSheetChecks(sheetGood({ sheet: rect(10, -4, 340, 236) })))["WF-G1"], false);
  assert.equal(ids(willSheetChecks(sheetGood({ sheet: rect(10, 12, 340, 212) }), { kb: true }))["WF-G1"], true, "윗변 12 는 통과");
  assert.equal(ids(willSheetChecks(sheetGood({ vh: 224, sheet: rect(10, 12, 340, 236) }), { kb: true }))["WF-G1"], false, "키보드 위 영역(224)을 넘는다");
});

test("WF-G2: [남기기]·[닫기]·글칸이 하나라도 겹치면 실패, 변만 닿으면 통과", () => {
  assert.equal(ids(willSheetChecks(sheetGood({ save: rect(244, 440, 96, 48) })))["WF-G2"], false, "글칸 위로 [남기기]가 겹친다");
  assert.equal(ids(willSheetChecks(sheetGood({ close: rect(296, 350, 44, 44) })))["WF-G2"], false, "[닫기]가 글칸과 겹친다");
  assert.equal(ids(willSheetChecks(sheetGood({ save: rect(244, 464, 96, 48) })))["WF-G2"], true, "글칸 아랫변에 닿기만 한다");
});

test("WF-G3: [남기기] 높이 44 미만, [닫기] 44 미만이면 실패", () => {
  assert.equal(ids(willSheetChecks(sheetGood({ save: rect(244, 500, 96, 40) })))["WF-G3"], false);
  assert.equal(ids(willSheetChecks(sheetGood({ close: rect(296, 336, 40, 44) })))["WF-G3"], false);
  assert.equal(ids(willSheetChecks(sheetGood({ save: rect(244, 500, 96, 43.6) })))["WF-G3"], true, "0.5px 오차 허용");
});

test("WF-G4: [남기기]가 보이는 영역 밖이면 실패", () => {
  assert.equal(ids(willSheetChecks(sheetGood({ save: rect(244, 530, 96, 48) })))["WF-G4"], false, "아랫변 578 > 560");
  assert.equal(ids(willSheetChecks(sheetGood({ vh: 224, sheet: rect(10, 12, 340, 212), area: rect(22, 60, 316, 60), save: rect(244, 170, 96, 48), close: rect(296, 20, 44, 44) }), { kb: true }))["WF-G4"], true);
});

test("willSheetChecks: 측정값이 없으면 통과시키지 않는다", () => {
  const lines = willSheetChecks(null);
  assert.equal(lines.length, 4);
  assert.ok(lines.every((l) => !l.ok && /측정값 없음/.test(l.detail)));
});
