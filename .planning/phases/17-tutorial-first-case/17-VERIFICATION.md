---
phase: 17-tutorial-first-case
verified: 2026-11-09T07:00:00Z
status: human_needed
score: 5/6 must-haves verified
covered_files:
  - ".planning/phases/17-tutorial-first-case/17-01-PLAN.md"
  - ".planning/phases/17-tutorial-first-case/17-01-SUMMARY.md"
  - ".planning/phases/17-tutorial-first-case/17-02-PLAN.md"
  - ".planning/phases/17-tutorial-first-case/17-02-SUMMARY.md"
  - ".planning/phases/17-tutorial-first-case/17-03-PLAN.md"
  - ".planning/phases/17-tutorial-first-case/17-03-SUMMARY.md"
  - ".planning/phases/17-tutorial-first-case/17-04-PLAN.md"
  - ".planning/phases/17-tutorial-first-case/17-04-SUMMARY.md"
  - ".planning/phases/17-tutorial-first-case/17-05-PLAN.md"
  - ".planning/phases/17-tutorial-first-case/17-05-SUMMARY.md"
  - ".planning/phases/17-tutorial-first-case/17-06-PLAN.md"
  - ".planning/phases/17-tutorial-first-case/17-06-SUMMARY.md"
  - ".planning/phases/17-tutorial-first-case/17-07-PLAN.md"
  - ".planning/phases/17-tutorial-first-case/17-07-SUMMARY.md"
  - ".planning/phases/17-tutorial-first-case/17-08-PLAN.md"
  - ".planning/phases/17-tutorial-first-case/17-08-SUMMARY.md"
  - ".planning/phases/17-tutorial-first-case/17-09-PLAN.md"
  - ".planning/phases/17-tutorial-first-case/17-09-SUMMARY.md"
  - ".planning/phases/17-tutorial-first-case/17-10-PLAN.md"
  - ".planning/phases/17-tutorial-first-case/17-10-SUMMARY.md"
  - ".planning/phases/17-tutorial-first-case/17-11-PLAN.md"
  - ".planning/phases/17-tutorial-first-case/17-11-SUMMARY.md"
  - ".planning/phases/17-tutorial-first-case/17-12-PLAN.md"
  - ".planning/phases/17-tutorial-first-case/17-12-SUMMARY.md"
  - "shared/game/audience.ts"
  - "shared/game/phases.ts"
  - "shared/game/room.ts"
  - "shared/game/tick.ts"
  - "shared/game/tutorial.ts"
  - "shared/game/view.ts"
  - "shared/protocol.ts"
  - "shared/schemas.ts"
  - "src/audio/recipes.ts"
  - "src/audio/voice.ts"
  - "src/components/v2/FocusRing.tsx"
  - "src/components/v2/TutorialEntry.tsx"
  - "src/components/v2/TutorialHostBand.tsx"
  - "src/components/v2/TutorialToggle.tsx"
  - "src/components/v2/TutorialWait.tsx"
  - "src/game/tutorialScript.ts"
  - "src/net/useTutorialDirector.ts"
  - "src/screens/Home.tsx"
  - "src/screens/Lobby.tsx"
  - "src/screens/RoomScreen.tsx"
  - "src/screens/TutorialScreen.tsx"
  - "src/styles/tutorial.css"
  - "test/unit/tutorialStaticGuard.test.ts"
  - "test/worker/tutorial.test.ts"
  - "test/worker/tutorialLeak.test.ts"
  - "worker/room.ts"
