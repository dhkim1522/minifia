// 테스트 방 방장 도구(결정 0022) 배포본 확인: 단계 넘기기·대기실 복귀·내 직업 지정과 손님·일반 방·시작 뒤 거부를 증명한다.
// 방장 1명 + 봇 3명(모두 연결)으로 테스트 방(POST /api/rooms 본문 testMode true)을 만들어 단계를 testSkip 으로 넘기므로
// 토론 90초·밤 30초를 기다리지 않는다(전체 약 1분). 일반 방(본문 nickname 만)에서는 세 요청이 모두 거부되는지도 본다.
// 스크립트는 전지적이다: 각 클라이언트의 view 로 확인한다. 토큰은 어떤 출력에도 찍지 않는다. Node 22 내장 fetch·WebSocket 만 쓴다.
//
// 사용법: node scripts/uat-test-room.mjs [--prod | <기준 주소>] [--previous-version V]
//   --previous-version V: /api/health 의 version 이 V 와 달라질 때까지 2초 간격 최대 60초 기다리고, 그래도 같으면 실패한다
//                         (배포 직후 옛 버전이 잠시 응답하는 문제).
// 종료 코드: 0 = UAT TEST-ROOM OK, 1 = UAT TEST-ROOM FAIL, 2 = 중단(제한 시간·연결 오류).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const args = { base: null, prod: false, previousVersion: null };
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === "--prod") args.prod = true;
  else if (a === "--previous-version") args.previousVersion = process.argv[++i] ?? "";
  else if (!a.startsWith("--") && args.base === null) args.base = a;
  else {
    console.log("사용법: node scripts/uat-test-room.mjs [--prod | <기준 주소>] [--previous-version V]");
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

const OVERALL_LIMIT_MS = 180_000;
// 서버는 연결당 1초에 20개를 넘는 메시지를 처리하지 않는다(RATE_LIMITED). 빠른 서버에서도 넘지 않도록 요청 사이를 띄운다.
const RATE_PAUSE_MS = 150;
const SKIP_WAIT_MS = 3000; // 단계 넘기기 한 번 뒤 네 소켓이 새 단계를 받아야 하는 시간
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (test, label, ok, detail = "") => results.push({ test, label, ok, detail });
const ROLE_WORDS = /mafia|police|doctor|citizen/;

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
      const raw = String(ev.data);
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }
      c.frames.push({ msg, raw });
      if (msg.t === "state") resolve();
    });
    ws.addEventListener("close", (ev) => { if (!c.leaving) c.closedCode = ev.code; });
    ws.addEventListener("error", () => reject(new Error(`${c.nickname} 연결 오류`)));
  });
}

const send = (c, m) => c.ws.send(JSON.stringify(m));
const states = (c) => c.frames.filter((f) => f.msg.t === "state");
const lastView = (c) => states(c).at(-1)?.msg.view ?? null;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

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

const newClient = (nickname) => ({ nickname, token: "", seat: -1, frames: [], ws: null, leaving: false, closedCode: null });

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

