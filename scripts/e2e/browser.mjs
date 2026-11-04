// 화면 E2E 의 브라우저 쪽(결정 0025). Node 는 HTTP 로 테스트 방만 만들고 소켓을 열지 않는다 —
// 방장 소켓은 브라우저 페이지가 쥔다(스크립트가 쥐면 앱이 앞 소켓을 4001 로 대체한다).
// 토큰은 createTestRoom 결과와 addInitScript 인자에만 머문다. 페이지가 받은 state 프레임만 읽고 보낸 프레임은 구독하지 않는다.
import { chromium } from "playwright-core";
import {
  DECORATIVE_ALLOW,
  FONT_HOSTS,
  ROLE_NAME,
  TAP_ALLOW,
  TEXT_SIZE_ALLOW,
  redact,
  rgbP95Luminance,
} from "./lib.mjs";

/** 맵 로비 테스트 훅(window.__mfWorld, 06-13)을 켜는 세션 저장소 키. src/world/testHooks.ts 의 WORLD_TEST_KEY 와 같다. */
const WORLD_HOOK_KEY = "minifia:e2e";

/** 준비 단계의 실패(연결·단계 도달·선택자 대기 시간 초과). 한 번 새 방으로 다시 돈다. 검사 실패와 다르다. */
export class SetupError extends Error {
  constructor(message) {
    super(message);
    this.name = "SetupError";
  }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** HTTP 로 테스트 방을 만든다. 실패는 상태 코드만 담는다(본문·토큰을 싣지 않는다). */
export async function createTestRoom(origin, nickname) {
  let res;
  try {
    res = await fetch(`${origin}/api/rooms`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nickname, testMode: true }),
    });
  } catch (e) {
    throw new SetupError(`방 만들기 요청 실패: ${e instanceof Error ? e.name : "오류"}`);
  }
  if (res.status !== 201) throw new SetupError(`방 만들기 응답 ${res.status}`);
  const data = await res.json().catch(() => null);
  if (!data || typeof data.code !== "string" || typeof data.token !== "string") throw new SetupError("방 만들기 응답 모양이 다름");
  return { code: data.code, token: data.token };
}

/** HTTP 로 방에 손님으로 들어간다(참가 API). 실패는 상태 코드만 담는다 — 토큰·본문을 싣지 않는다. */
export async function joinTestRoom(origin, code, nickname) {
  let res;
  try {
    res = await fetch(`${origin}/api/rooms/${code}/join`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nickname }),
    });
  } catch (e) {
    throw new SetupError(`참가 요청 실패: ${e instanceof Error ? e.name : "오류"}`);
  }
  if (res.status !== 200) throw new SetupError(`참가 응답 ${res.status}`);
  const data = await res.json().catch(() => null);
  if (!data || typeof data.token !== "string") throw new SetupError("참가 응답 모양이 다름");
  return { code, token: data.token, seat: data.seat };
}

export function launchChrome(executablePath) {
  return chromium.launch({ executablePath, headless: true });
}

/**
 * 방장으로 붙은 휴대폰 크기 페이지를 연다.
 * 선택 인자(05-07): mobile = true(거짓이면 isMobile·hasTouch 를 꺼 데스크톱 창처럼 연다), guest = true(06-17: 방장이 아니라 손님으로 붙는다 — 방장 확인 대신 로비 도달을 기다린다),
 * initScripts = [] (세션 init 스크립트 다음에 순서대로 addInitScript 할 함수 또는 문자열 — 시험 컨텍스트에만 들어간다),
 * preRoute = async (context) => {} (06-18: 페이지를 열기 전에 컨텍스트에 요청 가로채기를 더한다 — 막아야 할 요청이 첫 요청일 때. route.fallback() 으로 넘기면 아래 대상 밖 차단이 이어 받는다).
 * 돌려주는 값: { context, page, tracker, takeIssues, fontOk, fontDetail }
 */
export async function openHostPage(browser, { origin, code, token, size, dpr, mobile = true, initScripts = [], guest = false, preRoute = null }) {
  const context = await browser.newContext({
    viewport: { width: size.w, height: size.h },
    deviceScaleFactor: dpr,
    isMobile: mobile,
    hasTouch: mobile,
    locale: "ko-KR",
  });
  let issues = { console: [], failed: [], offOrigin: [] };
  const blocked = new WeakSet();

  // 대상 주소와 앱 글꼴 두 곳 밖의 요청은 막고 G6 로 보고한다.
  await context.route("**/*", (route) => {
    const request = route.request();
    let u;
    try {
      u = new URL(request.url());
    } catch {
      return route.continue();
    }
    if (u.origin === origin || FONT_HOSTS.includes(u.hostname)) return route.continue();
    blocked.add(request);
    issues.offOrigin.push(u.origin);
    return route.abort();
  });

  await context.addInitScript(
    ({ code: c, token: t }) => {
      try {
        window.localStorage.setItem("minifia:session", JSON.stringify({ code: c, token: t }));
      } catch {
        /* 저장소가 막힌 환경은 앱이 메모리로 대신한다 */
      }
    },
    { code, token },
  );
  // 맵 로비 테스트 훅(window.__mfWorld)과 소프트웨어 렌더러 허용은 ?e2e=1 세션 플래그가 켠다 — 주소를 바꾸지 않고 세션 저장소에만 쓴다(06-13).
  await context.addInitScript((key) => {
    try {
      window.sessionStorage.setItem(key, "1");
    } catch {
      /* 저장소가 막힌 환경은 훅이 꺼진 채로 둔다 — 로비 검사가 측정값 없음으로 실패한다 */
    }
  }, WORLD_HOOK_KEY);
  for (const script of initScripts) await context.addInitScript(script);
  if (preRoute) await preRoute(context);

  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const secrets = [token];

  page.on("console", (m) => {
    if (m.type() === "error") issues.console.push(redact(m.text(), secrets).slice(0, 120));
  });
  page.on("pageerror", (e) => issues.console.push(redact(String(e?.message ?? e), secrets).slice(0, 120)));
  page.on("requestfailed", (r) => {
    if (blocked.has(r)) return;
    let path = "";
    try {
      path = new URL(r.url()).pathname;
    } catch {
      /* 무시 */
    }
    issues.failed.push(`${r.method()} ${path} 실패`);
  });
  page.on("response", (r) => {
    if (r.status() < 400) return;
    let path = "";
    try {
      path = new URL(r.url()).pathname;
    } catch {
      /* 무시 */
    }
    issues.failed.push(`${r.request().method()} ${path} ${r.status()}`);
  });

  // 단계·직업은 페이지가 받은 state 프레임으로만 안다(원문을 찍지 않고, 보낸 프레임은 구독하지 않는다).
  const tracker = {
    view: null,
    seq: 0,
    last() {
      return this.view;
    },
    async waitFor(pred, ms, label) {
      const start = performance.now();
      for (;;) {
        const v = this.view;
        if (v !== null && pred(v)) return v;
        if (performance.now() - start > ms) throw new SetupError(`${label} (${ms / 1000}초 안에 도달하지 못함, 지금 단계 ${v?.phase ?? "없음"})`);
        await sleep(20);
      }
    },
  };
  // 로비 이동(06-17): 받은 world move 프레임(seat 별 마지막 구간 + 받은 시각)과 보낸 move 프레임의 시각만 센다 — 좌표 말고 토큰·신원은 싣지 않는다.
  tracker.moves = new Map();
  tracker.sentMoveAt = [];
  tracker.moveSeq = 0;
  page.on("websocket", (ws) => {
    ws.on("framesent", ({ payload }) => {
      try {
        const msg = JSON.parse(typeof payload === "string" ? payload : payload.toString("utf8"));
        if (msg && msg.t === "move") tracker.sentMoveAt.push(performance.now());
      } catch {
        /* 무시 */
      }
    });
    ws.on("framereceived", ({ payload }) => {
      let msg;
      try {
        msg = JSON.parse(typeof payload === "string" ? payload : payload.toString("utf8"));
      } catch {
        return;
      }
      if (msg && msg.t === "state" && msg.view) {
        tracker.view = msg.view;
        tracker.seq += 1;
      } else if (msg && msg.t === "world" && msg.k === "move" && typeof msg.s === "number") {
        tracker.moveSeq += 1;
        tracker.moves.set(msg.s, { p: msg.p, t0: msg.t0, v: msg.v, at: performance.now(), n: tracker.moveSeq });
      }
    });
  });

  await page.goto(`${origin}/r/${code}`, { waitUntil: "domcontentloaded" });
  if (guest) await tracker.waitFor((v) => v.phase === "lobby" && v.me?.isHost === false, 15_000, "손님으로 연결");
  else await tracker.waitFor((v) => v.phase === "lobby" && v.me?.isHost === true && v.me?.testMode === true, 15_000, "방장으로 연결");

  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    try {
      await document.fonts.load('24px "Gowun Dodum"', "낮 토론 직업 공개");
    } catch {
      /* 아래 검사가 실패로 보고한다 */
    }
    const faces = [...document.fonts].filter((f) => f.family.replace(/["']/g, "") === "Gowun Dodum");
    return { check: document.fonts.check('24px "Gowun Dodum"', "낮 토론 직업 공개"), loaded: faces.filter((f) => f.status === "loaded").length, total: faces.length };
  });

  return {
    context,
    page,
    tracker,
    fontOk: fonts.check && fonts.loaded > 0,
    fontDetail: `check ${fonts.check}, 불러온 글꼴 ${fonts.loaded}/${fonts.total}`,
    takeIssues() {
      const out = issues;
      issues = { console: [], failed: [], offOrigin: [] };
      return out;
    },
  };
}

/**
 * 세션 없이 링크 참가 화면을 여는 손님 컨텍스트(05-06, P5-4). openHostPage 와 같은 뷰포트·모바일 설정·대상 밖 요청 차단이지만
 * 세션 init 스크립트가 없어 앱이 `/r/{code}` 에서 링크 참가 화면을 띄운다. 참가하지 않고 토큰도 다루지 않는다 — 부른 쪽이 context 를 닫는다.
 * 돌려주는 값: { context, page }
 */
export async function openGuestJoinPage(browser, { origin, code, size, dpr = 2 }) {
  const context = await browser.newContext({
    viewport: { width: size.w, height: size.h },
    deviceScaleFactor: dpr,
    isMobile: true,
    hasTouch: true,
    locale: "ko-KR",
  });
  try {
    await context.route("**/*", (route) => {
      let u;
      try {
        u = new URL(route.request().url());
      } catch {
        return route.continue();
      }
      if (u.origin === origin || FONT_HOSTS.includes(u.hostname)) return route.continue();
      return route.abort();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    await page.goto(`${origin}/r/${code}`, { waitUntil: "domcontentloaded" });
    return { context, page };
  } catch (e) {
    await context.close().catch(() => {});
    throw e;
  }
}

/** 링크 참가 화면의 앉은 사람 수·문서 높이·`참가하기` 버튼 아래끝(UX2-J). 버튼이 없으면 buttonBottom 은 null. */
export async function readJoinFit(page) {
  return page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => (b.textContent ?? "").replace(/\s+/g, " ").trim() === "참가하기");
    return {
      seated: document.querySelectorAll("ul.mf-join__seated > li").length,
      docH: document.documentElement.scrollHeight,
      innerH: window.innerHeight,
      buttonBottom: btn ? btn.getBoundingClientRect().bottom : null,
    };
  });
}

