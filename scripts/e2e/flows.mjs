// 화면 E2E 흐름(결정 0025): 흐름마다 새 테스트 방 하나와 방장 페이지 하나. 검사 ID 는 계획 261025-h1j 의 "검사 목록" 과 같다.
// 결과는 { scenario: "흐름/상태", size, id, label, ok, detail } 로 ctx.results 에 쌓인다.
import { join } from "node:path";
import { mkdirSync, readFileSync, utimesSync } from "node:fs";
import {
  SetupError,
  armIntroWatch,
  armVerdictWatch,
  backToLobby,
  chooseRole,
  clearToasts,
  consoleCollector,
  clickAt,
  clickInDialog,
  clickTopmostPoint,
  closeRoleCard,
  closeSheet,
  collectSnapshot,
  createTestRoom,
  dropSockets,
  findBlankScenePoint,
  findTagPassThroughPoint,
  hitsInputSurface,
  imeCompose,
  imeEnter,
  inspectSeat,
  joinTestRoom,
  leaveFromResult,
  leaveLobby,
  openChatHistory,
  openGuestJoinPage,
  openHostPage,
  openPerfPage,
  openRoleCard,
  openTestSheet,
  pickCandidate,
  pickChip,
  readAtmosphere,
  readLinkState,
  readChatLines,
  readChatPanel,
  readChannelTraces,
  readTablePanel,
  readLobbyFrame,
  readPaintStats,
  readWorld,
  reconnectInit,
  sampleWorld,
  screensOfWorld,
  readBackdropLayers,
  readGuide,
  readJoinFit,
  readHeaderContrast,
  readIntroWatch,
  readSceneIntro,
  readStage,
  readTokenColors,
  readVerdict,
  readVerdictWatch,
  rebaseSeries,
  resetAndLeave,
  sampleSeries,
  selectRoleCardTab,
  setBotVote,
  setBots,
  setLifecycle,
  settle,
  shot,
  skipTo,
  sleep,
  startGame,
  tapAt,
  tapSeat,
  tapWorld,
  typeAndSendChat,
  voteAs,
  waitChatLine,
  waitBackdropStable,
  waitPhaseIn,
  waitWorldReady,
} from "./browser.mjs";
import {
  INTRO_GONE_MS,
  JOIN_FIT_MIN_H,
  LOBBY_EXTRA_SIZES,
  RECONNECT_KINDS,
  RECONNECT_ROUNDS,
  REOPEN_ROUNDS,
  RESTORED_GONE_MS,
  ROLE_NAME,
  TAP_MIN,
  WORLD_SYNC_TOL,
  backdropSceneChecks,
  budgetChecks,
  cancelTapChecks,
  chunkFailChecks,
  candidateChecks,
  candidateGuideChecks,
  candidateRevealMs,
  claimChatIssues,
  colorRuleChecks,
  consoleIssues,
  contextLeakChecks,
  dayChecks,
  defenseChecks,
  dimChecks,
  docHeightChecks,
  executionChecks,
  feltGapChecks,
  feltStable,
  genericIssues,
  glowChecks,
  guideChecks,
  headerContrastChecks,
  inspectChecks,
  introChecks,
  isLocalOrigin,
  isWorldChunkUrl,
  joinFitChecks,
  journalChecks,
  lineCount,
  livingRoleArtChecks,
  memoryStableChecks,
  morningCardIssues,
  morningGoneChecks,
  sceneIntroChecks,
  noNightNoticeChecks,
  placementChecks,
  rectInside,
  rectsOverlap,
  revealChecks,
  roleCardButtonChecks,
  roleCardTabChecks,
  spectatorChecks,
  stageStable,
  tagsOverlap,
  turnChecks,
  crownChecks,
  lobbyHeaderChecks,
  lobbyStartChecks,
  nameTagFitChecks,
  ownTagInStageChecks,
  paintedFromStats,
  parseBarMask,
  pickTapTargets,
  deployHoldChecks,
  deployObservedOf,
  reconnectChecks,
  reconnectSummary,
  tagStackChecks,
  walkableCenters,
  worldSyncChecks,
  vignetteChecks,
  voidCardChecks,
  voteChecks,
  resultChecks,
  pcCenterChecks,
  wakeLockChecks,
} from "./lib.mjs";

