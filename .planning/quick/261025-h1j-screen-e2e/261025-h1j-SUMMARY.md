---
phase: quick-261025-h1j
plan: 01
subsystem: test-tooling
tags: [e2e, playwright-core, screen-test, test-room]
requires:
  - quick-261025-f09 (테스트 방 방장 도구, 결정 0022)
  - quick-261025-fx1 (테스트 방 서버 봇, 결정 0024)
provides:
  - "`npm run e2e` — 시스템 Chrome 으로 배포본을 휴대폰 크기 셋에서 열어 실제 좌표를 검사하는 화면 E2E"
  - "결정 0025 (화면 E2E 도구)"
affects: [HANDOFF.md, docs/architecture.md]
tech-stack:
  added: ["playwright-core 1.64.1 (devDependency, exact pin, browser download none)"]
  patterns: ["브라우저 페이지가 방장 (minifia:session 주입)", "받은 state 프레임만 구독", "순수 규칙 lib.mjs + node:test"]
key-files:
  created:
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs
    - scripts/e2e/browser.mjs
    - scripts/e2e/flows.mjs
    - scripts/e2e/run.mjs
    - docs/decisions/0025-screen-e2e.md
  modified:
    - package.json
    - package-lock.json
    - .gitignore
    - docs/architecture.md
    - HANDOFF.md
decisions:
  - "결정 0025: 시스템 Chrome + playwright-core(dev 전용), 브라우저가 방장, 받은 프레임만 구독, 결함은 기록만"
  - "L3 '한 줄' 판정은 top 이 아니라 세로 가운데 비교(실행기 잘못 수정)"
  - "D3·M1 은 계획 기준(캐릭터 상자 위 45%) 그대로 두고 앱 결함 후보로 보고(사진으로 실제 가림 확인)"
metrics:
  duration: "약 25분(첫 RED 커밋 12:39 ~ push 12:53 +0900, 읽기·준비 포함 더 김)"
  completed: 2026-10-25
status: complete
commits: 5
plan_head_before: d5c8c08030c8b84c1be3fa7c155f39e3dfbcbdc7
plan_head_after: bc216497304fd31dca95e867ce0e4fac2bd9bb9f
actuals:
  tokens: 31000
  tasks: 3
  commits: 5
---

# Phase quick-261025-h1j Plan 01: 화면 E2E 자동 테스트 Summary

`npm run e2e` 한 줄로 배포본(또는 `--url` 로컬)을 시스템 Chrome 으로 360x640·390x664·430x932 에서 열어, 브라우저가 테스트 방 방장이 되어 실제 [테스트] 시트로 5개 흐름(lobby·police5·citizen4·mafia8·doctor5)을 돌고 좌표로 검사해 결과 표와 종료 코드(0/1/2)를 낸다. 배포본 한 번 실행은 68초, 결과 576줄(통과 504 · 실패 72), 준비 줄 S1~S4 는 모두 통과, 종료 코드 1 이었다. 앱 코드(src·worker·shared·test)는 바뀌지 않았다.

- 검사한 배포 버전: `2026-10-25T02:55:38Z+b4bed28` (`node scripts/smoke.mjs --prod --print-version`). 배포는 하지 않았다.
- 설치한 패키지: `playwright-core` **1.64.1** (정확한 버전, `^` 없음, dependencies 아님, install 스크립트·의존성 없음을 설치 직전에 `npm view` 로 다시 확인, 브라우저 내려받기 `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`).
- push: `d5c8c08..bc21649 main -> main` (SSH, 성공). `HEAD == origin/main` = `bc216497304fd31dca95e867ce0e4fac2bd9bb9f`.
- 걸린 시간(배포본 전체 실행): 68초. 한 크기(390x664) 다섯 흐름: 28초(수용 기준 300초 미만).

## 과제와 커밋

| 과제 | 커밋 | 내용 |
|---|---|---|
| 1 RED | `816b043` | `test(quick-261025-h1j): failing e2e helper tests` — node:test 25개, lib.mjs 는 빈 뼈대 |
| 1 GREEN(트레이서) | `65cec79` | `feat(...): e2e runner tracer with lobby flow` — playwright-core·`npm run e2e`·lib/browser/flows/run·.gitignore |
| 2 RED | `1bedb13` | `test(...): failing day-scene check rules` — 15개 실패(총 40) |
| 2 GREEN | `1f04b86` | `feat(...): e2e day, night, morning and records flows` — 흐름 넷, D/N/M/R/C 검사 |
| 3 문서 | `bc21649` | `docs(...): e2e results, decision 0025, handoff` — 결정 0025·architecture·HANDOFF(요약·실패 표), push |

### TDD 기록

- **RED(과제 1)**: `lib.mjs` 가 모듈 없음이면 `fixture_or_load_failure` 로 INVALID_RED 라서 빈 뼈대(export 만 있고 undefined 반환)를 함께 커밋했다. 25개 중 23개가 단언에서 실패, 대상 테스트 `parseArgs: 인자 없음은 기본값 세 크기`. `gsd check tdd-red-evidence` → `RED_EVIDENCE_OK / target_test_failed`. semanticAssessment: 뼈대 export 가 있어 대상 테스트가 실행되고 계획한 단언 경로에서 실패(TypeError 포함).
- **RED(과제 2)**: 40개 중 15개 실패, 대상 `isOneLine: 정확히 1.6배까지 한 줄`, `RED_EVIDENCE_OK`. 같은 방식의 뼈대.
- **GREEN**: 각각 40/40, 25/25 통과 후 커밋. REFACTOR 커밋 없음.
- 허용 목록 테스트가 `mf-tt`·`mf-phasebar`·`mf-dt__tag`·`mf-dt__seat` 를 허용 목록에서 빼지 못하게 막는다(U-05).

## 결과 (배포본 `2026-10-25T02:55:38Z+b4bed28`, 한 번 실행, 68초, 종료 코드 1, `E2E FAIL: 72개 실패`)

### 요약 표

```
흐름 | 크기 | 통과/전체
lobby | 360x640 | 11/11
citizen4 | 360x640 | 42/43
police5 | 360x640 | 38/51
lobby | 390x664 | 11/11
mafia8 | 360x640 | 39/44
doctor5 | 360x640 | 34/43
citizen4 | 390x664 | 42/43
police5 | 390x664 | 40/51
lobby | 430x932 | 11/11
mafia8 | 390x664 | 39/44
doctor5 | 390x664 | 34/43
police5 | 430x932 | 44/51
citizen4 | 430x932 | 42/43
mafia8 | 430x932 | 39/44
doctor5 | 430x932 | 38/43
```

### 실패 줄 분류 (72줄)

실패 표 72줄은 아래 "전체 결과 표" 와 같은 실행의 `## 실패` 구간이고, HANDOFF.md 에도 그대로 옮겼다. 분류:

| 분류 | ID | 줄 수 | 내용 |
|---|---|---|---|
| **알려진 결함(계획이 예상)** | D1 | 4 | 위쪽 제목 줄바꿈. `police5/claim` 360x640 **3줄**(사용자 보고와 같음), 390x664·430x932 2줄. 360x640 은 `police5/discussion` 도 2줄 |
| **알려진 결함(계획이 예상)** | D4 | 16 | [테스트] 버튼이 캐릭터 상자와 겹침. 5명판(police5·doctor5)의 자리 2 와, 360x640·390x664 의 모든 낮 장면 상태(각 8줄). 430x932·4명·8명판은 통과. 가장 큰 값은 360x640 `police5/claim`(가로 14.1px·세로 34.5px) |
| **새로 찾은 화면 결함** | M1 | 12 | 아침 카드가 뒷자리 캐릭터 얼굴(상자 위 45%)을 가림. 4·5·8명판 모든 크기. 사진(`--shots`)에서 뒷자리 머리가 카드 뒤로 가려지는 것이 확인됨. night-v1 SPEC 은 뒷자리 **이름표** 가림만 허용 |
| **새로 찾은 화면 결함** | D3 | 36 | 5·8명판에서 이웃 자리 이름표가 다른 자리 상자 위 45% 와 겹침(4명판은 통과, SPEC 도 4명 겹침 없음). 사진에서 8명판 이름표가 이웃 머리 일부를 덮는 것이 보인다. 5명판은 겹침이 상자 투명 여백 위주라 시각적 정도는 약하다 → 결함 후보, 사람이 사진으로 판단 |
| **새로 찾은 화면 결함(D1 의 결과)** | D7 | 3 | `police5` 에서 직업 공개 제목이 줄바꿈되어 테이블이 토론·밤·아침보다 약 20~29px 아래에 있다가 올라옴 |
| **새로 찾은 화면 결함(D1 의 결과)** | D2 | 1 | 360x640 `police5/claim` 에서 내 이름표가 장면 밖으로 나가 하단 패널과 겹침 |

판단 근거: M1·D3 는 사진으로 실제 가림을 확인해 "테스트 버그가 아니라 앱 결함 후보" 로 기록했고 기준(0.45·0.5px)은 바꾸지 않았다. D7·D2 는 D1 이 테이블을 아래로 밀어서 생기는 연쇄다. 앱 코드는 고치지 않았다(`git diff --quiet 72ddcb6 -- src worker shared test` 통과).

### 고친 실행기 쪽 잘못 (테스트 버그)

- **L3 '봇 줄 한 줄'**: 첫 실행에서 `lobby/sheet L3` 이 실패했다. 봇 줄은 `align-items: center` 라 [−](44)·글자(24)·[5명 채우기] 의 top 이 다른데 세로 가운데는 같다 — 판정을 top 차 ≤ 1 에서 **세로 가운데 차 ≤ 1** 로 고쳤다(줄바꿈이면 가운데가 크게 벌어지므로 '한 줄' 의 뜻은 그대로). 앱 결함이 아니라 측정 방식의 잘못이었다. 이 수정은 트레이서 커밋 `65cec79` 에 포함됐다.
- 그 밖의 실행기 수정 없음. D1·D4 의 기준(1.6배·0.5px)·허용 목록·흐름별 예외는 건드리지 않았다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] L3 한 줄 판정 측정 방식**
- **Found during:** 과제 1 트레이서 실행
- **Issue:** top 비교가 가운데 정렬된 줄에서 거짓 실패를 냄
- **Fix:** 세로 가운데 비교, 내용 칸에 가운데 값 표시
- **Files modified:** scripts/e2e/flows.mjs
- **Commit:** `65cec79`

