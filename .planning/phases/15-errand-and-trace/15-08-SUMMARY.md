---
phase: 15-errand-and-trace
plan: "08"
subsystem: client-night-unify
tags: [night-pick, face-list, hostline, mafia-badge, canMoveIn, minifia-v3, d-05, d-08, trace-01]
status: complete

requires:
  - phase: 15-03
    provides: "서버가 밤 pick 응답·world 를 역할 무관으로 통일, 후보는 나 포함 산 사람 전원"
  - phase: 15-07
    provides: "hostLine 허용 목록·HostLocal, GameMap 의 기록·흔적 층(밤 분기와 별개)"
provides:
  - "hostLine: night.citizen 줄(night.wait 삭제), night.mafia '없앨 사람의 이름표를 눌러 주세요.', 밤 빛남 대상은 네 역할 모두 나 포함 산 사람 전원"
  - "FaceList tally·sure 선택 prop + .mv-face__count 배지(칸 안 오른쪽 아래 절대 위치)"
  - "GamePanel 밤 분기: 산 사람 모두 같은 FaceList(묶음 '밤 대상', 칸 이름 '{이름} 고르기', icon 없음), [쪽지]/[유언] 행동 줄만 역할을 본다"
  - "shared: canMoveIn(phase, alive) 두 인자, approachPoint·APPROACH_DIST_FX 삭제"
affects: [15-09, 15-10]

requirements-completed: [TRACE-01]

actuals:
  tokens: 40000
  tasks: 2
  commits: 4

plan_head_before: 4f704ef8b0bc22308748a2f20962976c30912e7d
plan_head_after: e21096eabca775a010f680c636951bd6cff0407e

tech-stack:
  added: []
  patterns:
    - "역할 무관 얼굴 목록: 시점 서명(faceSig — 칸 수·순서·접근성 이름·클래스·data-call·aria-disabled)이 네 역할에서 같음을 시험이 고정한다"
    - "마피아 합의 수단만 view.me.nightTally·nightSure 를 읽는 선택 prop 으로 분리(겉보기 같음의 유일한 예외)"

key-files:
  created: []
  modified:
    - src/game/hostLine.ts
    - shared/game/movement.ts
    - shared/game/world.ts
    - scripts/e2e/lib.mjs
    - src/components/v2/FaceList.tsx
    - src/screens/GamePanel.tsx
    - src/screens/GameMap.tsx
    - src/components/WorldStage.tsx
    - src/world/runtime.ts
    - src/styles/v2.css
    - src/styles/world.css
    - test/unit/hostLine.test.ts
    - test/unit/movement.test.ts
    - test/unit/world.test.ts
    - test/unit/errand.test.ts
    - test/unit/emotePhases.test.ts
    - test/client/guide.test.tsx
    - test/client/nightMap.test.tsx
    - test/client/nightChat.test.tsx
    - test/client/callGlow.test.tsx
    - test/client/faceList.test.tsx
    - test/client/worldStage.test.tsx

key-decisions:
  - "밤 얼굴 목록은 모든 산 사람이 나 포함 산 사람 전원, 묶음 이름 '밤 대상', 칸 이름 '{닉네임} 고르기'(역할 낱말 없음), 고른 칸에 eye·heal 아이콘 없음"
  - "산 마피아의 밤 채팅은 화면에서 그리지 않는다(서버 채널·시험은 그대로). 되돌리려면 GamePanel 밤 분기에 ChatPanel 을 다시 놓는 한 곳"
  - "마피아의 선택 수 배지는 FaceList 칸 안 오른쪽 아래(mv-face__count, 14/700), 확정 칸은 check 아이콘(접근성 이름 '확정'). 배지가 칸 크기·간격을 바꾸지 않는다"
  - "시민 편 밤 어둠·긴장 비네트(nightDarkOf)는 그대로 — 마피아 화면이 밝은 차이는 기존 한계"
  - "character.ts 의 setPickMark 핸들 메서드는 호출처가 없어졌지만 이 계획 범위 밖(렌더러 계약)이라 남긴다"

metrics:
  duration: 약 75분
  completed: 2026-11-07
---

# Phase 15 Plan 08: 밤 화면 통일 Summary

