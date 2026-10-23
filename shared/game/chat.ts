// 낮 토론 빠른 메시지 규칙(COMM-01, COMM-04). 순수 모듈이다 — 현재 시각은 인자 now 로만 받고,
// DOM·workerd API 를 쓰지 않으며, 입력 상태는 바꾸지 않는다.
//
// 서버는 문장을 만들지 않는다: 보관하는 것은 템플릿 ID·대상 seat·직업 값뿐이고 문장은 화면이 만든다(T-02-07).
// 주장의 참·거짓은 보지 않는다(D-10): 이 파일은 플레이어의 실제 역할 필드를 읽지 않는다.
// 보낸 사람은 입력이 아니라 actorId 로 서버 상태에서 찾는다(T-02-08).
import type { ChatLine, TemplateId } from "../protocol";
import { isAlive } from "./alive";
import type { RoleId } from "./roles";
import { rolesInPlay } from "./roles";
import type { Player, RoomState } from "./room";

/**
 * 템플릿 표(D-11). 문구를 늘리려면 TEMPLATE_IDS(protocol.ts)와 이 표에 행을 더한다.
 * target: 대상 칸이 필요한가, role: 직업 칸이 필요한가. 주석은 화면 문장이고 서버는 만들지 않는다.
 */
export const QUICK_TEMPLATES: Readonly<Record<TemplateId, { target: boolean; role: boolean }>> = Object.freeze({
  suspect: Object.freeze({ target: true, role: false }), // "{닉네임} 의심돼요"
  trust: Object.freeze({ target: true, role: false }), // "{닉네임} 믿어요"
  claimed: Object.freeze({ target: true, role: true }), // "{닉네임}은/는 {직업}이었어요"
  innocent: Object.freeze({ target: false, role: false }), // "저 아니에요"
  vote: Object.freeze({ target: true, role: false }), // "{닉네임} 투표해요"
});

/** 낮마다 보관하는 최근 메시지 수(D-15). */
export const MESSAGE_KEEP = 20;
/** 메시지·이모티콘 합산 전송 간격(D-14). */
export const SEND_COOLDOWN_MS = 2_000;

export type SayInput = { template: TemplateId; target?: number; claimedRole?: RoleId };
export type ChatError = "WRONG_PHASE" | "BAD_MESSAGE" | "RATE_LIMITED";

/** 이 페이즈의 탈락자 거부 코드는 BAD_MESSAGE 다(A4) — 3페이즈가 탈락을 만들 때 확정한다. */
function senderOf(state: RoomState, actorId: string): ChatError | Player {
  if (state.phase !== "discussion") return "WRONG_PHASE";
  const sender = state.players.find((p) => p.id === actorId);
  if (!sender || !isAlive(sender)) return "BAD_MESSAGE";
  return sender;
}

const coolingDown = (sender: Player, now: number): boolean => now - (sender.lastSendAt ?? -Infinity) < SEND_COOLDOWN_MS;

/**
 * 빠른 메시지. 검사 순서가 계약이다: 단계 → 보낸 사람(방에 있음·생존) → 템플릿(고유 속성) → 칸 과부족
 * → 대상(정수·앉은 seat·본인 아님·생존) → 직업(rolesInPlay 안, none 불가) → 쿨다운.
 * 거부는 상태를 바꾸지 않는다(쿨다운 위반도 lastSendAt 을 늘리지 않는다, A1).
 * 끊긴 사람을 대상으로 한 메시지는 허용한다(UI-SPEC S-08a).
 */
export function say(
  state: RoomState,
  actorId: string,
  input: SayInput,
  now: number,
): { ok: true; state: RoomState; line: ChatLine } | { ok: false; error: ChatError } {
  const sender = senderOf(state, actorId);
  if (typeof sender === "string") return { ok: false, error: sender };

  const template = input.template;
  // 고유 속성만 인정한다 — "constructor"·"toString" 같은 프로토타입 키가 표를 우회하지 못하게.
  if (typeof template !== "string" || !Object.hasOwn(QUICK_TEMPLATES, template)) return { ok: false, error: "BAD_MESSAGE" };
  const { target: needsTarget, role: needsRole } = QUICK_TEMPLATES[template];
  const target = input.target;
  const claimedRole = input.claimedRole;
  if ((target !== undefined) !== needsTarget || (claimedRole !== undefined) !== needsRole) {
    return { ok: false, error: "BAD_MESSAGE" };
  }

  if (target !== undefined) {
    if (!Number.isInteger(target) || target === sender.seat) return { ok: false, error: "BAD_MESSAGE" };
    const seated = state.players.find((p) => p.seat === target);
    if (!seated || !isAlive(seated)) return { ok: false, error: "BAD_MESSAGE" };
  }
  if (claimedRole !== undefined && !rolesInPlay(state.players.length).includes(claimedRole)) {
    return { ok: false, error: "BAD_MESSAGE" };
  }

  if (coolingDown(sender, now)) return { ok: false, error: "RATE_LIMITED" };

  // 필드를 하나씩 써서 만든다 — 입력 객체를 펼쳐 복사하지 않아 알 수 없는 키가 끼어들 수 없다(T-02-07).
  const seq = state.nextMessageSeq ?? 1;
  const line: ChatLine = {
    seq,
    seat: sender.seat,
    template,
    ...(target !== undefined ? { target } : {}),
    ...(claimedRole !== undefined ? { claimedRole } : {}),
    at: now,
  };
  return {
    ok: true,
    line,
    state: {
      ...state,
      messages: [...(state.messages ?? []), line].slice(-MESSAGE_KEEP),
      nextMessageSeq: seq + 1,
      players: state.players.map((p) => (p.id === sender.id ? { ...p, lastSendAt: now } : p)),
    },
  };
}
