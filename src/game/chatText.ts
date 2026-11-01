// 채팅 화면 문구 한 곳 (07-UI-SPEC Copywriting Contract). 해요체, 짧게, 마침표·느낌표 없음.
// 이 파일은 shared/protocol.ts 를 가져오지 않는다 — 동작 라벨 표(EMOTE_LABEL)는 EmoteId 가 생긴 뒤 07-05 가 더한다.
//
// 역할 단어가 든 문구(inputLabel.mafia·hint.mafia·channelStart.mafia)는 그 채널을 쓰는 화면(마피아 본인·탈락자)의
// 분기 안에서만 꺼내 쓴다 — 시민 편 DOM 에 "마피아 채팅" 이 미리 들어가면 안 된다 (T-07-08, 누설 검사 대상).

export const CHAT_TEXT = {
  logLabel: "채팅 기록",
  send: "보내기",
  newDot: "새 메시지",
  me: "나",
  typing: "입력 중",
  inputLabel: { all: "채팅 입력", mafia: "마피아 채팅 입력", ghost: "유령 채팅 입력" },
  // 입력칸 안내 문구(HTML placeholder 값). all 은 안내가 없다.
  hint: { all: "", mafia: "마피아끼리만 보여요", ghost: "유령끼리만 보여요" },
  reject: {
    rate: "조금 천천히 보내요",
    repeat: "같은 말은 잠시 뒤에 보내요",
    length: "100자까지 보낼 수 있어요",
    phase: "지금은 보낼 수 없어요",
    other: "보내지 못했어요. 다시 해 보세요",
  },
  channelStart: { mafia: "밤 · 마피아 채팅", ghost: "유령 채팅 · 산 사람에게 안 보여요" },
  // 6페이즈 TopToast 와 같은 문구
  joined: (name: string) => `${name} 님 입장`,
  left: (name: string) => `${name} 님 퇴장`,
} as const;

// RED 뼈대: GREEN 에서 채운다.
import type { EmoteId } from "../../shared/protocol";
export const EMOTE_LABEL = {} as Readonly<Record<EmoteId, string>>;
