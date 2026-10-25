// 연결별 공개 뷰. 공개 항목은 허용 목록(다섯 키 객체 리터럴, alive 는 공개 정보)으로만 만든다 — Player 를 펼쳐 복사하지 않는다.
// 관전(결정 0021): 탈락한 본인에게만 모든 실제 직업과 그 밤의 행동 대상. 살아 있는 사람에게는 어떤 키로도 싣지 않는다 —
// 결정 0002 를 "살아 있는 사람에게는 보내지 않는다" 로 좁혀 유지. 직업 키 이름은 role 이 아니라 job 이다(누출 검사가 role 키를 me 밖에서 금지).
// 밤 필드 받는 사람: pick 본인(생존·밤), allyPicks 생존 마피아(밤), records 경찰 본인(역할 공개 단계 전체), morning 모두(아침만).
import type {
  DayView,
  MorningView,
  MyInfo,
  PhaseId,
  PreviewPlayer,
  PublicPlayer,
  RoomPreview,
  RoomView,
  SpectatePicks,
  SpectateSeat,
} from "../protocol";
import { MAX_PLAYERS, MIN_PLAYERS } from "../protocol";
import { isAlive } from "./alive";
import { botCount } from "./bots";
import { currentClaimSeat } from "./claim";
import { phaseDurationOf } from "./discussion";
import { PHASE_DEFS } from "./phases";
import { rolesInPlay } from "./roles";
import { hostOf } from "./room";
import type { RoomState } from "./room";

/** view.day 가 생기는 단계: 낮 세 단계와 밤·아침. 이 밖의 단계 뷰에는 day 키 자체가 없다(D-07). */
const DAY_PHASES: ReadonlySet<PhaseId> = new Set([
  "dayAnnounce",
  "claim",
  "discussion",
  "night",
  "morning",
]);

/**
 * 낮 정보. 허용 목록 리터럴로만 만든다 — 조건을 채울 때만 키를 만들고, 서버 전용 필드(claimOrder·claimIdx·claimStart·claimPick)는 싣지 않는다.
 * claimLog 는 공개 정보라 낮 단계마다 모두에게 같게 가고, 줄마다 {n, seat, claim} 세 키로 복사한다(펼쳐 복사 금지).
 * claim 단계에는 지금 차례의 seat(turn)만 싣는다: 끝나지 않은 차례의 선택(claimPick)은 어떤 키로도 나가지 않는다(D-05, T-03.1-01).
 * 읽는 쪽이 기본값을 쥔다: 일차 없으면 1(RESEARCH Pattern 6).
 */
function buildDay(state: RoomState): DayView {
  const day: DayView = {
    n: state.day ?? 1,
    roles: rolesInPlay(state.players.length),
    claimLog: (state.claimLog ?? []).map((entry) => ({ n: entry.n, seat: entry.seat, claim: entry.claim })),
  };
  if (state.phase === "claim") {
    const seat = currentClaimSeat(state);
    if (seat !== undefined) day.turn = { seat };
  }
  if (state.phase === "morning") {
    // 아침 결과는 모두에게 같은 값이다. 탈락자가 있을 때만 키를 만들고, 값은 필드별로 복사한다(의사 구출·지목 없음은 둘 다 {}, D-13).
    const morning: MorningView = {};
    const result = state.morning;
    if (result?.eliminated !== undefined) {
      morning.eliminated = result.eliminated;
      if (result.phrase !== undefined) morning.phrase = result.phrase;
    }
    day.morning = morning;
  }
  return day;
}

/**
 * 비인증 미리보기(4자리 코드만 알면 받는 응답). 객체 리터럴 허용 목록으로만 만든다 — Player 를 펼쳐 복사하지 않는다.
 * 앉은 사람 목록은 대기실에서만 채우고, 그 밖의 단계에서는 빈 배열이다. 역할·토큰·내부 id·연결 상태는 어디에도 싣지 않는다.
 */
export function buildPreview(state: RoomState): RoomPreview {
  const players: PreviewPlayer[] =
    state.phase === "lobby"
      ? [...state.players].sort((a, b) => a.seat - b.seat).map((p) => ({ seat: p.seat, nickname: p.nickname }))
      : [];
  return {
    code: state.code,
    hostNickname: hostOf(state).nickname,
    playerCount: state.players.length,
    maxPlayers: MAX_PLAYERS,
    phase: state.phase,
    players,
  };
}

