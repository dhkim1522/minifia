---
phase: "03"
slug: night-morning
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-25"
---

# Phase 03 — Validation Strategy

> 실행 중 피드백 표집을 위한 페이즈별 검증 계약. 원천은 `03-RESEARCH.md` 의 "Validation Architecture" 이고, 결정 0021(탈락자 관전)과 plan-checker 지적(밤 채팅 번호 분리 W3·거부 코드 규칙 하나 W5)을 반영했다. 표의 명령은 각 PLAN.md `<verify><automated>` 와 같은 글자다(68개).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.12 — 프로젝트 3개: `unit`(node) · `client`(happy-dom + React) · `worker`(workerd, `@cloudflare/vitest-plugin` 1.4.6) |
| **Config file** | `vitest.config.ts` (passWithNoTests 끔 — 필터가 아무것도 못 찾으면 실패) |
| **Quick run command** | `npx vitest run <파일>` (해당 태스크의 테스트 파일) |
| **Full suite command** | `npx vitest run && npm run typecheck` (+ 화면 계획은 `npm run build`) |
| **Estimated runtime** | 전체 약 10초(기준선 56 파일·1052 테스트 약 6초 + 3페이즈 추가분), 배포본 스모크 1회 약 3분, 봇 밤 시나리오 1회 약 5분 |

---

## Sampling Rate

- **After every task commit:** 그 태스크의 `npx vitest run <파일들>` (수 초)
- **After every plan wave:** `npx vitest run && npm run typecheck` (화면 웨이브는 `&& npm run build`)
- **Before `/gsd-verify-work 3`:** 전체 green + 배포본 `node scripts/smoke.mjs --prod --stage full`(4·5·8명) + `node scripts/uat-night.mjs --prod`(5·8명) + `node scripts/uat-day.mjs --prod --players 5` 종료 코드 0
- **Max feedback latency:** 15초(로컬), 배포본 확인은 03-12 에서만

---

## Requirement → Test Map

