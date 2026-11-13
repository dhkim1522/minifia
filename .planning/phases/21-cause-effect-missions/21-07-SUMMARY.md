---
phase: 21-cause-effect-missions
plan: "07"
subsystem: leak-sweep
tags: [leak, public-trace, causalLeak, srcClean, bots, server-only-keys]
requires:
  - phase: 21-cause-effect-missions
    provides: 21-05 의 저녁 가로등 자르기·건너뛰기, 21-06 의 아침 현장·inspect·me.clues·흐림, 20-03 의 마을 구역 판정 모양
provides:
  - 확장판 아침의 공개 흔적(morning.trace·seen·day.evidence) 걷기 — 옷 조각은 현장 ② 를 살핀 본인 me.clues 로만 간다 (D-14·D-18)
  - 확장판 마을 한 판 누설 전수(causalLeak) — 새 단계 전체를 지나는 프레임 판정 여섯 가지
  - 화면 코드 정적 검사(srcClean) — 서버 전용 이름·cut 낱말·cut data 속성
  - 확장판 마을 봇 판 자동 완주 시험
affects: [21-08, 21-10, 21-12, 21-13, 21-17]
requirements-completed: [D-14, D-18, D-21, D-29, D-06, D-15]
actuals:
  tokens: 60000
  tasks: 3
  commits: 5
plan_head_before: 2bdfb8a563c726508c9de119e83b7cb06b6aec05
plan_head_after: b6833fc4fe44c9f2ad0b24dde6f7bc3c57c14887
commits: 5
tech-stack:
  added: []
  patterns:
    - "공개 흔적 갈래는 rules.errand 가 꺼진 판에서만 열린다 — 지금 판 종류로는 닿지 않으므로 옛 흔적 시험은 LEGACY 규칙표({...extended, errand:false}) 또는 상태 주입으로 남는 복사 코드를 지킨다"
    - "한 판 전수: 한 번만 걷고(play()) 여러 it 이 같은 기록을 본다 — 소켓마다 모든 프레임을 JSON 으로 모아 판정"
key-files:
  created:
    - test/worker/causalLeak.test.ts
    - test/unit/srcClean.test.ts
  modified:
    - shared/game/night.ts
    - test/unit/gameMode.test.ts
    - test/unit/night.test.ts
    - test/unit/trace.test.ts
    - test/unit/view.test.ts
    - test/unit/e2eContract.test.ts
    - test/unit/nyquist-03-night-chain.test.ts
    - test/unit/testTools.test.ts
    - test/unit/viewRoles15.test.ts
    - test/worker/trace.test.ts
    - test/worker/errandLeak.test.ts
    - test/worker/leak.test.ts
    - test/worker/night.test.ts
    - test/worker/nightLeak.test.ts
    - test/worker/bots.test.ts
key-decisions:
  - "공개 흔적 걷기의 조건은 rules.errand — trace·witness 규칙 칸은 심부름이 꺼진 판에서만 뜻이 있고 지금 그런 판은 없다. view.ts·EvidenceCard·E2E 사본의 공개 흔적 경로는 지우지 않고 결정 기록 0088 알려진 한계 '쓰이지 않는 공개 흔적 경로 — 정리 후보' 로 남긴다(21-17)"
  - "srcClean 의 cut 낱말 허용 목록은 세 파일이다 — 계획의 '두 파일' 은 src/world/maps/town.ts(마을 지도 지붕·앞벽 덩어리)를 빠뜨렸다"
metrics:
  duration: 약 1시간 30분
  completed: 2026-11-13
status: complete
---

# Phase 21 Plan 07: 공개 흔적 걷기와 누설 전수 Summary

**확장판 아침이 더는 모두에게 같은 옷 조각·마지막 목격을 싣지 않고(`enterMorning` 이 rules.errand 판에서 흔적·목격·흔적 난수를 만들지 않는다 — 단서는 현장 ② 를 살핀 본인 `me.clues` 로만), 확장판 마을 한 판(저녁 켜기·자르기 → 밤 → 아침 살피기 → 토론 → 지목 → 변론 → 찬반 → 처형 → 다음 저녁) 전 프레임을 판정하는 `causalLeak` 과 화면 코드 정적 검사 `srcClean`, 봇 판 완주 시험을 더했다. `npm test` 8729 통과 · 262 건너뜀 · 실패 0, `npm run typecheck` 초록.**

## RED 증거 (단일 줄, 커밋 05bd0b61 시점)

