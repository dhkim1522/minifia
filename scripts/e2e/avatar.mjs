// 10페이즈 캐릭터 동작·의상 화면 E2E 흐름 (10-05~). avatar-emote(10-05)·avatar-dress(10-07). 이후 계획이 avatar-phases 를 같은 파일에 더한다.
// flows.mjs 가 이미 3천 줄이라 흐름 본문은 이 파일에 둔다. flows.mjs 의 도우미는 `makeAvatarFlows(helpers)` 로 받는다(politics.mjs 와 같은 모양 — 서로 import 하지 않는다).
// helpers: { recorder, startHost, openGuest, attempt, walkableCentersOfApp, LOBBY_HOST_NICK, WORLD_GUEST_NICK, resetAndLeave }  (10-08 이 필요한 도우미를 같은 객체에 더한다)
// 판정 문턱은 lib.mjs 의 순수 검사 함수(emoteTrayChecks·dressChecks)에만 있고 여기서는 낮추지 않는다.
import { chooseRole, hitsInputSurface, leaveLobby, openTestSheet, sampleWorld, screensOfWorld, SetupError, setBots, settle, skipTo, sleep, startGame, tapWorld, waitWorldReady } from "./browser.mjs";
import { dressChecks, emoteTrayChecks, worldTapRanking } from "./lib.mjs";

/** 동작 하나를 보낸 뒤 두 페이지가 프레임을 받기까지 기다리는 상한(ms). 계획: 1.5초 안 */
const ARRIVE_MS = 1500;
/** 연타 무시를 확인하는 관찰 시간(ms) */
const SPAM_WATCH_MS = 700;
/** 걸음이 끝난 뒤 칸이 풀리기까지 허용하는 여유(ms) */
const WALK_END_SLACK_MS = 800;
/** 서버가 연이은 동작 사이에 두는 간격(shared/game/emote.ts EMOTE_MIN_GAP_MS 1000) + 여유 */
const GAP_MS = 1200;
/** 동작 길이(shared/game/emote.ts EMOTE_MS 중 쓰는 둘) */
const CLAP_MS = 1280;
const DANCE_MS = 2080;

const BUTTON = "[data-emote-button]";
const TRAY = "[data-emote-tray]";

/** 꾸미기: 서버 반영이 내 화면에 닿는 상한(미리 보기가 즉시 갈아입힌다)·남의 화면에 닿는 상한(ms) */
const DRESS_SELF_MS = 500;
const DRESS_PEER_MS = 1500;
const DRESS_FLOAT = '[data-float="dress"]';
const DRESS_SHEET = "[data-dress-sheet]";

/** 구간 { p: [x0,z0,x1,z1,…] 1/100 단위, v: 단위/초 × 100 } 을 걷는 데 걸리는 시간(ms) */
function walkMs(seg) {
  let len = 0;
  for (let i = 0; i + 3 < seg.p.length; i += 2) len += Math.hypot(seg.p[i + 2] - seg.p[i], seg.p[i + 3] - seg.p[i + 1]);
  return (len / seg.v) * 1000;
}

/** 한 페이지의 동작 버튼·판·입력칸 기하와 내 캐릭터 화면 점을 한 번에 읽는다. 판이 닫혀 있으면 tray 는 null. */
function readEmoteUi(page, seat) {
  return page.evaluate((mySeat) => {
    const q = (s) => document.querySelector(s);
    const qa = (s) => [...document.querySelectorAll(s)];
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
    };
    const tray = q("[data-emote-tray]");
    const names = qa(".mv-emote-tray__name").map((el) => parseFloat(getComputedStyle(el).fontSize));
    const shown = window.__mfWorld?.shown(mySeat) ?? null;
    const pt = shown ? window.__mfWorld.screenOf(shown.x, shown.z) : null;
    const root = q(".mf-root");
    return {
      vw: window.innerWidth,
      vh: window.innerHeight,
      button: rect(q("[data-emote-button]")),
      input: rect(q("[data-chat-input]")),
      tray: rect(tray),
      cells: qa("[data-emote]").map((el) => ({ id: el.getAttribute("data-emote"), rect: rect(el), off: el.getAttribute("aria-disabled") === "true", playing: el.classList.contains("is-playing") })),
      nameFont: names.length > 0 ? Math.min(...names) : null,
      character: pt ? { x: pt.sx, y: pt.sy } : null,
      kbOpen: root?.getAttribute("data-kb-open") === "true",
      buttonLabel: q("[data-emote-button]")?.getAttribute("aria-label") ?? null,
      buttonOff: q("[data-emote-button]")?.getAttribute("aria-disabled") === "true",
      expanded: q("[data-emote-button]")?.getAttribute("aria-expanded") ?? null,
      trayRole: tray?.getAttribute("role") ?? null,
      trayLabel: tray?.getAttribute("aria-label") ?? null,
      focusIsInput: document.activeElement === q("[data-chat-input]"),
      inputValue: q("[data-chat-input]")?.value ?? null,
    };
  }, seat);
}

