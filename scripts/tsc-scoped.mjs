// 범위 좁힌 타입 검사 게이트. 전체 `npm run typecheck` 가 아직 못 닫힌 중간 계획에서, 지금 고치는 범위의 오류만 판정한다.
//   node scripts/tsc-scoped.mjs <tsconfig> <범위 정규식> [--ignore <정규식>]
// `tsc | grep -c` 는 일치가 0 일 때 종료 상태 1 을 내고, tsc 가 설정을 못 읽어 죽어도 출력이 비어 통과처럼 보인다.
// 그래서 판정을 한 곳에서 한다:
//   1. tsc 종료 상태 0 이면 통과.
//   2. 상태 1(또는 2)이면 모든 오류 줄이 `경로(줄,칸): error TSxxxx:` 형식이고, 코드가 5000~6999(설정·옵션 오류)가 아니고,
//      범위 안(무시 정규식 제외) 경로의 오류가 0 일 때만 통과.
//   3. 그 밖(경로 없는 전역 오류, 설정 크래시, 오류 줄 없는 비정상 종료, 알 수 없는 상태)은 실패.
// Node 내장만 쓴다.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ERROR_LINE = /^(.+?)\((\d+),(\d+)\): error TS(\d+): /;
const ANY_ERROR = /\berror TS\d+:/;

const toRegExp = (value) => (value instanceof RegExp ? value : new RegExp(value));
const normalizePath = (path) => path.replace(/\\/g, "/").replace(/^\.\//, "");

/**
 * tsc 한 번의 결과를 판정한다.
 * @param {{ status: number | null | undefined, output: string, scope: string | RegExp, ignore?: string | RegExp }} input
 * @returns {{ ok: boolean, reason: string, inScope: string[] }}
 */
export function evaluate({ status, output, scope, ignore }) {
  if (status === 0) return { ok: true, reason: "tsc 종료 상태 0", inScope: [] };
  if (status !== 1 && status !== 2) {
    return { ok: false, reason: `tsc 가 알 수 없는 종료 상태(${String(status)})로 끝났다`, inScope: [] };
  }
  const scopeRe = toRegExp(scope);
  const ignoreRe = ignore === undefined ? null : toRegExp(ignore);
  const lines = String(output ?? "").split(/\r?\n/);
  let errorCount = 0;
  const inScope = [];
  for (const line of lines) {
    // 들여쓴 줄은 앞 오류 메시지의 이어지는 설명이다.
    if (/^\s/.test(line) || line === "") continue;
    if (!ANY_ERROR.test(line)) continue;
    const m = ERROR_LINE.exec(line);
    if (m === null) {
      return { ok: false, reason: `경로 없는 전역 오류: ${line}`, inScope: [] };
    }
    const code = Number(m[4]);
    if (code >= 5000 && code <= 6999) {
      return { ok: false, reason: `설정·옵션 오류(TS${code}): ${line}`, inScope: [] };
    }
    errorCount += 1;
    const path = normalizePath(m[1]);
    if (scopeRe.test(path) && !(ignoreRe !== null && ignoreRe.test(path))) inScope.push(line);
  }
  if (errorCount === 0) {
    return { ok: false, reason: `종료 상태 ${status} 인데 오류 줄이 없다 (tsc 비정상 종료)`, inScope: [] };
  }
  if (inScope.length > 0) {
    return { ok: false, reason: `범위 안 오류 ${inScope.length}건 (전체 ${errorCount}건)`, inScope };
  }
  return { ok: true, reason: `범위 밖 오류만 ${errorCount}건`, inScope: [] };
}

function main(argv) {
  const [tsconfig, scope, ...rest] = argv;
  let ignore;
  for (let i = 0; i < rest.length; i += 1) {
    if (rest[i] === "--ignore" && rest[i + 1] !== undefined) {
      ignore = rest[i + 1];
      i += 1;
    }
  }
  if (!tsconfig || !scope) {
    console.error("usage: node scripts/tsc-scoped.mjs <tsconfig> <scope-regex> [--ignore <regex>]");
    return 1;
  }
  const result = spawnSync("npx", ["tsc", "-p", tsconfig, "--noEmit", "--pretty", "false"], {
    encoding: "utf8",
    shell: process.platform === "win32",
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const verdict = evaluate({ status: result.status, output, scope, ignore });
  if (verdict.ok) {
    console.log(`TSC-SCOPED OK (${verdict.reason}) scope=${scope}${ignore ? ` ignore=${ignore}` : ""}`);
    return 0;
  }
  console.log(`TSC-SCOPED FAIL: ${verdict.reason}`);
  for (const line of verdict.inScope) console.log(line);
  return 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main(process.argv.slice(2)));
}