- `expected 'undefined:eliminated,seen,trace:3' to be 'undefined:eliminated:2'` (gameMode: 확장판 enterMorning 키·난수 호출 수)
- `expected 3 to be 2` (night: 탈락 아침 난수 호출 수 — 흔적 난수가 사라져 현장 난수 둘만)
- `expected 'eliminated,trace' to be 'eliminated'` (night·testTools·viewRoles15: 탈락 아침의 키)
- `expected 'whiteCloth' to be undefined` (nyquist-03 사슬: 4~8명 판 시드 1..40 의 morning.trace)
- `expected 'eliminated,trace,seen:3' to be 'eliminated:2'` (trace 단위: 확장판 키·난수)
- `expected 'morning:evidence,lamps,morning,n,role…' to be 'morning:lamps,morning,n,roles,scene,s…'` (view: 확장판 아침 day 키)
- `expected '{"eliminated":1,"trace":"redCloth"}/t…' to be '{"eliminated":1}/false'` (워커 trace: 마을 판 아침 공개 값)
- `expected 'true/true' to be 'false/false'` (워커 trace: 마지막 목격 day.evidence·morning.seen)

## 고친 시험 표 (Task 1 규칙 — 지우기·skip·약화 없음)

| 파일 | 시험 | 이유와 새 기대 |
|---|---|---|
| test/unit/gameMode.test.ts | enterMorning extended 키·난수, tick 으로 아침 진입 | 키 `eliminated` 하나·난수 2(현장 둘), tick 도 basic·extended 모두 `eliminated` |
| test/unit/night.test.ts | 5명 판 탈락·난수 없음 계약·탈락 키 둘·의사가 다른 사람을 지킴·buildView 아침 | 키 `eliminated` 하나, 난수 호출 3→2, 공개 흔적 없음 |
| test/unit/trace.test.ts | enterMorning 의 흔적·morningMs 가산·view 의 흔적·errandLast 수명 | 옛 갈래는 `LEGACY`(심부름만 끈 확장판 규칙표)로 열어 남은 코드를 그대로 지킨다. 난수 호출은 옛 갈래 1/0/0, 확장판 새 시험(탈락 2·미수 2) 추가 |
| test/unit/view.test.ts | day.evidence 수명(상태에 흔적을 직접 넣어 view 복사 검증)·확장판 아침 day 키(evidence 없음)·morning 키·SERVER_ONLY_KEYS | 키 집합에서 evidence 제거, 목록에 lampCut·skipVote·smudged·steps·eyes |
| test/unit/e2eContract.test.ts | smoke 판정이 실제 전이 아침 view 를 통과 | 옛 모양(eliminated·trace·seen)이 smoke 에 여전히 통과하는지를 LEGACY 아침으로 본다 |
| test/unit/nyquist-03-night-chain.test.ts | 밤 사슬 불변식(4~8명 × 시드 40) | want 에서 trace 제거, `morning.trace` 는 undefined |
| test/unit/testTools.test.ts | skipPhase 로 넘긴 아침 | 키 `eliminated` |
| test/unit/viewRoles15.test.ts | morning 키 집합 | `["eliminated","saved"]` |
| test/worker/trace.test.ts | 암살 성공·풀이 마피아뿐이면·마지막 목격 둘 | 확장판 키 `eliminated` 하나·day.evidence 없음. 의상 조각 규칙은 마을 판에서 시민이 ② 를 살핀 `me.clues` 의 `redCloth` 로 옮겼다 |
| test/worker/errandLeak.test.ts | ⑤ 아침 흔적·⑦ 마지막 목격 증거 | 어느 프레임에도 trace 키·day.evidence 없음, errandLast 없음(그대로) |
| test/worker/leak.test.ts | 6명 한 판 전수·유언 행렬·SERVER_ONLY_KEYS | 아침 키 `eliminated`·증거 없음, 목록에 새 키 |
| test/worker/night.test.ts·nightLeak.test.ts | 마피아 전원 일치·메타모픽 암살 밤 | 아침 공개 값 `{eliminated}` |

계획 목록 밖의 파일(e2eContract·nyquist-03·testTools·viewRoles15·errandLeak·leak·night·nightLeak)은 전체 시험에서 걸려 같은 규칙으로 고쳤다. `morningCards.test.ts`·`traceView.test.ts`(클라이언트, 뷰를 직접 만든다)는 그대로 통과했다. 흔적 고르기 단위 시험(TRACE_OF_OUTFIT·traceCandidates·pickTracePiece)은 건드리지 않았다.

## causalLeak — 한 판이 지난 경로와 판정

