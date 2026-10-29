// 화면 E2E 흐름(결정 0025): 흐름마다 새 테스트 방 하나와 방장 페이지 하나. 검사 ID 는 계획 261025-h1j 의 "검사 목록" 과 같다.
// 결과는 { scenario: "흐름/상태", size, id, label, ok, detail } 로 ctx.results 에 쌓인다.
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import {
  SetupError,
  armIntroWatch,
  armVerdictWatch,
  chooseRole,
  clickInDialog,
  clickTopmostPoint,
  closeRoleCard,
  closeSheet,
  collectSnapshot,
  createTestRoom,
  inspectSeat,
  leaveFromResult,
  leaveLobby,
  openChatHistory,
  openGuestJoinPage,
  openHostPage,
  openRoleCard,
  openTestSheet,
  pickCandidate,
  pickChip,
  readAtmosphere,
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
  settle,
  shot,
  skipTo,
  sleep,
  startGame,
  tapSeat,
  voteAs,
  waitBackdropStable,
  waitPhaseIn,
} from "./browser.mjs";
import {
  JOIN_FIT_MIN_H,
  ROLE_NAME,
  backdropSceneChecks,
  candidateChecks,
  claimChatIssues,
  colorRuleChecks,
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
  joinFitChecks,
  journalChecks,
  lobbyShapeChecks,
  lineCount,
  livingRoleArtChecks,
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
  vignetteChecks,
  voidCardChecks,
  voteChecks,
  resultChecks,
  pcCenterChecks,
} from "./lib.mjs";

export const OUT_DIR = new URL("./out/", import.meta.url).pathname;
const HOST_NICK = "화면검사기";
/** spec4: 방장이 첫 밤에 탈락할 때까지 같은 방에서 다시 시작하는 최대 횟수 */
const SPEC_MAX_NIGHTS = 8;

/** 검사 한 줄을 쌓는다. */
function recorder(ctx) {
  return (scenario, id, label, ok, detail = "") => {
    ctx.results.push({ scenario, size: ctx.size.label, id, label, ok: !!ok, detail: ok ? "" : String(detail) });
  };
}

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
export async function startHost(ctx, flowId) {
  const rec = recorder(ctx);
  const room = await createTestRoom(ctx.origin, HOST_NICK);
  ctx.secrets.push(room.token);
  ctx.roomCode = room.code; // 링크 참가 probe(UX2-J)용. 방 코드는 비밀이 아니다 — 토큰은 남기지 않는다
  const host = await openHostPage(ctx.browser, { origin: ctx.origin, code: room.code, token: room.token, size: ctx.size, dpr: ctx.shots ? 2 : 1, mobile: ctx.size.mobile !== false });
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
  rec(`${flowId}/${state}`, "G", "G 공통 검사", bad.length === 0, bad.map((x) => `${x.id} ${x.detail}`).join(" / "));
  return snap;
}

const sameRect = (a, b) => Math.abs(a.left - b.left) < 0.01 && Math.abs(a.top - b.top) < 0.01 && Math.abs(a.width - b.width) < 0.01;

// ---- lobby ----

