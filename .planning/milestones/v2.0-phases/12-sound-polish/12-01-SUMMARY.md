---
phase: 12-sound-polish
plan: "01"
subsystem: cleanup
tags: [cleanup, dead-code, uat-scripts, css, deletion-table]
requires: []
provides:
  - ".planning/phases/12-sound-polish/12-CLEANUP-TABLE.md: M-1~M-6 삭제 표(23행, 집계 줄 포함)"
affects: [12-03, 12-04]
tech-stack:
  added: []
  patterns: ["삭제 표 먼저, 참조 0 인 것만 삭제, 시험은 skip 하지 않고 전용 단언만 삭제"]
key-files:
  created:
    - .planning/phases/12-sound-polish/12-CLEANUP-TABLE.md
  modified:
    - src/game/dayView.ts
    - src/game/verdict.ts
    - src/screens/RoomScreen.tsx
    - src/styles/night.css
    - scripts/deploy-target.test.mjs
    - scripts/smoke.mjs
    - docs/setup.md
    - test/unit/dayView.test.ts
    - test/unit/verdict.test.ts
    - test/unit/bots.test.ts
  deleted:
    - scripts/uat-vote.mjs
    - scripts/uat-night.mjs
    - scripts/uat-day.mjs
    - scripts/uat-test-bots.mjs
    - src/styles/day.css
key-decisions:
  - "손사래 사슬(leaderShift → useDayFx deny → GameMap → WorldStage → runtime.deny)은 순차 지목에서도 살아 있어 유지(결정 0067 문구와 다름)"
  - "uat-day·uat-test-bots 는 로컬 실행 실패라 계획 규칙대로 삭제, uat-test-room 만 유지"
requirements-completed: []
status: complete
duration: "약 60분(UAT 로컬 실행 대기 포함)"
completed: 2026-11-06
commits: 4
plan_head_before: 17bfba32e911af8d55e575809ae4ff14c54bf8a3
plan_head_after: 255b99c21f89f3bef53dfe2f3e58cb3e4ef78d61
actuals:
  tokens: 12000
  tasks: 3
  commits: 4
---

# Phase 12 Plan 01: 마무리 청소 Summary

삭제 표(M-1~M-6, 23행)를 먼저 만들고 참조 0 인 것만 지웠다: 옛 uat 스크립트 4개, 어디서도 import 하지 않던 day.css, night.css 의 죽은 v1.0 규칙, 제품이 읽지 않던 `DayEvents.state`·`PointsTally.sure/majority`·`VERDICT_TEXT`. 화면 행동은 바뀌지 않았다.

## 실행 내용

- **Task 1 (M-1)**: 표 작성. uat-vote·uat-night 삭제. 로컬 서버에서 uat-test-room 28/28 통과(유지), uat-test-bots 47/52 실패(지목 10초 가정), uat-day 18/19 실패(`phaseDurationMs === 15_000` 단언)라 계획 규칙대로 삭제. deploy-target.test.mjs 이름 목록(세 개)과 수집 최소값(5), smoke.mjs 주석, docs/setup.md 실행 예 정리. bots.test.ts 의 uat-test-bots 목록 대조 한 줄 삭제.
- **Task 2 (M-2)**: 손사래 사슬 전체를 따라가 판정. 순차 지목은 확정 때마다 `day.points` 줄이 늘고 `pointsTally().leader` 가 바뀌면 `leaderShift` 가 non-null, WorldStage 가 `runtime.deny` → `playEmote("deny")` 까지 재생한다(nominationScreen.test.tsx 「손사래」 3건이 확인) — 유지. 제품이 읽지 않던 잎만 삭제: `DayEvents.state`/`DayState`/`stateOf`, `PointsTally.sure`/`majority`, 그것만 검사하던 단언.
- **Task 3 (M-3)**: day.css 는 import 0 이라 파일째 삭제(배포 CSS 에서도 한 번도 번들되지 않음을 확인). night.css 의 `.mf-dayscene`·`.mf-sceneintro*`·`.mf-morningcard*` 삭제. `VERDICT_TEXT`(두 키뿐) 삭제. `MorningView.phrase`·`MORNING_PHRASE_COUNT`·gallery.mjs v1.0 주소는 이미 없음.

## 검증

- `npx tsc -p tsconfig.app.json`·`tsconfig.worker.json` 오류 없음, `npm run tokens:check` 통과, `npm run build` 통과(배포 CSS 에 삭제한 클래스 0).
- `node --test scripts/*.test.mjs scripts/e2e/lib.test.mjs` 321 통과.
- 전체 `npx vitest run`: 6620 통과 · 1 실패 · 1 skip. 실패는 알려진 간헐 항목인 worker `testTools` 「ended 에서 testReset」(12-03 담당, 그 당시 helpers.ts 는 12-03 이 디버그 로그를 넣는 중이었다). 그 파일만 다시 돌리면 36/36 통과. skip 은 이 계획 이전부터 있던 1건이다.
- `git diff 17bfba32..HEAD -- test/unit/leak.test.ts test/worker/leak.test.ts` 비어 있음.

