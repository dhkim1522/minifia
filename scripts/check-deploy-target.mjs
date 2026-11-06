// 빌드 뒤·배포 앞 게이트(결정 0043-3·0044-24, DEPLOY-02). `npm run deploy` 가 vite build 와 wrangler deploy 사이에 부른다.
//   node scripts/check-deploy-target.mjs
// 실제 배포 입력(.wrangler/deploy/config.json 이 가리키는 dist/worker/wrangler.json)의 name 이
// deploy-target.mjs 의 WORKER_NAME 이 아니면 wrangler deploy 전에 종료 상태 1 로 멈춘다.
// Node 내장만 쓴다. 경로는 이 파일 기준으로 풀어 실행 위치와 무관하다.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { WORKER_NAME, expectedOrigin, judgeDeployTarget, stripJsonComments } from "./deploy-target.mjs";

const root = (rel) => fileURLToPath(new URL(`../${rel}`, import.meta.url));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const builtPath = root("dist/worker/wrangler.json");
  if (!existsSync(builtPath)) {
    console.error("배포 중단 — 빌드 산출물 없음(dist/worker/wrangler.json). vite build 뒤에 실행하세요.");
    process.exit(1);
  }
  let verdict;
  try {
    const built = JSON.parse(readFileSync(builtPath, "utf8"));
    const source = JSON.parse(stripJsonComments(readFileSync(root("wrangler.jsonc"), "utf8")));
    verdict = judgeDeployTarget({
      builtName: built.name,
      sourceName: source.name,
      prodUrl: readFileSync(root("scripts/prod-url.txt"), "utf8"),
      previewUrls: source.preview_urls,
    });
  } catch (err) {
    console.error(`배포 중단 — 배포 대상 설정을 읽지 못함: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
  if (!verdict.ok) {
    for (const problem of verdict.problems) console.error(`- ${problem}`);
    console.error(`배포 중단 — 배포 대상이 ${WORKER_NAME} 과 어긋남`);
    process.exit(1);
  }
  console.log(`배포 대상 확인: ${WORKER_NAME} (${expectedOrigin()})`);
}
