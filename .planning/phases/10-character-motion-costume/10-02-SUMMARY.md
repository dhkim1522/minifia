---
phase: 10-character-motion-costume
plan: "02"
subsystem: server-rules
tags: [outfit, look, protocol, leak-test, tdd]
status: complete
requires: ["10-01"]
provides:
  - "와이어 메시지 t:dress{look}, 공개 필드 PublicPlayer.look?"
  - "shared/protocol.ts: OUTFIT_IDS(9종)·OutfitId"
  - "shared/game/look.ts: DEFAULT_LOOK·LOOK_MIN_GAP_MS(250)·setLook"
  - "방 DO handleDress·applyDress (writeAt 키 dress:{id})"
  - "누설 시험 L25·L26 (test/worker/dress.test.ts)"
affects: [10-04, 10-07, 11]
tech-stack:
  added: []
  patterns:
    - "badge.ts 선례: 규칙 함수가 단계 -> 행위자 -> 값 -> 같은 값 순으로 검사, 같은 값은 입력 상태 그대로"
    - "버림(간격·로비 밖·규칙 거절)은 사람·역할과 무관하게 보낸 소켓에 자기 state 한 프레임"
key-files:
  created:
    - shared/game/look.ts
    - test/unit/look.test.ts
    - test/worker/dress.test.ts
  modified:
    - shared/protocol.ts
    - shared/schemas.ts
    - shared/game/room.ts
    - shared/game/view.ts
    - shared/game/testTools.ts
    - worker/room.ts
    - test/unit/schemas.test.ts
    - test/unit/view.test.ts
    - test/unit/testTools.test.ts
    - test/worker/leak.test.ts
key-decisions:
  - "look 은 사람이 고른 공개 값이다. look.ts 는 Player.role 을 읽지 않고(정적 시험) 역할에 따라 거절하지 않는다"
  - "누설 허용 경로는 .view.players[].look 하나만 늘었다(leak.test.ts ROLE_PATHS_ALIVE, view.test.ts ALLOWED_ROLE_VALUE_PATHS)"
requirements-completed: []
duration: ~25m
completed: 2026-11-05
commits: 7
plan_head_before: f9c8eef2bf84d98d7f331b77cb53926801a9f216
plan_head_after: f29b481ad30cda372d690518c3f49462af8999b3
actuals:
  tokens: 26000
  tasks: 3
  commits: 7
---

# Phase 10 Plan 02: 로비 의상 서버 Summary

대기실에서 `{t:"dress", look}` 한 메시지로 의상을 고르고, 서버가 역할과 무관한 공개 값으로 저장해 모든 소켓의 `players[].look` 에 같게 싣는다. 대기실 밖의 요청은 보낸 소켓에 자기 state 한 프레임만 돌려준다.

## 한 일

- Task 1 (트레이서): OUTFIT_IDS·와이어·스키마·Player.look·view 노출·`setLook`·방 DO 처리기. 손님 한 명의 선택이 세 소켓에 한 프레임씩, 다른 좌석 행에는 look 키 없음, 같은 값 재전송은 프레임 0.
- Task 2: 250ms 간격, 로비 밖 버림(보낸 소켓 state 한 프레임), 테스트 방 되돌리기(`resetToLobby`)·게임 시작 뒤 look 유지, 재접속 첫 state 에 look 포함, OUTFIT_IDS 와 클라이언트 OUTFITS 키 집합 일치, look.ts 소스에 `.role` 접근 없음.
- Task 3: 누설 L25(역할만 다른 두 판의 look 열 동일)·L26(게임 중 dress 응답이 신분과 무관)·전수. 허용 경로 `.view.players[].look` 추가.

## 시험

- `npx vitest run test/unit/look.test.ts test/unit/view.test.ts test/unit/testTools.test.ts test/unit/schemas.test.ts test/worker/dress.test.ts` 통과 (383)
- `npx vitest run test/worker/dress.test.ts test/worker/leak.test.ts test/unit/view.test.ts` 통과 (131)
- `npm run typecheck` 오류 없음 (병렬 실행 중인 10-03 쪽 변경과 겹친 구간 이후 재확인)
- 전체 회귀·nightload·build 는 지시에 따라 돌리지 않았다(웨이브 게이트는 오케스트레이터 몫).

## Deviations from Plan

None - plan executed exactly as written.

세부 메모(편차 아님):
- Task 1 GREEN 에서 `applyDress` 가 버림 경로의 state 응답까지 이미 갖췄다(Task 2 에서 붙이기로 한 부분). Task 2 의 워커 시험은 RED 없이 바로 통과했고, 실제 RED 는 `resetToLobby` 의 look 유지 시험 하나였다.
- `handleStart`(startGame)는 `...p` 로 플레이어를 확장해 look 이 떨어지지 않아 수정이 필요 없었다. 시험(dress.test.ts 게임 단계 view)이 이를 고정한다.
- 같은 값을 250ms 안에 다시 보내면 간격 검사가 먼저라 보낸 소켓에 state 한 프레임이 간다(다른 소켓은 0). 간격 밖의 같은 값은 프레임 0.

## Known Stubs

None.

## Threat Flags

None — 새 입력은 dress 하나이고 스키마 enum + setLook 값 검사 + 250ms 간격으로 막았다(T-10-06~09).

## 이월 메모

- 타입: `OUTFIT_IDS`·`OutfitId` 는 shared/protocol.ts (EMOTE_IDS 아래). 클라이언트 `src/world/characterData.ts` OUTFITS 와 키 집합이 같다(look.test.ts 가 고정). 순서는 coat 가 처음.
- 와이어: 보내기 `{t:"dress", look}` (스키마 `z.enum(OUTFIT_IDS)`), 받기는 `RoomView.players[].look?`.
- view 규칙: look 키는 값이 있을 때만(undefined 로 남기지 않음), 모든 단계·모든 viewer 에게 같다. 키가 없으면 클라이언트가 coat 로 읽는다. 서버가 기본값 coat 를 싣지 않는다.
- 거절 규칙: 간격 안·로비 밖·규칙 거절 모두 오류·chatReject 없이 보낸 소켓에만 자기 최신 `state` 한 프레임. 클라이언트는 낙관적 미리 보기 뒤 이 state 로 서버 값에 맞춘다.
- 유지: look 은 게임 시작·`resetToLobby` 뒤에도 남는다(다시 하기 11페이즈가 이어받음). 봇은 look 이 없어 coat.
- 규칙 함수: shared/game/look.ts `setLook`, 상수 `LOOK_MIN_GAP_MS`=250, `DEFAULT_LOOK`="coat". 방 DO 는 `dress:{id}` 키로 간격을 센다(인메모리, evict 되면 초기화).
- 시험 도우미는 helpers.ts 를 건드리지 않았다. dress.test.ts 안의 `lobby()`·`sendDress()`·`playDress()` 지역 함수를 참고할 것.
- 10-04(장면)는 players[].look 을 전 단계에서 읽어 같은 look 을 낮·밤·아침·처형에 입히면 된다.

## Self-Check: PASSED

- 생성 파일 3개(shared/game/look.ts, test/unit/look.test.ts, test/worker/dress.test.ts) 존재 확인.
- 커밋 61b9464·d07ab2b·9797388·427fd7f·4eb148f·0b5b691·f29b481 이 HEAD 의 조상임을 확인.
