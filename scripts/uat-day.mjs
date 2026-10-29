// 2페이즈 UAT 를 봇으로 대신 도는 시나리오. 봇이 방을 만들고 채워 낮 두 바퀴를 돌며 결과 표를 낸다.
// 직업 주장은 한 명씩 차례로(결정 0023·0027): 한 차례 8초, 일찍 고르면 곧바로 다음 차례. 스크립트 안의 응답기가
// 상태 프레임에서 자기 차례(claim 단계 + day.turn.seat)가 오면 한 번 보낸다.
// 방장 넘기기는 없다(결정 0017-5): 1일차 토론(40초)·처형 여부 투표(13초, 결정 0036·0039)·밤(30초)·아침(5초)이 서버 타이머로 지나 2일차로 간다.
// 이 스크립트의 봇은 여부 투표에 표를 던지지 않아(0표 = 미통과) 후보 선택 없이 곧장 밤이 된다.
// 이 스크립트의 봇은 밤에 행동하지 않아 탈락자가 없다 — 밤·아침은 단계 도착 차이 표에만 나온다(밤 시나리오는 uat-night.mjs).
// 빠른 메시지는 state 가 아니라 chat 프레임으로 온다(결정 0017-7).
//   테스트 6: 빠른 메시지를 2초 간격(2000·2050·2150ms)으로 연달아 보낼 때 RATE_LIMITED 오탐 수, 받은 줄이 모든 폰에 가는지
//   테스트 7(일부): 단계 전환·이모티콘 도착 시각 차이(같은 PC 에서 잰 값), 이모티콘이 chat 프레임이 아니고 state 에 messages 가 없는지
//   테스트 3: 차례 순서(방장부터 seat 오름차순)·모든 폰의 day.claimLog 가 같고 기대값(고른 값·시간 초과 none)이다,
//             2일차 시작 자리가 방장 다음 seat 로 한 칸 이동한다
//   테스트 8: 어제 주장은 이월되지 않는다 — 2일차에 안 고른 사람의 줄은 none 이고 1일차 줄은 그대로다
// 화면 모양·애니메이션 부드러움·실제 폰 시계 차이는 봇으로 볼 수 없다.
//
// 사용법: node scripts/uat-day.mjs [--prod | <기준 주소>] [--players 4~8]
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
      let msg;
      try { msg = JSON.parse(String(ev.data)); } catch { return; }
      c.frames.push({ at: performance.now(), msg });
      if (msg.t === "ping") ws.send(JSON.stringify({ t: "pong", c: msg.c }));
      if (msg.t === "state") resolve();
    });
    ws.addEventListener("error", () => reject(new Error(`${c.nickname} 연결 오류`)));
  });
}

const states = (c) => c.frames.filter((f) => f.msg.t === "state");
const lastView = (c) => states(c).at(-1)?.msg.view ?? null;
const firstState = (c, pred) => states(c).find((f) => pred(f.msg.view));
const send = (c, m) => c.ws.send(JSON.stringify(m));
const spread = (xs) => Math.round(Math.max(...xs) - Math.min(...xs));
const CLAIM_TURN_MS = 8_000;
// 차례 대기 한도: 최대 인원 × 8초(모두 시간 초과일 때)
const CLAIM_WAIT_MS = CLAIM_TURN_MS * N;

// 클라이언트가 받은 chat 프레임의 seq 집합(서버는 메시지를 보관하지 않고 chat 이벤트로 방송만 한다)
const chats = (c) => c.frames.filter((f) => f.msg.t === "chat");
const seenSeqs = (c) => new Set(chats(c).map((f) => f.msg.seq));

