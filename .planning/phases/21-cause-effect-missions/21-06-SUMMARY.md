---
phase: 21-cause-effect-missions
plan: "06"
subsystem: server-tests
tags: [cause-effect, leak, bots, judge, tdd]
status: complete

requires:
  - phase: 21-cause-effect-missions
    provides: "21-02~21-05 의 저녁 등불(me.errand·errandCut)·밤 day.lamps·아침 현장(day.scene·me.scene·touched)·건너뛰기(day.skipCount·me.skip)·아침 근처 snap, 21-01 의 원인 흐름 단계 사슬"
provides:
  - "test/worker/causeLeak.test.ts — 마을 확장판 한 판(저녁·밤·아침·토론·투표·처형·다음 저녁)을 역할 다섯 시점 소켓으로 지나며 judge 한 곳에서 새 키 집합·서버 전용 이름·아침 world 근처 좌표·응답 수열·남의 역할 값을 판정"
  - "test/worker/leak.test.ts — SERVER_ONLY_KEYS 에 errandCut·skipVote·sceneSeen·touched·footprints·windowLit 추가(옛 흐름 전수 시험도 같이 지킨다)"
  - "test/worker/causeBots.test.ts — 테스트 방 봇이 가로등을 사람과 같은 본체로 처리하고, testSkip 이 새 단계를 넘기고, 봇 방이 새 흐름으로 ended 까지 자동 완주"
affects: [21-07, 21-09, 21-10, 21-11, 21-12]

actuals:
  tokens: 10600
  tasks: 2
  commits: 2

plan_head_before: 655a0f722177f4694edff2f2dd6eb2d25972e8d2
plan_head_after: ad7105fecad1d5c504c2cc881d1fcc18ef2aa504
commits: 2

tech-stack:
  added: []
  patterns:
    - "판정 한 곳(judge): 한 판을 한 번만 지나(play 캐시) 소켓 프레임 전체를 모으고 judge(run, 이름)이 첫 위반 한 줄 또는 \"ok\" 를 돌려준다 — townLeak 의 모양을 원인 흐름 새 키·응답 수열로 넓혔다"
    - "새 view 경로 허용 목록(ALLOWED_NEW): 뿌리 아래 경로가 목록 밖이면 실패 — 목록은 초록을 만들려고 넓히지 않는다"
    - "응답 수열 비교는 종류 + 새 키 구조(목록 안은 [] 에서 자른다)이고, 남의 소켓 프레임은 받는 사람 본인의 me 값이 달라 공개 day 구조만 비교한다"

key-files:
  created:
    - test/worker/causeLeak.test.ts
    - test/worker/causeBots.test.ts
  modified:
    - test/worker/leak.test.ts

key-decisions:
  - "서버 코드는 한 줄도 고치지 않았다: 첫 실행에서 서버 누설·봇 결함이 나오지 않았다. 실패 넷은 모두 시험 설계(기대값) 문제였고 단언을 느슨하게 하지 않고 기대를 바르게 고쳤다"
  - "마피아 전용 기존 키(allies·allyPicks·nightTally·nightSure·note·records)는 새 키 비교에서 뺐다(결정 0003·0021) — 마피아의 밤 pick 은 같은 편에게 allyPicks 로 한 프레임이 더 가므로 '남에게 가는 프레임' 은 마피아가 아닌 소켓만 센다"
  - "창문 지점이 읽히려면 짝집 창 불이 켜져 있어야 해서 밤 진입 직후 lamps 를 모두 켠 값으로 고친다(21-04·21-05 시험과 같은 선례) — 밤 단계 공개 값 비교는 고치기 전의 진입 프레임으로 한다"

metrics:
  duration: 약 40분
  completed: 2026-11-15
---

# Phase 21 Plan 06: 원인 흐름 누설 전수·봇 완주 Summary

