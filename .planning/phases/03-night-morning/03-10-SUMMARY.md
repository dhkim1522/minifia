---
phase: 03-night-morning
plan: 10
subsystem: client-morning-announcement
tags: [tdd, tracer, morning, elimination-text, timer-calm, day-scene, design-refs]
status: complete

requires:
  - phase: 03-night-morning/03-01
    provides: MORNING_PHRASE_COUNT, MorningView, DayView.morning, RoomScreen PHASE_ANNOUNCE
  - phase: 03-night-morning/03-05
    provides: 서버 view 의 day.morning (morning 단계, 모든 viewer 같은 값), 탈락자 view 의 spectate
  - phase: 03-night-morning/03-08
    provides: DayScene 밤·관전 분기, NightPanel·NIGHT_PANEL_TEXT(morning 문구), src/styles/night.css
provides:
  - "탈락 문구 표 한 곳 — ELIMINATION_TAILS(8)·eliminationTitle·MORNING_SAFE·morningCardText (src/game/eliminationText.ts)"
  - "아침 발표 카드 MorningCard(.mf-morningcard) — 테이블 위 가운데 폭 252·위 168 (src/components/MorningCard.tsx, src/styles/night.css)"
  - "DayScene 아침 분기 — 위쪽 바 '아침' / 'N+1일차', 낮 배경, 모두 같은 하단 '아침이 밝았습니다' / '곧 낮 토론이 시작돼요'"
  - "Timer calm 속성 — 아침 5초는 진홍(urgent)을 쓰지 않는다 (src/components/Timer.tsx)"
  - "RoomScreen PHASE_ANNOUNCE.morning — 카드와 같은 문장 출처의 단계 안내"
affects: [03-11, 03-12]

tech-stack:
  added: []
  patterns:
    - "문장은 서버가 보낸 번호·seat 로 화면이 만든다. 범위 밖 번호는 첫 문구, 닉네임을 못 찾으면 무사 문구 — 예외 없음"
    - "카드와 접근성 안내가 같은 함수(morningCardText)에서 문장을 만든다"
    - "아침 하단 분기는 관전 하단보다 먼저다 — 살아 있는 사람·탈락자·관전자 모두 같은 하단"
    - "밤 표시(선택 링·표적 배지·대상 버튼)는 night 단계 입력에서만 만든다 — 아침에는 입력 자체가 없어 저절로 사라진다"

key-files:
  created:
    - src/game/eliminationText.ts
    - src/components/MorningCard.tsx
    - test/client/morning.test.tsx
    - test/unit/eliminationText.test.ts
  modified:
    - src/screens/DayScene.tsx
    - src/screens/RoomScreen.tsx
    - src/components/Timer.tsx
    - src/styles/night.css
    - test/client/timer.test.tsx
    - test/client/phaseScreens.test.tsx
    - HANDOFF.md

key-decisions:
  - "카드는 .mf-dayscene 직계(장면 상자 밖)에 두고, 기준 상자를 확실히 하려고 night.css 에서 .mf-dayscene 에 position: relative 를 더했다(계획이 허용한 조건부 항목). 카드 진입 페이드는 기존 .mf-dayscene__enter(opacity 만)를 재사용해 translateX(-50%) 를 건드리지 않는다"
  - "모서리 16px 은 토큰에 없는 시안 값이라 night.css 에 지역 상수 주석과 함께 둔다"
  - "Timer 의 calm 은 urgent 클래스를 붙이지 않는 것으로 구현했다 — 숫자 팝 애니메이션이 urgent 클래스 안에 있어 같이 꺼진다"
  - "아침 안내는 '아침이 밝았습니다. ' + 제목 + (보조가 있으면 '. ' + 보조)로, 탈락 문구는 제목뿐이고 무사 문구는 제목+보조 둘을 읽는다"

requirements-completed: []

