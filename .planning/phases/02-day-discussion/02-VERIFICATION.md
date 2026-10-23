---
phase: 02-day-discussion
verified: 2026-10-24T05:10:00Z
status: human_needed
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
  - scripts/smoke.mjs
  - shared/game/alive.ts
  - shared/game/chat.ts
  - shared/game/claim.ts
  - shared/game/discussion.ts
  - shared/game/phases.ts
  - shared/game/tick.ts
  - shared/game/view.ts
  - shared/protocol.ts
  - shared/schemas.ts
  - src/components/ClaimPanel.tsx
  - src/components/DiscussionControls.tsx
  - src/components/EmojiTraySheet.tsx
  - src/components/MessageLog.tsx
  - src/components/QuickMessageSheet.tsx
  - src/net/seatFloats.ts
  - src/screens/DayScene.tsx
  - worker/room.ts
covered_digest: "v3:sha256:38e3bdc536e48e28a5f0b20ee21bce0a942671d8234f714c91726b77b5884e4a"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "폭 360px 폰, 8명 방에서 직업 공개와 낮 토론 화면을 연다 (HANDOFF 실기기 확인 1)"
    expected: "이웃 자리의 완료 알약·주장 알약이 겹치지 않고, 앞쪽 자리의 이름표·주장 알약·방장 배지 3줄이 하단 패널에 가려지지 않는다"
    why_human: "실기기 폭·주소창·안전 영역에서의 겹침과 잘림은 jsdom 단위 테스트와 WebSocket 스모크로 볼 수 없다 (verification: backstop)"
  - test: "가장자리 자리(좌우 끝)의 사람이 말풍선을 보내고, 두 사람이 거의 동시에 보낸다 (실기기 확인 2)"
    expected: "말풍선이 화면 밖으로 잘리지 않고(clamp), 동시에 뜨면 나중 것이 위에 보인다. 3초 뒤 사라진다"
    why_human: "렌더 위치·z 순서·애니메이션 느낌은 실기기에서만 확인된다"
  - test: "뒤쪽 자리 사람이 어제와 다른 직업을 공개한다 (실기기 확인 3)"
    expected: "'경찰 · 말 바꿈' 알약이 최대 112px 한 줄이고 이웃 이름표를 가리지 않는다. 모든 폰에 말 바꿈이 보인다"
    why_human: "알약 폭과 겹침은 실제 글꼴·폭에서만 확인된다 (verification: backstop)"
  - test: "360×640 폰에서 직업 공개 화면과 방장의 낮 토론 화면을 본다 (실기기 확인 4·5)"
    expected: "두 화면 모두 세로 스크롤이 생기지 않는다. 3줄 메시지 로그와 방장 줄·보내기 줄이 한 화면에 들어온다"
    why_human: "주소창 높이·안전 영역을 포함한 실제 뷰포트 높이는 자동 테스트로 확인할 수 없다"
  - test: "닉네임이 긴(8자) 사람이 '[닉네임]은 마피아였어요' 를 보낸 뒤 360px 폰의 메시지 로그를 본다 (리뷰 WR-05)"
    expected: "문장 끝의 직업 이름이 말줄임(…)으로 잘리지 않고 읽힌다"
    why_human: "한 줄 말줄임 CSS 의 잘림은 렌더링 폭 추정뿐이다. 잘리면 직업 주장이 안 보여 '앱만으로 토론이 성립한다' 에 영향을 준다"
  - test: "폰에서 빠른 메시지를 2초 간격으로 연달아 보낸다 (결정 0016-6, 리뷰 WR-02)"
    expected: "정상 간격에서 RATE_LIMITED 오탐으로 메시지가 표시 없이 사라지지 않는다. 사라지면 클라이언트 잠금에 지터 여유를 더하거나 서버 한도를 완화한다"
    why_human: "네트워크 지터에 걸리는 경계 동작이라 실제 이동통신망에서만 재현된다"
  - test: "iPhone Safari 와 Android Chrome 폰 각 1대 이상이 배포 주소에서 낮 한 바퀴(직업 공개 → 공개 연출 → 토론 → 방장 넘기기 → 다음 낮)를 돈다"
    expected: "두 기기 모두 같은 시각에 단계가 넘어가고, 이모티콘이 보낸 사람 캐릭터 위에 약 2초 떴다 사라진다. 직업 공개 팝·흔들림 연출이 부드럽다"
    why_human: "애니메이션 느낌과 기기 차이는 자동으로 확인할 수 없다"
  - test: "결정 요청 — ROADMAP 성공 기준 1 문구와 구현의 차이 (아래 'Gaps Summary' 참고)"
    expected: "2일차 이후 직업 공개를 누르지 못하고 시간이 넘으면 '말 안 함' 이 아니라 어제 주장이 이어진다(CONTEXT D-09, 결정 0015). 이 동작을 계속 채택하고 ROADMAP SC1·REQUIREMENTS DAY-02 문구를 맞추거나, 구현을 바꿀지 정한다"
    why_human: "사용자가 승인한 설계와 ROADMAP 문자 그대로가 어긋난다. 어느 쪽이 원천인지는 사람이 정한다"
