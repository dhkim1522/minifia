import { createElement } from "react";
import "../../styles/v2.css";

// v2.0 아이콘 중 6·7·8페이즈가 쓰는 종류(8페이즈: rolePolice·roleDoctor 와 skip·thumbUp·thumbDown). 24 격자, 선 2px, 둥근 끝, currentColor.
// 경로는 design/v2.0/design-system/components/bundle.js 의 ICONS 에서 그대로 옮겼다(승인 2026-10-31).
// 나머지 아이콘은 그것을 쓰는 페이즈(8·9·10페이즈)가 같은 표에 더한다.
// v1.0 아이콘(src/components/Icon.tsx)과 이름이 겹쳐도(check·crown) 서로 다른 부품이다: v2 화면은 이 파일을 쓴다.
// 로비 헤더의 [나가기]·[공유] 는 v1.0 Icon 을 그대로 쓴다(UI-SPEC 결정 현황) — 여기에 back·share 를 더하지 않는다.
export type V2IconName = "point" | "crown" | "play" | "check" | "roleCitizen" | "send" | "ghost" | "roleMafia" | "rolePolice" | "roleDoctor";

// ["c", cx, cy, r, filled?] 원 · ["p", d, filled?] 경로
type Part = readonly ["c", number, number, number, boolean?] | readonly ["p", string, boolean?];

const ICONS: Readonly<Record<V2IconName, readonly Part[]>> = {
  point: [
    ["p", "M3 9.5h11.5a1.5 1.5 0 0 1 0 3H12"],
    ["p", "M12 12.5h.5a1.5 1.5 0 0 1 0 3H11"],
    ["p", "M11 15.5a1.5 1.5 0 0 1 0 3H8.5A4.5 4.5 0 0 1 4 14v-2.2A2.3 2.3 0 0 1 6.3 9.5"],
    ["p", "M18.5 11h3"],
  ],
  crown: [
    ["p", "M4 18.5L3 8l5 4 4-6.5 4 6.5 5-4-1 10.5z"],
    ["p", "M4.5 21h15"],
  ],
  play: [["p", "M7.5 5l11 7-11 7z"]],
  check: [["p", "M5 12.5l4.5 4.5L19 7.5"]],
  roleCitizen: [
    ["c", 12, 8, 3.5],
    ["p", "M5 20c.8-3.8 3.6-6 7-6s6.2 2.2 7 6"],
  ],
  send: [
    ["p", "M4 12l16-8-6 16-3-7z"],
    ["p", "M11 13l9-9"],
  ],
  ghost: [
    ["p", "M5 21V11a7 7 0 0 1 14 0v10l-2.3-1.6L14.3 21 12 19.4 9.7 21l-2.4-1.6z"],
    ["c", 9.5, 11, 1.2, true],
    ["c", 14.5, 11, 1.2, true],
  ],
  roleMafia: [
    ["p", "M3.5 15.5c3 1.4 14 1.4 17 0"],
    ["p", "M6.5 15V9.5C6.5 6.9 9 5 12 5s5.5 1.9 5.5 4.5V15"],
    ["p", "M6.5 12.5h11"],
  ],
  rolePolice: [
    ["p", "M12 3l7 3v5.5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5V6z"],
    ["p", "M12 8.5l1.2 2.4 2.6.4-1.9 1.8.5 2.6L12 14.5l-2.4 1.2.5-2.6-1.9-1.8 2.6-.4z", true],
  ],
  roleDoctor: [
    ["c", 12, 12, 9],
    ["p", "M12 7.5v9"],
    ["p", "M7.5 12h9"],
  ],
};

export interface V2IconProps {
  name: V2IconName;
  /** 한 변 px. 기본 24 */
  size?: number;
  /** 읽어 줄 이름. 없으면 장식이라 스크린리더가 건너뛴다(aria-hidden) */
  label?: string;
  className?: string;
}

export function V2Icon({ name, size = 24, label, className }: V2IconProps) {
  const parts = ICONS[name];
  return (
    <svg
      className={className ? `mv-icon ${className}` : "mv-icon"}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : "true"}
      focusable="false"
    >
      {parts.map((s, i) =>
        s[0] === "c"
          ? createElement("circle", {
              key: i,
              cx: s[1],
              cy: s[2],
              r: s[3],
              fill: s[4] ? "currentColor" : "none",
              stroke: s[4] ? "none" : undefined,
            })
          : createElement("path", {
              key: i,
              d: s[1],
              fill: s[2] ? "currentColor" : "none",
              stroke: s[2] ? "none" : undefined,
            }),
      )}
    </svg>
  );
}
