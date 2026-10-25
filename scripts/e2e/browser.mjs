// 화면 E2E 의 브라우저 쪽(결정 0025). Node 는 HTTP 로 테스트 방만 만들고 소켓을 열지 않는다 —
// 방장 소켓은 브라우저 페이지가 쥔다(스크립트가 쥐면 앱이 앞 소켓을 4001 로 대체한다).
// 토큰은 createTestRoom 결과와 addInitScript 인자에만 머문다. 페이지가 받은 state 프레임만 읽고 보낸 프레임은 구독하지 않는다.
import { chromium } from "playwright-core";
import { DECORATIVE_ALLOW, FONT_HOSTS, ROLE_NAME, TAP_ALLOW, TEXT_SIZE_ALLOW, redact } from "./lib.mjs";

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

export function launchChrome(executablePath) {
  return chromium.launch({ executablePath, headless: true });
}

/**
 * 방장으로 붙은 휴대폰 크기 페이지를 연다.
 * 돌려주는 값: { context, page, tracker, takeIssues, fontOk, fontDetail }
 */
export async function openHostPage(browser, { origin, code, token, size, dpr }) {
  const context = await browser.newContext({
    viewport: { width: size.w, height: size.h },
    deviceScaleFactor: dpr,
    isMobile: true,
    hasTouch: true,
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
  page.on("websocket", (ws) => {
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
      }
    });
  });

  await page.goto(`${origin}/r/${code}`, { waitUntil: "domcontentloaded" });
  await tracker.waitFor((v) => v.phase === "lobby" && v.me?.isHost === true && v.me?.testMode === true, 15_000, "방장으로 연결");

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

/** 밤 시작 문구(.mf-nightintro) 한 번 읽기. 없으면 null. */
export async function readNightIntro(page) {
  return page.evaluate(() => {
    const el = document.querySelector(".mf-nightintro");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      texts: [...el.querySelectorAll("p")].map((p) => (p.textContent || "").trim()),
      pointerEvents: getComputedStyle(el).pointerEvents,
      ariaHidden: el.getAttribute("aria-hidden") === "true",
      rect: { left: r.left, top: r.top, width: r.width, height: r.height },
    };
  });
}

export function shot(page, path) {
  return page.screenshot({ path });
}

/**
 * 장면 상자·머리·하단 패널·테이블 면·캐릭터·이름표 사각형을 한 번의 evaluate 로 읽는다(T1·T2, 결정 0028).
 * 낮·밤·아침(.mf-dayscene), 대기실(.mf-lobby), 역할 배정(.mf-assign) 어느 화면이든 같은 모양이다 — 없으면 null.
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
      scene: rect(first(".mf-dayscene__scene", ".mf-lobby__scene", ".mf-assign__scene")),
      header: rect(first(".mf-phasebar", ".mf-lobby__bar", ".mf-assign__bar")),
      panel: rect(first(".mf-dayscene__panel", ".mf-lobby__sheet", ".mf-assign__panel")),
      felt: rect(document.querySelector(".mf-dt__felt")),
      seats: [...document.querySelectorAll(".mf-dt__seat")].map((el) => ({
        seat: Number(el.getAttribute("data-seat")),
        rect: rect(el),
        spotlit: el.classList.contains("mf-dt__seat--spotlit"),
      })),
      tags: [...document.querySelectorAll(".mf-dt__tag")].map((el) => ({ seat: Number(el.getAttribute("data-seat")), rect: rect(el) })),
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
        elements.push({ desc: desc(el), rect: rectOf(el) });
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
      const chatTexts = (root) => [...root.querySelectorAll(".mf-msglog__item:not(.mf-msglog__item--sys) .mf-msglog__text")].map((e) => (e.textContent || "").trim());
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
          sel: !!el.querySelector(".mf-dt__sel"),
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

      const stEmoji = panel?.querySelector('.st-row [aria-label="이모티콘"]') ?? null;

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
              chips: [...panel.querySelectorAll('[aria-label="주장할 직업"] button')].map((b) => (b.textContent || "").replace(/\s+/g, " ").trim()),
              stRow: !!panel.querySelector(".st-row"),
              emojiBtn: stEmoji ? { rect: rectOf(stEmoji) } : null,
              quickBtn: [...panel.querySelectorAll("button")].some((b) => /빠른 메시지/.test(`${b.getAttribute("aria-label") ?? ""} ${b.textContent ?? ""}`)),
            }
          : null,
        guide: guide ? { rect: rectOf(guide), lineHeight: lineHeightOf(guide), text: (guide.textContent || "").trim() } : null,
        felt: rectOf(q(".mf-dt__felt")),
        seats,
        header: rectOf(q(".mf-phasebar")),
        tags,
        tagVisibility,
        turn: {
          spot: document.querySelectorAll(".mf-dt__spot").length,
          badge: document.querySelectorAll(".mf-dt__turn").length,
          tagTurn: document.querySelectorAll(".mf-dt__tag--turn").length,
          legacyRows: document.querySelectorAll(".mf-dt__claim").length,
          ring: (() => {
            // K4: 첫 차례 링 묶음과 두 호의 계산된 값. 문자열·값만 싣는다.
            const spotEl = q(".mf-dt__spot");
            if (!spotEl) return null;
            const cs = getComputedStyle(spotEl);
            const plain =
              cs.position === "absolute" && cs.zIndex === "auto" && cs.transform === "none" && cs.opacity === "1" && cs.filter === "none" &&
              cs.isolation === "auto" && cs.clipPath === "none" && cs.animationName === "none" && cs.willChange === "auto" && cs.mixBlendMode === "normal";
            const arc = (el) => {
              if (!el) return null;
              const a = getComputedStyle(el);
              const z = parseInt(a.zIndex, 10);
              return { z: Number.isFinite(z) ? z : null, position: a.position, clip: a.clipPath };
            };
            const seatEl = spotEl.closest(".mf-dt__seat");
            const front = spotEl.querySelector(".mf-dt__spot-arc--front");
            const fig = seatEl ? seatEl.querySelector("img.mf-figure") : null;
            const seatZ = seatEl ? parseInt(getComputedStyle(seatEl).zIndex, 10) : Number.NaN;
            return {
              plain,
              back: arc(spotEl.querySelector(".mf-dt__spot-arc--back")),
              front: arc(front),
              figBeforeFront: !!fig && !!front && !!(fig.compareDocumentPosition(front) & Node.DOCUMENT_POSITION_FOLLOWING),
              seatContext: Number.isFinite(seatZ),
            };
          })(),
        },
        dim: dim ? { rect: rectOf(dim), z: zOf(dim), pointerEvents: getComputedStyle(dim).pointerEvents } : null,
        card: rectOf(card),
        chatLines: chatTexts(document),
        chatHistory: chatTexts(q('dialog[aria-label="채팅 내역"][open]') ?? document.createElement("div")),
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
        mafiaLog: !!q('[aria-label="마피아 채팅"]'),
        lobbyCount: (q(".mf-lobby__count")?.textContent || "").trim(),
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

/** 시트를 닫고 [게임 시작] 을 눌러 역할 확인(roleReveal)까지 기다린다. */
export async function startGame(page, tracker) {
  await closeSheet(page);
  await page.locator(".mf-lobby__sheet").getByRole("button", { name: "게임 시작" }).click();
  await tracker.waitFor((v) => v.phase === "roleReveal", 8000, "역할 확인 도달");
}

