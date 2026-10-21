# 0004 개발 진행은 GSD Core 와 gsd-addons 로 한다

- 상태: 채택
- 날짜: 2026-10-21

## 배경

- 이전 프로젝트(runmagochi)는 단계와 산출물을 미리 정하지 않아, 시장조사·핵심 흐름·디자인 단계·플랫폼 전략이 구현 중에 정해지고 페이즈를 여러 번 끼워 넣었다. 실사용자 확인도 계속 뒤로 밀렸다.
- 기획부터 구현까지 묶은 오픈소스(BMAD, Spec Kit, OpenSpec, gstack, GSD)를 비교했다. 전부를 직접 만들거나 포크하는 것보다, 가장 가까운 GSD Core 를 그대로 쓰고 빈 곳만 확장하는 편이 유지 비용이 낮다.
- AI 로 MVP 를 만드는 비용이 낮아, 가짜 프로토타입을 사람에게 보여 주고 기다리는 것보다 실물 MVP 로 검증하는 편이 빠르다.

## 결정

- 진행은 [GSD Core](https://github.com/open-gsd/gsd-core) 를 수정 없이 쓴다. 개인 설정 폴더에 전역 설치한다 (`CLAUDE_CONFIG_DIR=~/.claude-personal`).
- 개인 확장은 [gsd-addons](https://github.com/dhkim1522/gsd-addons) 플러그인으로 더한다: 한국어 산출물, 작은 MVP, 이른 배포, TDD 모드, 디자인 참고 자료 규칙.
- MVP 는 핵심 흐름(방 만들기·참가 → 역할 확인 → 밤 → 낮 토론·투표 → 최후 변론 → 결과)만 넣고, 만든 뒤 친구들과 실제로 해 보며 피드백으로 확장·개선한다.
- 1페이즈(걷는 뼈대) 성공 기준에 Cloudflare 배포를 넣어, 폰 여러 대로 같은 방에 들어갈 수 있게 한다.
- 디자인 참고 자료는 고정 폴더 없이, 디자인 단계에서 경로를 주면 따르고 없으면 자체 판단으로 진행한다. `design/references/` 는 보관 위치로 쓸 수 있지만 필수가 아니다.

## 결과

- 요구사항·로드맵·진행 상태의 원천은 `.planning/` (GSD) 이다. `docs/product.md` 는 콘셉트와 규칙 설명, `docs/decisions/` 는 결정 기록으로 계속 쓴다. 둘이 어긋나면 `.planning/` 을 기준으로 맞춘다.
- GSD 는 페이즈마다 PR 을 만든다 (`/gsd-ship`). `main` 직접 커밋 대신 페이즈 PR 을 병합한다.
- 다른 PC 에서는 GSD Core 와 gsd-addons 를 같은 방식으로 설치해야 이어서 작업할 수 있다 (`HANDOFF.md` 환경 메모).
