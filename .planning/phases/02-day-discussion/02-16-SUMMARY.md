---
phase: 02-day-discussion
plan: 16
subsystem: day-scene-wiring
tags: [day-table, day-scene, chat-events, name-tag-spoke, tdd, gap-closure, decision-0017]
gap_closure: true
gap_ids: [G-02-1]
status: complete

requires:
  - phase: 02-day-discussion
    provides: 02-12 의 chat 방송 프레임, 02-14 의 DayTable 부품, 02-15 의 방장 줄 제거
provides:
  - DayScene 이 직업 공개·공개 연출·낮 토론 세 단계를 DayTable 하나로 그린다 (아랫줄 …/✓ 완료/주장·팝, 보낸 사람 반전, 머리 위 이모티콘)
  - src/net/seatFloats.ts — useSeatFloats(반환 { emoji, spoke }), useDayChat, SPOKE_MS 3000, EMOJI_MS 2000 (이벤트에서만, 복원 없음)
  - day.css 장면 상자 좌우 12px / 389px 이하 4px (flex 1·min-height 0 그대로, .mf-table 규칙 삭제)
  - DayView 에서 messages 선언 삭제 (와이어 계약에 메시지 보관 흔적 없음)
  - 대기실·배정 전용으로 줄어든 Table (TableFloat·done·claim·float·clamp·주장 오프셋 없음)
affects: [02-17, 02-18]

requirements-completed: [DAY-01, DAY-02, COMM-01, COMM-02]

actuals:
  tokens: 23700
  tasks: 3
  commits: 5
plan_head_before: e4dc0ec48a91f8331ab55f7220f400ccbc06270f
plan_head_after: affb23b6258cd76fc9c40cbca7e0ab6cd4ac498a

tech-stack:
  added: []
  patterns:
    - "채팅 줄·반전·이모티콘은 이 폰이 discussion 중에 받은 chat·emoji 이벤트에서만 만든다. 처음 마운트(재접속)에는 빈 상태에서 시작하고 서버 뷰의 옛 messages 키는 읽지 않는다"
    - "일차(view.day.n)가 바뀌면 그 일차의 줄만 보이도록 상태에 n 을 함께 들고 파생한다 (이벤트 없이도 이전 일차 줄이 안 보임)"
    - "테스트 단언은 한 줄 값(문자열·숫자)으로 한다 — 배열 toEqual·DOM 노드 toBeNull 은 실패 때 여러 줄 보고서를 쏟아 TAP 을 깨뜨린다 (02-14·02-15 와 같은 패턴)"

key-files:
  created: []
  modified:
    - src/screens/DayScene.tsx
    - src/styles/day.css
    - src/net/seatFloats.ts
    - shared/protocol.ts
    - src/components/Table.tsx
    - src/styles/talk.css
    - test/client/dayScene.test.tsx
    - test/client/discussion.test.tsx
    - test/client/seatFloats.test.tsx
    - test/client/table.test.tsx
    - test/client/phaseScreens.test.tsx
  deleted:
    - src/components/SeatFloat.tsx
    - src/components/ClaimTag.tsx
    - src/styles/seat.css

key-decisions:
  - "아랫줄 완료는 서버 claimDone 만으로 정한다. 2일차에 me.claim 이 미리 있어도 claimDone 에 내 자리가 없으면 … 이다 (T-02-44)"
  - "공개 연출 팝은 이 화면이 직전에 claim 을 보다가 claimReveal 을 받았을 때만 켠다 (기존 revealing 규칙을 아랫줄 pop 으로 옮김). 재접속으로 바로 들어오면 주장만 보인다"
  - "반전(spoke)과 이모티콘(emoji)은 서로 지우지 않고 한 자리에 함께 있을 수 있다 (하나는 이름표, 하나는 머리 위)"
  - "useDayChat 은 seatFloats.ts 에 둔다 (같은 chat·emoji 이벤트의 discussion 구독 규칙을 한 파일에서 공유)"
  - "claimedRole 은 ROLE_IDS 안의 값만 복사한다 (계획의 '허용 키만 필드별 복사' 에 값 검증을 더함, T-02-45)"

