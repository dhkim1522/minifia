import { createElement } from "react";
import type { ReactElement } from "react";

// 인라인 SVG. 이모지·아이콘 폰트 대신 쓴다. 24×24 viewBox, stroke 2, round.
// 경로는 design/design-system/components/bundle.js 의 ICONS 에서 옮겼다(share·close·check·diamond·disconnected).
// back·copy·card 는 참고 구현에 없어 같은 규격으로 새로 그렸다.
export type IconName = "back" | "share" | "close" | "copy" | "check" | "card" | "diamond" | "disconnected";

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
