// 수동 확인용 봇: 사람이 만든 방에 가짜 플레이어를 채워 넣는다. 방장은 브라우저에서 직접 [시작] 을 누른다.
// 봇은 자유 채팅을 한다(7페이즈, 결정 0058): 낮 토론에서 50% 확률로 고정 문구 한 줄, 밤 마피아 봇은 가끔 한 줄, 최후 변론에서 후보인 봇은 변론 문구 한 줄.
// 줄은 사람과 같은 `{t:"chat", text, pk}` 로 보낸다. 단계 키(pk)는 봇이 마지막으로 받은 state 의 일차·단계로 만든다.
// 직업 주장 차례·빠른 메시지·이모티콘은 없다(7페이즈에서 없어졌다).
// 밤에는 역할대로 행동한다: 마피아·경찰·의사 봇은 살아 있는 사람 중 하나를 pick 하고(마피아는 동료 제외). 탈락한 봇은 멈춘다.
// 낮 처형 구간(결정 0024·0060-13, 서버 봇 shared/game/bots.ts 와 같은 성향): 토론(discussion) 30~60초에 토론 끝내기(endDiscussion) 한 번,
// 투표(nomination, 기본판 결정 0072)는 동시 투표라 일차·단계 키로 한 번만 1~3초 뒤(아직 같은 단계면) 자기를 뺀 살아 있는 한 명 지목(point) — day.turn 이 있는 방(순차 지목, 결정 0063-1)이면 지금 차례가 내 좌석일 때만,
// 최후 변론(defense)에서는 자기가 변론자일 때만 변론 문구 하나,
// 찬반(verdict) 1~6초에 변론자가 아니면 70% 찬성·30% 반대(verdict).
// 동점 결선(runoff, 결정 0066-4)·마지막 3인 결전(showdown, 결정 0066-5)은 기본판(결정 0072)에서 서버가 단계에 들어가지 않아 아래 행동이 불리지 않는다(켠 판을 위해 남긴다).
// 결선은 투표 창(step 1)에서 후보가 아닌 봇이 후보 둘 중 하나에게 point 한 번,
// 결전은 자기 한마디 차례에 고정 문구 하나를 chat 으로, 동시 지목 창에서 자기를 뺀 산 사람 하나에게 point 한 번 보낸다(사람이 앉은 방에서 봇이 막히지 않게 하는 것이 목적).
// 단계마다 한 번만 행동하고, 처형·밤 밖의 종료(ended) 단계에서는 아무것도 하지 않는다.
//
// 로비 채팅 부하(--chat <초>): 로비에 있는 동안 봇마다 그 간격(±30% 흔들기)으로 입력 중 켜짐 → 1초 뒤 고정 문구 chat → 입력 중 꺼짐을 보낸다.
// 6페이즈 렌더 기준(55fps·끊김 5회)과 비교할 채팅 부하를 만드는 도구다(UI-SPEC 로비 성능 확인 항목). 서버 D5(600ms·5초 5줄·같은 문장 3초)가 그대로 막는다.
// 같은 문장 3초 규칙에 걸리지 않게 문구 12개를 봇마다 다른 자리에서 돌려 쓴다. 본문·토큰은 출력하지 않는다.
//
// 사용법:
//   node scripts/bots.mjs <방 코드> [--count N] [--chat <초>] [--prod | <기준 주소>] [--quiet]
//   예: node scripts/bots.mjs 4821 --count 7 --prod      (8명 방)
//   예: node scripts/bots.mjs 4821 --count 7 --chat 2     (로비에서 봇마다 약 2초 간격으로 채팅)
// Ctrl+C 로 끝내면 봇이 모두 방을 나간다. Node 22.12+ 내장 fetch·WebSocket 만 쓴다.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { exitIfV1 } from "./deploy-target.mjs";

