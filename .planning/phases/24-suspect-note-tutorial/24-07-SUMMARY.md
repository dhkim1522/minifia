---
phase: 24-suspect-note-tutorial
plan: "07"
subsystem: tutorial-base
tags: [tutorial, solo-only, pure-script, focus-ring, static-guard, local-send]
status: complete
requires: ["24-01"]
provides:
  - "src/game/tutorialScript.ts — TUTORIAL_CAST·TUTORIAL_SCENES·TUTORIAL_PILLS·tutorialView·tutorialSnap·autoAct·reactTo·makeTutorialSend 와 대본 글 상수"
  - "src/components/tutorial/FocusRing.tsx — 한 링 + --scrim 구멍 마스크(target: FocusTarget | null)"
  - "src/components/tutorial/TutorialFrame.tsx — 진행 점 10개·한 줄 알약·[그만두기], 묶음 위치 세 모드"
  - "src/styles/tutorial.css — 링 1Hz 깜빡임·어둡게·틀·튜토리얼 안 깜빡임 끄기"
  - "src/net/session.ts — TUTORIAL_SEEN_KEY(minifia:tutorialSeen)·readTutorialSeen·markTutorialSeen"
  - "test/unit/tutorialStaticGuard.test.ts — 모듈 그래프 정적 가드(TUTORIAL_ENTRIES), test/helpers/fakeTutorialStage.ts"
affects: [24-08, 24-09, 24-10]
actuals:
  tokens: 23000
  tasks: 3
  commits: 6
plan_head_before: 47389245077f7ce70e76ac65d043d18be6888b55
plan_head_after: 9b594adf032665b3d88e1a59d8205fcbdecb2053
tech-stack:
  added: []
  patterns:
    - "순수 대본: 시각·난수를 읽지 않고 시작 시각을 인자로 받는다, 가짜 view 는 satisfies RoomView"
    - "눌림 = 메시지 비교: reactTo 가 화면이 보낸 메시지를 대본의 링 대상 메시지와 비교, 12초 대행 autoAct 는 같은 객체를 돌려준다"
    - "정적 가드: 값 import 폐포(import type 제외)를 정규식으로 계산해 네트워크·세션 모듈 부재를 단언, 자기 점검 포함"
key-files:
  created:
    - src/game/tutorialScript.ts
    - src/components/tutorial/FocusRing.tsx
    - src/components/tutorial/TutorialFrame.tsx
    - src/styles/tutorial.css
    - test/unit/tutorialScript.test.ts
    - test/unit/tutorialStaticGuard.test.ts
    - test/client/focusRing.test.tsx
    - test/client/tutorialFrame.test.tsx
    - test/helpers/fakeTutorialStage.ts
  modified:
    - src/net/session.ts
    - test/unit/session.test.ts
key-decisions:
  - "FocusRing 은 옛 묶음 배열(groups) 대신 링 하나(target)만 받는다 — UI-SPEC 의 '깜빡이는 것은 링 하나'(0080-6)에 맞춰 단순화"
  - "autoAct(scene, beat?) 와 reactTo(scene, beat, msg) 한 쌍으로 '눌렀을 때 = 12초 뒤 대행' 을 같은 결과로 묶었다(눌림은 메시지 비교, [의심] 단추처럼 메시지가 없는 조작은 msg null)"
  - "가짜 view 의 acted 는 눌린 뒤 가짜 반응이 나온 단계 수(0 → steps) 하나로 일반화(토론 끝내기 4·찬반 6·지목 4·키워드 확정 1)"
metrics:
  completed: 2026-11-17
---

# Phase 24 Plan 07: 튜토리얼 기반 Summary

혼자 하기 튜토리얼의 서버 없는 기반을 만들었다: 열 장면의 순수 대본·가짜 `RoomView`·월드 스냅·로컬 send 어댑터(`tutorialScript.ts`), 17페이즈 측정 논리를 되살린 한 링 포커스(`FocusRing`), 진행 점·알약·[그만두기] 틀(`TutorialFrame`), `minifia:tutorialSeen` 저장 키, 그리고 튜토리얼 모듈 그래프에 네트워크·세션 모듈이 없다는 것을 지키는 정적 가드. 화면 조립(TutorialScreen·useTutorialScene)은 24-08·24-09 몫이고 Home 에는 마운트하지 않았다.

