// 테스트 방 서버 봇(결정 0024) 배포본 확인: testBots 로 봇을 앉히고 빼고, 봇이 주장·토론 메시지·밤 pick 을 저절로 하며,
// 어떤 프레임에도 봇 표시(isBot·botPlan·token)가 새지 않고, 일반 방·손님·시작 뒤에는 거부되는지 증명한다.
// 방장 1명(+ 사람 손님 1명)만 사람이고 나머지는 서버 봇이라 외부 봇 스크립트 없이 한 판의 모든 단계가 돈다(전체 약 2분).
// 직업 주장은 한 명씩 차례로 한다(결정 0023·0027): 방장이 자기 차례에 말 안 함을 보내면 봇 네 자리가 자기 차례에 주장해 day.claimLog 에 쌓인다.
// claim 단계의 [넘기기](testSkip)는 차례 하나씩이라(결정 0027-9) 단계를 넘기는 도우미가 목표 단계에 닿을 때까지 되풀이한다.
// 스크립트는 전지적이다: 각 클라이언트의 view 로 확인한다. 토큰은 어떤 출력에도 찍지 않는다. Node 22 내장 fetch·WebSocket 만 쓴다.
//
// 사용법: node scripts/uat-test-bots.mjs [--prod | <기준 주소>] [--previous-version V]
//   --previous-version V: /api/health 의 version 이 V 와 달라질 때까지 2초 간격 최대 60초 기다리고, 그래도 같으면 실패한다
//                         (배포 직후 옛 버전이 잠시 응답하는 문제).
// 종료 코드: 0 = UAT TEST-BOTS OK, 1 = UAT TEST-BOTS FAIL, 2 = 중단(제한 시간·연결 오류).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const args = { base: null, prod: false, previousVersion: null };
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === "--prod") args.prod = true;
  else if (a === "--previous-version") args.previousVersion = process.argv[++i] ?? "";
  else if (!a.startsWith("--") && args.base === null) args.base = a;
  else {
    console.log("사용법: node scripts/uat-test-bots.mjs [--prod | <기준 주소>] [--previous-version V]");
    process.exit(2);
  }
}
if (args.previousVersion === "") {
  console.log("사용법 오류: --previous-version 값이 비어 있음");
  process.exit(2);
}
let base = args.base;
if (args.prod) base = readFileSync(fileURLToPath(new URL("./prod-url.txt", import.meta.url)), "utf8").trim();
const url = new URL((base ?? "http://localhost:5173").replace(/\/+$/, ""));
const wsBase = `${url.protocol === "https:" ? "wss:" : "ws:"}//${url.host}`;

const OVERALL_LIMIT_MS = 240_000;
// 서버는 연결당 1초에 20개를 넘는 메시지를 처리하지 않는다(RATE_LIMITED). 빠른 서버에서도 넘지 않도록 요청 사이를 띄운다.
const RATE_PAUSE_MS = 150;
const SKIP_WAIT_MS = 3000; // 단계 넘기기 한 번 뒤 소켓이 새 단계를 받아야 하는 시간
const CLAIM_WAIT_MS = 4 * 4000 + 4000; // 봇 넷의 차례 주장: 한 차례에 0.5~3.5초 뒤 보내므로 넷이면 최대 14초 + 여유
const MAX_SKIPS = 24; // 목표 단계에 닿기까지 testSkip 최대 횟수(8명 판이 claim 차례 여덟 + 나머지 단계)
const DISCUSSION_WAIT_MS = 15_000; // 봇 첫 토론 행동은 단계 진입 2~12초 뒤
const NIGHT_PICK_WAIT_MS = 8000; // 봇 밤 pick 은 단계 진입 1~6초 뒤
const MAX_NIGHTS = 5;
const BOT_NAMES = ["봇가나", "봇다라", "봇마바", "봇사아", "봇자차", "봇카타", "봇파하"];
const PLAYER_KEYS = "alive,connected,isHost,nickname,seat";
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

/** 제한 시간 안에 pred 가 참이 되는지만 본다(실패해도 예외를 던지지 않는다). */
async function becomes(pred, ms) {
  const start = performance.now();
  while (!pred()) {
    if (performance.now() - start > ms) return false;
    await sleep(10);
  }
  return true;
}

