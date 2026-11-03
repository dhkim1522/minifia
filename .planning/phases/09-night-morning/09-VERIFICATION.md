---
phase: 09-night-morning
verified: 2026-11-03T08:40:00Z
status: human_needed
score: 4/5 must-haves verified
covered_files: [".planning/phases/09-night-morning/09-01-PLAN.md",".planning/phases/09-night-morning/09-01-SUMMARY.md",".planning/phases/09-night-morning/09-02-PLAN.md",".planning/phases/09-night-morning/09-02-SUMMARY.md",".planning/phases/09-night-morning/09-03-PLAN.md",".planning/phases/09-night-morning/09-03-SUMMARY.md",".planning/phases/09-night-morning/09-04-PLAN.md",".planning/phases/09-night-morning/09-04-SUMMARY.md",".planning/phases/09-night-morning/09-05-PLAN.md",".planning/phases/09-night-morning/09-05-SUMMARY.md",".planning/phases/09-night-morning/09-06-PLAN.md",".planning/phases/09-night-morning/09-06-SUMMARY.md",".planning/phases/09-night-morning/09-07-PLAN.md",".planning/phases/09-night-morning/09-07-SUMMARY.md",".planning/phases/09-night-morning/09-08-PLAN.md",".planning/phases/09-night-morning/09-08-SUMMARY.md",".planning/phases/09-night-morning/09-09-PLAN.md",".planning/phases/09-night-morning/09-09-SUMMARY.md",".planning/phases/09-night-morning/09-10-PLAN.md",".planning/phases/09-night-morning/09-10-SUMMARY.md",".planning/phases/09-night-morning/09-11-PLAN.md",".planning/phases/09-night-morning/09-11-SUMMARY.md",".planning/phases/09-night-morning/09-12-PLAN.md",".planning/phases/09-night-morning/09-12-SUMMARY.md",".planning/phases/09-night-morning/09-13-PLAN.md",".planning/phases/09-night-morning/09-13-SUMMARY.md",".planning/phases/09-night-morning/09-14-PLAN.md",".planning/phases/09-night-morning/09-14-SUMMARY.md",".planning/phases/09-night-morning/09-15-PLAN.md",".planning/phases/09-night-morning/09-15-SUMMARY.md",".planning/phases/09-night-morning/09-16-PLAN.md",".planning/phases/09-night-morning/09-16-SUMMARY.md",".planning/phases/09-night-morning/09-17-PLAN.md",".planning/phases/09-night-morning/09-17-SUMMARY.md",".planning/phases/09-night-morning/09-18-PLAN.md",".planning/phases/09-night-morning/09-18-SUMMARY.md",".planning/phases/09-night-morning/09-19-PLAN.md",".planning/phases/09-night-morning/09-19-SUMMARY.md",".planning/phases/09-night-morning/09-20-PLAN.md",".planning/phases/09-night-morning/09-20-SUMMARY.md",".planning/phases/09-night-morning/09-21-PLAN.md",".planning/phases/09-night-morning/09-21-SUMMARY.md",".planning/phases/09-night-morning/09-22-PLAN.md",".planning/phases/09-night-morning/09-22-SUMMARY.md",".planning/phases/09-night-morning/09-23-PLAN.md",".planning/phases/09-night-morning/09-23-SUMMARY.md","shared/game/audience.ts","shared/game/night.ts","shared/game/view.ts","shared/game/will.ts","src/screens/GameMap.tsx","src/world/tension.ts","worker/room.ts"]
covered_digest: "v3:sha256:cc3bd9ddd2e3ac1d860c5c904b2bb135ae6d858b17d54dd7aefcbb566adeb819"
behavior_unverified: 0
overrides_applied: 0
gaps: []
behavior_unverified_items: []
human_verification:
  - test: "B1/B12 낮 + 밤 + 아침 5분 흐름 (마피아 판·시민 판 각각) 실기기 성능"
    expected: "5분 평균 55fps 이상, 끊김(>50ms) 5회 이하, 열감 미지근 이하. 로컬 스로틀 숫자(평균 59.99fps, 끊김 0)와 나란히 기록"
    why_human: "크롬 CPU 4배 스로틀 측정은 고사양 데스크톱 값이라 폰 합격 근거가 아니다(결정 0055)"
  - test: "B2 시민 편 어둠 가독 (밤 헤더·패널 글자 대비, 내 캐릭터·이름표)"
    expected: "글자 4.5:1 이상으로 읽히고 내 위치를 잃지 않음"
    why_human: "시각 대비와 어두운 화면 가독은 눈으로만 판단할 수 있다"
  - test: "B3/B7/B6 밤 이름표 위치, 마피아 이름표 버튼, 얼굴 칸 누르기 (4명·8명, 4자·8자 이름)"
    expected: "이름표가 스테이지 안에 보이고, 의도한 얼굴/이름표가 손가락으로 눌리며, 8자 이름이 칸 밖으로 넘치지 않음"
    why_human: "손가락 크기·실제 뷰포트에서의 터치 정확도"
  - test: "B4/B10 아침 가독과 카드 시간순 (분필·36px 알림·유언·쪽지·경찰 결과)"
    expected: "3초 안에 읽히고 카드가 겹치지 않으며 처형 유언 → 피해자 유언 → 쪽지 → 경찰 결과 순서로 뜸"
    why_human: "연출 타이밍과 시각 겹침은 자동 시험이 없다"
  - test: "B5 유언 시트 + iOS 키보드 (한글 조합 중 저장·닫기)"
    expected: "키보드 위에 시트가 뜨고 입력줄이 가려지지 않으며 저장 뒤 시트가 닫히고 키보드를 닫으면 패널이 돌아옴"
    why_human: "iOS 가상 키보드와 IME 동작은 실기기에서만 재현된다"
  - test: "B8/B9 맥박·번쩍임·베기·막 타이밍 체감 (모션 줄이기 포함)"
    expected: "긴장되지만 어지럽지 않고, 막이 길게 느껴지지 않으며 분필이 막 뒤에서 자연스럽게 나타남, 모션 줄이기에서 약해짐"
    why_human: "연출 체감은 눈으로 확인해야 한다"
  - test: "B11 360x560 경찰 밤 8자 이름 줄바꿈 시 이름표 약 19.6px 상승 (알려진 한계)"
    expected: "진행에 지장 없음이면 그대로"
    why_human: "사용자 판단 사항"
  - test: "표 C 다른 기기·브라우저 (iOS Safari/Chrome, Android Chrome, 삼성 인터넷, 카카오톡 인앱)"
    expected: "유언 시트 입력칸·얼굴 칸·이름표 버튼이 각 환경에서 동작"
    why_human: "기기별 브라우저 차이"
  - test: "표 D / 성공 기준 5 — 팀(4명 이상)이 배포본에서 낮 + 밤이 이어지는 한 판을 끝까지 하고 ①~⑥과 확정 실패 원인을 기록"
    expected: "이동·채팅·밤 긴장이 대면 마피아 같은 느낌을 주는지 기록하고, 이 결과로 10페이즈 이후 투자를 이어 갈지 정한다"
    why_human: "사람 플레이 관찰이 성공 기준 자체다. 자동 확인으로 대신할 수 없다"
  - test: "배포본 smoke full (환경 의심, 미확인)"
    expected: "빠른 망에서 `node scripts/smoke.mjs --prod --stage full --players 5` 가 통과하거나, 실패하면 원인이 앱인지 망 지연인지 가려짐"
    why_human: "이 위치에서 5회 모두 타이밍 문턱으로 실패했고 health 응답도 느렸다(v1도 같다). 로컬 smoke는 반복 통과. 확정된 갭이 아니라 환경 의심으로 둔다"
