# 6페이즈 미룬 항목 (범위 밖 발견)

> 계획 실행 중 발견했지만 그 계획의 파일·범위 밖이라 고치지 않은 항목. 고치는 계획이 생기면 지운다.

## 06-18 에서 발견

### 로비에서 "preloaded but not used" 콘솔 경고 17개 묶음 반복

- **증상:** 로비에 머무는 동안 Chrome 이 `The resource …/journals/*.svg · characters/roles/*_default@2x.png · backgrounds/bg_game_*.webp · characters/ghost/ghost_default@2x.png was preloaded using link preload but not used within a few seconds from the window's load event` 경고를 17개 한 묶음으로 남긴다. E2E reconnect 흐름에서 같은 묶음이 라운드마다(오프라인·WebGL 소실 종류 10회 × 17 = 170건) 되풀이됐다.
- **원인(추정):** `src/screens/RoomScreen.tsx` 가 `phase === "lobby"` 일 때 `preloadRoleAssets()`(`src/net/assets.ts`, react-dom `preload`)로 역할 카드·일지·배경 그림을 미리 받아 두는데, 로비에서는 쓰이지 않아 브라우저가 경고한다. v1.0 의 기존 동작이고 재접속과 무관하다.
- **왜 안 고쳤나:** 06-18 은 E2E 계획이고 프리로드는 게임 전환 속도를 위한 v1.0 결정이다. 고치려면 프리로드 시점을 정하는 설계 판단이 필요하다.
- **E2E 에서의 처리:** `scripts/e2e/lib.mjs` 의 `CONSOLE_ALLOW` 에 이유와 함께 한 줄로 올렸다(`preload-unused`). 이 경고만 허용하고 그 밖의 경고·오류는 모두 실패다. 프리로드를 고치면 이 허용 항목을 지운다.
- **후보 처리:** 프리로드를 역할 확인 직전(`assigning`)으로 늦추거나 `as: "image"` 대신 실제로 쓰는 시점에 요청하는 방식. 7페이즈(채팅 배치) 또는 별도 정리에서 결정.
  status: acknowledged
