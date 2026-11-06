// 12-07: 소리 단추 — 세 상태·알약 8초 접힘·토글 저장·표식 (B-1, B-2, D-5, D-6, T-12-23).
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SOUND_PREF_KEY } from "../../src/audio/prefs";
import { useSound } from "../../src/audio/useSound";
import { SoundButton } from "../../src/components/v2/SoundButton";
import { setEngineForTest } from "../../src/audio/unlock";
import type { RoomView } from "../../shared/protocol";
import type { RoomConnection } from "../../src/net/useRoomConnection";
import { MemoryStorage } from "../helpers/memoryStorage";
import { makeRig, type Rig } from "../helpers/soundRig";

// 방 화면 시험용: 연결 훅과 월드 캔버스는 가짜(roomScreen.test.tsx 와 같은 모양)
const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({ useRoomConnection: () => connectionMock.current }));
vi.mock("../../src/components/WorldStage", async () => {
  const { createElement } = await import("react");
  return { WorldStage: () => createElement("div", { "data-world-stage-fake": "" }) };
});
const { RoomScreen } = await import("../../src/screens/RoomScreen");

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  setEngineForTest(null);
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function Harness({ rig }: { rig: Rig }) {
  const sound = useSound({ engine: rig.engine });
  return sound.supported ? <SoundButton sound={sound} /> : null;
}

function mount(opts: { on?: boolean; unlocked?: boolean } = {}): Rig {
  const storage = new MemoryStorage();
  if (opts.on === false) storage.setItem(SOUND_PREF_KEY, JSON.stringify({ v: 1, on: false }));
  const rig: Rig = { ...makeRig({ storage }), storage }; // 엔진이 쓰는 저장소를 시험이 들여다본다
  if (opts.unlocked) rig.engine.unlock();
  render(<Harness rig={rig} />);
  return rig;
}

const button = () => document.querySelector("[data-sound-button]") as HTMLButtonElement;

describe("SoundButton 세 상태 (B-1, B-2)", () => {
  it("on: sound 아이콘, 이름 '소리 끄기', aria-pressed 참, 글자 없음", () => {
    mount({ unlocked: true });
    expect(document.querySelectorAll("[data-sound-button]")).toHaveLength(1);
    const b = button();
    expect(b.getAttribute("data-sound-state")).toBe("on");
    expect(b.getAttribute("aria-label")).toBe("소리 끄기");
    expect(b.getAttribute("aria-pressed")).toBe("true");
    expect(b.querySelector("svg")).not.toBeNull();
    expect(b.textContent).toBe("");
    expect(screen.getByRole("button", { name: "소리 끄기" })).toBe(b);
  });

  it("off: 이름 '소리 켜기', aria-pressed 거짓, 글자 없음 — 알약을 권하지 않는다", () => {
    mount({ on: false });
    const b = button();
    expect(b.getAttribute("data-sound-state")).toBe("off");
    expect(b.getAttribute("aria-label")).toBe("소리 켜기");
    expect(b.getAttribute("aria-pressed")).toBe("false");
    expect(b.textContent).toBe("");
    act(() => void vi.advanceTimersByTime(20000));
    expect(b.textContent).toBe("");
  });

  it("locked: 알약 — 글 '소리 켜기', 이름 '소리 켜기', aria-pressed 거짓", () => {
    mount();
    const b = button();
    expect(b.getAttribute("data-sound-state")).toBe("locked");
    expect(b.getAttribute("aria-label")).toBe("소리 켜기");
    expect(b.getAttribute("aria-pressed")).toBe("false");
    expect(b.textContent).toBe("소리 켜기");
    expect(b.classList.contains("mv-sound--pill")).toBe(true);
  });

  it("알약은 8초 뒤 아이콘 단추로 접힌다. 접힌 뒤에도 locked 이고 눌러서 켠다", () => {
    const rig = mount();
    act(() => void vi.advanceTimersByTime(7999));
    expect(button().textContent).toBe("소리 켜기");
    act(() => void vi.advanceTimersByTime(1));
    const b = button();
    expect(b.textContent).toBe("");
    expect(b.classList.contains("mv-sound--pill")).toBe(false);
    expect(b.getAttribute("data-sound-state")).toBe("locked");
    expect(b.getAttribute("aria-label")).toBe("소리 켜기");
    fireEvent.click(b);
    expect(rig.engine.state()).toBe("running");
    expect(button().getAttribute("data-sound-state")).toBe("on");
  });

  it("다시 locked 가 되면 알약이 다시 보이고 8초를 새로 센다", () => {
    const rig = mount({ unlocked: true });
    act(() => rig.fake.ctx().setState("interrupted"));
    expect(button().textContent).toBe("소리 켜기");
    act(() => void vi.advanceTimersByTime(8000));
    expect(button().textContent).toBe("");
    act(() => rig.fake.ctx().setState("running"));
    expect(button().getAttribute("data-sound-state")).toBe("on");
    act(() => rig.fake.ctx().setState("interrupted"));
    expect(button().textContent).toBe("소리 켜기");
    act(() => void vi.advanceTimersByTime(7999));
    expect(button().textContent).toBe("소리 켜기");
    act(() => void vi.advanceTimersByTime(1));
    expect(button().textContent).toBe("");
  });

  it("AudioContext 를 만들 수 없는 환경이면 DOM 에 없다", () => {
    const rig = makeRig({ createContext: undefined });
    render(<Harness rig={rig} />);
    expect(document.querySelector("[data-sound-button]")).toBeNull();
  });

  it("표식은 data-sound-button·data-sound-state 뿐이다 (역할·좌석 값 없음, T-12-23)", () => {
    mount({ unlocked: true });
    const names = button().getAttributeNames().filter((n) => n.startsWith("data-")).sort();
    expect(names).toEqual(["data-sound-button", "data-sound-state"]);
    expect(button().getAttribute("role")).toBeNull();
    expect(button().outerHTML).not.toMatch(/role|seat|mafia|nonce/i);
  });
});

