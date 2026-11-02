---
phase: 08-day-execution-ghost
verified: 2026-11-03T05:00:00Z
status: human_needed
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
  - src/game/dayView.ts
  - src/game/verdict.ts
  - src/screens/GameMap.tsx
  - src/screens/GamePanel.tsx
  - src/screens/RoomScreen.tsx
  - src/world/presence.ts
  - worker/room.ts
covered_digest: "v3:sha256:8c67697adea923e20f32153a06a3478cafa1b3d4be6bc9dec013d1b9cf240370"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "낮 흐름 5분(토론 → 지목 → 변론 → 찬반 → 처형 → 밤)을 iPhone 16 Pro 와 크롬 CPU 4배 스로틀에서 돌린다"
    expected: "5분 평균 55fps 이상, 끊김(50ms 초과) 5회 이하, 열감 미지근 이하 (결정 0055·0057)"
    why_human: "실기기 성능·열감은 코드로 볼 수 없다. 사용자가 2026-11-03 에 실기기 묶음으로 미루기로 했다 (08-DEVICE-CHECKS.md B1)"
  - test: "단계 조명(지목 무대 조명·선두 점광·변론 스포트라이트·찬반·처형·밤·아침)과 손가락 지목, 변론자에게 모이는 시선을 눈으로 본다"
    expected: "각 단계에서 누가 중심인지 한눈에 읽히고 낮이어도 어두운 톤이 유지된다"
    why_human: "조명·연출의 읽힘은 눈으로만 판단된다 (08-DEVICE-CHECKS.md B2 등)"
  - test: "유령 이름표(불투명도 0.6)의 글자 대비를 실기기에서 본다"
    expected: "읽을 수 있다. 어려우면 사용자가 불투명도·글자색을 정한다 (픽셀 근사 약 1.9~2.5:1)"
    why_human: "사용자가 실기기 확인으로 미룬 항목 (08-DEVICE-CHECKS.md B3)"
  - test: "스크린 리더로 찬반 부결 판에서 처형 단계 안내를 듣는다 (코드 리뷰 CR-01 재현 확인)"
    expected: "'처형 없음' 만 들린다. 지금 코드는 보이지 않는 안내 영역이 '○○ 님 처형' 도 읽는다"
    why_human: "스크린 리더 청취는 코드 검사로 대신할 수 없다. 수정 후 확인용"
---

# Phase 8: 낮 처형과 유령 Verification Report

**Phase Goal:** 낮 토론이 맵 위에서 열리고 지목 → 변론 → 찬반 → 처형이 정통 순서로 돌며, 처형된 사람은 유령이 되어 끝까지 지켜본다
**Verified:** 2026-11-03
**Status:** human_needed
**Re-verification:** No — initial verification

## 요약

서버 규칙, 와이어 방송 규율, 이동 차단, 유령 누설 차단, v1.0 흐름 제거가 모두 코드와 테스트로 확인됐다. 로드맵 성공 기준 다섯 개에서 FAILED 는 없다. 남은 것은 실기기·눈 확인 항목(사용자가 미룬 것)과, 열려 있는 코드 리뷰 결함 CR-01·WR-01 이다. 두 결함은 어떤 must-have 도 깨지 않지만(아래 "열린 리뷰 결함 판정") 고치지 않고 닫으면 결과 안내가 거짓이 되는 곳이 둘 있으므로 WARNING 으로 남긴다.

## Goal Achievement

