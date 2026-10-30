---
phase: 03-night-morning
plan: 11
subsystem: client-police-records
tags: [tdd, tracer, police, records, notebook, new-pill, toast, phone-memory, design-refs]
status: complete

requires:
  - phase: 03-night-morning/03-02
    provides: Icon notebook
  - phase: 03-night-morning/03-05
    provides: 경찰 본인 view 에만 me.records { n, target, isMafia }[] (n 오름차순, 탈락 뒤에도)
  - phase: 03-night-morning/03-10
    provides: DayScene 아침 분기, 머리말 extra 슬롯(myRoleButton), night.css 의 .mf-dayscene position: relative
provides:
  - "본 기록 개수 폰 메모리 — RECORDS_SEEN_PREFIX·loadSeenCount·saveSeenCount·unseenCount (src/net/recordsSeen.ts)"
  - "RecordsButton(수첩 아이콘 + '수사 기록' + 새 기록 점) · RecordsSheet('마피아 수사 기록' 4열 줄·NEW·빈 상태) (src/components/RecordsSheet.tsx)"
  - "RecordsToast — 밤 끝 '수사 기록이 추가됐어요' 2초 알림 (src/components/RecordsToast.tsx)"
  - "src/styles/records.css — 시안 f6/f7·v2 값을 토큰으로 옮긴 버튼 점·목록 격자·알림"
  - "RoomScreen 경찰 머리말 슬롯과 시트 열림·NEW 상태, DayScene 알림, 머리말 버튼 간격(phase.css)"
affects: [03-12]

tech-stack:
  added: []
  patterns:
    - "[내 역할] 시트와 같이 [수사 기록] 시트의 열림·NEW 를 RoomScreen 이 쥔다 — 단계가 바뀌어도 열린 채"
    - "기록 내용은 서버 view 에서만 받고 폰에는 본 개수 숫자 하나만 둔다. 저장값은 0 이상 정수 문자열이 아니면 0"
    - "알림은 같은 epoch 에서 길이가 늘 때만 — 직전 { epoch, len } 을 ref 에 기억하고 효과에서 비교한다(첫 마운트·재접속은 알리지 않음)"
    - "경찰이 아닌 역할의 화면에는 [수사 기록] 노드 자체가 없다(headerExtra 가 myRoleButton 그대로)"

key-files:
  created:
    - src/net/recordsSeen.ts
    - src/components/RecordsSheet.tsx
    - src/components/RecordsToast.tsx
    - src/styles/records.css
    - test/client/records.test.tsx
    - test/unit/recordsSeen.test.ts
  modified:
    - src/screens/RoomScreen.tsx
    - src/screens/DayScene.tsx
    - src/styles/phase.css
    - HANDOFF.md

key-decisions:
  - "버튼과 시트는 한 파일(RecordsSheet.tsx), 알림은 장면(DayScene)에 둔다 — 계획의 재량 결정 그대로. 시트 높이는 기존 .mf-sheet--chat 을 재사용해 새 높이 규칙을 만들지 않았다"
  - "열린 채 새 기록이 오는 순간은 RoomScreen 효과(recordsOpen && len > seen)로 처리: NEW 를 새 맨 위 줄로 옮기고 seen 을 새 길이로 저장한다. 그래서 점은 켜지지 않는다"
  - "recordsSeen 의 저장 실패 대체 메모리는 저장 성공 시 해당 키를 지운다 — 저장소가 나중에 비워져도 옛 메모리 값이 되살아나지 않는다"
  - "lobby·assigning 초기화에 seen 0 저장을 더해, 같은 방 코드로 새 판이 열려도 옛 본 개수가 남지 않는다(가정 A4)"

requirements-completed: []   # NIGHT-02 는 03-12(배포본 확인)도 선언해 requirements.ready-ids 가 blocked 로 답했다 — 마지막 선언 계획이 끝날 때 체크한다

