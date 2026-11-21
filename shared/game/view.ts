// 연결별 공개 뷰. 공개 항목은 허용 목록(다섯 키 객체 리터럴, alive 는 공개 정보)으로만 만든다 — Player 를 펼쳐 복사하지 않는다.
// 관전(결정 0021): 탈락한 본인에게만 모든 실제 직업과 그 밤의 행동 대상. 살아 있는 사람에게는 어떤 키로도 싣지 않는다 —
// 결정 0002 를 "살아 있는 사람에게는 보내지 않는다" 로 좁혀 유지. 직업 키 이름은 role 이 아니라 job 이다(누출 검사가 role 키를 me 밖에서 금지).
// 밤 필드 받는 사람: pick 본인(생존·밤), allyPicks 생존 마피아(밤), records 경찰(수사)·마피아(암살)·의사(치료) 본인 중 본인 역할 일지 하나(역할 공개 단계 전체), morning 모두(아침만).
// 낮 필드 받는 사람(8페이즈): points 모두(지목 단계만, 공개 지목 줄), endCount 모두(토론 단계만, 누른 수뿐), verdictCount 모두(찬반 단계만, 찬성·반대 수뿐 — 던진 좌석은 싣지 않는다, D-26), turn 모두(지목 단계만, 차례 순서·마감·확정, 역할 무관),
// me.endDiscussion·me.verdictVote 본인만(각각 토론·찬반 단계). 지목·찬반 기록(옛 voteLog·verdict·찬반 좌석 목록)은 어떤 view 에도 없다(22-12 D-14·D-25),
// candidate 모두(변론·처형, 변론자가 있을 때 — 찬반에는 후보가 없다), execution 모두(처형 단계만, seat·will — will 은 비어 있지 않을 때만), noExecution 모두(처형 무효로 온 밤만, reason 하나).
// result(승리 팀·모든 직업·판 요약)는 ended 단계에서만, 생존·탈락 구분 없이 모두에게 같게(D-17). 서버 전용 밤 기록(nightLog)은 buildSummary 만 읽고 판 중에는 어떤 view 에도 없다(결정 0020-3).
// 기본판(결정 0072): 꺼진 장치 키(players[].badge·badgeSwapped, day.turn·runoff·showdown, me.whisperUsed·ballot)는 서버 상태에 값이 있어도(옛 저장 방 포함) 싣지 않는다 — 판 규칙 RULES 가 막는다.
// 남의 지목·찬반 값·토론 끝내기 누름은 어떤 키로도 싣지 않는다 — Player.nominate·verdictVote 는 마감 훅이 키째 지운다(결정 0060·D-02).
import type {
  DayView,
  KeywordPresentation,
  KeywordView,
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
import { channelOf } from "./audience";
import { botCount } from "./bots";
import { ROOM_MAP_ID } from "./maps";
import { phaseDurationOf } from "./discussion";
import { buildSummary } from "./endgame";
import { noExecutionOf } from "./execution";
import { answerOpenOf } from "./keywordAnswer";
import { keywordPresentationOf } from "./keywordPresentation";
import { genreLabelOf } from "./keywords";
import { MAP_PHASES } from "./movement";
import { confirmedTarget } from "./night";
import { pointLinesOf, turnViewOf } from "./nomination";
import { runoffVotersOf, runoffViewOf } from "./runoff";
import { showdownViewOf } from "./showdown";
import { PHASE_DEFS } from "./phases";
import { phaseSkipOpensAt, phaseSkipStatus } from "./phaseSkip";
import { firstBallotCount, firstPlaytestDay } from "./playtest";
import { RULES } from "./ruleset";
import { isReady } from "./rematch";
import { rolesInPlay } from "./roles";
import { hostOf, roundOf } from "./room";
import type { Player, RoomState } from "./room";
import { verdictTallyOf, verdictVotersOf } from "./verdict";
import { WHISPER_PER_DAY, whisperUsedToday } from "./whisper";

/**
 * view.day 가 생기는 단계: 낮 단계(발표·토론·지목·변론·찬반·처형)·밤·아침·종료. 이 밖의 단계 뷰에는 day 키 자체가 없다(D-07).
 * ended 도 넣는다: day 에는 공개 정보(일차·구성·투표 기록)만 있어 누출이 없고, 결과 화면이 테이블을 다시 쓸 수 있다.
 */
const DAY_PHASES: ReadonlySet<PhaseId> = new Set([
  "answerReveal", // 첫날 정답 공개(23-05, D-23): 정답이 열리는 단계 — 처형 뒤 밤 직전
  "keyword", // 첫날 키워드(D-23): view.day 가 있어야 day.keyword(장르 라벨)를 싣는다. 클라이언트 걷기·채팅 집합(MAP_PHASES·CHAT_PHASES)에는 넣지 않는다(D-01).
  "dayAnnounce",
  "discussion",
  "nomination",
  "runoff",
  "showdown",
  "verdict",
  "defense",
  "execution",
  "night",
  "morning",
  "ended",
]);

/**
 * 낮 정보. 허용 목록 리터럴로만 만든다 — 조건을 채울 때만 키를 만들고, 서버 전용 필드는 싣지 않는다.
 * 읽는 쪽이 기본값을 쥔다: 일차 없으면 1(RESEARCH Pattern 6).
 */
function buildDay(state: RoomState, presentation: KeywordPresentation | undefined, phaseSkip: RoomView["phaseSkip"]): DayView {
  const day: DayView = {
    n: state.day ?? 1,
    roles: rolesInPlay(state.players.length),
  };
  const revealAnswer = answerOpenOf(state);
  // 입력·발표·정답 공개를 분리한다. 발표에서는 현재 답 한 줄만 공개한다.
  if (state.keyword !== undefined && (state.phase === "keyword" || revealAnswer || presentation !== undefined)) {
    const kw: KeywordView = { genre: genreLabelOf(state.keyword.genre) ?? "" };
    if (presentation !== undefined) kw.presentation = presentation;
    if (revealAnswer) kw.answer = state.keyword.word;
    day.keyword = kw;
  }
  // 이전 클라이언트의 토론 버튼에도 같은 건너뛰기 집계를 보낸다.
  if (state.phase === "discussion") {
    day.endCount = phaseSkip?.count ?? 0;
    if (firstPlaytestDay(state) && phaseSkip !== undefined) {
      day.voteOpensAt = phaseSkip.opensAt;
      day.voteReadyRequired = phaseSkip.total;
      day.voteReadyTotal = phaseSkip.total;
    }
  }
  // 찬반은 집계 수(찬성·반대)만 모두에게 공개한다(D-11) — 던진 좌석(옛 day.voted)은 싣지 않는다: 좌석과 수가 함께 보이면 첫 투표자의 표가 추론된다(D-26).
  // 개인 값은 me.verdictVote 로 본인에게만 간다. 필드별 복사라 voters 같은 다른 키가 새지 않는다.
  if (firstPlaytestDay(state) && state.firstBallotOutcome !== undefined) {
    const { count, result: { target, votes, holds, reason } } = state.firstBallotOutcome;
    day.firstBallot = { count, result: { target, votes, holds, ...(reason === undefined ? {} : { reason }) } };
  } else if (state.phase === "verdict" && firstPlaytestDay(state)) {
    day.firstBallot = { count: firstBallotCount(state) };
  } else if (state.phase === "verdict") {
    const tally = verdictTallyOf(state);
    day.verdictCount = { yes: tally.yes, no: tally.no };
  }
  // 지목 줄은 지목 단계 동안 모두에게 같은 공개 목록이다(결정 0060-3) — 필드별 복사 함수(pointLinesOf)로 만든다.
  if (state.phase === "nomination") day.points = pointLinesOf(state);
  // 순차 지목의 차례 정보(결정 0063-1)도 모두에게 같다 — 필드별 복사(turnViewOf), 역할·연결을 읽지 않는다(L14).
  if (RULES.pickTurn && state.phase === "nomination") {
    const turn = turnViewOf(state);
    if (turn !== undefined) day.turn = turn;
  }
  // 동점 결선(결정 0066-4)의 공개 값은 모두에게 같다 — 마감 전엔 던진 좌석(voted)뿐, 마감 뒤엔 득표 수(tally)뿐이다. 개인 선택은 me.ballot 으로 본인에게만(L20).
  if (RULES.runoff && state.phase === "runoff") {
    const runoff = runoffViewOf(state);
    if (runoff !== undefined) day.runoff = runoff;
  }
  // 마지막 3인 결전(결정 0066-5)의 공개 값은 모두에게 같다 — 진행·확정된 한마디, 지목 중엔 던진 좌석(voted)뿐, 공개 뒤엔 지목 줄(points)이다. 개인 선택은 me.ballot 으로 본인에게만(L21).
  if (RULES.showdown && state.phase === "showdown") {
    const showdown = showdownViewOf(state);
    if (showdown !== undefined) day.showdown = showdown;
  }
  // 후보(처형자)·처형 발표는 모두에게 같다(공개 정보). 찬반(verdict)에는 후보가 없다(D-11). 직업은 싣지 않는다 — 필드별로 복사한다(D-09).
  if ((state.phase === "defense" || state.phase === "execution") && state.verdict?.candidate !== undefined) {
    day.candidate = state.verdict.candidate;
  }
  if (state.phase === "execution" && state.execution !== undefined) {
    day.execution = { seat: state.execution.seat };
    // 유언 공개(22-12 Pattern 6, P22-11): 처형자의 유언은 이 순간 모두에게 같은 공개 값이고 역할과 무관하다. 비어 있지 않을 때만 키를 만든다 — 빈 유언은 키가 없다(화면이 "말없이 떠났어요").
    // 값은 서버가 저장 때 정리한 글(sanitizeChatText)이다. 처형 단계 밖의 view 에는 어디에도 없다.
    const will = state.players.find((p) => p.seat === state.execution!.seat)?.will;
    if (will !== undefined && will !== "") day.execution.will = will;
  }
  // 처형이 성립하지 않아 밤으로 온 그 밤에만, 이유 코드 하나(D-34). 공개 투표 기록에서 파생해 새 상태 필드가 없다.
  const noExecution = noExecutionOf(state);
  if (noExecution !== undefined) day.noExecution = { reason: noExecution.reason };
  if (state.phase === "morning") {
    // 아침 결과는 모두에게 같은 값이다. 탈락자가 있을 때만 eliminated, 의사 구출일 때만 saved 를 만들고 값은 필드별로 복사한다(지목 없음·불일치는 {}, 결정 0061-12).
    const morning: MorningView = {};
    const result = state.morning;
    if (result?.eliminated !== undefined) {
      morning.eliminated = result.eliminated;
    } else if (result?.saved === true) {
      // 의사 구출은 saved 하나만 공개한다 — 보호받은 사람이 누구인지·쪽지는 어디에도 싣지 않는다(결정 0061-12, 0044-22).
      morning.saved = true;
    }
    day.morning = morning;
  }
  // 암살 현장 분필(MORN-01, 결정 0061-14): 방 DO 가 채운 좌표를 그날 낮 동안 모두에게 같은 값으로 싣는다. 필드별 복사이고, 없으면 키 자체가 없다.
  // 구출·무효 밤에는 DO 가 채우지 않으므로 어디에도 드러나지 않는다(결정 0044-22). 다음 밤 진입 훅이 지운다.
  if (state.chalk !== undefined) day.chalk = { x: state.chalk.x, z: state.chalk.z };
  // 의심 포스트잇(결정 0089-10, D-06·D-07): 오늘 줄(suspects, 배열 순서 = 쌓는 순서)과 판 내내 전체 기록(suspectLog)은 모두에게 같은 공개 값이다. 줄마다 필드별 리터럴로 복사하고 줄이 없으면 키가 없다.
  // 새 일차 진입에서 n === day 필터로 종이가 비어 떨어진다. 판 규칙 스위치로 막지 않는다(늘 켜짐).
  const today = state.day ?? 1;
  const notes = state.notes ?? [];
  const todayNotes = notes.filter((x) => x.n === today && x.removed !== true);
  if (todayNotes.length > 0) day.suspects = todayNotes.map((x) => ({ to: x.to, from: x.from }));
  if (notes.length > 0) day.suspectLog = notes.map((x) => ({ n: x.n, from: x.from, to: x.to }));
  return day;
}

/**
 * 비인증 미리보기(4자리 코드만 알면 받는 응답). 객체 리터럴 허용 목록으로만 만든다 — Player 를 펼쳐 복사하지 않는다.
 * 앉은 사람 목록은 대기실에서만 채우고, 그 밖의 단계에서는 빈 배열이다. 역할·토큰·내부 id·연결 상태는 어디에도 싣지 않는다.
 */
export function buildPreview(state: RoomState): RoomPreview {
  const players: PreviewPlayer[] =
    state.phase === "lobby"
      ? [...state.players].sort((a, b) => a.seat - b.seat).map((p) => ({
          seat: p.seat,
          nickname: p.nickname,
          ...(p.animal === undefined ? {} : { animal: p.animal }),
        }))
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

/**
 * 쉬는 사람(bench)의 view(결정 D-13, 누설 L38, T-11-25). 허용 키만 키 하나씩 써서 만든다 — 게임 상태(day·result·spectate·다른 사람)를 읽지 않는다:
 * 단계·판 번호·맵 같은 공개 값과 자기 한 줄(공개 외형 포함)뿐이다. 마감 시각은 null 이다(게임 시계는 이들의 일이 아니다).
 */
function buildRestingView(state: RoomState, resting: Player, now: number): RoomView {
  const row: PublicPlayer = { seat: resting.seat, nickname: resting.nickname, connected: true, isHost: false };
  if (resting.look !== undefined) row.look = resting.look;
  if (resting.animal !== undefined) row.animal = resting.animal;
  const view: RoomView = {
    code: state.code,
    phase: state.phase,
    ...(state.playtest === true ? { playtest: true as const } : {}),
    round: roundOf(state),
    phaseEndsAt: null,
    phaseDurationMs: null,
    serverNow: now,
    minPlayers: MIN_PLAYERS,
    maxPlayers: MAX_PLAYERS,
    players: [row],
    me: { seat: resting.seat, isHost: false },
    mapChoice: ROOM_MAP_ID,
    resting: true,
  };
  if (state.phase !== "lobby") view.map = ROOM_MAP_ID;
  return view;
}

export function buildView(state: RoomState, playerId: string, now: number): RoomView {
  const resting = state.bench?.find((p) => p.id === playerId);
  if (resting !== undefined) return buildRestingView(state, resting, now);
  const me = state.players.find((p) => p.id === playerId);
  if (!me) throw new Error("buildView: player is not in this room");
  const presentation = keywordPresentationOf(state, now);
  const skipOpensAt = phaseSkipOpensAt(state);
  const skipStatus = skipOpensAt === undefined ? undefined : phaseSkipStatus(state, playerId);
  const phaseSkip = skipOpensAt !== undefined && skipStatus !== undefined && skipStatus.total > 0
    ? { opensAt: skipOpensAt, count: skipStatus.count, total: skipStatus.total, canVote: skipStatus.canVote }
    : undefined;
  // 판 규칙은 상수 RULES 하나다 — 꺼진 장치의 키는 서버 상태에 값이 있어도 싣지 않는다(값이 빈 것이 아니라 키가 없다).

  const players: PublicPlayer[] = [...state.players]
    .sort((a, b) => a.seat - b.seat)
    .map((p) => {
      const row: PublicPlayer = {
        seat: p.seat,
        nickname: p.nickname,
        connected: p.connected,
        isHost: p.id === state.hostId,
        alive: isAlive(p), // 탈락 여부는 공개 정보다(ELIM-01)
      };
      // 공개 의상(결정 D-6): 값이 있을 때만 키를 만든다(모든 단계 — 게임 중에도 같은 look 을 입는다). 실제 역할의 함수가 아니다.
      if (p.look !== undefined) row.look = p.look;
      if (p.animal !== undefined) row.animal = p.animal;
      // 다시 하기 준비(결정 D-12, 11-08): 결과 단계의 연결돼 있고 나가지 않은 사람이 준비일 때만(방장·봇은 늘 준비). 값은 true 뿐이고 누가 보든 같다 — 역할의 함수가 아니다.
      if (state.phase === "ended" && p.connected && p.left !== true && isReady(p, state.hostId)) row.ready = true;
      // 쉬었다가 결과에 합류한 사람(결정 D-13): 역할이 없다는 사실만 공개한다.
      if (p.sat === true) row.sat = true;
      // 공개 직업 주장(결정 0066-1): 산 사람이고 값이 있을 때만 키를 만든다. 실제 역할이 아니고 badgeLog(서버 전용)는 어떤 경로로도 싣지 않는다.
      if (RULES.badge && isAlive(p) && p.badge !== undefined && DAY_PHASES.has(state.phase)) {
        row.badge = p.badge;
        if (p.badgeSwapped === true) row.badgeSwapped = true; // 말 바꿈은 사실 하나 — 이전 값은 싣지 않는다
      }
      return row;
    });

  // 내 정보도 허용 목록으로만 만든다. role·allies 는 조건을 채울 때만 키 자체를 만든다(undefined 로 남기지 않는다).
  const myInfo: MyInfo = { seat: me.seat, isHost: me.id === state.hostId };
  if (state.phase === "roleReveal" && me.roleReady === true) myInfo.roleReady = true;
  if (firstPlaytestDay(state) && state.phase === "verdict" && state.firstBallotOutcome === undefined && isAlive(me) && me.firstBallot !== undefined) {
    myInfo.firstBallot = me.firstBallot;
  }
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

  // 키워드는 keyword 단계의 산 시민 편(경찰·의사·시민) 본인에게만(D-06, T-23-01) — 역할이 있고 마피아가 아닐 때만 키를 만든다.
  // 마피아·탈락자·다른 단계의 view 에는 키 자체가 없다(값이 빈 것이 아니라 키가 없다).
  if (state.phase === "keyword" && state.keyword !== undefined && isAlive(me) && me.role !== undefined && me.role !== "mafia") {
    myInfo.keyword = state.keyword.word;
  }
  // 내 답(P23-13 재접속 복원): keyword 단계에서만, 본인의 확정(answerSubmits 의 내 좌석)이 우선이고 없으면 쓰던 글(초안). 값이 있을 때만 키를 만든다.
  // 남의 초안·확정은 어느 view 에도 없다 — 이 조각만 본인 좌석의 값을 읽는다.
  if (state.phase === "keyword" && isAlive(me)) {
    const mine = state.answerSubmits?.find((a) => a.seat === me.seat);
    if (mine !== undefined) myInfo.answer = { text: mine.text, final: true };
    else if (me.answerDraft !== undefined) myInfo.answer = { text: me.answerDraft, final: false };
  }

  // 내 채널은 서버가 보낸 사람 상태로 정한 값(channelOf) 그대로 본인에게만 싣는다(07-10). 말할 수 없으면(밤의 산 비마피아·채팅 단계 밖) 키 자체가 없다.
  // 결과 단계(11-03, D-11)만 예외다: channelOf 는 ended 에서 null 이지만 모두가 all 한 줄을 보낼 수 있으니 all 을 직접 싣는다.
  const ch = state.phase === "ended" ? "all" : channelOf(state, me.id);
  if (ch !== null) myInfo.chat = ch;

  // 테스트 방 방장 본인에게만(결정 0022): testMode 는 버튼을 그리는 방장만 알면 되고, testRole 은 시트의 '내 직업' 칸이 있는 대기실에서만 실린다.
  // 손님 view·미리보기에는 키 자체가 없다 — 불리언과 방장 본인의 선택뿐이라 역할·토큰과 무관하다.
  if (state.testMode === true && me.id === state.hostId) {
    myInfo.testMode = true;
    if (state.phase === "lobby" && state.testRole !== undefined) myInfo.testRole = state.testRole;
    // 봇 투표 규칙(P-13)은 시트의 '봇 투표' 줄이 있는 대기실에서만, 무작위가 아닌 값이 있을 때만. 상태 객체를 펼치지 않고 두 값을 필드별로 읽는다.
    if (state.phase === "lobby" && state.testBotVote !== undefined) {
      const { exec, pick } = state.testBotVote;
      if (exec !== undefined || pick !== undefined) myInfo.testBotVote = { exec: exec ?? "random", pick: pick ?? "random" };
    }
  }

  // 서버 봇 수는 방장 본인의 대기실 view 에서만, 0 포함 항상 숫자로(결정 0024). 결정 0075 부터 일반 방 방장도 받는다([봇] 버튼).
  // isBot·botPlan·봇 id 는 어디에도 싣지 않는다.
  if (me.id === state.hostId && state.phase === "lobby") myInfo.testBots = botCount(state);

  // 본인 선택은 본인에게만(D-06) — 남의 nightPick 은 어떤 키로도 싣지 않는다. 밤에 살아 있는 본인이 고른 값이 있을 때만 키를 만든다.
  if (state.phase === "night" && isAlive(me) && me.nightPick !== undefined) {
    myInfo.pick = me.nightPick;
  }
  if (state.playtest === true && state.phase === "night" && isAlive(me) && me.role === "citizen" && me.nightDone === true) {
    myInfo.nightDone = true;
  }

  // 마피아 집계(결정 0061-7, L8)는 밤에 산 마피아 본인에게만: 앉은 산 비마피아별 산 마피아 선택 수(seat 오름차순, 본인 포함)와 전원 일치로 확정된 대상.
  // 누가 골랐는지는 싣지 않는다(D-07). 다른 신분·유령·낮·아침 view 에는 두 키 자체가 없다. 저장된 선택은 집계 때 다시 검증한다(탈락자·마피아는 세지 않는다).
  if (state.phase === "night" && isAlive(me) && me.role === "mafia") {
    const counts = new Map<number, number>();
    for (const q of state.players) {
      if (q.role !== "mafia" || !isAlive(q) || q.nightPick === undefined) continue;
      const t = state.players.find((r) => r.seat === q.nightPick);
      if (t === undefined || !isAlive(t) || t.role === "mafia") continue;
      counts.set(t.seat, (counts.get(t.seat) ?? 0) + 1);
    }
    myInfo.nightTally = [...counts].sort((a, b) => a[0] - b[0]).map(([seat, n]) => ({ seat, n }));
    const sure = confirmedTarget(state);
    if (sure !== undefined) myInfo.nightSure = sure;
  }

  // 유언은 지도 단계의 산 본인에게만(결정 0061-10, A4). 저장된 값이 있을 때만 키를 만든다 — 다른 사람 view 어디에도 본문이 없다(L7).
  if (MAP_PHASES.has(state.phase) && isAlive(me) && me.will !== undefined) {
    myInfo.will = me.will;
  }

  // 쪽지는 밤의 산 마피아에게만, 마피아끼리 같은 글이다(결정 0061-9). 작성자는 어디에도 없다. 유령·시민 편·아침 view 에는 키 자체가 없다.
  if (state.phase === "night" && isAlive(me) && me.role === "mafia" && state.nightNote !== undefined) {
    myInfo.note = state.nightNote;
  }

  // 내가 오늘 붙인 의심 대상. 공개 차례와 토론의 생존자 본인에게 보낸다.
  if ((state.phase === "discussion" || presentation !== undefined) && isAlive(me)) {
    const mine = (state.notes ?? []).find((x) => x.n === (state.day ?? 1) && x.from === me.seat && x.removed !== true);
    if (mine !== undefined) myInfo.suspectTo = mine.to;
  }

  // 귓속말 사용함 표시는 본인에게만(결정 0066-2) — discussion 의 산 본인이 오늘 이미 보냈을 때만 키를 만든다. 본문·상대는 어떤 view 에도 없다(whispers 는 서버 전용).
  if (RULES.whisper && state.phase === "discussion" && isAlive(me) && whisperUsedToday(state, me.seat) >= WHISPER_PER_DAY) {
    myInfo.whisperUsed = true;
  }

  if (phaseSkip !== undefined && skipStatus?.pressed) {
    myInfo.phaseSkip = true;
    if (state.phase === "discussion") myInfo.endDiscussion = true;
  }

  // 찬반 값은 본인에게만(결정 0053·0060-4, T-08-02) — verdict 단계에서 유권자(산 사람 전원 — 찬반에는 후보가 없다, D-11)인 본인이 던진 값이 있을 때만 키를 만든다. 남의 값은 어떤 키로도 싣지 않는다.
  if (state.phase === "verdict" && me.verdictVote !== undefined && verdictVotersOf(state).some((p) => p.id === me.id)) {
    myInfo.verdictVote = me.verdictVote;
  }

  // 결선 선택은 본인에게만(결정 0066-4, L20) — runoff 의 투표 창·결과 단계에서 산 유권자 본인이 던진 값이 있을 때만 키를 만든다. 후보·유령·미투표자에는 키가 없다.
  if (
    RULES.runoff &&
    state.phase === "runoff" &&
    state.runoff !== undefined &&
    state.runoff.step >= 1 &&
    me.runoffVote !== undefined &&
    runoffVotersOf(state).some((p) => p.id === me.id)
  ) {
    myInfo.ballot = me.runoffVote;
  }

  // 마지막 3인 동시 지목 선택은 본인에게만(결정 0066-5, L21) — showdown 의 지목 창·공개 단계에서 산 본인이 던진 값이 있을 때만 키를 만든다. 유령·미투표자에는 키가 없다.
  if (
    RULES.showdown &&
    state.phase === "showdown" &&
    state.showdown !== undefined &&
    state.showdown.i >= 3 &&
    me.showdownPick !== undefined &&
    isAlive(me) &&
    state.showdown.order.includes(me.seat)
  ) {
    myInfo.ballot = me.showdownPick;
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
    ...(state.playtest === true ? { playtest: true as const } : {}),
    round: roundOf(state),
    phaseEndsAt: state.phaseEndsAt,
    ...(state.phaseStartsAt !== undefined ? { phaseStartsAt: state.phaseStartsAt } : {}),
    phaseDurationMs: phaseDurationOf(state), // 단계 표 길이 — 파생은 한 곳(discussion.ts)
    ...(phaseSkip !== undefined ? { phaseSkip } : {}),
    serverNow: now,
    minPlayers: MIN_PLAYERS,
    maxPlayers: MAX_PLAYERS,
    players,
    me: myInfo,
    // 이전 클라이언트는 공개 mapChoice 를 읽는다. 결정 맵은 시작 뒤에만 보낸다.
    mapChoice: ROOM_MAP_ID,
  };
  if (state.phase !== "lobby") view.map = ROOM_MAP_ID;
  if (DAY_PHASES.has(state.phase)) view.day = buildDay(state, presentation, phaseSkip);
  if (state.phase === "lobby" && state.bench !== undefined) {
    const reservedAnimals = state.bench.flatMap((p) => p.animal === undefined ? [] : [p.animal]).sort();
    if (reservedAnimals.length > 0) view.reservedAnimals = reservedAnimals;
  }

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
