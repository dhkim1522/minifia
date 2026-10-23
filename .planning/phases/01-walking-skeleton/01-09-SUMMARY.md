---
phase: 01-walking-skeleton
plan: 09
subsystem: api
tags: [cloudflare-workers, durable-objects, websocket-hibernation, alarms, vitest-pool-workers, zod]

requires:
  - phase: 01-walking-skeleton
    provides: "01-02 Room DO 뼈대(hello·ping·방 만들기), 01-04 대기실 규칙(joinRoom·leaveRoom·kickPlayer·buildPreview), 01-07 단계표·tick·startGame·역할 뷰"
provides:
  - "GET /api/rooms/{code} 비인증 미리보기와 POST /api/rooms/{code}/join 링크 참가 라우트"
  - "Room DO 의 preview·join RPC, leave·kick·start 처리기, advance·reschedule 알람 다중화, 연결당 속도 제한"
  - "workerd 통합 테스트 6개와 도우미(helpers.ts), 6명 한 판 전수 누출 검사"
affects: [01-10, 01-11, 01-12, 01-13, 01-14, 화면 계획(참가·대기실·역할 카드)]

actuals:
  tokens: 14000
  tasks: 3
  commits: 8

plan_head_before: 3314e7cce8401e45914200a29e804716ec3ffe6a
plan_head_after: d214492a5f24dd48778e283197ed03e558874057

tech-stack:
  added: []
  patterns:
    - "DO 는 얇은 어댑터: 규칙 판정은 순수 코어(shared/game), DO 는 저장·소켓·알람 배선만"
    - "모든 진입점이 advance(now)(만료 확인 + tick)를 먼저 거치고, 알람은 reschedule 한 곳에서만 설정"
    - "방송은 항상 put 이 끝난 뒤, 연결마다 buildView 로 따로 만든다"
    - "낡은 소켓의 닫힘은 connId 가 달라 새 연결을 덮지 않는다"

key-files:
  created:
    - test/worker/helpers.ts
    - test/worker/preview.test.ts
    - test/worker/join.test.ts
    - test/worker/reconnect.test.ts
    - test/worker/start.test.ts
    - test/worker/alarm.test.ts
    - test/worker/leak.test.ts
  modified:
    - worker/index.ts
    - worker/room.ts

key-decisions:
  - "속도 제한 키는 connId 가 아니라 소켓 객체(WeakMap<WebSocket, ...>): hello 전 소켓도 세야 하고 hello 전에는 connId 가 없다. 하이버네이션으로 비면 새로 센다(수용)"
  - "handleDisconnect 는 방에 없거나 최신 connId 가 아닌 소켓의 닫힘이면 아무것도 바꾸거나 방송하지 않는다(교체된 낡은 소켓, 나가기·내보내기로 닫힌 소켓)"
  - "start 거절은 error 프레임 뒤에 그 소켓의 최신 buildView state 를 다시 보낸다(화면이 서버 view 대로 다시 그리도록)"
  - "HTTP 본문 읽기(상한 확인 + JSON 파싱)를 readJsonBody 로 뽑아 방 만들기·참가가 공유한다"

patterns-established:
  - "통합 테스트 시간 전이: forceDue(code, field) → runDurableObjectAlarm, 전이 한 번마다 다시"
  - "소켓 닫힘·오류 프레임 단언은 한 줄 문자열로 비교한다(vitest TAP 보고가 여러 줄 값에서 깨지는 것 방지)"

requirements-completed: [ROOM-02, ROOM-03, CONN-01, GAME-01, ROLE-01, ROLE-02]

