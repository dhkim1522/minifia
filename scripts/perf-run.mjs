// ?perf=1 성능 스파이크 자동 측정(결정 0055-2): 시스템 Chrome(playwright-core)으로 스파이크 장면을 열고
// CDP 로 CPU 감속(Emulation.setCPUThrottlingRate)·화면 배율(Emulation.setDeviceMetricsOverride)을 건 뒤,
// window.__mfPerf.result 가 생기면 결과 JSON 과 결과 카드 스크린샷을 저장한다. 판정은 하지 않는다(숫자만 남긴다).
//
// 사용법:
//   node scripts/perf-run.mjs [--url http://localhost:5173] [--scene talk|vote] [--minutes 5] [--dpr 2]
//        [--throttle 4] [--size 390x844] [--out .planning/phases/06-world-skeleton/perf/] [--headed]
//        [--budget 0] [--seed 1] [--shot [--file 이름]]
//   node scripts/perf-run.mjs --mode nightload [--sound on|off]   (소리 켠/끈 측정 구분, 12-06: on 은 첫 중립 탭으로 오디오를 깨우고 off 는 저장값을 끔으로 준다. 결과 JSON 의 sound 칸에 모드·훅 상태·요청 수)
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
//   --mode chatload (07-16, UI-SPEC 로비 성능 확인 항목·리서치 A13): 제품 로비(`${origin}/?e2e=1`)를 CPU 감속 아래 열고 소켓 봇 N명(--bots, 기본 7)이
//              2초마다 입력 중 켜짐 → chat → 꺼짐을 보내는 동안 --minutes(기본 5) 동안 페이지 안 rAF 간격을 재 평균 fps·끊김(50ms 초과) 수·p50/p95/p99/최장 프레임을
//              결과 JSON 으로 저장한다(`chatload-{크기}-x{감속}.json`, 기본 폴더 .planning/phases/07-free-chat/perf/). 6페이즈 기준(5분 평균 55fps, 끊김 5회 이하)을
//              같은 JSON 의 baseline 칸에 적을 뿐 판정하지 않는다. 제품 코드는 바뀌지 않고, 제품 런타임의 자동 강등(10초 평균 45fps 미만)은 켜진 그대로다(가정 A2).
//              방은 끝에 나가서 지운다. v1.0 주소는 어떤 요청보다 먼저 거부한다.
//   --bots     chatload 소켓 봇 수(0~7, 기본 7). 0 이면 채팅 부하 없는 대조 측정이다(같은 환경에서 채팅 때문인지 가르는 용도, --file 로 이름을 달리한다)
//   --mode nightload (09-22, 결정 0055): 테스트 방(방장 + 봇 --bots, 기본 7)에서 낮 토론·지목·변론·찬반·처형·밤·아침을 방장 넘기기로 되풀이하며(방장 마피아 판, 이어서 시민 판 —
//              시민 판은 어둠·맥박 화면) CPU 감속 아래 장면마다 머무는 동안(--minutes 를 두 판이 반씩) 페이지 안 rAF 간격을 재 평균 fps·끊김·p95 를 장면별 칸(scenes)과 함께
//              `nightload-{크기}-x{감속}.json`(기본 폴더 .planning/phases/09-night-morning/perf/)으로 저장한다. 넘기기·시트 조작 동안은 기록을 멈춘다. 6페이즈 기준(5분 평균 55fps, 끊김 5회)은
//              baseline 칸에 적을 뿐 판정하지 않는다 — 합격 판정은 실기기 확인(사용자 결정 2026-11-02). 방은 끝에 나가서 지운다. v1.0 주소는 어떤 요청보다 먼저 거부한다.
//   --map plaza (nightload, 11-13): 시작 전에 방장이 지도 칩 → 맵 탭 → 광장 카드로 광장을 고른다(pickMapViaUi). 저장 이름 끝 `-plaza`, JSON params.map. 없거나 bar 면 이전과 같다.
//   사용 예:   node scripts/perf-run.mjs --mode nightload --url http://localhost:5173 --minutes 5 --throttle 4 --size 390x844
// 종료 코드: 0 = 결과 저장, 1 = 인자·주소·Chrome·시간 초과·페이지 오류.
// 가정(A1): 헤드리스 시스템 Chrome 의 CPU 4배 스로틀은 DevTools 와 같은 메커니즘이다. 헤드리스 여부·Chrome 버전은 결과 JSON 의 runner 에 적는다.
// 결과를 서버로 보내지 않는다. 대상 주소에 보내는 요청은 페이지 자신의 에셋 요청뿐이다.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { exitIfV1, expectedOrigin } from "./deploy-target.mjs";
import { FONT_HOSTS, findChrome, parseBarMask, pickTapTargets, walkableCenters } from "./e2e/lib.mjs";
import {
  backToLobby,
  chooseRole,
  createTestRoom,
  hitsInputSurface,
  leaveLobby,
  openHostPage,
  openTestSheet,
  readChatLines,
  readGame,
  readWorld,
  screensOfWorld,
  setBotVote,
  setBots,
  skipTo,
  sleep,
  startGame,
  tapPick,
  waitWorldReady,
} from "./e2e/browser.mjs";
import { pickMapViaUi } from "./e2e/mapselect.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUT = join(REPO, ".planning/phases/06-world-skeleton/perf");
/** chatload 의 기본 저장 폴더(7페이즈) */
const CHATLOAD_OUT = join(REPO, ".planning/phases/07-free-chat/perf");
/** nightload 의 기본 저장 폴더(9페이즈) */
const NIGHTLOAD_OUT = join(REPO, ".planning/phases/09-night-morning/perf");
/** nightload: 장면마다 머무는 시간(ms). 합 70초 = 한 바퀴. 처형·아침은 서버 타이머가 5초 안팎이라 그보다 짧게 머문다.
 * errand(15페이즈, 결정 0074)는 낮 시작 다음·토론 앞 — 사람 입력 없이 20초 머문다(근처 snap 갱신·표지 투영·링이 매 프레임 일하는 구간, 봇이 장소를 돈다) */
