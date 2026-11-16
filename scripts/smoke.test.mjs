// smoke.mjs 의 순수 판정 도우미 단위 테스트(18-13, G-18-3). 실행: node --test scripts/smoke.test.mjs
// 가져오기만 해서는 main 이 돌지 않는다(직접 실행 가드). 서버 view 와의 묶음은 test/unit/e2eContract.test.ts 가 본다.
import test from "node:test";
import assert from "node:assert/strict";
import { collectRoleStringPaths, linkReport, morningProblems, roleStringAllowed, serverSpread } from "./smoke.mjs";

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
});

test("morningProblems: 허용 밖 키(지운 trace·seen 포함)·eliminated 없음은 문제로 돌려준다", () => {
  const seats = [0, 1, 2, 3, 4];
  assert.notEqual(morningProblems({ eliminated: 2, phrase: 1 }, seats).length, 0);
  assert.notEqual(morningProblems({}, seats).length, 0);
  assert.notEqual(morningProblems({ eliminated: 2, trace: "button" }, seats).length, 0);
  assert.notEqual(morningProblems({ eliminated: 2, seen: { seat: 1, place: "glass" } }, seats).length, 0);
});

test("serverSpread: view.serverNow 의 최대 - 최소(반올림 ms)", () => {
  assert.equal(serverSpread([{ serverNow: 1000 }, { serverNow: 1003 }, { serverNow: 1001 }]), 3);
  assert.equal(serverSpread([{ serverNow: 5 }]), 0);
  assert.equal(serverSpread([{ serverNow: 1000 }, { serverNow: 1000.6 }]), 1);
});

test("serverSpread: serverNow 가 없거나 숫자가 아니거나 빈 배열이면 null", () => {
  assert.equal(serverSpread([{ serverNow: 1000 }, {}]), null);
  assert.equal(serverSpread([{ serverNow: 1000 }, { serverNow: Number.NaN }]), null);
  assert.equal(serverSpread([{ serverNow: 1000 }, { serverNow: "1001" }]), null);
  assert.equal(serverSpread([]), null);
});

const SECRET_TOKEN = "tok-secret-9f3a";
const SECRET_TEXT = "채팅본문-비밀-7c1";
const fakeClient = (nickname, over = {}) => ({
  nickname,
  token: SECRET_TOKEN,
  unexpectedClose: null,
  expectClose: false,
  sockets: 1,
  ws: { readyState: 1 },
  frames: [
    { at: 500, sock: 1, raw: `{"t":"chat","text":"${SECRET_TEXT}"}`, msg: { t: "chat", text: SECRET_TEXT } },
    { at: 900, sock: 1, raw: `{"t":"state","token":"${SECRET_TOKEN}"}`, msg: { t: "state", token: SECRET_TOKEN, text: SECRET_TEXT, view: { phase: "discussion" } } },
  ],
  ...over,
});

test("linkReport: 열린 소켓·마지막 프레임 경과·마지막 단계를 닉네임과 함께 한 줄에 담는다", () => {
  const out = linkReport([fakeClient("스모크1")], 1000);
  assert.ok(out.includes("스모크1: 소켓 열림 · 마지막 프레임 100 ms 전 · 단계 discussion"), out);
});

test("linkReport: 예기치 않게 닫힌 클라이언트는 닫힘(code N)", () => {
  const out = linkReport([fakeClient("스모크1"), fakeClient("스모크2", { unexpectedClose: 1006 })], 1000);
  assert.ok(out.includes("스모크2: 소켓 닫힘(code 1006)"), out);
  assert.ok(out.includes("스모크1: 소켓 열림"), out);
});

test("linkReport: 지금 소켓 id 의 프레임만 마지막 프레임으로 센다(재접속 전 프레임은 아니다)", () => {
  const c = fakeClient("스모크1", { sockets: 2 });
  c.frames.push({ at: 950, sock: 2, raw: "{}", msg: { t: "state", view: { phase: "discussion" } } });
  c.frames.push({ at: 990, sock: 1, raw: "{}", msg: { t: "pong" } });
  assert.ok(linkReport([c], 1000).includes("마지막 프레임 50 ms 전 · 단계 discussion"));
});

test("linkReport: 프레임이 없으면 없다고 쓰고, 토큰·채팅 본문·프레임 원문은 결과에 없다", () => {
  const none = linkReport([fakeClient("스모크3", { frames: [] })], 1000);
  assert.ok(none.includes("프레임 없음"), none);
  const out = linkReport([fakeClient("스모크1"), fakeClient("스모크2", { unexpectedClose: 1006 })], 1000);
  assert.ok(!out.includes(SECRET_TOKEN), out);
  assert.ok(!out.includes(SECRET_TEXT), out);
  assert.ok(!out.includes('"t"'), out);
});

// ---- 단계 전이 표 (판 종류가 없어 하나) ----
// 앱의 nextPhaseOf 와의 대조(표가 서버 분기와 같다)는 test/unit/e2eContract.test.ts 가 한다 — 이 시험은 표의 모양만 본다.
import { PHASE_NEXT } from "./smoke.mjs";

test("PHASE_NEXT: 표마다 가리키는 단계가 모두 표의 키다", () => {
  for (const [from, nexts] of Object.entries(PHASE_NEXT)) {
    for (const to of nexts) assert.ok(Object.hasOwn(PHASE_NEXT, to), `${from} → ${to} 가 표의 키가 아님`);
  }
});

test("전이 표: 역할 확인 → 낮 시작 발표 → 토론, 처형 뒤·지목 0표는 밤, 아침 다음은 낮 시작 발표다", () => {
  const g = PHASE_NEXT;
  assert.deepEqual(g.roleReveal, ["dayAnnounce"]);
  assert.deepEqual(g.dayAnnounce, ["discussion"]);
  assert.deepEqual(g.nomination.slice().sort(), ["defense", "night"]);
  assert.deepEqual(g.execution.slice().sort(), ["ended", "night"]);
  assert.deepEqual(g.morning.slice().sort(), ["dayAnnounce", "ended"]);
  assert.equal(Object.hasOwn(g, "errand"), false); // errand 0건
});
