---
phase: 01-walking-skeleton
plan: 16
subsystem: ui-sheet
tags: [sheet, dialog, ios-safari, motion, gap-closure, tdd, g-01-9]
status: partial
gap_closure: true
gap_ids: [G-01-9]
gap_status: open

requires:
  - phase: 01-walking-skeleton
    provides: "Sheet 틀(공유·나가기 확인·[내 역할] 세 시트 공용), 01-UAT.md G-01-9"
provides:
  - "시트 첫 프레임을 CSS 시작 상태(translateY(100%))로 그리고 두 프레임 뒤 mf-dialog--open 클래스로 올리는 진입 구조"
  - "requestAnimationFrame 이 오지 않는 환경을 위한 60ms 시간 폴백, 열림 전 닫기·언마운트 시 예약 취소"
  - "포커스 focus({ preventScroll: true })"
affects: [G-01-9 재진단, 01-17 (같은 wave 2 로 순서화), /gsd-verify-work 1 재시험]

actuals:
  tokens: 4300
  tasks: 2
  commits: 4
plan_head_before: 3cc1df9ba0773c45001ed0d58e195e605eab5e35
plan_head_after: f7b4258e689fa131f4906268f2e9d37a380bd22c

tech-stack:
  added: []
  patterns:
    - "진입 모션은 CSS animation 이 아니라 '시작 상태 고정 + 열림 클래스 전환(transition)' 으로 한다"
    - "프레임 예약과 시간 폴백 중 먼저 불린 쪽이 나머지를 취소하고 한 번만 일한다"

key-files:
  created: []
  modified:
    - src/components/Sheet.tsx
    - src/styles/sheet.css
    - test/client/sheet.test.tsx
    - test/client/phaseScreens.test.tsx
    - .planning/phases/01-walking-skeleton/01-UAT.md

key-decisions:
  - "Task 3 실기기 확인이 실패(FAILED)했지만 Task 1~2 커밋은 되돌리지 않는다. 첫 프레임을 시작 상태로 그리는 구조는 올바르고 실기기에서도 첫 프레임 문제는 사라진 것으로 보인다"
  - "실기기 증상이 바뀌었으므로 추측 코드 수정을 이 plan 에서 더하지 않고 재진단으로 넘긴다"

requirements-completed: []  # 계획이 완료되지 않았다(G-01-9 갭 열림). ROLE-02, ROOM-01 은 표시하지 않는다

coverage:
  - id: D1
    description: "시트 첫 프레임이 시작 상태(화면 아래)로 그려지고 두 프레임 뒤 열림 클래스가 붙는다"
    requirement: "ROLE-02"
    verification:
      - kind: unit
        ref: "test/client/sheet.test.tsx, test/client/phaseScreens.test.tsx (G-01-9 describe)"
        status: pass
    human_judgment: false
  - id: D2
    description: "폰(iOS Safari)에서 세 시트가 제자리에서 자연스럽게 열린다"
    requirement: "ROLE-02"
    verification:
      - kind: manual_procedural
        ref: "Task 3 실기기 확인 (iPhone iOS Safari, 화면 녹화)"
        status: fail
    human_judgment: true
    rationale: "시트의 정지 위치와 모션은 실기기 합성·주소창 동작에 달려 있어 자동 테스트로 증명되지 않는다. 사용자 실기기 확인에서 실패했다"

duration: 17min
completed: 2026-10-23
---

# Phase 1 Plan 16: 시트 진입 모션 (G-01-9) Summary

**시트 진입을 'CSS 시작 상태 고정 + 두 프레임 뒤 열림 클래스 + 60ms 폴백 + preventScroll 포커스' 로 바꿔 첫 프레임 위치 문제는 풀린 것으로 보이나, 실기기(iPhone Safari)에서 시트가 바닥보다 약 60px 높은 자리에 멈췄다가 0.2초 뒤 아래로 툭 내려오는 새 증상이 남아 G-01-9 는 열려 있고 재진단이 필요하다.**

## 결과 요약

| 항목 | 값 |
| --- | --- |
| 태스크 | 2/3 완료 (Task 1·2 자동 완료, Task 3 실기기 확인 FAILED) |
| 커밋 | 4 (test 2 + feat 2, 각 태스크 RED 가 GREEN 보다 먼저) |
| 전체 테스트 | vitest 630 통과, `npm run typecheck` 통과 (checkpoint 이전 확인) |
| 갭 상태 | `gap_status: open` (G-01-9 해결 아님) |
| 실기기 결과 | FAILED — 가설 불일치, 실기기 증상으로 재진단 필요 |

