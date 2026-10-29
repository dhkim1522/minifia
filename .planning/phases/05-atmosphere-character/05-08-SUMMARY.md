---
phase: 05-atmosphere-character
plan: 08
subsystem: pre-deploy-gate-docs
tags: [gate, e2e, decision-0038, handoff, docs, LOOK-01, CHAR-01, UX-01, UX-02, CONN-03]
status: complete

requires:
  - phase: 05-atmosphere-character
    provides: "05-01~05-07 의 클라이언트 변경(안내 문장·비네팅·밝아짐·압축·Wake Lock)과 E2E 새 검사·크기 고정 흐름"
provides:
  - "배포 전 로컬 게이트 결과: npm test 109 파일 2957건, typecheck·build 성공, 빌드 CSS 두 층 규칙, 로컬 전체 E2E 42작업 `E2E OK`(385초)"
  - "docs/decisions/0038-atmosphere-guide-wakelock.md: 5페이즈 결정(코드 기준), 어긋난 곳, 확인 대기 기본값 표"
  - "결정 0008 보완 절, architecture Wake Lock 줄, ROADMAP 5페이즈 노트, HANDOFF(5페이즈 배포 직전·실기기 ⑨~⑬)"
affects: [05-09]

actuals:
  tokens: 6000
  tasks: 3
  commits: 1
plan_head_before: 90ffb9f1f1f5decd2b1ff6d05751ff67192bdcc0
plan_head_after: 10ad1d722d613ec8f8aef191515ed75a728d23d6

tech-stack:
  added: []
  patterns:
    - "배포 직전 계획(04-34 선례): 로컬 전체 게이트 → 결정 기록 → HANDOFF → push. 배포는 다음 계획에서만"

key-files:
  created:
    - docs/decisions/0038-atmosphere-guide-wakelock.md
  modified:
    - docs/decisions/0008-2-5d-look.md
    - docs/architecture.md
    - .planning/ROADMAP.md
    - HANDOFF.md

key-decisions:
  - "압축 하한 0.77(UI-SPEC 권장 0.8, 05-04 첫 판 0.78)과 [테스트] 버튼 좁힘(사용자 결정)을 결정 0038 의 '코드와 UI-SPEC 이 어긋난 곳' 에 기록했다."
  - "OVERALL_LIMIT_MS 는 올리지 않았다: 전체 실행이 385초라 900초 한도에 닿지 않았다."

requirements-completed: []

completed: 2026-10-29
---

# Phase 5 Plan 08: 배포 전 로컬 게이트 · 결정 0038 · HANDOFF Summary

**배포 전 로컬 게이트(전체 시험·타입·빌드·빌드 CSS·로컬 전체 E2E)가 모두 초록이고 기준 수치는 그대로다. 5페이즈의 결정을 코드 기준으로 결정 0038 한 곳에 적고, 결정 0008·아키텍처·ROADMAP 에 연결했으며, HANDOFF 를 5페이즈 배포 직전 상태로 갱신해 개인 원격에 push 했다. 배포하지 않았다(05-09 몫).**

## 수행한 일

앱 코드는 바꾸지 않았다(게이트에서 고칠 결함이 나오지 않았다). 서버·와이어·의존성·에셋 변경 없음.

### Task 1 — 배포 전 로컬 게이트

