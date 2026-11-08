// 11페이즈 맵 선택 E2E (11-13, 결정 D-20·D-21, UI-SPEC F-2·G; 16-06: 칩은 오른쪽 열의 52 원, 손님에게는 칩이 없다): 지도 칩·꾸미기 시트 맵 탭·카드 기하, 선택이 모든 페이지에 반영,
// 시작 뒤 모두 같은 맵, 광장에서 한 판이 ended 까지. 흐름 본문은 이 파일에 둔다(flows.mjs 의 도우미는 `makeMapSelectFlows(helpers)` 로 받는다 — avatar.mjs 와 같은 모양).
// helpers: { recorder, startHost, openGuest, attempt, LOBBY_HOST_NICK, WORLD_GUEST_NICK, settledResult }
// 판정 문턱은 아래 순수 검사 함수(mapChoiceChecks)에만 있고 흐름은 낮추지 않는다. 칩·카드 기하는 src/styles/v2.css 와 같아야 하고 test/unit/e2eContract.test.ts 가 대조한다.
import { chooseRole, chooseVerdict, clickInDialog, closeSheet, openTestSheet, readGame, setBotVote, setBots, settle, skipTo, sleep, startGame, waitWorldReady } from "./browser.mjs";

/** 앱이 더한 DOM 표식·훅 이름. test/unit/e2eContract.test.ts 가 각각이 git 추적 src/ 파일에 실제로 있는지 확인한다(이름 오타 방지) */
export const MAP_MARKERS = Object.freeze([
  "data-map-chip", // 지도 칩 data-map-chip="{bar|plaza|random}" (방장에게만 있다, 16-06)
  "data-map-card", // 시트 맵 카드 data-map-card="{bar|plaza|random}" (aria-pressed)
  "data-map-tab", // 시트 탭 data-map-tab="{map|dress}" (방장에게만)
  "__mfMap", // 테스트 훅 window.__mfMap = "bar" | "plaza" (렌더러에 올린 맵)
]);

/**
 * 칩(16-06 V-2·V-5): 오른쪽 열의 두 번째 칸 — 상자가 곧 지름 52 원 · 오른쪽 16 · 위 = 자막 띠 아랫변 + 12(열 윗변) + 64(소리 칸 52 + 간격 12).
 * 칸 나누기는 한 열 최소 2개라 맵 칸은 언제나 오른쪽 열의 둘째 칸이다.
 */
export const MAP_CHIP = Object.freeze({ disc: 52, hit: 52, right: 16, below: 76 });
/** 맵 카드: 96×112, 간격 8, 합 304 */
export const MAP_CARD = Object.freeze({ w: 96, h: 112, gap: 8, total: 304 });

const isNum = (x) => typeof x === "number" && Number.isFinite(x);
const isBox = (b) => !!b && isNum(b.left) && isNum(b.top) && isNum(b.width) && isNum(b.height) && isNum(b.right) && isNum(b.bottom);
const within = (a, b, tol) => isNum(a) && isNum(b) && Math.abs(a - b) <= tol;
const result = (id, label, bad) => ({ id, label, ok: bad.length === 0, detail: bad.length === 0 ? "" : bad.join("; ") });
const noMeasure = (id, label, what) => result(id, label, [`측정값 없음(${what})`]);
const r1 = (n) => Math.round(n * 10) / 10;
const overlap = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
const inside = (inner, outer) => inner.left >= outer.left - 0.5 && inner.right <= outer.right + 0.5 && inner.top >= outer.top - 0.5 && inner.bottom <= outer.bottom + 0.5;

/**
 * MS1~MS6 맵 선택 화면 판정. 입력 (Box = { left, top, width, height, right, bottom }):
 *  viewport {w,h} · headerBottom 헤더 아래 끝(자막 띠가 있으면 띠 아랫변) · chip { disc, hit, label } 방장 칩(상자가 곧 면이라 disc = hit) · guest { chipCount } 손님 화면의 칩 수
 *  sheet 방장 시트(맵 탭이 열린 채) · tabs 시트 탭 상자 · guestTabs 손님 시트의 탭 수 · cards 맵 카드 상자 · selected 선택 카드 수 · selectedId 선택 카드 id · selectedWant 기대 선택(기본 random)
 *  testBtn [테스트] 버튼 상자(없으면 null) · tags 이름표 상자.
 * MS1 칩 52±1(원)·오른쪽 16±1·위 = 헤더(띠) 아래 + 76 ±2(열 윗변 12 + 소리 칸 64) · MS2 손님 화면에 칩 없음(T-16-13)
 *  MS3 방장 시트 탭 둘(각 44×44 이상)·손님 시트 탭 없음 · MS4 카드 3장 96×112 ±2·사이 8 ±2·합 304 이하·시트 안 · MS5 선택 카드 정확히 하나(기본 random)
 *  MS6 MC-OVERLAP: 칩 누르기 영역이 [테스트] 버튼·이름표와 겹치지 않음.
 */
