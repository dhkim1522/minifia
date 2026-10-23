import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/ds.css";
import { App } from "./App";
import { initSheetDebug } from "./debug/sheetProbe";

// ?sheetdebug=1 탭에서만 시트 계측 본체를 지연 로드한다(G-01-9 진단). 꺼져 있으면 아무 일도 하지 않는다.
void initSheetDebug();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