coverage:
  - id: C1
    description: "경찰(탈락한 경찰 포함)에게만 위쪽 바 [내 역할] 왼쪽에 [수사 기록] 버튼이 낮 시작 발표·직업 공개·토론·밤·아침 모든 단계에 있고, 시민·마피아·의사 화면에는 그 노드가 없다"
    requirement: "NIGHT-02"
    verification:
      - kind: unit
        ref: "test/client/records.test.tsx#[수사 기록] 버튼과 새 기록 점 (03-11)"
        status: pass
    human_judgment: false
  - id: C2
    description: "버튼을 누르면 '마피아 수사 기록' 시트가 최신 위 4열 줄('{N}일차 밤 · ●이름 · 마피아|마피아 아님')로 열리고, 마피아는 진홍 굵게·마피아 아님은 흰색 보통, 비면 '아직 조사한 사람이 없어요'"
    requirement: "NIGHT-02"
    verification:
      - kind: unit
        ref: "test/client/records.test.tsx#[수사 기록] 버튼과 새 기록 점 (03-11)"
        status: pass
      - kind: unit
        ref: "test/client/records.test.tsx#records.css (03-11)"
        status: pass
    human_judgment: false
  - id: C3
    description: "열어 보지 않은 기록이 있으면 버튼 점과 이름 '수사 기록, 새 기록', 시트를 열면 꺼진다. 본 개수는 minifia:records:{방코드} 숫자 하나로 재접속 뒤에도 유지되고 대기실·배정에서 0 이 된다. 위조된 값은 0"
    requirement: "NIGHT-02"
    verification:
      - kind: unit
        ref: "test/client/records.test.tsx#열린 시트와 새 판 (03-11)"
        status: pass
      - kind: unit
        ref: "test/unit/recordsSeen.test.ts#loadSeenCount / saveSeenCount"
        status: pass
    human_judgment: false
  - id: C4
    description: "열 때 새 기록이면 맨 위 줄에만 NEW, 연 채 새 기록이 오면 NEW 가 새 맨 위 줄로 옮겨 가고 점은 켜지지 않으며, 닫았다 열면 NEW 가 없다. 시트는 단계가 바뀌어도 열린 채다"
    requirement: "NIGHT-02"
    verification:
      - kind: unit
        ref: "test/client/records.test.tsx#열린 시트와 새 판 (03-11)"
        status: pass
    human_judgment: false
  - id: C5
    description: "같은 연결에서 records 길이가 늘 때만 위쪽 바 아래 '수사 기록이 추가됐어요' 알림이 2초 뜨고 화면을 막지 않는다. 안 골랐으면·첫 마운트·재접속에는 알림도 점도 없다"
    requirement: "NIGHT-02"
    verification:
      - kind: unit
        ref: "test/client/records.test.tsx#알림·흐름 (03-11)"
        status: pass
    human_judgment: false
  - id: C6
    description: "360폰 위쪽 바에서 [수사 기록] + [내 역할] + 제목·N일차가 겹치거나 줄바꿈되지 않는다"
    requirement: "NIGHT-02"
    verification:
      - kind: backstop
        ref: "03-12 배포본 360폰 확인"
        status: pending
    human_judgment: true
    rationale: "계획이 backstop 으로 둔 항목이다. jsdom 은 글줄 수·좌표를 재지 못한다. 버튼 둘은 flex none + gap 8(시안 .hd__r1 간격)이고 제목 열은 min-width 0 이다"

actuals:
  tokens: 8800   # chars/4 over git diff src·test (35353자, .planning 제외)
  tasks: 2
  commits: 4
plan_head_before: 121a7d35afa69856c5ecce0ba52d6ee9a4640335
plan_head_after: 35ea6f79db03ca650b6c349c7fe11f3f8e0078a1
---

# Phase 3 Plan 11: 경찰 수사 기록 Summary

