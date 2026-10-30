---
phase: 02-day-discussion
plan: 04
subsystem: game-core
tags: [view, leak-proofing, day-view, normalize-stored-room, tdd, server-authority, role-secrecy]
status: complete

requires:
  - phase: 02-day-discussion
    provides: 02-01 의 DayView·SeatClaim·MyInfo.claim 계약과 Player·RoomState 낮 필드, 02-02 의 currentClaim·selectClaim·enterClaim·enterClaimReveal, 02-03 의 say·extendDiscussion·phaseDurationOf, rolesInPlay, DAY_ANNOUNCE_MS
provides:
  - buildView 가 낮 네 단계(dayAnnounce·claim·claimReveal·discussion)에서만 view.day 를 만든다. 그 밖의 단계에는 day 키 자체가 없다
  - claim 단계 view.day.claimDone(이번 낮 직접 고른 seat 오름차순)과 본인에게만 me.claim(claimChoice ?? claimLast). day.claims 키는 이 단계에 없다
  - claimReveal·discussion 의 view.day.claims({seat, claim, changed}, seat 오름차순). 옛 플레이어는 {none, false}
  - discussion 의 view.day.messages(필드별 리터럴 복사)와 day.extendUsed
  - phaseDurationMs = phaseDurationOf(state) — 연장 뒤 120000
  - normalizeStoredRoom(stored, now) — 1페이즈 종착 낮 단계("day") 저장 방을 dayAnnounce·now+2000·day 1 로 바꾸고 나머지는 같은 객체
  - 허용 경로 방식 전수 누출 검사(4~8명 × 일곱 단계 × 전원 × 시드 3개)
affects: [02-05, 02-08, 02-09, 02-10, phase-3-elimination]

tech-stack:
  added: []
  patterns:
    - "view.day 는 단계 조건부 허용 목록 리터럴 — 조건을 채울 때만 키를 만들고 서버 전용 필드는 펼쳐 복사하지 않는다"
    - "본인 주장도 currentClaim 을 거쳐서만 읽는다(claimChoice·claimLast 를 뷰 코드가 직접 쓰지 않는다)"
    - "누출 검사는 역할·주장 값 문자열의 경로를 허용 목록과 대조한다(개수 세기 아님). 허용: me.role, me.claim, day.roles[], day.claims[].claim, day.messages[].claimedRole"
    - "읽는 쪽이 기본값을 쥔다: day.n ?? 1, messages ?? [], extendUsed ?? false, claimShown ?? none, claimChanged ?? false"
    - "낮 단계 테스트 상태는 selectClaim·tick·say·extendDiscussion 실제 전이로만 만든다"

key-files:
  created: []
  modified:
    - shared/game/view.ts
    - shared/game/room.ts
    - test/unit/view.test.ts
    - test/unit/gameRoom.test.ts

key-decisions:
  - "A7 유지: claim 단계에는 남의 자리에 어제 주장(claimLast)을 싣지 않는다. 어제 값은 본인 me.claim 으로만 나간다"
  - "dayAnnounce 뷰에도 day {n, roles} 를 싣는다. claimDone·claims·messages·extendUsed 는 각자 정해진 단계에서만 생긴다"
  - "me.claim 은 claim 단계에서만 싣는다(claimReveal·discussion 에는 없다). 2일차 미리 선택 값은 어제 공개 값(claimLast)이다. 어제 말 안 함이었으면 me.claim 이 none 이다"
  - "normalizeStoredRoom 은 저장 phase 가 문자열 \"day\" 일 때만 바꾼다(1페이즈 종착 단계 이름 상수 하나). 호출은 02-05 DO 생성자의 몫"

patterns-established:
  - "TAP 실패 보고에 이스케이프된 따옴표나 여러 줄 배열이 끼면 gsd 분류기가 Malformed TAP(INVALID_RED)로 거부한다 — 실패 비교 값은 따옴표 없는 한 줄 문자열(flat)로 만든다"

requirements-completed: [DAY-02, DAY-01, COMM-01]

duration: 8 min
completed: 2026-10-23
plan_head_before: 78ccd913c1df817fdde140655e93afb2e1528daf
plan_head_after: 86db8d88c7af9317cf8ea4e3cad358d1bc599958
commits: 6
actuals:
  tokens: 6700
  tasks: 3
  commits: 6

