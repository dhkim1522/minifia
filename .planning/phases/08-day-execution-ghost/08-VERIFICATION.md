---
phase: 08-day-execution-ghost
verified: 2026-11-03T09:45:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - .planning/phases/08-day-execution-ghost/08-01-PLAN.md
  - .planning/phases/08-day-execution-ghost/08-01-SUMMARY.md
  - .planning/phases/08-day-execution-ghost/08-02-PLAN.md
  - .planning/phases/08-day-execution-ghost/08-02-SUMMARY.md
  - .planning/phases/08-day-execution-ghost/08-03-PLAN.md
  - .planning/phases/08-day-execution-ghost/08-03-SUMMARY.md
  - .planning/phases/08-day-execution-ghost/08-04-PLAN.md
  - .planning/phases/08-day-execution-ghost/08-04-SUMMARY.md
  - .planning/phases/08-day-execution-ghost/08-05-PLAN.md
  - .planning/phases/08-day-execution-ghost/08-05-SUMMARY.md
  - .planning/phases/08-day-execution-ghost/08-06-PLAN.md
  - .planning/phases/08-day-execution-ghost/08-06-SUMMARY.md
  - .planning/phases/08-day-execution-ghost/08-07-PLAN.md
  - .planning/phases/08-day-execution-ghost/08-07-SUMMARY.md
  - .planning/phases/08-day-execution-ghost/08-08-PLAN.md
  - .planning/phases/08-day-execution-ghost/08-08-SUMMARY.md
  - .planning/phases/08-day-execution-ghost/08-09-PLAN.md
  - .planning/phases/08-day-execution-ghost/08-09-SUMMARY.md
  - .planning/phases/08-day-execution-ghost/08-10-PLAN.md
  - .planning/phases/08-day-execution-ghost/08-10-SUMMARY.md
  - .planning/phases/08-day-execution-ghost/08-11-PLAN.md
  - .planning/phases/08-day-execution-ghost/08-11-SUMMARY.md
  - .planning/phases/08-day-execution-ghost/08-12-PLAN.md
  - .planning/phases/08-day-execution-ghost/08-12-SUMMARY.md
  - .planning/phases/08-day-execution-ghost/08-13-PLAN.md
  - .planning/phases/08-day-execution-ghost/08-13-SUMMARY.md
  - .planning/phases/08-day-execution-ghost/08-14-PLAN.md
  - .planning/phases/08-day-execution-ghost/08-14-SUMMARY.md
  - .planning/phases/08-day-execution-ghost/08-15-PLAN.md
  - .planning/phases/08-day-execution-ghost/08-15-SUMMARY.md
  - .planning/phases/08-day-execution-ghost/08-16-PLAN.md
  - .planning/phases/08-day-execution-ghost/08-16-SUMMARY.md
  - .planning/phases/08-day-execution-ghost/08-17-PLAN.md
  - .planning/phases/08-day-execution-ghost/08-17-SUMMARY.md
  - .planning/phases/08-day-execution-ghost/08-18-PLAN.md
  - .planning/phases/08-day-execution-ghost/08-18-SUMMARY.md
  - .planning/phases/08-day-execution-ghost/08-19-PLAN.md
  - .planning/phases/08-day-execution-ghost/08-19-SUMMARY.md
  - .planning/phases/08-day-execution-ghost/08-20-PLAN.md
  - .planning/phases/08-day-execution-ghost/08-20-SUMMARY.md
  - .planning/phases/08-day-execution-ghost/08-21-PLAN.md
  - .planning/phases/08-day-execution-ghost/08-21-SUMMARY.md
  - .planning/phases/08-day-execution-ghost/08-22-PLAN.md
  - .planning/phases/08-day-execution-ghost/08-22-SUMMARY.md
  - .planning/phases/08-day-execution-ghost/08-23-PLAN.md
  - .planning/phases/08-day-execution-ghost/08-23-SUMMARY.md
  - .planning/phases/08-day-execution-ghost/08-24-PLAN.md
  - .planning/phases/08-day-execution-ghost/08-24-SUMMARY.md
  - .planning/phases/08-day-execution-ghost/08-25-PLAN.md
  - .planning/phases/08-day-execution-ghost/08-25-SUMMARY.md
  - .planning/phases/08-day-execution-ghost/08-26-PLAN.md
  - .planning/phases/08-day-execution-ghost/08-26-SUMMARY.md
  - .planning/phases/08-day-execution-ghost/08-27-PLAN.md
  - .planning/phases/08-day-execution-ghost/08-27-SUMMARY.md
  - .planning/phases/08-day-execution-ghost/08-28-PLAN.md
  - .planning/phases/08-day-execution-ghost/08-28-SUMMARY.md
  - scripts/e2e/run.mjs
  - shared/game/audience.ts
  - shared/game/discussion.ts
  - shared/game/execution.ts
  - shared/game/gather.ts
  - shared/game/movement.ts
  - shared/game/nomination.ts
  - shared/game/phases.ts
  - shared/game/tick.ts
  - shared/game/verdict.ts
  - shared/game/view.ts
  - src/components/WorldStage.tsx
  - src/game/dayView.ts
  - src/game/verdict.ts
  - src/screens/GameMap.tsx
  - src/screens/GamePanel.tsx
  - src/screens/RoomScreen.tsx
  - src/world/presence.ts
  - worker/room.ts
