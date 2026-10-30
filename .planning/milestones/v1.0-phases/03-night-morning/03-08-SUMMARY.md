---
phase: 03-night-morning
plan: 08
subsystem: client-night-scene
tags: [tdd, tracer, night, day-scene, pick, spectator, ghost, design-refs]
status: complete

requires:
  - phase: 03-night-morning/03-01
    provides: night·morning 단계와 와이어 계약(view.me.pick·allyPicks, view.spectate, {t:"pick"}), RoomScreen 의 같은 장면 키
  - phase: 03-night-morning/03-02
    provides: DayTable 의 onPick·pick·dead·spectatorPicks·real 줄·pickVerb·pickDisabled·allyMarkLabel, ghostSrc()
  - phase: 03-night-morning/03-06
    provides: CHAT_PHASES(밤 채팅 수집), MessageLog 의 systemLine·label·more, DiscussionControls 의 templates, ReadOnlyRow
provides:
  - DayScene 의 밤 장면 — 밤 배경(즉시 교체)·헤더·역할별 하단·대상 탭·낙관적 선택·선택 거부 토스트 (src/screens/DayScene.tsx)
  - 관전 화면(결정 0021) — view.spectate 에서만 만든 실제 직업 줄·모든 마피아 링·역할별 표적 배지·읽기 전용 하단(밤 마피아 채팅·낮 채팅)
  - NightPanel·PickPill·NoticePill·NIGHT_PANEL_TEXT (src/components/NightPanel.tsx) — 아침 하단 문구(morning)도 표에 두어 03-10 이 쓴다
  - src/styles/night.css — .mf-nightpanel·.mf-pk(시안 f6 .pk 를 토큰으로)
  - rolePreloadList 에 밤 배경·유령 그림 (src/net/assets.ts) — 목록 7개, 역할과 무관
affects: [03-09, 03-10, 03-11, 03-12]

tech-stack:
  added: []
  patterns:
    - "낙관적 선택은 ClaimPanel 과 같은 pending { view, target } — 새 서버 view 객체가 오면 버리고 me.pick 을 따른다. 같은 대상 재탭은 보내지 않는다"
    - "장면 하나가 단계·역할·생존으로 하단을 고른다: meDead → 관전 하단, 마피아 → 채팅, 경찰·의사 → NightPanel+PickPill, 그 밖의 생존자 → 시민 안내"
    - "관전 표시의 입력(real 줄·spectatorPicks·마피아 링·allyMarkLabel)은 모두 meDead && view.spectate 한 곳에서만 만든다 — 살아 있는 사람 화면에는 입력도 DOM 도 없다"
    - "선택 거부 토스트는 하단이 NightPanel 일 때만 장면이 구독한다(마피아 하단은 DiscussionControls 가 이미 구독, 중복 없음)"

key-files:
  created:
    - src/components/NightPanel.tsx
    - src/styles/night.css
    - test/client/nightScene.test.tsx
  modified:
    - src/screens/DayScene.tsx
    - src/net/assets.ts
    - test/unit/assets.test.ts

key-decisions:
  - "아침 단계의 제목·하단·카드는 건드리지 않았다(03-10 범위). 관전 하단도 morning 에서는 그리지 않는다(UI-SPEC: 아침 하단은 모두 같다)"
  - "spectate 가 없는 탈락자 view(옛 서버)는 이름표에 '탈락' 표시만, 다른 자리는 평소 주장 줄을 그대로 둔다. 하단은 관전 하단이다"
  - "NightPanel 문구 표(NIGHT_PANEL_TEXT)에 선택 거부 토스트(pickError)와 마피아 채팅 안내(mafiaChatNotice)도 둔다. 관전 안내('관전 중 · 마피아 채팅')는 계획의 인수 기준대로 DayScene 에 글자로 둔다"
  - "마피아 하단 HTML 의 '역할 이름 없음' 테스트는 허용 문구('마피아끼리만 보여요'·'마피아 채팅')를 빼고 검사한다 — 이 두 문구는 UI-SPEC Copywriting 이 정한 고정 문구라 역할 이름이 아니라 채널 이름이다"

requirements-completed: []

