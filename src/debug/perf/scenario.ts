// ?perf=1 시나리오: 서버 없이 클라이언트만으로 만든 시드 고정 배회·동작 이벤트(UI-SPEC "스파이크 장면").
// 같은 seed 면 모든 기기가 같은 경로를 돈다 — 난수는 이 파일의 mulberry32 하나, 시각은 인자(시나리오 시작부터의 ms)뿐이다.
// 이 파일은 시각·난수를 스스로 읽지 않고 three 도 모른다(node 에서 그대로 시험된다).
// 구간은 shared 의 routeFx 가 만들고(가구를 돌아서 간다), 값은 서버가 보내는 world move 프레임과 같은 모양이다.
import { cellCenterFx, routeFx, walkableCells } from "../../../shared/game/map";
import type { MapDef } from "../../../shared/game/map";
import { MOVE_V, WANDER_MIN_MS, WANDER_SPAN_MS, restSegment, positionAtFx, segmentEndsAt } from "../../../shared/game/world";
import type { Segment } from "../../../shared/game/world";
import { UNIT } from "../../../shared/game/map";
import { EMOTE_IDS } from "../../../shared/protocol";
import type { EmoteId, MapId } from "../../../shared/protocol";

/** 동작 이벤트 간격(ms): 5초마다 한 명 */
export const EMOTE_EVERY_MS = 5000;
/** 동작을 하는 사람이 다시 걷기 시작하기까지 최소 시간(ms) */
const EMOTE_PAUSE_MS = 2000;
/** 처음 걷기 시작이 한꺼번에 몰리지 않게 사람마다 이 범위 안에서 어긋낸다(ms) */
const FIRST_WANDER_BASE_MS = 500;
const FIRST_WANDER_SPREAD_MS = 3000;
const EMOTES = ["clap", "deny"] as const;
/** burst 경로(10-06)가 돌려 쓰는 아홉 종 — 기본 시나리오의 EMOTES 와 난수·순서를 섞지 않으려 따로 둔다 */
const BURST_EMOTES = EMOTE_IDS;
export type PerfEmote = EmoteId;
/** outfits=mix 일 때 좌석 i 가 입는 의상(0번이 탐정, 8명 모두 다르다) */
export const MIX_OUTFITS = ["detective", "noir", "mafia", "reporter", "hood", "elder", "police", "doctor"] as const;

/** 외부 패키지 없는 소형 시드 난수(mulberry32). 0 이상 1 미만 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ScenarioOptions {
  seed: number;
  /** 캐릭터 수 (1~8, 자리 0부터) */
  chars: number;
  map: MapDef;
  /** 같은 시각에 동작하는 사람 수(1~4, 기본 1). 1 이면 10-06 이전과 이벤트 열이 같다 */
  burst?: number;
}

export type ScenarioEvent =
  | { kind: "move"; at: number; seat: number; p: number[]; t0: number; v: number }
  | { kind: "emote"; at: number; seat: number; id: PerfEmote };

export interface Scenario {
  /** 시작 때 모두가 입장 지점에 서 있는 구간(t0 = 0) — world snap 의 ents 로 넣는다 */
  initial(): { s: number; p: number[]; t0: number; v: number }[];
  /** at <= untilMs 인 새 이벤트를 시간순으로 돌려준다. 나눠 불러도 한 번에 부른 것과 같다 */
  advance(untilMs: number): ScenarioEvent[];
  /** 사람이 화면을 눌러 seat 가 직접 걷기 시작했다: 시나리오가 그 사람의 위치를 이 구간으로 알고 이어 간다(다른 사람의 경로는 그대로) */
  retarget(seat: number, seg: Segment): void;
}

