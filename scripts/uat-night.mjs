// 3페이즈 밤·아침 UAT 를 봇으로 대신 도는 시나리오. 봇이 방을 만들고 채워 밤 두 번을 돌며 결과 표를 낸다.
// 스크립트는 전지적이다: 각 클라이언트의 view.me.role 로 역할을 알고 그 역할대로 행동시킨다.
// 낮은 직업 주장 차례(결정 0023·0027)에 자기 차례가 오면 말 안 함(none)을 바로 보내고 토론 40초·처형 여부 투표 13초(표를 안 던짐 → 미통과 → 밤, 결정 0036)는 서버 타이머로 넘긴다. 전체 약 4분.
// 역할별 일지(결정 0026·0027-11)를 본다: 경찰 수사 {n,target,isMafia}, 마피아 암살 {n,target,died}, 의사 치료 {n,target}.
//
//   밤1: 마피아 전원 → 시민 X 지목, 경찰 → 마피아 조사, 의사 → 자신 보호, 마피아 한 명이 밤 채팅(nightTarget).
//        마피아가 둘(6명 이상)이면 서로 다른 시민 A·B 를 골라 동률 추첨을 본다(탈락자는 둘 중 하나).
//   아침1: 모든 폰이 같은 day.morning(탈락자 = 지목한 사람, 문구 1..MORNING_PHRASE_COUNT), players[].alive 일치, 경찰 기록 1건·isMafia true,
//          마피아 전원 같은 암살일지 1건(target = 탈락자, died true), 의사 치료일지 1건(target = 자신),
//          그 역할 밖 프레임에는 records 키 없음·줄 키는 역할별, 살아 있는 비마피아는 밤 chat·emoji 0,
//          탈락자만 spectate(모든 직업), 아침 중 pick → WRONG_PHASE.
//   밤2: 탈락자(관전자)가 밤 행동 state(spectate.picks)·마피아 채팅·이모티콘을 받고, 자기 pick·say·emoji 는 BAD_MESSAGE.
//        마피아 → 시민 Z, 의사 → Z 보호(의사 없는 4명판은 탈락).
//   아침2: 의사 구출이면 모든 폰의 morning 이 {} 로 같고(구출 비공개), 경찰 기록은 2건,
//          마피아 전원의 마지막 암살일지는 died false(구출), 의사 마지막 치료일지는 구한 seat.
//
// 사용법: node scripts/uat-night.mjs [--prod | <기준 주소>] [--players 4~8]
// 화면 모양·애니메이션·실제 폰 시계 차이는 봇으로 볼 수 없다. 토큰은 어떤 출력에도 찍지 않는다.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const args = { base: null, prod: false, players: 5 };
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === "--prod") args.prod = true;
  else if (a === "--players") args.players = Number(process.argv[++i]);
  else if (!a.startsWith("--")) args.base = a;
}
if (!Number.isInteger(args.players) || args.players < 4 || args.players > 8) throw new Error("--players 는 4~8");
let base = args.base;
if (args.prod) base = readFileSync(fileURLToPath(new URL("./prod-url.txt", import.meta.url)), "utf8").trim();
const url = new URL((base ?? "http://localhost:5173").replace(/\/+$/, ""));
const wsBase = `${url.protocol === "https:" ? "wss:" : "ws:"}//${url.host}`;
const N = args.players;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (test, label, ok, detail = "") => results.push({ test, label, ok, detail });
const CLAIM_TURN_MS = 8_000;
const CLAIM_WAIT_MS = CLAIM_TURN_MS * N; // 차례 대기 한도: 모두 시간 초과일 때 최대 인원 × 8초
const EXEC_VOTE_MS = 13_000; // 처형 여부 투표(shared/game/phases.ts EXEC_VOTE_MS): 하루마다 표를 안 던지고 지나간다
const OVERALL_LIMIT_MS = 540_000 + 2 * EXEC_VOTE_MS + CLAIM_WAIT_MS;
// shared/protocol.ts 의 MORNING_PHRASE_COUNT 와 같은 값(스크립트는 TS 를 import 하지 않는다). 아침 탈락 문구 번호는 1..7.
const MORNING_PHRASE_COUNT = 7;
// 역할별 일지 줄의 키 집합
const RECORD_KEYS = { police: "isMafia,n,target", mafia: "died,n,target", doctor: "n,target" };

