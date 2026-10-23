---
phase: 01-walking-skeleton
plan: 11
subsystem: net
tags: [websocket, reconnect, state-machine, react, vitest, clock-offset]
type: tdd

requires:
  - phase: 01-walking-skeleton
    provides: "01-02 임시 재연결 훅·RoomScreen, 01-06 getPreview·App onExit, 01-08 Icon·Button"
provides:
  - "linkReducer: 순수 연결 상태기계(보이는 시간만 세는 30초 포기, restored 2초, 방 소멸)"
  - "useRoomConnection: 지수 백오프·복귀 ping 점검·ping 표본 오프셋·epoch·canSend·retry"
  - "ReconnectBanner: 52px 재접속 띠"
  - "RoomScreen 틀: 띠·연결 중·포기·다른 창·나가게 된 이유"
affects: [01-12, 01-13, 01-14, 로비 토스트(epoch), 카운트다운(offset)]

actuals:
  tokens: 13000
  tasks: 3
  commits: 6
plan_head_before: 3314e7cce8401e45914200a29e804716ec3ffe6a
plan_head_after: a809e0372c5c5f219a842be7bc9858c8f467ed46

tech-stack:
  added: []
  patterns:
    - "순수 리듀서 + ref 동기화: useState 와 linkRef 를 함께 갱신해 전이 결과를 바로 읽고 재시도·방 확인을 정한다"
    - "시각은 이벤트의 now 로만 받는 리듀서(내부 Date.now 없음)"
    - "스스로 닫은 소켓의 close 는 socketRef 불일치로 무시"

key-files:
  created:
    - src/net/linkReducer.ts
    - src/components/ReconnectBanner.tsx
    - src/styles/room.css
    - test/unit/linkReducer.test.ts
    - test/client/roomScreen.test.tsx
  modified:
    - src/net/useRoomConnection.ts
    - src/screens/RoomScreen.tsx
    - test/client/useRoomConnection.test.tsx

key-decisions:
  - "useReducer 대신 useState + linkRef 로 linkReducer 를 돌린다 — 닫힘 직후 결과 상태(attempts·visible)를 같은 틱에 읽어 재시도 예약·방 생존 확인을 정해야 해서"
  - "retry 이벤트는 failed 뿐 아니라 replaced 에서도 connecting 으로 되돌린다([다시 연결]이 같은 경로를 씀)"
  - "30초 판정은 reconnecting 과 failingSince 가 있는 connecting(재시도 직후 소켓이 매달린 경우) 모두에 적용"
  - "방 생존 확인은 attempts 가 처음 3에 닿을 때 한 묶음에 한 번, 서버 변경 없이 getPreview 로"

patterns-established:
  - "숨겨진 동안은 재시도를 예약하지 않고 visibilitychange·pageshow·online 이 즉시 연결/ping 점검을 일으킨다"

requirements-completed: [CONN-01, GAME-01]