describe("SoundButton 누르기 (D-5, D-6)", () => {
  it("on 을 누르면 즉시 끄고 저장한다 — ui.toggle(끔 변형)이 먼저 played 참, 그 뒤 요청은 played 거짓", () => {
    const rig = mount({ unlocked: true });
    rig.engine.clearLog();
    const ctx = rig.fake.ctx();
    const before = ctx.sources().length;
    fireEvent.click(button());
    expect(rig.engine.isOn()).toBe(false);
    expect(rig.storage.getItem(SOUND_PREF_KEY)).toBe(JSON.stringify({ v: 1, on: false }));
    expect(rig.engine.log()).toMatchObject([{ id: "ui.toggle", played: true }]);
    const toggle = ctx.sources().slice(before)[0]!;
    expect(toggle.frequency.of("exp")[0]!.value).toBe(330); // 끔 변형은 440 → 330
    rig.engine.play("ui.tap");
    expect(rig.engine.log().at(-1)).toMatchObject({ id: "ui.tap", played: false });
    const b = button();
    expect(b.getAttribute("data-sound-state")).toBe("off");
    expect(b.getAttribute("aria-label")).toBe("소리 켜기");
    expect(b.getAttribute("aria-pressed")).toBe("false");
  });

  it("off 를 누르면 켜고 저장한다 — 클릭 안에서 동기로 깨우고 ui.toggle(켬 변형)", () => {
    const rig = mount({ on: false, unlocked: false });
    const unlock = vi.spyOn(rig.engine, "unlock");
    fireEvent.click(button());
    expect(unlock).toHaveBeenCalledTimes(1);
    expect(rig.engine.isOn()).toBe(true);
    expect(rig.storage.getItem(SOUND_PREF_KEY)).toBe(JSON.stringify({ v: 1, on: true }));
    expect(rig.engine.log().filter((e) => e.id === "ui.toggle" && e.played)).toHaveLength(1);
    expect(button().getAttribute("data-sound-state")).toBe("on");
    expect(button().getAttribute("aria-label")).toBe("소리 끄기");
  });

  it("locked 를 누르면 깨운다 (저장값은 그대로 켜짐)", () => {
    const rig = mount();
    const unlock = vi.spyOn(rig.engine, "unlock");
    fireEvent.click(button());
    expect(unlock).toHaveBeenCalledTimes(1);
    expect(rig.engine.state()).toBe("running");
    expect(button().getAttribute("data-sound-state")).toBe("on");
  });

  it("키보드(Enter)로도 눌린다 — 기본 button 이라 click 으로 온다", () => {
    mount({ unlocked: true });
    expect(button().tagName).toBe("BUTTON");
    expect(button().getAttribute("type")).toBe("button");
  });
});

