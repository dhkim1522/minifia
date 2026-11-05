---
phase: 11-result-rematch
plan: "08"
subsystem: shared-game / worker-room
tags: [rematch, bench, ready, sat, leak-L38, leak-L39, leak-L40, leak-L41, leak-L44, tdd]
requires: ["11-01", "11-04", "11-06"]
provides:
  - "ready{on,round}·rematch{round} 와이어, view players[].ready/sat·view.resting (shared/protocol.ts, schemas.ts)"
  - "isReady·setReady·rematch·leaveBench·findAnyByToken·seatBench 등 (shared/game/rematch.ts), beginGame (room.ts)"
  - "쉬는 사람(RoomState.bench) 분리·전용 view·소켓 문·ended 합류(sat)·정리(pruneBench)"
affects: [11-12, 11-13, 11-14]
tech-stack:
  added: []
  patterns: ["허용 목록 키 배열에서 키 하나씩 복사(펼쳐 복사 금지)", "쉬는 사람은 참가자 목록 밖 bench + 소켓 문(ping·leave 만)", "거절은 사유와 무관하게 보낸 소켓 state 한 프레임"]
key-files:
  created:
    - shared/game/rematch.ts
    - test/unit/rematch.test.ts
    - test/worker/rematch.test.ts
    - test/worker/bench.test.ts
  modified:
    - shared/protocol.ts
    - shared/schemas.ts
    - shared/game/room.ts
    - shared/game/view.ts
    - shared/game/endgame.ts
    - shared/game/continuity.ts
    - shared/game/look.ts
    - shared/game/testTools.ts
    - worker/room.ts
    - test/unit/schemas.test.ts
    - test/unit/view.test.ts
    - test/unit/continuity.test.ts
    - test/unit/endgame.test.ts
    - test/unit/awards.test.ts
    - test/unit/look.test.ts
    - test/unit/testTools.test.ts
    - test/worker/helpers.ts
    - test/worker/dress.test.ts
    - test/worker/leak.test.ts
decisions:
  - "rematch 의 참가자 판정에서 방장은 연결 여부와 무관하게 늘 참가자다 — 방장이 bench 로 가면 hostId 가 쉬는 사람을 가리키는 것을 막는다"
  - "쉬는 사람의 hello·끊김·정리는 방송하지 않고 room 키만 저장한다 — 다른 사람 view 가 바뀌지 않기 때문이다(프레임 0 단언 가능)"
  - "bench 정리(pruneBench)는 단계와 무관하게 알람이 한다. 생성자는 bench 의 connected 만 보정하고 정리는 하지 않는다"
  - "같은 값 ready 는 프레임 0, 거절은 state 한 프레임 — 쉬는 사람의 모든 메시지는 프레임 0(자기 소켓이 쉬는 사람임은 스스로 안다)"
metrics:
  duration: "약 2시간"
  completed: "2026-11-05"
status: complete
actuals:
  tokens: 24400
  tasks: 3
  commits: 6
plan_head_before: 9691be3b571319871749b0b66cf473e4a40ac77f
plan_head_after: f12a3cefa08c5077f3e240a5c4dbb4658a30730a
---

# Phase 11 Plan 08: 다시 하기 서버 쪽 Summary

같은 방에서 결과 단계를 지나 새 판으로 가는 서버 규칙(ready·rematch), 허용 목록 리터럴로 이전 판 흔적을 구조적으로 없애는 `rematch`, 준비하지 않은 사람을 게임 코드 밖에 두는 bench(쉬는 사람)와 ended 합류(sat), 결과 단계 의상까지 세웠다.

`commits: 6` 은 이 계획이 만든 커밋 수다. 같은 작업 트리에서 11-07·11-09·11-10 이 병렬로 커밋해 `plan_head_before..plan_head_after` 범위의 `rev-list` 수(26)에는 그 커밋들이 섞여 있다.

## 한 일

