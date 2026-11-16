---
phase: 22-cleanup-single-mode
plan: "08"
subsystem: test-harness-and-scripts
tags: [cleanup, test-helpers, smoke, uat, single-mode]
requires: [22-07]
provides:
  - "시험 장치에 판 고정이 없다: test/helpers/playable.ts 는 openPlaza·onlyBar 만 남고 lockCause·openCause·lockCauseInFile·underCauseLock·lockModeMaps·openTown 정의와 호출이 test/ 에서 0건이다(SHIPPED_* 도 0건)."
  - "scripts/smoke.mjs·scripts/uat-test-room.mjs 에 --mode 인자와 판 종류별 분기가 없다. 단계 전이 표는 PHASE_NEXT 하나(smoke.mjs 가 export), PHASE_NEXT_BY_MODE·FIRST_DAY_PHASE 삭제."
  - "wrangler.jsonc 에 mode·errand·town·tutorial·extended 문자열 0건 확인."
affects: [22-09, 22-10, 22-11]
key-files:
  modified:
    - test/helpers/playable.ts
    - test/unit/lighting.test.ts
    - test/unit/dayView.test.ts
    - test/unit/e2eContract.test.ts
    - test/client/gameMap.test.tsx
    - test/client/hostRail.test.tsx
    - src/components/v2/V2Icon.tsx
    - scripts/smoke.mjs
    - scripts/smoke.test.mjs
    - scripts/uat-test-room.mjs
    - "test/unit·test/worker 시험 파일 약 45개(import 줄·lockCauseInFile() 호출·옛 주석만 삭제)"
decisions:
  - "호출부 정리는 scratchpad 의 작은 node 스크립트(괄호 짝 맞춤)로 했다. 저장소에 남기지 않았다. 실제 호출부는 계획의 추정(약 107)보다 적은 51개 파일 108줄이었고, 대부분 import 줄과 lockCauseInFile() 한 줄이었다."
  - "lockCauseInFile() 바로 위에 붙어 있던 '꺼진 옛 확장판 경로 … 원인 흐름을 잠근다(21-13, 갈래 B)' 주석 46줄을 함께 지웠다. 잠금이 없어졌으니 주석이 거짓이 된다."
  - "test/unit/lighting.test.ts 의 describe '원인 흐름이 잠긴 확장판은 옛 조명 그대로' 는 beforeAll/afterAll 잠금만 걷고 이름을 '밤 조명' 으로 바꿨다. 단언은 그대로다(잠금이 이미 no-op 이었다)."
  - "smoke.mjs 의 stageFull 은 판 종류별 두 갈래 중 첫날 사슬만 보던 extended 경로(기본값이었다)를 지우고 한 판 끝까지 도는 흐름 하나가 기본이다. 배포 확인 smoke full 이 이전보다 길어진다(이전 --mode basic 과 같다). 낮 순서·길이 기대는 22-09~22-11 이 바꾼다."
  - "uat-test-room.mjs 는 basic·extended 두 분기 중 skipTo 로 통일된 extended 분기(day.n=1 확인 포함)를 남기고 basic 분기를 지웠다. 두 분기는 22-06 이후 같은 순서를 단언했다."
  - "22-07 이월 항목 V2Icon deck·book·modeBasic·modeExtended 는 쓰는 곳이 없음을 grep 으로 확인하고 아이콘 표와 hostRail.test 의 NEW_ICONS 시험을 함께 지웠다(계획 파일 목록 밖이지만 이월 메모가 지시)."
metrics:
  tasks: 2
  duration: 약 40분
status: complete
actuals:
  tokens: 22000
  tasks: 2
  commits: 3
plan_head_before: a723f6125ae0a1f81d83ae3cdb4c7b0bfd0cb3e9
plan_head_after: 269bbc0a006d1b2f2a46c5ad1f4cb0611b0afc1e
commits: 3
---

# Phase 22 Plan 08: 시험 도우미 껍데기·smoke 기본 흐름 Summary