covered_digest: "v3:sha256:fd2853bec6ea2e71b7c1182efe532f42a23b1bbd2bf2aaf20fdc7c1170ac95dc"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "실기기(폰)에서 첫 화면 큰 카드로 혼자 하기를 한 번 끝까지 본다. 처음 온 사람 1명이 직접 해 보게 하고 관찰한다"
    expected: "사회자 웅얼 목소리와 장면 효과음이 거슬리지 않고 장면과 맞게 들린다. 직접 누르는 순간마다 램프 빛 깜빡임 테두리가 시선을 끌어 무엇을 눌러야 하는지 헤매지 않는다. 끝난 뒤 게임의 목적·한 판 흐름·직업별 할 일을 말로 설명할 수 있고, 첫 판을 해 보고 싶어 한다"
    why_human: "청감·시선 체감·사람의 흥미 반응은 프로그램으로 판정할 수 없다. 목표 문장의 '흥미를 느껴 첫 판으로 이어진다'가 여기에만 달려 있다 (17-VALIDATION.md Manual-Only)"
  - test: "실기기에서 혼자 하기 장면 3~6 을 약 5분 반복 재생하며 프레임 속도를 잰다"
    expected: "평균 55fps 이상. 끊김이 눈에 띄지 않는다"
    why_human: "headless 소프트웨어 렌더의 60fps 는 참고값일 뿐이다. 실기기 성능은 v3.0 끝 실테스트에서만 알 수 있다 (결정 0080-19)"
  - test: "방장 + 손님 실기기 2대 이상으로 '튜토리얼 후 진행' 을 켜고 시작해 함께 진행해 본다 (손님 한 명은 중간에 앱을 껐다 켠다)"
    expected: "모두 끝내면(또는 150초가 지나면) 역할 확인으로 넘어간다. 끝낸 사람이 재접속하면 기다림 화면이 곧바로 보이고, 장면 1 이 눈에 띄게 다시 재생되지 않는다 (코드 리뷰 WR-02 체감 확인)"
    why_human: "모바일 일시 끊김 뒤 재접속 타이밍과 체감 깜빡임은 자동 시험이 재현하지 못한다"
---

# Phase 17: 튜토리얼 "첫 사건" 검증 보고서

**Phase Goal:** 처음 온 사람이 60~90초 미니 에피소드로 이 게임의 목적·재미·한 판 흐름·직업별 할 일을 겪어 알고, 흥미를 느껴 첫 판으로 이어진다(결정 0078).
**Verified:** 2026-11-09T07:00:00Z
**Status:** human_needed
**Re-verification:** No — 초기 검증

## 검증 요약

