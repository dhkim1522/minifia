// 서버가 보낸 줄만 든다(낙관적 표시 없음). 받을 권리가 없는 줄은 서버가 보내지 않는다 — visibleLines 는 표시 흐름
// 선택이지 보안 경계가 아니다(결정 0002·0021). React 밖이라 프레임마다 리렌더하지 않는다(WorldStore 와 같은 형태).
import { CHAT_KEEP_LINES, NOTICE_MS, TYPING_EXPIRE_MS } from "../game/chatUi";
import { MAX_PLAYERS } from "../../shared/protocol";
import type { ChatChannel, ChatLogFrame, ChatLineFrame, ChatRejectFrame, ChatRejectWhy, ChatLineWire, TypingFrame } from "../../shared/protocol";
import type { V2IconName } from "../components/v2/V2Icon";

/** 기록 칸의 한 줄. scope = 이 줄이 보이는 흐름(사람 줄은 ch 와 같고, 시스템 줄은 만든 쪽이 정한다) */
export interface ChatStoreLine {
  key: string;
  /** system = 일반 안내 줄, vote = 지목 기록 줄, hot = 선두·과반·결과처럼 눈여겨볼 줄(8페이즈) */
  kind: "player" | "system" | "vote" | "hot";
  ch?: ChatChannel;
  seat?: number;
  seq?: number;
  text: string;
  at: number;
  icon?: V2IconName;
  scope: ChatChannel;
}

export type ChatStoreFrame = ChatLineFrame | TypingFrame | ChatLogFrame | ChatRejectFrame;
export type ChatStoreListener = () => void;

export interface ChatStoreContext {
  pk: string;
  channel: ChatChannel | null;
  epoch: number;
}

/**
 * epoch 규칙: 낡은 epoch 프레임은 버리고, 더 새 epoch 를 받으면 그 연결로 넘어가며 입력 중을 비운다.
 * 줄은 연결이 바뀌어도 지우지 않는다(재접속 chatLog 와 합집합으로 합친다). 대기실로 되돌리면 화면이 reset() 을 부른다(A1).
 * 시각은 저장소가 스스로 읽지 않고 now 로 받는다 — 만료 타이머는 부르는 쪽이 nextTypingExpiry()·noticeExpiry() 로 건다(A2).
 */
export class ChatStore {
  private epoch = -1;
  private ctx: ChatStoreContext | null = null;
  private all: readonly ChatStoreLine[] = [];
  private keys = new Set<string>();
  private typing = new Map<number, number>();
  private reject: { why: ChatRejectWhy; at: number; n: number } | null = null;
  private rejectSeq = 0;
  private sysSeq = 0;
  private replay = false;
  private rev = 0;
  private views = new Map<ChatChannel, readonly ChatStoreLine[]>();
  private listeners = new Set<ChatStoreListener>();

  /** 연결 epoch 와 함께 프레임을 적용한다. now 는 받은 시각(입력 중·막힘 알림의 만료 기준) */
  apply(frame: ChatStoreFrame, epoch: number, now: number): void {
    if (epoch < this.epoch) return;
    let changed = false;
    if (epoch > this.epoch) {
      this.epoch = epoch;
      changed = this.typing.size > 0;
      this.typing.clear();
    }
    switch (frame.t) {
      case "chat": {
        if (this.insertAll([playerLine(frame)])) {
          this.replay = false;
          this.typing.delete(frame.seat);
          changed = true;
        }
        break;
      }
      case "chatLog": {
        const inserted = this.insertAll(frame.lines.map(playerLine));
        if (inserted || !this.replay) changed = true;
        this.replay = true;
        break;
      }
      case "typing": {
        if (frame.on) {
          this.setTyping(frame.seat, now);
          changed = true;
        } else if (this.typing.delete(frame.seat)) {
          changed = true;
        }
        break;
      }
      case "chatReject": {
        this.reject = { why: frame.why, at: now, n: ++this.rejectSeq };
        changed = true;
        break;
      }
    }
    if (changed) this.bump();
  }

  /** 화면이 지금 단계 키·내 채널·연결 epoch 를 알려 준다. 셋 중 하나가 바뀌면 입력 중을 모두 끈다. */
  setContext(ctx: ChatStoreContext): void {
    const prev = this.ctx;
    this.ctx = { ...ctx };
    if (ctx.epoch > this.epoch) this.epoch = ctx.epoch;
    const moved = !prev || prev.pk !== ctx.pk || prev.channel !== ctx.channel || prev.epoch !== ctx.epoch;
    if (moved && this.typing.size > 0) {
      this.typing.clear();
      this.bump();
    }
  }

  /** 클라이언트가 view 변화에서 만드는 시스템 줄(입장·퇴장·채널 시작 등). 서버가 보낸 줄이 아니다 */
  addSystem(text: string, opts: { scope: ChatChannel; icon?: V2IconName; at: number; kind?: "system" | "vote" | "hot" }): void {
    const line: ChatStoreLine = { key: `sys:${++this.sysSeq}:${opts.at}`, kind: opts.kind ?? "system", text, at: opts.at, scope: opts.scope };
    if (opts.icon) line.icon = opts.icon;
    this.insertAll([line]);
    this.bump();
  }