export const NIGHTLOAD_DWELL = [
  ["errand", 20_000],
  ["discussion", 10_000],
  ["nomination", 6_000],
  ["defense", 6_000],
  ["verdict", 6_000],
  ["execution", 4_000],
  ["night", 14_000],
  ["morning", 4_000],
];
/** nightload: 판 순서 — 마피아 판(맵·고리·이동) 다음 시민 판(어둠·맥박 비네트) */
const NIGHTLOAD_PASSES = ["mafia", "citizen"];
const NIGHTLOAD_NICK = "측정기";
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
/** chatload: 봇마다 채팅 간격(ms) — "2초마다 채팅·입력 중" */
const CHATLOAD_EVERY_MS = 2_000;
/** chatload: 입력 중 켜짐 → chat 사이(ms). 한 줄을 치는 시간을 흉내 낸다 */
const CHATLOAD_TYPING_LEAD_MS = 300;
/** chatload: 끊김으로 세는 프레임 간격(ms) — 06 spike 와 같은 50ms */
const JANK_MS = 50;
/** chatload: 봇 닉네임(자소 8 이하) */
const CHATLOAD_NICKS = ["측정봇가", "측정봇나", "측정봇다", "측정봇라", "측정봇마", "측정봇바", "측정봇사"];
/** chatload: 고정 문구 12개 — shared/game/bots.ts 의 BOT_CHAT_LINES 와 같은 말투. 봇마다 다른 자리에서 돌려 같은 문장 3초 규칙에 걸리지 않게 한다 */
const CHATLOAD_LINES = ["저 아니에요", "누가 수상해요?", "조용한 사람이 수상해요", "어제 그 말 이상했어요", "믿어 주세요", "투표 신중하게 해요", "다들 뭐 했어요?", "저는 시민 같아요", "여기 처음이에요", "몇 명이 올까요?", "빨리 시작해요", "방이 아늑하네요"];
/** 6페이즈 합격 기준(06-PERF-RESULTS.md 조건 B, UI-SPEC "합격 기준"). 숫자를 낮추지 않고 그대로 적는다 */
const CHATLOAD_BASELINE = { avgFps: 55, jankMax: 5, perMinutes: 5, jankMs: JANK_MS, source: "06-PERF-RESULTS.md 조건 B · UI-SPEC 합격 기준 — 5분 평균 ≥ 55fps, 끊김(>50ms) ≤ 5회/5분" };

export const USAGE =
  "사용법: node scripts/perf-run.mjs [--mode perf|interactive|chatload|nightload] [--url 주소] [--scene talk|vote] [--minutes 5] [--dpr 2] [--throttle 4] [--size 390x844] [--out 폴더] [--headed] [--budget 0] [--seed 1] [--outfits mix|coat] [--burst 1..4] [--map bar|plaza] [--runs 3] [--bots 7] [--sound on|off] [--shot [--file 이름]]";

class UsageError extends Error {}

