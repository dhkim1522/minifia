// 손글씨 글꼴 자체 호스팅 시험 (09.1-10, 결정 M-10). 생성: node scripts/fetch-pen-font.mjs
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ROOT = new URL("../../", import.meta.url);
const read = (p: string) => readFileSync(new URL(p, ROOT), "utf8");
const dir = new URL("public/fonts/nanum-pen-script/", ROOT);
const css = existsSync(new URL("src/styles/penFont.css", ROOT)) ? read("src/styles/penFont.css") : "";
const woffs = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".woff2")).sort() : [];

describe("penFont.css", () => {
  const blocks = css.match(/@font-face\s*\{[^}]*\}/g) ?? [];

  it("@font-face 개수가 woff2 조각 수와 같다", () => {
    expect(woffs.length).toBeGreaterThanOrEqual(90);
    expect(blocks.length).toBe(woffs.length);
  });

  it("블록마다 family·weight·display·unicode-range 가 있다", () => {
    for (const b of blocks) {
      expect(b).toMatch(/font-family:\s*["']Nanum Pen Script["']/);
      expect(b).toMatch(/font-weight:\s*400/);
      expect(b).toMatch(/font-display:\s*swap/);
      expect(b).toMatch(/unicode-range:/);
    }
  });

  it("url 은 같은 출처 /fonts/nanum-pen-script/nps-NNN.woff2 이고 파일이 있으며 wOF2 로 시작한다", () => {
    const urls = [...css.matchAll(/url\(([^)]*)\)/g)].map((m) => m[1].replace(/["']/g, ""));
    expect(urls.length).toBe(woffs.length);
    for (const u of urls) {
      expect(u).toMatch(/^\/fonts\/nanum-pen-script\/nps-\d{3}\.woff2$/);
      const f = new URL(`public${u}`, ROOT);
      expect(existsSync(f)).toBe(true);
      expect(readFileSync(f).subarray(0, 4).toString("latin1")).toBe("wOF2");
    }
  });

  it("외부 주소가 없다", () => {
    expect(css).not.toContain("http");
  });
});

describe("sources.json", () => {
  const src = existsSync(new URL("sources.json", dir)) ? JSON.parse(readFileSync(new URL("sources.json", dir), "utf8")) : { files: [] };

  it("파일별 sha256·바이트가 실제와 같고 원본은 fonts.gstatic.com 이다", () => {
    expect(src.files.length).toBe(woffs.length);
    let total = 0;
    for (const e of src.files) {
      const buf = readFileSync(new URL(e.file, dir));
      expect(createHash("sha256").update(buf).digest("hex")).toBe(e.sha256);
      expect(buf.length).toBe(e.bytes);
      expect(e.url.startsWith("https://fonts.gstatic.com/")).toBe(true);
      total += buf.length;
    }
    expect(total).toBeLessThanOrEqual(1_500_000);
  });
});

describe("라이선스·외부 요청", () => {
  it("OFL.txt 에 OFL 1.1 과 Nanum 이 있다", () => {
    const t = existsSync(new URL("OFL.txt", dir)) ? readFileSync(new URL("OFL.txt", dir), "utf8") : "";
    expect(t).toContain("SIL Open Font License, Version 1.1");
    expect(t).toContain("Nanum");
  });

  it("index.html 은 Nanum 글꼴을 외부로 부르지 않는다", () => {
    expect(read("index.html")).not.toContain("Nanum");
  });

  it("public/_headers 에 /fonts/* 캐시 규칙이 있다", () => {
    expect(read("public/_headers")).toMatch(/^\/fonts\/\*\s*\n\s+Cache-Control:/m);
  });

  it("src 에 Nanum 글꼴을 외부 주소로 부르는 줄이 없다", () => {
    const walk = (d: URL): string[] =>
      readdirSync(d, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(new URL(`${e.name}/`, d)) : [new URL(e.name, d).pathname],
      );
    for (const f of walk(new URL("src/", ROOT))) {
      if (!/\.(css|ts|tsx|html)$/.test(f)) continue;
      const lines = readFileSync(f, "utf8").split("\n");
      for (const l of lines) expect(/https?:\/\/[^\s"')]*Nanum/i.test(l) || /fonts\.googleapis\.com[^\s]*Nanum/i.test(l)).toBe(false);
    }
  });
});
