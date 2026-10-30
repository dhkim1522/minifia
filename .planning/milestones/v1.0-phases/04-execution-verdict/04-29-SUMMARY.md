---
phase: 04-execution-verdict
plan: 29
subsystem: verdict-e2e-pure-checks
tags: [e2e, lib.mjs, voteChecks, introChecks, candidateChecks, revealChecks, colorRuleChecks, haloChecks, amber, snapshot-contract, VOTE-01, VOTE-02, CONN-02, tdd]
status: complete

requires:
  - phase: 04-execution-verdict
    provides: "04-16~04-27 의 처형 구간 화면 DOM 계약(.mf-execvote__tally·.mf-seg__b·.mf-vintro·.mf-vchip·.mf-varrow·.mf-dt__dim--verdict·.mf-morningcard--amber), 기존 E2E lib.mjs 의 result 형식과 haloChecks(K4)"
provides:
  - "scripts/e2e/lib.mjs 머리의 `처형 구간 스냅숏 계약`(VerdictSnap) — bottom·dt·intro·reveal·crimsonNew·crimsonScreen(+선택 newColors·screenColors) 필드의 이름·단위·뜻을 한 곳에 적음. 04-31 의 readVerdict 가 이 모양 그대로 만들고 04-30 이 나머지 필드를 같은 주석에 더한다"
  - "voteChecks(v, {spectator}) — P1(살아 있는 viewer 의 여부 투표 하단·익명) / P9(탈락 viewer: 버튼 0·알약 `관전 중`·집계 줄 보임)"
  - "introChecks(samples, {clickedThrough}) — P2 인트로 카드: 도착 직후 1장·pointer-events none·1800ms 뒤 0장과 불투명 잔상 0·클릭 통과"
  - "candidateChecks(v, {mySeat, deadSeats, chosenSeat, crimsonSeats, name}) — P3 후보 선택: 내 자리·탈락 자리 비활성, 고른 자리 pressed + 흰 후광 정확히 하나, 알약 `…님에게 투표했어요`/`선택 안 함`"
  - "revealChecks(samples, {n, size}) — P4 공개: 화살표 ≤ 1, 칩 합 단조 증가해 최종 n, 후광 합 ≤ 3, 새 요소 진홍 0, 칩이 장면 폭·화면 폭 안이고 헤더 아래"
  - "colorRuleChecks(v, {crimsonColors, wholeScreenCrimson}) — P-COLOR 새 요소 진홍 0, 방장이 시민이면 화면 전체 진홍 0. 진홍 판정은 토큰에서 읽어 온 색 목록(crimsonColors)과 비교하고 lib 에 색 값을 박지 않음"
  - "haloChecks(K4) 확장 — 후광 종류 white|amber|crimson(모르는 종류는 실패), crimsonAllowed(기본 true)가 false 면 진홍 후광 실패. turnChecks 가 같은 인자를 그대로 넘김"
affects: [04-30 (나머지 검사 P5~P8·P10 이 같은 계약 주석에 필드를 더함), 04-31 (readVerdict 가 계약대로 스냅숏 생성), 04-32~33 (흐름 조립이 이 검사들을 부름), 04-35 (배포본 E2E)]

actuals:
  tokens: 9400
  tasks: 2
  commits: 4
plan_head_before: 40bec560d93c402832faa5fcc06da1ddf62c8f9b
plan_head_after: a02211eb261ec8e692c7015071bdf7957ccfe141

tech-stack:
  added: []
  patterns:
    - "검사는 DOM·브라우저 없이 스냅숏만 받는 순수 함수로 두고, 정상 입력 하나와 어긴 입력마다 시험 하나로 고정한다. 필드가 없으면 `측정값 없음(…)` 으로 실패해 조용히 통과하지 않는다"
    - "입력 모양(스냅숏 계약)을 검사 함수 옆 주석 한 곳에 적어, 측정하는 쪽(browser.mjs)과 판정하는 쪽(lib.mjs)이 어긋나지 않게 한다"

key-files:
  created: []
  modified:
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs

