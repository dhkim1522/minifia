// 채팅 줄 보관의 순수 규칙(결정 0058): 줄 레코드, 채널별 연번, 수신자 좌석 마스크, 채널별 30줄 복원, 채널별 보관 상한.
// 순수 모듈이다: 시각·난수를 읽지 않고 입력을 바꾸지 않으며, DOM·workerd API 가 없다(앱·워커 두 tsconfig 에 모두 들어간다).
// 저장 I/O 는 이 파일에 없다 — 방 Durable Object 가 chatKey 로 줄 단위 저장·삭제를 한다(07-14). 이 파일은 무엇을 쓰고 지우고 돌려줄지만 정한다.
// 마스크(r)·쓰기 순번(g)·일차(n)는 저장 전용이다. 와이어로 나가는 모양은 toWire 가 키 다섯(ch·seat·seq·text·at)과, 카드 줄일 때만 k 를 복사한 것이다.
// 복원은 '지금의 역할·생존'으로 다시 계산하지 않는다 — 보낼 때 audience 가 정한 마스크로만 한다(복원이 라이브보다 넓어지지 않는다).
import { MAX_PLAYERS } from "../protocol";
import type { ChatChannel, ChatLineWire } from "../protocol";

/** 저장 키 접두어. 줄 하나가 키 하나(`chat:000001`)다. room 키에 넣지 않는다(결정 0058-1). */
export const CHAT_KEY_PREFIX = "chat:";
/** 복원 줄 수: 채널마다 최근 이만큼(최대 3채널 × 30). 값은 이 상수 하나에서 조정한다(결정 0058-3). */
export const CHAT_REPLAY_PER_CHANNEL = 30;
/** 채널별 보관 상한. 11페이즈 공개가 판 전체의 마피아·유령 줄을 쓰므로 둘을 공개 줄보다 넉넉히 둔다(결정 0058-4). */
export const CHAT_KEEP: Readonly<Record<ChatChannel, number>> = { all: 100, mafia: 300, ghost: 300 };
/** 상한을 넘으면 그 채널의 가장 오래된 줄부터 이만큼씩 묶어 지운다(삭제 쓰기 횟수를 줄인다). */
export const CHAT_EVICT_BATCH = 20;

const CHANNELS: readonly ChatChannel[] = ["all", "mafia", "ghost"];
/** 좌석 비트마스크의 최댓값(좌석 0~7 → 8비트). */
const MASK_MAX = (1 << MAX_PLAYERS) - 1;

/** 저장되는 줄 하나. g = 방 전체 쓰기 순서(저장 키), seq = 채널별 번호, n = 일차, r = 보낼 때의 수신자 좌석 마스크. */
export interface ChatRecord {
  g: number;
  ch: ChatChannel;
  seq: number;
  seat: number;
  text: string;
  at: number;
  n: number;
  r: number;
  /** 서버가 사망 전환에서 만든 카드 줄(유언·쪽지, 결정 0061-11). 사람이 보낸 줄에는 키 자체가 없다. */
  k?: "will" | "note";
}

export interface ChatLog {
  /** g 오름차순. */
  records: readonly ChatRecord[];
  nextG: number;
  /** 채널마다 따로 센다 — 공개 줄 번호에 비공개 채널 줄 수가 드러나지 않는다(결정 0058-5). */
  nextSeq: Readonly<Record<ChatChannel, number>>;
}

export function emptyChatLog(): ChatLog {
  return { records: [], nextG: 1, nextSeq: { all: 1, mafia: 1, ghost: 1 } };
}

/** 쓰기 순번 g 의 저장 키: 'chat:' + 6자리 0패딩(넘으면 그대로). 6자리 안에서는 문자열 정렬이 쓰기 순서와 같다. */
export function chatKey(g: number): string {
  return `${CHAT_KEY_PREFIX}${String(g).padStart(6, "0")}`;
}

/** 받는 사람 id 집합을 좌석 비트마스크로. 방에 없는 id 와 범위 밖 좌석은 무시한다. */
export function seatMask(players: readonly { id: string; seat: number }[], ids: ReadonlySet<string>): number {
  let mask = 0;
  for (const p of players) {
    if (ids.has(p.id) && Number.isInteger(p.seat) && p.seat >= 0 && p.seat < MAX_PLAYERS) mask |= 1 << p.seat;
  }
  return mask;
}

/**
 * 줄 하나를 더한다. 입력 로그는 바꾸지 않고 새 객체를 돌려준다.
 * 그 채널의 줄이 보관 상한을 넘으면 그 채널의 가장 오래된 줄부터 CHAT_EVICT_BATCH 줄을 지울 쓰기 순번(g, 오름차순)을 evicted 로 돌려준다.
 * 새 줄은 지우지 않고, 다른 채널 줄도 건드리지 않는다. 번호는 지워도 되돌아가지 않는다.
 */
