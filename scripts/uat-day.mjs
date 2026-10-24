// 2페이즈 UAT 를 봇으로 대신 도는 시나리오. 봇이 방을 만들고 채워 낮 두 바퀴를 돌며 결과 표를 낸다.
//   테스트 6: 빠른 메시지를 2초 간격(2000·2050·2150ms)으로 연달아 보낼 때 RATE_LIMITED 오탐 수, 받은 줄이 모든 폰에 가는지
//   테스트 7(일부): 단계 전환·이모티콘 도착 시각 차이(같은 PC 에서 잰 값), 이모티콘이 메시지 목록에 남지 않는지
//   테스트 8(사실 확인): 2일차에 고르지 않은 사람의 공개 값(말 안 함인지 어제 주장인지), 다른 직업이면 changed
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

// 모든 클라이언트가 받은 state 의 메시지 seq 합집합(보관 20개 제한을 피해 프레임 전체를 본다)
const seenSeqs = (c) => new Set(states(c).flatMap((f) => (f.msg.view.day?.messages ?? []).map((m) => m.seq)));

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
    // 내 줄이 state 로 돌아오거나 error 가 오면 판정
    await waitUntil(() => c.frames.slice(before).some((f) => f.msg.t === "error" || (f.msg.t === "state" && (f.msg.view.day?.messages ?? []).some((m) => m.seat === c.seat && m.at && !out.okSeqs.includes(m.seq) && m.target === target)))
      , 5000, `${c.nickname} say 응답 없음`);
    const fr = c.frames.slice(before);
    const err = fr.find((f) => f.msg.t === "error");
    const st = fr.find((f) => f.msg.t === "state" && (f.msg.view.day?.messages ?? []).some((m) => m.seat === c.seat && !out.okSeqs.includes(m.seq) && m.target === target));
    if (st && (!err || st.at < err.at)) {
      const mine = st.msg.view.day.messages.filter((m) => m.seat === c.seat && !out.okSeqs.includes(m.seq) && m.target === target).at(-1);
      out.ok++;
      out.okSeqs.push(mine.seq);
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
  console.log(`방 ${code} — 시작`);
  send(host, { t: "start" });

  // ---- 1일차 ----
  await waitUntil(() => clients.every((c) => firstState(c, (v) => v.phase === "claim")), 40_000, "1일차 claim");
  const roles = lastView(clients[1]).day.roles;
  // 1번: roles[0], 2번: roles[1], 3번: roles[0], 나머지는 고르지 않음
  send(clients[1], { t: "claim", claim: roles[0] });
  send(clients[2], { t: "claim", claim: roles[1] });
  send(clients[3], { t: "claim", claim: roles[0] });
  await waitUntil(() => clients.every((c) => firstState(c, (v) => v.phase === "discussion")), 30_000, "1일차 discussion");
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
  const msgs = lastView(host).day.messages;
  check(7, "이모티콘은 메시지 목록에 없음", msgs.every((m) => !("icon" in m)), "");

  // 넘기기 → 2일차
  send(host, { t: "skip" });

  // ---- 2일차 ----
  await waitUntil(() => clients.every((c) => firstState(c, (v) => v.phase === "claim" && v.day?.n === 2)), 30_000, "2일차 claim");
  // 1번: 다른 직업(말 바꿈 기대), 2번: 고르지 않음(어제 roles[1]), 3번: 같은 직업
  send(clients[1], { t: "claim", claim: roles[2] });
  send(clients[3], { t: "claim", claim: roles[0] });
  await waitUntil(() => clients.every((c) => firstState(c, (v) => v.phase === "claimReveal" && v.day?.n === 2)), 30_000, "2일차 claimReveal");
  const claims = clients.map((c) => firstState(c, (v) => v.phase === "claimReveal" && v.day?.n === 2).msg.view.day.claims);
  const bySeat = (cl, seat) => cl.find((x) => x.seat === seat);
  check(3, "다른 직업 → 모든 폰에 changed", claims.every((cl) => bySeat(cl, clients[1].seat).changed === true), `${roles[0]} → ${roles[2]}`);
  check(3, "같은 직업 → changed 아님", claims.every((cl) => bySeat(cl, clients[3].seat).changed === false), "");
  const carried = bySeat(claims[0], clients[2].seat);
  check(8, "2일차에 안 고른 사람의 공개 값", true, `어제 ${roles[1]} → 오늘 ${carried.claim}${carried.changed ? " (changed)" : ""}`);
  const neverPicked = bySeat(claims[0], clients[4].seat);
  check(8, "이틀 다 안 고른 사람의 공개 값", true, neverPicked.claim);

  // 테스트 7: 단계 전환 도착 차이(1일차 dayAnnounce 부터 2일차 discussion 까지)
  await waitUntil(() => clients.every((c) => firstState(c, (v) => v.phase === "discussion" && v.day?.n === 2)), 30_000, "2일차 discussion");
  const phases = [["dayAnnounce", 1], ["claim", 1], ["claimReveal", 1], ["discussion", 1], ["dayAnnounce", 2], ["claim", 2], ["claimReveal", 2], ["discussion", 2]];
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
