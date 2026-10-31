// 로비 위치의 클라이언트 사본(React 밖 — 프레임마다 리렌더하지 않는다, RESEARCH Anti-Patterns).
// 위치의 진실은 서버 구간이고 이 스토어는 받은 구간만 들고 있다(예측 이동 없음, 결정 0044-17).
import type { Segment } from "../../shared/game/world";
import { positionAt } from "../../shared/game/world";
import type { WorldFrame } from "../../shared/protocol";

export type WorldStoreListener = () => void;

export class WorldStore {
  private epoch = -1;
  private ready = false;
  private segs = new Map<number, Segment>();
  private listeners = new Set<WorldStoreListener>();

  /** 연결 epoch 와 함께 world 프레임을 적용한다. snap = 모두의 구간을 통째로 바꾼다, move = 한 사람의 새 구간 */
  applyFrame(frame: WorldFrame, epoch: number): void {
    if (frame.k === "snap") {
      this.segs = new Map(frame.ents.map((e) => [e.s, { p: [...e.p], t0: e.t0, v: e.v }]));
      this.epoch = epoch;
      this.ready = true;
      this.notify();
      return;
    }
    if (!this.ready || epoch !== this.epoch) return;
    this.segs.set(frame.s, { p: [...frame.p], t0: frame.t0, v: frame.v });
    this.notify();
  }

  /** 지금 epoch 의 snap 을 받았는가 */
  isReady(): boolean {
    return this.ready;
  }

  /** 구간이 있는 seat 오름차순 */
  seats(): number[] {
    return [...this.segs.keys()].sort((a, b) => a - b);
  }

  segOf(seat: number): Segment | undefined {
    return this.segs.get(seat);
  }

  /** 서버 시각 serverNow 의 위치(월드 단위). 서버와 같은 shared positionAt 이라 같은 시각이면 같은 값이다(MAP-05). */
  positionOf(seat: number, serverNow: number): { x: number; z: number } | null {
    const seg = this.segs.get(seat);
    return seg ? positionAt(seg, serverNow) : null;
  }

  subscribe(cb: WorldStoreListener): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notify(): void {
    for (const cb of [...this.listeners]) cb();
  }
}