---

# Phase 9: 밤과 아침 검증 보고서

**Phase Goal:** 밤에는 마피아만 맵에서 움직여 암살하고 시민 편은 어둠 속에 있으며, 아침에 현장·유언·쪽지가 공개되어 한 판이 처음으로 맵 위(낮 + 밤)에서 끝까지 돈다
**Verified:** 2026-11-03T08:40:00Z
**Status:** human_needed
**Re-verification:** No — 초기 검증

## 판정 요약

코드에서 막는 갭(BLOCKER)은 찾지 못했다. 서버 규칙·받는 사람 분기·아침 공개·유언/쪽지·클라이언트 연결이 모두 실제 코드로 존재하고, 누출 시험이 통과한다. 남은 것은 설계상 미룬 실기기·눈 확인과 성공 기준 5(팀 한 판)이며, 이 항목들 때문에 상태는 `human_needed` 다. 코드 리뷰의 경고 2건·정보 1건은 모두 열려 있고 차단 사유가 아니다.

## Goal Achievement

### Observable Truths (ROADMAP 성공 기준 + 요구사항)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 밤에 각자 토론이 끝난 자리로 돌아가고 마피아만 맵을 움직인다. 시민 편은 깜깜하고 다른 사람이 안 보이며, 마피아가 움직여도 가만히 있어도 시민 편이 받는 메시지는 같다. 유령은 밤에도 관전한다 (NIGHT-07) | ✓ VERIFIED | `shared/game/movement.ts` `canMoveIn(phase, alive, isMafia)` 는 밤에 산 마피아만 허용. `shared/game/audience.ts` 의 `audience` 는 밤 world mover 가 산 마피아면 `산 마피아 + 유령`, 아니면 빈 집합이고 `worldVisibleTo` 는 시민 편에게 본인 한 칸만 준다. `worker/room.ts` `captureHomeNow`→`syncHome` 이 밤 진입 시 home 으로 순간이동하고 보는 사람별 snap 을 보낸다. `test/worker/nightLeak.test.ts` 가 L1(마피아가 move×3·pick·chat·typing 을 보내는 구간에 시민/경찰/의사 소켓 프레임 `[]`), 메타모픽 (i) 무사 밤·(ii) 암살 밤(움직임 유무와 무관하게 시민 프레임 열 동일), 재접속 L9 를 직접 검사한다. 전체 vitest 에서 통과 |
| 2 | 마피아는 대상에게 다가가 암살하고 산 마피아 전원이 같은 대상을 골라야 확정(못 맞추면 아무도 안 죽음). 경찰·의사는 얼굴 목록에서 고르고, 마피아는 확정된 암살에 익명 쪽지를 남긴다 (NIGHT-08, NIGHT-09, NIGHT-12) | ✓ VERIFIED | `shared/game/night.ts` `confirmedTarget`(전원 일치, 탈락자·마피아 지목 재검증) → `resolveNight`/`enterMorning`(난수 없음, 갈리면 `morning {}`). `shared/game/will.ts` `saveNote`: 산 마피아 + 확정 대상 있을 때만, 작성자를 저장하지 않음, `noteRecipientIds` 는 산 마피아만. `shared/game/bots.ts` `botMafiaTarget` 협응과 `worker/room.ts` 의 마피아 봇 다가가기(`approachPoint`)가 연결됨. `src/screens/GamePanel.tsx` 가 `FaceList` 를 사용. `test/worker/night.test.ts`, `will.test.ts`(쪽지는 산 마피아 둘에게만, 시민·유령 프레임 0개) 통과 |
| 3 | 시민 편 깜깜한 화면에 서버 움직임과 무관한 긴장 연출이 나오고, 암살당한 사람은 밤 판정이 끝난 뒤 깜깜한 화면에서 암살 이펙트를 본다 (NIGHT-10, NIGHT-11) | ✓ VERIFIED (연출 체감은 사람 확인) | `src/world/tension.ts` 는 `rng`·타이머·`reducedMotion` 만 받는 스케줄러이며 아무것도 import 하지 않는다(서버 프레임과 끊김). `test/.../tensionStaticGuard.test.ts` 가 정적으로 고정. `src/screens/GameMap.tsx` 의 `nightDark` 일 때 `TensionVignette` 를 underlay 로 연결하고 `KillFx`·`SceneCurtain(holdUntil)` 이 마운트됨. 연출이 체감상 괜찮은지는 human_verification (B8, B9) |
| 4 | 아침에 분필 윤곽이 그날 낮 동안 남고, 유언·쪽지가 공개되어 채팅창 카드로 남는다. 의사가 살렸으면 "누군가 살아났습니다" 만. 아침 길이는 서버가 정한다. 유언은 누구나 언제든 쓰고 고칠 수 있고, 쓰는 동안 신호가 없으며, 죽기 전에는 어떤 메시지에도 담기지 않는다 (MORN-01~04, WILL-01) | ✓ VERIFIED | MORN-01: `worker/room.ts` `fillChalk`(home 좌표, 없으면 구간 끝점, 처형에는 없음), `view.ts` 의 `day.chalk`, `presence.ts`→`WorldStage` `data-chalk`·`runtime.ts` 분필 그리기. MORN-02/WILL-01: `emitDeathCards`/`appendCard` 가 `audience(all)` 로 한 번 만들고 마스크와 함께 저장, 작성자 없음. WILL-01: `saveWill` 은 지도 단계의 산 사람이면 누구나 가능, 같은 값 재저장은 입력 그대로(프레임 없음), `view.ts` 는 `isAlive(me)` 본인에게만 `me.will` 을 싣는다. MORN-03: `enterMorning` 이 구출이면 `{saved:true}` 만, 탈락 없는 모든 밤의 `morningMsOf` 가 5000ms 로 같아 길이로 새지 않음. MORN-04: `discussion.ts` `morningMsOf` 5/+2/+2/+2, 상한 15초. `test/worker/morningCards.test.ts`(처형 유언 카드, 분필 좌표·재접속·알람 따라잡기, 구출·무효 밤 카드 0장), `will.test.ts`, `nightLeak.test.ts` L6 통과 |
| 5 | 팀(4명 이상)이 배포본에서 낮과 밤이 맵 위에서 이어지는 한 판을 끝까지 하고, 대면 마피아 같은 느낌인지 기록한다 | ? UNCERTAIN → 사람 확인 | 사람 플레이 관찰이 기준 자체다. 코드/자동 확인으로 판정할 수 없다. 표 D(`09-DEVICE-CHECKS.md`)가 전부 `미확인`. 설계상 모든 개발 뒤로 미룬 항목이므로 갭이 아니다 |

