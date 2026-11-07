// 15페이즈 공유 view 비교 (15-06, D-08, 위협 T-15-23): 같은 생존 상태의 두 viewer 의 view 는 me 밖(players·day·최상위)이 한 글자도 다르지 않고,
// me 안에서는 허용 키 밖이 없으며 me.errand·me.record 의 구조(키 집합)가 viewer 가 달라도 같다. 값은 사람마다 다를 수 있어 구조로 견준다.
import { describe, expect, it } from "vitest";
import { isAlive } from "../../shared/game/alive";
import { pickTarget } from "../../shared/game/night";
import type { Player, RoomState } from "../../shared/game/room";
import { tick } from "../../shared/game/tick";
import { buildView } from "../../shared/game/view";
import type { PhaseId, PlaceId, RoomView } from "../../shared/protocol";
import { seededRandInt } from "../helpers/seededRandom";
import { START_AT, startedAt } from "../helpers/voteState";

/** me 안에 올 수 있는 키 전부. 새 키는 이유와 함께 여기에 더해야 시험이 통과한다. */
const ME_ALLOWED: ReadonlySet<string> = new Set([
  "seat", "isHost", "role", "allies", "pick", "allyPicks", "records", "chat", "endDiscussion", "verdictVote",
  "whisperUsed", "ballot", "nightTally", "nightSure", "will", "note",
  "errand", // errand 단계의 산 본인
  "record", // 토론 단계의 3곳 완료한 산 본인
]);
const SEEDS = [1, 42, 20260101] as const;
const SIZES = [4, 6, 8] as const;
const PHASES_15: readonly PhaseId[] = ["errand", "discussion", "night", "morning"];
const FIVE_PLACES: readonly PlaceId[] = ["glass", "piano", "sax"];

const keysOf = (v: unknown): string => Object.keys((v ?? {}) as object).sort().join(",");
const withoutMe = (view: RoomView): string => {
  const { me: _me, ...rest } = view;
  return JSON.stringify(rest);
};
/** 값의 종류만 남긴 모양(키 집합·배열 길이·값의 타입). 장소 id·좌석 값은 사람마다 다르다. */
const shapeOf = (v: unknown): string => {
  if (Array.isArray(v)) return `[${v.map(shapeOf).join(",")}]`;
  if (v !== null && typeof v === "object") {
    return `{${Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, x]) => `${k}:${shapeOf(x)}`).join(",")}}`;
  }
  return typeof v;
};

const idOfSeat = (s: RoomState, seat: number): string => s.players.find((p) => p.seat === seat)!.id;
const patch = (s: RoomState, f: (p: Player) => Player): RoomState => ({ ...s, players: s.players.map(f) });

/** 단계별 상태: 진행·기록·선택이 사람마다 다르게 채워진 모습을 만든다(같은 열 구조 검사가 의미 있도록). */
function stateOf(phase: PhaseId, n: number, seed: number): RoomState {
  if (phase === "errand") {
    // 사람마다 처리한 개수가 다르다.
    const s = startedAt(n, seed, "errand");
    return patch(s, (p) => ({ ...p, errandDone: (p.errandPlaces ?? []).slice(0, p.seat % 3) }));
  }
  if (phase === "discussion") {
    // 짝수 좌석은 3곳을 마쳤고 줄이 있다 · 홀수 좌석은 못 마쳤다. 시험이 서버 상태에 직접 쓴다.
    const s = startedAt(n, seed, "discussion");
    return patch(s, (p) =>
      p.seat % 2 === 0
        ? { ...p, errandDone: [...(p.errandPlaces ?? [])], errandSeen: [{ seat: (p.seat + 1) % n, place: FIVE_PLACES[p.seat % 3]! }] }
        : { ...p, errandDone: (p.errandPlaces ?? []).slice(0, 2) },
    );
  }
  let s = startedAt(n, seed, "night");
  const living = s.players.filter(isAlive).sort((a, b) => a.seat - b.seat);
  const target = living.find((p) => p.role !== "mafia")!.seat;
  for (const p of living) {
    // 모든 역할이 같은 입력으로 고른다(시민도 포함, D-05). 마피아는 같은 대상을 골라 확정한다.
    const r = pickTarget(s, p.id, p.role === "mafia" ? target : living[(p.seat + 1) % living.length]!.seat);
    if (!r.ok) throw new Error(`pickTarget failed: ${r.error}`);
    s = r.state;
  }
  if (phase === "night") return s;
  return tick(s, s.phaseEndsAt!, seededRandInt(seed));
}

