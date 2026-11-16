---
phase: 22-cleanup-single-mode
verified: 2026-11-16T23:40:00Z
status: human_needed
score: 6/6 must-haves verified
covered_files:
  - ".planning/phases/22-cleanup-single-mode/22-01-PLAN.md"
  - ".planning/phases/22-cleanup-single-mode/22-01-SUMMARY.md"
  - ".planning/phases/22-cleanup-single-mode/22-02-PLAN.md"
  - ".planning/phases/22-cleanup-single-mode/22-02-SUMMARY.md"
  - ".planning/phases/22-cleanup-single-mode/22-03-PLAN.md"
  - ".planning/phases/22-cleanup-single-mode/22-03-SUMMARY.md"
  - ".planning/phases/22-cleanup-single-mode/22-04-PLAN.md"
  - ".planning/phases/22-cleanup-single-mode/22-04-SUMMARY.md"
  - ".planning/phases/22-cleanup-single-mode/22-05-PLAN.md"
  - ".planning/phases/22-cleanup-single-mode/22-05-SUMMARY.md"
  - ".planning/phases/22-cleanup-single-mode/22-06-PLAN.md"
  - ".planning/phases/22-cleanup-single-mode/22-06-SUMMARY.md"
  - ".planning/phases/22-cleanup-single-mode/22-07-PLAN.md"
  - ".planning/phases/22-cleanup-single-mode/22-07-SUMMARY.md"
  - ".planning/phases/22-cleanup-single-mode/22-08-PLAN.md"
  - ".planning/phases/22-cleanup-single-mode/22-08-SUMMARY.md"
  - ".planning/phases/22-cleanup-single-mode/22-09-PLAN.md"
  - ".planning/phases/22-cleanup-single-mode/22-09-SUMMARY.md"
  - ".planning/phases/22-cleanup-single-mode/22-10-PLAN.md"
  - ".planning/phases/22-cleanup-single-mode/22-10-SUMMARY.md"
  - ".planning/phases/22-cleanup-single-mode/22-11-PLAN.md"
  - ".planning/phases/22-cleanup-single-mode/22-11-SUMMARY.md"
  - ".planning/phases/22-cleanup-single-mode/22-12-PLAN.md"
  - ".planning/phases/22-cleanup-single-mode/22-12-SUMMARY.md"
  - ".planning/phases/22-cleanup-single-mode/22-13-PLAN.md"
  - ".planning/phases/22-cleanup-single-mode/22-13-SUMMARY.md"
  - ".planning/phases/22-cleanup-single-mode/22-14-PLAN.md"
  - ".planning/phases/22-cleanup-single-mode/22-14-SUMMARY.md"
  - "shared/game/nomination.ts"
  - "shared/game/phases.ts"
  - "shared/game/room.ts"
  - "shared/game/ruleset.ts"
  - "shared/game/verdict.ts"
  - "shared/game/view.ts"
  - "shared/game/will.ts"
  - "src/screens/Lobby.tsx"
  - "src/world/character.ts"
  - "worker/room.ts"
covered_digest: "v4:sha256:1948a458f1c1eae4e860fdc2cecfc7f9d48a0cfd570fc7b0b30e4d7f16117c96"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "실기기(폰)에서 새 낮 흐름 한 판: 토론 → 찬반 → 차례 지목 → 유언 → 처형 → 밤"
    expected: "찬반에서 집계 수만 보이고, 지목은 내 차례에 이름표를 눌러 고르며, 처형자만 10초 유언 시트가 뜨고 [남기기]로 일찍 끝나며, 다른 사람은 채팅·동작이 잠긴 채 지켜본다. 유언 카드 3초 뒤 처형 큰 글이 나온다"
    why_human: "화면 연출·터치 감각·실제 지연은 자동 검사로 볼 수 없다. 로컬 E2E(22-13)는 통과 보고이나 실기기·배포본 회귀는 0089-25 에 따라 24 끝으로 미뤄졌다"
  - test: "유령 크기·방향을 눈으로 확인(산 캐릭터 대비 약 75%, 걸을 때 옆·뒷모습)"
    expected: "유령이 산 캐릭터보다 눈에 띄게 작고, 이동 방향으로 몸이 돈다. 이름표와 머리 사이 틈은 알려진 한계"
    why_human: "배율 0.75·root yaw 추종은 코드와 단위 시험으로 확인했으나 시각적 자연스러움은 사람 눈이 필요하다"
  - test: "알려진 한계 셋을 폰에서 확인할지 결정: 360x560 찬반 투표자 스테이지 부족, 처형자 키보드 열림 시 자기 캐릭터 안 보임, 유령 이름표 틈"
    expected: "진행에 지장이 없으면 그대로 둔다(결정 0090-17, 과몰입 경계 메모)"
    why_human: "UI-SPEC 미해결 항목이라 사용자 판단이 필요하다"
  - test: "유언 10초 동안 몸동작을 살릴지 결정(현재는 서버가 채팅·동작·입력 중 모두 막음)"
    expected: "사용자가 유지 또는 변경을 결정한다"
    why_human: "결정 0090-8 이 사용자 결정 거리로 남긴 항목"
