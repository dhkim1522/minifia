---
phase: 21-cause-effect-missions
plan: "15"
subsystem: e2e-cause-flow
tags: [cause-effect, e2e, real-browser, tutorial, phones, lh-checks]
status: complete

requires:
  - phase: 21-cause-effect-missions
    provides: "21-06 봇 저녁·밤 처리와 testSkip, 21-07~21-11 의 화면 표식(data-house-tag·clue-spot·clue-card·board·skip), 21-12 튜토리얼 새 첫 사건, 21-13·14 기본 세계 = 제품"
provides:
  - "scripts/e2e/lib.mjs: causeChecks(LH1~LH11 순수 판정 묶음), CAUSE_PHASE_GRAPHS(판 종류별 단계 그래프 두 표), 가로등·지점 좌표·짝집·띠 문장·카드 문장 사본, errandChecks profile lamp, tutorialCaseChecks(LH10)"
  - "scripts/e2e/cause.mjs: cause-evening·night·morning·skip·basic(390x844)·phones(폰 6종) 흐름"
  - "browser.mjs 읽기·조작 도우미(저녁·밤 문패·아침 현장·보드·튜토리얼 새 흐름, 길게 누르기, 지점 걷기)"
  - "errand 흐름을 저녁 등불 기준으로 다시 씀, town 흐름을 새 낮 순서에 맞춤, tutorial 두 진입로를 새 첫 사건으로"
affects: [21-16]

requirements-completed: [DEPLOY-06, LAMP-01, HOUSE-01, SCENE-01, BOARD-01, SKIP-01, TUT-06]

estimate:
  tokens: 105000
  raw_tokens: 105000
  tasks: 3
  confidence: low

actuals:
  tokens: 90000
  tasks: 3
  commits: 5

plan_head_before: 51525aaa31ea68817d231792e6226e302f5de48b
plan_head_after: 2e4c04ebc49e939386a05759eb8eee264c07b14c
commits: 5

key-files:
  created:
    - scripts/e2e/cause.mjs
  modified:
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs
    - scripts/e2e/browser.mjs
    - scripts/e2e/flows.mjs
    - scripts/e2e/errand.mjs
    - scripts/e2e/town.mjs
    - scripts/e2e/tutorial.mjs
    - test/unit/e2eContract.test.ts
    - docs/screen-map.md

key-decisions:
  - "errand 는 저녁 등불 기준으로 다시 썼고 witness·trace 는 뺐다(기능이 제품에서 사라짐). 마피아·시민 동일(ER1)은 cause-evening LH2 가 길게 누르기까지 본다"
  - "town 흐름은 방장을 마피아로 두고 토론 보드를 닫은 뒤 걷는다(봇 마피아가 첫 밤에 방장을 없애고, 열린 보드가 맵 입력 면을 덮는다)"
  - "LH11 문패 안쪽 8 inset 은 보이는 원 40 기준(앱 계산 시험과 같음), 아침 [건너뛰기]는 패널 안 입력줄 끝, 보드는 입력줄 부품만 안 가리면 패널 기록 칸을 덮어도 됨"
---

# Phase 21 Plan 15: 원인 흐름 E2E 완주 Summary

**실제 Chrome(로컬 dev, 포트 5231)에서 확장판 저녁 → 밤 → 아침 → 의심 보드 → 건너뛰기, 기본 마피아 불변, 튜토리얼 두 진입로, 폰 6종 겹침이 모두 초록이다. 단 두 곳은 판정 해석을 정해야 했다(아래 "판정 해석·미해결").**

## 커밋 (5)

1. `23661cb8` test: 판정 실패 시험 — RED: `node --test scripts/e2e/lib.test.mjs` 485 중 **20 fail**, `vitest e2eContract` **4 fail**
2. `e4f59fd8` feat: causeChecks·두 판 그래프·사본 — GREEN: node 485/485, e2eContract 107 ok
3. `93a983f7` feat: 판정 보정(실제 화면에서 알게 된 것) — 아래 편차 참고
4. `85c1a1d7` test: cause-* 흐름·errand·town
5. `2e4c04ec` test: 튜토리얼 새 흐름(LH10)·docs/screen-map.md

