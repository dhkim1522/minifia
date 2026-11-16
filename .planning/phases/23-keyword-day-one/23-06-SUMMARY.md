---
phase: 23-keyword-day-one
plan: "06"
subsystem: game-flow
tags: [keyword-answer, ws-message, leak-test, server-authoritative, view]
requires: ["23-05", "23-03"]
provides:
  - "submitAnswer·closeKeyword(순수, shared/game/keywordAnswer.ts)와 tick HOOKS.deadline.keyword"
  - "answer { text, final } 메시지(protocol·AnswerMessageSchema)와 방 DO handleAnswer/applyAnswer(본인 sendViewTo, 전원 방송 없음)"
  - "view: day.keyword.answers(keyword 단계 뒤 모두에게 같은 값, 판 내내), me.answer(본인 초안·확정 복원)"
  - "test/worker/keywordLeak.test.ts 와 서버 전용 이름 감시선 세 곳, leak.test 의 키워드 공개 경로 허용 목록"
affects: [23-07, 23-08, 23-09, 23-10, 23-11, 23-12]
status: complete
actuals:
  tokens: 18000
  tasks: 3
  commits: 6
plan_head_before: a44da87db614a49253743e1a59efedafc9f87c9a
plan_head_after: a572ca2eced8285ece1c03c66c7b67417031aa0e
tech-stack:
  added: []
  patterns:
    - "거절 응답은 시민·마피아가 같은 두 프레임([error:BAD_MESSAGE, state]) — 마피아 떠보기 플래그(keywordProbed)는 저장만 하고 응답·view 에 드러나지 않는다"
    - "초안(answerD)·확정(answerF) 간격 키 분리 + 수락·거절 모두 간격 기록, 간격 안 요청은 오류 없이 버림"
    - "답 처리는 persistAndBroadcast 를 부르지 않는다: 저장 한 번 + 보낸 본인에게만 sendViewTo (D-10)"
key-files:
  created:
    - test/unit/keywordAnswer.test.ts
    - test/worker/keywordLeak.test.ts
  modified:
    - shared/game/keywordAnswer.ts
    - shared/game/room.ts
    - shared/game/tick.ts
    - shared/protocol.ts
    - shared/schemas.ts
    - shared/game/view.ts
    - worker/room.ts
    - scripts/e2e/lib.mjs
    - scripts/smoke.mjs
    - test/unit/schemas.test.ts
    - test/unit/view.test.ts
    - test/unit/keywordFlow.test.ts
    - test/unit/soundProtocol.test.ts
    - test/worker/keyword.test.ts
    - test/worker/leak.test.ts
key-decisions:
  - "day.keyword 는 keyword 단계 · answerOpenOf · keywordAnswers 가 있을 때(마감 뒤 판 내내) 만든다 — 23-05 이월 처리. 첫날 낮 단계에도 day.keyword = { genre, answers } 가 실린다"
  - "금지어 판정 형태는 keywordEntryOf(단어+별칭), 목록이 바뀌어 없으면 { word, aliases: [] } (RESEARCH P4)"
  - "봇에 남은 answerDraft 가 있어도(있을 수 없음) 마감은 봇을 늘 text null 로 둔다"
requirements-completed: [SC2, SC3, SC7]
---

# Phase 23 Plan 06: 키워드 답 접수·공개·누설 시험 Summary

**keyword 단계의 산 사람은 answer { text, final } 로 초안·확정을 보내고(보낸 본인에게만 응답), 금지어 확정은 시민·마피아에게 같은 두 프레임으로 거절되며(마피아만 서버 전용 keywordProbed 가 켜짐), 마감에 낸 순서 → 쓰던 글 → 답 없음 순으로 모두에게 같은 공개 목록이 나가고, 정답 공개 전에는 마피아 소켓의 어떤 프레임·HTTP 응답에도 키워드가 없음을 한 판 누설 시험으로 고정했다.**

## 해낸 것