---

# Phase 22: 정리 — 판 하나로, 확장판·시상식 제거, 투표·유언 개편, 유령 수정 검증 보고서

**Phase Goal:** 판 종류를 하나로 고정하고 확장판·시상식을 걷어 내며, 낮 투표를 찬반 → 차례 지목 → 처형으로 바꾸고 최후 변론을 유언 하나로 합친다. 유령은 작게, 걷는 방향으로 돈다(결정 0089-12·13·14·17·18·19·20).
**Verified:** 2026-11-16
**Status:** human_needed (자동 검증 가능한 항목은 모두 통과, 실기기 시각·감각 확인만 남음)
**Re-verification:** No — 최초 검증

SUMMARY 의 주장이 아니라 코드를 직접 읽고 grep·시험 실행으로 확인했다.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC1 | 방장 줄에 판 종류 단추·시트가 없고 모든 판이 한 가지 흐름 | ✓ VERIFIED | `git grep` 로 `GAME_MODES\|GameMode\|DEFAULT_MODE\|modePick\|ModeSheet\|ModeChip\|modeText\|RULES_BY_MODE\|CAUSE_MODES\|MODE_MAPS\|lockCause\|lockModeMaps\|openTown\|SHIPPED_\|pickModeVia\|openExtended` 를 shared·worker·src·scripts·test 에서 찾으면 `test/unit/roomDiff.test.ts` 의 "modeToastOf 를 내보내지 않는다" 부재 시험 한 줄뿐. `shared/game/ruleset.ts` 는 `RULES` 상수 하나(`pickTurn: true`, badge·whisper·runoff·showdown 은 false), `shared/game/mode.ts` 없음. `src/screens/Lobby.tsx:240~245` 방장 줄(`HostRail`)은 `mapChip` + [봇] 둘뿐 |
| SC2 | 심부름·등불·마을·밤 집 찾기·아침 현장·의심 보드·목격·밤 흔적·건너뛰기가 코드·화면에서 제거, 흰 분필 윤곽은 유지 | ✓ VERIFIED | shared/worker/src 에서 `errand\|lamps\|mapTown\|houseView\|HouseTag\|SuspectBoard\|boardView\|witness\|traceMark\|EvidenceCard\|SkipPill\|ClueSpot\|ClueCard\|RecordCard\|PLACE_IDS\|placeArt` 0건(shared 에서는 `room.ts` 옛 방 정규화 키 표만). `MapId` 는 bar·plaza(`maps.ts: PLAYABLE_MAPS`). 분필은 `shared/game/view.ts:122~124 day.chalk`, `worker/room.ts captureHomeNow`(cause 분기 없이 captureHome 만), `bar.ts`·`plaza.ts` 의 CHALK_POINTS, `chalk.draw` 소리·`WorldStage data-chalk` 로 남아 있음. scripts/test 의 잔재는 "0건" 부재 단언·옛 방 시험 고정물뿐(22-14 SUMMARY 의 분류와 일치) |
| SC3 | 낮: 토론 → 찬반(집계 수만, 던진 표 과반 찬성이면 진행) → 차례 지목(기록 없음) → 최다 득표자 처형, 동점이면 처형 없이 밤 | ✓ VERIFIED | `phases.ts` 표: discussion→verdict→nomination→defense→execution→night. `verdict.ts resolveVerdict`: `passed = yes*2 > yes+no`, 부결·0표·동수는 `afterDayOf()`=night, 찬반 마감 직후 모든 `verdictVote` 키째 삭제. `nomination.ts resolveNomination`: 최다 정확히 한 명이면 `candidate`, 동점·0표면 `afterDayOf()` + reason(tie/noVotes), 결선은 `RULES.runoff` false 라 없음. 기록 없음: `VoteLogEntry` = `{n, exec{yes,no,passed}, cand{candidate?}, reason?}` 뿐(누가 누구를 골랐는지 없음), `view.ts:80` `day.points` 는 nomination 단계에서만, `view.ts:73~77` 찬반은 `day.verdictCount{yes,no}` 만(`day.voted` 미송출), `ballots`·`BallotReveal` 은 shared/worker/src 에 0건. 시험 실행 통과(아래) |
| SC4 | 처형자만 스포트라이트 아래 10초 유언(미리 쓴 글 시작), 모두에게 보인 뒤 처형. 밤 피해자 유언은 같은 장면(편지). 최후 변론 단계 없음 | ✓ VERIFIED | `phases.ts DEFENSE_MS = 10_000`, defense id 가 유언 단계. `will.ts saveWill`: defense 에서는 `verdict.candidate` 좌석만 허용(후보 없으면 fail-closed), 다른 사람은 WRONG_PHASE. `worker/room.ts applyWill`: `final` + defense + 처형자일 때만 즉시 저장하고 마감을 당겨 tick(조기 종료), 처형자가 아니면 final 무시. `audience.ts CHAT_PHASES` 에서 defense 제외 → 채팅·동작·입력 중 서버 차단(D-33). `emitDeathCards` 가 처형·밤 공용으로 `k:"will"` 카드를 보냄(`ExecutionView{seat, will?}`), 밤 피해자 편지 `WillLetter.tsx`·`useWillLetter.ts` 존재, `MORNING_WILL_MS` 유지. 봇은 `BOT_DEFENSE_LINES` 를 `final` 로 남김. 별도 최후 변론 단계 id 없음 |
| SC5 | 시상(서버 칭호 포함) 없음, 유령은 산 캐릭터의 약 75%이고 이동 방향으로 몸을 돌림 | ✓ VERIFIED | `shared/game/awards.ts`·`stats.ts` 없음. shared/worker/src 에서 `award`·`AWARD_IDS`·`plateCues`·`RESULT_PLATE_KEY` 0건(`ResultScreen.tsx:202` 는 "읽지도 그리지도 않는다"는 주석, scripts 의 `[data-award]` 는 "0건" 판정). `characterData.ts GHOST_SCALE = 0.75`, `character.ts:1009` `sprite.root.scale.setScalar(GHOST_SCALE)`, headY 도 `* GHOST_SCALE`, CAM_YAW 역회전은 삭제되고 root yaw 를 그대로 따름(주석: 0084-3 개정), `runtime.ts` 가 `__mfGhosts{scale, facing}` 훅 노출. `GHOST_ART_H` 는 그대로 |
| SC6 | 기획서·구조 문서가 새 흐름을 따르고, 바뀐 흐름의 로컬 E2E·단위 시험·누설 검사가 통과 | ✓ VERIFIED (E2E 는 SUMMARY 보고, 실기기는 human) | `docs/product.md` 진행 흐름 표(찬반·지목·유언·처형 행), `docs/architecture.md`(RULES 한 곳·옛 방 정규화), `docs/screen-map.md` 22 절. 결정 0090(17줄) 존재, 폐기 7(0074·0078·0080·0081·0086·0087·0088)·개정 4(0063·0066·0072·0084)에 "0089 로 폐기/개정" 표시 확인. 시험은 아래 실제 출력 참고 |

