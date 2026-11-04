// 스모크: 배포(또는 로컬) 주소에서 방 만들기 → WebSocket hello → 대기실 상태까지 확인한다.
// full 단계는 한 판을 끝까지 돈다(8페이즈 낮 흐름, 결정 0060): 로비 채팅 한 줄 → 낮 시작 발표 → 낮 토론(자유 채팅, 결정 0058)
// → 과반이 토론 끝내기(DAY-03) → 순차 지목(DAY-04, 결정 0063-1: 모이기 3초 → 산 사람 좌석 순서로 한 명씩 8초 차례, 차례 주인만 지목하고 차례 아닌 지목은 WRONG_PHASE,
//   한 명에게 몰아 줌, 줄은 모두에게 같음, 확정 뒤 0.9초 사이, 마지막 뒤 2초 끝 알림) → 변론 20초(DAY-05)
// → 찬반 10초(DAY-06: 변론자는 못 던짐, 값 변경은 본인에게만) → 처형 5초(DAY-07: 수만 공개, 역할 키 없음) → 밤 30초(역할별 행동·마피아 채널 채팅)
// → 아침 5초(탈락 발표·탈락자 채널 채팅) → 승패가 날 때까지 다음 낮을 같은 방식으로 돌아 ended 에서 끝난다.
// 첫 낮은 마피아가 아닌 시민 한 명을 처형하고 그날 밤 다른 시민이 암살당한다. 마피아가 남아 있는 날은 마피아 한 명을 처형해 판을 끝낸다.
// 자유 채팅 규칙(CHAT-01·02·03·05·06): 낮 토론의 산 사람 줄은 모두에게 ch all 로 seq 틈 없이 가고 보낸 사람에게도 돌아온다.
// 600ms 안 두 번째 전송은 보낸 클라이언트에만 chatReject{rate} 가 가고 다른 클라이언트에는 아무것도 가지 않는다.
// 밤 마피아 줄·입력 중은 마피아에게만 가고 시민 편 클라이언트는 chat·typing 프레임이 0건이다. 탈락자 줄은 탈락자에게만 간다.
// 재접속한 클라이언트는 hello 직후 chatLog 로 자기가 받을 수 있던 줄만 돌려받는다. 순차 직업 주장 단계는 없다(7페이즈, CHAT-06).
// 누설 확인: 찬반 중 다른 소켓 프레임에 남의 찬반 값이 없고, 처형 view 에 역할 키가 없다. 지목 0표·동률·부결·변론자 거부 같은 경계는 uat-vote.mjs 가 돈다.
// 탈락한 클라이언트는 그 단계부터 관전 정보(spectate)를 받는다(결정 0021).
// 방장 연장·넘기기는 없다(결정 0017-5).
// Node 22.12+ 내장 fetch·전역 WebSocket 만 쓴다. 셸 명령·외부 패키지 없음 (Windows 에서도 같은 명령).
//
// 사용법:
//   node scripts/smoke.mjs <기준 주소>           예: http://localhost:5173
//   node scripts/smoke.mjs --prod                 같은 폴더의 prod-url.txt 주소
//   옵션: --stage create (기본값) | full | --print-version
//         --players N (full 단계 인원, 4~8, 기본 5)
//         --previous-version V (full 단계: /api/health 의 version 이 V 와 같으면 실패 — 재배포 확인)
// 토큰 값은 어떤 출력에도 찍지 않는다. 채팅 본문도 출력하지 않는다.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { exitIfV1 } from "./deploy-target.mjs";

const TOTAL_LIMIT_MS = 30_000;
const STATE_LIMIT_MS = 10_000;
const FULL_TOTAL_LIMIT_MS = 720_000; // 시작 → ended. 낮 하루(과반 토론 끝내기 → 순차 지목 최악 3 + 산 사람 수 × 8.9 + 2 (스크립트는 차례마다 곧바로 지목해 약 10초) + 변론 20 + 찬반 10 + 처형 5 + 밤 30 + 아침 5~15 초) 최대 3일 + 여유
// 낮 단계 길이(shared/game/phases.ts 와 같은 값, 결정 0060-1). 스크립트는 TS 를 import 하지 않는다.
const DISCUSSION_MS = 90_000;
// 순차 지목(결정 0063-1): 모이기 → 차례마다 (8초 + 확정 뒤 0.9초 사이) → 끝 알림. nominationMaxMs 는 shared/game/phases.ts 와 같은 공식이다.
const NOMINATION_GATHER_MS = 3_000;
const PICK_TURN_MS = 8_000;
const PICK_GAP_MS = 900;
const NOMINATION_END_MS = 2_000;
const nominationMaxMs = (turns) => NOMINATION_GATHER_MS + turns * (PICK_TURN_MS + PICK_GAP_MS) + NOMINATION_END_MS;
const DEFENSE_MS = 20_000;
const VERDICT_MS = 10_000;
// shared/game/phases.ts 의 EXECUTION_MS = 5_000 + VERDICT_LEAD_MS(600) 사본 — 처형 발표 5초 + 판결 앞머리 0.6초(결정 0066-7). 스크립트는 TS 를 import 하지 않아 값을 옮겨 적는다.
const EXECUTION_MS = 5_600;
// 각 단계 + 여유: 서버 타이머가 다음 단계로 넘기는 것을 기다린다(넘기기 없음).
const DEFENSE_WAIT_MS = DEFENSE_MS + STATE_LIMIT_MS;
const VERDICT_WAIT_MS = VERDICT_MS + STATE_LIMIT_MS;
const EXECUTION_WAIT_MS = EXECUTION_MS + STATE_LIMIT_MS;
// 아침 문구 번호·문구 수 상수는 없다(결정 0061-17: 서버가 phrase 를 채우지 않는다).
// 밤 30초, 아침은 최대 길이 15초 + 여유. MORNING_MAX_MS 는 shared/game/phases.ts 의 사본이다(결정 0061-13: 기본 5 + 피해자 2 + 유언 2 + 쪽지 2, 상한 15초).
const NIGHT_WAIT_MS = 30_000 + STATE_LIMIT_MS;
const MORNING_MAX_MS = 15_000;
const MORNING_WAIT_MS = 15_000 + STATE_LIMIT_MS;
// 자유 채팅 와이어(shared/protocol.ts ChatLineWire·TypingFrame·ChatLogFrame·ChatRejectFrame): 이 키 밖은 어떤 프레임에도 없다(CHAT-06).
// 채널 필드는 서버 → 클라이언트에만 있고(ch), id·역할·토큰·수신자 마스크는 싣지 않는다(결정 0002·0058).
const CHAT_LINE_KEYS = ["at", "ch", "seat", "seq", "t", "text"];
const CHAT_LOG_KEYS = ["lines", "t"];
const CHAT_LOG_LINE_KEYS = ["at", "ch", "seat", "seq", "text"];
const TYPING_KEYS = ["on", "seat", "t"];
const CHAT_REJECT_KEYS = ["t", "why"];
// D5(shared/game/chatRules.ts)의 최소 전송 간격 600ms. 스크립트는 TS 를 import 하지 않는다.
const CHAT_MIN_GAP_MS = 600;
const ALLOWED_PLAYER_KEYS = ["alive", "connected", "isHost", "nickname", "seat"];
const PREVIEW_PLAYER_KEYS = ["nickname", "seat"];
const DAY_SPREAD_LIMIT_MS = 500;
// shared/game/roles.ts 의 ROLE_TABLE 과 같은 값 (마피아·경찰·의사·시민)
const EXPECTED_ROLES = {
  4: { mafia: 1, police: 1, doctor: 0, citizen: 2 },
  5: { mafia: 1, police: 1, doctor: 1, citizen: 2 },
  6: { mafia: 2, police: 1, doctor: 1, citizen: 2 },
  7: { mafia: 2, police: 1, doctor: 1, citizen: 3 },
  8: { mafia: 2, police: 1, doctor: 1, citizen: 4 },
};
// 허용 전이 표(shared/game/phases.ts 의 next + tick 분기와 같다). 분기형이라 값이 배열이다(결정 0060-1):
// discussion → nomination → (최다 한 명) defense → verdict → execution → night | ended,
// 지목 0표·동률은 곧장 night, night → morning → dayAnnounce(다음 낮) | ended. 승패가 나지 않는 한 낮 루프라 끝이 없다.
const PHASE_NEXT = {
  lobby: ["assigning"],
  assigning: ["roleReveal"],
  roleReveal: ["dayAnnounce"],
  dayAnnounce: ["discussion"],
  discussion: ["nomination"],
  nomination: ["defense", "night"],
  defense: ["verdict"],
  verdict: ["execution"],
  execution: ["night", "ended"],
  night: ["morning"],
  morning: ["dayAnnounce", "ended"],
  ended: [],
};
const DAY_PHASES = ["dayAnnounce", "discussion", "nomination", "defense", "verdict", "execution", "night", "morning", "ended"];
const ROLE_IDS = ["mafia", "police", "doctor", "citizen"];
// 직업 이름 문자열이 나와도 되는 경로(배열 칸은 [] 로 줄여 비교한다). 채널 이름 mafia 가 든 ch·me.chat 은 채널 검사가 따로 본다.
// 탈락자의 view.spectate.seats[].job 은 탈락 뒤 프레임에서만 따로 허용한다.
const ALLOWED_ROLE_STRING_PATHS = new Set(["view.me.role", "view.day.roles[]", "ch", "lines[].ch", "view.me.chat"]);
// ended 프레임의 판 결과(모든 사람의 직업, D-17)는 ended 단계에서만 허용한다.
const ENDED_ROLE_STRING_PATHS = new Set(["view.result.seats[].job"]);
// 서버 전용 상태 키(결정 0027-3): 어떤 프레임에도 이름이 나오면 안 된다. 옛 직업 주장 키(claim*·turn·claimLog)는 7페이즈에서 없어졌으니 다시 나오면 회귀다.
// 옛 이름이 scripts 에 문자열로 남지 않았는지 grep 으로 확인하므로 옛 완료 표시 키는 조각으로 잇는다.
// 4페이즈 서버 전용 키(결정 0036-12): 개인 투표·판정·밤 기록·직전 처형 문구. winner·execution 은 같은 이름의 view 키(result.winner·day.execution)가 있어 넣지 않는다.
// 7페이즈: 채팅 도배 기록·입력 중 중계 기록·줄 저장 레코드의 마스크(r)·쓰기 순번(g)은 서버 안에만 있다.
// 9페이즈(결정 0061): 마피아 쪽지 한 줄(nightNote)은 서버 안에만 있고 아침 chat 카드(k:"note")로만 나온다.
// 8페이즈(결정 0060): 개인 지목(nominate)·토론 끝내기(endVote)·찬반 값(verdictVote)과 판정(verdict)은 서버 안에만 있다.
const SERVER_ONLY_KEYS = ["claimPick", "claimOrder", "claimIdx", "claimStart", "claim" + "Done", "claims", "claimLog", "turn", "pickTurn", "nominate", "endVote", "verdictVote", "verdict", "nightLog", "lastExecPhrase", "chatRates", "typingRelays", "nextSeq", "nightNote"];
// 같은 이름의 공개 와이어 경로(이 밖의 경로에 이름이 나오면 실패): 처형 단계의 찬반 수 day.verdict, 본인에게만 가는 me.verdictVote.
// turn: 순차 지목의 공개 차례 정보 view.day.turn(결정 0063-1) 하나만 허용한다. 옛 직업 주장의 turn 이나 서버 전용 pickTurn 은 어디에도 없다.
const PUBLIC_KEY_PATHS = { verdict: ["view.day.verdict"], verdictVote: ["view.me.verdictVote"], turn: ["view.day.turn"] };
// 역할별 일지 줄의 키 집합(결정 0027-11)
const RECORD_KEYS = { police: "isMafia,n,target", mafia: "died,n,target", doctor: "n,target" };
// 거절된 줄의 본문 표식: 어느 클라이언트의 어떤 프레임에도 되돌아오면 안 된다(COMM-04).
const REJECT_MARKER = "SMOKE_REJECT_MARKER_7f3a";

function fail(reason) {
  console.log(`SMOKE FAIL: ${reason}`);
  process.exit(1);
}

const info = (text) => console.log(`  info: ${text}`);

function usage(reason) {
  console.log(`사용법 오류: ${reason}`);
  console.log("node scripts/smoke.mjs [<주소> | --prod] [--stage create|full] [--players 4~8] [--previous-version V] [--print-version]");
  process.exit(2);
}

function parseArgs(argv) {
  const args = { base: null, prod: false, stage: "create", printVersion: false, players: 5, previousVersion: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--prod") args.prod = true;
    else if (a === "--print-version") args.printVersion = true;
    else if (a === "--stage") args.stage = argv[++i] ?? "";
    else if (a === "--players") {
      const raw = argv[++i] ?? "";
      if (!/^\d+$/.test(raw) || Number(raw) < 4 || Number(raw) > 8) usage(`--players 는 4~8 정수여야 함: ${raw}`);
      args.players = Number(raw);
    } else if (a === "--previous-version") {
      args.previousVersion = argv[++i] ?? "";
      if (args.previousVersion === "") usage("--previous-version 값이 비어 있음");
    }
    else if (!a.startsWith("--") && args.base === null) args.base = a;
    else fail(`알 수 없는 인자: ${a}`);
  }
  return args;
}