/** 인자 해석(순수). 값이 필요한 옵션에 값이 없거나 숫자가 아니면 UsageError */
export function parseArgs(argv) {
  const o = { url: null, scene: "talk", minutes: 5, dpr: 2, throttle: 4, size: { w: 390, h: 844 }, out: DEFAULT_OUT, headed: false, budget: 0, seed: 1, shot: false, file: null, mode: "perf", runs: 3, bots: 7, outGiven: false, outfits: "coat", burst: 1, sound: "on", map: "bar" };
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
        if (v !== "perf" && v !== "interactive" && v !== "chatload" && v !== "nightload") throw new UsageError(`--mode 는 perf, interactive, chatload 또는 nightload: ${v}`);
        o.mode = v;
        break;
      }
      case "--outfits": {
        const v = need(a, i++);
        if (v !== "mix" && v !== "coat") throw new UsageError(`--outfits 는 mix 또는 coat: ${v}`);
        o.outfits = v;
        break;
      }
      case "--map": {
        // 장면과 걷기 시나리오의 맵(perf 의 ?perf=1&map=, nightload 는 시작 전에 지도 칩으로 고른다) — 광장 성능 측정(MAP-06, 11-10·11-13)
        const v = need(a, i++);
        if (v !== "bar" && v !== "plaza") throw new UsageError(`--map 은 bar 또는 plaza: ${v}`);
        o.map = v;
        break;
      }
      case "--burst": {
        const n = num(a, need(a, i++), { min: 1, max: 4 });
        if (!Number.isInteger(n)) throw new UsageError(`--burst 는 1~4 정수: ${n}`);
        o.burst = n;
        break;
      }
      case "--sound": {
        // nightload 의 소리 켠/끈 측정 구분(12-06). 다른 모드에서는 무시한다
        const v = need(a, i++);
        if (v !== "on" && v !== "off") throw new UsageError(`--sound 은 on 또는 off: ${v}`);
        o.sound = v;
        break;
      }
      case "--runs": o.runs = Math.floor(num(a, need(a, i++), { min: 1, max: 20 })); break;
      case "--bots": o.bots = Math.floor(num(a, need(a, i++), { min: 0, max: CHATLOAD_NICKS.length })); break;
      case "--out": o.out = resolve(need(a, i++)); o.outGiven = true; break;
      case "--file": o.file = need(a, i++); break;
      case "--headed": o.headed = true; break;
      case "--shot": o.shot = true; break;
      default: throw new UsageError(`알 수 없는 옵션: ${a}`);
    }
  }
  // chatload 는 --out 이 없으면 7페이즈 폴더에 저장한다(06 폴더는 06 결과의 것이다)
  if (o.mode === "chatload" && !o.outGiven) o.out = CHATLOAD_OUT;
  if (o.mode === "nightload" && !o.outGiven) o.out = NIGHTLOAD_OUT;
  return o;
}

/** 저장 파일 이름(확장자 없이). 두 번째 값(결과 JSON)과 스크린샷이 같은 이름을 쓴다 */
export function outputBase(o) {
  if (o.file) return o.file;
  if (o.mode === "interactive") return `interactive-dpr${o.dpr}-x${o.throttle}`;
  if (o.mode === "chatload") return `chatload-${o.size.w}x${o.size.h}-x${o.throttle}`;
  if (o.mode === "nightload") return `nightload-${o.size.w}x${o.size.h}-x${o.throttle}${o.map === "plaza" ? "-plaza" : ""}`;
  const base = `desktop-${o.scene}-dpr${o.dpr}-x${o.throttle}${o.outfits === "mix" ? "-mix" : ""}${o.burst > 1 ? `-burst${o.burst}` : ""}${o.map === "plaza" ? "-plaza" : ""}`;
  return o.shot ? `shot-${base}` : base;
}

/** 조명 렌더 순서 판정(18-07) — 자리 함수(RED). 실제 판정은 다음 커밋에서 채운다 */
export const LIGHT_TALK_RATIO = 2.0;
export const LIGHT_MORNING_RATIO = 1.6;
export function lightRankVerdict(_means) {
  return { ok: true, rows: [] };
}

