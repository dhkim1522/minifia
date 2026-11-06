---
phase: 07-free-chat
plan: "02"
subsystem: realtime-chat
tags: [audience, channelOf, phaseKey, chatRules, chatLog, replay-mask, tdd, vitest, typescript]

requires:
  - phase: 07-free-chat
    plan: "01"
    provides: "결정 0058 (채팅 서버 보관·재접속 채널별 30줄 복원) — 보관 상수와 마스크 규칙의 출처"
  - phase: 06-world-skeleton
    provides: "emitWorld 의 수신자 규칙(로비의 방 사람 전원) — audience({k:'world'}) 가 같은 집합을 낸다"
provides:
  - "shared/game/audience.ts: CHAT_PHASES, phaseKey, channelOf, audience, AudienceEvent — 채팅·입력 중·동작·위치 수신자의 단일 함수"
  - "shared/game/chatRules.ts: D5 상수 6개, sanitizeChatText, checkChatSend, typingRelay"
  - "shared/game/chatLog.ts: 채널별 연번·수신자 마스크·채널별 30줄 복원·보관 상한·저장 키·복원"
  - "shared/protocol.ts: 새 와이어 타입 13개(아직 ClientMessage·ServerMessage 유니온 밖)"
affects: [07-03, 07-05, 07-08, 07-10, 07-11, 07-12, 07-13, 07-14, 08-vote-screens, 09-night-screens, 10-emotes, 11-result]

actuals:
  tokens: 15000
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "수신자 결정은 audience 한 함수 — 호출부는 결과 집합에만 보내고 화면은 거르지 않는다"
    - "채널은 보낸 사람의 서버 상태로만 정한다(클라이언트 채널 입력 없음), 단계 키 pk 불일치는 폐기(재분류 금지)"
    - "복원은 보낼 때의 수신자 좌석 비트마스크로만 한다(복원 <= 라이브)"
    - "순수 모듈: 시각·난수는 인자, 입력 불변, 저장 I/O 없음(DO 가 chatKey 로 한다)"

key-files:
  created:
    - shared/game/audience.ts
    - shared/game/chatRules.ts
    - shared/game/chatLog.ts
    - test/unit/audience.test.ts
    - test/unit/chatRules.test.ts
    - test/unit/chatLog.test.ts
  modified:
    - shared/protocol.ts

key-decisions:
  - "channelOf 는 밤의 산 비마피아에게 null 을 준다 — 호출부는 chatReject{phase} 로 폐기하고 all 로 돌리지 않는다"
  - "sanitizeChatText 는 채움 문자(U+115F U+1160 U+3164 U+FFA0 U+2800)를 거절하지 않고 공백으로 접는다 — 글자 사이 위장도 막고 채움 문자만 입력은 other"
  - "checkChatSend 의 간격 기준은 마지막 수락 시각이고 거절은 기록을 만들지 않는다(A1)"
  - "typingRelay 의 1.5초 제한은 켜짐 중계 시각 기준이고 끈 뒤 다시 켜는 것에도 적용한다(조용히 거름)"
  - "chatLog 상한을 넘기면 그 채널의 오래된 20줄(상한을 20 넘게 넘었다면 넘은 만큼)의 g 를 evicted 로 돌려준다, 번호는 되돌아가지 않는다"

patterns-established:
  - "TDD RED 증거: vitest --reporter=tap-flat + gsd-tools check tdd-red-evidence. 테스트 비교는 스칼라/한 줄 문자열로 한다(여러 줄 diff 는 TAP 파서를 깨뜨림)"
  - "RED 커밋에는 테스트 + 모양만 둔 뼈대(스텁)와 타입을 함께 넣어 어서션 실패로 RED 를 만든다"

requirements-completed: [CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-05]

coverage:
  - id: D1
    description: "audience/channelOf/CHAT_PHASES/phaseKey — 단계 x 생존 x 역할 표 전수로 채팅·입력 중·동작·위치의 받는 사람과 채널이 서버 상태만으로 정해진다"
    requirement: "CHAT-02"
    verification:
      - kind: unit
        ref: "test/unit/audience.test.ts (42 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "chatRules — 정리(NFC·제어·서식·채움 문자)·자소 100·600ms·5초 5줄·같은 문장 3초·입력 중 1.5초"
    requirement: "CHAT-05"
    verification:
      - kind: unit
        ref: "test/unit/chatRules.test.ts (29 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "chatLog — 채널별 연번·수신자 마스크·채널별 30줄 복원·보관 상한·저장 키·손상 복원, 8좌석 대본 성질 테스트"
    requirement: "CHAT-03"
    verification:
      - kind: unit
        ref: "test/unit/chatLog.test.ts (37 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "protocol.ts 의 새 와이어 타입 — 채널·seat 필드가 클라이언트 메시지에 없고 id·role·마스크 키가 없는 모양"
    requirement: "CHAT-04"
    verification:
      - kind: other
        ref: "npm run typecheck (앱·워커 두 tsconfig) + test/unit/chatLog.test.ts#toWire 키 단언"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-11-01
