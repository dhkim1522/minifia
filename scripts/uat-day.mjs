// 2페이즈 UAT 를 봇으로 대신 도는 시나리오(7페이즈 자유 채팅 기준). 봇이 방을 만들고 채워 낮 두 바퀴를 돌며 결과 표를 낸다.
// 직업 주장 차례·빠른 메시지·이모티콘은 없다(7페이즈에서 없어졌다). 낮은 dayAnnounce → discussion 이고, 말은 자유 채팅 `{t:"chat", text, pk}` 다.
// pk 는 받은 마지막 state 의 `${day.n ?? 0}:${phase}` 로 만든다(test/worker/helpers.ts 의 chatSend 와 같은 규칙).
// 방장 넘기기는 없다(결정 0017-5): 1일차 토론(90초, 결정 0060-1)은 과반이 토론 끝내기를 누르면 일찍 끝나고(DAY-03), 지목(15초)·밤(30초)·아침(5초)이 서버 타이머로 지나 2일차로 간다.
// 이 스크립트의 봇은 지목하지 않아(0표) 변론·찬반·처형 없이 곧장 밤이 된다(지목·찬반 규칙은 uat-vote.mjs).
// 이 스크립트의 봇은 밤에 행동하지 않아 탈락자가 없다 — 밤·아침은 단계 도착 차이 표에만 나온다(밤 시나리오는 uat-night.mjs).
// 채팅은 state 가 아니라 chat 프레임으로, 입력 중은 typing 프레임으로 온다(CHAT-01·04).
//   테스트 6: 자유 채팅 — 모두가 한 줄씩 보낸 줄이 보낸 폰 포함 모든 폰에 ch all 로 가고 seq 가 틈 없이 같다(CHAT-01),
//             D5 거절(600ms 안 연달아 → rate · 같은 문장 3초 안 → repeat · 5초 창 6번째 → rate)이 보낸 폰에만 chatReject 로 오고
//             다른 폰에는 아무것도 가지 않는다(CHAT-05), 단계 키(pk)가 틀린 줄은 phase 로 막힌다, 2일차에도 seq 가 이어진다
//   테스트 7: 입력 중은 typing 프레임(보낸 폰 제외)이고 state 에 typing 키가 없다(CHAT-04),
//             단계 전환 도착 시각 차이(같은 PC 에서 잰 값)
//   테스트 4: 토론 길이 90초, 토론 끝내기 과반(절반 + 1) → 토론 마감을 기다리지 않고 지목, 지목 0표 → 밤(noExecution noVotes)
// 화면 모양·애니메이션 부드러움·실제 폰 시계 차이는 봇으로 볼 수 없다.
//
// 사용법: node scripts/uat-day.mjs [--prod | <기준 주소>] [--players 4~8]
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { exitIfV1 } from "./deploy-target.mjs";

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
exitIfV1(url.origin); // v1.0 주소는 요청 전에 거부(DEPLOY-02)
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

