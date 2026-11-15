// 21-11 의심 보드 순수 파생(D-18~D-20, UI-SPEC P21-14·P21-18): boardOf 는 내가 받은 단서·공개 등불·산 사람·내 목격 기록에서만 값을 만들고 역할을 읽지 않는다.
// 실패 출력은 한 줄이어야 해서(TAP) 목록은 쉼표로 이은 문자열로 비교한다.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ClueLine, OutfitId, PublicPlayer, RecordLine, RoleId, RoomView } from "../../shared/protocol";
import { boardOf } from "../../src/game/boardView";

const LOOKS: Record<number, OutfitId> = { 0: "coat", 1: "mafia", 2: "doctor", 3: "mafia", 4: "police", 5: "hood" };

function viewOf(o: { role?: RoleId; scene?: ClueLine[]; record?: RecordLine[]; lamps?: boolean[]; dead?: number[]; executed?: number } = {}): RoomView {
  const players: PublicPlayer[] = [0, 1, 2, 3, 4, 5].map((seat) => ({
    seat,
    nickname: `닉${seat}`,
    connected: true,
    isHost: seat === 0,
    look: LOOKS[seat]!,
    ...(o.dead?.includes(seat) ? { alive: false } : {}),
  }));
  const me: Record<string, unknown> = {
    seat: 0,
    isHost: true,
    ...(o.role === undefined ? {} : { role: o.role }),
    ...(o.scene === undefined ? {} : { scene: o.scene }),
    ...(o.record === undefined ? {} : { record: o.record }),
  };
  const day: Record<string, unknown> = { n: 1, roles: [], ...(o.lamps === undefined ? {} : { lamps: o.lamps }), ...(o.executed === undefined ? {} : { execution: { seat: o.executed } }) };
  return { code: "0042", phase: "discussion", phaseEndsAt: null, phaseDurationMs: null, serverNow: 0, minPlayers: 4, maxPlayers: 8, players, me, day, map: "town", mode: "extended" } as unknown as RoomView;
}

const SCENE: ClueLine[] = [
  { spot: "cloth", r: "clue", piece: "blackCloth" },
  { spot: "window", r: "dark" },
  { spot: "footprint", r: "touched" },
];

describe("boardOf 칩 (내가 받은 단서만)", () => {
  it("me.scene 의 clue·dark·touched 줄이 살핀 순서대로 칩 셋이 된다", () => {
    const b = boardOf(viewOf({ scene: SCENE }));
    expect(b.chips.map((c) => `${c.spot}:${c.kind}`).join(",")).toBe("cloth:clue,window:dark,footprint:touched");
    expect(b.chips[0]!.piece).toBe("blackCloth");
  });

  it("none 줄은 칩이 없다(찾은 것이 없다), 발자국 수는 n 으로 온다", () => {
    const b = boardOf(viewOf({ scene: [{ spot: "footprint", r: "clue", n: 3 }, { spot: "cloth", r: "none" }] }));
    expect(b.chips.map((c) => `${c.spot}:${c.kind}:${c.n ?? "-"}`).join(",")).toBe("footprint:clue:3");
  });

  it("me.scene 이 없으면 칩 0", () => {
    expect(boardOf(viewOf()).chips).toHaveLength(0);
  });
});

