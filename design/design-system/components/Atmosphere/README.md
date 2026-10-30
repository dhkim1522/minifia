# Atmosphere

장면 위에 얹는 분위기 층 두 개다(결정 0038, 원천 `src/game/scenes.ts` · `src/styles/atmosphere.css`). 캐릭터 움직임 · 진동은 넣지 않았다(앱 전환 때 검토).

- **밤 비네팅**: `radial-gradient(ellipse 70% 60% at 50% 44%)`, `night-950` 알파 0%→0, 45%→0, 75%→.40, 100%→.72(`NIGHT_VIGNETTE_STOPS`). 밤 단계 동안 장면 교차 페이드와 같이 0.8초에 들어오고 나간다.
- **아침 밝아짐**: `radial-gradient(ellipse 85% 60% at 50% 55%)`, `dawn` 38%(`MORNING_GLOW_ALPHA`), 600ms 에 올라온다.
- 두 층 모두 역할 · 연결 상태와 상관없이 같고, 앰버 · 진홍을 쓰지 않는다. 모션 줄이기에서는 정적 상태로 보인다.
- 같은 맥락의 클라이언트 전용 기능: 화면 꺼짐 방지 Wake Lock(대기실부터 게임 끝까지, 실패는 조용히 생략).
