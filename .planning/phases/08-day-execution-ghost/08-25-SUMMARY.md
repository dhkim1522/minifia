---
phase: 08-day-execution-ghost
plan: "25"
subsystem: e2e-gallery-verification
tags: [e2e, gallery, G7-allowlist, local-green, perf-deferred]
status: complete

requires:
  - phase: 08-day-execution-ghost
    provides: 08-24 맵 게임 E2E 흐름 여섯 개와 browser.mjs 도우미(readGame·tapPick·chooseVerdict·pressEndDiscussion)
provides:
  - scripts/gallery.mjs — 맵 게임 화면 기준 한 판 경로(토론 → 토론 끝내기 → 지목 → 변론 → 찬반 → 처형 → 유령 → 밤 → 아침 → 결과), 인자 other|host, 환경 변수 GALLERY_URL
  - scripts/e2e/lib.mjs — TEXT_SIZE_ALLOW 에 .mv-badge__unit(득표 배지 단위 '표' 12px)
  - 로컬 서버 전체 E2E 'E2E OK'(452초, FAIL 0)와 전체 단위·타입·node --test·빌드 초록
affects: [08-26 문서·실기기 이월·배포·배포본 검증]

actuals:
  tokens: 9000
  tasks: 3
  commits: 2
plan_head_before: a5cba219cff9a0a1857678bbfc905b4ac56db9b7
plan_head_after: 429011444507d95c1968ab57ce688486c15695b7

key-decisions:
  - "dayload 렌더 측정은 이번 계획에서 하지 않는다(사용자 결정 2026-11-03): perf-run.mjs 에 --mode dayload 를 더하지 않았고 결과 JSON 도 만들지 않았다. 실기기 확인 묶음으로 미룬다"
  - "G7 '표' 12px 는 판정 문턱(14px)과 배지 CSS 를 그대로 두고 TEXT_SIZE_ALLOW 에 .mv-badge__unit 을 더해 푼다(사용자 결정 2026-11-03). 허용 선택자를 고정하는 lib.test.mjs 시험도 그에 맞춰 갱신"
  - "유령 이름표 글자 대비(불투명도 0.6, 약 1.9~2.5:1)는 앱을 바꾸지 않고 실기기 확인 목록으로 이월한다(사용자 결정 2026-11-03)"

requirements-completed: []

duration: 약 1시간
completed: 2026-11-03
---

# Phase 8 Plan 25: 갤러리·로컬 전체 초록 Summary

화면 갤러리를 맵 게임 화면 기준으로 고치고 G7 '표' 12px 허용을 더해, 로컬 서버 전체 E2E 가 'E2E OK'(FAIL 0)로 끝났다. 낮 렌더 측정(dayload)은 사용자 결정으로 실기기 확인 묶음에 미뤘다.

## 작업별 결과

| 작업 | 내용 | 결과 | 커밋 |
|------|------|------|------|
| 1 (트레이서) | perf-run --mode dayload + 결과 JSON | **미룸** — 사용자 결정 2026-11-03: 실기기 확인 묶음(deferred to the real-device check bundle). 모드·JSON 없음, `perf-run.mjs` 변경 없음. 6페이즈 게이트(55fps·끊김 5회)를 낮춘 것이 아니라 이 계획에서 재지 않았을 뿐이다 | - |
| 1 대체 | G7 허용: `.mv-badge__unit` 을 TEXT_SIZE_ALLOW 에 추가(이유: "득표 배지 단위 '표' 12px — v2.0 디자인 시스템 승인값(tokens.json·README, tokensV2.test 고정)"), 14px 문턱·배지 CSS 불변, 허용 선택자 시험 갱신 | day·ghost G7 줄 초록 | 34610f1 |
| 2 | gallery.mjs 맵 게임 화면 기준 재작성 | 로컬에서 mafia(other)·citizen(host) 두 판 촬영, 유령 화면(23-ghost) 포함 | 4290114 |
| 3 | 로컬 전체 E2E·전체 시험 | 아래 표 | (파일 변경 없음) |

