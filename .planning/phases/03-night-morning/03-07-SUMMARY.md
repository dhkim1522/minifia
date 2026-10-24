---
phase: 03-night-morning
plan: 07
subsystem: worker-room
tags: [tdd, tracer, night, pick, websocket, scoped-send, spectator, mafia-chat, workerd]
status: complete

requires:
  - phase: 03-night-morning/03-03
    provides: pickTarget, pickRecipientIds, nightChatRecipientIds, 밤 판정(enterMorning)
  - phase: 03-night-morning/03-04
    provides: 밤 템플릿 세 개와 say·emote 의 밤 보낸 사람 규칙(마피아만, 탈락자 BAD_MESSAGE)
  - phase: 03-night-morning/03-05
    provides: 밤·아침 view(me.pick·allyPicks·records, day.morning, 탈락자 spectate)
provides:
  - "pick 메시지: shared/schemas.ts 의 strictObject(target 0..7 정수), worker/room.ts 의 handlePick"
  - "sendViewTo(ids): 받는 사람 집합에 든 소켓에만 그 사람의 view 를 보내는 도우미"
  - "broadcastEventTo(msg, ids): 받는 사람 집합에 든 소켓에만 이벤트를 보내는 도우미"
  - "밤 say·emoji 는 nightChatRecipientIds(살아 있는 마피아 + 탈락자)에게만, 낮은 기존 전원 방송"
  - "test/worker/night.test.ts: workerd 실제 소켓 17건(밤 행동·마피아·채팅·마감·관전·탈락 거부·마감 뒤 pick)"
affects: [03-08, 03-09, 03-10, 03-11, 03-12]

plan_head_before: d6baced78ecea4110ada359cddae0fea9951335d
plan_head_after: 32dd3d5dbb4670bfa277d6c78038b1306262e2f7

actuals:
  tokens: 6700   # chars/4 over git diff d6baced..32dd3d5 (코드 + 테스트 26810자)
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "받는 사람 한정 전송은 소켓 첨부의 playerId 를 받는 사람 집합에 대조하는 순회 하나(sendViewTo·broadcastEventTo)다. 소켓 태그(ctx.getWebSockets(tag))는 hello 전에는 신원이 없어 쓰지 않는다"
    - "'프레임이 오지 않았음' 은 그 소켓에 ping 을 보내 pong 이 올 때까지 사이에 낀 프레임을 세어 증명한다(소켓마다 보낸 순서대로 전달). 프레임 목록은 '[state:night,error:...]' 한 줄 문자열로 비교해 실패 출력이 한 줄이다"
    - "밤 행동은 저장만 하고 phaseEndsAt·알람을 건드리지 않는다. 같은 값 재선택은 pickTarget 이 같은 객체를 돌려줘 저장도 전송도 없다"

key-files:
  created:
    - test/worker/night.test.ts
  modified:
    - worker/room.ts
    - shared/schemas.ts

key-decisions:
  - "거부된 pick(WRONG_PHASE·BAD_MESSAGE 모두)은 sendRejection 으로 보낸 소켓에만 error + 최신 state 를 보낸다. 거부는 어떤 소켓에도 새 정보를 주지 않는다"
  - "밤 chat·emoji 의 단계 판단은 워커가 한다(this.room.phase === 'night'). nightChatRecipientIds 는 단계를 보지 않는 순수 함수라 그대로 둔다(03-03 계약)"
  - "requirements-completed 는 비워 둔다: 서버 배선은 끝났지만 같은 ID 를 03-08 이후 화면 계획과 03-09 누출 검사가 이어 받는다(requirements.ready-ids 가 여섯 개 모두 blocked 로 확인)"

requirements-completed: []

duration: 약 25분
completed: 2026-10-25

