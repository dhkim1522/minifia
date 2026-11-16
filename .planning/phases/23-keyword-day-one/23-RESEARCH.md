# Phase 23: 첫날 키워드 문제와 D1 판 기록 - Research

**Researched:** 2026-11-17
**Domain:** 서버 권위 단계 두 개(`keyword`·`answerReveal`) 추가 + 누설 없는 비공개 입력(키워드 답) + 일찍 넘어가기(조기 마감) + Cloudflare D1 판 기록. 새 외부 패키지 없음.
**Confidence:** HIGH (코드 전부를 이 세션에 직접 열어 확인, D1 배선은 임시 시험으로 실제 실행). 단, 아래 "가정 로그"의 3건은 이 세션에서 실행하지 못했다.

> 이 문서는 `23-CONTEXT.md`(D-01~D-21)와 `23-UI-SPEC.md`(P23-1~29)를 **다시 조사하지 않고 그 위에** 쌓는다. 22페이즈가 끝난 현재 코드(단일 규칙 `RULES`, `pickTurn` 켜짐, 유언 단계)를 기준으로 확인했다. 계획자·실행자는 아래 "핵심 결론 8가지"와 "함정"부터 읽는다.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

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

### Claude's Discretion
- 계획 나누기와 순서(조사 권장: 콘텐츠·판정 순수 모듈 / D1 기반 병렬 → 서버 첫날 흐름 / 답 메시지 → 조기 진행 / view·누설 → 클라이언트 → 기록 카드·회귀), 키워드 초안의 구체 단어와 별칭, `ANSWER_MIN_GAP_MS`·`EARLY_GRACE_MS` 의 정확한 값은 계획자·실행자가 정한다.

### Deferred Ideas (OUT OF SCOPE)
- 마피아 떠보기 횟수 제한·"막힌 횟수 공개"(판 기록에서 너무 자주 맞히면 검토)
- 4~5명 판의 "키워드 → 바로 밤"(첫날 처형 없음) 변형(마피아가 너무 일찍 잡힐 때)
- 시상·억울상(필요해지면)

> 참고: D-01 의 "`keyword` 는 `DAY_PHASES` 에 넣지 않는다" 는 서버 `view.ts` 의 `DAY_PHASES`(= `view.day` 가 생기는 단계)와 충돌한다. `day.keyword.genre` 를 실으려면 `keyword`·`answerReveal` 을 `view.ts` 의 `DAY_PHASES` 에 넣어야 한다(아래 "핵심 결론 1·함정 3" 참고). `MAP_PHASES`(걷기·월드 프레임)와 `CHAT_PHASES`(채팅)에 대한 D-01 문장은 그대로 맞다.
</user_constraints>

<phase_requirements>
## Phase Requirements

요구사항 ID 가 없다(ROADMAP `**Requirements**: TBD`). ROADMAP "### Phase 23" 성공 기준 8개를 SC1~SC8 로 쓴다. `## Validation Architecture` 가 이 번호로 시험을 묶는다.

| ID | Description (ROADMAP 요약) | Research Support |
|----|---------------------------|------------------|
| SC1 | 첫날 역할 확인 뒤 키워드 카드(장르·큰 키워드/`???`·각주), 읽기 3초 뒤 10초·20자 답 | 단계 삽입(P1), view 모양(P2), 클라이언트 3초 잠금은 UI-SPEC P23-6 |
| SC2 | 키워드·별칭·공백/기호/대소문자/초성(3글자↑) 우회는 모두 막고 철자 틀린 우회는 통과 | `keywordGuard` 알고리즘(P3), 실행으로 확인한 표 |
| SC3 | 모두 내거나 시간 끝에 ①②③ 공개, 쓰던 글 제출, 답 없음 맨 끝, 봇 항상 답 없음 | `answer` 규칙(P2), 마감 훅 `closeKeyword` |
| SC4 | 첫날 처형 뒤 밤 직전 정답 공개, 첫날 답은 기록 카드에 남음, 둘째 날부터 키워드 없음 | 첫날 분기(P1), 기록 카드(P6) |
| SC5 | 장르 6~8 × 30↑ 키워드(별칭 포함) 한 파일, 한 글자 없음 | `keywords.ts` 스키마·불변식(P4) |
| SC6 | 판 끝에 D1 한 줄, npm 명령 하나로 조회, 닉네임·채팅·답 글 미저장 | D1(P7), 검증된 명령 |
| SC7 | 키워드가 마피아에게 어떤 응답 모양으로도 새지 않음 | 누설 설계(P2), 시험 설계(Validation) |
| SC8 | 개인 행동 단계 전원 완료 시 일찍 넘어감(찬반 1.5초), 밤 조기 마감 누설 없음 | 조기 진행(P5) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

`/Users/dhkim1522/personal/minifia/CLAUDE.md`, `/Users/dhkim1522/personal/CLAUDE.md` 에서 이 페이즈 계획이 지켜야 하는 것.

- 게임 규칙·판정은 서버(방 Durable Object)가 정한다. 클라이언트는 받은 상태를 보여 주고 행동만 보낸다(결정 0002). 금지어 판정·마감·조기 진행·순서 모두 서버. 클라이언트의 3초 잠금·400ms 무시는 **표시일 뿐**이다.
- 다른 사람의 역할은 서버가 살아 있는 사람에게 보내지 않는다. **키워드도 같은 취급**이다 — 화면에서 숨기는 것으로 대신하지 않고 마피아 view 에 키 자체를 만들지 않는다.
- **글 최소·보고 누르는 조작(결정 0051)**: 새 문구는 UI-SPEC 표의 것만. 사람을 부르는 말은 '참가자'.
- 새 결정은 `docs/decisions/` 에 다음 번호(`0091`)로 추가한다. 작업을 마칠 때마다 `HANDOFF.md` 를 갱신하고 push 한다(6KB 이하, 해결된 항목은 지운다).
- GSD 산출물과 응답은 한국어, 코드·명령·파일 이름·ID 는 원문.
- **원격 레포 위생**: 커밋·push 되는 모든 문서(이 RESEARCH.md 포함)는 상위 `/Users/dhkim1522/personal/CLAUDE.md` 의 "원격 레포 위생" 절을 따른다. 커밋 전에 그 절의 `git grep` 검사를 돌려 결과가 비어야 한다(검사 패턴 문자열을 문서에 옮겨 적지 않는다).
- 한 판 평균 10~15분은 참고 목표다. 연출을 줄이는 근거로 쓰지 않는다 → `answerReveal` 3초, 키워드 13초를 줄이지 않는다.
- E2E 는 바뀐 흐름만. 폰 6종 전체 회귀·배포는 24 끝에 한 번. 실기기 확인은 끝에 몰아서. 진행에 지장 없는 작은 화면 가장자리 문제는 고치지 않는다.
- 실행기 컨텍스트는 가볍게: 계획 문서는 "읽을 파일 목록 + 변경 규칙", 큰 문서 통째 읽기 금지. 이 문서의 표를 계획에 이월한다.
- 배포는 이 페이즈에 없다. D1 데이터베이스 생성도 없다(D-19).

## Summary

이 페이즈는 새 라이브러리 조사가 아니라 **(a) 새 `PhaseId` 두 개를 빠짐없이 꽂는 일, (b) 비공개 입력(키워드 답)을 will 선례대로 누설 없이 받는 일, (c) 마감 시각을 줄이는 조기 진행, (d) D1 한 줄 기록**이다. 위험은 새 기술이 아니라 **빠진 곳**이다: 컴파일러가 못 잡는 `Set`/`switch default`(예: `hostKeyOf` 는 모르는 단계를 조용히 `fallback` 으로, `RoomScreen.renderPhase` 는 `연결 중…` 으로 보낸다), 그리고 22페이즈에서 이미 굳은 `phaseEndsAt` 을 읽는 클라이언트·봇 계획 키.

**한 줄 기능 문 하나로 모든 것을 묶는다(핵심 설계 선택).** `RoomState.keyword === undefined` 이면 기능 전체가 꺼진다: `roleReveal` 마감 훅이 `keyword` 를 건너뛰어 `dayAnnounce` 로, 첫날 처형 뒤 분기도 `answerReveal` 을 건너뛰어 `night` 로 간다. 키워드는 `beginGame`(시작·다시 하기가 함께 쓰는 본체, 난수 인자 있음)이 정한다. 이 문 덕분에 (1) 배포 순간 진행 중이던 옛 저장 방이 안전하고, (2) 손으로 만든 `RoomState` 를 쓰는 단위 시험 대부분이 바뀌지 않고, (3) 옛 worker 시험은 `startedGame` 도우미가 `keyword` 키만 지워 옛 흐름 그대로 돈다.

**조기 진행은 `phaseEndsAt` 만 줄이는 순수 함수 `shrinkDeadline` + 워커 호출 세 곳**으로 충분하다. `reschedule()`·`nextWakeAt` 은 코드를 바꾸지 않고 그대로 새 마감을 읽는다. 단 "원래 마감"을 잃지 않으려면 서버 전용 `earlyFrom` 한 키가 필요하고, 봇 계획 키(`단계:마감`)가 바뀌는 부작용은 키를 같이 갈아 끼워 막는다.

**D1 은 검증을 끝냈다.** 바인딩에 `database_id` 가 없어도 `wrangler types`, `wrangler deploy --dry-run`, `vite build`, vitest(`readD1Migrations`+`applyD1Migrations`)가 모두 통과하고 `wrangler d1 execute DB --local --json` 도 동작한다(이 세션에서 실행). 위험은 `database_id` 없이 실제 `wrangler deploy` 를 하면 자동 생성이 일어날 수 있다는 점(문서 인용, 미실행)이라 `npm run deploy` 에 방어 한 겹을 권한다.

**Primary recommendation:** "키워드 키 유무 = 기능 스위치"로 단계 분기를 묶고, 순수 모듈(`keywords`·`keywordGuard`·`keywordAnswer`·`early`·`gameLog`)을 먼저 완성한 뒤 `worker/room.ts` 를 답 → 조기 진행 → D1 순으로 **한 번에 하나씩** 건드리고, 클라이언트는 서버 계약이 굳은 뒤에 붙인다. `worker/room.ts` 는 세 계획이 이어서 편집하므로 병렬로 돌리지 않는다.

## 핵심 결론 8가지 (계획자용 요약)

1. **PhaseId 삽입**: `roleReveal → keyword → dayAnnounce`, 첫날 `execution`/`afterDayOf` → `answerReveal` → `night`. 분기는 `routeAfterRoleReveal`(새 마감 훅)·`routeAfterExecution`·`afterDayOf(state)` 세 곳. 전수 목록은 P1.
2. **`afterDayOf()` 가 인자를 받아야 한다**: 지금은 `afterDayOf(): PhaseId`(인자 없음)이고 호출처 4곳(`verdict`·`nomination`·`runoff`·`showdown`)과 `test/unit/e2eContract.test.ts:813-819`, `scripts/e2e/lib.mjs:636` 주석이 이를 부른다.
3. **키워드 선택 위치 = `beginGame`**: tick 의 진입 훅은 `randInt` 를 받지만 기본값이 "던지는 NO_RANDOM"이라 난수 없이 `tick(...)` 을 부르는 기존 시험이 `keyword` 진입에서 터진다. `beginGame` 은 `assignRoles → decideMap` 뒤에 두 번(`장르`, `단어`) 더 부른다.
4. **`day` 는 키워드 단계에서 아직 `undefined`**: `enterDayAnnounce` 가 일차를 올리므로 `keyword` 는 `roleReveal` 처럼 `state.day === undefined`. `buildDay` 는 이미 `state.day ?? 1`, `captureHomeNow` 는 `day === undefined` 면 빠진다. 단 `view.day` 를 만들려면 `DAY_PHASES` 가입이 필요.
5. **`answer` 메시지는 will 의 쌍둥이**: 거절·초안·확정을 한 본체(`applyAnswer`)에서 처리, 간격은 **초안·확정을 따로** 센다(같이 세면 초안 직후 [보내기]가 조용히 버려진다).
6. **금지어 판정은 순수 함수 하나**: NFKC → `[^\p{L}\p{N}]` 제거 → 소문자 → 부분 포함 + 초성열 포함. 실행 확인한 결과표가 P3 에 있다.
7. **조기 진행은 마감만 줄이고 방송은 전원에게**: 키워드·밤은 지금까지 "본인에게만" 보냈으므로, 마감이 줄어드는 그 순간만 `persistAndBroadcast` 로 전원에게 보낸다(역할 무관 값). 번복 연장은 찬반만 문언대로, 밤·키워드는 연장 없이 한 번만 줄이기를 권한다(Q4).
8. **D1 은 `ctx.waitUntil`+`INSERT OR IGNORE`+실패 삼킴**: `afterTransition` 의 `emitResultLog` 옆, 순수 행 만들기 `buildGameRow(state, now)` 를 `shared/game/gameLog.ts` 에 두어 단위 시험한다.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 키워드 선택(난수)·보관 | API/Backend (`beginGame`) | — | 정답은 서버 전용(결정 0002). 시험에서는 `randInt` 주입 |
| 금지어 판정·거절 | API/Backend (`keywordGuard`, `submitAnswer`) | Browser(표시만) | 시민·마피아가 같은 응답을 받아야 하므로 서버 한 곳. 클라이언트는 20자소 자르기만 |
| 답 순서·"답 없음" 확정 | API/Backend (`closeKeyword` 마감 훅) | Browser(목록 그리기) | 낸 순서는 서버 도착 순서 |
| 일찍 넘어가기(마감 단축) | API/Backend (`shrinkDeadline`+`maybeAdvanceEarly`) | Browser(막대 미끄러짐·`data-early` 표시) | 마감은 서버 시각. 화면은 `phaseEndsAt` 변화를 읽을 뿐 |
| 키워드 카드·입력줄·3초 잠금·거절 알림 | Browser (`Keyword.tsx`, `useKeywordAnswer.ts`) | API(`me.answer` 복원) | UI-SPEC 계약. 잠금은 표시, 서버는 단계 안이면 받는다 |
| 모두의 답 시트·자동 열림 | Browser (`RoleCardSheet`, `RoomScreen`) | API(`day.keyword.answers` 공개 값) | 읽기 전용 공개 기록 |
| 정답 공개 큰 글 | Browser (`ResultAnnounce` `label`) | API(`day.keyword.answer`) | 3초 연출 |
| 판 기록 행 만들기 | API (`shared/game/gameLog.ts`) | — | 순수 함수, 닉네임·채팅·답 글을 읽지 않는다 |
| 판 기록 저장 | Database/Storage (D1 `games`) | API(`worker/gameLog.ts` 삽입) | 실패 격리, DO 와 분리된 저장소 |
| 판 기록 조회 | Tooling (`scripts/games.mjs`) | — | 개발자 명령, 게임 서버와 무관 |

