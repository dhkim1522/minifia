---
phase: 10-character-motion-costume
plan: "01"
subsystem: server-rules
tags: [emote, protocol, audience, leak-test, tdd]
status: complete
requires: []
provides:
  - "와이어 메시지 t:emote{id,pk}, 서버 프레임 EmoteFrame{t,seat,id,n}"
  - "shared/game/emote.ts: EMOTE_MS·EMOTE_MIN_GAP_MS·EMOTE_BURST_WINDOW_MS·EMOTE_BURST_MAX·EmoteSenderState·emoteGate"
  - "방 DO handleEmote·applyEmote, 인메모리 emoteRates·emoteSeq(채널별 n)"
  - "누설 시험 L27~L30 (test/worker/emoteLeak.test.ts)"
affects: [10-02, 10-03, 10-05]
tech-stack:
  added: []
  patterns:
    - "연타 규칙은 순수 함수 emoteGate(prev, id, now), DO 는 수락 때만 기록 갱신"
    - "버림에는 프레임 없음 — 오류·chatReject·state 재전송 모두 금지(오라클 방지)"
key-files:
  created:
    - shared/game/emote.ts
    - test/unit/emote.test.ts
    - test/worker/emote.test.ts
    - test/worker/emoteLeak.test.ts
  modified:
    - shared/protocol.ts
    - shared/schemas.ts
    - worker/room.ts
    - test/unit/schemas.test.ts
    - test/worker/helpers.ts
decisions:
  - "동작 프레임의 n 은 채널(all·mafia·ghost)별로 센다 — UI-SPEC A-3 의 '방 전체' 문구에서 의도적으로 벗어남(결정 0068 기록 대상)"
metrics:
  duration: "약 25분"
  completed: "2026-11-05"
actuals:
  tokens: 9800
  tasks: 3
  commits: 5
plan_head_before: 4b58fbe9b6bbb4567d0ea1da966301dd32803d04
plan_head_after: 03d00d892be5fc451b87c1befe2428fa8349a519
---

# Phase 10 Plan 01: 동작(몸짓) 서버 쪽 Summary

동작 하나가 서버 권위로 채널별 수신자에게만 `{t:"emote",seat,id,n}` 한 프레임씩 가고, 버려진 동작에는 어떤 프레임도 없다. 채널은 보낸 사람 상태(channelOf), 수신자는 audience 한 곳, 연타는 순수 함수 emoteGate 가 정한다.

## 한 일

- Task 1 (트레이서): `ClientMessage` 에 `emote`, `EmoteFrame` 을 `ServerMessage` 에 추가, `EmoteMessageSchema`(strictObject, id enum + pk), `EMOTE_MS`, 방 DO 의 `handleEmote`→`applyEmote`(pk → channelOf → audience → deliver). 로비 세 소켓에 정확히 한 프레임.
- Task 2: `emoteGate`(앞 동작 진행 중 → 최소 1000ms → 10초 5번), 걷는 중 버림(`segmentEndsAt(seg) > now`), 받아들여진 `applyMove` 가 `emoteRates` 를 지움, `dropChat` 이 `dropEmote` 로 기록·번호를 비움. 재접속 무재생·저장소 무흔적은 새 코드 없이 시험으로 고정.
- Task 3: 누설 시험 L27~L30 (신분 행렬, 단계 키, 신분별 버림, 채널별 n, 봇 비참여). 수신자를 방 전체로 바꾸는 변이와 번호를 전역으로 세는 변이를 넣어 시험이 실패함을 확인한 뒤 되돌렸다.

## 검증

- `npx vitest run test/worker/emoteLeak.test.ts test/worker/emote.test.ts test/unit/emote.test.ts test/unit/schemas.test.ts test/worker/world.test.ts test/worker/chatLeak.test.ts` → 6 파일 215 통과
- `npm run typecheck` → 오류 없음
- 계획의 웨이브 게이트(`npm run build && npx vitest run` 전체, ui.safety-gate, schema-drift)는 실행자 지시(전체 회귀·부하 시험 생략)에 따라 돌리지 않았다. 호출자(오케스트레이터)가 웨이브 끝에 돌린다.

## Deviations from Plan

None - plan executed exactly as written. (세부: Task 1 의 앱 쪽 소비처 컴파일 오류는 생기지 않아 최소 분기를 더하지 않았다. `test/worker/helpers.ts` 의 `observe` 는 이미 내보내져 있어 지역 정의 대신 가져다 썼다. 허용 목록 leak.test.ts 는 넓히지 않았다.)

## Known Stubs

없음.

## Threat Flags

없음. 새 네트워크 표면은 계획의 위협 표(T-10-01~05)가 다룬 `emote` 메시지 하나뿐이다.

## 이월 메모

- 타입: `EmoteSendMessage`·`EmoteFrame{t,seat,id,n}` 는 shared/protocol.ts (`EmoteId`·`EMOTE_IDS` 는 기존 위치). 스키마는 shared/schemas.ts 의 `EmoteMessageSchema`.
- 규칙: `EMOTE_MS`·`emoteGate`·`EMOTE_MIN_GAP_MS`(1000)·`EMOTE_BURST_WINDOW_MS`(10000)·`EMOTE_BURST_MAX`(5) 는 shared/game/emote.ts. EMOTE_MS 가 EMOTES 표와 어긋나면 test/unit/emote.test.ts 가 잡는다.
- 처리기: worker/room.ts `handleEmote`→`applyEmote(playerId,id,pk,now)`; 인메모리 `emoteRates`(Map)·`emoteSeq`(all·mafia·ghost). 서버 봇은 동작하지 않는다(O-7).
- 채널별 n(결정 0068 기록 대상): n 은 채널마다 1 부터 따로 센다. 클라이언트는 n 이 아니라 "받은 프레임 순서"로 재생하고, 같은 seat 의 새 프레임이 오면 앞 재생을 대체해도 된다. n 틈으로 무엇도 추정하지 않는다.
- 버림은 침묵이다: 보낸 소켓에도 오류·chatReject·state 가 없다. 클라이언트는 낙관적 재생 없이 서버 프레임으로만 재생한다(D-9). 걷는 중·앞 동작 진행 중에는 버려지므로 UI 는 비활성 표시를 스스로 정한다.
- 시험 도우미(test/worker/helpers.ts): `emoteSend(sock,id,pk?)`·`emotesOf(msgs)`·`resetEmoteRates(code)`·`emoteRateKeys(code)`. 낮 시작 직후에는 배치 걷기로 동작이 버려지니 시험은 약 1.5초 쉰 뒤 보낸다.

## Self-Check: PASSED

- 생성 파일 4개(shared/game/emote.ts, test/unit/emote.test.ts, test/worker/emote.test.ts, test/worker/emoteLeak.test.ts) 존재 확인.
- 커밋 f086bd6·4b6d21a·884d2c7·c3130d1·03d00d8 가 HEAD 의 조상임을 확인.
