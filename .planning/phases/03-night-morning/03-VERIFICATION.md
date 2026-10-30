---
phase: 03-night-morning
verified: 2026-10-30T10:40:00Z
status: passed
score: 7/7 must-haves verified
covered_files:
  - .planning/phases/03-night-morning/03-01-PLAN.md
  - .planning/phases/03-night-morning/03-01-SUMMARY.md
  - .planning/phases/03-night-morning/03-02-PLAN.md
  - .planning/phases/03-night-morning/03-02-SUMMARY.md
  - .planning/phases/03-night-morning/03-03-PLAN.md
  - .planning/phases/03-night-morning/03-03-SUMMARY.md
  - .planning/phases/03-night-morning/03-04-PLAN.md
  - .planning/phases/03-night-morning/03-04-SUMMARY.md
  - .planning/phases/03-night-morning/03-05-PLAN.md
  - .planning/phases/03-night-morning/03-05-SUMMARY.md
  - .planning/phases/03-night-morning/03-06-PLAN.md
  - .planning/phases/03-night-morning/03-06-SUMMARY.md
  - .planning/phases/03-night-morning/03-07-PLAN.md
  - .planning/phases/03-night-morning/03-07-SUMMARY.md
  - .planning/phases/03-night-morning/03-08-PLAN.md
  - .planning/phases/03-night-morning/03-08-SUMMARY.md
  - .planning/phases/03-night-morning/03-09-PLAN.md
  - .planning/phases/03-night-morning/03-09-SUMMARY.md
  - .planning/phases/03-night-morning/03-10-PLAN.md
  - .planning/phases/03-night-morning/03-10-SUMMARY.md
  - .planning/phases/03-night-morning/03-11-PLAN.md
  - .planning/phases/03-night-morning/03-11-SUMMARY.md
  - .planning/phases/03-night-morning/03-12-PLAN.md
  - .planning/phases/03-night-morning/03-12-SUMMARY.md
  - shared/game/chat.ts
  - shared/game/night.ts
  - shared/game/phases.ts
  - shared/game/tick.ts
  - shared/game/view.ts
  - src/components/MorningCard.tsx
  - src/components/NightPanel.tsx
  - src/game/eliminationText.ts
  - src/screens/DayScene.tsx
  - worker/room.ts
covered_digest: "v3:sha256:ee4081617dbbceaead1f0a38431d9a338c6867443aa41f2652f50518ef1addf1"
behavior_unverified: 0
overrides_applied: 0
re_verification: false
human_verification_approved:
  - item: "밤·아침·관전 화면의 실기기 체감(겹침·읽힘·후광·배경 전환·분위기), 밤 30초 진행 감각, 아침 카드 가독성"
    approved_by: "사용자(dhkim1522)"
    approved_at: "2026-10-30"
    note: "사용자가 2026-10-30 에 모든 실기기 확인을 확인하고 승인했다고 밝혔다(HANDOFF 4·5페이즈 UAT 통과 줄과 같은 승인). 검증자가 직접 기기에서 본 것이 아니다."
---

# Phase 3: 밤과 아침 검증 보고서

**Phase Goal:** 낮 다음 밤이 되면 각 폰이 역할에 맞는 선택 화면을 보이고(마피아는 전용 채팅 포함), 마피아·경찰·의사의 행동이 서로 모르게 처리되어 아침에 결과가 발표된다.
**Verified:** 2026-10-30
**Status:** passed
**Re-verification:** No — 최초 검증 (이 페이즈에는 이전 VERIFICATION.md 가 없었다)

검증 기준은 **현재 코드**(shared/, worker/, src/)다. 3.1·4·5페이즈와 결정 0026·0028·0030·0033·0036 이 3페이즈 화면과 문구를 바꿨으므로, 원래 성공 기준 문구가 나중 결정으로 명시적으로 대체된 곳은 갭으로 세지 않고 아래 "나중 결정으로 대체된 항목" 표에 적었다.

## 목표 달성

### Observable Truths

