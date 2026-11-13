---
phase: 21-cause-effect-missions
plan: "16"
subsystem: e2e-causal-day
tags: [e2e, causal-day, causal-leak, causal-sizes, dom-shape-diff, lamp, house-pick, clue-spot, suspect-board, leak]
requires:
  - phase: 21-cause-effect-missions
    provides: 21-11 SceneDock(저녁 독)·21-12 HousePick(밤 집 판)·21-13 ClueSpot·ClueChip·LampOffMark(아침 현장)·21-14 SuspectBoard(의심 보드)·21-15 튜토리얼 E2E(gLine G3k 참고 줄 방식)
provides:
  - 새 E2E 흐름 셋 causal-day(390×844 한 판 완주)·causal-leak(참가자 탭 둘 DOM 구조 비교)·causal-sizes(폰 6종 겹침·보임) 와 --only causal 등록
  - lib.mjs 판정 순수 함수(causalDayChecks·causalEveningChecks·nightPlateChecks·causalWindowChecks·sceneSpotChecks·boardChecks·domShapeDiff·causalReducedChecks)·CAUSAL_MARKERS·사본 상수(독 높이·밤 배율 식·가로등·단서 지점)
  - 실브라우저 E2E 가 찾은 앱 결함 둘의 수정(의심 보드 닫기·목격 칩이 눌리지 않던 것, 목격 칩 누르기 높이 32)
affects: [21-17, 21-18]
requirements-completed: [D-21, D-24, D-25, D-26, D-29]
actuals:
  tokens: 28000
  tasks: 3
  commits: 5
plan_head_before: d5a95fbfa15e01bbaeb6d0c6b1fadcd536ce508a
plan_head_after: b497a4932c45cb694f2abe75b6e854d6f8e24cf8
commits: 5
tech-stack:
  added: []
  patterns:
    - "판정은 lib.mjs 순수 함수 + lib.test.mjs 고정 입력 표, 흐름(causal.mjs)은 화면·훅을 읽어 넘기기만 한다. 사본 상수는 e2eContract 가 앱 값과 대조(CAUSAL_MARKERS 는 src 추적 파일에 있는지까지)"
    - "마피아·시민 DOM 비교는 outerHTML 을 태그·속성 이름·정렬한 클래스로만 줄(경로)로 바꿔 줄 개수를 견준다(domShapeDiff). 값·글·좌표는 결과 줄에 싣지 않는다. 두 겹: 월드 밖은 엄격, 월드 층은 위치로 켜지는 표시만 뺀다"
    - "한 탭이 보낸 프레임은 WebSocket.prototype.send 를 init 스크립트로 감싸 t(+hold 여부)만 모은다 — 길게 누르기·pick 횟수를 클라이언트 쪽에서 센다"
key-files:
  created:
    - scripts/e2e/causal.mjs
    - test/unit/suspectBoardCss.test.ts
  modified:
    - scripts/e2e/flows.mjs
    - scripts/e2e/browser.mjs
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs
    - test/unit/e2eContract.test.ts
    - src/styles/game.css
    - src/styles/v2.css
