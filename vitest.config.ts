import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// 판 기록 D1 마이그레이션(D-18): 노드 쪽에서 실제 파일을 읽어 워커 시험 바인딩으로 넘기고, test/worker/setup.ts 가 메모리 D1 에 적용한다.
const migrations = await readD1Migrations("./migrations");

// passWithNoTests 는 일부러 켜지 않는다: 파일 필터가 아무것도 못 찾으면 실패해야 검증 명령이 의미를 가진다.
export default defineConfig({
  test: {
    projects: [
      { test: { name: "unit", environment: "node", include: ["test/unit/**/*.test.ts"], setupFiles: ["test/unit/setup.ts"] } },
      {
        plugins: [react()],
        test: { name: "client", environment: "happy-dom", include: ["test/client/**/*.test.{ts,tsx}"] },
      },
      {
        plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" }, miniflare: { bindings: { TEST_MIGRATIONS: migrations } } })],
        test: { name: "worker", include: ["test/worker/**/*.test.ts"], setupFiles: ["test/worker/setup.ts"] },
      },
    ],
  },
});
