---
phase: 09-night-morning
plan: "24"
subsystem: worker-night-bots
tags: [gap-closure, night-leak, alarm-catchup, bot-typing, bot-nickname, test-room]
status: complete

requires:
  - phase: 09-night-morning
    provides: syncHome·afterTransition·worldVisibleTo(09-09), 봇 계획(09-12), 누설 메타모픽 시험(09-16)
provides:
  - syncHome 알람 따라잡기 되돌림(밤 키가 남은 채 지도 단계에 들어오면 teleportHome + 보는 사람별 snap 한 번) + snapEachViewer 공용 전송 본체
  - 봇 typing 행동(채팅 줄 BOT_TYPING_LEAD_MS 앞) + relayTyping 중계 본체(사람 typing 과 공유)
  - setBotCount 의 1~8자 무작위 이름(첫 봇만 8자) + graphemePrefix
affects: [09-30 결정 기록(0052-3 개정), 09-25~09-29]

requirements-completed: []

gap_closure: [review-WR-01, feedback-1, feedback-10]

actuals:
  tokens: 10100
  tasks: 3
  commits: 6
plan_head_before: ceed89791efff123bae898944053b1c0e7a0a365
plan_head_after: 67aa1bebb4afcb9d71ce63e165a575ee3069a31b

key-files:
  created:
    - test/worker/nightCatchup.test.ts
    - test/worker/botTyping.test.ts
    - test/client/typingBubble.test.tsx
  modified:
    - worker/room.ts
    - shared/game/bots.ts
    - shared/game/testTools.ts
    - shared/nickname.ts
    - test/unit/bots.test.ts
    - test/unit/testTools.test.ts
    - test/unit/nickname.test.ts
    - scripts/uat-test-bots.mjs

key-decisions:
  - "WR-01: syncHome 이 lay.key 가 ':night' 로 끝난 채 지도 단계(night·morning 아님)에 들어오면 아침 경로와 같이 되돌리고, 키를 ':morning' 으로 바꿔 멱등으로 둔다. 전송은 새 길 없이 snapEachViewer(보는 사람별 worldVisibleTo + deliver)로 뽑아 두 경로가 함께 쓴다."
  - "feedback-1: 사람 경로(typing 메시지 → 알약)는 처음부터 정상이었다. 원인은 봇이 입력 중 신호 없이 채팅 줄만 보낸 것이다. 봇은 서버 안에서 relayTyping(사람과 같은 channelOf·typingRelay·audience)을 지난다. 새 클라이언트 → 서버 메시지는 없다."
  - "feedback-10: 첫 봇(봇 0명일 때 더해지는 봇)은 8자 그대로, 나머지는 1 + randInt(8) 자. 이름은 방에 없는 기본 이름 중 첫 것의 앞부분이고 겹치면 길이를 늘리며 8자까지 겹치면 그 기본 이름은 건너뛴다."

metrics:
  duration: "약 50분"
  completed: 2026-11-04
---

# Phase 9 Plan 24: 알람 따라잡기 누설·봇 입력 중·봇 이름 길이 Summary

알람이 아침 길이 이상 늦어도 마피아의 밤 위치가 낮에 남지 않게 닫고, 봇이 채팅 줄 직전에 같은 채널로 입력 중 신호를 켜게 하고, 테스트 봇 이름 길이를 1~8자 무작위(첫 봇만 8자)로 바꿨다.

## 한 일

1. **WR-01 (T-09-49)**: `syncHome` 맨 앞에 "건너뛴 아침" 분기를 더했다. 밤 키가 남은 채 지도 단계로 들어오면 산 사람(+ 그 밤 피해자)을 home 으로 되돌리고, 키를 `{일차}:morning` 으로 두고, 산 사람 소켓마다 `worldVisibleTo` 로 거른 snap 을 한 번 보낸다. 전송 블록은 `snapEachViewer` 로 뽑아 정상 아침 경로와 함께 쓴다. 새 시험 `nightCatchup.test.ts` 3건(피해자 없음·있음·멱등)이 이 경로를 재현한다. `nightLeak` 메타모픽·직접 불변식 시험은 고치지 않고 그대로 초록이다.
2. **feedback-1 (T-09-50·51)**: `BotAct` 에 `typing` 을 더하고 채팅 세 곳(토론 두 줄·밤 마피아 한 줄·변론 후보 한 줄) 앞에 `max(now, 줄 시각 − 1500ms)` 의 typing 단계를 둔다. 난수 호출은 늘지 않아 시드 고정 값(`34804349,554531902`)은 그대로다. 짝 chat 이 마감 여유로 버려지면 typing 도 버린다. 방 DO 는 `handleTyping` 본체를 `relayTyping` 으로 뽑아 사람 메시지와 봇 행동이 함께 쓴다. 유언·쪽지 행동에는 typing 을 붙이지 않는다(WILL-01). 밤 마피아 봇의 typing 은 산 마피아·유령에게만 가고 산 시민 편 소켓은 typing 0개임을 워커 시험이 고정한다.
3. **feedback-10 (T-09-52)**: `setBotCount` 가 다섯째 인자 `randInt` 를 받는다(방 DO 는 `cryptoRandInt`). `graphemePrefix` 를 `shared/nickname.ts` 에 추가했다. `scripts/uat-test-bots.mjs` 의 닉네임 검사는 "고정 목록 이름의 앞부분"으로 바꿨다.