| 검사 | 결과 |
|------|------|
| 사전 조건 | 05-01~05-07 SUMMARY 모두 있음. 05-06 "남은 일" 에 장면 높이와 무관한 고정 배치 실패 없음(D4 는 사용자 결정으로 해소) |
| `npm test` | 109 파일, 2957건 통과 (HANDOFF 6KB 시험 포함) |
| `npm run typecheck` | 종료 코드 0 (tokens:check, wrangler types, app·worker tsc) |
| `npm run build` | 성공 (`dist/client/assets/index-ClPC5wSF.css` 66.51 kB) |
| 빌드 CSS | 한 줄로 압축돼 `grep -c` 는 1. 규칙 원문 확인: `.mf-backdrop__vignette{pointer-events:none;background:var(--mf-vignette);position:absolute;inset:0}`, `.mf-morningglow{z-index:-1;pointer-events:none;background:var(--mf-glow);animation:mf-morningglow-out .3s linear var(--mf-morning-exit-delay,4.7s) forwards;position:absolute;inset:0}`, `.mf-morningglow--rise{…}` 모두 남음. `var(--mf-vignette)` 1·`var(--mf-glow)` 1·`pointer-events:none` 27 |
| 로컬 전체 E2E | `npm run dev` + `npm run e2e -- --url http://localhost:5173`, 대상 버전 `2026-10-29T10:30:43Z+90ffb9f`, 작업 42개, **마지막 줄 `E2E OK`, 실패 표 비어 있음, 385초**. 끝낸 뒤 dev 서버를 껐다 |
| 기준 수치 | `OVERLAP_EPS 0.5`·`TAP_MIN 44`·`ONE_LINE_FACTOR 1.6`·`FACE_RATIO 0.45`·`PANEL_H 157`·`HEADER_CONTRAST_MIN 4.5` 확인 명령 종료 코드 0, `APPROVED_RELAXATIONS` 길이 5 확인 명령 종료 코드 0 (E2E 시작 줄: M1·D3a/D3b·D4·D3b-5·P-PANEL-236) |

**로컬 전체 E2E 흐름 × 크기 (통과/전체)**

| 흐름 | 360x640 | 390x664 | 430x932 | 360x560 |
|------|---------|---------|---------|---------|
| lobby | 26/26 | 26/26 | 26/26 | 25/25 |
| citizen4 | 135/135 | 135/135 | 135/135 | 135/135 |
| police5 | 143/143 | 143/143 | 143/143 | 143/143 |
| mafia8 | 140/140 | 140/140 | 140/140 | 140/140 |
| doctor5 | 139/139 | 139/139 | 139/139 | 139/139 |
| spec4 | 52/52 | 52/52 | 52/52 | 52/52 |
| vote5 | 126/126 | 126/126 | 126/126 | 126/126 |
| noexec | 41/41 | 41/41 | 41/41 | 41/41 |
| result-c | 42/42 | 42/42 | 42/42 | 42/42 |
| result-m | 47/47 | 47/47 | 47/47 | 47/47 |

크기 고정 흐름: `pc` 1280x800 7/7(UX2-PC 홈·대기실·낮 통과), `wakelock` 360x640 2/2(WL1·WL2 통과). 간헐 실패가 없어 재실행은 하지 않았다. `OVERALL_LIMIT_MS`(900초)에 닿지 않아 올리지 않았다. 로컬 dev 는 CSS 를 압축하지 않으므로 CSS 에 기대는 검사의 최종 판정은 05-09 배포본 실행이 한다.

### Task 2 — 결정 0038 외

- `docs/decisions/0038-atmosphere-guide-wakelock.md`: 결정 7개(움직임 없음·CHAR-01 점검 / 전환 점검과 비네팅·밝아짐 상수 / 안내 문장·`data-guide`·`TIMELESS_PHASES` / 짧은 폰 압축과 [테스트] 버튼 좁힘 / 링크 참가 광장 / Wake Lock / E2E), "코드와 UI-SPEC 이 어긋난 곳", 알려진 한계, 확인 대기 표(P5-1~P5-8 + 체감·실기기 항목), 결과(되돌리기 비용). 상수·함수 이름은 코드와 같다(`NIGHT_VIGNETTE_STOPS`·`MORNING_GLOW_ALPHA`·`PHASE_GUIDE_FILL`·`TABLE_FIT_MIN_SCALE`·`useWakeLock` 등).
- 오케스트레이터가 넘긴 사실을 반영: 하한 0.77(이름표 상자 26, `f = (H − 26)/276.8`, 299 경계 불연속 약 2.6px, 5글자 이름표 상자 약 3px 겹칠 수 있고 알약은 안 겹침), [테스트] 버튼 88 → 44(장면 < 299, 계획 범위 밖 파일 `testtools.css`·`TestTools.tsx` 수정), 새 진동 없음·앱 전환 때 재검토, 링크 참가 화면 이름 말줄임·`모였어요` 줄 간격은 실기기 확인 목록.
- `docs/decisions/0008-2-5d-look.md` 끝에 `## 보완 (2026-10-29, 결정 0038)` 절(기존 본문은 지우지 않음), `docs/architecture.md` Wake Lock 줄에 훅·`RoomScreen`·결정 0038, `.planning/ROADMAP.md` 5페이즈 Notes 끝에 한 문장.

