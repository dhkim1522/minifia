# Phase 23: 첫날 키워드 문제와 D1 판 기록 - Context

**Gathered:** 2026-11-16
**Status:** Ready for planning

> 자동 진행(`/gsd-autonomous --from 22 --to 24`). 방향과 규칙은 사용자와 확정한 결정 0089(0089-1~9·16·21~26)다. 아래 D-* 중 0089 에 없는 세부는 추천안 자동 채택이고 사용자가 돌아와 한 줄씩 바꿀 수 있다. **대전제: 장치를 늘리지 않고 심플하게.**

<domain>
## Phase Boundary

첫날에만 장르+키워드 문제를 낸다. 마피아는 장르만 알고(`???`), 키워드·별칭·우회 표기는 누구도 답에 쓸 수 없다(마피아는 막히는지로 떠볼 수 있다). 모두 내면 한꺼번에 공개(낸 순서 ①②③)하고, 첫날 처형 뒤 밤 직전에 정답을 모두에게 공개한다. 개인 행동 단계(키워드 답·찬반·밤 고르기)는 전원이 끝내면 일찍 넘어간다(0089-26). 판이 끝나면 D1 에 한 줄을 남긴다.

넣지 않는 것: 의심 포스트잇·새 튜토리얼·전체 회귀·배포(24). 시상·억울상(없음). 답 글·닉네임·채팅을 D1 에 저장하는 것(안 한다).

</domain>

<decisions>
## Implementation Decisions

### 첫날 흐름과 단계 (0089-9)
- D-01: 새 단계 id `keyword` 를 `roleReveal` 과 `dayAnnounce` 사이에 둔다(`roleReveal.next="keyword"`, `keyword.next="dayAnnounce"`). 길이는 읽기 3초 + 쓰기 10초 = 13초(`KEYWORD_MS`). 둘째 날부터는 `morning → dayAnnounce` 그대로라 영향이 없다. `keyword` 는 `MAP_PHASES`·`DAY_PHASES` 에 넣지 않는다(걷기·채팅·몸동작 없음, 조용히 쓰는 시간).
- D-02: 정답 공개는 새 단계 `answerReveal`(연출 3초)을 하나 더 둔다. 첫날(day===1)에 한해 처형 뒤 `execution.next` 와 `afterDayOf()`(처형 없는 낮) 두 곳이 `night` 대신 `answerReveal` 로 보내고, `answerReveal.next="night"`. 승패가 나서 `ended` 로 가면 공개 단계를 건너뛰고 결과 화면이 정답을 보여 준다.
- D-03: 답 공개는 키워드 단계가 끝나는 순간(전원 제출 또는 시간 끝) 같은 단계 끝에서 `day.keyword.answers[]`(`{order, seat, text|null}`)를 모두에게 싣고, 토론이 시작되면 기록 카드가 자동으로 한 번 열린다(UI-SPEC). 정답은 `answerReveal` 에서 `day.keyword.answer` 로 모두에게 싣는다. 공개 뒤의 답·정답은 모두에게 같은 공개 값이다.
- D-04: 새 `PhaseId` 가 가입해야 하는 모든 표·집합(`Record<PhaseId,…>` 와 컴파일러가 못 잡는 `Set`/배열: `DAY_PHASES`·`MAP_PHASES`·`CHAT_PHASES`·`BADGE_PHASES`·`WHISPER_PHASES`·`FIXED_PHASES`·`TICK_PHASES`·`ENTER_SOUND`·`HOST_HIDDEN_PHASES`·`TIMELESS_PHASES`, `PHASE_ANNOUNCE`·`PHASE_SCENE`·`BED_OF`·`TEST_PHASE_LABEL`, 스크립트의 `GRAPH`/`PHASE_NEXT`/`EXPECTED_SCENE`, 시험의 PHASES 배열)을 계획에서 grep 으로 전부 나열해 갱신한다.