key-decisions:
  - "causal-leak 의 비교 상대는 방장이 아니라 참가자 탭 둘(마피아 참가자·마피아 아닌 참가자)이다. 방장 탭과 비교하면 방장 전용 [테스트 도구] 단추와 입장 줄 같은 방장 여부의 차이가 끼어(첫 실행에서 확인) 역할의 차이를 가를 수 없다. 방장은 시민으로 두고 참가자 셋·봇 둘(마피아 참가자와 마피아 아닌 참가자가 모두 나올 확률 90%, 안 되면 새 방)"
  - "허용 목록은 계획의 둘(밤 행동 줄·산 마피아 합의 배지)에 더해 21페이즈 이전부터 있던 본인 역할 일지의 새 기록 점(mf-rolecard-btn__dot — 마피아·경찰·의사 일지, 시민은 없음)과 채팅 기록 줄 안쪽(입장 줄·경찰 조사 카드: 입장 순서와 본인 일지에 따른 방 내용)을 뺐다. 기록 창 자체와 입력줄은 비교한다"
  - "월드 층(장소 타일·지점 표식·집 판·이름표)은 내 위치로 켜지는 표시(data-call·data-rest·data-front·data-ring·is-call·hidden·style)만 빼고 같음을 본다. 월드 밖(헤더·독·패널)은 속성 이름·클래스를 그대로 견준다"
  - "모션 줄이기 '전환 0' 은 앱 전역 규칙(base.css prefers-reduced-motion 이 animationend 를 살리려고 쓰는 0.01ms)까지 즉시로 본다(상한 1ms). 일반 모드의 600ms 채움 막대·카드 올라옴과는 자릿수가 다르다"
  - "카드 줄이 '이미 살핀(done·blurred)' 표식을 덮는 것은 참고 줄(LH6i)이고, 아직 안 살핀(fresh) 표식을 덮으면 실패다. 360×560 은 UI-SPEC 이 알려진 한계로 둔 폰이라 모든 표식이 참고 줄. 360×640·390×664 에서 카드 세 장(두 줄)이 이미 살핀 표식 둘을 덮는 것이 실제로 관측됐다"
  - "아침 지점 준비 판정은 DOM 의 data-call 이 아니라 위치(__mfWorld.sample)와 단서 지점 사본으로 한다 — 지점 표식의 data-call 은 '가장 가까운 안 살핀 지점'이 반경 밖일 때만 켜지고, 반경 안이면 독 [살펴보기] 가 켜져 어느 지점을 살필지 DOM 에 없다. 서버는 반경 안의 가장 가까운 안 살핀 지점을 살핀다"
metrics:
  duration: 약 3시간
  completed: 2026-11-13
status: complete
---

# Phase 21 Plan 16: 원인→결과 하루 화면 E2E Summary

확장판 한 판(저녁 가로등 → 밤 집 찾기 → 아침 현장 → 의심 보드 → 처형 다음 저녁)을 실제 화면 조작으로 걷는 causal-day 와, 마피아·시민 탭의 DOM 구조 비교 causal-leak, 폰 6종 겹침 causal-sizes 를 만들었고 모두 로컬 dev 서버에서 통과했다. 그 과정에서 실브라우저만 잡을 수 있는 앱 결함 둘(의심 보드 닫기가 눌리지 않음, 목격 칩 누르기 32)을 찾아 고쳤다.

## RED 증거

- Task 1 RED: `SyntaxError: The requested module './lib.mjs' does not provide an export named 'CAUSAL_CLUE_SPOTS'` (`0ab1b41b`, lib.test.mjs·e2eContract 대조를 먼저 커밋)
- 앱 결함 수정의 RED: 수정 전 HEAD 의 game.css 에 `.mf-game__record > .mv-suspect-board` 규칙이 0건, v2.css 에 `min-height: 44px; margin: -6px 0` 가 0건(`git show HEAD:… | grep -c` 로 확인) — `test/unit/suspectBoardCss.test.ts` 가 두 규칙을 고정한다. 눌림 가로채기는 happy-dom 이 재지 못해 CSS 원문으로 고정했다.

## 결과 (로컬 dev 서버, 헤드리스 Chrome)

`node scripts/e2e/run.mjs --url http://localhost:5173 --only <흐름>`

| 흐름 | 크기 | 통과/전체 | 시간 |
|------|------|-----------|------|
| causal-day | 390x844 | 54/54 | 49초(최종 묶음 실행) |
| causal-leak | 390x844 | 11/11 | 46초(첫 시도가 부하로 가로등 시간 초과 → 새 방 재시도 통과) |
| causal-sizes | 360x640 | 20/20 | 20초 |
| causal-sizes | 390x664 | 20/20 | 21초 |
| causal-sizes | 430x932 | 19/19 | 23초 |
| causal-sizes | 360x560 | 22/22 | 20초 |
| causal-sizes | 390x844 | 19/19 | 20초 |
| causal-sizes | 402x874 | 19/19 | 20초 |
| mode-basic (LH12) | 390x844 | 19/19 | 22초 |
| basic-vote (LH12) | 폰 6종 | 15·14·15·15·15·15 전부 통과 | 79초 |

