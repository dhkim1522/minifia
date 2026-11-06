---
phase: 13-basic-day-flow
plan: "03"
subsystem: client-vote-screen
tags: [simultaneous-vote, gamemap, dayview, presence, toast, vitest, react]

requires:
  - phase: 13-01
    provides: 기본판 투표 와이어(phase nomination, 15초, day.points, day.turn 없음)
  - phase: 13-02
    provides: 봇 동시 투표(화면이 보는 표 흐름)
provides:
  - 투표 제목·안내·시작 줄, 선두·과반 집계(majority·sure), 표마다 vote 줄과 위 알림 재료(toasts, 대기열 없음)
  - day.turn 없는 투표의 긴장 조명(과반 2·선두 1)과 카메라 8% 확대
  - GameMap 동시 투표 연결(이름표 버튼 group "투표", 서버 집계만 그리는 배지·선두·과반, 3초 깜빡임, 15초 링, 알약 DOM 없음)
  - DayFx.toast, WorldPick.disabled
  - 기본판 낮 한 바퀴에 차례·결선·결전 소리가 없음을 고정하는 시험
affects: [13-04, 13-05, 13-06]

actuals:
  tokens: 22000
  tasks: 2
  commits: 3

plan_head_before: 544715906c1885c244e636b45e8c6acad81b1cfc
plan_head_after: 10ebe8be191bc24db31c7b38ab135137e6c4ac58

tech-stack:
  added: []
  patterns:
    - "순차·동시 지목은 설정 값이 아니라 view 의 day.turn 유무로 가른다(dayView·presence·GameMap 모두)"
    - "위 알림은 대기열 없이 가장 최근 표 하나(id 가 바뀔 때만 TopToast), 모든 표는 채팅 vote 줄로 남는다"
    - "낙관 표시는 내 선택(mine)만, 배지·선두·과반은 서버 day.points 집계로만"

key-files:
  created: []
  modified:
    - src/game/dayView.ts
    - src/world/presence.ts
    - src/net/useDayFx.ts
    - src/screens/RoomScreen.tsx
    - src/screens/GameMap.tsx
    - src/components/WorldStage.tsx
    - test/unit/dayView.test.ts
    - test/unit/presence.test.ts
    - test/unit/soundDirector.test.ts
    - test/client/gameMap.test.tsx
    - test/client/worldStage.test.tsx
    - test/client/nominationScreen.test.tsx
    - test/client/nightChat.test.tsx

key-decisions:
  - "처음 깜빡임은 일차(day.n) 키로 투표마다 켜되 단계 시작(마감 − 단계 길이) 기준 남은 시간만 깜빡인다 — 재접속해 이미 지난 투표나 이미 고른 투표는 깜빡이지 않는다(저장 키 없음)"
  - "득표 배지(count)는 서버 집계만 그린다. 순차 지목의 낙관 +1 은 순차 분기에만 남겼다(T-13-08)"
  - "TurnBlock 은 blockModeOf(view) !== null 일 때만 렌더해 동시 투표의 [data-turn-block] 을 0 으로 했다. MapHeader 링도 같은 판정이라 투표는 단계 마감 15초 기준이 된다"
  - "순차 view 를 목적으로 한 기존 시험은 day.turn fixture 를 넣어 두고, 제목 기대는 두 방식 모두 '투표' 로 바꿨다"

requirements-completed: [FLOW-01, FLOW-02]

duration: 약 35분
completed: 2026-11-07
status: complete
---

# Phase 13 Plan 03: 투표 화면(동시 투표) Summary

**기본판 투표 단계를 8페이즈 동시 투표 화면으로 되살렸다 — 제목 "투표", 이름표를 직접 눌러 마감까지 바꾸는 투표, 서버 집계로만 그리는 선두·과반 연출과 표마다 위 알림, 3초 깜빡임, 15초 링. 순차 지목 코드는 day.turn 이 있을 때만 쓰이게 두었다.**

## Performance

- **Duration:** 약 35분
- **Tasks:** 2 / **Files:** 13 수정, 신규 0
- **Commits:** 3 (측정값, `plan_head_before` 54471590 → `plan_head_after` 10ebe8be)

## Accomplishments

