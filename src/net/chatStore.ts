// RED 단계 뼈대: 시험이 먼저 실패하도록 빈 동작만 둔다. 구현은 GREEN 에서 채운다.
import type { ChatChannel, ChatLineFrame } from "../../shared/protocol";

export interface ChatStoreLine {
  key: string;
  kind: "player" | "system";
  ch?: ChatChannel;
  seat?: number;
  seq?: number;
  text: string;
  at: number;
  scope: ChatChannel;
}

export class ChatStore {
  apply(_frame: ChatLineFrame, _epoch: number, _now: number): void {}
  setContext(_ctx: { pk: string; channel: ChatChannel | null; epoch: number }): void {}
  lines(): readonly ChatStoreLine[] {
    return [];
  }
  visibleLines(_channel: ChatChannel | null): readonly ChatStoreLine[] {
    return [];
  }
  revision(): number {
    return 0;
  }
  subscribe(_cb: () => void): () => void {
    return () => {};
  }
}
