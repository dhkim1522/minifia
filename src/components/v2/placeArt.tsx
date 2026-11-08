// 생성물 — scripts/make-placeart.mjs 로 다시 만든다. 직접 고치지 않는다.
// 승인 컬러 에셋 A(design/v3.0/tutorial/Main.dc.html) 25개: 장소 16(PlaceId) + 흔적 조각 9(TracePiece). 사본은 design/v3.0/assets/{id}.svg.
// 48×48 격자, 윤곽선 2, 둥근 끝, 사물 고유색. 에셋 안의 hex 는 캐릭터 에셋과 같은 지위로 허용한다(화면 CSS 에는 hex 를 더하지 않는다).
// 정적 JSX 다 — HTML 문자열 주입이나 런타임 파싱이 없다.
import type { ReactElement, SVGProps } from "react";
import type { PlaceId, TracePiece } from "../../../shared/protocol";

export interface ArtProps {
  /** 표시 크기(px). 맵 타일 44, 시작 카드 60, 증거 카드 장소 32·조각 36, 기록 카드 24 */
  size: number;
  /** 주면 role="img" + aria-label(낱말), 안 주면 aria-hidden 장식 */
  label?: string;
  className?: string;
}

interface ArtEntry {
  root: SVGProps<SVGSVGElement>;
  body: ReactElement;
}

