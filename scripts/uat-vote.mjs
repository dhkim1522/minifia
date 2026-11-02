// 8페이즈 낮 처형·종료 UAT 를 봇으로 대신 도는 시나리오(결정 0053·0060). 봇이 방을 만들고 채워 두 판을 끝까지 돌며 결과 표를 낸다.
// 스크립트는 전지적이다: 각 클라이언트의 view.me.role 로 마피아를 알고 그에 맞춰 지목·찬반을 던진다. 직업 주장 차례는 없다(7페이즈).
// 낮 한 바퀴는 토론 → (과반이 토론 끝내기) 지목 15초 → 변론 20초 → 찬반 10초 → 처형 5초 → 밤 30초 → 아침 5초다. 토론 90초는 과반이 일찍 끝낸다. 두 판을 차례로 돈다. 전체 약 6~7분.
//
//   (a) 5명 — 처형으로 시민이 이기는 판
//        토론 끝내기: 개수만 모두에게, 누른 본인 값은 본인에게만(취소 가능). 과반(3/5) 직후 지목으로 넘어간다.
//        지목: 한 명 지목마다 모든 클라이언트의 day.points 가 같은 공개 목록, 자기 지목·취소(null)는 거부, 지목 바꾸기.
//        변론: 후보 = 마피아. 후보뿐 아니라 누구나 chat 을 보낼 수 있고 후보·비후보의 줄이 모두에게 간다(ch all, UI-SPEC D1·결정 0053).
//        찬반: 변론자는 못 던짐. 첫 표는 던진 좌석만 모두에게(day.voted), 값 변경은 본인에게만(다른 클라이언트 state 0), 남의 값은 어느 프레임에도 없음.
//        처형: 모든 클라이언트 day.execution {seat, phrase 1..4}·day.verdict {yes, no, passed}, 살아 있는 클라이언트 프레임에 처형자 직업이 허용 경로 밖에 없음.
//        종료: 처형 5초 뒤 ended — 모든 클라이언트 같은 result(citizenWin, 5자리, 요약 1줄), 종료 중 chat → chatReject{phase}(UI-SPEC D1: 결과 화면은 채팅 단계가 아니다).
//   (b) 4명 — 경계: 0표 · 동률 · 부결, 마지막은 처형으로 마피아가 이기는 판
//        1일차 지목 0표 → 변론 없이 곧장 밤(noExecution noVotes). 2일차 동률 → 밤(tie). 3일차 시민 하나가 최다 득표 → 변론 → 찬반에서 한 명만 찬성하고
//        나머지는 기권(분모는 변론자를 뺀 산 사람 전원이라 1/3 은 부결, 결정 0053) → 처형 단계에서 부결을 알리고 아무도 탈락하지 않으며 밤에는 noExecution 이 없다.
//        그 밤 마피아가 다른 시민을 암살한다. 4일차 남은 시민이 처형되어 마피아 1 대 1 → 처형 직후 ended(mafiaWin), 요약 4줄.
//
// 사용법: node scripts/uat-vote.mjs [--prod | <기준 주소>]
// 화면 모양·애니메이션·실제 폰 시계 차이는 봇으로 볼 수 없다. 토큰은 어떤 출력에도 찍지 않는다.
// 이 스크립트는 로컬 서버에서 돌린다. 배포본(--prod) 실행은 화면 계획 뒤 배포 때 한다(결정 0036-15, D-26).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { exitIfV1 } from "./deploy-target.mjs";

