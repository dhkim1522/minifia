---
phase: 23-keyword-day-one
verified: 2026-11-17T05:10:00Z
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
  - "test/unit/early.test.ts"
  - "test/unit/keywordAnswer.test.ts"
  - "test/unit/keywordFlow.test.ts"
  - "test/unit/keywordGuard.test.ts"
  - "test/unit/keywords.test.ts"
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
covered_digest: "v4:sha256:210fc01dc02a3f9957f54e05c18fddbe7eaa7ff3adf54cb56361f08b3dd7e388"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "실기기(폰)에서 첫날 한 판: 역할 확인 → 키워드 카드(장르·큰 키워드·각주) → 3초 잠금 뒤 10초 입력 → 모두의 답 공개 → 토론 → 처형 → 정답 공개 → 밤"
    expected: "시민 폰에는 키워드가 크게, 마피아 폰에는 ??? 가 보인다. 읽는 3초 동안 입력칸이 잠기고 풀리면 빛난다. 금지어를 보내면 같은 알림이 시민·마피아에게 똑같이 뜬다. 전원이 내면 1.5초 뒤 넘어가고, 토론 시작에 모두의 답 시트가 자동으로 열린다"
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
    expected: "판이 끝나면 games 표에 한 줄이 생기고 닉네임·채팅·답 글 열은 없다. ctx.waitUntil 삽입이 DO 내려감 뒤에도 끝까지 가는지(A3)와 `--local` 이 vite dev 의 로컬 D1 폴더를 보는지(A1)도 이때 확인한다"
    why_human: "실제 D1 생성은 외부 서비스 변경이라 23 에서 하지 않았다(D-19, 의도). 워커 시험은 메모리 D1 로만 검증했다"
---

# Phase 23: 첫날 키워드 문제와 D1 판 기록 검증 보고서

**Phase Goal:** 첫날에만 장르+키워드 문제를 낸다. 마피아는 장르만 알고, 키워드와 우회 표기는 누구도 쓸 수 없으며(마피아는 막히는지로 떠볼 수 있다), 모두 내면 한꺼번에 공개된다. 판마다 결과와 사용 숫자를 D1 에 한 줄 남긴다(결정 0089-1~9·16·21·22·23).
**Verified:** 2026-11-17
**Status:** human_needed (자동 검증 가능한 항목은 모두 통과 — 남은 것은 실기기·목록 검토·사용자 결정·24 의 실제 D1 생성뿐)
**Re-verification:** No — 초기 검증 (이전 VERIFICATION.md 없음)

SUMMARY 의 주장은 근거로 쓰지 않았다. 아래 증거는 코드를 직접 읽고, 실제로 시험·번들·스크립트를 돌린 결과다.

## 실행 결과 (실제 출력)

