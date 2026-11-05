// 포즈 스트립(?e2e=1&pose-strip=1) 스크린샷 (10-06, D-8). 개발 서버(npm run dev)를 띄운 뒤:
//   node scripts/pose-strip-shot.mjs --url http://localhost:5173 --out .planning/phases/10-character-motion-costume/pose-strip
// 시스템 Chrome(playwright-core, 헤드리스 소프트웨어 WebGL)으로 [data-pose-strip="ready"] 를 기다려 PNG 를 저장한다. 서버로 아무것도 보내지 않는다.
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { findChrome } from "./e2e/lib.mjs";

/** 기본 산출물: [파일 이름, 쿼리] */
export const SHOTS = [
  ["strip-fig0-coat.png", "fig=0&outfit=coat"],
  ["strip-fig0-detective.png", "fig=0&outfit=detective"],
  ["strip-fig3-hood.png", "fig=3&outfit=hood"],
  ["combos-idle.png", "view=combos&pose=idle"],
  ["combos-walk.png", "view=combos&pose=walk"],
];

function parseArgs(argv) {
  const o = { url: "http://localhost:5173", out: ".planning/phases/10-character-motion-costume/pose-strip" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--url") o.url = argv[++i];
    else if (argv[i] === "--out") o.out = argv[++i];
    else throw new Error(`알 수 없는 인자: ${argv[i]} (사용법: --url <주소> --out <폴더>)`);
  }
  return o;
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  const chrome = findChrome(process.platform, process.env, existsSync);
  mkdirSync(o.out, { recursive: true });
  const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  try {
    for (const [name, query] of SHOTS) {
      const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
      page.on("pageerror", (e) => console.error(`[pageerror] ${e.message}`));
      await page.goto(`${o.url}/?e2e=1&pose-strip=1&${query}`, { waitUntil: "load" });
      await page.waitForSelector('[data-pose-strip="ready"]', { timeout: 60_000 });
      const file = join(o.out, name);
      await page.screenshot({ path: file, fullPage: true });
      console.log(`저장: ${file}`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
