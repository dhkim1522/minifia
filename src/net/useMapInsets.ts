// 맵 화면 틀(대기실 Lobby·게임 맵 GameMap)이 함께 쓰는 측정·키보드 훅 (06-15 측정, 07-19 키보드 규칙, 08-13 에서 Lobby 에서 옮겨 옴).
// 하는 일 셋:
// 1. 키보드(07-19, CHAT-05): 입력칸에 포커스가 있을 때만 visualViewport 로 키보드 높이(lift)를 읽어 CSS 변수(--mf-kb-lift·--mf-vv-top)로 쓴다.
//    변수는 방 틀(.mf-room)에 쓴다 — 헤더·알림·패널(화면 안)과 떠 있는 재접속 띠(화면 밖, 방 틀 직속)가 같은 값을 읽는다. 방 틀이 없으면 화면 루트.
//    열림(포커스 + lift > 80)이면 행동 줄을 숨기고(D3) 기록 칸을 72 로 줄이며 패널이 키보드 위로 올라간다. 캔버스 크기는 건드리지 않는다.
// 2. 스테이지 사각형: 위 끝 = 헤더 블록 아래, 아래 끝 = 아래 패널 위(키보드가 열려 있으면 패널 + 키보드 높이). 캔버스는 화면 전체 크기 그대로 두고 카메라 중심만 이 사각형에 맞춘다.
//    14-01: 위 끝은 헤더 아랫변과 자막 띠 면([data-host-band] .mv-host__band) 아랫변 중 큰 쪽이다.
//    16-08: 심부름 단계는 아래 패널이 없다(panelless) — 아래 끝은 0(화면 아래)이다.
//    재서 넘기는 값이라 패널이 자라도(채팅·단계별 행동 줄) 같은 길로 따라간다. 측정이 0 이면(레이아웃 없는 환경) 넘기지 않고 WorldStage 기본값을 쓴다.
//    지목(09.1-08, UI-SPEC A-1): turnActive 이면 루트 안의 `[data-turn-block]`(차례 알약, GameMap 이 ref 를 넘기지 않고 이 훅이 루트에서 찾는다)의 막대 아랫변을 함께 재서
//    위 끝을 mapStageTop(알약·막대 아랫변 + 4)으로 내린다. 막대가 없을 때(모이는 중·끝 알림)는 마지막으로 잰 값, 없으면 기본값(160 · 압축 124). 작은 폰이면 압축형(turnCompact)을 알려 준다.
// 3. 기록 칸 높이: 방 높이로 한 번 정하고(키보드·주소창으로 다시 정하지 않는다) 키보드가 열린 동안만 화면이 72 로 줄인다(kbOpen 을 보고 고른다).
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { mapStageTop, TURN_BOTTOM_COMPACT, TURN_BOTTOM_DEFAULT, turnCompact } from "../game/pickTurn";
import { useChatLogHeight, useKeyboardLift } from "./useKeyboardLift";

export interface MapInsets {
  /** 화면 루트(`<main>`)에 붙인다. 방 틀(.mf-room)을 찾는 출발점이자 기록 칸 높이의 기준 */
  rootRef: RefObject<HTMLElement | null>;
  /** 헤더 블록에 붙인다 */
  headerRef: RefObject<HTMLElement | null>;
  /** 아래 패널에 붙인다 */
  panelRef: RefObject<HTMLElement | null>;
  /** 채팅 입력칸에 붙인다 */
  inputRef: RefObject<HTMLInputElement | null>;
  /** 포커스 + 키보드 lift > 80 */
  kbOpen: boolean;
  /** 키보드 초점이 채팅 입력칸이 아니라 유언·쪽지 시트의 textarea 에 있다(09-17) */
  kbInSheet: boolean;
  /** 키보드가 닫혀 있을 때의 기록 칸 높이(96 · 152). 열림 중에는 화면이 LOG_H_KB 를 쓴다 */
  logH: number;
  /** 지목 알약을 압축형으로 그릴 폰인가(UI-SPEC A-1). 지목이 아니거나 아직 못 쟀으면 false */
  turnCompact: boolean;
  /** 오른쪽 열(SideColumn)의 최대 높이(16-06, V-3) = 아래 패널 윗변 − 8 − 열 윗변(자막 띠 아랫변 + 12). 측정 전(또는 레이아웃이 없는 환경)에는 Infinity(한 열) */
  sideMaxH: number;
  /** WorldStage 로 넘길 스테이지 사각형. 측정 전(또는 레이아웃이 없는 환경)에는 undefined */
  stageInsets: { top: number; readonly bottom: number } | undefined;
}

/** 방 틀의 자막 띠 면(HostBand 의 [data-host-band] 안 띠). 띠 본체만 — 아래 독(소리 단추)은 스테이지 안전선에 넣지 않는다 */
const HOST_BAND_FACE = "[data-host-band] .mv-host__band";

/** 띠 면 아랫변(루트 위 끝 기준). 가상 뷰포트 이동(--mf-vv-top)은 뺀다 — 키보드가 열려도 스테이지 위쪽이 흔들리지 않게. 띠가 없거나 측정이 0 이면 0 */
function hostBandBottom(room: HTMLElement | null, root: HTMLElement | null): number {
  if (room === null || root === null) return 0;
  const band = room.querySelector<HTMLElement>(HOST_BAND_FACE);
  if (band === null) return 0;
  const vv = Number.parseFloat(getComputedStyle(room).getPropertyValue("--mf-vv-top")) || 0;
  const bottom = band.getBoundingClientRect().bottom - root.getBoundingClientRect().top - vv;
  return bottom > 0 ? bottom : 0;
}