| # | Truth | 상태 | 근거 |
|---|-------|------|------|
| 1 | SC1: 밤 30초 동안 역할에 맞는 화면이 보인다(마피아 = 동료 표시 + 동료의 현재 선택, 경찰·의사 = 대상 선택, 시민 = 안내 문구). 다른 사람의 역할은 서버가 보내지 않는다 | VERIFIED | `shared/game/phases.ts` `NIGHT_MS = 30_000`, `night.next = morning`. `shared/game/view.ts`: `me.allies`(마피아에게만), `me.allyPicks`(밤·생존 마피아에게만, 누가 골랐는지 없음), `me.pick`(본인에게만), 남의 `nightPick` 은 어떤 키로도 싣지 않음. `src/screens/DayScene.tsx` 가 역할별로 `NightPanel`(경찰·의사 선택 알약, 시민 `NIGHT_PANEL_TEXT.citizen` 안내)과 마피아 채팅 하단을 고른다. `test/client/nightScene.test.tsx`(38개)·`dayTable.test.tsx` 통과 |
| 2 | SC2: 마피아 다수·동률 무작위, 경찰 조사 결과는 본인에게만, 의사가 지킨 사람이 지목과 같으면 생존 | VERIFIED | `shared/game/night.ts` `resolveNight`: 표 집계(A2 고른 표만) → 최다 하나 / 동률은 seat 오름차순 목록에서 `randInt` / 의사 보호 = 최종 지목이면 `eliminated` 없음 / 경찰 `{n, target, isMafia}` 를 그 경찰 `investigations` 에만 쌓음. `test/unit/night.test.ts` 55개(동률 `randInt(2)`, 의사 구출 `{}`, 자기 보호, A1 동시 해결, 4명판 포함) 통과. 경찰 기록은 `view.me.records` 로 본인에게만(`view.ts` 의 `me.role === "police"` 분기). `test/worker/night.test.ts` "밤 마감 뒤 ... 본인 역할의 일지(me.records)를 경찰·마피아·의사만 받는다" 통과 |
| 3 | SC3: 모두가 일찍 골라도 밤은 30초가 다 지나야 끝난다 | VERIFIED | `pickTarget` 은 `phaseEndsAt` 를 건드리지 않는다(`night.ts` 반환 state 에 마감 변경 없음). `worker/room.ts` `applyPick` 에 `reschedule` 호출 없음("마감이 바뀌지 않으니 reschedule 은 필요 없다"). 테스트: `test/unit/night.test.ts` "모두 골라도 phase 는 night 이고 마감은 그대로다(NIGHT-05)", `test/worker/night.test.ts` "모든 행동 역할이 고른 뒤에도 밤은 진입 때 마감·알람 그대로 남는다", "마감 시각이 지난 뒤 도착한 pick 은 ... WRONG_PHASE" 통과 |
| 4 | SC4: 아침 5초 동안 모든 화면에 탈락자 이름 또는 "아무 일도 없었습니다". 탈락자는 유령이 되어 행동·메시지 불가, 게임 전체(실제 직업·밤 행동·마피아 밤 채팅)를 관전하며 서버는 이를 탈락자에게만 보낸다 | VERIFIED | `MORNING_MS = 5_000`. `view.ts` `day.morning` 은 아침 단계에서 모든 viewer 에게 같은 `{eliminated?, phrase?}`; 의사 구출·지목 없음은 둘 다 `{}`. 문장은 `src/game/eliminationText.ts` `morningCardText`(`${이름}님이 ...` / `MORNING_SAFE` "아무 일도 없었습니다"), `MorningCard` 가 `DayScene` 에서 아침에 그려진다. 유령/관전: `view.ts` 의 `spectate`(`def.revealsOwnRole && !isAlive(me)` 일 때만 키 생성, 밤에 `picks`), `DayScene` 의 `spectate = meDead ? view.spectate : undefined` 와 `roleArt`·`spectatorPicks`·읽기 전용 관전 하단. 탈락자 행동 거부: `pickTarget`(탈락 행위자 BAD_MESSAGE), `chat.ts` `isAlive(sender)` 검사. `test/worker/night.test.ts` "탈락한 시민의 소켓만 탈락한 아침 state 부터 모든 직업(spectate.seats)을 받는다", "탈락자의 pick 은 BAD_MESSAGE ..." 통과 |
| 5 | 마피아 전용 밤 채팅(COMM-04 밤, 결정 0019): 살아 있는 마피아끼리만 밤 템플릿 3개와 이모티콘, 다른 소켓에는 전달 안 됨 | VERIFIED | `chat.ts` `QUICK_TEMPLATES` `nightTarget`/`nightAgree`/`nightOther`(`when: "night"`), 밤 생존 비마피아 say = `WRONG_PHASE`(`chat.ts:74`), 밤 번호는 `nextNightSeq` 로 낮 `nextMessageSeq` 와 분리(`chat.ts:125`). `worker/room.ts:361,385` 가 밤에는 `broadcastEventTo(…, nightChatRecipientIds)`(생존 마피아 + 탈락자). `test/worker/night.test.ts` "마피아의 밤 say·emoji 는 살아 있는 마피아 둘에게만 가고 비마피아 네 소켓은 chat·emoji 프레임을 받지 않는다", "밤 say 는 메시지를 저장하지 않고 낮 번호는 그대로이며 밤 번호만 오른다" 통과 |
| 6 | 비공개 정보 경계: 밤 행동 state 는 행위자·관전자에게만, 살아 있는 소켓은 남의 역할·밤 행동·마피아 채팅·spectate 를 한 프레임도 받지 않는다 | VERIFIED | `worker/room.ts` `applyPick` → `sendViewTo(pickRecipientIds(...))`(전원 방송 없음, 거부는 보낸 소켓만). `night.ts` `pickRecipientIds`·`nightChatRecipientIds`. `test/worker/leak.test.ts`(6명 한 판 전수 프레임 — 두 밤·두 아침·행동·마피아 채팅·탈락·관전, 이후 4페이즈 처형·종료 판까지 확장) 통과, `test/unit/view.test.ts` 아홉 단계 뷰 통과. 이후 페이즈가 더한 투표 필드 때문에 누출이 생긴 흔적 없음(같은 파일이 4페이즈 전수 검사로 확장되어 통과) |
| 7 | 현재 흐름에서 밤·아침 루프가 이어진다: 처형(또는 처형 무효) → night → morning → dayAnnounce(일차 +1), 늦은 알람도 한 번씩 따라잡는다 | VERIFIED | `phases.ts` `execution.next = night`, `night.next = morning`, `morning.next = dayAnnounce`; `tick.ts` `ON_ENTER` 에 `night: enterNight`, `morning: enterMorning`, `dayAnnounce: enterDayAnnounce`, `ON_DEADLINE.morning = routeAfterMorning`(승패 시 ended). 3페이즈 당시 `discussion → night` 직결(결정 0020-1)은 4페이즈가 처형 구간을 끼운 현재 흐름으로 대체됨(아래 표). `test/unit/tick.test.ts` 통과 |

