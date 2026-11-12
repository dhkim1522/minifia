// 로비 위치의 클라이언트 사본(React 밖 — 프레임마다 리렌더하지 않는다, RESEARCH Anti-Patterns).
// 위치의 진실은 서버 구간이고 이 스토어는 서버가 보낸 구간만 든다. 내 예측 구간은 런타임이 따로 든다(결정 0059).
import type { Segment } from "../../shared/game/world";
import { positionAt } from "../../shared/game/world";
import type { EmoteFrame, RoomId, WorldFrame } from "../../shared/protocol";

export type WorldStoreListener = () => void;
export type EmoteListener = (frame: EmoteFrame) => void;
/**
 * 문 통과로 사라지거나 나타난 좌석 한 건(20페이즈 D-15). d 는 지나간 문의 방 — 서버의 door 프레임에서 온 것만 있고,
 * 내가 구역을 넘어 받은 새 구역 snap 으로 바뀐 좌석에는 없다(그 사람들은 문을 지난 것이 아니라 내 시야가 바뀐 것이다).
 */
export interface DoorEvent {
  seat: number;
  kind: "vanish" | "appear";
  d?: RoomId;
}

/**
 * epoch 규칙(CONN-04, T-06-21): 새 연결의 첫 state 마다 epoch 가 1 늘고 서버는 [state, snap] 순서로 보낸다.
 * - snap: epoch 가 더 낡았으면 버리고, 아니면 구간을 통째로 바꾼다(이전 연결의 위치를 병합하지 않는다).
 *   새 연결의 첫 snap 이든 같은 연결의 다시 snap(대기실 복귀)이든 등장 연출 없이 바로 맞춘다.
 *   예외: near 표시가 있고 이미 준비된 같은 epoch 의 snap 은 근처 표본이라 새로 보이는 좌석이 등장 대상이다(15페이즈).
 * - 마지막 구간 기억(lastSegs, 18.1 C-6): snap 이 좌석을 빼도(탈락자는 산 사람 소켓의 다음 snap 에 없다) 그 좌석이 마지막으로 받은 구간은 남긴다.
 *   산 사람 화면이 탈락한 좌석을 유령으로 세울 자리다. 이전 연결의 위치는 섞지 않는다 — reset() 과 retainSeats()(방을 떠난 좌석)에서만 지운다.
 * - move: 더 낡은 epoch 는 버린다. 더 새 epoch 의 move 는 그 snap 이 오기 전이라 버리고 준비 상태를 푼다.
 *   같은 연결에서 처음 보는 seat 의 move 만 등장 대상이다.
 * - door(20페이즈 D-15): epoch 규칙은 move 와 같다. vanish 는 좌석을 빼고(마지막 구간 기억은 남긴다) appear 는 구간을 넣되 등장 대상이 아니다 —
 *   둘 다 문 목록(takeDoor)에 오른다. zone 표시가 있고 이미 준비된 같은 epoch 의 snap 은 내가 구역을 넘어 받은 새 구역 사람들이라
 *   통째로 바꾸고 빠진 좌석은 사라짐, 새 좌석은 나타남으로 문 목록에 올린다. 그 밖의 snap(near 포함)은 문 목록을 만들지 않는다.
 */
export class WorldStore {
  private epoch = -1;
  private ready = false;
  private segs = new Map<number, Segment>();
  private lastSegs = new Map<number, Segment>();
  private entered = new Set<number>();
  private moveSeqs = new Map<number, number>();
  private doorEvents: DoorEvent[] = [];
  private listeners = new Set<WorldStoreListener>();
  private emoteListeners = new Set<EmoteListener>();

