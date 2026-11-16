---
phase: 23-keyword-day-one
verified: 2026-11-17T05:30:00Z
status: human_needed
score: 8/8 must-haves verified
covered_files:
  - ".planning/phases/23-keyword-day-one/23-01-PLAN.md"
  - ".planning/phases/23-keyword-day-one/23-01-SUMMARY.md"
  - ".planning/phases/23-keyword-day-one/23-02-PLAN.md"
  - ".planning/phases/23-keyword-day-one/23-02-SUMMARY.md"
  - ".planning/phases/23-keyword-day-one/23-03-PLAN.md"
  - ".planning/phases/23-keyword-day-one/23-03-SUMMARY.md"
  - ".planning/phases/23-keyword-day-one/23-04-PLAN.md"
  - ".planning/phases/23-keyword-day-one/23-04-SUMMARY.md"
  - ".planning/phases/23-keyword-day-one/23-05-PLAN.md"
  - ".planning/phases/23-keyword-day-one/23-05-SUMMARY.md"
  - ".planning/phases/23-keyword-day-one/23-06-PLAN.md"
  - ".planning/phases/23-keyword-day-one/23-06-SUMMARY.md"
  - ".planning/phases/23-keyword-day-one/23-07-PLAN.md"
  - ".planning/phases/23-keyword-day-one/23-07-SUMMARY.md"
  - ".planning/phases/23-keyword-day-one/23-08-PLAN.md"
  - ".planning/phases/23-keyword-day-one/23-08-SUMMARY.md"
  - ".planning/phases/23-keyword-day-one/23-09-PLAN.md"
  - ".planning/phases/23-keyword-day-one/23-09-SUMMARY.md"
  - ".planning/phases/23-keyword-day-one/23-10-PLAN.md"
  - ".planning/phases/23-keyword-day-one/23-10-SUMMARY.md"
  - ".planning/phases/23-keyword-day-one/23-11-PLAN.md"
  - ".planning/phases/23-keyword-day-one/23-11-SUMMARY.md"
  - ".planning/phases/23-keyword-day-one/23-12-PLAN.md"
  - ".planning/phases/23-keyword-day-one/23-12-SUMMARY.md"
  - ".planning/phases/23-keyword-day-one/23-13-PLAN.md"
  - ".planning/phases/23-keyword-day-one/23-13-SUMMARY.md"
  - "migrations/0001_games.sql"
  - "package.json"
  - "scripts/check-deploy-target.mjs"
  - "scripts/deploy-target.mjs"
  - "scripts/e2e/browser.mjs"
  - "scripts/e2e/flows.mjs"
  - "scripts/e2e/host.mjs"
  - "scripts/e2e/keyword.mjs"
  - "scripts/e2e/lib.mjs"
  - "scripts/e2e/polish.mjs"
  - "scripts/e2e/politics.mjs"
  - "scripts/e2e/sound.mjs"
  - "scripts/games.mjs"
  - "scripts/smoke.mjs"
  - "scripts/uat-test-room.mjs"
  - "shared/game/answerRules.ts"
  - "shared/game/audience.ts"
  - "shared/game/discussion.ts"
  - "shared/game/early.ts"
  - "shared/game/endgame.ts"
  - "shared/game/execution.ts"
  - "shared/game/gameLog.ts"
  - "shared/game/keywordAnswer.ts"
  - "shared/game/keywordGuard.ts"
  - "shared/game/keywords.ts"
  - "shared/game/movement.ts"
  - "shared/game/nomination.ts"
  - "shared/game/phases.ts"
  - "shared/game/rematch.ts"
  - "shared/game/room.ts"
  - "shared/game/runoff.ts"
  - "shared/game/showdown.ts"
  - "shared/game/tick.ts"
  - "shared/game/verdict.ts"
  - "shared/game/view.ts"
  - "shared/protocol.ts"
  - "shared/schemas.ts"
  - "src/audio/director.ts"
  - "src/components/ResultAnnounce.tsx"
  - "src/components/RoleCardSheet.tsx"
  - "src/components/TestTools.tsx"
  - "src/components/v2/HostBand.tsx"
  - "src/components/v2/PhaseHeader.tsx"
  - "src/game/dayView.ts"
  - "src/game/hostLine.ts"
  - "src/game/keywordView.ts"
  - "src/game/scenes.ts"
  - "src/net/earlyCalm.ts"
  - "src/net/useDayFx.ts"
  - "src/net/useKeywordAnswer.ts"
  - "src/screens/GameMap.tsx"
  - "src/screens/GamePanel.tsx"
  - "src/screens/Keyword.tsx"
  - "src/screens/RoomScreen.tsx"
  - "src/styles/game.css"
  - "src/styles/phase.css"
  - "src/styles/rolecard.css"
  - "src/world/presence.ts"
  - "test/client/useKeywordAnswer.test.tsx"
  - "test/helpers/keyword.ts"
  - "test/helpers/voteState.ts"
  - "test/unit/early.test.ts"
  - "test/unit/gameLog.test.ts"
  - "test/unit/keywordAnswer.test.ts"
  - "test/unit/keywordFlow.test.ts"
  - "test/unit/keywordGuard.test.ts"
  - "test/unit/keywordStaticGuard.test.ts"
  - "test/unit/keywords.test.ts"
  - "test/unit/view.test.ts"
  - "test/worker/d1.test.ts"
  - "test/worker/earlyAdvance.test.ts"
  - "test/worker/gameLog.test.ts"
  - "test/worker/keyword.test.ts"
  - "test/worker/keywordLeak.test.ts"
  - "test/worker/leak.test.ts"
  - "test/worker/nightLeak.test.ts"
  - "worker/gameLog.ts"
  - "worker/room.ts"
  - "wrangler.jsonc"
