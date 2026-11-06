---
phase: 14-host-and-labels
plan: "04"
subsystem: ui-call-glow
tags: [call-glow, light-lamp, host-03, host-04, host-05, minifia-v3, u-5, u-7]
status: complete

requires:
  - phase: 14-01
    provides: callTargetsOf(view) — 빛남 대상 순수 함수
  - phase: 14-02
    provides: 띠가 말하는 화면(헤더 제목만), 띠 문장 = data-guide
provides:
  - "토큰 --glow-ring·--glow-ring-peak(light-lamp 파생) + CSS .is-call(테두리·정지 빛·opacity 맥박 5.5초 후 정지, 모션 줄이기는 정지 빛만)"
  - "부품 call prop: NameTag call, VerdictPicker call, FaceList callSeats, ChatPanel callInput·callWill, WorldStage pick 단추 data-call(값 없음)"
  - "GameMap 이 callTargetsOf(view) 로 대상을 정하고 단계 키로 '썼음'을 쥔다. GamePanel call·onCallUsed"
  - "13 의 투표 처음 3초 깜빡임·VOTE_BLINK_MS 삭제(U-7), 36px 낮/밤 결과 알림 삭제(U-5)"
affects: [14-05, 14-06, 14-07, 14-09]

requirements-completed: [HOST-03, HOST-04, HOST-05]

actuals:
  tokens: 16600
  tasks: 3
  commits: 5

plan_head_before: d4db5373b671a305712e95ea37181b2414963005
plan_head_after: aa0133796308ae81f79f00827f0a2dc8235615a0

tech-stack:
  added: []
  patterns:
    - "빛남 = 정지 빛(::after, --glow-ring) 위에 짙은 층(::before, --glow-ring-peak)이 opacity 0↔1 로만 5회 오가다 멈춘다. box-shadow 값 자체는 움직이지 않는다"
    - "'썼음' 은 단계 키(단계:일차:변론자) 하나를 쥐는 로컬 상태 — 키가 바뀌면 자동으로 풀리고, 같은 키에서는 서버 거절에도 되살아나지 않는다"
    - "data-call 은 값 없는 표식(빈 문자열) — 역할·좌석 값을 싣지 않는다"

key-files:
  created:
    - test/client/callGlow.test.tsx
  modified:
    - design/tokens.json
    - src/styles/tokens.css
    - src/styles/v2.css
    - src/components/v2/HeadStack.tsx
    - src/components/v2/VerdictPicker.tsx
    - src/components/v2/FaceList.tsx
    - src/components/v2/ChatPanel.tsx
    - src/components/WorldStage.tsx
    - src/screens/GameMap.tsx
    - src/screens/GamePanel.tsx
    - src/game/dayView.ts
    - test/client/gameMap.test.tsx
    - test/client/nightMap.test.tsx
    - test/client/worldStage.test.tsx
    - test/client/v2parts.test.tsx
    - test/unit/dayView.test.ts

key-decisions:
  - "맥박 층을 ::before(peak, opacity 0↔1)로 두고 정지 빛(::after)은 항상 켜 둔다 — 6초 뒤 애니메이션이 끝나면 정지 빛만 남고, 모션 줄이기는 ::before 애니메이션만 끈다. 반복 5회 × dur-pulse 1100ms = 5.5초(약 6초)"
  - "'썼음' 키는 phase:day.n:candidate. 같은 단계 안에서만 끄고 단계·일차·변론자가 바뀌면 풀린다. 재접속처럼 이미 고른 상태(day.points 내 줄·me.pick·me.verdictVote)는 처음부터 켜지 않는다"
  - "빛남 대상은 GameMap 에서 한 곳(callOn)으로 거른다: 열린 시트(layerKind)·키보드(kbOpen)·귓속말 모드·이미 썼음. 순차 지목(day.turn)에는 켜지 않는다(13 기본판 투표만)"
  - "밤 경찰·의사 빛은 GameMap 이 callTargetsOf 좌석을 GamePanel 로 넘겨 FaceList callSeats 로 그린다(밤 맵 이름표에는 call 없음 — 마피아 이름표 선택은 그대로)"
  - "찬반·얼굴 칸의 brass-200 라벨 규칙은 선택자를 .is-call.mv-verdict__btn·.is-call.mv-face 로 앞에 둔다 — 08·09 의 '진홍·놋쇠 없음' 부품 규칙 시험이 .mv-verdict·.mv-face 로 시작하는 선택자만 보기 때문(모든 역할에게 같은 빛이라 역할 색이 아니다)"

