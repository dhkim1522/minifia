---
phase: 03-night-morning
plan: 01
subsystem: game-core
tags: [tracer, tdd, tick, phase-table, wire-contract, night, morning, room-screen]
status: complete

requires:
  - phase: 02-day-discussion
    provides: PHASE_DEFS 단계 표, tick 의 ON_ENTER 진입 훅 표, DayScene, isAlive, Player.alive(optional)
provides:
  - NIGHT_MS 30000·MORNING_MS 5000 과 night·morning 행, discussion.next = night (shared/game/phases.ts)
  - RandInt 타입과 tick(state, now, randInt = NO_RANDOM), 훅 표 시그니처 (s, randInt) (shared/game/tick.ts)
  - 3페이즈 와이어 계약 한 번에 확정 — PhaseId += night·morning, MORNING_PHRASE_COUNT 8, InvestigationRecord, MorningView, DayView.morning, PublicPlayer.alive, MyInfo.pick·allyPicks·records, SpectateSeat·SpectatePicks·SpectateView·RoomView.spectate, ClientMessage 의 pick (shared/protocol.ts)
  - 밤 상태 필드(타입만) Player.nightPick·investigations, RoomState.morning·lastPhrase·nextNightSeq (shared/game/room.ts)
  - 방 DO 가 tick 에 cryptoRandInt 를 넘김 (worker/room.ts)
  - RoomScreen 의 night·morning 라우팅(같은 장면 키 dayScene), 밤 단계 안내 문구, 모르는 단계 폴백 '연결 중…'
affects: [03-02, 03-03, 03-04, 03-05, 03-06, 03-07, 03-08, 03-09, 03-10, 03-11, 03-12]

tech-stack:
  added: []
  patterns:
    - "난수는 tick 의 세 번째 인자로만 받는다. 기본값 NO_RANDOM 은 불리면 즉시 Error 를 던져 조용히 틀린 판정을 막는다(RESEARCH Pattern 1)"
    - "새 단계는 단계 표에 행을 더하는 방식으로만 늘린다. 밤·아침은 진입 훅이 없고 시간으로만 넘어간다(훅은 03-03 이 같은 ON_ENTER 표에 더한다)"
    - "화면은 PHASE_ANNOUNCE[...]?.(view) ?? '' 와 renderPhase default 로 모르는 단계를 견딘다(옛 번들 폴백)"

key-files:
  created: []
  modified:
    - shared/protocol.ts
    - shared/game/phases.ts
    - shared/game/tick.ts
    - shared/game/room.ts
    - worker/room.ts
    - src/screens/RoomScreen.tsx
    - test/unit/tick.test.ts
    - test/unit/view.test.ts
    - test/worker/alarm.test.ts
    - test/worker/day.test.ts
    - test/client/phaseScreens.test.tsx

key-decisions:
  - "루프 순서는 discussion → night(30초) → morning(5초) → dayAnnounce 다. 밤·아침은 일차를 올리지 않고 일차는 dayAnnounce 진입 훅에서만 1 오른다"
  - "tick 의 randInt 기본값 NO_RANDOM 은 불리면 Error('tick: randInt is required to resolve the night') 를 던진다. 방 DO 는 cryptoRandInt 를 넘긴다"
  - "MORNING_PHRASE_COUNT = 8 은 와이어 상수로 shared/protocol.ts 에 둔다(서버 문구 추첨과 화면 문장 표가 같은 값을 읽는다)"
  - "관전 타입의 직업 키는 role 이 아니라 job 이다(누출 테스트의 role 키 불변식)"
  - "밤 마피아 채팅 줄 번호는 낮 nextMessageSeq 와 분리한 RoomState.nextNightSeq 로 센다(낮 seq 간격으로 밤 메시지 수를 알 수 없게)"

requirements-completed: [NIGHT-05, NIGHT-06]

duration: 약 10분
completed: 2026-10-25

