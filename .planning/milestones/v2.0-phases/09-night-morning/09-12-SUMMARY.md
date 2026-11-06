---
phase: 09-night-morning
plan: "12"
subsystem: server-will-note
tags: [will, note, night-leak, bots, tdd, tracer]
status: complete

requires:
  - phase: 09-night-morning
    provides: confirmedTarget (09-07), botMafiaTarget (09-02), approachPoint·positionAtFx (09-04), afterTransition·home 배선 (09-09)
provides:
  - 메시지 { t:"will" }·{ t:"note" } (WillSendMessage·NoteSendMessage)와 strictObject 스키마 WillMessageSchema·NoteMessageSchema (text UTF-16 300 이하)
  - shared/game/will.ts — saveWill, saveNote, noteRecipientIds, WILL_MIN_GAP_MS(500), WillError
  - view.me.will(지도 단계의 산 본인), view.me.note(밤의 산 마피아)
  - 방 DO handleWill·applyWill·handleNote·applyNote, 인메모리 간격 Map writeAt(키 will:{id}·note:{id})
  - 봇 BotAct will·approach, BOT_WILL_LINES, BOT_WILL_AT_MS(3000), BOT_APPROACH_AFTER_MS(200)
affects: [09-14, 09-17, 09-16]

actuals:
  tokens: 11200
  tasks: 3
  commits: 6
plan_head_before: a34ee5ff474f6cb80ccbf0314d7cfb807ed4268a
plan_head_after: 08e33169fa07ff45868a869c2a79c4111a657724

tech-stack:
  added: []
  patterns:
    - "저장 성공은 받을 권리가 있는 소켓에만 sendViewTo, persistAndBroadcast 를 부르지 않는다 (유언=본인, 쪽지=산 마피아, 유령 제외)"
    - "간격 검사는 규칙 함수보다 먼저 한다: 안의 요청은 오류 없이 버리고, 상태가 바뀐 저장만 시각을 기록한다"
    - "봇 계획에 난수 없는 행동을 덧붙이면 기존 시드 고정 값은 그 행동을 거른 계획으로 그대로 유지된다"

key-files:
  created:
    - shared/game/will.ts
    - test/unit/will.test.ts
    - test/worker/will.test.ts
  modified:
    - shared/protocol.ts
    - shared/schemas.ts
    - shared/game/view.ts
    - shared/game/bots.ts
    - worker/room.ts
    - test/unit/schemas.test.ts
    - test/unit/bots.test.ts
    - test/worker/bots.test.ts

key-decisions:
  - "saveNote 의 지움(공백뿐)도 확정일 때만 받는다(가정 A2). 확정이 풀리면 글은 임시로 남고 아침 판정(enterMorning)이 버린다"
  - "간격 검사를 규칙 함수(saveWill·saveNote)보다 앞에 둔다 — 간격 안의 거절 요청도 오류 없이 버려져 연타 비용이 가장 싸다. 거절·같은 값은 시각을 기록하지 않는다"
  - "noteRecipientIds 는 pickRecipientIds 와 달리 유령을 더하지 않는다 (L7: 쪽지는 아침 카드로 공개되기 전까지 산 마피아끼리의 것)"
  - "approach 는 실행 시점에 대상·봇의 위치를 world 구간(positionAtFx)에서 읽어 approachPoint(…, 80) 를 applyMove 에 넘긴다. 구간이 없으면 조용히 버린다"

requirements-completed: []

metrics:
  duration: 약 30분
---

# Phase 9 Plan 12: 유언·쪽지 서버 층과 봇 밤 행동 Summary

will·note 메시지가 스키마(strictObject)를 지나 saveWill·saveNote 규칙으로 저장되고, 저장 성공은 본인(유언) 또는 산 마피아(쪽지) 소켓에만 state(me.will·me.note)로 돌아가며, 테스트 방 봇은 1일차에 유언을 쓰고 마피아 봇은 대상 곁으로 걷는다.

## 한 일