### Observable Truths (ROADMAP 성공 기준 = 계약)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 낮 토론이 맵 위에서 열려 자유롭게 움직이며 채팅하고, 산 사람 과반이 "토론 끝내기" 를 누르면 바로 지목으로 넘어간다 (DAY-03, MAP-04) | ✓ VERIFIED | `shared/game/discussion.ts` `toggleEnd`/`endCountOf`/`endReached`(과반 = `majorityOf`). `worker/room.ts` `applyEndDiscussion` 이 과반이면 마감을 지금으로 당겨 `tick` 으로 정상 경로를 탄다. `GamePanel.tsx` 에 `[토론 끝내기]` 버튼(`data-end-discussion`, `send({t:"endDiscussion"})`)과 점 진행. `canMoveIn`: 산 사람은 dayAnnounce·discussion 에서 이동 허용. 시험 `trial.test.ts` "과반(산 4 중 3)에 닿는 순간 …", "유령의 토론 끝내기는 BAD_MESSAGE" 통과 |
| 2 | 지목이 시작되면 모두 가운데로 모여 제자리에 서고, 각자 자기 자신을 뺀 한 명을 손가락으로 가리킨다. 누가 누구를 가리키는지 실시간으로 보이고 마감 전까지 바꿀 수 있다 (DAY-04, MAP-04) | ✓ VERIFIED | `nomination.ts` `castPoint`(자기 자신·유령·죽은 대상 거부, 취소 없음, 마지막 값 유효)와 `pointLinesOf` → `view.day.points`(모두에게 같은 공개 목록). `worker/room.ts` `syncLayout` + `gather.ts` `layoutFor`/`ringSlots`(반지름 2.65 원 위 슬롯)로 서버가 모으기 이동을 만든다. 250ms 변경 간격(`POINT_MIN_INTERVAL_MS`). 시험 `trial.test.ts` "지목 …", "모이기·무대 배치(결정 0060-7)" 전부 통과. 손가락·배지의 시각은 아래 사람 확인 |
| 3 | 최다 지목자 한 명이 최후 변론을 하고 시선이 변론자에게 모인다. 동률·0표면 처형 없이 밤으로 간다. 찬성이 과반이면 처형된다. 지목·변론·찬반 동안 서버가 이동 요청을 막는다(채팅은 된다) (DAY-05, DAY-06, MAP-04) | ✓ VERIFIED | `resolveNomination`: 최다 한 명이면 defense, 동률·0표면 `next:"night"`. 변론자는 `STAGE_SPOT` 으로 이동. `resolveVerdict`: 분모 E = 변론자를 뺀 산 사람, 찬성 × 2 > E 면 통과(8명이면 4 통과·3 부결), 집계 직후 `verdictVote` 키 삭제. `enterExecution` 이 통과일 때만 변론자를 탈락시키고 직업은 싣지 않는다. 이동 차단은 `applyMove` 의 `canMove` 한 곳(`movement.ts`)이고 CHAT_PHASES 에 nomination·verdict 가 있어 채팅은 통과. 시험 `trial.test.ts` "실제 흐름"(4:1 지목 → 찬반 3:1 → 처형 → 밤), "2:2 tie", "0표 noVotes", "부결 2/2", `world.test.ts` "단계별 이동" 통과 |
| 4 | 단계 시간이 토론 90초·지목 15초·변론 20초·찬반 10초·밤 30초이고, v1.0 의 처형 여부 → 후보 선택 → 한 표씩 공개 흐름과 고정 테이블은 화면에 없다 (DAY-07) | ✓ VERIFIED | `phases.ts`: `DISCUSSION_MS 90_000`, `NOMINATION_MS 15_000`, `DEFENSE_MS 20_000`, `VERDICT_MS 10_000`, `NIGHT_MS 30_000`(처형 발표 5초). `PhaseId`/`PHASE_DEFS` 에 옛 세 단계 행이 없다. `git grep` 으로 소스(src·shared·worker)에서 옛 식별자는 `room.ts` 의 저장 방 정규화 표(LEGACY_*)와 주석뿐. 정적 가드 `dayStaticGuard.test.ts` 통과, 옛 메시지는 `trial.test.ts` 에서 BAD_MESSAGE |
| 5 | 처형된 사람은 반투명 유령이 되어 맵을 떠다니며 모든 사람의 역할을 본다. 산 사람 폰으로 오가는 메시지에는 유령의 위치·움직임·채팅이 한 번도 없다 (GHOST-01, GHOST-02) | ✓ VERIFIED | `audience.ts`: world 프레임은 mover 가 유령이면 유령만, mover 불명이면 빈 집합(fail-closed). `worldVisibleTo` 로 접속 snap 도 viewer 별. `view.ts`: 탈락자에게만 `spectate.seats`(모든 직업)와 밤 picks. 시험 `ghostLeak.test.ts` 의 메타모픽 비교(유령이 가만히 있을 때와 걷고 입력하고 말할 때 산 사람 프레임 열 동일)와 직접 불변식 통과, `view.test.ts`·`presence.test.ts`·`ghostView.test.tsx` 통과. 반투명(0.6)·떠오름 연출의 시각은 아래 사람 확인 |