coverage:
  - id: C1
    description: "서버 순수 진행이 낮 토론 → 밤 30초 → 아침 5초 → 다음 낮 발표로 돌고, 새 마감은 이전 마감 + 다음 단계 길이이며 밤·아침은 일차를 올리지 않는다(늦은 알람이 한 바퀴를 따라잡아도 일차는 한 번만 오른다)"
    requirement: "NIGHT-05, NIGHT-06"
    verification:
      - kind: unit
        ref: "test/unit/tick.test.ts#tick (순수 단계 진행)"
        status: pass
      - kind: unit
        ref: "test/unit/tick.test.ts#PHASE_DEFS (단계 표, D-01·D-02·D-19·D-20, NIGHT-05·NIGHT-06)"
        status: pass
    human_judgment: false
  - id: C2
    description: "workerd 알람이 discussion → night(30000) → morning(5000) → dayAnnounce(2000) 마감을 모든 소켓에 같은 값으로 보내고 저장된 일차는 2 가 된다. 방장이 끊겨도 서버 타이머대로 넘어간다"
    requirement: "NIGHT-05, NIGHT-06"
    verification:
      - kind: unit
        ref: "test/worker/alarm.test.ts#낮 한 바퀴와 밤·아침"
        status: pass
      - kind: unit
        ref: "test/worker/day.test.ts#방장이 끊겨 있어도 낮 토론·밤·아침은 서버 타이머대로 다음 낮(dayAnnounce)으로 넘어간다"
        status: pass
    human_judgment: false
  - id: C3
    description: "3페이즈 와이어 계약 타입이 한 파일에 있고 앱·워커 두 tsconfig 의 타입 검사를 통과한다(값 채우기는 03-03·03-05)"
    requirement: "NIGHT-05, NIGHT-06"
    verification:
      - kind: command
        ref: "npm run typecheck"
        status: pass
    human_judgment: false
  - id: C4
    description: "방 화면이 night·morning 을 낮 장면과 같은 래퍼·테이블 노드로 그리고, 밤 안내가 역할·생존에 맞게 읽히며, 모르는 단계 view 로도 '연결 중…' 을 그린다"
    requirement: "NIGHT-05"
    verification:
      - kind: unit
        ref: "test/client/phaseScreens.test.tsx#밤·아침 라우팅과 안내 (UI-SPEC C5·접근성, RESEARCH A6)"
        status: pass
    human_judgment: false
  - id: C5
    description: "밤·아침 화면의 실제 모습(밤 화면은 아직 낮 장면의 제목을 쓴다)과 실기기 체감은 이 계획에서 판단하지 않는다 — 03-08·03-10 이 화면을 만들고 03-12 가 배포본을 확인한다"
    requirement: "NIGHT-05, NIGHT-06"
    human_judgment: true
    rationale: "이 계획은 루프·계약·라우팅까지다. 화면 내용은 범위 밖이라 자동 검증이 없다"

actuals:
  tokens: 9000
  tasks: 3
  commits: 6
plan_head_before: 8976f4eb3e81ce8da9f79fdbc1e32c58866752d6
plan_head_after: 82ffa0dd5445c5f2d0a7aa04ed540ce175efeaba
---

# Phase 3 Plan 01: 밤·아침 루프 트레이서 Summary

**서버 단계 표에 밤 30초·아침 5초를 넣어 낮 토론 → 밤 → 아침 → 다음 낮 루프를 순수 tick·워커 알람·방 화면 라우팅까지 한 줄로 잇고, 난수 주입(RandInt, NO_RANDOM 기본값)과 3페이즈 와이어 타입을 확정했다.**

## Performance

- **Duration:** 약 10분 (2026-10-25)
- **Tasks:** 3 (Task 1 트레이서 TDD, Task 2 회귀 이전, Task 3 화면 TDD)
- **Files:** 소스·테스트 11개 변경 (+263 −53)

## Accomplishments