**밤에 산 사람 모두(마피아·경찰·의사·시민)가 같은 아래 패널 얼굴 목록으로 한 명을 고르고, 마피아 전용 밤 화면(이름표 선택·접근 걷기·눌림 미리보기·마피아 고리·이름표 배지·밤 채팅 패널)을 걷어 냈다. 마피아의 합의 수단은 얼굴 칸 안 작은 선택 수 배지 하나로 옮겼다.**

## 한 일

- **Task 1 (순수 규칙)** — `test(15-08)` 로 시험 먼저, `feat(15-08)` 로 구현.
  - `hostLine.ts`: `night.wait` 키 삭제, `night.citizen` "밤이 되었습니다. 한 명의 이름표를 눌러 주세요." 추가, `night.mafia` 를 "없앨 사람의 이름표를 눌러 주세요." 로 교체. `callTargetsOf` 는 night.mafia·citizen·police·doctor 모두 나 포함 산 사람 좌석 오름차순(네 시점 같음), 유령은 null.
  - `movement.ts`: `canMoveIn(phase, alive)` 두 인자. `world.ts`: `approachPoint`·`APPROACH_DIST_FX` 와 시험 삭제.
  - `scripts/e2e/lib.mjs` `HOST_ACT_LINES.mafia` 를 새 문장으로(e2eContract 일치 시험 통과). `guide.test.tsx` 의 night.wait 두 곳을 night.citizen 으로.
- **Task 2 (밤 화면)** — `test(15-08)` 로 nightMap 계약을 먼저 바꿔 11개 실패를 확인한 뒤 구현.
  - `GamePanel`: 밤 산 사람은 역할과 무관하게 같은 `FaceList`(`nightCitizen` 88 고정 빈 패널·산 마피아 채팅 패널 삭제). `[쪽지]`(마피아)·`[유언]`(그 밖) 행동 줄만 `myRole` 을 본다.
  - `FaceList`: `tally`·`sure` 선택 prop 과 `.mv-face__count` 배지. 산 마피아 화면만 `me.nightTally`(n ≥ 1)·`me.nightSure` 를 넘긴다.
  - `GameMap`: `nightMafia`·`approach`·밤 `pickSeats`·`aim`·밤 rings(mine·mafiaAlly)·counts·sure 삭제. 유령의 spectate 고리는 남김.
  - `WorldStage`: `aim`·`pressSeat`·`data-night-pick`·표식 삭제. `runtime.ts`: 몸 윤곽 호출·`PICK_OUTLINE_COLOR`·`mafiaAlly`·`mafia-ally` 속성 삭제. `world.css` 의 is-cand·is-preview·is-picked·aimmark 규칙 삭제.
  - 시험: nightMap 의 마피아 접근·aim·이름표 배지·밤 채팅 블록을 "없음" 단언과 네 역할 시점 동일성(`faceSig`)·배지 시험으로 대체. nightChat 마피아 채팅 블록, callGlow 밤 빛남, worldStage aim·동료 고리 블록, faceList tally·sure 시험을 새 계약으로.

## 시험 결과

- `npx vitest run test/unit test/client`: 207 파일 통과 · 1 건너뜀, 6803 통과 · 183 건너뜀(실패 0).
- `npx tsc -p tsconfig.app.json --noEmit`·`tsconfig.worker.json` 통과, `npm run tokens:check` 통과.
- 인수 기준 grep: night.wait 0 · night.citizen 3 이상 · approachPoint/APPROACH_DIST_FX 0 파일 · "없앨 사람의 이름표" lib.mjs·hostLine 각 1 · `nightMafia|nightCitizen` GameMap·GamePanel 각 0 · `approach|"mafia-ally"|mafiaAlly` src 0 파일 · `mv-face__count` v2.css 1 · 밤 얼굴 목록 역할 분기 grep 0.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task 1 에서 GameMap 의 마피아 접근·이름표 선택·밤 고리 코드를 함께 걷어 냄**
- **Found during:** Task 1 (`approachPoint` 삭제 직후 `npm run typecheck`)
- **Issue:** 계획은 GameMap 정리를 Task 2 로 두고 "호출만 최소 수정" 이라 했으나, `approachPoint` import 와 `approach()` 가 남은 채로는 컴파일이 안 되고 `nightMafia` 분기만 따로 남기면 반쪽 상태가 된다.
- **Fix:** GameMap 의 `nightMafia`·`approach`·밤 pickSeats·`aim`·밤 rings/counts/sure 를 Task 1 커밋(1d2c9032)에서 지웠다. 이름표 선택 시험은 직전 커밋에서 이미 깨져 있어 Task 2 RED 에서 새 계약으로 바꿨다.
- **Files modified:** src/screens/GameMap.tsx
- **Commit:** 1d2c9032