### Task 3 — HANDOFF · push

- `HANDOFF.md` 5,216바이트(6KB 이하), 세 구역 유지, 32자 이상 16진 문자열 0, `gsd-ui-phase 5` 0, `0038` 2회. 지금 상태 맨 위에 5페이즈 배포 직전 줄과 새 기본 크기 줄, 4페이즈 상태는 한 줄로 줄임. 확인 대기 1번에 ⑨ 비네팅 ⑩ 밝아짐 ⑪ Wake Lock ⑫ 짧은 폰 ⑬ 링크 참가 7명을 더했고 "통과 표시는 사람이 확인한 뒤에만" 유지, 2번에 결정 0038 기본값(P5-5~P5-8). 다음 할 일 첫 줄 "05-09 배포·배포본 검증".
- 커밋 `10ad1d7` `docs(05-08): decision 0038, handoff before deploy` 후 `git push origin main`(개인 SSH 원격 `git@github.com:dhkim1522/minifia.git`) 성공, `git log origin/main..HEAD` 비어 있음.

## 계획과 달라진 점

### 자동 수정한 것

없음 - 게이트에서 앱 결함이 나오지 않았다.

### 계획 문구와 다르게 한 것

1. **결정 0038 의 압축 하한은 0.77**이다. 계획 문구는 "하한 0.78" 이었지만 실제 코드(`TABLE_FIT_MIN_SCALE = 0.77`)와 05-04 의 후속 수정이 기준이라 코드대로 적고, 0.78 은 05-04 첫 판 값으로만 언급했다.
2. 결정 0038 에 오케스트레이터가 알려 준 05-04·05-06 의 사실(26px 이름표 상자, 299 경계 불연속, [테스트] 버튼 좁힘, 링크 참가 화면 사진 검토)을 계획 목록에 더해 적었다.

## 인증 게이트

없음. push 는 기존 개인 SSH 설정으로 성공했다.

## 알려진 스텁

없음.

## 위협 표면 점검

새 엔드포인트·인증 경로·파일 접근·스키마 변경 없음(문서와 게이트 실행뿐). T-05-17: HANDOFF 의 32자 이상 16진 문자열 0 확인, SUMMARY·결정 문서에 방 토큰·비밀 없음. T-05-18: 원격 URL 이 개인 저장소임을 확인했고 전역 git 설정·`gh auth setup-git` 을 건드리지 않았다. T-05-19: 기준 수치·`APPROVED_RELAXATIONS` 확인 명령 통과, 남은 실패 없음. T-05-SC 새 패키지 없음.

## 사람이 할 일 · 이어지는 계획

- 05-09: 사용자 go-ahead 뒤 개인 계정 배포 → 배포본 smoke·UAT·E2E. 로컬 dev 가 못 보는 CSS 압축 결과(두 층 규칙, `.mf-tt[data-compact]`, `360x560`)는 배포본이 확인한다.
- 실기기 확인(HANDOFF ①~⑬)은 모든 개발이 끝난 뒤 사용자가 한 번에 한다. 통과 표시한 항목은 없다.
- 요구사항 LOOK-01·CHAR-01·UX-01·UX-02·CONN-03 은 이 계획에서 완료 표시하지 않는다(05-09 배포본 판정 뒤).

## Self-Check: PASSED

- 만든 파일 `docs/decisions/0038-atmosphere-guide-wakelock.md`, 이 SUMMARY 존재 확인.
- 커밋 `10ad1d7` 이 HEAD 의 조상이고 origin/main 에 올라갔음을 확인.
- `commits: 1` 은 `git rev-list --count 90ffb9f..HEAD` 로 쟀다(이 SUMMARY 의 docs 커밋 전). `actuals.tokens` 는 변경 diff 추가 줄 23.9k 자 / 4.
