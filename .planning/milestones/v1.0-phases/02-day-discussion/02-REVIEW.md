---
phase: 02-day-discussion
reviewed: 2026-10-24T00:00:00Z
depth: standard
files_reviewed: 57
files_reviewed_list:
  - scripts/smoke.mjs
  - shared/game/alive.ts
  - shared/game/chat.ts
  - shared/game/claim.ts
  - shared/game/discussion.ts
  - shared/game/phases.ts
  - shared/game/roles.ts
  - shared/game/room.ts
  - shared/game/tick.ts
  - shared/game/view.ts
  - shared/protocol.ts
  - shared/schemas.ts
  - worker/room.ts
  - src/components/Chip.tsx
  - src/components/ClaimPanel.tsx
  - src/components/ClaimTag.tsx
  - src/components/DiscussionControls.tsx
  - src/components/EmojiTraySheet.tsx
  - src/components/Icon.tsx
  - src/components/MessageLog.tsx
  - src/components/QuickMessageSheet.tsx
  - src/components/SeatFloat.tsx
  - src/components/Table.tsx
  - src/game/messageText.ts
  - src/net/seatFloats.ts
  - src/net/useRoomConnection.ts
  - src/screens/Day.tsx
  - src/screens/DayScene.tsx
  - src/screens/RoomScreen.tsx
  - src/styles/chip.css
  - src/styles/day.css
  - src/styles/seat.css
  - src/styles/talk.css
  - test/unit/chat.test.ts
  - test/unit/claim.test.ts
  - test/unit/discussion.test.ts
  - test/unit/gameRoom.test.ts
  - test/unit/messageText.test.ts
  - test/unit/preview.test.ts
  - test/unit/roles.test.ts
  - test/unit/tick.test.ts
  - test/unit/view.test.ts
  - test/worker/alarm.test.ts
  - test/worker/day.test.ts
  - test/worker/leak.test.ts
  - test/worker/helpers.ts
  - test/client/chip.test.tsx
  - test/client/claimPanel.test.tsx
  - test/client/dayScene.test.tsx
  - test/client/discussion.test.tsx
  - test/client/emojiTraySheet.test.tsx
  - test/client/phaseScreens.test.tsx
  - test/client/quickMessageSheet.test.tsx
  - test/client/roomScreen.test.tsx
  - test/client/seatFloats.test.tsx
  - test/client/table.test.tsx
  - test/client/useRoomConnection.test.tsx
findings:
  critical: 0
  warning: 5
  info: 6
  total: 11
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-10-24
**Depth:** standard
**Files Reviewed:** 57
**Status:** issues_found

## Summary

낮 토론 페이즈의 서버 권위, 누출 방지, 자유 텍스트 거부, 속도 제한, 알람 재설정, 옛 저장 방 호환을 우선으로 봤다. `tsc`(앱·워커)는 오류 없이 통과했고 `vitest run` 은 54개 파일 974개 테스트가 모두 통과했다.

우선순위 항목 판정:

- **서버 권위**: `say`/`emote`/`selectClaim`/`extend`/`skip` 모두 소켓 첨부의 playerId 로만 신원을 찾고, 검사 순서가 계약대로다. 방장 판정·단계 판정·쿨다운은 서버(`shared/game/*`)에 있다. 문제 없음.
- **누출**: `buildView` 는 허용 목록 리터럴로만 만들고, `claimChoice`·`claimLast`·`lastSendAt` 은 어떤 뷰에도 실리지 않는다. 마감 전 `claimDone`(seat 만)과 본인 `me.claim` 외에는 나가지 않는다. `chat.ts`·`claim.ts` 는 `role` 필드를 읽지 않는다. 문제 없음. 거부 경로(`sendRejection`)도 같은 `buildView` 를 쓴다.
- **자유 텍스트 거부**: `z.strictObject` + 템플릿 ID/seat/직업 enum, `chat.ts` 의 `Object.hasOwn` 가드와 칸 과부족 검사로 막혀 있다. 서버는 문장을 만들지 않는다. 문제 없음.
- **속도 제한**: 연결당 20/s + 플레이어당 합산 2초 쿨다운(서버 `lastSendAt` 영속)이라 다중 소켓으로 우회되지 않는다. 다만 쿨다운 경계에서 클라이언트가 조용히 메시지를 잃는 경로가 있다(WR-02).
- **알람 재설정**: 마감을 바꾸는 `extend`·`skip` 뒤에 `reschedule()` 을 하고, `tick` 은 "이전 마감 + 길이" 연쇄라 늦은 알람에도 마감이 밀리지 않는다. 문제 없음.
- **옛 저장 방 호환**: 새 필드는 모두 optional 이고 읽는 쪽이 기본값을 쥔다. 1페이즈 종착 단계 `day` 는 생성자에서 `dayAnnounce` 로 옮기고 이 경우에만 알람을 다시 건다. 문제 없음.

