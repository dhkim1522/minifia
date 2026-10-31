// ?perf=1 성능 스파이크 자동 측정(결정 0055-2): 시스템 Chrome(playwright-core)으로 스파이크 장면을 열고
// CDP 로 CPU 감속(Emulation.setCPUThrottlingRate)·화면 배율(Emulation.setDeviceMetricsOverride)을 건 뒤,
// window.__mfPerf.result 가 생기면 결과 JSON 과 결과 카드 스크린샷을 저장한다. 판정은 하지 않는다(숫자만 남긴다).
//
// 사용법:
//   node scripts/perf-run.mjs [--url http://localhost:5173] [--scene talk|vote] [--minutes 5] [--dpr 2]
//        [--throttle 4] [--size 390x844] [--out .planning/phases/06-world-skeleton/perf/] [--headed]
//        [--budget 0] [--seed 1] [--shot [--file 이름]]
//   --url      기본은 v2.0 공개 주소(deploy-target.expectedOrigin). v1.0 주소는 어떤 요청보다 먼저 거부한다(결정 0055-2·0043).
//   --throttle CPU 감속 배율(기본 4 — DevTools 의 "CPU 4× slowdown" 과 같은 CDP 명령). 1 이면 감속 없음.
//   --shot     측정 대신 화면만 찍는다: ?shot=1 이 10초에 멈추면 HUD 없이 장면을 PNG 로 저장한다(조명 대조용). 결과 JSON 은 없다.
//   --file     저장 파일 이름(확장자 없이). 기본 desktop-{scene}-dpr{dpr}-x{throttle}(--shot 은 앞에 shot-).
// 종료 코드: 0 = 결과 저장, 1 = 인자·주소·Chrome·시간 초과·페이지 오류.
// 가정(A1): 헤드리스 시스템 Chrome 의 CPU 4배 스로틀은 DevTools 와 같은 메커니즘이다. 헤드리스 여부·Chrome 버전은 결과 JSON 의 runner 에 적는다.
// 결과를 서버로 보내지 않는다. 대상 주소에 보내는 요청은 페이지 자신의 에셋 요청뿐이다.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { exitIfV1, expectedOrigin } from "./deploy-target.mjs";
import { findChrome } from "./e2e/lib.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUT = join(REPO, ".planning/phases/06-world-skeleton/perf");
/** 결과 카드가 뜬 뒤 스크린샷 전에 잠깐 기다린다(ms) */
const CARD_SETTLE_MS = 400;
/** 측정 시간 말고 더 기다려 주는 여유(ms): 모듈 받기·맵 만들기·CPU 감속으로 늘어난 시간 */
const LOAD_SLACK_MS = 90_000;
/** --shot: ?shot=1 이 10초에 멈춘다 — 그 뒤까지 기다리는 한도(ms) */
const SHOT_WAIT_MS = 90_000;

const USAGE =
  "사용법: node scripts/perf-run.mjs [--url 주소] [--scene talk|vote] [--minutes 5] [--dpr 2] [--throttle 4] [--size 390x844] [--out 폴더] [--headed] [--budget 0] [--seed 1] [--shot [--file 이름]]";

class UsageError extends Error {}

/** 인자 해석(순수). 값이 필요한 옵션에 값이 없거나 숫자가 아니면 UsageError */
export function parseArgs(argv) {
  const o = { url: null, scene: "talk", minutes: 5, dpr: 2, throttle: 4, size: { w: 390, h: 844 }, out: DEFAULT_OUT, headed: false, budget: 0, seed: 1, shot: false, file: null };
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
  const base = `desktop-${o.scene}-dpr${o.dpr}-x${o.throttle}`;
  return o.shot ? `shot-${base}` : base;
}

/** 열 주소: 대상 + 스파이크 쿼리 */
export function targetUrl(o, origin) {
  const q = new URLSearchParams({ perf: "1", scene: o.scene, minutes: String(o.minutes), dpr: String(o.dpr), seed: String(o.seed), budget: String(o.budget) });
  if (o.shot) q.set("shot", "1");
  return `${origin.replace(/\/+$/, "")}/?${q.toString()}`;
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
