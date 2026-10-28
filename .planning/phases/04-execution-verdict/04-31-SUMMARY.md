---
phase: 04-execution-verdict
plan: 31
subsystem: verdict-e2e-browser-helpers
tags: [e2e, browser.mjs, readVerdict, readTokenColors, setBotVote, voteAs, pickCandidate, sampleSeries, armVerdictWatch, leaveFromResult, snapshot-contract, VOTE-01, VOTE-02, VOTE-03, VOTE-04, COMM-03, CONN-02, END-01, END-02]
status: complete

requires:
  - phase: 04-execution-verdict
    provides: "04-29·04-30 의 처형 구간 스냅숏 계약(lib.mjs 머리)과 P1~P10 순수 검사, 04-16~04-26 화면 DOM, 04-17 테스트 시트의 봇 투표 그룹"
provides:
  - "readVerdict(page, colors) — 계약 모양(bottom·dt·intro·voidCard·execCard·card·reveal·crimsonNew·crimsonScreen·result)을 한 번의 evaluate 로 읽는다. 요소가 없으면 0·\"\"·[]·null"
  - "readTokenColors(page) — {crimson:[300,400,500,700], gray:[300,500,700], amber} 를 브라우저가 계산한 rgb 문자열로. 토큰이 없으면 던진다"
  - "collectSnapshot 후광 측정이 mf-figure--halo-amber 를 센다(cls amber). 흰·진홍 값은 그대로"
  - "setBotVote({exec,pick})·voteAs(찬성|반대)·pickCandidate(seat)·waitPhaseIn(phases)·sampleSeries({durationMs,stepMs,take})·armVerdictWatch/readVerdictWatch·leaveFromResult·rebaseSeries"
affects: [04-32 (vote5·기존 여섯 흐름 적응), 04-33 (noexec·spec4·result-c·result-m), 04-35 (배포본 E2E)]

actuals:
  tokens: 5400
  tasks: 2
  commits: 3
plan_head_before: e95e65bc0420c54b06a6fbaf8941c05446579023
plan_head_after: b265ab3f7f0d79c4226ea24dd99b981da4fddb1e

tech-stack:
  added: []
  patterns:
    - "읽기는 한 번의 page.evaluate, 조작은 클릭 뒤 추적 view 가 값을 반영할 때까지 기다린다(chooseRole 선례), 시간 초과는 SetupError"
    - "짧은 카드(1.6초)는 폴링 대신 MutationObserver 로 처음·사라진 시각을 붙잡는다(armIntroWatch 선례). 표본의 t 는 page 시계 now 로 카드 도착 기준에 환산한다(rebaseSeries)"
    - "색은 토큰에서 읽는다(스크립트에 값 없음). 진홍 판정은 계산된 색 함수(rgb·color(srgb)·oklab·oklch)를 8비트 sRGB 로 바꿔 ±2 로 비교"

key-files:
  created: []
  modified:
    - scripts/e2e/browser.mjs

key-decisions:
  - "setBotVote 는 프로토콜 값을 받는다: exec = random|yes|no, pick = random|host|other. 칩 라벨(무작위·모두 찬성·모두 반대 / 무작위·방장·방장 아닌 사람)은 안에서 바꾼다. 처형 투표 칩을 먼저 누르고 서버 반영을 확인한 뒤 후보 선택 칩을 누른다(두 번째 클릭이 첫 값을 되돌리지 않게)"
  - "중앙 좌석(dt.center)은 클래스가 아니라 어둡게 층(.mf-dt__dim--verdict) z 보다 z-index 가 높은 좌석으로 찾는다. 어둡게 층이 없으면 center 는 null"
  - "무효 카드 테두리는 루트(.mf-vintro--void, 테두리 없음)가 아니라 카드 면 .mf-vintro__face 의 border-top-color 를 읽는다"
  - "crimson 토큰을 받지 못하면 crimsonNew·crimsonScreen 은 0 이 아니라 null — 0 이면 셀 수 없는데도 `진홍 0` 검사를 통과한다(lib 은 null 을 측정값 없음으로 실패시킨다)"
  - "계약 밖 덧붙임 두 가지: result.stage(neutral|flip|done)와 최상위 now(page 시계). 계약 필드의 이름·단위는 바꾸지 않았다"
  - "readVerdict 는 결과 화면에서 [처음으로] 를 가까운 쪽으로 즉시 스크롤해 뷰포트 안·맨 위 요소인지로 reachedButton 을 정한다(읽기 끝에 한 번, 그 뒤 화면 위치가 바뀐다)"

