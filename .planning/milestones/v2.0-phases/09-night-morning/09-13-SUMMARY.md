---
phase: 09-night-morning
plan: "13"
subsystem: night-mafia-screen
tags: [mafia, approach, night-tally, sure-stamp, hot-line, tdd, tracer]
status: complete

requires:
  - phase: 09-night-morning
    provides: canMoveIn(phase, alive, isMafia) (09-03), approachPoint·APPROACH_DIST_FX (09-04), nightTally·nightSure (09-07), RingKind mafiaAlly (09-10)
provides:
  - 밤 산 마피아 이름표 버튼 "{닉네임} 님에게 다가가기" — pick 뒤 approachPoint(대상, 나, 80) 목적지 move
  - 밤 걷기 권한 canMoveIn(view.phase, meAlive, view.me.role === "mafia") — 산 마피아만
  - 발밑 고리 mafia(내 선택) / mafiaAlly(동료만 고른 좌석)
  - 선택 수 배지(nightTally n≥1)와 "확정" 도장(nightSure) — SureStamp.label, HeadStack.sureLabel
  - DAY_COPY.nightHintMafia("대상에게 다가가요"), DAY_COPY.sureLine(name), DayLine.scope·icon
  - 확정이 새로 서면 마피아 채널 hot 줄 "{이름} · 확정" (useDayFx 가 scope·icon 을 addSystem 에 넘김)
affects: [09-15, 09-16, 09-17, 09-19]

actuals:
  tokens: 6800
  tasks: 3
  commits: 6
plan_head_before: 0d2f859b46863197f0369eb0ef89575d9d562d70
plan_head_after: 85a0e2162f8d0b777cd9a104622e8b8053a645b3

tech-stack:
  added: []
  patterns:
    - "배지·도장·고리는 서버가 이 사람에게 보낸 값(me.pick·allyPicks·nightTally·nightSure)에서만 만들고, 마피아 분기(nightMafia) 안에서만 읽는다"
    - "다가가기 목적지는 화면이 store.segOf + positionAtFx(고정소수점)로 계산해 일반 move 로 보낸다. 위치를 모르면 pick 만 나간다"
    - "확정 hot 줄은 직전 view 와 me.nightSure 가 다를 때만 dayEvents 가 만든다. 첫 스냅샷(reset)은 줄 없음"

key-files:
  created: []
  modified:
    - src/screens/GameMap.tsx
    - src/components/v2/HeadStack.tsx
    - src/components/v2/SureStamp.tsx
    - src/game/dayView.ts
    - src/net/useDayFx.ts
    - test/client/nightMap.test.tsx
    - test/client/v2parts.test.tsx
    - test/client/guide.test.tsx
    - test/unit/dayView.test.ts

key-decisions:
  - "다가가기 목적지는 store.positionOf(월드 단위)가 아니라 shared positionAtFx(고정소수점 정수)를 직접 쓴다 — move 메시지와 approachPoint 가 모두 고정소수점이라 UNIT 배 반올림 변환이 필요 없다"
  - "확정 hot 줄의 target 아이콘은 줄에 실어 두지만 ChatPanel 은 hot 줄에 아이콘을 그리지 않는다(승인 원본 규칙, chatPanel.test 가 못 박음). 아이콘 표시는 건드리지 않았다"

requirements-completed: [NIGHT-07, NIGHT-08]

coverage:
  - id: D1
    description: "산 마피아가 이름표를 누르면 pick 과 대상 옆 move 가 나가고 내 선택이 옮겨 간다. 같은 사람 재선택은 무전송"
    requirement: NIGHT-08
    verification:
      - kind: automated_ui
        ref: "test/client/nightMap.test.tsx#밤 마피아 — 다가가기"
        status: pass
  - id: D2
    description: "밤에 산 마피아만 바닥을 눌러 걷는다 (시민·경찰·의사 불가)"
    requirement: NIGHT-07
    verification:
      - kind: automated_ui
        ref: "test/client/nightMap.test.tsx#산 마피아는 밤에 바닥을 눌러 걷는다"
        status: pass
  - id: D3
    description: "서버 집계 배지와 '확정' 도장, 마피아 분기에서만 읽음, 진홍 클래스 없음"
    requirement: NIGHT-08
    verification:
      - kind: automated_ui
        ref: "test/client/nightMap.test.tsx#밤 마피아 — 선택 수 배지·'확정' 도장"
        status: pass
      - kind: unit
        ref: "test/client/v2parts.test.tsx#SureStamp 는 label"
        status: pass
  - id: D4
    description: "헤더 안내 '대상에게 다가가요'와 확정 hot 줄 '{이름} · 확정'"
    requirement: NIGHT-08
    verification:
      - kind: unit
        ref: "test/unit/dayView.test.ts#dayEvents — 마피아 확정 hot 줄"
        status: pass
      - kind: automated_ui
        ref: "test/client/nightMap.test.tsx#마피아 확정이 새로 서면 마피아 채팅에 hot 줄"
        status: pass