// 한 사람이 gap 간격으로 count 번 say 를 보낸다. 보낸 순간 기준 gap 마다(클라이언트 쿨다운과 같은 기준).
async function burst(c, others, gap, count) {
  const out = { sent: 0, ok: 0, limited: 0, okSeqs: [] };
  let next = performance.now();
  for (let k = 0; k < count; k++) {
    const wait = next - performance.now();
    if (wait > 0) await sleep(wait);
    const sentAt = performance.now();
    next = sentAt + gap;
    const before = c.frames.length;
    const target = others[k % others.length].seat;
    send(c, { t: "say", template: k % 2 ? "trust" : "suspect", target });
    out.sent++;
    // 내 줄이 chat 프레임으로 돌아오거나 error 가 오면 판정
    const isMine = (f) => f.msg.t === "chat" && f.msg.seat === c.seat && f.msg.target === target && !out.okSeqs.includes(f.msg.seq);
    await waitUntil(() => c.frames.slice(before).some((f) => f.msg.t === "error" || isMine(f)), 5000, `${c.nickname} say 응답 없음`);
    const fr = c.frames.slice(before);
    const err = fr.find((f) => f.msg.t === "error");
    const st = fr.find(isMine);
    if (st && (!err || st.at < err.at)) {
      out.ok++;
      out.okSeqs.push(st.msg.seq);
    } else if (err?.msg.code === "RATE_LIMITED") out.limited++;
    else throw new Error(`${c.nickname} say 오류 ${err?.msg.code}`);
  }
  return out;
}