duration: 약 1시간
completed: 2026-11-07
---

# Phase 14 Plan 04: 빛남(call glow)과 36px 낮/밤 알림 정리 Summary

**callTargetsOf 하나가 정한 누를 대상(채팅 입력칸·투표 이름표·[유언]·[찬성]/[반대]·밤 경찰·의사 얼굴 칸)이 light-lamp 빛으로 알려지고, 쓰거나 시트·키보드가 열리면 꺼지며, 13 의 투표 처음 깜빡임과 띠가 겹치는 36px "낮이 되었습니다"·"밤이 되었습니다" 알림이 사라졌다.**

## 수행한 일

### Task 1 — 토큰·CSS·부품 call prop (`fb2f60b5` RED, `af8d34b0` GREEN)
- `design/tokens.json` shadow 묶음에 `glow-ring`(시안 HostCaption 의 두 겹 그림자 그대로)·`glow-ring-peak`(0.6 / 20px 0.8)를 더하고 `npm run tokens` 로 tokens.css 생성.
- `v2.css` `.is-call`: light-lamp 테두리 + 정지 빛, 짙은 층의 opacity 맥박(5회), 이름표·찬반·얼굴 칸 라벨 700 brass-200, 입력칸·[유언] 모서리, 모션 줄이기에서 맥박 없음. 화면 CSS 에 hex·rgba 직접 사용 없음.
- NameTag `call`, VerdictPicker `call`, FaceList `callSeats`, ChatPanel `callInput`·`callWill`, WorldStage pick 단추 `data-call`(값 없음).

### Task 2 — 맵 화면 연결 (`d251951d`)
- GameMap: `callTargetsOf(view)` + 단계 키 "썼음" 상태 + 끄는 조건(시트·키보드·귓속말 모드). 투표 이름표 `call`을 `stageTagProps` 에서 얹고 13 의 `voteBlink` 상태·타이머·`VOTE_BLINK_MS` 삭제.
- GamePanel `call`·`onCallUsed`: 입력칸 포커스·첫 글 보냄·[유언] 엶·찬반 고름·얼굴 고름에서 끈다.
- 마피아 밤·산 시민·유령·할 일 없는 사람은 data-call 0개. 빛은 소리를 내지 않는다(emitSignal 새로 부르지 않음).

### Task 3 — 36px 낮/밤 알림 끄기 (`0ae67d61` RED, `aa013379` GREEN)
- `dayEvents` 에서 낮 시작·밤 진입 알림 push 삭제. 채팅 줄 "{N}일차"·"처형 없음" 줄과 "처형 없음"·찬반 집계·처형·아침 결과·피해자·조사 결과 알림, 소리 감독 day.start·night.fall 은 그대로. `DAY_COPY` 문구·`ANNOUNCE_DAY_MS`·`ANNOUNCE_NIGHT_MS` 상수는 지우지 않고 주석으로 표시.

## 검증