async function waitUntil(pred, ms, label) {
  const start = performance.now();
  while (!pred()) {
    if (performance.now() - start > ms) throw new Error(`${label} (${ms / 1000}초 제한 초과)`);
    await sleep(10);
  }
}

async function post(path, body) {
  const res = await fetch(`${url.origin}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: res.status, data: await res.json().catch(() => null) };
}

function connect(c, code) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${wsBase}/api/rooms/${code}/ws`);
    c.ws = ws;
    ws.addEventListener("open", () => ws.send(JSON.stringify({ t: "hello", token: c.token })));
    ws.addEventListener("message", (ev) => {
      const raw = String(ev.data);
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }
      c.frames.push({ at: performance.now(), msg, raw });
      if (msg.t === "ping") ws.send(JSON.stringify({ t: "pong", c: msg.c }));
      if (msg.t === "state") resolve();
    });
    ws.addEventListener("close", (ev) => { if (!c.leaving) c.closedCode = ev.code; });
    ws.addEventListener("error", () => reject(new Error(`${c.nickname} 연결 오류`)));
  });
}

const states = (c) => c.frames.filter((f) => f.msg.t === "state");
const lastView = (c) => states(c).at(-1)?.msg.view ?? null;
const stateAt = (c, phase, n) => states(c).find((f) => f.msg.view.phase === phase && f.msg.view.day?.n === n);
const send = (c, m) => c.ws.send(JSON.stringify(m));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sorted = (xs) => [...xs].sort((a, b) => a - b);

// 요청을 보내 error 프레임의 코드를 돌려준다(응답이 없으면 "(응답 없음)").
async function requestError(c, msg) {
  const before = c.frames.length;
  send(c, msg);
  try {
    await waitUntil(() => c.frames.slice(before).some((f) => f.msg.t === "error"), 5000, "error 프레임");
  } catch {
    return "(응답 없음)";
  }
  return c.frames.slice(before).find((f) => f.msg.t === "error").msg.code;
}

// 한 밤(단계 night n 시작부터 morning n 시작 전까지)에 받은 프레임 중 종류별 개수
function nightCounts(c, n) {
  const from = stateAt(c, "night", n)?.at ?? Infinity;
  const to = stateAt(c, "morning", n)?.at ?? Infinity;
  const win = c.frames.filter((f) => f.at >= from && f.at < to);
  return { chat: win.filter((f) => f.msg.t === "chat").length, emoji: win.filter((f) => f.msg.t === "emoji").length, states: win.filter((f) => f.msg.t === "state").length };
}