coverage:
  - id: E1
    description: "claim 단계 뷰는 모두에게 claimDone(고른 seat 오름차순)만 싣고 본인에게만 me.claim 을 싣는다. day.claims 키는 없고 남의 선택·어제 값은 어떤 경로로도 나가지 않는다. 일부만 고른 상태, 2일차 미리 선택, 아무도 안 고른 상태 포함"
    requirement: "DAY-02"
    verification:
      - kind: unit
        ref: "test/unit/view.test.ts#buildView 낮 뷰 — 직업 공개 중(claim) 은 완료한 자리와 내 선택만"
        status: pass
      - kind: unit
        ref: "test/unit/view.test.ts#buildView 전수 누출 검사 (T-01-23)"
        status: pass
    human_judgment: false
  - id: E2
    description: "claimReveal·discussion 뷰는 공개된 주장과 말 바꿈을 모두에게 싣고(옛 플레이어는 none/false), discussion 뷰는 서버 보관 메시지를 필드별 복사로 싣는다. claimReveal 에는 messages·extendUsed 키가 없다"
    requirement: "COMM-01"
    verification:
      - kind: unit
        ref: "test/unit/view.test.ts#buildView 낮 뷰 — 공개 뒤·토론"
        status: pass
    human_judgment: false
  - id: E3
    description: "phaseDurationMs 가 연장을 반영한다: discussion 연장 전 90000, 연장 뒤 120000, claim 15000"
    requirement: "DAY-01"
    verification:
      - kind: unit
        ref: "test/unit/view.test.ts#buildView 낮 뷰 — 공개 뒤·토론 > 연장 전 phaseDurationMs 는 90000, 연장 뒤 120000"
        status: pass
    human_judgment: false
  - id: E4
    description: "전수 누출 검사: 토큰·내부 id·connId 없음, role 키는 me.role 에만, 역할·주장 값 문자열은 허용 경로에만, me.claim 은 본인 currentClaim 과 같고 claim 단계 밖에는 없다, 서버 전용 키 이름(claimLast·lastSendAt·claimChoice·claimShown·claimChanged)은 어디에도 없다"
    requirement: "ROLE-02"
    verification:
      - kind: unit
        ref: "test/unit/view.test.ts#buildView 전수 누출 검사 (T-01-23)"
        status: pass
    human_judgment: false
  - id: E5
    description: "저장된 옛 방 정규화: 1페이즈 종착 낮 단계는 dayAnnounce·now+2000·day 1 이 되고 그 밖은 같은 객체. 새 필드 없는 옛 상태를 tick 으로 낮 단계까지 넘겨도 뷰가 기본값으로 만들어진다"
    requirement: "DAY-02"
    verification:
      - kind: unit
        ref: "test/unit/gameRoom.test.ts#normalizeStoredRoom — 저장된 옛 방 (RESEARCH Pattern 6, T-02-14)"
        status: pass
    human_judgment: false
---

# Phase 2 Plan 04: 낮 뷰 허용 목록과 옛 방 정규화 Summary

**buildView 가 단계 조건부 허용 목록으로 view.day·me.claim 을 만들어 "마감 전 남의 선택 비공개"와 "남의 역할 비공개"를 함께 지키고(허용 경로 방식 전수 누출 검사로 증명), phaseDurationMs 가 연장을 반영하며, normalizeStoredRoom 이 1페이즈에서 저장된 방을 새 단계 구조로 옮긴다.**

## 성과

- 낮 네 단계에서만 `view.day` 가 생긴다. claim 단계는 `claimDone` 과 본인 `me.claim` 뿐이고 `claims` 키가 없다 — 서버가 키 자체를 만들지 않으므로 화면에서 숨기는 방식이 아니다(D-01).
- claimReveal·discussion 은 `day.claims`(말 바꿈 포함)를, discussion 은 `day.messages`·`day.extendUsed` 를 싣는다. 메시지는 저장 객체를 펼치지 않고 필드별로 복사한다.
- `phaseDurationMs` 를 `phaseDurationOf(state)` 로 바꿔 연장 뒤 타이머 막대 비율이 맞는다(Pitfall 3).
- 전수 누출 검사를 "역할 값 개수" 에서 "허용 경로" 방식으로 바꾸고, 낮 단계 상태를 실제 전이로 만들어 4~8명 × 일곱 단계 × 전원 × 시드 3개(= 3 × 7 × 30 = 630 뷰)를 검사한다.
- `normalizeStoredRoom(stored, now)` 가 옛 종착 단계 `"day"` 를 `dayAnnounce`·`now+2000`·`day 1` 로 옮긴다(T-02-14).

## TDD 기록

### RED
| 커밋 | 대상 | 실패 이유 | RED 증거 |
| ---- | ---- | -------- | -------- |
| 8c902f7 | claim 단계 day·me.claim (Task 1, tracer) | buildView 가 day 를 만들지 않아 모든 viewer 의 day 가 undefined | `gsd check tdd-red-evidence` → RED_EVIDENCE_OK (target_test_failed). 의미 검사: 대상 테스트가 실제로 실행되어 계획한 단언(day 모양)에서 실패 |
| cb2a795 | reveal·discussion day, 연장 길이 (Task 2) | day.claims·messages·extendUsed 없음, extendUsed undefined, phaseDurationMs 90000 | RED_EVIDENCE_OK. 의미 검사: 대상(연장 전후 길이)이 `90000:undefined != 90000:false` 단언에서 실패 |
| ea0eb4b | normalizeStoredRoom (Task 3) | `normalizeStoredRoom is not a function` (아직 없는 내보내기를 부르는 TypeError) | RED_EVIDENCE_OK. 의미 검사: 대상이 실행되어 계획한 심볼 부재로 실패(어서션 전 TypeError 라 약한 편), 같은 파일의 두 번째 테스트도 같은 이유로 실패. 세 번째·네 번째 테스트는 기존 동작(tick·buildView 기본값)을 고정하므로 RED 에서 통과 |