## 태스크별 기록

| 태스크 | 이름 | 커밋 |
| --- | --- | --- |
| 1 RED | 시트 진입 모션 G-01-9 실패 테스트 | 57eb305 |
| 1 GREEN | 두 프레임 뒤 열림 클래스 전환으로 변경 (Sheet.tsx, sheet.css) | 52d2ddf |
| 2 RED | 폴백·열림 전 닫기·취소·preventScroll 실패 테스트 | 06a592e |
| 2 GREEN | 60ms 시간 폴백과 preventScroll 포커스 | f7b4258 |
| 3 | 실기기 확인 checkpoint | 커밋 없음 (사용자 확인, FAILED) |

### 변경 내용

- `src/styles/sheet.css`: `mf-sheet-up`·`mf-sheet-scrim-in` 키프레임 animation 을 없애고 `.mf-sheet { transform: translateY(100%) }`, `.mf-dialog--open .mf-sheet { transform: translateY(0) }` 의 transition 으로 바꿨다. 막(scrim)도 같은 방식이다.
- `src/components/Sheet.tsx`: `entered` 상태를 두고 `showModal` 뒤 `requestAnimationFrame` 두 번 뒤에 `mf-dialog--open` 을 붙인다. 60ms `setTimeout` 폴백이 같은 일을 대신하고 먼저 불린 쪽이 나머지를 취소한다. 열림 전에 닫거나 언마운트하면 예약을 모두 지운다. 포커스는 `focus({ preventScroll: true })`.

## 실기기 확인 결과 (Task 3, FAILED)

- 기기: iPhone, iOS Safari (OS 버전 미기재), `npm run dev` 개발 서버 LAN 주소 192.168.32.80:5173.
- 사용자 보고: "여전합니다. 다만 중앙에 떴다 내려가네요".
- 녹화(사용자 로컬 경로, 저장소에 넣지 않음): `/Users/dhkim1522/Downloads/ScreenRecording_10-23-2026 19-45-10_1.MP4` (4.67초, 60fps, 1206x2622). 낮 화면의 [내 역할] 시트를 두 번 열었다.
- 오케스트레이터의 60fps 프레임 관찰(원인 검증 아님):
  1. 시트가 아래에서 올라온다. 첫 프레임이 최종 위치로 그려지는 일은 없다.
  2. 올라와 멈춘 자리의 아래 끝이 실제 화면 아래 끝보다 약 60px 위다(보이는 시트 높이 약 330px 의 약 18%). 시트 밑으로 벽돌 배경이 보이고 그 아래에 Safari 하단 툴바가 있다.
  3. 열린 지 약 0.2초 뒤 시트 전체가 약 60px 아래로 툭 내려와 바닥에 붙는다. 사용자는 이것을 "중앙에 떴다가 내려간다" 로 본다.
- 공유 시트·나가기 확인 시트는 이 확인에서 보고되지 않았다(Android Chrome 도 확인하지 않음).
- 해석: 01-16 의 두 프레임 뒤 열림 수정은 "첫 프레임 위치" 문제에는 효과가 있어 보인다. 그러나 증상이 "열린 뒤 정지 위치가 바뀜" 으로 이동했을 뿐 갭은 닫히지 않았다. UAT 가설(첫 프레임 처리)은 일부만 맞았다. 어느 수정(두 프레임 뒤 열림 / preventScroll)이 첫 프레임 증상을 없앴는지는 실기기에서 구분되지 않는다.
- 01-UAT.md G-01-9 아래에 `post_fix_report:` 로 위 내용을 그대로 기록했고, 상태는 열어 두었다(해결로 표시하지 않음).

## 재진단 후보 (새 증거 반영 순위, 구현하지 않고 기록만)

