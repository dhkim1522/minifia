// 서버가 보낸 줄만 든다(낙관적 표시 없음). 받을 권리가 없는 줄은 서버가 보내지 않는다 — visibleLines 는 표시 흐름
// 선택이지 보안 경계가 아니다(결정 0002·0021). React 밖이라 프레임마다 리렌더하지 않는다(WorldStore 와 같은 형태).
import type { ChatChannel, ChatLogFrame, ChatLineFrame, ChatRejectFrame, TypingFrame } from "../../shared/protocol";
import type { V2IconName } from "../components/v2/V2Icon";

/** 기록 칸의 한 줄. scope = 이 줄이 보이는 흐름(사람 줄은 ch 와 같고, 시스템 줄은 만든 쪽이 정한다) */
export interface ChatStoreLine {
  key: string;
  kind: "player" | "system";
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

export class ChatStore {
  private epoch = -1;
  private pk: string | null = null;
  private channel: ChatChannel | null = null;
  private all: ChatStoreLine[] = [];
  private keys = new Set<string>();
  private rev = 0;
  private listeners = new Set<ChatStoreListener>();

  /** 연결 epoch 와 함께 프레임을 적용한다. 낡은 epoch 의 프레임은 버린다. */
  apply(frame: ChatStoreFrame, epoch: number, _now: number): void {
    if (epoch < this.epoch) return;
    if (epoch > this.epoch) this.epoch = epoch;
    if (frame.t === "chat") {
      if (this.insert(playerLine(frame))) this.bump();
    }
  }

  /** 화면이 지금 단계 키·내 채널·연결 epoch 를 알려 준다. */
  setContext(ctx: ChatStoreContext): void {
    this.pk = ctx.pk;
    this.channel = ctx.channel;
    if (ctx.epoch > this.epoch) this.epoch = ctx.epoch;
  }

  lines(): readonly ChatStoreLine[] {
    return this.all;
  }

  /** 채널의 표시 흐름. all(또는 null) = 공개 줄 + 공개 시스템 줄 */
  visibleLines(_channel: ChatChannel | null): readonly ChatStoreLine[] {
    return this.all.filter((l) => l.scope === "all");
  }

  /** 줄·입력 중·알림이 바뀔 때마다 1 씩 늘어난다(useSyncExternalStore 스냅샷용) */
  revision(): number {
    return this.rev;
  }

  subscribe(cb: ChatStoreListener): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  /** at 오름차순(같으면 들어온 순)으로 넣는다. 이미 있는 키면 false */
  private insert(line: ChatStoreLine): boolean {
    if (this.keys.has(line.key)) return false;
    this.keys.add(line.key);
    let i = this.all.length;
    while (i > 0 && this.all[i - 1].at > line.at) i--;
    this.all.splice(i, 0, line);
    return true;
  }

  private bump(): void {
    this.rev++;
    for (const cb of [...this.listeners]) cb();
  }
}

function playerLine(f: ChatLineFrame): ChatStoreLine {
  return { key: `${f.ch}:${f.seq}:${f.at}`, kind: "player", ch: f.ch, seat: f.seat, seq: f.seq, text: f.text, at: f.at, scope: f.ch };
}