경로: 저녁(시민 c1 hold 켜기 · 마피아 m1 hold 자르기 · 마피아 m2 hold 없이 켜기 · c1·m1 건너뛰기) → 밤(마피아 둘이 시민 c2 의 집, 의사·경찰·시민도 고름) → 아침(m1 이 ② 먼저, c1 이 ② 뒤에·① , 이웃 ③ , 비이웃 ③ ) → 토론 → 지목(모이기, 마피아 m2 지목) → 변론 → 찬반 → 처형 → 다음 저녁. 한 번만 걷고 열한 시험이 같은 기록을 본다. 시험이 모은 프레임: state 180(산 사람 소켓의 관전 아닌 것), world 78(관전 전). 위반 0.

| 판정 | 내용 |
|---|---|
| 지난 단계 | `errand>night>morning>discussion>nomination>defense>verdict>execution>errand2`, 여덟 단계 모두 state 로 받음 |
| (1) 남의 역할 | 역할·allies·job 키는 view.me 에만, 역할 낱말 값은 me 의 허용 경로·옷 id(`players[].look`)·`day.roles[]` 밖에 없음. 관전 view 는 죽은 둘(피해자·처형된 마피아)만 받음 |
| (2) 서버 전용 키 | lampCut·skipVote·smudged·steps·eyes·cloth·window·errandLast·errandFake·nightPick·nightLog 가 어떤 키로도 없고 `clues`·`scene` 은 각각 `view.me.clues`·`view.day.scene` 에만. 원문에도 lampCut·smudged·skipVote·errandLast 없음 |
| (3) day.scene | 키는 `house` 하나 |
| (4) 키 구조 | 아홉 지점(저녁·밤·아침·토론·지목·변론·찬반·처형·다음 저녁)마다 마피아(m1)와 시민(c1)의 view 키 경로 집합이 허용 목록(me.role·allies·allyPicks·nightTally·nightSure·records·note·chat) 밖에서 같다. `me.chat` 은 마피아 밤 대화 채널(지금도 있는 역할 키)이라 허용에 더했다 |
| (5) 응답 수 | 켜기·자르기·마피아 hold 없이 켜기·건너뛰기(시민·마피아)가 모든 소켓에 한 프레임씩. 살피기는 본인 한 프레임, 다른 소켓 0 |
| (6) world | 산 사람이 받은 남의 좌표는 모두 광장 구역 안이고 문 프레임·구역 snap 이 없다(이 판은 모두 광장). 방 안 구역 판정 본체는 20-03 `townLeak` 이 그대로 지킨다 |
| 수명 | 다음 저녁의 모든 소켓에 `day.scene`·`me.clues` 키 없음 |

주의: 판정 (6)은 광장 안 걷기만 본다. 20-03 의 W-우체국 시나리오(`townLeak`)는 시험을 그대로 두어 함께 통과한다.

## 변이 확인 (커밋하지 않고 원복)

| 변이 | 잡은 시험 |
|---|---|
| view.ts: `day.scene` 에 `smudged` 싣기 | (2) 키·(2) 원문·(3) scene 키 — 세 건 |
| view.ts: `day.lampCut` 싣기 | (2) 키·(2) 원문 — 두 건 |
| worker/room.ts: 흐리기 뒤 inspect 응답을 전원 방송으로 | (5) 살피기 본인 한 프레임 |
| view.ts: 마피아에게만 `me.cutLeft` 키 | (4) 키 구조 동일 |
| src 에 추적 임시 파일(lampCut·cut 낱말·`data-cut-state`) 넣기 | srcClean (a)·(b)·(c) 세 건 |

모두 원복했고 `git status` 에 shared·worker 변경 없음을 확인했다.

## srcClean 규칙

`git ls-files src` 의 모든 파일을 읽어 (a) lampCut·smudged·skipVote·mafiaTouch 0건, (b) 낱말 경계 cut(대소문자 무시)이 나오는 파일 = `src/world/character.ts`(모자 머리카락)·`src/world/cutaway.ts`(방 지붕 걷기)·`src/world/maps/town.ts`(마을 지도 지붕·앞벽 덩어리) 정확히 그 셋, (c) `data-` + cut 속성 이름 0건.

## 봇 판

`test/worker/bots.test.ts` 에 확장판 마을(openTown) 봇 판 시험을 더했다: 방장 1 + 봇 5 가 알람과 단계 마감만으로 ended 에 닿고 낮 시작 발표 없이 errand·night 를 지났으며 저장된 맵이 town 이다. 서버 변경 없이 통과했다(5회 연속 통과, 약 3초). 봇은 저녁에 가로등을 켜고(hold 없음) 아침에 살피지 않는다.