  lines(): readonly ChatStoreLine[] {
    return this.all;
  }

  /**
   * 채널의 표시 흐름(받은 줄 중 무엇을 이어서 보여 줄지 고르는 것).
   * all(또는 null) = all 줄 + 공개 시스템 줄 / mafia = mafia 줄 + 마피아 시스템 줄 / ghost = 받은 줄 전부 시간 순
   */
  visibleLines(channel: ChatChannel | null): readonly ChatStoreLine[] {
    const ch: ChatChannel = channel ?? "all";
    if (ch === "ghost") return this.all;
    let v = this.views.get(ch);
    if (!v) {
      v = this.all.filter((l) => l.scope === ch);
      this.views.set(ch, v);
    }
    return v;
  }

  /** now 에 켜져 있는 좌석(만료 시각이 now 이하인 좌석은 꺼진 것) */
  typingSeats(now: number): ReadonlySet<number> {
    const on = new Set<number>();
    for (const [seat, until] of this.typing) if (until > now) on.add(seat);
    return on;
  }

  /**
   * 가장 먼저 만료되는 시각(없으면 null) — 부르는 쪽이 이 시각에 타이머를 건다.
   * now 를 주면 이미 지난 만료는 건너뛴다(타이머가 울린 직후 같은 시각을 다시 받아 곧바로 또 거는 일을 막는다)
   */
  nextTypingExpiry(now?: number): number | null {
    let min: number | null = null;
    for (const until of this.typing.values()) {
      if (now !== undefined && until <= now) continue;
      if (min === null || until < min) min = until;
    }
    return min;
  }

  clearTypingSeat(seat: number): void {
    if (this.typing.delete(seat)) this.bump();
  }

  /** now 에 떠 있는 막힘 알림 이유. 알림은 하나뿐이고 기록 줄이 아니다 */
  notice(now: number): ChatRejectWhy | null {
    const r = this.reject;
    return r && now < r.at + NOTICE_MS ? r.why : null;
  }

  noticeExpiry(): number | null {
    return this.reject ? this.reject.at + NOTICE_MS : null;
  }

  lastReject(): { why: ChatRejectWhy; at: number; n: number } | null {
    return this.reject;
  }

  /** 마지막으로 줄을 바꾼 프레임이 재접속 복원(chatLog)이었는가 — 참이면 새 메시지 점·알림을 만들지 않는다 */
  lastWasReplay(): boolean {
    return this.replay;
  }

  /** 줄·입력 중·알림이 바뀔 때마다 1 씩 늘어난다(useSyncExternalStore 스냅샷용) */
  revision(): number {
    return this.rev;
  }

  /** 대기실로 되돌릴 때·연결을 닫을 때 모두 비운다 */
  reset(): void {
    const changed = this.all.length > 0 || this.typing.size > 0 || this.reject !== null || this.replay;
    this.epoch = -1;
    this.ctx = null;
    this.all = [];
    this.keys.clear();
    this.typing.clear();
    this.reject = null;
    this.replay = false;
    if (changed) this.bump();
  }

  subscribe(cb: ChatStoreListener): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  /** 입력 중 켜기: 좌석은 최대 MAX_PLAYERS 개, 넘치면 가장 먼저 만료될 좌석부터 밀어낸다(T-07-10) */
  private setTyping(seat: number, now: number): void {
    for (const [s, until] of this.typing) if (until <= now) this.typing.delete(s);
    this.typing.set(seat, now + TYPING_EXPIRE_MS);
    while (this.typing.size > MAX_PLAYERS) {
      let oldest = -1;
      let oldestUntil = Infinity;
      for (const [s, until] of this.typing) {
        if (s !== seat && until < oldestUntil) {
          oldest = s;
          oldestUntil = until;
        }
      }
      this.typing.delete(oldest);
    }
  }

  /** at 오름차순(같으면 들어온 순)으로 합치고 100줄을 넘으면 오래된 줄부터 버린다. 새로 들어온 줄이 있었는가 */
  private insertAll(incoming: readonly ChatStoreLine[]): boolean {
    const fresh = incoming.filter((l, i) => !this.keys.has(l.key) && incoming.findIndex((m) => m.key === l.key) === i);
    if (fresh.length === 0) return false;
    const merged = [...this.all];
    for (const line of fresh) {
      this.keys.add(line.key);
      let i = merged.length;
      while (i > 0 && merged[i - 1].at > line.at) i--;
      merged.splice(i, 0, line);
    }
    const over = merged.length - CHAT_KEEP_LINES;
    if (over > 0) for (const gone of merged.splice(0, over)) this.keys.delete(gone.key);
    this.all = merged;
    return true;
  }

  private bump(): void {
    this.rev++;
    this.views.clear();
    for (const cb of [...this.listeners]) cb();
  }
}

function playerLine(f: ChatLineWire): ChatStoreLine {
  return { key: `${f.ch}:${f.seq}:${f.at}`, kind: "player", ch: f.ch, seat: f.seat, seq: f.seq, text: f.text, at: f.at, scope: f.ch };
}
