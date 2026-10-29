// CONN-03 화면 꺼짐 방지(D-12·D-13, 05-UI-SPEC 12). DOM 에 그리지 않는다. 미지원·거부는 조용히 생략하고 로그를 남기지 않는다.
// 재요청은 visibilitychange(visible) 한 곳뿐 — release 이벤트로 재요청하지 않는다(저전력 모드 반복 거부 방지).
// 상태(sentinel·진행 중 여부·비활성 표시)는 effect 한 번의 수명에 갇힌 지역 값이다 — active 가 바뀌면 정리 함수가 풀고, 다음 effect 는 깨끗하게 시작한다.
import { useEffect } from "react";

export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    // 보안 맥락(https·localhost)이 아니거나 옛 브라우저면 없다 — 조용히 생략한다.
    const wakeLock = typeof navigator === "undefined" ? undefined : navigator.wakeLock;
    if (!wakeLock) return;

    let alive = true;
    let pending = false;
    let sentinel: WakeLockSentinel | null = null;

    const dropQuietly = (s: WakeLockSentinel): void => {
      try {
        void Promise.resolve(s.release()).catch(() => {});
      } catch {
        // 이미 풀린 잠금의 release 실패는 보이지 않는다.
      }
    };

    // 진행 중이거나 살아 있는 sentinel 이 있으면 겹쳐 요청하지 않는다. 동기 예외·거부는 삼킨다(재시도 없음).
    const acquire = (): void => {
      if (pending || (sentinel !== null && !sentinel.released)) return;
      let request: Promise<WakeLockSentinel>;
      try {
        request = wakeLock.request("screen");
      } catch {
        return;
      }
      pending = true;
      request.then(
        (s) => {
          pending = false;
          if (!alive) {
            // 요청이 끝나기 전에 비활성이 됐다: 받자마자 푼다.
            dropQuietly(s);
            return;
          }
          sentinel = s;
          // release 이벤트는 "풀렸다" 표시일 뿐이다. 여기서 다시 요청하지 않는다.
          s.addEventListener("release", () => {
            if (sentinel === s) sentinel = null;
          });
        },
        () => {
          pending = false;
        },
      );
    };

    const onVisibility = (): void => {
      if (document.visibilityState === "visible") acquire();
    };

    acquire();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisibility);
      if (sentinel !== null) {
        const s = sentinel;
        sentinel = null;
        dropQuietly(s);
      }
    };
  }, [active]);
}