원인 흐름 한 판 전체를 역할 다섯 시점의 실제 소켓으로 지나며 새 view 키·서버 전용 이름·아침 world 좌표·응답 모양·남의 역할 값 어디로도 역할이 새지 않음을 한 시험(judge)으로 고정하고, 테스트 방 봇이 새 흐름으로 가로등 처리부터 ended 까지 자동 완주함을 증명했다. 서버 수정은 필요 없었다.

## Performance

- **Duration:** 약 40분
- **Tasks:** 2 (각각 시험 커밋 하나 — 첫 실행에 서버 결함이 없어 `fix(21-06)` 커밋은 없다)
- **Files:** 시험 3(새 파일 2 포함), 서버 코드 0

## Accomplishments

- **Task 1 (causeLeak + leak 금지 목록):** 방장 + 손님 다섯(마피아 둘·경찰·의사·시민 둘)이 저녁(전원이 배정 등불 셋을 켜고 마피아 m1·시민 c2 는 같은 순서로 길게 누르기 켜기·그냥·false, 거절도 같은 순서) → 표본 → 밤(진입 공개 값 확인 뒤 마피아 m1 이 동료 집·시민 c2 가 자기 집을 먼저 누르고 바꿈) → 아침(피해자 c1, 마피아가 옷 조각 지점을 먼저·의사 발자국·시민이 마피아 뒤에 같은 지점·경찰 창문, 근처 표본 두 번과 걸음 한 번) → 건너뛰기(m1·c2, 경찰이 과반) → 토론 → 지목(마피아 m2) → 변론 → 찬반 → 처형 → 다음 저녁 첫 프레임까지 한 번 지난다. judge 여섯 판정:
  - `chain`: 단계 사슬이 `errand → night → morning → discussion → nomination → defense → verdict → execution → errand`.
  - `keys`: 같은 단계에서 같은 행동을 한 사람들(저녁·밤·다음 저녁은 m1·c2·경찰·의사, 아침·토론은 m1·c2 또는 넷)의 새 view 키 집합이 같고, 공개 day 값(lamps·scene·skipCount)은 유령 포함 모든 소켓이 같다. 다음 저녁 view 에 지난 낮의 me.scene·me.skip 이 없다.
  - `names`: 서버 전용 이름(errandCut·skipVote·sceneSeen·touched·footprints·windowLit·cloth·window·cut·errandPlaces 등)이 어떤 소켓의 어떤 프레임에도 키로 없고, 새 경로는 허용 목록(ALLOWED_NEW) 안이다.
  - `world`: 산 사람의 아침·밤 world 프레임에서 남의 좌표는 근처 반경(ERRAND_NEAR_R) 안이면서 같은 구역이고, 밤에는 남의 좌표·걸음이 없다(판정한 남의 좌표 프레임 수 0 이면 실패 — 빈 판정 방지).
  - `responses`: 길게 누르기·거절(8)·살피기(5, 마피아 먼저·시민 touched·경찰 창문)·밤 집 고르기(4, 동료 집·자기 집)가 모두 state 한 프레임·같은 구조이고 남의 소켓에는 프레임이 없다(밤은 마피아 아닌 소켓). 건너뛰기는 마피아·시민의 응답 구조와 남의 소켓 프레임(모두 한 프레임, 공개 day 구조)이 같다.
  - `roles`: 산 사람 프레임에 남의 role·allies 경로, spectate, players[].role·job, 역할 낱말 값이 없다(본인 me.role·마피아 본인 채널 me.chat 만). 유령(c1 피해자·m2 처형자)이 사망 뒤 spectate 를 받는다는 예외도 실제로 확인한다(빈 판정 방지).
