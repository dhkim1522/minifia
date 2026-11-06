---
phase: 14-host-and-labels
plan: "05"
subsystem: ui-role-card-and-lobby
tags: [role-goal, role-reveal, call-glow, tool-label, host-03, host-04, host-05, tool-01, tool-02, tool-03, minifia-v3, u-2, u-3]
status: complete

requires:
  - phase: 14-01
    provides: callTargetsOf(view, { cardSeen }) — start·card 빛남 대상, 띠가 헤더 아랫변을 재서 붙는 규칙
  - phase: 14-02
    provides: 헤더 = 제목 + extra(PhaseHeader), 안내·시간 링 제거 규칙
  - phase: 14-04
    provides: .is-call CSS·data-call 값 없는 표식 규칙
provides:
  - "ROLE_TEXT[role].goal 4문장(UI-SPEC 표 원문) + RoleGoal 부품(.mf-goal, data-role-goal) — 카드 앞면·[내 역할] 시트 앞면 name·desc 다음"
  - "역할 확인 머리 = .mf-reveal__header(PhaseHeader 제목 '역할 확인' + [내 역할]) — 안내·보조 줄·m:ss Timer 삭제, 공개 예고(data-pre-notice) 유지"
  - "RoleCard call prop(루트 is-call + data-call), RoleReveal 이 callTargetsOf(view, { cardSeen: card.seenFront }) 로 카드 빛남을 정함"
  - "RoleCardButton 한 모양: 아이콘 면 36 아래 한 단어 '내 역할'(aria-label '내 역할' / '내 역할, 새 기록', data-tool-label='내 역할')"
  - "ActionButton call prop, Lobby 방장 [시작] 빛남(callTargetsOf start + canSend + 아직 안 누름)"
affects: [14-06, 14-07, 14-09]

requirements-completed: [TOOL-03, TOOL-01, TOOL-02, HOST-03, HOST-04, HOST-05]

actuals:
  tokens: 21000
  tasks: 3
  commits: 6

plan_head_before: f42822c43d70767472c633c9b6ad619d5640731b
plan_head_after: 2377986d5d0bbaa1c71e134f0541ff3fccf01877

tech-stack:
  added: []
  patterns:
    - "목표 문장은 호출하는 쪽이 자기 역할의 ROLE_TEXT[role].goal 하나만 RoleGoal 에 넘긴다 — 부품은 다른 역할 문장을 모르고 모으지 않는다. 카드는 앞면이 마운트될 때만 그려 뒷면 DOM 에 없다"
    - "역할 확인 카드 빛남 조건은 me.role 유무 + 내가 앞면을 봤는가(card.seenFront)뿐 — 마운트 때 이미 앞면이면(재접속) 처음부터 꺼져 있다"
    - "[시작] '눌렀음' 은 대기실 로컬 상태 하나(startPressed) — 서버 거절로 2초 잠금이 풀려도 되살아나지 않는다"

key-files:
  created:
    - src/components/RoleGoal.tsx
  modified:
    - src/game/roleText.ts
    - src/components/RoleCard.tsx
    - src/components/RoleCardSheet.tsx
    - src/components/RoleCardButton.tsx
    - src/components/ActionButton.tsx
    - src/components/v2/HostBand.tsx
    - src/screens/RoleReveal.tsx
    - src/screens/Lobby.tsx
    - src/styles/phase.css
    - src/styles/rolecard.css
    - src/styles/game.css
    - test/client/roleCard.test.tsx
    - test/client/roleCardSheet.test.tsx
    - test/client/roleCardFlow.test.tsx
    - test/client/phaseScreens.test.tsx
    - test/client/gameMap.test.tsx
    - test/client/preGame.test.tsx
    - test/client/testTools.test.tsx
    - test/client/resultScreen.test.tsx
    - test/client/lobby.test.tsx

key-decisions:
  - "목표 줄 자리: 카드 앞면은 이름·설명 다음, 구분선·동료 줄 앞. 시트 앞면은 오른쪽 열(.mf-rolecard__t)의 설명 다음, 동료 줄 앞(왼쪽 정렬). 윗줄 night-600 구분선은 .mf-goal 자신의 border-top"
  - "RoleCardButton 은 Button 부품 대신 raw <button class='mf-btn mf-rolecard-btn'> — data-tool-label 을 싣기 위함. iconOnly prop 은 받기만 하고 쓰지 않는다(호출처 GameMap 은 그대로 둠)"
  - "통일된 [내 역할] 단추의 새 기록 점은 v2.0 규칙대로 gray-100 8px(옛 글자판의 앰버 12px 는 폐기). 빛나지 않는다(이 계획 범위 밖)"
  - "역할 확인 머리는 게임 화면 헤더와 같은 absolute 62 모양(.mf-reveal > .mf-reveal__header)으로 바꿔 띠(HostBand)가 같은 방식으로 붙게 했다. 무대는 padding-top = --mf-host-bottom + 8(없으면 62 + 8)"
  - "헤더 윗여백 18 → var(--space-sm) 8 (게임·역할 확인 둘 다): [내 역할] 단추가 약 57 로 커져 띠가 13px 더 내려가는 것을 줄이기 위함(새 높이 값 없이 토큰 간격만)"

duration: 약 50분
completed: 2026-11-07
---

# Phase 14 Plan 05: 역할 목표 한 줄·역할 확인 정리·[내 역할] 이름표·[시작] 빛남 Summary

역할 카드와 [내 역할] 시트 앞면에 자기 역할의 "목표" 한 줄을 붙이고, 역할 확인 화면을 띠 계약(제목 + [내 역할], 옛 안내·타이머 제거)에 맞추고, 카드와 대기실 [시작]이 사회자 줄이 부를 때 빛나게 했다.