// 단계 키 '일차:단계' — 받은 마지막 state 로 만든다(로비는 day 가 없어 0).
const pkOf = (c) => `${lastView(c)?.day?.n ?? 0}:${lastView(c)?.phase}`;
const sendChat = (c, text, pk = pkOf(c)) => send(c, { t: "chat", text, pk });
const sendTyping = (c, on) => send(c, { t: "typing", on, pk: pkOf(c) });
// 받은 chat 프레임(채널을 주면 그 채널만), 받은 typing·chatReject 프레임
const chats = (c, ch) => c.frames.filter((f) => f.msg.t === "chat" && (ch === undefined || f.msg.ch === ch));
const typings = (c) => c.frames.filter((f) => f.msg.t === "typing");
const rejects = (c) => c.frames.filter((f) => f.msg.t === "chatReject");
const seqsOf = (c, ch) => chats(c, ch).map((f) => f.msg.seq);
const contiguous = (xs) => xs.every((x, i) => x === (i === 0 ? xs[0] : xs[i - 1] + 1));

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
  await waitUntil(() => clients.every((c) => firstState(c, (v) => v.phase === "discussion")), 60_000, "1일차 discussion");
  const sawClaim = clients.some((c) => states(c).some((f) => f.msg.view.phase === "claim"));
  check(6, "직업 주장 단계 없음: dayAnnounce 다음이 곧바로 discussion", !sawClaim, "");
  console.log("1일차 토론 — 자유 채팅 시험");

  // 테스트 6-a: 모두가 한 줄씩 동시에 보낸다 — 보낸 폰을 포함한 모든 폰이 같은 줄을 같은 seq 로 받는다
  const first = clients.map((c) => `안녕 ${c.seat}`);
  clients.forEach((c, i) => sendChat(c, first[i]));
  await waitUntil(() => clients.every((c) => chats(c, "all").length >= N), 5000, "첫 줄 도착");
  await sleep(500);
  const seqs0 = clients.map((c) => seqsOf(c, "all").slice(0, N));
  check(6, `${N}명이 동시에 보낸 ${N}줄이 모든 폰(보낸 폰 포함)에 ch all 로 도착`, clients.every((c) => chats(c, "all").length === N), `폰별 ${clients.map((c) => chats(c, "all").length).join(",")}줄`);
  check(6, "seq 가 모든 폰에서 같고 틈이 없음", seqs0.every((q) => JSON.stringify(q) === JSON.stringify(seqs0[0])) && contiguous(seqs0[0]), `[${seqs0[0]}]`);
  const bodyOk = clients.every((c) => first.every((t) => chats(c, "all").some((f) => f.msg.text === t && f.msg.seat === Number(t.split(" ")[1]))));
  check(6, "줄의 보낸 사람 seat·본문이 보낸 그대로", bodyOk, "");

  // 테스트 6-b: D5 거절. 첫 줄의 5초 창이 비도록 기다린 뒤 두 사람이 동시에 시험한다.
  await sleep(5500);
  const R = clients[1];
  const S = clients[2];
  const rejBefore = new Map(clients.map((c) => [c, rejects(c).length]));
  const countBefore = new Map(clients.map((c) => [c, chats(c, "all").length]));
  const rTest = async () => {
    sendChat(R, "첫째"); // 수락
    sendChat(R, "둘째"); // 600ms 안 연달아 → rate
    await sleep(900);
    sendChat(R, "첫째"); // 같은 문장 3초 안 → repeat
  };
  const sTest = async () => {
    for (let k = 1; k <= 5; k++) { sendChat(S, `연속 ${k}`); await sleep(700); } // 5줄 수락
    sendChat(S, "연속 6"); // 5초 창 6번째 → rate
  };
  await Promise.all([rTest(), sTest()]);
  await waitUntil(() => rejects(R).length - rejBefore.get(R) >= 2 && rejects(S).length - rejBefore.get(S) >= 1, 5000, "거절 도착");
  await sleep(1000);
  const rWhy = rejects(R).slice(rejBefore.get(R)).map((f) => f.msg.why);
  const sWhy = rejects(S).slice(rejBefore.get(S)).map((f) => f.msg.why);
  check(6, "D5: 600ms 안 연달아 → rate, 같은 문장 3초 안 → repeat (보낸 폰에)", JSON.stringify(rWhy) === JSON.stringify(["rate", "repeat"]), rWhy.join(","));
  check(6, "D5: 5초 창 6번째 → rate (보낸 폰에)", JSON.stringify(sWhy) === JSON.stringify(["rate"]), sWhy.join(","));
  const othersRej = clients.filter((c) => c !== R && c !== S).map((c) => rejects(c).length - rejBefore.get(c));
  check(6, "거절은 보낸 폰에만: 다른 폰의 chatReject 0건", othersRej.every((n) => n === 0), `다른 폰 ${othersRej.join(",")}`);
  const added = clients.map((c) => chats(c, "all").length - countBefore.get(c));
  check(6, "받아들인 6줄(첫째 + 연속 1~5)만 모든 폰에 도착, 거절된 줄은 어느 폰에도 없음", added.every((n) => n === 6)
    && clients.every((c) => !chats(c, "all").some((f) => f.msg.text === "둘째" || f.msg.text === "연속 6")), `폰별 ${added.join(",")}줄`);
  const seqs1 = clients.map((c) => seqsOf(c, "all"));
  check(6, "seq 가 모든 폰에서 같고 틈이 없음 (거절된 줄은 번호를 쓰지 않음)", seqs1.every((q) => JSON.stringify(q) === JSON.stringify(seqs1[0])) && contiguous(seqs1[0]), `1..${seqs1[0].at(-1)}`);

  // 테스트 6-c: 단계 키가 틀린 줄은 phase 로 막히고 보낸 폰에만 알린다
  const P = clients[3];
  const pBefore = rejects(P).length;
  const othersBefore = clients.filter((c) => c !== P).map((c) => rejects(c).length + chats(c).length);
  sendChat(P, "엉뚱한 단계", "9:night");
  await waitUntil(() => rejects(P).length > pBefore, 5000, "pk 거절");
  await sleep(500);
  const othersAfter = clients.filter((c) => c !== P).map((c) => rejects(c).length + chats(c).length);
  check(6, "단계 키가 틀린 줄 → chatReject phase (보낸 폰에만, 다른 폰엔 아무것도 없음)", rejects(P).at(-1).msg.why === "phase" && JSON.stringify(othersBefore) === JSON.stringify(othersAfter), rejects(P).at(-1).msg.why);

  // 테스트 7-a: 입력 중은 typing 프레임이다(보낸 폰 제외 모든 폰). state 에는 typing 이 없다.
  const T = clients[3];
  const tBefore = new Map(clients.map((c) => [c, typings(c).length]));
  sendTyping(T, true);
  await waitUntil(() => clients.filter((c) => c !== T).every((c) => typings(c).length > tBefore.get(c)), 5000, "typing 켜짐 도착");
  await sleep(300);
  sendTyping(T, false);
  await waitUntil(() => clients.filter((c) => c !== T).every((c) => typings(c).length >= tBefore.get(c) + 2), 5000, "typing 꺼짐 도착");
  await sleep(500);
  const typingSeq = clients.filter((c) => c !== T).map((c) => typings(c).slice(tBefore.get(c)).map((f) => `${f.msg.seat}:${f.msg.on}`).join(","));
  check(7, "입력 중 켜짐→꺼짐이 typing 프레임으로 다른 모든 폰에", typingSeq.every((x) => x === `${T.seat}:true,${T.seat}:false`), typingSeq[0]);
  check(7, "보낸 폰은 자기 입력 중 프레임을 받지 않음", typings(T).length === tBefore.get(T), "");
  const typingInState = clients.some((c) => states(c).some((f) => JSON.stringify(f.msg).includes('"typing"')));
  const messagesInState = clients.some((c) => states(c).some((f) => JSON.stringify(f.msg).includes('"messages"')));
  check(7, "state 에 typing·messages 키가 없음", !typingInState && !messagesInState, "");

  // 토론 길이 90초(DAY-07): 과반이 토론 끝내기를 누르면 마감을 기다리지 않고 지목으로 넘어간다(DAY-03). 넘기기(방장 도구)는 없다.
  const discViews = clients.map((c) => firstState(c, (v) => v.phase === "discussion" && v.day?.n === 1).msg.view);
  check(4, "discussion 길이 90초, 첫 day.endCount 0", discViews.every((v) => v.phaseDurationMs === 90_000 && v.day.endCount === 0), discViews.map((v) => `${v.phaseDurationMs}/${v.day.endCount}`).join(","));
  const discEndsAt = discViews[0].phaseEndsAt;
  const need = Math.floor(N / 2) + 1;
  for (let k = 0; k < need; k++) {
    send(clients[k], { t: "endDiscussion", on: true });
    if (k === need - 1) break;
    await waitUntil(() => clients.every((c) => lastView(c).phase === "discussion" && lastView(c).day.endCount === k + 1), 5000, `토론 끝내기 ${k + 1}명 뒤 endCount`);
  }
  await waitUntil(() => clients.every((c) => firstState(c, (v) => v.phase === "nomination" && v.day?.n === 1)), 8000, "과반 토론 끝내기 뒤 nomination");
  const nomViews = clients.map((c) => firstState(c, (v) => v.phase === "nomination" && v.day?.n === 1).msg.view);
  check(4, `토론 끝내기 과반(${need}/${N}) → 토론 마감(90초)을 기다리지 않고 15초 지목 단계로 넘어감`, nomViews.every((v) => v.serverNow < discEndsAt - 10_000 && v.phaseDurationMs === 15_000 && Array.isArray(v.day.points) && v.day.points.length === 0), `진입 ${discEndsAt - nomViews[0].serverNow}ms 일찍`);
  console.log("서버 타이머로 지목·밤·아침이 지나 2일차가 되기를 기다림(최대 120초)");

  // ---- 2일차 ----
  await waitUntil(() => clients.every((c) => firstState(c, (v) => v.phase === "discussion" && v.day?.n === 2)), 120_000, "2일차 discussion");
  // 지목 0표 → 변론 없이 night. 모든 폰의 night 가 처형 무효 이유 noVotes 를 같게 싣는다(결정 0060-3).
  const noExec = clients.map((c) => firstState(c, (v) => v.phase === "night" && v.day?.n === 1).msg.view.day.noExecution);
  check(4, "지목 0표: 1일차 night 의 day.noExecution 이 모든 폰에서 {reason:noVotes}", noExec.every((x) => JSON.stringify(x) === JSON.stringify({ reason: "noVotes" })), JSON.stringify(noExec[0]));
  const seq1 = [];
  for (const f of states(host)) if (f.msg.view.day?.n === 1 && seq1.at(-1) !== f.msg.view.phase) seq1.push(f.msg.view.phase);
  const iDisc1 = seq1.indexOf("discussion");
  check(4, "1일차 단계 순서: discussion → nomination → night (변론·찬반·처형 단계 없음)", seq1[iDisc1 + 1] === "nomination" && seq1[iDisc1 + 2] === "night", seq1.join(" → "));

  // 2일차 토론에서도 seq 가 이어진다(채널 all 은 단계·일차를 넘어 한 줄 번호)
  const lastSeq = seqs1[0].at(-1);
  const day2Before = new Map(clients.map((c) => [c, chats(c, "all").length]));
  sendChat(host, "이틀째 인사");
  await waitUntil(() => clients.every((c) => chats(c, "all").length > day2Before.get(c)), 5000, "2일차 줄 도착");
  const day2Seqs = clients.map((c) => chats(c, "all").at(-1).msg.seq);
  check(6, "2일차 토론의 줄도 모든 폰에 가고 seq 가 이어짐", day2Seqs.every((q) => q === lastSeq + 1), `1일차 마지막 ${lastSeq} → ${day2Seqs[0]}`);

  // 테스트 7-b: 단계 전환 도착 차이(1일차 dayAnnounce 부터 2일차 discussion 까지)
  const phases = [["dayAnnounce", 1], ["discussion", 1], ["nomination", 1], ["night", 1], ["morning", 1], ["dayAnnounce", 2], ["discussion", 2]];
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
  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} 통과`);
  process.exit(results.every((r) => r.ok) ? 0 : 1);
}

main().catch((e) => { console.log(`중단: ${e.message}`); process.exit(2); });