coverage:
  - id: D1
    description: "비인증 미리보기와 링크·코드 참가 HTTP 라우트(오류 코드 매핑, 참가 즉시 연결된 소켓에 방송)"
    requirement: "ROOM-02"
    verification:
      - kind: integration
        ref: "test/worker/preview.test.ts; test/worker/join.test.ts#POST /api/rooms/{code}/join"
        status: pass
    human_judgment: false
  - id: D2
    description: "대기실 leave·kick 과 방장 승계, 마지막 사람이 나가면 저장소·알람 삭제"
    requirement: "ROOM-03"
    verification:
      - kind: integration
        ref: "test/worker/join.test.ts#대기실 leave, #kick"
        status: pass
    human_judgment: false
  - id: D3
    description: "재접속·기기 교체(4001)·하이버네이션 복구·ghost 연결 보정·속도 제한"
    requirement: "CONN-01"
    verification:
      - kind: integration
        ref: "test/worker/reconnect.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "연결자 4명 이상 시작 조건(끊긴 사람 포함 전원 역할), 거절 시 state 재전송"
    requirement: "ROOM-03"
    verification:
      - kind: integration
        ref: "test/worker/start.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "알람 다중화로 assigning → roleReveal → day 진행, 방 만료, 알람 예외 재시도"
    requirement: "GAME-01"
    verification:
      - kind: integration
        ref: "test/worker/alarm.test.ts"
        status: pass
    human_judgment: false
  - id: D6
    description: "6명 한 판의 실제 소켓 프레임·HTTP 응답 전수 누출 검사(자기 역할만, 마피아만 동료, 남의 토큰 없음, 구성표 일치)"
    requirement: "ROLE-02"
    verification:
      - kind: integration
        ref: "test/worker/leak.test.ts"
        status: pass
    human_judgment: false
  - id: D7
    description: "실제 폰·네트워크에서의 조용한 단절 지연과 배포 중 소켓 끊김 동작(리서치 가정 A4·A5, Open Question 7)"
    verification: []
    human_judgment: true
    rationale: "workerd 통합 테스트로 재현할 수 없는 실제 망 동작이라 01-14 실기기 확인에서 관찰한다"

duration: 66min
completed: 2026-10-23
status: complete
---

# Phase 1 Plan 09: 방 Durable Object 완성 Summary

**미리보기·링크 참가 HTTP 라우트와 leave·kick·start·알람 다중화·속도 제한을 Room DO 에 배선해, 방 만들기부터 낮까지 한 판이 실제 workerd 에서 서버 시각대로 돌고 프레임 전수 검사로 역할 비노출이 증명된다**

## Performance

- **Duration:** 약 66분 (사용량 한도로 한 번 중단 후 이어서 실행)
- **Completed:** 2026-10-23T06:19Z
- **Tasks:** 3 (Task 3 은 묶음 3개)
- **Files modified:** 9 (생성 7, 수정 2)

## Accomplishments

- `GET /api/rooms/{code}` 미리보기: 허용 목록(`buildPreview`), no-store, 없는·만료·코드 아님은 404 `ROOM_NOT_FOUND`
- `POST /api/rooms/{code}/join`: 본문 상한·스키마 검사, 오류 코드를 400/404/409 로 매핑, 성공하면 이미 연결된 모든 소켓이 곧바로 새 자리가 담긴 state 를 받는다
- `leave`(4003 `left`, 방장 승계, 마지막 사람이면 저장소·알람 삭제)와 `kick`(방장이 끊긴 사람에게만, 4003 `kicked`) — 판정자는 소켓 첨부의 playerId 뿐
- `start`: 연결자 4명 이상(끊긴 사람 포함 전원 역할 배정), 거절 시 error + 최신 state 재전송
- `advance(now)`/`reschedule()`/`alarm()`: 단계 마감과 방 만료를 알람 하나로 다중화, 예외 시 1초 뒤 재설정
- 연결당 1초 20개 속도 제한(`RATE_LIMITED`, 창마다 한 번 알림)
- 6명 한 판 전수 누출 검사로 ROLE-02 를 실제 프레임·HTTP 응답에서 증명

## Task Commits