### 갤러리(Task 2)

- 지운 도우미(voteAs·pickCandidate·inspectSeat·tapSeat)와 옛 단계 이름 대기를 제거했다. 경로: 낮 시작 → 토론(채팅·역할 카드) → 토론 끝내기 눌림 → 지목(이름표 누름, 배지·선두 점광) → 최후 변론 → 찬반(찬성) → 처형(a·b) → 유령(방장이 처형된 판) → 밤 임시 틀(역할 인자대로, 마피아 채팅·지목) → 아침 → 결과. `exitIfV1(ORIGIN)` 가드는 맨 앞 그대로다.
- 인자 `other|host` 를 더했다(host 이면 봇이 방장을 지목해 유령 화면이 찍힌다). `GALLERY_URL` 환경 변수로 로컬 서버 주소를 줄 수 있다(없으면 v2.0 배포 주소, v1.0 주소는 가드가 거부).
- 시민은 역할 카드에 '활동 기록' 탭이 없어 옛 코드에서는 카드가 열린 채 이후 모든 단계가 막혔다 — 탭이 없으면 건너뛰고 카드를 닫도록 고쳤다. 변론자 본인(방장 처형 판)은 찬반 버튼이 없어 그 단계는 버튼 없이 사진만 찍는다.
- 04-assigning(역할 배정 3초 창)은 이번 두 판에서 잡히지 않았다(옛 갤러리와 같은 시간 창 한계).

### 로컬 전체 검증(Task 3)

- 로컬 서버: 이 계획이 `npm run dev` 로 띄웠다(PID 59422). 검증 뒤 그 PID 와 자식을 끄고 포트 5173 이 비었음을 확인했다. 로드 평균은 측정 전 약 4.6.
- 전체 E2E: `npm run e2e -- --url http://localhost:5173` → 마지막 줄 **E2E OK**, 걸린 시간 452초(900초 이내, 나눠 돌리지 않음), FAIL 행 0.
- 단위·정적: vitest 135 파일 3674 통과(1 skipped 는 기존 스킵 — `git grep ".skip(\|.todo("` 는 0건), `npm run typecheck`(tokens:check·wrangler types·tsc 둘) 0, `node --test scripts/*.test.mjs scripts/e2e/lib.test.mjs` 195 통과 0 실패, `npx vite build` 성공, three 는 메인 번들 밖(three-in-main 0).

| 흐름 | 크기 | 결과 | 시간 |
|------|------|------|------|
| chat-lobby | 360x640·390x664·430x932·360x560·390x844·402x874 | OK | 4~5초 |
| lobby | 360x640·390x664·430x932·360x560·390x844·402x874 | OK | 7~9초 |
| chat-keyboard | 360x640·390x664·430x932·360x560·390x844·402x874 | OK | 6초 |
| world | 360x640·390x664·430x932·360x560·390x844·402x874 | OK | 10~16초 |
| day | 360x640·390x664·430x932·360x560·390x844·402x874 | OK | 20~21초 |
| ghost | 360x640·390x664·430x932·360x560·390x844·402x874 | OK | 15~20초 |
| chat-ime | 390x844 | OK | 5초 |
| noexec | 390x844 | OK | 18초 |
| chat-game | 390x844 | OK | 12초 |
| night-roles | 390x844 | OK | 33초 |
| result | 390x844 | OK | 34초 |
| pc | 1280x800 | OK | 9초 |
| wakelock | 360x640 | OK | 10초 |
| perfbudget | 390x844 | OK | 47초 |
| reconnect | 390x664 | OK | 289초 |

08-24 의 day 390x844 '밤 도착' 부하 시간 초과는 대기를 15초로 올린 뒤 전체 실행에서 다시 나지 않았다(day 390x844 20초 OK).

## 확인된 값 (판정 아님 — 08-26 실기기 확인 목록 이월용)

