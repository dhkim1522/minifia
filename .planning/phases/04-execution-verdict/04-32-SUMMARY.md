---
phase: 04-execution-verdict
plan: 32
subsystem: verdict-e2e-flows
tags: [e2e, flows.mjs, vote5, setBotVote, chipPlacement, P10, rule-1, VOTE-01, VOTE-02, VOTE-03, VOTE-04, COMM-03, CONN-02, END-01]
status: complete

requires:
  - phase: 04-execution-verdict
    provides: "04-31 의 readVerdict·조작·관찰·표본 도우미, 04-29·04-30 의 P1~P10 순수 검사, 04-17 테스트 시트의 봇 투표 고정, 04-19~04-23 투표 구간 화면"
provides:
  - "기존 여섯 흐름(lobby·police5·citizen4·mafia8·doctor5·spec4)이 새 낮 루프에서 로컬 통과: 흐름 준비 때 봇 처형 투표를 모두 반대로 고정, 밤 시작 문구는 처형 무효 카드 뒤에 뜨는 것을 기다려 검사"
  - "vote5 흐름(5명, 방장 시민): discussion → 인트로 → 여부 투표 → 후보 선택 → 공개 → 변론 → 처형 → 밤|종료 를 P1·P2·P3·P4·P5·P6·P10·P-COLOR 와 공통 G·B1·H1·D7·D9·T1 로 검사"
  - "chipPlacement·tagBoxesOf (src/game/verdict.ts): 표수 칩이 다른 자리 이름표를 피해 옆·위로 비킴 — 실제 화면의 P10 결함 수정 (Rule 1)"
  - "OVERALL_LIMIT_MS 900_000"
affects: [04-33 (noexec·spec4 P9 확장·result-c·result-m), 04-35 (배포본 E2E)]

actuals:
  tokens: 5700
  tasks: 2
  commits: 2
plan_head_before: 4fede48ed2684ca527e427e5d6728eebb1d79597
plan_head_after: f91d0972de93e8f6b7b85f2f3b03c1778d620859

tech-stack:
  added: []
  patterns:
    - "카드·공개처럼 짧은 구간은 단계를 넘기기 전에 관찰자(armVerdictWatch)와 표본기(sampleSeries ≤ 100ms)를 start 하고, 끝난 뒤 rebaseSeries 로 도착 기준에 환산한다"
    - "공개 단계 표본은 추적 단계가 표본 앞뒤로 모두 reveal 인 것만 쓴다(추적 단계는 DOM 보다 먼저 바뀐다)"
    - "칩 위치는 순수 함수 한 곳(chipPlacement): 기본 자리를 먼저 쓰고 겹칠 때만 비킨다"

key-files:
  created: []
  modified:
    - scripts/e2e/flows.mjs
    - scripts/e2e/lib.mjs
    - src/game/verdict.ts
    - src/components/DayTable.tsx
    - test/unit/verdict.test.ts
    - test/client/dayTable.test.tsx
    - .planning/phases/04-execution-verdict/04-UI-SPEC.md
    - .planning/phases/04-execution-verdict/deferred-items.md

key-decisions:
  - "P10 은 낮추지 않고 화면을 고쳤다: 칩 기본 자리(머리 위 8px 가운데)가 이름표와 겹치면 캐릭터 폭 안에서 옆으로, 그래도 안 되면 위로. 이름표는 최악 폭 100·높이 26, 팝 여유 4px 로 본다. UI-SPEC 8.3 의 의도(대상 머리 위, 앰버)는 유지"
  - "공개 단계의 K4(9px 규칙)는 앰버 후광을 빼고 흰·진홍에만 건다 (04-31 SUMMARY 8번)"
  - "spec4 는 4명판에서 첫 밤에 방장이 죽지 않으면 둘째 밤 뒤 1대1 로 판이 끝나므로(승패 규칙) 같은 방을 대기실로 되돌려 첫 밤부터 다시 한다(최대 8번)"
  - "P2 의 clickedThrough 는 클릭 시각이 카드가 사라진 시각보다 앞일 때만 인정한다. 아니면 SetupError(재시도)"

requirements-completed: []  # VOTE-01·02·03·04, COMM-03, CONN-02, END-01 은 04-35 의 배포본 검증 뒤에 체크한다(HANDOFF·사용자 지시)