status: complete
plan_head_before: 77635cbf5ff9402a2978a5f7366437d3853b94c4
plan_head_after: 82c85cf347bd13d3cf546b490641aff0ea01ef06
commits: 6
---

# Phase 7 Plan 02: 채널·수신자·제한·보관 규칙 Summary

**"누가 무엇을 받는가"를 audience 한 함수와 채널별 마스크 복원으로 고정한 순수 규칙 세 모듈(audience·chatRules·chatLog)을 테스트 먼저 만들어, 서버와 화면이 같은 출처를 쓰게 했다.**

## Performance

- **Duration:** 약 9분 (git 커밋 시각 기준 추정; 시작 시각은 따로 기록하지 못했다)
- **Completed:** 2026-11-01T12:27:30Z (21:27 KST)
- **Tasks:** 3 (트레이서 1 + auto 2, 모두 TDD)
- **Files modified:** 7 (신규 6, 수정 1)
- **Commits:** 6 (test 3 + feat 3)

## Accomplishments

- `audience`·`channelOf`: 밤 마피아 한 줄의 받는 사람이 서버 상태만으로 정해진다. 산 마피아 + 탈락자만 받고 시민·경찰·의사는 집합에 들지 않는다. `CHAT_PHASES` 밖과 밤이 아닌 `mafia` 는 빈 집합(방어 장치), `world` 는 6페이즈 `emitWorld` 와 같은 집합이라 07-10 이 동작 변화 없이 바꿀 수 있다.
- `phaseKey`: `buildView` 의 `{phase, day.n}` 으로 만든 클라이언트 키가 서버 상태 키와 같음을 실제 전이(로비 → 1일차 밤·아침 → 2일차 낮)로 검증했다.
- `chatRules`: D5 상수 6개가 한 파일에 있고, 600ms(599/600), 5초 5줄 경계, 같은 문장 2999/3000ms, 자소 100/101(가족 이모지 포함), 공백만·영폭 공백만·채움 문자만 입력이 모두 테스트로 고정되었다.
- `chatLog`: 채널별 연번(공개 줄 번호에 틈 없음), 좌석 마스크, 채널별 30줄 복원, 채널별 상한(100/300/300)과 20줄 묶음 정리, 6자리 저장 키, 손상 레코드 제거 복원. 8좌석 대본 성질 테스트가 "보낼 때 그 좌석이 받은 줄의 채널별 최근 30줄 == `replayFor`", 새 탈락자는 탈락 전 마피아 줄 0, 산 시민은 mafia·ghost 0 을 고정한다.
- `protocol.ts`: `ChatChannel`, `ChatLineWire`, `ChatRejectWhy`, 프레임·메시지 타입, `CHAT_TEXT_MAX_UTF16`, `PHASE_KEY_MAX`, `EMOTE_IDS`/`EmoteId` 를 유니온 밖에 독립 export 했다.

## Task Commits

| Task | RED (test) | GREEN (feat) |
|------|-----------|--------------|
| 1. 트레이서 audience (CHAT-02·03·01) | `3ffdb87` | `c14ae14` |
| 2. chatRules (CHAT-05·04) | `9e7b080` | `7b22c9d` |
| 3. chatLog (결정 0058) | `5033089` | `82c85cf` |

REFACTOR 커밋은 없다(정리할 중복이 없었다).

**Plan metadata:** 이 SUMMARY 의 docs 커밋.

## TDD Gate Compliance

세 작업 모두 RED → GREEN 순서(`test(07-02)` 3건 -> `feat(07-02)` 3건)를 지켰다. RED 증거는 `vitest --reporter=tap-flat` 보고서를 `gsd-tools check tdd-red-evidence` 에 넣어 모두 `RED_EVIDENCE_OK` (reason `target_test_failed`)를 받았다.

