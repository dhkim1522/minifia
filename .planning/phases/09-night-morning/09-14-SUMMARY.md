---
phase: 09-night-morning
plan: "14"
subsystem: server-morning-reveal
tags: [death-cards, chalk, chatlog, afterTransition, night-leak, tdd, tracer]
status: complete

requires:
  - phase: 09-night-morning
    provides: Player.will·nightNote 저장 (09-12), afterTransition·home 배선 (09-09), chalk·nightNote 상태 필드와 enterNight 지우기 (09-07), 카드 그리기 (09-11), 분필 그리기 (09-10)
provides:
  - ChatRecord.k / appendLine 입력 k / toWire 조건부 k / parseRecord k 검증 (shared/game/chatLog.ts)
  - 방 DO afterTransition(prev, now), diedSeats, nightVictimNow, fillChalk, emitDeathCards, appendCard (worker/room.ts)
  - buildDay 의 day.chalk 필드별 복사 (shared/game/view.ts)
  - 누설 검사 허용 목록 ".k"·".lines[].k" (결정 0061-11 이유 주석)
affects: [09-15, 09-16, 09-17, 09-18]

actuals:
  tokens: 14500
  tasks: 3
  commits: 6
plan_head_before: bad4d984be1ad133809eff95e37ab2d51ad55078
plan_head_after: 310841bab0811810ac080ad297f3b82549a9d667

tech-stack:
  added: []
  patterns:
    - "사망은 전환 전후 alive 비교로 찾는다: afterTransition 세 호출부가 전환 전 상태를 넘기고, 처형·암살·알람 따라잡기가 같은 함수를 지난다"
    - "카드 줄은 applyChat 본체와 같은 모양(audience → seatMask → appendLine → storage.put → deliver)이되 도배·문장 검사를 부르지 않는다"
    - "분필은 persistAndBroadcast 전에 상태에 채워 같은 전환의 모든 view 가 같은 값을 싣는다"

key-files:
  created:
    - test/worker/morningCards.test.ts
  modified:
    - shared/game/chatLog.ts
    - shared/game/view.ts
    - worker/room.ts
    - test/unit/chatLog.test.ts
    - test/unit/view.test.ts
    - test/worker/chatReplay.test.ts
    - test/worker/leak.test.ts
    - test/worker/chatLeak.test.ts

key-decisions:
  - "카드 순서: 같은 전환에 사망이 여럿이면 그 밤 피해자가 아닌 사람의 유언을 seat 순으로 먼저, 그 밤 피해자의 유언, 마지막에 쪽지 카드. 앞선 처형이 먼저 보이게 한다"
  - "분필 좌표는 home 이 같은 일차일 때만 쓰고, 아니면 피해자 구간 끝점(fail-safe). 둘 다 없으면 분필을 채우지 않는다"
  - "phase 가 ended 로 끝난 전환처럼 audience(all)이 빈 집합이면 카드를 만들지 않는다(보여 줄 채팅창이 없다)"
  - "buildDay 의 chalk 는 phase 조건 없이 상태 값이 있을 때만 복사한다 — 채우는 시점(암살 아침)과 지우는 시점(밤 진입)이 서버에서 정해져 있다"

requirements-completed: [MORN-01, MORN-02]

metrics:
  duration: 약 35분
---

# Phase 9 Plan 14: 아침 공개 서버 층 (사망 카드·분필 좌표) Summary

처형·암살로 사람이 탈락하는 전환마다 서버가 유언·쪽지를 `k: will|note` 카드 줄로 한 번만 만들어 모두에게 보내고, 암살 현장의 분필 좌표를 그날 낮 동안 모든 view 에 같은 값으로 싣는다.

## TDD 기록