/** 열 주소: 대상 + 스파이크 쿼리 */
export function targetUrl(o, origin) {
  const q = new URLSearchParams({ perf: "1", scene: o.scene, minutes: String(o.minutes), dpr: String(o.dpr), seed: String(o.seed), budget: String(o.budget) });
  if (o.outfits !== "coat") q.set("outfits", o.outfits);
  if (o.burst > 1) q.set("burst", String(o.burst));
  if (o.map !== "bar") q.set("map", o.map);
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

/** 프레임 간격(ms) 배열 → 평균 fps·끊김·백분위. 06 spike 의 frames 칸과 같은 이름을 쓴다(순수). 비어 있으면 null */
export function frameStats(gaps, jankMs = JANK_MS) {
  const n = gaps.length;
  if (n === 0) return null;
  const sorted = [...gaps].sort((a, b) => a - b);
  const pct = (p) => sorted[Math.min(n - 1, Math.max(0, Math.ceil(p * n) - 1))];
  const seconds = gaps.reduce((a, b) => a + b, 0) / 1000;
  const fpsOf = (arr) => {
    const sec = arr.reduce((a, b) => a + b, 0) / 1000;
    return sec > 0 ? arr.length / sec : null;
  };
  // 첫 1분 → 끝 1분: 2분 이상 잰 실행에서만 열·감속 저하 신호로 쓴다
  let first = null;
  let last = null;
  if (seconds >= 120) {
    let acc = 0;
    let cut = 0;
    for (; cut < n && acc < 60_000; cut++) acc += gaps[cut];
    first = fpsOf(gaps.slice(0, cut));
    acc = 0;
    let from = n;
    while (from > 0 && acc < 60_000) acc += gaps[--from];
    last = fpsOf(gaps.slice(from));
  }
  return {
    count: n,
    seconds,
    avgFps: n / seconds,
    jank: gaps.filter((g) => g > jankMs).length,
    jankMs,
    p50: pct(0.5),
    p95: pct(0.95),
    p99: pct(0.99),
    max: sorted[n - 1],
    rafHz: Math.round(1000 / pct(0.5)),
    firstMinuteFps: first,
    lastMinuteFps: last,
    thermalRatio: first && last ? last / first : null,
  };
}

/** chatload: 손님 한 명을 HTTP 로 참가시키고 소켓을 연다(hello → 첫 state). 토큰은 이 함수 밖으로 나가지 않는다 */
async function openChatGuest(origin, code, nickname) {
  const res = await fetch(`${origin}/api/rooms/${code}/join`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ nickname }) });
  const data = await res.json().catch(() => null);
  if ((res.status !== 200 && res.status !== 201) || typeof data?.token !== "string") throw new Error(`손님 참가 응답 ${res.status}`);
  const guest = { nickname, seat: data.seat, ws: null, view: null, chats: 0, typings: 0, rejects: {} };
  const wsUrl = `${origin.replace(/^http/, "ws")}/api/rooms/${code}/ws`;
  await new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    guest.ws = ws;
    const timer = setTimeout(() => reject(new Error("손님 소켓 첫 state 시간 초과")), INTERACTIVE_STEP_MS);
    ws.addEventListener("open", () => ws.send(JSON.stringify({ t: "hello", token: data.token })));
    ws.addEventListener("message", (ev) => {
      let m;
      try {
        m = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      if (m.t === "ping") ws.send(JSON.stringify({ t: "pong", c: m.c }));
      else if (m.t === "state") {
        guest.view = m.view;
        clearTimeout(timer);
        resolve();
      } else if (m.t === "chatReject") guest.rejects[m.why] = (guest.rejects[m.why] ?? 0) + 1;
    });
    ws.addEventListener("error", () => reject(new Error("손님 소켓 연결 오류")));
    ws.addEventListener("close", () => reject(new Error("손님 소켓이 첫 state 전에 닫힘")));
  });
  return guest;
}