1. **dvh/높이·하단 기준선이 열린 뒤 바뀜 (가장 유력).** `.mf-dialog` 의 `height: 100%` 와 `.mf-sheet` 의 `max-height: 80dvh` 가 서로 다른 뷰포트 단위를 쓴다. showModal·포커스 이후 iOS Safari 의 하단 툴바·visual viewport 가 갱신되면 다이얼로그 하단 기준선이 약 60px 움직일 수 있다. 관찰된 "멈춘 자리가 60px 높음 → 0.2초 뒤 바닥으로 내려옴" 과 가장 잘 맞는다. 점검: `.mf-dialog` 를 `inset: 0` + `100dvh`/`100svh`/`100lvh` 로 비교, 시트 하단을 어느 뷰포트 기준에 붙이는지, `env(safe-area-inset-bottom)` 영향.
2. **시트 안 직업 그림이 늦게 로드되어 시트 높이가 바뀜.** 이미지 높이가 예약되지 않아 시트가 늘어나는 동안 아래 정렬이 흔들릴 수 있다. 점검: 이미지 `aspect-ratio`/`height` 속성. 다만 관찰된 이동이 시트 전체의 균일한 약 60px 하강이라 1번보다 가능성이 낮다.
3. **iOS 합성 레이어.** top layer 안 `transform` 전환이 합성되지 않아 위치가 늦게 확정될 수 있다. 시험: `will-change: transform`, `translate3d`.
4. **낮 화면 전용 합성과 겹침.** `.mf-phase-enter`·배경 그림과 top layer 가 같은 프레임에 겹치는 문제. 낮 화면에서만 나는지 다른 화면(공유 시트·나가기 확인 시트)과 비교하면 걸러진다.

다음 진단에 필요한 정보: 공유·나가기 확인 시트도 같은 어긋남이 있는지, 하단 툴바를 숨긴 상태(주소창 접힘 후)나 홈 화면 추가(PWA) 상태에서도 나는지, OS 버전, 원격 웹 인스펙터로 열린 직후와 0.2초 뒤의 `visualViewport.height`/`innerHeight`/다이얼로그 `getBoundingClientRect()` 값.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] sheet.css 의 `?raw` import 가 테스트 환경에서 빈 문자열**
- **Found during:** Task 1 (RED)
- **Issue:** CSS 규칙 값을 단언하려고 `sheet.css?raw` 를 가져오면 vitest 환경에서 빈 문자열이 되어 단언이 의미 없이 통과하거나 오작동한다.
- **Fix:** `readFileSync` 로 파일을 읽어 규칙을 파싱하고, 읽은 CSS 가 비어 있지 않은지 확인하는 보호(guard) 테스트를 추가했다.
- **Files modified:** test/client/sheet.test.tsx, test/client/phaseScreens.test.tsx
- **Commit:** 57eb305

### 계획과 다르게 남겨 둔 것

- **기존 "진홍 금지" 테스트는 손대지 않았다.** 이미 있던 테스트가 사실상 아무것도 검사하지 않는 상태(vacuous)였으나 이 plan 의 범위가 아니고 기존 줄을 고치지 않는다는 계획 규칙에 따라 그대로 두었다. 별도 정리 후보로만 기록한다.

### 계획된 failed 경로 실행

Task 3 은 계획의 failed 분기를 그대로 따랐다: Task 1·2 를 되돌리지 않았고, 추측 코드 수정을 더하지 않았으며, UAT 에 `post_fix_report` 를 기록하고 갭을 열어 둔 채 재진단 보고로 넘긴다.

## Known Stubs

없음.

## Threat Flags

없음. 새 네트워크·인증·파일 접근 표면 없음. T-01-58(시트가 화면 밖에 영영 남음)은 60ms 시간 폴백 테스트로 막았다.

## 후속

- G-01-9 는 열려 있다. 재진단(위 후보 1순위부터)을 별도 plan/디버그 세션으로 해야 한다. 추측 수정은 같은 실기기 확인 루프를 다시 돌게 하므로 먼저 원격 인스펙터 수치를 받는 것이 빠르다.
- 01-17(입력 글자 대비)은 이 plan 뒤 wave 2 로 순서화되어 있어 영향 없다.
- 배포본 재시험(`/gsd-verify-work 1`)은 G-01-9 재진단 후에 한다.

## Self-Check: PASSED

- FOUND: src/components/Sheet.tsx, src/styles/sheet.css, test/client/sheet.test.tsx, test/client/phaseScreens.test.tsx, 01-UAT.md(post_fix_report 추가)
- FOUND commits: 57eb305, 52d2ddf, 06a592e, f7b4258 (git rev-list --count 3cc1df9..HEAD = 4)