- 단계 표가 아홉 개가 되었다. `discussion → night(30000) → morning(5000) → dayAnnounce` 이고, 새 마감은 이전 마감 + 다음 단계 길이라 모든 폰이 같은 마감을 받는다. 일차는 dayAnnounce 진입 훅에서만 오른다.
- `tick(state, now, randInt = NO_RANDOM)` — 난수는 세 번째 인자로만 들어오고, 방 DO 는 `cryptoRandInt` 를 넘긴다. 지금 표에는 난수를 쓰는 훅이 없어 한 번도 불리지 않는다(테스트로 고정).
- `shared/protocol.ts` 에 3페이즈 계약 타입을 한 번에 정했다(`pick` 메시지, `alive`, `me.pick/allyPicks/records`, `day.morning`, `spectate`, `MORNING_PHRASE_COUNT`). 관전 직업 키는 `job` 이다.
- `shared/game/room.ts` 에 밤 상태 필드 5개를 optional 로 선언했다(쓰는 코드는 03-03·03-04).
- RoomScreen 이 night·morning 을 `dayScene` 키로 DayScene 에 그린다. 낮 토론 → 밤 → 아침 사이에 래퍼·테이블이 다시 마운트되지 않는다. 밤 안내는 "{N}일차 밤. " 뒤에 마피아 `함께 지목하세요`·경찰 `조사할 사람을 고르세요`·의사 `지킬 사람을 고르세요`·시민 `밤이 되었어요`·탈락자 `탈락했어요, 관전 중`.
- 모르는 단계 이름의 view 는 `renderPhase` default 에서 '연결 중…' 을 그리고 안내 영역은 빈 문자열이다.
- 전체 회귀: `npx vitest run` 56 파일·1060 테스트 통과(기준선 1052 → 새 테스트 8개 추가), `npm run typecheck`·`npm run build` 통과.

## Task Commits

| Task | 커밋 | 내용 |
|------|------|------|
| 1 RED | `f9c8781` test(03-01) | 단계 표 아홉 개, 밤·아침 전이, 한 바퀴 따라잡기, randInt 불호출 계약 |
| 1 GREEN | `9455e73` feat(03-01) | phases·tick·protocol·RoomScreen 빈 항목 |
| 2 | `aa46c1c` test(03-01) | view·alarm·day 회귀를 새 루프로 이전 |
| 2 | `961357d` feat(03-01) | worker/room.ts 가 cryptoRandInt 를 넘김, room.ts 밤 상태 필드 타입 |
| 3 RED | `84c3d1a` test(03-01) | 방 화면 night·morning 라우팅·안내·폴백 |
| 3 GREEN | `82ffa0d` feat(03-01) | RoomScreen 라우팅·안내·default 폴백 |

`commits: 6` 은 `git rev-list --count ${plan_head_before}..HEAD` 로 측정한 값이다(HANDOFF 커밋 전).

## TDD Gate Compliance

| Task | RED | GREEN | 증거 |
|------|-----|-------|------|
| 1 | `f9c8781` test(03-01) | `9455e73` feat(03-01) | `gsd-tools check tdd-red-evidence` → `RED_EVIDENCE_OK`(tap-flat, 대상 "토론 마감(T)에 밤으로 넘어가 마감 T+30000…", 23건 중 7건 실패) |
| 3 | `84c3d1a` test(03-01) | `82ffa0d` feat(03-01) | `RED_EVIDENCE_OK`(tap-flat, 대상 "night view, 마피아(allies [2]) 생존 → 안내 '1일차 밤. 함께 지목하세요'", 새 묶음 5건 모두 실패) |

semanticAssessment (Task 1): 대상 테스트가 실제로 실행되어 `expected 'dayAnnounce' to be 'night'` 단언에서 실패했다. 같은 RED 에서 "단계는 아홉 개다"(`7:… ≠ 9:…`)·행 표(`90000/dayAnnounce/true ≠ 90000/night/true`)·밤 전이·한 바퀴 따라잡기·세 낮 훅 순서 단언이 실패했다. import·로드 오류가 아니다(vitest 는 타입을 검사하지 않아 아직 없는 `NIGHT_MS` 는 undefined 로 읽히고 값 비교에서 실패한다). 새로 쓴 "세 번째 인자 randInt 를 부르지 않는다" 테스트는 계약을 고정하는 테스트라 RED 에서도 통과했다(구현이 인자를 아예 무시하므로 정상, 03-03 이 아침 훅을 더할 때 이 계약이 깨지는지 지킨다).