## 수행한 일

| 작업 | 커밋 | 내용 |
|------|------|------|
| T1 RED | 10f5d863 | 대본 시험 39건(모듈 없음으로 로드 실패) |
| T1 GREEN | 3e12958a | tutorialScript.ts |
| T2 RED | 2733bf59 | focusRing·tutorialFrame 시험 26건(모듈 없음으로 로드 실패) |
| T2 GREEN | d1fdc383 | FocusRing·TutorialFrame·tutorial.css |
| T3 RED | fb3288ea | session '봤음' 시험 5건 실패 + 정적 가드·가짜 스테이지 |
| T3 GREEN | 9b594adf | session.ts 키·읽기·쓰기 |

## 이월 메모 (24-08·24-09·24-10 이 쓴다)

### 장면 id·종류·링 대상·길이

| 장면 | id | 종류 | 링 대상 | 링 켜짐(ms) | 길이 ms | 비트 id |
|------|-----|------|---------|-------------|---------|---------|
| 1 | roles | watch | — | — | 6400 | start·a·b·c |
| 2 | keyword | do | send | 5800 | 18600 | a·b·c |
| 3 | answers | watch | — | — | 7000 | a·b |
| 4 | discussion | do | endDiscussion | 4400 | 19200 | a·b |
| 5 | verdict | do | yes | 1000 | 16400 | a |
| 6 | pick | do | tag-4 | 3200 | 18300 | a·b·c |
| 7 | will | watch | — | — | 6000 | a·b |
| 8 | night | do | face-0 | 0 | 17500 | a·b·c |
| 9 | postit | do | suspect-btn → tag-4 | 0 | 28800 | start·a·b·c |
| 10 | end | watch | — | — | 4000 | a |

- 모든 하기 장면 `autoActMs = 12000`(링이 켜진 뒤, postit 은 각 단계 시작 뒤). `stepMs`(토론 400·찬반 300·지목 400)와 `tailMs`(키워드 800·토론 1200·찬반 1600·지목 1500)는 `TUTORIAL_SCENES` 필드.
- `TutorialBeat { id; at: number | null; holdMs?; pill; sfx? }` — `at` 숫자는 시각표, `null` 은 눌러서(또는 앞 비트 `holdMs` 가 지나) 들어가는 비트. 비트 id 는 `"start" | "a" | "b" | "c"`. 장면 9 만 `start`(처음, 알약 "의심 가는 사람 곁에서 눌러요")·`a`(모드 켜짐)·`b`(종이 붙음, 3.0초)·`c`(아침 막 + 떨어짐, 1.8초)이고 장면 2 는 UI-SPEC 의 2a·2b·2c 가 그대로 a·b·c, 장면 8 은 a(고르기)·b(체크, 2.5초 어두운 정지)·c(아침 막간 3.0초).
- 알약은 `beat.pill`(키) → `TUTORIAL_PILLS[key]`. 보기·하기 구분 없이 문구는 16개, 전부 17자 이하·요로 끝남·마침표 없음(시험이 지킨다).
- 소리 큐는 `beat.sfx`(`ui.card`·`ui.tap`·`ui.host`) 로만 표시했다. 장면 진입마다 `ui.host` 한 번은 화면 쪽 규칙(UI-SPEC P24-31)이다.

### 함수 시그니처

```ts
tutorialView(id: TutorialSceneId, at?: TutorialBeatId, startedAt?: number, acted?: number): RoomView
tutorialSnap(id: TutorialSceneId, at: number): Extract<WorldFrame, { k: "snap" }>
autoAct(id, at?): TutorialAction | null       // { target, msg: ClientMessage | null, steps, next: TutorialBeatId | null }
reactTo(id, at, msg: ClientMessage): TutorialAction | null   // msg 가 그 비트의 링 대상 메시지와 같을 때만 autoAct 와 같은 값
makeTutorialSend(handlers: { onAnswer?, onEndDiscussion?, onVerdict?, onPoint?, onPick?, onSuspect? }): (msg) => boolean  // 항상 true
```

