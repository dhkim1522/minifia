// ?perf=1 성능 스파이크 자동 측정(결정 0055-2): 시스템 Chrome(playwright-core)으로 스파이크 장면을 열고
// CDP 로 CPU 감속(Emulation.setCPUThrottlingRate)·화면 배율(Emulation.setDeviceMetricsOverride)을 건 뒤,
// window.__mfPerf.result 가 생기면 결과 JSON 과 결과 카드 스크린샷을 저장한다. 판정은 하지 않는다(숫자만 남긴다).
//
// 사용법:
//   node scripts/perf-run.mjs [--url http://localhost:5173] [--scene talk|vote] [--minutes 5] [--dpr 2]
//        [--throttle 4] [--size 390x844] [--out .planning/phases/06-world-skeleton/perf/] [--headed]
//        [--budget 0] [--seed 1] [--shot [--file 이름]]
//   node scripts/perf-run.mjs --mode interactive [--url ...] [--throttle 4] [--runs 3] [--size 390x844] [--dpr 2] [--out ...] [--headed]
//   --url      기본은 v2.0 공개 주소(deploy-target.expectedOrigin). v1.0 주소는 어떤 요청보다 먼저 거부한다(결정 0055-2·0043).
//   --throttle CPU 감속 배율(기본 4 — DevTools 의 "CPU 4× slowdown" 과 같은 CDP 명령). 1 이면 감속 없음.
//   --shot     측정 대신 화면만 찍는다: ?shot=1 이 10초에 멈추면 HUD 없이 장면을 PNG 로 저장한다(조명 대조용). 결과 JSON 은 없다.
//   --file     저장 파일 이름(확장자 없이). 기본 desktop-{scene}-dpr{dpr}-x{throttle}(--shot 은 앞에 shot-).
//   --mode     perf(기본, ?perf=1 스파이크) | interactive(06-19: 제품 로비 경로 반응 측정). interactive 는 매번 새 컨텍스트(캐시 없음)에서
//              CPU 감속 + 네트워크 "Fast 4G" 프리셋(Chrome DevTools NetworkManager.ts Fast4GConditions: 아래 FAST_4G)으로 `${origin}/?e2e=1` 를 열어
//              [방 만들기] → 닉네임 [만들기] → 입장(room-enter) → 맵 조작 가능(map-interactive) 까지의 ms, 걸을 수 있는 점을 누른 뒤 링(data-ring)·
//              내 캐릭터 출발(sample 이 움직임)까지의 ms 를 --runs 번(기본 3) 재서 중앙값과 함께 저장한다. 방은 끝에 나가서 지운다.
//   --runs     interactive 반복 횟수(기본 3)
// 종료 코드: 0 = 결과 저장, 1 = 인자·주소·Chrome·시간 초과·페이지 오류.
// 가정(A1): 헤드리스 시스템 Chrome 의 CPU 4배 스로틀은 DevTools 와 같은 메커니즘이다. 헤드리스 여부·Chrome 버전은 결과 JSON 의 runner 에 적는다.
// 결과를 서버로 보내지 않는다. 대상 주소에 보내는 요청은 페이지 자신의 에셋 요청뿐이다.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { exitIfV1, expectedOrigin } from "./deploy-target.mjs";
import { FONT_HOSTS, findChrome, parseBarMask, pickTapTargets, walkableCenters } from "./e2e/lib.mjs";
import { hitsInputSurface, leaveLobby, readWorld, screensOfWorld, waitWorldReady } from "./e2e/browser.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUT = join(REPO, ".planning/phases/06-world-skeleton/perf");
/** 결과 카드가 뜬 뒤 스크린샷 전에 잠깐 기다린다(ms) */
const CARD_SETTLE_MS = 400;
/** 측정 시간 말고 더 기다려 주는 여유(ms): 모듈 받기·맵 만들기·CPU 감속으로 늘어난 시간 */
const LOAD_SLACK_MS = 90_000;
/** --shot: ?shot=1 이 10초에 멈춘다 — 그 뒤까지 기다리는 한도(ms) */
const SHOT_WAIT_MS = 90_000;
/**
 * 네트워크 "Fast 4G" 프리셋(사용자 확정 2026-10-31, UI-SPEC 반응 행). 값과 출처:
 * Chrome DevTools 소스 front_end/core/sdk/NetworkManager.ts 의 Fast4GConditions
 * (https://github.com/ChromeDevTools/devtools-frontend/blob/main/front_end/core/sdk/NetworkManager.ts, 2026-11-01 확인):
 * download 9 Mbps × 0.9, upload 1.5 Mbps × 0.9, 왕복 60ms × 2.75 = 165ms. CDP Network.emulateNetworkConditions 단위는 바이트/초.
 */