## feedback-1 진단 (SUMMARY 요구 사항)

게임 맵에서 서버 `typing` 프레임 → `typingSeats` → 알약 경로의 회귀 시험(`typingBubble.test.tsx`, 낮 토론·밤 마피아·off)은 **처음부터 초록**이었다. 클라이언트 쪽 사람 경로(07-10·07-18)는 정상이고, 사용자 테스트가 봇 방이라 봇이 typing 을 보내지 않은 것이 원인이다.

## 검증

- 대상 시험(nightCatchup·botTyping·nightLeak·chatLeak·ghostLeak·bots·testTools·typingBubble) 8파일 208건 통과. 추가로 world·morningCards·night·chat·nickname 통과.
- `npm run typecheck` 오류 없음.
- RED 확인: botTyping 3건·bots 단위 5건은 구현을 되돌린 상태에서 실패함을 확인했다(nightCatchup 3건은 RED 커밋 시점에 실패 확인).
- `test/worker/bots.test.ts` 는 전체 병렬 실행에서 서로 다른 한 건씩 한 번 실패했다가 단독 3회 연속 통과(알려진 불안정, 이 계획과 무관).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `shared/nickname.ts` 에 `graphemePrefix` 추가**
- **Found during:** Task 3
- **Issue:** 그래핌 단위 자르기 도우미가 없어(`Intl.Segmenter` 는 그 파일 안에서만 쓰임) 계획의 "도우미가 있으면 그것을, 없으면 같은 방식으로" 중 후자를 그 파일에 두는 것이 가장 단순했다.
- **Files modified:** shared/nickname.ts, test/unit/nickname.test.ts
- **Commit:** 67aa1be

**2. [계획 보충] 기존 시험의 기대 갱신**
- bots.test.ts 의 planBotSteps 결과를 보는 시험(typing 단계 허용), 고정 값 시험(typing 걸러냄), defense 시험(`typing,chat` 두 행), 이름 시험(첫 봇 8자 + 앞부분)을 고쳤다. chat·pick·point·verdict 단계의 시각·문구 값은 바꾸지 않았다.

### 순서 편차 (TDD)

Task 2 는 구현을 먼저 쓴 뒤 시험을 쓰고, 구현 파일을 되돌려 시험이 실패함을 확인한 다음 RED 커밋(시험)을 구현 커밋보다 앞에 두었다. Task 3 의 RED 커밋도 같은 방식이다.

## Known Stubs

없음.

## Threat Flags

없음(새 네트워크 경로·메시지·스키마 없음. `shared/protocol.ts`·`shared/schemas.ts` 변경 0줄).

## 이월 메모

- 09-30 결정 기록: 결정 0052-3 개정("봇 이름 8자 고정" → "첫 봇만 8자, 나머지 1~8자 무작위")을 적을 것.
- `scripts/bots.mjs` 의 NAMES(별도 CLI)는 8자 고정 그대로 둔다(서버 setBotCount 와 무관, 이름 일치 시험 유지).
- E2E·실기기 이름표 시험은 이제 봇 이름이 짧을 수 있다(첫 봇 `봇가나다라마바사` 8자는 유지).

## Self-Check: PASSED

- 파일: nightCatchup.test.ts·botTyping.test.ts·typingBubble.test.tsx 존재 확인
- 커밋: 25a96b7, 8d777fa, 9b7305b, 08739f9, 8225d0e, 67aa1be 모두 HEAD 의 조상
