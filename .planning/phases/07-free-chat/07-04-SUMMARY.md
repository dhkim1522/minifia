---
phase: 07-free-chat
plan: "04"
subsystem: ui
tags: [react, vitest, day-scene, user-record, chat-removal]

requires:
  - phase: 07-free-chat
    provides: "07-01~07-03 (결정 0058, 채팅 패널 선행 작업)"
provides:
  - "화면에서 순차 직업 주장 장치 제거: ClaimPanel·TurnPanel·claimLines 삭제, DayScene 의 claim 분기·차례 강조·주장 채팅 줄 제거"
  - "투표 기록만 그리는 유저 기록 카드: recordRows(seat, voteLog, nicknameOf), UserRecordSheet(voteLog 필수, claimLog 없음)"
  - "DayTableSeat 에서 turn 제거, 낮 기록 버튼 읽기 이름 '{닉네임}, 기록 보기'"
  - "클라이언트 시험의 claim 단계 픽스처를 discussion·dayAnnounce 로 이동"
affects: [07-07, 07-08, 07-09]

actuals:
  tokens: 46000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "점검표 단계 목록은 as const satisfies readonly PhaseId[] 로 두어 PhaseId 변경(07-08)에 휘둘리지 않게 한다"

key-files:
  created: []
  modified:
    - src/screens/DayScene.tsx
    - src/components/DayTable.tsx
    - src/components/UserRecordSheet.tsx
    - src/game/recordRows.ts
    - src/styles/daytable.css
    - test/unit/recordRows.test.ts
    - test/client/userRecordSheet.test.tsx
    - test/client/dayScene.test.tsx
    - test/client/dayTable.test.tsx
    - test/client/guide.test.tsx
    - test/client/phaseScreens.test.tsx
    - test/client/characterAudit.test.tsx
    - test/client/testTools.test.tsx
    - test/client/nightScene.test.tsx
    - test/client/candidateVote.test.tsx
    - test/client/execVote.test.tsx
  deleted:
    - src/components/ClaimPanel.tsx
    - src/components/TurnPanel.tsx
    - src/net/claimLines.ts
    - test/client/claimPanel.test.tsx
    - test/client/turnPanel.test.tsx
    - test/unit/claimLines.test.ts

key-decisions:
  - "A1: 07-08 전까지 서버가 claim 단계 view 를 보내면 DayScene 은 일반 낮 단계로 그리고 하단 패널은 비운다(배포 전 상태)"
  - "A2: 낮 기록 버튼 읽기 이름은 '{닉네임}, 기록 보기' — 카드에 주장 줄이 없어 '주장 기록' 이 틀린 말이 된다"
  - "말풍선 클래스는 mf-dt__bubble--spoke 하나만 남기고 --turn 변형을 지웠다. daytable.css 에는 --turn 규칙이 원래 없어 주석 한 줄만 고쳤다"

patterns-established:
  - "화면 시험 픽스처는 PhaseId 의 claim 을 쓰지 않는다 — 07-08 이 PhaseId 에서 claim 을 뺄 때 화면 시험을 다시 고치지 않게 한다"

requirements-completed: [CHAT-06]

coverage:
  - id: D1
    description: "ClaimPanel·TurnPanel·claimLines 와 그 시험이 삭제되고 DayScene 이 claim 단계 분기·차례 강조·주장 채팅 줄·'낮 · 직업 공개' 제목을 그리지 않는다"
    requirement: CHAT-06
    verification:
      - kind: unit
        ref: "test/client/dayScene.test.tsx (낮 토론 하단·테이블, 후광·말풍선)"
        status: pass
      - kind: other
        ref: "test ! -e src/components/ClaimPanel.tsx && test ! -e src/components/TurnPanel.tsx && test ! -e src/net/claimLines.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "유저 기록 카드는 투표 기록(처형 여부 집계·후보 선택)만 그리고, 기록이 없으면 '아직 기록이 없어요' 를 그대로 보여 준다"
    requirement: CHAT-06
    verification:
      - kind: unit
        ref: "test/unit/recordRows.test.ts, test/client/userRecordSheet.test.tsx"
        status: pass
    human_judgment: false
  - id: D3
    description: "DayTable 에 차례 후광·차례 말풍선·'지금 주장하는 차례' 읽기 이름이 없고 낮 기록 버튼 읽기 이름이 '{닉네임}, 기록 보기' 다"
    requirement: CHAT-06
    verification:
      - kind: unit
        ref: "test/client/dayTable.test.tsx#DayTable: 후광 + '…' 말풍선 (결정 0030)"
        status: pass
    human_judgment: false
  - id: D4
    description: "클라이언트 시험의 claim 픽스처가 일반 낮 단계로 옮겨졌고 전체 vitest·두 tsc·vite build 가 초록이다(skip·todo 0건)"
    requirement: CHAT-06
    verification:
      - kind: other
        ref: "npx vitest run (141 files, 3849 passed) · npm run typecheck · npx vite build"
        status: pass
    human_judgment: false
  - id: D5
    description: "주장 장치를 대체하는 새 버튼·칩·안내 문장을 만들지 않았다(UI-SPEC 쓰지 않을 것)"
    verification: []
    human_judgment: true
    rationale: "금지 항목(prohibition)은 자동 검사로 증명되지 않는 판단 사항이다 — 변경에 새 UI 요소가 없다는 점은 diff 로 확인했다"

