import { useEffect, useMemo, useState } from "react";
import type { RoomView } from "../../shared/protocol";

export const FIRST_GAME_GUIDE_KEY = "minifia:firstGameGuide";

interface FirstGameGuideProgress {
  code: string;
  round: number;
  seen: string[];
}

export interface FirstGameGuideSession {
  seen: (id: string) => boolean;
  markSeen: (id: string) => void;
}

function loadProgress(): FirstGameGuideProgress | null {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(FIRST_GAME_GUIDE_KEY) ?? "null");
    if (typeof saved === "object" && saved !== null && "code" in saved && typeof saved.code === "string" &&
      "round" in saved && typeof saved.round === "number" && "seen" in saved && Array.isArray(saved.seen) &&
      saved.seen.every((id) => typeof id === "string")) {
      return { code: saved.code, round: saved.round, seen: saved.seen };
    }
  } catch { /* 저장소가 막혀도 현재 방에서 안내는 쓸 수 있다. */ }
  return null;
}

function saveProgress(progress: FirstGameGuideProgress): void {
  try {
    localStorage.setItem(FIRST_GAME_GUIDE_KEY, JSON.stringify(progress));
  } catch { /* 현재 방에서는 메모리의 진행 상태를 쓴다. */ }
}

/** 첫 참가 판을 기억하고 같은 판을 새로고침해도 이미 본 안내를 반복하지 않는다. */
export function useFirstGameGuide(view: RoomView | null): FirstGameGuideSession | undefined {
  const [progress, setProgress] = useState(loadProgress);
  const code = view?.code;
  const round = view?.round ?? 1;
  const playing = view !== null && !view.resting && view.phase !== "lobby" && view.phase !== "ended";

  useEffect(() => {
    if (!playing || code === undefined || progress !== null) return;
    const first = loadProgress() ?? { code, round, seen: [] };
    saveProgress(first);
    setProgress(first);
  }, [code, round, playing, progress]);

  const session = useMemo<FirstGameGuideSession | undefined>(() => {
    if (progress === null) return undefined;
    return {
      seen: (id) => progress.seen.includes(id),
      markSeen: (id) => {
        if (progress.seen.includes(id)) return;
        progress.seen.push(id);
        saveProgress(progress);
      },
    };
  }, [progress]);

  return playing && progress?.code === code && progress?.round === round ? session : undefined;
}