deferred:
  - truth: "밤·아침 중과 탈락자의 메시지 거부(COMM-04 의 밤·아침·탈락자 부분)"
    addressed_in: "Phase 3"
    evidence: "ROADMAP Phase 2 SC5 가 '탈락자·밤·아침 중 메시지 거부는 탈락과 밤이 생기는 3페이즈에서 확인한다' 로 명시하고, Phase 3 Notes 가 '밤·아침 중 메시지 거부(COMM-04 의 밤·아침 부분)는 이 페이즈에서 확인한다' 라고 적는다. 현재 서버는 discussion 외 단계를 WRONG_PHASE 로 거부하고 isAlive 를 검사한다(shared/game/chat.ts senderOf)"
  - truth: "찬반 투표 중 빠른 메시지·이모티콘 허용(COMM-01 의 찬반 투표 부분)"
    addressed_in: "Phase 4"
    evidence: "Phase 4 SC2 '찬반 투표 중에는 생존자가 빠른 메시지·이모티콘을 보낼 수 있다'. 현재 senderOf 는 phase === 'discussion' 만 허용한다"
---

# Phase 2: 낮 토론 Verification Report

**Phase Goal:** 역할 확인(이후로는 아침) 뒤 낮이 되면 각자 직업을 공개하고, 낮 토론 동안 각자 다른 곳에 있는 생존자들이 빠른 메시지와 이모티콘으로 의심·직업 주장을 주고받아, 앱만으로 토론이 성립한다.
**Verified:** 2026-10-24
**Status:** human_needed
**Re-verification:** No — initial verification

## 요약

코드·테스트·배포본 증거로 확인할 수 있는 6개 성공 기준은 모두 충족됐다. 서버 규칙(직업 공개, 쿨다운, 방장 연장·넘기기, 단계·형식 검증, 누출 방지)은 순수 모듈과 Durable Object 에 실제로 구현돼 있고, 위치·애니메이션·360px 레이아웃 같은 실기기 항목만 사람이 확인해야 한다. 그래서 status 는 `human_needed` 이다. 차단 요인(BLOCKER)은 없다. 검증하지 못한 부분을 통과로 처리한 곳은 없다.

## Goal Achievement