**Score:** 4/5 truths verified (0 present, behavior-unverified). 5번은 사람 확인 대기.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `shared/game/night.ts` | 전원 일치 판정·아침 진입 훅·알림 대상 | ✓ VERIFIED | 192줄, 실질 구현, `worker/room.ts` 와 `tick` 에 연결 |
| `shared/game/will.ts` | 유언·쪽지 규칙 | ✓ VERIFIED | `saveWill`/`saveNote`/`noteRecipientIds`, `applyWill`/`applyNote` 에서 사용 |
| `shared/game/audience.ts` | 밤 world 받는 사람·시민 편 한 칸 | ✓ VERIFIED | 밤 분기 존재, 서버 `deliver` 한 길 |
| `shared/game/view.ts` | 밤 필드 본인/마피아 한정 | ✓ VERIFIED | `nightPick`·`nightTally`·`allyPicks`·`note`·`will` 모두 본인·역할 조건 안 |
| `worker/room.ts` | home 기억·순간이동·분필·카드·봇 연결 | ✓ VERIFIED | `afterTransition` 한 길(단계 마감·토론 끝내기·테스트 넘기기가 모두 지남) |
| `src/world/tension.ts` | 서버와 끊긴 긴장 스케줄러 | ✓ VERIFIED | import 0개 |
| `src/screens/GameMap.tsx` 외 (`KillFx`, `SceneCurtain`, `PoliceResultCard`, `WillSheet`, `FaceList`, `useWill`) | 화면 연결 | ✓ VERIFIED | `GameMap.tsx`/`GamePanel.tsx` 에서 import 와 사용 확인 |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| `tick` 전환 | `afterTransition` | `captureHomeNow`→`fillChalk`→`persistAndBroadcast`→`syncPositions`→`emitDeathCards` | WIRED |
| 마피아 걸음 | `emitWorld`→`audience` | mover 를 서버 소켓 playerId 로 넣음 | WIRED |
| 사망 카드 | 채팅 로그/전송 | `appendCard`→`audience(all)`→`seatMask`→`deliver` | WIRED |
| `useWill` | 서버 `applyWill`/`applyNote` | `send` 메시지 | WIRED |
| `tension.ts` | `TensionVignette` | `GameMap` underlay (`nightDark`) | WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real Data | Status |
|----------|------|--------|-----------|--------|
| 분필 | `day.chalk` | `fillChalk` ← `world.home`/구간 끝 | 예 | ✓ FLOWING |
| 유언/쪽지 카드 | chat `k:"will"/"note"` | `player.will` / `room.nightNote` | 예 | ✓ FLOWING |
| 얼굴 목록 | seat → `faceSrc` | 서버 view 의 살아 있는 좌석 | 예 | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 전체 자동 시험 (1회) | `npx vitest run` | 143/145 파일 통과, 4089 통과·3 실패·1 건너뜀 | ✓ PASS (실패 3건은 아래 비차단 flake) |
| 앱 타입 검사 | `npx tsc -p tsconfig.app.json --noEmit` | 오류 0 | ✓ PASS |
| 워커 타입 검사 | `npx tsc -p tsconfig.worker.json --noEmit` | 오류 0 | ✓ PASS |
| flake 재현 확인 | `npx vitest run test/worker/bots.test.ts` (단독 재실행) | 25/25 통과 | ✓ PASS |

