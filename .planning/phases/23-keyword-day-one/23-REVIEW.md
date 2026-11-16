---
phase: 23-keyword-day-one
reviewed: 2026-11-17T05:10:00Z
depth: deep
files_reviewed: 24
files_reviewed_list:
  - shared/game/keywordAnswer.ts
  - shared/game/keywordGuard.ts
  - shared/game/keywords.ts
  - shared/game/early.ts
  - shared/game/gameLog.ts
  - shared/game/phases.ts
  - shared/game/tick.ts
  - shared/game/view.ts
  - shared/game/room.ts
  - shared/game/endgame.ts
  - shared/game/verdict.ts
  - shared/game/discussion.ts
  - shared/schemas.ts
  - worker/room.ts
  - worker/gameLog.ts
  - migrations/0001_games.sql
  - wrangler.jsonc
  - scripts/games.mjs
  - scripts/check-deploy-target.mjs
  - src/net/useKeywordAnswer.ts
  - src/screens/Keyword.tsx
  - src/game/keywordView.ts
  - src/components/RoleCardSheet.tsx
  - src/net/earlyCalm.ts
findings:
  critical: 0
  warning: 4
  info: 6
  total: 10
  necessity: 0
status: issues_found
---

# Phase 23: Code Review Report

**Reviewed:** 2026-11-17
**Depth:** deep
**Files Reviewed:** 24 (위 목록 + RoomScreen·ResultAnnounce·dayView·hostLine 의 diff 를 함께 읽음)
**Status:** issues_found

## Summary

첫날 키워드 단계의 서버 규칙·view·조기 진행·D1 판 기록을 적대적으로 읽었다. 판 진행을 깨거나 역할·키워드를 새게 하는 BLOCKER 급 결함은 찾지 못했다.
아래는 직접 확인한 것이다.

- **view 누설**: `day.keyword` 는 `buildDay` 가 `state` 만 읽어 만들므로 모든 역할에게 같은 모양이다(`view.ts:80-87`). `me.keyword` 는 `phase === "keyword"` + 산 비마피아에게만 키가 생기고(`view.ts:236`), `me.answer` 는 본인 좌석만 읽는다(`view.ts:241-245`). `answerDraft` 는 `view.ts` 어디에도 펼쳐 복사되지 않는다(전체 grep). 정답은 `answerOpenOf` 한 함수가 정한다 — 첫날 `keyword`·`dayAnnounce`·낮 단계·처형 단계에서는 거짓이고 `answerReveal` 진입 프레임부터 참이다.
- **마피아 떠보기 시간차**: 첫 거절의 추가 `storage.put` 은 보낸 마피아 본인 소켓에만 영향을 준다(다른 소켓엔 프레임이 없고, 보낸 사람은 자기 역할을 이미 안다). 응답 모양은 시민과 같다(오류 + 본인 state). 관찰 가능한 누설은 없다.
- **일차 판정**: `day` 는 `enterDayAnnounce` 에서만 늘고 `keyword` 중에는 `undefined` → `(day ?? 1) === 1` 이다. 첫날 처형 있음·없음(부결·동률·0표) 경로가 모두 `afterDayOf`/`routeAfterExecution` 한 규칙으로 `answerReveal` 에 닿고, 승패가 나면 `ended`(정답 공개) 로 간다. `night` 로 가는 다른 리터럴 경로는 없다(`grep '"night"'` 확인).
- **다시 하기 이월**: `rematch` 허용 목록(`REMATCH_ROOM_KEYS`)에 새 키가 없어 `keyword`·`keywordAnswers`·`answerSubmits`·`keywordProbed`·`earlyFrom`·`startedAt`·`gameId` 가 새 판으로 넘어가지 않고, `resetToLobby`·`toLobbyFromLegacy` 도 허용 목록 방식이다. `gameId` 는 시작·다시 하기마다 새로 붙는다.
- **번들**: 지금 `dist/client` 에 `렛잇고`·`단풍나라`·`마추픽추`·`Hot Dog`·`keywordProbed`·`answerSubmits` 가 없다(grep 확인). 다만 이것은 트리 셰이킹 덕이다 — WR-03.
- **성능**: `violatesKeyword` 는 300 UTF-16 길이 입력 20,000회에 약 180ms(백트래킹 없음, ReDoS 아님). 입력은 스키마 300자 + 프레임 1024B + 연결당 20/초로 묶인다.
- **D1**: 삽입은 전부 `?` 바인딩, 행에는 닉네임·채팅·답 글이 없다. 판 id·승리 진영·장르 id·단어·숫자뿐이다. `games.mjs` 는 허용 인자 셋 밖이면 아무것도 실행하지 않고, SQL 은 상수이며, `shell: false` 로 wrangler 를 부르고, `--remote` 전에 `judgeWhoami` 를 거친다.
- 단위 시험 6개 파일 120건 통과(`keywordAnswer`·`keywordGuard`·`keywords`·`early`·`gameLog`·`keywordFlow`).

