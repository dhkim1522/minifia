// 시상 칭호 문구 한 곳 (11-09, 결정 0054-2·D-5, UI-SPEC B-1): 칭호 12개의 이름·아이콘·이유 문구를 여기서만 만든다.
// 서버는 id 와 점수(k)·시점(at)만 보내고(shared/protocol.ts AwardLine) 문구는 화면 몫이다. 이유는 k·at 만으로 만들고 직업·기록은 읽지 않는다(T-11-32).
// 해요체 명사형, 마침표·느낌표·이모지 없음. 알 수 없는 id 는 던지지 않고 이름·이유 없이 안전하게 돌려준다.
import type { AwardId, AwardLine } from "../../shared/protocol";
import type { V2IconName } from "../components/v2/V2Icon";

interface AwardSpec {
  name: string;
  icon: V2IconName;
  /** k 가 있을 때의 이유 */
  reason(k: number, at: AwardLine["at"]): string;
  /** k 가 없거나 이상할 때의 이유(숫자 없이) */
  plain: string;
}

const SPECS: Readonly<Record<AwardId, AwardSpec>> = {
  actor: { name: "연기대상", icon: "roleMafia", reason: (k) => `거짓 주장 ${k}일`, plain: "거짓 주장" },
  detective: { name: "명탐정", icon: "eye", reason: (k) => `마피아를 ${k}번 가리킴`, plain: "마피아를 가리킴" },
  angel: { name: "수호천사", icon: "heal", reason: (k) => `${k}번 지킴`, plain: "지킴" },
  whiff: { name: "헛다리왕", icon: "point", reason: (k) => `헛다리 ${k}번`, plain: "헛다리" },
  target: { name: "과녁", icon: "target", reason: (k) => `${k}번 지목당함`, plain: "지목당함" },
  firstVictim: { name: "첫 희생자", icon: "ghost", reason: (k) => `${k}밤에 당함`, plain: "첫 희생" },
  talker: { name: "수다왕", icon: "send", reason: (k) => `채팅 ${k}번`, plain: "채팅 많음" },
  swapper: { name: "말 바꿈 왕", icon: "swap", reason: (k) => `주장 ${k}번 바꿈`, plain: "주장 바꿈" },
  whisperer: { name: "귓속말 달인", icon: "whisper", reason: (k) => `귓속말 ${k}번`, plain: "귓속말" },
  mood: { name: "분위기 메이커", icon: "dance", reason: (k) => `동작 ${k}번`, plain: "동작" },
  survivor: { name: "생존자", icon: "check", reason: () => "끝까지 남음", plain: "끝까지 남음" },
  spectator: { name: "관전자", icon: "ghost", reason: (k, at) => (at === "night" ? `${k}일차 밤 탈락` : at === "day" ? `${k}일차 낮 탈락` : `${k}일차 탈락`), plain: "탈락" },
};

/** 시상식 헤더 제목(UI-SPEC A-1) */
export const CEREMONY_TITLE = "시상식";

const specOf = (id: string): AwardSpec | null => (Object.hasOwn(SPECS, id) ? SPECS[id as AwardId] : null);
const validK = (k: unknown): k is number => typeof k === "number" && Number.isFinite(k) && k >= 0;

/** 칭호 이름. 알 수 없는 id 는 빈 문자열 */
export function awardName(id: string): string {
  return specOf(id)?.name ?? "";
}

/** 칭호 아이콘. 알 수 없는 id 는 trophy */
export function awardIcon(id: string): V2IconName {
  return specOf(id)?.icon ?? "trophy";
}

/** 이유 한 줄. k 가 없는 칭호(survivor)는 숫자 없이, k 가 빠진 줄은 숫자 없는 말로 안전하게 */
export function awardReason(line: Pick<AwardLine, "award" | "k" | "at">): string {
  const spec = specOf(line.award);
  if (spec === null) return "";
  if (line.award === "survivor") return spec.reason(0, undefined);
  return validK(line.k) ? spec.reason(line.k, line.at) : spec.plain;
}

/** 스크린리더 문구: '{닉네임}, {칭호}, {이유}' (비어 있는 조각은 뺀다) */
export function awardAria(nickname: string, line: Pick<AwardLine, "award" | "k" | "at">): string {
  return [nickname, awardName(line.award), awardReason(line)].filter((s) => s !== "").join(", ");
}