**Score:** 5/5 truths verified (behavior-dependent truth 의 behavior_unverified 0 — 각 전이·불변식에 이름 붙은 시험이 있고 통과)

### 계획 must-have 표본 확인 (28개 계획 중 계약성 큰 것)

| 계획 | must-have | Status | Evidence |
|------|-----------|--------|----------|
| 08-02 | 지목·찬반 개인 값은 집계 직후 서버 상태에서 사라진다(익명은 데이터가 없다는 사실로) | ✓ VERIFIED | `resolveNomination`/`resolveVerdict` 가 구조 분해로 `nominate`/`verdictVote` 키를 지움. `trial.test.ts` "어떤 소켓 프레임에도 남의 찬반 값이 없다" 통과 |
| 08-04 | 무대 예외는 `STAGE_SPOT` 한 점뿐, 클라이언트 입력으로는 그 목적지를 버린다 | ✓ VERIFIED | `worker/room.ts` `applyMove` 가 `dest == STAGE_SPOT` 을 버리고, `map.ts` 예외는 단일 점 + `STAGE_REACH_FX` 선분. `map.test.ts`·`gather.test.ts` 통과 |
| 08-07 | 토론 끝내기 개수만 공개하고 누른 사람은 서버 전용 | ✓ VERIFIED | `view.ts` `buildDay`: `endCount` 개수만, 본인 값은 `me.endDiscussion`. `trial.test.ts` 통과 |
| 08-11 | 찬반 부결이면 아무도 탈락하지 않고 변론자는 자기 슬롯으로 돌아오고 밤 view 에 noExecution 이 없다 | ✓ VERIFIED | `enterExecution` 이 `passed !== true` 면 입력 그대로, `noExecutionOf` 는 candidate 가 있으면 undefined. `trial.test.ts` "찬반이 부결 …" 통과 |
| 08-20·22 | 옛 테이블·후보 선택·처형 문구 번호가 코드에 없다 | ✓ VERIFIED | `dayStaticGuard.test.ts` 통과. `execution.ts` 는 난수를 부르지 않고 `execution: {seat}` 만 기록 |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `shared/game/nomination.ts` | 지목 규칙·집계·마감 훅 | ✓ VERIFIED | 실체 있음, `tick.ts` ON_DEADLINE 에 연결 |
| `shared/game/verdict.ts` | 찬반 규칙·마감 훅 | ✓ VERIFIED | 실체 있음, ON_DEADLINE 에 연결 |
| `shared/game/movement.ts` | `canMove` 표 | ✓ VERIFIED | `worker/room.ts` `applyMove`·`GameMap.tsx` `canWalk` 가 같은 표 사용 |
| `shared/game/gather.ts` | 모이는 슬롯·배치 | ✓ VERIFIED | `worker/room.ts` `syncLayout` 이 호출 |
| `shared/game/audience.ts` | 유령 방송 규율 | ✓ VERIFIED | `emitWorld` → `deliver(audience(...))` 한 길 |
| `src/game/dayView.ts` | 위 알림·기록 줄·시간표 | ✓ VERIFIED | `useDayFx`·`GameMap` 소비 |
| `src/components/v2/{VoteBadge,SureStamp,RoleChip,VerdictPicker}.tsx` | v2 부품 | ✓ VERIFIED | `HeadStack`·`GamePanel` 이 사용 |
| `docs/decisions/0060-v2-day-execution-ghost.md` | 결정 기록 | ✓ VERIFIED | 존재(번호 항목 14개), 옛 결정 0034·0036·0037·0039·0040·0049·0056 모두 '결정 0060' 개정 표시가 있음(직접 grep) |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| `worker/room.ts` 메시지 핸들러 | `toggleEnd`/`castPoint`/`castVerdict` | `case "endDiscussion"/"point"/"verdict"` + 봇 `actAsBot` 동일 본체 | WIRED |
| `tick.ts` ON_DEADLINE | `resolveNomination`/`resolveVerdict` | 마감 훅 표 | WIRED |
| `worker/room.ts` `applyMove` | `canMove` | 서버 권위 이동 차단 | WIRED |
| `emitWorld` | `audience(world)` | mover 기준 받는 사람 | WIRED |
| `GamePanel.tsx` | 서버 `endDiscussion`/`verdict` | `send({t:...})` + view 가 눌림 기준 | WIRED |
| `GameMap.tsx` 이름표 | `{t:"point"}` | 이름표 지목 버튼 | WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real Data | Status |
|----------|------|--------|-----------|--------|
| 득표 배지·지목 줄 | `view.day.points` | `pointLinesOf(state)` ← 플레이어 `nominate` | 예 | ✓ FLOWING |
| 토론 끝내기 점 | `view.day.endCount` | `endCountOf(state)` | 예 | ✓ FLOWING |
| 찬반 마침 점 | `view.day.voted` | `votedSeatsOf(state)` | 예 | ✓ FLOWING |
| 처형 알림 수 | `view.day.verdict` | 그날 `voteLog` 줄 `exec` | 예 | ✓ FLOWING |
| 유령 직업 칩 | `view.spectate.seats` | 탈락자에게만 `p.role` | 예 | ✓ FLOWING |