/**
 * 지금 할 일 문장(UX1)과 문서 높이(UX2)를 한 번의 evaluate 로 읽는다(05-06). `[data-guide]` 목록은 글자(공백 정리)·헤더 안내줄 여부·높이·계산된 줄 높이,
 * 줄 높이가 normal 이면 글자 크기 × 1.4. 모양은 lib.mjs "5페이즈 계약" 의 guideChecks·docHeightChecks 입력과 같다.
 */
export async function readGuide(page) {
  return page.evaluate(() => {
    const items = [...document.querySelectorAll("[data-guide]")].map((el) => {
      const cs = getComputedStyle(el);
      const lh = parseFloat(cs.lineHeight);
      return {
        text: (el.textContent ?? "").replace(/\s+/g, " ").trim(),
        inHeader: el.closest(".mf-phasebar") !== null && el.classList.contains("mf-phasebar__do"),
        height: el.getBoundingClientRect().height,
        lineHeight: Number.isFinite(lh) ? lh : parseFloat(cs.fontSize) * 1.4,
      };
    });
    return {
      count: items.length,
      items,
      timers: document.querySelectorAll('[role="timer"]').length,
      docH: document.documentElement.scrollHeight,
      innerH: window.innerHeight,
    };
  });
}

// ---- 화면 조작 ----

const TT_LABEL = "테스트 도구";
const dialogOf = (page, label) => page.locator(`dialog[aria-label="${label}"]`);

export async function openTestSheet(page) {
  const dlg = dialogOf(page, TT_LABEL);
  if ((await dlg.count()) === 0) await page.locator(".mf-tt").click();
  await page.locator(`dialog[aria-label="${TT_LABEL}"].mf-dialog--open`).waitFor({ state: "attached", timeout: 5000 });
  await page.waitForTimeout(300);
}

export async function closeSheet(page, label = TT_LABEL) {
  const dlg = dialogOf(page, label);
  if ((await dlg.count()) === 0) return;
  await dlg.locator('[aria-label="닫기"]').click();
  await dlg.waitFor({ state: "detached", timeout: 3000 });
}

/** 열린 dialog 안의 버튼을 글자(부분 일치) 또는 aria-label 로 찾아 누른다. */
export async function clickInDialog(page, label, name) {
  await dialogOf(page, label).getByRole("button", { name }).first().click();
}

export async function settle(page) {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.waitForTimeout(350);
}

/**
 * H1: 헤더 제목·타이머 글씨 뒤의 실제 렌더 배경(막 포함)을 잰다.
 * (1) 제목(.mf-phasebar h1 · .mf-assign__bar h1 · .mf-lobby__header .mv-phase__title)과 타이머 숫자(.mf-timer__num)의 글자 사각형(Range)과 계산된 글자색을 읽고,
 * (2) 임시 <style> 로 그 글씨를 투명하게 하고(color·text-shadow·text-stroke) (3) 머리 영역을 스크린샷(CSS 1:1)으로 찍어 페이지에서 디코드(createImageBitmap + canvas, 새 패키지 없음)해
 * 글씨가 있던 사각형 안 픽셀을 평평한 RGB 로 돌려받고, (4) 임시 스타일을 지운다. 배경 휘도는 그 픽셀의 p95(lib.rgbP95Luminance).
 * 돌려주는 값: { items: [{ name, rect, color: [r,g,b], bgLum }] }. 제목이 보이지 않으면 null.
 */
export async function readHeaderContrast(page) {
  const probe = await page.evaluate(() => {
    const defs = [
      { name: "제목", sels: [".mf-phasebar h1", ".mf-assign__bar h1", ".mf-lobby__header .mv-phase__title", ".mf-game__header .mv-phase__title"] },
      { name: "타이머", sels: [".mf-timer__num"] },
    ];
    const items = [];
    const hide = [];
    for (const d of defs) {
      for (const sel of d.sels) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const range = document.createRange();
        range.selectNodeContents(el);
        const r = range.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) continue;
        const m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(getComputedStyle(el).color);
        items.push({ name: d.name, rect: { left: r.left, top: r.top, width: r.width, height: r.height }, color: m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null });
        hide.push(sel);
        break;
      }
    }
    if (items.length === 0) return null;
    const style = document.createElement("style");
    style.id = "__e2e_hide_glyphs";
    style.textContent = `${hide.map((s) => `${s}, ${s} *`).join(", ")} { color: transparent !important; text-shadow: none !important; -webkit-text-stroke: 0 !important; }`;
    document.head.appendChild(style);
    return { items, vw: window.innerWidth, vh: window.innerHeight };
  });
  if (probe === null) return null;
  try {
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const bottom = Math.max(...probe.items.map((i) => i.rect.top + i.rect.height));
    const clip = { x: 0, y: 0, width: probe.vw, height: Math.min(probe.vh, Math.ceil(bottom) + 4) };
    const png = await page.screenshot({ clip, scale: "css", type: "png" });
    const pixels = await page.evaluate(
      async ({ b64, rects, clip: c }) => {
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const bmp = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
        const canvas = document.createElement("canvas");
        canvas.width = bmp.width;
        canvas.height = bmp.height;
        const g = canvas.getContext("2d");
        g.drawImage(bmp, 0, 0);
        const k = bmp.width / c.width;
        return rects.map((r) => {
          const x0 = Math.max(0, Math.floor(r.left * k));
          const y0 = Math.max(0, Math.floor(r.top * k));
          const x1 = Math.min(bmp.width, Math.ceil((r.left + r.width) * k));
          const y1 = Math.min(bmp.height, Math.ceil((r.top + r.height) * k));
          if (x1 <= x0 || y1 <= y0) return [];
          const data = g.getImageData(x0, y0, x1 - x0, y1 - y0).data;
          const out = [];
          for (let i = 0; i < data.length; i += 4) out.push(data[i], data[i + 1], data[i + 2]);
          return out;
        });
      },
      { b64: png.toString("base64"), rects: probe.items.map((i) => i.rect), clip },
    );
    return { items: probe.items.map((i, n) => ({ name: i.name, rect: i.rect, color: i.color, bgLum: rgbP95Luminance(pixels[n]) })) };
  } finally {
    await page.evaluate(() => document.getElementById("__e2e_hide_glyphs")?.remove());
  }
}

export function shot(page, path) {
  return page.screenshot({ path });
}

