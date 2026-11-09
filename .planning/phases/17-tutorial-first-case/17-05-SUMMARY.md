---
phase: 17-tutorial-first-case
plan: "05"
subsystem: tutorial
tags: [tutorial, scenes, reveal, evidence-links, tdd, tracer]
status: complete

requires:
  - phase: 17-04
    provides: TutorialScreen 의 renderSceneLayer·장면 6 처리기 onPoint·TutorialHostBand shake·FocusRing·감독 훅
  - phase: 17-03
    provides: 대본(TUTORIAL_CAST·TUTORIAL_PICK·WRONG_HINT_AFTER·tutorialView·tutorialSuspectWalk)과 정적 가드
provides:
  - "src/components/v2/TutorialReveal.tsx: 정체 공개 카드(뒤집기·도장 '정답'·불꽃 14·'로 찾아냈어요' 줄), 출연 상수와 roleArtSrc('mafia') 고정 그림만 쓴다"
  - "src/components/v2/TutorialEvidence.tsx: TutorialEyeMark(이름표 위 36 원 눈)·TutorialLinks(선 두 개)·TutorialFormula('눈 + 흔적 = 의심')"
  - "TutorialScreen 장면 6 지목 처리(정답·오답·정체 공개·[다음]), 장면 4 눈 표시 + 실제 RecordCard 층, 장면 5 선·수식 층"
  - "tutorialSuspectStand(now): 모션 줄이기 장면 4 의 도윤 제자리 snap"
  - "playTutorialCue·sayTutorialLine: 화면이 엔진 play 를 직접 부르지 않고 거치는 감독 훅 모듈의 낱개 함수"
affects: [17-06, 17-07, 17-08, 17-09, 17-10]

actuals:
  tokens: 28700
  tasks: 2
  commits: 4
plan_head_before: 3b2ba751c08a4623d2eec3a66001d2aae8765213
plan_head_after: bd050d3fa865cd9c9e43e8aae29c808bc0596491

tech-stack:
  added: []
  patterns:
    - "장면 6 상태(picked·wrong·revealed)는 장면 시작 시각(at)을 같이 들고 있어 장면이 바뀌면 저절로 깨끗해진다 — 17-04 의 '장면 번호에 묶인 상태' 규칙을 이어 씀"
    - "정답은 picked 가짜 view(tutorialView(6, {picked:true}))로 실제 득표 배지·이름표 테두리 경로를 타고, 위 알림은 GameMap 의 toast prop 에 넣는다(진짜 TopToast)"
    - "연결 선·눈 표시는 마운트 때 한 번 바로 재고 이후 rAF 로 잰다(직전과 같으면 상태 불변). 끝점을 못 쟀으면 그리지 않는다"
    - "선 그리기는 pathLength=1 + stroke-dashoffset 한 키프레임, 지연은 --tut-delay 사용자 변수, 색은 닫힌 표 TRACE_MARK 의 --trace-mark"
    - "장면 4 기록 카드는 GameMap 과 같은 자리 클래스(.mf-game__record)를 써서 허용 목록 밖으로 자동 inert 가 붙는다"

key-files:
  created:
    - src/components/v2/TutorialReveal.tsx
    - src/components/v2/TutorialEvidence.tsx
    - test/client/tutorialScenes.test.tsx
  modified:
    - src/screens/TutorialScreen.tsx
    - src/styles/tutorial.css
    - src/styles/phase.css
    - src/game/tutorialScript.ts
    - src/net/useTutorialDirector.ts
    - test/client/tutorialScreen.test.tsx

key-decisions:
  - "띠 흔들림 클래스는 계획 본문의 .tut-band--shake 가 아니라 17-04 가 이미 만들고 시험으로 고정한 .tut-band.is-shake 를 그대로 쓴다 — 같은 일을 하는 클래스를 둘 만들지 않았다"
  - "오답마다 GameMap 에 새 view 객체를 준다(내용은 같음). GameMap 의 useViewChoice 가 view 가 바뀌면 임시 '내 선택' 표시를 비우므로, 표가 없는데 이름표에 내 선택 테두리가 남는 일을 막는다"
  - "장면 4 기록 카드는 UI-SPEC 의 '아래'(시안 top 600)보다 계획의 '자리 클래스는 GameMap 기록 카드 자리와 같게(D+8)'를 따라 띠 독 아래 8 에 둔다 — 실제 게임과 같은 자리이고 inert 가 자동으로 붙는다. 이름표를 가리는지는 실기기 확인 몫"
  - "수식 줄 bottom 96px = [다음] 아래 28 + 높이 56 + 12. 시험이 tutorial.css 의 .tut-next 값으로 계산해 고정한다"
  - "수식 줄은 장식이라 aria-hidden 으로 두고 새 접근성 문구를 만들지 않았다(같은 내용이 띠 문장·증거 카드에 이미 읽힌다)"
  - "화면은 엔진 play 를 직접 부르지 않는다(소리 호출 자리 규칙) — playTutorialCue·sayTutorialLine 을 감독 훅 모듈에 두고 거친다"

