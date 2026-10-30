---
phase: 04-execution-verdict
plan: 30
subsystem: verdict-e2e-pure-checks
tags: [e2e, lib.mjs, defenseChecks, executionChecks, voidCardChecks, resultChecks, placementChecks, P-PANEL-236, snapshot-contract, VOTE-03, VOTE-04, COMM-03, END-01, END-02, tdd]
status: complete

requires:
  - phase: 04-execution-verdict
    provides: "04-29 의 voteChecks·introChecks·candidateChecks·revealChecks·colorRuleChecks 와 스냅숏 계약 주석, 04-13 verdict.ts 상수(45%·3px·1.7), 04-23~26 화면 DOM 계약(변론 무대·앰버 처형 카드·무효 카드·결과 화면)"
provides:
  - "defenseChecks(v, {isCandidate}) — P5 변론: 후보 가운데 ±2·배율 1.7±.02·어둡게 층 정확히 하나(blur(3px)·알파 .45±.02·z 30)·원뿔 하나·층 순서(후보 좌석·이름표 > 층 > 다른 자리·이름표)·이름표 아래끝 ≤ 장면 아래 − 4. 후보 본인은 패널 236(±.5)+칩 정확히 6개(각 ≥ 44), 그 밖은 PANEL_H 157"
  - "executionChecks(v, {viewerAlive, candidateSeat}) — P6 처형: 카드 1장·테두리 앰버(진홍·회색 아님)·제목 `…님이 {꼬리 4개}`·부제 `처형이 집행됐어요`, 후보 유령, 하단 `처형이 끝났어요`/`곧 다음으로 넘어가요`, 새 요소 진홍 0, 살아 있는 viewer 화면에 역할 그림·이름 0(D-09)"
  - "voidCardChecks(samples, {grayColors, crimsonColors, clickedThrough}) — P7 처형 무효 카드: 도착 직후 1장·제목 `처형 무효`·세 부제 중 하나·테두리가 회색 목록(앰버·진홍 아님)·pointer-events none·1800ms 뒤 0장·밤 시작 문구는 카드 첫 등장보다 1500ms 이상 뒤(P-3)·밤 조작 클릭 통과"
  - "resultChecks(v, {winner, n, summaryRows}) — P8 결과 화면: 배너=승패·카드 수=인원·직업 이름·탈락 그림 .5±.05(살아 있는 카드 1±.05)·요약 행 수·가로 스크롤 없음·[처음으로] 에 닿음·진홍 번짐은 마피아 승만·헤더 바 없음"
  - "placementChecks(v) — P10: 칩이 헤더·패널·모든 이름표와, 카드가 헤더·패널과 겹치지 않고 카드는 장면 폭 안"
  - "APPROVED_RELAXATIONS 의 `P-PANEL-236`(승인 근거 execution-v1/DC-defense-me) 한 줄, 상수 PANEL_H_DEFENSE_ME 236·AMBER_RGB. PANEL_H 157 불변"
  - "스냅숏 계약 주석 완성 — dt.center·others·dim·cones·ghosts·roleImgs·roleWords·header·panel, execCard·voidCard·card, reveal.tags, result{…}, P7 시간표본 모양. 04-31 이 이 주석 한 곳만 보고 readVerdict 를 만들 수 있다"
affects: [04-31 (readVerdict 가 완성된 계약대로 스냅숏 생성), 04-32~33 (흐름 조립이 P5~P8·P10 을 부름), 04-35 (배포본 E2E)]

actuals:
  tokens: 9200
  tasks: 2
  commits: 4
plan_head_before: bb027c6c45c62ef885cce8b015d5accc9b443c5f
plan_head_after: ee8de34649574ca1da5826edcdd2a4dc54c773e6

tech-stack:
  added: []
  patterns:
    - "검사는 DOM·브라우저 없이 스냅숏만 받는 순수 함수, 정상 입력 하나와 어긴 입력마다 시험 하나, 필드가 없으면 `측정값 없음(…)` 으로 실패(04-29 와 같은 규칙)"
    - "UI-SPEC 수치(45%·3px·1.7)는 lib 에 쓰고 단위 시험이 src/game/verdict.ts 를 readFileSync 로 읽어 상수와의 동일성을 단언한다"
    - "승인 완화는 입력(isCandidate)에 묶는다 — 236 은 후보 본인일 때만 요구하고 남의 시점에서 236 이면 실패해 완화가 번지지 않는다"

key-files:
  created: []
  modified:
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs

key-decisions:
  - "winner 값은 프로토콜 그대로 `citizenWin|mafiaWin` 으로 받는다(shared/protocol.ts GameWinner). resultChecks 는 기대 winner 의 배너 문구(`시민 팀 승리`/`마피아 팀 승리`)와 result.winner 를 모두 대조한다"
  - "회색·진홍 색값은 lib 에 박지 않고 04-31 이 토큰에서 읽어 넘기는 grayColors·crimsonColors 로 비교한다(colorKey 로 알파·공백을 무시). 앰버만 UI-SPEC 6.2 값 AMBER_RGB 를 lib 상수로 둔다"
  - "P7 시간표본에 `nightIntro`(밤 시작 문구 `.mf-sceneintro` 수)를 더했다. 카드 첫 등장과 문구 첫 등장의 시각 차를 1500ms 이상으로 단언한다(UI-SPEC 의 1.6초에서 측정 오차 100ms 여유)"
  - "resultChecks 의 진홍 번짐은 `마피아 승일 때만` 을 양방향으로 읽었다: 마피아 승에 번짐이 없어도, 시민 승에 번짐이 있어도 실패한다(UI-SPEC 11.1 2번)"
  - "T1·D7·D3a/D3b·D4 는 새 상태에 적용하지 않으며 lib 의 해당 함수는 바꾸지 않았다. 흐름 조립(04-32/33)이 dayStates 에 변론·처형·종료를 넣지 않는 것으로 지킨다"

requirements-completed: []  # VOTE-03·VOTE-04·COMM-03·END-01·END-02 는 04-35 의 배포본 검증 뒤에 체크한다(HANDOFF·사용자 지시)

coverage:
  - id: C1
    description: "P5 — 변론 스포트라이트의 중심·배율·어둡게 층·흐림·원뿔·층 순서·이름표 여유와 후보 본인 패널 236+칩 6개/남의 시점 157 을 스냅숏만으로 판정한다 (VOTE-03, D-15, D-38)"
    requirement: "VOTE-03"
    verification:
      - kind: unit
        ref: "lib.test.mjs defenseChecks P5(정상 둘, 가운데 5px·배율 1.5·층 없음/둘·흐림 4px/없음·알파 .6/읽기 불가·z·원뿔 없음/둘·후보 z 29·다른 자리가 층 위·이름표 아래끝 침범·패널 높이, 후보 본인 157/남의 236/칩 5개/칩 40px/236±.5 경계, 측정값 없음)"
        status: pass
    human_judgment: false
  - id: C2
    description: "P6 — 앰버 처형 카드·꼬리 4개·부제·유령·하단 문구·진홍 0·살아 있는 viewer 의 직업 비노출을 판정한다 (COMM-03, D-09, D-33)"
    requirement: "COMM-03"
    verification:
      - kind: unit
        ref: "lib.test.mjs executionChecks P6(정상+네 꼬리, 진홍·회색 테두리, 카드 없음/둘, 아침 꼬리 5번째, 부제, 유령 아님, 하단 제목·안내, 새 요소 진홍, 역할 그림·이름, 탈락 viewer 면제, 측정값 없음)"
        status: pass
    human_judgment: false
  - id: C3
    description: "승인 완화 P-PANEL-236 이 한 줄뿐이고 PANEL_H 157 등 기준 수치가 그대로이며, lib 의 45%·3px·1.7 이 verdict.ts 상수와 같다 (T-04-71, 결정 0030 §6)"
    requirement: "VOTE-03"
    verification:
      - kind: unit
        ref: "lib.test.mjs APPROVED_RELAXATIONS 목록(M1·D3a/D3b·D4·D3b-5·P-PANEL-236)·04-30 상수 동일성(readFileSync verdict.ts)·후보 본인 157/남의 236 실패"
        status: pass
    human_judgment: false
  - id: C4
    description: "P7 — 처형 무효 카드의 회색 테두리·세 부제·1.8초 안 사라짐·밤 시작 문구 순서·터치 통과를 판정한다 (VOTE-04, D-34)"
    requirement: "VOTE-04"
    verification:
      - kind: unit
        ref: "lib.test.mjs voidCardChecks P7(정상+세 부제, 앰버·진홍·목록 밖 테두리, 제목·부제, 도착 직후 없음/둘, 터치 막음, 문구가 카드와 동시/1.4초, 1.8초 뒤 잔상, 클릭 미통과, 측정값 없음)"
        status: pass
    human_judgment: false
  - id: C5
    description: "P8·P10 — 결과 화면의 배너·카드·직업·탈락 흐림·요약·스크롤·번짐과 칩·카드의 이름표·헤더·패널 비겹침을 판정한다 (END-01, END-02, P-3)"
    requirement: "END-01"
    verification:
      - kind: unit
        ref: "lib.test.mjs resultChecks P8(마피아·시민 승 정상, 배너 불일치, 승자 불일치, 카드 수 부족, 직업 이름 없음/엉뚱, 탈락 불투명/살아 있는 흐림/±.05 경계, 요약 행, 가로 스크롤 301>300, 처음으로 미도달, 시민 승 번짐/마피아 승 번짐 없음, 진행 바, 측정값 없음)·placementChecks P10(칩이 자기/남의 이름표·헤더·패널과 겹침, 카드가 패널·헤더 침범/장면 폭 밖, 변만 맞닿음 허용, 측정값 없음)"
        status: pass
    human_judgment: false
  - id: C6
    description: "새 검사를 실제 브라우저 스냅숏에 대어 본 결과(readVerdict 가 만든 값으로 판정되는지)"
    requirement: "END-01"
    verification:
      - kind: manual_procedural
        ref: "이 계획은 브라우저를 쓰지 않는다. readVerdict 는 04-31, 흐름 조립은 04-32~33, 배포본 실행은 04-35 에서 한다. 계약 주석의 필드 이름이 DOM 과 맞는지는 04-31 에서 처음 확인된다"
        status: not_run
    human_judgment: false
