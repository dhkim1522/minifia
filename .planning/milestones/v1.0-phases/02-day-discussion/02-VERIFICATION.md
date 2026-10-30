---
phase: 02-day-discussion
verified: 2026-10-30T02:30:00Z
status: passed
score: 6/6 must-haves verified
covered_files:
  - .planning/phases/02-day-discussion/02-01-PLAN.md
  - .planning/phases/02-day-discussion/02-01-SUMMARY.md
  - .planning/phases/02-day-discussion/02-02-PLAN.md
  - .planning/phases/02-day-discussion/02-02-SUMMARY.md
  - .planning/phases/02-day-discussion/02-03-PLAN.md
  - .planning/phases/02-day-discussion/02-03-SUMMARY.md
  - .planning/phases/02-day-discussion/02-04-PLAN.md
  - .planning/phases/02-day-discussion/02-04-SUMMARY.md
  - .planning/phases/02-day-discussion/02-05-PLAN.md
  - .planning/phases/02-day-discussion/02-05-SUMMARY.md
  - .planning/phases/02-day-discussion/02-06-PLAN.md
  - .planning/phases/02-day-discussion/02-06-SUMMARY.md
  - .planning/phases/02-day-discussion/02-07-PLAN.md
  - .planning/phases/02-day-discussion/02-07-SUMMARY.md
  - .planning/phases/02-day-discussion/02-08-PLAN.md
  - .planning/phases/02-day-discussion/02-08-SUMMARY.md
  - .planning/phases/02-day-discussion/02-09-PLAN.md
  - .planning/phases/02-day-discussion/02-09-SUMMARY.md
  - .planning/phases/02-day-discussion/02-10-PLAN.md
  - .planning/phases/02-day-discussion/02-10-SUMMARY.md
  - .planning/phases/02-day-discussion/02-11-PLAN.md
  - .planning/phases/02-day-discussion/02-11-SUMMARY.md
  - .planning/phases/02-day-discussion/02-12-PLAN.md
  - .planning/phases/02-day-discussion/02-12-SUMMARY.md
  - .planning/phases/02-day-discussion/02-13-PLAN.md
  - .planning/phases/02-day-discussion/02-13-SUMMARY.md
  - .planning/phases/02-day-discussion/02-14-PLAN.md
  - .planning/phases/02-day-discussion/02-14-SUMMARY.md
  - .planning/phases/02-day-discussion/02-15-PLAN.md
  - .planning/phases/02-day-discussion/02-15-SUMMARY.md
  - .planning/phases/02-day-discussion/02-16-PLAN.md
  - .planning/phases/02-day-discussion/02-16-SUMMARY.md
  - .planning/phases/02-day-discussion/02-17-PLAN.md
  - .planning/phases/02-day-discussion/02-17-SUMMARY.md
  - .planning/phases/02-day-discussion/02-18-PLAN.md
  - .planning/phases/02-day-discussion/02-18-SUMMARY.md
  - scripts/smoke.mjs
  - scripts/uat-day.mjs
  - shared/game/alive.ts
  - shared/game/chat.ts
  - shared/game/claim.ts
  - shared/game/discussion.ts
  - shared/game/phases.ts
  - shared/game/tick.ts
  - shared/game/view.ts
  - shared/nickname.ts
  - shared/protocol.ts
  - shared/schemas.ts
  - src/components/ChatHistorySheet.tsx
  - src/components/ClaimPanel.tsx
  - src/components/DayTable.tsx
  - src/components/DiscussionControls.tsx
  - src/components/EmojiTraySheet.tsx
  - src/components/MessageLog.tsx
  - src/components/QuickMessageSheet.tsx
  - src/components/TurnPanel.tsx
  - src/components/UserRecordSheet.tsx
  - src/game/messageText.ts
  - src/game/roleText.ts
  - src/net/claimLines.ts
  - src/net/seatFloats.ts
  - src/net/useSendLock.ts
  - src/screens/DayScene.tsx
  - worker/room.ts