const NAMES = ["봇가나다라마바사", "봇아자차카타파하", "봇갸냐댜랴먀뱌샤", "봇야쟈챠캬탸퍄햐", "봇거너더러머버서", "봇어저처커터퍼허", "봇고노도로모보소"];
// shared/game/bots.ts 의 BOT_CHAT_LINES·BOT_NIGHT_LINES·BOT_DEFENSE_LINES 사본이다(.mjs 가 TS 를 읽지 못해 import 하지 않는다). 문구를 고치면 두 곳을 함께 고친다.
const CHAT_LINES = ["저 아니에요", "누가 수상해요?", "조용한 사람이 수상해요", "어제 그 말 이상했어요", "믿어 주세요", "투표 신중하게 해요", "다들 뭐 했어요?", "저는 시민 같아요"];
const NIGHT_LINES = ["동의해요", "그 사람으로 가요", "다른 사람으로 해요"];
const DEFENSE_LINES = ["저 아니에요", "저는 시민이에요", "한 번만 믿어 주세요"];
// shared/game/showdown.ts 의 LAST_WORD_CHIPS 사본(마지막 3인 한마디, 30자소 이하). 문구를 고치면 두 곳을 함께 고친다.
const LAST_WORD_LINES = ["저는 아니에요", "쟤가 수상해요", "저를 믿어 주세요", "끝까지 지켜봐요"];
// 로비 부하용 문구(위 낮 문구 8개 + 4개). 같은 봇이 같은 문장을 3초 안에 다시 보내지 않도록 12개를 돌린다.
const LOBBY_LINES = [...CHAT_LINES, "여기 처음이에요", "몇 명이 올까요?", "빨리 시작해요", "방이 아늑하네요"];
// D5 최소 전송 간격 600ms(shared/game/chatRules.ts CHAT_MIN_GAP_MS) 아래로 내려가지 않게 --chat 은 1초 이상이다(±30% 흔들어도 0.7초).
const CHAT_LOAD_MIN_S = 1;
const CHAT_LOAD_MAX_S = 600;
// 입력 중 켜짐 → 이 시간 뒤 chat. 한 줄을 치는 시간을 흉내 낸다.
const TYPING_LEAD_MS = 1000;

function parseArgs(argv) {
  const args = { code: null, count: 3, base: null, prod: false, quiet: false, chat: 0 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--prod") args.prod = true;
    else if (a === "--quiet") args.quiet = true;
    else if (a === "--count") args.count = Number(argv[++i]);
    else if (a === "--chat") args.chat = Number(argv[++i]);
    else if (!a.startsWith("--") && args.code === null) args.code = a;
    else if (!a.startsWith("--") && args.base === null) args.base = a;
    else die(`알 수 없는 인자: ${a}`);
  }
  if (!/^\d{4}$/.test(args.code ?? "")) die("방 코드(숫자 4자리)를 첫 인자로 주세요. 예: node scripts/bots.mjs 4821 --count 7 --prod");
  if (!Number.isInteger(args.count) || args.count < 1 || args.count > NAMES.length) die(`--count 는 1~${NAMES.length} 정수`);
  if (args.chat !== 0 && !(args.chat >= CHAT_LOAD_MIN_S && args.chat <= CHAT_LOAD_MAX_S)) die(`--chat 는 ${CHAT_LOAD_MIN_S}~${CHAT_LOAD_MAX_S} 초 (봇마다 이 간격으로 로비 채팅)`);
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
  const bot = { nickname, token: data.token, seat: data.seat, ws: null, view: null, talkKey: null, talkTimer: null, loadTimer: null, loadIdx: bots.length * 3 };
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
    if (msg.t === "state") {
      bot.view = msg.view;
      onState(bot, msg.view);
    }
    // 막히면 한 줄만 남긴다(본문·토큰 없이). 서버가 D5·단계 불일치로 거절한 것이다.
    if (msg.t === "chatReject") log(`${bot.nickname}: 채팅 막힘 (${msg.why})`);
  });
  ws.addEventListener("close", () => {
    if (bot.leaving) return;
    setTimeout(() => connect(bot), 1000); // 배포·끊김 뒤 다시 붙는다
  });
}

const sendTo = (bot, m) => {
  if (bot.ws && bot.ws.readyState === WebSocket.OPEN) bot.ws.send(JSON.stringify(m));
};
// 단계 키 '판:일차:단계'(shared/game/audience.ts phaseKey 와 같은 모양) — 받은 마지막 state 로 만든다. 판이 없으면 1, 로비는 day 가 없어 0.
const pkOf = (bot) => `${bot.view?.round ?? 1}:${bot.view?.day?.n ?? 0}:${bot.view?.phase}`;
const sendChat = (bot, text) => sendTo(bot, { t: "chat", text, pk: pkOf(bot) });
const sendTyping = (bot, on) => sendTo(bot, { t: "typing", on, pk: pkOf(bot) });
const stopTalk = (bot) => {
  if (bot.talkTimer) { clearTimeout(bot.talkTimer); bot.talkTimer = null; }
};
const stopLoad = (bot) => {
  if (bot.loadTimer) { clearTimeout(bot.loadTimer); bot.loadTimer = null; }
};