async function waitAllPhase(clients, phase, ms, label) {
  await waitUntil(() => clients.every((c) => lastView(c)?.phase === phase), ms, label);
}

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

  // ---- a. 테스트 방 만들기 ----
  const { code, clients } = await createRoomWith(["테방장", "손님1", "손님2", "손님3"], { testMode: true });
  const [host, ...guests] = clients;
  console.log(`테스트 방 ${code} — 방장 + 손님 ${guests.length}`);
  check("a", "방장 첫 view 의 me.testMode 가 true", states(host)[0].msg.view.me.testMode === true, "");
  check("a", "손님 프레임 원문에 testMode·testRole 이 없음", guests.every((g) => !g.frames.some((f) => f.raw.includes("testMode") || f.raw.includes("testRole"))), "");

  // ---- b. 대기실 거부 ----
  const guestRole = summary(await act(guests[0], { t: "testRole", role: "mafia" }));
  const guestSkip = summary(await act(guests[0], { t: "testSkip" }));
  const guestReset = summary(await act(guests[0], { t: "testReset" }));
  check("b", "손님의 testRole·testSkip·testReset → NOT_HOST + 그 소켓에만 state",
    [guestRole, guestSkip, guestReset].every((s) => s === "[error:NOT_HOST,state:lobby]"), `${guestRole} ${guestSkip} ${guestReset}`);
  const lobbySkip = summary(await act(host, { t: "testSkip" }));
  const lobbyReset = summary(await act(host, { t: "testReset" }));
  check("b", "방장의 대기실 testSkip·testReset → WRONG_PHASE", lobbySkip === "[error:WRONG_PHASE,state:lobby]" && lobbyReset === "[error:WRONG_PHASE,state:lobby]", `${lobbySkip} ${lobbyReset}`);
  const doctor = summary(await act(host, { t: "testRole", role: "doctor" }));
  check("b", "4명 대기실에서 방장 testRole doctor → BAD_MESSAGE", doctor === "[error:BAD_MESSAGE,state:lobby]", doctor);

  // ---- c. 내 직업 지정 ----
  const marks = guests.map((g) => g.frames.length);
  const own = await act(host, { t: "testRole", role: "mafia" });
  check("c", "방장 testRole mafia → 방장 소켓에만 state(me.testRole mafia)", summary(own) === "[state:lobby]" && own[0].view.me.testRole === "mafia", summary(own));
  const seen = [];
  for (const [i, g] of guests.entries()) seen.push(summary(await settle(g, marks[i])));
  check("c", "손님 소켓에는 프레임이 없음", seen.every((s) => s === "[]"), seen.join(" "));

  // ---- d. 시작 → 배정에서 넘기기 ----
  send(host, { t: "start" });
  await waitAllPhase(clients, "assigning", 5000, "배정 시작");
  send(host, { t: "testSkip" });
  await waitAllPhase(clients, "roleReveal", SKIP_WAIT_MS, "배정 넘기기(roleReveal)");
  check("d", "배정에서 넘기면 네 소켓 모두 roleReveal, 각자 me.seat 가 자기 자리",
    clients.every((c) => lastView(c).me.seat === c.seat), clients.map((c) => `${c.seat}`).join(","));
  check("d", "방장 me.role 이 mafia (지정한 직업)", lastView(host).me.role === "mafia", String(lastView(host).me.role));
  check("d", "손님 프레임 원문에 testMode·testRole 이 없음", guests.every((g) => !g.frames.some((f) => f.raw.includes("testMode") || f.raw.includes("testRole"))), "");
  const revealRole = summary(await act(host, { t: "testRole", role: "police" }));
  check("d", "역할 확인에서 방장 testRole → WRONG_PHASE", revealRole === "[error:WRONG_PHASE,state:roleReveal]", revealRole);

  // ---- e. 단계를 거듭 넘기기 ----
  const PHASE_NEXT = { roleReveal: "dayAnnounce", dayAnnounce: "claim", claim: "claimReveal", claimReveal: "discussion", discussion: "night", night: "morning", morning: "dayAnnounce" };
  const order = [];
  let current = "roleReveal";
  let orderOk = true;
  const t0 = performance.now();
  for (const next of ["dayAnnounce", "claim", "claimReveal", "discussion", "night"]) {
    if (PHASE_NEXT[current] !== next) orderOk = false;
    await sleep(RATE_PAUSE_MS);
    send(host, { t: "testSkip" });
    await waitAllPhase(clients, next, SKIP_WAIT_MS, `${current} 넘기기(${next})`);
    order.push(next);
    current = next;
  }
  check("e", "roleReveal → dayAnnounce → claim → claimReveal → discussion → night 를 네 소켓 모두 3초 안에 받음",
    orderOk, `${order.join(" → ")} (${Math.round(performance.now() - t0)}ms, 토론 90초·밤 30초를 기다리지 않음)`);
  const victim = guests[0];
  await act(host, { t: "pick", target: victim.seat });
  check("e", "밤에 마피아(방장)의 pick 이 me.pick 으로 돌아옴", lastView(host).me.pick === victim.seat, String(lastView(host).me.pick));
  await sleep(RATE_PAUSE_MS);
  send(host, { t: "testSkip" });
  await waitAllPhase(clients, "morning", SKIP_WAIT_MS, "밤 넘기기(morning)");
  const mornings = clients.map((c) => lastView(c).day?.morning);
  check("e", "넘긴 밤도 정상 판정: 모든 소켓의 day.morning 이 같고 지목한 사람이 탈락",
    mornings.every((m) => same(m, mornings[0])) && mornings[0]?.eliminated === victim.seat, JSON.stringify(mornings[0]));
  await sleep(RATE_PAUSE_MS);
  send(host, { t: "testSkip" });
  await waitAllPhase(clients, "dayAnnounce", SKIP_WAIT_MS, "아침 넘기기(dayAnnounce)");
  check("e", "아침에서 넘기면 dayAnnounce 이고 day.n 이 2", clients.every((c) => lastView(c).day?.n === 2), clients.map((c) => lastView(c).day?.n).join(","));
  const guestMid = summary(await act(guests[1], { t: "testSkip" }));
  await sleep(300);
  check("e", "게임 중 손님 testSkip → NOT_HOST 이고 단계 그대로", guestMid === "[error:NOT_HOST,state:dayAnnounce]" && lastView(host).phase === "dayAnnounce", guestMid);

  // ---- f. 대기실로 되돌리기 ----
  const resetFrom = clients.map((c) => c.frames.length);
  send(host, { t: "testReset" });
  await waitAllPhase(clients, "lobby", SKIP_WAIT_MS, "되돌리기(lobby)");
  const views = clients.map(lastView);
  check("f", "네 소켓 모두 lobby, 같은 네 사람(seat·nickname)이 모두 connected",
    views.every((v) => v.players.length === 4 && v.players.every((p) => p.connected) && same(v.players.map((p) => [p.seat, p.nickname]), views[0].players.map((p) => [p.seat, p.nickname]))),
    views[0].players.map((p) => `${p.seat}${p.nickname}`).join(","));
  check("f", "view 에 day·spectate·me.role 이 없음", views.every((v) => !("day" in v) && !("spectate" in v) && !("role" in v.me)), "");
  check("f", "방장 me.testRole 이 여전히 mafia", views[0].me.testRole === "mafia", String(views[0].me.testRole));
  check("f", "되돌린 뒤 손님 프레임 원문에 직업 이름이 없음",
    guests.every((g) => !g.frames.slice(resetFrom[clients.indexOf(g)]).some((f) => ROLE_WORDS.test(f.raw))), "");
  send(host, { t: "start" });
  await waitAllPhase(clients, "assigning", 5000, "두 번째 배정");
  send(host, { t: "testSkip" });
  await waitAllPhase(clients, "roleReveal", SKIP_WAIT_MS, "두 번째 roleReveal");
  check("f", "다시 시작하면 방장 me.role 이 mafia (지정 재사용)", lastView(host).me.role === "mafia", String(lastView(host).me.role));
  send(host, { t: "testReset" });
  await waitAllPhase(clients, "lobby", SKIP_WAIT_MS, "정리 되돌리기");
  for (const c of [...guests, host]) { c.leaving = true; try { send(c, { t: "leave" }); c.ws.close(); } catch { /* 닫힘 */ } }

  // ---- g. 일반 방 ----
  const normal = await createRoomWith(["일반장", "일반1", "일반2", "일반3"], {});
  const [nHost, ...nGuests] = normal.clients;
  console.log(`일반 방 ${normal.code}`);
  const MSGS = [{ t: "testSkip" }, { t: "testReset" }, { t: "testRole", role: "mafia" }];
  const lobbyOut = [];
  for (const c of [nHost, nGuests[0]]) for (const m of MSGS) lobbyOut.push(summary(await act(c, m)));
  check("g", "일반 방 대기실: 방장·손님의 세 요청 모두 BAD_MESSAGE 오류 프레임뿐(state 없음)", lobbyOut.every((s) => s === "[error:BAD_MESSAGE]"), lobbyOut[0]);
  check("g", "일반 방 대기실의 방장 view 에 me.testMode 가 없음", !("testMode" in lastView(nHost).me), "");
  send(nHost, { t: "start" });
  await waitAllPhase(normal.clients, "roleReveal", 8000, "일반 방 roleReveal");
  const startedFrom = normal.clients.map((c) => c.frames.length);
  const startedOut = [];
  for (const c of [nHost, nGuests[0]]) for (const m of MSGS.slice(0, 2)) startedOut.push(summary(await act(c, m)));
  await sleep(1500);
  const extraStates = normal.clients.map((c, i) => c.frames.slice(startedFrom[i]).filter((f) => f.msg.t === "state").length);
  check("g", "일반 방 시작 뒤: 방장·손님의 testSkip·testReset → BAD_MESSAGE, 1.5초 안에 새 state 없음, 단계 그대로",
    startedOut.every((s) => s === "[error:BAD_MESSAGE]") && extraStates.every((n) => n === 0) && normal.clients.every((c) => lastView(c).phase === "roleReveal"),
    `${startedOut[0]} 새 state ${extraStates.join(",")}`);
  for (const c of normal.clients) { c.leaving = true; try { c.ws.close(); } catch { /* 닫힘 */ } }

  // ---- 전체 ----
  const closedEarly = clients.filter((c) => !c.leaving && c.closedCode !== null).map((c) => c.nickname);
  check("전체", "소켓이 예상 밖으로 닫히지 않음", closedEarly.length === 0, closedEarly.join(","));
  const tokenLeak = clients.some((c) => clients.some((o) => o !== c && c.frames.some((f) => f.raw.includes(o.token))));
  check("전체", "다른 사람의 토큰이 프레임에 없음", !tokenLeak, "");
  finish();
}

function finish() {
  console.log("\n테스트 | 항목 | 결과 | 내용");
  for (const r of results) console.log(`${r.test} | ${r.label} | ${r.ok ? "통과" : "실패"} | ${r.detail}`);
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} 통과`);
  if (failed.length === 0) {
    console.log("UAT TEST-ROOM OK");
    process.exit(0);
  }
  console.log(`UAT TEST-ROOM FAIL: ${failed.map((r) => `${r.test} ${r.label}`).join("; ")}`);
  process.exit(1);
}

const overall = setTimeout(() => { console.log(`중단: 전체 ${OVERALL_LIMIT_MS / 1000}초 제한 초과`); process.exit(2); }, OVERALL_LIMIT_MS);
main().catch((e) => {
  clearTimeout(overall);
  console.log(`UAT TEST-ROOM FAIL: 중단 — ${e.message}`);
  process.exit(2);
});
