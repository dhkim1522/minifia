// 화면 E2E 흐름(결정 0025): 흐름마다 새 테스트 방 하나와 방장 페이지 하나. 검사 ID 는 계획 261025-h1j 의 "검사 목록" 과 같다.
// 결과는 { scenario: "흐름/상태", size, id, label, ok, detail } 로 ctx.results 에 쌓인다.
import { join } from "node:path";
import { mkdirSync, readFileSync, utimesSync } from "node:fs";
import {
  SetupError,
  armAnnounceWatch,
  armLetterWatch,
  readLetter,
  readLetterWatch,
  chooseRole,
  chooseVerdict,
  pressEndDiscussion,
  readAnnounceWatch,
  readGame,
  readGhostOutfits,
  readGhostTagContrast,
  setBotVote,
  skipOnce,
  skipTo,
  tapPick,
  offScannerScript,
  readOffScan,
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
  basicOrderChecks,
  OFF_DEVICE_ATTR_PREFIX,
  OFF_DEVICE_SELECTORS,
  NOMINATION_MS,
  verdictPanelChecks,
  ANNOUNCE_MORNING_AT,
  LETTER_END_AT_MS,
  LETTER_FOLD_AT_MS,
  SEAL_GLYPH,
  externalPenFontRequests,
  graphemeCount,
  letterChecks,
  ownPenFontRequests,
} from "./lib.mjs";
import { makeAvatarFlows } from "./avatar.mjs";
import { makeMapSelectFlows } from "./mapselect.mjs";
import { awardChecks, readAwardState, readBenchView, readRematchState, readRestSheet, readResultStage, readResultTabs, readTimeline, rematchChecks, resultSkipChecks, resultStageChecks, resultTabChecks, timelineChecks } from "./result.mjs";
import { makePoliticsFlows } from "./politics.mjs";
import { makeSoundFlows } from "./sound.mjs";

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
  ctx.hostToken = room.token; // 방장이 끊겼다 돌아오는 흐름(host-handoff, 11-12)이 같은 자리로 다시 붙는 데만 쓴다. 출력에는 ctx.secrets 로 가려진다
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
async function openGuest(ctx, nickname, { initScripts = [], size = ctx.size } = {}) {
  const joined = await joinTestRoom(ctx.origin, ctx.roomCode, nickname);
  ctx.secrets.push(joined.token);
  const guest = await openHostPage(ctx.browser, { origin: ctx.origin, code: joined.code, token: joined.token, size, dpr: 1, mobile: ctx.size.mobile !== false, guest: true, initScripts });
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
    // 떠 있는 버튼(꾸미기 hanger, 10페이즈)·이름표가 덮은 칸은 후보에서 먼저 뺀 뒤 순위를 매긴다 — 가린 칸 때문에 먼 칸이 사라지면 기존 낮은 스테이지 규칙(1.5 단위·0.8초)이 적용된다(문턱은 그대로)
    const [allG, allH] = await Promise.all([hitsInputSurface(gp, onScreen), hitsInputSurface(hp, onScreen.map((c) => ({ sx: c.hx, sy: c.hy })))]);
    const open = onScreen.filter((_, i) => allG[i] && allH[i]);
    const { ranked, low, minWalkMs } = worldTapRanking(open, from);
    const target = ranked[0];
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
async function openGame(ctx, flowId, { guests = 0, bots = 3, role = "citizen", vote = { exec: "yes", pick: "host" }, to = "discussion", hostNick = undefined, guestInitScripts = [], guestSize = undefined, minBotNameChars = 0, hostInitScripts = [], guestNames = GAME_GUESTS } = {}) {
  const host = await startHost(ctx, flowId, { ...(hostNick ? { nickname: hostNick } : {}), ...(hostInitScripts.length > 0 ? { initScripts: hostInitScripts } : {}) });
  const { page: hp, tracker: ht } = host;
  const pages = [];
  for (let i = 0; i < guests; i++) {
    const { guest, seat } = await openGuest(ctx, guestNames[i], { initScripts: guestInitScripts, ...(guestSize ? { size: guestSize } : {}) });
    pages.push({ ...guest, seat });
  }
  await ht.waitFor((v) => v.players.length === guests + 1, 6000, `방장 쪽 인원 ${guests + 1}`);
  await openTestSheet(hp);
  if (bots > 0) await setBots(hp, ht, bots);
  // 봇 이름 길이는 1~8자 무작위(첫 봇만 8자)라, 가장 넓은 이름표·찬반 알약 모양이 필요한 흐름은 이름 글자 수 합이 찰 때까지 봇을 다시 앉힌다(최대 12번)
  for (let tries = 0; bots > 0 && minBotNameChars > 0 && tries < 12; tries++) {
    const total = ht.last().players.filter((p) => p.seat !== ht.last().me.seat).reduce((n, p) => n + graphemeCount(p.nickname), 0);
    if (total >= minBotNameChars) break;
    await setBots(hp, ht, 0);
    await setBots(hp, ht, bots);
  }
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

    // 동시 투표(13페이즈 기본판, 결정 0072): 제목 '투표', 시작 직후 이름표 깜빡임(3초 안에 멈춤), 이름표 버튼은 나를 뺀 산 사람 수(44×44·무가림),
    // 맵 탭은 move 를 보내지 않는다, 손님 셋이 방장을 누르면 눌림·득표 배지가 모든 페이지에서 같고 과반이면 선두·유력, 마음을 바꾸면 배지가 따라 바뀐다.
    // 검사 ID NM1~NM6 은 v2.0 동시 지목에서 되살렸고 NM7~NM10 이 13페이즈에서 더해졌다. 순차 차례 검사(NT*)는 이 흐름에서 뺐다(turnBlockChecks 는 lib 에 남는다). 판정 문턱은 그대로다.
    {
      const sc = `${id}/nomination`;
      await allAt(pages, "nomination");
      // NM8 시작 직후: 누를 수 있는 이름표(나를 뺀 산 사람)가 깜빡인다 — 첫 2.7초. 이어서 3.3초 뒤 모두 멈춘다
      const blinkOf = (p) => p.evaluate(() => document.querySelectorAll(".mv-tag.is-blink").length);
      const startedAt = ht.last().phaseEndsAt - ht.last().phaseDurationMs;
      const sinceStart = Date.now() - startedAt;
      const blinkNow = await Promise.all(pages.map((p) => blinkOf(p)));
      await Promise.all(pages.map((p) => settle(p)));
      for (const x of humans) {
        const g = await readGame(x.page);
        recMany(rec, sc, pickButtonChecks(g.picks), ` (${x.who})`);
        rec(sc, "NM1", `이름표 버튼은 나를 뺀 산 사람 ${N - 1}개 (${x.who})`, g.picks.length === N - 1 && !g.picks.some((b) => b.seat === x.tracker.last().me.seat), `버튼 ${g.picks.length}개`);
        panelRow(rec, sc, "NM2", g, h, "chat", x.who);
        rec(sc, "NM2b", `투표에는 토론 끝내기가 없다 (${x.who})`, g.end === null, `end ${JSON.stringify(g.end)}`);
        rec(sc, "NM7", `헤더 제목이 '투표' 다 (${x.who})`, g.title === "투표", `제목 '${g.title}'`);
        rec(sc, "NM10", `순차 차례 블록이 없고 어둡게 막이 꺼져 있다 (${x.who})`, g.turn === null && (g.dim === null || g.dim === "off"), `turn ${g.turn === null ? "없음" : "있음"}, dim ${g.dim}`);
      }
      rec(sc, "NM8", `투표 시작 직후(${Math.round(sinceStart)}ms) 누를 수 있는 이름표 ${N - 1}개가 깜빡인다`, blinkNow.every((c) => c === N - 1), `깜빡이는 이름표 ${blinkNow.join("/")}개 (기대 ${N - 1})`);
      const stopped = await attempt(async () => {
        const left = 3800 - (Date.now() - startedAt);
        if (left > 0) await sleep(left);
        const after = await Promise.all(pages.map((p) => blinkOf(p)));
        return after.every((c) => c === 0) ? true : { ok: false, detail: `3.8초 뒤에도 깜빡이는 이름표 ${after.join("/")}개` };
      });
      rec(sc, "NM8b", "깜빡임은 3초 안팎에 멈춘다", stopped.ok, stopped.detail);
      // 맵 탭: 버튼이 아닌 바닥을 눌러도 이동 요청이 없고 목적지 링이 새로 생기지 않는다
      const g0 = await readGame(hp);
      const target = g0.stage ? await findTapTarget(hp, g0.stage, hostSeat, ctx.size) : null;
      if (!target) rec(sc, "NM3", "투표에서는 맵 탭이 move 를 보내지 않는다(카메라 고정)", false, "탭할 목적지를 찾지 못함");
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
        rec(sc, "NM3", "투표에서는 맵 탭이 move 를 보내지 않는다(카메라 고정)", !!pt && ht.sentMoveAt.length === before && (ringAfter === null || ringAfter === ringBefore), `보낸 move ${ht.sentMoveAt.length - before}개, 링 ${ringBefore} → ${ringAfter}`);
      }
      // 손님 셋이 방장을 누른다
      for (let i = 0; i < guests.length; i++) {
        const r = await attempt(async () => {
          await tapPick(guests[i].page, hostSeat);
        });
        rec(sc, "NM4", `이름표 버튼을 누르면 눌림 표시 (${humans[i + 1].who})`, r.ok, r.detail);
      }
      const countsOf = async (seat) => Promise.all(pages.map(async (p) => (await readGame(p)).tags.find((t) => t.seat === seat)?.count ?? null));
      const counts = await attempt(async () => {
        for (const x of humans) await untilGame(x.page, (gm) => Number(gm.tags.find((t) => t.seat === hostSeat)?.count ?? 0) >= guests.length, 5000, `배지 ${guests.length}표`);
        await sleep(400);
        const finals = await countsOf(hostSeat);
        return finals.every((c) => c === String(guests.length)) ? true : { ok: false, detail: `페이지마다 득표 ${finals.join("/")} (기대 ${guests.length})` };
      });
      rec(sc, "NM5", `득표 배지(data-count)가 모든 페이지에서 ${guests.length} 이다`, counts.ok, counts.detail);
      const gm = await readGame(guests[0].page);
      const hostTag = gm.tags.find((t) => t.seat === hostSeat);
      rec(sc, "NM6", "내가 고른 사람의 이름표가 mine 표시이고, 과반이라 선두·유력 표시가 켜진다", !!hostTag?.mine && hostTag.lead && hostTag.sure, `mine ${hostTag?.mine}, lead ${hostTag?.lead}, sure ${hostTag?.sure}`);
      // NM9 마음 바꾸기(U-3): 손님1 이 손님2 로 바꾸면 모든 페이지 배지가 따라 바뀌고(방장 2·손님2 1), 다시 방장으로 되돌리면 3 으로 돌아온다
      {
        const other = guests[1].seat;
        await sleep(600); // 같은 연타 방어 간격(첫 표와 바꾸기 사이)
        const swapped = await attempt(async () => {
          await tapPick(guests[0].page, other);
          for (const x of humans) await untilGame(x.page, (g) => Number(g.tags.find((t) => t.seat === hostSeat)?.count ?? 0) === guests.length - 1 && Number(g.tags.find((t) => t.seat === other)?.count ?? 0) === 1, 5000, "바꾼 표");
          const hostC = await countsOf(hostSeat);
          const otherC = await countsOf(other);
          return hostC.every((c) => c === String(guests.length - 1)) && otherC.every((c) => c === "1") ? true : { ok: false, detail: `방장 ${hostC.join("/")}, 손님2 ${otherC.join("/")}` };
        });
        rec(sc, "NM9", "한 손님이 다른 사람으로 바꾸면 모든 페이지 득표 배지가 따라 바뀐다", swapped.ok, swapped.detail);
        // 서버는 한 사람의 표 바꾸기를 250ms 안에 되풀이하면 받지 않는다(POINT_MIN_INTERVAL_MS, 연타 방어) — 사람이 마음을 바꾸는 속도로 간격을 둔다
        await sleep(600);
        const back = await attempt(async () => {
          await tapPick(guests[0].page, hostSeat);
          try {
            for (const x of humans) await untilGame(x.page, (g) => Number(g.tags.find((t) => t.seat === hostSeat)?.count ?? 0) === guests.length && g.tags.find((t) => t.seat === other)?.count === null, 5000, "되돌린 표");
          } catch (e) {
            const hostC = await countsOf(hostSeat);
            const otherC = await countsOf(other);
            return { ok: false, detail: `${e.message} · 방장 ${hostC.join("/")}, 손님2 ${otherC.join("/")}, 지금 단계 ${ht.last().phase}` };
          }
        });
        rec(sc, "NM9b", "다시 방장으로 되돌리면 배지가 3표로 돌아오고 손님2 의 배지는 사라진다", back.ok, back.detail);
      }
      await gameGH(ctx, id, "nomination", host);
      await gameGH(ctx, id, "nomination-guest", guests[0]);
      await skipTo(hp, ht, "defense");
    }

    // 최후 변론: 변론자(방장)만 득표 배지가 남는다, 패널 채팅
    {
      const sc = `${id}/defense`;
      await allAt(pages, "defense");
      await Promise.all(pages.map((p) => settle(p)));
      for (const x of humans) {
        const g = await readGame(x.page);
        panelRow(rec, sc, "DF1", g, h, "chat", x.who);
        const withBadge = g.tags.filter((t) => t.count !== null).map((t) => t.seat);
        rec(sc, "DF2", `변론자 이름표만 득표 배지가 남는다 (${x.who})`, withBadge.length === 1 && withBadge[0] === hostSeat, `배지 자리 ${withBadge.join(",") || "없음"}`);
      }
    }

    // 찬반: 투표자(손님)는 고르기+숫자 LOG_H + 218, 보기(변론자 방장)는 숫자만 LOG_H + 126. 누르면 눌림, 던진 사람 이름표에 체크, 찬반 값은 어디에도 없다
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

/** 직업 → 의상 대응(앱 src/world/ghostOutfit.ts 의 표 사본, UI-SPEC B-2). 알 수 없으면 coat */
const GHOST_JOB_OUTFIT = { mafia: "mafia", police: "police", doctor: "doctor", citizen: "coat" };
const sortedEntries = (o) => Object.entries(o).map(([k, v]) => [Number(k), v]).sort((a, b) => a[0] - b[0]);

/** window.__mfGhostOutfits(e2e 전용 의상 표)를 읽어 유령 페이지의 의상 표가 탈락 좌석 전부의 spectate 직업 대응과 같아질 때까지 6초 기다린다. detail 에 좌석:직업→의상 을 남긴다 */
async function ghostOutfitMatch(hp, view) {
  const dead = view.players.filter((p) => p.alive === false).map((p) => p.seat);
  const jobs = Object.fromEntries(dead.map((seat) => [seat, view.spectate?.seats?.find((x) => x.seat === seat)?.job]));
  const want = Object.fromEntries(dead.map((seat) => [seat, GHOST_JOB_OUTFIT[jobs[seat]] ?? "coat"]));
  const label = dead.map((seat) => `${seat}:${jobs[seat]}→${want[seat]}`).join(", ");
  const r = await attempt(async () => {
    const start = performance.now();
    for (;;) {
      const o = await readGhostOutfits(hp);
      if (o.outfits !== null && JSON.stringify(sortedEntries(o.outfits)) === JSON.stringify(sortedEntries(want))) return;
      if (performance.now() - start > 6000) throw new Error(`기대 ${JSON.stringify(want)} · 실제 ${JSON.stringify(o.outfits)}`);
      await sleep(150);
    }
  });
  return { ...r, label };
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

    // 직업 의상(09.1-09, 결정 0063-2): 유령 페이지는 탈락 좌석마다 spectate 직업의 의상을 입고, 산 사람 페이지에는 의상 재료가 없다(L13)
    {
      const sc = `${id}/outfit`;
      const got = await ghostOutfitMatch(hp, ht.last());
      rec(sc, "GH14", "유령 페이지의 직업 의상 표가 탈락 좌석 전부와 spectate 직업 대응(마피아·경찰·의사 같은 이름, 시민 coat)과 같다", got.ok, got.ok ? got.label : got.detail, true);
      const dom = await readGhostOutfits(hp);
      rec(sc, "GH14b", "유령 페이지에도 의상은 DOM 속성이 아니다([data-ghost-outfit] 0개)", dom.domCount === 0, `DOM ${dom.domCount}개`);
      for (let i = 0; i < guests.length; i++) {
        const g = guests[i];
        if (!aliveOf(g.tracker.last()).includes(g.seat)) continue;
        const r = await readGhostOutfits(g.page);
        rec(sc, "GH15", `산 사람 페이지에는 직업 의상 표가 없거나 비어 있고 [data-ghost-outfit] 이 0개다 — L13 (손님${i + 1})`, (r.outfits === null || Object.keys(r.outfits).length === 0) && r.domCount === 0, `표 ${JSON.stringify(r.outfits)}, DOM ${r.domCount}개`);
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
      // 유령 이름표 글자 대비(09.1-09 판정): 이름표가 불투명이 되었으므로 4.5:1 이상이다. 문턱을 낮추지 않는다. GH9(참고 줄)는 이 줄로 대체됐다
      {
        // 유령은 떠다녀(±4px) 이름표가 프레임마다 움직인다 — 재는 동안만 모션 줄이기로 띄우기만 남겨 이름표 위치를 고정한다(판정 문턱은 그대로)
        await hp.emulateMedia({ reducedMotion: "reduce" });
        // 처형 알림 막(data-announce)이 걷힌 뒤에 잰다 — 막이 있으면 글자도 같이 어두워진다
        await hp.waitForFunction(() => !document.querySelector("[data-announce]"), null, { timeout: 9000 }).catch(() => {});
        await sleep(400);
        const pool = await readGhostTagContrast(hp).catch(() => []);
        await hp.emulateMedia({ reducedMotion: "no-preference" });
        const worst = pool.length > 0 ? Math.min(...pool.map((c) => c.ratio)) : null;
        const detail = pool.length === 0 ? "측정한 유령 이름표 없음" : pool.map((c) => `자리 ${c.seat} ${Math.round(c.ratio * 100) / 100}:1(불투명도 ${Math.round(c.opacity * 100) / 100}, 밝은 ${Math.round(c.hi * 1000) / 1000}, 어두운 ${Math.round(c.lo * 1000) / 1000})`).join(", ");
        rec(sc, "GH13", "유령 이름표 글자 대비가 4.5:1 이상이다(이름표는 불투명)", worst !== null && worst >= 4.5, detail, true);
        rec(sc, "GH13b", "유령 이름표 불투명도가 1 이다(이름표 면에 흐림이 없다)", pool.length > 0 && pool.every((c) => c.opacity === 1), detail, true);
      }
      // 밤에 더 죽은 사람이 있으면 그 직업 의상도 같은 표에 들어 있다(마피아·경찰·의사 의상까지 보인다)
      {
        const again = await ghostOutfitMatch(hp, ht.last());
        rec(sc, "GH14c", "다음 날에도 의상 표가 탈락 좌석 전부의 직업 대응과 같다(밤에 죽은 사람 포함)", again.ok, again.ok ? again.label : again.detail, true);
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
      const { ht, guests } = game;
      await armAnnounceWatch(guests[0].page);
      // 기본판 동시 투표(13페이즈): 사람 4명이 아무도 누르지 않으면 투표 15초(NOMINATION_MS)가 끝나고 0표라 변론 없이 밤으로 간다(넘기기로 건너뛰지 않는다)
      const toNight = await attempt(async () => {
        await ht.waitFor((v) => v.phase === "night", NOMINATION_MS + 8000, "아무도 안 고름 → 밤");
      });
      rec(sc, "NE0", `아무도 고르지 않으면 투표 ${NOMINATION_MS / 1000}초 뒤 변론 없이 밤으로 간다`, toNight.ok, toNight.detail);
      // 알림 기록에는 지목 시작 때 남은 '낮이 되었습니다' 가 먼저 들어 있을 수 있어 개수가 아니라 '처형 없음' 이 생길 때까지 기다린다
      let log = await readAnnounceWatch(guests[0].page, { stop: false });
      for (const start = performance.now(); annIndex(log, (t) => t === "처형 없음") < 0 && performance.now() - start < 5000; ) {
        await sleep(100);
        log = await readAnnounceWatch(guests[0].page, { stop: false });
      }
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
      // 기본판 동시 투표(13페이즈): 방장은 누르지 않는다. 봇 셋은 진입 2~8초 안에 모두 방장을 가리킨다. 봇 이름은 8자 고정이라 8자 이름 이름표 버튼의 기하도 본다.
      {
        const bsc = `${id}/bot-vote`;
        const started = ht.last().phaseEndsAt - ht.last().phaseDurationMs;
        const g = await untilGame(hp, (x) => x.picks.length === 3, 4000, "봇 이름표 버튼 3개");
        recMany(rec, bsc, pickButtonChecks(g.picks), " (봇 8자 이름 투표)");
        rec(bsc, "NE6", "투표 이름표 버튼은 봇 셋이고 순차 차례 블록은 없다", g.picks.length === 3 && g.turn === null, `버튼 ${g.picks.length}개, turn ${g.turn === null ? "없음" : "있음"}`);
        const voted = await attempt(async () => {
          await untilGame(hp, (x) => Number(x.tags.find((t) => t.seat === hostSeat)?.count ?? 0) >= 3, 9000, "봇 셋의 표");
        });
        const elapsed = Date.now() - started;
        rec(bsc, "NE7", "봇 셋이 모두 방장을 가리켜 방장 이름표 배지가 3 이 된다", voted.ok, voted.detail);
        rec(bsc, "NE8", "봇은 진입 2~8초 안에 던진다(모두 던질 때까지 9초 이하)", voted.ok && elapsed <= 9000, `${Math.round(elapsed)}ms`);
        await sleep(300);
        const g2 = await readGame(hp);
        const sum = g2.tags.reduce((a, t) => a + Number(t.count ?? 0), 0);
        rec(bsc, "NE9", "모든 이름표 득표 배지 합이 봇 수(3)다", sum === 3, `배지 합 ${sum}`);
      }
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

// ---- basic-off / basic-vote: 13페이즈 기본판(결정 0072) — 꺼진 장치 부재 검사와 8명 투표 화면 기하 ----

/** 한 판 안에서 가장 길게 보는 한도: 단계를 한 칸씩 넘기며 ended 에 닿기까지의 최대 칸 수(부하로 날이 길어져도 닿도록 넉넉히) */
const BASIC_OFF_MAX_STEPS = 90;

/**
 * basic-off (FLOW-03·FLOW-05, U-8): 방장 + 봇 5 의 테스트 방 한 판을 로비부터 결과까지 단계마다 한 칸씩 넘기며,
 * 꺼진 장치가 DOM(OFF_DEVICE_SELECTORS·data-turn* 속성, 100ms 감시)·받은 프레임(tracker.offKeys)·단계 순서·결과 탭 어디에도 없음을 본다.
 */
async function basicOffFlow(ctx) {
  const id = "basic-off";
  const rec = recorder(ctx);
  const game = await openGame(ctx, id, { guests: 0, bots: 5, role: "citizen", vote: { exec: "yes", pick: "other" }, to: null, hostInitScripts: [offScannerScript(OFF_DEVICE_SELECTORS, OFF_DEVICE_ATTR_PREFIX)] });
  try {
    const { hp, ht } = game;
    let endBtn = null;
    let steps = 0;
    // 한 칸씩: 로비 직후(assigning)부터 ended 까지. 첫 토론에서 [토론 끝내기] 개수를 센다(OFF5)
    while (ht.last().phase !== "ended" && steps < BASIC_OFF_MAX_STEPS) {
      const phase = await step(`${ht.last().phase} 다음 단계`, () => skipOnce(hp, ht));
      steps += 1;
      if (phase === "discussion" && endBtn === null) {
        await settle(hp);
        endBtn = await hp.locator("[data-end-discussion]").count();
      }
      await sleep(250); // 감시(100ms)가 이 단계 화면을 한 번은 보게
    }
    const toEnd = await attempt(async () => {
      if (ht.last().phase !== "ended") throw new Error(`${steps}칸을 넘겼는데 ${ht.last().phase} 에서 끝나지 않음`);
      await ht.waitFor((v) => v.phase === "ended" && v.result !== undefined, 10000, "결과 도달");
    });
    rec(`${id}/flow`, "OFF0", "테스트 방 봇 판이 로비부터 결과(ended)까지 닿는다 (FLOW-05)", toEnd.ok, toEnd.detail);
    if (!toEnd.ok) return;
    const shown = await attempt(async () => {
      await settledResult(hp);
    });
    // OFF1 DOM: 로비부터 결과 연출까지 감시가 한 번도 못 본 선택자
    const scan = await readOffScan(hp);
    const hits = scan === null ? null : Object.entries(scan.seen).map(([sel, v]) => `${sel} ${v.n}건(${v.phase})`);
    rec(`${id}/dom`, "OFF1", `꺼진 장치 선택자·${OFF_DEVICE_ATTR_PREFIX}* 속성이 한 판 전체에서 0건이다`, scan !== null && scan.scans > 20 && hits.length === 0, scan === null ? "감시 스크립트가 없음" : hits.length > 0 ? hits.join(", ") : `감시 ${scan.scans}회`);
    infoRow(ctx, `${id}/dom`, "OFF1i", "감시가 본 단계 열(참고)", scan === null ? "없음" : scan.phases.join(" → "));
    // OFF2 프레임: 받은 모든 state·chat 프레임의 꺼진 장치 키
    rec(`${id}/frames`, "OFF2", "받은 프레임에 players[].badge·badgeSwapped·day.turn·day.runoff·day.showdown·me.whisperUsed·me.ballot·귓속말 줄이 0건이다", ht.offKeys.length === 0, ht.offKeys.length === 0 ? `phase 열 ${ht.phases.length}개` : `처음 걸린 경로 ${ht.offKeys[0]} (전체 ${ht.offKeys.join(", ")})`);
    // OFF3 단계 순서
    recMany(rec, `${id}/order`, basicOrderChecks(ht.phases));
    rec(`${id}/order`, "OFF3b", "투표(nomination)·변론(defense)·찬반(verdict)·처형(execution)을 한 번 이상 지났다", ["nomination", "defense", "verdict", "execution", "night", "morning"].every((p) => ht.phases.includes(p)), `지난 단계 ${[...new Set(ht.phases)].join(",")}`);
    // OFF4 결과 화면: 탭은 있되 귓속말 탭이 없다
    const tabs = await hp.evaluate(() => ({ all: document.querySelectorAll("[data-result-tab]").length, whisper: document.querySelectorAll('[data-result-tab="whisper"]').length }));
    rec(`${id}/result`, "OFF4", "결과 화면에 탭이 있고 귓속말 탭(data-result-tab=whisper)이 없다", shown.ok && tabs.all > 0 && tabs.whisper === 0, shown.ok ? `탭 ${tabs.all}개, 귓속말 탭 ${tabs.whisper}개` : shown.detail);
    // OFF5 낮 토론에는 [토론 끝내기] 가 하나 있다(기본판 장치)
    rec(`${id}/discussion`, "OFF5", "토론 단계에 [토론 끝내기] 가 하나 있다", endBtn === 1, `[data-end-discussion] ${endBtn}개`);
  } finally {
    await closeGame(game);
  }
}

/** 8명판 투표 화면 시험용 손님 닉네임 일곱(모두 4자 — UI-SPEC "이름표 버튼 8개 … (4자 이름, 폰 6종)") */
const BASIC_VOTE_GUESTS = ["가나다라", "마바사아", "자차카타", "파하거너", "더러머버", "서어저처", "커터퍼허"];

/** 이름표가 모여 멈출 때까지 기다렸다 읽는다: 투표 15초 안에 걸어 모이므로(U-2) 버튼 사각형이 두 번 연속 같아질 때까지(최대 maxMs) 0.4초 간격으로 본다. */
async function readGameStable(page, maxMs = 11000) {
  const key = (g) => JSON.stringify(g.picks.map((b) => [b.seat, Math.round(b.rect.left), Math.round(b.rect.top)]));
  let prev = null;
  let g = await readGame(page);
  for (const t0 = performance.now(); performance.now() - t0 < maxMs; ) {
    const k = key(g);
    if (k === prev) return g;
    prev = k;
    await sleep(400);
    g = await readGame(page);
  }
  return g;
}

/**
 * basic-vote (FLOW-01, U-8): 8명(방장 + 사람 손님 7, 모두 4자 이름) 투표 화면의 기하. 이름표 버튼 7개가 44×44 이상·무가림(pickButtonChecks, 모여서 멈춘 뒤),
 * 묶음 G·H, 제목 '투표', 시간 링, 순차 블록 없음, 손님 일곱이 방장을 누르면 득표 배지 합 7 이고 표가 쌓인 뒤에도 기하가 유지된다.
 * 계획은 봇 7 이었으나 봇 이름은 첫 봇이 8자 고정이라 UI-SPEC 의 '4자 이름' 전제와 다르다 — 사람 손님으로 4자 이름을 만든다(결정 0052-3 과 같은 이유, SUMMARY 편차 참고).
 */
async function basicVoteFlow(ctx) {
  const id = "basic-vote";
  const rec = recorder(ctx);
  const sc = `${id}/nomination`;
  const game = await openGame(ctx, id, { guests: 7, bots: 0, role: "citizen", to: "nomination", guestNames: BASIC_VOTE_GUESTS, hostNick: GAME_HOST_NICK });
  try {
    const { host, hp, ht, hostSeat, guests } = game;
    await allAt([hp], "nomination");
    const g = await readGameStable(hp);
    rec(sc, "BV1", "이름표 버튼이 나를 뺀 산 사람 7개다", g.picks.length === 7 && !g.picks.some((b) => b.seat === hostSeat), `버튼 ${g.picks.length}개`);
    recMany(rec, sc, pickButtonChecks(g.picks), " (8명판, 모여서 멈춘 뒤)");
    const ring = await hp.evaluate(() => {
      const el = document.querySelector(".mf-game__header .mv-ring[role=timer]");
      const m = /(\d+)/.exec(el?.getAttribute("aria-label") ?? "");
      return el ? { seconds: m ? Number(m[1]) : null } : null;
    });
    rec(sc, "BV4", "헤더 제목이 '투표'이고 시간 링이 있다(남은 초 1~15)", g.title === "투표" && !!ring && ring.seconds !== null && ring.seconds >= 1 && ring.seconds <= 15, `제목 '${g.title}', 링 ${ring === null ? "없음" : `${ring.seconds}초`}`);
    rec(sc, "BV5", "순차 차례 블록([data-turn-block])이 없다", g.turn === null, `turn ${g.turn === null ? "없음" : "있음"}`);
    await gameGH(ctx, id, "nomination", host);
    // 손님 일곱이 방장을 누른다 → 모든 이름표 득표 배지 합 7, 방장 이름표 7표
    const voted = await attempt(async () => {
      for (const x of guests) await tapPick(x.page, hostSeat);
      await untilGame(hp, (gm) => Number(gm.tags.find((t) => t.seat === hostSeat)?.count ?? 0) >= 7, NOMINATION_MS, "손님 일곱의 표");
    });
    await sleep(300);
    const g2 = await readGameStable(hp, 4000);
    const sum = g2.tags.reduce((a, t) => a + Number(t.count ?? 0), 0);
    rec(sc, "BV6", "손님 일곱의 표가 모두 들어와 득표 배지 합이 7 이다", voted.ok && sum === 7, voted.ok ? `배지 합 ${sum}` : voted.detail);
    // 표가 쌓인 뒤(배지·선두·유력 표시가 붙은 상태)에도 같은 기하
    recMany(rec, `${sc}-voted`, pickButtonChecks(g2.picks), " (표가 쌓인 뒤)");
  } finally {
    await closeGame(game);
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
      aimTags: qa("[data-night-pick]").length,
      aimMarks: qa("[data-night-mark]").length,
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

/** 마피아 밤 선택 효과(결정 0065): 이름표마다 상태(data-night-pick)·버튼 클래스·표식·::after 테두리(스타일·굵기·색)를 읽는다 */
function readAim(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll(".mf-world__tag")].map((t) => {
      const b = t.querySelector("button.mf-world__pick");
      const cs = b ? getComputedStyle(b, "::after") : null;
      return {
        seat: Number(t.getAttribute("data-seat")),
        aim: t.getAttribute("data-night-pick"),
        cls: b ? b.className : null,
        mark: t.querySelector("[data-night-mark]") !== null,
        borderStyle: cs ? cs.borderTopStyle : null,
        borderWidth: cs ? parseFloat(cs.borderTopWidth) : null,
        borderColor: cs ? cs.borderTopColor : null,
      };
    }),
  );
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

/**
 * 아침 유언 편지 공통 검사(09.1-11, 결정 0063-3, UI-SPEC C-1~C-3): armLetterWatch 를 아침 전에 심어 둔 페이지에서 부른다. 편지가 걷힐 때까지 기다리고 돌려준다.
 * LT1 아침 진입 appearMaxMs 안에 편지가 나타남(T0 = 일반 0.4초·피해자 0.7초) · LT2 인장 글자가 SEAL_GLYPH · LT3 알림이 위(is-top)로 올라감 · LT4~LT8 letterChecks(등장·인장 애니메이션이 끝난 뒤 한 장)
 * LT9 채팅 유언 카드는 접힘(T0 + 5.0초) 때 나타남 · LT10 편지는 T0 + 5.42초에 걷힘 · LT11 Nanum 글꼴 외부 요청 0.
 * LT12: 머리글이 "{이름} 님의 유언" 이고 글 줄을 이으면 저장한 유언(wills 중 하나)과 같다(공백 제외).
 */
async function morningLetterChecks(ctx, sc, rec, game, { appearMaxMs, announceRe, wills, name }) {
  const { hp, host } = game;
  const appeared = await attempt(async () => {
    const start = performance.now();
    for (;;) {
      const w = await readLetterWatch(hp, { stop: false });
      if (w?.appearAt != null) return true;
      if (performance.now() - start > 5000) return { ok: false, detail: `편지가 나타나지 않음 (아침 진입 ${w?.morningAt != null})` };
      await sleep(100);
    }
  });
  let w = await readLetterWatch(hp, { stop: false });
  const after = w?.appearAt != null && w?.morningAt != null ? Math.round(w.appearAt - w.morningAt) : null;
  rec(sc, "LT1", `아침 진입 ${appearMaxMs / 1000}초 안에 유언 편지([data-will-letter])가 나타난다`, appeared.ok && after !== null && after <= appearMaxMs, `${appeared.detail} 아침 진입 → 편지 ${after}ms`);
  const glyphs = w?.sealGlyphs ?? null;
  rec(sc, "LT2", `인장 글자가 ${SEAL_GLYPH} 이다([data-will-seal] 글자 두 겹)`, Array.isArray(glyphs) && glyphs.length === 2 && glyphs.every((t) => t === SEAL_GLYPH), `글자 ${JSON.stringify(glyphs)}`);
  // 알림은 편지가 보이는 동안 위(is-top)로 올라가 있다. 위로 올라간 시각은 편지 등장 직후(같은 렌더 한두 개 뒤)다
  const topOk = await attempt(async () => {
    const start = performance.now();
    for (;;) {
      const x = await readLetterWatch(hp, { stop: false });
      if (x?.announceTopAt != null) return announceRe.test(x.announceText ?? "") ? true : { ok: false, detail: `알림 글자 ${x.announceText}` };
      if (performance.now() - start > 2000) return { ok: false, detail: "알림이 위(is-top)로 올라가지 않음" };
      await sleep(100);
    }
  });
  rec(sc, "LT3", "편지가 있는 아침의 알림은 위(.mf-announce.is-top)에 서 있다", topOk.ok, topOk.detail);

  // 등장(700ms)·쓰기·인장(최대 3.7초)이 끝난 뒤 한 장을 잰다
  w = await readLetterWatch(hp, { stop: false });
  if (w?.appearAt != null) {
    const wait = 3900 - (w.now - w.appearAt);
    if (wait > 0) await sleep(wait);
  }
  const snap = await readLetter(hp);
  recMany(rec, sc, letterChecks(snap), " (편지)");
  if (snap) {
    rec(sc, "LT12", "머리글이 '{이름} 님의 유언' 이고 글 줄을 이으면 저장한 유언과 같다(줄이 잘리지 않았다)", snap.head?.text === `${name} 님의 유언` && snap.lines.length > 0 && wills.some((w) => (snap.lineTexts ?? []).join("").replace(/\s/g, "") === w.replace(/\s/g, "")), `머리글 ${snap.head?.text}, 줄 ${JSON.stringify(snap.lineTexts)}`);
    infoRow(ctx, sc, "LT13", "참고: 편지 글꼴·단계(판정 아님)", `글꼴 ${snap.family}, ${snap.lineFontPx}px, 줄 ${snap.lineCount}개, 편지지 높이 ${Math.round(snap.paperH)}, 대체 글꼴 ${snap.fallback}`);
  }

  // 편지가 걷힐 때까지 기다린 뒤 카드·제거 시각을 본다
  await attempt(async () => {
    const start = performance.now();
    for (;;) {
      const x = await readLetterWatch(hp, { stop: false });
      if (x?.goneAt != null) return true;
      if (performance.now() - start > 6000) return { ok: false, detail: "편지가 걷히지 않음" };
      await sleep(100);
    }
  });
  w = await readLetterWatch(hp);
  const cardGap = w?.appearAt != null && w?.cardAt != null ? Math.round(w.cardAt - w.appearAt) : null;
  rec(sc, "LT9", `채팅 유언 카드는 편지가 접힐 때(편지가 뜬 뒤 약 ${LETTER_FOLD_AT_MS / 1000}초) 나타난다`, cardGap !== null && cardGap >= LETTER_FOLD_AT_MS - 400 && cardGap <= LETTER_FOLD_AT_MS + 1500, `편지 등장 → 카드 ${cardGap}ms`);
  const goneGap = w?.appearAt != null && w?.goneAt != null ? Math.round(w.goneAt - w.appearAt) : null;
  rec(sc, "LT10", `편지는 뜬 뒤 약 ${LETTER_END_AT_MS / 1000}초에 걷힌다`, goneGap !== null && goneGap >= LETTER_END_AT_MS - 400 && goneGap <= LETTER_END_AT_MS + 1500, `편지 등장 → 걷힘 ${goneGap}ms`);
  const ext = externalPenFontRequests(host.penFontRequests(), ctx.origin);
  const own = ownPenFontRequests(host.penFontRequests(), ctx.origin);
  rec(sc, "LT11", "손글씨 글꼴(Nanum)을 외부 주소에서 불러오지 않는다(요청 0)", ext === 0, `외부 요청 ${ext}개 (같은 출처 조각 ${own}개)`);
  return { snap, w };
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

    // 선택 효과(결정 0065): 고르기 전 후보 이름표는 점선 테두리(cand), 나·동료는 없다
    const aim0 = await readAim(hp);
    const cand0 = aim0.filter((t) => t.aim === "cand");
    rec(sc, "NA3b", "고르기 전: 후보 이름표 전부가 cand + 점선 테두리고 표식은 없다", cand0.length === g.picks.length && cand0.every((t) => t.borderStyle === "dashed" && !t.mark) && aim0.every((t) => t.aim === "cand" || t.aim === null), `cand ${cand0.length}/${g.picks.length}, 점선 ${cand0.filter((t) => t.borderStyle === "dashed").length}, 상태 ${aim0.map((t) => t.aim).join(",")}`);

    // 다가가기: 봇이 고르는 가장 낮은 seat 의 산 비마피아를 방장이 누른다 → 내 캐릭터가 움직이고(목적지 링) 봇 마피아와 일치해 확정된다
    const target = g.picks.map((b) => b.seat).sort((a, b) => a - b)[0];
    const posBefore = await sampleWorld(hp, game.hostSeat).catch(() => null);
    const segBefore = ht.moves.get(game.hostSeat)?.n ?? 0;
    const movesBefore = ht.sentMoveAt.length;
    const tap = await attempt(async () => {
      await tapPick(hp, target);
    });
    rec(sc, "NA6", "이름표 버튼을 누르면 눌림 표시", tap.ok, tap.detail);
    // 테두리 색은 0.15초 전환이라 끝난 값을 기다려 읽는다
    let aim1 = await readAim(hp);
    for (let i = 0; i < 10 && aim1.find((t) => t.seat === target)?.borderColor !== "rgb(200, 16, 46)"; i++) {
      await sleep(100);
      aim1 = await readAim(hp);
    }
    const mineTag = aim1.find((t) => t.seat === target);
    rec(sc, "NA6b", "고른 뒤: 대상 이름표만 mine + is-picked + 3px 실선 진홍(#c8102e) 테두리 + 표식, 나머지 후보는 cand", mineTag?.aim === "mine" && /is-picked/.test(mineTag.cls ?? "") && mineTag.borderStyle === "solid" && mineTag.borderWidth === 3 && mineTag.borderColor === "rgb(200, 16, 46)" && mineTag.mark === true && aim1.filter((t) => t.aim === "mine").length === 1 && aim1.filter((t) => t.aim === "cand").length === g.picks.length - 1 && aim1.filter((t) => t.mark).length === 1, `대상 ${JSON.stringify(mineTag)}, mine ${aim1.filter((t) => t.aim === "mine").length}, cand ${aim1.filter((t) => t.aim === "cand").length}, 표식 ${aim1.filter((t) => t.mark).length}`);
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
    await armLetterWatch(hp);
    await skipTo(hp, ht, "morning");
    await untilGame(hp, (x) => x.phase === "morning", 6000, "아침 도착");
    const { log, morning } = await waitMorningAnnounce(hp, 6000);
    // 의사 봇은 산 사람 중 무작위로 지킨다 — 우연히 이 밤의 대상을 지키면(구출 문장) 암살 흐름을 볼 수 없다. 새 방으로 다시 돈다(구출 흐름은 night/saved 가 따로 본다)
    if (morning?.text === MORNING_SAVED) throw new SetupError("의사 봇이 우연히 이 밤의 대상을 지킴");
    const chalk = await nightUntil(hp, (x) => x.chalk !== null, 2000);
    rec(sc, "MA1", "아침에 암살 현장 분필([data-chalk])이 있다", !!chalk && /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(chalk.chalk), `chalk ${chalk?.chalk ?? "없음"}`);
    rec(sc, "MA2", `아침 알림이 '${victim} 님이 당했습니다' 이다`, morning?.text === `${victim} 님이 당했습니다`, `알림 ${log.filter((a) => a.text).map((a) => a.text).join(" → ") || "없음"}`);
    if (morning) recMany(rec, sc, announceChecks(morning), " (아침)");
    // 유언 편지(09.1-11): 일반 화면은 아침 0.4초에 편지가 뜨고 T0 + 5.0초에 접히며 카드가 채팅에 나온다. 편지가 걷힌 뒤에 아래 카드·G 검사를 본다.
    await morningLetterChecks(ctx, sc, rec, game, { appearMaxMs: ANNOUNCE_MORNING_AT + 600, announceRe: /님이 당했습니다$/, wills: BOT_WILL_TEXTS, name: victim });
    const cards = await nightUntil(hp, (x) => x.cards.some((c) => c.kind === "will") && x.cards.some((c) => c.kind === "note"), 7000);
    const kinds = (cards ?? (await readNight(hp)))?.cards.map((c) => c.kind) ?? [];
    rec(sc, "MA3", "편지가 접힌 뒤(아침 약 5.4초) 채팅에 유언 카드와 쪽지 카드가 순서대로(유언 → 쪽지) 나온다", !!cards && kinds.indexOf("will") >= 0 && kinds.indexOf("note") > kinds.indexOf("will"), `카드 ${kinds.join(",") || "없음"}`);
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
  rec(sc, "L7", `${who}: 마피아 밤 선택 효과(data-night-pick·표식)가 0개다`, n.aimTags === 0 && n.aimMarks === 0, `속성 ${n.aimTags}개, 표식 ${n.aimMarks}개`);
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
    // 찬반 결과 채팅 카드(data-card="ballots", 09.1.1-13)는 낮의 기록이라 아침 카드가 아니다 — 아침 카드(유언·쪽지 등)만 센다
    const morningCards = (after?.cards ?? []).filter((c) => c.kind !== "ballots");
    rec(sc, "SV7", "구출한 아침에는 유언·쪽지 카드가 없다", after !== null && morningCards.length === 0, `카드 ${JSON.stringify(morningCards)}`);
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
    // 찬반 결과 채팅 카드(ballots)는 낮의 기록이라 아침 카드가 아니다(09.1.1-13) — 아침 카드만 센다
    const morningCards = (after?.cards ?? []).filter((c) => c.kind !== "ballots");
    rec(sc, "MM5", "불일치한 아침에는 분필·카드가 없고 모두 산다", after?.chalk === null && after !== null && morningCards.length === 0 && aliveOf(ht.last()).length === 6, `chalk ${after?.chalk}, 카드 ${morningCards.length}, 산 사람 ${aliveOf(ht.last()).length}`);
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

/** 피해자 편지용 유언(짧은 두 줄감) */
const VICTIM_WILL = "범인은 분명히 도윤 님이에요";

/** 피해자: 방장 시민이 봇 마피아에게 당한다(4명판 — 의사가 없어 반드시 죽는다). 처형 → 밤 → 아침을 자연 타이머로 지나며 막이 나타났다 사라지고, 아침에 번쩍임 한 번·'암살당했습니다'·유령 화면 (NIGHT-11, 시민 편 DOM) */
async function nightVictim(ctx, shared) {
  const id = "night";
  const sc = `${id}/victim`;
  const rec = recorder(ctx);
  const game = await openGame(ctx, id, { guests: 0, bots: 3, role: "citizen", vote: { exec: "no", pick: "other" }, to: "discussion" });
  try {
    const { host, hp, ht, hostSeat } = game;
    if (hostSeat !== 0) throw new SetupError(`방장 자리가 0 이 아님 (${hostSeat})`);
    // 유언 편지(09.1-11): 토론에서 방장이 유언을 저장해 두면 당한 아침에 본인 화면에도 편지가 0.7초 무렵 뜬다(피해자 T0)
    const wrote = await attempt(async () => {
      await hp.locator("[data-will-button]").click({ timeout: 4000 });
      await writeSheet(hp, ht, "will", VICTIM_WILL);
    });
    rec(sc, "VC12", "토론에서 깃펜으로 유언을 쓰고 저장하면 서버가 같은 글을 돌려준다(피해자 편지용)", wrote.ok, wrote.detail);
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
    await armLetterWatch(hp);
    await ht.waitFor((v) => v.phase === "morning", 40_000, "밤 뒤 아침(서버 타이머)");
    // 맥박 큐 시각 기록(window.__mfTension, ?e2e=1·개발 빌드만): 밤 30초 동안 2~4개(09-06 tension.ts)
    const cues = await hp.evaluate(() => window.__mfTension ?? null);
    rec(sc, "VC11", "시민 밤에 맥박 큐가 2~4개 기록된다(window.__mfTension)", Array.isArray(cues) && cues.length >= 2 && cues.length <= 4, `큐 ${Array.isArray(cues) ? cues.length : cues}개`);
    const { log, morning: victimAnn } = await waitMorningAnnounce(hp, 6000, /^암살당했습니다$/);
    rec(sc, "VC6", "피해자 본인 화면 알림이 '암살당했습니다' 이다", !!victimAnn, `알림 ${log.filter((a) => a.text).map((a) => a.text).join(" → ") || "없음"}`);
    if (victimAnn) recMany(rec, sc, announceChecks(victimAnn), " (피해자)");
    await morningLetterChecks(ctx, sc, rec, game, { appearMaxMs: 700 + 600, announceRe: /^암살당했습니다$/, wills: [VICTIM_WILL], name: nickOf(ht.last(), hostSeat) });
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

/** 50자 유언(유언 상한 WILL_MAX_GRAPHEMES, 사용자 결정 2026-11-05). 공백 없는 긴 단어(13·15자)를 섞어 실제 쓰는 모양에 맞춘다. 정확히 50 글자(lib.test.mjs 계약) */
const WILL50 = "도윤님이마피아라고확신해요 어젯밤발소리를제가직접들었어요 끝까지꼭이겨주세요 모두조심하세요 안녕";

/** 폰 크기마다: 방장 시민이 토론에서 50자(유언 상한) 유언을 저장하고 봇 마피아에게 당해 아침에 편지가 뜨면 편지지 맞춤(LT4~LT8)·유언 전체 표시(LT12)·글꼴 외부 요청 0(LT11)을 본다 (09.1-11, UI-SPEC C-3) */
async function nightSizesLetter(ctx, rec) {
  const id = "night-sizes";
  const sc = `${id}/letter`;
  const game = await openGame(ctx, id, { guests: 0, bots: 3, role: "citizen", vote: { exec: "no", pick: "other" }, to: "discussion" });
  try {
    const { hp, ht, hostSeat } = game;
    if (hostSeat !== 0) throw new SetupError(`방장 자리가 0 이 아님 (${hostSeat})`);
    if (graphemeCount(WILL50) !== 50) throw new Error(`시험 유언이 50자가 아님 (${graphemeCount(WILL50)}자)`);
    const wrote = await attempt(async () => {
      await hp.locator("[data-will-button]").click({ timeout: 4000 });
      await writeSheet(hp, ht, "will", WILL50);
    });
    rec(sc, "LT0", "토론에서 50자(상한) 유언을 쓰고 저장하면 서버가 같은 글을 돌려준다", wrote.ok, wrote.detail);
    await skipTo(hp, ht, "night");
    await untilGame(hp, (x) => x.phase === "night", 9000, "밤 도착");
    // 봇 마피아는 밤 시작 1~6초 사이에 방장을 고른다 — 그 뒤에 아침으로 넘긴다
    await sleep(7500);
    if (ht.last().phase !== "night") throw new SetupError(`밤 검사가 길어져 서버가 밤을 먼저 끝냄 (지금 ${ht.last().phase})`);
    await armLetterWatch(hp);
    await skipTo(hp, ht, "morning");
    await untilGame(hp, (x) => x.phase === "morning", 6000, "아침 도착");
    if (aliveOf(ht.last()).includes(hostSeat)) throw new SetupError("방장이 이번 밤에 당하지 않음");
    await morningLetterChecks(ctx, sc, rec, game, { appearMaxMs: 700 + 600, announceRe: /^암살당했습니다$/, wills: [WILL50], name: nickOf(ht.last(), hostSeat) });
  } finally {
    await closeGame(game);
  }
}

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
      const aim = await readAim(game.hp);
      const cands = aim.filter((t) => t.aim === "cand");
      rec(sc, "SZ3b", "마피아: 후보 이름표 버튼이 모두 선택 효과 상태(cand, 점선 테두리)다", cands.length === g.picks.length && cands.every((t) => t.borderStyle === "dashed"), `cand ${cands.length}/${g.picks.length}, 점선 ${cands.filter((t) => t.borderStyle === "dashed").length}`);
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
  await nightScenario(ctx, () => nightSizesLetter(ctx, rec));
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

/** 한 값씩 읽는 짧은 폴링: 조건이 참이 될 때까지 50ms 간격으로 본다. 참이면 true, 시간 안에 안 되면 false */
async function pollPage(page, fn, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 <= ms) {
    if (await page.evaluate(fn)) return true;
    await sleep(50);
  }
  return false;
}

/**
 * 시상식(11-09)을 끝까지 넘긴다: 떠 있는 [넘기기]가 없어질 때까지 누르고 직업 의상이 걷힐 때까지(+600ms) 기다린다.
 * 연출 시계가 final(5600)에 닿으면 시상식이 시작되므로, 최종 상태를 재는 흐름은 이것을 먼저 부른다. 칭호 목록이 없는 서버(옛 서버)는 시상식이 없어 바로 돌아온다.
 */
async function finishCeremony(page) {
  for (let i = 0; i < 24; i++) {
    const btn = page.locator('[data-float="skip"]');
    if ((await btn.count()) === 0) break;
    await btn.click({ timeout: 2000 }).catch(() => {});
    await sleep(80);
  }
  await page
    .waitForFunction(() => {
      const h = window.__mfResult;
      return !h || h.awards.length === 0 || Object.keys(h.costumes).length === 0;
    }, null, { timeout: 5000 })
    .catch(() => {});
}

/** 결과 화면(11-05): ended 도착 뒤 연출 시계가 final 에 닿을 때까지 기다린 뒤 RS1~RS8 로 판정한다. skipProbe 면 먼저 연출 구간에서 무대를 한 번 탭해 건너뛰기(RS9)를 본다. */
async function resultState(ctx, id, game, { winner, n, skipProbe = false }) {
  const rec = recorder(ctx);
  const sc = `${id}/ended`;
  const { hp, ht } = game;
  await ht.waitFor((v) => v.phase === "ended", 8000, "종료 도달");
  const view = ht.last();
  rec(sc, "P8", "서버가 정한 승자가 view 에 있음", view.result?.winner === winner, `view.result.winner ${view.result?.winner} ≠ ${winner}`);
  const seats = view.result?.seats ?? [];
  const jobBySeat = Object.fromEntries(seats.map((x) => [x.seat, x.job]));
  const loserSeats = seats.filter((x) => (x.job === "mafia") === (winner === "citizenWin")).map((x) => x.seat);

  if (skipProbe) {
    // 연출 구간(모임·뒤집기)에서 무대 빈 곳을 실제 마우스로 한 번 탭한다(D-25). 구간을 놓쳤으면 RS9 는 측정값 없음으로 실패하지 않고 정보 행으로 남긴다.
    const inWindow = await pollPage(hp, () => ["gather", "flip"].includes(window.__mfResult?.stage ?? ""), 4000);
    const before = await readResultStage(hp);
    if (inWindow && before) {
      const mid = await hp.evaluate(() => {
        const root = document.querySelector(".mf-result");
        const head = root?.querySelector("header")?.getBoundingClientRect();
        const panel = root?.querySelector("[data-result-panel]")?.getBoundingClientRect();
        if (!root || !head || !panel) return null;
        return { x: window.innerWidth / 2, y: (head.bottom + panel.top) / 2 };
      });
      if (!mid) throw new SetupError("결과 화면 스테이지 가운데를 못 잼");
      await hp.mouse.click(mid.x, mid.y);
      await sleep(150);
      const after = await readResultStage(hp);
      recOne(rec, sc, resultSkipChecks({ before: { stage: before.hook?.stage ?? before.stage, chips: before.chips }, after: { stage: after?.hook?.stage ?? after?.stage, chips: after?.chips }, seats: seats.length }));
    } else {
      infoRow(ctx, sc, "RS9", "결과 화면: 무대 탭 건너뛰기(연출 구간을 놓쳐 건너뜀)", `단계 ${before?.stage ?? "없음"}`);
    }
  }

  try {
    await hp.waitForFunction(() => window.__mfResult?.stage === "final", null, { timeout: 12000 });
  } catch {
    throw new SetupError("결과 화면 연출이 final 에 닿지 않음 (window.__mfResult.stage)");
  }
  await finishCeremony(hp); // 11-09: final(5600)부터 시상식이 돈다 — 끝까지 넘겨 승리 한 줄·고른 look 상태를 잰다
  await checkState(ctx, id, `ended-${winner}`, game.host);

  // 채팅 한 줄: 결과 단계에서도 전체 채팅이 오간다(D-11). 보낸 줄이 기록 칸에 보여야 한다.
  const text = `수고했어요 ${winner === "citizenWin" ? "시민" : "마피아"}`;
  const echo = await attempt(async () => {
    await typeAndSendChat(hp, text);
    await waitChatLine(hp, text);
  });

  const read = await readResultStage(hp);
  if (read === null) {
    rec(sc, "RS1", "결과 화면이 그려짐", false, "측정값 없음(.mf-result)");
    return;
  }
  for (const row of resultStageChecks({
    winner,
    header: read.header,
    chips: read.chips,
    seats: seats.length || n,
    dimmed: read.hook?.dimmed,
    loserSeats,
    costumes: read.hook?.costumes,
    jobBySeat,
    panel: read.panel,
    stageBottom: read.panelTop,
    roomH: read.roomH,
    hasLegacy: read.legacy,
    chatEcho: echo.ok,
    afterCeremony: (read.hook?.awards?.length ?? 0) > 0, // 시상식이 있었으면 직업 의상은 걷혀 있다(고른 look 으로 복귀)
  })) {
    recOne(rec, sc, row);
  }
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
      await resultState(ctx, id, game, { winner: "citizenWin", n: 4, skipProbe: true });
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

// ---- result-reveal (11-07, D-2·D-3·D-25): 결과 탭 패널 ----
// 방장(마피아) + 손님 1(시민) + 봇 2. 낮 1: 방장이 귓속말 → 봇들이 손님을 지목해 처형(손님이 유령) → 밤 1: 손님이 유령 채팅, 방장이 마피아 채팅 → 방장이 봇 한 명을 죽여 마피아 승.
// 방장 페이지는 연출 구간(모임·뒤집기)을 지나며 탭 등장·시계 정지·무대 탭을, 손님 페이지는 최종 상태의 탭 기하·구분선·진홍·점을 본다. 판이 도는 동안 손님(시민) 페이지의 탭은 0건이어야 한다.

const REVEAL_TEXTS = { mafia: "오늘 밤은 조용히 정해요", ghost: "나는 유령이에요 억울해요", whisper: "귓속말 기록 한 줄" };

async function resultRevealFlow(ctx) {
  const id = "result-reveal";
  const rec = recorder(ctx);
  const game = await openGame(ctx, id, { guests: 1, bots: 2, role: "mafia", vote: { exec: "yes", pick: "other" }, to: "discussion" });
  try {
    const { hp, ht, hostSeat, guests } = game;
    const [g] = guests;
    const live = [];
    const liveTabs = async (phase) => live.push({ phase, count: await g.page.locator("[data-result-tab]").count() });

    // 낮 1: 판이 도는 동안 탭 0건 + 귓속말 한 줄(방장 → 다른 사람)
    await untilGame(g.page, (x) => x.phase === "discussion", 8000, "토론 도착(손님)");
    await liveTabs("discussion");
    const whispered = await attempt(async () => {
      await hp.locator('[data-float="whisper"]').click({ timeout: 4000 });
      await hp.locator("[data-pick]").first().waitFor({ state: "attached", timeout: 4000 });
      await hp.locator("[data-pick]").first().dispatchEvent("click");
      await hp.locator("[data-line-input]").waitFor({ timeout: 4000 });
      await hp.locator("[data-line-input]").fill(REVEAL_TEXTS.whisper);
      await hp.locator("[data-line-send]").click({ timeout: 4000 });
      await ht.waitFor((v) => v.me.whisperUsed === true, 5000, "서버가 귓속말 사용함으로 확인");
    });
    if (!whispered.ok) infoRow(ctx, `${id}/setup`, "RT-W", "귓속말을 보내지 못해 귓속말 탭은 빈 상태로 확인(참고)", whispered.detail);

    await step("지목", () => skipTo(hp, ht, "nomination"));
    await liveTabs("nomination");
    await step("변론", () => skipTo(hp, ht, "defense"));
    await step("찬반", () => skipTo(hp, ht, "verdict"));
    await untilGame(hp, (x) => x.phase === "verdict" && x.verdictBtns.length === 2, 6000, "찬반 도착");
    await chooseVerdict(hp, true);
    await step("밤", () => skipTo(hp, ht, "night"));
    const night = await untilGame(hp, (x) => x.phase === "night" && x.picks.length > 0, 9000, "밤 도착(지목 버튼)");
    await liveTabs("night");
    const alive = aliveOf(ht.last());
    if (alive.length !== 3 || !alive.includes(hostSeat)) throw new SetupError(`처형 뒤 생존자가 방장 포함 3명이 아님 (${alive.join(",")})`);
    if (alive.includes(g.seat)) throw new SetupError("손님이 처형되지 않음(봇 지목이 손님이 아님)");

    // 밤 1: 손님(유령)의 유령 채팅과 방장의 마피아 채팅
    const ghostSent = await attempt(async () => {
      await untilGame(g.page, (x) => x.ghostView, 9000, "유령 화면(손님)");
      await typeAndSendChat(g.page, REVEAL_TEXTS.ghost);
      await waitChatLine(g.page, REVEAL_TEXTS.ghost);
    });
    rec(`${id}/setup`, "RT-G", "손님(유령)이 유령 채팅 한 줄을 보냄", ghostSent.ok, ghostSent.detail);
    const mafiaSent = await attempt(async () => {
      await typeAndSendChat(hp, REVEAL_TEXTS.mafia);
      await waitChatLine(hp, REVEAL_TEXTS.mafia);
    });
    rec(`${id}/setup`, "RT-M", "방장(마피아)이 밤 채팅 한 줄을 보냄", mafiaSent.ok, mafiaSent.detail);
    await tapPick(hp, night.picks.find((b) => b.seat !== hostSeat).seat);
    await step("아침", () => skipTo(hp, ht, "morning"));
    await liveTabs("morning");

    // 방장 페이지: 연출 구간을 지나며 탭 등장·시계 정지·무대 탭
    await toEnded(game);
    const sc = `${id}/ended`;
    const waitRead = async (ok, ms) => {
      const t0 = Date.now();
      for (;;) {
        const r = await readResultTabs(hp);
        if (r && ok(r)) return r;
        if (Date.now() - t0 > ms) return r;
        await sleep(25);
      }
    };
    const before = await waitRead((r) => r.tabs.length > 0, 8000);
    const after = await waitRead((r) => r.tabs.length === 5, 4000);
    let tapExpanded;
    let paused;
    let tapCollapsed;
    if (after && after.tabs.length === 5 && after.stage !== "final") {
      await hp.locator('[data-result-tab="mafia"]').click({ timeout: 4000 });
      const opened = await waitRead((r) => r.expanded, 2000);
      const t0 = Date.now();
      await sleep(1500);
      const later = await readResultTabs(hp);
      paused = { stageAtOpen: opened?.stage, chipsAtOpen: opened?.chips, stageLater: later?.stage, chipsLater: later?.chips, waitedMs: Date.now() - t0 };
      const mid = { x: ctx.size.w / 2, y: ((later?.headerBottom ?? 62) + (later?.panelTop ?? 200)) / 2 };
      await hp.mouse.click(mid.x, mid.y);
      await sleep(150);
      const folded = await readResultTabs(hp);
      tapExpanded = { expandedBefore: later?.expanded, expandedAfter: folded?.expanded, stageBefore: later?.stage, stageAfter: folded?.stage };
      const stageBefore = folded?.stage;
      await hp.mouse.click(mid.x, mid.y);
      await sleep(150);
      const skipped = await readResultTabs(hp);
      tapCollapsed = { stageBefore, stageAfter: skipped?.stage };
    }
    const reveal = { tabsBefore: { stage: before?.stage, count: before?.tabs.length }, tabsAfter: { stage: after?.stage, count: after?.tabs.length }, live, paused, tapExpanded, tapCollapsed };
    for (const row of resultTabChecks({ reveal })) recOne(rec, sc, row);

    // 두 페이지가 최종 상태에 닿은 뒤 손님 페이지로 탭 기하를 잰다
    for (const page of [hp, g.page]) {
      try {
        await page.waitForFunction(() => window.__mfResult?.stage === "final", null, { timeout: 12000 });
      } catch {
        throw new SetupError("결과 화면 연출이 final 에 닿지 않음 (window.__mfResult.stage)");
      }
      await finishCeremony(page); // 11-09: 시상식이 끝난 뒤 탭 기하를 잰다(떠 있는 [넘기기]·패가 없는 상태)
    }
    await checkState(ctx, id, "ended", game.host);
    const gp = g.page;
    const layout0 = await readResultTabs(gp);
    await gp.locator('[data-result-tab="mafia"]').click({ timeout: 4000 });
    await gp.waitForSelector('[data-result-panel][data-expanded="true"]', { timeout: 4000 });
    await sleep(300);
    const layout1 = await readResultTabs(gp);
    for (const row of resultTabChecks({
      layout: {
        roomH: layout1?.roomH,
        tabBoxes: layout0?.tabBoxes,
        panelCollapsedH: layout0?.panelH,
        panelExpandedH: layout1?.panelH,
        inputPresent: layout1?.inputPresent,
        iconColors: layout0?.iconColors,
        crimson: layout0?.crimson,
        separators: layout1?.separators,
        dots: { before: layout0?.dots, after: layout1?.dots },
        headerBottom: layout1?.headerBottom,
        panelTop: layout1?.panelTop,
      },
    })) {
      recOne(rec, sc, row);
    }

    // 탭 안 내용: 마피아·유령 줄이 해당 탭에만, 귓속말은 머리줄 + 본문(보냈을 때)
    const bodyOf = async () => (await readResultTabs(gp))?.bodyText ?? "";
    rec(sc, "RT14", "마피아 탭에 밤 채팅 줄이 보임", (await bodyOf()).includes(REVEAL_TEXTS.mafia), "마피아 탭 본문에 줄이 없음");
    await gp.locator('[data-result-tab="ghost"]').click({ timeout: 4000 });
    await sleep(150);
    const ghostBody = await bodyOf();
    rec(sc, "RT15", "유령 탭에 유령 채팅 줄만 보임", ghostBody.includes(REVEAL_TEXTS.ghost) && !ghostBody.includes(REVEAL_TEXTS.mafia), "유령 탭 본문이 기대와 다름");
    await gp.locator('[data-result-tab="whisper"]').click({ timeout: 4000 });
    await sleep(150);
    const whisperRows = await gp.locator("[data-result-whisper]").count();
    if (whispered.ok) rec(sc, "RT16", "귓속말 탭에 머리줄 + 본문 한 줄과 일차 구분선", whisperRows >= 1 && (await bodyOf()).includes(REVEAL_TEXTS.whisper) && (await readResultTabs(gp))?.separators.some((t) => /^\d+일차$/.test(t)), `머리줄 ${whisperRows}개`);
    else rec(sc, "RT16", "귓속말 탭: 보낸 귓속말이 없으면 quiet 아이콘 하나(글 없음)", whisperRows === 0 && (await bodyOf()) === "", `머리줄 ${whisperRows}개`);
    await gp.locator('[data-result-tab="all"]').click({ timeout: 4000 });
    await sleep(150);
    const folded = await readResultTabs(gp);
    rec(sc, "RT17", "전체 탭으로 돌아오면 접히고 입력칸이 다시 있음", folded?.expanded === false && folded.inputPresent === true, `확장 ${folded?.expanded} · 입력칸 ${folded?.inputPresent}`);
  } finally {
    await closeGame(game);
  }
}

// ---- result-awards (11-09, D-7·D-24·D-25): 시상식 ----
// 방장(마피아) + 봇 3: 방장이 처형되어 시민 승. ended 도착 뒤 연출 구간은 무대 탭으로 건너뛰고 시상식이 시작되기를 기다려 첫 패에서 기하를 잰다.
// 확장 탭(기록)을 열어 3초 동안 패 index 가 그대로인지(일시정지) 보고 접으면 이어지는지 본다. 나머지 패는 [넘기기]로 한 장씩 넘기며 순서·진행 숫자를 읽고, 끝난 뒤 헤더·[넘기기]·의상을 본다.

async function resultAwardsFlow(ctx) {
  const id = "result-awards";
  const rec = recorder(ctx);
  const sc = `${id}/ended`;
  const game = await openGame(ctx, id, { guests: 0, bots: 3, role: "mafia", vote: { exec: "yes", pick: "host" }, to: "nomination" });
  try {
    const { hp, ht } = game;
    await step("defense", () => skipTo(hp, ht, "defense"));
    await step("verdict", () => skipTo(hp, ht, "verdict"));
    await step("execution", () => skipTo(hp, ht, "execution"));
    await step("ended", () => toEnded(game));
    await ht.waitFor((v) => v.phase === "ended", 8000, "종료 도달");
    const view = ht.last();
    const winner = view.result?.winner;
    const seats = view.result?.seats ?? [];
    const jobBySeat = Object.fromEntries(seats.map((x) => [x.seat, x.job]));
    const winnerTeamSeats = seats.filter((x) => (x.job === "mafia") === (winner === "mafiaWin")).map((x) => x.seat);

    // 연출 구간(모임·뒤집기)은 무대 탭으로 건너뛴다 — 4600 으로 점프하고 5600 에 시상식이 시작된다
    const inWindow = await pollPage(hp, () => ["gather", "flip"].includes(window.__mfResult?.stage ?? ""), 4000);
    if (inWindow) {
      const mid = await hp.evaluate(() => {
        const root = document.querySelector(".mf-result");
        const head = root?.querySelector("header")?.getBoundingClientRect();
        const panel = root?.querySelector("[data-result-panel]")?.getBoundingClientRect();
        if (!root || !head || !panel) return null;
        return { x: window.innerWidth / 2, y: (head.bottom + panel.top) / 2 };
      });
      if (!mid) throw new SetupError("결과 화면 스테이지 가운데를 못 잼");
      await hp.mouse.click(mid.x, mid.y);
    }
    try {
      await hp.waitForFunction(() => (window.__mfResult?.shown ?? -1) >= 0, null, { timeout: 12000 });
    } catch {
      throw new SetupError("시상식 첫 패가 뜨지 않음 (window.__mfResult.shown, 칭호 목록 " + (await hp.evaluate(() => window.__mfResult?.awards?.length ?? "훅 없음")) + ")");
    }
    await sleep(300); // 패 페이드 180ms
    const first = await readAwardState(hp);
    if (!first || !first.plate) throw new SetupError("첫 패를 못 읽음");
    await checkState(ctx, id, "plate", game.host);

    // 일시정지: 확장 탭(기록)을 열고 3초 기다린다. 패는 그대로, [넘기기]는 숨고, 접으면 이어진다
    await hp.locator('[data-result-tab="log"]').click({ timeout: 4000 });
    await hp.waitForSelector('[data-result-panel][data-expanded="true"]', { timeout: 4000 });
    const open = await readAwardState(hp);
    const t0 = Date.now();
    await sleep(3000);
    const later = await readAwardState(hp);
    const waitedMs = Date.now() - t0;
    await hp.locator('[data-result-tab="all"]').click({ timeout: 4000 });
    let indexResumed = -1;
    {
      const tr = Date.now();
      while (Date.now() - tr < 5500) {
        indexResumed = await hp.evaluate(() => window.__mfResult?.shown ?? -1);
        if (indexResumed > (open?.shown ?? 0)) break;
        await sleep(50);
      }
    }

    // 나머지 패: [넘기기]로 한 장씩 넘기며 칭호 순서·진행 숫자를 읽는다
    const n = first.awards.length;
    const observed = [first.plate.id];
    const progress = [first.float?.count ?? ""];
    const windowOf = async () => {
      const t = await hp.locator("[data-float-count]").first().textContent({ timeout: 1500 }).catch(() => null);
      const m = /^(\d+) \/ (\d+)$/.exec((t ?? "").trim());
      return m ? Number(m[1]) - 1 : -1;
    };
    for (let want = 1; want < n; want++) {
      for (let guard = 0; guard < 12 && (await windowOf()) < want; guard++) {
        await hp.locator('[data-float="skip"]').click({ timeout: 2000 });
        await sleep(100);
      }
      try {
        await hp.waitForFunction((w) => window.__mfResult?.shown === w, want, { timeout: 5000 });
      } catch {
        throw new SetupError(`패 ${want + 1}/${n} 가 뜨지 않음`);
      }
      await sleep(250);
      const st = await readAwardState(hp);
      observed.push(st?.plate?.id ?? "");
      progress.push(st?.float?.count ?? "");
    }

    // 마지막 패에서 한 번 더 넘기면 시상식이 끝난다
    await hp.locator('[data-float="skip"]').click({ timeout: 2000 });
    await hp.waitForFunction(() => document.querySelector('[data-float="skip"]') === null, null, { timeout: 4000 }).catch(() => {});
    await hp.waitForFunction(() => Object.keys(window.__mfResult?.costumes ?? { x: 1 }).length === 0, null, { timeout: 4000 }).catch(() => {});
    const after = await readAwardState(hp);

    for (const row of awardChecks({
      viewport: first.viewport,
      stageTop: first.stageTop,
      panelTop: first.panelTop,
      plateBox: first.plate,
      floatBox: first.float,
      progress,
      awards: first.awards,
      observed,
      participants: seats.length,
      winnerTeamSeats,
      winner,
      titleDuring: first.title,
      titleAfter: after?.title,
      floatAfter: after?.floatCount,
      pause: { indexOpen: open?.shown, indexLater: later?.shown, waitedMs, floatHidden: (open?.floatCount ?? 1) === 0 && (later?.floatCount ?? 1) === 0, plateKept: later?.plate != null, indexResumed },
      costumesDuring: first.costumes,
      costumesAfter: after?.costumes,
      jobBySeat,
    })) {
      recOne(rec, sc, row);
    }

    // 기록 탭(11-11, TL1~TL7): 시상식을 넘긴 뒤 같은 한 판에서 연다 — 별도 흐름을 만들지 않아 실행 시간을 늘리지 않는다
    await finishCeremony(hp);
    await hp.locator('[data-result-tab="log"]').click({ timeout: 4000 });
    try {
      await hp.waitForSelector('[data-result-panel][data-expanded="true"] [data-day-card]', { timeout: 4000 });
    } catch {
      throw new SetupError("기록 탭을 열어도 일차 카드가 그려지지 않음 ([data-day-card])");
    }
    await sleep(250);
    const tl = await readTimeline(hp);
    if (!tl) throw new SetupError("기록 탭을 못 읽음");
    const summary = view.result?.summary ?? [];
    const executed = summary
      .filter((row) => row.exec?.candidate !== undefined && (row.exec.passed || (row.exec.yes === 0 && row.exec.no === 0)))
      .map((row) => ({ n: row.n, seat: row.exec.candidate }));
    const target = tl.cards.length >= 2 ? tl.cards[1].n : (tl.cards[0]?.n ?? 1);
    await hp.locator(`[data-day-card="${target}"]`).click({ timeout: 2000 });
    const detailAfter = await hp.evaluate(() => document.querySelector("[data-day-detail]")?.getAttribute("data-day-detail") ?? null);
    for (const row of timelineChecks({
      roomH: tl.roomH,
      dayCount: summary.length,
      panel: tl.panel,
      cards: tl.cards,
      scrollLeft: tl.scrollLeft,
      detailText: tl.detailText,
      detailBox: tl.detailBox,
      chips: tl.chips,
      executed,
      jobBySeat,
      switched: { cards: tl.cards.length, target, before: tl.detail, after: detailAfter },
    })) {
      recOne(rec, sc, row);
    }
  } finally {
    await closeGame(game);
  }
}

// ---- result-rematch · host-handoff (11-12, 결정 D-11~D-13·D-16·D-17·D-26): 다시 하기와 방장 이양 ----
// result-rematch: 방장 360×560 + 손님 셋 430×932(실제 페이지 4개) + 테스트 방 봇 1 = 5명. 1판은 방장(마피아)이 처형되어 시민 승으로 끝낸다 → 손님 A 가 결과 단계에서 꾸미기로 noir →
// A·B 준비(n/m) → 인원 부족 토스트 → 쉬게 될 사람(손님 C) 시트 확인·취소·시작 → 새 판 참가자 assigning(round 2)·C 는 BenchView → 2판을 끝까지 → 쉬었던 C 가 결과에 sat 로 합류.
// host-handoff(390×844): 대기실에서 방장 연결이 끊기면(유예 3초) 손님에게 '방장 · 이름' 알림과 [시작]이 가고, 옛 방장이 돌아오면 일반 참가자다. 짧게 끊겼다 돌아오면 변화 없음. 결과 단계 [나가기]도 같다.

const REMATCH_HOST_SIZE = { w: 360, h: 560, label: "360x560" };
const REMATCH_GUEST_SIZE = { w: 430, h: 932, label: "430x932" };
const REMATCH_OLD_LINE = "지난 판 인사예요";
const HANDOFF_SIZE = { w: 390, h: 844, label: "390x844" };

/** nomination 에서 시작해 ended 까지: 방장(마피아)이 지목되어 처형된다(봇은 방장을 가리키고 찬성). voters 는 찬성을 누를 손님 페이지들이다 */
async function playRematchGame(game, voters) {
  const { hp, ht } = game;
  await step("defense", () => skipTo(hp, ht, "defense"));
  await step("verdict", () => skipTo(hp, ht, "verdict"));
  for (const g of voters) {
    await untilGame(g.page, (x) => x.phase === "verdict" && x.verdictBtns.length === 2, 8000, "찬반 도착(손님)");
    await chooseVerdict(g.page, true);
  }
  await step("execution", () => skipTo(hp, ht, "execution"));
  await step("ended", () => toEnded(game));
}

/** 시상식이 있으면 끝까지 넘기고 final 에 닿은 뒤의 알약 상태를 읽는다 */
async function settledResult(page) {
  await page.waitForFunction(() => window.__mfResult?.stage === "final", null, { timeout: 15000 });
  await finishCeremony(page);
  await sleep(250);
}

const pillBy = (page) => page.locator("[data-ready-pill]");

async function resultRematchFlow(ctx) {
  const id = "result-rematch";
  const rec = recorder(ctx);
  const sc = `${id}/ended`;
  const game = await openGame(ctx, id, { guests: 3, bots: 1, role: "mafia", vote: { exec: "yes", pick: "host" }, to: "nomination", guestSize: REMATCH_GUEST_SIZE });
  try {
    const { hp, ht, guests } = game;
    const [A, B, C] = guests;
    await playRematchGame(game, [A, B]);
    await Promise.all([ht, A.tracker, B.tracker, C.tracker].map((t) => t.waitFor((v) => v.phase === "ended" && v.result !== undefined, 10000, "종료 도달")));
    const round1 = ht.last().round ?? 1;

    // 승리 조명(4600) 전: 알약은 비활성 (RM12). 이어서 무대를 탭해 4600 으로 건너뛰면 시상이 시작된다 — 패·[넘기기]와 알약이 겹치지 않아야 한다 (RM11)
    const inWindow = await pollPage(hp, () => ["gather", "flip"].includes(window.__mfResult?.stage ?? ""), 4000);
    if (!inWindow) throw new SetupError("연출 구간(모임·뒤집기)을 놓침");
    const early = await readRematchState(hp);
    const mid = await hp.evaluate(() => {
      const root = document.querySelector(".mf-result");
      const head = root?.querySelector("header")?.getBoundingClientRect();
      const panel = root?.querySelector("[data-result-panel]")?.getBoundingClientRect();
      if (!root || !head || !panel) return null;
      return { x: window.innerWidth / 2, y: (head.bottom + panel.top) / 2 };
    });
    if (!mid) throw new SetupError("결과 화면 스테이지 가운데를 못 잼");
    await hp.mouse.click(mid.x, mid.y);
    try {
      await hp.waitForFunction(() => (window.__mfResult?.shown ?? -1) >= 0, null, { timeout: 12000 });
    } catch {
      throw new SetupError("시상식 첫 패가 뜨지 않음 (window.__mfResult.shown)");
    }
    await sleep(300);
    const during = await readRematchState(hp);
    const ceremony = {
      pillActive: !!during?.pill && during.inactive === false,
      plateVsPill: during?.plate && during?.pill ? rectsOverlap(during.plate, during.pill) : undefined,
      skipVsPill: during?.skip && during?.pill ? rectsOverlap(during.skip, during.pill) : undefined,
    };

    // 모두 최종 상태로
    await Promise.all([settledResult(hp), settledResult(A.page), settledResult(B.page), settledResult(C.page)]);

    // 이전 판 채팅 한 줄(A) — 나중에 새 판 기록 칸에 남지 않아야 한다 (RM9)
    await typeAndSendChat(A.page, REMATCH_OLD_LINE);
    await waitChatLine(hp, REMATCH_OLD_LINE);
    const oldCount = async (page) => ((await readChatLines(page)) ?? []).filter((l) => l.text === REMATCH_OLD_LINE).length;
    const chatBefore = await oldCount(hp);

    // 결과 단계 꾸미기(D-16): A 가 아래 칸 [꾸미기] → noir
    await step("A 꾸미기 버튼", () => A.page.locator('[data-float="dress"]').click({ timeout: 4000 }));
    await step("A noir 카드", () => A.page.locator('button[data-outfit="noir"]').click({ timeout: 4000 }));
    await A.tracker.waitFor((v) => v.players.find((p) => p.seat === A.seat)?.look === "noir", 4000, "A 의상 noir 확인");
    await A.page.keyboard.press("Escape");
    await sleep(350);

    // 알약: 준비 전 방장 n/m = 방장·봇 2 / 연결된 5 (흐림), 인원 부족 탭 → 토스트 (RM3·RM4)
    const hostBefore = await readRematchState(hp);
    // 흐린 알약은 aria-disabled 라 Playwright 가 비활성으로 보고 기다린다 — 실제 탭처럼 좌표에 눌러야 한다(흐려도 탭은 토스트를 부른다)
    await step("방장 알약(토스트)", () => pillBy(hp).click({ timeout: 4000, force: true }));
    await sleep(350);
    const hostToast = await readRematchState(hp);
    await sleep(500);
    const roundUnchanged = ht.last().phase === "ended" && (ht.last().round ?? 1) === round1;

    // 손님 토글 (RM2): B 가 준비 → 준비됨 → 취소 → 다시 준비 대신 A 가 준비
    const guestBefore = await readRematchState(A.page);
    await step("A 알약", () => pillBy(A.page).click({ timeout: 4000 }));
    await A.page.waitForSelector('[data-ready-pill][data-ready="true"]', { timeout: 4000 });
    const guestAfter = await readRematchState(A.page);
    await step("B 알약", () => pillBy(B.page).click({ timeout: 4000 }));
    await ht.waitFor((v) => v.players.filter((p) => p.ready === true && p.connected).length === 4, 5000, "준비 4명(방장·봇·A·B)");
    await sleep(350);
    const hostFull = await readRematchState(hp);
    const doneTags = await hp.evaluate(() => document.querySelectorAll('.mv-head[data-done="true"]').length);
    rec(sc, "RM-TAG", "다시 하기: 준비한 사람 수(4)만큼 이름표에 체크", doneTags === 4, `이름표 체크 ${doneTags}개`);

    // 쉬게 될 사람 시트 (RM5): C 한 명. [취소] 로 닫고 다시 열어 [시작]
    await step("방장 알약(시트)", () => pillBy(hp).click({ timeout: 4000 }));
    await hp.waitForSelector("dialog[open] [data-rest-faces]", { timeout: 4000 });
    const sheet = await readRestSheet(hp);
    await step("시트 취소", () => hp.locator("dialog[open]").getByRole("button", { name: "취소", exact: true }).click({ timeout: 3000 }));
    await hp.waitForFunction(() => !document.querySelector("dialog[open]"), null, { timeout: 3000 });
    const stillEnded = ht.last().phase === "ended" && (ht.last().round ?? 1) === round1;
    await sleep(2100); // 알약 잠금 없음(취소는 보내지 않는다) — 안전 여유
    await step("방장 알약(시트 2)", () => pillBy(hp).click({ timeout: 4000 }));
    await hp.waitForSelector("dialog[open] [data-rest-faces]", { timeout: 4000 });
    await step("시트 시작", () => hp.locator("dialog[open]").getByRole("button", { name: "시작", exact: true }).click({ timeout: 3000 }));

    // 새 판: 참가자는 round + 1 의 assigning, C 는 BenchView (RM6·RM7)
    await Promise.all([ht, A.tracker, B.tracker].map((t) => t.waitFor((v) => (v.round ?? 1) === round1 + 1 && v.phase !== "ended", 10000, "새 판 도착")));
    await C.tracker.waitFor((v) => v.resting === true && (v.round ?? 1) === round1 + 1, 10000, "쉬는 사람 state");
    await C.page.waitForSelector("[data-bench-view]", { timeout: 6000 });
    await sleep(250);
    const phases = [ht, A.tracker, B.tracker].map((t) => t.last().phase);
    const round = { before: round1, after: Math.min(...[ht, A.tracker, B.tracker].map((t) => t.last().round ?? 1)), phases };
    const bench = await readBenchView(C.page);
    if (C.tracker.last()?.players?.length !== 1) rec(`${id}/bench`, "RM-LEAK", "쉬는 사람이 받은 players 는 자기 한 줄뿐", false, `players ${C.tracker.last()?.players?.length}`);
    else rec(`${id}/bench`, "RM-LEAK", "쉬는 사람이 받은 players 는 자기 한 줄뿐", true);

    // 2판: 의상 유지 (RM8), 이전 판 채팅 0줄 (RM9) — 낮 토론의 기록 칸에서 센다
    await step("2판 낮", () => skipTo(hp, ht, "discussion"));
    await untilGame(A.page, (x) => x.phase === "discussion", 10000, "토론 도착(손님)");
    const looks = Object.fromEntries(ht.last().players.map((p) => [p.seat, p.look ?? "coat"]).filter(([seat]) => seat === A.seat));
    const chatOld = (await oldCount(hp)) + (await oldCount(A.page)) + (await oldCount(B.page));
    if (ht.last().me.role !== "mafia") throw new SetupError("2판 방장 직업이 마피아가 아님(테스트 직업이 유지되지 않음)");
    await step("2판 지목", () => skipTo(hp, ht, "nomination"));
    await playRematchGame(game, [A, B]);
    await Promise.all([ht, A.tracker, B.tracker, C.tracker].map((t) => t.waitFor((v) => v.phase === "ended" && v.result !== undefined && v.resting !== true, 10000, "2판 종료 도달")));

    // 쉬었던 C 가 결과에 합류 (RM10): sat, 칩 없음, 칩 수 = 참가자 4
    await Promise.all([settledResult(hp), settledResult(C.page)]);
    const cState = await readRematchState(C.page);
    const chipsOnSat = await C.page.evaluate((seat) => document.querySelectorAll(`.mf-world__tags [data-seat="${seat}"] [data-role-chip]`).length, C.seat);
    const sat = { seats: cState?.sat ?? [], want: [C.seat], chipsOnSat, chips: cState?.chips ?? Number.NaN, participants: ht.last().result?.seats?.length ?? Number.NaN };
    const cPill = await readRematchState(C.page);
    rec(sc, "RM-SAT", "다시 하기: 쉬었던 사람의 알약은 손님과 같다(data-ready, 방장 표식 없음)", cPill?.ready !== null && cPill?.count === null, `ready ${cPill?.ready}, count ${cPill?.count}`);
    await checkState(ctx, id, "ended-2", game.host);

    const accept = {
      viewport: { w: REMATCH_HOST_SIZE.w, h: REMATCH_HOST_SIZE.h },
      pillBox: hostBefore?.pill ? { width: hostBefore.pill.width, height: hostBefore.pill.height } : undefined,
      inputWidth: hostBefore?.inputWidth,
      guestPill: guestBefore && guestAfter ? { before: { ready: guestBefore.ready, pressed: guestBefore.pressed }, after: { ready: guestAfter.ready, pressed: guestAfter.pressed } } : undefined,
      count: hostBefore ? { text: hostBefore.count ?? "", dim: hostBefore.dim, disabled: hostBefore.disabled } : undefined,
      countWant: { n: 2, m: 5, minPlayers: 4 },
      countFull: hostFull ? { text: hostFull.count ?? "", dim: hostFull.dim, disabled: hostFull.disabled } : undefined,
      countFullWant: { n: 4, m: 5, minPlayers: 4 },
      toast: hostToast?.toast,
      minPlayers: 4,
      roundUnchanged: roundUnchanged && stillEnded,
      sheet,
      restingWant: 1,
      round,
      benchView: bench !== null,
      bench: bench ?? undefined,
      looks,
      looksWant: { [A.seat]: "noir" },
      chat: { before: chatBefore, old: chatOld },
      sat,
      ceremony,
      early: early?.pill ? { disabled: early.inactive } : undefined,
    };
    for (const row of rematchChecks(accept)) recOne(rec, sc, row);
    // 손님 크기(430×932)에서도 알약 96×48·입력칸 폭 − 192
    const guestState = await readRematchState(B.page).catch(() => null);
    if (guestState?.pill) {
      const only = rematchChecks({ viewport: { w: REMATCH_GUEST_SIZE.w, h: REMATCH_GUEST_SIZE.h }, pillBox: { width: guestState.pill.width, height: guestState.pill.height }, inputWidth: guestState.inputWidth }).find((r) => r.id === "RM1");
      rec(sc, "RM1b", `${only.label} (손님 ${REMATCH_GUEST_SIZE.label})`, only.ok, only.detail);
    }
  } finally {
    await closeGame(game);
  }
}

/** 대기실 → 결과 단계에서 방장이 사라졌을 때의 화면: 알림·알약·이름표 */
async function hostHandoffFlow(ctx) {
  const id = "host-handoff";
  const rec = recorder(ctx);
  const toastsOf = async (page) => (await readLinkState(page))?.toasts ?? [];
  const hostToasts = (list) => list.filter((t) => /^방장 · /.test(t));
  const stage = `${id}/lobby`;

  // 1) 대기실: 짧게 끊겼다 돌아오면(유예 3초 안) 아무 일도 없다 → 길게 끊기면 손님이 방장 → 옛 방장이 돌아오면 일반 참가자
  {
    const host = await startHost(ctx, id, { initScripts: [reconnectInit] });
    const hostToken = ctx.hostToken;
    const { guest, seat: gSeat } = await openGuest(ctx, GAME_GUESTS[0], { initScripts: [reconnectInit] });
    let old = null;
    try {
      await Promise.all([host.tracker.waitFor((v) => v.players.length === 2, 6000, "방장 쪽 인원 2"), guest.tracker.waitFor((v) => v.players.length === 2, 6000, "손님 쪽 인원 2")]);
      const hSeat = host.tracker.last().me.seat;
      await clearToasts(guest.page);

      // 짧은 끊김: 소켓만 닫는다(앱이 곧바로 다시 붙는다)
      await dropSockets(host.page);
      await sleep(250);
      await attempt(async () => {
        const t0 = Date.now();
        while (Date.now() - t0 < 6000) {
          const st = await readLinkState(host.page);
          if (st?.lastSocketOpen) return;
          await sleep(100);
        }
        throw new Error("방장 소켓이 다시 열리지 않음");
      }).then((r) => {
        if (!r.ok) throw new SetupError(r.detail);
      });
      await sleep(3600); // 유예(3초)보다 길게 기다려도 돌아온 뒤에는 이양이 없다
      const keptHost = host.tracker.last()?.me?.isHost === true && guest.tracker.last()?.me?.isHost === false;
      const earlyToasts = hostToasts(await toastsOf(guest.page));
      rec(stage, "HH1", "방장: 유예 안에 돌아오면 변화 없음(방장 그대로, 알림 없음)", keptHost && earlyToasts.length === 0, `방장 유지 ${keptHost}, 알림 ${earlyToasts.length}개`);

      // 긴 끊김: 방장 페이지를 닫는다
      await host.context.close().catch(() => {});
      let handed = true;
      try {
        await guest.tracker.waitFor((v) => v.me.isHost === true, 12_000, "손님이 새 방장");
      } catch {
        handed = false;
      }
      await sleep(400);
      const startBtn = await guest.page.locator("[data-lobby-start]").count();
      const toasts = hostToasts(await toastsOf(guest.page));
      const wantToast = `방장 · ${GAME_GUESTS[0]}`;
      rec(stage, "HH2", "방장: 길게 끊기면 손님이 새 방장 — 알림 '방장 · 이름' 과 [시작] 이 나타남", handed && startBtn === 1 && toasts.includes(wantToast), `이양 ${handed}, [시작] ${startBtn}개, 알림 [${toasts}]`);

      // 옛 방장이 돌아옴: 일반 참가자(자동으로 되돌리지 않는다)
      old = await openHostPage(ctx.browser, { origin: ctx.origin, code: ctx.roomCode, token: hostToken, size: ctx.size, dpr: 1, mobile: ctx.size.mobile !== false, guest: true, initScripts: [reconnectInit] });
      await sleep(600);
      const oldStart = await old.page.locator("[data-lobby-start]").count();
      const oldIsHost = old.tracker.last()?.me?.isHost === true;
      const newStillHost = guest.tracker.last()?.me?.isHost === true;
      rec(stage, "HH3", "방장: 옛 방장이 돌아오면 [시작] 없는 일반 참가자, 새 방장 유지", oldStart === 0 && !oldIsHost && newStillHost && old.tracker.last()?.players?.find((p) => p.seat === gSeat)?.isHost === true && hSeat !== gSeat, `옛 방장 [시작] ${oldStart}개, isHost ${oldIsHost}, 새 방장 유지 ${newStillHost}`);
    } finally {
      await old?.context.close().catch(() => {});
      await guest.context.close().catch(() => {});
    }
  }

  // 2) 결과 단계: 방장이 [나가기] 를 확인하면 즉시 이양 — 손님의 알약이 [시작] 이 되고 나간 이름표가 흐려진다
  {
    const game = await openGame(ctx, id, { guests: 1, bots: 2, role: "mafia", vote: { exec: "yes", pick: "host" }, to: "nomination", guestInitScripts: [reconnectInit] });
    const sc = `${id}/ended`;
    try {
      const { hp, ht, hostSeat, guests } = game;
      const [G] = guests;
      await playRematchGame(game, [G]);
      await G.tracker.waitFor((v) => v.phase === "ended" && v.result !== undefined, 10000, "종료 도달(손님)");
      await Promise.all([settledResult(hp), settledResult(G.page)]);
      const before = await readRematchState(G.page);
      await clearToasts(G.page);
      await hp.locator('[aria-label="나가기"]').first().click({ timeout: 4000 });
      await hp.locator("dialog[open]").getByRole("button", { name: "나가기", exact: true }).click({ timeout: 4000 });
      let handed = true;
      try {
        await G.tracker.waitFor((v) => v.me.isHost === true, 8000, "손님이 새 방장(결과 단계)");
      } catch {
        handed = false;
      }
      await sleep(500);
      const after = await readRematchState(G.page);
      const away = await G.page.evaluate((seat) => document.querySelectorAll(`.mf-world__tags [data-seat="${seat}"] .mv-tag.is-away`).length, hostSeat);
      const toasts = hostToasts(await toastsOf(G.page));
      rec(sc, "HH4", "방장: 결과 단계 [나가기] → 손님 알약 [준비] → [시작], 알림 '방장 · 이름', 나간 이름표 흐림", handed && before?.count === null && after?.count !== null && toasts.includes(`방장 · ${GAME_GUESTS[0]}`) && away === 1, `이양 ${handed}, 전 count ${before?.count}, 후 count ${after?.count}, 알림 [${toasts}], 흐린 이름표 ${away}개`);
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

// 정치 긴장 화면(09.1.1-10·11): 직업 배지·귓속말·지목 핀 조명. 흐름 본문은 politics.mjs, 도우미만 넘긴다
const { politicsBadgeFlow, politicsWhisperFlow, politicsPinFlow, politicsVerdictFlow, politicsRunoffFlow, politicsRunoffTieFlow, politicsShowdownFlow, politicsShowdownTieFlow } = makePoliticsFlows({ recorder, openGame, closeGame, allAt, attempt, gameGH, walkableCentersOfApp, GAME_HOST_NICK });

// 캐릭터 동작·의상 화면(10페이즈): avatar-emote(10-05)·avatar-dress(10-07). 흐름 본문은 avatar.mjs, 도우미만 넘긴다
const { avatarEmoteFlow, avatarDressFlow, avatarPhasesFlow, avatarPhasesNightFlow } = makeAvatarFlows({ recorder, startHost, openGuest, attempt, walkableCentersOfApp, LOBBY_HOST_NICK, WORLD_GUEST_NICK, resetAndLeave, openGame, closeGame, untilGame });

// 맵 선택 화면(11페이즈 11-13): map-select. 흐름 본문은 mapselect.mjs, 도우미만 넘긴다
const { mapSelectFlow } = makeMapSelectFlows({ recorder, startHost, openGuest, attempt, LOBBY_HOST_NICK, WORLD_GUEST_NICK, settledResult });

// 소리(12페이즈): sound-render(12-06) 시험 페이지 오프라인 렌더 56개. 흐름 본문은 sound.mjs, 도우미만 넘긴다
const { soundRenderFlow, soundUnlockFlow, soundScriptFlow, soundNightParityFlow, soundResultFlow } = makeSoundFlows({ recorder, attempt, startHost, openGame, closeGame, nightScenario });

export const FLOWS = [
  // lobby·world 는 LOBBY_SIZES 6개 크기로 돈다: 기본 크기 4개에 더해 390x844·402x874 (run.mjs 의 extraSizes)
  { id: "lobby", run: lobbyFlow, extraSizes: LOBBY_EXTRA_SIZES },
  { id: "world", run: worldFlow, extraSizes: LOBBY_EXTRA_SIZES },
  // 로비 자유 채팅(07-13): 방장·손님 두 페이지로 한 줄이 오가는 트레이서
  { id: "chat-lobby", run: chatLobbyFlow, extraSizes: LOBBY_EXTRA_SIZES },
  // 한글 조합(07-19): CDP imeSetComposition 으로 조합 중 Enter·보내기가 한 번만 보내진다. 크기와 무관해서 자기 크기로 한 번만 돈다
  { id: "chat-ime", run: chatImeFlow, size: { w: 390, h: 844, label: "390x844" } },
  // 위험 1(10-UI-SPEC): 동작 버튼 때문에 입력칸이 160 으로 준 폭 360 에서 한글 조합이 되는지 한 번 더 (10-09)
  { id: "chat-ime-360x560", run: chatImeFlow, size: { w: 360, h: 560, label: "360x560" } },
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
  { id: "result-reveal", run: resultRevealFlow, extraSizes: LOBBY_EXTRA_SIZES },
  { id: "result-awards", run: resultAwardsFlow, extraSizes: LOBBY_EXTRA_SIZES },
  // 다시 하기(11-12): 방장 360×560 + 손님 430×932 실제 페이지 4개 + 봇 1 / 방장 이양은 390×844 한 크기
  { id: "result-rematch", run: resultRematchFlow, size: REMATCH_HOST_SIZE },
  { id: "host-handoff", run: hostHandoffFlow, size: HANDOFF_SIZE },
  // 맵 선택(11-13, MAP-06): 칩·시트·카드 기하, 손님 읽기 전용, 선택 반영, 시작 뒤 같은 맵, 광장 한 판 ended
  { id: "map-select", run: mapSelectFlow, extraSizes: LOBBY_EXTRA_SIZES },
  { id: "chat-game", run: chatGameFlow, size: GAME_SIZE },
  // 13페이즈 기본판(결정 0072): basic-off = 봇 판 한 판 전체(로비 → 낮 → 밤 → 결과)에서 꺼진 장치 DOM·프레임·단계 순서·결과 탭 0건, basic-vote = 8명 투표 화면(이름표 버튼 7개 44×44·무가림, 묶음 G·H). 폰 6종은 basic-vote 만
  { id: "basic-off", run: basicOffFlow, size: GAME_SIZE },
  { id: "basic-vote", run: basicVoteFlow, extraSizes: LOBBY_EXTRA_SIZES },
  // 기본판(결정 0072, 13페이즈)에서 꺼진 장치의 흐름 7개(politics-badge·whisper·pin·runoff·runoff-tie·showdown·showdown-tie)는 지우지 않고 기본 실행에서 뺀다 — RULESET 을 켰을 때만 --only 로 돈다. politics-verdict(판결 순간 연출, D-06)는 그대로 돈다.
  // 9.1.1 페이즈 정치 긴장(09.1.1-10): 직업 배지(떠 있는 버튼→칩→이름표 배지→말 바꿈)·귓속말(모드→한 줄 시트→당사자만 본문). 둘 다 폰 6종, 방장·손님 두 화면
  { id: "politics-badge", run: politicsBadgeFlow, extraSizes: LOBBY_EXTRA_SIZES, skipByDefault: true },
  { id: "politics-whisper", run: politicsWhisperFlow, extraSizes: LOBBY_EXTRA_SIZES, skipByDefault: true },
  // 지목 차례 핀 조명(09.1.1-11): 모이는 중 없음 → 차례 주인에게 켜짐 → 확정 때 0.9초 이동 → 끝 알림에서 꺼짐. window.__mfPin 훅을 읽는다. 폰 6종
  { id: "politics-pin", run: politicsPinFlow, extraSizes: LOBBY_EXTRA_SIZES, skipByDefault: true },
  // 판결 순간(09.1.1-13): 처형 진입 기준 어둡게 막·핀·줌·찬성/반대 묶음 시간표, 8인판 R=4 배치, 채팅 카드, 새로 고침 즉시 표시. 폰 6종
  { id: "politics-verdict", run: politicsVerdictFlow, extraSizes: LOBBY_EXTRA_SIZES },
  // 동점 결선(09.1.1-14): 사람 4명이 2:2 동점 → 결선 투표(바꾸기·done 체크·득표 배지) → 변론. 폰 6종 / 결선도 동점이면 처형 없음 → 밤 한 번
  { id: "politics-runoff", run: politicsRunoffFlow, extraSizes: LOBBY_EXTRA_SIZES, skipByDefault: true },
  { id: "politics-runoff-tie", run: politicsRunoffTieFlow, size: GAME_SIZE, skipByDefault: true },
  // 마지막 3인 결전(09.1.1-16): 방장 처형 → 산 손님 셋의 한마디 3번 → 동시 지목 → 공개 → 2표 처형, 폰 6종
  { id: "politics-showdown", run: politicsShowdownFlow, extraSizes: LOBBY_EXTRA_SIZES, skipByDefault: true },
  { id: "politics-showdown-tie", run: politicsShowdownTieFlow, size: GAME_SIZE, skipByDefault: true },
  // 10-05: 동작 버튼·5+4 판·두 페이지 도착·연타 무시·걷는 중 비활성. 폰 6종 전체는 마지막 계획이 돈다(D-18)
  { id: "avatar-emote", run: avatarEmoteFlow, extraSizes: LOBBY_EXTRA_SIZES },
  // 10-07: 꾸미기 버튼·시트·카드 기하, 두 페이지 look 반영, 게임 시작 뒤 유지와 게임 단계에 버튼 없음
  { id: "avatar-dress", run: avatarDressFlow, extraSizes: LOBBY_EXTRA_SIZES },
  // 10-08: 단계별 동작 도착(낮 토론·지목·변론·찬반·아침)·유령→산 사람 0건·떠 있는 버튼 숨김·이름표 층 표시 없음 / 밤 마피아→시민 편 0건. 390x844 한 크기(D-18)
  { id: "avatar-phases", run: avatarPhasesFlow, size: GAME_SIZE },
  { id: "avatar-phases-night", run: avatarPhasesNightFlow, size: GAME_SIZE },
  // 12-06: 소리 시험 페이지 [전부 계산] 56개(피크·NaN·RMS·길이). 방 없이 390x844 한 크기, 소리 출력 없음(OfflineAudioContext)
  { id: "sound-render", run: soundRenderFlow, size: GAME_SIZE },
  // 12-07: 소리 켜기·끄기·잠금 해제 — [방 만들기] 탭 → running, 단추 토글, 새로고침 두 갈래(끔=알약 없음 · 켬=알약→탭→running), 숨김→suspended, 단추 위치·겹침. 폰 6종 구성(extraSizes)은 12-12 가 합쳤다
  { id: "sound-unlock", run: soundUnlockFlow, extraSizes: LOBBY_EXTRA_SIZES },
  // 12-08: 로비 → 시작 → 역할 확인 → 낮 → 지목 → 변론 → 찬반 단계마다 훅 로그에 기대 소리 id 가 순서대로 + 새로고침은 침대만. 테스트 방 + 봇 + testSkip, 390x844 한 크기(D-21)
  { id: "sound-script", run: soundScriptFlow, size: GAME_SIZE },
  // 12-09: 밤 소리 동일성 — 방장(마피아) + 비마피아 손님 셋의 밤 로그가 같은 id 집합·큐 2~4개, 밤 UI 무음, 암살음은 피해자 페이지에만 1회, 밤 중간 새로고침은 night.fall 없음. 밤 30초를 실제로 기다린다
  { id: "sound-night-parity", run: soundNightParityFlow, size: GAME_SIZE },
  // 12-11: 결과·시상 소리 — ended 도착부터 role.flip 개수(최대 8)·result.win/lose 1회·award.plate(패 수−1)·award.final 1회·순서, 새로고침은 bed.result 만. 무대 탭 건너뛰기 변형 한 판 포함. 390x844 한 크기
  { id: "sound-result", run: soundResultFlow, size: GAME_SIZE },
  // 재접속·예산(06-18): 폰 크기와 곱하지 않고 자기 크기로 한 번. deployhold 는 배포와 동시에 돌리는 흐름(06-19)이라 --only 없이는 빠진다
  { id: "reconnect", run: reconnectFlow, size: RECONNECT_SIZE },
  { id: "deployhold", run: deployHoldFlow, size: RECONNECT_SIZE, skipByDefault: true },
  { id: "perfbudget", run: perfBudgetFlow, size: PERF_SIZE },
  // 크기 고정 흐름(05-07): 폰 크기와 무관해서 크기 목록과 곱하지 않고 자기 크기로 한 번만 돈다
  { id: "pc", run: pcFlow, size: { w: 1280, h: 800, label: "1280x800", mobile: false } },
  { id: "wakelock", run: wakeLockFlow, size: { w: 360, h: 640, label: "360x640" } },
];
export { SetupError };