covered_digest: "v3:sha256:e1d15ab45d93bee64382db1959f75e78d62c484970f8c6a3fe28643740b5ca4f"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 5/5
  gaps_closed:
    - "CR-01 찬반 부결인데 처형 단계 화면 읽기가 '○○ 님 처형' 을 알림 (7d52664)"
    - "WR-01 지목 동률·0표 날 결과 요약이 '처형 없음 (찬성 0 · 반대 0)' 으로 나옴 (d5282cc)"
    - "WR-02 게임 중 방장 화면의 동작 없는 '내보내기' 버튼 (3b479ca)"
    - "WR-03 E2E 실행기가 재시도 때 먼저 기록된 검사 실패를 버림 (afdce12)"
  gaps_remaining: []
  regressions: []
deferred:
  - truth: "낮 흐름 5분 성능·열감 (iPhone 16 Pro 평균 55fps 이상, 끊김 5회 이하, 열감 미지근 이하)"
    addressed_in: "Phase 999.5 (백로그)"
    evidence: "ROADMAP 999.5 '모든 개발 뒤 한꺼번에 처리한다. 8페이즈 완료를 막지 않는다' (사용자 결정 2026-11-02·2026-11-03). 08-UAT.md test 1 skipped(deferred)"
  - truth: "단계 조명·손가락 지목·변론자 시선·유령 떠오름의 읽힘 (눈 확인)"
    addressed_in: "Phase 999.5 (백로그)"
    evidence: "ROADMAP 999.5 두 번째·네 번째 항목. 08-UAT.md test 2 skipped(deferred)"
  - truth: "유령 이름표(불투명도 0.6) 글자 대비를 실기기에서 판독"
    addressed_in: "Phase 999.5 (백로그)"
    evidence: "ROADMAP 999.5 두 번째 항목. 08-UAT.md test 3 skipped(deferred)"
  - truth: "스크린 리더로 부결 판 처형 단계 안내를 실제로 들어 확인"
    addressed_in: "Phase 999.5 (백로그)"
    evidence: "코드·자동 시험으로는 검증 완료(아래 진실 3). 실기기 청취만 08-UAT.md test 4 evidence 에서 999.5 묶음으로 이월"
---

# Phase 8: 낮 처형과 유령 Verification Report

**Phase Goal:** 낮 토론이 맵 위에서 열리고 지목 → 변론 → 찬반 → 처형이 정통 순서로 돌며, 처형된 사람은 유령이 되어 끝까지 지켜본다
**Verified:** 2026-11-03
**Status:** passed
**Re-verification:** Yes — 코드 리뷰 수정(CR-01, WR-01~03) 뒤 오래된 보고서를 다시 만든 재검증

## 요약