1. **Task 1 (tracer): 미리보기·링크 참가** - RED `2efd54d` (test) → GREEN `a742fa7` (feat)
2. **Task 2: 나가기·내보내기·재접속·속도 제한** - RED `15b877f` (test) → GREEN `ac88c49` (feat)
3. **Task 3 묶음 1: 시작·advance·reschedule·alarm** - RED `8318e13` (test) → GREEN `fc50d19` (feat)
4. **Task 3 묶음 2: 알람 전이 테스트** - `75decc8` (test)
5. **Task 3 묶음 3: 전수 누출 검사** - `d214492` (test)

**Plan metadata:** 이 SUMMARY 의 docs 커밋 (STATE.md·ROADMAP.md 는 오케스트레이터 소유라 건드리지 않음)

## TDD 기록 (RED 증거)

- Task 1 RED: `join.test.ts` 6개가 모두 404 로 실패, `gsd-tools check tdd-red-evidence` 가 `RED_EVIDENCE_OK`. 의미 확인: 미구현 라우트가 `NOT_FOUND` 404 를 돌려주는 것이 계획된 단언(200/409/400)에서의 실패다.
- Task 2 RED: `join.test.ts` leave·kick 6개와 `reconnect.test.ts` 속도 제한 1개가 실패(`RED_EVIDENCE_OK`). 재접속·교체·evict·ghost·invalid_token 테스트는 01-02 구현을 고정하는 테스트라 처음부터 통과한다(계획 의도: "테스트로 고정").
- Task 3 묶음 1 RED: `start.test.ts` 6개가 모두 실패(`RED_EVIDENCE_OK`, start 가 `BAD_MESSAGE` 임시 응답).
- 묶음 2·3(alarm·leak)은 묶음 1 의 GREEN 이 advance·alarm 을 함께 구현해 RED 를 만들 수 없었다. 대신 변이 검사로 테스트가 실제로 잡는지 확인했다: 재시도 간격을 100초로 바꾸면 alarm 테스트가 실패, `assigning` 에서 역할 공개로 바꾸면 leak 테스트가 `expected 'doctor' to be undefined` 로 실패(변이는 모두 되돌림).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 낡은 소켓·제거된 사람의 닫힘이 불필요한 저장·방송을 일으킴**
- **Found during:** Task 2 (기기 교체 테스트 설계)
- **Issue:** `detachConnection` 은 항상 새 객체를 돌려줘 `next === this.room` 가드가 무의미했다. 교체된 소켓이나 leave·kick 으로 닫힌 소켓의 close 마다 put + 방송이 한 번 더 일어났다.
- **Fix:** `handleDisconnect` 가 방에 없거나 최신 `connId` 가 아니면 즉시 반환
- **Files modified:** worker/room.ts
- **Committed in:** ac88c49

**2. [Rule 1 - Bug, 테스트] 전수 누출 검사의 보조 호출이 7번째 참가자를 만듦**
- **Found during:** Task 3 묶음 3 (간헐 실패: 역할 구성이 구성표와 다름)
- **Issue:** 대기실 단계의 "늦은 참가" 탐침이 실제로 성공해 방이 7명이 되었다(구성표 7명 행이 적용). 서버 버그가 아니라 테스트 설계 오류.
- **Fix:** 대기실에서는 미리보기만, 시작 뒤에만 참가 오류 응답(409)을 모은다. 10회 연속 통과 확인.
- **Files modified:** test/worker/leak.test.ts
- **Committed in:** d214492

**3. [Rule 3 - 차단] 실패 보고(TAP)가 여러 줄 값에서 깨져 RED 증거 분류 불가**
- **Found during:** Task 2 RED
- **Issue:** 객체 단언의 여러 줄 actual 과 5초 타임아웃 문구가 TAP 을 깨뜨려 `INVALID_RED`
- **Fix:** `closed()` 가 제한 시간 뒤 `"0 not_closed"` 한 줄로 끝나고 소켓 닫힘·오류 프레임을 한 줄 문자열로 비교(`flat`). 도우미 설계이므로 helpers.ts 에 반영.
- **Committed in:** 15b877f