- **Task 1 (트레이서)**: `ready{on,round}`·`rematch{round}`(strictObject, round 1 이상 정수), `Player.ready/sat`, `RoomState.bench`, `PublicPlayer.ready/sat`·`RoomView.resting`. `startGame` 본체를 `beginGame` 으로 분리(호출·난수 순서 불변). `shared/game/rematch.ts`: `isReady`·`setReady`·`rematch`. 새 방은 `REMATCH_ROOM_KEYS`·`REMATCH_PLAYER_KEYS` 두 키 배열에서 키 하나씩 복사해 만든다(round+1, 만료 min(생성+12h, now+3h)). 방 DO `handleReady`·`handleRematch`: 방 교체 → 채팅 저장 키 전부 삭제 → 메모리 사본·ghostSnapped·writeAt 비움 → `respawnAll` → 방송 → `snapEachViewer` → 알람 → 월드 저장. 결과 단계에서 끊기면 `ready` 가 풀린다.
- **Task 2**: rematch 가 준비 안 한 연결자·60초 미만 끊김을 bench 로, `left`·60초 이상 끊김을 제거(경계 59_999/60_000 시험). `buildView` 맨 앞의 쉬는 사람 분기(허용 키만 하나씩 씀). `enterEnded` 는 승패를 합류 전에 판정한 뒤 `seatBench`(sat:true, 역할·ready 없음). 방 DO: 쉬는 사람 소켓은 ping·leave 외 응답 없이 버림, hello·끊김은 방송 없이 bench 행만 저장, `persistAndBroadcast({ includeBench: true })` 는 rematch 한 번뿐. `pruneBench`+`nextContinuityAt` 합류, `setLook` 문 lobby+ended, `resetToLobby` 가 bench 를 합류.
- **Task 3**: 누설 L38(쉬는 사람 소켓 열 + 참가자 소켓에 쉬는 사람 존재 0), L39(1판 canary → 2·3판, 저장 키 집합·chat 키 포함, 쉬었던 사람이 sat 로 합류했다 준비해 3판), L40(거절 열 동일 응답), L41(이전 round chat·typing·emote·ready·rematch 폐기), L44(새 공개 경로 값이 신분과 무관). 제품 결함은 나오지 않아 Task 3 에서 고친 제품 파일은 없다. 펼쳐 복사로 바꾸는 mutation 이 L39 시험에서 즉시 실패함을 확인한 뒤 되돌렸다.

## 시험

- 단위: `rematch`(21), `schemas`·`view`·`continuity`·`endgame`·`awards`·`look`·`testTools` 추가분 통과. `npx vitest run test/unit` 3705 통과, 1 실패(아래 기존 실패).
- 워커: `rematch`(7)·`bench`(7)·`dress`·`leak`(16) 통과. 인접 `continuity`·`endedChat`·`endgame`·`testTools`·`resultLog`·`mapPick`·`reconnect` 통과(부하 때 `continuity` 1건·`testTools` 'ended' 1건이 5초 한도로 흔들렸고 단독 재실행에서 통과).
- 타입: `tsc -p tsconfig.worker.json` 오류 없음. `tsconfig.app.json` 의 오류는 병렬 11-07·11-09 의 진행 중 파일(`awardPlate`·`awardText`·`resultDirector`·`RESULT_TABS` 등)이며 이 계획과 무관하다.
- 하지 않은 것(지시): 전체 회귀·nightload·웨이브 게이트·빌드.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - 기존 시험의 허용 경로 갱신] 새 공개 키가 기존 모양 단언을 깼다**
- **Found during:** Task 1·3
- **Issue:** `players[]` 키 모양을 고정한 기존 단언(`view.test` 전수 누출 검사, `leak.test` 낮 처형·연속성 두 곳)이 결과 단계 방장 줄의 `ready` 에서 실패했고, `look.test` 는 ended 를 WRONG_PHASE 로 못 박고 있었다(D-16 으로 열림).
- **Fix:** 허용 경로에 `ready`(결과 단계 방장 줄)·`sat` 만 더했다. 허용 목록을 넓히는 대신 "어느 소켓이 보든 값이 같다"를 L44 시험이 따로 단언한다.
- **Files modified:** test/unit/view.test.ts, test/unit/look.test.ts, test/worker/leak.test.ts
- **Commit:** 3d5cc072, dc55642c, f12a3cef

**2. [Rule 3 - 시험 도우미] richEndedGame6 에 선택 인자와 공용 도우미 추가**
- **Issue:** L39 는 유언·동작이 있는 판이 필요한데 기존 도우미는 없었고, `RICH_TEXT` 에 넣으면 resultLog 시험이 "모든 값이 공개된다"고 단언해 깨진다.
- **Fix:** `richEndedGame6({ extras })`·`RICH_EXTRA`(기본 동작 불변), `readyUp`, `toEndedByMafia` 를 helpers 에 올렸다.
- **Files modified:** test/worker/helpers.ts
- **Commit:** f12a3cef

