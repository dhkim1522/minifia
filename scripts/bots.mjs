// 수동 확인용 봇: 사람이 만든 방에 가짜 플레이어를 채워 넣는다. 방장은 브라우저에서 직접 [시작] 을 누른다.
// 봇은 직업 공개 단계에서 알아서 주장을 고르고, 낮 토론에서 가끔 이모티콘·"결백" 메시지를 보낸다.
// 밤에는 역할대로 행동한다: 마피아·경찰·의사 봇은 살아 있는 사람 중 하나를 pick 하고(마피아는 동료 제외), 마피아 봇은 가끔 밤 채팅·이모티콘을 보낸다. 탈락한 봇은 멈춘다.
//
// 사용법:
//   node scripts/bots.mjs <방 코드> [--count N] [--prod | <기준 주소>] [--quiet]
//   예: node scripts/bots.mjs 4821 --count 7 --prod      (8명 방)
// Ctrl+C 로 끝내면 봇이 모두 방을 나간다. Node 22.12+ 내장 fetch·WebSocket 만 쓴다.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const EMOJIS = ["smile", "grin", "surprised", "suspicious", "angry", "sad", "heart", "exclaim"];
const NAMES = ["봇가나", "봇다라", "봇마바", "봇사아", "봇자차", "봇카타", "봇파하"];

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
  if (view.phase === "claim") {
    // 낮마다 한 번만 보낸다. 직업 공개 후보(view.day.roles) 중 아무거나, 가끔 "말 안 함".
    const key = `${view.day?.number ?? view.day?.dayNumber ?? "d"}:${view.phase}`;
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
  } else if (bot.talkTimer) {
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