duration: 8min
completed: 2026-11-01
status: complete
plan_head_before: bb30c436ad40b42dc768bf23164ae5a780ec0358
plan_head_after: b3cfce1d99e3e8b889bcccf22d14978d28c63d4b
commits: 3
---

# Phase 7 Plan 04: 순차 직업 주장 화면 제거 Summary

**ClaimPanel·TurnPanel·claimLines 를 지우고 DayScene·DayTable·UserRecordSheet 에서 주장·차례 표시를 걷어내, 기록 카드는 투표 기록(`recordRows(seat, voteLog, nicknameOf)`)만 그리며 클라이언트 시험의 claim 픽스처는 모두 일반 낮 단계로 옮겼다.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-11-01T12:43:14Z
- **Completed:** 2026-11-01T12:51:02Z
- **Tasks:** 3
- **Files modified:** 22 수정 + 6 삭제 (diff 28 파일, +358/−1368)

## Accomplishments

- 화면 코드가 `claimLog`·`turn` 을 읽지 않는다. 서버·와이어(shared/protocol.ts)는 손대지 않아 전체가 초록이다(서버 제거는 07-08).
- 기록 카드 행은 `exec`·`cand` 두 종류뿐이다(처형 여부 집계, 후보 선택 줄은 공개 뒤에 이 사람의 줄이 있을 때만).
- DayTable 후광은 `pick.mine`(흰)·`isAlly`(진홍)만 파생하고, 말풍선은 `spoke` 일 때만 `mf-dt__bubble--spoke` 로 그린다.
- 시험: dayScene·dayTable·guide·phaseScreens·characterAudit·testTools 의 주장 단언을 지우거나 discussion·dayAnnounce 기준으로 다시 썼고, 나머지 일곱 파일의 claim 픽스처를 옮겼다. guide 점검표는 `as const satisfies readonly PhaseId[]` 의 13단계 목록으로 바꿔 PhaseId 변화에 영향받지 않게 했다.

## Task Commits

1. **Task 1: 주장 화면 파일 삭제와 DayScene·DayTable·UserRecordSheet·recordRows 정리** - `c75f18c` (refactor)
2. **Task 2: 주장 단언이 많은 화면 시험 정리** - `b335e46` (test)
3. **Task 3: 나머지 화면 시험의 claim 픽스처 옮기기, 전체 초록** - `b3cfce1` (test)

**Plan metadata:** 이 SUMMARY 와 STATE·ROADMAP·REQUIREMENTS 갱신은 별도 docs 커밋.

## Files Created/Modified

- `src/screens/DayScene.tsx` - claim import·분기·`turnSeat`·`dayLines`·claim 제목·calm 조건 제거, UserRecordSheet 에 voteLog 만 전달, 하단은 `chatLines` 사용
- `src/components/DayTable.tsx` - `turn` prop 제거, 후광·말풍선·읽기 이름 정리, 기록 버튼 `, 기록 보기`
- `src/components/UserRecordSheet.tsx` - 투표 기록 카드(`voteLog` 필수)
- `src/game/recordRows.ts` - `recordRows(seat, voteLog, nicknameOf)`, `RecordRowKind = "exec" | "cand"`
- `src/styles/daytable.css` - 말풍선 주석에서 주장 차례 문구 정리(--turn 규칙은 원래 없었다)
- 삭제 6개: ClaimPanel·TurnPanel·claimLines 와 그 시험
- 시험 16개 수정(위 key-files 참고)

