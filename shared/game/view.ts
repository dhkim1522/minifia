// 연결별 공개 뷰. 공개 항목은 허용 목록(다섯 키 객체 리터럴, alive 는 공개 정보)으로만 만든다 — Player 를 펼쳐 복사하지 않는다.
// 관전(결정 0021): 탈락한 본인에게만 모든 실제 직업과 그 밤의 행동 대상. 살아 있는 사람에게는 어떤 키로도 싣지 않는다 —
// 결정 0002 를 "살아 있는 사람에게는 보내지 않는다" 로 좁혀 유지. 직업 키 이름은 role 이 아니라 job 이다(누출 검사가 role 키를 me 밖에서 금지).
// 밤 필드 받는 사람: pick 본인(생존·밤), allyPicks 생존 마피아(밤), records 경찰(수사)·마피아(암살)·의사(치료) 본인 중 본인 역할 일지 하나(역할 공개 단계 전체), morning 모두(아침만).
// 투표 필드 받는 사람(4페이즈): execTally 모두에게 같은 값(execVote 단계만), voteAgree 본인(생존·execVote), voteTarget 본인(생존·candidateVote), voteLog 모두(낮 단계마다 항상, 집계 수만),
// candidate 모두(공개 구간·변론·처형, 후보가 있을 때), execution 모두(처형 단계만, seat·phrase), noExecution 모두(처형 무효로 온 밤만, reason 하나).
// result(승리 팀·모든 직업·판 요약)는 ended 단계에서만, 생존·탈락 구분 없이 모두에게 같게(D-17). 서버 전용 밤 기록(nightLog)은 buildSummary 만 읽고 판 중에는 어떤 view 에도 없다(결정 0020-3).
// 남의 여부 표·후보 선택은 어떤 키로도 싣지 않는다 — Player.execVote 는 마감 훅이, Player.candidateVote 는 공개 구간 진입 훅이 키째 지운다(결정 0034·D-02·D-19).
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
  VoteLogEntry,
} from "../protocol";
import { MAX_PLAYERS, MIN_PLAYERS } from "../protocol";
import { isAlive } from "./alive";
import { botCount } from "./bots";
import { currentClaimSeat } from "./claim";
import { phaseDurationOf } from "./discussion";
import { buildSummary } from "./endgame";
import { noExecutionOf } from "./execution";
import { PHASE_DEFS } from "./phases";
import { rolesInPlay } from "./roles";
import { hostOf } from "./room";
import type { RoomState } from "./room";
import { execTallyOf } from "./vote";

/**
 * view.day 가 생기는 단계: 낮 세 단계·처형 다섯 단계·밤·아침·종료. 이 밖의 단계 뷰에는 day 키 자체가 없다(D-07).
 * ended 도 넣는다: day 에는 공개 정보(일차·구성·주장 기록·투표 기록)만 있어 누출이 없고, 결과 화면이 테이블을 다시 쓸 수 있다.
 */
const DAY_PHASES: ReadonlySet<PhaseId> = new Set([
  "dayAnnounce",
  "claim",
  "discussion",
  "execVote",
  "candidateVote",
  "candidateVoteReveal",
  "defense",
  "execution",
  "night",
  "morning",
  "ended",
]);

