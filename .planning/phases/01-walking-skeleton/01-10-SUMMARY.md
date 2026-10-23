---
phase: 01-walking-skeleton
plan: 10
subsystem: ui
tags: [react, table, lobby, toast, seat-transition, css, vitest, tdd]

requires:
  - phase: 01-walking-skeleton
    provides: "01-03 seatLayout, 01-04 connectedCount, 01-05 Backdrop·Button·Toast·assets, 01-06 Figure, 01-08 Icon, 01-09 start 처리기(서버 재검증)"
provides:
  - "Table·TableSeat: 상태만 받아 그리는 2.5D 원근 테이블(이후 낮·밤·투표 화면이 재사용)"
  - "diffRoomViews·toastForDiff: 스냅샷 두 개의 차이로 입장·방장 변경 토스트와 자리 전이"
  - "useSeatTransitions: 같은 epoch 안의 변화만 entering 420ms·leaving 320ms 로 표시"
  - "Lobby(S-03): 방 코드 바·테이블·하단 시트(연결된 인원·안내·[게임 시작] 2초 잠금)·토스트"
  - "lobby.css: .mf-table*, .mf-seat*, .mf-badge, .mf-lobby*, seat-enter·seat-leave"
affects: [01-11, 01-12, 01-13, 01-14]

actuals:
  tokens: 12300
  tasks: 3
  commits: 6
plan_head_before: 3314e7cce8401e45914200a29e804716ec3ffe6a
plan_head_after: 18f1be7eaa7439a27ba26dfb7d89addabc54fd9d

tech-stack:
  added: []
  patterns:
    - "토스트·자리 전이는 서버 이벤트 없이 스냅샷 차이(roomDiff)로만 만든다. epoch 가 바뀌면 직전 스냅샷을 비운다"
    - "자리 전이는 render 중 상태 보정(set-state-during-render)으로 계산해 새 사람이 전이 표시 없이 한 프레임 먼저 그려지지 않게 한다"
    - "Table 입력(TableSeat)에 역할 필드가 없다 — 동료 표시는 서버가 마피아에게만 보낸 me.allies 에서 만든 isAlly 뿐"
    - "시작 버튼 활성은 서버 checkStart 와 같은 connectedCount 로 계산하고 판정은 서버가 한다"

key-files:
  created:
    - src/components/Table.tsx
    - src/net/roomDiff.ts
    - src/net/useSeatTransitions.ts
    - src/styles/lobby.css
    - test/client/table.test.tsx
    - test/client/lobby.test.tsx
    - test/unit/roomDiff.test.ts
  modified:
    - src/screens/Lobby.tsx
    - src/styles/screens.css
    - test/client/screens.test.tsx

key-decisions:
  - "동료 링·마름모는 dimmed 가 아닐 때는 자리 층 안에, dimmed 일 때는 막(z 20) 위 z 30 의 별도 층에 그린다 — 자리 층이 자체 쌓임 맥락이라 안쪽 z-index 30 으로는 막을 넘을 수 없다(D-14)"
  - "뒤쪽 자리의 방장 이름표는 배지 높이만큼 머리 위로 5% 더 올려 배지가 머리를 가리지 않게 했다(Claude 재량, D-08)"
  - "화면이 기억하는 상태는 [게임 시작] 2초 잠금 하나뿐이다. 시작 거절은 서버가 다시 보낸 view 로만 반영한다"

requirements-completed: [ROOM-02, ROOM-03]