| 명령 | 결과 |
| ---- | ---- |
| `npm run typecheck` | 종료 0 (`tokens:check`, `wrangler types`(DB: D1Database 포함), `tsc app`, `tsc worker` 통과) |
| `npx vitest run test/worker/keywordLeak.test.ts test/worker/leak.test.ts test/worker/nightLeak.test.ts test/worker/earlyAdvance.test.ts test/worker/d1.test.ts test/unit/keywordGuard.test.ts test/unit/keywords.test.ts test/unit/early.test.ts` | `Test Files 8 passed (8)` · `Tests 118 passed \| 2 skipped (120)` · 종료 0 (skipped 둘은 옛 정치 장치 `describe.skipIf(!GAME_RULES.*)` 로 이 페이즈와 무관) |
| 추가: `test/worker/keyword.test.ts`·`gameLog.test.ts`, `test/unit/gameLog·keywordAnswer·keywordFlow·view·e2eContract`, `test/client/keywordScreen·useKeywordAnswer·answerReveal·roleCardSheet` | `Test Files 11 passed (11)` · `Tests 405 passed \| 11 skipped (416)` |
| `node --test scripts/games.test.mjs scripts/deploy-target.test.mjs` | 47 pass / 0 fail |
| `node --test scripts/e2e/keyword.test.mjs scripts/smoke.test.mjs` | 32 pass / 0 fail |
| `node scripts/games.mjs --bogus` | "알 수 없는 인자 — 아무것도 실행하지 않았다." 종료 1 |
| `node scripts/check-deploy-target.mjs` | "D1 바인딩 DB 의 database_id 가 없음 — … 전에는 배포하지 않는다 / 배포 중단" 종료 1 (의도된 차단) |
| `npx vite build --outDir <scratch>` 후 클라이언트 번들 grep | 종료 0. 표본 단어·별칭(해리포터·Harry Potter·Train to Busan·토이스토리·Toy Story·겨울왕국·Frozen·라이언킹·Lion King·부산행·Parasite·기생충)이 `dist/client` 에 0건, `dist/worker/index.js` 에만 있음. 클라이언트 번들에 `GENRES`·`pickKeyword` 0건 |
| 키워드 목록 직접 집계 | 7장르(영화 33·음식 45·동물 45·장소 47·스포츠 42·물건 51·나라 43) 합계 306, 최대 8자소, 한 글자 0, 13자소 이상 0, 별칭 없는 항목 0 |
| 부채 표식 `TBD\|FIXME\|XXX` (페이즈 변경 59개 구현 파일) | 0건 |
| 위생 `git grep -nIiE "torder\|티오더\|조직\|회사\|~/project"` | 코드·`docs/`·`23-*` 문서에는 `docs/portfolio-request.md:21`("회사 관련 표현을 넣지 않는다", 규칙 문구)뿐. 나머지는 `.planning/milestones/*` 보관본과 이전 페이즈 보고서의 일반 용례 |

## Goal Achievement

