// 맵 화면 틀(대기실 Lobby·게임 맵 GameMap)이 함께 쓰는 측정·키보드 훅 (06-15 측정, 07-19 키보드 규칙, 08-13 에서 Lobby 에서 옮겨 옴).
// 하는 일 셋:
// 1. 키보드(07-19, CHAT-05): 입력칸에 포커스가 있을 때만 visualViewport 로 키보드 높이(lift)를 읽어 CSS 변수(--mf-kb-lift·--mf-vv-top)로 쓴다.
//    변수는 방 틀(.mf-room)에 쓴다 — 헤더·알림·패널(화면 안)과 떠 있는 재접속 띠(화면 밖, 방 틀 직속)가 같은 값을 읽는다. 방 틀이 없으면 화면 루트.
//    열림(포커스 + lift > 80)이면 행동 줄을 숨기고(D3) 기록 칸을 72 로 줄이며 패널이 키보드 위로 올라간다. 캔버스 크기는 건드리지 않는다.
// 2. 스테이지 사각형: 위 끝 = 헤더 블록 아래, 아래 끝 = 아래 패널 위(키보드가 열려 있으면 패널 + 키보드 높이). 캔버스는 화면 전체 크기 그대로 두고 카메라 중심만 이 사각형에 맞춘다.
//    재서 넘기는 값이라 패널이 자라도(채팅·단계별 행동 줄) 같은 길로 따라간다. 측정이 0 이면(레이아웃 없는 환경) 넘기지 않고 WorldStage 기본값을 쓴다.
// 3. 기록 칸 높이: 방 높이로 한 번 정하고(키보드·주소창으로 다시 정하지 않는다) 키보드가 열린 동안만 화면이 72 로 줄인다(kbOpen 을 보고 고른다).
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
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
  /** WorldStage 로 넘길 스테이지 사각형. 측정 전(또는 레이아웃이 없는 환경)에는 undefined */
  stageInsets: { top: number; readonly bottom: number } | undefined;
}

export function useMapInsets(): MapInsets {
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
  useLayoutEffect(() => {
    const header = headerRef.current;
    const panel = panelRef.current;
    if (header === null || panel === null) return;
    const measure = (): void => {
      const top = header.offsetTop + header.offsetHeight;
      const bottom = panel.offsetHeight;
      if (top <= 0 || bottom <= 0) return;
      setInsets((prev) => (prev !== undefined && prev.top === top && prev.bottom === bottom ? prev : { top, bottom }));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(header);
    ro.observe(panel);
    return () => ro.disconnect();
  }, []);

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

  return { rootRef, headerRef, panelRef, inputRef, kbOpen, kbInSheet, logH, stageInsets };
}