최종 단위: `node --test scripts/e2e/*.test.mjs` **626 pass / 0 fail**, `vitest run test/unit/e2eContract.test.ts` **not ok 0**(전부 ok).

## 실행 결과 (로컬 `vite dev --port 5231`, 시스템 Chrome, 재시도 0)

Task 2 묶음 `--only cause-,errand,town,mode-` — **268초, E2E OK, 실패 0**:

| 흐름 | 크기 | 통과/전체 | LH |
|------|------|-----------|----|
| cause-evening | 390x844 | 18/18 | LH1·LH2(마피아 0.7초 길게/시민 짧게, 마크업·진행 동일) |
| cause-night | 390x844 | 18/18 | LH3·LH4(네 역할 문패 8·단추 6·패널 88 동일, 동료 1명 집 눌러도 알림 0) |
| cause-morning | 390x844 | 40/40 | LH5·LH6·LH7(마피아가 먼저 손댄 옷 조각 → 시민 dim, 발자국 수 같음, 보드 세 시점, 피해자 없는 밤은 아침 없이 토론) |
| cause-skip | 390x844 | 8/8 | LH8(저녁 남은 37.5초·아침 35.6초 남기고 과반 3/5 로 넘어감) |
| cause-basic | 390x844 | 9/9 | LH9(감시 243·228회, 확장판 요소 0, 옛 단계 순서) |
| cause-phones | 360x640·390x664·430x932·402x874·390x844 | 30/30 ×5 | LH11 |
| cause-phones | 360x560 | 29/29 | LH11 |
| errand | 폰 6종 | 19/19 ×6 | 저녁 등불 기하(EA·EO·EC·EF) |
| town-walk 6종 7/7, town-room 26/26, town-sight 7/7, town-ghost 8/8, town-reduced 5/5 | | | 새 낮 순서 |
| mode-rail 6종(39~41), mode-pick 41/41, mode-basic 19/19, mode-leak 25/25 | | | 기본 마피아 불변 |

Task 3 묶음 `--only tutorial,cause-phones` — **136초, E2E OK, 실패 0**: tutorial-solo 6종 224~226/전체 동일, tutorial-together 390x844 38/38, cause-phones 6종 위와 같음. 혼자 하기는 앱 소켓 0·보낸 프레임 0·/api 0 단언 그대로 통과(TS0·TS2).

LH12(성능)는 이 계획 범위 밖(perf-run)이라 돌리지 않았다.

## 계획 대비 편차 (Deviations)

- **[Rule 1·3] `--only modes` 는 어떤 흐름도 고르지 못한다**(흐름 이름은 `mode-*`) → `--only mode-` 로 돌렸다.
- **[Rule 1] errand/witness/trace**: 옛 심부름·목격 기록·흔적 흐름은 `dayAnnounce → errand` 를 가정해 두 모드 어디서도 못 돈다(기본 마피아는 errand 없음, 확장판은 낮 시작 발표 없음). errand 는 저녁 등불로 다시 썼고(errandChecks/errandCardChecks `profile: "lamp"`), witness·trace 는 [기록] 단추·흔적 카드 기능이 사라져 레지스트리와 코드에서 뺐다. 레지스트리 시험(lib.test.mjs)의 기대 목록을 이에 맞춰 고쳤다.
- **[Rule 1] town**: 방장이 시민이면 봇 마피아가 첫 밤에 방장을 없애(`pick host/other` 는 지목 고정일 뿐 밤 고르기와 무관) 유령 화면이 된다 → 방장을 마피아로 두고(5명판 마피아 1명, 아무 집도 안 고름) 좌석 생존을 확인, 열린 토론 보드가 맵 입력 면을 덮어 지붕·바닥을 못 누르므로 [닫기] 후 걷는다. 판정은 그대로.
- **[Rule 1] 시험 보정(커밋 3)**: LH1b 는 UI-SPEC 초안("표지 3 깜빡임")이 아니라 실제 규칙(빛남 한 종류: 반경 안이면 [켜기]만, 밖이면 보이는 표지 전부, P21-6)으로, LH5b 는 화살표 칩 허용, LH6e 는 마피아가 손댄 발자국에는 수가 없으므로 두 시민 비교로 바꿨다.
- 기본 마피아 부재 선택자·단계 그래프 사본은 `basicOrderChecks(phases, mode)` 로 판 종류별 판정을 더했다(mode 생략 시 옛 표 그대로).