coverage:
  - id: C1
    description: "밤이 되면 같은 테이블(.mf-dt 루트 같은 DOM 노드) 위에서 배경만 밤으로 바뀌고 위쪽 바가 '밤' / 'N일차'(살아 있는 마피아는 'N일차 · 함께 지목하세요')이며 타이머는 하나"
    requirement: "NIGHT-04"
    verification:
      - kind: unit
        ref: "test/client/nightScene.test.tsx#밤 — 경찰 (N-3)"
        status: pass
      - kind: unit
        ref: "test/client/nightScene.test.tsx#밤 — 마피아 (N-2)"
        status: pass
    human_judgment: false
  - id: C2
    description: "경찰·의사: 살아 있는 모든 사람(자신 포함)이 대상 버튼이고, 누르면 {t:'pick', target} 한 번과 함께 링·표적 배지·aria-pressed·알약 '선택 ●이름'(자신 '나')이 즉시 바뀐다. 같은 대상 재탭은 보내지 않고, 새 view 가 오면 me.pick 을 따른다"
    requirement: "NIGHT-02, NIGHT-03"
    verification:
      - kind: unit
        ref: "test/client/nightScene.test.tsx#밤 — 경찰 (N-3)"
        status: pass
      - kind: unit
        ref: "test/client/nightScene.test.tsx#밤 — 의사·시민 (N-3·N-4)"
        status: pass
    human_judgment: false
  - id: C3
    description: "마피아: 자신·동료는 버튼이 아니고(링·마름모 유지), 동료 선택 배지가 allyPicks 로 뜨며 내 선택과 겹치면 --ally·--me 둘 다. 하단은 로그 '마피아 채팅'(첫 줄 '마피아끼리만 보여요')+[빠른 메시지](밤 세 문구)·[이모티콘], 밤 emoji·chat 이벤트가 머리 위·로그에 반영된다"
    requirement: "NIGHT-01"
    verification:
      - kind: unit
        ref: "test/client/nightScene.test.tsx#밤 — 마피아 (N-2)"
        status: pass
    human_judgment: false
  - id: C4
    description: "시민: 테이블에 버튼이 없고 하단은 '밤이 되었어요'·안내·'이번 밤에는 할 수 있는 행동이 없어요'. 마피아·시민 하단에 역할 이름이 없다(고정 문구 제외)"
    requirement: "NIGHT-04"
    verification:
      - kind: unit
        ref: "test/client/nightScene.test.tsx#밤 — 의사·시민 (N-3·N-4)"
        status: pass
    human_judgment: false
  - id: C5
    description: "끊김(canSend false)에는 대상 버튼이 모두 disabled 이고 보내지 않는다. BAD_MESSAGE 는 '보내지 못했어요. 다시 시도해 주세요' 토스트, WRONG_PHASE 는 표시 없음"
    requirement: "NIGHT-04"
    verification:
      - kind: unit
        ref: "test/client/nightScene.test.tsx#밤 — 오류·끊김·탈락 표시"
        status: pass
    human_judgment: false
  - id: C6
    description: "관전 화면(탈락한 나 + view.spectate): 나 유령 + '탈락', 다른 자리 실제 직업 점선 줄(마피아만 진홍), 모든 마피아 링·마름모('마피아'), 밤 역할별 표적 배지(role=img), 버튼 0 개. 밤 하단은 읽기 전용 마피아 채팅(^ 없음)+'탈락했어요 · 볼 수만 있어요', 낮 단계는 낮 채팅 읽기 전용+같은 줄(직업 공개 칩 줄 없음)"
    requirement: "ELIM-01"
    verification:
      - kind: unit
        ref: "test/client/nightScene.test.tsx#관전 (N-6, 결정 0021)"
        status: pass
    human_judgment: false
  - id: C7
    description: "누출 방지: 살아 있는 사람 화면의 테이블 입력·DOM 에 실제 직업 줄·관전 배지·.mf-ro 가 없고(탈락자는 유령 + '탈락' 뿐), 옛 서버처럼 spectate 가 없는 탈락자 view 는 이름표에 탈락 표시만 그린다. 밤 배경·유령 그림은 역할과 무관한 같은 목록으로 미리 받는다"
    requirement: "ELIM-01"
    verification:
      - kind: unit
        ref: "test/client/nightScene.test.tsx#관전 (N-6, 결정 0021)"
        status: pass
      - kind: unit
        ref: "test/unit/assets.test.ts#미리 받기 목록"
        status: pass
    human_judgment: false
  - id: C8
    description: "360폰(폭 328 하단)에서 경찰·의사·시민 안내가 2줄 안이고 알약과 함께 하단 157 안에 든다"
    requirement: "NIGHT-04"
    verification:
      - kind: backstop
        ref: "03-12 배포본 360폰 확인"
        status: pending
    human_judgment: true
    rationale: "계획이 backstop 으로 둔 항목이다. jsdom 은 글줄 수·높이를 재지 못한다. UI-SPEC 높이 계산(151/157)은 안내 2줄을 전제하므로 실기기에서 줄바꿈을 본다"
  - id: C9
    description: "8명판에서 앞쪽 자리 캐릭터 누르기 영역이 이웃에 가려져 원하는 사람을 누르기 어렵지 않다"
    requirement: "NIGHT-04"
    verification:
      - kind: backstop
        ref: "03-12 배포본 8명판 확인"
        status: pending
    human_judgment: true
    rationale: "누르기 영역 겹침은 좌표·z-index 의 실제 렌더에서만 보인다. 좌표 계산(game/dayTable.ts)은 이 계획이 고치지 않았다"
  - id: C10
    description: "관전자 화면(8명, 실제 직업 줄 + 표적 배지 최대 3개 + 링·마름모)이 360폰에서 이웃 이름표를 가리지 않는다"
    requirement: "ELIM-01"
    verification:
      - kind: backstop
        ref: "03-12 배포본 360폰 확인"
        status: pending
    human_judgment: true
    rationale: "배지·점선 줄 겹침은 실제 화면 폭에서만 확인된다(UI-SPEC UI Considerations 🧪 backstop)"