**Score:** 7/7 truths verified (0 present, behavior-unverified)

행동 의존 truth(취소·정리·순서 불변식 — 마감 불변, 같은 값 재선택 무전송, 탈락자 거부, 늦은 알람 따라잡기)는 모두 위에 적은 개별 테스트가 직접 실행해 확인한다. 존재 확인만으로 VERIFIED 로 둔 truth 는 없다.

### 나중 결정으로 대체된 항목 (갭으로 세지 않음)

| 3페이즈 당시 문구·산출물 | 대체한 결정 | 현재 상태 |
|--------------------------|-------------|-----------|
| 흐름 `discussion → night → morning → dayAnnounce` (결정 0020-1, ROADMAP 노트 "4페이즈 전 임시") | 결정 0034·0036 (4페이즈) | `discussion → execVote → candidateVote → … → execution → night`, `morning → dayAnnounce`. 밤·아침 길이·훅은 그대로 |
| 선택 링·표적 배지·발밑 원 | 결정 0028-2 → 0030-1 (후광) | 캐릭터 윤곽 후광(흰 = 내 선택, 진홍 = 마피아 동료·관전자의 마피아) |
| 밤 끝 알림(토스트) 후 수사 기록 열기, 밤 배경 SVG | 결정 0028-1 / 0029·0030·0031·0032 | 알림 제거, 배경은 WebP 장면 규칙표(`scenes.ts`), 실내 배경 v4 |
| 헤더 [수사 기록] 버튼과 시트 | 결정 0026 | 역할 카드 시트의 `활동 기록` 탭(경찰 수사일지·마피아 암살일지·의사 치료일지). `src/game/journalText.ts`, `RoleCardSheet.tsx` |
| 아침 탈락 문구 8개(ROADMAP·결정 0019·0020 표의 "1..8") | 결정 0036-9 | `MORNING_PHRASE_COUNT = 7`(`shared/protocol.ts:35`), `ELIMINATION_TAILS` 7개. 서버·화면 값이 일치하고 단위 테스트가 길이를 단언 |
| 탈락자가 보는 살아 있는 사람 이름표 | 결정 0021 → 3.1 | 관전자 화면에서 다른 생존자가 실제 직업 캐릭터로 보임 |

### Required Artifacts

