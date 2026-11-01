// 화면 E2E 의 브라우저 쪽(결정 0025). Node 는 HTTP 로 테스트 방만 만들고 소켓을 열지 않는다 —
// 방장 소켓은 브라우저 페이지가 쥔다(스크립트가 쥐면 앱이 앞 소켓을 4001 로 대체한다).
// 토큰은 createTestRoom 결과와 addInitScript 인자에만 머문다. 페이지가 받은 state 프레임만 읽고 보낸 프레임은 구독하지 않는다.
import { chromium } from "playwright-core";
import { BLANK_TAP_E2E_MARGIN, DECORATIVE_ALLOW, FONT_HOSTS, ROLE_NAME, TAP_ALLOW, TEXT_SIZE_ALLOW, blankPointsOf, redact, rgbP95Luminance } from "./lib.mjs";

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

/**
 * 분위기 두 층(비네팅 AT1·아침 밝아짐 AT2)을 읽는다(05-06). 층은 pointer-events: none 이라 elementFromPoint 가 건너뛰므로,
 * 원래 pointer-events 를 먼저 기록한 뒤 이 evaluate 안에서만 잠시 auto 로 바꿔(층과 평소 pointer-events: none 인 내 이름표) 내 인물 그림 가운데(비네팅)·내 이름표 가운데(밝아짐)를 찍고 곧바로 되돌린다.
 * 층이 위에 칠해져 있으면 층이 돌아오고, 아래면 인물·이름표가 돌아온다. 요소가 없으면 빈 목록·null 이다.
 * 돌려주는 값: { vignettes, glows, sceneTop, sceneBottom, tapHitsTable, tagHit }
 */
