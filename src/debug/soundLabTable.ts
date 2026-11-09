// 소리 시험 페이지의 표 — 합격 문턱·단계 묶음·한글 이름 (12-06, D-18, D-19, UI-SPEC E).
// 시험 페이지 본체(soundLab.ts)만 가져온다: 운영 번들의 perfProbe 가 가져오는 soundLabData.ts 와 분리해 이 표가 진입 번들에 들어가지 않게 한다.
import type { SfxId, SoundId } from "../audio/recipes";

/**
 * 오프라인 렌더 합격 문턱 (D-18, T-12-22). 낮추지 않는다: 실패하면 레시피를 고친다.
 * E2E 쪽 문턱(scripts/e2e/lib.mjs SOUND_RENDER_LIMITS)과 같아야 하고 e2eContract 시험이 대조한다.
 */
export const SOUND_LIMITS = {
  /** 소리 id 수: 침대 7 + 효과음 51 */
  count: 58,
  peakMaxDb: -3,
  rmsMinDb: -60,
  /** 효과음 측정 길이와 선언 길이의 허용 차이(ms) */
  lengthTolMs: 50,
} as const;

export interface LabGroup {
  key: string;
  title: string;
  ids: readonly SfxId[];
}

/** 효과음 51개를 단계로 묶는다(UI-SPEC C-2 의 표 제목 순서). 합집합이 SFX_IDS 전부 — 시험이 확인한다 */
export const LAB_GROUPS: readonly LabGroup[] = [
  { key: "common", title: "공통·로비·역할", ids: ["ui.tap", "ui.toggle", "ui.deny", "ui.card", "ui.host", "lobby.join", "game.start", "role.flip"] },
  {
    key: "day",
    title: "낮·지목·변론",
    ids: ["day.start", "timer.tick", "phase.vote", "pin.on", "pin.move", "pick.turn", "pick.tick", "pick.point", "pick.skip", "runoff.intro", "runoff.reveal", "showdown.reveal", "vote.cast"],
  },
  { key: "verdict", title: "판결·처형", ids: ["verdict.heart", "ballot.yes", "ballot.no", "execution.gavel", "execution.rise", "verdict.reject"] },
  { key: "night", title: "밤·아침", ids: ["night.fall", "night.cue", "kill.slash", "morning.dawn", "morning.calm", "chalk.draw", "morning.saved", "will.quill", "will.seal", "will.fold"] },
  { key: "emote", title: "동작", ids: ["emote.clap", "emote.praise", "emote.handshake", "emote.dance", "emote.surprise", "emote.cry", "emote.deny", "emote.point", "emote.throat"] },
  { key: "result", title: "결과·시상", ids: ["result.win", "result.lose", "award.plate", "award.final"] },
  { key: "tutorial", title: "튜토리얼", ids: ["voice.syl"] },
];

/** 소리마다 한글 이름 한 줄(C-1·C-2 의 '언제' 앞 구절) */
export const SOUND_NAMES: Readonly<Record<SoundId, string>> = {
  "bed.lobby": "대기실 배경음",
  "bed.reveal": "직업 공개 배경음",
  "bed.day": "낮 토론 배경음",
  "bed.vote": "지목·찬반 배경음",
  "bed.night": "밤 배경음",
  "bed.dawn": "아침 배경음",
  "bed.result": "결과 배경음",
  "ui.tap": "주요 버튼",
  "ui.toggle": "소리 단추",
  "ui.deny": "거절 토스트",
  "ui.card": "카드 도착",
  "ui.host": "사회자 알림",
  "lobby.join": "사람 입장",
  "game.start": "게임 시작",
  "role.flip": "직업 카드 공개",
  "day.start": "낮 시작 종",
  "timer.tick": "마지막 5초 틱",
  "phase.vote": "지목 시작 노크",
  "pin.on": "핀 조명 켜짐",
  "pin.move": "핀 조명 이동",
  "pick.turn": "내 지목 차례",
  "pick.tick": "내 차례 마지막 3초",
  "pick.point": "지목 확정",
  "pick.skip": "기권",
  "runoff.intro": "결선 시작",
  "runoff.reveal": "결선 득표 공개",
  "showdown.reveal": "마지막 3인 공개",
  "vote.cast": "찬반 선택",
  "verdict.heart": "심장 박동",
  "ballot.yes": "찬성 묶음 등장",
  "ballot.no": "반대 묶음 등장",
  "execution.gavel": "처형 확정",
  "execution.rise": "유령 떠오름",
  "verdict.reject": "부결",
  "night.fall": "밤 시작",
  "night.cue": "밤 기척",
  "kill.slash": "암살 칼날",
  "morning.dawn": "아침 시작",
  "morning.calm": "평화로운 밤",
  "chalk.draw": "분필 윤곽",
  "morning.saved": "누군가 살아남",
  "will.quill": "편지 쓰기",
  "will.seal": "편지 인장",
  "will.fold": "편지 접힘",
  "emote.clap": "박수",
  "emote.praise": "최고",
  "emote.handshake": "악수",
  "emote.dance": "춤",
  "emote.surprise": "깜짝",
  "emote.cry": "엉엉",
  "emote.deny": "손사래",
  "emote.point": "손가락",
  "emote.throat": "목긋기",
  "result.win": "내 팀 승리",
  "result.lose": "내 팀 패배",
  "award.plate": "시상 패",
  "award.final": "마지막 패",
  "voice.syl": "사회자 웅얼 음절",
};