coverage:
  - id: C1
    description: "기존 여섯 흐름이 새 낮 루프(처형 투표 모두 반대 → 처형 없이 밤)에서 세 폭 모두 통과한다"
    requirement: "VOTE-01"
    verification:
      - kind: e2e
        ref: "로컬 npm run dev + npm run e2e -- --url http://localhost:5173 (전 흐름 한 번에): 21개 작업 모두 통과, E2E OK (220초)"
        status: pass
    human_judgment: false
  - id: C2
    description: "vote5 가 P1·P2·P3·P4·P5·P6·P10·P-COLOR 와 공통 검사를 세 폭 모두 통과한다 (VOTE-01~04, COMM-03, END-01)"
    requirement: "VOTE-02"
    verification:
      - kind: e2e
        ref: "npm run e2e -- --url http://localhost:5173 --only vote5 를 3회(+전체 실행 1회) 반복: 12번 모두 통과(처형된 봇 직업에 따라 밤 108/108 또는 종료 93/93)"
        status: pass
    human_judgment: false
  - id: C3
    description: "공개 단계 표수 칩이 이름표와 겹치지 않는다 (P10)"
    requirement: "VOTE-02"
    verification:
      - kind: unit
        ref: "test/unit/verdict.test.ts chipPlacement — 4~8명 × 폰 폭 4종 × 패널 2종 × 모든 자리 × 두 칩에서 최악 폭 이름표와 안 겹침 · 회귀 근거(기본 자리만 쓰면 겹침)"
        status: pass
      - kind: e2e
        ref: "실제 브라우저: 5명판 360·390·430 (vote5), 임시 실행 4·8명판 360·390·430 — 칩이 보이는 표본 35개 전부 P10 통과. 고치기 전 코드로 되돌려 같은 vote5 를 돌리면 `칩(자리 1) 가 이름표(자리 2)와 겹침` 35/35 실패(양성 대조)"
        status: pass
    human_judgment: false
  - id: C4
    description: "단위 시험·타입 검사 유지"
    requirement: "VOTE-01"
    verification:
      - kind: unit
        ref: "npm test (102 파일 2777건) · node --test scripts/e2e/lib.test.mjs scripts/tsc-scoped.test.mjs (151건) · npm run typecheck (토큰 검사 + app/worker tsc)"
        status: pass
    human_judgment: false
---

# Phase 4 Plan 32: 기존 E2E 흐름의 새 낮 루프 적응과 vote5 Summary

**기존 여섯 흐름이 처형 투표 모두 반대로 고정돼 새 낮 루프에서 결정적으로 통과하고, 새 `vote5` 흐름이 처형 구간 전체를 실제 브라우저·세 폭에서 P1~P6·P10 으로 지난다. 이 과정에서 실제 화면 결함(공개 칩이 이름표를 덮음, P10)을 기준을 낮추지 않고 `chipPlacement` 로 고쳤다.**

## 한 일

**Task 1 — 기존 흐름 적응** — `f91d097`(Task 2 와 같은 파일이라 한 커밋)
- `gameFlow`·`specFlow`: 방 설정 구간(`chooseRole` 뒤)에 `setBotVote({exec:"no", pick:"random"})`. 모든 `skipTo(…)` 가 여부 투표를 지나 처형 없이 밤으로 간다.
- 밤 상태: 처형 무효 카드(1.6초) 뒤에 뜨는 밤 시작 문구를 최대 4초 기다린 뒤 `sceneIntroChecks`(기준 불변)로 읽는다. N7 은 문구가 나타난 뒤 3.5초 기준 그대로. 카드는 문구가 나타날 때쯤 이미 사라져 있어 G2 장식 허용에 걸리지 않았다. `spec4` 의 `sleep(7000)` 은 카드 지연과 겹쳐 깨지지 않았다(서버 봇 지목은 클라이언트 카드와 무관).
- `lib.mjs`: `OVERALL_LIMIT_MS` 600_000 → 900_000 (이유 주석 한 줄).

**Task 2 — vote5** — `f91d097`
- 5명(방장 시민 + 봇 4), 봇 `exec: yes`·`pick: other`. 방장은 찬성 후 방장 아닌 가장 낮은 자리(후보가 되는 봇)를 고른다.
- 상태와 검사 (모두 세 폭 통과):