semanticAssessment (Task 3): 새 묶음 5건이 실제로 실행되어 계획된 단언에서 실패했다 — 안내 영역이 빈 문자열(`expected '' to be '1일차 밤. 함께 지목하세요'`), 래퍼가 night 에서 새 노드(`night 래퍼 유지: expected false to be true`), 모르는 단계에서 `PHASE_ANNOUNCE[view.phase] is not a function`. 모든 GREEN 앞에 RED 커밋이 있다(`git log` 로 확인). Task 2 는 plan 에 `tdd` 가 아닌 회귀 이전(test 커밋 뒤 feat 커밋)으로 적혀 있어 RED 증거 대상이 아니다.

트레이서 게이트: auto 모드가 아니고 `human_verify_mode` 가 end-of-phase 이며 Task 1 의 `<verify>` 가 자동 검사뿐이라 `npx vitest run test/unit/tick.test.ts`(23건 통과)·`npm run typecheck` 를 다시 돌려 통과를 확인하고 확장 태스크로 넘어갔다 — Tracer verified end-to-end.

## Deviations from Plan

None - plan executed exactly as written.

세부 선택(편차 아님): (1) `PhaseId` 한 줄 유니온을 계획의 인수 기준 정규식(`"night" | "morning"` 한 줄)이 읽히도록 마지막 줄에 `| "night" | "morning"` 이 붙게 나눠 썼다. (2) Task 2 의 커밋은 계획이 허용한 대로 test(회귀 이전)와 feat(worker 한 줄 + 상태 필드 타입) 둘로 나눴다.

## Issues Encountered

없음. 작업 중 임시 파일 하나(`/tmp/null`)를 잘못 만들어 즉시 지웠다(저장소 영향 없음).

## Known Stubs

- `src/screens/RoomScreen.tsx` `PHASE_ANNOUNCE.morning` 은 빈 문자열이다 — 의도된 상태다(계획의 Claude 재량 결정). 03-10 이 아침 카드 제목까지 붙인다.
- 밤·아침 화면은 아직 낮 장면의 제목('낮 · 직업 공개')을 쓴다 — 의도된 상태이며 03-08(밤 화면)·03-10(아침 카드)이 바꾼다.
- 4페이즈 전까지 승패가 없어 판이 끝나지 않는다 — 의도된 상태(RESEARCH Pitfall 9).

## Threat Flags

없음. 새 네트워크 입구·인증 경로·신뢰 경계 변화가 없다(계획의 T-03-01~03 완화는 모두 적용: 마감 연쇄·두 번 호출 동일 테스트, cryptoRandInt 배선, 모르는 단계 폴백).

## Self-Check: PASSED

- 수정 파일 11개 존재 확인, 커밋 6개(`f9c8781`, `9455e73`, `aa46c1c`, `961357d`, `84c3d1a`, `82ffa0d`) 모두 HEAD 의 조상임을 확인
- 계획 인수 기준 전부 통과(`grep` 계열 모두 기준 이상, `git log` 의 test 커밋이 해당 feat 커밋보다 앞)
- 전체 검증: `npx vitest run` 1060 통과, `npm run typecheck`, `npm run build` 통과

## Next Phase Readiness

03-02 이후 계획이 같은 단계 이름·와이어 타입을 그대로 쓸 수 있다. 03-03 은 night·morning 진입 훅을 같은 ON_ENTER 표에 더하고, 03-05 가 view 에 값을 채운다. HANDOFF.md 갱신과 push 는 이 SUMMARY 뒤에 처리한다.
