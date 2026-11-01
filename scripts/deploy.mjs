// 배포 실행기(결정 0043-3·0044-24, DEPLOY-02). `npm run deploy` 의 마지막 단계로 wrangler deploy 를 고정 인자로 실행한다.
//   node scripts/deploy.mjs
// npm 은 `npm run deploy -- <인자>` 의 인자를 스크립트 문자열 맨 끝에 붙인다. 예전에는 그 끝이 `wrangler deploy` 라서
// `-- --name minifia` 가 check-deploy-target 가드를 지난 뒤 wrangler 로 넘어가 v1.0 Worker 를 덮어쓸 수 있었다.
// 이 래퍼는 추가 인자를 받으면 아무것도 실행하지 않고 멈추며, wrangler 에는 argv 를 넘기지 않는다.
// Node 내장만 쓴다.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/** wrangler 로 넘기는 고정 인자 — 외부 입력이 들어오지 않는다. 대상 이름은 빌드 산출물(가드가 검사한 파일)에서 온다. */
export const WRANGLER_ARGS = Object.freeze(["wrangler", "deploy"]);

/**
 * 호출 인자로 실행 계획을 세운다. 추가 인자가 하나라도 있으면 거부하고, 아니면 고정 명령을 돌려준다.
 * @param {readonly string[]} extraArgs process.argv.slice(2)
 * @returns {{ ok: true, command: string, args: string[] } | { ok: false, reason: string }}
 */
export function planDeploy(extraArgs) {
  if (extraArgs.length > 0) {
    return {
      ok: false,
      reason: `배포 중단 — npm run deploy 는 추가 인자를 받지 않는다(받은 인자 ${extraArgs.length}개). 배포 대상은 wrangler.jsonc 한 곳에서만 정한다(결정 0043).`,
    };
  }
  return { ok: true, command: "npx", args: [...WRANGLER_ARGS] };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const plan = planDeploy(process.argv.slice(2));
  if (!plan.ok) {
    console.error(plan.reason);
    process.exit(1);
  }
  const r = spawnSync(plan.command, plan.args, { stdio: "inherit", shell: process.platform === "win32" });
  process.exit(r.status ?? 1);
}