covered_digest: "v4:sha256:3da82d149ba1e4c452755cb4e79f73b16c643cd7357b672714de5e0654f0036b"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 8/8
  gaps_closed: []
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "실기기(폰)에서 첫날 한 판: 역할 확인 → 키워드 카드(장르·큰 키워드·각주) → 3초 잠금 뒤 10초 입력 → 모두의 답 공개 → 토론 → 처형 → 정답 공개 → 밤"
    expected: "시민 폰에는 키워드가 크게, 마피아 폰에는 ??? 가 보인다. 읽는 3초 동안 입력칸이 잠기고 풀리면 빛난다. 금지어를 보내면 같은 알림이 시민·마피아에게 똑같이 뜬다(마감 직후 도착한 확정 등 금지어 아닌 오류는 알림 없이 넘어간다, WR-02). 전원이 내면 1.5초 뒤 넘어가고, 토론 시작에 모두의 답 시트가 자동으로 열린다"
    why_human: "카드 연출·터치 감각·한글 입력(IME) 조합·실제 지연은 자동 검사로 볼 수 없다. 로컬 E2E(23-12)는 통과 보고이며 이 검증에서 다시 돌리지 않았다. 폰 6종 전체 회귀·실기기·배포본은 0089-25 에 따라 24 끝으로 미뤄졌다"
  - test: "키워드 목록 초안(shared/game/keywords.ts, 7장르 306개) 검토"
    expected: "사용자가 장르·키워드·별칭을 훑어 고치거나 그대로 승인한다(3글자 초성 우연 겹침 고양이↔가을이 등 알려진 한계 0091-19 포함)"
    why_human: "결정 0089-23 이 사용자 검토를 남겨 둔 항목이다. 내용의 적절함은 코드로 판정할 수 없다"
  - test: "높이 664 이하 폰에서 키보드를 연 채 키워드 카드를 본다(알려진 한계 0091-22)"
    expected: "컴팩트 카드가 띠·소리 단추를 일부 덮지만 남은 시간(메타 줄 n초)은 보인다. 진행에 지장이 없으면 그대로 둔다(과몰입 경계)"
    why_human: "키보드 높이는 실기기에서만 정해진다. UI-SPEC 미해결 항목이라 사용자 판단이 필요하다"
  - test: "토론 시작에 자동으로 열린 모두의 답 시트가 토론 입력을 가리는지 확인하고 자동 닫힘을 둘지 결정(0091-22)"
    expected: "사용자가 유지 또는 변경(자동 닫힘 추가)을 결정한다"
    why_human: "현재는 닫을 때까지 열려 있다. 취향·플레이 감각 결정이다"
  - test: "첫날 처형 없음 → 정답 4.4초(처형 없음 큰 글 1.4초 + 정답 3초)와 밤·키워드 단계를 연장 없이 한 번만 줄이는 정책(RESEARCH A5·A6, 0091-24) 확인"
    expected: "사용자가 원하는 모양이면 그대로 둔다"
    why_human: "결정 0091 이 사용자 확인 거리로 남긴 항목이다"
  - test: "개인 계정 확인 뒤 D1 생성·database_id 기입·원격 마이그레이션·배포(24 첫 단계, 0091-18) 이후 실제 판 한 줄이 남는지 `npm run games -- --remote` 로 확인"
    expected: "판이 끝나면 games 표에 한 줄이 생기고 닉네임·채팅·답 글 열은 없다. 이제 삽입이 afterTransition 끝에서 await 되므로(WR-04) 판 종료 알람·전환이 D1 지연만큼 늦어지지 않는지, 실패 시 `game log failed` 한 줄만 남는지도 이때 확인한다. `--local` 이 vite dev 의 로컬 D1 폴더를 보는지(A1)도 확인한다"
    why_human: "실제 D1 생성은 외부 서비스 변경이라 23 에서 하지 않았다(D-19, 의도). 워커 시험은 메모리 D1 로만 검증했다"