requirements-completed: []

duration: 약 25분
completed: 2026-11-09
---

# Phase 17 Plan 05: 장면 4·5·6 연출 Summary

장면 6 에서 도윤을 지목하면 도장 소리 → 실제 TopToast '나 → 도윤'과 득표 배지 → 1.1초 뒤 정체 공개(카드 뒤집기·'정답' 도장·놋쇠 불꽃·'로 찾아냈어요')가 나오고, 오답은 버저와 띠 흔들림, 오답 두 번 뒤 도윤 하나만 깜빡인다. 장면 4 는 도윤이 걸어 들어와 눈 표시와 실제 목격 기록 카드를 띄우고, 장면 5 는 실제 증거 카드 위에 선 두 개와 '눈 + 흔적 = 의심' 수식을 그린다.

## Accomplishments

- **트레이서(Task 1, 장면 6)**: `onPoint` 가 정답(도윤)이면 `tut.stamp` → `picked` 가짜 view(실제 득표 경로, `day.points = [{5→1}]`)와 위 알림 '나 → 도윤'(GameMap `toast` prop) → 포커스 상자 0개 → 1100ms 뒤 `TutorialReveal` + `tut.fanfare` + [다음]. 오답은 `tut.buzz` + 띠 문장 '흔적을 떠올려 보세요' + 띠 흔들림, `WRONG_HINT_AFTER`(2) 번 뒤 포커스가 도윤 이름표 하나(알약)만 남는다. 정답 뒤 눌림은 무시한다.
- **TutorialReveal**: UI-SPEC '정체 공개' 값 그대로 — `--scrim` 막(dur-fast), 카드 240·night-800·radius-lg·shadow-card, 그림 144×192(crimson-500 45% 후광), '도윤 님은'·'마피아'(crimson-300), 도장 '정답'(serif 36, brass 테두리 3, 0.6초 지연 stamp 0.42초), 불꽃 14(brass-400·light-lamp 교대, 반지름 120/150/180, 0.55초 지연), 줄 눈 + '+' + thread + '로 찾아냈어요'(fadeup .9초 지연). 모션 줄이기면 뒤집기·불꽃·도장 클래스와 불꽃 점이 아예 없다. 진홍은 `.tut-reveal*` 선택자 안에만 있고 `phase.css` 머리 주석의 진홍 예약에 튜토리얼 두 항목을 더했다.
- **장면 4(Task 2)**: 도윤 걷기는 17-04 가 이미 넣었고(`enterWorld`), 이번에 모션 줄이기면 걷지 않고 끝점에 서 있게 했다(`tutorialSuspectStand`). 감독 훅의 `tut.eye` 큐(1.9초)에 맞춰 `TutorialEyeMark`(도윤 이름표 위 36 원, rAF 로 이름표를 재서 위치) + 실제 `RecordCard`(도윤 + 가로등 한 줄, 기록 카드 자리 `.mf-game__record` 라 inert 가 자동으로 붙어 닫기 단추가 눌리지 않는다).
- **장면 5**: GameMap 이 이미 그리는 실제 증거 카드·이름표 표시 위에 `TutorialLinks`(svg 두 선: 조각 타일 → 도윤 `--trace-mark` 2.5·0.4초, 목격 행 도윤 이름 → 도윤 `brass-200` 2·0.9초, 끝은 이름표 위 가장자리 30%·70% 지점, 못 쟀으면 그리지 않음)와 `TutorialFormula`(눈 원 48 + '+' + 흔적 원 48 + '=' + 손 아이콘 '의심' 알약, 1.6초 지연, 아랫변이 [다음] 윗변 − 12 위).

## Task Commits

1. **Task 1 RED:** `2bd9adc8` — `test(17-05): 장면 6 투표·정체 공개 실패 시험`
2. **Task 1 GREEN (tracer):** `388d9581` — `feat(17-05): 장면 6 지목·정체 공개·오답 도움`
3. **Task 2 RED:** `624ac4ef` — `test(17-05): 장면 4 목격·장면 5 증거 실패 시험`
4. **Task 2 GREEN:** `bd050d3f` — `feat(17-05): 장면 4 목격·장면 5 증거 연결`

