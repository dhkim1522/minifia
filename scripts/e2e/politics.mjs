// 정치 긴장 화면 E2E 흐름 (09.1.1-10·11·13, 결정 0066, UI-SPEC 흐름 E2E ①②③⑥): politics-badge(직업 배지)·politics-whisper(귓속말)·politics-pin(지목 차례 핀 조명)·politics-verdict(판결 순간).
// flows.mjs 가 이미 3천 줄이라 흐름 본문은 이 파일에 둔다. flows.mjs 의 도우미는 `makePoliticsFlows(helpers)` 로 받는다(서로 import 하지 않는다 — 순환 없음).
// 두 흐름 모두 폰 6종(LOBBY_EXTRA_SIZES)으로 돈다. 방장 화면과 손님 화면 둘을 함께 본다.
// 판정 문턱은 lib.mjs 의 순수 검사 함수(floatButtonChecks·sheetFitChecks·claimBadgeChecks·pickButtonChecks)에 있고 여기서는 낮추지 않는다.
// 귓속말 본문(canary)은 결과 표와 오류 문구에 쓰지 않는다 — 있는지 없는지(불리언)만 남긴다(T-09.1.1-28).
import { hitsInputSurface, installFakeViewport, readGame, sampleWorld, screensOfWorld, SetupError, settle, skipTo, sleep, tapTurnPick, tapWorld } from "./browser.mjs";
import { ballotFitChecks, claimBadgeChecks, floatButtonChecks, graphemeCount, pickButtonChecks, sheetFitChecks, verdictTimelineChecks } from "./lib.mjs";

/** 31자소 본문: 입력칸이 30자소로 자르는지 본다. 앞 30자소가 실제로 서버에 가는 본문(canary)이다 */
const LONG_31 = "귓속말카나리아본문은제삼자에게보이면안돼요가나다라마바사아자차";
const SENT_30 = Array.from(LONG_31).slice(0, 30).join("");
/** 손님1 → 손님2 두 번째 귓속말 본문(작은 폰의 가상 키보드 줄) */
const SECOND = "두번째카나리아본문";
if (graphemeCount(LONG_31) !== 31 || graphemeCount(SENT_30) !== 30) throw new Error("politics.mjs: 본문 상수의 자소 수가 31/30 이 아님");

/** 가상 키보드 높이(chat-keyboard 흐름과 같은 값: UI-SPEC 폰 크기 표의 K) */
const KB_LIFT = 336;
/** 말 바꿈 알약이 떠 있는 시간(앱 BADGE_NOTICE_MS 2400 + 페이드 180)과 허용 오차 */
const NOTICE_MS = 2400;
const NOTICE_FADE_MS = 180;
const NOTICE_TOL_MS = 600;
const CLAIM_ORDER_4 = ["citizen", "police", "mafia", "none"];
const CLAIM_NAMES_4 = ["시민", "경찰", "마피아", "말 안 함"];

/**
 * 한 페이지의 배지·귓속말 화면 상태를 한 번에 읽는다. canary 를 주면 그 글이 페이지 어디(HTML·화면 글·입력칸)에 있는지 불리언으로 돌려준다(글 자체는 돌려주지 않는다).
 */
function readPolitics(page, canary = "") {
  return page.evaluate((canaryText) => {
    const q = (s, r = document) => r.querySelector(s);
    const qa = (s, r = document) => [...r.querySelectorAll(s)];
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
    };
    const fontMin = (root) => {
      if (!root) return null;
      const sizes = [];
      for (const el of [root, ...qa("*", root)]) {
        const own = [...el.childNodes].some((c) => c.nodeType === 3 && (c.textContent ?? "").trim() !== "");
        if (own || el.tagName === "INPUT") sizes.push(parseFloat(getComputedStyle(el).fontSize));
      }
      return sizes.length > 0 ? Math.min(...sizes) : null;
    };
    const stage = q("[data-game-stage]");
    const panel = q("[data-world-panel]");
    const header = q(".mf-game__header");
    const layer = q("[data-sheet-layer]");
    const vv = window.visualViewport;
    const floats = qa("[data-float]").map((b) => ({
      kind: b.getAttribute("data-float"),
      rect: rect(b),
      label: b.getAttribute("aria-label") ?? "",
      disabled: b.getAttribute("aria-disabled") === "true",
      pressed: b.getAttribute("aria-pressed") === "true",
      dot: q(".mv-float__dot", b) !== null,
      left: b.getAttribute("data-float-left"),
      opacity: parseFloat(getComputedStyle(b).opacity),
    }));
    const cs = q("[data-claim-sheet]");
    const chips = cs ? qa("[data-claim-chip]", cs) : [];
    const closeBtn = cs ? q(".mv-claim-sheet__close", cs) : null;
    const claimSheet = cs
      ? {
          rect: rect(cs),
          chips: chips.map((c) => ({ id: c.getAttribute("data-claim-chip"), text: (c.textContent ?? "").trim(), rect: rect(c), pressed: c.getAttribute("aria-pressed") === "true" })),
          rows: new Set(chips.map((c) => Math.round(c.getBoundingClientRect().top))).size,
          hint: q(".mv-claim-sheet__hint", cs) ? (q(".mv-claim-sheet__hint", cs).textContent ?? "").trim() : null,
          close: rect(closeBtn),
          fontMin: fontMin(cs),
        }
      : null;
    const ls = q("[data-line-sheet]");
    const input = ls ? q("[data-line-input]", ls) : null;
    const lineSheet = ls
      ? {
          rect: rect(ls),
          peer: (q("[data-line-peer]", ls)?.textContent ?? "").trim(),
          count: (q(".mv-line__count", ls)?.textContent ?? "").trim(),
          value: input ? input.value : "",
          input: rect(input),
          send: rect(q("[data-line-send]", ls)),
          sendDisabled: q("[data-line-send]", ls)?.getAttribute("aria-disabled") === "true",
          close: rect(q("[data-line-close]", ls)),
          focused: input !== null && document.activeElement === input,
          fontMin: fontMin(ls),
        }
      : null;
    const claims = qa("[data-claim]").map((c) => {
      const wrap = c.closest(".mf-world__tag");
      const sw = q(".mv-claim__swap", c);
      return {
        seat: Number(wrap?.getAttribute("data-seat")),
        claim: c.getAttribute("data-claim"),
        changed: c.getAttribute("data-claim-changed") === "true",
        pop: c.classList.contains("is-pop"),
        rect: rect(c),
        icon: rect(q("svg", c)),
        swap: sw ? rect(sw) : null,
        tag: rect(c.closest(".mv-tag")),
        label: c.getAttribute("aria-label") ?? "",
      };
    });
    const tagWidths = {};
    for (const t of qa(".mf-world__tag")) {
      const mv = q(".mv-tag", t);
      if (mv) tagWidths[t.getAttribute("data-seat")] = mv.getBoundingClientRect().width;
    }
    const wl = qa("[data-whisper]");
    const hintEl = q(".mv-phase__hint");
    const canaryInDom =
      canaryText === ""
        ? null
        : document.documentElement.outerHTML.includes(canaryText) || (document.body.innerText ?? "").includes(canaryText) || qa("input,textarea").some((i) => (i.value ?? "").includes(canaryText));
    return {
      phase: stage?.getAttribute("data-phase") ?? "",
      vw: window.innerWidth,
      vh: window.innerHeight,
      vv: { h: vv ? vv.height : window.innerHeight, top: vv ? vv.offsetTop : 0 },
      kbOpen: stage?.getAttribute("data-kb-open") === "true",
      panel: rect(panel),
      header: rect(header),
      veiled: layer?.getAttribute("data-panel-hidden") === "true",
      layerKind: layer?.getAttribute("data-sheet-layer") ?? null,
      floats,
      claimSheet,
      lineSheet,
      claims,
      tagWidths,
      notices: qa(".mv-claim__notice").map((n) => (n.textContent ?? "").trim()),
      roleChips: qa("[data-role-chip]").length,
      hint: hintEl ? { text: (hintEl.textContent ?? "").trim(), folded: hintEl.classList.contains("is-folded") } : null,
      toasts: qa(".mv-toast--top").map((t) => ({ on: t.classList.contains("is-on"), text: (t.textContent ?? "").trim() })),
      live: (q("[data-badge-live]")?.textContent ?? "").trim(),
      whisperPublic: wl.filter((e) => e.getAttribute("data-whisper") === "public").map((e) => (e.textContent ?? "").trim()),
      whisperIn: wl.filter((e) => e.getAttribute("data-whisper") === "in").map((e) => ({ title: (q(".mv-chat__whisper-title", e)?.textContent ?? "").trim(), body: (q(".mv-chat__whisper-text", e)?.textContent ?? "").trim() === canaryText && canaryText !== "" })),
      whisperOut: wl.filter((e) => e.getAttribute("data-whisper") === "out").map((e) => ({ title: (q(".mv-chat__whisper-title", e)?.textContent ?? "").trim(), body: (q(".mv-chat__whisper-text", e)?.textContent ?? "").trim() === canaryText && canaryText !== "" })),
      canaryInDom,
    };
  }, canary);
}

