// 22페이즈 새 낮 흐름 E2E 흐름 둘(22-13, D-24, UI-SPEC "E2E 표식과 판정 초안" P22-2·5·6·7·8): vote-count(찬반 숫자 번복)와 will-flow(유언 조기·시간 초과·빈 글·잠금·폰 6종 시트 기하).
// 판정 문턱은 이 파일의 순수 함수(voteCountChecks·willCarryChecks·willLockChecks·willRevealChecks·willSheetChecks)에만 있고 day.test.mjs 가 단위 시험한다. 흐름 본문은 얇게 읽고 부른다.
// flows.mjs 가 이미 3천 8백 줄이라 흐름은 이 파일에 둔다(avatar.mjs·sound.mjs 와 같은 모양 — helpers 를 받고 서로 import 하지 않는다).
// helpers: { recorder, attempt, openGame, closeGame, allAt, untilGame, gameGH, GAME_HOST_NICK }.
import { chooseVerdict, installFakeViewport, readGame, settle, skipTo, sleep } from "./browser.mjs";
import { DISCUSSION_LOG_H, OVERLAP_EPS, TAP_MIN } from "./lib.mjs";

const isNum = (x) => typeof x === "number" && Number.isFinite(x);
const result = (id, label, bad) => ({ id, label, ok: bad.length === 0, detail: bad.length === 0 ? "" : bad.join("; ") });
const noMeasure = (id, label, what) => result(id, label, [`측정값 없음(${what})`]);
const LOCKED_DOCK_HEIGHT = DISCUSSION_LOG_H + 64;
const fmt = (n) => Math.round(n * 10) / 10;
const rectOk = (r) => r && [r.left, r.top, r.right, r.bottom, r.width, r.height].every(isNum);
const overlaps = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > OVERLAP_EPS && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > OVERLAP_EPS;

/** 유언 카드가 모두의 화면에 보이는 시간(ms, 22-12 WILL_REVEAL_MS 의 사본 — test/unit/e2eContract.test.ts 가 대조한다)과 시간 오차 */
export const WILL_REVEAL_MS_COPY = 3000;
export const WILL_REVEAL_TOL_MS = 600;
/** 시트가 비어 있을 때 카드에 쓰는 글(UI-SPEC P22-6) */
export const EMPTY_WILL_CARD_TEXT = "말없이 떠났어요";

// ---- 순수 판정 ----

/**
 * 찬반 숫자 줄 판정(VC1~VC4, P22-2). pages = [{ who, counts({yes,no}|null), nameTexts(숫자 줄 안 이름 글 수), doneMarks([data-done] 수), recordMarks(찬반 기록 표식 수), buttons(찬반 단추 수), wantButtons(0|2) }],
 * want = { yes, no } (모든 페이지가 같은 숫자여야 한다).
 * VC1 모든 페이지의 두 덩이 숫자가 want 와 같다 · VC2 찬반 단추 수가 기대(투표자 2·유령 0)와 같다 ·
 * VC3 숫자 줄에 후보 이름 글이 없다 · VC4 개인 표 표식(data-done·기록 표식)이 0건이다.
 */
export function voteCountChecks(pages, want) {
  const labels = {
    VC1: `숫자 줄이 모든 페이지에서 찬성 ${want?.yes} · 반대 ${want?.no} 으로 같다`,
    VC2: "찬반 두 단추는 투표자에게만 있다(유령은 숫자 줄만)",
    VC3: "후보 이름 글이 숫자 줄 어디에도 없다",
    VC4: "개인 표 표식(data-done·기록 표식)이 0건이다",
  };
  if (!Array.isArray(pages) || pages.length === 0 || !want || !isNum(want.yes) || !isNum(want.no)) return Object.entries(labels).map(([id, l]) => noMeasure(id, l, "pages·want"));
  const bad1 = [];
  const bad2 = [];
  const bad3 = [];
  const bad4 = [];
  for (const p of pages) {
    if (!p.counts || p.counts.yes !== want.yes || p.counts.no !== want.no) bad1.push(`${p.who} ${p.counts ? `${p.counts.yes}/${p.counts.no}` : "숫자 줄 없음"}`);
    if (p.buttons !== p.wantButtons) bad2.push(`${p.who} 단추 ${p.buttons}개(기대 ${p.wantButtons})`);
    if (p.nameTexts > 0) bad3.push(`${p.who} 이름 글 ${p.nameTexts}개`);
    if (p.doneMarks > 0 || p.recordMarks > 0) bad4.push(`${p.who} data-done ${p.doneMarks} · 기록 표식 ${p.recordMarks}`);
  }
  return [result("VC1", labels.VC1, bad1), result("VC2", labels.VC2, bad2), result("VC3", labels.VC3, bad3), result("VC4", labels.VC4, bad4)];
}

