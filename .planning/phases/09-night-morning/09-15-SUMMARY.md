---
phase: 09-night-morning
plan: "15"
subsystem: client-night-citizen-side
tags: [face-list, tension-vignette, night-dark, night-panel-removal, tdd, tracer]
status: complete

requires:
  - phase: 09-night-morning
    provides: FaceList·faceSrc·행동 아이콘 (09-05), startTension 로컬 큐 스케줄러 (09-06), 밤 시민 편 장면 표·조명 (09-10), 밤 마피아 화면·지도 이름표 (09-13)
provides:
  - GamePanel 밤 경찰·의사 얼굴 목록 패널 (FaceList, pick 전송, 낙관적 눌림, 거절 되돌림)
  - TensionVignette 부품 + WorldStage.underlay 슬롯 + .mf-tension 맥박 규칙 (night.css)
  - GameMap 시민 편 어둠 표식 data-night-dark="true" 와 e2e 전용 window.__mfTension
  - DAY_COPY.nightHintCitizen·nightHintPolice·nightHintDoctor 와 headerFor 역할별 밤 안내
  - dayStaticGuard 제거 식별자 10개 + NightPanel.tsx 부재 검사, tensionStaticGuard 순수/부품 분리와 허용 import 검사
affects: [09-17, 09-22]

actuals:
  tokens: 18200
  tasks: 3
  commits: 6
plan_head_before: 490945f11de90bb7831a86c01f557c08e42c0cbe
plan_head_after: efdfd34155d59524b19f9db509389138c835c51e

tech-stack:
  added: []
  patterns:
    - "경찰·의사 선택은 GamePanel 이 useViewChoice 로 눌림을 들고, 보낸 사실만 onNightPickSent 로 GameMap 에 알려 거절 응답을 그 선택의 거절로 읽게 한다"
    - "긴장 비네트는 props 가 reducedMotion·onCue 뿐인 로컬 부품이다. e2e 기록(window.__mfTension)은 부르는 쪽(GameMap)이 onCue 로 붙인다"
    - "WorldStage.underlay 슬롯: 입력 면 뒤·이름표 층 앞에 DOM 순서로 깐다 (z-world 같은 층, 위쪽 가림막 z 2 와 이름표 z-tags 아래)"

key-files:
  created:
    - src/components/TensionVignette.tsx
  modified:
    - src/screens/GamePanel.tsx
    - src/screens/GameMap.tsx
    - src/components/WorldStage.tsx
    - src/styles/night.css
    - src/game/dayView.ts
    - docs/screen-map.md
    - test/client/nightMap.test.tsx
    - test/client/guide.test.tsx
    - test/client/nightChat.test.tsx
    - test/unit/dayStaticGuard.test.ts
    - test/unit/dayView.test.ts
    - test/unit/tensionStaticGuard.test.ts
  deleted:
    - src/components/NightPanel.tsx

key-decisions:
  - "큐 맥박 길이는 TENSION_BEAT_MS(1.3초) 한 바퀴로 하고, 피크 값은 CSS 변수 --mf-tension-peak 에 TENSION_CUE_PEAK 를 실어 상수 한 곳에서만 정한다"
  - "역할이 없는(role undefined) 산 사람의 밤은 시민 안내와 시민 어둠을 본다 (09-13 의 role 없는 산 viewer = nightCitizen 규칙과 맞춘다)"
  - "경찰·의사의 지도 고리는 그리지 않는다: 고른 칸 표시는 얼굴 목록 눌림이 맡는다 (UI-SPEC 318행)"

requirements-completed: [NIGHT-09, NIGHT-10]

metrics:
  duration: 약 50분
---

# Phase 9 Plan 15: 밤 시민 편 화면 (얼굴 목록·긴장 비네트) Summary

밤 산 경찰·의사는 아래 패널의 얼굴 목록에서 조사·보호 대상을 고르고, 시민·경찰·의사 셋은 같은 어둠 표식(`data-night-dark`)과 로컬 큐로만 뛰는 진홍 비네트를 본다. 8페이즈 밤 알약 패널(`NightPanel.tsx`)은 지웠다.

## TDD 기록

