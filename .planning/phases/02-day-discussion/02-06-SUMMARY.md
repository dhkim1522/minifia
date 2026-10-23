---
phase: 02-day-discussion
plan: 06
subsystem: client-net
tags: [chat, emoji, seat-floats, websocket, korean-josa, tdd, client]

requires:
  - phase: 02-day-discussion
    provides: 02-01 의 ServerMessage emoji·ChatLine·DayView.messages·TEMPLATE_IDS·EMOJI_IDS, 02-03 의 서버 emoji 방송
provides:
  - useRoomConnection 의 emoji 수신(허용 목록)과 onEvent(listener) → 해제 함수 (ref 리스너 집합, 안정 참조, React 상태로 쌓지 않음)
  - RoomEvent 타입(emoji·error 프레임)
  - useSeatFloats(view, onEvent) — 자리마다 말풍선 3초·이모티콘 2초 하나, 서버 시각끼리 남은 시간 계산, 재접속 복원, 단계 전환 정리
  - messageText·hasBatchim — 템플릿 ID·대상 seat·직업으로 조사까지 맞는 문장, 빈칸 미리보기
  - TEMPLATE_ORDER·TEMPLATE_CHIP·EMOJI_TEXT — 시트용 문구 칩·이모티콘 이름 단일 출처
affects: [02-07, 02-09, 02-10]

tech-stack:
  added: []
  patterns:
    - "서버 이벤트는 상태가 아니라 ref 리스너 집합으로 흘린다 — 이벤트마다 전체 리렌더가 일어나지 않는다"
    - "말풍선 남은 시간은 BUBBLE_MS − (view.serverNow − line.at) — 시계 오프셋 불필요, 본 seq 를 ref 로 쥐어 첫 렌더가 곧 재접속 복원"
    - "만료는 가장 이른 until 에 맞춘 setTimeout 하나가 지운다, floats 가 바뀔 때마다 다시 건다"
    - "화면 문구(문장·칩·이모티콘 이름)는 src/game 의 한 파일, 직업 이름은 ROLE_TEXT 에서만 가져온다"

key-files:
  created:
    - src/net/seatFloats.ts
    - src/game/messageText.ts
    - test/client/seatFloats.test.tsx
    - test/unit/messageText.test.ts
  modified:
    - src/net/useRoomConnection.ts
    - test/client/useRoomConnection.test.tsx
    - test/client/roomScreen.test.tsx
    - test/client/phaseScreens.test.tsx

key-decisions:
  - "discussion 이 아닌 동안 도착한 emoji 이벤트는 floats 에 넣지 않는다 — 단계 전환 정리 규칙과 한 줄로 맞춘다"
  - "discussion 을 벗어나면 본 seq 를 −1 로 되돌린다 — 다음 토론에서 seq 가 어떻게 이어지든 3초 안 줄만 복원하는 규칙으로 시작한다"
  - "한 view 에 새 줄이 여럿이면 seq 오름차순으로 처리해 같은 자리에서는 나중 줄이 이기고 z 도 처리 순서대로 커진다"
  - "닉네임이 없어 [○○] 로 채워진 claimed 문장의 조사는 칩 문구와 같게 '는'"

patterns-established:
  - "TDD RED 는 뼈대(빈 구현)를 작업 트리에만 두고 assertion 실패를 확인한 뒤 test 커밋에는 테스트만 담는다(import 오류는 RED 가 아니다)"

requirements-completed: [COMM-01, COMM-02]

actuals:
  tokens: 6900
  tasks: 3
  commits: 6
plan_head_before: 5ebbdae86247190d35ce7c7bd108abe278ce8dec
plan_head_after: 5a0e9b74b4e5a8090cfcde4f99732686d1b09dcd
commits: 6

