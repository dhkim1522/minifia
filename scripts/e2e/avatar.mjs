// 10페이즈 캐릭터 동작·의상 화면 E2E 흐름 (10-05~). avatar-emote(10-05)·avatar-dress(10-07)·avatar-phases / avatar-phases-night(10-08).
// flows.mjs 가 이미 3천 줄이라 흐름 본문은 이 파일에 둔다. flows.mjs 의 도우미는 `makeAvatarFlows(helpers)` 로 받는다(politics.mjs 와 같은 모양 — 서로 import 하지 않는다).
// helpers: { recorder, startHost, openGuest, attempt, walkableCentersOfApp, LOBBY_HOST_NICK, WORLD_GUEST_NICK, resetAndLeave, openGame, closeGame, untilGame }  (10-08 이 판 만들기 도우미 셋을 더했다)
// 판정 문턱은 lib.mjs 의 순수 검사 함수(emoteTrayChecks·dressChecks)에만 있고 여기서는 낮추지 않는다.
import { chooseRole, chooseVerdict, hitsInputSurface, leaveLobby, openTestSheet, sampleWorld, screensOfWorld, SetupError, setBots, settle, skipTo, sleep, startGame, tapWorld, typeAndSendChat, waitChatLine, waitWorldReady } from "./browser.mjs";
import { dressChecks, dressLockChecks, emoteDeliveryChecks, emoteTrayChecks, floatTrayChecks, worldTapRanking } from "./lib.mjs";
import { SHORT_PHONE_H } from "./result.mjs";

/**
 * 17-10: 방장 대기실 패널이 스위치 줄 +76 으로 326 이 되어(결정 0080-4) 낮은 폰의 방장 열이 두 줄로 접히고(390x664 — 둘째 열 옷장이 잠긴 소리 알약(119 폭) 밑에 겹쳐 있는 몇 초) 방장 스테이지가 낮아진다(360x560 → 172, UI Considerations #24 알려진 한계).
 * 소리 알약이 접힐 때까지 기다린 뒤 방장 열을 누른다(문턱은 그대로 — 일시 상태가 끝난 뒤를 본다).
 */
const waitSoundPillFolded = (page) => page.waitForSelector(".mv-sound--pill", { state: "detached", timeout: 9000 }).catch(() => {});

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
      cardStates: qa("[data-dress-sheet] button[data-outfit]").map((el) => ({ id: el.getAttribute("data-outfit"), taken: el.hasAttribute("data-taken"), disabled: el.getAttribute("aria-disabled") === "true", pressed: el.getAttribute("aria-pressed") === "true" })),
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

/** 떠 있는 버튼 묶음(.mf-float)의 수와 그 가운데 보이는(visibility 가 hidden 이 아니고 높이가 있는) 수 */
const readFloats = (page) =>
  page.evaluate(() => {
    const els = [...document.querySelectorAll(".mf-float")];
    return { count: els.length, shown: els.filter((e) => getComputedStyle(e).visibility !== "hidden" && e.getBoundingClientRect().height > 0).length };
  });

/** 이름표 층(.mf-world__tags) 안의 [data-emote] 요소 수와 이름에 emote 가 든 속성을 가진 요소 수(L31) */
const readTagEmoteMarks = (page) =>
  page.evaluate(() => {
    const layer = document.querySelector(".mf-world__tags");
    if (!layer) return { layer: false, attr: 0, named: 0, global: document.querySelectorAll("[data-emote]").length };
    const all = [layer, ...layer.querySelectorAll("*")];
    return {
      layer: true,
      attr: layer.querySelectorAll("[data-emote]").length,
      named: all.filter((el) => el.getAttributeNames().some((n) => n.toLowerCase().includes("emote"))).length,
      global: 0,
    };
  });