- **유령 이름표 글자 대비**(GH9, 불투명도 0.6): 다른 유령 이름표 약 1.91~2.46:1(4.5:1 미달), 한 크기에서 2.9~3:1. 내 이름표는 17:1 대. 앱은 바꾸지 않았다(사용자 결정 2026-11-03) — **08-26 이 실기기 확인 이월 목록에 적는다**. 이름표 면만 0.8 로 올리는 안은 사용자 결정 대기.
- 밤 이름표 위치가 -144..12 로 대부분 화면 밖(08-24 확인값) — 08-26 실기기 목록·9페이즈에서 다룬다.
- 8자 이름 이름표 가장자리 잘림(E8 #29, G2k 줄), NightPanel 144.8px 대 UI-SPEC 157 — 알려진 한계로 그대로.
- dayload(낮 전체 흐름 4배 감속 5분 fps) 측정 — 08-26 실기기 확인 묶음에 포함.
- perfbudget 계수(참고): 8명 로비 calls 33·triangles 38650, vote 스파이크 calls 60·pointLights 3(그리기 호출 120 이내).

## Deviations from Plan

### 사용자 결정으로 바뀐 것

**1. [사용자 결정] Task 1(dayload 측정) 미룸** — perf-run.mjs 와 결과 JSON 을 만들지 않았다. 계획 must_haves 의 측정 두 항목(측정 모드·55fps 판정)은 이 계획에서 충족되지 않고 실기기 확인 묶음으로 넘어간다.
**2. [사용자 결정] G7 허용 목록에 .mv-badge__unit 추가** (08-24 가 사용자 결정 대기로 둔 실패를 푼다). lib.test.mjs 의 선택자 고정 시험도 이 항목을 허용하도록 바꿨다.
**3. [사용자 결정] 유령 이름표 대비는 앱 변경 없이 이월.**

### Auto-fixed Issues

**1. [Rule 1 - Bug] 갤러리가 시민 역할 카드에서 멈춤**
- **Found during:** Task 2 (citizen 판 실행)
- **Issue:** '활동 기록' 탭이 없는 직업에서 탭 누름이 실패하면 역할 카드가 열린 채여서 이후 모든 단계의 조작이 막혔다.
- **Fix:** 탭 누름을 try 로 감싸 건너뛰고 카드는 항상 닫는다.
- **Files modified:** scripts/gallery.mjs
- **Commit:** 4290114

**2. [Rule 3 - Blocking] 갤러리가 배포 주소로만 열림**
- **Found during:** Task 2 검증
- **Issue:** ORIGIN 이 expectedOrigin() 하나뿐이라 로컬 서버로 확인할 수 없었다.
- **Fix:** 선택적 `GALLERY_URL` 환경 변수(v1.0 가드 통과 필수)를 더했다. deploy-target 시험 33개 통과.
- **Commit:** 4290114

### 범위 밖(손대지 않음)

- scripts/uat-vote.mjs·uat-night.mjs 의 닿지 않는 EXEC_VOTE_MS·EXECUTION_PHRASE_COUNT 복사본, src/styles/day.css 의 죽은 `.mf-dayscene`·`.mf-sceneintro` 규칙은 이 계획의 파일 범위(perf-run·gallery) 밖이라 남겼다. 08-26 정리 때 확인한다.

## Known Stubs

없음.

## Threat Flags

없음 — 새 네트워크·인증 경로 없음. gallery.mjs 의 GALLERY_URL 도 `exitIfV1` 가드를 거친다(T-08-58 유지). 패키지는 설치하지 않았다(T-08-SC).

## Self-Check: PASSED

- scripts/gallery.mjs, scripts/e2e/lib.mjs, scripts/e2e/lib.test.mjs 존재, 커밋 34610f1·4290114 가 HEAD 조상에 있음.
- `grep -E "pickCandidate|voteAs|inspectSeat|tapSeat" scripts/gallery.mjs` 0건, `exitIfV1(ORIGIN)` 1건.
