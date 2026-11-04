// 화면 E2E 흐름(결정 0025): 흐름마다 새 테스트 방 하나와 방장 페이지 하나. 검사 ID 는 계획 261025-h1j 의 "검사 목록" 과 같다.
// 결과는 { scenario: "흐름/상태", size, id, label, ok, detail } 로 ctx.results 에 쌓인다.
import { join } from "node:path";
import { mkdirSync, readFileSync, utimesSync } from "node:fs";
import {
  SetupError,
  armAnnounceWatch,
  chooseRole,
  chooseVerdict,
  pressEndDiscussion,
  readAnnounceWatch,
  readGame,
  readGhostTagContrast,
  readResult,
  readResultFit,
  setBotVote,
  skipTo,
  tapPick,
  backToLobby,
  clearToasts,
  consoleCollector,
  clickInDialog,
  closeSheet,
  collectSnapshot,
  createTestRoom,
  dropSockets,
  hitsInputSurface,
  imeCompose,
  imeEnter,
  installFakeViewport,
  joinTestRoom,
  leaveLobby,
  openGuestJoinPage,
  openHostPage,
  openPerfPage,
  openTestSheet,
  readLinkState,
  readChatLines,
  readChatPanel,
  readKeyboardState,
  readLobbyFrame,
  readPaintStats,
  readWorld,
  reconnectInit,
  sampleWorld,
  screensOfWorld,
  readGuide,
  readJoinFit,
  readHeaderContrast,
  resetAndLeave,
  setBots,
  setLifecycle,
  settle,
  shot,
  sleep,
  startGame,
  tapWorld,
  readWalkWatch,
  typeAndSendChat,
  waitChatLine,
  waitWorldReady,
} from "./browser.mjs";
import {
  JOIN_FIT_MIN_H,
  LOBBY_EXTRA_SIZES,
  RECONNECT_KINDS,
  RECONNECT_ROUNDS,
  REOPEN_ROUNDS,
  RESTORED_GONE_MS,
  TAP_MIN,
  WORLD_SYNC_TOL,
  budgetChecks,
  chunkFailChecks,
  consoleIssues,
  contextLeakChecks,
  docHeightChecks,
  genericIssues,
  guideChecks,
  headerContrastChecks,
  isLocalOrigin,
  isWorldChunkUrl,
  joinFitChecks,
  memoryStableChecks,
  rectInside,
  rectsOverlap,
  lobbyHeaderChecks,
  lobbyStartChecks,
  nameTagFitChecks,
  ownTagInStageChecks,
  paintedFromStats,
  parseBarMask,
  pickTapTargets,
  worldTapRanking,
  deployHoldChecks,
  deployObservedOf,
  reconnectChecks,
  reconnectSummary,
  tagStackChecks,
  walkableCenters,
  worldSyncChecks,
  walkStartChecks,
  pcCenterChecks,
  wakeLockChecks,
  GAME_PANEL_EXTRA,
  announceChecks,
  faceListPanelH,
  faceNameFits,
  tagInStage,
  gamePanelHeight,
  ghostDomChecks,
  pickButtonChecks,
  resultChecks,
  resultFitChecks,
  LOBBY_SIZES,
  verdictPanelChecks,
} from "./lib.mjs";

export const OUT_DIR = new URL("./out/", import.meta.url).pathname;
const HOST_NICK = "화면검사기";
/** lobby·world 흐름의 방장 닉네임: 전각 8자(결정 0052-2) — 내 이름표 "… (나)" 가 가장 넓은 한글 경우다. */
const LOBBY_HOST_NICK = "방장이름여덟글자";
/** world 흐름의 손님 닉네임: 전각 8자. */
const WORLD_GUEST_NICK = "손님이름여덟글자";
/** 내 이름표 폭 측정 전용 손님: 이모지 8개(06-12 가 약 202px 로 쟀다). 통과·실패에 쓰지 않고 잰 값만 기록한다. */
const EMOJI_NICK = "😀😃😄😁😆😅🤣😂";

/** 검사 한 줄을 쌓는다. */
function recorder(ctx) {
  // keep: 통과 행에도 내용을 남긴다(승인 완화가 적용된 행, 참고 측정 행). 기본은 통과 행의 내용을 비운다.
  return (scenario, id, label, ok, detail = "", keep = false) => {
    ctx.results.push({ scenario, size: ctx.size.label, id, label, ok: !!ok, detail: ok && !keep ? "" : String(detail) });
  };
}

/** 판정이 아닌 참고 측정 행(통과, 내용 있음). 예: 이름표 폭, 탭 지연 값. */
const infoRow = (ctx, scenario, id, label, detail) => recorder(ctx)(scenario, id, label, true, detail, true);

/** 비동기 확인을 검사 결과 { ok, detail } 로 바꾼다(시간 초과·오류는 실패 + 이유). */
export async function attempt(fn) {
  try {
    const r = await fn();
    if (r === undefined || r === true) return { ok: true, detail: "" };
    if (r === false) return { ok: false, detail: "" };
    return r;
  } catch (e) {
    return { ok: false, detail: String(e instanceof Error ? e.message : e).split("\n")[0].slice(0, 160) };
  }
}

/** 방 만들기 → 방장 페이지 → S1·S2. */
export async function startHost(ctx, flowId, { nickname = HOST_NICK, initScripts = [] } = {}) {
  const rec = recorder(ctx);
  const room = await createTestRoom(ctx.origin, nickname);
  ctx.secrets.push(room.token);
  ctx.roomCode = room.code; // 링크 참가 probe(UX2-J)용. 방 코드는 비밀이 아니다 — 토큰은 남기지 않는다
  const host = await openHostPage(ctx.browser, { origin: ctx.origin, code: room.code, token: room.token, size: ctx.size, dpr: ctx.shots ? 2 : 1, mobile: ctx.size.mobile !== false, initScripts });
  ctx.host = host;
  const v = host.tracker.last();
  rec(`${flowId}/setup`, "S1", "방장으로 연결", v?.me?.isHost === true && v?.me?.testMode === true, `isHost ${v?.me?.isHost}, testMode ${v?.me?.testMode}`);
  rec(`${flowId}/setup`, "S2", "글꼴 Gowun Dodum", host.fontOk, host.fontDetail);
  return host;
}

/** 지금 화면을 스냅숏으로 찍고 공통 검사 G 한 줄을 쌓는다. 스냅숏(+issues)을 돌려준다. --shots 면 사진도 저장한다. */
export async function checkState(ctx, flowId, state, handle = ctx.host) {
  const rec = recorder(ctx);
  const { page } = handle;
  const snap = await collectSnapshot(page);
  snap.issues = handle.takeIssues();
  if (ctx.shots) {
    mkdirSync(OUT_DIR, { recursive: true });
    await shot(page, join(OUT_DIR, `${flowId}-${state}-${ctx.size.label}.png`));
  }
  const g = genericIssues(snap, ctx.size);
  const bad = g.filter((x) => !x.ok);
  rec(`${flowId}/${state}`, "G", "G 공통 검사", bad.length === 0, bad.length > 0 ? bad.map((x) => `${x.id} ${x.detail}`).join(" / ") : "");
  return snap;
}

const sameRect = (a, b) => Math.abs(a.left - b.left) < 0.01 && Math.abs(a.top - b.top) < 0.01 && Math.abs(a.width - b.width) < 0.01;

// ---- lobby (맵 로비, 06-17) ----

/** 사진 저장 폴더를 만들고 이 흐름의 사진 경로를 돌려준다. */
const shotPath = (ctx, name) => {
  mkdirSync(OUT_DIR, { recursive: true });
  return join(OUT_DIR, `${name}-${ctx.size.label}.png`);
};

/** 내 이름표(data-me)의 사각형 폭을 참고 행(NT2)으로 남긴다 — NAMETAG_MAX_W 180 과 견줄 수 있게. 통과·실패 판정이 아니다. */
function recordMyTagWidth(ctx, scenario, world, note = "") {
  const me = world.tags.find((t) => t.me);
  infoRow(ctx, scenario, "NT2", "내 이름표 폭 기록(참고, 판정 아님)", me ? `${Math.round(me.rect.width * 10) / 10}px (NAMETAG_MAX_W 180)${note}` : "내 이름표 없음");
}

async function lobbyFlow(ctx) {
  const rec = recorder(ctx);
  const { w, h } = ctx.size;
  const host = await startHost(ctx, "lobby", { nickname: LOBBY_HOST_NICK });
  const { page, tracker } = host;
  await waitWorldReady(page, 1);
  await settle(page);

  // 대기실 1명, 시트 닫힘: G · 헤더 L7 · [시작] L8 · 이름표 NT1 · 헤더 글씨 대비 H1 · 안내 UX1 · 문서 높이 UX2
  const s1 = await checkState(ctx, "lobby", "lobby");
  const frame1 = await readLobbyFrame(page);
  recOne(rec, "lobby/lobby", lobbyHeaderChecks(frame1.header, { w, h }));
  recOne(rec, "lobby/lobby", lobbyStartChecks(frame1.start, { n: 1 }));
  rec("lobby/lobby", "L9", "단계 이름은 [대기실]", frame1.title === "대기실", `제목 "${frame1.title}"`);
  const world1 = await readWorld(page);
  recOne(rec, "lobby/lobby", nameTagFitChecks(world1.tags, { expectTexts: [`${LOBBY_HOST_NICK} (나)`] }));
  recordMyTagWidth(ctx, "lobby/lobby", world1);
  recOne(rec, "lobby/lobby", headerContrastChecks(await readHeaderContrast(page), { expectTimer: false })); // H1: 위쪽 가림막 위에서도 4.5:1
  const g1 = await readGuide(page);
  recOne(rec, "lobby/lobby", guideChecks(g1, { phase: "lobby" }));
  recOne(rec, "lobby/lobby", docHeightChecks(g1, { h }));

  // 방 코드는 헤더에 없고 공유 시트 안에서만 보인다
  const share = await attempt(async () => {
    const headerText = await page.locator(".mf-lobby__header").innerText();
    if (headerText.includes(ctx.roomCode)) return { ok: false, detail: "헤더에 방 코드가 보임" };
    await page.locator('.mf-lobby__header [aria-label="공유"]').click();
    await page.waitForSelector("dialog[open]", { timeout: 3000 });
    const text = await page.locator("dialog[open]").first().innerText();
    const inSheet = text.includes(ctx.roomCode) || (await page.locator("dialog[open] input").first().inputValue().catch(() => "")).includes(ctx.roomCode);
    await page.locator('dialog[open] [aria-label="닫기"]').first().click();
    await page.waitForSelector("dialog[open]", { state: "detached", timeout: 3000 });
    return { ok: inSheet, detail: "공유 시트 안에 방 코드가 없음" };
  });
  rec("lobby/lobby", "L10", "방 코드는 공유 시트 안에서만", share.ok, share.detail);

  // [테스트] 자리(L1·L2 의 새 판): 헤더 아래 왼쪽, 눌림, 다른 조작과 안 겹침
  const tt = s1.tt;
  rec("lobby/lobby", "L1", "[테스트] 버튼이 보임", !!tt && tt.rect.width > 0 && tt.rect.height > 0 && rectInside(tt.rect, { left: 0, top: 0, width: w, height: h }) && tt.hit, tt ? `rect ${Math.round(tt.rect.left)},${Math.round(tt.rect.top)} ${Math.round(tt.rect.width)}x${Math.round(tt.rect.height)}, hit ${tt.hit}` : "버튼 없음");
  const clashes = tt ? s1.interactive.filter((e) => !sameRect(e.rect, tt.rect) && rectsOverlap(e.rect, tt.rect)).map((e) => e.desc) : ["버튼 없음"];
  rec("lobby/lobby", "L2", "[테스트]가 다른 조작과 안 겹침", clashes.length === 0, `겹침: ${clashes.join(", ")}`);
  const slot = frame1.test;
  const headerBottom = frame1.header.leave ? frame1.header.leave.rect.bottom : 0;
  rec(
    "lobby/lobby",
    "L11",
    "[테스트] 자리: 헤더 아래·왼쪽",
    !!slot && slot.rect.top >= headerBottom - 0.5 && slot.rect.left >= 0 && slot.rect.left <= w / 2 && slot.rect.height + 0.5 >= 44 && slot.rect.width + 0.5 >= 44,
    slot ? `rect ${Math.round(slot.rect.left)},${Math.round(slot.rect.top)} ${Math.round(slot.rect.width)}x${Math.round(slot.rect.height)}, 헤더 버튼 아래 ${Math.round(headerBottom)}` : "측정값 없음",
  );

  // 시트 열림
  await openTestSheet(page);
  const t1 = await attempt(async () => {
    const open = await page.locator('dialog[aria-label="테스트 도구"]').evaluate((d) => d.classList.contains("mf-dialog--open"));
    const title = await page.locator('dialog[aria-label="테스트 도구"] h2').first().isVisible();
    return { ok: open && title, detail: `open ${open}, 제목 보임 ${title}` };
  });
  rec("lobby/sheet", "T1", "테스트 시트 열림", t1.ok, t1.detail);
  const s2 = await checkState(ctx, "lobby", "sheet");
  const ts = s2.testSheet;
  let l3 = { ok: false, detail: "시트 정보 없음" };
  if (ts) {
    // 같은 줄 = 세로 가운데가 같다(줄은 align-items:center 라 높이가 다른 요소의 top 은 다르다). 줄바꿈이면 가운데가 크게 벌어진다.
    const mids = ts.stepper.map((r) => r.top + r.height / 2);
    const oneRow = mids.length > 0 && Math.max(...mids) - Math.min(...mids) <= 1;
    const insideRight = ts.stepper.length > 0 && ts.stepper.every((r) => r.right <= ts.sheet.right + 0.5 && r.left >= ts.sheet.left - 0.5);
    const big = (b) => !!b && b.rect.width + 0.5 >= 44 && b.rect.height + 0.5 >= 44 && b.hit;
    const ok = oneRow && insideRight && big(ts.minus) && big(ts.plus);
    l3 = { ok, detail: `한 줄 ${oneRow}(가운데 ${mids.map((m) => Math.round(m * 10) / 10).join("/")}), 시트 안 ${insideRight}, [−] ${big(ts.minus)}, [+] ${big(ts.plus)}` };
  }
  rec("lobby/sheet", "L3", "봇 줄 한 줄·[−][+] 44px", l3.ok, l3.detail);

  // 인원이 늘 때마다 [시작] 상태(2·3명 흐림, 4명 활성)와 이름표(말줄임 없음)를 본다. 새 이름표가 나타나는 연출(420ms)이 끝난 뒤에 잰다.
  const stepTo = async (n, scenario) => {
    await tracker.waitFor((v) => v.players.length === n, 3000, `인원 ${n}`);
    await waitWorldReady(page, n);
    await sleep(500);
    recOne(rec, scenario, lobbyStartChecks((await readLobbyFrame(page)).start, { n }));
    recOne(rec, scenario, nameTagFitChecks((await readWorld(page)).tags));
  };
  const grow = await attempt(async () => {
    for (const n of [2, 3, 4]) {
      await clickInDialog(page, "테스트 도구", "봇 늘리기");
      await stepTo(n, `lobby/인원 ${n}`);
    }
  });
  if (!grow.ok) rec("lobby/인원", "L4", "봇 늘리기로 인원 2·3·4 만들기", false, grow.detail);

  // 5명 채우기
  await clickInDialog(page, "테스트 도구", "5명 채우기");
  const l4 = await attempt(async () => {
    await tracker.waitFor((v) => v.players.length === 5, 3000, "인원 5");
    await page.waitForFunction(() => document.querySelector(".mf-tt-sheet__count")?.textContent?.trim() === "4명", null, { timeout: 3000 });
  });
  rec("lobby/sheet", "L4", "5명 채우기", l4.ok, l4.detail);
  if (l4.ok) await stepTo(5, "lobby/인원 5");

  // [+] / [−]
  const l5 = await attempt(async () => {
    await clickInDialog(page, "테스트 도구", "봇 늘리기");
    await tracker.waitFor((v) => v.players.length === 6, 3000, "인원 6");
    await page.waitForFunction(() => document.querySelector(".mf-tt-sheet__count")?.textContent?.trim() === "5명", null, { timeout: 3000 });
    await clickInDialog(page, "테스트 도구", "봇 줄이기");
    await tracker.waitFor((v) => v.players.length === 5, 3000, "인원 5");
    await page.waitForFunction(() => document.querySelector(".mf-tt-sheet__count")?.textContent?.trim() === "4명", null, { timeout: 3000 });
  });
  rec("lobby/sheet", "L5", "[+]/[−] 로 숫자가 바뀜", l5.ok, l5.detail);

  // 8명: [시작] 숫자가 8 / 8 이고, 8자 이름 8개가 한 맵에서 잘리지 않는다 + 겹친 이름표는 앞뒤가 정해진다
  const full = await attempt(async () => {
    await setBots(page, tracker, 7);
    await tracker.waitFor((v) => v.players.length === 8, 3000, "인원 8");
    await waitWorldReady(page, 8);
    await sleep(500);
  });
  if (!full.ok) rec("lobby/인원 8", "L4", "인원 8 만들기", false, full.detail);
  else {
    const frame8 = await readLobbyFrame(page);
    recOne(rec, "lobby/인원 8", lobbyStartChecks(frame8.start, { n: 8 }));
    const world8 = await readWorld(page);
    recOne(rec, "lobby/인원 8", nameTagFitChecks(world8.tags, { expectTexts: [`${LOBBY_HOST_NICK} (나)`] }));
    recOne(rec, "lobby/인원 8", tagStackChecks(world8.tags));
    const g8 = await checkState(ctx, "lobby", "인원 8");
    void g8;
  }

  // 시트 닫힘
  const t2 = await attempt(async () => {
    await closeSheet(page);
    return (await page.locator('dialog[aria-label="테스트 도구"]').count()) === 0;
  });
  rec("lobby/sheet", "T2", "테스트 시트 닫힘", t2.ok, t2.detail);
  // 8자 이름 8명 사진(시트를 닫은 뒤): 360 폭은 늘 남긴다. 맨 앞 이름표가 읽히는지는 backstop 으로 사람이 본다 — 봇은 걸음을 조종할 수 없어 8명을 한 점에 모을 수 없다
  if (full.ok && t2.ok && (w <= 360 || ctx.shots)) {
    await sleep(600);
    await shot(page, shotPath(ctx, "lobby-8"));
  }

  await joinLinkProbe(ctx); // UX2-J: 방장 + 봇 6명 방의 링크 참가 화면이 한 화면에 들어간다(P5-4)

  await leaveLobby(page);
}

/** 링크 참가 화면 probe 의 앉은 사람 수: 방장 + 봇 6명. */
const JOIN_PROBE_SEATED = 7;

/**
 * UX2-J(05-06, P5-4): 방장 + 봇 6명(앉은 사람 7명)인 방의 링크 참가 화면을 세션 없는 새 컨텍스트로 열어 문서 높이·`참가하기` 아래끝을 본다.
 * 화면 높이가 JOIN_FIT_MIN_H 미만이면 판정하지 않는다. 손님은 참가하지 않고 컨텍스트를 finally 에서 닫는다(T-05-14).
 */
async function joinLinkProbe(ctx) {
  const { h } = ctx.size;
  if (h < JOIN_FIT_MIN_H) return;
  const rec = recorder(ctx);
  const { page, tracker } = ctx.host;
  await openTestSheet(page);
  await setBots(page, tracker, JOIN_PROBE_SEATED - 1);
  await closeSheet(page);
  let guest = null;
  try {
    guest = await openGuestJoinPage(ctx.browser, { origin: ctx.origin, code: ctx.roomCode, size: ctx.size, dpr: 1 });
    const gp = guest.page;
    const waited = await attempt(async () => {
      await gp.waitForFunction((n) => document.querySelectorAll("ul.mf-join__seated > li").length === n, JOIN_PROBE_SEATED, { timeout: 12_000 });
    });
    if (!waited.ok) {
      const seen = await gp.locator("ul.mf-join__seated > li").count().catch(() => -1);
      rec("lobby/join", "UX2-J", "링크 참가 한 화면(문서·참가하기 버튼)", false, `앉은 사람 ${seen}명 ≠ 기대 ${JOIN_PROBE_SEATED}명(12초 안에 미리보기가 채워지지 않음)`);
      return;
    }
    await settle(gp);
    if (ctx.shots) {
      mkdirSync(OUT_DIR, { recursive: true });
      await shot(gp, join(OUT_DIR, `lobby-join-${ctx.size.label}.png`));
    }
    const j = await readJoinFit(gp);
    recOne(rec, "lobby/join", joinFitChecks(j, { h, expectSeated: JOIN_PROBE_SEATED }));
  } finally {
    if (guest) await guest.context.close().catch(() => {});
  }
}

// ---- world (두 페이지가 같은 방 로비에서 서로를 보고 같은 경로로 걷는다, 06-17) ----

/** shared/game/map.ts 원문에서 걸을 수 있는 칸 중심을 읽는다(.mjs 가 TS 를 직접 import 하지 않는다 — e2eContract 테스트가 원문 읽기가 BAR_MASK 와 같음을 고정한다). */
function walkableCentersOfApp() {
  const source = readFileSync(new URL("../../shared/game/map.ts", import.meta.url), "utf8");
  return walkableCenters(parseBarMask(source));
}

/** 구간 { p: [x0,z0,x1,z1,…] 1/100 단위, v: 단위/초 × 100 } 을 걷는 데 걸리는 시간(ms). */
function segmentDurationMs(seg) {
  let len = 0;
  for (let i = 0; i + 3 < seg.p.length; i += 2) len += Math.hypot(seg.p[i + 2] - seg.p[i], seg.p[i + 3] - seg.p[i + 1]);
  return (len / seg.v) * 1000;
}

/** 두 페이지에 같은 방의 손님을 붙인다(HTTP 참가 → 손님 페이지). 토큰은 ctx.secrets 에 넣어 출력에서 가린다. */
async function openGuest(ctx, nickname, { initScripts = [] } = {}) {
  const joined = await joinTestRoom(ctx.origin, ctx.roomCode, nickname);
  ctx.secrets.push(joined.token);
  const guest = await openHostPage(ctx.browser, { origin: ctx.origin, code: joined.code, token: joined.token, size: ctx.size, dpr: 1, mobile: ctx.size.mobile !== false, guest: true, initScripts });
  return { guest, seat: joined.seat };
}