/**
 * 유언 단계 처형자 화면 판정(WF1·WF2, P22-5). m = { sheets([data-will-sheet=will] 수), value(글칸 글), wantValue(미리 써 둔 글) }.
 * WF1 유언 시트가 하나 자동으로 열려 있다 · WF2 글칸에 미리 써 둔 글이 채워져 있다.
 */
export function willCarryChecks(m) {
  const labels = { WF1: "유언 단계에 처형자 시트가 하나 자동으로 열려 있다", WF2: "글칸에 미리 써 둔 유언이 채워져 있다" };
  if (!m || !isNum(m.sheets)) return Object.entries(labels).map(([id, l]) => noMeasure(id, l, "sheets"));
  return [
    result("WF1", labels.WF1, m.sheets === 1 ? [] : [`시트 ${m.sheets}개`]),
    result("WF2", labels.WF2, typeof m.value === "string" && m.value === m.wantValue ? [] : [`글칸 "${m.value}" (기대 "${m.wantValue}")`]),
  ];
}

/**
 * 유언 단계 나머지 사람 화면 판정(WF5, P22-7). pages = [{ who, sheets, locked([data-chat-locked] 수), panelH, pinSeat(__mfPin.seat) }], condemned = 처형자 좌석, panelWant = 공용 기록과 입력 높이.
 * 시트 0개 · 채팅 잠금 1개 · 패널 높이 156(±1) · 스포트라이트(__mfPin.seat)가 처형자.
 */
export function willLockChecks(pages, { condemned, panelWant = LOCKED_DOCK_HEIGHT }) {
  const label = "나머지 사람: 시트 0개 · 채팅 잠금 · 고정 패널 · 스포트라이트가 처형자";
  if (!Array.isArray(pages) || pages.length === 0 || !isNum(condemned)) return [noMeasure("WF5", label, "pages·condemned")];
  const bad = [];
  for (const p of pages) {
    if (p.sheets !== 0) bad.push(`${p.who} 시트 ${p.sheets}개`);
    if (p.locked !== 1) bad.push(`${p.who} 잠금 ${p.locked}개`);
    if (!isNum(p.panelH) || Math.abs(p.panelH - panelWant) > 1) bad.push(`${p.who} 패널 ${p.panelH}(기대 ${panelWant})`);
    if (p.pinSeat !== condemned) bad.push(`${p.who} 핀 좌석 ${p.pinSeat}(기대 ${condemned})`);
  }
  return [result("WF5", label, bad)];
}

/**
 * 유언 공개 카드 판정(WF3, P22-5·6). pages = [{ who, texts(보인 카드 글 목록 — 중복 없이), visibleMs(처음~마지막으로 보인 시간) }], want = 카드 글.
 * 모든 페이지가 같은 글 하나를 보고 3.0초(±0.6) 동안 보인다.
 */
export function willRevealChecks(pages, want, { holdMs = WILL_REVEAL_MS_COPY, tolMs = WILL_REVEAL_TOL_MS } = {}) {
  const label = `모든 페이지에 유언 카드가 같은 글("${want}")로 ${holdMs / 1000}초(±${tolMs / 1000}) 보인다`;
  if (!Array.isArray(pages) || pages.length === 0 || typeof want !== "string") return [noMeasure("WF3", label, "pages·want")];
  const bad = [];
  for (const p of pages) {
    if (!Array.isArray(p.texts) || p.texts.length !== 1 || p.texts[0] !== want) bad.push(`${p.who} 글 ${JSON.stringify(p.texts)}`);
    else if (!isNum(p.visibleMs) || Math.abs(p.visibleMs - holdMs) > tolMs) bad.push(`${p.who} 보인 시간 ${isNum(p.visibleMs) ? Math.round(p.visibleMs) : "?"}ms`);
  }
  return [result("WF3", label, bad)];
}