남은 결함은 금지어 판정의 구멍 하나, 클라이언트 오탐 알림 하나, 키워드 목록의 번들 안전이 도구가 아니라 우연에 기대는 점, D1 삽입의 신뢰성 가정 하나다.

## Warnings

### WR-01: 자모를 풀어 쓴 답이 금지어 판정을 통과한다 (받침 있는 키워드) — 머리말의 "NFKC 가 이미 합친다" 가 틀렸다

**File:** `shared/game/keywordGuard.ts:26-28`, `:53` (머리말 `:7`)
**Issue:** `normalizeForGuard` 는 NFKC 뒤 글자·숫자 외를 지운다. 호환 자모 자음(`ㄱㄴㄷ…`)은 NFKC 에서 **초성 자모(U+1100~)** 로만 바뀌고 받침(종성 U+11A8~)으로는 바뀌지 않아, 받침 자리의 자음은 앞 음절과 합쳐지지 않는다. 직접 확인한 값:

```
"ㅁㅕㅇㄹㅑㅇ"      -> 며 ᄋ 랴 ᄋ   (명량 아님)  → includes("명량") === false
"ㅂㅜㅅㅏㄴㅎㅐㅇ"   -> 부 사 ᄂ 해 ᄋ  (부산행 아님) → 초성열 ᄇᄉᄂᄒᄋ ⊅ ᄇᄉᄒ
```

실패 시나리오: 시민이 키워드가 `명량`·`부산행` 인 판에서 `ㅁㅕㅇㄹㅑㅇ`·`ㅂㅜㅅㅏㄴㅎㅐㅇ` 를 확정 제출하면 통과해, 모두의 답 목록(`day.keyword.answers`)에 그대로 공개된다. 마피아는 읽을 수 있다. 2글자 키워드는 초성 검사가 없고, 3글자 이상도 받침 자음이 초성열 중간에 끼어 초성열이 끊기므로 둘 다 뚫린다. 받침 없는 단어(`고양이`·`아바타`)는 `ㅇㅏㅂㅏㅌㅏ` 처럼 정상 합쳐져 막힌다.
제품 규칙(0091-5)은 "철자 틀림 우회는 매너에 맡긴다" 이지만 이것은 철자가 아니라 같은 글자의 다른 인코딩이고, 머리말이 "호환 자모는 NFKC 가 합친다" 며 막힌다고 적어 두었다(문서 거짓).
**Fix:** 판정용 정규형에서 종성 자모를 같은 자음의 초성 자모로 접는다(27개 항목, 직접 만든 NFC 대체가 아니라 판정 전용 접기). 답·키워드·별칭 모두 같은 함수를 지나게 해서 양쪽이 같은 형태가 되도록 한다:

```ts
// 종성(U+11A8..U+11C2) → 같은 자음의 초성(U+1100..U+1112). 대응이 없는 겹받침은 자기 자신.
const JONG_TO_CHO: Record<number, number> = { 0x11a8: 0x1100, 0x11ab: 0x1102, 0x11ae: 0x1103, 0x11af: 0x1105, 0x11b7: 0x1106, 0x11b8: 0x1107, 0x11ba: 0x1109, 0x11bc: 0x110b, /* … */ };
export function normalizeForGuard(s: string): string {
  const d = s.normalize("NFKD").replace(/[^\p{L}\p{N}]/gu, "").toLowerCase(); // 음절을 자모로 푼 뒤 종성을 초성 모양으로 접는다
  return [...d].map((c) => String.fromCodePoint(JONG_TO_CHO[c.codePointAt(0)!] ?? c.codePointAt(0)!)).join("");
}
```