export function appendLine(
  log: ChatLog,
  input: { ch: ChatChannel; seat: number; text: string; at: number; n: number; r: number; k?: "will" | "note" },
): { log: ChatLog; record: ChatRecord; evicted: number[] } {
  const record: ChatRecord = {
    g: log.nextG,
    ch: input.ch,
    seq: log.nextSeq[input.ch],
    seat: input.seat,
    text: input.text,
    at: input.at,
    n: input.n,
    r: input.r,
    ...(input.k === undefined ? {} : { k: input.k }),
  };
  let records: ChatRecord[] = [...log.records, record];
  const inChannel = records.filter((x) => x.ch === input.ch);
  const over = inChannel.length - CHAT_KEEP[input.ch];
  let evicted: number[] = [];
  if (over > 0) {
    evicted = inChannel.slice(0, Math.max(CHAT_EVICT_BATCH, over)).map((x) => x.g);
    const gone = new Set(evicted);
    records = records.filter((x) => !gone.has(x.g));
  }
  return {
    log: { records, nextG: log.nextG + 1, nextSeq: { ...log.nextSeq, [input.ch]: log.nextSeq[input.ch] + 1 } },
    record,
    evicted,
  };
}

/** 와이어 모양. 필드별로 복사한다 — 펼쳐 복사하면 마스크·g·일차나 덧붙은 키가 함께 나간다. k 는 카드 줄일 때만 복사한다. */
export function toWire(record: ChatRecord): ChatLineWire {
  const wire: ChatLineWire = { ch: record.ch, seat: record.seat, seq: record.seq, text: record.text, at: record.at };
  if (record.k !== undefined) wire.k = record.k;
  return wire;
}

/**
 * 접속한 좌석이 받을 복원 줄. 보낼 때 저장한 마스크에 이 좌석 비트가 켜진 줄만, 채널별 최근 perChannel 줄,
 * 보낸 순서(g 오름차순)로 돌려준다. 같은 대본에서 라이브로 받은 줄의 채널별 최근 줄과 같다.
 */
export function replayFor(log: ChatLog, seat: number, perChannel: number = CHAT_REPLAY_PER_CHANNEL): ChatLineWire[] {
  if (!Number.isInteger(seat) || seat < 0 || seat >= MAX_PLAYERS) return [];
  const mine = log.records.filter((x) => ((x.r >> seat) & 1) === 1);
  const picked = new Set<number>();
  for (const ch of CHANNELS) {
    for (const x of mine.filter((m) => m.ch === ch).slice(-perChannel)) picked.add(x.g);
  }
  return mine.filter((x) => picked.has(x.g)).map(toWire);
}

function isChannel(v: unknown): v is ChatChannel {
  return v === "all" || v === "mafia" || v === "ghost";
}

/** 저장된 값 하나가 줄 레코드 모양이면 필드별로 복사해 돌려주고, 아니면 null. 덧붙은 키는 버린다. */
function parseRecord(raw: unknown): ChatRecord | null {
  if (typeof raw !== "object" || raw === null) return null;
  const v = raw as Record<string, unknown>;
  const { g, ch, seq, seat, text, at, n, r } = v;
  if (typeof g !== "number" || !Number.isInteger(g) || g < 1) return null;
  if (!isChannel(ch)) return null;
  if (typeof seq !== "number" || !Number.isInteger(seq) || seq < 1) return null;
  if (typeof seat !== "number" || !Number.isInteger(seat) || seat < 0 || seat >= MAX_PLAYERS) return null;
  if (typeof text !== "string") return null;
  if (typeof at !== "number" || !Number.isFinite(at)) return null;
  if (typeof n !== "number" || !Number.isInteger(n) || n < 0) return null;
  if (typeof r !== "number" || !Number.isInteger(r) || r < 0 || r > MASK_MAX) return null;
  if (v.k === undefined) return { g, ch, seq, seat, text, at, n, r };
  if (v.k !== "will" && v.k !== "note") return null;
  return { g, ch, seq, seat, text, at, n, r, k: v.k };
}

/**
 * 저장소에서 읽은 값들로 로그를 되살린다(DO 생성자, `list({prefix: "chat:"})` 의 값들). 순서가 섞여 있어도 되고,
 * 손상 레코드는 버리고 같은 g 가 둘이면 먼저 온 쪽만 남긴다. nextG = 최대 g + 1, nextSeq[채널] = 그 채널 최대 seq + 1(없으면 1).
 */
export function restoreChatLog(stored: Iterable<unknown>): ChatLog {
  const byG = new Map<number, ChatRecord>();
  for (const raw of stored) {
    const rec = parseRecord(raw);
    if (rec !== null && !byG.has(rec.g)) byG.set(rec.g, rec);
  }
  const records = [...byG.values()].sort((a, b) => a.g - b.g);
  const log = emptyChatLog();
  const nextSeq: Record<ChatChannel, number> = { ...log.nextSeq };
  let nextG = 1;
  for (const rec of records) {
    nextG = Math.max(nextG, rec.g + 1);
    nextSeq[rec.ch] = Math.max(nextSeq[rec.ch], rec.seq + 1);
  }
  return { records, nextG, nextSeq };
}
