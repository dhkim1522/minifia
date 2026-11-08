---
phase: 16-tutorial-and-evidence
plan: "08"
subsystem: ui-errand-map
tags: [react, css, errand, start-card, progress-dots, panelless, e2e, tdd, vitest, ERRAND-06, ERRAND-07]
requires:
  - phase: 16-07
    provides: 장소 타일·발밑 화살표·[처리] 알약, 독(칩 + n/3)과 panelKey, ER1 마크업 동일 판정
  - phase: 16-02
    provides: PlaceArt(시작 카드 아트 60)·PLACE_NAME
  - phase: 16-06
    provides: 오른쪽 열 .mv-side·data-side-button
provides:
  - startCardOn(view, serverNow)·ERRAND_CARD_MS(2초) 순수 판정
  - ErrandStartCard(막 + "오늘 갈 곳" 카드, 타일 84·아트 60, 눌림 통과)·ErrandDots(진행 점 3, role=group·aria-label '진행 n/3'·aria-live)
  - useErrandStartCard(2초 타이머 + 캡처 pointerdown 으로 닫되 누름은 막지 않음)
  - useMapInsets 의 panelless 분기(패널 없이 위 끝은 재고 아래 끝 0)
  - 아래 패널·독·칩 삭제(부품·CSS·표식), 스테이지가 화면 아래까지, 층이 진행 점 줄 윗변 − 8 위에만 타일·알약·화살표를 놓음
  - E2E EA11·EC1·EC2·EO5 와 ER1 이 점·카드까지 덮음
affects: [16-09, 16-10]
actuals:
  tokens: 90000
  tasks: 3
  commits: 5
plan_head_before: e5bc660eac6bb2916c0d1ce80f55b03eaa6060de
commits: 5
plan_head_after: c62b608646c5cf1c089a36afcc02327433df2b82
tech-stack:
  added: []
  patterns:
    - "패널 없는 단계는 useMapInsets 의 두 번째 인자(panelless)로 알린다 — 단계가 바뀌면 효과가 다시 패널 요소를 쥔다(16-07 의 panelKey 를 대신함)"
    - "시작 카드는 방 루트의 캡처 pointerdown 으로 닫되 전파·기본 동작을 건드리지 않는다 — 같은 누름이 바닥 걷기로 간다. 카드·막은 pointer-events none"
    - "층은 진행 점 줄을 두 번 쓴다: 스테이지 아래 끝을 점 줄 윗변으로 올리고(안쪽 여백 8 = 윗변 − 8), 점 줄 사각형(윗변 − 8)도 avoid 에 더한다"
key-files:
  created:
    - src/components/v2/ErrandStartCard.tsx
    - src/components/v2/ErrandDots.tsx
    - src/net/useErrandStartCard.ts
    - test/client/mapInsetsPanelless.test.tsx
  modified:
    - src/game/errandView.ts
    - src/net/useMapInsets.ts
    - src/screens/GameMap.tsx
    - src/components/WorldStage.tsx
    - src/styles/v2.css
    - src/styles/game.css
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs
    - scripts/e2e/browser.mjs
    - scripts/e2e/errand.mjs
  deleted:
    - src/components/v2/ErrandDock.tsx
    - test/client/mapInsetsPanelKey.test.tsx (panelless 시험으로 이름을 바꿔 다시 씀)
key-decisions:
  - "useMapInsets 두 번째 인자를 panelKey(문자열)에서 panelless(불린)로 바꿨다 — panelKey 는 채팅 ↔ 심부름 패널 요소 교체 때문에만 있었고 패널이 없어졌으니 같은 일을 panelless 가 한다"
  - "시작 카드 표시·닫기 상태는 GameMap 이 아니라 useErrandStartCard 훅(src/net)에 둔다 — GameMap 이 이미 크다. 닫은 단계는 phaseEndsAt 로 구분해 다음 판에는 다시 뜬다"
  - "카드 제목 글꼴(--font-serif)을 .mv-errand-start__title 에 쓴다 — UI-SPEC V-19 의 Heading 24 serif. tokensV2 의 serif 사용처 허용 목록에 그 규칙을 더했다"