### Behavioral Spot-Checks

이번 검증에서 직접 돌린 결과(전체 스위트는 돌리지 않음; 전체 결과는 호출자가 준 게이트 값을 인용).

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 규칙 계층 | `npx vitest run test/unit/{nomination,verdictRule,movement,audience,gather,phases}.test.ts test/worker/{ghostLeak,trial}.test.ts` | 8 파일 256 통과 | ✓ PASS |
| 서버·화면 계층 | `npx vitest run test/worker/{day,world,leak,chatLeak}.test.ts test/client/{gameMap,ghostView,verdictScreen,nominationScreen}.test.tsx test/unit/{dayView,dayStaticGuard,view,tick}.test.ts` | 12 파일 372 통과 | ✓ PASS |
| 전체 게이트(호출자 제공, 재실행 안 함) | build / `npm test` / `node --test scripts` / 로컬 E2E / 배포본 E2E·smoke | build OK, 135 파일 3674 통과 1 건너뜀(print-only), 195 통과, E2E OK ×2, smoke OK | 인용 |

### Probe Execution

이 페이즈는 `scripts/*/tests/probe-*.sh` 형식의 probe 를 선언하지 않는다. SKIPPED.

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|--------------|-------------|--------|----------|
| DAY-03 | 01·02·07·11·13·14·24·26 | 과반 토론 끝내기 → 지목 | ✓ SATISFIED | 진실 1 |
| DAY-04 | 01·02~10·12·14·15·24·25·26 | 지목: 모이기·손가락·실시간·변경·자기 제외 | ✓ SATISFIED (시각은 사람 확인) | 진실 2 |
| DAY-05 | 01·02·04·06~11·15·16·24·26 | 최다 한 명 변론, 동률·0표 처형 없음 | ✓ SATISFIED | 진실 3 |
| DAY-06 | 01·02·03·05~07·11·14·16·21·22·24·26·28 | 찬반 과반 처형, 수만 공개, 역할 비공개, 변론자 투표 없음 | ✓ SATISFIED (WARNING: CR-01, WR-01) | 진실 3 |
| DAY-07 | 01·11·13·14·18~28 | 시간 시작값, v1.0 흐름·테이블 제거 | ✓ SATISFIED | 진실 4 |
| MAP-04 | 01·04·08·09·12·13·15·24·26 | 단계별 이동 가능 여부를 서버가 정함 | ✓ SATISFIED (밤의 "마피아만" 은 9페이즈 NIGHT-07 범위) | 진실 1·3 |
| GHOST-01 | 01·04·08~10·12·17·24~26 | 유령은 산 사람에게 보이지 않음(네트워크로도) | ✓ SATISFIED | 진실 5 |
| GHOST-02 | 01·03·05·07·09·17·18·24·26 | 유령은 모든 역할·밤 행동 관전 | ✓ SATISFIED | 진실 5 |