/** 조건이 맞는 읽기가 올 때까지 기다린다. 시간 안에 안 오면 던진다(문구에 본문을 싣지 않는다). */
async function until(page, pred, ms, label, canary = "") {
  const start = performance.now();
  for (;;) {
    const p = await readPolitics(page, canary).catch(() => null);
    if (p && pred(p)) return p;
    if (performance.now() - start > ms) throw new Error(`${label} (${ms / 1000}초 안에 보이지 않음)`);
    await sleep(80);
  }
}

const r1 = (n) => (typeof n === "number" ? Math.round(n * 10) / 10 : n);

export function makePoliticsFlows(h) {
  const { recorder, openGame, closeGame, allAt, attempt, gameGH, walkableCentersOfApp, GAME_HOST_NICK } = h;

  /** 검사 한 줄: fn 이 던지면 실패(이유 한 줄), false 면 실패, 객체 { ok, detail } 면 그대로. 통과 여부를 돌려준다 */
  async function rc(rec, sc, id, label, fn) {
    const r = await attempt(fn);
    rec(sc, id, label, r.ok, r.detail);
    return r.ok;
  }
  const recLines = (rec, sc, lines, suffix = "") => {
    for (const l of lines) rec(sc, l.id, `${l.label}${suffix}`, l.ok, l.detail);
  };
  const nameOf = (view, seat) => view.players.find((p) => p.seat === seat)?.nickname ?? "";


  /**
   * 상대 이름표가 화면(헤더 아래 ~ 패널 위, 떠 있는 버튼 자리 밖)에 통째로 보이는가.
   * 카메라는 내 캐릭터를 따라가므로 낮 토론에서 다른 사람이 화면 밖에 있을 수 있다 — 귓속말 모드의 이름표 누르기는 보이는 사람만 고를 수 있다(UI-SPEC B-1 은 이를 따로 다루지 않는다).
   */
  const tagVisible = (page, seat) =>
    page.evaluate((sx) => {
      const mv = document.querySelector(`.mf-world__tag[data-seat="${sx}"] .mv-tag`);
      const hd = document.querySelector(".mf-game__header");
      const pn = document.querySelector("[data-world-panel]");
      if (!mv || !hd || !pn) return false;
      const r = mv.getBoundingClientRect();
      const hb = hd.getBoundingClientRect().bottom;
      const pt = pn.getBoundingClientRect().top;
      const vw = window.innerWidth;
      const inStage = r.left >= 8 && r.right <= vw - 8 && r.top >= hb + 8 && r.bottom <= pt - 8;
      const underFloat = r.right > vw - 16 - 48 - 4 && r.bottom > pt - 8 - 104 - 4;
      return inStage && !underFloat;
    }, seat);

  /** 내 캐릭터가 멈출 때까지 기다린다(위치가 두 번 연달아 거의 같다). 상한 5초 */
  async function untilStill(page, seat) {
    let prev = null;
    let still = 0;
    const t0 = performance.now();
    while (performance.now() - t0 < 5000) {
      const p = await sampleWorld(page, seat);
      if (prev && p && Math.hypot(p.x - prev.x, p.z - prev.z) < 0.02) {
        if (++still >= 2) return;
      } else still = 0;
      prev = p;
      await sleep(150);
    }
  }

  /**
   * 상대가 화면 안에 보일 때까지 사용자처럼 걸어 다가간다: 화면 안(스테이지, 떠 있는 버튼 자리 밖)의 걸을 수 있는 칸 중 상대와 가장 가까운 칸을 눌러 걷는다. 최대 8걸음.
   * 이미 보이면 걷지 않는다. 걸은 횟수를 돌려준다(보이지 않은 채 끝나면 던진다).
   */
  async function approach(page, tracker, mySeat, targetSeat, size) {
    const centers = walkableCentersOfApp();
    for (let step = 0; step <= 8; step++) {
      if (await tagVisible(page, targetSeat)) return step;
      if (step === 8) break;
      const to = await sampleWorld(page, targetSeat);
      const me = await sampleWorld(page, mySeat);
      if (!to || !me) throw new Error("캐릭터 위치를 읽지 못함(맵 훅)");
      const screens = await screensOfWorld(page, centers);
      const bounds = await page.evaluate(() => ({ hb: document.querySelector(".mf-game__header")?.getBoundingClientRect().bottom ?? 62, pt: document.querySelector("[data-world-panel]")?.getBoundingClientRect().top ?? 600 }));
      const pad = 28;
      const cand = centers
        .map((c, i) => ({ ...c, sx: screens[i]?.sx, sy: screens[i]?.sy }))
        .filter((c) => Number.isFinite(c.sx) && c.sx > pad && c.sx < size.w - pad && c.sy > bounds.hb + pad + 24 && c.sy < bounds.pt - pad && !(c.sx > size.w - 100 && c.sy > bounds.pt - 150));
      const hits = await hitsInputSurface(page, cand);
      const ranked = cand.filter((_, i) => hits[i]).sort((a, b) => Math.hypot(a.x - to.x, a.z - to.z) - Math.hypot(b.x - to.x, b.z - to.z));
      const best = ranked[0];
      if (!best || Math.hypot(best.x - to.x, best.z - to.z) >= Math.hypot(me.x - to.x, me.z - to.z) - 0.2) throw new Error("상대에게 더 다가갈 걸을 수 있는 칸이 없음");
      await tapWorld(page, tracker, mySeat, best.x, best.z);
      await untilStill(page, mySeat);
      await sleep(500); // 카메라가 따라오는 시간
    }
    throw new Error("걸어 다가가도 상대 이름표가 화면에 보이지 않음");
  }

  /** 떠 있는 버튼 묶음 검사(FB1~FB5) 입력을 읽은 값에서 만든다 */
  const floatInput = (p, expectCount) => ({
    buttons: p.floats.map((f) => ({ kind: f.kind, rect: f.rect })),
    panel: p.panel ? { top: p.panel.top } : null,
    viewport: { w: p.vw, h: p.vh },
    kbOpen: p.kbOpen,
    expectCount,
  });

  /** 배지 시트 맞음(SF1~SF6) 입력 */
  const badgeSheetInput = (p) => ({
    kind: "badge",
    sheet: p.claimSheet?.rect,
    header: p.header,
    viewport: { w: p.vw, h: p.vh },
    panel: p.panel,
    targets: [...(p.claimSheet?.chips.map((c) => c.rect) ?? []), ...(p.claimSheet?.close ? [p.claimSheet.close] : [])],
    fontMin: p.claimSheet?.fontMin,
    chipRows: p.claimSheet?.rows,
    hint: p.claimSheet ? p.claimSheet.hint !== null : undefined,
  });

  /** 귓속말 시트 맞음(SF1~SF6) 입력. 키보드가 올라와 패널이 가려졌으면 panel 을 null 로, 보이는 영역(vv)을 화면으로 쓴다 */
  const lineSheetInput = (p, { keyboard = false } = {}) => ({
    kind: "whisper",
    sheet: p.lineSheet?.rect,
    header: p.header,
    viewport: keyboard ? { w: p.vw, h: p.vv.h + p.vv.top } : { w: p.vw, h: p.vh },
    panel: keyboard && p.veiled ? null : p.panel,
    targets: p.lineSheet ? [p.lineSheet.input, p.lineSheet.send, p.lineSheet.close] : [],
    fontMin: p.lineSheet?.fontMin,
  });

  /** 내 배지 칩을 눌러 고른다: 떠 있는 버튼 → 시트 → 칩. 시트가 닫히고(180ms) 버튼이 다시 보일 때까지 기다린다 */
  async function pickClaim(page, id) {
    await page.locator('[data-float="claim"]').click({ timeout: 4000 });
    await until(page, (p) => p.claimSheet !== null, 4000, "배지 시트 열림");
    await page.locator(`[data-claim-chip="${id}"]`).click({ timeout: 4000 });
    await until(page, (p) => p.claimSheet === null, 4000, "배지 시트 닫힘");
  }

  // ---- politics-badge: 떠 있는 버튼 → 칩 → 이름표 배지 → 바꾸면 말 바꿈 → 새로 고침 → 지목 이후 버튼 사라짐 (방장 + 손님 1 + 봇 2 = 4명판) ----
  async function politicsBadgeFlow(ctx) {
    const id = "politics-badge";
    const rec = recorder(ctx);
    const game = await openGame(ctx, id, { guests: 1, bots: 2, role: "citizen", to: "discussion", hostNick: GAME_HOST_NICK });
    try {
      const { hp, ht, hostSeat } = game;
      const g = game.guests[0];
      const gp = g.page;
      const pages = [
        { who: "방장", page: hp },
        { who: "손님", page: gp },
      ];
      await allAt([hp, gp], "discussion");
      for (const p of pages) await settle(p.page);

      // B1 두 화면 모두: 떠 있는 버튼 2개(배지 + 귓속말), 배지 버튼 접근성 이름 "지금 말 안 함", 아직 걸린 배지 없음, 산 사람 DOM 에 role-chip 0건
      {
        const sc = `${id}/float`;
        for (const p of pages) {
          const s = await readPolitics(p.page);
          const claimBtns = s.floats.filter((f) => f.kind === "claim");
          rec(sc, "B1", `배지 버튼이 1개이고 이름에 '지금 말 안 함' (${p.who})`, claimBtns.length === 1 && claimBtns[0].label.includes("지금 말 안 함"), `버튼 ${claimBtns.length}개 · 이름 "${claimBtns[0]?.label ?? ""}"`);
          recLines(rec, sc, floatButtonChecks(floatInput(s, 2)), ` (${p.who})`);
          rec(sc, "B1b", `낮 토론 시작에는 걸린 배지가 없다 (${p.who})`, s.claims.length === 0, `배지 ${s.claims.length}개`);
          rec(sc, "B1c", `산 사람 DOM 에 [data-role-chip] 0건 (L23, ${p.who})`, s.roleChips === 0, `${s.roleChips}건`);
        }
      }

      // B2 방장이 버튼 → 시트: 칩 순서(시민·경찰·마피아·말 안 함 — 4명판은 의사 없음), 시트 맞음, 안내 없음(아직 말 안 함)
      const tagWidth = {};
      {
        const sc = `${id}/sheet`;
        for (const p of pages) tagWidth[p.who] = (await readPolitics(p.page)).tagWidths[hostSeat];
        await hp.locator('[data-float="claim"]').click({ timeout: 4000 });
        await until(hp, (x) => x.claimSheet !== null, 4000, "배지 시트 열림");
        await settle(hp);
        const s2 = await readPolitics(hp);
        const ids = s2.claimSheet.chips.map((c) => c.id);
        const texts = s2.claimSheet.chips.map((c) => c.text);
        rec(sc, "B2", "칩 4개: 시민·경찰·마피아·말 안 함 순서(의사 없음)", JSON.stringify(ids) === JSON.stringify(CLAIM_ORDER_4) && JSON.stringify(texts) === JSON.stringify(CLAIM_NAMES_4), `id ${ids.join(",")} · 글 ${texts.join(",")}`);
        rec(sc, "B2b", "시트가 열리면 배지 버튼이 눌림(aria-pressed)이고 시트에 안내가 없다", s2.floats.find((f) => f.kind === "claim")?.pressed === true && s2.claimSheet.hint === null, `눌림 ${s2.floats.find((f) => f.kind === "claim")?.pressed} · 안내 ${s2.claimSheet.hint}`);
        recLines(rec, sc, sheetFitChecks(badgeSheetInput(s2)), " (방장)");
        await gameGH(ctx, id, "sheet", game.host);
      }

      // B3 칩 "경찰" → 방장·손님 이름표에 [data-claim=police], 배지 기하(CB), role-chip 0건
      {
        const sc = `${id}/claim`;
        await hp.locator('[data-claim-chip="police"]').click({ timeout: 4000 });
        await until(hp, (x) => x.claimSheet === null, 4000, "시트 닫힘");
        for (const p of pages) {
          const ok = await attempt(async () => {
            await until(p.page, (x) => x.claims.some((c) => c.seat === hostSeat && c.claim === "police"), 4000, "방장 이름표에 경찰 배지");
          });
          rec(sc, "B3", `방장 이름표에 [data-claim=police] 가 보인다 (${p.who} 화면)`, ok.ok, ok.detail);
        }
        await sleep(450); // 팝(260ms)이 끝난 뒤에 잰다
        for (const p of pages) {
          const s = await readPolitics(p.page);
          const c = s.claims.find((x) => x.seat === hostSeat);
          rec(sc, "B3b", `경찰 배지 접근성 이름 '경찰 주장'·말 바꿈 아님 (${p.who})`, c?.label === "경찰 주장" && c.changed === false, `이름 "${c?.label ?? ""}" · 바꿈 ${c?.changed}`);
          recLines(rec, sc, claimBadgeChecks({ badge: c ? { rect: c.rect, icon: c.icon, swap: c.swap } : null, tag: c?.tag, tagWidthWithout: tagWidth[p.who] }), ` (${p.who})`);
          rec(sc, "B3c", `걸린 배지는 방장 것 하나뿐이고 산 사람 DOM 에 role-chip 0건 (${p.who})`, s.claims.length === 1 && s.roleChips === 0, `배지 ${s.claims.length}개 · role-chip ${s.roleChips}건`);
        }
        const s = await readPolitics(hp);
        rec(sc, "B3d", "방장 버튼 모양이 경찰 주장으로 바뀜(접근성 이름)", s.floats.find((f) => f.kind === "claim")?.label.includes("지금 경찰") === true, `이름 "${s.floats.find((f) => f.kind === "claim")?.label ?? ""}"`);
        await gameGH(ctx, id, "claimed", game.host);
      }

      // B4 시트 다시 열기: 안내 "바꾸면 말 바꿈이 보여요" → "말 안 함" → 손님 화면에 말 바꿈 점 + 글자 알약, 알약은 약 2.4초 뒤 사라지고 점은 남는다
      {
        const sc = `${id}/swap`;
        await hp.locator('[data-float="claim"]').click({ timeout: 4000 });
        await until(hp, (x) => x.claimSheet !== null, 4000, "배지 시트 다시 열림");
        await settle(hp);
        const s = await readPolitics(hp);
        rec(sc, "B4", "주장 중에는 시트에 안내 '바꾸면 말 바꿈이 보여요'", s.claimSheet.hint === "바꾸면 말 바꿈이 보여요", `안내 "${s.claimSheet.hint ?? ""}"`);
        recLines(rec, sc, sheetFitChecks(badgeSheetInput(s)), " (안내 있음, 방장)");
        // 손님 화면에서 알약이 나타나고 사라지는 시각을 50ms 간격으로 잰다
        const watch = (async () => {
          let appeared = null;
          const start = performance.now();
          for (;;) {
            const t = performance.now();
            const now = await gp.evaluate(() => document.querySelectorAll(".mv-claim__notice").length).catch(() => 0);
            if (now > 0 && appeared === null) appeared = t;
            if (appeared !== null && now === 0) return { appeared, gone: t };
            if (t - start > 9000) return { appeared, gone: null };
            await sleep(40);
          }
        })();
        await hp.locator('[data-claim-chip="none"]').click({ timeout: 4000 });
        await until(hp, (x) => x.claimSheet === null, 4000, "시트 닫힘");
        const sGuest = await until(gp, (x) => x.claims.some((c) => c.seat === hostSeat && c.claim === "none" && c.changed), 4000, "손님 화면에 말 안 함 + 말 바꿈 점");
        rec(sc, "B4b", "손님 화면에 [data-claim=none][data-claim-changed] 와 글자 알약 '말 바꿈'", sGuest.claims.some((c) => c.seat === hostSeat && c.claim === "none" && c.changed) && sGuest.notices.includes("말 바꿈"), `알약 ${sGuest.notices.length}개 "${sGuest.notices.join("|")}"`);
        const w = await watch;
        const dur = w.appeared !== null && w.gone !== null ? w.gone - w.appeared : null;
        const lo = NOTICE_MS - NOTICE_TOL_MS;
        const hi = NOTICE_MS + NOTICE_FADE_MS + NOTICE_TOL_MS;
        rec(sc, "B4c", `알약이 약 2.4초 떠 있다가 사라진다(${lo}~${hi}ms)`, dur !== null && dur >= lo && dur <= hi, dur === null ? "나타나지 않았거나 사라지지 않음" : `${Math.round(dur)}ms`);
        await sleep(200);
        for (const p of pages) {
          const s2 = await readPolitics(p.page);
          const c = s2.claims.find((x) => x.seat === hostSeat);
          rec(sc, "B4d", `알약이 사라진 뒤에도 말 바꿈 점은 남는다 (${p.who})`, !!c && c.changed && c.swap !== null && s2.notices.length === 0, `점 ${c?.swap ? "있음" : "없음"} · 알약 ${s2.notices.length}개`);
          recLines(rec, sc, claimBadgeChecks({ badge: c ? { rect: c.rect, icon: c.icon, swap: c.swap } : null, tag: c?.tag, tagWidthWithout: tagWidth[p.who] }), ` (말 바꿈 점, ${p.who})`);
          rec(sc, "B4e", `말 바꿈 배지 접근성 이름 '말 안 함, 말 바꿈' (${p.who})`, c?.label === "말 안 함, 말 바꿈", `이름 "${c?.label ?? ""}"`);
        }
        await gameGH(ctx, id, "swapped", game.host);
      }

      // B6 손님 새로 고침 뒤 첫 화면에 배지·점이 이펙트(팝·알약) 없이 그대로 있다
      {
        const sc = `${id}/reload`;
        await gp.reload({ waitUntil: "domcontentloaded" });
        const first = await attempt(async () => {
          const s = await until(gp, (x) => x.phase === "discussion" && x.claims.some((c) => c.seat === hostSeat), 9000, "새로 고침 뒤 배지");
          const c = s.claims.find((x) => x.seat === hostSeat);
          if (!(c.claim === "none" && c.changed && c.swap !== null)) return { ok: false, detail: `배지 ${c.claim} · 바꿈 ${c.changed} · 점 ${c.swap ? "있음" : "없음"}` };
          // 첫 읽기 직후 0.6초 동안 팝·알약이 한 번도 생기지 않는다
          const t0 = performance.now();
          while (performance.now() - t0 < 600) {
            const x = await readPolitics(gp);
            const cc = x.claims.find((y) => y.seat === hostSeat);
            if (x.notices.length > 0 || cc?.pop) return { ok: false, detail: `이펙트가 있다: 알약 ${x.notices.length}개 · 팝 ${cc?.pop}` };
            await sleep(50);
          }
          return true;
        });
        rec(sc, "B6", "새로 고침 뒤 첫 화면에 배지·점이 이펙트(팝·알약) 없이 있다", first.ok, first.detail);
      }

      // B5 지목: 버튼 유지(귓속말 버튼은 낮 토론뿐이라 배지 하나), 시트도 열 수 있고, 변론으로 넘어가면 버튼·시트가 DOM 에서 사라진다
      {
        const sc = `${id}/after`;
        await skipTo(hp, ht, "nomination");
        await allAt([hp, gp], "nomination");
        for (const p of pages) await settle(p.page);
        for (const p of pages) {
          const s = await readPolitics(p.page);
          recLines(rec, sc, floatButtonChecks(floatInput(s, 1)), ` (지목, ${p.who})`);
          rec(sc, "B5", `지목에서도 배지 버튼 하나만 있다 (${p.who})`, s.floats.length === 1 && s.floats[0].kind === "claim", `버튼 ${s.floats.map((f) => f.kind).join(",")}`);
        }
        // 손님이 지목 중에 시트를 열어 둔 채 방장이 변론으로 넘긴다
        await gp.locator('[data-float="claim"]').click({ timeout: 4000 });
        const open = await attempt(async () => {
          await until(gp, (x) => x.claimSheet !== null, 4000, "지목 중 배지 시트");
        });
        rec(sc, "B5b", "지목 중에도 배지 시트가 열린다(손님)", open.ok, open.detail);
        if (open.ok) {
          await settle(gp);
          const s = await readPolitics(gp);
          recLines(rec, sc, sheetFitChecks(badgeSheetInput(s)), " (지목 중, 손님)");
        }
        await skipTo(hp, ht, "defense");
        await allAt([hp, gp], "defense");
        await sleep(300);
        for (const p of pages) {
          const s = await readPolitics(p.page);
          rec(sc, "B5c", `변론 이후 떠 있는 버튼과 시트가 DOM 에서 사라진다 (${p.who})`, s.floats.length === 0 && s.claimSheet === null && s.lineSheet === null && s.layerKind === null, `버튼 ${s.floats.length}개 · 배지 시트 ${s.claimSheet ? "있음" : "없음"} · 귓속말 시트 ${s.lineSheet ? "있음" : "없음"} · 층 ${s.layerKind}`);
        }
      }
    } finally {
      await closeGame(game);
    }
  }

  // ---- politics-whisper: 버튼 → 모드 → 이름표 → 30자소 입력 → 보냄 → 당사자만 본문, 제3자는 사실 줄뿐, 하루 1번 (방장 + 손님 2 + 봇 1 = 4명판) ----
  async function politicsWhisperFlow(ctx) {
    const id = "politics-whisper";
    const rec = recorder(ctx);
    const small = ctx.size.h <= 640;
    const game = await openGame(ctx, id, { guests: 2, bots: 1, role: "citizen", to: "discussion", hostNick: GAME_HOST_NICK, guestInitScripts: [installFakeViewport] });
    try {
      const { hp, ht, hostSeat } = game;
      const [g1, g2] = game.guests;
            const hostName = nameOf(ht.last(), hostSeat);
      const g1Name = nameOf(ht.last(), g1.seat);
      const g2Name = nameOf(ht.last(), g2.seat);
      const pages = [
        { who: "방장", page: hp },
        { who: "손님1", page: g1.page },
        { who: "손님2", page: g2.page },
      ];
      await allAt(pages.map((p) => p.page), "discussion");
      for (const p of pages) await settle(p.page);

      // W1 귓속말 버튼: 모든 화면에 있고, 이름 "귓속말 보내기, 오늘 1번 남음", 상태 점, 남은 횟수 1
      {
        const sc = `${id}/button`;
        for (const p of pages) {
          const s = await readPolitics(p.page);
          const wb = s.floats.find((f) => f.kind === "whisper");
          rec(sc, "W1", `귓속말 버튼 이름 '귓속말 보내기, 오늘 1번 남음'·점 있음·남은 1 (${p.who})`, !!wb && wb.label === "귓속말 보내기, 오늘 1번 남음" && wb.dot && wb.left === "1" && !wb.disabled, `이름 "${wb?.label ?? ""}" · 점 ${wb?.dot} · 남은 ${wb?.left} · 막힘 ${wb?.disabled}`);
          recLines(rec, sc, floatButtonChecks(floatInput(s, 2)), ` (${p.who})`);
          rec(sc, "W1b", `산 사람 DOM 에 [data-role-chip] 0건 (L23, ${p.who})`, s.roleChips === 0, `${s.roleChips}건`);
        }
      }

      // W2 방장: 버튼 → 모드(헤더 안내 + 이름표 버튼 3개) → 손님1 이름표 → 한 줄 시트
      {
        const sc = `${id}/mode`;
        const walked = await approach(hp, ht, hostSeat, g1.seat, ctx.size);
        rec(sc, "W2a", "손님1 이름표가 보일 때까지 걸은 횟수(참고, 판정 아님: 카메라가 내 캐릭터를 따라가서 다른 사람이 화면 밖일 수 있다)", true, `${walked}걸음`, true);
        await hp.locator('[data-float="whisper"]').click({ timeout: 4000 });
        const m = await until(hp, (x) => x.hint?.text === "귓속말할 사람을 눌러요" && x.floats.some((f) => f.kind === "whisper" && f.pressed), 4000, "귓속말 모드");
        rec(sc, "W2", "모드: 헤더에 '귓속말할 사람을 눌러요'·버튼이 눌림", m.hint?.text === "귓속말할 사람을 눌러요" && !m.hint.folded, `안내 "${m.hint?.text ?? ""}" · 접힘 ${m.hint?.folded}`);
        await settle(hp);
        const gm = await readGame(hp);
        rec(sc, "W2b", `모드의 이름표 버튼이 나를 뺀 산 사람 수 3개이고 내 것은 없다`, gm.picks.length === 3 && !gm.picks.some((b) => b.seat === hostSeat), `버튼 ${gm.picks.length}개 · 자리 ${gm.picks.map((b) => b.seat).join(",")}`);
        recLines(rec, sc, pickButtonChecks(gm.picks), " (귓속말 모드, 방장)");
        rec(sc, "W2c", "이름표 버튼 이름이 '{이름} 님에게 귓속말'", gm.picks.every((b) => b.label.endsWith(" 님에게 귓속말")), gm.picks.map((b) => b.label).join(" / "));
        await gameGH(ctx, id, "mode", game.host);
        await hp.locator(`[data-pick="${g1.seat}"]`).click({ timeout: 4000 });
        await until(hp, (x) => x.lineSheet !== null, 4000, "한 줄 시트 열림");
        await settle(hp);
        const s = await readPolitics(hp);
        rec(sc, "W2d", "시트가 열리면 모드가 꺼지고(안내 사라짐) 상대 칩에 손님1 이름, 입력칸에 초점", s.hint?.text !== "귓속말할 사람을 눌러요" && s.lineSheet.peer.includes(g1Name) && s.lineSheet.focused, `안내 "${s.hint?.text ?? ""}" · 상대 칩 ${s.lineSheet.peer === g1Name ? "이름만" : "이름 포함"} · 초점 ${s.lineSheet.focused}`);
        recLines(rec, sc, sheetFitChecks(lineSheetInput(s)), " (방장)");
        rec(sc, "W2e", "보내기 버튼은 빈 글에서 aria-disabled", s.lineSheet.sendDisabled === true && s.lineSheet.count === "0/30", `막힘 ${s.lineSheet.sendDisabled} · 글자 수 ${s.lineSheet.count}`);
        await gameGH(ctx, id, "sheet", game.host);
      }

      // W3 31자소 입력 → 30자소로 잘림, 카운터 30/30 → 보내기. 손님1 의 받음 토스트를 놓치지 않게 먼저 기다리기 시작한다
      const toastP = until(g1.page, (x) => x.toasts.some((t) => t.on && t.text === `${hostName} 님의 귓속말`), 7000, "받음 토스트").then(
        () => ({ ok: true, detail: "" }),
        (e) => ({ ok: false, detail: e.message }),
      );
      {
        const sc = `${id}/send`;
        await hp.locator("[data-line-input]").fill(LONG_31);
        const s = await until(hp, (x) => x.lineSheet !== null && x.lineSheet.count === "30/30", 3000, "글자 수 30/30");
        rec(sc, "W3", "31자소를 넣으면 30자소로 잘리고 카운터가 30/30", graphemeCount(s.lineSheet.value) === 30 && s.lineSheet.value === SENT_30 && s.lineSheet.count === "30/30", `입력 ${graphemeCount(s.lineSheet.value)}자소 · 카운터 ${s.lineSheet.count} · 앞 30자소와 같음 ${s.lineSheet.value === SENT_30}`);
        rec(sc, "W3b", "글이 있으면 보내기 버튼이 눌릴 수 있다(aria-disabled 아님)", s.lineSheet.sendDisabled === false, `막힘 ${s.lineSheet.sendDisabled}`);
        await hp.locator("[data-line-send]").click({ timeout: 4000 });
        const used = await attempt(async () => {
          await ht.waitFor((v) => v.me.whisperUsed === true, 5000, "서버가 사용함으로 확인");
          await until(hp, (x) => x.lineSheet === null, 4000, "시트 닫힘");
        });
        rec(sc, "W3c", "보내면 서버가 사용함으로 확인하고 시트가 닫힌다", used.ok, used.detail);
      }

      // W4 누가 무엇을 보나: 보낸 사람 out 줄(본문), 받은 사람 in 줄(본문)+토스트, 제3자는 공개 사실 줄뿐이고 본문이 페이지 어디에도 없다(L17/L23)
      {
        const sc = `${id}/audience`;
        const fact = `${hostName} → ${g1Name} 귓속말`;
        const a = await attempt(async () => {
          await until(hp, (x) => x.whisperOut.length === 1, 5000, "보낸 줄", SENT_30);
        });
        const hs = await readPolitics(hp, SENT_30);
        rec(sc, "W4", "보낸 사람(방장) 화면에 [data-whisper=out] 본문 줄이 하나, 받은 줄은 없다", a.ok && hs.whisperOut.length === 1 && hs.whisperOut[0].body && hs.whisperIn.length === 0, `보낸 줄 ${hs.whisperOut.length}개(본문 일치 ${hs.whisperOut[0]?.body}) · 받은 줄 ${hs.whisperIn.length}개 ${a.detail}`);
        rec(sc, "W4b", "보낸 줄 첫 줄이 '나 → {손님1}'", hs.whisperOut[0]?.title === `나 → ${g1Name}`, `머리 "${hs.whisperOut[0]?.title ?? ""}"`);
        const b = await attempt(async () => {
          await until(g1.page, (x) => x.whisperIn.length === 1, 5000, "받은 줄", SENT_30);
        });
        const s1 = await readPolitics(g1.page, SENT_30);
        rec(sc, "W4c", "받은 사람(손님1) 화면에 [data-whisper=in] 본문 줄이 하나, 보낸 줄은 없다", b.ok && s1.whisperIn.length === 1 && s1.whisperIn[0].body && s1.whisperOut.length === 0, `받은 줄 ${s1.whisperIn.length}개(본문 일치 ${s1.whisperIn[0]?.body}) · 보낸 줄 ${s1.whisperOut.length}개 ${b.detail}`);
        rec(sc, "W4d", "받은 줄 첫 줄이 '{방장} → 나'", s1.whisperIn[0]?.title === `${hostName} → 나`, `머리 "${s1.whisperIn[0]?.title ?? ""}"`);
        const tt = await toastP;
        rec(sc, "W4e", "받은 사람 화면 위에 '{방장} 님의 귓속말' 토스트(본문 없음)", tt.ok, tt.detail);
        const c = await attempt(async () => {
          await until(g2.page, (x) => x.whisperPublic.includes(fact), 5000, "제3자의 사실 줄");
        });
        const s2 = await readPolitics(g2.page, SENT_30);
        rec(sc, "W4f", "제3자(손님2) 화면에는 공개 줄 '{방장} → {손님1} 귓속말' 뿐이다", c.ok && s2.whisperPublic.filter((t) => t === fact).length === 1 && s2.whisperIn.length === 0 && s2.whisperOut.length === 0, `공개 줄 ${s2.whisperPublic.length}개 · 받은 ${s2.whisperIn.length} · 보낸 ${s2.whisperOut.length} ${c.detail}`);
        rec(sc, "W4g", "제3자 화면 어디에도 귓속말 본문이 없다(HTML·화면 글·입력칸, L17/L23 canary)", s2.canaryInDom === false, `canary 있음 ${s2.canaryInDom}`);
        rec(sc, "W4h", "제3자 화면에 받음 토스트가 없다", !s2.toasts.some((t) => t.on && t.text.includes("님의 귓속말")), s2.toasts.map((t) => (t.on ? "켜짐" : "꺼짐")).join(","));
        // 당사자 둘의 화면에는 본문이 있다(양성 대조: 검사가 항상 false 가 아님을 보인다)
        rec(sc, "W4i", "당사자 화면(방장·손님1)에는 본문이 있다(canary 양성 대조)", hs.canaryInDom === true && s1.canaryInDom === true, `방장 ${hs.canaryInDom} · 손님1 ${s1.canaryInDom}`);
      }

      // W5 하루 1번: 방장 버튼이 aria-disabled·불투명도 0.45·점 없음, 눌러도 모드가 켜지지 않는다
      {
        const sc = `${id}/used`;
        await sleep(250);
        const s = await readPolitics(hp);
        const wb = s.floats.find((f) => f.kind === "whisper");
        rec(sc, "W5", "보낸 뒤 방장 버튼: 이름 '오늘 귓속말을 이미 보냈어요'·aria-disabled·점 없음·남은 0", !!wb && wb.label === "오늘 귓속말을 이미 보냈어요" && wb.disabled && !wb.dot && wb.left === "0", `이름 "${wb?.label ?? ""}" · 막힘 ${wb?.disabled} · 점 ${wb?.dot} · 남은 ${wb?.left}`);
        rec(sc, "W5b", "불투명도 0.45", !!wb && Math.abs(wb.opacity - 0.45) <= 0.02, `불투명도 ${wb?.opacity}`);
        await hp.locator('[data-float="whisper"]').click({ timeout: 4000, force: true }); // aria-disabled 버튼은 Playwright 가 '사용 불가'로 보므로 강제로 누른다
        await sleep(300);
        const after = await readPolitics(hp);
        const gm = await readGame(hp);
        rec(sc, "W5c", "막힌 버튼을 눌러도 모드가 켜지지 않는다(안내·이름표 버튼·시트 없음)", after.hint?.text !== "귓속말할 사람을 눌러요" && gm.picks.length === 0 && after.lineSheet === null, `안내 "${after.hint?.text ?? ""}" · 이름표 버튼 ${gm.picks.length}개 · 시트 ${after.lineSheet ? "있음" : "없음"}`);
        recLines(rec, sc, floatButtonChecks(floatInput(after, 2)), " (보낸 뒤, 방장)");
        // 보내지 않은 손님2 의 버튼은 그대로 쓸 수 있다
        const o = (await readPolitics(g2.page)).floats.find((f) => f.kind === "whisper");
        rec(sc, "W5d", "하루 1번은 사람마다다: 보내지 않은 손님2 의 버튼은 그대로", !!o && !o.disabled && o.dot && o.label === "귓속말 보내기, 오늘 1번 남음", `이름 "${o?.label ?? ""}" · 막힘 ${o?.disabled} · 점 ${o?.dot}`);
      }

      // W6 작은 폰(h ≤ 640): 가상 키보드를 올린 채 손님1 → 손님2 로 같은 순서를 한 번 더 걷는다. 입력칸·보내기가 보이는 영역 안에 있다
      if (small) {
        const sc = `${id}/keyboard`;
        const gp = g1.page;
        await approach(gp, g1.tracker, g1.seat, g2.seat, ctx.size);
        await gp.locator('[data-float="whisper"]').click({ timeout: 4000 });
        await until(gp, (x) => x.hint?.text === "귓속말할 사람을 눌러요", 4000, "손님1 귓속말 모드");
        await gp.locator(`[data-pick="${g2.seat}"]`).click({ timeout: 4000 });
        await until(gp, (x) => x.lineSheet !== null, 4000, "손님1 한 줄 시트");
        await gp.locator("[data-line-input]").focus();
        await gp.evaluate((k) => window.__mfVv.set(window.innerHeight - k, 0), KB_LIFT);
        await sleep(1200); // 포커스 뒤 100·300·1000ms 다시 읽기가 끝난 뒤
        const s = await readPolitics(gp);
        rec(sc, "W6", `키보드가 올라오면 data-kb-open 이고 보이는 영역이 ${KB_LIFT}만큼 줄었다`, s.kbOpen && Math.abs(s.vh - s.vv.h - KB_LIFT) <= 1, `열림 ${s.kbOpen} · 줄어든 높이 ${r1(s.vh - s.vv.h)}`);
        recLines(rec, sc, sheetFitChecks(lineSheetInput(s, { keyboard: true })), ` (키보드 열림${s.veiled ? "·패널 가려짐" : "·패널 보임"}, 손님1)`);
        const visibleBottom = s.vv.h + s.vv.top;
        const ls = s.lineSheet;
        const inView = (r) => !!r && r.top >= (s.header?.bottom ?? 0) - 0.5 && r.bottom <= visibleBottom + 0.5 && r.left >= -0.5 && r.right <= s.vw + 0.5;
        rec(sc, "W6b", "입력칸과 보내기 버튼이 보이는 영역(헤더 아래 ~ 키보드 위) 안에 있다", !!ls && inView(ls.input) && inView(ls.send), ls ? `입력칸 ${r1(ls.input?.top)}~${r1(ls.input?.bottom)} · 보내기 ${r1(ls.send?.top)}~${r1(ls.send?.bottom)} · 보이는 영역 ${r1(s.header?.bottom)}~${r1(visibleBottom)}` : "시트 없음");
        // 키보드가 열려 있으면 떠 있는 버튼은 패널과 함께 올라가서(UI-SPEC) 짧은 폰에서는 화면 위로 나간다. 시트가 열려 있는 동안 누를 일이 없어 판정하지 않고 위치만 참고로 남긴다
        rec(sc, "W6a", "키보드 열림 중 떠 있는 버튼 위치(참고, 판정 아님)", true, s.floats.map((f) => `${f.kind} 위 ${r1(f.rect?.top)}`).join(" · "), true);
        // 쓰고 보낸다: 키보드를 올린 채로 보내기가 눌린다
        await gp.locator("[data-line-input]").fill(SECOND);
        await gp.locator("[data-line-send]").click({ timeout: 4000 });
        const sent = await attempt(async () => {
          await g1.tracker.waitFor((v) => v.me.whisperUsed === true, 5000, "손님1 사용함 확인");
          await until(gp, (x) => x.lineSheet === null, 4000, "손님1 시트 닫힘");
          await until(g2.page, (x) => x.whisperIn.length === 1, 5000, "손님2 받은 줄", SECOND);
        });
        rec(sc, "W6c", "키보드를 올린 채 손님1 → 손님2 로 보낸다: 사용함 확인·시트 닫힘·손님2 가 받음", sent.ok, sent.detail);
        const third = await readPolitics(hp, SECOND);
        const fact2 = `${g1Name} → ${g2Name} 귓속말`;
        rec(sc, "W6d", "제3자(방장) 화면에는 두 번째 본문이 없고 공개 사실 줄 '{손님1} → {손님2} 귓속말' 만 있다", third.canaryInDom === false && third.whisperPublic.includes(fact2) && third.whisperIn.length === 0, `canary 있음 ${third.canaryInDom} · 공개 줄 ${third.whisperPublic.length}개 · 사실 줄 있음 ${third.whisperPublic.includes(fact2)} · 받은 줄 ${third.whisperIn.length}개`);
        await gp.evaluate(() => window.__mfVv.set(window.innerHeight, 0));
      }
    } finally {
      await closeGame(game);
    }
  }

  // ---- politics-pin: 지목 차례의 핀 조명(결정 0066-6, UI-SPEC F-2·흐름 E2E ⑥). 방장 + 봇 3 = 4명판, 봇 투표 규칙 pick "host" ----
  // 핀은 3D 라서 DOM 에 없다 — 렌더러가 받는 값을 그대로 내는 e2e 전용 window.__mfPin({seat, moving, strength})을 매 프레임 기록해 시간표로 본다.
  // 모이는 중 seat null → 차례가 오면 그 사람에게 켜짐(strength ≥ 0.5) → 확정 때 moving 이 참인 채 0.85~1.2초 안에 지목받은 사람에게 도착 → 끝 알림에서 0.
  // 핀은 크기와 무관한 3D 라서 폰 6종은 크기별 렌더 실패(G 검사·훅 값)가 없는지 확인하는 용도다.
  async function politicsPinFlow(ctx) {
    const id = "politics-pin";
    const rec = recorder(ctx);
    const game = await openGame(ctx, id, { guests: 0, bots: 3, role: "citizen", vote: { exec: "yes", pick: "host" }, to: "discussion", hostNick: GAME_HOST_NICK });
    try {
      const { hp, ht, hostSeat } = game;
      const sc = `${id}/pin`;
      await allAt([hp], "discussion");

      // 기록기: 훅이 없으면(?e2e 없는 주소) 준비 실패. 값이 바뀔 때마다 { t, seat, moving, strength } 를 쌓는다
      const hasHook = await hp.evaluate(() => window.__mfPin !== undefined);
      if (!hasHook) throw new SetupError("window.__mfPin 훅이 없음(?e2e=1 세션이 아님)");
      await hp.evaluate(() => {
        const log = (window.__pinLog = []);
        let key = "";
        const tick = () => {
          const p = window.__mfPin;
          if (p) {
            const k = `${p.seat}|${p.moving}|${p.strength.toFixed(3)}`;
            if (k !== key) {
              key = k;
              log.push({ t: performance.now(), seat: p.seat, moving: p.moving, strength: p.strength });
            }
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      const logLen = () => hp.evaluate(() => window.__pinLog.length);
      const logFrom = (i) => hp.evaluate((from) => window.__pinLog.slice(from), i);
      const nowPin = () => hp.evaluate(() => ({ ...window.__mfPin }));
      const pinUntil = async (pred, ms, label) => {
        const t0 = performance.now();
        for (;;) {
          const p = await nowPin();
          if (pred(p)) return p;
          if (performance.now() - t0 > ms) throw new Error(`${label} (${ms / 1000}초 안에 안 옴, 마지막 ${JSON.stringify(p)})`);
          await sleep(30);
        }
      };

      await skipTo(hp, ht, "nomination");
      await allAt([hp], "nomination");

      // PN1 모이는 중(i -1): 핀 없음
      const gather = await attempt(async () => {
        await ht.waitFor((v) => v.phase === "nomination" && v.day?.turn?.i === -1, 6000, "모이는 중");
        await sleep(400);
        const p = await nowPin();
        return p.seat === null && p.strength === 0 && !p.moving ? true : { ok: false, detail: `핀이 켜져 있음 ${JSON.stringify(p)}` };
      });
      rec(sc, "PN1", "모이는 중에는 핀이 없다 (seat null · strength 0)", gather.ok, gather.detail);

      const order = ht.last().day?.turn?.order ?? [];
      const N = order.length;
      const hostIdx = order.indexOf(hostSeat);
      const botSeat = order.find((x) => x !== hostSeat);
      if (N !== 4 || hostIdx < 0 || botSeat === undefined) throw new SetupError(`차례 순서가 4명판이 아님: ${JSON.stringify(order)}`);

      // 봇은 자기 차례가 시작되자마자 방장을 가리킨다(서버 봇 규칙) — 차례만 켜진 모습은 사람 차례(방장)에서만 본다. 방장 차례를 기준으로 세 가지를 잰다.
      // PN2 방장 자기 차례가 시작되면 핀이 방장 머리 위에 켜진다: seat == 방장, strength 0.5 이상
      const arrived = await attempt(async () => {
        await ht.waitFor((v) => v.phase === "nomination" && v.day?.turn?.i === hostIdx && v.day.turn.doneAt === undefined, 20_000, "방장 차례 시작");
      });
      if (!arrived.ok) throw new Error(arrived.detail);
      const lit = await attempt(async () => {
        const p = await pinUntil((x) => x.seat === hostSeat && x.strength >= 0.5, 1500, "방장 차례에 핀 켜짐");
        return { ok: true, detail: `seat ${p.seat} · strength ${r1(p.strength)}` };
      });
      rec(sc, "PN2", `방장 자기 차례(${hostIdx + 1}/${N}번째, 좌석 ${hostSeat})가 시작되면 핀이 방장에게 켜지고 세기가 0.5 이상으로 오른다`, lit.ok, lit.detail);
      await pinUntil((x) => x.strength >= 0.95, 1500, "핀 켜짐 완료").catch(() => {});
      await settle(hp);
      await gameGH(ctx, id, "pin", game.host);

      // PN3 방장이 봇 이름표를 누르면 확정된다
      const mark = await logLen();
      const tapped = await attempt(async () => {
        await tapTurnPick(hp, botSeat);
      });
      rec(sc, "PN3", `방장이 봇(좌석 ${botSeat}) 이름표를 누르면 확정된다`, tapped.ok, tapped.detail);

      // PN4 확정되면 moving 이 참이 되고 0.85~1.2초 뒤 지목받은 봇에게 도착한다. 이동 동안 켜진 채다.
      // 이동의 끝 = moving 이 거짓이 되는 기록, 또는 다음 차례(봇이 곧바로 확정)로 건너뛰며 세기가 다시 0 에서 오르는 기록(세기가 0.3 넘게 급락)
      const move = await attempt(async () => {
        let slide = null;
        const t0 = performance.now();
        while (performance.now() - t0 < 4000) {
          const entries = await logFrom(mark);
          const start = entries.findIndex((e) => e.moving === true);
          if (start >= 0) {
            const end = entries.findIndex((e, k) => k > start && (e.moving === false || e.strength < entries[k - 1].strength - 0.3));
            if (end >= 0) {
              slide = { start: entries[start], before: entries[end - 1], end: entries[end], during: entries.slice(start, end) };
              break;
            }
          }
          await sleep(40);
        }
        if (slide === null) throw new Error("이동(moving 참 → 끝)을 4초 안에 못 봄");
        const dur = slide.end.t - slide.start.t;
        const minK = Math.min(...slide.during.map((e) => e.strength));
        const seats = [...new Set(slide.during.map((e) => e.seat))];
        const problems = [];
        if (dur < 850 || dur > 1200) problems.push(`이동 ${Math.round(dur)}ms (기대 850~1200)`);
        if (slide.start.seat !== hostSeat) problems.push(`출발 좌석 ${slide.start.seat} (기대 ${hostSeat})`);
        if (slide.before.seat !== botSeat) problems.push(`도착 직전 좌석 ${slide.before.seat} (기대 ${botSeat})`);
        if (minK < 0.95) problems.push(`이동 중 세기가 ${r1(minK)} 까지 내려감`);
        return problems.length === 0 ? { ok: true, detail: `${Math.round(dur)}ms · 좌석 ${seats.join("→")} · 최소 세기 ${r1(minK)}` } : { ok: false, detail: problems.join(" / ") };
      });
      rec(sc, "PN4a", "핀 이동 시간 기록(참고, 판정은 PN4)", true, move.detail, true);
      rec(sc, "PN4", `확정되면 핀이 방장(좌석 ${hostSeat})에서 지목받은 봇(좌석 ${botSeat})으로 0.85~1.2초 동안 미끄러지고 그동안 켜진 채다`, move.ok, move.detail);

      // PN5 끝 알림: 핀이 꺼지고(seat null · strength 0) 선두·과반(방장 3표)을 비추지 않는다
      const end = await attempt(async () => {
        await ht.waitFor((v) => v.phase === "nomination" && v.day?.turn?.i === N, 12_000, "끝 알림");
        const p = await pinUntil((x) => x.seat === null && x.strength === 0, 1200, "끝 알림에서 핀 꺼짐");
        await sleep(400);
        const q = await nowPin();
        return q.seat === null && q.strength === 0 ? { ok: true, detail: `꺼짐 ${JSON.stringify(p)}` } : { ok: false, detail: `다시 켜짐 ${JSON.stringify(q)}` };
      });
      rec(sc, "PN5", "끝 알림에는 핀이 꺼져 있고 선두·과반(방장 득표)을 비추지 않는다", end.ok, end.detail);
      await attempt(async () => {
        await ht.waitFor((v) => v.phase === "defense", 8000, "변론");
      });
      // PN7 봇들의 차례에도 핀이 그 차례 주인에게서 방장으로 간다: 기록한 좌석에 네 차례 주인이 모두 나오고, 끝 알림 직전 마지막 켜진 좌석은 방장이다
      const all = await logFrom(0);
      const seen = new Set(all.map((e) => e.seat).filter((x) => x !== null));
      const lastLit = [...all].reverse().find((e) => e.seat !== null);
      rec(sc, "PN7", "봇 차례에도 핀이 지나간다: 기록에 네 좌석이 모두 나오고 마지막으로 비춘 사람은 방장(가장 많이 지목받은 사람)이다 — 끝 알림에서는 비추지 않는다", order.every((x) => seen.has(x)) && lastLit?.seat === hostSeat, `나온 좌석 ${[...seen].join(",")} · 마지막 켜진 좌석 ${lastLit?.seat}`);
      // PN6 변론으로 넘어간 뒤에도 핀은 없다(이 계획의 핀은 지목 차례 전용)
      const after = await nowPin();
      rec(sc, "PN6", "지목이 끝난 뒤(변론)에는 핀이 없다", after.seat === null && after.strength === 0, JSON.stringify(after));
    } finally {
      await closeGame(game);
    }
  }


  /**
   * 판결 순간(09.1.1-13, UI-SPEC 흐름 E2E ③, 결정 0066-3·7): 방장 + 봇 7(8인판, 이름 8자), 봇은 모두 찬성·방장을 지목 → 방장이 변론자.
   * 둘째 판(봇 모두 반대 → 부결, 변론자가 산 채로 남음)에서 처형 진입 2.0초에 새로 고침을 건다. 시계는 페이지가 처형 단계를 처음 그린 시각(= 0)이고, 서버 시각과의 어긋남(지연)만큼 허용 오차가 있다(lib.mjs VERDICT_TOL).
   * 첫째 판: 시간표(VT1~VT6)·묶음 배치(BF1~BF6, 알림 한 줄인 1.6초와 처형 알림 3.2초 두 번)·채팅 카드·직업 칩 없음·찬반 진행 중 view 에 day.ballots 없음.
   */
  async function politicsVerdictFlow(ctx) {
    const id = "politics-verdict";
    const rec = recorder(ctx);
    // 방장(변론자) 닉네임을 8자로 두어 처형 알림 "○○○○○○○○ 님 처형"이 폭 360 에서 두 줄로 감기는 최악 모양에서 묶음이 알림과 겹치지 않는지(BF2, 3.2초)까지 본다.
    // 봇 이름은 1~8자 무작위라 이름 글자 수 합 36 이상(평균 5 이상)이 될 때까지 다시 앉혀 알약이 한 줄 2개로 접히는 8인판 최악 모양(R=4)에 가깝게 만든다
    const OPEN = { guests: 0, bots: 7, role: "citizen", vote: { exec: "yes", pick: "host" }, to: "discussion", hostNick: "방장님이방장님이", minBotNameChars: 36 };
    const sc = `${id}/main`;

    // ---- 첫째 판 ----
    const game = await openGame(ctx, id, OPEN);
    try {
      const { hp, ht, hostSeat } = game;
      await allAt([hp], "discussion");
      // 처형 단계 기록기: 변할 때만 { t, phase, stage, yes, no, seat, strength, zoom, dim } 를 쌓는다(t = performance.now)
      const hasHook = await hp.evaluate(() => window.__mfPin !== undefined);
      if (!hasHook) throw new SetupError("window.__mfPin 훅이 없음(?e2e=1 세션이 아님)");
      await hp.evaluate(() => {
        const log = (window.__vLog = []);
        let key = "";
        const tick = () => {
          const root = document.querySelector("[data-game-stage]");
          const reveal = document.querySelector("[data-ballots]");
          const shown = (side) => !!reveal && !!reveal.querySelector(`[data-ballot-side="${side}"]:not(.is-pending)`);
          const p = window.__mfPin;
          const e = {
            phase: root?.getAttribute("data-phase") ?? "",
            stage: reveal?.getAttribute("data-stage") ?? null,
            yes: shown("yes"),
            no: shown("no"),
            seat: p ? p.seat : null,
            strength: p ? Math.round(p.strength * 100) / 100 : 0,
            zoom: p ? p.zoom : 1,
            dim: document.querySelector(".mf-game__dim")?.getAttribute("data-dim") ?? null,
          };
          const k = JSON.stringify(e);
          if (k !== key) {
            key = k;
            log.push({ t: performance.now(), ...e });
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      const relNow = () => hp.evaluate(() => {
        const first = (window.__vLog ?? []).find((e) => e.phase === "execution");
        return first ? performance.now() - first.t : null;
      });
      const waitRel = async (ms, label) => {
        const started = performance.now();
        for (;;) {
          const r = await relNow();
          if (r !== null && r >= ms) return r;
          if (performance.now() - started > 12_000) throw new Error(`${label} (처형 단계 기록이 ${ms}ms 에 닿지 않음)`);
          await sleep(Math.max(15, Math.min(150, r === null ? 80 : ms - r - 10)));
        }
      };

      // 찬반 진행 중에는 view 에 day.ballots 가 없다(L19): 처형으로 넘기기 전 방장 view 와 찬반 단계 동안 보이는 마지막 view 를 본다
      await skipTo(hp, ht, "verdict");
      await allAt([hp], "verdict");
      const during = await attempt(async () => {
        const v = ht.last();
        if (v.phase !== "verdict") throw new SetupError(`찬반 단계가 아님: ${v.phase}`);
        if (v.day?.candidate !== hostSeat) throw new SetupError(`변론자가 방장이 아님: ${v.day?.candidate}`);
        const leaked = v.day?.ballots !== undefined || JSON.stringify(v).includes('"ballots"');
        return leaked ? { ok: false, detail: "찬반 진행 중 view 에 ballots 가 있다" } : true;
      });
      rec(sc, "V0", "찬반 진행 중에는 view 에 day.ballots 가 없다", during.ok, during.detail);
      await skipTo(hp, ht, "execution");
      await ht.waitFor((v) => v.phase === "execution" && v.day?.ballots !== undefined && v.day?.verdict !== undefined, 4000, "처형 단계 view(찬반 기록 포함)");
      const exec = ht.last();
      const passed = exec.day.verdict.passed === true;
      const bots = exec.players.filter((p) => p.seat !== hostSeat);
      if (bots.length !== 7) throw new SetupError(`봇이 7명이 아님: ${bots.length}`);

      // V7 묶음 배치 — 알림이 한 줄인 1.6초
      await waitRel(1500, "처형 단계를 못 봄");
      const measure = () =>
        hp.evaluate(() => {
          const q = (s, r = document) => r.querySelector(s);
          const qa = (s, r = document) => [...r.querySelectorAll(s)];
          const rect = (el) => {
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
          };
          const root = q("[data-ballots]");
          if (!root) return null;
          const ann = q("[data-announce] .mf-announce__body");
          const panel = q("[data-world-panel]");
          const header = q(".mf-game__header");
          return {
            root: rect(root),
            groups: qa("[data-ballot-side]", root).map((g) => ({ side: g.getAttribute("data-ballot-side"), rect: rect(g) })),
            pills: qa("[data-ballot-seat]", root).map((p) => {
              const nm = q(".mv-ballots__name", p);
              return { side: p.classList.contains("is-no") ? "no" : "yes", rect: rect(p), nameFont: nm ? parseFloat(getComputedStyle(nm).fontSize) : null };
            }),
            panelTop: panel ? panel.getBoundingClientRect().top : null,
            announceBottom: ann ? ann.getBoundingClientRect().bottom : null,
            announceText: ann ? (ann.textContent ?? "").trim() : null,
            viewport: { w: window.innerWidth, h: window.innerHeight },
            compact: root.getAttribute("data-compact") === "true",
            stageH: header && panel ? panel.getBoundingClientRect().top - header.getBoundingClientRect().bottom : null,
            roleChips: qa("[data-role-chip]").length,
            pillCount: qa("[data-ballot-seat]", root).length,
          };
        });
      const m1 = await measure();
      if (m1 === null) throw new Error("1.6초에 찬반 묶음이 없다");
      recLines(rec, `${id}/fit`, ballotFitChecks(m1), " (1.6초 알림 한 줄)");
      const rows = new Set(m1.pills.map((p) => Math.round(p.rect.top))).size;
      rec(`${id}/fit`, "BF7", "알약이 봇 7명(찬성 7 · 반대 0)이다", m1.pillCount === 7, `알약 ${m1.pillCount}개 · 줄 수 R=${rows} · 이름 글자 수 ${bots.map((b) => graphemeCount(b.nickname)).join(",")} · ${m1.compact ? "얼굴만(2단계)" : "이름 알약"} · 알림 "${m1.announceText}"`, true);
      // 처형된 변론자(방장)는 이 순간부터 유령 시점이라 칩이 정상이다 — 산 사람 화면의 칩 없음은 부결 판(둘째 판)에서 본다
      const expectZoom = m1.stageH !== null && m1.stageH >= 360;
      // G 공통 검사는 묶음이 있는 지금 한 번
      await gameGH(ctx, id, "reveal", game.host);

      // 처형(또는 부결) 알림이 선 뒤(3.2초): 알림이 한 줄이면 묶음과 겹치지 않는다
      await waitRel(3200, "3.2초");
      const m2 = await measure();
      if (m2 === null) throw new Error("3.2초에 찬반 묶음이 없다");
      recLines(rec, `${id}/fit`, ballotFitChecks(m2), " (3.2초 처형 알림)");

      // V6 4.6초 뒤: 묶음은 없고 채팅 카드가 있다
      await waitRel(4900, "4.9초");
      const after = await hp.evaluate(() => {
        const q = (s, r = document) => r.querySelector(s);
        const qa = (s, r = document) => [...r.querySelectorAll(s)];
        const card = q('[data-card="ballots"]');
        const side = (k) => (card ? qa(`[data-ballot-side="${k}"] .mv-chat__ballots-name`, card).map((n) => (n.textContent ?? "").trim()) : null);
        return { reveal: q("[data-ballots]") !== null, card: card !== null, yes: side("yes"), no: side("no") };
      });
      const botNames = bots.map((b) => b.nickname).sort();
      const cardOk = after.card && JSON.stringify([...(after.yes ?? [])].sort()) === JSON.stringify(botNames) && (after.no ?? []).length === 0;
      rec(sc, "V6", "4.6초 뒤 묶음은 사라지고 채팅 카드(찬성 7명 = 변론자 외 봇, 반대 0명)가 같은 시각에 도착해 있다", !after.reveal && cardOk, `묶음 ${after.reveal ? "남음" : "없음"} · 카드 ${after.card ? "있음" : "없음"} · 찬성 ${after.yes?.length ?? "-"} · 반대 ${after.no?.length ?? "-"}`);

      // V1~V5 시간표(기록기)
      await waitRel(5800, "5.8초");
      const log = await hp.evaluate(() => window.__vLog);
      recLines(rec, `${id}/timeline`, verdictTimelineChecks(log, { passed, candidate: hostSeat, expectZoom }), ` (${passed ? "처형" : "부결"}, 스테이지 높이 ${m1.stageH === null ? "?" : Math.round(m1.stageH)})`);
      const t0 = log.find((e) => e.phase === "execution")?.t ?? 0;
      const yesAt = log.find((e) => e.t >= t0 && e.yes)?.t;
      const noAt = log.find((e) => e.t >= t0 && e.no)?.t;
      rec(`${id}/timeline`, "VT-info", "측정 시각(참고)", true, `찬성 ${yesAt ? Math.round(yesAt - t0) : "-"}ms · 반대 ${noAt ? Math.round(noAt - t0) : "-"}ms · 어둡게 막 ${log.some((e) => e.t >= t0 && e.dim === "verdict") ? "켜짐" : "없음"}`, true);
      const dimSeen = log.some((e) => e.t >= t0 && e.dim === "verdict");
      rec(sc, "V3b", "어둡게 막(data-dim=verdict)이 처형 진입 때 켜졌다가 4.6초 뒤 걷힌다", dimSeen && log.some((e) => e.t > t0 + 4000 && e.phase === "execution" && e.dim !== "verdict"), `켜짐 ${dimSeen}`);
    } finally {
      await closeGame(game);
    }

    // ---- 둘째 판: 처형 진입 2.0초에 새로 고침 → 첫 화면에 묶음이 애니메이션 없이 바로 있다 ----
    // 둘째 판은 모두 반대(부결)라 변론자 방장이 산 채로 남는다 — 산 사람 화면의 직업 칩 없음(V8)을 본다
    const game2 = await openGame(ctx, id, { ...OPEN, vote: { exec: "no", pick: "host" } });
    try {
      const { hp, ht, hostSeat } = game2;
      const sc2 = `${id}/reload`;
      await skipTo(hp, ht, "verdict");
      await skipTo(hp, ht, "execution");
      const t0Node = performance.now();
      await ht.waitFor((v) => v.phase === "execution" && v.day?.ballots !== undefined, 4000, "처형 단계 view");
      const waitMs = 2000 - (performance.now() - t0Node);
      if (waitMs > 0) await sleep(waitMs);
      await hp.reload({ waitUntil: "domcontentloaded" });
      const first = await attempt(async () => {
        let handle;
        try {
          handle = await hp.waitForFunction(
            () => {
              const el = document.querySelector("[data-ballots]");
              if (!el) return false;
              return {
                stage: el.getAttribute("data-stage"),
                enter: el.querySelectorAll(".is-enter").length,
                pending: el.querySelectorAll(".is-pending").length,
                pills: el.querySelectorAll("[data-ballot-seat]").length,
                dim: document.querySelector(".mf-game__dim")?.getAttribute("data-dim") ?? null,
              };
            },
            null,
            { polling: "raf", timeout: 3200 },
          );
        } catch {
          throw new SetupError("새로 고침 뒤 4.6초 안에 묶음을 못 봄(느린 새로 고침)");
        }
        const s = await handle.jsonValue();
        if (s.stage !== "both" || s.enter !== 0 || s.pending !== 0 || s.pills !== 7) return { ok: false, detail: `첫 화면 묶음 stage ${s.stage} · 등장 모션 ${s.enter} · 대기 ${s.pending} · 알약 ${s.pills}` };
        return { ok: true, detail: `stage ${s.stage} · 알약 ${s.pills}` };
      });
      rec(sc2, "V9", "(부결 판) 처형 진입 2.0초에 새로 고침하면 첫 화면에 찬반 묶음이 애니메이션 없이 바로 있다(두 묶음·알약 7개)", first.ok, first.detail);
      const alive = await hp.evaluate(() => ({ chips: document.querySelectorAll("[data-role-chip]").length, ghost: document.querySelector("[data-ghost-view]") !== null }));
      rec(sc2, "V8", "산 사람 화면(부결로 살아남은 변론자)에 직업 칩이 없다", alive.chips === 0 && !alive.ghost, `칩 ${alive.chips}개 · 유령 시점 ${alive.ghost}`);
      const dimNow = await hp.evaluate(() => document.querySelector(".mf-game__dim")?.getAttribute("data-dim") ?? null);
      rec(sc2, "V9b", "새로 고침 뒤에도 어둡게 막이 켜져 있다", dimNow === "verdict", `data-dim ${dimNow}`);
      // 줌: 훅의 첫 1 이 아닌 값이 곧바로 1.10 이다(아래 stageH 조건이 맞을 때만)
      const z = await attempt(async () => {
        const stage = await readGame(hp);
        const stageH = stage?.stage ? stage.stage.bottom - stage.stage.top : null;
        if (stageH === null) throw new SetupError("스테이지를 못 읽음");
        if (stageH < 360) {
          const peek = await hp.evaluate(() => window.__mfPin?.zoom ?? null);
          return peek === 1 || peek === null ? { ok: true, detail: `스테이지 ${Math.round(stageH)} < 360 이라 줌 없음` } : { ok: false, detail: `작은 스테이지에서 줌 ${peek}` };
        }
        let h;
        try {
          h = await hp.waitForFunction(() => (window.__mfPin && window.__mfPin.zoom !== 1 ? window.__mfPin.zoom : false), null, { polling: "raf", timeout: 2500 });
        } catch {
          return { ok: false, detail: "줌이 1.10 으로 오르지 않음" };
        }
        const v = await h.jsonValue();
        return Math.abs(v - 1.1) <= 0.01 ? { ok: true, detail: `첫 값 ${v}` } : { ok: false, detail: `첫 값 ${v} (애니메이션으로 시작)` };
      });
      rec(sc2, "V9c", "새로 고침 뒤 줌이 현재 값(1.10, 높이 360 미만은 1)으로 시작한다", z.ok, z.detail);
      void hostSeat;
    } finally {
      await closeGame(game2);
    }
  }

  return { politicsBadgeFlow, politicsWhisperFlow, politicsPinFlow, politicsVerdictFlow };
}