describe("boardOf 등불 줄·얼굴 줄", () => {
  it("day.lamps 의 false 셋 → lamps 8개·offCount 3", () => {
    const b = boardOf(viewOf({ lamps: [true, false, true, false, true, true, false, true] }));
    expect(b.lamps).toHaveLength(8);
    expect(b.offCount).toBe(3);
  });

  it("day.lamps 가 없으면 lamps 는 빈 배열·offCount 0", () => {
    const b = boardOf(viewOf());
    expect(b.lamps).toHaveLength(0);
    expect(b.offCount).toBe(0);
  });

  it("얼굴은 산 사람 전원(나 포함)을 좌석 오름차순으로, 유령은 넣지 않는다", () => {
    const b = boardOf(viewOf({ dead: [2, 4] }));
    expect(b.faces.map((f) => f.seat).join(",")).toBe("0,1,3,5");
    expect(b.faces.map((f) => f.nickname).join(",")).toBe("닉0,닉1,닉3,닉5");
  });

  it("검은 천 조각 clue 면 검은 천 의상인 얼굴 둘에 cloth 표시, 나머지는 표시 없음", () => {
    const b = boardOf(viewOf({ scene: [{ spot: "cloth", r: "clue", piece: "blackCloth" }] }));
    expect(b.faces.map((f) => `${f.seat}:${f.marks.map((m) => m.kind).join("+") || "-"}`).join(",")).toBe("0:-,1:cloth,2:-,3:cloth,4:-,5:-");
  });

  it("창문 조각 clue 는 window 표시, 옷 조각과 같은 사람이면 두 표시가 함께", () => {
    const b = boardOf(viewOf({ scene: [{ spot: "cloth", r: "clue", piece: "blackCloth" }, { spot: "window", r: "clue", piece: "whiteCloth" }] }));
    expect(b.faces.map((f) => `${f.seat}:${f.marks.map((m) => m.kind).join("+") || "-"}`).join(",")).toBe("0:-,1:cloth,2:window,3:cloth,4:-,5:-");
    const same = boardOf(viewOf({ scene: [{ spot: "cloth", r: "clue", piece: "blackCloth" }, { spot: "window", r: "clue", piece: "blackCloth" }] }));
    expect(same.faces.find((f) => f.seat === 1)!.marks.map((m) => m.kind).join("+")).toBe("cloth+window");
  });

  it("조각이 없는 칩(dark·touched·none)은 얼굴 표시를 만들지 않는다", () => {
    const b = boardOf(viewOf({ scene: SCENE.filter((l) => l.r !== "clue") }));
    expect(b.faces.every((f) => f.marks.length === 0)).toBe(true);
  });
});

describe("boardOf 목격 칸", () => {
  it("me.record 가 있으면 witness 줄 수 = 기록 줄 수(번호·닉네임 포함), 없으면 null", () => {
    const rec: RecordLine[] = [{ seat: 1, place: "glass" }, { seat: 3, place: "piano" }];
    const b = boardOf(viewOf({ record: rec }));
    expect(b.witness?.length).toBe(2);
    expect(b.witness?.map((r) => `${r.n}:${r.name}`).join(",")).toBe("1:닉1,2:닉3");
    expect(boardOf(viewOf()).witness).toBeNull();
  });
});

describe("boardOf 는 역할을 읽지 않는다 (T-21-39·T-21-40)", () => {
  it("마피아·시민 view(같은 me.scene)의 결과가 같다", () => {
    const base = JSON.stringify(boardOf(viewOf({ role: "citizen", scene: SCENE, lamps: [true, false, true, true, true, true, true, true] })));
    for (const role of ["mafia", "police", "doctor"] as RoleId[]) expect(JSON.stringify(boardOf(viewOf({ role, scene: SCENE, lamps: [true, false, true, true, true, true, true, true] })))).toBe(base);
  });

  it("처형된 좌석이 있어도 얼굴 항목에 직업 값이 없다(허용 키는 seat·nickname·marks 뿐)", () => {
    const b = boardOf(viewOf({ executed: 3, dead: [3], role: "mafia" }));
    expect(b.faces.some((f) => f.seat === 3)).toBe(false);
    for (const f of b.faces) expect(Object.keys(f).sort().join(",")).toBe("marks,nickname,seat");
    expect(JSON.stringify(b)).not.toMatch(/mafia"|citizen|police|doctor|job|role/);
  });

  it("소스(주석 제외)에 역할 필드 읽기가 없다", () => {
    const src = readFileSync("src/game/boardView.ts", "utf8")
      .split("\n")
      .filter((l) => !/^\s*\/\//.test(l))
      .join("\n");
    expect(src).not.toMatch(/\.role\b|\.job\b|spectate/);
    expect(src).toMatch(/sameOutfitSeats/);
  });
});