## 수행한 일

1. **Task 1 — 역할 목표 한 줄 (TOOL-03, D-05, HOST-05)** — `ROLE_TEXT` 에 `goal` 4문장(마피아·경찰·의사·시민, UI-SPEC 원문). `RoleGoal` 부품(`.mf-goal`, `data-role-goal`, 칩 "목표" + 문장)을 카드 `CardFront` 와 시트 `Front` 가 쓴다. 뒷면(앞면 마운트 전)·시트 `showBack`·역할 없음에는 만들지 않는다. 네 역할 × 다른 세 역할 목표 부재를 시험으로 고정했다.
2. **Task 2 — 역할 확인 정리·카드 빛남·[내 역할] (U-2, U-3, HOST-03, HOST-04, TOOL-01)** — `RoleReveal` 에서 `PhaseBar`·`Timer`·안내 p·보조 p 를 지우고 `.mf-reveal__header`(PhaseHeader) 로 교체. `callTargetsOf(view, { cardSeen: card.seenFront })` 가 card 면 `RoleCard call`. 앞면을 처음 보면(누름·5초 자동) 꺼지고 뒷면으로 가려도 되살아나지 않는다. `RoleCardButton` 두 모양을 한 모양("내 역할")으로 통일. `HostBand` 의 헤더 선택자에 `.mf-reveal__header` 를 더했다.
3. **Task 3 — 대기실 [시작] 빛남 (HOST-03)** — `ActionButton call` + `Lobby` 가 `callTargetsOf(view)` 가 start 이고 `canSend` 이고 아직 안 눌렀을 때만 `call`.

## 검증

- `npm test`(unit + client + worker): 241 파일 통과 / 7015 통과(기준선 6980 + 신규 시험), `npm run typecheck` 통과.
- `git diff --quiet 2736a336 -- worker shared` 성공(서버·공유 diff 0).
- 인수 기준 grep: `goal:` 4, `data-role-goal` 카드·시트 각 1+, `승리합니다` 2, `<Timer` 0, `mf-reveal__sub|hint"` 0, `callTargetsOf` RoleReveal 3·Lobby 3, `data-call` ActionButton 2, `내 역할` RoleCardButton 2+.
- 실기기·시각 확인(카드 높이에서 목표 줄 2줄, 360폭 헤더 단추 57px 잘림 여부, 빛남 모양)은 실행하지 않았다 — 자동 시험은 DOM·CSS 규칙까지만 본다. 사용자 메모대로 실기기 검사는 끝에 몰아서 한다.

## 이월 정리

- 14-02 가 임시로 둔 `phaseScreens.test` 의 `stageTimer` 도우미를 지웠다(역할 확인의 옛 Timer 가 없어졌으므로 `stageTimers()` 가 0개를 확인한다).
- **`PhaseBar`·`Timer` 사용처가 0 이 되었다.** `src/components/PhaseBar.tsx`·`Timer.tsx` 와 `phase.css` 의 `.mf-phasebar*`/`.mf-timer*` 규칙은 plan 대로 지우지 않고 남겼다(`timer.test`·`backdropContrast.test` 가 규칙을 본다). 정리는 별도 판단.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] HostBand 헤더 선택자에 .mf-reveal__header 추가**
- **Found during:** Task 2
- **Issue:** 역할 확인 머리를 `.mf-phasebar` 에서 `.mf-reveal__header` 로 바꾸자 HostBand 가 헤더 아랫변을 못 재서 띠 위치 기준(`--mf-host-top`)이 기본값으로 떨어질 위험
- **Fix:** `HEADER_SELECTOR` 에 `.mf-reveal__header` 추가
- **Files modified:** src/components/v2/HostBand.tsx
- **Commit:** 8209aa5f

**2. [Rule 1 - Bug] 기존 시험 기대를 새 계약으로 갱신**
- **Found during:** Task 1·2
- **Issue:** 목표 줄이 더해져 `ROLE_TEXT toEqual`, 카드 앞면 마크업 순서, 시트 오른쪽 열 줄 목록 시험이, 헤더 단추 이름이 바뀌어 `역할 카드` 이름 단추 시험(phaseScreens·roleCardFlow·gameMap·resultScreen·testTools·preGame)과 `.mf-rolecard-btn` CSS 규칙 시험이 깨짐
- **Fix:** RED 커밋에서 새 계약 기대로 바꿨다(시트 dialog 의 aria-label "역할 카드" 기대는 그대로)
- **Files modified:** test/client/* (위 key-files)
- **Commit:** 09864ba7, 6c36676c

### 계획 해석·선택 (편차 아님, 기록)

- 새 기록 점 색을 gray-100 8px 로 통일(옛 글자판 앰버 12px 폐기) — 계획 "새 기록 점은 그대로" 는 점의 존재·접근성 이름 유지로 읽었다. v2.0 은 앰버를 쓰지 않는다는 기존 규칙(rolecard.css 옛 주석)과 일치. 되돌리려면 `.mf-rolecard-btn__dot` 한 규칙.
- 헤더 윗여백 18 → 8(계획 Task 2 GREEN 4번이 허용한 "토큰 간격으로 줄임").

## Known Stubs

없음.

## Threat Flags

없음. (T-14-14: 목표 문장은 자기 역할 분기에서 하나만 — 시험 고정, T-14-15: 카드 빛남 루트 모양이 역할과 무관하게 동일 — 시험 고정, T-14-02: 서버·공유 diff 0.)

## Self-Check: PASSED

- 생성 파일: src/components/RoleGoal.tsx, 이 SUMMARY — 존재
- 커밋 6개 모두 HEAD 의 조상: 09864ba7, af8e90fa, 6c36676c, 8209aa5f, 131f7a77, 2377986d