- **Task 1 (트레이서)**: `will`·`note` 메시지·스키마, `saveWill`(단계 → 행위자 → 본문 → 같은 값 → 새 상태, 공백뿐은 키째 지움), `view.me.will`, DO `applyWill`(500ms 간격 → 규칙 → 저장 → 본인 `sendViewTo`). 토론의 시민이 보내면 그 소켓만 state 1개, 나머지 다섯은 프레임 0개이며 로비에서는 보낸 소켓에만 `error WRONG_PHASE` + state.
- **Task 2**: `saveNote`(단계 night → 산 마피아 → `confirmedTarget` → 본문 → 같은 값), `noteRecipientIds`(산 마피아만), `view.me.note`, DO `applyNote`. 확정 뒤 마피아 A 가 쓰면 산 마피아 둘만 같은 `me.note` 를 받고 시민 편 넷·유령은 프레임 0개, 이어서 B 가 쓰면 마지막 저장이 이긴다. 쪽지에 작성자는 저장되지 않는다(저장된 방 JSON 에서 본문은 `nightNote` 한 곳뿐).
- **Task 3**: `BOT_WILL_LINES`(3문장, 역할 단어 없음)·`will`(1일차 토론 +3000ms)·`approach`(마피아 봇, pick 계획 +200ms) 계획 덧붙임(난수 없음). `actAsBot` 이 `applyWill` 본체와 `approachPoint` → `applyMove` 를 지난다. 워커 시험에서 마피아 봇 구간 끝점이 대상 곁 400 이내이고 시민 편 사람 소켓은 world 프레임 0개.

## 검증

- `npm run typecheck` 통과. `--project unit` 2181 통과(1 skip, 기존), `--project worker` 331 통과, `--project client` 1420 통과(6 skip, 기존 09-10 이월분).
- RED 커밋 3개(`587dbb2`, `57ca084`, `7934620`)가 각 GREEN 앞에 있다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task 1 의 typecheck 를 녹색으로 두려고 `case "note"` 임시 자리를 넣음**
- **Found during:** Task 1 GREEN
- **Issue:** 유니온에 `NoteSendMessage` 를 Task 1 에서 더하면 `webSocketMessage` 의 never 검사가 깨진다(핸들러는 Task 2).
- **Fix:** Task 1 에서 `case "note": return;` 를 두고 Task 2 에서 `handleNote` 로 바꿨다.
- **Files modified:** worker/room.ts
- **Commit:** c92b4e2, 8695804

**2. [Rule 1 - 시험 보정] 기존 봇 시험 3곳을 새 행동에 맞춤**
- **Found during:** Task 3 GREEN
- **Issue:** discussion 계획 단언(`chat|endDiscussion` 만 허용)·허용 행동 목록·night 계획 단언(`pick|chat` 만 허용)이 will·approach 를 몰랐고, 계획 고정 값은 덧붙은 행동 때문에 달라질 수 있었다.
- **Fix:** 허용 목록에 will·approach 추가, night 단언에서 approach 는 전용 시험이 보게 건너뜀, 고정 값 시험은 will·approach 를 걸러 계산해 기존 값(`34804349`, `554531902`)이 그대로임을 확인(난수 호출 순서 불변 증명).
- **Files modified:** test/unit/bots.test.ts
- **Commit:** 08e3316

### 계획 acceptance 와의 차이

- Task 3 의 `git grep -F -e ".skip(" -e ".todo(" -- test` 는 `test/client/nightMap.test.tsx` 의 `it.skip` 6건(09-10 이 남기고 09-15 가 지울 임시 틀) 때문에 rc=0 이다. 이 계획이 건드린 파일에는 skip·todo 가 없다.

## Known Stubs

없음.

## Threat Flags

없음. 새 소켓 메시지 두 개는 위협 모델(T-09-25~28)이 다룬 범위 안이다.

## 알아 둘 것 (다음 계획)

- 워커 전체 시험은 부하가 크면 가끔 실패한다: `bots.test.ts` 의 "마피아 봇 협응"(역할 무작위 의존)과 "토론 끝내기를 누르면" 이 한 번씩 흔들렸고 단독·재실행에서 모두 통과했다. 이 계획 변경과 무관한 기존 불안정으로 본다.

## Self-Check: PASSED

- 파일: shared/game/will.ts, test/unit/will.test.ts, test/worker/will.test.ts 존재
- 커밋: 587dbb2, c92b4e2, 57ca084, 8695804, 7934620, 08e3316 모두 HEAD 의 조상
