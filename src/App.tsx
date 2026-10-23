import { useCallback, useEffect, useState } from "react";
import { isRoomCode } from "../shared/roomCode";
import { Backdrop } from "./components/Backdrop";
import { getPreview } from "./net/api";
import { clearSession, loadSession, saveSession } from "./net/session";
import { Home } from "./screens/Home";
import { JoinByLink } from "./screens/JoinByLink";
import { RoomScreen } from "./screens/RoomScreen";

type Screen =
  | { screen: "home" }
  | { screen: "resuming"; code: string; token: string }
  | { screen: "join"; code: string; notice: string | null }
  | { screen: "room"; code: string; token: string };

// 라우터 라이브러리 없이 경로로 첫 화면을 정한다. 경로에는 `/r/{코드}` 만 쓰고 토큰은 넣지 않는다.
function codeFromPath(pathname: string): string | null {
  const match = /^\/r\/([^/]+)\/?$/.exec(pathname);
  return match && isRoomCode(match[1]!) ? match[1]! : null;
}

// resume: 페이지를 새로 열 때만 "/" 에서 저장된 입장 정보를 이어받는다. 뒤로 가기로 "/" 에 온 경우는 첫 화면이다.
function screenFromLocation(resume: boolean): Screen {
  const code = codeFromPath(window.location.pathname);
  const stored = loadSession();
  if (code === null) {
    return resume && stored ? { screen: "resuming", code: stored.code, token: stored.token } : { screen: "home" };
  }
  // 한 칸뿐인 입장 정보라 다른 방 링크는 이어받지 않고 그 방의 링크 참가 화면을 보인다.
  if (stored && stored.code === code) return { screen: "room", code, token: stored.token };
  return { screen: "join", code, notice: null };
}

export function App() {
  const [current, setCurrent] = useState<Screen>(() => screenFromLocation(true));

  const goHome = useCallback(() => {
    window.history.pushState(null, "", "/");
    setCurrent({ screen: "home" });
  }, []);

  const enterRoom = useCallback((code: string, token: string) => {
    saveSession({ code, token });
    window.history.replaceState(null, "", `/r/${code}`);
    setCurrent({ screen: "room", code, token });
  }, []);

  // 뒤로·앞으로 가기: 주소에 맞는 화면을 다시 정한다.
  useEffect(() => {
    const onPopState = () => setCurrent(screenFromLocation(false));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // 낡은 입장 정보 확인(Pitfall 22): 방이 아직 있는지 먼저 물어, 없으면 정보를 지우고 첫 화면을 보여 준다.
  // 네트워크 실패 등은 방 화면이 연결 계층에서 판단하게 넘긴다.
  useEffect(() => {
    if (current.screen !== "resuming") return;
    const { code, token } = current;
    let cancelled = false;
    void getPreview(code).then((result) => {
      if (cancelled) return;
      if (!result.ok && result.error === "ROOM_NOT_FOUND") {
        clearSession();
        setCurrent({ screen: "home" });
        return;
      }
      window.history.replaceState(null, "", `/r/${code}`);
      setCurrent({ screen: "room", code, token });
    });
    return () => {
      cancelled = true;
    };
  }, [current]);

  if (current.screen === "room") {
    return <RoomScreen code={current.code} token={current.token} onExit={goHome} />;
  }
  if (current.screen === "resuming") {
    return (
      <Backdrop layout="entry" variant="lobby">
        <main className="mf-root mf-entry">
          <p className="mf-t-body mf-t-muted mf-entry__loading">방 정보를 불러오는 중…</p>
        </main>
      </Backdrop>
    );
  }
  if (current.screen === "join") {
    return <JoinByLink code={current.code} notice={current.notice} onEnterRoom={enterRoom} onHome={goHome} />;
  }
  return <Home onEnterRoom={enterRoom} />;
}