/**
 * 폰별 유언 시트 기하 판정(WF-G1~WF-G4, P22-8). m = { vw, vh(보이는 영역 높이: 키보드 올림이면 vh − K), sheet, save, close, area } (각 { left, top, right, bottom, width, height }), kb = 키보드를 올렸는가.
 * G1 시트 윗변 ≥ 0 이고 시트가 보이는 영역 안(아랫변 ≤ vh) · G2 [남기기]·[닫기]·글칸이 서로 겹치지 않는다 · G3 [남기기]·[닫기] 높이 ≥ 44, [닫기] 너비 ≥ 44 · G4 [남기기]가 보이는 영역 안.
 */
export function willSheetChecks(m, { kb = false } = {}) {
  const where = kb ? "(키보드 올림)" : "(키보드 닫힘)";
  const labels = {
    "WF-G1": `시트가 화면 안이다: 윗변 ≥ 0, 아랫변 ≤ 보이는 높이 ${where}`,
    "WF-G2": `[남기기]·[닫기]·글칸이 서로 가려지지 않는다 ${where}`,
    "WF-G3": `[남기기]·[닫기]가 누르기 44 이상이다 ${where}`,
    "WF-G4": `[남기기]가 보이는 영역 안에 있다 ${where}`,
  };
  const parts = m && rectOk(m.sheet) && rectOk(m.save) && rectOk(m.close) && rectOk(m.area) && isNum(m.vw) && isNum(m.vh);
  if (!parts) return Object.entries(labels).map(([id, l]) => noMeasure(id, l, "sheet·save·close·area"));
  const { sheet, save, close, area } = m;
  const bad1 = [];
  if (sheet.top < -OVERLAP_EPS) bad1.push(`윗변 ${fmt(sheet.top)}`);
  if (sheet.bottom > m.vh + OVERLAP_EPS) bad1.push(`아랫변 ${fmt(sheet.bottom)} > ${fmt(m.vh)}`);
  const bad2 = [];
  for (const [a, b, na, nb] of [[save, close, "[남기기]", "[닫기]"], [save, area, "[남기기]", "글칸"], [close, area, "[닫기]", "글칸"]]) if (overlaps(a, b)) bad2.push(`${na}·${nb} 겹침`);
  const bad3 = [];
  if (save.height + OVERLAP_EPS < TAP_MIN) bad3.push(`[남기기] 높이 ${fmt(save.height)}`);
  if (close.height + OVERLAP_EPS < TAP_MIN || close.width + OVERLAP_EPS < TAP_MIN) bad3.push(`[닫기] ${fmt(close.width)}x${fmt(close.height)}`);
  const bad4 = [];
  if (save.top < -OVERLAP_EPS || save.bottom > m.vh + OVERLAP_EPS || save.left < -OVERLAP_EPS || save.right > m.vw + OVERLAP_EPS) bad4.push(`[남기기] ${fmt(save.left)},${fmt(save.top)} ~ ${fmt(save.right)},${fmt(save.bottom)} (보이는 영역 ${fmt(m.vw)}x${fmt(m.vh)})`);
  return [result("WF-G1", labels["WF-G1"], bad1), result("WF-G2", labels["WF-G2"], bad2), result("WF-G3", labels["WF-G3"], bad3), result("WF-G4", labels["WF-G4"], bad4)];
}

// ---- 읽기 ----

/** 숫자 줄·찬반 단추·표식 읽기(한 evaluate) */
function readVoteCount(page) {
  return page.evaluate(() => {
    const items = [...document.querySelectorAll("[data-verdict-count]")];
    const counts = items.length === 2 ? Object.fromEntries(items.map((el) => [el.getAttribute("data-verdict-count"), Number((el.querySelector(".mv-count")?.textContent ?? "").trim())])) : null;
    const row = document.querySelector("[data-verdict-count-row]");
    return {
      counts,
      nameTexts: row ? [...row.querySelectorAll("*")].filter((el) => el.children.length === 0 && /님|[가-힣A-Za-z]{2,}/.test((el.textContent ?? "").replace(/\d/g, ""))).length : 0,
      doneMarks: document.querySelectorAll("[data-done]").length,
      recordMarks: document.querySelectorAll("[data-ballots], [data-ballot-side], [data-ballot-seat], [data-card=\"ballots\"]").length,
      buttons: document.querySelectorAll("[data-verdict]").length,
    };
  });
}