async function main() {
  console.log(`대상 ${url.origin}, ${N}명`);
  const clients = Array.from({ length: N }, (_, i) => ({ nickname: `밤봇${i + 1}`, token: "", seat: -1, frames: [], ws: null, role: null, leaving: false, closedCode: null }));
  const host = clients[0];
  const created = await post("/api/rooms", { nickname: host.nickname });
  if (created.status !== 201) throw new Error(`방 만들기 ${created.status}`);
  const code = created.data.code;
  Object.assign(host, { token: created.data.token, seat: created.data.seat });
  for (const c of clients.slice(1)) {
    const j = await post(`/api/rooms/${code}/join`, { nickname: c.nickname });
    if (j.status !== 200 && j.status !== 201) throw new Error(`참가 ${j.status}`);
    Object.assign(c, { token: j.data.token, seat: j.data.seat });
  }
  for (const c of clients) await connect(c, code);
  await waitUntil(() => lastView(host)?.players.every((p) => p.connected), 10_000, "모두 연결");
  // 차례 응답기: 자기 차례(claim 단계 + day.turn.seat === 내 seat)가 오면 일차마다 한 번 none 을 보낸다(키 = 일차:seat).
  // 2일차 첫 차례는 탈락자 claim 거부 시험이 끝날 때까지 붙든다(차례가 빨리 지나가 claim 단계가 끝나면 WRONG_PHASE 가 되어 시험이 틀어진다).
  let holdDay2Claims = true;
  const claimSent = new Set();
  const claimDriver = setInterval(() => {
    for (const c of clients) {
      const v = lastView(c);
      if (!v || v.phase !== "claim" || v.day?.turn?.seat !== c.seat) continue;
      if (v.day.n === 2 && holdDay2Claims) continue;
      const key = `${v.day.n}:${c.seat}`;
      if (claimSent.has(key)) continue;
      claimSent.add(key);
      if (c.ws.readyState === WebSocket.OPEN) send(c, { t: "claim", claim: "none" });
    }
  }, 50);
  console.log(`방 ${code} — 시작`);
  send(host, { t: "start" });

  // ---- 1일차 낮: 차례마다 none 을 보내고 토론은 서버 타이머로 밤까지 (약 100초) ----
  console.log("1일차 낮을 타이머로 넘기는 중(약 2분)");
  await waitUntil(() => clients.every((c) => stateAt(c, "night", 1)), 170_000 + EXEC_VOTE_MS + CLAIM_WAIT_MS, "1일차 밤");
  for (const c of clients) c.role = stateAt(c, "night", 1).msg.view.me.role;
  const byRole = (r) => clients.filter((c) => c.role === r);
  const mafias = byRole("mafia").sort((a, b) => a.seat - b.seat);
  const police = byRole("police")[0];
  const doctor = byRole("doctor")[0] ?? null;
  const citizens = byRole("citizen").sort((a, b) => a.seat - b.seat);
  const bySeatClient = (seat) => clients.find((c) => c.seat === seat);
  check("준비", "역할 구성(마피아·경찰·의사·시민)", mafias.length >= 1 && !!police && (doctor !== null) === (N >= 5) && citizens.length >= 2,
    `마피아 ${mafias.length}, 경찰 ${police ? 1 : 0}, 의사 ${doctor ? 1 : 0}, 시민 ${citizens.length}`);

  // ---- 밤1 ----
  console.log("1일차 밤 — 역할별 행동");
  const dual = mafias.length >= 2;
  const picks1 = dual ? [citizens[0].seat, citizens[1].seat] : [citizens[0].seat]; // 마피아별 지목
  const mafiaPick1 = (i) => picks1[dual ? i % 2 : 0];
  const policeTarget1 = mafias[0].seat;
  mafias.forEach((m, i) => send(m, { t: "pick", target: mafiaPick1(i) }));
  send(police, { t: "pick", target: policeTarget1 });
  if (doctor) send(doctor, { t: "pick", target: doctor.seat });
  const actors1 = [...mafias.map((m, i) => [m, mafiaPick1(i)]), [police, policeTarget1], ...(doctor ? [[doctor, doctor.seat]] : [])];
  await waitUntil(() => actors1.every(([c, seat]) => lastView(c).phase === "night" && lastView(c).me.pick === seat), 10_000, "밤1 본인 선택 반영");
  check("밤1", "행위자 화면에 본인 선택(me.pick)이 돌아옴", true, `행동한 사람 ${actors1.length}명`);
  // 마피아 동료 선택 배지: 서로의 선택 seat 만 (누가 골랐는지는 없다)
  const wantAlly = (i) => sorted(new Set(mafias.map((_, k) => k).filter((k) => k !== i).map((k) => mafiaPick1(k))));
  await waitUntil(() => mafias.every((m, i) => same(lastView(m).me.allyPicks, wantAlly(i))), 10_000, "밤1 동료 선택(allyPicks)");
  check("밤1", "마피아 allyPicks 가 동료가 고른 대상 seat 뿐", true, dual ? "마피아 둘이 서로의 선택만 봄" : "마피아 혼자: 빈 배열");
  const talker1 = mafias[0];
  send(talker1, { t: "say", template: "nightTarget", target: mafiaPick1(0) });
  await waitUntil(() => mafias.every((m) => m.frames.some((f) => f.msg.t === "chat" && f.msg.template === "nightTarget")), 10_000, "밤1 마피아 채팅 도착");
  await sleep(1500); // 새는 프레임이 있다면 도착할 시간

  // ---- 아침1 ----
  await waitUntil(() => clients.every((c) => stateAt(c, "morning", 1)), 45_000, "1일차 아침");
  // 아침 중 pick 은 WRONG_PHASE (마감 뒤 pick 과 같은 거부 경로, 서버가 단계를 먼저 넘긴다)
  const wrongCode = await requestError(police, { t: "pick", target: policeTarget1 });
  check("아침1", "아침 state 를 받은 뒤 pick → WRONG_PHASE", wrongCode === "WRONG_PHASE", wrongCode);

  const m1 = clients.map((c) => stateAt(c, "morning", 1).msg.view);
  const morning1 = m1[0].day.morning;
  const X = morning1.eliminated;
  const sameMorning = m1.every((v) => same(v.day.morning, morning1));
  check("아침1", "모든 폰이 같은 day.morning", sameMorning, JSON.stringify(morning1));
  check("아침1", dual ? "탈락자가 두 후보(A·B) 중 하나 (동률 추첨)" : "탈락자 = 마피아가 지목한 시민", picks1.includes(X), `후보 ${picks1.join("·")} → 탈락 ${X}`);
  check("아침1", `탈락 문구 번호 1..${MORNING_PHRASE_COUNT} 정수`, Number.isInteger(morning1.phrase) && morning1.phrase >= 1 && morning1.phrase <= MORNING_PHRASE_COUNT, `문구 ${morning1.phrase}`);
  const aliveOk = m1.every((v) => v.players.every((p) => p.alive === (p.seat !== X)));
  check("아침1", "players[].alive 가 탈락자만 false", aliveOk, "");
  const xClient = bySeatClient(X);
  const rec1 = stateAt(police, "morning", 1).msg.view.me.records;
  check("아침1", "경찰 수사 기록 1건 (n 1, isMafia true)", Array.isArray(rec1) && rec1.length === 1 && same(rec1[0], { n: 1, target: policeTarget1, isMafia: true }), JSON.stringify(rec1));
  const recOf = (c, n) => stateAt(c, "morning", n).msg.view.me.records;
  const lineIs = (line, want) => !!line && same(Object.entries(line).sort(), Object.entries(want).sort());
  const mafiaRec1 = mafias.map((m) => recOf(m, 1));
  check("아침1", "마피아 전원이 같은 암살일지 1건 (target = 탈락자, died true)", mafiaRec1.every((r) => Array.isArray(r) && r.length === 1 && lineIs(r[0], { n: 1, target: X, died: true })), JSON.stringify(mafiaRec1[0]));
  if (doctor) {
    const docRec1 = recOf(doctor, 1);
    check("아침1", "의사 치료일지 1건 (n 1, target = 자신, 키 n·target 뿐)", Array.isArray(docRec1) && docRec1.length === 1 && lineIs(docRec1[0], { n: 1, target: doctor.seat }), JSON.stringify(docRec1));
  }
  // records 는 본인 역할 프레임에만, 줄 키는 역할별. 시민 등 그 밖 역할의 프레임에는 키 자체가 없다.
  const recLeak = clients.filter((c) => !(c.role in RECORD_KEYS)).some((c) => c.frames.some((f) => f.raw.includes('"records"')));
  check("아침1", "일지가 없는 역할(시민)의 프레임에 records 키 없음", !recLeak, "");
  const recKeyBad = clients.filter((c) => c.role in RECORD_KEYS).flatMap((c) => c.frames
    .filter((f) => f.msg.t === "state")
    .flatMap((f) => (f.msg.view.me.records ?? []).map((line) => Object.keys(line).sort().join(",")).filter((k) => k !== RECORD_KEYS[c.role])));
  check("아침1", "일지 줄 키가 역할별 (경찰 isMafia·마피아 died·의사 n,target)", recKeyBad.length === 0, recKeyBad.join(" | "));
  const nonMafiaAlive = clients.filter((c) => c.role !== "mafia");
  const leak1 = nonMafiaAlive.map((c) => nightCounts(c, 1)).reduce((a, k) => a + k.chat + k.emoji, 0);
  const mafiaGot1 = mafias.every((m) => nightCounts(m, 1).chat >= 1);
  check("밤1", "살아 있는 비마피아의 밤 chat·emoji 프레임 0", leak1 === 0, `비마피아 ${nonMafiaAlive.length}명 합계 ${leak1}`);
  check("밤1", "마피아는 모두 밤 채팅을 받음", mafiaGot1, "");
  const citizenIdle = citizens.filter((c) => c.seat !== X);
  const idleStates = citizenIdle.map((c) => nightCounts(c, 1).states);
  check("밤1", "행동하지 않은 시민은 밤 동안 state 1개(밤 시작)뿐", idleStates.every((n) => n === 1), `시민 state 수 ${idleStates.join(",")}`);
  const spectate1 = stateAt(xClient, "morning", 1).msg.view.spectate;
  const jobsOk = !!spectate1 && spectate1.seats.length === N && spectate1.seats.every((s) => s.job === bySeatClient(s.seat).role);
  check("아침1", "탈락자 아침 state 에 spectate.seats(모든 직업이 실제와 같음)", jobsOk, "");
  const specBefore = xClient.frames.some((f) => f.at < stateAt(xClient, "morning", 1).at && f.raw.includes('"spectate"'));
  check("아침1", "탈락자도 아침 전 프레임에는 spectate 없음", !specBefore, "");
  const specOthers = clients.filter((c) => c !== xClient).some((c) => c.frames.some((f) => f.raw.includes('"spectate"')));
  check("아침1", "살아 있는 클라이언트 프레임에 spectate 키 없음", !specOthers, "");
  const roleTextOthers = clients.filter((c) => c !== xClient).some((c) => c.frames.some((f) => f.msg.t === "state" && /"job"/.test(f.raw)));
  check("아침1", "살아 있는 클라이언트 프레임에 job 키 없음", !roleTextOthers, "");

  // ---- 2일차 낮 (탈락자 거부) ----
  console.log("2일차 낮 — 탈락자 claim 거부 확인 후 타이머로 밤까지");
  await waitUntil(() => stateAt(xClient, "claim", 2), 40_000 + CLAIM_WAIT_MS, "2일차 claim");
  const claimCode = await requestError(xClient, { t: "claim", claim: "none" });
  check("낮2", "탈락자의 claim → BAD_MESSAGE", claimCode === "BAD_MESSAGE", claimCode);
  holdDay2Claims = false;
  await waitUntil(() => clients.every((c) => stateAt(c, "night", 2)), 150_000 + EXEC_VOTE_MS + CLAIM_WAIT_MS, "2일차 밤");

  // ---- 밤2 ----
  console.log("2일차 밤 — 관전자 수신·구출");
  const alive2 = clients.filter((c) => c !== xClient);
  const Z = citizens.filter((c) => c.seat !== X)[0].seat;
  const policeTarget2 = Z;
  for (const m of mafias) send(m, { t: "pick", target: Z });
  send(police, { t: "pick", target: policeTarget2 });
  if (doctor) send(doctor, { t: "pick", target: Z });
  const actors2 = [...mafias.map((m) => [m, Z]), [police, policeTarget2], ...(doctor ? [[doctor, Z]] : [])];
  await waitUntil(() => actors2.every(([c, seat]) => lastView(c).phase === "night" && lastView(c).me.pick === seat), 10_000, "밤2 본인 선택 반영");
  // 관전자가 행동 state 를 받음: 마피아·경찰(·의사)의 선택이 spectate.picks 에 있음
  const wantPicks = { mafia: [Z], police: [policeTarget2], doctor: doctor ? [Z] : [] };
  let gotPicks = false;
  try {
    await waitUntil(() => { const sp = lastView(xClient)?.spectate; return lastView(xClient)?.phase === "night" && sp?.picks && same(sp.picks, wantPicks); }, 10_000, "관전 행동 state");
    gotPicks = true;
  } catch { /* 아래 check 에 실패로 기록 */ }
  check("밤2", "탈락자가 밤 행동 state(spectate.picks)를 받음", gotPicks, JSON.stringify(lastView(xClient)?.spectate?.picks ?? null));
  const actualJobs = lastView(xClient)?.spectate?.seats ?? [];
  check("밤2", "탈락자 view 의 실제 직업(spectate.seats)이 모두 맞음", actualJobs.length === N && actualJobs.every((s) => s.job === bySeatClient(s.seat).role), "");

  const talker2 = mafias[0];
  send(talker2, { t: "say", template: "nightAgree" });
  await waitUntil(() => mafias.every((m) => m.frames.some((f) => f.msg.t === "chat" && f.msg.template === "nightAgree")), 10_000, "밤2 마피아 채팅 도착");
  await sleep(2100);
  send(talker2, { t: "emoji", icon: "suspicious" });
  await waitUntil(() => mafias.every((m) => nightCounts(m, 2).emoji >= 1), 10_000, "밤2 마피아 이모티콘 도착");
  await sleep(1500);
  const xCounts = nightCounts(xClient, 2);
  check("밤2", "탈락자가 마피아 밤 채팅·이모티콘을 받음", xCounts.chat >= 1 && xCounts.emoji >= 1, `chat ${xCounts.chat}, emoji ${xCounts.emoji}`);
  const aliveNonMafia2 = alive2.filter((c) => c.role !== "mafia");
  const leak2 = aliveNonMafia2.map((c) => nightCounts(c, 2)).reduce((a, k) => a + k.chat + k.emoji, 0);
  check("밤2", "살아 있는 비마피아의 밤 chat·emoji 프레임 0", leak2 === 0, `비마피아 ${aliveNonMafia2.length}명 합계 ${leak2}`);
  // 탈락자의 행동은 모두 BAD_MESSAGE, 그 뒤 다른 클라이언트에 X 의 chat·emoji 가 없음
  const xPick = await requestError(xClient, { t: "pick", target: Z });
  const xSay = await requestError(xClient, { t: "say", template: "nightAgree" });
  const xEmoji = await requestError(xClient, { t: "emoji", icon: "smile" });
  check("밤2", "탈락자의 pick·say·emoji → BAD_MESSAGE", xPick === "BAD_MESSAGE" && xSay === "BAD_MESSAGE" && xEmoji === "BAD_MESSAGE", `pick ${xPick}, say ${xSay}, emoji ${xEmoji}`);
  await sleep(1000);
  const xEcho = clients.filter((c) => c !== xClient).some((c) => c.frames.some((f) => (f.msg.t === "chat" || f.msg.t === "emoji") && f.msg.seat === X && f.at >= stateAt(c, "night", 2).at));
  check("밤2", "탈락자의 거부된 요청이 다른 클라이언트에 chat·emoji 로 가지 않음", !xEcho, "");

  // ---- 아침2 ----
  await waitUntil(() => clients.every((c) => stateAt(c, "morning", 2)), 45_000, "2일차 아침");
  const m2 = clients.map((c) => stateAt(c, "morning", 2).msg.view);
  const morning2 = m2[0].day.morning;
  check("아침2", "모든 폰이 같은 day.morning", m2.every((v) => same(v.day.morning, morning2)), JSON.stringify(morning2));
  if (doctor) {
    check("아침2", "의사 구출: morning 이 {} (구출 비공개)", same(morning2, {}), JSON.stringify(morning2));
    check("아침2", "탈락자는 X 한 명뿐 (alive)", m2.every((v) => v.players.every((p) => p.alive === (p.seat !== X))), "");
  } else {
    check("아침2", "의사 없는 판: 마피아 지목 Z 탈락", morning2.eliminated === Z, JSON.stringify(morning2));
  }
  const rec2 = stateAt(police, "morning", 2).msg.view.me.records;
  check("아침2", "경찰 수사 기록 2건 (n 1 마피아 · n 2 시민)", Array.isArray(rec2) && rec2.length === 2 && same(rec2[0], rec1[0]) && same(rec2[1], { n: 2, target: policeTarget2, isMafia: false }), JSON.stringify(rec2));
  // 마피아 암살일지 2건: 의사가 막으면 died false(마피아 전원 같은 줄), 의사 없는 판은 died true
  const mafiaRec2 = mafias.map((m) => recOf(m, 2));
  check("아침2", doctor ? "의사 구출: 마피아 전원의 마지막 암살일지 died false" : "의사 없는 판: 마피아 전원의 마지막 암살일지 died true",
    mafiaRec2.every((r) => Array.isArray(r) && r.length === 2 && lineIs(r[0], { n: 1, target: X, died: true }) && lineIs(r[1], { n: 2, target: Z, died: !doctor })), JSON.stringify(mafiaRec2[0]));
  if (doctor) {
    const docRec2 = recOf(doctor, 2);
    check("아침2", "의사 치료일지 2건 (마지막 = 구한 seat, 구출 여부 키 없음)", Array.isArray(docRec2) && docRec2.length === 2 && lineIs(docRec2[0], { n: 1, target: doctor.seat }) && lineIs(docRec2[1], { n: 2, target: Z }), JSON.stringify(docRec2));
  }

  // ---- 끝: 전체 프레임 검사 ----
  const specAll = clients.filter((c) => c !== xClient).some((c) => c.frames.some((f) => f.raw.includes('"spectate"')));
  check("전체", "끝까지 살아 있는 클라이언트 프레임에 spectate 키 없음", !specAll, "");
  const closed = clients.filter((c) => c.closedCode !== null).map((c) => c.nickname);
  check("전체", "소켓이 예상 밖으로 닫히지 않음", closed.length === 0, closed.join(","));
  const tokenLeak = clients.some((c) => clients.some((o) => o !== c && c.frames.some((f) => f.raw.includes(o.token))));
  check("전체", "다른 사람의 토큰이 프레임에 없음", !tokenLeak, "");

  clearInterval(claimDriver);
  for (const c of clients) { c.leaving = true; try { send(c, { t: "leave" }); c.ws.close(); } catch { /* 닫힘 */ } }

  console.log("\n테스트 | 항목 | 결과 | 내용");
  for (const r of results) console.log(`${r.test} | ${r.label} | ${r.ok ? "통과" : "실패"} | ${r.detail}`);
  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} 통과`);
  process.exit(results.every((r) => r.ok) ? 0 : 1);
}

const overall = setTimeout(() => { console.log(`중단: 전체 ${OVERALL_LIMIT_MS / 1000}초 제한 초과`); process.exit(2); }, OVERALL_LIMIT_MS);
main().catch((e) => { clearTimeout(overall); console.log(`중단: ${e.message}`); process.exit(2); });