coverage:
  - id: D1
    description: "연결이 끊기면 방 화면 맨 위 52px 띠가 본문을 밀어내고, 다시 붙으면 '다시 연결됐어요' 2초 뒤 사라진다"
    requirement: CONN-01
    verification:
      - kind: unit
        ref: "test/unit/linkReducer.test.ts#다시 open 하면 epoch 2, 첫 state 가 오면 restored 띠가 2초 뒤 사라진다"
        status: pass
      - kind: unit
        ref: "test/client/roomScreen.test.tsx#view 가 있고 reconnecting 이면 본문보다 앞에 52px 띠"
        status: pass
    human_judgment: true
    rationale: "52px·night-700 면의 실제 모습과 본문이 밀리는 느낌은 화면으로 봐야 한다(배포본 실기기는 01-14)"
  - id: D2
    description: "지수 백오프(0.5초~5초)+지터, 숨김 중 예약 없음, 복귀·online 즉시 재시도, 복귀 ping 2.5초 점검"
    requirement: CONN-01
    verification:
      - kind: unit
        ref: "test/client/useRoomConnection.test.tsx#재연결 (CONN-01)"
        status: pass
    human_judgment: true
    rationale: "iOS 화면 잠금 복귀 동작(가정 A3)은 실기기에서만 확인된다(01-14)"
  - id: D3
    description: "보이는 시간 30초 연속 실패만 포기 화면('연결할 수 없어요' + 다시 시도·처음으로)으로 보낸다"
    requirement: CONN-01
    verification:
      - kind: unit
        ref: "test/unit/linkReducer.test.ts#linkReducer: 보이는 시간만 세는 30초 포기"
        status: pass
      - kind: unit
        ref: "test/client/useRoomConnection.test.tsx#꺼져 있던 시간은 세지 않는다"
        status: pass
      - kind: unit
        ref: "test/client/roomScreen.test.tsx#failed 면 '연결할 수 없어요'"
        status: pass
    human_judgment: false
  - id: D4
    description: "3번 연속 실패 시 getPreview 로 방 생존 확인, 404 면 room_closed 로 방 화면을 떠난다"
    requirement: CONN-01
    verification:
      - kind: unit
        ref: "test/client/useRoomConnection.test.tsx#낡은 세션 확인 (Pitfall 22)"
        status: pass
    human_judgment: false
  - id: D5
    description: "접속 직후 ping 3개 표본의 최단 왕복으로 시계 오프셋을 정하고(첫 pong 전 0), 열릴 때마다 epoch 증가"
    requirement: GAME-01
    verification:
      - kind: unit
        ref: "test/client/useRoomConnection.test.tsx#첫 pong 전에는 offset 0, pong 이 서버시각+5000 을 돌려주면 약 5000"
        status: pass
      - kind: unit
        ref: "test/client/useRoomConnection.test.tsx#소켓이 열릴 때마다 epoch 가 1씩 늘어난다"
        status: pass
    human_judgment: false
  - id: D6
    description: "4001(다른 창) 화면과 4003(내보내짐·방 닫힘·입장 정보 무효) 이유별 나가기, 토큰은 소켓 주소에 없음"
    requirement: CONN-01
    verification:
      - kind: unit
        ref: "test/client/roomScreen.test.tsx#replaced 면 '다른 창에서 이 방에 들어갔어요'"
        status: pass
      - kind: unit
        ref: "test/client/useRoomConnection.test.tsx#열리면 hello{token} 을 보내고, 토큰은 주소에 없다"
        status: pass
    human_judgment: false

duration: 약 58분(중간에 세션 속도 제한으로 멈춘 시간 포함이라 참고용)
started: 2026-10-23T05:17:47Z
completed: 2026-10-23
status: complete
---

# Phase 1 Plan 11: 연결 상태기계와 재접속 띠 Summary

**순수 상태기계(linkReducer) 위에 지수 백오프·화면 복귀 ping 점검·보이는 시간만 세는 30초 포기·ping 표본 시계 오프셋을 올리고, 방 화면 맨 위에 52px 재접속 띠를 붙였다.**

## Performance

- **Duration:** 약 58분 (세션 속도 제한 대기 포함)
- **Started:** 2026-10-23T05:17:47Z
- **Completed:** 2026-10-23T06:15:50Z
- **Tasks:** 3 (트레이서 1 + auto 2, 모두 TDD)
- **Files modified:** 8 (생성 5, 수정 3)

## Accomplishments

- `linkReducer`: open·state·close(1006 / 4001 / 4003)·visibility·tick·retry·roomGone 전이를 시각 주입 순수 함수로. 보이는 상태의 첫 실패 시각만 `failingSince` 로 세고, 숨기면 비운다(Pitfall 21).
- `useRoomConnection` 교체: 백오프 `min(5000, 500·2^(n-1)) + 지터`, 숨김 중 예약 없음, `visibilitychange`·`pageshow`·`online` 즉시 재시도, 열린 소켓은 복귀 때 ping 후 2.5초 내 pong 없으면 폐기, 접속 직후 ping 3개 → `estimateOffset`(최근 5개), `epoch`·`canSend`·`retry`·`checkRoom` 추가.
- `ReconnectBanner` + `room.css`: 흐름 안 52px 띠, `--night-700` 면, `--gray-100` 글자, "연결이 끊겼어요 · 다시 연결하는 중" / "다시 연결됐어요". 진홍 미사용.
- `RoomScreen` 틀: 띠 + `.mf-room__body`(띠가 생기면 장면이 줄어듦), 연결 중, 다른 창(`다시 연결`/`처음으로`), 포기(`연결할 수 없어요` / `다시 시도` / `처음으로` → `gaveUp`), `removed` 는 이유와 함께 `onExit`.
- 링크 참가 화면으로 가는 `invalid_token`, 오류 화면으로 가는 `kicked`·`room_closed` 는 기존 App 분기를 그대로 사용(코드 변경 없음, `gaveUp` 은 default 분기).

