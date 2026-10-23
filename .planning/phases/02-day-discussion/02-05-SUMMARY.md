---
phase: 02-day-discussion
plan: 05
subsystem: worker-room-do
tags: [websocket, durable-object, zod-strict, claim-reveal, quick-message, emoji, host-controls, alarm, leak-proofing, tracer]
status: complete

requires:
  - phase: 02-day-discussion
    provides: 02-01 의 와이어 계약(ClientMessage·emoji ServerMessage·TEMPLATE_IDS·EMOJI_IDS), 02-02 의 selectClaim, 02-03 의 say·emote·extendDiscussion·skipDiscussion, 02-04 의 낮 뷰와 normalizeStoredRoom
provides:
  - ClientMessageSchema 의 claim·say·emoji·extend·skip 다섯 변형(z.strictObject — 알 수 없는 키 거부)
  - Room DO 핸들러 handleClaim·handleSay·handleEmoji·handleExtend·handleSkip(신원은 소켓 첨부 playerId 뿐)
  - 거절 시 error 뒤 최신 state 재전송 헬퍼 sendRejection, 공개 이벤트 방송 broadcastEvent(이모티콘)
  - DO 생성자의 옛 방 정규화 + 바뀐 경우에만 알람 재설정
  - test/worker/helpers.ts 의 advanceTo·backdateSends, StoredRoom 타입
  - test/worker/day.test.ts — 동시 공개 누출·거부 매트릭스·이모티콘·연장·넘기기·끊긴 방장·정규화 13건
affects: [02-06, 02-09, 02-11, phase-3-elimination]

tech-stack:
  added: []
  patterns:
    - "새 클라이언트 메시지는 z.strictObject — 스키마가 알 수 없는 키를 거부하고, 칸 조합 검증은 shared/game 규칙 함수가 한다"
    - "마감이 바뀌는 핸들러(extend·skip)는 persistAndBroadcast 다음에 reschedule — 마감이 안 바뀌는 핸들러(claim·say·emoji)는 알람을 건드리지 않는다"
    - "거절 응답 규칙: claim·extend·skip 거절과 WRONG_PHASE 인 say 는 error + 최신 state, RATE_LIMITED·BAD_MESSAGE 는 error 만, 이모티콘 거절은 error 만"
    - "이모티콘은 state 방송 없이 storage 에 lastSendAt 만 저장하고 이벤트를 앉은 소켓 전체에 보낸다"
    - "누출 테스트는 프레임을 걸어 내려가며 역할·주장 값 문자열의 경로를 허용 경로 집합(.view.me.role, .view.me.claim, .view.day.roles[])과 대조한다"

key-files:
  created:
    - test/worker/day.test.ts
  modified:
    - shared/schemas.ts
    - worker/room.ts
    - test/worker/helpers.ts

key-decisions:
  - "WRONG_PHASE 인 say 만 state 를 다시 보내고 RATE_LIMITED·BAD_MESSAGE 는 error 만 보낸다(계획 가정 그대로). 이모티콘 거절은 단계 불문 error 만"
  - "생성자는 정규화가 실제로 방을 바꿨을 때만 storage 저장 + setAlarm(nextWakeAt) — 평소의 '대기 중 알람을 덮지 않는다' 규칙 유지(normalized !== stored 비교)"
  - "연결당 20개/초 방어(rates)는 그대로, 2초 쿨다운은 플레이어 단위 lastSendAt 으로만 판정 — 재접속으로 풀리지 않는다"

patterns-established:
  - "advanceTo 는 forceDue + runDurableObjectAlarm 을 단계 하나씩 반복하고 모든 소켓이 그 단계 state 를 받을 때까지 기다린다"
  - "거절 케이스 검증은 보낸 소켓의 error 를 읽은 뒤 ping 왕복 + 짧은 대기(settle)로 서버가 다른 소켓에 아무것도 안 보냈음을 확인한다"

requirements-completed: [DAY-01, DAY-02, COMM-01, COMM-02, COMM-04]

