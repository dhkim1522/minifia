import { useEffect, useState } from "react";
import { phaseIntroActive } from "../../shared/game/phases";

/** 새로 입장한 클라이언트도 서버가 정한 열림 시각까지만 안내를 표시한다. */
export function usePhaseIntro(startsAt: number | undefined, offset: number): number | undefined {
  const [completed, setCompleted] = useState<number>();
  const active = startsAt !== completed && phaseIntroActive(startsAt, Date.now() + offset);

  useEffect(() => {
    if (!active || startsAt === undefined) return;
    const finish = () => setCompleted(startsAt);
    const id = setTimeout(finish, Math.max(0, startsAt - offset - Date.now()));
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() + offset >= startsAt) finish();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [active, offset, startsAt]);

  return active ? startsAt : undefined;
}