### GREEN
- 2f5ae94: `buildDay` 와 claim 단계 `me.claim` (day.n·roles·claimDone)
- 0f664bb: `day.claims`·`day.messages`·`day.extendUsed`, `phaseDurationOf`
- 86db8d8: `normalizeStoredRoom`

### REFACTOR
없음(변경할 만한 중복이 없었다).

## TDD Gate Compliance

세 사이클 모두 `test(02-04)` 커밋이 대응하는 `feat(02-04)` 커밋보다 먼저다(8c902f7 → 2f5ae94, cb2a795 → 0f664bb, ea0eb4b → 86db8d8). 위반 없음.

## 계획 대비 변경

### 자동 수정

**1. [Rule 3 - 막힘 해소] 누출 검사 개편을 Task 2 가 아니라 Task 1 로 당김**
- **발견 시점:** Task 1 (RED 작성)
- **문제:** Task 1 GREEN 이 `day.roles` 를 싣는 순간, 기존 전수 누출 검사의 정규식(`"(mafia|police|doctor|citizen)"` 개수 = me.role 하나)이 정상 구현을 실패로 만든다(RESEARCH Pitfall 2). Task 1 이 끝난 시점에 단위 시험이 깨진 채로 둘 수 없다.
- **조치:** Task 1 의 RED 커밋에서 정규식 검사를 허용 경로 방식(`roleValueLeaks`)으로 교체했다. 허용 목록은 계획 그대로(me.role, me.claim, day.roles[], day.claims[].claim, day.messages[].claimedRole). Task 2 는 낮 단계 상태를 실제 전이(`richStateAt`)로 채우고 서버 전용 키 이름·me.claim 일치 단언을 더했다.
- **수정 파일:** test/unit/view.test.ts
- **커밋:** 8c902f7, cb2a795

**2. [Rule 3 - 막힘 해소] RED 보고서 모양 조정**
- **발견 시점:** Task 1 (RED 증거 분류)
- **문제:** 실패 단언의 expected/actual 에 이스케이프된 따옴표(JSON 문자열)나 여러 줄 배열이 들어가면 gsd 분류기의 TAP 파서가 `Malformed TAP` 으로 보고서 전체를 INVALID_RED 로 거부했다.
- **조치:** 테스트의 비교 값을 따옴표 없는 한 줄 문자열(`flat` 헬퍼)로 바꿨다. 테스트 의미는 그대로다.
- **수정 파일:** test/unit/view.test.ts
- **커밋:** 8c902f7

**총 편차:** 자동 수정 2건(Rule 3 두 건). **영향:** 범위 확장 없음, 순서만 앞당김.

## 알려진 스텁

없음.

## 위협 표면

계획의 위협 모델 범위 안이다(T-02-12·T-02-13·T-02-14 모두 이 계획에서 완화됨). 새로 열린 네트워크 경로·인증 경로·저장 스키마 변경 없음 — Threat Flags 없음.

## 다음 단계 준비

- 02-05: DO 생성자가 `normalizeStoredRoom(stored, Date.now())` 를 부르고 알람을 재설정해야 한다. `buildView` 는 그대로 방송하면 된다. 워커 쪽 `test/worker/leak.test.ts` 의 "역할 값 개수" 검사는 이 계획에서 건드리지 않았다(02-05 몫, 전체 `npx vitest run` 은 48 파일 888 시험 통과 상태).
- 02-08·02-09: 화면은 `view.day` 모양(`claimDone`, `claims`, `messages`, `extendUsed`)과 `view.me.claim` 을 읽으면 된다.

## 검증

- `npx vitest run test/unit/view.test.ts test/unit/gameRoom.test.ts`: 75 통과
- `npm run typecheck && npx vitest run --project unit`: 통과(23 파일 448 시험)
- `npx vitest run`(전체): 48 파일 888 시험 통과
- 인수 기준 grep(claimDone·currentClaim(·rolesInPlay(, claimLast 부재, phaseDurationOf(, `phaseDurationMs: def.durationMs` 부재, extendUsed·claims, 허용 경로 문자열, normalizeStoredRoom): 모두 통과

## Self-Check: PASSED

- 파일 존재: shared/game/view.ts, shared/game/room.ts, test/unit/view.test.ts, test/unit/gameRoom.test.ts — FOUND
- 커밋 존재: 8c902f7, 2f5ae94, cb2a795, 0f664bb, ea0eb4b, 86db8d8 — FOUND