/** 보이는 화면을 한 번의 evaluate 로 좌표 스냅숏으로 만든다. 입력 값은 싣지 않는다. */
export async function collectSnapshot(page) {
  const decorative = DECORATIVE_ALLOW.map((d) => d.selector).join(", ");
  const tapAllow = TAP_ALLOW.map((d) => d.selector).join(", ");
  const textAllow = TEXT_SIZE_ALLOW.map((d) => d.selector).join(", ");
  return page.evaluate(
    ({ decorative: deco, tapAllow: tapSel, textAllow: textSel }) => {
      const toRect = (r) => ({ left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom });
      const rectOf = (el) => (el ? toRect(el.getBoundingClientRect()) : null);
      const visible = (el) => {
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return false;
        const cs = getComputedStyle(el);
        return cs.display !== "none" && cs.visibility !== "hidden" && Number(cs.opacity) > 0.01;
      };
      const desc = (el) => {
        const cls = typeof el.className === "string" ? el.className.split(" ")[0] : "";
        const t = (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 20);
        return `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ""}${t ? `"${t}"` : ""}`;
      };
      const hitOf = (el, r) => {
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !!top && el.contains(top);
      };
      const q = (s) => document.querySelector(s);

      const elements = [];
      for (const el of document.body.querySelectorAll("*")) {
        if (el.tagName === "SCRIPT" || el.tagName === "STYLE") continue;
        if (deco && el.matches(deco)) continue;
        if (!visible(el)) continue;
        elements.push({ desc: desc(el), rect: rectOf(el), inTag: !!el.closest(".mf-world__tag") });
      }

      const interactive = [];
      for (const el of document.querySelectorAll('button, [role="button"], a[href], input, select, textarea')) {
        if (tapSel && el.matches(tapSel)) continue;
        if (!visible(el)) continue;
        const rect = rectOf(el);
        interactive.push({ desc: desc(el), rect, hit: hitOf(el, rect) });
      }

      const tt = q(".mf-tt");
      const stepper = q(".mf-tt-sheet__stepper");
      const ttSheet = q(".mf-tt-sheet");
      const stepBtn = (label) => {
        const b = q(`.mf-tt-sheet [aria-label="${label}"]`);
        if (!b) return null;
        const rect = rectOf(b);
        return { rect, hit: hitOf(b, rect), disabled: b.disabled === true };
      };

      // G7: 보이는 글자 중 14px 미만(허용 선택자 제외). 읽기 전용 안내(.mf-sr-only)는 화면에 보이지 않으므로 뺀다.
      const smallText = [];
      for (const el of document.body.querySelectorAll("*")) {
        if (el.tagName === "SCRIPT" || el.tagName === "STYLE") continue;
        if (el.closest(".mf-sr-only")) continue;
        if (textSel && el.matches(textSel)) continue;
        if (![...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent || "").trim() !== "")) continue;
        if (!visible(el)) continue;
        const size = parseFloat(getComputedStyle(el).fontSize);
        if (size < 14) smallText.push({ desc: desc(el), size });
      }

      return {
        vw: window.innerWidth,
        vh: window.innerHeight,
        docW: document.documentElement.scrollWidth,
        docH: document.documentElement.scrollHeight,
        bodyW: document.body.scrollWidth,
        elements,
        interactive,
        tt: tt ? { rect: rectOf(tt), hit: hitOf(tt, tt.getBoundingClientRect()) } : null,
        smallText,
        testSheet: ttSheet
          ? {
              sheet: rectOf(ttSheet),
              stepper: stepper ? [...stepper.children].map((c) => rectOf(c)) : [],
              minus: stepBtn("봇 줄이기"),
              plus: stepBtn("봇 늘리기"),
              countText: (q(".mf-tt-sheet__count")?.textContent || "").trim(),
            }
          : null,
      };
    },
    { decorative, tapAllow, textAllow },
  );
}

// ---- 맵 로비 읽기·조작 (06-17) ----

/**
 * 맵이 열리고(window.__mfWorld.status() === "ready") 방에 있는 사람 수만큼 이름표가 놓일 때(불투명도 > 0)까지 기다린다.
 * 훅이 없으면(?e2e 세션 플래그가 안 켜짐) 또는 시간 안에 안 열리면 준비 실패(SetupError) — 새 방으로 한 번 다시 돈다.
 */
export async function waitWorldReady(page, expectPlayers, ms = 20_000) {
  try {
    await page.waitForFunction(
      (n) => {
        const w = window.__mfWorld;
        if (!w || w.status() !== "ready") return false;
        const tags = [...document.querySelectorAll(".mf-world__tag")];
        return tags.length === n && tags.every((t) => Number(getComputedStyle(t).opacity) > 0.01);
      },
      expectPlayers,
      { timeout: ms },
    );
  } catch {
    const info = await page
      .evaluate(() => ({ hook: !!window.__mfWorld, status: window.__mfWorld?.status?.() ?? null, tags: document.querySelectorAll(".mf-world__tag").length }))
      .catch(() => ({ hook: false, status: null, tags: -1 }));
    throw new SetupError(`맵이 열리지 않음 (훅 ${info.hook}, 상태 ${info.status}, 이름표 ${info.tags}/${expectPlayers}, ${ms / 1000}초)`);
  }
}

/**
 * 맵 로비의 이름표·스테이지·링을 한 번의 evaluate 로 읽는다. 닉네임 글자는 이름표 검사(NT1)에만 쓰고 토큰은 싣지 않는다.
 * stage = 헤더 아래 ~ 아래 패널 위, 폭 전체(카메라가 내 캐릭터를 맞추는 사각형). tags: 이름표(.mv-tag) 사각형·글자 칸의 넘침·계산된 글자 크기·text-overflow·쌓임 순서(z)·면 색(face, .mv-tag 계산된 배경색).
 */
export async function readWorld(page) {
  return page.evaluate(() => {
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
    };
    const header = document.querySelector(".mf-lobby__header");
    const panel = document.querySelector(".mf-lobby__panel");
    const root = document.querySelector("[data-world-stage]");
    const tags = [...document.querySelectorAll(".mf-world__tag")].map((el) => {
      const tag = el.querySelector(".mv-tag");
      const name = el.querySelector(".mv-tag__name");
      const ncs = name ? getComputedStyle(name) : null;
      const tcs = tag ? getComputedStyle(tag) : null;
      const z = parseInt(getComputedStyle(el).zIndex, 10);
      return {
        seat: Number(el.getAttribute("data-seat")),
        me: el.getAttribute("data-me") === "true",
        away: el.getAttribute("data-away") === "true",
        text: (name?.textContent ?? "").trim(),
        rect: rect(tag ?? el),
        scrollWidth: name ? name.scrollWidth : null,
        clientWidth: name ? name.clientWidth : null,
        textOverflow: [ncs?.textOverflow, tcs?.textOverflow].filter(Boolean).join(","),
        fontSize: ncs ? parseFloat(ncs.fontSize) : null,
        z: Number.isFinite(z) ? z : Number.NaN,
        face: tcs ? tcs.backgroundColor : "",
        opacity: Number(getComputedStyle(el).opacity),
      };
    });
    return {
      vw: window.innerWidth,
      vh: window.innerHeight,
      stage: header && panel ? { left: 0, top: header.getBoundingClientRect().bottom, right: window.innerWidth, bottom: panel.getBoundingClientRect().top } : null,
      ring: root?.getAttribute("data-ring") ?? null,
      hook: !!window.__mfWorld,
      status: window.__mfWorld?.status?.() ?? null,
      seats: window.__mfWorld?.seats?.() ?? [],
      tags,
    };
  });
}

/**
 * 맵 로비 틀 한 장: 헤더 [나가기]·[공유], [시작] 버튼(상태·점), [테스트] 버튼, 상호작용 요소(겹침 검사용). 한 번의 evaluate.
 * rect+hit 는 가운데 점의 elementFromPoint 가 그 버튼 자신(또는 안쪽)인가.
 */
export async function readLobbyFrame(page) {
  return page.evaluate(() => {
    const toRect = (r) => ({ left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom });
    const boxOf = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { rect: toRect(r), hit: !!top && el.contains(top) };
    };
    const start = document.querySelector("[data-lobby-start]");
    const countEl = start ? start.querySelector(".mv-count") : null;
    return {
      header: { leave: boxOf(document.querySelector('.mf-lobby__header [aria-label="나가기"]')), share: boxOf(document.querySelector('.mf-lobby__header [aria-label="공유"]')) },
      start: start
        ? {
            ...boxOf(start),
            ariaDisabled: start.getAttribute("aria-disabled"),
            opacity: Number(getComputedStyle(start).opacity),
            countText: countEl ? (countEl.textContent ?? "").replace(/\s+/g, " ").trim() : null,
            label: start.getAttribute("aria-label") ?? "",
          }
        : null,
      test: boxOf(document.querySelector(".mf-lobby__test .mf-tt")),
      title: (document.querySelector(".mf-lobby__header .mv-phase__title")?.textContent ?? "").trim(),
      hasRoomCodeOutsideSheet: !!document.querySelector(".mf-lobby__code"),
    };
  });
}

/**
 * 채팅 입력칸에 글을 쓰고 [보내기] 를 누른다(07-13). 값은 fill 로 한 번에 넣는다 — 한글 조합 이벤트는 만들지 않는다(실제 IME 는 07-19 몫).
 * 보내기 버튼이 활성(aria-disabled "false")이 될 때까지 기다린 뒤 누르므로, 글자가 React 상태에 닿기 전에 누르는 일이 없다.
 */
export async function typeAndSendChat(page, text) {
  await page.locator("[data-chat-input]").fill(text);
  await page.waitForSelector('[data-chat-send][aria-disabled="false"]', { timeout: 3000 });
  await page.locator("[data-chat-send]").click({ timeout: 3000 });
}