actuals:
  tokens: 8700
  tasks: 3
  commits: 6
plan_head_before: 5a7e1d9e1d8b3c7394c6f8b003a58f36ad08b5b5
plan_head_after: b84af9bea362905e585547f1c9ce82db5f2c089a
---

# Phase 3 Plan 08: 밤 화면(역할별)과 관전 화면 Summary

**낮 장면(DayScene) 안에서 배경·헤더·하단만 역할별로 갈리는 밤 화면 — 캐릭터를 직접 탭해 대상을 고르고(낙관적 선택, 서버 값 우선), 마피아는 밤 채팅, 시민은 안내만 — 과 탈락자에게만 서버가 보낸 view.spectate 로 그리는 관전 화면, 살아 있는 사람 화면의 유령 탈락 표시를 만들었다.**

## Performance

- **Duration:** 약 15분 (2026-10-25)
- **Tasks:** 3 (Task 1 트레이서 TDD, Task 2·3 TDD)
- **Files:** 소스 4개(DayScene·NightPanel·night.css·assets.ts) + 테스트 2개 (+607 −22)

## Accomplishments

- **밤 대상 선택(Task 1):** 행위자(살아 있는 마피아·경찰·의사)의 화면에서 살아 있는 캐릭터가 `onPick` 버튼이 된다(동사 조사·보호·지목). 누르면 `{ t: "pick", target }` 을 한 번 보내고, `pending { view, target }` 으로 링(`.mf-dt__sel`)·표적 배지(`--me`)·`aria-pressed`·알약 `선택 ●이름`(자신은 `나`)이 즉시 바뀐다. 같은 대상 재탭은 보내지 않는다. 새 view 객체가 오면 pending 을 버리고 `me.pick` 을 따른다(T-03-27).
- **밤 배경·헤더:** `Backdrop variant` 가 night 면 `night`(즉시 교체, 연출 없음), 제목 `밤`, 안내 `N일차`(살아 있는 마피아 `N일차 · 함께 지목하세요`). `.mf-dt` 루트는 낮 토론 → 밤에서 같은 DOM 노드다(C5). 밤·아침의 이름표 아랫줄은 그날 낮의 주장을 유지한다(C6).
- **역할별 하단(Task 2):** 마피아는 `MessageLog`(로그 `마피아 채팅`, 첫 줄 `마피아끼리만 보여요`)+`DiscussionControls`(templates `NIGHT_TEMPLATE_ORDER`), 경찰·의사는 `NightPanel`+`PickPill`, 그 밖의 생존자는 `NightPanel`+`NoticePill`(시민 안내). 마피아 화면은 자신·동료가 눌리지 않는 이전 마크업이고 `allyPicks` 가 `--ally` 배지가 된다. 이모티콘 live 줄은 `CHAT_PHASES` 로 넓혔다.
- **오류·끊김:** `canSend` false 면 `pickDisabled`. 하단이 NightPanel 일 때만 장면이 error 를 구독해 BAD_MESSAGE 에 토스트를 띄운다(WRONG_PHASE 는 표시 없음).
- **탈락 표시:** 모든 화면에서 탈락자는 `dead` 입력(유령 그림·회색 이름표)과 `{ kind: "dead" }` 아랫줄 `탈락` 뿐이다.
- **관전 화면(Task 3):** `meDead && view.spectate` 에서만 입력을 만든다 — 내 자리 `탈락`, 다른 자리 `{ kind: "real", job }`, 마피아인 다른 자리에 링·마름모(`allyMarkLabel="마피아"`), 밤이면 `spectatorPicks`. 하단은 밤 `마피아 채팅(관전)`(첫 줄 `관전 중 · 마피아 채팅`, `more={false}`)+`ReadOnlyRow`, 낮 세 단계는 기본 `최근 채팅`+`ReadOnlyRow`(직업 공개 칩 줄 없음).
- **미리 받기:** `rolePreloadList` = 직업 그림 4 + 낮 배경 + 밤 배경 + 유령 그림 = 7. 어떤 역할이든 같은 목록이다.
- 전체: `npx vitest run` 60 파일·1254 통과(03-07 이후 +42), `npm run typecheck`·`npm run build` 통과. night.css 코드 줄에 hex 가 0개다.

