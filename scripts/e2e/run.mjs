// 화면 E2E 실행기(결정 0025): 시스템 Chrome + playwright-core 로 배포본(또는 --url)을 휴대폰 크기로 열어 실제 좌표를 검사한다.
// 사용법: node scripts/e2e/run.mjs [--url https://minifia.dhplay.workers.dev | http://localhost:5173] [--only <시나리오 부분 문자열>] [--shots] [--sizes 360x640,390x664,430x932]
// 종료 코드: 0 = 모두 통과, 1 = 실패 있음, 2 = 중단(인자·주소·Chrome·연결·제한 시간).
// Node 는 /api/health 와 /api/rooms 두 HTTP 요청만 보낸다(소켓을 열지 않는다). 토큰은 어떤 출력에도 나오지 않는다.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { launchChrome, SetupError } from "./browser.mjs";
import { FLOWS } from "./flows.mjs";
import {
  APPROVED_RELAXATIONS,
  DECORATIVE_ALLOW,
  MAX_PARALLEL,
  OVERALL_LIMIT_MS,
  TAP_ALLOW,
  TEXT_SIZE_ALLOW,
  USAGE,
  UsageError,
  exitCodeOf,
  findChrome,
  formatTables,
  parseArgs,
  redact,
  resolveTarget,
} from "./lib.mjs";

const secrets = [];
/** 모든 출력은 이 함수로만 나간다 — 이 실행에서 받은 토큰을 가린다. */
const emit = (text) => console.log(redact(text, secrets));
const results = [];
let aborted = null;
const started = performance.now();

function finish(browser) {
  const code = exitCodeOf(results, aborted !== null);
  if (results.length > 0) {
    const t = formatTables(results);
    emit("");
    emit(t.table);
    emit("");
    emit("## 요약");
    emit(t.summary);
    emit("");
    emit("## 실패");
    emit(t.failures);
    emit("");
  }
  emit(`걸린 시간 ${Math.round((performance.now() - started) / 1000)}초`);
  const failed = results.filter((r) => !r.ok).length;
  if (aborted !== null) emit(`중단: ${aborted}`);
  else emit(failed === 0 ? "E2E OK" : `E2E FAIL: ${failed}개 실패`);
  const done = () => process.exit(code);
  if (browser) browser.close().then(done, done);
  else done();
}

function abortNow(reason) {
  aborted = reason;
  finish(null);
}

let args;
try {
  args = parseArgs(process.argv.slice(2));
} catch (e) {
  if (!(e instanceof UsageError)) throw e;
  emit(`사용법 오류: ${e.message}`);
  emit(USAGE);
  process.exit(2);
}

let target;
try {
  target = resolveTarget(args.url, readFileSync(fileURLToPath(new URL("../prod-url.txt", import.meta.url)), "utf8"));
} catch (e) {
  emit(`중단: ${e instanceof Error ? e.message : e}`);
  process.exit(2);
}

let chromePath;
try {
  chromePath = findChrome(process.platform, process.env, existsSync);
} catch (e) {
  emit(`중단: ${e instanceof Error ? e.message : e}`);
  process.exit(2);
}

const flows = FLOWS.filter((f) => args.only === null || f.id.includes(args.only) || args.only.startsWith(f.id));
if (flows.length === 0) {
  emit(`중단: --only ${args.only} 에 맞는 흐름이 없음 (흐름: ${FLOWS.map((f) => f.id).join(", ")})`);
  process.exit(2);
}

const origin = target.origin;
let version = "";
try {
  const res = await fetch(`${origin}/api/health`);
  if (!res.ok) throw new Error(`응답 ${res.status}`);
  version = String((await res.json().catch(() => ({}))).version ?? "");
} catch (e) {
  emit(`중단: ${origin}/api/health 를 확인하지 못함 (${e instanceof Error ? e.message : e})`);
  process.exit(2);
}
emit(`대상 ${origin} · 버전 ${version}`);
emit(`Chrome ${chromePath}`);
const allow = (list) => (list.length === 0 ? "(없음)" : list.map((a) => `${a.selector} — ${a.reason}`).join("; "));
emit(`허용 목록 — 장식(G2): ${allow(DECORATIVE_ALLOW)} / 탭 대상(G3): ${allow(TAP_ALLOW)} / 글자 크기(G7): ${allow(TEXT_SIZE_ALLOW)}`);
emit(`승인된 완화: ${APPROVED_RELAXATIONS.map((r) => `${r.id}(${r.approved})`).join(", ")} — 그 밖의 기준 수치는 낮추지 않는다`);
emit(`크기 ${args.sizes.map((s) => s.label).join(", ")} · 흐름 ${flows.map((f) => f.id).join(", ")}${args.shots ? " · 사진 저장(scripts/e2e/out/)" : ""}`);

let browser;
try {
  browser = await launchChrome(chromePath);
} catch (e) {
  emit(`중단: Chrome 을 실행하지 못함 (${e instanceof Error ? e.message.split("\n")[0] : e})`);
  process.exit(2);
}

const limitTimer = setTimeout(() => abortNow(`전체 ${OVERALL_LIMIT_MS / 1000}초 제한 초과`), OVERALL_LIMIT_MS);
limitTimer.unref();

const jobs = [];
for (const size of args.sizes) for (const flow of flows) jobs.push({ flow, size });

// 준비 실패(SetupError)로 새 방에서 다시 도는 최대 횟수. 「살아 있는 방장」 흐름(citizen4 등)은 첫 밤에 방장이 탈락할 확률이 4명판 1/3 이라
// 두 번이면 흐름마다 약 1/9 이상으로 실패한다(04-33 로컬 전체 실행에서 관찰: 시도마다 1/2 가까이) — 열 흐름 × 세 폭 전체 실행이 자주 깨져서 네 번으로 늘렸다. 검사 기준과는 무관하다.
const MAX_ATTEMPTS = 4;

/** 작업 하나: 새 방·새 컨텍스트. 준비 실패(SetupError·시간 초과·선택자 오류)는 새 방으로 다시 돈다(최대 MAX_ATTEMPTS번). 검사 실패는 다시 돌지 않는다. */
async function runJob({ flow, size }) {
  const t0 = performance.now();
  let lastError = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const ctx = { origin, size, shots: args.shots, browser, secrets, results: [], host: null, stage: "connect" };
    try {
      await flow.run(ctx);
      results.push(...ctx.results);
      lastError = null;
      break;
    } catch (e) {
      lastError = e;
    } finally {
      await ctx.host?.context.close().catch(() => {});
    }
  }
  if (lastError !== null) {
    const msg = String(lastError instanceof Error ? lastError.message : lastError).split("\n")[0].slice(0, 200);
    const setup = lastError instanceof SetupError;
    results.push({
      scenario: `${flow.id}/setup`,
      size: size.label,
      id: "S4",
      label: "단계 도달",
      ok: false,
      detail: `${setup ? "" : "(실행 오류) "}${msg}`,
    });
  }
  emit(`끝: ${flow.id} ${size.label} (${Math.round((performance.now() - t0) / 1000)}초)`);
}

let next = 0;
async function worker() {
  while (next < jobs.length && aborted === null) {
    const job = jobs[next++];
    await runJob(job);
  }
}
await Promise.all(Array.from({ length: Math.min(MAX_PARALLEL, jobs.length) }, worker));
clearTimeout(limitTimer);
if (aborted === null) finish(browser);