22-04·22-05 가 남긴 판 고정 시험 도우미 껍데기와 호출부를 걷고, smoke·UAT 스크립트를 판 종류 인자 없는 하나의 흐름으로 맞췄다(D-09). 이제 시험은 고정 없이 기본 판 하나로 돈다(worker setup 의 PLAYABLE_MAPS 를 bar 로 잠그는 한 줄만 남음).

## 커밋

| 커밋 | 내용 |
| ---- | ---- |
| 52617e12 | `test(22-08)` 판 고정 시험 도우미와 호출부 삭제 (52개 파일, +49 −161) |
| 0663c3dc | `chore(22-08)` smoke·UAT 기본 흐름 하나 (smoke.mjs·smoke.test.mjs·uat-test-room.mjs·e2eContract.test.ts) |
| 269bbc0a | `refactor(22-08)` 쓰는 곳 없는 V2Icon 아이콘 넷 삭제 (V2Icon.tsx·hostRail.test.tsx) |

## Task 1: 시험 도우미 껍데기와 호출부

- 기준값(HEAD 시작 시): `lockCause|openCause|underCauseLock|lockCauseInFile|lockModeMaps|openTown|SHIPPED_` 가 test/ 에서 51개 파일 108줄(playable.ts 정의 포함). 뒤: 0줄.
- 치환: `import … from "…/helpers/playable"` 에서 지운 이름 제거(남는 이름이 없으면 줄째), `lockCauseInFile();` 줄 삭제, `underCauseLock(() => {…})` 를 괄호 짝을 맞춰 `() => {…}` 로.
- 손으로 고친 파일: `test/unit/lighting.test.ts`(beforeAll/afterAll 잠금 구역, import 의 afterAll·beforeAll 정리), `test/client/gameMap.test.tsx`(import 만 있었음). 치환이 깨뜨린 시험 본문은 없었다.
- `test/helpers/playable.ts` 는 openPlaza·onlyBar 두 함수만 남음. `test/unit/setup.ts`·`test/worker/setup.ts` 는 이미 계획이 요구한 모양(unit 은 빈 export 와 사용 안내 주석, worker 는 PLAYABLE_MAPS 를 bar 로 잠그는 한 줄과 이유 주석)이라 고치지 않았다.

## Task 2: smoke·UAT 기본 흐름

- `scripts/smoke.mjs`: `--mode` 인자·usage 문구·`MODE`·확장판 첫날 사슬 분기(약 50줄)·`PHASE_NEXT_BASIC/EXTENDED/BY_MODE`·`FIRST_DAY_PHASE`·미사용이 된 `inDayN` 삭제. 전이 표는 `export const PHASE_NEXT`.
- `scripts/uat-test-room.mjs`: `--mode` 인자·`PHASE_NEXT_BY_MODE`·`MODE` 검증·basic 분기 삭제, `PHASE_NEXT` 하나.
- `scripts/smoke.test.mjs`: 판 종류별 표 시험 넷을 단일 표 시험 둘로 줄임.
- `test/unit/e2eContract.test.ts`: 위 단일 표를 `nextPhaseOf` 와 대조하도록 맞춤(이전 판 종류 루프 제거).
- wrangler.jsonc 확인: `grep -nE "mode|errand|town|tutorial|extended" wrangler.jsonc` 결과 0건(exit 1) — 판 종류·확장판 문자열 없음. 배포 설정은 고치지 않았다.
- `git grep -nE '"basic"|"extended"|GameMode|modePick' -- scripts` → 0건.

## 검증 결과