/** chatload 한 번: 제품 로비에 입장 → 손님 봇 접속 → 채팅 부하 속에서 rAF 간격 기록 → 방을 나가 지운다. 실패는 던진다 */
async function chatloadOnce(browser, o, origin, chrome) {
  const context = await browser.newContext({ viewport: { width: o.size.w, height: o.size.h }, deviceScaleFactor: o.dpr, isMobile: true, hasTouch: true, locale: "ko-KR" });
  const issues = [];
  const guests = [];
  const timers = [];
  let page = null;
  try {
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
    page.on("crash", () => issues.push("페이지 충돌(crash)"));
    page.on("console", (m) => {
      if (m.type() === "error") issues.push(`콘솔 오류: ${m.text().slice(0, 200)}`);
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: o.size.w, height: o.size.h, deviceScaleFactor: o.dpr, mobile: true });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: o.throttle });

    await page.goto(`${origin}/?e2e=1`, { waitUntil: "load" });
    await page.getByRole("button", { name: "방 만들기" }).first().click();
    await page.locator(".mf-nick-sheet input").fill(INTERACTIVE_NICK);
    await page.getByRole("button", { name: "만들기", exact: true }).click();
    await page.waitForFunction(() => window.__mfWorld?.interactiveMs?.() != null, null, { timeout: INTERACTIVE_STEP_MS, polling: 50 });
    const code = /\/r\/(\d{4})/.exec(new URL(page.url()).pathname)?.[1];
    if (!code) throw new Error("방 코드를 주소에서 읽지 못함");
    await waitWorldReady(page, 1);

    // 손님 봇 접속 → 방에 사람이 늘어난 로비가 다 그려질 때까지 기다린다(이 구간은 측정에 넣지 않는다)
    for (let i = 0; i < o.bots; i++) guests.push(await openChatGuest(origin, code, CHATLOAD_NICKS[i]));
    await waitWorldReady(page, 1 + o.bots);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.waitForTimeout(500);

    // 부하: 봇마다 2초 간격으로 입력 중 켜짐 → 300ms 뒤 chat → 꺼짐. 봇들이 한꺼번에 보내지 않게 간격 안에서 흩뜨린다
    let lineIdx = 0;
    guests.forEach((g, i) => {
      const send = (m) => g.ws.readyState === WebSocket.OPEN && g.ws.send(JSON.stringify(m));
      const pk = () => `${g.view?.round ?? 1}:${g.view?.day?.n ?? 0}:${g.view?.phase}`;
      const tick = () => {
        if (g.view?.phase !== "lobby") return;
        send({ t: "typing", on: true, pk: pk() });
        g.typings += 1;
        timers.push(
          setTimeout(() => {
            send({ t: "chat", text: CHATLOAD_LINES[(lineIdx++ + i * 3) % CHATLOAD_LINES.length], pk: pk() });
            send({ t: "typing", on: false, pk: pk() });
            g.chats += 1;
          }, CHATLOAD_TYPING_LEAD_MS),
        );
      };
      timers.push(
        setTimeout(() => {
          tick();
          timers.push(setInterval(tick, CHATLOAD_EVERY_MS));
        }, (CHATLOAD_EVERY_MS / guests.length) * i),
      );
    });

    // rAF 간격 기록기(제품 코드 변경 없음, 가정 A2). 기록은 페이지 안 배열이고 끝에 한 번에 가져온다
    const cap = Math.ceil(o.minutes * 60 * 240) + 2000;
    const renderBefore = await page.evaluate(() => window.__mfWorld?.debug?.info?.() ?? null);
    const startedAt = new Date().toISOString();
    await page.evaluate((capacity) => {
      const gaps = new Float64Array(capacity);
      const rec = { n: 0, stopped: false, prev: null };
      const loop = (t) => {
        if (rec.stopped) return;
        if (rec.prev !== null && rec.n < capacity) gaps[rec.n++] = t - rec.prev;
        rec.prev = t;
        requestAnimationFrame(loop);
      };
      window.__chatloadFps = { rec, gaps };
      requestAnimationFrame(loop);
    }, cap);
    const linesAt = async () => (await readChatLines(page))?.length ?? null;
    const midpoint = [];
    const totalMs = o.minutes * 60_000;
    const sampleEvery = Math.max(10_000, Math.floor(totalMs / 6));
    for (let waited = 0; waited < totalMs; waited += sampleEvery) {
      await sleep(Math.min(sampleEvery, totalMs - waited));
      midpoint.push({ atMs: Math.min(waited + sampleEvery, totalMs), logLines: await linesAt() });
    }
    const gaps = await page.evaluate(() => {
      const f = window.__chatloadFps;
      f.rec.stopped = true;
      return Array.from(f.gaps.subarray(0, f.rec.n));
    });
    const renderAfter = await page.evaluate(() => window.__mfWorld?.debug?.info?.() ?? null);
    const logLines = await linesAt();
    const endedAt = new Date().toISOString();

    for (const t of timers) {
      clearTimeout(t);
      clearInterval(t);
    }
    const stats = frameStats(gaps);
    if (!stats) throw new Error("rAF 간격이 하나도 기록되지 않음");
    const rejects = {};
    for (const g of guests) for (const [why, n] of Object.entries(g.rejects)) rejects[why] = (rejects[why] ?? 0) + n;
    const png = join(o.out, `${outputBase(o)}.png`);
    await page.screenshot({ path: png });
    await leaveLobby(page);
    return {
      runner: {
        tool: "scripts/perf-run.mjs --mode chatload",
        throttle: o.throttle,
        dpr: o.dpr,
        size: `${o.size.w}x${o.size.h}`,
        headless: !o.headed,
        chrome: browser.version(),
        platform: `${process.platform}/${process.arch}`,
        node: process.version,
        url: `${origin}/?e2e=1`,
        chromeBinary: chrome,
      },
      schema: "chatload-1",
      startedAt,
      endedAt,
      params: { minutes: o.minutes, bots: o.bots, chatEveryMs: CHATLOAD_EVERY_MS, typingLeadMs: CHATLOAD_TYPING_LEAD_MS },
      frames: { ...stats, jankPer5min: (stats.jank * 300) / stats.seconds },
      baseline: CHATLOAD_BASELINE,
      load: {
        botsConnected: guests.length,
        chatsSent: guests.reduce((a, g) => a + g.chats, 0),
        typingOnSent: guests.reduce((a, g) => a + g.typings, 0),
        chatRejects: rejects,
        pageLogLines: logLines,
        pageLogLinesSamples: midpoint,
        pageLogKeepLines: 100,
      },
      renderer: { before: renderBefore, after: renderAfter, note: "제품 런타임의 자동 강등(10초 평균 45fps 미만) 단계는 테스트 훅이 주지 않는다. calls·triangles 가 처음보다 크게 줄었으면 강등 의심" },
      screenshot: png,
      issues: [...new Set(issues)].slice(0, 8),
    };
  } finally {
    for (const t of timers) {
      clearTimeout(t);
      clearInterval(t);
    }
    for (const g of guests) {
      try {
        g.ws?.send(JSON.stringify({ t: "leave" }));
        g.ws?.close();
      } catch {
        /* 이미 닫힘 */
      }
    }
    await context.close().catch(() => {});
  }
}

