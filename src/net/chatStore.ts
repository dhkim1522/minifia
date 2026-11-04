// 서버가 보낸 줄만 든다(낙관적 표시 없음). 받을 권리가 없는 줄은 서버가 보내지 않는다 — visibleLines 는 표시 흐름
// 선택이지 보안 경계가 아니다(결정 0002·0021). React 밖이라 프레임마다 리렌더하지 않는다(WorldStore 와 같은 형태).
import { CHAT_KEEP_LINES, NOTICE_MS, TYPING_EXPIRE_MS } from "../game/chatUi";
import { MAX_PLAYERS } from "../../shared/protocol";
import type { ChatChannel, ChatLogFrame, ChatLineFrame, ChatRejectFrame, ChatRejectWhy, ChatLineWire, TypingFrame } from "../../shared/protocol";
import type { V2IconName } from "../components/v2/V2Icon";

/** 아침에 받은 서버 카드(유언·쪽지)가 채팅창에 나타나기까지의 보류 ms — 화면 몫이고 서버는 진입 즉시 보낸다(UI-SPEC 263행, 결정 0061-11) */
export const CARD_HOLD_MS = 2800;
/** 처형 단계에서 받은 카드의 보류 ms(UI-SPEC 276행) */
export const CARD_HOLD_EXEC_MS = 2400;

/** 받음 알림 근거로 기억하는 라이브 귓속말 줄 수(보낸 줄 사이에 낀 받은 줄을 놓치지 않을 만큼) */
const WHISPER_LIVE_KEEP = 8;

