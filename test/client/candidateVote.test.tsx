import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CandidateVotePanel } from "../../src/components/CandidateVotePanel";
import { PickPill } from "../../src/components/NightPanel";

// 후보 선택(candidateVote) 화면 (04-18). Task 2: 하단 부품. Task 3 의 RoomScreen 시험은 아래 이어 쓴다.
afterEach(() => cleanup());

describe("PickPill format (D-19)", () => {
  it("기본(밤): 선택 안 함 / 선택 ●이름 — 기존 모양 그대로", () => {
    const { container, rerender } = render(<PickPill pick={null} />);
    expect(container.textContent).toBe("선택 안 함");
    rerender(<PickPill pick={{ seat: 2, label: "민지" }} />);
    expect(container.textContent).toBe("선택 민지");
  });

  it("vote: 선택 안 함(회색) / 자리 색 점 + 굵은 이름 + 님에게 투표했어요, role=status polite", () => {
    const { container, rerender } = render(<PickPill pick={null} format="vote" />);
    const empty = screen.getByRole("status");
    expect(empty.textContent).toBe("선택 안 함");
    expect(empty.classList.contains("mf-pk--empty")).toBe(true);
    rerender(<PickPill pick={{ seat: 2, label: "민지" }} format="vote" />);
    const pill = screen.getByRole("status");
    expect(pill.textContent).toBe("민지님에게 투표했어요");
    expect(pill.getAttribute("aria-live")).toBe("polite");
    expect(pill.querySelector("b")?.textContent).toBe("민지");
    expect(container.querySelector<HTMLElement>(".mf-pk__dot")?.style.background).toBe("var(--seat-3)");
    expect(pill.textContent).not.toContain("선택 ");
  });
});

describe("CandidateVotePanel (D-19, D-35, UI-SPEC 7.2)", () => {
  it("살아 있는 viewer: 제목·안내·알약 한 줄, 관전 줄과 말하기·이모티콘 입구 없음", () => {
    const { container } = render(<CandidateVotePanel pick={null} readOnly={false} />);
    expect(screen.getByRole("heading", { name: "처형할 사람을 고르세요" })).not.toBeNull();
    expect(container.textContent).toContain("자기 자신은 고를 수 없어요 · 마감까지 바꿀 수 있어요");
    expect(screen.getByRole("status").textContent).toBe("선택 안 함");
    expect(container.querySelector(".mf-ro")).toBeNull();
    expect(container.querySelectorAll("button").length).toBe(0);
  });

  it("고른 뒤: 알약이 {이름}님에게 투표했어요", () => {
    render(<CandidateVotePanel pick={{ seat: 1, label: "하윤" }} readOnly={false} />);
    expect(screen.getByRole("status").textContent).toBe("하윤님에게 투표했어요");
  });

  it("관전: 제목·안내가 관전 문구이고 알약 자리에 관전 줄, 선택 알약은 없다", () => {
    const { container } = render(<CandidateVotePanel pick={{ seat: 1, label: "하윤" }} readOnly />);
    expect(screen.getByRole("heading", { name: "처형할 사람을 고르는 중이에요" })).not.toBeNull();
    expect(container.textContent).toContain("누구를 골랐는지는 공개될 때 볼 수 있어요");
    expect(container.querySelector(".mf-ro")?.textContent).toBe("관전 중 · 볼 수만 있어요");
    expect(screen.queryByRole("status")).toBeNull();
    expect(container.textContent).not.toContain("하윤");
  });

  it("닉네임은 React 텍스트다(마크업 해석 없음)", () => {
    const { container } = render(<CandidateVotePanel pick={{ seat: 0, label: "<img src=x onerror=alert(1)>" }} readOnly={false} />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("<img src=x onerror=alert(1)>님에게 투표했어요");
  });
});