/** 살아 있는 모두와 한 명을 탈락시켜 만든 유령의 두 모습(밤·아침은 이미 탈락자가 있을 수 있어 그대로 둔다). */
function ghostOf(s: RoomState): RoomState {
  const alive = s.players.filter(isAlive).sort((a, b) => a.seat - b.seat);
  return patch(s, (p) => (p.seat === alive[alive.length - 1]!.seat ? { ...p, alive: false } : p));
}

const viewsOf = (s: RoomState): Array<{ p: Player; v: RoomView }> => s.players.map((p) => ({ p, v: buildView(s, p.id, START_AT) }));

describe("공유 view — 같은 생존 상태의 viewer 사이에서 me 밖은 한 글자도 다르지 않다 (D-08)", () => {
  it("errand·discussion·night·morning 의 산 viewer 끼리, 유령 viewer 끼리 me 를 뺀 view 가 같다", () => {
    const diffs: string[] = [];
    let compared = 0;
    for (const n of SIZES) {
      for (const seed of SEEDS) {
        for (const phase of PHASES_15) {
          for (const [label, s] of [["plain", stateOf(phase, n, seed)], ["ghost", ghostOf(stateOf(phase, n, seed))]] as const) {
            const groups = new Map<boolean, string[]>();
            for (const { p, v } of viewsOf(s)) {
              const alive = isAlive(p);
              groups.set(alive, [...(groups.get(alive) ?? []), withoutMe(v)]);
            }
            for (const [alive, list] of groups) {
              for (const one of list) {
                compared += 1;
                if (one !== list[0]) diffs.push(`${phase}/${n}/${seed}/${label}/alive=${alive}`);
              }
            }
          }
        }
      }
    }
    expect(compared).toBeGreaterThan(100);
    expect(diffs.join(",")).toBe("");
  });

  it("me 안에는 허용 키 밖이 없다 (서버 전용 이름이 새지 않는다)", () => {
    const bad: string[] = [];
    for (const n of SIZES) {
      for (const seed of SEEDS) {
        for (const phase of PHASES_15) {
          for (const s of [stateOf(phase, n, seed), ghostOf(stateOf(phase, n, seed))]) {
            for (const { p, v } of viewsOf(s)) {
              for (const k of Object.keys(v.me)) if (!ME_ALLOWED.has(k)) bad.push(`${phase}/${n}/${seed}/seat${p.seat}:me.${k}`);
              // 서버 전용 이름은 어떤 깊이의 키로도 없다(me 밖 포함).
              const text = JSON.stringify(v);
              for (const name of ["errandPlaces", "errandDone", "errandNear", "errandSeen", "errandTickAt", "nightPick"]) {
                if (text.includes(`"${name}"`)) bad.push(`${phase}/${n}/${seed}/seat${p.seat}:${name}`);
              }
            }
          }
        }
      }
    }
    expect(bad.join(",")).toBe("");
  });
});