| Artifact | 기대 | 상태 | 상세 |
|----------|------|------|------|
| `shared/game/night.ts` | `pickTarget`·`enterNight`·`resolveNight`·`enterMorning`·`pickRecipientIds`·`nightChatRecipientIds` | VERIFIED | 205줄, 실제 판정·검증 로직. 순수 모듈(전역 난수·시각 없음), tick 훅 표에 연결 |
| `shared/game/phases.ts` / `tick.ts` | night 30s, morning 5s, 진입 훅 | VERIFIED | 단계 표·`ON_ENTER`·`ON_DEADLINE` 에 night/morning 행 |
| `shared/game/view.ts` | 플레이어별 밤·아침 뷰, spectate | VERIFIED | 허용 목록 리터럴로 필드별 생성, 펼쳐 복사 없음 |
| `shared/game/chat.ts` | 밤 템플릿·보낸 사람 규칙·밤 번호 분리 | VERIFIED | 위 truth 5 |
| `worker/room.ts` | pick 핸들러, 한정 전송 | VERIFIED | `handlePick`/`applyPick`/`sendViewTo`/`broadcastEventTo` |
| `src/components/NightPanel.tsx` | 역할별 하단 문구·선택 알약 | VERIFIED | `PickPill`·`NoticePill`·`NIGHT_PANEL_TEXT`, `DayScene` 이 사용 |
| `src/components/MorningCard.tsx`, `src/game/eliminationText.ts` | 아침 카드·문장 표 | VERIFIED | `DayScene` 이 `morningCardText(view.day?.morning, nicknameOf)` 로 렌더 |
| `src/screens/DayScene.tsx` | 밤·아침·관전 장면 | VERIFIED | 밤 pick 전송(`connection.send({t:"pick"})`), 관전 입력은 `meDead && view.spectate` 한 곳에서만 |
| `scripts/smoke.mjs`, `scripts/uat-night.mjs` | 배포본 밤·아침·관전 검사 | VERIFIED(존재·이력) | 파일 존재. 이 검증에서는 배포본 네트워크 스크립트를 다시 돌리지 않았다(아래) |

### Key Link Verification

| From | To | Via | 상태 | 상세 |
|------|----|-----|------|------|
| `DayScene` 대상 탭 | 서버 `pickTarget` | `connection.send({ t: "pick", target })` → `worker/room.ts` `handlePick` → `applyPick` | WIRED | 서버가 역할로 행동 종류를 정하고, 거부는 보낸 소켓에 `error` + state |
| `tick` 밤 마감 | 판정·아침 | `ON_ENTER.morning = enterMorning(state, randInt, …)` | WIRED | 난수는 `cryptoRandInt` 주입 |
| 서버 `day.morning` | 아침 카드 | `buildDay` → `morningCardText` → `MorningCard` | WIRED | 데이터가 실제 판정에서 흐름(고정값 없음) |
| 탈락 | 관전 | `buildView` 의 `spectate` → `DayScene` `roleArt`·`spectatorPicks` | WIRED | 살아 있으면 키 자체가 없음 |
| 밤 chat/emoji | 마피아 소켓 | `nightChatRecipientIds` → `broadcastEventTo` | WIRED | 낮은 `broadcastEvent` |

### Data-Flow Trace (Level 4)

| Artifact | 데이터 | 출처 | 실제 데이터 | 상태 |
|----------|--------|------|-------------|------|
| `MorningCard` | `view.day.morning` | `enterMorning` 판정 결과 `state.morning` | 예 | FLOWING |
| `NightPanel`/`PickPill` | `view.me.pick`·`allyPicks` | `pickTarget` 이 쓴 `nightPick` | 예 | FLOWING |
| 관전 테이블 | `view.spectate.seats/picks` | 서버 저장 역할·`nightPick` | 예 | FLOWING |
| 역할 카드 활동 기록 | `view.me.records` | `investigations`/`assassinations`/`treatments` | 예 | FLOWING |

### Behavioral Spot-Checks

| 동작 | 명령 | 결과 | 상태 |
|------|------|------|------|
| 단위·워커(workerd)·클라이언트 전체 | `npx vitest run test/unit test/worker test/client` | 111 파일, 3035 테스트 모두 통과 (14.4초) | PASS |
| 타입 검사 | `npm run typecheck` | 종료 코드 0 | PASS |

### Probe Execution

해당 없음: 이 페이즈 PLAN 은 `scripts/*/tests/probe-*.sh` 형식 probe 를 선언하지 않았다. 배포본 스모크(`scripts/smoke.mjs`)·봇 UAT(`scripts/uat-night.mjs`)는 배포된 외부 서비스에 접속하는 스크립트라 이 검증에서 새로 돌리지 않았고, 03-12 SUMMARY 의 배포본 실행 기록(스모크 4·5·8명, 봇 5·8명)과 이후 4·5페이즈 배포본 스모크가 같은 밤·아침 경로를 통과했다는 HANDOFF 기록에 의존한다. 이 기록은 증거가 아니라 참고이며, 위 테스트 결과가 이 보고서의 증거다.

### Requirements Coverage