- **leak.test.ts:** SERVER_ONLY_KEYS 에 새 서버 전용 이름 여섯을 더했다. 옛 흐름 전수(잠금 아래) 20개 시험이 그대로 초록이다.
- **Task 2 (causeBots):** (1) 방장 + 봇 다섯이 가로등 3곳을 받고, errandGo 의 걷기 끝이 가장 가까운 미완료 가로등 중앙이며, errandAct 가 사람과 같은 본체로 한 곳씩 처리해 모든 봇이 3/3(가로등 id 뿐, 자른 등불 없음)이고 저녁을 넘기면 밤 day.lamps 가 처리한 가로등과 같다. (2) 방장(마피아)이 시민 봇을 고르고 의사 봇은 자기 집을 고르게 둔 채 testSkip 이 저녁 → 밤 → 아침(현장, day.scene.house = 피해자 좌석) → 토론으로 넘기고 낮 시작 발표·오류 프레임이 없으며 봇은 현장을 살피지 않는다. (3) 방장(마피아) + 봇 셋이 `driveToEnded` 로 ended 까지 자동 완주하고 오류 프레임이 없다.
- **위험 확인(mutation):** 누설 시험이 이빨이 있음을 보려고 `day.scene` 에 `windowLit` 를 잠깐 실었더니 `(2) names` 가 `원문에 서버 전용 이름 windowLit` 로 실패했다(파일은 되돌렸다).

## Task Commits

1. **Task 1:** `be39c214` test(21-06): 원인 흐름 한 판 누설 전수 (causeLeak.test.ts 새 파일 + leak.test.ts 금지 목록)
2. **Task 2:** `ad7105fe` test(21-06): 봇 원인 흐름 완주 (causeBots.test.ts 새 파일)

## TDD Gate Compliance

이 계획은 시험이 계약이다 — 구현(`feat`)이 따로 없고 서버는 21-02~21-05 가 이미 만들었다. 그래서 RED→GREEN 이 아니라 "계약 시험의 첫 실행 결과"를 그대로 적는다. 서버 수정이 없어 `fix(21-06)` 와 `feat(21-06)` 커밋은 없다.

### 첫 실행 결과 (실제 출력)

- **Task 1:** `npx vitest run test/worker/causeLeak.test.ts test/worker/leak.test.ts --reporter=tap-flat` → `1..26`. causeLeak 6개 중 **4 ok · 2 not ok**, leak.test 20개(건너뜀 4 포함) 전부 ok.
  - not ok (4) `responses`: `건너뛰기 · 남의 소켓 프레임 …me.scene… ≠ … me.scene,.view.me.skip` — 남의 소켓 프레임 구조를 비교할 때 관찰자 본인의 `me.skip`(관찰자가 이미 눌렀는지)이 사람마다 달라 생긴 **시험 설계 오류**. 서버 누설이 아니다. 남의 소켓 프레임은 공개 day 구조만 비교하도록 고쳤다(`dayShapeOf`) — 단언을 약화한 것이 아니라 비교 대상을 "공개 값"으로 바르게 한정했다(내 응답 `mine` 은 me 키까지 그대로 비교한다).
  - not ok (5) `roles`: `역할 값 police 가 .view.players[].look 에 있다` — 옷 id `police` 는 역할 낱말과 겹치는 모두에게 같은 공개 꾸밈 값(.look)이다. 이어서 `.view.day.roles[]`(이번 판 직업 구성표, 공개 정보)와 `.view.me.chat`(마피아 본인의 밤 채널 이름)도 같은 이유로 역할 낱말 값 검사의 예외 경로로 명시했다. **시험 설계 오류**이고 서버 누설이 아니다(세 경로 모두 기존 view 의 공개·본인 값이다). 예외는 경로 단위이고 마피아 본인 채널은 마피아 소켓에서만 허용한다.
