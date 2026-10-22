// 스모크: 배포(또는 로컬) 주소에서 방 만들기 → WebSocket hello → 대기실 상태까지 확인한다.
// Node 22.12+ 내장 fetch·전역 WebSocket 만 쓴다. 셸 명령·외부 패키지 없음 (Windows 에서도 같은 명령).
//
// 사용법:
//   node scripts/smoke.mjs <기준 주소>           예: http://localhost:5173
//   node scripts/smoke.mjs --prod                 같은 폴더의 prod-url.txt 주소
//   옵션: --stage create (기본값) | --print-version
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const TOTAL_LIMIT_MS = 30_000;
const STATE_LIMIT_MS = 10_000;
const ALLOWED_PLAYER_KEYS = ["connected", "isHost", "nickname", "seat"];

function fail(reason) {
  console.log(`SMOKE FAIL: ${reason}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { base: null, prod: false, stage: "create", printVersion: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--prod") args.prod = true;
    else if (a === "--print-version") args.printVersion = true;
    else if (a === "--stage") args.stage = argv[++i] ?? "";
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

const args = parseArgs(process.argv.slice(2));
const url = resolveBase(args);

const overall = setTimeout(() => fail(`전체 ${TOTAL_LIMIT_MS / 1000}초 제한 초과`), TOTAL_LIMIT_MS);

try {
  if (args.printVersion) {
    console.log(await getVersion(url.origin));
  } else if (args.stage === "create") {
    await stageCreate(url);
  } else {
    fail(`알 수 없는 단계: ${args.stage}`);
  }
} catch (e) {
  fail(e instanceof Error ? e.message : String(e));
}
clearTimeout(overall);
process.exit(0);
