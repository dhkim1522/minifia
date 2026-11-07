// 밤 규칙. 순수 모듈이다 — 현재 시각·전역 난수를 읽지 않고, 입력 상태는 바꾸지 않는다.
// 밤 판정에는 난수가 없다(결정 0061-6·17): 마피아 전원이 같은 대상을 골라야 확정이고, 갈리면 아무도 죽지 않는다.
//
// 이 파일이 플레이어의 role 을 읽는 이유는 행동 종류(지목·조사·보호)·마피아 표·조사 결과가 서버 판정이기 때문이다(pickTarget 은 읽지 않는다 — 15페이즈 D-05).
// 밤 고르기는 산 사람 누구나 같은 입력·같은 응답이고, 효과는 판정이 역할로 가른다. 피해자가 나온 아침에는 enterMorning 이 그 밤 피해자를 고른 사람 중 한 명의 의상으로 흔적 조각을 정한다(D-06, trace.ts).
// 읽은 역할 값은 어디에도 내보내지 않는다(결정 0002): 반환값에는 isMafia 불리언 하나와 seat 뿐이다.
import type { AssassinationRecord, InvestigationRecord, MorningView, TreatmentRecord } from "../protocol";
import { isAlive } from "./alive";
import type { Player, RoomState } from "./room";
import { pickTracePiece } from "./trace";
import type { RandInt } from "./tick";

export type NightError = "WRONG_PHASE" | "BAD_MESSAGE";

/**
 * 밤에 한 명 고르기. 산 사람 누구나 같은 메시지·같은 규칙·같은 응답이다(15페이즈 D-05) — 이 함수는 역할을 읽지 않는다.
 * 고른 값은 그 사람의 nightPick 에 저장되고, 효과가 있는지(마피아 팀 확정·경찰 조사·의사 보호)는 판정(resolveNight·confirmedTarget)이 역할로 가른다.
 * 시민의 고르기·마피아가 동료나 자신을 고르는 것은 효과 없이 받는다 — 응답으로 역할이 갈라지지 않게 한다(D-08).
 * 검사 순서가 계약이다: 단계(night 아니면 WRONG_PHASE) → 행위자(방에 있고 생존, 아니면 BAD_MESSAGE)
 * → 대상(정수·앉은 생존자, 자기 자신 포함, 아니면 BAD_MESSAGE) → 같은 값이면 입력 상태 그대로 ok → 그 사람의 nightPick 만 바꾼 새 상태.
 */
export function pickTarget(
  state: RoomState,
  actorId: string,
  target: number,
): { ok: true; state: RoomState } | { ok: false; error: NightError } {
  if (state.phase !== "night") return { ok: false, error: "WRONG_PHASE" };
  const actor = state.players.find((p) => p.id === actorId);
  if (!actor || !isAlive(actor)) return { ok: false, error: "BAD_MESSAGE" };
  const chosen = Number.isInteger(target) ? state.players.find((p) => p.seat === target) : undefined;
  if (!chosen || !isAlive(chosen)) return { ok: false, error: "BAD_MESSAGE" };
  if (actor.nightPick === target) return { ok: true, state };
  return {
    ok: true,
    state: { ...state, players: state.players.map((p) => (p.id === actorId ? { ...p, nightPick: target } : p)) },
  };
}

/** 밤 진입 훅: 남은 선택(nightPick)·지난 아침 결과(morning)·쪽지(nightNote)·분필(chalk)을 키째 지운다(결정 0061-9·14). */
export function enterNight(state: RoomState): RoomState {
  const { morning: _morning, nightNote: _nightNote, chalk: _chalk, ...rest } = state;
  return {
    ...rest,
    players: state.players.map((p) => {
      // 심부름 목록·진행(15페이즈)도 키째 지운다 — 다음 낮에 새로 배정되므로 남은 값이 어떤 view 에도 새지 않는다.
      const { nightPick: _nightPick, errandPlaces: _errandPlaces, errandDone: _errandDone, errandNear: _errandNear, errandSeen: _errandSeen, ...kept } = p;
      return kept;
    }),
  };
}

/**
 * 마피아 팀의 확정 대상(결정 0061-6, NIGHT-08). 산 마피아가 1명 이상이고 전원의 nightPick 이 같은 앉은 산 비마피아 seat 일 때만 그 seat, 아니면 undefined.
 * 연결 상태(connected)를 읽지 않는다 — 고르지 않은 채 끊긴 마피아가 있으면 undefined, 고른 뒤 끊긴 마피아의 선택은 그대로 센다(Open Q1).
 * 저장된 값을 판정 때 다시 검증한다(탈락자·마피아를 가리키면 무효, T-09-11). 다수결·무작위 동률 판정은 없다.
 */