| Req ID | Behavior | Test Type | 확인하는 곳 (계획·태스크) |
|--------|----------|-----------|---------------------------|
| NIGHT-01 | 마피아 표 최다 지목·동률은 randInt 로 동률 집합 안에서·일부만 고른 표(A2)·지목 없음=탈락 없음·자신/동료 지목 거부 | unit | `test/unit/night.test.ts` (03-03 T1–T3) |
| NIGHT-01 | 동료 현재 선택이 살아 있는 마피아 view(me.allyPicks)에만, 소켓 전송도 마피아(+관전자)에만 | unit + worker | `test/unit/view.test.ts` (03-05 T2), `test/worker/night.test.ts` (03-07 T2), `test/worker/leak.test.ts` (03-09 T2) |
| NIGHT-02 | 조사 결과 isMafia 가 그 경찰 investigations 에만, me.records 로 경찰 본인에게만, 결과는 밤 끝에 | unit + worker + client | `night.test.ts` (03-03 T3), `view.test.ts` (03-05 T2), `night.test.ts` worker (03-07 T1), `leak.test.ts` (03-09 T2), `test/client/records.test.tsx` (03-11) |
| NIGHT-03 | 의사 보호=지목이면 탈락 없음(`{}`), 자기 보호, 미선택 | unit + client | `night.test.ts` (03-03 T3), `test/client/nightScene.test.tsx` (03-08 T2) |
| NIGHT-04 | 역할별 밤 화면(마피아 채팅·동료 배지, 경찰·의사 알약, 시민 안내), 자신·동료 탭 불가, aria-pressed, 관전 화면 | client | `test/client/dayTable.test.tsx` (03-02), `nightScene.test.tsx` (03-08), `test/client/nightChat.test.tsx` (03-06) |
| NIGHT-05 | 밤은 30000ms 고정, pick 이 phaseEndsAt·알람을 바꾸지 않음, 마감 뒤 pick WRONG_PHASE | unit + worker + smoke | `test/unit/tick.test.ts` (03-01 T1), `test/worker/alarm.test.ts` (03-01 T2), `night.test.ts` unit (03-03 T2), `night.test.ts` worker (03-07 T2·T3), smoke (03-12 T1) |
| NIGHT-06 | 아침 5초, 모든 viewer 의 day.morning 동일, 문구 번호 1..8·연속 반복 없음, 무사 `{}`, 카드 문장 8개 '님이' | unit + client + smoke | `night.test.ts` (03-03 T3), `view.test.ts` (03-05 T2), `test/client/morning.test.tsx`·`test/unit/eliminationText.test.ts` (03-10), smoke (03-12 T1) |
| ELIM-01 | 거부 규칙 하나(틀린 단계 → WRONG_PHASE, 맞는 단계의 탈락자 → BAD_MESSAGE) — claim·say·emoji·pick | unit + worker | `test/unit/chat.test.ts`·`claim.test.ts` (03-04 T2), `night.test.ts` unit (03-03 T2), `night.test.ts` worker (03-07 T3) |
| ELIM-01 | 탈락자 = 유령 그림 + 관전: spectate 는 탈락자 view 에만·탈락한 아침부터, 살아 있는 소켓은 직업·밤 행동·마피아 채팅을 절대 받지 않음 | unit + worker + client + smoke + bot | `view.test.ts` (03-05 T3), `night.test.ts` worker (03-07 T3), `leak.test.ts` (03-09), `dayTable.test.tsx` (03-02 T2·T3), `nightScene.test.tsx` (03-08 T3), smoke·uat-night (03-12) |
| COMM-04(밤) | 밤: 생존 마피아만 밤 문구, 때가 다른 템플릿 BAD_MESSAGE, 생존 비마피아 WRONG_PHASE, 아침 WRONG_PHASE, chat/emoji 프레임이 비마피아 생존 소켓에 0개 | unit + worker | `chat.test.ts` (03-04 T1·T2), `night.test.ts` worker (03-07 T2), `leak.test.ts` (03-09 T2) |
| COMM-04(밤)·결정 0002 | 밤 채팅 줄 번호는 nextNightSeq(밤마다 1부터) — 낮 chat seq 는 밤 메시지 수와 무관하게 이어진다 | unit + worker + client | `chat.test.ts` (03-04 T3), `night.test.ts` worker (03-07 T2), `leak.test.ts` (03-09 T2), `seatFloats.test.tsx` (03-06 T1) |
| 공통 | 늦은 알람 따라잡기: discussion 에서 한 번에 다음 낮까지 가도 훅이 night → morning → dayAnnounce 로 한 번씩, 일차 +1 한 번 | unit | `tick.test.ts` (03-01 T1), `night.test.ts` (03-03 T3) |
| 공통 | 단계 순서·도착 편차·역할/동료/records/spectate 누출을 배포본에서 | smoke / bot UAT | `scripts/smoke.mjs` (03-12 T1), `scripts/uat-night.mjs` (03-12 T2) |

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | NIGHT-05, NIGHT-06 | T-03-01 | 마감 연쇄·따라잡기·두 번 호출 결과 동일 | unit | `npx vitest run test/unit/tick.test.ts` · `npm run typecheck` | ✅ 수정 | ⬜ pending |
| 03-01-02 | 01 | 1 | NIGHT-05, NIGHT-06 | T-03-02 | 방 DO 가 cryptoRandInt 를 넘김 | unit + worker | `npx vitest run test/unit/view.test.ts test/worker/alarm.test.ts test/worker/day.test.ts` · `npx vitest run && npm run typecheck` | ✅ 수정 | ⬜ pending |
| 03-01-03 | 01 | 1 | NIGHT-05, NIGHT-06 | T-03-03 | 모르는 단계 view 폴백 | client | `npx vitest run test/client/phaseScreens.test.tsx test/client/roomScreen.test.tsx test/client/dayScene.test.tsx` · `npx vitest run && npm run typecheck && npm run build` | ✅ 수정 | ⬜ pending |
| 03-02-01 | 02 | 1 | NIGHT-04 | T-03-05 | 닉네임은 React 텍스트·속성으로만 | client | `npx vitest run test/client/dayTable.test.tsx test/client/dayScene.test.tsx` · `npm run typecheck` | ✅ 수정 | ⬜ pending |
| 03-02-02 | 02 | 1 | ELIM-01 | T-03-04 | 실제 직업 줄은 넘길 때만, 역할 키 없는 입력 | client + unit | `npx vitest run test/client/dayTable.test.tsx test/client/dayScene.test.tsx test/client/lobby.test.tsx test/client/table.test.tsx test/unit/assets.test.ts` · `npm run typecheck` | ✅ 수정 | ⬜ pending |
| 03-02-03 | 02 | 1 | NIGHT-04, ELIM-01 | T-03-04 | 진홍·관전 배지는 넘길 때만 | client | `npx vitest run test/client/dayTable.test.tsx` · `npx vitest run && npm run typecheck && npm run build` | ✅ 수정 | ⬜ pending |
| 03-03-01 | 03 | 2 | NIGHT-01, NIGHT-06 | T-03-08 | 판정에 전역 난수·시각 없음 | unit | `npx vitest run test/unit/night.test.ts test/unit/tick.test.ts` · `npm run typecheck` | ❌ W0 night.test | ⬜ pending |
| 03-03-02 | 03 | 2 | ELIM-01, NIGHT-05 | T-03-06 / T-03-07 / T-03-34 | 시민·탈락자 행동 거부, 받는 사람에 살아 있는 비행위자 없음 | unit | `npx vitest run test/unit/night.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-03 | 03 | 2 | NIGHT-01, NIGHT-02, NIGHT-03 | T-03-07 / T-03-09 / T-03-10 | randInt(0) 없음, 아침 결과에 직업·구출 없음 | unit | `npx vitest run test/unit/night.test.ts test/unit/tick.test.ts test/unit/view.test.ts` · `npx vitest run && npm run typecheck` | ❌ W0 | ⬜ pending |
| 03-04-01 | 04 | 2 | COMM-04 | T-03-11 | 밤에는 생존 마피아만 통과 | unit + client | `npx vitest run test/unit/chat.test.ts test/unit/messageText.test.ts test/client/quickMessageSheet.test.tsx` · `npm run typecheck` | ✅ 수정 | ⬜ pending |
| 03-04-02 | 04 | 2 | ELIM-01, COMM-04 | T-03-11 / T-03-12 / T-03-13 | 거부 규칙 하나(단계 먼저), 거부는 상태 불변 | unit + worker | `npx vitest run test/unit/chat.test.ts test/unit/claim.test.ts test/worker/day.test.ts` · `npx vitest run && npm run typecheck` | ✅ 수정 | ⬜ pending |
| 03-04-03 | 04 | 2 | COMM-04 | T-03-40 | 밤 줄 번호가 낮 번호를 쓰지 않음 | unit | `npx vitest run test/unit/chat.test.ts` · `npx vitest run && npm run typecheck` | ✅ 수정 | ⬜ pending |
| 03-05-01 | 05 | 3 | NIGHT-04, ELIM-01 | T-03-17 | 본인 선택은 본인 view 에만, players 다섯 키 | unit + worker | `npx vitest run test/unit/view.test.ts test/unit/gameRoom.test.ts test/worker/http.test.ts test/worker/leak.test.ts` · `npm run typecheck` | ✅ 수정 | ⬜ pending |
| 03-05-02 | 05 | 3 | NIGHT-01, NIGHT-02, NIGHT-06 | T-03-14 / T-03-15 / T-03-16 | allyPicks·records 받을 사람만, 아홉 단계 전수 누출 | unit | `npx vitest run test/unit/view.test.ts test/unit/night.test.ts` · `npx vitest run && npm run typecheck` | ✅ 수정 | ⬜ pending |
| 03-05-03 | 05 | 3 | ELIM-01 | T-03-37 | spectate 는 탈락한 본인 view 에만 | unit | `npx vitest run test/unit/view.test.ts` · `npx vitest run && npm run typecheck` | ✅ 수정 | ⬜ pending |
| 03-06-01 | 06 | 3 | COMM-04, NIGHT-04 | T-03-19 | 낮·밤 줄 섞임 없음, 밤이 끝나면 비움 | client | `npx vitest run test/client/seatFloats.test.tsx test/client/nightChat.test.tsx test/client/discussion.test.tsx test/client/dayScene.test.tsx` · `npm run typecheck` | ❌ W0 nightChat | ⬜ pending |
| 03-06-02 | 06 | 3 | COMM-04 | T-03-18 | 문구 ID 만 보냄(자유 텍스트 없음) | client | `npx vitest run test/client/quickMessageSheet.test.tsx test/client/nightChat.test.tsx test/client/discussion.test.tsx` · `npm run typecheck` | ✅ 수정 | ⬜ pending |
| 03-06-03 | 06 | 3 | ELIM-01 | — | 관전 하단은 읽기 전용(보낼 수단 없음) | client | `npx vitest run test/client/nightChat.test.tsx test/client/discussion.test.tsx test/client/dayScene.test.tsx` · `npx vitest run && npm run typecheck && npm run build` | ✅ (T1 생성) | ⬜ pending |
| 03-07-01 | 07 | 4 | NIGHT-02, NIGHT-06 | T-03-20 / T-03-22 / T-03-24 | pick 뒤 state 는 행위자 쪽에만, strictObject | worker | `npx vitest run test/worker/night.test.ts` · `npm run typecheck` | ❌ W0 night.test(worker) | ⬜ pending |
| 03-07-02 | 07 | 4 | NIGHT-01, NIGHT-05, COMM-04 | T-03-20 / T-03-21 / T-03-40 | 밤 chat 은 마피아·관전자 소켓에만, 낮 번호 불변 | worker | `npx vitest run test/worker/night.test.ts test/worker/day.test.ts` · `npm run typecheck` | ✅ (T1 생성) | ⬜ pending |
| 03-07-03 | 07 | 4 | ELIM-01, NIGHT-05 | T-03-21 / T-03-23 | 관전자만 추가 수신, 탈락자 행동 거부, 마감 뒤 WRONG_PHASE | worker | `npx vitest run test/worker/night.test.ts` · `npx vitest run && npm run typecheck` | ✅ (T1 생성) | ⬜ pending |
| 03-08-01 | 08 | 4 | NIGHT-02, NIGHT-04 | T-03-27 | 서버 값이 낙관적 표시를 이긴다 | client | `npx vitest run test/client/nightScene.test.tsx test/client/dayScene.test.tsx test/client/discussion.test.tsx` · `npm run typecheck` | ❌ W0 nightScene | ⬜ pending |
| 03-08-02 | 08 | 4 | NIGHT-01, NIGHT-03 | T-03-26 / T-03-27 | 마피아·시민 하단에 역할 이름 없음 | client | `npx vitest run test/client/nightScene.test.tsx test/client/dayScene.test.tsx test/client/discussion.test.tsx` · `npm run typecheck` | ✅ (T1 생성) | ⬜ pending |
| 03-08-03 | 08 | 4 | ELIM-01 | T-03-26 | 관전 표시는 view.spectate 가 있을 때만 | client + unit | `npx vitest run test/client/nightScene.test.tsx test/unit/assets.test.ts test/client/dayScene.test.tsx test/client/phaseScreens.test.tsx` · `npx vitest run && npm run typecheck && npm run build` | ✅ 수정 | ⬜ pending |
| 03-09-01 | 09 | 5 | ELIM-01 | T-03-28 | 두 밤 전 프레임 기존 불변식 | worker | `npx vitest run test/worker/leak.test.ts` | ✅ 수정 | ⬜ pending |
| 03-09-02 | 09 | 5 | NIGHT-02, COMM-04, ELIM-01 | T-03-28 / T-03-40 | 살아 있는 소켓 spectate·밤 chat 0, 낮 seq 연속 | worker | `npx vitest run test/worker/leak.test.ts test/worker/night.test.ts` · `npx vitest run && npm run typecheck` | ✅ 수정 | ⬜ pending |
| 03-09-03 | 09 | 5 | NIGHT-04, ELIM-01 | T-03-29 | 계약 기록 | doc/grep | `test -f docs/decisions/0020-night-morning-contract.md && grep -c 'spectate' docs/decisions/0020-night-morning-contract.md && grep -c '결정 0021' .planning/ROADMAP.md` | ❌ (새 결정 파일) | ⬜ pending |
| 03-10-01 | 10 | 5 | NIGHT-06 | T-03-30 | 카드 입력은 seat·번호뿐 | client | `npx vitest run test/client/morning.test.tsx test/client/nightScene.test.tsx test/client/dayScene.test.tsx` · `npm run typecheck` | ❌ W0 morning | ⬜ pending |
| 03-10-02 | 10 | 5 | ELIM-01, NIGHT-06 | T-03-30 | 무사·구출 같은 문구 | client | `npx vitest run test/client/timer.test.tsx test/client/morning.test.tsx test/client/nightScene.test.tsx test/client/phaseScreens.test.tsx` · `npm run typecheck` | ✅ 수정 | ⬜ pending |
| 03-10-03 | 10 | 5 | NIGHT-06 | T-03-31 | 범위 밖 번호 폴백 | unit + client | `npx vitest run test/unit/eliminationText.test.ts test/client/phaseScreens.test.tsx test/client/roomScreen.test.tsx` · `npx vitest run && npm run typecheck && npm run build` | ❌ W0 eliminationText | ⬜ pending |
| 03-11-01 | 11 | 6 | NIGHT-02 | T-03-32 | 본 개수만 저장, 경찰 화면에만 버튼 | client | `npx vitest run test/client/records.test.tsx test/client/phaseScreens.test.tsx test/client/roomScreen.test.tsx` · `npm run typecheck` | ❌ W0 records | ⬜ pending |
| 03-11-02 | 11 | 6 | NIGHT-02 | T-03-33 | 위조된 본 개수는 0 | unit + client | `npx vitest run test/client/records.test.tsx test/unit/recordsSeen.test.ts test/client/morning.test.tsx test/client/nightScene.test.tsx test/client/phaseScreens.test.tsx` · `npx vitest run && npm run typecheck && npm run build` | ❌ W0 recordsSeen | ⬜ pending |
| 03-12-01 | 12 | 7 | NIGHT-01·02·04·05·06, ELIM-01 | T-03-36 / T-03-39 | 개인 계정 배포, 배포본 밤·관전 경계 | smoke(prod) | `node --check scripts/smoke.mjs && node scripts/smoke.mjs --prod --stage full --players 5` · `node scripts/smoke.mjs --prod --stage full --players 8` · `node scripts/smoke.mjs --prod --stage full --players 4` | ✅ 수정 | ⬜ pending |
| 03-12-02 | 12 | 7 | NIGHT-01·02·03·05·06, ELIM-01, COMM-04 | T-03-38 / T-03-39 | 토큰 출력 없음, 관전 데이터 탈락자만 | bot UAT(prod) | `node --check scripts/uat-night.mjs && node --check scripts/bots.mjs && node --check scripts/uat-day.mjs && node scripts/uat-night.mjs --prod` · `node scripts/uat-night.mjs --prod --players 8` · `node scripts/uat-day.mjs --prod --players 5` | ❌ (새 uat-night) | ⬜ pending |
| 03-12-03 | 12 | 7 | 전부 | — | HANDOFF 규칙 줄이 결정 0021 과 같음 | doc/grep | `grep -c '3페이즈(밤과 아침) 실행 완료' HANDOFF.md && grep -c '살아 있는 사람에게는 보내지 않는다' HANDOFF.md && grep -c '탈락자 관전' HANDOFF.md && case "$(git log -1 --format=%s)" in 'docs(03-12)'*) true ;; *) false ;; esac` | ✅ 수정 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

각 파일은 그 계획의 첫 태스크(RED 커밋)가 만든다. 별도 설치·공용 도우미 준비는 없다.

- [ ] `test/unit/night.test.ts` — pickTarget 검사 순서 전 경로, 판정 규칙표 전 행, 난수 호출 횟수·순서, 문구 번호 속성 테스트 (03-03 T1)
- [ ] `test/worker/night.test.ts` — workerd 실제 소켓: 행동 전송 범위, 마피아·관전 채팅 범위, 낮 번호 불변, 마감 뒤·탈락자 거부 (03-07 T1)
- [ ] `test/client/nightChat.test.tsx` — 안내 줄·로그 이름·^ 끄기·밤 문구 시트·읽기 전용 줄 (03-06 T1)
- [ ] `test/client/nightScene.test.tsx` — 역할별 밤 하단·직접 탭·낙관적 선택·관전 화면 (03-08 T1)
- [ ] `test/client/morning.test.tsx`, `test/unit/eliminationText.test.ts` — 아침 카드·문구 표 (03-10 T1·T3)
- [ ] `test/client/records.test.tsx`, `test/unit/recordsSeen.test.ts` — 수사 기록 버튼·시트·알림·본 개수 (03-11 T1·T2)
- [ ] 기존 테스트 계약 갱신(RED 또는 회귀 이전): `tick.test.ts`·`view.test.ts`·`alarm.test.ts`·`day.test.ts`(03-01), `gameRoom.test.ts`·`http.test.ts`·`leak.test.ts` 다섯 키(03-05), `chat.test.ts`·`claim.test.ts`·`messageText.test.ts`(03-04), `seatFloats.test.tsx`·`quickMessageSheet.test.tsx`(03-06), `dayTable.test.tsx`(03-02), `timer.test.tsx`·`phaseScreens.test.tsx`(03-01·03-10), `assets.test.ts`(03-08)

---

## Manual-Only Verifications

실기기 확인은 03-12 Task 3 의 human-check 와 HANDOFF 실기기 목록으로 모은다(두 기종 정식 확인은 6페이즈 — CONTEXT Deferred). 자동 검사가 배치 수치와 데이터 경계를 지키고, 아래는 글꼴 렌더링·주소창 높이·터치·느낌처럼 사람만 볼 수 있는 것이다.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 경찰·의사·시민 하단 안내 2줄 + 알약이 360폰에서 157 안에 든다 | NIGHT-04 | 실제 글꼴 줄바꿈은 happy-dom 이 재지 못한다 | 360px 폭 폰으로 밤을 맞아 세 역할 하단을 본다(봇으로 인원 채움 `node scripts/bots.mjs <코드> --prod --count 3`) |
| 8명판 앞쪽 캐릭터 누르기·선택 링·배지(최대 세 종류)·이름표 겹침 | NIGHT-04, NIGHT-01 | 터치 정확도·겹침 체감 | 8명 방(봇 7)에서 경찰·마피아로 밤에 여러 자리를 눌러 본다 |
| 마피아 두 폰의 실시간 동료 선택 배지·밤 채팅, 시민 폰에는 흔적 없음 | NIGHT-01, COMM-04 | 여러 기기의 동시 체감 | 6명 이상 방에서 마피아 두 폰과 시민 폰을 나란히 본다 |
| 아침 카드(닉네임 5자 + 님이, 3줄)가 뒷자리 이름표를 가리는 정도 | NIGHT-06 | 시안 승인 범위 판단 | 닉네임 5자 탈락자가 나오는 아침을 360×640 에서 본다 |
| 탈락한 폰의 관전 화면(유령·실제 직업 점선 줄·역할별 배지·읽기 전용 줄), 살아 있는 폰에는 유령 + '탈락' 뿐 | ELIM-01 | 화면 전환 느낌·밀도 | 한 폰이 탈락할 때까지 남겨 다음 밤·낮을 본다 |
| 경찰 위쪽 바 [수사 기록] + [내 역할] 한 줄, 점·알림·NEW | NIGHT-02 | 360폰 버튼 두 개 폭 | 경찰 폰으로 밤을 두 번 넘기며 본다 |
| gray-500 글자(마피아 채팅 안내 줄·관전 안내 줄·탈락 이름표) 가독성 | NIGHT-04, ELIM-01 | 시안 승인 대비 예외(4.5:1 미만) | 밝은 실내·야외에서 읽어 본다 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s (로컬)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
