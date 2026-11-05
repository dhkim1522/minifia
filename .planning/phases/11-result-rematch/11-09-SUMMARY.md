---
phase: 11-result-rematch
plan: "09"
subsystem: src/game + src/components/v2 + src/screens + scripts/e2e
tags: [award-ceremony, award-plate, float-skip, clock-pause, tdd, e2e]
requires: [11-02, 11-05, 11-07]
provides: [AwardPlate, awardText(칭호 12개 문구 한 곳), ceremonyAt·skipAward·ceremonySnap·CEREMONY, 떠 있는 [넘기기](FloatAction skip + 진행 숫자), V2Icon trophy, 훅 awards·shown, result-awards E2E, awardChecks]
affects: [11-11, 11-12]
tech-stack:
  added: []
  patterns: [시상식 시계를 11-07 의 표시각 타이머·확장 정지 위에 그대로 올린다(markTimes 에 창 마크 추가), 창이 바뀔 때만 snap 한 번(수상자 걷기·앞사람 복귀), 건너뛰기는 새 마크로 schedule 을 다시 건다]
key-files:
  created:
    - src/components/v2/AwardPlate.tsx
    - src/game/awardText.ts
    - test/unit/awardText.test.ts
    - test/client/awardPlate.test.tsx
  modified:
    - src/game/resultDirector.ts
    - src/screens/ResultScreen.tsx
    - src/components/v2/FloatAction.tsx
    - src/components/v2/V2Icon.tsx
    - src/world/testHooks.ts
    - src/styles/result.css
    - src/styles/v2.css
    - scripts/e2e/result.mjs
    - scripts/e2e/result.test.mjs
    - scripts/e2e/flows.mjs
    - scripts/e2e/lib.test.mjs
    - test/unit/resultDirector.test.ts
    - test/unit/e2eContract.test.ts
    - test/client/resultScreen.test.tsx
    - test/client/icon.test.tsx
key-decisions:
  - "패 CSS(.mv-award*)는 v2.css 가 아니라 result.css 에 둔다 — v2.css 의 기존 정적 시험이 파일 전체에서 말줄임(ellipsis)과 놋쇠 토큰을 금지한다"
  - "모션 줄이기는 앞 연출(모임·뒤집기·조명)은 건너뛰어도 시상식은 패만 재생한다(arrival 이면 ceremonyOn, reveal 은 !reduced 일 때만)"
  - "시상식이 있었던 최종 상태의 RS4 는 '직업 의상이 걷힘'으로 본다(resultStageChecks afterCeremony) — 재접속 같은 시상식 없는 최종 상태는 직업 의상 그대로"
requirements-completed: [END-04]
status: complete
actuals:
  tokens: 20000
  tasks: 3
  commits: 6
plan_head_before: 9a5ae6e2e586d9b4781573024949adbec49f9ad5
plan_head_after: 3ffb454362aee89ae29f6c725eb4e0f9f165911e
duration: 약 30분
completed: 2026-11-05
---

# Phase 11 Plan 09: 시상식 (END-04) Summary

**5600 에 시작해 서버 칭호 순서대로 한 명씩 무대 가운데로 걸어 나와 놋쇠 패(칭호·이유·이름)를 받고 나머지가 박수치는 2.5초 연출 — 떠 있는 [넘기기] k / n, 확장 탭 일시정지, 끝난 뒤 고른 look 복귀, 모션 줄이기 패 페이드.**

## 한 일

- **Task 1 (tracer)**: `awardText`(이름·아이콘·이유·aria, 알 수 없는 id·k 없음 안전), `AwardPlate`(role=status, data-award-plate/id, 놋쇠 테두리, 마피아 칭호도 놋쇠), 디렉터 `ceremonyAt`·`CEREMONY`·`ceremonySnap`, ResultScreen 첫 창(헤더 '시상식'+trophy, 수상자 snap 걷기, pin turn, dim 해제, 900ms 패, 훅 awards/shown), V2Icon trophy.
- **Task 2**: 창 교대(앞사람 복귀·건너뛰면 순간 이동), 패가 뜨는 마크에서만 박수 큐(최대 4), `skipAward`(떠 있는 [넘기기]·패 탭, 같은 프레임 연타 안전), 확장 탭은 11-07 정지 위에서 멈춤, 끝나면 마지막 수상자 복귀 → +600 의상 걷힘, 모션 줄이기, 루트 `--mf-panel-h`.
- **Task 3**: `awardChecks` AW1~AW10 + 단위 시험(한 값씩 어긋나면 그 항목만 실패, 측정값 없음은 실패), `result-awards` 흐름 등록.

## 검증

- 단위·클라이언트: awardText 12표·경계, resultDirector(ceremonyAt n=4·8 경계, skipAward, ceremonySnap), awardPlate, resultScreen(교대·박수·연타·일시정지·진 팀 dim·의상 복귀·모션 줄이기·재접속), icon, e2eContract, worldStage 통과. `npm run typecheck` 오류 없음. `node --test scripts/e2e/result.test.mjs scripts/e2e/lib.test.mjs` 303 통과.
- E2E `--only result-awards --sizes 360x560,390x844` (로컬 dev, 포트 5231): result-awards 360x560 **13/13**, 390x844 **13/13** (AW1~AW10 + 연결·글꼴·G 공통). 같은 실행에서 result 흐름 25/25. 별도로 `--only result-reveal` 두 크기 22/22.

