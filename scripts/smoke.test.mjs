// smoke.mjs 의 순수 판정 도우미 단위 테스트(18-13, G-18-3). 실행: node --test scripts/smoke.test.mjs
// 가져오기만 해서는 main 이 돌지 않는다(직접 실행 가드). 서버 view 와의 묶음은 test/unit/e2eContract.test.ts 가 본다.
import test from "node:test";
import assert from "node:assert/strict";
import { collectRoleStringPaths, morningProblems, roleStringAllowed } from "./smoke.mjs";

const STATE = { spectate: false, ended: false, frameType: "state" };

test("가져오기 부작용 없음: 이 시험이 끝까지 돌고 SMOKE 줄을 찍지 않는다", () => {
  assert.equal(typeof morningProblems, "function");
});

test("roleStringAllowed: view.players[].look 은 값이 옷 id 일 때만 허용한다", () => {
  assert.equal(roleStringAllowed("view.players[].look", "police", STATE), true);
  assert.equal(roleStringAllowed("view.players[].look", "doctor", STATE), true);
  assert.equal(roleStringAllowed("view.players[].look", "mafia", STATE), true);
  assert.equal(roleStringAllowed("view.players[].look", "citizen", STATE), false);
});

test("roleStringAllowed: 다른 경로의 직업 이름은 여전히 거절한다", () => {
  assert.equal(roleStringAllowed("view.players[].nickname", "mafia", STATE), false);
  assert.equal(roleStringAllowed("view.me.look", "police", STATE), false);
  assert.equal(roleStringAllowed("view.day.morning.who", "doctor", STATE), false);
});

test("roleStringAllowed: 기존 허용 경로(me.role·spectate·result·resultLog part)", () => {
  assert.equal(roleStringAllowed("view.me.role", "mafia", STATE), true);
  assert.equal(roleStringAllowed("view.spectate.seats[].job", "police", { ...STATE, spectate: true }), true);
  assert.equal(roleStringAllowed("view.spectate.seats[].job", "police", STATE), false);
  assert.equal(roleStringAllowed("view.result.seats[].job", "doctor", { ...STATE, ended: true }), true);
  assert.equal(roleStringAllowed("view.result.seats[].job", "doctor", STATE), false);
  assert.equal(roleStringAllowed("part", "mafia", { ...STATE, frameType: "resultLog" }), true);
  assert.equal(roleStringAllowed("part", "mafia", STATE), false);
});

test("collectRoleStringPaths: 배열 인덱스를 [] 로 줄여 직업 이름 잎만 모은다", () => {
  const out = [];
  collectRoleStringPaths({ t: "state", view: { players: [{ nickname: "a", look: "police" }, { nickname: "b", look: "coat" }] } }, "", out);
  assert.deepEqual(out, [{ path: "view.players[].look", value: "police" }]);
});

test("morningProblems: 통과하는 모양", () => {
  const seats = [0, 1, 2, 3, 4];
  assert.deepEqual(morningProblems({ eliminated: 2 }, seats), []);
  assert.deepEqual(morningProblems({ eliminated: 2, trace: "button", seen: { seat: 1, place: "glass" } }, seats), []);
  assert.deepEqual(morningProblems({ eliminated: 2, seen: { seat: 4, place: "tree" } }, seats), []);
});

test("morningProblems: 허용 밖 키·eliminated 없음·trace·seen 모양은 문제로 돌려준다", () => {
  const seats = [0, 1, 2, 3, 4];
  assert.notEqual(morningProblems({ eliminated: 2, phrase: 1 }, seats).length, 0);
  assert.notEqual(morningProblems({ trace: "button" }, seats).length, 0);
  assert.notEqual(morningProblems({ eliminated: 2, trace: "hat" }, seats).length, 0);
  assert.notEqual(morningProblems({ eliminated: 2, seen: { seat: 1, place: "nowhere" } }, seats).length, 0);
  assert.notEqual(morningProblems({ eliminated: 2, seen: { seat: 1, place: "glass", x: 1 } }, seats).length, 0);
  assert.notEqual(morningProblems({ eliminated: 2, seen: { seat: 9, place: "glass" } }, seats).length, 0);
  assert.notEqual(morningProblems({ eliminated: 2, seen: { seat: 1.5, place: "glass" } }, seats).length, 0);
  assert.notEqual(morningProblems({ eliminated: 2, seen: "glass" }, seats).length, 0);
  assert.notEqual(morningProblems({ eliminated: 2, seen: null }, seats).length, 0);
});