async function runChatload(browser, o, origin, chrome) {
  let result;
  try {
    result = await chatloadOnce(browser, o, origin, chrome);
  } catch (e) {
    console.error(`측정 실패: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`);
    return 1;
  }
  const json = join(o.out, `${outputBase(o)}.json`);
  writeFileSync(json, `${JSON.stringify(result, null, 2)}\n`);
  const f = result.frames;
  console.log(`결과 저장: ${json}`);
  console.log(`스크린샷: ${result.screenshot}`);
  console.log(`평균 ${f.avgFps.toFixed(1)}fps · 끊김(>${f.jankMs}ms) ${f.jank} · p50 ${f.p50.toFixed(1)}ms · p95 ${f.p95.toFixed(1)}ms · 최장 ${f.max.toFixed(1)}ms · rAF ${f.rafHz}Hz (${f.seconds.toFixed(0)}초, ${f.count}프레임)`);
  console.log(`채팅 부하: 봇 ${result.load.botsConnected}명 · chat ${result.load.chatsSent}줄 · 입력 중 ${result.load.typingOnSent}회 · 막힘 ${JSON.stringify(result.load.chatRejects)} · 기록 칸 ${result.load.pageLogLines}줄(보관 ${result.load.pageLogKeepLines})`);
  console.log(`기준(06 조건 B, 판정 없음): 평균 ≥ ${CHATLOAD_BASELINE.avgFps}fps · 끊김 ≤ ${CHATLOAD_BASELINE.jankMax}회/${CHATLOAD_BASELINE.perMinutes}분`);
  if (result.issues.length > 0) console.error(`페이지 신호 ${result.issues.length}건:\n${result.issues.join("\n")}`);
  return 0;
}

/**
 * 소리 도우미 (12-06, D-18): nightload 의 --sound on|off 를 가르는 작은 순수 도우미들. 가짜 page 로 시험한다(perf-run.test.mjs).
 * 판정은 하지 않는다 — 결과 JSON 의 sound 칸에 모드·끝 때 훅 상태·요청 수만 적는다. 실제 측정 실행과 성능 합격선은 12-12.
 */

/** off 면 저장값 minifia:sound = {"v":1,"on":false} 를 쓰는 init script 문자열(openHostPage 의 initScripts 로 넘긴다), on 이면 null. 저장소가 막혀도 던지지 않는다 */
export function soundInitScript(mode) {
  if (mode !== "off") return null;
  return `try { localStorage.setItem("minifia:sound", JSON.stringify({ v: 1, on: false })); } catch (e) {}`;
}

/** on 이면 화면 좌상단 가장자리(4,4)를 한 번 탭해 제스처로 오디오를 깨운다. 탭했으면 true(실패·off 는 false, 던지지 않는다) */
export async function wakeAudio(page, size, mode = "on") {
  if (mode === "off") return false;
  const x = Math.min(4, Math.max(0, (size?.w ?? 5) - 1));
  const y = Math.min(4, Math.max(0, (size?.h ?? 5) - 1));
  try {
    await page.touchscreen.tap(x, y);
    return true;
  } catch {
    return false;
  }
}

/** window.__mfSound 훅에서 { state, on, requests: 요청 로그 길이 } 를 읽는다. 훅이 없거나 page 가 닫혔으면 null */
export async function readSoundState(page) {
  try {
    return await page.evaluate(() => {
      const h = window.__mfSound;
      return h ? { state: h.state, on: h.on, requests: h.log.length } : null;
    });
  } catch {
    return null;
  }
}

/**
 * nightload 한 번(09-22): 테스트 방에 봇을 채우고 방장 마피아 판·시민 판을 장면별로 머물며 rAF 간격을 잰다. 실패는 던진다.
 * 기록기는 페이지 안 배열이고, 넘기기·시트 조작 동안은 멈춘다(그 구간은 측정에 넣지 않는다). 프레임마다 장면 번호(tag)를 함께 적는다.
 */
