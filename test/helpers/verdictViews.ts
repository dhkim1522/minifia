// 테스트 전용(04-28): 처형 구간 단계 × 보는 사람 상태 × 인원으로 RoomView 와 연결 모킹 값을 만든다.
// 서버 규칙을 흉내 내지 않는다 — 서버가 단계마다 싣는 필드를 손으로 채울 뿐이다. 승패·투표 통과 같은 판정은 만들지 않고 고정 값을 둔다.
// 닉네임은 모두 5글자(가장 긴 이름표 폭), 투표 줄은 서버 순서처럼 고정된 배열이다(여기서 섞거나 정렬하지 않는다).
import type { RoleId } from "../../shared/game/roles";
import type { CandidateVoteLine, PhaseId, RoomView, SpectateSeat, VoteLogEntry } from "../../shared/protocol";
import type { RoomConnection } from "../../src/net/useRoomConnection";

export const NOW = 1_700_000_000_000;

/** 처형 구간 화면 일곱: 여섯 단계 + 처형 무효로 온 밤 */
export const STAGES = ["execVote", "candidateVote", "candidateVoteReveal", "defense", "execution", "ended", "noExecution"] as const;
export type VerdictStage = (typeof STAGES)[number];

/** 보는 사람 상태 여섯 */
export const VIEWERS = ["alive", "spectator", "selfOffline", "otherOffline", "mafiaAlly", "rejoin"] as const;
export type Viewer = (typeof VIEWERS)[number];

export const COUNTS = [4, 8] as const;
export type Count = (typeof COUNTS)[number];

/** 5글자 닉네임 여덟 */
export const NAMES = ["지우지우지", "하윤하윤하", "민지민지민", "도현도현도", "서연서연서", "수빈수빈수", "하준하준하", "지호지호지"] as const;

/** 후보(변론·처형 대상)는 항상 1번 자리다. 남이 끊김 칸에서는 이 자리가 끊긴다. 내가 후보인 칸은 meIsCandidate */
export const CANDIDATE_SEAT = 1;

export interface FixtureOpts {
  stage: VerdictStage;
  viewer: Viewer;
  count: Count;
  /** 내가 후보인 변론·공개·처형 화면(후보 본인의 변론 칩 6개, 기본 false) */
  meIsCandidate?: boolean;
}

export interface VerdictFixture {
  view: RoomView;
  /** useRoomConnection 모킹 값에 덧씌울 필드(canSend·banner·epoch) */
  over: Partial<RoomConnection>;
}

/** 단계 이름으로 본 서버 단계 */
export function phaseOf(stage: VerdictStage): PhaseId {
  return stage === "noExecution" ? "night" : stage;
}

/** 같은 접속에서 이 단계로 오기 직전의 서버 단계(재접속 대조용) */
export function previousPhase(stage: VerdictStage): PhaseId {
  switch (stage) {
    case "execVote":
      return "discussion";
    case "candidateVote":
      return "execVote";
    case "candidateVoteReveal":
      return "candidateVote";
    case "defense":
      return "candidateVoteReveal";
    case "execution":
      return "defense";
    case "ended":
      return "execution";
    case "noExecution":
      return "execVote";
  }
}

// 직업표(관전자·결과 화면). 마피아는 4명 판에서 2번, 8명 판에서 2·5·6번.
function jobsOf(count: Count): SpectateSeat[] {
  const mafia = count === 4 ? [2] : [2, 5, 6];
  const rest: RoleId[] = ["citizen", "police", "citizen", "doctor", "citizen", "citizen", "citizen", "citizen"];
  return Array.from({ length: count }, (_, seat) => ({ seat, job: mafia.includes(seat) ? "mafia" : (rest[seat] ?? "citizen") }));
}

function alliesOf(count: Count): number[] {
  return count === 4 ? [2] : [2, 5, 6];
}

// 어제(1일차) 기록: 여부 투표 미통과라 후보 선택이 없다
const DAY1_LOG: VoteLogEntry = { n: 1, exec: { yes: 1, no: 3, passed: false } };

/** 후보 선택 표: 살아 있는 자리들이 고정 순서(내림차순)로 던진다. 후보는 다른 사람을, 나머지는 후보를 고른다 */
function votesOf(alive: number[], candidate: number): CandidateVoteLine[] {
  return [...alive]
    .sort((a, b) => b - a)
    .map((seat) => ({ seat, target: seat === candidate ? (alive.find((s) => s !== candidate) ?? candidate) : candidate }));
}