key-decisions:
  - "기준 수치(OVERLAP_EPS .5·ONE_LINE_FACTOR 1.6·FACE_RATIO .45·TAP_MIN 44·PANEL_H 157)와 승인 완화 목록(M1·D3a/D3b·D4·D3b-5)은 그대로다. 단위 시험이 두 가지를 다시 고정한다(T-04-70). P-PANEL-236 은 04-30 이 더한다"
  - "진홍 판정 입력은 두 층이다. 필수는 브라우저가 센 개수(crimsonNew·crimsonScreen)이고, 선택으로 요소별 색 목록(newColors·screenColors)이 있으면 crimsonColors(토큰을 rgb 로 정규화한 문자열)와 알파·공백을 무시하고 비교해 개수에 더한다. 계획의 `crimsonNew === 0` 과 `lib 에 색 값을 하드코딩하지 않는다` 를 함께 만족시키려는 선택이다"
  - "앰버 후광은 haloChecks 기본값에서 허용한다(후광 종류 white|amber|crimson). `투표 장면 한정` 은 호출하는 흐름이 단계를 알고 있으므로 이 함수에 단계 인자를 넣지 않고, 비투표 단계에서 앰버가 없다는 것은 후광 종류가 흐름 쪽 기대(흰 후광 = 차례 말풍선 자리)로 이미 걸러진다. 필요하면 04-32 가 `amberAllowed` 를 더한다"
  - "introChecks 의 `도착 직후` 는 가장 이른 표본이고, 카드가 보이는 모든 표본에서 pointer-events 가 none 이어야 한다. 1800ms(INTRO_GONE_MS, D-30) 이후 표본이 없으면 `측정값 없음` 으로 실패한다"

requirements-completed: []  # VOTE-01·VOTE-02·CONN-02 는 04-35 의 배포본 검증 뒤에 체크한다(HANDOFF·사용자 지시)

coverage:
  - id: C1
    description: "P1·P9 — 처형 여부 투표 하단(제목·집계 줄·찬성/반대 ≥ 44·aria-pressed)과 익명(이름표·캐릭터 안 글자 0, 후광 0), 탈락 viewer 는 버튼 0·알약 `관전 중`·집계 줄 보임을 스냅숏만으로 판정한다 (VOTE-01, D-02, D-35)"
    requirement: "VOTE-01"
    verification:
      - kind: unit
        ref: "scripts/e2e/lib.test.mjs voteChecks P1·P9 시험(정상, 익명 깨짐 둘, 버튼 부족, 높이·너비 40, 기권, aria-pressed null, 제목·집계 줄 다름, 관전자에 버튼, 알약 없음·다름, 집계 줄 사라짐, 측정값 없음)"
        status: pass
    human_judgment: false
  - id: C2
    description: "P2·P3 — 인트로 카드의 도착·터치 통과·1.8초 뒤 흔적 없음과 후보 선택의 좌석 규칙·흰 후광 하나·알약을 판정한다 (VOTE-02, D-30)"
    requirement: "VOTE-02"
    verification:
      - kind: unit
        ref: "lib.test.mjs introChecks P2(카드 없음·둘, 터치 가로챔, 1.8초 뒤 잔존·잔상, 클릭 미통과, 표본 없음)·candidateChecks P3(내 자리·탈락 자리·남의 자리 비활성 어긋남, 후광 둘·없음·앰버·남의 자리, pressed 어긋남, 알약 문구, 고르기 전 후광, 동료 진홍 허용 목록)"
        status: pass
    human_judgment: false
  - id: C3
    description: "P4·P-COLOR·K4 확장 — 공개 연출 불변식(화살표 ≤ 1·칩 합 단조·후광 합 ≤ 3·칩 위치), 앰버 후광 허용, 진홍 후광은 crimsonAllowed 로 제한, 새 요소 진홍 0 과 시민 방장 화면 진홍 0 (D-31, D-33, CONN-02)"
    requirement: "CONN-02"
    verification:
      - kind: unit
        ref: "lib.test.mjs revealChecks P4(화살표 둘, 칩 합 감소, 최종 ≠ n, n=0 칩, 후광 4개, 새 요소 진홍, 칩이 장면 폭·화면 폭 밖·헤더 침범, 표본 시각 순서, 측정값 없음)·haloChecks 앰버·crimsonAllowed(turnChecks 전달 포함)·colorRuleChecks(개수·색 목록·측정값 없음). 기존 시험(K4 포함)은 한 줄도 고치지 않고 통과"
        status: pass
    human_judgment: false
  - id: C4
    description: "새 검사를 실제 브라우저 스냅숏에 대어 본 결과(readVerdict 가 만든 값으로 판정되는지)"
    requirement: "VOTE-01"
    verification:
      - kind: manual_procedural
        ref: "이 계획은 브라우저를 쓰지 않는다. 스냅숏을 만드는 readVerdict 는 04-31, 흐름 조립은 04-32~33, 배포본 실행은 04-35 에서 한다. 계약 주석의 필드 이름이 DOM 과 맞는지는 04-31 에서 처음 확인된다"
        status: not_run
    human_judgment: false
---

# Phase 4 Plan 29: E2E 순수 검사 P1·P2·P3·P4·P9 와 후광·색 규칙 Summary