async function main() {
  console.log(`대상 ${url.origin}, ${N}명`);
  const clients = Array.from({ length: N }, (_, i) => ({ nickname: `유에이${i + 1}`, token: "", seat: -1, frames: [], ws: null }));
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
  // 차례 응답기: 자기 차례(claim 단계 + day.turn.seat === 내 seat)가 오면 일차마다 한 번만 보낸다.
  //   1일차: 1번 roles[0], 2번 roles[1], 3번 roles[0], 나머지(방장 포함)는 안 고름(8초 시간 초과)
  //   2일차: 1번만 안 고르고(시간 초과) 나머지는 말 안 함(none)을 바로 보낸다 — 어제 주장이 이월되지 않는지 본다
  const claimPlan = (day, idx, roles) => {
    if (day === 1) return idx === 1 ? roles[0] : idx === 2 ? roles[1] : idx === 3 ? roles[0] : null;
    return idx === 1 ? null : "none";
  };
  const claimSent = new Set();
  const driver = setInterval(() => {
    clients.forEach((c, idx) => {
      const v = lastView(c);
      if (!v || v.phase !== "claim" || v.day?.turn?.seat !== c.seat) return;
      const key = `${v.day.n}:${c.seat}`;
      if (claimSent.has(key)) return;
      const claim = claimPlan(v.day.n, idx, v.day.roles);
      claimSent.add(key);
      if (claim !== null && c.ws.readyState === WebSocket.OPEN) send(c, { t: "claim", claim });
    });
  }, 50);
  console.log(`방 ${code} — 시작`);
  send(host, { t: "start" });

  // ---- 1일차 ----
  await waitUntil(() => clients.every((c) => firstState(c, (v) => v.phase === "claim")), 40_000, "1일차 claim");
  const roles = lastView(clients[1]).day.roles;
  const allSeats = clients.map((c) => c.seat).sort((a, b) => a - b);
  const startIdx = allSeats.indexOf(host.seat);
  const order1 = [...allSeats.slice(startIdx), ...allSeats.slice(0, startIdx)];
  await waitUntil(() => clients.every((c) => firstState(c, (v) => v.phase === "discussion")), CLAIM_WAIT_MS + 30_000, "1일차 discussion");
  const logs1 = clients.map((c) => firstState(c, (v) => v.phase === "discussion").msg.view.day.claimLog);
  const expect1 = order1.map((seat) => {
    const idx = clients.findIndex((c) => c.seat === seat);
    return { n: 1, seat, claim: claimPlan(1, idx, roles) ?? "none" };
  });
  check(3, "차례 순서: 방장부터 seat 오름차순", JSON.stringify(logs1[0].map((e) => e.seat)) === JSON.stringify(order1), `[${logs1[0].map((e) => e.seat)}]`);
  check(3, "공개 기록 일치: 모든 폰의 claimLog 가 같고 기대값", logs1.every((lg) => JSON.stringify(lg) === JSON.stringify(expect1)), expect1.map((e) => `${e.seat}:${e.claim}`).join(" "));
  console.log("1일차 토론 — 연속 전송 시험");

  // 테스트 6: 손님 전원이 동시에 각자 간격으로 연달아 보낸다
  const plan = [[2000, 4], [2050, 4], [2150, 4]];
  const others = (c) => clients.filter((o) => o !== c);
  const sendersAll = clients.slice(1);
  const okAll = [];
  for (const [gap, count] of plan) {
    const outs = await Promise.all(sendersAll.map((c) => burst(c, others(c), gap, count)));
    const sent = outs.reduce((a, o) => a + o.sent, 0);
    const limited = outs.reduce((a, o) => a + o.limited, 0);
    outs.forEach((o) => okAll.push(...o.okSeqs));
    check(6, `${gap}ms 간격 ${sendersAll.length}명×${count}번`, limited === 0, `오탐 ${limited}/${sent}`);
    await sleep(2200); // 다음 묶음과 쿨다운이 겹치지 않게
  }
  await sleep(1000);
  const missing = clients.map((c) => okAll.filter((s) => !seenSeqs(c).has(s)).length);
  check(6, "받아들인 메시지가 모든 폰에 도착", missing.every((m) => m === 0), `빠진 줄(폰별) ${missing.join(",")}`);

  // 테스트 7: 이모티콘 — 모든 폰 도착 시각 차이, 메시지 목록에 남지 않음
  const emoSender = clients[2];
  const t0 = performance.now();
  send(emoSender, { t: "emoji", icon: "suspicious" });
  await waitUntil(() => clients.every((c) => c.frames.some((f) => f.at >= t0 && f.msg.t === "emoji" && f.msg.seat === emoSender.seat)), 5000, "이모티콘 도착");
  const emoAt = clients.map((c) => c.frames.find((f) => f.at >= t0 && f.msg.t === "emoji").at);
  check(7, "이모티콘이 모든 폰에 도착", true, `보낸 뒤 ${Math.round(Math.max(...emoAt) - t0)}ms 안, 폰 사이 차이 ${spread(emoAt)}ms`);
  const emojiAsChat = clients.some((c) => chats(c).some((f) => "icon" in f.msg));
  const hasMessagesKey = clients.some((c) => states(c).some((f) => JSON.stringify(f.msg).includes('"messages"')));
  check(7, "이모티콘은 chat 프레임이 아니고 state 의 day 에 messages 키가 없음", !emojiAsChat && !hasMessagesKey, "");

  // 넘기기는 없다: 토론 40초가 서버 타이머로 끝나기를 기다려 2일차로 간다
  console.log("서버 타이머로 토론·여부 투표·밤·아침이 지나 2일차가 되기를 기다림(최대 190초)");

  // ---- 2일차 ----
  await waitUntil(() => clients.every((c) => firstState(c, (v) => v.phase === "claim" && v.day?.n === 2)), 190_000, "2일차 claim");
  // 여부 투표(표 0) → 미통과 → 후보 선택 단계 없이 night. 모든 폰의 night 가 처형 무효 이유 noVotes 를 같게 싣는다(결정 0036-8).
  const noExec = clients.map((c) => firstState(c, (v) => v.phase === "night" && v.day?.n === 1).msg.view.day.noExecution);
  check(4, "여부 투표 0표 → 미통과: 1일차 night 의 day.noExecution 이 모든 폰에서 {reason:noVotes}", noExec.every((x) => JSON.stringify(x) === JSON.stringify({ reason: "noVotes" })), JSON.stringify(noExec[0]));
  const seq1 = [];
  for (const f of states(host)) if (f.msg.view.day?.n === 1 && seq1.at(-1) !== f.msg.view.phase) seq1.push(f.msg.view.phase);
  const iDisc1 = seq1.indexOf("discussion");
  check(4, "1일차 단계 순서: discussion → execVote → night (후보 선택 단계 없음)", seq1[iDisc1 + 1] === "execVote" && seq1[iDisc1 + 2] === "night", seq1.join(" → "));
  const firstTurn2 = firstState(host, (v) => v.phase === "claim" && v.day?.n === 2).msg.view.day.turn.seat;
  const wantStart2 = allSeats[(startIdx + 1) % N];
  check(3, "시작 자리 한 칸 이동 (2일차 첫 차례 = 방장 다음 seat)", firstTurn2 === wantStart2, `1일차 시작 ${host.seat} → 2일차 시작 ${firstTurn2} (기대 ${wantStart2})`);
  await waitUntil(() => clients.every((c) => firstState(c, (v) => v.phase === "discussion" && v.day?.n === 2)), CLAIM_WAIT_MS + 30_000, "2일차 discussion");
  const logs2 = clients.map((c) => firstState(c, (v) => v.phase === "discussion" && v.day?.n === 2).msg.view.day.claimLog);
  const day1Lines = logs2[0].filter((e) => e.n === 1);
  const day2Lines = logs2[0].filter((e) => e.n === 2);
  check(3, "2일차 기록이 모든 폰에서 같음", logs2.every((lg) => JSON.stringify(lg) === JSON.stringify(logs2[0])), `${logs2[0].length}줄`);
  check(8, "1일차 줄은 2일차에도 그대로", JSON.stringify(day1Lines) === JSON.stringify(expect1), "");
  const idx1Line = day2Lines.find((e) => e.seat === clients[1].seat);
  check(8, "어제 주장 이월 없음: 어제 주장한 1번이 오늘 안 고르면 none", idx1Line?.claim === "none", `어제 ${roles[0]} → 오늘 ${idx1Line?.claim}`);
  const day2Order = day2Lines.map((e) => e.seat);
  const order2 = [...allSeats.slice((startIdx + 1) % N), ...allSeats.slice(0, (startIdx + 1) % N)];
  check(3, "2일차 차례 순서: 시작 자리부터 seat 오름차순", JSON.stringify(day2Order) === JSON.stringify(order2), `[${day2Order}]`);

  // 테스트 7: 단계 전환 도착 차이(1일차 dayAnnounce 부터 2일차 discussion 까지)
  clearInterval(driver);
  const phases = [["dayAnnounce", 1], ["claim", 1], ["discussion", 1], ["execVote", 1], ["night", 1], ["morning", 1], ["dayAnnounce", 2], ["claim", 2], ["discussion", 2]];
  const worst = [];
  for (const [ph, n] of phases) {
    const ats = clients.map((c) => firstState(c, (v) => v.phase === ph && v.day?.n === n).at);
    const ends = new Set(clients.map((c) => firstState(c, (v) => v.phase === ph && v.day?.n === n).msg.view.phaseEndsAt));
    worst.push(`${ph}${n} ${spread(ats)}ms`);
    if (ends.size !== 1) check(7, `${ph}${n} 마감 시각이 폰마다 같음`, false, `${ends.size}종`);
  }
  check(7, "단계 전환 도착 차이(같은 PC)", true, worst.join(" · "));

  for (const c of clients) { try { send(c, { t: "leave" }); c.ws.close(); } catch { /* 닫힘 */ } }

  console.log("\n테스트 | 항목 | 결과 | 내용");
  for (const r of results) console.log(`${r.test} | ${r.label} | ${r.ok ? "통과" : "실패"} | ${r.detail}`);
  process.exit(results.every((r) => r.ok) ? 0 : 1);
}

main().catch((e) => { console.log(`중단: ${e.message}`); process.exit(2); });