coverage:
  - id: C1
    description: "경찰의 pick 은 경찰 소켓에만 me.pick state 로 가고 살아 있는 다른 소켓은 pong 전까지 프레임 0개이며, 같은 대상 재선택·잘못된 값(여분 키·범위 밖·문자열)은 저장·전송이 없거나 보낸 소켓의 BAD_MESSAGE 뿐이다. 밤 마감 뒤 모든 소켓이 같은 day.morning 을 받고 경찰만 me.records 를 받는다"
    requirement: "NIGHT-02"
    verification:
      - kind: integration
        ref: "test/worker/night.test.ts#밤 행동 한 줄 (NIGHT-02)"
        status: pass
    human_judgment: false
  - id: C2
    description: "마피아 pick 은 살아 있는 마피아 전원에게만 state 로 가고(동료 allyPicks), 비마피아 생존 소켓은 0개. 모든 행동 역할이 고른 뒤에도 밤의 phase·phaseEndsAt·알람은 진입 때 값 그대로다"
    requirement: "NIGHT-01"
    verification:
      - kind: integration
        ref: "test/worker/night.test.ts#마피아 밤 (NIGHT-01·D-07)"
        status: pass
      - kind: integration
        ref: "test/worker/night.test.ts#마감 (NIGHT-05)"
        status: pass
    human_judgment: false
  - id: C3
    description: "밤 chat·emoji 는 살아 있는 마피아(보낸 사람 포함)와 관전자 소켓에만 가고 살아 있는 비마피아 소켓은 0개. 밤 say 는 저장소에 messages 도 템플릿 이름도 남기지 않고 낮 번호는 그대로이며 밤 번호만 오른다. 낮 토론 say 는 모든 소켓에 간다(회귀 없음)"
    requirement: "COMM-04"
    verification:
      - kind: integration
        ref: "test/worker/night.test.ts#밤 채팅 (D-17·COMM-04)"
        status: pass
      - kind: integration
        ref: "test/worker/night.test.ts#낮 방송 회귀"
        status: pass
    human_judgment: false
  - id: C4
    description: "탈락자 소켓은 탈락한 아침 state 부터 spectate.seats(모든 실제 직업)를 받고 탈락 전 프레임·살아 있는 소켓에는 spectate 키가 없다. 다음 밤 행동 state·마피아 채팅을 받고, 재접속 첫 state 에도 spectate 가 있다"
    requirement: "NIGHT-06"
    verification:
      - kind: integration
        ref: "test/worker/night.test.ts#관전 (결정 0021)"
        status: pass
    human_judgment: false
  - id: C5
    description: "탈락자의 pick·claim 은 error BAD_MESSAGE + state, say·emoji 는 BAD_MESSAGE 뿐이며 아무 소켓에도 chat·emoji 가 가지 않는다. 마감이 지난 뒤(알람 전) 도착한 pick 은 먼저 아침으로 넘긴 뒤 보낸 소켓에 WRONG_PHASE 다"
    requirement: "ELIM-01"
    verification:
      - kind: integration
        ref: "test/worker/night.test.ts#탈락자 거부 (ELIM-01)"
        status: pass
      - kind: integration
        ref: "test/worker/night.test.ts#마감 뒤 행동"
        status: pass
    human_judgment: false
---

# Phase 3 Plan 07: 방 DO 밤 배선 Summary

방 Durable Object 가 `pick` 을 받아 판정하고, 밤 행동 state 는 행위자 쪽(마피아면 살아 있는 마피아 전원)과 관전자에게만, 밤 chat·emoji 는 살아 있는 마피아와 관전자 소켓에만 보내도록 배선했다. 살아 있는 비행위자·비마피아 소켓은 밤 프레임을 하나도 받지 않는다.

## 한 일

- **Task 1 (tracer)**: `shared/schemas.ts` 에 `pick` strictObject(`target` 0..7 정수)를 더하고, `worker/room.ts` 에 `case "pick"`·`handlePick`·`sendViewTo` 를 더했다. `handlePick` 은 신원을 소켓 첨부 playerId 로만 읽고, 거부는 `sendRejection`, 같은 값은 무반응, 그 밖은 저장한 뒤 `pickRecipientIds` 에게만 view 를 보낸다. `persistAndBroadcast`·`reschedule` 은 부르지 않는다.
- **Task 2**: `broadcastEventTo` 를 더하고 `handleSay`·`handleEmoji` 가 밤이면 `nightChatRecipientIds` 에게만 보내게 했다. 낮은 기존 `broadcastEvent` 그대로다.
- **Task 3**: 구현 변경 없이 관전자 소켓 계약을 통합 테스트로 고정했다(탈락한 아침부터 spectate, 다음 밤 행동 state·마피아 채팅 수신, 재접속, 탈락자 거부, 마감 뒤 pick).

## 커밋

| 커밋 | 내용 |
| --- | --- |
| `55adec1` test(03-07) | Task 1 RED: 경찰 pick over sockets |
| `c48dfc8` feat(03-07) | Task 1 GREEN: handlePick, sendViewTo, pick 스키마 |
| `446728c` test(03-07) | Task 2 RED: 마피아 수신자·밤 채팅 범위 |
| `5a56816` feat(03-07) | Task 2 GREEN: broadcastEventTo, 밤 say·emoji 범위 |
| `32dd3d5` test(03-07) | Task 3: 관전자 소켓·탈락자 거부·마감 뒤 pick (통합 테스트, tdd 아님) |

## TDD Gate Compliance

| Task | RED | GREEN | 증거 |
| --- | --- | --- | --- |
| 1 | `55adec1` | `c48dfc8` | `gsd-tools check tdd-red-evidence` → `RED_EVIDENCE_OK`(tap-flat, 대상 "경찰의 pick 은 경찰 소켓에만 me.pick state 로 가고 …", 4건 중 3건 실패) |
| 2 | `446728c` | `5a56816` | `RED_EVIDENCE_OK`(대상 "마피아의 밤 say·emoji 는 살아 있는 마피아 둘에게만 가고 …", 10건 중 1건 실패) |