export const FAST_4G = { offline: false, latency: 165, downloadThroughput: ((9 * 1000 * 1000) / 8) * 0.9, uploadThroughput: ((1.5 * 1000 * 1000) / 8) * 0.9 };
/** interactive: 방 만들기 흐름의 각 단계 대기 한도(ms) */
const INTERACTIVE_STEP_MS = 60_000;
/** interactive: 탭 뒤 링·출발을 기다리는 한도(ms) */
const TAP_WAIT_MS = 5_000;
/** interactive: 출발로 치는 최소 이동(월드 단위) */
const MOVE_EPS = 0.02;
const INTERACTIVE_NICK = "측정기";

const USAGE =
  "사용법: node scripts/perf-run.mjs [--mode perf|interactive] [--url 주소] [--scene talk|vote] [--minutes 5] [--dpr 2] [--throttle 4] [--size 390x844] [--out 폴더] [--headed] [--budget 0] [--seed 1] [--runs 3] [--shot [--file 이름]]";

class UsageError extends Error {}

/** 인자 해석(순수). 값이 필요한 옵션에 값이 없거나 숫자가 아니면 UsageError */
export function parseArgs(argv) {
  const o = { url: null, scene: "talk", minutes: 5, dpr: 2, throttle: 4, size: { w: 390, h: 844 }, out: DEFAULT_OUT, headed: false, budget: 0, seed: 1, shot: false, file: null, mode: "perf", runs: 3 };
  const need = (name, i) => {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) throw new UsageError(`${name} 에 값이 필요합니다`);
    return v;
  };
  const num = (name, v, { min, max }) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < min || n > max) throw new UsageError(`${name} 값이 잘못됨: ${v}`);
    return n;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--url": o.url = need(a, i++); break;
      case "--scene": {
        const v = need(a, i++);
        if (v !== "talk" && v !== "vote") throw new UsageError(`--scene 은 talk 또는 vote: ${v}`);
        o.scene = v;
        break;
      }
      case "--minutes": o.minutes = num(a, need(a, i++), { min: 0.05, max: 60 }); break;
      case "--dpr": o.dpr = num(a, need(a, i++), { min: 0.5, max: 4 }); break;
      case "--throttle": o.throttle = num(a, need(a, i++), { min: 1, max: 20 }); break;
      case "--budget": o.budget = Math.floor(num(a, need(a, i++), { min: 0, max: 5 })); break;
      case "--seed": o.seed = Math.floor(num(a, need(a, i++), { min: 0, max: 2 ** 31 })); break;
      case "--size": {
        const m = /^(\d{2,4})x(\d{2,4})$/.exec(need(a, i++));
        if (!m) throw new UsageError("--size 는 390x844 같은 모양");
        o.size = { w: Number(m[1]), h: Number(m[2]) };
        break;
      }
      case "--mode": {
        const v = need(a, i++);
        if (v !== "perf" && v !== "interactive") throw new UsageError(`--mode 는 perf 또는 interactive: ${v}`);
        o.mode = v;
        break;
      }
      case "--runs": o.runs = Math.floor(num(a, need(a, i++), { min: 1, max: 20 })); break;
      case "--out": o.out = resolve(need(a, i++)); break;
      case "--file": o.file = need(a, i++); break;
      case "--headed": o.headed = true; break;
      case "--shot": o.shot = true; break;
      default: throw new UsageError(`알 수 없는 옵션: ${a}`);
    }
  }
  return o;
}

