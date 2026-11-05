---
phase: 11-result-rematch
plan: "04"
subsystem: shared/game + worker + 대기실 화면
tags: [continuity, host-handoff, lobby-prune, result-leave, tdd, leak]
requires: [11-03]
provides: [resolveHost, pruneLobby, nextContinuityAt, Player.disconnectedAt, Player.left, leaveRoom ended]
affects: [11-05, 11-08, 11-12]
tech-stack:
  added: []
  patterns: [순수 함수 + advance 끝에서 멱등 적용, 알람 하나에 마감 합류, 서버 전용 필드]
key-files:
  created:
    - shared/game/continuity.ts
    - test/unit/continuity.test.ts
    - test/worker/continuity.test.ts
  modified:
    - shared/game/room.ts
    - shared/game/tick.ts
    - worker/room.ts
    - src/screens/Lobby.tsx
    - src/game/chatText.ts
    - test/unit/gameRoom.test.ts
    - test/unit/tick.test.ts
    - test/unit/view.test.ts
    - test/worker/leak.test.ts
    - test/client/lobby.test.tsx
decisions:
  - "방장 이양은 advance(모든 진입점)와 handleHello 의 attach 직후, 두 곳에서 같은 순수 함수 resolveHost 로만 일어난다. 새 프레임·문구는 없다."
  - "연결된 후보가 없으면 nextContinuityAt 이 방장 마감을 내지 않는다(지난 시각 알람이 헛도는 것을 막음). 후보가 hello 로 붙는 순간 이양된다."
  - "정리(pruneLobby)는 이양 뒤에 적용한다 — 옛 방장도 같은 규칙. 결과 단계 나간 사람(left)의 토큰은 hello 에서 invalid_token."
status: complete
commits: 6
plan_head_before: 01ba09d1769385b0bf3a5b5b3e879ba880ee81ff
plan_head_after: 8c4d88e56c35632e060b21922b73c39363bb2f39
actuals:
  tokens: 45000
  tasks: 3
  commits: 6
completed: 2026-11-05
requirements: [CONNX-01, CONNX-02]
---

# Phase 11 Plan 04: 방장 자동 이양·대기실 정리·결과 단계 나가기 Summary

방장 소켓이 유예(45초, 테스트 방 3초)를 넘겨 끊겨 있으면 연결된 사람 중 가장 이른 joinSeq 에게 방장이 넘어가고, 대기실에서 3분(테스트 방 6초) 끊긴 사람은 방과 월드에서 지워지며, 결과 단계 나가기는 명단을 지우지 않고 left 로 남긴다. 연결 기록은 어떤 프레임에도 새지 않는다.

## 한 일

- Task 1 (tracer): `shared/game/continuity.ts`(상수·hostSuccessor·resolveHost·nextContinuityAt), `Player.disconnectedAt/left`, detachConnection(now?)·attachConnection, nextWakeAt 합류. 워커는 disconnect 때 now 를 기록하고 항상 reschedule, 생성자가 소켓 없는 사람에게 끊긴 시각을 채우고, advance·handleHello 에서 resolveHost 를 적용. 옛 방장 복귀·유예 안 복귀·후보 없음→후보 연결 즉시 이양 시험.
- Task 2: pruneLobby(대기실만, 방장·봇 제외), leaveRoom 의 ended 분기(left 표시·방장 즉시 이양), advance 의 정리(월드 despawn·flush), handleLeave 의 ended 처리(소켓 4003 'left'). 게임 중·결과 단계 끊긴 사람은 안 지움.
- Task 3: SERVER_ONLY_KEYS 에 disconnectedAt·left, 이양·정리·결과 leave 를 거친 프레임 전수 단언, view 키 집합 불변 시험, Lobby 기록 칸 crown 줄(`CHAT_TEXT.hostChanged`).

## 시험

- 단위 continuity 27·gameRoom·tick·view, 워커 continuity 13·leak·reconnect·start·join·world·webSocketClose·alarm·bots·health, 클라이언트 lobby·chatText·roomDiff 통과.
- `npm run typecheck`: 이 계획 파일 오류 없음. 남은 오류는 병렬 계획(11-05 ResultScreen/world/resultDirector/costume, 시험 파일) 진행 중인 작업 몫이라 건드리지 않았다.
- 웨이브 게이트(build·전체 회귀·nightload·ui.safety-gate)는 지시대로 돌리지 않았다.