duration: 약 20분
completed: 2026-10-24
---

# Phase 2 Plan 16: 낮 세 단계 장면을 고정 테이블로, 채팅은 폰 메모리로 Summary

**DayScene 이 직업 공개·공개 연출·낮 토론을 DayTable 하나(다시 마운트 없음)로 그리고, 완료·주장은 이름표 아랫줄, 빠른 메시지는 보낸 사람 이름표 반전 3초, 머리 위는 이모티콘만 뜬다. 채팅 줄은 서버 뷰가 아니라 폰이 그날 받은 chat 이벤트로만 만들고, 옛 낮 전용 층(SeatFloat·ClaimTag·seat.css)은 저장소에서 지웠다.**

## 수행 내용

- **Task 1 (트레이서, 결정 0017-1·0017-2·0017-6)**: `DayScene` 이 `view.players` 를 seat 순으로 돌며 `DayTableSeat` 을 만든다. 아랫줄은 claim 단계에서 `claimDone` 에 있으면 done, 아니면 wait, claimReveal·discussion 에서는 공개 `claims` 의 주장(`pop` 은 직전에 claim 을 보다 claimReveal 을 받은 CLAIM_REVEAL_MS 동안만). 동료 표시는 `me.allies` 에서만. 장면 상자(`.mf-dayscene__scene`)는 좌우 12px, 폭 389px 이하에서 4px 이고 `flex: 1; min-height: 0` 을 유지해 DayTable 루트(100%×100%)가 실제 폭·높이를 잰다. `.mf-table` 장면 규칙은 지웠다. 트레이서 게이트: 자동 모드가 아니고 `<verify>` 가 자동 검사뿐이라 GREEN 뒤 `dayScene·discussion·roomScreen·phaseScreens` 테스트와 `npm run typecheck` 를 다시 돌려 통과를 확인한 뒤 Task 2 로 넘어갔다.
- **Task 2 (결정 0017-7·0017-2)**: `seatFloats.ts` 를 다시 썼다. `useSeatFloats` 는 `{ emoji, spoke }` 를 돌려주며 discussion 일 때 온 chat(→ 3000ms 반전)·emoji(→ 2000ms)만 받고 `view.day.messages` 를 읽지 않는다. `useDayChat` 은 discussion 중 chat 이벤트만 허용 키(`seq·seat·template·target?·claimedRole?·at`)로 복사해 쌓고, 본 최대 seq 이하·모르는 template·형식이 다른 값은 버리며, 일차가 바뀌면 비운다. `DayView.messages` 선언을 지웠다.
- **Task 3 (정리, tdd 아님, G-02-1 artifacts)**: `Table` 에서 `TableFloat`·`done`·`claim`·`float`·`FLOAT_Z`·clamp 가로 가두기·완료/떠 있는 층·주장 오프셋·seat.css import 를 걷어내고 `SeatFloat.tsx`·`ClaimTag.tsx`·`seat.css` 를 `git rm` 했다. 대기실·배정 동작과 `Lobby.tsx`·`Assigning.tsx`·`lobby.css`·`shared/seatLayout.ts` 는 BASE 와 같다. `table.test.tsx` 의 SeatFloat·완료·ClaimTag 묶음을 지우고 "TableSeat 에 done·claim·float 를 넣을 수 없다" 타입 테스트를 더했다.

## TDD 게이트

두 TDD 태스크 모두 RED(`test(02-16)`) 커밋이 GREEN(`feat(02-16)`) 보다 먼저다. RED 증거는 `gsd check tdd-red-evidence` 로 검증해 둘 다 `RED_EVIDENCE_OK`.