---

# Phase 23: 첫날 키워드 문제와 D1 판 기록 검증 보고서

**Phase Goal:** 첫날에만 장르+키워드 문제를 낸다. 마피아는 장르만 알고, 키워드와 우회 표기는 누구도 쓸 수 없으며(마피아는 막히는지로 떠볼 수 있다), 모두 내면 한꺼번에 공개된다. 판마다 결과와 사용 숫자를 D1 에 한 줄 남긴다(결정 0089-1~9·16·21·22·23).
**Verified:** 2026-11-17
**Status:** human_needed (자동 검증 가능한 항목은 모두 통과 — 남은 것은 실기기·목록 검토·사용자 결정·24 의 실제 D1 생성뿐)
**Re-verification:** Yes — 코드 리뷰 수정(WR-01~04, 커밋 39a5e396·c0aa9574·78854e20·184340f1 + 문서 d43efa47·26c3b46e) 뒤 재검증. 이전 보고서(8003b09e 시점)의 digest 가 낡아 새로 만들었다. 이전 보고서에 gap 은 없었으므로 `gaps_closed`·`gaps_remaining`·`regressions` 모두 비어 있다.

SUMMARY·REVIEW-FIX 의 주장은 근거로 쓰지 않았다. 아래 증거는 현재 코드를 직접 읽고 시험·번들·스크립트를 다시 돌린 결과다.

## 이번 재검증이 본 변경 (8003b09e → HEAD, 구현 파일 6개)

`git diff 8003b09e HEAD --stat -- shared worker src migrations wrangler.jsonc scripts` 는 `keywordGuard.ts`·`keywords.ts`(머리말)·`rematch.ts`·`room.ts`·`useKeywordAnswer.ts`·`worker/room.ts` 6개뿐이다. `early.ts`·`tick.ts`·`keywordAnswer.ts`·`view.ts`·`gameLog.ts`·`worker/gameLog.ts`·`migrations/`·`wrangler.jsonc` 는 같은 diff 에서 변경 0 이다(조기 진행·판정·행 만들기·마이그레이션은 손대지 않음).

| 수정 | 직접 확인한 코드 | 판정 |
| ---- | ---------------- | ---- |
| WR-01 자모 골격 | `keywordGuard.ts` `jamoSkeleton`: 음절을 초성·중성·종성으로 풀고 종성→같은 자음 초성, 겹받침·겹모음을 낱 자모로 접는다. `violatesKeyword` 는 (1) 정규형 부분 포함 (2) 자모 골격 부분 포함(길이 2 이상 문턱) (3) 3글자↑ 완성형의 초성열 포함, 세 검사를 모두 유지. 정규식은 문자 범주 치환(선형) 그대로이고 골격은 단일 순회다 | ✓ 확장일 뿐 기존 판정은 줄지 않음. 단위 시험 통과 |
| WR-02 거절 판별 | `useKeywordAnswer.ts:189` `if (e.t !== "error" \|\| e.code !== "BAD_MESSAGE") return;` — 서버가 금지어 거절을 `BAD_MESSAGE` 한 코드로만 보내므로(SC3) WRONG_PHASE·RATE_LIMITED 는 알림·deny 소리·되돌림 없이 무시 | ✓ 시민·마피아 거절이 같은 모양이라는 불변식(T-23-32)은 그대로. 클라이언트 쪽 필터일 뿐 서버 프레임은 불변 |
| WR-03 import 분리 | `shared/game/room.ts` 에서 `keywords` import 제거(`KeywordPicker` 타입 신설). `beginGame`·`startGame`·`rematch` 가 마지막 선택 인자 `pickKeyword?` 를 받아 `pickKeyword !== undefined ? pickKeyword(randInt) : undefined`. 호출처는 전부 확인했다: `worker/room.ts:499`(startGame)·`:655`(rematch) 두 곳뿐이며 둘 다 `keywordPickerNow()`(= `KEYWORD_SWITCH.on ? pickKeyword : undefined`)를 넘긴다. `shared`·`src`·`worker` 안에서 `keywords` 를 import 하는 곳은 `keywordAnswer.ts`·`view.ts`(`genreLabelOf`)·`worker/room.ts` 뿐이고 전부 서버 쪽이다 | ✓ 난수 순서(역할 → 맵 → 키워드 두 번)와 스위치 꺼짐 시 keyword 삭제 의미 동일. 정적 전이 가드가 이를 시험으로 고정 |
| WR-04 판 기록 await | `worker/room.ts afterTransition`: `gameRowFor(prev)`(동기, 전환 직후 상태로 행 생성; `prev.phase!=="ended" && room.phase==="ended"` 와 `env.DB` 가 있을 때만 non-null) → `await this.reschedule()` → `await this.recordGame(row)`(try/catch 로 실패를 `console.error("game log failed")` 한 줄로 삼키고 던지지 않음). `ctx.waitUntil` 은 더 이상 쓰지 않는다 | ✓ 한 판당 한 번(ended 진입 전환의 afterTransition 에서만 non-null), 실패 격리, 알람 재설정이 삽입보다 먼저라 D1 지연이 알람을 막지 않음. 아래 "남는 주의" 참조 |