- 고친 뒤 causeLeak **6 passed**, leak.test 20 ok. 같은 묶음 여덟 파일(`causeLeak·leak·lampLeak·sceneLeak·townLeak·nightLeak·errandLeak·ghostLeak`)은 **7 passed + 1 failed**(errandLeak 한 건의 "다른 소켓 0 프레임" 단언이 `0:5` — 아래 "알려진 한계"의 간헐 실패, 단독 실행 16/16 통과).
- **Task 2:** `npx vitest run test/worker/causeBots.test.ts --reporter=tap-flat` → `1..4`, **2 ok · 2 not ok**.
  - not ok: `expected 'night → discussion → nomination' to be 'night → morning → discussion'` 와 완주 시험의 사슬 `…night → discussion → nomination → …` — **시험 기대 오류**. 원인 흐름은 현장(피해자)이 없는 밤 뒤의 아침을 길이 0 으로 지나 프레임이 없다(21-01 의 단계 사슬 주석 "morning(현장 없으면 길이 0)"). 방장 마피아가 고르지 않으면 아무도 죽지 않는다. 서버·봇 결함이 아니다.
  - 고친 모양: 새 흐름의 아침을 보려는 시험은 방장이 시민 봇을 고르고 의사 봇은 자기 집을 고르게 해 피해자와 현장을 만들고(`day.scene.house` = 피해자 좌석 단언), 완주 시험은 아침이 없는 사슬(`night → discussion`)을 기대한다. 처음 "ok" 였던 셋째 시험은 의사 봇이 막으면 trivial 하게 참이 되는 조건부 단언이어서 결정적으로 바꿔 합쳤다.
- 고친 뒤 causeBots **3 passed**(연속 3회), `causeBots·bots·errand` 묶음 **3 files passed, 35 passed | 4 skipped**.

## 시험 결과 (실제 출력)

- `npx vitest run test/worker/causeLeak.test.ts test/worker/causeBots.test.ts` 각각 6/6, 3/3 초록.
- 계획 verify 의 여덟 누설 파일 묶음: **Test Files 1 failed | 7 passed (8), Tests 1 failed | 77 passed | 4 skipped (82)** — 실패 한 건은 `errandLeak.test.ts`(⑧ 마피아 가짜 장소 응답 동일성)의 `expected '0:5' to be '0:0'`. 이 파일은 21-05 SUMMARY 가 이미 알린 전체 실행의 간헐 실패 목록에 있다(심부름 표본 알람이 시험 창에 끼어든다). **단독 실행에서 16/16 통과**했다. 이 계획의 파일은 바꾼 적이 없다. 기준 커밋에서 같은 묶음을 돌려 빈도를 비교하지는 못했다.
- `npm run typecheck`(tokens:check·placeart:check·wrangler types·tsc app·tsc worker) → exit 0.
- `npx vitest run --project worker` 전체는 돌리지 않았다(작업 지침: 알려진 간헐 시간 초과). 영향 파일만 개별·묶음으로 돌렸다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - 시험 설계] 남의 소켓 프레임 비교가 관찰자 본인의 me 값을 포함했다**
- **Found during:** Task 1 첫 실행 `(4)` 실패
- **Issue:** 건너뛰기 응답에서 남에게 가는 프레임의 구조를 me 키까지 비교하니 관찰자가 이미 눌렀는지·살폈는지가 달라 거짓 위반이 났다.
- **Fix:** 남의 소켓 프레임은 공개 day 구조(`dayShapeOf`)만 비교하고, 내 응답은 me 키까지 그대로 비교한다.
- **Files modified:** test/worker/causeLeak.test.ts
- **Commit:** be39c214

**2. [Rule 1 - 시험 설계] 역할 낱말 값 검사가 공개·본인 값 세 경로를 잡았다**
- **Found during:** Task 1 첫 실행 `(5)` 실패(차례로 세 번)
- **Issue:** `.view.players[].look`(옷 id police), `.view.day.roles[]`(직업 구성표), `.view.me.chat`(마피아 본인의 밤 채널)이 역할 낱말과 같은 값이다. 모두 기존 view 의 공개·본인 값이다.
- **Fix:** 세 경로만 이유를 달아 예외로 두었다(옷은 OUTFIT_IDS 일 때, 채널은 마피아 소켓일 때). 다른 경로의 역할 값은 여전히 위반이다.
- **Files modified:** test/worker/causeLeak.test.ts
- **Commit:** be39c214