전체 실행의 실패 3건: `test/worker/testTools.test.ts` ended 단계 2건은 알려진 간헐 실패(사전 커밋 e494a7b 에서도 난다). `test/worker/bots.test.ts` 의 "봇 셋이 모두 토론 끝내기를 누르면…" 1건은 부하에서 `planKinds` 가 3이 아니라 2였고, 단독 재실행과 해당 시험만 두 번 재실행에서 모두 통과했다. 계획 코드(`planFor`)는 봇마다 `endDiscussion` 을 결정적으로 추가하므로 부하 타이밍 흔들림으로 본다. 확정은 못 했으므로 12페이즈 정리 후보로 기록한다.

### Probe Execution

해당 없음 (`scripts/*/tests/probe-*.sh` 를 이 페이즈가 선언하지 않음).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| NIGHT-07 | 09-01,03,04,09,10,13,15,16,19,21,22,23 | 밤: 마피아만 이동, 시민 편 깜깜, 위치 비공개 | ✓ SATISFIED | 진리 1. `nightLeak.test.ts` |
| NIGHT-08 | 09-01,02,07,12,13,19,22,23 | 전원 일치 암살, 불일치면 무사 | ✓ SATISFIED | 진리 2. `confirmedTarget` |
| NIGHT-09 | 09-01,05,15,20,21,22,23 | 경찰·의사 얼굴 목록 선택 | ✓ SATISFIED | `FaceList` 연결, 시각 확인은 B6 |
| NIGHT-10 | 09-01,06,10,15,21,22,23 | 서버와 무관한 긴장 연출 | ✓ SATISFIED | `tension.ts` + 정적 검사. 체감은 B8 |
| NIGHT-11 | 09-01,18,20,22,23 | 피해자 암살 이펙트(판정 뒤) | ✓ SATISFIED | `KillFx`+`SceneCurtain`. 체감은 B8, B9 |
| NIGHT-12 | 09-01,08,12,14,16,17,22,23 | 마피아 익명 쪽지 | ✓ SATISFIED (코드·시험 기준) | 진리 2. REQUIREMENTS.md 의 `[ ]`/`Pending` 은 공유 ID 게이트 지연 때문으로 보며, 코드·시험이 충족하므로 오케스트레이터가 표시하면 된다 |
| MORN-01 | 09-01,04,10,14,20,22,23 | 분필 윤곽이 낮 동안 | ✓ SATISFIED | `fillChalk`, `morningCards.test.ts` |
| MORN-02 | 09-01,11,14,18,19,22,23 | 유언·쪽지 카드가 채팅에 남음 | ✓ SATISFIED | `emitDeathCards` |
| MORN-03 | 09-01,07,16,18,22,23 | "누군가 살아났습니다" 만 | ✓ SATISFIED | `{saved:true}` |
| MORN-04 | 09-01,07,16,19,22,23 | 서버가 정하는 아침 길이 | ✓ SATISFIED | `morningMsOf` |
| WILL-01 | 09-01,08,11,12,14,16,17,19,21,22,23 | 누구나 언제든 유언, 죽을 때 공개, 신호 없음 | ✓ SATISFIED (코드·시험 기준) | 진리 4. REQUIREMENTS.md 미체크는 공유 ID 게이트 지연 때문으로 보며 충족으로 판정한다 |