async function worldFlow(ctx) {
  const rec = recorder(ctx);
  const sc = "world/walk";
  const host = await startHost(ctx, "world", { nickname: LOBBY_HOST_NICK });
  const { page: hp, tracker: ht } = host;
  const { guest: g, seat: gSeat } = await openGuest(ctx, WORLD_GUEST_NICK);
  try {
    const { page: gp, tracker: gt } = g;
    const hSeat = ht.last().me.seat;
    await Promise.all([ht.waitFor((v) => v.players.length === 2, 5000, "방장 쪽 인원 2"), gt.waitFor((v) => v.players.length === 2, 5000, "손님 쪽 인원 2")]);
    await Promise.all([waitWorldReady(hp, 2), waitWorldReady(gp, 2)]);
    await Promise.all([settle(hp), settle(gp)]);

    // 서로의 이름표: 각자 화면에 자기 이름표(나)와 상대 이름표가 보이고 말줄임이 없다
    const [hw, gw] = await Promise.all([readWorld(hp), readWorld(gp)]);
    const seen = (w, mine, other) => w.tags.length === 2 && w.tags.some((t) => t.me && t.text === `${mine} (나)`) && w.tags.some((t) => !t.me && t.text === other);
    rec(sc, "W0", "두 페이지가 서로의 이름표를 봄", seen(hw, LOBBY_HOST_NICK, WORLD_GUEST_NICK) && seen(gw, WORLD_GUEST_NICK, LOBBY_HOST_NICK), `방장 화면 ${hw.tags.map((t) => t.text).join("/")} · 손님 화면 ${gw.tags.map((t) => t.text).join("/")}`);
    recOne(rec, sc, nameTagFitChecks(hw.tags, { expectTexts: [`${LOBBY_HOST_NICK} (나)`, WORLD_GUEST_NICK] }));
    recOne(rec, sc, nameTagFitChecks(gw.tags, { expectTexts: [`${WORLD_GUEST_NICK} (나)`, LOBBY_HOST_NICK] }));
    await checkState(ctx, "world", "lobby"); // 방장 화면의 G (콘솔 오류·가로 넘침·다른 출처 요청 없음)

    // 목적지: 손님 현재 위치에서 3 단위 이상 먼, 두 페이지 화면에 모두 보이고 입력 면 위에 있는 걸을 수 있는 칸 중 가장 먼 곳
    // (뒤에서 방장이 같은 점을 눌러 두 캐릭터를 한 점에 모으려면 방장 화면에서도 눌릴 수 있어야 한다)
    const from = await sampleWorld(gp, gSeat);
    if (!from) throw new SetupError("손님 위치를 읽지 못함(sample)");
    const centers = walkableCentersOfApp();
    const pad = 28;
    const [gScreens, hScreens] = await Promise.all([screensOfWorld(gp, centers), screensOfWorld(hp, centers)]);
    const inStage = (sc, st) => !!sc && !!st && Number.isFinite(sc.sx) && sc.sx > pad && sc.sx < ctx.size.w - pad && sc.sy > st.top + pad && sc.sy < st.bottom - pad;
    const onScreen = centers.map((c, i) => ({ ...c, sx: gScreens[i]?.sx, sy: gScreens[i]?.sy, hx: hScreens[i]?.sx, hy: hScreens[i]?.sy })).filter((c, i) => inStage(gScreens[i], gw.stage) && inStage(hScreens[i], hw.stage));
    // 3 단위 이상 먼 칸이 없는 낮은 스테이지(360x560 의 248)는 보이는 칸 중 가장 먼 칸과 더 짧은 걷는 길이 하한을 쓴다(worldTapRanking, 07-20)
    const { ranked, low, minWalkMs } = worldTapRanking(onScreen, from);
    const probe = ranked.slice(0, 40);
    const [gHits, hHits] = await Promise.all([hitsInputSurface(gp, probe), hitsInputSurface(hp, probe.map((c) => ({ sx: c.hx, sy: c.hy })))]);
    const target = probe.find((_, i) => gHits[i] && hHits[i]);
    if (!target) throw new SetupError(`탭할 목적지를 찾지 못함(두 화면에 보이는 칸 ${onScreen.length}개, ${low ? "1.5" : "3"} 단위 이상 먼 칸 ${ranked.length}개)`);

    // 손님이 바닥을 한 번 누른다
    const tap = await tapWorld(gp, gt, gSeat, target.x, target.z);
    if (!tap.move) rec(sc, "W4", "탭 → 손님 구간 시작 500ms 이내", false, "3초 안에 내 구간이 오지 않음");
    else {
      // 방장 페이지도 같은 구간을 받을 때까지 기다린다(같은 t0)
      await attempt(async () => {
        const start = performance.now();
        while (ht.moves.get(gSeat)?.t0 !== tap.move.t0) {
          if (performance.now() - start > 3000) throw new Error("방장 페이지가 손님 구간을 받지 못함");
          await sleep(10);
        }
      }).then((r) => {
        if (!r.ok) rec(sc, "W2", "두 페이지 손님 위치 차", false, r.detail);
      });
      const seg = tap.move;
      const dur = segmentDurationMs(seg);
      rec(sc, "W5", `걷는 길이가 충분함(≥ ${minWalkMs / 1000}초${low ? ", 낮은 스테이지 기준" : ""})`, dur >= minWalkMs, `구간 ${Math.round(dur)}ms (목적지까지 ${Math.round(Math.hypot(target.x - from.x, target.z - from.z) * 100) / 100} 단위)`);

      // 걷는 동안 50ms 간격 5번: 같은 서버 시각 t 로 두 페이지의 손님 위치를 읽는다. t = 구간 출발 시각 + (구간을 받은 뒤 지난 시간)
      const a = [];
      const b = [];
      const realtime = []; // 같은 순간 각 페이지가 자기 시계로 읽은 위치(t 를 주지 않음) — 시계 오프셋 추정 오차까지 포함한 차이
      for (let i = 0; i < 5; i++) {
        const t = Math.round(seg.t0 + (performance.now() - seg.at));
        const [pa, pb, ra, rb] = await Promise.all([sampleWorld(gp, gSeat, t), sampleWorld(hp, gSeat, t), sampleWorld(gp, gSeat), sampleWorld(hp, gSeat)]);
        a.push({ kind: "walk", t, p: pa });
        b.push({ kind: "walk", t, p: pb });
        realtime.push(ra && rb ? Math.hypot(ra.x - rb.x, ra.z - rb.z) : Number.NaN);
        await sleep(50);
      }
      const rtMax = Math.max(...realtime);
      rec(sc, "W10", `걷는 동안 두 페이지의 실시간 위치 차 ≤ ${WORLD_SYNC_TOL} (같은 머신)`, rtMax <= WORLD_SYNC_TOL, `최대 ${Number.isFinite(rtMax) ? rtMax.toFixed(3) : "읽지 못함"} 단위`);
      // 도착 뒤 한 번 (구간 끝 + 0.5초)
      const tEnd = Math.round(seg.t0 + dur + 500);
      const [ea, eb] = await Promise.all([sampleWorld(gp, gSeat, tEnd), sampleWorld(hp, gSeat, tEnd)]);
      a.push({ kind: "arrived", t: tEnd, p: ea });
      b.push({ kind: "arrived", t: tEnd, p: eb });
      for (const r of worldSyncChecks({ a, b, ringMs: tap.ringMs, segmentMs: tap.segmentMs })) recOne(rec, sc, r);
      const diffs = a.map((x, i) => (x.p && b[i].p ? Math.hypot(x.p.x - b[i].p.x, x.p.z - b[i].p.z) : Number.NaN));
      infoRow(ctx, sc, "W9", "측정값 기록(참고, 판정 아님)", `링 ${tap.ringMs === null ? "없음" : `${Math.round(tap.ringMs * 10) / 10}ms`} · 구간 도착 ${tap.segmentMs === null ? "없음" : `${Math.round(tap.segmentMs)}ms`} · 위치 차 최대 ${Math.max(...diffs).toFixed(4)} 단위 · 실시간 위치 차 최대 ${Number.isFinite(rtMax) ? rtMax.toFixed(4) : "읽지 못함"} 단위 · 구간 ${Math.round(dur)}ms`);
      const off = ea ? Math.hypot(ea.x - target.x, ea.z - target.z) : Number.NaN;
      rec(sc, "W6", "도착 위치가 누른 점", off <= 0.3, `도착 (${ea ? `${ea.x.toFixed(2)}, ${ea.z.toFixed(2)}` : "없음"}) ↔ 누른 점 (${target.x.toFixed(2)}, ${target.z.toFixed(2)})`);

      // 도착하고 카메라가 따라잡은 뒤: 내 이름표와 내 발이 스테이지 사각형 안, 링은 사라짐
      await sleep(Math.max(0, seg.at + dur + 1500 - performance.now()));
      // 손님 탭 한 번의 화면 위치(결정 0059): 탭 뒤 3프레임 안 출발(W11)·걷는 동안 한 프레임 튐 없음(W12)
      const walkWatch = await readWalkWatch(gp);
      for (const r of walkStartChecks(walkWatch)) recOne(rec, sc, r);
      const arrived = await readWorld(gp);
      const mine = arrived.tags.find((t) => t.me);
      recOne(rec, "world/arrived", ownTagInStageChecks(mine?.rect ?? null, arrived.stage));
      const foot = await screensOfWorld(gp, [await sampleWorld(gp, gSeat)]);
      const footOk = !!foot[0] && !!arrived.stage && foot[0].sx >= 0 && foot[0].sx <= ctx.size.w && foot[0].sy >= arrived.stage.top && foot[0].sy <= arrived.stage.bottom;
      rec("world/arrived", "W7", "카메라가 따라가 내 발이 스테이지 안", footOk, foot[0] ? `발 (${Math.round(foot[0].sx)}, ${Math.round(foot[0].sy)}) · 스테이지 ${Math.round(arrived.stage?.top ?? 0)}~${Math.round(arrived.stage?.bottom ?? 0)}` : "발 위치를 읽지 못함");
      rec("world/arrived", "W8", "도착 뒤 목적지 링이 사라짐", arrived.ring === null, `data-ring ${arrived.ring}`);
      recOne(rec, "world/arrived", nameTagFitChecks(arrived.tags));
      if (ctx.shots) await shot(gp, shotPath(ctx, "world-guest-arrived"));

      // 방장도 같은 점으로 걸어가 두 캐릭터가 한 점에 모인다: 겹친 이름표는 앞뒤가 하나로 정해진다(UI-SPEC E2)
      const hostTap = await tapWorld(hp, ht, hSeat, target.x, target.z);
      if (hostTap.move) {
        await sleep(segmentDurationMs(hostTap.move) + 1200);
        const stacked = await readWorld(hp);
        recOne(rec, "world/stack", tagStackChecks(stacked.tags));
        recOne(rec, "world/stack", nameTagFitChecks(stacked.tags));
        // 손님 시점도 같다: 내 이름표(손님)가 맨 위여야 한다 — 예전엔 seat 번호가 큰 쪽이 항상 위였다(G-06-4)
        const stackedGuest = await readWorld(gp);
        recOne(rec, "world/stack", tagStackChecks(stackedGuest.tags));
        if (w360(ctx) || ctx.shots) await shot(hp, shotPath(ctx, "world-stack"));
      } else rec("world/stack", "NT3", "겹친 이름표: 내 이름표 맨 위·맨 앞 면 짙음·안 겹치면 80%", false, "방장 구간이 오지 않음");
    }
  } finally {
    await g.context.close().catch(() => {});
  }

  // 참고 측정: 이모지 8개 닉네임 손님의 내 이름표 폭(판정 아님) — 06-12 가 약 202px 로 쟀다
  const probe = await attempt(async () => {
    const { guest: eg } = await openGuest(ctx, EMOJI_NICK);
    try {
      await waitWorldReady(eg.page, 3); // 방장 + 나간 손님(연결 끊김으로 자리가 남음) + 이모지 손님
      await settle(eg.page);
      recordMyTagWidth(ctx, "world/emoji", await readWorld(eg.page), " · 이모지 8개 + ' (나)'");
    } finally {
      await eg.context.close().catch(() => {});
    }
  });
  if (!probe.ok) rec("world/emoji", "NT2", "내 이름표 폭 기록(참고, 판정 아님)", false, probe.detail);

  await leaveLobby(hp);
}

// ---- chat-lobby (로비 자유 채팅, 07-13, CHAT-01) ----

/** chat-lobby 에서 손님이 보내는 글 */
const CHAT_LOBBY_TEXT = "안녕하세요";
/** 입력 중 단계(07-18)에서 손님이 넣기만 하고 보내지 않는 글 */
const CHAT_LOBBY_TYPING = "안";

// 로비 채팅 패널 치수(UI-SPEC 구조 표). src/game/chatUi.ts 의 값을 그대로 옮긴 사본이다 — 값을 바꾸려면 UI-SPEC 과 chatUi.ts 를 먼저 바꾼다.
const CHAT_LOG_TALL = 152;
const CHAT_LOG_SHORT = 96;
const CHAT_TALL_ROOM_MIN_H = 780;
const CHAT_LOBBY_EXTRA = 154;
const CHAT_CONTROL = 48;
const CHAT_PANEL_EPS = 1;

/** 한 페이지의 로비 채팅 패널 치수 판정. m 은 readChatPanel 의 값. 검사 행 목록을 돌려준다. */
function chatPanelRows(m) {
  if (!m) return [{ id: "CP0", label: "채팅 패널을 읽음", ok: false, detail: "패널·기록 칸·입력칸·보내기 중 없는 것이 있음" }];
  const logWant = m.roomH >= CHAT_TALL_ROOM_MIN_H ? CHAT_LOG_TALL : CHAT_LOG_SHORT;
  const panelWant = logWant + CHAT_LOBBY_EXTRA;
  const near = (a, b) => Math.abs(a - b) <= CHAT_PANEL_EPS;
  const r1 = (n) => Math.round(n * 10) / 10;
  return [
    { id: "CP1", label: `로비 패널 높이 ${panelWant} (방 높이 ${r1(m.roomH)} → 기록 ${logWant} + ${CHAT_LOBBY_EXTRA})`, ok: near(m.panel.height, panelWant), detail: `패널 ${r1(m.panel.height)}` },
    { id: "CP2", label: `기록 칸 높이 ${logWant}`, ok: near(m.log.height, logWant), detail: `기록 칸 ${r1(m.log.height)}` },
    { id: "CP3", label: `입력칸·보내기 높이 ${CHAT_CONTROL}`, ok: near(m.input.height, CHAT_CONTROL) && near(m.send.height, CHAT_CONTROL) && near(m.send.width, CHAT_CONTROL), detail: `입력칸 ${r1(m.input.height)} · 보내기 ${r1(m.send.width)}x${r1(m.send.height)}` },
    { id: "CP4", label: "입력칸 글자 16px", ok: m.inputFont === 16, detail: `${m.inputFont}px` },
    { id: "CP5", label: `보내기 누르는 영역 ≥ ${TAP_MIN} 이고 눌림`, ok: m.send.width + 0.5 >= TAP_MIN && m.send.height + 0.5 >= TAP_MIN && m.send.hit, detail: `${r1(m.send.width)}x${r1(m.send.height)} hit ${m.send.hit}` },
    { id: "CP6", label: "스테이지 사각형 아래 끝 = 방 높이 − 패널 높이", ok: near(m.stageBottom, m.roomH - m.panel.height), detail: `아래 끝 ${r1(m.stageBottom)} · 방 높이 − 패널 ${r1(m.roomH - m.panel.height)}` },
  ];
}

/**
 * 로비 트레이서: 방장·손님 두 페이지가 로비에 들어오고, 손님이 한 줄을 보내면 두 페이지 기록 칸에 서버 방송이 돌아온 줄이 보인다.
 * 보낸 폰은 방송이 돌아온 뒤에야 줄이 생기고 이름이 "나", 받은 폰은 보낸 사람의 닉네임이다. 모두 채널 all(공개)이다.
 */
async function chatLobbyFlow(ctx) {
  const rec = recorder(ctx);
  const sc = "chat-lobby/send";
  const host = await startHost(ctx, "chat-lobby", { nickname: LOBBY_HOST_NICK });
  const { page: hp, tracker: ht } = host;
  const { guest: g, seat: gSeat } = await openGuest(ctx, WORLD_GUEST_NICK);
  try {
    const { page: gp, tracker: gt } = g;
    await Promise.all([ht.waitFor((v) => v.players.length === 2, 5000, "방장 쪽 인원 2"), gt.waitFor((v) => v.players.length === 2, 5000, "손님 쪽 인원 2")]);
    await Promise.all([waitWorldReady(hp, 2), waitWorldReady(gp, 2)]);
    await Promise.all([settle(hp), settle(gp)]);

    // 손님이 한 줄을 보낸다 → 두 페이지 기록 칸에 그 줄이 나타난다
    await typeAndSendChat(gp, CHAT_LOBBY_TEXT);
    const arrived = await attempt(async () => {
      await Promise.all([waitChatLine(hp, CHAT_LOBBY_TEXT), waitChatLine(gp, CHAT_LOBBY_TEXT)]);
    });
    rec(sc, "CL1", "손님이 보낸 한 줄이 두 페이지 기록 칸에 보임", arrived.ok, arrived.detail);
    if (arrived.ok) {
      const [hl, gl] = await Promise.all([readChatLines(hp), readChatLines(gp)]);
      const only = (lines) => (lines ?? []).filter((l) => l.text === CHAT_LOBBY_TEXT);
      const hMine = only(hl);
      const gMine = only(gl);
      rec(sc, "CL2", "그 줄은 페이지마다 정확히 한 번", hMine.length === 1 && gMine.length === 1, `방장 화면 ${hMine.length}줄 · 손님 화면 ${gMine.length}줄`);
      rec(sc, "CL3", "손님 쪽 이름은 '나', 방장 쪽 이름은 손님 닉네임", gMine[0]?.name === "나" && hMine[0]?.name === WORLD_GUEST_NICK, `손님 화면 "${gMine[0]?.name}" · 방장 화면 "${hMine[0]?.name}"`);
      rec(sc, "CL4", "줄의 채널은 all, 보낸 자리는 손님", hMine[0]?.ch === "all" && gMine[0]?.ch === "all" && hMine[0]?.seat === String(gSeat) && gMine[0]?.seat === String(gSeat), `방장 화면 ch ${hMine[0]?.ch} seat ${hMine[0]?.seat} · 손님 화면 ch ${gMine[0]?.ch} seat ${gMine[0]?.seat} (손님 자리 ${gSeat})`);
      const cleared = await gp.locator("[data-chat-input]").inputValue();
      rec(sc, "CL5", "보낸 뒤 손님 입력칸이 비워짐", cleared === "", `입력칸 ${cleared.length}자`);
    }
    // 패널 치수: 방장·손님 두 화면 모두 UI-SPEC 폰 크기 표대로(방 높이 ≥ 780 이면 306, 아니면 250)
    for (const [who, page] of [["방장", hp], ["손님", gp]]) {
      for (const r of chatPanelRows(await readChatPanel(page))) rec(`chat-lobby/panel-${who}`, r.id, r.label, r.ok, r.detail);
    }
    // 입력 중 알약(07-18, CHAT-04): 손님이 글자를 넣기만 하면 방장 화면의 손님 이름표에 data-typing true, 칸을 비우면 사라진다.
    // 서버는 한 사람의 켜짐을 1.5초에 한 번만 중계하니, 위에서 보낸 글의 켜짐과 겹치지 않게 1.7초 쉰다.
    const tagTyping = `.mf-world__tag[data-seat="${gSeat}"] [data-typing="true"]`;
    await hp.waitForTimeout(1700);
    await gp.locator("[data-chat-input]").fill(CHAT_LOBBY_TYPING);
    const typingOn = await attempt(async () => {
      await hp.waitForSelector(tagTyping, { timeout: 1500 });
    });
    rec(sc, "CL6", "손님이 글자를 넣으면 방장 화면 손님 이름표에 입력 중 알약(data-typing true)", typingOn.ok, typingOn.detail);
    const mineOn = await gp.locator(`.mf-world__tag[data-me="true"] [data-typing="true"]`).count();
    rec(sc, "CL7", "손님 자기 화면 자기 이름표에도 입력 중 알약이 켜짐", mineOn === 1, `알약 ${mineOn}개`);
    await gp.locator("[data-chat-input]").fill("");
    const typingOff = await attempt(async () => {
      await hp.waitForSelector(tagTyping, { state: "detached", timeout: 1500 });
    });
    rec(sc, "CL8", "손님이 칸을 비우면 방장 화면 알약이 사라짐", typingOff.ok, typingOff.detail);
    await checkState(ctx, "chat-lobby", "lobby"); // 방장 화면의 G (콘솔 오류·가로 넘침·누르기 크기·글자 크기)
  } finally {
    await g.context.close().catch(() => {});
  }
  await leaveLobby(hp);
}

// ---- chat-ime (한글 조합 중 Enter·보내기, 07-19, CHAT-05) ----

/** chat-ime 에서 손님이 조합하는 글 두 개 */
const IME_ENTER_TEXT = "안녕하세요";
const IME_BUTTON_TEXT = "반가워요";

/** 앞 글자들은 자모 → 글자로 조합해 확정한다. 단계 하나 = [조합 중 글자들…, 확정 글자]. 마지막 글자(요)는 아래에서 조합 중으로 남긴다. */
const IME_ENTER_STEPS = [["ㅇ", "아", "안"], ["ㄴ", "녀", "녕"], ["ㅎ", "하"], ["ㅅ", "세"]];
const IME_BUTTON_STEPS = [["ㅂ", "바", "반"], ["ㄱ", "가"], ["ㅇ", "워"]];

/** 단계들을 차례로 조합하고 마지막 글자로 확정한다. 마지막 글자 하나는 호출한 쪽이 조합 중으로 남겨 둔다. */
async function imeTypeSteps(page, steps) {
  for (const group of steps) {
    await imeCompose(page, [...group.slice(0, -1), { commit: group[group.length - 1] }]);
  }
}

/** 보낸 한 줄이 기록에 몇 번 있는지 */
const countLines = async (page, text) => ((await readChatLines(page)) ?? []).filter((l) => l.text === text).length;

/**
 * 한글 조합 트레이서: Chromium 의 진짜 IME 경로(CDP imeSetComposition)로 손님이 "안녕하세요" 를 조합하다 마지막 글자 조합 중 Enter,
 * 또 "반가워요" 를 조합하다 마지막 글자 조합 중 보내기. 두 경우 모두 두 페이지 기록에 줄이 정확히 한 번, 입력칸에는 꼬리 글자가 남지 않는다.
 */
