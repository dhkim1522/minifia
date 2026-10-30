---
phase: 03-night-morning
plan: 04
subsystem: game-core
tags: [tdd, tracer, night, chat, templates, sender-rules, claim, elimination]
status: complete

requires:
  - phase: 03-night-morning/03-01
    provides: PhaseId night·morning, RoomState.nextNightSeq(타입), 와이어 계약
  - phase: 03-night-morning/03-03
    provides: enterNight 가 nextNightSeq 를 밤마다 지움, nightChatRecipientIds
provides:
  - TEMPLATE_IDS 에 밤 전용 nightTarget·nightAgree·nightOther (shared/protocol.ts) — z.enum(TEMPLATE_IDS) 로 스키마가 자동으로 따라온다
  - QUICK_TEMPLATES 의 when 칸("day" | "night")과 say 의 때 검사(템플릿의 when 이 지금 단계 종류와 다르면 BAD_MESSAGE)
  - senderOf 거부 규칙 하나 — 틀린 단계 WRONG_PHASE(누구든), 맞는 단계의 탈락자 BAD_MESSAGE, 밤의 살아 있는 비마피아 WRONG_PHASE (shared/game/chat.ts)
  - 밤 줄 번호 nextNightSeq(밤 say 가 사용·증가, nextMessageSeq 는 밤에 불변)
  - selectClaim 의 탈락자 거부 — 단계 → 방 소속 → 생존 → 선택지 → 같은 값 (shared/game/claim.ts)
  - NIGHT_TEMPLATE_ORDER, 밤 TEMPLATE_CHIP 세 개, messageText 밤 case 세 개 (src/game/messageText.ts)
affects: [03-06, 03-07, 03-08, 03-09, 03-10]

tech-stack:
  added: []
  patterns:
    - "템플릿 표에 때(when)를 데이터로 둬서 낮·밤 문구 분리를 if 문이 아니라 표 한 칸으로 검사한다. 새 문구는 TEMPLATE_IDS 와 이 표에 행을 더하면 된다"
    - "거부 코드는 한 규칙의 순서(단계 → 보낸 사람 → 템플릿·값)로만 정한다 — selectClaim·say·emote·pickTarget(03-03)이 같은 순서를 따른다"
    - "테스트 실패 출력은 한 줄 문자열(join·String)로 만든다. 객체 toEqual 의 여러 줄 diff 는 TAP RED 증거를 깨뜨린다(첫 시도에서 TEMPLATE_CHIP 비교를 문자열로 바꿨다)"

key-files:
  created: []
  modified:
    - shared/protocol.ts
    - shared/game/chat.ts
    - shared/game/claim.ts
    - src/game/messageText.ts
    - test/unit/chat.test.ts
    - test/unit/claim.test.ts
    - test/unit/messageText.test.ts

key-decisions:
  - "밤 템플릿 ID 는 nightTarget·nightAgree·nightOther(서버 상태 필드 nightPick 과 헷갈리지 않게). 와이어 값이라 바꾸려면 서버·화면을 한 배포에서 함께 고친다 — 결정 0020(03-09)에 기록"
  - "거부 코드 규칙 하나: 틀린 단계면 누구든(살아 있든 탈락했든) WRONG_PHASE, 맞는 단계에서 보낸 사람이 방에 없거나 탈락자면 BAD_MESSAGE, 밤에 살아 있는 비마피아의 say·emoji 는 WRONG_PHASE. 그래서 아침·직업 공개 단계의 탈락자 say 는 WRONG_PHASE, 낮 토론·밤의 탈락자는 BAD_MESSAGE, claim 단계의 탈락자 claim 은 BAD_MESSAGE (결정 0016 A4 확정)"
  - "밤 채팅 줄 번호는 nextNightSeq 에서 나오고 낮 nextMessageSeq 는 밤에 바뀌지 않는다 — 낮 chat 프레임 seq 간격으로 밤 메시지 수를 셀 수 없다(T-03-40)"
  - "chat.ts 가 역할을 읽는 곳은 밤 보낸 사람 규칙(살아 있는 마피아만) 하나뿐이다. 주장의 참·거짓은 여전히 보지 않는다(D-10)"

