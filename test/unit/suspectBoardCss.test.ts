// 의심 보드 층의 눌림(21-16 E2E 가 실브라우저에서 찾은 결함의 회귀 시험): .mf-game__record 는 pointer-events: none 이라 자식이 auto 를 따로 받아야 한다.
// jsdom/happy-dom 은 눌림 가로채기를 재지 못하므로 CSS 원문으로 고정한다.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const game = readFileSync(new URL("../../src/styles/game.css", import.meta.url), "utf8");
const v2 = readFileSync(new URL("../../src/styles/v2.css", import.meta.url), "utf8");

describe("의심 보드 층 눌림과 목격 칩 누르기 높이 (21-16)", () => {
  it(".mf-game__record 의 직접 자식 의심 보드가 pointer-events: auto 를 받는다(닫기·목격 칩이 월드 입력층 아래로 샌다)", () => {
    expect(game).toMatch(/\.mf-game__record\s*\{[^}]*pointer-events:\s*none/);
    expect(game).toMatch(/\.mf-game__record\s*>\s*\.mv-suspect-board[^{]*\{[^}]*pointer-events:\s*auto/);
  });

  it("목격 칩 단추는 요소 자체가 44 높이(G3: 누르기 44)이고 위아래 -6 여백으로 자리는 32 만 쓴다", () => {
    const rule = /\.mv-suspect-board__witness\s*\{([^}]*)\}/.exec(v2)?.[1] ?? "";
    expect(rule).toMatch(/min-height:\s*44px/);
    expect(rule).toMatch(/margin:\s*-6px 0/);
  });
});
