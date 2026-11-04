// 시트 층 배치 훅 (09-17 유언 시트에서 옮김, 09.1.1-08 에서 배지 시트와 같이 쓰려고 분리 — 논리 변경 없음).
// 시트 층의 아래 끝 = 아래 패널 위 끝 + 8(키보드가 열려 있으면 그 위, CSS 의 --mf-kb-lift). 패널 높이는 DOM 에서 잰다(6페이즈 규칙).
// 패널 + 시트 + 8 이 보이는 높이(visualViewport − 스테이지 윗변)를 넘으면 패널을 가리고 시트만 키보드 위에 붙인다(UI-SPEC 282행).
// 가린 동안은 숨기기 직전에 잰 패널 높이를 기억해 판정한다(가린 패널은 줄어들지 않으므로 같은 값이다).
import { useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { useVisualViewportHeight } from "./useKeyboardLift";

export interface SheetLayer {
  /** 시트 층(.mf-will-layer) 요소에 붙인다 */
  layerRef: RefObject<HTMLDivElement | null>;
  /** 패널을 가려야 하는가(시트만 키보드 위에 붙인다) */
  veiled: boolean;
  /** 보이는 화면(visualViewport) 높이. 열려 있는 동안만 구독한다 */
  vvHeight: number;
}

export function useSheetLayer({ open, panelRef, stageTop }: { open: boolean; panelRef: RefObject<HTMLElement | null>; stageTop: number }): SheetLayer {
  const layerRef = useRef<HTMLDivElement>(null);
  const vvHeight = useVisualViewportHeight(open);
  const panelHeight = useRef(0);
  const [veiled, setVeiled] = useState(false);
  useLayoutEffect(() => {
    const layer = layerRef.current;
    if (!open || layer === null) {
      if (veiled) setVeiled(false);
      return;
    }
    if (!veiled) panelHeight.current = panelRef.current?.offsetHeight ?? 0;
    layer.style.setProperty("--mf-panel-h", `${panelHeight.current}px`);
    const hide = panelHeight.current + layer.offsetHeight + 8 > vvHeight - stageTop;
    if (hide !== veiled) setVeiled(hide);
  });
  return { layerRef, veiled, vvHeight };
}