SUMMARY 의 주장을 믿지 않고 코드와 독립 시험 실행으로 다시 확인했다. 로드맵 성공 기준 5개의 기계적으로 판정 가능한 부분은 모두 코드에 실재하고 배선되어 있다. 막힌 곳(BLOCKER)은 없다. 다만 목표 문장 끝의 "흥미를 느껴 첫 판으로 이어진다"와 소리·깜빡임의 체감, 실기기 성능은 사람만 판정할 수 있다 (17-VALIDATION.md Manual-Only). 규칙에 따라 gaps_found 가 아니라 human_needed 로 둔다.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC-1: 첫 화면(방 만들기·참가 전)에서 튜토리얼을 혼자 시작할 수 있고, 끝나거나 [건너뛰기]하면 첫 화면으로 돌아온다 | ✓ VERIFIED | `src/screens/Home.tsx:46,75-90,168,180-181` — `tutorial` 상태가 `playing` 이면 `<TutorialScreen mode="solo" onEnd={handleTutorialEnd}/>`, 끝나면 `setTutorial("off")` 로 Home 복귀. `TutorialEntry.tsx` 큰 카드(`seen` 거짓)·작은 단추(`seen` 참, `minifia.tutorial.seen` 키 `src/net/session.ts:9,103-108`). 시작 경로에 서버·소켓 호출 없음(주석 T-17-14, 코드 확인). `test/client/tutorialEntry.test.tsx`·`tutorialScreen.test.tsx` 독립 실행 통과. E2E `tutorial-solo` 폰 6종 177/177 등(17-09/17-10 SUMMARY, 로컬+배포본) |
| 2 | SC-2: 방장이 '튜토리얼 후 진행'을 켜고 시작하면 모두 튜토리얼을 마친 뒤(또는 시간이 다 되면) 본게임이 시작되고, 끄면 바로 시작한다 | ✓ VERIFIED | 서버: `shared/game/room.ts:439-446` `beginGame` 이 `opts.tutorial === true` 일 때만 `phase:"tutorial"`, `phaseEndsAt: now + TUTORIAL_MS`, 아니면 `assigning`(서버 기본 꺼짐). `worker/room.ts:481-488,936-958` `handleStart`/`applyTutorialDone` — 전원 완료 시 `tick({...state, phaseEndsAt: now})` + `afterTransition`; `worker/room.ts:1657-1660` 끊김 재검사. `shared/game/phases.ts:78` `tutorial.next = "assigning"`(150초 마감 경로). `shared/game/tick.ts:55` `ON_ENTER.assigning = clearTutorial`. 클라이언트: `src/screens/Lobby.tsx:103,168,211` 방장 스위치(첫 판 켜짐·다시 하기 꺼짐·테스트 방 꺼짐)가 `send({t:"start", tutorial})`. **독립 실행(단일 시험 파일 묶음)**: `test/worker/tutorial.test.ts`+`tutorialLeak.test.ts`+`leak.test.ts` → 33 통과 / 4 skip(skip 은 기존 RULESET 플래그 게이트, 17페이즈 무관). 시험에 "전원 tutorialDone → assigning → roleReveal", "start 에 tutorial 키 없으면 곧장 assigning", "150초 알람이 tutorial→assigning", "봇 제외 셈", "중복 tutorialDone 프레임 0", "대기실 tutorialDone → WRONG_PHASE" 포함 |
| 3 | SC-3: 에피소드가 오프닝 → 심부름·목격 → 아침 흔적↔같은 옷↔목격 → 이름표 투표·정답 → 직업 카드 4종 순이고, 직접 누르는 곳마다 램프 빛 테두리 깜빡임(배경 흐림·포인터 없음), 사회자는 파형+자막 띠, 첫 화면 진입은 큰 카드 | ✓ VERIFIED (기계 판정 범위) | `src/game/tutorialScript.ts` `TUTORIAL_SCENES` 8행(opening→morning→errand→witness→evidence→vote→roles→end)·`focus` 창·`advance` 종류가 표 한 곳에. `TutorialScreen.tsx` 가 실제 `GameMap`(2~6)·`WorldStage`(1·7) 위에서 재생. `FocusRing.tsx`·`tutorial.css:23-39` `border: 4px solid var(--light-lamp)` + `tut-ring` 1초 깜빡임. `grep backdrop-filter\|blur` 튜토리얼 CSS 3개에 0건(배경 흐림 없음), 손가락 포인터 요소 없음(`cursor: pointer` 는 일반 단추 커서). `TutorialHostBand.tsx` 파형 막대+자막. 문구 8개가 UI-SPEC 표와 같음(17-UI-REVIEW Copywriting 4/4). 클라이언트 시험 10파일 248 통과(독립 실행). 깜빡임이 시선을 끄는지는 사람 판정 → Human 항목 1 |
| 4 | SC-4: 사회자 웅얼 목소리와 새 효과음·애니메이션이 Design 캔버스 승인본대로 들어가고, 외부 소리 파일 없이 Web Audio 합성으로 난다 | ✓ VERIFIED (기계 판정 범위) | `src/audio/recipes.ts:137-139,465-513` `tut.*` 12개 + `voice.syl` 레시피. `src/audio/voice.ts` 글자마다 `voice.syl` 예약. `git diff a9022026 HEAD -- public` 에 음원 확장자(mp3·wav·ogg·m4a·aac·webm) 0건; `src/audio` 에 `new Audio`·`decodeAudioData`·외부 음원 로드 0건(합성 `synth.ts` 만). 독립 실행: `voice`·`soundProvenance`·`soundStaticGuard`·`soundRecipes`·`tutorial`·`tutorialScript`·`tutorialStaticGuard` 단위 7파일 256 통과. 소리 체감(승인본과 닮았는지)은 사람 판정 → Human 항목 1 |
| 5 | SC-5: 튜토리얼은 서버 게임 상태를 바꾸지 않고(함께 진행의 끝 신호만 보냄) 역할 정보를 읽거나 보내지 않는다 | ✓ VERIFIED | `TutorialScreen.tsx:31` 실제 연결 훅·fetch·WebSocket 을 가져오지 않음(import 목록 직접 확인 — `ChatStore`·`WorldStore` 로컬, `makeTutorialSend` 어댑터만). `src/game/tutorialScript.ts`·`useTutorialDirector.ts`·`Tutorial*.tsx`·`FocusRing.tsx` 에서 `me.role`·`allies`·`.role`·`loadLastNickname`·`localStorage` 읽기 0건(`nickname: c.name` 은 출연 상수 가짜 값). `test/unit/tutorialStaticGuard.test.ts` 가 파일 이름 규칙으로 고정(통과). 서버: `view.ts:334-336,404` — `me.tutorialDone` 은 본인만·`view.tutorial = {done,total,endsAt}` 은 숫자만, `tutorialPassed` 는 어떤 view 키로도 나가지 않음. tutorial 단계는 `revealsOwnRole:false`. `tutorialLeak.test.ts` 가 역할 5종 시점 동일성·서버 전용 키 부재를 시험(통과). E2E: 혼자 하기 앱 소켓 0·보낸 프레임 0·/api 0, 함께 진행 보낸 프레임은 `tutorialDone` 페이지마다 한 번뿐(17-09/17-10 SUMMARY) |
| 6 | 목표: 처음 온 사람이 겪어 알고 흥미를 느껴 첫 판으로 이어진다 | ? UNCERTAIN (사람 판정) | 장면 표·직업 카드 4종·정체 공개·마무리 카드가 구현되어 "겪어 알게 하는" 수단은 코드에 있다. 그러나 "흥미를 느낀다"·"첫 판으로 이어진다"는 사람 반응이다. 17-VALIDATION.md Manual-Only 로 이미 분류됨 → human_verification 항목 1 |

