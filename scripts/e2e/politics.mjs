// 정치 긴장 화면 E2E 흐름 (09.1.1-10·11·13·14·16, 결정 0066, UI-SPEC 흐름 E2E ①②③④⑤⑥): politics-badge(직업 배지)·politics-whisper(귓속말)·politics-pin(지목 차례 핀 조명)·politics-verdict(판결 순간)·politics-runoff(동점 결선, 사람 4명)·politics-runoff-tie(결선도 동점 → 처형 없음)·politics-showdown(마지막 3인 결전, 폰 6종)·politics-showdown-tie(1-1-1 → 처형 없음).
// flows.mjs 가 이미 3천 줄이라 흐름 본문은 이 파일에 둔다. flows.mjs 의 도우미는 `makePoliticsFlows(helpers)` 로 받는다(서로 import 하지 않는다 — 순환 없음).
// 두 흐름 모두 폰 6종(LOBBY_EXTRA_SIZES)으로 돈다. 방장 화면과 손님 화면 둘을 함께 본다.
// 판정 문턱은 lib.mjs 의 순수 검사 함수(floatButtonChecks·sheetFitChecks·claimBadgeChecks·pickButtonChecks)에 있고 여기서는 낮추지 않는다.
// 귓속말 본문(canary)은 결과 표와 오류 문구에 쓰지 않는다 — 있는지 없는지(불리언)만 남긴다(T-09.1.1-28).
import { chooseVerdict, hitsInputSurface, installFakeViewport, readGame, readHostBand, readChatLines, sampleWorld, screensOfWorld, SetupError, settle, skipTo, sleep, tapTurnPick, tapWorld } from "./browser.mjs";
import { FLOAT_BOX_H, ballotFitChecks, claimBadgeChecks, floatButtonChecks, gamePanelHeight, graphemeCount, pickButtonChecks, rectInside, rectsOverlap, runoffChecks, sheetFitChecks, showdownChecks, verdictTimelineChecks } from "./lib.mjs";

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
    // 14페이즈: 헤더 안내줄(.mv-phase__hint)은 자막 띠 문장([data-host-line])으로 옮겼다 — 옛 줄은 꺼진 장치 화면에만 남아 있어 없으면 띠 문장을 읽는다
    const hintEl = q(".mv-phase__hint") ?? q("[data-host-line]");
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

/** 결선 두 후보의 자리(서버 배치 shared/game/gather.ts RUNOFF_SPOTS, 고정소수점 /100 = 월드 단위). [0] = 낮은 좌석 */
const RUNOFF_SPOT_WORLD = [
  { x: 0.1, z: 2.0 },
  { x: 2.0, z: 0.1 },
];
/** 서 있는 자리와 RUNOFF_SPOTS 의 허용 거리(월드 단위, 걸어서 도착한 뒤) */
const RUNOFF_SPOT_TOL = 0.15;
/** 결선 변론 채팅 줄(src/game/dayView.ts DAY_COPY.runoffDefenseLine 과 같은 모양) */
const runoffDefenseLine = (name, k) => `${name} 님 결선 ${k}표 · 최후 변론`;

/** 게임 화면이 pred 를 만족할 때까지 읽는다. 시간 안에 안 오면 던진다 */
async function untilG(page, pred, ms, label) {
  const start = performance.now();
  for (;;) {
    const g = await readGame(page).catch(() => null);
    if (g && pred(g)) return g;
    if (performance.now() - start > ms) throw new Error(`${label} (${ms / 1000}초 안에 보이지 않음)`);
    await sleep(60);
  }
}

/** 결선 화면에서 readGame 이 싣지 않는 것: 알약 안 조각 글자, 헤더 안내 글 */
function readRunoffExtra(page) {
  return page.evaluate(() => {
    const pill = document.querySelector("[data-turn-block] .mf-turn__pill");
    return {
      parts: pill ? [...pill.children].map((c) => (c.textContent ?? "").trim()) : null,
      hint: ((document.querySelector(".mv-phase__hint") ?? document.querySelector("[data-host-line]"))?.textContent ?? "").trim(),
      pressed: document.querySelectorAll("[data-pick][aria-pressed='true']").length,
    };
  });
}

/** 결선 알약·제목·후보 이름표 보임을 40ms 마다 보고 바뀔 때만 쌓는 기록기(페이지 안). 값이 바뀌는 순간만 남아 가볍다 */
function installRunoffLog(page, candSeats) {
  return page.evaluate((cands) => {
    const log = (window.__rfLog = []);
    let key = "";
    const tick = () => {
      const tb = document.querySelector("[data-turn-block]");
      const pill = tb ? tb.querySelector(".mf-turn__pill") : null;
      const hd = document.querySelector(".mf-game__header");
      const pn = document.querySelector("[data-world-panel]");
      const vw = window.innerWidth;
      let tagsIn = 0;
      if (hd && pn) {
        const hb = hd.getBoundingClientRect().bottom;
        const pt = pn.getBoundingClientRect().top;
        for (const sx of cands) {
          const mv = document.querySelector(`.mf-world__tag[data-seat="${sx}"] .mv-tag`);
          if (!mv) continue;
          const r = mv.getBoundingClientRect();
          if (r.left >= 0 && r.right <= vw && r.top >= hb && r.bottom <= pt) tagsIn += 1;
        }
      }
      const e = {
        t: performance.now(),
        title: (document.querySelector(".mv-phase__title")?.textContent ?? "").trim(),
        pill: pill !== null,
        sec: pill ? (pill.querySelector(".mf-turn__sec")?.textContent ?? "").trim() : "",
        tone: tb?.getAttribute("data-turn-tone") ?? "",
        mode: tb?.getAttribute("data-turn-mode") ?? "",
        tagsIn,
      };
      const k = `${e.title}|${e.pill}|${e.sec}|${e.tone}|${e.mode}|${e.tagsIn}`;
      if (k !== key) {
        key = k;
        log.push(e);
      }
    };
    window.__rfTimer = setInterval(tick, 40);
    tick();
  }, candSeats);
}

// ---- 마지막 3인 결전 (09.1.1-16, UI-SPEC E) ----

/** 한마디 첫 칩(shared/game/showdown.ts LAST_WORD_CHIPS[0]) */
const SD_CHIP = "저는 아니에요";
/** 직접 쓰기 31자소 본문: 입력칸이 30자소로 자르는지 본다. 앞 30자소가 실제로 서버에 가는 한마디다 */
const SD_WRITE_31 = "직접쓴한마디는서른자소까지만보내져요가나다라마바사아자차카타파";
const SD_WRITE_30 = Array.from(SD_WRITE_31).slice(0, 30).join("");
if (graphemeCount(SD_WRITE_31) !== 31 || graphemeCount(SD_WRITE_30) !== 30) throw new Error("politics.mjs: 한마디 본문 상수의 자소 수가 31/30 이 아님");
/** 삼각형 자리(shared/game/gather.ts ringSlots(3), 고정소수점 /100 = 월드 단위) */
const SHOWDOWN_SLOT_WORLD = [
  { x: 0, z: 2.65 },
  { x: -2.29, z: -1.33 },
  { x: 2.29, z: -1.33 },
];
/** 삼각형 자리 허용 거리(월드 단위, 걸어서 도착한 뒤) */
const SHOWDOWN_SLOT_TOL = 0.35;

/** 마지막 3인 화면에서 readGame 이 싣지 않는 것: 단계·알약 조각·한마디 시트·인용 카드·한 줄 시트·지목 묶음 이름·직업 칩 수·떠 있는 버튼 수. 글자(한마디 본문)는 돌려주지 않고 같은지만 돌려준다 */
function readShowdown(page, expectQuote = "") {
  return page.evaluate((want) => {
    const q = (s, r = document) => r.querySelector(s);
    const qa = (s, r = document) => [...r.querySelectorAll(s)];
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
    };
    const tb = q("[data-turn-block]");
    const pill = tb ? q(".mf-turn__pill", tb) : null;
    const sheet = q("[data-speak-sheet]");
    const chipEls = sheet ? [...qa("[data-speak-chip]", sheet), ...qa("[data-speak-write]", sheet)] : [];
    const qEl = q("[data-last-word]");
    const qcs = qEl ? getComputedStyle(qEl) : null;
    const lh = qcs ? parseFloat(qcs.lineHeight) : NaN;
    const pad = qcs ? parseFloat(qcs.paddingTop) + parseFloat(qcs.paddingBottom) : 0;
    const ls = q("[data-line-sheet]");
    const input = ls ? q("[data-line-input]", ls) : null;
    const group = q('[role="group"][aria-label="지목"]');
    return {
      step: tb?.getAttribute("data-showdown-step") ?? "",
      mode: tb?.getAttribute("data-turn-mode") ?? "",
      parts: pill ? [...pill.children].map((c) => (c.textContent ?? "").trim()) : null,
      sheet: sheet ? { rect: rect(sheet), chips: chipEls.map(rect), chipCount: qa("[data-speak-chip]", sheet).length, hasWrite: q("[data-speak-write]", sheet) !== null } : null,
      quote: qEl ? { rect: rect(qEl), fontPx: parseFloat(qcs.fontSize), lines: Number.isFinite(lh) && lh > 0 ? Math.round((qEl.scrollHeight - pad) / lh) : null, same: want !== "" && (qEl.textContent ?? "").trim() === want } : null,
      lineSheet: ls
        ? {
            rect: rect(ls),
            title: (q(".mv-line__name", ls)?.textContent ?? "").trim(),
            count: (q(".mv-line__count", ls)?.textContent ?? "").trim(),
            graphemes: input ? Array.from(new Intl.Segmenter("ko", { granularity: "grapheme" }).segment(input.value)).length : null,
            same: want !== "" && input !== null && input.value === want,
            close: rect(q("[data-line-close]", ls)),
          }
        : null,
      group: group ? { label: group.getAttribute("aria-label"), buttons: qa("[data-pick]", group).length } : null,
      roleChips: qa("[data-role-chip]").length,
      floats: qa("[data-float]").length,
      floatRects: qa("[data-float]").map((b) => ({ kind: b.getAttribute("data-float"), rect: rect(b) })),
      hint: ((q(".mv-phase__hint") ?? q("[data-host-line]"))?.textContent ?? "").trim(),
      skipText: (document.body.innerText ?? "").includes("건너뜀"),
      hasChatPanel: q("[data-chat-panel]") !== null,
    };
  }, expectQuote);
}

