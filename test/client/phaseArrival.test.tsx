import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PhaseId } from "../../shared/protocol";
import { usePhaseArrival } from "../../src/net/phaseArrival";

// usePhaseArrival(phase, epoch): 같은 접속(epoch)에서 단계가 바뀐 뒤에는 직전 단계를, 처음 렌더와 epoch 가 함께 바뀐 렌더에서는 null 을 돌려준다.
// 값은 다음 변화까지 유지된다. 역할 확인 → 낮 시작으로 DayScene 이 새로 마운트될 때 문구·크로스페이드의 근거다.

type Props = { phase: PhaseId | undefined; epoch: number };
const setup = (initial: Props) => renderHook((p: Props) => usePhaseArrival(p.phase, p.epoch), { initialProps: initial });

describe("usePhaseArrival", () => {
  it("처음 렌더는 null 이다", () => {
    expect(setup({ phase: "roleReveal", epoch: 1 }).result.current).toBeNull();
  });

  it("같은 epoch 에서 단계가 바뀌면 직전 단계를 돌려주고, 같은 단계로 다시 그려도 값을 유지한다", () => {
    const { result, rerender } = setup({ phase: "roleReveal", epoch: 1 });
    rerender({ phase: "dayAnnounce", epoch: 1 });
    expect(result.current).toBe("roleReveal");
    rerender({ phase: "dayAnnounce", epoch: 1 });
    expect(result.current).toBe("roleReveal");
  });

  it("다음 단계 변화가 오면 값이 그 직전 단계로 바뀐다", () => {
    const { result, rerender } = setup({ phase: "roleReveal", epoch: 1 });
    rerender({ phase: "dayAnnounce", epoch: 1 });
    rerender({ phase: "claim", epoch: 1 });
    expect(result.current).toBe("dayAnnounce");
  });

  it("단계와 epoch 가 함께 바뀐 렌더(재접속)는 null 이고, 이후 같은 epoch 의 변화부터 다시 직전 단계다", () => {
    const { result, rerender } = setup({ phase: "roleReveal", epoch: 1 });
    rerender({ phase: "dayAnnounce", epoch: 2 });
    expect(result.current).toBeNull();
    rerender({ phase: "dayAnnounce", epoch: 2 });
    expect(result.current).toBeNull();
    rerender({ phase: "claim", epoch: 2 });
    expect(result.current).toBe("dayAnnounce");
  });

  it("epoch 만 바뀌고 단계는 같으면 null 로 돌아간다 (재접속 뒤에는 옛 도착을 되풀이하지 않는다)", () => {
    const { result, rerender } = setup({ phase: "roleReveal", epoch: 1 });
    rerender({ phase: "dayAnnounce", epoch: 1 });
    expect(result.current).toBe("roleReveal");
    rerender({ phase: "dayAnnounce", epoch: 2 });
    expect(result.current).toBeNull();
  });

  it("view 가 아직 없어 단계가 undefined 이다가 첫 state(epoch 증가)로 단계가 생기면 null 이다", () => {
    const { result, rerender } = setup({ phase: undefined, epoch: 0 });
    expect(result.current).toBeNull();
    rerender({ phase: "lobby", epoch: 1 });
    expect(result.current).toBeNull();
    rerender({ phase: "assigning", epoch: 1 });
    expect(result.current).toBe("lobby");
  });

  it("렌더 중 상태 조정이라 effect 를 기다리지 않는다 (바뀐 렌더가 곧바로 직전 단계를 본다)", () => {
    const seen: Array<PhaseId | null> = [];
    const { rerender } = renderHook(
      (p: Props) => {
        const from = usePhaseArrival(p.phase, p.epoch);
        seen.push(from);
        return from;
      },
      { initialProps: { phase: "roleReveal", epoch: 1 } as Props },
    );
    act(() => rerender({ phase: "dayAnnounce", epoch: 1 }));
    expect(seen.at(-1)).toBe("roleReveal");
  });
});