**남는 주의 (WR-04):** `afterTransition` 이 D1 삽입을 await 하므로 ended 전환을 일으킨 호출(알람 `advance`·테스트 넘기기·토론 끝내기 등)은 D1 응답만큼 늦게 끝난다. 상태 저장·방송·알람 재설정·결과 프레임은 이미 끝난 뒤라 플레이에는 영향이 없고, 삽입이 던지면 삼킨다(시험 고정). 실제 원격 D1 지연은 메모리 D1 로는 볼 수 없어 24 의 원격 확인 항목에 더했다.

## 실행 결과 (실제 출력)

| 명령 | 결과 |
| ---- | ---- |
| `npm run typecheck` | 종료 0 (`tokens:check`, `wrangler types`, `tsc app`, `tsc worker` 통과) |
| `npx vitest run test/unit/keywordGuard.test.ts test/unit/keywordStaticGuard.test.ts test/unit/keywords.test.ts test/unit/keywordAnswer.test.ts test/unit/keywordFlow.test.ts test/unit/early.test.ts test/unit/gameLog.test.ts test/worker/keywordLeak.test.ts test/worker/leak.test.ts test/worker/nightLeak.test.ts test/worker/d1.test.ts test/worker/gameLog.test.ts test/worker/keyword.test.ts test/worker/earlyAdvance.test.ts test/client/keywordScreen.test.tsx test/client/useKeywordAnswer.test.tsx test/client/answerReveal.test.tsx test/client/roleCardSheet.test.tsx` | `Test Files 18 passed (18)` · `Tests 342 passed \| 2 skipped (344)` · 종료 0 (skipped 둘은 옛 정치 장치 `describe.skipIf(!GAME_RULES.*)` 로 이 페이즈와 무관 — 이전 검증과 같다) |
| `npx vite build --outDir <scratch>` 후 번들 grep | 종료 0. 표본(해리포터·Harry Potter·Train to Busan·토이스토리·Toy Story·겨울왕국·Frozen·라이언킹·Lion King·부산행·Parasite·기생충·keywordProbed·pickKeyword·GENRES·violatesKeyword)이 `dist/client` 에 전부 0건, `dist/worker/*.js` 에는 전부 있음. WR-03 뒤에도 클라이언트 번들에 키워드 목록이 들어가지 않는다 |
| 키워드 목록 직접 집계(모듈을 불러와 센 값) | 7장르 영화 33·음식 45·동물 45·장소 47·스포츠 42·물건 51·나라 43 = 306, 최대 8자소, 한 글자 0, 별칭 없는 항목 0 (문서의 306개와 일치 — 이전 보고서가 짚은 "310개" 오기는 d43efa47 로 고쳐졌다) |
| `node ~/.claude-personal/gsd-core/bin/gsd-tools.cjs query verification.status` (재검증 전) | `stale` — 구현 파일 8개 이동. 이 보고서가 digest 를 새로 만들어 해소한다 |

이전 보고서가 돌린 나머지(`node --test scripts/games.test.mjs …`, `check-deploy-target`, 위생 grep, 부채 표식 grep)는 이번 변경이 `scripts/`·`wrangler.jsonc`·`migrations/` 를 건드리지 않아 다시 돌리지 않았다. 전체 시험(`npm test`)·브라우저 E2E 도 이번에 다시 돌리지 않았다(리뷰 수정 보고서는 client·unit 206 파일 통과, worker 재실행 통과, scripts 654 통과를 보고했으나 이 검증이 직접 재현한 것은 위 표의 범위다).

## Goal Achievement

