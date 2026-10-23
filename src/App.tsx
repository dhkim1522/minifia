import { useCallback, useEffect, useState } from "react";
import { isRoomCode } from "../shared/roomCode";
import { Home } from "./screens/Home";
import { JoinByLink } from "./screens/JoinByLink";
import { RoomScreen } from "./screens/RoomScreen";
import { loadSession, saveSession } from "./net/session";

type Screen =
  | { screen: "home" }
  | { screen: "join"; code: string; notice: string | null }
  | { screen: "room"; code: string; token: string };

// 라우터 라이브러리 없이 경로로 첫 화면을 정한다. 경로에는 `/r/{코드}` 만 쓰고 토큰은 넣지 않는다.
function codeFromPath(pathname: string): string | null {
  const match = /^\/r\/([^/]+)\/?$/.exec(pathname);
  return match && isRoomCode(match[1]!) ? match[1]! : null;
}

function screenFromLocation(): Screen {
  const code = codeFromPath(window.location.pathname);
  if (code === null) return { screen: "home" };
  const stored = loadSession();
  if (stored && stored.code === code) return { screen: "room", code, token: stored.token };
  return { screen: "join", code, notice: null };
}

export function App() {
  const [current, setCurrent] = useState<Screen>(screenFromLocation);

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
    const onPopState = () => setCurrent(screenFromLocation());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  if (current.screen === "room") {
    return <RoomScreen code={current.code} token={current.token} onExit={goHome} />;
  }
  if (current.screen === "join") {
    return <JoinByLink code={current.code} notice={current.notice} onEnterRoom={enterRoom} onHome={goHome} />;
  }
  return <Home onEnterRoom={enterRoom} />;
}