/**
 * 실제 IME 경로로 한글 조합을 흉내 낸다(07-19, CHAT-05). Chromium CDP `Input.imeSetComposition` 으로 조합 글자를 바꾸고 `Input.insertText` 로 확정한다.
 * steps 의 문자열은 "조합 중인 글자"(imeSetComposition), `{ commit: "안" }` 은 그 글자로 조합을 확정(insertText)한다. 입력칸에 포커스가 있어야 한다.
 * 한 호출에 CDP 세션 하나를 열고 닫는다 — 조합 상태는 페이지 쪽에 있어서 호출 사이에도 이어진다.
 */
export async function imeCompose(page, steps) {
  const cdp = await page.context().newCDPSession(page);
  try {
    for (const step of steps) {
      if (typeof step === "string") await cdp.send("Input.imeSetComposition", { text: step, selectionStart: step.length, selectionEnd: step.length });
      else await cdp.send("Input.insertText", { text: step.commit });
    }
  } finally {
    await cdp.detach().catch(() => {});
  }
}

/**
 * 조합 중 Enter(07-19): 조합이 끝나기 전의 Enter 는 keyCode 229(isComposing)라 submit 을 만들지 않는다(리서치 실측).
 * 이어서 `commit` 으로 마지막 조합을 확정하고, 확정 뒤 Enter 를 한 번 눌러 form 을 제출한다. 반환 전에 제출 여부는 읽지 않는다.
 */
export async function imeEnter(page, commit) {
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 229 });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 229 });
    await cdp.send("Input.insertText", { text: commit });
  } finally {
    await cdp.detach().catch(() => {});
  }
  await page.keyboard.press("Enter");
}

/**
 * 채팅 기록 칸의 사람 줄을 읽는다: [{ seat, ch, name, text }] (시스템 줄·막힘 알림은 싣지 않는다). 칸이 없으면 null.
 * 이름은 줄 안 .mv-chat__name 글자("나" 또는 닉네임), 본문은 .mv-chat__text 글자다.
 */
export function readChatLines(page) {
  return page.evaluate(() => {
    const log = document.querySelector("[data-chat-log]");
    if (!log) return null;
    return [...log.querySelectorAll(".mv-chat__msg")].map((p) => ({
      seat: p.getAttribute("data-seat"),
      ch: p.getAttribute("data-ch"),
      name: (p.querySelector(".mv-chat__name")?.textContent ?? "").trim(),
      text: (p.querySelector(".mv-chat__text")?.textContent ?? "").trim(),
    }));
  });
}

/** 기록 칸에 본문이 text 인 사람 줄이 생길 때까지 기다린다. 시간 안에 안 오면 던진다(오류 메시지에 본문은 싣지 않는다). */
export async function waitChatLine(page, text, ms = 5000) {
  try {
    await page.waitForFunction((t) => [...document.querySelectorAll("[data-chat-log] .mv-chat__msg .mv-chat__text")].some((el) => (el.textContent ?? "").trim() === t), text, { timeout: ms });
  } catch {
    throw new Error(`채팅 줄이 ${ms / 1000}초 안에 오지 않음`);
  }
}

/**
 * 로비 채팅 패널의 치수(07-13): 방 높이(.mf-lobby)·패널(.mf-lobby__panel)·기록 칸·입력칸·보내기·스테이지 사각형 아래 끝(= 패널 위 끝).
 * 한 번의 evaluate. 칸이 없으면 null. UI-SPEC 폰 크기 표와 견주는 판정은 flows.mjs 가 한다.
 */
export function readChatPanel(page) {
  return page.evaluate(() => {
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom, hit: !!top && el.contains(top) };
    };
    const room = document.querySelector(".mf-lobby");
    const panel = document.querySelector(".mf-lobby__panel");
    const log = document.querySelector("[data-chat-log]");
    const input = document.querySelector("[data-chat-input]");
    const send = document.querySelector("[data-chat-send]");
    const header = document.querySelector(".mf-lobby__header");
    if (!room || !panel || !log || !input || !send) return null;
    return {
      roomH: room.getBoundingClientRect().height,
      panel: box(panel),
      log: box(log),
      input: box(input),
      inputFont: parseFloat(getComputedStyle(input).fontSize),
      send: box(send),
      stageTop: header ? header.getBoundingClientRect().bottom : null,
      stageBottom: panel.getBoundingClientRect().top,
    };
  });
}

/**
 * 가상 키보드 페이지 init 스크립트(07-19, CHAT-05, 시험 컨텍스트에만 들어간다, 함수라 직렬화되므로 바깥 값을 쓰지 않는다).
 * 1) window.visualViewport 를 height·offsetTop 을 조종할 수 있는 EventTarget 가짜로 바꾼다. `window.__mfVv.set(height, offsetTop)` 이 값을 바꾸고
 *    resize(offsetTop 이 바뀌면 scroll 도) 이벤트를 보낸다. 실제 iOS·Android 키보드를 흉내 내지 못한다 — 앱의 배치 식만 시험한다(가정 A1, 실기기는 07-21).
 * 2) window.__mfRo: `arm()` 이 캔버스 호스트(.mf-world__canvas)에 ResizeObserver 를 건다. 처음 관찰 직후의 호출은 세지 않고 그 뒤 호출을 calls 에 센다.
 *    앱은 캔버스 크기를 ResizeObserver 로 보지 않으므로(프레임마다 읽는다) 이 기록기가 "키보드 때문에 캔버스 크기가 바뀌었는가" 의 독립된 눈이다.
 */
export function installFakeViewport() {
  const vv = new EventTarget();
  const state = { height: null, offsetTop: 0 };
  Object.defineProperties(vv, {
    width: { get: () => window.innerWidth },
    height: { get: () => (state.height === null ? window.innerHeight : state.height) },
    offsetTop: { get: () => state.offsetTop },
    offsetLeft: { value: 0 },
    pageTop: { get: () => state.offsetTop + window.scrollY },
    pageLeft: { value: 0 },
    scale: { value: 1 },
  });
  Object.defineProperty(window, "visualViewport", { value: vv, configurable: true });
  window.__mfVv = {
    set(height, offsetTop = 0) {
      const topChanged = state.offsetTop !== offsetTop;
      state.height = height;
      state.offsetTop = offsetTop;
      vv.dispatchEvent(new Event("resize"));
      if (topChanged) vv.dispatchEvent(new Event("scroll"));
    },
    get: () => ({ height: vv.height, offsetTop: vv.offsetTop }),
  };
  window.__mfRo = {
    calls: 0,
    armed: false,
    arm() {
      const host = document.querySelector(".mf-world__canvas");
      if (!host || this.armed) return !!host;
      this.armed = true;
      let first = true;
      new ResizeObserver(() => {
        if (first) {
          first = false;
          return;
        }
        this.calls += 1;
      }).observe(host);
      return true;
    },
  };
}

/**
 * 가상 키보드 검사용 한 장(07-19): 가짜 visualViewport 값, 로비 루트의 열림 표식, 패널·입력줄·기록 칸·행동 줄, 캔버스 크기(호스트와 안쪽 canvas), ResizeObserver 호출 수,
 * 내 캐릭터 발의 화면 좌표(sample → screenOf)와 내 이름표(입력 중 칸 포함) 사각형, 스테이지 사각형(헤더 아래 ~ 패널 위). 한 번의 evaluate.
 * mySeat = 내 자리. 로비가 없으면 null.
 */
export function readKeyboardState(page, mySeat) {
  return page.evaluate((seat) => {
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
    };
    const root = document.querySelector("main.mf-lobby");
    const panel = document.querySelector(".mf-lobby__panel");
    const header = document.querySelector(".mf-lobby__header");
    const input = document.querySelector("[data-chat-input]");
    const host = document.querySelector(".mf-world__canvas");
    const canvas = host?.querySelector("canvas") ?? null;
    if (!root || !panel || !input) return null;
    const vv = window.__mfVv ? window.__mfVv.get() : null;
    const pos = window.__mfWorld ? window.__mfWorld.sample(seat) : null;
    const feet = pos && window.__mfWorld ? window.__mfWorld.screenOf(pos.x, pos.z) : null;
    const tagEl = document.querySelector(`.mf-world__tag[data-seat="${seat}"] .mv-tag`);
    const stackEl = document.querySelector(`.mf-world__tag[data-seat="${seat}"] .mv-head`);
    return {
      innerHeight: window.innerHeight,
      vv,
      kbOpen: root.getAttribute("data-kb-open"),
      lift: root.parentElement ? getComputedStyle(root.closest(".mf-room") ?? root).getPropertyValue("--mf-kb-lift").trim() : "",
      focusOnInput: document.activeElement === input,
      panel: rect(panel),
      input: rect(input),
      send: rect(document.querySelector("[data-chat-send]")),
      log: rect(document.querySelector("[data-chat-log]")),
      headerBottom: header ? header.getBoundingClientRect().bottom : null,
      headerTop: header ? header.getBoundingClientRect().top : null,
      actionButtons: panel.querySelectorAll("button:not([data-chat-send]):not([data-chat-newdot])").length,
      host: host ? { w: host.clientWidth, h: host.clientHeight } : null,
      canvas: canvas ? { attrW: canvas.width, attrH: canvas.height, cssW: canvas.clientWidth, cssH: canvas.clientHeight } : null,
      roCalls: window.__mfRo ? window.__mfRo.calls : null,
      pos,
      feet,
      tag: rect(tagEl),
      stack: rect(stackEl),
      typing: !!document.querySelector(`.mf-world__tag[data-seat="${seat}"] [data-typing="true"]`),
      ring: document.querySelector("[data-world-stage]")?.getAttribute("data-ring") ?? null,
      scrollY: window.scrollY,
    };
  }, mySeat);
}