### Task 1 (트레이서): 처형된 사람의 유언 카드
- **RED** `b59366e`: chatLog 의 k 단위 시험 4건(appendLine·toWire·replayFor·restore)과 처형 유언 카드 워커 시험. 대상 시험 "유언 '억울해요' … will 카드 한 장" 이 `expected ' ;  ;  ;  ;  ; ' to be 'all/will/1/억울해요 ; …'` 단언으로 실패(처형 진입은 정상 도달, 카드만 없음). 의미 검사: 대상 시험이 실행되었고 계획한 단언에서 실패했다. 유언 없음·처형 분필 없음 시험은 처음부터 통과하는 방어 시험이다.
- **GREEN** `7fb3a15`: chatLog.k, afterTransition(prev, now), diedSeats, emitDeathCards(will), appendCard.
- 트레이서 검증: 이어서 Task 1 시험을 다시 돌려 통과를 확인한 뒤 확장(Task 2)으로 넘어갔다.

### Task 2: 아침 쪽지 카드와 분필
- **RED** `f3e96cf`: 6건 실패(note 카드 없음, day.chalk 없음 3건, view 단위 시험, 따라잡기 전환). 구출·불일치 시험은 방어 시험으로 통과한다.
- **GREEN** `74925ff`: fillChalk, nightVictimNow, 쪽지 카드, buildDay chalk.

### Task 3: 재접속 복원·누설 허용 목록
- **RED** `477e5e5`: 허용 목록 시험 2건 실패(`.k:false`, `.lines[].k:false`). 재접속 복원·분필 첫 state·`chat` 의 k 거절 시험 3건은 Task 1·2 구현이 이미 만족해 처음부터 통과한다(복원·스키마가 이미 k 를 지나게 되어 있었다). 허용 목록만 진짜 RED 였다.
- **GREEN** `310841b`: leak·chatLeak 허용 목록에 두 경로를 이유 주석과 함께 더했다. 다른 경로는 넓히지 않았다.

REFACTOR 커밋 없음.

## 검증

- `npm run typecheck` 오류 0.
- `npx vitest run` 전체: 3968 통과, 1 실패(`test/worker/testTools.test.ts` ended 시험, 부하 탓 nextFrame 10초 타임아웃). 이월 메모의 기존 불안정이다. 단독 재실행에서는 다른 ended 시험이 같은 모양으로 실패했다 — 이 계획과 무관.
- `.skip(` 검사는 rc=0: `test/client/nightMap.test.tsx` 의 `it.skip` 6건이 남아 있다(09-15 가 지운다, 이월 메모 09-12).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] StoredRoom 타입에 chalk 없음**
- **Found during:** Task 2 GREEN 타입 검사
- **Issue:** 시험에서 `storedRoom(code).chalk` 가 TS2339
- **Fix:** 시험 안에서 `as unknown as { chalk?: ... }` 로 좁혀 읽음(helpers.ts 는 이 계획 파일 목록 밖이라 건드리지 않음)
- **Files modified:** test/worker/morningCards.test.ts
- **Commit:** 74925ff

**2. [Rule 3 - Blocking] chatReplay.test.ts 의 지역 withRole**
- **Found during:** Task 3 RED
- **Issue:** 이 파일에는 `(actors, role)` 모양의 지역 `withRole` 이 있어 helpers 의 `withRole(g, role)` 와 모양이 달랐다
- **Fix:** 새 시험은 지역 함수에 `g.actors` 를 넘긴다
- **Commit:** 477e5e5

그 밖에는 계획대로 실행했다. 알람 따라잡기(처형 + 암살 한 번에) 시험은 밤 진입이 nightPick 을 지워 실제 알람으로는 재현이 어려워, DO 인스턴스의 `afterTransition(prev, now)` 를 직접 불러 전후 상태를 주입하는 방식으로 만들었다(가정 A1 의 감지 규칙을 직접 검증).

## Known Stubs

없음.

## Threat Flags

없음. T-09-31(사망한 사람만, 쪽지는 그 밤 피해자 탈락 때만, seat = 피해자)과 T-09-32(구출·무효 밤 카드·분필 0)는 워커 시험으로 닫았다. 사람이 보낸 chat 에 k 를 붙이면 스키마가 BAD_MESSAGE 로 거절한다.

## Self-Check: PASSED

- 파일: test/worker/morningCards.test.ts, shared/game/chatLog.ts, worker/room.ts, shared/game/view.ts 확인
- 커밋: b59366e, 7fb3a15, f3e96cf, 74925ff, 477e5e5, 310841b 확인