### Observable Truths (ROADMAP 성공 기준 SC1~SC8)

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| SC1 | 첫날 역할 확인 뒤 키워드 카드(장르 위·큰 키워드·마피아 `???`·각주), 서버는 마피아에게 키워드를 보내지 않는다 | ✓ VERIFIED | `phases.ts`: `roleReveal.next="keyword"`, `keyword` 13초(`KEYWORD_READ_MS` 3s + `KEYWORD_WRITE_MS` 10s), `keyword.next="dayAnnounce"`. `Keyword.tsx` 가 `장르 : {genre}`·`me.keyword` 있으면 큰 글/없으면 `???`·`* 직접적인 키워드는 언급하면 안 됩니다.` 를 그린다. `view.ts:236` 은 keyword 단계의 산 비마피아 본인에게만 `myInfo.keyword` 키를 만든다(마피아는 키 자체가 없음). 마피아·http preview 누설: `keywordLeak.test.ts` ①(키워드·영어 별칭·"해포" 가 정답 공개 전 모든 마피아 프레임과 keyword·verdict 단계 preview 에 0건, 시민 프레임에는 있음 — 검사가 살아 있음), ③④⑥(day.keyword 열 동일). 읽기 3초 잠금은 `useKeywordAnswer` 가 `KEYWORD_READ_MS` 로 잠근다 |
| SC2 | 금지어 판정: NFKC·기호·공백·대소문자·별칭·3글자 이상 초성, 철자 틀림은 통과 | ✓ VERIFIED | `keywordGuard.ts`: `normalizeForGuard`(NFKC → `\p{L}\p{N}` 외 제거 → 소문자) 포함 검사 + 길이 3 이상 완성형 키워드의 초성열 포함 검사. `keywordGuard.test.ts` 가 `해.리.포.터`·`Harry_Potter`·전각·`ㅎㄹㅍㅌ`·`ㅎ ㄹ ㅍ ㅌ`·영폭 공백·NFD·호환 자모는 막힘, `hery foter`·`a해b리c포d터`·짧은 초성은 통과, 2글자 키워드·영어 키워드는 초성 검사 없음을 고정. 정규식은 문자 범주 치환이라 선형 |
| SC3 | 답: 10초·20자소, 초안/확정, 시민·마피아 같은 거절, 공개 순서, 봇은 답 없음 | ✓ VERIFIED | `answerRules.ts` `ANSWER_MAX_GRAPHEMES=20`·`ANSWER_MIN_GAP_MS=400`. `submitAnswer` 검사 순서(단계 → 행위자(봇 거절) → 이미 확정이면 불변 → 정리·20자소 → 초안 무검사 저장 → 확정 금지어 거절). 거절은 시민·마피아 모두 `{ok:false, BAD_MESSAGE}` 이고 방 DO 가 같은 두 프레임 `[error, state]` 로 응답하며 마피아일 때만 서버 전용 `keywordProbed` 를 켠다(`keywordLeak ⑤` 가 오류 원문 동일·마피아 view 가 거절 전후 같음을 단언). `closeKeyword` 순서: 확정 낸 순서 → 마감 초안(금지어 없을 때, 좌석 순) → 답 없음(좌석 순, 봇은 늘 null). 답 제출은 `persistAndBroadcast` 없이 `storage.put` 1회 + 본인에게만 `sendViewTo`(`worker/room.ts applyAnswer`) |
| SC4 | 첫날 처형/처형 없음 뒤 밤 직전 `answerReveal`(없으면 4.4초), 기록 카드에 첫날 답, 둘째 날부터 키워드 없음 | ✓ VERIFIED | 분기 세 곳이 한 규칙으로 모인다: `routeAfterExecution`(`endgame.ts`, 승패가 나면 `ended` 로 건너뜀), `afterDayOf`(verdict·nomination·runoff·showdown 의 처형 없는 낮) — 모두 `firstDayAnswerPending`(keyword 있고 day 1)일 때만. `phaseDurationOf`: `ANSWER_REVEAL_MS + (noExecutionOf ? NO_EXECUTION_MS : 0)`. `answerOpenOf` 한 함수로 정답이 `answerReveal` 진입 프레임부터 모두에게 같다. `keyword.test.ts` 가 첫날 부결 → `phaseDurationMs 4400`·모든 소켓 `day.keyword.answer` 동일, 둘째 날 부결은 곧장 night 임을 고정. `keywordFlow.test.ts` 가 day 1 마피아 전멸 → ended(공개 단계 건너뜀)를 고정. `RoleCardSheet.tsx` 가 시민에게도 `첫날 답` 탭을 주고(`keywordAnswersOf`), `RoomScreen` 이 토론 시작에 한 번 자동으로 연다 |
| SC5 | 키워드 파일: 6~8장르 × 30↑, 별칭, 한 글자 없음, ≤12자소, 검토 대기 주석 | ✓ VERIFIED | 위 집계(7장르, 각 33 이상, 한 글자 0, 최대 8자소). 첫 줄 `// 초안, 사용자 검토 대기(0089-23)`. `keywords.test.ts` 의 `keywordListProblems` 가 불변식(길이·정규화 충돌·역할 문자열·별칭 규칙)을 고정하고 위반 0건. 문서(0091·HANDOFF)의 "310개" 표기는 실제 306개와 다르다(Info) |
| SC6 | D1: database_id 없는 바인딩, 0001 열, ended 에서 waitUntil 한 번·실패 격리, 닉네임·채팅·답 비저장, `npm run games`, 배포 가드, 실제 D1 미생성 | ✓ VERIFIED | `wrangler.jsonc` `d1_databases:[{binding:"DB", database_name, migrations_dir}]`(id 없음). `migrations/0001_games.sql` 16열 정확히(`d1.test.ts` 가 열 집합 일치·`INSERT OR IGNORE` 중복 1행·CHECK 검사). `worker/room.ts recordGame`: `prev.phase!=="ended" && room.phase==="ended"` 일 때만, `ctx.waitUntil(insertGame(...).catch(() => console.error("game log failed")))`, 값은 전부 `?` 바인딩. `buildGameRow` 는 닉네임·채팅·답 글을 읽지 않고(문자열 값은 판 id·승리 진영·장르 id·단어뿐) `no_answer_count` 만 센다. `gameLog.test.ts`(worker)가 성공·실패 격리·한 번만을 고정(실패 로그 정확히 `game log failed` 한 인자). `package.json` `games` = `node scripts/games.mjs`(인자 가드 실행 확인). `check-deploy-target` 가 id 없음으로 종료 1(실행 확인). 실제 `wrangler d1 create` 호출·id 기입 흔적 없음(`wrangler.jsonc`·scripts 전체 grep) |
| SC7 | 키워드가 마피아에게 어떤 응답 모양으로도 새지 않는다(누설 검사) | ✓ VERIFIED | `keywordLeak.test.ts` ①②③④⑤⑥ 통과(마피아 전 프레임·preview·거절 모양·메타모픽). `leak.test.ts` `SERVER_ONLY_KEYS` 에 `keywordProbed`·`answerSubmits`·`answerDraft`·`earlyFrom`·`startedAt`·`gameId` 전부 등록, `KEYWORD_WIRE_PATHS` 허용 경로를 한 상수로 고정하고 "키워드 공개 경로 고정" 시험이 있다. 이 시험들이 통과. 한계: 시험 setup 이 `KEYWORD_SWITCH` 를 꺼 두므로 `leak.test.ts` 의 일반 한 판 전수에는 키워드 프레임이 나오지 않고, 켠 판은 `keywordLeak` 가 정답 공개 직전까지만 마피아 전 프레임을 단언한다. 정답 공개 이후 프레임은 모두에게 같은 공개 값이다 |
| SC8 | 일찍 넘어가기: 키워드(사람만), 찬반(1.5초·번복 연장 상한), 밤(한 번 줄임·연장 없음), 넘기기 단추 없음, 밤 누설 메타모픽 | ✓ VERIFIED | `early.ts` `earlyReady`(keyword: 산 사람 중 사람 전원 확정, 봇 제외 / verdict·night: 산 사람 전원) + `shrinkDeadline`(`EARLY_GRACE_MS=1500`, `min(원래 마감, now+1.5s)`, `earlyFrom` 보관, extend 는 찬반만, 키가 같으면 밤·키워드는 재단축 없음, 봇 계획 키 갈아 끼움). `worker/room.ts maybeAdvanceEarly` 가 세 apply* 본체(applyAnswer·applyVerdict·밤 pick 경로)에서 불리고 `reschedule` 한다. `early.test.ts`(단위)·`earlyAdvance.test.ts`(방 DO: 끊긴 사람 있으면 마감 유지·알람 이동·연장 없음) 통과. `nightLeak.test.ts` 메타모픽 (iii) "역할만 다른 두 판의 종료 시각·프레임 열이 같다"와 "줄어든 뒤 선택 변경은 마감을 바꾸지 않고 다른 소켓에 프레임이 없다" 통과. 개인 [넘기기] 단추 없음: 프로토콜에 `skip` 류 메시지는 테스트 방 전용 `testSkip` 뿐, UI 의 `skip` 아이콘은 기존 과반 [토론 끝내기] 단추(`GamePanel.tsx`)뿐. 결과 화면 [넘기기]는 결과 발표 건너뛰기(기존, 이 페이즈 무관) |