// 단계가 아직 같을 때만 보낸다(지연 사이에 단계가 넘어갔으면 서버가 phase 로 막을 줄이라 보내지 않는다).
function sayLater(bot, phase, day, text, delayMs, label) {
  stopTalk(bot);
  bot.talkTimer = setTimeout(() => {
    bot.talkTimer = null;
    if (bot.view?.phase !== phase || (bot.view?.day?.n ?? 0) !== day) return;
    sendChat(bot, text);
    log(`${bot.nickname}: ${label}`);
  }, delayMs);
}

// 로비 채팅 부하: 간격(±30%)마다 입력 중 켜짐 → TYPING_LEAD_MS 뒤 chat + 입력 중 꺼짐. 로비를 떠나면 멈춘다.
function startLoad(bot) {
  if (bot.loadTimer || args.chat === 0) return;
  const tick = () => {
    bot.loadTimer = null;
    if (bot.view?.phase !== "lobby") return;
    sendTyping(bot, true);
    setTimeout(() => {
      if (bot.view?.phase !== "lobby") return;
      const text = LOBBY_LINES[bot.loadIdx++ % LOBBY_LINES.length];
      sendChat(bot, text);
      sendTyping(bot, false);
    }, TYPING_LEAD_MS);
    bot.loadTimer = setTimeout(tick, args.chat * 1000 * (0.7 + Math.random() * 0.6));
  };
  // 봇들이 한꺼번에 시작하지 않게 첫 틱은 한 간격 안에서 흩뜨린다.
  bot.loadTimer = setTimeout(tick, args.chat * 1000 * Math.random());
}