const args = { base: null, prod: false };
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === "--prod") args.prod = true;
  else if (!a.startsWith("--")) args.base = a;
  else throw new Error(`알 수 없는 인자: ${a}`);
}
let base = args.base;
if (args.prod) base = readFileSync(fileURLToPath(new URL("./prod-url.txt", import.meta.url)), "utf8").trim();
const url = new URL((base ?? "http://localhost:5173").replace(/\/+$/, ""));
exitIfV1(url.origin); // v1.0 주소는 요청 전에 거부(DEPLOY-02)
const wsBase = `${url.protocol === "https:" ? "wss:" : "ws:"}//${url.host}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (test, label, ok, detail = "") => results.push({ test, label, ok, detail });

// 단계 시간(shared/game/phases.ts 와 같은 값. 스크립트는 TS 를 import 하지 않는다)
const DISCUSSION_MS = 90_000;
const NOMINATION_MS = 15_000;
const DEFENSE_MS = 20_000;
const VERDICT_MS = 10_000;
const EXECUTION_MS = 5_000;
const NIGHT_MS = 30_000;
const MORNING_MS = 5_000;
// shared/protocol.ts 의 EXECUTION_PHRASE_COUNT 와 같은 값. 처형 문구 번호는 1..4.
const EXECUTION_PHRASE_COUNT = 4;
const GAME_A_LIMIT_MS = 200_000; // 5명 판: 시작 20초 + 낮 한 바퀴(과반 토론 끝내기 → 처형) 약 50초 + 여유
const GAME_B_LIMIT_MS = 480_000; // 4명 판: 시작 20초 + 4일(밤 세 번 포함) 약 250초 + 여유
const OVERALL_LIMIT_MS = GAME_A_LIMIT_MS + GAME_B_LIMIT_MS + 60_000;
const ROLE_IDS = ["mafia", "police", "doctor", "citizen"];
const ROLE_STRINGS = new Set(ROLE_IDS);
// 역할 문자열이 나와도 되는 경로(배열 칸은 [] 로 줄여 비교한다). 처형자 직업은 ended 의 result.seats[].job 에서만 처음 나온다.
// view.me.chat 은 서버가 정한 내 채널 이름(all·mafia·ghost)이다 — "mafia" 가 역할 문자열과 같은 글자일 뿐이라 허용하되,
// 마피아가 아닌 사람의 프레임에 me.chat "mafia" 가 없는지는 mafiaChannelLeaks 가 따로 본다.
const ALLOWED_ROLE_PATHS = new Set(["view.me.role", "view.day.roles[]", "view.me.chat"]);

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
const stateOf = (c, phase) => states(c).find((f) => f.msg.view.phase === phase);
const send = (c, m) => c.ws.send(JSON.stringify(m));
// 키 순서와 무관한 깊은 비교(서버 객체의 키 순서에 기대지 않는다)
const canon = (v) => (Array.isArray(v) ? v.map(canon) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
const allSame = (xs) => xs.every((x) => same(x, xs[0]));

// 단계 키 '일차:단계' — 받은 마지막 state 로 만든다(test/worker/helpers.ts 의 chatSend 와 같은 규칙).
const pkOf = (c) => `${lastView(c)?.day?.n ?? 0}:${lastView(c)?.phase}`;
const sendChat = (c, text) => send(c, { t: "chat", text, pk: pkOf(c) });
const chatFrom = (c, seat, text, since) => c.frames.some((f) => f.at >= since && f.msg.t === "chat" && f.msg.seat === seat && f.msg.text === text);
// chat 을 보내 chatReject 프레임의 이유를 돌려준다(응답이 없으면 "(응답 없음)").
async function requestChatReject(c, text) {
  const before = c.frames.length;
  sendChat(c, text);
  try {
    await waitUntil(() => c.frames.slice(before).some((f) => f.msg.t === "chatReject"), 5000, "chatReject 프레임");
  } catch {
    return "(응답 없음)";
  }
  return c.frames.slice(before).find((f) => f.msg.t === "chatReject").msg.why;
}

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

// 값이 역할 문자열인 잎을 경로와 함께 모은다. 배열 인덱스는 [] 로 줄인다.
function collectRoleStringPaths(value, path, out) {
  if (typeof value === "string") {
    if (ROLE_STRINGS.has(value)) out.push({ path, value });
  } else if (Array.isArray(value)) value.forEach((v) => collectRoleStringPaths(v, `${path}[]`, out));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) collectRoleStringPaths(v, path ? `${path}.${k}` : k, out);
  }
}

// 객체를 깊이 훑어 키가 key 인 경로를 모은다.
function collectKeyPaths(value, key, path, out) {
  if (Array.isArray(value)) value.forEach((v, i) => collectKeyPaths(v, key, `${path}[${i}]`, out));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      const p = path ? `${path}.${k}` : k;
      if (k === key) out.push(p);
      collectKeyPaths(v, key, p, out);
    }
  }
}

// 방을 만들고 채워 모두 연결한다.
async function setupRoom(prefix, N) {
  const clients = Array.from({ length: N }, (_, i) => ({ nickname: `${prefix}${i + 1}`, token: "", seat: -1, frames: [], ws: null, role: null, leaving: false, closedCode: null }));
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
  return { clients, host, code };
}

function teardown(room) {
  for (const c of room.clients) { c.leaving = true; try { send(c, { t: "leave" }); c.ws.close(); } catch { /* 닫힘 */ } }
}

// 단계 도착 확인: 그 일차의 그 단계 state 를 받았는가(탈락한 클라이언트도 모든 단계 state 를 받는다)
const stateAt = (c, phase, n) => states(c).find((f) => f.msg.view.phase === phase && f.msg.view.day?.n === n);
const has = (clients, phase, n) => clients.every((c) => stateAt(c, phase, n));
const seqOf = (c) => { const seq = []; for (const f of states(c)) if (seq.at(-1) !== f.msg.view.phase) seq.push(f.msg.view.phase); return seq; };

// 토론 끝내기(DAY-03): 산 사람 과반(절반 + 1)이 누르면 토론 마감을 기다리지 않고 nomination 으로 넘어간다.
async function pressEnd(clients, alive, n) {
  const need = Math.floor(alive.length / 2) + 1;
  for (let k = 0; k < need; k++) {
    send(alive[k], { t: "endDiscussion", on: true });
    if (k === need - 1) break;
    await waitUntil(() => alive.every((c) => lastView(c)?.phase === "discussion" && lastView(c).day?.n === n && lastView(c).day.endCount === k + 1), 5000, `${n}일차 ${k + 1}번째 토론 끝내기 뒤 day.endCount`);
  }
  await waitUntil(() => has(clients, "nomination", n), 8000, `${n}일차 과반 토론 끝내기 뒤 nomination`);
}

// 지목을 plan([클라이언트, 대상 seat] 순서)대로 보내며 매 지목 뒤 모든 클라이언트의 day.points 가 같은 공개 목록(좌석 오름차순)인지 본다.
// cur 는 지금까지의 지목(seat → target)이며 여러 번 이어 부를 때 같은 Map 을 넘긴다. 같은 사람이 다시 지목하려면 부르는 쪽이 250ms 이상 띄운다.
async function pointPlan(clients, cur, plan) {
  let ok = true;
  let detail = "";
  for (const [c, target] of plan) {
    send(c, { t: "point", target });
    cur.set(c.seat, target);
    const want = [...cur.entries()].sort((a, b) => a[0] - b[0]).map(([seat, t]) => ({ seat, target: t }));
    try {
      await waitUntil(() => clients.every((x) => lastView(x)?.phase === "nomination" && same(lastView(x).day.points, want)), 5000, `${c.nickname} 의 지목 뒤 모든 클라이언트의 day.points ${JSON.stringify(want)}`);
    } catch (e) {
      ok = false;
      detail = e.message;
      break;
    }
  }
  return { ok, detail, lines: [...cur.entries()].sort((a, b) => a[0] - b[0]).map(([seat, t]) => ({ seat, target: t })) };
}

// 찬반을 plan([클라이언트, 찬성 여부] 순서)대로 던지며 매 첫 표 뒤 모든 클라이언트의 day.voted 가 같은 좌석 목록이고 me.verdictVote 가 보낸 사람 view 에만 있는지 본다.
// change 가 있으면 마지막에 [클라이언트, 새 값]으로 값을 바꾸고, 그 사이 다른 클라이언트가 state 를 받지 않았는지 본다(결정 0053·0060-4). 마지막 집계를 돌려준다.
async function castVerdicts(label, clients, plan, change = null) {
  const current = new Map(); // 클라이언트 → 마지막 값
  const sentBy = new Map(); // 클라이언트 → 보낸 값 집합
  let votedOk = true;
  let privacyOk = true;
  let detail = "";
  const record = (c, agree) => { current.set(c, agree); (sentBy.get(c) ?? sentBy.set(c, new Set()).get(c)).add(agree); };
  for (const [c, agree] of plan) {
    send(c, { t: "verdict", agree });
    record(c, agree);
    const wantVoted = [...current.keys()].map((x) => x.seat).sort((a, b) => a - b);
    try {
      await waitUntil(() => clients.every((x) => lastView(x)?.phase === "verdict" && same(lastView(x).day.voted, wantVoted)), 5000, `표 뒤 day.voted ${JSON.stringify(wantVoted)}`);
    } catch (e) {
      votedOk = false;
      detail = e.message;
      break;
    }
    for (const x of clients) {
      if (lastView(x).me.verdictVote !== current.get(x)) { privacyOk = false; detail = `${x.nickname} 의 me.verdictVote 가 ${current.get(x)} 가 아님: ${lastView(x).me.verdictVote}`; }
    }
  }
  let changeOk = true;
  if (change !== null) {
    const [c, agree] = change;
    const counts = clients.map((x) => states(x).length);
    send(c, { t: "verdict", agree });
    record(c, agree);
    try {
      await waitUntil(() => lastView(c)?.me.verdictVote === agree, 5000, `${c.nickname} 의 값 변경 반영`);
      await sleep(300); // 새는 프레임이 있다면 도착할 시간
      const leaked = clients.filter((x, k) => x !== c && states(x).length !== counts[k]).map((x) => x.nickname);
      if (leaked.length > 0) { changeOk = false; detail = `값 변경이 방송됨: ${leaked.join(",")}`; }
    } catch (e) {
      changeOk = false;
      detail = e.message;
    }
  }
  // 어떤 프레임에서도 verdictVote 는 view.me.verdictVote 경로뿐이고 본인이 던진 값뿐이며, agree 키·값 달린 목록은 없다. day.voted 는 좌석 번호 목록이다.
  for (const x of clients) {
    const own = sentBy.get(x) ?? new Set();
    for (const f of states(x)) {
      const vp = [];
      collectKeyPaths(f.msg, "verdictVote", "", vp);
      if (vp.some((p) => p !== "view.me.verdictVote")) { privacyOk = false; detail = `${x.nickname} 프레임에 view.me.verdictVote 밖의 verdictVote: ${vp.join(",")}`; }
      const ap = [];
      collectKeyPaths(f.msg, "agree", "", ap);
      if (ap.length > 0) { privacyOk = false; detail = `${x.nickname} 프레임에 agree 키: ${ap.join(",")}`; }
      const v = f.msg.view.me.verdictVote;
      if (v !== undefined && !own.has(v)) { privacyOk = false; detail = `${x.nickname} 가 자기가 던지지 않은 값의 verdictVote 를 받음`; }
      const voted = f.msg.view.day?.voted;
      if (voted !== undefined && !voted.every((seat) => Number.isInteger(seat))) { privacyOk = false; detail = "day.voted 가 좌석 번호 목록이 아님"; }
    }
  }
  const yes = [...current.values()].filter((v) => v).length;
  const no = current.size - yes;
  check(label, `매 첫 표 뒤 모든 클라이언트의 day.voted 가 같은 좌석 목록 (최종 찬성 ${yes} 반대 ${no})`, votedOk, detail);
  check(label, "me.verdictVote 는 보낸 사람 view 에만 있고 남의 값은 어느 프레임에도 없음", privacyOk, detail);
  if (change !== null) check(label, "값 변경은 본인에게만: 변경한 사람 외 클라이언트는 그 사이 state 를 받지 않음", changeOk, detail);
  return { yes, no };
}

// 처형자(또는 탈락자)가 아닌 클라이언트의 ended 이전 state 프레임에서 역할 문자열이 허용 경로 밖에 있는 경로를 모은다.
function roleStringLeaks(clients, exceptSeats) {
  const out = new Set();
  for (const c of clients) {
    if (exceptSeats.includes(c.seat)) continue;
    for (const f of states(c)) {
      if (f.msg.view.phase === "ended") break;
      const leaves = [];
      collectRoleStringPaths(f.msg, "", leaves);
      for (const l of leaves) if (!ALLOWED_ROLE_PATHS.has(l.path)) out.add(`${c.nickname}:${l.path}`);
    }
  }
  return [...out];
}

// me.chat "mafia"(밤 마피아 채널)는 마피아 본인의 프레임에만 있어야 한다. 새는 클라이언트 이름을 모은다.
function mafiaChannelLeaks(clients) {
  return clients.filter((c) => c.role !== "mafia" && states(c).some((f) => f.msg.view.me.chat === "mafia")).map((c) => c.nickname);
}

function endedChecks(label, clients, winner, expectSummary) {
  const results_ = clients.map((c) => stateOf(c, "ended").msg.view.result);
  check(label, "ended: 모든 클라이언트가 같은 result", results_.every(Boolean) && allSame(results_), JSON.stringify(results_[0]).slice(0, 160));
  const r = results_[0];
  check(label, `result.winner = ${winner}`, r?.winner === winner, String(r?.winner));
  check(label, `result.seats 가 ${clients.length}자리이고 job 이 실제 직업과 같음`, Array.isArray(r?.seats) && r.seats.length === clients.length && r.seats.every((s) => clients.find((c) => c.seat === s.seat)?.role === s.job), JSON.stringify(r?.seats));
  check(label, "result.summary 가 날마다 한 줄이고 기대 내용과 같음", Array.isArray(r?.summary) && expectSummary(r.summary), JSON.stringify(r?.summary));
  // ended 프레임의 역할 문자열은 허용 경로 + result.seats[].job 뿐(처형자·전원 직업의 첫 공개, D-17)
  const endedBad = new Set();
  for (const c of clients) {
    const f = stateOf(c, "ended");
    const leaves = [];
    collectRoleStringPaths(f.msg, "", leaves);
    for (const l of leaves) if (!ALLOWED_ROLE_PATHS.has(l.path) && l.path !== "view.result.seats[].job" && !(l.path === "view.spectate.seats[].job")) endedBad.add(`${c.nickname}:${l.path}`);
  }
  check(label, "ended 프레임의 직업 문자열은 허용 경로와 result.seats[].job 뿐", endedBad.size === 0, [...endedBad].slice(0, 5).join(" "));
  const earlyResult = clients.some((c) => states(c).some((f) => f.msg.view.phase !== "ended" && f.msg.view.result !== undefined));
  check(label, "result 는 ended 단계 프레임에만 있음", !earlyResult, "");
  const chLeaks = mafiaChannelLeaks(clients);
  check(label, "me.chat \"mafia\"(밤 마피아 채널)는 마피아 본인의 프레임에만 있음", chLeaks.length === 0, chLeaks.join(","));
}

// ---------------------------------------------------------------------------------------------
// (a) 5명 — 토론 끝내기 과반 → 지목 → 변론 → 찬반 → 처형(마피아) → 시민 승
async function gameA() {
  const T = "처형";
  console.log("(a) 5명 — 처형으로 끝나는 판");
  const room = await setupRoom("처형봇", 5);
  const { clients, host, code } = room;
  console.log(`  방 ${code} — 시작`);
  send(host, { t: "start" });

  // ---- 토론 끝내기(DAY-03, 결정 0060-2) ----
  await waitUntil(() => has(clients, "discussion", 1), 60_000, "1일차 discussion");
  for (const c of clients) c.role = stateAt(c, "discussion", 1).msg.view.me.role;
  const mafias = clients.filter((c) => c.role === "mafia");
  const mafia = mafias[0];
  const citizens = clients.filter((c) => c.role !== "mafia");
  check(T, "역할 구성: 마피아 1명", mafias.length === 1 && citizens.length === 4, `마피아 ${mafias.length}`);
  const discViews = clients.map((c) => stateAt(c, "discussion", 1).msg.view);
  check(T, `discussion 길이 ${DISCUSSION_MS / 1000}초, 첫 day.endCount 0, 개인 me.endDiscussion 없음`, discViews.every((v) => v.phaseDurationMs === DISCUSSION_MS && v.day.endCount === 0 && v.me.endDiscussion === undefined), "");
  const discEndsAt = discViews[0].phaseEndsAt;
  const pressers = clients.slice(0, 3);
  let countOk = true;
  let countDetail = "";
  for (let k = 0; k < 2; k++) {
    send(pressers[k], { t: "endDiscussion", on: true });
    try {
      await waitUntil(() => clients.every((c) => lastView(c)?.phase === "discussion" && lastView(c).day.endCount === k + 1), 5000, `토론 끝내기 ${k + 1}명 뒤 day.endCount`);
    } catch (e) { countOk = false; countDetail = e.message; break; }
  }
  const ownOnly = clients.every((c) => lastView(c).me.endDiscussion === (pressers.slice(0, 2).includes(c) ? true : undefined));
  check(T, "토론 끝내기 2명: 모든 클라이언트의 day.endCount 가 2, me.endDiscussion 은 누른 두 사람의 view 에만", countOk && ownOnly, countDetail);
  send(pressers[1], { t: "endDiscussion", on: false });
  await waitUntil(() => clients.every((c) => lastView(c).day.endCount === 1), 5000, "토론 끝내기 취소 뒤 day.endCount 1").catch((e) => { countOk = false; countDetail = e.message; });
  send(pressers[1], { t: "endDiscussion", on: true });
  await waitUntil(() => clients.every((c) => lastView(c).day.endCount === 2), 5000, "토론 끝내기 다시 누른 뒤 day.endCount 2").catch((e) => { countOk = false; countDetail = e.message; });
  check(T, "토론 끝내기는 취소하고 다시 누를 수 있고 개수가 따라감 (2 → 1 → 2)", countOk && lastView(pressers[1]).me.endDiscussion === true, countDetail);
  send(pressers[2], { t: "endDiscussion", on: true });
  await waitUntil(() => has(clients, "nomination", 1), 8000, "과반 토론 끝내기 뒤 nomination");

  // ---- 지목(DAY-04, 결정 0060-3) ----
  const nomViews = clients.map((c) => stateAt(c, "nomination", 1).msg.view);
  check(T, "과반(3/5)이 누르면 토론 마감을 기다리지 않고 지목으로 넘어감", nomViews.every((v) => v.serverNow < discEndsAt - 10_000), `토론 마감 ${discEndsAt}, 지목 진입 ${nomViews[0].serverNow}`);
  check(T, `nomination 길이 ${NOMINATION_MS / 1000}초, 마감이 모든 클라이언트에서 같고 첫 day.points 가 비어 있음`,
    nomViews.every((v) => v.phaseDurationMs === NOMINATION_MS && same(v.day.points, [])) && new Set(nomViews.map((v) => v.phaseEndsAt)).size === 1, `${nomViews.map((v) => v.phaseDurationMs).join("/")}`);
  const nomAt = Math.min(...clients.map((c) => stateAt(c, "nomination", 1).at));
  const selfErr = await requestError(mafia, { t: "point", target: mafia.seat });
  check(T, "자기 자신 지목 → BAD_MESSAGE", selfErr === "BAD_MESSAGE", selfErr);
  const nullErr = await requestError(mafia, { t: "point", target: null });
  check(T, "지목 취소(target null)는 없다 → BAD_MESSAGE (결정 0060-3)", nullErr === "BAD_MESSAGE", nullErr);
  const pts = new Map();
  const first = await pointPlan(clients, pts, [
    [citizens[0], citizens[1].seat], // 먼저 다른 시민을 가리켰다가
    [mafia, citizens[0].seat],
    [citizens[1], mafia.seat],
    [citizens[2], mafia.seat],
    [citizens[3], mafia.seat],
  ]);
  await sleep(300); // 같은 사람의 지목 간격(250ms)을 넘긴 뒤 바꾼다
  const changed = await pointPlan(clients, pts, [[citizens[0], mafia.seat]]);
  check(T, "지목: 매 지목 뒤 모든 클라이언트의 day.points 가 같은 공개 목록이고 지목을 바꿀 수 있음", first.ok && changed.ok, first.detail || changed.detail);
  check(T, "지목 줄은 5줄이고 키는 seat·target 뿐, 마피아에게 4표", changed.lines.length === 5 && changed.lines.filter((l) => l.target === mafia.seat).length === 4
    && clients.every((c) => lastView(c).day.points.every((l) => Object.keys(l).sort().join(",") === "seat,target")), JSON.stringify(changed.lines));

  // ---- 변론(DAY-05) ----
  await waitUntil(() => has(clients, "defense", 1), NOMINATION_MS + 10_000, "defense");
  const def = clients.map((c) => stateAt(c, "defense", 1).msg.view);
  check(T, `후보 = 마피아(최다 득표 4표), defense 길이 ${DEFENSE_MS / 1000}초, 마감이 모든 클라이언트에서 같음`,
    def.every((v) => v.day.candidate === mafia.seat && v.phaseDurationMs === DEFENSE_MS) && new Set(def.map((v) => v.phaseEndsAt)).size === 1, `후보 ${def[0].day.candidate}, 마피아 ${mafia.seat}`);
  const defenseAt = Math.min(...clients.map((c) => stateAt(c, "defense", 1).at));
  const nomGap = Math.round(defenseAt - nomAt);
  check(T, `지목 약 ${NOMINATION_MS / 1000}초 뒤 변론 (과반이어도 마감까지 채움)`, nomGap >= NOMINATION_MS - 1500 && nomGap <= NOMINATION_MS + 4000, `${nomGap}ms`);
  const nonCand = clients.filter((c) => c !== mafia);
  // 변론은 후보만의 말이 아니다(결정 0053): 후보와 비후보의 chat 이 모두 ch all 로 모든 폰(보낸 폰 포함)에 간다.
  sendChat(mafia, "저 아니에요");
  sendChat(nonCand[0], "한 번 들어 봐요");
  await waitUntil(() => clients.every((c) => chatFrom(c, mafia.seat, "저 아니에요", defenseAt) && chatFrom(c, nonCand[0].seat, "한 번 들어 봐요", defenseAt)), 5000, "변론 chat 도착").catch(() => {});
  check(T, "변론: 후보의 chat 이 모든 클라이언트(보낸 폰 포함)에 ch all 로 감", clients.every((c) => chatFrom(c, mafia.seat, "저 아니에요", defenseAt)
    && c.frames.some((f) => f.at >= defenseAt && f.msg.t === "chat" && f.msg.seat === mafia.seat && f.msg.ch === "all")), "");
  check(T, "변론: 비후보도 chat 이 전달됨 (모든 클라이언트에 ch all)", clients.every((c) => chatFrom(c, nonCand[0].seat, "한 번 들어 봐요", defenseAt)
    && c.frames.some((f) => f.at >= defenseAt && f.msg.t === "chat" && f.msg.seat === nonCand[0].seat && f.msg.ch === "all")), "");
  const defRejects = clients.filter((c) => c.frames.some((f) => f.at >= defenseAt && f.msg.t === "chatReject")).map((c) => c.nickname);
  check(T, "변론: 정상 chat 에 chatReject 가 없음", defRejects.length === 0, defRejects.join(","));

  // ---- 찬반(DAY-06, 결정 0053) ----
  await waitUntil(() => has(clients, "verdict", 1), DEFENSE_MS + 10_000, "verdict");
  const vv = clients.map((c) => stateAt(c, "verdict", 1).msg.view);
  check(T, `verdict 길이 ${VERDICT_MS / 1000}초, 첫 day.voted 가 비어 있고 개인 값(me.verdictVote)은 없음`, vv.every((v) => v.phaseDurationMs === VERDICT_MS && same(v.day.voted, []) && v.me.verdictVote === undefined), "");
  const defenderErr = await requestError(mafia, { t: "verdict", agree: true });
  check(T, "변론자(후보)의 찬반 → BAD_MESSAGE (자기 처형 찬반에 투표하지 않음)", defenderErr === "BAD_MESSAGE", defenderErr);
  // 분모는 변론자를 뺀 산 사람 4명: 찬성 3 반대 1 → 6 > 4 통과. 첫 사람은 반대를 던졌다가 찬성으로 바꾼다.
  const tally = await castVerdicts(T, clients, [[citizens[0], false], [citizens[1], true], [citizens[2], true], [citizens[3], false]], [citizens[0], true]);

  // ---- 처형(DAY-07) ----
  await waitUntil(() => has(clients, "execution", 1), VERDICT_MS + 10_000, "execution");
  const ex = clients.map((c) => stateAt(c, "execution", 1).msg.view);
  check(T, `처형: 모든 클라이언트 day.execution {seat=마피아, phrase 1..${EXECUTION_PHRASE_COUNT}}`, allSame(ex.map((v) => v.day.execution)) && ex[0].day.execution.seat === mafia.seat && Number.isInteger(ex[0].day.execution.phrase) && ex[0].day.execution.phrase >= 1 && ex[0].day.execution.phrase <= EXECUTION_PHRASE_COUNT && Object.keys(ex[0].day.execution).sort().join(",") === "phrase,seat", JSON.stringify(ex[0].day.execution));
  check(T, `처형: day.verdict {yes:${tally.yes}, no:${tally.no}, passed:true} 가 모든 클라이언트에서 같고 키는 yes·no·passed 뿐`, ex.every((v) => same(v.day.verdict, { yes: tally.yes, no: tally.no, passed: true })) && tally.yes === 3 && tally.no === 1, JSON.stringify(ex[0].day.verdict));
  check(T, "처형: 처형자만 탈락(players[].alive)이 모든 클라이언트에서 같음", ex.every((v) => v.players.every((p) => p.alive === (p.seat !== mafia.seat))), "");
  check(T, "처형 단계 프레임에는 개인 값(me.verdictVote·me.endDiscussion)이 없음", ex.every((v) => v.me.verdictVote === undefined && v.me.endDiscussion === undefined), "");
  const leaks = roleStringLeaks(clients, [mafia.seat]);
  check(T, "처형까지 살아 있는 클라이언트 프레임에 허용 경로 밖 직업 문자열 없음(처형자 직업 비공개)", leaks.length === 0, leaks.slice(0, 5).join(" "));

  // ---- 종료 ----
  await waitUntil(() => has(clients, "ended", 1), EXECUTION_MS + 10_000, "ended");
  const gap = Math.round(Math.min(...clients.map((c) => stateAt(c, "ended", 1).at)) - Math.min(...clients.map((c) => stateAt(c, "execution", 1).at)));
  check(T, `처형 약 ${EXECUTION_MS / 1000}초 뒤 ended`, gap >= EXECUTION_MS - 1000 && gap <= EXECUTION_MS + 4000, `${gap}ms`);
  endedChecks(T, clients, "citizenWin", (rows) => rows.length === 1 && rows[0].n === 1 && same(rows[0].exec, { yes: 3, no: 1, passed: true, candidate: mafia.seat }) && rows[0].night === undefined);
  const endedChat = await requestChatReject(nonCand[0], "끝났나요");
  check(T, "종료 중 chat → chatReject{phase}", endedChat === "phase", endedChat);
  await sleep(500);
  check(T, "종료 중 거절된 chat 이 다른 클라이언트에 가지 않음", clients.filter((c) => c !== nonCand[0]).every((c) => !c.frames.some((f) => f.msg.t === "chat" && f.msg.text === "끝났나요")), "");
  const endedViews = clients.map((c) => lastView(c));
  check(T, "종료 뒤에도 소켓이 열려 있고 마지막 단계가 ended", clients.every((c) => c.closedCode === null) && endedViews.every((v) => v.phase === "ended"), clients.filter((c) => c.closedCode !== null).map((c) => c.nickname).join(","));
  const tokenLeak = clients.some((c) => clients.some((o) => o !== c && c.frames.some((f) => f.raw.includes(o.token))));
  check(T, "다른 사람의 토큰이 프레임에 없음", !tokenLeak, "");
  teardown(room);
}

// ---------------------------------------------------------------------------------------------
// (b) 4명 — 0표 · 동률 · 부결의 밤, 4일차 처형으로 마피아 승
async function gameB() {
  const T = "경계";
  console.log("(b) 4명 — 0표·동률·부결을 지나 처형으로 끝나는 판");
  const room = await setupRoom("경계봇", 4);
  const { clients, host, code } = room;
  console.log(`  방 ${code} — 시작`);
  send(host, { t: "start" });

  await waitUntil(() => has(clients, "discussion", 1), 60_000, "1일차 discussion");
  for (const c of clients) c.role = stateAt(c, "discussion", 1).msg.view.me.role;
  const mafia = clients.find((c) => c.role === "mafia");
  const police = clients.find((c) => c.role === "police");
  const citizens = clients.filter((c) => c.role === "citizen").sort((a, b) => a.seat - b.seat);
  check(T, "역할 구성: 마피아 1·경찰 1·시민 2", !!mafia && !!police && citizens.length === 2, `시민 ${citizens.length}`);
  const C = citizens[0]; // 3일차에 최다 득표로 변론에 서고 부결로 살아남았다가 4일차에 처형될 시민
  const C2 = citizens[1]; // 3일차 밤에 암살당할 시민

  // ---- 1일차: 지목 0표 → 변론 없이 곧장 밤 ----
  await pressEnd(clients, clients, 1);
  await waitUntil(() => has(clients, "night", 1), NOMINATION_MS + 10_000, "1일차 night");
  const n1 = clients.map((c) => stateAt(c, "night", 1).msg.view);
  check(T, "1일차 지목 0표 → 변론·찬반·처형 없이 night, 모든 클라이언트 day.noExecution {reason:noVotes}", n1.every((v) => same(v.day.noExecution, { reason: "noVotes" })), JSON.stringify(n1[0].day.noExecution));
  check(T, "0표 날 voteLog 마지막 줄: exec {0,0,false}, cand.votes 비어 있고 candidate 없음", n1.every((v) => { const l = v.day.voteLog.at(-1); return l?.n === 1 && same(l.exec, { yes: 0, no: 0, passed: false }) && same(l.cand, { votes: [] }); }), JSON.stringify(n1[0].day.voteLog.at(-1)));
  await waitUntil(() => has(clients, "morning", 1), NIGHT_MS + 10_000, "1일차 morning");
  check(T, "아무도 행동하지 않은 밤: 아침에 탈락자 없음(day.morning 에 eliminated 없음)", clients.every((c) => stateAt(c, "morning", 1).msg.view.day.morning?.eliminated === undefined), "");

  // ---- 2일차: 지목 동률 → 밤 ----
  await waitUntil(() => has(clients, "discussion", 2), MORNING_MS + 10_000, "2일차 discussion");
  await pressEnd(clients, clients, 2);
  const tieRes = await pointPlan(clients, new Map(), [[clients[0], clients[1].seat], [clients[1], clients[0].seat]]); // 둘이 서로 가리킴: 1표씩 동률
  check(T, "2일차 지목: 서로 가리킨 두 줄이 모든 클라이언트에 같은 공개 목록", tieRes.ok, tieRes.detail);
  await waitUntil(() => has(clients, "night", 2), NOMINATION_MS + 10_000, "2일차 night");
  const n2 = clients.map((c) => stateAt(c, "night", 2).msg.view);
  check(T, "2일차 지목 동률 → 변론 없이 night, 모든 클라이언트 day.noExecution {reason:tie}, 난수로 고르지 않음", n2.every((v) => same(v.day.noExecution, { reason: "tie" })), JSON.stringify(n2[0].day.noExecution));
  check(T, "동률 날 voteLog 마지막 줄: cand.votes 두 줄이고 candidate 없음", n2.every((v) => { const l = v.day.voteLog.at(-1); return l?.n === 2 && l.cand?.candidate === undefined && l.cand?.votes.length === 2; }), JSON.stringify(n2[0].day.voteLog.at(-1)));
  await waitUntil(() => has(clients, "morning", 2), NIGHT_MS + 10_000, "2일차 morning");

  // ---- 3일차: 부결(분모는 변론자를 뺀 산 사람 전원, 기권 포함) ----
  await waitUntil(() => has(clients, "discussion", 3), MORNING_MS + 10_000, "3일차 discussion");
  await pressEnd(clients, clients, 3);
  const pts3 = await pointPlan(clients, new Map(), [[C, mafia.seat], [mafia, C.seat], [police, C.seat], [C2, C.seat]]);
  check(T, "3일차 지목: 시민 C 에게 3표 몰아 줌, 모든 클라이언트 같은 공개 목록", pts3.ok && pts3.lines.filter((l) => l.target === C.seat).length === 3, pts3.detail);
  await waitUntil(() => has(clients, "verdict", 3), NOMINATION_MS + DEFENSE_MS + 10_000, "3일차 verdict");
  check(T, "3일차 변론자 = C", clients.every((c) => stateAt(c, "defense", 3)?.msg.view.day.candidate === C.seat), "");
  // 유권자는 변론자를 뺀 셋(마피아·경찰·시민2). 한 명만 찬성하고 둘은 기권 → 1×2 > 3 아님 → 부결. 반대표는 하나도 없다.
  const tally3 = await castVerdicts(T, clients, [[mafia, true]]);
  await waitUntil(() => has(clients, "execution", 3), VERDICT_MS + 10_000, "3일차 execution");
  const ex3 = clients.map((c) => stateAt(c, "execution", 3).msg.view);
  check(T, "3일차 찬성 1·반대 0·기권 2 → 부결: day.verdict {yes:1, no:0, passed:false} 가 모두에게 같음 (기권도 분모)", tally3.yes === 1 && tally3.no === 0 && ex3.every((v) => same(v.day.verdict, { yes: 1, no: 0, passed: false })), JSON.stringify(ex3[0].day.verdict));
  check(T, "부결: 처형 단계에 day.execution 이 없고 아무도 탈락하지 않음", ex3.every((v) => v.day.execution === undefined && v.players.every((p) => p.alive === true)), "");
  await waitUntil(() => has(clients, "night", 3), EXECUTION_MS + 10_000, "3일차 night");
  const n3 = clients.map((c) => stateAt(c, "night", 3).msg.view);
  check(T, "부결 날의 밤에는 day.noExecution 이 없음(부결은 처형 단계가 알렸다)", n3.every((v) => v.day.noExecution === undefined), JSON.stringify(n3[0].day.noExecution));
  send(mafia, { t: "pick", target: C2.seat });
  send(police, { t: "pick", target: mafia.seat });
  await waitUntil(() => lastView(mafia)?.phase === "night" && lastView(mafia).me.pick === C2.seat, 5000, "마피아 지목 반영");
  await waitUntil(() => has(clients, "morning", 3), NIGHT_MS + 10_000, "3일차 morning");
  const m3 = clients.map((c) => stateAt(c, "morning", 3).msg.view.day.morning);
  check(T, "3일차 아침: 모든 클라이언트 같은 day.morning, 탈락 = 마피아가 지목한 시민 C2", allSame(m3) && m3[0].eliminated === C2.seat, JSON.stringify(m3[0]));

  // ---- 4일차: 남은 셋(마피아·경찰·C) 중 C 처형 → 마피아 1 대 1 → ended ----
  await waitUntil(() => has(clients, "discussion", 4), MORNING_MS + 10_000, "4일차 discussion");
  const alive4 = [mafia, police, C];
  await pressEnd(clients, alive4, 4);
  const pts4 = await pointPlan(clients, new Map(), [[mafia, C.seat], [police, C.seat], [C, mafia.seat]]);
  check(T, "4일차 지목: 산 사람 셋의 줄만 공개 목록에 있음(탈락자 C2 는 줄이 없음)", pts4.ok && pts4.lines.length === 3 && !pts4.lines.some((l) => l.seat === C2.seat), pts4.detail);
  await waitUntil(() => has(clients, "verdict", 4), NOMINATION_MS + DEFENSE_MS + 10_000, "4일차 verdict");
  const ghostErr = await requestError(C2, { t: "verdict", agree: true });
  check(T, "탈락한 사람의 찬반 → BAD_MESSAGE", ghostErr === "BAD_MESSAGE", ghostErr);
  const ghostPointErr = await requestError(C2, { t: "point", target: C.seat });
  check(T, "탈락한 사람의 지목 → WRONG_PHASE (지목 단계가 지났음)", ghostPointErr === "WRONG_PHASE", ghostPointErr);
  // 유권자는 변론자 C 를 뺀 산 사람 둘(마피아·경찰): 둘 다 찬성 → 2×2 > 2 통과
  const tally4 = await castVerdicts(T, clients, [[mafia, true], [police, true]]);
  await waitUntil(() => has(clients, "execution", 4), VERDICT_MS + 10_000, "4일차 execution");
  const ex4 = clients.map((c) => stateAt(c, "execution", 4).msg.view);
  check(T, "4일차 찬성 2 → 통과: day.execution.seat = C, day.verdict {yes:2, no:0, passed:true}", tally4.yes === 2 && ex4.every((v) => v.day.execution?.seat === C.seat && same(v.day.verdict, { yes: 2, no: 0, passed: true })), JSON.stringify(ex4[0].day.verdict));
  await waitUntil(() => has(clients, "ended", 4), EXECUTION_MS + 10_000, "ended");
  const seqs = clients.map((c) => { const seq = seqOf(c); return seq.slice(seq.indexOf("discussion")).join(">"); });
  const wantSeq = [
    "discussion>nomination>night>morning>dayAnnounce", // 1일차 0표
    "discussion>nomination>night>morning>dayAnnounce", // 2일차 동률
    "discussion>nomination>defense>verdict>execution>night>morning>dayAnnounce", // 3일차 부결
    "discussion>nomination>defense>verdict>execution>ended", // 4일차 처형으로 끝
  ].join(">");
  check(T, "단계 순서가 모든 클라이언트에서 같고 0표·동률은 변론을 건너뛰며 마지막은 execution → ended", allSame(seqs) && seqs[0] === wantSeq, seqs[0]);
  endedChecks(T, clients, "mafiaWin", (rows) => rows.length === 4
    && same(rows[0].exec, { yes: 0, no: 0, passed: false }) && same(rows[1].exec, { yes: 0, no: 0, passed: false })
    && same(rows[2].exec, { yes: 1, no: 0, passed: false, candidate: C.seat }) && rows[2].night?.target === C2.seat && rows[2].night?.died === true
    && same(rows[3].exec, { yes: 2, no: 0, passed: true, candidate: C.seat }) && rows[3].night === undefined);
  const leaks = roleStringLeaks(clients, [C.seat, C2.seat]);
  check(T, "ended 이전 살아 있는 클라이언트 프레임에 허용 경로 밖 직업 문자열 없음", leaks.length === 0, leaks.slice(0, 5).join(" "));
  const closed = clients.filter((c) => c.closedCode !== null).map((c) => c.nickname);
  check(T, "소켓이 예상 밖으로 닫히지 않음", closed.length === 0, closed.join(","));
  const tokenLeak = clients.some((c) => clients.some((o) => o !== c && c.frames.some((f) => f.raw.includes(o.token))));
  check(T, "다른 사람의 토큰이 프레임에 없음", !tokenLeak, "");
  teardown(room);
}

function printTable() {
  console.log("\n테스트 | 항목 | 결과 | 내용");
  for (const r of results) console.log(`${r.test} | ${r.label} | ${r.ok ? "OK" : "FAIL"} | ${r.detail}`);
  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} OK`);
}

async function main() {
  console.log(`대상 ${url.origin}`);
  await gameA();
  await gameB();
  printTable();
  process.exit(results.every((r) => r.ok) ? 0 : 1);
}

const overall = setTimeout(() => { console.log(`중단: 전체 ${OVERALL_LIMIT_MS / 1000}초 제한 초과`); printTable(); process.exit(2); }, OVERALL_LIMIT_MS);
main().catch((e) => { clearTimeout(overall); console.log(`중단: ${e.message}`); printTable(); process.exit(2); });