- **RED 1** (`7fa1f78`): 경찰·의사 얼굴 목록 시험 11건(묶음 이름·칸 이름·후보·재클릭·거절·끊김·후보 0명·시민 빈 패널)과 지도 이름표 임시 틀 skip 6건 교체. 대상 시험 "산 경찰: 묶음 …" 이 `[data-face-list]` aria-label 단언(undefined)에서 실패. `gsd check tdd-red-evidence`(tap-flat, 대상 시험만 실행) `RED_EVIDENCE_OK`. 의미 검사: 대상 시험이 실행되어 계획된 단언에서 실패, import·문법 오류 아님.
- **GREEN 1** (`c9535a2`): GamePanel 얼굴 목록, GameMap 밤 선택을 산 마피아로 좁힘, headerFor 역할별 밤 안내.
- **RED 2** (`6ec2f72`): dayStaticGuard 제거 목록 10개 + NightPanel.tsx 부재. 대상 시험이 NightPanel.tsx 에서 식별자 발견으로 실패. `RED_EVIDENCE_OK`.
- **GREEN 2** (`3784dbe`): NightPanel.tsx 삭제, night.css 알약·패널 규칙 제거, screen-map 행 교체, dayView 단위 시험 기대값 갱신.
- **RED 3** (`9bdee9b`): 비네트 시험 8건 + tensionStaticGuard 분리. 대상 시험 "큐 시각에 강한 맥박 클래스 …" 이 `is-beat` 단언(undefined)에서 실패. `RED_EVIDENCE_OK`.
- **GREEN 3** (`efdfd34`): TensionVignette, underlay 슬롯, 맥박 CSS, GameMap 장착.
- REFACTOR 커밋 없음.

## 검증

- `npm run typecheck`(tokens:check 포함) 성공, `npx vitest run --project unit` 74파일 2197 통과·1 skipped(기존, 이 계획과 무관), `--project client` 44파일 1448 통과.
- `git grep -F -e ".skip(" -e ".todo(" -- test` rc=1 (nightMap skip 6건 제거 완료). WINDOWS.md #6 `fixed` 처리.
- worker 프로젝트는 서버 코드를 건드리지 않아 돌리지 않았다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] headerFor 밤 안내를 Task 1 GREEN 에 앞당김**
- **Found during:** Task 1
- **Issue:** GamePanel 알약 분기를 지우면 경찰·의사·시민의 `[data-guide]`(알약 패널 제목)가 사라져 guide.test 가 깨진다. Task 2 까지 두면 중간 커밋에서 스위트가 깨진다.
- **Fix:** `DAY_COPY.nightHint*` 와 headerFor 역할 분기를 Task 1 GREEN(`c9535a2`)에 넣었다. Task 2 는 삭제와 가드가 남았다.
- **Files modified:** src/game/dayView.ts, test/client/guide.test.tsx

**2. [Rule 1 - Bug] 놓친 단위 시험 갱신**
- **Found during:** Task 2 GREEN 전 `--project unit`
- **Issue:** `test/unit/dayView.test.ts` 의 headerFor 시험 2건이 "경찰·의사·시민의 밤은 제목만" 을 기대했다. Task 1 GREEN 커밋(`c9535a2`) 시점에는 이 2건이 실패 상태였고 Task 2 GREEN(`3784dbe`)에서 고쳤다.
- **Files modified:** test/unit/dayView.test.ts

**3. [Rule 3 - Blocking] 거절 알림 연결 prop 추가**
- **Issue:** 얼굴 목록은 GamePanel 에서 pick 을 보내므로 GameMap 의 `pointSent` 를 거치지 않아 거절이 "지금은 고를 수 없어요" 로만 나온다 (계획의 "보내지 못했어요. 다시 해 보세요" 와 어긋남).
- **Fix:** GamePanel prop `nightPick` 을 지우고 `onNightPickSent` 를 더해 GameMap 이 `pointSent` 를 세운다.

**4. [Rule 1 - Bug] 8페이즈 시험 기대값 정리**
- nightMap 의 "산 사람 화면에는 남의 선택 고리가 없다" 가 경찰 고리 `[4]` 를 기대했으나 경찰 고리는 이 계획에서 그리지 않으므로 `[]` 로 고쳤다.

계획 범위 밖으로 둔 것: `scripts/e2e/flows.mjs` 의 NR2(NightPanel 알약 단언)는 09-22 E2E 계획 몫이다. night.css 의 v1.0 잔재(`.mf-morningcard`·`.mf-sceneintro`)와 어디서도 불러오지 않게 된 `src/styles/day.css`·`VERDICT_TEXT.candidateNone/votedSuffix` 는 12페이즈 일괄 점검에 맡긴다 (A4).

## Known Stubs

없음. 시민의 밤 아래 패널은 의도적으로 비어 있고 [유언] 행동 줄은 09-17 이 같은 패널에 더한다 (계획 A2).

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: e2e-global | src/screens/GameMap.tsx | `window.__mfTension`(큐 로컬 시각 배열) — `?e2e=1`·개발 빌드에서만 생기고 서버 정보를 담지 않는다. 일반 배포본에는 없음을 시험으로 고정 |

## Self-Check: PASSED

- 파일: TensionVignette.tsx 있음, NightPanel.tsx 없음.
- 커밋: 7fa1f78, c9535a2, 6ec2f72, 3784dbe, 9bdee9b, efdfd34 모두 HEAD 조상.