로드맵 성공 기준 다섯 개가 모두 VERIFIED 다. 이전 보고서(`e5aba06` 시점)가 다룬 서버 규칙·방송 규율·이동 차단·유령 누설 차단·v1.0 흐름 제거는 `shared/`·`worker/` 가 그 뒤로 한 줄도 바뀌지 않았음을 `git diff e5aba06 HEAD -- shared worker` 로 확인했다(변경은 클라이언트 5개 파일과 시험 5개뿐). 따라서 이전 판정은 그대로 유효하다. 이번 재검증은 코드 리뷰 수정이 건드린 곳을 3단계(존재·실체·연결)로 다시 확인했다. 이전에 열려 있던 경고 4건은 모두 닫혔고 새 회귀는 없다.

이전 보고서의 `human_needed` 는 실기기·눈 확인 항목 때문이었다. 이 항목들은 사용자 결정(2026-11-02·2026-11-03)으로 "모든 개발 뒤 한꺼번에" 확인하기로 했고, ROADMAP 백로그 999.5 가 "8페이즈 완료를 막지 않는다" 고 명시한다. `08-UAT.md` 는 `status: complete`(통과 1, 이월 3)다. 그래서 이 항목들은 사람 확인 대기가 아니라 `deferred` 로 분류했고 상태를 `passed` 로 올렸다.

## Goal Achievement

### Observable Truths (ROADMAP 성공 기준 = 계약)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 낮 토론이 맵 위에서 열려 자유롭게 움직이며 채팅하고, 산 사람 과반이 "토론 끝내기" 를 누르면 바로 지목으로 넘어간다 (DAY-03, MAP-04) | ✓ VERIFIED | `shared/game/discussion.ts`(`toggleEnd`/`endReached`)와 `worker/room.ts` `applyEndDiscussion` 이 이전 검증 이후 무변경. `test/worker/trial.test.ts` 과반 케이스 이번 재실행 통과 |
| 2 | 지목이 시작되면 모두 가운데로 모여 제자리에 서고, 각자 자기 자신을 뺀 한 명을 손가락으로 가리킨다. 누가 누구를 가리키는지 실시간으로 보이고 마감 전까지 바꿀 수 있다 (DAY-04, MAP-04) | ✓ VERIFIED | `nomination.ts` `castPoint`·`gather.ts` `layoutFor` 무변경, `trial.test.ts` "지목"·"모이기·무대 배치" 통과. `GameMap.tsx` 에서 빠진 것은 `onKick` 빈 함수 한 줄뿐(지목 이름표 경로 무관) |
| 3 | 최다 지목자 한 명이 최후 변론을 하고 시선이 변론자에게 모인다. 동률·0표면 처형 없이 밤으로 간다. 찬성이 과반이면 처형된다. 지목·변론·찬반 동안 서버가 이동 요청을 막는다(채팅은 된다) (DAY-05, DAY-06, MAP-04) | ✓ VERIFIED | 서버 규칙(`resolveNomination`/`resolveVerdict`/`enterExecution`/`canMove`) 무변경, `trial.test.ts` 실제 흐름·tie·0표·부결 통과. **재검증 추가:** (a) 부결 판 처형 단계 안내가 `RoomScreen.tsx:100-105` `executionAnnounceOf` 에서 `verdict.passed !== true` 이면 `처형 없음` 을 내고 통과일 때만 `{이름} 님 처형` 을 만든다(CR-01 닫힘, 서버 `buildDay` 가 처형 단계에 `verdict` 를 항상 싣고 `execution` 은 통과 때만 싣는 것과 일치). `phaseScreens.test.tsx` 통과·부결 두 케이스 통과. (b) 결과 요약 `src/game/verdict.ts:89-92` 가 `cand` 는 있고 `cand.candidate` 가 없는 줄(서버 `nomination.ts` 가 동률·0표 날 쌓는 모양)을 먼저 처리해 `처형 없음 (동률)` / `처형 없음 (던진 표 없음)` 으로 가르고, 찬반 부결(`candidate` 있음)은 기존 `찬성 n · 반대 m` 을 유지한다(WR-01 닫힘). `verdict.test.ts`·`resultScreen.test.tsx` 통과 |
| 4 | 단계 시간이 토론 90초·지목 15초·변론 20초·찬반 10초·밤 30초이고, v1.0 의 처형 여부 → 후보 선택 → 한 표씩 공개 흐름과 고정 테이블은 화면에 없다 (DAY-07) | ✓ VERIFIED | `phases.ts` 무변경. `test/unit/dayStaticGuard.test.ts` 이번 재실행 통과 |
| 5 | 처형된 사람은 반투명 유령이 되어 맵을 떠다니며 모든 사람의 역할을 본다. 산 사람 폰으로 오가는 메시지에는 유령의 위치·움직임·채팅이 한 번도 없다 (GHOST-01, GHOST-02) | ✓ VERIFIED | `audience.ts`·`view.ts` 무변경, `test/worker/ghostLeak.test.ts`(메타모픽 비교 포함) 이번 재실행 통과 |