/** 서버 시각 t 의 seat 위치(월드 단위). 훅이 없거나 아직 구간이 없으면 null. */
export function sampleWorld(page, seat, t) {
  return page.evaluate(({ s, tt }) => (window.__mfWorld ? window.__mfWorld.sample(s, tt) : null), { s: seat, tt: t });
}

/** 월드 점들 → 화면 px (카메라가 지금 있는 자리 기준). 훅이 없으면 null 목록. */
export function screensOfWorld(page, points) {
  return page.evaluate((pts) => pts.map((p) => (window.__mfWorld ? window.__mfWorld.screenOf(p.x, p.z) : null)), points);
}

/** 화면 점 위의 맨 위 요소가 맵 입력 면(.mf-world__input)인가 — 헤더·패널·버튼에 가려진 점을 목적지로 고르지 않으려고. */
export function hitsInputSurface(page, points) {
  return page.evaluate(
    (pts) =>
      pts.map((p) => {
        const el = document.elementFromPoint(p.sx, p.sy);
        return !!el && el.classList.contains("mf-world__input");
      }),
    points,
  );
}

/**
 * 월드 점 (x, z) 를 화면에서 한 번 누른다(screenOf → 마우스 탭: 눌렀다 바로 뗌).
 * 페이지 안에서 손 뗌(pointerup) 시각과 data-ring 이 새로 생기는 시각을 MutationObserver 로 재서 ringMs 를 돌려주고,
 * 손 뗌 직전(Node 시계)부터 내 구간 move 프레임이 tracker 에 들어올 때까지를 segmentMs 로 돌려준다(상한 3초, 못 받으면 null).
 * 돌려주는 값: { sx, sy, ringMs, segmentMs, move }  (move = 받은 구간 { p, t0, v, at })
 * 같은 evaluate 에서 내 캐릭터의 화면 위치(__mfWorld.shown)를 프레임마다 모으기 시작한다 — readWalkWatch 로 읽는다(W11·W12).
 */