**Score:** 8/8 truths verified (0 present-behavior-unverified)

### 결정 0051 (글 최소) 점검

카드 글은 장르 한 줄·키워드·각주 한 줄이 전부이고(`KEYWORD_COPY`), 입력줄은 남은 초·`n/20`·`냈어요` 정도의 숫자·짧은 글만 둔다(안내 글자는 띠가 맡음). 정답 공개도 "처형 없음"·"정답" 큰 글 + 키워드다. 읽을 글이 한 줄을 넘는 화면은 보지 못했다 — 위반 없음.

### Phase 22 불변식

- 판 종류 하나: 코드에서 `mode` 는 옛 방 정규화 키(`LEGACY_V3_ROOM_KEYS`)로만 남는다. `leak.test.ts` 통과.
- 투표 기록 없음: `voteLog` 는 서버 전용이고 `leak.test.ts` 가 `.view.day.voteLog` 부재와 모든 단계에서 `"voteLog" in v.day === false` 를 단언한다. `day.points` 는 지목 단계에만 있다. 이 페이즈가 새로 공개 경로를 더한 것은 `KEYWORD_WIRE_PATHS` 뿐이다.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `shared/game/keywords.ts` | 장르·키워드·별칭 목록 + `pickKeyword` + `KEYWORD_SWITCH` | ✓ VERIFIED | 306개, 최상위 함수 호출 없음(번들 트리 셰이킹 확인) |
| `shared/game/keywordGuard.ts` | 금지어 판정 | ✓ VERIFIED | 위 SC2, 단위 시험 통과 |
| `shared/game/keywordAnswer.ts` | 답 접수·마감·정답 개방 규칙 | ✓ VERIFIED | `submitAnswer`·`closeKeyword`·`answerOpenOf`·`routeAfterRoleReveal`, tick 훅 연결 |
| `shared/game/early.ts` | 조기 진행 순수 규칙 | ✓ VERIFIED | 방 DO 에서 호출됨 |
| `shared/game/gameLog.ts` + `worker/gameLog.ts` | 행 만들기·삽입 | ✓ VERIFIED | `recordGame` 에서 호출됨 |
| `migrations/0001_games.sql` | 16열 + 색인 | ✓ VERIFIED | 열 집합 시험 통과 |
| `wrangler.jsonc` | D1 바인딩(id 없음) | ✓ VERIFIED | 배포 가드가 막음 |
| `scripts/games.mjs` | 조회 스크립트 + 인자 가드 | ✓ VERIFIED | 단위 시험 통과 |
| `src/screens/Keyword.tsx` · `src/net/useKeywordAnswer.ts` | 카드·입력줄·훅 | ✓ VERIFIED | `RoomScreen` 의 `keyword` 분기에서 렌더 |
| `src/components/RoleCardSheet.tsx` | 첫날 답 탭 | ✓ VERIFIED | 시민도 탭 보임, `keywordView` 선택기 한 곳 |
| `scripts/e2e/keyword.mjs` | 로컬 E2E 흐름 | ⚠️ 존재·단위 시험 통과 | 브라우저 E2E 자체는 이 검증에서 다시 돌리지 않았다(아래 Human Verification) |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `phases.ts roleReveal` | `keyword` 단계 | `PHASE_DEFS.next` + `routeAfterRoleReveal`(keyword 없으면 dayAnnounce) | ✓ WIRED | `tick.ts` ON_DEADLINE |
| `keyword` 마감 | 공개 목록 | `tick.ts keyword: closeKeyword` | ✓ WIRED | `keyword.test.ts` 마감 뒤 answers 동일 |
| `answer` 메시지 | `submitAnswer` | `schemas.ts`(strictObject) → `worker/room.ts handleAnswer/applyAnswer` | ✓ WIRED | 신원은 소켓 첨부 playerId 뿐 |
| 답 확정·찬반·밤 pick | 조기 마감 | `maybeAdvanceEarly` → `shrinkDeadline` → `reschedule` | ✓ WIRED | `earlyAdvance.test.ts` |
| 처형·처형 없는 낮 | `answerReveal` | `routeAfterExecution`·`afterDayOf` | ✓ WIRED | 승패 시 `ended` 우선 |
| `afterTransition` | D1 | `recordGame` → `ctx.waitUntil(insertGame)` | ✓ WIRED | ended 진입 전환에서 한 번 |
| 서버 view | 키워드 카드 | `me.keyword`(시민만)·`day.keyword.genre` | ✓ WIRED | `Keyword.tsx` |
| 서버 view | 첫날 답 탭·정답 줄 | `day.keyword.answers`·`.answer` | ✓ WIRED | `keywordView.ts` → `RoleCardSheet`·`hostLine` |
| 클라이언트 | 키워드 목록 | (연결이 없어야 한다) | ✓ 차단됨 | 번들 grep 0건 + `keywordStaticGuard` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `Keyword.tsx` | `view.me.keyword` / `view.day.keyword.genre` | `buildView` ← `RoomState.keyword`(`beginGame` 이 `randInt` 두 번으로 `pickKeyword`) | 예 | ✓ FLOWING |
| `RoleCardSheet` 첫날 답 | `view.day.keyword.answers` | `closeKeyword` 가 만든 `keywordAnswers` ← 실제 `answerSubmits`·초안 | 예 | ✓ FLOWING |
| D1 `games` 행 | `buildGameRow(room)` | 판 상태(승패·voteLog·keyword·startedAt·gameId) | 예(메모리 D1 로 시험) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| 금지어·누설·조기 진행·D1 | 위 vitest 8파일 | 118 passed | ✓ PASS |
| 번들에 키워드 없음 | `vite build` + grep | 클라이언트 0건 | ✓ PASS |
| 배포 가드 | `node scripts/check-deploy-target.mjs` | 종료 1, database_id 사유 | ✓ PASS |
| 조회 인자 가드 | `node scripts/games.mjs --bogus` | 종료 1 | ✓ PASS |