**Score:** 5/5 truths verified (behavior_unverified 0 — 전이·불변식마다 이름 붙은 시험이 있고 통과)

### 수정이 건드린 곳의 3단계 확인

| 항목 | 존재 | 실체 | 연결 | Status |
|------|------|------|------|--------|
| CR-01 `executionAnnounceOf` (`RoomScreen.tsx`) | 있음 | 통과 아님이면 `처형 없음`, 통과면 이름 조회. 빈 껍데기 아님 | `PHASE_ANNOUNCE.execution` 으로 단계 안내 영역에 연결, 서버 view 모양(`day.verdict`/`day.execution`)과 대조 일치 | ✓ VERIFIED |
| WR-01 `summaryLines` (`src/game/verdict.ts`) | 있음 | 갈래 순서: 통과+후보 → 후보 없는 `cand`(동률/무표) → 부결 → 옛 모양 | 결과 화면이 `summaryLines` 소비. 시험 고정값이 서버가 쌓는 `{passed:false, cand:{votes}}` 모양 | ✓ VERIFIED |
| WR-02 `onKick` 선택 속성 (`WorldStage.tsx:78,229,320`, `GameMap.tsx`) | 있음 | `canKick` 이 `props.onKick !== undefined` 를 요구. `GameMap` 은 더 이상 빈 함수를 넘기지 않음 | `Lobby.tsx:145` 는 계속 `onKick` 전달(대기실 동작 유지). `WorldStage` 사용처는 두 곳뿐. `worldStage.test.tsx`·`lobby.test.tsx` 통과 | ✓ VERIFIED |
| WR-03 이전 시도 실패 보존 (`scripts/e2e/run.mjs`) | 있음 | 던진 시도의 `ok === false` 를 `carried` 로 모아 최종 결과에 합침 | `node --check` 통과, `e2eContract.test.ts` 통과. 실제 Chrome E2E 재시도 경로는 이번에도 직접 돌리지 못함(수정 보고서와 같음) | ✓ VERIFIED (코드·계약 시험 수준) |

### Deferred Items