**3. [Rule 1 - 시험 기대] 현장 없는 아침은 단계 사슬에 나타나지 않는다**
- **Found during:** Task 2 첫 실행
- **Issue:** 계획 행동은 testSkip 이 `errand → night → (morning) → discussion` 을 넘긴다고 괄호로 적었는데, 시험 기대를 morning 이 항상 있는 것으로 썼다.
- **Fix:** 아침 단계가 필요한 시험은 방장이 피해자를 만들고, 완주 시험은 아침 없는 사슬을 기대한다.
- **Files modified:** test/worker/causeBots.test.ts
- **Commit:** ad7105fe

### 계획과 달라진 곳 (서버·봇 계획)

없음. 서버 코드(worker/room.ts·shared/game/view.ts)를 고치지 않았다. 봇 계획(errandGo·errandAct)이 이미 가로등 id 를 처리했고(placeCenterFx 가 map.lamps 를 찾는다) testSkip(skipPhase)이 새 단계를 이미 넘겼다.

## Auth Gates

없음.

## Known Stubs

없음.

## 알려진 한계 · 열린 항목

- **시험 편의의 한계:** 아침 현장의 창문 지점이 읽히려면 짝집 창 불이 켜져 있어야 해서 밤 진입 직후 lamps 를 모두 켠 값으로 저장·메모리를 고친다(21-04·21-05 시험의 선례). 그래서 밤에 고른 사람의 state 프레임에는 고친 lamps 가, 고르지 않은 소켓의 마지막 프레임에는 진입 때 값이 있다 — 밤 단계 공개 값 비교는 고치기 전 진입 프레임에서만 하고 아침에는 모든 소켓이 같은 값을 받는다. 실제 저녁 처리로 창을 켜는 경로는 lampErrand·sceneLeak 이 따로 본다.
- **한 판 시나리오의 범위:** 처형 대상은 마피아 m2 로 정했다(판이 끝나지 않고 다음 저녁까지 가도록). 첫날 처형이 시민일 때의 유령 시점은 이 시험의 대상이 아니다(`ghostLeak` 등 기존 시험이 다룬다). 두 유령(밤 피해자 c1·처형자 m2) 모두 spectate 를 받는 것을 확인한다.
- **errandLeak 의 간헐 실패(기존):** 위 시험 결과 참조. 심부름 표본 알람이 응답 창에 끼는 문제이며 이 계획에서 바뀐 것이 아니다.
- 다음 계획(21-07 이후 화면·튜토리얼)이 서버 와이어를 바꾸면 `ALLOWED_NEW`·`SERVER_ONLY_NAMES` 목록을 같이 고쳐야 한다(목록은 초록을 만들려고 넓히지 않는다).

## Threat Flags

없음 — 새 네트워크 면이 없다(시험만 더했다). T-21-22(원인 흐름 view·world 프레임)는 causeLeak 다섯 판정이, T-21-23(옛 흐름 전수 시험의 금지 이름)은 leak.test 의 SERVER_ONLY_KEYS 확장이, T-21-24(봇 계획)는 causeBots 의 완주가 완화·증명한다.

## 위생·기타

- 소리 낱말(소리·sound·audio·효과음)·'플레이어' 는 두 새 시험 파일에서 0건이다. 시험 이름은 '방장·봇·마피아·시민' 으로 쓴다.
- 줄 끝은 바뀐 모든 파일이 LF 다(`grep -c $'\r'` 0). 파이썬 편집은 `newline=''` 로 했다.
- 작업 트리는 계획 시작 때 깨끗했고 마지막 코드 커밋 뒤에도 `git status` 가 깨끗하다.

## Self-Check: PASSED

- FOUND: test/worker/causeLeak.test.ts, test/worker/causeBots.test.ts, test/worker/leak.test.ts 의 errandCut
- FOUND commits: be39c214, ad7105fe (모두 HEAD 의 조상)