export function makeAvatarFlows(helpers) {
  const { recorder, startHost, openGuest, attempt, walkableCentersOfApp, LOBBY_HOST_NICK, WORLD_GUEST_NICK, resetAndLeave, openGame, closeGame, untilGame } = helpers;

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
      await waitSoundPillFolded(hp);
      // 17-10: 방장 스테이지가 낮은 폰(360x560 의 172)에서는 방장 화면의 동작 판이 내 캐릭터를 가리는 EP4 와 방장 쪽 목적지 후보가 알려진 한계다(문턱 그대로, 다른 크기는 판정).
      const hostShort = ctx.size.h < SHORT_PHONE_H;

      // AE1: 두 페이지 모두 버튼 + 판 기하
      for (const [who, page, seat] of [["방장", hp, hSeat], ["손님", gp, gSeat]]) {
        const closed = await readEmoteUi(page, seat);
        rec(`${sc}-${who}`, "AE1a", `${who}: 동작 버튼이 입력줄 맨 앞에 있고 접근성 이름 '동작 고르기', 판은 닫혀 있음`, closed.button !== null && closed.tray === null && closed.buttonLabel === "동작 고르기" && closed.button.left < (closed.input?.left ?? 0) && closed.expanded === "false", `버튼 ${closed.button ? `${Math.round(closed.button.left)},${Math.round(closed.button.top)}` : "없음"} · 이름 ${closed.buttonLabel} · 판 ${closed.tray ? "열림" : "닫힘"} · expanded ${closed.expanded}`);
        await openTray(page);
        const ui = await readEmoteUi(page, seat);
        rec(`${sc}-${who}`, "AE1b", `${who}: 판이 role=group 이름 '동작', 칸 아홉 개 순서 clap~throat`, ui.trayRole === "group" && ui.trayLabel === "동작" && ui.cells.map((c) => c.id).join(",") === "clap,praise,handshake,dance,surprise,cry,deny,point,throat", `role ${ui.trayRole} · 이름 ${ui.trayLabel} · 칸 ${ui.cells.map((c) => c.id).join(",")}`);
        for (const l of emoteTrayChecks({ button: ui.button, input: ui.input, tray: ui.tray, cells: ui.cells.map((c) => c.rect), nameFont: ui.nameFont, viewport: { w: ui.vw, h: ui.vh }, character: ui.character, hasKb: ui.kbOpen })) {
          if (!l.ok && l.id === "EP4" && hostShort && page === hp) rec(`${sc}-${who}`, l.id, `${l.label} — 알려진 한계로 참고만(방장 스테이지가 낮은 폰, 방장 패널 +76)`, true, l.detail, true);
          else rec(`${sc}-${who}`, l.id, l.label, l.ok, l.detail);
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
      const onScreen = centers.map((c, i) => ({ ...c, sx: gScreens[i]?.sx, sy: gScreens[i]?.sy, hx: hScreens[i]?.sx, hy: hScreens[i]?.sy })).filter((c, i) => inStage(gScreens[i], gw) && (hostShort || inStage(hScreens[i], hw)));
      // 떠 있는 버튼(소리 단추 12페이즈·꾸미기 hanger)이 덮은 칸을 먼저 빼고 순위를 매긴다(worldFlow 와 같은 순서) — 문턱(3 단위·낮은 스테이지 1.5 단위)은 그대로다
      const gHits = await hitsInputSurface(gp, onScreen);
      const open = onScreen.filter((_, i) => gHits[i]);
      const { ranked } = worldTapRanking(open, from);
      const target = ranked[0];
      if (!target) throw new SetupError(`탭할 목적지를 찾지 못함(보이는 칸 ${onScreen.length}개, 가리지 않은 칸 ${open.length}개)`);
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
   * AL1~AL3 손님이 고른 mafia 가 방장 옷장에서 잠기고 눌러도 방장 옷이 그대로(18-09) · AD5 시트를 닫으면 사라지고 초점이 꾸미기 버튼으로 돌아옴 · AD6 게임을 시작해 낮이 되어도 같은 look 이고 꾸미기 버튼·시트가 없음.
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
      await waitSoundPillFolded(hp);
      const hostShort = ctx.size.h < SHORT_PHONE_H; // 17-10: 방장 열이 두 줄로 접히고 패널이 올라온 낮은 폰(360x560)의 DB1 은 알려진 한계(방장 패널 +76, 0080-4)

      /** 닫힌 때의 버튼을 읽고(AD1) 눌러 시트를 연 뒤 시트·카드를 읽어(AD2) 같은 검사 줄로 기록한다. 끝나면 시트는 열려 있다. */
      const measure = async (who, page) => {
        const closed = await readDressUi(page);
        // 결정 0075: 방장은 [봇] 버튼이 하나 더 떠 있다(옷장 + 봇), 손님은 옷장 하나.
        const wantFloats = page === hp ? 2 : 1;
        const idle = closed.sheet === null && closed.float !== null && closed.floatLabel === "옷장" && closed.floatCount === wantFloats;
        rec(`${sc}-${who}`, "AD1a", `${who}: 로비에 떠 있는 버튼이 ${wantFloats}개(방장은 봇 포함, 0075), 옷장 접근성 이름 '옷장'(14-07 TOOL-01), 시트는 닫혀 있음`, idle, `버튼 ${closed.float ? "있음" : "없음"} · 이름 ${closed.floatLabel} · 떠 있는 버튼 ${closed.floatCount}개 · 시트 ${closed.sheet ? "열림" : "닫힘"}`);
        await page.locator(DRESS_FLOAT).click({ timeout: 3000 });
        await page.waitForSelector(DRESS_SHEET, { timeout: 1500 });
        await sleep(150);
        const open = await readDressUi(page);
        const hidden = open.float === null;
        rec(`${sc}-${who}`, "AD2a", `${who}: 시트가 열리면 떠 있는 버튼은 숨고 카드 아홉 개가 UI-SPEC 순서`, hidden && open.cardIds.join(",") === "coat,police,doctor,mafia,detective,reporter,elder,hood,noir", `버튼 ${hidden ? "숨음" : "보임"} · 카드 ${open.cardIds.join(",")}`);
        for (const l of dressChecks({ float: closed.float, panel: open.panel, sheet: open.sheet, cards: open.cards, close: open.close, selected: open.selected, nameFont: open.nameFont, viewport: { w: open.vw, h: open.vh }, kb: open.kbOpen })) {
          if (!l.ok && l.id === "DB1" && hostShort && page === hp) rec(`${sc}-${who}`, l.id, `${l.label} — 알려진 한계로 참고만(낮은 폰의 방장 열, 방장 패널 +76)`, true, l.detail, true);
          else rec(`${sc}-${who}`, l.id, l.label, l.ok, l.detail);
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

      // AL1~AL3 (18-09, D-02): 손님이 고른 mafia 가 방장 옷장에서 잠기고, 눌러도 방장 옷이 그대로다(방장 시트는 AD4 에서 열려 있다)
      const scL = "avatar-dress/lock";
      const lockOpen = await readDressUi(hp);
      const otherLooks = ht.last().players.filter((p) => p.seat !== hSeat && typeof p.look === "string").map((p) => p.look);
      await hp.locator(`${DRESS_SHEET} button[data-outfit="mafia"]`).click({ force: true, timeout: 3000 }); // aria-disabled 카드는 Playwright 가 기다리므로 force — 실제 누름 이벤트는 그대로 간다
      await sleep(1500);
      const viewLook = ht.last().players.find((p) => p.seat === hSeat)?.look ?? "coat";
      const hookLook = (await readLooks(hp))?.[hSeat] ?? "coat";
      for (const l of dressLockChecks({ cards: lockOpen.cardStates, otherLooks, myLook: "noir", afterTap: viewLook === hookLook ? viewLook : `${viewLook}|${hookLook}` })) rec(scL, l.id, l.label, l.ok, l.detail);

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

  // ---- avatar-phases / avatar-phases-night (10-08, D-12·D-14·D-18·D-20, L27·L31) ----

  /** 판이 열리고 칸이 모두 풀릴 때까지 기다린 뒤 원하는 칸을 눌러 동작을 보낸다. 같은 보낸 사람의 앞 전송과 GAP_MS 이상 떨어진다. */
  const lastSend = new WeakMap();
  async function sendEmote(page, seat, id) {
    const gap = GAP_MS - (Date.now() - (lastSend.get(page) ?? 0));
    if (gap > 0) await sleep(gap);
    // 채팅을 보낸 뒤에는 입력칸에 초점이 남아 있다 — 이때 동작 버튼은 키보드만 닫는다(AE5). 평소 사람처럼 초점을 뺀 뒤 누른다
    await page.evaluate(() => document.activeElement?.blur?.());
    const free = await waitUnblocked(page, seat);
    if (free === null) throw new SetupError("동작 칸이 풀리지 않음(8초) — 이동이 막혀서가 아니라 걷는 중이거나 앞 동작이 안 끝남");
    await openTray(page);
    await page.locator(`[data-emote="${id}"]`).click({ timeout: 3000 });
    lastSend.set(page, Date.now());
  }

  /**
   * 한 장면의 동작 도착(arrive)·0건(absent)을 기록한다. sender = { name, page, seat }, receivers = [{ name, page }].
   * 이름표 층 검사(AP7)는 호출한 쪽이 sampleTags 로 모아 둔다.
   */
  async function deliver(rec, sc, id, { sender, receivers, emoteId, mode, senderArrive = true, tagSamples }) {
    const befores = await Promise.all(receivers.map((r) => readEmotes(r.page)));
    await sendEmote(sender.page, sender.seat, emoteId);
    const sample = async () => {
      const [s, ...rs] = await Promise.all([readEmotes(sender.page), ...receivers.map((r) => readEmotes(r.page))]);
      return { s, rs };
    };
    const hit = (e) => !!e && e.last !== null && e.last.seat === sender.seat && e.last.id === emoteId && e.playing.includes(sender.seat);
    let obs;
    if (mode === "arrive") {
      await until(async () => {
        obs = await sample();
        return hit(obs.s) && obs.rs.every(hit);
      }, ARRIVE_MS);
      obs = await sample();
    } else {
      // 오지 않음: 보낸 사람 자기 페이지의 도착을 잡은 순간의 값을 쓰고(동작은 1~2초면 끝난다), 받으면 안 되는 페이지는 도착 상한 동안 계속 훑어
      // 한 번이라도 프레임이 보이면 그 표본을 실패 근거로 쓴다(늦게 와도 잡히고, 왔다가 끝난 것도 놓치지 않는다)
      let senderObs = null;
      let bad = null;
      const t0 = Date.now();
      while (Date.now() - t0 <= ARRIVE_MS * 2) {
        const cur = await sample();
        if (senderObs === null && hit(cur.s)) senderObs = cur.s;
        const seen = cur.rs.some((r, i) => JSON.stringify(r.last) !== JSON.stringify(befores[i].last) || r.playing.includes(sender.seat));
        if (seen && bad === null) bad = cur;
        obs = cur;
        if (senderObs !== null && Date.now() - t0 >= ARRIVE_MS) break;
        await sleep(60);
      }
      obs = { s: senderObs ?? obs.s, rs: (bad ?? obs).rs };
    }
    const lines = emoteDeliveryChecks({
      sender: senderArrive ? { name: sender.name, last: obs.s.last, playing: obs.s.playing } : null,
      receivers: receivers.map((r, i) => ({ name: r.name, before: befores[i].last, last: obs.rs[i].last, playing: obs.rs[i].playing })),
      expectSeat: sender.seat,
      expectId: emoteId,
      mode,
    });
    for (const l of lines) rec(sc, `${id}-${l.id}`, l.label, l.ok, l.detail);
    // 동작이 도는 순간의 이름표 층도 본다(L31)
    for (const who of [sender, ...receivers]) tagSamples.push({ where: `${sc}/${id}/${who.name}`, mark: await readTagEmoteMarks(who.page) });
  }

  function recordTagSamples(rec, sc, samples) {
    const bad = samples.filter((x) => !x.mark.layer || x.mark.attr !== 0 || x.mark.named !== 0 || x.mark.global !== 0);
    rec(sc, "AP7", `모든 시점·모든 페이지의 이름표 층(.mf-world__tags)에 [data-emote] 도 emote 가 든 속성도 0개(L31) — 표본 ${samples.length}개`, samples.length > 0 && bad.length === 0, bad.map((x) => `${x.where} ${JSON.stringify(x.mark)}`).join(" / ") || (samples.length === 0 ? "표본 없음" : ""));
  }

  /** 단계에 닿아 두 페이지가 그 단계 틀을 그리고 이름표 층이 있을 때까지 */
  async function reach(pages, phase) {
    await Promise.all(pages.map((p) => untilGame(p, (g) => g.phase === phase, 9000, `${phase} 도착`)));
  }

  /**
   * avatar-phases (D-18, 390x844 한 크기): 한 판(방장 시민 + 손님 + 봇 4)으로 AP1 낮 토론(도착 + 떠 있는 버튼 숨김·복귀) · AP2 지목(이동이 막힌 단계에서도 동작과 채팅이 같이 도착) ·
   * AP3 변론·찬반 · 처형 뒤 AP4 아침(산 사람 동작이 유령에게 도착) · AP6 유령 방장의 동작이 산 손님 페이지에 0건이고 유령 자기 페이지에는 있음 · AP7 모든 시점의 이름표 층에 [data-emote] 0개.
   * AP5(밤 마피아→시민 편 0건)는 방장이 마피아여야 해서 avatar-phases-night 가 맡는다.
   */
  async function avatarPhasesFlow(ctx) {
    const rec = recorder(ctx);
    const id = "avatar-phases";
    const game = await openGame(ctx, id, { guests: 1, bots: 4, role: "citizen", vote: { exec: "yes", pick: "host" }, to: "discussion" });
    try {
      const { hp, ht, hostSeat: hSeat } = game;
      const guest = game.guests[0];
      const gp = guest.page;
      const gt = guest.tracker;
      const gSeat = guest.seat;
      const H = { name: "방장", page: hp, seat: hSeat };
      const G = { name: "손님", page: gp, seat: gSeat };
      const tags = [];
      await reach([hp, gp], "discussion");
      await Promise.all([waitWorldReady(hp, 6), waitWorldReady(gp, 6)]);
      await Promise.all([settle(hp), settle(gp)]);

      // AP1 낮 토론: 손님 → 방장 도착, 판이 열린 동안 떠 있는 버튼이 숨고 닫으면 돌아옴
      {
        const sc = `${id}/discussion`;
        const free = await waitUnblocked(gp, gSeat);
        if (free === null) throw new SetupError("낮 토론에서 손님 동작 칸이 풀리지 않음");
        const before = await readFloats(gp);
        await openTray(gp);
        await sleep(120);
        const open = await readFloats(gp);
        await closeTray(gp);
        await sleep(120);
        const after = await readFloats(gp);
        for (const l of floatTrayChecks({ visibleBefore: before, hiddenWhileOpen: open, visibleAfter: after }, { floatsOn: false /* 기본판(결정 0072): 떠 있는 버튼 없음. 판 규칙(rulesetOf)의 배지·귓속말을 켜면 true */ })) rec(sc, `AP1-${l.id}`, l.label, l.ok, l.ok ? "" : `${l.detail} (닫힘 ${JSON.stringify(before)} · 열림 ${JSON.stringify(open)} · 닫은 뒤 ${JSON.stringify(after)})`);
        await deliver(rec, sc, "AP1", { sender: G, receivers: [H], emoteId: "clap", mode: "arrive", tagSamples: tags });
      }

      // AP2 지목: 이동이 막힌 단계 — 동작과 채팅 한 줄이 같이 도착
      {
        const sc = `${id}/nomination`;
        await skipTo(hp, ht, "nomination");
        await reach([hp, gp], "nomination");
        await settle(hp);
        await deliver(rec, sc, "AP2", { sender: G, receivers: [H], emoteId: "dance", mode: "arrive", tagSamples: tags });
        const text = "지목중채팅";
        await typeAndSendChat(gp, text);
        const chat = await attempt(async () => {
          await waitChatLine(hp, text, 3000);
        });
        rec(sc, "AP2-chat", "같은 지목 단계에서 손님의 채팅 한 줄도 방장에게 도착(이동 차단과 무관)", chat.ok, chat.detail);
      }

      // AP3 변론·찬반: 봇이 방장을 가리켜 방장이 변론자. 변론자도 동작 가능
      {
        const sc = `${id}/trial`;
        await skipTo(hp, ht, "defense");
        await reach([hp, gp], "defense");
        await settle(hp);
        await deliver(rec, `${sc}-defense`, "AP3a", { sender: H, receivers: [G], emoteId: "cry", mode: "arrive", tagSamples: tags });
        await skipTo(hp, ht, "verdict");
        await reach([hp, gp], "verdict");
        await settle(hp);
        await deliver(rec, `${sc}-verdict`, "AP3b", { sender: G, receivers: [H], emoteId: "clap", mode: "arrive", tagSamples: tags });
        // 찬성으로 처형까지 보낸다
        await untilGame(gp, (x) => x.phase === "verdict" && x.verdictBtns.length === 2, 6000, "찬반 도착");
        await chooseVerdict(gp, true).catch(() => {});
      }

      // 처형 → 밤 → 아침. 방장은 유령이 된다
      await skipTo(hp, ht, "execution");
      await reach([hp, gp], "execution");
      await skipTo(hp, ht, "morning");
      await reach([hp, gp], "morning");
      await Promise.all([settle(hp), settle(gp)]);
      const gv = gt.last();
      if (!(gv.players.find((p) => p.seat === gSeat)?.alive !== false)) throw new SetupError("손님이 첫 밤에 탈락함 — 새 방으로 다시 돈다");
      if (ht.last().players.find((p) => p.seat === hSeat)?.alive !== false) throw new SetupError("방장이 처형되지 않음 — 새 방으로 다시 돈다");

      // AP4 아침: 산 손님의 동작이 산 사람과 유령(방장)에게 도착
      await deliver(rec, `${id}/morning`, "AP4", { sender: G, receivers: [H], emoteId: "dance", mode: "arrive", tagSamples: tags });

      // AP6 유령: 처형된 방장의 동작은 산 손님 페이지에 0건, 유령 자기 페이지에는 있음
      await deliver(rec, `${id}/ghost`, "AP6", { sender: H, receivers: [G], emoteId: "surprise", mode: "absent", tagSamples: tags });

      recordTagSamples(rec, `${id}/tags`, tags);
    } finally {
      await closeGame(game);
    }
  }

  /**
   * avatar-phases-night (D-18·D-20, 390x844): 방장 마피아 + 손님(시민 편) + 봇. AP5 밤 마피아 방장의 동작이 시민 손님 페이지에 0건이고 손님 밤 DOM 에 [data-emote-button]·[data-emote-tray] 가 0개,
   * 마피아 방장 자기 페이지에는 자기 프레임이 있다 · AP7 밤의 이름표 층에도 [data-emote] 0개.
   */
  async function avatarPhasesNightFlow(ctx) {
    const rec = recorder(ctx);
    const id = "avatar-phases-night";
    const game = await openGame(ctx, id, { guests: 1, bots: 4, role: "mafia", vote: { exec: "no", pick: "other" }, to: "discussion" });
    try {
      const { hp, ht, hostSeat: hSeat } = game;
      const guest = game.guests[0];
      const gp = guest.page;
      const gt = guest.tracker;
      const gSeat = guest.seat;
      const H = { name: "마피아 방장", page: hp, seat: hSeat };
      const G = { name: "시민 편 손님", page: gp, seat: gSeat };
      const tags = [];
      if (gt.last().me.role === "mafia") throw new SetupError("손님도 마피아 — 새 방으로 다시 돈다");
      await skipTo(hp, ht, "night");
      await reach([hp, gp], "night");
      await Promise.all([settle(hp), settle(gp)]);
      const sc = `${id}/night`;

      const dom = await gp.evaluate(() => ({ button: document.querySelectorAll("[data-emote-button]").length, tray: document.querySelectorAll("[data-emote-tray]").length, cell: document.querySelectorAll("[data-emote]").length }));
      rec(sc, "AP5a", "시민 편 손님의 밤 DOM 에 [data-emote-button]·[data-emote-tray]·[data-emote] 가 0개(D-20)", dom.button === 0 && dom.tray === 0 && dom.cell === 0, `버튼 ${dom.button} · 판 ${dom.tray} · 칸 ${dom.cell}`);
      const hostDom = await hp.evaluate(() => document.querySelectorAll("[data-emote-button]").length);
      // 15-08: 밤 마피아 화면은 시민 편과 같은 얼굴 목록 하나(채팅 패널 삭제)라 동작 버튼이 없다 — 마피아 → 시민 편 동작 도착 0건은 보낼 수단이 없는 것으로 대신한다
      rec(sc, "AP5b", "마피아 방장의 밤 아래 패널에도 동작 버튼이 없다(15-08: 네 역할 같은 얼굴 목록)", hostDom === 0, `버튼 ${hostDom}`);
      // 보낸 동작이 없어도 밤 두 화면(마피아 방장·시민 편 손님)의 이름표 층에 동작 표식이 없음은 그대로 표본으로 본다(AP7)
      for (const who of [H, G]) tags.push({ where: `${sc}/AP5/${who.name}`, mark: await readTagEmoteMarks(who.page) });
      recordTagSamples(rec, `${id}/tags`, tags);
    } finally {
      await closeGame(game);
    }
  }

  return { avatarEmoteFlow, avatarDressFlow, avatarPhasesFlow, avatarPhasesNightFlow };
}