### Probe Execution

Step 7c: 이 페이즈는 `scripts/*/tests/probe-*.sh` 류 프로브를 선언하지 않았다 — SKIPPED (해당 없음).

### Requirements Coverage

ROADMAP 의 Phase 23 `Requirements: TBD` 이고 REQUIREMENTS.md 에 이 페이즈에 매핑된 ID 가 없다. 계획의 `requirements: [SC1, SC7]` 등은 ROADMAP 성공 기준 번호다. SC1~SC8 이 위 표에서 모두 충족이다. ORPHANED 요구사항 없음.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| 페이즈 변경 구현 파일 59개 | - | `TBD\|FIXME\|XXX` | - | 0건 |
| `docs/decisions/0091-…`, `HANDOFF.md` | - | "7장르 310개" 표기 vs 실제 306개 | ℹ️ Info | 수치 오기. 불변식(장르 6~8·각 30↑)에는 영향 없음 |
| `.planning/ROADMAP.md` | 591~614 | 23-01~23-13 계획 체크박스가 `[ ]`, `Requirements: TBD` | ℹ️ Info | 문서 상태 갱신 대상(오케스트레이터가 페이즈 종료 때 처리) |
| `test/worker/setup.ts`·`test/unit/setup.ts` | - | 시험 동안 `KEYWORD_SWITCH.on=false` | ℹ️ Info | 의도된 격리(옛 시험 보호). 켠 판은 `keywordLeak`·`keyword.test`·`earlyAdvance` 가 `openKeyword()` 로 맡는다. 제품 코드는 항상 true |
| `.planning/state.json`, `Claude outputs/` | - | 작업 트리 미커밋 | ℹ️ Info | 이 페이즈 산출물 아님(검증 대상 아님) |