## TDD Gate Compliance

- **Task 1 RED** (`2bd9adc8`): `npx vitest run test/client/tutorialScenes.test.tsx test/client/tutorialScreen.test.tsx` — tutorialScenes 8개 전부 실패(`expected +0 to be 1` buzz·stamp 횟수, `expected <button …> to be null`(정답이 곧바로 장면 7 로 가서 [다음]/공개가 없음), `Cannot read properties of undefined (reading 'querySelector')`(공개 카드 없음), `expected … to match /\.tut-reveal__card\s*\{/`), tutorialScreen 의 장면 6 정답 시험 1개 실패(`expected '7' to be '6'`). 첫 실행 때 시험 파일 자체의 문법·`import.meta.url` 오류가 있어 RED 증거로 쓰지 않고 고친 뒤 위 실패를 증거로 삼았다.
- **Task 1 GREEN:** 4파일 83개 통과, `npm run typecheck` 종료 코드 0. 중간에 정적 가드가 `useDayFx` 타입 import 를 '실제 연결 훅'으로 잡아 지역 인터페이스로 바꿨다.
- **트레이서 게이트:** Task 1 `<verify>` 는 자동 항목뿐(`HUMAN_VERIFY_MODE` 기본 end-of-phase, 자동 모드 아님)이라 재실행해 통과를 확인하고 `Tracer verified end-to-end — expanding` 으로 Task 2 에 들어갔다.
- **Task 2 RED** (`624ac4ef`): 22개 중 8개 실패(눈 표시 개수 `expected  to have a length of 1 but got +0`, 선·수식 `expected null not to be null`, 모션 줄이기 도윤 위치 `expected 3.31… to be less than 0.1`, 수식 bottom `expected NaN to be greater than or equal to 96`). 걷기 구간·증거 카드 표시는 이미 통과하던 항목(17-04·GameMap 이 이미 함).
- **Task 2 GREEN:** 5파일 144개 통과, typecheck 0, `npm test` 전체 통과(274 파일 통과·6 건너뜀, 7844 시험).
- REFACTOR: 없음.

## Acceptance Criteria

| 기준 | 결과 |
|------|------|
| Task 1: `test -f src/components/v2/TutorialReveal.tsx` | PASS |
| Task 1: `grep -c WRONG_HINT_AFTER src/screens/TutorialScreen.tsx` ≥ 1 | PASS (4) |
| Task 1: `grep -c 튜토리얼 src/styles/phase.css` ≥ 2 | PASS (2) |
| Task 1: `npx vitest run test/client/tutorialScenes.test.tsx` 통과 | PASS |
| Task 2: `TutorialEvidence.tsx` 존재 + `export function` ≥ 3 | PASS (3) |
| Task 2: `grep -c tutorialSuspectWalk src/screens/TutorialScreen.tsx` ≥ 1 | PASS (2) |
| Task 2: `npm test` 전체 통과 | PASS (274 파일·7844 시험) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 화면이 엔진 `play` 를 직접 불러 소리 호출 자리 규칙 위반**
- **Found during:** Task 2 `npm test` (Task 1 GREEN 때는 지정 시험만 돌려 놓쳤다)
- **Issue:** Task 1 GREEN(`388d9581`)의 `TutorialScreen` 이 `getEngine().play(...)` 를 불러 `test/client/soundButton.test.tsx` '컴포넌트·화면에서 엔진의 play… 부르는 곳이 없다' 가 깨졌다.
- **Fix:** 감독 훅 모듈(`src/net/useTutorialDirector.ts`)에 `playTutorialCue`·`sayTutorialLine` 을 두고 화면은 거기를 거친다.
- **Files modified:** src/net/useTutorialDirector.ts, src/screens/TutorialScreen.tsx
- **Commit:** `bd050d3f`

**2. [Rule 3 - Blocking] 정적 가드가 `useDayFx` 타입 import 를 금지 항목으로 잡음**
- **Found during:** Task 1 GREEN
- **Issue:** 위 알림 prop 의 `PointToastShow` 타입이 `useDayFx` 에 있어 import 하면 '실제 연결 훅' 위반.
- **Fix:** 같은 모양의 지역 인터페이스 `PointToast` 를 화면에 두었다.
- **Files modified:** src/screens/TutorialScreen.tsx
- **Commit:** `388d9581`