계획 frontmatter 의 요구사항 ID 여덟 개가 모두 REQUIREMENTS.md 에 있고, REQUIREMENTS.md 가 Phase 8 로 매핑한 ID 도 여덟 개로 같다. 고아 요구사항 없음.

**서류 정리 필요:** REQUIREMENTS.md 의 여덟 항목 체크박스가 아직 `[ ]`, 추적표가 `Pending` 이고 ROADMAP 의 Phase 8 체크박스도 비어 있다. 코드 문제가 아니라 페이즈 마감 때 오케스트레이터가 갱신할 서류다.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/screens/RoomScreen.tsx` | 98-102 | CR-01: `executionAnnounceOf` 가 `execution?.seat ?? candidate` 로 부결 때도 "○○ 님 처형" 을 만든다 (보이지 않는 `aria-live` 영역) | ⚠️ Warning (리뷰는 critical) | 스크린 리더가 같은 순간 보이는 알림 "처형 없음" 과 모순된 문장을 읽는다. 게임 결과·권한·누설에는 영향 없음 |
| `src/game/verdict.ts` | 90-104 | WR-01: `!passed` 가 먼저라 지목 동률·0표 날 결과 요약이 "처형 없음 (찬성 0 · 반대 0)" 으로 나온다 | ⚠️ Warning | 결과 화면 요약에 일어나지 않은 0:0 표가 찍힌다. 시험이 새 서버가 만들지 않는 `passed:true` 고정값을 써서 못 잡음 |
| `src/screens/GameMap.tsx` | 317 | WR-02: `onKick={() => {}}` — 게임 중 끊긴 사람 이름표가 동작 없는 "내보내기" 버튼 | ⚠️ Warning | 접근성 이름이 거짓이고 그 둘레 탭이 걷기를 가로챌 수 있음 (방장 화면) |
| `scripts/e2e/run.mjs` | 121-136 | WR-03: 준비 실패 재시도가 먼저 기록된 검사 실패를 버림 | ⚠️ Warning | 검증 도구가 실패를 가릴 수 있음. 이번 "E2E OK" 가 가려진 실패 위에 선 것인지는 직접 확인하지 못했다(08-26 기록은 재시도 원인을 환경 문제로 적음). 단위·워커 시험이 같은 규칙을 따로 덮으므로 목표 판정에는 영향 없음 |
| `src/screens/RoomScreen.tsx` 등 | — | IN-01~IN-05 (낡은 주석, 도달 불가 ping 처리, 미리보기 이미지 호스트, maxLength 단위, 시험 보조 값) | ℹ️ Info | 동작에 영향 없음 |

TBD/FIXME/XXX 표식 0건, TODO/HACK 0건 (src·shared·worker 대상).

## 열린 리뷰 결함 판정

- **CR-01 (execution aria-live)**: 코드로 재현 확인(`RoomScreen.tsx:98-102`). 어떤 must-have 도 깨지 않는다. DAY-06 의 판정(찬성 과반 → 처형)은 서버가 정하고 맞게 돈다(`enterExecution` 이 부결이면 `execution` 을 만들지 않음). 시각 채널(`dayView`/TopToast)은 부결에 "처형 없음" 을 바르게 낸다. 계획서 어디에도 이 보이지 않는 문장을 규정한 must-have 는 없다(08-19 는 "`{닉네임} 님 처형` 하나" 만 정함). 그래서 FAILED 가 아니다. 다만 결과를 거짓으로 알리는 접근성 채널이므로 고치기 쉬운 한 줄(`verdict.passed !== true` 면 "처형 없음")이라 마감 전 수정을 권한다.
- **WR-01 (summaryLines)**: 코드로 재현 확인(`buildSummary` 가 동률·0표 날 `passed:false` 행을 만들고 `summaryLines` 의 첫 갈래가 받음). DAY-05 의 동작(처형 없이 밤)과 DAY-06 의 비공개 규칙은 그대로다. 잘못되는 것은 결과 화면 요약의 한 줄 문구뿐이고 비밀이 새지는 않는다. must-have 비해당, 문구 정확성 결함.
- **열린 질문 두 건**: (1) 맵 밤 진입에 "밤이 되었습니다" 알림이 없는 것 — UI-SPEC 와 08-18 계획 모두 마피아 시작 줄만 정했고 aria-live 의 "N일차 밤. …" 은 있다. 계약 안, 갭 아님 (9페이즈 밤 연출에서 다룸). (2) 낮 채팅 패널이 항상 그려지는 것(`me.chat ?? "all"`) — UI-SPEC 는 낮 모든 단계에 채팅 패널을 요구하고 밤만 `view.me.chat` 일치를 요구한다(`GamePanel` `chatChannelOk`). 서버가 단계·채널을 판정하므로(`CHAT_PHASES`/`audience`) 잘못된 전송은 서버가 거절한다. 갭 아님.

## 사용자 결정(2026-11-03) 반영

TDD 모드 해제(08-21~26), 낮 흐름 렌더 측정 이월, 유령 이름표 대비 이월, 배지 "표" 12px 허용, 역할 배정 화면 임시 틀 유지는 갭으로 세지 않았다.

기타 관찰: `08-VALIDATION.md` frontmatter 는 `nyquist_compliant: false` 인데 서명 체크리스트는 "true set" 이라 쓰고 있다(문서 불일치, 코드와 무관). 갱신을 권한다. 삭제된 옛 시험 파일(옛 투표·테이블 화면)은 옛 흐름 대상이고 기준선 3897 → 3674 감소와 맞는다.

### Human Verification Required

#### 1. 낮 흐름 5분 성능·열감
**Test:** 토론 → 지목 → 변론 → 찬반 → 처형 → 밤을 iPhone 16 Pro 와 크롬 CPU 4배 스로틀에서 5분 돌린다
**Expected:** 평균 55fps 이상, 끊김 5회 이하, 열감 미지근 이하
**Why human:** 실기기 성능. 사용자가 실기기 묶음으로 이월 (DEVICE-CHECKS B1)

#### 2. 연출 읽힘
**Test:** 단계 조명·손가락 지목·배지 맥박·변론자 시선·유령 떠오름을 눈으로 본다
**Expected:** 각 단계의 중심이 한눈에 읽히고 어두운 톤 유지
**Why human:** 시각 판단 (DEVICE-CHECKS B2 등)

#### 3. 유령 이름표 대비
**Test:** 불투명도 0.6 의 이름표를 실기기에서 읽는다
**Expected:** 읽힘, 아니면 사용자가 값을 정함
**Why human:** 사용자 이월 항목 (B3)

#### 4. 스크린 리더 처형 안내 (CR-01 수정 뒤)
**Test:** 부결 판에서 처형 단계 안내를 듣는다
**Expected:** "처형 없음" 만 들린다
**Why human:** 청취 확인

### Gaps Summary

must-have 에서 FAILED 는 없다. 페이즈 목표(맵 위 낮 토론 → 지목 → 변론 → 찬반 → 처형 → 유령 관전)는 서버 규칙·방송 규율·이동 차단·누설 시험으로 확인됐다. 상태가 `passed` 가 아닌 이유는 실기기·눈 확인 항목이 사람 확인으로 남아 있기 때문이다. 마감 전 권장 수정: CR-01(한 줄), WR-01(`summaryLines` 갈래 순서와 시험 고정값), WR-02. 이들은 `/gsd-code-review-fix` 나 짧은 갭 계획으로 닫을 수 있다.

---

_Verified: 2026-11-03_
_Verifier: Claude (gsd-verifier)_
