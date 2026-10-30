// 배포 전 Cloudflare 계정 확인 게이트(결정 0042). `npm run deploy` 가 빌드·배포 전에 부른다.
//   node scripts/check-account.mjs
// `wrangler whoami` 가 개인 계정 이메일로 로그인돼 있을 때만 통과한다.
// 다른 계정·로그아웃·wrangler 실행 실패는 모두 배포를 멈춘다(종료 상태 1). 토큰·계정 ID 는 출력하지 않는다.
// Node 내장만 쓴다.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/** 배포를 허락하는 개인 Cloudflare 계정(docs/setup.md). */
export const EXPECTED_EMAIL = "dhkim1522@naver.com";

const EMAIL_LINE = /associated with the email\s+([^\s]+?)\.?\s*$/m;

/**
 * `wrangler whoami` 출력 한 번을 판정한다.
 * @param {string} output 표준 출력 + 표준 오류
 * @param {number | null} status 종료 상태
 * @returns {{ ok: boolean, email: string | null, reason: string }}
 */
export function judgeWhoami(output, status, expected = EXPECTED_EMAIL) {
  if (status !== 0) return { ok: false, email: null, reason: `wrangler whoami 가 실패함(종료 상태 ${status})` };
  const m = EMAIL_LINE.exec(output);
  if (!m) return { ok: false, email: null, reason: "로그인된 계정 이메일을 찾지 못함(로그아웃 상태일 수 있음)" };
  const email = m[1].toLowerCase();
  if (email !== expected.toLowerCase()) return { ok: false, email, reason: `개인 계정이 아님: ${email}` };
  return { ok: true, email, reason: "" };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const r = spawnSync("npx", ["wrangler", "whoami"], { encoding: "utf8", shell: process.platform === "win32" });
  const verdict = judgeWhoami(`${r.stdout ?? ""}\n${r.stderr ?? ""}`, r.status);
  if (verdict.ok) {
    console.log(`배포 계정 확인: ${verdict.email}`);
  } else {
    console.error(`배포 중단 — ${verdict.reason}. 개인 계정(${EXPECTED_EMAIL})으로 \`npx wrangler login\` 한 뒤 다시 실행하세요.`);
    process.exit(1);
  }
}