covered_digest: "v3:sha256:23e09cf3e7e22dcbeccc525bbf325cf4816e05fdd5ea187f37c9f8642fab80ab"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 6/6
  note: "2026-10-24 검증은 결정 0017·0023·0027·0028·0030·0039 이전 코드를 본 것이라 낡았다. 현재 코드를 처음부터 다시 검증했다(회귀 검사가 아니라 전체 재검증)."
  gaps_closed:
    - "이전 보고서의 '결정 요청: 2일차 이후 어제 주장 유지' — 결정 0023 이 '시간 안에 안 고르면 말 안 함, 어제 주장 이월 없음' 으로 대체해 ROADMAP SC1·DAY-02 문구와 구현이 일치한다(claim.ts resolveClaimTurn: claimPick ?? \"none\")"
    - "이전 보고서의 IN-01(탈락자가 대상 칩에 계속 보임) — PublicPlayer.alive 가 뷰에 실리고 QuickMessageSheet 이 isAlive 로 거른다"
    - "이전 보고서의 WR-02(쿨다운 지터 오탐) — 서버 한도 SERVER_MIN_SEND_GAP_MS 1800 < 클라이언트 잠금 SEND_COOLDOWN_MS 2000"
  gaps_remaining: []
  regressions: []
gaps: []
deferred: []
superseded:
  - was: "공개 단계 15초 동시 공개 + 마감 때 한꺼번에 공개(claimReveal 단계), 다음 낮에 바꾸면 '말 바꿈' 표시, 시간 초과 시 어제 주장 유지(결정 0007·0015, CONTEXT D-09)"
    by: "결정 0023(한 명씩 8초 차례, 시간 초과는 말 안 함, 말 바꿈 표시 폐기) + 결정 0027(claimReveal 단계 삭제, day.turn·day.claimLog 와이어)"
  - was: "방장만 +30초 연장·넘기기(extend·skip, extendUsed·ALREADY_EXTENDED), 낮 토론 90초(ROADMAP SC2 문구)"
    by: "결정 0017-5(방장 전용 기능 삭제) + 결정 0039(낮 토론 40초, REQUIREMENTS DAY-01 은 이미 40초)"
  - was: "서버가 낮 메시지 최근 20개를 보관해 재접속 때 복원(messages, 결정 0015·0016-7)"
    by: "결정 0017-7(서버는 방송만, 폰이 그날 줄을 메모리에만 보관). normalizeStoredRoom 이 옛 messages 키를 지운다"
  - was: "빠른 메시지 말풍선(머리 위 문장), 보낸 사람 이름표 윗줄 반전(ROADMAP SC3·REQUIREMENTS COMM-01 문구)"
    by: "결정 0017-2(말풍선은 이모티콘만) → 결정 0030-1·2(이름표 반전 폐지, 빠른 메시지를 보낸 사람 머리 위에 '…' 말풍선 3초). 서버가 정하는 부분은 그대로이고 화면 표시만 바뀌었다"
  - was: "닉네임 최대 8자(8자 닉네임 말줄임 확인 항목)"
    by: "결정 0017-4(NICKNAME_MAX_GRAPHEMES 5)"
  - was: "Table.tsx·SeatFloat.tsx·ClaimTag 등 원근 타원 좌석 부품, 방장 줄"
    by: "결정 0017-1(고정 테이블)·0028-3·4(기하 P2, 대기실·배정·낮 공통 DayTable)"
human_verification_approved:
  - item: "360px 폰 8명판에서 직업 주장 차례·낮 토론 화면: 이름표·완료·'…' 말풍선·이모티콘이 겹치거나 하단 패널에 가려지지 않고 자리에 맞게 읽힌다 (UAT 1, 결정 0017·0028·0030 기하)"
    approved_by: "사용자(dhkim1522)"
    approved_at: "2026-10-30"
    note: "검증자는 기기를 보지 못했다. 사용자가 2026-10-30 에 2페이즈 사람 확인 항목을 모두 승인하라고 요청했다(4·5페이즈 실기기 승인과 같은 날). UAT 1 은 2026-10-24 배포본 8명 방(봇 7 + 사용자 폰 1)에서 이미 '통과' 로 기록돼 있다."
  - item: "이모티콘이 보낸 사람 캐릭터 위에 약 2초 떴다 사라지고, 빠른 메시지를 보낸 사람 머리 위에 '…' 말풍선이 3초 보인다. 동시에 보내도 나중 것이 위에 보인다"
    approved_by: "사용자(dhkim1522)"
    approved_at: "2026-10-30"
    note: "검증자는 기기를 보지 못했다. 렌더 위치·z 순서·움직임 느낌은 자동 테스트로 볼 수 없는 항목이라 사용자 승인으로 갈음했다."
  - item: "360×640 폰에서 직업 주장 하단(칩 한 줄/남의 차례 줄)과 낮 토론 하단(채팅 세 줄 + [빠른 메시지][이모티콘])이 한 화면에 들어오고 채팅 내역 모달이 열린다"
    approved_by: "사용자(dhkim1522)"
    approved_at: "2026-10-30"
    note: "검증자는 기기를 보지 못했다. 실제 뷰포트 높이(주소창·안전 영역)는 자동 테스트로 볼 수 없다."
  - item: "빠른 메시지를 2초 간격으로 연달아 보내도 RATE_LIMITED 오탐으로 메시지가 표시 없이 사라지지 않는다 (결정 0016-6, G-02-2)"
    approved_by: "사용자(dhkim1522)"
    approved_at: "2026-10-30"
    note: "검증자는 기기를 보지 못했다. UAT 6 이 2026-10-24 배포본 봇 시나리오로 2000ms 간격 오탐 0/16(5명)·0/28(8명)을 확인했고, 이 검증에서 단위 테스트(1799ms 거부·1800ms 통과·2000ms 간격 통과)를 다시 통과시켰다. 이동통신망 지터는 사용자 승인으로 갈음했다."
  - item: "iPhone Safari·Android Chrome 폰에서 낮 한 바퀴(역할 확인 → 낮 시작 → 한 명씩 8초 주장 → 40초 토론 → 다음 단계)를 돌 때 단계 전환이 같은 시각이고 연출이 부드럽다"
    approved_by: "사용자(dhkim1522)"
    approved_at: "2026-10-30"
    note: "검증자는 기기를 보지 못했다. UAT 7 은 2026-10-24 에 6페이즈 친구 플레이테스트로 미뤘고(결정 0041 로 6페이즈 삭제), 사용자가 2026-10-30 에 승인했다. 봇 확인(단계 전환·이모티콘 도착 차이 0~23ms)만 이전에 있었다."