### Observable Truths (ROADMAP 성공 기준)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 낮이 시작되면 모두 직업 선택지와 [말 안 함] 중 하나를 고르고, 시간이 넘으면 말 안 함이 된다. 고른 주장이 자리에 표시되고, 다음 낮에 바꾸면 "말 바꿈" 이 보인다 | ✓ VERIFIED (문구 차이 있음, 아래 참고) | `shared/game/claim.ts` `selectClaim`(claim 단계·`claimOptions` 검사), `enterClaimReveal`(마감 순간 한꺼번에 `claimShown` 확정), `changedFrom`(어제 직업 ≠ 오늘 직업이면 changed). `shared/game/tick.ts` ON_ENTER 표가 claim·claimReveal 훅을 단계 진입에서만 실행. `shared/game/view.ts` `buildDay` 는 claim 단계에 `claimDone`(seat)만, claimReveal·discussion 에 `claims` 를 싣는다. 화면: `ClaimPanel.tsx`(칩 = `view.day.roles` + 말 안 함), `Table.tsx` 의 `ClaimTag`(주장·말 바꿈 알약). 1일차 미선택 → none 은 `shownFor` 와 `claim.test.ts` 로 확인. 단, 2일차 이후 미선택·연결됨이면 어제 주장이 이어진다(D-09). 이는 문서화된 설계지만 ROADMAP 문구와 다르다 |
| 2 | 낮 토론 90초 동안 생존자 목록과 남은 시간이 보이고, 방장만 한 번 +30초 연장하거나 넘길 수 있다. 다른 사람이 누르면 아무 일도 없다 | ✓ VERIFIED | `phases.ts` `DISCUSSION_MS = 90_000`, `EXTEND_MS = 30_000`. `discussion.ts` `extendDiscussion`·`skipDiscussion` 은 `actorId !== state.hostId` 를 먼저 거부(NOT_HOST)하고 연장 중복은 ALREADY_EXTENDED. `worker/room.ts` `handleExtend`·`handleSkip` 은 성공 뒤 `reschedule()` 로 알람을 다시 건다. `phaseDurationOf` 로 타이머 길이가 120000 으로 맞는다. 화면은 `DayScene` 의 Table(생존자)·Timer, `DiscussionControls` 의 방장 줄. 테스트: `test/worker/day.test.ts` "손님의 extend 는 NOT_HOST…마감 그대로", "방장 extend…마감 +30000, 길이 120000…알람 새 마감, 두 번째는 ALREADY_EXTENDED", "손님의 skip 은 NOT_HOST…방장 skip 은 즉시 dayAnnounce(day.n 2)". 배포본 스모크도 같은 항목 통과(02-11). 거부된 손님 요청은 오류만 받고 다른 폰에 표식이 없다 |
| 3 | 생존자가 템플릿을 골라 대상·직업을 채워 보내면(예: "[○○] 의심돼요", "[○○]는 [경찰]이었어요") 모든 폰에 말풍선과 최근 메시지 목록으로 보인다. 거짓 주장도 그대로 보내진다 | ✓ VERIFIED | `chat.ts` `say` 는 `QUICK_TEMPLATES` 5종(suspect·trust·claimed·innocent·vote)을 검증하고 `{seq,seat,template,target?,claimedRole?,at}` 만 보관(최근 20개). 보낸 사람 seat 는 소켓 첨부의 playerId 로 서버가 찾는다. `claimedRole` 은 `rolesInPlay` 안인지만 보고 실제 역할은 읽지 않는다(`test/unit/chat.test.ts` "거짓 주장도 그대로 받는다", `test/worker/day.test.ts` "쿨다운이 지난 뒤 거짓 주장도 그대로 모든 소켓에 보내진다"). `worker/room.ts` `handleSay` → `persistAndBroadcast`. 화면: `QuickMessageSheet.tsx`(문구 → 대상 → 직업 → 미리보기 → 보내기), `MessageLog.tsx`(최근 메시지), `seatFloats.ts`(말풍선 3초), `messageText.ts`(은/는·이었어요/였어요). 배포본 스모크에서 모든 클라이언트 `day.messages` 에 도착 확인(02-11 D3). 예시 문구 "[○○]는 [경찰]이었어요" 는 이제 "[○○]는 [직업]이었어요" 칩 + 직업 칩으로 같은 결과를 낸다 |
| 4 | 이모티콘을 누르면 보낸 사람 캐릭터 위에 잠깐 떴다 사라진다 | ✓ VERIFIED | `chat.ts` `emote`(8종 `EMOJI_IDS`, 합산 쿨다운 공유), `worker/room.ts` `handleEmoji` → `broadcastEvent({t:"emoji",seat,icon,at})`. 클라이언트 `useRoomConnection` 이 emoji 프레임을 `onEvent` 로 전달 → `seatFloats.ts` 가 그 자리에 `EMOJI_MS = 2000` 동안 띄움 → `Table.tsx` 의 `mf-float` 레이어 → `SeatFloat.tsx` 의 `mf-react`. 테스트: `test/client/seatFloats.test.tsx` "emoji 이벤트는 그 자리에 2000ms 뜬다", `test/worker/day.test.ts` "저장 없이 연결된 모든 소켓에 emoji 프레임이 간다". 실제 모션 느낌은 사람이 확인(human item 7) |
| 5 | 토론 단계가 아닐 때 보낸 메시지, 자유 텍스트, 2초 안에 다시 보낸 메시지는 서버가 거부해 다른 폰에 나타나지 않는다 | ✓ VERIFIED | `chat.ts` `senderOf`: `phase !== "discussion"` → WRONG_PHASE, 방에 없거나 `!isAlive` → BAD_MESSAGE. `coolingDown`: 합산 `lastSendAt` 2000ms(서버 영속, 다중 소켓 우회 불가), 거부는 `lastSendAt` 을 늘리지 않는다. `shared/schemas.ts`: `say`·`emoji`·`claim`·`extend`·`skip` 이 `z.strictObject` 라 `text` 같은 키는 BAD_MESSAGE. 서버는 문장을 만들지 않는다. 테스트: `test/unit/chat.test.ts`(단계·형식·쿨다운 1999/2000ms 경계), `test/worker/day.test.ts` "claim·claimReveal 단계의 say 는 WRONG_PHASE 이고 다른 소켓 프레임에 메시지가 없다", "text 키가 붙은 say…BAD_MESSAGE 이고 다른 소켓에 나타나지 않는다", "즉시 두 번째는 RATE_LIMITED". 배포본 스모크(02-11 D3)에서도 거부 5종 통과. 탈락자·밤·아침은 ROADMAP 이 3페이즈 확인으로 미뤘다(Deferred 참고) |
| 6 | 폰 세로 화면에서 메시지를 고르고 보내는 데 세 번 이하(템플릿 → 대상·직업 → 보내기). 단 '[○○]는 [직업]이었어요' 만 네 번 | ✓ VERIFIED (집계 기준 참고) | `QuickMessageSheet.tsx`: 첫 문구가 처음부터 선택돼 있고, 대상·직업 칸은 문구에 필요할 때만 나온다. `test/client/quickMessageSheet.test.tsx` 가 문구 → 대상 → 보내기 3번("다른 대상 문구('믿어요')는 문구 → 대상 → 보내기 3번이다"), '저 아니에요' 2번, '[○○]는 [직업]이었어요' 4번을 단언한다. 이 성공 기준은 시트 안 선택 횟수로 센다. 낮 토론 화면에서 시트를 여는 [빠른 메시지] 탭은 세지 않는다(기준의 괄호 열거에 없음). 열기 탭까지 세면 한 번씩 늘어난다는 점을 아래 Gaps Summary 에 기록 |

