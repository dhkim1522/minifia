import { cloudflareTest } from "@cloudflare/vitest-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

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
        plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" } })],
        test: { name: "worker", include: ["test/worker/**/*.test.ts"], setupFiles: ["test/worker/setup.ts"] },
      },
    ],
  },
});