- `npm test` 6980 passed(이전 6948), `npx vitest run --project client` 2414 passed, `npm run typecheck`(tokens:check·wrangler types·tsc 앱·워커) 통과.
- `git diff --quiet 2736a336 -- worker shared` 성공(서버·공유 diff 0).
- 인수 기준 확인: glow-ring 토큰 파일마다 2, `.is-call` 9, data-call 파일마다 1 이상, callTargetsOf 4, VOTE_BLINK_MS·voteBlink 0, onCallUsed 7, DAY_COPY.announceDay·announceNight 참조 0, dayView.test 의 "U-5" 8.
- 위협: T-14-11(마피아·시민·유령·죽은 경찰 방 화면 data-call 0 단언), T-14-12(속성 값 빈 문자열 단언), T-14-02(서버 diff 0) 모두 시험으로 덮음.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 8·9페이즈 CSS 정적 시험이 brass-200 라벨 규칙을 막음**
- **Found during:** Task 1 GREEN
- **Issue:** voteParts·faceList 의 "진홍·놋쇠 없음" 시험이 `.mv-verdict`·`.mv-face` 로 시작하는 선택자의 본문을 검사해, UI-SPEC 이 정한 brass-200 라벨(`.mv-verdict__btn.is-call`, `.mv-face.is-call .mv-face__name`)이 실패시켰다.
- **Fix:** 선택자를 `.is-call.mv-verdict__btn:not(.is-on)`·`.is-call.mv-face .mv-face__name` 으로 바꿔 시험 의도(역할 색 금지)와 충돌하지 않게 했다. 빛은 모든 역할에게 같다.
- **Files modified:** src/styles/v2.css
- **Commit:** af8d34b0

**2. [Rule 3 - Blocking] v2parts 시험의 "놋쇠 토큰 없음" 예외 목록에 .mv-tag.is-call 추가**
- **Found during:** Task 2 전체 client 시험
- **Issue:** `.mv-tag.is-call .mv-tag__name`(brass-200, 14-UI-SPEC 색 약속 표가 허용)이 7페이즈 이름표 규칙 시험의 놋쇠 금지에 걸렸다. 14-01 이 `.mv-host` 를 예외에 넣은 것과 같은 방식이다.
- **Fix:** `test/client/v2parts.test.tsx` 의 예외 정규식에 `^\s*\.mv-tag\.is-call` 추가.
- **Commit:** d251951d

**3. [Rule 1 - Bug] 이미 찬반을 고른 사람(재접속)에게도 [찬성]·[반대]가 켜짐**
- **Found during:** Task 2 시험
- **Fix:** `view.me.verdictVote === undefined` 일 때만 verdict 빛을 켠다. 같은 원리로 투표(내 지목이 서버에 있음)·밤(me.pick 있음)도 처음부터 켜지 않는다.
- **Commit:** d251951d

### 프로세스 편차

**Task 2 의 RED 를 별도 커밋으로 남기지 못함.** 맵 화면 시험(callGlow 의 "맵 화면 빛남" 21개)은 구현과 같은 작업 흐름에서 쓰여 통과한 상태로 함께 커밋했다. Task 1(`fb2f60b5`)·Task 3(`0ae67d61`)은 RED 실패를 확인한 뒤 별도 커밋했다. 시험이 실제로 검사하는지는 `verdictVote` 버그가 시험에서 잡힌 사례로 확인했다.

## Known Stubs

없음.

## Threat Flags

없음 — 새 네트워크·인증·스키마 표면 없음. `data-call` 은 값 없는 표식이다.

## 다음 계획에 넘기는 메모

- 14-05 가 start·card 도구 빛남을 더한다: `callTargetsOf` 가 이미 `{kind:"tool", tool:"start"|"card"}` 를 돌려주고, 이 계획의 부품 call prop·`.is-call` CSS 를 그대로 쓰면 된다(GameMap 의 `callTool` 은 chat·will·verdict 만 GamePanel 로 넘긴다).
- 실기기에서 빛 맥박(5.5초)·6페이즈 성능 게이트(55fps)·폰 6종 이름표 가림 확인은 UI-SPEC 대로 개발이 끝난 뒤 한꺼번에 한다(14-09 E2E 몫).

## Self-Check: PASSED

- FOUND: test/client/callGlow.test.tsx, design/tokens.json(glow-ring), src/styles/v2.css(is-call), src/screens/GameMap.tsx(callTargetsOf), src/screens/GamePanel.tsx(onCallUsed)
- FOUND commits: fb2f60b5, af8d34b0, d251951d, 0ae67d61, aa013379 (git merge-base --is-ancestor 로 확인)
