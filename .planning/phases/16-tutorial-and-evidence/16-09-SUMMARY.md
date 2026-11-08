---
phase: 16-tutorial-and-evidence
plan: "09"
subsystem: ui-evidence
tags: [react, css, evidence, trace-mark, name-tag, host-line, color-art, e2e, tdd, vitest, EVID-01, EVID-02, EVID-03, ASSET-01]
requires:
  - phase: 16-01
    provides: day.evidence({trace?, seen?}), EvidenceCard 틀(.mv-trace__name·.mv-trace__note·data-lastseen-row)
  - phase: 16-02
    provides: PlaceArt·TraceArt 컬러 에셋(placeArt.tsx), PLACE_NAME·TRACE_TEXT
  - phase: 16-08
    provides: 심부름 단계 아래 패널 없음, 증거 카드 위치 --mf-host-dock 기준
provides:
  - TRACE_MARK(조각 색 9종, night-900 위 3:1 이상)·sameOutfitSeats(공개 look 과 TRACE_OF_OUTFIT 역표) — src/game/traceMark.ts
  - 최종 증거 카드(1행 TraceArt 타일 테두리 2 --trace-mark + 이름 + "같은 옷을 입은 사람에게 표시", 2행 PlaceArt)
  - HeadStack traceMark·seenMark(이름 앞 thread·eye 16, data-trace-mark·data-seen-mark, 시각 숨김 글 "흔적과 같은 옷")
  - GameMap tagProps 가 흔적 구간~낮 끝까지 같은 옷 산 사람·마지막 목격자 이름표에 표시를 붙임
  - 사회자 문구 trace 수정 + discussion.evidence 신규(witness → discussion.evidence → discussion.act)
  - 기록 카드 장소 24 컬러 그림, 옛 장소 선 그림 16개·placeIconOf·15 흔적 카드(TraceCard.tsx) 삭제
  - E2E TC2 확장·TC6(카드 2행)·TC7(흔적 구간 표시 좌석)·TC8(낮 유지·밤 소멸)
affects: [16-10]
actuals:
  tokens: 27500
  tasks: 3
  commits: 5
plan_head_before: aa4711a5d76d6632bdbd57b9566860999af164ec
commits: 5
plan_head_after: 10a93c87a9ebefe19c5b48e0d7651db0453f18ec
tech-stack:
  added: []
  patterns:
    - "데이터에서 오는 색은 닫힌 표(TRACE_MARK)에서 CSS 사용자 변수 --trace-mark 로만 넘긴다 — 화면 CSS 에 hex 없음, 사용자 문자열이 섞이지 않는다"
    - "표식 속성(data-trace-mark·data-seen-mark)은 값 없이 존재만 — 좌석·역할·조각 id 를 싣지 않는다"
    - "같은 옷 판정은 서버가 아니라 클라이언트가 공개 players[].look 과 공개 조각 id 로 계산한다(R-3)"
key-files:
  created:
    - src/game/traceMark.ts
    - test/unit/traceMark.test.ts
  modified:
    - src/game/traceText.ts
    - src/game/placeText.ts
    - src/game/hostLine.ts
    - src/components/v2/EvidenceCard.tsx
    - src/components/v2/RecordCard.tsx
    - src/components/v2/HeadStack.tsx
    - src/components/v2/V2Icon.tsx
    - src/screens/GameMap.tsx
    - src/styles/evidence.css
    - test/client/evidenceCard.test.tsx
    - test/client/recordTrace.test.tsx
    - test/client/v2parts.test.tsx
    - test/unit/hostLine.test.ts
    - test/unit/traceView.test.ts
    - test/unit/errandView.test.ts
    - test/unit/e2eContract.test.ts
    - scripts/e2e/errand.mjs
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs
    - scripts/e2e/browser.mjs
  deleted:
    - src/components/v2/TraceCard.tsx
key-decisions:
  - "표시 시점: 아침은 증거 카드가 뜬 뒤(traceShown)부터, 그 밖 단계는 day.evidence.trace 가 있으면 항상. 밤에는 서버가 day.evidence 를 싣지 않아 자연히 사라진다. 목격 표시도 trace 가 있을 때만 붙인다(카드와 같은 조건)"
  - "같은 옷 대상은 산 사람만(나 포함, 죽은 피해자 제외). 유령 viewer 도 같은 규칙 — 표시는 viewer 역할과 무관한 공개 값의 함수"
  - "discussion.evidence 의 빛남 대상은 discussion.act 와 같은 채팅 단추(빛 규칙이 단계 안에서 흔들리지 않게)"
  - "토론 읽기 경로 허용 목록에 day.evidence·day.evidence.trace 둘만 추가 — 조각 값·seen·look 은 읽지 않는다(시험이 Proxy 로 고정)"