// 단추·잠금 해제 외의 곳은 소리를 고르지 않는다 (prohibition)
const ROOT = `${process.cwd()}/`;
function listSrc(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = `${dir}/${name}`;
    if (statSync(full).isDirectory()) out.push(...listSrc(full));
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

describe("소리 호출 자리 (prohibition)", () => {
  const files = listSrc(`${ROOT}src/components`).concat(listSrc(`${ROOT}src/screens`));
  it("컴포넌트·화면에서 엔진의 play·setBed·runScript·duckBed 를 부르는 곳이 없다 (단추·잠금 해제는 setOn·unlock 만 쓴다)", () => {
    const hits = files.filter((f) => /\.(play|setBed|runScript|duckBed)\(/.test(readFileSync(f, "utf8").replace(/\/\/.*$/gm, "")));
    expect(hits).toEqual([]);
  });

  it("touchstart·pointerdown 으로 오디오를 깨우지 않고 HTMLAudio 무음 루프 트릭도 없다", () => {
    const audio = listSrc(`${ROOT}src/audio`).concat([`${ROOT}src/components/v2/SoundButton.tsx`]);
    for (const f of audio) {
      const code = readFileSync(f, "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
      expect(code, f).not.toMatch(/touchstart|pointerdown|new Audio\(|HTMLAudioElement|<audio/);
    }
  });

  it("소리 설정은 서버로 가지 않는다: 소리 파일에 send·fetch·WebSocket 이 없다", () => {
    const audio = listSrc(`${ROOT}src/audio`).concat([`${ROOT}src/components/v2/SoundButton.tsx`]);
    for (const f of audio) {
      const code = readFileSync(f, "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
      expect(code, f).not.toMatch(/\bfetch\(|WebSocket|\.send\(|sendBeacon/);
    }
  });
});

const lobbyView: RoomView = {
  code: "0042",
  phase: "lobby",
  phaseEndsAt: null,
  phaseDurationMs: null,
  serverNow: 1000,
  minPlayers: 4,
  maxPlayers: 8,
  players: [{ seat: 0, nickname: "민수", connected: true, isHost: true }],
  me: { seat: 0, isHost: true },
};

function conn(over: Partial<RoomConnection>): RoomConnection {
  return {
    status: "open",
    banner: "hidden",
    view: lobbyView,
    offset: 0,
    epoch: 1,
    removedReason: null,
    canSend: true,
    send: vi.fn(),
    onEvent: vi.fn(() => () => {}),
    reconnect: vi.fn(),
    retry: vi.fn(),
    ...over,
  };
}

describe("RoomScreen 에 소리 단추가 한 번 그려진다 (D-4, B-1, B-3)", () => {
  it("view 가 있으면 [data-sound-button] 이 정확히 하나, 엔진이 running 이면 on·'소리 끄기'·aria-pressed 참", () => {
    const rig = makeRig();
    rig.engine.unlock();
    setEngineForTest(rig.engine);
    connectionMock.current = conn({});
    render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
    const all = document.querySelectorAll("[data-sound-button]");
    expect(all).toHaveLength(1);
    expect(all[0]!.getAttribute("data-sound-state")).toBe("on");
    expect(all[0]!.getAttribute("aria-label")).toBe("소리 끄기");
    expect(all[0]!.getAttribute("aria-pressed")).toBe("true");
    expect(all[0]!.closest(".mf-room")).not.toBeNull();
  });

  it("view 가 없는 연결 중 화면에는 없다", () => {
    const rig = makeRig();
    setEngineForTest(rig.engine);
    connectionMock.current = conn({ status: "connecting", view: null, canSend: false });
    render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
    expect(document.querySelector("[data-sound-button]")).toBeNull();
  });

  it("지원되지 않는 환경(AudioContext 없음)이면 DOM 에 없다", () => {
    const rig = makeRig({ createContext: undefined });
    setEngineForTest(rig.engine);
    connectionMock.current = conn({});
    render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
    expect(document.querySelector("[data-sound-button]")).toBeNull();
  });

  it("재접속 띠가 떠 있어도 단추는 한 번만 그려진다 (띠 위 층은 CSS)", () => {
    const rig = makeRig();
    setEngineForTest(rig.engine);
    connectionMock.current = conn({ status: "reconnecting", banner: "reconnecting", canSend: false });
    render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
    expect(document.querySelectorAll("[data-sound-button]")).toHaveLength(1);
    expect(document.querySelector(".mf-reconnect")).not.toBeNull();
  });

  it("방을 떠나면(언마운트) 엔진의 침대·대본을 멈춘다", () => {
    const rig = makeRig();
    setEngineForTest(rig.engine);
    const stop = vi.spyOn(rig.engine, "stopAll");
    connectionMock.current = conn({});
    const { unmount } = render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
    unmount();
    expect(stop).toHaveBeenCalled();
  });
});