requirements-completed: []  # VOTE-01·02·03·04, COMM-03, CONN-02, END-01·02 는 04-35 의 배포본 검증 뒤에 체크한다(HANDOFF·사용자 지시)

coverage:
  - id: C1
    description: "readVerdict 가 실제 화면에서 계약 필드를 같은 이름·단위로 읽고, 읽은 값을 04-29·04-30 순수 검사에 넣으면 정상 화면은 통과한다 (VOTE-01~04, COMM-03, END-01, END-02)"
    requirement: "VOTE-01"
    verification:
      - kind: manual_procedural
        ref: "로컬 npm run dev 의 실제 방(390x664)에서 임시 실행(저장소에 남기지 않음): execVote·candidateVote 둘·defense(남의 변론/후보 본인)·execution(살아 있는/처형된 viewer)·ended(시민 승)를 readVerdict 로 읽어 voteChecks P1·candidateChecks P3·defenseChecks P5·executionChecks P6·colorRuleChecks·resultChecks P8·placementChecks P10(비공개 단계) 통과. introChecks P2·voidCardChecks P7(rebaseSeries 로 환산)·revealChecks P4(자기 표 포함 합) 통과"
        status: pass
    human_judgment: false
  - id: C2
    description: "조작 도우미(setBotVote·voteAs·pickCandidate·waitPhaseIn·sampleSeries·armVerdictWatch·leaveFromResult)가 실제 방에서 서버 반영까지 확인하며 동작한다"
    requirement: "VOTE-02"
    verification:
      - kind: manual_procedural
        ref: "임시 실행: setBotVote 다섯 조합(yes/host·random/other·no/random·random/random 두 번 → 마지막 둘은 testBotVote 키 없음)·잘못된 값 거부, voteAs 찬성→반대→찬성(인트로 카드 뒤에서 클릭 통과), pickCandidate, 단계 이동 전 과정, 처형 무효 카드 도착(armVerdictWatch 1604ms 간격 확인), leaveFromResult 로 결과→입구, sampleSeries 상한 거부"
        status: pass
    human_judgment: false
  - id: C3
    description: "기존 lobby 흐름과 단위 시험이 그대로 통과한다 (기존 도우미 불변)"
    requirement: "VOTE-01"
    verification:
      - kind: unit
        ref: "node --check scripts/e2e/browser.mjs · node --test scripts/e2e/lib.test.mjs scripts/tsc-scoped.test.mjs (151건) · npm test (102 파일 2765건) · npm run typecheck · 로컬 npm run e2e -- --url http://localhost:5173 --only lobby (세 폭 23/23)"
        status: pass
    human_judgment: false
  - id: C4
    description: "공개 단계의 칩이 이름표와 겹치지 않는다(P10) — 실제 화면에서는 겹친다 (UI-SPEC 15.3 P10)"
    requirement: "VOTE-02"
    verification:
      - kind: manual_procedural
        ref: "임시 실행: 5명판 세 폭, 8명판 세 폭 모두 공개 단계에서 placementChecks 실패(칩 자리 1 ↔ 앞줄 이름표). 아래 `실제 화면에서 계약이 안 맞은 곳` 7번과 deferred-items.md"
        status: fail
    human_judgment: false