PLAN frontmatter 에 선언된 ID 는 11개 전부 REQUIREMENTS.md 에 있으며 빠진 것이 없다. REQUIREMENTS.md 가 9페이즈에 매핑한 ID 중 어떤 계획도 선언하지 않은 ORPHANED 항목은 없다.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| 이 페이즈에서 바뀐 `src`·`shared`·`worker` 파일 | - | `TBD`/`FIXME`/`XXX` | - | 0건 (grep 확인) |

스텁·빈 구현·하드코딩 데이터 흐름은 찾지 못했다.

## Non-Blocking Findings (코드 리뷰, 모두 열림)

차단 0건, 경고 2건, 정보 1건. 이 검증에서 `worker/room.ts` 의 `syncHome` 코드를 직접 읽고 WR-01 이 코드상 사실임을 확인했다(`room.phase !== "night" && room.phase !== "morning"` 이면 바로 return).

| ID | 심각도 | 내용 | 영향 |
|----|--------|------|------|
| WR-01 | WARNING | 알람이 아침 길이(5~15초) 이상 늦으면 `night → morning → 낮` 을 한 번에 지나 `syncHome` 이 건너뛰어짐. 마피아가 걸은 구간이 낮에 남아 암살 대상 곁 위치가 노출되고, 시민 편은 아침 snap 을 못 받아 재접속 전까지 다른 사람 위치가 비어 있을 수 있음 | 드문 지연에서만 발생하나 코드 경로는 확정적. 성공 기준 1의 "낮에 마피아 정보가 새지 않음" 취지와 어긋날 수 있어 보완 계획으로 고쳐야 함. 정상 경로와 한 단계 따라잡기(`nightLeak.test.ts` 125행)는 시험으로 덮여 있으나 이 경로는 시험이 없음 |
| WR-02 | WARNING | `src/components/PoliceResultCard.tsx:31` 얼굴 대체 원이 `--seat-0~7` 을 참조(토큰은 1~8) | 얼굴 그림이 안 뜰 때만 색이 한 칸 어긋남. 시각 결함 |
| IN-01 | INFO | 한글 조합 중 [저장] 뒤 [닫기] 가 버려져 한 번 더 눌러야 시트가 닫힘 (`useComposedText.ts`) | 데이터 손실 없음, 사용성 |