export const PLACE_ART: Readonly<Record<PlaceId, ArtEntry>> = {
  glass: {
    root: { stroke: "#1a1420", strokeWidth: "2", strokeLinejoin: "round", strokeLinecap: "round" },
    body: (
      <>
        <path d="M8 8h32L24 26z" fill="#e0566b" />
        <path d="M12 11h24" stroke="#f7b2bd" strokeWidth="2" />
        <path d="M24 26v12" fill="none" stroke="#d9dde6" strokeWidth="3" />
        <path d="M16 40h16" stroke="#d9dde6" strokeWidth="3" />
        <circle cx="31" cy="12" r="3.5" fill="#7cc35a" />
      </>
    ),
  },
  piano: {
    root: { stroke: "#1a1420", strokeWidth: "2", strokeLinejoin: "round" },
    body: (
      <>
        <path d="M6 14c0-4 3-6 7-6h22c4 0 7 2 7 6v12H6z" fill="#3a3346" />
        <rect x="6" y="26" width="36" height="12" rx="2" fill="#f4f1ea" />
        <path d="M12 26v7M18 26v7M24 26v7M30 26v7M36 26v7" stroke="#1a1420" strokeWidth="3" />
        <path d="M10 38v4M38 38v4" stroke="#3a3346" strokeWidth="3" />
      </>
    ),
  },
  sax: {
    root: { stroke: "#1a1420", strokeWidth: "2", strokeLinejoin: "round", strokeLinecap: "round" },
    body: (
      <>
        <path d="M28 6l4 2-4 22c-1 7-5 11-11 11-5 0-8-3-8-7 0-3 2-5 5-5 3 0 4 2 4 4l2-4z" fill="#f2b84b" />
        <circle cx="27" cy="16" r="1.8" fill="#8a5a12" />
        <circle cx="26" cy="22" r="1.8" fill="#8a5a12" />
        <path d="M32 8l6-3" stroke="#3a3346" strokeWidth="3" />
      </>
    ),
  },
  stool: {
    root: { stroke: "#1a1420", strokeWidth: "2", strokeLinejoin: "round", strokeLinecap: "round" },
    body: (
      <>
        <ellipse cx="24" cy="13" rx="14" ry="5" fill="#d2533f" />
        <path d="M14 17l-4 25M34 17l4 25M24 18v24" stroke="#b07a43" strokeWidth="3.5" />
        <path d="M13 31h22" stroke="#b07a43" strokeWidth="3" />
      </>
    ),
  },
  door: {
    root: { stroke: "#1a1420", strokeWidth: "2", strokeLinejoin: "round" },
    body: (
      <>
        <path d="M11 42V9a3 3 0 0 1 3-3h20a3 3 0 0 1 3 3v33z" fill="#a8613a" />
        <rect x="16" y="11" width="16" height="11" rx="2" fill="#ffd27a" />
        <rect x="16" y="26" width="16" height="11" rx="2" fill="#8c4f2e" />
        <circle cx="32" cy="25" r="2.4" fill="#f2c14e" />
        <path d="M7 42h34" stroke="#1a1420" strokeWidth="2" />
      </>
    ),
  },
  poster: {
    root: { stroke: "#1a1420", strokeWidth: "2", strokeLinejoin: "round" },
    body: (
      <>
        <rect x="10" y="6" width="28" height="36" rx="2" fill="#f4e3c1" />
        <path d="M24 12l3 6 6 1-4.5 4 1 6-5.5-3-5.5 3 1-6L15 19l6-1z" fill="#e0566b" />
        <path d="M15 34h18M17 38h14" stroke="#5a4a8a" strokeWidth="2.5" />
        <circle cx="24" cy="6" r="2" fill="#5ab4e6" />
      </>
    ),
  },
  record: {
    root: { stroke: "#1a1420", strokeWidth: "2", strokeLinejoin: "round", strokeLinecap: "round" },
    body: (
      <>
        <circle cx="22" cy="25" r="16" fill="#26222f" />
        <circle cx="22" cy="25" r="11" fill="none" stroke="#4a4458" strokeWidth="1.5" />
        <circle cx="22" cy="25" r="6" fill="#e0566b" />
        <circle cx="22" cy="25" r="1.5" fill="#1a1420" />
        <path d="M40 6l-6 18" stroke="#d9dde6" strokeWidth="3" />
        <rect x="31" y="22" width="6" height="5" rx="1" fill="#f2b84b" />
      </>
    ),
  },
  candle: {
    root: { stroke: "#1a1420", strokeWidth: "2", strokeLinejoin: "round", strokeLinecap: "round" },
    body: (
      <>
        <path d="M24 4c5 6 6 9 6 12a6 6 0 0 1-12 0c0-3 1-6 6-12z" fill="#ff9f43" />
        <path d="M24 11c2.5 3 3 5 3 6a3 3 0 0 1-6 0c0-1 .5-3 3-6z" fill="#ffe08a" stroke="none" />
        <rect x="17" y="22" width="14" height="18" rx="2" fill="#f6ecd2" />
        <path d="M12 40h24v3H12z" fill="#c9a46a" />
      </>
    ),
  },
  clock: {
    root: { stroke: "#1a1420", strokeWidth: "2", strokeLinejoin: "round", strokeLinecap: "round" },
    body: (
      <>
        <path d="M24 3l9 9H15z" fill="#4f7fc8" />
        <rect x="15" y="12" width="18" height="31" fill="#b68a62" />
        <circle cx="24" cy="22" r="6.5" fill="#fbf6ea" />
        <path d="M24 18v4l3 2" stroke="#1a1420" strokeWidth="2" />
        <rect x="20" y="33" width="8" height="10" rx="4" fill="#5c3d28" />
      </>
    ),
  },
  fountain: {
    root: { stroke: "#1a1420", strokeWidth: "2", strokeLinejoin: "round", strokeLinecap: "round" },
    body: (
      <>
        <path d="M24 22c-6-8-12-8-14-4M24 22c6-8 12-8 14-4" fill="none" stroke="#5ab4e6" strokeWidth="3" />
        <path d="M24 8v14" stroke="#5ab4e6" strokeWidth="3" />
        <circle cx="24" cy="7" r="2.5" fill="#bfe6fb" />
        <path d="M6 30h36l-4 10H10z" fill="#b9c2cf" />
        <path d="M8 30c4 3 8 3 12 0 4 3 8 3 12 0 4 3 6 3 8 0" fill="#7fc8ef" />
      </>
    ),
  },
  bench: {
    root: { stroke: "#1a1420", strokeWidth: "2", strokeLinejoin: "round", strokeLinecap: "round" },
    body: (
      <>
        <rect x="6" y="12" width="36" height="6" rx="2" fill="#c98a4b" />
        <rect x="6" y="20" width="36" height="6" rx="2" fill="#c98a4b" />
        <rect x="4" y="28" width="40" height="6" rx="2" fill="#e0a560" />
        <path d="M10 34v8M38 34v8M10 12v-4M38 12v-4" stroke="#3f7d55" strokeWidth="3.5" />
      </>
    ),
  },
  lamp: {
    root: { stroke: "#1a1420", strokeWidth: "2", strokeLinejoin: "round", strokeLinecap: "round" },
    body: (
      <>
        <circle cx="24" cy="13" r="10" fill="#ffd166" stroke="none" opacity="0.35" />
        <path d="M17 8h14l-2 9H19z" fill="#ffe08a" />
        <path d="M16 8h16" stroke="#3b4a5a" strokeWidth="3" />
        <path d="M24 17v24" stroke="#3b4a5a" strokeWidth="4" />
        <path d="M17 42h14" stroke="#3b4a5a" strokeWidth="4" />
      </>
    ),
  },
  mail: {
    root: { stroke: "#1a1420", strokeWidth: "2", strokeLinejoin: "round", strokeLinecap: "round" },
    body: (
      <>
        <path d="M12 18a12 12 0 0 1 24 0v18H12z" fill="#e04a3c" />
        <rect x="17" y="18" width="14" height="4" rx="2" fill="#1a1420" />
        <rect x="17" y="27" width="14" height="5" rx="1" fill="#fbf6ea" />
        <path d="M24 36v6M17 42h14" stroke="#5a5f6b" strokeWidth="3.5" />
      </>
    ),
  },
  tree: {
    root: { stroke: "#1a1420", strokeWidth: "2", strokeLinejoin: "round", strokeLinecap: "round" },
    body: (
      <>
        <path d="M21 30h6v12h-6z" fill="#8a5a34" />
        <circle cx="24" cy="18" r="12" fill="#4caf6a" />
        <circle cx="15" cy="24" r="7" fill="#5cc27a" />
        <circle cx="33" cy="24" r="7" fill="#3f9a5c" />
        <circle cx="20" cy="14" r="2" fill="#a9e7b9" stroke="none" />
      </>
    ),
  },
  flower: {
    root: { stroke: "#1a1420", strokeWidth: "2", strokeLinejoin: "round", strokeLinecap: "round" },
    body: (
      <>
        <path d="M24 26v16" stroke="#3f9a5c" strokeWidth="3" />
        <path d="M24 36c-5 0-8-3-8-6 4 0 8 2 8 6z" fill="#5cc27a" />
        <circle cx="24" cy="10" r="6" fill="#f27ba8" />
        <circle cx="16" cy="17" r="6" fill="#f27ba8" />
        <circle cx="32" cy="17" r="6" fill="#f27ba8" />
        <circle cx="19" cy="25" r="6" fill="#f27ba8" />
        <circle cx="29" cy="25" r="6" fill="#f27ba8" />
        <circle cx="24" cy="18" r="4.5" fill="#ffd166" />
      </>
    ),
  },
  stand: {
    root: { stroke: "#1a1420", strokeWidth: "2", strokeLinejoin: "round", strokeLinecap: "round" },
    body: (
      <>
        <path d="M6 16l4-8h28l4 8z" fill="#fbf6ea" />
        <path d="M14 8l-2 8M24 8v8M34 8l2 8" stroke="#e04a3c" strokeWidth="5" />
        <path d="M6 16c2 3 5 3 7 0 2 3 5 3 7 0 2 3 6 3 8 0 2 3 5 3 7 0 2 3 5 3 7 0" fill="#e04a3c" />
        <rect x="9" y="24" width="30" height="16" rx="1" fill="#c98a4b" />
        <circle cx="17" cy="23" r="3" fill="#ff9f43" />
        <circle cx="24" cy="23" r="3" fill="#7cc35a" />
        <circle cx="31" cy="23" r="3" fill="#ffd166" />
      </>
    ),
  },
};

