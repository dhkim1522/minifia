# 작업 인계

> 두 PC·다음 세션이 이어 가는 데 필요한 최소 정보만 적는다. **해결된 항목은 지운다**(기록은 결정 기록·SUMMARY·git 에 있다). 6KB 이하(`test/unit/handoff.test.ts`). 환경 설정은 `docs/setup.md`.

## 지금 상태

- **v3.0 진행 중(브랜치 `v3`) — 13·14페이즈 완료**(13: 기본판 낮 흐름 결정 0072, 14: 사회자 자막 띠·빛남·도구 이름표·역할 목표·알림음 결정 0073(0051 보완), 서버·공유 diff 0, 배포 version `2026-11-07T00:00:12Z+d77e3dbf`). 남은 것: 15 낮 심부름·목격 기록·밤 흔적. 요구사항 22개·로드맵 13~15(`.planning/`), 범위·순서 결정 0071.
- **v2.0 완료 처리(2026-11-07)**: 태그 `v2.0`, 문서는 `.planning/milestones/v2.0-*`(페이즈 문서 `v2.0-phases/`). 열린 감사 항목 26개는 STATE.md 미룬 항목. main 은 v1.0 그대로, v3.0 실테스트 통과 뒤 반영.
- **캐릭터(결정 0047·0048)**: 원본 https://claude.ai/artifact/NP1XfUrYTTqQ5nAB1HKYT5 (사본 `design/v2.0/figure/`, 모듈 `design/v2.0/blockout/character.js`). `3d/mf3d.js` 는 옛 방식이라 안 쓴다.
- **맵(결정 0050)**: 재즈 바 + 시계탑 광장(`PLAYABLE_MAPS`). 블록아웃 https://claude.ai/artifact/1hzgEyAufgnDPVMvPvxdhP (사본 `design/v2.0/blockout/`).
- **브랜치**: 지금은 **`v3`**. `v2` 는 v2.0 그대로, `v1` 은 v1.0 배포본 수정 전용, `main` 은 배포된 v1.0. 다른 PC 는 `git fetch` 후 `git switch v3`.
- 배포: v3 https://minifia-v3.dhplay.workers.dev (Worker `minifia-v3`, 13페이즈에서 첫 배포, `scripts/deploy-target.mjs`), v2 https://minifia-v2.dhplay.workers.dev (비교용), v1.0 `https://minifia.dhplay.workers.dev`. `npm run deploy` 가 계정·배포 대상 가드를 거친다.
- 도구 메모: 버전은 `/api/health`. `npm run e2e` 는 인자가 없으면 배포본을 검사한다(로컬은 `npm run dev` 후 `-- --url http://localhost:5173 --only 흐름1,흐름2`). `backdrop-filter` 는 비접두 한 번만.
- 2026-11-02 원격 이력 재작성: 다른 PC 의 옛 clone 은 새로 clone.
- 커밋 제외: `design/backgrounds/indoor-draft/`, `Claude outputs/`, `.planning/milestone.lock`, `.planning/state.json`.

## 확인 대기 (사용자 답·확인이 필요한 것)

- **v3.0 결정은 끝났다(2026-11-07)**: 팀 모의 플레이 피드백과 세부 결정 16건이 `docs/playtest-v2.0-feedback.md` 에 있다. 다시 묻지 않는다. 새로 생기는 결정은 추천안으로 진행하고 기록한다. 시안은 캔버스 2~3개 + 추천안 바로 구현.
- **실테스트는 v3.0 을 다 만들고 배포한 뒤 한 번에**(v2.0 실기기 칸도 그때). 단계별 팀 테스트는 없다.
- 결정 0071~0073 과 위임 기본값 표 둘(13페이즈 U-1~U-9, 14페이즈 U-1~U-9: 각 `*-UI-SPEC.md` "기본값 기록")은 사용자가 돌아와 검토하고 한 줄씩 바꿀 수 있다.
- 레포 재생성은 하지 않는다(사용자 결정). 위생 grep 은 계속.
- **실기기·팀 확인은 v3.0 끝 실테스트에서 한 번에**(투표 이름표 손가락 누르기·선두·과반 연출 체감·8명 동시 가리키기 성능). 투표 15초 체감은 그때 `phases.ts` 한 줄로 조정.
- **알려진 한계**: `continuity` "옛 방장이 돌아오면" 단독 실행 5초 초과 간헐, 배포본 smoke 는 망 지연 간헐 실패, `perfbudget` B2 점광원 4>3·M1 geometries 35>25(13페이즈 전부터). 8자 이름 봇 8명판은 투표 이름표가 겹칠 수 있다(0072). 14페이즈(0073): 360×560 은 띠 때문에 위쪽이 비좁아 이름표·결과 맵 칩·시상 패가 겹치고, [유언]·[보내기] 간격이 16→8로 줄었다(실기기에서 확인), 마지막 5초 숫자는 crimson-300(UI-SPEC 와 다름), 스크린리더가 띠와 단계 읽기를 함께 읽을 수 있다.

## 다음 할 일

1. **15페이즈 낮 심부름·목격 기록·밤 흔적**: 먼저 캔버스 시안 2~3개(심부름 장소·목격 기록·밤 흔적 공개)를 만들고 추천안을 바로 구현한 뒤(사용자 선호), `/gsd-ui-phase 15` → 계획 → 실행 → 배포. 사회자 문구 표(`src/game/hostLine.ts`)에는 `errand`·`witness`·`trace` 예약 행 문구만 채우면 되고, 새 단추는 이름표 규칙(`data-tool-label`)과 빛남(`callTargetsOf`)을 따른다. E2E 는 바뀐 흐름만, 6종 회귀는 페이즈 끝에 한 번. 정통 판(장치 켜기)은 `RULESET` 값만 바꾸면 된다.
2. 15페이즈 뒤 v3.0 전체 배포 → 한 번에 실테스트(팀·실기기, v2.0 실기기 칸 `milestones/v2.0-phases/12-sound-polish/12-TEAM-TEST.md` 포함).
3. three `0.186.1` 고정, 성능 확인 폰은 iPhone 16 Pro + 크롬 CPU 4배 스로틀(결정 0055). 이력서용 포트폴리오는 v3.0 뒤(`docs/portfolio-request.md`).
