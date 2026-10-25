// 빠른 메시지 문장·문구 칩·이모티콘 이름의 단일 출처. 서버는 템플릿 ID 만 보내고(COMM-04) 문장은 여기서 만든다.
// 문자열만 만든다 — HTML 을 만들지 않고, 호출하는 쪽이 React 텍스트로만 그린다(T-02-21).
import type { RoleId } from "../../shared/game/roles";
import type { EmojiId, TemplateId } from "../../shared/protocol";
import { CLAIM_LINE, CLAIM_NONE_LINE, ROLE_TEXT } from "./roleText";

/** 빈 대상 자리(흰 동그라미 두 개). 시트 미리보기와 칩이 같은 글자를 쓴다 */
const BLANK_TARGET = "[○○]";
const BLANK_ROLE = "[직업]";

/** 시트의 문구 칩 순서(고정). */
export const TEMPLATE_ORDER: readonly TemplateId[] = ["suspect", "trust", "innocent", "claimed", "vote"];

/** 밤 시트의 문구 칩 순서(고정, N-2). 낮 칩은 TEMPLATE_ORDER. */
export const NIGHT_TEMPLATE_ORDER: readonly TemplateId[] = ["nightTarget", "nightAgree", "nightOther"];

/** 문구 칩 글자. */
export const TEMPLATE_CHIP: Readonly<Record<TemplateId, string>> = {
  suspect: "[○○] 의심돼요",
  trust: "[○○] 믿어요",
  innocent: "저 아니에요",
  claimed: "[○○]는 [직업]이었어요",
  vote: "[○○] 투표해요",
  nightTarget: "[○○] 지목해요",
  nightAgree: "동의해요",
  nightOther: "다른 사람을 지목해요",
  // 표시 전용(결정 0027-7): 주장 줄에만 쓰고 칩 목록(TEMPLATE_ORDER·NIGHT_TEMPLATE_ORDER)에는 쓰이지 않는다
  claimRole: "저는 [직업]이에요",
  claimNone: "말하지 않았어요",
};

/** 이모티콘 화면 읽기용 이름과 트레이 칸 글자. */
export const EMOJI_TEXT: Readonly<Record<EmojiId, { name: string; cell: string }>> = {
  smile: { name: "웃음", cell: "웃음" },
  grin: { name: "크게 웃음", cell: "크게" },
  surprised: { name: "놀람", cell: "놀람" },
  suspicious: { name: "의심", cell: "의심" },
  angry: { name: "화남", cell: "화남" },
  sad: { name: "슬픔", cell: "슬픔" },
  heart: { name: "좋아요", cell: "좋아요" },
  exclaim: { name: "느낌표", cell: "느낌표" },
};

/** 한글 음절이고 받침이 있으면 true. 한글이 아니면(영문·숫자·이모지·결합 문자·빈 문자열) false. */
export function hasBatchim(ch: string): boolean {
  if (ch.length === 0) return false;
  const c = ch.charCodeAt(0);
  return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0;
}

// 이름 끝 글자는 마지막 UTF-16 코드 유닛으로 본다. 이모지·결합 문자로 끝나면 한글 판정에서 false → "는".
const lastUnit = (s: string): string => s.charAt(s.length - 1);

/**
 * 템플릿 ID·대상 seat·직업으로 한국어 문장을 만든다. 대상·직업이 비어 있으면 그 자리는 "[○○]"·"[직업]" 글자 그대로
 * 들어간다(시트 미리보기). nicknameOf 가 undefined 를 주어도 "[○○]" 이다.
 */
export function messageText(
  msg: { template: TemplateId; target?: number; claimedRole?: RoleId },
  nicknameOf: (seat: number) => string | undefined,
): string {
  const nick = msg.target === undefined ? undefined : nicknameOf(msg.target);
  const who = nick ?? BLANK_TARGET;
  switch (msg.template) {
    case "suspect":
      return `${who} 의심돼요`;
    case "trust":
      return `${who} 믿어요`;
    case "vote":
      return `${who} 투표해요`;
    case "innocent":
      return "저 아니에요";
    case "nightTarget":
      return `${who} 지목해요`;
    case "nightAgree":
      return "동의해요";
    case "nightOther":
      return "다른 사람을 지목해요";
    case "claimRole":
      return msg.claimedRole === undefined ? CLAIM_NONE_LINE : CLAIM_LINE[msg.claimedRole];
    case "claimNone":
      return CLAIM_NONE_LINE;
    case "claimed": {
      // 닉네임이 없어 "[○○]" 인 경우의 조사는 칩 문구와 같게 "는"
      const josa = nick !== undefined && hasBatchim(lastUnit(nick)) ? "은" : "는";
      if (msg.claimedRole === undefined) return `${who}${josa} ${BLANK_ROLE}이었어요`;
      const role = ROLE_TEXT[msg.claimedRole].name;
      return `${who}${josa} ${role}${hasBatchim(lastUnit(role)) ? "이었어요" : "였어요"}`;
    }
  }
}