| Requirement | Source Plan | 설명 | 상태 | 근거 |
|-------------|-------------|------|------|------|
| NIGHT-01 | 03-01·03-03·03-07 | 마피아 합동 지목, 다수·동률 무작위 | SATISFIED | `resolveNight` + `night.test.ts` |
| NIGHT-02 | 03-03·03-05·03-11 | 경찰 조사 결과 본인 화면만 | SATISFIED | `view.me.records`, worker/leak 테스트. UI 는 결정 0026 의 활동 기록 탭 |
| NIGHT-03 | 03-03·03-08 | 의사 보호(자신 포함), 같으면 생존 | SATISFIED | `saved` 판정, 테스트 |
| NIGHT-04 | 03-02·03-06·03-08 (+3.1) | 역할별 밤 화면 | SATISFIED | `DayScene`/`NightPanel`/`nightScene.test.tsx` |
| NIGHT-05 | 03-01·03-07 | 일찍 끝나도 30초 유지 | SATISFIED | truth 3 |
| NIGHT-06 | 03-01·03-10 | 아침 5초 발표 | SATISFIED | truth 4 |
| ELIM-01 | 03-02·03-04·03-05·03-07·03-08 (+3.1) | 탈락자 행동 불가·유령·전체 관전 | SATISFIED | truth 4·6 |
| COMM-04 (밤 부분) | 03-04·03-06·03-07 | 밤 마피아 전용 채팅 | SATISFIED | truth 5 (요구사항 자체는 2페이즈 완료 표시, 밤 부분은 3페이즈가 확인) |

고아 요구사항: 없음. REQUIREMENTS.md 의 NIGHT-01~06·ELIM-01 이 모두 이 페이즈 계획에 있다.

### Anti-Patterns Found

| 파일 | 줄 | 패턴 | 심각도 | 영향 |
|------|----|------|--------|------|
| (3페이즈 핵심 파일 전체) | - | `TBD`/`FIXME`/`XXX` 검색 결과 없음 | - | 없음 |
| `test/unit/night.test.ts` | 569, 599 | 테스트 제목이 옛 값("후보 8개", "1 과 8")을 말하지만 본문은 `MORNING_PHRASE_COUNT` 를 써서 통과 | Info | 결정 0036-9(8→7) 이후 제목만 낡음. 동작 영향 없음 |
| `docs/decisions/0020-night-morning-contract.md` | 31 | 판정 규칙표가 문구 "1..8" 로 적혀 있음 | Info | 결정 0036-9 가 7로 바꿈. 결정 문서 쪽 정정은 선택 |
| `.planning/ROADMAP.md` | 22-23 | Phase 2·3 체크박스가 `[ ]` 로 남아 있음(3.1·4·5 는 `[x]`) | Info | 오케스트레이터가 검증 후 갱신 필요. 코드 갭 아님 |
| `.planning/phases/03-night-morning/03-VALIDATION.md` | 4-5 | `status: draft`, `nyquist_compliant: false` | Info | 검증 계약 문서 상태 표기가 갱신되지 않음. 테스트는 모두 존재·통과 |

스텁 분류에 걸린 항목 없음(`=[]`/`return null` 류는 초기값이거나 서버 데이터가 덮어쓰는 값).

### Human Verification (사용자 승인 완료)

| 항목 | 확인 내용 | 결과 |
|------|-----------|------|
| 밤 화면(마피아 채팅·경찰/의사 선택·시민 안내), 후광·유령·관전 화면, 아침 카드, 배경 전환의 실기기 체감과 가독성 | 360~430 폭 폰에서 겹침·줄바꿈 없이 읽히고, 밤 30초·아침 5초 흐름이 어색하지 않은지 | 사용자가 2026-10-30 에 모든 실기기 확인을 확인하고 승인함(검증자는 기기에서 직접 보지 않았다) |

미결 인간 확인 항목 없음.

### Gaps Summary

갭 없음. ROADMAP 성공 기준 4개와 파생 truth 3개(마피아 밤 채팅, 비공개 경계, 현재 흐름의 루프)를 현재 코드와 전체 테스트(3035개 통과, 타입 검사 통과)로 확인했다. 원래 문구와 달라진 곳(후광, 활동 기록 탭, 문구 7개, 4페이즈 흐름)은 모두 이후 결정이 명시적으로 대체한 것이라 갭으로 세지 않았다. 남은 것은 문서 위생(ROADMAP 체크박스, VALIDATION 상태, 결정 0020 표의 "1..8", 테스트 제목)뿐이다.

---

_Verified: 2026-10-30T10:40:00Z_
_Verifier: Claude (gsd-verifier)_