async function post(path, body) {
  const res = await fetch(`${url.origin}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: res.status, data: await res.json().catch(() => null) };
}

async function getJson(path) {
  const res = await fetch(`${url.origin}${path}`);
  return { status: res.status, data: await res.json().catch(() => null) };
}

function connect(c, code) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${wsBase}/api/rooms/${code}/ws`);
    c.ws = ws;
    ws.addEventListener("open", () => ws.send(JSON.stringify({ t: "hello", token: c.token })));
    ws.addEventListener("message", (ev) => {
      const raw = String(ev.data);
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }
      c.frames.push({ msg, raw });
      if (msg.t === "state") resolve();
    });
    ws.addEventListener("close", (ev) => {
      c.closeEvent = ev.code;
      if (!c.leaving) c.closedCode = ev.code;
    });
    ws.addEventListener("error", () => reject(new Error(`${c.nickname} 연결 오류`)));
  });
}

const send = (c, m) => c.ws.send(JSON.stringify(m));
const states = (c) => c.frames.filter((f) => f.msg.t === "state");
const lastView = (c) => states(c).at(-1)?.msg.view ?? null;

let pingCounter = 0;
/** 지금까지 쌓인 프레임 뒤에 ping 을 보내 pong 이 올 때까지 기다린다. 그 사이에 낀 프레임이 곧 직전 행동이 만든 프레임 전부다("오지 않았음" 의 증명). */
async function settle(c, from) {
  pingCounter += 1;
  const n = pingCounter;
  send(c, { t: "ping", c: n });
  await waitUntil(() => c.frames.some((f) => f.msg.t === "pong" && f.msg.c === n), 5000, `${c.nickname} pong`);
  const pongAt = c.frames.findIndex((f) => f.msg.t === "pong" && f.msg.c === n);
  return c.frames.slice(from, pongAt).map((f) => f.msg);
}

/** 프레임 목록을 "[error:NOT_HOST,state:lobby]" 같은 한 줄로. */
const summary = (msgs) => `[${msgs.map((m) => (m.t === "state" ? `state:${m.view.phase}` : m.t === "error" ? `error:${m.code}` : m.t)).join(",")}]`;

/** 요청을 보내고 그 소켓이 pong 전에 받은 프레임을 돌려준다. */
async function act(c, msg) {
  await sleep(RATE_PAUSE_MS);
  const from = c.frames.length;
  send(c, msg);
  return settle(c, from);
}

const newClient = (nickname) => ({ nickname, token: "", seat: -1, frames: [], ws: null, leaving: false, closedCode: null, closeEvent: null });

async function createRoomWith(nicknames, body0) {
  const clients = nicknames.map(newClient);
  const created = await post("/api/rooms", { nickname: clients[0].nickname, ...body0 });
  if (created.status !== 201) throw new Error(`방 만들기 ${created.status}`);
  const code = created.data.code;
  Object.assign(clients[0], { token: created.data.token, seat: created.data.seat });
  for (const c of clients.slice(1)) {
    const j = await post(`/api/rooms/${code}/join`, { nickname: c.nickname });
    if (j.status !== 200 && j.status !== 201) throw new Error(`참가 ${j.status}`);
    Object.assign(c, { token: j.data.token, seat: j.data.seat });
  }
  for (const c of clients) await connect(c, code);
  await waitUntil(() => clients.every((c) => lastView(c)?.players.every((p) => p.connected)), 10_000, "모두 연결");
  for (const c of clients) await settle(c, c.frames.length); // 늦게 오는 입장 방송을 모두 흘려보낸다
  return { code, clients };
}

async function waitPhase(clients, phase, ms, label) {
  await waitUntil(() => clients.every((c) => lastView(c)?.phase === phase), ms, label);
}

/**
 * 목표 단계에 닿을 때까지 testSkip 을 되풀이한다(최대 MAX_SKIPS 번). claim 은 차례 하나씩 넘어가므로 여러 번 누르게 된다.
 * 매번 단계 또는 마감이 바뀔 때까지 기다린다.
 */
async function skipPhase(c, next, label) {
  const stamp = () => `${lastView(c)?.phase}:${lastView(c)?.phaseEndsAt}:${lastView(c)?.day?.turn?.seat}`;
  for (let i = 0; i < MAX_SKIPS && lastView(c)?.phase !== next; i++) {
    await sleep(RATE_PAUSE_MS);
    const before = stamp();
    send(c, { t: "testSkip" });
    await waitUntil(() => stamp() !== before, SKIP_WAIT_MS, `넘기기(${label ?? next})`);
  }
  await waitPhase([c], next, SKIP_WAIT_MS, `넘기기(${label ?? next})`);
}