---

# Phase 4 Plan 31: E2E 브라우저 도우미 readVerdict 와 조작·관찰·표본 Summary

**`browser.mjs` 에 처형 구간을 한 번의 evaluate 로 읽는 `readVerdict`·`readTokenColors` 와, 봇 투표 고정·찬성/반대·후보 선택·카드 관찰자·시계열 표본·결과 화면 나가기 도우미를 만들고 후광 측정에 앰버를 더했다. 04-29·04-30 계약이 처음으로 실제 DOM 과 만났고, 계약 필드 대부분이 그대로 맞았으며 어긋난 곳은 아래와 같이 풀었다.**

## 한 일

**Task 1 — readVerdict·readTokenColors·앰버 후광** — `3f0fa9b`, 보강 `b265ab3`
- `readVerdict(page, colors)`: 하단 패널(제목·안내·집계·알약·버튼 목록·높이), 낮 테이블(`textHits`·후광 img 종류·좌석 버튼 `pickable`/`pressed`/읽기 이름·유령 자리·역할 그림/글자·중앙 좌석·다른 자리 최대 z·어둡게 층·원뿔·장면/헤더/패널 사각형), 인트로·처형 무효·처형 카드, 공개 화살표·칩·이름표, 진홍 요소 수, 결과 화면을 한 evaluate 로 읽는다.
- `readTokenColors(page)`: 진홍 4·회색 3·앰버 1 을 토큰에서 계산된 rgb 문자열로. `collectSnapshot` 의 후광 선택자·판정에 `mf-figure--halo-amber` 추가.

**Task 2 — 조작·관찰·표본** — `0fdd1d4`
- `setBotVote`·`voteAs`·`pickCandidate`(맨 위 겹침 점 클릭 `clickTopmostPoint`)·`waitPhaseIn`·`sampleSeries`(상한 600)·`armVerdictWatch`/`readVerdictWatch`·`leaveFromResult`, 그리고 계획에 없던 `rebaseSeries`(아래 4번). 기존 도우미 시그니처·동작은 바꾸지 않았다.

## 실제 화면에서 계약이 안 맞은 곳 (로컬 dev, 390x664 위주)

계약 필드는 이름·단위가 모두 맞았다. 값을 읽는 방법이 계약 문구와 어긋났거나 검사 쪽 가정과 달랐던 곳:

1. **`.mf-dt__seat--center` 클래스는 DOM 에 없다.** 후보 가운데 자리는 클래스가 아니라 z-index 31(이름표 32)·transform 배율로만 표시된다. → 어둡게 층(z 30)보다 z 가 높은 좌석을 중앙으로 읽는다. 변론·처형에서 `cx` 195.0000076(= 장면 가운데)·배율 1.7·z 31·tagZ 32 로 읽혀 P5 가 통과한다. 어둡게 층이 없으면 `center: null`(검사가 `측정값 없음`).
2. **처형 무효 카드 테두리는 루트에 없다.** `.mf-vintro--void` 는 화면 전체 래퍼이고 테두리는 `.mf-vintro__face` 에 있다. → 카드 면의 `border-top-color` 를 읽는다. `rgb(169, 174, 187)` 으로, `readTokenColors().gray[0]` 과 문자열이 같다(P7 통과). 안쪽 선 `::before` 는 `color-mix(gray-500 70%)` 라 알파 색이므로 읽지 않는다.
3. **진홍 후광의 계산된 filter 는 `rgb()` 가 아니다.** `drop-shadow(color(srgb 0.878431 0.203922 0.294118 / 0.95) …)` 로 계산된다(앰버 후광은 `oklab(…)`). 계획대로 `rgb` 문자열 포함만 보면 8명판 마피아 방장 화면의 진홍 후광을 놓쳐(`crimsonScreen` 2, 실제 3) 시민 방장 쪽 `진홍 0` 검사가 후광 누출을 못 잡는다. → 값 속 색 함수(rgb·color(srgb)·oklab·oklch)를 8비트 sRGB 로 바꿔 진홍 토큰과 채널당 ±2 로 비교한다(oklab 변환은 앰버 후광 색이 앰버 토큰 242,184,75 로 정확히 돌아오는 것으로 확인). 가짜 요소 세 개를 넣은 양성 대조(color-mix 배경 칩·drop-shadow 화살표가 센다, 앰버/회색 칩은 안 센다)와 시민 방장 5명판 전 단계 0 도 확인했다. 토큰을 못 받으면 0 대신 `null`.
4. **P2·P7 의 `t`(카드 도착 이후 ms)는 표본기가 늦게 시작하면 틀어진다.** `skipTo` 가 시트를 닫고 돌아오기까지 약 0.5초가 걸려, 그 뒤 시작한 표본기는 무효 카드를 이미 지난 상태에서 첫 표본을 찍는다 → 처음 시도한 P7 이 `밤 시작 문구가 카드 도착 1351ms 뒤 < 1500ms` 로 실패했다(실제 간격은 관찰자 기준 1604ms). → ① 단계를 넘기기 전에 `armVerdictWatch` 와 `sampleSeries`(간격 ≤ 100ms, await 하지 않음)를 시작하고 ② 넘긴 뒤 `readVerdictWatch` 의 `voidSeenAt`/`introSeenAt` 으로 `rebaseSeries` 를 불러 `t` 를 환산하며 도착 전 표본을 버린다. `readVerdict` 가 page 시계 `now` 를 실어 준다. 이 방법(간격 80ms)으로 P7 이 통과했다. **04-32·04-33 은 이 순서를 써야 한다.**
5. **`bottom.tally` 글자에는 굵은 앞부분과 회색 뒷부분 사이 공백이 없다.** `찬성 1 · 반대 0아직 4명 · 마감까지 바꿀 수 있어요`(`<b>`·`<span>` 이어 붙음). `TALLY_RE`(`^찬성 \d+ · 반대 \d+`)는 통과하므로 그대로 두었다.
6. **변론에서 남의 시점은 `bottom.title`/`guide` 가 `""`.** 그 패널(채팅 줄·`N초`·이모티콘)에는 제목·안내 요소가 없다. P5 는 `bottom.height` 만 쓴다. 후보 본인 변론은 제목 `변론할 말을 고르세요`·칩 6개를 읽는다. 후보 본인 화면의 `roleWords` 는 칩 `저는 시민이에요` 때문에 1 이고, 처형된 viewer 는 `roleImgs` 4(관전 규칙) — P6 는 살아 있는 viewer 의 처형 단계만 보므로 정상.
7. **(검사가 실제 화면 결함을 잡음) P10 이 공개 단계에서 실패한다.** 선두 칩이 앞줄 자리의 이름표와 정지 상태로 겹친다 — 5명판 세 폭에서 칩(자리 1)↔이름표(자리 2), 8명판 세 폭에서 칩(자리 1)↔이름표(자리 3) (390 폭 8명판 칩 `[74,267–110,299]` 와 이름표 `[45,258–139,284]`). 측정 오류가 아니라 `chipAnchor`(머리 위 8px) 배치가 UI-SPEC 15.3 P10 을 못 지키는 것이다. 04-32 의 `vote5` 가 P10 에서 실패하므로 칩 위치 수정 또는 사용자 승인된 기준 변경이 필요하다. `deferred-items.md` 와 HANDOFF 에 적었다. 기준 수치는 낮추지 않았다.
8. **K4(`haloChecks`)는 공개 단계 앰버 후광에 쓸 수 없다.** 앰버 후광 filter 는 박동 애니메이션 중이라 `drop-shadow(rgba(115,87,36,.97) 0 0 2.46px) drop-shadow(oklab(…) 0 0 13.1px)` 처럼 9px 고정이 아니다(`collectSnapshot` 의 `finish()` 는 CSS 전환만 끝낸다). 앰버 후광 측정(cls amber)은 값이 맞게 들어오지만 K4 의 `9px` 규칙은 흰·진홍(정지 상태)에만 적용해야 한다. `deferred-items.md` 에 적었다.