requirements-completed: []

duration: 약 20분
completed: 2026-10-25

coverage:
  - id: C1
    description: "밤에 살아 있는 마피아의 nightTarget(대상은 동료도 가능)·nightAgree·nightOther 와 이모티콘이 서버 규칙을 통과해 한 줄이 되고, 칸 요구(nightAgree·nightOther 는 target 불가)가 표대로다. 화면 문장 표가 같은 템플릿 ID 로 '{닉네임} 지목해요'·'동의해요'·'다른 사람을 지목해요' 를 만들고 낮 칩 다섯 개와 순서는 그대로다"
    requirement: "COMM-04"
    verification:
      - kind: unit
        ref: "test/unit/chat.test.ts#QUICK_TEMPLATES - 템플릿 표 (D-11, COMM-01)"
        status: pass
      - kind: unit
        ref: "test/unit/chat.test.ts#밤 빠른 메시지 - 살아 있는 마피아 (D-17, 결정 0019, COMM-04)"
        status: pass
      - kind: unit
        ref: "test/unit/messageText.test.ts#messageText: 템플릿 → 문장"
        status: pass
    human_judgment: false
  - id: C2
    description: "거부 규칙 하나가 표로 고정된다: 단계 → 보낸 사람 → 템플릿·값 순서, 아침·claim 에서는 탈락자도 WRONG_PHASE, 낮 토론·밤의 탈락자는 BAD_MESSAGE, 밤의 살아 있는 시민·경찰·의사는 WRONG_PHASE, 때가 다른 템플릿(낮 문구를 밤에, 밤 문구를 낮에)은 BAD_MESSAGE, 대상은 본인·빈 자리·탈락자 불가, 낮·밤이 lastSendAt 하나(1799ms 거부·1800ms 통과)를 보며 거부는 상태를 바꾸지 않는다"
    requirement: "ELIM-01, COMM-04"
    verification:
      - kind: unit
        ref: "test/unit/chat.test.ts#거부 코드는 규칙 하나 - 단계 → 보낸 사람 → 템플릿·값 (ELIM-01, COMM-04, 결정 0016)"
        status: pass
    human_judgment: false
  - id: C3
    description: "탈락자는 직업 공개 선택(claim)도 할 수 없다 — claim 단계의 탈락자는 BAD_MESSAGE 이고 상태가 그대로이며, 다른 단계(discussion·night·morning 등)는 누구든 WRONG_PHASE, 방에 없는 id 는 BAD_MESSAGE, 탈락자가 선택지 밖 값을 보내도 BAD_MESSAGE"
    requirement: "ELIM-01"
    verification:
      - kind: unit
        ref: "test/unit/claim.test.ts#selectClaim - 선택 검증 (D-03, D-10, T-02-05)"
        status: pass
    human_judgment: false
  - id: C4
    description: "밤 마피아 채팅은 nextNightSeq(밤마다 1부터)로 번호가 매겨지고 낮 nextMessageSeq 는 밤에 바뀌지 않아 밤 채팅이 몇 줄이든 다음 낮 첫 메시지 seq 가 밤 채팅이 없을 때와 같다. 낮 say·밤 emote 는 nextNightSeq 를 바꾸지 않는다"
    requirement: "COMM-04"
    verification:
      - kind: unit
        ref: "test/unit/chat.test.ts#밤 채팅 번호 (PLAN-CHECK W3, D-17, 결정 0002·0019)"
        status: pass
    human_judgment: false
  - id: C5
    description: "방 DO 소켓에서 실제로 마피아에게만 방송되는 것, 그 방송에 이 규칙을 거는 것, 밤 채팅 화면은 이 계획 범위 밖이다 — 03-07(방송)·03-06·03-08(화면)·03-09(누출 검사)·03-12(배포본 확인)"
    requirement: "COMM-04, ELIM-01"
    human_judgment: true
    rationale: "이 계획은 순수 서버 규칙과 화면 문장 표까지다. 밤 메시지가 폰까지 오가고 마피아가 아닌 사람에게 가지 않는 경로는 아직 없다"