## 판정 해석·미해결 (사용자 결정이 필요한 것)

1. **보드 8자 닉네임(UI Considerations backstop)**: 실측 글자 폭 약 103~104px, 칸 안 폭 56~73px(폰별)로 **8자는 한 줄에 다 들어가지 않고 칸 안에서 잘린다**(CSS `nowrap+overflow:hidden`, 말줄임 없음). 한 줄·칸 밖 번짐 없음은 통과하도록 LH11e 를 "잘리면 overflow hidden 이어야 하고 번지면 실패"로 정했고 잘린 수는 참고 행 LH11t 에 남겼다(예: 390x844 3/4칸, 360x560 3/4칸). "다 들어가고"를 엄격히 읽으면 **실패**이며, 14px 에서는 어떤 격자로도 불가능하다 — 말줄임·두 줄·글자 축소 중 디자인 결정이 필요하다. 제품은 고치지 않았다.
2. **같은 집 지점 표지끼리 겹침**: 실측 중심 거리 47px < 표지 지름 52(P21-9 의 "일반 배율 58px 이상" 주장과 어긋남, 상자 11×28 겹침). UI-SPEC LH11 본문이 요구하는 대상(띠·독·패널·이름표 버튼)이 아니라 판정에서 빼고 참고 행 LH11s 로만 남겼다. 제품 미수정.
3. **문패 안쪽 8 inset**: 360x640 에서 누르기 영역 44 상자가 1px 밖(7~353)이다. 보이는 원 40 기준(UI-SPEC P21-3, 앱의 camera.test 와 같은 기준)으로는 통과한다 — 상자 기준이면 1px 실패.
4. **E2E 로 못 본 것**: 미수(의사가 막은 밤)의 현장, 불 켜진 이웃 창(밝은 창문 카드 — 이 E2E 는 저녁을 건너뛰어 창이 모두 꺼짐; 단위·워커 시험이 맡음), 목격 칸이 *있는* 경우(저녁 등불 중 만남 필요), 확장판 하루 이후(다음 저녁·투표·처형) 완주, 실기기. 보드 목격 칸은 "기록 줄이 있을 때만"으로 판정(없는 판만 관측).
5. 시작 카드 아래 줄이 원인 흐름에서도 "가는 길에 본 사람이 기록돼요"(UI-SPEC P21-17 가 그대로 두기로 함) — 기록이 사라진 지금 문장이 어색하다는 관찰만 남긴다.

## Known Stubs

없음.

## Threat Flags

없음(새 네트워크 면 없음). T-21-47: LH2·LH4 가 마피아/시민 마크업 동일을 실제 브라우저로 판정, 표식 값에 역할 없음. T-21-48: cause.mjs 결과 줄에 닉네임·토큰 없음(e2eContract 가 고정). T-21-SC: 패키지 설치 없음.

## 정리

로컬 dev 서버(5231)와 프로브용 브라우저는 이 계획이 시작한 것이며 종료했다. 배포본은 건드리지 않았다(21-16 몫).

## Self-Check: PASSED

- 파일: scripts/e2e/cause.mjs, errand.mjs, tutorial.mjs, lib.mjs, browser.mjs 존재
- 커밋: 23661cb8·e4f59fd8·93a983f7·85c1a1d7·2e4c04ec 모두 HEAD 조상
- 수용 기준: `grep -c causeChecks lib.mjs` ≥1, `TOWN_CLUE_SPOTS` e2eContract ≥1, cause.mjs 존재, `cause-` ≥5, cause-phones ≥1, tutorial.mjs "정체는 판이 끝나야" ≥1