---

# Phase 09 Plan 13: 밤 마피아 화면 Summary

산 마피아가 이름표를 눌러 대상을 고르고 그 옆으로 걸어가며, 서버 집계로 선택 수 배지와 "확정" 도장을 보고, 확정이 서면 마피아 채팅에 한 줄이 남는 밤 화면.

## Accomplishments

- **Task 1 (트레이서)**: 8페이즈 임시 틀의 "지목" 을 "님에게 다가가기" 로 바꿨다. 누르면 `pick` 뒤에 `approachPoint(대상, 나, 80)` 목적지로 `move` 가 나간다. 밤 걷기는 `canMoveIn(..., isMafia)` 로 산 마피아만. 고리는 내 선택 `mafia`, 동료만 고른 좌석 `mafiaAlly`.
- **Task 2**: `SureStamp.label`(기본 "유력"), `HeadStack.sureLabel` 추가. 마피아 분기에서만 `me.nightTally` 의 n≥1 은 배지, `me.nightSure` 는 "확정" 도장(배지 대신).
- **Task 3**: 밤 마피아 헤더 안내 `nightHintMafia` = "대상에게 다가가요"(옛 `mafiaNightHint` 삭제). `dayEvents` 가 `me.nightSure` 변화에서 `{kind:"hot", scope:"mafia", icon:"target"}` 줄을 만들고 `useDayFx` 가 scope·icon 을 `addSystem` 에 넘긴다.

## Task Commits

| Task | 구분 | 커밋 |
| --- | --- | --- |
| 1 | RED | abfb0e4 |
| 1 | GREEN | 7e36483 |
| 2 | RED | 03e35dd |
| 2 | GREEN | 043ffdc |
| 3 | RED | 06e42f8 |
| 3 | GREEN | 85a0e21 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - 차단 해소] 정적 가드가 GameMap.tsx 의 "crimson" 글자를 막음**
- **Found during:** Task 3 전체 client 실행
- **Issue:** `nominationScreen.test` 가 GameMap.tsx 소스에 `crimson` 이 없는지 본다. 고리 주석에 `crimson-500/400` 을 적어서 실패.
- **Fix:** 주석을 `mafia`/`mafiaAlly` 이름으로 바꿈
- **Files modified:** src/screens/GameMap.tsx
- **Commit:** 85a0e21

**2. [계획과 다른 점] hot 줄 아이콘은 실리지만 그려지지 않음**
- UI-SPEC 330행은 "target 아이콘" 이라 했지만 ChatPanel 은 hot 줄에 아이콘을 그리지 않는다(승인 원본 규칙, `chatPanel.test` 가 icon 을 줘도 요소가 없다고 못 박음). ChatPanel 을 고치려다 되돌렸다. 줄에는 `icon: "target"` 이 실려 있어 나중에 규칙을 바꾸면 바로 보인다.

## Known Stubs

없음.

## Threat Flags

없음. 새 서버 경로가 없다. 다가가기 목적지는 일반 move 이고 서버 applyMove 가 검사한다(T-09-30, accept). 마피아 안내·확정 줄은 마피아 분기에서만 만들고 다른 신분 DOM 에 없음을 시험으로 확인했다(T-09-29).

## Verification

- `npm run typecheck` 통과
- `npx vitest run --project unit` 74 파일 2187 통과
- `npx vitest run --project client` 44 파일 1431 통과, 6 skip(09-15 가 지울 경찰·의사 임시 틀 시험)
- 인수 기준 중 `.skip(` 0건 검사는 09-15 가 nightMap skip 6건을 지우기 전까지 rc=1 이 정상(이월 메모).

## Known Limits

- A1(E2 #14): 따라가기 카메라에서 스테이지 밖으로 나간 이름표는 누를 수 없다 — 바닥을 눌러 걷는 것으로 대신한다.
- A4(E10 #46): WebGL 불가 기기의 마피아는 이동·선택을 못 한다.
- 경찰·의사의 `PICK_VERB` 줄과 지도 이름표 선택(임시 틀)은 09-15 가 얼굴 목록으로 바꾼다.

## Self-Check: PASSED

- 수정 파일 9개 존재 확인, 커밋 6개 모두 HEAD 의 조상임.
