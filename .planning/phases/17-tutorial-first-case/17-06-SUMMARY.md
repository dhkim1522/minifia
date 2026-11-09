---
phase: 17-tutorial-first-case
plan: "06"
subsystem: tutorial
tags: [tutorial, entry, home, tdd, tracer, end-card, storage]
status: complete

requires:
  - phase: 17-04
    provides: TutorialScreen({ mode, onEnd, initialScene }) — 혼자 하기 화면
  - phase: 17-03
    provides: TUTORIAL_END_CARD_ON_SKIP(false), 정적 가드
  - phase: 17-02
    provides: tut.warm 효과음
provides:
  - "src/net/session.ts: TUTORIAL_SEEN_KEY(minifia.tutorial.seen)·loadTutorialSeen·saveTutorialSeen — 값 \"1\" 일 때만 참, 메모리 대체"
  - "src/components/v2/TutorialEntry.tsx: 첫 화면 큰 카드(높이 84, 숨 쉬는 번짐 2.4초) ↔ 작은 단추(높이 44), 탭 맨 앞 unlockAudio"
  - "src/components/v2/TutorialEndCard.tsx: 혼자 하기 마무리 카드(tut.warm 한 번, [다시 보기] ui.tap)"
  - "src/screens/Home.tsx: tutorial·endCard·seen 상태로 같은 인스턴스에서 TutorialScreen solo 로 화면 전환(닉네임·방 코드 보존), 방 만들기·참가 성공 때 본 표시"
  - "src/styles/tutorialEntry.css: .tut-entry·.tut-entry--card·.tut-entry--button·.tut-entry__pill·.tut-end"
  - "src/net/useTutorialWarm.ts: 마무리 카드의 tut.warm 호출 훅"
affects: [17-07, 17-09, 17-10]

actuals:
  tokens: 6900
  tasks: 2
  commits: 4
plan_head_before: 9c9697695fa7e897c442b6e9fb103afe76f60b75
plan_head_after: 58496ccfd392f284c0392f94c67498cd725ea35a

tech-stack:
  added: []
  patterns:
    - "Home 이 튜토리얼 열림 상태를 쥐고 같은 컴포넌트에서 화면만 바꿔 그려 입력 상태를 보존한다 — App 에 새 Screen 을 만들지 않고 history 도 건드리지 않는다(0080-7)"
    - "컴포넌트·화면은 엔진 play 를 부르지 않는다(soundButton 소리 호출 자리 시험) — 호출은 net 훅(useTutorialWarm)에 둔다"
    - "진입 단추는 탭 핸들러 첫 줄 동기 unlockAudio() 다음 onStart(), 실패해도 튜토리얼은 진행한다"

key-files:
  created:
    - src/components/v2/TutorialEntry.tsx
    - src/components/v2/TutorialEndCard.tsx
    - src/net/useTutorialWarm.ts
    - src/styles/tutorialEntry.css
    - test/client/tutorialEntry.test.tsx
  modified:
    - src/screens/Home.tsx
    - src/net/session.ts
    - test/unit/session.test.ts
    - test/client/joinByLink.test.tsx

key-decisions:
  - "본 표시는 카드 시작 때와 방 만들기·참가 성공(저장된 토큰으로 바로 돌아가는 분기 포함) 때만 저장한다 — 닉네임 오류 같은 실패 분기에는 저장하지 않는다(RESEARCH Q4)"
  - "tut.warm 호출은 TutorialEndCard 안이 아니라 net 훅 useTutorialWarm 에 둔다(소리 호출 자리 규칙)"

requirements-completed: []

duration: 6min
completed: 2026-11-09
---

# Phase 17 Plan 06: 첫 화면 튜토리얼 진입로 Summary

**첫 화면 큰 카드 "튜토리얼 진행"으로 서버 요청 없이 혼자 첫 사건을 시작하고, 끝까지 보면 마무리 카드·건너뛰면 곧장 첫 화면(닉네임·방 코드 그대로)으로 돌아오며, 한 번 본 뒤에는 작은 단추로 줄어든다.**

## 수행한 일