function resolveBase(args) {
  let base = args.base;
  if (args.prod) {
    const file = fileURLToPath(new URL("./prod-url.txt", import.meta.url));
    base = readFileSync(file, "utf8").trim();
  }
  base = (base ?? "http://localhost:5173").replace(/\/+$/, "");
  let url;
  try {
    url = new URL(base);
  } catch {
    return fail(`주소를 읽을 수 없음: ${base}`);
  }
  exitIfV1(url.origin); // v1.0 주소는 요청 전에 거부(DEPLOY-02)
  return url;
}

async function getVersion(origin) {
  const res = await fetch(`${origin}/api/health`);
  if (res.status !== 200) fail(`/api/health 상태 ${res.status}`);
  const body = await res.json();
  if (body.ok !== true) fail("/api/health 의 ok 가 true 가 아님");
  return String(body.version);
}

function waitFirstState(wsUrl, token) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timer = setTimeout(() => {
      try { ws.close(); } catch { /* 이미 닫힘 */ }
      reject(new Error(`${STATE_LIMIT_MS / 1000}초 안에 state 프레임이 오지 않음`));
    }, STATE_LIMIT_MS);
    ws.addEventListener("open", () => ws.send(JSON.stringify({ t: "hello", token })));
    ws.addEventListener("message", (ev) => {
      const raw = typeof ev.data === "string" ? ev.data : String(ev.data);
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }
      if (msg.t !== "state") return;
      clearTimeout(timer);
      ws.close();
      resolve({ msg, raw });
    });
    ws.addEventListener("close", (ev) => {
      clearTimeout(timer);
      reject(new Error(`state 를 받기 전에 소켓이 닫힘 (code ${ev.code})`));
    });
    ws.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error("WebSocket 연결 오류"));
    });
  });
}

async function stageCreate(url) {
  const origin = url.origin;
  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";

  // (1) 정적 화면
  const root = await fetch(`${origin}/`);
  if (root.status !== 200) fail(`GET / 상태 ${root.status}`);
  if (!(root.headers.get("content-type") ?? "").includes("text/html")) fail("GET / 가 text/html 이 아님");
  if (!(await root.text()).includes('id="root"')) fail('GET / 본문에 id="root" 가 없음');

  // (2) SPA 폴백
  const spa = await fetch(`${origin}/r/0000`);
  if (spa.status !== 200) fail(`GET /r/0000 상태 ${spa.status}`);
  if (!(spa.headers.get("content-type") ?? "").includes("text/html")) fail("GET /r/0000 이 text/html 이 아님");

  // (3) health
  const version = await getVersion(origin);
  if (!isLocal && version === "dev") fail('배포본 version 이 "dev" 임');

  // (4) 방 만들기
  const created = await fetch(`${origin}/api/rooms`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ nickname: "스모크" }),
  });
  if (created.status !== 201) fail(`POST /api/rooms 상태 ${created.status}`);
  const { code, token } = await created.json();
  if (!/^\d{4}$/.test(String(code))) fail("방 코드가 4자리 숫자가 아님");
  if (typeof token !== "string" || token.length === 0) fail("token 이 문자열이 아님");

  // (5) WebSocket hello → 첫 state
  const wsUrl = `${url.protocol === "https:" ? "wss:" : "ws:"}//${url.host}/api/rooms/${code}/ws`;
  let result;
  try {
    result = await waitFirstState(wsUrl, token);
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
  const view = result.msg.view;
  if (!view) fail("state 프레임에 view 가 없음");
  if (view.phase !== "lobby") fail(`phase 가 lobby 가 아님: ${view.phase}`);
  if (!Array.isArray(view.players) || view.players.length !== 1) fail("players 길이가 1 이 아님");
  const p = view.players[0];
  if (p.nickname !== "스모크") fail("players[0].nickname 이 스모크가 아님");
  if (p.isHost !== true) fail("players[0].isHost 가 true 가 아님");
  const keys = Object.keys(p).sort();
  if (keys.join(",") !== ALLOWED_PLAYER_KEYS.join(",")) fail(`players[0] 키 집합이 다름: ${keys.join(",")}`);
  if (result.raw.includes(token)) fail("state 프레임 원문에 token 이 들어 있음");

  console.log(`SMOKE OK create code=${code} version=${version}`);
}

// ---- full 단계: 다인원 한 판 ----
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitUntil(pred, ms, label) {
  const start = performance.now();
  while (!pred()) {
    if (performance.now() - start > ms) fail(`${label} (${ms / 1000}초 제한 초과)`);
    await sleep(20);
  }
}

// 클라이언트 한 명: 토큰·자리·받은 프레임(도착 시각 포함)을 모은다. 토큰은 출력하지 않는다.
function newClient(nickname) {
  return { nickname, token: "", seat: -1, frames: [], ws: null, expectClose: false, unexpectedClose: null, sockets: 0 };
}

