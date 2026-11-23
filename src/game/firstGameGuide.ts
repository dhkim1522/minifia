import type { RoomView } from "../../shared/protocol";
import type { FirstGameGuideStep } from "../components/FirstGameGuide";

const ROLE_FLIP: FirstGameGuideStep = {
  id: "role", title: "내 역할 확인", text: "카드를 눌러 내 역할을 확인하세요.",
  target: ".mf-card[role='button']:not(.mf-card--front)", preferBelow: true,
};
const ROLE_READY: FirstGameGuideStep = {
  ...ROLE_FLIP, target: "[data-role-ready]", text: "역할을 읽었으면 확인을 눌러요.", preferBelow: false,
};
const CLUE_INPUT: FirstGameGuideStep = {
  id: "clue", title: "첫 단서 남기기", text: "제시어를 떠올릴 단서를 쓰고 보내세요.",
  target: "[data-answer-input]:not([readonly])", preferBelow: true,
};
const LIAR_CLUE: FirstGameGuideStep = { ...CLUE_INPUT, text: "다른 사람에게 보여 줄 답을 쓰고 보내세요." };
const CLUE_SEND: FirstGameGuideStep = { ...CLUE_INPUT, target: "[data-answer-send]", text: "전송 아이콘을 눌러 단서를 보내세요." };
const ANSWER_SUSPECT: FirstGameGuideStep = {
  id: "answer-suspect", title: "답안에 의심 표시", text: "발표자의 답이 의심스러우면 눌러 보세요.",
  target: "[data-answer-suspect]:not([aria-pressed='true'])", cardBoundary: "[data-answer-presentation]",
};
const HOLD_SUSPECT: FirstGameGuideStep = {
  id: "hold-suspect", title: "의심 표시", text: "의심 가는 상대의 카드를 꾹 눌렀다 떼면 의심 고깔을 씌울 수 있어요.",
  target: "[data-dock-pane='people'] [data-table-controls]:has([data-suspect-holdable])",
  cardBoundary: "[data-dock-pane='people']", hold: true, group: true,
};
const VERDICT: FirstGameGuideStep = {
  id: "verdict", title: "찬반 투표", text: "지목 투표를 진행할지 골라 주세요.",
  target: ".mv-verdict:has([data-verdict]:enabled)", preferBelow: true, group: true,
};
const VOTE: FirstGameGuideStep = {
  id: "nomination", title: "지목 투표", text: "내 차례예요. 표를 줄 사람의 카드를 누르세요.",
  target: "[data-dock-pane='people'] [data-table-controls]:has(button[data-pick]:enabled)", cardBoundary: "[data-dock-pane='people']", group: true,
};
const VOTE_TAB: FirstGameGuideStep = { ...VOTE, target: "[data-dock-tab='people'][data-dock-vote]", text: "지목을 열어 표를 줄 사람을 골라요." };
const FIRST_DAY_VOTE: FirstGameGuideStep = { ...VOTE, text: "표를 줄 사람의 카드를 누르세요." };
const NIGHT_TARGET: FirstGameGuideStep = {
  id: "night", title: "밤 행동", text: "밤에 행동할 대상을 골라요.",
  target: "[data-night-targets] [data-table-controls]:has(button[data-pick]:enabled), [data-face-list]:has(button[data-face]:enabled)",
  cardBoundary: "[data-dock-pane='people']", group: true,
};
const NIGHT_MAFIA: FirstGameGuideStep = { ...NIGHT_TARGET, text: "마피아 전원이 같은 상대를 고르면 지목이 확정돼요." };
const NIGHT_POLICE: FirstGameGuideStep = { ...NIGHT_TARGET, text: "조사할 사람을 골라 주세요." };
const NIGHT_DOCTOR: FirstGameGuideStep = { ...NIGHT_TARGET, text: "보호할 사람을 골라 주세요." };
const NIGHT_TAB: FirstGameGuideStep = { ...NIGHT_TARGET, target: "[data-dock-tab='people'][data-dock-pending]", text: "밤 선택을 열어 대상을 골라요." };
const MORNING_READY: FirstGameGuideStep = { ...NIGHT_TARGET, target: "[data-night-done]", text: "아침 준비를 누르고 다음 날을 기다려요.", preferBelow: true };
const GHOST_CHAT: FirstGameGuideStep = {
  id: "ghost-chat", title: "유령 채팅", text: "여기서 다른 유령과 이야기할 수 있어요.",
  target: "[data-dock-tab='chat'][aria-expanded='false']",
};
const GHOST_INPUT: FirstGameGuideStep = {
  ...GHOST_CHAT, target: "[data-dock-pane='chat'] [data-chat-input]:not([readonly])",
  completed: "[data-dock-pane='chat'] [data-chat-input]:focus",
};

export function firstGameGuideSteps(view: RoomView, options: {
  blocked: boolean;
  canVote: boolean;
  firstDayVote: boolean;
  nightAvailable: boolean;
  ghostChat: boolean;
  answerSuspect: boolean;
  holdSuspect: boolean;
}): readonly FirstGameGuideStep[] {
  if (options.blocked) return [];
  const steps: FirstGameGuideStep[] = [];
  if (view.phase === "roleReveal" && view.me.role !== undefined && view.me.roleReady !== true) {
    steps.push(ROLE_READY, ROLE_FLIP);
  }
  if (view.phase === "keyword" && view.me.answer?.final !== true) {
    steps.push(CLUE_SEND, view.me.keyword === undefined ? LIAR_CLUE : CLUE_INPUT);
  }
  if (options.answerSuspect) steps.push(ANSWER_SUSPECT);
  if (view.phase === "verdict" && view.day?.firstBallot === undefined && view.me.verdictVote === undefined) steps.push(VERDICT);
  if (options.canVote) steps.push(options.firstDayVote ? FIRST_DAY_VOTE : VOTE, VOTE_TAB);
  if (options.nightAvailable && view.me.pick === undefined && view.me.nightDone !== true) {
    switch (view.me.role) {
      case "mafia": steps.push(NIGHT_MAFIA, NIGHT_TAB); break;
      case "police": steps.push(NIGHT_POLICE, NIGHT_TAB); break;
      case "doctor": steps.push(NIGHT_DOCTOR, NIGHT_TAB); break;
      case "citizen": if (view.playtest === true) steps.push(MORNING_READY); break;
    }
  }
  if (options.ghostChat) steps.push(GHOST_INPUT, GHOST_CHAT);
  if (options.holdSuspect) steps.push(HOLD_SUSPECT);
  return steps;
}