**처형 구간의 투표 하단·익명·관전 화면(P1·P9), 인트로 카드(P2), 후보 선택(P3), 공개 연출(P4), 진홍 규칙(P-COLOR)을 DOM 없이 스냅숏만으로 판정하는 순수 함수 여섯 개와 앰버/진홍 후광 규칙 확장으로 만들고, 입력 모양을 `lib.mjs` 머리의 스냅숏 계약 한 곳에 적었다. 기준 수치와 승인 완화 목록은 그대로다.**

## 한 일

**Task 1 — P1·P9·P2·P3 + 스냅숏 계약** — RED `59aac66` → GREEN `1f9e1db`
- RED: `voteChecks`·`introChecks`·`candidateChecks` 를 import 하는 시험을 먼저 썼다(함수가 없어 시험 파일 전체가 실패).
- GREEN: `lib.mjs` 머리(`TEXT_SIZE_ALLOW` 앞)에 `처형 구간 스냅숏 계약` 주석 블록(VerdictSnap 필드 표와 시간표본 입력 모양)을 쓰고, 파일 끝에 세 함수를 한국어 JSDoc 과 함께 추가했다. 모든 검사는 기존 `result(id, label, bad[])` 를 쓰며 필드가 없으면 `측정값 없음(…)` 으로 실패한다.

**Task 2 — P4 + 후광·색 규칙 확장** — RED `ec3aa88` → GREEN `a02211e`
- RED: `revealChecks`·`colorRuleChecks`·`haloChecks`(직접 호출)·`turnChecks` 의 `crimsonAllowed` 시험과, 기준 수치·승인 완화 목록이 바뀌지 않았음을 고정하는 시험.
- GREEN: `revealChecks`·`colorRuleChecks` 추가, `haloChecks` 에 후광 종류 목록(white|amber|crimson)과 `crimsonAllowed`(기본 true) 추가, `turnChecks` 가 같은 인자를 K4 에 전달. 기존 반환 ID(K4)와 메시지 형식은 그대로다.

## 검증

- `node --test scripts/e2e/lib.test.mjs scripts/tsc-scoped.test.mjs`: 133건 통과(lib.test.mjs 는 이 계획 전 107건 → 123건, 새 시험 16건).
- `npm test`: 102 파일 2765건 통과. `tsc -p tsconfig.app.json --noEmit`, `tsc -p tsconfig.worker.json --noEmit` 모두 종료 코드 0(`npm run typecheck` 안의 `wrangler types` 는 돌리지 않았다 — 이 계획은 타입 생성 파일을 바꾸지 않는다).
- 수용 기준 grep: 세 함수 3개, 계약 문구 2곳(머리 주석과 섹션 주석), `PANEL_H` 157 한 줄, 두 함수 2개, `crimsonAllowed` 5곳, `OVERLAP_EPS` 0.5 한 줄.
- 확인하지 못한 것: 브라우저·배포본에서 실제 스냅숏으로 돌려 본 것(이 계획은 브라우저를 쓰지 않는다). 계약 주석의 필드가 DOM 과 맞는지는 04-31 의 `readVerdict` 가 처음 만난다. E2E 는 이 계획에서 돌리지 않았고 배포하지 않았다.

## Deviations from Plan

None - plan executed exactly as written. 다음은 편차가 아닌 판단 기록이다.

- 계약 주석의 `crimsonScreen` 은 계획이 Task 2 에서 더하라고 했으나 머리 주석을 한 번에 쓰는 편이 한 곳 원칙에 맞아 Task 1 에서 함께 적었다.
- `colorRuleChecks` 의 색 목록 비교(newColors·screenColors)는 계획의 `crimsonColors` 입력을 실제로 쓰게 하려고 선택 필드로 두었다(key-decisions).
- 계획의 `아침 카드 앰버 후광 투표 장면 한정` 은 이 함수에서 단계로 거르지 않았다(key-decisions). 04-32 가 필요하면 인자를 더한다.

## Known Stubs

없음.

## Threat Flags

없음. 새 네트워크·인증·파일 경로 없음. T-04-70(검사 기준을 낮춰 거짓 통과)은 기준 상수와 `APPROVED_RELAXATIONS` id 목록을 단위 시험이 다시 고정하고 수용 기준 grep 이 상수 줄을 확인해 mitigate 했다. 새 패키지 설치 없음(T-04-SC).

## Self-Check: PASSED

- 파일: scripts/e2e/lib.mjs, scripts/e2e/lib.test.mjs — 존재 확인
- 커밋: 59aac66, 1f9e1db, ec3aa88, a02211e — `HEAD` 의 조상 확인