/** window.__mfEmotes 사본 { last, playing, hook } (훅이 없으면 last null·playing 빈 목록·hook false) */
const readEmotes = (page) => page.evaluate(() => (window.__mfEmotes ? { last: window.__mfEmotes.last, playing: [...window.__mfEmotes.playing], hook: true } : { last: null, playing: [], hook: false }));

/** 조건이 참이 될 때까지 25ms 간격으로 읽는다. 참이면 걸린 ms, 시간 안에 안 되면 null */
async function until(fn, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 <= ms) {
    if (await fn()) return Date.now() - t0;
    await sleep(25);
  }
  return null;
}

/** 꾸미기 버튼(닫힌 때)·패널·시트·카드 기하를 한 번에 읽는다. 시트가 닫혀 있으면 sheet 는 null. */
function readDressUi(page) {
  return page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const qa = (s) => [...document.querySelectorAll(s)];
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
    };
    const names = qa(".mv-dress-card__name").map((el) => parseFloat(getComputedStyle(el).fontSize));
    const sel = qa("[data-dress-sheet] button[data-outfit][aria-pressed='true']");
    return {
      vw: window.innerWidth,
      vh: window.innerHeight,
      float: rect(q('[data-float="dress"]')),
      floatLabel: q('[data-float="dress"]')?.getAttribute("aria-label") ?? null,
      floatCount: qa("[data-float]").length,
      panel: rect(q(".mf-lobby__panel")),
      sheet: rect(q("[data-dress-sheet]")),
      cards: qa("[data-dress-sheet] button[data-outfit]").map((el) => rect(el)),
      cardIds: qa("[data-dress-sheet] button[data-outfit]").map((el) => el.getAttribute("data-outfit")),
      close: rect(q('[data-dress-sheet] button[aria-label="닫기"]')),
      selected: sel[0] ? { rect: rect(sel[0]), pressedCount: sel.length } : null,
      nameFont: names.length > 0 ? Math.min(...names) : null,
      kbOpen: q(".mf-root")?.getAttribute("data-kb-open") === "true",
      focusOnFloat: document.activeElement?.getAttribute("data-float") === "dress",
      focusedOutfit: document.activeElement?.getAttribute("data-outfit") ?? null,
    };
  });
}

/** window.__mfLooks 사본 { 좌석: 의상 id } (훅이 없으면 null) */
const readLooks = (page) => page.evaluate(() => (window.__mfLooks ? { ...window.__mfLooks } : null));