describe("me.errand·me.record 의 구조는 viewer 가 달라도 같다 (D-03·D-04)", () => {
  it("errand: 산 viewer 전원의 me.errand 모양이 {done:[…],places:[3개]} 로 같고 유령에게는 키가 없다", () => {
    const shapes = new Set<string>();
    for (const n of SIZES) {
      for (const seed of SEEDS) {
        const s = stateOf("errand", n, seed);
        for (const { p, v } of viewsOf(s)) {
          expect(keysOf(v.me.errand)).toBe("done,places");
          expect(v.me.errand!.places.length).toBe(3);
          expect(new Set(v.me.errand!.places).size).toBe(3);
          // done 길이만 다르다(진행) — 모양에서 길이를 뺀 키·종류가 같아야 한다.
          expect(v.me.errand!.done.length).toBe(p.seat % 3);
          shapes.add(`${keysOf(v.me.errand)}|${v.me.errand!.places.length}|${typeof v.me.errand!.places[0]}`);
        }
        for (const { v } of viewsOf(ghostOf(s)).filter(({ p }) => !isAlive(p))) expect("errand" in v.me).toBe(false);
      }
    }
    expect([...shapes]).toEqual(["done,places|3|string"]);
  });

  it("record: 토론에서 3곳을 마친 산 viewer 에게만, 줄 키는 seat·place 뿐이고 모든 viewer 의 줄 모양이 같다. 못 마친 사람·유령에게는 키가 없다", () => {
    const shapes = new Set<string>();
    for (const n of SIZES) {
      for (const seed of SEEDS) {
        const s = stateOf("discussion", n, seed);
        for (const { p, v } of viewsOf(s)) {
          expect(`${p.seat}:${"record" in v.me}`).toBe(`${p.seat}:${p.seat % 2 === 0}`);
          if (v.me.record === undefined) continue;
          for (const line of v.me.record) shapes.add(shapeOf(line));
          expect(keysOf(v.me.record[0])).toBe("place,seat");
        }
        const dead = ghostOf(s);
        for (const { p, v } of viewsOf(dead)) if (!isAlive(p)) expect("record" in v.me).toBe(false);
        // 다른 단계에는 키가 없다.
        for (const other of ["errand", "night", "morning"] as PhaseId[]) {
          for (const { v } of viewsOf(stateOf(other, n, seed))) expect("record" in v.me).toBe(false);
        }
      }
    }
    expect([...shapes]).toEqual(["{place:string,seat:number}"]);
  });

  it("morning: 탈락자가 있는 아침의 day.morning 키 집합은 eliminated·trace, 구출 아침은 saved 뿐(trace 없음)이고 모든 viewer 에게 같은 값이다", () => {
    const seen = new Set<string>();
    for (const n of SIZES) {
      for (const seed of SEEDS) {
        const s = stateOf("morning", n, seed);
        const mornings = viewsOf(s).map(({ v }) => JSON.stringify(v.day?.morning));
        expect(new Set(mornings).size).toBe(1);
        seen.add(keysOf(viewsOf(s)[0]!.v.day?.morning));
      }
    }
    // 시드에 따라 의사가 구하는 아침도 있다 — 그 아침에는 trace 키가 없다.
    expect([...seen].sort()).toEqual(["eliminated,trace", "saved"]);
  });
});

describe("비교 도우미가 새 키를 잡는다 (음성 시험)", () => {
  it("me 에 errandNear 를 더한 가짜 view 는 허용 키 검사와 me 밖 비교 어느 쪽으로도 실패로 판정된다", () => {
    const s = stateOf("errand", 6, 1);
    const real = buildView(s, s.players[0]!.id, START_AT);
    const fake = { ...real, me: { ...real.me, errandNear: [1, 2] } } as unknown as RoomView;
    expect(Object.keys(fake.me).filter((k) => !ME_ALLOWED.has(k))).toEqual(["errandNear"]);
    const leakedOutside = { ...real, errandNear: [1] } as unknown as RoomView;
    expect(withoutMe(leakedOutside)).not.toBe(withoutMe(buildView(s, s.players[1]!.id, START_AT)));
    // 다른 viewer 의 id 와 달라진 좌석은 me 밖에 있지 않다.
    expect(idOfSeat(s, 0)).toBe(s.players[0]!.id);
  });
});