---

# Phase 4 Plan 30: E2E 순수 검사 P5·P6·P7·P8·P10 과 P-PANEL-236 승인 완화 Summary

**변론 스포트라이트(P5)·앰버 처형 카드(P6)·처형 무효 회색 카드(P7)·결과 화면(P8)·칩·카드 배치(P10)를 DOM 없이 스냅숏만으로 판정하는 순수 함수 다섯 개로 만들고, 후보 본인 패널 236 은 승인 완화 `P-PANEL-236` 한 줄로만 허용했다. 스냅숏 계약 주석이 완성되어 04-31 이 한 곳만 보고 `readVerdict` 를 만들 수 있다.**

## 한 일

**Task 1 — P5·P6 + P-PANEL-236** — RED `d901e45` → GREEN `3caa47e`
- RED: `defenseChecks`·`executionChecks` 시험과 `APPROVED_RELAXATIONS` 목록(`P-PANEL-236` 추가) 단언, `verdict.ts` 상수 동일성 시험을 먼저 썼다. 04-29 가 적은 "이 계획은 완화를 더하지 않는다" 시험은 04-30 이 완화를 더하므로 기준 수치 시험으로 이름과 목록 단언을 고쳤다(수치 단언은 그대로).
- GREEN: `lib.mjs` 에 `PANEL_H_DEFENSE_ME`·`AMBER_RGB`, 두 함수, 승인 완화 한 줄, 계약 주석(P5~P8·P10 필드) 추가. 후보 본인만 236+칩 6개를 요구하고 남의 시점의 236 은 실패한다(T-04-71).

**Task 2 — P7·P8·P10 + 닫기** — RED `45ba1b8` → GREEN `ee8de34`
- RED: `voidCardChecks`·`resultChecks`·`placementChecks` 정상·위반·측정값 없음 시험.
- GREEN: 세 함수 추가. 모든 검사는 기존 `result(id, label, bad[])` 를 쓰고 필드가 없으면 `측정값 없음(…)` 으로 실패한다.

## 검증

- `node --test scripts/e2e/lib.test.mjs scripts/tsc-scoped.test.mjs`: 151건 통과(lib.test.mjs 123 → 141건, 새 시험 18건).
- `npm test`: 102 파일 2765건 통과. `tsc -p tsconfig.app.json --noEmit`, `tsc -p tsconfig.worker.json --noEmit` 모두 오류 없음(`npm run typecheck` 안의 `wrangler types` 는 돌리지 않았다 — 타입 생성 파일을 바꾸지 않는 계획).
- 수용 기준 grep: `P-PANEL-236` lib.mjs 4·lib.test.mjs 5, 두 함수 2개, `PANEL_H` 157 한 줄, 세 함수 3개, `FACE_RATIO` 0.45 한 줄.
- 확인하지 못한 것: 브라우저·배포본에서 실제 스냅숏으로 돌려 본 것. 이 계획은 브라우저를 쓰지 않았고 E2E 를 돌리지 않았고 배포하지 않았다. 계약 주석의 필드가 DOM 과 맞는지는 04-31 의 `readVerdict` 가 처음 만난다.

## Deviations from Plan

None - plan executed exactly as written. 다음은 편차가 아닌 기록이다.

- RED 커밋(`d901e45`)은 시험 변수 `SCENE` 이 기존 변수와 이름이 겹쳐 구문 오류로도 실패했다(함수 부재 외에). GREEN 커밋에서 `DEF_SCENE` 으로 고쳤다. Task 2 의 RED 는 함수 부재만으로 실패했다.
- P7 `nightIntro` 표본 필드와 `winner` 값 형식(`citizenWin|mafiaWin`)은 계획이 정하지 않아 key-decisions 에 적은 대로 정했다.

## Known Stubs

없음.

## Threat Flags

없음. 새 네트워크·인증·파일 경로 없음. T-04-71(236 완화가 다른 상태로 번짐)은 isCandidate 입력일 때만 236, 그 밖은 157 을 단위 시험이 양쪽 단언해 mitigate 했다. 새 패키지 설치 없음(T-04-SC).

## Self-Check: PASSED

- 파일: scripts/e2e/lib.mjs, scripts/e2e/lib.test.mjs — 존재 확인
- 커밋: d901e45, 3caa47e, 45ba1b8, ee8de34 — `HEAD` 의 조상 확인
