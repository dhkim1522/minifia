import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RoomView } from "../../shared/protocol";
import { useViewChoice } from "../../src/net/useViewChoice";

// 낙관적 선택 훅(04-18): 값은 view 객체 동일성에 묶인다. 새 view 객체가 오면 서버 값으로 돌아온다.
const viewOf = (): RoomView => ({ code: "0042", phase: "candidateVote" }) as unknown as RoomView;

describe("useViewChoice", () => {
  it("고른 적 없으면 서버 값, choose 뒤에는 같은 view 인 동안 고른 값", () => {
    const v1 = viewOf();
    const { result } = renderHook(({ view, server }) => useViewChoice(view, server), { initialProps: { view: v1, server: undefined as number | undefined } });
    expect(result.current[0]).toBeUndefined();
    act(() => result.current[1](2));
    expect(result.current[0]).toBe(2);
  });

  it("다른 view 객체가 오면 다시 서버 값(서버가 거절해 state 를 다시 보낸 경우)", () => {
    const v1 = viewOf();
    const { result, rerender } = renderHook(({ view, server }) => useViewChoice(view, server), { initialProps: { view: v1, server: 1 as number | undefined } });
    expect(result.current[0]).toBe(1);
    act(() => result.current[1](3));
    expect(result.current[0]).toBe(3);
    rerender({ view: v1, server: 1 });
    expect(result.current[0]).toBe(3);
    rerender({ view: viewOf(), server: 1 });
    expect(result.current[0]).toBe(1);
  });
});
