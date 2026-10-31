// 수동 확인용 봇: 사람이 만든 방에 가짜 플레이어를 채워 넣는다. 방장은 브라우저에서 직접 [시작] 을 누른다.
// 봇은 직업 주장을 한 명씩 차례로 한다(결정 0023): 자기 차례(day.turn.seat)가 오면 알아서 주장을 고르고, 낮 토론에서 가끔 이모티콘·"결백" 메시지를 보낸다.
// 밤에는 역할대로 행동한다: 마피아·경찰·의사 봇은 살아 있는 사람 중 하나를 pick 하고(마피아는 동료 제외), 마피아 봇은 가끔 밤 채팅·이모티콘을 보낸다. 탈락한 봇은 멈춘다.
// 투표 구간(결정 0024·0036, 서버 봇 shared/game/bots.ts 와 같은 성향): 처형 여부 투표(execVote)에는 70% 찬성·30% 반대,
// 후보 선택(candidateVote)에는 자기를 뺀 살아 있는 한 명, 최후 변론(defense)에서는 자기가 후보일 때만 변론 템플릿(defNotMe·defCitizen·defPlead) 하나.
// 단계마다 한 번만 행동하고, 공개·처형·종료(ended) 단계에서는 아무것도 하지 않는다.
//
// 사용법:
//   node scripts/bots.mjs <방 코드> [--count N] [--prod | <기준 주소>] [--quiet]
//   예: node scripts/bots.mjs 4821 --count 7 --prod      (8명 방)
// Ctrl+C 로 끝내면 봇이 모두 방을 나간다. Node 22.12+ 내장 fetch·WebSocket 만 쓴다.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { exitIfV1 } from "./deploy-target.mjs";

const EMOJIS = ["smile", "grin", "surprised", "suspicious", "angry", "sad", "heart", "exclaim"];
const NAMES = ["봇가나다라마바사", "봇아자차카타파하", "봇갸냐댜랴먀뱌샤", "봇야쟈챠캬탸퍄햐", "봇거너더러머버서", "봇어저처커터퍼허", "봇고노도로모보소"];

function parseArgs(argv) {
  const args = { code: null, count: 3, base: null, prod: false, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--prod") args.prod = true;
    else if (a === "--quiet") args.quiet = true;
    else if (a === "--count") args.count = Number(argv[++i]);
    else if (!a.startsWith("--") && args.code === null) args.code = a;
    else if (!a.startsWith("--") && args.base === null) args.base = a;
    else die(`알 수 없는 인자: ${a}`);
  }
  if (!/^\d{4}$/.test(args.code ?? "")) die("방 코드(숫자 4자리)를 첫 인자로 주세요. 예: node scripts/bots.mjs 4821 --count 7 --prod");
  if (!Number.isInteger(args.count) || args.count < 1 || args.count > NAMES.length) die(`--count 는 1~${NAMES.length} 정수`);
  return args;
}

function die(msg) {
  console.log(msg);
  process.exit(2);
}

const args = parseArgs(process.argv.slice(2));
let base = args.base;
if (args.prod) base = readFileSync(fileURLToPath(new URL("./prod-url.txt", import.meta.url)), "utf8").trim();
const url = new URL((base ?? "http://localhost:5173").replace(/\/+$/, ""));
exitIfV1(url.origin); // v1.0 주소는 요청 전에 거부(DEPLOY-02)
const wsUrl = `${url.protocol === "https:" ? "wss:" : "ws:"}//${url.host}/api/rooms/${args.code}/ws`;
const log = (...a) => { if (!args.quiet) console.log(...a); };
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const bots = [];

async function addBot(nickname) {
  const res = await fetch(`${url.origin}/api/rooms/${args.code}/join`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ nickname }),
  });
  const data = await res.json().catch(() => null);
  if (res.status !== 200 && res.status !== 201) {
    console.log(`${nickname} 참가 실패: ${res.status} ${data?.error ?? ""}`);
    return;
  }
  const bot = { nickname, token: data.token, seat: data.seat, claimedDay: -1, ws: null };
  bots.push(bot);
  connect(bot);
  log(`${nickname} 참가 (자리 ${bot.seat})`);
}

function connect(bot) {
  const ws = new WebSocket(wsUrl);
  bot.ws = ws;
  ws.addEventListener("open", () => ws.send(JSON.stringify({ t: "hello", token: bot.token })));
  ws.addEventListener("message", (ev) => {
    let msg;
    try { msg = JSON.parse(String(ev.data)); } catch { return; }
    if (msg.t === "ping") ws.send(JSON.stringify({ t: "pong", c: msg.c }));
    if (msg.t === "state") onState(bot, msg.view);
  });
  ws.addEventListener("close", () => {
    if (bot.leaving) return;
    setTimeout(() => connect(bot), 1000); // 배포·끊김 뒤 다시 붙는다
  });
}