requirements-completed: [ERRAND-06, ERRAND-07]
coverage:
  - id: D1
    description: "심부름 시작 2초 동안 막 위에 '오늘 갈 곳' 카드(내 장소 3 타일·아트 60·글자 두 줄, 단추 없음)가 뜨고 2초 뒤 스스로 사라지며, 재접속으로 2초가 지난 뒤 들어오면 처음부터 없다"
    requirement: ERRAND-06
    verification:
      - kind: unit
        ref: "test/unit/errandView.test.ts#시작 카드 표시 판정"
        status: pass
      - kind: unit
        ref: "test/client/errandScreen.test.tsx#errand 화면: 시작 카드 2초"
        status: pass
      - kind: e2e
        ref: "errand/start-card EC1 (360x640·390x844)"
        status: pass
    human_judgment: false
  - id: D2
    description: "카드가 떠 있어도 입력을 막지 않는다: 바닥을 누르면 걷고 그 누름에 카드가 닫힌다(T-16-19)"
    requirement: ERRAND-06
    verification:
      - kind: unit
        ref: "test/client/errandScreen.test.tsx#카드가 떠 있을 때 방 아무 곳 pointerdown 한 번이면 닫히고, 그 누름은 막히지 않는다"
        status: pass
      - kind: e2e
        ref: "errand/mafia EC2 (390x844)"
        status: pass
    human_judgment: false
  - id: D3
    description: "심부름 단계에 아래 패널·독·칩이 없고 화면 아래 가운데에 진행 점 3(끝낸 곳 채움, 보이는 글자 없음, aria 진행 n/3)이 있으며 스테이지가 화면 아래까지 넓어진다"
    requirement: ERRAND-07
    verification:
      - kind: unit
        ref: "test/client/errandScreen.test.tsx#errand 화면: 아래 패널 없음·진행 점"
        status: pass
      - kind: unit
        ref: "test/client/mapInsetsPanelless.test.tsx"
        status: pass
      - kind: e2e
        ref: "errand/arrive EA·EA11·EO5 (360x640·390x844)"
        status: pass
    human_judgment: false
  - id: D4
    description: "타일·알약·화살표는 진행 점 줄 윗변 − 8 위에만 놓이고 점 줄과 겹치지 않는다"
    requirement: ERRAND-07
    verification:
      - kind: unit
        ref: "test/client/worldStage.test.tsx#진행 점 줄([data-errand-dots]) 윗변 − 8 아래로 걸치는 타일은 그리지 않고 그 위는 그린다"
        status: pass
      - kind: e2e
        ref: "errand/arrive·in-range·mid EO (360x640·390x844)"
        status: pass
    human_judgment: false
  - id: D5
    description: "마피아와 시민의 점·시작 카드 마크업이 같다(역할·가짜 표식 없음)"
    requirement: ERRAND-07
    verification:
      - kind: unit
        ref: "test/client/errandScreen.test.tsx#errand 화면: 마피아와 시민은 같은 DOM"
        status: pass
      - kind: e2e
        ref: "errand/d03 EF7 (ER1) 390x844"
        status: pass
    human_judgment: false
duration: 55min
completed: 2026-11-08
status: complete
---

# Phase 16 Plan 08: 시작 카드·진행 점·아래 패널 없는 심부름 Summary

**심부름이 2초 "오늘 갈 곳" 카드로 시작하고, 아래 패널(독)은 사라져 화면 아래 가운데 진행 점 3 만 떠 있으며, 맵이 화면 아래까지 넓어졌다. 타일·화살표·[처리]는 점 줄 윗변 − 8 위에만 놓인다.**

## Accomplishments