duration: ~95min
completed: 2026-11-08
status: complete
---

# Phase 16 Plan 09: 조각 색·같은 옷 표시·최종 증거 카드 Summary

**아침 흔적이 "의심의 근거"가 됐다 — 같은 옷을 입은 산 사람과 마지막 목격자의 이름표에 thread·eye 표시가 낮 끝까지 남고, 증거 카드는 컬러 그림 최종 모양이며, 사회자가 "같은 옷과 엇갈린 목격"을 가리킨다. 옛 선 그림 16개와 15 흔적 카드는 저장소에서 지웠다.**

## 한 일

- **Task 1 (조각 색·최종 증거 카드·컬러 그림, ASSET-01 해소).** `traceMark.ts` 에 조각 색 9종(UI-SPEC 표 값)과 `sameOutfitSeats` 를 만들고, 단위 시험이 WCAG 상대 휘도로 모든 색이 night-900 위 3:1 이상임을 고정한다. EvidenceCard 1행은 `TraceArt` 36 타일(테두리 2 `var(--trace-mark)`), 보조 줄은 `TRACE_MARK_NOTE`("같은 옷을 입은 사람에게 표시" — 옛 `TRACE_NOTE` 삭제), 2행은 `PlaceArt` 32. RecordCard 는 `PlaceArt` 24. V2Icon 의 `place*` 16개와 `placeIconOf`, `TraceCard.tsx` 를 지웠다.
- **Task 2 (이름표 표시·사회자 문구).** HeadStack/NameTag 가 `traceMark`·`seenMark` 를 받아 이름 앞에 thread·eye 16 을 그리고 `data-trace-mark`·`data-seen-mark`(값 없음)를 단다. GameMap 은 `roleTagProps` 위에 `tagProps` 한 겹을 더해 `day.evidence` 로 같은 옷 좌석·목격자 좌석에 표시를 얹는다(기존 키는 덮지 않음). hostLine 은 trace 문장을 "흔적이 남았습니다. 같은 옷을 입은 사람을 표시했습니다." 로 고치고 `discussion.evidence` 를 witness 다음 우선순위로 더했다.
- **Task 3 (E2E).** lib.mjs 에 TC2 확장(2행 한 줄)·TC6(2행 표식 하나·count = 목격자 유무·넘침 없음)·TC7(흔적 구간 표시 좌석)·TC8(토론 유지·밤 0), `expectedMarks`/`sameOutfitSeatsE2E`/`TRACE_OF_OUTFIT_E2E`(제품 표와 같음을 e2eContract 가 고정). browser.mjs 에 `readMarks`, readTrace 확장. errand.mjs trace 흐름에 흔적 구간·토론·밤 읽기와 viewer 간 같은 좌석 집합 견줌(TR7~TR10)을 더했다.

## 검증 결과

- `npm run typecheck` 0, `npm test` **263 files / 7585 passed** (기준선 262 / 7559 + traceMark 시험 파일). 마지막 전체 실행 초록.
- `node --test scripts/e2e/lib.test.mjs` 386 통과.
- **로컬 E2E `--only trace,witness,day` (개발 서버, 360x640·390x664 두 크기 — 오케스트레이터 제약으로 6종이 아닌 2종):**

| 흐름 | 크기 | 통과/전체 |
| --- | --- | --- |
| day | 360x640 | 111/111 |
| trace | 360x640 | 51/51 |
| witness | 360x640 | 13/13 |
| day | 390x664 | 111/111 |
| trace | 390x664 | 51/51 |
| witness | 390x664 | 13/13 |

  실패 0. witness 의 알려진 flake(심부름 도달 16초)는 이번 실행에서 나타나지 않았다. 개발 서버는 껐다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 이름표·타일 표시 CSS 를 v2.css 가 아니라 evidence.css 에 둠**
- **Found during:** Task 1·2
- **Issue:** 계획은 v2.css 를 말했지만 v2parts 시험이 v2.css 의 `--brass-*`(예외 목록 밖)와 ellipsis 를 금지한다. 눈 아이콘 brass-200 과 증거 카드 규칙은 이미 evidence.css 가 맡고 있다.
- **Fix:** 타일 테두리·`.mv-tag[data-trace-mark]`·`.mv-tag__trace/seen` 을 evidence.css 에 두고 HeadStack 이 그 파일을 import 한다. hex 없음(시험 고정).
- **Files modified:** src/styles/evidence.css, src/components/v2/HeadStack.tsx
- **Commit:** ad18b692, c7c42b6f