실기기·눈 확인 항목. 사용자 결정으로 모든 개발 뒤 묶음 확인(ROADMAP 백로그 999.5, 절차는 `08-DEVICE-CHECKS.md`). 목표 달성의 갭으로 세지 않는다.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | 낮 흐름 5분 성능·열감 (평균 55fps 이상, 끊김 5회 이하) | Phase 999.5 | UAT test 1 skipped(deferred) |
| 2 | 단계 조명·손가락 지목·변론자 시선·유령 떠오름 읽힘 | Phase 999.5 | UAT test 2 skipped(deferred) |
| 3 | 유령 이름표(불투명도 0.6) 대비 실기기 판독 | Phase 999.5 | UAT test 3 skipped(deferred) |
| 4 | 스크린 리더 실청취(자동 시험으로는 이미 통과) | Phase 999.5 | UAT test 4 pass(automated), 실청취만 이월 |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `shared/game/{nomination,verdict,movement,gather,audience,discussion,execution,phases,tick,view}.ts` | 낮 규칙·방송 규율 | ✓ VERIFIED | e5aba06 이후 무변경, 이전 확인 유지, 관련 시험 재실행 통과 |
| `worker/room.ts` | 메시지 핸들러·배치·이동 차단 | ✓ VERIFIED | 무변경 |
| `src/game/verdict.ts` | 결과 요약 | ✓ VERIFIED | 수정 확인 |
| `src/screens/RoomScreen.tsx` | 단계 안내 | ✓ VERIFIED | 수정 확인 |
| `src/components/WorldStage.tsx`·`src/screens/GameMap.tsx` | 맵 이름표·내보내기 | ✓ VERIFIED | 수정 확인 |
| `scripts/e2e/run.mjs` | E2E 실행기 | ✓ VERIFIED | 수정 확인(구문·계약 시험) |
| `docs/decisions/0060-v2-day-execution-ghost.md` | 결정 기록 | ✓ VERIFIED | 이전 확인 유지 |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| `RoomScreen.executionAnnounceOf` | 서버 `view.day.verdict`/`day.execution` | `verdict.passed` 가름 | WIRED |
| 결과 화면 | `summaryLines` | voteLog `cand`/`exec` 모양 | WIRED |
| `Lobby` | `WorldStage.onKick` | 명시 전달 | WIRED |
| `GameMap` | `WorldStage` | `onKick` 미전달 → 내보내기 버튼 없음 | WIRED (의도) |
| 서버 규칙 전부(이전 보고서의 6개 링크) | — | 무변경 | WIRED (회귀 점검: 관련 시험 통과) |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real Data | Status |
|----------|------|--------|-----------|--------|
| 처형 단계 안내 | `view.day.verdict.passed` | 그날 voteLog 줄 `exec` (서버 `buildDay`) | 예 | ✓ FLOWING |
| 결과 요약 줄 | `summary[].exec`, `voteLog[].cand` | `resolveNomination`/`resolveVerdict` 가 쌓음 | 예 | ✓ FLOWING |
| 나머지(득표 배지·끝내기 점·유령 직업 칩) | 이전 보고서 | 서버 view | 예 | ✓ FLOWING (무변경) |

### Behavioral Spot-Checks

이번 재검증에서 직접 돌린 결과. 전체 스위트는 돌리지 않았다(전체 결과는 호출자 제공 값 인용).

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 수정 범위 + 규칙 + 누설 | `npx vitest run test/client/{phaseScreens,resultScreen,worldStage,lobby,gameMap}.test.tsx test/unit/{verdict,e2eContract,nomination,dayStaticGuard}.test.ts test/worker/{trial,ghostLeak}.test.ts` | 11 파일 467 통과 | ✓ PASS |
| 앱 타입 | `tsc -p tsconfig.app.json --noEmit` | 오류 없음 | ✓ PASS |
| 워커 타입 | `tsc -p tsconfig.worker.json --noEmit` | 오류 없음 | ✓ PASS |
| E2E 실행기 구문 | `node --check scripts/e2e/run.mjs` | 통과 | ✓ PASS |
| 전체 스위트(호출자 제공, 재실행 안 함) | `npx vitest run` | 135 파일 3679 통과 1 건너뜀 (이전 한 번의 일시 실패는 두 번 재실행에서 재현 안 됨) | 인용 |

### Probe Execution

이 페이즈는 `probe-*.sh` 를 선언하지 않는다. SKIPPED.

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|--------------|-------------|--------|----------|
| DAY-03 | 01·02·07·11·13·14·24·26 | 과반 토론 끝내기 → 지목 | ✓ SATISFIED | 진실 1 |
| DAY-04 | 01·02~10·12·14·15·24·25·26 | 지목: 모이기·손가락·실시간·변경·자기 제외 | ✓ SATISFIED (시각은 이월) | 진실 2 |
| DAY-05 | 01·02·04·06~11·15·16·24·26 | 최다 한 명 변론, 동률·0표 처형 없음 | ✓ SATISFIED | 진실 3 (WR-01 수정으로 결과 요약 문구도 정확) |
| DAY-06 | 01·02·03·05~07·11·14·16·21·22·24·26·28 | 찬반 과반 처형, 수만 공개, 역할 비공개 | ✓ SATISFIED | 진실 3 (CR-01 수정으로 접근성 안내도 정확) |
| DAY-07 | 01·11·13·14·18~28 | 시간 시작값, v1.0 흐름·테이블 제거 | ✓ SATISFIED | 진실 4 |
| MAP-04 | 01·04·08·09·12·13·15·24·26 | 단계별 이동 가능 여부를 서버가 정함 | ✓ SATISFIED (밤 "마피아만" 은 9페이즈 NIGHT-07 범위) | 진실 1·3 |
| GHOST-01 | 01·04·08~10·12·17·24~26 | 유령은 산 사람에게 보이지 않음(네트워크로도) | ✓ SATISFIED | 진실 5 |
| GHOST-02 | 01·03·05·07·09·17·18·24·26 | 유령은 모든 역할·밤 행동 관전 | ✓ SATISFIED | 진실 5 |