초성 검사(`choseongOf`)는 자모로 푼 문자열 기준이 되므로 함께 손본다(완성형 음절 판정이 사라지므로 "초성열" 대신 "각 음절의 첫 자모" 를 모은 형태가 필요하다). 고치기 전에 단위 시험 `ㅁㅕㅇㄹㅑㅇ`·`ㅂㅜㅅㅏㄴㅎㅐㅇ` 를 막힘 기대로 먼저 넣는다. 고치지 않을 거라면 `keywordGuard.ts:7` 문장을 "받침 있는 단어를 자모로 풀어 쓰면 통과한다" 로 바로잡고 0091 알려진 한계에 적는다.

### WR-02: 확정 직후 3초 안에 온 모든 error 프레임을 "금지어 거절" 로 읽는다 — 마감 직후 도착한 확정에 거절 알림과 deny 소리가 난다

**File:** `src/net/useKeywordAnswer.ts:185-199` (주석 `:9-11`)
**Issue:** 거절 감지는 `e.t === "error"` 면 코드와 무관하게 `KEYWORD_REJECT_WINDOW_MS`(3초) 안에서 거절로 본다. 서버가 같은 창에 보내는 다른 오류가 있다:
- 확정이 마감 직후에 도착하면 서버는 먼저 `advance` 로 `dayAnnounce` 로 넘기고 `WRONG_PHASE` + state 를 보낸다(`room.ts:1124` `sendRejection`). 프레임 순서가 error → state 라서, `Keyword` 화면이 아직 마운트된 순간 이 오류를 받아 `setNotice("쓸 수 없는 말이에요")` 와 `emitSignal({ kind: "deny" })` 를 낸다. 주석(`:11`)은 "그 시간이 지난 뒤 온 거절은 조용히 넘긴다" 고 하지만 3초 창이 이 경우를 덮는다.
- `RATE_LIMITED` 도 같다(`room.ts:393`).

실패 시나리오: 사용자가 마감 0.3초 전에 [보내기] → 왕복 지연이 0.3초를 넘으면 낮 시작 순간에 deny 소리가 나고 "쓸 수 없는 말이에요" 가 한 프레임 뜬다. 금지어는 지금 서버에서 `BAD_MESSAGE` 로만 오므로 코드로 가르면 정확하다.
**Fix:**
```ts
return onEvent((e) => {
  if (e.t !== "error" || e.code !== "BAD_MESSAGE") return; // 금지어 거절은 BAD_MESSAGE 뿐이다(WRONG_PHASE·RATE_LIMITED 는 거절이 아니다)
  ...
});
```
주석 `:9-11` 의 "코드 무관" 도 고친다. 화면이 사전에 막는 빈 글·20자 초과는 이미 보내지 않으므로 이 조건으로 오탐은 사라진다.

### WR-03: 키워드 목록 전체가 클라이언트 모듈 그래프에 정적으로 들어 있고, 번들에서 빠지는 것은 트리 셰이킹 우연이다

**File:** `shared/game/room.ts:22`, `:447-448` (`import { KEYWORD_SWITCH, pickKeyword } from "./keywords"`), `shared/game/keywords.ts:6-9`
**Issue:** `src/game/hostLine.ts:13`·`src/screens/Lobby.tsx:6` 가 `shared/game/room.ts` 에서 `connectedCount` 를 가져오고, `room.ts` 가 `keywords.ts`(306개 단어 + 별칭)를 정적 import 한다. `keywordStaticGuard.test` 는 `src/` 파일이 직접 import 하는 것만 막으므로 이 경로는 잡지 못한다. 지금 `dist/client` 에는 목록이 없지만(grep 확인) 그것은 `beginGame` 이 미사용 함수로 제거되어서다. 다음 중 하나만 생기면 목록이 번들에 실린다: 클라이언트가 `room.ts` 의 다른 값 가져오기(`startGame`·`beginGame` 호출 경로), `keywords.ts` 최상위에 함수 호출·`.map` 추가, 번들러 설정 변경. 실행 중 `vite dev` 는 모듈 단위로 서빙하므로 개발 서버에서는 지금도 클라이언트가 전체 목록을 받는다. 저장소가 공개라 목록 자체는 비밀이 아니지만, 클라이언트 번들 안의 목록은 "이 판의 장르 후보" 를 마피아 폰에서 바로 긁을 수 있게 한다(장르 라벨은 view 에 있다).
**Fix:** `beginGame` 이 키워드를 인자로 받게 하고(`beginGame(state, now, randInt, keyword?)`), 고르는 일은 서버 전용 모듈(`worker/` 또는 `keywordAnswer.ts` 옆)이 한다 — `room.ts` 가 `keywords.ts` 를 import 하지 않게 한다. 보강으로 `npm run build` 뒤 `dist/client` 에서 표본 별칭(`렛잇고`)을 grep 하는 시험을 하나 둔다(수동 확인을 자동으로).

