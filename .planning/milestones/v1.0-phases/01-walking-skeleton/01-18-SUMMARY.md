---
phase: 01-walking-skeleton
plan: 18
subsystem: ui
tags: [react, dialog, ios-safari, instrumentation, gap-closure, G-01-9]

requires:
  - phase: 01-walking-skeleton
    provides: "01-16 Sheet 진입 구조(두 프레임 + 60ms 폴백, preventScroll 포커스)"
provides:
  - "?sheetdebug=1 탭에서만 켜지는 시트 위치 계측(지연 로드 청크 sheetDebug)"
  - "판정 규칙 classifyTrace (A-svh/A-lvh/A-dvh/A-none/B/D/mixed/viewport/sheet-drift/stable)"
  - "실기기 수집용 폰 화면 패널, 콘솔 [sheetdebug] 줄, sessionStorage 기록 12개"
affects: [01-19, G-01-9]

status: complete
gap_status: closed
branch: dialog-programmatic-scroll  # 실기기 패널 1장으로 확정: shB 가 dlgB 위로 올라갔다 돌아옴(포커스 이동에 의한 다이얼로그 자동 스크롤)
actuals:
  tokens: 10000
  tasks: 2
  commits: 4
plan_head_before: 03d8bac653dd0ef6d595ec37d8b9d934ed684339
plan_head_after: db93c8f664dedc4baf991bbb32284a178d1e396e

tech-stack:
  added: []
  patterns:
    - "운영 번들엔 플래그 판정과 등록 자리(sheetProbe.ts)만, 측정 본체는 동적 import 지연 로드 청크"
    - "Sheet 틀 한 곳의 start/mark/end 훅으로 세 시트를 함께 잰다. 계측기가 없으면 무동작"

key-files:
  created:
    - src/debug/sheetProbe.ts
    - src/debug/sheetDebug.ts
    - test/client/sheetDebug.test.tsx
  modified:
    - src/components/Sheet.tsx
    - src/main.tsx
    - test/client/phaseScreens.test.tsx

key-decisions:
  - "계측 본체는 이 plan 뒤에도 지우지 않는다(01-19 재확인·배포본 재확인에 같은 값을 다시 잰다)"
  - "판정은 classifyTrace 코드로 고정, 사람이 정하는 것은 내려앉음이 보였는지 하나뿐"
  - "Task 3 실기기 수집은 사람만 할 수 있어 checkpoint:human-action(blocking-human)으로 멈춤"

requirements-completed: []
---

# Phase 1 Plan 18: G-01-9 시트 계측 Summary

**`?sheetdebug=1` 탭에서만 켜지는 지연 로드 계측기와 판정 규칙(classifyTrace)을 Sheet 틀 한 곳에 걸어, 실기기에서 세 시트의 내려앉음 원인(A-단위·B·C·D·none)을 수치로 가를 준비를 마쳤다. 실기기 수집(Task 3)은 사용자 몫이라 대기 중이다.**

## 상태

- Task 1, 2 완료(자동화 가능한 전부). Task 3(iPhone Safari 실측과 01-UAT.md `diagnosis:` 기록)은 **사용자 실기기 조작이 필요해 멈춤**. 실측값을 지어내지 않았다.
- `gap_status: open`, `branch`는 실측 전이라 미정. 01-UAT.md는 고치지 않았다.
- 재배포·push 없음. STATE.md·ROADMAP.md는 고치지 않았다(오케스트레이터 몫).

## 완료한 일

| Task | 이름 | 커밋 |
| --- | --- | --- |
| 1 | 트레이서: 플래그 → 지연 로드 계측기 → Sheet 훅 → 시트 안 패널 | RED `fb64b89`, GREEN `bab2019` |
| 2 | 계측 확장: 23개 값·사건·classifyTrace·기록 목록·콘솔, 낮 화면 경로 | RED `da7412c`, GREEN `db93c8f` |
| 3 | 실기기 수집 | 대기(checkpoint) |

### TDD 기록

- **Task 1 RED**: `tdd-red-evidence` = `RED_EVIDENCE_OK`. 7개 중 5개가 값 비교로 실패("start 호출 수 0, 기대 1", "enabled false, 기대 true"). 껍데기(빈 export)를 두어 불러오기 실패가 아닌 단언 실패로 RED. 의미 평가: 대상 테스트(start 가 열기 전에 불림·패널에 shown)가 실행되어 계획한 단언에서 실패.
- **Task 2 RED**: `RED_EVIDENCE_OK`. classifyTrace 껍데기가 항상 stable 을 돌려 판정 문자열 단언 8건이, 저장 기록·콘솔·패널 단언 6건이 값 비교로 실패. 의미 평가: 대상 `A-lvh` 테스트가 "expected 'stable' to be 'A-lvh'" 로 실패.
- GREEN 에서 전부 통과(refactor 커밋 없음).