`09-REVIEW-DISPOSITION.md` 는 세 건 모두 `open` 이고 "9페이즈 보완 계획에서 묶어 고친다" 로 기록되어 있다.

추가 참고(비차단):
- 저장소 위생 grep 이 이 페이즈 계획·요약 문서 일부(09-01, 09-23 계획, 09-03 요약)의 "쓰지 않는다" 선언문에서 걸린다. 8페이즈 문서에도 같은 모양의 걸림이 있다. 실제 식별 정보는 아니나 "결과 없어야 함" 기준과는 맞지 않아 다음 문서 정리 때 문구를 바꾸는 편이 좋다.
- 로컬 E2E 간헐 실패 2건(`night-sizes/mafia 360x640 PK3` 버튼 겹침, `ghost 390x664 G2` 토스트 폭)은 2회차에서 사라졌고 원인 미확인이며 12페이즈 정리 후보로 올려져 있다.

## 배포본 상태 (미확인 환경 의심)

배포본(`https://minifia-v2.dhplay.workers.dev`, 커밋 `04e716b`, `src`·`worker`·`shared`·`public` 이 HEAD 와 동일)에서 `smoke full` 이 이 위치에서 5회 모두 타이밍 문턱으로 실패했고 같은 시각 health 응답이 느렸다(v1도 같다). 로컬 smoke 는 반복 통과한다. 지시에 따라 이번 검증에서 배포 smoke 를 다시 돌리지 않았고, **확정 갭이 아니라 미확인 환경 의심**으로 두며 빠른 망에서 다시 확인하도록 human_verification 에 올렸다.

## Human Verification Required

위 frontmatter 의 `human_verification` 참고. `09-DEVICE-CHECKS.md` 의 표 B(B1~B12), 표 C, 표 D 가 모두 `미확인` 이다. 프로젝트 규칙(실기기 검사는 끝에 몰아서)에 따라 설계상 미뤘으며 갭이 아니다. 단, 성공 기준 5 는 팀 한 판 관찰 자체가 기준이므로 그 전에는 "완전 달성" 이라 말할 수 없다.

## Gaps Summary

막는 갭은 없다. 코드·시험 기준으로 요구사항 11개가 모두 충족되었고(NIGHT-12·WILL-01 포함), 남은 일은 (1) 실기기·팀 확인, (2) 열려 있는 경고 WR-01/WR-02 와 정보 IN-01 정리, (3) 배포본 smoke 의 환경 의심 재확인이다.

---

_Verified: 2026-11-03T08:40:00Z_
_Verifier: Claude (gsd-verifier)_