- `startCardOn(view, serverNow)`: 서버 시계 기준 `phaseEndsAt − ERRAND_MS` 부터 `ERRAND_CARD_MS`(2초) 안일 때만 참. 유령·목록 없음·다른 단계·끝 시각 없음은 거짓이라 재접속으로 늦게 들어오면 카드는 처음부터 없다(맵의 점·타일이 같은 목록을 보인다).
- `ErrandStartCard`: 막(`--scrim`) + 카드(night-800, brass-400 테두리 1, 모서리 20, 폭 화면 − 48, 위 `max(띠 아랫변 + 40, 232)`) + 제목 "오늘 갈 곳"(serif 24 brass-200) + 84 타일 3(아트 60, 이름은 `role=img` aria-label '{장소} 장소'만) + 한 줄 "가는 길에 본 사람이 기록돼요". 단추·tabindex 없음, 카드·막은 `pointer-events: none`, 등장은 opacity `dur-fast`(모션 줄이기면 즉시). 마피아도 같은 3 타일.
- `useErrandStartCard`: 카드가 떠 있는 동안만 방 루트에 캡처 단계 pointerdown 리스너를 달아 첫 누름에 닫고 그 누름은 막지 않는다(전파·기본 동작 그대로 — 같은 누름으로 걷는다). 2초 타이머로 한 번 다시 그려 스스로 사라지고, 닫힘·언마운트 때 리스너·타이머를 푼다. 닫은 단계는 `phaseEndsAt` 로 구분한다.
- `ErrandDots`: 점 3(지름 20, 테두리 3 brass-400, 끝낸 곳 채움, 간격 12, 아래 40 + 안전 영역), 보이는 글자 없음, `role="group"` + `aria-label="진행 n/3"` + `aria-live="polite"` + `data-errand-progress`. 점은 포커스·눌림을 받지 않는다.
- 독 삭제: `ErrandDock.tsx`·`.mv-errand-dock/chip`·`.mf-game__panel--errand` 를 지웠다. `grep -rn "ErrandDock|data-errand-dock|data-errand-chip|mv-errand-dock|mv-errand-chip|panel--errand" src` 는 결과가 없다. GameMap 의 심부름 단계는 `section[data-world-panel]` 자체를 그리지 않는다(유령·목록 없음 포함).
- `useMapInsets(turnActive, panelless)`: 패널 없이도 위 끝은 헤더·띠 아랫변으로 재고 아래 끝은 0 으로 알린다. 단계가 바뀌면(errand ↔ discussion) 다시 잰다. 16-07 의 `panelKey` 를 이 인자가 대신한다.
- WorldStage `writeErrandLayer`: `[data-errand-dots]` 를 RECT_TTL 캐시로 재어 스테이지 아래 끝을 점 줄 윗변으로 올리고(안쪽 8 = 윗변 − 8) 점 줄 사각형(윗변 − 8 부터)을 avoid 에 더한다. 알약이 뒤집혀도 점 줄 위에 선다.
- E2E: EA1·EA2·EA3 를 점·패널 0 기준으로 고치고 EA11(점 줄 1·aria·live·글자 0), EC1(2초 안 카드 1·타일 3·단추 0·글자 두 줄 / 2.5초 뒤 0), EC2(카드 중 걷기·닫힘), EO5(점 줄 아랫변 = 창 아래 − 40 ± 2)를 더했다. EO3 는 점 줄(윗변 − 8 부터)과 겹침 0, EO4 의 스테이지는 띠 아랫변 ~ 점 줄 윗변이다. ER1 서명이 점 줄·시작 카드까지 덮는다(`ERRAND_PARITY_COUNTED` 7개).

## TDD

- **RED 1** `0c8e99f4`: startCardOn 4건 실패(`startCardOn is not a function` — 대상 단언 실패), 부품·스타일 시험은 모듈이 없어 파일 단위로 실패(불러오기 실패 — 단언 수준의 RED 는 아님. 부품이 신규 파일이라 import 실패가 곧 "아직 없음"이다). `gsd_run check tdd-red-evidence` 는 쓰지 않았다(vitest 기본 보고서 형식으로 기록을 따로 남기지 않음).
- **GREEN 1** `f1a70f37`: 60건 통과.
- **RED 2** `82646d32`: 13건 실패(진행 점·패널 없음·카드 2초·닫기·재접속·panelless·점 줄 피하기·독 CSS 부재) — 모두 계획한 단언의 실패.
- **GREEN 2** `e61fef46`: 관련 시험 통과, typecheck·전체 시험 통과.
- REFACTOR 커밋은 없다.

## Task Commits

| # | 커밋 | 내용 |
|---|------|------|
| 1 RED | 0c8e99f4 | `test(16-08): 시작 카드·진행 점 실패 시험` |
| 1 GREEN | f1a70f37 | `feat(16-08): 시작 카드·진행 점 부품` |
| 2 RED | 82646d32 | `test(16-08): 독 삭제·진행 점·시작 카드 화면 실패 시험` |
| 2 GREEN | e61fef46 | `feat(16-08): 심부름 아래 패널 없애고 시작 카드·진행 점 연결` |
| 3 | c62b6086 | `test(16-08): E2E 시작 카드·진행 점·독 0건·점 줄 교차` |

## 시험 결과

- `npm run typecheck` 통과. `npm test`: 262 파일 / 7559 시험 통과(기준선 7544 → +15), 건너뜀 261.
- `node --test scripts/e2e/lib.test.mjs`: 381 통과·0 실패. `test/unit/e2eContract.test.ts` 통과.
- 로컬 E2E(`npm run dev` 를 띄우고 `--url http://localhost:5173`, 사용자 지시로 폰 6종이 아니라 360x640·390x844 두 크기만):
  - `--only errand --sizes 360x640,390x844`: 360x640 22/22, 390x844 27/27 통과(EC1·EC2·EA11·EO5·ER1 포함).
  - `--only witness --sizes 390x844`: 4번 중 3번 13/13 통과, 360x640 은 4번 중 2번 통과. 실패는 모두 `S4 단계 도달: 심부름 N번째 장소를 16초 안에 처리하지 못함`(아래 "이월" 참고).
  - 개발 서버는 모두 껐다. 배포는 하지 않았다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - 막는 문제] `useMapInsets` 두 번째 인자 이름 충돌**