### Observable Truths (ROADMAP 성공 기준 SC1~SC8)

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| SC1 | 첫날 역할 확인 뒤 키워드 카드(장르 위·큰 키워드·마피아 `???`·각주), 서버는 마피아에게 키워드를 보내지 않는다 | ✓ VERIFIED | `phases.ts`: `roleReveal.next="keyword"`, `keyword` 13초(`KEYWORD_READ_MS` 3s + `KEYWORD_WRITE_MS` 10s), `keyword.next="dayAnnounce"`. `Keyword.tsx` 가 `장르 : {genre}`·`me.keyword` 있으면 큰 글/없으면 `???`·각주를 그린다. `view.ts` 는 keyword 단계의 산 비마피아 본인에게만 `myInfo.keyword` 키를 만든다(마피아는 키 자체가 없음). WR-03 뒤 키워드는 `beginGame` 이 호출자가 넘긴 `pickKeyword` 로 고른 값이 `RoomState.keyword` 에 들어가는 경로 그대로이고(서버 DO 가 선택 함수를 넘김) 뷰 빌더는 변경 없음. `keywordLeak.test.ts`(재실행 통과): 키워드·영어 별칭·"해포" 가 정답 공개 전 모든 마피아 프레임과 keyword·verdict 단계 preview 에 0건, 시민 프레임에는 있음(검사가 살아 있음) |
| SC2 | 금지어 판정: NFKC·기호·공백·대소문자·별칭·3글자 이상 초성, 철자 틀림은 통과 | ✓ VERIFIED | `keywordGuard.ts` 현재 코드를 읽었다: 정규형 부분 포함 + 자모 골격 부분 포함(WR-01) + 3글자↑ 완성형 초성열 포함. `keywordGuard.test.ts`(재실행 통과)가 `해.리.포.터`·`Harry_Potter`·전각·`ㅎㄹㅍㅌ`·NFD·호환 자모, 그리고 새로 `ㅁㅕㅇㄹㅑㅇ`(명량)·`ㅂㅜㅅㅏㄴㅎㅐㅇ`(부산행)·혼합 `해리ㅍㅗㅌㅓ`·겹받침/겹모음 풀어쓰기는 막힘, `hery foter`·`a해b리c포d터`·멍랑·명령·부산상·무관한 문장·짧은 초성은 통과, 2글자 키워드·영어 키워드는 초성 검사 없음을 고정. 자모 골격은 같은 글자의 다른 인코딩을 같은 열로 만들 뿐이라 과차단은 부분 포함 문턱(길이 2↑)이 같아 기존 범위를 넘지 않는다 |
| SC3 | 답: 10초·20자소, 초안/확정, 시민·마피아 같은 거절, 공개 순서, 봇은 답 없음 | ✓ VERIFIED | `answerRules.ts` `ANSWER_MAX_GRAPHEMES=20`·`ANSWER_MIN_GAP_MS=400`. `submitAnswer`(변경 없음) 검사 순서와 마감 정렬 유지. 거절은 시민·마피아 모두 `{ok:false, BAD_MESSAGE}` 로 같은 두 프레임을 내고 마피아일 때만 서버 전용 `keywordProbed` 를 켠다(`keywordLeak ⑤` 통과). WR-02 로 클라이언트가 `BAD_MESSAGE` 만 금지어 거절로 취급 — `useKeywordAnswer.test.tsx`(통과)가 WRONG_PHASE·RATE_LIMITED 에서 notice null·state sent·신호 없음, 이어진 BAD_MESSAGE 는 거절로 처리(deny 1건)를 고정 |
| SC4 | 첫날 처형/처형 없음 뒤 밤 직전 `answerReveal`(없으면 4.4초), 기록 카드에 첫날 답, 둘째 날부터 키워드 없음 | ✓ VERIFIED | 이번 변경이 건드리지 않은 `endgame.ts`·`verdict.ts`·`nomination.ts`·`runoff.ts`·`showdown.ts`·`tick.ts`·`keywordAnswer.ts` 의 분기(`routeAfterExecution`·`afterDayOf`·`firstDayAnswerPending`·`phaseDurationOf`·`answerOpenOf`). `keyword.test.ts` 가 첫날 부결 → `phaseDurationMs 4400`·모든 소켓 `day.keyword.answer` 동일, 둘째 날 부결은 곧장 night 임을, `keywordFlow.test.ts` 가 day 1 마피아 전멸 → ended 를 고정(둘 다 재실행 통과). `keywordFlow`·`gameLog`·`view` 시험은 `keywordPickerNow()` 도우미로 `beginGame` 에 선택 함수를 넘기도록 바뀌었고, 둘째 날 키워드 없음·스위치 꺼짐 시 keyword 삭제(`rematch` 가 옛 값을 끌고 오지 않음) 의미는 시험으로 유지 |
| SC5 | 키워드 파일: 6~8장르 × 30↑, 별칭, 한 글자 없음, ≤12자소, 검토 대기 주석 | ✓ VERIFIED | 위 직접 집계(7장르 각 33 이상, 306개, 최대 8자소, 한 글자 0, 별칭 없는 항목 0). `keywords.ts` 변경은 머리말 주석 2줄뿐(목록 불변). `keywords.test.ts` 불변식 통과 |
| SC6 | D1: database_id 없는 바인딩, 0001 열, ended 에서 한 번·실패 격리, 닉네임·채팅·답 비저장, `npm run games`, 배포 가드, 실제 D1 미생성 | ✓ VERIFIED | `wrangler.jsonc`·`migrations/0001_games.sql`·`worker/gameLog.ts`·`shared/game/gameLog.ts`·`scripts/games.mjs` 는 이번에 변경 0. 바뀐 `worker/room.ts` 의 기록 경로를 직접 읽었다: 행은 `gameRowFor` 가 ended 진입 전환(`prev.phase!=="ended" && room.phase==="ended"`)에서만 만들고, `recordGame` 은 try/catch 로 던지지 않는다. `afterTransition` 은 알람 재설정 뒤에 한 번 await. `test/worker/gameLog.test.ts`(재실행 통과)가 성공 한 줄·마피아 거절 `probe_success 1`·같은 행 두 번 삽입 시 한 줄·**삽입 실패 시 결과 화면 수신·다시 하기 성공·저장된 방이 ended 임·로그 `game log failed` 한 줄**·스위치 끈 판은 행 없음·다시 하기 새 gameId 를 고정. `d1.test.ts` 통과(열 집합·CHECK·`INSERT OR IGNORE`). `ctx.waitUntil` 약속 대신 await 라 A3(DO 내려간 뒤 삽입이 끝까지 가는지) 위험은 사라졌다. 실제 `wrangler d1 create` 호출·id 기입 흔적 없음(이번 변경이 `wrangler.jsonc` 를 건드리지 않음) |
| SC7 | 키워드가 마피아에게 어떤 응답 모양으로도 새지 않는다(누설 검사) | ✓ VERIFIED | `keywordLeak.test.ts` ①~⑥·`leak.test.ts`·`nightLeak.test.ts`(WR-03 뒤 재실행 전부 통과). 새 위험면을 따로 확인했다: ① 선택 함수는 서버 DO 만 `import` 하고 클라이언트 번들에 목록·`pickKeyword`·`violatesKeyword`·`keywordProbed` 가 0건(위 vite build + grep), ② `view.ts`·`keywordAnswer.ts` 는 변경 0 이라 마피아에게 키워드·별칭이 실리는 경로가 늘지 않았다, ③ WR-02 는 클라이언트 쪽 필터라 서버 프레임이 바뀌지 않는다. `keywordStaticGuard.test.ts` 가 `src/` 에서 값 import 로 닿는 전이 그래프에 `keywords`·`keywordGuard`·`keywordAnswer` 가 없음을 검사(가드 자기 검사 포함)하며 `shared/game/room.ts → keywords.ts` 였던 이전 경로가 사라졌음을 확인한다. 한계(이전과 같음): 시험 setup 이 `KEYWORD_SWITCH` 를 꺼 두어 `leak.test.ts` 전수 한 판에는 키워드 프레임이 나오지 않고, 켠 판은 `keywordLeak` 가 정답 공개 직전까지 마피아 전 프레임을 단언한다. 정답 공개 이후 프레임은 모두에게 같은 공개 값이다 |
| SC8 | 일찍 넘어가기: 키워드(사람만), 찬반(1.5초·번복 연장 상한), 밤(한 번 줄임·연장 없음), 넘기기 단추 없음, 밤 누설 메타모픽 | ✓ VERIFIED | `early.ts`·`tick.ts` 변경 0(`maybeAdvanceEarly` 도 변경 diff 밖). `early.test.ts`·`earlyAdvance.test.ts`(방 DO: 끊긴 사람 있으면 마감 유지·알람 이동·연장 없음)·`nightLeak.test.ts`(밤 종료 시각·프레임 열 메타모픽) 재실행 통과. WR-04 로 `afterTransition` 의 끝이 `reschedule()` → `recordGame` 이 되었으나 알람 재설정은 삽입 앞에 그대로 있다 |

