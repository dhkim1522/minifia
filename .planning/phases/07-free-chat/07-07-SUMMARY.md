---
phase: 07-free-chat
plan: "07"
subsystem: client-day-screen
tags: [removal, quick-message, emoji, bubble, message-log, react, css]

requires:
  - phase: 07-free-chat
    provides: "07-06 이 변론 하단의 칩·이모티콘 사용을 먼저 끊어 공유 부품의 남는 사용처가 낮 토론·밤 하단과 머리 위 표시뿐이었다"
provides:
  - "화면에 빠른 메시지·이모티콘·채팅 세 줄 로그·채팅 내역 모달이 없다 (QuickMessageSheet·EmojiTraySheet·DiscussionControls·MessageLog·ChatHistorySheet·seatFloats·useSendLock·messageText 삭제)"
  - "DayScene 낮 토론·밤 마피아 하단은 비어 있고 탈락 viewer 는 ReadOnlyRow 뿐이다 (채팅 패널은 07-13·07-15)"
  - "DayTableSeat 에 spoke·emoji 가 없고 DayTable 에 말풍선·이모티콘 층이 없다 (머리 위 '…' 알약은 07-18)"
  - "화면 코드가 옛 와이어 값(TEMPLATE_IDS·EMOJI_IDS·shared/game/chat)을 import 하지 않아 07-11·07-12 가 서버·와이어에서 지워도 빌드가 깨지지 않는다"
affects: [07-08, 07-11, 07-12, 07-13, 07-15, 07-18, 07-20]

actuals:
  tokens: 50800
  tasks: 3
  commits: 3
  plan_head_before: 5ce8d96a77021ddb0fbac34984117d6b9411d792
  plan_head_after: e28debfc89f10abf9ba12aa73958bcc1c29719cf

tech-stack:
  added: []
  patterns:
    - "삭제 계획은 시험을 같은 계획 안에서 고친다: 부품 삭제 커밋 직후 시험이 일시적으로 깨지고 마지막 task 가 초록으로 돌린다"
    - "지운 부품의 CSS 는 선택자를 tsx 사용 0 으로 확인한 뒤 지우고, 지워졌다는 사실을 시험(day.css·daytable.css 에 선택자 없음)으로 고정한다"

key-files:
  created: []
  modified:
    - src/screens/DayScene.tsx
    - src/components/DayTable.tsx
    - src/game/dayTable.ts
    - src/components/Icon.tsx
    - src/game/roleText.ts
    - src/styles/day.css
    - src/styles/daytable.css
    - test/client/discussion.test.tsx
    - test/client/dayScene.test.tsx
    - test/client/nightScene.test.tsx
    - test/client/dayTable.test.tsx
    - test/client/icon.test.tsx
    - test/client/candidateVote.test.tsx
    - test/client/execVote.test.tsx
    - test/client/execution.test.tsx
    - test/client/defense.test.tsx
    - test/client/phaseScreens.test.tsx
    - test/unit/dayTable.test.ts
  deleted:
    - src/components/QuickMessageSheet.tsx
    - src/components/EmojiTraySheet.tsx
    - src/components/DiscussionControls.tsx
    - src/components/MessageLog.tsx
    - src/components/ChatHistorySheet.tsx
    - src/net/seatFloats.ts
    - src/net/useSendLock.ts
    - src/game/messageText.ts
    - src/styles/talk.css
    - test/client/quickMessageSheet.test.tsx
    - test/client/emojiTraySheet.test.tsx
    - test/client/seatFloats.test.tsx
    - test/client/nightChat.test.tsx
    - test/unit/messageText.test.ts

key-decisions:
  - "BUBBLE_W·BUBBLE_H·BUBBLE_TAIL·BUBBLE_TOP(src/game/dayTable.ts)는 지우지 않았다. 계획이 지울 이름으로 EMOJI_SIZE·EMOJI_LIFT·emojiLeft·emojiTop 만 꼽았고, 머리 위 '…' 알약은 07-18 이 같은 자리에 붙이므로 기하 상수와 그 시험을 남겼다"
  - "mf-dt-fade 키프레임은 .mf-figure--role 이 쓰므로 말풍선 규칙을 지울 때 남겼다. mf-dt-dot·mf-dt-emoji 는 사용처가 없어 지웠다"
  - "talk.css 는 빠른 메시지 시트·이모티콘 트레이 규칙뿐이라 파일째 지웠다. day.css 에서는 .mf-msglog·.mf-chatlog·.mf-sheet--chat·.mf-discuss 규칙만 지우고 .mf-ro·.mf-turnpanel·.st-row·.mf-claimpanel* 은 남겼다"
  - "discussion.test.tsx 는 같은 이름으로 위쪽 바·빈 하단·옛 오류 프레임 무시 단언으로 다시 썼다. 옛 chat·emoji 프레임을 만드는 코드는 시험에 남기지 않았다 (07-11 이 그 타입을 지운다)"

