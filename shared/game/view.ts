// 연결별 공개 뷰. 공개 항목은 허용 목록(네 키 객체 리터럴)으로만 만든다 — Player 를 펼쳐 복사하지 않는다.
import type { DayView, MyInfo, PhaseId, PreviewPlayer, PublicPlayer, RoomPreview, RoomView } from "../protocol";
import { MAX_PLAYERS, MIN_PLAYERS } from "../protocol";
import { currentClaim } from "./claim";
import { phaseDurationOf } from "./discussion";
import { PHASE_DEFS } from "./phases";
import { rolesInPlay } from "./roles";
import { hostOf } from "./room";
import type { RoomState } from "./room";

/** view.day 가 생기는 단계. 이 밖의 단계 뷰에는 day 키 자체가 없다(D-07). */
const DAY_PHASES: ReadonlySet<PhaseId> = new Set(["dayAnnounce", "claim", "claimReveal", "discussion"]);

/**
 * 낮 정보. 단계 조건부 허용 목록 리터럴로만 만든다 — 조건을 채울 때만 키를 만들고, 서버 전용 필드(Player 의 선택·직전 공개 값)는
 * 펼쳐 복사하지 않는다. claim 단계에는 직접 고른 사람의 seat(claimDone)만 싣는다: 마감 전 남의 선택은 어떤 키로도 나가지 않는다(D-01, D-03).
 * 읽는 쪽이 기본값을 쥔다: 일차 없으면 1(RESEARCH Pattern 6).
 */
function buildDay(state: RoomState): DayView {
  const day: DayView = { n: state.day ?? 1, roles: rolesInPlay(state.players.length) };
  if (state.phase === "claim") {
    day.claimDone = state.players
      .filter((p) => p.claimChoice !== undefined)
      .map((p) => p.seat)
      .sort((a, b) => a - b);
  }
  if (state.phase === "claimReveal" || state.phase === "discussion") {
    // 공개 뒤에는 모두에게 같은 값이 간다. 값은 공개 필드(claimShown·claimChanged)만 읽고, 옛 플레이어는 기본값을 쥔다(D-04, D-06, D-08).
    day.claims = [...state.players]
      .sort((a, b) => a.seat - b.seat)
      .map((p) => ({ seat: p.seat, claim: p.claimShown ?? "none", changed: p.claimChanged ?? false }));
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

  // 내 주장은 claim 단계에서만, 본인 값만 싣는다. 본인 값도 currentClaim(직접 고른 값 → 어제 공개 값)을 거쳐서만 읽는다(D-09).
  if (state.phase === "claim") {
    const mine = currentClaim(me);
    if (mine !== undefined) myInfo.claim = mine;
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
  return view;
}
