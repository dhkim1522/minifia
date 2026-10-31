// minifia v2.0 게임 겹침 부품 — window.MinifiaV2. React 18 은 쓰는 쪽이 준다.
// 결정 0051: 글은 최소로, 보고 누르는 조작 중심.

export type IconName =
  | 'throat' | 'deny' | 'clap' | 'cry' | 'handshake' | 'point' | 'praise' | 'surprise' | 'dance'
  | 'face' | 'hanger' | 'map' | 'skip' | 'check' | 'send' | 'close' | 'play' | 'question' | 'thumbUp' | 'thumbDown';

/** 직접 그린 SVG 아이콘(currentColor) */
export interface IconProps {
  name: IconName;
  /** px, 기본 24 */
  size?: number;
  /** 혼자 뜻을 전할 때 읽어 주는 이름. 없으면 장식(aria-hidden) */
  label?: string;
  className?: string;
}

/** 단계 머리: 단계 이름 + 시간 링 + 접히는 안내 한 줄 */
export interface PhaseHeaderProps {
  title: string;
  hint?: string;
  /** 단계 시작 뒤 약 2.5초만 true. false 면 안내가 접힌다 */
  showHint?: boolean;
  /** 남은 초 */
  time?: number;
  /** 단계 전체 초. 있어야 링을 그린다 */
  total?: number;
}

/** 점 진행 ●●●○○ */
export interface DotProgressProps {
  count: number;
  total: number;
  /** 읽어 주는 이름. 예: "토론 끝내기" */
  label?: string;
}

/** 3D 장면 위 이름표 */
export interface NameTagProps {
  name: string;
  /** 자리 구분색 seat-1~8 값 */
  color: string;
  me?: boolean;
  away?: boolean;
  /** 지목에서 내가 가리킨 사람 */
  mine?: boolean;
  /** 찬반에서 투표한 사람 */
  done?: boolean;
  /** 누를 수 있다는 손짓(세 번 깜빡) */
  blink?: boolean;
}

export interface VoteBadgeProps { count: number; lead?: boolean; }
export interface SureStampProps { label?: string; }

/** 머리 위 쌓임: 입력 중 · 도장 · 배지 · 이름표 */
export interface HeadStackProps extends NameTagProps {
  typing?: boolean;
  count?: number;
  lead?: boolean;
  sure?: boolean;
}

/** 화면 위 알림 한 줄 */
export interface TopToastProps { text: string; visible: boolean; icon?: IconName; }

export interface ChatMessage {
  /** player: 사람 · system: 단계 안내 · vote: 지목 기록 · hot: 선두·과반 소식 */
  kind: 'player' | 'system' | 'vote' | 'hot';
  text: string;
  /** 시스템 메시지 앞 아이콘. 예: vote 는 'point' */
  icon?: IconName;
  name?: string;
  color?: string;
  channel?: 'all' | 'mafia' | 'ghost';
}

/** 채팅: 기록 + [감정표현] 입력 [보내기] */
export interface ChatPanelProps {
  messages: ChatMessage[];
  value?: string;
  onChange?: (value: string) => void;
  /** 없으면 입력줄을 그리지 않는다 */
  onSend?: (value: string) => void;
  /** 감정표현 9종. 비우면 감정표현 버튼이 없다(밤 등) */
  emotes?: { id: IconName; label: string }[];
  onEmote?: (id: IconName) => void;
  placeholder?: string;
  disabled?: boolean;
  inputId?: string;
}

/** 꾸미기 창(로비): 방장은 맵·의상 두 탭, 다른 사람은 의상만 */
export interface DressSheetProps {
  host?: boolean;
  /** 랜덤은 img 없이 */
  maps?: { id: string; label: string; img?: string }[];
  mapId?: string;
  onMap?: (id: string) => void;
  outfits: { id: string; label: string; img: string }[];
  outfitId: string;
  onOutfit?: (id: string) => void;
  /** 방장이 처음 볼 탭. 기본 'map' */
  tab?: 'map' | 'outfit';
  onClose?: () => void;
}

/** 역할 카드(v1.0 직업 카드) */
export interface RoleCardProps {
  role?: 'mafia' | 'police' | 'doctor' | 'citizen';
  name?: string;
  desc?: string;
  img?: string;
  /** 마피아 동료 줄. 예: "동료 · 수아" */
  mates?: string;
  face: 'back' | 'front';
  onFlip?: () => void;
}

/** 찬반: 엄지 위·아래 */
export interface VerdictPickerProps {
  value?: 'yes' | 'no';
  onChange?: (value: 'yes' | 'no') => void;
  disabled?: boolean;
}
