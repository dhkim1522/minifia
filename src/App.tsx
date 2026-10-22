import { useCallback, useState } from "react";
import { Home } from "./screens/Home";
import { RoomScreen } from "./screens/RoomScreen";

type Screen = { screen: "home" } | { screen: "room"; code: string; token: string };

export function App() {
  const [current, setCurrent] = useState<Screen>({ screen: "home" });
  const goHome = useCallback(() => setCurrent({ screen: "home" }), []);

  if (current.screen === "room") {
    return <RoomScreen code={current.code} token={current.token} onExit={goHome} />;
  }
  return <Home onEnterRoom={(code, token) => setCurrent({ screen: "room", code, token })} />;
}
