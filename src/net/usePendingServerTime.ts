import { useEffect, useState } from "react";

/** 서버 시각이 되면 새 프레임을 기다리지 않고 만료한다. */
export function usePendingServerTime(startsAt: number | undefined, offset: number): number | undefined {
  const [completed, setCompleted] = useState<number>();
  const active = startsAt !== undefined && startsAt !== completed && Date.now() + offset < startsAt;

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