**경찰(탈락한 경찰 포함)에게만 [내 역할] 왼쪽에 [수사 기록] 버튼이 생기고, 밤 끝에 새 기록이 오면 2초 알림과 버튼 점이 켜지며, 누르면 '마피아 수사 기록' 시트가 최신 위 4열 줄(마피아는 진홍 굵게)과 NEW 로 열린다 — 본 개수는 폰 메모리에 숫자 하나만 남는다.**

## Performance

- **Duration:** 약 15분 (2026-10-25)
- **Tasks:** 2 (Task 1 트레이서 TDD, Task 2 TDD)
- **Files:** 소스 신규 4개(recordsSeen·RecordsSheet·RecordsToast·records.css) + 수정 3개(RoomScreen·DayScene·phase.css) + 테스트 2개

## Accomplishments

- **본 개수 폰 메모리(Task 1):** `minifia:records:{방코드}` 에 0 이상 정수 문자열 하나. 읽을 때 `^\d+$` 가 아니거나 안전 정수가 아니면 0(T-03-33). 저장소가 예외를 던지면 session.ts 와 같은 모양의 모듈 메모리로 대신한다. 기록 내용·토큰은 저장하지 않는다(T-03-32).
- **버튼·시트(Task 1):** `RecordsButton` 은 `Button secondary compact` 에 수첩 20 + '수사 기록', 새 기록이면 aria-hidden 점과 이름 '수사 기록, 새 기록'. `RecordsSheet` 는 기존 `Sheet`(`mf-sheet--chat` 높이 재사용) 안 `ol.mf-records[role=list]`, 줄은 일차·●이름·결과·NEW 4열, 줄 이름 '새 기록, 1일차 밤, 민지, 마피아'. 도장·부제 없음.
- **RoomScreen 상태(Task 1):** 경찰이면 `[수사 기록][내 역할]` 을 Day·DayScene 의 같은 머리말 prop 으로 넘긴다(RoleReveal 은 그대로). 시트 열림·NEW·seen 을 [내 역할] 시트처럼 단계 switch 밖에서 쥔다. 열린 채 길이가 늘면 NEW 를 새 맨 위로 옮기고 seen 을 새 길이로 저장한다. lobby·assigning 이면 시트를 닫고 seen 을 0 으로 저장한다.
- **알림(Task 2):** DayScene 이 직전 `{ epoch, len }` 을 ref 에 두고, 경찰이며 같은 epoch 에서 길이가 늘면 `useToast(2000)` 로 `RecordsToast`(`.mf-records-toast`, 수첩 16 + 문구, role=status)를 `.mf-dayscene` 직계에 띄운다.
- **머리말 간격(Task 2):** `.mf-phasebar__extra` 는 `display: flex; gap: var(--space-sm)`, `.mf-day__top` 에 `gap: var(--space-sm)` (시안 `.hd__r1` 8).
- 전체: `npx vitest run` 64 파일·1309 통과, `npm run typecheck`·`npm run build` 통과.

## TDD

### RED

- Task 1: `records.test.tsx` 20건 중 17건 실패(`gsd check tdd-red-evidence` → RED_EVIDENCE_OK, tap-flat). 대상 "경찰 낮 토론: '수사 기록, 새 기록' 버튼이 …" 가 `expected '(없음)' to be '수사 기록, 새 기록'` 로 실패. **semanticAssessment:** 대상이 실행되어 버튼이 없다는 계획된 단언에서 정확히 실패했고 import·문법·fixture 오류가 아니다. 통과한 3건은 시민·마피아·의사에 버튼이 없다는 단언이라 구현 전에도 참이며, 계획이 요구한 범위 고정(비경찰 화면 불변)이다.
- Task 2: `records.test.tsx`·`recordsSeen.test.ts` 중 2건 실패(RED_EVIDENCE_OK). 대상 "경찰 night(records []) → morning(records 1개) …" 가 `expected '(알림 없음)' to be '수사 기록이 추가됐어요'`, 머리말 간격 CSS 단언이 `expected false to be true`. **semanticAssessment:** 알림 구현·phase.css gap 이 없어서 정확한 단언에서 실패했다. 알림 부정 케이스(첫 마운트·epoch 변경·길이 불변)와 `recordsSeen.test.ts` 단위 테스트는 Task 1 구현으로 이미 참이라 RED 에서 통과한다 — 계획이 Task 2 행동으로 요구한 범위 고정/단위 테스트이며, 구현 전 통과는 정상이다.