coverage:
  - id: D1
    description: "대기실이 대기 장면 위 원근 타원 테이블 둘레에 세트 C 인물과 이름표로 그려지고, 내 자리가 맨 아래 가운데 '{닉네임} (나)', 빈 자리는 비워 둔다"
    requirement: "ROOM-02"
    verification:
      - kind: unit
        ref: "test/client/table.test.tsx#앉은 사람마다 인물 그림이 하나씩 있고 빈 자리에는 아무것도 그리지 않는다"
        status: pass
      - kind: unit
        ref: "test/client/lobby.test.tsx#방 코드 라벨과 코드, 테이블 위 이름 3개를 보여 주고 닉네임은 텍스트로만 그린다"
        status: pass
    human_judgment: false
  - id: D2
    description: "방장 알약 배지, 끊김(흑백 + 이름표 옆 아이콘 + 접근성 이름), 마피아 동료 링·마름모가 자리마다 맞게 표시된다"
    requirement: "ROOM-02"
    verification:
      - kind: unit
        ref: "test/client/table.test.tsx#끊긴 사람은 인물이 흑백(mf-figure--disconnected) 이고 자리 접근성 이름이 '{닉네임}, 연결 끊김' 이다"
        status: pass
      - kind: unit
        ref: "test/client/table.test.tsx#isAlly 자리에만 aria-label '동료' 표시가 있다"
        status: pass
    human_judgment: false
  - id: D3
    description: "하단 시트: 연결된 인원 기준 인원 표시·안내·[게임 시작] 활성, 8자리 가득, 2초 잠금, canSend 거짓이면 꺼짐, 참가자·방장 끊김 안내"
    requirement: "ROOM-03"
    verification:
      - kind: unit
        ref: "test/client/lobby.test.tsx#하단 시트: 연결된 인원·안내·[게임 시작] (ROOM-03, R7)"
        status: pass
    human_judgment: false
  - id: D4
    description: "입장·방장 변경 토스트와 자리 등장·퇴장이 스냅샷 차이로만 만들어지고 처음 열기·재연결(epoch)·나 자신에게는 나오지 않는다"
    requirement: "ROOM-02"
    verification:
      - kind: unit
        ref: "test/unit/roomDiff.test.ts"
        status: pass
      - kind: unit
        ref: "test/client/lobby.test.tsx#입장·방장 변경 토스트와 자리 등장·퇴장 (D-10, R9)"
        status: pass
    human_judgment: false
  - id: D5
    description: "8명이 앉은 대기실이 폭 360px·높이 640px 화면에서 세로 스크롤 없이 들어가고 앞뒤 인물이 겹쳐도 이름표를 읽을 수 있다"
    requirement: "ROOM-02"
    verification: []
    human_judgment: true
    rationale: "실제 폰 레이아웃·겹침 판단은 브라우저·실기기 확인이 필요하다(계획이 backstop 으로 지정, 01-14 실기기 확인). happy-dom 은 레이아웃을 계산하지 않는다."

duration: 미측정(세션 한도로 중단 후 재개)
completed: 2026-10-23
status: complete
---

# Phase 01 Plan 10: 원근 테이블 대기실 Summary

**shared/seatLayout 좌표의 2.5D 원근 테이블(Table)과 스냅샷 차이 기반 토스트·자리 등장/퇴장(roomDiff·useSeatTransitions), connectedCount 로 켜지는 [게임 시작] 을 갖춘 S-03 대기실**

## Performance

- **Duration:** 미측정 (세션 한도로 중간에 멈췄다가 재개해 시작~끝 시각이 의미 없다)
- **Completed:** 2026-10-23T06:14Z
- **Tasks:** 3 (Task 1 은 type="tracer")
- **Files modified:** 10 (생성 7, 수정 3)

## Accomplishments

- **Table**: bundle.js Table 을 TSX 로 옮기되 빈 의자를 없애고, 왕관을 이름표 아래 "방장" 알약으로 바꾸고, 이름표를 크기 변환 바깥 층으로 분리했다. 좌표는 `seatLayout(seat, mySeat)` 그대로라 둘러앉은 순서가 모든 폰에서 같다. 입력(`TableSeat`)에 역할 필드가 없다(타입 테스트로 고정).
- **Lobby(S-03)**: 대기 장면 위 위쪽 바(방 코드)·테이블·하단 시트. 01-02 의 임시 목록을 교체했고 "닉네임은 텍스트로만" 불변식을 유지했다.
- **시작 조건**: `connectedCount` 로 인원·버튼 활성을 서버와 같은 기준으로 계산한다. 끊긴 사람은 인원에 들지 않고, 8자리가 차면(끊긴 사람 포함) "8 / 8명 · 가득 찼어요". 누르면 `start` 를 보내고 2초 잠금, `canSend` 거짓이면 꺼진다.
- **토스트·전이**: `diffRoomViews`/`toastForDiff` 순수 함수로 입장·방장 변경(방장 변경 우선) 토스트를 만들고, `useSeatTransitions` 가 같은 epoch 안의 변화만 등장 420ms·퇴장 320ms 로 표시한다. 처음 열기·재연결(epoch 변경)·나 자신에게는 나오지 않는다. StrictMode 에서도 첫 스냅샷에 토스트가 없다.

## TDD Gate Compliance

세 Task 모두 RED(`test(01-10)`) → GREEN(`feat(01-10)`) 순서를 지켰고 REFACTOR 커밋은 필요 없었다.