`--only causal` 묶음 실행(8 작업 병렬): E2E OK, 90초, 실패 0. 한 명령이 10분을 넘은 적 없음. 배포본 대상 실행 없음.

다른 검증: `npm test` 308 파일 통과·6 건너뜀 / 9022 통과·262 건너뜀·실패 0, `npm run typecheck` 종료 0, `node --test scripts/*.test.mjs scripts/e2e/*.test.mjs` 704 통과·실패 0(lib.test.mjs 480).

### LH 판정 대응

| 판정 | 어디서 | 확인한 것 |
|------|--------|-----------|
| LH1 | causal-day | `roleReveal>errand>night>morning>discussion`·dayAnnounce 없음·처형 다음 저녁(`errand` 두 번) |
| LH2 | causal-day | 타일 3·처음 [켜기] 비활성·반경 안 data-call 활성·켠 뒤 점·`__mfTown.lamps`·타일 불꽃 배지·세 곳이면 '완료'. 길게 누른 켜기만 hold 를 실었다(errand 2 + errand+hold 1) |
| LH3 | causal-leak | 마피아·시민 탭 저녁 DOM 구조 같음, 길게 누르기 0.7초 전후 DOM 변화(구조 변화 줄) 같음, 보낸 errand 프레임 같음, `git grep` 으로 src/ 에 lampCut·smudged 없음 |
| LH4 | causal-day | 맵 town·고정 시점·`data-night-dark` 없음·판 수 = 산 사람·집 누르기 pick 한 번·다른 집이면 이동·같은 집 다시 누르면 pick 0·범례가 한 문장으로 |
| LH5 | causal-day | `__mfTown.windows` = 밤 lamps ∩ owners, 자른 등불의 집은 창·밤 lamps 에 없음 |
| LH6 | causal-day | 표식 3 fresh·`__mfTown.clue`·꺼진 등불 표식 = 집 좌석 − 밤 lamps(자른 등불 포함)·방장 ② done+옷 조각 카드·같은 지점 다시 불가·참가자 ② blurred+'먼저 손댄 흔적'·① done+발자국 카드 |
| LH7 | causal-day | 토론 시작 때 보드 한 번 열림·칩 = 받은 단서·얼굴 칸 = 산 사람·같은 옷 칸 = 사본 sameOutfit·닫기 → [의심 보드] 로 다시 열기·목격 칩 펼치기(줄 수 = me.record) |
| LH8 | causal-day | 건너뛰기 눌림·`data-skip-count` = 서버 값(1→0)·사람이 모두 누르면 저녁·아침이 일찍 끝남 |
| LH9 | causal-leak | 밤(전·후)·아침(살피기 전)·토론(보드) 마피아·시민 탭 DOM 구조 같음(허용 목록 아래) |
| LH11 | causal-sizes | 저녁(독 170·점 줄 독 위 16·[켜기]·[건너뛰기] 56×112·타일 겹침 0)·밤(판 8 스테이지 안쪽 8·거리 ≥ 40·배율 식)·아침(표식 3·카드 줄·독 겹침 없음, 360×560 참고 줄)·보드(닫기 44·아래 패널 위 8) |
| LH12 | mode-basic·basic-vote | 기존 흐름 그대로 통과 |
| LH14 | causal-day | 모션 줄이기에서 채움 막대(저녁)·아침 카드 올라옴·의심 보드 열림 전환이 즉시(0.01ms) |

## 고친 앱 결함 (실브라우저가 찾음 — 21-14 의 jsdom 시험은 못 봤다)

1. **의심 보드가 눌리지 않음** (`2b303299`, Rule 1): `.mf-game__record` 는 `pointer-events: none`(스테이지를 가리지 않게)이고 자식 중 `.mv-record` 만 `auto` 를 받았다. 21-14 의 `.mv-suspect-board` 가 빠져 상속으로 눌림이 아래 `.mf-world__input` 으로 샌다 — 보드 [닫기]·목격 칩이 실제로 눌리지 않았다(`document.elementsFromPoint` 가 닫기 단추 자리 맨 위를 월드 입력층으로 보였다). 규칙에 `.mv-suspect-board` 를 더했다.
2. **목격 칩 누르기 높이 32** (같은 커밋, Rule 1·G3): 단추 요소 자체가 32 높이라 G3(탭 44)에 걸렸다(`::after` 확장은 요소 크기 검사에 안 잡혔다). `min-height: 44px; margin: -6px 0` 로 요소를 44 로 만들고 자리는 32 만 쓰게 했다(보임 모양·레이아웃 그대로). 옛 `::after` 확장은 지웠다.