### GREEN

각 태스크의 최소 구현으로 통과. 트레이서 게이트: 자동 검사뿐인 `<verify>` 라 `npx vitest run test/client/records.test.tsx test/client/phaseScreens.test.tsx test/client/roomScreen.test.tsx`(75건)·`npm run typecheck` 를 다시 돌려 통과를 확인하고 확장 태스크로 넘어갔다 — Tracer verified end-to-end.

### REFACTOR

없음.

### Commits

- 9564530 test(03-11): police records button and sheet
- b06c642 feat(03-11): police records button, dot and sheet
- 54038cc test(03-11): records toast, header gap and seen storage
- 35ea6f7 feat(03-11): records toast and header gap

`commits: 4` 는 `git rev-list --count ${plan_head_before}..HEAD` 로 측정한 값이다(HANDOFF 갱신·SUMMARY 커밋은 그 뒤에 더해진다).

## TDD Gate Compliance

두 태스크 모두 `test(03-11)` 커밋이 해당 `feat(03-11)` 커밋보다 먼저다(위 순서). 각 RED 는 `gsd check tdd-red-evidence` 로 RED_EVIDENCE_OK 를 받은 뒤 커밋했고, 실패 보고서는 한 줄 단언(문자열·불리언)이라 tap-flat 이 깨지지 않았다.

## Deviations from Plan

None - plan executed exactly as written. (세부 선택은 key-decisions 에 적었다. 저장소 대체 메모리를 저장 성공 시 지우는 한 줄은 계획이 정한 "저장소 예외 시 메모리 대체" 의 구현 세부다.)

## Issues Encountered

없음. 시트 `<dialog>` 가 열린 동안 role 질의가 막히지 않도록 테스트는 `dialog[aria-label="수사 기록"]` 를 직접 찾아 단언했다.

## Known Stubs

없음.

## Threat Flags

없음. 새 네트워크 입구·인증 경로·신뢰 경계 변화가 없다. T-03-32(저장소에는 개수만 — 인수 기준 grep 0, 단위 테스트가 값이 숫자 하나임을 확인)·T-03-33(0 이상 정수가 아니면 0 — 단위 테스트)·T-03-SC(새 패키지 없음)를 지켰다. T-03-35(버튼 존재가 경찰임을 드러냄)는 계획대로 accept.

## Self-Check: PASSED

- 파일: src/net/recordsSeen.ts, src/components/RecordsSheet.tsx, src/components/RecordsToast.tsx, src/styles/records.css, test/client/records.test.tsx, test/unit/recordsSeen.test.ts 존재 확인
- 커밋: 9564530, b06c642, 54038cc, 35ea6f7 모두 HEAD 의 조상
- 인수 기준: 세 파일 존재·`grid-template-columns: 52px 84px minmax(0, 1fr) 48px` 1·`minifia:records:` 1·기록 내용 저장 grep 0·records.css 색 hex 0·`수사 기록이 추가됐어요`(DayScene) 1·`.mf-phasebar__extra` gap 1·`RecordsToast` 파일 존재 모두 통과
- 각 태스크의 `test(03-11)` 커밋이 해당 `feat(03-11)` 커밋보다 앞
- 전체 검증: `npx vitest run` 1309 통과, `npm run typecheck`, `npm run build` 통과

## Next Phase Readiness

03-12 배포본에서 360폰 위쪽 바([수사 기록] + [내 역할] + 제목·N일차) 겹침(C6)과 8명판 경찰 흐름(밤 끝 알림·점·시트)을 사람이 본다.
