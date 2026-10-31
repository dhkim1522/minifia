# 작업 인계

> 두 PC·다음 세션이 이어 가는 데 필요한 최소 정보만 적는다. **해결된 항목은 지운다**(기록은 결정 기록·SUMMARY·git 에 있다). 6KB 이하(`test/unit/handoff.test.ts`). 환경 설정은 `docs/setup.md`.

## 지금 상태

- **v2.0 "같은 공간" 시작(2026-10-30~31)**: 팀 피드백 → 범위(결정 0044) → 리서치(`.planning/research/`) → 요구사항 44개 → 로드맵 6~12페이즈 승인. 맵 이동·자유 채팅·동작 캐릭터, 처형은 지목→변론→찬반, 밤은 마피아만 이동·시민 어둠. 역할·승패 규칙은 그대로.
- **그림 방향**: 맵은 three.js 아이소메트릭 3D(결정 0046). 캐릭터는 **1번 시안의 구·원통 조립 3D 인물(결정 0047, 2D 리그 대체). 에셋 원본은 1번 시안 아티팩트 https://claude.ai/artifact/NP1XfUrYTTqQ5nAB1HKYT5 (결정 0048, 사본 `design/v2.0/figure/`): 의상 9종(요리사·농부 뺌, 누아르 정장 유지 + 마피아·어르신·후드), 모자는 머리를 덮고 안의 머리카락은 잘라 낸다**. 에셋 캔버스의 `mf3d.js` 캐릭터는 0048 이전 방식이라 구현 때 원본을 따른다. 모이는 자리가 게임 장치: 응접실은 지목 때 원탁 의자에 앉고 변론 때 조명이 꺼지며 변론자만 스포트라이트, 광장은 시계탑 = 게임 시계·놋쇠 자리 8·가운데 단. 에셋 캔버스 https://claude.ai/artifact/MExvQNQTCwZdJ79XYSLPQk (사본 `design/v2.0/3d/`, 공용 코드 `mf3d.js`).
- **브랜치**: 작업은 **`v2`** 브랜치. `v1` 은 v1.0 배포본 수정 전용, `main` 은 배포된 버전(지금 v1.0), 태그 `v1.0`. 다른 PC 에서는 `git fetch` 후 `git switch v2`.
- 배포: v1.0 `https://minifia.dhplay.workers.dev` 는 그대로 둔다. v2.0 은 Worker `minifia-v2`(결정 0044-24). **`wrangler.jsonc` 이름과 E2E/smoke 기본 주소가 아직 v1.0 이라 그대로 배포하면 v1.0 을 덮어쓴다** — 6페이즈 첫 작업에서 바꾸고 가드를 둔다.
- 도구 메모: 버전은 `/api/health`. `npm run e2e` 는 인자가 없으면 배포본을 검사한다(로컬은 `npm run dev` 후 `-- --url http://localhost:5173`). CSS `backdrop-filter` 는 비접두 한 번만(`verdictCss.test.ts`).
- 커밋 제외: `design/backgrounds/indoor-draft/`, `Claude outputs/`, `.planning/milestone.lock`, `.planning/state.json`.

## 확인 대기 (사용자 답·확인이 필요한 것)

- **배경 확정(사용자)**: 지금 배경은 2D 캐릭터 시절 비율이라 새로 짓기로 기울었다(의자 0.56 < 몸통 0.65, 원탁 자리 간격 1.45 < 챙 1.4~). 지목·변론 배경 5안 블록아웃 캔버스 https://claude.ai/artifact/1hzgEyAufgnDPVMvPvxdhP (① 재즈 바 추천 ② 법정 ③ 시계탑 광장 ④ 만찬 식탁 ⑤ 룰렛, 단계 4개 전환) 에서 고르는 중. 공용 엔진 `blockout.js` + 안별 파일. 기존 맵 플레이그라운드 https://claude.ai/artifact/NP1XfUrYTTqQ5nAB1HKYT5 4판에서 캐릭터 8명과 함께 보고 정한다. 4판은 `index.html`(화면) + `world.js`(맵, `mf3d.js` 에서 캐릭터를 뺌 + 광장 이동 막힘) + `character.js`(0048 캐릭터)로 나눴다. 승인되면 두 모듈을 `design/v2.0/` 로 복사하고 결정을 남긴 뒤 `/gsd-plan-phase 6`.
- 3D 에셋 캔버스 검토(사용자): 최후 변론 위치 ① 원탁(광장은 가운데 단) 위로 올라서기 ② 자기 자리에서 일어서기 중 무엇으로 할지(게임 흐름 보드에서 비교).
- 6페이즈 계획 전 답: three `0.186.1`(권고) vs `0.187.0`, 응접실 모이는 링 반지름 2.5 로 UI-SPEC 수정 여부, 실기기 목록(저가 Android·구형 iPhone)과 `adb` 유무.
- 8·9페이즈에서 맵(응접실·광장)과 시간대 5개를 게임 단계에 어떻게 붙일지 — 해당 UI 단계에서 정한다. 로비(6페이즈)는 응접실 저녁 고정으로 확정.

## 다음 할 일

1. 디자인 먼저(남은 것): v2.0 디자인 시스템(0046-7: 실내 따뜻한 등 허용, 광장은 차가운 흰빛, 진홍은 마피아 전용, 낮도 낮은 명도·채도)과 화면설계서(로비·채팅창·동작 목록·지목·변론·찬반·밤·아침·결과·시상식)를 캔버스로 만들어 승인받고 사본을 `design/v2.0/` 에 둔다.
2. 결정 0047 반영: 6페이즈 리서치의 캐릭터 부분(DOM 겹치기·2D 자리표시 72×96)과 UI-SPEC 의 캐릭터 크기·"항상 보임" 규칙을 3D 캐릭터 기준으로 고친다(리서치가 성능 결과용으로 잡은 결정 번호 0047 은 0049 로). 6페이즈 UI-SPEC 승인됨(`.planning/phases/06-world-skeleton/06-UI-SPEC.md`, v1.0 토큰 기준 임시 — 1번 승인 뒤 "임시 기준 경고" 표 항목을 다시 맞춘다). 리서치 완료(`06-RESEARCH.md`: 캐릭터 DOM 겹치기 권고, WR-01~04 는 v1.0 에서 이미 수정됨 → CONN-04 는 검증·회귀 테스트, 응접실 시안은 폰 예산 초과 가능성). 다음은 위 확인 대기 답을 받고 `/gsd-plan-phase 6`.
3. 시안 아티팩트: 배경 https://claude.ai/artifact/LztT25LDkxJcfnRjiaPTfE · 3D 에셋 https://claude.ai/artifact/MExvQNQTCwZdJ79XYSLPQk · 캐릭터 에셋 원본 https://claude.ai/artifact/NP1XfUrYTTqQ5nAB1HKYT5 (2D 캐릭터 시안 QPVNH7… 는 대체됨). v1.0 산출물 링크는 `CLAUDE.md`.
