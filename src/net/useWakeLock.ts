// CONN-03 화면 꺼짐 방지(D-12·D-13, 05-UI-SPEC 12). DOM 에 그리지 않는다. 미지원·거부는 조용히 생략하고 로그를 남기지 않는다.
// 재요청은 visibilitychange(visible) 한 곳뿐 — release 이벤트로 재요청하지 않는다(저전력 모드 반복 거부 방지).
import { useEffect } from "react";

export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const wakeLock = navigator.wakeLock;
    if (!wakeLock) return;
    void wakeLock.request("screen");
  }, [active]);
}