export const TRACE_ART: Readonly<Record<TracePiece, ArtEntry>> = {
  button: {
    root: { stroke: "#1a1420", strokeWidth: "2" },
    body: (
      <>
        <circle cx="24" cy="24" r="15" fill="#b9864f" />
        <circle cx="24" cy="24" r="11" fill="none" stroke="#8a5a34" strokeWidth="1.5" />
        <circle cx="20" cy="20" r="2" fill="#1a1420" />
        <circle cx="28" cy="20" r="2" fill="#1a1420" />
        <circle cx="20" cy="28" r="2" fill="#1a1420" />
        <circle cx="28" cy="28" r="2" fill="#1a1420" />
      </>
    ),
  },
  pin: {
    root: { stroke: "#1a1420", strokeWidth: "2", strokeLinejoin: "round", strokeLinecap: "round" },
    body: (
      <>
        <path d="M24 6l5 10 11 2-8 8 2 11-10-5-10 5 2-11-8-8 11-2z" fill="#d9dde6" />
        <path d="M24 12l3 6" stroke="#ffffff" strokeWidth="2" />
      </>
    ),
  },
  whiteCloth: {
    root: { stroke: "#1a1420", strokeWidth: "2", strokeLinejoin: "round" },
    body: (
      <>
        <path d="M10 14l10-4 6 5 12-3-2 12 4 10-12 3-6-4-10 3 2-11z" fill="#f4f1ea" />
        <path d="M16 20l14 8" stroke="#c9ccd4" strokeWidth="1.5" />
      </>
    ),
  },
  blackCloth: {
    root: { stroke: "#8d8799", strokeWidth: "2", strokeLinejoin: "round" },
    body: (
      <>
        <path d="M10 14l10-4 6 5 12-3-2 12 4 10-12 3-6-4-10 3 2-11z" fill="#1f1c26" />
        <path d="M16 20l14 8" stroke="#4a4458" strokeWidth="1.5" />
      </>
    ),
  },
  brownCloth: {
    root: { stroke: "#1a1420", strokeWidth: "2", strokeLinejoin: "round" },
    body: (
      <>
        <path d="M10 14l10-4 6 5 12-3-2 12 4 10-12 3-6-4-10 3 2-11z" fill="#9a6238" />
        <path d="M16 20l14 8" stroke="#c48a5a" strokeWidth="1.5" />
      </>
    ),
  },
  pencil: {
    root: { stroke: "#1a1420", strokeWidth: "2", strokeLinejoin: "round", strokeLinecap: "round" },
    body: (
      <>
        <path d="M12 36l20-20 6 6-20 20H12z" fill="#ffc83d" />
        <path d="M12 36v6h6z" fill="#f4dcb0" />
        <path d="M32 16l4-4 6 6-4 4z" fill="#f27ba8" />
        <path d="M16 32l18-18" stroke="#e0a520" strokeWidth="1.5" />
      </>
    ),
  },
  grayThread: {
    root: { fill: "none", strokeLinecap: "round" },
    body: (
      <>
        <path d="M8 30c6-14 10 8 16-6s10 6 16-8" stroke="#1a1420" strokeWidth="6" />
        <path d="M8 30c6-14 10 8 16-6s10 6 16-8" stroke="#a7acb8" strokeWidth="3.5" />
      </>
    ),
  },
  navyThread: {
    root: { fill: "none", strokeLinecap: "round" },
    body: (
      <>
        <path d="M8 30c6-14 10 8 16-6s10 6 16-8" stroke="#8d8799" strokeWidth="6" />
        <path d="M8 30c6-14 10 8 16-6s10 6 16-8" stroke="#2f4a9a" strokeWidth="3.5" />
      </>
    ),
  },
  redCloth: {
    root: { stroke: "#1a1420", strokeWidth: "2", strokeLinejoin: "round" },
    body: (
      <>
        <path d="M10 14l10-4 6 5 12-3-2 12 4 10-12 3-6-4-10 3 2-11z" fill="#d23c4e" />
        <path d="M16 20l14 8" stroke="#f08a97" strokeWidth="1.5" />
      </>
    ),
  },
};

function ArtSvg({ entry, size, label, className }: ArtProps & { entry: ArtEntry }): ReactElement {
  const a11y = label !== undefined ? { role: "img", "aria-label": label } : { "aria-hidden": true as const, focusable: false as const };
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={className} {...entry.root} {...a11y}>
      {entry.body}
    </svg>
  );
}

export function PlaceArt({ id, ...props }: ArtProps & { id: PlaceId }): ReactElement {
  return <ArtSvg entry={PLACE_ART[id]} {...props} />;
}

export function TraceArt({ piece, ...props }: ArtProps & { piece: TracePiece }): ReactElement {
  return <ArtSvg entry={TRACE_ART[piece]} {...props} />;
}