| Task | RED 커밋 | GREEN 커밋 | RED 증거 |
| --- | --- | --- | --- |
| 1 (tracer) | e902fa6 | 6511e12 | `RED_EVIDENCE_OK` (tap-flat) — 대상 `table.test.tsx > 앉은 사람마다 인물 그림이 하나씩…`: 자리표시자 Table 이 빈 role=group 만 그려 img 개수 단언(3)이 0 으로 실패 |
| 2 | ae958b9 | d6bdb4c | `RED_EVIDENCE_OK` — 대상 `lobby.test.tsx > 방장 + 연결 3명 → '모두 모였으면 시작하세요'…`: 안내 문구를 찾지 못해 실패 |
| 3 | b0ba710 | 18f1be7 | `RED_EVIDENCE_OK` — 대상 `roomDiff.test.ts > 새로 앉은 사람이 joined 에 들어간다`: 자리표시자가 빈 결과를 돌려줘 비교 단언 실패 |

의미 검토(semanticAssessment): 세 RED 모두 import·구문·fixture 오류가 아니라 계획된 동작 단언이 대상 테스트에서 실패했다. 모듈이 없어 로드 실패하는 것(INVALID_RED)을 피하려고 RED 커밋에 모양만 있는 자리표시자(Table·roomDiff·useSeatTransitions)를 함께 넣었다.

## Task Commits

1. **Task 1: 트레이서 — 원근 테이블** — `e902fa6` (test) → `6511e12` (feat)
2. **Task 2: 하단 시트** — `ae958b9` (test) → `d6bdb4c` (feat)
3. **Task 3: 토스트와 자리 전이** — `b0ba710` (test) → `18f1be7` (feat)

**Plan metadata:** SUMMARY 커밋(docs: complete plan)

트레이서 피드백 게이트: `human_verify_mode=end-of-phase`, 자동 모드 아님, Task 1 `<verify>` 가 자동 검증뿐이라 재실행으로 대체했다 — `vitest`(table·lobby·screens 52개)와 `npm run typecheck` 통과, 이후 확장 진행.

## Files Created/Modified

- `src/components/Table.tsx` — 2.5D 원근 테이블(상태만 받음, 빈 의자 없음, 방장 알약, 동료 층 분리)
- `src/net/roomDiff.ts` — 스냅샷 차이와 토스트 문구
- `src/net/useSeatTransitions.ts` — 등장·퇴장 표시 훅(render 중 상태 보정 + 타이머 정리)
- `src/screens/Lobby.tsx` — S-03 대기실(교체)
- `src/styles/lobby.css` — 테이블·자리·이름표 배치, 배지, 대기실 틀, 시트, 전이 키프레임(진홍은 --crimson-400 만)
- `src/styles/screens.css` — 쓰지 않게 된 01-02 임시 목록 규칙(.lobby-*) 삭제
- `test/client/table.test.tsx`, `test/client/lobby.test.tsx`, `test/unit/roomDiff.test.ts` — 새 테스트
- `test/client/screens.test.tsx` — Lobby 케이스를 lobby.test.tsx 로 이동

## Decisions Made

- 동료 표시는 `dimmed` 일 때만 막 위 z 30 별도 층으로 그린다. DS 구현은 자리 층 안쪽 z-index 30 이라 자리 층(자체 쌓임 맥락, z ≤ 10)이 막(z 20) 아래에 있어 실제로는 막을 넘지 못한다.
- 뒤쪽 방장 이름표는 5% 더 올려 배지가 머리를 가리지 않게 했다.
- 시작 버튼 활성은 표시용이고 판정은 서버(01-09 checkStart)다. 화면은 별도 상태 없이 view 로 다시 그린다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] RED 커밋에 자리표시자 모듈 포함**
- **Found during:** Task 1·3 RED
- **Issue:** 모듈이 없으면 테스트가 import 단계에서 로드 실패해 `INVALID_RED`(`fixture_or_load_failure`) 가 되어 GREEN 을 승인할 수 없다.
- **Fix:** Table·roomDiff·useSeatTransitions 에 모양만 있는 자리표시자를 RED 커밋에 넣고 GREEN 에서 교체.
- **Commit:** e902fa6, b0ba710

**2. [Rule 3 - Blocking] 실패 보고서를 한 줄로 만드는 단언 형태**
- **Found during:** Task 1·3 RED
- **Issue:** `toBeNull`/`toEqual` 실패 메시지가 DOM·객체 덤프를 여러 줄로 출력해 TAP 보고서가 `Malformed TAP` 이 되어 `check tdd-red-evidence` 가 `invalid_record` 를 냈다.
- **Fix:** 요소 null 검사는 `=== null` + `toBe(true)`, 객체 비교는 JSON 문자열 비교로 바꿨다.
- **Commit:** e902fa6, b0ba710