/** 기록 칸의 한 줄. scope = 이 줄이 보이는 흐름(사람 줄은 ch 와 같고, 시스템 줄은 만든 쪽이 정한다) */
export interface ChatStoreLine {
  key: string;
  /**
   * system = 일반 안내 줄, vote = 지목 기록 줄, hot = 선두·과반·결과처럼 눈여겨볼 줄(8페이즈), card = 유언·쪽지·경찰 카드(9페이즈),
   * whisper = 귓속말 본문 줄(보낸·받은 사람 소켓에만 온다, 09.1.1-09). 귓속말 공개 사실 줄은 system + icon whisper + seat·to 로 싣는다(이름은 useChat 이 채운다).
   */
  kind: "player" | "system" | "vote" | "hot" | "card" | "whisper";
  ch?: ChatChannel;
  seat?: number;
  seq?: number;
  text: string;
  at: number;
  icon?: V2IconName;
  scope: ChatChannel;
  /** kind card 일 때 종류. will·note = 서버 카드 줄(k), eye = 이 화면이 만든 경찰 조사 카드 */
  card?: "will" | "note" | "eye";
  /** 로컬 카드(eye)의 제목. 서버 카드의 제목은 부르는 쪽(useChat)이 좌석 닉네임으로 만든다 */
  title?: string;
  /** 이 시각 전에는 목록에 내지 않는다(라이브로 받은 서버 카드의 보류). 없으면 바로 보인다 */
  revealAt?: number;
  /** 귓속말 줄(본문·사실 모두)의 받는 좌석. seat 는 보낸 좌석 */
  to?: number;
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
  /** 편지가 뜨는 아침의 카드 보류 바닥값(holdCardsUntil). 이 시각 전에 라이브로 오는 카드는 이 시각까지 보류한다. reset 이 지운다 */
  private holdFloor = 0;
  /** 라이브로 받은 귓속말 본문 줄 기록(복원 줄은 넣지 않는다). 받음 알림의 근거 — 최근 몇 개만 둔다 */
  private liveWhispers: { seat: number; to: number; nonce: number }[] = [];
  private whisperSeq = 0;
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
        // 찬반 기록 카드(결정 0066-3)는 화면이 붙기 전(09.1.1-12)까지 이 저장소가 받지 않는다 — 유언·쪽지 카드 줄로 잘못 그려지지 않게 한다.
        if (frame.k === "ballots") break;
        if (frame.k === "whisper" || frame.k === "whispered") {
          // 귓속말(결정 0066-2): 카드가 아니다 — 보류 없이 바로 보이고 입력 중도 건드리지 않는다. 라이브로 새로 들어온 본문 줄만 받음 신호를 남긴다
          const line = whisperLine(frame);
          if (line !== null && this.insertAll([line])) {
            this.replay = false;
            if (frame.k === "whisper" && line.to !== undefined && line.seat !== undefined) {
              this.liveWhispers = [...this.liveWhispers, { seat: line.seat, to: line.to, nonce: ++this.whisperSeq }].slice(-WHISPER_LIVE_KEEP);
            }
            changed = true;
          }
          break;
        }
        if (frame.k) {
          // 서버 카드 줄: 입력 중은 건드리지 않는다(카드는 사람이 보낸 글이 아니다, 연구 Pitfall 9)
          const hold = now + (this.ctx?.pk.endsWith(":execution") ? CARD_HOLD_EXEC_MS : CARD_HOLD_MS);
          if (this.insertAll([cardLine(frame, frame.k, Math.max(hold, this.holdFloor))])) {
            this.replay = false;
            changed = true;
          }
        } else if (this.insertAll([playerLine(frame)])) {
          this.replay = false;
          this.typing.delete(frame.seat);
          changed = true;
        }
        break;
      }
      case "chatLog": {
        const inserted = this.insertAll(
          frame.lines.flatMap((f): ChatStoreLine[] => {
            if (f.k === "ballots") return [];
            if (f.k === "whisper" || f.k === "whispered") {
              const line = whisperLine(f);
              return line === null ? [] : [line];
            }
            return [f.k ? cardLine(f, f.k) : playerLine(f)];
          }),
        );
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

  /** 이 화면만 가진 카드 줄(경찰 조사 결과). 서버 채널 기록이 아니라 재접속 복원 대상이 아니고 보류 없이 바로 보인다 */
  addLocalCard(opts: { icon: "eye"; title: string; text: string; at: number }): void {
    this.insertAll([{ key: `local:${++this.sysSeq}:${opts.at}`, kind: "card", card: "eye", title: opts.title, text: opts.text, at: opts.at, icon: opts.icon, scope: "all" }]);
    this.bump();
  }

  lines(): readonly ChatStoreLine[] {
    return this.all;
  }

  /**
   * 편지가 뜨는 아침(UI-SPEC C-1): 지금(now) 보류 중인 카드 줄(revealAt > now)의 공개 시각을 max(기존, at) 로 늦추고,
   * at 이 지나기 전에 라이브로 오는 카드도 같은 바닥값을 쓴다. at 이 지나면 보통 규칙(받은 시각 + 보류)으로 돌아간다.
   * 사람 줄·시스템 줄·로컬 카드·chatLog 복원 줄(revealAt 없음)과 이미 보이는 카드는 건드리지 않는다.
   * 저장소는 시계를 읽지 않으므로 now 를 부르는 쪽이 준다.
   */
  holdCardsUntil(at: number, now: number): void {
    if (at > this.holdFloor) this.holdFloor = at;
    let moved = false;
    this.all = this.all.map((l) => {
      if (l.revealAt === undefined || l.revealAt <= now || l.revealAt >= at) return l;
      moved = true;
      return { ...l, revealAt: at };
    });
    if (moved) this.bump();
  }

  /** 라이브로 받은(revealAt 이 있는) 그 좌석의 k 카드 줄 중 마지막. 없거나 chatLog 로 복원된 줄뿐이면 undefined */
  liveCard(k: "will" | "note", seat: number): ChatStoreLine | undefined {
    for (let i = this.all.length - 1; i >= 0; i--) {
      const l = this.all[i]!;
      if (l.kind === "card" && l.card === k && l.seat === seat && l.revealAt !== undefined) return l;
    }
    return undefined;
  }

  /**
   * 라이브로 받은 귓속말 본문 줄 중 내(mySeat)가 받는 사람인 마지막 것 — 보낸 좌석과 번호(nonce). 받을 때마다 번호가 늘어나 화면이 받음 알림을 한 번씩 띄운다.
   * 재접속 복원(chatLog)·보낸 줄·사실 줄·이미 있던 줄은 만들지 않는다.
   */
  liveWhisperIn(mySeat: number): { seat: number; nonce: number } | null {
    for (let i = this.liveWhispers.length - 1; i >= 0; i--) {
      const w = this.liveWhispers[i]!;
      if (w.to === mySeat) return { seat: w.seat, nonce: w.nonce };
    }
    return null;
  }

  /**
   * 채널의 표시 흐름(받은 줄 중 무엇을 이어서 보여 줄지 고르는 것).
   * all(또는 null) = all 줄 + 공개 시스템 줄 / mafia = mafia 줄 + 마피아 시스템 줄 / ghost = 받은 줄 전부 시간 순
   * now 를 주면 아직 보류 중인 카드 줄(revealAt > now)을 뺀다. 주지 않으면 보류를 적용하지 않는다.
   */
  visibleLines(channel: ChatChannel | null, now?: number): readonly ChatStoreLine[] {
    const ch: ChatChannel = channel ?? "all";
    let v: readonly ChatStoreLine[];
    if (ch === "ghost") v = this.all;
    else {
      let cached = this.views.get(ch);
      if (!cached) {
        cached = this.all.filter((l) => l.scope === ch);
        this.views.set(ch, cached);
      }
      v = cached;
    }
    if (now === undefined || !v.some((l) => l.revealAt !== undefined && l.revealAt > now)) return v;
    return v.filter((l) => l.revealAt === undefined || l.revealAt <= now);
  }

  /**
   * 아직 보이지 않는 카드 줄 중 가장 이른 공개 시각(없으면 null) — 부르는 쪽이 이 시각에 타이머를 걸어 다시 그린다.
   * 이미 지난 시각은 건너뛴다(nextTypingExpiry 와 같은 규칙)
   */
  nextCardReveal(now: number): number | null {
    let min: number | null = null;
    for (const l of this.all) {
      if (l.revealAt === undefined || l.revealAt <= now) continue;
      if (min === null || l.revealAt < min) min = l.revealAt;
    }
    return min;
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
    this.holdFloor = 0;
    this.liveWhispers = [];
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

/** 서버가 만든 카드 줄(유언·쪽지). k 필드만 보고 판별한다 — 본문 내용으로는 판단하지 않는다(위장 방지, T-09-24) */
function cardLine(f: ChatLineWire, card: "will" | "note", revealAt?: number): ChatStoreLine {
  const line: ChatStoreLine = { key: `${f.ch}:${f.seq}:${f.at}`, kind: "card", card, ch: f.ch, seat: f.seat, seq: f.seq, text: f.text, at: f.at, scope: f.ch };
  if (revealAt !== undefined) line.revealAt = revealAt;
  return line;
}

/**
 * 귓속말 줄(결정 0066-2). k 와 to 가 있어야 한다 — 없으면 줄을 만들지 않는다.
 * whisper = 당사자에게 본문, whispered = 나머지(유령 포함)에게 본문 없는 사실. 사실 줄은 system + whisper 아이콘으로 표현하고 이름은 부르는 쪽(useChat)이 좌석에서 채운다.
 */
function whisperLine(f: ChatLineWire): ChatStoreLine | null {
  if (f.to === undefined) return null;
  const key = `whisper:${f.ch}:${f.seq}:${f.at}`;
  if (f.k === "whisper") return { key, kind: "whisper", ch: f.ch, seat: f.seat, to: f.to, seq: f.seq, text: f.text, at: f.at, scope: f.ch };
  return { key, kind: "system", icon: "whisper", ch: f.ch, seat: f.seat, to: f.to, seq: f.seq, text: "", at: f.at, scope: f.ch };
}