/** 저장 파일 이름(확장자 없이). 두 번째 값(결과 JSON)과 스크린샷이 같은 이름을 쓴다 */
export function outputBase(o) {
  if (o.file) return o.file;
  if (o.mode === "interactive") return `interactive-dpr${o.dpr}-x${o.throttle}`;
  const base = `desktop-${o.scene}-dpr${o.dpr}-x${o.throttle}`;
  return o.shot ? `shot-${base}` : base;
}

/** 열 주소: 대상 + 스파이크 쿼리 */
export function targetUrl(o, origin) {
  const q = new URLSearchParams({ perf: "1", scene: o.scene, minutes: String(o.minutes), dpr: String(o.dpr), seed: String(o.seed), budget: String(o.budget) });
  if (o.shot) q.set("shot", "1");
  return `${origin.replace(/\/+$/, "")}/?${q.toString()}`;
}

/** 가운데 값(짝수 개면 두 가운데의 평균). 비었거나 숫자가 아닌 값이 있으면 null */
export function median(values) {
  if (values.length === 0 || values.some((v) => typeof v !== "number" || !Number.isFinite(v))) return null;
  const a = [...values].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

/** interactive 한 번: 새 컨텍스트에서 제품 로비 경로로 입장 → 맵 조작 가능 → 탭 → 링·출발. 실패는 던진다(부른 쪽이 기록) */
async function interactiveOnce(browser, o, origin, index) {
  const context = await browser.newContext({ viewport: { width: o.size.w, height: o.size.h }, deviceScaleFactor: o.dpr, isMobile: true, hasTouch: true, locale: "ko-KR" });
  const issues = [];
  let page = null;
  try {
    // 대상 주소와 앱 글꼴 두 곳 밖의 요청은 막는다(E2E 와 같은 규칙)
    await context.route("**/*", (route) => {
      let u;
      try {
        u = new URL(route.request().url());
      } catch {
        return route.continue();
      }
      if (u.origin === origin || FONT_HOSTS.includes(u.hostname)) return route.continue();
      issues.push(`대상 밖 요청 막음: ${u.origin}`);
      return route.abort();
    });
    // 맵 로비 테스트 훅(window.__mfWorld)은 ?e2e=1 세션 플래그가 켠다. 방에 들어가면 주소에서 쿼리가 사라지므로 E2E 와 같이 세션 저장소에 미리 쓴다(src/world/testHooks.ts WORLD_TEST_KEY).
    await context.addInitScript((key) => {
      try {
        window.sessionStorage.setItem(key, "1");
      } catch {
        /* 저장소가 막힌 환경은 훅이 꺼진 채로 둔다 — 아래 대기가 시간 초과로 실패한다 */
      }
    }, "minifia:e2e");
    page = await context.newPage();
    page.setDefaultTimeout(INTERACTIVE_STEP_MS);
    page.on("pageerror", (e) => issues.push(`페이지 오류: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error") issues.push(`콘솔 오류: ${m.text().slice(0, 200)}`);
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: o.size.w, height: o.size.h, deviceScaleFactor: o.dpr, mobile: true });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: o.throttle });
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", FAST_4G);

    await page.goto(`${origin}/?e2e=1`, { waitUntil: "load" });
    await page.getByRole("button", { name: "방 만들기" }).first().click();
    await page.locator(".mf-nick-sheet input").fill(INTERACTIVE_NICK);
    await page.getByRole("button", { name: "만들기", exact: true }).click();

    // 입장(room-enter) → 맵 조작 가능(map-interactive)
    await page.waitForFunction(() => window.__mfWorld?.interactiveMs?.() != null, null, { timeout: INTERACTIVE_STEP_MS, polling: 50 });
    const marks = await page.evaluate(() => ({
      roomEnter: performance.getEntriesByName("room-enter").at(-1)?.startTime ?? null,
      interactive: window.__mfWorld.interactiveMs(),
    }));
    if (marks.roomEnter === null) throw new Error("performance.mark('room-enter') 없음");
    const enterToInteractiveMs = marks.interactive - marks.roomEnter;

    await waitWorldReady(page, 1);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.waitForTimeout(500);

    // 걸을 수 있는 점 하나: 무대 안에 보이고 입력 면 위에 있는 칸 중 내 캐릭터에서 가장 먼 곳
    const w = await readWorld(page);
    const me = w.tags.find((t) => t.me);
    if (!me) throw new Error("내 이름표를 찾지 못함");
    const from = await page.evaluate((seat) => window.__mfWorld.sample(seat), me.seat);
    if (!from) throw new Error("내 위치를 읽지 못함(sample)");
    const source = readFileSync(join(REPO, "shared/game/map.ts"), "utf8");
    const centers = walkableCenters(parseBarMask(source));
    const pad = 28;
    const screens = await screensOfWorld(page, centers);
    const st = w.stage;
    const onScreen = centers
      .map((c, i) => ({ ...c, sx: screens[i]?.sx, sy: screens[i]?.sy }))
      .filter((c) => st && Number.isFinite(c.sx) && c.sx > pad && c.sx < o.size.w - pad && c.sy > st.top + pad && c.sy < st.bottom - pad);
    const probe = pickTapTargets(onScreen, from, { minDist: 3 }).slice(0, 40);
    const hits = await hitsInputSurface(page, probe);
    const target = probe.find((_, i) => hits[i]);
    if (!target) throw new Error(`탭할 목적지를 찾지 못함(보이는 칸 ${onScreen.length}개)`);

    // 손 뗌 시각 → data-ring 이 새로 생김 / 내 sample 이 처음 움직임. 둘 다 페이지 안 시계(performance.now)로 잰다.
    await page.evaluate(
      ({ seat, from0, eps }) => {
        const root = document.querySelector("[data-world-stage]");
        const watch = { up: null, ring: null, start: null, prev: root?.getAttribute("data-ring") ?? null };
        window.__tapWatch = watch;
        document.addEventListener(
          "pointerup",
          (e) => {
            watch.up = e.timeStamp;
            const loop = () => {
              const p = window.__mfWorld.sample(seat);
              if (watch.start === null && p && Math.hypot(p.x - from0.x, p.z - from0.z) > eps) watch.start = performance.now();
              if (watch.start === null) requestAnimationFrame(loop);
            };
            requestAnimationFrame(loop);
          },
          { capture: true, once: true },
        );
        new MutationObserver(() => {
          const v = root?.getAttribute("data-ring") ?? null;
          if (watch.ring === null && v !== null && v !== watch.prev && watch.up !== null) watch.ring = performance.now();
        }).observe(root, { attributes: true, attributeFilter: ["data-ring"] });
      },
      { seat: me.seat, from0: from, eps: MOVE_EPS },
    );
    await page.mouse.move(target.sx, target.sy);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForFunction(() => window.__tapWatch?.ring != null && window.__tapWatch?.start != null, null, { timeout: TAP_WAIT_MS, polling: 20 }).catch(() => {});
    const watch = await page.evaluate(() => ({ up: window.__tapWatch.up, ring: window.__tapWatch.ring, start: window.__tapWatch.start }));
    const ringMs = typeof watch.up === "number" && typeof watch.ring === "number" ? watch.ring - watch.up : null;
    const startMs = typeof watch.up === "number" && typeof watch.start === "number" ? watch.start - watch.up : null;

    const png = join(o.out, `${outputBase(o)}-run${index + 1}.png`);
    await page.screenshot({ path: png });
    await leaveLobby(page);
    return { run: index + 1, enterToInteractiveMs, ringMs, startMs, roomEnterAt: marks.roomEnter, mapInteractiveAt: marks.interactive, screenshot: png, issues: [...new Set(issues)].slice(0, 8) };
  } catch (e) {
    // 어디서 막혔는지 남긴다: 주소·훅·맵 상태·보이는 글자 앞부분(토큰·코드는 싣지 않는다)
    const diag = page
      ? await page
          .evaluate(() => ({
            path: location.pathname.replace(/\d{4}/g, "####"),
            hook: !!window.__mfWorld,
            status: window.__mfWorld?.status?.() ?? null,
            e2eFlag: (() => { try { return sessionStorage.getItem("minifia:e2e"); } catch { return "읽기 실패"; } })(),
            marks: performance.getEntriesByType("mark").map((m) => m.name),
            text: (document.body?.innerText ?? "").replace(/\d{4}/g, "####").slice(0, 120),
          }))
          .catch(() => null)
      : null;
    const err = new Error(`${e instanceof Error ? e.message.split("\n")[0] : String(e)} | 진단 ${JSON.stringify(diag)} | 신호 ${JSON.stringify([...new Set(issues)].slice(0, 4))}`);
    throw err;
  } finally {
    await context.close().catch(() => {});
  }
}

async function runInteractive(browser, o, origin, chrome) {
  const runs = [];
  const failures = [];
  for (let i = 0; i < o.runs; i++) {
    try {
      const r = await interactiveOnce(browser, o, origin, i);
      runs.push(r);
      console.log(`회차 ${r.run}: 입장 → 조작 ${r.enterToInteractiveMs.toFixed(0)}ms · 탭 → 링 ${r.ringMs === null ? "-" : `${r.ringMs.toFixed(0)}ms`} · 탭 → 출발 ${r.startMs === null ? "-" : `${r.startMs.toFixed(0)}ms`}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message.split("\n")[0] : String(e);
      failures.push({ run: i + 1, error: msg });
      console.error(`회차 ${i + 1} 실패: ${msg}`);
    }
  }
  const medians = {
    enterToInteractiveMs: median(runs.map((r) => r.enterToInteractiveMs)),
    ringMs: median(runs.map((r) => r.ringMs)),
    startMs: median(runs.map((r) => r.startMs)),
  };
  const runner = {
    tool: "scripts/perf-run.mjs --mode interactive",
    throttle: o.throttle,
    dpr: o.dpr,
    size: `${o.size.w}x${o.size.h}`,
    headless: !o.headed,
    chrome: browser.version(),
    platform: `${process.platform}/${process.arch}`,
    node: process.version,
    url: `${origin}/?e2e=1`,
    network: { preset: "Fast 4G", ...FAST_4G, source: "ChromeDevTools/devtools-frontend front_end/core/sdk/NetworkManager.ts Fast4GConditions (9 Mbps x0.9 down, 1.5 Mbps x0.9 up, 60ms x2.75 RTT)" },
    chromeBinary: chrome,
  };
  const json = join(o.out, `${outputBase(o)}.json`);
  writeFileSync(json, `${JSON.stringify({ runner, runs, failures, medians }, null, 2)}\n`);
  console.log(`결과 저장: ${json}`);
  console.log(`중앙값: 입장 → 조작 ${medians.enterToInteractiveMs?.toFixed(0) ?? "-"}ms · 탭 → 링 ${medians.ringMs?.toFixed(0) ?? "-"}ms · 탭 → 출발 ${medians.startMs?.toFixed(0) ?? "-"}ms (성공 ${runs.length}/${o.runs})`);
  return runs.length === o.runs ? 0 : 1;
}

async function main() {
  let o;
  try {
    o = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`${e instanceof Error ? e.message : String(e)}\n${USAGE}`);
    process.exit(1);
  }

  const target = o.url ?? expectedOrigin();
  // 어떤 요청보다 먼저: v1.0 주소면 한국어 한 줄을 찍고 종료 상태 1 (결정 0055-2·0043)
  exitIfV1(target);
  let origin;
  try {
    const u = new URL(target);
    if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("http(s) 가 아님");
    origin = u.origin;
  } catch {
    console.error(`주소가 잘못됨: ${target}`);
    process.exit(1);
  }

  let chrome;
  try {
    chrome = findChrome(process.platform, process.env, existsSync);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }

  mkdirSync(o.out, { recursive: true });
  const base = outputBase(o);
  const url = targetUrl(o, origin);
  const browser = await chromium.launch({ executablePath: chrome, headless: !o.headed });
  if (o.mode === "interactive") {
    let c = 1;
    try {
      c = await runInteractive(browser, o, origin, chrome);
    } finally {
      await browser.close().catch(() => {});
    }
    process.exit(c);
  }
  const issues = [];
  let code = 0;
  try {
    const context = await browser.newContext({ viewport: { width: o.size.w, height: o.size.h }, deviceScaleFactor: o.dpr, locale: "ko-KR" });
    const page = await context.newPage();
    page.on("pageerror", (e) => issues.push(`페이지 오류: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error") issues.push(`콘솔 오류: ${m.text().slice(0, 200)}`);
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: o.size.w, height: o.size.h, deviceScaleFactor: o.dpr, mobile: false });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: o.throttle });

    console.log(`열기: ${url}  (CPU ${o.throttle}×, DPR ${o.dpr}, ${o.size.w}x${o.size.h}, ${o.headed ? "헤디드" : "헤드리스"})`);
    await page.goto(url, { waitUntil: "load" });

    if (o.shot) {
      // ?shot=1 은 10초에 시나리오·HUD 를 멈춘다 — HUD 가 숨으면 찍는다
      await page.waitForFunction(() => document.querySelector("[data-perf-hud]")?.style.display === "none", null, { timeout: SHOT_WAIT_MS, polling: 500 });
      const png = join(o.out, `${base}.png`);
      await page.screenshot({ path: png });
      console.log(`장면 저장: ${png}`);
    } else {
      const limit = o.minutes * 60_000 + LOAD_SLACK_MS * Math.max(1, o.throttle / 2);
      await page.waitForFunction(() => window.__mfPerf?.result != null, null, { timeout: limit, polling: 1000 });
      await page.waitForTimeout(CARD_SETTLE_MS);
      const result = await page.evaluate(() => window.__mfPerf.result);
      const json = join(o.out, `${base}.json`);
      const png = join(o.out, `${base}.png`);
      const runner = { tool: "scripts/perf-run.mjs", throttle: o.throttle, dpr: o.dpr, size: `${o.size.w}x${o.size.h}`, headless: !o.headed, chrome: browser.version(), platform: `${process.platform}/${process.arch}`, node: process.version, url };
      writeFileSync(json, `${JSON.stringify({ runner, ...result }, null, 2)}\n`);
      await page.screenshot({ path: png });
      const f = result.frames;
      console.log(`결과 저장: ${json}`);
      console.log(`스크린샷: ${png}`);
      console.log(`평균 ${f.avgFps.toFixed(1)}fps · 끊김 ${f.jank} · p95 ${f.p95.toFixed(1)}ms · rAF ${f.rafHz}Hz · calls ${result.renderer?.calls ?? "-"} · triangles ${result.renderer?.triangles ?? "-"}`);
    }
  } catch (e) {
    code = 1;
    console.error(`측정 실패: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`);
  } finally {
    await browser.close().catch(() => {});
  }
  if (issues.length > 0) {
    console.error(`페이지 신호 ${issues.length}건:\n${[...new Set(issues)].slice(0, 8).join("\n")}`);
  }
  process.exit(code);
}

// 모듈로 가져와 시험할 수 있게, 직접 실행했을 때만 돈다
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