requirements-completed: [CHAT-06]

coverage:
  - id: D1
    description: "빠른 메시지·이모티콘 버튼·채팅 세 줄 로그·채팅 내역 모달 부품과 그 전용 시험 5개가 없고 DayScene 이 쓰지 않는다"
    requirement: "CHAT-06"
    verification:
      - kind: command
        ref: "for f in (여덟 부품 경로); do test ! -e $f; done  (모두 없음)"
        status: pass
      - kind: command
        ref: "git grep -n -E '^import .*(MessageLog|DiscussionControls|QuickMessageSheet|EmojiTraySheet|ChatHistorySheet|seatFloats|useSendLock|messageText)' -- src test  (exit 1)"
        status: pass
      - kind: unit
        ref: "test/client/discussion.test.tsx#낮 토론 화면 — 위쪽 바와 빈 하단 (CHAT-06, 가정 A1)"
        status: pass
    human_judgment: false
  - id: D2
    description: "DayTable 에 spoke·emoji 필드, 말풍선, 이모티콘 층이 없고 레이아웃 결과에 emojiLeft·emojiTop 이 없다"
    requirement: "CHAT-06"
    verification:
      - kind: command
        ref: "git grep -n -E 'mf-dt__emoji|spoke\\??:' -- src/components src/screens src/game  (exit 1)"
        status: pass
      - kind: unit
        ref: "test/client/dayTable.test.tsx#DayTable: 머리 위 이모티콘·말풍선 층이 없다 (CHAT-06)"
        status: pass
      - kind: unit
        ref: "test/unit/dayTable.test.ts#캐릭터·이름표가 같은 (x, y) 에서 나온다"
        status: pass
    human_judgment: false
  - id: D3
    description: "Icon 이모티콘 전용 8종, roleText 주장 문장표, 지운 부품 전용 CSS 가 없다 (3D 표정 id 는 그대로)"
    requirement: "CHAT-06"
    verification:
      - kind: command
        ref: "git grep -n -E 'CLAIM_LINE|CLAIM_NONE_LINE|CLAIM_JOSA|claimName' -- src  (exit 1)"
        status: pass
      - kind: command
        ref: "git grep -n -E 'mf-dt__bubble|mf-dt__emoji' -- src  (exit 1)"
        status: pass
      - kind: unit
        ref: "test/client/dayTable.test.tsx#daytable.css: 이모티콘·말풍선 규칙 삭제"
        status: pass
    human_judgment: false
  - id: D4
    description: "서버·와이어를 바꾸지 않고 화면이 옛 와이어 값을 import 하지 않는다 (07-11·07-12 선행 조건)"
    requirement: "CHAT-06"
    verification:
      - kind: command
        ref: "git grep -n -E 'TEMPLATE_IDS|EMOJI_IDS|shared/game/chat\"' -- src  (exit 1)"
        status: pass
      - kind: command
        ref: "git grep -n -E 'template: \"|t: \"emoji\"' -- test/client ':!test/client/useRoomConnection.test.tsx'  (exit 1)"
        status: pass
    human_judgment: false
  - id: D5
    description: "전체 시험·두 tsc·빌드가 초록이고 skip·todo 가 새로 생기지 않았다"
    verification:
      - kind: other
        ref: "npx vitest run (138 파일 통과, 3735 통과 · 1 skipped 는 이 계획 이전부터), npm run typecheck exit 0, npx vite build"
        status: pass
      - kind: command
        ref: "git grep -n -F -e '.skip(' -e '.todo(' -- test  (exit 1)"
        status: pass
    human_judgment: false
  - id: D6
    description: "낮 토론·밤 마피아 하단이 비어 있는 중간 상태의 화면 인상이 받아들일 만한가"
    verification: []
    human_judgment: true
    rationale: "화면 인상은 시험이 판정하지 않는다. 가정 A1 상 이 중간 상태는 배포되지 않고 07-13·07-15 에서 채팅 패널이 들어온다"