- **순수 규칙 (Task 1, D-07·D-09·D-24)**: `submitAnswer` 검사 순서는 계약대로(단계 → 행위자·봇 → 이미 확정이면 같은 객체 → 정리·20자소 → 초안 저장/빈 확정 거절/금지어 거절 → 확정 추가). 마피아가 금지어로 거절되면 반환에 `state: { keywordProbed: true }` 를 싣고, 시민·이미 켜진 경우는 state 없이 같은 `{ ok:false, BAD_MESSAGE }`. `closeKeyword` 는 확정 순서 → 초안(금지어 없음, 좌석 순) → 답 없음(좌석 순, 봇 포함)을 `keywordAnswers` 로 확정하고 `answerSubmits`·모든 `answerDraft` 를 지운다. `RoomState.answerSubmits·keywordAnswers·keywordProbed`, `Player.answerDraft` 추가, tick 에 `keyword: closeKeyword`.
- **와이어·view·방 DO (Task 2)**: `AnswerSendMessage`·`AnswerMessageSchema`(strictObject, text ≤ 300 UTF-16, final 필수 불리언). `KeywordAnswerRow`·`KeywordView.answers`·`MyInfo.answer`. view 는 `day.keyword.answers` 를 keyword 단계 뒤 모두에게 필드별 복사로, `me.answer` 를 keyword 단계 본인에게만(확정 우선, 없으면 초안, 값 있을 때만). 방 DO `case "answer"` → `handleAnswer`/`applyAnswer`: 간격 키 `answerD:`·`answerF:` 분리, 수락·거절 모두 기록, 간격 안은 무응답, 거절에 state 가 있으면 저장 한 번 뒤 오류 반환(`sendRejection` 이 시민과 같은 두 프레임), 수락은 저장 + 본인 `sendViewTo` 뿐 `persistAndBroadcast` 없음. e2e lib 의 `VIEW_ME_KEYS` 에 `answer` 추가.
- **누설 시험 (Task 3, SC7)**: `keywordLeak.test.ts` ①~⑥ 과 `SERVER_ONLY_KEYS` 세 곳(leak.test·view.test·smoke)에 `keywordProbed·answerSubmits·answerDraft`, leak.test 에 키워드 공개 경로 허용 목록(받을 권리 주석)과 고정 시험.

## 커밋

| 순서 | 해시 | 내용 |
| ---- | ---- | ---- |
| 1 (RED) | a2fc6447 | `test(23-06): 답 제출·마감 규칙 실패 시험` — **15건 전부 실패**(submitAnswer·closeKeyword 미존재) |
| 2 (GREEN) | a822dc0b | `feat(23-06): 답 제출·마감 규칙` |
| 3 (RED) | b279542e | `test(23-06): answer 메시지·view·DO 본체 실패 시험` — schemas 1·view 2·worker 3 실패(총 6건; 거절 모양·채팅 무필터 등 이미 통과하는 방어 단언 포함) |
| 4 (GREEN) | 0fd35bc3 | `feat(23-06): 키워드 답 메시지 — 초안·확정·거절·공개 목록` |
| 5 (시험) | 757ff432 | `test(23-06): 키워드 누설 시험` — 서버가 이미 맞아서 첫 실행에서 초록(아래 변이 확인) |
| 6 (GREEN) | a572ca2e | `feat(23-06): 키워드 누설 감시선` |

- **Task 3 RED 대신 변이 확인(계획 허용)**: 누설 시험이 처음부터 초록이라, 임시로 서버를 망가뜨려 시험이 빨개지는지 확인하고 되돌렸다(커밋하지 않음).
  - 변이 A — view.ts 의 `me.keyword` 에서 `me.role !== "mafia"` 조건 제거: ①·③④·⑤ 세 시험 실패(마피아 프레임에 단어, me 키 차이, 거절 프레임에 단어).
  - 변이 B — 마피아 떠보기 거절 코드를 `BAD_MESSAGE` → `WRONG_PHASE`: ⑤ 실패(두 프레임 열이 갈라짐).
  - 두 변이 모두 원복했고 `git status` 로 파일이 HEAD 와 같음을 확인했다.

## 검증 결과