## 만든 것

- `src/debug/sheetProbe.ts` (운영 번들, 약 3KB): 플래그 판정 `sheetDebugEnabled`(sessionStorage 유지, `=0` 으로 끔), 등록 자리, 동적 import 한 곳의 `initSheetDebug`.
- `src/debug/sheetDebug.ts` (지연 로드 청크, 빌드 출력 `sheetDebug-*.js`): 표본 23필드, 단위 측정 요소 6개(100dvh/svh/lvh/100%/inset 0/안전 영역), 프레임·시점·사건 표본, `classifyTrace`, 패널(열린 동안/닫힌 뒤), 저장(최근 12개)·콘솔 `[sheetdebug]`.
- `Sheet.tsx`: start(열기 전)·mark(shown/focused/entered/close)·end(정리). 01-16 진입 구조·sheet.css 는 그대로.
- `main.tsx`: `void initSheetDebug()` 한 줄.
- 테스트: `sheetDebug.test.tsx` 22건, `phaseScreens.test.tsx` 1건(추가만, 지운 줄 0).

## 검증

- `npx vitest run` 전체: 42 files, 658 tests 통과(기준선 41 files, 635).
- `npm run typecheck` 통과. `npm run build` 출력에 `sheetDebug-*.js` 청크 1개. 정적 import 없음(0).
- 불변 가드: `src/styles`, `src/screens`, `worker`, `shared`, `design`, MyRoleSheet·ConfirmSheet·ShareSheet 는 BASE 대비 변경 없음.
- 위협: T-01-62(정보 비노출)는 Test 13·15, T-01-64(정리)는 Test 10 으로 고정.

## Deviations from Plan

### Auto-fixed Issues

없음 — 계획대로 실행했다.

### 환경 메모(편차 아님)

- 워크트리에 `node_modules` 가 없어 메인 저장소 `node_modules` 로 심볼릭 링크를 걸어 테스트·빌드를 돌렸다. 새 패키지는 설치하지 않았다(링크는 커밋 대상이 아니다).
- 개발 서버(`npm run dev`)는 이 워크트리 프로세스가 끝나면 함께 사라져 켜 두지 않았다. 아래 안내대로 사용자가 메인 체크아웃에서 켠다.

## Known Stubs

없음.

## Threat Flags

없음 (새 네트워크·인증·스키마 표면 없음).

## 다음 단계: Task 3 (사용자 실기기 수집)

1. 이 브랜치를 병합한 뒤 메인 체크아웃에서 `npm run dev`(`vite dev --host`)를 켠다. 터미널의 Network 주소를 확인한다(이 PC 의 LAN 주소는 `192.168.219.106` 으로 보이며, 포트는 보통 5173).
2. iPhone Safari 로 `http://{LAN 주소}:5173/?sheetdebug=1` 을 열어 "sheetdebug 켜짐" 패널이 보이는지 확인한다.
3. 01-18-PLAN.md Task 3 `<instructions>` 3~9번대로 공유·나가기 확인·[내 역할](역할 확인 1번, 낮 3번) 시트를 각 3번 연다. 열 때마다 1초 뒤 스크린샷, 내려앉음이 보였는지 패널 머리 줄 번호(#n)와 함께 메모. 화면 녹화 권장.
4. 응답 형식: `collected: <기기·iOS·브라우저> / 스크린샷: <경로> / 내려앉음이 보인 번호: <#n 목록 또는 없음> / (선택) 녹화 / (선택) JSON` 또는 `blocked: <이유>`.
5. 받은 뒤 diagnosis 블록(branch 는 "분기 정하기 규칙" 으로만)을 01-UAT.md G-01-9 아래에 추가하고 이 SUMMARY 의 `branch` 를 채운다. branch 가 none 이면 "재계획 필요 — 01-19 는 코드 변경 없이 멈춘다".

## Self-Check: PASSED

- 파일: `src/debug/sheetProbe.ts`, `src/debug/sheetDebug.ts`, `test/client/sheetDebug.test.tsx` 존재.
- 커밋: `fb64b89`, `bab2019`, `da7412c`, `db93c8f` 모두 HEAD 의 조상.