## Deviations from Plan

**1. [Rule 2 - 누락된 필수 동작] 결과 단계에서 나간(left) 사람의 hello 거절**
- 계획에 없었지만 left 토큰이 다시 붙으면 connected 인데 후보도 아닌 유령이 명단에 남는다. hello 가 `player.left === true` 를 invalid_token 으로 닫는다(지워진 사람과 같은 모습). 시험 있음. 파일: worker/room.ts.

**2. [설계 해석] resolveHost 가 left 방장도 다룬다**
- 결과 단계에서 후보가 없어 방장 자리를 못 넘긴 left 방장은 유예 없이, 후보가 연결되는 순간 넘어간다(알람은 걸지 않음).

**3. [설계 해석] 생성자의 끊긴 시각 채우기 범위**
- 계획은 "connected 를 거짓으로 고친 사람"이었으나, 소켓이 없는 모든 사람(HTTP 로만 참가해 한 번도 안 붙은 사람, 옛 저장 방 사람 포함)으로 넓혔다. 안 그러면 한 번도 접속 안 한 유령이 정리 대상이 되지 않는다.

**4. [시험 보정]** 워커 시험은 끊긴 지 4초(유예 3초 초과, 정리 6초 미만)로 맞춰 이양만 보게 했다. 정리와 함께 쓰면 이양 직후 옛 방장이 같은 호출에서 지워지는 것이 규칙대로의 동작이다.

## Known Stubs

없음.

## Threat Flags

없음 (새 입력 경로 없음 — disconnectedAt 은 소켓 이벤트로만 기록).

## 이월 메모

- `shared/game/continuity.ts` export: `HOST_GRACE_MS`(45s)·`HOST_GRACE_TEST_MS`(3s)·`LOBBY_PRUNE_MS`(180s)·`LOBBY_PRUNE_TEST_MS`(6s)·`hostGraceOf`·`pruneAfterOf`·`hostSuccessor(players, excludeId?)`·`resolveHost`·`pruneLobby(state, now) -> {state, removedIds}`·`nextContinuityAt`.
- `detachConnection(state, id, connId, now?)` — now 를 주면 `Player.disconnectedAt` 기록, `attachConnection` 이 키째 지운다. 둘 다 서버 전용(L43, leak 금지 키 `disconnectedAt`·`left`).
- 결과 단계 `leave` → 사람은 players 에 남고 `left:true`·`connected:false`·`connId:null`, 방장이면 즉시 이양, 소켓은 4003 'left'. left 토큰은 hello 에서 invalid_token. 11-08 rematch 는 left 와 끊긴 지 60초 넘은 사람을 제거하고, 쉬는 사람 정리는 같은 `LOBBY_PRUNE_MS`·`pruneAfterOf` 를 쓴다(`pruneLobby` 는 lobby 에서만 일하니 쉬는 사람용은 따로).
- 이양·정리는 worker `advance` 끝(tick 뒤)과 `handleHello` 에서만. 알람은 `nextWakeAt` 한 곳(방장 마감은 연결된 후보가 있을 때만).
- 결과 화면 [나가기]·새 방장 토스트(결과 단계)는 11-05·11-12 몫. 대기실 토스트·기록 줄은 이 계획에서 끝(`CHAT_TEXT.hostChanged`).
- 워커 시험에서 `endedGame4`/`startedGame` 을 쓰는 it 은 `{ timeout: 40_000 }` 이 필요하다(기본 5초로는 모자람). 정리/이양 시험은 `editRoom` 으로 disconnectedAt 을 과거로 옮긴 뒤 `runDurableObjectAlarm`.
- 병렬 작업 때문에 `npm run typecheck` 에 11-05(resultDirector·costume)·12-05 쪽 오류가 보인다 — 이 계획과 무관.

## Self-Check: PASSED

- 파일 존재: shared/game/continuity.ts, test/unit/continuity.test.ts, test/worker/continuity.test.ts 확인.
- 커밋 6개(fd0164a8, 950ad95c, d955941e, 4e75a8e0, a6e2cf76, 8c4d88e5) 존재, HEAD 의 조상.