/** 유언 시트 사각형 읽기 */
function readWillSheet(page) {
  return page.evaluate(() => {
    const root = document.querySelector('[data-will-sheet="will"]');
    if (!root) return null;
    const rectOf = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    };
    const vv = window.visualViewport;
    return {
      vw: window.innerWidth,
      vh: vv ? vv.height : window.innerHeight,
      sheet: rectOf(root),
      save: rectOf(root.querySelector("[data-will-save]")),
      close: rectOf(root.querySelector(".mv-will__close")),
      area: rectOf(root.querySelector("textarea")),
      value: root.querySelector("textarea")?.value ?? null,
    };
  });
}

/** 카드가 보이는 동안의 글·시간을 한 페이지에서 기록한다(40ms 마다). 돌려주는 함수를 부르면 멈추고 { texts, visibleMs } 를 준다 */
async function watchWillReveal(page) {
  await page.evaluate(() => {
    window.__willWatch?.stop?.();
    const st = { texts: [], first: null, last: null, on: true };
    const loop = () => {
      if (!st.on) return;
      const el = document.querySelector("[data-will-reveal]");
      if (el) {
        const now = performance.now();
        const text = (el.textContent ?? "").trim();
        if (!st.texts.includes(text)) st.texts.push(text);
        if (st.first === null) st.first = now;
        st.last = now;
      }
      setTimeout(loop, 40);
    };
    loop();
    window.__willWatch = { stop: () => (st.on = false), read: () => ({ texts: [...st.texts], visibleMs: st.first === null ? null : st.last - st.first }) };
  });
  return async () => {
    const out = await page.evaluate(() => {
      const w = window.__willWatch;
      w?.stop();
      return w ? w.read() : { texts: [], visibleMs: null };
    });
    return out;
  };
}

// ---- 흐름 ----