| 확인 | 결과 |
| ---- | ---- |
| Task 1 automated: keywordAnswer·keywordFlow·rematch + typecheck | 3 files · 62 tests 통과, typecheck 에러 0 |
| Task 2 automated: schemas·view·e2eContract·worker keyword·chat + typecheck | 5 files · 435 tests 통과(11 skipped) |
| Task 3 automated: keywordLeak·leak·view + `node --test scripts/smoke.test.mjs` + typecheck | 141 tests 통과(13 skipped), smoke node 15/15 |
| `npx vitest run --project worker` | 47 files · 525 tests 통과(62 skipped). 첫 실행에서 알려진 부하 간헐 1건(`basicDay` 토론 끝내기 과반…) — 단독 재실행 6/6 통과, 이후 전체 재실행에서 통과 |
| `npx vitest run --project unit --project client` | 201 files · 6833 tests 통과(176 skipped) |
| `node --test scripts/*.test.mjs scripts/e2e/*.test.mjs` | 636/636 통과 |
| 승인 기준 grep | `export function closeKeyword` 1 · `keyword: closeKeyword` 1 · `keywordProbed` room.ts 1·leak/view/smoke 각 1 이상 · `AnswerMessageSchema` 2 · `case "answer"` 1 · applyAnswer 구간의 `persistAndBroadcast` 0 · lib.mjs `"answer"` 1 · `testRole` keywordLeak 2 |

## 누설 시험 ①~⑥ 결과 (SC7)

| # | 내용 | 결과 |
| - | ---- | ---- |
| ① | 사람 4명 판(고정 키워드 해리포터)에서 마피아가 확정으로 단어·별칭을 떠보고 시민이 답을 낸 뒤 verdict 까지 — 정답 공개 직전까지 모든 마피아 소켓의 전 프레임 원문에 `해리포터`·`Harry Potter`·`해포` 0건. 시민 keyword 단계 프레임에는 단어 있음(검사가 살아 있음), 서버 전용 이름 3종은 모든 소켓 프레임에 키로 없음. 정답 공개 뒤에는 마피아 view 에 정답이 처음 닿음 | 통과 |
| ② | keyword 단계·verdict 단계의 비인증 `GET /api/rooms/:code` 본문에 단어·별칭 없음 | 통과 |
| ③ | keyword 단계 모든 소켓의 `view.day.keyword` 키 집합이 같다(`genre`)·값도 같다 | 통과 |
| ④ | 마피아·시민 `view.me` 키 차이 중 키워드 관련은 `keyword` 한 키뿐(`answer` 는 양쪽 모두 없음). 구조 키 `allies`·`records` 는 이 계획 이전부터 있던 역할별 키 | 통과(계획 문구와 다른 점은 아래 Deviations) |
| ⑤ | 시민·마피아가 각각 단어로 확정 → 두 소켓 모두 `[error:BAD_MESSAGE,state:keyword]`, 오류 프레임 원문 동일, 마피아의 거절 뒤 state 는 거절 전 view 와 휘발 필드(serverNow)만 다름, 다른 소켓 0프레임, `keywordProbed` 는 마피아 거절 뒤에만 저장됨(시민만 거절된 시점에는 키 없음) | 통과 |
| ⑥ | 방장 testRole 만 마피아/시민으로 다른 두 판(같은 고정 키워드)의 방장 소켓 `day.keyword` 열(연속 중복 제거)이 같고 단어가 열에 없음 | 통과 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] day.keyword 를 마감 뒤에도 만들도록 넓힘으로 깨진 기존 시험 기대값**
- **Found during:** Task 2 GREEN(전체 unit 실행)
- **Issue:** 23-05 이월대로 `day.keyword` 가 keyword 마감 뒤 판 내내 `answers` 와 함께 실리게 되어, dayAnnounce·discussion 등의 day 키 단언(`view.test` 5곳)·`keywordFlow` 정답 view 단언·worker `keyword.test` 의 정답 공개 단언이 정확히 `{ genre, answer }` 를 요구해 깨졌다. 또 `answer` 메시지 종류를 더하자 `soundProtocol.test` 의 "클라이언트 메시지 종류 목록 고정" 이 실패했고, `view.test` 의 `ME_KEYS` 에 `answer` 가 없어 `e2eContract` 대조가 실패했다.
- **Fix:** 새 규칙에 맞춰 기대값을 갱신하고(`phaseKeyViolations` 가 answers 키·값, me.answer 존재·값을 검사하도록 넓힘), `soundProtocol` 목록에 `answer` 를 더함.
- **Commit:** 0fd35bc3

**2. [작은 설계 선택] ④ 의 "keyword 한 키뿐" 은 역할 구조 키를 뺀 값**
- 계획은 마피아·시민 `view.me` 키 집합 차이가 `keyword` 한 키뿐이라고 적었으나, 실제로는 마피아가 `allies`(동료 좌석)·`records`(암살일지)를 원래부터 더 가진다. 시험은 "차이 중 `allies`·`records` 를 뺀 나머지가 정확히 `keyword`" 로 단언한다 — 키워드가 만드는 차이가 한 키뿐임은 그대로 고정된다.