## Standard Stack

새 외부 패키지를 설치하지 않는다. 기존 스택만 쓴다.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| wrangler | 4.151.3 | D1 마이그레이션·`d1 execute`·`types`·`deploy --dry-run` | [VERIFIED: package.json devDependencies `"wrangler": "4.151.3"`; 이 세션 `wrangler deploy --dry-run` 출력 "wrangler 4.151.3 (update available 4.163.0)"]. 올리지 않는다 |
| @cloudflare/vitest-plugin | 1.4.6 | worker 시험의 메모리 D1, `readD1Migrations`(노드 쪽)·`applyD1Migrations`(워커 쪽) | [VERIFIED: package.json `"@cloudflare/vitest-plugin": "1.4.6"`; `node_modules/@cloudflare/vitest-plugin/dist/pool/index.d.mts` 에 `declare function readD1Migrations(migrationsPathOrOptions: string \| ReadD1MigrationsOptions): Promise<D1Migration[]>;`, `types/cloudflare-test.d.ts` 에 `export function applyD1Migrations(db: D1Database, migrations: D1Migration[], migrationsTableName?: string): Promise<void>;`] |
| vitest | 4.1.12 | unit/client/worker 세 프로젝트 | [VERIFIED: 이 세션 `RUN  v4.1.12`] |
| zod | 4.6.7 | `answer` 메시지 `strictObject` | [VERIFIED: package.json `"zod": "4.6.7"`] |
| Node | v26.13.0 | 스크립트·`node --test` | [VERIFIED: `node --version`] |

### Supporting
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| `node:test` | 내장 | `scripts/*.test.mjs` (인자 가드·통계 출력) | `node --test scripts/games.test.mjs` — `deploy-target.test.mjs` 선례 |
| `scripts/e2e/run.mjs` | 저장소 | 로컬 E2E (시스템 Chrome + playwright-core) | `npm run e2e -- --url http://localhost:5173 --only <id>` |
| Chrome | 설치됨 | E2E | `/Applications/Google Chrome.app` [VERIFIED: `ls`] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 키워드를 `beginGame` 에서 선택 | tick `enter.keyword` 훅에서 선택 | 훅 인자 `randInt` 의 기본값이 던지는 함수라 난수 없이 `tick(...)` 을 부르는 시험이 깨진다. `beginGame` 이 안전 |
| `keyword===undefined` 스위치 | 모든 시험을 새 흐름으로 고치기 | 손 만든 `RoomState` 단위 시험 수십 개를 건드린다. 스위치가 diff 를 묶는다 |
| 판 id 를 `crypto.randomUUID()` | `code-round-startedAt` 조합 | 후자는 난수가 필요 없지만 방 코드가 기록에 남는다. UUID 를 워커에서 붙이는 쪽이 개인정보에 안전 |
| `wrangler d1 create --update-config` | 손으로 `database_id` 기입 | 자동 갱신은 주석 있는 `wrangler.jsonc` 를 다시 쓸 위험. 24 에서 손으로 |

**Installation:** 없음. `npm install` 이 계획에 들어가면 안 된다(들어가면 계획자가 `package-legitimacy check` 를 먼저 돌린다).

**Version verification:** 설치할 패키지가 없어 레지스트리 조회를 하지 않았다. 위 버전은 `package.json` 과 이 세션의 실행 출력에서 읽었다.

## Package Legitimacy Audit

이 페이즈는 외부 패키지를 설치하지 않는다 → 감사 대상 없음.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (없음) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
첫날 단계 흐름 (서버 tick, state.keyword !== undefined 일 때)

lobby ─start/rematch→ beginGame(now, randInt)
                        ├ assignRoles → decideMap → pickKeyword(randInt×2)   ← 키워드·장르·startedAt 저장(서버 전용)
                        ▼
assigning(3s) → roleReveal(15s) ──deadline hook routeAfterRoleReveal──┐ keyword 없으면 곧장 dayAnnounce
                                                                       ▼
      keyword(13s = 읽기3 + 쓰기10)  ◄── answer{text,final} (본인에게만 state) ── shrinkDeadline(사람 전원 확정 → +1.5s)
        │ deadline hook closeKeyword: 초안→답/없음, 순서 부여, day.keyword.answers 공개
        ▼
dayAnnounce(2s, day=1) → discussion(90s; 시트 자동 열림은 클라이언트) → verdict(10s ◄ shrinkDeadline) → nomination → defense(유언) → execution(6.6s)
        │                              │ 부결/동점/0표: afterDayOf(state) → answerReveal(day1) | night(day≥2)
        └──────────── routeAfterExecution: 승패면 ended │ day1이면 answerReveal │ 아니면 night
                                        ▼
                         answerReveal(3s, 정답 day.keyword.answer 공개) → night(30s ◄ shrinkDeadline) → morning → dayAnnounce(day2: 키워드 없음)

