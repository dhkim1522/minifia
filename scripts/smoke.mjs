// 스모크: 배포(또는 로컬) 주소에서 방 만들기 → WebSocket hello → 대기실 상태까지 확인한다.
// full 단계는 한 판 시작부터 낮 한 바퀴(낮 시작 발표 → 직업 주장 차례 한 바퀴(한 명 8초, 결정 0023·0027) → 낮 토론 90초) → 밤 30초(역할별 행동·마피아 채팅)
// → 아침 5초(탈락 발표) → 서버 타이머로 2일차 낮 시작 발표까지 돈다. 탈락한 클라이언트는 그 아침부터 관전 정보(spectate)를 받는다(결정 0021).
// 방장 연장·넘기기는 없다(결정 0017-5). 빠른 메시지는 state 가 아니라 chat 프레임으로 온다(결정 0017-7).
// Node 22.12+ 내장 fetch·전역 WebSocket 만 쓴다. 셸 명령·외부 패키지 없음 (Windows 에서도 같은 명령).
//
// 사용법:
//   node scripts/smoke.mjs <기준 주소>           예: http://localhost:5173
//   node scripts/smoke.mjs --prod                 같은 폴더의 prod-url.txt 주소
//   옵션: --stage create (기본값) | full | --print-version
//         --players N (full 단계 인원, 4~8, 기본 5)
//         --previous-version V (full 단계: /api/health 의 version 이 V 와 같으면 실패 — 재배포 확인)
// 토큰 값은 어떤 출력에도 찍지 않는다.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const TOTAL_LIMIT_MS = 30_000;
const STATE_LIMIT_MS = 10_000;
const FULL_TOTAL_LIMIT_MS = 420_000; // 시작 → 2일차 dayAnnounce 약 170초 + 여유 (claim 은 최대 인원 × 8초)
// 토론 90초 + 여유: 넘기기 없이 서버 타이머가 낮을 넘기는 것을 기다린다.
const DISCUSSION_WAIT_MS = 90_000 + STATE_LIMIT_MS;
// 밤 30초, 아침 5초 + 여유
const NIGHT_WAIT_MS = 30_000 + STATE_LIMIT_MS;
const MORNING_WAIT_MS = 5_000 + STATE_LIMIT_MS;
const CHAT_FRAME_KEYS = ["at", "seat", "seq", "t", "target", "template"];
const CHAT_ALLOWED_KEYS = new Set(["t", "seq", "seat", "template", "target", "claimedRole", "at"]);
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
// 허용 전이 표(shared/game/phases.ts 의 next 와 같다). 낮 루프라 끝이 없다: discussion → night → morning → 다시 dayAnnounce.
const PHASE_NEXT = {
  lobby: ["assigning"],
  assigning: ["roleReveal"],
  roleReveal: ["dayAnnounce"],
  dayAnnounce: ["claim"],
  claim: ["discussion"],
  discussion: ["night"],
  night: ["morning"],
  morning: ["dayAnnounce"],
};
const DAY_PHASES = ["dayAnnounce", "claim", "discussion", "night", "morning"];
const ROLE_IDS = ["mafia", "police", "doctor", "citizen"];
// 주장 값으로 쓰일 수 있는 문자열(직업 + 말 안 함). 허용 경로 밖에 나오면 안 된다.
const CLAIM_STRINGS = new Set([...ROLE_IDS, "none"]);
// 역할·주장 문자열이 나와도 되는 경로(배열 칸은 [] 로 줄여 비교한다, 결정 0027-6).
// 차례가 끝나기 전에는 day.claimLog 에 그 차례 줄이 없으므로 고른 값은 어느 프레임에도 이 경로로 새지 않는다.
// 탈락자의 view.spectate.seats[].job 은 탈락 뒤 프레임에서만 따로 허용한다.
const ALLOWED_CLAIM_STRING_PATHS = new Set(["view.me.role", "view.day.roles[]", "view.day.claimLog[].claim"]);
// 서버 전용 상태 키(결정 0027-3): 어떤 프레임에도 이름이 나오면 안 된다. claims 와 옛 완료 표시 키는 삭제된 옛 키다.
// 옛 이름이 scripts 에 문자열로 남지 않았는지 grep 으로 확인하므로 옛 완료 표시 키는 조각으로 잇는다.
const SERVER_ONLY_KEYS = ["claimPick", "claimOrder", "claimIdx", "claimStart", "claim" + "Done", "claims"];
// 직업 주장 차례 하나의 길이(shared/game/phases.ts CLAIM_TURN_MS)
const CLAIM_TURN_MS = 8_000;
// 역할별 일지 줄의 키 집합(결정 0027-11)
const RECORD_KEYS = { police: "isMafia,n,target", mafia: "died,n,target", doctor: "n,target" };
const REJECT_MARKER = "SMOKE_REJECT_MARKER_7f3a";