### Human Verification Required

위 frontmatter `human_verification` 6건 — 실기기 한 판, 키워드 목록 검토(0089-23), 664 높이 키보드 한계, 자동 열림 시트가 입력을 가리는 문제, 4.4초·연장 없음 정책 확인, 24 에서 실제 D1 생성 뒤 판 한 줄 확인.

참고: 알려진 비차단 항목 — `basicDay` 의 "토론 끝내기 → … → 밤" 시험이 처형자가 무작위로 마지막 마피아면 `ended` 가 되어 간헐적으로 어긋난다(단독 재실행 통과, 0091-24). 이번 검증 범위 시험에서는 재현되지 않았다.

### Gaps Summary

차단 gap 없음. SC1~SC8 이 코드와 실행 결과로 확인되었다. 가장 중요한 불변식(키워드가 마피아 프레임·거절 모양·http preview·클라이언트 번들 어디에도 새지 않음)은 누설 시험과 번들 grep 양쪽으로 직접 확인했다. 남은 것은 사람의 눈·손이 필요한 항목과, 의도적으로 24 로 미룬 실제 D1 생성·배포뿐이라 상태는 `human_needed` 이다. 이 검증은 브라우저 E2E(23-12 가 통과 보고)를 다시 돌리지 않았고 전체 시험(`npm test`)도 한 번 돌리지 않았다(요청 범위의 시험 + 페이즈 관련 추가 시험만 실행).

---

_Verified: 2026-11-17T05:10:00Z_
_Verifier: Claude (gsd-verifier)_
