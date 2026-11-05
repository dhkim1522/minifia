// 12-05: 소리 저장값 `minifia:sound` 와 엔진·훅의 네트워크 금지 (D-6, LS-9, T-12-17, T-12-18)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SOUND_PREF_KEY, loadSoundPref, saveSoundPref } from "../../src/audio/prefs";
import { MemoryStorage } from "../helpers/memoryStorage";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

describe("loadSoundPref / saveSoundPref", () => {
  it("키는 minifia:sound, 값은 { v: 1, on }", () => {
    const s = new MemoryStorage();
    saveSoundPref(false, s);
    expect(SOUND_PREF_KEY).toBe("minifia:sound");
    expect(JSON.parse(s.getItem("minifia:sound")!)).toEqual({ v: 1, on: false });
    expect(loadSoundPref(s)).toBe(false);
    saveSoundPref(true, s);
    expect(loadSoundPref(s)).toBe(true);
  });

  it.each([
    ["없음", null],
    ["깨진 JSON", "{not json"],
    ["배열", "[1]"],
    ["null", "null"],
    ["on 이 불리언이 아님", JSON.stringify({ v: 1, on: "no" })],
    ["on 없음", JSON.stringify({ v: 1 })],
    ["버전이 다름", JSON.stringify({ v: 2, on: false })],
    ["버전 없음", JSON.stringify({ on: false })],
  ])("%s → 기본 켜짐", (_name, raw) => {
    const s = new MemoryStorage();
    if (raw !== null) s.setItem(SOUND_PREF_KEY, raw);
    expect(loadSoundPref(s)).toBe(true);
  });

  it("저장소 읽기·쓰기 예외는 삼키고 기본값을 쓴다", () => {
    const broken = {
      getItem(): string | null {
        throw new DOMException("denied", "SecurityError");
      },
      setItem(): void {
        throw new DOMException("quota", "QuotaExceededError");
      },
    };
    expect(loadSoundPref(broken)).toBe(true);
    expect(() => saveSoundPref(false, broken)).not.toThrow();
  });

  it("저장소가 없으면(null) 기본값이고 쓰기는 조용히 넘어간다", () => {
    expect(loadSoundPref(null)).toBe(true);
    expect(() => saveSoundPref(false, null)).not.toThrow();
  });
});

describe("정적 가드 — 서버로 가는 길과 무음 루프 우회가 없다 (T-12-18)", () => {
  const FILES = ["engine", "prefs", "testHook", "synth"].map((n) => [n, readFileSync(`${ROOT}src/audio/${n}.ts`, "utf8")] as const);
  const code = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'])\/\/.*$/gm, "$1");

  it.each(FILES)("%s: fetch·WebSocket·XMLHttpRequest·sendBeacon 이 없다", (_n, src) => {
    expect(code(src)).not.toMatch(/\b(fetch|WebSocket|XMLHttpRequest|sendBeacon|EventSource)\b/);
  });

  it.each(FILES)("%s: 프로토콜·연결 import 가 없다", (_n, src) => {
    expect(code(src)).not.toMatch(/shared\/protocol|useRoomConnection|net\//);
  });

  it.each(FILES)("%s: HTMLAudio 무음 루프·새 Audio 를 쓰지 않는다", (_n, src) => {
    expect(code(src)).not.toMatch(/new Audio\(|HTMLAudioElement|<audio|createMediaElementSource/);
  });
});
