# 작업 인계

> 두 PC·다음 세션이 이어 가는 데 필요한 최소 정보만 적는다. **해결된 항목은 지운다**(기록은 결정 기록·SUMMARY·git 에 있다). 6KB 이하(`test/unit/handoff.test.ts`). 환경 설정은 `docs/setup.md`.

## 지금 상태

- **v2.0 "같은 공간" 시작(2026-10-30~31)**: 팀 피드백 → 범위(결정 0044) → 리서치(`.planning/research/`) → 요구사항 44개 → 로드맵 6~12페이즈 승인. 맵 이동·자유 채팅·동작 캐릭터, 처형은 지목→변론→찬반, 밤은 마피아만 이동·시민 어둠. 역할·승패 규칙은 그대로.
- **그림 방향 확정(결정 0046)**: three.js 아이소메트릭 3D 맵(달빛 응접실·달빛 시계탑 광장, 시간대 5개) + 로우폴리 면 색면 2D 리그 캐릭터(세트 C 얼굴, 의상 8·동작 8·앞옆뒤). 승인본 사본 `design/v2.0/`(README), 참고 자료 `design/references/v2.0/`. 0045(말랑 클레이)는 대체됨.
- **브랜치**: 작업은 **`v2`** 브랜치. `v1` 은 v1.0 배포본 수정 전용, `main` 은 배포된 버전(지금 v1.0), 태그 `v1.0`. 다른 PC 에서는 `git fetch` 후 `git switch v2`.
- 배포: v1.0 `https://minifia.dhplay.workers.dev` 는 그대로 둔다. v2.0 은 Worker `minifia-v2`(결정 0044-24). **`wrangler.jsonc` 이름과 E2E/smoke 기본 주소가 아직 v1.0 이라 그대로 배포하면 v1.0 을 덮어쓴다** — 6페이즈 첫 작업에서 바꾸고 가드를 둔다.
- 도구 메모: 버전은 `/api/health`. `npm run e2e` 는 인자가 없으면 배포본을 검사한다(로컬은 `npm run dev` 후 `-- --url http://localhost:5173`). CSS `backdrop-filter` 는 비접두 한 번만(`verdictCss.test.ts`).
- 커밋 제외: `design/backgrounds/indoor-draft/`, `Claude outputs/`, `.planning/milestone.lock`, `.planning/state.json`.

## 확인 대기 (사용자 답·확인이 필요한 것)

- 맵 두 개(응접실·광장)를 어느 단계·판에 쓸지, 시간대 5개를 게임 단계에 어떻게 붙일지 — UI 단계에서 정한다.

## 다음 할 일

1. 디자인 먼저(남은 것): v2.0 디자인 시스템(0046-7: 실내 따뜻한 등 허용, 광장은 차가운 흰빛, 진홍은 마피아 전용, 낮도 낮은 명도·채도)과 화면설계서(로비·채팅창·동작 목록·지목·변론·찬반·밤·아침·결과·시상식)를 캔버스로 만들어 승인받고 사본을 `design/v2.0/` 에 둔다.
2. 그다음 `/gsd-ui-phase 6` → `/gsd-plan-phase 6 --research-phase`(월드 뼈대: `minifia-v2` 배포·로비 맵 이동·three.js 맵+2D 캐릭터 성능 게이트·WR-01~04).
3. 시안 아티팩트: 배경 https://claude.ai/artifact/LztT25LDkxJcfnRjiaPTfE · 캐릭터 https://claude.ai/artifact/QPVNH7DN4jQwpMGtHivssc. v1.0 산출물 링크는 `CLAUDE.md`.