function fail(reason) {
  console.log(`SMOKE FAIL: ${reason}`);
  process.exit(1);
}

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
  try {
    return new URL(base);
  } catch {
    return fail(`주소를 읽을 수 없음: ${base}`);
  }
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

// 값이 role·주장 문자열인 잎을 경로와 함께 모은다. 배열 인덱스는 [] 로 줄인다.
function collectClaimStringPaths(value, path, out) {
  if (typeof value === "string") {
    if (CLAIM_STRINGS.has(value)) out.push({ path, value });
  } else if (Array.isArray(value)) value.forEach((v) => collectClaimStringPaths(v, `${path}[]`, out));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) collectClaimStringPaths(v, path ? `${path}.${k}` : k, out);
  }
}

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

  // 직업 주장 응답기(결정 0023): 상태 프레임에서 claim 단계이고 day.turn.seat 가 내 seat 이면 한 번만 보낸다(키 = 일차:seat).
  //   방장·4번째부터는 즉시 말 안 함(none), clients[1]·clients[2] 는 서로 다른 직업, clients[3] 은 일부러 보내지 않아 8초 시간 초과(none)를 건넌다.
  //   보낸 시각은 일찍 고른 차례가 2초 안에 다음 차례로 넘어가는지 보는 데 쓴다.
  const claimSent = new Map(); // `${n}:${seat}` → { at, claim, idx }
  const claimDriver = setInterval(() => {
    clients.forEach((c, idx) => {
      const v = lastView(c);
      if (!v || v.phase !== "claim" || v.day?.turn?.seat !== c.seat) return;
      const key = `${v.day.n}:${c.seat}`;
      if (claimSent.has(key) || idx === 3) return; // idx 3 은 시간 초과 경로라 보내지 않는다
      if (!c.ws || c.ws.readyState !== WebSocket.OPEN) return;
      const claim = idx === 1 ? v.day.roles[0] : idx === 2 ? v.day.roles[1] : "none";
      claimSent.set(key, { at: performance.now(), claim, idx });
      c.ws.send(JSON.stringify({ t: "claim", claim }));
    });
  }, 50);

  // (7) 시작
  host.ws.send(JSON.stringify({ t: "start" }));

  // (8) 두 번째 클라이언트: roleReveal 에서 소켓을 닫고 같은 토큰으로 다시 붙음
  const re = clients[1];
  await waitUntil(() => states(re).some((f) => f.msg.view.phase === "roleReveal"), STATE_LIMIT_MS + 5000, "스모크2 가 roleReveal 을 받지 못함");
  const before = states(re).filter((f) => f.msg.view.phase === "roleReveal").at(-1).msg.view.me;
  if (before.role === undefined) fail("스모크2 의 roleReveal state 에 me.role 이 없음");
  await closeSocket(re);
  re.expectClose = false;
  re.unexpectedClose = null;
  const framesBefore = re.frames.length;
  await openSocket(wsBase, code, re);
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

  // (10) 직업 주장 차례 한 바퀴(claim): 방장부터 seat 오름차순으로 한 명씩, 한 차례 8초(결정 0023·0027)
  await waitUntil(() => clients.every((c) => firstState(c, "claim")), STATE_LIMIT_MS + 5000, "모든 클라이언트가 claim 을 받지 못함");
  const roleList = firstState(clients[1], "claim").msg.view.day.roles;
  if (roleList.includes("doctor") !== (N >= 5)) fail(`day.roles 의 의사 포함 여부가 인원(${N})과 맞지 않음: ${roleList.join(",")}`);
  if (roleList.length < 3) fail(`day.roles 가 너무 짧음: ${roleList.join(",")}`);
  const pick1 = roleList[0];
  const pick2 = roleList[1];
  // 차례 순서: 방장 seat 에서 시작해 seat 오름차순(끝에서 처음으로 이어짐), 1일차는 전원 생존
  const allSeats = clients.map((c) => c.seat).sort((a, b) => a - b);
  const startAt = allSeats.indexOf(host.seat);
  const expectedOrder = [...allSeats.slice(startAt), ...allSeats.slice(0, startAt)];
  const firstTurn = firstState(host, "claim").msg.view.day?.turn?.seat;
  if (firstTurn !== host.seat) fail(`1일차 첫 차례 seat 가 방장(${host.seat})이 아님: ${firstTurn}`);
  // clients[3] 의 차례(응답기가 보내지 않아 8초 시간 초과)에서 거부·이모티콘을 시험한다. 그 차례는 8초 동안 이어진다.
  await waitUntil(() => {
    const v = lastView(host);
    return v?.phase === "claim" && v.day?.turn?.seat === clients[3].seat;
  }, STATE_LIMIT_MS + 5000, "방장 화면에 스모크4 의 차례가 오지 않음");
  // 차례가 지난 사람(clients[1])·아직 오지 않은 사람(5명 이상이면 clients[4])의 claim 은 WRONG_PHASE 이고 이어 state 가 온다
  await expectError(clients[1], { t: "claim", claim: pick1 }, "WRONG_PHASE", "차례가 지난 사람의 claim", true);
  if (N >= 5) await expectError(clients[4], { t: "claim", claim: pick1 }, "WRONG_PHASE", "차례가 오지 않은 사람의 claim", true);
  // claim 단계의 say 는 WRONG_PHASE
  await expectError(clients[0], { t: "say", template: "innocent" }, "WRONG_PHASE", "claim 단계 say");
  // claim 중 이모티콘은 보낼 수 있고 모두에게 방송된다(차례와 무관, 결정 0027-8)
  const claimEmojiAt = performance.now();
  clients[2].ws.send(JSON.stringify({ t: "emoji", icon: "heart" }));
  await waitUntil(
    () => clients.every((c) => c.frames.some((f) => f.at >= claimEmojiAt && f.msg?.t === "emoji" && f.msg.seat === clients[2].seat && f.msg.icon === "heart")),
    STATE_LIMIT_MS,
    "claim 중 이모티콘 emoji 프레임이 모든 클라이언트에 오지 않음",
  );

  // (11) 낮 중 참가는 409 GAME_STARTED, 미리보기는 낮 단계 + players 빈 배열
  const late = await http(null, "POST", `/api/rooms/${code}/join`, { nickname: "늦은사람" });
  if (late.status !== 409 || late.data?.error !== "GAME_STARTED") fail(`시작 뒤 참가가 409 GAME_STARTED 가 아님: ${late.status} ${late.data?.error}`);
  const pvDay = await http(null, "GET", `/api/rooms/${code}`);
  if (!DAY_PHASES.includes(pvDay.data?.phase)) fail(`낮 미리보기 phase 가 낮 단계 중 하나가 아님: ${pvDay.data?.phase}`);
  if (!Array.isArray(pvDay.data?.players) || pvDay.data.players.length !== 0) fail("낮 미리보기 players 가 빈 배열이 아님");

  // (12) discussion 진입: 모든 클라이언트의 day.claimLog 가 같고 기대값(고른 값·시간 초과 none)이다
  await waitUntil(() => clients.every((c) => firstState(c, "discussion")), CLAIM_TURN_MS * N + STATE_LIMIT_MS, "모든 클라이언트가 discussion 을 받지 못함");
  const discLogs = clients.map((c) => firstState(c, "discussion").msg.view.day?.claimLog);
  const claimLog = discLogs[0];
  discLogs.forEach((lg, i) => {
    if (JSON.stringify(lg) !== JSON.stringify(claimLog)) fail(`${clients[i].nickname} 의 discussion claimLog 가 방장과 다름`);
  });
  if (!Array.isArray(claimLog) || claimLog.length !== N) fail(`discussion claimLog 길이가 ${N} 이 아님: ${claimLog?.length}`);
  claimLog.forEach((e, k) => {
    if (Object.keys(e).sort().join(",") !== "claim,n,seat") fail(`claimLog 줄 키 집합이 다름: ${Object.keys(e).sort().join(",")}`);
    if (e.n !== 1) fail(`claimLog ${k}번째 줄의 n 이 1 이 아님: ${e.n}`);
    if (e.seat !== expectedOrder[k]) fail(`claimLog ${k}번째 줄 seat ${e.seat} 가 차례 순서 ${expectedOrder[k]} 와 다름`);
    const idx = clients.findIndex((c) => c.seat === e.seat);
    const expected = idx === 1 ? pick1 : idx === 2 ? pick2 : "none"; // clients[3] 은 시간 초과라 none
    if (e.claim !== expected) fail(`claimLog seat ${e.seat}(스모크${idx + 1}) 주장이 ${expected} 가 아님: ${e.claim}`);
  });
  // 호스트 프레임으로 본 차례: 순서가 기대와 같고, 시간 초과 차례는 실제로 8초 가까이 걸렸고, 일찍 고른 차례는 송신 후 2초 안에 다음으로 넘어갔다
  const hostClaimStates = states(host).filter((f) => f.msg.view.phase === "claim" && f.msg.view.day?.n === 1);
  const seenOrder = [];
  for (const f of hostClaimStates) if (seenOrder.at(-1) !== f.msg.view.day.turn.seat) seenOrder.push(f.msg.view.day.turn.seat);
  if (seenOrder.join(",") !== expectedOrder.join(",")) fail(`방장이 본 차례 순서 [${seenOrder}] 가 기대 [${expectedOrder}] 와 다름`);
  const timeoutStartAt = hostClaimStates.find((f) => f.msg.view.day.turn.seat === clients[3].seat).at;
  const afterTimeout = states(host).find((f) => f.at > timeoutStartAt && (f.msg.view.phase !== "claim" || f.msg.view.day.turn.seat !== clients[3].seat));
  const timeoutMs = Math.round(afterTimeout.at - timeoutStartAt);
  if (timeoutMs < CLAIM_TURN_MS - 1000) fail(`시간 초과 차례가 ${timeoutMs}ms 만에 끝남 (기대 약 ${CLAIM_TURN_MS}ms)`);
  let slowestEarly = 0;
  for (const [key, sent] of claimSent) {
    if (!key.startsWith("1:")) continue;
    const seat = Number(key.split(":")[1]);
    const next = states(host).find((f) => f.at >= sent.at && f.msg.view.day?.claimLog?.some((e) => e.n === 1 && e.seat === seat));
    if (!next) fail(`seat ${seat} 가 고른 뒤 claimLog 에 그 줄이 든 state 가 방장에게 오지 않음`);
    const lag = Math.round(next.at - sent.at);
    if (lag >= 2000) fail(`seat ${seat} 가 일찍 고른 뒤 ${lag}ms 가 지나서야 다음 차례 state 가 옴 (2초 안이어야 함)`);
    slowestEarly = Math.max(slowestEarly, lag);
  }
  console.log(`  info: 차례 순서 [${seenOrder}], 시간 초과 차례 ${timeoutMs}ms, 일찍 고른 뒤 다음 state 최대 ${slowestEarly}ms`);

  // (13) 낮 토론: 빠른 메시지(chat 프레임)·거부·이모티콘·연장/넘기기 거부·타이머로 다음 낮
  const discEnds = new Set(clients.map((c) => firstState(c, "discussion").msg.view.phaseEndsAt));
  if (discEnds.size !== 1) fail(`discussion 의 phaseEndsAt 이 클라이언트마다 다름 (${discEnds.size}종)`);
  const endsBefore = [...discEnds][0];
  const durBefore = firstState(host, "discussion").msg.view.phaseDurationMs;
  if (durBefore !== 90_000) fail(`discussion phaseDurationMs 가 90000 이 아님: ${durBefore}`);

  // 메시지: seat = 보낸 사람, 모든 클라이언트가 chat 프레임을 받는다(state 로는 오지 않는다)
  const isSuspectChat = (f) => f.msg?.t === "chat" && f.msg.seat === clients[1].seat && f.msg.template === "suspect" && f.msg.target === clients[2].seat;
  clients[1].ws.send(JSON.stringify({ t: "say", template: "suspect", target: clients[2].seat }));
  await waitUntil(
    () => clients.every((c) => c.frames.some(isSuspectChat)),
    STATE_LIMIT_MS,
    "빠른 메시지 chat 프레임이 모든 클라이언트에 오지 않음",
  );
  const chatKeys = Object.keys(host.frames.find(isSuspectChat).msg).sort().join(",");
  if (chatKeys !== CHAT_FRAME_KEYS.join(",")) fail(`chat 프레임 키 집합이 다름: ${chatKeys} (기대 ${CHAT_FRAME_KEYS.join(",")})`);
  // 거부: 2초 안의 두 번째 say → RATE_LIMITED, 모르는 키(text)가 붙은 say → BAD_MESSAGE
  await expectError(clients[1], { t: "say", template: "trust", target: clients[2].seat }, "RATE_LIMITED", "2초 안의 두 번째 say");
  await expectError(clients[1], { t: "say", template: "suspect", target: clients[2].seat, text: REJECT_MARKER }, "BAD_MESSAGE", "text 키가 붙은 say");
  // 이모티콘: 2.1초 뒤 clients[2] 의 smile 이 모든 클라이언트에 emoji 프레임으로 간다
  await sleep(2100);
  clients[2].ws.send(JSON.stringify({ t: "emoji", icon: "smile" }));
  await waitUntil(
    () => clients.every((c) => c.frames.some((f) => f.at >= firstState(c, "discussion").at && f.msg?.t === "emoji" && f.msg.seat === clients[2].seat && f.msg.icon === "smile")),
    STATE_LIMIT_MS,
    "이모티콘 emoji 프레임이 모든 클라이언트에 오지 않음",
  );
  // 거부된 요청은 메시지를 남기지 않는다: 방장이 받은 clients[1] 의 chat 프레임은 정확히 하나
  const nChats = host.frames.filter((f) => f.msg?.t === "chat" && f.msg.seat === clients[1].seat).length;
  if (nChats !== 1) fail(`거부 뒤 방장이 받은 clients[1] 의 chat 프레임이 하나가 아님: ${nChats}`);

  // 연장·넘기기는 스키마에 없다(결정 0017-5): 손님·방장 모두 BAD_MESSAGE, 마감은 그대로
  await expectError(clients[1], { t: "extend" }, "BAD_MESSAGE", "손님 extend");
  await expectError(clients[1], { t: "skip" }, "BAD_MESSAGE", "손님 skip");
  await expectError(host, { t: "extend" }, "BAD_MESSAGE", "방장 extend");
  await expectError(host, { t: "skip" }, "BAD_MESSAGE", "방장 skip");
  await sleep(500);
  for (const c of clients) {
    const v = lastView(c);
    if (v.phase !== "discussion") fail(`${c.nickname} 가 extend·skip 거부 뒤 discussion 이 아님: ${v.phase}`);
    if (v.phaseEndsAt !== endsBefore || v.phaseDurationMs !== 90_000) fail(`${c.nickname} 의 discussion 마감이 extend·skip 시도 뒤 바뀜: ${v.phaseEndsAt} / ${v.phaseDurationMs}`);
  }

  // (14) 밤: 토론 마감 뒤 모든 클라이언트가 night 를 받는다(넘기기 없이 서버 타이머)
  await waitUntil(() => clients.every((c) => firstState(c, "night")), DISCUSSION_WAIT_MS, "토론 마감 뒤 night 가 모든 클라이언트에 오지 않음");
  for (const c of clients) {
    const nv = firstState(c, "night").msg.view;
    if (nv.day?.n !== 1) fail(`${c.nickname} 의 night 의 day.n 이 1 이 아님: ${nv.day?.n}`);
    if (nv.phaseDurationMs !== 30_000) fail(`${c.nickname} 의 night phaseDurationMs 가 30000 이 아님: ${nv.phaseDurationMs}`);
    c.role = nv.me.role; // 스크립트는 전지적이다: 자기 view.me.role 로 행동시킨다
    if (!ROLE_IDS.includes(c.role)) fail(`${c.nickname} 의 night view 에 me.role 이 없음`);
  }
  const mafiaClients = clients.filter((c) => c.role === "mafia");
  const policeClient = clients.find((c) => c.role === "police");
  const doctorClient = clients.find((c) => c.role === "doctor");
  const citizenClients = clients.filter((c) => c.role === "citizen");
  if (mafiaClients.length < 1 || !policeClient || citizenClients.length < 2) fail("밤 시작 때 역할 구성이 이상함");
  if ((doctorClient !== undefined) !== (N >= 5)) fail(`의사 유무가 인원(${N})과 맞지 않음`);
  // 결정적 행동: 마피아 전원 → 가장 작은 시민 seat X, 경찰 → 가장 작은 마피아 seat, 의사 → 자신
  const targetX = Math.min(...citizenClients.map((c) => c.seat));
  const xClient = clients.find((c) => c.seat === targetX);
  const policeTarget = Math.min(...mafiaClients.map((c) => c.seat));
  const nightStartAt = (c) => firstState(c, "night").at;
  const hasPicked = (c, seat) => lastView(c)?.phase === "night" && lastView(c).me.pick === seat;
  for (const m of mafiaClients) m.ws.send(JSON.stringify({ t: "pick", target: targetX }));
  policeClient.ws.send(JSON.stringify({ t: "pick", target: policeTarget }));
  if (doctorClient) doctorClient.ws.send(JSON.stringify({ t: "pick", target: doctorClient.seat }));
  const actors = [...mafiaClients.map((m) => [m, targetX]), [policeClient, policeTarget], ...(doctorClient ? [[doctorClient, doctorClient.seat]] : [])];
  await waitUntil(() => actors.every(([c, seat]) => hasPicked(c, seat)), STATE_LIMIT_MS, "밤 행동 뒤 본인 선택(me.pick)이 행위자 화면에 오지 않음");
  // 마피아 한 명이 밤 채팅 → 2초 뒤 이모티콘. 살아 있는 비마피아에게는 chat·emoji 프레임이 가지 않는다.
  const talker = mafiaClients[0];
  talker.ws.send(JSON.stringify({ t: "say", template: "nightTarget", target: targetX }));
  await waitUntil(
    () => mafiaClients.every((m) => m.frames.some((f) => f.at >= nightStartAt(m) && f.msg?.t === "chat" && f.msg.template === "nightTarget" && f.msg.target === targetX)),
    STATE_LIMIT_MS,
    "밤 마피아 채팅 chat 프레임이 마피아 클라이언트에 오지 않음",
  );
  // 마피아가 아닌 사람의 밤 say 는 WRONG_PHASE (살아 있는 비마피아, 결정 0020-7)
  await expectError(citizenClients[0], { t: "say", template: "nightAgree" }, "WRONG_PHASE", "밤 시민의 say");
  await sleep(2100);
  talker.ws.send(JSON.stringify({ t: "emoji", icon: "smile" }));
  await waitUntil(
    () => mafiaClients.every((m) => m.frames.some((f) => f.at >= nightStartAt(m) && f.msg?.t === "emoji" && f.msg.seat === talker.seat)),
    STATE_LIMIT_MS,
    "밤 마피아 이모티콘 emoji 프레임이 마피아 클라이언트에 오지 않음",
  );

  // (15) 아침: 모든 클라이언트가 morning 을, 그다음 2일차 dayAnnounce 를 서버 타이머로 받는다
  await waitUntil(() => clients.every((c) => firstState(c, "morning")), NIGHT_WAIT_MS, "밤 마감 뒤 morning 이 모든 클라이언트에 오지 않음");
  await waitUntil(() => clients.every((c) => firstState(c, "dayAnnounce", (v) => v.day?.n === 2)), MORNING_WAIT_MS, "아침 마감 뒤 dayAnnounce(day.n 2) 가 모든 클라이언트에 오지 않음");
  clearInterval(claimDriver); // 2일차 claim 은 시험하지 않는다(uat-day.mjs 가 본다)
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
    const iDisc = seq.indexOf("discussion");
    if (iDisc < 0 || seq[iDisc + 1] !== "night") fail(`${c.nickname} 의 discussion 다음이 night 가 아님: ${seq.join(" → ")}`);
    if (seq[iDisc + 2] !== "morning") fail(`${c.nickname} 의 night 다음이 morning 이 아님: ${seq.join(" → ")}`);
    if (seq[iDisc + 3] !== "dayAnnounce") fail(`${c.nickname} 의 morning 다음이 dayAnnounce 가 아님: ${seq.join(" → ")}`);
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
      if (got.join(",") !== expected.join(",")) fail(`마피아 ${c.nickname} 의 allies [${got}] 가 다른 마피아 seat [${expected}] 와 다름 (${v.phase})`);
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

  // 직업 주장 누출(T-03.1-41, 결정 0027-3·6): 서버 전용 키는 어떤 프레임에도 없고, claim 단계 프레임에서는
  // 역할·주장 문자열이 허용 경로에만 있으며 day.claimLog 는 지금 차례보다 앞선 차례들의 줄뿐이다(끝나지 않은 차례의 선택은 없다).
  for (const c of clients) {
    for (const f of c.frames) {
      if (!f.msg) continue;
      for (const key of SERVER_ONLY_KEYS) {
        const kp = [];
        collectKeyPaths(f.msg, key, "", kp);
        if (kp.length > 0) fail(`${c.nickname} 의 프레임에 서버 전용·삭제된 키 ${key} 가 있음: ${kp.join(",")}`);
      }
    }
    for (const f of states(c)) {
      const v = f.msg.view;
      if (v.phase !== "claim") {
        if (v.day?.turn !== undefined) fail(`${c.nickname} 의 ${v.phase} 프레임에 day.turn 이 있음 (claim 단계에서만)`);
        continue;
      }
      if (v.phaseDurationMs !== CLAIM_TURN_MS) fail(`${c.nickname} 의 claim phaseDurationMs 가 ${CLAIM_TURN_MS} 가 아님: ${v.phaseDurationMs}`);
      const leaves = [];
      collectClaimStringPaths(f.msg, "", leaves);
      const bad = leaves.filter((l) => !ALLOWED_CLAIM_STRING_PATHS.has(l.path));
      if (bad.length > 0) fail(`${c.nickname} 의 claim 프레임에 허용 경로 밖 역할·주장 문자열이 있음: ${bad.map((l) => l.path).join(",")}`);
      if (v.day?.n !== 1) continue;
      const turnIdx = expectedOrder.indexOf(v.day.turn?.seat);
      if (turnIdx < 0) fail(`${c.nickname} 의 claim 프레임 day.turn.seat 가 차례 순서 밖: ${v.day.turn?.seat}`);
      const loggedSeats = (v.day.claimLog ?? []).filter((e) => e.n === 1).map((e) => e.seat);
      if (loggedSeats.join(",") !== expectedOrder.slice(0, turnIdx).join(",")) {
        fail(`${c.nickname} 의 claim 프레임 claimLog seat [${loggedSeats}] 가 지금 차례(${v.day.turn.seat}) 앞선 차례들 [${expectedOrder.slice(0, turnIdx)}] 와 다름`);
      }
    }
  }
  // 결정 0017-7: state 어디에도 messages·extendUsed 키가 없고, chat 프레임은 허용 키만 쓰며 id·role·token 이 없다(T-02-48)
  for (const c of clients) {
    for (const f of states(c)) {
      for (const key of ["messages", "extendUsed"]) {
        const paths = [];
        collectKeyPaths(f.msg, key, "", paths);
        if (paths.length > 0) fail(`${c.nickname} 의 state 프레임에 ${key} 키가 있음: ${paths.join(",")}`);
      }
    }
    for (const f of c.frames) {
      if (f.msg?.t !== "chat") continue;
      const bad = Object.keys(f.msg).filter((k) => !CHAT_ALLOWED_KEYS.has(k));
      if (bad.length > 0) fail(`${c.nickname} 의 chat 프레임에 허용 밖 키가 있음: ${bad.join(",")}`);
      for (const key of ["id", "role", "token"]) if (key in f.msg) fail(`${c.nickname} 의 chat 프레임에 ${key} 키가 있음`);
    }
  }
  // 거부된 요청의 표식은 다른 클라이언트의 어떤 프레임에도 없다(COMM-04)
  clients.forEach((c, i) => {
    if (i === 1) return;
    for (const f of c.frames) if (f.raw.includes(REJECT_MARKER)) fail(`${c.nickname} 의 프레임에 거부된 요청의 표식이 있음`);
  });

  // ---- 밤·아침·관전 단언 (NIGHT-01·02·04·05·06, ELIM-01, 결정 0020·0021) ----
  const framesBetween = (c, fromPhase, toPhase) => {
    const from = firstState(c, fromPhase).at;
    const to = firstState(c, toPhase).at;
    return c.frames.filter((f) => f.at >= from && f.at < to);
  };
  // (a) 밤에 받은 chat·emoji 프레임: 살아 있는 비마피아 0, 마피아 1 이상
  for (const c of clients) {
    const n = framesBetween(c, "night", "morning").filter((f) => f.msg?.t === "chat" || f.msg?.t === "emoji").length;
    if (c.role === "mafia") {
      if (n < 1) fail(`마피아 ${c.nickname} 가 밤 chat·emoji 프레임을 받지 못함`);
    } else if (n !== 0) {
      fail(`마피아가 아닌 ${c.nickname} 가 밤 chat·emoji 프레임 ${n}개를 받음`);
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
  if (morning.eliminated !== targetX) fail(`아침 탈락자가 지목한 seat(${targetX})가 아님: ${morning.eliminated}`);
  if (!Number.isInteger(morning.phrase) || morning.phrase < 1 || morning.phrase > 8) fail(`아침 문구 번호가 1..8 정수가 아님: ${morning.phrase}`);
  morningViews.forEach((v, i) => {
    for (const p of v.players) {
      if (p.alive !== (p.seat !== targetX)) fail(`${clients[i].nickname} 의 아침 players seat ${p.seat} 의 alive 가 ${p.seat !== targetX} 가 아님: ${p.alive}`);
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
  // (e) 관전: 탈락한 X 는 morning 이전 프레임에 spectate 키가 없고 그 아침부터 받으며, 각 job 이 그 seat 클라이언트의 me.role 과 같다. 그 밖의 클라이언트에는 spectate 가 없다.
  const xMorningAt = firstState(xClient, "morning").at;
  for (const f of xClient.frames) {
    if (!f.msg || f.msg.t !== "state") continue;
    const sp = [];
    collectKeyPaths(f.msg, "spectate", "", sp);
    if (f.at < xMorningAt && sp.length > 0) fail(`탈락 전(${xClient.nickname}) 프레임에 spectate 키가 있음`);
    if (f.at >= xMorningAt) {
      if (sp.length !== 1 || sp[0] !== "view.spectate") fail(`탈락한 ${xClient.nickname} 의 아침 이후 state 에 view.spectate 가 하나가 아님: ${sp.join(",")}`);
      const seatsList = f.msg.view.spectate.seats;
      if (!Array.isArray(seatsList) || seatsList.length !== N) fail(`spectate.seats 길이가 ${N} 이 아님`);
      for (const sj of seatsList) {
        const owner = clients.find((c) => c.seat === sj.seat);
        if (!owner || sj.job !== owner.role) fail(`spectate seat ${sj.seat} 의 job(${sj.job})이 그 클라이언트의 역할(${owner?.role})과 다름`);
      }
    }
  }
  for (const c of clients) {
    if (c === xClient) continue;
    for (const f of c.frames) {
      const sp = [];
      if (f.msg) collectKeyPaths(f.msg, "spectate", "", sp);
      if (sp.length > 0) fail(`살아 있는 ${c.nickname} 의 프레임에 spectate 키가 있음`);
    }
  }
  // (f) 역할 문자열은 허용 경로에만: 모든 프레임에서 view.me.role·view.day.roles[]·view.day.claimLog[].claim, 탈락한 X 의 아침 이후에는 view.spectate.seats[].job 도 허용.
  //     마피아 동료 seat·records 의 isMafia·died 는 숫자·불리언이라 문자열 검사에 걸리지 않는다.
  const ROLE_ALLOWED_ALWAYS = ALLOWED_CLAIM_STRING_PATHS;
  for (const c of clients) {
    for (const f of c.frames) {
      if (!f.msg) continue;
      const leaves = [];
      collectClaimStringPaths(f.msg, "", leaves);
      const allowSpectate = c === xClient && f.at >= xMorningAt;
      const bad = leaves.filter((l) => !ROLE_ALLOWED_ALWAYS.has(l.path) && !(allowSpectate && l.path === "view.spectate.seats[].job"));
      if (bad.length > 0) fail(`${c.nickname} 의 프레임에 허용 경로 밖 역할 문자열이 있음: ${[...new Set(bad.map((l) => l.path))].join(",")}`);
    }
  }
  // 밤·아침 단계 길이와 아침 마감 일치
  const nightEnds = new Set(clients.map((c) => firstState(c, "night").msg.view.phaseEndsAt));
  if (nightEnds.size !== 1) fail(`night 의 phaseEndsAt 이 클라이언트마다 다름 (${nightEnds.size}종)`);
  const morningEnds = new Set(morningViews.map((v) => v.phaseEndsAt));
  if (morningEnds.size !== 1) fail(`morning 의 phaseEndsAt 이 클라이언트마다 다름 (${morningEnds.size}종)`);
  if (morningViews.some((v) => v.phaseDurationMs !== 5_000)) fail("morning phaseDurationMs 가 5000 이 아님");

  for (const c of clients) await closeSocket(c);

  // 에셋: 인물 그림 %40 주소(200 image/png + 하루 캐시)와 OG 이미지
  const figPath = "/characters/table/fig1_boy_brown_default%402x.png";
  const fig = await fetch(`${origin}${figPath}`);
  if (fig.status !== 200) fail(`${figPath} 상태 ${fig.status}`);
  if (!(fig.headers.get("content-type") ?? "").includes("image/png")) fail(`${figPath} 가 image/png 가 아님`);
  if (!(fig.headers.get("cache-control") ?? "").includes("max-age=86400")) fail(`${figPath} 의 Cache-Control 에 max-age=86400 이 없음: ${fig.headers.get("cache-control")}`);
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
    if (!(bg.headers.get("cache-control") ?? "").includes("max-age=86400")) fail(`${path} 의 Cache-Control 에 max-age=86400 이 없음: ${bg.headers.get("cache-control")}`);
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
