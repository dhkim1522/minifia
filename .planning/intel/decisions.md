# 결정 (decisions)

> ADR 4건에서 추출. 모두 `locked: true` (상태: 채택). 서로 모순되는 결정은 없다.

## ADR-0001: 웹앱 먼저, 출시 때 같은 코드로 앱 감싸기
- source: /Users/dhkim1522/personal/minifia/docs/decisions/0001-web-first.md
- status: locked (채택, 2026-10-21)
- decision: React + TypeScript 웹앱(PWA)으로 먼저 만든다. 정식 출시 때 같은 코드를 Capacitor 로 감싸 Android·iOS 앱으로 낸다. 웹 링크 참가는 앱 출시 후에도 유지한다.
- scope: React, TypeScript, PWA, Capacitor, Android, iOS, 웹 링크 참가
- 결과(원문): 방장만 앱이 있어도 나머지는 링크·QR 로 참가 가능. 플레이테스트는 웹 URL 공유로 하며 TestFlight·스토어 심사·Apple 개발자 계정은 앱 출시 단계까지 불필요. iOS 심사에서 웹 감싼 앱으로 거절되지 않도록 출시 단계에 진동·공유·알림 같은 기기 기능을 붙여야 한다. 무거운 3D·고급 그래픽은 어렵고 2D 캐릭터·애니메이션 범위는 문제없다.

## ADR-0002: 실시간 서버는 Cloudflare Durable Objects
- source: /Users/dhkim1522/personal/minifia/docs/decisions/0002-cloudflare-durable-objects.md
- status: locked (채택, 2026-10-21)
- decision: Cloudflare Workers + Durable Objects 를 쓴다. 방 하나를 Durable Object 하나로 두고 WebSocket 으로 연결한다. 게임 규칙과 판정은 Durable Object 안에서만 한다.
- scope: Cloudflare Workers, Durable Objects, WebSocket, 실시간 서버, 게임 판정, wrangler CLI
- 결과(원문): 방 상태가 한 곳에 있어 동시 투표·타이머 처리에 경합이 없다. 클라이언트를 조작해도 다른 사람의 역할을 볼 수 없다(서버가 볼 수 있는 상태만 전송). 웹 정적 파일도 Workers 에서 함께 배포한다. Cloudflare 계정과 `wrangler` CLI 가 필요하다.

## ADR-0003: 정통 마피아 진행, 무거운 분위기, 특색 있는 캐릭터
- source: /Users/dhkim1522/personal/minifia/docs/decisions/0003-classic-rules-dark-mood.md
- status: locked (채택, 2026-10-21)
- decision: 진행은 정통 마피아 그대로("밤이 되었습니다", 마피아 지목, 처형 투표). 배경과 연출은 무거운 분위기. 캐릭터는 단순하지만 각자 외형·성격이 드러나게 만든다.
- scope: 정통 마피아 진행, 무거운 분위기 배경과 연출, 캐릭터 외형과 성격, 디자인 참고 자료
- 결과(원문): 디자인 참고 자료는 무거운 분위기 배경과 특색 있는 캐릭터 위주로 모은다(`design/references/`). 캐릭터 성격은 MVP 에서 외형·소개 문구에만 쓰고 게임 능력에는 영향을 주지 않는다.

## ADR-0004: 개발 진행은 GSD Core 와 gsd-addons 로 한다
- source: /Users/dhkim1522/personal/minifia/docs/decisions/0004-gsd-workflow.md
- status: locked (채택, 2026-10-21)
- decision: 진행은 GSD Core 를 수정 없이 쓰고(개인 설정 폴더 `CLAUDE_CONFIG_DIR=~/.claude-personal` 에 전역 설치), 개인 확장은 gsd-addons 플러그인(한국어 산출물, 작은 MVP, 이른 배포, TDD 모드, 디자인 참고 자료 규칙)으로 더한다. MVP 는 핵심 흐름(방 만들기·참가 -> 역할 확인 -> 밤 -> 낮 토론·투표 -> 최후 변론 -> 결과)만 넣고, 만든 뒤 친구들과 실제로 해 보며 피드백으로 확장·개선한다. 1페이즈(걷는 뼈대) 성공 기준에 Cloudflare 배포를 넣어 폰 여러 대로 같은 방에 들어갈 수 있게 한다. 디자인 참고 자료는 고정 폴더 없이 디자인 단계에서 경로를 주면 따르고 없으면 자체 판단으로 진행한다(`design/references/` 는 보관 위치로 쓸 수 있으나 필수 아님).
- scope: GSD Core, gsd-addons, 개발 워크플로, `.planning/`, `docs/decisions/`, 페이즈별 PR, 1페이즈 Cloudflare 배포, 디자인 참고 자료
- 결과(원문): 요구사항·로드맵·진행 상태의 원천은 `.planning/` 이다. `docs/product.md` 는 콘셉트와 규칙 설명, `docs/decisions/` 는 결정 기록으로 계속 쓰며, 둘이 어긋나면 `.planning/` 을 기준으로 맞춘다. GSD 는 페이즈마다 PR 을 만든다(`/gsd-ship`), `main` 직접 커밋 대신 페이즈 PR 을 병합한다. 다른 PC 에서는 GSD Core 와 gsd-addons 를 같은 방식으로 설치해야 이어서 작업할 수 있다(`HANDOFF.md` 환경 메모).