**Score:** 5/6 truths verified (0 present, behavior-unverified; 1 은 사람 판정 대기)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `shared/game/tutorial.ts` | 순수 규칙 4개 | ✓ VERIFIED | `tutorialProgress`·`markTutorialDone`·`allTutorialDone`·`clearTutorial` 실제 구현(검사 순서 WRONG_PHASE→BAD_MESSAGE→멱등), `view.ts`·`worker/room.ts`·`tick.ts` 에서 import·사용 |
| `src/game/tutorialScript.ts` | 장면 표·문구·가짜 view·로컬 send | ✓ VERIFIED | 장면 8행, 문구 8키, 출연 상수, 정적 가드 대상. `TutorialScreen`·`Home` 에서 사용 |
| `src/screens/TutorialScreen.tsx` | 장면 1~7 재생 | ✓ VERIFIED | 실제 GameMap/WorldStage 사용, `Home`(solo)·`RoomScreen`(together)에서 마운트 |
| `src/audio/voice.ts` + `recipes.ts` 의 `tut.*` | 합성 소리 | ✓ VERIFIED | 13개 레시피, 외부 파일 0 |
| `FocusRing`·`TutorialHostBand`·`TutorialProgress`·`TutorialNext`·`tutorial.css` | 깜빡임 테두리·파형 띠·진행 점·다음 | ✓ VERIFIED | 모두 존재·사용됨 |
| `TutorialEntry`·`TutorialEndCard`·`TutorialToggle`·`TutorialWait` | 진입·마무리·스위치·기다림 | ✓ VERIFIED | `Home`·`Lobby`·`RoomScreen` 에서 사용 |
| `test/worker/tutorial.test.ts`·`tutorialLeak.test.ts` | 서버 게이트·누설 시험 | ✓ VERIFIED | 독립 실행 통과 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `worker/room.ts` | `shared/game/tutorial.ts` | `applyTutorialDone` → `markTutorialDone`·`allTutorialDone` → `tick`+`afterTransition` | ✓ WIRED | `worker/room.ts:47,948-962` |
| `shared/game/room.ts` | `shared/game/phases.ts` | `beginGame` 의 `TUTORIAL_MS` | ✓ WIRED | `room.ts:23,444-445` |
| `shared/game/tick.ts` | `shared/game/tutorial.ts` | `ON_ENTER.assigning = clearTutorial` | ✓ WIRED | `tick.ts:34,55` |
| `Lobby.tsx` | `worker/room.ts` | `send({t:"start", tutorial})` → `schemas.ts` strictObject → `handleStart` | ✓ WIRED | `Lobby.tsx:168`, `schemas.ts:63`, `room.ts:289` |
| `RoomScreen.tsx` | `worker/room.ts` | `TutorialScreen onEnd` → `{t:"tutorialDone"}` → `handleTutorialDone` | ✓ WIRED | `RoomScreen.tsx:399-403,537-542`, `schemas.ts:65`, `room.ts:291-292` |
| `Home.tsx` | `TutorialScreen` | `tutorial === "playing"` 분기, 서버 호출 없음 | ✓ WIRED | `Home.tsx:168-169` |
| `shared/game/view.ts` | 클라이언트 `TutorialWait`/`RoomScreen` | `view.tutorial`·`me.tutorialDone` 허용 목록 | ✓ WIRED | `view.ts:333-336,403-404` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `TutorialScreen` 장면 2~6 | 가짜 `RoomView` | `tutorialView(scene)` — 출연 상수·실제 판정 함수(`actablePlaceOf`·`sameOutfitSeats`·`traceWindowOf`)로 검증된 값 | 예(의도된 가짜 데이터, 서버·역할 아님) | ✓ FLOWING |
| `TutorialWait` | `view.tutorial.done/total` | 서버 `tutorialProgress(state)` → `view.ts:404` | 예 | ✓ FLOWING |
| 방장 스위치 | `tutorialOn` | 로컬 상태 → `start.tutorial` → 서버 `beginGame` | 예 | ✓ FLOWING |