/** 마지막 3인 동안 한 페이지의 화면 상태를 40ms 마다 보고 바뀔 때만 쌓는 기록기(페이지 안). 한마디 본문은 불리언(quote)·길이로만 남는다 */
function installShowdownLog(page) {
  return page.evaluate(() => {
    const log = (window.__sdLog = []);
    let key = "";
    const q = (s, r = document) => r.querySelector(s);
    const qa = (s, r = document) => [...r.querySelectorAll(s)];
    const tick = () => {
      const stage = q("[data-game-stage]");
      const tb = q("[data-turn-block]");
      const pill = tb ? q(".mf-turn__pill", tb) : null;
      const lineEl = tb ? q(".mf-turn__line", tb) : null;
      const pin = window.__mfPin ? { seat: window.__mfPin.seat, zoom: window.__mfPin.zoom, strength: window.__mfPin.strength } : null;
      const counts = qa(".mf-world__tag")
        .map((el) => [el.getAttribute("data-seat"), q(".mv-head", el)?.getAttribute("data-count") ?? ""])
        .filter(([, c]) => c !== "")
        .map(([sx, c]) => `${sx}:${c}`)
        .join(",");
      const doneSeats = qa(".mf-world__tag")
        .filter((el) => q(".mv-head[data-done]", el) !== null)
        .map((el) => el.getAttribute("data-seat"))
        .join(",");
      const e = {
        t: performance.now(),
        phase: stage?.getAttribute("data-phase") ?? "",
        title: (q(".mv-phase__title")?.textContent ?? "").trim(),
        step: tb?.getAttribute("data-showdown-step") ?? "",
        mode: tb?.getAttribute("data-turn-mode") ?? "",
        no: tb?.getAttribute("data-turn-no") ?? "",
        tone: tb?.getAttribute("data-turn-tone") ?? "",
        pill: pill !== null,
        parts: pill ? [...pill.children].map((c) => (c.textContent ?? "").trim()).join("|") : "",
        sec: pill ? (q(".mf-turn__sec", pill)?.textContent ?? "").trim() : "",
        line: lineEl && lineEl.classList.contains("is-on") ? (lineEl.textContent ?? "").trim() : "",
        quote: (q("[data-last-word]")?.textContent ?? "").trim(),
        sheet: q("[data-speak-sheet]") !== null,
        lineSheet: q("[data-line-sheet]") !== null,
        picks: qa("[data-pick]").length,
        pressed: qa("[data-pick][aria-pressed='true']").length,
        mine: qa(".mv-head[data-mine]").length,
        done: doneSeats,
        counts,
        announce: (q("[data-announce] .mf-announce__text")?.textContent ?? "").trim(),
        ballots: q("[data-ballots]") !== null,
        roleChips: qa("[data-role-chip]").length,
        floats: qa("[data-float]").length,
        pin,
      };
      const k = [e.phase, e.title, e.step, e.mode, e.no, e.tone, e.parts, e.line, e.quote, e.sheet, e.lineSheet, e.picks, e.pressed, e.mine, e.done, e.counts, e.announce, e.ballots, e.roleChips, e.floats, pin ? `${pin.seat}|${pin.zoom}|${pin.strength.toFixed(1)}` : ""].join("\u0001");
      if (k !== key) {
        key = k;
        log.push(e);
      }
    };
    window.__sdTimer = setInterval(tick, 40);
    tick();
  });
}

/** installShowdownLog 가 쌓은 기록 */
function readShowdownLog(page) {
  return page.evaluate(() => window.__sdLog ?? []);
}