---

# Phase 2: 낮 토론 Verification Report

**Phase Goal:** 역할 확인(이후로는 아침) 뒤 낮이 되면 각자 직업을 공개하고, 낮 토론 동안 각자 다른 곳에 있는 생존자들이 빠른 메시지와 이모티콘으로 의심·직업 주장을 주고받아, 앱만으로 토론이 성립한다.
**Verified:** 2026-10-30T02:30:00Z
**Status:** passed
**Re-verification:** Yes — 2026-10-24 보고서가 낡아서(결정 0017·0023·0027·0028·0030·0039 가 덮은 파일이 바뀜) 현재 코드를 처음부터 다시 검증했다.

> 판정 원칙: SUMMARY.md 의 주장은 증거로 쓰지 않았다. 아래 근거는 현재 코드를 직접 읽고, 테스트를 직접 돌려 얻었다. 이후 결정이 명시적으로 대체한 문구는 갭이 아니라 "대체됨" 으로 센다(frontmatter `superseded`).

## Goal Achievement

### Observable Truths (ROADMAP 성공 기준)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 낮이 시작되면 생존자가 자리 순서대로 한 명씩(8초) 직업 선택지와 [말 안 함] 중 하나를 주장한다. 주장은 채팅에 말로 올라오고, 낮에 캐릭터를 탭하면 유저 기록 카드에서 날짜별 주장을 본다(결정 0023) | ✓ VERIFIED | `shared/game/phases.ts` `CLAIM_TURN_MS = 8_000`, dayAnnounce(2초) → claim → discussion. `claim.ts` `enterClaim` 이 살아 있는 seat 오름차순 + 날마다 한 칸씩 옮기는 시작 자리를 정하고, `selectClaim` 은 검사 순서(단계 → 방에 있음·생존 → 지금 차례 → 값)를 지키며 실제 역할 필드를 읽지 않는다. `resolveClaimTurn` 은 `claimPick ?? "none"` 이라 시간 초과는 말 안 함이고 어제 주장을 잇지 않는다. `tick.ts` `ON_DEADLINE.claim` 이 남은 차례가 있으면 같은 단계에 머물며 마감을 "이전 마감 + 8000" 으로 옮긴다. `worker/room.ts` `applyClaim` 은 `selectClaim` → `tick` → `persistAndBroadcast` → `reschedule` 이고 신원은 소켓 첨부 playerId 뿐이다. 화면: `DayScene.tsx` 가 서버 `view.day.turn.seat` 가 나이면 `ClaimPanel`(칩 = `view.day.roles` + 말 안 함), 남이면 `TurnPanel`(`…님이 주장하는 중 · N초` + 이모티콘)을 그린다. 주장 줄은 `src/net/claimLines.ts` 가 공개 `claimLog` 에서 "저는 [직업]이에요"/"말하지 않았어요" 로 만들어 채팅 앞에 놓는다(재접속해도 복원). 낮에 캐릭터 탭은 `DayTable` `onInspect` → `UserRecordSheet`(일차별 주장 + 투표 기록, 공개 정보만). 테스트: `test/unit/claim.test.ts`·`tick.test.ts`(8000/40000 상수), `test/worker/day.test.ts`(차례 진행·알람이 한 차례씩 none 으로 넘김·2일차 시작 자리 이동·잘못된 차례 WRONG_PHASE), `test/client/claimPanel.test.tsx`·`turnPanel.test.tsx`·`userRecordSheet.test.tsx`·`dayScene.test.tsx` 통과 |
| 2 | 낮 토론 동안 생존자 목록과 남은 시간이 보이고, 토론은 서버 타이머대로 끝난다(방장 연장·넘기기 없음, 결정 0017). 길이는 결정 0039 로 40초 | ✓ VERIFIED | `phases.ts` `DISCUSSION_MS = 40_000`(결정 0039, `tick.test.ts` 가 40000 을 단언). 생존자는 `DayScene` 의 `DayTable`(`view.players`)이고 남은 시간은 `PhaseBar` 의 `Timer`(`view.phaseEndsAt`·`phaseDurationMs`, `connection.offset` 보정). 단계 전환은 `tick()` 이 서버 시각 `now` 로만 하고(클라이언트 입력 없음) DO 알람이 마감에 맞춰진다. 연장·넘기기는 코드에서 사라졌다: `src/`·`shared/`·`worker/` 에 `extend`·`skip`(메시지)·`extendUsed`·`ALREADY_EXTENDED` 가 없고, `schemas.ts` 에 해당 변형이 없다. `test/worker/day.test.ts` "extend 나 skip 을 보내면 보낸 소켓만 error BAD_MESSAGE, 저장된 phase·phaseEndsAt·day 그대로", "extend·skip 뒤에도 알람은 원래 마감 그대로", "방장이 끊겨 있어도 서버 타이머대로 넘어간다" 통과 |
| 3 | 생존자가 템플릿을 골라 대상 플레이어·직업을 채워 보내면 모든 폰의 채팅(최근 세 줄·채팅 내역)에 바로 보이고 보낸 사람에게 잠깐 표시된다. 거짓 주장도 그대로 보내진다 | ✓ VERIFIED (표시 방식은 결정 0030 으로 대체됨) | `chat.ts` `say`: 단계 → 보낸 사람 → 템플릿(`Object.hasOwn`) → 때 → 칸 과부족 → 대상 → 직업(`rolesInPlay`) → 쿨다운 순이고 `claimedRole` 은 구성 안인지만 보고 실제 역할은 읽지 않는다(`chat.test.ts` "거짓 주장도 그대로 받는다"). 줄은 필드를 하나씩 써서 만들어 알 수 없는 키가 끼지 않는다. `worker/room.ts` `applySay` 는 저장 없이 `chat` 프레임을 `broadcastEvent` 로 모든 소켓에 보낸다(결정 0017-7). 화면: `src/net/seatFloats.ts` `useDayChat` 이 그 폰이 받은 줄만 모으고(허용 키 복사·중복 seq 제거·단계/일차 바뀌면 비움), `MessageLog`(최근 3줄 + ^ 버튼) · `ChatHistorySheet`(전체 내역)로 그린다. 문장은 서버가 아니라 `messageText` 가 템플릿 ID·seat·직업으로 만들고 React 텍스트로만 그린다. 보낸 사람 표시는 `useSeatFloats` 의 `spoke`(3초) → `DayTable` 의 '…' 말풍선이다(결정 0030-2; ROADMAP·COMM-01 의 "이름표 반전" 문구는 대체됨). 테스트: `chat.test.ts`, `day.test.ts` "쿨다운이 지난 뒤 거짓 주장도 그대로 모든 소켓의 chat 프레임이 되고", "say 가 통과해도 state 프레임은 방송되지 않는다", `test/client/seatFloats.test.tsx`·`discussion.test.tsx` 통과 |
| 4 | 이모티콘을 누르면 보낸 사람 캐릭터 위에 잠깐 떴다 사라진다 | ✓ VERIFIED | `chat.ts` `emote`(8종 `EMOJI_IDS`, claim 부터 허용, say 와 같은 `lastSendAt` 합산 쿨다운). `room.ts` `applyEmoji` → `emoji` 프레임을 모든 소켓에 방송(저장 없음). `seatFloats.ts` `EMOJI_MS = 2000`, 같은 자리 새 이모티콘은 이전 것을 바꾸고 나중 것의 z 가 크다. `DayTable.tsx` 의 `.mf-dt__emoji` 레이어가 그 자리 캐릭터 머리 위(`emojiLeft/emojiTop`)에 그린다. `day.test.ts` "저장 없이 연결된 모든 소켓에 emoji 프레임이 가고", `seatFloats.test.tsx`·`emojiTraySheet.test.tsx` 통과 |
| 5 | 토론 단계가 아닐 때(직업 공개 중 등) 보낸 메시지, 자유 텍스트, 2초 안에 다시 보낸 메시지(화면 2초 잠금, 서버 1.8초 — 결정 0016-6)는 서버가 거부해 다른 폰에 나타나지 않는다 | ✓ VERIFIED | `chat.ts` `SAY_PHASES`·`senderOf`: 허용 밖 단계 → `WRONG_PHASE`(claim 중 say 포함, 탈락자도), 방에 없거나 탈락 → `BAD_MESSAGE`. 쿨다운 `SERVER_MIN_SEND_GAP_MS = 1800`(< 클라이언트 `SEND_COOLDOWN_MS = 2000`), 거부는 `lastSendAt` 을 늘리지 않으며 쿨다운은 플레이어 단위 영속 값이라 소켓을 바꿔도 풀리지 않는다. `schemas.ts` 의 `say`·`emoji`·`claim` 이 `z.strictObject` 라 `text` 같은 키는 거부. 표시 전용 템플릿(`claimRole`·`claimNone`)은 `when: "claim"` 이라 say 로 받지 않는다. 탈락자·아침·밤 마피아 전용 채팅(결정 0019)도 이제 코드에 있고(`senderOf` 의 밤 마피아 검사, `broadcastEventTo` 로 마피아·관전자 소켓에만 전달) ROADMAP 이 3페이즈 확인으로 미룬 부분까지 `chat.test.ts`·`night.test.ts`·`leak.test.ts` 가 통과한다. 테스트: `chat.test.ts`(1799ms 거부·1800ms 통과·2000ms 간격 통과), `day.test.ts` "claim 단계의 say 는 WRONG_PHASE 이고 다른 소켓 프레임에 메시지가 없다", "text 키가 붙은 say…BAD_MESSAGE 이고 다른 소켓에 나타나지 않는다", "즉시 두 번째는 RATE_LIMITED" |
| 6 | 폰 세로 화면에서 메시지를 고르고 보내는 데 세 번 이하(템플릿 → 대상·직업 → 보내기). 단 '[○○]는 [직업]이었어요' 만 네 번 | ✓ VERIFIED (집계 기준: 시트 안 선택 횟수) | `QuickMessageSheet.tsx`: 첫 문구가 처음부터 선택돼 있고 대상·직업 칸은 문구가 필요할 때만 나온다. 입력칸이 없다(`<input|textarea|contenteditable` 부재를 테스트가 소스 텍스트로 단언). `test/client/quickMessageSheet.test.tsx` 가 '저 아니에요' 2번, 다른 대상 문구('믿어요') 문구 → 대상 → 보내기 3번, '[○○]는 [직업]이었어요' 4번(문구 → 대상 → 직업 → 보내기)을 단언하고 통과한다. 시트를 여는 [빠른 메시지] 탭은 기준의 괄호 열거에 없어 세지 않는다 |