## Deviations from Plan

### Auto-fixed / 계획 밖 변경

**1. [Rule 3 - Blocking] test/unit/bots.test.ts 수정**
- **Found during:** Task 1 (uat-test-bots 삭제)
- **Issue:** 이 시험이 uat-test-bots.mjs 의 BOT_NAMES 리터럴을 읽어 대조해서 삭제하면 깨진다.
- **Fix:** 그 대조 한 줄과 제목 문구만 지웠다(`bots.mjs` 의 NAMES 대조는 그대로). skip 아님.
- **Commit:** 10ce4ef0

**2. [범위 판단] night.css `.mf-morningcard*` 추가 삭제**
- 계획 목록에 없지만 `.mf-dayscene`(기준 상자)와 함께 죽은 규칙이고 참조 0 이라 표에 행(M-3c)을 더해 삭제. 계획의 「등 죽은 규칙」 범위로 해석했다.

**3. [범위 판단] uat-day 삭제**
- 계획 Task 1 은 「실패하면 삭제」라 따랐다. 실패 원인은 단언 1건(지목 15초)이고 나머지 18건은 통과했다. 되살리려면 git 이력에서 꺼내 그 단언 하나만 순차 지목 기준으로 고치면 된다(사용자 결정 거리로 남긴다).

**4. [병렬 실행 부작용] 삭제 일부가 12-07 커밋에 들어감**
- 공유 작업 트리의 index 에 `git rm` 이 스테이지된 채로 12-07 이 커밋해서 uat-vote·uat-night·uat-test-bots 삭제는 `c4120dc0`, uat-day·day.css 삭제와 RoomScreen 의 VERDICT_TEXT import 제거는 `5e810893` 에 들어갔다. 내용은 맞고 이력 귀속만 다르다(고치지 않음, 공유 이력 재작성 금지). 이후 내 커밋은 경로 지정 커밋으로 만들었다.

**Total deviations:** 위 4건. 행동 변화 없음.

## Known Stubs

없음.

## Threat Flags

없음(삭제만, 새 네트워크·권한 표면 없음). 개발 서버는 직접 띄운 PID 만 종료했다.

## Self-Check: PASSED

- 표 `12-CLEANUP-TABLE.md` 존재, `grep -c "^| M-"` = 23.
- `git grep -q -e uat-vote -e uat-night -- scripts docs/setup.md` 종료 코드 1.
- 삭제 파일 5개(`scripts/uat-vote.mjs`·`uat-night.mjs`·`uat-day.mjs`·`uat-test-bots.mjs`, `src/styles/day.css`) 모두 트리에 없음.
- 커밋 존재: f5b2763b·10ce4ef0·4e452677·255b99c2.

## 이월 메모

- 12-03(M-4): 전체 vitest 에서 testTools 「ended 에서 testReset」이 한 번 실패했고 단독 재실행은 36/36 통과(`skipOnce` 가 RATE_LIMITED 로 10초 대기). M-5 `npm audit` 는 HANDOFF 기준 6건 — 표 M-4/M-5 행은 「위임」 상태.
- 12-04(M-6): 07-REVIEW(WR-01 192행·WR-02 218행·WR-03 231행)와 08-REVIEW Info 가 표 M-6 행에 위임돼 있다. 이 계획은 건드리지 않았다.
- 손사래: 결정 0067 은 leaderShift 가 지목에서 안 쓰인다고 적었지만 코드는 순차 지목마다 손사래를 재생한다. 없앨지는 사용자 결정. 12-12(HANDOFF 정리)가 0067 문구를 바로잡을지 판단.
- 11페이즈가 이미 지운 것: `MorningView.phrase`, `MORNING_PHRASE_COUNT`, gallery.mjs v1.0 주소(표 「이미 없음」).
- HANDOFF.md 25~26행의 정리 후보 목록은 이제 낡았다(uat-vote·uat-night·uat-day·uat-test-bots 삭제, VERDICT_TEXT·day.css 삭제 완료). 최종 계획이 바꿔치기로 정리.
- 남은 uat 스크립트는 `scripts/uat-test-room.mjs` 하나(로컬 28/28). 낡았을 수 있는 `.planning` 과거 문서의 스크립트 이름 언급은 이력이라 그대로 뒀다.
- 범위 밖 후보: night.css 에 `.mf-game__note*` 는 GamePanel 이 쓰므로 살아 있음. 다른 죽은 CSS 후보는 찾지 않았다(day.css·night.css 한정).