BLOCKER 는 찾지 못했다. 아래는 견고성·유지보수·사용성 결함이다.

## Warnings

### WR-01: 클라이언트 검증 스키마의 직업 enum 이 구성표(ROLE_IDS)와 따로 하드코딩돼 컴파일 타임에 어긋남을 못 잡는다

**File:** `shared/schemas.ts:19`, `shared/schemas.ts:24-25`
**Issue:** `claim` 의 `z.enum(["mafia","police","doctor","citizen","none"])` 와 `say.claimedRole` 의 `z.enum([...])` 가 `ROLE_IDS`(roles.ts) 의 복사본이다. 파일 안 주석도 이를 인정한다. `satisfies z.ZodType<ClientMessage>` 는 출력 타입 대입 가능성만 보므로, `RoleId` 에 직업이 늘어도 enum 이 부분집합이면 타입 오류가 나지 않는다. 그러면 새 직업의 `claim`/`say` 가 서버에서 모두 `BAD_MESSAGE` 로 조용히 거부되고, 테스트는 기존 4직업만 써서 통과한다. 같은 이유로 `target: .max(7)`(24행)도 `MAX_PLAYERS` 와 따로 있다.
**Fix:** `ROLE_IDS` 를 `as const` 튜플로 바꿔 스키마가 그대로 쓰게 한다.
```ts
// roles.ts
export const ROLE_IDS = ["mafia", "police", "doctor", "citizen"] as const;
// schemas.ts
const roleId = z.enum(ROLE_IDS);
z.strictObject({ t: z.literal("claim"), claim: z.enum([...ROLE_IDS, "none"]) });
z.strictObject({ ..., claimedRole: roleId.optional(), target: z.number().int().min(0).max(MAX_PLAYERS - 1).optional() });
```

### WR-02: 클라이언트 쿨다운이 서버와 같은 2000ms 라 지터에 걸린 정상 메시지가 표시 없이 사라진다

**File:** `src/components/DiscussionControls.tsx:36-43`, `src/components/DiscussionControls.tsx:54-62`, `shared/game/chat.ts:42`
**Issue:** 클라이언트 잠금은 "보낸 순간의 로컬 시각 + 2000ms" 이고 서버는 "도착 시각 간격 < 2000ms" 로 거부한다. 사용자가 해제 직후(≥2000ms) 두 번째 메시지를 보내도, 두 번째 패킷이 첫 패킷보다 지연이 작으면 서버 도착 간격이 2000ms 아래가 되어 `RATE_LIMITED` 가 난다. 이때 빠른 메시지 시트는 이미 닫혔고(`QuickMessageSheet.send` 가 `requestClose()`), `RATE_LIMITED` 는 토스트도 없이 다시 잠그기만 하므로, 사용자는 보낸 줄 알고 메시지는 사라진다. 코드 주석이 "드물게" 라고 인정한 경로지만, 거부된 내용이 복구되지 않는 것이 문제다. 연결 수준 20/s 제한이 `RATE_LIMITED` 를 같은 코드로 보내므로 구분도 안 된다.
**Fix:** 클라이언트 잠금에 지터 여유를 더하고(`SEND_COOLDOWN_MS + 250`), `RATE_LIMITED` 를 받으면 토스트로 알린다. 또는 서버가 쿨다운 비교에 소량의 허용 오차를 둔다.
```ts
const CLIENT_COOLDOWN_MS = SEND_COOLDOWN_MS + 250; // 네트워크 지터 여유
...
if (e.code === "RATE_LIMITED") { lock(); showToast(ERROR_TOAST); }
```

### WR-03: 방장 `skipping` 상태가 한 번 켜지면 같은 단계 안에서 되돌릴 방법이 없다

**File:** `src/components/DiscussionControls.tsx:75-76`, `src/components/DiscussionControls.tsx:104-107`
**Issue:** `connection.send({t:"skip"})` 이 `true` 를 돌려주면(소켓 `send` 가 성공) `setSkipping(true)` 로 [넘기기] 와 [+30초 연장] 이 모두 비활성이 된다. 해제는 패널 언마운트(단계 전환)뿐이다. 서버가 프레임을 받기 전에 소켓이 끊기거나, 서버가 거절(연결 수준 `RATE_LIMITED` 등)하면 단계가 안 바뀌므로 방장은 남은 토론 내내(최대 120초) 두 버튼을 못 쓴다. 재접속해도 같은 `DiscussionControls` 인스턴스라 상태가 유지된다. 서버 오류 구독(`onEvent`)은 이미 있는데 `skipping` 해제에는 쓰이지 않는다.
**Fix:** 오류 프레임이나 `canSend` 가 거짓이 될 때 해제한다.
```ts
useEffect(() => { if (!connection.canSend) setSkipping(false); }, [connection.canSend]);
// onEvent 안: if (e.t === "error") setSkipping(false);
```

