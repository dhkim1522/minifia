// 인물 에셋 검사(10-06, D-15·D-16): 45조합 예산·동작 표 무결성·EMOTE_MS 일치·manifest 출처.
// 검사 본체는 test/unit/characterBudget.test.ts 다(WebGL 불필요). 이 파일은 그 시험을 돌리고 종료 코드를 그대로 돌려준다.
import { spawnSync } from "node:child_process";

const r = spawnSync("npx", ["vitest", "run", "test/unit/characterBudget.test.ts"], { stdio: "inherit", shell: process.platform === "win32" });
process.exit(r.status ?? 1);