/**
 * 한 단계의 RoomView. phase 가 stage 의 단계가 아니어도 되도록 phase 를 따로 받는다(재접속 대조의 직전 단계).
 * 8명 판은 7번이 이미 탈락해 있다. 처형·종료에서는 후보도 탈락해 있다.
 */
export function viewAt(phase: PhaseId, opts: FixtureOpts, noExecution: boolean): RoomView {
  const { viewer, count } = opts;
  const candidate = opts.meIsCandidate === true ? 0 : CANDIDATE_SEAT;
  const dead = new Set<number>(count === 8 ? [7] : []);
  if (phase === "execution" || phase === "ended") dead.add(candidate);
  if (viewer === "spectator") dead.add(0);
  const alive = Array.from({ length: count }, (_, seat) => seat).filter((s) => !dead.has(s));

  const offline = new Set<number>();
  if (viewer === "otherOffline") offline.add(CANDIDATE_SEAT);
  if (viewer === "selfOffline") offline.add(0);

  const me: RoomView["me"] = { seat: 0, isHost: true, role: viewer === "mafiaAlly" ? "mafia" : "citizen" };
  if (viewer === "mafiaAlly") me.allies = alliesOf(count).filter((s) => s !== 0);
  if (viewer === "alive" && phase === "execVote") me.voteAgree = true;
  // 후보 선택 중 흰 후광(내 선택)과 동료 진홍 후광이 겹쳐 상한을 시험하도록, 마피아 동료도 동료가 아닌 사람(3번)을 골라 둔다
  if (viewer === "alive" && phase === "candidateVote") me.voteTarget = 2;
  if (viewer === "mafiaAlly" && phase === "candidateVote") me.voteTarget = 3;

  const log: VoteLogEntry[] = [DAY1_LOG];
  const todayVotes = votesOf(alive.filter((s) => !(phase === "execution" || phase === "ended") || s !== candidate), candidate);
  if (phase === "candidateVoteReveal" || phase === "defense" || phase === "execution" || phase === "ended") {
    log.push({ n: 2, exec: { yes: alive.length - 1, no: 1, passed: true }, cand: { votes: todayVotes, candidate } });
  }

  const durationMs = phase === "candidateVoteReveal" ? 8_000 : 10_000;
  const view: RoomView = {
    code: "0042",
    phase,
    phaseEndsAt: phase === "ended" ? null : NOW + durationMs,
    phaseDurationMs: phase === "ended" ? null : durationMs,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players: Array.from({ length: count }, (_, seat) => ({
      seat,
      nickname: NAMES[seat]!,
      connected: !offline.has(seat),
      isHost: seat === 0,
      ...(dead.has(seat) ? { alive: false } : {}),
    })),
    me,
    day: {
      n: 2,
      roles: ["mafia", "police", "citizen"],
      claimLog: [],
      voteLog: log,
      ...(phase === "execVote" ? { execTally: { yes: 2, no: 1 } } : {}),
      ...(phase === "candidateVoteReveal" || phase === "defense" || phase === "execution" ? { candidate } : {}),
      ...(phase === "execution" ? { execution: { seat: candidate, phrase: 2 } } : {}),
      ...(phase === "night" && noExecution ? { noExecution: { reason: "tie" as const } } : {}),
    },
  };
  if (viewer === "spectator") view.spectate = { seats: jobsOf(count) };
  if (phase === "ended") {
    view.result = {
      winner: "citizenWin",
      seats: jobsOf(count),
      summary: [
        { n: 1, exec: { yes: 1, no: 3, passed: false } },
        { n: 2, exec: { yes: alive.length - 1, no: 1, passed: true, candidate }, night: { target: 3, died: false } },
      ],
    };
  }
  return view;
}

/** 칸 하나: 서버 view 와 연결 값 */
export function verdictFixture(opts: FixtureOpts): VerdictFixture {
  return { view: viewAt(phaseOf(opts.stage), opts, opts.stage === "noExecution"), over: overOf(opts.viewer) };
}

/** 같은 접속의 직전 단계 view(재접속 대조) */
export function previousView(opts: FixtureOpts): RoomView {
  return viewAt(previousPhase(opts.stage), opts, false);
}

/** 보는 사람 상태가 정하는 연결 값. 재접속은 epoch 가 올라간 것으로 나타낸다 */
export function overOf(viewer: Viewer): Partial<RoomConnection> {
  if (viewer === "selfOffline") return { canSend: false, banner: "reconnecting" };
  if (viewer === "rejoin") return { epoch: 2, banner: "restored" };
  return {};
}