  /** 연결 epoch 와 함께 world 프레임을 적용한다. snap = 모두의 구간을 통째로 바꾼다, move = 한 사람의 새 구간, door = 문 통과로 사라짐·나타남 */
  applyFrame(frame: WorldFrame, epoch: number): void {
    if (epoch < this.epoch) return;
    if (frame.k === "snap") {
      const next = new Map<number, Segment>(frame.ents.map((e) => [e.s, { p: [...e.p], t0: e.t0, v: e.v }]));
      if (frame.near === true && this.ready && epoch === this.epoch) {
        // 근처 snap(15페이즈 D-02): 지금 보이는 사람 전부다 — 사본을 통째로 바꾸고 새로 보이는 좌석만 등장시킨다.
        // 빠진 좌석은 사본에서 사라져 런타임이 퇴장시킨다. 이동 응답 세기는 남은 좌석에 한해 이어 간다(내 예측 구간을 끊지 않는다).
        for (const s of next.keys()) if (!this.segs.has(s)) this.entered.add(s);
        for (const s of [...this.entered]) if (!next.has(s)) this.entered.delete(s);
        for (const s of [...this.moveSeqs.keys()]) if (!next.has(s)) this.moveSeqs.delete(s);
        this.segs = next;
        this.rememberAll(next);
        this.notify();
        return;
      }
      if (frame.zone === true && this.ready && epoch === this.epoch) {
        // 새 구역 snap(20페이즈 D-14): 내가 문을 지나 보이는 사람이 바뀌었다 — 사본을 통째로 바꾸고 빠진 좌석은 사라짐, 새 좌석은 나타남으로 문 목록에 올린다.
        // 등장 연출 대상은 아니다(문 연출이다). 이동 응답 세기는 남은 좌석에 한해 이어 간다(문을 지나는 내 예측 구간을 끊지 않는다).
        const gone = [...this.segs.keys()].filter((s) => !next.has(s)).sort((a, b) => a - b);
        const came = [...next.keys()].filter((s) => !this.segs.has(s)).sort((a, b) => a - b);
        for (const s of gone) this.doorEvents.push({ seat: s, kind: "vanish" });
        for (const s of came) this.doorEvents.push({ seat: s, kind: "appear" });
        for (const s of [...this.entered]) if (!next.has(s)) this.entered.delete(s);
        for (const s of [...this.moveSeqs.keys()]) if (!next.has(s)) this.moveSeqs.delete(s);
        this.segs = next;
        this.rememberAll(next);
        this.notify();
        return;
      }
      this.segs = next;
      this.rememberAll(next);
      this.entered.clear();
      this.moveSeqs.clear();
      this.doorEvents = [];
      this.epoch = epoch;
      this.ready = true;
      this.notify();
      return;
    }
    if (epoch > this.epoch) {
      // 새 연결의 move 가 snap 보다 먼저 왔다: 버리고, 그 snap 이 올 때까지 준비 전으로 둔다.
      const wasReady = this.ready;
      this.epoch = epoch;
      this.ready = false;
      if (wasReady) this.notify();
      return;
    }
    if (!this.ready) return;
    if (frame.k === "door") {
      if (frame.e === "vanish") {
        // 사라짐: 좌표가 없는 프레임이다 — 좌석을 사본에서 뺄 뿐이고, 마지막으로 본 구간(lastSegs)은 남아 런타임이 그 자리에서 옅어지게 한다.
        if (!this.segs.has(frame.s)) return;
        this.segs.delete(frame.s);
        this.entered.delete(frame.s);
        this.moveSeqs.delete(frame.s);
        this.doorEvents.push({ seat: frame.s, kind: "vanish", d: frame.d });
      } else {
        // 나타남: 구간은 내 구역 안으로 자른 것이다. 등장 대상(entered)에는 넣지 않는다 — 방에 새로 온 사람이 아니라 문을 지난 사람이다.
        this.segs.set(frame.s, { p: [...frame.p], t0: frame.t0, v: frame.v });
        this.lastSegs.set(frame.s, { p: [...frame.p], t0: frame.t0, v: frame.v });
        this.entered.delete(frame.s);
        this.doorEvents.push({ seat: frame.s, kind: "appear", d: frame.d });
      }
      this.notify();
      return;
    }
    if (!this.segs.has(frame.s)) this.entered.add(frame.s);
    this.segs.set(frame.s, { p: [...frame.p], t0: frame.t0, v: frame.v });
    this.lastSegs.set(frame.s, { p: [...frame.p], t0: frame.t0, v: frame.v });
    this.moveSeqs.set(frame.s, (this.moveSeqs.get(frame.s) ?? 0) + 1);
    this.notify();
  }

  /**
   * 서버 emote 프레임(10-03). 위치가 아니라 사건이라 상태를 만들지 않고 마지막 프레임도 기억하지 않는다(L28 정신) — 구독자에게 한 번 알릴 뿐이다.
   * 더 낡은 epoch 는 버린다. store 의 epoch 는 바꾸지 않는다(snap 만 정한다).
   */
  applyEmote(frame: EmoteFrame, epoch: number): void {
    if (epoch < this.epoch) return;
    for (const cb of [...this.emoteListeners]) cb(frame);
  }

