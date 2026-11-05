import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { ClientMessage, RoomView } from "../../shared/protocol";
import type { WorldStageProps } from "../../src/components/WorldStage";
import { WorldStore } from "../../src/world/store";
import { GATHER_CENTER } from "../../src/world/camera";

// 쉬는 사람 전용 화면 (11-12, 결정 D-3·D-13): 어두운 정지 무대 + 자기 캐릭터 하나 + hourglass + 한 줄 + [나가기] 하나.
// WorldStage 는 받은 props 를 쥐는 가짜다(캔버스·런타임은 worldStage.test 몫).
const stage = vi.hoisted(() => ({ props: null as null | WorldStageProps }));
vi.mock("../../src/components/WorldStage", async () => {
  const { createElement } = await import("react");
  return {
    WorldStage: (props: WorldStageProps) => {
      stage.props = props;
      return createElement("div", { "data-world-stage-fake": "" });
    },
  };
});

const { BenchView } = await import("../../src/screens/BenchView");

const NOW = 1_700_000_000_000;

/** 쉬는 사람 본인에게만 오는 view: players 는 자기 한 줄, 마감 null */
function restingView(over: Partial<RoomView> = {}): RoomView {
  return {
    code: "0042",
    phase: "assigning",
    round: 2,
    phaseEndsAt: null,
    phaseDurationMs: null,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players: [{ seat: 5, nickname: "수빈", connected: true, isHost: false, look: "noir" }],
    me: { seat: 5, isHost: false },
    mapChoice: "random",
    map: "bar",
    resting: true,
    ...over,
  };
}

function setup(over: Partial<RoomView> = {}, o: { send?: (m: ClientMessage) => boolean | void; canSend?: boolean } = {}) {
  const store = new WorldStore();
  const send = vi.fn(o.send ?? (() => true));
  const onExit = vi.fn();
  const r = render(<BenchView view={restingView(over)} store={store} send={send} canSend={o.canSend ?? true} offset={0} epoch={1} onExit={onExit} />);
  return { ...r, store, send, onExit };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  stage.props = null;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const openLeave = (c: HTMLElement) => {
  fireEvent.click(screen.getByRole("button", { name: "나가기" }));
  return c.querySelector("dialog")!;
};
const confirmButton = (dialog: Element) => Array.from(dialog.querySelectorAll<HTMLButtonElement>("button")).find((b) => b.textContent === "나가기")!;

describe("BenchView: 쉬는 사람 화면 (D-3, D-13)", () => {
  it("data-bench-view 표식과 hourglass 아이콘, 보이는 글은 '이번 판은 쉬어요' 한 줄과 [나가기] 뿐이다", () => {
    const r = setup();
    expect(r.container.querySelector("[data-bench-view]")).not.toBeNull();
    expect(r.container.querySelector("[data-bench-icon] svg")).not.toBeNull();
    expect(screen.getByText("이번 판은 쉬어요")).not.toBeNull();
    const visible = Array.from(r.container.querySelectorAll("p, h1, h2, button")).map((e) => (e.textContent ?? "").trim()).filter(Boolean);
    expect(visible).toEqual(["이번 판은 쉬어요", "나가기"]);
  });

  it("타이머·단계 이름·인원 수·채팅 입력·동작·꾸미기·역할 카드가 하나도 없다", () => {
    const r = setup();
    for (const sel of [".mf-timer", "[data-chat-input]", "[data-emote-button]", "[data-float]", "[data-float-stack]", "[data-world-panel]", "[data-role-card-button]", ".mf-phasebar", "input", "[data-ready-pill]", "[data-result-panel]"]) {
      expect(r.container.querySelector(sel), sel).toBeNull();
    }
    expect(r.container.textContent).not.toMatch(/\d/); // 숫자(인원·시간)도 없다
  });

  it("무대는 방의 맵(view.map)·정지 카메라(모이는 자리 가운데)·밤 조명·걷기 막힘이고 좌석은 자기 하나뿐이다", () => {
    setup({ map: "plaza" });
    const p = stage.props!;
    expect(p.view.map).toBe("plaza");
    expect(p.canWalk).toBe(false);
    expect(p.scene?.camera).toEqual({ mode: "fixed", target: { x: GATHER_CENTER.x, z: GATHER_CENTER.z }, zoom: 1 });
    expect(p.scene?.lighting).toBe("night");
    expect(p.scene?.pin ?? null).toBeNull();
    expect(Object.keys(p.scene!.seats)).toEqual(["5"]);
    expect(p.scene!.seats[5]).toMatchObject({ show: true, ghost: false });
    expect(p.scene!.seats[5]).not.toHaveProperty("costume");
    expect(p.view.players.map((x) => x.seat)).toEqual([5]);
  });

  it("맵이 없는 view 는 재즈 바로 그린다 (view.map 키가 없다)", () => {
    const view = restingView();
    delete (view as { map?: unknown }).map;
    const store = new WorldStore();
    render(<BenchView view={view} store={store} send={vi.fn()} canSend offset={0} epoch={1} onExit={vi.fn()} />);
    expect(stage.props!.view.map ?? "bar").toBe("bar");
  });

  it("내 캐릭터는 스토어에 한 점으로 서 있다 (다른 좌석은 없다)", () => {
    const r = setup();
    expect(r.store.seats()).toEqual([5]);
    expect(r.store.positionOf(5, NOW)).not.toBeNull();
  });

  it("고른 의상(look)이 WorldStage 에 그대로 간다", () => {
    setup();
    expect(stage.props!.view.players[0]!.look).toBe("noir");
  });

  it("[나가기] → 확인 시트 '방에서 나갈까요?' → 확인하면 leave 를 보내고 onExit 한 번", () => {
    const r = setup();
    const dialog = openLeave(r.container);
    expect(dialog.querySelector("h2")?.textContent).toBe("방에서 나갈까요?");
    expect(r.send).not.toHaveBeenCalled();
    act(() => void fireEvent.click(confirmButton(dialog)));
    expect(r.send).toHaveBeenCalledWith({ t: "leave" });
    expect(r.onExit).toHaveBeenCalledTimes(1);
  });

  it("leave 가 닿지 않았으면(send false) 나가지 않고 알림을 띄운다", () => {
    const r = setup({}, { send: () => false });
    const dialog = openLeave(r.container);
    act(() => void fireEvent.click(confirmButton(dialog)));
    expect(r.onExit).not.toHaveBeenCalled();
    expect(r.container.querySelector(".mv-toast")?.textContent).toBe("연결이 불안정해요. 다시 시도해 주세요");
  });

  it("연결이 끊겨 있으면 확인 시트의 확인이 꺼진다", () => {
    setup({}, { canSend: false });
    expect((screen.getByRole("button", { name: "나가기" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("view.phase 가 낡아도(ended·night 등) 같은 화면이다 — 게임 필드를 읽지 않는다", () => {
    for (const phase of ["night", "ended", "discussion"] as const) {
      cleanup();
      const r = setup({ phase });
      expect(r.container.querySelector("[data-bench-view]"), phase).not.toBeNull();
    }
  });
});