## Deviations from Plan

**1. [Rule 1 - 앱 결함] 위 두 건** — 계획 Task 3 의 (가) 갈래(앱 결함 → 고치고 `fix(21-16)` 커밋에 시험 포함)로 처리. 시험은 `test/unit/suspectBoardCss.test.ts`(신규).

**2. [계획 보완 — 허용 목록 확장] causal-leak** — 계획의 허용 목록 둘(밤 행동 줄 [쪽지]/[유언]·산 마피아 합의 배지) 밖에서 실제 차이 둘이 나와 근거를 적고 허용에 더했다. 위치·역할과 무관한 표시 속성(위 key-decisions)은 별도 규칙이다.
- 본인 역할 일지의 새 기록 점 `span.mf-rolecard-btn__dot`: 21페이즈 이전부터 있던 표시로, 마피아 암살·경찰 수사·의사 치료 일지가 생기면 본인에게만 점이 붙고 시민은 일지가 없다(`RoleCardButton` 주석 "점만 다르다"). 새 21 화면이 아니다.
- 채팅 기록 줄 안쪽(`mv-chat__log` 의 자식): 입장 줄(참가자마다 자기 입장은 보이지 않고 입장 순서에 따라 달라진다)과 경찰 조사 카드(`data-card="eye"`, 본인 일지)다. 방 내용이지 21 화면 구조가 아니다. 기록 창 컨테이너와 입력줄은 그대로 비교한다. **이 허용은 채팅 내용 누설을 이 흐름이 보지 않는다는 뜻이다** — 역할별 채팅·일지 누설은 기존 서버 단위 시험과 emcee-leak 이 본다.
- 첫 실행에서 방장 탭을 비교 상대로 썼을 때는 방장 전용 [테스트 도구] 단추와 입장 줄이 차이로 나와, 상대를 참가자 탭 둘로 바꿨다(key-decisions).

**3. [계획 보완] 모션 줄이기 '전환 0'** — 앱의 전역 규칙이 0.01ms 이므로 상한 1ms 까지 즉시로 본다(`CAUSAL_INSTANT_MS`). 600ms 같은 실제 전환은 여전히 실패한다(lib.test.mjs 가 고정).

**4. [계획 보완] 카드 줄 덮임 판정** — 계획은 360×560 만 참고 줄이었으나 360×640·390×664 에서 카드 세 장이 이미 살핀 표식 둘을 덮는 것이 관측됐다. UI-SPEC 의 기준 폰은 390×844 뿐이고 진행에 지장이 없어(더 누를 곳이 아님) 이미 살핀 표식은 모든 폰에서 참고 줄(LH6i)로, 안 살핀 표식을 덮는 것은 판정 실패로 두었다. 첫 카드 한 장 시점(안 살핀 표식 ①③)도 따로 판정한다. 문턱(안 살핀 표식 겹침 0)은 낮추지 않았다.

**5. [계획 보완] 집 판 40×40 → G3k 참고 줄** — 계획 지시대로 전역 TAP_ALLOW 는 건드리지 않고 causal.mjs 의 gLine 이 그 요소만 빼 참고 줄(G3k, 판정 아님)로 남긴다(tutorial.mjs 와 같은 방식).

**6. [계획 보완] causal-leak 은 참가자 셋(+봇 둘)** — 계획은 "마피아 탭과 시민 탭(같은 방)" 만 정했다. 위 이유로 방장을 시민으로 두고 참가자 셋을 연다(탭 네 개). 마피아 참가자·마피아 아닌 참가자가 모두 나오지 않으면 새 방으로 다시 돈다.