async function lobbyFlow(ctx) {
  const rec = recorder(ctx);
  const { w, h } = ctx.size;
  const host = await startHost(ctx, "lobby");
  const { page, tracker } = host;
  await settle(page);

  // 대기실, 시트 닫힘
  const s1 = await checkState(ctx, "lobby", "lobby");
  recOne(rec, "lobby/lobby", crownChecks(s1, { expect: 1 })); // W1: 방장 왕관은 대기실에만 정확히 하나
  await stageChecks(ctx, "lobby", "lobby", "lobby", { expectTimer: false }); // B1 배경 장면 · H1 헤더 글씨 대비 (대기실에는 타이머가 없다)
  const tt = s1.tt;
  rec("lobby/lobby", "L1", "[테스트] 버튼이 보임", !!tt && tt.rect.width > 0 && tt.rect.height > 0 && rectInside(tt.rect, { left: 0, top: 0, width: w, height: h }) && tt.hit, tt ? `rect ${Math.round(tt.rect.left)},${Math.round(tt.rect.top)} ${Math.round(tt.rect.width)}x${Math.round(tt.rect.height)}, hit ${tt.hit}` : "버튼 없음");
  const clashes = tt ? s1.interactive.filter((e) => !sameRect(e.rect, tt.rect) && rectsOverlap(e.rect, tt.rect)).map((e) => e.desc) : ["버튼 없음"];
  rec("lobby/lobby", "L2", "[테스트]가 다른 조작과 안 겹침", clashes.length === 0, `겹침: ${clashes.join(", ")}`);

  // 장면 상자·테이블(결정 0028): 인원 1·2·3·5 에서 양옆 간격 T2, 둘이면 마주 봄·셋이면 삼각 L6 을 보고, 끝에서 T1(입장해도 늘어나지 않음)
  const stages = [];
  const grabStage = async (state, waitMs = 0) => {
    if (waitMs > 0) await sleep(waitMs);
    const stage = await readStage(page);
    const mySeat = tracker.last()?.me?.seat ?? -1;
    const n = tracker.last()?.players?.length ?? 0;
    stages.push({ state, stage, mySeat });
    recOne(rec, "lobby/stage", feltGapChecks(stage));
    recOne(rec, "lobby/stage", lobbyShapeChecks(stage, { n, mySeat }));
  };
  await grabStage("인원 1");

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

  // [봇 늘리기] 두 번: 인원 2(마주 봄), 인원 3(삼각). 입장 전이(420ms)가 끝나고 자리가 새 등간격 자리로 미끄러진 뒤에 잰다.
  const grow = await attempt(async () => {
    for (const n of [2, 3]) {
      await clickInDialog(page, "테스트 도구", "봇 늘리기");
      await tracker.waitFor((v) => v.players.length === n, 3000, `인원 ${n}`);
      await grabStage(`인원 ${n}`, 700);
    }
  });
  if (!grow.ok) rec("lobby/stage", "L6", "봇 늘리기로 인원 2·3 만들기", false, grow.detail);

  // 5명 채우기
  await clickInDialog(page, "테스트 도구", "5명 채우기");
  const l4 = await attempt(async () => {
    await tracker.waitFor((v) => v.players.length === 5, 3000, "인원 5");
    await page.waitForFunction(() => document.querySelector(".mf-tt-sheet__count")?.textContent?.trim() === "4명" && document.querySelector(".mf-lobby__count")?.textContent?.trim() === "5 / 8명", null, { timeout: 3000 });
  });
  rec("lobby/sheet", "L4", "5명 채우기", l4.ok, l4.detail);
  if (l4.ok) {
    await grabStage("인원 5", 700);
    recOne(rec, "lobby/stage", stageStable(stages));
  }

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

  // 시트 닫힘
  const t2 = await attempt(async () => {
    await closeSheet(page);
    return (await page.locator('dialog[aria-label="테스트 도구"]').count()) === 0;
  });
  rec("lobby/sheet", "T2", "테스트 시트 닫힘", t2.ok, t2.detail);

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

// ---- 게임 흐름(과제 2) ----

/** 낮 장면 상태(claim·discussion·night·morning) 한 장: 스냅숏 + G + D1~D6·D8 + T2. 테이블 면·이름표·장면 상자는 흐름 끝의 D7·D9·T1 용으로 모아 둔다. */
async function dayState(ctx, flowId, state) {
  const rec = recorder(ctx);
  const snap = await checkState(ctx, flowId, state);
  const mySeat = ctx.host.tracker.last()?.me?.seat ?? -1;
  for (const r of dayChecks(snap, { w: ctx.size.w, h: ctx.size.h })) rec(`${flowId}/${state}`, r.id, r.label, r.ok, r.detail);
  recOne(rec, `${flowId}/${state}`, crownChecks(snap, { expect: 0 })); // W1: 게임 중에는 왕관이 없다
  const stage = await readStage(ctx.host.page);
  const t2 = feltGapChecks(stage);
  rec(`${flowId}/${state}`, t2.id, t2.label, t2.ok, t2.detail);
  (ctx.dayStates ??= []).push({ state, felt: snap.felt, tags: snap.tags, stage, mySeat });
  return { snap, mySeat };
}

/** 대기실·역할 배정 장면 한 장: 테이블 면·이름표·장면 상자를 흐름 끝의 D7·D9·T1 용으로 모아 둔다(스냅숏·G 는 안 돌린다). */
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
const recOne = (rec, scenario, r) => rec(scenario, r.id, r.label, r.ok, r.detail);
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
  // [게임 시작] 직전의 대기실 테이블: 이후 배정·낮·밤·아침과 같은 자리여야 한다(D7·D9·T1 이 함께 본다)
  await grabLobbyStage(ctx, "lobby", 700);
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
  const bad = days.map((d) => ({ d, r: tagsOverlap(d.tags) })).filter((x) => !x.r.ok);
  rec(`${id}/table`, "D9", "이름표끼리 안 겹침", bad.length === 0, bad.map((x) => `${x.d.state}: ${x.r.detail}`).join("; "));
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
    // 인트로 카드(.mf-vintro, 1.8초, 낮 테이블 안)가 사라진 뒤에 읽는다 — 카드의 `처형 투표` 글자는 익명 검사(P9)의 대상이 아니다
    await page.waitForSelector(".mf-vintro", { state: "detached", timeout: 4000 }).catch(() => {});
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
  const bad = days.map((d) => ({ d, r: tagsOverlap(d.tags) })).filter((x) => !x.r.ok);
  rec(`${id}/table`, "D9", "이름표끼리 안 겹침", bad.length === 0, bad.map((x) => `${x.d.state}: ${x.r.detail}`).join("; "));
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
  await grabLobbyStage(ctx, "lobby", 700);
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
    const series = sampleSeries(page, { durationMs: 3800, stepMs: 80, take: () => read() });
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

  // 5) reveal: 표본기를 단계를 넘기기 전에 시작해 4초 공개 전체를 모은다. 단계가 reveal 인 표본만 쓴다(추적 단계는 DOM 보다 먼저 바뀐다)
  {
    const sc = `${id}/reveal`;
    const series = sampleSeries(page, {
      durationMs: 6500,
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
    rec(sc, "P10", withChips.length === 0 ? "배치: 칩·카드가 이름표·헤더·패널과 겹치지 않음 (칩 표본 없음)" : "배치: 칩·카드가 이름표·헤더·패널과 겹치지 않음", withChips.length > 0 && bad.length === 0, withChips.length === 0 ? "측정값 없음(칩이 보이는 표본)" : `${bad.length}/${withChips.length} 표본: ${detail}`);
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
    const badTags = days.map((d) => ({ d, r: tagsOverlap(d.tags) })).filter((x) => !x.r.ok);
    rec(`${id}/table`, "D9", "이름표끼리 안 겹침", badTags.length === 0, badTags.map((x) => `${x.d.state}: ${x.r.detail}`).join("; "));
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
  await grabLobbyStage(ctx, "lobby", 700);
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
  const badTags = days.map((d) => ({ d, r: tagsOverlap(d.tags) })).filter((x) => !x.r.ok);
  rec(`${id}/table`, "D9", "이름표끼리 안 겹침", badTags.length === 0, badTags.map((x) => `${x.d.state}: ${x.r.detail}`).join("; "));
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

const game = (id, players, role, states) => (ctx) => gameFlow(ctx, { id, players, role, states });
const CLAIMS = ["claim-mine", "claim-other", "claim-done", "discussion"];

export const FLOWS = [
  { id: "lobby", run: lobbyFlow },
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
];
export { SetupError };