- **Task 1(트레이서)**: session.ts 에 `minifia.tutorial.seen` 한 값(기존 read/write 도우미라 메모리 대체 그대로)을 더하고, TutorialEntry(큰 카드 ↔ 작은 단추)와 tutorialEntry.css 를 만들었다. Home 은 `tutorial`·`seen` 상태를 쥐고 playing 일 때 같은 컴포넌트에서 `<TutorialScreen mode="solo">` 를 그린다. 카드는 `.mf-entry__actions` 맨 위에, `?test=1` 에서는 그리지 않는다.
- **Task 2**: TutorialEndCard("이제 진짜 사건으로" / "목격과 흔적으로 거짓말을 잡아요" / [다시 보기])를 큰 카드 자리에 놓고, "끝"이면 카드, "건너뛰기"는 `TUTORIAL_END_CARD_ON_SKIP`(false)를 따라 곧장 첫 화면이다. [다시 보기]는 initialScene 없이(장면 1) 다시 연다. 방 만들기·참가 성공(저장된 토큰 분기 포함)에서 onEnterRoom 직전에 본 표시를 저장한다. 링크 참가 화면(JoinByLink)은 바꾸지 않고 시험으로 카드 0개를 고정했다.
- TDD: 두 태스크 모두 RED 시험 커밋 → GREEN 구현 커밋 순서.

## 검증

- `npx vitest run test/client/tutorialEntry.test.tsx test/unit/session.test.ts test/client/entryContrast.test.tsx test/client/app.test.tsx test/unit/tutorialStaticGuard.test.ts` 통과, `npm run typecheck` 통과
- `npm test` 전체: Task 2 GREEN 직전 한 번 돌려 7864 통과·1 실패(아래 Rule 1, soundButton 소리 호출 자리). 고친 뒤 그 시험·tutorialEntry·정적 가드를 다시 돌려 통과(전체 재실행은 하지 않았다 — 고친 곳은 마무리 카드 한 부품뿐)
- 시험이 고정한 것: 카드 개수·첫 자식·Tab 순서, unlockAudio 가 같은 클릭에서 마운트보다 먼저 한 번, 카드 클릭 fetch 0, 닉네임·방 코드 보존, 작은 단추(`tut-entry--button`), `?test=1` 0개, 마무리 카드·tut.warm 한 번·[다시 보기] ui.tap, 본 표시 저장 시점(성공만), 링크 참가 화면 0개

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 컴포넌트가 엔진 play 를 직접 부르는 것을 소리 호출 자리 시험이 막았다**
- **Found during:** Task 2 (`npm test` 전체)
- **Issue:** 계획대로 TutorialEndCard 가 마운트 때 `getEngine().play("tut.warm")` 을 부르자 `test/client/soundButton.test.tsx` 의 "컴포넌트·화면에서 엔진 play 를 부르는 곳이 없다" 가 실패
- **Fix:** 호출을 `src/net/useTutorialWarm.ts` 훅으로 옮기고 TutorialEndCard 는 훅만 부른다(17-04 의 useTutorialDirector 와 같은 자리). 동작(마운트 때 tut.warm 한 번)은 같고 tutorialEntry 시험이 그대로 단언한다
- **Files modified:** src/net/useTutorialWarm.ts, src/components/v2/TutorialEndCard.tsx
- **Commit:** 58496ccf

## Known Stubs

없음.

## Threat Flags

없음 — 새 네트워크 경로·인증·파일 접근 없음. T-17-14(혼자 하기 서버 요청 0)는 카드 클릭 fetch 0 단언으로 시험 고정, 소켓 프레임 0 은 17-09 E2E 가 맡는다.

## 이월 메모

- 실기기·실브라우저에서 키보드가 열린 상태의 카드 스크롤과 폭 360 한 줄 표시는 아직 보지 않았다(CSS 로 `white-space: nowrap`·흐름 배치만 보장). 배포본 E2E(17-09)와 사용자 실기기 검사에서 확인한다.
- `src/net/session.ts` 의 키가 점 표기(`minifia.tutorial.seen`)라 기존 콜론 표기와 다르다 — UI-SPEC T-2 문자열 그대로(RESEARCH A6).
- TUT-01 은 17-09·17-10·17-11 도 선언해 ready-ids 가 "blocked" 라 요구사항 완료 표시는 하지 않았다.

## Self-Check: PASSED

- 파일: TutorialEntry.tsx·TutorialEndCard.tsx·useTutorialWarm.ts·tutorialEntry.css·tutorialEntry.test.tsx 존재
- 커밋: 98b18140·9a651f8c·ff93787c·58496ccf 모두 HEAD 의 조상