### 키워드 선택과 서버 상태 (0089-2·3)
- D-05: 서버가 첫날 시작에 장르와 키워드를 무작위로 고른다(`cryptoRandInt`, 시험에서는 주입). `RoomState.keyword?: { genre, word }` 는 **서버 전용**이다. 키워드 목록은 `shared/game/keywords.ts`(장르 6~8개 × 키워드 30개 이상, 키워드마다 별칭 한국어·영어·짧은 이름, 한 글자 키워드 없음, 파일 상단에 "초안, 사용자 검토 대기(0089-23)" 주석). 단위 시험이 장르 수·개수·한 글자 없음·정규화 충돌 없음을 검사한다.
- D-06: view 모양(누설 없음): 모든 사람의 view 에 `day.keyword = { genre }`(키워드 단계 동안, 같은 모양)가 있다. `me.keyword?: string` 은 **시민에게만** 키가 있고 마피아에게는 키를 만들지 않는다(자기 역할은 본인이 이미 아는 값). 다른 사람의 view 에는 어떤 차이도 없다. 정답 공개 전에 키워드 문자열은 마피아 소켓의 어떤 프레임에도 없어야 한다(누설 시험이 한 판을 돌리며 모든 마피아 프레임에 정답 부재를 단언, 비인증 http preview 포함).

### 답 입력·판정 (0089-4~8)
- D-07: 답은 새 클라이언트 메시지 `answer { text, final }`(zod strictObject, 문자 상한은 will 과 같은 UTF-16 상한 안)다. 서버 규칙은 `shared/game/keywordAnswer.ts` 순수 함수: 단계 `keyword` 에서만, 산 사람만, 본문은 `sanitizeChatText` 정리 뒤 **20자소**(`ANSWER_MAX_GRAPHEMES`) 이하.
  - `final:false` 는 초안 저장(본인에게만 state, 전원 방송 금지) — 금지어 검사를 하지 않는다. 마감 직전에 클라이언트가 보낸 초안이 마감 때 "쓰던 글"로 제출된다(0089-8).
  - `final:true` 는 확정 제출. 금지어(D-08)가 들어 있으면 `BAD_MESSAGE` 로 거절한다(시민의 우회 시도와 마피아의 떠보기가 같은 응답이라 구별되지 않는다). 거절은 재시도할 수 있고 사람당 400ms 간격(`ANSWER_MIN_GAP_MS`)을 둔다. 허용된 첫 확정은 바뀌지 않는다(한 번 제출하면 끝).
  - 마감에 확정 못 한 사람은 초안이 있고 금지어가 없으면 그 초안으로, 아니면 `text:null`("답 없음")로 맨 끝 순서(좌석 순)에 들어간다. 봇은 늘 `null`.
- D-08: 금지어 검사(`keywordGuard`): 답을 NFKC → 글자·숫자(`\p{L}\p{N}`) 외 전부 제거 → 소문자로 만든 뒤, 같은 방식으로 정규화한 키워드·별칭이 **포함**되면 막는다. 완성형 한글의 초성(`(코드-0xAC00)/588`)을 뽑아 3글자 이상 키워드의 초성열이 답의 초성열에 들어 있어도 막는다. NFD 입력은 NFC 로 합친 뒤 처리한다. 철자를 일부러 틀린 우회는 막지 않는다(매너).
- D-09: 마피아가 금지어로 거절당하면 서버 전용 플래그 `keywordProbed`(그 판에서 마피아가 한 번이라도 거절당함)를 켠다. D1 의 "떠보기 성공"은 이 플래그다(0089-21).
- D-10: 답 제출은 `persistAndBroadcast` 를 부르지 않는다(will 과 같은 방식): `storage.put("room")` 한 번 + 본인에게만 `sendViewTo`. 단계 끝의 공개 전환만 `afterTransition` 으로 전원 방송한다(DO 쓰기 예산, 결정 0076, 타이밍 누설 방지).