**Score:** 8/8 truths verified (0 present-behavior-unverified)

### 결정 0051 (글 최소) 점검

이번 변경 중 화면에 닿는 것은 WR-02 의 오류 코드 필터뿐이라 화면 글·구조 변화가 없다. 카드 글은 장르 한 줄·키워드·각주 한 줄이고, 입력줄은 숫자·짧은 글만 둔다. 위반 없음.

### Phase 22 불변식

`leak.test.ts` 통과 — 판 종류 하나(`mode` 는 옛 방 정규화 키로만), 투표 기록은 서버 전용(`voteLog` 가 어느 단계 view 에도 없음). 이번 변경은 공개 경로를 더하지 않았다(`view.ts` 변경 0).

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `shared/game/keywords.ts` | 장르·키워드·별칭 목록 + `pickKeyword` + `KEYWORD_SWITCH` | ✓ VERIFIED | 306개, 서버 전용(번들 grep 0건) |
| `shared/game/keywordGuard.ts` | 금지어 판정 | ✓ VERIFIED | 자모 골격 추가(WR-01), 단위 시험 통과 |
| `shared/game/keywordAnswer.ts` | 답 접수·마감·정답 개방 규칙 | ✓ VERIFIED | 변경 0 |
| `shared/game/room.ts`·`rematch.ts` | `KeywordPicker` 인자 + 키워드 import 제거 | ✓ VERIFIED | 호출처 두 곳이 모두 선택 함수를 넘김 |
| `shared/game/early.ts` | 조기 진행 순수 규칙 | ✓ VERIFIED | 변경 0 |
| `shared/game/gameLog.ts` + `worker/gameLog.ts` | 행 만들기·삽입 | ✓ VERIFIED | 변경 0, `afterTransition` 에서 await |
| `migrations/0001_games.sql` | 16열 + 색인 | ✓ VERIFIED | 변경 0 |
| `wrangler.jsonc` | D1 바인딩(id 없음) | ✓ VERIFIED | 변경 0, 배포 가드가 막음 |
| `scripts/games.mjs` | 조회 스크립트 + 인자 가드 | ✓ VERIFIED | 변경 0 |
| `src/screens/Keyword.tsx` · `src/net/useKeywordAnswer.ts` | 카드·입력줄·훅 | ✓ VERIFIED | WR-02 필터 반영, 클라이언트 시험 통과 |
| `src/components/RoleCardSheet.tsx` | 첫날 답 탭 | ✓ VERIFIED | 변경 0, 시험 통과 |
| `test/unit/keywordStaticGuard.test.ts` | 전이 import 가드 | ✓ VERIFIED | 가드 자기 검사 포함 통과 |
| `scripts/e2e/keyword.mjs` | 로컬 E2E 흐름 | ⚠️ 존재 | 브라우저 E2E 자체는 다시 돌리지 않았다(Human Verification) |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| 방 DO `startGame`·`rematch` 호출 | 키워드 선택 | `keywordPickerNow()` → `beginGame(…, pickKeyword)` | ✓ WIRED | `worker/room.ts:499`·`:655`, `KEYWORD_SWITCH.on` 을 호출 시점에 읽음. 호출처가 이 둘뿐임을 grep 으로 확인 |
| `phases.ts roleReveal` | `keyword` 단계 | `PHASE_DEFS.next` + `routeAfterRoleReveal` | ✓ WIRED | 변경 0 |
| `keyword` 마감 | 공개 목록 | `tick.ts keyword: closeKeyword` | ✓ WIRED | 변경 0 |
| `answer` 메시지 | `submitAnswer` | `schemas.ts` → `worker/room.ts applyAnswer` | ✓ WIRED | 변경 0 |
| 답 확정·찬반·밤 pick | 조기 마감 | `maybeAdvanceEarly` → `shrinkDeadline` → `reschedule` | ✓ WIRED | 변경 0 |
| 처형·처형 없는 낮 | `answerReveal` | `routeAfterExecution`·`afterDayOf` | ✓ WIRED | 변경 0 |
| `afterTransition` | D1 | `gameRowFor` → `reschedule` → `await recordGame(insertGame)` | ✓ WIRED | ended 진입 전환에서 한 번, 실패는 삼킴 |
| 서버 error 프레임(BAD_MESSAGE) | 클라이언트 거절 처리 | `useKeywordAnswer` `e.code === "BAD_MESSAGE"` | ✓ WIRED | WRONG_PHASE·RATE_LIMITED 는 무시 |
| 서버 view | 키워드 카드·첫날 답 탭 | `me.keyword`·`day.keyword.*` | ✓ WIRED | 변경 0 |
| 클라이언트 | 키워드 목록 | (연결이 없어야 한다) | ✓ 차단됨 | 번들 grep 0건 + 정적·전이 가드 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `Keyword.tsx` | `view.me.keyword` / `view.day.keyword.genre` | `buildView` ← `RoomState.keyword`(방 DO 가 넘긴 `pickKeyword` 가 `randInt` 두 번으로 고름) | 예 | ✓ FLOWING |
| `RoleCardSheet` 첫날 답 | `view.day.keyword.answers` | `closeKeyword` 의 `keywordAnswers` ← 실제 `answerSubmits`·초안 | 예 | ✓ FLOWING |
| D1 `games` 행 | `gameRowFor(prev)` → `buildGameRow(room, now)` | 판 상태(승패·voteLog·keyword·startedAt·gameId) | 예(메모리 D1 로 시험) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| 금지어·누설·조기 진행·D1·정적 가드·클라이언트 훅 | 위 vitest 18파일 | 342 passed, 2 skipped | ✓ PASS |
| 번들에 키워드 없음 | `vite build` + grep | 클라이언트 0건, 워커에만 있음 | ✓ PASS |
| 목록 불변식 | 모듈 직접 집계 | 7장르·306·최대 8자소·한 글자 0·별칭 없는 항목 0 | ✓ PASS |
| 타입 | `npm run typecheck` | 종료 0 | ✓ PASS |

