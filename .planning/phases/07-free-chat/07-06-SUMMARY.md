---
phase: 07-free-chat
plan: "06"
subsystem: client-defense-screen
tags: [defense, removal, quick-message, emoji, react, css]

requires:
  - phase: 07-free-chat
    provides: "07-04 가 정한 로비·낮 채팅 입구 교체 전 상태(변론 하단은 아직 옛 칩·이모티콘 부품)"
provides:
  - "최후 변론 하단이 후보 본인을 포함한 모두에게 같은 DefensePanel 상태 줄(탈락자는 관전 알약)이다"
  - "DefenseChips·236 높이 칩 패널·변론 채팅 줄·이모티콘 버튼/트레이가 src 에서 없다"
  - "defenseAnnounce(null) = '내 최후 변론'"
affects: [07-07, 07-11, 07-12, 07-15]

actuals:
  tokens: 16700
  tasks: 2
  commits: 2
  plan_head_before: 260725a3977e8309cc28cb34e3c44ffb9fed15b4
  plan_head_after: 2c530a858367b224f1f62335a6895533ed87b4c4

tech-stack:
  added: []
  patterns:
    - "삭제 계획은 공유 부품(MessageLog·EmojiTraySheet·useSendLock) 파일을 두고 변론 쪽 사용만 끊어 중간 상태에서도 빌드·시험이 초록이다"

key-files:
  created: []
  modified:
    - src/components/DefensePanel.tsx
    - src/screens/verdictScene.tsx
    - src/screens/DayScene.tsx
    - src/screens/RoomScreen.tsx
    - src/game/verdict.ts
    - src/styles/verdict.css
    - docs/screen-map.md
    - test/client/defense.test.tsx
    - test/client/execution.test.tsx
    - test/client/guide.test.tsx
    - test/client/verdictStates.test.tsx
    - test/unit/verdict.test.ts
    - test/unit/verdictCss.test.ts
    - test/helpers/verdictViews.ts
  deleted:
    - src/components/DefenseChips.tsx
    - test/client/defenseChips.test.tsx

key-decisions:
  - "후보 본인의 변론 하단은 다른 산 사람과 같은 DefensePanel 상태 줄({이름}님이 변론하는 중 · N초)이다. UI-SPEC 에 후보 전용 문구가 없어 새 문장을 만들지 않았다(결정 0051, 가정 A3)"
  - "변론 aria-live 안내는 후보 본인이면 '내 최후 변론' 으로 줄였다. 칩이 없어져 '변론할 말을 고르세요' 가 틀린 말이 된다(가정 A2). 07-15 가 채팅 패널과 함께 다시 본다"
  - "VerdictScene.panelClassName 필드와 DayScene 의 사용을 함께 지웠다 — 쓰는 곳이 변론 후보 본인의 tall 하나뿐이었다"

requirements-completed: [CHAT-06]

coverage:
  - id: D1
    description: "최후 변론 하단에 빠른 메시지 칩·이모티콘 버튼/트레이·변론 채팅 줄·236 패널이 없고, 후보 본인도 남과 같은 상태 줄뿐이다"
    requirement: "CHAT-06"
    verification:
      - kind: unit
        ref: "test/client/defense.test.tsx#defense 화면 한 경로 (후보 본인 하단 단언)"
        status: pass
      - kind: unit
        ref: "test/client/verdictStates.test.tsx#내가 후보인 변론 화면 (D-36, D-09, CHAT-06)"
        status: pass
      - kind: command
        ref: "git grep -n -E 'DefenseChips|defenseSent|DEFENSE_SENT_MS|panel--tall|defenseChooseTitle|변론할 말을 고르세요' -- src test  (exit 1)"
        status: pass
    human_judgment: false
  - id: D2
    description: "변론 단계 aria-live 안내가 후보 본인이면 '내 최후 변론'"
    requirement: "CHAT-06"
    verification:
      - kind: unit
        ref: "test/unit/verdict.test.ts#읽기용 단계 안내와 보조 문구 함수"
        status: pass
      - kind: unit
        ref: "test/client/defense.test.tsx#후보 본인: 안내 `1일차 · 내 변론`"
        status: pass
    human_judgment: false
  - id: D3
    description: "공유 부품을 남겨 빌드·전체 시험·두 tsc 가 초록이다"
    verification:
      - kind: other
        ref: "npx vitest run (143 파일 통과), npm run typecheck, npx vite build"
        status: pass
    human_judgment: false
  - id: D4
    description: "변론 하단이 상태 줄 한 줄만 남아 몰입·보기 좋음이 받아들일 만한가(07-15 의 채팅 패널 전까지의 중간 상태)"
    verification: []
    human_judgment: true
    rationale: "화면 인상은 시험이 판정하지 않는다. 가정 A1 상 이 중간 상태는 배포되지 않고 07-15 에서 채팅 패널이 들어온다"