### WR-04: 판 기록 삽입이 `ctx.waitUntil` 로 매달린 약속이라 DO 가 내려가면 통계가 조용히 빈다 (문서가 가정으로 인정한 A3)

**File:** `worker/room.ts:1242-1248`, `worker/gameLog.ts:10-30`
**Issue:** `recordGame` 은 `insertGame(...).catch(...)` 를 기다리지 않고 `ctx.waitUntil` 에 넘긴다. Durable Object 에서 `waitUntil` 이 핸들러 종료 뒤 D1 요청을 끝까지 살려 주는지는 문서·실행으로 확인되지 않았다(0091-23 이 "문서만 믿고 실제 관찰은 없다" 고 적음). 최후 전환(`ended`) 직후 소켓 핸들러·알람이 끝나고 DO 가 하이버네이션되면 진행 중이던 삽입이 취소될 수 있고, `.catch` 에도 잡히지 않아 로그도 남지 않는다 — 통계는 한 판씩 빈다(판 진행에는 영향 없음). 한 판에 한 번뿐인 호출이라 기다리는 비용은 D1 왕복(수십 ms)이다.
**Fix:** 마지막에 기다린다 — 알람 재설정 뒤에 두면 판 진행 지연이 없다:
```ts
private async afterTransition(prev: RoomState, now: number): Promise<void> {
  ...
  await this.reschedule();
  await this.recordGame(prev); // 아래 try/catch 안에서 await, 실패는 삼킨다
}
private async recordGame(prev: RoomState): Promise<void> {
  ...
  try { await insertGame(db, row); } catch { console.error("game log failed"); }
}
```
`waitUntil` 을 쓰고 싶다면 `ended` 진입 시 한 번 `ctx.waitUntil` + 로컬·배포 환경에서 실제로 행이 남는지 확인하는 단계를 24 첫 단계(0091-18)에 추가한다.

## Info

### IN-01: 마피아 떠보기는 키워드 목록이 공개라서 한 번에 여러 후보를 시험할 수 있다 (설계 수용 범위 내 — 한계 기록 권장)

**File:** `shared/game/keywordAnswer.ts:94-96`, `shared/game/keywordGuard.ts:48-54`
**Issue:** 거절은 "금지어 포함" 이라는 1비트 신호다. 부분 포함 + 초성열 포함이라 20자소 한 답에 후보 5~8개(단어 이어 붙이기 + 초성열 겹치기)를 넣어 한 번에 시험할 수 있고, 목록이 공개 저장소에 있어 미리 계산할 수 있다. 다만 신호가 한쪽 방향이다: 거절 = 적중(대가 없음), 통과 = 그 답이 확정되어 잠긴다(`submitAnswer` 단계 3). 그래서 시도 횟수는 "적중 횟수 + 1" 로 묶여 400ms 간격과 무관하게 정보량이 제한되고, 마피아가 맞히지 못하면 이상한 답이 공개된다. 쓰던 글(초안)은 검사하지 않고 마감에서만 걸러지므로 마감 시점에 한 번 더 같은 신호가 공개 목록의 `답 없음` 으로 나온다. 0091-7·0091-20 이 떠보기 자체를 수용했으므로 결함은 아니다.
**Fix:** 한계 기록(0091 "알려진 한계")에 "한 답 안의 후보 묶음 시험" 을 적는다. 막고 싶으면 거절 시 마피아에게만 잠금(그 단계 확정 불가)을 거는 대신 시민·마피아 모두 한 확정당 거절 횟수 상한(예: 3회) 뒤 BAD_MESSAGE 무응답으로 바꾼다.

### IN-02: 연결이 끊긴 사람이 한 명이라도 있으면 그 판은 끝까지 조기 진행이 꺼진다

**File:** `shared/game/early.ts:21-37`
**Issue:** 의도된 규칙(0091-10, D-12)이지만 영향이 크다. 끊긴 채로 돌아오지 않는 산 사람(폰 꺼짐)이 있으면 그 사람이 처형·암살되기 전까지 찬반·밤·키워드의 `earlyReady` 가 영영 거짓이다. 방은 정해진 시간을 다 쓰는 옛 동작으로 돌아가므로 오류는 아니다.
**Fix:** 실테스트 뒤 판단 — 끊긴 지 N초(예: 10초) 지난 사람을 분모에서 빼는 방식. 연결 여부가 역할 정보는 아니므로 누설은 없다.