## TDD

### RED

- Task 1: `nightScene.test.tsx` "밤 — 경찰 (N-3)"·"night.css". 목표 테스트 "살아 있는 다섯 자리 모두(나 포함)가 대상 버튼이다" 가 `expected +0 to be 5` 로 실패(8건 모두 실패). `gsd check tdd-red-evidence` → RED_EVIDENCE_OK. **semanticAssessment:** 대상이 실행되어 버튼 수 단언에서 실패했다(onPick 미구현). 같은 RED 에서 밤 배경·제목·알약·pick 전송·CSS 규칙 단언도 각자의 단언으로 실패했고 import·문법·fixture 오류가 아니다. 테스트 파일은 DayScene 만 import 하므로(NightPanel 은 아직 없음) 로드 실패가 아니다.
- Task 2: "밤 — 마피아"·"의사·시민"·"오류·끊김·탈락 표시". 목표 "안내 '1일차 · 함께 지목하세요'…" 가 `expected '1일차' to be '1일차 · 함께 지목하세요'` 로 실패(18건 중 7건 실패). RED_EVIDENCE_OK. **semanticAssessment:** 마피아 헤더 미구현이 정확히 계획한 단언에서 실패했다. 나머지 실패(로그 '마피아 채팅' 없음, 시민 제목 없음, 토스트 없음, 유령 그림 아님)도 단언 실패이고, 이미 Task 1 에서 되는 의사 자기 보호·끊김 disabled 테스트는 RED 에서 통과한다(Task 1 범위를 고정하는 테스트, 정상).
- Task 3: "관전 (N-6, 결정 0021)"·assets 미리 받기. 목표 "밤: 내 자리 유령 + '탈락', 다른 자리 아랫줄 실제 직업…" 가 `expected '탈락|시민|시민|시민|시민' to be '탈락|마피아|시민|경찰|의사'` 로 실패(34건 중 8건 실패). RED_EVIDENCE_OK. **semanticAssessment:** real 줄 미구현으로 평소 주장 줄이 나와 단언에서 실패했다. assets 두 테스트는 길이 5 vs 7·밤 배경 없음으로 실패했다. '살아 있는 경찰 화면에 관전 클래스가 없다' 가드는 RED 에서도 통과한다(유지용, 정상).

### GREEN

각 태스크의 최소 구현으로 통과. 트레이서 게이트: 자동 검사뿐인 `<verify>` 라 `npx vitest run test/client/nightScene.test.tsx test/client/dayScene.test.tsx test/client/discussion.test.tsx`(59건)·`npm run typecheck` 를 다시 돌려 통과를 확인하고 확장 태스크로 넘어갔다 — Tracer verified end-to-end.

### REFACTOR

없음.

### Commits

- b6afc99 test(03-08): police night scene
- fddcc8c feat(03-08): police night scene with direct target taps
- e66db69 test(03-08): mafia, doctor and citizen night scenes
- d1d7831 feat(03-08): role-specific night scenes
- 7e205ac test(03-08): spectator scene and ghost preload
- b84af9b feat(03-08): spectator scene for eliminated players and night preload