- `src/game/dayView.ts`: titles.nomination "투표", nominationStart "투표 시작", `pointLine(from, to, changed)`("(바꿈)"), `leadLine`·`majorityLine`, `PointToast`·`DayEvents.toasts`, `pointsTally` 의 `majority`·`sure`. `dayEvents` 는 day.turn 이 없을 때만 선두·과반 hot 줄과 toasts 를 낸다. `headerFor` 는 day.turn 이 없으면 항상 "의심되는 사람을 눌러요".
- `src/world/presence.ts`: day.turn 없는 투표만 `tensionOf` 과반 2·선두 1, `cameraModeOf` 과반 + 스테이지 360 이상이면 `ZOOM_MAJORITY`(1.08).
- `src/net/useDayFx.ts`·`RoomScreen.tsx`: `toast`(id·text·icon "point") 상태. 새 표 중 마지막 하나만 바로 띄우고 epoch 가 바뀌면 비운다.
- `src/screens/GameMap.tsx`: `voting = nominating && day.turn === undefined`. 이름표 group "투표", 서버 집계(count·lead·sure)와 mine 만, 깜빡임 2700ms, 위 알림 연결, 링 판정을 `blockModeOf` 로, `TurnBlock` 조건부 렌더, 끊김 시 `pick.disabled`.
- `src/components/WorldStage.tsx`: `WorldPick.disabled` — aria-disabled 와 onPick 차단.
- 소리 감독은 이미 day.turn 의 핀에서만 차례 소리를 내므로 코드 변경 없이 "기본판 낮에 꺼진 장치 소리 없음 (D-05)" 시험으로 고정했다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 순차 view 기준 기존 시험을 새 계약으로 정리**
- **Found during:** Task 1·2
- **Issue:** day.turn 없는 지목 view 로 순차 결과(제목 "지목", 긴장 0, 확대 1, 시작 줄 "지목 시작", 알약·링 없음)를 기대하던 시험이 새 동작과 어긋났다.
- **Fix:** 순차 동작 검증이 목적인 시험은 day.turn fixture 를 넣었고(presence 4건, dayView 1건), 문구 기대는 "투표"·"투표 시작" 으로 고쳤다. `nominationScreen.test.tsx`·`nightChat.test.tsx` 도 같은 문구 정리. 판정을 느슨하게 하지 않았다.
- **Files modified:** test/unit/dayView.test.ts, test/unit/presence.test.ts, test/client/nominationScreen.test.tsx, test/client/nightChat.test.tsx
- **Commit:** 9c233e63, 10ebe8be

**2. [Rule 2 - 재접속 정확성] 깜빡임을 단계 시작 기준 남은 시간만**
- **Found during:** Task 2
- **Issue:** 일차 키만으로 켜면 재접속 때 이미 지난 투표에서도 3초 깜빡임이 다시 생긴다(UI#10 재접속 무이펙트와 어긋남).
- **Fix:** 단계 시작(phaseEndsAt − phaseDurationMs) 이후 경과를 빼고 남은 시간만 깜빡이며 이미 골랐으면 켜지 않는다. 시험으로 고정.
- **Files modified:** src/screens/GameMap.tsx, test/client/gameMap.test.tsx
- **Commit:** 10ebe8be

**3. [프로세스] Task 2 의 RED 선행 커밋을 하지 않았다**
- Task 1 은 RED 커밋(509ee788) 뒤 GREEN 이었으나, Task 2 는 구현 뒤 시험을 쓰고 한 커밋에 묶었다(시험이 처음부터 구현을 가리켜 RED 실패 증거가 없다). 시험은 서버 집계만 그림·낙관 mine 만·거절 복귀·알림 교체·재접속 무이펙트·끊김 비활성을 직접 단언한다.

**총:** 3건(Rule 3 1, Rule 2 1, 프로세스 1). 계획 범위 안이고 사용자 영향 없음.

## Authentication Gates

없음.

## Known Stubs

없음 — 하드코딩된 빈 값·자리표시 문구 없음.

## Threat Flags

없음 — 새 네트워크·인증·스키마 경계 없음. T-13-08(낙관은 mine 만), T-13-09(닉네임은 텍스트 노드, 시험 포함), T-13-10(역할 값 안 읽음)을 지켰다.

## 검증

- `npx vitest run --project client` 70 파일 2420 통과, `test/unit/dayView·presence·soundDirector·pickTurn·willLetter` 428 통과, `npm run typecheck`(app·worker) 통과.
- 남은 실패(13-04 몫, 건드리지 않음): `test/unit/view.test.ts` 14건. `test/worker/leak.test.ts` 는 이 계획에서 돌리지 않았다.
- UI#4(2~8명 가림)·UI#11(검은 화면)은 backstop(실기기·E2E) 항목이라 이 계획의 자동 시험에는 없다.

## Self-Check: PASSED

- 수정 파일 13개 존재 확인, 커밋 509ee788·9c233e63·10ebe8be 가 HEAD 의 조상임을 확인.