export function createScenario(opts: ScenarioOptions): Scenario {
  const { map } = opts;
  const chars = Math.max(1, Math.min(8, Math.floor(opts.chars)));
  // 자리마다 난수 흐름이 따로다 — 한 사람의 경로가 바뀌어도(사람이 눌러 retarget) 다른 사람의 경로는 같다
  const rands = Array.from({ length: chars }, (_, s) => mulberry32(Math.imul(opts.seed | 0, 1_000_003) + Math.imul(s + 1, 7919)));
  const cells = walkableCells(map);
  const burst = Math.max(1, Math.min(chars, Math.floor(opts.burst ?? 1) || 1));

  const segs: Segment[] = [];
  const nextWander: number[] = [];
  for (let s = 0; s < chars; s++) {
    const sp = map.spawns.length > 0 ? map.spawns[s % map.spawns.length]! : { x: 0, z: 0 };
    segs.push(restSegment(Math.round(sp.x * UNIT), Math.round(sp.z * UNIT), 0));
    nextWander.push(FIRST_WANDER_BASE_MS + Math.floor(rands[s]!() * FIRST_WANDER_SPREAD_MS));
  }
  let nextEmote = EMOTE_EVERY_MS;
  let emoteCount = 0;

  return {
    initial() {
      return segs.map((g, s) => ({ s, p: [...g.p], t0: g.t0, v: g.v }));
    },
    advance(untilMs) {
      const out: ScenarioEvent[] = [];
      for (;;) {
        // 가장 이른 다음 사건. 같은 시각이면 자리 번호가 작은 걷기가 먼저, 동작은 마지막이다
        let seat = -1;
        let at = Infinity;
        for (let s = 0; s < chars; s++) {
          if (nextWander[s]! < at) {
            at = nextWander[s]!;
            seat = s;
          }
        }
        const emoteFirst = nextEmote < at;
        const t = emoteFirst ? nextEmote : at;
        if (t > untilMs) break;
        if (emoteFirst && burst > 1) {
          // 같은 시각에 서로 다른 burst 명이 동작한다(걷던 사람은 먼저 멈춘다). 동작 id 는 아홉 종을 돌아가며 쓴다
          for (let i = 0; i < burst; i++) {
            const who = (emoteCount * burst + i) % chars;
            const id = BURST_EMOTES[(emoteCount * burst + i) % BURST_EMOTES.length]!;
            if (segmentEndsAt(segs[who]!) > t) {
              const here = positionAtFx(segs[who]!, t);
              segs[who] = restSegment(here.x, here.z, t);
              out.push({ kind: "move", at: t, seat: who, p: [here.x, here.z], t0: t, v: MOVE_V });
            }
            out.push({ kind: "emote", at: t, seat: who, id });
            nextWander[who] = Math.max(nextWander[who]!, t + EMOTE_PAUSE_MS);
          }
          emoteCount += 1;
          nextEmote += EMOTE_EVERY_MS;
          continue;
        }
        if (emoteFirst) {
          // 돌아가는 차례의 사람이 하던 걸음을 멈추고(한 점 구간) 동작을 한다 — 걷는 중인 사람에게는 동작을 시키지 않는다
          const who = emoteCount % chars;
          const id = EMOTES[emoteCount % EMOTES.length]!;
          if (segmentEndsAt(segs[who]!) > t) {
            const here = positionAtFx(segs[who]!, t);
            segs[who] = restSegment(here.x, here.z, t);
            out.push({ kind: "move", at: t, seat: who, p: [here.x, here.z], t0: t, v: MOVE_V });
          }
          out.push({ kind: "emote", at: t, seat: who, id });
          // 동작이 끝나기 전에 다시 걷지 않는다
          nextWander[who] = Math.max(nextWander[who]!, t + EMOTE_PAUSE_MS);
          emoteCount += 1;
          nextEmote += EMOTE_EVERY_MS;
          continue;
        }
        const here = positionAtFx(segs[seat]!, t);
        const rand = rands[seat]!;
        const cell = cells[Math.floor(rand() * cells.length)]!;
        const p = routeFx(map, here, cellCenterFx(cell.c, cell.r));
        segs[seat] = { p, t0: t, v: MOVE_V };
        out.push({ kind: "move", at: t, seat, p: [...p], t0: t, v: MOVE_V });
        nextWander[seat] = t + WANDER_MIN_MS + Math.floor(rand() * WANDER_SPAN_MS);
      }
      return out;
    },
    retarget(seat, seg) {
      if (seat < 0 || seat >= chars) return;
      segs[seat] = { p: [...seg.p], t0: seg.t0, v: seg.v };
      // 사람이 정한 걸음이 끝나기 전에 시나리오가 끼어들지 않는다
      nextWander[seat] = Math.max(nextWander[seat]!, segmentEndsAt(seg));
    },
  };
}

export interface PerfParams {
  /** 조명 단계. 성능 측정은 talk·vote, 조명 렌더 측정(18-07)은 morning·night 까지 같은 카메라로 찍는다 */
  scene: "talk" | "morning" | "vote" | "night";
  /** 측정 시간(분). 0.25 = 15초 */
  minutes: number;
  /** 화면 배율 상한을 이 값으로 고정(없으면 사다리 단계의 값) */
  dpr: number | null;
  /** 사다리 단계 0~5 */
  budget: number;
  seed: number;
  chars: number;
  /** 10초에 멈추고 HUD 를 숨긴다(스크린샷용) */
  shot: boolean;
  /** 걸을 수 있는 셀 중심을 점으로 겹쳐 본다 */
  nav: boolean;
  /** 좌석 의상: coat = 모두 기본 코트(look 없음), mix = 8명 서로 다른 의상(탐정 포함, MIX_OUTFITS) */
  outfits: "coat" | "mix";
  /** 같은 시각에 동작하는 사람 수 1~4 */
  burst: number;
  /** 장면과 걷기 시나리오의 맵(MAP-06): bar = 지하 재즈 바(기본), plaza = 시계탑 광장. 광장 성능 측정(11-10)용 */
  map: MapId;
}

function num(v: string | null): number | null {
  if (v === null || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** ?perf=1 쿼리: scene·minutes·dpr·budget·seed·chars·shot·nav·outfits·burst·map. 잘못된 값은 기본값, 범위 밖은 안쪽으로 자른다 */
export function parsePerfParams(q: URLSearchParams): PerfParams {
  const minutes = num(q.get("minutes"));
  const dpr = num(q.get("dpr"));
  const budget = num(q.get("budget"));
  const seed = num(q.get("seed"));
  const chars = num(q.get("chars"));
  const burst = num(q.get("burst"));
  const sceneQ = q.get("scene");
  return {
    scene: sceneQ === "vote" || sceneQ === "morning" || sceneQ === "night" ? sceneQ : "talk",
    minutes: minutes !== null && minutes > 0 ? minutes : 5,
    dpr: dpr !== null && dpr > 0 && dpr <= 4 ? dpr : null,
    budget: budget === null ? 0 : Math.max(0, Math.min(5, Math.floor(budget))),
    seed: seed === null ? 1 : Math.floor(seed),
    chars: chars === null ? 8 : Math.max(1, Math.min(8, Math.floor(chars))),
    shot: q.get("shot") === "1",
    nav: q.get("nav") === "1",
    outfits: q.get("outfits") === "mix" ? "mix" : "coat",
    burst: burst !== null && Number.isInteger(burst) && burst >= 1 && burst <= 4 ? burst : 1,
    map: q.get("map") === "plaza" ? "plaza" : "bar",
  };
}
