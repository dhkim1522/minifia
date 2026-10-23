import { execSync } from "node:child_process";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";

// 빌드 버전: UTC 시각(초 단위) + 짧은 커밋 해시. /api/health 의 version 으로 보인다.
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

// 개발 서버(vite dev)는 주소의 %40 을 파일 이름의 @ 로 되돌리지 않아 인물 그림 대신 HTML 이 온다. 개발 서버에서만 되돌려 준다.
// 배포본의 정적 에셋 서빙은 %40 주소를 그대로 처리하므로 빌드에는 들어가지 않는다.
const decodeAtSign = (): Plugin => ({
  name: "minifia:decode-at-sign",
  apply: "serve",
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url) req.url = req.url.replace(/%40/gi, "@");
      next();
    });
  },
});

const define = { __APP_VERSION__: JSON.stringify(buildVersion()) };

export default defineConfig({
  plugins: [decodeAtSign(), react(), cloudflare({ viteEnvironment: { name: "worker" } })],
  define,
  environments: { worker: { define, build: { sourcemap: true } } },
});
