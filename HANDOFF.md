# 작업 인계

> 두 PC·다음 세션이 이어 가는 데 필요한 최소 정보만 적는다. **해결된 항목은 지운다**(기록은 결정 기록·SUMMARY·git 에 있다). 6KB 이하(`test/unit/handoff.test.ts`). 환경 설정은 `docs/setup.md`.

## 지금 상태

- **v1.0 마감·보관(2026-10-30, 결정 0043)**: 팀 실게임 테스트 결과 이대로 출시는 어렵다고 판단해 v1.0 을 보관하고 v2.0 을 새로 기획한다. 기록 `.planning/MILESTONES.md`, 보관본 `.planning/milestones/v1.0-*`(페이즈 문서 `v1.0-phases/`).
- **브랜치**: 작업은 **`v2`** 브랜치에서 한다. `v1` 은 v1.0 배포본 수정 전용, `main` 은 배포된 버전(지금 v1.0), 태그 `v1.0`. 다른 PC 에서는 `git fetch` 후 `git switch v2`.
- v1.0 배포본 `https://minifia.dhplay.workers.dev` 버전 `2026-10-29T14:52:03Z+cb6979c` 는 그대로 둔다. v2.0 은 다른 Worker 이름·주소에 배포한다(이름은 v2.0 기획에서). 서버·화면은 함께 배포하고 `npm run deploy` 가 개인 계정을 먼저 확인한다(결정 0042, `preview_urls: false` 는 다음 배포부터).
- 도구 메모: 버전은 `/api/health`. `npm run e2e` 는 인자가 없으면 배포본을 검사한다(로컬은 `npm run dev` 후 `-- --url http://localhost:5173`). 이 PC 의 배포본 smoke 는 네트워크에 따라 간헐 실패한 적이 있다 — 단독 재확인, 한도는 바꾸지 않는다. CSS `backdrop-filter` 는 비접두 한 번만(`verdictCss.test.ts`).
- 커밋 제외: `design/backgrounds/indoor-draft/`, `Claude outputs/`, `.planning/milestone.lock`, `.planning/state.json`.

## 확인 대기 (사용자 답·확인이 필요한 것)

- v2.0 기획 재료: 사용자가 받아 온 팀 테스트 피드백·아이디어(v2.0 시작 때 하나씩 적고 함께 논의).
- v2.0 캐릭터 최종 시안 승인(결정 0045, A 말랑 클레이): https://claude.ai/artifact/PPLmn6koNKgJbiBUDiNmnc · 비교 시안 https://claude.ai/artifact/725Naddf6wqXC2H3dnvcGi. 승인되면 사본을 `design/characters/v2.0/` 에 둔다.
- 렌더 방식: 사용자는 three.js 3D 를 원했지만 결정 0044-16·ROADMAP 6·10페이즈는 "three.js 안 씀(SVG 2D 리그)". 어느 쪽으로 갈지 결정 필요.

## 다음 할 일

1. `v2` 브랜치에서 `/gsd-new-milestone` 으로 v2.0 시작: 피드백 정리(결정 기록) → 기획 → 요구사항·로드맵 → 디자인 먼저(캔버스 승인) → 페이즈 구현.
2. v1.0 산출물(그대로 보관): 디자인 시스템·화면설계서·화면 흐름·캐릭터 에셋 아티팩트(링크는 `CLAUDE.md`), 사본 `design/screens/v1.0/`, 영역 지도 `docs/screen-map.md`. 포트폴리오 슬라이드 https://claude.ai/artifact/P7aBWj4g2nHNTVeQHKEiY2 · 경력기술서 https://claude.ai/artifact/KMQUK84xtVpi5UcCPFwDFZ.