/**
 * turnActive: 지금 지목 또는 결선 단계이고 알약 부품(`[data-turn-block]`)이 그려진다(blockModeOf !== null)
 * panelless: 아래 패널이 없는 단계(심부름, 16-08)다. 패널 없이도 위 끝은 지금처럼 재고 아래 끝은 0 으로 알린다. 재는 효과가 패널 요소를 시작 때 한 번 쥐므로
 *   단계가 바뀌어 패널이 생기거나 사라지면 이 값이 바뀌어 다시 쥔다(안 그러면 떼어진 옛 패널을 재다가 위·아래 안전선이 옛 값에 멈춘다, 16-07).
 */
export function useMapInsets(turnActive = false, panelless = false): MapInsets {
  const rootRef = useRef<HTMLElement>(null);
  const roomRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    roomRef.current = rootRef.current?.closest<HTMLElement>(".mf-room") ?? rootRef.current;
  }, []);
  const { open: kbOpen, lift, inSheet: kbInSheet } = useKeyboardLift({ inputRef, target: roomRef });

  const [insets, setInsets] = useState<{ top: number; bottom: number } | undefined>(undefined);
  // 압축형 판정은 8페이즈 기준 높이(창 높이 − 패널 − 62)라서 알약 위치와 순환하지 않는다. 패널·창이 바뀌면 다시 정한다.
  const [panelH, setPanelH] = useState(0);
  const [sideMaxH, setSideMaxH] = useState(Number.POSITIVE_INFINITY);
  const [viewH, setViewH] = useState(() => (typeof window === "undefined" ? 0 : window.innerHeight));
  const compact = turnActive && panelH > 0 && turnCompact(viewH, panelH);
  // 마지막으로 잰 막대 아랫변(압축 여부별). 막대가 없는 단계(모이는 중·끝 알림)에도 스테이지가 움직이지 않게 한다.
  const lastBar = useRef<{ compact: boolean; bottom: number } | null>(null);
  useLayoutEffect(() => {
    const header = headerRef.current;
    const panel = panelRef.current;
    if (header === null || (panel === null && !panelless)) return;
    const measure = (): void => {
      let headerBottom = header.offsetTop + header.offsetHeight;
      const bottom = panelless || panel === null ? 0 : panel.offsetHeight;
      if (headerBottom <= 0 || (!panelless && bottom <= 0)) return;
      // 14-01: 자막 띠가 헤더 아래에 얹히므로 위쪽 안전선은 헤더와 띠 면 아랫변 중 큰 쪽이다(띠가 1→2줄이 되면 따라 내려간다). 띠가 없으면 그대로.
      const hostBottom = hostBandBottom(roomRef.current, rootRef.current);
      if (hostBottom > headerBottom) headerBottom = hostBottom;
      const roomH = rootRef.current?.clientHeight ?? 0;
      if (roomH > 0) setSideMaxH(Math.max(0, roomH - bottom - 8 - (headerBottom + 12)));
      let top = headerBottom;
      if (turnActive) {
        const block = rootRef.current?.querySelector<HTMLElement>("[data-turn-block]") ?? null;
        const bar = block?.querySelector<HTMLElement>(".mf-turn__bar") ?? null;
        if (block !== null && bar !== null) {
          const barBottom = block.offsetTop + bar.offsetTop + bar.offsetHeight;
          if (barBottom > 0) lastBar.current = { compact, bottom: barBottom };
        }
        const measured = lastBar.current !== null && lastBar.current.compact === compact ? lastBar.current.bottom : null;
        top = mapStageTop(headerBottom, measured ?? (compact ? TURN_BOTTOM_COMPACT : TURN_BOTTOM_DEFAULT));
      }
      setPanelH(bottom);
      setViewH(window.innerHeight);
      setInsets((prev) => (prev !== undefined && prev.top === top && prev.bottom === bottom ? prev : { top, bottom }));
    };
    measure();
    window.addEventListener("resize", measure);
    if (typeof ResizeObserver === "undefined") return () => window.removeEventListener("resize", measure);
    const ro = new ResizeObserver(measure);
    ro.observe(header);
    if (panel !== null && !panelless) ro.observe(panel);
    const block = turnActive ? (rootRef.current?.querySelector<HTMLElement>("[data-turn-block]") ?? null) : null;
    if (block !== null) ro.observe(block);
    const hostBand = roomRef.current?.querySelector<HTMLElement>(HOST_BAND_FACE) ?? null;
    if (hostBand !== null) ro.observe(hostBand);
    return () => {
      window.removeEventListener("resize", measure);
      ro.disconnect();
    };
  }, [turnActive, compact, panelless]);

  // 키보드 높이는 프레임마다 바뀌어도 다시 그리지 않는다: 아래 끝을 getter 로 넘겨 WorldStage 가 프레임마다 읽는 순간의 lift 를 더하게 한다(열림·닫힘만 다시 그린다).
  const stageInsets = useMemo(
    () =>
      insets === undefined
        ? undefined
        : {
            top: insets.top,
            get bottom() {
              return insets.bottom + lift();
            },
          },
    [insets, lift],
  );

  const logH = useChatLogHeight(rootRef, inputRef);

  return { rootRef, headerRef, panelRef, inputRef, kbOpen, kbInSheet, logH, turnCompact: compact, sideMaxH, stageInsets };
}