coverage:
  - id: C1
    description: "아침 5초 동안 테이블 위 가운데 카드에 지난밤 결과가 모든 폰에서 같게 보인다: 탈락자가 있으면 '{닉네임}님이 …' 제목 하나(보조 없음), 없거나 의사가 지켰으면 '아무 일도 없었습니다' / '모두 무사해요'"
    requirement: "NIGHT-06"
    verification:
      - kind: unit
        ref: "test/client/morning.test.tsx#아침 발표 (M1)"
        status: pass
      - kind: unit
        ref: "test/client/morning.test.tsx#무사·타이머·표시 소멸·탈락 순간 (03-10)"
        status: pass
    human_judgment: false
  - id: C2
    description: "탈락 문구 여덟 개가 한 표에 있고 이름 뒤에는 받침과 무관하게 항상 '님이'. 표 길이는 서버 MORNING_PHRASE_COUNT 와 같고 범위 밖 번호(0·9·1.5·NaN·undefined)는 첫 문구"
    requirement: "NIGHT-06"
    verification:
      - kind: unit
        ref: "test/unit/eliminationText.test.ts#ELIMINATION_TAILS"
        status: pass
      - kind: unit
        ref: "test/unit/eliminationText.test.ts#eliminationTitle"
        status: pass
    human_judgment: false
  - id: C3
    description: "아침 위쪽 바 '아침' / 'N+1일차', 낮 배경, 하단은 탈락자·관전자도 같은 '아침이 밝았습니다' / '곧 낮 토론이 시작돼요'(알약·채팅·버튼 없음)"
    requirement: "NIGHT-06"
    verification:
      - kind: unit
        ref: "test/client/morning.test.tsx#아침 발표 (M1)"
        status: pass
    human_judgment: false
  - id: C4
    description: "아침 타이머는 마지막 5초여도 진홍이 아니고, 밤 타이머의 마지막 5초는 그대로 진홍이다"
    requirement: "NIGHT-06"
    verification:
      - kind: unit
        ref: "test/client/timer.test.tsx#Timer"
        status: pass
      - kind: unit
        ref: "test/client/morning.test.tsx#무사·타이머·표시 소멸·탈락 순간 (03-10)"
        status: pass
    human_judgment: false
  - id: C5
    description: "아침 시작에 밤의 선택 링·표적 배지·동료 선택 배지·대상 버튼이 사라지고 마피아의 동료 링·마름모는 남는다. 탈락자는 유령 그림 + '탈락', 방금 탈락한 본인 화면은 아침부터 관전 이름표(실제 직업)"
    requirement: "ELIM-01"
    verification:
      - kind: unit
        ref: "test/client/morning.test.tsx#무사·타이머·표시 소멸·탈락 순간 (03-10)"
        status: pass
    human_judgment: false
  - id: C6
    description: "아침 view 를 받으면 단계 안내가 '아침이 밝았습니다. ' + 카드 제목(무사면 '아무 일도 없었습니다. 모두 무사해요')을 읽는다"
    requirement: "NIGHT-06"
    verification:
      - kind: unit
        ref: "test/client/phaseScreens.test.tsx#밤·아침 라우팅과 안내"
        status: pass
    human_judgment: false
  - id: C7
    description: ".mf-morningcard 의 값이 시안 .bn 을 토큰으로 옮긴 것이다(absolute·z-index 70·top 168·폭 252·color-mix 92%·그림자·테두리·keep-all, 제목 24px 700 gray-50, 보조 14px gray-300)"
    requirement: "NIGHT-06"
    verification:
      - kind: unit
        ref: "test/client/morning.test.tsx#night.css: 아침 카드 (03-10)"
        status: pass
    human_judgment: false
  - id: C8
    description: "360×640 에서 아침 카드 제목 3줄(닉네임 5자 + 님이)이 뒷자리 이름표를 가리는 정도가 시안 승인 범위 안이다"
    requirement: "NIGHT-06"
    verification:
      - kind: backstop
        ref: "03-12 배포본 360폰 확인"
        status: pending
    human_judgment: true
    rationale: "계획이 backstop 으로 둔 항목이다. jsdom 은 글줄 수·좌표를 재지 못한다. 카드 top 168 은 시안 값 그대로이고, 닉네임 5자는 keep-all 로 최대 3줄이 된다"

actuals:
  tokens: 5800   # chars/4 over git diff 소스·테스트 (23133자, .planning 제외)
  tasks: 3
  commits: 6
plan_head_before: cf222342af1e3aa43661c3afd717f89bddca2a9f
plan_head_after: 66e3b5764b30f0261cc1272ef2f01d2e8bfadfb0
---

# Phase 3 Plan 10: 아침 발표 Summary