확인하지 못한 것: 탈락 방장의 투표 화면(P9, `.mf-ro` 알약 — 방장이 첫 날 탈락해야 해 결정적으로 만들 수 없었음, 04-33 `spec4`), 마피아 팀 승리 결과(진홍 번짐 `glow` true 경로 — 04-33 `result-m`), 모션 줄이기, 실기기·iOS.

## 검증

- `node --check scripts/e2e/browser.mjs`, `node --test scripts/e2e/lib.test.mjs scripts/tsc-scoped.test.mjs`: 151건 통과.
- `npm test`: 102 파일 2765건 통과. `npm run typecheck`(토큰 검사 + app/worker tsc): 오류 없음.
- 로컬 `npm run e2e -- --url http://localhost:5173 --only lobby`: 세 폭 23/23, `E2E OK`.
- 수용 기준 grep: `export async function (readVerdict|readTokenColors)` 2, `mf-figure--halo-amber` 4, 조작 도우미 8개 export, `봇 처형 투표` 2.
- 임시 실행(스크립트는 저장소 밖 scratchpad 에서만 썼고 남기지 않았다): 시민 방장 5명판 전 과정, 마피아 방장 5명판(방장 처형 → 시민 승 결과 → 처음으로), 처형 무효 카드 도착, 8명판 마피아 방장 후보 선택(진홍 후광), 세 폭 공개 단계, 위 양성 대조. 출력에는 방 코드·토큰을 싣지 않았다(T-04-72).
- 하지 않은 것: 배포(D-26), E2E 전 흐름 실행(기존 여섯 흐름은 04-32 가 새 낮 루프에 맞춘다 — `deferred-items.md` 04-08 항목), 요구사항 체크.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 진홍 판정이 color(srgb)·oklab 로 계산된 색을 놓침**
- **Found during:** Task 1 검증(8명판 마피아 방장 화면 읽기)
- **Issue:** 계획은 계산된 색 문자열에 진홍 토큰(rgb 문자열)이 포함되는지로 세라고 했으나, 후광 filter 는 `color(srgb …)` 로 계산돼 포함 검사가 진홍 후광을 세지 못했다. 시민 방장 쪽 `진홍 0` 검사가 후광 누출을 못 잡는 거짓 통과가 된다.
- **Fix:** 색 함수를 8비트 sRGB 로 바꿔 ±2 로 비교. 토큰이 없으면 null. 양성 대조로 확인.
- **Files modified:** scripts/e2e/browser.mjs
- **Commit:** b265ab3

### 계획에 없던 덧붙임 (편차 아님, 이유와 함께)

- `rebaseSeries`(export, 6줄): 위 4번의 환산을 04-32·04-33 이 같은 방식으로 쓰게 한다. `readVerdict` 의 `now`·`result.stage` 는 계약 밖 필드다.

그 밖에는 계획대로 실행했다.

## Known Stubs

없음.

## Threat Flags

없음. 새 네트워크·인증·파일 경로 없음. T-04-72(도우미가 토큰·view 를 로그에 찍음)는 도우미가 값 대신 모양·글자만 돌려주고 오류 메시지에 단계 이름·시간만 싣게 해 mitigate 했다. 새 패키지 설치 없음(T-04-SC).

## Self-Check: PASSED

- 파일: scripts/e2e/browser.mjs, .planning/phases/04-execution-verdict/deferred-items.md — 존재 확인
- 커밋: 3f0fa9b, 0fdd1d4, b265ab3 — `HEAD` 의 조상 확인
