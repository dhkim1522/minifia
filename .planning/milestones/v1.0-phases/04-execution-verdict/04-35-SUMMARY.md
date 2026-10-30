---
phase: 04-execution-verdict
plan: 35
subsystem: deploy-and-deployed-verification
tags: [deploy, cloudflare, smoke, uat, e2e, lightningcss, backdrop-filter, VOTE-01, VOTE-02, VOTE-03, VOTE-04, COMM-03, CONN-02, END-01, END-02]
status: complete

requires:
  - phase: 04-execution-verdict
    provides: "04-01~04-34 서버 웨이브·화면 웨이브와 배포 직전 로컬 게이트(04-34)"
provides:
  - "서버 웨이브 + 화면 웨이브를 한 단위로 개인 Cloudflare 계정 Worker minifia 에 배포(최종 버전 2026-10-28T14:27:59Z+5dcd032)"
  - "배포본에서 smoke full 4·5·8명, uat-vote·uat-test-bots·uat-test-room·uat-day·uat-night, E2E 10흐름×3폭 통과"
  - "VOTE-01~04·COMM-03·CONN-02·END-01·END-02 완료 표시, ROADMAP 4페이즈 35/35 Complete"
  - "배포본 E2E 가 잡은 결함 수정: 소스의 backdrop-filter 접두 짝 선언을 빌드(lightningcss)가 접두만 남기던 문제"
affects: [실기기 확인(사람), /gsd-verify-work 4, 5페이즈]

actuals:
  tokens: 40000
  tasks: 3
  commits: 2
plan_head_before: 1e62c76a45c69aa6c7d20e1aae6918ec65a9b5ca
plan_head_after: 8575f0cf1473f7cdf5db41309d9fd4b1d435f25d

tech-stack:
  added: []
  patterns:
    - "CSS 접두 선언을 손으로 짝지어 쓰지 않는다: Vite 8 의 lightningcss 는 backdrop-filter 와 -webkit-backdrop-filter 가 함께 있으면 접두만 내보낸다. 소스엔 비접두 한 번, 접두는 빌드가 붙인다"
    - "소스 CSS 의 정적 시험만으로는 minify 결과를 못 지킨다: 단위 시험이 lightningcss 변환 결과를 직접 확인한다"

key-files:
  created: []
  modified:
    - src/styles/verdict.css
    - test/unit/verdictCss.test.ts
    - test/client/dayTable.test.tsx
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/phases/04-execution-verdict/04-VALIDATION.md
    - HANDOFF.md

key-decisions:
  - "Task 1(배포 go-ahead) 은 사용자가 방금 명시적으로 `지금 배포` 를 답해 deploy 로 해소됐다."
  - "배포본 E2E 실패(변론 흐림)는 앱 결함(Rule 1)으로 분류해 고치고 계획이 허락한 재배포 한 번만 했다. E2E 기준 수치는 낮추지 않았다."
  - "스모크 도착 편차 한도 500ms 는 낮추지도 올리지도 않았다. 같은 코드가 재실행에서 통과해 이 PC 네트워크 지터로 분류했고 실패 횟수를 그대로 적는다."

requirements-completed: [VOTE-01, VOTE-02, VOTE-03, VOTE-04, COMM-03, CONN-02, END-01, END-02]

duration: about 2h
completed: 2026-10-28
---

# Phase 4 Plan 35: 배포와 배포본 검증 Summary

**4페이즈 서버·화면 웨이브를 개인 Cloudflare 계정에 한 단위로 배포하고, 배포본 E2E 가 잡은 `backdrop-filter` 빌드 결함(lightningcss 가 접두만 남김)을 고쳐 재배포한 뒤 스모크·봇 UAT·E2E 10흐름×3폭이 모두 통과해 요구사항 8개를 닫았다.**

## 수행한 일

### Task 1 — 배포 go-ahead (체크포인트: decision)

사용자가 `지금 배포` 로 답했다. 결정은 `deploy` 로 해소했다.

### Task 2 — 개인 계정 배포와 배포본 스모크·UAT

- **OLD_VERSION:** `2026-10-26T10:02:03Z+51be751`
- **1차 배포:** `npm run deploy` 성공, Version ID `eb7a844a-00a5-444f-bbbe-37b88ac3d841`. 5초 간격 첫 확인에서 버전이 `2026-10-28T13:48:02Z+1e62c76` 으로 바뀜. 정적 에셋 `Cache-Control`: 해시 에셋 `public, max-age=31536000, immutable`, `/` 는 `public, max-age=0, must-revalidate` (smoke 의 캐시 헤더 단언은 로컬에서 불가했던 것, 배포본에서 확인됨).
- **2차(재배포 한 번):** 아래 결함 수정 뒤 `npm run deploy`, Version ID `e1e20e9b-6012-4fa3-9285-0acd1ee97b61`, 버전 `2026-10-28T14:27:59Z+5dcd032`. 배포된 CSS 에서 `-webkit-backdrop-filter` 와 `backdrop-filter` 가 둘 다 나옴을 확인.

