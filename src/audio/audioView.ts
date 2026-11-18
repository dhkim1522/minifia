// 12-08: 소리 감독의 입력 — 방 화면이 이미 쓰는 공개 view 에서 허용 필드만 고른다 (D-3, LS-6, T-12-27).
// 이 파일만 RoomView 를 읽는다. 읽는 경로는 test/unit/soundStaticGuard.test.ts 의 허용 목록이 고정한다:
//   view.phase · view.phaseEndsAt · view.day.{n, turn, points, candidate, morning, execution, runoff, showdown, suspects} · view.players · view.me.seat
// 이후 계획(09·10·11)이 필요한 공개 필드를 여기와 허용 목록에 함께 더한다. 역할·선택·기록·관전·본문 필드는 읽지 않는다.
import type { PhaseId, PointLine, RoomView } from "../../shared/protocol";

/** 지목 차례(공개): 서버가 모두에게 같게 싣는 값 */
export interface AudioTurn {
  order: number[];
  /** -1 모이는 중 · 0.. 차례 · order.length 끝 알림 */
  i: number;
  endsAt?: number;
  doneAt?: number;
  skip?: boolean;
}

/** 아침 공개 결과(12-09): 탈락자가 있는가·의사가 살린 아침인가 — 누구인지는 읽지 않는다. 서버가 모두에게 같게 싣는 공개 정보다 */
export interface AudioMorning {
  eliminated: boolean;
  saved: boolean;
}

/** 결선(12-10): 단계(0 앞머리 · 1 투표 · 2 결과)만 읽는다 — 후보·득표·투표자는 읽지 않는다 */
export interface AudioRunoff {
  step: number;
}

/** 마지막 3인 결전(12-10): 말하는 순서(공개 좌석)와 진행 번호 i(-1 모이기 · 0..2 한마디 · 3 동시 지목 · 4 공개). 한마디·지목은 읽지 않는다 */
export interface AudioShowdown {
  order: number[];
  i: number;
}

export interface AudioView {
  phase: PhaseId;
  /** 공개 단계 마감 시각(서버 ms). 없으면 null */
  endsAt: number | null;
  dayN: number | null;
  turn: AudioTurn | null;
  points: PointLine[];
  candidate: number | null;
  morning: AudioMorning | null;
  /** 처형자(day.execution)가 있는가(22-12 P22-14) — 불리언 하나. 처형자 좌석·유언 글은 읽지 않는다. 부결·동점·0표는 처형 단계가 없어 거짓이다 */
  hasExecution: boolean;
  runoff: AudioRunoff | null;
  showdown: AudioShowdown | null;
  /** 현재 공개 의심표의 붙인 좌석·대상 좌석 쌍. 새로 붙은 표인지 비교할 때만 쓴다. */
  suspectMarks: string[];
  players: { seat: number; alive: boolean }[];
  mySeat: number;
}

/** AudioView 의 키 목록. 시험이 audioViewOf 출력의 키가 이 안에 있음을 단언한다 */
export const AUDIO_VIEW_FIELDS = ["phase", "endsAt", "dayN", "turn", "points", "candidate", "morning", "hasExecution", "runoff", "showdown", "suspectMarks", "players", "mySeat"] as const;

export function audioViewOf(view: RoomView): AudioView {
  const t = view.day?.turn;
  const turn: AudioTurn | null =
    t === undefined
      ? null
      : {
          order: [...t.order],
          i: t.i,
          ...(t.endsAt === undefined ? {} : { endsAt: t.endsAt }),
          ...(t.doneAt === undefined ? {} : { doneAt: t.doneAt }),
          ...(t.skip === true ? { skip: true } : {}),
        };
  const points = view.day?.points;
  const m = view.day?.morning;
  const ro = view.day?.runoff;
  const sd = view.day?.showdown;
  return {
    phase: view.phase,
    endsAt: view.phaseEndsAt,
    dayN: view.day?.n ?? null,
    turn,
    points: points === undefined ? [] : points.map((p) => ({ seat: p.seat, target: p.target })),
    candidate: view.day?.candidate ?? null,
    morning: m === undefined ? null : { eliminated: m.eliminated !== undefined, saved: m.saved === true },
    hasExecution: view.day?.execution !== undefined,
    runoff: ro === undefined ? null : { step: ro.step },
    showdown: sd === undefined ? null : { order: [...sd.order], i: sd.i },
    suspectMarks: view.day?.suspects?.map(({ from, to }) => `${from}:${to}`) ?? [],
    players: view.players.map((p) => ({ seat: p.seat, alive: p.alive !== false })),
    mySeat: view.me.seat,
  };
}