duration: 7min
completed: 2026-11-01
status: complete
---

# Phase 07 Plan 07: 빠른 메시지·이모티콘 화면 코드 걷어내기 Summary

**낮 토론·밤 하단의 빠른 메시지·이모티콘·채팅 세 줄 로그·내역 모달과 머리 위 말풍선·이모티콘 층을 부품 파일째 지우고, Icon 이모티콘 8종·roleText 주장 문장표·죽은 CSS(talk.css 포함)를 정리해 화면이 옛 와이어 값을 쓰지 않게 했다.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-11-01T13:12:32Z
- **Completed:** 2026-11-01T13:19:29Z
- **Tasks:** 3
- **Files modified:** 32 (수정 18 + 삭제 14)

## Accomplishments

- 부품 8개(`QuickMessageSheet`·`EmojiTraySheet`·`DiscussionControls`·`MessageLog`·`ChatHistorySheet`·`seatFloats`·`useSendLock`·`messageText`)와 전용 시험 5개를 한 번의 `git rm` 으로 지웠다.
- `DayScene` 에서 floats·chatLines·lastEmoji·이모티콘 live 줄을 걷어냈다. 탈락 viewer 하단은 `ReadOnlyRow` 하나, 낮 토론·밤 마피아 하단은 비어 있다. `showToast` 는 경찰·의사 선택 거부와 투표 장면이 계속 쓴다.
- `DayTable`·`dayTable.ts` 에서 `spoke`·`emoji`, 말풍선, 이모티콘 층, `EMOJI_*`, `emojiLeft`·`emojiTop` 을 지웠다.
- `Icon` 이모티콘 전용 8종, `roleText` 주장 문장표 네 이름과 `Claim` import, `talk.css`(파일), `day.css` 의 채팅 로그·내역 모달·말하기 줄 규칙, `daytable.css` 의 말풍선·이모티콘 규칙과 키프레임·모션 줄이기 줄을 지웠다.
- 시험 정리: `discussion.test.tsx` 를 위쪽 바·빈 하단·옛 오류 프레임 무시 단언으로 다시 썼고, 나머지 열 개 파일에서 옛 chat·emoji 프레임, 말풍선·이모티콘·채팅 로그 단언을 지웠다. `skip`·`todo` 는 만들지 않았다.

## Task Commits

1. **Task 1: 부품 삭제와 DayScene·DayTable·dayTable 정리** - `ed7fc8f` (feat)
2. **Task 2: Icon 이모티콘 8종·주장 문장표·죽은 CSS 정리** - `a35b6d3` (chore)
3. **Task 3: 남은 시험의 옛 단언 정리** - `e28debf` (test)

**Plan metadata:** 이 SUMMARY 와 함께 커밋한다 (docs).

_Note: 삭제 계획이라 `tdd="true"` 를 단 task 가 없어 RED→GREEN 순서를 쓰지 않았다. Task 1 커밋 직후 `tsc` 가 시험 파일 25건을 보고하고 vitest 가 일시적으로 깨지는데, 같은 계획의 Task 3 이 고친다 (07-06 과 같은 방식)._

## Files Created/Modified

- `src/screens/DayScene.tsx` - 채팅 로그·이모티콘·말풍선 입력 제거, 하단 분기 단순화
- `src/components/DayTable.tsx`, `src/game/dayTable.ts` - spoke·emoji·이모티콘 층과 좌표 제거
- `src/components/Icon.tsx`, `src/game/roleText.ts` - 이모티콘 8종, 주장 문장표 제거
- `src/styles/day.css`, `src/styles/daytable.css` - 죽은 규칙 제거, `src/styles/talk.css` 파일 삭제
- 시험 열한 개 - 위 정리 내용

## Decisions Made