`commits: 6` 은 `git rev-list --count ${plan_head_before}..HEAD` 로 측정한 값이다.

## TDD Gate Compliance

세 태스크 모두 `test(03-08)` 커밋이 해당 `feat(03-08)` 커밋보다 먼저다(위 순서). 각 RED 는 `gsd_run check tdd-red-evidence` 로 RED_EVIDENCE_OK 를 받은 뒤 커밋했고, 실패 보고서는 한 줄 단언(문자열·불리언)이라 tap-flat 이 깨지지 않았다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Task 3 RED 테스트의 'mf-ro' 부분 문자열 오탐**
- **Found during:** Task 3 RED 실행
- **Issue:** '살아 있는 경찰 화면에 관전 클래스가 없다' 가드가 `innerHTML.includes("mf-ro")` 로 검사해 `class="mf-root …"` 에 걸려 처음부터 실패했다(관전 노드가 없는데도).
- **Fix:** 클래스 이름 부분 문자열 대신 `container.querySelector(".mf-ro")` 등 선택자로 검사하도록 고친 뒤 RED 를 다시 돌려 RED_EVIDENCE_OK 를 확인하고 커밋했다(RED 커밋 전이라 amend 없음).
- **Files modified:** test/client/nightScene.test.tsx
- **Commit:** 7e205ac

**2. [Rule 1 - Bug] assets 테스트의 두 곳이 길이 5 를 하드코딩**
- **Found during:** Task 3 RED 작성
- **Issue:** `toHaveLength(5)` 와 `preload` 호출 횟수 `toHaveBeenCalledTimes(5)` 두 곳이 목록 길이를 하드코딩했다(계획은 앞의 한 곳만 적었다).
- **Fix:** 둘 다 7 로 고치고 RED 커밋에 함께 넣었다. 유령 import 를 추가했다.
- **Files modified:** test/unit/assets.test.ts
- **Commit:** 7e205ac

그 밖의 세부 선택(편차 아님)은 key-decisions 에 적었다.

## Issues Encountered

없음.

## Known Stubs

없음. 아침 단계의 제목·하단·카드는 03-10 이 채운다(이 계획의 범위 밖이며 관전 하단도 morning 에서는 그리지 않는다). `NIGHT_PANEL_TEXT.morning` 문구만 표에 미리 두었다.

## Threat Flags

없음. 새 네트워크 입구·인증 경로·신뢰 경계 변화가 없다. 계획의 T-03-26(장면이 남의 역할을 추측해 그리지 않음: 실제 직업 줄·관전 배지·마피아 링은 `meDead && view.spectate` 한 곳에서만 만들고, 살아 있는 경찰 화면 DOM 에 `--real`·`--police`·`--doctor`·`.mf-ro` 가 없으며 마피아·시민 하단에 역할 이름이 없음을 테스트함)·T-03-27(낙관적 선택은 그 view 에서만 살고 새 view 가 오면 `me.pick` 을 따름)·T-03-SC(새 패키지 없음)를 지켰다.

## Self-Check: PASSED

- 파일: src/components/NightPanel.tsx, src/styles/night.css, test/client/nightScene.test.tsx, 이 SUMMARY 존재 확인(수정 파일 DayScene·assets.ts·assets.test.ts 포함)
- 커밋: b6afc99, fddcc8c, e66db69, d1d7831, 7e205ac, b84af9b 모두 HEAD 의 조상
- 인수 기준: `t: "pick"` 1·`조사할 사람을 고르세요` 1·night.css hex 0·`NIGHT_TEMPLATE_ORDER` 2·`allyPicks` 3·`마피아끼리만 보여요`(NightPanel) 1·`spectate` 8·`관전 중 · 마피아 채팅` 1·`<ReadOnlyRow` 1·`backdropUrl("game", "night")|ghostSrc()` 3 모두 통과
- 각 태스크의 `test(03-08)` 커밋이 해당 `feat(03-08)` 커밋보다 앞
- 전체 검증: `npx vitest run` 1254 통과, `npm run typecheck`, `npm run build` 통과

## Next Phase Readiness

03-09(전수 누출 검사)가 서버 쪽을, 03-10(아침 카드·타이머 calm·아침 하단)이 DayScene 의 morning 분기를, 03-11([수사 기록])이 위쪽 바 extra 슬롯을 이어 받는다. 360폰·8명판 겹침·안내 줄 수(C8~C10)는 03-12 배포본에서 사람이 본다.
