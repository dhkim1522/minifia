// 스모크: 배포(또는 로컬) 주소에서 방 만들기 → WebSocket hello → 대기실 상태까지 확인한다.
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
const FULL_TOTAL_LIMIT_MS = 120_000;
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
const PHASE_ORDER = ["lobby", "assigning", "roleReveal", "day"];

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

  // (9) 모두 day
  await waitUntil(() => clients.every((c) => states(c).some((f) => f.msg.view.phase === "day")), 30_000, "모든 클라이언트가 day 를 받지 못함");
  for (const c of clients) if (c.unexpectedClose !== null) fail(`${c.nickname} 소켓이 예상 밖으로 닫힘 (code ${c.unexpectedClose})`);

  // (10) 시작 뒤 참가는 409 GAME_STARTED
  const late = await http(null, "POST", `/api/rooms/${code}/join`, { nickname: "늦은사람" });
  if (late.status !== 409 || late.data?.error !== "GAME_STARTED") fail(`시작 뒤 참가가 409 GAME_STARTED 가 아님: ${late.status} ${late.data?.error}`);

  // (11) 낮 미리보기는 players 가 빈 배열
  const pvDay = await http(null, "GET", `/api/rooms/${code}`);
  if (pvDay.data?.phase !== "day") fail(`낮 미리보기 phase 가 day 가 아님: ${pvDay.data?.phase}`);
  if (!Array.isArray(pvDay.data?.players) || pvDay.data.players.length !== 0) fail("낮 미리보기 players 가 빈 배열이 아님");

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
    // 단계 순서: 건너뜀 없이 앞으로만
    const seq = [];
    for (const f of stateFrames) if (seq.at(-1) !== f.msg.view.phase) seq.push(f.msg.view.phase);
    for (let k = 1; k < seq.length; k++) {
      if (PHASE_ORDER.indexOf(seq[k]) !== PHASE_ORDER.indexOf(seq[k - 1]) + 1) fail(`${c.nickname} 의 단계 순서가 이상함: ${seq.join(" → ")}`);
    }
    if (seq.at(-1) !== "day") fail(`${c.nickname} 의 마지막 단계가 day 가 아님: ${seq.join(" → ")}`);
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
  // day 전환 편차
  const dayAt = clients.map((c) => states(c).find((f) => f.msg.view.phase === "day").at);
  const spread = Math.round(Math.max(...dayAt) - Math.min(...dayAt));
  if (spread >= DAY_SPREAD_LIMIT_MS) fail(`day 전환 도착 편차 ${spread}ms 가 ${DAY_SPREAD_LIMIT_MS}ms 이상`);

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

  console.log(`SMOKE OK full code=${code} players=${N} spread=${spread}ms version=${version}`);
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