/** 투표 기록 한 줄을 필드별로 복사한다(펼쳐 복사 금지): exec 는 yes·no·passed 세 키, cand 는 있을 때만 votes 를 {seat, target} 으로, candidate 는 있을 때만. */
function voteLogLine(entry: VoteLogEntry): VoteLogEntry {
  const line: VoteLogEntry = { n: entry.n, exec: { yes: entry.exec.yes, no: entry.exec.no, passed: entry.exec.passed } };
  if (entry.cand !== undefined) {
    line.cand = { votes: entry.cand.votes.map((v) => ({ seat: v.seat, target: v.target })) };
    if (entry.cand.candidate !== undefined) line.cand.candidate = entry.cand.candidate;
  }
  return line;
}

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
    voteLog: (state.voteLog ?? []).map(voteLogLine),
  };
  // 실시간 집계는 모든 viewer 에게 같은 값이다 — 마감 집계와 같은 함수(execTallyOf)를 쓴다.
  if (state.phase === "execVote") day.execTally = execTallyOf(state);
  // 후보·처형 발표는 모두에게 같다(공개 정보). 직업은 싣지 않는다 — 필드별로 복사한다(D-09).
  if (
    (state.phase === "candidateVoteReveal" || state.phase === "defense" || state.phase === "execution") &&
    state.verdict?.candidate !== undefined
  ) {
    day.candidate = state.verdict.candidate;
  }
  if (state.phase === "execution" && state.execution !== undefined) {
    day.execution = { seat: state.execution.seat, phrase: state.execution.phrase };
  }
  // 처형이 성립하지 않아 밤으로 온 그 밤에만, 이유 코드 하나(D-34). 공개 투표 기록에서 파생해 새 상태 필드가 없다.
  const noExecution = noExecutionOf(state);
  if (noExecution !== undefined) day.noExecution = { reason: noExecution.reason };
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

  // 여부 표는 본인에게만(D-02) — 생존한 본인이 execVote 단계에서 던진 값이 있을 때만 키를 만든다. 남의 값은 어떤 키로도 싣지 않는다.
  if (state.phase === "execVote" && isAlive(me) && me.execVote !== undefined) {
    myInfo.voteAgree = me.execVote;
  }

  // 후보 선택 값은 본인에게만(D-19, A7) — 생존한 본인이 candidateVote 단계에서 고른 값이 있을 때만 키를 만든다. 남의 값은 어떤 키로도 싣지 않는다.
  if (state.phase === "candidateVote" && isAlive(me) && me.candidateVote !== undefined) {
    myInfo.voteTarget = me.candidateVote;
  }

  // 동료가 고른 대상은 밤에 살아 있는 마피아에게만, 대상 seat 집합으로만(누가 골랐는지는 없다, D-07). 탈락한 마피아는 allies 만 받는다(A3).
  if (state.phase === "night" && isAlive(me) && me.role === "mafia") {
    const picked = new Set<number>();
    for (const q of state.players) {
      if (q.role === "mafia" && q.id !== me.id && isAlive(q) && q.nightPick !== undefined) picked.add(q.nightPick);
    }
    myInfo.allyPicks = [...picked].sort((a, b) => a - b);
  }

  // 일지는 본인 역할의 것 하나만, 본인에게만, 역할을 싣는 모든 단계에서 탈락한 뒤에도(D-09·D-10·D-11, 결정 0026-7).
  // 줄마다 키를 하나씩 써서 만든다(펼쳐 복사 금지): 경찰 isMafia·마피아 died 는 불리언 한 비트, 직업 이름은 어느 줄에도 없다.
  if (def.revealsOwnRole && me.role === "police") {
    myInfo.records = (me.investigations ?? []).map((r) => ({ n: r.n, target: r.target, isMafia: r.isMafia }));
  } else if (def.revealsOwnRole && me.role === "mafia") {
    myInfo.records = (me.assassinations ?? []).map((r) => ({ n: r.n, target: r.target, died: r.died }));
  } else if (def.revealsOwnRole && me.role === "doctor") {
    myInfo.records = (me.treatments ?? []).map((r) => ({ n: r.n, target: r.target }));
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

  // 결과는 ended 단계에서만 모두에게 같다(D-17). seats 는 관전자 전용 spectate.seats 와 같은 방식으로 따로 만든다 — spectate 규칙은 그대로 둔다.
  if (state.phase === "ended" && state.winner !== undefined) {
    const seats: SpectateSeat[] = [];
    for (const p of [...state.players].sort((a, b) => a.seat - b.seat)) {
      if (p.role !== undefined) seats.push({ seat: p.seat, job: p.role });
    }
    view.result = { winner: state.winner, seats, summary: buildSummary(state) };
  }

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