### WR-04: 서버 프레임 값을 검증 없이 룩업 테이블에 넣어, 모르는 이모티콘·직업 ID 하나가 화면 전체를 렌더 예외로 무너뜨린다

**File:** `src/net/useRoomConnection.ts:58-67`, `src/screens/DayScene.tsx:136`, `src/net/seatFloats.ts:69-82`, `src/game/messageText.ts:68`, `src/components/SeatFloat.tsx:28`
**Issue:** `parseServerMessage` 는 `t` 만 보고 `as ServerMessage` 로 캐스팅한다. `emoji` 프레임의 `icon` 은 `EMOJI_TEXT[lastEmoji.icon].name`(DayScene 렌더 중) 과 `Icon name={icon}` 에 그대로 들어가고, `ChatLine.claimedRole` 은 `ROLE_TEXT[...].name` 으로 들어간다. 값이 표에 없으면 `undefined.name` TypeError 가 렌더 중에 나고 에러 경계가 없어 흰 화면이 된다. 서버와 클라이언트는 한 번에 배포되지만, 캐시된 옛 번들 탭이 새 서버의 새 이모티콘 ID(문구는 표로 늘리는 구조라 `EMOJI_IDS` 가 늘기 쉽다)를 받으면 실제로 재현된다.
**Fix:** 표시 직전에 방어한다. 알 수 없는 `emoji` 프레임은 `parseServerMessage` 에서 버리고, 문장 생성은 기본값으로 떨어지게 한다.
```ts
if (v.t === "emoji" && !(EMOJI_IDS as readonly string[]).includes((v as {icon?: string}).icon ?? "")) return null;
// messageText: const role = ROLE_TEXT[msg.claimedRole]?.name ?? BLANK_ROLE;
```

### WR-05: 메시지 로그가 한 줄 말줄임이라 닉네임이 길면 가장 중요한 "직업 주장" 부분이 잘린다

**File:** `src/styles/day.css:51`, `src/styles/day.css:53`
**Issue:** `.mf-msglog__who` 는 `flex: none` 이고 `.mf-msglog__text` 는 `white-space: nowrap; text-overflow: ellipsis` 다. 닉네임은 최대 8자(`NICKNAME_MAX_GRAPHEMES`)다. 360px 폭에서 로그 안쪽 폭은 약 296px 이고 14px 글자 기준으로 보낸 사람 이름(최대 약 112px + 점·간격)과 "닉네임8자은 마피아였어요"(약 224px)를 합치면 폭을 넘어, 문장 끝의 직업이 `…` 로 잘린다. 로그 높이도 3줄 고정이라 줄바꿈 대안이 없다. 렌더링 기준 추정이므로 실기기 확인이 필요하다.
**Fix:** 문장 줄바꿈을 허용하거나(`white-space: normal; overflow-wrap: anywhere` 와 `min-height` 계산 조정), 보낸 사람 닉네임에 `max-width`(예: 5em)와 말줄임을 걸어 문장 쪽을 보존한다.
```css
.mf-msglog__name { max-width: 6em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
```

## Info

### IN-01: 탈락자 필터가 뷰에 `alive` 가 없어 현재 항상 참이다 (3페이즈 연결 고리 미정의)

**File:** `src/components/QuickMessageSheet.tsx:38`, `shared/game/alive.ts:4`, `shared/protocol.ts:110-115`
**Issue:** `candidates` 는 `isAlive(p)` 로 거르지만 `PublicPlayer` 에는 `alive` 키가 없어 `p.alive` 가 항상 `undefined` → 모두 생존이다. 서버(`chat.ts`)는 같은 함수로 대상 생존을 검사하므로, 3페이즈가 `Player.alive=false` 를 만들면 서버는 거부하는데 화면은 계속 후보로 보여 `BAD_MESSAGE` 토스트가 난다. `isAlive` 의 인자 타입에 `seat` 가 필수인 것도 쓰이지 않는다. 지금은 결함이 아니라 3페이즈 인수인계 항목이다.
**Fix:** 3페이즈에서 `PublicPlayer.alive` 를 추가하고 `buildView` 허용 목록과 `leak.test` 키 검사에 반영한다. `HANDOFF.md` 에 이 연결 고리를 적어 둔다.

### IN-02: 낮 단계 이름 목록이 세 군데(view.ts, RoomScreen.tsx, smoke.mjs)에 따로 있다

