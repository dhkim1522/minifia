// 12-12: 소리가 와이어·서버에 닿지 않음을 고정한다 (LS-9, T-12-47).
// (가) 서버(shared·worker)는 소리를 모른다 (나) 클라이언트 메시지 종류는 12페이즈 시작 때와 같다
// (다) src/audio 는 네트워크 API 를 쓰지 않는다 (라) docs/audio.md 레시피 지도가 소리 id 57개를 모두 담는다.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ClientMessageSchema } from "../../shared/schemas";
import { BED_IDS, SFX_IDS, SOUND_IDS } from "../../src/audio/recipes";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

function trackedFiles(...dirs: string[]): string[] {
  return execFileSync("git", ["ls-files", "--", ...dirs], { cwd: ROOT, encoding: "utf8" })
    .split("\n")
    .filter((p) => /\.(ts|tsx)$/.test(p));
}

/** 12페이즈 시작 시점(소리를 더하기 전)의 클라이언트 메시지 종류. 소리가 새 메시지를 만들지 않았음을 고정한다. */
const CLIENT_MESSAGE_KINDS = [
  "badge",
  "chat",
  "dress",
  "emote",
  "endDiscussion",
  "errand", // 15페이즈(결정 0074): 소리와 무관한 새 메시지 — 심부름 처리. 이 목록은 소리가 만든 메시지가 없다는 것을 고정하는 것이라 15페이즈의 한 줄만 더했다
  "hello",
  "kick",
  "leave",
  "mapPick",
  "move",
  "note",
  "pick",
  "ping",
  "point",
  "ready",
  "rematch",
  "start",
  "testBotVote",
  "testBots",
  "testReset",
  "testRole",
  "testSkip",
  "tutorialDone", // 17페이즈(결정 0080): 소리와 무관한 새 메시지 — 튜토리얼 끝났음. 이 목록은 소리가 만든 메시지가 없다는 것을 고정하는 것이라 17페이즈의 한 줄만 더했다
  "typing",
  "verdict",
  "whisper",
  "will",
];

describe("소리 프로토콜 불변 (LS-9)", () => {
  it("(가) shared/ 와 worker/ 소스에 소리·오디오 개념이 없다 — 서버는 소리를 모른다", () => {
    const files = trackedFiles("shared", "worker");
    expect(files.length).toBeGreaterThan(20); // git ls-files 가 실제로 돌았는지
    const hits: string[] = [];
    for (const f of files) {
      const text = readFileSync(`${ROOT}${f}`, "utf8");
      text.split("\n").forEach((line, i) => {
        if (/\b(sound|audio)/i.test(line)) hits.push(`${f}:${i + 1}`);
      });
    }
    expect(hits).toEqual([]);
  });

  it("(나) 클라이언트 메시지 종류 목록이 12페이즈 시작 때와 같다", () => {
    const kinds = ClientMessageSchema.options.map((o) => (o.shape.t as unknown as { value: string }).value).sort();
    expect(kinds).toEqual([...CLIENT_MESSAGE_KINDS].sort());
    expect(kinds.some((k) => /sound|audio|mute/i.test(k))).toBe(false);
  });

  it("(다) src/audio 소스에 네트워크 API 사용이 없다", () => {
    const files = trackedFiles("src/audio");
    expect(files.length).toBeGreaterThan(8);
    const hits: string[] = [];
    for (const f of files) {
      const text = readFileSync(`${ROOT}${f}`, "utf8");
      for (const name of ["fetch", "WebSocket", "XMLHttpRequest", "sendBeacon", "EventSource"]) {
        if (new RegExp(`\\b${name}\\b`).test(text)) hits.push(`${f}: ${name}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("(라) docs/audio.md 레시피 지도가 소리 id 56개를 모두 담는다", () => {
    expect(SOUND_IDS).toHaveLength(57);
    expect(BED_IDS).toHaveLength(7);
    expect(SFX_IDS).toHaveLength(50);
    const doc = readFileSync(`${ROOT}docs/audio.md`, "utf8");
    const missing = SOUND_IDS.filter((id) => !doc.includes(`\`${id}\``));
    expect(missing).toEqual([]);
  });
});
