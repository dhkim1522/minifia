---
phase: 12-sound-polish
plan: "09"
subsystem: ui
tags: [web-audio, director, night, leak-safety, tdd, e2e, playwright]
status: complete
requires:
  - phase: 12-sound-polish
    provides: "12-02 nightCues·morningScript·willScript, 12-08 director·useSound·signals·audioView·sound-script"
provides:
  - "밤 소리: 진입 night.fall + bed.night + 큐 2~4개 (소리 전용 스케줄러 / 시각 큐 신호), 밤의 모든 닫힌 신호 무음"
  - "아침 소리: morning.dawn + bed.dawn 와 평화/구출/희생자 분기, kill.slash(killFx 본인만 +50ms), 유언 편지 quill→seal→fold, 카드 도착 ui.card"
  - "nightDarkOf(view), tensionCue·card 신호, directEvent(kill·letter·policeCard), ChatStore.lastLiveCardRevealAt"
  - "E2E sound-night-parity(390x844) + soundNightParityChecks(P1~P6), sound-script 에 밤·아침 단계 SC11·SC12"
affects: [12-10, 12-11, 12-12]
actuals:
  tokens: 22100
  tasks: 3
  commits: 6
plan_head_before: 18ee5364c8a2fe5736fc8a9dbfd4463b6b0b7f91
plan_head_after: 6e5d1846dcea64af20f397213a832104ff5982f0
tech-stack:
  added: []
  patterns: ["갈림은 불리언 하나(visualCues): 두 갈래가 같은 id 집합·같은 큐 개수임을 단위·통합·E2E 로 고정", "개인 사건은 숫자만(kill.at·letter.t0/writeMs·policeCard id·card.delayMs)", "개인 사건 효과는 view 효과 뒤에 선언해 같은 커밋에서 아침 view 가 먼저 감독에 들어간다"]
key-files:
  created:
    - src/game/nightDark.ts
    - test/unit/soundNight.test.ts
  modified:
    - src/audio/audioView.ts
    - src/audio/director.ts
    - src/audio/signals.ts
    - src/audio/useSound.ts
    - src/net/chatStore.ts
    - src/screens/RoomScreen.tsx
    - src/screens/GameMap.tsx
    - scripts/e2e/sound.mjs
    - scripts/e2e/flows.mjs
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs
    - test/unit/soundDirector.test.ts
    - test/unit/soundStaticGuard.test.ts
    - test/unit/e2eContract.test.ts
    - test/client/useSound.test.tsx
    - test/client/chatStore.test.ts
    - test/client/nightMap.test.tsx
key-decisions:
  - "감독 갈림: LocalClock.visualCues(불리언) + rng. RoomScreen 이 nightDarkOf(view) && !reducedMotion 으로 계산해 useSound 에 넘긴다. 감독은 역할을 읽지 않는다"
  - "밤 큐 지연은 마감(endsAt)에서 환산: elapsed = NIGHT_MS − 남은시간, 지연 = 큐 시각 − elapsed. 늦게 도착해도 서버 시각 기준 예약 지점이 같다(LS-11)"
  - "아침 대본의 기준은 아침 view 도착 시각(가변 길이라 역산 안 함). kill.slash 는 view 만으로는 절대 나지 않는다"
---

# Phase 12 Plan 09: 밤·아침·유언 소리 Summary

밤 소리를 역할·서버 프레임과 무관한 같은 대본으로 만들고(시민 편은 시각 맥박 신호에 맞추고 그 밖은 소리 전용 스케줄러), 아침 분기·암살음(피해자만)·유언 편지·카드 도착 소리를 숫자 입력만으로 더했다.

## 수행 결과

