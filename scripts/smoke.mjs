// 스모크: 배포(또는 로컬) 주소에서 방 만들기 → WebSocket hello → 대기실 상태까지 확인한다.
// full 단계는 한 판 시작부터 낮 한 바퀴(낮 시작 발표 → 직업 공개 → 공개 연출 → 낮 토론 90초 → 서버 타이머로 다음 낮 시작 발표)까지 돈다.
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
const FULL_TOTAL_LIMIT_MS = 240_000;
// 토론 90초 + 여유: 넘기기 없이 서버 타이머가 낮을 넘기는 것을 기다린다.
const DISCUSSION_WAIT_MS = 90_000 + STATE_LIMIT_MS;
const CHAT_FRAME_KEYS = ["at", "seat", "seq", "t", "target", "template"];
const CHAT_ALLOWED_KEYS = new Set(["t", "seq", "seat", "template", "target", "claimedRole", "at"]);
const ALLOWED_PLAYER_KEYS = ["connected", "isHost", "nickname", "seat"];
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
// 허용 전이 표(shared/game/phases.ts 의 next 와 같다). 낮 루프라 끝이 없다: discussion 다음은 다시 dayAnnounce.
const PHASE_NEXT = {
  lobby: ["assigning"],
  assigning: ["roleReveal"],
  roleReveal: ["dayAnnounce"],
  dayAnnounce: ["claim"],
  claim: ["claimReveal"],
  claimReveal: ["discussion"],
  discussion: ["dayAnnounce"],
};
const DAY_PHASES = ["dayAnnounce", "claim", "claimReveal", "discussion"];
const ROLE_IDS = ["mafia", "police", "doctor", "citizen"];
// 주장 값으로 쓰일 수 있는 문자열(직업 + 말 안 함). claimReveal 전에는 허용 경로 밖에 나오면 안 된다.
const CLAIM_STRINGS = new Set([...ROLE_IDS, "none"]);
// claimReveal 전 프레임에서 역할·주장 문자열이 나와도 되는 경로(배열 칸은 [] 로 줄여 비교한다).
const ALLOWED_CLAIM_STRING_PATHS = new Set(["view.me.role", "view.me.claim", "view.day.roles[]"]);
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
async function expectError(client, msg, code, label) {
  const before = client.frames.length;
  client.ws.send(JSON.stringify(msg));
  await waitUntil(() => client.frames.slice(before).some((f) => f.msg?.t === "error"), STATE_LIMIT_MS, `${label} 의 error 프레임이 오지 않음`);
  const err = client.frames.slice(before).find((f) => f.msg?.t === "error");
  if (err.msg.code !== code) fail(`${label} 의 error 가 ${code} 가 아님: ${err.msg.code}`);
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

  // (10) 직업 공개(claim): 서로 다른 직업 둘을 고른다. 4명판은 의사 없이 고른다.
  await waitUntil(() => clients.every((c) => firstState(c, "claim")), STATE_LIMIT_MS + 5000, "모든 클라이언트가 claim 을 받지 못함");
  const roleList = firstState(clients[1], "claim").msg.view.day.roles;
  if (roleList.includes("doctor") !== (N >= 5)) fail(`day.roles 의 의사 포함 여부가 인원(${N})과 맞지 않음: ${roleList.join(",")}`);
  if (roleList.length < 3) fail(`day.roles 가 너무 짧음: ${roleList.join(",")}`);
  const pick1 = roleList[0];
  const pick2 = roleList[1];
  // claim 단계의 say 는 WRONG_PHASE
  await expectError(clients[0], { t: "say", template: "innocent" }, "WRONG_PHASE", "claim 단계 say");
  clients[1].ws.send(JSON.stringify({ t: "claim", claim: pick1 }));
  clients[2].ws.send(JSON.stringify({ t: "claim", claim: pick2 }));
  await waitUntil(() => {
    const done = lastView(host)?.day?.claimDone;
    return Array.isArray(done) && done.includes(clients[1].seat) && done.includes(clients[2].seat);
  }, STATE_LIMIT_MS, "claim 완료 표시(claimDone)가 방장 화면에 오지 않음");

  // (11) 낮 중 참가는 409 GAME_STARTED, 미리보기는 낮 단계 + players 빈 배열
  const late = await http(null, "POST", `/api/rooms/${code}/join`, { nickname: "늦은사람" });
  if (late.status !== 409 || late.data?.error !== "GAME_STARTED") fail(`시작 뒤 참가가 409 GAME_STARTED 가 아님: ${late.status} ${late.data?.error}`);
  const pvDay = await http(null, "GET", `/api/rooms/${code}`);
  if (!DAY_PHASES.includes(pvDay.data?.phase)) fail(`낮 미리보기 phase 가 낮 네 단계 중 하나가 아님: ${pvDay.data?.phase}`);
  if (!Array.isArray(pvDay.data?.players) || pvDay.data.players.length !== 0) fail("낮 미리보기 players 가 빈 배열이 아님");

  // (12) 공개 연출(claimReveal): 고른 두 값과 나머지 none
  await waitUntil(() => clients.every((c) => firstState(c, "claimReveal")), STATE_LIMIT_MS + 10_000, "모든 클라이언트가 claimReveal 을 받지 못함");
  for (const c of clients) {
    const claims = firstState(c, "claimReveal").msg.view.day?.claims;
    if (!Array.isArray(claims) || claims.length !== N) fail(`${c.nickname} 의 claimReveal claims 길이가 ${N} 이 아님`);
    for (const sc of claims) {
      const expected = sc.seat === clients[1].seat ? pick1 : sc.seat === clients[2].seat ? pick2 : "none";
      if (sc.claim !== expected) fail(`${c.nickname} 의 claimReveal seat ${sc.seat} 주장이 ${expected} 가 아님: ${sc.claim}`);
      if (sc.changed !== false) fail(`${c.nickname} 의 claimReveal seat ${sc.seat} 가 첫 낮인데 changed 임`);
    }
  }

  // (13) 낮 토론: 빠른 메시지(chat 프레임)·거부·이모티콘·연장/넘기기 거부·타이머로 다음 낮
  await waitUntil(() => clients.every((c) => firstState(c, "discussion")), STATE_LIMIT_MS, "모든 클라이언트가 discussion 을 받지 못함");
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
    () => clients.every((c) => c.frames.some((f) => f.msg?.t === "emoji" && f.msg.seat === clients[2].seat && f.msg.icon === "smile")),
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

  // 타이머: 넘기기 없이 토론 마감 뒤 모든 클라이언트가 dayAnnounce(day.n 2) 를 받는다
  await waitUntil(() => clients.every((c) => firstState(c, "dayAnnounce", (v) => v.day?.n === 2)), DISCUSSION_WAIT_MS, "토론 마감 뒤 dayAnnounce(day.n 2) 가 모든 클라이언트에 오지 않음");
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
    if (iDisc < 0 || seq[iDisc + 1] !== "dayAnnounce") fail(`${c.nickname} 가 discussion → dayAnnounce 낮 루프를 거치지 않음: ${seq.join(" → ")}`);
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
  // 낮 시작 발표·공개 연출 도착 편차
  const spreadOf = (phase) => {
    const at = clients.map((c) => firstState(c, phase).at);
    return Math.round(Math.max(...at) - Math.min(...at));
  };
  const spread = spreadOf("dayAnnounce");
  const revealSpread = spreadOf("claimReveal");
  if (spread >= DAY_SPREAD_LIMIT_MS) fail(`dayAnnounce 도착 편차 ${spread}ms 가 ${DAY_SPREAD_LIMIT_MS}ms 이상`);
  if (revealSpread >= DAY_SPREAD_LIMIT_MS) fail(`claimReveal 도착 편차 ${revealSpread}ms 가 ${DAY_SPREAD_LIMIT_MS}ms 이상`);

  // 직업 공개 마감 전 누출(T-02-32): claimReveal 을 받기 전의 모든 프레임에서 역할·주장 문자열은 허용 경로에만 있고 claims 키가 없다.
  const picks = new Map([[clients[1], pick1], [clients[2], pick2]]);
  for (const c of clients) {
    const revealIdx = c.frames.findIndex((f) => f.msg?.t === "state" && f.msg.view.phase === "claimReveal");
    if (revealIdx < 0) fail(`${c.nickname} 가 claimReveal 을 받지 못함`);
    for (const f of c.frames.slice(0, revealIdx)) {
      const leaves = [];
      collectClaimStringPaths(f.msg, "", leaves);
      const bad = leaves.filter((l) => !ALLOWED_CLAIM_STRING_PATHS.has(l.path));
      if (bad.length > 0) fail(`${c.nickname} 의 claimReveal 전 프레임에 허용 경로 밖 역할·주장 문자열이 있음: ${bad.map((l) => l.path).join(",")}`);
      const claimsPaths = [];
      collectKeyPaths(f.msg, "claims", "", claimsPaths);
      if (claimsPaths.length > 0) fail(`${c.nickname} 의 claimReveal 전 프레임에 claims 키가 있음`);
      const myClaim = f.msg.view?.me?.claim;
      if (myClaim !== undefined && myClaim !== (picks.get(c) ?? undefined)) fail(`${c.nickname} 의 claimReveal 전 me.claim 이 본인 선택이 아님: ${myClaim}`);
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

  console.log(`SMOKE OK full code=${code} players=${N} spread=${spread}ms reveal=${revealSpread}ms version=${version}`);
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