  /** emote 구독. reset() 은 이 목록을 건드리지 않는다(연결을 다시 열어도 런타임의 구독이 산다) */
  onEmote(cb: EmoteListener): () => void {
    this.emoteListeners.add(cb);
    return () => {
      this.emoteListeners.delete(cb);
    };
  }

  /** 연결을 닫을 때 비운다. 다음 snap 이 오기 전까지는 준비 전이다. */
  reset(): void {
    const changed = this.ready || this.segs.size > 0 || this.entered.size > 0;
    this.epoch = -1;
    this.ready = false;
    this.segs.clear();
    this.lastSegs.clear();
    this.entered.clear();
    this.moveSeqs.clear();
    this.doorEvents = [];
    if (changed) this.notify();
  }

  /** 마지막으로 받아들인 연결 epoch(아직 없으면 -1). 런타임이 새 연결의 첫 프레임에 카메라를 바로 붙이는 데 쓴다 */
  currentEpoch(): number {
    return this.epoch;
  }

  /** 지금 epoch 의 snap 을 받았는가 */
  isReady(): boolean {
    return this.ready;
  }

  /** 이 연결의 snap 뒤 그 자리에 적용된 move 수 — 런타임이 내 이동의 응답을 센다(결정 0059). 없으면 0. */
  moveSeqOf(seat: number): number {
    return this.moveSeqs.get(seat) ?? 0;
  }

  /** 구간이 있는 seat 오름차순 */
  seats(): number[] {
    return [...this.segs.keys()].sort((a, b) => a - b);
  }

  segOf(seat: number): Segment | undefined {
    return this.segs.get(seat);
  }

  /**
   * 탈락한 좌석을 산 사람 화면에 유령으로 세울 마지막 구간(18.1 C-6). snap 이 그 좌석을 빼도 남는다.
   * 이전 연결의 위치는 섞지 않는다(reset 에서 지움) — 새로고침·재접속 뒤에는 받은 적 없는 좌석이라 undefined.
   */
  lastSegOf(seat: number): Segment | undefined {
    return this.lastSegs.get(seat);
  }

  /** 서버 시각 serverNow 의 위치(월드 단위). 서버와 같은 shared positionAt 이라 같은 시각이면 같은 값이다(MAP-05). */
  positionOf(seat: number, serverNow: number): { x: number; z: number } | null {
    const seg = this.segs.get(seat);
    return seg ? positionAt(seg, serverNow) : null;
  }

  /** 첫 snap 이후 새로 나타난 seat(오름차순). 한 번 꺼내면 비워진다. */
  takeEntered(): number[] {
    const out = [...this.entered].sort((x, y) => x - y);
    this.entered.clear();
    return out;
  }

  /**
   * 문 통과로 사라지거나 나타난 좌석(받은 순서). 한 번 꺼내면 비워진다(20페이즈 D-15).
   * 사라진 좌석이 옅어질 자리는 lastSegOf(seat), 나타난 좌석의 구간은 segOf(seat) 다.
   */
  takeDoor(): DoorEvent[] {
    const out = this.doorEvents;
    this.doorEvents = [];
    return out;
  }

  /** view 에 없는 seat 의 구간을 지우고 지운 seat 를 돌려준다(퇴장 연출용). 지운 seat 의 늦은 move 는 새 사람으로 다시 나타난다. */
  retainSeats(seatsInView: readonly number[]): number[] {
    const keep = new Set(seatsInView);
    const removed = this.seats().filter((s) => !keep.has(s));
    for (const s of removed) {
      this.segs.delete(s);
      this.entered.delete(s);
      this.moveSeqs.delete(s);
    }
    for (const s of [...this.lastSegs.keys()]) if (!keep.has(s)) this.lastSegs.delete(s);
    if (this.doorEvents.some((e) => !keep.has(e.seat))) this.doorEvents = this.doorEvents.filter((e) => keep.has(e.seat));
    if (removed.length > 0) this.notify();
    return removed;
  }

  subscribe(cb: WorldStoreListener): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private rememberAll(next: ReadonlyMap<number, Segment>): void {
    for (const [s, seg] of next) this.lastSegs.set(s, { p: [...seg.p], t0: seg.t0, v: seg.v });
  }

  private notify(): void {
    for (const cb of [...this.listeners]) cb();
  }
}
