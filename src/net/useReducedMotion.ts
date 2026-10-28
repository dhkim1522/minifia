// 움직임 줄이기 설정(prefers-reduced-motion) 구독 훅 (04-20). CSS 미디어 쿼리로 끝나는 연출은 이 훅이 필요 없고,
// 자바스크립트 시간표가 모양을 바꿔야 할 때(공개 화살표는 자라지 않고 완성된 모습으로 보인다)만 쓴다.
// matchMedia 가 없는 환경(테스트·아주 옛 브라우저)은 false 다. 설정이 바뀌면 따라가고, 언마운트하면 구독을 푼다.
import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function query(): MediaQueryList | null {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(QUERY) : null;
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => query()?.matches === true);
  useEffect(() => {
    const mql = query();
    if (mql === null) return;
    setReduced(mql.matches);
    const onChange = (e: { matches: boolean }): void => setReduced(e.matches);
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }
    // 옛 사파리: addListener
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, []);
  return reduced;
}