- `startedAt` 기본값 `TUTORIAL_EPOCH`(고정). 화면은 장면 시작 때 `Date.now()+offset` 을 넘겨야 `phaseEndsAt`(= startedAt + `scene.ms`)이 실제 시계로 돈다. `serverNow` 는 `startedAt` 이다.
- **roles 장면 시계**: 역할 카드 자동 뒤집힘(5초)을 0.4초에 맞추려고 `phaseDurationMs = ms + 4600` 로 `t0` 를 앞당겼다(`TUTORIAL_FLIP_AT_MS = 400`, `AUTO_FLIP_MS` 를 `net/cardFace` 에서 가져옴).
- `acted`: 눌린 뒤 반응 단계 수. 토론(`endCount` 0~4, 1 이상이면 `me.endDiscussion`)·찬반(`verdictCount`, 1 이상이면 `me.verdictVote`, 최대 6 → 찬성 4·반대 2)·지목(비트 c 에서 내 차례 뒤로 최대 4 → 하린 1표, 이어서 도윤 4표)·키워드 확정(비트 c, 1 이면 `final: true`). 단계 간격은 `scene.stepMs` 로 화면이 돌린다.
- 지목 장면 `turn.order = [0,2,5,3,1,4]`(민준→서연→나→지호→도윤→하린). 서버의 오름차순 규칙과 다르다(가짜 view 라 타입만 맞으면 된다) — 24-08 이 `PickTurnBlock` 이 순서를 배열대로 그리는지 확인할 것.
- 월드: 맵은 `"plaza"`(광장, 시험이 모든 자리를 `isWalkable` 로 확인). 장면 9 만 `NOTE_SPOTS`(내 곁에 하린·민준·지호, 켜는 문턱 92% = 2.2 단위 안, 도윤·서연은 멀다), 나머지는 둘레 2.6 고리. 6 좌석 모두를 싣는다(유령도 자리가 있다).
- 대본 글 상수: `TUTORIAL_CHAT`(시각·좌석·글·`emote`)·`TUTORIAL_WILL`·`TUTORIAL_ANSWERS`·`TUTORIAL_MY_ANSWER`, 모두의 기록 줄 등장 상수 `ANSWER_ROW_*`, 역할 아이콘 `ROLE_ICON_*`, 장면 9 `POSTIT_CURTAIN_MS`·`POSTIT_FALL_MS`.
- 장면 9 비트 c 는 `phase: "dayAnnounce"`, `day.n 3`, `suspects` 키 없음(떨어짐 경로). 장면 10 은 `discussion` day.n 3.

### FocusRing·TutorialFrame

- `<FocusRing target={{ id: TutorialTargetId, selectors: string[], pill?: boolean } | null} />` — 튜토리얼 루트 `[data-tutorial-screen]` 안에서 찾고 없으면 `document`. 표식 `data-tutorial-ring`·`data-tutorial-target`·`svg[data-tutorial-dim]`.
- `<TutorialFrame step pill place bottomEdge? onExit hideExit? />` — `place`: `aboveBottom`(`bottom = bottomEdge + 8`, `bottomEdge` 는 화면 아랫변에서 아래 패널 윗변까지의 높이)·`bottom`(`calc(24px + env(safe-area-inset-bottom))`)·`top`(131). 표식 `data-tutorial-stack`·`data-tutorial-dots`·`data-tutorial-pill`·`data-tutorial-exit`. 상수 `TUTORIAL_STEPS = 10`, `TUTORIAL_STACK_TOP = 131`.
- `[그만두기]` 자리는 CSS 변수 `--tut-exit-top`(기본 8)·`--tut-exit-right`(기본 16) 로 둔다. 헤더 시간 링 자리와 맞게 24-08 이 실측해 변수로 조정한다.
- 튜토리얼 루트에는 `data-tutorial-screen` 만 달 것(맨 이름 `data-tutorial` 금지). 이 속성이 `tutorial.css` 의 깜빡임 끄기 선택자의 기준이다.