export function makeAvatarFlows(helpers) {
  const { recorder, startHost, openGuest, attempt, walkableCentersOfApp, LOBBY_HOST_NICK, WORLD_GUEST_NICK, resetAndLeave } = helpers;

  /** 판을 연다(버튼 누름). 열렸는지 기다린다 */
  async function openTray(page) {
    await page.locator(BUTTON).click({ timeout: 3000 });
    await page.waitForSelector(TRAY, { timeout: 1500 });
  }
  async function closeTray(page) {
    if ((await page.locator(TRAY).count()) > 0) await page.locator(BUTTON).click({ timeout: 3000 });
    await page.waitForSelector(TRAY, { state: "detached", timeout: 1500 });
  }
  /** 아홉 칸이 모두 눌릴 때(등장 걷기·앞 동작이 끝남)까지 판을 열고 닫으며 기다린다. 끝나면 판은 닫혀 있다 — 서버가 버리는 구간에 보내지 않으려고 */
  async function waitUnblocked(page, seat, ms = 8000) {
    return until(async () => {
      if ((await page.locator(TRAY).count()) === 0) await openTray(page);
      const ui = await readEmoteUi(page, seat);
      const free = ui.cells.length === 9 && ui.cells.every((c) => !c.off);
      await closeTray(page); // 호출한 쪽이 다시 연다(열린 채 돌려주면 다음 누름이 닫는다)
      return free;
    }, ms);
  }

  /**
   * avatar-emote (D-18): 방장·손님 로비 두 페이지에서 동작 버튼과 5+4 판 기하(EB1·EP2·TR1~TR5·EP3·EP4), 손님이 박수를 고르면 두 페이지에 도착,
   * 재생 중 칸 비활성·연타 무시, 걷는 중 비활성과 걸음이 끝난 뒤 풀림, 키보드가 열려 있을 때의 규칙.
   */
  async function avatarEmoteFlow(ctx) {
    const rec = recorder(ctx);
    const sc = "avatar-emote/tray";
    const host = await startHost(ctx, "avatar-emote", { nickname: LOBBY_HOST_NICK });
    const { page: hp, tracker: ht } = host;
    const { guest: g, seat: gSeat } = await openGuest(ctx, WORLD_GUEST_NICK);
    try {
      const { page: gp, tracker: gt } = g;
      const hSeat = ht.last().me.seat;
      await Promise.all([ht.waitFor((v) => v.players.length === 2, 5000, "방장 쪽 인원 2"), gt.waitFor((v) => v.players.length === 2, 5000, "손님 쪽 인원 2")]);
      await Promise.all([waitWorldReady(hp, 2), waitWorldReady(gp, 2)]);
      await Promise.all([settle(hp), settle(gp)]);

      // AE1: 두 페이지 모두 버튼 + 판 기하
      for (const [who, page, seat] of [["방장", hp, hSeat], ["손님", gp, gSeat]]) {
        const closed = await readEmoteUi(page, seat);
        rec(`${sc}-${who}`, "AE1a", `${who}: 동작 버튼이 입력줄 맨 앞에 있고 접근성 이름 '동작 고르기', 판은 닫혀 있음`, closed.button !== null && closed.tray === null && closed.buttonLabel === "동작 고르기" && closed.button.left < (closed.input?.left ?? 0) && closed.expanded === "false", `버튼 ${closed.button ? `${Math.round(closed.button.left)},${Math.round(closed.button.top)}` : "없음"} · 이름 ${closed.buttonLabel} · 판 ${closed.tray ? "열림" : "닫힘"} · expanded ${closed.expanded}`);
        await openTray(page);
        const ui = await readEmoteUi(page, seat);
        rec(`${sc}-${who}`, "AE1b", `${who}: 판이 role=group 이름 '동작', 칸 아홉 개 순서 clap~throat`, ui.trayRole === "group" && ui.trayLabel === "동작" && ui.cells.map((c) => c.id).join(",") === "clap,praise,handshake,dance,surprise,cry,deny,point,throat", `role ${ui.trayRole} · 이름 ${ui.trayLabel} · 칸 ${ui.cells.map((c) => c.id).join(",")}`);
        for (const l of emoteTrayChecks({ button: ui.button, input: ui.input, tray: ui.tray, cells: ui.cells.map((c) => c.rect), nameFont: ui.nameFont, viewport: { w: ui.vw, h: ui.vh }, character: ui.character, hasKb: ui.kbOpen })) {
          rec(`${sc}-${who}`, l.id, l.label, l.ok, l.detail);
        }
        await closeTray(page);
      }

      // AE2: 손님이 박수를 고르면 판이 닫히고 두 페이지에 도착
      const sc2 = "avatar-emote/arrive";
      const free0 = await waitUnblocked(gp, gSeat);
      if (free0 === null) throw new SetupError("손님 동작 칸이 풀리지 않음(8초) — 등장 연출이 끝나지 않았거나 걷는 중");
      await openTray(gp);
      await gp.locator('[data-emote="clap"]').click({ timeout: 3000 });
      const closedAfter = await attempt(async () => {
        await gp.waitForSelector(TRAY, { state: "detached", timeout: 800 });
      });
      rec(sc2, "AE2a", "칸을 고르면 판이 닫힘", closedAfter.ok, closedAfter.detail);
      const arrived = await attempt(async () => {
        const hit = (e) => !!e && e.last !== null && e.last.seat === gSeat && e.last.id === "clap" && e.playing.includes(gSeat);
        const ms = await until(async () => hit(await readEmotes(hp)) && hit(await readEmotes(gp)), ARRIVE_MS);
        if (ms === null) {
          const [he, ge] = await Promise.all([readEmotes(hp), readEmotes(gp)]);
          return { ok: false, detail: `방장 ${JSON.stringify(he)} · 손님 ${JSON.stringify(ge)}` };
        }
        return true;
      });
      rec(sc2, "AE2b", `두 페이지의 __mfEmotes.last 가 { seat: 손님, id: clap } 이고 playing 에 손님이 듦(${ARRIVE_MS / 1000}초 안)`, arrived.ok, arrived.detail);

      // 박수가 끝나고 서버 간격이 지난 뒤 다시 보낸다
      await sleep(CLAP_MS + GAP_MS);
      await until(async () => !(await readEmotes(hp)).playing.includes(gSeat), 1500);

      // AE3: 재생 중에는 칸이 비활성이고 눌러도 아무 일이 없다(연타 무시). 춤은 길어서(2.08초) 관찰 시간이 모자라지 않는다
      const sc3 = "avatar-emote/spam";
      const free1 = await waitUnblocked(gp, gSeat);
      if (free1 === null) throw new SetupError("손님 동작 칸이 두 번째로 풀리지 않음");
      await openTray(gp);
      await gp.locator('[data-emote="dance"]').click({ timeout: 3000 });
      const dancing = await until(async () => (await readEmotes(hp)).playing.includes(gSeat), ARRIVE_MS);
      rec(sc3, "AE3a", "손님이 춤을 고르면 방장 화면 playing 에 손님이 듦", dancing !== null, dancing === null ? "1.5초 안에 도착하지 않음" : "");
      const beforeN = (await readEmotes(hp)).last?.n ?? -1;
      await openTray(gp);
      const during = await readEmoteUi(gp, gSeat);
      const allOff = during.cells.length === 9 && during.cells.every((c) => c.off);
      const playingCells = during.cells.filter((c) => c.playing).map((c) => c.id);
      rec(sc3, "AE3b", "재생 중에는 아홉 칸이 모두 aria-disabled, 재생 중인 칸(dance)만 is-playing", allOff && playingCells.join(",") === "dance", `비활성 ${during.cells.filter((c) => c.off).length}/9 · is-playing ${playingCells.join(",") || "없음"}`);
      await gp.locator('[data-emote="cry"]').click({ timeout: 3000, force: true });
      await sleep(SPAM_WATCH_MS);
      const after = await readEmotes(hp);
      rec(sc3, "AE3c", `비활성 칸을 눌러도 방장의 __mfEmotes.last 가 ${SPAM_WATCH_MS}ms 동안 그대로(n ${beforeN}, id dance)`, after.last?.n === beforeN && after.last?.id === "dance", `n ${after.last?.n} · id ${after.last?.id}`);
      const stillOpen = (await gp.locator(TRAY).count()) === 1;
      rec(sc3, "AE3d", "비활성 칸을 눌러도 판은 그대로 열려 있고 알림 문구가 없음", stillOpen && (await gp.locator("[data-chat-notice]").count()) === 0, `판 ${stillOpen ? "열림" : "닫힘"}`);
      await closeTray(gp);
      await sleep(Math.max(0, DANCE_MS - 1200) + GAP_MS);
      await until(async () => !(await readEmotes(hp)).playing.includes(gSeat), 1500);

      // AE4: 걷기 시작하면 playing 에서 빠지고, 걷는 동안 칸이 비활성, 걸음이 끝나면 풀림
      const sc4 = "avatar-emote/walk";
      const [hw, gw] = await Promise.all([hp.evaluate(() => ({ top: document.querySelector(".mf-lobby__header")?.getBoundingClientRect().bottom ?? 0, bottom: document.querySelector(".mf-lobby__panel")?.getBoundingClientRect().top ?? 0 })), gp.evaluate(() => ({ top: document.querySelector(".mf-lobby__header")?.getBoundingClientRect().bottom ?? 0, bottom: document.querySelector(".mf-lobby__panel")?.getBoundingClientRect().top ?? 0 }))]);
      const from = await sampleWorld(gp, gSeat);
      if (!from) throw new SetupError("손님 위치를 읽지 못함(sample)");
      const centers = walkableCentersOfApp();
      const pad = 28;
      const [gScreens, hScreens] = await Promise.all([screensOfWorld(gp, centers), screensOfWorld(hp, centers)]);
      const inStage = (s, st) => !!s && Number.isFinite(s.sx) && s.sx > pad && s.sx < ctx.size.w - pad && s.sy > st.top + pad && s.sy < st.bottom - pad;
      const onScreen = centers.map((c, i) => ({ ...c, sx: gScreens[i]?.sx, sy: gScreens[i]?.sy, hx: hScreens[i]?.sx, hy: hScreens[i]?.sy })).filter((c, i) => inStage(gScreens[i], gw) && inStage(hScreens[i], hw));
      const { ranked } = worldTapRanking(onScreen, from);
      const probe = ranked.slice(0, 40);
      const gHits = await hitsInputSurface(gp, probe);
      const target = probe.find((_, i) => gHits[i]);
      if (!target) throw new SetupError(`탭할 목적지를 찾지 못함(보이는 칸 ${onScreen.length}개)`);
      const free2 = await waitUnblocked(gp, gSeat);
      if (free2 === null) throw new SetupError("손님 동작 칸이 세 번째로 풀리지 않음");
      // 춤을 시작하고 곧바로 걷는다
      await openTray(gp);
      await gp.locator('[data-emote="dance"]').click({ timeout: 3000 });
      await until(async () => (await readEmotes(gp)).playing.includes(gSeat), ARRIVE_MS);
      const tap = await tapWorld(gp, gt, gSeat, target.x, target.z);
      if (!tap.move) {
        rec(sc4, "AE4a", "바닥을 누르면 손님 구간이 시작됨", false, "3초 안에 내 구간이 오지 않음");
      } else {
        const walkStart = Date.now();
        const left = await until(async () => !(await readEmotes(gp)).playing.includes(gSeat) && !(await readEmotes(hp)).playing.includes(gSeat), 1500);
        rec(sc4, "AE4a", "걷기 시작하면 두 페이지 playing 에서 손님이 빠짐", left !== null, left === null ? "1.5초 안에 빠지지 않음" : "");
        await openTray(gp);
        const walking = await readEmoteUi(gp, gSeat);
        rec(sc4, "AE4b", "걷는 중에는 판을 열 수 있고 아홉 칸이 모두 aria-disabled", walking.cells.length === 9 && walking.cells.every((c) => c.off) && !walking.buttonOff, `비활성 ${walking.cells.filter((c) => c.off).length}/9 · 버튼 비활성 ${walking.buttonOff}`);
        // 걸음 끝(서버 구간 끝) + 800ms 안에 풀린다
        const endIn = Math.max(0, walkMs(tap.move) - (Date.now() - walkStart));
        const freed = await until(async () => {
          const ui = await readEmoteUi(gp, gSeat);
          return ui.cells.length === 9 && ui.cells.every((c) => !c.off);
        }, endIn + WALK_END_SLACK_MS + 400);
        const freedAfterEnd = freed === null ? null : freed - endIn;
        rec(sc4, "AE4c", `걸음이 끝나면(서버 구간 끝 + ${WALK_END_SLACK_MS}ms 안) 칸이 풀림`, freed !== null && freedAfterEnd <= WALK_END_SLACK_MS, freed === null ? `풀리지 않음(구간 ${Math.round(walkMs(tap.move))}ms)` : `끝난 뒤 ${Math.round(freedAfterEnd)}ms`);
        await closeTray(gp);
      }

      // AE5: 키보드가 열려 있을 때(입력칸 포커스) 버튼은 판을 열지 않고 입력칸 blur, 값은 그대로, 두 번째 누름에 열림
      const sc5 = "avatar-emote/keyboard";
      await gp.locator("[data-chat-input]").fill("그대로");
      await gp.locator("[data-chat-input]").focus();
      await gp.locator(BUTTON).click({ timeout: 3000 });
      await sleep(150);
      const first = await readEmoteUi(gp, gSeat);
      rec(sc5, "AE5a", "입력칸 포커스일 때 버튼을 누르면 판은 열리지 않고 입력칸 포커스가 빠짐", first.tray === null && !first.focusIsInput, `판 ${first.tray ? "열림" : "닫힘"} · 입력칸 포커스 ${first.focusIsInput}`);
      await gp.locator(BUTTON).click({ timeout: 3000 });
      await gp.waitForSelector(TRAY, { timeout: 1500 }).catch(() => {});
      const second = await readEmoteUi(gp, gSeat);
      rec(sc5, "AE5b", "두 번째 누름에 판이 열리고 입력칸 값('그대로')이 유지되며 키보드는 닫힌 채", second.tray !== null && second.inputValue === "그대로" && !second.kbOpen, `판 ${second.tray ? "열림" : "닫힘"} · 값 길이 ${second.inputValue?.length} · 키보드 ${second.kbOpen}`);
      await gp.keyboard.press("Escape");
      const escClosed = await attempt(async () => {
        await gp.waitForSelector(TRAY, { state: "detached", timeout: 1000 });
      });
      const focusBack = await gp.evaluate(() => document.activeElement?.hasAttribute("data-emote-button") ?? false);
      rec(sc5, "AE5c", "Esc 로 판이 닫히고 초점이 동작 버튼으로 돌아옴", escClosed.ok && focusBack, `${escClosed.ok ? "닫힘" : escClosed.detail} · 버튼 초점 ${focusBack}`);
    } finally {
      await g.context.close().catch(() => {});
    }
    await leaveLobby(hp);
  }

  /**
   * avatar-dress (D-18): 방장·손님 로비. AD1 두 페이지의 떠 있는 버튼 기하 · AD2 시트가 패널을 덮고 떠 있는 버튼이 숨으며 카드 기하가 맞음 ·
   * AD3 손님이 mafia 를 고르면 손님 화면 500ms·방장 화면 1500ms 안에 반영(손님이 실제 마피아가 아니어도 된다) · AD4 방장이 noir 를 골라 두 화면의 __mfLooks 가 같음 ·
   * AD5 시트를 닫으면 사라지고 초점이 꾸미기 버튼으로 돌아옴 · AD6 게임을 시작해 낮이 되어도 같은 look 이고 꾸미기 버튼·시트가 없음.
   */
  async function avatarDressFlow(ctx) {
    const rec = recorder(ctx);
    const sc = "avatar-dress/sheet";
    const host = await startHost(ctx, "avatar-dress", { nickname: LOBBY_HOST_NICK });
    const { page: hp, tracker: ht } = host;
    const { guest: g, seat: gSeat } = await openGuest(ctx, WORLD_GUEST_NICK);
    try {
      const { page: gp, tracker: gt } = g;
      const hSeat = ht.last().me.seat;
      await Promise.all([ht.waitFor((v) => v.players.length === 2, 5000, "방장 쪽 인원 2"), gt.waitFor((v) => v.players.length === 2, 5000, "손님 쪽 인원 2")]);
      await Promise.all([waitWorldReady(hp, 2), waitWorldReady(gp, 2)]);
      await Promise.all([settle(hp), settle(gp)]);

      /** 닫힌 때의 버튼을 읽고(AD1) 눌러 시트를 연 뒤 시트·카드를 읽어(AD2) 같은 검사 줄로 기록한다. 끝나면 시트는 열려 있다. */
      const measure = async (who, page) => {
        const closed = await readDressUi(page);
        const idle = closed.sheet === null && closed.float !== null && closed.floatLabel === "꾸미기" && closed.floatCount === 1;
        rec(`${sc}-${who}`, "AD1a", `${who}: 로비에 떠 있는 버튼이 하나, 접근성 이름 '꾸미기', 시트는 닫혀 있음`, idle, `버튼 ${closed.float ? "있음" : "없음"} · 이름 ${closed.floatLabel} · 떠 있는 버튼 ${closed.floatCount}개 · 시트 ${closed.sheet ? "열림" : "닫힘"}`);
        await page.locator(DRESS_FLOAT).click({ timeout: 3000 });
        await page.waitForSelector(DRESS_SHEET, { timeout: 1500 });
        await sleep(150);
        const open = await readDressUi(page);
        const hidden = open.float === null;
        rec(`${sc}-${who}`, "AD2a", `${who}: 시트가 열리면 떠 있는 버튼은 숨고 카드 아홉 개가 UI-SPEC 순서`, hidden && open.cardIds.join(",") === "coat,police,doctor,mafia,detective,reporter,elder,hood,noir", `버튼 ${hidden ? "숨음" : "보임"} · 카드 ${open.cardIds.join(",")}`);
        for (const l of dressChecks({ float: closed.float, panel: open.panel, sheet: open.sheet, cards: open.cards, close: open.close, selected: open.selected, nameFont: open.nameFont, viewport: { w: open.vw, h: open.vh }, kb: open.kbOpen })) {
          rec(`${sc}-${who}`, l.id, l.label, l.ok, l.detail);
        }
        rec(`${sc}-${who}`, "AD2b", `${who}: 시트가 열리면 초점이 선택된 카드(coat 또는 지금 의상)로 감`, open.focusedOutfit !== null && open.selected !== null, `초점 ${open.focusedOutfit}`);
      };
      await measure("방장", hp);
      // 방장 시트를 닫고 AD5(초점 복귀)를 그 자리에서 본다
      await hp.locator(`${DRESS_SHEET} button[aria-label="닫기"]`).click({ timeout: 3000 });
      const hClosed = await attempt(async () => {
        await hp.waitForSelector(DRESS_SHEET, { state: "detached", timeout: 1000 });
      });
      const hFocus = await readDressUi(hp);
      rec("avatar-dress/close", "AD5a", "방장: 시트를 닫으면 시트가 사라지고 초점이 꾸미기 버튼으로 돌아옴", hClosed.ok && hFocus.focusOnFloat && hFocus.float !== null, `${hClosed.ok ? "닫힘" : hClosed.detail} · 버튼 초점 ${hFocus.focusOnFloat}`);

      await measure("손님", gp);

      // AD3: 손님이 mafia 카드를 누른다
      const sc3 = "avatar-dress/arrive";
      const t0 = Date.now();
      await gp.locator(`${DRESS_SHEET} button[data-outfit="mafia"]`).click({ timeout: 3000 });
      const selfMs = await until(async () => (await readLooks(gp))?.[gSeat] === "mafia", DRESS_SELF_MS);
      rec(sc3, "AD3a", `손님 화면 __mfLooks[손님] 이 ${DRESS_SELF_MS}ms 안에 mafia`, selfMs !== null, selfMs === null ? `읽은 값 ${JSON.stringify(await readLooks(gp))}` : `${Date.now() - t0}ms`);
      const peerMs = await until(async () => (await readLooks(hp))?.[gSeat] === "mafia", Math.max(0, DRESS_PEER_MS - (Date.now() - t0)));
      rec(sc3, "AD3b", `방장 화면 __mfLooks[손님] 이 ${DRESS_PEER_MS}ms 안에 mafia`, peerMs !== null, peerMs === null ? `읽은 값 ${JSON.stringify(await readLooks(hp))}` : `${Date.now() - t0}ms`);
      const pressed = await readDressUi(gp);
      rec(sc3, "AD3c", "손님 시트의 선택 카드가 mafia 하나", pressed.selected !== null && pressed.selected.pressedCount === 1 && (await gp.locator(`${DRESS_SHEET} button[data-outfit="mafia"]`).getAttribute("aria-pressed")) === "true", `선택 ${pressed.selected?.pressedCount}개`);

      // AD4: 방장이 noir 를 고른다
      const sc4 = "avatar-dress/both";
      await hp.locator(DRESS_FLOAT).click({ timeout: 3000 });
      await hp.waitForSelector(DRESS_SHEET, { timeout: 1500 });
      await hp.locator(`${DRESS_SHEET} button[data-outfit="noir"]`).click({ timeout: 3000 });
      const same = await until(async () => {
        const [a, b] = await Promise.all([readLooks(hp), readLooks(gp)]);
        return !!a && !!b && a[hSeat] === "noir" && a[gSeat] === "mafia" && b[hSeat] === "noir" && b[gSeat] === "mafia";
      }, DRESS_PEER_MS);
      rec(sc4, "AD4", `두 페이지의 __mfLooks 가 { 방장: noir, 손님: mafia } 로 같음(${DRESS_PEER_MS}ms 안)`, same !== null, same === null ? `방장 ${JSON.stringify(await readLooks(hp))} · 손님 ${JSON.stringify(await readLooks(gp))}` : "");

      // AD5: 손님도 닫는다
      await gp.locator(`${DRESS_SHEET} button[aria-label="닫기"]`).click({ timeout: 3000 });
      const gClosed = await attempt(async () => {
        await gp.waitForSelector(DRESS_SHEET, { state: "detached", timeout: 1000 });
      });
      const gFocus = await readDressUi(gp);
      rec("avatar-dress/close", "AD5b", "손님: 시트를 닫으면 시트가 사라지고 초점이 꾸미기 버튼으로 돌아옴", gClosed.ok && gFocus.focusOnFloat && gFocus.float !== null, `${gClosed.ok ? "닫힘" : gClosed.detail} · 버튼 초점 ${gFocus.focusOnFloat}`);
      await hp.locator(`${DRESS_SHEET} button[aria-label="닫기"]`).click({ timeout: 3000 });
      await hp.waitForSelector(DRESS_SHEET, { state: "detached", timeout: 1000 });

      // AD6: 게임을 시작해 낮이 되어도 같은 look, 꾸미기 버튼·시트는 없음
      const sc6 = "avatar-dress/game";
      await openTestSheet(hp);
      await setBots(hp, ht, 2);
      await startGame(hp, ht);
      await skipTo(hp, ht, "discussion");
      await Promise.all([gt.waitFor((v) => v.phase === "discussion", 6000, "손님 쪽 낮 토론"), waitWorldReady(hp, 4), waitWorldReady(gp, 4)]);
      await Promise.all([settle(hp), settle(gp)]);
      for (const [who, page] of [["방장", hp], ["손님", gp]]) {
        const looks = await readLooks(page);
        const keep = !!looks && looks[hSeat] === "noir" && looks[gSeat] === "mafia";
        rec(sc6, "AD6a", `${who}: 낮이 되어도 __mfLooks 가 방장 noir · 손님 mafia`, keep, `읽은 값 ${JSON.stringify(looks)}`);
        const ui = await readDressUi(page);
        const none = ui.float === null && ui.sheet === null && (await page.locator(DRESS_FLOAT).count()) === 0 && (await page.locator(DRESS_SHEET).count()) === 0;
        rec(sc6, "AD6b", `${who}: 게임 단계에는 꾸미기 버튼도 시트도 없음`, none, `버튼 ${ui.float ? "있음" : "없음"} · 시트 ${ui.sheet ? "있음" : "없음"}`);
      }
    } finally {
      await g.context.close().catch(() => {});
    }
    await resetAndLeave(hp, ht);
  }

  return { avatarEmoteFlow, avatarDressFlow };
}