actuals:
  tokens: 8300
  tasks: 3
  commits: 6
plan_head_before: 0455ea28e69b973c38a10a23488739429be5a4a4
plan_head_after: 0d0bfbaa297de23178d7d717ac0fc8aac73f4605
---

# Phase 3 Plan 04: 밤 채팅 규칙과 탈락자 거부 Summary

**밤에는 살아 있는 마피아만 밤 전용 문구 세 개(nightTarget·nightAgree·nightOther)로 말하게 하고, 거부 코드를 단계 → 보낸 사람 → 템플릿·값의 규칙 하나로 맞췄으며, 탈락자의 직업 공개도 막고, 밤 줄 번호를 낮 번호와 분리해 낮 seq 간격으로 밤 메시지 수를 알 수 없게 했다.**

## Performance

- **Duration:** 약 20분 (2026-10-25)
- **Tasks:** 3 (Task 1 트레이서 TDD, Task 2 TDD, Task 3 TDD)
- **Files:** 소스 4개(protocol·chat·claim·messageText), 테스트 3개(chat·claim·messageText), 스키마(`shared/schemas.ts`)는 BASE 와 동일

## Accomplishments

- `shared/protocol.ts`: `TEMPLATE_IDS` 가 여덟 개가 됐다(낮 다섯 + 밤 세 개). `shared/schemas.ts` 는 `z.enum(TEMPLATE_IDS)` 로 따라오므로 한 줄도 고치지 않았다(`git diff --quiet BASE -- shared/schemas.ts` exit 0).
- `shared/game/chat.ts`: `QUICK_TEMPLATES` 에 `when` 칸을 더하고, `say` 가 템플릿 고유 속성 검사 바로 뒤에 "템플릿의 when 이 지금 단계 종류(night 면 night, 아니면 day)와 같은지" 를 본다. `senderOf` 는 discussion·night 만 통과시키고 방에 없거나 탈락이면 BAD_MESSAGE, 밤에 마피아가 아니면 WRONG_PHASE 다. 머리 주석은 "역할은 밤 보낸 사람 규칙에서만 읽는다(D-10 유지)" 로 고쳤고 A4 예고 주석은 확정 문장으로 바꿨다.
- `shared/game/claim.ts`: `selectClaim` 이 행위자를 찾은 뒤 `!isAlive(actor)` 면 BAD_MESSAGE. 단계가 먼저라 틀린 단계의 탈락자는 WRONG_PHASE 이고, 생존 검사가 값 검사보다 앞이다.
- `shared/game/chat.ts` 밤 번호: 밤 say 는 `nextNightSeq ?? 1` 을 번호로 쓰고 `nextNightSeq: seq + 1` 만 올린다. 낮은 지금처럼 `nextMessageSeq`. 밤 emote 는 두 번호 모두 건드리지 않는다. 머리 주석에 저장되는 것이 lastSendAt 과 줄 번호(낮·밤 따로)임을 적었다.
- `src/game/messageText.ts`: `NIGHT_TEMPLATE_ORDER`(밤 칩 순서 한 곳), 밤 칩 글자 세 개, `messageText` 의 밤 case 세 개. `TEMPLATE_ORDER` 는 낮 다섯 그대로다.
- 전체 회귀: `npx vitest run` 57 파일·1160 테스트 통과(기준선 1135), `npm run typecheck` 통과.

## Task Commits

| Task | 커밋 | 내용 |
|------|------|------|
| 1 RED | `898695e` test(03-04) | 여덟 키 표(칸·때), 밤 마피아 say·emote 통과, 밤 칩·문장 |
| 1 GREEN | `145a1ec` feat(03-04) | TEMPLATE_IDS 밤 세 개, QUICK_TEMPLATES.when, 단계×역할 senderOf, 밤 칩 |
| 2 RED | `2161ea4` test(03-04) | 거부 규칙 표, 아침 WRONG_PHASE, 탈락자 selectClaim |
| 2 GREEN | `7d488e1` feat(03-04) | selectClaim 생존 검사, senderOf 규칙 주석 확정 |
| 3 RED | `a2676df` test(03-04) | 밤 채팅 번호 분리(nextNightSeq) |
| 3 GREEN | `0d0bfba` feat(03-04) | 밤 say 가 nextNightSeq 사용, nextMessageSeq 불변 |