function openSocket(wsBase, code, client) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${wsBase}/api/rooms/${code}/ws`);
    const id = ++client.sockets;
    let opened = false;
    ws.addEventListener("open", () => {
      opened = true;
      client.ws = ws;
      ws.send(JSON.stringify({ t: "hello", token: client.token }));
    });
    ws.addEventListener("message", (ev) => {
      const raw = typeof ev.data === "string" ? ev.data : String(ev.data);
      let msg = null;
      try { msg = JSON.parse(raw); } catch { /* 형식 검사는 뒤에서 */ }
      client.frames.push({ at: performance.now(), raw, msg, sock: id });
      if (msg && msg.t === "state") resolve();
    });
    ws.addEventListener("close", (ev) => {
      if (!client.expectClose && client.ws === ws) client.unexpectedClose = ev.code;
      if (!opened) reject(new Error(`${client.nickname} 소켓이 열리기 전에 닫힘 (code ${ev.code})`));
    });
    ws.addEventListener("error", () => { if (!opened) reject(new Error(`${client.nickname} WebSocket 연결 오류`)); });
  });
}

function closeSocket(client) {
  return new Promise((resolve) => {
    const ws = client.ws;
    if (!ws || ws.readyState === WebSocket.CLOSED) return resolve();
    client.expectClose = true;
    ws.addEventListener("close", () => resolve());
    ws.close();
    setTimeout(resolve, 2000);
  });
}

const states = (c) => c.frames.filter((f) => f.msg && f.msg.t === "state");
const lastView = (c) => states(c).at(-1)?.msg.view ?? null;

// 객체를 깊이 훑어 키가 role 인 경로를 모은다.
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

// 값이 직업 이름 문자열인 잎을 경로와 함께 모은다. 배열 인덱스는 [] 로 줄인다.
function collectRoleStringPaths(value, path, out) {
  if (typeof value === "string") {
    if (ROLE_IDS.includes(value)) out.push({ path, value });
  } else if (Array.isArray(value)) value.forEach((v) => collectRoleStringPaths(v, `${path}[]`, out));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) collectRoleStringPaths(v, path ? `${path}.${k}` : k, out);
  }
}

const sortedKeys = (o) => Object.keys(o).sort().join(",");
// 서버가 만든 사망 카드 줄(유언)만 k 키를 더 싣는다(결정 0061-11). 일반 대화 줄에는 k 가 없어야 한다.
const lineKeys = (line, base) => [...base, ...(line.k === "will" ? ["k"] : [])].sort().join(",");
// 클라이언트가 지금 보는 단계 키 '일차:단계'(shared/game/audience.ts phaseKey 와 같은 모양). 로비는 day 가 없어 0.
const pkOf = (c) => {
  const v = lastView(c);
  return `${v?.day?.n ?? 0}:${v?.phase}`;
};
const sendChat = (c, text) => c.ws.send(JSON.stringify({ t: "chat", text, pk: pkOf(c) }));
const sendTyping = (c, on) => c.ws.send(JSON.stringify({ t: "typing", on, pk: pkOf(c) }));
// 받은 chat 줄(실시간) / typing / chatReject 프레임. from 은 performance.now 기준 시각 아래쪽 경계.
const chatsOf = (c, from = 0) => c.frames.filter((f) => f.at >= from && f.msg?.t === "chat");
const typingsOf = (c, from = 0) => c.frames.filter((f) => f.at >= from && f.msg?.t === "typing");
const rejectsOf = (c, from = 0) => c.frames.filter((f) => f.at >= from && f.msg?.t === "chatReject");
const hasLine = (c, from, ch, seat, text) => chatsOf(c, from).some((f) => f.msg.ch === ch && f.msg.seat === seat && f.msg.text === text);

// 요청을 보내 error 프레임이 오고 그 코드가 기대와 같은지 본다.
// withState 이면 거부 뒤에 최신 state 가 이어서 온다는 것(결정 0027-4)도 본다.
async function expectError(client, msg, code, label, withState = false) {
  const before = client.frames.length;
  client.ws.send(JSON.stringify(msg));
  await waitUntil(() => client.frames.slice(before).some((f) => f.msg?.t === "error"), STATE_LIMIT_MS, `${label} 의 error 프레임이 오지 않음`);
  const errIdx = before + client.frames.slice(before).findIndex((f) => f.msg?.t === "error");
  const err = client.frames[errIdx];
  if (err.msg.code !== code) fail(`${label} 의 error 가 ${code} 가 아님: ${err.msg.code}`);
  if (withState) {
    await waitUntil(() => client.frames.slice(errIdx + 1).some((f) => f.msg?.t === "state"), STATE_LIMIT_MS, `${label} 거부 뒤 state 가 이어서 오지 않음`);
  }
}

const firstState = (c, phase, pred = () => true) => states(c).find((f) => f.msg.view.phase === phase && pred(f.msg.view));

async function stageFull(url, args) {
  const origin = url.origin;
  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  const N = args.players;
  const wsBase = `${url.protocol === "https:" ? "wss:" : "ws:"}//${url.host}`;
  const httpLog = []; // { owner: 클라이언트 인덱스 또는 null, raw }
  const json = { "content-type": "application/json" };

  async function http(owner, method, path, body) {
    const res = await fetch(`${origin}${path}`, { method, headers: json, body: body === undefined ? undefined : JSON.stringify(body) });
    const raw = await res.text();
    httpLog.push({ owner, raw });
    let data = null;
    try { data = JSON.parse(raw); } catch { /* 본문이 JSON 이 아님 */ }
    return { status: res.status, data };
  }

  // (1) 정적 화면·SPA·health
  const root = await fetch(`${origin}/`);
  if (root.status !== 200) fail(`GET / 상태 ${root.status}`);
  if (!(await root.text()).includes('id="root"')) fail('GET / 본문에 id="root" 가 없음');
  const spa = await fetch(`${origin}/r/0000`);
  if (spa.status !== 200) fail(`GET /r/0000 상태 ${spa.status}`);
  const version = await getVersion(origin);
  if (!isLocal && version === "dev") fail('배포본 version 이 "dev" 임');
  if (args.previousVersion !== null && version === args.previousVersion) {
    fail(`배포 뒤에도 version 이 이전과 같음 (${version}) — 새로 배포되지 않았거나 version 이 바뀌지 않음`);
  }

  // (2) 방장 "스모크1" 로 방 만들기 → 미리보기
  const clients = [];
  for (let i = 1; i <= N; i++) clients.push(newClient(`스모크${i}`));
  const host = clients[0];
  const created = await http(0, "POST", "/api/rooms", { nickname: host.nickname });
  if (created.status !== 201) fail(`POST /api/rooms 상태 ${created.status}`);
  const code = String(created.data?.code);
  if (!/^\d{4}$/.test(code)) fail("방 코드가 4자리 숫자가 아님");
  host.token = created.data.token;
  host.seat = created.data.seat;
  if (typeof host.token !== "string" || host.token.length === 0) fail("방장 token 이 문자열이 아님");

  const pv1 = await http(null, "GET", `/api/rooms/${code}`);
  if (pv1.status !== 200) fail(`GET /api/rooms/{code} 상태 ${pv1.status}`);
  const p1 = pv1.data;
  if (p1.hostNickname !== host.nickname) fail(`미리보기 hostNickname 이 다름: ${p1.hostNickname}`);
  if (p1.playerCount !== 1) fail(`미리보기 playerCount 가 1 이 아님: ${p1.playerCount}`);
  if (p1.phase !== "lobby") fail(`미리보기 phase 가 lobby 가 아님: ${p1.phase}`);
  if (!Array.isArray(p1.players) || p1.players.length !== 1 || p1.players[0].seat !== 0 || p1.players[0].nickname !== host.nickname) {
    fail("미리보기 players 가 [{seat:0, nickname:스모크1}] 이 아님");
  }
  for (const pl of p1.players) {
    if (Object.keys(pl).sort().join(",") !== PREVIEW_PLAYER_KEYS.join(",")) fail(`미리보기 players 키 집합이 다름: ${Object.keys(pl).sort().join(",")}`);
  }

  // (3) 나머지 N-1명 참가 + 같은 이름 409
  for (let i = 1; i < N; i++) {
    if (i === N - 1) {
      // 마지막 한 자리가 남은 상태에서 확인한다 (가득 찬 방은 이름보다 ROOM_FULL 이 먼저다)
      const dup = await http(null, "POST", `/api/rooms/${code}/join`, { nickname: clients[1].nickname });
      if (dup.status !== 409 || dup.data?.error !== "NICKNAME_TAKEN") fail(`같은 이름 참가가 409 NICKNAME_TAKEN 이 아님: ${dup.status} ${dup.data?.error}`);
    }
    const j = await http(i, "POST", `/api/rooms/${code}/join`, { nickname: clients[i].nickname });
    if (j.status !== 200 && j.status !== 201) fail(`${clients[i].nickname} 참가 상태 ${j.status}`);
    clients[i].token = j.data.token;
    clients[i].seat = j.data.seat;
    if (typeof clients[i].token !== "string" || clients[i].token.length === 0) fail("참가자 token 이 문자열이 아님");
  }
  const pvAll = await http(null, "GET", `/api/rooms/${code}`);
  if (pvAll.data?.playerCount !== N || pvAll.data?.players?.length !== N) fail(`참가 뒤 미리보기 인원이 ${N} 이 아님`);

  // (4) 연결 3명(방장 + 2명)일 때 start 는 거절
  for (let i = 0; i < 3; i++) await openSocket(wsBase, code, clients[i]);
  const errCountBefore = host.frames.filter((f) => f.msg?.t === "error").length;
  host.ws.send(JSON.stringify({ t: "start" }));
  await waitUntil(() => host.frames.filter((f) => f.msg?.t === "error").length > errCountBefore, STATE_LIMIT_MS, "연결 3명 start 의 error 프레임이 오지 않음");
  const errFrameIdx = host.frames.findIndex((f) => f.msg?.t === "error");
  const errFrame = host.frames[errFrameIdx];
  if (errFrame.msg.code !== "NOT_ENOUGH_PLAYERS") fail(`연결 3명 start 의 error 가 NOT_ENOUGH_PLAYERS 가 아님: ${errFrame.msg.code}`);
  await waitUntil(() => host.frames.slice(errFrameIdx + 1).some((f) => f.msg?.t === "state"), STATE_LIMIT_MS, "NOT_ENOUGH_PLAYERS 뒤 state 재전송이 오지 않음");
  const resent = host.frames.slice(errFrameIdx + 1).find((f) => f.msg?.t === "state").msg.view;
  if (resent.phase !== "lobby") fail(`NOT_ENOUGH_PLAYERS 뒤 state 의 phase 가 lobby 가 아님: ${resent.phase}`);

  // (5) 나머지 소켓도 hello → (6) 모두 connected true
  for (let i = 3; i < N; i++) await openSocket(wsBase, code, clients[i]);
  await waitUntil(() => {
    const v = lastView(host);
    return v && v.players.length === N && v.players.every((p) => p.connected === true);
  }, STATE_LIMIT_MS, `${N}명이 모두 connected 가 되지 않음`);

  // (6b) 로비 채팅(CHAT-01): 방장 한 줄이 연결된 모두에게 ch all 로 가고 보낸 사람에게도 돌아온다. 아래 seq 연속·재접속 복원 비교의 첫 줄이다.
  const LOBBY_TEXT = "로비 스모크 한 줄";
  const lobbyAt = performance.now();
  sendChat(host, LOBBY_TEXT);
  await waitUntil(() => clients.every((c) => hasLine(c, lobbyAt, "all", host.seat, LOBBY_TEXT)), STATE_LIMIT_MS, "로비 채팅 줄이 모든 클라이언트(보낸 사람 포함)에 오지 않음");

  // 도착 확인용 도우미들. 거절은 클라이언트별로 기대 목록에 쌓아 두고 맨 끝에서 실제 chatReject 프레임과 맞춘다(보낸 쪽에만 가야 한다).
  const expectedRejects = clients.map(() => []);
  const knownLines = (c) => {
    // 이 클라이언트가 실시간 chat 프레임이나 지난 chatLog 로 받은 줄을 채널별 최근 30줄만(서버 복원 상한과 같은 규칙, 결정 0058-3)
    const byKey = new Map();
    for (const f of c.frames) {
      if (f.msg?.t === "chat") byKey.set(`${f.msg.ch}/${f.msg.seq}`, f.msg);
      if (f.msg?.t === "chatLog") for (const l of f.msg.lines) byKey.set(`${l.ch}/${l.seq}`, l);
    }
    const out = [];
    for (const ch of ["all", "mafia", "ghost"]) {
      const mine = [...byKey.values()].filter((l) => l.ch === ch).sort((a, b) => a.seq - b.seq);
      out.push(...mine.slice(-30));
    }
    return out.map((l) => `${l.ch}/${l.seq}/${l.seat}/${l.text}/${l.at}`).sort();
  };
  // 닫고 같은 토큰으로 다시 붙어 hello 직후 chatLog 를 받는다. 돌아온 줄은 그 클라이언트가 이미 받았던 줄과 정확히 같아야 한다(더 넓어지지 않는다, T-07-35).
  async function reconnectAndReplay(c, label) {
    const expected = knownLines(c);
    await closeSocket(c);
    c.expectClose = false;
    c.unexpectedClose = null;
    await openSocket(wsBase, code, c);
    const sockId = c.sockets;
    await waitUntil(() => c.frames.some((f) => f.sock === sockId && f.msg?.t === "chatLog"), STATE_LIMIT_MS, `${label} 재접속 뒤 hello 직후 chatLog 가 오지 않음`);
    const lines = c.frames.find((f) => f.sock === sockId && f.msg?.t === "chatLog").msg.lines;
    const got = lines.map((l) => `${l.ch}/${l.seq}/${l.seat}/${l.text}/${l.at}`).sort();
    if (got.join("|") !== expected.join("|")) fail(`${label} 재접속 chatLog 의 줄이 그 클라이언트가 받았던 줄과 다름 (복원 ${got.length}줄 / 받았던 ${expected.length}줄)`);
    return lines;
  }
  // 막힘 확인: 보낸 클라이언트에만 chatReject{why} 가 온다. phase 거절은 이어서 최신 state 가 온다.
  async function expectReject(c, text, why, label) {
    const at = performance.now();
    sendChat(c, text);
    await waitUntil(() => rejectsOf(c, at).length > 0, STATE_LIMIT_MS, `${label} 의 chatReject 가 오지 않음`);
    const got = rejectsOf(c, at)[0];
    if (got.msg.why !== why) fail(`${label} 의 chatReject 이유가 ${why} 가 아님: ${got.msg.why}`);
    if (why === "phase") await waitUntil(() => states(c).some((f) => f.at > got.at), STATE_LIMIT_MS, `${label} 거절 뒤 state 가 이어서 오지 않음`);
    expectedRejects[clients.indexOf(c)].push(why);
  }

  // (7) 시작
  host.ws.send(JSON.stringify({ t: "start" }));

  // (8) 두 번째 클라이언트: roleReveal 에서 소켓을 닫고 같은 토큰으로 다시 붙음 — hello 직후 chatLog 로 로비 줄이 돌아온다
  const re = clients[1];
  await waitUntil(() => states(re).some((f) => f.msg.view.phase === "roleReveal"), STATE_LIMIT_MS + 5000, "스모크2 가 roleReveal 을 받지 못함");
  const before = states(re).filter((f) => f.msg.view.phase === "roleReveal").at(-1).msg.view.me;
  if (before.role === undefined) fail("스모크2 의 roleReveal state 에 me.role 이 없음");
  const framesBefore = re.frames.length;
  const reLines = await reconnectAndReplay(re, "스모크2");
  if (reLines.length !== 1 || reLines[0].text !== LOBBY_TEXT || reLines[0].ch !== "all") fail("스모크2 재접속 chatLog 가 로비 줄 하나(ch all)가 아님");
  const afterFirst = re.frames.slice(framesBefore).find((f) => f.msg?.t === "state").msg.view;
  if (afterFirst.me.seat !== before.seat) fail(`재접속 뒤 seat 가 다름: ${before.seat} → ${afterFirst.me.seat}`);
  if (afterFirst.me.role !== before.role) fail("재접속 뒤 역할이 끊기 전과 다름");

  // (9) 낮 시작 발표 — 모든 클라이언트가 day.n 1 을 받는다
  await waitUntil(() => clients.every((c) => firstState(c, "dayAnnounce")), 30_000, "모든 클라이언트가 dayAnnounce 를 받지 못함");
  for (const c of clients) {
    const ann = firstState(c, "dayAnnounce").msg.view;
    if (ann.day?.n !== 1) fail(`${c.nickname} 의 첫 dayAnnounce 의 day.n 이 1 이 아님: ${ann.day?.n}`);
    if (c.unexpectedClose !== null) fail(`${c.nickname} 소켓이 예상 밖으로 닫힘 (code ${c.unexpectedClose})`);
  }

  // (10) 낮 토론 진입 — 주장 단계 없이 낮 시작 발표 다음이 곧장 자유 채팅 토론이다(CHAT-06). 직업 목록(day.roles)은 모두 같다.
  await waitUntil(() => clients.every((c) => firstState(c, "discussion")), STATE_LIMIT_MS + 5000, "모든 클라이언트가 dayAnnounce 다음에 discussion 을 받지 못함");
  const roleList = firstState(clients[1], "discussion").msg.view.day.roles;
  if (roleList.includes("doctor") !== (N >= 5)) fail(`day.roles 의 의사 포함 여부가 인원(${N})과 맞지 않음: ${roleList.join(",")}`);
  if (roleList.length < 3) fail(`day.roles 가 너무 짧음: ${roleList.join(",")}`);

  // (11) 낮 중 참가는 409 GAME_STARTED, 미리보기는 낮 단계 + players 빈 배열
  const late = await http(null, "POST", `/api/rooms/${code}/join`, { nickname: "늦은사람" });
  if (late.status !== 409 || late.data?.error !== "GAME_STARTED") fail(`시작 뒤 참가가 409 GAME_STARTED 가 아님: ${late.status} ${late.data?.error}`);
  const pvDay = await http(null, "GET", `/api/rooms/${code}`);
  if (!DAY_PHASES.includes(pvDay.data?.phase)) fail(`낮 미리보기 phase 가 낮 단계 중 하나가 아님: ${pvDay.data?.phase}`);
  if (!Array.isArray(pvDay.data?.players) || pvDay.data.players.length !== 0) fail("낮 미리보기 players 가 빈 배열이 아님");

  // (13) 낮 토론: 자유 채팅(CHAT-01·02·05)·입력 중·연장/넘기기 거부·타이머로 다음 단계
  const discEnds = new Set(clients.map((c) => firstState(c, "discussion").msg.view.phaseEndsAt));
  if (discEnds.size !== 1) fail(`discussion 의 phaseEndsAt 이 클라이언트마다 다름 (${discEnds.size}종)`);
  const endsBefore = [...discEnds][0];
  const durBefore = firstState(host, "discussion").msg.view.phaseDurationMs;
  if (durBefore !== DISCUSSION_MS) fail(`discussion phaseDurationMs 가 ${DISCUSSION_MS} 이 아님: ${durBefore}`);

  // 산 사람 한 줄: 모든 클라이언트가 ch all 로 받고 보낸 사람도 자기 줄을 돌려받는다(낙관적 표시 없음).
  // 같은 순간에 보낸 두 번째 줄은 600ms 안이라 막힌다 — 보낸 클라이언트에만 chatReject{rate}, 그 줄은 누구에게도 가지 않는다.
  const chatA = clients[1];
  const chatB = clients[2];
  const TEXT_A1 = "토론 첫 줄";
  const TEXT_B = "토론 둘째 줄";
  const TEXT_A2 = "토론 셋째 줄";
  const dayChatAt = performance.now();
  sendChat(chatA, TEXT_A1);
  sendChat(chatA, REJECT_MARKER);
  await waitUntil(() => clients.every((c) => hasLine(c, dayChatAt, "all", chatA.seat, TEXT_A1)), STATE_LIMIT_MS, "낮 토론 chat 줄이 모든 클라이언트(보낸 사람 포함)에 오지 않음");
  await waitUntil(() => rejectsOf(chatA, dayChatAt).length > 0, STATE_LIMIT_MS, `${CHAT_MIN_GAP_MS}ms 안 두 번째 전송의 chatReject 가 보낸 클라이언트에 오지 않음`);
  if (rejectsOf(chatA, dayChatAt)[0].msg.why !== "rate") fail(`${CHAT_MIN_GAP_MS}ms 안 두 번째 전송의 거절 이유가 rate 가 아님: ${rejectsOf(chatA, dayChatAt)[0].msg.why}`);
  expectedRejects[1].push("rate");

  // 입력 중: 켜짐은 같은 채널의 다른 클라이언트에만 가고 보낸 사람에게 되돌아오지 않는다. 꺼짐도 그렇다.
  const typingAt = performance.now();
  sendTyping(chatB, true);
  await waitUntil(
    () => clients.every((c) => c === chatB || typingsOf(c, typingAt).some((f) => f.msg.seat === chatB.seat && f.msg.on === true)),
    STATE_LIMIT_MS,
    "입력 중 켜짐 typing 프레임이 다른 클라이언트에 오지 않음",
  );
  sendChat(chatB, TEXT_B);
  await waitUntil(() => clients.every((c) => hasLine(c, typingAt, "all", chatB.seat, TEXT_B)), STATE_LIMIT_MS, "낮 토론 둘째 chat 줄이 모든 클라이언트에 오지 않음");
  sendTyping(chatB, false);
  await waitUntil(
    () => clients.every((c) => c === chatB || typingsOf(c, typingAt).some((f) => f.msg.seat === chatB.seat && f.msg.on === false)),
    STATE_LIMIT_MS,
    "입력 중 꺼짐 typing 프레임이 다른 클라이언트에 오지 않음",
  );
  // 거절된 줄은 기록을 남기지 않는다: 600ms 가 지난 뒤 보낸 같은 클라이언트의 다음 줄은 받아들여진다
  await sleep(CHAT_MIN_GAP_MS + 100);
  const a2At = performance.now();
  sendChat(chatA, TEXT_A2);
  await waitUntil(() => clients.every((c) => hasLine(c, a2At, "all", chatA.seat, TEXT_A2)), STATE_LIMIT_MS, `${CHAT_MIN_GAP_MS}ms 가 지난 뒤의 chat 줄이 모든 클라이언트에 오지 않음`);
  const DAY_TEXTS = [LOBBY_TEXT, TEXT_A1, TEXT_B, TEXT_A2]; // ch all 줄의 seq 1~4 순서

  // 연장·넘기기는 스키마에 없다(결정 0017-5): 손님·방장 모두 BAD_MESSAGE, 마감은 그대로
  await expectError(clients[1], { t: "extend" }, "BAD_MESSAGE", "손님 extend");
  await expectError(clients[1], { t: "skip" }, "BAD_MESSAGE", "손님 skip");
  await expectError(host, { t: "extend" }, "BAD_MESSAGE", "방장 extend");
  await expectError(host, { t: "skip" }, "BAD_MESSAGE", "방장 skip");
  await sleep(500);
  for (const c of clients) {
    const v = lastView(c);
    if (v.phase !== "discussion") fail(`${c.nickname} 가 extend·skip 거부 뒤 discussion 이 아님: ${v.phase}`);
    if (v.phaseEndsAt !== endsBefore || v.phaseDurationMs !== DISCUSSION_MS) fail(`${c.nickname} 의 discussion 마감이 extend·skip 시도 뒤 바뀜: ${v.phaseEndsAt} / ${v.phaseDurationMs}`);
  }

  // 낮 하루의 처형 구간(DAY-03~07, 결정 0060): 토론 끝내기 과반 → 지목 → 변론 → 찬반 → 처형.
  // victim 에게 지목을 몰아 주고(victim 은 다른 사람을 가리킨다) 찬반은 변론자를 뺀 전원이 찬성으로 마친다(값 변경 한 번 포함).
  // 매 걸음마다 모든 산 사람의 view 가 같은 공개 값을 보는지, 개인 값(me.*)이 본인에게만 가는지 본다.
  const dead = new Set();
  const aliveNow = () => clients.filter((c) => !dead.has(c));
  const inDay = (n) => (v) => v.day?.n === n;
  const allSee = (list, phase, n) => list.every((c) => firstState(c, phase, inDay(n)));
  async function runExecutionDay(n, victim) {
    const alive = aliveNow();
    const ghosts = [...dead];
    if (!alive.includes(victim)) fail(`${n}일차 처형 대상 ${victim.nickname} 이 이미 탈락함`);
    if (alive.length < 3) fail(`${n}일차 산 사람이 3명 미만인데 판이 끝나지 않음`);
    const label = `${n}일차`;
    const others = alive.filter((c) => c !== victim);
    const discEndsAt = firstState(alive[0], "discussion", inDay(n)).msg.view.phaseEndsAt;

    // (a) 토론 끝내기(DAY-03): 개수만 모두에게, 누른 본인 값은 본인에게만. 과반(산 사람의 절반 + 1)이 누르면 마감을 기다리지 않고 지목으로 넘어간다.
    const need = Math.floor(alive.length / 2) + 1;
    const pressers = alive.slice(0, need);
    if (ghosts.length > 0) await expectError(ghosts[0], { t: "endDiscussion", on: true }, "BAD_MESSAGE", `${label} 유령의 토론 끝내기`);
    for (let k = 0; k < need; k++) {
      pressers[k].ws.send(JSON.stringify({ t: "endDiscussion", on: true }));
      pressers[k].pressed = true;
      if (k === need - 1) break;
      await waitUntil(
        () => alive.every((c) => lastView(c)?.phase === "discussion" && lastView(c).day?.n === n && lastView(c).day.endCount === k + 1),
        STATE_LIMIT_MS,
        `${label} ${k + 1}번째 토론 끝내기 뒤 모든 클라이언트의 day.endCount 가 ${k + 1} 로 같아지지 않음`,
      );
      for (const c of alive) {
        const want = pressers.slice(0, k + 1).includes(c) ? true : undefined;
        if (lastView(c).me.endDiscussion !== want) fail(`${label} ${k + 1}번째 표 뒤 ${c.nickname} 의 me.endDiscussion 이 ${want} 가 아님: ${lastView(c).me.endDiscussion}`);
      }
    }

    // (b) 지목 단계: 과반 직후 넘어왔다(마감 90초를 기다리지 않음). 줄은 비어 있고 모이는 중(i -1)이며 순서는 산 사람 좌석 오름차순, 첫 길이는 모이기 3초.
    await waitUntil(() => allSee(alive, "nomination", n), STATE_LIMIT_MS, `${label} 토론 끝내기 과반 뒤 nomination 이 모든 클라이언트에 오지 않음`);
    const nomEnds = new Set(alive.map((c) => firstState(c, "nomination", inDay(n)).msg.view.phaseEndsAt));
    if (nomEnds.size !== 1) fail(`${label} nomination 의 phaseEndsAt 이 클라이언트마다 다름 (${nomEnds.size}종)`);
    const turnOrder = alive.map((c) => c.seat).sort((p, q) => p - q);
    for (const c of alive) {
      const nv = firstState(c, "nomination", inDay(n)).msg.view;
      if (nv.phaseDurationMs !== NOMINATION_GATHER_MS) fail(`${c.nickname} 의 ${label} nomination phaseDurationMs 가 ${NOMINATION_GATHER_MS} 가 아님: ${nv.phaseDurationMs}`);
      if (JSON.stringify(nv.day.points) !== "[]") fail(`${c.nickname} 의 ${label} nomination 첫 day.points 가 []가 아님: ${JSON.stringify(nv.day.points)}`);
      if (nv.day.turn?.i !== -1 || JSON.stringify(nv.day.turn.order) !== JSON.stringify(turnOrder)) fail(`${c.nickname} 의 ${label} nomination 첫 day.turn 이 {order 산 사람 좌석 오름차순, i -1} 이 아님: ${JSON.stringify(nv.day.turn)}`);
      if (nv.serverNow >= discEndsAt - 5_000) fail(`${label} 과반 토론 끝내기 뒤에도 토론 마감(${discEndsAt})을 거의 다 기다림 (serverNow ${nv.serverNow})`);
    }

    // (c) 순차 지목(DAY-04, 결정 0063-1, L15): 모이는 중에는 아무도 지목할 수 없고(WRONG_PHASE), 차례 주인만 지목한다. 유령은 BAD_MESSAGE, 자기 차례의 자기 지목도 BAD_MESSAGE.
    // 줄은 모두에게 같은 공개 목록이다. 지목은 바꿀 수 없다(확정).
    await expectError(others[0], { t: "point", target: victim.seat }, "WRONG_PHASE", `${label} 모이는 중 지목`, true);
    if (ghosts.length > 0) await expectError(ghosts[0], { t: "point", target: victim.seat }, "BAD_MESSAGE", `${label} 유령의 지목`);
    const lines = new Map();
    const linesNow = () => [...lines.entries()].sort((a, b) => a[0] - b[0]).map(([seat, target]) => ({ seat, target }));
    const pointAs = async (c, target) => {
      c.ws.send(JSON.stringify({ t: "point", target }));
      lines.set(c.seat, target);
      const want = JSON.stringify(linesNow());
      await waitUntil(
        () => alive.every((x) => lastView(x)?.phase === "nomination" && JSON.stringify(lastView(x).day.points) === want),
        STATE_LIMIT_MS,
        `${label} ${c.nickname} 의 지목 뒤 모든 클라이언트의 day.points 가 같아지지 않음 (기대 ${want})`,
      );
    };
    let probedNonOwner = false;
    for (let t = 0; t < turnOrder.length; t += 1) {
      await waitUntil(
        () => alive.every((x) => lastView(x)?.phase === "nomination" && lastView(x).day.turn?.i === t),
        STATE_LIMIT_MS + PICK_TURN_MS + PICK_GAP_MS,
        `${label} ${t}번째 차례가 모든 클라이언트에 오지 않음`,
      );
      const owner = alive.find((c) => c.seat === turnOrder[t]);
      for (const c of alive) {
        const turn = lastView(c).day.turn;
        if (turn.endsAt === undefined || turn.doneAt !== undefined) fail(`${c.nickname} 의 ${label} ${t}번째 차례 day.turn 이 {endsAt 있음, doneAt 없음} 이 아님: ${JSON.stringify(turn)}`);
      }
      if (!probedNonOwner) {
        probedNonOwner = true;
        const bystander = alive.find((c) => c !== owner);
        await expectError(bystander, { t: "point", target: victim.seat }, "WRONG_PHASE", `${label} 차례 아닌 ${bystander.nickname} 의 지목`, true);
      }
      if (owner === victim) {
        await expectError(victim, { t: "point", target: victim.seat }, "BAD_MESSAGE", `${label} 자기 차례의 자기 지목`);
        await pointAs(victim, others[0].seat);
      } else {
        await pointAs(owner, victim.seat);
      }
    }

    // (d) 변론(DAY-05): 마감에 최다 득표 한 명이 변론자가 된다.
    await waitUntil(() => allSee(alive, "defense", n), nominationMaxMs(alive.length) + STATE_LIMIT_MS, `${label} 지목 마감 뒤 defense 가 모든 클라이언트에 오지 않음`);
    for (const c of alive) {
      const dv = firstState(c, "defense", inDay(n)).msg.view;
      if (dv.day.candidate !== victim.seat) fail(`${c.nickname} 의 ${label} defense day.candidate 가 ${victim.seat} 가 아님: ${dv.day.candidate}`);
      if (dv.phaseDurationMs !== DEFENSE_MS) fail(`${c.nickname} 의 ${label} defense phaseDurationMs 가 ${DEFENSE_MS} 가 아님: ${dv.phaseDurationMs}`);
    }

    // (e) 찬반(DAY-06, 결정 0053): 변론자는 못 던진다. 첫 표는 던진 좌석만 모두에게, 값 변경은 본인에게만(다른 소켓은 프레임이 0).
    await waitUntil(() => allSee(alive, "verdict", n), DEFENSE_WAIT_MS, `${label} 변론 마감 뒤 verdict 가 모든 클라이언트에 오지 않음`);
    for (const c of alive) {
      const vv = firstState(c, "verdict", inDay(n)).msg.view;
      if (vv.day.ballots !== undefined) fail(`${c.nickname} 의 ${label} verdict 첫 view 에 day.ballots 가 이미 있음(찬반 진행 중에는 비공개)`);
      if (vv.phaseDurationMs !== VERDICT_MS) fail(`${c.nickname} 의 ${label} verdict phaseDurationMs 가 ${VERDICT_MS} 가 아님: ${vv.phaseDurationMs}`);
      if (JSON.stringify(vv.day.voted) !== "[]") fail(`${c.nickname} 의 ${label} verdict 첫 day.voted 가 []가 아님: ${JSON.stringify(vv.day.voted)}`);
      if (vv.me.verdictVote !== undefined) fail(`${c.nickname} 의 ${label} verdict 첫 view 에 verdictVote 가 이미 있음`);
    }
    if (ghosts.length > 0) await expectError(ghosts[0], { t: "verdict", agree: true }, "BAD_MESSAGE", `${label} 유령의 찬반`);
    await expectError(victim, { t: "verdict", agree: true }, "BAD_MESSAGE", `${label} 변론자의 찬반`);
    const voters = others;
    const sent = new Map();
    const sendVerdict = (c, agree) => {
      c.ws.send(JSON.stringify({ t: "verdict", agree }));
      sent.set(c, agree);
      (c.verdictSent ??= []).push(agree);
    };
    for (let k = 0; k < voters.length; k++) {
      sendVerdict(voters[k], k !== 0); // 첫 사람은 먼저 반대를 던졌다가 아래에서 찬성으로 바꾼다
      const wantVoted = JSON.stringify(voters.slice(0, k + 1).map((c) => c.seat).sort((a, b) => a - b));
      await waitUntil(
        () => alive.every((x) => lastView(x)?.phase === "verdict" && JSON.stringify(lastView(x).day.voted) === wantVoted),
        STATE_LIMIT_MS,
        `${label} ${k + 1}번째 찬반 뒤 모든 클라이언트의 day.voted 가 ${wantVoted} 로 같아지지 않음`,
      );
      for (const x of alive) {
        if (lastView(x).me.verdictVote !== sent.get(x)) fail(`${label} ${k + 1}번째 찬반 뒤 ${x.nickname} 의 me.verdictVote 가 ${sent.get(x)} 가 아님: ${lastView(x).me.verdictVote}`);
      }
    }
    const flip = voters[0];
    const framesBefore = new Map(alive.map((x) => [x, states(x).length]));
    sendVerdict(flip, true);
    await waitUntil(() => lastView(flip).me.verdictVote === true, STATE_LIMIT_MS, `${label} 값을 바꾼 ${flip.nickname} 에게 새 me.verdictVote 가 오지 않음`);
    await sleep(300);
    for (const x of alive) {
      if (x !== flip && states(x).length !== framesBefore.get(x)) fail(`${label} ${flip.nickname} 의 찬반 값 변경이 ${x.nickname} 에게 state 프레임으로 방송됨`);
    }

    // (f) 처형(DAY-07, 결정 0053): 처형된 사람과 찬반 수만 공개하고 역할 키는 없다. 부결은 없다(전원 찬성).
    await waitUntil(() => allSee(alive, "execution", n), VERDICT_WAIT_MS, `${label} 찬반 마감 뒤 execution 이 모든 클라이언트에 오지 않음`);
    const execViews = clients.map((c) => firstState(c, "execution", inDay(n)).msg.view);
    for (const [i, ev] of execViews.entries()) {
      const c = clients[i];
      if (ev.day.execution?.seat !== victim.seat) fail(`${c.nickname} 의 ${label} day.execution.seat 가 ${victim.seat} 가 아님: ${JSON.stringify(ev.day.execution)}`);
      if (Object.keys(ev.day.execution).sort().join(",") !== "seat") fail(`${c.nickname} 의 ${label} day.execution 키 집합이 seat 가 아님(결정 0060-5: 좌석만, 문구 번호·역할 없음): ${Object.keys(ev.day.execution).sort().join(",")}`);
      if (JSON.stringify(ev.day.verdict) !== JSON.stringify({ yes: voters.length, no: 0, passed: true })) fail(`${c.nickname} 의 ${label} day.verdict 가 {yes:${voters.length}, no:0, passed:true} 가 아님: ${JSON.stringify(ev.day.verdict)}`);
      // 찬반 기록 공개(결정 0066-3): 처형 단계 첫 view 에 모두에게 같은 목록 — 전원 찬성이라 찬성 = 유권자 좌석(오름차순), 반대 = 빈 목록, 변론자는 어느 쪽에도 없다.
      const wantBallots = JSON.stringify({ yes: voters.map((x) => x.seat).sort((a, b) => a - b), no: [] });
      if (JSON.stringify(ev.day.ballots) !== wantBallots) fail(`${c.nickname} 의 ${label} execution day.ballots 가 ${wantBallots} 가 아님: ${JSON.stringify(ev.day.ballots)}`);
      if (ev.phaseDurationMs !== EXECUTION_MS) fail(`${c.nickname} 의 ${label} execution phaseDurationMs 가 ${EXECUTION_MS} 가 아님: ${ev.phaseDurationMs}`);
      const victimRow = ev.players.find((p) => p.seat === victim.seat);
      if (victimRow?.alive !== false) fail(`${c.nickname} 의 ${label} execution players 에서 처형된 seat ${victim.seat} 의 alive 가 false 가 아님`);
    }
    victim.ghostFrom = firstState(victim, "execution", inDay(n)).at;
    dead.add(victim);
    return { yes: voters.length, no: 0, lines: linesNow(), victimSeat: victim.seat };
  }

  // 승패 판정(shared/game/win.ts 와 같은 규칙): 산 마피아 0 → 시민 승, 산 마피아 ≥ 나머지 산 사람 → 마피아 승.
  const winnerNow = () => {
    const live = aliveNow();
    const mafia = live.filter((c) => c.role === "mafia").length;
    if (mafia === 0) return "citizenWin";
    if (mafia >= live.length - mafia) return "mafiaWin";
    return null;
  };

  // 첫 낮: 마피아가 아닌 시민 중 가장 큰 seat 를 처형한다(그날 밤 가장 작은 산 시민이 암살당한다). 역할은 자기 view.me.role 로만 안다.
  for (const c of clients) {
    c.role = lastView(c).me.role;
    if (!ROLE_IDS.includes(c.role)) fail(`${c.nickname} 의 낮 view 에 me.role 이 없음`);
  }
  const allCitizens = clients.filter((c) => c.role === "citizen");
  if (allCitizens.length < 2) fail("낮 시작 때 시민이 2명 미만임");
  const e1Client = allCitizens.reduce((a, b) => (b.seat > a.seat ? b : a));
  // 유언(WILL-01, 가정 A2): 첫 밤 피해자가 될 시민(처형 대상 e1 을 뺀 가장 작은 seat 의 시민)이 첫 토론에 유언을 저장한다.
  // 저장은 본인 소켓의 me.will 로만 돌아오고, 다른 클라이언트는 아침 카드 전까지 이 문장을 받지 않는다(결정 0061-10·11).
  const WILL_TEXT = "스모크 유언";
  const willClient = allCitizens.filter((c) => c !== e1Client).reduce((a, b) => (b.seat < a.seat ? b : a));
  const willAt = performance.now();
  willClient.ws.send(JSON.stringify({ t: "will", text: WILL_TEXT }));
  await waitUntil(() => lastView(willClient)?.me.will === WILL_TEXT, STATE_LIMIT_MS, "유언 저장 뒤 본인 view.me.will 이 저장한 본문으로 오지 않음");
  for (const c of clients) {
    if (c === willClient) continue;
    if (c.frames.some((f) => f.at >= willAt && f.raw.includes(WILL_TEXT))) fail(`${c.nickname} 가 아침 전에 다른 사람의 유언 본문을 받음`);
  }
  const trial1 = await runExecutionDay(1, e1Client);

  // (14) 밤: 처형 마감 뒤 모든 클라이언트가 night 를 받는다(넘기기 없이 서버 타이머). 처형이 성립한 날이라 처형 무효 이유가 없다.
  await waitUntil(() => allSee(clients, "night", 1), EXECUTION_WAIT_MS, "처형 마감 뒤 night 가 모든 클라이언트에 오지 않음");
  for (const c of clients) {
    const nv = firstState(c, "night").msg.view;
    if (nv.day?.noExecution !== undefined) fail(`${c.nickname} 의 night day.noExecution 이 있음 (처형이 성립한 날): ${JSON.stringify(nv.day.noExecution)}`);
    const lastLine = nv.day?.voteLog?.at(-1);
    if (!lastLine || lastLine.n !== 1) fail(`${c.nickname} 의 night voteLog 마지막 줄이 1일차가 아님: ${JSON.stringify(lastLine)}`);
    if (Object.keys(lastLine.exec).sort().join(",") !== "no,passed,yes") fail(`${c.nickname} 의 voteLog exec 키 집합이 no,passed,yes 가 아님: ${Object.keys(lastLine.exec).sort().join(",")}`);
    if (lastLine.exec.yes !== trial1.yes || lastLine.exec.no !== trial1.no || lastLine.exec.passed !== true) fail(`${c.nickname} 의 voteLog exec 가 {yes:${trial1.yes}, no:${trial1.no}, passed:true} 가 아님: ${JSON.stringify(lastLine.exec)}`);
    if (lastLine.cand?.candidate !== trial1.victimSeat || JSON.stringify(lastLine.cand?.votes) !== JSON.stringify(trial1.lines)) fail(`${c.nickname} 의 voteLog cand 가 지목 줄·변론자와 다름: ${JSON.stringify(lastLine.cand)}`);
    // 마감 뒤에는 개인 표 키가 view 어디에도 없다(마감 훅이 삭제, 결정 0053)
    for (const key of ["verdictVote", "endDiscussion", "nominate", "endVote"]) {
      const vp = [];
      collectKeyPaths(nv, key, "", vp);
      if (vp.length > 0) fail(`${c.nickname} 의 night view 에 ${key} 키가 남아 있음: ${vp.join(",")}`);
    }
  }
  info(`처형 1일차: 토론 끝내기 과반 → 지목 ${trial1.lines.length}줄 → 변론 → 찬반 찬성 ${trial1.yes} 반대 ${trial1.no} → 처형 seat ${trial1.victimSeat}`);
  for (const c of clients) {
    const nv = firstState(c, "night").msg.view;
    if (nv.day?.n !== 1) fail(`${c.nickname} 의 night 의 day.n 이 1 이 아님: ${nv.day?.n}`);
    if (nv.phaseDurationMs !== 30_000) fail(`${c.nickname} 의 night phaseDurationMs 가 30000 이 아님: ${nv.phaseDurationMs}`);
    if (nv.me.role !== c.role) fail(`${c.nickname} 의 night view 의 me.role 이 낮의 값과 다름`); // 탈락자도 자기 역할은 계속 본다
  }
  const mafiaClients = clients.filter((c) => c.role === "mafia");
  const policeClient = clients.find((c) => c.role === "police");
  const doctorClient = clients.find((c) => c.role === "doctor");
  const citizenClients = clients.filter((c) => c.role === "citizen" && !dead.has(c)); // 처형된 시민은 밤에 행동하지 못한다
  if (mafiaClients.length < 1 || !policeClient || citizenClients.length < 1) fail("밤 시작 때 역할 구성이 이상함");
  if ((doctorClient !== undefined) !== (N >= 5)) fail(`의사 유무가 인원(${N})과 맞지 않음`);
  // 결정적 행동(결정 0061-6: 마피아 확정은 전원 일치 — 산 마피아 모두가 같은 대상을 고른다): 마피아 전원 → 가장 작은 산 시민 seat X, 경찰 → 가장 작은 마피아 seat, 의사 → 자신
  const targetX = Math.min(...citizenClients.map((c) => c.seat));
  const xClient = clients.find((c) => c.seat === targetX);
  if (xClient !== willClient) fail(`첫 밤 피해자(seat ${targetX})가 유언을 저장한 클라이언트(seat ${willClient.seat})와 다름`);
  const policeTarget = Math.min(...mafiaClients.map((c) => c.seat));
  const nightStartAt = (c) => firstState(c, "night").at;
  const hasPicked = (c, seat) => lastView(c)?.phase === "night" && lastView(c).me.pick === seat;
  for (const m of mafiaClients) m.ws.send(JSON.stringify({ t: "pick", target: targetX }));
  policeClient.ws.send(JSON.stringify({ t: "pick", target: policeTarget }));
  if (doctorClient) doctorClient.ws.send(JSON.stringify({ t: "pick", target: doctorClient.seat }));
  const actors = [...mafiaClients.map((m) => [m, targetX]), [policeClient, policeTarget], ...(doctorClient ? [[doctorClient, doctorClient.seat]] : [])];
  await waitUntil(() => actors.every(([c, seat]) => hasPicked(c, seat)), STATE_LIMIT_MS, "밤 행동 뒤 본인 선택(me.pick)이 행위자 화면에 오지 않음");
  const nightTown = clients.filter((c) => c.role !== "mafia" && !dead.has(c)); // 밤에 산 시민 편(시민·경찰·의사)
  // 마피아 한 명이 밤 채팅·입력 중 → ch mafia 로 마피아(보낸 사람 포함)에게만. 살아 있는 비마피아에게는 chat·typing 프레임이 가지 않는다(CHAT-02).
  const talker = mafiaClients[0];
  const NIGHT_TEXT = "밤 마피아 스모크 줄";
  const nightChatAt = performance.now();
  sendTyping(talker, true);
  sendChat(talker, NIGHT_TEXT);
  await waitUntil(
    () => mafiaClients.every((m) => hasLine(m, nightChatAt, "mafia", talker.seat, NIGHT_TEXT)),
    STATE_LIMIT_MS,
    "밤 마피아 채팅 chat 프레임이 마피아 클라이언트(보낸 사람 포함)에 오지 않음",
  );
  const otherMafia = mafiaClients.filter((m) => m !== talker);
  if (otherMafia.length > 0) {
    await waitUntil(
      () => otherMafia.every((m) => typingsOf(m, nightChatAt).some((f) => f.msg.seat === talker.seat && f.msg.on === true)),
      STATE_LIMIT_MS,
      "밤 마피아 입력 중 typing 프레임이 다른 마피아에 오지 않음",
    );
  }
  // 살아 있는 비마피아의 밤 채팅은 단계 불일치(phase)로 막힌다 — 보낸 클라이언트에만 chatReject 가 가고 줄은 어디에도 남지 않는다. 입력 중은 조용히 버려진다.
  const nightCitizen = citizenClients[0];
  await expectReject(nightCitizen, "시민이 밤에 보낸 줄", "phase", "밤 시민의 chat");
  sendTyping(nightCitizen, true);
  await sleep(300);

  // (15) 아침: 모든 클라이언트가 morning 을, 그다음 승패가 나지 않았으면 2일차 dayAnnounce 를 서버 타이머로 받는다
  await waitUntil(() => clients.every((c) => firstState(c, "morning")), NIGHT_WAIT_MS, "밤 마감 뒤 morning 이 모든 클라이언트에 오지 않음");
  // (15a) 시민 편의 밤(NIGHT-07, L1): 밤 진입 때 받은 world snap 은 본인 좌석 하나뿐이고, 그 snap 뒤 아침 state 전까지 world·typing·mafia 채널 chat 프레임이 0개다.
  for (const c of nightTown) {
    const mornAt = firstState(c, "morning").at;
    const snaps = c.frames.filter((f) => f.at >= firstState(c, "execution").at && f.at < mornAt && f.msg?.t === "world" && f.msg.k === "snap");
    const snap = snaps.at(-1);
    if (!snap) fail(`밤 시민 편 ${c.nickname} 가 밤 진입 world snap 을 받지 못함`);
    const seats = snap.msg.ents.map((e) => e.s).join(",");
    if (seats !== String(c.seat)) fail(`밤 시민 편 ${c.nickname} 의 밤 진입 snap 좌석이 본인(${c.seat}) 하나가 아님: ${seats}`);
    const after = c.frames.filter((f) => f.at > snap.at && f.at < mornAt);
    const worldN = after.filter((f) => f.msg?.t === "world").length;
    const typedN = after.filter((f) => f.msg?.t === "typing").length;
    const mafiaChatN = after.filter((f) => f.msg?.t === "chat" && f.msg.ch === "mafia").length;
    if (worldN + typedN + mafiaChatN !== 0) fail(`밤 시민 편 ${c.nickname} 가 밤 snap 뒤 아침 전에 world ${worldN}·typing ${typedN}·mafia chat ${mafiaChatN} 프레임을 받음`);
  }
  info(`밤 시민 편 ${nightTown.length}명: 진입 snap 본인 한 칸, snap 뒤 아침 전 world·typing·mafia chat 0프레임`);
  // 아침 전에는 유언 본문이 카드 줄 밖의 어떤 프레임에도 없다(피해자 본인의 state 는 me.will 로 가지므로 뺀다)
  for (const c of clients) {
    if (c === willClient) continue;
    const mornAt = firstState(c, "morning").at;
    if (c.frames.some((f) => f.at < mornAt && f.raw.includes(WILL_TEXT) && !(f.msg?.t === "chat" && f.msg.k === "will"))) fail(`${c.nickname} 가 아침 전에 다른 사람의 유언 본문을 받음`);
  }
  // 아침 카드(MORN-02, WILL-01): 모든 클라이언트(탈락자 포함)가 피해자 seat 의 유언 카드 한 줄(k will, ch all)을 받는다.
  const hasWillCard = (c) => chatsOf(c).some((f) => f.msg.k === "will" && f.msg.ch === "all" && f.msg.seat === targetX && f.msg.text === WILL_TEXT);
  await waitUntil(() => clients.every(hasWillCard), STATE_LIMIT_MS, "아침 유언 카드(k will)가 모든 클라이언트에 오지 않음");
  // (15b) 탈락자 채널(CHAT-03): 아침에 탈락한 X 의 줄은 ch ghost 로 탈락자(X와 처형된 시민)에게만 간다. 산 사람 쪽 0건은 아래 최종 단언이 본다.
  const ghostClient = xClient;
  xClient.ghostFrom = firstState(xClient, "morning").at;
  dead.add(xClient);
  const GHOST_TEXT = "구경하는 중 스모크";
  const ghostAt = performance.now();
  sendTyping(ghostClient, true);
  sendChat(ghostClient, GHOST_TEXT);
  await waitUntil(() => hasLine(ghostClient, ghostAt, "ghost", ghostClient.seat, GHOST_TEXT), STATE_LIMIT_MS, "탈락자 chat 줄이 탈락자 자신에게 돌아오지 않음");
  await sleep(300);
  // 재접속 복원(CHAT-05): 산 시민 편(경찰)이 다시 붙으면 hello 직후 chatLog 로 자기가 받았던 공개 줄만 돌아온다 — mafia·ghost 줄은 0.
  // 마피아가 다시 붙으면 공개 줄에 더해 밤 마피아 줄도 돌아온다. 복원이 라이브보다 넓어지지 않는다(T-07-35).
  const townLines = await reconnectAndReplay(policeClient, "산 시민 편");
  if (townLines.some((l) => l.ch !== "all")) fail(`산 시민 편 재접속 chatLog 에 ch all 밖의 줄이 있음: ${[...new Set(townLines.map((l) => l.ch))].join(",")}`);
  if (townLines.map((l) => l.text).join("|") !== [...DAY_TEXTS, WILL_TEXT].join("|")) fail("산 시민 편 재접속 chatLog 의 낮 줄 + 유언 카드 순서·본문이 받은 순서와 다름");
  const mafiaLines = await reconnectAndReplay(talker, "마피아");
  if (!mafiaLines.some((l) => l.ch === "mafia" && l.text === NIGHT_TEXT && l.seat === talker.seat)) fail("마피아 재접속 chatLog 에 밤 마피아 줄이 없음");
  if (mafiaLines.some((l) => l.ch === "ghost")) fail("마피아 재접속 chatLog 에 ghost 줄이 있음");
  info(`재접속 복원: 산 시민 편 ${townLines.length}줄(전부 ch all, 유언 카드 포함), 마피아 ${mafiaLines.length}줄`);

  // (16) 다음 낮들: 승패가 날 때까지 낮을 같은 방식으로 돈다. 마피아가 남은 날은 마피아 한 명을 처형하고(처형으로 끝나는 판 포함),
  //      그 밤에는 아무도 행동하지 않아 아침에 탈락자가 없다. 마지막은 모든 클라이언트가 ended 에서 같은 승리 팀을 본다.
  let winner = winnerNow();
  let dayNo = 1;
  while (winner === null) {
    dayNo += 1;
    await waitUntil(() => allSee(aliveNow(), "dayAnnounce", dayNo), dayNo === 2 ? MORNING_WAIT_MS : NIGHT_WAIT_MS, `아침 마감 뒤 dayAnnounce(day.n ${dayNo}) 가 산 클라이언트에 오지 않음`);
    await waitUntil(() => allSee(aliveNow(), "discussion", dayNo), STATE_LIMIT_MS + 5000, `${dayNo}일차 dayAnnounce 다음에 discussion 이 오지 않음`);
    await runExecutionDay(dayNo, aliveNow().find((c) => c.role === "mafia"));
    winner = winnerNow();
    if (winner !== null) break;
    await waitUntil(() => allSee(aliveNow(), "night", dayNo), EXECUTION_WAIT_MS, `${dayNo}일차 처형 마감 뒤 night 가 산 클라이언트에 오지 않음`);
    await waitUntil(() => allSee(aliveNow(), "morning", dayNo), NIGHT_WAIT_MS, `${dayNo}일차 밤 마감 뒤 morning 이 산 클라이언트에 오지 않음`);
    const mv = firstState(aliveNow()[0], "morning", inDay(dayNo)).msg.view;
    if (mv.day.morning?.eliminated !== undefined) fail(`${dayNo}일차 아무도 행동하지 않은 밤에 탈락자가 있음: ${JSON.stringify(mv.day.morning)}`);
  }
  await waitUntil(() => clients.every((c) => lastView(c)?.phase === "ended"), EXECUTION_WAIT_MS, `승패(${winner})가 났는데 ended 가 모든 클라이언트에 오지 않음`);
  for (const c of clients) {
    const rv = lastView(c).result;
    if (rv?.winner !== winner) fail(`${c.nickname} 의 ended result.winner 가 ${winner} 가 아님: ${rv?.winner}`);
    for (const sj of rv.seats) {
      const owner = clients.find((x) => x.seat === sj.seat);
      if (!owner || sj.job !== owner.role) fail(`${c.nickname} 의 ended result.seats 의 seat ${sj.seat} job(${sj.job})이 그 클라이언트의 역할(${owner?.role})과 다름`);
    }
  }
  info(`판 끝: ${dayNo}일차, ${winner}, 탈락 ${dead.size}명`);
  for (const c of clients) if (c.unexpectedClose !== null) fail(`${c.nickname} 소켓이 예상 밖으로 닫힘 (code ${c.unexpectedClose})`);

  // ---- 단언 ----
  // 토큰 누출: 다른 클라이언트의 토큰이 내 프레임·내 HTTP 응답·익명 응답 어디에도 없어야 한다.
  clients.forEach((c, i) => {
    const others = clients.filter((_, k) => k !== i);
    for (const f of c.frames) {
      for (const o of others) if (f.raw.includes(o.token)) fail(`${c.nickname} 의 프레임에 ${o.nickname} 의 토큰이 들어 있음`);
    }
  });
  for (const h of httpLog) {
    clients.forEach((c, i) => {
      if (h.owner !== i && h.raw.includes(c.token)) fail(`HTTP 응답(소유 ${h.owner === null ? "익명" : clients[h.owner].nickname})에 ${c.nickname} 의 토큰이 들어 있음`);
    });
  }

  const roleCounts = { mafia: 0, police: 0, doctor: 0, citizen: 0 };
  const mafiaSeats = [];
  for (const c of clients) {
    // 프레임 형식
    for (const f of c.frames) if (!f.msg) fail(`${c.nickname} 가 JSON 이 아닌 프레임을 받음`);
    const stateFrames = states(c);
    const roleValues = new Set();
    for (const f of stateFrames) {
      const v = f.msg.view;
      for (const p of v.players) {
        if (Object.keys(p).sort().join(",") !== ALLOWED_PLAYER_KEYS.join(",")) fail(`${c.nickname} 의 players 항목 키 집합이 다름: ${Object.keys(p).sort().join(",")}`);
      }
      const rolePaths = [];
      collectKeyPaths(f.msg, "role", "", rolePaths);
      if (rolePaths.some((p) => p !== "view.me.role")) fail(`${c.nickname} 의 프레임에 view.me.role 밖의 role 키가 있음: ${rolePaths.join(",")}`);
      const allyPaths = [];
      collectKeyPaths(f.msg, "allies", "", allyPaths);
      if (allyPaths.some((p) => p !== "view.me.allies")) fail(`${c.nickname} 의 프레임에 view.me.allies 밖의 allies 키가 있음`);
      if (v.me.role !== undefined) roleValues.add(v.me.role);
    }
    if (roleValues.size !== 1) fail(`${c.nickname} 가 받은 me.role 값이 하나가 아님: ${[...roleValues].join(",") || "없음"}`);
    const role = [...roleValues][0];
    if (!(role in roleCounts)) fail(`${c.nickname} 의 알 수 없는 역할: ${role}`);
    roleCounts[role] += 1;
    c.role = role;
    if (role === "mafia") mafiaSeats.push(c.seat);
    // 단계 순서: 전이 표가 허용하는 다음 단계로만(낮 루프 포함)
    const seq = [];
    for (const f of stateFrames) if (seq.at(-1) !== f.msg.view.phase) seq.push(f.msg.view.phase);
    for (let k = 1; k < seq.length; k++) {
      if (!(PHASE_NEXT[seq[k - 1]] ?? []).includes(seq[k])) fail(`${c.nickname} 의 단계 순서가 이상함: ${seq.join(" → ")}`);
    }
    // 첫 낮은 토론 → 지목 → 변론 → 찬반 → 처형 → 밤 → 아침 순서로 돈다(옛 처형 여부·후보 선택 단계는 어떤 경로로도 없다). 마지막 단계는 ended.
    const iDisc = seq.indexOf("discussion");
    const firstDay = ["discussion", "nomination", "defense", "verdict", "execution", "night", "morning"];
    if (iDisc < 0 || seq.slice(iDisc, iDisc + firstDay.length).join(",") !== firstDay.join(",")) fail(`${c.nickname} 의 첫 낮 단계 순서가 ${firstDay.join(" → ")} 가 아님: ${seq.join(" → ")}`);
    if (seq.at(-1) !== "ended") fail(`${c.nickname} 의 마지막 단계가 ended 가 아님: ${seq.join(" → ")}`);
  }
  // me.allies 는 마피아에게만, 다른 마피아의 seat 와 같다
  for (const c of clients) {
    const hasAllies = states(c).some((f) => f.msg.view.me.allies !== undefined);
    if (c.role !== "mafia") {
      if (hasAllies) fail(`마피아가 아닌 ${c.nickname} 가 me.allies 를 받음`);
      continue;
    }
    const expected = mafiaSeats.filter((s) => s !== c.seat).sort((a, b) => a - b);
    for (const f of states(c)) {
      const v = f.msg.view;
      if (v.phase === "lobby" || v.phase === "assigning") continue;
      const got = [...(v.me.allies ?? [])].sort((a, b) => a - b);
      // 첫 낮까지는 다른 마피아 seat 와 같다. 그 뒤에는 마피아 한 명이 처형될 수 있어 부분집합이면 된다.
      const exact = (v.day?.n ?? 1) <= 1;
      if (exact ? got.join(",") !== expected.join(",") : got.some((a) => !expected.includes(a))) fail(`마피아 ${c.nickname} 의 allies [${got}] 가 다른 마피아 seat [${expected}] 와 다름 (${v.phase})`);
    }
  }
  // 역할 구성표
  const expectedRoles = EXPECTED_ROLES[N];
  for (const r of Object.keys(expectedRoles)) {
    if (roleCounts[r] !== expectedRoles[r]) fail(`역할 ${r} 수가 구성표와 다름: ${roleCounts[r]} (기대 ${expectedRoles[r]})`);
  }
  // roleReveal 마감 일치
  const ends = new Set();
  for (const c of clients) for (const f of states(c)) if (f.msg.view.phase === "roleReveal") ends.add(f.msg.view.phaseEndsAt);
  if (ends.size !== 1) fail(`roleReveal 의 phaseEndsAt 이 클라이언트마다 다름 (${ends.size}종)`);
  // 낮 시작 발표·discussion 진입 도착 편차
  const spreadOf = (phase) => {
    const at = clients.map((c) => firstState(c, phase).at);
    return Math.round(Math.max(...at) - Math.min(...at));
  };
  const spread = spreadOf("dayAnnounce");
  const discSpread = spreadOf("discussion");
  if (spread >= DAY_SPREAD_LIMIT_MS) fail(`dayAnnounce 도착 편차 ${spread}ms 가 ${DAY_SPREAD_LIMIT_MS}ms 이상`);
  if (discSpread >= DAY_SPREAD_LIMIT_MS) fail(`discussion 도착 편차 ${discSpread}ms 가 ${DAY_SPREAD_LIMIT_MS}ms 이상`);

  // 서버 전용·삭제된 키는 어떤 프레임에도 없다(결정 0027-3). 옛 직업 주장 키(claim*·turn·claimLog)가 다시 나오면 회귀다(CHAT-06). turn 은 view.day.turn 만 공개이고 pickTurn 은 어디에도 없다.
  // state 어디에도 messages·extendUsed 키가 없다(결정 0017-7): 채팅 줄은 state 가 아니라 chat 프레임으로만 온다.
  for (const c of clients) {
    for (const f of c.frames) {
      if (!f.msg) continue;
      for (const key of SERVER_ONLY_KEYS) {
        const kp = [];
        collectKeyPaths(f.msg, key, "", kp);
        const bad = kp.filter((p) => !(PUBLIC_KEY_PATHS[key] ?? []).includes(p));
        if (bad.length > 0) fail(`${c.nickname} 의 프레임에 서버 전용·삭제된 키 ${key} 가 있음: ${bad.join(",")}`);
      }
    }
    for (const f of states(c)) {
      for (const key of ["messages", "extendUsed"]) {
        const paths = [];
        collectKeyPaths(f.msg, key, "", paths);
        if (paths.length > 0) fail(`${c.nickname} 의 state 프레임에 ${key} 키가 있음: ${paths.join(",")}`);
      }
    }
  }

  // ---- 낮 처형 누설 단언 (DAY-03~07, 결정 0053·0060, T-08-02·T-08-03) ----
  // 공개 값은 자기 단계에서만 있고, 개인 값(me.endDiscussion·me.verdictVote)은 본인이 보낸 값뿐이다. 남의 찬반 값을 알 수 있는 키(agree·값 달린 목록)는 어떤 프레임에도 없다.
  for (const c of clients) {
    const sentVerdicts = new Set(c.verdictSent ?? []);
    for (const f of states(c)) {
      const v = f.msg.view;
      const agreePaths = [];
      collectKeyPaths(f.msg, "agree", "", agreePaths);
      if (agreePaths.length > 0) fail(`${c.nickname} 의 state 프레임에 agree 키가 있음: ${agreePaths.join(",")}`);
      if (v.day?.endCount !== undefined && v.phase !== "discussion") fail(`${c.nickname} 의 ${v.phase} 프레임에 day.endCount 가 있음`);
      if (v.day?.points !== undefined && v.phase !== "nomination") fail(`${c.nickname} 의 ${v.phase} 프레임에 day.points 가 있음`);
      if (v.day?.voted !== undefined && v.phase !== "verdict") fail(`${c.nickname} 의 ${v.phase} 프레임에 day.voted 가 있음`);
      if (v.day?.verdict !== undefined && v.phase !== "execution") fail(`${c.nickname} 의 ${v.phase} 프레임에 day.verdict 가 있음`);
      if (v.day?.ballots !== undefined && v.phase !== "execution") fail(`${c.nickname} 의 ${v.phase} 프레임에 day.ballots 가 있음(찬반 진행 중 비공개, 결정 0066-3)`);
      if (v.day?.execution !== undefined && v.phase !== "execution") fail(`${c.nickname} 의 ${v.phase} 프레임에 day.execution 이 있음`);
      if (v.day?.voted !== undefined && !v.day.voted.every((seat) => Number.isInteger(seat))) fail(`${c.nickname} 의 day.voted 가 좌석 번호 목록이 아님: ${JSON.stringify(v.day.voted)}`);
      if (v.me.verdictVote !== undefined && (v.phase !== "verdict" || !sentVerdicts.has(v.me.verdictVote))) fail(`${c.nickname} 의 ${v.phase} 프레임 me.verdictVote(${v.me.verdictVote})가 본인이 보낸 값이 아님`);
      if (v.me.endDiscussion !== undefined && (v.phase !== "discussion" || c.pressed !== true)) fail(`${c.nickname} 의 ${v.phase} 프레임에 누르지 않은 me.endDiscussion 이 있음`);
    }
  }

  // ---- 자유 채팅 단언 (CHAT-01·02·03·05·06, UI-SPEC D2·D5) ----
  const CHANNELS = ["all", "mafia", "ghost"];
  const REJECT_WHYS = ["rate", "repeat", "length", "phase", "other"];
  // (a) 프레임 모양: chat·typing·chatReject·chatLog 는 허용 키만 쓴다. id·역할·토큰·수신자 마스크가 없다(T-02-48, T-07-36).
  for (const c of clients) {
    for (const f of c.frames) {
      const m = f.msg;
      if (m?.t === "chat") {
        const wantKeys = lineKeys(m, CHAT_LINE_KEYS);
        if (sortedKeys(m) !== wantKeys) fail(`${c.nickname} 의 chat 프레임 키 집합이 다름: ${sortedKeys(m)} (기대 ${wantKeys})`);
        if (!CHANNELS.includes(m.ch)) fail(`${c.nickname} 의 chat 프레임 ch 가 채널 이름이 아님: ${m.ch}`);
        if (!Number.isInteger(m.seq) || m.seq < 1) fail(`${c.nickname} 의 chat 프레임 seq 가 1 이상 정수가 아님: ${m.seq}`);
        if (!Number.isInteger(m.seat) || typeof m.text !== "string" || typeof m.at !== "number") fail(`${c.nickname} 의 chat 프레임 값 형식이 다름`);
      } else if (m?.t === "typing") {
        if (sortedKeys(m) !== TYPING_KEYS.join(",")) fail(`${c.nickname} 의 typing 프레임 키 집합이 다름: ${sortedKeys(m)}`);
        if (m.seat === c.seat) fail(`${c.nickname} 가 자기 입력 중 신호를 되돌려 받음`);
      } else if (m?.t === "chatReject") {
        if (sortedKeys(m) !== CHAT_REJECT_KEYS.join(",")) fail(`${c.nickname} 의 chatReject 프레임 키 집합이 다름: ${sortedKeys(m)}`);
        if (!REJECT_WHYS.includes(m.why)) fail(`${c.nickname} 의 chatReject why 가 알 수 없는 값: ${m.why}`);
      } else if (m?.t === "chatLog") {
        if (sortedKeys(m) !== CHAT_LOG_KEYS.join(",")) fail(`${c.nickname} 의 chatLog 프레임 키 집합이 다름: ${sortedKeys(m)}`);
        if (!Array.isArray(m.lines)) fail(`${c.nickname} 의 chatLog.lines 가 배열이 아님`);
        for (const l of m.lines) {
          if (sortedKeys(l) !== lineKeys(l, CHAT_LOG_LINE_KEYS)) fail(`${c.nickname} 의 chatLog 줄 키 집합이 다름: ${sortedKeys(l)}`);
          if (!CHANNELS.includes(l.ch)) fail(`${c.nickname} 의 chatLog 줄 ch 가 채널 이름이 아님: ${l.ch}`);
        }
      }
    }
  }
  // (b) 공개 채널(CHAT-01): ch all 줄은 모든 클라이언트가 같은 {seat, seq, text, at} 로, seq 1 부터 틈 없이 보낸 순서대로 받는다.
  const allLinesWithCards = clients.map((c) => chatsOf(c).filter((f) => f.msg.ch === "all").map((f) => f.msg));
  // 유언 카드(k will)는 일반 줄과 같은 seq 번호를 이어 받는다: 보낸 줄 4개 다음 5번, 피해자 seat, 본문은 저장한 유언, 모든 클라이언트가 같다.
  allLinesWithCards.forEach((all, i) => {
    const cards = all.filter((l) => l.k !== undefined);
    if (cards.length !== 1 || cards[0].k !== "will" || cards[0].seat !== targetX || cards[0].text !== WILL_TEXT || cards[0].seq !== DAY_TEXTS.length + 1) {
      fail(`${clients[i].nickname} 가 받은 사망 카드가 유언 한 줄(seq ${DAY_TEXTS.length + 1}, seat ${targetX})이 아님: ${JSON.stringify(cards)}`);
    }
    if (JSON.stringify(cards[0]) !== JSON.stringify(allLinesWithCards[0].find((l) => l.k !== undefined))) fail(`${clients[i].nickname} 가 받은 유언 카드가 방장과 다름`);
  });
  const allLines = allLinesWithCards.map((all) => all.filter((l) => l.k === undefined));
  allLines.forEach((lines, i) => {
    if (lines.map((l) => l.seq).join(",") !== DAY_TEXTS.map((_, k) => k + 1).join(",")) fail(`${clients[i].nickname} 가 받은 ch all 줄 seq 가 1..${DAY_TEXTS.length} 틈 없는 순서가 아님: ${lines.map((l) => l.seq).join(",")}`);
    if (lines.map((l) => l.text).join("|") !== DAY_TEXTS.join("|")) fail(`${clients[i].nickname} 가 받은 ch all 줄의 본문 순서가 보낸 순서와 다름`);
    if (JSON.stringify(lines) !== JSON.stringify(allLines[0])) fail(`${clients[i].nickname} 가 받은 ch all 줄이 방장과 다름`);
  });
  // (c) 비공개 채널(CHAT-02·03): ch mafia 는 마피아 클라이언트에만, ch ghost 는 탈락자에게만 간다. 다른 편 폰은 한 줄도 받지 않는다.
  const ghostsAtChat = new Set([e1Client, xClient]);
  for (const c of clients) {
    const mafiaN = chatsOf(c).filter((f) => f.msg.ch === "mafia").length;
    const ghostN = chatsOf(c).filter((f) => f.msg.ch === "ghost").length;
    // 밤 마피아 채널은 산 마피아와 그 밤에 이미 탈락해 있던 관전자(처형된 시민)만 받는다(결정 0019·0021)
    if (c.role === "mafia" || c === e1Client) {
      if (mafiaN !== 1) fail(`${c.role === "mafia" ? "마피아" : "밤 관전자"} ${c.nickname} 가 받은 ch mafia 줄이 하나가 아님: ${mafiaN}`);
    } else if (mafiaN !== 0) {
      fail(`마피아도 밤 관전자도 아닌 ${c.nickname} 가 ch mafia 줄 ${mafiaN}개를 받음`);
    }
    if (ghostsAtChat.has(c)) {
      // 그 순간 탈락해 있던 사람(처형된 시민과 암살당한 X)은 X 의 줄을 모두 한 번씩 받는다
      if (ghostN !== 1) fail(`탈락자 ${c.nickname} 가 받은 ch ghost 줄이 하나가 아님: ${ghostN}`);
    } else if (ghostN !== 0) {
      fail(`산 사람 ${c.nickname} 가 ch ghost 줄 ${ghostN}개를 받음`);
    }
    // 내 채널 이름(view.me.chat)은 마피아에게만 mafia, 밤의 비마피아에게는 키가 없다
    for (const f of states(c)) {
      const chn = f.msg.view.me.chat;
      if (chn === "mafia" && c.role !== "mafia") fail(`마피아가 아닌 ${c.nickname} 의 view.me.chat 이 mafia 임`);
      // 밤의 산 비마피아는 채널이 없고, 탈락자는 탈락자 채널(ghost)이다
      const ghostNow = c.ghostFrom !== undefined && f.at >= c.ghostFrom;
      if (f.msg.view.phase === "night" && c.role !== "mafia" && chn !== undefined && !(ghostNow && chn === "ghost")) fail(`밤의 비마피아 ${c.nickname} 의 view.me.chat 이 ${chn} 임 (키가 없어야 함)`);
    }
  }
  // (d) 입력 중 도달 범위: 낮 B 의 신호는 모두에게 가지만, 밤 마피아의 신호는 마피아 클라이언트에만, 탈락자·시민 편의 신호는 어디에도 가지 않는다.
  //     시민 편(밤 시민)과 산 사람이 보는 탈락자의 입력 중은 0건이다.
  for (const c of clients) {
    const seats = typingsOf(c).map((f) => f.msg.seat);
    const allowed = new Set([chatB.seat]);
    if (c.role === "mafia" || c === e1Client) allowed.add(talker.seat); // 밤 마피아 입력 중은 마피아와 그 밤의 관전자에게 간다
    if (ghostsAtChat.has(c)) allowed.add(xClient.seat); // 탈락자끼리는 탈락자 채널의 입력 중도 본다
    for (const seat of seats) if (!allowed.has(seat)) fail(`${c.nickname} 가 받을 수 없는 자리(${seat})의 입력 중 신호를 받음`);
  }
  // (e) 막힘: chatReject 는 보낸 클라이언트에만, 보낸 순서와 이유가 기대와 같다. 거절된 줄의 본문은 어느 클라이언트의 프레임에도 없다.
  clients.forEach((c, i) => {
    const got = rejectsOf(c).map((f) => f.msg.why).join(",");
    if (got !== expectedRejects[i].join(",")) fail(`${c.nickname} 가 받은 chatReject [${got}] 가 기대 [${expectedRejects[i].join(",")}] 와 다름`);
    for (const f of c.frames) if (f.raw.includes(REJECT_MARKER)) fail(`${c.nickname} 의 프레임에 거부된 요청의 본문 표식이 있음`);
  });
  // (f) 재접속 chatLog 는 hello 마다 한 번씩 왔다: 첫 접속은 로비 시점이라 비었거나 로비 줄뿐이다.
  for (const c of clients) {
    const logs = c.frames.filter((f) => f.msg?.t === "chatLog");
    if (logs.length !== c.sockets) fail(`${c.nickname} 의 chatLog 프레임 수(${logs.length})가 접속 횟수(${c.sockets})와 다름`);
  }
  info(`자유 채팅: ch all ${DAY_TEXTS.length}줄 seq 연속·전원 동일, 밤 마피아 채널 도달 ${mafiaClients.length}명, 탈락자 채널 1명, 거절 ${expectedRejects.flat().length}건(보낸 쪽에만)`);

  // ---- 밤·아침·관전 단언 (NIGHT-01·02·04·05·06, ELIM-01, 결정 0020·0021) ----
  const framesBetween = (c, fromPhase, toPhase) => {
    const from = firstState(c, fromPhase).at;
    const to = firstState(c, toPhase).at;
    return c.frames.filter((f) => f.at >= from && f.at < to);
  };
  // (a) 밤에 받은 chat·typing 프레임: 살아 있는 비마피아 0, 마피아는 줄 1 이상(보낸 사람 포함)
  for (const c of clients) {
    const inNight = framesBetween(c, "night", "morning");
    const n = inNight.filter((f) => f.msg?.t === "chat").length;
    const typed = inNight.filter((f) => f.msg?.t === "typing").length;
    if (c.role === "mafia" || c === e1Client) {
      if (n < 1) fail(`마피아·밤 관전자 ${c.nickname} 가 밤 chat 프레임을 받지 못함`);
    } else if (n !== 0 || typed !== 0) {
      fail(`마피아도 밤 관전자도 아닌 ${c.nickname} 가 밤 chat·typing 프레임 ${n + typed}개를 받음`);
    }
  }
  // (b) allyPicks 는 마피아 프레임에만, records 는 경찰·마피아·의사 본인 프레임에만 (둘 다 view.me 아래), 줄 키는 역할별(결정 0027-11)
  for (const c of clients) {
    for (const f of c.frames) {
      if (!f.msg) continue;
      const ap = [];
      collectKeyPaths(f.msg, "allyPicks", "", ap);
      if (ap.some((p) => p !== "view.me.allyPicks")) fail(`${c.nickname} 의 프레임에 view.me.allyPicks 밖의 allyPicks 키가 있음`);
      if (ap.length > 0 && c.role !== "mafia") fail(`마피아가 아닌 ${c.nickname} 가 allyPicks 를 받음`);
      const rec = [];
      collectKeyPaths(f.msg, "records", "", rec);
      if (rec.some((p) => p !== "view.me.records")) fail(`${c.nickname} 의 프레임에 view.me.records 밖의 records 키가 있음`);
      if (rec.length > 0 && !(c.role in RECORD_KEYS)) fail(`일지가 없는 역할(${c.role}) ${c.nickname} 가 records 를 받음`);
      for (const line of f.msg.view?.me?.records ?? []) {
        if (Object.keys(line).sort().join(",") !== RECORD_KEYS[c.role]) fail(`${c.nickname}(${c.role}) records 줄 키가 ${RECORD_KEYS[c.role]} 가 아님: ${Object.keys(line).sort().join(",")}`);
      }
    }
  }
  // (c) 아침 day.morning 은 모든 클라이언트가 같고, 탈락자는 지목한 사람이며 players[].alive 와 맞다
  const morningViews = clients.map((c) => firstState(c, "morning").msg.view);
  const morningJson = JSON.stringify(morningViews[0].day.morning);
  morningViews.forEach((v, i) => {
    if (JSON.stringify(v.day?.morning) !== morningJson) fail(`${clients[i].nickname} 의 day.morning 이 다른 클라이언트와 다름`);
  });
  const morning = morningViews[0].day.morning;
  // day.morning 은 탈락자 seat 하나뿐이다(문구 번호·유언 본문·쪽지가 없다, 결정 0061-17). 유언은 chat 카드로만 간다.
  if (Object.keys(morning).sort().join(",") !== "eliminated") fail(`아침 day.morning 의 키가 eliminated 하나가 아님: ${Object.keys(morning).sort().join(",")}`);
  if (morning.eliminated !== targetX) fail(`아침 탈락자가 지목한 seat(${targetX})가 아님: ${morning.eliminated}`);
  morningViews.forEach((v, i) => {
    for (const p of v.players) {
      const wantAlive = p.seat !== targetX && p.seat !== e1Client.seat; // 암살당한 X 와 첫 낮에 처형된 시민만 탈락
      if (p.alive !== wantAlive) fail(`${clients[i].nickname} 의 아침 players seat ${p.seat} 의 alive 가 ${wantAlive} 가 아님: ${p.alive}`);
    }
  });
  // (d) 아침 view 의 역할별 일지 마지막 줄: 경찰 수사, 마피아 암살(전원 같은 줄, died true), 의사 치료(고른 seat)
  const lastRecordOf = (c) => firstState(c, "morning").msg.view.me.records?.at(-1);
  const expectLine = (c, want) => {
    const got = lastRecordOf(c);
    if (JSON.stringify(got) !== JSON.stringify(want)) fail(`${c.nickname}(${c.role}) 아침 일지 마지막 줄이 ${JSON.stringify(want)} 가 아님: ${JSON.stringify(got)}`);
  };
  const lastRecord = lastRecordOf(policeClient);
  if (!lastRecord || lastRecord.n !== 1 || lastRecord.target !== policeTarget || lastRecord.isMafia !== true || Object.keys(lastRecord).sort().join(",") !== "isMafia,n,target") {
    fail(`경찰 아침 수사 기록이 {n:1, target:${policeTarget}, isMafia:true} 가 아님: ${JSON.stringify(lastRecord)}`);
  }
  for (const m of mafiaClients) expectLine(m, { n: 1, target: targetX, died: true });
  if (doctorClient) expectLine(doctorClient, { n: 1, target: doctorClient.seat });
  if (mafiaClients.length > 1) {
    const lines = mafiaClients.map((m) => JSON.stringify(firstState(m, "morning").msg.view.me.records));
    if (new Set(lines).size !== 1) fail("마피아 둘의 아침 일지가 서로 다름 (같은 팀 기록이어야 함)");
  }
  // (e) 관전(결정 0021): 탈락한 사람은 탈락한 단계(처형은 execution, 암살은 morning)부터 모든 state 에 spectate 를 받고, 각 job 이 그 seat 클라이언트의 me.role 과 같다.
  //     그 전 프레임과 살아 있는 클라이언트에는 spectate 키가 없다.
  for (const c of clients) {
    for (const f of c.frames) {
      if (!f.msg) continue;
      const sp = [];
      collectKeyPaths(f.msg, "spectate", "", sp);
      const isGhostNow = c.ghostFrom !== undefined && f.at >= c.ghostFrom && f.msg.t === "state";
      if (!isGhostNow) {
        if (sp.length > 0) fail(`탈락 전·산 ${c.nickname} 의 프레임에 spectate 키가 있음`);
        continue;
      }
      if (sp.length !== 1 || sp[0] !== "view.spectate") fail(`탈락한 ${c.nickname} 의 탈락 이후 state 에 view.spectate 가 하나가 아님: ${sp.join(",")}`);
      const seatsList = f.msg.view.spectate.seats;
      if (!Array.isArray(seatsList) || seatsList.length !== N) fail(`spectate.seats 길이가 ${N} 이 아님`);
      for (const sj of seatsList) {
        const owner = clients.find((x) => x.seat === sj.seat);
        if (!owner || sj.job !== owner.role) fail(`spectate seat ${sj.seat} 의 job(${sj.job})이 그 클라이언트의 역할(${owner?.role})과 다름`);
      }
    }
  }
  // (f) 역할 문자열은 허용 경로에만: 모든 프레임에서 view.me.role·view.day.roles[] (채널 이름 mafia 가 든 ch·lines[].ch·view.me.chat 은 위 채널 단언이 본다),
  //     탈락한 사람의 탈락 이후에는 view.spectate.seats[].job, ended 프레임에는 view.result.seats[].job 도 허용. 처형 단계의 다른 사람 프레임에는 역할 단어가 없다.
  //     마피아 동료 seat·records 의 isMafia·died 는 숫자·불리언이라 문자열 검사에 걸리지 않는다.
  const ROLE_ALLOWED_ALWAYS = ALLOWED_ROLE_STRING_PATHS;
  for (const c of clients) {
    for (const f of c.frames) {
      if (!f.msg) continue;
      const leaves = [];
      collectRoleStringPaths(f.msg, "", leaves);
      const allowSpectate = c.ghostFrom !== undefined && f.at >= c.ghostFrom;
      const allowResult = f.msg.view?.phase === "ended";
      const bad = leaves.filter(
        (l) => !ROLE_ALLOWED_ALWAYS.has(l.path) && !(allowSpectate && l.path === "view.spectate.seats[].job") && !(allowResult && ENDED_ROLE_STRING_PATHS.has(l.path)),
      );
      if (bad.length > 0) fail(`${c.nickname} 의 프레임에 허용 경로 밖 역할 문자열이 있음: ${[...new Set(bad.map((l) => l.path))].join(",")}`);
    }
  }
  // 밤·아침 단계 길이와 아침 마감 일치
  const nightEnds = new Set(clients.map((c) => firstState(c, "night").msg.view.phaseEndsAt));
  if (nightEnds.size !== 1) fail(`night 의 phaseEndsAt 이 클라이언트마다 다름 (${nightEnds.size}종)`);
  const morningEnds = new Set(morningViews.map((v) => v.phaseEndsAt));
  if (morningEnds.size !== 1) fail(`morning 의 phaseEndsAt 이 클라이언트마다 다름 (${morningEnds.size}종)`);
  // 아침 길이(MORN-04, 결정 0061-13): 기본 5 + 피해자 2 + 유언 2 = 9초(쪽지 없음). 모든 클라이언트가 같다.
  if (morningViews.some((v) => v.phaseDurationMs !== 9_000)) fail(`morning phaseDurationMs 가 9000(피해자 + 유언)이 아님: ${morningViews.map((v) => v.phaseDurationMs).join(",")}`);

  for (const c of clients) await closeSocket(c);

  // 에셋: 인물 그림 %40 주소(200 image/png + 하루 캐시)와 OG 이미지
  const figPath = "/characters/table/fig1_boy_brown_default%402x.png";
  const fig = await fetch(`${origin}${figPath}`);
  if (fig.status !== 200) fail(`${figPath} 상태 ${fig.status}`);
  if (!(fig.headers.get("content-type") ?? "").includes("image/png")) fail(`${figPath} 가 image/png 가 아님`);
  // 하루 캐시 헤더는 배포본(Workers 정적 에셋 _headers)의 것이다. 로컬 개발 서버(vite)는 no-cache 를 줘서 로컬 실행에서는 헤더를 보지 않는다.
  if (!isLocal && !(fig.headers.get("cache-control") ?? "").includes("max-age=86400")) fail(`${figPath} 의 Cache-Control 에 max-age=86400 이 없음: ${fig.headers.get("cache-control")}`);
  await fig.arrayBuffer();
  // 가정 A10 기록용: @ 주소는 리다이렉트를 따르지 않고 응답 코드만 출력한다(실패 조건 아님).
  const atRes = await fetch(`${origin}/characters/table/fig1_boy_brown_default@2x.png`, { redirect: "manual" });
  console.log(`  info: @ 주소 응답 ${atRes.status}`);
  const og = await fetch(`${origin}/og.png`);
  if (og.status !== 200) fail(`/og.png 상태 ${og.status}`);
  if (!(og.headers.get("content-type") ?? "").includes("image/png")) fail("/og.png 가 image/png 가 아님");
  await og.arrayBuffer();
  // 배경 WebP(결정 0030): 없는 경로는 SPA 가 index.html 을 200 으로 주므로 content-type·RIFF/WEBP 머리로 파일 존재를 증명한다. 상한은 scenes.test.ts 와 같다.
  for (const [path, maxKB] of [["/backgrounds/bg_game_night.webp", 48], ["/backgrounds/bg_entry_lobby.webp", 64]]) {
    const bg = await fetch(`${origin}${path}`);
    if (bg.status !== 200) fail(`${path} 상태 ${bg.status}`);
    if (!(bg.headers.get("content-type") ?? "").includes("image/webp")) fail(`${path} 가 image/webp 가 아님: ${bg.headers.get("content-type")}`);
    if (!isLocal && !(bg.headers.get("cache-control") ?? "").includes("max-age=86400")) fail(`${path} 의 Cache-Control 에 max-age=86400 이 없음: ${bg.headers.get("cache-control")}`);
    const bytes = new Uint8Array(await bg.arrayBuffer());
    const head = (from, to) => String.fromCharCode(...bytes.subarray(from, to));
    if (head(0, 4) !== "RIFF" || head(8, 12) !== "WEBP") fail(`${path} 가 RIFF…WEBP 머리가 아님`);
    if (bytes.length > maxKB * 1024) fail(`${path} 용량 ${(bytes.length / 1024).toFixed(1)}KB > 상한 ${maxKB}KB`);
  }

  console.log(`SMOKE OK full code=${code} players=${N} spread=${spread}ms discSpread=${discSpread}ms version=${version}`);
}

const args = parseArgs(process.argv.slice(2));
const url = resolveBase(args);

const limitMs = args.stage === "full" && !args.printVersion ? FULL_TOTAL_LIMIT_MS : TOTAL_LIMIT_MS;
const overall = setTimeout(() => fail(`전체 ${limitMs / 1000}초 제한 초과`), limitMs);

try {
  if (args.printVersion) {
    console.log(await getVersion(url.origin));
  } else if (args.stage === "create") {
    await stageCreate(url);
  } else if (args.stage === "full") {
    await stageFull(url, args);
  } else {
    fail(`알 수 없는 단계: ${args.stage}`);
  }
} catch (e) {
  fail(e instanceof Error ? e.message : String(e));
}
clearTimeout(overall);
process.exit(0);