async function nightloadOnce(browser, o, origin, chrome) {
  const room = await createTestRoom(origin, NIGHTLOAD_NICK);
  const soundInit = soundInitScript(o.sound);
  const host = await openHostPage(browser, { origin, code: room.code, token: room.token, size: { w: o.size.w, h: o.size.h }, dpr: o.dpr, initScripts: soundInit === null ? [] : [soundInit] });
  const { page, tracker, context } = host;
  const issues = [];
  page.on("pageerror", (e) => issues.push(`페이지 오류: ${e.message}`));
  page.on("crash", () => issues.push("페이지 충돌(crash)"));
  try {
    page.setDefaultTimeout(INTERACTIVE_STEP_MS);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: o.throttle });
    // 소리 켬: 첫 중립 탭으로 오디오를 깨운다(끔은 저장값이 이미 꺼짐)
    await wakeAudio(page, o.size, o.sound);

    await openTestSheet(page);
    await setBots(page, tracker, o.bots);
    await setBotVote(page, tracker, { exec: "no", pick: "other" });
    // --map plaza: 시작 전에 칩 → 맵 탭 → 광장 카드로 고른다(11-13). bar·없음이면 아무것도 하지 않는다(재즈 바 판은 이전과 같다). 선택은 방에 남아 두 판 모두 광장이다
    if (o.map === "plaza") await pickMapViaUi(page, tracker, "plaza");

    // 한 바퀴(70초)까지 넘겨 재는 경우가 있어 측정 시간에 여유 2분을 더한 240Hz 분량
    const cap = Math.ceil((o.minutes * 60 + 120) * 240);
    await page.evaluate((capacity) => {
      const gaps = new Float32Array(capacity);
      const tags = new Uint8Array(capacity);
      const rec = { n: 0, stopped: false, paused: true, prev: null, tag: 0 };
      const loop = (t) => {
        if (rec.stopped) return;
        if (rec.paused) rec.prev = null;
        else {
          if (rec.prev !== null && rec.n < capacity) {
            gaps[rec.n] = t - rec.prev;
            tags[rec.n++] = rec.tag;
          }
          rec.prev = t;
        }
        requestAnimationFrame(loop);
      };
      window.__nightload = { rec, gaps, tags };
      requestAnimationFrame(loop);
    }, cap);
    const labels = [];
    const mark = (key, paused) => {
      let i = labels.indexOf(key);
      if (i < 0) i = labels.push(key) - 1;
      return page.evaluate(([tag, p]) => {
        const r = window.__nightload.rec;
        r.tag = tag;
        r.paused = p;
      }, [i, paused]);
    };
    const renderBefore = await page.evaluate(() => window.__mfWorld?.debug?.info?.() ?? null);
    const startedAt = new Date().toISOString();
    const perPassMs = (o.minutes * 60_000) / NIGHTLOAD_PASSES.length;
    const cycles = {};

    for (const role of NIGHTLOAD_PASSES) {
      await openTestSheet(page);
      await chooseRole(page, tracker, role);
      let measured = 0;
      cycles[role] = 0;
      while (measured < perPassMs) {
        await mark(`${role}:setup`, true);
        await startGame(page, tracker);
        for (const [phase, ms] of NIGHTLOAD_DWELL) { // 첫 장면이 errand 라 낮 시작에서 바로 넘긴다(15페이즈)
          await mark(`${role}:setup`, true);
          await skipTo(page, tracker, phase);
          // 마피아 판의 밤: 대상 이름표를 눌러 내 캐릭터가 걷게 한다(이동·고리). 실패해도 측정은 이어 간다
          if (role === "mafia" && phase === "night") {
            const g = await readGame(page).catch(() => null);
            const seat = g?.picks?.map((b) => b.seat).sort((a, b) => a - b)[0];
            if (seat !== undefined) await tapPick(page, seat).catch(() => {});
          }
          await mark(`${role}:${phase}`, false);
          await sleep(ms);
          measured += ms;
        }
        await mark(`${role}:setup`, true);
        await backToLobby(page, tracker);
        cycles[role] += 1;
      }
    }

    const { gaps, tags } = await page.evaluate(() => {
      const f = window.__nightload;
      f.rec.stopped = true;
      return { gaps: Array.from(f.gaps.subarray(0, f.rec.n)), tags: Array.from(f.tags.subarray(0, f.rec.n)) };
    });
    const renderAfter = await page.evaluate(() => window.__mfWorld?.debug?.info?.() ?? null);
    const endedAt = new Date().toISOString();
    const stats = frameStats(gaps);
    if (!stats) throw new Error("rAF 간격이 하나도 기록되지 않음");
    const scenes = {};
    for (const [i, key] of labels.entries()) {
      if (key.endsWith(":setup")) continue;
      const part = gaps.filter((_, k) => tags[k] === i);
      const st = frameStats(part);
      if (st) scenes[key] = { ...st, jankPer5min: (st.jank * 300) / st.seconds };
    }
    const passes = {};
    for (const role of NIGHTLOAD_PASSES) {
      const idx = new Set(labels.map((k, i) => (k.startsWith(`${role}:`) && !k.endsWith(":setup") ? i : -1)).filter((i) => i >= 0));
      const st = frameStats(gaps.filter((_, k) => idx.has(tags[k])));
      if (st) passes[role] = { ...st, jankPer5min: (st.jank * 300) / st.seconds, cycles: cycles[role] };
    }
    const png = join(o.out, `${outputBase(o)}.png`);
    await page.screenshot({ path: png });
    const soundState = await readSoundState(page);
    await leaveLobby(page);
    return {
      runner: {
        tool: "scripts/perf-run.mjs --mode nightload",
        throttle: o.throttle,
        dpr: o.dpr,
        size: `${o.size.w}x${o.size.h}`,
        headless: !o.headed,
        chrome: browser.version(),
        platform: `${process.platform}/${process.arch}`,
        node: process.version,
        url: origin,
        chromeBinary: chrome,
      },
      schema: "nightload-1",
      startedAt,
      endedAt,
      params: { map: o.map ?? "bar", minutes: o.minutes, bots: o.bots, passes: NIGHTLOAD_PASSES, dwellMs: Object.fromEntries(NIGHTLOAD_DWELL), note: "넘기기·시트 조작 구간은 기록하지 않는다. 시민 판 아침은 봇 마피아가 방장을 노려 피해자 연출이 함께 잡힌다" },
      frames: { ...stats, jankPer5min: (stats.jank * 300) / stats.seconds },
      passes,
      scenes,
      sound: { mode: o.sound, state: soundState?.state ?? null, on: soundState?.on ?? null, requests: soundState?.requests ?? null, note: "소리 켠/끈 측정 구분(12-06). 판정 없음 — 합격선은 12-12" },
      baseline: CHATLOAD_BASELINE,
      renderer: { before: renderBefore, after: renderAfter, note: "제품 런타임의 자동 강등(10초 평균 45fps 미만) 단계는 테스트 훅이 주지 않는다. calls·triangles 가 처음보다 크게 줄었으면 강등 의심" },
      screenshot: png,
      issues: [...new Set(issues)].slice(0, 8),
    };
  } finally {
    await context.close().catch(() => {});
  }
}