**3. [시험 설계] ① 에서 마피아의 초안에는 단어를 넣지 않음**
- 마피아가 직접 친 초안은 본인 `me.answer` 로 되돌아온다(본인이 쓴 글이라 정답 정보가 아니다). 단어가 든 초안을 쓰면 본인 입력의 반사가 "마피아 프레임에 단어" 로 잡혀 시험이 흐려진다. 확정 떠보기(저장·반사 없음)로 거절 경로를 지나고, 단어가 든 초안이 마감에 나가지 않는 것은 unit(`keywordAnswer`·`view`)이 지킨다.

**4. [계획 문구 보강] 자유 채팅 무필터 시험은 RED 에서도 이미 통과**
- D-26 은 새 코드가 아니라 "걸지 않는다" 라서 `keyword.test` 의 채팅 줄 단언은 RED 커밋에서도 통과했다(방어 시험으로 남김).

### 계획과 같게 한 것
- 간격은 수락·거절 모두 기록, 초안·확정 키 분리, 간격 안은 무응답, 거절의 state 저장은 한 번, 응답 모양은 둘이 같음.
- 마감이 줄어드는 조기 진행 호출 자리는 만들지 않았다(23-08). `applyAnswer` 안에는 `persistAndBroadcast`·`reschedule` 이 없다.

## 이월 · 확인하지 못한 것

- **23-08**: `applyAnswer` 의 수락 지점에 `maybeAdvanceEarly` 호출(키워드: 산 사람 중 사람 전원 확정)을 붙인다. 그때 조기 마감은 전원 방송이라 새 신호가 되지 않게 D-11·D-13 규칙을 따를 것.
- **`bots.test.ts` allowed 목록**(23-01 이월): 이 계획의 봇 시험은 keyword 단계를 지나 dayAnnounce 까지만 돌려서 허용 목록 영향이 없었다. 키워드를 켠 봇 판을 끝까지 돌리는 시험이 생기면 `keyword`·`answerReveal` 을 더해야 한다.
- **타이밍 부채널**: 마피아 떠보기 거절은 `storage.put` 이 한 번 더 있어 서버 처리 시간이 시민 거절보다 미세하게 길 수 있다(응답 모양·프레임 수는 같다). 소켓 왕복의 흔들림이 이를 압도하고 400ms 간격·메시지 속도 제한(20/초)이 시도 횟수를 묶어 위협 T-23-18 의 mitigate 범위로 보고 별도 보정은 넣지 않았다. 결정 기록(0091)에 한 줄 남기는 것을 23-12 에 권한다.
- **탈락 후 e2e·화면**: 입력 화면(23-09)·공개 카드(23-10·23-11)는 이 계획 범위 밖이다. 로컬 dev 서버·실기기·E2E 브라우저 실행·배포는 하지 않았다(사용자 지시: 배포 없음, 실기기는 끝에).
- `.planning/state.json`·`Claude outputs/` 는 이 계획의 변경이 아니라서 스테이징하지 않았다. STATE.md·ROADMAP.md 도 건드리지 않았다(오케스트레이터 소유).

## Known Stubs

없음.

## Threat Flags

없음. 새 표면은 계획의 위협 모델이 다룬 `answer` 소켓 메시지 하나뿐이고, T-23-18~23 은 mitigate 대로 닫았다: T-23-18 keywordLeak ⑤(같은 두 프레임·view 불변), T-23-19 keyword.test 의 다른 소켓 0프레임 단언, T-23-20 keywordLeak ①②③④⑥, T-23-21 zod strictObject·sanitizeChatText·20자소, T-23-22 400ms 간격(수락·거절 모두, 키 분리)·같은 값 무저장, T-23-23 submitAnswer 의 단계·생존·봇 검사와 첫 확정 불변(unit). T-23-24 는 accept(채팅 무필터, D-26).

## Self-Check: PASSED

- 파일 존재: shared/game/keywordAnswer.ts · shared/protocol.ts · shared/schemas.ts · shared/game/view.ts · worker/room.ts · test/unit/keywordAnswer.test.ts · test/worker/keywordLeak.test.ts · scripts/e2e/lib.mjs · scripts/smoke.mjs
- 커밋 존재: a2fc6447 · a822dc0b · b279542e · 0fd35bc3 · 757ff432 · a572ca2e