export function confirmedTarget(state: RoomState): number | undefined {
  const mafias = state.players.filter((p) => p.role === "mafia" && isAlive(p));
  const first = mafias[0];
  if (first === undefined) return undefined;
  const pick = first.nightPick;
  if (pick === undefined || !mafias.every((p) => p.nightPick === pick)) return undefined;
  const t = state.players.find((q) => q.seat === pick);
  return t !== undefined && isAlive(t) && t.role !== "mafia" ? t.seat : undefined;
}

/** resolveNight 의 결과. 일지 줄에는 숫자·불리언뿐이고 직업 이름은 없다. */
export interface ResolvedNight {
  /** 마피아 팀의 확정 대상 seat(의사가 막았어도 남는다). 확정이 없으면 키가 없다. 서버 전용 밤 기록(nightLog)의 재료다. */
  target?: number;
  eliminated?: number;
  /** 확정 대상이 있고 의사가 지켰을 때 true (MORN-03). 공개 값은 이 불리언 하나뿐이다. */
  saved: boolean;
  /** 경찰 수사일지 줄 */
  records: Array<{ playerId: string; record: InvestigationRecord }>;
  /** 마피아 암살일지 줄 — 팀 기록이라 생존 마피아마다 같은 줄 */
  assassinations: Array<{ playerId: string; record: AssassinationRecord }>;
  /** 의사 치료일지 줄 */
  treatments: Array<{ playerId: string; record: TreatmentRecord }>;
}

/**
 * 판정 규칙표(결정 0020 → 0061-6·12). 모든 행동은 밤 시작 시점의 생존자 기준으로 동시에 해결한다. 난수가 없다.
 *   마피아 전원이 같은 앉은 산 비마피아를 고름 → 확정 대상(confirmedTarget)
 *   일부만 고름 · 갈림 · 아무도 안 고름           → 확정 없음: 지목 없음, 탈락 없음, morning {} (연결 상태는 읽지 않는다)
 *   저장된 지목이 탈락자·마피아                   → 확정 없음(방어적 재검증)
 *   의사 보호 = 확정 대상                         → 탈락 없음, saved true — 공개 차이는 saved 하나뿐이다(MORN-03). 자기 보호 허용
 *   경찰 조사                                     → { n: day ?? 1, target, isMafia } 를 그 경찰의 investigations 끝에 (D-09). 자기 조사 = false
 *   그 밤에 지목되는 경찰·의사                    → 조사·보호는 그대로 적용 — 동시 해결 (A1)
 *   마피아 암살일지                               → 확정 대상이 있으면 밤 시작 때 생존 마피아 모두에게 같은 { n: day ?? 1, target, died } 한 줄. 의사가 막으면 died false. 확정이 없으면 줄이 없다 (D-09·D-10)
 *   의사 치료일지                                 → 밤 시작 때 생존 의사마다 고른 앉은 생존자가 있으면 { n, target } 한 줄(자기 포함, 구출 여부 키 없음) (D-10)
 *   밤 기록(서버 전용, 판 요약 재료)              → enterMorning 이 nightLog 끝에 { n: day ?? 1, target?, died } 한 줄. target 은 확정 대상이 있을 때만, died 는 탈락자가 있을 때만 true (D-27) — 게임 중에는 어떤 view 에도 싣지 않는다 (결정 0020-3)
 * 동시 해결(A1)은 사용자가 바꿀 수 있는 기본값이다 — 바뀌면 이 표와 테스트만 고친다(결정 0020).
 * 일지는 새 정보를 만들지 않는다 — 막은 사실을 마피아에게 알리지 않는다(결정 0026-4): died false 는 '지목했는데 아무도 죽지 않았다' 뿐이다.
 */
export function resolveNight(state: RoomState): ResolvedNight {
  const seated = (seat: number | undefined): Player | undefined =>
    seat === undefined ? undefined : state.players.find((q) => q.seat === seat);
  const living = state.players.filter(isAlive);

  const target = confirmedTarget(state);

  // 의사 보호: 밤 시작 시점의 생존 의사 중 확정 대상을 고른 사람이 있으면 탈락 없음(A1: 지목되는 의사의 보호도 적용).
  const saved = target !== undefined && living.some((p) => p.role === "doctor" && p.nightPick === target);
  const eliminated = target !== undefined && !saved ? target : undefined;

  // 경찰 조사: 밤 시작 시점의 생존 경찰마다 고른 앉은 생존자의 마피아 여부 한 비트(A1: 지목되는 경찰의 조사도 기록).
  const records: Array<{ playerId: string; record: InvestigationRecord }> = [];
  for (const p of living) {
    if (p.role !== "police") continue;
    const t = seated(p.nightPick);
    if (!t || !isAlive(t)) continue;
    records.push({ playerId: p.id, record: { n: state.day ?? 1, target: t.seat, isMafia: t.role === "mafia" } });
  }

  // 마피아 암살일지: 확정 대상이 있을 때만, 밤 시작 때 살아 있던 마피아 모두에게 같은 줄.
  const assassinations: ResolvedNight["assassinations"] = [];
  if (target !== undefined) {
    for (const p of living) {
      if (p.role !== "mafia") continue;
      assassinations.push({ playerId: p.id, record: { n: state.day ?? 1, target, died: eliminated === target } });
    }
  }

  // 의사 치료일지: 밤 시작 때 생존 의사마다 고른 앉은 생존자(자기 포함). 구출 성공 여부는 싣지 않는다.
  const treatments: ResolvedNight["treatments"] = [];
  for (const p of living) {
    if (p.role !== "doctor") continue;
    const t = seated(p.nightPick);
    if (!t || !isAlive(t)) continue;
    treatments.push({ playerId: p.id, record: { n: state.day ?? 1, target: t.seat } });
  }

  const picked = target === undefined ? {} : { target };
  const gone = eliminated === undefined ? {} : { eliminated };
  return { ...picked, ...gone, saved, records, assassinations, treatments };
}