coverage:
  - id: E1
    description: "직업 공개 동시 공개(워커): 마감 전 모든 소켓의 모든 프레임에서 역할·주장 문자열은 허용 경로에만 있고 day.claims 키가 없다. 다른 소켓에는 고른 사람 seat 가 claimDone 으로만 보이고, 본인에게만 me.claim 이 보인다. claimReveal 에서 모두에게 day.claims 가 공개된다(고른 값, 미선택은 none)"
    requirement: "DAY-02"
    verification:
      - kind: worker
        ref: "test/worker/day.test.ts#직업 공개 동시 공개 (D-01, D-03, D-05) > 마감 전에는 선택이 본인에게만 보이고(허용 경로 밖 값 없음), 마감 뒤 모두에게 공개된다"
        status: pass
    human_judgment: false
  - id: E2
    description: "단계 밖 claim·say·emoji 는 WRONG_PHASE 로 거부되고(claim·say 는 최신 state 재전송), 자유 문자열 키·보낸 사람 위조 키가 붙은 say 와 모르는 아이콘은 BAD_MESSAGE 로 거부되며, 거부된 요청은 다른 소켓의 어떤 프레임에도 나타나지 않는다"
    requirement: "COMM-04"
    verification:
      - kind: worker
        ref: "test/worker/day.test.ts#직업 공개 동시 공개 > 단계 밖(discussion) claim 은 WRONG_PHASE 이고 최신 state 를 다시 받는다"
        status: pass
      - kind: worker
        ref: "test/worker/day.test.ts#빠른 메시지 (COMM-01, COMM-04, D-13) > claim·claimReveal 단계의 say 는 WRONG_PHASE 이고 다른 소켓 프레임에 메시지가 없다"
        status: pass
      - kind: worker
        ref: "test/worker/day.test.ts#빠른 메시지 (COMM-01, COMM-04, D-13) > text 키가 붙은 say·seat 키로 방장 자리를 넣은 say 는 BAD_MESSAGE 이고 다른 소켓에 나타나지 않는다"
        status: pass
      - kind: worker
        ref: "test/worker/day.test.ts#이모티콘 (COMM-02, D-14) > 단계 밖 emoji 는 WRONG_PHASE, 모르는 아이콘이나 덧붙은 키는 BAD_MESSAGE 이고 아무에게도 가지 않는다"
        status: pass
    human_judgment: false
  - id: E3
    description: "낮 토론의 빠른 메시지는 저장 뒤 모든 소켓의 day.messages 에 같은 줄(seat = 보낸 소켓 자리)로 나타나고 거짓 주장도 그대로 보내지며, 2초 안의 두 번째 전송은 RATE_LIMITED 로 거부되어 다른 소켓 messages 가 늘지 않는다"
    requirement: "COMM-01"
    verification:
      - kind: worker
        ref: "test/worker/day.test.ts#빠른 메시지 (COMM-01, COMM-04, D-13) > discussion 에서 보낸 suspect 는 모든 소켓의 day.messages 한 줄(seat = 보낸 소켓의 자리)이 되고, 즉시 두 번째는 RATE_LIMITED 다"
        status: pass
      - kind: worker
        ref: "test/worker/day.test.ts#빠른 메시지 (COMM-01, COMM-04, D-13) > 쿨다운이 지난 뒤 거짓 주장(claimed, 아무 직업)도 그대로 모든 소켓에 보내진다"
        status: pass
    human_judgment: false
  - id: E4
    description: "이모티콘은 저장 없이(messages 불변) 앉은 모든 소켓에 {t: emoji, seat, icon, at} 프레임으로 가고, 이모티콘 직후 say 는 합산 쿨다운으로 RATE_LIMITED 다"
    requirement: "COMM-02"
    verification:
      - kind: worker
        ref: "test/worker/day.test.ts#이모티콘 (COMM-02, D-14) > 저장 없이 연결된 모든 소켓에 emoji 프레임이 가고, 직후 say 는 RATE_LIMITED 다"
        status: pass
    human_judgment: false
  - id: E5
    description: "방장만 연장·넘기기를 할 수 있다: 손님은 NOT_HOST(마감·단계 불변), 방장 연장은 모든 소켓에 +30000·120000·extendUsed true 와 새 마감 알람, 두 번째는 ALREADY_EXTENDED, 방장 넘기기는 모든 소켓에 즉시 dayAnnounce(day.n 2)와 새 알람. 방장이 끊겨도 서버 타이머대로 넘어간다"
    requirement: "DAY-01"
    verification:
      - kind: worker
        ref: "test/worker/day.test.ts#방장 연장·넘기기 (D-18, D-19, DAY-01)"
        status: pass
    human_judgment: false
  - id: E6
    description: "옛 저장 방(1페이즈 종착 단계 \"day\")은 DO 가 깨어날 때 dayAnnounce·day 1 로 정규화되고 알람이 새 마감으로 다시 걸린다(정규화 전에는 알 수 없는 단계로 DO 가 예외를 냈다)"
    requirement: "DAY-02"
    verification:
      - kind: worker
        ref: "test/worker/day.test.ts#옛 저장 방 정규화 (RESEARCH Pattern 6)"
        status: pass
    human_judgment: false