**3. [Rule 1 - Bug] 동료 링·마름모가 막 위로 올라오지 못하는 DS 구조**
- **Found during:** Task 1 GREEN 설계
- **Issue:** 계획·DS 의 "동료 z 30(막 위)" 은 자리 층이 쌓임 맥락이라 실제로는 성립하지 않는다.
- **Fix:** dimmed 일 때 동료 링·마름모를 막 위 별도 층에 그린다(접근성 라벨 "동료" 는 자리당 하나 유지, 테스트로 고정).
- **Commit:** 6511e12

**4. [Rule 3 - Blocking] 01-02 임시 목록 CSS 삭제**
- **Found during:** Task 1 GREEN
- **Issue:** `.lobby-*` 규칙이 새 Lobby 에서 쓰이지 않아 죽은 코드가 됨(`lobby-players` 제거는 인수 기준).
- **Fix:** screens.css 에서 해당 규칙 삭제.
- **Commit:** 6511e12

---

**Total deviations:** 4 auto-fixed (1 bug, 3 blocking)
**Impact on plan:** 계획의 동작·인수 기준은 그대로이고 모두 검증·정합성 보정이다.

## Issues Encountered

- 중간에 세션 한도로 멈췄다가 재개했다. Task 1 GREEN 이 커밋 전 상태였으나 작업 트리와 커밋 이력이 일치해 다시 하지 않고 이어갔다.
- 이 환경에는 브라우저가 없어 360×640 화면 맞춤과 이름표 겹침은 눈으로 확인하지 못했다(계획이 backstop 으로 지정, 01-14 실기기).

## Known Stubs

없음. RED 단계 자리표시자는 모두 GREEN 에서 실제 구현으로 교체됐다.

## Threat Flags

없음. 새 네트워크 엔드포인트·인증 경로·신뢰 경계 변경 없음. 위협 모델 완화(T-01-36 닉네임은 텍스트·title 로만 렌더 + `b` 요소 부재 테스트, T-01-37 버튼 활성은 표시용·서버 재검증, T-01-38 TableSeat 에 역할 필드 없음 + 타입 테스트, T-01-SC 새 패키지 없음)를 모두 적용했다.

## Deferred To Orchestrator

- HANDOFF.md 갱신·push, STATE.md·ROADMAP.md 갱신은 오케스트레이터가 병합 뒤 main 에서 한다(지시에 따라 이 워크트리에서 하지 않음).
- 배포(`npm run deploy`)는 하지 않았다. 이 계획에는 배포 단계가 없다.
- 위쪽 바의 [뒤로]·[공유] 아이콘 버튼과 나가기·내보내기·공유 시트는 계획대로 01-12 몫이다(`pressable`·`onSeatPress` 는 Table 에 준비돼 있다).

## Next Phase Readiness

- 01-11(연결 띠·재연결)은 `Lobby` 의 `canSend`·`epoch` props 를 `useRoomConnection` 에서 내려 주면 된다. 지금 `RoomScreen` 은 기본값(true, 0)으로 호출한다.
- 01-12 는 위쪽 바에 [뒤로]·[공유]를 더하고 참가자 시트에 링크 공유 줄을 더한다.
- 01-14 실기기에서 360×640·8명 화면 맞춤과 이름표 겹침을 확인해야 한다(필요하면 이름표 최대 폭 96/72px 조정).

## Self-Check: PASSED

- 생성 파일 7개 모두 존재, 6개 커밋(e902fa6, 6511e12, ae958b9, d6bdb4c, b0ba710, 18f1be7) 모두 HEAD 의 조상.
- `npx vitest run --project unit --project client` 414 통과, `--project worker` 22 통과, `npm run typecheck` 오류 없음.
- 인수 기준: Table.tsx 의 `seatLayout(`·"방장"·chair 부재, lobby.css 진홍 `crimson-400` 만, Lobby.tsx 에 `lobby-players` 없음·`connectedCount(`·"가득 찼어요"·"방장 연결을 기다리는 중이에요"·"게임 시작"·`epoch`, roomDiff.ts/useSeatTransitions.ts export 와 문구 모두 확인.

---
*Phase: 01-walking-skeleton*
*Completed: 2026-10-23*