coverage:
  - id: F1
    description: "서버 emoji 프레임이 클라이언트 허용 목록을 통과해 onEvent 리스너에 전달되고(error 포함), 해제 뒤에는 오지 않으며, view 와 onEvent 참조는 바뀌지 않고, 알 수 없는 t 는 무시된다"
    requirement: "COMM-02"
    verification:
      - kind: unit
        ref: "test/client/useRoomConnection.test.tsx#useRoomConnection: 이벤트 구독 (emoji·error 프레임, Pitfall 6)"
        status: pass
    human_judgment: false
  - id: F2
    description: "자리마다 하나의 말풍선(3초, 서버 시각 기준, 재접속 시 3초 안 줄만 남은 시간만큼)·이모티콘(2초) 층이 계산되고 교체·z 증가·단계 전환 정리·언마운트 정리가 규칙대로 된다"
    requirement: "COMM-02"
    verification:
      - kind: unit
        ref: "test/client/seatFloats.test.tsx"
        status: pass
    human_judgment: false
  - id: F3
    description: "템플릿 ID·대상·직업으로 은/는·이었어요/였어요까지 맞는 문장이 만들어지고, 빈칸은 [○○]·[직업], 문구 칩 순서·글자와 이모티콘 이름이 UI-SPEC 과 같다"
    requirement: "COMM-01"
    verification:
      - kind: unit
        ref: "test/unit/messageText.test.ts"
        status: pass
      - kind: command
        ref: "npm run typecheck && npx vitest run --project unit --project client"
        status: pass
    human_judgment: false
---

# Phase 2 Plan 06: 클라이언트 메시지·이모티콘 계산 층 Summary

**서버 emoji 프레임을 onEvent 구독으로 흘리고, 자리별 말풍선 3초·이모티콘 2초 상태 훅(useSeatFloats)과 조사까지 맞는 한국어 문장 함수(messageText)를 화면 부품 없이 테스트로 고정했다.**

## Performance

- **Duration:** 약 3분 (벽시계 기준, 2026-10-23T17:59Z ~ 18:03Z)
- **Tasks:** 3 (트레이서 1 + 자동 2, 모두 TDD)
- **Files:** 신규 4, 수정 4
- **Commits:** 6 (test 3 + feat 3)

## Accomplishments

- **트레이서(Task 1):** `parseServerMessage` 허용 목록에 `"emoji"` 를 더해 Pitfall 6 을 막았다. 리스너 집합을 `useRef` 로 두고 emoji·error 프레임만 구독자에게 넘기며, `onEvent` 는 `useCallback` 으로 참조가 안정적이다. 이벤트를 React 상태로 쌓지 않아 이모티콘 폭주가 전체 리렌더로 번지지 않는다(T-02-22). state·pong 처리와 연결 상태기계는 그대로다. 트레이서 검증(세 테스트 파일 79개 통과)을 확장 작업 전에 다시 돌려 통과를 확인했다.
- **useSeatFloats(Task 2):** 서버 시각끼리 `BUBBLE_MS − (serverNow − at)` 로 남은 시간을 구해 재접속 첫 state 에서 3초가 안 지난 줄만 복원하고(elapsedMs 포함), 같은 자리는 새 것이 바꾸며 z 가 처리 순서대로 커진다. 같은 messages 로 새 view 가 와도 타이머를 늘리지 않는다. discussion 이 아니면 모두 비우고, 언마운트 시 구독·타이머를 푼다.
- **messageText(Task 3):** 다섯 템플릿 문장, 닉네임 받침에 따른 은/는(한글 아닌 끝 글자·이모지는 "는"), 직업 이름 받침에 따른 이었어요/였어요(`ROLE_TEXT` 단일 출처), 빈칸 미리보기 `[○○]`·`[직업]`, `TEMPLATE_ORDER`·`TEMPLATE_CHIP`·`EMOJI_TEXT`(grin 은 name "크게 웃음", cell "크게").

## Task Commits

| 작업 | RED | GREEN |
|------|-----|-------|
| 1 트레이서 onEvent | `e8fc83b` test | `c5ffc9f` feat |
| 2 useSeatFloats | `c37cb20` test | `fcfb1ce` feat |
| 3 messageText | `321ecec` test | `5a0e9b7` feat |

## TDD Gate Compliance

