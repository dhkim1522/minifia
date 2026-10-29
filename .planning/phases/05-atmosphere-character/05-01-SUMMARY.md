---
phase: 05-atmosphere-character
plan: 01
subsystem: client-guide-sentences
tags: [ux, guide, data-guide, tracer, tdd, UX-01]
status: complete

requires:
  - phase: 04-execution-verdict
    provides: "투표 구간 하단 부품(ExecVotePanel·DefenseChips·DefensePanel·NightPanel 기반 패널), verdictViews 시험 픽스처"
provides:
  - "PHASE_GUIDE_FILL(낮 시작 두 줄·토론 헤더 문장)과 TIMELESS_PHASES(lobby·assigning·ended) 상수 — src/game/scenes.ts 한 곳"
  - "모든 단계 화면의 `data-guide` DOM 계약(값 없는 속성, 한 화면에 정확히 하나) — 05-06 의 E2E 검사 UX1 이 읽는다"
  - "test/client/guide.test.tsx: 14단계 × 시점 점검표·누출 검사 시험(87건)"
affects: [05-05, 05-06, 05-08]

actuals:
  tokens: 10800
  tasks: 3
  commits: 6
plan_head_before: 60f6d6e79ab5522143ffcbe88c49090c0fa2fe8c
plan_head_after: d5958d52afcc01960133467c61d4422ccc52261d

tech-stack:
  added: []
  patterns:
    - "안내 요소 표시는 값 없는 `data-guide=\"\"` 속성이다. 항상 그 화면의 주 안내인 부품(NightPanel·ClaimPanel·ExecVotePanel·DefenseChips 제목, TurnPanel·DefensePanel 상태 줄)은 부품 안에서 붙이고, 보조 줄로도 쓰이는 부품(PhaseBar 안내줄, ReadOnlyRow)은 `guide` 불리언 prop 으로 장면이 켠다"
    - "점검표 시험은 Record<PhaseId, 시점[]> 라서 새 PhaseId 가 생기면 타입 오류로 알린다. 타이머 예외 목록은 TIMELESS_PHASES 를 import 해서 쓴다"

key-files:
  created:
    - test/client/guide.test.tsx
  modified:
    - src/game/scenes.ts
    - src/screens/DayScene.tsx
    - src/screens/Lobby.tsx
    - src/screens/Assigning.tsx
    - src/screens/RoleReveal.tsx
    - src/screens/ResultScreen.tsx
    - src/components/PhaseBar.tsx
    - src/components/NightPanel.tsx
    - src/components/ReadOnlyRow.tsx
    - src/components/ClaimPanel.tsx
    - src/components/TurnPanel.tsx
    - src/components/ExecVotePanel.tsx
    - src/components/DefenseChips.tsx
    - src/components/DefensePanel.tsx
    - test/unit/scenes.test.ts
    - test/client/sceneIntro.test.tsx
    - test/client/phaseScreens.test.tsx

key-decisions:
  - "TIMELESS_PHASES 에 assigning 을 넣었다(P5-5 기본값, 확인 대기). 결정 0038 에 `바뀔 수 있는 기본값` 으로 적는 일은 05-08 의 몫이다."
  - "낮 시작 하단은 생존자·탈락자 모두 같은 두 줄이다. DayScene 의 dayAnnounce 분기를 meDead 분기보다 앞에 두었다(아침 하단과 같은 규칙)."
  - "낮 토론 헤더 안내줄은 살아 있는 viewer 만 `{n}일차 · 의견을 나눠요` 이고, 탈락자는 기존 `{n}일차` + 하단 읽기 전용 줄(data-guide)이다."

requirements-completed: [UX-01]

duration: about 10min
completed: 2026-10-29
---

# Phase 5 Plan 01: 안내 문장 빈 칸 채움과 data-guide 계약 Summary

**UX-01 의 빈 칸 두 곳(낮 시작 하단·낮 토론 헤더 안내줄)을 `PHASE_GUIDE_FILL` 상수 한 곳에서 채우고, 모든 단계 화면의 "지금 할 일 한 문장" 요소에 값 없는 `data-guide` 속성을 붙여 14단계 × 시점 점검표를 클라이언트 시험(87건)으로 고정했다.**

## 수행한 일

트레이서 계획이라 Task 1 이 상수 → DayScene → `data-guide` → 방 화면 렌더 시험을 두 빈 칸에 한 번에 꿰고, Task 2·3 이 나머지 화면에 같은 계약을 붙였다. 서버·와이어·단계 길이·CSS·새 의존성은 바꾸지 않았다.

### Task 1 — 트레이서: 낮 시작·낮 토론 빈 칸 (RED `4983dcf` → GREEN `72e00ee`)

- `src/game/scenes.ts`: `PHASE_GUIDE_FILL`(동결 객체: `dayAnnounce {title: "낮이 되었어요", guide: "곧 직업 공개가 시작돼요"}`, `discussion(n) → "{n}일차 · 의견을 나눠요"`)과 `TIMELESS_PHASES`(동결 배열 lobby·assigning·ended)를 `PHASE_INTRO` 아래에 뒀다. 99일차에서도 14자 이하다.
- `DayScene`: dayAnnounce 하단을 모든 viewer 에게 `NightPanel` 두 줄로 그린다. 살아 있는 토론 헤더 안내줄은 상수에서 읽는다. `PhaseBar` 의 `guide` 는 `verdict?.instruction === undefined && (살아 있는 토론 || 마피아 밤)` 이라 처형 무효로 온 밤에도 마피아 헤더가 안내 하나로 남는다. `meDead` 분기 `ReadOnlyRow` 에 `guide` 를 켰다.
- `NightPanel` 제목 `h2` 에 `data-guide=""`, `PhaseBar`·`ReadOnlyRow` 에 선택 prop `guide`.
- `sceneIntro.test.tsx` 의 "낮 시작 살아 있는 사람 하단은 비어 있다" 시험을 새 계약(생존·탈락 같은 두 줄, 읽기 전용 줄 없음)으로 바꿨다.
- 트레이서 게이트: 자동 모드가 아니고 `human_verify_mode` 기본값(end-of-phase)이며 `<verify>` 가 자동 명령뿐이라, 관련 시험 묶음(6파일 177건)을 다시 돌려 통과를 확인하고 이어 갔다.

