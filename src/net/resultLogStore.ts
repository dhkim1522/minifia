// 결과 공개 프레임(resultLog)을 모으는 클라이언트 저장소 (11-07, 결정 D-2·D-9, UI-SPEC A-3).
// 서버는 판이 끝난 ended 에서만, 모든 소켓에 같은 열(mafia → ghost → whisper → claim → ballots)을 40줄 이하 프레임으로 보낸다(11-03).
// 이 저장소는 받은 값을 부분별로 쌓을 뿐이다 — 받을 권리가 없는 줄은 서버가 보내지 않는다(결정 0002·0021). 시각을 읽지 않는다(ChatStore 선례).
// epoch 규칙: 낡은 epoch 프레임은 버리고, 더 새 epoch 를 받으면 이전 값을 비우고 그 연결의 프레임으로 새로 쌓는다(재접속은 같은 열을 다시 보낸다).
import type { ResultLogBallotsLine, ResultLogChatLine, ResultLogClaimLine, ResultLogFrame, ResultLogPart, ResultLogWhisperLine } from "../../shared/protocol";

/** 한 부분: 줄(프레임 i 순서로 이어 붙임)과 끝(end 프레임을 받음) 여부 */
export interface ResultLogPartView<L> {
  readonly lines: readonly L[];
  readonly complete: boolean;
}

export interface ResultLogSnapshot {
  readonly mafia: ResultLogPartView<ResultLogChatLine>;
  readonly ghost: ResultLogPartView<ResultLogChatLine>;
  readonly whisper: ResultLogPartView<ResultLogWhisperLine>;
  readonly claim: ResultLogPartView<ResultLogClaimLine>;
  readonly ballots: ResultLogPartView<ResultLogBallotsLine>;
}

export type ResultLogListener = () => void;

const PARTS: readonly ResultLogPart[] = ["mafia", "ghost", "whisper", "claim", "ballots"];

interface Acc {
  /** 프레임 번호 i → 그 프레임의 줄 */
  frames: Map<number, readonly unknown[]>;
  complete: boolean;
}

const emptyPart = <L>(): ResultLogPartView<L> => ({ lines: [], complete: false });
const EMPTY: ResultLogSnapshot = { mafia: emptyPart(), ghost: emptyPart(), whisper: emptyPart(), claim: emptyPart(), ballots: emptyPart() };

export class ResultLogStore {
  private epoch = -1;
  private acc: Record<ResultLogPart, Acc> = ResultLogStore.blank();
  private snap: ResultLogSnapshot = EMPTY;
  private rev = 0;
  private listeners = new Set<ResultLogListener>();

  private static blank(): Record<ResultLogPart, Acc> {
    return { mafia: { frames: new Map(), complete: false }, ghost: { frames: new Map(), complete: false }, whisper: { frames: new Map(), complete: false }, claim: { frames: new Map(), complete: false }, ballots: { frames: new Map(), complete: false } };
  }

  /** 프레임 하나를 연결 epoch 와 함께 받는다. 같은 (부분, i) 가 다시 오면 바꾼다 */
  apply(frame: ResultLogFrame, epoch: number): void {
    if (epoch < this.epoch) return;
    if (!PARTS.includes(frame.part) || !Number.isInteger(frame.i) || frame.i < 0) return;
    if (epoch > this.epoch) {
      this.epoch = epoch;
      this.acc = ResultLogStore.blank();
    }
    const part = this.acc[frame.part];
    part.frames.set(frame.i, frame.lines);
    if (frame.end) part.complete = true;
    this.rebuild();
  }

  /** 모두 비운다(대기실로 돌아가 새 판을 시작할 때). epoch 도 처음으로 돌려 다음 연결의 프레임을 받는다 */
  reset(): void {
    const dirty = this.epoch !== -1 || PARTS.some((p) => this.acc[p].frames.size > 0 || this.acc[p].complete);
    this.epoch = -1;
    this.acc = ResultLogStore.blank();
    if (!dirty) return;
    this.snap = EMPTY;
    this.bump();
  }

  /** 지금 모인 값. 바뀌기 전에는 같은 참조다 */
  snapshot(): ResultLogSnapshot {
    return this.snap;
  }

  currentEpoch(): number {
    return this.epoch;
  }

  /** 바뀔 때마다 늘어나는 번호(useSyncExternalStore 용) */
  revision(): number {
    return this.rev;
  }

  subscribe(cb: ResultLogListener): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private rebuild(): void {
    const view = <L>(p: ResultLogPart): ResultLogPartView<L> => {
      const a = this.acc[p];
      const lines = [...a.frames.entries()].sort((x, y) => x[0] - y[0]).flatMap(([, ls]) => ls as readonly L[]);
      return { lines, complete: a.complete };
    };
    this.snap = {
      mafia: view<ResultLogChatLine>("mafia"),
      ghost: view<ResultLogChatLine>("ghost"),
      whisper: view<ResultLogWhisperLine>("whisper"),
      claim: view<ResultLogClaimLine>("claim"),
      ballots: view<ResultLogBallotsLine>("ballots"),
    };
    this.bump();
  }

  private bump(): void {
    this.rev += 1;
    for (const l of [...this.listeners]) l();
  }
}