**Score:** 6/6 truths verified (0 present, behavior-unverified)

상태 전이·취소·순서 불변식(차례 마감, 한 차례씩 넘김, 거부가 `lastSendAt` 을 늘리지 않음, 알람 재설정)은 모두 이름 붙은 테스트가 실행되어 통과하므로 PRESENT_BEHAVIOR_UNVERIFIED 항목은 없다.

### Deferred Items

없음. 이전 보고서의 이월 항목 둘은 이미 이행됐다 — (1) 밤·아침·탈락자 메시지 거부: `senderOf` 와 `chat.test.ts`/`night.test.ts` 에 구현·테스트됨(Phase 3), (2) 찬반 투표 중 빠른 메시지·이모티콘: `SAY_PHASES`·`EMOTE_PHASES` 가 execVote·candidateVote·defense 를 포함(Phase 4).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `shared/game/phases.ts` | 낮 단계 표·시간 상수 | ✓ VERIFIED | dayAnnounce 2s → claim 차례 8s → discussion 40s → execVote … 한 곳에 상수. `claimReveal` 은 `PhaseId` 에서 삭제됨(결정 0027-2) |
| `shared/game/tick.ts` | 진입 훅·마감 훅 표 | ✓ VERIFIED | `ON_ENTER.claim = enterClaim`, `ON_DEADLINE.claim = resolveClaimTurn`, stay 면 "이전 마감 + 차례 길이". 시각은 인자 `now` 로만 |
| `shared/game/claim.ts` | 순차 주장 규칙 | ✓ VERIFIED | 차례 순서·시작 자리·검사 순서·none 처리. 실제 역할 필드를 읽지 않음 |
| `shared/game/chat.ts` | 빠른 메시지·이모티콘 규칙 | ✓ VERIFIED | 단계·보낸 사람·형식·쿨다운. 상태에 줄을 저장하지 않음(`messages` 없음) |
| `shared/game/discussion.ts` | 단계 길이 파생 | ✓ VERIFIED | 방장 연장·넘기기 삭제됨. `phaseDurationOf` 만 남음 |
| `shared/game/view.ts` | 플레이어별 낮 뷰 | ✓ VERIFIED | `buildDay` 가 허용 목록 리터럴로 `n`·`roles`·`claimLog`(줄마다 `{n,seat,claim}`)·`voteLog` 만 싣고 `claimPick`·`claimOrder`·`claimIdx`·`claimStart`·`lastSendAt` 은 싣지 않음 |
| `shared/schemas.ts` | 서버 입력 검증 | ✓ VERIFIED | `claim`·`say`·`emoji` 가 `strictObject`. `extend`·`skip` 변형 없음 |
| `worker/room.ts` | claim·say·emoji 핸들러 | ✓ VERIFIED | 껍데기(`handleX`)와 본체(`applyX`) 분리, 신원은 소켓 첨부만, 시각은 서버 `Date.now()`, 마감이 바뀌는 `applyClaim` 은 `reschedule()` |
| `src/screens/DayScene.tsx` | 낮 장면 배선 | ✓ VERIFIED | claim: 내 차례 `ClaimPanel`/남 `TurnPanel`, 토론: `MessageLog` + `DiscussionControls`, 기록 카드, 이모티콘 live 줄 |
| `src/components/ClaimPanel.tsx` | 내 차례 직업 칩 | ✓ VERIFIED | 칩 = `view.day.roles` + 말 안 함, 한 번 고르면 잠김, 내 실제 역할로 문구를 바꾸지 않음 |
| `src/components/TurnPanel.tsx` | 남의 차례 하단 | ✓ VERIFIED | 채팅 세 줄 + `…님이 주장하는 중 · N초` + 이모티콘 |
| `src/components/DiscussionControls.tsx` | 토론 하단 조작 | ✓ VERIFIED | [빠른 메시지][이모티콘] 한 줄, 방장 줄 없음, `useSendLock` 합산 쿨다운 |
| `src/components/QuickMessageSheet.tsx` | 빠른 메시지 시트 | ✓ VERIFIED | 입력칸 없음, 필요한 키만 리터럴로 담아 전송 |
| `src/components/EmojiTraySheet.tsx` | 이모티콘 트레이 | ✓ VERIFIED | 쿨다운 중 비활성 |
| `src/components/MessageLog.tsx` · `ChatHistorySheet.tsx` | 최근 세 줄 · 채팅 내역 | ✓ VERIFIED | 같은 `ChatLineItem` 하나를 쓰고 React 텍스트로만 그림 |
| `src/components/UserRecordSheet.tsx` | 유저 기록 카드 | ✓ VERIFIED | 공개 `claimLog`·`voteLog` 만 입력으로 받음(참/거짓 표시 불가) |
| `src/components/DayTable.tsx` | 고정 테이블·이모티콘/말풍선 층 | ✓ VERIFIED | `onInspect`·`spoke`·`emoji`·`turn` 이 한 좌표계에서 그려짐 |
| `src/net/seatFloats.ts` | 이벤트 기반 화면 상태 | ✓ VERIFIED | 말풍선 3초·이모티콘 2초·채팅 줄, 재접속 복원 없음, 단계/일차가 바뀌면 비움 |
| `src/net/claimLines.ts` · `useSendLock.ts` | 주장 줄 합성 · 쿨다운 잠금 | ✓ VERIFIED | 서버 `claimLog` 에서 줄을 만듦 / 보낸 순간 + 2000ms 잠금, RATE_LIMITED 재잠금 |
| `scripts/smoke.mjs` · `scripts/uat-day.mjs` | 배포본 점검 도구 | ✓ VERIFIED (존재만) | 파일은 있고 실행하지 않았다(아래 스팟 체크 참고) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ClaimPanel.send({t:"claim"})` | `Room.handleClaim` → `applyClaim` | WebSocket `ClientMessageSchema`(strictObject) | WIRED | 서버가 `selectClaim` → `tick` → `persistAndBroadcast` → `reschedule` |
| `applyClaim` | 모든 폰 `view.day.turn`·`claimLog` | `persistAndBroadcast` → `buildView`(허용 목록) | WIRED | `day.test.ts` 가 네 소켓의 다음 차례·claimLog 한 줄·알람 이동을 단언 |
| `view.day.claimLog` | 채팅의 "저는 …이에요" 줄 | `claimLinesOf` → `DayScene.dayLines` → `MessageLog` | WIRED | 서버는 주장에 chat 프레임을 보내지 않고 화면이 공개 기록에서 만든다 |
| `DiscussionControls` → `QuickMessageSheet.onSend` | `Room.handleSay` → `applySay` | `useSendLock.sendAndLock({t:"say",…})` | WIRED | 통과한 줄은 `chat` 프레임으로만 방송(state 방송 없음) |
| `chat` 프레임 | `MessageLog`·`ChatHistorySheet`·'…' 말풍선 | `connection.onEvent` → `useDayChat`·`useSeatFloats` | WIRED | `DayScene` 이 두 훅을 호출하고 `seats[].spoke`·`emoji` 로 `DayTable` 에 넘김 |
| `emoji` 프레임 | 보낸 사람 캐릭터 위 | `useSeatFloats` → `DayTable.mf-dt__emoji` | WIRED | `EMOJI_MS` 2000ms |
| 캐릭터 탭 | `UserRecordSheet` | `seats[].onInspect` → `inspectSeat` | WIRED | 낮 세 단계·아침·투표 구간에서만 열림, 밤이 되면 닫힘 |
| 단계 마감 | 다음 단계 | DO 알람 → `tick(state, now)` | WIRED | `alarm.test.ts`·`day.test.ts` 가 알람이 한 차례씩 none 으로 넘기는 것을 확인 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `ClaimPanel` | `view.day.roles` | `rolesInPlay(players.length)` (서버 `buildDay`) | 예 | ✓ FLOWING |
| `MessageLog`(주장 줄) | `claimLog` | 서버 `claimLog`(차례 마감 때 `resolveClaimTurn` 이 쌓음) | 예 | ✓ FLOWING |
| `MessageLog`(채팅 줄) | `chatLines` | 서버 `chat` 프레임(`applySay`) → `useDayChat` | 예 | ✓ FLOWING |
| `DayTable` 이모티콘/말풍선 | `floats.emoji`·`floats.spoke` | `emoji`·`chat` 프레임 → `useSeatFloats` | 예 | ✓ FLOWING |
| `Timer` | `phaseEndsAt`·`phaseDurationMs` | 서버 `buildView`(`phaseDurationOf`) | 예 | ✓ FLOWING |
| `UserRecordSheet` | `claimLog`·`voteLog` | 서버 view(공개 정보) | 예 | ✓ FLOWING |

정적 반환·하드코딩 빈 값으로 끝나는 체인은 없다.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 타입 검사(토큰 확인 + wrangler types + app/worker tsc) | `npm run typecheck` | 종료 코드 0 | ✓ PASS |
| 2페이즈 관련 단위·클라이언트 19개 파일 | `npx vitest run test/unit/{chat,claim,claimLines,discussion,tick,view,schemas,messageText,nickname,nyquist-02-phase-matrix,nyquist-03.1-multiday}.test.ts test/client/{claimPanel,dayScene,discussion,emojiTraySheet,quickMessageSheet,seatFloats,turnPanel,userRecordSheet}.test.tsx` | 19 파일 · 557 테스트 통과 | ✓ PASS |
| 워커(workerd) 통합: 낮 한 바퀴·알람·누출·봇 | `npx vitest run test/worker/{day,leak,alarm,bots}.test.ts test/unit/{e2eContract,gameRoom,bots}.test.ts` | 7 파일 · 201 테스트 통과 | ✓ PASS |
| 전체 스위트(한 번) | `npx vitest run` | 117 파일 · 3094 테스트 통과 | ✓ PASS |
| 배포본 스모크·봇 UAT(`scripts/smoke.mjs`, `scripts/uat-day.mjs`) | — | 배포 주소에 붙고 방을 만드는 도구라 실행하지 않았다 | ? SKIP (이전 UAT 6·8 에서 배포본 봇 확인 기록이 있고 같은 규칙을 단위·워커 테스트가 지킨다) |

### Probe Execution

선언된 프로브 없음(`scripts/*/tests/probe-*.sh` 없음, PLAN 이 선언한 프로브 없음). SKIPPED.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DAY-02 | 02-01~02-11, 02-12~02-18, 3.1 | 낮마다 낮 토론 전에 직업 공개: 자리 순서 한 명씩 8초, 시작 자리 날마다 변경, 시간 초과는 말 안 함, 채팅에 말로 올라옴, 캐릭터 탭 기록 카드, 참·거짓 미확인 | ✓ SATISFIED | Truth 1. 결정 0023 이 0007·0015 의 동시 공개·말 바꿈을 대체했고 REQUIREMENTS 문구와 구현이 일치 |
| DAY-01 | 02-01~02-18 | 낮 토론(40초, 결정 0039) 동안 생존자 목록·남은 시간, 서버 타이머대로 종료(방장 연장·넘기기 없음) | ✓ SATISFIED | Truth 2 |
| COMM-01 | 02-03~02-18 | 생존자가 빠른 메시지(템플릿 + 대상·직업), 참·거짓 미확인, 최근 세 줄과 채팅 내역, 보낸 사람 표시, 서버 미보관 | ✓ SATISFIED | Truth 3. 투표 구간(execVote·candidateVote)·변론 허용은 4페이즈 확장(`SAY_PHASES`). 보낸 사람 표시는 REQUIREMENTS 문구의 "이름표 반전" 대신 결정 0030-2 의 '…' 말풍선 |
| COMM-02 | 02-03~02-18 | 이모티콘이 보낸 사람 캐릭터 위에 잠깐 떴다 사라짐 | ✓ SATISFIED | Truth 4 |
| COMM-04 | 02-03~02-18 | 서버는 템플릿 ID·값만 받아 단계·생존·형식 검증 후 방송, 자유 텍스트 불가, 아침·처형·탈락자 거부, 밤 마피아 전용, 2초(서버 1.8초) 제한 | ✓ SATISFIED | Truth 5 |

고아(ORPHANED) 요구사항 없음 — REQUIREMENTS.md 의 Phase 2 매핑은 위 다섯 개뿐이고 모두 계획이 선언했다(DAY-02 는 3.1페이즈와 공유).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (덮은 구현 파일 28개) | — | `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` 검색 결과 0건 | — | 없음. 빈 반환·콘솔 로그만 있는 구현·하드코딩 빈 props 도 발견되지 않았다 |

### 문서 문구 불일치 (갭 아님, 후속 정리 권장)

코드와 승인된 결정이 일치하고 코드에는 갭이 없다. 다만 아래 문구가 이후 결정을 반영하지 않아 읽는 사람을 헷갈리게 한다. 이 검증은 구현·로드맵 파일을 고치지 않았다.

1. `.planning/ROADMAP.md` Phase 2 성공 기준 2 의 "낮 토론 90초" — 결정 0039 로 40초다(REQUIREMENTS DAY-01·`phases.ts` 는 40초).
2. `.planning/ROADMAP.md` 성공 기준 3 과 `.planning/REQUIREMENTS.md` COMM-01 의 "보낸 사람 이름표가 잠깐 반전된다" — 결정 0030-1·2 로 이름표 반전이 폐지되고 보낸 사람 머리 위 '…' 말풍선 3초로 바뀌었다.

### Human Verification

자동 검증으로 볼 수 없는 항목(실기기 폭·주소창·안전 영역, 말풍선/이모티콘 움직임, 이동통신망 지터, iPhone/Android 차이)은 사용자가 2026-10-30 에 모두 승인했다. 검증자는 기기를 직접 보지 못했다. 항목별 기록은 frontmatter `human_verification_approved` 에 있다. 미승인·대기 항목은 없다.

### Gaps Summary

BLOCKER·WARNING 갭이 없다. 모든 성공 기준이 현재 코드에서 확인되었고, 타입 검사와 전체 테스트 스위트(3094건)가 통과한다. 이전 보고서가 올렸던 "ROADMAP SC1 문구 대 구현" 결정 요청은 결정 0023 으로 해소되었다(시간 초과는 말 안 함, 어제 주장 이월 없음). 배포본 대상 스모크·UAT 스크립트는 실행하지 않았으나, 같은 규칙을 단위·워커 테스트가 지키고 실기기 항목은 사용자가 승인했다.

---

_Verified: 2026-10-30T02:30:00Z_
_Verifier: Claude (gsd-verifier)_