**7. [계획 보완] 기본 마피아 회귀(LH12)** — 계획대로 기존 mode-basic·basic-vote 를 돌렸고 모두 통과했다. 새 흐름은 만들지 않았다.

**8. [범위] 옛 errand·witness·trace 흐름은 건드리지 않았다** — 이월 항목의 `errand.mjs` ~411·~417, `browser.mjs` ~2223, `lib.mjs` ~3571 의 `[data-record-card]`·기록 단추 기대는 새 흐름(causal-*)이 쓰지 않고, 옛 흐름 정리는 계획대로 21-17 이다. 이번에 이 세 흐름·그 외 기존 흐름을 돌려 보지 않았다(21-17·21-18).

## 간헐·시간 관련 (정직하게)

- 저녁 40초·아침 30초는 실제 시간이다. 최종 `--only causal` 묶음(8 작업 병렬)에서 causal-leak 첫 시도가 "가로등 1번째를 16초 안에 켜지 못함"으로 새 방 재시도 1회를 썼다(부하 간헐, 재시도가 통과, 기록된 검사 실패 없음). 단독 실행에서는 재시도가 없었다. 개발 중 마지막 가로등 처리가 서버에 닿지 않는 시도가 몇 번 있었고(첫 구현의 켠 장소 판별 오류와 섞여 있었다) 판별을 '새로 done 이 된 타일'로 바꾼 뒤로 나타나지 않았다.
- `deferred-items.md` 의 알려진 간헐(bots mafiaBot·v2Marker·townLeak 알람·scene.test 창문)은 이번 `npm test` 에서 나타나지 않았다.

## 한계 (정직하게)

- **실기기·사람 눈으로 본 것이 아니다.** 헤드리스 Chrome(소프트웨어 렌더)의 수치·DOM 판정만이다. 길게 누르기는 마우스 눌러-쉬기-떼기로 0.7초를 재현했고 손가락 터치·압력은 아니다.
- 가로등 빛·집 창이 켜지는 3D 연출, 카메라 이동 자체의 매끄러움, 아침 decal 의 모양은 DOM 으로 판정하지 못한다. `__mfTown.lamps/windows/clue/night` 훅 값과 타일 불꽃 배지·꺼진 등불 표식으로 대신 확인했다.
- 모션 줄이기는 `emulateMedia` 로 한 페이지의 설정을 바꿔 계산 스타일을 읽었다(채움 막대·카드·보드). 켜짐·꺼짐·decal 의 3D 전환은 읽지 않았다.
- causal-leak 은 DOM 구조(태그·속성 이름·클래스)만 본다. 값·글은 보지 않는다(속성 값에 역할이 실리지 않는 것은 e2eContract 가 `CAUSAL_MARKERS` 값 표현식에 role·mafia·cut·smudge·allies 가 없음을 소스에서 확인한다). 위 허용 목록 밖의 차이는 0 이었다.
- causal-day 는 목격 기록 칩을 그 판에 목격 기록이 있을 때만 판정한다(방장 심부름 중 본 사람이 있을 때). 이번 최종 실행에서는 목격 기록이 있어 펼치기 판정(LH7w)이 통과했다 — 기록이 없는 판은 참고 줄로 남는다.
- 폰 6종 전체 회귀·옛 흐름(errand·witness·trace)·smoke·perf 는 이 계획 밖이다(21-17·21-18).

## Known Stubs

없음. 새 흐름의 환경 변수 `CAUSAL_DEBUG=1`(진단 줄 출력)은 판정에 영향을 주지 않고 기본은 꺼져 있다.

## Threat Flags

없음(새 네트워크 표면·인증 경로 없음 — 흐름은 로컬 dev 서버에 열린 방 소켓만 쓴다). 위협 표 대응: T-21-37(DOM 비교 + 길게 누르기 DOM 변화 동일 판정), T-21-38(출력에 좌석 번호·개수·표식 이름만, 닉네임·토큰·DOM 문자열 없음, run.mjs redact 그대로), T-21-39(배포본 대상 실행 없음), T-21-SC(패키지 설치 없음).

## 21-17 에 넘기는 것