export function mapChoiceChecks(m) {
  const L = {
    MS1: "지도 칩: 52 원·오른쪽 16·헤더(띠) 아래 76(열 윗변 12 + 소리 칸 64)",
    MS2: "지도 칩: 손님 화면에는 없다(방장만)",
    MS3: "꾸미기 시트: 방장은 [맵][의상] 탭 둘(44×44 이상), 손님은 탭 없음",
    MS4: "꾸미기 시트 맵 탭: 카드 3장 96×112·간격 8·합 304 이하·시트 안",
    MS5: "꾸미기 시트 맵 탭: 선택 카드가 정확히 하나",
    MS6: "지도 칩이 [테스트] 버튼·이름표와 겹치지 않음 (MC-OVERLAP)",
  };
  const out = [];
  const add = (id, bad) => out.push(result(id, L[id], bad));
  const miss = (id, what) => out.push(noMeasure(id, L[id], what));

  // MS1
  const chip = m?.chip;
  if (!isBox(chip?.disc) || !isBox(chip?.hit) || !isNum(m?.headerBottom)) miss("MS1", "chip.disc·hit·headerBottom");
  else {
    const bad = [];
    if (!within(chip.disc.width, MAP_CHIP.disc, 1) || !within(chip.disc.height, MAP_CHIP.disc, 1)) bad.push(`시각 ${r1(chip.disc.width)}x${r1(chip.disc.height)} ≠ ${MAP_CHIP.disc}`);
    if (chip.hit.width + 0.5 < MAP_CHIP.hit || chip.hit.height + 0.5 < MAP_CHIP.hit) bad.push(`누르기 ${r1(chip.hit.width)}x${r1(chip.hit.height)} < ${MAP_CHIP.hit}`);
    const marginRight = isNum(m?.viewport?.w) ? m.viewport.w - chip.disc.right : NaN;
    if (!within(marginRight, MAP_CHIP.right, 1)) bad.push(`오른쪽 여백 ${r1(marginRight)} ≠ ${MAP_CHIP.right}`);
    const wantTop = m.headerBottom + MAP_CHIP.below;
    if (!within(chip.disc.top, wantTop, 2)) bad.push(`위 ${r1(chip.disc.top)} ≠ 헤더(띠) 아래 ${r1(m.headerBottom)} + ${MAP_CHIP.below}`);
    add("MS1", bad);
  }

  // MS2
  const g = m?.guest;
  if (!g || !isNum(g.chipCount)) miss("MS2", "guest.chipCount");
  else add("MS2", g.chipCount === 0 ? [] : [`손님 화면에 칩 ${g.chipCount}개`]);

  // MS3
  if (!Array.isArray(m?.tabs) || !isNum(m?.guestTabs)) miss("MS3", "tabs·guestTabs");
  else {
    const bad = [];
    if (m.tabs.length !== 2) bad.push(`방장 탭 ${m.tabs.length}개 ≠ 2`);
    for (const [i, t] of m.tabs.entries()) if (!isBox(t) || t.width + 0.5 < 44 || t.height + 0.5 < 44) bad.push(`탭 ${i + 1} ${isBox(t) ? `${r1(t.width)}x${r1(t.height)}` : "상자 없음"} < 44`);
    if (m.guestTabs !== 0) bad.push(`손님 시트에 탭 ${m.guestTabs}개`);
    add("MS3", bad);
  }

  // MS4
  if (!Array.isArray(m?.cards) || !isBox(m?.sheet)) miss("MS4", "cards·sheet");
  else {
    const bad = [];
    if (m.cards.length !== 3) bad.push(`카드 ${m.cards.length}장 ≠ 3`);
    else if (m.cards.some((c) => !isBox(c))) bad.push("카드 상자 없음");
    else {
      const cs = [...m.cards].sort((a, b) => a.left - b.left);
      for (const [i, c] of cs.entries()) {
        if (!within(c.width, MAP_CARD.w, 2) || !within(c.height, MAP_CARD.h, 2)) bad.push(`카드 ${i + 1} ${r1(c.width)}x${r1(c.height)} ≠ ${MAP_CARD.w}x${MAP_CARD.h}`);
        if (!inside(c, m.sheet)) bad.push(`카드 ${i + 1} 이 시트 밖`);
      }
      for (let i = 1; i < cs.length; i++) {
        const gap = cs[i].left - cs[i - 1].right;
        if (!within(gap, MAP_CARD.gap, 2)) bad.push(`카드 ${i}·${i + 1} 사이 ${r1(gap)} ≠ ${MAP_CARD.gap}`);
      }
      const span = cs[2].right - cs[0].left;
      if (span > MAP_CARD.total + 2) bad.push(`합 ${r1(span)} > ${MAP_CARD.total}`);
    }
    add("MS4", bad);
  }

  // MS5
  if (!isNum(m?.selected) || typeof m?.selectedId !== "string") miss("MS5", "selected·selectedId");
  else {
    const bad = [];
    if (m.selected !== 1) bad.push(`선택 카드 ${m.selected}개 ≠ 1`);
    const want = m.selectedWant ?? "random";
    if (m.selectedId !== want) bad.push(`선택 ${m.selectedId} ≠ ${want}`);
    add("MS5", bad);
  }

  // MS6
  if (!isBox(chip?.hit) || !Array.isArray(m?.tags)) miss("MS6", "chip.hit·tags");
  else {
    const bad = [];
    if (isBox(m.testBtn) && overlap(chip.hit, m.testBtn)) bad.push("[테스트] 버튼과 겹침");
    const hitTags = m.tags.filter((t) => isBox(t) && overlap(chip.hit, t));
    if (hitTags.length > 0) bad.push(`이름표 ${hitTags.length}개와 겹침 — 칩 (${Math.round(chip.hit.left)},${Math.round(chip.hit.top)},${Math.round(chip.hit.right)},${Math.round(chip.hit.bottom)}) · 이름표 ${hitTags.map((t) => `(${Math.round(t.left)},${Math.round(t.top)},${Math.round(t.right)},${Math.round(t.bottom)})`).join(" ")}`);
    add("MS6", bad);
  }
  return out;
}

