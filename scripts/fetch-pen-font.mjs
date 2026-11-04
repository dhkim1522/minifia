// 손글씨 글꼴 Nanum Pen Script 를 Google Fonts 에서 한 번 받아 저장소에 둔다 (결정 M-10, 09.1-10).
// 앱은 실행 중 외부 글꼴 요청을 하지 않는다 — 이 스크립트를 돌릴 때만 네트워크를 쓴다.
// 조각(woff2)은 고치지 않고 그대로 둔다(OFL 수정본·예약 글꼴 이름 조항을 건드리지 않기 위해).
//
// 사용법:
//   node scripts/fetch-pen-font.mjs
// 만드는 것:
//   public/fonts/nanum-pen-script/nps-NNN.woff2, OFL.txt, sources.json
//   src/styles/penFont.css
// 받기·확인이 하나라도 실패하면 아무것도 덮어쓰지 않고 종료 코드 1 로 끝난다.
import { createHash } from "node:crypto";
import { mkdirSync, renameSync, rmSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const CSS_URL = "https://fonts.googleapis.com/css2?family=Nanum+Pen+Script&display=swap";
const LICENSE_URL = "https://raw.githubusercontent.com/google/fonts/main/ofl/nanumpenscript/OFL.txt";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const OUT_DIR = root("public/fonts/nanum-pen-script");
const CSS_OUT = root("src/styles/penFont.css");

async function get(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res;
}

async function main() {
  const css = await (await get(CSS_URL, { headers: { "User-Agent": UA } })).text();
  const blocks = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1]);
  if (blocks.length === 0) throw new Error("@font-face 블록이 없다");

  const items = blocks.map((b, i) => {
    const url = /url\((https:\/\/fonts\.gstatic\.com\/[^)\s]+\.woff2)\)/.exec(b)?.[1];
    const range = /unicode-range:\s*([^;]+);/.exec(b)?.[1].trim();
    if (!url || !range) throw new Error(`블록 ${i}: url 또는 unicode-range 를 읽지 못했다`);
    return { file: `nps-${String(i).padStart(3, "0")}.woff2`, url, unicodeRange: range };
  });

  const files = [];
  for (const it of items) {
    const buf = Buffer.from(await (await get(it.url)).arrayBuffer());
    if (buf.subarray(0, 4).toString("latin1") !== "wOF2") throw new Error(`${it.file}: woff2 머리가 아니다`);
    files.push({ ...it, bytes: buf.length, sha256: createHash("sha256").update(buf).digest("hex"), buf });
  }

  const ofl = await (await get(LICENSE_URL)).text();
  if (!ofl.includes("SIL Open Font License, Version 1.1")) throw new Error("OFL 1.1 원문이 아니다");

  const sources = {
    fetchedAt: new Date().toISOString(),
    cssUrl: CSS_URL,
    licenseUrl: LICENSE_URL,
    files: files.map(({ buf, ...e }) => ({ file: e.file, url: e.url, unicodeRange: e.unicodeRange, bytes: e.bytes, sha256: e.sha256 })),
  };
  const faces = files
    .map(
      (f) => `@font-face {
  font-family: "Nanum Pen Script";
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(/fonts/nanum-pen-script/${f.file}) format("woff2");
  unicode-range: ${f.unicodeRange};
}`,
    )
    .join("\n");
  const header = `/* 생성 파일 — scripts/fetch-pen-font.mjs. Nanum Pen Script, SIL OFL 1.1(public/fonts/nanum-pen-script/OFL.txt).
   Google Fonts 배포 조각을 고치지 않고 같은 출처로 둔다(결정 M-10). 손으로 고치지 않는다. */\n`;

  // 모두 받은 뒤에만 쓴다: 임시 폴더에 만들고 바꿔 끼운다.
  const tmp = `${OUT_DIR}.tmp`;
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  for (const f of files) writeFileSync(`${tmp}/${f.file}`, f.buf);
  writeFileSync(`${tmp}/OFL.txt`, ofl);
  writeFileSync(`${tmp}/sources.json`, `${JSON.stringify(sources, null, 2)}\n`);
  rmSync(OUT_DIR, { recursive: true, force: true });
  renameSync(tmp, OUT_DIR);
  writeFileSync(CSS_OUT, `${header}${faces}\n`);

  const total = files.reduce((n, f) => n + f.bytes, 0);
  console.log(`조각 ${files.length}개, ${total} 바이트, ${readdirSync(OUT_DIR).length} 파일 -> ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(`실패: ${e.message}`);
  process.exit(1);
});