### 일찍 넘어가기 (0089-26)
- D-11: 한 헬퍼 `maybeAdvanceEarly`(worker)가 세 곳에서 쓰인다 — 키워드(산 사람 중 **사람** 전원이 확정 제출, 봇은 대상 아님), 찬반(산 사람 전원이 투표), 밤(산 사람 전원이 `nightPick` 을 가짐). 조건이 처음 참이 되면 그 시각 +1.5초(`EARLY_GRACE_MS`)를 새 마감으로 줄여(원래 마감을 넘지 않음) `reschedule()` 하고, 그 사이 번복·변경이 들어오면 다시 now+1.5초로 미룬다(상한은 원래 마감). 마감이 줄어들 때 `phaseDurationMs` 는 단계 표 길이 그대로이므로 화면 타이머 막대 계산(`GameMap`)이 마감 단축에서도 깨지지 않게 한다.
- D-12: 연결이 끊긴 사람은 선택하지 않으므로 그 판은 정해진 시간을 다 쓴다(안전, 효율은 낮음). 토론 과반·유언 [남기기]는 지금 그대로. 연출 단계(처형·아침·정답 공개)는 못 넘긴다.
- D-13: 밤 조기 마감이 역할을 흘리지 않는다: 종료 시각은 "마지막 산 사람이 고른 시각 +1.5초"로 역할과 무관하고, 전환 프레임은 전원에게 같다. `nightLeak.test.ts` 에 "역할만 다른 두 판의 밤 종료 시각·프레임 열이 같다" 시험을 더한다.

### 기록 (0089-9·16)
- D-14: 첫날 답은 판 내내 공개 값으로 남는다: `day.keyword.answers` 를 첫날 이후에도 view 에 싣고(둘째 날부터 `day.keyword` 는 `answers` 와 `answer` 만), 기록 카드(내 역할 시트의 새 "첫날 답" 줄/탭, 시민 포함)가 읽는다. 카드는 일차별 구역(`n` 기준)으로 만들어 24 의 포스트잇이 줄을 더할 수 있게 한다.

### D1 판 기록 (0089-16·21)
- D-15: Cloudflare D1 을 `wrangler.jsonc` 의 `d1_databases` 바인딩 `DB`(이름 `minifia-v3-games`)로 더한다. `migrations/0001_games.sql` 의 표 `games`: `id`(판 uuid, 서버 전용 상태에 둠, `INSERT OR IGNORE`), `ended_at`, `winner`(mafia|citizen), `caught_day`(마피아가 잡힌 날, 없으면 NULL), `first_day_caught`(0|1), `genre`, `word`, `probe_success`(0|1), `players`, `bots`, `has_bots`(0|1), `duration_s`, `left_count`, `note_count`(24 전까지 0), `no_answer_count`, `tutorial`(0|1, 24 전까지 0). 닉네임·채팅·답 글은 저장하지 않는다.
- D-16: 삽입은 `afterTransition` 의 "ended 로 들어서는 전환에서 한 번"(`emitResultLog` 와 같은 조건)에 `ctx.waitUntil(recordGame(...))` 로 한다. 실패는 삼키고(토큰·내용 없는 짧은 로그) 게임을 막지 않는다. 판 길이를 위해 서버 전용 `startedAt` 을 `startGame` 에서 기록한다. ended 를 거치지 않고 만료된 판은 기록하지 않는다.
- D-17: 조회는 `npm run games`(= `scripts/games.mjs`, 승률·평균·첫날 잡힘 비율·떠보기 성공 비율을 한국어로 한 화면 출력, 봇이 낀 판은 `has_bots=1` 이라 기본 통계에서 뺌, `--local`·`--remote` 선택). 인자 가드 시험(`scripts/*.test.mjs`)을 곁들인다.
- D-18: 시험 환경(`@cloudflare/vitest-plugin`)은 메모리 D1 을 만든다. 마이그레이션 적용은 `test/worker/setup.ts` 에서 직접 한다(API 이름은 설치된 플러그인 버전 소스에서 확인).
- D-19: **실제 D1 데이터베이스 생성(`wrangler d1 create`)과 `database_id` 기입은 외부 서비스 변경이라 이 페이즈에서 하지 않는다.** `wrangler.jsonc` 에는 바인딩과 `migrations_dir` 만 두고, 개인 계정 확인 뒤 생성·id 기입·원격 마이그레이션은 24 의 배포 단계 첫 일로 한다(배포 가드 우회 금지).