/**
 * morning 진입 훅: resolveNight 결과를 한 번의 새 상태로 적용한다 — 탈락자 alive false(직업은 싣지 않는다),
 * 경찰 investigations·마피아 assassinations·의사 treatments 뒤에 추가, morning 은 탈락이면 { eliminated }, 의사 구출이면 { saved: true }, 확정이 없으면 {},
 * 탈락이 없으면 nightNote 를 키째 지운다(구출·무효 밤의 쪽지 폐기, 결정 0061-9),
 * 모든 nightPick 키 제거(아침 뷰에 선택 흔적이 남지 않는다), nightLog 끝에 그 밤 한 줄 추가(서버 전용, 키를 필드별로 만든다).
 * 판정에는 난수가 없다(결정 0061-17). 난수는 탈락자가 있을 때 흔적을 낼 사람을 뽑는 한 번뿐이다(D-06, randInt 를 안 받으면 첫 후보 — 결정적).
 * 흔적(morning.trace): 탈락자가 있을 때만, 그 밤 피해자를 고른 산 사람(피해자 본인 제외) 풀에서 한 명의 의상 조각 하나. 풀은 nightPick 을 지우기 전의 players 로 만든다.
 * 구출·무효 밤은 trace 키가 없다.
 */
export function enterMorning(state: RoomState, randInt: RandInt = () => 0): RoomState {
  const result = resolveNight(state);
  const players: Player[] = state.players.map((p) => {
    const { nightPick: _nightPick, ...kept } = p;
    const added = result.records.filter((r) => r.playerId === p.id).map((r) => r.record);
    const killed = result.assassinations.filter((r) => r.playerId === p.id).map((r) => r.record);
    const healed = result.treatments.filter((r) => r.playerId === p.id).map((r) => r.record);
    const withRecords: Player = {
      ...kept,
      ...(added.length > 0 ? { investigations: [...(kept.investigations ?? []), ...added] } : {}),
      ...(killed.length > 0 ? { assassinations: [...(kept.assassinations ?? []), ...killed] } : {}),
      ...(healed.length > 0 ? { treatments: [...(kept.treatments ?? []), ...healed] } : {}),
    };
    return result.eliminated === p.seat ? { ...withRecords, alive: false } : withRecords;
  });
  const piece = result.eliminated === undefined ? undefined : pickTracePiece(state, result.eliminated, randInt);
  const morning: MorningView =
    result.eliminated !== undefined
      ? { eliminated: result.eliminated, ...(piece === undefined ? {} : { trace: piece }) }
      : result.saved
        ? { saved: true }
        : {};
  const { nightNote: _nightNote, ...rest } = state;
  return {
    ...(result.eliminated === undefined ? rest : state),
    players,
    morning,
    nightLog: [
      ...(state.nightLog ?? []),
      {
        n: state.day ?? 1,
        ...(result.target === undefined ? {} : { target: result.target }),
        died: result.eliminated !== undefined,
      },
    ],
  };
}

const bySeat = (a: Player, b: Player): number => a.seat - b.seat;

/**
 * 밤 행동 뒤 state 를 받는 사람 — 행위자 쪽과 관전자(탈락자, 결정 0021). 행위자가 마피아면 생존 마피아 전원, 아니면 본인뿐이다.
 * 살아 있는 다른 사람에게 보내면 '누군가 행동했다' 는 프레임 타이밍이 샌다(RESEARCH Pitfall 1). 중복 없이 seat 오름차순.
 */
export function pickRecipientIds(state: RoomState, actorId: string): string[] {
  const actor = state.players.find((p) => p.id === actorId);
  const actorSide =
    actor?.role === "mafia" ? state.players.filter((p) => p.role === "mafia" && isAlive(p)) : actor ? [actor] : [];
  const spectators = state.players.filter((p) => !isAlive(p));
  const seen = new Map<string, Player>();
  for (const p of [...actorSide, ...spectators]) seen.set(p.id, p);
  return [...seen.values()].sort(bySeat).map((p) => p.id);
}