**Score:** 6/6 truths verified (0 present, behavior-unverified). 단 truth 1 의 문구 차이와 truth 6 의 집계 기준은 사람이 확인할 항목으로 올렸다.

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|--------------|----------|
| 1 | 밤·아침 중과 탈락자의 메시지 거부 (COMM-04 일부) | Phase 3 | ROADMAP Phase 2 SC5 와 Phase 3 Notes 가 명시. 현재 서버는 discussion 외 단계 거부와 `isAlive` 검사까지 갖췄다 |
| 2 | 찬반 투표 중 빠른 메시지·이모티콘 (COMM-01 일부) | Phase 4 | Phase 4 SC2. 지금 `senderOf` 는 discussion 만 허용하므로 4페이즈가 이 검사를 넓혀야 한다 |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `shared/game/phases.ts` | 낮 네 단계 표·시간 상수 | ✓ VERIFIED | dayAnnounce 2s → claim 15s → claimReveal 2s → discussion 90s → dayAnnounce(임시 루프). 상수 한 곳 |
| `shared/game/tick.ts` | 진입 훅 표 | ✓ VERIFIED | `ON_ENTER` 에 dayAnnounce·claim·claimReveal. tick 루프 안에서만 호출, "이전 마감 + 길이" 연쇄 |
| `shared/game/claim.ts` | 직업 공개 규칙 | ✓ VERIFIED | 규칙표가 주석과 코드에 일치, 실제 역할 필드를 읽지 않음 |
| `shared/game/chat.ts` | 빠른 메시지·이모티콘 규칙 | ✓ VERIFIED | 검사 순서 단계 → 보낸 사람 → 템플릿 → 칸 → 대상 → 직업 → 쿨다운. `Object.hasOwn` 가드 |
| `shared/game/discussion.ts` | 방장 연장·넘기기 | ✓ VERIFIED | 방장 검사가 가장 먼저, 넘기기는 일반 tick 전이를 재사용 |
| `shared/game/view.ts` | 플레이어별 낮 뷰 | ✓ VERIFIED | 허용 목록 리터럴. `claimChoice`·`claimLast`·`lastSendAt` 은 어떤 뷰에도 안 실림 |
| `shared/schemas.ts` | 서버 입력 검증 | ✓ VERIFIED | 2페이즈 변형 전부 strictObject (직업 enum 하드코딩은 리뷰 WR-01) |
| `worker/room.ts` | claim·say·emoji·extend·skip 핸들러 | ✓ VERIFIED | 신원은 소켓 첨부만, 시각은 서버 `Date.now()`, 마감이 바뀌는 곳은 `reschedule()` |
| `src/screens/DayScene.tsx` | 낮 장면 | ✓ VERIFIED | 테이블 공유, ClaimPanel / MessageLog+DiscussionControls 배선 |
| `src/components/ClaimPanel.tsx` | 직업 공개 패널 | ✓ VERIFIED | 서버가 준 `view.day.roles` 로 칩을 만들고 실제 역할로 문구를 바꾸지 않는다 |
| `src/components/QuickMessageSheet.tsx` | 빠른 메시지 시트 | ✓ VERIFIED | 입력칸 없음, 필요한 키만 리터럴로 담아 전송 |
| `src/components/EmojiTraySheet.tsx` | 이모티콘 트레이 4×2 | ✓ VERIFIED | 쿨다운 중 전부 비활성 |
| `src/components/MessageLog.tsx` | 최근 메시지 | ✓ VERIFIED | React 텍스트로만 렌더 (WR-05 말줄임은 human item) |
| `src/components/DiscussionControls.tsx` | 방장 줄·보내기 줄 | ✓ VERIFIED | WR-03 참고 |
| `src/net/seatFloats.ts` | 말풍선 3초·이모티콘 2초 | ✓ VERIFIED | 재접속 시 남은 시간만큼 복원, 단계 이탈 시 비움 |
| `scripts/smoke.mjs` | 배포본 낮 한 바퀴 스모크 | ✓ VERIFIED | 허용 전이 표 `PHASE_NEXT`, 경로 기반 누출 검사, 거부 5종 검사 |
| `docs/decisions/0016-day-loop-structure.md` | 구조 결정 7가지 | ✓ VERIFIED | 존재, 배경·결정·결과 형식 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `Room.webSocketMessage` | zod `ClientMessageSchema` | `safeParse` 후 `advance(Date.now())` | WIRED | 검증 실패는 BAD_MESSAGE, tick 먼저 |
| `Room.handleSay/Emoji/Claim/Extend/Skip` | `shared/game/*` 순수 규칙 | `say`·`emote`·`selectClaim`·`extendDiscussion`·`skipDiscussion` import | WIRED | `worker/room.ts` 상단 import 와 호출 확인 |
| `Room.handleExtend/Skip` | 알람 | `reschedule()` → `nextWakeAt` | WIRED | 마감이 바뀌는 두 경로 모두 호출 |
| `tick` | 진입 훅 | `ON_ENTER[next]` | WIRED | dayAnnounce·claim·claimReveal |
| `Room.broadcast` | `buildView(room, playerId)` | 연결마다 개별 뷰 | WIRED | 거부 경로 `sendRejection` 도 같은 `buildView` |
| `Room.handleEmoji` | 모든 앉은 소켓 | `broadcastEvent({t:"emoji"})` | WIRED | 저장은 lastSendAt 뿐 |
| `useRoomConnection` | `seatFloats`·`DayScene` | `onEvent` 구독 | WIRED | emoji·error 프레임 |
| `RoomScreen` | `DayScene` | 낮 단계 장면 키 | WIRED | `src/screens/RoomScreen.tsx` |
| `DayScene` | `Table` → `ClaimTag`·`SeatFloat` | `seats[]` 에 claim·float 주입 | WIRED | `view.day.claims` 와 `useSeatFloats` 에서만 값을 만든다 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `MessageLog` | `view.day.messages` | `say` 가 `state.messages` 에 추가 → `buildDay` 복사 | 예 (서버 상태) | ✓ FLOWING |
| `Table`(ClaimTag) | `view.day.claims` | `enterClaimReveal` 이 확정한 `claimShown`·`claimChanged` | 예 | ✓ FLOWING |
| `ClaimPanel` 칩 | `view.day.roles` | `rolesInPlay(players.length)` 구성표 | 예 | ✓ FLOWING |
| `ClaimPanel` 선택 | `view.me.claim` | `currentClaim(me)` (본인 값만) | 예 | ✓ FLOWING |
| `SeatFloat` 이모티콘 | emoji 프레임 | `emote` 이벤트 → `broadcastEvent` | 예 | ✓ FLOWING |
| `Timer` | `phaseEndsAt`·`phaseDurationMs` | `tick` 마감 + `phaseDurationOf`(연장 반영) | 예 | ✓ FLOWING |