## Deviations from Plan

**1. [Rule 3 - 목록 밖 파일] `scripts/e2e/lib.test.mjs`** — extraSizes 흐름 목록을 못박은 시험이라 `result-awards` 추가로 실패해 목록에 더함(11-07 과 같은 일).

**2. [Rule 1 - 기존 흐름 보정] result·result-reveal 흐름** — final(5600)부터 시상식이 돌아 헤더가 '시상식'이고 직업 의상이 아직 입혀져 있어 기존 RS1·RS4·탭 기하 측정이 어긋난다. `finishCeremony(page)`(넘기기로 끝까지 + 의상 걷힘 대기)를 두 흐름에 더하고 `resultStageChecks` 에 `afterCeremony` 입력을 더했다(기본 동작 불변, 단위 시험 추가). 문턱은 낮추지 않았다. 제품 파일 변경 없음.

**3. [Rule 2 - 계획 해석] CSS 위치** — 계획은 v2.css 를 가리키지만 v2.css 의 기존 정적 시험(파일 전체 ellipsis 금지, 놋쇠 토큰 금지)과 충돌해 패 규칙을 result.css 로 뒀다. 이름 8자·칭호 7자 이내라 말줄임 없이 nowrap + overflow hidden.

**4. [시험 갱신] resultScreen.test.tsx** — 루트 속성 단언에 `style`(--mf-panel-h) 추가, 훅 동등 검사에 `awards: [], shown: -1` 추가.

## Known Stubs

없음.

## Threat Flags

없음 (새 네트워크·권한 표면 없음). T-11-31(닉네임·이유는 React 텍스트), T-11-32(awardText 가 k·at 만 읽음 — 소스에 result·seats·job 참조 없음을 시험이 고정), T-11-33(박수 최대 4, 한 창당 한 번만 큐) 이행.

## 이월 메모

- 시상식 시간표·상수는 `src/game/resultDirector.ts`: `CEREMONY{windowMs 2500, walkMs 900, plateAtMs 900, redressDelayMs 600}`·`CEREMONY_CENTER`·`ceremonyAt(t,awards,cast)`(award|done)·`skipAward(t,n)`·`ceremonySnap`·`ceremonyMarks`·`markTimes(n, awardN)`.
- ResultScreen 상태: `ceremonyOn`(마운트 때 arrival && awards>0)·`mark`(11-07 시계가 5600 이후도 이어감)·`instant`(건너뛰기 순간 이동 표식). 확장 탭이면 기존 pause 가 시상 시계도 멈춘다. 모션 줄이기는 mark 가 5600 에서 시작하고 걷기·박수 없음, 끝나면 즉시 look 복귀.
- 떠 있는 버튼: `FloatActions`(두 칸 자리, `single` 아님) 안에 위 칸 skip 하나. 아래 칸은 11-12 가 [꾸미기]를 같은 묶음 두 번째 자식으로 넣으면 된다(시상 후 skip 이 빠진 뒤 단독이면 `single` 판단은 11-12 몫). `FloatAction` 에 `count?`·kind `"skip"` 추가. 루트 `--mf-panel-h` 는 ResultScreen 이 매 렌더 잰다.
- `awardText`: `awardName·awardIcon·awardReason·awardAria·CEREMONY_TITLE`. `AwardPlate` props `{name,color,award,k?,at?,width?,onTap?}`(CSS `.mv-award*` 는 result.css).
- 훅 `window.__mfResult.awards`([seat, award][] 서버 그대로)·`shown`(패 index, 없으면 -1). 시상식 뒤 `costumes` 는 `{}`.
- result.mjs 새 export: `awardChecks·AWARD_PLATE·AWARD_CEREMONY_TITLE·readAwardState`, RESULT_MARKERS 에 `data-award-plate·data-award-id·data-float-count`. result·result-reveal 흐름은 `finishCeremony` 로 시상식을 넘긴 뒤 잰다 — 11-11·11-12 의 결과 화면 E2E 도 같은 호출이 필요하다.
- 기록 탭 내용 자리(`logSlot`)는 11-11. 다시 하기 알약은 11-12(시상식 중 알약 위치가 패·[넘기기]와 겹치지 않는지 확인).

## Self-Check: PASSED

- 파일 존재: AwardPlate.tsx · awardText.ts · awardText.test.ts · awardPlate.test.tsx · 11-09-SUMMARY.md 확인.
- 커밋 6개(9f1d3089, 541bcff1, 71be7ac5, de03502e, 9d76a26b, 3ffb4543) 존재, HEAD 의 조상.
- 병렬 실행기 영향: 같은 작업 트리에서 11-08(rematch 서버)·11-10(광장 3D)이 동시에 커밋했다. `commits: 6` 은 `git log --grep="(11-09)"` 로 센 값이고 `plan_head_before..HEAD` 범위에는 그 계획들의 커밋이 섞여 있다.
