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

- 캐릭터를 2D 리그(0046-5) 그대로 갈지, 실제 3D 모델로 바꿀지 — 사용자가 "캐릭터도 3D"로 알고 있었음. 6페이즈 리서치는 2D 기준(DOM 겹치기 권고)이라 바꾸면 결정 0046 과 리서치를 고친다.
- 6페이즈 계획 전 답: three `0.186.1`(권고) vs `0.187.0`, 응접실 모이는 링 반지름 2.5 로 UI-SPEC 수정 여부, 실기기 목록(저가 Android·구형 iPhone)과 `adb` 유무.
- 8·9페이즈에서 맵(응접실·광장)과 시간대 5개를 게임 단계에 어떻게 붙일지 — 해당 UI 단계에서 정한다. 로비(6페이즈)는 응접실 저녁 고정으로 확정.

## 다음 할 일

1. 디자인 먼저(남은 것): v2.0 디자인 시스템(0046-7: 실내 따뜻한 등 허용, 광장은 차가운 흰빛, 진홍은 마피아 전용, 낮도 낮은 명도·채도)과 화면설계서(로비·채팅창·동작 목록·지목·변론·찬반·밤·아침·결과·시상식)를 캔버스로 만들어 승인받고 사본을 `design/v2.0/` 에 둔다.
2. 6페이즈 UI-SPEC 승인됨(`.planning/phases/06-world-skeleton/06-UI-SPEC.md`, v1.0 토큰 기준 임시 — 1번 승인 뒤 "임시 기준 경고" 표 항목을 다시 맞춘다). 리서치 완료(`06-RESEARCH.md`: 캐릭터 DOM 겹치기 권고, WR-01~04 는 v1.0 에서 이미 수정됨 → CONN-04 는 검증·회귀 테스트, 응접실 시안은 폰 예산 초과 가능성). 다음은 위 확인 대기 답을 받고 `/gsd-plan-phase 6`.
3. 시안 아티팩트: 배경 https://claude.ai/artifact/LztT25LDkxJcfnRjiaPTfE · 캐릭터 https://claude.ai/artifact/QPVNH7DN4jQwpMGtHivssc. v1.0 산출물 링크는 `CLAUDE.md`.
