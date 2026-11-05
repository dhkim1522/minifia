// 12-02: 소리 출처 시험 (D-20, T-12-05) — 외부 오디오 파일 0, 소리 라이브러리 0.
// 하나라도 들이면 docs/audio.md 의 출처 표에 그 항목 행이 있어야 한다.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const AUDIO_EXT = /\.(mp3|ogg|wav|m4a|aac|flac|opus)$/i;
const SOUND_LIBS = [
  "howler",
  "tone",
  "zzfx",
  "zzfxm",
  "pizzicato",
  "soundfont-player",
  "standardized-audio-context",
  "wavesurfer.js",
];

const tracked = execFileSync("git", ["ls-files", "--", "public", "src"], { cwd: ROOT, encoding: "utf8" })
  .split("\n")
  .filter((p) => p !== "");
const pkg = JSON.parse(readFileSync(`${ROOT}package.json`, "utf8")) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
const depNames = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})];

describe("소리 출처 — 외부 자산 0 (D-20)", () => {
  const audioFiles = tracked.filter((p) => AUDIO_EXT.test(p));
  const soundDeps = depNames.filter((d) => SOUND_LIBS.includes(d));

  it("git 이 추적하는 public·src 에 오디오 파일이 0 이다", () => {
    expect(tracked.length).toBeGreaterThan(0); // git ls-files 가 실제로 돌았는지
    expect(audioFiles).toEqual([]);
  });

  it("package.json 에 알려진 소리 라이브러리가 0 이다", () => {
    expect(depNames.length).toBeGreaterThan(0);
    expect(soundDeps).toEqual([]);
  });

  it("외부 자산이 생기면 docs/audio.md 출처 표에 행이 있어야 한다(지금은 0이라 문서가 없어도 통과)", () => {
    const found = [...audioFiles, ...soundDeps];
    if (found.length === 0) return;
    expect(existsSync(`${ROOT}docs/audio.md`)).toBe(true);
    const doc = readFileSync(`${ROOT}docs/audio.md`, "utf8");
    for (const item of found) expect(doc, `docs/audio.md 에 ${item} 행이 없다`).toContain(item);
  });
});
