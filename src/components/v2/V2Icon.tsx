import { createElement } from "react";
import "../../styles/v2.css";

// v2.0 아이콘 중 6·7·8·9페이즈가 쓰는 종류(9페이즈: quill·note·target·eye·heal·close. 8페이즈: rolePolice·roleDoctor 와 skip·thumbUp·thumbDown). 24 격자, 선 2px, 둥근 끝, currentColor.
// 경로는 design/v2.0/design-system/components/bundle.js 의 ICONS 에서 그대로 옮겼다(승인 2026-10-31).
// 나머지 아이콘은 그것을 쓰는 페이즈(8·9·10페이즈)가 같은 표에 더한다(10페이즈: 동작 아홉 개, hanger 는 10-07 이 더한다).
// v1.0 아이콘(src/components/Icon.tsx)과 이름이 겹쳐도(check·crown) 서로 다른 부품이다: v2 화면은 이 파일을 쓴다.
// 로비 헤더의 [나가기]·[공유] 는 v1.0 Icon 을 그대로 쓴다(UI-SPEC 결정 현황) — 여기에 back·share 를 더하지 않는다.
export type V2IconName = "point" | "crown" | "play" | "check" | "roleCitizen" | "send" | "ghost" | "roleMafia" | "rolePolice" | "roleDoctor" | "skip" | "thumbUp" | "thumbDown" | "quill" | "note" | "target" | "eye" | "heal" | "close" | "whisper" | "swap" | "quiet" | "face" | "throat" | "deny" | "clap" | "cry" | "handshake" | "praise" | "surprise" | "dance" | "hanger" | "timeline" | "trophy" | "hourglass";

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
  skip: [
    ["p", "M4 6.5l7 5.5-7 5.5z"],
    ["p", "M13 6.5l7 5.5-7 5.5z"],
  ],
  thumbUp: [
    ["p", "M7 10.5V20H4v-9.5z"],
    ["p", "M7 10.5l4-7a2 2 0 0 1 3.4 1.9L13.5 9h5.2a2 2 0 0 1 2 2.4l-1.3 6.9a2 2 0 0 1-2 1.7H7"],
  ],
  thumbDown: [
    ["p", "M7 13.5V4H4v9.5z"],
    ["p", "M7 13.5l4 7a2 2 0 0 0 3.4-1.9L13.5 15h5.2a2 2 0 0 0 2-2.4l-1.3-6.9A2 2 0 0 0 17.4 4H7"],
  ],
  close: [
    ["p", "M6 6l12 12"],
    ["p", "M18 6L6 18"],
  ],
  // 9페이즈(밤·아침): 유언 깃펜·쪽지·지목 과녁·경찰 조사(눈)·의사 살리기(십자)
  quill: [
    ["p", "M20 4c-6.5 1-11 5.5-13 11.5L5.5 20"],
    ["p", "M20 4c.6 5.5-3.5 10-9.5 11.5"],
    ["p", "M9.5 15L6.8 12.3"],
  ],
  note: [
    ["p", "M6 3h9l4 4v14H6z"],
    ["p", "M15 3v4h4"],
    ["p", "M9 12h7"],
    ["p", "M9 16h5"],
  ],
  target: [
    ["c", 12, 12, 8],
    ["c", 12, 12, 3],
    ["p", "M12 1.5v3.5"],
    ["p", "M12 19v3.5"],
    ["p", "M1.5 12H5"],
    ["p", "M19 12h3.5"],
  ],
  eye: [
    ["p", "M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"],
    ["c", 12, 12, 3],
  ],
  heal: [["p", "M9.5 4h5v5.5H20v5h-5.5V20h-5v-5.5H4v-5h5.5z"]],
  // 09.1.1-08(정치·긴장 장치): 직접 그린 새 셋. 말풍선 + 입가 짧은 선(귓속말) · 좌우 화살표 둘(말 바꿈) · 원 + 사선(말 안 함)
  whisper: [
    ["p", "M5 4.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-6.5L8 20.5v-4H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z"],
    ["p", "M8 10.5h5"],
  ],
  swap: [
    ["p", "M4 8h14"],
    ["p", "M14.5 4.5L18 8l-3.5 3.5"],
    ["p", "M20 16H6"],
    ["p", "M9.5 12.5L6 16l3.5 3.5"],
  ],
  quiet: [
    ["c", 12, 12, 8.5],
    ["p", "M6 6l12 12"],
  ],
  // 10페이즈(동작): 입력줄 동작 버튼 face 와 판의 아홉 칸(point 는 위에 이미 있다). bundle.js 의 ICONS 와 같은 데이터
  face: [
    ["c", 12, 12, 9],
    ["c", 9, 10, 1.1, true],
    ["c", 15, 10, 1.1, true],
    ["p", "M8.5 14.3c1 1.2 2.2 1.8 3.5 1.8s2.5-.6 3.5-1.8"],
  ],
  // 10페이즈(꾸미기): 로비 꾸미기 버튼·시트 장식. bundle.js 의 ICONS 와 같은 데이터
  hanger: [
    ["p", "M10 6.5a2 2 0 1 1 2.6 1.9c-.4.1-.6.5-.6.9V11"],
    ["p", "M12 11l-8.6 6.2a1 1 0 0 0 .6 1.8h16a1 1 0 0 0 .6-1.8z"],
  ],
  throat: [
    ["c", 12, 7, 4],
    ["p", "M4 14.5h16"],
    ["p", "M17 12l3 2.5-3 2.5"],
    ["p", "M8 19c1.2.8 2.6 1.2 4 1.2s2.8-.4 4-1.2"],
  ],
  deny: [
    ["p", "M8 13V6.5a1.5 1.5 0 0 1 3 0V11"],
    ["p", "M11 10.5V5a1.5 1.5 0 0 1 3 0v5.5"],
    ["p", "M14 10.5V7a1.5 1.5 0 0 1 3 0v7a6 6 0 0 1-6 6h-.5a5 5 0 0 1-4.2-2.3L4.4 14.6a1.5 1.5 0 0 1 2.5-1.7L8 14.5"],
    ["p", "M3 4.5l1.8 1.2"],
    ["p", "M20 4.5l-1.8 1.2"],
  ],
  clap: [
    ["p", "M7.5 20.5L5 12a2 2 0 0 1 3.8-1.1L11 16"],
    ["p", "M16.5 20.5L19 12a2 2 0 0 0-3.8-1.1L13 16"],
    ["p", "M12 3v3"],
    ["p", "M7.5 4.5l1.4 2"],
    ["p", "M16.5 4.5l-1.4 2"],
  ],
  cry: [
    ["c", 12, 12, 9],
    ["p", "M7.5 10.5c.8-.7 1.7-.7 2.5 0"],
    ["p", "M14 10.5c.8-.7 1.7-.7 2.5 0"],
    ["p", "M9.8 17c1.4-1.1 3-1.1 4.4 0"],
    ["p", "M8.8 13.2c0 1.1-.8 1.8-.8 1.8s-.8-.7-.8-1.8a.8.8 0 0 1 1.6 0z", true],
  ],
  handshake: [
    ["p", "M2.5 11l3.5-3.5 4.5 2 2.5-1.5 2.5 1.5 4.5-2L21.5 11"],
    ["p", "M6 10.5l5.5 5.5a1.6 1.6 0 0 0 2.3 0l3.7-3.7"],
    ["p", "M9.5 14l2 2"],
    ["p", "M11.5 12l2.5 2.5"],
  ],
  praise: [
    ["p", "M7 10.5V20H4v-9.5z"],
    ["p", "M7 10.5l4-7a2 2 0 0 1 3.4 1.9L13.5 9h5.2a2 2 0 0 1 2 2.4l-1.3 6.9a2 2 0 0 1-2 1.7H7"],
  ],
  surprise: [
    ["c", 12, 12, 9],
    ["c", 9, 9.5, 1.2, true],
    ["c", 15, 9.5, 1.2, true],
    ["c", 12, 15.5, 2.2],
  ],
  dance: [
    ["p", "M9 18V5.5l11-2V16"],
    ["c", 6, 18, 3],
    ["c", 17, 16, 3],
  ],
  // 11페이즈(결과 기록 탭): 가로 선 위에 세 마디 점과 아래 짧은 줄 둘 — 판의 흐름을 단순하게 직접 그린 모양
  // 11페이즈(시상식): 헤더 제목 아이콘·칭호 패 기본 아이콘. bundle.js 의 ICONS 와 같은 데이터
  trophy: [
    ["p", "M7 4h10v5a5 5 0 0 1-10 0z"],
    ["p", "M7 6H4.5v1.5A3 3 0 0 0 7.5 10.5"],
    ["p", "M17 6h2.5v1.5a3 3 0 0 1-3 3"],
    ["p", "M12 14v3.5"],
    ["p", "M8 20.5h8l-1-3H9z"],
  ],
  // 11페이즈(쉬는 사람 화면, O-8): 모래시계를 직접 그린 단순 모양 — 위아래 가로선과 가운데에서 맞닿는 두 곡선
  hourglass: [
    ["p", "M6 3h12"],
    ["p", "M6 21h12"],
    ["p", "M8 3v3.5a4 4 0 0 0 1.6 3.2L12 12l-2.4 2.3A4 4 0 0 0 8 17.5V21"],
    ["p", "M16 3v3.5a4 4 0 0 1-1.6 3.2L12 12l2.4 2.3a4 4 0 0 1 1.6 3.2V21"],
  ],
  timeline: [
    ["p", "M3 8h18"],
    ["c", 6.5, 8, 1.8, true],
    ["c", 12, 8, 1.8, true],
    ["c", 17.5, 8, 1.8, true],
    ["p", "M6.5 14v4"],
    ["p", "M12 14v6"],
    ["p", "M17.5 14v3"],
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
