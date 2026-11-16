// 판 기록 조회(23-02, D-17): `npm run games [-- --local|--remote|--all]` — 판 기록을 한국어 한 화면으로 본다.
//   기본은 --local(로컬 D1)이고 봇·테스트 방 판(has_bots = 1)을 뺀다. --remote 는 원격 D1, --all 은 봇 판도 센다.
// 허용 인자는 위 셋뿐이고 그 밖은 아무것도 실행하지 않고 멈춘다. SQL 은 코드 상수라 인자가 SQL 에 들어가지 않는다.
// --remote 는 wrangler 를 부르기 전에 check-account 와 같은 판정(judgeWhoami)으로 개인 계정을 확인한다(D-19, 우회 금지).
// wrangler 는 셸 없이 node 로 직접 부른다(SQL 의 괄호·따옴표가 셸을 지나지 않는다). Node 내장만 쓴다.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { judgeWhoami } from "./check-account.mjs";

const USAGE = "사용법: npm run games [-- --local | --remote] [--all]  (기본 --local, 봇·테스트 방 판 제외, --all 은 포함)";

/**
 * 호출 인자로 실행 계획을 세운다. 허용 인자(--local·--remote·--all) 밖이거나 --local 과 --remote 를 함께 주면 거부한다.
 * @param {readonly string[]} argv process.argv.slice(2)
 * @returns {{ ok: true, target: "local" | "remote", includeBots: boolean } | { ok: false, reason: string }}
 */
export function planGames(argv) {
  let target = "local";
  let includeBots = false;
  let sawLocal = false;
  let sawRemote = false;
  for (const arg of argv) {
    if (arg === "--local") sawLocal = true;
    else if (arg === "--remote") sawRemote = true;
    else if (arg === "--all") includeBots = true;
    else return { ok: false, reason: `알 수 없는 인자 — 아무것도 실행하지 않았다. ${USAGE}` };
  }
  if (sawLocal && sawRemote) return { ok: false, reason: `--local 과 --remote 는 함께 쓸 수 없다. ${USAGE}` };
  if (sawRemote) target = "remote";
  return { ok: true, target, includeBots };
}

const SELECT = `SELECT
  COUNT(*) AS games,
  AVG(CASE WHEN winner = 'mafia' THEN 1.0 ELSE 0.0 END) AS mafia_win_rate,
  AVG(duration_s) AS avg_duration_s,
  AVG(first_day_caught) AS first_day_caught_rate,
  AVG(probe_success) AS probe_success_rate,
  AVG(players) AS avg_players
FROM games`;

const SQL_EXCLUDING_BOTS = `${SELECT} WHERE has_bots = 0`;
const SQL_ALL = SELECT;

/**
 * 요약 조회 SQL — 고정 문자열 둘 중 하나. 인자 값은 들어가지 않는다.
 * @param {boolean} includeBots
 */
export function summarySql(includeBots) {
  return includeBots ? SQL_ALL : SQL_EXCLUDING_BOTS;
}

const pct = (v) => `${Math.round(Number(v ?? 0) * 100)}%`;

/**
 * 요약 행을 한국어 한 화면으로 만든다. 행이 없거나 0판이면 한 줄 안내.
 * @param {ReadonlyArray<Record<string, number | null>> | undefined} rows
 */
export function formatSummary(rows) {
  const row = rows?.[0];
  if (!row || !Number(row.games)) return "아직 기록이 없어요";
  const total = Math.round(Number(row.avg_duration_s ?? 0));
  const players = Math.round(Number(row.avg_players ?? 0) * 10) / 10;
  return [
    `판 ${row.games}`,
    `마피아 승률 ${pct(row.mafia_win_rate)}`,
    `평균 길이 ${Math.floor(total / 60)}분 ${total % 60}초`,
    `첫날 잡힘 ${pct(row.first_day_caught_rate)}`,
    `떠보기 성공 ${pct(row.probe_success_rate)}`,
    `평균 인원 ${players}명`,
  ].join("\n");
}

/**
 * 계획대로 조회한다. exec 는 wrangler 인자 배열을 받아 { status, stdout, stderr } 를 돌려준다(시험에서 가짜로 바꾼다).
 * @param {{ ok: boolean, target?: string, includeBots?: boolean, reason?: string }} plan
 * @param {{ exec: (args: string[]) => { status: number | null, stdout?: string, stderr?: string } }} deps
 * @returns {{ ok: true, output: string } | { ok: false, reason: string }}
 */
export function runGames(plan, deps) {
  if (!plan.ok) return { ok: false, reason: plan.reason ?? "실행하지 않음" };
  if (plan.target === "remote") {
    const who = deps.exec(["whoami"]);
    const verdict = judgeWhoami(`${who.stdout ?? ""}\n${who.stderr ?? ""}`, who.status);
    if (!verdict.ok) return { ok: false, reason: `원격 조회 중단 — ${verdict.reason}` };
  }
  const r = deps.exec(["d1", "execute", "DB", `--${plan.target}`, "--json", "--command", summarySql(Boolean(plan.includeBots))]);
  if (r.status !== 0) return { ok: false, reason: `wrangler d1 execute 가 실패함(종료 상태 ${r.status}). ${String(r.stderr ?? "").trim()}`.trim() };
  let parsed;
  try {
    parsed = JSON.parse(r.stdout ?? "");
  } catch {
    return { ok: false, reason: "wrangler 출력을 읽지 못함(JSON 아님)" };
  }
  const rows = Array.isArray(parsed) ? parsed[0]?.results : undefined;
  return { ok: true, output: formatSummary(rows) };
}

/** 실제 실행기 — 셸 없이 node 로 설치된 wrangler 를 부른다. */
function wranglerExec(args) {
  const bin = join(dirname(createRequire(import.meta.url).resolve("wrangler/package.json")), "bin", "wrangler.js");
  const r = spawnSync(process.execPath, [bin, ...args], { encoding: "utf8", shell: false });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = runGames(planGames(process.argv.slice(2)), { exec: wranglerExec });
  if (!result.ok) {
    console.error(result.reason);
    process.exit(1);
  }
  console.log(result.output);
}
