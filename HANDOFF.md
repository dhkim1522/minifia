# 작업 인계

> 두 PC·다음 세션이 이어 가는 데 필요한 최소 정보만 적는다. **해결된 항목은 지운다**(기록은 결정 기록·SUMMARY·git 에 있다). 6KB 이하(`test/unit/handoff.test.ts`). 환경 설정은 `docs/setup.md`.

## 지금 상태

- **v2.0 "같은 공간" 시작(2026-10-30~31)**: 팀 피드백 → 범위(결정 0044) → 리서치(`.planning/research/`) → 요구사항 45개 → 로드맵 6~12페이즈 승인. 맵 이동·자유 채팅·동작 캐릭터, 처형은 지목→변론→찬반, 밤은 마피아만 이동·시민 어둠. 역할·승패 규칙은 그대로.
- **캐릭터(결정 0047·0048)**: 1번 시안의 구·원통 조립 3D 인물. 원본 https://claude.ai/artifact/NP1XfUrYTTqQ5nAB1HKYT5 (사본 `design/v2.0/figure/`, 최신 모듈 `design/v2.0/blockout/character.js`). 의상 9종, 모자는 머리를 덮는다. `design/v2.0/3d/mf3d.js` 의 캐릭터는 0048 이전 방식이라 쓰지 않는다.
- **맵(결정 0050)**: 캐릭터 비율로 새로 짓는다. v2.0 은 ① 지하 재즈 바(6~9페이즈 기준 맵) + ③ 시계탑 광장, 방장이 로비에서 고르고 기본 랜덤(MAP-06, 11페이즈). ②법정 ④만찬 ⑤룰렛은 나중 업데이트. 모이는 장치(서는 자리 8·가운데 변론 무대·단계별 조명)는 공통 부품. 블록아웃 캔버스 https://claude.ai/artifact/1hzgEyAufgnDPVMvPvxdhP (사본 `design/v2.0/blockout/`: 엔진 `blockout.js` + 맵별 파일). 기존 응접실·광장(0046, `design/v2.0/3d/`·`backgrounds/`)은 대체됨.
- **지목 표시(결정 0049)**: 손가락 지목 + 머리 위 숫자 배지, 순간 알림은 화면 위 한 줄, 기록은 채팅 시스템 메시지, 선두(배지 맥박·빛 모임)·과반("유력" 도장·조명 낮춤·카메라 다가감) 연출. 맵에 투표 장치·바닥 선 없음.
- **브랜치**: 작업은 **`v2`** 브랜치. `v1` 은 v1.0 배포본 수정 전용, `main` 은 배포된 버전(지금 v1.0), 태그 `v1.0`. 다른 PC 에서는 `git fetch` 후 `git switch v2`.
- 배포: v1.0 `https://minifia.dhplay.workers.dev` 는 그대로 둔다. v2.0 은 Worker `minifia-v2`(결정 0044-24). **`wrangler.jsonc` 이름과 E2E/smoke 기본 주소가 아직 v1.0 이라 그대로 배포하면 v1.0 을 덮어쓴다** — 6페이즈 첫 작업에서 바꾸고 가드를 둔다.
- 도구 메모: 버전은 `/api/health`. `npm run e2e` 는 인자가 없으면 배포본을 검사한다(로컬은 `npm run dev` 후 `-- --url http://localhost:5173`). CSS `backdrop-filter` 는 비접두 한 번만(`verdictCss.test.ts`).
- 커밋 제외: `design/backgrounds/indoor-draft/`, `Claude outputs/`, `.planning/milestone.lock`, `.planning/state.json`.

## 확인 대기 (사용자 답·확인이 필요한 것)

- 6페이즈 계획 전 답: three `0.186.1`(권고) vs `0.187.0`, 실기기 목록(저가 Android·구형 iPhone)과 `adb` 유무.
- 로비를 어느 맵에서 열지(랜덤일 때 포함) — 로비 UI 단계에서 정한다.

- **화면설계서 묶음 A 검토(사용자)**: https://claude.ai/artifact/H3gEwciexb83CxEXK76YXs — 9화면(로비 방장/일반·역할·토론·지목·변론 2·찬반·처형), 결정 0051(글 최소·직접 조작) 반영: 채팅 옆 감정표현 9종, 꾸미기 창(방장 맵·의상 탭, 일반 의상만, 맵 그림 카드), v1.0 직업 카드, 시간 링, 점 진행, 짧은 채팅 기록. 디자인 시스템도 같이 고침(Icon·DotProgress·DressSheet·RoleCard·VerdictPicker 추가, MapPicker·EmoteSheet 대체). 함께 정할 것: 찬반은 수만 공개, 처형 때 역할 비공개, 변론자도 찬반 투표. 다음은 묶음 B(밤·아침·유언·유령), C(결과·시상식·다시 하기).

## 다음 할 일

1. 디자인 먼저(남은 것): v2.0 디자인 시스템은 승인됨(https://claude.ai/artifact/L4eeQTUD9rCa9Vmzv6fKpU, 사본 `design/v2.0/design-system/`, 앰버 대신 놋쇠·이름표 14px·채팅 16px). 남은 것은 화면설계서(로비·맵 선택·채팅창·동작 목록·지목·변론·찬반·밤·아침·결과·시상식)를 캔버스로 만들어 승인받고 사본을 `design/v2.0/` 에 둔다.
2. 결정 0047·0048·0050 반영: 6페이즈 리서치의 캐릭터 부분(DOM 겹치기·2D 자리표시 72×96)과 UI-SPEC 의 캐릭터 크기·"항상 보임" 규칙·응접실 기준을 3D 캐릭터·재즈 바 기준으로 고친다. 리서치가 성능 결과용으로 잡은 결정 번호 0047 은 쓰지 않고, 기록할 때의 다음 번호로. 6페이즈 UI-SPEC 승인됨(`.planning/phases/06-world-skeleton/06-UI-SPEC.md`, v1.0 토큰 기준 임시 — 1번 승인 뒤 "임시 기준 경고" 표 항목을 다시 맞춘다). 리서치 완료(`06-RESEARCH.md`: WR-01~04 는 v1.0 에서 이미 수정됨 → CONN-04 는 검증·회귀 테스트). 블록아웃은 그리기 300~550번이라 정식 맵은 합치기로 줄인다. 다음은 위 확인 대기 답을 받고 `/gsd-plan-phase 6`.
3. v1.0 산출물 링크는 `CLAUDE.md`.
