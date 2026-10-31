// minifia v2.0 게임 겹침 부품 — window.MinifiaV2. React 18 은 쓰는 쪽이 준다.

/** 단계 머리: 단계 이름, 지금 할 일 한 문장, 남은 시간 */
export interface PhaseHeaderProps {
  /** 단계 이름. 예: "지목" */
  title: string;
  /** 지금 할 일 한 문장(화면마다 하나). 예: "가장 의심되는 사람을 가리켜요" */
  hint?: string;
  /** 남은 초. 없으면 숫자를 그리지 않는다 */
  time?: number;
  /** 마지막 5초면 true — 숫자가 crimson-400 */
  urgent?: boolean;
}

/** 3D 장면 위 이름표 */
export interface NameTagProps {
  name: string;
  /** 자리 구분색 seat-1~8 값 */
  color: string;
  /** 내 캐릭터면 true — "(나)" 와 테두리 */
  me?: boolean;
  /** 연결이 끊긴 사람이면 true — 흐리게 */
  away?: boolean;
}

/** 득표 배지(결정 0049) */
export interface VoteBadgeProps {
  /** 받은 표 수. 0 이면 그리지 않는다 */
  count: number;
  /** 최다 득표가 이 사람 한 명이면 true — 맥박·빛 번짐 */
  lead?: boolean;
}

/** 과반 도장 */
export interface SureStampProps {
  /** 기본 "유력" */
  label?: string;
}

/** 머리 위 쌓임: 도장 · 배지 · 이름표 */
export interface HeadStackProps extends NameTagProps {
  count?: number;
  lead?: boolean;
  /** 과반이면 true — "유력" 도장 */
  sure?: boolean;
}

/** 화면 위 지목 알림 한 줄 */
export interface TopToastProps {
  /** 예: "민준 → 도윤", 몰리면 "지호·민준 → 도윤" */
  text: string;
  visible: boolean;
}

export interface ChatMessage {
  /** player: 사람 메시지 · system: 단계 안내 · vote: 지목 기록 · hot: 선두·과반 소식 */
  kind: 'player' | 'system' | 'vote' | 'hot';
  text: string;
  /** player 만 */
  name?: string;
  /** player 만. 자리 구분색 */
  color?: string;
  /** 마피아 밤 채팅(마피아 본인 화면에서만 보인다) */
  channel?: 'all' | 'mafia' | 'ghost';
}

/** 채팅 기록 + 입력 */
export interface ChatPanelProps {
  messages: ChatMessage[];
  value?: string;
  onChange?: (value: string) => void;
  /** 없으면 입력줄을 그리지 않는다(기록만) */
  onSend?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** 한 화면에 둘 이상이면 서로 다른 id */
  inputId?: string;
}

/** 동작 목록 */
export interface EmoteSheetProps {
  emotes: { id: string; label: string }[];
  onPick?: (id: string) => void;
  disabled?: boolean;
}

/** 로비 맵 선택(결정 0050) */
export interface MapPickerProps {
  maps: { id: string; label: string; desc?: string }[];
  /** 고른 맵 id. 기본 "random" */
  value: string;
  onChange?: (id: string) => void;
  /** 방장이면 true. 아니면 지금 맵을 글로만 본다 */
  host?: boolean;
}
