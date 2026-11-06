---
phase: 12-sound-polish
plan: "04"
subsystem: chat-world-review-cleanup
tags: [tdd, review-cleanup, chat-replay, move-ack, lobby]
requires: ["12-01"]
provides:
  - "OwnMoves.expire() => { cleared, silent } (GR-WR-01)"
  - "chatLog.clearSeat + worker vacateSeats (WR-01 서버)"
  - "useChat 줄 이름 고정 (WR-01 클라이언트)"
affects: [src/world, src/screens/Lobby.tsx, src/net/useChat.ts, shared/game/chatLog.ts, worker/room.ts]
key-files:
  modified:
    - src/world/motion.ts
    - src/world/runtime.ts
    - src/screens/Lobby.tsx
    - src/net/useChat.ts
    - shared/game/chatLog.ts
    - worker/room.ts
    - test/unit/motion.test.ts
    - test/unit/chatLog.test.ts
    - test/client/worldStage.test.tsx
    - test/client/lobby.test.tsx
    - test/client/useChat.test.tsx
    - test/worker/chatReplay.test.ts
    - .planning/phases/07-free-chat/07-REVIEW-DISPOSITION.md
    - .planning/phases/08-day-execution-ghost/08-REVIEW-DISPOSITION.md
decisions:
  - "좌석이 비는 경로는 worker/room.ts vacateSeats 한 곳으로 모으고 before/after 사람 id 차이로 좌석을 찾는다"
  - "줄 이름은 줄 키별로 처음 알던 이름을 붙들고, 이름을 못 본 줄은 고정하지 않는다"
status: complete
commits: 7
plan_head_before: 2bd5d1f81b9fad4af2cc95f30ac79399c52ba83d
plan_head_after: 9b064c0d27c6f61fc27e543518478c584f4b60f2
actuals:
  tokens: 10300
  tasks: 3
  commits: 7
---

# Phase 12 Plan 04: 7·8페이즈 리뷰 열린 항목 닫기 Summary

7페이즈 열린 경고 셋(GR-WR-01 거짓 네트워크 알림, WR-02 로비 시스템 줄 시각, WR-01 좌석 재사용 복원·이름)을 TDD 로 고치고, 8페이즈 Info 일곱을 항목별 근거와 함께 수용으로 닫았다.

`plan_head_before` 는 병렬 실행기(12-11)의 커밋 둘이 사이에 끼어 있어 `rev-list` 수가 9 이고, 이 계획의 커밋은 7개다.

## 한 일

- **GR-WR-01**: `createOwnMoves` 가 마지막 보냄 이후 응답을 들었는지(`heardSinceSent`) 기억하고 `expire()` 가 `{ cleared, silent }` 를 돌려준다. `runtime.ts` 의 응답 없음 시계 콜백이 만료 전에 `observeOwnMove` 를 한 번 더 부르고(숨은 탭), `silent` 면 링만 거두고 NETWORK_TEXT 알림을 띄우지 않는다. 프레임 루프의 관찰 코드는 같은 함수 `observeOwnMove` 로 합쳤다. `expire` 호출부는 `runtime.ts` 한 곳이었다.
- **WR-02**: `Lobby.tsx` 입장·퇴장·방장 변경 시스템 줄의 `at` 이 `Date.now() + offsetRef.current` 다. 효과 의존성은 그대로다.
- **WR-01 서버**: `clearSeat(log, seat)` 순수 함수(입력 불변, 바뀐 레코드만 반환, 변화 없으면 같은 log). `worker/room.ts` 의 `vacateSeats(before, after)` 가 사라진 사람의 좌석 비트를 지우고 바뀐 레코드만 128개씩 `storage.put` 한다.
  - 좌석이 비는 경로 점검(`git grep lowestFreeSeat -- shared worker` 는 입장 쪽 `room.ts:291`, `testTools.ts:279` 둘이고, 사람을 걸러내는 쪽은 `room.ts` leaveRoom·kickPlayer, `testTools.ts` setBotCount, `continuity.ts` pruneLobby): `handleLeave`·`handleKick`·`handleTestBots`·`advance`(두 분기)가 모두 `vacateSeats` 를 지난다. `rematch`·`resetToLobby` 는 채팅 키를 통째로 지우므로 대상이 아니다. 결과 단계 나가기는 `left` 표시만 하고 사람을 지우지 않는다. `pruneBench` 는 쉬는 사람만 지우고 그들은 보관 줄 수신자가 아니다.
