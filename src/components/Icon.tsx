import { createElement } from "react";
import type { ReactElement } from "react";

// 인라인 SVG. 이모지·아이콘 폰트 대신 쓴다. 24×24 viewBox, stroke 2, round.
// 경로는 design/design-system/components/bundle.js 의 ICONS 에서 옮겼다(share·close·check·diamond·disconnected).
// back·copy·card·plus·skip·chat 은 참고 구현에 없어 같은 규격으로 새로 그렸다.
// changed·crown·chevronUp 은 낮 화면 승인 시안 9차(design/screens/day-v3/R9-5.dc.html)의 경로를 그대로 옮겼다.
export type IconName =
  | "back"
  | "share"
  | "close"
  | "copy"
  | "check"
  | "card"
  | "diamond"
  | "disconnected"
  | "plus"
  | "skip"
  | "chat"
  | "smile"
  | "grin"
  | "surprised"
  | "suspicious"
  | "angry"
  | "sad"
  | "heart"
  | "exclaim"
  | "changed"
  | "crown"
  | "chevronUp";

type Part = readonly [tag: "path" | "circle" | "rect", attrs: Readonly<Record<string, string | number>>];

const ICONS: Readonly<Record<IconName, readonly Part[]>> = {
  back: [["path", { d: "M15 5l-7 7 7 7" }]],
  share: [["path", { d: "M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" }]],
  close: [["path", { d: "M6 6l12 12M18 6 6 18" }]],
  copy: [
    ["rect", { x: 9, y: 9, width: 11, height: 11, rx: 2 }],
    ["path", { d: "M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" }],
  ],
  check: [["path", { d: "M5 12.5l4.5 4.5L19 7.5" }]],
  card: [
    ["rect", { x: 6, y: 3, width: 12, height: 18, rx: 2.5 }],
    ["path", { d: "M12 9 15 12 12 15 9 12z", fill: "currentColor", stroke: "none" }],
  ],
  diamond: [["path", { d: "M12 3 20 12 12 21 4 12z", fill: "currentColor", stroke: "none" }]],
  disconnected: [
    ["path", { d: "M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 8.5-2.6M9 15.5a5 5 0 0 1 4.5-.9M3 3l18 18" }],
    ["circle", { cx: 12, cy: 19.5, r: 1, fill: "currentColor" }],
  ],
  plus: [["path", { d: "M12 5v14M5 12h14" }]],
  skip: [["path", { d: "M6 5l9 7-9 7zM19 5v14" }]],
  chat: [["path", { d: "M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" }]],
  // 임시 형태 시안 — 최종 그림은 캐릭터 톤에 맞춰 교체(D-16). 아래 이모티콘 여덟 항목만 바꾸면 트레이·반응 원이 따라온다.
  smile: [
    ["circle", { cx: 12, cy: 12, r: 9 }],
    ["circle", { cx: 9, cy: 10, r: 1, fill: "currentColor", stroke: "none" }],
    ["circle", { cx: 15, cy: 10, r: 1, fill: "currentColor", stroke: "none" }],
    ["path", { d: "M8.5 14.5a4.5 4.5 0 0 0 7 0" }],
  ],
  // 임시 형태 시안 — 최종 그림은 캐릭터 톤에 맞춰 교체(D-16)
  grin: [
    ["circle", { cx: 12, cy: 12, r: 9 }],
    ["circle", { cx: 9, cy: 10, r: 1, fill: "currentColor", stroke: "none" }],
    ["circle", { cx: 15, cy: 10, r: 1, fill: "currentColor", stroke: "none" }],
    ["path", { d: "M7.5 13.5h9a4.5 4.5 0 0 1-9 0z" }],
  ],
  // 임시 형태 시안 — 최종 그림은 캐릭터 톤에 맞춰 교체(D-16)
  surprised: [
    ["circle", { cx: 12, cy: 12, r: 9 }],
    ["circle", { cx: 9, cy: 10, r: 1, fill: "currentColor", stroke: "none" }],
    ["circle", { cx: 15, cy: 10, r: 1, fill: "currentColor", stroke: "none" }],
    ["circle", { cx: 12, cy: 16, r: 2 }],
  ],
  // 임시 형태 시안 — 최종 그림은 캐릭터 톤에 맞춰 교체(D-16)
  suspicious: [
    ["circle", { cx: 12, cy: 12, r: 9 }],
    ["circle", { cx: 9, cy: 11, r: 1, fill: "currentColor", stroke: "none" }],
    ["path", { d: "M13.5 11h3M7.5 8h3M13.5 8.5l3-1.5M9 16h6" }],
  ],
  // 임시 형태 시안 — 최종 그림은 캐릭터 톤에 맞춰 교체(D-16)
  angry: [
    ["circle", { cx: 12, cy: 12, r: 9 }],
    ["circle", { cx: 9, cy: 12, r: 1, fill: "currentColor", stroke: "none" }],
    ["circle", { cx: 15, cy: 12, r: 1, fill: "currentColor", stroke: "none" }],
    ["path", { d: "M7.5 8.5l3.5 1.5M16.5 8.5 13 10M8.5 17a4.5 3 0 0 1 7 0" }],
  ],
  // 임시 형태 시안 — 최종 그림은 캐릭터 톤에 맞춰 교체(D-16)
  sad: [
    ["circle", { cx: 12, cy: 12, r: 9 }],
    ["circle", { cx: 9, cy: 10, r: 1, fill: "currentColor", stroke: "none" }],
    ["circle", { cx: 15, cy: 10, r: 1, fill: "currentColor", stroke: "none" }],
    ["path", { d: "M8.5 16.5a4.5 4.5 0 0 1 7 0" }],
  ],
  // 임시 형태 시안 — 최종 그림은 캐릭터 톤에 맞춰 교체(D-16)
  heart: [["path", { d: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z", fill: "currentColor", stroke: "none" }]],
  // 임시 형태 시안 — 최종 그림은 캐릭터 톤에 맞춰 교체(D-16)
  exclaim: [
    ["path", { d: "M12 4.5v10" }],
    ["circle", { cx: 12, cy: 19, r: 1.3, fill: "currentColor", stroke: "none" }],
  ],
  // 말 바꿈 ↺ (시안 R9-5)
  changed: [
    ["path", { d: "M4 12a8 8 0 0 1 14-5.3L20 9" }],
    ["path", { d: "M20 4v5h-5" }],
    ["path", { d: "M20 12a8 8 0 0 1-14 5.3L4 15" }],
    ["path", { d: "M4 20v-5h5" }],
  ],
  // 방장 왕관 (시안 R9-5)
  crown: [["path", { d: "M3 8l4 4 5-7 5 7 4-4-2 11H5z" }]],
  // 채팅 내역 크게 보기 ^ 버튼 (시안 R9-5)
  chevronUp: [["path", { d: "M6 15l6-6 6 6" }]],
};

export interface IconProps {
  name: IconName;
  size?: number;
  /** 있으면 role="img" 로 읽히고, 없으면 장식이라 aria-hidden */
  label?: string;
  className?: string;
}

export function Icon({ name, size = 24, label, className }: IconProps): ReactElement {
  const classes = ["mf-icon", className].filter(Boolean).join(" ");
  return (
    <svg
      className={classes}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : "true"}
    >
      {ICONS[name].map(([tag, attrs], i) => createElement(tag, { key: i, ...attrs }))}
    </svg>
  );
}