### IN-03: 배포 가드가 실제 배포 입력(빌드 산출물)이 아니라 원본 `wrangler.jsonc` 의 D1 id 를 본다

**File:** `scripts/check-deploy-target.mjs:25-33`, `scripts/deploy-target.mjs:114-120`
**Issue:** `npm run deploy` 는 `dist/worker/wrangler.json`(vite 가 만든 것)으로 배포한다. 가드는 `source.d1_databases`(원본)를 검사한다. 두 값이 어긋나면(플러그인이 바인딩을 바꾸거나 `.wrangler/deploy/config.json` 이 다른 산출물을 가리키면) 가드가 통과해도 id 없는 D1 이 자동 생성될 수 있다. 또 `npm run deploy` 를 거치지 않는 `npx wrangler deploy` 는 가드를 지나지 않는다(기존 `name` 검사와 같은 구조).
**Fix:** `builtPath` 의 `built.d1_databases` 도 같은 판정에 넣는다(`d1Databases: built.d1_databases ?? source.d1_databases ?? []`).

### IN-04: 목록 개수 문서 불일치와 항목 사이 부분 포함·초성 겹침(오탐)

**File:** `docs/decisions/0091-v3-keyword-day-one.md` 0091-4, `shared/game/keywords.ts`
**Issue:** 문서는 "전체 310개" 인데 실제는 306개(영화 33·음식 45·동물 45·장소 47·스포츠 42·물건 51·나라 43). 단어·별칭 정규형의 길이 1·중복은 없다(스크립트로 전수 확인). 다른 항목의 문자열을 부분으로 품는 별칭이 있어 그 키워드일 때 무관한 답이 거절된다: `미국`의 `USA` ⊂ `Busan`, `냄비`의 `Pot` ⊂ `potter`·`Hippopotamus`, `강아지`의 `Dog` ⊂ `Hot Dog`, `수달`의 `Otter` ⊂ `Harry Potter`. 3글자 이상 초성열이 다른 항목과 겹치는 것도 있다: `명량`의 별칭 `이순신` ↔ `인셉션`(ㅇㅅㅅ), `마라탕`↔`마라톤`, `핀란드`↔`폴란드`, `한라산`↔`헬라스`.
**Fix:** 숫자는 문서를 306 으로 바로잡는다. 오탐은 0091-19 가 수용한 범주지만, 영어 3글자 별칭(`Pot`·`Dog`·`USA`)은 부분 포함 대신 낱말 경계 비교로 바꾸거나 제거하면 시민 오탐이 줄어든다.

### IN-05: `probe_success` 통계가 오탐을 섞어 센다

**File:** `shared/game/keywordAnswer.ts:95`, `shared/game/gameLog.ts:61`
**Issue:** 마피아가 떠본 것이 아니라 "자연스러운 답" 이 금지어(`해리`, 초성열 오탐)에 걸려도 `keywordProbed` 가 켜져 D1 "떠보기 성공" 에 들어간다. 개인용 통계라 영향은 작다.
**Fix:** 24 에서 지표를 쓸 때 "거절 횟수 ≥ 1" 로 정의가 맞는지 확인한다. 필요하면 키워드 단계 거절이 아닌 사유를 구분하기 위해 마피아 거절 횟수를 숫자 열로 바꾼다(되돌리기 비싼 스키마라 지금 결정).

### IN-06: 상수로 굳은 열과 시험 전용 스위치가 제품 모듈에 있다

**File:** `shared/game/gameLog.ts:67,69`, `shared/game/keywords.ts:26`
**Issue:** `note_count`·`tutorial` 은 24 전까지 0 으로 고정(문서화됨). `KEYWORD_SWITCH` 는 가변 전역 객체로 제품 모듈에 있고 시험 setup 이 끈다 — 소켓·HTTP 로는 바꿀 수 없어 위험은 없지만, 새 시험 환경이 스위치를 켜 두는 것을 잊으면 모든 판이 키워드 흐름으로 간다.
**Fix:** 조치 불필요. 24 에서 열을 채울 때 함께 정리한다.

---

_Reviewed: 2026-11-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
