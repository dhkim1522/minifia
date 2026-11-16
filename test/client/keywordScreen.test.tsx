// 23-01: 키워드 카드 화면(src/screens/Keyword.tsx) — 장르 줄·큰 키워드(마피아는 ???)·각주(P23-3~5).
// 표식 값에는 역할·키워드를 싣지 않는다(T-23-03). 키워드는 텍스트 노드로만.
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { RoomView } from "../../shared/protocol";
import { Keyword } from "../../src/screens/Keyword";

afterEach(cleanup);

const NOW = 1_700_000_000_000;

function makeView(me: RoomView["me"]): RoomView {
  return {
    code: "0042",
    phase: "keyword",
    phaseEndsAt: NOW + 13_000,
    phaseDurationMs: 13_000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players: [
      { seat: 0, nickname: "지우", connected: true, isHost: true, alive: true },
      { seat: 1, nickname: "하윤", connected: true, isHost: false, alive: true },
      { seat: 2, nickname: "민지", connected: true, isHost: false, alive: true },
      { seat: 3, nickname: "도현", connected: true, isHost: false, alive: true },
    ],
    me,
    day: { n: 1, roles: ["mafia", "police", "doctor", "citizen"], keyword: { genre: "영화" } },
  };
}

const renderKeyword = (view: RoomView) =>
  render(<Keyword view={view} offset={0} myRoleButton={<button type="button">역할 카드</button>} />);

describe("키워드 카드 — 시민 편", () => {
  it("장르 줄·키워드·각주가 카드에 있고 카드는 '첫날 문제' 그룹이다", () => {
    const { container, getByRole } = renderKeyword(makeView({ seat: 0, isHost: true, role: "citizen", keyword: "해리포터" }));
    expect(container.querySelector("[data-keyword-screen]")).not.toBeNull();
    expect(container.querySelector("[data-keyword-genre]")!.textContent).toBe("장르 : 영화");
    expect(container.querySelector("[data-keyword-word]")!.textContent).toBe("해리포터");
    expect(container.querySelector("[data-keyword-note]")!.textContent).toBe("* 직접적인 키워드는 언급하면 안 됩니다.");
    expect(getByRole("group", { name: "첫날 문제" })).toBe(container.querySelector("[data-keyword-card]"));
  });
});

describe("키워드 카드 — 마피아", () => {
  it("키워드 자리는 ??? 이고 접근성 이름은 '키워드는 알 수 없어요', 어떤 data- 속성 값에도 역할·키워드가 없다", () => {
    const { container, getByLabelText } = renderKeyword(makeView({ seat: 1, isHost: false, role: "mafia", allies: [] }));
    const word = container.querySelector("[data-keyword-word]")!;
    expect(word.textContent).toBe("???");
    expect(getByLabelText("키워드는 알 수 없어요")).toBe(word);
    expect(container.querySelector("[data-keyword-genre]")!.textContent).toBe("장르 : 영화");
    for (const el of container.querySelectorAll("*")) {
      for (const attr of Array.from(el.attributes)) {
        if (!attr.name.startsWith("data-")) continue;
        expect(attr.value).not.toMatch(/mafia|citizen|police|doctor|해리포터/);
      }
    }
  });
});