### 정적 가드 진입 목록

`test/unit/tutorialStaticGuard.test.ts` 의 `TUTORIAL_ENTRIES` = `src/game/tutorialScript.ts`·`src/components/tutorial/FocusRing.tsx`·`TutorialFrame.tsx`·`src/screens/TutorialScreen.tsx`·`src/net/useTutorialScene.ts`(뒤 둘은 있을 때만 검사 — 24-08 이 만들면 자동으로 걸린다). 금지 모듈은 `src/net/api.ts`·`useRoomConnection.ts`·`session.ts`. 24-08 이 다른 새 튜토리얼 파일(예: `tutorial/TutorialRoleCards` 류)을 만들면 이 목록에 더해야 폐포 밖으로 새지 않는다. `TutorialScreen` 은 `session.ts` 를 import 하면 가드가 실패한다 — "봤음"은 Home 이 읽고 쓴다(24-09).

## 검증 (실제로 돌린 것)

- RED 증거: T1 대본 시험 모듈 없음으로 로드 실패, T2 focusRing·tutorialFrame 모듈 없음으로 로드 실패, T3 `session.test.ts` 21건 중 5건 실패(키·읽기·쓰기·메모리 대신).
- `npx vitest run test/unit/tutorialScript.test.ts`: 39 통과. `test/client/focusRing.test.tsx test/client/tutorialFrame.test.tsx`: 26 통과. `test/unit/session.test.ts test/unit/tutorialStaticGuard.test.ts`: 43 통과.
- `npm run typecheck`: 종료 0(GREEN 커밋마다, 시험·도우미 포함 `tsconfig.app.json` 범위). `npm run tokens:check` 통과.
- 웨이브 끝 회귀: `npx vitest run --project unit` 135 파일 통과/1 건너뜀(4513 통과), `--project client` 80 파일 통과(2750 통과/77 건너뜀).
- 계획 acceptance grep: `satisfies RoomView` 2, 대본의 `look:` 값은 detective·noir·elder·reporter·hood·coat 뿐, 주석 제외 `Date.now|Math.random` 0, `progressbar` 1 이상, `data-tutorial-ring` 1 이상, tutorial.css 의 hex 0·`prefers-reduced-motion` 1, `minifia:tutorialSeen` 1, `TUTORIAL_ENTRIES`·`useRoomConnection`(가드 시험) 각 1 이상.
- 커밋 전 위생 grep 을 바뀐 파일 전부에 돌렸고 결과가 없었다.

## 계획과 다르게 한 것 / 편차

**1. [FocusRing 모양] 옛 `groups`(묶음 배열·`extendDown`·`lit`) 대신 링 하나.** UI-SPEC 이 "깜빡이는 것은 링 하나"라 했고 대상은 한 번에 하나뿐이다. 옛 `lit`(같이 밝아야 하는 요소)·`extendDown`(이름표 + 몸)은 새 대상 표에 쓸 곳이 없어 되살리지 않았다. 필요해지면 24-08 이 `selectors` 합집합으로 해결한다(합집합 시험 있음).

**2. [알약 교차 페이드] 새 문구가 200ms 로 나타나기만 한다(`key` 로 새 span).** 옛 문구가 동시에 사라지는 진짜 교차는 하지 않았다. 알약 폭이 문구마다 달라 두 문구를 겹치면 폭이 튀기 때문이다. 모션 줄이기는 즉시. 불만족하면 24-10 스크린샷에서 다시 본다.

**3. [호출 빛남 끄기 범위] 튜토리얼 안에서 `.is-call::before` 맥박만 끄는 게 아니라 `::after`(정지 테두리)도 감췄다.** 링과 두 겹으로 보이지 않게 하려는 것이고 UI-SPEC 의 "깜빡이는 것은 링 하나"와 같은 방향이다. 글자 굵기·색(`.is-call` 라벨 700)은 그대로라 색만으로 알리지 않는 규칙은 유지된다.