export async function tapWorld(page, tracker, mySeat, x, z) {
  const pt = await page.evaluate(({ px, pz }) => (window.__mfWorld ? window.__mfWorld.screenOf(px, pz) : null), { px: x, pz: z });
  if (!pt) throw new SetupError("screenOf 를 쓸 수 없음(맵 훅 없음 또는 렌더러 없음)");
  const beforeN = tracker.moves.get(mySeat)?.n ?? 0;
  await page.evaluate((seatOfMe) => {
    const root = document.querySelector("[data-world-stage]");
    window.__tapWatch?.obs?.disconnect();
    if (window.__walkWatch) window.__walkWatch.stop = true;
    const w = { up: null, ring: null, prev: root?.getAttribute("data-ring") ?? null, obs: null };
    window.__tapWatch = w;
    // 화면 위치 감시(결정 0059): 프레임마다 내 캐릭터가 마지막 프레임에 그린 위치를 모은다. upWall = 손 뗌의 Date.now()
    const ww = { upWall: null, frames: [], stop: false };
    window.__walkWatch = ww;
    const startedAt = Date.now();
    let lastAt = null;
    const loop = () => {
      if (ww.stop) return;
      const nowMs = Date.now();
      if (nowMs - startedAt > 5000 || (ww.upWall !== null && nowMs - ww.upWall > 1500)) {
        ww.stop = true;
        return;
      }
      const s = window.__mfWorld?.shown(seatOfMe);
      if (s && s.at !== lastAt) {
        lastAt = s.at;
        ww.frames.push({ x: s.x, z: s.z, at: s.at });
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    document.addEventListener(
      "pointerup",
      (e) => {
        w.up = e.timeStamp;
        ww.upWall = Date.now();
      },
      { capture: true, once: true },
    );
    w.obs = new MutationObserver(() => {
      const v = root?.getAttribute("data-ring") ?? null;
      if (w.ring === null && v !== null && v !== w.prev) w.ring = performance.now();
    });
    if (root) w.obs.observe(root, { attributes: true, attributeFilter: ["data-ring"] });
  }, mySeat);
  await page.mouse.move(pt.sx, pt.sy);
  await page.mouse.down();
  const upAt = performance.now();
  await page.mouse.up();
  let move = null;
  const deadline = performance.now() + 3000;
  while (performance.now() < deadline) {
    const m = tracker.moves.get(mySeat);
    if (m && m.n > beforeN) {
      move = m;
      break;
    }
    await sleep(5);
  }
  await sleep(30);
  const watch = await page.evaluate(() => {
    const w = window.__tapWatch;
    w?.obs?.disconnect();
    return w ? { up: w.up, ring: w.ring } : null;
  });
  const ringMs = watch && typeof watch.up === "number" && typeof watch.ring === "number" ? watch.ring - watch.up : null;
  return { sx: pt.sx, sy: pt.sy, ringMs, segmentMs: move ? Math.max(0, move.at - upAt) : null, move };
}

/** tapWorld 가 심은 화면 위치 감시를 멈추고 { upWall, frames: [{ x, z, at }] } 를 돌려준다(없으면 null). */
export async function readWalkWatch(page) {
  return page.evaluate(() => {
    const w = window.__walkWatch;
    if (!w) return null;
    w.stop = true;
    return { upWall: w.upWall, frames: w.frames.slice() };
  });
}

/** 최선 노력으로 대기실 [나가기] → 확인 [나가기] 를 눌러 방을 지운다. 실패는 무시한다. */
export async function leaveLobby(page) {
  try {
    await page.locator('[aria-label="나가기"]').first().click({ timeout: 3000 });
    await dialogOf(page, "방에서 나갈까요?").getByRole("button", { name: "나가기" }).click({ timeout: 3000 });
    await page.waitForTimeout(300);
  } catch {
    /* 정리 실패는 결과에 넣지 않는다 */
  }
}

// ---- 재접속·예산 도우미 (06-18) ----

/**
 * 재접속 흐름의 페이지 init 스크립트(시험 컨텍스트에만 들어간다, 함수라 직렬화되므로 바깥 값을 쓰지 않는다):
 *  1) window.WebSocket 을 감싸 만들어진 소켓을 window.__e2eSockets 에 모은다 — 헤드리스 Chrome 은 오프라인 전환만으로 이미 열린 소켓을 끊지 않으므로(06-18 에서 잼)
 *     시험이 setOffline(true) 와 함께 소켓을 닫아 네트워크 단절을 흉내 낸다. 배포 서버는 클라이언트 Close 프레임에 약 10초 뒤에야 답하므로
 *     합성 close 로 앱이 즉시 끊김을 알게 한다(dropSockets, 06-23). 앱 코드는 바뀌지 않는다.
 *  2) 위쪽 토스트(.mv-toast.is-on)가 켜질 때마다 글자를 window.__e2eToasts 에 쌓는다(복구 뒤 지난 입장·퇴장 알림이 다시 뜨는지 보려고).
 */
export function reconnectInit() {
  const Native = window.WebSocket;
  const sockets = (window.__e2eSockets = []);
  function Wrapped(...args) {
    const ws = new Native(...args);
    sockets.push(ws);
    return ws;
  }
  Wrapped.prototype = Native.prototype;
  for (const k of ["CONNECTING", "OPEN", "CLOSING", "CLOSED"]) Wrapped[k] = Native[k];
  window.WebSocket = Wrapped;

  const toasts = (window.__e2eToasts = []);
  let wasOn = false;
  let lastText = "";
  const watch = () => {
    new MutationObserver(() => {
      const el = document.querySelector(".mv-toast.is-on");
      const text = (el?.textContent ?? "").trim();
      if (el && (!wasOn || text !== lastText) && text !== "") toasts.push(text);
      wasOn = !!el;
      lastText = text;
    }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
  };
  if (document.documentElement) watch();
  else document.addEventListener("DOMContentLoaded", watch);
}

/** 페이지의 warning·error 콘솔 메시지를 모은다(재접속 흐름의 RC1). take() 가 모은 것을 돌려주고 비운다. 어떤 것을 허용하는지는 lib.mjs 의 consoleIssues 가 정한다. */
export function consoleCollector(page) {
  let entries = [];
  const onConsole = (m) => {
    const type = m.type();
    if (type === "warning" || type === "error") entries.push({ type, text: m.text() });
  };
  const onPageError = (e) => entries.push({ type: "error", text: String(e?.message ?? e) });
  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  return {
    take() {
      const out = entries;
      entries = [];
      return out;
    },
    stop() {
      page.off("console", onConsole);
      page.off("pageerror", onPageError);
    },
  };
}

/** CDP 로 페이지 수명 상태를 바꾼다("frozen" | "active") — 화면을 껐다 켠 것처럼. */
export async function setLifecycle(page, state) {
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send("Page.setWebLifecycleState", { state });
  } finally {
    await cdp.detach().catch(() => {});
  }
}

/**
 * 오프라인 흉내의 절반: 앱의 방 소켓(/api/rooms/…/ws)만 닫는다(reconnectInit 이 있어야 한다). 건드린 소켓 수를 돌려준다.
 * 배포 서버는 클라이언트 Close 프레임에 약 10초 뒤에야 답하므로(진단: reconnect-banner-deployed), ws.close() 만 부르면 앱이 끊김을 곧바로 알지 못한다.
 * 그래서 합성 close 이벤트(code 1006, wasClean false)를 먼저 dispatch 해 앱이 즉시 끊김을 알게 하고, 그다음 ws.close() 를 부른다(순서 고정).
 * 개발 서버의 vite HMR 소켓은 건드리지 않는다 — 닫으면 vite 클라이언트가 서버를 다시 찾아 페이지를 새로 불러온다(06-18 에서 잼).
 */
export function dropSockets(page) {
  return page.evaluate(() => {
    const list = window.__e2eSockets ?? [];
    let n = 0;
    for (const ws of list) {
      if (!String(ws.url).includes("/api/rooms/")) continue;
      if (ws.readyState === 0 || ws.readyState === 1) {
        ws.dispatchEvent(new CloseEvent("close", { code: 1006, wasClean: false }));
        ws.close();
        n += 1;
      }
    }
    return n;
  });
}

/** 재접속 상태 한 장: 띠·맵 카드·맵 상태·캔버스 수·토스트 켜짐·마지막 소켓이 열려 있나·앱 방 소켓 총수(roomSockets, 재연결하면 늘어난다)·쌓인 토스트. 페이지가 다시 불러오는 중이라 읽지 못하면 null. */
export async function readLinkState(page) {
  try {
    return await page.evaluate(() => ({
      banners: document.querySelectorAll(".mf-reconnect").length,
      banner: document.querySelector(".mf-reconnect")?.textContent ?? null,
      cards: document.querySelectorAll(".mf-mapcard").length,
      card: document.querySelector(".mf-mapcard")?.textContent ?? null,
      status: window.__mfWorld?.status?.() ?? null,
      hook: !!window.__mfWorld,
      canvases: document.querySelectorAll(".mf-world__canvas canvas").length,
      toastOn: !!document.querySelector(".mv-toast.is-on"),
      lastSocketOpen: (() => {
        const list = (window.__e2eSockets ?? []).filter((ws) => String(ws.url).includes("/api/rooms/"));
        return list.length > 0 && list[list.length - 1].readyState === 1;
      })(),
      roomSockets: (window.__e2eSockets ?? []).filter((ws) => String(ws.url).includes("/api/rooms/")).length,
      toasts: [...(window.__e2eToasts ?? [])],
    }));
  } catch {
    return null;
  }
}

/** 쌓인 토스트 기록을 비운다. */
export function clearToasts(page) {
  return page.evaluate(() => {
    if (window.__e2eToasts) window.__e2eToasts.length = 0;
  });
}

/**
 * 맵 캔버스만 찍어(겹쳐 얹힌 가림막·이름표·헤더는 가려서) 색 통계를 낸다 — 복구 뒤 첫 프레임이 바탕색 한 가지가 아닌지 보려고(RESEARCH A9).
 * 돌려주는 값: { distinct (4비트로 줄인 서로 다른 색 수), dominantShare (가장 흔한 색의 비율) } 또는 캔버스가 없으면 null.
 */
export async function readPaintStats(page) {
  const canvas = page.locator(".mf-world__canvas canvas").first();
  if ((await canvas.count()) === 0) return null;
  const png = await canvas.screenshot({ style: ".mf-lobby__scrim,.mf-world__tags,.mf-world__input,.mf-lobby__header,.mf-lobby__panel,.mf-lobby__test,.mv-toast,.mf-reconnect,.mf-mapcard{visibility:hidden !important}", timeout: 5000 });
  const b64 = png.toString("base64");
  return page.evaluate(async (data) => {
    const blob = await (await fetch(`data:image/png;base64,${data}`)).blob();
    const bmp = await createImageBitmap(blob);
    const c = document.createElement("canvas");
    c.width = bmp.width;
    c.height = bmp.height;
    const ctx = c.getContext("2d");
    ctx.drawImage(bmp, 0, 0);
    const px = ctx.getImageData(0, 0, c.width, c.height).data;
    const counts = new Map();
    let total = 0;
    for (let i = 0; i < px.length; i += 12) {
      const key = ((px[i] >> 4) << 8) | ((px[i + 1] >> 4) << 4) | (px[i + 2] >> 4);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      total += 1;
    }
    const top = Math.max(...counts.values());
    return { distinct: counts.size, dominantShare: total === 0 ? 1 : top / total };
  }, b64);
}

/**
 * 성능 스파이크 페이지(?perf=1…)를 세션 없이 새 컨텍스트로 연다. openHostPage 와 같은 뷰포트·모바일 설정·대상 밖 요청 차단.
 * 돌려주는 값: { context, page, console } — console 은 consoleCollector. 부른 쪽이 context 를 닫는다.
 */
export async function openPerfPage(browser, { origin, size, query, dpr = 1 }) {
  const context = await browser.newContext({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true, locale: "ko-KR" });
  try {
    await context.route("**/*", (route) => {
      let u;
      try {
        u = new URL(route.request().url());
      } catch {
        return route.continue();
      }
      if (u.origin === origin || FONT_HOSTS.includes(u.hostname)) return route.continue();
      return route.abort();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    const collector = consoleCollector(page);
    await page.goto(`${origin}/?${query}`, { waitUntil: "domcontentloaded" });
    return { context, page, console: collector };
  } catch (e) {
    await context.close().catch(() => {});
    throw e;
  }
}

/** 게임 중(또는 역할 확인 중)에서 [테스트] 시트의 [대기실로 되돌리기] 를 눌러 대기실로 돌아온다(방은 남는다). */
export async function backToLobby(page, tracker) {
  await openTestSheet(page);
  await clickInDialog(page, TT_LABEL, "대기실로 되돌리기");
  await tracker.waitFor((v) => v.phase === "lobby", 5000, "대기실 복귀");
  await page.waitForTimeout(300);
}

// ---- 게임 흐름 조작(과제 2) ----

const stepTo = async (tracker, pred, label) => tracker.waitFor(pred, 3000, label);

/** 시트가 열려 있어야 한다. [5명 채우기] 뒤 [+]/[−] 로 봇 수를 맞추며 매번 추적 me.testBots 변화를 기다린다. */
export async function setBots(page, tracker, count) {
  let cur = tracker.last()?.me?.testBots ?? 0;
  // [5명 채우기] 는 방을 5명으로 채우는 버튼이라 사람이 방장 하나일 때만 봇 4명이 된다(사람 손님이 있으면 [+] 로만 맞춘다, 08-24)
  const humans = (tracker.last()?.players?.length ?? 1) - cur;
  if (cur < 4 && count >= 3 && humans <= 1) {
    await clickInDialog(page, TT_LABEL, "5명 채우기");
    await stepTo(tracker, (v) => v.me.testBots === 4, "봇 4명(5명 채우기)");
    cur = 4;
  }
  while (cur < count) {
    await clickInDialog(page, TT_LABEL, "봇 늘리기");
    cur += 1;
    await stepTo(tracker, (v) => v.me.testBots === cur, `봇 ${cur}명`);
  }
  while (cur > count) {
    await clickInDialog(page, TT_LABEL, "봇 줄이기");
    cur -= 1;
    await stepTo(tracker, (v) => v.me.testBots === cur, `봇 ${cur}명`);
  }
}

/** 시트가 열려 있어야 한다. 내 직업 칩을 눌러 me.testRole 을 확인한다. */
export async function chooseRole(page, tracker, role) {
  await page.locator(".mf-tt-sheet__roles").getByRole("button", { name: ROLE_NAME[role], exact: true }).click();
  await stepTo(tracker, (v) => v.me.testRole === role, `내 직업 ${role} 지정`);
}

/**
 * 시트를 닫고 [게임 시작] 을 눌러 역할 확인(roleReveal)까지 기다린다.
 * onAssigning 이 있으면 역할 배정(3초 창)이 잡혔을 때 화면이 그려지고 300ms 뒤 한 번만 부른다(readStage 하나만 하는 짧은 일).
 * 배정이 이미 지났으면 건너뛴다 — 실패가 아니다.
 */
export async function startGame(page, tracker, { onAssigning } = {}) {
  await closeSheet(page);
  await page.locator("[data-lobby-start]").click();
  if (onAssigning) {
    let caught = false;
    try {
      await tracker.waitFor((v) => v.phase === "assigning", 3000, "역할 배정 도달");
      await page.waitForSelector(".mf-assign__scene .mf-dt__felt", { timeout: 2000 });
      await page.waitForTimeout(300);
      caught = tracker.last()?.phase === "assigning";
    } catch {
      caught = false;
    }
    if (caught) await onAssigning();
  }
  await tracker.waitFor((v) => v.phase === "roleReveal", 8000, "역할 확인 도달");
}

/**
 * 시트를 열어 둔 채 [다음 단계로 넘기기] 를 눌러 목표 단계까지 간다. 진행 신호를 「단계 또는 마감 시각이 바뀜」으로 잡고
 * 상한을 24 로 둔다(여유 있는 상한 — 단계는 한 번에 하나씩 넘어간다). 끝나면 시트를 닫는다.
 */
export async function skipTo(page, tracker, phase) {
  await openTestSheet(page);
  for (let i = 0; i < 24; i++) {
    const before = tracker.last()?.phase;
    const beforeEnds = tracker.last()?.phaseEndsAt;
    if (before === phase) break;
    await clickInDialog(page, TT_LABEL, "다음 단계로 넘기기");
    await tracker.waitFor((v) => v.phase !== before || v.phaseEndsAt !== beforeEnds, 3000, `${before} 다음 단계 (목표 ${phase})`);
  }
  if (tracker.last()?.phase !== phase) throw new SetupError(`목표 단계 ${phase} 에 도달하지 못함 (지금 ${tracker.last()?.phase})`);
  await closeSheet(page);
}

export async function openRoleCard(page) {
  if ((await dialogOf(page, "역할 카드").count()) === 0) await page.locator(".mf-rolecard-btn").click();
  await page.locator('dialog[aria-label="역할 카드"].mf-dialog--open').waitFor({ state: "attached", timeout: 5000 });
  await page.waitForTimeout(300);
}

/** 열린 역할 카드의 탭을 이름(부분 일치: 점이 있으면 「활동 기록, 새 기록」)으로 누른다. */
export async function selectRoleCardTab(page, name) {
  await dialogOf(page, "역할 카드").getByRole("tab", { name }).click();
  await page.waitForTimeout(300);
}

export async function closeRoleCard(page) {
  await closeSheet(page, "역할 카드");
}

/** 최선 노력: 열린 시트를 닫고 [대기실로 되돌리기] → 대기실에서 [나가기]. 실패는 무시한다. */
export async function resetAndLeave(page, tracker) {
  try {
    const open = await page.evaluate(() => [...document.querySelectorAll("dialog[open]")].map((d) => d.getAttribute("aria-label") ?? ""));
    for (const label of open) if (label === "역할 카드" || label.endsWith(" 기록")) await closeSheet(page, label).catch(() => {});
    await openTestSheet(page);
    await clickInDialog(page, TT_LABEL, "대기실로 되돌리기");
    await tracker.waitFor((v) => v.phase === "lobby", 3000, "대기실 복귀");
    await page.waitForTimeout(300);
  } catch {
    /* 정리 실패는 결과에 넣지 않는다 */
  }
  await leaveLobby(page);
}

// ---- 조작·관찰·표본 ----

/**
 * 테스트 시트가 열려 있어야 한다(대기실에서만 그룹이 보인다). 값은 프로토콜 값이다:
 * exec(봇 찬반 그룹) = "random"|"yes"|"no" (무작위|모두 찬성|모두 반대), pick(봇 지목 그룹) = "random"|"host"|"other" (무작위|방장|방장 아닌 사람).
 * 두 그룹의 칩을 누르고 view 의 me.testBotVote 가 기대와 같아질 때까지 기다린다(둘 다 random 이면 키가 없다).
 */
export async function setBotVote(page, tracker, { exec = "random", pick = "random" } = {}) {
  const execLabel = { random: "무작위", yes: "모두 찬성", no: "모두 반대" }[exec];
  const pickLabel = { random: "무작위", host: "방장", other: "방장 아닌 사람" }[pick];
  if (execLabel === undefined || pickLabel === undefined) throw new Error(`setBotVote 값이 올바르지 않음: exec=${exec}, pick=${pick}`);
  const press = (group, label) => dialogOf(page, TT_LABEL).getByRole("group", { name: group, exact: true }).getByRole("button", { name: label, exact: true }).click();
  const want = (v) => {
    const cur = v.me.testBotVote;
    return exec === "random" && pick === "random" ? cur === undefined : cur?.exec === exec && cur?.pick === pick;
  };
  // 한쪽을 먼저 누르면 다른 쪽은 현재 서버 값과 합쳐 보내진다 — 각 클릭 뒤 서버 반영을 기다려 순서를 지킨다
  await press("봇 찬반", execLabel);
  await tracker.waitFor((v) => (v.me.testBotVote?.exec ?? "random") === exec, 3000, `봇 찬반 ${exec}`);
  await press("봇 지목", pickLabel);
  await tracker.waitFor(want, 3000, `봇 투표 고정 ${exec}/${pick}`);
}

/** 그 점을 터치로 탭한다(vote5 문맥은 hasTouch). */
export async function tapAt(page, pt) {
  await page.touchscreen.tap(pt.x, pt.y);
}


// ---- 맵 게임 화면 읽기·조작 (08-24, DAY-03~07·GHOST-01·02) ----
// 읽기는 한 번의 evaluate 로 끝낸다. 닉네임·글은 싣지 않고(이름표 글자는 제외) 검사에 필요한 개수·사각형·data-* 값만 싣는다.

/**
 * 게임 맵 화면 한 장: 루트 data-game-stage 가 없으면 null.
 * { phase, ghostView, kbOpen, title, guide: { count, text }, header, stage, panel(사각형), chatChannel, hasInput, end: { present, pressed, on, total } | null,
 *   verdictRow: { hasPicker, hasCount, on, total } | null, verdictBtns, picks: [{ seat, rect, pressed, label }], tags: [{ seat, me, count, lead, sure, mine, done, ring, ghostSeat, roleChip, opacity }],
 *   announce: { text, fontPx, lineCount, wordBreak } | null, counts: { ghostView, roleChips, ghostSeats, ghostTexts }, ring, testButton, nightPanel }
 */
export async function readGame(page) {
  return page.evaluate(() => {
    const q = (s, r = document) => r.querySelector(s);
    const qa = (s, r = document) => [...r.querySelectorAll(s)];
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
    };
    const root = q("[data-game-stage]");
    if (!root) return null;
    // 숫자 '현재 / 최대'(.mv-count)를 읽는다. 모양이 다르면 null
    const count = (scope) => {
      const m = /^(\d+) \/ (\d+)$/.exec((q(".mv-count", scope)?.textContent ?? "").replace(/\s+/g, " ").trim());
      return m ? { on: Number(m[1]), total: Number(m[2]) } : null;
    };
    const header = q(".mf-game__header");
    const panel = q("[data-world-panel]");
    const endBtn = q("[data-end-discussion]");
    const vrow = q("[data-verdict-row]");
    const ann = q("[data-announce]");
    const annText = ann ? q(".mf-announce__text", ann) : null;
    const lineCountOf = (el) => {
      if (!el) return 0;
      const range = document.createRange();
      range.selectNodeContents(el);
      return new Set([...range.getClientRects()].map((r) => Math.round(r.top / 2))).size;
    };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let ghostTexts = 0;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = n.textContent ?? "";
      if (t.includes("유령끼리만 보여요") || t.includes("유령 채팅")) ghostTexts += 1;
    }
    const night = q(".mf-claimpanel__title", panel ?? document);
    return {
      phase: root.getAttribute("data-phase") ?? "",
      vw: window.innerWidth,
      vh: window.innerHeight,
      ghostView: root.getAttribute("data-ghost-view") === "true",
      kbOpen: root.getAttribute("data-kb-open") === "true",
      title: (q(".mv-phase__title", header ?? document)?.textContent ?? "").trim(),
      guide: { count: qa("[data-guide]").length, text: (q("[data-guide]")?.textContent ?? "").trim() },
      header: rect(header),
      stage: header && panel ? { left: 0, top: header.getBoundingClientRect().bottom, right: window.innerWidth, bottom: panel.getBoundingClientRect().top } : null,
      panel: rect(panel),
      chatChannel: q("[data-chat-panel]")?.getAttribute("data-chat-channel") ?? null,
      hasChat: !!q("[data-chat-panel]"),
      hasInput: !!q("[data-chat-input]"),
      end: endBtn ? { pressed: endBtn.getAttribute("aria-pressed") === "true", ...(count(endBtn) ?? { on: 0, total: 0 }) } : null,
      verdictRow: vrow ? { hasPicker: !!q(".mv-verdict", vrow), hasCount: !!q(".mv-count", vrow), ...(count(vrow) ?? { on: 0, total: 0 }) } : null,
      verdictBtns: qa("[data-verdict]").map((b) => ({ v: b.getAttribute("data-verdict"), pressed: b.getAttribute("aria-pressed") === "true", disabled: b.disabled === true, rect: rect(b) })),
      picks: qa("[data-pick]").map((b) => ({ seat: Number(b.getAttribute("data-pick")), rect: rect(b), pressed: b.getAttribute("aria-pressed") === "true", label: b.getAttribute("aria-label") ?? "" })),
      tags: qa(".mf-world__tag").map((el) => {
        const head = q(".mv-head", el);
        return {
          seat: Number(el.getAttribute("data-seat")),
          me: el.getAttribute("data-me") === "true",
          count: head?.getAttribute("data-count") ?? null,
          lead: head?.hasAttribute("data-lead") === true,
          sure: head?.hasAttribute("data-sure") === true,
          mine: head?.hasAttribute("data-mine") === true,
          done: head?.hasAttribute("data-done") === true,
          ring: el.getAttribute("data-ring-kind"),
          ghostSeat: el.hasAttribute("data-ghost-seat"),
          roleChip: q("[data-role-chip]", el)?.getAttribute("data-role-chip") ?? null,
          opacity: Number(getComputedStyle(el).opacity),
          top: rect(q(".mv-tag", el) ?? el)?.top ?? null,
        };
      }),
      announce: ann && annText ? { text: (annText.textContent ?? "").trim(), fontPx: parseFloat(getComputedStyle(annText).fontSize), lineCount: lineCountOf(annText), wordBreak: getComputedStyle(annText).wordBreak } : null,
      counts: { ghostView: qa("[data-ghost-view]").length, roleChips: qa("[data-role-chip]").length, ghostSeats: qa("[data-ghost-seat]").length, ghostTexts },
      ring: q("[data-world-stage]")?.getAttribute("data-ring") ?? null,
      testButton: !!q(".mf-game__test .mf-tt"),
      nightPanel: night ? (night.textContent ?? "").trim() : null,
    };
  });
}

/** 지목(밤 선택 포함) 이름표 버튼을 눌러 내 버튼이 aria-pressed 가 될 때까지 기다린다. */
export async function tapPick(page, seat) {
  const btn = page.locator(`[data-pick="${seat}"]`);
  await btn.click({ timeout: 4000 });
  await page.waitForSelector(`[data-pick="${seat}"][aria-pressed="true"]`, { timeout: 3000 });
}

/** 찬반 버튼을 눌러 그 쪽이 aria-pressed 가 될 때까지 기다린다. */
export async function chooseVerdict(page, yes) {
  const v = yes ? "yes" : "no";
  await page.locator(`[data-verdict="${v}"]`).click({ timeout: 4000 });
  await page.waitForSelector(`[data-verdict="${v}"][aria-pressed="true"]`, { timeout: 3000 });
}

/** [토론 끝내기] 를 눌러 aria-pressed 가 바뀔 때까지 기다린다(on = 누른 뒤 기대 상태). */
export async function pressEndDiscussion(page, on = true) {
  await page.locator("[data-end-discussion]").click({ timeout: 4000 });
  // 내 눌림으로 과반이 되면 서버가 바로 지목으로 넘겨 [토론 끝내기] 가 사라진다 — 단계가 넘어가 버튼이 없어진 것도 눌린 결과로 본다(on 일 때만)
  await page.waitForFunction(
    ({ want }) => {
      const b = document.querySelector("[data-end-discussion]");
      return b ? b.getAttribute("aria-pressed") === String(want) : want;
    },
    { want: on },
    { timeout: 3000 },
  );
}

/**
 * 결과 알림 관찰을 심는다: 40ms 마다 [data-announce] 를 읽어 글자가 바뀔 때마다 { text(없어지면 null), at(page 시계 ms), fontPx, lineCount, wordBreak } 를 쌓는다.
 * 처형 5초처럼 짧은 구간을 Playwright 호출 지연과 상관없이 놓치지 않으려고 쓴다. readAnnounceWatch 가 읽고 멈춘다.
 */
export function armAnnounceWatch(page) {
  return page.evaluate(() => {
    window.__annWatch?.stop?.();
    const log = [];
    let last;
    const lineCountOf = (el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return new Set([...range.getClientRects()].map((r) => Math.round(r.top / 2))).size;
    };
    const timer = setInterval(() => {
      const el = document.querySelector("[data-announce] .mf-announce__text");
      const text = el ? (el.textContent ?? "").trim() : null;
      if (text === last) return;
      last = text;
      if (el) {
        const cs = getComputedStyle(el);
        log.push({ text, at: performance.now(), fontPx: parseFloat(cs.fontSize), lineCount: lineCountOf(el), wordBreak: cs.wordBreak });
      } else log.push({ text: null, at: performance.now() });
    }, 40);
    window.__annWatch = { log, stop: () => clearInterval(timer) };
  });
}

/** armAnnounceWatch 가 쌓은 기록을 읽는다. 기본은 읽고 관찰을 멈춘다(stop false 면 계속 쌓는다). 심지 않았으면 빈 배열. */
export function readAnnounceWatch(page, { stop = true } = {}) {
  return page.evaluate((doStop) => {
    const w = window.__annWatch;
    if (!w) return [];
    if (doStop) w.stop();
    return w.log.slice();
  }, stop);
}

/**
 * 유령 이름표 글자 대비(UI-SPEC 남은 위험 5, A3): 유령 모양(.mv-tag.is-ghost, 불투명도 0.6) 이름표의 글자 칸을 화면 그림에서 잘라 글자색·면 중 밝은 쪽(p99)과 어두운 쪽(p1) 휘도로 대비를 잰다.
 * 불투명도 0.6 이 맵·면과 섞인 실제 렌더 값이다. 돌려주는 값: [{ seat, opacity, ratio, hi, lo }] — 판정이 아니라 기록용이다.
 */
export async function readGhostTagContrast(page) {
  const probes = await page.evaluate(() =>
    [...document.querySelectorAll(".mv-tag.is-ghost")]
      .map((tag) => {
        const name = tag.querySelector(".mv-tag__name");
        if (!name) return null;
        const range = document.createRange();
        range.selectNodeContents(name);
        const r = range.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return null;
        return { seat: Number(tag.closest(".mf-world__tag")?.getAttribute("data-seat") ?? -1), opacity: Number(getComputedStyle(tag).opacity), rect: { left: r.left, top: r.top, width: r.width, height: r.height }, vw: window.innerWidth, vh: window.innerHeight };
      })
      .filter(Boolean),
  );
  const out = [];
  for (const p of probes) {
    const x = Math.max(0, Math.floor(p.rect.left));
    const y = Math.max(0, Math.floor(p.rect.top));
    const width = Math.min(p.vw - x, Math.ceil(p.rect.width));
    const height = Math.min(p.vh - y, Math.ceil(p.rect.height));
    if (width <= 0 || height <= 0) continue;
    const png = await page.screenshot({ clip: { x, y, width, height }, scale: "css", type: "png" });
    const lums = await page.evaluate(async (b64) => {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const bmp = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
      const canvas = document.createElement("canvas");
      canvas.width = bmp.width;
      canvas.height = bmp.height;
      const g = canvas.getContext("2d");
      g.drawImage(bmp, 0, 0);
      const data = g.getImageData(0, 0, bmp.width, bmp.height).data;
      const lin = (v) => {
        const c = v / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      const out = [];
      for (let i = 0; i < data.length; i += 4) out.push(0.2126 * lin(data[i]) + 0.7152 * lin(data[i + 1]) + 0.0722 * lin(data[i + 2]));
      return out.sort((a, b) => a - b);
    }, png.toString("base64"));
    if (lums.length === 0) continue;
    const lo = lums[Math.floor(lums.length * 0.01)];
    const hi = lums[Math.min(lums.length - 1, Math.floor(lums.length * 0.99))];
    out.push({ seat: p.seat, opacity: p.opacity, ratio: (hi + 0.05) / (lo + 0.05), hi, lo });
  }
  return out;
}

/**
 * 결과 화면(ended) 한 장 — resultChecks 가 받는 { result } 모양. `.mf-result` 가 없으면 { result: null }.
 * [처음으로] 가 세로 스크롤로 닿는지 보려고 마지막에 그 버튼을 보이는 자리로 스크롤한다.
 */
export function readResult(page) {
  return page.evaluate(() => {
    const q = (s, r = document) => r.querySelector(s);
    const qa = (s, r = document) => [...r.querySelectorAll(s)];
    const text = (el) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
    const root = q(".mf-result");
    if (!root) return { result: null };
    const cards = qa(".mf-result__card", root).map((el) => {
      const art = q(".mf-result__art", el);
      return {
        seat: Number(el.closest("[data-seat]")?.getAttribute("data-seat") ?? el.getAttribute("data-seat") ?? -1),
        job: text(q(".mf-result__role", el)),
        dead: el.classList.contains("mf-result__card--dead"),
        figOpacity: art ? Number(getComputedStyle(art).opacity) : Number.NaN,
      };
    });
    const scrollers = [document.documentElement, document.body, root];
    const worst = scrollers.reduce((a, b) => (b.scrollWidth - b.clientWidth > a.scrollWidth - a.clientWidth ? b : a), scrollers[0]);
    const btn = qa("button", root).find((b) => text(b) === "처음으로") ?? null;
    let reachedButton = false;
    if (btn) {
      btn.scrollIntoView({ block: "nearest", behavior: "instant" });
      const r = btn.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      reachedButton = r.width > 0 && r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth && !!hit && btn.contains(hit);
    }
    return {
      result: {
        winner: root.getAttribute("data-winner") ?? "",
        stage: root.getAttribute("data-stage") ?? "",
        bannerText: text(q(".mf-result__banner-title", root)),
        bannerSub: text(q(".mf-result__banner-sub", root)),
        cards,
        rows: qa(".mf-result__sm-row", root).length,
        scrollW: worst.scrollWidth,
        clientW: worst.clientWidth,
        reachedButton,
        glow: q(".mf-result__glow") !== null,
        hasPhaseBar: q(".mf-phasebar") !== null || q(".mf-timer__num") !== null || q("[data-world-panel]") !== null,
      },
    };
  });
}
