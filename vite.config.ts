import { execSync } from "node:child_process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";

// 빌드 버전: UTC 시각(초 단위) + 짧은 커밋 해시. 첫 화면 아래 v... 로 보인다.
function buildVersion(): string {
  const stamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  try {
    const sha = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
    return sha ? `${stamp}+${sha}` : stamp;
  } catch {
    return stamp;
  }
}

const define = { __APP_VERSION__: JSON.stringify(buildVersion()) };

export default defineConfig({
  plugins: [react(), cloudflare({ viteEnvironment: { name: "worker" } })],
  define,
  environments: { worker: { define, build: { sourcemap: true } } },
});