export async function readAtmosphere(page, { mySeat }) {
  return page.evaluate((seat) => {
    const layerOf = (el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return { pointerEvents: cs.pointerEvents, backgroundImage: cs.backgroundImage, top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    };
    const vigEls = [...document.querySelectorAll(".mf-backdrop__vignette")];
    const glowEls = [...document.querySelectorAll(".mf-morningglow")];
    const vignettes = vigEls.map(layerOf);
    const glows = glowEls.map(layerOf);
    const sceneEl = document.querySelector(".mf-dayscene__scene");
    const scene = sceneEl ? sceneEl.getBoundingClientRect() : null;
    const centerOf = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return null;
      return [r.left + r.width / 2, r.top + r.height / 2];
    };
    const figure = seat === null || seat === undefined ? null : document.querySelector(`.mf-dt__seat[data-seat="${seat}"] img`);
    const tagEl = document.querySelector(".mf-dt__tag--me");
    const figPt = centerOf(figure);
    const tagPt = centerOf(tagEl);
    // 이름표(.mf-dt__tag)도 평소 pointer-events: none 이라 elementFromPoint 가 건너뛴다 — 층과 같이 잠시 auto 로 두어 칠 순서만 비교한다.
    const touched = [...vigEls, ...glowEls, ...(tagEl ? [tagEl] : [])].map((el) => [el, el.style.pointerEvents]);
    let tapHitsTable = null;
    let tagHit = null;
    try {
      for (const [el] of touched) el.style.setProperty("pointer-events", "auto", "important");
      if (vigEls.length > 0 && figPt) {
        const hit = document.elementFromPoint(figPt[0], figPt[1]);
        tapHitsTable = hit !== null && !vigEls.some((v) => v === hit || v.contains(hit)) && hit.closest(".mf-dt") !== null;
      }
      if (glowEls.length > 0 && tagPt) {
        const hit = document.elementFromPoint(tagPt[0], tagPt[1]);
        tagHit = hit !== null && !glowEls.some((g) => g === hit || g.contains(hit)) && hit.closest(".mf-dt__tag") !== null;
      }
    } finally {
      for (const [el, prev] of touched) {
        if (prev === "") el.style.removeProperty("pointer-events");
        else el.style.pointerEvents = prev;
      }
    }
    return {
      vignettes,
      glows,
      sceneTop: scene ? scene.top : null,
      sceneBottom: scene ? scene.bottom : null,
      tapHitsTable,
      tagHit,
    };
  }, mySeat ?? null);
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

/** 밤·낮 시작 문구(.mf-sceneintro) 한 번 읽기. 없으면 null. kind = 톤(night|day, 클래스 mf-sceneintro--{kind}). */
export async function readSceneIntro(page) {
  return page.evaluate(() => {
    const el = document.querySelector(".mf-sceneintro");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const tone = /\bmf-sceneintro--(night|day)\b/.exec(el.className);
    return {
      texts: [...el.querySelectorAll("p")].map((p) => (p.textContent || "").trim()),
      kind: tone ? tone[1] : null,
      pointerEvents: getComputedStyle(el).pointerEvents,
      ariaHidden: el.getAttribute("aria-hidden") === "true",
      rect: { left: r.left, top: r.top, width: r.width, height: r.height },
    };
  });
}

/**
 * 시작 문구(.mf-sceneintro)가 처음 보이는 순간의 값을 MutationObserver 로 붙잡아 둔다 (N8). 문구는 2초뿐이라 폴링하면 시간 경쟁이 생기므로
 * 단계를 넘기기 전에 걸어 두고 readIntroWatch 로 처음 본 값을 읽는다. 모양은 readSceneIntro 와 같다.
 */
export async function armIntroWatch(page) {
  await page.evaluate(() => {
    window.__introSeen = null;
    window.__introObs?.disconnect();
    const grab = () => {
      if (window.__introSeen) return;
      const el = document.querySelector(".mf-sceneintro");
      if (!el) return;
      const r = el.getBoundingClientRect();
      const tone = /\bmf-sceneintro--(night|day)\b/.exec(el.className);
      window.__introSeen = {
        texts: [...el.querySelectorAll("p")].map((p) => (p.textContent || "").trim()),
        kind: tone ? tone[1] : null,
        pointerEvents: getComputedStyle(el).pointerEvents,
        ariaHidden: el.getAttribute("aria-hidden") === "true",
        rect: { left: r.left, top: r.top, width: r.width, height: r.height },
      };
    };
    window.__introObs = new MutationObserver(grab);
    window.__introObs.observe(document.body, { childList: true, subtree: true });
    grab();
  });
}

/** armIntroWatch 가 처음 붙잡은 값(없으면 null)을 읽고 관찰자를 끈다. */
export async function readIntroWatch(page) {
  return page.evaluate(() => {
    window.__introObs?.disconnect();
    window.__introObs = null;
    return window.__introSeen ?? null;
  });
}

/** 배경 층(.mf-backdrop__art)마다 { scene, state, image(계산된 background-image) } (B1). 층이 없으면 빈 목록. */
export async function readBackdropLayers(page) {
  return page.evaluate(() => ({
    layers: [...document.querySelectorAll(".mf-backdrop__art")].map((el) => ({
      scene: el.getAttribute("data-scene") ?? "",
      state: el.getAttribute("data-state") ?? "",
      image: getComputedStyle(el).backgroundImage,
    })),
  }));
}

/**
 * 배경 크로스페이드가 끝나(층이 하나이고 불투명) 시작 문구가 없을 때까지 기다린다(상한 4초). 시간 초과는 던지지 않는다 —
 * 아직 두 층이거나 문구가 남아 있으면 B1·H1 이 그 사실을 실패로 보고한다.
 */
export async function waitBackdropStable(page, ms = 4000) {
  try {
    await page.waitForFunction(
      () => {
        const arts = document.querySelectorAll(".mf-backdrop__art");
        return arts.length === 1 && Number(getComputedStyle(arts[0]).opacity) >= 0.999 && !document.querySelector(".mf-sceneintro");
      },
      null,
      { timeout: ms },
    );
  } catch {
    /* B1·H1 이 보고한다 */
  }
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
      { name: "제목", sels: [".mf-phasebar h1", ".mf-assign__bar h1", ".mf-lobby__header .mv-phase__title"] },
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

/**
 * 장면 상자·머리·하단 패널·테이블 면·캐릭터·이름표 사각형을 한 번의 evaluate 로 읽는다(T1·T2, 결정 0028).
 * 낮·밤·아침(.mf-dayscene), 역할 배정(.mf-assign) 어느 화면이든 같은 모양이다 — 없으면 null. 맵 로비는 고정 테이블이 없어 여기서 읽지 않는다(readLobbyFrame·readWorld).
 * 글자·토큰·프레임은 싣지 않는다.
 */
export async function readStage(page) {
  return page.evaluate(() => {
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
    };
    const first = (...sels) => {
      for (const sel of sels) {
        const el = document.querySelector(sel);
        if (el) return el;
      }
      return null;
    };
    return {
      scene: rect(first(".mf-dayscene__scene", ".mf-assign__scene")),
      header: rect(first(".mf-phasebar", ".mf-assign__bar")),
      panel: rect(first(".mf-dayscene__panel", ".mf-assign__panel")),
      felt: rect(document.querySelector(".mf-dt__felt")),
      seats: [...document.querySelectorAll(".mf-dt__seat")].map((el) => ({
        seat: Number(el.getAttribute("data-seat")),
        rect: rect(el),
        spotlit: el.classList.contains("mf-dt__seat--spotlit"),
      })),
      tags: [...document.querySelectorAll(".mf-dt__tag")].map((el) => ({ seat: Number(el.getAttribute("data-seat")), rect: rect(el), name: el.getAttribute("title") ?? "" })),
    };
  });
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
      const lineHeightOf = (el) => {
        const cs = getComputedStyle(el);
        const lh = parseFloat(cs.lineHeight);
        return Number.isFinite(lh) ? lh : parseFloat(cs.fontSize) * 1.2;
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
        elements.push({ desc: desc(el), rect: rectOf(el), fixedTagName: el.closest(".mf-dt__tag")?.getAttribute("title") ?? null }); // 결정 0056 개정(G2-8ch) 범위 판정용: v1.0 고정 테이블 이름표 안쪽이면 그 닉네임
      }

      const interactive = [];
      for (const el of document.querySelectorAll('button, [role="button"], a[href], input, select, textarea')) {
        if (tapSel && el.matches(tapSel)) continue;
        if (!visible(el)) continue;
        const rect = rectOf(el);
        interactive.push({ desc: desc(el), rect, hit: hitOf(el, rect) });
      }

      const tt = q(".mf-tt");
      const h1 = q(".mf-phasebar h1");
      const extra = q(".mf-phasebar__extra");
      const panel = q(".mf-dayscene__panel");
      const guide = q(".mf-claimpanel__guide");
      const card = q(".mf-morningcard");
      const dim = q(".mf-dt__dim");
      const rcBtn = q(".mf-rolecard-btn");
      const rcSheet = q('dialog[aria-label="역할 카드"][open]');
      const zOf = (el) => {
        const z = parseInt(getComputedStyle(el).zIndex, 10);
        return Number.isFinite(z) ? z : Number.NaN;
      };
      // 채팅 기록 칸([data-chat-log])의 사람 줄 본문 — 시스템 줄(.mv-chat__sys)은 싣지 않는다(07-20: 옛 .mf-msglog 대신)
      const chatTexts = (root) => [...root.querySelectorAll("[data-chat-log] .mv-chat__msg .mv-chat__text")].map((e) => (e.textContent || "").trim());
      const stepper = q(".mf-tt-sheet__stepper");
      const ttSheet = q(".mf-tt-sheet");
      const stepBtn = (label) => {
        const b = q(`.mf-tt-sheet [aria-label="${label}"]`);
        if (!b) return null;
        const rect = rectOf(b);
        return { rect, hit: hitOf(b, rect), disabled: b.disabled === true };
      };

      const seats = [...document.querySelectorAll(".mf-dt__seat")].map((el) => {
        const r = el.getBoundingClientRect();
        let reachable = false;
        for (let i = 0; i < 3 && !reachable; i++) {
          for (let j = 0; j < 4 && !reachable; j++) {
            const x = r.left + (r.width * (i + 0.5)) / 3;
            const y = r.top + (r.height * (j + 0.5)) / 4;
            if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) continue;
            const top = document.elementFromPoint(x, y);
            if (top && el.contains(top)) reachable = true;
          }
        }
        return {
          seat: Number(el.getAttribute("data-seat")),
          rect: toRect(r),
          isButton: el.tagName === "BUTTON",
          sel: !!el.querySelector("img.mf-figure--halo-white"),
          pressed: el.getAttribute("aria-pressed") === "true",
          reachable,
          z: zOf(el),
          imgSrc: el.querySelector("img")?.getAttribute("src") ?? null,
          spotlit: el.classList.contains("mf-dt__seat--spotlit"),
        };
      });

      const tagEls = [...document.querySelectorAll(".mf-dt__tag")];
      const tags = tagEls.map((el) => ({
        seat: Number(el.getAttribute("data-seat")),
        rect: rectOf(el),
        name: el.getAttribute("title") ?? "", // 결정 0056 완화 범위(6 그래핌 이상 이름) 판정용 — 닉네임은 title 에만 있다
        z: zOf(el),
        lines: el.children.length,
        hasDot: !!el.querySelector(".mf-dt__dot"),
      }));

      // D3b: 캐릭터 그림(.mf-dt__seat img)을 오프스크린 canvas 에 그려 알파 > 40 픽셀을 읽고, 이름표 사각형을 0.5px 격자(중심점)로 훑어
      // 어떤 그림의 불투명 픽셀 위에 놓인 점을 센다. 로드 안 된 그림이 하나라도 있거나 canvas 를 못 읽으면 ratio 는 null(조용히 통과시키지 않는다).
      const figs = [...document.querySelectorAll(".mf-dt__seat img")];
      const allLoaded = figs.length > 0 && figs.every((im) => im.complete && im.naturalWidth > 0);
      const alphaOf = new Map();
      if (allLoaded) {
        for (const im of figs) {
          try {
            const c = document.createElement("canvas");
            c.width = im.naturalWidth;
            c.height = im.naturalHeight;
            const g = c.getContext("2d");
            g.drawImage(im, 0, 0, c.width, c.height);
            alphaOf.set(im, g.getImageData(0, 0, c.width, c.height));
          } catch {
            alphaOf.clear();
            break;
          }
        }
      }
      const measurable = allLoaded && alphaOf.size === figs.length;
      const figBoxes = measurable
        ? figs.map((im) => {
            const r = im.getBoundingClientRect();
            const iw = im.naturalWidth;
            const ih = im.naturalHeight;
            // object-fit: contain 이면 그림은 상자 안에 비율을 지켜 가운데에 놓인다
            const contain = getComputedStyle(im).objectFit === "contain";
            const k = contain ? Math.min(r.width / iw, r.height / ih) : null;
            const dw = contain ? iw * k : r.width;
            const dh = contain ? ih * k : r.height;
            const ox = r.left + (r.width - dw) / 2;
            const oy = r.top + (r.height - dh) / 2;
            return { data: alphaOf.get(im), iw, ih, ox, oy, dw, dh };
          })
        : [];
      const tagVisibility = tagEls.map((el) => {
        const seat = Number(el.getAttribute("data-seat"));
        if (!measurable) return { seat, ratio: null };
        const r = el.getBoundingClientRect();
        const near = figBoxes.filter((b) => b.ox < r.right && b.ox + b.dw > r.left && b.oy < r.bottom && b.oy + b.dh > r.top);
        let total = 0;
        let covered = 0;
        for (let y = r.top + 0.25; y < r.bottom; y += 0.5) {
          for (let x = r.left + 0.25; x < r.right; x += 0.5) {
            total += 1;
            for (const b of near) {
              if (x < b.ox || x >= b.ox + b.dw || y < b.oy || y >= b.oy + b.dh) continue;
              const u = Math.min(b.iw - 1, Math.floor(((x - b.ox) / b.dw) * b.iw));
              const v = Math.min(b.ih - 1, Math.floor(((y - b.oy) / b.dh) * b.ih));
              if (b.data.data[(v * b.iw + u) * 4 + 3] > 40) {
                covered += 1;
                break;
              }
            }
          }
        }
        return { seat, ratio: total === 0 ? null : 1 - covered / total };
      });

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

      const chatPanel = panel?.querySelector("[data-chat-panel]") ?? null;

      return {
        vw: window.innerWidth,
        vh: window.innerHeight,
        docW: document.documentElement.scrollWidth,
        docH: document.documentElement.scrollHeight,
        bodyW: document.body.scrollWidth,
        elements,
        interactive,
        tt: tt ? { rect: rectOf(tt), hit: hitOf(tt, tt.getBoundingClientRect()) } : null,
        dialogs: [...document.querySelectorAll("dialog[open]")].map((d) => ({
          label: d.getAttribute("aria-label") ?? "",
          title: (d.querySelector("h2, h3, .mf-sheet__title")?.textContent || "").trim(),
        })),
        h1: h1 ? { rect: rectOf(h1), lineHeight: lineHeightOf(h1), text: (h1.textContent || "").trim() } : null,
        extra: extra ? { rect: rectOf(extra), children: [...extra.children].map((c) => rectOf(c)) } : null,
        scene: rectOf(q(".mf-dayscene__scene")),
        panel: panel
          ? {
              rect: rectOf(panel),
              text: (panel.innerText || "").replace(/\s+/g, " ").trim(),
              children: [...panel.querySelectorAll("*")].filter(visible).map((c) => ({ desc: desc(c), rect: rectOf(c) })),
              // 채팅 패널이 붙은 하단인가와 그 채널(all|mafia|ghost) — D6·T1 이 기대 높이를 고르는 근거(07-20)
              hasChat: !!chatPanel,
              chatChannel: chatPanel ? chatPanel.getAttribute("data-chat-channel") : null,
            }
          : null,
        guide: guide ? { rect: rectOf(guide), lineHeight: lineHeightOf(guide), text: (guide.textContent || "").trim() } : null,
        felt: rectOf(q(".mf-dt__felt")),
        seats,
        header: rectOf(q(".mf-phasebar")),
        tags,
        tagVisibility,
        // 차례·후광 측정(결정 0030): 말풍선 자리, 후광 img 와 계산된 filter 값만 싣는다. 옛 발밑 원 선택자는 0 임을 증명하려고 여기서만 센다.
        turn: (() => {
          const seatOf = (el) => Number(el.closest(".mf-dt__seat")?.getAttribute("data-seat"));
          return {
            bubbleTurnSeats: [...document.querySelectorAll(".mf-dt__bubble--turn")].map(seatOf),
            haloWhiteSeats: [...document.querySelectorAll("img.mf-figure--halo-white")].map(seatOf),
            legacyCircles: document.querySelectorAll(".mf-dt__spot, .mf-dt__ring, .mf-dt__ring--me, .mf-dt__ring--mate, .mf-dt__sel").length,
            tagInverted: document.querySelectorAll(".mf-dt__tag--turn, .mf-dt__tag--spoke").length,
          };
        })(),
        halo: (() => {
          const haloEls = [...document.querySelectorAll(".mf-figure--halo-white, .mf-figure--halo-amber, .mf-figure--halo-crimson")];
          const items = haloEls.map((el) => {
            // 후광 filter 는 180ms 전환(transition)이라 차례가 막 바뀐 순간의 계산값은 중간값(0.74px 등)이다. 끝 상태를 읽으려고 진행 중인 전환만 끝낸다(보이는 결과는 같다).
            for (const a of el.getAnimations()) if (a instanceof CSSTransition) a.finish();
            const seatEl = el.closest(".mf-dt__seat");
            return {
              seat: Number(seatEl?.getAttribute("data-seat")),
              cls: el.classList.contains("mf-figure--halo-white") ? "white" : el.classList.contains("mf-figure--halo-amber") ? "amber" : "crimson",
              filter: getComputedStyle(el).filter,
              seatContext: !!seatEl && Number.isFinite(parseInt(getComputedStyle(seatEl).zIndex, 10)),
              onImg: el.tagName === "IMG",
            };
          });
          return { items, max: items.length };
        })(),
        crowns: document.querySelectorAll(".mf-dt__crown").length,
        dim: dim ? { rect: rectOf(dim), z: zOf(dim), pointerEvents: getComputedStyle(dim).pointerEvents } : null,
        card: rectOf(card),
        // 방(.mf-dayscene) 높이 — 채팅 패널 기대 높이(LOG_H 선택)의 기준. 낮 장면이 아니면 null
        roomH: q(".mf-dayscene") ? q(".mf-dayscene").getBoundingClientRect().height : null,
        chatLines: chatTexts(document),
        legacyRecordsBtn: !!q("button.mf-records-btn") || [...document.querySelectorAll("button")].some((b) => /^수사 기록/.test(b.getAttribute("aria-label") ?? "")),
        roleCard: {
          button: rcBtn
            ? { label: rcBtn.getAttribute("aria-label") ?? "", rect: rectOf(rcBtn), dotRect: rectOf(rcBtn.querySelector(".mf-rolecard-btn__dot")), hit: hitOf(rcBtn, rcBtn.getBoundingClientRect()) }
            : null,
          sheet: rcSheet
            ? {
                tabs: [...rcSheet.querySelectorAll('[role="tab"]')].map((t) => ({
                  text: (t.textContent || "").replace(/\s+/g, " ").trim(),
                  selected: t.getAttribute("aria-selected") === "true",
                  dotRect: rectOf(t.querySelector(".mf-rolecard__dot")),
                })),
                journalName: (rcSheet.querySelector(".mf-journal__h b")?.textContent || "").trim() || null,
                rows: [...rcSheet.querySelectorAll(".mf-journal__row")].map((r) => ({
                  day: (r.querySelector(".mf-journal__d")?.textContent || "").trim(),
                  who: (r.querySelector(".mf-journal__w")?.textContent || "").trim(),
                  result: (r.querySelector(".mf-journal__rz")?.textContent || "").trim(),
                  hasNew: !!r.querySelector(".mf-journal__new"),
                })),
                emptyText: (rcSheet.querySelector(".mf-journal__empty")?.textContent || "").trim() || null,
                hasBody: !!rcSheet.querySelector(".mf-rolecard__body"),
              }
            : null,
          // 밤 끝 알림이 없음을 증명하는 측정값: 보이는 [role="status"] 중 옛 알림 문구가 든 것의 글자(요소 클래스에 기대지 않는다)
          noticeTexts: [...document.querySelectorAll('[role="status"]')]
            .filter(visible)
            .map((e) => (e.textContent || "").replace(/\s+/g, " ").trim())
            .filter((t) => t.includes("일지가 추가됐어요") || t.includes("눌러서 보기")),
        },
        roleImgs: [...document.querySelectorAll('img[src*="/characters/roles/"]')].map((im) => ({
          src: im.getAttribute("src") ?? "",
          inTable: !!im.closest(".mf-dt"),
          inDialog: !!im.closest("dialog"),
          inReveal: !!im.closest(".mf-reveal"),
        })),
        smallText,
        buttonTexts: [...document.querySelectorAll("button")].filter(visible).map((b) => (b.textContent || "").replace(/\s+/g, " ").trim()),
        lobbyCount: q("[data-lobby-start]")?.getAttribute("aria-label") ?? "",
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
    const dots = start ? [...start.querySelectorAll(".mv-dots__dot")] : [];
    return {
      header: { leave: boxOf(document.querySelector('.mf-lobby__header [aria-label="나가기"]')), share: boxOf(document.querySelector('.mf-lobby__header [aria-label="공유"]')) },
      start: start
        ? {
            ...boxOf(start),
            ariaDisabled: start.getAttribute("aria-disabled"),
            opacity: Number(getComputedStyle(start).opacity),
            dots: dots.length,
            dotsOn: dots.filter((d) => d.classList.contains("is-on")).length,
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
 * 테이블 화면(DayScene)의 채팅 패널 치수와 채널 표식(07-15): 방 높이(.mf-dayscene)·하단 패널(.mf-dayscene__panel)·기록 칸·입력칸·보내기.
 * 한 번의 evaluate. 채팅 패널이 없으면 panelOnly(하단 패널만)로 돌려준다 — 패널 자체가 없는 단계는 null. UI-SPEC 표와 견주는 판정은 flows.mjs 가 한다.
 */
export function readTablePanel(page) {
  return page.evaluate(() => {
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom, hit: !!top && el.contains(top) };
    };
    const room = document.querySelector(".mf-dayscene");
    const panel = document.querySelector(".mf-dayscene__panel");
    if (!room || !panel) return null;
    const chat = panel.querySelector("[data-chat-panel]");
    const log = panel.querySelector("[data-chat-log]");
    const input = panel.querySelector("[data-chat-input]");
    const send = panel.querySelector("[data-chat-send]");
    return {
      roomH: room.getBoundingClientRect().height,
      panel: box(panel),
      hasChat: !!chat,
      channel: chat ? chat.getAttribute("data-chat-channel") : null,
      log: box(log),
      input: box(input),
      inputFont: input ? parseFloat(getComputedStyle(input).fontSize) : null,
      inputLabel: input ? input.getAttribute("aria-label") : null,
      inputHint: input ? input.getAttribute("placeholder") : null,
      send: box(send),
    };
  });
}

/**
 * 한 화면에서 마피아·유령 채널의 흔적을 센다(07-15, T-07-40): 문서 글자·aria-label·placeholder·title 에 든 금지 문구의 개수와 채널 표식이 있는 줄 수.
 * needles = 찾을 문구 목록. 문서 전체(숨은 시트 포함)의 글자를 읽는다.
 */
export function readChannelTraces(page, needles) {
  return page.evaluate((words) => {
    const texts = [document.body.textContent ?? ""];
    for (const el of document.querySelectorAll("[aria-label],[placeholder],[title]")) {
      texts.push(el.getAttribute("aria-label") ?? "", el.getAttribute("placeholder") ?? "", el.getAttribute("title") ?? "");
    }
    const hits = {};
    for (const w of words) hits[w] = texts.filter((t) => t.includes(w)).length;
    return {
      hits,
      panels: document.querySelectorAll("[data-chat-panel]").length,
      mafiaLines: document.querySelectorAll('[data-chat-log] [data-ch="mafia"]').length,
      ghostLines: document.querySelectorAll('[data-chat-log] [data-ch="ghost"]').length,
      mafiaChannel: document.querySelectorAll('[data-chat-channel="mafia"]').length,
      ghostChannel: document.querySelectorAll('[data-chat-channel="ghost"]').length,
    };
  }, needles);
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
 */
export async function tapWorld(page, tracker, mySeat, x, z) {
  const pt = await page.evaluate(({ px, pz }) => (window.__mfWorld ? window.__mfWorld.screenOf(px, pz) : null), { px: x, pz: z });
  if (!pt) throw new SetupError("screenOf 를 쓸 수 없음(맵 훅 없음 또는 렌더러 없음)");
  const beforeN = tracker.moves.get(mySeat)?.n ?? 0;
  await page.evaluate(() => {
    const root = document.querySelector("[data-world-stage]");
    window.__tapWatch?.obs?.disconnect();
    const w = { up: null, ring: null, prev: root?.getAttribute("data-ring") ?? null, obs: null };
    window.__tapWatch = w;
    document.addEventListener(
      "pointerup",
      (e) => {
        w.up = e.timeStamp;
      },
      { capture: true, once: true },
    );
    w.obs = new MutationObserver(() => {
      const v = root?.getAttribute("data-ring") ?? null;
      if (w.ring === null && v !== null && v !== w.prev) w.ring = performance.now();
    });
    if (root) w.obs.observe(root, { attributes: true, attributeFilter: ["data-ring"] });
  });
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
  if (cur < 4 && count >= 3) {
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

/** 대상 자리 버튼을 실제로 누른다. 다른 요소에 가려지면 Playwright 실행 가능성 검사가 실패를 낸다. */
export async function tapSeat(page, seat) {
  await page.locator(`button.mf-dt__seat--pick[data-seat="${seat}"]`).click({ timeout: 4000 });
}

/** 그 자리 상자 안에서 맨 위 요소가 그 자리인 점을 찾아 누른다(없으면 가운데). */
export async function clickTopmostPoint(page, seat) {
  const pt = await page.evaluate((n) => {
    const el = document.querySelector(`.mf-dt__seat[data-seat="${n}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    let best = null;
    for (let j = 0; j < 12 && !best; j++) {
      for (let i = 0; i < 9 && !best; i++) {
        const x = r.left + (r.width * (i + 0.5)) / 9;
        const y = r.top + (r.height * (j + 0.5)) / 12;
        const top = document.elementFromPoint(x, y);
        if (top && el.contains(top)) best = { x, y };
      }
    }
    return best ?? { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, seat);
  if (!pt) throw new Error(`자리 ${seat} 없음`);
  await page.mouse.click(pt.x, pt.y);
}

/** 낮 자리를 눌러 기록 카드를 연다(밤이면 아무것도 안 열리는 것이 정상). 그 자리에서 맨 위인 점을 누른다. */
export async function inspectSeat(page, seat) {
  await clickTopmostPoint(page, seat);
  await page.waitForTimeout(350);
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

// ---- 처형 구간 읽기·조작 도우미 (04-31, UI-SPEC 15.1·15.2) ----
// readVerdict 가 돌려주는 모양은 lib.mjs 머리의 `처형 구간 스냅숏 계약` 과 필드 이름·단위가 같다. 읽기는 한 번의 evaluate 로 끝낸다(시간 경쟁 없음).
// 요소가 없으면 숫자 0·문자열 ""·배열 []·객체 null. 단, 검사가 `count` 로 판정하는 인트로·카드·어둡게 층은 count 0 인 객체로 돌려준다.
// 결과에는 닉네임·직업·토큰 같은 값이 아니라 검사가 필요로 하는 모양·글자만 들어 있다(T-04-72).

/**
 * `--crimson-300|400|500|700`, `--gray-300|500|700`, `--amber-400` 토큰을 브라우저가 계산한 rgb 문자열로 읽는다.
 * 색 값을 스크립트에 박지 않는다 — lib 검사는 이 문자열을 그대로 비교한다. 토큰이 없으면 던진다(조용히 틀린 색으로 비교하지 않는다).
 */
export async function readTokenColors(page) {
  return page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none;width:0;height:0";
    document.body.appendChild(probe);
    try {
      const rootStyle = getComputedStyle(document.documentElement);
      const read = (name) => {
        if (rootStyle.getPropertyValue(name).trim() === "") throw new Error(`토큰 ${name} 이 정의돼 있지 않음`);
        probe.style.color = `var(${name})`;
        return getComputedStyle(probe).color;
      };
      return {
        crimson: ["--crimson-300", "--crimson-400", "--crimson-500", "--crimson-700"].map(read),
        gray: ["--gray-300", "--gray-500", "--gray-700"].map(read),
        amber: read("--amber-400"),
      };
    } finally {
      probe.remove();
    }
  });
}

/**
 * 처형 구간(execVote~ended) 스냅숏을 한 번의 evaluate 로 읽는다. colors = { crimson: string[] } (readTokenColors 결과).
 * 진홍 판정은 계산된 color·background-color·border-color·box-shadow·filter·stroke·fill 값 안의 색(rgb·color(srgb)·oklab·oklch)을
 * 8비트 sRGB 로 바꿔 진홍 토큰과 채널당 ±2 안이면 같은 색으로 세는 것이다(알파·흐림 그림자·color-mix 로 계산된 색 포함). 결과 화면이면 [처음으로] 를 스크롤로 화면에 불러 닿는지 본다(reachedButton).
 * 계약 밖 덧붙임 두 가지: result.stage(neutral|flip|done), 최상위 now(page 시계 ms). 계약 필드는 이름·단위를 바꾸지 않았다.
 */
export async function readVerdict(page, colors = { crimson: [], gray: [] }) {
  const crimson = Array.isArray(colors?.crimson) ? colors.crimson : [];
  return page.evaluate((crimsonColors) => {
    const text = (el) => (el ? (el.textContent || "").replace(/\s+/g, " ").trim() : "");
    const rectOf = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    };
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return false;
      const cs = getComputedStyle(el);
      return cs.display !== "none" && cs.visibility !== "hidden" && Number(cs.opacity) > 0.01;
    };
    const zOf = (el) => {
      const z = parseInt(getComputedStyle(el).zIndex, 10);
      return Number.isFinite(z) ? z : Number.NaN;
    };
    const seatOf = (el) => Number(el?.getAttribute("data-seat"));
    const q = (s, root = document) => root.querySelector(s);
    const qa = (s, root = document) => [...root.querySelectorAll(s)];
    const ownText = (el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent || "").join("").replace(/\s+/g, " ").trim();
    const ariaBool = (el) => {
      const v = el.getAttribute("aria-pressed");
      return v === "true" ? true : v === "false" ? false : null;
    };

    // ---- 하단 패널 ----
    const panel = q(".mf-dayscene__panel");
    const pillEl = panel ? q(".mf-pk, .mf-ro", panel) : null;
    const bottom = {
      title: text(panel && q(".mf-claimpanel__title", panel)),
      guide: text(panel && q(".mf-claimpanel__guide", panel)),
      // 안내 줄 요소 높이·계산된 줄 높이(결정 0040 P11: 한 줄 판정). 줄 높이가 normal 이면 글자 크기 × 1.4. 없으면 NaN.
      guideH: panel && q(".mf-claimpanel__guide", panel) ? q(".mf-claimpanel__guide", panel).getBoundingClientRect().height : Number.NaN,
      guideLH: (() => {
        const g = panel && q(".mf-claimpanel__guide", panel);
        if (!g) return Number.NaN;
        const cs = getComputedStyle(g);
        const lh = parseFloat(cs.lineHeight);
        return Number.isFinite(lh) ? lh : parseFloat(cs.fontSize) * 1.4;
      })(),
      tally: text(panel && q(".mf-execvote__tally", panel)),
      pill: pillEl ? text(pillEl) : null,
      buttons: panel
        ? qa("button", panel).map((b) => {
            const r = b.getBoundingClientRect();
            return { text: text(b), pressed: ariaBool(b), disabled: b.disabled === true, w: r.width, h: r.height };
          })
        : [],
      height: panel ? panel.getBoundingClientRect().height : 0,
      // 07-20: 변론 하단은 채팅 패널이다 — 채팅 패널이 붙었는가와 방(.mf-dayscene) 높이(기대 패널 높이 expectedPanelH 의 입력)
      chat: !!(panel && q("[data-chat-panel]", panel)),
      roomH: q(".mf-dayscene") ? q(".mf-dayscene").getBoundingClientRect().height : Number.NaN,
    };

    // ---- 낮 테이블 장면 ----
    const dtRoot = q(".mf-dt");
    const seatEls = qa(".mf-dt__seat");
    const tagEls = qa(".mf-dt__tag");
    const dimEl = q(".mf-dt__dim--verdict");
    const dimZ = dimEl ? zOf(dimEl) : Number.NaN;
    const dimCs = dimEl ? getComputedStyle(dimEl) : null;
    const centerEl = Number.isFinite(dimZ) ? seatEls.filter((el) => zOf(el) > dimZ).sort((a, b) => zOf(b) - zOf(a))[0] ?? null : null;
    let center = null;
    if (centerEl) {
      const r = centerEl.getBoundingClientRect();
      const t = getComputedStyle(centerEl).transform;
      const m = new DOMMatrix(t === "none" ? undefined : t);
      const tag = tagEls.find((el) => seatOf(el) === seatOf(centerEl));
      center = {
        seat: seatOf(centerEl),
        cx: r.left + r.width / 2,
        scale: Math.hypot(m.a, m.b),
        z: zOf(centerEl),
        tagZ: tag ? zOf(tag) : Number.NaN,
        tagBottom: tag ? tag.getBoundingClientRect().bottom : Number.NaN,
      };
    }
    const maxZ = (els) => Math.max(0, ...els.map(zOf).filter(Number.isFinite));
    const roleWordRe = /마피아|경찰|의사|시민/;
    const dt = {
      textHits: dtRoot ? qa("*", dtRoot).filter((el) => !el.closest(".mf-vchip") && /찬성|반대|투표/.test(ownText(el))).length : 0,
      haloImgs: qa("img.mf-figure--halo-white, img.mf-figure--halo-amber, img.mf-figure--halo-crimson").map((el) => ({
        seat: seatOf(el.closest(".mf-dt__seat")),
        kind: el.classList.contains("mf-figure--halo-white") ? "white" : el.classList.contains("mf-figure--halo-amber") ? "amber" : "crimson",
      })),
      seatButtons: seatEls.map((el) => ({
        seat: seatOf(el),
        pickable: el.tagName === "BUTTON" && el.classList.contains("mf-dt__seat--pick") && !el.classList.contains("mf-dt__seat--inspect") && el.hasAttribute("aria-pressed") && !el.disabled,
        pressed: ariaBool(el),
        label: el.getAttribute("aria-label") ?? "",
      })),
      ghosts: [...new Set(qa('.mf-dt__seat img[src*="/characters/ghost/"]').map((im) => seatOf(im.closest(".mf-dt__seat"))))].sort((a, b) => a - b),
      roleImgs: qa('img[src*="/characters/roles/"]').length,
      roleWords: qa("body *").filter((el) => !el.closest(".mf-rolecard-btn, dialog, .mf-sr-only, script, style") && roleWordRe.test(ownText(el)) && visible(el)).length,
      center,
      others: seatEls.length > 0 ? { maxSeatZ: maxZ(seatEls.filter((el) => el !== centerEl)), maxTagZ: maxZ(tagEls.filter((el) => !centerEl || seatOf(el) !== seatOf(centerEl))) } : null,
      dim: {
        count: qa(".mf-dt__dim--verdict").length,
        backdropFilter: dimCs ? dimCs.backdropFilter || dimCs.webkitBackdropFilter || "" : "",
        background: dimCs ? dimCs.backgroundColor : "",
        z: dimEl && Number.isFinite(dimZ) ? dimZ : 0,
      },
      cones: qa(".mf-dt__cone").length,
      scene: rectOf(q(".mf-dayscene__scene")),
      header: rectOf(q(".mf-phasebar")),
      panel: rectOf(panel),
    };

    // ---- 카드: 인트로·처형 무효·처형 ----
    const introEls = qa(".mf-vintro:not(.mf-vintro--void)");
    const introEl = introEls[0] ?? null;
    const introLayers = introEl ? [introEl, ...qa("*", introEl)] : [];
    const blocking = introLayers.map((el) => getComputedStyle(el).pointerEvents).find((p) => p !== "none");
    const introDrop = introEl ? q(".mf-vintro__drop", introEl) : null;
    const intro = {
      count: introEls.length,
      pointerEvents: introEl ? blocking ?? "none" : "",
      cardOpacity: introEl ? Number(getComputedStyle(introDrop ?? introEl).opacity) : 0,
      residueCount: qa('[class*="mf-vintro"]:not(.mf-vintro--void):not(.mf-vintro--void *)').filter(visible).length,
    };
    const voidEls = qa(".mf-vintro--void");
    const voidEl = voidEls[0] ?? null;
    const voidFace = voidEl ? q(".mf-vintro__face", voidEl) : null;
    const voidCard = {
      count: voidEls.length,
      title: text(voidEl && q(".mf-vintro__title", voidEl)),
      sub: text(voidEl && q(".mf-vintro__sub", voidEl)),
      borderColor: voidFace ? getComputedStyle(voidFace).borderTopColor : "",
      pointerEvents: voidEl ? [voidEl, ...qa("*", voidEl)].map((el) => getComputedStyle(el).pointerEvents).find((p) => p !== "none") ?? "none" : "",
    };
    const execEls = qa(".mf-morningcard--amber");
    const execEl = execEls[0] ?? null;
    const execCard = {
      count: execEls.length,
      title: text(execEl && q(".mf-morningcard__t", execEl)),
      sub: text(execEl && q(".mf-morningcard__s", execEl)),
      borderColor: execEl ? getComputedStyle(execEl).borderTopColor : "",
    };
    const cardEl = q(".mf-vintro__drop") ?? execEl;
    const card = cardEl ? { rect: rectOf(cardEl) } : null;

    // ---- 공개: 화살표·칩·이름표 ----
    const reveal = {
      arrows: qa(".mf-varrow").length,
      chips: qa(".mf-vchip").map((el) => {
        const tone = /\bmf-vchip--(?!slow\b)([a-z]+)/.exec(el.className);
        const r = el.getBoundingClientRect();
        return { seat: seatOf(el), n: parseInt(text(el), 10) || 0, tone: tone ? tone[1] : "", left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      }),
      tags: tagEls.map((el) => {
        const r = el.getBoundingClientRect();
        return { seat: seatOf(el), left: r.left, top: r.top, right: r.right, bottom: r.bottom, name: el.getAttribute("title") ?? "" };
      }),
    };

    // ---- 진홍 사용 수 ----
    // 계산된 색 문자열은 rgb() 만이 아니다: color-mix 와 흐림 그림자는 `color(srgb 0.88 0.20 0.29 / .95)`·`oklab(…)` 로 계산된다(실제 후광 filter 가 그렇다).
    // 그래서 값에서 색 함수를 모두 뽑아 8비트 sRGB 로 바꾼 뒤 진홍 토큰과 채널당 ±2 안이면 같은 색으로 센다(문자열 포함만 보면 후광을 놓친다).
    const toByte = (v) => Math.round(Math.min(1, Math.max(0, v)) * 255);
    const encode = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055);
    const fromOklab = (L, a, b) => {
      const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
      const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
      const sv = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
      return [
        toByte(encode(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * sv)),
        toByte(encode(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * sv)),
        toByte(encode(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * sv)),
      ];
    };
    const colorsIn = (value) => {
      const out = [];
      for (const m of String(value).matchAll(/(rgba?|color|oklab|oklch)\(([^)]*)\)/gi)) {
        const nums = m[2].split("/")[0].replace(/srgb|,/gi, " ").trim().split(/\s+/).map(Number);
        if (nums.some((n) => !Number.isFinite(n))) continue;
        const fn = m[1].toLowerCase();
        if (fn === "rgb" || fn === "rgba") out.push(nums.slice(0, 3).map((n) => Math.round(n)));
        else if (fn === "color" && /srgb/i.test(m[2]) && !/srgb-linear/i.test(m[2])) out.push(nums.slice(0, 3).map(toByte));
        else if (fn === "oklab") out.push(fromOklab(nums[0], nums[1], nums[2]));
        else if (fn === "oklch") out.push(fromOklab(nums[0], nums[1] * Math.cos((nums[2] * Math.PI) / 180), nums[1] * Math.sin((nums[2] * Math.PI) / 180)));
      }
      return out;
    };
    const tokens = crimsonColors.flatMap((c) => colorsIn(c));
    const near = (a, b) => a.every((x, i) => Math.abs(x - b[i]) <= 2);
    const usesCrimson = (el) => {
      if (tokens.length === 0) return false;
      const cs = getComputedStyle(el);
      const vals = [cs.color, cs.backgroundColor, cs.borderTopColor, cs.borderRightColor, cs.borderBottomColor, cs.borderLeftColor, cs.boxShadow, cs.filter, cs.stroke, cs.fill];
      return vals.some((v) => typeof v === "string" && colorsIn(v).some((c) => tokens.some((t) => near(c, t))));
    };
    const newSel =
      ".mf-vintro, .mf-vintro *, .mf-vchip, .mf-varrow, .mf-varrow *, .mf-morningcard--amber, .mf-morningcard--amber *, .mf-pk--vote, .mf-execvote, .mf-execvote *, .mf-defchips, .mf-defchips *, .mf-dt__dim--verdict, .mf-dt__cone";
    // 진홍 토큰을 못 받았으면 0 이 아니라 null — 0 이면 아무것도 못 센 채로 「진홍 0」 검사를 통과해 버린다(lib 은 null 을 측정값 없음으로 실패시킨다)
    const crimsonNew = tokens.length === 0 ? null : qa(newSel).filter((el) => visible(el) && usesCrimson(el)).length;
    const crimsonScreen = tokens.length === 0 ? null : qa("body *").filter((el) => el.tagName !== "SCRIPT" && el.tagName !== "STYLE" && visible(el) && usesCrimson(el)).length;

    // ---- 결과 화면 ----
    const resultRoot = q(".mf-result");
    let result = null;
    if (resultRoot) {
      const cards = qa(".mf-result__card", resultRoot).map((el) => {
        const art = q(".mf-result__art", el);
        return {
          seat: seatOf(el),
          job: text(q(".mf-result__role", el)),
          dead: el.classList.contains("mf-result__card--dead"),
          figOpacity: art ? Number(getComputedStyle(art).opacity) : Number.NaN,
        };
      });
      const scrollers = [document.documentElement, document.body, resultRoot];
      const worst = scrollers.reduce((a, b) => (b.scrollWidth - b.clientWidth > a.scrollWidth - a.clientWidth ? b : a), scrollers[0]);
      // [처음으로] 는 세로 스크롤로 닿아야 한다: 가까운 쪽으로 즉시 스크롤한 뒤 뷰포트 안에 있고 맨 위 요소가 그 버튼인지 본다(읽기 마지막에 한다)
      const btn = qa("button", resultRoot).find((b) => text(b) === "처음으로") ?? null;
      let reachedButton = false;
      if (btn) {
        btn.scrollIntoView({ block: "nearest", behavior: "instant" });
        const r = btn.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        reachedButton = r.width > 0 && r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth && !!hit && btn.contains(hit);
      }
      result = {
        winner: resultRoot.getAttribute("data-winner") ?? "",
        stage: resultRoot.getAttribute("data-stage") ?? "", // 계약 밖 덧붙임: neutral|flip|done — 공개 연출이 끝난(done) 뒤에 읽어야 카드 불투명도가 최종값이다
        bannerText: text(q(".mf-result__banner-title", resultRoot)),
        bannerSub: text(q(".mf-result__banner-sub", resultRoot)),
        cards,
        rows: qa(".mf-result__sm-row", resultRoot).length,
        scrollW: worst.scrollWidth,
        clientW: worst.clientWidth,
        reachedButton,
        glow: q(".mf-result__glow") !== null,
        hasPhaseBar: q(".mf-phasebar") !== null || q(".mf-timer__num") !== null || q(".mf-dayscene__panel") !== null,
      };
    }

    // now: 계약 밖 덧붙임 — 읽은 순간의 page 시계(performance.now). readVerdictWatch 의 *At 값과 같은 시계라 표본 t 를 카드 도착 기준으로 환산할 수 있다
    return { bottom, dt, intro, voidCard, execCard, card, reveal, crimsonNew, crimsonScreen, result, now: performance.now() };
  }, crimson);
}

// ---- 조작·관찰·표본 ----

/**
 * 테스트 시트가 열려 있어야 한다(대기실에서만 그룹이 보인다). 값은 프로토콜 값이다:
 * exec = "random"|"yes"|"no" (무작위|모두 찬성|모두 반대), pick = "random"|"host"|"other" (무작위|방장|방장 아닌 사람).
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
  await press("봇 처형 투표", execLabel);
  await tracker.waitFor((v) => (v.me.testBotVote?.exec ?? "random") === exec, 3000, `봇 처형 투표 ${exec}`);
  await press("봇 후보 선택", pickLabel);
  await tracker.waitFor(want, 3000, `봇 투표 고정 ${exec}/${pick}`);
}

/** 하단 `.mf-seg__b` [찬성]/[반대] 를 눌러 me.voteAgree 가 기대 값이 될 때까지 기다린다. 인트로 카드는 터치를 통과시킨다. */
export async function voteAs(page, tracker, choice) {
  if (choice !== "찬성" && choice !== "반대") throw new Error(`voteAs 는 "찬성"|"반대" 만 받음: ${choice}`);
  const want = choice === "찬성";
  try {
    await page.locator(".mf-execvote .mf-seg__b", { hasText: choice }).click({ timeout: 4000 });
  } catch (e) {
    throw new SetupError(`${choice} 버튼을 누르지 못함 (${e instanceof Error ? e.name : "오류"})`);
  }
  await tracker.waitFor((v) => v.me.voteAgree === want, 3000, `내 처형 여부 표 ${choice}`);
}

/** 그 자리 `button.mf-dt__seat[data-seat]` 를 맨 위 겹침 점에서 눌러 me.voteTarget 이 그 자리가 될 때까지 기다린다. */
export async function pickCandidate(page, tracker, seat) {
  try {
    await page.locator(`button.mf-dt__seat--pick[data-seat="${seat}"]`).waitFor({ state: "visible", timeout: 4000 });
  } catch {
    throw new SetupError(`자리 ${seat} 의 후보 선택 버튼이 보이지 않음`);
  }
  await clickTopmostPoint(page, seat);
  await tracker.waitFor((v) => v.me.voteTarget === seat, 3000, `후보 선택 자리 ${seat}`);
}

/**
 * 빈 곳 탭 점(결정 0040 P12). 장면 상자(.mf-dayscene__scene)와 그 안의 [data-seat]·.mf-tt-anchor·button 상자를 읽고,
 * lib 의 blankPointsOf(margin BLANK_TAP_E2E_MARGIN, step 8) 후보를 순서대로 elementFromPoint 로 확인해 맨 위 요소가 장면 안이고
 * [data-seat]·button·.mf-tt-anchor 안이 아닌 첫 점을 돌려준다. 없으면 null.
 */
export async function findBlankScenePoint(page) {
  const geo = await page.evaluate(() => {
    const scene = document.querySelector(".mf-dayscene__scene");
    if (!scene) return null;
    const box = (el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    };
    return { scene: box(scene), avoid: [...scene.querySelectorAll("[data-seat], .mf-tt-anchor, button")].map(box) };
  });
  if (!geo) return null;
  const candidates = blankPointsOf({ scene: geo.scene, avoid: geo.avoid, margin: BLANK_TAP_E2E_MARGIN, step: 8, limit: 400 });
  if (candidates.length === 0) return null;
  return page.evaluate((pts) => {
    const scene = document.querySelector(".mf-dayscene__scene");
    for (const p of pts) {
      const top = document.elementFromPoint(p.x, p.y);
      if (!top || !scene || !scene.contains(top)) continue;
      if (top.closest("[data-seat], button, .mf-tt-anchor")) continue;
      return p;
    }
    return null;
  }, candidates);
}

/**
 * 이름표 통과 점(결정 0040 P12). 장면의 .mf-dt__tag[data-seat] 를 preferSeat 먼저 순서로 돌며 상자 안 7×3 격자 점 중
 * elementFromPoint 의 맨 위 요소가 장면 안이고 [data-seat]·button 안이 아닌 첫 점({ x, y, seat })을 돌려준다.
 * 이름표는 pointer-events none 이라 탭이 아래 요소(테이블 면 등)로 빠지는 점이다. 없으면 null.
 */
export async function findTagPassThroughPoint(page, preferSeat) {
  return page.evaluate((prefer) => {
    const scene = document.querySelector(".mf-dayscene__scene");
    if (!scene) return null;
    const tags = [...scene.querySelectorAll(".mf-dt__tag[data-seat]")];
    tags.sort((a, b) => (Number(a.getAttribute("data-seat")) === prefer ? -1 : 0) - (Number(b.getAttribute("data-seat")) === prefer ? -1 : 0));
    for (const tag of tags) {
      const r = tag.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      for (let j = 0; j < 3; j++) {
        for (let i = 0; i < 7; i++) {
          const x = r.left + (r.width * (i + 0.5)) / 7;
          const y = r.top + (r.height * (j + 0.5)) / 3;
          const top = document.elementFromPoint(x, y);
          if (!top || !scene.contains(top) || top.closest("[data-seat], button")) continue;
          return { x, y, seat: Number(tag.getAttribute("data-seat")) };
        }
      }
    }
    return null;
  }, preferSeat);
}

/** 그 점을 터치로 탭한다(vote5 문맥은 hasTouch). */
export async function tapAt(page, pt) {
  await page.touchscreen.tap(pt.x, pt.y);
}

/**
 * 그 점을 마우스로 정확히 누른다. 터치 탭은 Chromium 의 탭 대상 보정이 가까운 버튼(좌석)으로 클릭을 옮기므로(261029-vvd 로컬 확인: 이름표 점의 탭이
 * 좌석 그림으로 가 앱의 좌표 판정을 거치지 않았다), 이름표를 통과한 클릭이 정말 장면 상자의 빈 요소로 닿게 하려면 보정 없는 마우스 클릭을 쓴다.
 */
export async function clickAt(page, pt) {
  await page.mouse.click(pt.x, pt.y);
}

/** 추적 단계가 목록 중 하나가 될 때까지 기다린다(분기 단계처럼 skipTo 가 못 가는 경우). 못 오면 SetupError. */
export function waitPhaseIn(tracker, phases, ms = 15_000) {
  return tracker.waitFor((v) => phases.includes(v.phase), ms, `단계 ${phases.join("|")} 도달`);
}

/** 표본 수 상한 — 과도한 표본으로 느려지지 않게 한다. */
export const MAX_SERIES_SAMPLES = 600;

/**
 * stepMs 간격으로 take() 를 불러 [{ t, value }] 를 돌려준다(t = 시작 기준 ms, 오름차순). take 가 느려도 밀린 표본을 몰아서 찍지 않고 다음 간격으로 넘어간다.
 * 표본 수가 MAX_SERIES_SAMPLES 를 넘을 간격이면 던진다(조용히 자르면 뒷부분 검사가 측정값 없음이 된다).
 */
export async function sampleSeries(page, { durationMs, stepMs, take }) {
  if (!(durationMs >= 0) || !(stepMs >= 10) || typeof take !== "function") throw new Error("sampleSeries 인자가 올바르지 않음");
  const planned = Math.floor(durationMs / stepMs) + 1;
  if (planned > MAX_SERIES_SAMPLES) throw new Error(`표본 ${planned}개 > 상한 ${MAX_SERIES_SAMPLES} (간격을 늘리세요)`);
  const start = performance.now();
  const out = [];
  for (let i = 0; i < planned; i++) {
    const wait = start + i * stepMs - performance.now();
    if (wait > 0) await sleep(wait);
    const t = performance.now() - start;
    out.push({ t, value: await take(page) });
  }
  return out;
}

/**
 * sampleSeries 결과의 t 를 카드 도착(readVerdictWatch 의 *SeenAt, page 시계) 기준으로 바꾸고 도착 전 표본은 버린다.
 * 표본 값에 page 시계 `now`(readVerdict 가 싣는다)가 들어 있어야 한다. P2·P7 처럼 `t` 가 「카드 도착 이후 ms」인 검사에 쓴다 —
 * 표본기는 단계를 넘기기 전에 시작하고(간격 ≤ 100ms, 안 그러면 lib 의 1500ms 여유가 모자란다) 도착 시각은 감시 값으로 환산한다.
 */
export function rebaseSeries(series, originAt, nowOf = (value) => value.now) {
  return series.filter((s) => nowOf(s.value) >= originAt).map((s) => ({ t: nowOf(s.value) - originAt, value: s.value }));
}

/**
 * 인트로 카드(`.mf-vintro` 비-void)·처형 무효 카드(`--void`)·밤 시작 문구(`.mf-sceneintro--night`)가 DOM 에 처음 나타난 시각과 사라진 시각을
 * MutationObserver 로 붙잡아 둔다(performance.now 기준). 카드는 3초(처형 투표)·1.6초(처형 무효)뿐이라 폴링하면 시간 경쟁이 생기므로 단계를 넘기기 전에 건다(armIntroWatch 와 같은 방식).
 */
export async function armVerdictWatch(page) {
  await page.evaluate(() => {
    window.__vwObs?.disconnect();
    const w = { introSeenAt: null, introGoneAt: null, voidSeenAt: null, voidGoneAt: null, nightIntroSeenAt: null };
    window.__vw = w;
    const look = () => {
      const now = performance.now();
      const intro = document.querySelector(".mf-vintro:not(.mf-vintro--void)") !== null;
      const vd = document.querySelector(".mf-vintro--void") !== null;
      if (intro && w.introSeenAt === null) w.introSeenAt = now;
      if (!intro && w.introSeenAt !== null && w.introGoneAt === null) w.introGoneAt = now;
      if (vd && w.voidSeenAt === null) w.voidSeenAt = now;
      if (!vd && w.voidSeenAt !== null && w.voidGoneAt === null) w.voidGoneAt = now;
      if (w.nightIntroSeenAt === null && document.querySelector(".mf-sceneintro--night") !== null) w.nightIntroSeenAt = now;
    };
    window.__vwObs = new MutationObserver(look);
    window.__vwObs.observe(document.body, { childList: true, subtree: true });
    look();
  });
}

/** armVerdictWatch 가 붙잡은 { introSeenAt, introGoneAt, voidSeenAt, voidGoneAt, nightIntroSeenAt } (없으면 null)를 읽고 관찰자를 끈다. */
export async function readVerdictWatch(page) {
  return page.evaluate(() => {
    window.__vwObs?.disconnect();
    window.__vwObs = null;
    return window.__vw ?? { introSeenAt: null, introGoneAt: null, voidSeenAt: null, voidGoneAt: null, nightIntroSeenAt: null };
  });
}

/** 결과 화면의 [처음으로] 를 스크롤로 보이게 해 누르고 입구 화면(h1 Minifia + [방 만들기])이 보일 때까지 기다린다. 실패는 예외. */
export async function leaveFromResult(page) {
  const btn = page.locator(".mf-result").getByRole("button", { name: "처음으로", exact: true });
  try {
    await btn.scrollIntoViewIfNeeded({ timeout: 4000 });
    await btn.click({ timeout: 4000 });
    await page.getByRole("heading", { level: 1, name: "Minifia", exact: true }).waitFor({ state: "visible", timeout: 6000 });
    await page.getByRole("button", { name: "방 만들기" }).waitFor({ state: "visible", timeout: 3000 });
  } catch (e) {
    throw new Error(`[처음으로] 뒤 입구 화면에 도달하지 못함 (${e instanceof Error ? e.name : "오류"})`);
  }
}