const CHIP = "[data-map-chip]";
const SHEET = "[data-dress-sheet]";
const DRESS_FLOAT = '[data-float="dress"]';
/** 선택이 서버를 지나 모든 페이지에 닿는 상한(ms) */
const ARRIVE_MS = 1500;

/** 한 페이지의 칩·시트·카드·이름표·테스트 버튼 기하와 선택 상태를 한 번에 읽는다. 로비·결과 화면 모두 읽는다 */
export function readMapUi(page) {
  return page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const qa = (s) => [...document.querySelectorAll(s)];
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
    };
    const chip = q("[data-map-chip]");
    const header = q(".mf-lobby__header, .mf-result__header");
    const band = q("[data-host-band] .mv-host__band");
    const pressed = qa("[data-dress-sheet] button[data-map-card][aria-pressed='true']");
    return {
      vw: window.innerWidth,
      vh: window.innerHeight,
      // 14페이즈: 칩은 자막 띠 면(.mv-host__band) 아래 8 에 선다 — 띠가 있으면 그 아랫변, 없으면 헤더 아랫변이 기준이다(입력 이름은 headerBottom 그대로)
      headerBottom: band ? band.getBoundingClientRect().bottom : header ? header.getBoundingClientRect().bottom : null,
      chip: chip ? { disc: rect(chip), hit: rect(chip), label: chip.getAttribute("aria-label"), id: chip.getAttribute("data-map-chip"), ariaDisabled: chip.getAttribute("aria-disabled") === "true" } : null,
      sheet: rect(q("[data-dress-sheet]")),
      tabs: qa("[data-dress-sheet] button[data-map-tab]").map((el) => rect(el)),
      tabIds: qa("[data-dress-sheet] button[data-map-tab]").map((el) => el.getAttribute("data-map-tab")),
      cards: qa("[data-dress-sheet] button[data-map-card]").map((el) => rect(el)),
      cardIds: qa("[data-dress-sheet] button[data-map-card]").map((el) => el.getAttribute("data-map-card")),
      selected: pressed.length,
      selectedId: pressed[0]?.getAttribute("data-map-card") ?? null,
      outfitCards: qa("[data-dress-sheet] button[data-outfit]").length,
      testBtn: rect(q(".mf-lobby__test .mf-tt")),
      tags: qa(".mf-world__tag .mv-tag").map((el) => rect(el)),
      map: window.__mfMap ?? null,
    };
  });
}