고정값·빈 배열로 끝나는 연결은 없었다. `PublicPlayer.alive` 가 뷰에 없어 `QuickMessageSheet` 의 탈락자 필터가 현재 항상 "생존" 이 되는 점은 3페이즈 인계 항목이다(리뷰 IN-01).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 앱·워커 타입 검사 | `npm run typecheck` | 오류 없음 | ✓ PASS |
| 전체 테스트(한 번만 실행) | `npx vitest run` | 54 파일 974건 통과 | ✓ PASS |
| 규칙 테스트 존재 | `grep` 으로 `chat.test.ts`·`discussion.test.ts`·`test/worker/day.test.ts` 의 이름 있는 테스트 확인 | 쿨다운 1999/2000ms 경계, NOT_HOST, ALREADY_EXTENDED, 누출, 단계 거부 모두 존재 | ✓ PASS |
| 배포본 살아 있음 | `curl https://minifia.dhplay.workers.dev/api/health` | `{"ok":true,"version":"2026-10-23T18:47:24Z+1ca2b41"}` | ✓ PASS |
| 배포 버전이 현재 소스와 같은가 | `git diff --stat 1ca2b41 HEAD -- shared worker src public wrangler.jsonc` | 차이 없음(배포 뒤 변경은 문서·스모크 스크립트뿐) | ✓ PASS |
| 배포본 full 스모크 재실행 | 방을 만드는 쓰기 작업이라 이 검증에서는 돌리지 않음 | 02-11 SUMMARY 의 5명·4명 통과 기록과 위 버전 일치로 대신함 | ? SKIP (SUMMARY 기록은 증거가 아님: 대신 같은 규칙을 로컬 워커 통합 테스트가 실행하고 통과) |