**Score:** 6/6 truths verified (behavior_unverified 0)

### 추가 점검 항목

| 항목 | 결과 | 근거 |
|------|------|------|
| 누설 안전 | ✓ | `test/worker/leak.test.ts` 통과. 찬반 중 던진 좌석·개인 표는 view 에 없음, 개인 표 `verdictVote` 는 서버 전용이고 마감 훅이 키째 삭제. 유언은 처형 단계 view 에서만 모두에게 같은 값, `final` 은 처형자 아니면 응답이 일반 거절과 같아 처형자 신호가 없음 |
| 결정 0051(글 최소) | ✓ | 사회자 문구 `hostLine.ts`: "마지막 한마디"·"마지막 한마디를 들어요", 찬반·지목도 한 줄. 처형 없음 알림은 이유와 무관하게 한 가지(P22-4). 긴 설명 문단 신설 없음 |
| 0089-26(전원 끝내면 자동 넘김)은 22 범위가 아님 | ✓ | `verdict.ts` 헤더에 "조기 종료 없음 — 모두가 일찍 던져도 10초를 채운다", 코드 전체에 전원 완료 조기 마감 로직 없음. 0089 문서는 "구현은 23페이즈"로 명시 |
| 위생 `git grep -nIiE "torder\|티오더\|조직\|회사\|~/project"` | ✓ | 소스·문서: `docs/portfolio-request.md:21` "회사 관련 표현을 넣지 않는다" 규칙 문장 1건(일반 규칙 서술, 이 페이즈 이전부터). `.planning/` 중 22 범위 밖 `phases/20-map-expansion` 의 위생 규칙 서술 2건뿐. 22 산출물에는 없음 |
| 옛 튜토리얼 진입점 숨김(D-08) | ✓ | 첫 화면 [혼자 하기]·방장 줄 [튜토리얼 먼저] 없음. `src` 에 "튜토리얼" 은 주석·사회자 음절 소리(`voice.syl`, 24 용)·`HeadStack` 주석에만 남음 |