**2. [Rule 3 - Blocking] RED 가 유효하려면 빈 뼈대가 필요**
- **Found during:** 과제 1 RED
- **Issue:** `lib.mjs` 없이는 모듈 로드 실패라 `INVALID_RED`(fixture_or_load_failure)
- **Fix:** 모든 export 를 가진 빈 `lib.mjs` 뼈대를 RED 커밋에 함께 넣어 대상 테스트가 단언에서 실패하게 함(계획 문구 "모듈 없음" 대신)
- **Commit:** `816b043`, `1bedb13`

**3. [계획 보강] 겹침 크기를 내용 칸에 표시**
- D3·D4·M1 의 실패 내용에 겹친 가로·세로 px 를 덧붙였다(사람이 사진과 비교하기 쉽게). 기준 수치는 그대로다. (과제 2 커밋 `1f04b86`)

**4. [계획 보강] 단계 넘기기 동안 시트를 열어 둠**
- 직업 공개(2초 낮 시작 발표) 경쟁을 피하려 `skipTo` 가 시트를 한 번 열고 연속으로 [다음 단계로 넘기기] 를 누른다(계획의 "시트 열기 → 넘기기" 와 같은 실제 버튼이다).

그 밖에는 계획대로 실행했다. 인증 게이트 없음. 패키지 설치는 정상(`npm view` 확인 통과).

## 사람이 봐야 하는 것

- 실제 iPhone Safari·Android Chrome 의 느낌(터치, 주소창 높이 변화, 시트 G-01-9), 애니메이션 부드러움, 여러 기기 타이밍(동시 공개·마피아 두 폰 실시간·시계 오프셋), gray-500 글자 가독성, 탈락 뒤 관전 화면, 5자 닉네임 아침 카드 줄바꿈.
- `npm run e2e -- --only police5 --sizes 360x640 --shots` 로 찍은 `scripts/e2e/out/police5-claim-360x640.png` 와 결과 표를 함께 보고 D1·D4 가 사진에서도 그렇게 보이는지, D3·M1 의 실제 가림 정도를 판단한다(계획의 backstop 확인).
- 결함 수정(D1·D4·D3·M1)은 화면 변경이라 Design 캔버스 시안·승인 후 별도 작업. 고친 뒤 `npm run e2e` 로 회귀 확인. 결정 0023(차례 주장)을 구현하면 `flows.mjs` 의 claim 상태를 함께 고친다.

## Known Stubs

없음(스텁·TODO 없음).

## Threat Flags

없음. 위협 모델 항목별: T-h1j-01 토큰은 출력·파일에 없다(받은 프레임만 구독, 보낸 프레임·추적·영상·HAR 없음, 모든 출력은 redact 함수 하나) · T-h1j-02 `http://example.com` 은 종료 코드 2 · T-h1j-03 외부 요청 G6 모든 상태 통과 · T-h1j-04 동시 3개·흐름 끝 정리 · T-h1j-05 `npm run build` 뒤 `dist` 의 playwright 문자열 0 · T-h1j-SC 설치 전 레지스트리 재확인.

## 수용 기준 확인

- `node --test scripts/e2e/lib.test.mjs` 40/40 통과 · 없는 `CHROME_PATH` → 종료 코드 2 와 안내 · `--url http://example.com` → 2 · 트레이서(`lobby` 390x664) S1·S2·L1·L4·L5·T1·T2 통과.
- package.json 정확한 버전 `1.64.1`(dependencies 아님), `"e2e": "node scripts/e2e/run.mjs"`, lock 에 `node_modules/playwright-core`, `.gitignore` 의 `scripts/e2e/out/`(`git check-ignore` 0), framereceived·addInitScript·minifia:session 있음, framesent·new WebSocket·tracing·recordVideo·recordHar 없음.
- `--shots` 로 `scripts/e2e/out/lobby-lobby-360x640.png` 생성, `--shots` 없이는 새 png 없음.
- 390x664 한 크기 다섯 흐름 검증 명령(계획의 시나리오 줄 18개·S1~S4 통과) 통과, 걸린 시간 28초.
- 배포본 전체 실행: 15개 작업(흐름 다섯 × 크기 셋) 결과 줄 모두 있음, 준비 줄 S1~S4 모두 통과, 종료 코드 1.
- `git diff --quiet 72ddcb6 -- src worker shared test` 통과(앱 코드 무변경). `HEAD == origin/main`.

## 전체 결과 표 (`scripts/e2e/out/last-run.txt` 에서 그대로)