function onState(bot, view) {
  // 탈락한 봇은 아무것도 보내지 않는다(낮 토론, 밤 포함). 서버가 어차피 채널을 탈락자 쪽으로 돌린다.
  const mine = view.players?.find((p) => p.seat === view.me?.seat);
  if (mine && mine.alive === false) {
    stopTalk(bot);
    stopLoad(bot);
    return;
  }
  // 대기실·배정에 있으면(새 판 시작 전, 테스트 방의 대기실 복귀 포함) 낮·밤에 한 번만 행동하는 기록을 비운다 — 새 판 1일차에도 행동한다.
  if (view.phase === "lobby" || view.phase === "assigning") {
    stopTalk(bot);
    bot.tutorialSent = false;
    bot.talkKey = null;
    bot.nightKey = null;
    bot.voteKey = null;
    if (view.phase === "lobby") startLoad(bot);
    else stopLoad(bot);
    return;
  }
  stopLoad(bot);
  // 튜토리얼(17페이즈, 결정 0080-18): 함께 진행 단계에서 소켓 봇도 끝났음({ t: "tutorialDone" })을 한 번 보낸다 — 안 보내면 150초 상한까지 기다린다.
  // 이미 서버가 받은 것(me.tutorialDone)이거나 이 판에서 보냈으면 다시 보내지 않는다. 사람처럼 1~3초 뒤에 보낸다.
  if (view.phase === "tutorial") {
    stopTalk(bot);
    if (view.me?.tutorialDone === true || bot.tutorialSent) return;
    bot.tutorialSent = true;
    setTimeout(() => {
      if (bot.view?.phase !== "tutorial") return;
      sendTo(bot, { t: "tutorialDone" });
      log(`${bot.nickname}: 튜토리얼 끝났음`);
    }, 1000 + Math.random() * 2000);
    return;
  }
  const day = view.day?.n ?? 0;
  if (view.phase === "discussion") {
    // 낮 토론: 낮마다 50% 확률로 고정 문구 한 줄(2~25초 뒤), 그리고 30~60초 뒤 토론 끝내기 한 번(과반이면 지목으로 넘어간다, DAY-03).
    const key = `${day}:discussion`;
    if (bot.talkKey === key) return;
    bot.talkKey = key;
    if (Math.random() < 0.5) sayLater(bot, "discussion", day, pick(CHAT_LINES), 2000 + Math.random() * 23000, "토론 채팅");
    setTimeout(() => {
      if (bot.view?.phase !== "discussion" || (bot.view?.day?.n ?? 0) !== day) return; // 단계가 넘어갔으면 서버가 막을 메시지라 보내지 않는다
      sendTo(bot, { t: "endDiscussion", on: true });
      log(`${bot.nickname}: 토론 끝내기`);
    }, 30000 + Math.random() * 30000);
  } else if (view.phase === "errand") {
    // 심부름(15페이즈, 결정 0074): 소켓 봇은 걷지도 처리하지도 않고 채팅도 보내지 않는다 — 서버가 errand 40초 뒤 토론으로 넘기니 행동 없이 기다리면 막히지 않고 지나간다.
    // (이 단계의 채팅·동작은 서버가 막는 메시지라 보내지 않는다.) 낮 토론 기록은 토론 진입에서 새로 시작한다.
    stopTalk(bot);
  } else if (view.phase === "night") {
    stopTalk(bot);
    // 밤마다 한 번만 고른다(밤 키 = `${일차}:night`). 마피아는 동료가 아닌 살아 있는 사람, 경찰·의사·시민은 살아 있는 아무나(자기 제외).
    // 15페이즈(결정 0074, D-05): 시민도 같은 입력을 보내고 마피아·경찰·의사와 같은 응답을 받는다(서버는 시민의 선택을 저장만 하고 판정에 쓰지 않는다).
    const key = `${day}:night`;
    if (bot.nightKey === key) return;
    bot.nightKey = key;
    const role = view.me?.role;
    if (role !== "mafia" && role !== "police" && role !== "doctor" && role !== "citizen") return;
    const allies = new Set(view.me.allies ?? []);
    const candidates = view.players
      .filter((p) => p.alive !== false && p.seat !== bot.seat && !(role === "mafia" && allies.has(p.seat)))
      .map((p) => p.seat);
    if (role === "doctor" && Math.random() < 0.2) candidates.push(bot.seat); // 의사는 가끔 자신을 보호
    if (candidates.length === 0) return;
    const target = pick(candidates);
    setTimeout(() => { sendTo(bot, { t: "pick", target }); log(`${bot.nickname}: 밤 지목 ${target}`); }, 500 + Math.random() * 3500);
    if (role === "mafia" && Math.random() < 0.6) {
      // 마피아 봇은 가끔 밤 채팅 한 줄(서버가 살아 있는 마피아와 탈락자에게만 보낸다)
      sayLater(bot, "night", day, pick(NIGHT_LINES), 6000 + Math.random() * 6000, "밤 마피아 채팅");
    }
  } else if (view.phase === "nomination" || view.phase === "defense" || view.phase === "verdict") {
    stopTalk(bot);
    if (view.phase === "nomination") {
      const turn = view.day?.turn;
      if (turn === undefined) {
        // 동시 투표(기본판, 결정 0072): 일차·단계 키로 한 번만, 1~3초 뒤(아직 같은 단계면) 자기를 뺀 살아 있는 한 명에게 point. 사람과 같은 메시지라 서버 검증(자기·탈락자 거절)을 그대로 받는다.
        const voteKey = `${day}:nomination`;
        if (bot.voteKey === voteKey) return;
        bot.voteKey = voteKey;
        const others = view.players.filter((p) => p.alive !== false && p.seat !== bot.seat).map((p) => p.seat);
        if (others.length === 0) return;
        const target = pick(others);
        setTimeout(() => {
          if (bot.view?.phase !== "nomination" || bot.view?.day?.n !== view.day?.n) return;
          sendTo(bot, { t: "point", target });
          log(`${bot.nickname}: 투표 ${target}`);
        }, 1000 + Math.random() * 2000);
        return;
      }
      // 순차 지목(결정 0063-1, day.turn 이 있는 방): 자기 차례(지금 차례 좌석이 내 좌석이고 아직 확정 전)일 때만, 차례마다 한 번 1~3초 뒤(아직 같은 차례면) 지목한다. 차례 아닌 지목은 서버가 WRONG_PHASE 로 거절한다.
      if ( turn.i < 0 || turn.i >= turn.order.length || turn.doneAt !== undefined || turn.order[turn.i] !== bot.seat) return;
      const turnKey = `${day}:nomination:${turn.i}`;
      if (bot.voteKey === turnKey) return;
      bot.voteKey = turnKey;
      const candidates = view.players.filter((p) => p.alive !== false && p.seat !== bot.seat).map((p) => p.seat);
      if (candidates.length === 0) return;
      const target = pick(candidates);
      setTimeout(() => {
        const now = bot.view?.day?.turn;
        if (bot.view?.phase !== "nomination" || now?.i !== turn.i || now.doneAt !== undefined) return;
        sendTo(bot, { t: "point", target });
        log(`${bot.nickname}: 지목 ${target}`);
      }, 1000 + Math.random() * 2000);
      return;
    }
    // 낮 처형 구간 나머지 행동은 단계마다 한 번만 보낸다(키 = `${일차}:${단계}`). 사람과 같은 메시지 형식이라 서버 검증을 그대로 받는다.
    const key = `${day}:${view.phase}`;
    if (bot.voteKey === key) return;
    bot.voteKey = key;
    if (view.phase === "verdict") {
      if (view.day?.candidate === bot.seat) return; // 변론자는 자기 처형 찬반에 투표하지 않는다(결정 0053)
      const agree = Math.random() < 0.7;
      setTimeout(() => {
        if (bot.view?.phase !== "verdict") return;
        sendTo(bot, { t: "verdict", agree });
        log(`${bot.nickname}: 찬반 ${agree ? "찬성" : "반대"}`);
      }, 1000 + Math.random() * 5000);
    } else {
      // 변론은 변론자 본인만 한다. 고정 변론 문구 셋 중 하나를 자유 채팅 한 줄로 보낸다.
      if (view.day?.candidate !== bot.seat) return;
      sayLater(bot, "defense", day, pick(DEFENSE_LINES), 1000 + Math.random() * 3000, "변론 채팅");
    }
  } else if (view.phase === "runoff") {
    stopTalk(bot);
    // 동점 결선: 투표 창(step 1)에서 후보가 아닌 봇이 후보 둘 중 하나에게 한 번 던진다(서버는 후보·탈락자의 표를 거절한다).
    const runoff = view.day?.runoff;
    if (runoff === undefined || runoff.step !== 1 || runoff.cand.includes(bot.seat)) return;
    const key = `${day}:runoff`;
    if (bot.voteKey === key) return;
    bot.voteKey = key;
    const target = pick(runoff.cand);
    setTimeout(() => {
      if (bot.view?.phase !== "runoff" || bot.view.day?.runoff?.step !== 1) return;
      sendTo(bot, { t: "point", target });
      log(`${bot.nickname}: 결선 투표 ${target}`);
    }, 500 + Math.random() * 2500);
  } else if (view.phase === "showdown") {
    stopTalk(bot);
    // 마지막 3인 결전: 자기 한마디 차례(day.showdown.order[i] 가 내 좌석이고 아직 확정 전)에 고정 문구 하나를 chat 으로,
    // 동시 지목 창(i 3)에서 자기를 뺀 산 사람 하나를 point 로 한 번씩 보낸다. 같은 차례·창에서만 보낸다(단계가 넘어갔으면 서버가 막을 메시지라 보내지 않는다).
    const sd = view.day?.showdown;
    if (sd === undefined) return;
    if (sd.i >= 0 && sd.i <= 2) {
      if (sd.doneAt !== undefined || sd.order[sd.i] !== bot.seat) return;
      const turnKey = `${day}:showdown:${sd.i}`;
      if (bot.voteKey === turnKey) return;
      bot.voteKey = turnKey;
      const text = pick(LAST_WORD_LINES);
      setTimeout(() => {
        const now = bot.view?.day?.showdown;
        if (bot.view?.phase !== "showdown" || now?.i !== sd.i || now.doneAt !== undefined) return;
        sendChat(bot, text);
        log(`${bot.nickname}: 마지막 한마디`);
      }, 500 + Math.random() * 1500);
    } else if (sd.i === 3) {
      const key = `${day}:showdown:point`;
      if (bot.voteKey === key) return;
      bot.voteKey = key;
      const candidates = view.players.filter((p) => p.alive !== false && p.seat !== bot.seat).map((p) => p.seat);
      if (candidates.length === 0) return;
      const target = pick(candidates);
      setTimeout(() => {
        if (bot.view?.phase !== "showdown" || bot.view.day?.showdown?.i !== 3) return;
        sendTo(bot, { t: "point", target });
        log(`${bot.nickname}: 결전 지목 ${target}`);
      }, 500 + Math.random() * 2500);
    }
  } else {
    // 처형·종료(ended) 등 그 밖의 단계: 행동 없이 대기 중인 채팅만 정리한다.
    stopTalk(bot);
  }
}

process.on("SIGINT", () => {
  for (const b of bots) {
    b.leaving = true;
    stopTalk(b);
    stopLoad(b);
    try { b.ws.send(JSON.stringify({ t: "leave" })); b.ws.close(); } catch { /* 이미 닫힘 */ }
  }
  setTimeout(() => process.exit(0), 500);
});

for (let i = 0; i < args.count; i++) await addBot(NAMES[i]);
console.log(`봇 ${bots.length}명이 방 ${args.code} 에 있습니다. 브라우저에서 시작하세요.${args.chat > 0 ? ` 로비 채팅 부하: 봇마다 약 ${args.chat}초 간격.` : ""} 끝내려면 Ctrl+C.`);