| 명령 | 결과 |
| ---- | ---- |
| `npx vitest run`(전체, Task 1 뒤) | 244 files passed / 6 skipped, 7289 passed / 261 skipped |
| `npx vitest run`(전체, 마지막) | 244 files passed / 6 skipped, 7285 passed / 261 skipped (4건 감소 = NEW_ICONS 시험 4개 삭제) |
| `node --test scripts/*.test.mjs scripts/e2e/*.test.mjs` | 612 pass / 0 fail |
| `npm run typecheck` | exit 0 |
| acceptance: 도우미 grep(test) | 0 |
| acceptance: `export function (openPlaza\|onlyBar)` in playable.ts | 2 |
| acceptance: `"basic"\|"extended"\|GameMode\|modePick` in scripts | 0 |
| 비공개 위생 grep(`torder\|티오더\|조직\|회사\|~/project`) 변경 파일 | 0건 |

worker 프로젝트 부하 flake 는 이번 전체 두 번 모두 나타나지 않았다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - 블로킹] test/unit/e2eContract.test.ts 가 PHASE_NEXT_BY_MODE 를 가져다 씀**
- **Found during:** Task 2 (git grep 으로 소비처 조사)
- **Issue:** smoke.mjs 의 표를 하나로 합치면 e2eContract.test.ts 의 판 종류 루프가 깨진다. 계획의 files 목록에는 없었다.
- **Fix:** 단일 표(`PHASE_NEXT`)로 대조하도록 시험을 고쳤다(단언 내용은 같다).
- **Files modified:** test/unit/e2eContract.test.ts
- **Commit:** 0663c3dc

**2. [Rule 1 - 거짓이 된 주석] lockCauseInFile 위 주석·lighting describe 이름**
- **Issue:** 잠금이 없어진 뒤 '원인 흐름을 잠근다(21-13, 갈래 B)' 주석 46줄과 lighting 구역 이름이 사실과 달라졌다.
- **Fix:** 주석 삭제, describe 이름을 '밤 조명' 으로.
- **Commit:** 52617e12

**3. [이월 처리] V2Icon deck·book·modeBasic·modeExtended 삭제**
- 22-07 이월 메모 지시. 소비처 0건 확인 후 V2Icon.tsx 와 hostRail.test.tsx(NEW_ICONS, 미사용이 된 shapesOf·V2Icon import 포함)를 함께 정리. 계획 files 목록 밖이다.
- **Commit:** 269bbc0a

### 커밋 분할
계획은 Task 1 커밋·Task 2 커밋 둘이었고 그대로 했다. 이월 아이콘 정리가 세 번째 커밋이다. 첫 커밋 시점에 plan_head_before 원장(`gsd-plan-head-before-22-08`)을 만들지 못해 시작 HEAD(a723f612)를 직접 기록했다. `git rev-list --count a723f612..HEAD` = 3.

## Known Stubs

없음. (스크립트·시험 정리만 했다.)

## 남긴 것·다음 계획에 넘길 것

- smoke.mjs 의 단계 기대값과 DEFENSE_MS·EXECUTION_MS 사본은 계획대로 건드리지 않았다(22-10·22-11).
- smoke full 단계의 기본 흐름이 한 판 끝까지가 되어 이전 기본(첫날 사슬)보다 오래 걸린다. 배포 뒤 smoke 를 돌릴 때 TOTAL_LIMIT 은 full 단계에 적용되지 않음을 확인하지 못했다(실배포 smoke 는 이번에 돌리지 않았다 — 배포는 24 끝).
- smoke·UAT 스크립트를 실서버·로컬 서버에 실제로 돌려 보지 않았다(문법 `node --check` 와 단위 시험만). 실행 확인은 배포 단계로 넘긴다.

## Threat Flags

없음. T-22-14(시험이 제품 규칙을 바꾸는 길)는 시험 쪽 잔재 삭제로 완료. 새 네트워크·인증·파일 접근 표면은 없다.

## Self-Check: PASSED

- 커밋 존재: 52617e12, 0663c3dc, 269bbc0a 모두 HEAD 의 조상.
- 수정 파일 존재: test/helpers/playable.ts, scripts/smoke.mjs, scripts/uat-test-room.mjs, scripts/smoke.test.mjs.
- STATE.md·ROADMAP.md 는 건드리지 않았다.