**3. [Rule 3 - Blocking] 모션 줄이기용 도윤 snap 이 계획 파일 목록에 없음**
- **Found during:** Task 2
- **Issue:** '모션 줄이기면 도윤은 snap' 에는 나 + 도윤이 끝점에 선 snap 프레임이 필요한데 대본 모듈에 없었다.
- **Fix:** `tutorialSuspectStand(now)` 를 `src/game/tutorialScript.ts` 에 추가했다(순수 함수, 기존 snapOf 재사용).
- **Files modified:** src/game/tutorialScript.ts
- **Commit:** `bd050d3f`

**4. [Rule 1 - Bug 예방] 오답 뒤 이름표에 '내 선택' 테두리가 남는 문제**
- **Found during:** Task 1 설계
- **Issue:** GameMap 이 이름표를 누르면 임시 '내 선택'(mine)을 서 두는데, 오답은 표가 아니라서 brass 테두리가 오답 이름표에 남으면 정답 신호와 헷갈린다.
- **Fix:** 오답마다 같은 내용의 새 view 객체를 줘서(`useViewChoice` 가 view 가 바뀌면 비움) 표시를 지운다. 시험으로 고정하지는 않았다(가짜 WorldStage 는 테두리를 그리지 않는다) — 17-09 E2E 에서 눈으로 확인할 항목.
- **Files modified:** src/screens/TutorialScreen.tsx
- **Commit:** `388d9581`

### 계획과 달라진 선택(결함 아님)

- 띠 흔들림 클래스: 계획 `.tut-band--shake` 대신 17-04 의 `.tut-band.is-shake` 유지(키 결정 참고).
- 17-04 의 `tutorialScreen.test.tsx` '정답 → 장면 7' 시험을 '정답 → 1100ms 뒤 공개 → [다음] → 장면 7' 로 갱신했다(계획한 동작 변경 — RED 커밋에 포함).
- 연결 선·눈 표시 시험을 위해 `data-from`·`data-to`(선 끝점 좌표) 속성을 선 path 에 둔다. 장식 svg 라 접근성에는 영향이 없다.

**Total deviations:** 4 auto-fixed (Rule 1 ×2, Rule 3 ×2). **Impact:** 범위 변화 없음, 규칙 위반 한 건은 같은 계획 안에서 고쳐졌다.

## Known Stubs

없음. 정체 공개 이름·그림은 출연 상수라 고정이 의도이고, 장면 4 기록 카드 한 줄(도윤·가로등)도 출연 상수다.

## Threat Flags

없음. T-17-12(정체 공개가 실제 역할과 이어짐)는 `TutorialReveal` 이 출연 상수 이름과 `roleArtSrc("mafia")` 고정 그림만 받아 실제 view·역할을 읽지 않고, 정적 가드(`tutorialStaticGuard`)가 `Tutorial*` 파일을 자동 포함해 통과한다. 튜토리얼 트리 밖 0건 확인은 17-09 E2E 몫이다.

## 17-09 E2E·실기기로 넘기는 확인 항목

- 폰 6종에서 정체 공개의 카드·도장·'찾아냈어요' 줄과 [다음]이 교차하지 않고 화면 안에 있다(backstop). 카드 묶음에 위 64·아래 100 여백을 두어 [다음](아래 28·높이 56)을 피하게 했지만 실측은 하지 않았다.
- 장면 4 기록 카드가 띠 독 아래(top = dock + 8)에 놓여 걸어 들어오는 도윤 이름표·눈 표시를 가리는지.
- 장면 5 선 끝점이 실제 증거 카드 조각 타일·목격 행 도윤 이름과 도윤 이름표에 시각적으로 닿는지(jsdom 은 사각형 모킹으로만 확인).
- 오답 뒤 이름표에 '내 선택' 테두리가 남지 않는지(위 편차 4).
- `test/worker/bots.test.ts` 가 전체 시험 한 번에서 `nextFrame` 제한 시간으로 실패했다가 다시 돌리니 통과했다(이 계획과 무관한 시간 의존 불안정으로 보인다).

## Self-Check: PASSED

- 파일: `src/components/v2/TutorialReveal.tsx`, `src/components/v2/TutorialEvidence.tsx`, `test/client/tutorialScenes.test.tsx` 존재 확인.
- 커밋: `2bd9adc8`, `388d9581`, `624ac4ef`, `bd050d3f` 모두 HEAD 의 조상.
- 위생 검사(`git grep -nIiE "torder|티오더|조직|회사|~/project"`): 이 계획 변경분에 새 히트 없음(`seatOrdered` 는 기존).