function onState(bot, view) {
  const send = (m) => bot.ws.readyState === WebSocket.OPEN && bot.ws.send(JSON.stringify(m));
  // 탈락한 봇은 아무것도 보내지 않는다(낮 claim·토론, 밤 포함). 서버가 어차피 BAD_MESSAGE 로 거부한다.
  const mine = view.players?.find((p) => p.seat === view.me?.seat);
  if (mine && mine.alive === false) {
    if (bot.talkTimer) { clearInterval(bot.talkTimer); bot.talkTimer = null; }
    return;
  }
  // 대기실·배정에 있으면(새 판 시작 전, 테스트 방의 대기실 복귀 포함) 낮·밤에 한 번만 행동하는 기록을 비운다 — 새 판 1일차에도 행동한다.
  if (view.phase === "lobby" || view.phase === "assigning") {
    if (bot.talkTimer) { clearInterval(bot.talkTimer); bot.talkTimer = null; }
    bot.claimKey = null;
    bot.nightKey = null;
    bot.voteKey = null;
    return;
  }
  if (view.phase === "claim") {
    // 차례 주장: 지금 차례가 내 seat 일 때만, 낮마다 한 번만 보낸다(키 = `${일차}:${seat}:claim`).
    // 직업 후보(view.day.roles) 중 아무거나, 가끔 "말 안 함". 한 차례는 8초라 0.5~3.5초 뒤에 보내면 늘 시간 안이다.
    if (view.day?.turn?.seat !== bot.seat) return;
    const key = `${view.day?.n ?? "d"}:${bot.seat}:claim`;
    if (bot.claimKey === key) return;
    bot.claimKey = key;
    const roles = view.day?.roles ?? [];
    const claim = Math.random() < 0.15 || roles.length === 0 ? "none" : pick(roles);
    setTimeout(() => { send({ t: "claim", claim }); log(`${bot.nickname}: 주장 ${claim}`); }, 500 + Math.random() * 3000);
  } else if (view.phase === "discussion") {
    if (bot.talkTimer) return;
    bot.talkTimer = setInterval(() => {
      if (Math.random() < 0.5) send({ t: "emoji", icon: pick(EMOJIS) });
      else send({ t: "say", template: "innocent" });
    }, 2500 + Math.random() * 4000);
  } else if (view.phase === "night") {
    if (bot.talkTimer) { clearInterval(bot.talkTimer); bot.talkTimer = null; }
    // 밤마다 한 번만 고른다(밤 키 = `${일차}:night`). 마피아는 동료가 아닌 살아 있는 사람, 경찰·의사는 살아 있는 아무나, 시민은 행동 없음.
    const key = `${view.day?.n ?? "d"}:night`;
    if (bot.nightKey === key) return;
    bot.nightKey = key;
    const role = view.me?.role;
    if (role !== "mafia" && role !== "police" && role !== "doctor") return;
    const allies = new Set(view.me.allies ?? []);
    const candidates = view.players
      .filter((p) => p.alive !== false && p.seat !== bot.seat && !(role === "mafia" && allies.has(p.seat)))
      .map((p) => p.seat);
    if (role === "doctor" && Math.random() < 0.2) candidates.push(bot.seat); // 의사는 가끔 자신을 보호
    if (candidates.length === 0) return;
    const target = pick(candidates);
    setTimeout(() => { send({ t: "pick", target }); log(`${bot.nickname}: 밤 지목 ${target}`); }, 500 + Math.random() * 3500);
    if (role === "mafia" && Math.random() < 0.6) {
      // 마피아 봇은 가끔 밤 채팅·이모티콘(서버가 살아 있는 마피아와 탈락자에게만 보낸다)
      setTimeout(() => send(Math.random() < 0.5 ? { t: "say", template: "nightAgree" } : { t: "emoji", icon: pick(EMOJIS) }), 6000 + Math.random() * 6000);
    }
  } else if (view.phase === "execVote" || view.phase === "candidateVote" || view.phase === "defense") {
    if (bot.talkTimer) { clearInterval(bot.talkTimer); bot.talkTimer = null; }
    // 투표 구간 행동은 단계마다 한 번만 보낸다(키 = `${일차}:${단계}`). 사람과 같은 메시지 형식이라 서버 검증을 그대로 받는다.
    const key = `${view.day?.n ?? "d"}:${view.phase}`;
    if (bot.voteKey === key) return;
    bot.voteKey = key;
    if (view.phase === "execVote") {
      const agree = Math.random() < 0.7;
      setTimeout(() => { send({ t: "execVote", agree }); log(`${bot.nickname}: 여부 투표 ${agree ? "찬성" : "반대"}`); }, 500 + Math.random() * 5500);
    } else if (view.phase === "candidateVote") {
      const candidates = view.players.filter((p) => p.alive !== false && p.seat !== bot.seat).map((p) => p.seat);
      if (candidates.length === 0) return;
      const target = pick(candidates);
      setTimeout(() => { send({ t: "candidateVote", target }); log(`${bot.nickname}: 후보 선택 ${target}`); }, 1000 + Math.random() * 8000);
    } else {
      // 변론은 후보 본인만 한다. 대상·직업이 필요 없는 템플릿 셋 중 하나.
      if (view.day?.candidate !== bot.seat) return;
      const template = pick(["defNotMe", "defCitizen", "defPlead"]);
      setTimeout(() => { send({ t: "say", template }); log(`${bot.nickname}: 변론 ${template}`); }, 1000 + Math.random() * 3000);
    }
  } else if (bot.talkTimer) {
    // 공개·처형·종료(ended) 등 그 밖의 단계: 행동 없이 토론 타이머만 정리한다.
    clearInterval(bot.talkTimer);
    bot.talkTimer = null;
    bot.claimKey = null;
  }
}

process.on("SIGINT", () => {
  for (const b of bots) {
    b.leaving = true;
    try { b.ws.send(JSON.stringify({ t: "leave" })); b.ws.close(); } catch { /* 이미 닫힘 */ }
  }
  setTimeout(() => process.exit(0), 500);
});

for (let i = 0; i < args.count; i++) await addBot(NAMES[i]);
console.log(`봇 ${bots.length}명이 방 ${args.code} 에 있습니다. 브라우저에서 시작하세요. 끝내려면 Ctrl+C.`);