### Task 3 — 배포본 E2E와 문서

E2E 와 문서 갱신은 아래 결과 뒤에 했다. 요구사항 체크는 배포본 검증이 모두 통과한 뒤에만 했다.

## 배포본 결과 (최종 버전 2026-10-28T14:27:59Z+5dcd032)

| 검사 | 결과 줄 |
|------|---------|
| smoke full 5명 (`--previous-version 2026-10-28T13:48:02Z+1e62c76`) | `SMOKE OK full code=0275 players=5 spread=0ms discSpread=24ms` |
| smoke full 8명 | `SMOKE OK full code=8286 players=8 spread=437ms discSpread=67ms` |
| smoke full 4명 | `SMOKE OK full code=0874 players=4 spread=9ms discSpread=3ms` |
| uat-vote | `48/48 OK`, 종료 코드 0 |
| uat-test-bots (`--previous-version` 1차 버전) | `46/46 통과 / UAT TEST-BOTS OK`, 0 |
| uat-test-room | `28/28 통과 / UAT TEST-ROOM OK`, 0 |
| uat-day 5명 | 16행 전부 통과(실패 0), 도착 차이 최대 44ms, 0 |
| uat-night 5명 | `36/36 통과`, 0 |
| E2E (`npm run e2e`, 대상 scripts/prod-url.txt) | 10흐름 × 360x640·390x664·430x932 전부 통과, `E2E OK`, 362초 |

E2E 흐름별 통과 항목(세 폭 동일): lobby 23/23, citizen4 115/115, police5 123/123, mafia8 120/120, doctor5 119/119, vote5 108/108, noexec 35/35, spec4 52/52, result-c 32/32, result-m 39/39. 실패 표는 비어 있다.

1차 배포 버전에서의 첫 묶음: uat-vote 48/48, uat-test-bots 46/46, uat-test-room 28/28, uat-day, uat-night 36/36 통과(재배포 전).

## 계획과 달라진 점

### 자동 수정한 결함

**1. [Rule 1 - Bug] 배포본에서 변론 흐림(`backdrop-filter`)이 Chrome 계열에서 사라짐**
- **발견:** Task 3 의 1차 배포본 E2E. 6건 실패(vote5·result-c 의 `defense` 단계 P5 × 세 폭): `어둡게 층 backdrop-filter "none" 에 blur(3px) 없음`. 로컬 E2E(dev 서버)는 통과했다.
- **원인:** `src/styles/verdict.css` 가 `backdrop-filter` 와 `-webkit-backdrop-filter` 를 한 규칙에 짝으로 썼는데, Vite 8 의 CSS minify(lightningcss)가 두 선언을 하나로 보고 접두 쪽만 내보냈다(배포 CSS 에서 확인, lightningcss 단독 실험으로 재현). Chrome 계열은 비접두를 읽으므로 안드로이드·데스크톱 Chrome 에서 흐림이 사라지는 실제 사용자 결함이었다. dev 서버는 minify 가 없어 04-33·04-34 의 로컬 E2E 는 이를 못 잡았다.
- **수정:** 소스에는 비접두 `backdrop-filter` 한 번만 쓰고 접두는 빌드가 붙이게 했다(`src/styles/verdict.css`). 04-28 의 "접두와 비접두는 짝" 단위 시험을 "비접두 한 번·손으로 쓴 접두 없음·lightningcss 변환 결과에 두 선언이 모두 남음" 으로 바꿨다(`test/unit/verdictCss.test.ts`). `test/client/dayTable.test.tsx` 의 CSS 문자열 단언도 맞췄다. 전체 `npm test` 102 파일 2777건 통과, typecheck 통과.
- **커밋:** `5dcd032` (`fix(04-35): …`)
- **재배포:** 계획이 허락한 한 번(이 승인의 연장). 이후 재배포는 하지 않았다.
- 기준 수치(흐림 3px 등)는 낮추지 않았다.

### 재실행이 필요했던 간헐 실패 (정직한 집계)

배포본 smoke·UAT 가 이 PC 에서 간헐적으로 실패했다. 서버 코드는 두 배포 사이에 CSS 외 변경이 없다.

