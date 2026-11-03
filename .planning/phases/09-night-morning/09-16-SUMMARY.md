---
phase: 09-night-morning
plan: "16"
subsystem: worker-leak-proof
tags: [metamorphic, leak-test, snapshot-storage, will-note-canary, tdd, tracer]
status: complete

requires:
  - phase: 09-night-morning
    provides: 밤 이동·audience (09-03), home·afterTransition 배선과 observe/stable 도우미 (09-09), will·note 서버 (09-12), 카드·분필 서버 (09-14)
provides:
  - test/worker/helpers.ts 의 snapshotStorage(code)·restoreStorage(code, snap) (저장소 전체 + 알람 스냅샷/복원, DO 퇴거)
  - nightLeak.test.ts 메타모픽 (i) 무사 밤, (ii) 암살 밤, 재접속 L9, 아침 길이 L6, 구출 개별 알림 없음
  - leak.test.ts 신분 여섯 x 유언·쪽지 canary 행렬과 SERVER_ONLY_KEYS 의 nightNote
affects: [09-17, 09-18]

actuals:
  tokens: 14500
  tasks: 3
  commits: 4
plan_head_before: 3ccb68c1e1e3bf63d284750357a7f9c1bf86b011
plan_head_after: 8c183e7

tech-stack:
  added: []
  patterns:
    - "같은 방·같은 밤 시작 상태를 snapshotStorage 로 떠 두고 구간 A/B 를 돌린 뒤 소켓별 프레임 열을 stable() 로 비교한다 (메타모픽)"
    - "시험이 실제로 보고 있음을 대조로 증명한다: 마피아 소켓 열은 A/B 가 달라야 하고, 변이(view.ts 조건 제거)를 넣으면 canary 시험이 실패한다"

key-files:
  created: []
  modified:
    - test/worker/helpers.ts
    - test/worker/nightLeak.test.ts
    - test/worker/leak.test.ts

key-decisions:
  - "스냅샷은 알람 시각을 특수 키(\\u0000alarm)로 같은 Map 에 담고, 복원 put 은 100 키씩 나눈다(put 은 한 번에 128 키 한계)"
  - "허용 목록·휘발 목록은 넓히지 않았다. 신규 경로 허용 없음 — me.will/note/nightTally/nightSure 는 받을 권리 조건 단언으로만 확인한다"

requirements-completed: []

metrics:
  duration: 약 25분
  completed: 2026-11-03
---

# Phase 9 Plan 16: 메타모픽 누설 증명 Summary

**밤 전체 프레임 열을 저장소 스냅샷 A/B 로 비교해, 마피아가 움직이고 말하든 가만히 있든 시민·경찰·의사 폰이 받는 것이 같음을 실제 프레임으로 증명하고, 유언·쪽지 canary 로 죽기 전에는 어디에도 새지 않음을 확인했다.**

## 수행 내용

- **Task 1 (tracer)**: `snapshotStorage`/`restoreStorage` 를 만들고 메타모픽 (i) 무사 밤을 통과시켰다. 구간 A(가만히)와 B(서로 다른 시민 pick, move x3, 마피아 chat, typing) 모두 `day.morning = {}`, 시민 편 네 소켓의 [밤 진입 뒤 ... 아침 state·snap ... 낮 시작 state] 열이 같다. 마피아 소켓의 열은 A/B 가 달라서 시험이 맹목이 아님을 보인다.
- **Task 2**: 메타모픽 (ii) 암살 밤(같은 V 선택 + 같은 쪽지, V 유언 포함), 재접속 L9(첫 프레임 [state, world snap(본인 한 칸), chatLog] 동일), L6(구출·미선택·불일치 세 밤 모두 phaseDurationMs 5000, saved 를 빼면 키 모양 동일, 구출된 시민과 다른 시민의 아침 진입 프레임 종류 동일).
- **Task 3**: leak.test.ts 에 유언 canary 행렬. 여섯이 판 시작에 `CANARY-{seat}` 를 저장, 시민 하나는 밤 전에 유령으로 만들고, 마피아 확정 + 쪽지 `NOTE-CANARY`, 쪽지 뒤 경찰·의사 pick 으로 view 를 다시 만들게 한 뒤 아침까지 모든 실제 프레임을 검사한다.

## 검증

- `npx vitest run test/worker/nightLeak.test.ts test/worker/morningCards.test.ts` 27 통과, `leak.test.ts` 5 통과.
- `npm run typecheck` 오류 없음. 전체 `npx vitest run`: 3997 통과, 1 실패 (`testTools.test.ts` ended 시험 — 이월 메모의 기존 불안정, 이 계획 탓 아님).
- `.skip(`·`.todo(` 0건.

## Deviations from Plan

### 서버 수정 없음 (정상)

세 작업 모두 시험이 처음부터 통과했다. 서버(worker/room.ts)에 누설이 없었기 때문에 수정하지 않았다. 계획이 말한 "시험이 누설을 찾으면 고친다" 에 해당하는 일이 없었다. 대신 시험이 실제로 위반을 잡는지 변이로 확인했다: `shared/game/view.ts` 의 `me.note` 조건에서 마피아 제한을 빼자 canary 시험이 실패했고, 되돌렸다.

**1. [Rule 1 - 시험 보강] canary 시험이 처음엔 변이를 못 잡음**
- **Found during:** Task 3 변이 확인
- **Issue:** 쪽지 저장 뒤 시민 편 view 가 다시 만들어지지 않아 `me.note` 조건 제거를 놓쳤다.
- **Fix:** 쪽지 뒤 경찰·의사가 pick 해 그들 소켓이 새 state 를 받게 했다. 변이가 잡힌다.
- **Commit:** 8c183e7

**2. [시험 기대값 정정] 유령 canary**
- 처음 "산 다섯만 자기 유언 view 를 받는다" 로 썼으나 유령도 죽기 전에 저장 직후 본인 view 로 받았다. 여섯으로 고쳤다.

TDD 메모: Task 1 만 RED(도우미 부재로 실패) 커밋이 있고, Task 2·3 은 서버가 이미 올바라 처음부터 통과하는 특성화 시험이라 RED 커밋이 없다.

## Known Stubs

없음.

## Threat Flags

없음. 새 서버 경로·네트워크 표면 없음. T-09-36 은 메타모픽·재접속·길이·canary 시험으로, T-09-37 은 허용 목록·휘발 목록을 넓히지 않음(SERVER_ONLY_KEYS 에 nightNote 추가만)으로 처리했다.

## 요구사항

이 계획은 증명 계획이라 완료 처리한 요구사항이 없다. NIGHT-07·MORN-03·MORN-04 는 앞 계획에서 이미 완료 처리됐고, WILL-01·NIGHT-12 는 이월 메모대로 09-17(화면 장착) 뒤 완료한다.

## Self-Check: PASSED

- 파일: test/worker/helpers.ts, test/worker/nightLeak.test.ts, test/worker/leak.test.ts 존재
- 커밋: e1cdd5a, 96346fe, bb6d8c0, 8c183e7 존재
