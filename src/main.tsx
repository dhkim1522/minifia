import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/ds.css";
import { App } from "./App";
import { initPerfDebug } from "./debug/perfProbe";
import { initSheetDebug } from "./debug/sheetProbe";

// ?sheetdebug=1 탭에서만 시트 계측 본체를 지연 로드한다(G-01-9 진단). 꺼져 있으면 아무 일도 하지 않는다.
void initSheetDebug();

// ?perf=1(성능 스파이크)·?chat-mock=1(하단 채팅 배치 시안)은 제품 화면이 아니다: 쿼리일 때만 본체를 지연 로드해 App 대신 띄운다(결정 0055).
if (!initPerfDebug()) {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