- **Task 1 (트레이서)**: `nightDarkOf` 로 GameMap 과 RoomScreen 이 같은 식을 쓴다. 감독이 밤 진입에서 `night.fall`(즉시) + `bed.night` + 큐 대본(`night:{일차}`, 소리 전용 갈래만)을 낸다. `tensionCue` 신호는 밤이고 visualCues 참일 때만 `night.cue`. 밤에는 tap·card 등 모든 닫힌 신호가 무음.
- **Task 2**: 아침 진입 `morning.dawn`(결과 무관) + 평화 `morning.calm`/구출 `morning.saved`(400)/희생자 `chalk.draw`(700). `directEvent` 가 kill(at+50)·letter(t0 기준 willScript, 이미 지난 줄 버림)·policeCard(2400)를 받고 아침이 아니면 무음. RoomScreen 이 chat 프레임의 will·note 카드에서 `card` 신호(delayMs 숫자)를 보낸다.
- **Task 3**: `soundNightParityChecks`(P1~P6) + 흐름 sound-night-parity, sound-script 에 SC11(밤)·SC12(아침).

## 검증

- 단위·통합: soundNight(신규 다수) · soundDirector · soundStaticGuard · tension · tensionStaticGuard · useSound · chatStore · nightMap · killFx · useWillLetter · e2eContract 통과. `--project client` 전체 70파일 2363개 통과. `node --test scripts/e2e/lib.test.mjs` 289 통과. `npm run typecheck` 오류 없음.
- 핵심 시험: LS-2 메타모픽(역할·선택·관전·기록 변형 → audioView·출력 동일), LS-3(역할 5 × 모션 줄이기 × 시드 40: id 집합 {bed.night, night.fall, night.cue}, 큐 2~4·첫 ≥5000·간격 4000~9000·창 28000), RoomScreen 통합(시민·경찰·의사=시각 갈래, 마피아·유령·모션 줄이기=소리 전용 갈래의 엔진 로그 동일), LS-7, LS-8, LS-10, LS-11.
- E2E (개발 서버 `vite dev --host 127.0.0.1 --port <빈 포트> --strictPort`, 서버는 껐다):
  - **sound-night-parity 390x844 통과 15/15** (마지막 실행 43초, 첫 시도). 밤 id 집합 4페이지 모두 {bed.night, night.cue, night.fall}(새로고침 페이지는 night.fall 없음 {bed.night, night.cue}), night.cue 개수 방장 2 · 피해자 3 · 손님 3 · 새로고침 2, 밤 ui.* 0, kill.slash 피해자 페이지에만 1회, morning.dawn 각 1회.
  - **sound-script 390x844 통과 20/20** (SC11·SC12 포함, 30초).

## Deviations from Plan

### Auto-fixed / 조정

**1. [Rule 3 - 막힌 곳] card 신호·audioView.morning 을 Task 1 에서 먼저 더함**
- LS-7 시험이 "닫힌 신호 목록 전부"를 요구해 SIGNAL_KINDS 에 card 가 있어야 했고, 시험 헬퍼 `av()` 가 morning 필드를 쓴다. card 의 감독 분기와 audioView.morning 필드(허용 경로 `view.day.morning`)를 Task 1 GREEN 에 넣고, 아침 분기·개인 사건은 Task 2 에서 했다.

**2. [Rule 1 - 기존 시험 갱신] soundDirector.test.ts**
- SIGNAL_KINDS 기대 ["tap","card","tensionCue"], 첫 스냅샷 시험은 visualCues 참(밤 재접속 큐는 soundNight 가 본다), "틱 없음" 목록에서 밤·아침을 분리, LS-1 화면 대응 시험은 night.cue 를 분위기(비정보)로 허용하고 card·tensionCue·night.fall·ui.card 를 전수에 포함, audioViewOf 기대에 `morning: null`.

**3. 시험 파일 위치**: RoomScreen 두 갈래 통합 시험과 onCue→신호 확인은 계획의 gameMap.test.tsx 대신 큐 하네스가 이미 있는 nightMap.test.tsx 에 더했다.

**4. E2E 구성 변경**: 한 밤 안에서 새로고침 페이지까지 보려고 손님 셋 + 봇 하나(5명 → 마피아는 방장 하나)로 했다. 첫 계획의 "다른 후보를 눌렀다 피해자 확정"은 두 번째 클릭이 막혀(마피아 하나라 첫 선택이 바로 확정) 피해자 이름표 한 번 누르기로 바꿨다. 밤 진입 막(`[data-curtain]`)이 걷힌 뒤 누르게 해 첫 시도부터 통과한다. 의사가 피해자를 지키는 판은 SetupError 로 새 방에서 다시 돈다(기존 nightScenario).