| 검사 | 실패 | 성공까지 |
|------|------|----------|
| smoke 5명 | 1차 버전에서 병렬 1회(discussion 515ms)·단독 1회(dayAnnounce 583ms)·디버그 사본 1회(558ms). 2차 버전에서 607ms·1004ms | 1차 버전 2회 연속 통과(32ms·22ms), 2차 버전 1회 통과 |
| smoke 4명 | 1차 버전 509ms·569ms. 2차 버전 662ms | 1차 버전 통과(32ms), 2차 버전 통과(9ms) |
| smoke 8명 | 2차 버전: execTally 10초 한도 초과, 1109ms, 1629ms, execVote 100초 한도 초과, (계측 사본) 990ms | 2차 버전 여섯 번째 시도에 통과 (1차 버전은 첫 시도에 통과) |
| uat-day | 2차 버전: 병렬 실행 중 `1일차 discussion 70초 한도`, 단독 `2일차 claim 190초 한도` | 단독 재실행 두 번 통과 |
| uat-night | 2차 버전 병렬 실행 중 `2일차 아침 45초 한도` | 단독 재실행 통과 |

- **진단:** 서버는 `broadcast()` 에서 소켓을 한 루프로 동기 전송하고 전송 예외는 삼킨다. 계측한 사본(저장소엔 안 남김)으로 본 실패 하나는 소켓 하나의 `readyState` 가 CLOSED(3) 가 되어 그 클라이언트만 이후 프레임을 받지 못한 것이고(종료 코드는 못 잡음), 도착 편차 실패는 같은 순간 보낸 프레임 중 한 소켓만 500~1600ms 늦은 것이었다. 같은 시기 `ping minifia.dhplay.workers.dev` 가 170~345ms(표준편차 약 43ms)로 흔들렸고, 네트워크가 좋을 때는 같은 코드가 편차 0~125ms 로 통과했다. 이 PC 는 CPU 를 쓰는 외부 프로세스가 여럿이라(부하 평균 약 5) 클라이언트 쪽 영향도 배제하지 못한다. HANDOFF 에 이미 있던 "배포 직후 첫 실행의 간헐 실패(원인 미확인)" 와 같은 부류로 본다.
- **결론:** 한도(500ms)는 그대로 두었고, 최종 버전에서 계획이 요구한 검사가 모두 한 번 이상 통과했다. 원인은 **미확정**(이 PC 네트워크 가능성이 높지만 서버 쪽 소켓 종료를 배제하지 못함). HANDOFF 에 다른 네트워크에서 한 번 더 돌려 보라고 적었다.

### 건너뛴 것

- `npm run e2e -- --shots` 로 대표 사진을 눈으로 보는 선택 단계는 하지 않았다(계획에서 "필요하면"). 사진 확인은 실기기 확인 목록으로 남는다.
- smoke full 5명은 계획대로 `--previous-version` 을 줬고, 04-33 리뷰가 지적한 중복 실행(이미 04-34 가 로컬에서 돈 것)은 다시 돌리지 않았다. 배포본 검사만 돌았다.

## 인증 게이트

없음(Wrangler OAuth 로그인이 이미 되어 있었다).

## 알려진 스텁

없음.

## 위협 표면 점검

새 엔드포인트·인증 경로·파일 접근·스키마 변경 없음. 배포는 개인 계정의 Worker `minifia` 하나만 건드렸다(T-04-76). 배포 출력의 계정·버전 ID 외 비밀 값은 기록하지 않았고 HANDOFF 의 32자 이상 16진 문자열은 0건이다(T-04-77). 배포 직후 열린 방(최대 3시간)은 옛 번들로 남을 수 있으나 서버 웨이브가 옛 저장 방을 정규화하고 개발 단계라 영향 없음(T-04-78, 수용).

## 사람이 할 일

- 실기기 확인 목록(HANDOFF 의 8항목, 폰 2대 이상·360폭 포함)은 아직 사람이 확인하지 않았다. 통과 표시는 하지 않았다. 수치 조정 요청은 `src/game/verdict.ts` 상수 한 곳.
- 특히 ④의 흐림은 이번 결함 수정으로 Chrome 계열에서 처음으로 배포본에 적용됐다. 안드로이드 Chrome 과 iOS Safari 에서 눈으로 봐야 한다.

## Self-Check: PASSED

- 파일 존재: `src/styles/verdict.css`, `test/unit/verdictCss.test.ts`, `test/client/dayTable.test.tsx`, `HANDOFF.md`(4689바이트), `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `04-VALIDATION.md` 확인.
- 커밋 존재: `5dcd032`, `8575f0c` 가 HEAD 의 조상이다.
- REQUIREMENTS: 열린 8항목 0, `Complete` 추적표 8행, ROADMAP `35/35` 포함.
