---
phase: 09-night-morning
plan: "26"
subsystem: client-pregame-rolecard
tags: [gap-closure, pregame-stage, world-stage, role-card-sheet]
status: complete

requires:
  - phase: 09-night-morning
    provides: WorldStage(06-15 로비 모드), RoleCardSheet(09-xx)
provides:
  - src/screens/PreGame.tsx — 역할 배정·역할 확인이 함께 쓰는 3D 재즈 바 무대 틀(aria-hidden, 걷기 없음, 장면 상태 없음)
  - RoomScreen sceneKey "preGame" — assigning·roleReveal 이 같은 키라 무대를 다시 만들지 않음
  - 역할 카드 시트 height auto + max-height min(420px, 80dvh)
affects: [09-30]

key-files:
  created:
    - src/screens/PreGame.tsx
    - test/client/preGame.test.tsx
  modified:
    - src/screens/RoleReveal.tsx
    - src/screens/Assigning.tsx
    - src/screens/RoomScreen.tsx
    - src/styles/phase.css
    - src/styles/rolecard.css
    - test/client/phaseScreens.test.tsx
    - test/client/roomScreen.test.tsx
    - test/client/stageBox.test.tsx
    - test/client/roleCardSheet.test.tsx

decisions:
  - "역할 배정(카드 고르기)과 역할 확인 둘 다 3D 무대 (사용자 확정, gap-carry)"
  - "탭 전환 때 시트 높이가 달라지는 것은 받아들인다 (open_design_question)"

metrics:
  completed: 2026-11-04
  tasks: 2
  commits: 4
  plan_head_before: 87c5fac75cf803331a3c6b8951d2f762dfbda429
  plan_head_after: 47c6f83f834658e9184089108b7781b717c69e99

actuals:
  tokens: 14000
  tasks: 2
  commits: 4
---

# Phase 9 Plan 26: 역할 배정·확인 3D 무대와 내용 높이 역할 카드 시트 Summary

역할 배정·역할 확인 뒤 v1 배경 그림(bg_game_lobby)을 걷어 내고, 로비와 같은 3D 재즈 바 WorldStage 를 깔았으며(기존 --scrim 막 유지), 역할 카드 시트는 내용 높이까지만 올라오게 했다.

## 한 일

- **Task 1 (feedback-3)**: `PreGame` 틀 신규. aria-hidden 무대 상자 안에 WorldStage(`canWalk=false`, 무대에는 `canSend=false`, `onNotice` 무동작)를 두고 그 위 내용 층에 Assigning·RoleReveal 을 얹는다. `scene`·`tagProps`·`pick`·`onKick` 을 넘기지 않아 로비 모드(이름표만)라 직업 칩·고리가 없다(T-09-55). RoomScreen `sceneKey` 가 assigning·roleReveal 에 같은 키 `preGame` 을 줘서 단계 사이에 무대가 다시 만들어지지 않는다(시험: WorldStage 마운트 1회). phase.css 의 `.mf-reveal__backdrop`·`.mf-assign__backdrop` 을 `.mf-pregame`·`__stage`·`__content` 로 바꿨다.
- **Task 2 (feedback-7)**: `.mf-sheet.mf-sheet--rolecard` 를 `height: auto; max-height: min(420px, 80dvh)` 로 바꿨다. `.mf-sheet` 가 이미 flex 열이라 추가 규칙은 필요 없었다. 탭 전환 때 높이가 달라지는 것은 받아들인다.

## 지도 정보 확인 결과

무대를 그릴 지도 정보는 따로 필요 없었다. WorldStage 는 로비 모드에서 `view.players`·`WorldStore` 만으로 모든 좌석을 그리고, 역할 배정·확인 view 도 같은 `players` 를 가지고 있어 Lobby 와 같은 방식으로 넘기면 된다. 맵을 못 여는 기기의 안내 카드(MapStatusCard)는 무대 층 안에 있고 내용 층이 위에 있어 카드·[역할 카드] 버튼·타이머 조작을 막지 않는다(T-09-56). 실패 카드 처리는 계획 그대로이며 별도 분기는 만들지 않았다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - 시험 기대 갱신] 옛 v1 배경·단계 전환 기대**
- **Found during:** Task 1 GREEN
- **Issue:** `roomScreen.test` 의 "assigning → roleReveal 은 stage.props 가 null" 과 `phaseScreens.test` 의 "assigning → roleReveal 이면 .mf-phase-enter 가 새 요소" 가 옛 구조를 기대했다. `stageBox.test` 는 `.mf-assign__backdrop` 규칙을 읽었다.
- **Fix:** 기대를 지우지 않고 v2 무대 기대로 바꿨다 — 무대가 있고(exiting 없음, canWalk false), 배정 → 확인은 같은 요소, 장면이 바뀌면(→ dayAnnounce) 새 요소, `.mf-pregame` 이 flex 1 1 0·min-height 0·height auto.
- **Files modified:** test/client/roomScreen.test.tsx, test/client/phaseScreens.test.tsx, test/client/stageBox.test.tsx
- **Commit:** 32dfd2d, e3e723e

그 밖에는 계획대로 실행했다.

## 확인

- `npx vitest run test/client` 전체 48 파일 1532 시험 통과, `npm run typecheck` 오류 없음.
- 실제 화면(3D 무대 위 어두운 막 가독성, 시트 높이)은 09-30 로컬 E2E·실기기 묶음에서 확인한다.

## 이월 메모

- `PreGame` 이 `pointer-events: none` 무대를 쓰므로, 맵을 못 열 때의 MapStatusCard [새로 고침] 버튼은 이 두 화면에서는 눌리지 않는다(꾸밈 무대, 단계가 3초·15초라 계획대로 둠).
- 로비 → 역할 배정 전환은 sceneKey 가 달라 Lobby 의 무대에서 PreGame 의 새 무대로 한 번 다시 만들어진다(역할 배정 → 확인은 이어짐).

## Known Stubs

없음.

## Threat Flags

없음.

## Self-Check: PASSED

- src/screens/PreGame.tsx, test/client/preGame.test.tsx 존재
- 커밋 e3e723e, 32dfd2d, ead853b, 47c6f83 모두 HEAD 의 조상