### 시험·검증
- D-20: 누설 검사: 정답 문자열이 마피아 소켓의 모든 프레임·http preview·결과 로그에 없음, 역할만 다른 두 판의 `day.keyword` 열 동일, 차단어 거절 응답이 시민·마피아에서 같은 모양. 단위: `keywords`·`keywordGuard`(공백·기호·대소문자·초성·영어 별칭·NFD·한 글자 키워드 부재), `keywordAnswer`(초안·확정·마감 처리·순서·답 없음 맨 끝), 조기 진행(전원/봇 제외/번복 유예/끊긴 사람). worker: 첫날 한 판(역할 확인 → 키워드 → 낮 … 처형 → 정답 공개 → 밤), 둘째 날은 키워드 없음, 첫날 승패가 나면 공개 단계 건너뜀, D1 삽입(성공·실패 격리). E2E(로컬, 바뀐 흐름만): 키워드 카드·입력·공개·정답 공개·조기 진행.
- D-21: 새 결정 기록 `docs/decisions/0091-v3-keyword-day-one.md`(키워드·answerReveal 단계 id, 거절 응답 규칙, D1 열·판 식별자, 조기 진행 정책, D-19 의 계정 단계)를 만든다. 기획서·구조 문서·화면 지도를 새 흐름으로 고친다.

### 리서치 열린 질문 자동 채택 (23-RESEARCH Q1~Q7)
- D-22 (Q1): 첫날 처형이 없으면 `answerReveal` 은 "처형 없음" 큰 글 1.4초 + 정답 3초 = 4.4초, 처형이 있으면 3초. `noExecutionOf` 를 `answerReveal` 까지 넓힌다.
- D-23 (Q2): `day.keyword.genre` 는 둘째 날 이후에도 싣는다(공개 값, 기록 카드 구역 머리). 이에 맞춰 서버 `view.ts` 의 `DAY_PHASES` 에는 `keyword` 를 넣는다(클라이언트 걷기·채팅 집합 `MAP_PHASES`·`CHAT_PHASES` 에는 넣지 않는다).
- D-24 (Q3): 공개 순서는 확정 제출 낸 순서 → 마감에 초안으로 나간 사람(좌석 순) → 답 없음(좌석 순).
- D-25 (Q4): 번복 연장은 **찬반에서만** 한다(마지막 표 뒤 1.5초, 원래 마감 이내). 밤·키워드는 전원이 끝난 첫 순간 +1.5초로 한 번만 줄이고 이후 연장하지 않는다(밤 선택은 본인에게만 보내는 정보라 연장 방송이 새 신호가 됨). D-11 을 이렇게 좁힌다.
- D-26 (Q5): 자유 채팅에는 금지어를 걸지 않는다(마피아의 무제한 탐색 도구가 되므로). 금지어는 키워드 단계의 답에만 적용한다.
- D-27 (Q6): 테스트 방 판의 D1 기록은 `has_bots = bots>0 || testMode` 로 통계에서 뺀다.
- D-28 (Q7): `left_count` 는 `ended` 진입 시점에 끊겨 있는 사람 수.
- D-29: 기능 스위치 — `RoomState.keyword === undefined` 이면 `keyword`·`answerReveal` 단계를 건너뛴다(배포 순간 진행 중이던 옛 방·옛 시험 보호). 키워드는 `beginGame` 에서 `decideMap` 뒤 `randInt` 두 번으로 고른다(진입 훅에서 고르지 않음).

### 계획 점검 경고 처리 (자동 채택)
- D-30: 23-02 는 D1 바인딩을 넣은 직후 `npm run build`(vite)가 database_id 없이 통과하는지 확인한다(마지막 웨이브에서야 깨지는 것을 막음).
- D-31: 23-01·23-05 는 PhaseId 가입 때문에 GREEN 커밋이 하나로 묶이지만, 시험·스크립트 사본 정리는 GREEN 뒤 별도 커밋으로 나눠도 된다(실행기 컨텍스트를 가볍게).
- D-32: 23 은 D1 database_id 가 비어 있어 `npm run deploy` 가 막힌다(D-19 의도). HANDOFF·결정 0091 에 적는다.