`commits: 6` 은 `git rev-list --count ${plan_head_before}..HEAD` 로 측정한 값이다(SUMMARY 커밋 전). `actuals.tokens` 는 변경 diff 의 chars/4(약 33,400자)다.

## TDD Gate Compliance

| Task | RED | GREEN | 증거 |
|------|-----|-------|------|
| 1 | `898695e` test(03-04) | `145a1ec` feat(03-04) | `gsd-tools check tdd-red-evidence` → `RED_EVIDENCE_OK`(tap-flat, 대상 "마피아(seat 1)의 nightTarget 은 target 만 담은 한 줄이 된다", 73건 중 8건 실패) |
| 2 | `2161ea4` test(03-04) | `7d488e1` feat(03-04) | `RED_EVIDENCE_OK`(대상 "claim 단계에서 탈락자(alive false)의 selectClaim 은 BAD_MESSAGE 이고 상태는 그대로다", 1건 실패) |
| 3 | `a2676df` test(03-04) | `0d0bfba` feat(03-04) | `RED_EVIDENCE_OK`(대상 "같은 일차에 낮 nextMessageSeq 가 5 였다면 밤 세 줄 뒤 다음 낮 첫 say 의 seq 도 5 다 …", 4건 실패) |

semanticAssessment (Task 1): 8건이 계획된 새 동작에서 실패했다 — 여덟 키 표(`expected 5 to be 8`), 밤 마피아의 say·emote(`expected 'WRONG_PHASE' to be 'ok'`), nightAgree·nightOther 의 칸 검사, 밤 칩·문장(`expected undefined …`, NIGHT_TEMPLATE_ORDER 미존재). import 해결·문법 오류가 아니라 단언 실패다. 첫 시도에서 `TEMPLATE_CHIP` 를 객체 `toEqual` 로 비교해 TAP 의 `actual:` 이 여러 줄이 됐다 — 한 줄 문자열 비교로 바꾼 뒤(구현 코드는 건드리지 않았다) 증거를 받았다.

semanticAssessment (Task 2): 이 RED 는 사실상 한 건만 실패한다 — claim 단계의 탈락자 selectClaim 이 `ok` 를 돌려준다(`expected 'ok' to be 'BAD_MESSAGE'`). 거부 규칙 표(chat.test.ts)와 아침 WRONG_PHASE 줄은 Task 1 GREEN 이 senderOf 를 이미 단계×역할로 만들어 통과했고, 계획이 이를 예상했다("이미 Task 1 로 통과하는 줄이 있어도 탈락자 claim·때 불일치 단언에서 실패하면 된다"). 통과한 단언은 거부 코드 표를 회귀로 고정하는 용도다. 때 불일치(낮 문구를 밤에 등)는 Task 1 의 when 검사로 이미 통과했다.

semanticAssessment (Task 3): 밤 say 가 낮 번호 nextMessageSeq 를 써서 실패했다 — 첫 줄 `'5/undefined/6'`(기대 `'1/2/5'`), 세 줄 `'5,6,7/undefined/8'`, 다음 낮 seq `'8/5'`(기대 `'5/5'`), nextNightSeq 이어받기 `'1/1'`(기대 `'1/7'`). 밤 emote·낮 say 의 불변 단언은 이미 통과했다(회귀 고정).

트레이서 게이트: auto 모드가 아니고 `human_verify_mode` 가 end-of-phase 이며 Task 1 의 `<verify>` 가 자동 검사뿐이라 `npx vitest run test/unit/chat.test.ts test/unit/messageText.test.ts test/client/quickMessageSheet.test.tsx`(92건 통과)·`npm run typecheck`·전체 `npx vitest run`(1140건)을 다시 돌려 통과를 확인하고 Task 2 로 넘어갔다 — Tracer verified end-to-end.