계획 frontmatter 의 요구사항 ID 여덟 개가 모두 REQUIREMENTS.md 에 있고, REQUIREMENTS.md 가 Phase 8 로 매핑한 ID 도 같은 여덟 개다. 고아 요구사항 없음.

**서류 정리 필요(코드 문제 아님):** REQUIREMENTS.md 의 여덟 항목 체크박스가 아직 `[ ]`, 추적표가 `Pending` 이고 ROADMAP 의 Phase 8 요약 체크박스(50행)도 비어 있다. 페이즈 마감 때 오케스트레이터가 갱신할 서류다.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/game/verdict.ts` | 96-98 | IN-06: 마지막 `else` 의 삼항식 한 갈래가 도달 불가 | ℹ️ Info | 동작 영향 없음, 정리 후보 |
| `scripts/e2e/run.mjs` | 164-173 | IN-07: 재시도 때 같은 실패가 두 번 나올 수 있고 재시도 원인과 구분 안 됨 | ℹ️ Info | 실패를 가리지 않는 방향이라 안전, 로그 가독성만 |
| 여러 파일 | — | IN-01~IN-05 (낡은 주석, 도달 불가 ping 처리, 미리보기 이미지 호스트, maxLength 단위, 시험 보조 값) | ℹ️ Info | 동작 영향 없음 |

변경 파일(`verdict.ts`, `RoomScreen.tsx`, `WorldStage.tsx`, `GameMap.tsx`, `run.mjs`)에서 TBD/FIXME/XXX 표식 0건. 이전 보고서의 경고 WR-01~03 과 CR-01 은 모두 닫혔다. 블로커 없음.

## 사용자 결정(2026-11-03) 반영

TDD 모드 해제(08-21~26, RED 단독 커밋 없음), 낮 흐름 렌더 측정 이월, 유령 이름표 대비 이월, 배지 "표" 12px 허용, 역할 배정 화면 임시 틀 유지는 갭으로 세지 않았다. 실기기 항목 셋은 위 Deferred Items 로 분류했다.

## 남은 참고 사항

- 수정은 아직 배포되지 않았다(배포본 health `+86b9d06` 이 수정 앞). 배포 뒤 배포본 E2E 에서 WR-03 재시도 경로를 한 번 확인하는 것이 좋다. 목표 판정에는 영향 없음.
- `08-VALIDATION.md` frontmatter 의 `nyquist_compliant: false` 와 서명 체크리스트 문구 불일치(문서 정리 사항, 코드와 무관).
- IN-06·IN-07 은 정리 후보. 12페이즈 v1.0 잔재 점검 때 함께 다뤄도 된다.

## Gaps Summary

must-have 에서 FAILED 는 없고 열린 블로커·경고도 없다. 페이즈 목표(맵 위 낮 토론 → 지목 → 변론 → 찬반 → 처형 → 유령 관전)는 서버 규칙·방송 규율·이동 차단·누설 시험으로 확인됐고, 코드 리뷰 수정 네 건이 문구·속성·실행기에서 올바르게 적용된 것을 서버 데이터 모양과 대조해 확인했다. 실기기·눈 확인은 사용자가 정한 백로그 999.5 로 이월됐다.

---

_Verified: 2026-11-03_
_Verifier: Claude (gsd-verifier)_