**4. 속도 제한 키 (계획 문구와 다른 구현)**
- 계획은 `Map<connId, ...>` 였으나 hello 전 소켓에는 connId 가 없고 계획 테스트(ping 30개)도 hello 없이 센다. `WeakMap<WebSocket, ...>` 로 구현했다. 하이버네이션으로 비면 새로 세는 수용 사항은 같다.

**5. 도우미 위치 조정**
- `seat`(방장 + 연결/미연결 참가자 꾸미기)·`storedRoom`·`alarmOf` 를 start.test 에서 helpers.ts 로 옮겼다(alarm·leak 이 재사용). 계획의 exports 목록에 더한 것이다.

---

**Total deviations:** 3 auto-fixed(Rule 1 ×2, Rule 3 ×1) + 계획 구현 조정 2건
**Impact on plan:** 범위 확장 없음. 모두 정확성·검증 가능성을 위한 것.

## Issues Encountered

- 워크트리에 `node_modules` 가 없어 메인 저장소의 `node_modules` 를 심볼릭 링크로 연결해 실행했다(설치 없음, 커밋하지 않음, 새 패키지 없음). 마칠 때 링크는 오케스트레이터가 워크트리를 지우며 함께 사라진다.
- 작업 도중 사용량 한도로 한 번 중단되었고, 커밋된 작업을 다시 하지 않고 이어서 실행했다.
- `cloudflare:test` 의 `runDurableObjectAlarm`·`evictDurableObject` 는 예상대로 동작했다. 알람 예외 재시도 테스트는 `reschedule` 을 한 번만 던지도록 인스턴스에 바꿔 끼워 검증한다.

## Deferred / 오케스트레이터에 넘기는 일

- **HANDOFF.md 갱신·push**: 이 실행에서는 하지 않았다. 병합 뒤 오케스트레이터가 main 에서 처리한다.
- **배포(`npm run deploy`)**: 하지 않았다. 계획에도 배포 단계는 없다.
- **STATE.md·ROADMAP.md**: 건드리지 않았다. REQUIREMENTS.md 의 체크박스 갱신도 오케스트레이터 몫이다(`requirements-completed` 는 위 frontmatter 에 있다).
- 리서치 가정 A4(조용한 단절의 close 지연)·A5(배포 때 소켓 끊김)·Open Question 7(좀비 connected=true 의 시작 조건 영향)은 하트비트 없이 받아들였다. 01-14 실기기 확인에서 관찰한다.

## Known Stubs

없음. 스텁·TODO·임시 응답이 남아 있지 않다(01-02 의 start·leave·kick `BAD_MESSAGE` 임시 분기는 모두 실제 처리기로 바뀌었다). `.planning/WINDOWS.md` 에 추가할 항목 없음.

## Threat Flags

위협 모델에 없는 새 보안 표면 없음. 새 HTTP 경로 2개(미리보기·참가)는 계획의 신뢰 경계(T-01-32 허용 목록 미리보기, T-01-35 닉네임 열거 수용)에 포함된다.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 화면 계획(참가·대기실·역할 카드)이 부를 라우트와 메시지(미리보기, 참가, leave, kick, start, 상태 방송)가 실제 workerd 에서 동작한다.
- 남은 것: 실기기에서 조용한 단절·배포 중 끊김 관찰(01-14).

## Self-Check: PASSED

- 생성 파일 7개 존재 확인, 커밋 8개(`2efd54d` … `d214492`) 모두 HEAD 의 조상
- `npm run typecheck` 오류 0, `npx vitest run` 33 파일 413 테스트 통과, `worker/room.ts` 에 `setTimeout`/`setInterval` 없음
- 각 Task acceptance_criteria 의 grep 기준 전부 통과

---
*Phase: 01-walking-skeleton*
*Completed: 2026-10-23*