export const OUT_DIR = new URL("./out/", import.meta.url).pathname;
const HOST_NICK = "화면검사기";
/** lobby·world 흐름의 방장 닉네임: 전각 8자(결정 0052-2·0056 c) — 내 이름표 "… (나)" 가 가장 넓은 한글 경우다. */
const LOBBY_HOST_NICK = "방장이름여덟글자";
/** world 흐름의 손님 닉네임: 전각 8자. */
const WORLD_GUEST_NICK = "손님이름여덟글자";
/** 내 이름표 폭 측정 전용 손님: 이모지 8개(06-12 가 약 202px 로 쟀다). 통과·실패에 쓰지 않고 잰 값만 기록한다. */
const EMOJI_NICK = "😀😃😄😁😆😅🤣😂";
/** spec4: 방장이 첫 밤에 탈락할 때까지 같은 방에서 다시 시작하는 최대 횟수 */
const SPEC_MAX_NIGHTS = 8;

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
export async function checkState(ctx, flowId, state) {
  const rec = recorder(ctx);
  const { page } = ctx.host;
  const snap = await collectSnapshot(page);
  snap.issues = ctx.host.takeIssues();
  if (ctx.shots) {
    mkdirSync(OUT_DIR, { recursive: true });
    await shot(page, join(OUT_DIR, `${flowId}-${state}-${ctx.size.label}.png`));
  }
  const g = genericIssues(snap, ctx.size);
  const bad = g.filter((x) => !x.ok);
  const relaxedG = g.filter((x) => x.ok && x.relaxed === true); // 결정 0056 개정(G2-8ch) 적용 내용은 통과 행에 남긴다
  rec(`${flowId}/${state}`, "G", "G 공통 검사", bad.length === 0, bad.length > 0 ? bad.map((x) => `${x.id} ${x.detail}`).join(" / ") : relaxedG.map((x) => `${x.id} ${x.detail}`).join(" / "), relaxedG.length > 0);
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

  // 8명: 점 8개가 모두 켜지고, 8자 이름 8개가 한 맵에서 잘리지 않는다 + 겹친 이름표는 앞뒤가 정해진다
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
    const ranked = pickTapTargets(onScreen, from, { minDist: 3 });
    const probe = ranked.slice(0, 40);
    const [gHits, hHits] = await Promise.all([hitsInputSurface(gp, probe), hitsInputSurface(hp, probe.map((c) => ({ sx: c.hx, sy: c.hy })))]);
    const target = probe.find((_, i) => gHits[i] && hHits[i]);
    if (!target) throw new SetupError(`탭할 목적지를 찾지 못함(두 화면에 보이는 칸 ${onScreen.length}개, 3 단위 이상 먼 칸 ${ranked.length}개)`);

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
      rec(sc, "W5", "걷는 길이가 충분함(≥ 1.5초)", dur >= 1500, `구간 ${Math.round(dur)}ms (목적지까지 ${Math.round(Math.hypot(target.x - from.x, target.z - from.z) * 100) / 100} 단위)`);

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

// ---- chat-table (테이블 화면 자유 채팅, 07-15, CHAT-01·02·03) ----

/** chat-table 에서 방장이 낮 토론에 보내는 글 */
const CHAT_TABLE_TEXT = "저는 시민이에요";
/** chat-table 에서 마피아 방장이 밤에 보내는 글 */
const CHAT_MAFIA_TEXT = "오늘 밤은 조용히 가요";
/** chat-ghost 에서 탈락한 방장이 보내는 글 */
const CHAT_GHOST_TEXT = "나는 유령이에요";
// 테이블 채팅 패널 치수(UI-SPEC 구조 표). src/game/chatUi.ts 의 값을 그대로 옮긴 사본이다 — 값을 바꾸려면 UI-SPEC 과 chatUi.ts 를 먼저 바꾼다.
const CHAT_TABLE_EXTRA = 92;

/** 한 페이지의 테이블 채팅 패널 치수 판정. m 은 readTablePanel 의 값. 검사 행 목록을 돌려준다. */
function tablePanelRows(m) {
  if (!m || !m.hasChat) return [{ id: "TP0", label: "채팅 패널을 읽음", ok: false, detail: m ? "하단 패널에 채팅 패널이 없음" : "하단 패널이 없음" }];
  const logWant = m.roomH >= CHAT_TALL_ROOM_MIN_H ? CHAT_LOG_TALL : CHAT_LOG_SHORT;
  const panelWant = logWant + CHAT_TABLE_EXTRA;
  const near = (a, b) => Math.abs(a - b) <= CHAT_PANEL_EPS;
  const r1 = (n) => Math.round(n * 10) / 10;
  return [
    { id: "TP1", label: `테이블 패널 높이 ${panelWant} (방 높이 ${r1(m.roomH)} → 기록 ${logWant} + ${CHAT_TABLE_EXTRA})`, ok: near(m.panel.height, panelWant), detail: `패널 ${r1(m.panel.height)}` },
    { id: "TP2", label: `기록 칸 높이 ${logWant}`, ok: near(m.log.height, logWant), detail: `기록 칸 ${r1(m.log.height)}` },
    { id: "TP3", label: `입력칸·보내기 높이 ${CHAT_CONTROL}`, ok: near(m.input.height, CHAT_CONTROL) && near(m.send.height, CHAT_CONTROL) && near(m.send.width, CHAT_CONTROL), detail: `입력칸 ${r1(m.input.height)} · 보내기 ${r1(m.send.width)}x${r1(m.send.height)}` },
    { id: "TP4", label: "입력칸 글자 16px", ok: m.inputFont === 16, detail: `${m.inputFont}px` },
    { id: "TP5", label: `보내기 누르는 영역 ≥ ${TAP_MIN} 이고 눌림`, ok: m.send.width + 0.5 >= TAP_MIN && m.send.height + 0.5 >= TAP_MIN && m.send.hit, detail: `${r1(m.send.width)}x${r1(m.send.height)} hit ${m.send.hit}` },
  ];
}

/** 시민 편 화면에 있으면 안 되는 문구(UI-SPEC Copywriting 누설 검사 대상, T-07-40) */
const CHAT_PRIVATE_WORDS = ["마피아 채팅", "마피아끼리만"];

/** 한 화면의 마피아 채널 흔적 0건 판정(문구·aria-label·placeholder·줄·채널 표식). 시민 편 화면과 낮 화면에 건다. */
async function recordNoMafiaTraces(ctx, sc, id, page) {
  const rec = recorder(ctx);
  const t = await readChannelTraces(page, CHAT_PRIVATE_WORDS);
  const bad = [...CHAT_PRIVATE_WORDS.filter((w) => t.hits[w] > 0).map((w) => `"${w}" ${t.hits[w]}건`), t.mafiaLines > 0 ? `마피아 줄 ${t.mafiaLines}` : "", t.ghostLines > 0 ? `유령 줄 ${t.ghostLines}` : "", t.mafiaChannel + t.ghostChannel > 0 ? `비공개 채널 패널 ${t.mafiaChannel + t.ghostChannel}` : ""].filter(Boolean);
  rec(sc, id, "마피아·유령 채널 문구·줄·패널이 0건", bad.length === 0, bad.join(", "));
  return t;
}

/**
 * 테이블 화면 흐름(07-15, CHAT-01·02): 방 하나로 세 판을 돈다.
 * (1) 시민 방장: 낮 토론에서 보낸 한 줄이 기록 칸에 보이고(채널 all, 이름 "나") 하단 높이가 LOG_H + 92, 밤에는 채팅 패널이 없고 마피아 채널 흔적이 0건이다.
 * (2) 마피아 방장: 낮은 시민과 같은 all 패널이고, 밤에는 채널 mafia 패널(입력칸 '마피아 채팅 입력'·'마피아끼리만 보여요')에서 보낸 줄이 data-ch mafia 로만 보인다.
 * 탈락자 화면은 흐름 chat-ghost 가 본다.
 */
async function chatTableFlow(ctx) {
  const rec = recorder(ctx);
  const id = "chat-table";
  const host = await startHost(ctx, id);
  const { page, tracker } = host;
  await settle(page);
  await openTestSheet(page);
  await setBots(page, tracker, 3);
  await chooseRole(page, tracker, "citizen");
  // 결정성: 봇 처형 투표를 모두 반대로 고정 — 처형 없이 밤으로 가서 방장 탈락·종료 우연이 사라진다
  await setBotVote(page, tracker, { exec: "no", pick: "random" });
  await startGame(page, tracker);
  ctx.stage = "play";
  const v0 = tracker.last();
  rec(`${id}/setup`, "S3", "인원·지정 직업", v0.players.length === 4 && v0.me.role === "citizen", `인원 ${v0.players.length}/4, 직업 ${v0.me.role}/citizen`);

  // (1) 시민 방장 — 낮 토론
  await skipTo(page, tracker, "discussion");
  await settle(page);
  const sc = `${id}/discussion`;
  const ch = tracker.last()?.me?.chat;
  rec(sc, "CT0", "서버가 보낸 내 채널은 all", ch === "all", `me.chat ${ch}`);
  await typeAndSendChat(page, CHAT_TABLE_TEXT);
  const arrived = await attempt(async () => {
    await waitChatLine(page, CHAT_TABLE_TEXT);
  });
  rec(sc, "CT1", "방장이 보낸 한 줄이 기록 칸에 보임", arrived.ok, arrived.detail);
  if (arrived.ok) {
    const mine = ((await readChatLines(page)) ?? []).filter((l) => l.text === CHAT_TABLE_TEXT);
    rec(sc, "CT2", "그 줄은 정확히 한 번, 채널 all, 이름 '나', 보낸 자리는 방장", mine.length === 1 && mine[0].ch === "all" && mine[0].name === "나" && mine[0].seat === String(v0.me.seat), `${mine.length}줄 · ch ${mine[0]?.ch} · 이름 "${mine[0]?.name}" · seat ${mine[0]?.seat}`);
    const cleared = await page.locator("[data-chat-input]").inputValue();
    rec(sc, "CT3", "보낸 뒤 입력칸이 비워짐", cleared === "", `입력칸 ${cleared.length}자`);
  }
  for (const r of tablePanelRows(await readTablePanel(page))) rec(sc, r.id, r.label, r.ok, r.detail);
  await recordNoMafiaTraces(ctx, sc, "CT4", page);
  await checkState(ctx, id, "discussion"); // G 공통 검사 (콘솔 오류·가로 넘침·누르기 크기·글자 크기)

  // (1) 시민 방장 — 밤: 채팅 패널이 없고(기존 NightPanel) 마피아 채널 흔적이 0건
  await skipTo(page, tracker, "night");
  await settle(page);
  {
    const scn = `${id}/night-citizen`;
    const m = await readTablePanel(page);
    rec(scn, "CN1", "시민 방장의 밤 하단에는 채팅 패널이 없고 하단 패널은 기존 높이다", !!m && !m.hasChat, m ? `채팅 패널 ${m.hasChat} · 패널 높이 ${Math.round(m.panel.height)}` : "하단 패널이 없음");
    const t = await recordNoMafiaTraces(ctx, scn, "CN2", page);
    rec(scn, "CN3", "문서에 채팅 입력칸·기록 칸이 없다", t.panels === 0, `채팅 패널 ${t.panels}개`);
    await checkState(ctx, id, "night-citizen");
  }

  // (2) 마피아 방장: 같은 방을 대기실로 되돌려 직업만 바꾼다
  await backToLobby(page, tracker);
  await page.waitForTimeout(800); // 대기실 화면이 다시 그려지는 동안 시트 닫기 버튼이 움직인다
  await openTestSheet(page);
  await chooseRole(page, tracker, "mafia");
  await startGame(page, tracker);
  rec(`${id}/setup-mafia`, "S4", "다시 시작한 판의 방장 직업이 마피아", tracker.last()?.me?.role === "mafia", `직업 ${tracker.last()?.me?.role}`);
  await skipTo(page, tracker, "discussion");
  await settle(page);
  {
    const scd = `${id}/discussion-mafia`;
    const m = await readTablePanel(page);
    rec(scd, "CM1", "낮의 마피아 방장도 채널 all 패널이다(마피아 문구 없음)", !!m && m.hasChat && m.channel === "all" && m.inputLabel === "채팅 입력", m ? `채널 ${m.channel} · 이름 "${m.inputLabel}"` : "하단 패널이 없음");
    await recordNoMafiaTraces(ctx, scd, "CM2", page);
  }
  await skipTo(page, tracker, "night");
  await settle(page);
  {
    const scn = `${id}/night-mafia`;
    const nch = tracker.last()?.me?.chat;
    rec(scn, "NM0", "서버가 보낸 밤 채널은 mafia", nch === "mafia", `me.chat ${nch}`);
    const m = await readTablePanel(page);
    rec(scn, "NM1", "밤의 마피아 하단은 채널 mafia 패널: 입력칸 '마피아 채팅 입력'·안내 '마피아끼리만 보여요'", !!m && m.hasChat && m.channel === "mafia" && m.inputLabel === "마피아 채팅 입력" && m.inputHint === "마피아끼리만 보여요", m ? `채널 ${m.channel} · 이름 "${m.inputLabel}" · 안내 "${m.inputHint}"` : "하단 패널이 없음");
    await typeAndSendChat(page, CHAT_MAFIA_TEXT);
    const got = await attempt(async () => {
      await waitChatLine(page, CHAT_MAFIA_TEXT);
    });
    rec(scn, "NM2", "마피아가 보낸 한 줄이 기록 칸에 보임", got.ok, got.detail);
    const lines = (await readChatLines(page)) ?? [];
    const mine = lines.filter((l) => l.text === CHAT_MAFIA_TEXT);
    rec(scn, "NM3", "그 줄은 정확히 한 번, 채널 mafia, 이름 '나'", mine.length === 1 && mine[0].ch === "mafia" && mine[0].name === "나", `${mine.length}줄 · ch ${mine[0]?.ch} · 이름 "${mine[0]?.name}"`);
    rec(scn, "NM4", "밤 기록의 사람 줄은 모두 mafia 채널이다(낮의 공개 줄이 섞이지 않는다)", lines.length > 0 && lines.every((l) => l.ch === "mafia"), lines.map((l) => l.ch).join(","));
    const sys = await page.evaluate(() => [...document.querySelectorAll("[data-chat-log] .mv-chat__sys")].map((p) => (p.textContent ?? "").trim()));
    rec(scn, "NM5", "기록에 '밤 · 마피아 채팅' 시스템 줄이 한 번", sys.filter((t) => t === "밤 · 마피아 채팅").length === 1, `시스템 줄 ${JSON.stringify(sys)}`);
    for (const r of tablePanelRows(await readTablePanel(page))) rec(scn, `N${r.id}`, r.label, r.ok, r.detail);
    await checkState(ctx, id, "night-mafia");
  }
}

/**
 * 탈락자 화면 흐름(07-15, CHAT-03): 봇이 모두 찬성하고 방장을 후보로 골라 방장을 처형시킨 뒤, 탈락한 방장의 밤 화면이
 * 채널 ghost 패널('유령 채팅 입력'·'유령끼리만 보여요')이고 보낸 줄이 data-ch ghost 로 보이며 '유령 채팅 · 산 사람에게 안 보여요' 줄이 한 번 있다.
 */
async function chatGhostFlow(ctx) {
  const rec = recorder(ctx);
  const id = "chat-ghost";
  const host = await startHost(ctx, id);
  const { page, tracker } = host;
  await settle(page);
  await openTestSheet(page);
  await setBots(page, tracker, 3);
  await chooseRole(page, tracker, "citizen");
  await setBotVote(page, tracker, { exec: "yes", pick: "host" });
  await startGame(page, tracker);
  ctx.stage = "play";
  await skipTo(page, tracker, "discussion");
  await skipTo(page, tracker, "execVote");
  await voteAs(page, tracker, "찬성");
  await page.waitForFunction(() => (document.querySelector(".mf-execvote__tally")?.textContent ?? "").includes("모두 냈어요"), null, { timeout: 8000 }).catch(() => {});
  await skipTo(page, tracker, "candidateVote");
  await sleep(7000); // 봇 후보 선택(1~6초)이 끝나도록
  await skipTo(page, tracker, "candidateVoteReveal");
  await skipTo(page, tracker, "defense");
  await skipTo(page, tracker, "execution");
  await skipTo(page, tracker, "night");
  await settle(page);
  if (!isDeadView(tracker.last())) throw new SetupError("방장이 처형되지 않아 탈락자 화면이 아님");
  const sc = `${id}/night-ghost`;
  const gch = tracker.last()?.me?.chat;
  rec(sc, "GH0", "서버가 보낸 탈락자 채널은 ghost", gch === "ghost", `me.chat ${gch}`);
  const m = await readTablePanel(page);
  rec(sc, "GH1", "탈락자의 밤 하단은 채널 ghost 패널: '유령 채팅 입력'·'유령끼리만 보여요'", !!m && m.hasChat && m.channel === "ghost" && m.inputLabel === "유령 채팅 입력" && m.inputHint === "유령끼리만 보여요", m ? `채널 ${m.channel} · 이름 "${m.inputLabel}" · 안내 "${m.inputHint}"` : "하단 패널이 없음");
  await typeAndSendChat(page, CHAT_GHOST_TEXT);
  const got = await attempt(async () => {
    await waitChatLine(page, CHAT_GHOST_TEXT);
  });
  rec(sc, "GH2", "탈락자가 보낸 한 줄이 기록 칸에 보임", got.ok, got.detail);
  const lines = (await readChatLines(page)) ?? [];
  const mine = lines.filter((l) => l.text === CHAT_GHOST_TEXT);
  rec(sc, "GH3", "그 줄은 정확히 한 번, 채널 ghost, 이름 '나'", mine.length === 1 && mine[0].ch === "ghost" && mine[0].name === "나", `${mine.length}줄 · ch ${mine[0]?.ch} · 이름 "${mine[0]?.name}"`);
  const sys = await page.evaluate(() => [...document.querySelectorAll("[data-chat-log] .mv-chat__sys")].map((p) => (p.textContent ?? "").trim()));
  rec(sc, "GH4", "기록에 '유령 채팅 · 산 사람에게 안 보여요' 시스템 줄이 한 번", sys.filter((t) => t === "유령 채팅 · 산 사람에게 안 보여요").length === 1, `시스템 줄 ${JSON.stringify(sys)}`);
  for (const r of tablePanelRows(await readTablePanel(page))) rec(sc, `G${r.id}`, r.label, r.ok, r.detail);
  await checkState(ctx, id, "night-ghost");
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

// ---- 게임 흐름(과제 2) ----

/**
 * 흐름 끝의 D9(이름표끼리 안 겹침): 모은 낮 장면 상태 전부를 본다. 결정 0056 완화(6 그래핌 이상 이름이 낀 겹침)만 있으면 통과 행에 그 내용을 남긴다.
 * 완화 범위 밖 겹침이 하나라도 있으면 실패다.
 */
function recD9(rec, scenario, days) {
  const rs = days.map((d) => ({ d, r: tagsOverlap(d.tags) }));
  const bad = rs.filter((x) => !x.r.ok);
  if (bad.length > 0) {
    rec(scenario, "D9", "이름표끼리 안 겹침", false, bad.map((x) => `${x.d.state}: ${x.r.detail}`).join("; "));
    return;
  }
  const relaxed = rs.filter((x) => x.r.relaxed === true);
  rec(scenario, "D9", "이름표끼리 안 겹침", true, relaxed.map((x) => `${x.d.state}: ${x.r.detail}`).join("; "), relaxed.length > 0);
}

/** 낮 장면 상태(claim·discussion·night·morning) 한 장: 스냅숏 + G + D1~D6·D8 + T2. 테이블 면·이름표·장면 상자는 흐름 끝의 D7·D9·T1 용으로 모아 둔다. */
async function dayState(ctx, flowId, state) {
  const rec = recorder(ctx);
  const snap = await checkState(ctx, flowId, state);
  const mySeat = ctx.host.tracker.last()?.me?.seat ?? -1;
  for (const r of dayChecks(snap, { w: ctx.size.w, h: ctx.size.h })) rec(`${flowId}/${state}`, r.id, r.label, r.ok, r.detail, r.relaxed === true);
  recOne(rec, `${flowId}/${state}`, crownChecks(snap, { expect: 0 })); // W1: 게임 중에는 왕관이 없다
  const stage = await readStage(ctx.host.page);
  const t2 = feltGapChecks(stage);
  rec(`${flowId}/${state}`, t2.id, t2.label, t2.ok, t2.detail);
  (ctx.dayStates ??= []).push({ state, felt: snap.felt, tags: snap.tags, stage, mySeat });
  return { snap, mySeat };
}

/**
 * 역할 배정 장면 한 장: 테이블 면·이름표·장면 상자를 흐름 끝의 D7·D9·T1 용으로 모아 둔다(스냅숏·G 는 안 돌린다).
 * 대기실은 맵이라 고정 테이블이 없다 — 06-17 에서 대기실 호출과 대기실 전용 검사(왕관 W1·자리 모양 L6)를 지웠다.
 */
async function grabLobbyStage(ctx, state, waitMs = 0) {
  if (waitMs > 0) await sleep(waitMs);
  const stage = await readStage(ctx.host.page);
  const mySeat = ctx.host.tracker.last()?.me?.seat ?? -1;
  (ctx.dayStates ??= []).push({ state, felt: stage.felt, tags: stage.tags, stage, mySeat });
}

/**
 * 지금 할 일 문장 하나·한 줄·타이머(UX1)와 문서 높이(UX2)를 한 번에 기록한다(05-06, D-08, D-10).
 * 읽는 동안 추적 단계가 phase 에서 벗어났으면 다른 장면의 값이므로 기록하지 않고 false 를 돌려준다(짧은 단계 — 배정 3초·낮 시작 2초 — 의 "이미 지났으면 건너뛴다" 규칙).
 */
async function guideState(ctx, flowId, state, phase) {
  const rec = recorder(ctx);
  const { page, tracker } = ctx.host;
  const g = await readGuide(page);
  if (tracker.last()?.phase !== phase) return false;
  const sc = `${flowId}/${state}`;
  recOne(rec, sc, guideChecks(g, { phase }));
  recOne(rec, sc, docHeightChecks(g, { h: ctx.size.h }));
  return true;
}

/** 역할 배정(3초 창)에서 부르는 콜백: 장면을 모으고(D7·D9·T1) 안내 문장·문서 높이를 읽는다. */
const onAssigningOf = (ctx, flowId) => async () => {
  await grabLobbyStage(ctx, "assigning");
  await guideState(ctx, flowId, "assigning", "assigning");
};

/**
 * 분위기 두 층(AT1 비네팅·AT2 밝아짐)을 기록한다(05-06). vignette·glow 는 기대 개수(1 또는 0).
 * 읽는 동안 추적 단계가 phase 에서 벗어났으면 SetupError(스냅숏 중 단계 변경, 기존 규칙) — 층은 단계에 묶인 값이다.
 */
async function atmosphereState(ctx, flowId, state, phase, { vignette, glow }) {
  const rec = recorder(ctx);
  const { page, tracker } = ctx.host;
  const a = await readAtmosphere(page, { mySeat: tracker.last()?.me?.seat ?? null });
  if (tracker.last()?.phase !== phase) throw new SetupError(`${state} 분위기 층 측정 중에 단계가 ${tracker.last()?.phase} 로 바뀜 (기대 ${phase})`);
  const sc = `${flowId}/${state}`;
  recOne(rec, sc, vignetteChecks(a, { expect: vignette }));
  recOne(rec, sc, glowChecks(a, { expect: glow }));
}

/**
 * 배경 장면(B1)과 헤더 글씨 대비(H1). 배경 크로스페이드가 끝나(한 층) 시작 문구가 없을 때 잰다.
 * 재는 동안 추적 단계가 phase 에서 벗어났으면(아침 5초 등) 값이 다른 장면의 것이므로 준비 실패(SetupError)로 알려 새 방으로 한 번 다시 돈다.
 * expectTimer: 타이머가 있어야 하는 상태(대기실은 거짓).
 */
async function stageChecks(ctx, flowId, state, phase, { expectTimer = true } = {}) {
  const rec = recorder(ctx);
  const { page, tracker } = ctx.host;
  await waitBackdropStable(page);
  const layers = await readBackdropLayers(page);
  const header = await readHeaderContrast(page);
  if (tracker.last()?.phase !== phase) throw new SetupError(`${state} 배경·헤더 측정 중에 단계가 ${tracker.last()?.phase} 로 바뀜 (기대 ${phase})`);
  recOne(rec, `${flowId}/${state}`, backdropSceneChecks(layers, { phase }));
  recOne(rec, `${flowId}/${state}`, headerContrastChecks(header, { expectTimer }));
  await guideState(ctx, flowId, state, phase); // UX1 안내 문장·타이머 · UX2 문서 높이 (05-06)
}

/**
 * 낮 시작(dayAnnounce) 직후(morning 다음): 문구가 처음 보인 값으로 N8, 같은 시점의 테이블·장면 상자를 ctx.dayStates 에 더해(D7·D9·T1 이 함께 본다),
 * 문구가 3.5초 안에 DOM 에서 사라지는지 N9. 낮 시작은 2초뿐이라 문구는 MutationObserver 로 붙잡고(시간 경쟁 없음) 장면은 시트를 닫자마자 읽는다.
 */
async function dayIntro(ctx, id) {
  const rec = recorder(ctx);
  const { page, tracker } = ctx.host;
  const sc = `${id}/day-intro`;
  await armIntroWatch(page);
  await skipTo(page, tracker, "dayAnnounce");
  const stage = await readStage(page);
  if (tracker.last()?.phase !== "dayAnnounce") throw new SetupError("낮 시작 장면을 읽기 전에 낮 시작(2초)이 끝남");
  const mySeat = mySeatOf(tracker);
  if (ctx.shots) {
    mkdirSync(OUT_DIR, { recursive: true });
    await shot(page, join(OUT_DIR, `${id}-day-intro-${ctx.size.label}.png`)); // 낮 시작 문구가 떠 있는 동안의 사진(--shots 한정)
  }
  (ctx.dayStates ??= []).push({ state: "dayAnnounce", felt: stage.felt, tags: stage.tags, stage, mySeat });
  if (!(await guideState(ctx, id, "day-intro", "dayAnnounce"))) throw new SetupError("낮 시작 안내를 읽는 동안 낮 시작(2초)이 끝남"); // UX1·UX2
  recOne(rec, sc, sceneIntroChecks(await readIntroWatch(page), { kind: "day" })); // N8
  const n9 = await attempt(async () => {
    await page.waitForSelector(".mf-sceneintro", { state: "detached", timeout: 3500 });
    return true;
  });
  rec(sc, "N9", "낮 시작 문구가 사라짐", n9.ok, n9.detail);
}

/** 밤 시작 문구(.mf-sceneintro)가 DOM 에 나타날 때까지 기다린다. 못 나타나면 조용히 돌아간다(읽기 쪽 검사가 `문구 없음` 으로 실패시킨다). */
async function waitSceneIntro(page, ms) {
  try {
    await page.waitForSelector(".mf-sceneintro", { state: "attached", timeout: ms });
  } catch {
    /* 아래 읽기가 null 을 돌려주고 N6 이 실패로 보고한다 */
  }
}

/** 밤 하단·알약·안내 줄 수(N1·N4·N5). 누르기 전 스냅숏으로 본다. */
function nightStaticChecks(ctx, flowId, role, snap) {
  const rec = recorder(ctx);
  const sc = `${flowId}/night`;
  const text = snap.panel?.text ?? "";
  const has = (...words) => words.every((w) => text.includes(w));
  let n1;
  if (role === "police") n1 = { ok: has("조사할 사람을 고르세요", "선택 안 함"), detail: `패널 글자 "${text.slice(0, 60)}"` };
  else if (role === "doctor") n1 = { ok: has("지킬 사람을 고르세요", "선택 안 함"), detail: `패널 글자 "${text.slice(0, 60)}"` };
  else if (role === "citizen") n1 = { ok: has("밤이 되었어요", "이번 밤에는 할 수 있는 행동이 없어요"), detail: `패널 글자 "${text.slice(0, 60)}"` };
  else n1 = { ok: snap.mafiaLog && has("마피아끼리만 보여요", "빠른 메시지"), detail: `마피아 로그 ${snap.mafiaLog}, 패널 글자 "${text.slice(0, 60)}"` };
  rec(sc, "N1", "역할별 하단", n1.ok, n1.detail);

  // N4: 하단 안내 2줄 이하(경찰·의사·시민), 패널 자식이 모두 패널 안
  const bad = [];
  if (role !== "mafia") {
    if (!snap.guide) bad.push("안내 줄 없음");
    else if (lineCount(snap.guide.rect.height, snap.guide.lineHeight) > 2) bad.push(`안내 ${lineCount(snap.guide.rect.height, snap.guide.lineHeight)}줄`);
  }
  for (const c of snap.panel?.children ?? []) if (!rectInside(c.rect, snap.panel.rect)) bad.push(`${c.desc} 이 패널 밖`);
  rec(sc, "N4", "하단 안내 2줄·패널 안", bad.length === 0, bad.slice(0, 4).join("; "));

  // N5: 행위자는 모든 대상 자리를 누를 수 있다
  if (role !== "citizen") {
    const buttons = snap.seats.filter((x) => x.isButton);
    const hidden = buttons.filter((x) => !x.reachable).map((x) => x.seat);
    rec(sc, "N5", "모든 대상 자리를 누를 수 있음", buttons.length > 0 && hidden.length === 0, buttons.length === 0 ? "누를 수 있는 자리가 없음" : `가려진 자리 ${hidden.join(",")}`);
  }
}

async function selState(page, seat) {
  return page.evaluate((n) => {
    const el = document.querySelector(`.mf-dt__seat[data-seat="${n}"]`);
    return { sel: !!el?.querySelector("img.mf-figure--halo-white"), pressed: el?.getAttribute("aria-pressed") === "true", total: document.querySelectorAll("img.mf-figure--halo-white").length, pill: (document.querySelector(".mf-pk")?.textContent ?? "").replace(/\s+/g, " ").trim() };
  }, seat);
}

/** 밤 선택 동작(N2·N3). 행위자는 자리를 눌러 선택 후광을 보고, 시민은 아무 반응이 없어야 한다. */
async function nightActions(ctx, flowId, role, snap, mySeat) {
  const rec = recorder(ctx);
  const sc = `${flowId}/night`;
  const { page, tracker } = ctx.host;
  const view = () => tracker.last();
  const buttonSeats = snap.seats.filter((x) => x.isButton).map((x) => x.seat).sort((a, b) => a - b);

  if (role === "mafia") {
    // N3: 나·동료 자리는 버튼이 아니고, 눌러도 아무 일이 없다
    const allies = view().me.allies ?? [];
    const blockedSeats = [mySeat, ...allies];
    const n3 = await attempt(async () => {
      if (allies.length < 1) return { ok: false, detail: `동료 ${allies.length}명 (8명판 마피아는 2명)` };
      const asButton = snap.seats.filter((x) => blockedSeats.includes(x.seat) && x.isButton).map((x) => x.seat);
      if (asButton.length > 0) return { ok: false, detail: `자리 ${asButton.join(",")} 이 버튼임` };
      for (const seat of blockedSeats) {
        await clickTopmostPoint(page, seat);
        await sleep(700);
        const st = await selState(page, seat);
        if (st.total !== 0 || view().me.pick != null) return { ok: false, detail: `자리 ${seat} 를 눌렀더니 선택 후광 ${st.total}개, me.pick ${view().me.pick}` };
      }
      return true;
    });
    rec(sc, "N3", "마피아 자신·동료 탭 안 됨", n3.ok, n3.detail);
  }

  if (role === "citizen") {
    const n2 = await attempt(async () => {
      if (buttonSeats.length !== 0) return { ok: false, detail: `누를 수 있는 자리 ${buttonSeats.join(",")}` };
      const other = snap.seats.find((x) => x.seat !== mySeat);
      await clickTopmostPoint(page, other.seat);
      await sleep(700);
      const st = await selState(page, other.seat);
      return st.total === 0 && view().me.pick == null ? true : { ok: false, detail: `선택 후광 ${st.total}개, me.pick ${view().me.pick}` };
    });
    rec(sc, "N2", "자리를 누르면 선택 후광(흰)", n2.ok, n2.detail);
    return;
  }

  // 경찰·마피아는 나 아닌 가장 낮은 대상, 의사는 나
  const target = role === "doctor" ? mySeat : (buttonSeats.find((x) => x !== mySeat) ?? -1);
  const n2 = await attempt(async () => {
    if (target < 0 || !buttonSeats.includes(target)) return { ok: false, detail: `대상 자리 ${target} 가 버튼이 아님 (버튼 ${buttonSeats.join(",")})` };
    await tapSeat(page, target);
    await page.waitForFunction((n) => !!document.querySelector(`.mf-dt__seat[data-seat="${n}"] img.mf-figure--halo-white`), target, { timeout: 2000 });
    const st = await selState(page, target);
    await tracker.waitFor((v) => v.me.pick === target, 2000, `me.pick ${target}`);
    const pillOk = role === "mafia" || (st.pill.includes("선택") && !st.pill.includes("선택 안 함"));
    return st.pressed && pillOk ? true : { ok: false, detail: `aria-pressed ${st.pressed}, 알약 "${st.pill}"` };
  });
  rec(sc, "N2", "자리를 누르면 선택 후광(흰)", n2.ok, n2.detail);
}


// ---- 새 계약 도우미(03.1) ----

const mySeatOf = (tracker) => tracker.last()?.me?.seat ?? -1;
const nickOf = (view, seat) => view?.players.find((p) => p.seat === seat)?.nickname ?? "";
const jobNames = (view) => (view?.day?.roles ?? []).map((r) => ROLE_NAME[r]);
const isDeadView = (view) => view?.players.find((p) => p.seat === view.me.seat)?.alive === false;
const recOne = (rec, scenario, r) => rec(scenario, r.id, r.label, r.ok, r.detail, r.relaxed === true || r.info === true);
const recAll = (rec, scenario, list) => {
  for (const r of list) recOne(rec, scenario, r);
};
/** 렌더 두 프레임만 기다린다(짧은 봇 차례 안에서 찍을 때). */
const frames = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

/** 내 차례: 첫 차례는 방장이다(결정 0027-3). K1·K2, 칩 하나를 눌러 잠김(K2b)을 확인한다. */
async function claimMine(ctx, id, role) {
  const rec = recorder(ctx);
  const { page, tracker } = ctx.host;
  const sc = `${id}/claim-mine`;
  await skipTo(page, tracker, "claim");
  await settle(page);
  const mySeat = mySeatOf(tracker);
  const v = tracker.last();
  if (v.phase !== "claim" || v.day?.turn?.seat !== mySeat) throw new SetupError(`첫 차례가 내 자리가 아님 (단계 ${v.phase}, 차례 ${v.day?.turn?.seat}, 내 자리 ${mySeat})`);
  const { snap } = await dayState(ctx, id, "claim-mine");
  recAll(rec, sc, turnChecks(snap, { myTurn: true, jobs: jobNames(v) }));
  const after = tracker.last();
  if (after.phase !== "claim" || after.day?.turn?.seat !== mySeat) throw new SetupError("내 차례 스냅숏 중에 차례가 넘어감");

  // 누른 직후(React 갱신 직후, 서버 답이 오기 전)의 칩 상태를 문서 수준 리스너가 붙잡아 둔다
  await page.evaluate(() => {
    window.__chipAfter = null;
    document.addEventListener(
      "click",
      () => {
        queueMicrotask(() => {
          window.__chipAfter = [...document.querySelectorAll('[aria-label="주장할 직업"] button')].map((b) => ({ t: (b.textContent || "").trim(), p: b.getAttribute("aria-pressed") === "true", d: b.disabled }));
        });
      },
      { once: true, capture: false },
    );
  });
  const label = role === "citizen" ? ROLE_NAME.citizen : jobNames(v)[0];
  const k2b = await attempt(async () => {
    await pickChip(page, tracker, label);
    const chips = await page.evaluate(() => window.__chipAfter);
    if (!chips || chips.length === 0) return { ok: false, detail: "눌린 직후 칩 상태를 읽지 못함" };
    const pressed = chips.filter((c) => c.p).map((c) => c.t);
    const enabled = chips.filter((c) => !c.d).map((c) => c.t);
    return pressed.length === 1 && pressed[0] === label && enabled.length === 0 ? true : { ok: false, detail: `눌린 칩 [${pressed.join(",")}] (기대 ${label}), 켜진 칩 [${enabled.join(",")}]` };
  });
  rec(sc, "K2b", "칩 잠금", k2b.ok, k2b.detail);
}

/** 남의 차례: 봇 차례(0.5~3.5초)가 끝나기 전에 찍는다. 찍는 동안 차례가 넘어갔으면 그 결과를 버리고 다음 남의 차례에서 다시 찍는다. */
async function claimOther(ctx, id) {
  const rec = recorder(ctx);
  const { page, tracker } = ctx.host;
  const mySeat = mySeatOf(tracker);
  const sc = `${id}/claim-other`;
  for (let tries = 0; tries < 3; tries++) {
    const v = await tracker.waitFor((n) => n.phase === "claim" && n.day?.turn !== undefined && n.day.turn.seat !== mySeat, 15_000, "남의 차례");
    const seat = v.day.turn.seat;
    const ends = v.phaseEndsAt;
    const mark = ctx.results.length;
    const dmark = (ctx.dayStates ??= []).length;
    await frames(page);
    const { snap } = await dayState(ctx, id, "claim-other");
    recAll(rec, sc, turnChecks(snap, { myTurn: false }));
    const now = tracker.last();
    if (now.phase === "claim" && now.day?.turn?.seat === seat && now.phaseEndsAt === ends) return;
    ctx.results.length = mark;
    ctx.dayStates.length = dmark;
  }
  throw new SetupError("남의 차례 스냅숏이 매번 차례 전환과 겹침");
}

/** 한 바퀴가 끝난 직후(토론 진입): 채팅 내역 줄(K3), 낮에 캐릭터를 누르면 기록 카드(X1). */
async function claimDone(ctx, id) {
  const rec = recorder(ctx);
  const { page, tracker } = ctx.host;
  const sc = `${id}/claim-done`;
  await skipTo(page, tracker, "discussion");
  await settle(page);
  const v = tracker.last();
  if (v.phase !== "discussion") throw new SetupError(`토론 진입 실패 (지금 ${v.phase})`);
  const alive = v.players.filter((p) => p.alive !== false).length;
  await openChatHistory(page);
  const snap = await collectSnapshot(page);
  // 청크 순서: 주장이 먼저 올라오고 토론 말이 그 뒤에 온다 — 앞의 alive 줄만 본다(토론 중 봇의 줄은 K3 의 대상이 아니다)
  recOne(rec, sc, claimChatIssues(snap.chatHistory.slice(0, alive), { alive }));
  await closeSheet(page, "채팅 내역");

  const mySeat = mySeatOf(tracker);
  const bot = v.players.find((p) => p.seat !== mySeat && p.alive !== false);
  await inspectSeat(page, bot.seat);
  const s2 = await collectSnapshot(page);
  recOne(rec, sc, inspectChecks(s2, { nick: bot.nickname, night: false }));
  await closeSheet(page, `${bot.nickname} 기록`);
}

/** 아침 직후 역할 카드 버튼(R1)과 밤 끝 알림이 없음(R6, 모든 역할). */
function morningRoleChecks(ctx, id, role, snap) {
  const rec = recorder(ctx);
  const sc = `${id}/morning`;
  recOne(rec, sc, roleCardButtonChecks(snap, { unread: role !== "citizen" }));
  recOne(rec, sc, noNightNoticeChecks(snap));
}

/** 경찰·의사: 버튼으로 열어 R2 → 활동 기록 탭 R3 → 시트 G → 닫고 R4. */
async function roleCardViaButton(ctx, id, role) {
  const rec = recorder(ctx);
  const { page } = ctx.host;
  const sc = `${id}/rolecard`;
  await openRoleCard(page);
  recOne(rec, sc, roleCardTabChecks(await collectSnapshot(page), { job: role, unread: true }));
  await selectRoleCardTab(page, "활동 기록");
  const snap = await checkState(ctx, id, "rolecard");
  recOne(rec, sc, journalChecks(snap, { job: role, mode: "viewing" }));
  recOne(rec, sc, livingRoleArtChecks(snap, { myJob: role }));
  await closeRoleCard(page);
  await frames(page);
  const closed = await collectSnapshot(page);
  recOne(rec, sc, journalChecks(closed, { job: role, mode: "closed" }));
  const b = roleCardButtonChecks(closed, { unread: false });
  rec(sc, "R4", "시트를 닫으면 버튼 점 소멸", b.ok, b.detail);
}

/** 시민: 버튼에 점이 없고, 열면 탭 없이 본문(R5). */
async function roleCardCitizen(ctx, id) {
  const rec = recorder(ctx);
  const { page } = ctx.host;
  const sc = `${id}/rolecard`;
  await openRoleCard(page);
  const snap = await checkState(ctx, id, "rolecard");
  recOne(rec, sc, roleCardTabChecks(snap, { job: "citizen", unread: false }));
  recOne(rec, sc, livingRoleArtChecks(snap, { myJob: "citizen" }));
  await closeRoleCard(page);
}

async function gameFlow(ctx, { id, players, role, states }) {
  const rec = recorder(ctx);
  const host = await startHost(ctx, id);
  const { page, tracker } = host;
  await settle(page);

  // 방 설정: 시트 열기 → 봇 → 직업 → 확인 → 시작
  await openTestSheet(page);
  await setBots(page, tracker, players - 1);
  await chooseRole(page, tracker, role);
  // 결정성(04-32): 봇 처형 투표를 모두 반대로 고정 — 모든 skipTo 가 처형 없이 밤으로 가서 방장 탈락·종료 우연이 사라진다(UI-SPEC 15.1·15.4, P-13)
  await setBotVote(page, tracker, { exec: "no", pick: "random" });
  await startGame(page, tracker, { onAssigning: onAssigningOf(ctx, id) });
  await guideState(ctx, id, "role-reveal", "roleReveal"); // UX1·UX2 역할 확인(단계가 이미 지났으면 건너뛴다)
  ctx.stage = "play";
  const v0 = tracker.last();
  const s3Ok = v0.players.length === players && v0.me.role === role;
  rec(`${id}/setup`, "S3", "인원·지정 직업", s3Ok, `인원 ${v0.players.length}/${players}, 직업 ${v0.me.role}/${role}`);

  for (const state of states) {
    if (state === "claim-mine") await claimMine(ctx, id, role);
    else if (state === "claim-other") await claimOther(ctx, id);
    else if (state === "claim-done") await claimDone(ctx, id);
    else if (state === "discussion") {
      await skipTo(page, tracker, "discussion");
      await settle(page);
      await stageChecks(ctx, id, "discussion", "discussion");
      await atmosphereState(ctx, id, "discussion", "discussion", { vignette: 0, glow: 0 }); // AT1·AT2: 토론에는 두 층이 없다
      const { snap } = await dayState(ctx, id, "discussion");
      recAll(rec, `${id}/discussion`, turnChecks(snap, { expectNone: true }));
      if (id === "police5") {
        const bad = snap.buttonTexts.filter((t) => /연장|넘기기/.test(t));
        rec(`${id}/discussion`, "C3", "연장·넘기기 버튼 없음", bad.length === 0, `버튼 ${bad.join(", ")}`);
      }
    } else if (state === "chat") {
      const c1 = await attempt(async () => {
        await openChatHistory(page);
        const title = await page.locator('dialog[aria-label="채팅 내역"] h2').first().textContent();
        return title?.trim() === "채팅 내역" ? true : { ok: false, detail: `제목 "${title?.trim()}"` };
      });
      rec(`${id}/chat`, "C1", "채팅 내역 모달 열림", c1.ok, c1.detail);
      await checkState(ctx, id, "chat");
      const c2 = await attempt(async () => {
        await closeSheet(page, "채팅 내역");
        return (await page.locator('dialog[aria-label="채팅 내역"]').count()) === 0;
      });
      rec(`${id}/chat`, "C2", "채팅 내역 모달 닫힘", c2.ok, c2.detail);
    } else if (state === "night") {
      await skipTo(page, tracker, "night");
      // N6: 밤에 막 들어선 직후(settle 전)에는 '밤이 되었습니다' 문구가 떠 있다. 아래 밤 검사는 문구가 아직 떠 있을 수 있는 시점에도 그대로 돌려
      // 문구가 터치·검사를 방해하지 않는 것을 함께 증명한다(pointer-events none).
      // 04-24 이후 처형 무효로 오는 밤은 회색 무효 카드가 1.6초 먼저 뜨고 시작 문구는 그 뒤 2초다 — 문구가 나타날 때까지 최대 4초 기다린 뒤 읽는다.
      await waitSceneIntro(page, 4000);
      recOne(rec, `${id}/night`, sceneIntroChecks(await readSceneIntro(page)));
      await settle(page);
      const { snap, mySeat } = await dayState(ctx, id, "night");
      recAll(rec, `${id}/night`, turnChecks(snap, { expectNone: true }));
      nightStaticChecks(ctx, id, role, snap);
      await nightActions(ctx, id, role, snap, mySeat);
      // X1(밤): 어떤 자리를 눌러도 기록 카드가 열리지 않는다(행위자는 선택만 됨)
      recOne(rec, `${id}/night`, inspectChecks(await collectSnapshot(page), { night: true }));
      // N7: 문구는 시작 2초 뒤 사라진다(문구가 나타난 뒤를 기준으로 여유를 두어 3.5초 안에 DOM 에서 없어지면 통과 — 위에서 문구가 나타난 것을 기다렸다)
      const n7 = await attempt(async () => {
        await page.waitForSelector(".mf-sceneintro", { state: "detached", timeout: 3500 });
        return true;
      });
      rec(`${id}/night`, "N7", "밤 시작 문구가 사라짐", n7.ok, n7.detail);
      await stageChecks(ctx, id, "night", "night");
      await atmosphereState(ctx, id, "night", "night", { vignette: 1, glow: 0 }); // AT1: 밤 비네팅 한 겹·탭 통과
    } else if (state === "morning") {
      // 아침은 5초라 넘긴 직후 바로 닫고 찍는다. 앞뒤 단계가 morning 이 아니면 준비 실패(재시도).
      await skipTo(page, tracker, "morning");
      await settle(page);
      if (tracker.last()?.phase !== "morning") throw new SetupError("아침 스냅숏 전에 아침이 끝남");
      await stageChecks(ctx, id, "morning", "morning"); // 아침은 5초뿐이라 dayState 보다 먼저(크로스페이드가 끝난 직후) 잰다
      await atmosphereState(ctx, id, "morning", "morning", { vignette: 0, glow: 1 }); // AT1(크로스페이드 끝 → 비네팅 0)·AT2(밝아짐 한 겹)
      const { snap, mySeat } = await dayState(ctx, id, "morning");
      const v = tracker.last();
      if (v?.phase !== "morning") throw new SetupError("아침 스냅숏 중에 아침이 끝남");
      if (isDeadView(v)) throw new SetupError("방장이 첫 밤에 탈락해 살아 있는 사람 흐름이 아님");
      recAll(rec, `${id}/morning`, turnChecks(snap, { expectNone: true }));
      const m1 = morningCardIssues(snap, { w: ctx.size.w, mySeat });
      rec(`${id}/morning`, "M1", m1.label, m1.ok, m1.detail);
      const t = snap.panel?.text ?? "";
      rec(`${id}/morning`, "M2", "하단 '곧 낮 토론이 시작돼요'", t.includes("아침이 밝았습니다") && t.includes("곧 낮 토론이 시작돼요"), `패널 글자 "${t.slice(0, 60)}"`);
      const elim = v.day?.morning?.eliminated;
      recOne(rec, `${id}/morning`, dimChecks(snap, { w: ctx.size.w, expectSpotlit: elim !== undefined && elim !== null }));
      morningRoleChecks(ctx, id, role, snap);
    } else if (state === "day-intro") await dayIntro(ctx, id);
    else if (state === "rolecard-btn") await roleCardViaButton(ctx, id, role);
    else if (state === "rolecard-citizen") await roleCardCitizen(ctx, id);
    else if (state === "next-day") {
      // 아침이 끝난 뒤 첫 낮 장면: 카드·어둡게 층이 없고(M4) 고정물 검사가 그대로 통과한다
      await tracker.waitFor((n) => n.phase === "claim" && (n.day?.n ?? 0) >= 2, 25_000, "다음 낮 직업 공개");
      await settle(page);
      await stageChecks(ctx, id, "next-day", "claim");
      const { snap } = await dayState(ctx, id, "next-day");
      recOne(rec, `${id}/next-day`, morningGoneChecks(snap));
    }
  }

  // 흐름 끝: 낮 장면 상태 전부의 D7(테이블 그대로)·D9(모든 인원 이름표), 살아 있는 사람 V2·V3
  const days = ctx.dayStates ?? [];
  if (days.length >= 2) {
    const f = feltStable(days.map((d) => ({ state: d.state, rect: d.felt })));
    rec(`${id}/table`, "D7", f.label, f.ok, f.detail);
  }
  recD9(rec, `${id}/table`, days);
  const t1 = stageStable(days.map((d) => ({ state: d.state, stage: d.stage, mySeat: d.mySeat })));
  rec(`${id}/table`, t1.id, t1.label, t1.ok, t1.detail);
  const fin = await collectSnapshot(page);
  recOne(rec, `${id}/table`, livingRoleArtChecks(fin, { myJob: role }));
  rec(`${id}/table`, "V3", "살아 있는 사람 view 에 spectate 없음", tracker.last()?.spectate === undefined, "spectate 키가 있음");
  rec(`${id}/setup`, "S4", "단계 도달", true);
  await resetAndLeave(page, tracker);
}

// ---- 관전자 흐름(탈락한 방장) ----

/** 4명판(방장 시민 + 봇 3)에서 방장이 탈락할 때까지 밤을 넘기고, 관전자 화면(V1·M1·M3·X1)을 본다. */
async function specFlow(ctx) {
  const id = "spec4";
  const rec = recorder(ctx);
  const host = await startHost(ctx, id);
  const { page, tracker } = host;
  await settle(page);
  await openTestSheet(page);
  await setBots(page, tracker, 3);
  await chooseRole(page, tracker, "citizen");
  await setBotVote(page, tracker, { exec: "no", pick: "random" }); // 처형 없이 밤 암살로만 방장 탈락(결정성, 04-32)
  await startGame(page, tracker);
  ctx.stage = "play";
  const v0 = tracker.last();
  const mySeat = v0.me.seat;
  rec(`${id}/setup`, "S3", "인원·지정 직업", v0.players.length === 4 && v0.me.role === "citizen", `인원 ${v0.players.length}/4, 직업 ${v0.me.role}/citizen`);

  // 방장 탈락은 밤 암살로만 일어난다(봇 처형 투표 모두 반대). 4명판은 첫 밤에 방장이 죽지 않으면(2/3) 두 번째 밤 뒤 1대1 로 판이 끝나므로(04-08 종료 규칙)
  // 방장이 살아 있으면 같은 방을 [대기실로 되돌리기] 해서 첫 밤부터 다시 한다(방 설정·봇 고정은 되돌려도 남는다). 최대 8번(실패 확률 (2/3)^8 ≈ 4%).
  let dead = false;
  for (let attempt = 1; attempt <= SPEC_MAX_NIGHTS && !dead; attempt++) {
    if (attempt > 1) {
      await openTestSheet(page);
      await clickInDialog(page, "테스트 도구", "대기실로 되돌리기");
      await tracker.waitFor((v) => v.phase === "lobby", 3000, "대기실 복귀");
      await page.waitForTimeout(800); // 대기실 화면이 다시 그려지는 동안 시트 닫기 버튼이 움직인다
      await startGame(page, tracker);
    }
    await skipTo(page, tracker, "claim");
    await skipTo(page, tracker, "discussion");
    await skipTo(page, tracker, "night");
    await sleep(7000); // 봇 밤 지목(1~6초)이 끝나도록
    await skipTo(page, tracker, "morning");
    await settle(page);
    if (tracker.last()?.phase !== "morning") throw new SetupError("아침 스냅숏 전에 아침이 끝남");
    dead = isDeadView(tracker.last());
    if (!dead) continue;

    const sc = `${id}/morning`;
    const { snap } = await dayState(ctx, id, "morning");
    const v = tracker.last();
    if (v?.phase !== "morning") throw new SetupError("아침 스냅숏 중에 아침이 끝남");
    rec(sc, "V1", "관전자 view 에 spectate 있음", !!v.spectate, "spectate 키가 없음");
    const spectate = (v.spectate?.seats ?? []).map((s) => ({ seat: s.seat, job: s.job, alive: v.players.find((p) => p.seat === s.seat)?.alive !== false }));
    recOne(rec, sc, spectatorChecks(snap, { spectate, mySeat }));
    const m1 = morningCardIssues(snap, { w: ctx.size.w, mySeat });
    rec(sc, "M1", m1.label, m1.ok, m1.detail);
    recOne(rec, sc, dimChecks(snap, { w: ctx.size.w, expectSpotlit: true }));
    const mine = snap.seats.find((s) => s.seat === mySeat);
    rec(sc, "M3", "탈락한 방장 자리가 강조됨", !!mine?.spotlit, `내 자리 spotlit ${mine?.spotlit}`);
  }
  if (!dead) throw new SetupError(`${SPEC_MAX_NIGHTS}번의 첫 밤 안에 방장이 탈락하지 않음`);

  const specOf = (v) => (v.spectate?.seats ?? []).map((s) => ({ seat: s.seat, job: s.job, alive: v.players.find((p) => p.seat === s.seat)?.alive !== false }));
  const aliveBot = () => tracker.last().players.find((p) => p.seat !== mySeat && p.alive !== false);

  // 낮: 관전자 테이블 + 캐릭터를 누르면 기록 카드
  await skipTo(page, tracker, "discussion");
  await settle(page);
  {
    const sc = `${id}/discussion`;
    const { snap } = await dayState(ctx, id, "discussion");
    recOne(rec, sc, spectatorChecks(snap, { spectate: specOf(tracker.last()), mySeat }));
    const bot = aliveBot();
    await inspectSeat(page, bot.seat);
    recOne(rec, sc, inspectChecks(await collectSnapshot(page), { nick: bot.nickname, night: false }));
    await closeSheet(page, `${bot.nickname} 기록`);
  }

  // 처형 여부 투표(P9, D-35): 탈락한 방장은 버튼 없이 `관전 중` 알약과 집계 줄만 본다. 봇은 모두 반대라 이 뒤 밤으로 처형 없이 간다
  await skipTo(page, tracker, "execVote");
  await settle(page);
  {
    const sc = `${id}/exec-vote`;
    if (tracker.last()?.phase !== "execVote") throw new SetupError(`처형 여부 투표 읽기 전에 단계가 ${tracker.last()?.phase} 로 바뀜`);
    // 인트로 카드(.mf-vintro, 3초, 낮 테이블 안)가 사라진 뒤에 읽는다 — 카드의 `처형 투표` 글자는 익명 검사(P9)의 대상이 아니다
    await page.waitForSelector(".mf-vintro", { state: "detached", timeout: INTRO_GONE_MS + 2200 }).catch(() => {});
    const colors = await readTokenColors(page);
    recOne(rec, sc, voteChecks(await readVerdict(page, colors), { spectator: true }));
    await checkState(ctx, id, "exec-vote");
    if (tracker.last()?.phase !== "execVote") throw new SetupError(`처형 여부 투표 검사 중에 단계가 ${tracker.last()?.phase} 로 바뀜`);
  }

  // 밤: 관전자는 어떤 자리도 버튼이 아니고 눌러도 아무 카드가 안 열린다
  await skipTo(page, tracker, "night");
  await settle(page);
  {
    const sc = `${id}/night`;
    const { snap } = await dayState(ctx, id, "night");
    recOne(rec, sc, spectatorChecks(snap, { spectate: specOf(tracker.last()), mySeat }));
    const buttons = snap.seats.filter((s) => s.isButton).map((s) => s.seat);
    rec(sc, "V1", "관전자 밤에는 어떤 자리도 버튼이 아님", buttons.length === 0, `버튼 자리 ${buttons.join(",")}`);
    await inspectSeat(page, aliveBot().seat);
    recOne(rec, sc, inspectChecks(await collectSnapshot(page), { night: true }));
  }

  const days = ctx.dayStates ?? [];
  if (days.length >= 2) {
    const f = feltStable(days.map((d) => ({ state: d.state, rect: d.felt })));
    rec(`${id}/table`, "D7", f.label, f.ok, f.detail);
  }
  recD9(rec, `${id}/table`, days);
  const t1 = stageStable(days.map((d) => ({ state: d.state, stage: d.stage, mySeat: d.mySeat })));
  rec(`${id}/table`, t1.id, t1.label, t1.ok, t1.detail);
  rec(`${id}/setup`, "S4", "단계 도달", true);
  await resetAndLeave(page, tracker);
}


// ---- vote5: 처형 구간 전체(04-32, UI-SPEC 15.2) ----

/** 후광 목록에서 앰버를 뺀 스냅숏: 공개 단계의 앰버 후광은 박동 애니메이션 중이라 K4 의 9px 규칙(정지 상태)을 적용하지 않는다(04-31 SUMMARY). 흰·진홍만 본다. */
const withoutAmberHalo = (snap) => ({ ...snap, halo: snap.halo ? { ...snap.halo, items: (snap.halo.items ?? []).filter((h) => h.cls !== "amber") } : snap.halo });

/** 5명(방장 시민 + 봇 4). 봇: 처형 투표 모두 찬성, 후보 선택은 방장 아닌 가장 낮은 자리. 방장은 찬성 후 같은 자리를 고른다. */
async function voteFlow(ctx) {
  const id = "vote5";
  const rec = recorder(ctx);
  const host = await startHost(ctx, id);
  const { page, tracker } = host;
  await settle(page);
  await openTestSheet(page);
  await setBots(page, tracker, 4);
  await chooseRole(page, tracker, "citizen");
  await setBotVote(page, tracker, { exec: "yes", pick: "other" });
  await startGame(page, tracker, { onAssigning: onAssigningOf(ctx, id) });
  ctx.stage = "play";
  const v0 = tracker.last();
  const mySeat = v0.me.seat;
  rec(`${id}/setup`, "S3", "인원·지정 직업", v0.players.length === 5 && v0.me.role === "citizen", `인원 ${v0.players.length}/5, 직업 ${v0.me.role}/citizen`);
  const colors = await readTokenColors(page);
  const read = () => readVerdict(page, colors);
  const colorRule = (sc, v) => recOne(rec, sc, colorRuleChecks(v, { crimsonColors: colors.crimson, wholeScreenCrimson: true })); // 방장이 시민 → 화면 전체 진홍 0 (D-33)
  const still = (phase, what) => {
    if (tracker.last()?.phase !== phase) throw new SetupError(`${what} 중에 단계가 ${tracker.last()?.phase} 로 바뀜 (기대 ${phase})`);
  };

  // 1) discussion
  await skipTo(page, tracker, "discussion");
  await settle(page);
  await stageChecks(ctx, id, "discussion", "discussion");
  {
    const { snap } = await dayState(ctx, id, "discussion");
    recAll(rec, `${id}/discussion`, turnChecks(snap, { expectNone: true }));
  }

  // 2) exec-intro: 관찰자와 시계열 표본기를 단계를 넘기기 전에 시작한다(skipTo 는 시트를 닫느라 약 1초 걸려 카드 도착을 놓친다, 04-31 SUMMARY 4번)
  {
    const sc = `${id}/exec-intro`;
    await armVerdictWatch(page);
    const series = sampleSeries(page, { durationMs: INTRO_GONE_MS + 2000, stepMs: 80, take: () => read() });
    series.catch(() => {}); // 아래에서 await 하기 전에 skipTo 가 던져도 처리 안 된 거부가 되지 않게
    await skipTo(page, tracker, "execVote");
    const clickAt = await page.evaluate(() => performance.now());
    await voteAs(page, tracker, "찬성"); // 카드 위에서 눌러도 통과해야 한다(P2)
    const samples = await series;
    const watch = await readVerdictWatch(page);
    if (watch.introSeenAt === null) throw new SetupError("처형 투표 인트로 카드가 DOM 에 나타나지 않음");
    if (watch.introGoneAt !== null && clickAt >= watch.introGoneAt) throw new SetupError("인트로 카드가 사라진 뒤에 눌러 통과를 확인하지 못함");
    const rebased = rebaseSeries(samples, watch.introSeenAt).map((x) => ({ t: x.t, intro: x.value.intro }));
    recOne(rec, sc, introChecks(rebased, { clickedThrough: tracker.last()?.me?.voteAgree === true }));
    await stageChecks(ctx, id, "exec-intro", "execVote");
  }

  // 3) exec-vote: 카드가 사라진 뒤의 하단·익명·진홍 규칙, 번복
  {
    const sc = `${id}/exec-vote`;
    // 봇이 모두 던져 집계 줄이 가장 긴 문구(`모두 냈어요 · …`)가 된 뒤에 잰다 — 360 폭 한 줄(G2)을 결정적으로 본다(04-33). 안 오면 그대로 진행
    await page.waitForFunction(() => (document.querySelector(".mf-execvote__tally")?.textContent ?? "").includes("모두 냈어요"), null, { timeout: 6000 }).catch(() => {});
    const v = await read();
    still("execVote", "처형 여부 투표 읽기");
    recOne(rec, sc, voteChecks(v));
    colorRule(sc, v);
    const { snap } = await dayState(ctx, id, "exec-vote");
    recAll(rec, sc, turnChecks(snap, { expectNone: true, crimsonAllowed: false })); // K4: 방장이 시민이면 투표 단계에 진홍 후광 0
    await stageChecks(ctx, id, "exec-vote", "execVote");
    const flip = await attempt(async () => {
      const tally = async () => (await read()).bottom.tally.replace(/아직.*$/, "").trim();
      const before = await tally();
      await voteAs(page, tracker, "반대");
      await page.waitForFunction((t) => (document.querySelector(".mf-execvote__tally")?.textContent ?? "").replace(/아직.*$/, "").trim() !== t, before, { timeout: 3000 });
      const after = await tally();
      await voteAs(page, tracker, "찬성");
      return after !== before ? true : { ok: false, detail: `집계 "${before}" → "${after}" 변화 없음` };
    });
    rec(sc, "P1", "번복하면 집계 글자가 바뀜", flip.ok, flip.detail);
    still("execVote", "번복");
  }

  // 4) cand-vote: 자리 규칙·흰 후광 하나가 따라 움직임·알약
  const alive = () => tracker.last().players.filter((p) => p.alive !== false).map((p) => p.seat).sort((a, b) => a - b);
  const deadSeats = () => tracker.last().players.filter((p) => p.alive === false).map((p) => p.seat);
  const others = alive().filter((x) => x !== mySeat);
  const target = others[0];
  const second = others[1];
  {
    const sc = `${id}/cand-vote`;
    await skipTo(page, tracker, "candidateVote");
    await settle(page);
    still("candidateVote", "후보 선택 도착");
    recOne(rec, sc, candidateChecks(await read(), { mySeat, deadSeats: deadSeats(), chosenSeat: null }));
    recOne(rec, sc, candidateGuideChecks(await read(), { picked: false })); // P11: 고르기 전 안내 줄(무효표)
    // 결정 0040: 고른 뒤 안내 줄(P11), 이름표를 통과한 탭은 표를 지우지 않고 빈 곳 탭은 지운다(P12). 점을 못 찾으면 측정값을 null 로 넘겨 P12 가 `측정값 없음` 으로 실패한다(건너뛰지 않는다)
    {
      await pickCandidate(page, tracker, target);
      recOne(rec, sc, candidateGuideChecks(await read(), { picked: true }));
      const tagPt = await findTagPassThroughPoint(page, target);
      let afterTag = null;
      if (tagPt) {
        await clickAt(page, tagPt); // 터치 탭은 탭 보정으로 좌석 버튼에 가므로 보정 없는 클릭으로 이름표를 통과시킨다(browser.mjs clickAt)
        await sleep(600);
        afterTag = { voteTarget: tracker.last()?.me?.voteTarget, pill: (await read()).bottom.pill };
      }
      const blankPt = await findBlankScenePoint(page);
      let afterBlank = null;
      if (blankPt) {
        await tapAt(page, blankPt);
        await tracker.waitFor((v) => v.me?.voteTarget === undefined, 3000, "빈 곳 탭 뒤 표 취소").catch(() => {}); // 시간 초과는 판정(P12)에 맡긴다
        const after = await read();
        afterBlank = { voteTarget: tracker.last()?.me?.voteTarget, pill: after.bottom.pill, halos: after.dt.haloImgs.filter((h) => h.kind === "white").length };
      }
      recOne(rec, sc, cancelTapChecks({ chosenSeat: target, afterTag, afterBlank }));
      recOne(rec, sc, candidateChecks(await read(), { mySeat, deadSeats: deadSeats(), chosenSeat: null }));
      recOne(rec, sc, candidateGuideChecks(await read(), { picked: false }));
      still("candidateVote", "취소 검사");
    }
    const moved = await attempt(async () => {
      await pickCandidate(page, tracker, second);
      recOne(rec, sc, candidateChecks(await read(), { mySeat, deadSeats: deadSeats(), chosenSeat: second, name: nickOf(tracker.last(), second) }));
      await pickCandidate(page, tracker, target);
    });
    rec(sc, "P3", "다른 자리를 눌렀다 돌아오면 후광이 따라 움직임", moved.ok, moved.detail);
    const v = await read();
    recOne(rec, sc, candidateChecks(v, { mySeat, deadSeats: deadSeats(), chosenSeat: target, name: nickOf(tracker.last(), target) }));
    colorRule(sc, v);
    await stageChecks(ctx, id, "cand-vote", "candidateVote");
    const { snap } = await dayState(ctx, id, "cand-vote");
    recAll(rec, sc, turnChecks(snap, { expectNone: true, crimsonAllowed: false }));
    still("candidateVote", "후보 선택 검사");
  }

  // 5) reveal: 표본기를 단계를 넘기기 전에 시작해 표 수 길이 공개 전체(생존자 수가 표 수 상한, 결정 0039)를 모은다. 단계가 reveal 인 표본만 쓴다(추적 단계는 DOM 보다 먼저 바뀐다)
  {
    const sc = `${id}/reveal`;
    const series = sampleSeries(page, {
      durationMs: candidateRevealMs(alive().length) + 2500,
      stepMs: 100,
      take: async () => {
        const before = tracker.last()?.phase;
        const v = await read();
        return { v, inPhase: before === "candidateVoteReveal" && tracker.last()?.phase === "candidateVoteReveal" };
      },
    });
    series.catch(() => {});
    await skipTo(page, tracker, "candidateVoteReveal");
    await settle(page);
    const view = tracker.last();
    const log = (view.day?.voteLog ?? []).find((e) => e.n === view.day?.n) ?? (view.day?.voteLog ?? []).at(-1);
    const n = log?.cand?.votes?.length;
    // P12(결정 0040): [테스트] 시트로 단계를 넘긴 뒤에도 내 표가 공개에 남음(시트 안 탭·버튼이 표를 지우지 않는다)
    {
      const mine = (log?.cand?.votes ?? []).find((x) => x.seat === mySeat);
      rec(sc, "P12", "[테스트] 시트로 넘겨도 내 표가 남음(공개에 내 줄)", mine?.target === target, `내 줄 ${JSON.stringify(mine)} (기대 ${mySeat}>${target}), 공개 표 ${JSON.stringify(log?.cand?.votes ?? null)}`);
    }
    await stageChecks(ctx, id, "reveal", "candidateVoteReveal");
    const { snap } = await dayState(ctx, id, "reveal");
    recAll(rec, sc, turnChecks(withoutAmberHalo(snap), { expectNone: true, crimsonAllowed: false })); // K4: 앰버(박동 중)는 빼고 흰·진홍만
    const all = await series;
    const kept = all.filter((x) => x.value.inPhase);
    recOne(rec, sc, revealChecks(kept.map((x) => ({ t: x.t, reveal: x.value.v.reveal, dt: x.value.v.dt, crimsonNew: x.value.v.crimsonNew })), { n, size: ctx.size }));
    // P10: 칩이 보이는 모든 표본에서 이름표·헤더·패널과 겹치지 않음(정지 + 팝 중)
    const withChips = kept.filter((x) => x.value.v.reveal.chips.length > 0);
    const bad = withChips.map((x) => placementChecks(x.value.v)).filter((r) => !r.ok);
    const detail = [...new Set(bad.map((r) => r.detail))].slice(0, 3).join(" / ");
    const relaxedP = withChips.map((x) => placementChecks(x.value.v)).filter((r) => r.ok && r.relaxed === true); // 결정 0056 개정(P10-8ch)
    rec(sc, "P10", withChips.length === 0 ? "배치: 칩·카드가 이름표·헤더·패널과 겹치지 않음 (칩 표본 없음)" : "배치: 칩·카드가 이름표·헤더·패널과 겹치지 않음", withChips.length > 0 && bad.length === 0, withChips.length === 0 ? "측정값 없음(칩이 보이는 표본)" : bad.length > 0 ? `${bad.length}/${withChips.length} 표본: ${detail}` : `${relaxedP.length}/${withChips.length} 표본 ${[...new Set(relaxedP.map((r) => r.detail))].slice(0, 2).join(" / ")}`, bad.length === 0 && relaxedP.length > 0);
    if (kept.length > 0) colorRule(sc, kept[kept.length - 1].value.v);
  }

  // 6) defense: 후보는 남(봇) — 후보 가운데·어둡게·원뿔·패널 157, 변론 줄, 이모티콘
  const candidateSeat = tracker.last().day?.candidate ?? target;
  {
    const sc = `${id}/defense`;
    await skipTo(page, tracker, "defense");
    await settle(page);
    still("defense", "변론 도착");
    const v = await read();
    recOne(rec, sc, defenseChecks(v, { isCandidate: candidateSeat === mySeat }));
    colorRule(sc, v);
    await checkState(ctx, id, "defense");
    await stageChecks(ctx, id, "defense", "defense");
    // 후보 봇의 변론 줄(1~5초 뒤)이 하단 채팅에 보임. 안 오면 건너뜀(봇은 세 문장 중 하나를 보낸다)
    const line = await page.waitForSelector(".mf-turnpanel .mf-msglog__item", { state: "attached", timeout: 6000 }).then(() => true, () => false);
    if (line) rec(sc, "P5", "후보의 변론 줄이 하단 채팅에 보임", (await page.locator(".mf-turnpanel .mf-msglog__item").count()) >= 1, "채팅 줄 없음");
    // 이모티콘 하나: 트레이에서 보내면 머리 위에 뜬다
    const emoji = await attempt(async () => {
      await page.getByRole("button", { name: "이모티콘", exact: true }).first().click({ timeout: 4000 });
      await page.locator('dialog[aria-label="이모티콘"] .mf-emojitray__cell').first().click({ timeout: 4000 });
      await page.waitForSelector(".mf-dt__emoji", { state: "attached", timeout: 3000 });
      await closeSheet(page, "이모티콘");
    });
    rec(sc, "P5", "변론 중 이모티콘이 머리 위에 뜸", emoji.ok, emoji.detail);
  }

  // 7) execution: 5초뿐이라 읽기부터
  {
    const sc = `${id}/execution`;
    await skipTo(page, tracker, "execution");
    const v = await read();
    const viewerAlive = !isDeadView(tracker.last());
    still("execution", "처형 읽기");
    recOne(rec, sc, executionChecks(v, { viewerAlive, candidateSeat }));
    colorRule(sc, v);
    await checkState(ctx, id, "execution");
    await stageChecks(ctx, id, "execution", "execution");
  }

  // 흐름 끝(밤이든 종료든): 낮 고정물이 단계마다 그대로(D7·D9·T1)
  const tableChecks = () => {
    const days = ctx.dayStates ?? [];
    if (days.length >= 2) {
      const f = feltStable(days.map((d) => ({ state: d.state, rect: d.felt })));
      rec(`${id}/table`, "D7", f.label, f.ok, f.detail);
    }
    recD9(rec, `${id}/table`, days);
    const t1 = stageStable(days.map((d) => ({ state: d.state, stage: d.stage, mySeat: d.mySeat })));
    rec(`${id}/table`, t1.id, t1.label, t1.ok, t1.detail);
    rec(`${id}/setup`, "S4", "단계 도달", true);
  };

  // 8) 처형 뒤: 대상 직업에 따라 밤 또는 종료(결과 화면 검사는 04-33)
  await waitPhaseIn(tracker, ["night", "ended"]);
  if (tracker.last().phase === "ended") {
    await settle(page);
    tableChecks();
    await leaveFromResult(page);
    return;
  }
  await page.waitForSelector(".mf-sceneintro", { state: "detached", timeout: 4000 }).catch(() => {});
  await settle(page);
  await stageChecks(ctx, id, "night", "night");
  {
    const { snap } = await dayState(ctx, id, "night");
    recAll(rec, `${id}/night`, turnChecks(snap, { expectNone: true }));
  }
  tableChecks();
  await resetAndLeave(page, tracker);
}


// ---- noexec·result-c·result-m: 처형 무효 카드와 결과 화면(04-33, UI-SPEC 15.2) ----

/** 방 하나를 만들어 게임을 시작하고(봇 처형 투표 고정 포함) 처형 구간 흐름이 쓰는 도우미를 돌려준다. */
async function verdictRoom(ctx, id, { players, role, vote }) {
  const rec = recorder(ctx);
  const host = await startHost(ctx, id);
  const { page, tracker } = host;
  await settle(page);
  await openTestSheet(page);
  await setBots(page, tracker, players - 1);
  await chooseRole(page, tracker, role);
  await setBotVote(page, tracker, vote);
  await startGame(page, tracker, { onAssigning: onAssigningOf(ctx, id) });
  ctx.stage = "play";
  const v0 = tracker.last();
  rec(`${id}/setup`, "S3", "인원·지정 직업", v0.players.length === players && v0.me.role === role, `인원 ${v0.players.length}/${players}, 직업 ${v0.me.role}/${role}`);
  const colors = await readTokenColors(page);
  const read = () => readVerdict(page, colors);
  const still = (phase, what) => {
    if (tracker.last()?.phase !== phase) throw new SetupError(`${what} 중에 단계가 ${tracker.last()?.phase} 로 바뀜 (기대 ${phase})`);
  };
  const alive = () => tracker.last().players.filter((p) => p.alive !== false).map((p) => p.seat).sort((a, b) => a - b);
  return { rec, page, tracker, mySeat: v0.me.seat, colors, read, still, alive };
}

/** 흐름 끝: 낮 고정물이 단계마다 그대로(D7·D9·T1) + 단계 도달(S4). */
function tableChecksOf(ctx, rec, id) {
  const days = ctx.dayStates ?? [];
  if (days.length >= 2) {
    const f = feltStable(days.map((d) => ({ state: d.state, rect: d.felt })));
    rec(`${id}/table`, "D7", f.label, f.ok, f.detail);
  }
  recD9(rec, `${id}/table`, days);
  const t1 = stageStable(days.map((d) => ({ state: d.state, stage: d.stage, mySeat: d.mySeat })));
  rec(`${id}/table`, t1.id, t1.label, t1.ok, t1.detail);
  rec(`${id}/setup`, "S4", "단계 도달", true);
}

/** 서버가 정한 요약(view.result.summary)에서 결과 화면 요약 카드의 행 수 기대값: 행마다 exec 가 있으면 1, night 가 있으면 1. */
const summaryRowsOf = (summary) => (summary ?? []).reduce((n, row) => n + (row.exec ? 1 : 0) + (row.night ? 1 : 0), 0);

/**
 * 종료 단계에서 결과 화면(P8)을 검사하고 [처음으로] 로 입구까지 간다. winner 는 서버가 정한 값(view.result.winner)과 기대 값을 둘 다 단언한다(T-04-74).
 * 공개 연출(data-stage=done)이 끝난 뒤에 읽는다.
 */
async function resultState(ctx, { id, rec, page, tracker, read, colors }, { winner, n }) {
  const sc = `${id}/ended`;
  await waitPhaseIn(tracker, ["ended"]);
  try {
    await page.waitForSelector('.mf-result[data-stage="done"]', { state: "attached", timeout: 8000 });
  } catch {
    throw new SetupError("결과 화면 공개 연출(data-stage=done)이 끝나지 않음");
  }
  const view = tracker.last();
  rec(sc, "P8", "서버가 정한 승자·요약이 view 에 있음", view.result?.winner === winner && Array.isArray(view.result?.summary), `view.result.winner ${view.result?.winner} ≠ ${winner}`);
  await checkState(ctx, id, "ended");
  await guideState(ctx, id, "ended", "ended"); // UX1·UX2
  await atmosphereState(ctx, id, "ended", "ended", { vignette: 0, glow: 0 }); // AT1: 결과에는 비네팅이 없다
  const v = await read();
  recOne(rec, sc, resultChecks(v, { winner, n, summaryRows: summaryRowsOf(view.result?.summary) }));
  tableChecksOf(ctx, rec, id);
  await leaveFromResult(page);
}

/** 처형 무효로 오는 밤: 회색 카드가 1.8초 안에 사라지고 밤 시작 문구가 그 뒤에 뜨며, 카드가 떠 있는 동안 밤 조작 클릭이 통과한다(P7, D-34, P-3). 방장 경찰, 5명, 봇은 모두 반대. */
async function noExecFlow(ctx) {
  const id = "noexec";
  const R = await verdictRoom(ctx, id, { players: 5, role: "police", vote: { exec: "no", pick: "random" } });
  const { rec, page, tracker, mySeat, colors, read, still, alive } = R;

  await skipTo(page, tracker, "discussion");
  await settle(page);
  await stageChecks(ctx, id, "discussion", "discussion");
  await dayState(ctx, id, "discussion");

  // 처형 여부 투표에서 방장도 반대 → 던진 표 5 중 찬성 0 = notMajority
  await skipTo(page, tracker, "execVote");
  await voteAs(page, tracker, "반대");
  still("execVote", "반대표 던지기");

  // 관찰자와 표본기는 단계를 넘기기 전에 시작한다(skipTo 가 시트를 닫느라 카드 도착을 놓친다, 04-31 SUMMARY 4번). 80ms 간격.
  const sc = `${id}/night`;
  await armVerdictWatch(page);
  const series = sampleSeries(page, {
    durationMs: 6500,
    stepMs: 80,
    take: async () => {
      const v = await read();
      const nightIntro = await page.evaluate(() => document.querySelectorAll(".mf-sceneintro").length);
      return { ...v, nightIntro };
    },
  });
  series.catch(() => {});
  await skipTo(page, tracker, "night");
  const target = alive().find((x) => x !== mySeat);
  let doneAt = null;
  let clickedThrough = false;
  try {
    await tapSeat(page, target); // 카드 위에서 눌러도 통과해야 한다
    await tracker.waitFor((v) => v.me.pick === target, 3000, `밤 지목 ${target}`);
    clickedThrough = true;
  } catch {
    clickedThrough = false;
  }
  doneAt = await page.evaluate(() => performance.now());
  const reason = tracker.last()?.day?.noExecution?.reason;
  const samples = await series;
  const watch = await readVerdictWatch(page);
  if (watch.voidSeenAt === null) throw new SetupError("처형 무효 카드가 DOM 에 나타나지 않음");
  if (watch.voidGoneAt !== null && doneAt >= watch.voidGoneAt) throw new SetupError("카드가 사라진 뒤에 눌러 통과를 확인하지 못함");
  const rebased = rebaseSeries(samples, watch.voidSeenAt).map((x) => ({ t: x.t, voidCard: x.value.voidCard, nightIntro: x.value.nightIntro }));
  recOne(rec, sc, voidCardChecks(rebased, { grayColors: colors.gray, crimsonColors: colors.crimson, clickedThrough }));
  rec(sc, "P7", "무효 이유가 notMajority (서버가 정한 값)", reason === "notMajority", `day.noExecution.reason ${reason}`);

  // 카드·문구가 다 지난 뒤의 밤 장면
  await page.waitForSelector(".mf-sceneintro", { state: "detached", timeout: 4000 }).catch(() => {});
  await settle(page);
  await stageChecks(ctx, id, "night", "night");
  await dayState(ctx, id, "night");
  tableChecksOf(ctx, rec, id);
  await resetAndLeave(page, tracker);
}

/** 5명(방장 마피아 + 봇 4): 봇은 모두 찬성·후보는 방장. 방장이 후보 본인 변론을 지나 처형되고 마피아가 0 이 되어 시민 팀 승리 결과 화면(P5 후보 본인, P6 탈락 viewer, P8). */
async function resultCitizenFlow(ctx) {
  const id = "result-c";
  const R = await verdictRoom(ctx, id, { players: 5, role: "mafia", vote: { exec: "yes", pick: "host" } });
  const { rec, page, tracker, mySeat, colors, read, still, alive } = R;
  const colorRule = (sc, v) => recOne(rec, sc, colorRuleChecks(v, { crimsonColors: colors.crimson, wholeScreenCrimson: false })); // 방장이 마피아 → 동료 표시 허용

  await skipTo(page, tracker, "discussion");
  await settle(page);
  await stageChecks(ctx, id, "discussion", "discussion");
  await dayState(ctx, id, "discussion");

  await skipTo(page, tracker, "execVote");
  await voteAs(page, tracker, "찬성");
  await skipTo(page, tracker, "candidateVote");
  await settle(page);
  still("candidateVote", "후보 선택 도착");
  await pickCandidate(page, tracker, alive().find((x) => x !== mySeat)); // 방장은 자기 외의 한 명(자기 자신은 서버가 거부). 봇 4명이 방장에게 던져 방장이 후보가 된다
  await skipTo(page, tracker, "candidateVoteReveal");
  const candidateSeat = tracker.last().day?.candidate;
  if (candidateSeat !== mySeat) throw new SetupError(`후보가 방장이 아님 (후보 ${candidateSeat}, 방장 ${mySeat})`);

  // 후보 본인 변론: 패널 236·칩 6개
  {
    const sc = `${id}/defense`;
    await skipTo(page, tracker, "defense");
    await settle(page);
    still("defense", "변론 도착");
    const v = await read();
    recOne(rec, sc, defenseChecks(v, { isCandidate: true }));
    colorRule(sc, v);
    await checkState(ctx, id, "defense");
    await stageChecks(ctx, id, "defense", "defense");
    const sent = await attempt(async () => {
      await page.locator(".mf-defchips__b", { hasText: "저 아니에요" }).first().click({ timeout: 4000 });
      await page.waitForFunction(() => (document.querySelector(".mf-claimpanel__guide")?.textContent ?? "").trim() === "보냈어요 · 저 아니에요", null, { timeout: 2500 });
    });
    rec(sc, "P5", "칩을 보내면 안내 줄이 `보냈어요 · 저 아니에요`", sent.ok, sent.detail);
    still("defense", "변론 칩 보내기");
  }

  // 처형: 방장이 탈락하는 쪽(관전) viewer
  {
    const sc = `${id}/execution`;
    await skipTo(page, tracker, "execution");
    const v = await read();
    const viewerAlive = !isDeadView(tracker.last());
    still("execution", "처형 읽기");
    recOne(rec, sc, executionChecks(v, { viewerAlive, candidateSeat }));
    colorRule(sc, v);
    await checkState(ctx, id, "execution");
  }

  await resultState(ctx, { id, ...R }, { winner: "citizenWin", n: 5 });
}

/** 4명(방장 마피아 + 봇 3): 봇은 모두 찬성·후보는 방장 아닌 사람. 1일차 낮에 그 사람이 처형되고(마피아 1 대 시민 2), 밤에 방장이 한 명을 지목해 1 대 1 이 되어 마피아 팀 승리 결과 화면(P8, 진홍 번짐). */
async function resultMafiaFlow(ctx) {
  const id = "result-m";
  const R = await verdictRoom(ctx, id, { players: 4, role: "mafia", vote: { exec: "yes", pick: "other" } });
  const { rec, page, tracker, mySeat, read, still, alive } = R;

  await skipTo(page, tracker, "discussion");
  await settle(page);
  await stageChecks(ctx, id, "discussion", "discussion");
  await dayState(ctx, id, "discussion");

  await skipTo(page, tracker, "execVote");
  await voteAs(page, tracker, "찬성");
  await skipTo(page, tracker, "candidateVote");
  await settle(page);
  still("candidateVote", "후보 선택 도착");
  await pickCandidate(page, tracker, alive().find((x) => x !== mySeat)); // 봇들과 같은 대상(방장 아닌 가장 낮은 자리)
  await skipTo(page, tracker, "candidateVoteReveal");
  await skipTo(page, tracker, "defense");
  await skipTo(page, tracker, "execution");
  await skipTo(page, tracker, "night");
  if (alive().length !== 3 || !alive().includes(mySeat)) throw new SetupError(`처형 뒤 생존자가 방장 포함 3명이 아님 (${alive().join(",")})`);

  // 밤: 방장(유일한 마피아)이 비동료 한 명을 지목 — 4명판에는 의사가 없어 반드시 죽는다
  {
    const sc = `${id}/night`;
    await waitSceneIntro(page, 4000);
    await page.waitForSelector(".mf-sceneintro", { state: "detached", timeout: 4000 }).catch(() => {});
    await settle(page);
    still("night", "밤 도착");
    const { snap } = await dayState(ctx, id, "night");
    nightStaticChecks(ctx, id, "mafia", snap);
    const target = alive().find((x) => x !== mySeat);
    const n2 = await attempt(async () => {
      await tapSeat(page, target);
      await page.waitForFunction((n) => !!document.querySelector(`.mf-dt__seat[data-seat="${n}"] img.mf-figure--halo-white`), target, { timeout: 2000 });
      await tracker.waitFor((v) => v.me.pick === target, 2000, `me.pick ${target}`);
      return (await selState(page, target)).pressed ? true : { ok: false, detail: "aria-pressed false" };
    });
    rec(sc, "N2", "자리를 누르면 선택 후광(흰)", n2.ok, n2.detail);
  }

  // 아침 → 결과: 아침 카드에서 G 를 돌리고 종료를 기다린다(마감에서 마피아 1 ≥ 나머지 1)
  {
    await skipTo(page, tracker, "morning");
    await settle(page);
    still("morning", "아침 도착");
    await checkState(ctx, id, "morning");
  }
  await resultState(ctx, { id, ...R }, { winner: "mafiaWin", n: 4 });
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

  // ③ 낮(claim): 봇 3명 → 시작 → 첫 낮
  await openTestSheet(page);
  await setBots(page, tracker, 3);
  await startGame(page, tracker);
  await skipTo(page, tracker, "claim");
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

const game = (id, players, role, states) => (ctx) => gameFlow(ctx, { id, players, role, states });
const CLAIMS = ["claim-mine", "claim-other", "claim-done", "discussion"];

export const FLOWS = [
  // lobby·world 는 LOBBY_SIZES 6개 크기로 돈다: 기본 크기 4개에 더해 390x844·402x874 (run.mjs 의 extraSizes)
  { id: "lobby", run: lobbyFlow, extraSizes: LOBBY_EXTRA_SIZES },
  { id: "world", run: worldFlow, extraSizes: LOBBY_EXTRA_SIZES },
  // 로비 자유 채팅(07-13): 방장·손님 두 페이지로 한 줄이 오가는 트레이서
  { id: "chat-lobby", run: chatLobbyFlow, extraSizes: LOBBY_EXTRA_SIZES },
  // 한글 조합(07-19): CDP imeSetComposition 으로 조합 중 Enter·보내기가 한 번만 보내진다. 크기와 무관해서 자기 크기로 한 번만 돈다
  { id: "chat-ime", run: chatImeFlow, size: { w: 390, h: 844, label: "390x844" } },
  // 테이블 화면 자유 채팅(07-15): 낮 토론의 한 줄(트레이서) → 최후 변론·밤 마피아·시민 화면·탈락자
  { id: "chat-table", run: chatTableFlow, extraSizes: LOBBY_EXTRA_SIZES },
  // 탈락자 화면(07-15): 방장이 처형된 뒤의 밤. 크기와 무관해서 자기 크기로 한 번만 돈다
  { id: "chat-ghost", run: chatGhostFlow, size: RECONNECT_SIZE },
  // 재접속·예산(06-18): 폰 크기와 곱하지 않고 자기 크기로 한 번. deployhold 는 배포와 동시에 돌리는 흐름(06-19)이라 --only 없이는 빠진다
  { id: "reconnect", run: reconnectFlow, size: RECONNECT_SIZE },
  { id: "deployhold", run: deployHoldFlow, size: RECONNECT_SIZE, skipByDefault: true },
  { id: "perfbudget", run: perfBudgetFlow, size: PERF_SIZE },
  { id: "police5", run: game("police5", 5, "police", [...CLAIMS, "chat", "night", "morning", "day-intro", "rolecard-btn", "next-day"]) },
  { id: "citizen4", run: game("citizen4", 4, "citizen", [...CLAIMS, "night", "morning", "day-intro", "rolecard-citizen", "next-day"]) },
  { id: "mafia8", run: game("mafia8", 8, "mafia", [...CLAIMS, "night", "morning", "day-intro", "rolecard-btn", "next-day"]) },
  { id: "doctor5", run: game("doctor5", 5, "doctor", [...CLAIMS, "night", "morning", "day-intro", "rolecard-btn", "next-day"]) },
  { id: "spec4", run: specFlow },
  { id: "vote5", run: voteFlow },
  { id: "noexec", run: noExecFlow },
  { id: "result-c", run: resultCitizenFlow },
  { id: "result-m", run: resultMafiaFlow },
  // 크기 고정 흐름(05-07): 폰 크기와 무관해서 크기 목록과 곱하지 않고 자기 크기로 한 번만 돈다
  { id: "pc", run: pcFlow, size: { w: 1280, h: 800, label: "1280x800", mobile: false } },
  { id: "wakelock", run: wakeLockFlow, size: { w: 360, h: 640, label: "360x640" } },
];
export { SetupError };