### Probe Execution

Step 7c: SKIPPED — 이 페이즈 PLAN 은 `scripts/*/tests/probe-*.sh` 를 선언하지 않았고, 저장소에도 그런 파일이 없다.

### Requirements Coverage

PLAN 프런트매터의 요구사항 ID 합집합 = {DAY-01, DAY-02, COMM-01, COMM-02, COMM-04}. REQUIREMENTS.md 가 Phase 2 에 매핑한 ID 도 같은 다섯 개라 누락·고아 요구사항은 없다.

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|--------------|-------------|--------|----------|
| DAY-01 | 02-01·03·04·05·09·11 | 낮 토론 90초, 생존자 목록·남은 시간, 방장만 +30초·넘기기 | ✓ SATISFIED | 진실 2 |
| DAY-02 | 02-01·02·04·05·07·08·11 | 낮마다 직업 공개, 말 안 함, 시간 초과 처리, 말 바꿈 | ✓ SATISFIED (문구 차이 있음) | 진실 1. "시간이 넘으면 말 안 함" 은 1일차·끊긴 사람·어제 말 안 함에서 성립, 2일차 이후 연결된 사람은 어제 주장 유지 |
| COMM-01 | 02-03·04·05·06·07·09·10·11 | 낮 토론 빠른 메시지(대상·직업 채움), 말풍선+목록 | ✓ SATISFIED (찬반 투표 중은 Phase 4) | 진실 3 |
| COMM-02 | 02-03·05·06·07·09·10·11 | 이모티콘 6~8개, 캐릭터 위에 잠깐 | ✓ SATISFIED | 진실 4, 8종 |
| COMM-04 | 02-03·05·09·11 | 템플릿 ID·값만, 단계·생존·형식 검증, 자유 텍스트 거부, 2초 제한 | ✓ SATISFIED (밤·아침·탈락자 실동작은 Phase 3) | 진실 5. 서버가 discussion 외 단계와 `isAlive` 거부를 이미 갖췄지만 밤·탈락 자체는 아직 없어 실제 거부는 3페이즈에서 확인 |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (페이즈 수정 파일 전체) | - | TBD·FIXME·XXX 부채 표식 | - | 없음 (grep 0건) |
| (페이즈 수정 파일 전체) | - | TODO·HACK·PLACEHOLDER·"coming soon" | - | 없음 |
| `src/components/DiscussionControls.tsx` | 75-76, 104-107 | 방장 `skipping` 이 한 번 켜지면 같은 단계 안에서 해제 안 됨 (WR-03) | ⚠️ Warning | 정상 경로는 영향 없음. 소켓이 프레임 전달 전에 끊기거나 서버가 거절하면 방장이 남은 토론 동안 연장·넘기기를 못 쓴다. 성공 기준 2 의 방장 권한이 실패 경로에서 막힘 |
| `src/components/DiscussionControls.tsx` | 36-43, 54-62 | 클라이언트 쿨다운과 서버 쿨다운이 같은 2000ms (WR-02) | ⚠️ Warning | 지터에 걸리면 정상 메시지가 표시·알림 없이 사라질 수 있다(시트는 이미 닫힘). 성공 기준 3 의 "바로 보인다" 가 드물게 깨질 수 있다 |
| `src/net/useRoomConnection.ts` 외 | 58-67 | 서버 프레임을 `as ServerMessage` 로 캐스팅, 알 수 없는 emoji·직업 ID 가 룩업에서 TypeError (WR-04) | ⚠️ Warning | 서버·클라이언트가 같이 배포되는 정상 경로에서는 안 난다. 캐시된 옛 번들 탭이 새 ID 를 받으면 흰 화면. 성공 기준 4 의 이모티콘 경로에 해당 |
| `src/styles/day.css` | 51-53 | 메시지 로그 한 줄 말줄임 (WR-05) | ⚠️ Warning | 긴 닉네임이면 직업 주장이 잘릴 수 있음(실기기 확인 필요) |
| `shared/schemas.ts` | 19-25 | 직업 enum·`max(7)` 하드코딩 (WR-01) | ℹ️ Info | 직업이 늘면 조용히 BAD_MESSAGE. 지금은 정확 |