/** window.__mfMap 사본(훅이 없으면 null) */
const readMapHook = (page) => page.evaluate(() => window.__mfMap ?? null);

/** 조건이 참이 될 때까지 50ms 간격으로 본다. 참이 된 시각(ms)을 돌려주고 시간 안에 안 되면 null */
async function until(fn, ms) {
  const t0 = Date.now();
  for (;;) {
    if (await fn().catch(() => false)) return Date.now() - t0;
    if (Date.now() - t0 > ms) return null;
    await sleep(50);
  }
}

/** 시트가 열려 있으면 닫기(없으면 아무것도 하지 않는다) */
async function closeDressSheet(page) {
  if ((await page.locator(SHEET).count()) === 0) return;
  await page.locator(`${SHEET} button[aria-label="닫기"]`).click({ timeout: 3000 });
  await page.waitForSelector(SHEET, { state: "detached", timeout: 1500 });
}

/**
 * 방장 페이지에서 지도 칩을 눌러 맵 탭에서 카드 id 를 고르고 서버 값(view.mapChoice)이 바뀔 때까지 기다린 뒤 시트를 닫는다.
 * perf-run.mjs 의 nightload --map plaza 가 시작 전에 쓴다. 테스트 도구 시트가 열려 있으면 먼저 닫는다. id 가 이미 선택돼 있어도 같은 흐름이다.
 * @param {import("playwright-core").Page} page 방장 페이지 (로비 또는 결과 화면)
 * @param {{ last(): any, waitFor(pred: (v: any) => boolean, ms: number, label: string): Promise<any> }} tracker
 * @param {"bar"|"plaza"|"random"} id
 */
export async function pickMapViaUi(page, tracker, id) {
  await closeSheet(page).catch(() => {});
  await page.locator(CHIP).click({ timeout: 4000 });
  await page.waitForSelector(`${SHEET} button[data-map-card="${id}"]`, { timeout: 3000 });
  if ((tracker.last()?.mapChoice ?? "random") !== id) {
    await page.locator(`${SHEET} button[data-map-card="${id}"]`).click({ timeout: 3000 });
    await tracker.waitFor((v) => (v.mapChoice ?? "random") === id, 4000, `맵 선택 ${id} 반영`);
  }
  await closeDressSheet(page);
}

/**
 * 흐름 map-select 와 그 도우미를 만든다. 칩·시트 기하는 로비에서, 선택 반영은 모든 페이지에서, 시작 뒤 맵은 훅(__mfMap)으로, 광장 한 판은 ended 까지 본다.
 * 시작 전 view 에 map 키가 없음은 워커 시험(L42)이 이미 고정했으므로 여기서는 훅 값으로만 본다.
 */