### Behavioral Spot-Checks (독립 실행, 전체 스위트 아님)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 순수 규칙·대본·정적 가드·소리 | `npx vitest run --project unit test/unit/{tutorial,tutorialScript,tutorialStaticGuard,voice,soundProvenance,soundStaticGuard,soundRecipes}.test.ts` | 7 파일 256 통과 | ✓ PASS |
| 서버 게이트·누설 | `npx vitest run --project worker test/worker/tutorial.test.ts tutorialLeak.test.ts leak.test.ts` | 3 파일 33 통과, 4 skip(기존 RULESET 게이트) | ✓ PASS |
| 클라이언트 화면 | `npx vitest run --project client test/client/{tutorialEntry,tutorialScreen,tutorialGate,focusRing,tutorialHostBand,tutorialWait,tutorialTogether,tutorialScenes,tutorialOpening,lobby}.test.tsx` | 10 파일 248 통과 | ✓ PASS |
| 배포본 버전 | `curl https://minifia-v3.dhplay.workers.dev/api/health` | `2026-11-09T06:26:08Z+4858e54f` (17-10 기록과 같음) | ✓ PASS |
| 배포 이후 제품 코드 변경 없음 | `git diff --stat 4858e54f HEAD -- shared worker src scripts public` | 출력 없음 | ✓ PASS |

### Probe Execution

Step 7c: SKIPPED — 이 페이즈는 `scripts/*/tests/probe-*.sh` 프로브를 선언하지 않았다(PLAN·SUMMARY 에 해당 문구 없음).

### Requirements Coverage

PLAN 프런트매터 `requirements` 에 선언된 ID 합집합과 REQUIREMENTS.md 대조. 누락·고아(orphaned) 없음 — REQUIREMENTS.md 에서 Phase 17 로 매핑된 6개가 모두 계획에 의해 주장되었다(17-10 SUMMARY `requirements-completed` 6개 전부).

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| TUT-01 | 17-04·17-06·17-09 | 첫 화면 큰 카드로 혼자 시작, 끝/건너뛰기 → 첫 화면, 본 사람은 작은 단추 | ✓ SATISFIED | 진실 1. `Home.tsx`·`TutorialEntry.tsx`·`session.ts` |
| TUT-02 | 17-01·17-07·17-12 | 방장 스위치로 함께 진행, 전원 완료 또는 150초 후 역할 배정, 끄면 바로 시작 | ✓ SATISFIED | 진실 2. 서버 게이트·워커 시험 통과 |
| TUT-03 | 17-03·17-04·17-05·17-08 | 장면 순서·램프 빛 4px 깜빡임·파형+자막 띠 | ✓ SATISFIED (체감은 사람) | 진실 3. 장면 표·`FocusRing`·`TutorialHostBand` |
| TUT-04 | 17-02 | 웅얼 목소리·효과음 Web Audio 합성만, 외부 파일 0, 소리 설정·모션 줄이기 따름 | ✓ SATISFIED (체감은 사람) | 진실 4. 음원 파일 0, 정적 가드·레시피 시험 통과 |
| TUT-05 | 17-03·17-12 | 서버 상태·역할 값을 읽지도 바꾸지도 않음, 혼자 네트워크 0, 함께는 끝났음 한 가지만 | ✓ SATISFIED | 진실 5. 정적 가드·누설 시험·E2E 프레임 판정 |
| DEPLOY-05 | 17-10·17-12 | 누설 검사를 새 view 필드·단계·메시지·서버 전용 이름까지 넓혀 minifia-v3 에 배포 | ✓ SATISFIED | `tutorialLeak.test.ts`·`leak.test.ts` 통과, 배포본 version 이 17-10 기록과 일치, 배포 후 제품 코드 diff 0 |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| 이 페이즈 변경분(`shared worker src scripts test`) | - | `TBD`·`FIXME`·`XXX` 부채 표식 | - | 새로 추가된 줄 0건 (디프 확인) |
| `src/components/v2/HeadStack.tsx` | 29,82 | 튜토리얼 가짜 이름 "나" 때문에 실제 판의 닉네임 "나" 이름표에서 " (나)" 접미가 빠짐 (코드 리뷰 WR-01) | ⚠️ Warning | 닉네임이 정확히 "나" 인 실제 플레이어만 영향, 진행 지장 없음. 처분: deferred(17-REVIEW-DISPOSITION). 실제 게임 화면 회귀이므로 v3.0 실테스트 후 `selfNamed` 속성으로 가르기를 권장 |
| `src/screens/RoomScreen.tsx` | 392-404, 537-543 | 끝냈음 보낸 직후 소켓이 끊겼다 붙으면 장면 1 이 잠깐 다시 시작 (WR-02) | ⚠️ Warning | 서버 상태는 정상, 일시 현상. 처분: deferred. Human 항목 3 에서 체감 확인 |
| `shared/protocol.ts` | 353,381 | 이미 끝난 일을 "17-12 가 한다" 고 쓴 낡은 주석 (IN-01) | ℹ️ Info | 동작 영향 없음 |
| `.planning` 외 전체 | - | 위생 검사 `git grep -nIiE "torder\|티오더\|조직\|회사\|~/project"` | ℹ️ Info | 히트는 기존 `docs/portfolio-request.md`(회사 관련 표현 금지 지침 문장)와 `seatOrdered` 오탐뿐, 이 페이즈 새 히트 0 |