ended 진입 전환 1회: afterTransition → emitResultLog + recordGame(ctx.waitUntil → D1 INSERT OR IGNORE, 실패 삼킴)
```

### Recommended Project Structure

```
shared/game/
├── keywords.ts        # 새: GENRES·KeywordEntry·pickKeyword·keywordEntryOf·genreLabelOf (서버·시험 전용, src 에서 import 금지)
├── keywordGuard.ts    # 새: normalizeForGuard·choseongOf·violatesKeyword (순수)
├── answerRules.ts     # 새: ANSWER_MAX_GRAPHEMES·ANSWER_MIN_GAP_MS (상수만 — 클라이언트가 import 해도 되는 가벼운 파일)
├── keywordAnswer.ts   # 새: submitAnswer·closeKeyword·routeAfterRoleReveal·answerOpenOf·firstDayAnswerPending·allHumansAnswered
├── early.ts           # 새: EARLY_GRACE_MS·earlyReady·shrinkDeadline
├── gameLog.ts         # 새: buildGameRow (D1 행, 순수)
├── phases.ts          # 수정: keyword·answerReveal 행, KEYWORD_* 상수, afterDayOf(state)
├── tick.ts            # 수정: 훅 표에 roleReveal·keyword 마감 훅
├── endgame.ts         # 수정: routeAfterExecution
├── view.ts            # 수정: DAY_PHASES, buildDay(keyword), me.keyword·me.answer
├── room.ts            # 수정: RoomState·Player 새 선택 키, beginGame
worker/
├── room.ts            # 수정: handleAnswer·applyAnswer, applyPick/applyVerdict 조기 진행, afterTransition 의 recordGame
└── gameLog.ts         # 새: insertGame(db, row) — prepare/bind/run
migrations/0001_games.sql
scripts/games.mjs · scripts/games.test.mjs
src/screens/Keyword.tsx · src/net/useKeywordAnswer.ts   # UI-SPEC
```

### P1. PhaseId 삽입과 가입 전수 목록 (조사 1)

**서버 삽입 규칙 (모두 `state.keyword !== undefined` 일 때만):**
```ts
// shared/game/phases.ts — 현재(읽은 원문) [VERIFIED: phases.ts:72,75-76,85,96-99]
//   roleReveal: Object.freeze({ durationMs: ROLE_REVEAL_MS, next: "dayAnnounce", revealsOwnRole: true }),
//   execution: Object.freeze({ durationMs: EXECUTION_MS, next: "night", revealsOwnRole: true }),
//   export function afterDayOf(): PhaseId { return "night"; }
// 변경: roleReveal.next = "keyword"; 새 행 keyword{KEYWORD_MS,"dayAnnounce",true}, answerReveal{ANSWER_REVEAL_MS,"night",true}
// afterDayOf(state: { day?: number; keyword?: unknown }): PhaseId  → (state.keyword !== undefined && (state.day ?? 1) === 1) ? "answerReveal" : "night"
```
`execution.next` 는 표에서 `"night"` 그대로 둔다(둘째 날 이후가 쓴다). 첫날만 마감 훅이 `next` 를 덮는다: `routeAfterExecution`([VERIFIED: endgame.ts `routeByWinner`] 승패면 `{ next: "ended" }`, 아니면 `{ state, stay: false }`)에 `else if (firstDayAnswerPending(state)) return { state, stay:false, next:"answerReveal" }` 를 더한다. D-02 의 "`execution.next` 와 `afterDayOf()` 두 곳"은 표를 바꾸라는 뜻이 아니라 **이 두 분기**다.

`roleReveal` 은 지금 마감 훅이 없다. 새 훅 `routeAfterRoleReveal(state) = state.keyword === undefined ? { state, stay:false, next:"dayAnnounce" } : { state, stay:false }` 를 `HOOKS.deadline.roleReveal` 에, `closeKeyword` 를 `HOOKS.deadline.keyword` 에 건다. [VERIFIED: tick.ts:81-92 현재 deadline 표 — `showdown, nomination, runoff, verdict, execution, morning`].

**가입이 필요한 전수 목록** (grep 으로 확인한 결과. ✓ = 컴파일러가 잡음, ✗ = 컴파일러가 못 잡음 → 빠뜨리면 조용히 어긋남):

| # | 위치 | 가입 값 | 잡힘 |
|---|------|---------|------|
| 1 | `shared/protocol.ts:30-33` `PhaseId` 유니온 | `"keyword"`, `"answerReveal"` 추가 | — |
| 2 | `shared/game/phases.ts:69` `PHASE_DEFS: Record<PhaseId,…>` | 두 행 | ✓ |
| 3 | `shared/game/view.ts:48` `DAY_PHASES`(`Set`) | `keyword`, `answerReveal` ( `view.day` 가 생기는 단계 — `day.keyword` 를 싣기 위해) | ✗ |
| 4 | `shared/game/movement.ts:13` `MAP_PHASES` | `answerReveal` 만 (맵 위 연출·월드 프레임·`captureHome`·`saveWill` 단계 통과). `keyword` 는 넣지 않는다(D-01) | ✗ |
| 5 | `shared/game/audience.ts:21` `CHAT_PHASES` | **넣지 않는다**(둘 다). 정답 공개는 22 의 `defense` 처럼 서버가 채팅을 받지 않는다(UI-SPEC P23-21 `data-chat-locked`) | ✗ |
| 6 | `shared/game/audience.ts:99` `worldVisibleTo` 의 `lobby \|\| assigning \|\| roleReveal` | `keyword` 추가. **빠뜨리면 키워드 중 재접속한 폰의 3D 무대가 빈다**(PreGame 무대가 월드 snap 을 읽는다) | ✗ |
| 7 | `shared/game/badge.ts:11` `BADGE_PHASES`, `shared/game/whisper.ts:16` `WHISPER_PHASES` | 넣지 않는다(확인만) | — |
| 8 | `shared/game/gather.ts:140` `layoutKey` | 두 단계 모두 `null`(기본) — 배치 없음. 코드 변경 없음, 시험의 단계 배열에만 추가(`test/unit/gather.test.ts:243,544`) | — |
| 9 | `src/world/presence.ts:99` `FIXED_PHASES` | `answerReveal` 추가(P23-21 카메라 고정). `lightingOf`(`:?`)는 `answerReveal → "vote"` 한 줄 추가 | ✗ |
| 10 | `src/audio/director.ts:25` `BED_OF: Record<PhaseId,…>` | `keyword: "bed.reveal"`, `answerReveal: "bed.vote"` | ✓ |
| 11 | `src/audio/director.ts:43` `ENTER_SOUND: Partial<Record>` | `keyword: "ui.card"`, `answerReveal: "ui.card"` ("ui.card" 은 `recipes.ts:128` SOUND_IDS 에 있음) | ✗ |
| 12 | `src/audio/director.ts:52` `TICK_PHASES` | **넣지 않는다**(확인만, UI-SPEC P23-26). 시험 `soundDirector.test.ts:224` 는 그대로 | — |
| 13 | `src/game/scenes.ts:35` `PHASE_SCENE: Record` | `keyword: "lobby"`, `answerReveal: "dusk"` (`scripts/e2e/lib.mjs:1136` `EXPECTED_SCENE` 사본도 같이, `test/unit/scenes.test.ts` 가 대조) | ✓ |
| 14 | `src/game/scenes.ts:58` `TIMELESS_PHASES` | 넣지 않는다(두 단계 모두 시간이 있다) | — |
| 15 | `src/game/hostLine.ts:135` `HOST_HIDDEN_PHASES` | `ended` 는 조건부로 바뀐다(P23-22). `hostKeyOf` 의 `switch` 는 `default: return "fallback"` — **`keyword`·`answerReveal` case 를 직접 더해야 한다** | ✗ |
| 16 | `src/game/hostLine.ts` `HostKey`·`HOST_LINES: Record<HostKey,string>` | `keyword.act`·`keyword.wait`·`answerReveal`·`ended.answer` 키와 문구(UI-SPEC "사회자 문구 표") | ✓ |
| 17 | `src/game/dayView.ts:34` `titles: Partial<Record<PhaseId,string>>` | `keyword: "키워드"`, `answerReveal: "정답"` | ✗ |
| 18 | `src/screens/RoomScreen.tsx:56` `PHASE_ANNOUNCE: Record` | `keyword: () => "첫날 키워드 문제"`, `answerReveal: () => "정답 공개"` | ✓ |
| 19 | `src/screens/RoomScreen.tsx:116` `sceneKey` (`default: return phase`) | `keyword → "preGame"`, `answerReveal → "gameMap"`. **빠뜨리면 키워드 진입마다 3D 맵을 다시 만든다** | ✗ |
| 20 | `src/screens/RoomScreen.tsx` `renderPhase` (`default: return connecting()`) | `keyword` 는 `PreGame` 안 `Keyword`, `answerReveal` 은 `GameMap` 그룹 | ✗ |
| 21 | `src/components/TestTools.tsx:21` `TEST_PHASE_LABEL: Record` | `keyword: "키워드"`, `answerReveal: "정답 공개"` | ✓ |
| 22 | `src/game/timeOfDay.ts` (`lightingOf` 로 계산) | 변경 없음. `test/unit/timeOfDay.test.ts:8` `EXPECT: Record<PhaseId,TimeOfDay>` 에 두 값 추가 | ✓(시험) |
| 23 | `scripts/smoke.mjs:102-114` `PHASE_NEXT`·`DAY_PHASES`, `scripts/e2e/lib.mjs:640` `PHASE_GRAPH`, `:1136` `EXPECTED_SCENE`, `scripts/e2e/polish.mjs:50` `TOD_ABSENT_PHASES`(`keyword` 는 시간대 낱말이 없다 → 추가)·`TOD_BY_PHASE`(`answerReveal`: `dusk`), `scripts/e2e/host.mjs:42` `BAND_REQUIRED` | 단계 이름 추가. `lib.test.mjs:639`·`polish.test.mjs:59-61` 기대값 갱신 | ✗ |
| 24 | `scripts/uat-test-room.mjs:176-250` 의 "e. 단계를 거듭 넘기기" | **22 에서 이미 낡았다**(`discussion → nomination` 순서, 새 순서는 `discussion → verdict`). `keyword`·`answerReveal` 뿐 아니라 흐름 자체를 다시 쓴다(24 배포 검증 때 쓰는 스크립트라 23 에서 고치는 것을 권한다) | ✗ |
| 25 | 시험의 단계 배열 | `test/unit/view.test.ts:27,293`(`PHASES`·`DAY_VIEW_PHASES`), `emotePhases.test.ts:15`(`KIND` — 둘 다 `"silent"`), `e2eContract.test.ts:927`(`ALL_PHASES`), `badgeView.test.ts:76`, `whisperView.test.ts:44`, `hostLine.test.ts:430`(`MATRIX_PHASES`), `soundDirector.test.ts:13`(`PHASES`), `testTools.test.ts:72`(`SKIPPABLE`), `test/worker/bots.test.ts:853`(`allowed`), `test/client/phaseScreens.test.tsx:393`(`Record<PhaseId,true>`), `test/unit/nyquist-02-phase-matrix.test.ts:20`(`Object.keys(PHASE_DEFS)` 로 파생) | 컴파일러/키 비교가 알려 주는 것도 있고 아닌 것도 있다 |

grep 재현: `git grep -nE 'Set<PhaseId>|ReadonlySet<PhaseId>|PhaseId\[\]|Record<PhaseId' -- shared worker src scripts test` 과 `git grep -n '"roleReveal"' -- shared worker src scripts`.

**기존 시험 보호(스위치)**: 위 25번의 worker 시험은 대부분 `startedGame()`/`advanceTo()` 를 쓴다. `advanceTo` 는 "저장된 단계가 목표가 될 때까지 `forceDue`+알람을 반복"([VERIFIED: helpers.ts:239-248])이라 새 단계를 자동으로 지난다. 그러나 `expect(phase).toBe("night")` 을 **알람 한 번 뒤에** 단언하는 시험(`test/worker/basicDay.test.ts:81,100,109`, `trial.test.ts:582-667`, `runoff.test.ts:90-102`, `showdown.test.ts:131`, `leak.test.ts:549,564`, `night.test.ts:308`)은 첫날에 `answerReveal` 이 끼면 깨진다. `startedGame` 이 `assigning` 직후 저장된 방에서 `keyword` 키만 지우도록(옵션 `{ keyword: true }` 로 켬) 하면 옛 시험이 옛 흐름 그대로 돈다. 새 흐름은 전용 시험이 맡는다.

### P2. `answer` 메시지·view·누설 (조사 2)

**스키마·타입** (will 의 쌍둥이. 원본 [VERIFIED: schemas.ts:50-55]):
```ts
// 원문: export const WillMessageSchema = z.strictObject({
//   t: z.literal("will"),
//   text: z.string().max(CHAT_TEXT_MAX_UTF16),
//   final: z.literal(true).optional(),
// }) satisfies z.ZodType<WillSendMessage>;
export const AnswerMessageSchema = z.strictObject({
  t: z.literal("answer"),
  text: z.string().max(CHAT_TEXT_MAX_UTF16),   // CHAT_TEXT_MAX_UTF16 = 300 [VERIFIED: protocol.ts:415]
  final: z.boolean(),                          // 필수 — will 의 optional literal 과 달리 초안(false)도 명시
}) satisfies z.ZodType<AnswerSendMessage>;
// ClientMessageSchema(discriminatedUnion "t") 와 protocol.ts 의 ClientMessage 유니온에 둘 다 더한다.
```
프레임 상한은 `MAX_FRAME_BYTES = 1024`([VERIFIED: protocol.ts:22]) 안이다(300 UTF-16 ≤ 1024B). `webSocketMessage` 의 `switch` 는 `default: const unhandled: never = msg` 라 case 를 빠뜨리면 **컴파일이 실패**한다([VERIFIED: room.ts:364-369]).

**서버 규칙 `submitAnswer(state, actorId, text, final)`** (순수, `keywordAnswer.ts`) — 검사 순서가 계약:
1. `state.phase !== "keyword"` → `WRONG_PHASE`
2. 방에 없거나 죽었거나 봇(`isBot`) → `BAD_MESSAGE` (will 의 `saveWill` 와 같은 모양)
3. 이미 확정 제출함(`answerSubmits` 에 내 좌석 있음) → `{ ok: true, state }`(같은 객체, 조용히 무변화)
4. 본문 정리: `sanitizeChatText`([VERIFIED: chatRules.ts:36-43] NFC·금지 문자→공백·공백 접기) 뒤 `countGraphemes ≤ ANSWER_MAX_GRAPHEMES(20)`. 공백뿐이면 "비움". 실패 → `BAD_MESSAGE`
5. `final:false` → 초안 저장(비움이면 키째 삭제, 같은 값이면 같은 객체). **금지어 검사 없음**
6. `final:true` + 비움 → `BAD_MESSAGE`(빈 확정 불가, P23-12)
7. `final:true` + `violatesKeyword(text, entry)` → `{ ok:false, error:"BAD_MESSAGE", state? }` — 보낸 사람이 **마피아이고 `keywordProbed` 가 아직 아니면** 같은 반환에 `state: { ...state, keywordProbed: true }` 를 실어 워커가 저장하게 한다. 시민·이미 켜진 경우는 `state` 를 싣지 않는다(응답은 어느 쪽이든 같다).
8. 통과 → `answerSubmits` 끝에 `{ seat, text }` 추가(**낸 순서가 곧 배열 순서**), 그 사람의 `answerDraft` 삭제.

**워커 본체 `applyAnswer`** — `applyWill`([VERIFIED: room.ts:719-742])을 따른다. 다른 점 셋:
- 간격 키를 `answerD:{id}`(초안)와 `answerF:{id}`(확정) **둘로 나눈다**. will 은 [남기기]만 간격을 우회했지만, answer 는 "초안 직후 [보내기]" 가 자연스러운 흐름(입력 600ms 뒤 초안 → 곧 확정)이라 한 키로 세면 확정이 조용히 버려진다. 간격 안의 요청은 will 처럼 `return null`(오류 프레임 없음).
- 간격은 **수락·거절 모두** 기록한다(will 은 수락만). 그래야 마피아 떠보기가 400ms 당 1회로 제한된다(10초에 최대 약 25회). 메시지 속도 제한(`RATE_MAX_MESSAGES = 20/초`)은 별개로 그대로.
- 거절에 `state`(플래그)가 딸려 오면 `this.room = r.state; await this.ctx.storage.put("room", this.room)` 한 번만 한 뒤 오류를 돌려준다. `handleAnswer` 가 `sendRejection`(오류 + 그 소켓에 state) 으로 응답 — 시민이든 마피아든 **같은 두 프레임**이다.

수락되면 `persistAndBroadcast` 를 부르지 않는다. 저장 + `sendViewTo([playerId])`(본인에게만). 예외는 조기 진행(P5)으로 마감이 줄어들 때만 전원 방송.

**state·view 키**(이름은 `SERVER_ONLY_KEYS` 와 겹치지 않게):

| 위치 | 키 | 값 | 서버 전용? | 누가 받나 |
|------|----|----|-----------|-----------|
| `RoomState` | `keyword` | `{ genre: string(id), word: string }` | ✓ (**키 이름이 view 키 `day.keyword`·`me.keyword` 와 같아 `SERVER_ONLY_KEYS` 이름 검사에 넣을 수 없다** — 값 기반 검사로 지킨다) | 아무에게도 직접 안 감 |
| `RoomState` | `keywordProbed` | `true` | ✓ | 없음 |
| `RoomState` | `answerSubmits` | `Array<{seat, text}>` (제출 순서) | ✓ (마감 훅이 키째 지움) | 없음 |
| `RoomState` | `keywordAnswers` | `Array<{order, seat, text: string \| null}>` | 마감 뒤 **공개** | `day.keyword.answers` (모두) |
| `RoomState` | `startedAt`, `gameId` | 숫자, 문자열 | ✓ | 없음 (D1 전용) |
| `RoomState` | `earlyFrom` | `{ phase, day, endsAt }` | ✓ | 없음 (P5) |
| `Player` | `answerDraft` | 문자열 | ✓ | 본인 `me.answer` |
| `DayView` | `keyword` | `{ genre: string(라벨), answers?, answer? }` | 공개 | 모두, 같은 모양 |
| `MyInfo` | `keyword` | 문자열 | — | **시민 편(마피아 아님)·산 사람·`keyword` 단계에서만**, 마피아에게는 키 자체 없음 |
| `MyInfo` | `answer` | `{ text: string, final: boolean }` | — | 본인·`keyword` 단계에서만(재접속 복원). 값이 있을 때만 키 |

- `day.keyword.genre` 는 **라벨**("영화")을 싣는다(id 가 아니라). 그래야 클라이언트가 `keywords.ts` 를 import 하지 않는다.
- `me.keyword` 를 키워드 단계에 **한정**하는 것을 권한다(UI-SPEC 카드는 그 단계에만 있다). 이후 단계에는 시민에게도 안 보내 표면을 줄인다.
- **`genre` 는 첫날 이후에도 남긴다**: D-14 문장은 "둘째 날부터 `answers` 와 `answer` 만" 이라 하지만 UI-SPEC P23-18 의 구역 머리가 `장르 : {장르}` 를 읽는다. 공개 값이고 누설이 없으니 `genre` 도 계속 싣는다(Q2).
- `answers` 는 `keyword` 단계가 **끝난 뒤**(`phase !== "keyword"`)에만. `answer`(정답)는 `answerOpenOf(state)` 가 참일 때만: `phase === "ended"` 이거나, 일차 ≥ 2 이거나, 일차 1 의 `answerReveal`·`night`·`morning`. 마피아 view 에 정답이 처음 닿는 프레임은 `answerReveal` 진입 프레임이다.

**서버 전용 이름 가입 위치(빠뜨리면 감시선이 비는 곳)**: `test/worker/leak.test.ts:116` `SERVER_ONLY_KEYS`, `test/unit/view.test.ts:283` `SERVER_ONLY_KEYS`, `scripts/smoke.mjs:127` `SERVER_ONLY_KEYS` 에 `keywordProbed`·`answerSubmits`·`answerDraft`·`startedAt`·`gameId`·`earlyFrom` 추가. 공개 키 허용 목록: `test/unit/view.test.ts` 의 `ME_KEYS`(`keyword`,`answer`)·`DAY_KEYS`(`keyword`), `scripts/e2e/lib.mjs:3123-3124` `VIEW_ME_KEYS`·`VIEW_DAY_KEYS`(`test/unit/e2eContract.test.ts:734` 가 두 집합을 대조), `test/worker/leak.test.ts` 의 경로 허용 집합에 `.view.me.keyword`·`.view.me.answer`·`.view.day.keyword.*`(받을 권리 조건과 이유를 주석으로). `ALLOWED_WIRE_PATHS`([VERIFIED: leak.test.ts:123] `new Set([".view.me.verdictVote", ".view.day.execution.will"])`)는 **서버 전용 이름과 겹치는 공개 경로**만 담는 집합이라, `keyword` 를 `SERVER_ONLY_KEYS` 에 넣지 않으면 여기에 넣을 필요가 없다 — 대신 경로 집합 검사(`FIFTEEN_PATHS` 같은 접두 목록, leak.test.ts:~156)에 새 접두를 더한다.

**누설 시험 설계**(Validation 참고): ① 한 판을 돌리며 마피아 소켓마다 `collect(sock)` 의 **정답 단계 이전 프레임** 연결 문자열에 `keyword.word`·별칭이 없음(시험이 `storedRoom(code)` 에서 단어를 읽는다), ② 비인증 `GET /api/rooms/:code`(`buildPreview`)에도 없음, ③ 키워드 단계의 `view.day.keyword` 키 집합이 모든 소켓에서 같음, ④ `view.me` 키 집합이 마피아·시민 사이에서 `keyword` 한 키만 다름, ⑤ 금지어 final 거절 시 시민·마피아가 받는 프레임 열이 같음(`summary()` 가 `[error:BAD_MESSAGE,state:keyword]`), ⑥ 메타모픽: 역할만 다른 두 판(`testRole`)의 `day.keyword` 열 동일.

### P3. `keywordGuard` 알고리즘 (조사 3)

```ts
// shared/game/keywordGuard.ts — 순수. 이 세션에서 Node 로 실행해 아래 표를 확인했다.
const norm = (s: string): string => s.normalize("NFKC").replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
const SYLLABLE_BASE = 0xac00, SYLLABLE_COUNT = 11172, CHOSEONG_BASE = 0x1100;
const choseongOf = (s: string): string => {          // 완성형 음절 → 조합형 초성 자모(U+1100..1112), 그 밖은 그대로
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    out += c >= SYLLABLE_BASE && c < SYLLABLE_BASE + SYLLABLE_COUNT ? String.fromCodePoint(CHOSEONG_BASE + Math.floor((c - SYLLABLE_BASE) / 588)) : ch;
  }
  return out;
};
const allSyllables = (s: string): boolean => [...s].every((ch) => { const c = ch.codePointAt(0)!; return c >= SYLLABLE_BASE && c < SYLLABLE_BASE + SYLLABLE_COUNT; });
// 방의 키워드 하나의 금지 형태: [word, ...aliases].map(norm) (길이 ≥2 인 것만), 초성열 = 음절만으로 된 형태 중 길이 ≥3 인 것의 choseongOf(norm(...))
export function violatesKeyword(answer: string, entry: { word: string; aliases: readonly string[] }): boolean {
  const n = norm(answer);
  const forms = [entry.word, ...entry.aliases].map(norm);
  if (forms.some((f) => f.length >= 2 && n.includes(f))) return true;
  const answerCho = choseongOf(n);
  return forms.some((f) => f.length >= 3 && allSyllables(f) && answerCho.includes(choseongOf(f)));
}
```
- **검사 대상은 방의 키워드 하나**(전체 목록이 아니다). 비용은 무시할 수 있다.
- **NFD 는 NFKC 가 이미 합친다**: `"해리포터".normalize("NFD")` 입력 → 막힘(실행 확인). 호환 자모 `ㅎㅐㄹㅣㅍㅗㅌㅓ` 도 NFKC 가 음절로 합쳐 `norm` 단계에서 막힌다(실행 확인: 정규화 뒤 `해리` 2글자). 따로 NFC 변환을 둘 필요가 없다(D-08 의 "NFD → NFC" 는 NFKC 에 포함).
- `\p{L}` 이 아닌 결합 부호·서식 문자(ZWJ·U+200B 등)·이모지·구두점은 지워진다.

**실행 확인한 표** (키워드 `해리포터`, 별칭 `Harry Potter·해리·해포·potter·harry·포터`; `[VERIFIED: 이 세션 node 실행]`):

| 입력 | 결과 | 이유 |
|------|------|------|
| `해.리.포.터` | 막힘 | 기호 제거 후 `해리포터` |
| `Harry_Potter` / `HARRY POTTER` / `ｈａｒｒｙ`(전각) | 막힘 | NFKC·소문자·기호 제거 |
| `해리potter` | 막힘 | 별칭 `potter`(또는 `해리`) 부분 포함 — **혼합 표기 방어는 별칭 목록이 한다** |
| `ㅎㄹㅍㅌ` / `ㅎ ㄹ ㅍ ㅌ` | 막힘(초성) | 초성열 `ᄒᄅᄑᄐ` 포함 |
| `hery foter` | **통과** | 정규화 `heryfoter` 가 `harrypotter` 의 부분 문자열이 아님 |
| `해리 포 터`, `해-리-포-터`, `해(U+200B)리포터` | 막힘 | 공백·기호·영폭 공백 제거 |
| `해리포터를 좋아해요` | 막힘 | 부분 포함 |
| `마법사 안경 소년` | 통과 | |
| `ㅎㄹ`, `ㅎㄹㅍ` | 통과 | 초성열이 3글자 이상 키워드의 전체 초성열(`ㅎㄹㅍㅌ`)보다 짧다 |
| `a해b리c포d터` | **통과** | 글자(라틴)가 끼면 이어지지 않는다 — "철자를 일부러 틀린 우회는 막지 않는다"(매너) 범위 |

**알려진 한계(시험은 문서화하지 말고 `통과`로 고정하지 말 것)**: 3글자 키워드의 초성열은 흔한 단어와 우연히 겹칠 수 있다(예: `고양이` ㄱㅇㅇ 가 `가을이` 에도 들어 있다). D-08 문언대로라 막는 것이 맞지만, 시민이 이유 없이 거절당할 수 있다는 점을 0091 결정 기록의 "알려진 한계"에 한 줄 적는다.

**시험 목록** (`test/unit/keywordGuard.test.ts`): 위 표 전부 + ① 키워드·모든 별칭 자기 자신은 막힘, ② 별칭만 단독(`Potter`) 막힘, ③ 숫자 키워드(`007`) 처리, ④ 2글자 키워드(`사과`)는 초성 검사를 하지 않음, ⑤ 영어 전용 키워드(`BTS`)는 초성 검사 없음·소문자 일치, ⑥ 길이 1 형태는 무시(별칭 `a` 같은 것이 모든 답을 막지 않음 — 데이터 불변식과 이중 방어), ⑦ 빈 문자열·기호뿐 답은 막히지 않음(다른 규칙이 거른다), ⑧ NFD 입력, ⑨ `String.normalize` 가 길이를 바꾸는 입력(`ﬁ`)에서도 오류 없음.

### P4. 키워드 데이터 `shared/game/keywords.ts` (조사 4)

```ts
// 초안, 사용자 검토 대기(0089-23). 이 파일 하나가 키워드의 원천이다.
export interface KeywordEntry { word: string; aliases: readonly string[] }   // aliases: 한국어 변형·영어·짧은 이름(반쪽)
export interface Genre { id: string; label: string; words: readonly KeywordEntry[] }
export const GENRES: readonly Genre[] = [ /* 6~8개 */
  { id: "movie", label: "영화", words: [
    { word: "해리포터", aliases: ["Harry Potter", "해리", "해포", "potter", "harry", "포터"] },
    { word: "겨울왕국", aliases: ["Frozen", "엘사", "안나"] },
    /* … ≥30 */ ] },
];
export function pickKeyword(randInt: (n: number) => number): { genre: string; word: string } {
  const g = GENRES[randInt(GENRES.length)]!;
  return { genre: g.id, word: g.words[randInt(g.words.length)]!.word };   // 균등 선택, 반복 방지 없음
}
export const keywordEntryOf = (genre: string, word: string): KeywordEntry | undefined => GENRES.find((g) => g.id === genre)?.words.find((w) => w.word === word);
export const genreLabelOf = (genre: string): string | undefined => GENRES.find((g) => g.id === genre)?.label;
```
- 상태에는 `{ genre: id, word }` 만 저장하고 별칭은 `keywordEntryOf` 로 찾는다(목록이 바뀌어도 옛 방은 `keywordEntryOf` 가 `undefined` 면 금지어 검사를 단어 하나로 대체).
- **선택 난수**: `pickKeyword` 는 `beginGame` 의 `decideMap` **뒤**에 `randInt` 를 두 번 부른다. 그래서 같은 시드로 역할·맵을 고정하는 기존 시험은 그대로다(추가 호출은 맨 끝).
- **클라이언트 번들에 넣지 않는다**: `keywords.ts`·`keywordGuard.ts`·`keywordAnswer.ts` 는 `src/` 가 import 하지 않는다. 클라이언트가 필요한 상수는 `phases.ts`(`KEYWORD_*`)와 `answerRules.ts`(`ANSWER_*`)에 둔다. `hostLine.ts` 가 `shared/game/room.ts` 의 `connectedCount`(값)를 import 하므로 `room.ts` 가 `keywords.ts` 를 import 하면 트리 셰이킹에 기대게 된다 — **정적 가드 시험**(`src/**` 가 `keyword(s|Guard|Answer)` 를 import 하지 않음)과 빌드 확인 명령(`npm run build && ! grep -l "<표본 키워드>" dist/client/assets/*.js`)을 계획의 검증에 넣는다(`dayStaticGuard.test.ts` 의 `stripComments`·`foundIdentifiers` 선례).
- 목록은 공개 저장소에 올라가므로 "단어 목록이 비밀"이라는 가정은 쓰지 않는다. 비밀은 **이번 판의 선택**뿐이다.

**불량 입력 불변식** (`test/unit/keywords.test.ts`, SC5·UI-SPEC P23-27):
1. `6 ≤ GENRES.length ≤ 8`, 장르마다 `words.length ≥ 30`, 장르 `id`·`label` 각각 유일, `label` 비어 있지 않음(카드 한 줄이므로 6자소 이하 권장).
2. 모든 `word` 의 자소 수 `2 ≤ n ≤ 12`(한 글자 금지, 카드 2줄·띠 19자 보장), `norm(word).length ≥ 2`.
3. 모든 `norm(word)` 가 전체 목록에서 유일(장르를 넘어), 별칭은 `norm` 이 비어 있지 않고 길이 ≥ 2, 자기 `word` 와 같지 않고 같은 항목 안에서 유일, 다른 항목의 `norm(word)` 와 같지 않다("정규화 충돌 없음").
4. 별칭·단어·장르 라벨에 `mafia|police|doctor|citizen|role|none`(대소문자 무시) 부분 문자열 없음 — 누설 시험·E2E 가 프레임 원문을 이 정규식으로 훑는다([VERIFIED: scripts/uat-test-room.mjs:43 `const ROLE_WORDS = /mafia|police|doctor|citizen/;`, test/worker/emoteLeak.test.ts:26 `/mafia|police|doctor|citizen|role/i`]). 한국어 역할 단어(`마피아`·`시민`·`경찰`·`의사`)가 단어·별칭 전체가 되는 것도 금지(`test/unit/dayView.test.ts:150`).
5. 자기 검사: 모든 형태(단어·별칭)와 그 공백 삽입·대문자·`.` 삽입 변형이 `violatesKeyword` 로 막힌다.
6. `pickKeyword`: 시드 고정 난수에서 `(genre, word)` 가 `keywordEntryOf` 로 조회된다.

### P5. 일찍 넘어가기 `maybeAdvanceEarly` (조사 5)

**순수 `shared/game/early.ts`:**
```ts
export const EARLY_GRACE_MS = 1_500;   // 0089-26
/** 지금 단계의 "개인 행동"이 모두 끝났는가. 연결 여부는 보지 않는다(D-12: 끊긴 사람은 못 고르므로 자연히 거짓). */
export function earlyReady(state: RoomState): boolean {
  const alive = state.players.filter(isAlive);
  switch (state.phase) {
    case "keyword": return alive.filter((p) => !isBot(p)).every((p) => state.answerSubmits?.some((s) => s.seat === p.seat) === true); // 봇 제외, 사람 0명이면 false 로 둘 것
    case "verdict": return alive.every((p) => p.verdictVote !== undefined);
    case "night":   return alive.every((p) => p.nightPick !== undefined);
    default: return false;
  }
}
export function shrinkDeadline(state: RoomState, now: number, opts: { extend?: boolean } = {}): RoomState {
  if (state.phaseEndsAt === null || !earlyReady(state)) return state;
  const key = { phase: state.phase, day: state.day ?? 0 };
  const from = state.earlyFrom && state.earlyFrom.phase === key.phase && state.earlyFrom.day === key.day ? state.earlyFrom : undefined;
  if (from !== undefined && opts.extend === false) return state;                        // 한 번 줄였으면 더 건드리지 않는다(밤·키워드)
  const origin = from?.endsAt ?? state.phaseEndsAt;                                      // 원래 마감
  const target = Math.min(origin, now + EARLY_GRACE_MS);
  if (target === state.phaseEndsAt) return state;
  const next = { ...state, phaseEndsAt: target, earlyFrom: { ...key, endsAt: origin } };
  return next.botPlan === undefined ? next : { ...next, botPlan: { ...next.botPlan, key: botPlanKey(next) ?? next.botPlan.key } }; // 봇 계획 키 갈아 끼움
}
```
- **"원래 마감" 보관 = `earlyFrom`(서버 전용)**: 줄이고 나면 원래 값을 잃기 때문에 번복 연장의 상한을 알 수 없다. 키(`phase`+`day`)가 다르면 무시하므로 지울 필요가 없다. 같은 날 같은 단계는 한 번뿐이다.
- **`reschedule()`·`nextWakeAt` 은 바꾸지 않는다**: `nextWakeAt` 은 `state.phaseEndsAt` 을 그대로 읽고([VERIFIED: tick.ts:134-137] `Math.min(state.phaseEndsAt ?? …, state.expiresAt, …)`), 워커는 줄인 뒤 `await this.reschedule()` 만 부르면 알람이 새 마감으로 옮겨진다. 단계 전환 때 새 마감 = `이전 마감 + 다음 단계 길이`(tick 이 `deadline` 을 기준으로 이어 붙인다)라 줄어든 마감 기준으로 다음 단계들이 이어진다(모든 폰이 같은 값).
- **봇 계획 키 부작용(반드시 처리)**: `botPlanKey` 는 `` `${state.phase}:${state.phaseEndsAt}` ``([VERIFIED: bots.ts:200-204])라 마감이 바뀌면 `syncBotPlan` 이 계획을 다시 세운다(난수를 쓰고 봇이 다시 던질 수 있다). 산술상 새 계획의 모든 단계는 `limit = phaseEndsAt − BOT_END_MARGIN_MS(500)` 밖이라 버려지지만(찬반 `VERDICT_BASE_MS 1000`·밤 `NIGHT_PICK_BASE_MS 1000` > `EARLY_GRACE_MS 1500 − 500`) **산술에 기대지 않고** 위처럼 키를 같이 갈아 끼운다.
- **방송 규율**: 마감이 줄어드는 전환(`phaseEndsAt` 이 바뀜)에만 `persistAndBroadcast()`. 값은 모든 사람에게 같다(역할 무관). 줄지 않는 행동은 지금까지와 같다(찬반은 값이 바뀌면 전원 방송 — [VERIFIED: room.ts:851-859] 이미 그렇다, 밤은 `sendViewTo(pickRecipientIds(...))`, 키워드는 본인만).
- 호출 위치 셋: `applyVerdict`(값이 바뀐 직후, 지금 `persistAndBroadcast` 앞에 `shrinkDeadline` 끼움), `applyPick`(값이 바뀐 직후; 줄어들었으면 전원 방송+`reschedule`, 아니면 기존 `sendViewTo`), `applyAnswer`(확정 수락 직후). 봇도 같은 `apply*` 본체를 지나므로(`actAsBot`) **봇의 마지막 표가 조건을 채우는 경우**도 자동으로 처리된다.
- **연장(번복) 범위 — Q4**: D-11 은 "번복·변경이 들어오면 다시 now+1.5초" 라 했다. 찬반은 번복이 이미 전원 방송이라 문언대로 해도 새 누설이 없다. 반면 밤은 지금까지 "고른 사람 본인에게만" 이라, 연장을 방송하면 모두의 폰에서 막대가 다시 늘어나 "누군가 마음을 바꿨다"가 보인다(역할은 안 드러나지만 새 신호). **권고: 찬반만 연장, 밤·키워드는 처음 한 번만 줄이고 연장하지 않는다**(`opts.extend === false`). 한 번 줄이면 밤 참가자는 1.5초 안에 자유롭게 바꿀 수 있고(받아들여지지만 마감은 그대로) 공정성은 해치지 않는다. 사용자 확인이 필요하면 Q4 로 올린다.
- **클라이언트(UI-SPEC P23-23)**: `data-early` 표식과 `calm` 고정은 `HostBand`(`HostTime`)가 직전 `phaseEndsAt` 을 단계 키와 함께 기억해 "작아짐"을 감지한다. `useCountdown`·`HostTime`·`Timer.tsx`(`calm` prop 이 이미 있음 — [VERIFIED: Timer.tsx:10-19])·`PhaseHeader` 링 네 곳이 같은 `timerTone` 규칙을 쓴다. 막대 `ratio = remaining ÷ phaseDurationMs`([VERIFIED: countdown.ts `countdown()`]) 는 서버가 `phaseDurationMs` 를 바꾸지 않으므로 줄어드는 마감에서도 `0~1` 로 자연히 미끄러진다.
- **소리**: `TICK_PHASES` 에 든 `verdict` 는 마감이 바뀌면 틱 대본이 새로 서고(`direct()` 의 `prev.endsAt !== cur.endsAt` → `tickRun`), 남은 1.5초 안의 `1초` 경계만 울린다. 의도된 결과이므로 막지 않되 `soundDirector` 시험이 "줄어든 마감에서 틱이 중복되지 않음"을 한 케이스 본다.
- **`useWill` 의 `finalFor`·`SceneCurtain`**: `SceneCurtain` 은 `phaseEndsAt − offset − 420ms` 로 덮기 시작을 정한다([VERIFIED: SceneCurtain.tsx:16 주석]). 줄어든 마감이면 새 값으로 다시 정해지며 역할 무관한 값이라 누설은 없다(밤→아침 커튼이 일찍 덮이는 것은 의도).

**누설·타이밍 시험 설계**(`nightLeak` 스타일): 같은 판 구성 두 개를 같은 `testRole` 만 바꿔 만든다. 두 판 모두에서 산 사람 전원이 (역할이 다른 순서로) `pick` 을 보낸다. **마지막 `pick` 직후** 각 소켓의 프레임 열(`settle()` 로 flush)이 ① 판 A 와 판 B 에서 같은 `summary()`·같은 `phaseEndsAt` 차(`stable()` 이 `VOLATILE` 키를 제거), ② 시민·마피아 소켓 사이에서 `me` 외 키가 같다. 시간은 `Date.now()` 실시간이므로 `phaseEndsAt − 마지막 pick 시각 == EARLY_GRACE_MS ± 허용 오차`(서버가 `now` 를 한 번 재서 모든 소켓에 같은 `serverNow` 를 싣는다 — [VERIFIED: leak 시험 주석 scripts/smoke.mjs:~118] 도착 시각이 아니라 서버 시각을 비교). 조기 진행 시험은 실제 1.5초를 기다리지 않고 `forceDue`+알람으로 단계를 넘긴다(기다림 없는 결정적 시험). 실시간 1.5초는 E2E 한 곳만.

### P6. 기록 카드 (`RoleCardSheet`) (조사 6)

[VERIFIED: RoleCardSheet.tsx:19,24,29] 현재 `export type RoleCardTab = "role" | "activity";`, `const TAB_ORDER: readonly RoleCardTab[] = ["role", "activity"];`, 시민(`journalRoleOf` 가 `null`)은 탭 줄이 없다.
- `RoleCardTab` 에 `"answers"` 추가, `TAB_ORDER` 는 **시민** `["role","answers"]`, 경찰·의사·마피아 `["role","activity","answers"]` — 키보드 이동(←/→/Home/End)이 `TAB_ORDER` 로 계산되므로(`onTabKeyDown`) 역할별로 다른 배열을 `useMemo` 로 만든다.
- 탭은 `view.day?.keyword?.answers !== undefined` 일 때만 보이고, 이때 시민에게도 탭 줄이 생긴다. `showBack`(역할 확인 단계에서 앞면을 못 본 사람)은 기존대로 탭을 만들지 않는다. 시트 제목은 선택된 탭이 `answers` 면 "모두의 답", 아니면 "역할 카드"(P23-16).
- 목록은 일차별 구역 `section[data-answer-day="1"]` 배열로 만든다(`day.keyword.answers` 는 1일차뿐이지만 구조는 24 가 구역을 더할 수 있게). 줄은 `data-answer-row`·`data-answer-order`·`data-answer-seat`, "답 없음"은 `data-answer-none`, 정답 줄은 `answerOpenOf` 가 만든 `day.keyword.answer` 가 있을 때 `data-answer-correct`.
- **자동 열림(P23-17)**: `RoomScreen` 이 `roleCard` 상태를 쥔다([VERIFIED: RoomScreen.tsx:~314] `const [roleCard, setRoleCard] = useState<{ open: boolean; tab: RoleCardTab }>`). 첫날 `dayAnnounce → discussion` 전환을 **같은 연결에서 본 렌더**(`usePhaseArrival(phase, epoch)` 의 `arrivedFrom === "dayAnnounce"` 이고 `phase === "discussion"`, `day.n === 1`)에서 한 번 `setRoleCard({open:true, tab:"answers"})`. `autoOpened` ref 로 한 판에 한 번(새 판 `lobby|assigning` 에서 리셋 — 기존 리셋 `useEffect` 에 한 줄). **`arrivedFrom === null` 이면(재접속·새로고침 첫 프레임) 열지 않는다**(`fresh` — `hostChimeOf` 와 같은 규칙).
- **`recordsSeen` 관계**: `recordsSeen` 은 "활동 기록" 탭의 읽음 점만 센다(`seen`·`unread`·`activityVisible`). 첫날 답은 점·NEW 를 만들지 않는다(UI-SPEC 에 없음). 변경 없음. 단 `activityVisible` 은 `roleCard.tab === "activity"` 일 때만 읽음 처리하므로 `answers` 탭이 열려 있는 동안 활동 기록은 읽히지 않는다 — 의도와 일치.
- **`ResultAnnounce` `label`**: [VERIFIED: ResultAnnounce.tsx] 지금 props 는 `text`·`icon`·`placement` 이고 본문은 `<span className="mf-announce__text">{text}</span>`. `label?: string` 을 더하고 `<span className="mf-announce__label" data-announce-label>{label}</span>` 를 글자 위에 그린다(위 줄 "정답" 16/700, 아래 키워드 36).
- **결과 화면**: 정답은 `keywordAnswerOf(view)`(`view.day?.keyword?.answer`) 한 선택기로 묶는다. `ended` 의 `view.day` 는 이미 만들어진다([VERIFIED: view.ts:48-60] `DAY_PHASES` 에 `"ended"` 포함). `HOST_HIDDEN_PHASES` 의 `ended` 는 "정답 값이 없을 때만 숨김"으로 바뀌고 `hostBandModeOf`·`hostKeyOf` 시험이 바뀐다.

### P7. D1 판 기록 (조사 7)

**설정(검증됨)**:
```jsonc
// wrangler.jsonc 에 더할 것 — database_id 는 쓰지 않는다(D-19). 현재 파일은 [VERIFIED: wrangler.jsonc:1-22] 의 durable_objects / exports 까지다.
"d1_databases": [{ "binding": "DB", "database_name": "minifia-v3-games", "migrations_dir": "migrations" }],
```
| 시험 (이 세션 실행) | 결과 |
|------|------|
| `wrangler types` (바인딩만) | 통과. 생성 `Env` 에 `DB: D1Database` ([VERIFIED: 출력 `5:	DB: D1Database;`]). `worker-configuration.d.ts` 는 gitignored(`git check-ignore` 확인)이고 `npm run typecheck` 가 매번 `wrangler types` 를 돌린다 |
| `wrangler deploy --dry-run` (원본 설정 + 바인딩) | 통과, "env.DB (minifia-v3-games) D1 Database" 표시. 빌드 산출물 설정(`dist/worker/wrangler.json`)에서는 `migrations_dir` 가 `../../migrations` 로 다시 쓰인다 |
| `vite build` + `wrangler deploy --dry-run` | 통과(임시로 바인딩을 넣고 확인한 뒤 원복, `dist` 도 다시 빌드해 되돌림) |
| vitest worker 프로젝트: `readD1Migrations` + `applyD1Migrations` + `env.DB` | 통과(임시 시험, 이후 삭제). 아래 코드 |
| `wrangler d1 migrations apply DB --local` / `wrangler d1 execute DB --local --json --command "…다중 구문…"` | 통과. `--json` 은 구문마다 `{results,success,meta}` 배열 |

```ts
// vitest.config.ts — worker 프로젝트 (현재는 plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" } })])
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
const migrations = await readD1Migrations("./migrations");       // 노드 쪽, 최상위 await (config 가 ESM)
// … { plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" }, miniflare: { bindings: { TEST_MIGRATIONS: migrations } } })], … }
// test/worker/setup.ts 에 한 줄 추가 (기존 PLAYABLE_MAPS 잠금 뒤)
import { applyD1Migrations, env } from "cloudflare:test";
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
// 타입: test/worker/env.d.ts  →  declare namespace Cloudflare { interface Env { TEST_MIGRATIONS: import("cloudflare:test").D1Migration[] } }
```
(주의: 위 임시 시험은 `miniflare.bindings` 에 배열을 그대로 넘겼고 통과했다. `database_id` 가 없어도 miniflare 가 바인딩 이름으로 메모리 D1 을 만든다.)

**마이그레이션 `migrations/0001_games.sql`** (이 세션 `wrangler d1 migrations apply --local` 로 구문 확인):
```sql
CREATE TABLE games (
  id TEXT PRIMARY KEY,
  ended_at INTEGER NOT NULL,                       -- epoch ms
  winner TEXT NOT NULL CHECK (winner IN ('mafia', 'citizen')),
  caught_day INTEGER,                              -- 마피아가 처음 잡힌 날, 없으면 NULL
  first_day_caught INTEGER NOT NULL DEFAULT 0,
  genre TEXT NOT NULL, word TEXT NOT NULL,
  probe_success INTEGER NOT NULL DEFAULT 0,
  players INTEGER NOT NULL, bots INTEGER NOT NULL DEFAULT 0, has_bots INTEGER NOT NULL DEFAULT 0,
  duration_s INTEGER NOT NULL, left_count INTEGER NOT NULL DEFAULT 0,
  note_count INTEGER NOT NULL DEFAULT 0, no_answer_count INTEGER NOT NULL DEFAULT 0, tutorial INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX games_ended_at ON games (ended_at);
```

**행 만들기 `buildGameRow(state, now)` (순수, `shared/game/gameLog.ts`)** — D1 열 정의(권고):
| 열 | 계산 | 비고 |
|----|------|------|
| `id` | `state.gameId` | 워커가 `handleStart`·`handleRematch` 에서 `crypto.randomUUID()` 로 붙인다(`beginGame` 은 순수라 UUID 를 못 만든다). 없으면 행을 만들지 않는다 |
| `ended_at` | `now` | |
| `winner` | `state.winner` `"mafiaWin"→"mafia"`, `"citizenWin"→"citizen"` ([VERIFIED: endgame.ts `WIRE_WINNER`]) | `winner` 없으면 행 없음 |
| `caught_day` | `voteLog` 에서 `exec.passed` 이고 `cand.candidate` 좌석의 `role === "mafia"` 인 줄의 **가장 작은 `n`**, 없으면 `NULL` | `voteLog` 줄: `{ n, exec{yes,no,passed}, cand{candidate?}, reason? }` ([VERIFIED: protocol.ts `VoteLogEntry`]) |
| `first_day_caught` | `caught_day === 1 ? 1 : 0` | |
| `genre`·`word` | `state.keyword`(없으면 행 없음 — 옛 방) | 라벨이 아니라 `genre` id 권장(`word` 는 문자열) |
| `probe_success` | `state.keywordProbed === true ? 1 : 0` | |
| `players` | `p.role !== undefined` 인 사람 수(쉬는 사람 `sat` 제외) | `enterEnded` 가 `seatBench` 로 `sat` 를 합류시킨다 |
| `bots`·`has_bots` | 봇 수; `has_bots = bots > 0 \|\| testMode === true ? 1 : 0` | 테스트 방(`testSkip` 으로 흘린 판)은 통계에서 빼는 것을 권고(Q6) |
| `duration_s` | `Math.round((now − state.startedAt) / 1000)` | `startedAt` 은 `beginGame` 이 `now` 로 기록 |
| `left_count` | 봇이 아닌, 역할이 있는 사람 중 `connected === false` 인 수 | `ended` 진입 시점의 끊김. 판 중간에 나갔다 돌아온 사람은 못 센다(알려진 한계, Q7) |
| `note_count`·`tutorial` | `0`·`0` | 24 가 채운다 |
| `no_answer_count` | `keywordAnswers` 중 `text === null` 이고 **사람**(`!isBot`)인 수 | 봇은 항상 null 이라 제외 |

**삽입**: `afterTransition` 의 `emitResultLog(prev)` 와 같은 조건(`prev.phase !== "ended" && room.phase === "ended"`)에 `recordGame(prev)` 를 부른다. [VERIFIED: room.ts:1151-1159 `afterTransition` 의 현재 순서 — `captureHomeNow→fillChalk→persistAndBroadcast→syncPositions→emitDeathCards→emitResultLog→reschedule`]. `recordGame` 은:
```ts
private recordGame(prev: RoomState): void {          // 동기 함수 — 다른 전환이 끼어들지 않는다
  const room = this.room;
  if (!room || prev.phase === "ended" || room.phase !== "ended") return;
  const db = this.env.DB;                            // 바인딩이 없으면(옛 배포) 조용히 건너뜀
  const row = buildGameRow(room, Date.now());
  if (db === undefined || row === null) return;
  this.ctx.waitUntil(insertGame(db, row).catch(() => console.error("game log failed")));   // 토큰·내용 없는 한 줄
}
```
`DurableObjectState.waitUntil` 은 약속이 끝날 때까지(최대 15분) DO 가 내려가지 않게 한다 [CITED: developers.cloudflare.com/durable-objects/api/state/]. `insertGame` 은 `worker/gameLog.ts` 에 `db.prepare("INSERT OR IGNORE INTO games (…) VALUES (?, …)").bind(...).run()` 한 번. **삽입은 항상 바인딩(`?`)** 이라 SQL 주입이 없다.

**시험(실패 격리)**: 워커 시험은 `runInDurableObject(stub, (instance) => { instance["recordGame"] = …throw… })` 또는 `env.DB.prepare` 를 던지게 바꿔 게임이 계속 진행되는지(다음 `rematch` 가 성공)와 로그에 내용이 없는지를 본다. 성공 시험은 `ended` 도달 뒤 `until(...)` 로 폴링해 `SELECT` 한다(`waitUntil` 약속은 시험에서 직접 못 기다린다).

**`npm run games` (`scripts/games.mjs`)** — 한 번의 `wrangler d1 execute DB --local|--remote --json --command "<고정 SQL>"` 호출(검증됨). 입력 가드(`planGames(argv)` 순수 함수, `scripts/deploy.mjs` 의 `planDeploy` 와 같은 모양): 허용 인자는 `--local`(기본)·`--remote`·`--all` 뿐, 그 밖은 거부하고 아무것도 실행하지 않는다. `--remote` 는 실행 전에 `scripts/check-account.mjs` 가 내보내는 `judgeWhoami` 로 개인 계정 확인(배포 가드 우회 금지, D-19). SQL 은 코드의 상수 하나(두 구문: 요약 + 인원/봇), 사용자 입력이 SQL 에 들어가지 않는다. 출력은 한국어 한 화면(판 수·마피아 승률·평균 길이·첫날 잡힘 비율·떠보기 성공 비율·평균 인원, 기록 0 판이면 "아직 기록이 없어요"). 시험(`scripts/games.test.mjs`, `node --test`): 인자 가드·통계 문자열 형식·0 판 처리.

**24 를 위한 정확한 명령(이 페이즈에서는 실행하지 않는다)**:
```bash
npx wrangler whoami                                    # 개인 계정인지 확인(check-account 와 같은 판정)
npx wrangler d1 create minifia-v3-games --location apac
#   → 출력된 database_id 를 wrangler.jsonc d1_databases[0] 에 "database_id": "<uuid>" 로 손으로 기입 (--update-config 는 주석 있는 jsonc 를 다시 쓸 수 있어 쓰지 않는다)
npx wrangler d1 migrations apply DB --remote           # 비대화형 환경에서는 확인 단계를 건너뛰고 백업을 남긴다(wrangler 도움말)
npm run games -- --remote                              # 빈 표 확인
npm run deploy                                         # 기존 가드(check-account → build → check-deploy-target → deploy) 그대로
```
**배포 가드 영향**: `scripts/check-deploy-target.mjs` 는 빌드 산출물의 `name` 만 검사한다([VERIFIED: check-deploy-target.mjs:12-33]) — D1 과 무관. `scripts/deploy.mjs` 는 `wrangler deploy` 만 호출한다. **위험**: `wrangler` 의 자동 리소스 프로비저닝(2025-10-24 오픈 베타) 때문에 `database_id` 없이 `wrangler deploy` 를 하면 바인딩 이름으로 원격 D1 이 만들어질 수 있다 [CITED: developers.cloudflare.com/changelog/2025-10-24-automatic-resource-provisioning/, 정확한 `database_id` 없음 동작은 미확인 — 이 세션 미실행]. D-19 가 지키려는 것(계정 확인 뒤 명시적 생성)을 코드로 보증하려면 `check-deploy-target.mjs`(또는 `judgeDeployTarget`)에 "`d1_databases[*].database_id` 가 없으면 중단" 한 줄을 더하고 `deploy-target.test.mjs` 에 시험 하나를 붙인다(24 가 id 를 채우면 통과). 선택 사항이지만 권한다(Plan 23-02 의 작은 작업).

### Anti-Patterns to Avoid
- **키워드 단계를 단계 표 길이로만 믿기**: 클라이언트 3초 잠금·400ms 무시를 서버 규칙으로 착각하지 않는다. 서버는 단계 안이면 언제든 받는다.
- **금지어 규칙을 채팅에도 적용하기**: 자유 채팅 필터는 마피아에게 **무제한 탐색 도구**(채팅 속도 제한만 있음)가 된다. 키워드 입력에만 적용하고 채팅은 매너에 맡긴다(Q5).
- **`persistAndBroadcast` 로 초안을 알리기**: D-10 위반이자 타이밍 누설. 본인에게만 `sendViewTo`.
- **공개 키 이름을 `SERVER_ONLY_KEYS` 에 넣기**: `keyword` 는 view 키이기도 하다. 값 기반 검사로 지킨다.
- **조기 진행에서 `phaseDurationMs` 를 바꾸기**: 막대가 튄다. 서버는 `phaseEndsAt` 만 줄인다.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 본문 정리 | 새 정리 함수 | `sanitizeChatText`(chatRules.ts) + `countGraphemes`(nickname.ts) | will·채팅이 같은 함수. 제어·방향 문자 위장 방어가 이미 있음 |
| 입력 초안 자동 저장 클라이언트 | 새 디바운스 | `useWill.ts` 의 600ms·마감 700ms 전 규칙과 `useComposedText`·`clampGraphemes` | UI-SPEC P23-14 가 같은 수치 |
| 조기 종료 후 알람 | 새 타이머 | `shrinkDeadline` + `reschedule()` | 알람은 이미 `phaseEndsAt` 하나를 읽는다 |
| 마이그레이션 적용(시험) | 직접 `CREATE TABLE` | `readD1Migrations`+`applyD1Migrations` | 실제 마이그레이션 파일을 검증하는 시험 |
| D1 조회 | 별도 HTTP API | `wrangler d1 execute --json` | 외부 서비스·토큰 새로 만들지 않음 |
| 계정 확인 | 새 로직 | `judgeWhoami`(check-account.mjs) | 배포 가드와 같은 판정 |
| 유니코드 정규화 | 직접 매핑 표 | `String.prototype.normalize("NFKC")` | 전각·호환 자모·NFD 를 한 번에 |

**Key insight:** 이 페이즈의 새 로직은 작다(금지어 함수, 마감 훅 하나, 마감 단축 함수, 행 만들기). 위험은 **가입 누락과 누설 모양**이라 새 로직보다 목록·시험이 일을 한다.

## Runtime State Inventory

이 페이즈는 이름 바꾸기·마이그레이션이 아니지만 **새 상태 키가 옛 저장 방과 만나는 지점**이 있어 짧게 답한다.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | DO storage `"room"` 의 옛 판(배포 순간 진행 중, `keyword` 키 없음) | 코드 변경만: `keyword===undefined` 면 기능 전체 꺼짐(`routeAfterRoleReveal` 건너뜀·`afterDayOf` 건너뜀·view 키 없음). 데이터 이전 없음 |
| Live service config | D1 데이터베이스는 아직 없음(D-19) | 24 의 명령 목록 참고. 로컬/시험은 바인딩만으로 동작 |
| OS-registered state | 없음 — 확인: 없는 작업 | — |
| Secrets/env vars | 없음 — D1 은 바인딩이라 토큰이 필요 없다. `--remote` 는 wrangler 로그인 세션 | — |
| Build artifacts | `worker-configuration.d.ts`(gitignored, `wrangler types` 가 생성), `dist/` | 바인딩을 더한 뒤 `npm run typecheck` 가 재생성 |

**다시 하기(rematch) 경계**: `REMATCH_ROOM_KEYS`·`REMATCH_PLAYER_KEYS` 가 허용 목록이라([VERIFIED: rematch.ts:16] `["code", "createdAt", "everConnected", "hostId", "nextJoinSeq", "mapChoice", "testMode", "testRole", "testBotVote"]`) `keyword`·`startedAt`·`gameId`·`answerSubmits`·`keywordAnswers`·`earlyFrom`·`Player.answerDraft` 는 자동으로 새 판에 안 넘어간다(허용 목록의 구조적 보호). 새 판은 `beginGame` 이 새 키워드를 정한다.

## Common Pitfalls

### Pitfall 1: 키워드 단계에서 `state.day` 가 없다
**What goes wrong:** `captureHomeNow`(`room.day === undefined → return false`), 채팅 단계 키 `phaseKey`(`day ?? 0`), 봇 유언 `(state.day ?? 1) === 1`, `voteLog` 가 `day` 를 가정하는 곳이 키워드 단계에서 다르게 읽힌다.
**Why it happens:** 일차는 `enterDayAnnounce` 에서 올라간다([VERIFIED: tick.ts `enterDayAnnounce` — `day: (state.day ?? 0) + 1`]).
**How to avoid:** `day` 를 미리 올리지 않는다(`dayAnnounce` 에서 +1 이 두 번 되어 2일차가 된다). `buildDay` 는 `n: state.day ?? 1`, `earlyFrom.day` 는 `state.day ?? 0`.
**Warning signs:** 키워드 단계 view 의 `day.n` 이 1 인지, `first_day_caught` 계산이 `n === 1` 인지.

### Pitfall 2: 조용한 `default` — 새 단계가 `fallback`/`연결 중…`
`hostKeyOf` 는 `default: return "fallback"`, `renderPhase` 는 `default: return connecting()`, `sceneKey` 는 `default: return phase`. 컴파일러가 못 잡는다. P1 의 ✗ 줄을 체크리스트로 쓰고, 단계 매트릭스 시험(`hostLine.test.ts:430`·`phaseScreens.test.tsx:393`)에 새 단계를 더해 "`fallback` 이 아님"을 단언한다.

### Pitfall 3: `view.day` 가 없으면 `day.keyword` 를 못 싣는다
`DAY_PHASES`(view.ts:48)에 `keyword`·`answerReveal` 이 없으면 `view.day` 키 자체가 없다. D-01 의 "DAY_PHASES 에 넣지 않는다"는 다른 `DAY_PHASES`(클라이언트 `MAP_PHASES` 성격)를 뜻한 것으로 보이며, 서버 `DAY_PHASES` 는 넣어야 한다. 시험 `view.test.ts:293` `DAY_VIEW_PHASES` 를 같이.

### Pitfall 4: 첫날 "처형 없음" 큰 글과 "정답" 큰 글이 겹친다 (UI-SPEC 가정이 코드와 다르다)
**What goes wrong:** UI-SPEC §A 는 "처형 없는 첫날은 '처형 없음' 큰 글(1.4초) 다음에 정답 공개 3초"라 하지만, 코드에서 `day.noExecution` 은 `phase === "night"` 일 때만 생긴다([VERIFIED: execution.ts `noExecutionOf` — `if (state.phase !== "night") return undefined;`]). 첫날은 부결·동점·0표가 곧장 `answerReveal` 로 가므로 "처형 없음"이 어디에도 안 나온다(`dayEvents` 의 `night` 분기는 `prev.phase` 가 `verdict|nomination|runoff|showdown` 일 때만 알림을 만든다).
**How to avoid(권고, Q1):** `noExecutionOf` 가 `answerReveal` 에서도 값을 주게 하고, `dayEvents.phaseEntry` 에 `case "answerReveal"` 을 더해 `prev ∈ {verdict,nomination,runoff,showdown}` 이고 `reason` 이 있으면 "처형 없음"(0~1.4초) 알림 + "정답" 큰 글을 1.4초 뒤에 시작시킨다. 3초 규칙(정답이 3초 보이게)을 지키려면 이 경우 단계 길이를 `ANSWER_REVEAL_MS + NO_EXECUTION_MS(1400)` = 4.4초로 한다 — `phaseDurationOf(answerReveal)` 가 `noExecutionOf(state)` 유무로 갈린다(공개 값 파생, 누설 없음). `ANNOUNCE_NOEXEC_MS(1400)` 는 지금 `dayView.ts` 에 있으니 서버가 쓰도록 `phases.ts` 로 올려 둘이 한 값을 쓴다. 사용자가 UI-SPEC 대로 "정확히 3초"를 원하면 첫날 처형 없음 알림을 빼고 정답 큰 글만 남기는 대안이 있다.

### Pitfall 5: 봇 계획 키 때문에 마감이 줄면 봇이 다시 계획을 세운다
P5 참고. `shrinkDeadline` 이 `botPlan.key` 를 같이 갈아 끼운다. 시험: 봇이 낀 판에서 마지막 표 뒤 `botPlan.steps` 가 비어 있고 봇 표가 바뀌지 않음(`testBotVote` 고정으로 확인).

### Pitfall 6: 초안과 확정이 한 간격 키를 쓰면 [보내기]가 조용히 사라진다
입력 600ms 뒤 초안이 나가고 바로 [보내기] 를 누르면 400ms 안일 수 있다. 간격 키를 `answerD`·`answerF` 로 나눈다(P2).

### Pitfall 7: `afterDayOf()` 시그니처 변경이 시험을 깬다
`e2eContract.test.ts:813-819` 는 `afterDayOf()` 를 인자 없이 호출해 기대 집합을 만든다. 시험이 `afterDayOf({ day: 2 })`(= `"night"`)와 `afterDayOf({ day: 1, keyword: … })`(= `"answerReveal"`)로 나눠 단언해야 한다. 같은 이유로 `scripts/smoke.mjs:102` 의 전이 표에서 `verdict`·`nomination` 의 분기 값이 `answerReveal` 을 포함해야 한다.

### Pitfall 8: 클라이언트 번들에 키워드 목록이 들어간다
P4 참고. 정적 가드 + 빌드 grep.

### Pitfall 9: 로컬 시험이 흔들린다(알려진 이월)
22 에서 이월: worker 시험 중 `bots`·`basicDay`·`waitHelpers` 가 부하에서 간헐 실패 → **단독 재실행**. 새로 생기는 위험: 전원이 투표/선택한 직후 1.5초 넘게 기다리는 시험은 알람이 단계를 넘겨 단언이 깨진다 — 그런 시험은 `forceDue` 로 결정적으로 진행하고 실시간 대기는 E2E 에만 둔다.

## Code Examples

위 P1~P7 에 핵심 코드가 있다. 추가:

### 키워드 마감 훅 `closeKeyword` (D-03·D-07)
```ts
// shared/game/keywordAnswer.ts — tick HOOKS.deadline.keyword
export function closeKeyword(state: RoomState): DeadlineResult {
  const entry = state.keyword === undefined ? undefined : keywordEntryOf(state.keyword.genre, state.keyword.word);
  const submitted = state.answerSubmits ?? [];
  const done = new Set(submitted.map((s) => s.seat));
  const rest = state.players.filter((p) => isAlive(p) && !done.has(p.seat)).sort((a, b) => a.seat - b.seat);
  const draftOk = (p: Player): string | undefined => {
    if (isBot(p) || p.answerDraft === undefined) return undefined;
    return entry !== undefined && violatesKeyword(p.answerDraft, entry) ? undefined : p.answerDraft;
  };
  const rows = [
    ...submitted.map((s) => ({ seat: s.seat, text: s.text })),            // ① 낸 순서
    ...rest.filter((p) => draftOk(p) !== undefined).map((p) => ({ seat: p.seat, text: draftOk(p)! })), // ② 마감에 초안으로 나간 사람(좌석 순)
    ...rest.filter((p) => draftOk(p) === undefined).map((p) => ({ seat: p.seat, text: null })),        // ③ 답 없음(좌석 순, 봇 포함)
  ].map((r, i) => ({ order: i + 1, ...r }));
  const { answerSubmits: _s, ...clean } = state;
  return { state: { ...clean, keywordAnswers: rows, players: state.players.map(({ answerDraft: _d, ...p }) => p) }, stay: false };
}
```
(② 와 ③ 의 상대 순서는 D-07 문장이 "맨 끝 순서(좌석 순)"를 둘 모두에 쓴 것으로 읽었다 — Q3.)

### 키워드 단계 `buildView` 조각
```ts
// view.ts buildDay — 공개 값만, 모든 사람에게 같은 모양
if (state.keyword !== undefined) {
  const genre = genreLabelOf(state.keyword.genre) ?? "";
  const kw: KeywordView = { genre };
  if (state.phase !== "keyword" && state.keywordAnswers !== undefined) kw.answers = state.keywordAnswers.map((r) => ({ order: r.order, seat: r.seat, text: r.text }));
  if (answerOpenOf(state)) kw.answer = state.keyword.word;
  day.keyword = kw;
}
// buildView — me.keyword: 키워드 단계, 산 사람, 마피아가 아닐 때만. me.answer: 키워드 단계, 본인이 쓴 것이 있을 때만(확정 우선, 없으면 초안)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 동시 투표·찬반 10초 다 채움 | 개인 단계는 전원 완료 시 일찍 넘어감 | 결정 0089-26 | 찬반 조기 종료 없음(0090-4 "모두가 일찍 던져도 10초를 채운다")이 **이 페이즈에서 뒤집힌다** — 22 의 `verdictRule` 시험·`voteCount`/`will-flow` E2E 주석 "10초를 다 채운다" 를 갱신 |
| 단계 id 로 `night` 직행 | 첫날 한정 `answerReveal` 경유 | 이 페이즈 | `afterDayOf(state)` |
| `database_id` 필수로 알려진 D1 | 바인딩 이름만으로 로컬·시험·dry-run 통과 | 이 세션 실행 확인 | 24 에서 id 를 채운다 |

**Deprecated/outdated:** `docs/decisions/0090-v3-single-flow-day-vote-will.md` 의 "0090-4 … 모두가 일찍 던져도 10초를 채운다" 는 0091 에서 개정 표시.

## Assumptions Log

> `[ASSUMED]` 로 태그한 주장 목록. 계획자·discuss-phase 가 사용자 확인 대상으로 본다.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `vite dev`(Cloudflare Vite 플러그인)의 로컬 D1 이 `wrangler d1 … --local` 과 같은 상태 폴더(`.wrangler/state/v3/d1`)를 공유한다 | P7 `npm run games --local` | 로컬 조회가 빈 결과를 줄 수 있음 — `--persist-to` 로 맞추거나 문서화 |
| A2 | `database_id` 없는 바인딩으로 실제 `wrangler deploy` 를 하면 원격 D1 이 자동 생성된다(변경 로그 인용, 미실행) | P7 가드 권고 | 가드를 안 넣어도 24 가 먼저 id 를 채우면 무해. 틀려도 손실 없음 |
| A3 | `ctx.waitUntil` 로 던진 D1 삽입이 DO 안에서 `evictDurableObject` 이후에도 끝까지 간다(문서상 최대 15분) | P7 | 삽입 누락 가능 — 실패는 삼키므로 판은 안전, D1 통계가 일부 빔 |
| A4 | 3글자 키워드 초성 규칙이 흔한 단어와 우연히 겹쳐 시민이 거절당하는 빈도는 플레이에 지장이 없다 | P3 | 사용자 피드백으로 초성 기준(3→4글자) 조정 |
| A5 | 첫날 "처형 없음"→"정답" 두 큰 글을 4.4초 단계로 잇는 것이 사용자가 원하는 모양이다 | Pitfall 4 | UI-SPEC 의 3초 고정과 다름 — 확인 필요 |
| A6 | 밤·키워드는 마감 연장(번복) 없이 한 번만 줄이는 편이 맞다 | P5 | D-11 문언과 다름 — 확인 필요 |

## Open Questions

1. **첫날 처형 없음의 "처형 없음" 큰 글은 어디에 두나? (Pitfall 4)**
   - What we know: UI-SPEC 는 "처형 없음 1.4초 다음 정답 3초"라 하나 코드에서 `noExecution` 은 `night` 에서만 만들어진다.
   - What's unclear: 4.4초 단계로 이을지, 정답만 3초 보일지.
   - Recommendation: `answerReveal` 길이를 `3000 + (처형 없음이면 1400)` 로 하고 `noExecutionOf` 를 `answerReveal` 까지 넓힌다. 사용자 확인 후 확정(계획자는 가정으로 두고 `[ASSUMED]` 표시).

2. **`day.keyword.genre` 를 둘째 날 이후에도 싣나? (D-14 vs P23-18)**
   - Recommendation: 싣는다(공개 값). D-14 문장을 "`answers` 와 `answer` 와 `genre`"로 읽는다.

3. **마감에 초안으로 나간 답과 "답 없음"의 순서 (D-07)**
   - Recommendation: ① 낸 순서 → ② 초안으로 나간 사람(좌석 순) → ③ 답 없음(좌석 순). D-07 이 ②③ 모두 "맨 끝 순서(좌석 순)"라 한 해석.

4. **조기 진행 연장 범위 (P5)** — 찬반만 연장, 밤·키워드는 한 번만 줄임을 권고(누설 신호 방지).

5. **자유 채팅에 금지어를 거나?** — 권고: 안 건다(마피아에게 무제한 탐색 도구가 된다, 0089 의 "매너"와도 일치). 첫날 토론 채팅에서 시민이 키워드를 말해 버리는 것은 규칙상 허용(각주 안내만).

6. **테스트 방 판의 D1 기록** — `has_bots = bots>0 || testMode` 로 통계에서 뺄지(권고) 그대로 기록할지.

7. **`left_count` 정의** — `ended` 진입 시점에 끊겨 있는 사람 수(권고, 단순). 판 중간 이탈 후 복귀는 못 센다.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | 스크립트·시험 | ✓ | v26.13.0 | — |
| wrangler | D1 마이그레이션·`d1 execute`·types | ✓(`node_modules/.bin`) | 4.151.3 | — |
| @cloudflare/vitest-plugin | worker 시험의 D1 | ✓ | 1.4.6 | — |
| Chrome(시스템) | 로컬 E2E | ✓ | `/Applications/Google Chrome.app` | — |
| 로컬 dev 서버 | E2E(`http://localhost:5173`) | 실행 중 아님 | `npm run dev` | — |
| Cloudflare 개인 계정 로그인 | `--remote`·24 의 `d1 create` | ✗ 미확인(이 세션은 호출하지 않음) | — | 이 페이즈는 로컬·시험만 쓴다 |

**Missing dependencies with no fallback:** 없음(이 페이즈 범위).
**Missing dependencies with fallback:** 원격 D1 은 24.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.12 (프로젝트 3개: `unit`·`client`·`worker`) + `node:test`(scripts) + 로컬 E2E |
| Config file | `/Users/dhkim1522/personal/minifia/vitest.config.ts` (worker 프로젝트에 D1 마이그레이션 추가 필요 — Wave 0) |
| Quick run command | `npx vitest run --project unit test/unit/<file>` ([VERIFIED: 이 세션 `will.test.ts` 28개 통과]) |
| Full suite command | `npm test` + `node --test scripts/*.test.mjs scripts/e2e/*.test.mjs` + `npm run typecheck` |

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|-------------|
| SC1 | 단계 삽입·길이(13s/3s)·`keyword===undefined` 스위치·day 미정의 | unit | `npx vitest run --project unit test/unit/keywordFlow.test.ts test/unit/phases.test.ts` | ❌ Wave 0 (`keywordFlow` 신규) |
| SC1 | view 모양: 마피아 `me.keyword` 없음, `day.keyword{genre}` 동일 | unit | `npx vitest run --project unit test/unit/view.test.ts` | ✅ 확장 |
| SC1 | 카드 DOM(`???`, 각주, 3초 잠금, `data-answer-state`) | client | `npx vitest run --project client test/client/keywordScreen.test.tsx` | ❌ Wave 0 |
| SC2 | 금지어 우회 전부·통과 케이스 | unit | `npx vitest run --project unit test/unit/keywordGuard.test.ts` | ❌ Wave 0 |
| SC3 | 초안·확정·간격·마감 처리·순서·봇 null | unit + worker | `… --project unit test/unit/keywordAnswer.test.ts` / `… --project worker test/worker/keyword.test.ts` | ❌ Wave 0 |
| SC4 | 첫날 흐름 `roleReveal→keyword→dayAnnounce→…→execution→answerReveal→night`, 승패면 `ended`, 둘째 날 키워드 없음 | unit(tick) + worker | `… test/unit/keywordFlow.test.ts` / `… --project worker test/worker/keyword.test.ts` | ❌ Wave 0 |
| SC4 | 기록 카드 탭·자동 열림·재접속 안 열림 | client | `… --project client test/client/roleCardSheet.test.tsx test/client/roomScreen.test.tsx` | ✅ 확장 |
| SC5 | 장르 수·개수·한 글자 없음·정규화 충돌·역할 단어·12자소 | unit | `… --project unit test/unit/keywords.test.ts` | ❌ Wave 0 |
| SC6 | 행 만들기(`caught_day`·`left_count`·`no_answer_count`) | unit | `… test/unit/gameLog.test.ts` | ❌ Wave 0 |
| SC6 | D1 삽입 성공·실패 격리·바인딩 없음·마이그레이션 적용 | worker | `… --project worker test/worker/gameLog.test.ts` | ❌ Wave 0 |
| SC6 | `npm run games` 인자 가드·출력 | node:test | `node --test scripts/games.test.mjs` | ❌ Wave 0 |
| SC7 | 마피아 프레임·http preview 에 정답 없음, 거절 응답 같은 모양, `day.keyword` 열 동일 | worker | `… --project worker test/worker/keywordLeak.test.ts test/worker/leak.test.ts` | ❌/✅ |
| SC8 | `earlyReady`·`shrinkDeadline`(전원/봇 제외/번복/끊긴 사람/원래 마감 상한/봇 계획 키) | unit | `… --project unit test/unit/early.test.ts` | ❌ Wave 0 |
| SC8 | 워커 세 곳 조기 진행, 밤 누설(역할만 다른 두 판 열 동일) | worker | `… --project worker test/worker/earlyAdvance.test.ts test/worker/nightLeak.test.ts` | ❌/✅ |
| SC8 | 막대 미끄러짐·`data-early`·`calm` | client | `… --project client test/client/hostBand.test.tsx` | ✅ 확장 |
| 전체 | 로컬 E2E: 카드·입력·공개·정답·조기 진행 | e2e | `npm run e2e -- --url http://localhost:5173 --only keyword` / `--only early` | ❌ Wave 5 |
| 계약 | E2E 사본 상수 = `shared/game` | unit | `… --project unit test/unit/e2eContract.test.ts` | ✅ 확장 |

### Sampling Rate
- **Per task commit:** 바뀐 파일의 단위 시험 하나(`npx vitest run --project unit <file>`) + `npx tsc -p tsconfig.app.json --noEmit` 또는 `npm run typecheck`
- **Per wave merge:** `npx vitest run --project unit --project client` + `npm run typecheck`, worker 시험은 바뀐 파일만(실패 시 단독 재실행)
- **Phase gate:** `npm test` 전부 + `node --test scripts/*.test.mjs scripts/e2e/*.test.mjs` + `npm run build` 후 번들에 표본 키워드 없음 + 로컬 E2E `--only keyword`·`--only early` 통과 → `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts` worker 프로젝트에 `readD1Migrations`·`TEST_MIGRATIONS` 바인딩, `test/worker/setup.ts` 에 `applyD1Migrations`, `test/worker/env.d.ts` 타입
- [ ] `test/worker/helpers.ts` `startedGame` 에 `keyword` 키 제거 옵션(기본 제거) — 옛 worker 시험 보호
- [ ] 신규 시험 파일: `keywords`·`keywordGuard`·`keywordAnswer`·`keywordFlow`·`early`·`gameLog`(unit), `keyword`·`keywordLeak`·`earlyAdvance`·`gameLog`(worker), `keywordScreen`(client), `scripts/games.test.mjs`
- [ ] `migrations/0001_games.sql`, 정적 가드 시험(`src` 가 키워드 모듈을 import 하지 않음)
- 프레임워크 설치: 없음

## Security Domain

`security_enforcement` 는 `.planning/config.json` 에서 켜짐(`"security_enforcement": true`, ASVS 레벨 1, 차단 `high`).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | 기존 소켓 첨부 `playerId` 신원 — 새 인증 없음 |
| V3 Session Management | no | 변경 없음 |
| V4 Access Control | **yes** | 서버 권위: 키워드는 `me.keyword` 로 비마피아 본인에게만, 정답은 공개 단계에서만. 클라이언트가 보낸 역할·시각을 믿지 않는다 |
| V5 Input Validation | **yes** | zod `strictObject`(`t,text,final`만), UTF-16 300 상한, `sanitizeChatText`, 20자소, 텍스트는 React 텍스트 노드만(`innerHTML` 금지) |
| V6 Cryptography | no | 키워드 선택은 `cryptoRandInt`(기존), 판 id 는 `crypto.randomUUID()` — 직접 만든 난수 금지 |
| V7 Error Handling | **yes** | 거절 응답이 시민·마피아에서 같은 두 프레임(`error BAD_MESSAGE` + `state`), 로그에 내용 없음 |
| V8 Data Protection | **yes** | D1 에 닉네임·채팅·답 글·토큰을 저장하지 않는다(행 열 전부 숫자·장르·단어·승패) |
| V13/V14 구성 | yes | D1 바인딩에 비밀 없음, 자동 프로비저닝 방지 가드 권고 |

### Known Threat Patterns for {Cloudflare Workers + DO + WebSocket + D1}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 마피아의 키워드 무제한 탐색 | Information disclosure | 사람당 400ms 간격(수락·거절 모두 기록), 10초 단계, 메시지 속도 제한 20/초, 채팅 필터 없음(탐색 도구를 만들지 않음). 떠보기 성공은 D1 로 관측(0089-6) |
| 거절 응답 모양/타이밍으로 역할 추론 | Information disclosure | 시민·마피아 같은 응답, 플래그 저장은 본인 소켓 응답에 영향 없음, 타 소켓에 프레임 없음 |
| 조기 마감 타이밍으로 밤 행동 추론 | Information disclosure | 종료 시각 = 마지막 산 사람 행동 + 1.5초(역할 무관), 줄이는 순간만 전원 방송, 밤은 연장 방송 안 함(Q4), 누설 시험 |
| 키워드가 http preview·결과 로그·다른 프레임에 새는 것 | Information disclosure | `buildPreview` 는 단계 이름만, 결과 로그는 `part`/줄 키 집합이 고정, 서버 전용 키 감시선 |
| 초안/확정 스팸으로 DO 쓰기 폭주 | DoS | 초안·확정 각각 400ms, 같은 값은 같은 객체(저장 없음), 상태 전체 쓰기는 will 과 같은 빈도 |
| SQL 주입(D1) | Tampering | 모든 삽입 `prepare(...).bind(...)`, 조회 SQL 은 코드 상수 |
| `games.mjs` 인자 주입 | Tampering | `planGames` 허용 목록 `--local --remote --all` 뿐, 나머지는 거부하고 실행 안 함 |
| 답 글을 통한 스크립트 주입(XSS) | Tampering | React 텍스트 노드로만, 서버가 `sanitizeChatText` 로 한 번 더 정리 |
| 잘못된 계정으로 `--remote`/배포 | Elevation | `judgeWhoami` 재사용, 24 의 명령 순서 |

## Recommended Plan Breakdown (조사 9)

각 계획 ≤3 작업, 읽을 파일 목록과 변경 규칙 중심. `worker/room.ts` 편집 계획(23-05·06·07)은 **직렬**. 22 에서 이월: worker 흔들림 시험은 단독 재실행.

| Wave | Plan | 내용 (≤3 작업) | 읽을 것 | 병렬 |
|------|------|----------------|---------|------|
| 1 | **23-01 콘텐츠·판정 순수 모듈** | ① `keywords.ts`(스키마·`pickKeyword`·≥6 장르 × ≥30 초안)+`keywords.test.ts` ② `keywordGuard.ts`+`keywordGuard.test.ts` ③ 정적 가드(src 가 키워드 모듈 import 금지)+`answerRules.ts` 상수 | P3·P4 | 23-02 와 병렬 |
| 1 | **23-02 D1 기반** | ① `wrangler.jsonc` 바인딩 + `migrations/0001_games.sql` + `vitest.config.ts`/`setup.ts`/`env.d.ts` + 마이그레이션 적용 시험 ② `scripts/games.mjs`·`games.test.mjs`·`package.json` `games` 스크립트 ③ (선택) `check-deploy-target` 의 `database_id` 가드+시험 | P7 | 23-01 과 병렬 |
| 2 | **23-03 단계 뼈대(서버)** | ① `protocol.ts`(PhaseId, `KeywordView`, `DayView.keyword`, `MyInfo.keyword/answer`)·`phases.ts`(행·상수·`afterDayOf(state)`)·`room.ts`(RoomState/Player 새 선택 키, `beginGame` 키워드·`startedAt`)·`tick.ts` 훅(`routeAfterRoleReveal`·`closeKeyword` 자리)·`endgame.ts routeAfterExecution` ② 서버 가입 목록(P1 #3·4·5·6: `view.ts DAY_PHASES`·`MAP_PHASES`·`worldVisibleTo`) + 단위 시험(`keywordFlow.test.ts`·`phases.test.ts`·`view.test.ts` 기대값) ③ 네 호출처 `afterDayOf(state)` 갱신 + `e2eContract.test.ts:813-819` | P1·핵심 결론 1~4 | — |
| 2 | **23-04 클라이언트·스크립트 가입(최소 배선)** | ① 컴파일러가 잡는 `Record`(P1 #10·13·16·18·21)와 안 잡는 곳(#9·11·15·17·19·20) 최소 구현(빈 `Keyword` 화면 자리, `hostKeyOf` case) ② `scripts/smoke.mjs`·`e2e/lib.mjs`·`polish.mjs`·`host.mjs` 단계 표 + `lib.test.mjs`/`polish.test.mjs` ③ 시험 단계 배열(P1 #25)·`startedGame` 키워드 제거 옵션 | P1 표 | 23-03 뒤 |
| 3 | **23-05 답 메시지·view·누설(서버)** | ① `keywordAnswer.ts`(`submitAnswer`·`closeKeyword`·`answerOpenOf`)+단위 시험 ② `schemas.ts`·`protocol.ts` 메시지·`view.ts`(`day.keyword`·`me.keyword`·`me.answer`)·`worker/room.ts handleAnswer/applyAnswer`(간격 둘·플래그 저장·봇 제외) ③ 누설 시험(`keywordLeak.test.ts`, 서버 전용 이름 목록 4곳 갱신) | P2 | 직렬 시작 |
| 3 | **23-06 조기 진행** | ① `early.ts`+`early.test.ts` ② `applyVerdict`·`applyPick`·`applyAnswer` 호출, `earlyFrom` 서버 전용 이름 가입 ③ `earlyAdvance.test.ts`·`nightLeak.test.ts` 메타모픽 | P5 | 23-05 뒤 |
| 3 | **23-07 D1 기록** | ① `gameLog.ts`+`gameLog.test.ts` ② `worker/gameLog.ts`·`worker/room.ts recordGame`(afterTransition)·`handleStart/handleRematch` 의 `gameId` ③ worker 시험(삽입·실패 격리·바인딩 없음·`keywordProbed`→`probe_success`) | P7 | 23-06 뒤 |
| 4 | **23-08 키워드 화면** | ① `Keyword.tsx`+`phase.css`(카드·입력줄·컴팩트) ② `useKeywordAnswer.ts`(초안 600ms·마감 700ms 전·거절 알림·`me.answer` 복원)·`hostLine` 문구 ③ `keywordScreen.test.tsx`·E2E 표식 | UI-SPEC B | — |
| 4 | **23-09 기록 카드·정답 공개·결과** | ① `RoleCardSheet` 탭·구역 목록·자동 열림(`RoomScreen`) ② `ResultAnnounce label`·`answerReveal` 장면(고정 카메라·조명·`dayEvents` 처형 없음 처리, Q1) ③ 결과 `정답 · {키워드}`·`HostBand data-early`·막대 | UI-SPEC C·D·E | 23-08 과 병렬 가능(파일 겹침 확인) |
| 5 | **23-10 E2E·문서·회귀** | ① E2E 흐름 `keyword`·`keyword-sizes`·`early`(`flows.mjs`)·`uat-test-room.mjs` 흐름 재작성 ② `e2eContract` 상수 사본(`KEYWORD_MS`·`ANSWER_*`·`EARLY_GRACE_MS`) ③ 결정 `0091`·`docs/product.md`·`architecture.md`·`screen-map.md`·`HANDOFF.md`·0090-4 개정 표시 + 위생 검사 + 전체 회귀 | D-21 | — |

## Sources

### Primary (HIGH confidence)
- `/Users/dhkim1522/personal/minifia` 소스 직접 열람: `shared/game/{phases,tick,endgame,execution,verdict,discussion,night,will,bots,view,room,movement,audience,gather,testTools,resultLog,rematch,chatRules}.ts`, `shared/{protocol,schemas,nickname}.ts`, `worker/{room,random}.ts`, `src/{screens/RoomScreen,game/hostLine,game/dayView,game/scenes,world/presence,audio/director,components/v2/HostBand,components/RoleCardSheet,components/ResultAnnounce,net/countdown}`, `test/worker/{helpers,leak,nightLeak,setup}.ts`, `scripts/{deploy,check-account,check-deploy-target,smoke,uat-test-room}.mjs`, `scripts/e2e/{lib,flows,browser}.mjs`, `wrangler.jsonc`, `vitest.config.ts`, `package.json`
- 임시 실행 확인(삭제함): `wrangler types`·`wrangler deploy --dry-run`·`vite build`(바인딩 추가 후 원복)·vitest worker 프로젝트 D1 시험·`wrangler d1 migrations apply/execute --local`·Node 로 `keywordGuard` 알고리즘 표
- `node_modules/@cloudflare/vitest-plugin/{dist/pool/index.d.mts,types/cloudflare-test.d.ts}` — D1 API 이름·시그니처

### Secondary (MEDIUM confidence)
- [Cloudflare Durable Objects state `waitUntil`](https://developers.cloudflare.com/durable-objects/api/state/) — 약속이 끝날 때까지(최대 15분) DO 를 내리지 않음
- [Cloudflare 변경 로그: 자동 리소스 프로비저닝](https://developers.cloudflare.com/changelog/2025-10-24-automatic-resource-provisioning/) — `database_id` 없는 바인딩의 배포 동작(정확한 경우는 미확인)

### Tertiary (LOW confidence)
- 없음(가정은 "가정 로그" 에 분리)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 새 패키지 없음, 버전은 실행 출력에서 읽음
- Architecture: HIGH — 현재 코드를 직접 읽고 D1/마이그레이션/금지어를 실행해 확인. UI-SPEC 과 코드의 어긋남(Pitfall 4, 조기 진행 연장)은 Open Questions 로 분리
- Pitfalls: HIGH — 22 이월과 이 세션 grep 결과. "알려진 한계"는 A4

**Research date:** 2026-11-17
**Valid until:** 코드가 빠르게 바뀌는 프로젝트라 22/23 사이의 다른 커밋이 `shared/game/phases.ts`·`worker/room.ts` 를 건드리면 P1·P5 의 줄 번호를 다시 확인(30일 또는 해당 파일 변경 시)