차단(🛑) 항목은 없다. 코드 리뷰 02-REVIEW.md 는 BLOCKER 0, 경고 5, 정보 6 이며 이 검증에서도 같은 결과를 확인했다. WR-02·WR-03·WR-04 는 위 표와 같이 성공 기준 2·3·4 의 실패 경로에만 닿고 정상 경로 증거(테스트·스모크)를 깨지 않는다.

### Human Verification Required

머리말의 `human_verification` 프런트매터와 같은 8개 항목이다.

#### 1. 360px 폰·8명 방 알약 겹침 (실기기 1)

**Test:** 폭 360px 폰, 8명 방에서 직업 공개와 낮 토론 화면을 연다.
**Expected:** 이웃 자리의 완료·주장 알약이 겹치지 않고, 앞쪽 자리의 이름표·주장 알약·방장 배지 3줄이 하단 패널에 가려지지 않는다.
**Why human:** 실기기 폭·주소창·안전 영역에서의 겹침은 jsdom 으로 볼 수 없다 (backstop).

#### 2. 가장자리 말풍선과 동시 말풍선 순서 (실기기 2)

**Test:** 좌우 끝 자리가 말풍선을 보내고 두 사람이 거의 동시에 보낸다.
**Expected:** 화면 밖으로 잘리지 않고 나중 것이 위에 보이며 3초 뒤 사라진다.
**Why human:** 렌더 위치·z 순서·애니메이션 느낌.

#### 3. "경찰 · 말 바꿈" 알약 폭 (실기기 3)

**Test:** 뒤쪽 자리 사람이 어제와 다른 직업을 공개한다.
**Expected:** 알약이 최대 112px 한 줄, 이웃 이름표를 가리지 않고 모든 폰에 보인다.
**Why human:** 실제 글꼴·폭에서의 겹침 (backstop).

#### 4. 360×640 스크롤 없음 (실기기 4·5)

**Test:** 360×640 폰에서 직업 공개 화면과 방장의 낮 토론 화면을 본다.
**Expected:** 세로 스크롤이 생기지 않는다.
**Why human:** 주소창을 포함한 실제 뷰포트 높이.

#### 5. 긴 닉네임 메시지 로그 잘림 (리뷰 WR-05)

**Test:** 8자 닉네임 사람이 '[닉네임]은 마피아였어요' 를 보낸 뒤 360px 폰의 로그를 본다.
**Expected:** 직업 이름이 말줄임으로 잘리지 않는다.
**Why human:** CSS 한 줄 말줄임이 직업 주장을 가리면 토론 성립에 영향.

#### 6. 쿨다운 오탐 (결정 0016-6, 리뷰 WR-02)

**Test:** 폰에서 메시지를 2초 간격으로 연달아 보낸다.
**Expected:** 정상 간격에서 표시 없이 사라지는 메시지가 없다. 사라지면 클라이언트 잠금에 지터 여유(예: +250ms)를 더하고 RATE_LIMITED 에 토스트를 붙인다.
**Why human:** 이동통신망 지터에서만 재현.

#### 7. iPhone Safari·Android Chrome 낮 한 바퀴