**아침 5초에 모든 폰이 낮 테이블 위 가운데 카드로 같은 결과('{닉네임}님이 …' 여덟 문구 중 서버가 고른 하나, 또는 '아무 일도 없었습니다 / 모두 무사해요')를 보고, 위쪽 바 '아침 / N+1일차'·모두 같은 하단·진홍 없는 타이머·카드와 같은 단계 안내를 갖게 했다.**

## Performance

- **Duration:** 약 12분 (2026-10-25)
- **Tasks:** 3 (Task 1 트레이서 TDD, Task 2·3 TDD)
- **Files:** 소스 6개(eliminationText·MorningCard 신규, DayScene·RoomScreen·Timer·night.css) + 테스트 4개

## Accomplishments

- **문구 표 한 곳(Task 1):** `ELIMINATION_TAILS` 여덟 문장과 `eliminationTitle(phrase, nickname)` = `${nickname}님이 ${tail}`. 받침 판정(`hasBatchim`)은 쓰지 않는다. 번호가 1..8 정수가 아니면 첫 문구. `MORNING_SAFE` 와 `morningCardText(morning, nicknameOf)` 가 탈락/무사를 고른다(탈락자 닉네임을 못 찾으면 무사). 입력은 seat·번호뿐이라 직업 글자가 들어올 길이 없다(T-03-30).
- **카드·헤더·하단(Task 1):** `MorningCard` 는 `.mf-dayscene` 직계(장면 상자 밖)에 놓이고, `.mf-morningcard` 는 시안 `.bn` 값을 토큰으로 옮겼다(색 면 `color-mix(in srgb, var(--night-900) 92%, transparent)`, 그림자 `0 10px 28px var(--shadow)`, 모서리 16 은 지역 상수). 제목 `아침`·안내 `N+1일차`·낮 배경, 하단은 모두 같은 `NightPanel`(아침이 밝았습니다 / 곧 낮 토론이 시작돼요, 알약 없음).
- **calm 타이머(Task 2):** `Timer calm` 이면 마지막 5초여도 `mf-timer--urgent` 를 붙이지 않는다(숫자 팝도 같이 꺼진다). DayScene 이 morning 에서만 `calm` 을 넘긴다. 밤 타이머는 그대로 진홍.
- **밤 표시 소멸·탈락 순간(Task 2):** 선택 링·표적 배지·동료 선택 배지·대상 버튼은 night 입력에서만 만들어지므로 morning 에서 0 개가 되고, 마피아의 동료 링·마름모는 남는다. 살아 있는 사람 화면의 탈락자는 유령 + `탈락`(직업 글자 없음), 방금 탈락한 본인은 03-08 규칙 그대로 아침부터 실제 직업 줄을 본다. 아침 하단 분기가 관전 하단보다 먼저라 본인 화면에도 `.mf-ro` 가 없다.
- **단계 안내(Task 3):** `PHASE_ANNOUNCE.morning` = `아침이 밝았습니다. ${title}` + (보조가 있으면 `. ${sub}`), `morningCardText` 로 카드와 같은 출처에서 만든다.
- 전체: `npx vitest run` 62 파일·1277 통과, `npm run typecheck`·`npm run build` 통과.

## TDD

### RED

- Task 1: `morning.test.tsx` "아침 발표 (M1)"·"night.css: 아침 카드". 목표 테스트 "위쪽 바 제목 '아침' …" 이 `expected '낮 · 직업 공개' to be '아침'` 로 실패(7건 중 6건 실패, `gsd check tdd-red-evidence` → RED_EVIDENCE_OK). **semanticAssessment:** 대상이 실행되어 아침 제목 미구현에서 정확히 실패했고 import·문법·fixture 오류가 아니다. 카드 없음(`expected +0 to be 1`)·CSS 규칙 없음 단언도 각자의 단언으로 실패. "night → morning 같은 DOM 노드" 가드는 RED 에서도 통과한다(03-08 이 이미 보장, 범위 고정용).
- Task 2: `timer.test.tsx` "calm 이면 …". 목표가 `expected true to be false` 로 실패(2건 실패: Timer 단위 + DayScene 아침 타이머). RED_EVIDENCE_OK. **semanticAssessment:** calm 속성이 무시되어 urgent 가 붙는 것이 단언에서 확인됐다. "밤 표시 소멸"·"탈락 순간" 테스트들은 아침 분기(Task 1)와 03-08 규칙으로 이미 통과한다 — 계획이 요구한 Task 1 범위 고정 테스트이며, 이는 RED 단계에서 정상이다.
- Task 3: `phaseScreens.test.tsx` "morning view(eliminated 2, phrase 1) → 안내 …". 목표가 `expected '' to be '아침이 밝았습니다. 민지님이 …'` 로 실패(2건 실패). RED_EVIDENCE_OK. **semanticAssessment:** `PHASE_ANNOUNCE.morning` 이 빈 문자열이라 안내 단언에서 실패했다. `eliminationText.test.ts` 7건은 계획대로 Task 1 구현으로 바로 통과했다(문구 표 단위 테스트).