### Task 2 — 주장·밤·아침·투표 구간 부품 (RED `6a00873` → GREEN `a317dbe`)

`ClaimPanel`·`ExecVotePanel`·`DefenseChips` 제목 `h2`, `TurnPanel`·`DefensePanel` 상태 줄 `b` 에 `data-guide=""`, `DefensePanel` 읽기 전용 분기는 `ReadOnlyRow guide`. `CandidateVotePanel`·관전 알약(`VERDICT_TEXT.spectatorPill`)에는 붙이지 않았다(제목이 안내, `CandidateVotePanel` 의 `data-guide` 는 0). 문구·클래스·마크업 순서 불변.

### Task 3 — 대기실·배정·역할 확인·결과 + 점검표 (RED `f3b0a98` → GREEN `d5958d5`)

`Lobby` `.mf-lobby__guide`, `Assigning` 가운데 `h2`, `RoleReveal` `.mf-reveal__hint`, `ResultScreen` 배너 제목에 `data-guide=""`. `guide.test.tsx` 에 `CHECKLIST: Record<PhaseId, 시점[]>` 로 14단계 × 시점(lobby·assigning 은 역할 없는 한 칸, roleReveal 은 관전 없음) 61칸을 돌려 `[data-guide]` 정확히 하나·글자 있음·속성 값 빈 문자열을 단언하고, `TIMELESS_PHASES` 밖 11단계는 `[role="timer"]` 1개 이상을 단언한다. 누출 검사는 dayAnnounce 하단이 5시점에서 같은 글자, 토론 헤더가 4역할에서 같은 글자, 새 문장 상수에 역할 이름이 없음을 단언한다.

## 시험·검증 결과

| 검사 | 결과 |
|------|------|
| `npm test` (unit + client + worker) | 103 파일, 2868건 통과 |
| `npx vitest run --project client --project unit` | 87 파일, 2679건 통과 |
| `npm run typecheck` (tokens:check, wrangler types, app/worker tsc) | 종료 코드 0 |
| `test/client/guide.test.tsx` | 87건 통과 (RED 때 각 단계마다 해당 칸만 `[data-guide] 개수: expected 0 to be 1` 로 실패했다) |

인수 기준 grep: `PHASE_GUIDE_FILL` 정의 1·`TIMELESS_PHASES` 정의 1·DayScene 사용 3, `의견을 나눠요` 는 scenes.ts 에만 1 (screens/components 0), 부품·화면별 `data-guide` 1 이상, `CandidateVotePanel` 0, `guide.test.tsx` 에서 `TIMELESS_PHASES` 5·`Record<PhaseId` 1.

## 계획과 달라진 점

### 자동 수정한 것

**1. [Rule 1 - 옛 계약 시험] `phaseScreens.test.tsx` 헤더 문구표가 토론 안내줄을 `{n}일차` 로 단언**
- **발견:** Task 3 의 전체 클라이언트 시험.
- **문제:** 이 계획이 토론 헤더 안내줄 계약(살아 있는 viewer `{n}일차 · 의견을 나눠요`)을 바꿨는데 `phaseScreens.test.tsx` 의 "헤더 제목·안내 문구표" 가 옛 값을 기대했다. 계획의 `files_modified` 에는 없는 파일이다.
- **수정:** 그 표의 discussion 행만 새 문장으로 고쳤다(다른 행·단계 불변).
- **커밋:** `d5958d5`

그 밖에는 계획대로 실행했다. 기준 수치·E2E 한도는 건드리지 않았다.

## 인증 게이트

없음.

## 알려진 스텁

없음.

## 위협 표면 점검

새 엔드포인트·인증 경로·파일 접근·스키마 변경 없음. T-05-01(문장이 역할을 드러냄)은 상수가 역할을 입력으로 받지 않고 속성 값이 빈 문자열이며, 누출 검사가 5시점 동일 글자와 상수 안의 역할 이름 없음을 단언해 닫았다.

## 사람이 할 일 · 이어지는 계획

- 새 문장 3개(`낮이 되었어요` / `곧 직업 공개가 시작돼요` / `{n}일차 · 의견을 나눠요`)와 assigning 의 타이머 예외는 P5-5·P5-6 확인 대기 기본값이다. 결정 0038 기록은 05-08 의 몫이다.
- E2E 검사 `UX1`(05-05·05-06)이 이 `[data-guide]` 계약을 그대로 읽는다. 360×560 에서 토론 헤더 안내줄 한 줄(nowrap, 14자 이하)은 E2E 폭 검사(05-05~06)가 본다.

## Self-Check: PASSED

- 만든 파일 `test/client/guide.test.tsx`, 이 SUMMARY 존재 확인.
- 커밋 `4983dcf`·`72e00ee`·`6a00873`·`a317dbe`·`f3b0a98`·`d5958d5` 가 HEAD 의 조상임을 확인.
- `commits: 6` 은 `git rev-list --count 60f6d6e..HEAD` 로 쟀다.