### Probe Execution

Step 7c: 이 페이즈는 `scripts/*/tests/probe-*.sh` 류 프로브를 선언하지 않았다 — SKIPPED (해당 없음).

### Requirements Coverage

ROADMAP 의 Phase 23 `Requirements: TBD` 이고 REQUIREMENTS.md 에 이 페이즈에 매핑된 ID 가 없다. 계획의 `requirements: [SC1, SC7]` 등은 ROADMAP 성공 기준 번호다. SC1~SC8 이 위 표에서 모두 충족이다. ORPHANED 요구사항 없음.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| 변경 구현 파일 | - | `TBD\|FIXME\|XXX` | - | 이번 변경 6개 구현 파일에서 새로 들어온 것 없음(이전 보고서 기준 59개 파일 0건, 리뷰 수정은 주석·코드만 바꿨다) |
| `worker/room.ts afterTransition` | 1236 | 전환 경로에서 D1 삽입을 await | ℹ️ Info | 결과 저장·방송·알람 재설정 뒤라 플레이 영향 없음, 실패는 삼킴. 원격 D1 지연은 24 에서 확인 |
| `.planning/ROADMAP.md` | 591~614 | 23-01~23-13 계획 체크박스 `[ ]`, `Requirements: TBD` | ℹ️ Info | 문서 상태 갱신 대상(오케스트레이터가 페이즈 종료 때 처리) |
| `test/worker/setup.ts`·`test/unit/setup.ts` | - | 시험 동안 `KEYWORD_SWITCH.on=false` | ℹ️ Info | 의도된 격리. 켠 판은 `keywordLeak`·`keyword.test`·`earlyAdvance` 가 `openKeyword()` 로 맡는다. 제품 코드는 항상 true |
| `.planning/state.json`, `Claude outputs/` | - | 작업 트리 미커밋 | ℹ️ Info | 이 페이즈 산출물 아님 |