**Test:** 두 종류 기기가 배포 주소에서 직업 공개 → 연출 → 토론 → 넘기기 → 다음 낮을 돈다.
**Expected:** 같은 시각에 단계가 넘어가고, 이모티콘이 보낸 사람 캐릭터 위에 약 2초 떴다 사라지며, 공개 팝·흔들림이 부드럽다.
**Why human:** 애니메이션 느낌과 기기 차이.

#### 8. 결정 요청: ROADMAP SC1 문구 대 구현

**Test:** 아래 Gaps Summary 의 첫 항목을 읽고 선택한다.
**Expected:** 현재 동작(어제 주장 유지)을 채택하고 문서를 고치거나, 구현을 ROADMAP 문구대로 바꾼다.
**Why human:** 사용자가 승인한 설계와 문서 문구의 충돌이라 사람이 정한다.

### Gaps Summary

실패한 필수 항목(BLOCKER)은 없다. 사람이 판단해야 할 항목과 인계 사항만 남는다.

1. **ROADMAP SC1 문구와 구현의 차이 (WARNING, 결정 요청).** ROADMAP SC1 과 REQUIREMENTS DAY-02 는 "시간이 넘으면 말 안 함이 된다" 고 적는다. 구현(`shared/game/claim.ts` `shownFor`)은 1일차·끊긴 사람·어제 말 안 함인 사람만 말 안 함이 되고, 2일차 이후 연결된 사람이 고르지 않으면 어제 주장이 유지된다. 이는 02-CONTEXT D-09 와 결정 0015("2일차 이후 초기 선택은 어제 주장") 로 승인된 설계이고, 규칙표와 테스트(`claim.test.ts`)와 UI 문구("바꾸지 않으면 어제 선택이 그대로 공개돼요")가 일관된다. 다만 02-11 이 정정한 SC3·SC6 과 달리 SC1 문구는 고쳐지지 않았다. 의도한 차이로 보이므로 문구를 맞추거나 아래 override 를 승인하면 된다.

   ```yaml
   overrides:
     - must_have: "시간이 넘으면 말 안 함이 된다 (2일차 이후 연결된 사람은 어제 주장 유지)"
       reason: "CONTEXT D-09·결정 0015 로 승인된 설계: 2일차 이후 초기 선택은 어제 주장"
       accepted_by: "{사용자 확인 후 기입}"
       accepted_at: "{ISO timestamp}"
   ```
   (이 검증은 override 를 임의로 적용하지 않았다. 점수 6/6 은 위 설계를 근거로 한 판정이며, 사용자가 반대하면 truth 1 을 FAILED 로 되돌린다.)

2. **성공 기준 6 의 누름 횟수 집계 (INFO).** 기준은 시트 안 선택 횟수(템플릿 → 대상·직업 → 보내기)로 센다. 낮 토론 화면에서 시트를 여는 [빠른 메시지] 탭까지 세면 '의심돼요' 계열은 첫 문구가 선택돼 있어 3번, 다른 문구는 4번, '[○○]는 [직업]이었어요' 는 5번이다. 6페이즈 플레이테스트에서 불편하다는 반응이 있으면 재검토한다.
3. **3·4페이즈 인계.** (a) `PublicPlayer.alive` 가 뷰에 없어 탈락자가 대상 칩에 계속 보인다(IN-01): 3페이즈가 `buildView` 허용 목록과 `leak.test` 에 추가하고 HANDOFF 에 적는다. (b) `senderOf` 는 `discussion` 만 허용하므로 4페이즈의 찬반 투표 중 메시지 허용(COMM-01)·최후 변론 후보 전용 메시지(COMM-03)를 위해 이 검사를 넓혀야 한다. (c) 낮 단계 이름 목록이 `view.ts`·`RoomScreen.tsx`·`smoke.mjs` 세 곳에 따로 있다(IN-02): 단계를 더할 때 한 곳을 빼먹지 않게 한다.
4. **WR-02·03·04 정리 권장.** 정상 경로를 깨지 않아 phase 를 막지 않지만, 6페이즈 플레이테스트 전에 WR-02(쿨다운 지터 여유와 토스트)·WR-03(`skipping` 해제)·WR-04(알 수 없는 emoji·직업 ID 방어)를 고치는 것이 좋다.
5. **문서 상태.** `02-VALIDATION.md` 는 `status: draft`, `nyquist_compliant: false` 로 남아 있다. ROADMAP 의 Phase 2 체크박스와 진행표(11/11 "In Progress") 는 검증 후 오케스트레이터가 갱신한다.

---

_Verified: 2026-10-24_
_Verifier: Claude (gsd-verifier)_