async function chatImeFlow(ctx) {
  const rec = recorder(ctx);
  const sc = "chat-ime/compose";
  const host = await startHost(ctx, "chat-ime", { nickname: LOBBY_HOST_NICK });
  const { page: hp, tracker: ht } = host;
  const { guest: g } = await openGuest(ctx, WORLD_GUEST_NICK);
  try {
    const { page: gp, tracker: gt } = g;
    await Promise.all([ht.waitFor((v) => v.players.length === 2, 5000, "방장 쪽 인원 2"), gt.waitFor((v) => v.players.length === 2, 5000, "손님 쪽 인원 2")]);
    await Promise.all([waitWorldReady(hp, 2), waitWorldReady(gp, 2)]);
    await Promise.all([settle(hp), settle(gp)]);
    const input = gp.locator("[data-chat-input]");
    await input.focus();

    // (a) 마지막 글자를 조합하는 중 Enter(keyCode 229) → 확정 → Enter 한 번
    await imeTypeSteps(gp, IME_ENTER_STEPS);
    await imeCompose(gp, ["ㅇ", "요"]);
    const midValue = await input.inputValue();
    await imeEnter(gp, "요");
    const sentA = await attempt(async () => {
      await Promise.all([waitChatLine(hp, IME_ENTER_TEXT, 500), waitChatLine(gp, IME_ENTER_TEXT, 500)]);
    });
    rec(sc, "IME1", `조합 중 Enter: "${IME_ENTER_TEXT}" 줄이 0.5초 안에 두 페이지 기록에 보임 (보내기 전 입력칸 "${midValue}")`, sentA.ok, sentA.detail);
    const [hA, gA] = await Promise.all([countLines(hp, IME_ENTER_TEXT), countLines(gp, IME_ENTER_TEXT)]);
    rec(sc, "IME2", "그 줄은 페이지마다 정확히 한 번", hA === 1 && gA === 1, `방장 화면 ${hA}줄 · 손님 화면 ${gA}줄`);
    rec(sc, "IME3", "보낸 뒤 손님 입력칸이 비어 있음(꼬리 글자 없음)", (await input.inputValue()) === "", `입력칸 "${await input.inputValue()}"`);

    // 서버는 한 사람의 글 사이를 600ms 이상 벌린다(D5 CHAT_MIN_GAP_MS) — 두 번째 글이 거절되지 않게 쉰다
    await gp.waitForTimeout(1000);

    // (b) 마지막 글자를 조합하는 중 보내기: 포커스를 옮기지 않는 DOM click(iOS 의 터치처럼) → 조합 확정 → 보내짐
    await imeTypeSteps(gp, IME_BUTTON_STEPS);
    await imeCompose(gp, ["ㅇ", "요"]);
    await gp.evaluate(() => document.querySelector("[data-chat-send]")?.click());
    await imeCompose(gp, [{ commit: "요" }]);
    const sentB = await attempt(async () => {
      await Promise.all([waitChatLine(hp, IME_BUTTON_TEXT, 1000), waitChatLine(gp, IME_BUTTON_TEXT, 1000)]);
    });
    rec(sc, "IME4", `조합 중 보내기: "${IME_BUTTON_TEXT}" 줄이 두 페이지 기록에 보임`, sentB.ok, sentB.detail);
    const [hB, gB] = await Promise.all([countLines(hp, IME_BUTTON_TEXT), countLines(gp, IME_BUTTON_TEXT)]);
    rec(sc, "IME5", "그 줄은 페이지마다 정확히 한 번", hB === 1 && gB === 1, `방장 화면 ${hB}줄 · 손님 화면 ${gB}줄`);
    rec(sc, "IME6", "보낸 뒤 손님 입력칸이 비어 있음(꼬리 글자 없음)", (await input.inputValue()) === "", `입력칸 "${await input.inputValue()}"`);

    // (c) 1초 뒤에도 입력칸은 비어 있고 줄 수는 늘지 않는다(되살아난 글자·두 번 전송 없음)
    await gp.waitForTimeout(1000);
    const [hC, gC, lastValue] = await Promise.all([countLines(hp, IME_BUTTON_TEXT), countLines(gp, IME_BUTTON_TEXT), input.inputValue()]);
    const total = ((await readChatLines(gp)) ?? []).length;
    rec(sc, "IME7", "1초 뒤에도 입력칸이 비어 있고 두 줄이 그대로 한 번씩", lastValue === "" && hC === 1 && gC === 1 && (await countLines(gp, IME_ENTER_TEXT)) === 1 && total === 2, `입력칸 "${lastValue}" · 손님 화면 전체 ${total}줄 · 방장 ${hC} 손님 ${gC}`);
    await checkState(ctx, "chat-ime", "lobby");
  } finally {
    await g.context.close().catch(() => {});
  }
  await leaveLobby(hp);
}

// ---- chat-keyboard (가상 visualViewport 로 본 키보드 배치, 07-19, CHAT-05 — 합격 검사 1·2·3·6 의 자동 몫) ----

// 키보드 열림 치수(UI-SPEC 패널과 키보드). src/game/chatUi.ts 의 값을 그대로 옮긴 사본이다.
/** 가상 키보드 높이(폰 크기 표의 K) */
const KB_LIFT = 336;
const KB_PANEL_H = 150;
const KB_LOG_H = 72;
/** 큰 폰(390x844 이상)은 캐릭터 발과 이름표(입력 중 칸 포함)가 남은 스테이지 안에 모두 있어야 한다. 그 아래 작은 폰은 캐릭터 몸만 본다(가정 A2, 합격 검사 3) */
const KB_BIG_MIN_H = 800;
const KB_EPS = 0.5;

/** 내 자리에서 가장 먼, 맵 입력 면 위에 있고 화면 안에 보이는 걸을 수 있는 칸. 없으면 null. */
async function farWalkableOnSurface(page, size, from) {
  const centers = walkableCentersOfApp();
  const screens = await screensOfWorld(page, centers);
  const onScreen = centers
    .map((c, i) => ({ ...c, sx: screens[i]?.sx, sy: screens[i]?.sy }))
    .filter((c) => Number.isFinite(c.sx) && c.sx > 20 && c.sx < size.w - 20 && c.sy > 80 && c.sy < size.h - 20);
  const probe = pickTapTargets(onScreen, from, { minDist: 2 }).slice(0, 80);
  const hits = await hitsInputSurface(page, probe);
  return probe.find((_, i) => hits[i]) ?? null;
}

/**
 * 로비 가상 키보드 흐름: 입력칸에 포커스를 주고 visualViewport 를 K=336 만큼 줄인다(addInitScript 로 바꾼 가짜).
 * 포커스 후 300·1000ms 에 패널이 키보드 위에 붙고, 캔버스가 크기를 바꾸지 않고(ResizeObserver 0), 내 캐릭터가 남은 스테이지에 보이는지 본다.
 * 이어서 vv.offsetTop 120 에서 헤더가 따라 내려오는지, 줄을 보낸 뒤에도 포커스·패널 위치가 그대로인지, 입력 중 맵 탭이 걷지 않고 키보드만 닫는지(D4)를 본다.
 * 가짜 값은 앱의 배치 식만 시험한다 — 실제 iOS·Android 키보드는 07-21 사람 확인(가정 A1).
 */