async function runNightload(browser, o, origin, chrome) {
  let result;
  try {
    result = await nightloadOnce(browser, o, origin, chrome);
  } catch (e) {
    console.error(`측정 실패: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`);
    return 1;
  }
  const json = join(o.out, `${outputBase(o)}.json`);
  writeFileSync(json, `${JSON.stringify(result, null, 2)}\n`);
  const f = result.frames;
  console.log(`결과 저장: ${json}`);
  console.log(`스크린샷: ${result.screenshot}`);
  console.log(`전체 평균 ${f.avgFps.toFixed(1)}fps · 끊김(>${f.jankMs}ms) ${f.jank} · p50 ${f.p50.toFixed(1)}ms · p95 ${f.p95.toFixed(1)}ms · 최장 ${f.max.toFixed(1)}ms · rAF ${f.rafHz}Hz (${f.seconds.toFixed(0)}초, ${f.count}프레임)`);
  for (const [role, st] of Object.entries(result.passes)) console.log(`  ${role} 판: 평균 ${st.avgFps.toFixed(1)}fps · 끊김 ${st.jank} · p95 ${st.p95.toFixed(1)}ms (${st.seconds.toFixed(0)}초, ${st.cycles}바퀴)`);
  for (const [key, st] of Object.entries(result.scenes)) console.log(`    ${key}: 평균 ${st.avgFps.toFixed(1)}fps · 끊김 ${st.jank} · p95 ${st.p95.toFixed(1)}ms (${st.seconds.toFixed(0)}초)`);
  console.log(`기준(06 조건 B, 판정 없음): 평균 ≥ ${CHATLOAD_BASELINE.avgFps}fps · 끊김 ≤ ${CHATLOAD_BASELINE.jankMax}회/${CHATLOAD_BASELINE.perMinutes}분`);
  if (result.issues.length > 0) console.error(`페이지 신호 ${result.issues.length}건:\n${result.issues.join("\n")}`);
  return 0;
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
  if (o.mode === "chatload") {
    let c = 1;
    try {
      c = await runChatload(browser, o, origin, chrome);
    } finally {
      await browser.close().catch(() => {});
    }
    process.exit(c);
  }
  if (o.mode === "nightload") {
    let c = 1;
    try {
      c = await runNightload(browser, o, origin, chrome);
    } finally {
      await browser.close().catch(() => {});
    }
    process.exit(c);
  }
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
      const runner = { tool: "scripts/perf-run.mjs", map: o.map, throttle: o.throttle, dpr: o.dpr, size: `${o.size.w}x${o.size.h}`, headless: !o.headed, chrome: browser.version(), platform: `${process.platform}/${process.arch}`, node: process.version, url };
      writeFileSync(json, `${JSON.stringify({ runner, ...result }, null, 2)}\n`);
      await page.screenshot({ path: png });
      const f = result.frames;
      console.log(`결과 저장: ${json}`);
      console.log(`스크린샷: ${png}`);
      console.log(`평균 ${f.avgFps.toFixed(1)}fps · 끊김 ${f.jank} · p95 ${f.p95.toFixed(1)}ms · rAF ${f.rafHz}Hz · calls ${result.renderer?.calls ?? "-"} · triangles ${result.renderer?.triangles ?? "-"} · outfits ${result.params?.outfits ?? "-"} · burst ${result.params?.burst ?? "-"} · firstEmoteGapMs ${result.firstEmoteGapMs ?? "-"}`);
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