### GREEN

각 태스크의 최소 구현으로 통과. 트레이서 게이트: 자동 검사뿐인 `<verify>` 라 `npx vitest run test/client/morning.test.tsx test/client/nightScene.test.tsx test/client/dayScene.test.tsx`(53건)·`npm run typecheck` 를 다시 돌려 통과를 확인하고 확장 태스크로 넘어갔다 — Tracer verified end-to-end.

### REFACTOR

없음.

### Commits

- dfb6f05 test(03-10): morning card with elimination phrase
- 5a20cf0 feat(03-10): morning announcement card
- 12a8287 test(03-10): calm morning timer and morning-time marks
- 9920f7c feat(03-10): calm morning timer and morning marks
- 7ea2d20 test(03-10): elimination phrase table and morning announcement
- 66e3b57 feat(03-10): morning phase announcement

`commits: 6` 은 `git rev-list --count ${plan_head_before}..HEAD` 로 측정한 값이다(HANDOFF 갱신·SUMMARY 커밋은 그 뒤에 더해진다).

## TDD Gate Compliance

세 태스크 모두 `test(03-10)` 커밋이 해당 `feat(03-10)` 커밋보다 먼저다(위 순서). 각 RED 는 `gsd check tdd-red-evidence` 로 RED_EVIDENCE_OK 를 받은 뒤 커밋했고, 실패 보고서는 한 줄 단언(문자열·불리언)이라 tap-flat 이 깨지지 않았다.

## Deviations from Plan

None - plan executed exactly as written. (세부 선택은 key-decisions 에 적었다. 특히 `.mf-dayscene { position: relative; }` 는 계획이 "필요하면" 으로 허용한 항목이다.)

## Issues Encountered

없음.

## Known Stubs

없음. 낮 처형 문구(4페이즈)와 아침 전환 연출 강화(5페이즈)는 계획이 정한 범위 밖이다.

## Threat Flags

없음. 새 네트워크 입구·인증 경로·신뢰 경계 변화가 없다. T-03-30(카드·안내 입력은 탈락 seat·번호뿐이고 의사 구출과 지목 없음이 같은 MORNING_SAFE)·T-03-31(범위 밖 번호는 첫 문구, 닉네임 없음은 무사 문구, 예외 없음 — 단위 테스트)·T-03-SC(새 패키지 없음)를 지켰다.

## Self-Check: PASSED

- 파일: src/game/eliminationText.ts, src/components/MorningCard.tsx, test/client/morning.test.tsx, test/unit/eliminationText.test.ts 존재 확인
- 커밋: dfb6f05, 5a20cf0, 12a8287, 9920f7c, 7ea2d20, 66e3b57 모두 HEAD 의 조상
- 인수 기준: `님이` 3·`hasBatchim` 0·`.mf-morningcard`(night.css) 3·`calm`(Timer) 4·`<Timer … calm` 1·`morningCardText(`(RoomScreen) 1·`MORNING_PHRASE_COUNT`(단위 테스트) 포함·`아침이 밝았습니다`(phaseScreens) 포함 모두 통과
- 각 태스크의 `test(03-10)` 커밋이 해당 `feat(03-10)` 커밋보다 앞
- 전체 검증: `npx vitest run` 1277 통과, `npm run typecheck`, `npm run build` 통과

## Next Phase Readiness

03-11([수사 기록])이 위쪽 바 extra 슬롯을 이어 받고, 03-12 배포본에서 360폰 카드 3줄 겹침(C8)과 8명판 확인을 사람이 본다.