**4. [비트 id 에 start 추가] E2E 표식 `data-tutorial-beat="a|b|c"` 에 `start` 가 더해진다.** 장면 1·9 에 글자 없는 첫 비트가 있어서다(UI-SPEC 장면 9 의 "0.0 알약 …" 구간). 24-09 의 E2E 가 `data-tutorial-beat` 값을 읽을 때 `start` 를 허용해야 한다(`e2eContract` 대조 시 주의).

**4-2. [Task 3 가드 시험은 RED 가 없다].** 가드 시험은 이미 있는 파일에 대한 검증(주석·폐포·자기 점검)이라 처음부터 초록이다. RED 로 실패한 것은 `session.test.ts` 5건이다. 시험이 빈 통과가 아님은 자기 점검(직접·전이·동적 import·재수출·혼합 import 의 검출)과 "폐포가 비어 있지 않다"는 단언(진입 파일 포함, `shared/game/world.ts` 포함)으로 보였다.

**5. [가드 자기 점검 기대값] 시험 작성 중 수정.** `useRoomConnection` 이 `api` 를 다시 가져와 폐포에 세 파일이 모두 들어오므로 기대값을 정확 일치가 아니라 포함(`arrayContaining`)으로 바꿨다. 가드 동작은 그대로다.

## 돌리지 못한 것 / 다음 계획으로

- 아무 화면도 마운트하지 않았다. 링·틀·알약의 실제 위치(360×560 외 폰 6종), `NOTE_SPOTS` 자리(내 캐릭터·하린·민준·지호 이름표가 화면 안쪽 8 에 드는지)·`RING_SPOTS` 의 이름표 위치, [그만두기] 자리는 24-08 조립과 24-10 스크린샷에서 확인한다. 광장 맵 + 고리 자리는 옛 마을 맵 측정값을 가져왔으므로 장면 6 이름표가 화면 안쪽 8 안인지 다시 측정해야 한다.
- 처형·아침 연출이 가짜 view 의 시계(`execution`·`morning`)로 의도한 시각에 도는지, `PickTurnBlock` 이 비오름차순 `turn.order` 를 그리는지, 장면 9 의 `dayAnnounce` 가 떨어짐을 실제로 일으키는지는 24-08 에서 화면과 함께 확인한다. 안 맞으면 이 모듈의 비트·시계 값만 고치면 된다.
- `useTutorialScene`(시각표 훅)·`TutorialScreen`·Home 진입점·소리(`ui.*`)·막기 층(`inert` 또는 얇은 층)·E2E `__mfTutorial` 훅은 24-08·24-09·24-10 몫이다.
- `scripts/e2e/lib.mjs` 의 `OFF_DEVICE_SELECTORS` 와 새 표식 이름 충돌이 없는지는 24-09/24-10 이 E2E 대조 시험으로 확인한다(이 계획은 표식 이름을 UI-SPEC 표대로만 썼다).

## Known Stubs

없음. 대본은 로컬 상수이고 데이터가 빈 채 화면으로 흐르는 곳은 없다(조립은 24-08).

## Threat Flags

없음 — T-24-19(모듈 그래프 정적 가드 + 금지 패턴 + 자기 점검 시험), T-24-20(키 하나에 `"1"`, 시험이 키 목록이 하나뿐임을 확인), T-24-21(대본은 로컬 상수, 가드가 innerHTML 계열을 막음)을 그대로 따랐고 새 공격 표면(네트워크·입력 경로)은 없다.

## Self-Check: PASSED

- 파일 존재: src/game/tutorialScript.ts, src/components/tutorial/FocusRing.tsx, src/components/tutorial/TutorialFrame.tsx, src/styles/tutorial.css, test/unit/tutorialScript.test.ts, test/unit/tutorialStaticGuard.test.ts, test/client/focusRing.test.tsx, test/client/tutorialFrame.test.tsx, test/helpers/fakeTutorialStage.ts 확인.
- 커밋 존재: 10f5d863, 3e12958a, 2733bf59, d1fdc383, fb3288ea, 9b594adf 가 HEAD 의 조상임을 확인.