**File:** `shared/game/view.ts:12`, `src/screens/RoomScreen.tsx:39-41`, `scripts/smoke.mjs` (`DAY_PHASES`, `PHASE_NEXT`)
**Issue:** `DAY_PHASES`·`sceneKey`·스모크의 `PHASE_NEXT` 가 `PHASE_DEFS` 와 별개로 단계를 나열한다. 3페이즈가 밤 단계를 더할 때 한 곳을 빼먹으면 `view.day` 누락이나 장면 재마운트 같은 증상이 난다(스모크의 `PHASE_NEXT` 주석이 "phases.ts 의 next 와 같다" 로 수동 동기화를 요구한다).
**Fix:** `PhaseDef` 에 `isDay: boolean`(또는 `scene`) 열을 더해 `view.ts`·`sceneKey` 가 표에서 읽게 한다.

### IN-03: `TEMPLATE_ORDER` 가 `TEMPLATE_IDS` 전부를 덮는지 컴파일 타임에 검사되지 않는다

**File:** `src/game/messageText.ts:12`
**Issue:** `TEMPLATE_CHIP`·`EMOJI_TEXT` 는 `Record<…>` 라 항목이 빠지면 타입 오류가 나지만, `TEMPLATE_ORDER` 는 `readonly TemplateId[]` 라 새 템플릿을 더하고 순서 배열을 잊으면 시트에서 칩이 조용히 빠진다.
**Fix:** `satisfies` 와 길이 검사를 쓰거나, 단위 테스트에 `new Set(TEMPLATE_ORDER)` 와 `TEMPLATE_IDS` 가 같다는 단언을 추가한다.

### IN-04: 직업 선택 낙관적 표시가 무관한 state 방송에 지워져 잠깐 되돌아간다

**File:** `src/components/ClaimPanel.tsx:26-27`
**Issue:** `pending.view === view` 비교라 다른 플레이어의 선택으로 새 view 객체가 먼저 오면 내 낙관적 선택이 버려지고, 내 요청의 서버 방송이 올 때까지 이전 선택이 보였다가 다시 바뀐다. 데이터 오류는 아니고 깜빡임이다. 또 어제 값이 미리 선택된 칩을 다시 눌러도 아무 일이 없어(`claim === selected` 조기 반환) "완료" 알약이 켜지지 않는다. 안내 문구와는 일치하지만, 연결이 마감 순간 끊기면 어제 값 유지 대신 `none` 이 공개된다(`shownFor`).
**Fix:** 낙관적 값을 view 참조가 아니라 "서버가 내 `me.claim` 을 확정할 때까지" 유지하거나 단순히 `pending.claim` 을 우선 쓰고, 같은 단계 안에서만 버린다. 같은 칩 재누름을 "확정"으로 서버에 보낼지 기획에서 정한다.

### IN-05: 스모크의 RATE_LIMITED 기대가 네트워크 지연에 민감하다

**File:** `scripts/smoke.mjs` (낮 토론 단계, `expectError(... "RATE_LIMITED" ...)` 직전)
**Issue:** 첫 `say` 가 모든 클라이언트에 나타날 때까지 기다린 뒤 두 번째 `say` 를 보내는데, 배포본에서 이 사이가 2초를 넘으면 두 번째가 성공해 error 프레임이 오지 않고 `waitUntil` 시간 초과로 실패한다. 이어지는 `sleep(2100)` 은 emoji 송신자가 `clients[2]` 라 사실상 필요 없다.
**Fix:** 두 번째 `say` 를 첫 `say` 직후(대기 전)에 보내거나, 쿨다운 기준 시각을 첫 `say` 송신 시각으로 재서 2초 안일 때만 단언한다.

### IN-06: 방 Durable Object 핸들러의 신원 확인 보일러플레이트와 이모티콘 이벤트 이중 구독

**File:** `worker/room.ts:241-392`, `src/screens/DayScene.tsx:43-48`, `src/net/seatFloats.ts:68-83`
**Issue:** `att`/`this.room` 확인 + `BAD_MESSAGE` 응답 7줄이 핸들러 일곱 곳에 복사돼 있다. 클라이언트에서는 `DayScene` 과 `useSeatFloats` 가 각각 `onEvent` 로 `emoji` 를 구독한다. 둘 다 동작에는 문제 없지만 변경 시 한 곳을 빼먹기 쉽다.
**Fix:** `private actor(ws): { playerId: string; room: RoomState } | null` 헬퍼로 모으고, 접근성 live 줄용 마지막 이모티콘은 `useSeatFloats` 가 반환하게 한다.

---

_Reviewed: 2026-10-24_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