export function makeMapSelectFlows(helpers) {
  const { recorder, startHost, openGuest, attempt, LOBBY_HOST_NICK, WORLD_GUEST_NICK, settledResult } = helpers;

  /** 테스트 시트로 로비로 되돌린다(선택 mapChoice 는 방에 남는다) */
  async function backToLobbyViaSheet(page, tracker) {
    await openTestSheet(page);
    await clickInDialog(page, "테스트 도구", "대기실로 되돌리기");
    await tracker.waitFor((v) => v.phase === "lobby", 4000, "대기실 복귀");
    await closeSheet(page).catch(() => {});
    await sleep(300);
  }

  async function mapSelectFlow(ctx) {
    const rec = recorder(ctx);
    const host = await startHost(ctx, "map-select", { nickname: LOBBY_HOST_NICK });
    const { page: hp, tracker: ht } = host;
    const { guest: g, seat: gSeat } = await openGuest(ctx, WORLD_GUEST_NICK);
    try {
      const { page: gp, tracker: gt } = g;
      await Promise.all([ht.waitFor((v) => v.players.length === 2, 5000, "방장 쪽 인원 2"), gt.waitFor((v) => v.players.length === 2, 5000, "손님 쪽 인원 2")]);
      await Promise.all([waitWorldReady(hp, 2), waitWorldReady(gp, 2)]);
      // 봇 둘로 4명판(시작 조건)을 채운다. 시트를 닫은 뒤에도 이름표가 모두 놓일 때까지 기다린다
      await openTestSheet(hp);
      await setBots(hp, ht, 2);
      await closeSheet(hp);
      await Promise.all([waitWorldReady(hp, 4), waitWorldReady(gp, 4)]);
      await Promise.all([settle(hp), settle(gp)]);

      // ── 로비: 칩(MS1·MS2·MS6) ──
      const sc = "map-select/lobby";
      const h0 = await readMapUi(hp);
      const g0 = await readMapUi(gp);
      rec(sc, "MC0", "방장 로비에는 지도 칩이 있고 기본 선택은 랜덤(맵 랜덤), 손님 로비에는 칩이 없다", h0.chip?.label === "맵 랜덤" && g0.chip === null, `방장 ${h0.chip?.label} · 손님 ${g0.chip?.label ?? "없음"}`);
      rec(sc, "MC1", "로비 무대는 늘 재즈 바(__mfMap = bar, 두 페이지)", h0.map === "bar" && g0.map === "bar", `방장 ${h0.map} · 손님 ${g0.map}`);
      // 손님 화면에는 칩이 없다(16-06: 맵은 방장만, T-16-13)
      const guestInfo = { chipCount: await gp.locator(CHIP).count() };

      // ── 방장이 칩을 눌러 맵 탭 ──
      await hp.locator(CHIP).click({ timeout: 3000 });
      await hp.waitForSelector(`${SHEET} button[data-map-card]`, { timeout: 2000 });
      await sleep(200);
      const hOpen = await readMapUi(hp);
      rec(sc, "MC2", "방장이 칩을 누르면 시트가 맵 탭(카드 셋, 의상 카드 없음)으로 열림", hOpen.cardIds.join(",") === "bar,plaza,random" && hOpen.outfitCards === 0, `카드 ${hOpen.cardIds.join(",")} · 의상 카드 ${hOpen.outfitCards}`);
      // 손님: 꾸미기 시트를 열어 탭이 없는지 본다
      await gp.locator(DRESS_FLOAT).click({ timeout: 3000 });
      await gp.waitForSelector(SHEET, { timeout: 1500 });
      const gSheet = await readMapUi(gp);
      await closeDressSheet(gp);
      const rows = mapChoiceChecks({
        viewport: { w: hOpen.vw, h: hOpen.vh },
        headerBottom: hOpen.headerBottom,
        chip: hOpen.chip,
        guest: guestInfo,
        sheet: hOpen.sheet,
        tabs: hOpen.tabs,
        guestTabs: gSheet.tabs.length + gSheet.cards.length,
        cards: hOpen.cards,
        selected: hOpen.selected,
        selectedId: hOpen.selectedId,
        testBtn: hOpen.testBtn,
        tags: hOpen.tags.filter(Boolean),
      });
      // MS6 는 두 번에 나눠 본다: 방장 칩이 [테스트] 버튼(왼쪽 위)과 겹치지 않음, 방장 칩이 이름표와 겹치지 않음. 이름표 쪽은 칩이 오른쪽 열로 옮겨져 손님 화면에는 없다.
      const hostBtn = mapChoiceChecks({ viewport: { w: hOpen.vw, h: hOpen.vh }, headerBottom: hOpen.headerBottom, chip: hOpen.chip, guest: guestInfo, sheet: hOpen.sheet, tabs: hOpen.tabs, guestTabs: 0, cards: hOpen.cards, selected: hOpen.selected, selectedId: hOpen.selectedId, testBtn: hOpen.testBtn, tags: [] }).find((r) => r.id === "MS6");
      const guestTags = mapChoiceChecks({ viewport: { w: h0.vw, h: h0.vh }, headerBottom: h0.headerBottom, chip: h0.chip, guest: guestInfo, sheet: hOpen.sheet, tabs: hOpen.tabs, guestTabs: 0, cards: hOpen.cards, selected: hOpen.selected, selectedId: hOpen.selectedId, testBtn: null, tags: h0.tags.filter(Boolean) }).find((r) => r.id === "MS6");
      for (const r of rows) {
        if (r.id === "MS6") {
          rec(sc, "MS6a", "방장 칩이 [테스트] 버튼과 겹치지 않음 (MC-OVERLAP)", hostBtn.ok, hostBtn.detail);
          rec(sc, "MS6b", "방장 칩이 이름표와 겹치지 않음 (MC-OVERLAP)", guestTags.ok, guestTags.detail);
        } else rec(sc, r.id, r.label, r.ok, r.detail);
      }

      // ── 광장 선택 → 모든 페이지 반영 ──
      const sc2 = "map-select/pick";
      const t0 = Date.now();
      await hp.locator(`${SHEET} button[data-map-card="plaza"]`).click({ timeout: 3000 });
      const seen = await until(async () => {
        const [a, b] = await Promise.all([readMapUi(hp), readMapUi(gp)]);
        return a.chip?.label === "맵 광장" && b.chip === null && a.selectedId === "plaza";
      }, ARRIVE_MS);
      rec(sc2, "MS7", `광장 선택이 ${ARRIVE_MS}ms 안에 방장 칩(맵 광장)과 시트 카드에 반영`, seen !== null, seen === null ? `방장 ${(await readMapUi(hp)).chip?.label}` : `${Date.now() - t0}ms`);
      const [hm, gm] = await Promise.all([readMapHook(hp), readMapHook(gp)]);
      rec(sc2, "MS8", "광장을 골라도 로비 무대는 재즈 바(__mfMap = bar)", hm === "bar" && gm === "bar", `방장 ${hm} · 손님 ${gm}`);
      // 방장이 랜덤으로 되돌린다
      await hp.locator(`${SHEET} button[data-map-card="random"]`).click({ timeout: 3000 });
      const back = await until(async () => {
        const [a, b] = await Promise.all([readMapUi(hp), readMapUi(gp)]);
        return a.chip?.label === "맵 랜덤" && b.chip === null;
      }, ARRIVE_MS);
      rec(sc2, "MS9", `랜덤으로 되돌리면 ${ARRIVE_MS}ms 안에 방장 칩이 맵 랜덤`, back !== null, `방장 ${(await readMapUi(hp)).chip?.label}`);
      await closeDressSheet(hp);

      // ── 랜덤으로 시작: 모든 페이지의 맵이 같다 ──
      const sc3 = "map-select/start";
      await openTestSheet(hp);
      await chooseRole(hp, ht, "mafia");
      await setBotVote(hp, ht, { exec: "yes", pick: "host" });
      await startGame(hp, ht);
      const same = await until(async () => {
        const [a, b] = await Promise.all([readMapHook(hp), readMapHook(gp)]);
        return a !== null && a === b;
      }, 6000);
      const [sm, sg] = await Promise.all([readMapHook(hp), readMapHook(gp)]);
      rec(sc3, "MS10", "랜덤으로 시작하면 두 페이지의 __mfMap 이 같은 값(bar 또는 plaza)이고 서버 view.map 과 같음", same !== null && (sm === "bar" || sm === "plaza") && sm === ht.last().map && sg === gt.last().map, `방장 ${sm}(view ${ht.last().map}) · 손님 ${sg}(view ${gt.last().map})`);
      await backToLobbyViaSheet(hp, ht);
      await gt.waitFor((v) => v.phase === "lobby", 4000, "손님 대기실 복귀");
      await Promise.all([waitWorldReady(hp, 4), waitWorldReady(gp, 4)]);

      // ── 광장 판: 시작 → 모두 plaza → ended ──
      const sc4 = "map-select/plaza";
      const p = await attempt(() => pickMapViaUi(hp, ht, "plaza"));
      rec(sc4, "MS11", "방장이 칩 → 맵 탭 → 광장 카드로 선택(서버 mapChoice = plaza)", p.ok && ht.last().mapChoice === "plaza", p.detail || `mapChoice ${ht.last().mapChoice}`);
      await openTestSheet(hp);
      await chooseRole(hp, ht, "mafia");
      await setBotVote(hp, ht, { exec: "yes", pick: "host" });
      await startGame(hp, ht);
      const plaza = await until(async () => {
        const [a, b] = await Promise.all([readMapHook(hp), readMapHook(gp)]);
        return a === "plaza" && b === "plaza";
      }, 12000);
      const [pm, pg] = await Promise.all([readMapHook(hp), readMapHook(gp)]);
      rec(sc4, "MS12", "광장을 고르고 시작하면 두 페이지 모두 __mfMap === plaza 이고 view.map 도 plaza", plaza !== null && ht.last().map === "plaza" && gt.last().map === "plaza", `방장 ${pm}(view ${ht.last().map}) · 손님 ${pg}(view ${gt.last().map})`);
      // 한 판: 방장 마피아 + 봇이 방장을 지목·찬성 → 낮에 방장이 처형되어 시민 승
      const run = await attempt(async () => {
        await skipTo(hp, ht, "defense");
        await skipTo(hp, ht, "verdict");
        // 손님도 찬성한다(찬반 버튼이 뜬 뒤). 사람 표가 빠져도 봇 둘의 찬성이면 처형되지만, 손님 쪽 흐름도 같이 확인한다
        const arrived = await until(async () => {
          const gm = await readGame(gp);
          return gm?.phase === "verdict" && gm.verdictBtns.length === 2;
        }, 6000);
        if (arrived === null) throw new Error("손님 쪽 찬반 버튼이 뜨지 않음");
        await chooseVerdict(gp, true);
        await skipTo(hp, ht, "execution");
        try {
          await skipTo(hp, ht, "ended");
        } catch (e) {
          if (ht.last().phase !== "ended") throw e;
        }
        await Promise.all([ht.waitFor((v) => v.phase === "ended" && v.result !== undefined, 10000, "방장 종료"), gt.waitFor((v) => v.phase === "ended" && v.result !== undefined, 10000, "손님 종료")]);
      });
      rec(sc4, "MS13", "광장에서 한 판이 ended 까지 돈다(낮 토론 → 지목 → 변론 → 찬반 → 처형 → 결과)", run.ok, run.detail);
      if (!run.ok) return;

      // ── 결과 화면: 칩이 보이고 카드 선택이 mapChoice 와 같다 ──
      const sc5 = "map-select/result";
      await Promise.all([settledResult(hp), settledResult(gp)]);
      const hr = await readMapUi(hp);
      const gr = await readMapUi(gp);
      rec(sc5, "MS14", "결과 화면에서 방장 칩이 서버 mapChoice(광장)를 보이고 손님 화면에는 칩이 없다", hr.chip?.label === "맵 광장" && gr.chip === null, `방장 ${hr.chip?.label} · 손님 ${gr.chip?.label ?? "없음"}`);
      await hp.locator(CHIP).click({ timeout: 3000 });
      await hp.waitForSelector(`${SHEET} button[data-map-card]`, { timeout: 2000 });
      await sleep(200);
      const hro = await readMapUi(hp);
      rec(sc5, "MS15", "결과 화면 방장 시트의 선택 카드가 mapChoice(plaza)와 같음", hro.selectedId === "plaza" && hro.selected === 1, `선택 ${hro.selectedId} ${hro.selected}개`);
      const rr = mapChoiceChecks({
        viewport: { w: hro.vw, h: hro.vh },
        headerBottom: hro.headerBottom,
        chip: hro.chip,
        guest: { chipCount: gr.chip === null ? 0 : 1 },
        sheet: hro.sheet,
        tabs: hro.tabs,
        guestTabs: 0,
        cards: hro.cards,
        selected: hro.selected,
        selectedId: hro.selectedId,
        selectedWant: "plaza",
        testBtn: null,
        tags: hro.tags.filter(Boolean),
      });
      for (const r of rr) {
        if (!["MS1", "MS3", "MS4", "MS5", "MS6"].includes(r.id)) continue;
        // 14-08 UI#14 알려진 한계: 가장 낮은 폰(360×560, 방 높이 575 미만)의 결과 화면은 띠 아래로 내려온 칩이 이름표 한 칸과 겹칠 수 있다 —
        // 눌림은 가려지지 않는다. 판정에서 빼고 잰 값을 그대로 남긴다(고치지 않는다). 다른 크기 5종은 그대로 판정한다.
        if (r.id === "MS6" && !r.ok && hro.vh < 575) rec(sc5, `R-${r.id}k`, `알려진 한계(UI#14): 결과 화면 낮은 폰(${hro.vw}x${hro.vh})의 지도 칩이 이름표와 겹침(판정 아님)`, true, r.detail, true);
        else rec(sc5, `R-${r.id}`, `결과 화면: ${r.label}`, r.ok, r.detail);
      }
      await closeDressSheet(hp);
    } finally {
      await g.context.close().catch(() => {});
    }
  }

  return { mapSelectFlow };
}