| 상태 | 검사 |
|---|---|
| discussion | 배경 B1·헤더 H1, 낮 고정물(`dayState`), K1·K4 |
| exec-intro | P2 (카드 도착·터치 통과·1.8초 뒤 흔적 없음), B1·H1 |
| exec-vote | P1 (하단·익명), 번복하면 집계 글자가 바뀜(P1), P-COLOR(화면 전체 진홍 0), K4(진홍 허용 안 함), 낮 고정물 |
| cand-vote | P3 (고르기 전 → 다른 자리 → 되돌리기 → 후광이 따라 움직임), P-COLOR, K4, 낮 고정물 |
| reveal | P4 (화살표 ≤ 1·칩 합 단조·최종 합 = 표 수·후광 ≤ 3·진홍 0·칩 위치), P10 (칩이 보이는 모든 표본), P-COLOR, K4(앰버 제외), 낮 고정물 |
| defense | P5 (후보 가운데·1.7배·어둡게 45%·흐림 3px·원뿔 하나·층 순서·패널 157), 변론 줄 보임, 이모티콘이 머리 위에 뜸, P-COLOR, G, H1 |
| execution | P6 (앰버 카드·꼬리 문구·유령·직업 비노출), P-COLOR, G, H1 |
| night / ended | 밤: B1·H1·낮 고정물 · 종료: `leaveFromResult`(결과 화면 검사는 04-33) |
| 흐름 끝 | D7·D9·T1 (lobby·assigning·discussion·execVote·candidateVote·reveal·night 의 낮 고정물) |

- 04-31 가 알려 준 대로: P2 는 `armVerdictWatch` + `sampleSeries`(80ms, await 안 함)를 `skipTo` 전에 시작하고 `rebaseSeries(series, watch.introSeenAt)` 로 환산. 공개(P4/P10)도 표본기를 단계 전환 전에 시작하고 추적 단계가 표본 앞뒤로 reveal 인 표본만 쓴다. K4 는 공개 단계에서 앰버 후광을 빼고 건다. T1·D7·D3a/D3b·D4 는 변론·처형·종료 상태에 적용하지 않았고(`dayStates` 에 넣지 않음) 기준 수치는 낮추지 않았다.

## 로컬 실행 결과 (dev 서버, `--url http://localhost:5173`)

전 흐름 한 번에: **21개 작업(7흐름 × 3폭) 모두 통과, `E2E OK`, 220초.**

| 흐름 | 360x640 | 390x664 | 430x932 |
|---|---|---|---|
| lobby | 23/23 | 23/23 | 23/23 |
| police5 | 123/123 | 123/123 | 123/123 |
| citizen4 | 115/115 | 115/115 | 115/115 |
| mafia8 | 120/120 | 120/120 | 120/120 |
| doctor5 | 119/119 | 119/119 | 119/119 |
| spec4 | 50/50 | 50/50 | 50/50 |
| vote5 | 108/108 | 108/108 | 93/93 (처형 대상이 마피아라 `ended` 로 끝남) |

이 표는 전체 실행 결과이고, 그 전에 흐름별로 돌린 첫 실행에서는 `citizen4` 360(방장이 첫 밤에 탈락해 두 번 연속 SetupError)과 `spec4`(아래 편차 2)가 실패했다. `vote5` 는 `--only vote5` 3회 + 전체 1회, 12번 모두 통과(밤 108 / 종료 93 이 섞여 나옴).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 공개 단계의 표수 칩이 앞줄 자리의 이름표를 덮음 (P10)**
- **Found during:** 04-31 에서 발견, 04-32 시작 때 5·8명판으로 재현(vote5 reveal 에서 `칩(자리 1) 가 이름표(자리 2)와 겹침`, 칩 표본 35/35 실패)
- **Issue:** `chipAnchor`(머리 위 8px 가운데)는 앞줄 자리 이름표(발 y 에서 26px)가 뒷줄 자리 머리 높이까지 올라와 있는 배치에서 이름표와 정지 상태로 겹친다.
- **Fix (TDD):** 단위 시험을 먼저 썼다(`chipPlacement`: 겹치는 이름표 없으면 `chipAnchor` 와 같음 · 겹치면 옆으로 · 못 비키면 위로 · 4~8명 × 폰 폭 4종 × 패널 2종 × 모든 자리 × 두 칩에서 최악 폭 이름표와 안 겹침 · 회귀 근거). 구현은 `verdict.ts` 의 순수 함수 `chipPlacement`(+`tagBoxesOf`): 기본 자리를 먼저 쓰고, 이름표(폭 100·높이 26)와 4px 여유로 겹치면 캐릭터 폭 안에서 가장 적게 옆으로(바깥쪽 먼저), 안 되면 2px 씩 최대 64px 위로. `DayTable` 이 이를 쓴다. UI-SPEC 8.3 에 한 줄 보탰다. **P10 기준은 그대로.** 칩은 여전히 대상 머리 위(캐릭터 폭 안)이고 앰버다.
- **검증:** 실제 브라우저 5명판(vote5) 세 폭, 임시 실행 4·8명판 세 폭 모두 칩 표본 35개가 P10 통과(스크립트는 저장소 밖 scratchpad). 고치기 전 코드로 되돌려 같은 vote5 를 돌려 35/35 실패를 확인한 뒤 복구했다.
- **Files modified:** src/game/verdict.ts, src/components/DayTable.tsx, test/unit/verdict.test.ts, test/client/dayTable.test.tsx, .planning/phases/04-execution-verdict/04-UI-SPEC.md
- **Commit:** 05d8772