### Human Verification Required

위 frontmatter `human_verification` 6건 — 실기기 한 판, 키워드 목록 검토(0089-23), 664 높이 키보드 한계, 자동 열림 시트가 입력을 가리는 문제, 4.4초·연장 없음 정책 확인, 24 에서 실제 D1 생성 뒤 판 한 줄 확인(WR-04 의 await 지연 확인 포함).

참고: 알려진 비차단 항목 — `basicDay` 의 "토론 끝내기 → … → 밤" 시험이 처형자가 무작위로 마지막 마피아면 `ended` 가 되어 간헐적으로 어긋난다(0091-24). 리뷰 수정 보고서는 worker 첫 실행 1건 간헐 실패·재실행 통과를 보고했고, 이 검증의 범위 시험에서는 재현되지 않았다.

### Gaps Summary

차단 gap 없음. SC1~SC8 이 현재 코드와 다시 돌린 실행 결과로 확인되었다. 리뷰 수정 네 건은 (1) 판정을 넓힐 뿐 좁히지 않고, (2) 서버 프레임을 바꾸지 않는 클라이언트 필터이며, (3) 키워드 목록을 클라이언트 모듈 그래프에서 완전히 떼어 번들에 실리지 않음을 번들 grep 과 전이 가드로 확인했고, (4) 한 판 한 번·실패 격리를 유지한 채 불확실한 `waitUntil` 의존을 없앴다. 키워드 누설 불변식(마피아 프레임·거절 모양·http preview·클라이언트 번들)은 모두 유지된다. 남은 것은 사람의 눈·손이 필요한 항목과, 의도적으로 24 로 미룬 실제 D1 생성·배포뿐이라 상태는 `human_needed` 이다. 이 검증은 브라우저 E2E 와 전체 시험(`npm test`)을 다시 돌리지 않았다.

---

_Verified: 2026-11-17T05:30:00Z_
_Verifier: Claude (gsd-verifier)_