/**
 * 시트를 열어 둔 채 [다음 단계로 넘기기] 를 눌러 목표 단계까지 간다. claim 에서 한 번은 차례 한 번이다(결정 0027-9)라
 * 진행 신호를 「단계 또는 마감 시각이 바뀜」으로 잡고 상한을 24 로 둔다(8명판 8차례 + 다른 단계). 끝나면 시트를 닫는다.
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

/** claim 에서 차례가 그 자리로 올 때까지 기다린다(받은 state 의 day.turn.seat 기준). */
export function waitTurnSeat(tracker, seat, ms = 15_000) {
  return tracker.waitFor((v) => v.phase === "claim" && v.day?.turn?.seat === seat, ms, `자리 ${seat} 차례`);
}

/** 내 차례 하단 칩을 글자로 눌러 차례나 단계가 넘어가길 기다린다. */
export async function pickChip(page, tracker, label) {
  const v = tracker.last();
  const before = { phase: v?.phase, seat: v?.day?.turn?.seat, ends: v?.phaseEndsAt };
  await page.locator('[aria-label="주장할 직업"]').getByRole("button", { name: label, exact: true }).click();
  await tracker.waitFor(
    (n) => n.phase !== before.phase || n.day?.turn?.seat !== before.seat || n.phaseEndsAt !== before.ends,
    4000,
    `칩 ${label} 뒤 다음 차례`,
  );
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

/** 채팅 줄 오른쪽 ^ 버튼으로 채팅 내역 시트를 연다. */
export async function openChatHistory(page) {
  await page.locator('[aria-label="채팅 내역 크게 보기"]').click();
  await page.locator('dialog[aria-label="채팅 내역"].mf-dialog--open').waitFor({ state: "attached", timeout: 5000 });
  await page.waitForTimeout(300);
}

/** 최선 노력: 열린 시트를 닫고 [대기실로 되돌리기] → 대기실에서 [나가기]. 실패는 무시한다. */
export async function resetAndLeave(page, tracker) {
  try {
    const open = await page.evaluate(() => [...document.querySelectorAll("dialog[open]")].map((d) => d.getAttribute("aria-label") ?? ""));
    for (const label of open) if (label === "역할 카드" || label === "채팅 내역" || label.endsWith(" 기록")) await closeSheet(page, label).catch(() => {});
    await openTestSheet(page);
    await clickInDialog(page, TT_LABEL, "대기실로 되돌리기");
    await tracker.waitFor((v) => v.phase === "lobby", 3000, "대기실 복귀");
    await page.waitForTimeout(300);
  } catch {
    /* 정리 실패는 결과에 넣지 않는다 */
  }
  await leaveLobby(page);
}