actuals:
  tokens: 7500
  tasks: 3
  commits: 6
plan_head_before: 243d63ce87c63a6bbf7fd033084a53d36236a05a
plan_head_after: a13c7b8c30d7a2f190fbfec3847a1cbab353d124
commits: 6

duration: 5min
started: 2026-10-23T18:29:01Z
completed: 2026-10-23
---

# Phase 2 Plan 05: 낮 토론 메시지를 방 Durable Object 에 연결 Summary

**claim·say·emoji·extend·skip 다섯 메시지를 strictObject 스키마와 소켓 첨부 신원으로 방 DO 에 연결하고, 실제 소켓에서 직업 동시 공개(마감 전 허용 경로 밖 값 없음)·빠른 메시지·이모티콘·방장 연장/넘기기(알람 재설정)·옛 방 정규화를 workerd 통합 테스트 13건으로 증명했다.**

## Performance

- **Duration:** 약 5 min (18:29 ~ 18:34 UTC)
- **Tasks:** 3 (트레이서 1 + auto 2)
- **Files:** 신규 1(테스트), 수정 3
- **Commits:** 6 (RED 3 + GREEN 3, 측정값)

## Accomplishments

- **트레이서(Task 1):** 소켓에서 고른 직업이 마감 전에는 본인에게만(`me.claim`), 다른 소켓에는 seat 만(`day.claimDone`) 가고, 마감 뒤 `day.claims` 로 모두에게 공개되는 것을 5명 방 실제 소켓으로 확인. 모든 소켓의 모든 원문 프레임을 경로와 함께 훑어 역할·주장 문자열이 `.view.me.role`·`.view.me.claim`·`.view.day.roles[]` 에만 있음을 단언했다(T-02-17, 성공 기준 1).
- **메시지·이모티콘(Task 2):** say 는 서버 검증 뒤 `day.messages` 로 방 전체에 가고, 이모티콘은 state 방송 없이 `{t: emoji, seat, icon, at}` 이벤트로만 간다. 단계 밖·자유 텍스트 키·보낸 사람 위조 키·2초 안 재전송 거부 매트릭스를 다른 소켓 프레임 부재까지 확인.
- **연장·넘기기·정규화(Task 3):** 두 핸들러 모두 성공 뒤 `reschedule()` 로 알람이 새 마감에 맞춰짐을 `alarmOf` 로 확인. 생성자는 `normalizeStoredRoom` 결과가 입력과 다른 객체일 때만 저장 + `setAlarm(nextWakeAt)`.
- 트레이서 게이트: `<verify>` 가 자동 검증뿐이라 다시 돌려 통과 — `⚡ Tracer verified end-to-end — expanding`.

## Task Commits

1. **Task 1 (tracer)** — RED `8db1d2e` test → GREEN `f2d45fb` feat
2. **Task 2** — RED `e445062` test → GREEN `2968d42` feat
3. **Task 3** — RED `8106b2a` test → GREEN `a13c7b8` feat

REFACTOR 커밋 없음.

## TDD 기록

계획의 세 작업은 `tdd="true"` 가 아니지만(오케스트레이터가 TDD 모드를 켠 상태), 각 작업을 RED(test 커밋) → GREEN(feat 커밋) 순서로 나눴다. `gsd check tdd-red-evidence` 분류기용 TAP 기록은 만들지 않았다(`tdd="true"` 작업이 아니라 필수 게이트가 아님). 대신 RED 실행 결과를 직접 확인했다.