| Task | RED | GREEN | RED 의미 평가 |
| --- | --- | --- | --- |
| 1 | fa013e5 | f5ad9d0 | 대상 `claimDone [1,3] → 자리 1·3 아랫줄만 ✓ 완료…` 가 `.mf-dt__claim--done` 플래그 단언(기대 `0101`, 실제 `0000`)에서 실패 — 옛 Table 에는 `.mf-dt__` 요소가 없다. 같은 이유로 주장·팝·다시 마운트 없음·장면 상자 CSS·높이 배선(`.mf-dt__felt` 가 없어 TypeError)·`--spoke`·`.mf-dt__emoji` 테스트도 RED. 패널 HTML 비교와 ClaimPanel 테스트는 기존 동작이라 RED 에서도 통과 |
| 2 | 83f3459 | f0b579a | 대상 `상수: 반전 SPOKE_MS 3000, 이모티콘 EMOJI_MS 2000` 이 단언(기대 `3000:2000`, 실제 `undefined:2000`)에서 실패. 훅 테스트들은 `useDayChat` 이 없어 TypeError, `spoke` 없음으로 실패했으나 대상은 값 단언이다. discussion 의 "처음 마운트에는 지난 줄·반전이 없다" 는 옛 messages 출처 때문에 RED 에서 실패 |

Task 3 은 `refactor(02-16)` 한 커밋이다(tdd 아님). REFACTOR 커밋은 따로 없다.

## 커밋

| 커밋 | 내용 |
| --- | --- |
| fa013e5 | test(02-16): 낮 세 단계 장면 DayTable 아랫줄·반전·이모티콘 실패 테스트 (RED) |
| f5ad9d0 | feat(02-16): 낮 세 단계 장면을 DayTable 하나로 (GREEN) |
| 83f3459 | test(02-16): 반전·이모티콘·채팅 줄 이벤트 기반 실패 테스트 (RED) |
| f0b579a | feat(02-16): 이벤트 기반 useSeatFloats·useDayChat, DayView.messages 삭제 (GREEN) |
| affb23b | refactor(02-16): Table 낮 전용 층 제거, SeatFloat·ClaimTag·seat.css 삭제 |

## 검증

- `npx vitest run` 전체 56 파일 1033 테스트 통과 (Task 3 직후), `npm run typecheck`·`npm run build` 통과.
- 인수 기준: `<DayTable` 1 (기준선 0), `<Table `·ClaimTag·`kind: "reveal"` 비주석 0, `max-width: 389px` 1, `mf-dt__claim--done` 테스트 5, `useDayChat` 내보내기 1, `SPOKE_MS = 3_000` 1, 비주석 `day?.messages` 0, DayView 의 messages 0, 세 파일 삭제됨, SeatFloat/ClaimTag/seat.css import 0, Table 의 `clamp(` 0, 옛 클래스(mf-bubble·mf-done·mf-tag__claim·mf-float) 비주석 0, Lobby·Assigning·lobby.css·seatLayout 은 BASE 와 동일.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] phaseScreens 테스트를 DayTable 클래스에 맞춤**
- **Found during:** Task 1 GREEN
- **Issue:** 계획의 verify 명령에 든 `test/client/phaseScreens.test.tsx` 가 옛 `.mf-seat`·`.mf-table` 과 `mf-seat__ring--mate` 마크업 제거 정규식을 쓰고 있어 DayTable 로 바꾸자 네 개가 실패했다(파일 목록에는 없음).
- **Fix:** `.mf-dt__seat`·`.mf-dt` 로 바꾸고 동료 링·마름모 제거 정규식을 `mf-dt__ring--mate`·`mf-dt__mark` 에 맞췄다. 검사 의도(세 단계 같은 테이블 노드, 마피아/시민 화면 차이는 동료 표시뿐)는 그대로다.
- **Files modified:** test/client/phaseScreens.test.tsx
- **Commit:** f5ad9d0