**5. sound-script 단계 위치**: 새로고침(SC10)을 마지막으로 두라는 메모 대신, 새로고침 뒤 같은 페이지에서 testSkip 으로 밤(SC11)·아침(SC12)을 이어서 본다. e2eContract 의 침대 id 기대 목록에 bed.night·bed.dawn 을 더했다.

**6. 하지 않은 것(지시)**: 전체 회귀·build·nightload·웨이브 게이트, 배포·push. STATE/ROADMAP/REQUIREMENTS 는 건드리지 않았다.

## Known Stubs

없음.

## Threat Flags

없음. 새 네트워크·프로토콜·저장소 접근 없음(소리 신호는 로컬).

## 이월 메모

- 감독 입력: `LocalClock`(now·offset·reset·lastJoinAt·`rng`·`visualCues`) · `directEvent({kind:"kill",at}|{kind:"letter",t0,writeMs}|{kind:"policeCard"}, cur, {now})` · `directSignal(signal, cur, {visualCues})` · useSound 옵션 `visualCues`·`random`·`kill`·`letter`·`policeCard`(마운트 때 이미 있던 값은 본 것으로 침).
- `visualCues` 는 RoomScreen 에서 `nightDarkOf(view) && !reducedMotion` 로 계산(src/game/nightDark.ts). `card` 신호는 RoomScreen onEvent 의 chat 프레임(k = will·note)에서 `chat.lastLiveCardRevealAt()`(src/net/chatStore.ts)으로 delayMs 계산; ballots 카드는 신호 없음 — 12-10 판결 대본이 BALLOT_END_AT 에 ui.card.
- 대본 키: `night:{n}` · `phase:morning:{n}` · `kill:{n}` · `letter:{n}` · `card:police:{n}` · `card:{n}:{delayMs}`(scriptKeys 가 아침·밤 키를 취소 대상으로 계산). 새 대본은 `scriptKeys` 에도 키를 더할 것. 지금(0) 줄은 `now`, 앞 줄은 키 대본(`emitTimed`).
- audioView 에 `morning {eliminated, saved}` 가 생겼다(허용 경로 `view.day.morning`). 12-10 이 필드를 더할 땐 `AudioView`·`AUDIO_VIEW_FIELDS`·`audioViewOf`·soundStaticGuard `ALLOWED_VIEW_PATHS` 세 곳.
- E2E: `makeSoundFlows` 가 이제 `{recorder, attempt, startHost, openGame, closeGame, nightScenario}` 를 받는다. sound-night-parity 의 `soundNightParityRun` 끝(판정 뒤)이 12-10 이 동작 소리 검사를 더할 자리(밤 로그에 emote 소리 0). 판정은 로그를 첫 `bed.night`(밤)·첫 `bed.dawn`(아침)으로 자른다.
- 알려진 한계: 밤 중 모션 줄이기를 켜고 끄면 비네트는 다시 시작하지만 소리 갈래는 밤 진입 때 정해진 채다(남은 밤 큐 없음 가능). 편지 쓰기 길이는 문단 자소 수로 근사(화면은 줄별 합이라 짧은 글에서 190ms 안쪽 차이). 유언 카드 ui.card 는 편지 보류(holdCardsUntil)가 chat.apply 안에서 먼저 돌 때 늦춰진 시각을 따른다.
- 개발 서버가 StrictMode 라 방 화면을 막 연 구간(새로고침)은 같은 침대가 두 줄일 수 있다 — P6 은 night.fall 부재·bed.night 존재만 본다.

## Self-Check: PASSED

- 파일 존재: src/game/nightDark.ts · test/unit/soundNight.test.ts · scripts/e2e/sound.mjs 등 위 목록.
- 커밋 6개(d62caf93 · 9d7975b2 · 2da41669 · 9ced736e · 4b93b7a3 · 6e5d1846)가 HEAD 의 조상임.