## TDD 기록

각 Task 마다 RED(`test`) → GREEN(`feat`) 순서. RED 대상 테스트는 `gsd_run check tdd-red-evidence` 로 `RED_EVIDENCE_OK` 를 받았다(단일 대상 테스트만 `-t` 로 돌려 TAP 을 깨끗하게 만든 뒤 판정).

| Task | RED 커밋 | 대상 테스트 | RED 근거(의미 평가) |
|------|----------|-------------|--------------------|
| 1 | `0a3c88f` | linkReducer "open 은 open·attempts 0·epoch 1…" | 뼈대가 컴파일되고 대상 테스트가 `status open` 단언에서 `connecting` 으로 실패. 로드·문법 오류 아님 |
| 2 | `704cb79` | linkReducer "보이는 상태에서 29_999 는 그대로, 30_000 이면 failed…" | 30초 규칙 부재로 `failed` 단언 실패 |
| 3 | `913de56` | useRoomConnection "3번 연달아 닫히면 checkRoom 이 한 번 불리고, gone 이면 removed" | `checkRoom` 호출 횟수 단언 실패 |

GREEN 커밋: Task 1 `c8453db`, Task 2 `b1d7b97`, Task 3 `a809e03`. REFACTOR 커밋은 없음(변경 불필요).

RED 커밋에는 테스트가 불러오는 컴파일용 뼈대(Task 1 의 `linkReducer.ts`, Task 2 의 `retryDelayMs`·훅 옵션 타입)가 함께 들어 있다. 뼈대가 없으면 로드 실패(INVALID_RED)가 되기 때문이다.

참고: `roomScreen.test.tsx` 의 실패 TAP 은 testing-library 의 DOM 덤프가 섞여 분류기가 "Non-TAP data" 로 거절하므로, RoomScreen 쪽 RED 는 분류기 대신 실제 단언 실패 메시지(요소를 찾지 못함)로 의미 평가를 했다.

## Task Commits

1. **Task 1: 트레이서** — `0a3c88f` (test), `c8453db` (feat)
2. **Task 2: 백오프·복귀 점검·30초·오프셋** — `704cb79` (test), `b1d7b97` (feat)
3. **Task 3: 포기 화면·방 확인·나가는 이유** — `913de56` (test), `a809e03` (feat)

**Plan metadata:** 이 SUMMARY 의 `docs(01-11)` 커밋

트레이서 게이트: `human_verify_mode=end-of-phase`, 자동 모드 아님, `<verify>` 가 `<automated>` 뿐이라 `npx vitest run …` 과 `npm run typecheck` 를 다시 돌려 통과 확인 후 확장 Task 로 진행(⚡ Tracer verified end-to-end — expanding).

## Files Created/Modified

- `src/net/linkReducer.ts` — 연결 상태기계, `retryDelayMs`, 상수(`FAIL_AFTER_MS` 30_000, `RESTORED_MS` 2_000, `STALE_CHECK_AFTER` 3)
- `src/net/useRoomConnection.ts` — 상태기계를 쓰는 연결 훅(교체)
- `src/components/ReconnectBanner.tsx` — 52px 재접속 띠
- `src/screens/RoomScreen.tsx` — 방 화면 틀(`ExitReason` 에 `gaveUp` 추가)
- `src/styles/room.css` — `.mf-reconnect`(52px), `.mf-room`, `.mf-room__body`, `.mf-room__notice`, `.mf-phase`
- `test/unit/linkReducer.test.ts`, `test/client/roomScreen.test.tsx`(신규), `test/client/useRoomConnection.test.tsx`(새 오프셋 모델로 교체·확장)

## Decisions Made