**2. [Rule 1 - Bug] RED 보고서가 TAP 으로 읽히지 않아 단언 방식 변경**
- **Found during:** Task 1 RED
- **Issue:** 배열 `toEqual`·DOM 노드 `toBeNull` 이 실패 때 여러 줄 보고서를 만들어 `tdd-red-evidence` 가 `INVALID_RED(invalid_record)` 를 냈다.
- **Fix:** 한 줄 문자열(`0101`, `경찰|-|마피아|시민`)·개수 단언으로 바꿨다. 검사 내용은 같다.
- **Files modified:** test/client/dayScene.test.tsx, test/client/discussion.test.tsx
- **Commit:** fa013e5 (RED 커밋 이전에 고침)

**3. [Rule 1 - Bug] 임시 테스트의 반전 개수 단언 제거**
- **Found during:** Task 1 GREEN
- **Issue:** Task 1 시점 출처가 아직 view.messages 라 두 줄(자리 0·2)이 모두 반전돼 `--spoke` 개수 1 단언이 틀렸다(옛 출처의 3초 안 줄 복원 때문). Task 2 가 이 테스트를 이벤트 기반으로 다시 썼다.
- **Files modified:** test/client/discussion.test.tsx
- **Commit:** f5ad9d0

**4. [Rule 2 - 정리] talk.css 주석이 지워진 seat.css 를 가리켜 문구 수정**
- **Found during:** Task 3
- **Fix:** 주석 한 줄만 바꿨다(스타일 변화 없음).
- **Files modified:** src/styles/talk.css
- **Commit:** affb23b

**Total deviations:** 4 (Rule 3 1건, Rule 1 2건, 정리 1건). **Impact:** 동작·범위 변화 없음.

## Auth gates

없음.

## Known Stubs

없음. 하단 패널(MessageLog 모양·채팅 세 줄·모달)은 계획대로 02-17 범위라 이 계획에서는 지금 모양 그대로다.

## Threat Flags

없음. 새 네트워크 경로나 신뢰 경계 변화 없음. T-02-44(아랫줄이 claimDone 만으로 결정, 2일차 미리 선택돼도 …), T-02-45(허용 키만 복사, 모르는 template·지난 seq 버림, text 필드·HTML 이 그려지지 않음)는 테스트로 고정했다.

## 남은 일·주의 (후속 계획 참고)

- **실기기 확인(backstop, 사람)**: iPhone Safari·Android Chrome 에서 공개 팝·흔들림과 이모티콘 2초·이름표 반전 3초가 모든 폰에서 같은 때 부드럽게 보이는지, 주소창 때문에 장면이 짧을 때 맨 앞 이름표가 하단 패널 위에 남는지. 자동 테스트는 happy-dom 의 가짜 ResizeObserver 로 높이 배선(폭 352·높이 300 → 면 top 117px)만 확인했고, `.mf-dt { height: 100% }` 가 flex 1 장면 상자 높이로 풀리는 실제 레이아웃은 브라우저에서만 확인된다.
- **02-17**: 하단 패널(높이 157·칩 한 줄·채팅 세 줄·채팅 내역 모달·[빠른 메시지][이모티콘] 한 줄)이 이어서 `useDayChat` 의 줄을 쓴다.
- **02-18**: `scripts/smoke.mjs`·`uat-day.mjs` 는 아직 extend·skip 을 보내므로 02-18 전에 돌리지 않는다. 배포와 `git push` 는 02-18.
- push: HANDOFF 갱신 커밋(b2412bc) 뒤 `git push` 성공 (SSH 원격, e4dc0ec..b2412bc → main). 배포는 하지 않았다(02-18).

## Self-Check: PASSED

- 파일: `src/screens/DayScene.tsx`, `src/net/seatFloats.ts`, `src/components/Table.tsx`, `src/styles/day.css`, 테스트 5개 존재 확인. `SeatFloat.tsx`·`ClaimTag.tsx`·`seat.css` 없음 확인.
- 커밋: fa013e5, f5ad9d0, 83f3459, f0b579a, affb23b 모두 HEAD 의 조상임을 확인.