- `BUBBLE_*` 기하 상수와 그 시험은 07-18 의 '…' 알약 자리라 남겼다 (계획이 지울 이름에 넣지 않음).
- `mf-dt-fade` 키프레임은 `.mf-figure--role` 이 써서 남겼다.
- `discussion.test.tsx` 는 지우지 않고 같은 이름으로 빈 하단 단언으로 다시 썼다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 계획 files 밖 시험 `test/client/defense.test.tsx` 정리**
- **Found during:** Task 3 (전체 vitest)
- **Issue:** 07-06 에서는 `seatFloats` 가 남아 있어 통과하던 "후보 변론 chat 이벤트 → 말풍선"·"공개·처형 단계 chat·emoji" 두 it 가 `seatFloats` 삭제로 실패했다. 이 파일은 계획 files 에 없었다.
- **Fix:** 두 it 를 "변론 장면에는 말풍선·이모티콘 층과 하단 채팅 줄이 없다" 한 개로 바꾸고, 쓰이지 않게 된 `emitter` 와 `RoomEvent` import 를 지웠다.
- **Files modified:** test/client/defense.test.tsx
- **Verification:** `npx vitest run` 138 파일 통과
- **Committed in:** e28debf

**2. [Rule 1 - Bug] 지울 말풍선 규칙과 `mf-dt-fade` 키프레임이 함께 있었다**
- **Found during:** Task 2
- **Issue:** `daytable.css` 말풍선 줄 묶음의 `@keyframes mf-dt-fade` 를 같이 지우면 `.mf-figure--role` 의 300ms 페이드가 깨진다.
- **Fix:** 키프레임만 되살렸다. `mf-dt-dot`·`mf-dt-emoji` 는 사용처가 없어 지웠다.
- **Files modified:** src/styles/daytable.css
- **Committed in:** a35b6d3

---

**Total deviations:** 2 auto-fixed (1 Rule 1, 1 Rule 3)
**Impact on plan:** 둘 다 이 계획의 삭제가 만든 잔여물 정리이며 범위가 늘지 않았다.

## Issues Encountered

- 전체 시험의 `1 skipped` 는 이 계획 이전에도 있던 것이다 (`.skip(`·`.todo(` git grep 0건, 07-06 SUMMARY 와 같은 값).
- `scripts/e2e/*`·`scripts/smoke.mjs`·`scripts/uat-day.mjs` 와 `docs/screen-map.md`·`docs/product.md` 에 빠른 메시지·`mf-msglog` 언급이 남아 있다. 이 계획 범위 밖이며 E2E 하네스 정리는 07-20 이 맡는다.

## Known Stubs

없음.

## Threat Flags

없음 — 새 네트워크 경로·입력 경로가 생기지 않았고, 옛 chat·emoji 구독 코드(`seatFloats`·`useDayChat`)가 파일째 사라져 T-07-13 이 완화되었다.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 07-08 이 `PhaseId` 에서 `claim` 을 뺄 수 있다 (`seatFloats` 의 `FLOAT_PHASES` 가 사라졌다).
- 07-11·07-12 가 서버·와이어에서 `say`·`emoji`·옛 `chat` 프레임과 `TEMPLATE_IDS`·`EMOJI_IDS` 를 지워도 화면·시험 컴파일이 깨지지 않는다 (남은 옛 프레임 코드는 `useRoomConnection.test.tsx` 뿐).
- 07-13·07-15 가 낮 토론·밤 마피아 하단과 탈락자 하단에 채팅 패널을 붙이고, 07-18 이 머리 위 '…' 알약을 `BUBBLE_*` 기하 자리에 붙인다.
- 변론 aria-live 안내('내 최후 변론')는 07-06 결정대로 07-15 가 다시 본다.

## Self-Check: PASSED

- 삭제 확인: 부품 8개, 시험 5개, `src/styles/talk.css` 모두 없음.
- 커밋 존재: `ed7fc8f`, `a35b6d3`, `e28debf` 가 HEAD 의 조상 (`plan_head_before` 5ce8d96 이후 3개).
- 인수 기준: 부품 파일 없음, `TEMPLATE_IDS|EMOJI_IDS|shared/game/chat"` src grep exit 1, `mf-dt__emoji|spoke?:` src/components·screens·game grep exit 1, `CLAIM_*|claimName` src grep exit 1, `mf-dt__bubble|mf-dt__emoji` src grep exit 1, import grep exit 1, `template: "|t: "emoji"` test/client grep exit 1, skip·todo grep exit 1.
- 전체: `npx vitest run` 138 파일 통과, `npm run typecheck` exit 0, `npx vite build` 통과.

---
*Phase: 07-free-chat*
*Completed: 2026-11-01*