### 시험·검사 실제 출력 (이 검증에서 직접 실행)

- `npm run typecheck` → exit 0, `error TS` 0건
- `npx vitest run test/worker/leak.test.ts test/worker/basicDay.test.ts test/worker/will.test.ts test/unit/verdictRule.test.ts test/unit/legacyRoom.test.ts` → `Test Files 5 passed (5)`, `Tests 98 passed | 2 skipped (100)`, 48.8초. 건너뜀 2는 `leak.test.ts` 의 `describe.skipIf(!GAME_RULES.runoff)`·`describe.skipIf(!GAME_RULES.showdown)`(꺼진 장치라 의도된 skip). `pickTurn` 구역·"꺼진 장치 키 0건" 구역은 skip 되지 않고 돈다
- 추가: `npx vitest run test/unit/character.test.ts test/unit/hostLine.test.ts test/unit/roomDiff.test.ts test/worker/pickTurn.test.ts test/unit/chatLog.test.ts` → `5 passed`, `256 tests passed`
- 전체 `npm test`·`node --test scripts` 와 로컬 E2E(11흐름, `E2E OK`, 재시도 0)는 22-13·22-14 SUMMARY 의 보고(238 files 통과, 7190 tests, 622/622)이며 이 검증에서 다시 돌리지 않았다

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `shared/protocol.ts` | 134 | `DayView.voted` 선택 필드가 타입에 남음("22-10 이 지운 뒤 이 필드도 지운다"는 주석, 서버는 싣지 않음) | ℹ️ Info | 죽은 타입 필드. 누설 없음. 23 이후 정리 |
| `src/components/v2/HeadStack.tsx`·`src/screens/GameMap.tsx`·`src/game/chatUi.ts`·`src/styles/phase.css` | 여럿 | 지운 튜토리얼을 말하는 주석 | ℹ️ Info | 코드 동작 영향 없음(24 새 튜토리얼 때 정리) |
| `shared/game/room.ts` | 562~564 | 옛 키 표(`lamps`·`errandPlaces` 등)·`town` 비교 | ℹ️ Info | 의도된 옛 방 정규화(D-03·D-30, 결정 0090-1) |

TBD·FIXME·XXX 부채 표식은 점검 대상 핵심 파일에서 발견하지 못했다. 🛑 Blocker 없음.

### Gaps Summary

코드상 갭 없음. 6개 성공 기준이 모두 코드와 실행한 시험으로 확인됐다. 알려진 한계(옛 기본 규칙 방이 표식 없이 새 단계 순서로 읽힐 수 있는 틈, 결정 0090-1)는 출시 전이라 수용으로 문서화되어 있다. 폰 6종 전체 회귀·배포본 E2E·실기기 확인은 0089-25 에 따라 24 끝으로 미뤘고, 이 때문에 상태는 `human_needed` 다.

---

_Verified: 2026-11-16_
_Verifier: Claude (gsd-verifier)_