### Claude's Discretion
- 계획 나누기와 순서(조사 권장: 콘텐츠·판정 순수 모듈 / D1 기반 병렬 → 서버 첫날 흐름 / 답 메시지 → 조기 진행 / view·누설 → 클라이언트 → 기록 카드·회귀), 키워드 초안의 구체 단어와 별칭, `ANSWER_MIN_GAP_MS`·`EARLY_GRACE_MS` 의 정확한 값은 계획자·실행자가 정한다.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- 유언(`shared/game/will.ts`, worker `handleWill`/`applyWill`, `useWill.ts`/`WillSheet.tsx`): 입력 메시지·초안 자동 저장·마감 직전 전송·거절 처리의 선례. 본인에게만 state, 전원 방송 없음.
- 조기 종료 패턴: worker `applyEndDiscussion`/`applyWill(final)` → `tick({...phaseEndsAt: now})` → `afterTransition`. 알람은 `reschedule`/`nextWakeAt`.
- 정리: `sanitizeChatText`(`shared/game/chatRules.ts`), `countGraphemes`(`shared/nickname.ts`, NFKC·소문자 정규화 선례).
- 누설 시험 틀: `test/worker/leak.test.ts`(`SERVER_ONLY_KEYS`·`ALLOWED_WIRE_PATHS`), `nightLeak.test.ts`.
- 사회자 한 줄·단계 알림·장면: `hostLine.ts`·`PHASE_ANNOUNCE`·`PHASE_SCENE`.

### Established Patterns
- 단계 표 `shared/game/phases.ts`(PHASE_DEFS·next), 훅 `tick.ts`(ON_ENTER/ON_DEADLINE), 순수 규칙은 `shared/game`(시각·난수 인자), 서버 전용 키는 `SERVER_ONLY_KEYS` 에 등록.
- 새 `PhaseId` 는 `Record<PhaseId,…>` 는 컴파일러가, `Set`/배열 가입은 grep 으로 확인.
- 봇은 계획에 단계가 없으면 행동하지 않는다(`botPlanKey`).

### Integration Points
- 첫날 분기: `phases.ts`·`tick.ts` 훅·`afterDayOf()`·`execution.next`·`endgame.ts routeAfterExecution`.
- D1: `wrangler.jsonc`(현재 바인딩 없음), `worker/room.ts` `afterTransition` 의 ended 전환, `startGame`(`startedAt` 신설), `test/worker/setup.ts`.
- 기록 카드: `RoleCardSheet.tsx`(지금 시민에게는 탭 없음), `Journal.tsx`, `recordsSeen.ts`.
- 위험한 얽힘(조사): ① 새 PhaseId 파급(Set 누락은 컴파일이 안 잡음) ② 키워드 누설(프레임 모양·거절 응답) ③ 조기 진행의 `phaseEndsAt` 단축과 클라이언트 타이머·알람 ④ 첫날 분기 세 곳과 ended 경로 ⑤ D1 배선·`startedAt` ⑥ 기록 카드가 시민에게 안 보이는 구조.

</code_context>

<specifics>
## Specific Ideas

- 사용자: 카드 맨 위 `장르 : 영화`, 가운데 키워드를 크게, 마피아에게는 `???`, 아래 각주 `* 직접적인 키워드는 언급하면 안 됩니다.`
- 사용자: 답은 10초·20자, 마피아도 똑같이 검사해서 떠볼 수 있게, 철자를 틀린 우회는 매너에 맡김.
- 사용자: 개인 단계는 전원이 끝내면 자동으로 넘어가기, 공동 단계는 과반 끝내기. 단계 넘기기 단추는 만들지 않는다.

</specifics>

<deferred>
## Deferred Ideas

- 마피아 떠보기 횟수 제한·"막힌 횟수 공개"(판 기록에서 너무 자주 맞히면 검토)
- 4~5명 판의 "키워드 → 바로 밤"(첫날 처형 없음) 변형(마피아가 너무 일찍 잡힐 때)
- 시상·억울상(필요해지면)

</deferred>