export function buildView(state: RoomState, playerId: string, now: number): RoomView {
  const me = state.players.find((p) => p.id === playerId);
  if (!me) throw new Error("buildView: player is not in this room");

  const players: PublicPlayer[] = [...state.players]
    .sort((a, b) => a.seat - b.seat)
    .map((p) => ({
      seat: p.seat,
      nickname: p.nickname,
      connected: p.connected,
      isHost: p.id === state.hostId,
      alive: isAlive(p), // 탈락 여부는 공개 정보다(ELIM-01)
    }));

  // 내 정보도 허용 목록으로만 만든다. role·allies 는 조건을 채울 때만 키 자체를 만든다(undefined 로 남기지 않는다).
  const myInfo: MyInfo = { seat: me.seat, isHost: me.id === state.hostId };
  const def = PHASE_DEFS[state.phase];
  if (def.revealsOwnRole && me.role !== undefined) {
    myInfo.role = me.role;
    if (me.role === "mafia") {
      // 마피아에게만 동료의 seat(오름차순)를 알려 준다. 혼자면 빈 배열 — 화면이 "혼자예요" 를 고른다(D-14).
      myInfo.allies = state.players
        .filter((p) => p.role === "mafia" && p.id !== me.id)
        .map((p) => p.seat)
        .sort((a, b) => a - b);
    }
  }

  // 테스트 방 방장 본인에게만(결정 0022): testMode 는 버튼을 그리는 방장만 알면 되고, testRole 은 시트의 '내 직업' 칸이 있는 대기실에서만 실린다.
  // 손님 view·미리보기에는 키 자체가 없다 — 불리언과 방장 본인의 선택뿐이라 역할·토큰과 무관하다.
  if (state.testMode === true && me.id === state.hostId) {
    myInfo.testMode = true;
    if (state.phase === "lobby" && state.testRole !== undefined) myInfo.testRole = state.testRole;
    // 서버 봇 수는 시트의 '봇' 줄이 있는 대기실에서만, 0 포함 항상 숫자로(결정 0024). isBot·botPlan·봇 id 는 어디에도 싣지 않는다.
    if (state.phase === "lobby") myInfo.testBots = botCount(state);
  }

  // 본인 선택은 본인에게만(D-06) — 남의 nightPick 은 어떤 키로도 싣지 않는다. 밤에 살아 있는 본인이 고른 값이 있을 때만 키를 만든다.
  if (state.phase === "night" && isAlive(me) && me.nightPick !== undefined) {
    myInfo.pick = me.nightPick;
  }

  // 동료가 고른 대상은 밤에 살아 있는 마피아에게만, 대상 seat 집합으로만(누가 골랐는지는 없다, D-07). 탈락한 마피아는 allies 만 받는다(A3).
  if (state.phase === "night" && isAlive(me) && me.role === "mafia") {
    const picked = new Set<number>();
    for (const q of state.players) {
      if (q.role === "mafia" && q.id !== me.id && isAlive(q) && q.nightPick !== undefined) picked.add(q.nightPick);
    }
    myInfo.allyPicks = [...picked].sort((a, b) => a - b);
  }

  // 수사 기록은 경찰 본인에게만, 역할을 싣는 모든 단계에서 탈락한 뒤에도(D-09, D-11). 세 키씩 복사한다 — isMafia 는 불리언 한 비트다.
  if (def.revealsOwnRole && me.role === "police") {
    myInfo.records = (me.investigations ?? []).map((r) => ({ n: r.n, target: r.target, isMafia: r.isMafia }));
  }

  const view: RoomView = {
    code: state.code,
    phase: state.phase,
    phaseEndsAt: state.phaseEndsAt,
    phaseDurationMs: phaseDurationOf(state), // 단계 표 길이 — 파생은 한 곳(discussion.ts)
    serverNow: now,
    minPlayers: MIN_PLAYERS,
    maxPlayers: MAX_PLAYERS,
    players,
    me: myInfo,
  };
  if (DAY_PHASES.has(state.phase)) view.day = buildDay(state);

  // 본인이 탈락했고 역할을 싣는 단계일 때만 키를 만든다(살아 있으면 undefined 로도 남기지 않는다).
  if (def.revealsOwnRole && !isAlive(me)) {
    const seats: SpectateSeat[] = [];
    for (const p of [...state.players].sort((a, b) => a.seat - b.seat)) {
      if (p.role !== undefined) seats.push({ seat: p.seat, job: p.role });
    }
    view.spectate = { seats };
    if (state.phase === "night") {
      // 살아 있는 각 역할이 지금 고른 대상만(탈락자의 남은 값은 제외) — 중복 없이 오름차순.
      const picksOf = (role: "mafia" | "police" | "doctor"): number[] => {
        const picked = new Set<number>();
        for (const p of state.players) {
          if (p.role === role && isAlive(p) && p.nightPick !== undefined) picked.add(p.nightPick);
        }
        return [...picked].sort((a, b) => a - b);
      };
      const picks: SpectatePicks = { mafia: picksOf("mafia"), police: picksOf("police"), doctor: picksOf("doctor") };
      view.spectate.picks = picks;
    }
  }
  return view;
}