- **옛 흐름 정리**: errand·witness·trace(`scripts/e2e/errand.mjs`)는 확장판 기본값에서 새 저녁·아침 흐름과 맞지 않는다. `[data-record-card]`·`기록` 단추 기대는 errand.mjs ~411·~417, browser.mjs ~2223(readRecord), lib.mjs ~3571(ERRAND_MARKERS)에 있다. causal-* 가 쓰는 것은 남겨야 한다: `ERRAND_*` 상수 중 `data-errand-act`·`data-errand-place`·`data-errand-dots`·`data-errand-dot`·`data-skip-*`, `readErrand`·`walkToPlace`·`waitErrandDone`(causal.mjs 가 import), `sameOutfitSeatsE2E`·`ERRAND_ACT_R_E2E`(lib.mjs).
- **causal.mjs 의 도우미**(재사용 가능): `lightLamp`(켠 장소를 새로 done 이 된 타일로 판별), `walkToSpotReady`(위치 + 단서 지점 사본으로 준비 판정, 월드 좌표 방향 바닥 누르기), `clickPlate`, `untilPlatesStanding`, `victimOf`(사람·동료 아닌 가장 낮은 봇 좌석), 보낸 프레임 init 스크립트(`SENT_LOG_SCRIPT`), 보드 열림 횟수 감시(`BOARD_WATCH_SCRIPT`).
- **밤 흐름 E2E 가 새 하루에서 깨지는 곳**: 새 하루 확장판은 밤에 얼굴 목록이 아니라 집 판(`[data-house-pick]`)이다. 방장이 첫 밤을 살아남아야 하면 방장 역할을 마피아로 두고(마피아 봇은 마피아를 고르지 않고 사람 마피아의 선택을 따른다) 판을 눌러 집을 고른다. 집 판은 카메라가 멎은 뒤(약 1초, `data-house-off` 가 사라진 뒤) 눌러야 한다. 집 판 40×40 은 G3 에 걸리므로 causal.mjs 의 gLine 처럼 그 요소만 참고 줄로 뺀다.
- 건너뛰기: 사람 모두(방장 포함)가 [건너뛰기]([data-skip-phase])를 누르면 저녁·아침이 일찍 끝난다(봇은 누르지 않는다). 테스트 도구의 [다음 단계로 넘기기]는 그대로 쓸 수 있다.
- 아침: 지점 표식은 단계 시작 약 2.8초(경찰 알림이 있으면 4.8초) 뒤에 선다. 방장이 마피아면 자기 ② 가 아니라 **다음 사람**이 ② 에서 '먼저 손댄 흔적'을 받는다(마피아가 먼저 살핀 지점이 흐려진다). 참가자가 마피아가 아니어야 한다.
- 처형 다음 저녁까지 가려면 테스트 도구 봇 투표를 `{ exec: "yes", pick: "host" }` 로 두면 방장이 처형된다(방장이 마피아면 마피아 한 명이 남아 판이 계속된다). 방장이 처형되면 이후 단계는 유령 화면이다.

## 21-18 에 넘기는 것

- 폰 6종 전체 회귀에서 causal-sizes 는 6종에서 모두 초록이었다(위 표). `--only causal` 전체는 8 작업 병렬 90초. causal-leak 은 부하에서 가로등 시간 초과 재시도가 있을 수 있다(새 방으로 자동 재시도, 기록된 실패 없음).
- 앱 결함 둘의 수정(`game.css`·`v2.css`)은 21-18 의 배포 범위에 들어간다. 의심 보드 닫기 단추가 실브라우저에서 눌리는 것은 causal-day 의 LH7c 가 본다.

## Self-Check: PASSED

- 파일: `scripts/e2e/causal.mjs`·`test/unit/suspectBoardCss.test.ts`·이 SUMMARY 존재 확인.
- 커밋: `0ab1b41b`·`dd9c5d74`·`2b303299`·`5bf8c6c6`·`b497a493` 모두 HEAD 의 조상.
- 위생: 계획이 정한 원격 레포 위생 git grep 을 변경 파일·SUMMARY 에 돌려 새 결과 0.