semanticAssessment (Task 1): pick 을 스키마가 몰라 서버가 `error BAD_MESSAGE` 를 돌려줬다. 대상 테스트는 `expected '[error:BAD_MESSAGE]' to be '[state:night]'` 로 계획된 단언에서 실패했고, 모듈 로드·픽스처 실패가 아니다. 재선택 테스트와 아침 결과 테스트도 같은 원인으로 실패했고, 잘못된 값 테스트는 이미 BAD_MESSAGE 여서 통과했다(거부 경로를 회귀로 고정하는 용도).

semanticAssessment (Task 2): 이 RED 에서 실패한 것은 대상 한 건뿐이다 — `say` 성공 뒤 기존 `broadcastEvent` 가 비마피아 소켓에도 chat 을 보내 `expected '[chat]' to be '[]'`. 나머지 아홉 건은 Task 1 구현과 03-03·03-04 규칙이 이미 만족하는 계약(마피아 수신자, WRONG_PHASE·BAD_MESSAGE 응답, 저장소에 messages 없음, 마감·알람 불변, 낮 방송 회귀)을 고정한다. 계획이 정한 RED 범위(밤 chat 이 모든 소켓에 가서 비마피아 0개 단언 실패)와 일치한다.

Task 3 은 계획대로 TDD 가 아니다. 작성 즉시 통과했고(버그 없음, fix 커밋 없음), 돌연변이 확인으로 테스트가 실제로 전송 범위를 잡는지 봤다 — `sendViewTo` 를 `broadcast()` 로, 밤 say 를 전원 방송으로 임시 바꾸면 5건이 실패했고 원래대로 되돌렸다(되돌림은 커밋에 없다).

## Deviations from Plan

None - plan executed exactly as written.

계획 본문과 다른 점은 없다. 사소한 구현 선택: Task 1 에서 `nightChatRecipientIds` import 는 쓰는 Task 2 로 미뤘다(미사용 import 방지).

## Authentication Gates

없음.

## Known Stubs

없음.

## Threat Flags

없음. 새 네트워크 엔드포인트·인증 경로 없음. `pick` 은 기존 WebSocket 메시지 면에 더해진 한 변형이며 계획 위협 모델(T-03-20..24)이 다룬다.

## 위협 모델 대응

| ID | 확인 |
| --- | --- |
| T-03-20 | `sendViewTo(pickRecipientIds)` — 살아 있는 비행위자 소켓 프레임 0 을 ping/pong 경계로 확인(경찰·마피아·다음 밤 관전) |
| T-03-21 | `broadcastEventTo(nightChatRecipientIds)` — 비마피아 생존 소켓 chat·emoji 0, 관전자만 추가 |
| T-03-22 | 신원은 첨부 playerId, 행동 종류는 저장 역할. 여분 키는 strictObject 가 BAD_MESSAGE |
| T-03-23 | 모든 메시지 앞 `advance(Date.now())` — 마감 뒤 pick 은 아침으로 넘긴 뒤 WRONG_PHASE |
| T-03-24 | target 정수 0..7 + 여분 키 거부 |

## 검증

- `npx vitest run test/worker/night.test.ts` 17건 통과(3회 반복해도 동일), `npx vitest run test/worker/night.test.ts test/worker/day.test.ts` 25건 통과
- `npx vitest run` 59개 파일·1229건 통과, `npm run typecheck` 오류 0
- 수락 기준: `z.literal("pick")` 1, `case "pick":` 1, `pickRecipientIds(` 1, handlePick 안 `persistAndBroadcast` 0, `private broadcastEventTo` 1, `nightChatRecipientIds(` 2, `spectate` 9, `WRONG_PHASE` 4, test 커밋이 해당 feat 커밋보다 먼저

## 다음 계획에 알릴 것

- 와이어 계약 `{t:"pick", target}` 은 배포 뒤 바꾸려면 서버·화면을 한 배포에서 함께 고쳐야 한다(costly). 결정 0020 기록은 03-09.
- 화면은 받은 밤 이벤트를 역할로 다시 거르지 않는다 — 받는 사람은 서버가 정한다.
- `requirements-completed` 를 비운 이유: NIGHT-01·02·03·05, ELIM-01, COMM-04 모두 화면 계획(03-08 이후)과 03-09 전수 누출 검사가 이어서 다룬다.

## Self-Check: PASSED

- `test/worker/night.test.ts` 존재, `worker/room.ts`·`shared/schemas.ts` 변경 확인
- 커밋 `55adec1`, `c48dfc8`, `446728c`, `5a56816`, `32dd3d5` 모두 HEAD 의 조상
- 측정한 `git rev-list --count d6baced..HEAD` = 5 = `commits: 5`