duration: 5min
completed: 2026-11-01
status: complete
---

# Phase 07 Plan 06: 최후 변론 하단의 칩·이모티콘 걷어내기 Summary

**최후 변론 하단에서 변론 칩 6개·236 높이 패널·변론 채팅 줄·이모티콘 버튼을 지우고, 후보 본인까지 모두 같은 DefensePanel 상태 줄(탈락자는 관전 알약)로 통일했다.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-11-01T13:05:49Z
- **Completed:** 2026-11-01T13:11:00Z
- **Tasks:** 2
- **Files modified:** 14 수정 + 2 삭제

## Accomplishments

- `DefenseChips.tsx` 와 `defenseChips.test.tsx` 를 지웠다. `DefensePanel` 은 `lines`·`showToast`·`MessageLog`·`EmojiTraySheet`·`useSendLock` 없이 상태 줄과 관전 알약만 그린다.
- `useVerdictScene` ctx 에서 `lines` 를, `verdict.ts` 에서 `DEFENSE_SENT_MS`·`defenseSent`·`defenseChooseTitle/Hint` 를, `verdict.css` 에서 변론 칩 격자와 `--tall` 규칙을 지웠다.
- `defenseAnnounce(null)` 이 "내 최후 변론" 을 돌려준다. RoomScreen 주석도 맞췄다.
- 시험은 칩·tall·이모티콘·변론 say/chat 전송 단언을 지우고, 후보 본인 하단이 상태 줄 하나뿐이며 입구(버튼·입력)가 없다는 단언으로 바꿨다. skip·todo 는 만들지 않았다.
- 낮 토론·밤의 `MessageLog`·`DiscussionControls`, 머리 위 말풍선·이모티콘, 서버·와이어는 건드리지 않았다(07-07, 07-11·07-12 몫).

## Task Commits

1. **Task 1: 변론 하단에서 칩·236 패널·변론 채팅 줄·이모티콘 걷어내기** - `3d02710` (feat)
2. **Task 2: 변론 시험의 칩·tall·변론 채팅 줄·이모티콘 단언 정리** - `2c530a8` (test)

**Plan metadata:** 이 SUMMARY 와 함께 커밋한다 (docs).

_Note: 계획이 `tdd="true"` 를 단 task 가 없는 삭제 계획이라 RED→GREEN 순서를 쓰지 않았다. Task 1 직후 변론 시험이 일시적으로 깨진 것은 Task 2 가 같은 계획 안에서 고친다._

## Files Created/Modified

- `src/components/DefensePanel.tsx` - 상태 줄(후보 연결·남은 초)과 탈락자 관전 알약만 남은 변론 하단
- `src/screens/verdictScene.tsx` - 후보 본인·다른 사람 모두 같은 `DefensePanel`, `lines`·`panelClassName` 제거
- `src/screens/DayScene.tsx` - `useVerdictScene` 호출에서 `lines` 인자와 `panelClassName` 사용 제거
- `src/game/verdict.ts` - 칩 안내·보냄 표시 이름 제거, `defenseAnnounce(null)` 문구 변경
- `src/styles/verdict.css` - 변론 칩 격자·`--tall` 규칙 제거
- `src/screens/RoomScreen.tsx` - 변론 안내 주석만 수정
- `docs/screen-map.md` - 하단 패널 설명에서 변론 후보 236·변론 칩 삭제
- 시험 7개 - 위 정리 내용

