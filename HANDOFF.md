# 작업 인계

> 두 PC·다음 세션이 이어 가는 데 필요한 최소 정보만 적는다. **해결된 항목은 지운다**(기록은 결정 기록·SUMMARY·git 에 있다). 6KB 이하(`test/unit/handoff.test.ts`). 환경 설정은 `docs/setup.md`.

## 지금 상태

- **v3.0 "사회자와 증거" 진행 중(브랜치 `v3`)**: 요구사항 22개·로드맵 13~15페이즈(`.planning/`), 범위·순서 결정 0071. 13 기본판 낮 흐름 → 14 사회자 진행·도구 이름표 → 15 낮 심부름·목격 기록·밤 흔적.
- **v2.0 완료 처리(2026-11-07)**: 태그 `v2.0`, 문서는 `.planning/milestones/v2.0-*`(페이즈 문서 `v2.0-phases/`). 열린 감사 항목 26개는 STATE.md 미룬 항목. main 은 v1.0 그대로, v3.0 실테스트 통과 뒤 반영.
- **캐릭터(결정 0047·0048)**: 원본 https://claude.ai/artifact/NP1XfUrYTTqQ5nAB1HKYT5 (사본 `design/v2.0/figure/`, 모듈 `design/v2.0/blockout/character.js`). `3d/mf3d.js` 는 옛 방식이라 안 쓴다.
- **맵(결정 0050)**: 재즈 바 + 시계탑 광장(`PLAYABLE_MAPS`). 블록아웃 https://claude.ai/artifact/1hzgEyAufgnDPVMvPvxdhP (사본 `design/v2.0/blockout/`).
- **브랜치**: 지금은 **`v3`**. `v2` 는 v2.0 그대로, `v1` 은 v1.0 배포본 수정 전용, `main` 은 배포된 v1.0. 다른 PC 는 `git fetch` 후 `git switch v3`.
- 배포: v3 https://minifia-v3.dhplay.workers.dev (Worker `minifia-v3`, `scripts/deploy-target.mjs`), v2 https://minifia-v2.dhplay.workers.dev (비교용), v1.0 `https://minifia.dhplay.workers.dev`. `npm run deploy` 가 계정·배포 대상 가드를 거친다.
- 도구 메모: 버전은 `/api/health`. `npm run e2e` 는 인자가 없으면 배포본을 검사한다(로컬은 `npm run dev` 후 `-- --url http://localhost:5173 --only 흐름1,흐름2`). `backdrop-filter` 는 비접두 한 번만.
- 2026-11-02 원격 이력 재작성: 다른 PC 의 옛 clone 은 새로 clone.
- 커밋 제외: `design/backgrounds/indoor-draft/`, `Claude outputs/`, `.planning/milestone.lock`, `.planning/state.json`.

## 확인 대기 (사용자 답·확인이 필요한 것)

- **v3.0 결정은 끝났다(2026-11-07)**: 팀 모의 플레이 피드백과 세부 결정 16건이 `docs/playtest-v2.0-feedback.md` 에 있다. 다시 묻지 않는다. 새로 생기는 결정은 추천안으로 진행하고 기록한다. 시안은 캔버스 2~3개 + 추천안 바로 구현.
- **실테스트는 v3.0 을 다 만들고 배포한 뒤 한 번에**(v2.0 실기기 칸도 그때). 단계별 팀 테스트는 없다.
- 레포 재생성은 하지 않는다(사용자 결정). 위생 grep 은 계속.
- **알려진 한계**: `continuity` "옛 방장이 돌아오면" 테스트가 단독 실행 때 절반쯤 5초 초과(후속). 배포본 smoke 는 망 지연으로 간헐 실패(5인 full 1회 통과, 8인·배포 E2E 재실행 필요). `perfbudget` B2 점광원 4>3(기존).

## 다음 할 일

1. 13페이즈부터 차례로: UI-SPEC(`/gsd-ui-phase`) → 계획 → 실행. E2E 는 바뀐 흐름만, 6종 회귀는 페이즈 끝에 한 번. 페이즈마다 `minifia-v3` 배포.
2. 15페이즈 뒤 v3.0 전체 배포 → 한 번에 실테스트(v2.0 실기기 칸 `milestones/v2.0-phases/12-sound-polish/12-TEAM-TEST.md` 포함).
3. three `0.186.1` 고정, 성능 확인 폰은 iPhone 16 Pro + 크롬 CPU 4배 스로틀(결정 0055). 이력서용 포트폴리오는 v3.0 뒤(`docs/portfolio-request.md`).