| Task | RED | GREEN | RED 의미 검사 |
|------|-----|-------|---------------|
| 1 | `8db1d2e` | `f2d45fb` | 두 시험 모두 실행되어 실패: claim 이 스키마에서 BAD_MESSAGE 로 거부되어 `me.claim` 프레임이 오지 않아 타임아웃, 단계 밖 claim 은 WRONG_PHASE 기대에 BAD_MESSAGE 수신(단언 실패). 로드·import 오류 아님 |
| 2 | `e445062` | `2968d42` | 8건 중 5건 실패(say·emoji 변형이 스키마에 없어 응답 없음/BAD_MESSAGE). 나머지 3건(스키마 거부로 이미 BAD_MESSAGE 가 되는 거부 케이스)은 RED 에서도 통과 — 거부 불변식을 고정하는 회귀 시험 |
| 3 | `8106b2a` | `a13c7b8` | 4건 실패: 손님 extend·skip 은 BAD_MESSAGE 수신(NOT_HOST 기대), 방장 extend 는 프레임 없음, 정규화는 저장된 알 수 없는 단계 때문에 DO 가 `revealsOwnRole` 예외(정규화 부재의 실제 증상). 끊긴 방장 시험은 기존 tick 동작이라 RED 에서도 통과 |

## Files Created/Modified

- `shared/schemas.ts` — claim·say·emoji·extend·skip strictObject 변형(칸 조합 검증은 chat.ts 몫이라는 주석)
- `worker/room.ts` — switch 다섯 case, 핸들러 다섯 + sendRejection·broadcastEvent, 생성자 정규화·알람
- `test/worker/helpers.ts` — advanceTo·backdateSends, StoredRoom 타입(day·messages·extendUsed·claimChoice·lastSendAt)
- `test/worker/day.test.ts` — 워커 통합 테스트 13건(신규)

## Decisions Made

key-decisions 참조. 계획 가정 A6(이모티콘마다 storage.put 한 번)과 거절 응답 규칙을 그대로 구현했다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 편집 도구 실수로 handleStart 안에 핸들러가 끼어들어 구문 오류**
- **Found during:** Task 2 GREEN
- **Issue:** 새 핸들러를 넣으려고 문자열 치환한 "거절되면 …" 주석이 handleStart 안의 같은 문구(들여쓰기만 다름)에도 부분 일치해 핸들러 블록이 그 안에 삽입됐다. TS1128 구문 오류와 Transform 실패.
- **Fix:** 삽입된 블록을 잘라 handleClaim 앞으로 옮기고 handleStart 를 원래대로 복원. 커밋 전 해결되어 잘못된 상태는 커밋되지 않았다.
- **Files modified:** worker/room.ts
- **Commit:** `2968d42` (최종 형태만 커밋됨)

**총 편차:** 자동 수정 1건(Rule 1). 계획 범위·계약 변경 없음.

## Issues Encountered

없음. 검증: `npx vitest run test/worker/day.test.ts` 13건 통과(3회 반복 모두 안정), `npm run typecheck` 오류 없음, `npx vitest run` 전체 53 파일 948건 통과(기존 leak·alarm·start·reconnect 포함). acceptance_criteria grep 전부 통과(strictObject 줄 수 6).

## Known Stubs

없음.

## Threat Flags

없음 — 계획의 위협 모델 안에서 완화했다: T-02-15(strictObject + text·seat 키 거부 시험), T-02-16(신원은 소켓 첨부, 와이어에 보낸 사람 필드 없음), T-02-17(claim 단계 프레임 경로 전수 검사), T-02-18(extend·skip 뒤 reschedule, 이모티콘은 이벤트만), T-02-19(모든 진입점 advance 선행), T-02-20(비방장 NOT_HOST·마감 불변 시험), T-02-SC(새 패키지 없음).

## Next Phase Readiness

- 02-06·02-09: 클라이언트는 `claim`·`say`·`emoji`·`extend`·`skip` 을 보내고, `error` 뒤 `state` 가 오면 서버 값으로 되돌리면 된다(RATE_LIMITED·BAD_MESSAGE 는 state 가 오지 않는다). emoji 프레임은 `{t: "emoji", seat, icon, at}`, 저장되지 않아 재접속 시 복원되지 않는다.
- 02-11 배포 스모크: 같은 흐름을 배포본에서 반복하면 된다. 배포 순간 1페이즈 종착 단계 방은 생성자 정규화로 이어진다.
- 참고: `test/worker/leak.test.ts` 는 수정하지 않았다 — 키 경로 방식이라 dayAnnounce 의 `day.roles`(키 이름 roles)에 걸리지 않고 전체 시험이 통과한다.

## Self-Check: PASSED

- 파일 존재: test/worker/day.test.ts, shared/schemas.ts, worker/room.ts, test/worker/helpers.ts — FOUND
- 커밋 존재: 8db1d2e, f2d45fb, e445062, 2968d42, 8106b2a, a13c7b8 — FOUND