**2. [Rule 3 - Blocking] 사회자 문구 변경이 E2E 문구 사본 계약(e2eContract)을 깨뜨림**
- **Found during:** Task 2 의 `npm test`
- **Issue:** `ERRAND_LINES.trace` 사본이 옛 문장이라 e2eContract 가 실패했다(`discussionEvidence` 사본도 필요).
- **Fix:** lib.mjs `ERRAND_LINES` 를 갱신하고 `discussionEvidence` 를 더했으며 e2eContract 기대값과 lib.test 를 맞췄다.
- **Files modified:** scripts/e2e/lib.mjs, scripts/e2e/lib.test.mjs, test/unit/e2eContract.test.ts
- **Commit:** c7c42b6f

**3. [Rule 2 - 누락된 필수 동작] discussion.evidence 의 빛남 대상 정의**
- **Found during:** Task 2
- **Issue:** `callTargetsOf` 가 새 키를 모르면 기록을 연 사람의 입력칸 빛이 흔적이 있는 날에만 사라진다.
- **Fix:** `discussion.evidence` 를 `discussion.act` 와 같은 채팅 단추로 처리하고 시험을 더했다.
- **Commit:** c7c42b6f

### 계획과 다르게 한 곳(결정)

- 계획의 acceptance 중 "로컬 E2E 폰 6종"은 오케스트레이터의 "1–2 크기, 6종 회귀는 16-10" 지시에 따라 360x640·390x664 로만 돌렸다. 6종 전체는 16-10 몫이다.
- 계획 TC6~TC8 은 `traceChecks`(TC2·TC6)와 새 `traceMarkChecks`(TC7 흔적 구간·TC8 낮/밤)로 나눴다.

## 알려진 한계

- **E2E 가 목격 표시와 서로 다른 의상을 거의 가리지 못한다.** trace 흐름의 손님들은 의상을 안 골라 모두 기본 의상(coat → "단추 하나")이라 같은 옷 좌석이 산 사람 7명 전원이고, 심부름을 하지 않아 목격자도 0명이다. 좌석 집합 일치·낮 유지·밤 소멸·viewer 간 동일성은 E2E 가, 서로 다른 의상 구분·목격자 표시는 client 시험(recordTrace GameMap, traceMark 단위)이 덮는다.
- 이름표 8자 이름 + 아이콘 둘의 줄바꿈·이웃 가림(UI Considerations #19)과 폰 6종 카드·띠·독·패널 교차(#18)는 계획상 backstop 이라 이번 실행은 360x640·390x664 의 TC5 교차 0 만 확인했다. 6종은 16-10.
- 같은 이름표 안에서 `.is-call`/`.is-blink` 의 box-shadow 와 표시 테두리가 겹치면 표시가 가려질 수 있다(빛남 대상 이름표는 투표·밤이라 흔적이 있는 토론과 겹치는 순간은 투표 단계). 눈에 띄는 문제는 아직 본 적 없고 실기기 확인은 UAT 몫.

## Known Stubs

없음.

## Threat Flags

없음 — 새 네트워크·인증·스키마 표면 없음. T-16-20(표식 값 비어 있음·viewer 간 같은 집합), T-16-21(discussion.evidence 는 day.evidence.trace 유무만, Proxy 시험), T-16-22(--trace-mark 는 닫힌 표) 모두 시험으로 고정했다.

## 커밋

| 해시 | 내용 |
| --- | --- |
| a78d2eeb | test(16-09): 같은 옷 표시·최종 증거 카드 실패 시험 |
| ad18b692 | feat(16-09): 조각 색·최종 증거 카드·컬러 그림 교체 |
| c75be782 | test(16-09): 같은 옷·마지막 목격 이름표 표시와 근거 문구 실패 시험 |
| c7c42b6f | feat(16-09): 같은 옷·마지막 목격 이름표 표시와 근거 문구 |
| 10a93c87 | test(16-09): E2E 아침 증거·이름표 표시 |

## Self-Check: PASSED

- 생성 파일: src/game/traceMark.ts, test/unit/traceMark.test.ts 존재. 삭제: src/components/v2/TraceCard.tsx 없음.
- 커밋 5개 모두 HEAD 의 조상. `grep -rn placeIconOf src test` 없음, V2Icon 의 `placeGlass` 0.