### 알려진 한계 (의도적으로 고치지 않음, deferred-items.md)

- 장면 6 도윤 이름표가 좁은 폰에서 오른쪽 끝을 3~29px 넘음. 진행 지장 없음(단추 보이는 부분 44 이상).
- 장면 7 직업 카드와 [다음] 이 360x560 에서만 겹침(360x640 은 겹치지 않음).
- 둘 다 프로젝트 원칙("진행에 지장 없는 작은 화면 가장자리 문제는 고치지 않음")에 부합하며, 이후 페이즈 로드맵(Phase 17 이 v3.0 마지막)에 맡길 곳이 없으므로 `deferred` 가 아니라 수용된 한계로만 기록한다.

### Human Verification Required

### 1. 혼자 하기 체감과 첫 판으로의 이어짐

**Test:** 실기기(폰)에서 첫 화면 큰 카드로 혼자 하기를 처음 온 사람 1명에게 끝까지 해 보게 하고 관찰한다.
**Expected:** 웅얼 목소리·효과음이 장면과 맞게 들린다. 램프 빛 깜빡임이 시선을 끌어 무엇을 눌러야 할지 헤매지 않는다. 끝난 뒤 게임의 목적·흐름·직업별 할 일을 설명할 수 있고 첫 판을 해 보고 싶어 한다.
**Why human:** 청감·시선·흥미 반응은 자동화 불가(17-VALIDATION.md Manual-Only). 목표 문장 후반이 여기에만 달려 있다.

### 2. 장면 3~6 5분 평균 55fps

**Test:** 실기기에서 장면 3~6 을 약 5분 재생하며 fps 를 측정한다.
**Expected:** 평균 55fps 이상, 눈에 띄는 끊김 없음.
**Why human:** headless 의 60fps 는 참고값. 실기기 성능은 v3.0 끝 실테스트에서 판정(결정 0080-19).

### 3. 함께 진행 실기기 + 재접속 체감

**Test:** 방장+손님 2대 이상으로 '튜토리얼 후 진행'을 켜고 시작, 손님 한 명은 중간에 앱을 껐다 켠다.
**Expected:** 모두 끝내거나 150초가 지나면 역할 확인으로 넘어간다. 끝낸 사람의 재접속 시 기다림 화면이 곧바로 보이고 장면 1 이 눈에 띄게 다시 나오지 않는다(WR-02).
**Why human:** 모바일 일시 끊김 타이밍과 체감 깜빡임은 자동 시험으로 재현되지 않는다.

### Gaps Summary

막힌 곳(BLOCKER) 없음. 5개 로드맵 성공 기준의 기계 판정 부분과 6개 요구사항(TUT-01~05·DEPLOY-05)은 코드·독립 시험 실행·배포본 확인으로 모두 뒷받침된다. 남은 것은 사람 판정 3건(위 Human 항목)이며, 프로젝트 방침상 실기기 검사는 v3.0 끝 실테스트로 몰아서 한다. 경고 둘(WR-01·WR-02)은 deferred 처분이 맞는 범위이고 phase 목표 달성을 막지 않는다.

---

_Verified: 2026-11-09T07:00:00Z_
_Verifier: Claude (gsd-verifier)_
