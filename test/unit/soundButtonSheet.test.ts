// 12-12: 시트가 열려 있는 동안 소리 단추가 비켜선다 — 시트(.mf-will-layer)는 .mf-game 의 쌓임 맥락 안이라
// z-modal 이어도 방 루트의 소리 단추(z 51) 위로 올라가지 못해 폭 360×높이 560 에서 시트 [닫기]를 가렸다(night-sizes LT0).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const css = readFileSync(`${ROOT}src/styles/v2.css`, "utf8");
const game = readFileSync(`${ROOT}src/styles/game.css`, "utf8");
const gameMap = readFileSync(`${ROOT}src/screens/GameMap.tsx`, "utf8");

describe("소리 단추와 시트 층", () => {
  it("시트 층(data-sheet-layer)이 열리면 방 루트의 소리 단추가 숨고 눌리지 않는다", () => {
    expect(css).toMatch(/\.mf-room:has\(\[data-sheet-layer\]\)\s*>\s*\.mv-sound\s*\{[^}]*visibility:\s*hidden[^}]*pointer-events:\s*none/);
  });

  it("전제: 게임 화면은 쌓임 맥락(isolation)이고 시트 층은 그 안에서 data-sheet-layer 를 단다", () => {
    expect(game).toMatch(/\.mf-game\s*\{[^}]*isolation:\s*isolate/);
    expect(gameMap).toContain("data-sheet-layer");
  });
});