## Decisions Made

- 후보 본인 하단도 `{이름}님이 변론하는 중 · N초`(자기 이름)로 그린다. 후보 전용 문구가 UI-SPEC 에 없어 새 문장을 만들지 않았다(결정 0051).
- `panelClassName` 은 쓰는 곳이 하나뿐이어서 필드째 지웠다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `panelClassName` 죽은 필드 제거**
- **Found during:** Task 1
- **Issue:** `--tall` 을 지우면 `VerdictScene.panelClassName` 과 DayScene 의 클래스 조합이 쓰이지 않는 코드가 되고, 필드 주석이 `panel--tall` 을 이름으로 적어 src grep 게이트(0건)에도 걸린다.
- **Fix:** 인터페이스 필드와 DayScene 의 조건부 클래스를 함께 지웠다(DayScene 은 계획이 `lines` 인자만 빼라고 했으나 이 한 줄만 더 바꿨다).
- **Files modified:** src/screens/verdictScene.tsx, src/screens/DayScene.tsx
- **Committed in:** 3d02710

**2. [Rule 1 - Bug] 계획 밖 시험 한 건이 CSS 삭제로 깨짐**
- **Found during:** Task 2 (전체 vitest)
- **Issue:** `test/unit/verdictCss.test.ts` 가 `.mf-defchips__b` 규칙이 2개 이상 읽히기를 요구해 변론 칩 CSS 삭제로 실패했다.
- **Fix:** 선택자에서 `mf-defchips__b` 를 빼고 하한을 1로, 설명 문구에서 변론 칩을 뺐다. `test/helpers/verdictViews.ts` 주석과 `docs/screen-map.md` 의 옛 설명도 함께 고쳤다.
- **Files modified:** test/unit/verdictCss.test.ts, test/helpers/verdictViews.ts, docs/screen-map.md
- **Verification:** `npx vitest run` 143 파일 통과
- **Committed in:** 2c530a8

---

**Total deviations:** 2 auto-fixed (2 Rule 1)
**Impact on plan:** 둘 다 이 계획의 삭제가 만든 잔여물 정리이며 범위가 늘지 않았다.

## Issues Encountered

- guide 시험에서 내가 후보인 칸은 후보 자리가 0번(`NAMES[0]`)이라 첫 기대값(`CANDIDATE_SEAT`)이 틀렸고 바로잡았다.
- 전체 시험의 `1 skipped` 는 이 계획 이전에도 있던 것이다(`.skip(`·`.todo(` git grep 0건).

## Known Stubs

없음.

## Threat Flags

없음 — 새 네트워크 경로·입력 경로가 생기지 않았고 변론 화면은 더 이상 say·emoji 를 보내거나 chat·emoji 를 그리지 않는다(T-07-12 완화).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 07-07 이 낮 토론·밤 하단과 머리 위 말풍선·이모티콘(`seatFloats`, `useDayChat`, `MessageLog`, `DiscussionControls`)을 걷어낼 차례다. `QuickMessageSheet`·`messageText`·`EmojiTraySheet`·`useSendLock` 은 이제 낮 토론만 쓴다.
- 서버는 아직 say(변론 템플릿)·emoji 를 받는다. 제거는 07-11·07-12, 변론 하단의 새 채팅 패널은 07-15.

## Self-Check: PASSED

- 삭제 확인: `src/components/DefenseChips.tsx`, `test/client/defenseChips.test.tsx` 없음.
- 커밋 존재: `3d02710`, `2c530a8` 가 HEAD 의 조상.
- 인수 기준: src·test 에서 panel--tall·defenseSent·DEFENSE_SENT_MS·defenseChooseTitle·변론할 말을 고르세요 git grep exit 1, DefensePanel 에 MessageLog|EmojiTraySheet|useSendLock|showToast|lines 없음, defense.test 에 `showToast=`·`lines=` 없음.
- 전체: `npx vitest run` 143 파일 통과, `npm run typecheck` 통과, `npx vite build` 통과.

---
*Phase: 07-free-chat*
*Completed: 2026-11-01*
