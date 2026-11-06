// feedback-3: 역할 확인 배경 v2.0, 승인 보드 Role.dc.html — 역할 배정·역할 확인 뒤에 v1 배경 그림이 아니라 3D 재즈 바 무대가 깔린다.
// 무대에는 공개 정보(이름표)만 간다: scene·tagProps·pick·onKick 을 넘기지 않아 직업 칩·고리가 생기지 않는다(결정 0021, T-09-55).
import { readFileSync } from "node:fs";
import { cleanup, render } from "@testing-library/react";
import { useEffect } from "react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PhaseId, RoomView } from "../../shared/protocol";
import type { RoomConnection } from "../../src/net/useRoomConnection";
import type { WorldStageProps } from "../../src/components/WorldStage";

const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => connectionMock.current,
}));

// 마운트 횟수를 세는 가짜 무대: 마지막 props 와 마운트 수를 기억한다.
const probe = vi.hoisted(() => ({ props: null as unknown, mounts: 0 }));
vi.mock("../../src/components/WorldStage", async () => {
  const { createElement } = await import("react");
  return {
    WorldStage: (props: WorldStageProps): ReactElement => {
      probe.props = props;
      useEffect(() => {
        probe.mounts += 1;
      }, []);
      return createElement("div", { "data-world-stage-fake": "" });
    },
  };
});

const { RoomScreen } = await import("../../src/screens/RoomScreen");
const { PreGame } = await import("../../src/screens/PreGame");
const { RoleReveal } = await import("../../src/screens/RoleReveal");
const { Assigning } = await import("../../src/screens/Assigning");
const { WorldStore } = await import("../../src/world/store");

const NOW = 1_700_000_000_000;

function makeView(phase: PhaseId): RoomView {
  return {
    code: "0042",
    phase,
    phaseEndsAt: NOW + 15_000,
    phaseDurationMs: 15_000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players: [
      { seat: 0, nickname: "지우", connected: true, isHost: true },
      { seat: 1, nickname: "하윤", connected: true, isHost: false },
      { seat: 2, nickname: "민지", connected: true, isHost: false },
      { seat: 3, nickname: "도현", connected: true, isHost: false },
    ],
    me: { seat: 0, isHost: true, role: "citizen" },
  };
}

function conn(view: RoomView): RoomConnection {
  return {
    status: "open",
    banner: "hidden",
    view,
    offset: 0,
    epoch: 1,
    removedReason: null,
    canSend: true,
    send: vi.fn(),
    onEvent: vi.fn(() => () => {}),
    reconnect: vi.fn(),
    retry: vi.fn(),
  };
}

beforeEach(() => {
  probe.props = null;
  probe.mounts = 0;
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function stageProps(): WorldStageProps {
  expect(probe.props, "WorldStage props").not.toBeNull();
  return probe.props as WorldStageProps;
}

describe("PreGame 무대 틀", () => {
  it("무대 상자는 aria-hidden 이고 그 안에 WorldStage 가 있으며 걷기·장면 상태·지목이 없다", () => {
    const view = makeView("roleReveal");
    const { container } = render(
      <PreGame view={view} store={new WorldStore()} send={vi.fn()} canSend offset={0} onLeave={vi.fn()}>
        <p>안쪽</p>
      </PreGame>,
    );
    const stage = container.querySelector(".mf-pregame__stage");
    expect(stage, "무대 상자").not.toBeNull();
    expect(stage!.getAttribute("aria-hidden")).toBe("true");
    expect(stage!.querySelector("[data-world-stage-fake]")).not.toBeNull();
    const p = stageProps();
    expect(p.canWalk).toBe(false);
    expect(p.canSend).toBe(false);
    expect(p.scene).toBeUndefined();
    expect(p.tagProps).toBeUndefined();
    expect(p.pick).toBeUndefined();
    expect(p.onKick).toBeUndefined();
    expect(container.querySelector(".mf-pregame__content")?.textContent).toBe("안쪽");
  });

  it("역할 확인·역할 배정을 안에 넣어도 v1 배경(.mf-backdrop)과 /backgrounds/ 그림 주소가 없고 역할 표식도 없다", () => {
    for (const phase of ["roleReveal", "assigning"] as const) {
      const view = makeView(phase);
      const { container, unmount } = render(
        <PreGame view={view} store={new WorldStore()} send={vi.fn()} canSend offset={0} onLeave={vi.fn()}>
          {phase === "roleReveal" ? (
            <RoleReveal view={view} offset={0} myRoleButton={<button type="button">역할 카드</button>} onSeenFront={vi.fn()} />
          ) : (
            <Assigning view={view} />
          )}
        </PreGame>,
      );
      expect(container.querySelector(".mf-backdrop"), phase).toBeNull();
      expect(container.innerHTML.includes("/backgrounds/"), phase).toBe(false);
      expect(container.querySelectorAll("[data-role-chip]").length, phase).toBe(0);
      expect(container.querySelectorAll("[data-ring-kind]").length, phase).toBe(0);
      unmount();
    }
  });

  it("역할 확인의 어두운 막·카드·[역할 카드] 버튼은 그대로 있고 옛 타이머는 없다(14-05)", () => {
    const view = makeView("roleReveal");
    const { container } = render(
      <PreGame view={view} store={new WorldStore()} send={vi.fn()} canSend offset={0} onLeave={vi.fn()}>
        <RoleReveal view={view} offset={0} myRoleButton={<button type="button">역할 카드</button>} onSeenFront={vi.fn()} />
      </PreGame>,
    );
    expect(container.querySelector(".mf-reveal__dim")).not.toBeNull();
    expect(container.querySelector(".mf-card")).not.toBeNull();
    expect(container.querySelector('[role="timer"]')).toBeNull();
    expect(container.querySelector(".mf-reveal__header .mv-phase__title")?.textContent).toBe("역할 확인");
    expect(container.textContent).toContain("역할 카드");
  });
});

describe("RoomScreen: 배정 → 확인 사이에 무대가 다시 만들어지지 않는다", () => {
  it("assigning 에서 roleReveal 로 넘어가도 WorldStage 는 한 번만 마운트된다", () => {
    connectionMock.current = conn(makeView("assigning"));
    const { container, rerender } = render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
    expect(container.querySelector("main.mf-assign")).not.toBeNull();
    expect(probe.mounts).toBe(1);
    connectionMock.current = conn(makeView("roleReveal"));
    rerender(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
    expect(container.querySelector("main.mf-reveal")).not.toBeNull();
    expect(container.querySelector("main.mf-assign")).toBeNull();
    expect(probe.mounts).toBe(1);
    expect(container.querySelector(".mf-backdrop")).toBeNull();
    expect(container.querySelectorAll("[data-role-chip]").length).toBe(0);
  });

  it("장면 키 preGame 하나를 assigning·roleReveal 이 쓴다", () => {
    const src = readFileSync("src/screens/RoomScreen.tsx", "utf8");
    expect(src).toMatch(/case "assigning":\s*case "roleReveal":\s*return "preGame"/);
  });
});
