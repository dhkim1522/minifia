import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { PublicPlayer, RoomView } from "../../shared/protocol";
import { restSegment } from "../../shared/game/world";
import type { WorldStageProps } from "../../src/components/WorldStage";

// 24-03 D-24: 귓속말 모드와 [의심] 모드는 동시에 켜지지 않는다. 기본판은 RULES.whisper 가 꺼져 있어(결정 0072) 귓속말 단추가 없으므로, 이 파일만 규칙을 켠 채 본다.
vi.mock("../../shared/game/ruleset", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../shared/game/ruleset")>();
  return { ...actual, RULES: Object.freeze({ ...actual.RULES, whisper: true }) };
});

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

const { GameMap } = await import("../../src/screens/GameMap");
const { WorldStore } = await import("../../src/world/store");
const { ChatStore } = await import("../../src/net/chatStore");

const NOW = 1_700_000_000_000;
const NAMES = ["민수", "영희", "서준", "지아"];

function makeView(): RoomView {
  const players: PublicPlayer[] = NAMES.map((nickname, seat) => ({ seat, nickname, connected: true, isHost: seat === 0 }));
  return {
    code: "0042",
    phase: "discussion",
    phaseEndsAt: NOW + 90_000,
    phaseDurationMs: 90_000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players,
    me: { seat: 0, isHost: true, chat: "all" },
    day: { n: 2, roles: [] },
  } as RoomView;
}

afterEach(() => {
  cleanup();
  stage.props = null;
});

const mountMap = () => {
  const store = new WorldStore();
  store.applyFrame({ t: "world", k: "snap", at: NOW, ents: [0, 1, 2, 3].map((s) => ({ s, p: [...restSegment(s * 50, 0, NOW).p], t0: NOW, v: 0 })) }, 1);
  return render(<GameMap view={makeView()} store={store} chat={new ChatStore()} send={() => true} tod={false} />);
};
const suspectBtn = (c: ParentNode): HTMLButtonElement => c.querySelector<HTMLButtonElement>("[data-suspect-btn]")!;
const whisperBtn = (c: ParentNode): HTMLButtonElement => c.querySelector<HTMLButtonElement>('[data-float="whisper"]')!;
const suspectModeAttr = (c: ParentNode): string | null => c.querySelector("[data-game-stage]")!.getAttribute("data-suspect-mode");

describe("의심 모드와 귓속말 모드의 배타 (D-24)", () => {
  it("[의심] 을 켠 채 귓속말을 켜면 의심 모드가 꺼지고 귓속말 이름표가 선다", () => {
    const { container } = mountMap();
    fireEvent.click(suspectBtn(container));
    expect(suspectModeAttr(container)).toBe("on");
    expect(stage.props!.pick!.group).toBe("의심!");
    fireEvent.click(whisperBtn(container));
    expect(suspectModeAttr(container)).toBe("off");
    expect(stage.props!.pick!.group).toBe("귓속말");
  });
  it("귓속말을 켠 채 [의심] 을 켜면 귓속말 모드가 꺼지고 의심 이름표가 선다", () => {
    const { container } = mountMap();
    fireEvent.click(whisperBtn(container));
    expect(stage.props!.pick!.group).toBe("귓속말");
    fireEvent.click(suspectBtn(container));
    expect(suspectModeAttr(container)).toBe("on");
    expect(stage.props!.pick!.group).toBe("의심!");
    expect(whisperBtn(container).getAttribute("aria-pressed")).toBe("false");
  });
});
