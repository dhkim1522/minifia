// 귓속말의 순수 화면 모델 (09.1.1-09, UI-SPEC B). 서버 view 와 채팅 줄만 읽는다 — 실제 역할(view.me.role·spectate)은 읽지 않는다(L10·L23).
// 시각·난수를 읽지 않고 입력을 바꾸지 않는다. 하루 1번 횟수는 서버가 세고, 화면은 view.me.whisperUsed 로만 안다(O-4).
import { isAlive } from "../../shared/game/alive";
import { WHISPER_PHASES } from "../../shared/game/whisper";
import type { RoomView } from "../../shared/protocol";

/** 화면 문구 단일 출처 (UI-SPEC Copywriting Contract 원문) */
export const WHISPER_TEXT = {
  /** 모드가 켜져 있는 동안의 헤더 안내 */
  modeHint: "귓속말할 사람을 눌러요",
  /** 이름표 묶음의 접근성 이름 */
  groupLabel: "귓속말",
  tagLabel: (nickname: string): string => `${nickname} 님에게 귓속말`,
  floatReady: "귓속말 보내기, 오늘 1번 남음",
  floatUsed: "오늘 귓속말을 이미 보냈어요",
  placeholder: (name: string): string => `${name} 님에게만 보여요`,
  inputLabel: "귓속말 입력",
  send: "보내기",
  close: "닫기",
  /** 받은 순간 위 알림(본문 없음) */
  received: (name: string): string => `${name} 님의 귓속말`,
  /** 마감 직후 보냈을 때(단계 어긋남) */
  rejectPhase: "지금은 보낼 수 없어요",
  /** 그 밖의 거절 */
  rejectOther: "보내지 못했어요. 다시 해 보세요",
  fact: (from: string, to: string): string => `${from} → ${to} 귓속말`,
  toMe: (from: string): string => `${from} → 나`,
  fromMe: (to: string): string => `나 → ${to}`,
} as const;

/** 버튼·모드·시트를 낼 수 있는가: 낮 토론(O-3)이고 내가 산 사람이고 나를 뺀 산 사람이 1명 이상. 유령에게는 만들지 않는다(O-21) */
export function whisperVisible(view: RoomView): boolean {
  if (!WHISPER_PHASES.has(view.phase)) return false;
  const me = view.players.find((p) => p.seat === view.me.seat);
  if (me === undefined || !isAlive(me)) return false;
  return view.players.some((p) => p.seat !== view.me.seat && isAlive(p));
}

/** 오늘 이미 보냈는가 — 서버가 본인 view 에만 싣는 값 */
export function whisperUsed(view: RoomView): boolean {
  return view.me.whisperUsed === true;
}

/** 귓속말 이름표 대상: 나를 뺀 산 사람의 좌석(권위는 서버 sendWhisper) */
export function whisperTargets(view: RoomView): ReadonlySet<number> {
  return new Set(view.players.filter((p) => p.seat !== view.me.seat && isAlive(p)).map((p) => p.seat));
}

/** 채팅 저장소 줄 중 귓속말 계열을 알아보는 재료(ChatStoreLine 의 부분) */
export interface WhisperSource {
  kind: string;
  seat?: number;
  to?: number;
  icon?: string;
  text: string;
}

export interface WhisperLineModel {
  /** system = 공개 사실 줄, whisper = 비공개 블록 */
  kind: "system" | "whisper";
  /** 누구에게 보이는 줄인가: public = 제3자·유령, in = 받은 사람, out = 보낸 사람 */
  whisper: "public" | "in" | "out";
  icon: "whisper";
  /** 비공개 블록의 첫 줄 "{A} → 나" / "나 → {B}" */
  title?: string;
  text: string;
}

/**
 * 귓속말 줄 하나를 화면 줄 모델로. 귓속말 줄이 아니면 null.
 * 본문 줄(kind whisper)은 서버가 당사자 소켓에만 보낸 것이다 — 보낸 사람(out)·받는 사람(in)일 때만 그린다. 사실 줄(system + whisper 아이콘 + to)의 이름은 좌석에서 채운다.
 */
export function whisperLine(line: WhisperSource, mySeat: number, nameOf: (seat: number) => string): WhisperLineModel | null {
  if (line.seat === undefined || line.to === undefined) return null;
  if (line.kind === "system" && line.icon === "whisper") {
    return { kind: "system", whisper: "public", icon: "whisper", text: WHISPER_TEXT.fact(nameOf(line.seat), nameOf(line.to)) };
  }
  if (line.kind !== "whisper") return null;
  if (line.to === mySeat) return { kind: "whisper", whisper: "in", icon: "whisper", title: WHISPER_TEXT.toMe(nameOf(line.seat)), text: line.text };
  if (line.seat === mySeat) return { kind: "whisper", whisper: "out", icon: "whisper", title: WHISPER_TEXT.fromMe(nameOf(line.to)), text: line.text };
  return null; // 당사자가 아닌 본문 줄은 서버가 보내지 않는다 — 혹시 와도 그리지 않는다
}