/** 초 글자("5초")를 숫자로. 아니면 null */
const secOf = (text) => {
  const m = /^(\d+)초$/.exec(text ?? "");
  return m ? Number(m[1]) : null;
};

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
    boxH: FLOAT_BOX_H, // 14-07: 떠 있는 단추는 면 48 + 아래 라벨
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
    notice: true, // 11-07: 귓속말 시트는 열려 있는 동안 위에 공개 예고 한 줄이 있다
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
            // 14페이즈: 앱의 스테이지 사각형(useMapInsets)은 윗변이 헤더가 아니라 자막 띠 면 아랫변이다 — 줌 문턱(스테이지 360 이상)은 그 높이로 본다
            stageH: header && panel ? panel.getBoundingClientRect().top - Math.max(header.getBoundingClientRect().bottom, q("[data-host-band] .mv-host__band")?.getBoundingClientRect().bottom ?? 0) : null,
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
        // 14페이즈: 스테이지 윗변은 자막 띠 면 아랫변(앱 useMapInsets 와 같다)
        const bandNow = await readHostBand(hp);
        const stageH = stage?.stage ? stage.stage.bottom - Math.max(stage.stage.top, bandNow?.bandRect?.bottom ?? 0) : null;
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


  // ---- 동점 결선(09.1.1-14, UI-SPEC D, 흐름 E2E ④): 사람 4명(봇 0)이 지목 2:2 동점을 만들고 결선 → 변론 / 결선도 동점 → 처형 없음 → 밤 ----

  /** 이름표가 스테이지(헤더 아래 ~ 패널 위, 좌우 8px 안쪽)에 통째로 보이는가. 결선에는 떠 있는 버튼이 없어 tagVisible 의 떠 있는 버튼 자리 규칙은 쓰지 않는다 */
  const tagInStage = (page, seat) =>
    page.evaluate((sx) => {
      const mv = document.querySelector(`.mf-world__tag[data-seat="${sx}"] .mv-tag`);
      const hd = document.querySelector(".mf-game__header");
      const pn = document.querySelector("[data-world-panel]");
      if (!mv || !hd || !pn) return null;
      const r = mv.getBoundingClientRect();
      const ok = r.left >= 8 && r.right <= window.innerWidth - 8 && r.top >= hd.getBoundingClientRect().bottom + 8 && r.bottom <= pn.getBoundingClientRect().top - 8;
      return { ok, left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom), floats: document.querySelectorAll("[data-float]").length };
    }, seat);

  /** 사람 넷을 좌석 오름차순으로: [{ page, tracker, handle, seat, who }] */
  const humansOf = (game) =>
    [
      { page: game.hp, tracker: game.ht, handle: game.host, seat: game.hostSeat, who: "방장" },
      ...game.guests.map((x, i) => ({ page: x.page, tracker: x.tracker, handle: x, seat: x.seat, who: `손님${i + 1}` })),
    ].sort((a, b) => a.seat - b.seat);

  /** 위 한 줄이 want 인가. 압축형(360×560)은 위 한 줄 요소를 아예 그리지 않는다(UI-SPEC A-1) — 그때는 줄 요소 없음이 맞다 */
  const topLineIs = (g, want) => (g.turn?.compact ? g.turn.hasLineEl === false : g.turn?.line?.text === want);

  /**
   * 좌석 0..3(오름차순) 이 자기 차례에 2,3,3,2 번째 좌석(order[2], order[3], order[3], order[2])을 눌러 득표 2:2 동점(후보 = order[2], order[3])을 만든다.
   * 자기 자신은 못 누르므로 이 조합이다. 마지막 차례 뒤 끝 알림에서 위 한 줄 '동점이에요'(R1)를 모든 화면에서 본다.
   */
  async function makeTwoWayTie(game, rec, sc) {
    const hs = humansOf(game);
    const pages = hs.map((x) => x.page);
    const order = hs.map((x) => x.seat);
    await allAt(pages, "nomination");
    await game.ht.waitFor((v) => v.phase === "nomination" && (v.day?.turn?.order?.length ?? 0) === 4, 8000, "지목 차례 순서");
    const serverOrder = game.ht.last().day?.turn?.order ?? [];
    if (serverOrder.join(",") !== order.join(",")) throw new SetupError(`서버 차례 ${serverOrder.join(",")} ≠ 좌석 순서 ${order.join(",")}`);
    const targets = [order[2], order[3], order[3], order[2]];
    for (let i = 0; i < 4; i++) {
      await Promise.all(pages.map((p) => untilG(p, (g) => !!g.turn?.pill && g.turn.seat === order[i], 14_000, `${hs[i].who} 차례 알약`)));
      await untilG(hs[i].page, (g) => g.picks.length === 3, 3000, `${hs[i].who} 이름표 버튼`);
      await tapTurnPick(hs[i].page, targets[i]);
    }
    const noted = await attempt(async () => {
      await Promise.all(pages.map((p) => untilG(p, (g) => topLineIs(g, "동점이에요"), 5000, "끝 알림 동점이에요")));
    });
    rec(sc, "R1", "지목 끝 알림 동안 위 한 줄이 '동점이에요' (압축형은 줄 요소 없음)", noted.ok, noted.detail);
    return { hs, pages, order, cand: [order[2], order[3]] };
  }

  /** 후보 둘의 지금 화면 위치를 RUNOFF_SPOTS(월드 단위)와 견준다: 낮은 좌석이 [0]. 서로 거리도 돌려준다 */
  async function candidateSpots(page, cand) {
    const shown = await page.evaluate((seats) => seats.map((sx) => window.__mfWorld?.shown(sx) ?? null), cand);
    if (shown.some((x) => x === null)) throw new Error("후보 위치를 읽지 못함(맵 훅)");
    const off = shown.map((p, i) => Math.hypot(p.x - RUNOFF_SPOT_WORLD[i].x, p.z - RUNOFF_SPOT_WORLD[i].z));
    return { shown, off, gap: Math.hypot(shown[0].x - shown[1].x, shown[0].z - shown[1].z) };
  }

  /** 결선 투표 중(step 1) 한 화면의 읽기 묶음 */
  async function readVote(page) {
    const [g, x] = await Promise.all([readGame(page), readRunoffExtra(page)]);
    return { g, x };
  }

  /** runoffChecks 입력을 만든다: 후보 이름표 버튼 둘([data-pick])·알약·막대·화면 크기 */
  const runoffInput = ({ g, x }) => ({
    pill: g.turn?.pill ? { rect: g.turn.pill, minFontPx: g.turn.minFontPx, parts: x.parts, tone: g.turn.tone } : null,
    bar: g.turn?.bar ?? null,
    candidates: g.picks.map((b) => ({ seat: b.seat, rect: b.rect })),
    viewport: { w: g.vw, h: g.vh },
    compact: g.turn?.compact === true,
  });

  /**
   * 동점 결선 한 판의 공통 앞부분: 동점 → 결선 진입(R2) → 투표 창(R3) 읽기. 돌려주는 값은 투표 창 처음 읽은 화면 묶음과 기록기 접근자.
   */
  async function enterRunoff(game, rec, sc, ctx) {
    const { hs, pages, order, cand } = await makeTwoWayTie(game, rec, sc);
    const ht = game.ht;
    const nameOf0 = nameOf(ht.last(), cand[0]);
    const P = hs.map((h) => h.page);
    await installRunoffLog(P[0], cand);

    // R2 결선 진입: 제목 '결선'(모든 화면), 앞머리에는 알약이 없다
    const entered = await attempt(async () => {
      await Promise.all(P.map((p) => untilG(p, (g) => g.phase === "runoff", 8000, "결선 도착")));
    });
    rec(sc, "R2a", "지목이 동점이면 모든 화면이 결선(runoff) 단계로 간다", entered.ok, entered.detail);
    if (!entered.ok) throw new Error(entered.detail);

    // 투표 창: 알약이 켜진다. 후보가 걸어 와 가운데 마주 설 때까지 기다린 뒤(R2c) 모든 화면을 읽는다 — 이름표 사이 거리(RF3)는 도착한 자리에서 재야 뜻이 있다.
    // 후보 아닌 둘은 후보 이름표 버튼 둘, 후보 둘은 버튼 없음. 앞머리 1초 안에 못 끝난 걷기는 투표 창 앞쪽 1~2초 안에 끝난다(서버 MOVE_V 1.8 단위/초)
    await Promise.all(P.map((p) => untilG(p, (g) => !!g.turn?.pill, 4000, "결선 알약")));
    const spot = await attempt(async () => {
      const t0 = performance.now();
      let last = null;
      while (performance.now() - t0 < 2500) {
        last = await candidateSpots(P[0], cand);
        if (last.off.every((d) => d <= RUNOFF_SPOT_TOL)) return { ok: true, detail: `자리와 거리 ${last.off.map(r1).join("/")} · 서로 ${r1(last.gap)}` };
        await sleep(100);
      }
      return { ok: false, detail: `자리와 거리 ${last.off.map(r1).join("/")} (허용 ${RUNOFF_SPOT_TOL})` };
    });
    rec(sc, "R2c", "두 후보가 가운데 마주 선다(서버 RUNOFF_SPOTS 에 도착, 낮은 좌석이 왼쪽 자리)", spot.ok, spot.detail);
    const reads = await Promise.all(P.map((p) => readVote(p)));
    return { hs, pages: P, order, cand, reads, nameOf0, ht };
  }

  /** 기록기에서 앞머리(알약 없음)·카운트다운(알약 있음) 줄을 꺼낸다 */
  async function readRunoffLog(page) {
    return page.evaluate(() => window.__rfLog ?? []);
  }

  async function runoffChecksAll(rec, sc, e, ctx, id) {
    const { hs, reads, cand } = e;
    const voters = [0, 1];
    const waiters = [2, 3];
    // R2b 제목 '결선' 이 모든 화면 헤더에, 알약은 calm
    for (let k = 0; k < 4; k++) {
      const { g } = reads[k];
      rec(sc, "R2b", `헤더 제목이 '결선' 이다 (${hs[k].who})`, g.title === "결선", `제목 "${g.title}"`);
    }
    // R3 후보 아닌 둘: 후보 이름표 버튼 둘 + runoffChecks + pickButtonChecks, 안내 '둘 중 한 명을 눌러요'
    for (const k of voters) {
      const r = reads[k];
      recLines(rec, sc, runoffChecks(runoffInput(r)), ` (${hs[k].who}, 투표자)`);
      recLines(rec, sc, pickButtonChecks(r.g.picks), ` (${hs[k].who}, 투표자)`);
      const seats = r.g.picks.map((b) => b.seat).sort((a, b) => a - b);
      rec(sc, "R3a", `후보 아닌 화면에는 [data-pick] 이 정확히 후보 둘(좌석 ${cand.join("·")})이다 (${hs[k].who})`, seats.join(",") === cand.join(","), `버튼 좌석 ${seats.join(",")}`);
      rec(sc, "R3b", `안내가 '둘 중 한 명을 눌러요' 이다 (${hs[k].who})`, r.x.hint === "둘 중 한 명을 눌러요", `안내 "${r.x.hint}"`);
    }
    // 후보 둘: 버튼 없음·안내 '결과를 기다려요'
    for (const k of waiters) {
      const r = reads[k];
      rec(sc, "R3c", `후보 화면에는 [data-pick] 이 없고 안내가 '결과를 기다려요' 이다 (${hs[k].who})`, r.g.picks.length === 0 && r.x.hint === "결과를 기다려요", `버튼 ${r.g.picks.length}개 · 안내 "${r.x.hint}"`);
      recLines(rec, sc, runoffChecks({ ...runoffInput(r), candidates: [{ seat: cand[0], rect: { left: 0, top: 0, right: 160, bottom: 60 } }, { seat: cand[1], rect: { left: 200, top: 0, right: 360, bottom: 60 } }] }).filter((l) => l.id === "RF1" || l.id === "RF4" || l.id === "RF5"), ` (${hs[k].who}, 후보)`);
    }
    // 후보 이름표가 스테이지 안에 보인다(투표자 둘 화면)
    for (const k of voters) {
      for (const c of cand) {
        const v = await tagInStage(hs[k].page, c);
        rec(sc, "R3d", `후보 이름표(좌석 ${c})가 스테이지 안에 보이고 떠 있는 버튼이 없다 (${hs[k].who})`, v !== null && v.ok && v.floats === 0, v === null ? "이름표를 못 찾음" : `가로 ${v.left}~${v.right} 세로 ${v.top}~${v.bottom} · 떠 있는 버튼 ${v.floats}개`);
      }
    }
  }

  // ---- politics-runoff: 사람 4명 2:2 동점 → 결선 투표(바꾸기 포함) → 후보 득표 배지 → 변론. 폰 6종 ----
  async function politicsRunoffFlow(ctx) {
    const id = "politics-runoff";
    const rec = recorder(ctx);
    const sc = `${id}/main`;
    const game = await openGame(ctx, id, { guests: 3, bots: 0, role: "citizen", to: "nomination", hostNick: GAME_HOST_NICK });
    try {
      const e = await enterRunoff(game, rec, sc, ctx);
      const { hs, pages, order, cand, ht } = e;
      const [v0, v1] = [hs[0], hs[1]];
      const gh = gameGH(ctx, id, "runoff", hs[2].handle).catch((err) => rec(sc, "G", "G 공통 검사 실행", false, err?.message ?? String(err)));
      await runoffChecksAll(rec, sc, e, ctx, id);

      // R4 투표: 좌석 0 이 후보 3 을 눌렀다가 후보 2 로 바꾸고, 좌석 1 이 후보 2 를 누른다 (후보 = order[2], order[3])
      const [c0, c1] = cand;
      const doneOn = (g, seat) => g.tags.find((t) => t.seat === seat)?.done === true;
      const mineOn = (g) => g.tags.filter((t) => t.mine).map((t) => t.seat);
      const first = await attempt(async () => {
        await tapTurnPick(v0.page, c1);
        await Promise.all([1, 2, 3].map((k) => untilG(pages[k], (g) => doneOn(g, v0.seat), 3000, `${hs[k].who} 화면의 done 체크`)));
      });
      rec(sc, "R4a", `${v0.who} 가 후보 ${c1} 를 누르면 즉시 mine 이 되고 던진 사람 이름표에 done 체크가 다른 화면에도 붙는다`, first.ok, first.detail);
      {
        // 남의 선택은 DOM 어디에도 없다: 아직 던지지 않은 화면(손님1·후보 둘)에는 mine 이 없고 후보 버튼은 눌림이 아니다
        const others = await Promise.all([1, 2, 3].map(async (k) => ({ k, g: await readGame(pages[k]), x: await readRunoffExtra(pages[k]) })));
        const bad = others.filter(({ g, x }) => mineOn(g).length > 0 || x.pressed > 0).map(({ k }) => hs[k].who);
        rec(sc, "R4b", "남의 선택이 DOM 에 없다: 던진 사람은 done 체크뿐, 다른 화면에는 mine·눌림이 없다", bad.length === 0, `고른 표시가 있는 화면 ${bad.join(",")}`);
      }
      const change = await attempt(async () => {
        await tapTurnPick(v0.page, c0);
        const g = await untilG(v0.page, (x) => mineOn(x).join(",") === String(c0), 3000, "바꾼 선택이 mine");
        return doneOn(g, hs[1].seat) === false ? true : { ok: false, detail: "아직 안 던진 사람에 done" };
      });
      rec(sc, "R4c", `${v0.who} 가 마감 전에 후보 ${c0} 로 바꿀 수 있다 (mine 이 하나, 새 후보)`, change.ok, change.detail);
      const second = await attempt(async () => {
        await tapTurnPick(v1.page, c0);
        await Promise.all([0, 2, 3].map((k) => untilG(pages[k], (g) => doneOn(g, v1.seat) && doneOn(g, v0.seat), 3000, `${hs[k].who} 화면의 done 체크 둘`)));
      });
      rec(sc, "R4d", `${v1.who} 가 후보 ${c0} 를 누르면 done 체크가 둘이 된다`, second.ok, second.detail);
      {
        const w = await Promise.all([2, 3].map(async (k) => ({ k, g: await readGame(pages[k]), x: await readRunoffExtra(pages[k]) })));
        const bad = w.filter(({ g, x }) => mineOn(g).length > 0 || x.pressed > 0).map(({ k }) => hs[k].who);
        rec(sc, "R4e", "후보 화면에는 끝까지 고른 표시(mine·눌림)가 없고 누가 누구를 골랐는지 알 수 없다", bad.length === 0, `표시 있는 화면 ${bad.join(",")}`);
        const own = await readGame(v1.page);
        rec(sc, "R4f", `${v1.who} 화면에는 ${v1.who} 자신의 선택만 mine 이다(남의 선택 없음)`, mineOn(own).join(",") === String(c0), `mine ${mineOn(own).join(",")}`);
      }
      // R5 마감: 후보 2(order[2]) 득표 배지 2, 후보 3 은 없음, 위 한 줄 '{후보2} 님 2표'
      const nm0 = nameOf(ht.last(), c0);
      const result = await attempt(async () => {
        await ht.waitFor((v) => v.phase === "runoff" && v.day?.runoff?.step === 2, 8000, "결선 결과");
        await Promise.all(pages.map((p) => untilG(p, (g) => topLineIs(g, `${nm0} 님 2표`), 3000, "위 한 줄 득표")));
        const gs = await Promise.all(pages.map((p) => readGame(p)));
        const bad = [];
        gs.forEach((g, k) => {
          const a = g.tags.find((t) => t.seat === c0)?.count ?? null;
          const b = g.tags.find((t) => t.seat === c1)?.count ?? null;
          if (a !== "2") bad.push(`${hs[k].who}: 후보 ${c0} 배지 ${a}`);
          if (b !== null && b !== "0") bad.push(`${hs[k].who}: 후보 ${c1} 배지 ${b}`);
        });
        return bad.length === 0 ? true : { ok: false, detail: bad.join(" / ") };
      });
      rec(sc, "R5a", `마감 뒤 후보 ${c0} 의 득표 배지가 2, 후보 ${c1} 는 없고 위 한 줄이 '{이름} 님 2표' 이다 (압축형은 줄 요소 없음)`, result.ok, result.detail);

      // 변론: 변론자 = 후보 2, 채팅 hot 줄
      const defense = await attempt(async () => {
        await ht.waitFor((v) => v.phase === "defense", 6000, "결선 뒤 변론");
        if (ht.last().day?.candidate !== c0) throw new Error(`변론자 ${ht.last().day?.candidate} (기대 ${c0})`);
        const want = runoffDefenseLine(nm0, 2);
        await Promise.all(pages.map((p) => p.waitForFunction((t) => [...document.querySelectorAll("[data-chat-log] .mv-chat__sys.is-hot")].some((el) => (el.textContent ?? "").trim() === t), want, { timeout: 4000 })));
      });
      rec(sc, "R5b", `이어서 최후 변론이 열리고 변론자는 후보 ${c0}, 채팅에 hot 줄 '{이름} 님 결선 2표 · 최후 변론'`, defense.ok, defense.detail);

      // 기록기: 앞머리(알약 없음·제목 결선·후보 이름표 보임) / 카운트다운 / 색
      const log = await readRunoffLog(pages[0]);
      const intro = log.filter((x) => x.title === "결선" && !x.pill);
      const pills = log.filter((x) => x.pill && x.mode === "runoff");
      const secs = pills.map((x) => parseInt(x.sec, 10)).filter(Number.isFinite);
      rec(sc, "R2d", "앞머리(1초)에는 제목 '결선' 만 있고 알약이 없다", intro.length >= 1 && log.findIndex((x) => x.pill && x.mode === "runoff") > log.findIndex((x) => x.title === "결선"), `앞머리 기록 ${intro.length}개 · 첫 결선 기록 ${JSON.stringify(log.find((x) => x.title === "결선"))}`);
      rec(sc, "R2e", "앞머리 동안 후보 이름표 둘이 화면 안에 보인다(누를 수 있는 자리)", intro.length >= 1 && intro[intro.length - 1].tagsIn === 2, `이름표 보임 ${intro.map((x) => x.tagsIn).join("/")}`);
      const nonInc = secs.every((v, i) => i === 0 || v <= secs[i - 1]);
      rec(sc, "R4g", "알약 카운트다운이 5에서 0 쪽으로 줄어든다(4·3·2·1 을 모두 지난다)", secs.length > 0 && secs[0] <= 5 && nonInc && [4, 3, 2, 1].every((v) => secs.includes(v)), `초 기록 ${secs.join(",")}`);
      rec(sc, "R4h", "알약 색(data-turn-tone)이 끝까지 calm 이다", pills.length > 0 && pills.every((x) => x.tone === "calm"), `색 ${[...new Set(pills.map((x) => x.tone))].join(",")}`);
      await gh;
    } finally {
      await closeGame(game);
    }
  }

  // ---- politics-runoff-tie: 같은 동점 뒤 결선도 1:1 → 또 동점이에요 → 처형 없음 → 밤 (390×844 한 번) ----
  async function politicsRunoffTieFlow(ctx) {
    const id = "politics-runoff-tie";
    const rec = recorder(ctx);
    const sc = `${id}/main`;
    const game = await openGame(ctx, id, { guests: 3, bots: 0, role: "citizen", to: "nomination", hostNick: GAME_HOST_NICK });
    try {
      const { hs, pages, cand } = await enterRunoff(game, rec, sc, ctx);
      const ht = game.ht;
      const [c0, c1] = cand;
      const voted = await attempt(async () => {
        await tapTurnPick(hs[0].page, c0);
        await tapTurnPick(hs[1].page, c1);
      });
      rec(sc, "T1", `${hs[0].who} 는 후보 ${c0}, ${hs[1].who} 는 후보 ${c1} 에 투표한다`, voted.ok, voted.detail);

      const tie = await attempt(async () => {
        await ht.waitFor((v) => v.phase === "runoff" && v.day?.runoff?.step === 2, 8000, "결선 결과");
        await Promise.all(pages.map((p) => untilG(p, (g) => topLineIs(g, "또 동점이에요"), 3000, "또 동점이에요")));
        const gs = await Promise.all(pages.map((p) => readGame(p)));
        const bad = [];
        gs.forEach((g, k) => {
          for (const c of cand) {
            const n = g.tags.find((t) => t.seat === c)?.count ?? null;
            if (n !== "1") bad.push(`${hs[k].who}: 후보 ${c} 배지 ${n}`);
          }
        });
        return bad.length === 0 ? true : { ok: false, detail: bad.join(" / ") };
      });
      rec(sc, "T2", "결선도 1:1 이면 두 후보 배지가 1 이고 위 한 줄이 '또 동점이에요' (압축형은 줄 요소 없음)", tie.ok, tie.detail);

      // 처형 없음 알림 → 밤. 알림은 1.4초라 읽기를 촘촘히 한다
      const noExec = await attempt(async () => {
        const seen = new Set();
        const t0 = performance.now();
        while (performance.now() - t0 < 8000) {
          const g = await readGame(pages[0]).catch(() => null);
          if (g?.announce?.text) seen.add(g.announce.text);
          if (seen.has("처형 없음") && ht.last().phase === "night") break;
          await sleep(60);
        }
        if (!seen.has("처형 없음")) throw new Error(`알림 ${[...seen].join(" / ") || "없음"}`);
        await ht.waitFor((v) => v.phase === "night", 6000, "밤");
        if (ht.last().day?.candidate !== undefined && ht.last().day?.execution) throw new Error("처형이 일어남");
      });
      rec(sc, "T3", "'처형 없음' 알림이 뜨고 변론 없이 밤으로 간다", noExec.ok, noExec.detail);
      await Promise.all(pages.map((p) => untilG(p, (g) => g.phase === "night", 6000, "밤 화면")));
      await gameGH(ctx, id, "night", hs[0].handle);
    } finally {
      await closeGame(game);
    }
  }

  // ---- 마지막 3인 (09.1.1-16): 방장 처형 → 산 세 사람(손님 셋) → 마지막 셋 ----
  const aliveSeats = (view) => view.players.filter((p) => p.alive !== false).map((p) => p.seat);

  /**
   * 사람 4명(방장 citizen + 손님 3, 봇 0)이 1일차 지목에서 모두 방장을 가리키고(방장은 첫 손님) 손님 셋이 찬성해 방장을 처형한다.
   * 그 밤을 [넘기기]로 지나 2일차 낮 시작 발표 뒤 마지막 3인(showdown)이 열리기 바로 앞(밤)까지 데려간다. 못 만들면 SetupError(실패 항목이 아니라 중단).
   * 돌려주는 값: { hs(좌석 오름차순 4명), pages(4), hostEntry, guestsBySeat(산 손님 셋, 좌석 오름차순) }
   */
  async function buildThreeDay(game) {
    const hs = humansOf(game);
    const pages = hs.map((x) => x.page);
    const { hp, ht } = game;
    const hostEntry = hs.find((x) => x.who === "방장");
    const firstGuest = hs.find((x) => x.who !== "방장");
    try {
      await allAt(pages, "nomination");
      await ht.waitFor((v) => v.phase === "nomination" && (v.day?.turn?.order?.length ?? 0) === 4, 8000, "지목 차례 순서");
      const order = ht.last().day.turn.order;
      for (let i = 0; i < 4; i++) {
        const x = hs.find((y) => y.seat === order[i]);
        await Promise.all(pages.map((p) => untilG(p, (g) => !!g.turn?.pill && g.turn.seat === order[i], 14_000, `${x.who} 차례 알약`)));
        await untilG(x.page, (g) => g.picks.length === 3, 3000, `${x.who} 이름표 버튼`);
        await tapTurnPick(x.page, x.who === "방장" ? firstGuest.seat : hostEntry.seat);
      }
      await ht.waitFor((v) => v.phase === "defense", 9000, "마지막 차례 뒤 변론");
      await skipTo(hp, ht, "verdict");
      for (const x of hs.filter((y) => y.who !== "방장")) {
        await untilG(x.page, (g) => g.phase === "verdict" && g.verdictBtns.length === 2, 6000, `${x.who} 찬반 도착`);
        await chooseVerdict(x.page, true);
      }
      await skipTo(hp, ht, "execution");
      await ht.waitFor((v) => !aliveSeats(v).includes(hostEntry.seat), 6000, "방장 처형");
      await skipTo(hp, ht, "night");
      await Promise.all(pages.map((p) => untilG(p, (g) => g.phase === "night", 8000, "밤 화면")));
    } catch (err) {
      throw err instanceof SetupError ? err : new SetupError(`3명 낮을 만들지 못함: ${err?.message ?? err}`);
    }
    const alive = aliveSeats(ht.last());
    if (alive.length !== 3 || alive.includes(hostEntry.seat)) throw new SetupError(`산 사람이 손님 셋이 아님: ${alive.join(",")}`);
    return { hs, pages, hostEntry, guests: hs.filter((x) => x.who !== "방장") };
  }

  /** 밤에서 [넘기기]로 마지막 3인(showdown)까지 간다. 기록기는 그 전에 심어 둔다 */
  async function enterShowdown(game, pages) {
    const { hp, ht } = game;
    const hasHook = await hp.evaluate(() => window.__mfPin !== undefined);
    if (!hasHook) throw new SetupError("window.__mfPin 훅이 없음(?e2e=1 세션이 아님)");
    await Promise.all(pages.map((p) => installShowdownLog(p)));
    await skipTo(hp, ht, "showdown");
    const sd = ht.last().day?.showdown;
    if (!sd || sd.order.length !== 3) throw new SetupError(`마지막 3인 정보가 없음: ${JSON.stringify(sd)}`);
    return sd.order;
  }

  /** 한마디 차례 k(0..2)의 미확정 창이 열릴 때까지 기다린다(서버 기준) */
  const untilTurn = (ht, k) => ht.waitFor((v) => v.phase === "showdown" && v.day?.showdown?.i === k && v.day.showdown.doneAt === undefined, 16_000, `한마디 차례 ${k + 1}`);
  /** 모든 페이지가 pred 를 만족할 때까지(읽기 쌍) 기다린다 */
  const untilAll = (pages, pred, ms, label, expectQuote = "") =>
    Promise.all(
      pages.map(async (p) => {
        const t0 = performance.now();
        for (;;) {
          const [g, x] = await Promise.all([readGame(p).catch(() => null), readShowdown(p, expectQuote).catch(() => null)]);
          if (g && x && pred(g, x)) return { g, x };
          if (performance.now() - t0 > ms) throw new Error(`${label} (${ms / 1000}초 안에 보이지 않음)`);
          await sleep(60);
        }
      }),
    );

  /** showdownChecks 입력을 한 화면의 읽기 묶음에서 만든다 */
  const sdInput = (g, x, mode, extra = {}) => ({
    mode,
    pill: g.turn?.pill ? { rect: g.turn.pill, minFontPx: g.turn.minFontPx, parts: x.parts } : null,
    bar: g.turn?.bar ?? null,
    panel: g.panel,
    viewport: { w: g.vw, h: g.vh },
    compact: g.turn?.compact === true,
    ...extra,
  });

  // ---- politics-showdown: 사람 4명 → 방장 처형 → 산 손님 셋의 마지막 3인. 한마디 3번 → 동시 지목 → 공개 → 2표 처형. 폰 6종 ----
  async function politicsShowdownFlow(ctx) {
    const id = "politics-showdown";
    const rec = recorder(ctx);
    const sc = `${id}/main`;
    const game = await openGame(ctx, id, { guests: 3, bots: 0, role: "citizen", to: "nomination", hostNick: GAME_HOST_NICK });
    let where = "3명 낮 만들기";
    try {
      const { hp, ht } = game;
      const day = await buildThreeDay(game);
      const { hs, pages, hostEntry, guests } = day;
      const order = await enterShowdown(game, pages);
      const byseat = (seat) => hs.find((x) => x.seat === seat);
      const [A, B, C] = order.map(byseat); // 한마디 순서 = 좌석 오름차순
      const nameA = nameOf(ht.last(), A.seat);
      const nameB = nameOf(ht.last(), B.seat);
      const nameC = nameOf(ht.last(), C.seat);
      const alive = [A, B, C];
      const ghosts = [hostEntry];
      const panelWant = gamePanelHeight(ctx.size.h, "chat");

      where = "S1 모이기";
      // S1 모이기: 제목 '마지막 셋'·위 한 줄 '마지막 셋이에요'(압축형은 줄 요소 없음)·알약 없음 — 기록기에서 본다
      {
        await untilTurn(ht, 0);
        const logs = await Promise.all(pages.map((p) => readShowdownLog(p)));
        logs.forEach((log, k) => {
          const gather = log.filter((e) => e.step === "gather");
          rec(`${sc}/gather`, "SD1a", `모이는 동안 헤더 제목이 '마지막 셋' 이고 알약이 없다 (${hs[k].who})`, gather.length >= 1 && gather.every((e) => e.title === "마지막 셋" && e.pill === false), `모이기 기록 ${gather.length}개 · 제목 ${[...new Set(gather.map((e) => e.title))].join("/")} · 알약 ${[...new Set(gather.map((e) => e.pill))].join("/")}`);
          const compact = ctx.size.h <= 560;
          const lineOk = compact ? gather.every((e) => e.line === "") : gather.some((e) => e.line === "마지막 셋이에요");
          rec(`${sc}/gather`, "SD1b", `위 한 줄이 '마지막 셋이에요' (압축형 360x560 은 줄 없음) (${hs[k].who})`, gather.length >= 1 && lineOk, `줄 ${[...new Set(gather.map((e) => e.line))].join("/")}`);
        });
      }

      where = "S2 한마디 1";
      // S2 한마디 1: 내 화면(A) 칩 시트 + showdownChecks, 나머지 화면은 알약 `1 / 3` + 이름 + 초·시트 없음
      let first;
      {
        const s2 = `${sc}/speak1`;
        await A.page.waitForSelector("[data-speak-sheet]", { timeout: 4000 });
        await sleep(450); // 시트 등장·알약 자리 잡힘
        first = await Promise.all(pages.map(async (p) => ({ g: await readGame(p), x: await readShowdown(p) })));
        for (const [k, x] of hs.entries()) {
          const { g, x: e } = first[k];
          if (x.seat === A.seat) {
            recLines(rec, s2, showdownChecks(sdInput(g, e, "speak", { sheet: e.sheet?.rect ?? null, chips: e.sheet?.chips ?? null })), ` (${x.who}, 내 차례)`);
            rec(s2, "SD2a", `내 차례 시트에 빠른 칩 4개와 [직접 쓰기] 가 있다 (${x.who})`, e.sheet?.chipCount === 4 && e.sheet?.hasWrite === true, `칩 ${e.sheet?.chipCount} · 직접 쓰기 ${e.sheet?.hasWrite}`);
            rec(s2, "SD2b", `시트 높이가 패널 높이 ${panelWant} 이다(UI-SPEC 폰 크기 표) (${x.who})`, Math.abs((e.sheet?.rect?.height ?? -99) - panelWant) <= 1, `시트 ${r1(e.sheet?.rect?.height)} · 기대 ${panelWant}`);
            rec(s2, "SD2c", `시트가 화면 안에 있다 (${x.who})`, !!e.sheet && rectInside(e.sheet.rect, { left: 0, top: 0, right: g.vw, bottom: g.vh }), `시트 ${JSON.stringify(e.sheet?.rect && { l: r1(e.sheet.rect.left), t: r1(e.sheet.rect.top), r: r1(e.sheet.rect.right), b: r1(e.sheet.rect.bottom) })}`);
            rec(s2, "SD2d", `내 차례 헤더 안내가 '한마디를 골라요' (${x.who})`, e.hint === "한마디를 골라요" || e.hint === "", `안내 "${e.hint}"`); // 약 2.5초 뒤 접히면 빈 글일 수 있다
          } else {
            recLines(rec, s2, showdownChecks(sdInput(g, e, "speak")), ` (${x.who}, 구경)`);
            rec(s2, "SD2e", `내 차례가 아닌 화면에는 한마디 시트가 없고 채팅 패널이 그대로다 (${x.who})`, e.sheet === null && e.hasChatPanel, `시트 ${e.sheet ? "있음" : "없음"} · 채팅 ${e.hasChatPanel}`);
          }
          rec(s2, "SD2f", `알약이 '1 / 3' 과 차례 이름 '${nameA}' 를 보인다 (${x.who})`, e.parts?.[0] === "1 / 3" && e.parts?.[1] === `${nameA} 님 차례` && secOf(e.parts?.[2]) !== null, `조각 ${JSON.stringify(e.parts)}`);
          rec(s2, "SD2g", `헤더 제목이 '마지막 셋' 이다 (${x.who})`, g.title === "마지막 셋", `제목 "${g.title}"`);
          rec(s2, "SD2h", `압축형 여부가 폰 크기와 맞다(360x560 만 압축) (${x.who})`, (g.turn?.compact === true) === (ctx.size.h <= 560), `compact ${g.turn?.compact} · 높이 ${ctx.size.h}`);
        }
        // 직업 칩(L21·L23): 산 세 사람 DOM 0건, 유령 화면은 직업 칩이 있고 지목 버튼·떠 있는 버튼이 없다
        for (const [k, x] of hs.entries()) {
          const e = first[k].x;
          if (x.seat === hostEntry.seat) {
            rec(s2, "SD3a", "방장(유령) 화면은 직업 칩이 기존대로 보이고 떠 있는 버튼이 없다", e.roleChips >= 1 && e.floats === 0, `직업 칩 ${e.roleChips}개 · 떠 있는 버튼 ${e.floats}개`);
          } else {
            rec(s2, "SD3b", `산 사람 화면 DOM 에 [data-role-chip] 이 0건이다 (${x.who}, L21·L23)`, e.roleChips === 0, `직업 칩 ${e.roleChips}개`);
          }
        }
        // 직접 쓰기 차례는 세 번째: 첫 번째는 칩. 칩을 누르면 즉시 확정되어 시트가 사라지고 모두에게 인용 카드가 뜬다. 카드는 사이 0.9초 동안만 보이므로 보이는 순간의 읽기를 그대로 쓴다
        let cards = [];
        const pressed = await attempt(async () => {
          await A.page.locator("[data-speak-chip]", { hasText: SD_CHIP }).click({ timeout: 4000 });
          cards = await untilAll(pages, (_g, x) => x.quote !== null, 4000, "인용 카드", SD_CHIP);
        });
        rec(s2, "SD4a", "칩 하나를 누르면 모든 화면(방장 유령 포함)에 인용 카드가 뜬다", pressed.ok, pressed.detail);
        if (!pressed.ok) throw new Error(`칩을 눌러도 인용 카드가 오지 않음: ${pressed.detail}`);
        for (const [k, x] of hs.entries()) {
          const { g, x: e } = cards[k];
          rec(s2, "SD4b", `인용 카드의 글이 누른 칩과 같다 (${x.who})`, e.quote?.same === true, `카드 ${e.quote ? "있음" : "없음"} · 같음 ${e.quote?.same}`);
          recLines(rec, s2, showdownChecks(sdInput(g, e, "speak", { quote: e.quote ? { rect: e.quote.rect, fontPx: e.quote.fontPx, lines: e.quote.lines } : null })).filter((l) => l.id === "SH4" || l.id === "SH6"), ` (${x.who}, 인용 카드)`);
          rec(s2, "SD4c", `인용 카드가 화면 안에 있다 (${x.who})`, !!e.quote && rectInside(e.quote.rect, { left: 0, top: 0, right: g.vw, bottom: g.vh }), `카드 ${e.quote ? "있음" : "없음"}`);
          if (x.seat === A.seat) rec(s2, "SD4d", "확정되면 시트가 사라지고 채팅 패널이 돌아온다", e.sheet === null && e.hasChatPanel, `시트 ${e.sheet ? "있음" : "없음"} · 채팅 ${e.hasChatPanel}`);
        }
        // 채팅 줄(다시 읽기): 산 사람 화면에 그 글이 사람 줄로 남는다. 유령 화면은 참고만(유령 채널은 산 사람 채팅이 아닐 수 있다)
        for (const [k, x] of hs.entries()) {
          const lines = await readChatLines(pages[k]);
          const has = (lines ?? []).filter((l) => l.text === SD_CHIP && l.seat === String(A.seat)).length;
          if (x.seat === hostEntry.seat) rec(s2, "SD4e", `유령 화면의 채팅 줄 수(참고, 판정 아님) (${x.who})`, true, `한마디 줄 ${has}개`, true);
          else rec(s2, "SD4e", `채팅에도 그 한마디 줄이 한 번 남는다 (${x.who})`, has === 1, `줄 ${has}개`);
        }
        // 삼각형 자리: 산 세 사람이 ringSlots(3) 에 선다(걸어서 도착할 때까지 3초 기다린다)
        const tri = await attempt(async () => {
          const t0 = performance.now();
          let detail = "";
          while (performance.now() - t0 < 3500) {
            const ps = await Promise.all(order.map((sx) => A.page.evaluate((s) => window.__mfWorld?.shown(s) ?? null, sx)));
            if (ps.some((q) => q === null)) throw new Error("산 사람 위치를 읽지 못함(맵 훅)");
            const taken = new Set();
            const offs = ps.map((q) => {
              const d = SHOWDOWN_SLOT_WORLD.map((sl) => Math.hypot(q.x - sl.x, q.z - sl.z));
              const best = d.indexOf(Math.min(...d));
              taken.add(best);
              return d[best];
            });
            detail = `자리와 거리 ${offs.map(r1).join("/")} · 서로 다른 자리 ${taken.size}`;
            if (taken.size === 3 && offs.every((o) => o <= SHOWDOWN_SLOT_TOL)) return { ok: true, detail };
            await sleep(120);
          }
          return { ok: false, detail: `${detail} (허용 ${SHOWDOWN_SLOT_TOL})` };
        });
        rec(`${sc}/gather`, "SD1c", "산 세 사람이 삼각형 자리(ringSlots(3))에 선다", tri.ok, tri.detail);
        // 공통 검사 한 번(내 차례 화면)
        await gameGH(ctx, id, "speak1", A.handle);

      }

      where = "S3 한마디 2";
      // S3 한마디 2: 칩을 누르지 않는다 → 시간 초과로 말없이 넘어간다(인용 카드 없음·'건너뜀' 글 없음). 남은 5초 이하 진홍(기록기에서 본다)
      {
        const s3 = `${sc}/speak2`;
        await untilTurn(ht, 1);
        await sleep(700); // 앞 차례 카드가 걷힌 뒤
        const mid = await Promise.all(pages.map(async (p) => ({ g: await readGame(p), x: await readShowdown(p) })));
        mid.forEach(({ x: e }, k) => rec(s3, "SD5a", `두 번째 차례 시작에 앞 차례 인용 카드가 걷혀 있다 (${hs[k].who})`, e.quote === null, `카드 ${e.quote ? "있음" : "없음"}`));
        mid.forEach(({ g, x: e }, k) => rec(s3, "SD5b", `알약이 '2 / 3' 과 차례 이름 '${nameB}' (${hs[k].who})`, e.parts?.[0] === "2 / 3" && e.parts?.[1] === `${nameB} 님 차례`, `조각 ${JSON.stringify(e.parts)}`));
        await ht.waitFor((v) => v.phase === "showdown" && v.day?.showdown?.i === 1 && v.day.showdown.doneAt !== undefined, 11_000, "시간 초과로 넘어감");
        await sleep(300);
        const after = await Promise.all(pages.map(async (p) => ({ x: await readShowdown(p), lines: await readChatLines(p) })));
        after.forEach(({ x: e, lines }, k) => {
          rec(s3, "SD5c", `시간 초과 차례에는 인용 카드가 없다 (${hs[k].who})`, e.quote === null, `카드 ${e.quote ? "있음" : "없음"}`);
          rec(s3, "SD5d", `'건너뜀' 글이 어디에도 없다 (${hs[k].who})`, e.skipText === false, `건너뜀 글 ${e.skipText}`);
          const fromB = (lines ?? []).filter((l) => l.seat === String(B.seat)).length;
          rec(s3, "SD5e", `시간 초과 차례 주인의 채팅 줄이 없다 (${hs[k].who})`, hs[k].seat === hostEntry.seat || fromB === 0, `줄 ${fromB}개`);
        });
      }

      where = "S4 한마디 3";
      // S4 한마디 3: [직접 쓰기] → 한 줄 시트('한마디' 제목·n/30) → 31자소 입력이 30자소로 잘림 → 닫으면 칩으로 복귀 → 다시 열어 보내기 → 카드
      {
        const s4 = `${sc}/speak3`;
        await untilTurn(ht, 2);
        await C.page.waitForSelector("[data-speak-sheet]", { timeout: 4000 });
        await sleep(350);
        await C.page.locator("[data-speak-write]").click({ timeout: 4000 });
        await C.page.waitForSelector("[data-line-sheet]", { timeout: 3000 });
        await sleep(300);
        const open = await readShowdown(C.page);
        const gC = await readGame(C.page);
        rec(s4, "SD6a", "직접 쓰기를 누르면 한 줄 시트가 열리고 제목이 '한마디', 글자 수가 '0/30' 이다", open.lineSheet?.title === "한마디" && open.lineSheet?.count === "0/30", `제목 "${open.lineSheet?.title}" · 수 "${open.lineSheet?.count}"`);
        rec(s4, "SD6b", "한 줄 시트가 화면 안에 있다", !!open.lineSheet && rectInside(open.lineSheet.rect, { left: 0, top: 0, right: gC.vw, bottom: gC.vh }), `시트 ${open.lineSheet ? "있음" : "없음"}`);
        await C.page.locator("[data-line-close]").click({ timeout: 4000 });
        await C.page.waitForSelector("[data-speak-sheet]", { timeout: 3000 });
        rec(s4, "SD6c", "한 줄 시트를 닫으면 칩 시트로 돌아온다", (await readShowdown(C.page)).lineSheet === null, "한 줄 시트가 남음");
        await C.page.locator("[data-speak-write]").click({ timeout: 4000 });
        await C.page.waitForSelector("[data-line-sheet]", { timeout: 3000 });
        await C.page.locator("[data-line-input]").fill(SD_WRITE_31);
        await sleep(200);
        const filled = await readShowdown(C.page, SD_WRITE_30);
        rec(s4, "SD6d", "31자소를 넣어도 입력은 30자소로 잘리고 글자 수가 '30/30' 이다", filled.lineSheet?.graphemes === 30 && filled.lineSheet?.count === "30/30" && filled.lineSheet?.same === true, `자소 ${filled.lineSheet?.graphemes} · 수 "${filled.lineSheet?.count}" · 앞 30자소와 같음 ${filled.lineSheet?.same}`);
        await C.page.locator("[data-line-send]").click({ timeout: 4000 });
        let cards = [];
        const sent = await attempt(async () => {
          cards = await untilAll(pages, (_g, x) => x.quote !== null, 4000, "직접 쓴 인용 카드", SD_WRITE_30);
        });
        rec(s4, "SD6e", "보내면 모든 화면에 인용 카드가 뜬다", sent.ok, sent.detail);
        if (!sent.ok) throw new Error(`보내도 인용 카드가 오지 않음: ${sent.detail}`);
        cards.forEach(({ g, x: e }, k) => {
          rec(s4, "SD6f", `인용 카드 글이 보낸 30자소와 같고 두 줄 이하이다 (${hs[k].who})`, e.quote?.same === true && (e.quote?.lines ?? 9) <= 2, `같음 ${e.quote?.same} · 줄 ${e.quote?.lines}`);
          recLines(rec, s4, showdownChecks(sdInput(g, e, "speak", { quote: e.quote ? { rect: e.quote.rect, fontPx: e.quote.fontPx, lines: e.quote.lines } : null })).filter((l) => l.id === "SH4"), ` (${hs[k].who}, 30자소 카드)`);
        });
        rec(s4, "SD6g", "보낸 뒤 한 줄 시트·칩 시트가 모두 닫힌다", cards[hs.indexOf(C)].x.lineSheet === null && cards[hs.indexOf(C)].x.sheet === null, "시트가 남음");
      }

      where = "S5 동시 지목";
      // S5 동시 지목
      const pickTimeline = {};
      {
        const s5 = `${sc}/point`;
        await ht.waitFor((v) => v.phase === "showdown" && v.day?.showdown?.i === 3, 6000, "동시 지목");
        await sleep(450);
        const pt = await Promise.all(pages.map(async (p) => ({ g: await readGame(p), x: await readShowdown(p) })));
        for (const [k, x] of hs.entries()) {
          const { g, x: e } = pt[k];
          const dead = x.seat === hostEntry.seat;
          recLines(rec, s5, showdownChecks(sdInput(g, e, "point", dead ? {} : { buttons: g.picks.map((b) => ({ seat: b.seat, rect: b.rect })) })), ` (${x.who}${dead ? ", 유령" : ""})`);
          rec(s5, "SD7a", `알약이 '지목'·'모두 동시에'·초 이고 지목 단계 표식이다 (${x.who})`, e.step === "point" && e.mode === "point" && e.parts?.[0] === "지목" && e.parts?.[1] === "모두 동시에", `단계 ${e.step} · 모드 ${e.mode} · 조각 ${JSON.stringify(e.parts)}`);
          if (dead) {
            rec(s5, "SD7b", "방장(유령) 화면에는 지목 버튼과 떠 있는 버튼이 없고 직업 칩이 있다", g.picks.length === 0 && e.floats === 0 && e.roleChips >= 1, `지목 버튼 ${g.picks.length}개 · 떠 있는 버튼 ${e.floats}개 · 직업 칩 ${e.roleChips}개`);
          } else {
            const others = order.filter((sx) => sx !== x.seat);
            rec(s5, "SD7c", `산 화면에는 지목 버튼이 나를 뺀 두 사람이고 묶음 이름이 '지목' 이다 (${x.who})`, g.picks.map((b) => b.seat).sort((a, b) => a - b).join(",") === others.join(",") && e.group?.label === "지목", `버튼 ${g.picks.map((b) => b.seat).join(",")} · 묶음 "${e.group?.label}"`);
            const covered = e.floatRects.filter((f) => g.picks.some((b) => rectsOverlap(b.rect, f.rect))).map((f) => f.kind);
            rec(s5, "SD7e", `지목 버튼이 떠 있는 버튼에 가려지지 않는다 (${x.who})`, covered.length === 0, `가린 떠 있는 버튼 ${covered.join(",")} · 버튼 ${g.picks.map((b) => `${b.seat}:${r1(b.rect.left)}~${r1(b.rect.right)}x${r1(b.rect.top)}~${r1(b.rect.bottom)}`).join(" ")} · 떠 있는 ${e.floatRects.map((f) => `${f.kind}:${r1(f.rect.left)}~${r1(f.rect.right)}x${r1(f.rect.top)}~${r1(f.rect.bottom)}`).join(" ")}`);
            rec(s5, "SD7d", `헤더 안내가 '의심되는 사람을 눌러요' (접히면 빈 글) (${x.who})`, e.hint === "의심되는 사람을 눌러요" || e.hint === "", `안내 "${e.hint}"`);
            rec(s5, "SD3c", `산 사람 화면 DOM 에 [data-role-chip] 이 0건이다 (${x.who}, L23)`, e.roleChips === 0, `직업 칩 ${e.roleChips}개`);
          }
        }

        const doneOf = (g) => g.tags.filter((t) => t.done).map((t) => t.seat).sort((a, b) => a - b).join(",");
        const mineOf = (g) => g.tags.filter((t) => t.mine).map((t) => t.seat).sort((a, b) => a - b).join(",");
        // 남의 선택 비공개: chooser 가 아닌 화면에는 mine·눌림·득표 배지가 없다
        const noLeak = async (chooser, label, id2) => {
          const ds = await Promise.all(
            hs.map(async (x, k) => ({ x, g: await readGame(pages[k]) })),
          );
          const bad = ds.filter(({ x, g }) => x.seat !== chooser.seat && (mineOf(g) !== "" || g.picks.some((b) => b.pressed) || g.tags.some((t) => t.count !== null && t.count !== ""))).map(({ x }) => x.who);
          rec(s5, id2, `남의 선택이 DOM 에 없다: ${label} (mine·눌림·득표 배지 없음)`, bad.length === 0, `표시 있는 화면 ${bad.join(",")}`);
          return ds;
        };
        // A 가 B 를 눌렀다가 C 로 바꾼다. B 는 C 를, C 는 A 를 누른다(C 가 2표)
        await tapTurnPick(A.page, B.seat);
        await Promise.all(pages.map((p, k) => (hs[k].seat === A.seat ? Promise.resolve() : untilG(p, (g) => doneOf(g).split(",").includes(String(A.seat)), 3000, "던진 사람 done 체크"))));
        {
          const ds = await noLeak(A, `${A.who} 가 한 번 눌렀을 때`, "SD8a");
          // 던진 사람 자신의 화면은 서버 확인 전에 mine 으로 먼저 바뀌므로(SD8c) done 은 다른 화면만 본다
          rec(s5, "SD8b", `${A.who} 가 누르면 다른 화면에 이름표 done 체크만 붙는다`, ds.every(({ x, g }) => x.seat === A.seat || doneOf(g) === String(A.seat)), `done ${ds.map(({ g }) => doneOf(g)).join(" | ")}`);
          const mineA = mineOf(ds[hs.indexOf(A)].g);
          rec(s5, "SD8c", `내가 누른 사람만 내 화면에서 mine 이다 (${A.who})`, mineA === String(B.seat), `mine ${mineA}`);
        }
        await tapTurnPick(A.page, C.seat);
        {
          const g = await readGame(A.page);
          rec(s5, "SD8d", `마감 전에 다른 사람으로 바꿀 수 있다 (mine 이 하나, 새 대상)`, mineOf(g) === String(C.seat), `mine ${mineOf(g)}`);
        }
        await tapTurnPick(B.page, C.seat);
        await tapTurnPick(C.page, A.seat);
        await Promise.all(pages.map((p) => untilG(p, (g) => doneOf(g) === [...order].sort((a, b) => a - b).join(","), 3000, "세 사람 모두 done")));
        {
          const ds = await Promise.all(hs.map(async (x, k) => ({ x, g: await readGame(pages[k]) })));
          rec(s5, "SD8e", "세 사람이 모두 누르면 세 이름표에 done 체크가 붙는다 (모든 화면)", ds.every(({ g }) => doneOf(g) === [...order].sort((a, b) => a - b).join(",")), `done ${ds.map(({ g }) => doneOf(g)).join(" | ")}`);
          const bad = ds.filter(({ x, g }) => (x.seat === hostEntry.seat ? mineOf(g) !== "" : mineOf(g).split(",").length !== 1)).map(({ x }) => x.who);
          rec(s5, "SD8f", "유령은 mine 이 없고 산 사람은 자기 선택 하나만 mine 이다", bad.length === 0, `어긋난 화면 ${bad.join(",")}`);
          const counts = ds.filter(({ g }) => g.tags.some((t) => t.count !== null && t.count !== ""));
          rec(s5, "SD8g", "마감 전에는 득표 배지가 어느 화면에도 없다", counts.length === 0, `배지 있는 화면 ${counts.length}`);
        }
        await gameGH(ctx, id, "point", B.handle);
      }

      where = "S6 공개·처형";
      // S6 공개 → 처형: C 가 2표를 받는다. 짧은 구간이라 기록기에서 본다
      {
        const s6 = `${sc}/reveal`;
        await ht.waitFor((v) => v.phase === "showdown" && v.day?.showdown?.i === 4, 9000, "동시 공개");
        await ht.waitFor((v) => v.phase === "execution" || v.phase === "ended" || v.phase === "night", 6000, "공개 뒤 단계");
        await sleep(3800); // 처형 알림 3.0초 + 여유
        const logs = await Promise.all(pages.map((p) => readShowdownLog(p)));
        logs.forEach((log, k) => {
          const rv = log.filter((e) => e.step === "reveal");
          rec(s6, "SD9a", `공개 단계에 ${nameC} 머리 위 득표 배지 2 가 뜬다 (${hs[k].who})`, rv.some((e) => e.counts.split(",").includes(`${C.seat}:2`)), `공개 기록 ${rv.length}개 · 배지 ${[...new Set(rv.map((e) => e.counts))].join(" / ")}`);
          rec(s6, "SD9b", `공개 단계에는 위 한 줄이 없다 (${hs[k].who})`, rv.length >= 1 && rv.every((e) => e.line === ""), `줄 ${[...new Set(rv.map((e) => e.line))].join("/")}`);
          const ex = log.filter((e) => e.phase === "execution");
          const texts = [...new Set(ex.map((e) => e.announce).filter((t) => t !== ""))];
          rec(s6, "SD9c", `처형 알림이 '${nameC} 님 처형' 이다 (${hs[k].who})`, texts.includes(`${nameC} 님 처형`), `알림 ${texts.length}개 · 처형 알림 ${texts.includes(`${nameC} 님 처형`)}`);
          rec(s6, "SD9d", `'찬성 n · 반대 m' 알림이 없고 찬반 묶음([data-ballots])이 없다 (${hs[k].who})`, !texts.some((t) => /찬성|반대/.test(t)) && ex.every((e) => e.ballots === false), `찬반 알림 ${texts.filter((t) => /찬성|반대/.test(t)).length}개 · 묶음 ${ex.filter((e) => e.ballots).length}`);
          const zooms = ex.map((e) => e.pin?.zoom).filter((z) => typeof z === "number");
          rec(s6, "SD9e", `처형 동안 카메라 줌이 올라가지 않는다 (__mfPin.zoom 1) (${hs[k].who})`, ex.length >= 1 && zooms.length >= 1 && zooms.every((z) => z === 1), `줌 ${[...new Set(zooms)].join("/") || "기록 없음"} · 처형 기록 ${ex.length}개`);
          const lit = ex.filter((e) => e.pin && e.pin.seat === C.seat && e.pin.strength >= 0.5);
          rec(s6, "SD9f", `처형 핀이 ${nameC} 의 좌석에 켜진다 (${hs[k].who})`, lit.length >= 1, `핀 좌석 ${[...new Set(ex.map((e) => e.pin?.seat))].join("/")}`);
        });
        // 한마디 구간 기록: 두 번째(시간 초과) 차례의 시간 색, 첫째·셋째 차례 인용 카드, 직업 칩, 떠 있는 버튼
        logs.forEach((log, k) => {
          const t2 = log.filter((e) => e.step === "speak" && e.no === "2");
          const bySec = new Map();
          for (const e of t2) {
            const sec = secOf(e.sec);
            if (sec === null) continue;
            if (!bySec.has(sec)) bySec.set(sec, new Set());
            bySec.get(sec).add(e.tone);
          }
          const secs = [...bySec.keys()].sort((a, b) => b - a);
          const lowOk = secs.filter((v) => v >= 1 && v <= 4).every((v) => [...bySec.get(v)].every((t) => t === "urgent"));
          const highOk = secs.filter((v) => v >= 6).every((v) => ![...bySec.get(v)].includes("urgent"));
          rec(s6, "SD10a", `시간 초과 차례의 알약 색: 남은 5초 이하는 진홍(urgent), 6초 이상은 아니다 (${hs[k].who})`, secs.some((v) => v <= 4) && secs.some((v) => v >= 6) && lowOk && highOk, `초 기록 ${secs.join(",")} · 색 ${secs.map((v) => `${v}:${[...bySec.get(v)].join("+")}`).join(" ")}`);
          rec(s6, "SD10b", `시간 초과 차례에는 인용 카드가 한 번도 뜨지 않는다 (${hs[k].who})`, t2.length >= 1 && t2.filter((e) => e.sec !== "" && secOf(e.sec) !== null && secOf(e.sec) <= 7).every((e) => e.quote === ""), `차례 기록 ${t2.length}개 · 카드가 보인 기록 ${t2.filter((e) => e.quote !== "" && secOf(e.sec) !== null && secOf(e.sec) <= 7).length}`);
          const allSd = log.filter((e) => e.phase === "showdown");
          if (hs[k].seat === hostEntry.seat) rec(s6, "SD3d", "방장(유령) 화면은 마지막 3인 내내 직업 칩이 있고 지목 버튼·떠 있는 버튼이 없다", allSd.length >= 1 && allSd.filter((e) => e.step !== "").every((e) => e.roleChips >= 1 && e.picks === 0 && e.floats === 0), `기록 ${allSd.length}개 · 직업 칩 없는 기록 ${allSd.filter((e) => e.roleChips < 1).length} · 지목 버튼 있는 기록 ${allSd.filter((e) => e.picks > 0).length} · 떠 있는 버튼 기록 ${allSd.filter((e) => e.floats > 0).length}`);
          else rec(s6, "SD3e", `산 사람 화면 DOM 에 마지막 3인 내내 [data-role-chip] 이 0건이다 (${hs[k].who}, L21·L23)`, allSd.length >= 1 && allSd.every((e) => e.roleChips === 0), `기록 ${allSd.length}개 · 직업 칩 있는 기록 ${allSd.filter((e) => e.roleChips > 0).length}`);
          const pointTimes = log.filter((e) => e.step === "point");
          const ps = [...new Set(pointTimes.map((e) => secOf(e.sec)).filter((v) => v !== null))];
          const urgentPoint = pointTimes.filter((e) => secOf(e.sec) !== null && secOf(e.sec) >= 1 && secOf(e.sec) <= 4);
          rec(s6, "SD10c", `동시 지목도 남은 5초 이하는 진홍이다 (${hs[k].who})`, urgentPoint.length >= 1 && urgentPoint.every((e) => e.tone === "urgent"), `초 기록 ${ps.join(",")} · 진홍 아닌 기록 ${urgentPoint.filter((e) => e.tone !== "urgent").length}`);
        });
        // 끝: 마피아 한 명이 남는 판이면 ended, 아니면 밤 — 서버 흐름대로(어느 쪽이든 단계가 하나로 정해진다)
        const endPh = ht.last().phase;
        rec(s6, "SD11", "공개 뒤 단계가 서버 흐름대로 이어진다(처형 → 끝 또는 밤)", ["execution", "ended", "night"].includes(endPh), `단계 ${endPh}`);
        const exec = ht.last().players.filter((p) => p.alive === false).map((p) => p.seat);
        rec(s6, "SD12", `처형된 사람이 ${nameC} 이다(2표)`, exec.includes(C.seat) && !aliveSeats(ht.last()).includes(C.seat), `탈락 좌석 ${exec.join(",")}`);
      }
      // 마지막 확인: 모든 화면에서 알약·시트·카드가 화면 안(SH1·SD2c·SD4c 가 이미 각 순간에 잰다)
    } catch (err) {
      if (err instanceof SetupError) throw err;
      const msgLines = String(err?.message ?? err).split("\n");
      const why = msgLines.find((l) => /intercepts|not visible|outside of the viewport|not stable|detached|disabled/.test(l));
      throw new Error(`${where}: ${msgLines[0]}${why ? ` · ${why.trim().slice(0, 140)}` : ""}`);
    } finally {
      await closeGame(game);
    }
  }

  // ---- politics-showdown-tie: 같은 3명 낮에서 한마디는 모두 시간 초과, 1-1-1 지목 → '처형 없음' → 밤 (390×844 한 번) ----
  async function politicsShowdownTieFlow(ctx) {
    const id = "politics-showdown-tie";
    const rec = recorder(ctx);
    const sc = `${id}/main`;
    const game = await openGame(ctx, id, { guests: 3, bots: 0, role: "citizen", to: "nomination", hostNick: GAME_HOST_NICK });
    try {
      const { ht } = game;
      const day = await buildThreeDay(game);
      const { hs, pages, hostEntry } = day;
      const order = await enterShowdown(game, pages);
      const [A, B, C] = order.map((sx) => hs.find((x) => x.seat === sx));
      // 한마디 세 차례를 모두 시간 초과로 넘긴다
      await ht.waitFor((v) => v.phase === "showdown" && v.day?.showdown?.i === 3, 40_000, "동시 지목");
      await sleep(400);
      // 1-1-1: A→B, B→C, C→A
      const voted = await attempt(async () => {
        await tapTurnPick(A.page, B.seat);
        await tapTurnPick(B.page, C.seat);
        await tapTurnPick(C.page, A.seat);
      });
      rec(sc, "ST1", "세 사람이 서로 한 명씩 지목한다(1-1-1)", voted.ok, voted.detail);
      await ht.waitFor((v) => v.phase === "showdown" && v.day?.showdown?.i === 4, 9000, "동시 공개");
      // 알림은 1.4초라 읽기를 촘촘히 한다
      const noExec = await attempt(async () => {
        const seen = new Set();
        const t0 = performance.now();
        while (performance.now() - t0 < 9000) {
          const g = await readGame(pages[1]).catch(() => null);
          if (g?.announce?.text) seen.add(g.announce.text);
          if (seen.has("처형 없음") && ht.last().phase === "night") break;
          await sleep(60);
        }
        if (!seen.has("처형 없음")) throw new Error(`알림 ${[...seen].join(" / ") || "없음"}`);
        await ht.waitFor((v) => v.phase === "night", 6000, "밤");
      });
      rec(sc, "ST2", "'처형 없음' 알림이 뜨고 밤으로 이어진다", noExec.ok, noExec.detail);
      const alive = aliveSeats(ht.last());
      rec(sc, "ST3", "아무도 처형되지 않아 산 사람이 그대로 셋이다", alive.length === 3 && !alive.includes(hostEntry.seat), `산 사람 ${alive.join(",")}`);
      const logs = await Promise.all(pages.map((p) => readShowdownLog(p)));
      logs.forEach((log, k) => {
        const sp = log.filter((e) => e.step === "speak");
        rec(sc, "ST4", `한마디를 아무도 하지 않으면 인용 카드가 한 번도 뜨지 않는다 (${hs[k].who})`, sp.length >= 1 && sp.every((e) => e.quote === ""), `한마디 기록 ${sp.length}개 · 카드 기록 ${sp.filter((e) => e.quote !== "").length}`);
        const rv = log.filter((e) => e.step === "reveal");
        rec(sc, "ST5", `공개 단계에 세 사람 모두 득표 배지 1 이 뜬다 (${hs[k].who})`, rv.some((e) => order.every((sx) => e.counts.split(",").includes(`${sx}:1`))), `배지 ${[...new Set(rv.map((e) => e.counts))].join(" / ")}`);
        const ex = log.filter((e) => e.phase === "execution");
        rec(sc, "ST6", `처형 단계가 없다 (${hs[k].who})`, ex.length === 0, `처형 기록 ${ex.length}개`);
      });
      const bodyHasSkip = await Promise.all(pages.map(async (p) => (await readShowdown(p)).skipText));
      rec(sc, "ST7", "'건너뜀' 글이 어디에도 없다", bodyHasSkip.every((v) => v === false), `건너뜀 글 ${bodyHasSkip.filter(Boolean).length}곳`);
      await gameGH(ctx, id, "night", B.handle);
    } finally {
      await closeGame(game);
    }
  }

  return { politicsBadgeFlow, politicsWhisperFlow, politicsPinFlow, politicsVerdictFlow, politicsRunoffFlow, politicsRunoffTieFlow, politicsShowdownFlow, politicsShowdownTieFlow };
}