## Deviations from Plan

None - plan executed exactly as written.

세부 선택(편차 아님): (1) Task 1 GREEN 의 `senderOf` 가 이미 최종 규칙(단계 → 방 소속·생존 → 밤 마피아)이라 Task 2 GREEN 은 selectClaim 생존 검사와 주석 확정만 남았다(계획의 Task 1 서술이 그 형태를 요구했다). (2) 계획의 "탈락을 만들 때 확정" 문구는 이 저장소 HEAD 의 주석이 달라 Task 1 에서 함께 바뀌었다(인수 기준 grep 0). (3) `requirements mark-complete` 는 부르지 않았다: ELIM-01 은 지시대로 보류하고(뷰·소켓·화면이 아직 없다), COMM-04 도 밤 방송 범위 제한(03-07)·누출 검사(03-09)가 남아 사용자 경로로 끝나지 않았다. (4) HANDOFF.md 는 계획 지시대로 고치지 않았다.

## Issues Encountered

없음. RED 증거 기록 형식 문제 한 건은 위 TDD 절에 적었다. BSD sed 의 `\n` 치환 실패로 claim.ts import 를 한 번 놓쳐 전체 테스트가 실패했지만 GREEN 커밋 전에 Python 으로 고쳐 통과를 확인했다.

## Known Stubs

없음. 이 계획이 만든 코드에는 빈 값·자리표시자가 화면으로 흐르는 곳이 없다. 밤 칩·문장은 아직 화면(QuickMessageSheet 밤 시트)에 연결되지 않았고 그 연결은 03-06·03-08 의 일이다(`NIGHT_TEMPLATE_ORDER` 는 그때까지 쓰는 곳이 테스트뿐이다).

## Threat Flags

없음. 새 네트워크 입구·인증 경로가 없고 계획의 T-03-11(밤 보낸 사람은 생존 마피아만, 비마피아는 WRONG_PHASE)·T-03-12(탈락자 say·emote·claim BAD_MESSAGE, 거부는 상태 불변)·T-03-13(when 불일치 BAD_MESSAGE, 스키마 변경 없음)·T-03-40(nextNightSeq 분리, 낮 번호 불변)·T-03-SC(새 패키지 없음)가 모두 적용됐다. 방송 범위 제한은 03-07 몫이다.

## Self-Check: PASSED

- 수정 파일 7개 존재 확인, 커밋 6개(`898695e`, `145a1ec`, `2161ea4`, `7d488e1`, `a2676df`, `0d0bfba`) 모두 HEAD 의 조상임을 확인
- 계획 인수 기준 통과: `"nightTarget", "nightAgree", "nightOther"` protocol.ts 1건, `when: "night"` 3·`when: "day"` 6(표 다섯 행 + 타입 줄), `export const NIGHT_TEMPLATE_ORDER` 1, claim.ts 코드 줄의 `isAlive(` 1, `탈락을 만들 때 확정` 0, chat.test.ts 의 `"morning"` 4, `nextNightSeq` chat.ts 3·chat.test.ts 12, `shared/schemas.ts` BASE 와 동일, 각 `test(03-04)` 커밋이 해당 `feat(03-04)` 커밋보다 앞
- 전체 검증: `npx vitest run` 1160 통과, `npm run typecheck` 통과

## Next Phase Readiness

03-06·03-08(화면)은 `NIGHT_TEMPLATE_ORDER`·밤 `TEMPLATE_CHIP`·`QUICK_TEMPLATES[..].when` 으로 밤 시트를 만들고, 밤 줄 중복 제거는 (일차, 단계) 마다 따로 센다. 03-07(워커)은 `say`·`emote` 결과를 `nightChatRecipientIds`(03-03)에게만 보낸다. 결정 0020(03-09)에 밤 템플릿 ID 세 개와 거부 코드 규칙 하나를 기록한다.