| Task | 목표 테스트 | RED 결과 | 의미 평가(semanticAssessment) |
|------|------------|---------|------------------------------|
| 1 | `audience.test.ts > channelOf > 밤: 산 마피아 = mafia, …` | 42 중 26 실패 | 목표 테스트가 실행되어 `expected null to be 'mafia'` 어서션으로 실패. 뼈대가 null/빈 집합만 돌려주므로 계획한 이유로 실패 |
| 2 | `chatRules.test.ts > sanitizeChatText > 탭·줄바꿈은 공백이 되고…` | 29 중 26 실패 | `expected 'REJECT:other' to be '안녕 하세요'` — 뼈대의 거절 때문에 계획한 어서션이 실패 |
| 3 | `chatLog.test.ts > appendLine > seq 는 채널마다 1부터 따로 세고…` | 37 중 29 실패 | `'0:all0 0:mafia0 …'` 대 `'1:all1 2:mafia1 …'` — 뼈대의 0 번호 때문에 계획한 어서션이 실패 |

RED 에 통과한 테스트(상수 값, 빈 집합이 기대값인 방어 장치 등)는 뼈대가 우연히 만족하는 것이다. 위 목표 테스트들과 나머지 실패 테스트가 GREEN 을 이끌었다.

## Tracer 확인

Task 1 은 `type="tracer"` 라 expansion(Task 2·3) 전에 `<verify>` 를 다시 돌렸다. 자동 모드는 꺼져 있고(`auto_advance=false`) `human_verify_mode=end-of-phase` 에 verify 가 자동 검사뿐이라 체크포인트 없이 `npx vitest run test/unit/audience.test.ts`(42 통과)와 `npm run typecheck`(통과)를 확인하고 이어서 확장했다.

## Files Created/Modified

- `shared/game/audience.ts` - 채널·수신자 단일 함수, `CHAT_PHASES`, `phaseKey`
- `shared/game/chatRules.ts` - D5 상수, 본문 정리, 도배 제한, 입력 중 중계 간격
- `shared/game/chatLog.ts` - 줄 레코드, 채널별 연번, 마스크, 복원, 상한, 저장 키, 저장값 복원
- `shared/protocol.ts` - "7페이즈 자유 채팅 계약" 구역(새 와이어 타입, 유니온은 건드리지 않음)
- `test/unit/audience.test.ts`, `test/unit/chatRules.test.ts`, `test/unit/chatLog.test.ts` - 위 세 모듈의 단위 테스트(108건)

## Decisions Made

- 채널은 밤의 산 비마피아에게 `null` — 호출부(07-10)가 `chatReject{"phase"}` 로 폐기한다. 어떤 경우에도 `all` 로 돌리지 않는다.
- 채움 문자는 닉네임처럼 거절하지 않고 공백으로 접는다(아래 Deviations 1).
- 복원·정리·상한은 모두 보낼 때의 마스크와 채널별 카운터로만 한다. 마스크·g·일차는 와이어로 나가지 않는다(`toWire` 가 필드별 복사).
- `typingRelay` 의 1.5초는 켜짐 중계 시각 기준이다. 끈 직후 다시 켜는 신호도 1.5초 안이면 조용히 거르고, 클라이언트의 주기적 갱신이 이어 준다.

## Deviations from Plan

### Auto-fixed / 판단 사항

**1. [Rule 2 - 보안] 채움 문자를 공백으로 접는다 (플랜은 "채움 문자만 입력 거절")**
- **Found during:** Task 2 (chatRules GREEN)
- **Issue:** 플랜 문구는 "보이는 글자가 없거나 채움 문자만이면 other"였다. 글자 사이에 채움 문자를 끼운 위장(`가ㅤㅤ나`)은 그대로 통과해 화면에 큰 빈칸으로 남는다.
- **Fix:** 채움 문자 5종을 제어·서식 문자와 같은 정규식에서 공백으로 바꾼 뒤 접는다. 채움 문자만 입력은 공백만 남아 `other` 로 거절되므로 플랜의 테스트 표를 모두 만족한다. 테스트 하나(`글자 사이의 채움 문자는 공백으로 접힌다`)를 더했다.
- **Files modified:** `shared/game/chatRules.ts`, `test/unit/chatRules.test.ts`
- **Committed in:** `7b22c9d` (GREEN), `9e7b080` (RED)

**2. [Rule 3 - 차단 해소] RED 커밋에 타입·뼈대 파일을 함께 넣었다**
- **Found during:** Task 1~3 (RED)
- **Issue:** 모듈 파일이 없으면 테스트가 import 오류로 죽어 `fixture_or_load_failure`(INVALID_RED)가 된다. 어서션 실패로 RED 를 만들려면 import 가 되어야 한다.
- **Fix:** 각 RED 커밋에 "모양과 상수만 있는 뼈대"를 넣고, Task 1 의 RED 에는 `protocol.ts` 의 새 와이어 타입(순수 타입, 동작 없음)도 넣었다. 매 커밋이 `npm run typecheck` 를 통과한다. 동작은 GREEN `feat` 커밋에서만 생긴다.
- **Files modified:** `shared/protocol.ts`(`3ffdb87`), 세 모듈 뼈대
- **Committed in:** `3ffdb87`, `9e7b080`, `5033089`