- `useReducer` 대신 `useState` + `linkRef` 로 `linkReducer` 를 돌렸다. 닫힘 직후의 결과 상태(attempts·visible)를 같은 틱에 읽어 재시도 예약과 방 생존 확인을 정해야 하기 때문이다. 계획의 "useReducer(linkReducer)" 와 동작은 같고 리듀서는 그대로 순수다.
- `retry` 이벤트를 failed 뿐 아니라 replaced 에서도 받는다. `[다시 연결]` 이 `reconnect()` = `retry()` 로 같은 경로를 쓴다.
- 30초 판정을 `failingSince` 가 있는 `connecting` 에도 적용해, [다시 시도] 직후 소켓이 연결에 매달려도 포기 화면으로 돌아오게 했다.
- 복원 띠는 1초 tick 외에 state 수신 때 `RESTORED_MS` 타이머를 따로 두어 2초 가까이에서 사라지게 했다.

## Deviations from Plan

None - 계획대로 실행했다. (구현 선택 두 가지 — `useState`+ref, retry 의 replaced 허용 — 는 위 "Decisions Made" 에 적었고 must_haves 를 바꾸지 않는다.)

**Total deviations:** 0
**Impact on plan:** 없음.

## Issues Encountered

- 세션 속도 제한으로 Task 1 GREEN 도중 한 번 멈췄다가 재개했다. 커밋된 작업은 다시 하지 않았다.
- TAP 분류기가 testing-library DOM 덤프 또는 여러 실패의 여러 줄 메시지를 "Non-TAP data" 로 보았다. 대상 테스트 한 건만 `-t` 로 돌려 해결했다(위 TDD 기록 참고).

## Authentication Gates

None.

## Known Stubs

없음. (RED 단계 뼈대는 모두 GREEN 에서 실제 구현으로 교체됨.)

## Threat Flags

없음. 토큰은 소켓 주소에 없고 `hello` 본문으로만 간다(T-01-39, 테스트로 확인). 재연결은 지수 백오프 상한 5초 + 지터, 숨김 중 예약 없음, 30초 포기, 방 소멸 확인으로 폭주가 막힌다(T-01-40). 새 패키지 설치 없음(T-01-SC).

## Deferred / 미룬 항목

- **웨이브 5 push 미룸 — 병합 뒤 main 에서 HANDOFF 한 줄 갱신과 git push origin main 필요** (이 실행은 연결된 워크트리·병렬 실행이며, 오케스트레이터 지시로 HANDOFF.md·STATE.md·ROADMAP.md 는 건드리지 않고 push·배포도 하지 않았다. 다음 웨이브 끝 push 나 01-14 가 함께 올린다.)
- 포기 화면까지의 30초(`FAIL_AFTER_MS`), 백오프 상한 5초, 방 생존 확인 3번째 실패, pong 대기 2.5초는 가정 값이다. 상수 하나씩으로 두었고 6페이즈 플레이테스트에서 조정한다.
- iOS 화면 잠금 복귀 동작(가정 A3)과 배포본 시계 오프셋 실측은 01-14 실기기 확인에서 본다.
- `canSend` 로 서버 입력을 막는 일은 노출만 했다. 화면 버튼 연결은 01-13 이 Lobby 에 넘길 때 한다.
- 단계 화면(`assigning`·`roleReveal`·`day`)은 아직 빈 `.mf-phase` 자리다(01-13).

## Next Phase Readiness

01-12 가 옛 스타일 파일을 지울 때 `RoomScreen` 이 `.screen`·`.notice` 클래스를 더는 쓰지 않으므로 남는 사용처가 없다(단, `Lobby` 는 아직 `.screen lobby` 를 쓴다 — 01-12 교체 대상). 블로커 없음.

## Self-Check: PASSED

- 생성 파일 존재: `src/net/linkReducer.ts`, `src/components/ReconnectBanner.tsx`, `src/styles/room.css`, `test/unit/linkReducer.test.ts`, `test/client/roomScreen.test.tsx` 확인.
- 커밋 존재(HEAD 의 조상): `0a3c88f`, `c8453db`, `704cb79`, `b1d7b97`, `913de56`, `a809e03` 확인.
- 계획 검증: `npx vitest run test/unit/linkReducer.test.ts test/client/useRoomConnection.test.tsx test/client/roomScreen.test.tsx test/unit/roomSocketUrl.test.ts` 43 통과, `npm run typecheck` 통과, `npx vitest run --project unit --project client` 25 파일·394 테스트 통과, `room.css` 에 `crimson` 없음.
- acceptance_criteria: Task 1(A1~A4), Task 2(B1~B3), Task 3(C1~C3) 모두 PASS.

---
*Phase: 01-walking-skeleton*
*Completed: 2026-10-23*
