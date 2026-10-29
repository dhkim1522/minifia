// 4페이즈 처형·종료 UAT 를 봇으로 대신 도는 시나리오(결정 0034·0036). 봇이 방을 만들고 채워 두 판을 끝까지 돌며 결과 표를 낸다.
// 스크립트는 전지적이다: 각 클라이언트의 view.me.role 로 마피아를 알고 그에 맞춰 표를 던진다. 직업 공개(claim)는 자기 차례에 none 을 바로 보낸다.
// 각 판은 토론 40초를 서버 타이머로 넘기고 처형 구간(최대 60초: 13 + 15 + 17 + 10 + 5)을 지난다. 두 판을 차례로 돈다. 전체 약 7~9분.
//
//   (a) 5명 — 처형으로 시민이 이기는 판
//        여부 투표: 한 명이 반대 → 찬성으로 번복하고 넷 찬성·하나 반대. 매 표 뒤 모든 클라이언트의 execTally 가 같고 남의 voteAgree 는 없다.
//        후보 선택: 마피아가 아닌 넷은 마피아를, 마피아는 다른 사람을 고른다. 한 표 뒤 투표자 외 클라이언트는 그 사이 state 를 받지 않는다.
//        공개: 모든 클라이언트의 voteLog 마지막 줄 cand.votes 가 같은 순서·길이 5, candidate = 마피아.
//        변론: 후보만 변론 메시지(defNotMe), 비후보 say → WRONG_PHASE, 비후보 이모티콘은 모두에게.
//        처형: 모든 클라이언트 day.execution {seat, phrase 1..4}, 살아 있는 클라이언트 프레임에 처형자 직업이 허용 경로 밖에 없음.
//        종료: 처형 5초 뒤 ended — 모든 클라이언트 같은 result(citizenWin, 5자리, 요약 1줄), 종료 중 say → WRONG_PHASE.
//   (b) 4명 — 밤 암살로 마피아가 이기는 판
//        1일차 시민 하나 처형(마피아는 후보에서 뺌) → 밤: 마피아가 남은 비마피아 하나 지목 → morning(탈락)을 먼저 받고 5초 뒤 ended,
//        mafiaWin, 요약 1일차 줄에 exec 와 night {target, died:true}.
//
// 사용법: node scripts/uat-vote.mjs [--prod | <기준 주소>]
// 화면 모양·애니메이션·실제 폰 시계 차이는 봇으로 볼 수 없다. 토큰은 어떤 출력에도 찍지 않는다.
// 이 스크립트는 로컬 서버에서 돌린다. 배포본(--prod) 실행은 화면 계획 뒤 배포 때 한다(결정 0036-15, D-26).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

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
const wsBase = `${url.protocol === "https:" ? "wss:" : "ws:"}//${url.host}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (test, label, ok, detail = "") => results.push({ test, label, ok, detail });

// 단계 시간(shared/game/phases.ts 와 같은 값. 스크립트는 TS 를 import 하지 않는다)
const CLAIM_TURN_MS = 8_000;
const DISCUSSION_MS = 40_000;
const EXEC_VOTE_MS = 13_000;
const CANDIDATE_VOTE_MS = 15_000;
// 후보 선택 공개 단계 길이(결정 0039): n ≥ 1 이면 400 + n×2000 + 600, 0표는 2000. shared/game/phases.ts 의 candidateRevealMs 와 같은 식 — 스크립트는 사본을 쓴다.
const REVEAL_LEAD_MS = 400;
const REVEAL_SLOT_MS = 2_000;
const REVEAL_TAIL_MS = 600;
const REVEAL_EMPTY_MS = 2_000;
const candidateRevealMs = (n) => (n <= 0 ? REVEAL_EMPTY_MS : REVEAL_LEAD_MS + n * REVEAL_SLOT_MS + REVEAL_TAIL_MS);
const DEFENSE_MS = 10_000;
const EXECUTION_MS = 5_000;
const NIGHT_MS = 30_000;
const MORNING_MS = 5_000;
// shared/protocol.ts 의 EXECUTION_PHRASE_COUNT 와 같은 값. 처형 문구 번호는 1..4.
const EXECUTION_PHRASE_COUNT = 4;
const GAME_LIMIT_MS = 420_000; // 한 판 한도(최대 인원 × 8초 claim + 토론 + 처형 구간 + 밤·아침 + 여유)
const OVERALL_LIMIT_MS = 2 * GAME_LIMIT_MS + 60_000;
const ROLE_IDS = ["mafia", "police", "doctor", "citizen"];
const CLAIM_STRINGS = new Set([...ROLE_IDS, "none"]);
// 역할·주장 문자열이 나와도 되는 경로(배열 칸은 [] 로 줄여 비교한다). 처형자 직업은 ended 의 result.seats[].job 에서만 처음 나온다.
const ALLOWED_ROLE_PATHS = new Set(["view.me.role", "view.day.roles[]", "view.day.claimLog[].claim"]);

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
const allHave = (clients, phase) => clients.every((c) => stateOf(c, phase));
const send = (c, m) => c.ws.send(JSON.stringify(m));
// 키 순서와 무관한 깊은 비교(서버 객체의 키 순서에 기대지 않는다)
const canon = (v) => (Array.isArray(v) ? v.map(canon) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
const allSame = (xs) => xs.every((x) => same(x, xs[0]));

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

// 값이 role·주장 문자열인 잎을 경로와 함께 모은다. 배열 인덱스는 [] 로 줄인다.
function collectRoleStringPaths(value, path, out) {
  if (typeof value === "string") {
    if (CLAIM_STRINGS.has(value)) out.push({ path, value });
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

// 방을 만들고 채워 모두 연결한다. 직업 주장 응답기(자기 차례에 none 을 한 번)를 켠다.
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
  const claimSent = new Set();
  const claimDriver = setInterval(() => {
    for (const c of clients) {
      const v = lastView(c);
      if (!v || v.phase !== "claim" || v.day?.turn?.seat !== c.seat) continue;
      const key = `${v.day.n}:${c.seat}`;
      if (claimSent.has(key)) continue;
      claimSent.add(key);
      if (c.ws.readyState === WebSocket.OPEN) send(c, { t: "claim", claim: "none" });
    }
  }, 50);
  return { clients, host, code, claimDriver };
}

function teardown(room) {
  clearInterval(room.claimDriver);
  for (const c of room.clients) { c.leaving = true; try { send(c, { t: "leave" }); c.ws.close(); } catch { /* 닫힘 */ } }
}

// 여부 투표를 plan(순서대로 [클라이언트 인덱스, 찬성 여부])대로 던지며 매 표 뒤 집계 동일·남의 표 비공개를 확인한다. 마지막 집계를 돌려준다.
async function castExecVotes(label, clients, plan) {
  const current = new Map(); // 인덱스 → 마지막 값
  let tallyOk = true;
  let privacyOk = true;
  let detail = "";
  for (const [idx, agree] of plan) {
    send(clients[idx], { t: "execVote", agree });
    current.set(idx, agree);
    const yes = [...current.values()].filter((x) => x).length;
    const no = current.size - yes;
    try {
      await waitUntil(() => clients.every((c) => {
        const v = lastView(c);
        return v?.phase === "execVote" && v.day?.execTally?.yes === yes && v.day?.execTally?.no === no;
      }), 5000, `표 뒤 execTally {yes:${yes}, no:${no}}`);
    } catch (e) {
      tallyOk = false;
      detail = e.message;
      break;
    }
    const tallies = clients.map((c) => lastView(c).day.execTally);
    if (!allSame(tallies)) { tallyOk = false; detail = `execTally 가 클라이언트마다 다름 ${JSON.stringify(tallies)}`; }
    clients.forEach((c, k) => {
      if (lastView(c).me.voteAgree !== current.get(k)) { privacyOk = false; detail = `${c.nickname} 의 me.voteAgree 가 ${current.get(k)} 가 아님: ${lastView(c).me.voteAgree}`; }
    });
  }
  // 어떤 프레임에서도 voteAgree 는 view.me.voteAgree 경로뿐이고, 본인이 던진 값 외의 값을 받은 적이 없다
  for (const [k, c] of clients.entries()) {
    const own = new Set(plan.filter(([idx]) => idx === k).map(([, a]) => a));
    for (const f of states(c)) {
      const va = [];
      collectKeyPaths(f.msg, "voteAgree", "", va);
      if (va.some((p) => p !== "view.me.voteAgree")) { privacyOk = false; detail = `${c.nickname} 프레임에 view.me.voteAgree 밖의 voteAgree: ${va.join(",")}`; }
      const v = f.msg.view.me.voteAgree;
      if (v !== undefined && !own.has(v)) { privacyOk = false; detail = `${c.nickname} 가 자기가 던지지 않은 값의 voteAgree 를 받음`; }
      const tk = f.msg.view.day?.execTally;
      if (tk && Object.keys(tk).sort().join(",") !== "no,yes") { privacyOk = false; detail = `execTally 키 집합이 no,yes 가 아님`; }
    }
  }
  const yes = [...current.values()].filter((x) => x).length;
  const no = current.size - yes;
  check(label, `매 표 뒤 모든 클라이언트의 execTally 가 같음 (최종 찬성 ${yes} 반대 ${no})`, tallyOk, detail);
  check(label, "me.voteAgree 는 보낸 사람 view 에만 있고 남의 표는 어느 프레임에도 없음", privacyOk, detail);
  return { yes, no };
}

// 후보 선택 표 하나를 던지고, 그 사이 투표자 외 클라이언트가 state 를 받지 않았는지 본다.
async function castCandidateVote(clients, idx, target) {
  const counts = clients.map((c) => states(c).length);
  send(clients[idx], { t: "candidateVote", target });
  await waitUntil(() => lastView(clients[idx])?.me.voteTarget === target, 5000, `${clients[idx].nickname} 의 me.voteTarget 반영`);
  await sleep(300); // 새는 프레임이 있다면 도착할 시간
  const leaked = clients.filter((c, k) => k !== idx && states(c).length !== counts[k]).map((c) => c.nickname);
  return leaked;
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

function endedChecks(label, clients, winner, expectSummary) {
  const results_ = clients.map((c) => stateOf(c, "ended").msg.view.result);
  check(label, "ended: 모든 클라이언트가 같은 result", results_.every(Boolean) && allSame(results_), JSON.stringify(results_[0]).slice(0, 160));
  const r = results_[0];
  check(label, `result.winner = ${winner}`, r?.winner === winner, String(r?.winner));
  check(label, `result.seats 가 ${clients.length}자리이고 job 이 실제 직업과 같음`, Array.isArray(r?.seats) && r.seats.length === clients.length && r.seats.every((s) => clients.find((c) => c.seat === s.seat)?.role === s.job), JSON.stringify(r?.seats));
  check(label, "result.summary 가 1줄이고 기대 내용과 같음", Array.isArray(r?.summary) && r.summary.length === 1 && expectSummary(r.summary[0]), JSON.stringify(r?.summary));
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
}

// ---------------------------------------------------------------------------------------------
// (a) 5명 — 여부 통과 → 후보 선택 → 변론 → 처형(마피아) → 시민 승
async function gameA() {
  const T = "처형";
  console.log("(a) 5명 — 처형으로 끝나는 판");
  const room = await setupRoom("처형봇", 5);
  const { clients, host, code } = room;
  console.log(`  방 ${code} — 시작`);
  send(host, { t: "start" });

  // ---- 여부 투표 ----
  await waitUntil(() => allHave(clients, "execVote"), CLAIM_TURN_MS * 5 + 60_000 + DISCUSSION_MS, "1일차 execVote");
  for (const c of clients) c.role = stateOf(c, "execVote").msg.view.me.role;
  const mafias = clients.filter((c) => c.role === "mafia");
  const mafia = mafias[0];
  const citizens = clients.filter((c) => c.role !== "mafia");
  check(T, "역할 구성: 마피아 1명", mafias.length === 1 && citizens.length === 4, `마피아 ${mafias.length}`);
  const execVoteEnds = new Set(clients.map((c) => stateOf(c, "execVote").msg.view.phaseEndsAt));
  check(T, `execVote 마감이 모든 클라이언트에서 같고 길이 ${EXEC_VOTE_MS / 1000}초`, execVoteEnds.size === 1 && clients.every((c) => stateOf(c, "execVote").msg.view.phaseDurationMs === EXEC_VOTE_MS), `${execVoteEnds.size}종`);
  // 번복: 0번이 반대 → 찬성으로 바꾼다. 최종: 0~3번 찬성, 4번 반대
  await castExecVotes(T, clients, [[0, false], [0, true], [1, true], [2, true], [3, true], [4, false]]);

  // ---- 후보 선택 ----
  await waitUntil(() => allHave(clients, "candidateVote"), EXEC_VOTE_MS + 10_000, "candidateVote");
  const cv = clients.map((c) => stateOf(c, "candidateVote").msg.view);
  const passedLine = cv.map((v) => v.day.voteLog.at(-1));
  check(T, "여부 통과: voteLog 마지막 줄 exec {yes:4, no:1, passed:true} 가 모두에게 같음", allSame(passedLine) && same(passedLine[0].exec, { yes: 4, no: 1, passed: true }), JSON.stringify(passedLine[0]));
  check(T, `candidateVote 마감 길이 ${CANDIDATE_VOTE_MS / 1000}초, 개인 표(voteAgree)·execTally 는 더 이상 없음`, cv.every((v) => v.phaseDurationMs === CANDIDATE_VOTE_MS && v.me.voteAgree === undefined && v.day.execTally === undefined), "");
  const otherThanMafia = citizens[0].seat;
  const picks = new Map(); // 클라이언트 인덱스 → 대상 seat
  clients.forEach((c, k) => picks.set(k, c.role === "mafia" ? otherThanMafia : mafia.seat));
  // 마피아 본인이 고르는 대상은 자기 자신일 수 없다 — citizens[0] 이 마피아 대상이므로 citizens[0] 은 마피아를 고른다(자기 자신이 아님)
  const leakedBy = [];
  for (const [k] of clients.entries()) {
    const leaked = await castCandidateVote(clients, k, picks.get(k));
    if (leaked.length > 0) leakedBy.push(`${clients[k].nickname}→${leaked.join("/")}`);
  }
  check(T, "후보 선택: 한 표 뒤 투표자 외 클라이언트는 그 사이 state 를 받지 않음", leakedBy.length === 0, leakedBy.join(" "));
  const ownOnly = clients.every((c, k) => states(c).every((f) => f.msg.view.phase !== "candidateVote" || f.msg.view.me.voteTarget === undefined || f.msg.view.me.voteTarget === picks.get(k)));
  check(T, "me.voteTarget 은 본인이 고른 값뿐(남의 선택을 받은 프레임 없음)", ownOnly, "");
  const voteTargetPaths = new Set();
  for (const c of clients) for (const f of states(c)) {
    if (f.msg.view.phase !== "candidateVote") continue;
    const p = [];
    collectKeyPaths(f.msg, "voteTarget", "", p);
    p.forEach((x) => voteTargetPaths.add(x));
  }
  check(T, "voteTarget 키는 view.me.voteTarget 경로뿐", [...voteTargetPaths].every((p) => p === "view.me.voteTarget"), [...voteTargetPaths].join(","));

  // ---- 공개 ----
  await waitUntil(() => allHave(clients, "candidateVoteReveal"), CANDIDATE_VOTE_MS + 10_000, "candidateVoteReveal");
  const reveal = clients.map((c) => stateOf(c, "candidateVoteReveal").msg.view);
  const revealLines = reveal.map((v) => v.day.voteLog.at(-1));
  const votes0 = revealLines[0].cand?.votes ?? [];
  check(T, "공개: 모든 클라이언트의 cand.votes 가 같은 순서이고 길이 5", revealLines.every((l) => l.cand && l.cand.votes.length === 5) && allSame(revealLines.map((l) => l.cand.votes)), JSON.stringify(votes0));
  const wantPairs = [...picks.entries()].map(([k, target]) => `${clients[k].seat}>${target}`).sort();
  const gotPairs = votes0.map((v) => `${v.seat}>${v.target}`).sort();
  check(T, "공개된 표가 던진 표와 같음(5표, 빠진·바뀐 표 없음)", same(wantPairs, gotPairs), gotPairs.join(" "));
  check(T, "후보 = 마피아(최다 득표 4표)", revealLines.every((l) => l.cand.candidate === mafia.seat) && reveal.every((v) => v.day.candidate === mafia.seat), `후보 ${revealLines[0].cand.candidate}, 마피아 ${mafia.seat}`);
  const revealPrivacy = clients.every((c) => states(c).filter((f) => f.msg.view.phase === "candidateVoteReveal").every((f) => f.msg.view.me.voteTarget === undefined));
  check(T, "공개 구간에는 개인 선택(voteTarget)이 따로 없음", revealPrivacy, "");
  const revealMs = candidateRevealMs(votes0.length);
  check(
    T,
    `공개 마감 길이 = 400 + ${votes0.length}×2000 + 600 = ${revealMs}ms, 모든 클라이언트 같은 phaseEndsAt`,
    revealMs === 11_000 && reveal.every((v) => v.phaseDurationMs === revealMs) && new Set(reveal.map((v) => v.phaseEndsAt)).size === 1,
    `${reveal.map((v) => v.phaseDurationMs).join("/")}, 마감 ${new Set(reveal.map((v) => v.phaseEndsAt)).size}종`,
  );
  const revealAt = Math.min(...clients.map((c) => stateOf(c, "candidateVoteReveal").at));

  // ---- 변론 ----
  await waitUntil(() => allHave(clients, "defense"), revealMs + 10_000, "defense");
  const defenseAt = Math.min(...clients.map((c) => stateOf(c, "defense").at));
  const revealGap = Math.round(defenseAt - revealAt);
  check(T, `공개 약 ${revealMs / 1000}초 뒤 변론`, revealGap >= revealMs - 1000 && revealGap <= revealMs + 4000, `${revealGap}ms`);
  const nonCand = clients.filter((c) => c !== mafia);
  const wrongSay = await requestError(nonCand[0], { t: "say", template: "defPlead" });
  check(T, "변론: 비후보의 say → WRONG_PHASE", wrongSay === "WRONG_PHASE", wrongSay);
  send(mafia, { t: "say", template: "defNotMe" });
  await waitUntil(() => clients.every((c) => c.frames.some((f) => f.at >= defenseAt && f.msg.t === "chat" && f.msg.seat === mafia.seat && f.msg.template === "defNotMe")), 5000, "변론 chat 도착").catch(() => {});
  check(T, "변론: 후보의 defNotMe 가 모든 클라이언트에 chat 프레임으로 감", clients.every((c) => c.frames.some((f) => f.at >= defenseAt && f.msg.t === "chat" && f.msg.seat === mafia.seat && f.msg.template === "defNotMe")), "");
  send(nonCand[1], { t: "emoji", icon: "smile" });
  await waitUntil(() => clients.every((c) => c.frames.some((f) => f.at >= defenseAt && f.msg.t === "emoji" && f.msg.seat === nonCand[1].seat)), 5000, "변론 이모티콘 도착").catch(() => {});
  check(T, "변론: 비후보의 이모티콘이 모든 클라이언트에 감", clients.every((c) => c.frames.some((f) => f.at >= defenseAt && f.msg.t === "emoji" && f.msg.seat === nonCand[1].seat)), "");

  // ---- 처형 ----
  await waitUntil(() => allHave(clients, "execution"), DEFENSE_MS + 10_000, "execution");
  const ex = clients.map((c) => stateOf(c, "execution").msg.view);
  check(T, `처형: 모든 클라이언트 day.execution {seat=마피아, phrase 1..${EXECUTION_PHRASE_COUNT}}`, allSame(ex.map((v) => v.day.execution)) && ex[0].day.execution.seat === mafia.seat && Number.isInteger(ex[0].day.execution.phrase) && ex[0].day.execution.phrase >= 1 && ex[0].day.execution.phrase <= EXECUTION_PHRASE_COUNT && Object.keys(ex[0].day.execution).sort().join(",") === "phrase,seat", JSON.stringify(ex[0].day.execution));
  check(T, "처형: 처형자만 탈락(players[].alive)이 모든 클라이언트에서 같음", ex.every((v) => v.players.every((p) => p.alive === (p.seat !== mafia.seat))), "");
  const leaks = roleStringLeaks(clients, [mafia.seat]);
  check(T, "처형까지 살아 있는 클라이언트 프레임에 허용 경로 밖 직업 문자열 없음(처형자 직업 비공개)", leaks.length === 0, leaks.slice(0, 5).join(" "));

  // ---- 종료 ----
  await waitUntil(() => allHave(clients, "ended"), EXECUTION_MS + 10_000, "ended");
  const gap = Math.round(Math.min(...clients.map((c) => stateOf(c, "ended").at)) - Math.min(...clients.map((c) => stateOf(c, "execution").at)));
  check(T, `처형 약 ${EXECUTION_MS / 1000}초 뒤 ended`, gap >= EXECUTION_MS - 1000 && gap <= EXECUTION_MS + 4000, `${gap}ms`);
  endedChecks(T, clients, "citizenWin", (row) => row.n === 1 && same(row.exec, { yes: 4, no: 1, passed: true, candidate: mafia.seat }) && row.night === undefined);
  const endedSay = await requestError(nonCand[0], { t: "say", template: "innocent" });
  check(T, "종료 중 say → WRONG_PHASE", endedSay === "WRONG_PHASE", endedSay);
  const endedViews = clients.map((c) => lastView(c));
  check(T, "종료 뒤에도 소켓이 열려 있고 마지막 단계가 ended", clients.every((c) => c.closedCode === null) && endedViews.every((v) => v.phase === "ended"), clients.filter((c) => c.closedCode !== null).map((c) => c.nickname).join(","));
  const tokenLeak = clients.some((c) => clients.some((o) => o !== c && c.frames.some((f) => f.raw.includes(o.token))));
  check(T, "다른 사람의 토큰이 프레임에 없음", !tokenLeak, "");
  teardown(room);
}

// ---------------------------------------------------------------------------------------------
// (b) 4명 — 시민 처형 → 밤 암살 → 아침 5초 뒤 마피아 승
async function gameB() {
  const T = "종료";
  console.log("(b) 4명 — 아침으로 끝나는 판");
  const room = await setupRoom("종료봇", 4);
  const { clients, host, code } = room;
  console.log(`  방 ${code} — 시작`);
  send(host, { t: "start" });

  await waitUntil(() => allHave(clients, "execVote"), CLAIM_TURN_MS * 4 + 60_000 + DISCUSSION_MS, "1일차 execVote");
  for (const c of clients) c.role = stateOf(c, "execVote").msg.view.me.role;
  const mafia = clients.find((c) => c.role === "mafia");
  const police = clients.find((c) => c.role === "police");
  const citizens = clients.filter((c) => c.role === "citizen").sort((a, b) => a.seat - b.seat);
  check(T, "역할 구성: 마피아 1·경찰 1·시민 2", !!mafia && !!police && citizens.length === 2, `시민 ${citizens.length}`);
  const C = citizens[0]; // 처형될 시민
  const C2 = citizens[1];
  await castExecVotes(T, clients, [[0, true], [1, true], [2, true], [3, true]]);

  await waitUntil(() => allHave(clients, "candidateVote"), EXEC_VOTE_MS + 10_000, "candidateVote");
  // 마피아·경찰·다른 시민은 C 를, C 본인은 경찰을 고른다(마피아는 후보에서 뺀다 — 시민 승이 나지 않게)
  const picks = new Map();
  clients.forEach((c, k) => picks.set(k, c === C ? police.seat : C.seat));
  for (const [k] of clients.entries()) send(clients[k], { t: "candidateVote", target: picks.get(k) });
  await waitUntil(() => clients.every((c, k) => lastView(c)?.me.voteTarget === picks.get(k)), 5000, "후보 선택 표 반영");

  await waitUntil(() => allHave(clients, "candidateVoteReveal"), CANDIDATE_VOTE_MS + 10_000, "candidateVoteReveal");
  const revealLines = clients.map((c) => stateOf(c, "candidateVoteReveal").msg.view.day.voteLog.at(-1));
  check(T, "공개: 후보 = 처형될 시민, 모든 클라이언트 같은 voteLog", allSame(revealLines) && revealLines[0].cand?.candidate === C.seat && revealLines[0].cand.votes.length === 4, JSON.stringify(revealLines[0]?.cand));

  const revealViewsB = clients.map((c) => stateOf(c, "candidateVoteReveal").msg.view);
  const revealMsB = candidateRevealMs(revealLines[0]?.cand?.votes.length ?? 0);
  check(
    T,
    `공개 마감 길이 = 400 + 4×2000 + 600 = ${revealMsB}ms, 모든 클라이언트 같은 phaseEndsAt`,
    revealMsB === 8_600 && revealViewsB.every((v) => v.phaseDurationMs === revealMsB) && new Set(revealViewsB.map((v) => v.phaseEndsAt)).size === 1,
    `${revealViewsB.map((v) => v.phaseDurationMs).join("/")}, 마감 ${new Set(revealViewsB.map((v) => v.phaseEndsAt)).size}종`,
  );
  const revealAtB = Math.min(...clients.map((c) => stateOf(c, "candidateVoteReveal").at));
  await waitUntil(() => allHave(clients, "defense"), revealMsB + 10_000, "defense");
  const revealGapB = Math.round(Math.min(...clients.map((c) => stateOf(c, "defense").at)) - revealAtB);
  check(T, `공개 약 ${revealMsB / 1000}초 뒤 변론`, revealGapB >= revealMsB - 1000 && revealGapB <= revealMsB + 4000, `${revealGapB}ms`);
  await waitUntil(() => allHave(clients, "execution"), DEFENSE_MS + 10_000, "execution");
  const ex = clients.map((c) => stateOf(c, "execution").msg.view.day.execution);
  check(T, "처형: 모든 클라이언트 day.execution 이 같고 seat = 시민", allSame(ex) && ex[0].seat === C.seat, JSON.stringify(ex[0]));

  // ---- 밤: 마피아가 남은 비마피아 하나를 지목한다 ----
  await waitUntil(() => allHave(clients, "night"), EXECUTION_MS + 10_000, "night");
  check(T, "처형이 성립한 날의 밤에는 day.noExecution 이 없음", clients.every((c) => stateOf(c, "night").msg.view.day.noExecution === undefined), "");
  const survivors = clients.filter((c) => c !== C && c !== mafia).sort((a, b) => a.seat - b.seat);
  const victim = survivors[0];
  check(T, "밤 시작 시 살아 있는 비마피아 둘(경찰·남은 시민)", survivors.length === 2 && survivors.includes(police) && survivors.includes(C2), `${survivors.length}명`);
  send(mafia, { t: "pick", target: victim.seat });
  send(police, { t: "pick", target: mafia.seat });
  await waitUntil(() => lastView(mafia)?.phase === "night" && lastView(mafia).me.pick === victim.seat, 5000, "마피아 지목 반영");

  // ---- 아침 → 종료 ----
  await waitUntil(() => allHave(clients, "morning"), NIGHT_MS + 10_000, "morning");
  const mornings = clients.map((c) => stateOf(c, "morning").msg.view.day.morning);
  check(T, "아침(탈락)을 ended 보다 먼저 받음: 모든 클라이언트 같은 day.morning, 탈락 = 지목한 사람", allSame(mornings) && mornings[0].eliminated === victim.seat, JSON.stringify(mornings[0]));
  const morningAt = Math.min(...clients.map((c) => stateOf(c, "morning").at));
  await waitUntil(() => allHave(clients, "ended"), MORNING_MS + 10_000, "ended");
  const endedAt = Math.min(...clients.map((c) => stateOf(c, "ended").at));
  const gap = Math.round(endedAt - morningAt);
  check(T, `아침 약 ${MORNING_MS / 1000}초 뒤 ended (바로 끝나지 않음)`, gap >= MORNING_MS - 1000 && gap <= MORNING_MS + 4000, `${gap}ms`);
  const seqs = clients.map((c) => { const seq = []; for (const f of states(c)) if (seq.at(-1) !== f.msg.view.phase) seq.push(f.msg.view.phase); return seq.join(">"); });
  check(T, "단계 순서가 모든 클라이언트에서 같고 execution → night → morning → ended", allSame(seqs) && /execution>night>morning>ended$/.test(seqs[0]), seqs[0]);
  endedChecks(T, clients, "mafiaWin", (row) => row.n === 1 && same(row.exec, { yes: 4, no: 0, passed: true, candidate: C.seat }) && row.night?.target === victim.seat && row.night?.died === true);
  const leaks = roleStringLeaks(clients, [C.seat, victim.seat]);
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