**2. [Rule 1 - 스크립트 가정 오류] spec4 가 새 승패 규칙에서 무작위로 실패**
- **Found during:** Task 1 검증(흐름별 첫 실행: 360·390 에서 `locator.click` 시간 초과 4/4)
- **Issue:** 4명판은 마피아 1·시민 3. 첫 밤에 방장이 죽지 않으면(2/3) 둘째 밤 뒤 1대1 로 판이 `ended` 가 되어 `testSkip` 버튼이 없다(계획은 「밤 암살로만 방장 탈락」 이라고만 했다). 처형 투표를 고정해도 밤 암살 대상은 서버 무작위라 고정할 수 없다.
- **Fix:** 방장이 첫 밤에 안 죽었으면 같은 방을 [대기실로 되돌리기] 후 다시 시작해 첫 밤부터 반복(최대 8번, 실패 확률 (2/3)^8 ≈ 4%이고 run.mjs 의 한 번 재시도가 더해진다). 검사 항목·기준(V1·M1·M3·D7·D9·T1)은 바꾸지 않았다.
- **Files modified:** scripts/e2e/flows.mjs
- **Commit:** f91d097

### 계획과 달라진 점 (편차 아님)

- Task 1·Task 2 가 `flows.mjs` 한 파일이라 한 커밋(`f91d097`)이다. 수정 커밋(`05d8772`)은 별도.
- 계획 `vote5` 설명의 「이모티콘이 후보 위에」 는 실제로는 보낸 사람(방장) 머리 위에 뜬다. `.mf-dt__emoji` 존재만 확인했다.
- `vote5` 에서 변론 줄은 후보 봇이 1~5초 사이 보내므로 6초까지 기다리고 안 오면 항목을 건너뛴다(계획의 「안 보내면 건너뜀」). 12번 실행에서 모두 보였다.

## 남은 무작위 (기존, 이번 변경과 무관)

「살아 있는 방장」 흐름(`citizen4`·`police5` 등)은 첫 밤에 방장이 탈락하면 새 방에서 한 번 다시 돈다(4명판 1/3, 5명판 약 1/5). 두 번 연속이면 `S4` 실패 — HANDOFF 에 적힌 기존 무작위이고 `deferred-items.md` 에도 적었다. 이번 흐름별 첫 실행에서 `citizen4` 360 이 한 번 겪었고 전체 실행에서는 안 나왔다.

## Known Stubs

없음.

## Threat Flags

없음. 새 네트워크·인증·파일 경로 없음. T-04-73(출력에 방 코드·토큰·view 내용)은 기존 `redact`·한 줄 요약 규칙을 그대로 쓰고, 이 SUMMARY 에는 검사 ID 와 결과만 적었다. 새 패키지 설치 없음(T-04-SC).

## 확인하지 못한 것

결과 화면(`ended`)의 P8·마피아 승 진홍 번짐·처형 무효 카드·탈락 방장의 투표 화면(P9)은 04-33. 모션 줄이기·실기기·iOS·배포본은 04-35(배포하지 않았다, D-26).

## Self-Check: PASSED

- 파일: scripts/e2e/flows.mjs, scripts/e2e/lib.mjs, src/game/verdict.ts, src/components/DayTable.tsx, test/unit/verdict.test.ts, test/client/dayTable.test.tsx — 존재 확인
- 커밋: 05d8772, f91d097 — `HEAD` 의 조상 확인