export function makeDayFlows({ recorder, attempt, openGame, closeGame, allAt, untilGame, gameGH, GAME_HOST_NICK }) {
  const WILL_PRE = "미리 써 둔 유언이에요";
  const WILL_EDIT = "고쳐서 남겨요";
  const WILL_TYPED = "쓰다가 시간이 끝났어요";

  /** 토론에서 방장이 [유언](깃펜)으로 미리 유언을 써 저장한다 — 시트가 열리고 [저장] 을 눌러 닫힌다 */
  async function writeWillEarly(hp, text) {
    await hp.locator("[data-will-button]").first().click({ timeout: 4000 });
    const area = hp.locator('[data-will-sheet="will"] textarea');
    await area.waitFor({ timeout: 4000 });
    await area.fill(text);
    await hp.locator("[data-will-save]").click({ timeout: 4000 });
    await hp.waitForSelector('[data-will-sheet="will"]', { state: "detached", timeout: 4000 });
  }

  /** 낮 토론 → 찬반(손님 찬성) → 지목(봇이 방장) → 유언 단계까지 당긴다. 방장이 처형자다 */
  async function toWill(game) {
    const { hp, ht, guests } = game;
    await skipTo(hp, ht, "verdict");
    for (const g of guests) {
      await untilGame(g.page, (x) => x.phase === "verdict" && x.verdictBtns.length === 2, 6000, "찬반 도착");
      await chooseVerdict(g.page, true).catch(() => {});
    }
    await skipTo(hp, ht, "nomination");
    await skipTo(hp, ht, "defense");
    await allAt([hp, ...guests.map((g) => g.page)], "defense");
  }

  const OPEN3 = { guests: 1, bots: 2, role: "citizen", vote: { exec: "yes", pick: "host" }, to: "discussion", hostNick: GAME_HOST_NICK };

  // ---- vote-count: 찬반 숫자 줄이 실시간으로 바뀌고 마감 전 번복된다 (P22-2) ----
  async function voteCountFlow(ctx) {
    const id = "vote-count";
    const rec = recorder(ctx);
    // 사람 셋(방장 + 손님 둘) + 봇 하나 — 봇은 [찬성] 고정이라 숫자 기준이 하나 올라간 채 시작한다
    const game = await openGame(ctx, id, { guests: 2, bots: 1, role: "citizen", vote: { exec: "yes", pick: "host" }, to: "discussion", hostNick: GAME_HOST_NICK });
    try {
      const { hp, ht, guests } = game;
      const [ga, gb] = guests;
      const humans = [{ who: "방장", page: hp }, { who: "손님1", page: ga.page }, { who: "손님2", page: gb.page }];
      await skipTo(hp, ht, "verdict");
      await allAt(humans.map((x) => x.page), "verdict");
      await Promise.all(humans.map((x) => settle(x.page)));
      const readAll = async (wantButtons = 2) => Promise.all(humans.map(async (x) => ({ who: x.who, wantButtons, ...(await readVoteCount(x.page)) })));
      const sameCounts = async (want, label) => {
        const r = await attempt(async () => {
          for (const x of humans) await untilGame(x.page, (g) => g.verdictCounts?.yes === want.yes && g.verdictCounts?.no === want.no, 5000, `${label} ${want.yes}/${want.no}`);
        });
        return r;
      };
      // 봇 한 표(찬성)가 1~6초 안에 들어온다 — 그 뒤를 기준(base)으로 삼는다
      const base = await attempt(async () => {
        for (const x of humans) await untilGame(x.page, (g) => g.verdictCounts?.yes === 1 && g.verdictCounts?.no === 0, 8000, "봇 찬성 한 표");
      });
      rec(`${id}/base`, "VC0", "봇의 [찬성] 한 표가 모든 페이지의 숫자 줄에 같이 들어온다(찬성 1 · 반대 0)", base.ok, base.detail);
      if (!base.ok) return;
      // A(방장) 찬성 → 2/0
      await chooseVerdict(hp, true);
      const s1 = await sameCounts({ yes: 2, no: 0 }, "방장 찬성");
      rec(`${id}/yes`, "VC5", "방장이 [찬성]을 누르면 모든 페이지가 찬성 2 · 반대 0 으로 바뀐다", s1.ok, s1.detail);
      recLines(rec, `${id}/yes`, voteCountChecks(await readAll(), { yes: 2, no: 0 }));
      // 마감 전 번복: 방장 [반대] → 1/1
      const flipStart = performance.now();
      await chooseVerdict(hp, false);
      const s2 = await sameCounts({ yes: 1, no: 1 }, "방장 번복");
      rec(`${id}/flip`, "VC6", "마감 전에 방장이 [반대]로 바꾸면 모든 페이지가 찬성 1 · 반대 1 로 바뀐다(번복)", s2.ok && ht.last().phase === "verdict", s2.ok ? `${Math.round(performance.now() - flipStart)}ms` : s2.detail);
      recLines(rec, `${id}/flip`, voteCountChecks(await readAll(), { yes: 1, no: 1 }));
      // 같은 단추를 다시 눌러도 변화가 없다
      await sleep(400); // 같은 사람의 연타 방어 간격
      await chooseVerdict(hp, false).catch(() => {});
      await sleep(600);
      const stay = await attempt(async () => {
        for (const x of humans) await untilGame(x.page, (g) => g.verdictCounts?.yes === 1 && g.verdictCounts?.no === 1, 3000, "같은 단추 재클릭 뒤");
      });
      rec(`${id}/same`, "VC7", "같은 [반대]를 다시 눌러도 숫자가 그대로다(찬성 1 · 반대 1)", stay.ok, stay.detail);
      // 손님 둘이 반대 → 1/3
      await chooseVerdict(ga.page, false);
      await chooseVerdict(gb.page, false);
      const s3 = await sameCounts({ yes: 1, no: 3 }, "손님 둘 반대");
      rec(`${id}/no`, "VC8", "손님 둘이 [반대]를 누르면 모든 페이지가 찬성 1 · 반대 3 이다", s3.ok, s3.detail);
      recLines(rec, `${id}/no`, voteCountChecks(await readAll(), { yes: 1, no: 3 }));
      // 프레임: 숫자뿐 — verdictCount 키가 yes·no 둘이고 던진 좌석 목록(voted)이 없다(D-26)
      const keys = Object.keys(ht.last().day?.verdictCount ?? {}).sort();
      const leaked = ht.last().day?.voted !== undefined;
      rec(`${id}/frame`, "VC9", "view 의 찬반 값은 집계 수 둘(yes·no)뿐이고 던진 좌석 목록(day.voted)이 없다", keys.join(",") === "no,yes" && !leaked, `키 ${keys.join(",")} · voted ${leaked ? "있음" : "없음"}`);
      await gameGH(ctx, id, "verdict", game.host);
    } finally {
      await closeGame(game);
    }
  }

  const recLines = (rec, sc, lines, suffix = "") => {
    for (const l of lines) rec(sc, l.id, `${l.label}${suffix}`, l.ok, l.detail);
  };

  /** 처형 진입 뒤 모든 페이지의 카드 기록을 모아 판정한다 */
  async function collectReveal(pages, stops, want, rec, sc, label) {
    // 카드(3.0초) + 큰 글 3.0초가 지난 뒤까지 둔다
    await sleep(WILL_REVEAL_MS_COPY + 800);
    const reads = [];
    for (let i = 0; i < pages.length; i++) reads.push({ who: pages[i].who, ...(await stops[i]()) });
    recLines(rec, sc, willRevealChecks(reads, want), ` (${label})`);
  }

  // ---- will-flow: 처형자 시트 자동 열림·조기 [남기기]·시간 초과·빈 글·잠금 (P22-5·6·7, 390x844) ----
  async function willFlow(ctx) {
    const id = "will-flow";
    const rec = recorder(ctx);
    const h = ctx.size.h;

    // (a) 미리 써 둔 글이 채워진 채 시트가 자동으로 열리고, 고쳐 [남기기] → 곧바로 처형, 모두에게 카드 3.0초
    {
      const sc = `${id}/early`;
      const game = await openGame(ctx, id, OPEN3);
      try {
        const { hp, ht, hostSeat, guests } = game;
        const [g] = guests;
        const pages = [{ who: "방장", page: hp }, { who: "손님", page: g.page }];
        const pre = await attempt(async () => {
          await writeWillEarly(hp, WILL_PRE);
        });
        rec(sc, "WF0", "토론에서 [유언] 깃펜으로 미리 유언을 써 저장한다", pre.ok, pre.detail);
        if (!pre.ok) return;
        await toWill(game);
        await Promise.all(pages.map((p) => settle(p.page)));
        const gh = await readGame(hp);
        const sheet = await readWillSheet(hp);
        recLines(rec, sc, willCarryChecks({ sheets: gh.willSheets, value: sheet?.value ?? null, wantValue: WILL_PRE }));
        // 나머지 사람 화면(P22-7)
        const gg = await readGame(g.page);
        const pin = await g.page.evaluate(() => window.__mfPin?.seat ?? null);
        recLines(rec, sc, willLockChecks([{ who: "손님", sheets: gg.willSheets, locked: gg.chatLockedCount, panelH: gg.panel?.height, pinSeat: pin }], { condemned: hostSeat }));
        rec(sc, "WF5h", `나머지 사람 패널 높이는 방 높이 ${h} 와 상관없이 ${LOCKED_DOCK_HEIGHT} 이다`, Math.abs((gg.panel?.height ?? 0) - LOCKED_DOCK_HEIGHT) <= 1, `패널 ${gg.panel?.height}`);
        // 고쳐 [남기기] → 곧바로 처형 단계
        const stops = await Promise.all(pages.map((p) => watchWillReveal(p.page)));
        const t0 = performance.now();
        const saved = await attempt(async () => {
          await hp.locator('[data-will-sheet="will"] textarea').fill(WILL_EDIT);
          await hp.locator("[data-will-save]").click({ timeout: 4000 });
          await ht.waitFor((v) => v.phase === "execution", 1500, "[남기기] → 처형");
        });
        rec(sc, "WF4", "글을 고쳐 [남기기]를 누르면 1초 안에 처형 단계로 넘어간다", saved.ok, saved.ok ? `${Math.round(performance.now() - t0)}ms` : saved.detail);
        await collectReveal(pages, stops, WILL_EDIT, rec, sc, "조기 [남기기]");
      } finally {
        await closeGame(game);
      }
    }

    // (b) 시간 초과: 쓰던 글이 자동으로 나간다
    {
      const sc = `${id}/timeout`;
      const game = await openGame(ctx, id, OPEN3);
      try {
        const { hp, ht, guests } = game;
        const [g] = guests;
        const pages = [{ who: "방장", page: hp }, { who: "손님", page: g.page }];
        await toWill(game);
        await settle(hp);
        const stops = await Promise.all(pages.map((p) => watchWillReveal(p.page)));
        const typed = await attempt(async () => {
          await hp.locator('[data-will-sheet="will"] textarea').fill(WILL_TYPED);
        });
        rec(sc, "WF6w", "시트 글칸에 글을 쓰고 [남기기]는 누르지 않는다", typed.ok, typed.detail);
        const toExec = await attempt(async () => {
          await ht.waitFor((v) => v.phase === "execution", 14_000, "유언 시간 초과 → 처형");
        });
        rec(sc, "WF6", "시간이 끝나면 쓰던 글이 나가고 처형 단계가 된다", toExec.ok, toExec.detail);
        await collectReveal(pages, stops, WILL_TYPED, rec, sc, "시간 초과");
      } finally {
        await closeGame(game);
      }
    }

    // (c) 빈 글: "말없이 떠났어요" 카드
    {
      const sc = `${id}/empty`;
      const game = await openGame(ctx, id, OPEN3);
      try {
        const { hp, ht, guests } = game;
        const [g] = guests;
        const pages = [{ who: "방장", page: hp }, { who: "손님", page: g.page }];
        await toWill(game);
        await settle(hp);
        const stops = await Promise.all(pages.map((p) => watchWillReveal(p.page)));
        const saved = await attempt(async () => {
          const value = await hp.locator('[data-will-sheet="will"] textarea').inputValue();
          if (value !== "") throw new Error(`글칸이 비어 있지 않음 "${value}"`);
          await hp.locator("[data-will-save]").click({ timeout: 4000 });
          await ht.waitFor((v) => v.phase === "execution", 1500, "빈 [남기기] → 처형");
        });
        rec(sc, "WF7", "빈 글로 [남기기]를 눌러도 처형 단계로 넘어간다", saved.ok, saved.detail);
        await collectReveal(pages, stops, EMPTY_WILL_CARD_TEXT, rec, sc, "빈 글");
      } finally {
        await closeGame(game);
      }
    }
  }

  // ---- will-flow-sizes: 폰별 처형자 시트 기하와 키보드 올림 K 336 (P22-8) ----
  async function willSizesFlow(ctx) {
    const id = "will-flow-sizes";
    const rec = recorder(ctx);
    const K = 336;
    const game = await openGame(ctx, id, { guests: 0, bots: 3, role: "citizen", vote: { exec: "yes", pick: "host" }, to: "discussion", hostNick: GAME_HOST_NICK, hostInitScripts: [installFakeViewport] });
    try {
      const { hp, ht } = game;
      await toWill(game);
      await settle(hp);
      const sc = `${id}/sheet`;
      const closed = await readWillSheet(hp);
      recLines(rec, sc, willSheetChecks(closed, { kb: false }), ` (${ctx.size.label})`);
      // 키보드를 올린다(visualViewport 높이 − K): 글칸 포커스 + 가짜 키보드. 앱이 compact(2줄)로 줄고 시트가 키보드 위로 오른다
      await hp.locator('[data-will-sheet="will"] textarea').focus();
      await hp.evaluate((k) => window.__mfVv.set(window.innerHeight - k, 0), K);
      await sleep(700);
      const open = await readWillSheet(hp);
      recLines(rec, sc, willSheetChecks(open, { kb: true }), ` (${ctx.size.label}, K ${K})`);
      rec(sc, "WF-G5", `키보드를 올려도 단계가 그대로 유언이다(시트가 접히지 않는다)`, ht.last().phase === "defense" && open !== null, `단계 ${ht.last().phase}`);
      await hp.evaluate(() => window.__mfVv.set(window.innerHeight, 0));
    } finally {
      await closeGame(game);
    }
  }

  return { voteCountFlow, willFlow, willSizesFlow };
}
