// 방 높이 고정 훅(RoomScreen 에서 옮김, 17-04): 방 화면과 첫 사건 화면(TutorialScreen)이 같은 훅을 쓴다 — 동작은 그대로다.
import { useLayoutEffect } from "react";
import type { RefObject } from "react";

/** 채팅 입력칸에 포커스가 있는가(키보드가 열려 있을 수 있는 동안) */
function typingInChat(): boolean {
  const el = document.activeElement;
  return el instanceof HTMLElement && el.hasAttribute("data-chat-input");
}

/**
 * 방 높이를 px 로 고정한다(07-19, UI-SPEC 패널과 키보드): 처음 그릴 때와 화면이 바뀔 때(방향 전환·주소창·창 크기)만 `--mf-room-h` 에 px 로 쓴다.
 * 채팅 입력칸에 포커스가 있는 동안(키보드)의 resize 는 무시한다 — 100dvh 로 키보드를 따라가면 캔버스가 크기를 바꾸고(WebGL 재할당·카메라 튐) 안 된다.
 * 측정은 변수를 잠깐 치워 CSS 의 100dvh 식(안전 영역 제외)이 준 높이를 읽는다. 읽은 높이가 0 이면(레이아웃 없는 환경) 변수를 쓰지 않아 그 식이 그대로 쓰인다.
 */
export function useFixedRoomHeight(ref: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const el = ref.current;
    if (el === null) return;
    let raf = 0;
    const measure = (): void => {
      el.style.removeProperty("--mf-room-h");
      const h = el.offsetHeight;
      if (h > 0) el.style.setProperty("--mf-room-h", `${h}px`);
    };
    const onChange = (): void => {
      if (typingInChat()) return;
      // 방향 이벤트 직후에는 높이가 아직 옛 값일 수 있어 한 프레임 뒤에 읽는다
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (!typingInChat()) measure();
      });
    };
    measure();
    window.addEventListener("resize", onChange);
    window.addEventListener("orientationchange", onChange);
    return () => {
      window.removeEventListener("resize", onChange);
      window.removeEventListener("orientationchange", onChange);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ref]);
}