- **WR-01 클라이언트**: `useChat` 이 줄 키별로 처음 알던 이름을 붙들어(player 줄, 유언 카드 제목) 같은 좌석의 새 사람 이름으로 덮어쓰지 않는다. 이름을 한 번도 못 본 좌석은 빈 이름 규칙 그대로이고 알려지면 채워 고정한다. `me` 는 원래 `mySeat` 기준이라 바뀐 것이 없다.
- **처분표**: 07 의 WR-01·WR-02·GR-WR-01 `resolved (12-04)`(Info 행은 그대로). 08 의 Info 일곱은 `skipped` + `수용(D-28, 12-04): …` 근거, 머리 `open: 0`.

## 시험

- RED 3회(`c73d3e0b`, `ed56c5e1`, `7f75b101`)가 먼저 실패함을 확인한 뒤 GREEN.
- 통과: `motion`, `chatLog`, `worldStage`, `lobby`, `useChat`, `chatPanel`, `chatReplay`, `chatLeak`, `chat` — 9 파일 614 시험.
- 새 시험: motion 단위 4(expire 모양 포함), worldStage 2(둘째 탭 버려짐·숨은 탭), lobby 1(offset 5000 정렬), chatLog 6(clearSeat), chatReplay 워커 5(나가기·퇴거 후 저장 확인·내보내기·봇 줄이기·자동 정리), useChat 3.
- `tsc -p tsconfig.worker.json` 오류 없음. `tsc -p tsconfig.app.json` 의 `test/unit/soundResult.test.ts` 오류 4건은 병렬 실행기(12-11)의 작업 중 파일이다.
- 누설 시험(`leak.test.ts`, `chatLeak.test.ts`)은 수정하지 않았고 허용 목록·행렬은 넓어지지 않았다.

## Deviations from Plan

**1. [Rule 1 - 시험 가정 수정] 내보내기 시험은 끊긴 사람만 내보낼 수 있다**
- **Found during:** Task 2 RED
- **Issue:** 연결된 사람을 `kick` 하면 `CANNOT_KICK` 이라 시험이 5초 시간 초과였다.
- **Fix:** 손님 소켓을 먼저 닫아 `connected:false` 를 본 뒤 `kick` 하도록 시험을 고쳤다. 코드 변경 없음.

**2. [범위 안 정리] 프레임 루프의 관찰 코드를 `observeOwnMove` 로 뽑았다**
- 타이머 콜백이 같은 처리(응답 시 링 ack·reset 시 링 거둠)를 해야 해서 중복 대신 함수로 합쳤다. 동작 변화 없음.

Auth gate·아키텍처 변경 없음. 08 Info 는 코드를 고치지 않았다.

## Known Stubs

없음.

## Threat Flags

없음. 새 엔드포인트·프레임·와이어 모양 변화 없음(T-12-11·12·13·14 mitigate 적용).

## 이월 메모

- 12-12: 결정 0070 에 옮길 닫은 처분 수 — 7페이즈 경고 3건 수정(GR-WR-01·WR-02·WR-01), 8페이즈 Info 7건 수용(IN-06·IN-07·IN-01~IN-05, 각 근거는 08-REVIEW-DISPOSITION.md Source 칸).
- 07 처분표의 Info 행(IN-01~07, GR-IN-01~05)은 건드리지 않았다(`open`/기록만 그대로). 08 Info 중 IN-06(summaryLines)·IN-01(주석)은 이미 사라져서 닫았다.
- `OwnMoves.expire()` 의 반환이 boolean 에서 `{ cleared, silent }` 로 바뀌었다. 호출부는 `runtime.ts` 하나였고 단위 시험을 맞췄다.
- 좌석 비움 경로를 새로 만드는 사람은 `worker/room.ts` `vacateSeats(before, after)` 를 지나야 한다(복원이 보낼 때 수신자보다 넓어지지 않는 불변식).
- `useChat` 의 `lineNames` 는 줄 키 기준이라 저장소 reset 후에도 남는다(키에 시각 `at` 이 들어 있어 충돌 가능성은 낮다). 문제가 되면 reset 에서 비우면 된다.
- 웨이브 게이트(전체 vitest·빌드·safety/schema-drift)는 이 실행기에서 돌리지 않았다.

## Self-Check: PASSED

- 파일: shared/game/chatLog.ts(`clearSeat`), worker/room.ts(`vacateSeats`), 두 처분표, 이 SUMMARY 존재 확인.
- 커밋 7개(c73d3e0b, cce55fa6, ed56c5e1, 04a72737, 7f75b101, 28fb54bf, 9b064c0d) 모두 HEAD 의 조상이다.