**2. [Rule 1 - Bug] 밤 마피아 채팅 패널이 없어진 뒤 `chatChannelOk` 를 유령 전용으로 좁힘**
- **Found during:** Task 2
- **Issue:** `chatChannelOk = !night || me.chat === (meAlive ? "mafia" : "ghost")` 가 산 사람 밤에는 더 쓰이지 않는다.
- **Fix:** 산 사람 밤은 얼굴 목록 분기가 먼저 가져가므로 `!night || me.chat === "ghost"` 로 줄였다.
- **Commit:** e21096ea

**3. [범위 메모] RED 커밋이 Task 2 의 faceList·callGlow·nightChat·worldStage 시험까지 포함하지 않음**
- nightMap 시험만 RED 로 먼저 커밋(b19aca50)했고, 나머지 네 시험 파일은 구현과 같은 커밋(e21096ea)에서 새 계약으로 바꿨다. 옛 기대는 "없음" 단언으로 대체했다(느슨하게 하지 않음).

## 알려진 한계 · 이월 메모

- **15-09 (E2E)**: `HOST_ACT_LINES` 는 mafia·police·doctor 만 있고 시민 줄(`night.citizen`)은 없다. `hostLeakChecks` HL1 은 역할 줄이 남의 화면에 없는지 보는데 시민 밤 줄이 시민 한 줄이라 "idle 같은 줄" 검사(bad2)는 밤 시민 줄이 다른 세 줄과 다르다는 점을 알아야 한다. `NIGHT_CITIZEN_PANEL_H`(88 고정 빈 패널 높이 단언)·`GAME_PANEL_EXTRA.nightMafia`·HL4(밤 마피아 `data-call` 0개 단언)는 이 계획 뒤 맞지 않는다 — 밤 마피아도 산 사람 칸이 빛난다. 밤 마피아 선택자는 맵 이름표(`[data-pick]`)가 아니라 `[data-face]` 다. 마피아 밤 채팅 입력줄(`.mv-chat__input`)도 없다. `data-ring-kind` 는 유령 화면에서만 `mafia`·`police`·`doctor` 로 나온다.
- **15-10 (결정 0074)**: 얼굴 목록 나 포함 전원·묶음 이름 '밤 대상'·칸 이름 '{이름} 고르기'. 마피아 밤 채팅 패널 화면 삭제(서버 채널 유지, 되돌리는 한 곳 = GamePanel 밤 분기). 마피아 선택 수 배지가 겉보기 같음의 유일한 예외(T-15-32 accept, 사용자가 바꿀 수 있는 기본값). 마피아 합의 확정 알림(hot 줄 '{이름} · 확정')은 채팅 패널이 없어져 화면에서 사라지고 칸 안 check 표시가 대신한다. 밤에 마피아 화면이 시민 편보다 밝은 차이는 기존 한계(nightDarkOf 불변).
- 마피아 2명 이상이 서로 다른 사람을 골랐을 때 서로 얼마나 모았는지는 칸 안 숫자 배지로만 알 수 있다(동료 선택 위치는 보이지 않음). 이전의 동료 고리(mafiaAlly)는 없어졌다.
- `src/world/character.ts`·`renderer.ts` 의 `setPickMark` 핸들 메서드는 호출처가 없어졌지만 남겼다(렌더러 계약·character 시험이 있다). 정리하려면 별도 계획.

## Known Stubs

없음.

## Threat Flags

없음 — 새 네트워크 표면 없음. T-15-31(네 시점 faceSig 동일·eye·heal 0·aria-disabled 0·밤 얼굴 목록이 역할로 갈리지 않음), T-15-33(마피아 전용 밤 경로 삭제와 없음 단언 시험), T-15-34(canMoveIn 인자 삭제, 두 인자 시험)를 시험이 고정한다. T-15-32 는 accept(계획대로).

## Self-Check: PASSED

- 파일: src/components/v2/FaceList.tsx, src/screens/GamePanel.tsx, src/game/hostLine.ts, test/client/nightMap.test.tsx FOUND
- 커밋: a1c56c36, 1d2c9032, b19aca50, e21096ea FOUND