**3. [테스트 작성 방식] 비교를 한 줄 문자열로 했다**
- **Found during:** Task 1 (RED 증거 수집)
- **Issue:** `toEqual(Set/배열)` 의 실패 diff 는 여러 줄이라 vitest TAP 보고서의 YAML 을 깨뜨려 분류기가 `invalid_record`(Malformed TAP)를 냈다.
- **Fix:** 집합·배열 비교를 정렬해 쉼표로 이은 한 줄 문자열(또는 JSON 한 줄)로 바꿨다. 검증 강도는 같다.
- **Files modified:** `test/unit/audience.test.ts` 외 두 테스트 파일
- **Committed in:** `3ffdb87`

**4. [소규모 최적화] 코드 단위 100 이하는 Intl.Segmenter 를 건너뛴다**
- 코드 단위가 100 이하면 자소도 100 이하라 `countGraphemes` 호출을 생략한다. 결과는 같고, 스키마 상한(300) 안에서 서버 비용을 줄인다. (`chatRules.ts`)

---

**Total deviations:** 4 (Rule 2 보안 1, Rule 3 차단 해소 1, 작성 방식·최적화 2)
**Impact on plan:** 플랜의 모든 truths·acceptance 를 만족한다. 1번만 플랜보다 엄격한 쪽이고 나머지는 기능 차이가 없다.

## Issues Encountered

- 같은 문장 반복(3초)은 "마지막 수락 문장"만 기억한다(플랜의 `lastText`). A, B, A 처럼 번갈아 보내면 반복 규칙을 피할 수 있지만 600ms 간격·5초 5줄 규칙이 총량을 묶는다. 9페이즈 팀 테스트에서 문제가 되면 상수 한 곳(`chatRules.ts`)에서 최근 문장 목록으로 넓힌다.
- 저장 시각 `n`(일차)은 세션 로컬이 아니라 인자로만 받는다. 08·09페이즈가 `state.day ?? 0` 을 넘기는 호출부 규약은 07-14 가 정한다.

## Known Stubs

없음. 세 모듈은 완결된 순수 규칙이고, 아직 서버·화면이 부르지 않는 것은 후속 계획(07-10~07-14)의 몫이다.

## Threat Flags

없음. 이 계획은 새 네트워크 경로·인증 경로·파일 접근을 만들지 않는다. 계획의 위협 T-07-02~06 은 다음으로 완화했다: 수신자 표 전수 테스트와 방어 장치(T-07-02), 채널별 seq 와 "틈 없음" 테스트(T-07-03), 마스크 복원과 대본 성질 테스트(T-07-04), 제어·서식·채움 문자 정리(T-07-05), 간격·창·반복 제한(T-07-06). T-07-SC: 패키지를 설치하지 않았다.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 07-10(서버 `deliver(audience(...))`)·07-11(와이어 유니온·스키마)·07-12(`nightChatRecipientIds` 삭제)·07-14(`chat:` 저장·복원)가 이 함수와 타입만 쓰면 된다.
- 이월: `protocol.ts` 의 새 타입은 아직 `ClientMessage`·`ServerMessage` 유니온 밖이다(07-10·07-11). 옛 `ChatLine`·`ChatEvent`·`PhaseId` 의 `claim` 은 건드리지 않았다(07-08·07-11).
- 전체 범위 검증: `npm run typecheck` 통과, `npx vitest run --project unit` 68 파일 1926 통과 1 건너뜀(07-01 커밋 뒤 트리).

## Self-Check: PASSED

- 파일: `shared/game/audience.ts`, `shared/game/chatRules.ts`, `shared/game/chatLog.ts`, `shared/protocol.ts`, `test/unit/audience.test.ts`, `test/unit/chatRules.test.ts`, `test/unit/chatLog.test.ts` 모두 존재.
- 커밋: `3ffdb87`, `c14ae14`, `9e7b080`, `7b22c9d`, `5033089`, `82c85cf` 모두 HEAD 의 조상. `commits: 6` 은 `git rev-list --count 77635cb..HEAD` 로 측정했다.
- 수락 기준: 각 작업의 grep 기준과 `test(07-02)` 커밋 3건(>= 3) 통과.
- 삭제 커밋 없음.

---
*Phase: 07-free-chat*
*Completed: 2026-11-01*
