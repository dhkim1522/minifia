// 이동 권한 표(MAP-04, 결정 0060-6, A4): 단계 × 신분(산 사람·유령)을 전수로 고정한다.
// 서버가 막고(권위), 화면은 같은 표로 입력 면만 비활성한다. 비교는 한 줄 문자열로 한다 — Set·배열의 여러 줄 diff 는 TAP 보고서를 깨뜨린다.
import { describe, expect, it } from "vitest";
import { MAP_PHASES, canMove, canMoveIn } from "../../shared/game/movement";
import { createRoomState } from "../../shared/game/room";
import type { Player, RoomState } from "../../shared/game/room";
import type { PhaseId } from "../../shared/protocol";

const BASE: RoomState = (() => {
  const created = createRoomState({
    code: "0420",
    hostId: "player-id-0000-aaaa",
    hostToken: "token-secret-0000-aaaa-0123456789",
    hostNickname: "이름0",
    now: 0,
  });
  if (!created.ok) throw new Error("createRoomState failed");
  return created.state;
})();

const withPhase = (phase: PhaseId): RoomState => ({ ...BASE, phase });
const living: Player = BASE.players[0]!;
const ghost: Player = { ...BASE.players[0]!, alive: false };

/** 단계 12종 × {산 사람, 유령}: [단계, 산 사람이 움직일 수 있나, 유령이 움직일 수 있나] */
const TABLE: [PhaseId, boolean, boolean][] = [
  ["lobby", true, true],
  ["assigning", false, false],
  ["roleReveal", false, false],
  ["dayAnnounce", true, true],
  ["discussion", true, true],
  ["nomination", false, true],
  ["defense", false, true],
  ["verdict", false, true],
  ["execution", false, true],
  ["night", false, true],
  ["morning", false, true],
  ["ended", false, false],
];

describe("canMove — 단계 × 신분 표 (MAP-04)", () => {
  it.each(TABLE)("%s: 산 사람 %s · 유령 %s", (phase, aliveCan, ghostCan) => {
    const s = withPhase(phase);
    expect(`${phase}:alive:${canMove(s, living)}`).toBe(`${phase}:alive:${aliveCan}`);
    expect(`${phase}:ghost:${canMove(s, ghost)}`).toBe(`${phase}:ghost:${ghostCan}`);
  });

  it("표가 PhaseId 12종을 모두 덮는다", () => {
    expect(TABLE.map(([phase]) => phase).sort().join(",")).toBe(
      [
        "lobby", "assigning", "roleReveal", "dayAnnounce", "discussion",
        "defense", "execution", "night", "morning", "ended", "nomination", "verdict",
      ].sort().join(","),
    );
  });

  it("canMove 는 canMoveIn(단계, 생존) 과 같은 표다 — 화면은 view 의 단계와 내 alive 로 같은 표를 쓴다", () => {
    for (const [phase] of TABLE) {
      expect(canMove(withPhase(phase), living)).toBe(canMoveIn(phase, true));
      expect(canMove(withPhase(phase), ghost)).toBe(canMoveIn(phase, false));
    }
  });

  it("방에 없는 플레이어 객체도 단계 규칙만 본다(alive 없음 = 산 사람)", () => {
    const stranger: Player = { ...living, id: "nobody-in-this-room", seat: 99 };
    expect(canMove(withPhase("discussion"), stranger)).toBe(true);
    expect(canMove(withPhase("nomination"), stranger)).toBe(false);
    expect(canMove(withPhase("nomination"), { ...stranger, alive: false })).toBe(true);
  });
});

describe("canMoveIn — 밤에는 산 사람 누구도 걷지 못한다 (15페이즈 D-05)", () => {
  it("밤: 산 사람 false · 유령 true (인자는 단계·생존 둘뿐)", () => {
    expect(canMoveIn.length).toBe(2);
    expect(`night:${canMoveIn("night", true)}`).toBe("night:false");
    expect(`night:${canMoveIn("night", false)}`).toBe("night:true");
  });

  it("밤 밖의 단계 표는 그대로다(회귀)", () => {
    for (const [phase, aliveCan, ghostCan] of TABLE) {
      if (phase === "night") continue;
      expect(`${phase}:${canMoveIn(phase, true)}`).toBe(`${phase}:${aliveCan}`);
      expect(`${phase}:${canMoveIn(phase, false)}`).toBe(`${phase}:${ghostCan}`);
    }
    expect(`morning:${canMoveIn("morning", true)}`).toBe("morning:false");
    expect(`discussion:${canMoveIn("discussion", true)}`).toBe("discussion:true");
  });

  it("canMove 는 밤에 어떤 역할의 산 사람도 허용하지 않고 유령만 허용한다", () => {
    const night = withPhase("night");
    for (const role of ["mafia", "citizen", "police", "doctor"] as const) {
      expect(`${role}:${canMove(night, { ...living, role })}`).toBe(`${role}:false`);
    }
    expect(`deadMafia:${canMove(night, { ...ghost, role: "mafia" })}`).toBe("deadMafia:true");
    expect(`deadCitizen:${canMove(night, { ...ghost, role: "citizen" })}`).toBe("deadCitizen:true");
  });
});

describe("MAP_PHASES — 지도 단계 11개", () => {
  it("낮 시작·심부름(15페이즈)·토론·지목·동점 결선·마지막 3인 결전·변론·찬반·처형·밤·아침이고 로비·역할 단계·종료·옛 투표 단계는 들지 않는다", () => {
    expect([...MAP_PHASES].sort().join(",")).toBe(
      ["dayAnnounce", "errand", "discussion", "nomination", "runoff", "showdown", "defense", "verdict", "execution", "night", "morning"].sort().join(","),
    );
  });
});