## Decisions Made

- A1·A2 는 plan 가정 그대로 따랐다(key-decisions 참고).
- `src/game/roleText.ts` 의 CLAIM_LINE·CLAIM_JOSA·claimName 은 plan 지시대로 두었다(messageText 가 쓰며 07-07 이 정리). 그 때문에 `claimName` 시험(dayTable.test 의 describe)만 지웠다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 기록 버튼 읽기 이름을 쓰는 plan 밖 시험 두 파일 갱신**
- **Found during:** Task 3 (전체 vitest)
- **Issue:** `test/client/candidateVote.test.tsx`, `test/client/execVote.test.tsx` 가 `"{닉네임}, 주장 기록 보기"` 로 버튼을 찾아 DayTable 라벨 변경(A2) 뒤 실패했다. plan 의 files_modified 에는 없었다.
- **Fix:** 라벨 문자열을 `", 기록 보기"` 로 바꿨다(단언 구조는 그대로).
- **Files modified:** test/client/candidateVote.test.tsx, test/client/execVote.test.tsx (nightScene.test.tsx 의 같은 라벨도 함께)
- **Verification:** `npx vitest run` 전체 통과
- **Committed in:** b3cfce1

### Acceptance gate 예외 (미충족 항목 기록)

**2. `git grep -F '"claim"' -- test/client test/helpers` 가 `test/client/seatFloats.test.tsx` 5줄에서 걸린다.**
- plan 의 이 게이트는 화면 시험에서 claim 단계 이름을 없애는 것이 목적이지만, `seatFloats.test.tsx` 는 plan 의 files_modified 에 없는 파일로 살아 있는 `src/net/seatFloats.ts`(FLOAT_PHASES 에 "claim" 포함, 이 plan 이 건드리지 않는 파일)의 동작을 검사한다. 이 단언을 지우면 살아 있는 코드의 검사를 줄이게 되고, 07-07 이 `seatFloats.ts` 와 `seatFloats.test.tsx` 를 파일째 지운다(07-07-PLAN 확인). 그래서 손대지 않았다.
- 그 파일을 뺀 나머지는 게이트를 통과한다(`git grep ... | grep -v seatFloats` 가 exit 1).
- **07-07 이 이 파일을 지우면 게이트가 자동 충족된다.** 07-08 이 PhaseId 에서 claim 을 빼기 전에 07-07 이 끝나야 한다는 plan 순서와 일치한다.

---

**Total deviations:** 1 auto-fixed (Rule 3), 1 acceptance gate 예외(seatFloats.test.tsx, 07-07 이 해소)
**Impact on plan:** 범위 확장은 라벨 문자열 두 파일뿐이다.

## Issues Encountered

- `npx vitest run` 의 skipped 1건은 `test/unit/camera.test.ts` 의 기존 동적 skip 이다(이 plan 이 만든 것이 아니다). `git grep -F -e ".skip(" -e ".todo(" -- test` 는 0건이다.

## Known Stubs

없음.

## Threat Flags

없음. 새 네트워크 경로·권한·스키마 변화가 없다(T-07-09 accept, T-07-SC 패키지 설치 없음).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 07-05 이후 계획 진행 가능. 07-07 이 seatFloats 를 지워야 07-08 이 PhaseId 에서 claim 을 뺄 수 있다.
- 남은 화면 쪽 claim 흔적: `RoomScreen` 의 `claimAnnounce`/PHASE_ANNOUNCE 단계 이름 표, `scenes.ts`, `TestTools` 단계 라벨(07-08), 테스트 픽스처의 `claimLog: []`(07-09). `DayView.claimLog` 는 필수 타입 그대로다.

## Self-Check: PASSED

- 삭제 파일 6개 부재, 수정 파일 존재 확인.
- 커밋 `c75f18c`, `b335e46`, `b3cfce1` 이 HEAD 의 조상임을 확인(`git rev-list --count` 3).
- `npx vitest run` 141 files / 3849 passed, `npm run typecheck` exit 0, `npx vite build` 성공.

---
*Phase: 07-free-chat*
*Completed: 2026-11-01*