- 계획은 `useMapInsets(turnActive, panelless)` 인데 16-07 이 두 번째 인자를 `panelKey` 로 이미 쓰고 있었다. `panelKey` 의 목적(채팅 ↔ 심부름 패널 요소 교체 때 다시 재기)은 패널이 없어지며 사라지므로 인자를 `panelless: boolean` 으로 바꾸고 `mapInsetsPanelKey.test.tsx` 를 `mapInsetsPanelless.test.tsx` 로 다시 썼다.

**2. [Rule 3 - 막는 문제] 색·글꼴 규약 시험 갱신**
- `v2parts.test.tsx` 의 "놋쇠 토큰 금지" 제외 목록에 `.mv-errand-(start|dot)`, `errandParts.test.tsx` 의 "놋쇠는 pin·act·arrow 에만" 목록에 `start|dot`, `tokensV2.test.ts` 의 serif 사용처에 `.mv-errand-start__title`, `e2eContract.test.ts` 의 `ERRAND_MARKERS` 개수(13 → 14)를 UI-SPEC V-19·V-23 값대로 고쳤다.

**3. [Rule 3 - 막는 문제] 훅을 새 파일로 분리**
- 계획 files_modified 에 없는 `src/net/useErrandStartCard.ts` 를 만들었다(GameMap 에 인라인하면 이미 큰 파일이 더 커진다).

**4. [Rule 1 - 버그] `readRecord` 의 `kindOf` 미정의**
- `scripts/e2e/browser.mjs` 의 `readRecord` 가 `kindOf` 를 쓰는데 그 evaluate 안에 정의가 없어 witness 흐름이 `ReferenceError` 로 죽을 수 있었다(16-07 이전부터). 같은 한 줄을 정의해 고쳤다(`c62b6086` 에 포함).

**5. [Rule 2 - 진단] 장소 처리 시간 초과 때 화면 상태를 오류에 남김**
- `doPlace` 가 시간 초과로 던질 때 진행·타일 상태·알약 중심 점의 맨 위 요소를 함께 적는다(witness 의 반복 실패 원인을 가리려고 더했고 판정 문턱은 건드리지 않았다).

### 계획과 다르게 한 것

- 시작 카드 E2E 는 `errand` 흐름 안에서 도착 2초 안에 읽는다(마피아 판은 서명 + 카드 중 걷기, 시민 판은 서명 + EC1). 폰 6종이 아니라 사용자 지시의 두 크기로만 돌렸다.
- 점 줄은 스테이지 아래 끝을 올리는 것과 avoid 사각형 두 가지로 처리했다(계획은 avoid 만 적었다). 알약이 뒤집힐 때 점 줄 쪽으로 내려가는 일이 없다.

## 이월 / 알려진 문제 (Deferred Issues)

- **witness E2E 의 장소 처리 시간 초과 flake(16-07 이전부터)**: 16-07 이 끝난 커밋(`e5bc660e`)을 따로 띄워 `--only witness --sizes 390x844` 를 돌려도 `심부름 2번째 장소를 16초 안에 처리하지 못함` 으로 실패했다(이 계획의 변경과 무관). 360x640 에서 본 상태는 (a) 가까운 장소 타일이 숨겨져 있고 알약이 있는데 눌러도 진행이 안 오른 경우 한 번, (b) 보이는 타일 `stool` 을 누르는데 16초 안에 반경 안에 닿지 못한 경우 한 번. 장소 위치·걸어서 닿는 자리(장애물)·두 사람이 동시에 걷는 상황이 원인 후보라 16-10 의 한 번 돌리기 전에 원인을 가려야 한다(제품 문제라면 처리 반경 안에 못 닿는 장소가 있다는 뜻). 판정 문턱은 낮추지 않았다.
- `test/worker/bots.test.ts`(밤 채팅) flake 는 이번 전체 시험에서는 나오지 않았다.

## Known Stubs

없음. 점·카드 모두 `me.errand` 에서 실제 값을 읽는다.

## Threat Flags

없음. 새 서버 값·엔드포인트 없음(T-16-18: 마피아도 같은 3 타일·같은 점 수, 표식 값은 숫자·n/3 뿐 — ER1 이 점·카드까지 덮는다. T-16-19: 카드는 눌림을 통과하고 닫기 리스너는 막지 않는다 — EC2 가 확인).

## Self-Check: PASSED

- 파일: `src/components/v2/ErrandStartCard.tsx`·`ErrandDots.tsx`·`src/net/useErrandStartCard.ts`·`test/client/mapInsetsPanelless.test.tsx` 있음, `src/components/v2/ErrandDock.tsx` 없음.
- 커밋 5개(0c8e99f4·f1a70f37·82646d32·e61fef46·c62b6086)가 HEAD 의 조상이다.
