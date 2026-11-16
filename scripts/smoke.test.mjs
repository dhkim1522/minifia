// smoke.mjs 의 순수 판정 도우미 단위 테스트(18-13, G-18-3). 실행: node --test scripts/smoke.test.mjs
// 가져오기만 해서는 main 이 돌지 않는다(직접 실행 가드). 서버 view 와의 묶음은 test/unit/e2eContract.test.ts 가 본다.
import test from "node:test";
import assert from "node:assert/strict";
import { LAMP_PLACE_IDS, PHASE_NEXT_BASIC, PHASE_NEXT_EXTENDED, collectRoleStringPaths, eveningProblems, linkReport, morningProblems, morningSceneProblems, phaseNextTable, roleStringAllowed, serverSpread } from "./smoke.mjs";

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
    { at: 900, sock: 1, raw: `{"t":"state","token":"${SECRET_TOKEN}"}`, msg: { t: "state", token: SECRET_TOKEN, text: SECRET_TEXT, view: { phase: "errand" } } },
  ],
  ...over,
});

test("linkReport: 열린 소켓·마지막 프레임 경과·마지막 단계를 닉네임과 함께 한 줄에 담는다", () => {
  const out = linkReport([fakeClient("스모크1")], 1000);
  assert.ok(out.includes("스모크1: 소켓 열림 · 마지막 프레임 100 ms 전 · 단계 errand"), out);
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

// ---- 21-17: 확장판 새 하루 순서(역할 확인 → 저녁 → 밤 → (아침) → 토론 … 처형 → 저녁)의 다음 단계 표와 저녁·아침 view 판정 ----
const seq = (table, path) => path.slice(1).every((to, i) => (table[path[i]] ?? []).includes(to));

test("PHASE_NEXT_EXTENDED: 새 하루 순서를 허용하고 낮 시작 발표(dayAnnounce)는 어디에도 없다", () => {
  assert.equal(seq(PHASE_NEXT_EXTENDED, ["lobby", "assigning", "roleReveal", "errand", "night", "morning", "discussion", "nomination", "defense", "verdict", "execution", "errand", "night", "discussion"]), true);
  assert.equal(seq(PHASE_NEXT_EXTENDED, ["nomination", "errand"]), true); // 지목 0표·동률은 처형 없는 저녁으로
  assert.equal(seq(PHASE_NEXT_EXTENDED, ["morning", "ended"]), true);
  assert.equal(seq(PHASE_NEXT_EXTENDED, ["execution", "ended"]), true);
  assert.equal("dayAnnounce" in PHASE_NEXT_EXTENDED, false);
  for (const tos of Object.values(PHASE_NEXT_EXTENDED)) assert.equal(tos.includes("dayAnnounce"), false);
  // 옛 순서는 확장판에서 허용하지 않는다
  assert.equal(seq(PHASE_NEXT_EXTENDED, ["roleReveal", "dayAnnounce"]), false);
  assert.equal(seq(PHASE_NEXT_EXTENDED, ["errand", "discussion"]), false);
  assert.equal(seq(PHASE_NEXT_EXTENDED, ["discussion", "night"]), false);
  assert.equal(seq(PHASE_NEXT_EXTENDED, ["execution", "night"]), false);
  assert.equal(seq(PHASE_NEXT_EXTENDED, ["night", "dayAnnounce"]), false);
});

test("PHASE_NEXT_BASIC: 기본 마피아는 역할 확인 → 낮 시작 발표 → 토론 … 처형 → 밤 → 아침 → 낮 시작 발표 (심부름 없음)", () => {
  assert.equal(seq(PHASE_NEXT_BASIC, ["roleReveal", "dayAnnounce", "discussion", "nomination", "defense", "verdict", "execution", "night", "morning", "dayAnnounce"]), true);
  assert.equal(seq(PHASE_NEXT_BASIC, ["nomination", "night"]), true);
  assert.equal(seq(PHASE_NEXT_BASIC, ["morning", "ended"]), true);
  for (const [from, tos] of Object.entries(PHASE_NEXT_BASIC)) assert.equal(from === "errand" || tos.includes("errand"), false, from);
});

test("phaseNextTable: 판 종류에 맞는 표를 돌려주고 모르는 종류는 거절한다", () => {
  assert.equal(phaseNextTable("extended"), PHASE_NEXT_EXTENDED);
  assert.equal(phaseNextTable("basic"), PHASE_NEXT_BASIC);
  assert.throws(() => phaseNextTable("other"));
});

const lampsOk = (over = {}) => ({
  phase: "errand",
  phaseDurationMs: 40_000,
  day: { n: 1, lamps: [], skipCount: 0 },
  me: { errand: { places: ["lamp1", "lamp4", "lamp7"], done: [] } },
  ...over,
});

test("eveningProblems: 가로등 id 셋·day.lamps 배열·day.skipCount 숫자·40초 마감이면 문제 없음", () => {
  assert.deepEqual(eveningProblems(lampsOk()), []);
  assert.deepEqual(eveningProblems(lampsOk({ day: { n: 1, lamps: [0, 3], skipCount: 2 } })), []);
  assert.equal(LAMP_PLACE_IDS.length, 8);
});

test("eveningProblems: 장소가 가로등 id 셋이 아니거나 day.lamps 가 배열이 아니면 실패", () => {
  assert.ok(eveningProblems(lampsOk({ me: { errand: { places: ["glass", "piano", "sax"], done: [] } } })).length > 0);
  assert.ok(eveningProblems(lampsOk({ me: { errand: { places: ["lamp1", "lamp1", "lamp4"], done: [] } } })).length > 0);
  assert.ok(eveningProblems(lampsOk({ me: { errand: { places: ["lamp1", "lamp4"], done: [] } } })).length > 0);
  assert.ok(eveningProblems(lampsOk({ day: { n: 1, lamps: 3, skipCount: 0 } })).length > 0);
  assert.ok(eveningProblems(lampsOk({ day: { n: 1, skipCount: 0 } })).length > 0);
  assert.ok(eveningProblems(lampsOk({ day: { n: 1, lamps: [], skipCount: "0" } })).length > 0);
  assert.ok(eveningProblems(lampsOk({ day: { n: 1, lamps: [] } })).length > 0);
  assert.ok(eveningProblems(lampsOk({ phaseDurationMs: 39_000 })).length > 0);
  assert.ok(eveningProblems(lampsOk({ me: { errand: { places: ["lamp1", "lamp4", "lamp7"], done: ["lamp1"] } } })).length > 0);
  assert.ok(eveningProblems(lampsOk({ me: {} })).length > 0);
  assert.ok(eveningProblems(lampsOk({ me: { errand: { places: ["lamp1", "lamp4", "lamp7"], done: [], seat: 2 } } })).length > 0);
});

const sceneOk = (over = {}) => ({
  phase: "morning",
  day: { n: 1, scene: { house: 2 }, lamps: [1], morning: { eliminated: 2 } },
  me: {},
  ...over,
});

test("morningSceneProblems: day.scene 은 house 하나, me.clues 는 본인 줄 모양만 — 통과하는 모양", () => {
  assert.deepEqual(morningSceneProblems(sceneOk(), [0, 1, 2, 3, 4]), []);
  const clues = [{ spot: 1, kind: "footprint", n: 2 }, { spot: 2, kind: "cloth", piece: "button" }, { spot: 3, kind: "dark" }];
  assert.deepEqual(morningSceneProblems(sceneOk({ me: { clues } }), [0, 1, 2, 3, 4]), []);
  // 확장판 아침에는 day.morning 의 trace·seen 이 없어도 된다
  assert.deepEqual(morningSceneProblems(sceneOk({ day: { n: 1, scene: { house: 2 }, morning: { eliminated: 2 } } }), [0, 1, 2, 3, 4]), []);
});

test("morningSceneProblems: day.scene 키가 house 하나가 아니거나 me.clues 줄에 허용 밖 키가 있으면 실패", () => {
  const seats = [0, 1, 2, 3, 4];
  assert.ok(morningSceneProblems(sceneOk({ day: { n: 1, scene: { house: 2, role: "mafia" } } }), seats).length > 0);
  assert.ok(morningSceneProblems(sceneOk({ day: { n: 1, scene: {} } }), seats).length > 0);
  assert.ok(morningSceneProblems(sceneOk({ day: { n: 1, scene: { house: 9 } } }), seats).length > 0);
  assert.ok(morningSceneProblems(sceneOk({ day: { n: 1, scene: "2" } }), seats).length > 0);
  assert.ok(morningSceneProblems(sceneOk({ me: { clues: [{ spot: 1, kind: "footprint", n: 2, seat: 3 }] } }), seats).length > 0);
  assert.ok(morningSceneProblems(sceneOk({ me: { clues: [{ spot: 4, kind: "footprint", n: 1 }] } }), seats).length > 0);
  assert.ok(morningSceneProblems(sceneOk({ me: { clues: [{ spot: 1, kind: "mafia" }] } }), seats).length > 0);
  assert.ok(morningSceneProblems(sceneOk({ me: { clues: [{ spot: 2, kind: "cloth", piece: "role" }] } }), seats).length > 0);
  assert.ok(morningSceneProblems(sceneOk({ me: { clues: "x" } }), seats).length > 0);
});