플랜 유형은 `execute` 이고 작업 단위로 `tdd="true"` 다. 세 작업 모두 `test(02-06)` → `feat(02-06)` 순서의 커밋이 있다. REFACTOR 커밋은 없다(변경할 만한 정리가 없었다).

RED 근거(작업별):

- **Task 1:** `useRoomConnection.test.tsx` 에 새로 더한 6개 중 5개가 `TypeError: hook.result.current.onEvent is not a function` 으로 실패, 기존 26개는 통과. 구현이 없다는 계획된 이유의 실패다. 구조화된 RED 증거 레코드 분류기(`check tdd-red-evidence`)는 플랜이 `type: tdd` 가 아니어서 돌리지 않았다.
- **Task 2:** 모듈이 없으면 import 오류라 RED 가 아니므로, 빈 `useSeatFloats`(항상 `{}`)를 작업 트리에만 두고 실행해 12개 중 7개가 값 단언(`expected undefined to be 'bubble'` 등)으로 실패하는 것을 확인했다. 상수 테스트 등 5개는 통과(상수 선언은 뼈대에도 있음). test 커밋에는 테스트 파일만 담았다.
- **Task 3:** 같은 방식의 빈 뼈대로 10개 모두 값 단언 실패를 확인한 뒤 test 커밋(테스트만).

## Decisions Made

key-decisions 참고. 계획 가정 두 개(이모티콘은 받은 순간 로컬 시각 + 2000ms, 이름 끝 글자는 마지막 UTF-16 코드 유닛)는 그대로 구현했다.

## Deviations from Plan

### 계획 문구 정정(코드 변경 아님)

**1. [계획 오기재] Task 3 behavior 의 "도현(받침 없음)"**
- **Found during:** Task 3 RED 작성
- **Issue:** 계획은 "도현(받침 없음)·mafia → '도현은 마피아였어요'" 라고 적었다. 괄호 설명과 기대 문장이 서로 어긋난다 — 도현의 끝 글자 '현'은 받침(ㄴ)이 있어 규칙상 "은" 이 맞고, 기대 문장이 규칙과 일치한다.
- **Fix:** 기대 문장(`도현은 마피아였어요`)을 그대로 테스트에 넣고 규칙을 따랐다. 괄호 설명만 무시했다.
- **Files modified:** test/unit/messageText.test.ts
- **Commit:** `321ecec`

**Total deviations:** 0 auto-fixed 코드 변경, 계획 문구 1건 정정. **Impact:** 없음.

## Issues Encountered

없음. `npm run typecheck` 와 `npx vitest run --project unit --project client`(37 파일, 764 테스트) 통과.

## Known Stubs

없음. 이 계획의 파일에 하드코딩 빈 값·자리표시 문구 스텁은 없다. 화면 연결(SeatFloat 부품, 시트, 로그)은 02-07·02-09 의 몫이며, 이 계획은 그 입력을 만드는 층이다.

## Threat Flags

없음. 새 네트워크 엔드포인트·권한 경로·스키마는 없다. T-02-21(문장은 클라이언트가 템플릿 ID 로 만들고 문자열만 반환, HTML 삽입 API 미사용), T-02-22(이벤트를 ref 리스너로 전달), T-02-SC(새 패키지 없음)는 그대로 지켜졌다.

## Next Phase Readiness

02-07(SeatFloat 부품)은 `useSeatFloats` 의 `SeatFloatState`(key·until·elapsedMs·z)를 그대로 그리면 되고, 02-09(시트·로그)는 `messageText`·`TEMPLATE_ORDER`·`TEMPLATE_CHIP`·`EMOJI_TEXT` 를 쓰면 된다. 막힌 것은 없다.

## Self-Check: PASSED

- 파일 존재: `src/net/seatFloats.ts`, `src/game/messageText.ts`, `test/client/seatFloats.test.tsx`, `test/unit/messageText.test.ts` 확인
- 커밋 존재: e8fc83b, c5ffc9f, c37cb20, fcfb1ce, 321ecec, 5a0e9b7 모두 HEAD 의 조상
- 인수 기준 grep 전부 통과, `git log --grep="^test\(02-06\):"` 3건