## 시험 수치

- `npm test` 8729 통과 · 262 건너뜀 · 실패 0(301 파일 통과 · 6 건너뜀, 110초). 이전(21-06) 8711 + 18(causalLeak 11·srcClean 4·trace 단위 1·bots 1·그 밖 조정).
- `npm run typecheck` 초록.
- 한 번의 전체 워커 시험에서 4건이 걸렸으나 모두 위 표의 목록 밖 시험이었고 고친 뒤 통과.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - 계획 전제 오류] srcClean 의 cut 허용 목록이 두 파일이 아니라 세 파일**
- **Found during:** Task 3
- **Issue:** 계획은 "낱말 cut 은 character·cutaway 두 파일뿐" 이라 했으나 `src/world/maps/town.ts`(마을 지도의 방 지붕·앞벽 덩어리 `cut` 변수·`cut-${id}` 메시 이름)에도 낱말 cut 이 있다. 20페이즈 마을 지도 코드로 등불 자르기와 무관하다.
- **Fix:** 허용 목록을 세 파일로 하고 이유를 시험 주석에 적었다. (a)·(c) 규칙은 계획 그대로.
- **Files modified:** test/unit/srcClean.test.ts
- **Commit:** b6833fc4

**2. [Rule 1 - 새 규칙에 맞춘 시험] 목록 밖 시험 여덟 파일**
- **Found during:** Task 1·2 전체 실행
- **Issue:** 공개 흔적을 걷자 계획 목록 밖의 시험(e2eContract·nyquist-03·testTools·viewRoles15·errandLeak·leak·night·nightLeak)이 trace·evidence 키·난수 호출 수를 단언해 실패했다.
- **Fix:** 위 고친 시험 표 규칙(키 없음 단언 또는 옛 갈래 LEGACY)으로 고쳤다. 지우기·skip·약화 없음.
- **Commit:** 05bd0b61(RED), 85221950

**3. [참고] RED 커밋 05bd0b61 과 GREEN 5791f80a 사이** — 목록 밖 시험 네 개(errandLeak·leak·night·nightLeak)는 워커 전체를 돌려서야 걸려 RED 커밋에 담지 못하고 GREEN 뒤 별도 `test(21-07)` 커밋(85221950)으로 고쳤다. GREEN 직후 5791f80a 시점에는 이 네 파일이 일시 실패 상태다.

## Known Stubs

없음.

## Threat Flags

없음 — 새 네트워크 경로·인증·파일 접근이 없다(시험과 한 줄 규칙 변경).

## 21-08 에 넘기는 것

- 화면(21-08~21-13)은 `srcClean` 을 지켜야 한다: 서버 전용 이름 넷·cut 낱말(허용 세 파일 밖)·cut data 속성을 쓰지 않는다. 화면은 공개 값 `day.lamps`·`day.scene.house`·`day.skipCount`·`me.clues`·`me.skipPhase` 만 그린다.
- 확장판 아침에는 `day.morning.trace`·`seen`·`day.evidence` 가 오지 않는다. 화면에서 EvidenceCard·흔적 창(`traceWindowOf`)이 확장판에서 쓰이지 않는다 — 단서 화면은 `me.clues` 를 그려야 한다. 쓰이지 않는 공개 흔적 경로(view.ts 복사·EvidenceCard·E2E smoke 사본)는 지우지 않았고 결정 기록 0088 알려진 한계("쓰이지 않는 공개 흔적 경로 — 정리 후보", 21-17)로 올려야 한다.
- 확장판 아침 길이는 현장 장면 길이 하나(`MORNING_SCENE_MS`)라 흔적 가산(`morningMsOf`)은 확장판에 쓰이지 않는다.
- 간헐 실패: `test/worker/scene.test.ts` 「창문 …」(역할이 마피아인 이웃이 ③ 을 먼저 살펴 뒤 사람이 touched 를 받는 순서 의존, deferred-items.md 에 기록). 건너뛰기 재판정(접속 끊김)은 21-10·12 에 열려 있다.
- 알려진 간헐 실패(bots mafiaBot·v2Marker·townLeak 알람 경쟁)는 이번 전체 실행에서 나오지 않았다.

## Self-Check: PASSED

- 파일: shared/game/night.ts·test/worker/causalLeak.test.ts·test/unit/srcClean.test.ts·21-07-SUMMARY.md 존재.
- 커밋: 05bd0b61·5791f80a·85221950·24909a8a·b6833fc4 가 HEAD 의 조상.