async function chatKeyboardFlow(ctx) {
  const rec = recorder(ctx);
  const sc = "chat-keyboard/lobby";
  const { w, h } = ctx.size;
  const big = h >= KB_BIG_MIN_H;
  const host = await startHost(ctx, "chat-keyboard", { nickname: LOBBY_HOST_NICK, initScripts: [installFakeViewport] });
  const { page, tracker } = host;
  const mySeat = tracker.last().me.seat;
  await waitWorldReady(page, 1);
  await settle(page);
  const input = page.locator("[data-chat-input]");
  const r1 = (n) => Math.round(n * 10) / 10;
  const near = (a, b, eps = KB_EPS) => Math.abs(a - b) <= eps;

  // 닫힌 기준: 열림 표식 없음, 행동 줄([시작]) 있음, 캔버스 크기와 ResizeObserver 기록기
  const armed = await page.evaluate(() => window.__mfRo?.arm?.() === true);
  const closed = await readKeyboardState(page, mySeat);
  if (!closed || !armed) throw new SetupError(`키보드 검사 준비 실패(상태 ${!!closed}, 기록기 ${armed})`);
  rec(sc, "KB0", "닫힌 기준: 열림 표식 없음·행동 줄 있음·lift 0", closed.kbOpen === null && closed.actionButtons >= 1 && closed.lift === "0px", `data-kb-open ${closed.kbOpen} · 행동 줄 버튼 ${closed.actionButtons} · lift ${closed.lift}`);

  // 포커스 → 가상 키보드 열기 → 글자를 넣어 입력 중 칸을 켠다(이름표 스택이 22px 늘어난다)
  await input.focus();
  await page.evaluate((k) => window.__mfVv.set(window.innerHeight - k, 0), KB_LIFT);
  await input.fill("안");
  const t0 = Date.now();
  const sampleAt = async (ms) => {
    await page.waitForTimeout(Math.max(0, ms - (Date.now() - t0)));
    return readKeyboardState(page, mySeat);
  };
  const opened = { 300: await sampleAt(300), 1000: await sampleAt(1000) };
  for (const ms of [300, 1000]) {
    const k = opened[ms];
    if (!k) {
      rec(sc, `KB-${ms}`, `포커스 ${ms}ms 에 상태를 읽음`, false, "로비를 읽지 못함");
      continue;
    }
    const vvBottom = k.vv.height + k.vv.offsetTop;
    const stageTop = k.headerBottom;
    const stageBottom = k.panel.top;
    rec(sc, `KB1-${ms}`, `포커스 ${ms}ms: 패널·입력줄 아래 ≤ 보이는 영역 아래(검사 1), 패널은 키보드 바로 위`, k.panel.bottom <= vvBottom + KB_EPS && k.input.bottom <= vvBottom + KB_EPS && near(k.panel.bottom, vvBottom, 1), `패널 아래 ${r1(k.panel.bottom)} · 입력줄 아래 ${r1(k.input.bottom)} · 보이는 영역 아래 ${r1(vvBottom)}`);
    rec(sc, `KB2-${ms}`, `포커스 ${ms}ms: data-kb-open true·행동 줄 없음·기록 칸 ${KB_LOG_H}·패널 ${KB_PANEL_H}`, k.kbOpen === "true" && k.actionButtons === 0 && near(k.log.height, KB_LOG_H, 1) && near(k.panel.height, KB_PANEL_H, 1), `열림 ${k.kbOpen} · 행동 줄 버튼 ${k.actionButtons} · 기록 칸 ${r1(k.log.height)} · 패널 ${r1(k.panel.height)}`);
    rec(sc, `KB3-${ms}`, `포커스 ${ms}ms: 캔버스 크기 불변·ResizeObserver 호출 0(검사 2)`, k.roCalls === 0 && k.host.w === closed.host.w && k.host.h === closed.host.h && k.canvas?.attrW === closed.canvas?.attrW && k.canvas?.attrH === closed.canvas?.attrH && k.canvas?.cssW === closed.canvas?.cssW && k.canvas?.cssH === closed.canvas?.cssH, `호출 ${k.roCalls} · 호스트 ${k.host.w}x${k.host.h}(기준 ${closed.host.w}x${closed.host.h}) · canvas ${k.canvas?.attrW}x${k.canvas?.attrH} css ${k.canvas?.cssW}x${k.canvas?.cssH}(기준 ${closed.canvas?.attrW}x${closed.canvas?.attrH} css ${closed.canvas?.cssW}x${closed.canvas?.cssH})`);
    const feet = k.feet?.sy;
    const headY = k.stack ? k.stack.bottom : null;
    const stageH = stageBottom - stageTop;
    if (big) {
      const ok = feet !== undefined && feet >= stageTop - KB_EPS && feet <= stageBottom + KB_EPS && k.stack !== null && k.stack.top >= stageTop - KB_EPS && k.stack.bottom <= stageBottom + KB_EPS && k.typing === true;
      rec(sc, `KB4-${ms}`, `포커스 ${ms}ms: 내 캐릭터 발과 이름표(입력 중 칸 포함)가 남은 스테이지 안(검사 3, 큰 폰)`, ok, `스테이지 ${r1(stageTop)}~${r1(stageBottom)}(높이 ${r1(stageH)}) · 발 ${r1(feet)} · 이름표 스택 ${r1(k.stack?.top)}~${r1(k.stack?.bottom)} · 입력 중 ${k.typing}`);
    } else {
      // 작은 폰: 스테이지가 128 미만이라 이름표·입력 중 칸이 잘릴 수 있다(알려진 한계, 가정 A2) — 몸(머리 ~ 발)이 스테이지와 겹치는지만 본다
      const ok = feet !== undefined && headY !== null && Math.max(headY, stageTop) <= Math.min(feet, stageBottom) + KB_EPS;
      rec(sc, `KB4-${ms}`, `포커스 ${ms}ms: 내 캐릭터 몸이 남은 스테이지와 겹침(검사 3, 작은 폰은 몸만)`, ok, `스테이지 ${r1(stageTop)}~${r1(stageBottom)}(높이 ${r1(stageH)}) · 몸 ${r1(headY)}~${r1(feet)}`);
    }
  }
  if (big && opened[1000]) {
    infoRow(ctx, sc, "KB-INFO", "큰 폰 남은 스테이지 높이(참고, UI-SPEC 128 이상)", `${r1(opened[1000].panel.top - opened[1000].headerBottom)}px`);
  }

  // iOS 가 화면을 위로 밀면(vv.offsetTop 120) 헤더가 그만큼 내려오고, 창 스크롤로 되돌리지 않는다(scrollY 0)
  await page.evaluate((k) => window.__mfVv.set(window.innerHeight - k - 120, 120), KB_LIFT);
  await page.waitForTimeout(300);
  const pushed = await readKeyboardState(page, mySeat);
  rec(sc, "KB5", "vv.offsetTop 120: 헤더가 120 내려와 있고 패널은 여전히 키보드 바로 위, 창 스크롤 0", !!pushed && near(pushed.headerTop, 120, 1) && near(pushed.panel.bottom, pushed.vv.height + pushed.vv.offsetTop, 1) && pushed.scrollY === 0, `헤더 위 ${r1(pushed?.headerTop)} · 패널 아래 ${r1(pushed?.panel.bottom)} · 보이는 영역 아래 ${r1(pushed ? pushed.vv.height + pushed.vv.offsetTop : NaN)} · scrollY ${pushed?.scrollY}`);
  await page.evaluate((k) => window.__mfVv.set(window.innerHeight - k, 0), KB_LIFT);
  await page.waitForTimeout(300);
  const back = await readKeyboardState(page, mySeat);
  rec(sc, "KB6", "vv.offsetTop 가 0 으로 돌아오면 헤더도 제자리(위 0)", !!back && near(back.headerTop, 0, 1), `헤더 위 ${r1(back?.headerTop)}`);

  // 줄을 보낸 뒤에도 포커스가 유지되고 패널 위치가 변하지 않는다(검사 6): 보내는 동안 프레임마다 패널 아래·열림 표식을 기록한다
  await input.fill("안녕");
  await page.waitForSelector('[data-chat-send][aria-disabled="false"]', { timeout: 3000 });
  await page.evaluate(() => {
    const w = { min: Infinity, max: -Infinity, closedSeen: false, stop: false };
    window.__kbWatch = w;
    const loop = () => {
      const panel = document.querySelector(".mf-lobby__panel");
      const root = document.querySelector("main.mf-lobby");
      if (panel) {
        const b = panel.getBoundingClientRect().bottom;
        w.min = Math.min(w.min, b);
        w.max = Math.max(w.max, b);
      }
      if (root && root.getAttribute("data-kb-open") !== "true") w.closedSeen = true;
      if (!w.stop) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  const beforeSend = await readKeyboardState(page, mySeat);
  await page.locator("[data-chat-send]").click({ timeout: 3000 });
  const sent = await attempt(async () => waitChatLine(page, "안녕", 3000));
  await page.waitForTimeout(600);
  const watch = await page.evaluate(() => {
    const w = window.__kbWatch;
    w.stop = true;
    return { min: w.min, max: w.max, closedSeen: w.closedSeen };
  });
  const afterSend = await readKeyboardState(page, mySeat);
  rec(sc, "KB7", "보낸 줄이 기록에 보임", sent.ok, sent.detail);
  rec(sc, "KB8", "보낸 뒤 입력칸 포커스 유지·열림 유지(검사 6)", !!afterSend && afterSend.focusOnInput === true && afterSend.kbOpen === "true" && (await input.inputValue()) === "", `포커스 ${afterSend?.focusOnInput} · 열림 ${afterSend?.kbOpen} · 입력칸 "${await input.inputValue()}"`);
  rec(sc, "KB9", "보내는 동안 패널 위치가 변하지 않고 열림이 한 번도 풀리지 않음(검사 6)", !!beforeSend && !!afterSend && watch.max - watch.min <= KB_EPS && watch.closedSeen === false && near(beforeSend.panel.bottom, afterSend.panel.bottom), `패널 아래 변동 ${r1(watch.max - watch.min)}px · 열림 풀림 ${watch.closedSeen} · 보내기 전 ${r1(beforeSend?.panel.bottom)} → 후 ${r1(afterSend?.panel.bottom)}`);

  // D4: 입력칸 포커스 중 맵의 걸을 수 있는 곳을 누르면 걷지 않고 키보드만 닫힌다
  await input.focus();
  const moveN = () => tracker.moves.get(mySeat)?.n ?? 0;
  const me = await sampleWorld(page, mySeat);
  const target = me ? await farWalkableOnSurface(page, ctx.size, me) : null;
  if (!target) {
    rec(sc, "KB10", "D4: 포커스 중 맵 탭 = 걷지 않음·blur", false, "탭할 칸을 찾지 못함(맵 입력 면 위에 보이는 먼 칸 없음)");
  } else {
    const nBefore = moveN();
    await page.touchscreen.tap(target.sx, target.sy);
    await page.waitForTimeout(1200);
    const afterTap = await readKeyboardState(page, mySeat);
    const meAfter = await sampleWorld(page, mySeat);
    const still = !!me && !!meAfter && Math.hypot(me.x - meAfter.x, me.z - meAfter.z) < 0.01;
    rec(sc, "KB10", "D4: 포커스 중 맵 탭 → 걷기 요청 없음(위치·구간·링 그대로)", still && moveN() === nBefore && afterTap?.ring === null, `위치 변화 ${me && meAfter ? r1(Math.hypot(me.x - meAfter.x, me.z - meAfter.z)) : "?"} · 새 구간 ${moveN() - nBefore} · 링 ${afterTap?.ring}`);
    rec(sc, "KB11", "D4: 입력칸이 blur 되고 열림 표식이 사라짐", !!afterTap && afterTap.focusOnInput === false && afterTap.kbOpen === null, `포커스 ${afterTap?.focusOnInput} · 열림 ${afterTap?.kbOpen}`);
  }

  // 키보드가 닫힌 뒤(가짜 값을 되돌림): 원래 배치로 돌아오고 카메라가 다시 맞는다, 캔버스는 처음부터 끝까지 한 번도 크기를 바꾸지 않았다. 탭은 평소처럼 걷는다.
  await page.evaluate(() => window.__mfVv.set(window.innerHeight, 0));
  await page.waitForTimeout(500);
  const restored = await readKeyboardState(page, mySeat);
  if (restored) {
    const stageTop = restored.headerBottom;
    const stageBottom = restored.panel.top;
    rec(sc, "KB12", "닫힌 뒤: 행동 줄 복귀·패널 원래 높이·카메라가 닫힌 스테이지에 다시 맞음", restored.actionButtons >= 1 && near(restored.panel.height, closed.panel.height, 1) && restored.feet.sy >= stageTop - KB_EPS && restored.feet.sy <= stageBottom + KB_EPS, `행동 줄 버튼 ${restored.actionButtons} · 패널 ${r1(restored.panel.height)}(기준 ${r1(closed.panel.height)}) · 발 ${r1(restored.feet.sy)} · 스테이지 ${r1(stageTop)}~${r1(stageBottom)}`);
    rec(sc, "KB13", "처음부터 끝까지 캔버스 크기 불변·ResizeObserver 호출 0", restored.roCalls === 0 && restored.host.w === closed.host.w && restored.host.h === closed.host.h && restored.canvas?.attrW === closed.canvas?.attrW && restored.canvas?.attrH === closed.canvas?.attrH, `호출 ${restored.roCalls} · 호스트 ${restored.host.w}x${restored.host.h}(기준 ${closed.host.w}x${closed.host.h}) · canvas ${restored.canvas?.attrW}x${restored.canvas?.attrH}(기준 ${closed.canvas?.attrW}x${closed.canvas?.attrH})`);
  } else {
    rec(sc, "KB12", "닫힌 뒤 상태를 읽음", false, "로비를 읽지 못함");
  }
  const walkTarget = restored && me ? await farWalkableOnSurface(page, ctx.size, me) : null;
  if (!walkTarget) {
    rec(sc, "KB14", "닫힌 뒤의 탭부터 평소처럼 걷는다", false, "탭할 칸을 찾지 못함");
  } else {
    const tap = await tapWorld(page, tracker, mySeat, walkTarget.x, walkTarget.z);
    rec(sc, "KB14", "닫힌 뒤의 탭부터 평소처럼 걷는다(링·구간이 생김)", tap.move !== null && tap.ringMs !== null, `구간 ${tap.move ? "받음" : "없음"} · 링 ${tap.ringMs === null ? "없음" : `${Math.round(tap.ringMs)}ms`}`);
  }
  await checkState(ctx, "chat-keyboard", "lobby");
  await leaveLobby(page);
}

// ---- reconnect·deployhold (06-18, CONN-04·MAP-05) ----

/** reconnect·deployhold 흐름의 고정 크기(UI-SPEC 의 기본 폰). */
const RECONNECT_SIZE = { w: 390, h: 664, label: "390x664" };
/** perfbudget 흐름의 고정 크기: 승인 보드 폭(390×844). */
const PERF_SIZE = { w: 390, h: 844, label: "390x844" };
/** 복구 대기 상한(ms). 이 안에 끝나지 않으면 그 회는 복구 못 함(recovered false)으로 센다 — 상한을 늘려 초록을 만들지 않는다. */
const RECOVER_LIMIT_MS = 15_000;
/** deployhold: 로컬 흉내에서 띠가 뜨기를 기다리는 시간(ms). */
const DEPLOY_LOCAL_WAIT_MS = 40_000;
/**
 * deployhold: 배포 주소의 관찰 창(ms). 배포는 소켓을 끊지 않으므로(Durable Object 하이버네이션) 띠를 6분 기다리지 않는다.
 * 0 이 아닌 이유: 관찰이 도는 동안 사용자가 배포 한 번을 넣을 수 있어야 한다.
 */
const DEPLOY_REAL_OBSERVE_MS = 120_000;

const dist = (p, q) => (p && q ? Math.hypot(p.x - q.x, p.z - q.z) : Number.NaN);

/** 방장 + 손님이 같은 방 로비에서 서로를 보고, 손님이 한 번 걸어 간 뒤의 상태. 위치 기준선(baseline)을 남긴다. */
async function openPair(ctx, flowId) {
  const host = await startHost(ctx, flowId, { nickname: LOBBY_HOST_NICK, initScripts: [reconnectInit] });
  const { guest, seat: gSeat } = await openGuest(ctx, WORLD_GUEST_NICK, { initScripts: [reconnectInit] });
  const hSeat = host.tracker.last().me.seat;
  const hp = host.page;
  const gp = guest.page;
  await Promise.all([host.tracker.waitFor((v) => v.players.length === 2, 5000, "방장 쪽 인원 2"), guest.tracker.waitFor((v) => v.players.length === 2, 5000, "손님 쪽 인원 2")]);
  await Promise.all([waitWorldReady(hp, 2), waitWorldReady(gp, 2)]);
  await Promise.all([settle(hp), settle(gp)]);

  // 손님이 한 번 걷는다: 두 화면에 모두 보이는 가장 먼 칸(worldFlow 와 같은 고르기)
  const [hw, gw] = await Promise.all([readWorld(hp), readWorld(gp)]);
  const from = await sampleWorld(gp, gSeat);
  if (!from) throw new SetupError("손님 위치를 읽지 못함(sample)");
  const centers = walkableCentersOfApp();
  const pad = 28;
  const [gScreens, hScreens] = await Promise.all([screensOfWorld(gp, centers), screensOfWorld(hp, centers)]);
  const inStage = (sc, st) => !!sc && !!st && Number.isFinite(sc.sx) && sc.sx > pad && sc.sx < ctx.size.w - pad && sc.sy > st.top + pad && sc.sy < st.bottom - pad;
  const onScreen = centers.map((c, i) => ({ ...c, sx: gScreens[i]?.sx, sy: gScreens[i]?.sy, hx: hScreens[i]?.sx, hy: hScreens[i]?.sy })).filter((c, i) => inStage(gScreens[i], gw.stage) && inStage(hScreens[i], hw.stage));
  const probe = pickTapTargets(onScreen, from, { minDist: 3 }).slice(0, 40);
  const [gHits, hHits] = await Promise.all([hitsInputSurface(gp, probe), hitsInputSurface(hp, probe.map((c) => ({ sx: c.hx, sy: c.hy })))]);
  const target = probe.find((_, i) => gHits[i] && hHits[i]);
  if (!target) throw new SetupError("탭할 목적지를 찾지 못함");
  const tap = await tapWorld(gp, guest.tracker, gSeat, target.x, target.z);
  if (!tap.move) throw new SetupError("손님 구간이 오지 않음");
  await sleep(segmentDurationMs(tap.move) + 1500);

  const seats = [hSeat, gSeat];
  const baseline = {};
  for (const seat of seats) {
    const [a, b] = await Promise.all([sampleWorld(hp, seat), sampleWorld(gp, seat)]);
    if (!a || !b || dist(a, b) > WORLD_SYNC_TOL) throw new SetupError(`시작 위치가 두 페이지에서 다름(자리 ${seat}: ${dist(a, b)})`);
    baseline[seat] = a;
  }
  return {
    host,
    guest,
    hp,
    gp,
    gctx: guest.context,
    hc: consoleCollector(hp),
    gc: consoleCollector(gp),
    seats,
    baseline,
    local: isLocalOrigin(ctx.origin),
    close: async () => {
      await guest.context.close().catch(() => {});
    },
  };
}

const linkCalm = (st) => !!st && st.hook && st.banners === 0 && st.cards === 0 && st.status === "ready" && !st.toastOn;
/** 복구 조건: 맵이 열려 있고(카드 없음) 마지막 소켓이 열려 있고 띠는 없거나 "다시 연결됐어요" 이다. */
const linkRecovered = (st) => !!st && st.hook && st.cards === 0 && st.status === "ready" && st.lastSocketOpen && (st.banners === 0 || st.banner === "다시 연결됐어요");

/** 조건이 참이 될 때까지 두 페이지를 읽는다. 시간 안에 못 맞추면 false. */
async function waitLink(pages, pred, ms) {
  const start = performance.now();
  for (;;) {
    const states = await Promise.all(pages.map((p) => readLinkState(p)));
    if (states.every(pred)) return true;
    if (performance.now() - start > ms) return false;
    await sleep(100);
  }
}

/** 라운드 시작 전: 두 페이지가 평온(띠·카드 없음, 맵 열림, 토스트 없음)해지길 기다리고, 토스트 기록과 콘솔 수집을 비운다. */
async function calmPair(pair) {
  await waitLink([pair.hp, pair.gp], linkCalm, 10_000);
  await Promise.all([clearToasts(pair.hp).catch(() => {}), clearToasts(pair.gp).catch(() => {})]);
  pair.hc.take();
  pair.gc.take();
}

/**
 * 복구 뒤 라운드 결과를 모은다(reconnectChecks 의 입력 모양): 복구 + RESTORED_GONE_MS 뒤 띠 잔류, 두 페이지 위치 차·복구 전 대비 어긋남,
 * 다시 뜬 입장·퇴장 알림, 허용되지 않은 콘솔 경고·오류, (요청 시) 첫 프레임이 다시 그려졌는지.
 */
async function collectRound(ctx, pair, { n, kind, recovered, bannerSeen, paint = false }) {
  await sleep(RESTORED_GONE_MS);
  const [hs, gs] = await Promise.all([readLinkState(pair.hp), readLinkState(pair.gp)]);
  const bannerLeft = !hs || !gs ? null : hs.banners > 0 || gs.banners > 0;
  let posDiff = 0;
  let drift = 0;
  for (const seat of pair.seats) {
    const [a, b] = await Promise.all([sampleWorld(pair.hp, seat).catch(() => null), sampleWorld(pair.gp, seat).catch(() => null)]);
    const d = dist(a, b);
    posDiff = Number.isNaN(d) || Number.isNaN(posDiff) ? Number.NaN : Math.max(posDiff, d);
    for (const p of [a, b]) {
      const e = dist(p, pair.baseline[seat]);
      drift = Number.isNaN(e) || Number.isNaN(drift) ? Number.NaN : Math.max(drift, e);
    }
  }
  const replayed = [...(hs?.toasts ?? []), ...(gs?.toasts ?? [])].filter((t) => /입장|퇴장/.test(t));
  const c = consoleIssues([...pair.hc.take(), ...pair.gc.take()], { kind, local: pair.local });
  let painted = null;
  if (paint) painted = paintedFromStats(await readPaintStats(pair.gp).catch(() => null));
  return { n, console: c.issues, allowed: c.allowed, bannerLeft, bannerSeen, posDiff, drift, replayed, recovered, painted };
}

/** 종류별 동작 한 번. 오프라인은 setOffline(true) 와 소켓 닫기를 함께 한다(헤드리스 Chrome 은 오프라인 전환만으로 열린 소켓을 끊지 않는다). */
async function reconnectAction(pair, kind) {
  const { gp, gctx } = pair;
  switch (kind) {
    case "offline":
      await gctx.setOffline(true);
      await dropSockets(gp);
      await sleep(3000);
      await gctx.setOffline(false);
      return;
    case "frozen":
      await setLifecycle(gp, "frozen");
      await sleep(5000);
      await setLifecycle(gp, "active");
      return;
    case "reload":
      await gp.reload({ waitUntil: "domcontentloaded" });
      return;
    case "lose":
      await gp.evaluate(() => window.__mfWorld.debug.loseContext());
      await sleep(1000);
      await gp.evaluate(() => window.__mfWorld.debug.restoreContext());
      return;
    case "lose-idle":
      await gp.evaluate(() => window.__mfWorld.debug.loseContext());
      return;
  }
}

async function reconnectFlow(ctx) {
  const rec = recorder(ctx);
  const pair = await openPair(ctx, "reconnect");
  try {
    for (const k of RECONNECT_KINDS) {
      const sc = `reconnect/${k.id}`;
      const rounds = [];
      for (let n = 1; n <= RECONNECT_ROUNDS; n++) {
        await calmPair(pair);
        const watch = { stop: false, seen: false };
        const poll = (async () => {
          while (!watch.stop) {
            const st = await readLinkState(pair.gp);
            if (st && st.banners > 0) watch.seen = true;
            await sleep(100);
          }
        })();
        let round;
        try {
          await reconnectAction(pair, k.id);
          let recovered = await waitLink([pair.hp, pair.gp], linkRecovered, RECOVER_LIMIT_MS);
          if (recovered && k.id === "reload") recovered = await attempt(() => waitWorldReady(pair.gp, 2, RECOVER_LIMIT_MS)).then((r) => r.ok);
          watch.stop = true;
          await poll;
          round = await collectRound(ctx, pair, { n, kind: k.id, recovered, bannerSeen: watch.seen, paint: k.requirePainted });
        } catch (e) {
          watch.stop = true;
          await poll.catch(() => {});
          await pair.gctx.setOffline(false).catch(() => {});
          const msg = String(e instanceof Error ? e.message : e).split("\n")[0].slice(0, 120);
          round = { n, console: [`(실행 오류) ${msg}`], allowed: {}, bannerLeft: null, bannerSeen: watch.seen, posDiff: Number.NaN, drift: Number.NaN, replayed: [], recovered: false, painted: null };
        }
        rounds.push(round);
      }
      for (const r of reconnectChecks(rounds, { expectedRounds: RECONNECT_ROUNDS, requireBannerSeen: k.requireBannerSeen, requirePainted: k.requirePainted })) recOne(rec, sc, r);
      const allowed = {};
      for (const r of rounds) for (const [id, c] of Object.entries(r.allowed ?? {})) allowed[id] = (allowed[id] ?? 0) + c;
      infoRow(ctx, sc, "RC9", `${k.label} 요약(참고, 판정 아님)`, reconnectSummary(rounds, allowed));
    }
  } finally {
    pair.hc.stop();
    pair.gc.stop();
    await pair.close();
  }
  await leaveLobby(pair.hp);
}

/** 두 페이지에서 .mf-reconnect 가 나타났다가 사라질 때까지 기다린다. 돌려주는 값: { hostSeen, guestSeen, gone } */
async function waitBannerCycle(pair, ms) {
  const seen = { hostSeen: false, guestSeen: false, gone: false };
  const start = performance.now();
  for (;;) {
    const [hs, gs] = await Promise.all([readLinkState(pair.hp), readLinkState(pair.gp)]);
    if (hs && hs.banners > 0) seen.hostSeen = true;
    if (gs && gs.banners > 0) seen.guestSeen = true;
    if (seen.hostSeen && seen.guestSeen && hs && gs && hs.banners === 0 && gs.banners === 0) {
      seen.gone = true;
      return seen;
    }
    if (performance.now() - start > ms) return seen;
    await sleep(100);
  }
}

/** worker/room.ts 의 파일 시각만 지금으로 갱신한다(내용·git diff 는 그대로) — 로컬 개발 서버가 workerd 를 다시 띄우게 하려고(가정 A1, T-06-41). */
function touchWorkerFile() {
  const file = new URL("../../worker/room.ts", import.meta.url);
  const now = new Date();
  utimesSync(file, now, now);
}

/** 대상 주소의 /api/health version(배포 표식). 읽지 못하거나 모양이 다르면 빈 글자. */
async function healthVersion(origin) {
  try {
    const res = await fetch(`${origin}/api/health`, { cache: "no-store" });
    const body = await res.json();
    return typeof body?.version === "string" ? body.version : "";
  } catch {
    return "";
  }
}

/** 두 페이지의 앱 방 소켓 수가 앞뒤로 그대로이고 마지막 소켓이 열려 있나. 못 읽으면 null. */
function socketsKeptOf(beforeStates, afterStates) {
  if (![...beforeStates, ...afterStates].every((st) => st && Number.isFinite(st.roomSockets))) return null;
  return beforeStates.every((b, i) => b.roomSockets === afterStates[i].roomSockets && afterStates[i].lastSocketOpen === true);
}

/**
 * 배포 직후 재접속(deployhold, CONN-04·MAP-05).
 * 로컬(localhost): 로비의 두 페이지가 기다리다 재접속 띠가 떴다 사라지면 위치·콘솔을 본다. worker/room.ts 의 파일 시각을 갱신해 배포를 10회 흉내 낸다 —
 *   40초 안에 소켓이 끊기지 않으면 첫 회에 "미확인"(DH0)으로 남긴다(가정 A1).
 * 배포 주소: 파일을 건드리지 않고 1회, 관찰 창(DEPLOY_REAL_OBSERVE_MS) 동안 기다린다. 배포는 소켓을 끊지 않으므로 띠를 기다리지 않는다.
 *   관찰 창 앞뒤 /api/health version 이 바뀌었을 때(배포 신호)만 deployHoldChecks 가 '띠 없음·소켓 유지·위치 차·콘솔 0' 을 판정하고, 아니면 DH0 미확인 참고 행이다.
 */
async function deployHoldFlow(ctx) {
  const rec = recorder(ctx);
  const sc = "deployhold/lobby";
  const pair = await openPair(ctx, "deployhold");
  const rounds = [];
  let unconfirmed = false;
  try {
    const total = pair.local ? RECONNECT_ROUNDS : 1;
    for (let n = 1; n <= total; n++) {
      await calmPair(pair);
      if (pair.local) {
        touchWorkerFile();
        const seen = await waitBannerCycle(pair, DEPLOY_LOCAL_WAIT_MS);
        if (n === 1 && !seen.hostSeen && !seen.guestSeen) {
          unconfirmed = true;
          break;
        }
        const recovered = seen.gone && (await waitLink([pair.hp, pair.gp], linkRecovered, RECOVER_LIMIT_MS));
        rounds.push(await collectRound(ctx, pair, { n, kind: "deploy", recovered, bannerSeen: seen.hostSeen && seen.guestSeen }));
        continue;
      }
      const before = await Promise.all([readLinkState(pair.hp), readLinkState(pair.gp)]);
      const versionBefore = await healthVersion(ctx.origin);
      const seen = await waitBannerCycle(pair, DEPLOY_REAL_OBSERVE_MS);
      const versionAfter = await healthVersion(ctx.origin);
      const recovered = await waitLink([pair.hp, pair.gp], linkRecovered, RECOVER_LIMIT_MS);
      const after = await Promise.all([readLinkState(pair.hp), readLinkState(pair.gp)]);
      const round = await collectRound(ctx, pair, { n, kind: "deploy", recovered, bannerSeen: seen.hostSeen || seen.guestSeen });
      rounds.push({ ...round, socketsKept: socketsKeptOf(before, after), deployObserved: deployObservedOf(versionBefore, versionAfter) });
    }
    if (unconfirmed) {
      infoRow(ctx, sc, "DH0", "배포 직후 흉내: 미확인(참고, 판정 아님)", `worker/room.ts 의 파일 시각을 갱신해도 ${DEPLOY_LOCAL_WAIT_MS / 1000}초 안에 소켓이 끊겨 띠가 뜨지 않음 — 06-08 의 퇴거 복원 테스트와 06-19 의 실제 배포 1회로 갈음(가정 A1)`);
    } else {
      for (const r of deployHoldChecks(rounds, { local: pair.local })) recOne(rec, sc, r);
      const allowed = {};
      for (const r of rounds) for (const [id, c] of Object.entries(r.allowed ?? {})) allowed[id] = (allowed[id] ?? 0) + c;
      infoRow(ctx, sc, "RC9", `배포 직후${pair.local ? "(로컬 흉내)" : ""} 요약(참고, 판정 아님)`, reconnectSummary(rounds, allowed));
    }
  } finally {
    pair.hc.stop();
    pair.gc.stop();
    await pair.close();
  }
  await leaveLobby(pair.hp);
}

// ---- perfbudget (06-18, 성공 기준 4 의 자동 몫) ----

const readInfo = (page) => page.evaluate(() => window.__mfWorld?.debug?.info?.() ?? null);
const infoLine = (i) => (i ? `calls ${i.calls} · triangles ${i.triangles} · geometries ${i.geometries} · textures ${i.textures} · programs ${i.programs} · pointLights ${i.pointLights}` : "측정값 없음");

async function perfBudgetFlow(ctx) {
  const rec = recorder(ctx);
  const sc = "perfbudget/talk";
  const host = await startHost(ctx, "perfbudget", { nickname: LOBBY_HOST_NICK });
  const { page, tracker } = host;
  const cc = consoleCollector(page);
  try {
    // 1) 8명 로비(talk): 방장 + 봇 7
    await waitWorldReady(page, 1);
    await openTestSheet(page);
    await setBots(page, tracker, 7);
    await closeSheet(page);
    await tracker.waitFor((v) => v.players.length === 8, 3000, "인원 8");
    await waitWorldReady(page, 8);
    await sleep(2000);
    const talk = await readInfo(page);
    for (const r of budgetChecks(talk, { maxCalls: 120, maxPointLights: 3, scene: "로비 8명" })) recOne(rec, sc, r);
    infoRow(ctx, sc, "B0", "8명 로비 info() 기록(참고, 판정 아님)", infoLine(talk));

    // 2) 성능 스파이크 vote 장면: 가장 무거운 조명. 가장 큰 프레임(callsMax)으로 본다
    const perf = await openPerfPage(ctx.browser, { origin: ctx.origin, size: ctx.size, query: "perf=1&scene=vote&minutes=0.1&e2e=1" });
    try {
      const done = await attempt(async () => {
        await perf.page.waitForFunction(() => window.__mfPerf?.result != null, null, { timeout: 45_000 });
      });
      if (!done.ok) rec("perfbudget/vote", "B1", "draw call ≤ 120(vote)", false, `결과가 45초 안에 나오지 않음: ${done.detail}`);
      else {
        const res = await perf.page.evaluate(() => window.__mfPerf.result.renderer);
        for (const r of budgetChecks(res ? { calls: res.callsMax, pointLights: res.pointLights } : null, { maxCalls: 120, maxPointLights: 3, scene: "vote 스파이크" })) recOne(rec, "perfbudget/vote", r);
        infoRow(ctx, "perfbudget/vote", "B0", "vote 스파이크 결과 기록(참고, 판정 아님)", res ? `${infoLine(res)} · callsMax ${res.callsMax}` : "측정값 없음");
      }
    } finally {
      perf.console.stop();
      await perf.context.close().catch(() => {});
    }

    // 3) 로비 → [시작] → 대기실 복귀를 5번: 다시 열린 맵의 geometries·textures 가 처음 값 이하, WebGL 컨텍스트 경고 없음.
    // 봇은 서버 배회로 걸어 다녀 어느 캐릭터가 화면에 들어와 있는지에 따라 geometries 가 열 때마다 달라진다(같은 세션에서 29~52로 잼) — 늘었는지 아닌지를 가를 수 없다.
    // 그래서 이 구간은 봇을 모두 내리고 가만히 서 있는 사람 손님 3명(방장 포함 4명, 시작 최소 인원)으로 돈다. 그러면 열 때마다 같은 장면이다.
    await openTestSheet(page);
    await setBots(page, tracker, 0);
    await closeSheet(page);
    const guests = [];
    try {
      for (let i = 1; i <= 3; i++) guests.push((await openGuest(ctx, `손님${i}`)).guest);
      await tracker.waitFor((v) => v.players.length === 4, 5000, "인원 4");
      await Promise.all([waitWorldReady(page, 4), ...guests.map((g) => waitWorldReady(g.page, 4))]);
      await sleep(2000);
      cc.take();
      const snapshots = [await readInfo(page)];
      const reopen = await attempt(async () => {
        for (let i = 1; i <= REOPEN_ROUNDS; i++) {
          await startGame(page, tracker);
          await sleep(400);
          await backToLobby(page, tracker);
          await waitWorldReady(page, 4);
          await sleep(1500);
          snapshots.push(await readInfo(page));
        }
      });
      if (!reopen.ok) rec("perfbudget/reopen", "M1", "맵 열고 닫기 5번", false, `${reopen.detail} (표본 ${snapshots.length}개)`);
      else {
        recOne(rec, "perfbudget/reopen", memoryStableChecks(snapshots));
        recOne(rec, "perfbudget/reopen", contextLeakChecks(cc.take()));
      }
      infoRow(ctx, "perfbudget/reopen", "M0", "열고 닫기 표(처음, 1~5번째: geometries/textures)", snapshots.map((s) => (s ? `${s.geometries}/${s.textures}` : "없음")).join(" · "));
    } finally {
      for (const g of guests) await g.context.close().catch(() => {});
    }
  } finally {
    cc.stop();
  }
  await leaveLobby(page);

  // 4) 월드 청크 요청 실패: 카드 + [다시 시도], 흰·검은 화면 없음, 막기를 풀고 다시 시도하면 열림
  const room = await createTestRoom(ctx.origin, LOBBY_HOST_NICK);
  ctx.secrets.push(room.token);
  let blocked = true;
  const failed = await openHostPage(ctx.browser, {
    origin: ctx.origin,
    code: room.code,
    token: room.token,
    size: ctx.size,
    dpr: 1,
    preRoute: async (context) => {
      await context.route("**/*", (route) => (blocked && isWorldChunkUrl(route.request().url()) ? route.abort() : route.fallback()));
    },
  });
  try {
    const fp = failed.page;
    const card = await attempt(async () => {
      await fp.waitForSelector(".mf-mapcard h2", { timeout: 15_000 });
    });
    if (!card.ok) rec("perfbudget/chunk", "E1", "청크 요청 실패 카드", false, `카드가 15초 안에 뜨지 않음: ${card.detail}`);
    else {
      await sleep(300);
      const view = await fp.evaluate(() => ({
        title: document.querySelector(".mf-mapcard h2")?.textContent?.trim() ?? null,
        retryVisible: [...document.querySelectorAll(".mf-mapcard button")].some((b) => (b.textContent ?? "").trim() === "다시 시도" && b.getBoundingClientRect().width > 0),
        canvases: document.querySelectorAll(".mf-world__canvas canvas").length,
      }));
      recOne(rec, "perfbudget/chunk", chunkFailChecks(view));
      blocked = false;
      const retry = await attempt(async () => {
        await fp.getByRole("button", { name: "다시 시도" }).click({ timeout: 3000 });
        await waitWorldReady(fp, 1, 20_000);
      });
      rec("perfbudget/chunk", "E1b", "막기를 풀고 [다시 시도] 하면 맵이 열림", retry.ok, retry.detail);
    }
    await leaveLobby(fp);
  } finally {
    await failed.context.close().catch(() => {});
  }
}

const w360 = (ctx) => ctx.size.w <= 360;

const recOne = (rec, scenario, r) => rec(scenario, r.id, r.label, r.ok, r.detail, r.relaxed === true || r.info === true);

// ---- 맵 게임 흐름 (08-24, DAY-03~07·MAP-04·GHOST-01·02): 낮 토론 → 지목 → 변론 → 찬반 → 처형 → 밤, 유령, 처형 없음, 밤 임시 틀, 결과, 게임 중 채팅 ----
// 단계는 테스트 방 [테스트] 의 다음 단계(skipTo)와 봇 투표 규칙(봇 찬반·봇 지목)으로 넘겨 시간을 줄인다. 사람 페이지 눌림은 토론 끝내기·지목·찬반에서 직접 확인한다.

/** 사람 손님 닉네임 4자(결정 0052-3: 테스트 봇 이름은 8자 고정이라 4자 이름 판은 사람 손님으로 만든다) */
const GAME_GUESTS = ["가나다라", "마바사아", "자차카타"];
/** day 흐름의 방장 닉네임 4자 */
const GAME_HOST_NICK = "방장님이";
/** 결과 알림 문구 모양 */
const TALLY_RE = /^찬성 \d+ · 반대 \d+$/;
const ROLE_WORD_RE = /마피아|경찰|의사|시민/;
/** 고정 크기 게임 흐름의 크기: 승인 보드 폭(390×844) */
const GAME_SIZE = { w: 390, h: 844, label: "390x844" };

const recMany = (rec, scenario, lines, suffix = "") => {
  for (const l of lines) rec(scenario, l.id, `${l.label}${suffix}`, l.ok, l.detail);
};
const aliveOf = (view) => view.players.filter((p) => p.alive !== false).map((p) => p.seat);
const majorityOf = (n) => Math.floor(n / 2) + 1;

/** 게임 화면이 pred 를 만족할 때까지 읽는다. 시간 안에 안 오면 SetupError(새 방으로 다시 돈다). */
async function untilGame(page, pred, ms = 6000, label = "게임 화면") {
  const start = performance.now();
  for (;;) {
    const g = await readGame(page).catch(() => null);
    if (g && pred(g)) return g;
    if (performance.now() - start > ms) throw new SetupError(`${label} (${ms / 1000}초 안에 도달하지 못함)`);
    await sleep(100);
  }
}

/** 방장 + 손님(사람 페이지) + 봇 → 시작 → to 단계까지. 돌려주는 값: { host, hp, ht, hostSeat, guests: [{ context, page, tracker, takeIssues, seat }] } */
async function openGame(ctx, flowId, { guests = 0, bots = 3, role = "citizen", vote = { exec: "yes", pick: "host" }, to = "discussion", hostNick = undefined } = {}) {
  const host = await startHost(ctx, flowId, hostNick ? { nickname: hostNick } : {});
  const { page: hp, tracker: ht } = host;
  const pages = [];
  for (let i = 0; i < guests; i++) {
    const { guest, seat } = await openGuest(ctx, GAME_GUESTS[i]);
    pages.push({ ...guest, seat });
  }
  await ht.waitFor((v) => v.players.length === guests + 1, 6000, `방장 쪽 인원 ${guests + 1}`);
  await openTestSheet(hp);
  if (bots > 0) await setBots(hp, ht, bots);
  if (bots > 0) await setBotVote(hp, ht, vote);
  await chooseRole(hp, ht, role);
  await startGame(hp, ht);
  if (to) await skipTo(hp, ht, to);
  return { host, hp, ht, hostSeat: ht.last().me.seat, guests: pages };
}

async function closeGame(game) {
  for (const g of game.guests) await g.context.close().catch(() => {});
  await game.host.context.close().catch(() => {});
}

/** 모든 페이지가 같은 단계에 닿을 때까지 기다린다(손님·방장 화면이 그 단계 틀을 그린 뒤). */
async function allAt(pages, phase, ms = 8000) {
  return Promise.all(pages.map((p) => untilGame(p, (g) => g.phase === phase, ms, `${phase} 도착`)));
}

/** 아래 패널 높이를 UI-SPEC 표(gamePanelHeight)와 견준다(오차 1px). */
function panelRow(rec, sc, id, g, h, kind, who) {
  const want = gamePanelHeight(h, kind);
  const got = g?.panel?.height;
  const ok = typeof got === "number" && Math.abs(got - want) <= 1;
  rec(sc, id, `아래 패널 높이 LOG_H + ${GAME_PANEL_EXTRA[kind]} (${who})`, ok, `실제 ${typeof got === "number" ? Math.round(got * 10) / 10 : got} ≠ 기대 ${want}`);
}

/** 게임 화면의 G(공통)·H(헤더 대비) 묶음을 한 페이지에 적용한다. */
async function gameGH(ctx, flowId, state, handle, { expectTimer = false } = {}) {
  const rec = recorder(ctx);
  const { page } = handle;
  const snap = await collectSnapshot(page);
  snap.issues = handle.takeIssues();
  if (ctx.shots) {
    mkdirSync(OUT_DIR, { recursive: true });
    await shot(page, join(OUT_DIR, `${flowId}-${state}-${ctx.size.label}.png`));
  }
  // E8 #29(UI-SPEC UI Considerations, 계획 가정 A2): 8자 이름 이름표(.mf-world__tag 안)가 화면 가장자리에서 잘리는 것은 알려진 한계 — 판정에서 빼고 '알려진 한계' 줄로 남긴다.
  // 이름표 밖 요소의 화면 밖은 그대로 G2 실패다.
  const w = ctx.size.w;
  const tagOut = snap.elements.filter((e) => e.inTag && (e.rect.left < -0.5 || (e.rect.right ?? e.rect.left + e.rect.width) > w + 0.5));
  const judged = { ...snap, elements: snap.elements.filter((e) => !tagOut.includes(e)) };
  const bad = genericIssues(judged, ctx.size).filter((x) => !x.ok);
  rec(`${flowId}/${state}`, "G", "G 공통 검사", bad.length === 0, bad.map((x) => `${x.id} ${x.detail}`).join(" / "));
  if (tagOut.length > 0) {
    const xs = tagOut.map((e) => `${Math.round(e.rect.left)}~${Math.round(e.rect.right ?? e.rect.left + e.rect.width)}`);
    infoRow(ctx, `${flowId}/${state}`, "G2k", "알려진 한계(E8 #29): 8자 이름 이름표가 화면 가장자리에서 잘림(판정 아님)", `이름표 안 요소 ${tagOut.length}개 화면 가로(${w}) 밖: ${[...new Set(xs)].slice(0, 4).join(", ")}`);
  }
  const h1 = await attempt(async () => {
    const r = headerContrastChecks(await readHeaderContrast(page), { expectTimer });
    return r.ok ? true : { ok: false, detail: r.detail };
  });
  rec(`${flowId}/${state}`, "H1", "헤더 제목·타이머 글씨 대비 4.5:1", h1.ok, h1.detail);
}

/** 맵 위에서 탭할 만한 걸을 수 있는 칸(두 단계 이상 먼 곳, 입력 면 위). 없으면 null. */
async function findTapTarget(page, stage, seat, size) {
  const centers = walkableCentersOfApp();
  const screens = await screensOfWorld(page, centers);
  const pad = 28;
  const inStage = (s) => !!s && Number.isFinite(s.sx) && s.sx > pad && s.sx < size.w - pad && s.sy > stage.top + pad && s.sy < stage.bottom - pad;
  const from = (await sampleWorld(page, seat)) ?? { x: 0, z: 0 };
  const onScreen = centers.map((c, i) => ({ ...c, sx: screens[i]?.sx, sy: screens[i]?.sy })).filter((_, i) => inStage(screens[i]));
  const { ranked } = worldTapRanking(onScreen, from);
  const probe = ranked.slice(0, 40);
  const hits = await hitsInputSurface(page, probe);
  return probe.find((_, i) => hits[i]) ?? null;
}

/** 주어진 알림 기록에서 글자가 맞는 첫 항목의 순번(없으면 -1) */
const annIndex = (log, test) => log.findIndex((a) => typeof a.text === "string" && test(a.text));

/** 처형 구간 알림을 기다린다: 기록(peek)에 want 개가 쌓이거나 ms 가 지날 때까지. */
async function waitAnnounces(page, want, ms = 7000) {
  const start = performance.now();
  for (;;) {
    const log = await readAnnounceWatch(page, { stop: false });
    if (log.filter((a) => a.text !== null).length >= want || performance.now() - start > ms) return log;
    await sleep(100);
  }
}

// ---- day: 낮 토론 → 지목 → 변론 → 찬반 → 처형 → 밤 (사람 넷, 모두 4자 이름: 4자 이름 판의 지목 버튼 무가림) ----

async function dayFlow(ctx) {
  const id = "day";
  const rec = recorder(ctx);
  const h = ctx.size.h;
  const game = await openGame(ctx, id, { guests: 3, bots: 0, role: "citizen", to: "discussion", hostNick: GAME_HOST_NICK });
  try {
    const { host, hp, ht, hostSeat, guests } = game;
    const humans = [{ page: hp, tracker: ht, handle: host, who: "방장" }, ...guests.map((x, i) => ({ page: x.page, tracker: x.tracker, handle: x, who: `손님${i + 1}` }))];
    const pages = humans.map((x) => x.page);
    const N = humans.length; // 산 사람 4명: 과반 3, 지목 버튼 3, 찬반 숫자 3
    await allAt(pages, "discussion");
    await Promise.all(pages.map((p) => settle(p)));

    // 낮 토론: 패널 LOG_H + 154, [토론 끝내기] 숫자 최대 = 과반, 지목 버튼 없음. 맵 탭은 걷기(move)를 보낸다(대조)
    {
      const sc = `${id}/discussion`;
      for (const x of humans) {
        const g = await readGame(x.page);
        panelRow(rec, sc, "DY1", g, h, "talk", x.who);
        rec(sc, "DY2", `[토론 끝내기]가 있고 숫자 최대가 과반(${majorityOf(N)})이다 (${x.who})`, !!g.end && g.end.total === majorityOf(N) && g.end.pressed === false, `end ${JSON.stringify(g.end)}`);
        rec(sc, "DY2b", `토론에는 지목 버튼이 없다 (${x.who})`, g.picks.length === 0, `지목 버튼 ${g.picks.length}개`);
      }
      const g0 = await readGame(hp);
      const target = g0.stage ? await findTapTarget(hp, g0.stage, hostSeat, ctx.size) : null;
      if (!target) rec(sc, "DY0", "토론에서는 맵 탭이 걷기(move)를 보낸다", false, "탭할 목적지를 찾지 못함");
      else {
        const tap = await tapWorld(hp, ht, hostSeat, target.x, target.z);
        rec(sc, "DY0", "토론에서는 맵 탭이 걷기(move)를 보낸다", !!tap.move, "3초 안에 내 구간이 오지 않음");
      }
    }

    // [토론 끝내기]: 두 명이 눌러도 토론이 이어지고, 세 번째(과반)에서 지목으로 넘어간다
    {
      const sc = `${id}/discussion`;
      for (let i = 0; i < majorityOf(N) - 1; i++) {
        const r = await attempt(async () => {
          await pressEndDiscussion(humans[i].page, true);
        });
        rec(sc, "DY3", `[토론 끝내기] 누르면 눌림 표시 (${humans[i].who})`, r.ok, r.detail);
      }
      const seen = await attempt(async () => {
        const g = await untilGame(humans[N - 1].page, (x) => (x.end?.on ?? 0) >= majorityOf(N) - 1, 4000, "끝내기 숫자");
        return g.phase === "discussion" ? true : { ok: false, detail: `과반 전인데 ${g.phase} 로 넘어감` };
      });
      rec(sc, "DY4", "과반 전에는 토론이 이어지고 점이 눌린 수만큼 켜진다", seen.ok, seen.detail);
      const last = await attempt(async () => {
        await pressEndDiscussion(humans[N - 1].page, true);
      });
      rec(sc, "DY3", `[토론 끝내기] 누르면 눌림 표시 (${humans[N - 1].who})`, last.ok, last.detail);
      const moved = await attempt(async () => {
        await ht.waitFor((v) => v.phase === "nomination", 5000, "과반 → 지목");
      });
      rec(sc, "DY5", `과반(${majorityOf(N)}명)이 누르면 지목으로 넘어간다`, moved.ok, moved.detail);
    }

    // 지목: 버튼 3개 44×44·무가림, 패널 LOG_H + 92, 맵 탭은 move 를 보내지 않는다, 손님 셋이 방장을 가리키면 모든 페이지 배지가 같다
    {
      const sc = `${id}/nomination`;
      await allAt(pages, "nomination");
      await Promise.all(pages.map((p) => settle(p)));
      for (const x of humans) {
        const g = await readGame(x.page);
        recMany(rec, sc, pickButtonChecks(g.picks), ` (${x.who})`);
        rec(sc, "NM1", `지목 버튼은 나를 뺀 산 사람 ${N - 1}개 (${x.who})`, g.picks.length === N - 1 && !g.picks.some((b) => b.seat === x.tracker.last().me.seat), `버튼 ${g.picks.length}개`);
        panelRow(rec, sc, "NM2", g, h, "chat", x.who);
        rec(sc, "NM2b", `지목에는 토론 끝내기가 없다 (${x.who})`, g.end === null, `end ${JSON.stringify(g.end)}`);
      }
      // 맵 탭: 버튼이 아닌 바닥을 눌러도 이동 요청이 없고 목적지 링이 새로 생기지 않는다
      const g0 = await readGame(hp);
      const target = g0.stage ? await findTapTarget(hp, g0.stage, hostSeat, ctx.size) : null;
      if (!target) rec(sc, "NM3", "지목에서는 맵 탭이 move 를 보내지 않는다(카메라 고정)", false, "탭할 목적지를 찾지 못함");
      else {
        const pt = await hp.evaluate(({ x, z }) => window.__mfWorld?.screenOf(x, z) ?? null, { x: target.x, z: target.z });
        const before = ht.sentMoveAt.length;
        const ringBefore = g0.ring;
        if (pt) {
          await hp.mouse.move(pt.sx, pt.sy);
          await hp.mouse.down();
          await hp.mouse.up();
        }
        await sleep(800);
        const ringAfter = (await readGame(hp)).ring;
        rec(sc, "NM3", "지목에서는 맵 탭이 move 를 보내지 않는다(카메라 고정)", !!pt && ht.sentMoveAt.length === before && (ringAfter === null || ringAfter === ringBefore), `보낸 move ${ht.sentMoveAt.length - before}개, 링 ${ringBefore} → ${ringAfter}`);
      }
      // 손님 셋이 방장을 가리킨다
      for (let i = 0; i < guests.length; i++) {
        const r = await attempt(async () => {
          await tapPick(guests[i].page, hostSeat);
        });
        rec(sc, "NM4", `이름표 버튼을 누르면 눌림 표시 (${humans[i + 1].who})`, r.ok, r.detail);
      }
      const counts = await attempt(async () => {
        for (const x of humans) await untilGame(x.page, (gm) => Number(gm.tags.find((t) => t.seat === hostSeat)?.count ?? 0) >= guests.length, 5000, "배지 3표");
        await sleep(400);
        const finals = await Promise.all(pages.map(async (p) => (await readGame(p)).tags.find((t) => t.seat === hostSeat)?.count ?? null));
        return finals.every((c) => c === String(guests.length)) ? true : { ok: false, detail: `페이지마다 득표 ${finals.join("/")} (기대 ${guests.length})` };
      });
      rec(sc, "NM5", `득표 배지(data-count)가 모든 페이지에서 ${guests.length} 이다`, counts.ok, counts.detail);
      const gm = await readGame(guests[0].page);
      const hostTag = gm.tags.find((t) => t.seat === hostSeat);
      rec(sc, "NM6", "내가 고른 사람의 이름표가 mine 표시이고, 과반이라 선두·유력 표시가 켜진다", !!hostTag?.mine && hostTag.lead && hostTag.sure, `mine ${hostTag?.mine}, lead ${hostTag?.lead}, sure ${hostTag?.sure}`);
      await gameGH(ctx, id, "nomination", host);
      await gameGH(ctx, id, "nomination-guest", guests[0]);
    }

    // 최후 변론: 변론자(방장)만 득표 배지가 남는다, 패널 채팅
    {
      const sc = `${id}/defense`;
      await skipTo(hp, ht, "defense");
      await allAt(pages, "defense");
      await Promise.all(pages.map((p) => settle(p)));
      for (const x of humans) {
        const g = await readGame(x.page);
        panelRow(rec, sc, "DF1", g, h, "chat", x.who);
        const withBadge = g.tags.filter((t) => t.count !== null).map((t) => t.seat);
        rec(sc, "DF2", `변론자 이름표만 득표 배지가 남는다 (${x.who})`, withBadge.length === 1 && withBadge[0] === hostSeat, `배지 자리 ${withBadge.join(",") || "없음"}`);
      }
    }

    // 찬반: 투표자(손님)는 고르기+숫자 LOG_H + 203, 보기(변론자 방장)는 숫자만 LOG_H + 111. 누르면 눌림, 던진 사람 이름표에 체크, 찬반 값은 어디에도 없다
    {
      const sc = `${id}/verdict`;
      await skipTo(hp, ht, "verdict");
      await allAt(pages, "verdict");
      await Promise.all(pages.map((p) => settle(p)));
      for (const x of humans) {
        const g = await readGame(x.page);
        const viewer = x.handle === host;
        recMany(rec, sc, verdictPanelChecks({ kind: viewer ? "viewer" : "voter", hasPicker: !!g.verdictRow?.hasPicker, hasCount: !!g.verdictRow?.hasCount, kbOpen: g.kbOpen }), ` (${x.who})`);
        panelRow(rec, sc, "VD1", g, h, viewer ? "verdictViewer" : "verdictVoter", x.who);
        rec(sc, "VD1b", `찬반 숫자 total = 산 사람 − 1 = ${N - 1} (${x.who})`, g.verdictRow?.total === N - 1, `total ${g.verdictRow?.total}`);
      }
      for (let i = 0; i < guests.length; i++) {
        const r = await attempt(async () => {
          await chooseVerdict(guests[i].page, true);
        });
        rec(sc, "VD2", `[찬성]을 누르면 눌림 표시 (${humans[i + 1].who})`, r.ok, r.detail);
      }
      const done = await attempt(async () => {
        const g = await untilGame(hp, (gm) => gm.tags.filter((t) => t.done).length >= guests.length, 5000, "던진 사람 체크");
        return g.tags.filter((t) => t.done).length >= guests.length ? true : false;
      });
      rec(sc, "VD3", "던진 사람 이름표에 체크(data-done)가 붙는다", done.ok, done.detail);
      const leak = await hp.evaluate(() => /찬성|반대/.test(document.body.innerText));
      rec(sc, "VD4", "변론자 화면에는 무엇을 골랐는지(찬성·반대 글자)가 어디에도 없다", !leak, "방장 화면 글자에 찬성/반대가 있음");
      // E8 #28(알려진 한계, 계획 가정 A2): 찬반 투표자 스테이지가 낮은 폰(방 높이 560 이하)에서 위쪽 이름표가 스테이지 위로 올라간 높이 — 값만 기록하고 판정하지 않는다
      {
        const gv = await readGame(guests[0].page);
        const tops = gv.tags.map((t) => t.top).filter((t) => typeof t === "number");
        const rise = gv.stage && tops.length > 0 ? Math.max(0, Math.round((gv.stage.top - Math.min(...tops)) * 10) / 10) : null;
        infoRow(ctx, sc, "VD5k", "알려진 한계(E8 #28): 위쪽 이름표가 스테이지 위로 올라간 높이(판정 아님)", `${rise === null ? "측정값 없음" : `${rise}px`} (스테이지 높이 ${gv.stage ? Math.round(gv.stage.bottom - gv.stage.top) : "?"}px, 방 높이 ${h}px)`);
      }
      await gameGH(ctx, id, "verdict", host);
      await gameGH(ctx, id, "verdict-guest", guests[0]);
    }

    // 처형: 결과 알림 '찬성 n · 반대 m' → '{닉네임} 님 처형' (36px·한두 줄·keep-all), 역할 글자 없음, 처형된 이름표는 산 사람 화면에서 사라진다
    {
      const sc = `${id}/execution`;
      await armAnnounceWatch(guests[0].page);
      await skipTo(hp, ht, "execution");
      const log = await waitAnnounces(guests[0].page, 2);
      const texts = log.filter((a) => a.text !== null);
      const iTally = annIndex(log, (t) => TALLY_RE.test(t));
      const iExec = annIndex(log, (t) => t === `${GAME_HOST_NICK} 님 처형`);
      rec(sc, "EX1", "결과 알림이 '찬성 n · 반대 m' 다음 '{닉네임} 님 처형' 순서다", iTally >= 0 && iExec > iTally, `알림 ${texts.map((a) => a.text).join(" → ") || "없음"}`);
      for (const [which, i] of [["찬반 결과", iTally], ["처형", iExec]]) {
        if (i >= 0) recMany(rec, sc, announceChecks(log[i]), ` (${which})`);
        else rec(sc, "AN0", `결과 알림 글자 판정 (${which})`, false, "알림을 보지 못함");
      }
      rec(sc, "EX2", "알림 어디에도 역할 글자가 없다", !texts.some((a) => ROLE_WORD_RE.test(a.text)), `알림 ${texts.map((a) => a.text).join(" → ")}`);
      const gone = await attempt(async () => {
        await untilGame(guests[0].page, (g) => !g.tags.some((t) => t.seat === hostSeat), 9000, "처형된 이름표 사라짐");
      });
      rec(sc, "EX3", "처형된 사람의 이름표가 산 사람 화면에서 사라진다", gone.ok, gone.detail);
      const ghosts = await attempt(async () => {
        const gs = await Promise.all(guests.map((x) => readGame(x.page)));
        const bad = gs.map((g) => ghostDomChecks(g.counts).filter((l) => !l.ok)).flat();
        return bad.length === 0 ? true : { ok: false, detail: bad.map((l) => l.detail).join("; ") };
      });
      rec(sc, "EX4", "처형 뒤 산 사람 화면에 유령 표식·문구가 없다", ghosts.ok, ghosts.detail);
    }

    // 밤
    {
      // 처형 5초는 서버 타이머로 밤이 된다. 배포본처럼 지연이 큰 곳에서는 위 판정이 5초를 넘기고, 그 뒤 '다음 단계로 넘기기' 를
      // 누르면 이미 온 밤을 건너뛰어 아침·다음 날 토론까지 가 버린다 — 눌러 넘기지 않고 자연 전환을 기다린다(판정은 그대로).
      const night = await attempt(async () => {
        await ht.waitFor((v) => v.phase === "night", 9000, "처형 뒤 밤(서버 타이머)");
        await Promise.all(guests.map((x) => untilGame(x.page, (g) => g.phase === "night", 15_000, "밤 도착")));
      });
      const nightSeen = night.ok ? "" : ` · 방장 서버 단계 ${ht.last()?.phase} · 손님 화면 단계 ${(await Promise.all(guests.map((x) => readGame(x.page).then((g) => g.phase).catch(() => "읽기 실패")))).join(",")}`;
      rec(`${id}/night`, "NT1", "처형 뒤 밤으로 간다", night.ok, `${night.detail ?? ""}${nightSeen}`);
    }
  } finally {
    await closeGame(game);
  }
}

// ---- ghost: 처형된 사람은 유령 화면(직업 칩·유령 채널)으로 다음 날도 맵을 걷고, 산 사람 화면·소켓에는 아무것도 없다 ----

/** 방장이 처형되도록 지목·찬반을 넘겨 execution 에 닿는다(봇 지목 = 방장, 봇 찬성; 손님은 찬성을 누른다). */
async function executeHost(game) {
  const { hp, ht, guests } = game;
  await skipTo(hp, ht, "nomination");
  await skipTo(hp, ht, "defense"); // 봇이 지금 방장을 가리킨다
  await skipTo(hp, ht, "verdict");
  for (const g of guests) {
    await untilGame(g.page, (x) => x.phase === "verdict" && x.verdictBtns.length === 2, 6000, "찬반 도착");
    await chooseVerdict(g.page, true).catch(() => {});
  }
  await skipTo(hp, ht, "execution");
}

async function ghostFlow(ctx) {
  const id = "ghost";
  const rec = recorder(ctx);
  const game = await openGame(ctx, id, { guests: 2, bots: 4, role: "citizen", vote: { exec: "yes", pick: "host" }, to: "discussion" });
  try {
    const { host, hp, ht, hostSeat, guests } = game;
    await executeHost(game);

    // 유령 화면: data-ghost-view, 모든 이름표에 직업 칩(spectate.seats 수), 유령 채널 입력
    {
      const sc = `${id}/ghost`;
      const g = await untilGame(hp, (x) => x.ghostView, 9000, "유령 화면");
      await settle(hp);
      const view = ht.last();
      const seats = view.spectate?.seats?.length ?? -1;
      rec(sc, "GH5", "처형된 방장 화면이 유령 화면이다(data-ghost-view)", g.counts.ghostView === 1, `ghostView ${g.counts.ghostView}`);
      rec(sc, "GH6", "이름표마다 직업 칩이 붙는다(칩 수 = 서버가 보낸 직업 목록 = 사람 수)", g.counts.roleChips === seats && seats === view.players.length, `칩 ${g.counts.roleChips}, spectate.seats ${seats}, 사람 ${view.players.length}`);
      rec(sc, "GH7", "유령 채널 입력줄이 있다", g.hasInput && g.chatChannel === "ghost", `채널 ${g.chatChannel}, 입력 ${g.hasInput}`);
      rec(sc, "GH8", "죽은 자리 표식(data-ghost-seat)이 있다", g.counts.ghostSeats >= 1, `ghostSeats ${g.counts.ghostSeats}`);
      await gameGH(ctx, id, "ghost", host);
      // 산 사람 화면: 유령 표식·문구 0건
      for (let i = 0; i < guests.length; i++) {
        const gg = await readGame(guests[i].page);
        recMany(rec, sc, ghostDomChecks(gg.counts), ` (손님${i + 1})`);
      }
    }

    // 다음 날 지목에서도 유령은 맵을 걷는다. 산 사람 페이지의 world 기록에는 유령 좌석 구간이 없다
    {
      const sc = `${id}/walk`;
      await skipTo(hp, ht, "nomination");
      const g0 = await untilGame(hp, (x) => x.phase === "nomination" && x.ghostView, 9000, "다음 날 지목 도착(유령)");
      await settle(hp);
      const movesBefore = guests.map((g) => g.tracker.moves.get(hostSeat)?.n ?? 0);
      const target = g0.stage ? await findTapTarget(hp, g0.stage, hostSeat, ctx.size) : null;
      if (!target) rec(sc, "GH10", "유령이 다음 날 지목에서도 맵을 걷는다", false, "탭할 목적지를 찾지 못함");
      else {
        const tap = await tapWorld(hp, ht, hostSeat, target.x, target.z);
        rec(sc, "GH10", "유령이 다음 날 지목에서도 맵을 걷는다(구간을 받음)", !!tap.move, "3초 안에 내 구간이 오지 않음");
        rec(sc, "GH10b", "유령 화면에는 지목 버튼이 없다", (await readGame(hp)).picks.length === 0, "유령에게 이름표 버튼이 있음");
      }
      await sleep(1200);
      // 유령 이름표 글자 대비: 다른 유령(밤에 죽은 손님)의 이름표는 불투명도 0.6 이다. 실제 렌더 값을 기록한다(판정 아님 — 4.5:1 미달이면 이름표 면만 0.8 로 올리는 안은 사용자 결정 전까지 '확인 대기', UI-SPEC 남은 위험 5)
      {
        const pool = await readGhostTagContrast(hp).catch(() => []);
        const worst = pool.length > 0 ? Math.min(...pool.map((c) => c.ratio)) : null;
        infoRow(ctx, sc, "GH9", "유령 이름표 글자 대비(참고, 판정 아님)", pool.length === 0 ? "측정한 유령 이름표 없음" : `${pool.map((c) => `자리 ${c.seat} ${Math.round(c.ratio * 100) / 100}:1(불투명도 ${Math.round(c.opacity * 100) / 100})`).join(", ")}${worst < 4.5 ? " — 4.5:1 미달: 이름표 면만 0.8 로 올리는 안 확인 대기(사용자 결정)" : ""}`);
      }
      for (let i = 0; i < guests.length; i++) {
        const g = guests[i];
        await untilGame(g.page, (x) => !x.tags.some((t) => t.seat === hostSeat), 6000, "처형 연출 끝").catch(() => {});
        const gg = await readGame(g.page);
        const gv = g.tracker.last();
        if (!aliveOf(gv).includes(g.seat)) {
          // 밤에 마피아에게 죽은 손님은 그 자신이 유령이라 산 사람 화면 규칙의 대상이 아니다
          infoRow(ctx, sc, "GH0", `손님${i + 1} 은 밤에 죽어 유령 화면이라 산 사람 규칙 검사에서 뺀다`, `산 사람 ${aliveOf(gv).join(",")}`);
          continue;
        }
        recMany(rec, sc, ghostDomChecks(gg.counts), ` (손님${i + 1}, 유령이 걸은 뒤)`);
        const after = g.tracker.moves.get(hostSeat)?.n ?? 0;
        const before = movesBefore[i];
        rec(sc, "GH11", `유령이 걷는 동안 산 사람 페이지가 유령 좌석 구간을 받지 않는다 (손님${i + 1})`, after === before, `받은 구간 번호 ${before} → ${after}`);
        rec(sc, "GH12", `산 사람 화면에 유령 이름표가 없다 (손님${i + 1})`, !gg.tags.some((t) => t.seat === hostSeat), `이름표 ${JSON.stringify(gg.tags.map((t) => [t.seat, t.opacity]))}`);
        await gameGH(ctx, id, `nomination-guest${i + 1}`, g);
      }
    }
  } finally {
    await closeGame(game);
  }
}

// ---- noexec: 지목 0표 → 밤 '처형 없음', 찬반 부결 → 처형 단계 '처형 없음'과 변론자 복귀 ----

async function noexecFlow(ctx) {
  const id = "noexec";
  const rec = recorder(ctx);

  // (a) 사람만 있는 방(봇 없음): 아무도 지목하지 않고 마감 → 0표 → 밤 시작 '처형 없음'
  {
    const sc = `${id}/zero`;
    const game = await openGame(ctx, id, { guests: 3, bots: 0, role: "citizen", to: "nomination" });
    try {
      const { hp, ht, guests } = game;
      await armAnnounceWatch(guests[0].page);
      await skipTo(hp, ht, "night");
      const log = await waitAnnounces(guests[0].page, 1, 4000);
      const i = annIndex(log, (t) => t === "처형 없음");
      rec(sc, "NE1", "지목 0표면 밤 시작에 '처형 없음' 알림이 뜬다", i >= 0, `알림 ${log.filter((a) => a.text).map((a) => a.text).join(" → ") || "없음"}`);
      if (i >= 0) recMany(rec, sc, announceChecks(log[i]), " ('처형 없음')");
      rec(sc, "NE2", "그대로 밤이다(변론·찬반을 거치지 않음)", ht.last().phase === "night", `단계 ${ht.last().phase}`);
    } finally {
      await closeGame(game);
    }
  }

  // (b) 봇 찬반 '반대': 봇이 방장을 가리켜 변론자가 되고, 찬반 부결 → '찬성 0 · 반대 3' 다음 '처형 없음', 변론자는 자리로 돌아온다
  {
    const sc = `${id}/rejected`;
    const game = await openGame(ctx, id, { guests: 0, bots: 3, role: "citizen", vote: { exec: "no", pick: "host" }, to: "nomination" });
    try {
      const { hp, ht, hostSeat } = game;
      await skipTo(hp, ht, "defense");
      await skipTo(hp, ht, "verdict");
      await settle(hp);
      const center = await sampleWorld(hp, hostSeat).catch(() => null);
      await armAnnounceWatch(hp);
      await skipTo(hp, ht, "execution");
      const log = await waitAnnounces(hp, 2);
      const iTally = annIndex(log, (t) => TALLY_RE.test(t));
      const iNo = annIndex(log, (t) => t === "처형 없음");
      rec(sc, "NE3", "부결이면 '찬성 n · 반대 m' 다음 '처형 없음' 알림이 뜬다", iTally >= 0 && iNo > iTally, `알림 ${log.filter((a) => a.text).map((a) => a.text).join(" → ") || "없음"}`);
      if (iNo >= 0) recMany(rec, sc, announceChecks(log[iNo]), " ('처형 없음')");
      rec(sc, "NE4", "변론자는 처형되지 않고 산 사람이다", aliveOf(ht.last()).includes(hostSeat), `산 사람 ${aliveOf(ht.last()).join(",")}`);
      const back = await attempt(async () => {
        const start = performance.now();
        for (;;) {
          const now = await sampleWorld(hp, hostSeat).catch(() => null);
          if (center && now && Math.hypot(now.x - center.x, now.z - center.z) > 1) return true;
          if (performance.now() - start > 7000) return { ok: false, detail: `가운데 ${JSON.stringify(center)} → 지금 ${JSON.stringify(now)}` };
          await sleep(200);
        }
      });
      rec(sc, "NE5", "변론자가 가운데에서 자리로 돌아온다(위치가 1 단위 넘게 옮겨짐)", back.ok, back.detail);
    } finally {
      await closeGame(game);
    }
  }
}

// ---- night: 9페이즈 밤·아침 — 암살·구출·불일치·처형 유언·경찰 결과·피해자 이펙트, 시민 편 DOM·폰 크기 기하 (09-22) ----
// 8페이즈의 밤 임시 틀 흐름(역할마다 이름표 선택·NightPanel 알약)은 9페이즈가 얼굴 목록·마피아 다가가기·쪽지·분필·카드로 바꿨다.
// 봇 마피아는 실행 시점에 동료의 선택을 따라가고(결정 0061-18) 마피아 전원이 같은 대상을 골라야 탈락이 난다 — 사람(방장) 마피아 판은 방장이 먼저 고르거나(확정) 봇이 먼저 고른 뒤 다른 대상을 고른다(불일치).

/** 봇이 1일차 토론에 유언 한 줄을 쓰는 시각(BOT_WILL_AT_MS 3000) 뒤까지 기다리는 시간(알람 지연 여유) */
const BOT_WILL_WAIT_MS = 4500;

/** 밤·아침 화면 한 장 읽기: 9페이즈 표식(NIGHT_MARKERS)·이름표·얼굴 칸·카드 기하만 싣는다. 게임 화면이 없으면 null. */
function readNight(page) {
  return page.evaluate(() => {
    const q = (s, r = document) => r.querySelector(s);
    const qa = (s, r = document) => [...r.querySelectorAll(s)];
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    };
    const textBox = (el) => {
      if (!el) return null;
      const range = document.createRange();
      range.selectNodeContents(el);
      const r = range.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    };
    const root = q("[data-game-stage]");
    if (!root) return null;
    const header = q(".mf-game__header");
    const panel = q("[data-world-panel]");
    const mine = q('.mf-world__tag[data-me="true"] .mv-tag');
    const mb = box(mine);
    const note = q("[data-note-button]");
    const sureHead = q(".mv-head[data-sure]");
    const police = q(".mf-police-card");
    return {
      phase: root.getAttribute("data-phase") ?? "",
      vw: window.innerWidth,
      vh: window.innerHeight,
      nightDark: root.getAttribute("data-night-dark"),
      tensionPulse: qa("[data-tension-pulse]").length,
      tagCount: qa(".mf-world__tag").length,
      roleChips: qa("[data-role-chip]").length,
      chatPanels: qa("[data-chat-panel]").length,
      myTag: mb ? { x: mb.left, y: mb.top, w: mb.width, h: mb.height } : null,
      stage: header && panel ? { left: 0, top: header.getBoundingClientRect().bottom, right: window.innerWidth, bottom: panel.getBoundingClientRect().top } : null,
      panel: box(panel),
      faceList: !!q("[data-face-list]"),
      faces: qa("[data-face]").map((b) => ({ seat: Number(b.getAttribute("data-face")), pressed: b.getAttribute("aria-pressed") === "true", cell: box(b), name: textBox(q(".mv-face__name", b)), lineH: (() => { const el = q(".mv-face__name", b); if (!el) return null; const cs = getComputedStyle(el); const lh = parseFloat(cs.lineHeight); return Number.isFinite(lh) ? lh : parseFloat(cs.fontSize) * 1.3; })() })),
      willButton: !!q("[data-will-button]"),
      noteButton: note ? { disabled: note.getAttribute("aria-disabled") === "true" } : null,
      willSheet: q("[data-will-sheet]")?.getAttribute("data-will-sheet") ?? null,
      chalk: q("[data-chalk]")?.getAttribute("data-chalk") ?? null,
      cards: qa("[data-card]").map((c) => ({ kind: c.getAttribute("data-card"), text: (c.textContent ?? "").replace(/\s+/g, " ").trim() })),
      policeCard: police ? (q(".mf-police-card__label", police)?.textContent ?? "").trim() : null,
      sure: sureHead ? { text: (sureHead.textContent ?? "").replace(/\s+/g, " ").trim() } : null,
      killFx: qa("[data-kill-fx]").length,
      curtain: qa("[data-curtain]").length,
      ghostView: root.getAttribute("data-ghost-view") === "true",
      announce: (q("[data-announce] .mf-announce__text")?.textContent ?? "").trim() || null,
    };
  });
}

/** 번쩍임([data-kill-fx])·막([data-curtain])이 DOM 에 생기고 사라진 횟수를 센다(짧은 구간을 호출 지연과 상관없이 놓치지 않게 MutationObserver). */
function armSeenWatch(page) {
  return page.evaluate(() => {
    window.__nightSeen?.stop?.();
    const seen = { kill: 0, curtain: 0, curtainGone: 0, police: [] };
    const has = (n, sel) => n.nodeType === 1 && (n.matches(sel) || n.querySelector(sel) !== null);
    const mo = new MutationObserver((muts) => {
      for (const m of muts) {
        for (const n of m.addedNodes) {
          if (has(n, "[data-kill-fx]")) seen.kill += 1;
          if (has(n, "[data-curtain]")) seen.curtain += 1;
          if (has(n, ".mf-police-card")) {
            const card = n.matches(".mf-police-card") ? n : n.querySelector(".mf-police-card");
            seen.police.push((card?.querySelector(".mf-police-card__label")?.textContent ?? "").trim());
          }
        }
        for (const n of m.removedNodes) if (has(n, "[data-curtain]")) seen.curtainGone += 1;
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
    window.__nightSeen = { seen, stop: () => mo.disconnect() };
  });
}

const readSeen = (page) => page.evaluate(() => ({ ...(window.__nightSeen?.seen ?? { kill: -1, curtain: -1, curtainGone: -1, police: [] }) }));

/** 읽기를 pred 가 참일 때까지 되풀이한다(시간 안에 안 오면 SetupError 가 아니라 null — 호출 쪽이 검사 실패로 적는다). */
async function nightUntil(page, pred, ms = 6000) {
  const start = performance.now();
  for (;;) {
    const n = await readNight(page).catch(() => null);
    if (n && pred(n)) return n;
    if (performance.now() - start > ms) return null;
    await sleep(100);
  }
}

const MORNING_SAVED = "누군가 살아났습니다";
const MORNING_SENTENCE_RE = /님이 당했습니다$|^누군가 살아났습니다$|^아무 일도 없었습니다$/;

/** 아침 문장(당했습니다·살아났습니다·아무 일도)이 나올 때까지 알림 기록을 본다. 밤 진입 때 남은 알림('처형 없음' 등)은 건너뛴다. */
async function waitMorningAnnounce(page, ms, re = MORNING_SENTENCE_RE) {
  const start = performance.now();
  for (;;) {
    const log = await readAnnounceWatch(page, { stop: false });
    const morning = log.find((a) => typeof a.text === "string" && re.test(a.text));
    if (morning || performance.now() - start > ms) return { log, morning };
    await sleep(100);
  }
}

/** 유언·쪽지 시트(kind = "will"|"note")에 글을 쓰고 [저장] 을 눌러 서버가 같은 글을 돌려줄 때까지 기다린 뒤 닫는다. */
async function writeSheet(page, tracker, kind, text) {
  const sheet = page.locator(`[data-will-sheet="${kind}"]`);
  await sheet.waitFor({ state: "visible", timeout: 4000 });
  await sheet.locator("textarea").fill(text);
  await sheet.locator(".mv-will__save").click();
  await tracker.waitFor((v) => (kind === "note" ? v.me.note : v.me.will) === text, 4000, `${kind} 저장 확인`);
  await sheet.locator(".mv-will__close").click();
  await sheet.waitFor({ state: "detached", timeout: 3000 });
}

/** 밤까지 연다: 토론에서 봇 유언을 기다린 뒤(waitWill) 지목·변론·찬반·처형을 넘겨 밤에 닿는다. 막 관찰은 밤 진입 전에 건다. */
async function openNight(ctx, flowId, opts) {
  const { waitWill = false, ...gameOpts } = opts;
  const game = await openGame(ctx, flowId, { vote: { exec: "no", pick: "other" }, ...gameOpts, to: "discussion" });
  const { hp, ht } = game;
  if (waitWill) await sleep(BOT_WILL_WAIT_MS);
  await armSeenWatch(hp);
  await skipTo(hp, ht, "night");
  const g = await untilGame(hp, (x) => x.phase === "night", 9000, "밤 도착");
  await settle(hp);
  return { game, g };
}

const nickOf = (view, seat) => view.players.find((p) => p.seat === seat)?.nickname ?? "";

/** 첫 밤 암살 한 번(트레이서): 마피아 방장이 다가가 봇 마피아와 확정 → 쪽지 → 아침 분필·알림·유언 카드·쪽지 카드 (NIGHT-08, NIGHT-12, MORN-01, MORN-02) */
async function nightAssassin(ctx) {
  const id = "night";
  const sc = `${id}/assassin`;
  const rec = recorder(ctx);
  const { game, g } = await openNight(ctx, id, { guests: 0, bots: 5, role: "mafia", waitWill: true });
  try {
    const { host, hp, ht } = game;
    const view = ht.last();
    const allies = view.me.allies?.length ?? 0;
    const alive = aliveOf(view).length;
    rec(sc, "NA1", "내 직업이 마피아이고 동료가 있다(6명판)", view.me.role === "mafia" && allies === 1, `직업 ${view.me.role}, 동료 ${allies}`);
    rec(sc, "NA2", "밤 마피아 아래 패널은 마피아 채널 채팅이다", g.hasInput && g.chatChannel === "mafia", `채널 ${g.chatChannel}, 입력 ${g.hasInput}`);
    rec(sc, "NA3", `이름표 선택 버튼은 나·동료를 뺀 산 사람 ${alive - 1 - allies}개`, g.picks.length === alive - 1 - allies, `버튼 ${g.picks.length}개`);
    const n0 = await readNight(hp);
    rec(sc, "NA4", "확정 전에는 [쪽지] 가 있고 비활성(aria-disabled)이다", n0?.noteButton?.disabled === true, `쪽지 버튼 ${JSON.stringify(n0?.noteButton)}`);
    rec(sc, "NA5", "밤 마피아 화면에는 어둠·맥박이 없다(시민 편만)", n0?.nightDark === null && n0?.tensionPulse === 0, `어둠 ${n0?.nightDark}, 맥박 ${n0?.tensionPulse}`);
    await gameGH(ctx, id, "night-mafia", host);

    // 다가가기: 봇이 고르는 가장 낮은 seat 의 산 비마피아를 방장이 누른다 → 내 캐릭터가 움직이고(목적지 링) 봇 마피아와 일치해 확정된다
    const target = g.picks.map((b) => b.seat).sort((a, b) => a - b)[0];
    const posBefore = await sampleWorld(hp, game.hostSeat).catch(() => null);
    const segBefore = ht.moves.get(game.hostSeat)?.n ?? 0;
    const movesBefore = ht.sentMoveAt.length;
    const tap = await attempt(async () => {
      await tapPick(hp, target);
    });
    rec(sc, "NA6", "이름표 버튼을 누르면 눌림 표시", tap.ok, tap.detail);
    // 다가가기는 일반 move 를 보낸다(목적지 링 data-ring 은 맵 탭에서만 생긴다) — 내 구간이 새로 오고 위치가 실제로 옮겨지는지로 본다
    const moved = await attempt(async () => {
      const start = performance.now();
      for (;;) {
        const now = await sampleWorld(hp, game.hostSeat).catch(() => null);
        if (posBefore && now && Math.hypot(now.x - posBefore.x, now.z - posBefore.z) > 0.5) return true;
        if (performance.now() - start > 5000) return { ok: false, detail: `위치 ${JSON.stringify(posBefore)} → ${JSON.stringify(now)}` };
        await sleep(150);
      }
    });
    rec(sc, "NA7", "대상을 고르면 내 캐릭터가 대상 곁으로 걷는다(move 전송 + 위치가 0.5 단위 넘게 옮겨짐)", moved.ok && ht.sentMoveAt.length > movesBefore && (ht.moves.get(game.hostSeat)?.n ?? 0) > segBefore, `${moved.detail} / 보낸 move ${ht.sentMoveAt.length - movesBefore}개, 내 구간 번호 ${segBefore} → ${ht.moves.get(game.hostSeat)?.n ?? 0}`);
    infoRow(ctx, sc, "NA7k", "참고: 다가가기 중 목적지 링 data-ring(맵 탭에서만 생김, 판정 아님)", `링 ${(await readGame(hp)).ring}`);
    const sure = await attempt(async () => {
      const gg = await untilGame(hp, (x) => x.tags.some((t) => t.sure), 9000, "확정 도장");
      const st = gg.tags.find((t) => t.sure);
      return st?.seat === target ? true : { ok: false, detail: `확정 도장 자리 ${st?.seat} ≠ 대상 ${target}` };
    });
    rec(sc, "NA8", "봇 마피아가 같은 대상을 고르면 대상 이름표에 '확정' 도장이 붙는다", sure.ok, sure.detail);
    const nSure = await readNight(hp);
    rec(sc, "NA9", "도장 글자가 '확정' 이다", /확정/.test(nSure?.sure?.text ?? ""), `도장 ${nSure?.sure?.text}`);
    rec(sc, "NA10", "확정 뒤 [쪽지] 가 활성이다", nSure?.noteButton?.disabled === false, `쪽지 버튼 ${JSON.stringify(nSure?.noteButton)}`);
    rec(sc, "NA11", "서버 확정(me.nightSure)이 대상과 같다", ht.last().me.nightSure === target, `nightSure ${ht.last().me.nightSure}`);

    // 쪽지: 열어 쓰고 저장한다
    const NOTE = "첫 밤에는 이 사람입니다";
    const noted = await attempt(async () => {
      await hp.locator("[data-note-button]").click();
      await writeSheet(hp, ht, "note", NOTE);
    });
    rec(sc, "NA12", "[쪽지] 로 시트를 열어 쓰고 저장하면 서버가 같은 글을 돌려준다", noted.ok, noted.detail);

    // 아침: 분필·알림·유언 카드·쪽지 카드
    const victim = nickOf(ht.last(), target);
    // 밤은 30초다 — 부하로 검사가 길어져 서버 타이머가 밤을 먼저 끝냈으면 이 판은 아침을 볼 수 없다(새 방으로 다시 돈다)
    if (ht.last().phase !== "night") throw new SetupError(`밤 검사가 길어져 서버가 밤을 먼저 끝냄 (지금 ${ht.last().phase})`);
    await armAnnounceWatch(hp);
    await skipTo(hp, ht, "morning");
    await untilGame(hp, (x) => x.phase === "morning", 6000, "아침 도착");
    const { log, morning } = await waitMorningAnnounce(hp, 6000);
    // 의사 봇은 산 사람 중 무작위로 지킨다 — 우연히 이 밤의 대상을 지키면(구출 문장) 암살 흐름을 볼 수 없다. 새 방으로 다시 돈다(구출 흐름은 night/saved 가 따로 본다)
    if (morning?.text === MORNING_SAVED) throw new SetupError("의사 봇이 우연히 이 밤의 대상을 지킴");
    const chalk = await nightUntil(hp, (x) => x.chalk !== null, 2000);
    rec(sc, "MA1", "아침에 암살 현장 분필([data-chalk])이 있다", !!chalk && /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(chalk.chalk), `chalk ${chalk?.chalk ?? "없음"}`);
    rec(sc, "MA2", `아침 알림이 '${victim} 님이 당했습니다' 이다`, morning?.text === `${victim} 님이 당했습니다`, `알림 ${log.filter((a) => a.text).map((a) => a.text).join(" → ") || "없음"}`);
    if (morning) recMany(rec, sc, announceChecks(morning), " (아침)");
    const cards = await nightUntil(hp, (x) => x.cards.some((c) => c.kind === "will") && x.cards.some((c) => c.kind === "note"), 7000);
    const kinds = (cards ?? (await readNight(hp)))?.cards.map((c) => c.kind) ?? [];
    rec(sc, "MA3", "2.8초 뒤 채팅에 유언 카드와 쪽지 카드가 순서대로(유언 → 쪽지) 나온다", !!cards && kinds.indexOf("will") >= 0 && kinds.indexOf("note") > kinds.indexOf("will"), `카드 ${kinds.join(",") || "없음"}`);
    rec(sc, "MA4", "쪽지 카드에 쓴 글이 있고 유언 카드에 봇 유언이 있다", !!cards && cards.cards.some((c) => c.kind === "note" && c.text.includes(NOTE)) && cards.cards.some((c) => c.kind === "will" && BOT_WILL_TEXTS.some((t) => c.text.includes(t))), `카드 ${JSON.stringify(cards?.cards ?? null)}`);
    await gameGH(ctx, id, "morning", host);
  } finally {
    await closeGame(game);
  }
}

/** 봇 유언 문장 3종(shared/game/bots.ts BOT_WILL_LINES 와 같다 — 스크립트는 shared 를 가져오지 않는다) */
const BOT_WILL_TEXTS = ["다들 끝까지 힘내요", "저는 믿어 주세요", "좋은 판이었어요"];

/** 시나리오 하나를 돈다. 준비 실패(SetupError)는 그 시나리오만 새 방으로 다시 돈다(최대 tries번) — 앞 시나리오의 결과를 잃지 않게. 검사 실패 기록은 남긴다. */
async function nightScenario(ctx, fn, tries = 3) {
  for (let i = 1; ; i++) {
    const mark = ctx.results.length;
    try {
      return await fn();
    } catch (e) {
      if (!(e instanceof SetupError) || i >= tries) throw e;
      const failed = ctx.results.slice(mark).filter((r) => r.ok === false);
      ctx.results.length = mark;
      ctx.results.push(...failed);
    }
  }
}

/** 밤이 서버 타이머(30초)로 먼저 끝났으면 이 판은 밤을 더 볼 수 없다 — 새 방으로 다시 돈다 */
function assertStillNight(ht) {
  if (ht.last().phase !== "night") throw new SetupError(`밤 검사가 길어져 서버가 밤을 먼저 끝냄 (지금 ${ht.last().phase})`);
}

/** 한 값이 기대와 ±tol 안인지 한 줄로 */
function recNear(rec, sc, id, label, got, want, tol) {
  rec(sc, id, label, typeof got === "number" && Math.abs(got - want) <= tol, `실제 ${typeof got === "number" ? Math.round(got * 10) / 10 : got} ≠ 기대 ${Math.round(want * 10) / 10} (±${tol})`);
}

/** 시민 편(시민·경찰·의사) 밤 DOM(L10, T-09-46): 어둠·맥박이 있고, 이름표는 내 것 하나, 직업 칩 0, 채팅 패널 0, 아래에 [유언] 줄 */
function sideChecks(rec, sc, who, n, g) {
  rec(sc, "L1", `${who}: 밤 어둠(data-night-dark)과 맥박(data-tension-pulse)이 있다`, n.nightDark === "true" && n.tensionPulse === 1, `어둠 ${n.nightDark}, 맥박 ${n.tensionPulse}`);
  rec(sc, "L2", `${who}: 이름표가 내 것 하나뿐이다`, n.tagCount === 1 && g.tags.length === 1 && g.tags[0].me === true, `이름표 ${n.tagCount}개, 내 것 ${g.tags.filter((t) => t.me).length}개`);
  rec(sc, "L3", `${who}: 직업 칩(data-role-chip)이 0개다`, n.roleChips === 0, `칩 ${n.roleChips}개`);
  rec(sc, "L4", `${who}: 채팅 패널이 0개다`, n.chatPanels === 0, `채팅 패널 ${n.chatPanels}개`);
  rec(sc, "L5", `${who}: 아래에 [유언] 깃펜 줄이 있다`, n.willButton === true, `깃펜 ${n.willButton}`);
}

/** 경찰·의사 얼굴 목록: 칸 수, 8자 이름이 칸 안(faceNameFits), 패널 높이가 UI-SPEC 160행 식(±2, 가정 A1) */
function faceListChecks(rec, sc, who, n, expectN) {
  rec(sc, "FL1", `${who}: 얼굴 목록([data-face-list])에 칸이 ${expectN}개`, n.faceList && n.faces.length === expectN, `목록 ${n.faceList}, 칸 ${n.faces.length}개`);
  const bad = n.faces.filter((f) => !faceNameFits({ cell: f.cell, name: f.name }));
  rec(sc, "FL2", `${who}: 8자 이름이 칸 안에 들어간다(faceNameFits)`, n.faces.length > 0 && bad.length === 0, `칸 밖 또는 측정 없음 ${bad.map((f) => f.seat).join(",") || "없음"}`);
  const wrapped = wrappedRowsOf(n);
  recNear(rec, sc, "FL3", `${who}: 아래 패널 높이가 얼굴 목록 식(faceListPanelH)과 같다(줄바꿈 행 ${wrapped}개 포함)`, n.panel?.height, faceListPanelH({ w: n.vw, n: n.faces.length, wrappedRows: wrapped }), 2);
}

/** 이름이 줄바꿈된 얼굴 행 수(이름 상자 높이가 한 줄 높이의 1.5배를 넘는 칸이 있는 행) */
function wrappedRowsOf(n) {
  return new Set(n.faces.filter((f) => f.name && typeof f.lineH === "number" && f.name.height > f.lineH * 1.5 && f.cell).map((f) => Math.round(f.cell.top))).size;
}

/** 내 이름표가 스테이지 안에 완전히 들어온다(tagInStage, 문턱 그대로) */
function recTagInStage(rec, sc, id, who, n) {
  rec(sc, id, `${who}: 내 이름표가 스테이지 안에 완전히 들어온다(tagInStage)`, tagInStage({ tag: n.myTag, stage: n.stage }), `이름표 ${JSON.stringify(n.myTag)}, 스테이지 ${JSON.stringify(n.stage)}`);
}

/**
 * 얼굴 목록 판의 이름표 위치. UI-SPEC "알려진 한계"(UI Considerations 45, 얼굴 목록 아래 표 설명)로 문서화된 한 경우만 판정에서 빼고 참고 줄로 남긴다:
 * 8자 이름이 줄바꿈되어 스테이지가 188 아래(약 152)로 줄어든 가장 짧은 폰. 그 밖은 전부 판정이고 문턱은 그대로다.
 */
function recTagInStageFaces(rec, sc, id, who, n) {
  const ok = tagInStage({ tag: n.myTag, stage: n.stage });
  const stageH = n.stage ? n.stage.bottom - n.stage.top : Number.NaN;
  if (!ok && wrappedRowsOf(n) > 0 && stageH < 188) {
    const over = n.myTag && n.stage ? Math.round((n.stage.top - n.myTag.y) * 10) / 10 : "?";
    rec(sc, `${id}k`, `알려진 한계(UI-SPEC UI Considerations 45): 이름이 줄바꿈된 ${who} 얼굴 목록 + 짧은 폰(스테이지 ${Math.round(stageH)}px)에서 내 이름표가 스테이지 위로 올라감(판정 아님)`, true, `위로 ${over}px, 이름표 ${JSON.stringify(n.myTag)}, 스테이지 ${JSON.stringify(n.stage)}`, true);
    return;
  }
  recTagInStage(rec, sc, id, who, n);
}

/** 얼굴 칸을 눌러 눌림(aria-pressed)이 될 때까지 기다린다 */
async function tapFace(page, seat) {
  await page.locator(`[data-face="${seat}"]`).click({ timeout: 4000 });
  await page.waitForSelector(`[data-face="${seat}"][aria-pressed="true"]`, { timeout: 3000 });
}

/** 구출: 방장 의사가 봇 마피아의 대상(가장 낮은 seat 의 산 비마피아 = 방장 자신, seat 0)을 얼굴 목록에서 골라 막는다 → 아침 '누군가 살아났습니다', 분필·카드 없음 (MORN-03, NIGHT-09, L10) */
async function nightSaved(ctx, shared) {
  const id = "night";
  const sc = `${id}/saved`;
  const rec = recorder(ctx);
  const { game, g } = await openNight(ctx, id, { guests: 0, bots: 5, role: "doctor" });
  try {
    const { host, hp, ht, hostSeat } = game;
    const view = ht.last();
    if (hostSeat !== 0) throw new SetupError(`방장 자리가 0 이 아님 (${hostSeat})`);
    const n = await readNight(hp);
    rec(sc, "SV1", "내 직업이 의사다", view.me.role === "doctor", `직업 ${view.me.role}`);
    shared.dark.doctor = n.nightDark;
    sideChecks(rec, sc, "의사", n, g);
    faceListChecks(rec, sc, "의사", n, aliveOf(view).length);
    recTagInStageFaces(rec, sc, "SV2", "의사", n);
    await gameGH(ctx, id, "night-doctor", host);
    const tap = await attempt(async () => {
      await tapFace(hp, hostSeat);
    });
    rec(sc, "SV3", "얼굴 칸(나)을 누르면 눌림 표시", tap.ok, tap.detail);
    await tracker_pick(ht, hostSeat, rec, sc, "SV4");
    assertStillNight(ht);
    await armAnnounceWatch(hp);
    await skipTo(hp, ht, "morning");
    await untilGame(hp, (x) => x.phase === "morning", 6000, "아침 도착");
    const { log, morning } = await waitMorningAnnounce(hp, 6000);
    rec(sc, "SV5", "아침 알림이 '누군가 살아났습니다' 이다", morning?.text === MORNING_SAVED, `알림 ${log.filter((a) => a.text).map((a) => a.text).join(" → ") || "없음"}`);
    if (morning) recMany(rec, sc, announceChecks(morning), " (구출)");
    await sleep(3300); // 카드 공개(2.8초)가 지난 뒤에도 없어야 한다
    const after = await readNight(hp);
    rec(sc, "SV6", "구출한 아침에는 분필이 없다", after?.chalk === null, `chalk ${after?.chalk}`);
    rec(sc, "SV7", "구출한 아침에는 유언·쪽지 카드가 없다", (after?.cards.length ?? -1) === 0, `카드 ${JSON.stringify(after?.cards)}`);
    rec(sc, "SV8", "구출한 아침에는 암살 번쩍임이 없다", (await readSeen(hp)).kill === 0, `번쩍임 ${(await readSeen(hp)).kill}회`);
    rec(sc, "SV9", "구출한 아침에도 방장은 산 사람이다(유령 화면이 아니다)", after?.ghostView === false && aliveOf(ht.last()).includes(hostSeat), `유령 화면 ${after?.ghostView}`);
  } finally {
    await closeGame(game);
  }
}

/** 내 선택이 서버 view(me.pick)에 반영됐는지 */
async function tracker_pick(ht, seat, rec, sc, id) {
  const r = await attempt(async () => {
    await ht.waitFor((v) => v.me.pick === seat, 3000, "서버가 내 선택을 돌려줌");
  });
  rec(sc, id, "서버가 내 선택(me.pick)을 같은 자리로 돌려준다", r.ok, r.detail);
}

/** 불일치: 봇 마피아가 먼저 고른 뒤 방장 마피아가 다른 대상을 고르면 확정이 없다 → 아침 '아무 일도 없었습니다' (NIGHT-08, MORN-03) */
async function nightMismatch(ctx) {
  const id = "night";
  const sc = `${id}/mismatch`;
  const rec = recorder(ctx);
  const { game, g } = await openNight(ctx, id, { guests: 0, bots: 5, role: "mafia" });
  try {
    const { hp, ht } = game;
    // 봇은 실행 시점에 동료를 따라간다 — 방장이 먼저 고르면 같은 대상이 되므로, 봇이 고른 것을 me.nightTally 로 확인한 뒤 다른 대상을 누른다(가정 A2)
    const botPick = await attempt(async () => {
      await ht.waitFor((v) => (v.me.nightTally ?? []).some((t) => t.n >= 1), 9000, "봇 마피아의 선택");
    });
    rec(sc, "MM1", "봇 마피아가 먼저 대상을 고른다(me.nightTally)", botPick.ok, botPick.detail);
    const botSeat = (ht.last().me.nightTally ?? []).find((t) => t.n >= 1)?.seat;
    const other = g.picks.map((b) => b.seat).sort((a, b) => a - b).find((s) => s !== botSeat);
    if (botSeat === undefined || other === undefined) throw new SetupError("봇 선택 또는 다른 대상을 찾지 못함");
    const tap = await attempt(async () => {
      await tapPick(hp, other);
    });
    rec(sc, "MM2", `봇이 고른 자리(${botSeat})와 다른 자리(${other})를 눌러 눌림 표시`, tap.ok, tap.detail);
    await ht.waitFor((v) => (v.me.nightTally ?? []).filter((t) => t.n >= 1).length >= 2, 3000, "갈린 선택").catch(() => {});
    await sleep(300);
    const n = await readNight(hp);
    rec(sc, "MM3", "선택이 갈리면 확정 도장이 없고 [쪽지] 도 잠겨 있다", n?.sure === null && n?.noteButton?.disabled === true && ht.last().me.nightSure === undefined, `도장 ${JSON.stringify(n?.sure)}, 쪽지 ${JSON.stringify(n?.noteButton)}, nightSure ${ht.last().me.nightSure}`);
    assertStillNight(ht);
    await armAnnounceWatch(hp);
    await skipTo(hp, ht, "morning");
    await untilGame(hp, (x) => x.phase === "morning", 6000, "아침 도착");
    const { log, morning } = await waitMorningAnnounce(hp, 6000);
    rec(sc, "MM4", "아침 알림이 '아무 일도 없었습니다' 이다", morning?.text === "아무 일도 없었습니다", `알림 ${log.filter((a) => a.text).map((a) => a.text).join(" → ") || "없음"}`);
    await sleep(3300);
    const after = await readNight(hp);
    rec(sc, "MM5", "불일치한 아침에는 분필·카드가 없고 모두 산다", after?.chalk === null && (after?.cards.length ?? -1) === 0 && aliveOf(ht.last()).length === 6, `chalk ${after?.chalk}, 카드 ${after?.cards.length}, 산 사람 ${aliveOf(ht.last()).length}`);
  } finally {
    await closeGame(game);
  }
}

/** 경찰: 방장 경찰이 얼굴 목록에서 한 칸을 고르면 아침에 결과 카드(.mf-police-card)와 채팅 eye 카드가 같은 결과를 보인다. 봇 마피아가 방장을 노리므로 경찰이 당한 밤이어도 결과를 받는다 (NIGHT-09, 시민 편 DOM) */
async function nightPolice(ctx, shared) {
  const id = "night";
  const sc = `${id}/police`;
  const rec = recorder(ctx);
  const { game, g } = await openNight(ctx, id, { guests: 0, bots: 5, role: "police" });
  try {
    const { host, hp, ht, hostSeat } = game;
    const view = ht.last();
    const n = await readNight(hp);
    rec(sc, "PL1", "내 직업이 경찰이다", view.me.role === "police", `직업 ${view.me.role}`);
    shared.dark.police = n.nightDark;
    sideChecks(rec, sc, "경찰", n, g);
    faceListChecks(rec, sc, "경찰", n, aliveOf(view).length - 1);
    rec(sc, "PL2", "경찰 얼굴 목록에 내 칸이 없다", !n.faces.some((f) => f.seat === hostSeat), `칸 ${n.faces.map((f) => f.seat).join(",")}`);
    recTagInStageFaces(rec, sc, "PL3", "경찰", n);
    await gameGH(ctx, id, "night-police", host);
    const target = n.faces.map((f) => f.seat).sort((a, b) => a - b)[0];
    const tap = await attempt(async () => {
      await tapFace(hp, target);
    });
    rec(sc, "PL4", "얼굴 칸을 누르면 눌림 표시", tap.ok, tap.detail);
    await tracker_pick(ht, target, rec, sc, "PL5");
    assertStillNight(ht);
    await armSeenWatch(hp);
    await skipTo(hp, ht, "morning");
    await untilGame(hp, (x) => x.phase === "morning" || x.phase === "ended", 6000, "아침 도착");
    const seen = await attempt(async () => {
      const start = performance.now();
      for (;;) {
        const s = await readSeen(hp);
        if (s.police.length > 0) return true;
        if (performance.now() - start > 4000) return { ok: false, detail: "결과 카드가 나타나지 않음" };
        await sleep(100);
      }
    });
    const label = (await readSeen(hp)).police[0] ?? null;
    rec(sc, "PL6", "아침에 조사 결과 카드가 '마피아' 또는 '마피아 아님' 이다", seen.ok && (label === "마피아" || label === "마피아 아님"), `${seen.detail} 카드 글 ${label}`);
    const eye = await nightUntil(hp, (x) => x.cards.some((c) => c.kind === "eye"), 6000);
    const eyeText = eye?.cards.find((c) => c.kind === "eye")?.text ?? null;
    rec(sc, "PL7", "채팅에 조사 카드([data-card=eye])가 있고 같은 결과다", !!eyeText && label !== null && eyeText.includes(label) && (label === "마피아" ? !eyeText.includes("마피아 아님") : true), `카드 글 ${eyeText}, 결과 카드 ${label}`);
  } finally {
    await closeGame(game);
  }
}

/** 처형된 사람의 유언: 방장이 토론에 유언을 저장하고 봇이 방장을 처형하면 처형 단계 2.4초 뒤 산 손님 화면 채팅에 유언 카드가 나온다 (WILL-01, MORN-02) */
async function nightWill(ctx) {
  const id = "night";
  const sc = `${id}/will`;
  const rec = recorder(ctx);
  const game = await openGame(ctx, id, { guests: 1, bots: 4, role: "citizen", vote: { exec: "yes", pick: "host" }, to: "discussion" });
  try {
    const { hp, ht, guests } = game;
    const guest = guests[0];
    const WILL = "내 몫까지 이겨 줘요";
    const wrote = await attempt(async () => {
      await hp.locator("[data-will-button]").click({ timeout: 4000 });
      await writeSheet(hp, ht, "will", WILL);
    });
    rec(sc, "WL1", "토론에서 깃펜으로 유언을 쓰고 저장하면 서버가 같은 글을 돌려준다", wrote.ok, wrote.detail);
    await executeHost(game);
    const t0 = performance.now();
    const card = await attempt(async () => {
      for (;;) {
        const n = await readNight(guest.page).catch(() => null);
        if (n?.cards.some((c) => c.kind === "will" && c.text.includes(WILL))) return true;
        if (performance.now() - t0 > 6000) return { ok: false, detail: `카드 ${JSON.stringify(n?.cards ?? null)}` };
        await sleep(100);
      }
    });
    const seenAt = Math.round(performance.now() - t0);
    rec(sc, "WL2", "처형 단계에 산 손님 화면 채팅에 방장의 유언 카드가 나온다", card.ok, card.detail);
    infoRow(ctx, sc, "WL2k", "참고: 처형 단계에 닿은 뒤 카드가 보이기까지(2.4초 보류, 판정 아님)", `${seenAt}ms (닿은 시각은 다음 단계 넘기기 직후)`);
    const gn = await readNight(guest.page);
    rec(sc, "WL3", "손님 화면에는 쪽지 카드가 없다(처형에는 쪽지가 없다)", !gn?.cards.some((c) => c.kind === "note"), `카드 ${JSON.stringify(gn?.cards)}`);
    rec(sc, "WL4", "처형에는 분필이 없다", gn?.chalk === null, `chalk ${gn?.chalk}`);
  } finally {
    await closeGame(game);
  }
}

/** 피해자: 방장 시민이 봇 마피아에게 당한다(4명판 — 의사가 없어 반드시 죽는다). 처형 → 밤 → 아침을 자연 타이머로 지나며 막이 나타났다 사라지고, 아침에 번쩍임 한 번·'암살당했습니다'·유령 화면 (NIGHT-11, 시민 편 DOM) */
async function nightVictim(ctx, shared) {
  const id = "night";
  const sc = `${id}/victim`;
  const rec = recorder(ctx);
  const game = await openGame(ctx, id, { guests: 0, bots: 3, role: "citizen", vote: { exec: "no", pick: "other" }, to: "discussion" });
  try {
    const { host, hp, ht, hostSeat } = game;
    if (hostSeat !== 0) throw new SetupError(`방장 자리가 0 이 아님 (${hostSeat})`);
    await skipTo(hp, ht, "execution"); // 봇 반대 → '처형 없음', 처형 5초 뒤 서버 타이머로 밤이 된다
    await armSeenWatch(hp);
    await ht.waitFor((v) => v.phase === "night", 12_000, "처형 뒤 밤(서버 타이머)");
    const g = await untilGame(hp, (x) => x.phase === "night", 9000, "밤 도착");
    const curtainIn = await attempt(async () => {
      const start = performance.now();
      for (;;) {
        const s = await readSeen(hp);
        if (s.curtain >= 1 && s.curtainGone >= 1) return true;
        if (performance.now() - start > 4000) return { ok: false, detail: `막 나타남 ${s.curtain}회, 사라짐 ${s.curtainGone}회` };
        await sleep(100);
      }
    });
    rec(sc, "VC1", "밤 진입 때 장면 전환 막([data-curtain])이 나타났다 사라진다", curtainIn.ok, curtainIn.detail);
    await settle(hp);
    const n = await readNight(hp);
    rec(sc, "VC2", "내 직업이 시민이다", ht.last().me.role === "citizen", `직업 ${ht.last().me.role}`);
    shared.dark.citizen = n.nightDark;
    sideChecks(rec, sc, "시민", n, g);
    recNear(rec, sc, "VC3", "시민: 아래 패널 높이가 88 고정이다", n.panel?.height, gamePanelHeight(ctx.size.h, "nightCitizen"), 1);
    recTagInStage(rec, sc, "VC4", "시민", n);
    rec(sc, "VC5", "시민 밤 화면에는 얼굴 목록·쪽지 버튼이 없다", n.faceList === false && n.noteButton === null, `얼굴 목록 ${n.faceList}, 쪽지 ${JSON.stringify(n.noteButton)}`);
    await gameGH(ctx, id, "night-citizen", host);
    // 봇 마피아가 알람으로 방장(가장 낮은 seat)을 고른다. 밤 30초가 자연스럽게 끝나기를 기다린다
    await armAnnounceWatch(hp);
    await ht.waitFor((v) => v.phase === "morning", 40_000, "밤 뒤 아침(서버 타이머)");
    // 맥박 큐 시각 기록(window.__mfTension, ?e2e=1·개발 빌드만): 밤 30초 동안 2~4개(09-06 tension.ts)
    const cues = await hp.evaluate(() => window.__mfTension ?? null);
    rec(sc, "VC11", "시민 밤에 맥박 큐가 2~4개 기록된다(window.__mfTension)", Array.isArray(cues) && cues.length >= 2 && cues.length <= 4, `큐 ${Array.isArray(cues) ? cues.length : cues}개`);
    const { log, morning: victimAnn } = await waitMorningAnnounce(hp, 6000, /^암살당했습니다$/);
    rec(sc, "VC6", "피해자 본인 화면 알림이 '암살당했습니다' 이다", !!victimAnn, `알림 ${log.filter((a) => a.text).map((a) => a.text).join(" → ") || "없음"}`);
    if (victimAnn) recMany(rec, sc, announceChecks(victimAnn), " (피해자)");
    const kill = await attempt(async () => {
      const start = performance.now();
      for (;;) {
        const s = await readSeen(hp);
        if (s.kill >= 1) return true;
        if (performance.now() - start > 6000) return { ok: false, detail: "암살 번쩍임이 나타나지 않음" };
        await sleep(100);
      }
    });
    await sleep(1500);
    const seenNow = await readSeen(hp);
    rec(sc, "VC7", "아침에 암살 번쩍임([data-kill-fx])이 한 번 나타난다", kill.ok && seenNow.kill === 1, `${kill.detail} 나타난 횟수 ${seenNow.kill}`);
    await gameGH(ctx, id, "morning-victim", host);
    const ghost = await nightUntil(hp, (x) => x.ghostView, 9000);
    rec(sc, "VC9", "'암살당했습니다' 뒤 유령 화면([data-ghost-view])이 된다", !!ghost, "유령 화면이 되지 않음");
    if (ghost) {
      await settle(hp);
      await gameGH(ctx, id, "ghost", host);
    }
    const done = await nightUntil(hp, (x) => x.curtain === 0, 5000);
    rec(sc, "VC10", "막이 걷혀 DOM 에 남지 않는다", !!done, "막이 남아 있음");
    const seenEnd = await readSeen(hp);
    rec(sc, "VC8", "아침 진입 때도 막이 나타났다 사라진다(밤·아침 두 번)", seenEnd.curtain >= 2 && seenEnd.curtainGone >= 2, `막 나타남 ${seenEnd.curtain}회, 사라짐 ${seenEnd.curtainGone}회`);
  } finally {
    await closeGame(game);
  }
}

async function nightFlow(ctx) {
  const shared = { dark: {} };
  await nightScenario(ctx, () => nightAssassin(ctx));
  await nightScenario(ctx, () => nightSaved(ctx, shared));
  await nightScenario(ctx, () => nightMismatch(ctx));
  await nightScenario(ctx, () => nightWill(ctx));
  await nightScenario(ctx, () => nightPolice(ctx, shared));
  await nightScenario(ctx, () => nightVictim(ctx, shared));
  const rec = recorder(ctx);
  const d = shared.dark;
  rec("night/dom", "L6", "시민·경찰·의사 페이지의 data-night-dark 값이 같다", d.citizen === "true" && d.police === d.citizen && d.doctor === d.citizen, `시민 ${d.citizen}, 경찰 ${d.police}, 의사 ${d.doctor}`);
}

// ---- night-sizes: 폰 크기 6종에서 밤마다 내 이름표가 스테이지 안에 완전히 들어오고 마피아 이름표 버튼이 44×44 이상이다 (NIGHT-07, NIGHT-09, L10) ----
// 한 판의 밤 한 장씩만 읽는다(크기마다 마피아·경찰·시민 세 판). 흐름 본체(night)가 시나리오를 보고 이 흐름은 기하만 본다. 문턱은 낮추지 않는다.

async function nightSizesFlow(ctx) {
  const id = "night-sizes";
  const rec = recorder(ctx);
  const h = ctx.size.h;
  await nightScenario(ctx, async () => {
    const sc = `${id}/mafia`;
    const { game, g } = await openNight(ctx, id, { guests: 0, bots: 5, role: "mafia" });
    try {
      const n = await readNight(game.hp);
      rec(sc, "SZ1", "마피아: 이름표 선택 버튼이 있다", g.picks.length > 0, `버튼 ${g.picks.length}개`);
      recMany(rec, sc, pickButtonChecks(g.picks), " (마피아 밤)");
      recTagInStage(rec, sc, "SZ2", "마피아", n);
      panelRow(rec, sc, "SZ3", g, h, "nightMafia", "마피아 밤");
    } finally {
      await closeGame(game);
    }
  });
  await nightScenario(ctx, async () => {
    const sc = `${id}/police`;
    const { game, g } = await openNight(ctx, id, { guests: 0, bots: 5, role: "police" });
    try {
      const n = await readNight(game.hp);
      sideChecks(rec, sc, "경찰", n, g);
      faceListChecks(rec, sc, "경찰", n, aliveOf(game.ht.last()).length - 1);
      recTagInStageFaces(rec, sc, "SZ4", "경찰", n);
    } finally {
      await closeGame(game);
    }
  });
  await nightScenario(ctx, async () => {
    const sc = `${id}/citizen`;
    const { game, g } = await openNight(ctx, id, { guests: 0, bots: 3, role: "citizen" });
    try {
      const n = await readNight(game.hp);
      sideChecks(rec, sc, "시민", n, g);
      recNear(rec, sc, "SZ5", "시민: 아래 패널 높이가 88 고정이다", n.panel?.height, gamePanelHeight(h, "nightCitizen"), 1);
      recTagInStage(rec, sc, "SZ6", "시민", n);
    } finally {
      await closeGame(game);
    }
  });
}

// ---- result: 새 흐름으로 끝까지 가 결과 화면(시민 승·마피아 승 각 한 번) ----

/** 단계 이름을 오류 첫 줄에 붙인다(어느 조작에서 멈췄는지 결과 표에서 바로 보이게). SetupError 는 SetupError 로 다시 던진다. */
async function step(name, fn) {
  try {
    return await fn();
  } catch (e) {
    const msg = `${name}: ${String(e instanceof Error ? e.message : e).split("\n")[0]}`;
    throw e instanceof SetupError ? new SetupError(msg) : new Error(msg);
  }
}

/** ended 까지 넘긴다. 부하로 느려져 마감이 먼저 지나 이미 ended 면(시트 버튼이 없다) 그대로 둔다. */
async function toEnded(game) {
  if (game.ht.last().phase === "ended") return;
  try {
    await skipTo(game.hp, game.ht, "ended");
  } catch (e) {
    if (game.ht.last().phase !== "ended") throw e;
  }
}

const summaryRowsOf = (summary) => (summary ?? []).reduce((n, row) => n + (row.exec ? 1 : 0) + (row.night ? 1 : 0), 0);

async function resultState(ctx, id, game, { winner, n }) {
  const rec = recorder(ctx);
  const sc = `${id}/ended`;
  const { hp, ht } = game;
  await ht.waitFor((v) => v.phase === "ended", 8000, "종료 도달");
  try {
    await hp.waitForSelector('.mf-result[data-stage="done"]', { state: "attached", timeout: 8000 });
  } catch {
    throw new SetupError("결과 화면 공개 연출(data-stage=done)이 끝나지 않음");
  }
  const view = ht.last();
  rec(sc, "P8", "서버가 정한 승자·요약이 view 에 있음", view.result?.winner === winner && Array.isArray(view.result?.summary), `view.result.winner ${view.result?.winner} ≠ ${winner}`);
  await checkState(ctx, id, `ended-${winner}`, game.host);
  // [처음으로] 가 스크롤 없이 화면 안인지 폰 6종 크기로 바꿔 가며 잰다(09-29, feedback-6). readResult 는 버튼을 스크롤해 보이게 하므로 그보다 먼저 잰다.
  const back = hp.viewportSize() ?? { width: GAME_SIZE.w, height: GAME_SIZE.h };
  try {
    for (const size of LOBBY_SIZES) {
      await hp.setViewportSize({ width: size.w, height: size.h });
      await hp.waitForTimeout(250);
      recOne(rec, `${sc}/${size.label}`, resultFitChecks(await readResultFit(hp), size));
    }
  } finally {
    await hp.setViewportSize(back);
    await hp.waitForTimeout(250);
  }
  recOne(rec, sc, resultChecks(await readResult(hp), { winner, n, summaryRows: summaryRowsOf(view.result?.summary) }));
}

async function resultFlow(ctx) {
  const id = "result";
  // 시민 승: 방장 마피아 + 봇 3(전부 방장을 가리키고 찬성) → 방장이 처형되어 마피아가 없다
  {
    const game = await openGame(ctx, id, { guests: 0, bots: 3, role: "mafia", vote: { exec: "yes", pick: "host" }, to: "nomination" });
    try {
      await step("시민 승 defense", () => skipTo(game.hp, game.ht, "defense"));
      await step("시민 승 verdict", () => skipTo(game.hp, game.ht, "verdict"));
      await step("시민 승 execution", () => skipTo(game.hp, game.ht, "execution"));
      await step("시민 승 ended", () => toEnded(game));
      await resultState(ctx, id, game, { winner: "citizenWin", n: 4 });
    } finally {
      await closeGame(game);
    }
  }
  // 마피아 승: 방장 마피아 + 봇 3(방장 아닌 사람을 가리키고 찬성) → 낮에 시민 한 명이 처형, 밤에 방장이 한 명을 지목해 1 대 1
  {
    const game = await openGame(ctx, id, { guests: 0, bots: 3, role: "mafia", vote: { exec: "yes", pick: "other" }, to: "nomination" });
    try {
      const { hp, ht, hostSeat } = game;
      await skipTo(hp, ht, "defense");
      await skipTo(hp, ht, "verdict");
      await untilGame(hp, (g) => g.phase === "verdict" && g.verdictBtns.length === 2, 6000, "찬반 도착");
      await chooseVerdict(hp, true);
      await skipTo(hp, ht, "night");
      const g = await untilGame(hp, (x) => x.phase === "night" && x.picks.length > 0, 9000, "밤 도착(지목 버튼)");
      const alive = aliveOf(ht.last());
      if (alive.length !== 3 || !alive.includes(hostSeat)) throw new SetupError(`처형 뒤 생존자가 방장 포함 3명이 아님 (${alive.join(",")})`);
      await tapPick(hp, g.picks.find((b) => b.seat !== hostSeat).seat); // 4명판에는 의사가 없어 반드시 죽는다
      await skipTo(hp, ht, "morning");
      await toEnded(game);
      await resultState(ctx, id, game, { winner: "mafiaWin", n: 4 });
    } finally {
      await closeGame(game);
    }
  }
}

// ---- chat-game: 지목·찬반·처형·아침에 채팅 입력줄이 있고 줄이 오가며, 유령 줄은 산 사람 화면에 없다 (07 D1 이월 해소) ----

const CHAT_TEXTS = { nomination: "지목은 신중하게 해요", verdict: "찬반은 조용히 골라요", execution: "처형 단계에서도 말해요", morning: "아침이 밝았어요", ghost: "나는 유령이에요" };

async function chatGameFlow(ctx) {
  const id = "chat-game";
  const rec = recorder(ctx);
  const game = await openGame(ctx, id, { guests: 2, bots: 4, role: "citizen", vote: { exec: "yes", pick: "host" }, to: "nomination" });
  try {
    const { hp, ht, hostSeat, guests } = game;
    const [g1, g2] = guests;
    const send = async (sc, cid, label, from, to, text) => {
      const r = await attempt(async () => {
        await typeAndSendChat(from.page, text);
        await Promise.all(to.map((t) => waitChatLine(t.page, text)));
      });
      rec(sc, cid, label, r.ok, r.detail);
    };
    const inputs = async (sc, cid, label, pages) => {
      const gs = await Promise.all(pages.map((p) => readGame(p)));
      rec(sc, cid, label, gs.every((g) => g.hasInput), `입력줄 ${gs.map((g) => g.hasInput).join("/")}`);
    };

    // 지목
    await allAt([hp, g1.page, g2.page], "nomination");
    await inputs(`${id}/nomination`, "CG1", "지목 단계에 채팅 입력줄이 있다(방장·손님 둘)", [hp, g1.page, g2.page]);
    await send(`${id}/nomination`, "CG2", "지목 단계에서 보낸 줄이 다른 산 사람 화면에 보인다", { page: hp }, [g1, g2], CHAT_TEXTS.nomination);

    // 찬반
    await skipTo(hp, ht, "defense");
    await skipTo(hp, ht, "verdict");
    await allAt([hp, g1.page, g2.page], "verdict");
    await inputs(`${id}/verdict`, "CG3", "찬반 단계에 채팅 입력줄이 있다(투표자·변론자)", [hp, g1.page, g2.page]);
    await send(`${id}/verdict`, "CG4", "찬반 단계에서 투표자가 보낸 줄이 변론자 화면에 보인다", g2, [{ page: hp }, g1], CHAT_TEXTS.verdict);
    for (const g of guests) await chooseVerdict(g.page, true).catch(() => {});

    // 처형
    await skipTo(hp, ht, "execution");
    await allAt([g1.page, g2.page], "execution");
    await inputs(`${id}/execution`, "CG5", "처형 단계에 산 사람 채팅 입력줄이 있다", [g1.page, g2.page]);
    await send(`${id}/execution`, "CG6", "처형 단계에서 보낸 줄이 다른 산 사람 화면에 보인다", g1, [g2], CHAT_TEXTS.execution);

    // 유령(처형된 방장)의 줄은 산 사람 화면에 없다
    {
      const sc = `${id}/ghost`;
      await untilGame(hp, (x) => x.ghostView, 9000, "유령 화면");
      const sent = await attempt(async () => {
        await typeAndSendChat(hp, CHAT_TEXTS.ghost);
        await waitChatLine(hp, CHAT_TEXTS.ghost);
      });
      rec(sc, "CG7", "유령은 유령 채널로 줄을 보낼 수 있다", sent.ok, sent.detail);
      await sleep(1500);
      const seen = await Promise.all([g1, g2].map(async (g) => ((await readChatLines(g.page)) ?? []).some((l) => l.text === CHAT_TEXTS.ghost)));
      rec(sc, "CG8", "유령 줄이 산 사람 화면에 없다", seen.every((s) => !s), `보인 손님 ${seen.map((s, i) => (s ? i + 1 : null)).filter(Boolean).join(",") || "없음"}`);
      const gg = await Promise.all([g1, g2].map((g) => readGame(g.page)));
      const leak = gg.map((g) => ghostDomChecks(g.counts)).flat().filter((l) => !l.ok);
      rec(sc, "CG9", "산 사람 화면에 유령 표식·문구가 없다", leak.length === 0, leak.map((l) => l.detail).join("; "));
    }

    // 아침: 산 사람 손님 중 둘이 있으면 한 줄이 오간다(밤에 한 명이 죽었을 수 있어 산 손님만 쓴다)
    {
      const sc = `${id}/morning`;
      await skipTo(hp, ht, "morning");
      await untilGame(hp, (x) => x.phase === "morning", 6000, "아침 도착");
      const view = ht.last();
      const aliveGuests = guests.filter((g) => aliveOf(view).includes(g.seat));
      await Promise.all(aliveGuests.map((g) => untilGame(g.page, (x) => x.phase === "morning", 6000, "아침 도착(손님)")));
      await inputs(sc, "CG10", "아침에 산 사람 채팅 입력줄이 있다", aliveGuests.map((g) => g.page));
      if (aliveGuests.length >= 2) await send(sc, "CG11", "아침에 보낸 줄이 다른 산 사람 화면에 보인다", aliveGuests[0], [aliveGuests[1]], CHAT_TEXTS.morning);
      else infoRow(ctx, sc, "CG11", "아침 줄 주고받기(참고)", `밤에 손님이 죽어 산 손님이 ${aliveGuests.length}명 — 입력줄 확인만`);
      void hostSeat;
    }
  } finally {
    await closeGame(game);
  }
}

// ---- pc (05-07, D-11, UI-SPEC 11.3c): 1280x800 데스크톱 창에서 앱이 가운데 폰 폭 ----

/** `#root` 의 왼쪽·폭을 읽는다(#root 안에 화면이 그려진 뒤). */
async function readRootRect(page) {
  await page.waitForSelector("#root > *", { timeout: 8000 });
  return page.evaluate(() => {
    const r = document.querySelector("#root").getBoundingClientRect();
    return { rootLeft: r.left, rootWidth: r.width };
  });
}

async function pcFlow(ctx) {
  const rec = recorder(ctx);
  const { w, h } = ctx.size;
  const dpr = ctx.shots ? 2 : 1;
  let home = null;
  try {
    // ① 홈: 방 없이, 모바일이 아닌 데스크톱 창
    home = await ctx.browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: false, hasTouch: false, locale: "ko-KR" });
    const homePage = await home.newPage();
    homePage.setDefaultTimeout(8000);
    await homePage.goto(`${ctx.origin}/`, { waitUntil: "domcontentloaded" });
    const homeRect = await readRootRect(homePage);
    await settle(homePage);
    recOne(rec, "pc/home", pcCenterChecks({ ...homeRect, where: "홈" }, { w }));
  } finally {
    await home?.close().catch(() => {});
  }

  // ② 대기실
  const host = await startHost(ctx, "pc");
  const { page, tracker } = host;
  await settle(page);
  recOne(rec, "pc/lobby", pcCenterChecks({ ...(await readRootRect(page)), where: "대기실" }, { w }));
  await checkState(ctx, "pc", "lobby");

  // ③ 낮(discussion): 봇 3명 → 시작 → 첫 낮 토론
  await openTestSheet(page);
  await setBots(page, tracker, 3);
  await startGame(page, tracker);
  await skipTo(page, tracker, "discussion");
  await settle(page);
  ctx.stage = "play";
  recOne(rec, "pc/day", pcCenterChecks({ ...(await readRootRect(page)), where: "낮" }, { w }));
  await checkState(ctx, "pc", "day");

  await resetAndLeave(page, tracker);
}

// ---- wakelock (05-07, D-12·D-13, UI-SPEC 12): 화면 켜짐 유지 API 가 없을 때·요청을 셀 때 ----

/** 미지원 모의: Navigator.prototype 의 wakeLock 을 지워 `"wakeLock" in navigator` 가 거짓이 되게 한다(앱 스크립트보다 먼저). */
function removeWakeLockInit() {
  try {
    delete Navigator.prototype.wakeLock;
  } catch {
    /* 지울 수 없으면 hasApi 가 참이 되어 WL1 이 모의 실패로 보고한다 */
  }
}

/** 스파이: request 호출을 세고 EventTarget 기반 가짜 sentinel(released·release()) 을 돌려준다. 가려짐은 visibilityState 게터를 바꿔 흉내 낸다. */
function spyWakeLockInit() {
  const spy = {
    requests: 0,
    sentinels: [],
    /** 잡고 있던 가짜 잠금을 모두 풀린 상태로 만들고 release 이벤트를 보낸다(시스템이 잠금을 거둔 것처럼). */
    dropAll() {
      for (const s of spy.sentinels) {
        if (s.released) continue;
        s.released = true;
        s.dispatchEvent(new Event("release"));
      }
    },
    /** document 가림/보임 흉내: state 가 "hidden" 이면 게터를 바꾸고, "visible" 이면 게터를 지운다. 둘 다 visibilitychange 를 보낸다. */
    setVisibility(state) {
      if (state === "hidden") Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
      else delete document.visibilityState;
      document.dispatchEvent(new Event("visibilitychange"));
    },
  };
  window.__mfWakeLock = spy;
  const fake = {
    request() {
      spy.requests += 1;
      const s = new EventTarget();
      s.type = "screen";
      s.released = false;
      s.release = () => {
        if (!s.released) {
          s.released = true;
          s.dispatchEvent(new Event("release"));
        }
        return Promise.resolve();
      };
      spy.sentinels.push(s);
      return Promise.resolve(s);
    },
  };
  Object.defineProperty(navigator, "wakeLock", { configurable: true, get: () => fake });
}

/** 방 하나 만들고 방장 페이지를 연다(init 스크립트 포함). 토큰은 ctx.secrets 에 넣어 출력에서 가린다(T-05-16). */
async function openWakeRoom(ctx, initScripts) {
  const room = await createTestRoom(ctx.origin, HOST_NICK);
  ctx.secrets.push(room.token);
  ctx.roomCode = room.code;
  const host = await openHostPage(ctx.browser, { origin: ctx.origin, code: room.code, token: room.token, size: ctx.size, dpr: ctx.shots ? 2 : 1, initScripts });
  ctx.host = host;
  return host;
}

async function wakeLockFlow(ctx) {
  const rec = recorder(ctx);
  // WL1: 미지원 브라우저 — 대기실 → 배정 → 역할 확인 → 낮 토론까지 정상, 콘솔 오류 0
  const first = await openWakeRoom(ctx, [removeWakeLockInit]);
  try {
    const { page, tracker } = first;
    await settle(page);
    const hasApi = await page.evaluate(() => "wakeLock" in navigator);
    await openTestSheet(page);
    await setBots(page, tracker, 3);
    await startGame(page, tracker);
    await skipTo(page, tracker, "discussion");
    await settle(page);
    ctx.stage = "play";
    const reachedPhase = tracker.last()?.phase === "discussion";
    const consoleErrors = first.takeIssues().console;
    recOne(rec, "wakelock/unsupported", wakeLockChecks({ hasApi, reachedPhase, consoleErrors }, { mode: "unsupported" }));
    await resetAndLeave(page, tracker);
  } finally {
    await first.context.close().catch(() => {});
  }

  // WL2: 요청을 세는 가짜 — 대기실 진입 요청 ≥ 1, 잠금이 풀린 뒤 가림 → 보임 복귀에 정확히 1회 더
  const second = await openWakeRoom(ctx, [spyWakeLockInit]);
  const { page: p2 } = second;
  await settle(p2);
  const readRequests = () => p2.evaluate(() => window.__mfWakeLock?.requests ?? -1);
  const atLobbyWait = await attempt(async () => {
    await p2.waitForFunction(() => (window.__mfWakeLock?.requests ?? 0) >= 1, null, { timeout: 3000 });
  });
  await sleep(300); // 늦게 오는 요청이 증가분에 섞이지 않게 한 템포 쉰다
  const requestsAtLobby = await readRequests();
  await p2.evaluate(() => {
    const spy = window.__mfWakeLock;
    spy.dropAll();
    spy.setVisibility("hidden");
    spy.setVisibility("visible");
  });
  await sleep(200);
  const requestsAfterVisible = await readRequests();
  const wl2 = wakeLockChecks({ requestsAtLobby, requestsAfterVisible }, { mode: "spy" });
  rec("wakelock/spy", wl2.id, wl2.label, wl2.ok && atLobbyWait.ok, wl2.ok ? atLobbyWait.detail : `${wl2.detail}${atLobbyWait.ok ? "" : ` / ${atLobbyWait.detail}`}`);
  await leaveLobby(p2);
}

export const FLOWS = [
  // lobby·world 는 LOBBY_SIZES 6개 크기로 돈다: 기본 크기 4개에 더해 390x844·402x874 (run.mjs 의 extraSizes)
  { id: "lobby", run: lobbyFlow, extraSizes: LOBBY_EXTRA_SIZES },
  { id: "world", run: worldFlow, extraSizes: LOBBY_EXTRA_SIZES },
  // 로비 자유 채팅(07-13): 방장·손님 두 페이지로 한 줄이 오가는 트레이서
  { id: "chat-lobby", run: chatLobbyFlow, extraSizes: LOBBY_EXTRA_SIZES },
  // 한글 조합(07-19): CDP imeSetComposition 으로 조합 중 Enter·보내기가 한 번만 보내진다. 크기와 무관해서 자기 크기로 한 번만 돈다
  { id: "chat-ime", run: chatImeFlow, size: { w: 390, h: 844, label: "390x844" } },
  // 가상 키보드(07-19): 입력칸 포커스 + 가짜 visualViewport 로 패널·캔버스·카메라·D4 를 본다. 큰 폰 3종은 이름표까지, 작은 폰 3종은 캐릭터 몸만(가정 A2)
  { id: "chat-keyboard", run: chatKeyboardFlow, extraSizes: LOBBY_EXTRA_SIZES },
  // 맵 게임 흐름(08-24): day·ghost 는 폰 크기 6종, 나머지는 자기 크기로 한 번. 단계는 테스트 방 다음 단계와 봇 투표 규칙으로 넘긴다
  { id: "day", run: dayFlow, extraSizes: LOBBY_EXTRA_SIZES },
  { id: "ghost", run: ghostFlow, extraSizes: LOBBY_EXTRA_SIZES },
  { id: "noexec", run: noexecFlow, size: GAME_SIZE },
  // 9페이즈 밤·아침(09-22): night = 시나리오(암살·구출·불일치·처형 유언·경찰·피해자)와 시민 편 DOM·G/H 는 승인 보드 폭 한 번, night-sizes = 폰 크기 6종 기하
  { id: "night", run: nightFlow, size: GAME_SIZE },
  { id: "night-sizes", run: nightSizesFlow, extraSizes: LOBBY_EXTRA_SIZES },
  { id: "result", run: resultFlow, size: GAME_SIZE },
  { id: "chat-game", run: chatGameFlow, size: GAME_SIZE },
  // 재접속·예산(06-18): 폰 크기와 곱하지 않고 자기 크기로 한 번. deployhold 는 배포와 동시에 돌리는 흐름(06-19)이라 --only 없이는 빠진다
  { id: "reconnect", run: reconnectFlow, size: RECONNECT_SIZE },
  { id: "deployhold", run: deployHoldFlow, size: RECONNECT_SIZE, skipByDefault: true },
  { id: "perfbudget", run: perfBudgetFlow, size: PERF_SIZE },
  // 크기 고정 흐름(05-07): 폰 크기와 무관해서 크기 목록과 곱하지 않고 자기 크기로 한 번만 돈다
  { id: "pc", run: pcFlow, size: { w: 1280, h: 800, label: "1280x800", mobile: false } },
  { id: "wakelock", run: wakeLockFlow, size: { w: 360, h: 640, label: "360x640" } },
];
export { SetupError };