### 기존 실패 (이 계획 밖)

- `test/unit/nyquist-02-phase-matrix.test.ts` "ended: 받는 사람 집합은 … 비어 있다": 11-03 이 `audience` 의 ended chat 을 연 뒤부터 실패한다(`shared/game/audience.ts` 는 이 계획이 건드리지 않았다). 11-03 의 시험 갱신 누락으로 보인다.

## Known Stubs

없음.

## Threat Flags

없음 — 새 표면은 계획의 위협 모델(T-11-25~30)이 다룬 쉬는 사람 소켓·ready/rematch 처리기뿐이다.

## 남은 위험 (Deferred)

- `resetToLobby`(테스트 되돌리기)의 허용 목록 리터럴에 `round` 가 없어 되돌린 방의 판 번호가 1 로 돌아간다(이전부터의 동작). 테스트 방에서만 닿는다.
- `webSocketMessage` 의 JSON 파싱·스키마 오류는 쉬는 사람 문보다 앞이라 쉬는 사람도 BAD_MESSAGE 를 받을 수 있다(형식 오류는 상태·신분과 무관한 응답이다).

## 이월 메모

- 와이어: `{t:"ready", on, round}`(손님만, 방장·봇은 늘 준비)·`{t:"rematch", round}`(방장만). 모든 거절은 오류 없이 보낸 소켓 state 한 프레임(같은 값 ready 는 0프레임, 쉬는 사람은 늘 0프레임). `round` 는 `view.round`.
- view 키: `players[].ready`(결과 단계·연결·준비, 방장·봇 포함)·`players[].sat`·`view.resting`(쉬는 사람 본인 view 에만 — players 는 자기 한 줄, `me:{seat,isHost:false}`, 마감 null, `phase`·`round`·`map?`·`mapChoice` 는 공개 값). 참가자 수 = `players.filter(ready && connected).length`(≥4 면 [다시 하기] 활성).
- 쉬는 사람 화면(BenchView): `resting` state 를 받은 뒤 ended 진입 전까지 갱신이 없다(`phase` 는 낡을 수 있어 `resting` 만 본다). ended 에 들면 일반 state(`sat:true`, `me.role` 없음)와 resultLog 가 온다. 새 hello 는 늘 resting state 한 개(월드·chatLog 없음).
- `shared/game/rematch.ts`: `isReady`·`setReady`·`rematch`(→`{ok,state,removedIds}`)·`leaveBench`·`findAnyByToken`·`isResting`·`attachBenchConnection`·`detachBenchConnection`·`seatBench`·`benchAsPlayers`·`REMATCH_STALE_MS`(60초)·`REMATCH_MAX_AGE_MS`. `room.ts` 의 `beginGame` 은 startGame 과 공유.
- 방 DO: 쉬는 사람 소켓은 ping·leave 외 무응답(leave → bench 에서 빼고 4003 'left'). `persistAndBroadcast({ includeBench: true })` 는 rematch 한 번만. rematch 후처리 = 채팅 키 삭제 → `respawnAll` → 방송 → `snapEachViewer`(`decideMap(mapChoice ?? "random")` 는 `beginGame` 안).
- 결과 단계 의상(`dress`)은 참가자·sat 모두 가능, 쉬는 사람은 무시. 의상은 rematch 뒤에도 남는다. 쉬는 사람 정리는 `pruneBench`(LOBBY_PRUNE_MS, 테스트 방 6초), 단계 무관.
- 새 공개 경로(허용 추가분): `.view.players[].ready`·`.view.players[].sat`·`.view.resting`(`.view.round` 는 11-01). 값은 신분과 무관(L44).
- 시험 도우미: `readyUp`·`toEndedByMafia`·`richEndedGame6({ extras })`·`RICH_EXTRA`(helpers.ts). 부하 때 흔들리는 시험은 `{ timeout: 40_000 }` 이상을 준다.

## Self-Check: PASSED

- 파일 존재: shared/game/rematch.ts, test/unit/rematch.test.ts, test/worker/rematch.test.ts, test/worker/bench.test.ts 확인.
- 커밋 존재: 5aa5656b, 3d5cc072, 4d4500df, 9a5ae6e2, dc55642c, f12a3cef 모두 HEAD 의 조상.