```
시나리오 | 크기 | 항목 | 결과 | 내용
lobby/setup | 360x640 | S1 방장으로 연결 | 통과 | 
lobby/setup | 360x640 | S2 글꼴 Gowun Dodum | 통과 | 
lobby/lobby | 360x640 | G G 공통 검사 | 통과 | 
lobby/lobby | 360x640 | L1 [테스트] 버튼이 보임 | 통과 | 
lobby/lobby | 360x640 | L2 [테스트]가 다른 조작과 안 겹침 | 통과 | 
lobby/sheet | 360x640 | T1 테스트 시트 열림 | 통과 | 
lobby/sheet | 360x640 | G G 공통 검사 | 통과 | 
lobby/sheet | 360x640 | L3 봇 줄 한 줄·[−][+] 44px | 통과 | 
lobby/sheet | 360x640 | L4 5명 채우기 | 통과 | 
lobby/sheet | 360x640 | L5 [+]/[−] 로 숫자가 바뀜 | 통과 | 
lobby/sheet | 360x640 | T2 테스트 시트 닫힘 | 통과 | 
citizen4/setup | 360x640 | S1 방장으로 연결 | 통과 | 
citizen4/setup | 360x640 | S2 글꼴 Gowun Dodum | 통과 | 
citizen4/setup | 360x640 | S3 인원·지정 직업 | 통과 | 
citizen4/claim | 360x640 | G G 공통 검사 | 통과 | 
citizen4/claim | 360x640 | D1 위쪽 제목이 한 줄 | 통과 | 
citizen4/claim | 360x640 | D2 이름표가 장면 안·패널 밖 | 통과 | 
citizen4/claim | 360x640 | D3 이름표가 다른 얼굴을 안 가림 | 통과 | 
citizen4/claim | 360x640 | D4 [테스트]가 캐릭터와 안 겹침 | 통과 | 
citizen4/claim | 360x640 | D5 세로 스크롤 없음 | 통과 | 
citizen4/claim | 360x640 | D6 하단 패널 높이 157 | 통과 | 
citizen4/claim | 360x640 | D8 위쪽 바 버튼이 한 줄 | 통과 | 
citizen4/discussion | 360x640 | G G 공통 검사 | 통과 | 
citizen4/discussion | 360x640 | D1 위쪽 제목이 한 줄 | 통과 | 
citizen4/discussion | 360x640 | D2 이름표가 장면 안·패널 밖 | 통과 | 
citizen4/discussion | 360x640 | D3 이름표가 다른 얼굴을 안 가림 | 통과 | 
citizen4/discussion | 360x640 | D4 [테스트]가 캐릭터와 안 겹침 | 통과 | 
citizen4/discussion | 360x640 | D5 세로 스크롤 없음 | 통과 | 
citizen4/discussion | 360x640 | D6 하단 패널 높이 157 | 통과 | 
citizen4/discussion | 360x640 | D8 위쪽 바 버튼이 한 줄 | 통과 | 
citizen4/night | 360x640 | G G 공통 검사 | 통과 | 
citizen4/night | 360x640 | D1 위쪽 제목이 한 줄 | 통과 | 
citizen4/night | 360x640 | D2 이름표가 장면 안·패널 밖 | 통과 | 
citizen4/night | 360x640 | D3 이름표가 다른 얼굴을 안 가림 | 통과 | 
citizen4/night | 360x640 | D4 [테스트]가 캐릭터와 안 겹침 | 통과 | 
citizen4/night | 360x640 | D5 세로 스크롤 없음 | 통과 | 
citizen4/night | 360x640 | D6 하단 패널 높이 157 | 통과 | 
citizen4/night | 360x640 | D8 위쪽 바 버튼이 한 줄 | 통과 | 
citizen4/night | 360x640 | N1 역할별 하단 | 통과 | 
citizen4/night | 360x640 | N4 하단 안내 2줄·패널 안 | 통과 | 
citizen4/night | 360x640 | N2 자리를 누르면 선택 링 | 통과 | 
citizen4/morning | 360x640 | G G 공통 검사 | 통과 | 
citizen4/morning | 360x640 | D1 위쪽 제목이 한 줄 | 통과 | 
citizen4/morning | 360x640 | D2 이름표가 장면 안·패널 밖 | 통과 | 
citizen4/morning | 360x640 | D3 이름표가 다른 얼굴을 안 가림 | 통과 | 
citizen4/morning | 360x640 | D4 [테스트]가 캐릭터와 안 겹침 | 통과 | 
citizen4/morning | 360x640 | D5 세로 스크롤 없음 | 통과 | 
citizen4/morning | 360x640 | D6 하단 패널 높이 157 | 통과 | 
citizen4/morning | 360x640 | D8 위쪽 바 버튼이 한 줄 | 통과 | 
citizen4/morning | 360x640 | M1 아침 카드 허용 범위 | 실패 | 자리 1 얼굴과 겹침 (가로 34.4px·세로 4px); 자리 2 얼굴과 겹침 (가로 57.6px·세로 18.9px); 자리 3 얼굴과 겹침 (가로 34.4px·세로 4px)
citizen4/morning | 360x640 | M2 하단 '곧 낮 토론이 시작돼요' | 통과 | 
citizen4/table | 360x640 | D7 단계가 바뀌어도 테이블 그대로 | 통과 | 
citizen4/table | 360x640 | D9 4명 이름표 안 겹침 | 통과 | 
citizen4/setup | 360x640 | S4 단계 도달 | 통과 | 
police5/setup | 360x640 | S1 방장으로 연결 | 통과 | 
police5/setup | 360x640 | S2 글꼴 Gowun Dodum | 통과 | 
police5/setup | 360x640 | S3 인원·지정 직업 | 통과 | 
police5/claim | 360x640 | G G 공통 검사 | 통과 | 
police5/claim | 360x640 | D1 위쪽 제목이 한 줄 | 실패 | "낮 · 직업 공개" 3줄 (높이 86.4, 줄 높이 28.8)
police5/claim | 360x640 | D2 이름표가 장면 안·패널 밖 | 실패 | 자리 0 이름표가 장면 밖; 자리 0 이름표가 하단 패널과 겹침
police5/claim | 360x640 | D3 이름표가 다른 얼굴을 안 가림 | 실패 | 2→1 (가로 22.5px·세로 26.6px); 3→4 (가로 22.6px·세로 26.6px)
police5/claim | 360x640 | D4 [테스트]가 캐릭터와 안 겹침 | 실패 | 자리 2 캐릭터 상자와 겹침 (가로 14.1px·세로 34.5px)
police5/claim | 360x640 | D5 세로 스크롤 없음 | 통과 | 
police5/claim | 360x640 | D6 하단 패널 높이 157 | 통과 | 
police5/claim | 360x640 | D8 위쪽 바 버튼이 한 줄 | 통과 | 
police5/discussion | 360x640 | G G 공통 검사 | 통과 | 
police5/discussion | 360x640 | D1 위쪽 제목이 한 줄 | 실패 | "낮 · 토론" 2줄 (높이 57.6, 줄 높이 28.8)
police5/discussion | 360x640 | D2 이름표가 장면 안·패널 밖 | 통과 | 
police5/discussion | 360x640 | D3 이름표가 다른 얼굴을 안 가림 | 실패 | 2→1 (가로 22.5px·세로 26.6px); 3→4 (가로 22.6px·세로 26.6px)
police5/discussion | 360x640 | D4 [테스트]가 캐릭터와 안 겹침 | 실패 | 자리 2 캐릭터 상자와 겹침 (가로 14.1px·세로 25.5px)
police5/discussion | 360x640 | D5 세로 스크롤 없음 | 통과 | 
police5/discussion | 360x640 | D6 하단 패널 높이 157 | 통과 | 
police5/discussion | 360x640 | D8 위쪽 바 버튼이 한 줄 | 통과 | 
police5/discussion | 360x640 | C3 연장·넘기기 버튼 없음 | 통과 | 
police5/chat | 360x640 | C1 채팅 내역 모달 열림 | 통과 | 
police5/chat | 360x640 | G G 공통 검사 | 통과 | 
police5/chat | 360x640 | C2 채팅 내역 모달 닫힘 | 통과 | 
police5/night | 360x640 | G G 공통 검사 | 통과 | 
police5/night | 360x640 | D1 위쪽 제목이 한 줄 | 통과 | 
police5/night | 360x640 | D2 이름표가 장면 안·패널 밖 | 통과 | 
police5/night | 360x640 | D3 이름표가 다른 얼굴을 안 가림 | 실패 | 2→1 (가로 22.5px·세로 26.6px); 3→4 (가로 22.6px·세로 26.6px)
police5/night | 360x640 | D4 [테스트]가 캐릭터와 안 겹침 | 실패 | 자리 2 캐릭터 상자와 겹침 (가로 14.1px·세로 1.5px)
police5/night | 360x640 | D5 세로 스크롤 없음 | 통과 | 
police5/night | 360x640 | D6 하단 패널 높이 157 | 통과 | 
police5/night | 360x640 | D8 위쪽 바 버튼이 한 줄 | 통과 | 
police5/night | 360x640 | N1 역할별 하단 | 통과 | 
police5/night | 360x640 | N4 하단 안내 2줄·패널 안 | 통과 | 
police5/night | 360x640 | N5 모든 대상 자리를 누를 수 있음 | 통과 | 
police5/night | 360x640 | N2 자리를 누르면 선택 링 | 통과 | 
police5/morning | 360x640 | G G 공통 검사 | 통과 | 
police5/morning | 360x640 | D1 위쪽 제목이 한 줄 | 통과 | 
police5/morning | 360x640 | D2 이름표가 장면 안·패널 밖 | 통과 | 
police5/morning | 360x640 | D3 이름표가 다른 얼굴을 안 가림 | 실패 | 2→1 (가로 22.5px·세로 26.6px); 3→4 (가로 22.6px·세로 26.6px)
police5/morning | 360x640 | D4 [테스트]가 캐릭터와 안 겹침 | 실패 | 자리 2 캐릭터 상자와 겹침 (가로 14.1px·세로 1.5px)
police5/morning | 360x640 | D5 세로 스크롤 없음 | 통과 | 
police5/morning | 360x640 | D6 하단 패널 높이 157 | 통과 | 
police5/morning | 360x640 | D8 위쪽 바 버튼이 한 줄 | 통과 | 
police5/morning | 360x640 | M1 아침 카드 허용 범위 | 실패 | 자리 2 얼굴과 겹침 (가로 59px·세로 35.4px); 자리 3 얼굴과 겹침 (가로 59px·세로 35.4px)
police5/morning | 360x640 | M2 하단 '곧 낮 토론이 시작돼요' | 통과 | 
police5/morning | 360x640 | R1 [수사 기록] 점 | 통과 | 
police5/records | 360x640 | R2 시트에 기록 줄 | 통과 | 
police5/records | 360x640 | G G 공통 검사 | 통과 | 
police5/records | 360x640 | R3 시트 닫힘·점 꺼짐 | 통과 | 
police5/table | 360x640 | D7 단계가 바뀌어도 테이블 그대로 | 실패 | discussion 에서 테이블이 claim 와 다름 (48,274 264x108 ↔ 48,293.8 264x108); night 에서 테이블이 claim 와 다름 (48,269.2 264x108 ↔ 48,293.8 264x108); morning 에서 테이블이 claim 와 다름 (48,269.2 264x108 ↔ 48,293.8 264x108)
police5/setup | 360x640 | S4 단계 도달 | 통과 | 
lobby/setup | 390x664 | S1 방장으로 연결 | 통과 | 
lobby/setup | 390x664 | S2 글꼴 Gowun Dodum | 통과 | 
lobby/lobby | 390x664 | G G 공통 검사 | 통과 | 
lobby/lobby | 390x664 | L1 [테스트] 버튼이 보임 | 통과 | 
lobby/lobby | 390x664 | L2 [테스트]가 다른 조작과 안 겹침 | 통과 | 
lobby/sheet | 390x664 | T1 테스트 시트 열림 | 통과 | 
lobby/sheet | 390x664 | G G 공통 검사 | 통과 | 
lobby/sheet | 390x664 | L3 봇 줄 한 줄·[−][+] 44px | 통과 | 
lobby/sheet | 390x664 | L4 5명 채우기 | 통과 | 
lobby/sheet | 390x664 | L5 [+]/[−] 로 숫자가 바뀜 | 통과 | 
lobby/sheet | 390x664 | T2 테스트 시트 닫힘 | 통과 | 
mafia8/setup | 360x640 | S1 방장으로 연결 | 통과 | 
mafia8/setup | 360x640 | S2 글꼴 Gowun Dodum | 통과 | 
mafia8/setup | 360x640 | S3 인원·지정 직업 | 통과 | 
mafia8/claim | 360x640 | G G 공통 검사 | 통과 | 
mafia8/claim | 360x640 | D1 위쪽 제목이 한 줄 | 통과 | 
mafia8/claim | 360x640 | D2 이름표가 장면 안·패널 밖 | 통과 | 
mafia8/claim | 360x640 | D3 이름표가 다른 얼굴을 안 가림 | 실패 | 2→1 (가로 32.7px·세로 16.4px); 3→1 (가로 68.2px·세로 0.8px); 3→2 (가로 30.2px·세로 20.2px); 5→6 (가로 30.3px·세로 20.2px); 5→7 (가로 68.5px·세로 0.8px); 6→7 (가로 32.7px·세로 16.4px)
mafia8/claim | 360x640 | D4 [테스트]가 캐릭터와 안 겹침 | 통과 | 
mafia8/claim | 360x640 | D5 세로 스크롤 없음 | 통과 | 
mafia8/claim | 360x640 | D6 하단 패널 높이 157 | 통과 | 
mafia8/claim | 360x640 | D8 위쪽 바 버튼이 한 줄 | 통과 | 
mafia8/discussion | 360x640 | G G 공통 검사 | 통과 | 
mafia8/discussion | 360x640 | D1 위쪽 제목이 한 줄 | 통과 | 
mafia8/discussion | 360x640 | D2 이름표가 장면 안·패널 밖 | 통과 | 
mafia8/discussion | 360x640 | D3 이름표가 다른 얼굴을 안 가림 | 실패 | 2→1 (가로 32.7px·세로 16.4px); 3→1 (가로 68.2px·세로 0.8px); 3→2 (가로 30.2px·세로 20.2px); 5→6 (가로 30.3px·세로 20.2px); 5→7 (가로 68.5px·세로 0.8px); 6→7 (가로 32.7px·세로 16.4px)
mafia8/discussion | 360x640 | D4 [테스트]가 캐릭터와 안 겹침 | 통과 | 
mafia8/discussion | 360x640 | D5 세로 스크롤 없음 | 통과 | 
mafia8/discussion | 360x640 | D6 하단 패널 높이 157 | 통과 | 
mafia8/discussion | 360x640 | D8 위쪽 바 버튼이 한 줄 | 통과 | 
mafia8/night | 360x640 | G G 공통 검사 | 통과 | 
mafia8/night | 360x640 | D1 위쪽 제목이 한 줄 | 통과 | 
mafia8/night | 360x640 | D2 이름표가 장면 안·패널 밖 | 통과 | 
mafia8/night | 360x640 | D3 이름표가 다른 얼굴을 안 가림 | 실패 | 2→1 (가로 32.7px·세로 16.4px); 3→1 (가로 68.2px·세로 0.8px); 3→2 (가로 30.2px·세로 20.2px); 5→6 (가로 30.3px·세로 20.2px); 5→7 (가로 68.5px·세로 0.8px); 6→7 (가로 32.7px·세로 16.4px)
mafia8/night | 360x640 | D4 [테스트]가 캐릭터와 안 겹침 | 통과 | 
mafia8/night | 360x640 | D5 세로 스크롤 없음 | 통과 | 
mafia8/night | 360x640 | D6 하단 패널 높이 157 | 통과 | 
mafia8/night | 360x640 | D8 위쪽 바 버튼이 한 줄 | 통과 | 
mafia8/night | 360x640 | N1 역할별 하단 | 통과 | 
mafia8/night | 360x640 | N4 하단 안내 2줄·패널 안 | 통과 | 
mafia8/night | 360x640 | N5 모든 대상 자리를 누를 수 있음 | 통과 | 
mafia8/night | 360x640 | N3 마피아 자신·동료 탭 안 됨 | 통과 | 
mafia8/night | 360x640 | N2 자리를 누르면 선택 링 | 통과 | 
mafia8/morning | 360x640 | G G 공통 검사 | 통과 | 
mafia8/morning | 360x640 | D1 위쪽 제목이 한 줄 | 통과 | 
mafia8/morning | 360x640 | D2 이름표가 장면 안·패널 밖 | 통과 | 
mafia8/morning | 360x640 | D3 이름표가 다른 얼굴을 안 가림 | 실패 | 2→1 (가로 32.7px·세로 16.4px); 3→1 (가로 68.2px·세로 0.8px); 3→2 (가로 30.2px·세로 20.2px); 5→6 (가로 30.3px·세로 20.2px); 5→7 (가로 68.5px·세로 0.8px); 6→7 (가로 32.7px·세로 16.4px)
mafia8/morning | 360x640 | D4 [테스트]가 캐릭터와 안 겹침 | 통과 | 
mafia8/morning | 360x640 | D5 세로 스크롤 없음 | 통과 | 
mafia8/morning | 360x640 | D6 하단 패널 높이 157 | 통과 | 
mafia8/morning | 360x640 | D8 위쪽 바 버튼이 한 줄 | 통과 | 
mafia8/morning | 360x640 | M1 아침 카드 허용 범위 | 실패 | 자리 2 얼굴과 겹침 (가로 34.4px·세로 8.8px); 자리 3 얼굴과 겹침 (가로 59.7px·세로 35.8px); 자리 4 얼굴과 겹침 (가로 57.6px·세로 18.9px); 자리 5 얼굴과 겹침 (가로 59.7px·세로 35.8px); 자리 6 얼굴과 겹침 (가로 34.4px·세로 8.8px)
mafia8/morning | 360x640 | M2 하단 '곧 낮 토론이 시작돼요' | 통과 | 
mafia8/table | 360x640 | D7 단계가 바뀌어도 테이블 그대로 | 통과 | 
mafia8/setup | 360x640 | S4 단계 도달 | 통과 | 
doctor5/setup | 360x640 | S1 방장으로 연결 | 통과 | 
doctor5/setup | 360x640 | S2 글꼴 Gowun Dodum | 통과 | 
doctor5/setup | 360x640 | S3 인원·지정 직업 | 통과 | 
doctor5/claim | 360x640 | G G 공통 검사 | 통과 | 
doctor5/claim | 360x640 | D1 위쪽 제목이 한 줄 | 통과 | 
doctor5/claim | 360x640 | D2 이름표가 장면 안·패널 밖 | 통과 | 
doctor5/claim | 360x640 | D3 이름표가 다른 얼굴을 안 가림 | 실패 | 2→1 (가로 22.5px·세로 26.6px); 3→4 (가로 22.6px·세로 26.6px)
doctor5/claim | 360x640 | D4 [테스트]가 캐릭터와 안 겹침 | 실패 | 자리 2 캐릭터 상자와 겹침 (가로 14.1px·세로 1.5px)
doctor5/claim | 360x640 | D5 세로 스크롤 없음 | 통과 | 
doctor5/claim | 360x640 | D6 하단 패널 높이 157 | 통과 | 
doctor5/claim | 360x640 | D8 위쪽 바 버튼이 한 줄 | 통과 | 
doctor5/discussion | 360x640 | G G 공통 검사 | 통과 | 
doctor5/discussion | 360x640 | D1 위쪽 제목이 한 줄 | 통과 | 
doctor5/discussion | 360x640 | D2 이름표가 장면 안·패널 밖 | 통과 | 
doctor5/discussion | 360x640 | D3 이름표가 다른 얼굴을 안 가림 | 실패 | 2→1 (가로 22.5px·세로 26.6px); 3→4 (가로 22.6px·세로 26.6px)
doctor5/discussion | 360x640 | D4 [테스트]가 캐릭터와 안 겹침 | 실패 | 자리 2 캐릭터 상자와 겹침 (가로 14.1px·세로 1.5px)
doctor5/discussion | 360x640 | D5 세로 스크롤 없음 | 통과 | 
doctor5/discussion | 360x640 | D6 하단 패널 높이 157 | 통과 | 
doctor5/discussion | 360x640 | D8 위쪽 바 버튼이 한 줄 | 통과 | 
doctor5/night | 360x640 | G G 공통 검사 | 통과 | 
doctor5/night | 360x640 | D1 위쪽 제목이 한 줄 | 통과 | 
doctor5/night | 360x640 | D2 이름표가 장면 안·패널 밖 | 통과 | 
doctor5/night | 360x640 | D3 이름표가 다른 얼굴을 안 가림 | 실패 | 2→1 (가로 22.5px·세로 26.6px); 3→4 (가로 22.6px·세로 26.6px)
doctor5/night | 360x640 | D4 [테스트]가 캐릭터와 안 겹침 | 실패 | 자리 2 캐릭터 상자와 겹침 (가로 14.1px·세로 1.5px)
doctor5/night | 360x640 | D5 세로 스크롤 없음 | 통과 | 
doctor5/night | 360x640 | D6 하단 패널 높이 157 | 통과 | 
doctor5/night | 360x640 | D8 위쪽 바 버튼이 한 줄 | 통과 | 
doctor5/night | 360x640 | N1 역할별 하단 | 통과 | 
doctor5/night | 360x640 | N4 하단 안내 2줄·패널 안 | 통과 | 
doctor5/night | 360x640 | N5 모든 대상 자리를 누를 수 있음 | 통과 | 
doctor5/night | 360x640 | N2 자리를 누르면 선택 링 | 통과 | 
doctor5/morning | 360x640 | G G 공통 검사 | 통과 | 
doctor5/morning | 360x640 | D1 위쪽 제목이 한 줄 | 통과 | 
doctor5/morning | 360x640 | D2 이름표가 장면 안·패널 밖 | 통과 | 
doctor5/morning | 360x640 | D3 이름표가 다른 얼굴을 안 가림 | 실패 | 2→1 (가로 22.5px·세로 26.6px); 3→4 (가로 22.6px·세로 26.6px)
doctor5/morning | 360x640 | D4 [테스트]가 캐릭터와 안 겹침 | 실패 | 자리 2 캐릭터 상자와 겹침 (가로 14.1px·세로 1.5px)
doctor5/morning | 360x640 | D5 세로 스크롤 없음 | 통과 | 
doctor5/morning | 360x640 | D6 하단 패널 높이 157 | 통과 | 
doctor5/morning | 360x640 | D8 위쪽 바 버튼이 한 줄 | 통과 | 
doctor5/morning | 360x640 | M1 아침 카드 허용 범위 | 실패 | 자리 2 얼굴과 겹침 (가로 59px·세로 35.4px); 자리 3 얼굴과 겹침 (가로 59px·세로 35.4px)
doctor5/morning | 360x640 | M2 하단 '곧 낮 토론이 시작돼요' | 통과 | 
doctor5/table | 360x640 | D7 단계가 바뀌어도 테이블 그대로 | 통과 | 
doctor5/setup | 360x640 | S4 단계 도달 | 통과 | 
citizen4/setup | 390x664 | S1 방장으로 연결 | 통과 | 
citizen4/setup | 390x664 | S2 글꼴 Gowun Dodum | 통과 | 
citizen4/setup | 390x664 | S3 인원·지정 직업 | 통과 | 
citizen4/claim | 390x664 | G G 공통 검사 | 통과 | 
citizen4/claim | 390x664 | D1 위쪽 제목이 한 줄 | 통과 | 
citizen4/claim | 390x664 | D2 이름표가 장면 안·패널 밖 | 통과 | 
citizen4/claim | 390x664 | D3 이름표가 다른 얼굴을 안 가림 | 통과 | 
citizen4/claim | 390x664 | D4 [테스트]가 캐릭터와 안 겹침 | 통과 | 
citizen4/claim | 390x664 | D5 세로 스크롤 없음 | 통과 | 
citizen4/claim | 390x664 | D6 하단 패널 높이 157 | 통과 | 
citizen4/claim | 390x664 | D8 위쪽 바 버튼이 한 줄 | 통과 | 
citizen4/discussion | 390x664 | G G 공통 검사 | 통과 | 
citizen4/discussion | 390x664 | D1 위쪽 제목이 한 줄 | 통과 | 
citizen4/discussion | 390x664 | D2 이름표가 장면 안·패널 밖 | 통과 | 
citizen4/discussion | 390x664 | D3 이름표가 다른 얼굴을 안 가림 | 통과 | 
citizen4/discussion | 390x664 | D4 [테스트]가 캐릭터와 안 겹침 | 통과 | 
citizen4/discussion | 390x664 | D5 세로 스크롤 없음 | 통과 | 
citizen4/discussion | 390x664 | D6 하단 패널 높이 157 | 통과 | 
citizen4/discussion | 390x664 | D8 위쪽 바 버튼이 한 줄 | 통과 | 
citizen4/night | 390x664 | G G 공통 검사 | 통과 | 
citizen4/night | 390x664 | D1 위쪽 제목이 한 줄 | 통과 | 
citizen4/night | 390x664 | D2 이름표가 장면 안·패널 밖 | 통과 | 
citizen4/night | 390x664 | D3 이름표가 다른 얼굴을 안 가림 | 통과 | 
citizen4/night | 390x664 | D4 [테스트]가 캐릭터와 안 겹침 | 통과 | 
citizen4/night | 390x664 | D5 세로 스크롤 없음 | 통과 | 
citizen4/night | 390x664 | D6 하단 패널 높이 157 | 통과 | 
citizen4/night | 390x664 | D8 위쪽 바 버튼이 한 줄 | 통과 | 
citizen4/night | 390x664 | N1 역할별 하단 | 통과 | 
citizen4/night | 390x664 | N4 하단 안내 2줄·패널 안 | 통과 | 
citizen4/night | 390x664 | N2 자리를 누르면 선택 링 | 통과 | 
citizen4/morning | 390x664 | G G 공통 검사 | 통과 | 
citizen4/morning | 390x664 | D1 위쪽 제목이 한 줄 | 통과 | 
citizen4/morning | 390x664 | D2 이름표가 장면 안·패널 밖 | 통과 | 
citizen4/morning | 390x664 | D3 이름표가 다른 얼굴을 안 가림 | 통과 | 
citizen4/morning | 390x664 | D4 [테스트]가 캐릭터와 안 겹침 | 통과 | 
citizen4/morning | 390x664 | D5 세로 스크롤 없음 | 통과 | 
citizen4/morning | 390x664 | D6 하단 패널 높이 157 | 통과 | 
citizen4/morning | 390x664 | D8 위쪽 바 버튼이 한 줄 | 통과 | 
citizen4/morning | 390x664 | M1 아침 카드 허용 범위 | 실패 | 자리 1 얼굴과 겹침 (가로 26.4px·세로 4px); 자리 2 얼굴과 겹침 (가로 57.6px·세로 18.9px); 자리 3 얼굴과 겹침 (가로 26.4px·세로 4px)
citizen4/morning | 390x664 | M2 하단 '곧 낮 토론이 시작돼요' | 통과 | 
citizen4/table | 390x664 | D7 단계가 바뀌어도 테이블 그대로 | 통과 | 
citizen4/table | 390x664 | D9 4명 이름표 안 겹침 | 통과 | 
citizen4/setup | 390x664 | S4 단계 도달 | 통과 | 
police5/setup | 390x664 | S1 방장으로 연결 | 통과 | 
police5/setup | 390x664 | S2 글꼴 Gowun Dodum | 통과 | 
police5/setup | 390x664 | S3 인원·지정 직업 | 통과 | 
police5/claim | 390x664 | G G 공통 검사 | 통과 | 
police5/claim | 390x664 | D1 위쪽 제목이 한 줄 | 실패 | "낮 · 직업 공개" 2줄 (높이 57.6, 줄 높이 28.8)
police5/claim | 390x664 | D2 이름표가 장면 안·패널 밖 | 통과 | 
police5/claim | 390x664 | D3 이름표가 다른 얼굴을 안 가림 | 실패 | 2→1 (가로 19.7px·세로 26.6px); 3→4 (가로 19.7px·세로 26.6px)
police5/claim | 390x664 | D4 [테스트]가 캐릭터와 안 겹침 | 실패 | 자리 2 캐릭터 상자와 겹침 (가로 11.8px·세로 1.5px)
police5/claim | 390x664 | D5 세로 스크롤 없음 | 통과 | 
police5/claim | 390x664 | D6 하단 패널 높이 157 | 통과 | 
police5/claim | 390x664 | D8 위쪽 바 버튼이 한 줄 | 통과 | 
police5/discussion | 390x664 | G G 공통 검사 | 통과 | 
police5/discussion | 390x664 | D1 위쪽 제목이 한 줄 | 통과 | 
police5/discussion | 390x664 | D2 이름표가 장면 안·패널 밖 | 통과 | 
police5/discussion | 390x664 | D3 이름표가 다른 얼굴을 안 가림 | 실패 | 2→1 (가로 19.7px·세로 26.6px); 3→4 (가로 19.7px·세로 26.6px)
police5/discussion | 390x664 | D4 [테스트]가 캐릭터와 안 겹침 | 실패 | 자리 2 캐릭터 상자와 겹침 (가로 11.8px·세로 1.5px)
police5/discussion | 390x664 | D5 세로 스크롤 없음 | 통과 | 
police5/discussion | 390x664 | D6 하단 패널 높이 157 | 통과 | 
police5/discussion | 390x664 | D8 위쪽 바 버튼이 한 줄 | 통과 | 
police5/discussion | 390x664 | C3 연장·넘기기 버튼 없음 | 통과 | 
police5/chat | 390x664 | C1 채팅 내역 모달 열림 | 통과 | 
police5/chat | 390x664 | G G 공통 검사 | 통과 | 
police5/chat | 390x664 | C2 채팅 내역 모달 닫힘 | 통과 | 
police5/night | 390x664 | G G 공통 검사 | 통과 | 
police5/night | 390x664 | D1 위쪽 제목이 한 줄 | 통과 | 
police5/night | 390x664 | D2 이름표가 장면 안·패널 밖 | 통과 | 
police5/night | 390x664 | D3 이름표가 다른 얼굴을 안 가림 | 실패 | 2→1 (가로 19.7px·세로 26.6px); 3→4 (가로 19.7px·세로 26.6px)
police5/night | 390x664 | D4 [테스트]가 캐릭터와 안 겹침 | 실패 | 자리 2 캐릭터 상자와 겹침 (가로 11.8px·세로 1.5px)
police5/night | 390x664 | D5 세로 스크롤 없음 | 통과 | 
police5/night | 390x664 | D6 하단 패널 높이 157 | 통과 | 
police5/night | 390x664 | D8 위쪽 바 버튼이 한 줄 | 통과 | 
police5/night | 390x664 | N1 역할별 하단 | 통과 | 
police5/night | 390x664 | N4 하단 안내 2줄·패널 안 | 통과 | 
police5/night | 390x664 | N5 모든 대상 자리를 누를 수 있음 | 통과 | 
police5/night | 390x664 | N2 자리를 누르면 선택 링 | 통과 | 
police5/morning | 390x664 | G G 공통 검사 | 통과 | 
police5/morning | 390x664 | D1 위쪽 제목이 한 줄 | 통과 | 
police5/morning | 390x664 | D2 이름표가 장면 안·패널 밖 | 통과 | 
police5/morning | 390x664 | D3 이름표가 다른 얼굴을 안 가림 | 실패 | 2→1 (가로 19.7px·세로 26.6px); 3→4 (가로 19.7px·세로 26.6px)
police5/morning | 390x664 | D4 [테스트]가 캐릭터와 안 겹침 | 실패 | 자리 2 캐릭터 상자와 겹침 (가로 11.8px·세로 1.5px)
police5/morning | 390x664 | D5 세로 스크롤 없음 | 통과 | 
police5/morning | 390x664 | D6 하단 패널 높이 157 | 통과 | 
police5/morning | 390x664 | D8 위쪽 바 버튼이 한 줄 | 통과 | 
police5/morning | 390x664 | M1 아침 카드 허용 범위 | 실패 | 자리 2 얼굴과 겹침 (가로 59px·세로 35.4px); 자리 3 얼굴과 겹침 (가로 59px·세로 35.4px)
police5/morning | 390x664 | M2 하단 '곧 낮 토론이 시작돼요' | 통과 | 
police5/morning | 390x664 | R1 [수사 기록] 점 | 통과 | 
police5/records | 390x664 | R2 시트에 기록 줄 | 통과 | 
police5/records | 390x664 | G G 공통 검사 | 통과 | 
police5/records | 390x664 | R3 시트 닫힘·점 꺼짐 | 통과 | 
police5/table | 390x664 | D7 단계가 바뀌어도 테이블 그대로 | 실패 | discussion 에서 테이블이 claim 와 다름 (55,269.2 280x108 ↔ 55,298 280x108); night 에서 테이블이 claim 와 다름 (55,269.2 280x108 ↔ 55,298 280x108); morning 에서 테이블이 claim 와 다름 (55,269.2 280x108 ↔ 55,298 280x108)
police5/setup | 390x664 | S4 단계 도달 | 통과 | 
lobby/setup | 430x932 | S1 방장으로 연결 | 통과 | 
lobby/setup | 430x932 | S2 글꼴 Gowun Dodum | 통과 | 
lobby/lobby | 430x932 | G G 공통 검사 | 통과 | 
lobby/lobby | 430x932 | L1 [테스트] 버튼이 보임 | 통과 | 
lobby/lobby | 430x932 | L2 [테스트]가 다른 조작과 안 겹침 | 통과 | 
lobby/sheet | 430x932 | T1 테스트 시트 열림 | 통과 | 
lobby/sheet | 430x932 | G G 공통 검사 | 통과 | 
lobby/sheet | 430x932 | L3 봇 줄 한 줄·[−][+] 44px | 통과 | 
lobby/sheet | 430x932 | L4 5명 채우기 | 통과 | 
lobby/sheet | 430x932 | L5 [+]/[−] 로 숫자가 바뀜 | 통과 | 
lobby/sheet | 430x932 | T2 테스트 시트 닫힘 | 통과 | 
mafia8/setup | 390x664 | S1 방장으로 연결 | 통과 | 
mafia8/setup | 390x664 | S2 글꼴 Gowun Dodum | 통과 | 
mafia8/setup | 390x664 | S3 인원·지정 직업 | 통과 | 
mafia8/claim | 390x664 | G G 공통 검사 | 통과 | 
mafia8/claim | 390x664 | D1 위쪽 제목이 한 줄 | 통과 | 
mafia8/claim | 390x664 | D2 이름표가 장면 안·패널 밖 | 통과 | 
mafia8/claim | 390x664 | D3 이름표가 다른 얼굴을 안 가림 | 실패 | 2→1 (가로 30.3px·세로 16.4px); 3→1 (가로 68.2px·세로 0.8px); 3→2 (가로 27.8px·세로 20.2px); 5→6 (가로 27.9px·세로 20.2px); 5→7 (가로 68.5px·세로 0.8px); 6→7 (가로 30.4px·세로 16.4px)
mafia8/claim | 390x664 | D4 [테스트]가 캐릭터와 안 겹침 | 통과 | 
mafia8/claim | 390x664 | D5 세로 스크롤 없음 | 통과 | 
mafia8/claim | 390x664 | D6 하단 패널 높이 157 | 통과 | 
mafia8/claim | 390x664 | D8 위쪽 바 버튼이 한 줄 | 통과 | 
mafia8/discussion | 390x664 | G G 공통 검사 | 통과 | 
mafia8/discussion | 390x664 | D1 위쪽 제목이 한 줄 | 통과 | 
mafia8/discussion | 390x664 | D2 이름표가 장면 안·패널 밖 | 통과 | 
mafia8/discussion | 390x664 | D3 이름표가 다른 얼굴을 안 가림 | 실패 | 2→1 (가로 30.3px·세로 16.4px); 3→1 (가로 68.2px·세로 0.8px); 3→2 (가로 27.8px·세로 20.2px); 5→6 (가로 27.9px·세로 20.2px); 5→7 (가로 68.5px·세로 0.8px); 6→7 (가로 30.4px·세로 16.4px)
mafia8/discussion | 390x664 | D4 [테스트]가 캐릭터와 안 겹침 | 통과 | 
mafia8/discussion | 390x664 | D5 세로 스크롤 없음 | 통과 | 
mafia8/discussion | 390x664 | D6 하단 패널 높이 157 | 통과 | 
mafia8/discussion | 390x664 | D8 위쪽 바 버튼이 한 줄 | 통과 | 
mafia8/night | 390x664 | G G 공통 검사 | 통과 | 
mafia8/night | 390x664 | D1 위쪽 제목이 한 줄 | 통과 | 
mafia8/night | 390x664 | D2 이름표가 장면 안·패널 밖 | 통과 | 
mafia8/night | 390x664 | D3 이름표가 다른 얼굴을 안 가림 | 실패 | 2→1 (가로 30.3px·세로 16.4px); 3→1 (가로 68.2px·세로 0.8px); 3→2 (가로 27.8px·세로 20.2px); 5→6 (가로 27.9px·세로 20.2px); 5→7 (가로 68.5px·세로 0.8px); 6→7 (가로 30.4px·세로 16.4px)
mafia8/night | 390x664 | D4 [테스트]가 캐릭터와 안 겹침 | 통과 | 
mafia8/night | 390x664 | D5 세로 스크롤 없음 | 통과 | 
mafia8/night | 390x664 | D6 하단 패널 높이 157 | 통과 | 
mafia8/night | 390x664 | D8 위쪽 바 버튼이 한 줄 | 통과 | 
mafia8/night | 390x664 | N1 역할별 하단 | 통과 | 
mafia8/night | 390x664 | N4 하단 안내 2줄·패널 안 | 통과 | 
mafia8/night | 390x664 | N5 모든 대상 자리를 누를 수 있음 | 통과 | 
mafia8/night | 390x664 | N3 마피아 자신·동료 탭 안 됨 | 통과 | 
mafia8/night | 390x664 | N2 자리를 누르면 선택 링 | 통과 | 
mafia8/morning | 390x664 | G G 공통 검사 | 통과 | 
mafia8/morning | 390x664 | D1 위쪽 제목이 한 줄 | 통과 | 
mafia8/morning | 390x664 | D2 이름표가 장면 안·패널 밖 | 통과 | 
mafia8/morning | 390x664 | D3 이름표가 다른 얼굴을 안 가림 | 실패 | 2→1 (가로 30.3px·세로 16.4px); 3→1 (가로 68.2px·세로 0.8px); 3→2 (가로 27.8px·세로 20.2px); 5→6 (가로 27.9px·세로 20.2px); 5→7 (가로 68.5px·세로 0.8px); 6→7 (가로 30.4px·세로 16.4px)
mafia8/morning | 390x664 | D4 [테스트]가 캐릭터와 안 겹침 | 통과 | 
mafia8/morning | 390x664 | D5 세로 스크롤 없음 | 통과 | 
mafia8/morning | 390x664 | D6 하단 패널 높이 157 | 통과 | 
mafia8/morning | 390x664 | D8 위쪽 바 버튼이 한 줄 | 통과 | 
mafia8/morning | 390x664 | M1 아침 카드 허용 범위 | 실패 | 자리 2 얼굴과 겹침 (가로 26.4px·세로 8.8px); 자리 3 얼굴과 겹침 (가로 59.7px·세로 35.8px); 자리 4 얼굴과 겹침 (가로 57.6px·세로 18.9px); 자리 5 얼굴과 겹침 (가로 59.7px·세로 35.8px); 자리 6 얼굴과 겹침 (가로 26.4px·세로 8.8px)
mafia8/morning | 390x664 | M2 하단 '곧 낮 토론이 시작돼요' | 통과 | 
mafia8/table | 390x664 | D7 단계가 바뀌어도 테이블 그대로 | 통과 | 
mafia8/setup | 390x664 | S4 단계 도달 | 통과 | 
doctor5/setup | 390x664 | S1 방장으로 연결 | 통과 | 
doctor5/setup | 390x664 | S2 글꼴 Gowun Dodum | 통과 | 
doctor5/setup | 390x664 | S3 인원·지정 직업 | 통과 | 
doctor5/claim | 390x664 | G G 공통 검사 | 통과 | 
doctor5/claim | 390x664 | D1 위쪽 제목이 한 줄 | 통과 | 
doctor5/claim | 390x664 | D2 이름표가 장면 안·패널 밖 | 통과 | 
doctor5/claim | 390x664 | D3 이름표가 다른 얼굴을 안 가림 | 실패 | 2→1 (가로 19.7px·세로 26.6px); 3→4 (가로 19.7px·세로 26.6px)
doctor5/claim | 390x664 | D4 [테스트]가 캐릭터와 안 겹침 | 실패 | 자리 2 캐릭터 상자와 겹침 (가로 11.8px·세로 1.5px)
doctor5/claim | 390x664 | D5 세로 스크롤 없음 | 통과 | 
doctor5/claim | 390x664 | D6 하단 패널 높이 157 | 통과 | 
doctor5/claim | 390x664 | D8 위쪽 바 버튼이 한 줄 | 통과 | 
doctor5/discussion | 390x664 | G G 공통 검사 | 통과 | 
doctor5/discussion | 390x664 | D1 위쪽 제목이 한 줄 | 통과 | 
doctor5/discussion | 390x664 | D2 이름표가 장면 안·패널 밖 | 통과 | 
doctor5/discussion | 390x664 | D3 이름표가 다른 얼굴을 안 가림 | 실패 | 2→1 (가로 19.7px·세로 26.6px); 3→4 (가로 19.7px·세로 26.6px)
doctor5/discussion | 390x664 | D4 [테스트]가 캐릭터와 안 겹침 | 실패 | 자리 2 캐릭터 상자와 겹침 (가로 11.8px·세로 1.5px)
doctor5/discussion | 390x664 | D5 세로 스크롤 없음 | 통과 | 
doctor5/discussion | 390x664 | D6 하단 패널 높이 157 | 통과 | 
doctor5/discussion | 390x664 | D8 위쪽 바 버튼이 한 줄 | 통과 | 
doctor5/night | 390x664 | G G 공통 검사 | 통과 | 
doctor5/night | 390x664 | D1 위쪽 제목이 한 줄 | 통과 | 
doctor5/night | 390x664 | D2 이름표가 장면 안·패널 밖 | 통과 | 
doctor5/night | 390x664 | D3 이름표가 다른 얼굴을 안 가림 | 실패 | 2→1 (가로 19.7px·세로 26.6px); 3→4 (가로 19.7px·세로 26.6px)
doctor5/night | 390x664 | D4 [테스트]가 캐릭터와 안 겹침 | 실패 | 자리 2 캐릭터 상자와 겹침 (가로 11.8px·세로 1.5px)
doctor5/night | 390x664 | D5 세로 스크롤 없음 | 통과 | 
doctor5/night | 390x664 | D6 하단 패널 높이 157 | 통과 | 
doctor5/night | 390x664 | D8 위쪽 바 버튼이 한 줄 | 통과 | 
doctor5/night | 390x664 | N1 역할별 하단 | 통과 | 
doctor5/night | 390x664 | N4 하단 안내 2줄·패널 안 | 통과 | 
doctor5/night | 390x664 | N5 모든 대상 자리를 누를 수 있음 | 통과 | 
doctor5/night | 390x664 | N2 자리를 누르면 선택 링 | 통과 | 
doctor5/morning | 390x664 | G G 공통 검사 | 통과 | 
doctor5/morning | 390x664 | D1 위쪽 제목이 한 줄 | 통과 | 
doctor5/morning | 390x664 | D2 이름표가 장면 안·패널 밖 | 통과 | 
doctor5/morning | 390x664 | D3 이름표가 다른 얼굴을 안 가림 | 실패 | 2→1 (가로 19.7px·세로 26.6px); 3→4 (가로 19.7px·세로 26.6px)
doctor5/morning | 390x664 | D4 [테스트]가 캐릭터와 안 겹침 | 실패 | 자리 2 캐릭터 상자와 겹침 (가로 11.8px·세로 1.5px)
doctor5/morning | 390x664 | D5 세로 스크롤 없음 | 통과 | 
doctor5/morning | 390x664 | D6 하단 패널 높이 157 | 통과 | 
doctor5/morning | 390x664 | D8 위쪽 바 버튼이 한 줄 | 통과 | 
doctor5/morning | 390x664 | M1 아침 카드 허용 범위 | 실패 | 자리 2 얼굴과 겹침 (가로 59px·세로 35.4px); 자리 3 얼굴과 겹침 (가로 59px·세로 35.4px)
doctor5/morning | 390x664 | M2 하단 '곧 낮 토론이 시작돼요' | 통과 | 
doctor5/table | 390x664 | D7 단계가 바뀌어도 테이블 그대로 | 통과 | 
doctor5/setup | 390x664 | S4 단계 도달 | 통과 | 
police5/setup | 430x932 | S1 방장으로 연결 | 통과 | 
police5/setup | 430x932 | S2 글꼴 Gowun Dodum | 통과 | 
police5/setup | 430x932 | S3 인원·지정 직업 | 통과 | 
police5/claim | 430x932 | G G 공통 검사 | 통과 | 
police5/claim | 430x932 | D1 위쪽 제목이 한 줄 | 실패 | "낮 · 직업 공개" 2줄 (높이 57.6, 줄 높이 28.8)
police5/claim | 430x932 | D2 이름표가 장면 안·패널 밖 | 통과 | 
police5/claim | 430x932 | D3 이름표가 다른 얼굴을 안 가림 | 실패 | 2→1 (가로 19.7px·세로 26.6px); 3→4 (가로 19.7px·세로 26.6px)
police5/claim | 430x932 | D4 [테스트]가 캐릭터와 안 겹침 | 통과 | 
police5/claim | 430x932 | D5 세로 스크롤 없음 | 통과 | 
police5/claim | 430x932 | D6 하단 패널 높이 157 | 통과 | 
police5/claim | 430x932 | D8 위쪽 바 버튼이 한 줄 | 통과 | 
police5/discussion | 430x932 | G G 공통 검사 | 통과 | 
police5/discussion | 430x932 | D1 위쪽 제목이 한 줄 | 통과 | 
police5/discussion | 430x932 | D2 이름표가 장면 안·패널 밖 | 통과 | 
police5/discussion | 430x932 | D3 이름표가 다른 얼굴을 안 가림 | 실패 | 2→1 (가로 19.7px·세로 26.6px); 3→4 (가로 19.7px·세로 26.6px)
police5/discussion | 430x932 | D4 [테스트]가 캐릭터와 안 겹침 | 통과 | 
police5/discussion | 430x932 | D5 세로 스크롤 없음 | 통과 | 
police5/discussion | 430x932 | D6 하단 패널 높이 157 | 통과 | 
police5/discussion | 430x932 | D8 위쪽 바 버튼이 한 줄 | 통과 | 
police5/discussion | 430x932 | C3 연장·넘기기 버튼 없음 | 통과 | 
police5/chat | 430x932 | C1 채팅 내역 모달 열림 | 통과 | 
police5/chat | 430x932 | G G 공통 검사 | 통과 | 
police5/chat | 430x932 | C2 채팅 내역 모달 닫힘 | 통과 | 
police5/night | 430x932 | G G 공통 검사 | 통과 | 
police5/night | 430x932 | D1 위쪽 제목이 한 줄 | 통과 | 
police5/night | 430x932 | D2 이름표가 장면 안·패널 밖 | 통과 | 
police5/night | 430x932 | D3 이름표가 다른 얼굴을 안 가림 | 실패 | 2→1 (가로 19.7px·세로 26.6px); 3→4 (가로 19.7px·세로 26.6px)
police5/night | 430x932 | D4 [테스트]가 캐릭터와 안 겹침 | 통과 | 
police5/night | 430x932 | D5 세로 스크롤 없음 | 통과 | 
police5/night | 430x932 | D6 하단 패널 높이 157 | 통과 | 
police5/night | 430x932 | D8 위쪽 바 버튼이 한 줄 | 통과 | 
police5/night | 430x932 | N1 역할별 하단 | 통과 | 
police5/night | 430x932 | N4 하단 안내 2줄·패널 안 | 통과 | 
police5/night | 430x932 | N5 모든 대상 자리를 누를 수 있음 | 통과 | 
police5/night | 430x932 | N2 자리를 누르면 선택 링 | 통과 | 
police5/morning | 430x932 | G G 공통 검사 | 통과 | 
police5/morning | 430x932 | D1 위쪽 제목이 한 줄 | 통과 | 
police5/morning | 430x932 | D2 이름표가 장면 안·패널 밖 | 통과 | 
police5/morning | 430x932 | D3 이름표가 다른 얼굴을 안 가림 | 실패 | 2→1 (가로 19.7px·세로 26.6px); 3→4 (가로 19.7px·세로 26.6px)
police5/morning | 430x932 | D4 [테스트]가 캐릭터와 안 겹침 | 통과 | 
police5/morning | 430x932 | D5 세로 스크롤 없음 | 통과 | 
police5/morning | 430x932 | D6 하단 패널 높이 157 | 통과 | 
police5/morning | 430x932 | D8 위쪽 바 버튼이 한 줄 | 통과 | 
police5/morning | 430x932 | M1 아침 카드 허용 범위 | 실패 | 자리 2 얼굴과 겹침 (가로 59px·세로 35.4px); 자리 3 얼굴과 겹침 (가로 59px·세로 35.4px)
police5/morning | 430x932 | M2 하단 '곧 낮 토론이 시작돼요' | 통과 | 
police5/morning | 430x932 | R1 [수사 기록] 점 | 통과 | 
police5/records | 430x932 | R2 시트에 기록 줄 | 통과 | 
police5/records | 430x932 | G G 공통 검사 | 통과 | 
police5/records | 430x932 | R3 시트 닫힘·점 꺼짐 | 통과 | 
police5/table | 430x932 | D7 단계가 바뀌어도 테이블 그대로 | 실패 | discussion 에서 테이블이 claim 와 다름 (75,269.2 280x108 ↔ 75,298 280x108); night 에서 테이블이 claim 와 다름 (75,269.2 280x108 ↔ 75,298 280x108); morning 에서 테이블이 claim 와 다름 (75,269.2 280x108 ↔ 75,298 280x108)
police5/setup | 430x932 | S4 단계 도달 | 통과 | 
citizen4/setup | 430x932 | S1 방장으로 연결 | 통과 | 
citizen4/setup | 430x932 | S2 글꼴 Gowun Dodum | 통과 | 
citizen4/setup | 430x932 | S3 인원·지정 직업 | 통과 | 
citizen4/claim | 430x932 | G G 공통 검사 | 통과 | 
citizen4/claim | 430x932 | D1 위쪽 제목이 한 줄 | 통과 | 
citizen4/claim | 430x932 | D2 이름표가 장면 안·패널 밖 | 통과 | 
citizen4/claim | 430x932 | D3 이름표가 다른 얼굴을 안 가림 | 통과 | 
citizen4/claim | 430x932 | D4 [테스트]가 캐릭터와 안 겹침 | 통과 | 
citizen4/claim | 430x932 | D5 세로 스크롤 없음 | 통과 | 
citizen4/claim | 430x932 | D6 하단 패널 높이 157 | 통과 | 
citizen4/claim | 430x932 | D8 위쪽 바 버튼이 한 줄 | 통과 | 
citizen4/discussion | 430x932 | G G 공통 검사 | 통과 | 
citizen4/discussion | 430x932 | D1 위쪽 제목이 한 줄 | 통과 | 
citizen4/discussion | 430x932 | D2 이름표가 장면 안·패널 밖 | 통과 | 
citizen4/discussion | 430x932 | D3 이름표가 다른 얼굴을 안 가림 | 통과 | 
citizen4/discussion | 430x932 | D4 [테스트]가 캐릭터와 안 겹침 | 통과 | 
citizen4/discussion | 430x932 | D5 세로 스크롤 없음 | 통과 | 
citizen4/discussion | 430x932 | D6 하단 패널 높이 157 | 통과 | 
citizen4/discussion | 430x932 | D8 위쪽 바 버튼이 한 줄 | 통과 | 
citizen4/night | 430x932 | G G 공통 검사 | 통과 | 
citizen4/night | 430x932 | D1 위쪽 제목이 한 줄 | 통과 | 
citizen4/night | 430x932 | D2 이름표가 장면 안·패널 밖 | 통과 | 
citizen4/night | 430x932 | D3 이름표가 다른 얼굴을 안 가림 | 통과 | 
citizen4/night | 430x932 | D4 [테스트]가 캐릭터와 안 겹침 | 통과 | 
citizen4/night | 430x932 | D5 세로 스크롤 없음 | 통과 | 
citizen4/night | 430x932 | D6 하단 패널 높이 157 | 통과 | 
citizen4/night | 430x932 | D8 위쪽 바 버튼이 한 줄 | 통과 | 
citizen4/night | 430x932 | N1 역할별 하단 | 통과 | 
citizen4/night | 430x932 | N4 하단 안내 2줄·패널 안 | 통과 | 
citizen4/night | 430x932 | N2 자리를 누르면 선택 링 | 통과 | 
citizen4/morning | 430x932 | G G 공통 검사 | 통과 | 
citizen4/morning | 430x932 | D1 위쪽 제목이 한 줄 | 통과 | 
citizen4/morning | 430x932 | D2 이름표가 장면 안·패널 밖 | 통과 | 
citizen4/morning | 430x932 | D3 이름표가 다른 얼굴을 안 가림 | 통과 | 
citizen4/morning | 430x932 | D4 [테스트]가 캐릭터와 안 겹침 | 통과 | 
citizen4/morning | 430x932 | D5 세로 스크롤 없음 | 통과 | 
citizen4/morning | 430x932 | D6 하단 패널 높이 157 | 통과 | 
citizen4/morning | 430x932 | D8 위쪽 바 버튼이 한 줄 | 통과 | 
citizen4/morning | 430x932 | M1 아침 카드 허용 범위 | 실패 | 자리 1 얼굴과 겹침 (가로 26.4px·세로 4px); 자리 2 얼굴과 겹침 (가로 57.6px·세로 18.9px); 자리 3 얼굴과 겹침 (가로 26.4px·세로 4px)
citizen4/morning | 430x932 | M2 하단 '곧 낮 토론이 시작돼요' | 통과 | 
citizen4/table | 430x932 | D7 단계가 바뀌어도 테이블 그대로 | 통과 | 
citizen4/table | 430x932 | D9 4명 이름표 안 겹침 | 통과 | 
citizen4/setup | 430x932 | S4 단계 도달 | 통과 | 
mafia8/setup | 430x932 | S1 방장으로 연결 | 통과 | 
mafia8/setup | 430x932 | S2 글꼴 Gowun Dodum | 통과 | 
mafia8/setup | 430x932 | S3 인원·지정 직업 | 통과 | 
mafia8/claim | 430x932 | G G 공통 검사 | 통과 | 
mafia8/claim | 430x932 | D1 위쪽 제목이 한 줄 | 통과 | 
mafia8/claim | 430x932 | D2 이름표가 장면 안·패널 밖 | 통과 | 
mafia8/claim | 430x932 | D3 이름표가 다른 얼굴을 안 가림 | 실패 | 2→1 (가로 30.3px·세로 16.4px); 3→1 (가로 68.2px·세로 0.8px); 3→2 (가로 27.8px·세로 20.2px); 5→6 (가로 27.9px·세로 20.2px); 5→7 (가로 68.5px·세로 0.8px); 6→7 (가로 30.4px·세로 16.4px)
mafia8/claim | 430x932 | D4 [테스트]가 캐릭터와 안 겹침 | 통과 | 
mafia8/claim | 430x932 | D5 세로 스크롤 없음 | 통과 | 
mafia8/claim | 430x932 | D6 하단 패널 높이 157 | 통과 | 
mafia8/claim | 430x932 | D8 위쪽 바 버튼이 한 줄 | 통과 | 
mafia8/discussion | 430x932 | G G 공통 검사 | 통과 | 
mafia8/discussion | 430x932 | D1 위쪽 제목이 한 줄 | 통과 | 
mafia8/discussion | 430x932 | D2 이름표가 장면 안·패널 밖 | 통과 | 
mafia8/discussion | 430x932 | D3 이름표가 다른 얼굴을 안 가림 | 실패 | 2→1 (가로 30.3px·세로 16.4px); 3→1 (가로 68.2px·세로 0.8px); 3→2 (가로 27.8px·세로 20.2px); 5→6 (가로 27.9px·세로 20.2px); 5→7 (가로 68.5px·세로 0.8px); 6→7 (가로 30.4px·세로 16.4px)
mafia8/discussion | 430x932 | D4 [테스트]가 캐릭터와 안 겹침 | 통과 | 
mafia8/discussion | 430x932 | D5 세로 스크롤 없음 | 통과 | 
mafia8/discussion | 430x932 | D6 하단 패널 높이 157 | 통과 | 
mafia8/discussion | 430x932 | D8 위쪽 바 버튼이 한 줄 | 통과 | 
mafia8/night | 430x932 | G G 공통 검사 | 통과 | 
mafia8/night | 430x932 | D1 위쪽 제목이 한 줄 | 통과 | 
mafia8/night | 430x932 | D2 이름표가 장면 안·패널 밖 | 통과 | 
mafia8/night | 430x932 | D3 이름표가 다른 얼굴을 안 가림 | 실패 | 2→1 (가로 30.3px·세로 16.4px); 3→1 (가로 68.2px·세로 0.8px); 3→2 (가로 27.8px·세로 20.2px); 5→6 (가로 27.9px·세로 20.2px); 5→7 (가로 68.5px·세로 0.8px); 6→7 (가로 30.4px·세로 16.4px)
mafia8/night | 430x932 | D4 [테스트]가 캐릭터와 안 겹침 | 통과 | 
mafia8/night | 430x932 | D5 세로 스크롤 없음 | 통과 | 
mafia8/night | 430x932 | D6 하단 패널 높이 157 | 통과 | 
mafia8/night | 430x932 | D8 위쪽 바 버튼이 한 줄 | 통과 | 
mafia8/night | 430x932 | N1 역할별 하단 | 통과 | 
mafia8/night | 430x932 | N4 하단 안내 2줄·패널 안 | 통과 | 
mafia8/night | 430x932 | N5 모든 대상 자리를 누를 수 있음 | 통과 | 
mafia8/night | 430x932 | N3 마피아 자신·동료 탭 안 됨 | 통과 | 
mafia8/night | 430x932 | N2 자리를 누르면 선택 링 | 통과 | 
mafia8/morning | 430x932 | G G 공통 검사 | 통과 | 
mafia8/morning | 430x932 | D1 위쪽 제목이 한 줄 | 통과 | 
mafia8/morning | 430x932 | D2 이름표가 장면 안·패널 밖 | 통과 | 
mafia8/morning | 430x932 | D3 이름표가 다른 얼굴을 안 가림 | 실패 | 2→1 (가로 30.3px·세로 16.4px); 3→1 (가로 68.2px·세로 0.8px); 3→2 (가로 27.8px·세로 20.2px); 5→6 (가로 27.9px·세로 20.2px); 5→7 (가로 68.5px·세로 0.8px); 6→7 (가로 30.4px·세로 16.4px)
mafia8/morning | 430x932 | D4 [테스트]가 캐릭터와 안 겹침 | 통과 | 
mafia8/morning | 430x932 | D5 세로 스크롤 없음 | 통과 | 
mafia8/morning | 430x932 | D6 하단 패널 높이 157 | 통과 | 
mafia8/morning | 430x932 | D8 위쪽 바 버튼이 한 줄 | 통과 | 
mafia8/morning | 430x932 | M1 아침 카드 허용 범위 | 실패 | 자리 2 얼굴과 겹침 (가로 26.4px·세로 8.8px); 자리 3 얼굴과 겹침 (가로 59.7px·세로 35.8px); 자리 4 얼굴과 겹침 (가로 57.6px·세로 18.9px); 자리 5 얼굴과 겹침 (가로 59.7px·세로 35.8px); 자리 6 얼굴과 겹침 (가로 26.4px·세로 8.8px)
mafia8/morning | 430x932 | M2 하단 '곧 낮 토론이 시작돼요' | 통과 | 
mafia8/table | 430x932 | D7 단계가 바뀌어도 테이블 그대로 | 통과 | 
mafia8/setup | 430x932 | S4 단계 도달 | 통과 | 
doctor5/setup | 430x932 | S1 방장으로 연결 | 통과 | 
doctor5/setup | 430x932 | S2 글꼴 Gowun Dodum | 통과 | 
doctor5/setup | 430x932 | S3 인원·지정 직업 | 통과 | 
doctor5/claim | 430x932 | G G 공통 검사 | 통과 | 
doctor5/claim | 430x932 | D1 위쪽 제목이 한 줄 | 통과 | 
doctor5/claim | 430x932 | D2 이름표가 장면 안·패널 밖 | 통과 | 
doctor5/claim | 430x932 | D3 이름표가 다른 얼굴을 안 가림 | 실패 | 2→1 (가로 19.7px·세로 26.6px); 3→4 (가로 19.7px·세로 26.6px)
doctor5/claim | 430x932 | D4 [테스트]가 캐릭터와 안 겹침 | 통과 | 
doctor5/claim | 430x932 | D5 세로 스크롤 없음 | 통과 | 
doctor5/claim | 430x932 | D6 하단 패널 높이 157 | 통과 | 
doctor5/claim | 430x932 | D8 위쪽 바 버튼이 한 줄 | 통과 | 
doctor5/discussion | 430x932 | G G 공통 검사 | 통과 | 
doctor5/discussion | 430x932 | D1 위쪽 제목이 한 줄 | 통과 | 
doctor5/discussion | 430x932 | D2 이름표가 장면 안·패널 밖 | 통과 | 
doctor5/discussion | 430x932 | D3 이름표가 다른 얼굴을 안 가림 | 실패 | 2→1 (가로 19.7px·세로 26.6px); 3→4 (가로 19.7px·세로 26.6px)
doctor5/discussion | 430x932 | D4 [테스트]가 캐릭터와 안 겹침 | 통과 | 
doctor5/discussion | 430x932 | D5 세로 스크롤 없음 | 통과 | 
doctor5/discussion | 430x932 | D6 하단 패널 높이 157 | 통과 | 
doctor5/discussion | 430x932 | D8 위쪽 바 버튼이 한 줄 | 통과 | 
doctor5/night | 430x932 | G G 공통 검사 | 통과 | 
doctor5/night | 430x932 | D1 위쪽 제목이 한 줄 | 통과 | 
doctor5/night | 430x932 | D2 이름표가 장면 안·패널 밖 | 통과 | 
doctor5/night | 430x932 | D3 이름표가 다른 얼굴을 안 가림 | 실패 | 2→1 (가로 19.7px·세로 26.6px); 3→4 (가로 19.7px·세로 26.6px)
doctor5/night | 430x932 | D4 [테스트]가 캐릭터와 안 겹침 | 통과 | 
doctor5/night | 430x932 | D5 세로 스크롤 없음 | 통과 | 
doctor5/night | 430x932 | D6 하단 패널 높이 157 | 통과 | 
doctor5/night | 430x932 | D8 위쪽 바 버튼이 한 줄 | 통과 | 
doctor5/night | 430x932 | N1 역할별 하단 | 통과 | 
doctor5/night | 430x932 | N4 하단 안내 2줄·패널 안 | 통과 | 
doctor5/night | 430x932 | N5 모든 대상 자리를 누를 수 있음 | 통과 | 
doctor5/night | 430x932 | N2 자리를 누르면 선택 링 | 통과 | 
doctor5/morning | 430x932 | G G 공통 검사 | 통과 | 
doctor5/morning | 430x932 | D1 위쪽 제목이 한 줄 | 통과 | 
doctor5/morning | 430x932 | D2 이름표가 장면 안·패널 밖 | 통과 | 
doctor5/morning | 430x932 | D3 이름표가 다른 얼굴을 안 가림 | 실패 | 2→1 (가로 19.7px·세로 26.6px); 3→4 (가로 19.7px·세로 26.6px)
doctor5/morning | 430x932 | D4 [테스트]가 캐릭터와 안 겹침 | 통과 | 
doctor5/morning | 430x932 | D5 세로 스크롤 없음 | 통과 | 
doctor5/morning | 430x932 | D6 하단 패널 높이 157 | 통과 | 
doctor5/morning | 430x932 | D8 위쪽 바 버튼이 한 줄 | 통과 | 
doctor5/morning | 430x932 | M1 아침 카드 허용 범위 | 실패 | 자리 2 얼굴과 겹침 (가로 59px·세로 35.4px); 자리 3 얼굴과 겹침 (가로 59px·세로 35.4px)
doctor5/morning | 430x932 | M2 하단 '곧 낮 토론이 시작돼요' | 통과 | 
doctor5/table | 430x932 | D7 단계가 바뀌어도 테이블 그대로 | 통과 | 
doctor5/setup | 430x932 | S4 단계 도달 | 통과 | 
```

(결과 576줄: 통과 504 · 실패 72)

## Self-Check: PASSED

만든 파일 8개(lib·lib.test·browser·flows·run·결정 0025·package.json·package-lock.json)와 커밋 5개(`816b043`·`65cec79`·`1bedb13`·`1f04b86`·`bc21649`)가 모두 존재하고 HEAD 의 조상이다. `.planning/milestone.lock`(추적 안 됨)은 건드리지 않았다. PLAN·SUMMARY·STATE 는 커밋하지 않았다(오케스트레이터 몫).