const lobbySize = (c, n) => lastView(c)?.phase === "lobby" && lastView(c).players.length === n;
const botSeatsOf = (host) => lastView(host).players.filter((p) => p.seat !== host.seat).map((p) => p.seat).sort((a, b) => a - b);
const closeAll = (clients) => {
  for (const c of clients) {
    c.leaving = true;
    try { c.ws.close(); } catch { /* 이미 닫힘 */ }
  }
};

async function main() {
  console.log(`대상 ${url.origin}`);

  // 배포 직후 옛 버전이 잠시 응답하는 문제: 버전이 바뀔 때까지 기다린다.
  if (args.previousVersion !== null) {
    let version = null;
    for (let i = 0; i < 31; i++) {
      const res = await fetch(`${url.origin}/api/health`);
      version = String((await res.json().catch(() => ({}))).version ?? "");
      if (version !== args.previousVersion) break;
      if (i < 30) await sleep(2000);
    }
    check("배포", "/api/health 의 version 이 이전 버전과 다름", version !== args.previousVersion, `이전 ${args.previousVersion} → 지금 ${version}`);
    if (version === args.previousVersion) return finish();
  }

  // ---- a. 테스트 방 R1: 손님은 거부 ----
  const r1 = await createRoomWith(["테방장", "손님1"], { testMode: true });
  const [host, guest] = r1.clients;
  console.log(`테스트 방 ${r1.code} — 사람 둘(방장·손님) + 서버 봇`);
  check("a", "방장 첫 lobby view 의 me.testBots 가 0", states(host)[0].msg.view.me.testBots === 0, String(states(host)[0].msg.view.me.testBots));
  const guestBots = summary(await act(guest, { t: "testBots", count: 3 }));
  check("a", "손님의 testBots → NOT_HOST + 그 소켓에만 state", guestBots === "[error:NOT_HOST,state:lobby]", guestBots);
  check("a", "손님 프레임 원문에 testBots 가 없음", !guest.frames.some((f) => f.raw.includes("testBots")), "");

  // ---- b. 방장 testBots 3 ----
  const guestMark = guest.frames.length;
  send(host, { t: "testBots", count: 3 });
  const grew = await becomes(() => lobbySize(host, 5) && lobbySize(guest, 5), SKIP_WAIT_MS);
  check("b", "방장 testBots 3 → 방장·손님 모두 인원 5 lobby", grew, `${lastView(host).players.length}/${lastView(guest).players.length}`);
  check("b", "방장 view 의 me.testBots 가 3", lastView(host).me.testBots === 3, String(lastView(host).me.testBots));
  const botPlayers = lastView(host).players.filter((p) => p.seat !== host.seat && p.seat !== guest.seat);
  check("b", "봇 자리 셋은 connected true 이고 닉네임이 고정 목록 안",
    botPlayers.length === 3 && botPlayers.every((p) => p.connected === true && BOT_NAMES.includes(p.nickname)), botPlayers.map((p) => `${p.seat}${p.nickname}`).join(","));
  check("b", "손님 프레임 원문에 testBots 가 없음", !guest.frames.slice(guestMark).some((f) => f.raw.includes("testBots")), "");
  // 손님이 나가면 방장 view 인원 4(사람 1 + 봇 3)
  guest.leaving = true;
  send(guest, { t: "leave" });
  const hostAfterLeave = await becomes(() => lobbySize(host, 4), SKIP_WAIT_MS);
  check("b", "손님이 leave 하면 방장 view 인원 4", hostAfterLeave, String(lastView(host).players.length));
  const afterLeaveMark = host.frames.length;

  // ---- c. 늘리기·줄이기 ----
  send(host, { t: "testBots", count: 7 });
  const full = await becomes(() => lobbySize(host, 8), SKIP_WAIT_MS);
  check("c", "방장 testBots 7 → 인원 8", full, String(lastView(host).players.length));
  await sleep(RATE_PAUSE_MS);
  send(host, { t: "testBots", count: 4 });
  const shrunk = await becomes(() => lobbySize(host, 5), SKIP_WAIT_MS);
  const keptSeats = lastView(host).players.map((p) => p.seat).sort((a, b) => a - b).join(",");
  check("c", "방장 testBots 4 → 인원 5, 남은 봇 seat 1~4(가장 높은 자리부터 뺌)", shrunk && keptSeats === "0,1,2,3,4", keptSeats);
  const over = summary(await act(host, { t: "testBots", count: 8 }));
  check("c", "testBots count 8 → BAD_MESSAGE 오류 프레임뿐", over === "[error:BAD_MESSAGE]", over);

  // ---- d. 시작 → 봇 행동 ----
  await act(host, { t: "testRole", role: "citizen" }); // 방장이 시민이면 마피아는 봇이다(사람은 아무도 pick 하지 않는다)
  send(host, { t: "start" });
  await waitPhase([host], "assigning", 5000, "배정 시작(봇 4 + 방장)");
  check("d", "방장 + 봇 4 로 시작이 통함(봇은 연결된 사람으로 센다)", lastView(host).phase === "assigning" && lastView(host).players.length === 5, String(lastView(host).players.length));
  const duringStart = summary(await act(host, { t: "testBots", count: 2 }));
  check("d", "시작 뒤(배정) 방장 testBots → WRONG_PHASE + state", duringStart === "[error:WRONG_PHASE,state:assigning]", duringStart);
  const skipTo = (next) => skipPhase(host, next);
  await skipTo("roleReveal");
  check("d", "roleReveal: 방장 me.role 이 citizen, 인원 5", lastView(host).me.role === "citizen" && lastView(host).players.length === 5, String(lastView(host).me.role));
  await skipTo("dayAnnounce");
  await skipTo("claim");
  const botSeats = botSeatsOf(host);
  const roles1 = lastView(host).day?.roles ?? [];
  check("d", "claim: 첫 차례는 방장 (day.turn.seat 가 방장 seat)", lastView(host).day?.turn?.seat === host.seat, String(lastView(host).day?.turn?.seat));
  // 방장(사람 소켓)이 자기 차례에 말 안 함을 보낸다. 이어 봇 네 자리가 자기 차례에 저절로 주장한다.
  await sleep(RATE_PAUSE_MS);
  send(host, { t: "claim", claim: "none" });
  const claimedAll = await becomes(() => botSeats.every((s) => lastView(host).day?.claimLog?.some((e) => e.n === 1 && e.seat === s)), CLAIM_WAIT_MS);
  const log1 = lastView(host).day?.claimLog ?? [];
  check("d", "claim: 봇 네 자리가 자기 차례에 주장해 day.claimLog 에 쌓였다", claimedAll && botSeats.length === 4, `봇 ${botSeats.join(",")} 기록 ${log1.map((e) => `${e.seat}:${e.claim}`).join(" ")}`);
  check("d", "claimLog: 봇이 고른 값은 이번 판 직업 또는 none 이고 같은 seat 가 두 번 나오지 않음",
    log1.every((e) => e.claim === "none" || roles1.includes(e.claim)) && new Set(log1.map((e) => e.seat)).size === log1.length, `후보 ${roles1.join(",")}`);
  check("d", "claimLog: 방장이 보낸 none 이 첫 줄", log1[0]?.seat === host.seat && log1[0]?.claim === "none", JSON.stringify(log1[0] ?? null));
  await waitPhase([host], "discussion", SKIP_WAIT_MS, "마지막 차례 뒤 discussion");
  const discMark = host.frames.length;
  await skipTo("discussion");
  const talked = await becomes(() => host.frames.slice(discMark).some((f) => (f.msg.t === "chat" || f.msg.t === "emoji") && botSeats.includes(f.msg.seat)), DISCUSSION_WAIT_MS);
  check("d", "discussion: 15초 안에 봇 자리에서 온 chat 또는 emoji 프레임이 있음", talked, "");
  const discErrors = host.frames.slice(discMark).filter((f) => f.msg.t === "error").length;
  check("d", "discussion: 방장에게 오류 프레임이 없음(봇 거부는 소켓에 닿지 않음)", discErrors === 0, String(discErrors));

  // 밤: 봇 마피아가 저절로 pick 한다. 의사 봇이 구한 밤이면 다음 밤까지 되풀이한다(최대 5밤).
  await skipTo("night");
  let eliminated = null;
  let spectateChecked = null;
  let nightsTried = 0;
  for (let n = 1; n <= MAX_NIGHTS && eliminated === null; n++) {
    nightsTried = n;
    await sleep(NIGHT_PICK_WAIT_MS); // 봇 pick 은 진입 1~6초 뒤
    if (lastView(host).spectate?.picks) spectateChecked = lastView(host).spectate.picks.mafia.length > 0;
    await skipTo("morning");
    const morning = lastView(host).day?.morning;
    if (n === 1) check("d", "아침 결과가 옴(day.morning 이 있음)", morning !== undefined, JSON.stringify(morning));
    if (morning?.eliminated !== undefined) eliminated = morning.eliminated;
    if (eliminated === null && n < MAX_NIGHTS) {
      for (const phase of ["dayAnnounce", "claim", "discussion", "night"]) await skipTo(phase);
    }
  }
  check("d", `봇 마피아의 밤 pick 이 저절로 일어났다(탈락자가 나옴, ${nightsTried}번째 밤)`, eliminated !== null, eliminated === null ? "5밤 모두 구출" : `탈락 seat ${eliminated}`);
  if (spectateChecked !== null) check("d", "(덤) 방장이 탈락한 밤에는 관전 정보의 마피아 선택이 비어 있지 않음", spectateChecked, "");

  // ---- e. 누출 없음 ----
  const hostText = host.frames.map((f) => f.raw).join("\n");
  const guestText = guest.frames.map((f) => f.raw).join("\n");
  const LEAK_NEEDLES = ["isBot", "botPlan", '"token"', "claimPick", "claimOrder", "claimIdx", "claimStart"];
  check("e", "방장·손님 프레임 원문에 isBot·botPlan·따옴표 붙은 token 키·서버 전용 주장 키(claimPick 등)가 없음",
    ![hostText, guestText].some((t) => LEAK_NEEDLES.some((needle) => t.includes(needle))), "");
  check("e", "손님 프레임에 testBots 가 없음", !guestText.includes("testBots"), "");
  const badKeys = [host, guest].flatMap((c) => states(c).flatMap((f) => f.msg.view.players.filter((p) => Object.keys(p).sort().join(",") !== PLAYER_KEYS)));
  check("e", "모든 state 의 players 항목 키가 alive·connected·isHost·nickname·seat 다섯", badKeys.length === 0, String(badKeys.length));
  const botDown = states(host).slice().filter((f) => f.msg.view.players.some((p) => p.seat !== host.seat && p.connected !== true));
  const botDownAfterLeave = host.frames.slice(afterLeaveMark).filter((f) => f.msg.t === "state" && f.msg.view.players.some((p) => p.seat !== host.seat && p.connected !== true)).length;
  check("e", "손님이 나간 뒤 모든 state 에서 방장 외 자리(봇)가 connected true(끊김 표시 없음)", botDownAfterLeave === 0, `${botDownAfterLeave} (전체 ${botDown.length})`);
  const odd = host.frames.filter((f) => f.msg.t === "state" && f.raw.includes("testBots") && f.msg.view.me.testBots === undefined).length;
  check("e", "방장 프레임의 testBots 는 view.me.testBots 경로에만 있음", odd === 0, String(odd));

  // ---- f. 대기실 복귀 ----
  send(host, { t: "testReset" });
  const back = await becomes(() => lobbySize(host, 5), SKIP_WAIT_MS);
  check("f", "testReset → lobby 인원 5(봇이 남음), me.testBots 4", back && lastView(host).me.testBots === 4, `${lastView(host).players.length}/${lastView(host).me.testBots}`);
  host.leaving = true;
  send(host, { t: "leave" });
  await becomes(() => host.closeEvent !== null, 5000);
  check("f", "방장 leave → 소켓 4003", host.closeEvent === 4003, String(host.closeEvent));
  await sleep(300);
  const gone = await getJson(`/api/rooms/${r1.code}`);
  check("f", "사람이 모두 나가면 방이 지워져 미리보기가 404", gone.status === 404, String(gone.status));
  closeAll(r1.clients);

  // ---- g. 테스트 방 R2: 봇 마피아 동료의 밤 pick ----
  const r2 = await createRoomWith(["테방장2"], { testMode: true });
  const h2 = r2.clients[0];
  console.log(`테스트 방 ${r2.code} — 방장 혼자 + 봇 5`);
  send(h2, { t: "testBots", count: 5 });
  check("g", "방장 testBots 5 → 인원 6", await becomes(() => lobbySize(h2, 6), SKIP_WAIT_MS), String(lastView(h2).players.length));
  await act(h2, { t: "testRole", role: "mafia" });
  send(h2, { t: "start" });
  await waitPhase([h2], "assigning", 5000, "R2 배정");
  // claim 은 차례 하나씩 넘기기라 여섯 번 누른다(방장 + 봇 다섯). 이 방은 [넘기기] 경로를, R1 은 봇이 스스로 주장하는 경로를 본다.
  const skip2 = (next) => skipPhase(h2, next, `R2 ${next}`);
  for (const phase of ["roleReveal", "dayAnnounce", "claim", "discussion", "night"]) await skip2(phase);
  const log2 = lastView(h2).day?.claimLog ?? [];
  check("g", "claim 차례 넘기기 여섯 번: 여섯 자리가 claimLog 에 한 번씩 (방장부터 seat 오름차순)",
    log2.length === 6 && log2.every((e, k) => e.n === 1 && e.seat === k), log2.map((e) => `${e.seat}:${e.claim}`).join(" "));
  check("g", "방장 me.role 이 mafia, 동료(me.allies)가 봇 한 자리", lastView(h2).me.role === "mafia" && lastView(h2).me.allies?.length === 1, `${lastView(h2).me.role} ${JSON.stringify(lastView(h2).me.allies)}`);
  const picked = await becomes(() => (lastView(h2).me.allyPicks?.length ?? 0) > 0, NIGHT_PICK_WAIT_MS);
  const ap = lastView(h2).me.allyPicks ?? [];
  check("g", "8초 안에 방장 me.allyPicks 가 비어 있지 않고 방장·동료 자리가 아님(봇 마피아의 pick)",
    picked && ap.every((s) => s !== h2.seat && !(lastView(h2).me.allies ?? []).includes(s)), JSON.stringify(ap));
  await skip2("morning");
  check("g", "아침 결과가 옴(day.morning 이 있음)", lastView(h2).day?.morning !== undefined, JSON.stringify(lastView(h2).day?.morning));
  send(h2, { t: "testReset" });
  await becomes(() => lobbySize(h2, 6), SKIP_WAIT_MS);
  await sleep(RATE_PAUSE_MS);
  send(h2, { t: "testBots", count: 0 });
  check("g", "testReset 뒤 testBots 0 → 인원 1", await becomes(() => lobbySize(h2, 1) && lastView(h2).me.testBots === 0, SKIP_WAIT_MS), String(lastView(h2).players.length));
  closeAll(r2.clients);

  // ---- h. 일반 방 ----
  const r3 = await createRoomWith(["일반장"], {});
  const h3 = r3.clients[0];
  console.log(`일반 방 ${r3.code}`);
  const normalOut = summary(await act(h3, { t: "testBots", count: 3 }));
  check("h", "일반 방 방장의 testBots → BAD_MESSAGE 오류 프레임뿐(state 없음)", normalOut === "[error:BAD_MESSAGE]", normalOut);
  const preview = await getJson(`/api/rooms/${r3.code}`);
  check("h", "일반 방 미리보기 playerCount 가 1", preview.data?.playerCount === 1, String(preview.data?.playerCount));
  check("h", "일반 방 방장 view 에 me.testBots 가 없음", !("testBots" in lastView(h3).me), "");
  closeAll(r3.clients);

  // ---- 전체 ----
  const closedEarly = [...r1.clients, ...r2.clients, ...r3.clients].filter((c) => !c.leaving && c.closedCode !== null).map((c) => c.nickname);
  check("전체", "소켓이 예상 밖으로 닫히지 않음", closedEarly.length === 0, closedEarly.join(","));
  const tokenLeak = r1.clients.some((c) => r1.clients.some((o) => o !== c && c.frames.some((f) => f.raw.includes(o.token))));
  check("전체", "다른 사람의 토큰이 프레임에 없음", !tokenLeak, "");
  finish();
}

function finish() {
  console.log("\n테스트 | 항목 | 결과 | 내용");
  for (const r of results) console.log(`${r.test} | ${r.label} | ${r.ok ? "통과" : "실패"} | ${r.detail}`);
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} 통과`);
  if (failed.length === 0) {
    console.log("UAT TEST-BOTS OK");
    process.exit(0);
  }
  console.log(`UAT TEST-BOTS FAIL: ${failed.map((r) => `${r.test} ${r.label}`).join("; ")}`);
  process.exit(1);
}

const overall = setTimeout(() => { console.log(`중단: 전체 ${OVERALL_LIMIT_MS / 1000}초 제한 초과`); process.exit(2); }, OVERALL_LIMIT_MS);
main().catch((e) => {
  clearTimeout(overall);
  console.log(`UAT TEST-BOTS FAIL: 중단 — ${e.message}`);
  process.exit(2);
});
