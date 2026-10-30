---
phase: quick-261029-vvd
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - shared/protocol.ts
  - shared/schemas.ts
  - shared/game/vote.ts
  - shared/game/view.ts
  - worker/room.ts
  - src/game/blankTap.ts
  - src/game/verdict.ts
  - src/components/CandidateVotePanel.tsx
  - src/screens/verdictScene.tsx
  - src/screens/DayScene.tsx
  - test/unit/vote.test.ts
  - test/unit/schemas.test.ts
  - test/unit/verdict.test.ts
  - test/unit/e2eContract.test.ts
  - test/worker/vote.test.ts
  - test/worker/leak.test.ts
  - test/client/candidateVote.test.tsx
  - test/client/blankTap.test.ts
  - test/client/guide.test.tsx
  - scripts/uat-vote.mjs
  - scripts/e2e/lib.mjs
  - scripts/e2e/lib.test.mjs
  - scripts/e2e/browser.mjs
  - scripts/e2e/flows.mjs
  - docs/decisions/0040-candidate-vote-cancel.md
  - docs/decisions/0036-execution-vote-wire.md
  - docs/product.md
  - .planning/phases/04-execution-verdict/04-CONTEXT.md
  - .planning/phases/04-execution-verdict/04-UI-SPEC.md
  - .planning/phases/05-atmosphere-character/05-UI-SPEC.md
  - .planning/quick/261029-vvd-candidate-vote-cancel/261029-vvd-PROGRESS.md
  - .planning/quick/261029-vvd-candidate-vote-cancel/261029-vvd-SUMMARY.md
  - HANDOFF.md
autonomous: true
requirements: [QUICK-261029-vvd, VOTE-02]

estimate:
  tokens: 320000
  raw_tokens: 320000
  tasks: 4
  confidence: low

must_haves:
  truths:
    - "후보 선택(candidateVote)에서 살아 있는 투표자가 한 명을 고른 뒤 장면의 빈 곳(사람의 캐릭터·이름표, 버튼, [테스트] 밖)을 탭하면 선택이 풀린다: 화면은 곧바로 알약 `선택 안 함`·흰 후광 0 이 되고, 서버에 `{ t: \"candidateVote\", target: null }` 이 가며, 서버가 그 사람의 표를 지운 뒤 그 사람에게만 voteTarget 키가 없는 state 를 보낸다 (사용자 결정 1, 결정 0040)"
    - "취소는 다른 사람에게 아무것도 흘리지 않는다: 투표자가 아닌 모든 viewer(생존·관전)의 view 는 고르기 전·고른 뒤·취소 뒤가 같고 그 사이 프레임을 받지 않는다. 서버 저장 상태는 취소 뒤 고르기 전과 같다(키가 남지 않는다) (결정 0036 4항, 결정 0040)"
    - "고른 표가 없는 사람의 취소는 아무 프레임도 만들지 않고(같은 값 재전송과 같음), 단계 밖 취소는 WRONG_PHASE, 탈락자·방에 없는 사람은 BAD_MESSAGE, target 이 빠졌거나 0..7 정수·null 이 아닌 값·덧붙은 키는 스키마가 BAD_MESSAGE 로 거부한다. 자기 자신 고르기는 여전히 거부된다"
    - "마감 때 고른 사람이 없으면 무효표다: 공개 표(cand.votes)에 그 사람 줄이 없고, 공개 단계 길이는 실제로 던진 표 수로 줄어든다(결정 0039 candidateRevealMs). 아무도 안 남으면 0표 2초 공개 뒤 처형 없이 밤(noExecution reason noVotes). 새 '투표 안 함' 버튼은 없다 (사용자 결정 2, D-04)"
    - "헤더, 하단 패널, [테스트] 버튼과 그 시트, 캐릭터·이름표(이름표는 pointer-events none 이라 좌표로 판정, 여유 8px), 내 자리·탈락 자리를 탭하면 취소되지 않는다. 다른 사람을 탭하면 다시 고른다(기존), 같은 자리 재탭은 무시(기존). 처형 여부 투표·변론 등 다른 단계, 관전자(탈락 viewer), 연결이 끊겨 보낼 수 없는 상태에서는 빈 곳 탭이 아무 일도 하지 않는다 (사용자 결정 4)"
    - "후보 선택 하단 패널의 안내 줄(제목 아래 14px 회색 한 줄)은 고르기 전 `아무도 고르지 않으면 무효표가 돼요`, 고른 뒤 `빈 곳을 누르면 선택이 취소돼요` 이고 네 역할이 같은 글자를 본다. 안내 요소 [data-guide] 는 화면에 하나(제목)다. 360폭에서 한 줄, 글자 크기·색·후광 규칙은 그대로이고 관전자 문구도 그대로다 (사용자 결정 3)"
    - "서버와 화면은 `npm run deploy` 한 번으로 함께 개인 Cloudflare 계정(dhkim1522@naver.com) Worker minifia 에 배포되고, 배포본에서 Cache-Control·smoke 5·8·4명·uat-vote(취소 경우 포함)·uat-test-bots·uat-test-room·uat-day·uat-night·전체 E2E 를 차례로 확인한다. smoke 8명은 단독 재실행 한 번까지 모든 시도를 적고 한도는 바꾸지 않는다. 실기기 ⑮ 를 더하고 어떤 실기기 항목도 통과 표시하지 않는다"
  artifacts:
    - path: "shared/schemas.ts"
      provides: "candidateVote 의 target 이 0..7 정수 또는 null (strictObject)"
      contains: "max(7).nullable()"
    - path: "shared/protocol.ts"
      provides: "ClientMessage candidateVote target: number | null (null = 취소)"
      contains: "target: number | null"
    - path: "shared/game/vote.ts"
      provides: "castCandidateVote 의 취소: 고른 표가 있으면 키를 지우고, 없으면 입력 그대로"
      contains: "target: number | null"
    - path: "worker/room.ts"
      provides: "취소도 같은 처리기, 받아들여지면 투표자 본인에게만 state"
      contains: "target: number | null"
    - path: "src/game/blankTap.ts"
      provides: "빈 곳 탭 판정 isBlankSceneTap 과 사람 상자 여유 BLANK_TAP_SLOP_PX"
      contains: "export function isBlankSceneTap"
    - path: "src/game/verdict.ts"
      provides: "안내 줄 두 문장(무효표·취소)의 단일 출처 VERDICT_TEXT"
      contains: "아무도 고르지 않으면 무효표가 돼요"
    - path: "src/screens/DayScene.tsx"
      provides: "장면 상자(.mf-dayscene__scene) 탭 → 빈 곳이면 verdict.onBlankTap"
      contains: "onBlankTap"
    - path: "docs/decisions/0040-candidate-vote-cancel.md"
      provides: "취소 와이어·규칙표·화면 판정·문구·한계·개정 대상"
      contains: "number | null"
    - path: "scripts/e2e/lib.mjs"
      provides: "CANDIDATE_GUIDE 사본, blankPointsOf, candidateGuideChecks(P11), cancelTapChecks(P12)"
      contains: "export function blankPointsOf"
    - path: "HANDOFF.md"
      provides: "배포 상태, 실기기 ⑮, 6KB 이하"
      contains: "⑮"
  key_links:
    - from: "src/screens/DayScene.tsx .mf-dayscene__scene onClick"
      to: "src/screens/verdictScene.tsx onBlankTap → connection.send({ t: candidateVote, target: null })"
      via: "isBlankSceneTap(e.target, 좌표, e.currentTarget) 가 참일 때만"
      pattern: "isBlankSceneTap"
    - from: "worker/room.ts handleCandidateVote"
      to: "shared/game/vote.ts castCandidateVote"
      via: "applyCandidateVote → 받아들여지면 storage.put + sendViewTo([playerId]), 입력 그대로면 무전송"
      pattern: "sendViewTo\\(\\[playerId\\]\\)"
    - from: "shared/game/vote.ts tallyCandidateVote"
      to: "shared/game/phases.ts candidateRevealMs"
      via: "취소한 사람은 candidateVote 키가 없어 줄이 없다 → 공개 표 수·공개 길이에서 빠진다(무효표)"
      pattern: "candidateVote === undefined"
    - from: "src/components/CandidateVotePanel.tsx"
      to: "src/game/verdict.ts VERDICT_TEXT.candidateGuideNone / candidateGuidePicked"
      via: "NightPanel 의 guide 칸(제목 아래 p.mf-claimpanel__guide)"
      pattern: "candidateGuide"
    - from: "scripts/e2e/lib.mjs CANDIDATE_GUIDE · BLANK_TAP_E2E_MARGIN"
      to: "src/game/verdict.ts · src/game/blankTap.ts"
      via: "test/unit/e2eContract.test.ts 동일성·크기 대조"
      pattern: "CANDIDATE_GUIDE"
    - from: "npm run deploy"
      to: "https://minifia.dhplay.workers.dev /api/health"
      via: "vite build + wrangler deploy 한 번(Worker·DO + 정적 에셋)"
      pattern: "version"
---

<objective>
배포본 실플레이(2026-10-29) 뒤 사용자가 정한 후보 선택 투표 UX 개선을 서버와 화면에 함께 넣고 한 번에 다시 배포한다.

1. 고른 뒤 사람이 아닌 빈 곳을 탭하면 선택이 풀린다. 와이어 `candidateVote` 의 `target` 을 `number | null` 로 넓히고(null = 취소), 서버가 그 사람의 표를 지운 뒤 그 사람에게만 알린다.
2. 새 "투표 안 함" 버튼은 없다. 마감 때 고른 사람이 없으면 기존 무효표 규칙(D-04)대로 세지 않고, 공개 길이(결정 0039)도 실제 표 수로 줄어든다.
3. 하단 패널 안내 줄: 고르기 전 `아무도 고르지 않으면 무효표가 돼요`, 고른 뒤 `빈 곳을 누르면 선택이 취소돼요`.
4. 빈 곳 판정은 헤더·하단 패널·버튼·[테스트]·사람(캐릭터·이름표)을 빼고, 후보 선택 단계의 살아 있는 viewer 에게만 켠다.
5. 처형 여부 투표(찬성/반대)는 이번 범위가 아니다.

Purpose: 참여 플레이어의 몰입(결정 0006). 실수로 고른 표를 되돌릴 수 있고, 아무도 안 고르면 어떻게 되는지 화면이 먼저 알려 준다.
Output: 취소 와이어·규칙(shared·worker), 빈 곳 탭·안내 문장(화면), 누출·UAT·E2E 확장, 결정 0040 과 개정 표기, 배포와 배포본 검증, HANDOFF.

문구 결정(Claude 재량, 이 계획이 정한 값을 그대로 쓴다):

| 상태 | 안내 줄(14px, `p.mf-claimpanel__guide`) | 폭(360폭 패널 안 328px, 한글 14px 기준 대략) |
|---|---|---|
| 고르기 전 | `아무도 고르지 않으면 무효표가 돼요` (사용자 지정) | 한글 15자 + 띄어쓰기 4 ≈ 226px |
| 고른 뒤 | `빈 곳을 누르면 선택이 취소돼요` | 한글 13자 + 띄어쓰기 4 ≈ 198px |
| 관전자 | 기존 관전 안내 그대로 | — |

- 고른 뒤 문장에 "다른 사람을 누르면 바뀌어요" 까지 넣으면 약 326px 로 360폭 한 줄 한계에 붙는다. 다시 고르기는 후광이 따라 움직여 보이므로 취소만 적는다.
- 기존 안내 문장(04-UI-SPEC §7.2 candidateVote 안내 행)은 빠진다. 자기 자리는 버튼이 아니라 눌리지 않고(서버도 거부), 한 줄 칸에 무효표·취소 안내가 먼저다. 결정 0040 에 이유를 적는다.
- 같은 자리 재탭은 지금처럼 무시한다(취소 아님). 사용자는 빈 곳 탭만 정했고, 연타 실수로 취소되는 것을 막는다. 바꿀 수 있는 기본값으로 결정 0040 에 적는다.
- 고른 표 없는 취소는 무전송(같은 값 재전송과 같은 규칙, 사용자 지시).
- 사람 상자 여유 8px: 캐릭터·이름표 상자를 8px 넓힌 범위 안의 탭은 사람 탭으로 보고 취소하지 않는다.
</objective>

<execution_context>
@~/.claude-personal/gsd-core/workflows/execute-plan.md
@~/.claude-personal/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@HANDOFF.md
@docs/decisions/0034-execution-vote-flow.md
@docs/decisions/0036-execution-vote-wire.md
@docs/decisions/0037-execution-screens.md
@docs/decisions/0039-playtest-pacing.md
@.planning/quick/261029-t40-3-40-3-13-2/261029-t40-PLAN.md
@.planning/quick/261029-t40-3-40-3-13-2/261029-t40-SUMMARY.md
@.planning/phases/04-execution-verdict/04-CONTEXT.md
@shared/game/vote.ts
@src/screens/verdictScene.tsx

## 참고 자료 (design-refs)

새 참고 이미지·에셋은 없다. 기존 승인본의 하단 패널 문법(제목 24 + 회색 안내 한 줄 14)을 그대로 쓰고 새 장식·색·글자 크기·에셋을 만들지 않는다. 시안은 만들지 않는다(문구·동작 변경이고 사용자가 값을 정했다).

| 경로 | 가져온 요소 |
| --- | --- |
| `design/screens/07_B7_Vote.png` (S-09·S-11) | 하단 패널 = 제목(24) + 회색 안내 한 줄(14). S-11 의 `시간 안에 고르지 않으면 기권이에요` 처럼 "안 고르면 어떻게 되는지" 를 안내 한 줄에 쓰는 선례. S-09 의 [기권] 버튼은 쓰지 않는다(D-04, 사용자 결정 2) |
| `.planning/phases/04-execution-verdict/04-UI-SPEC.md` §7.2·§8.2 | 후보 선택 문구 정본·좌석 규칙(나·탈락자는 버튼 아님, 흰 후광 하나, 같은 자리 재탭 무시) — 안내 행만 결정 0040 으로 개정 |
| `docs/decisions/0030-visual-bundle.md` | 후광 한 화면 최대 3, 발밑 링·배지 금지 — 그대로 |

## 출처 대조 (Multi-Source Coverage)

| 출처 | 항목 | 담당 |
|---|---|---|
| GOAL | 1 빈 곳 탭 취소 · 와이어 null · 투표자에게만 | Task 1(끝-끝 한 경로), Task 2(판정 확장), Task 3(누출·UAT·E2E), Task 4(배포본) |
| GOAL | 1 같은 값처럼 무해한 무전송 · WRONG_PHASE · 자기 자신 거부 유지 · 다른 viewer 프레임 동일 | Task 1(unit·worker), Task 3(leak 한 판) |
| GOAL | 2 새 버튼 없음 · 마감 때 무효표 · 공개 길이 축소 | Task 1(tick 결과 테스트), Task 3(uat-vote 7000ms), Task 2(결정 0040) |
| GOAL | 3 안내 문장 · data-guide 하나 · 네 역할 같은 글자 · 360폭 한 줄 · 14px | Task 2(화면·guide 테스트), Task 3(E2E P11 네 크기) |
| GOAL | 4 오작동 방지(패널·헤더·[테스트]·이름표) · 단계·관전·연결 가드 | Task 1(closest 판정), Task 2(좌표 여유·가드 테스트), Task 3(E2E P12) |
| GOAL | 5 여부 투표 범위 밖 | 모든 Task(execVote 경로를 건드리지 않음, Task 2 가드 테스트) |
| CONTEXT | 결정 0040 · 0036 표 개정 · D-04 · 04/05-UI-SPEC · product | Task 2 |
| CONTEXT | 서버+화면 한 번 배포 · 개인 계정 · 순차 배포본 검증 · smoke 8 시도표 · HANDOFF ⑮ · 실기기 미통과 | Task 4 |
| RESEARCH | 없음(이 작업은 리서치 단계가 없다) | — |

## 이미 확인한 사실 (다시 찾지 않아도 된다)

- `castCandidateVote` 검사 순서: 단계 → 행위자(방에 있고 생존) → 대상(정수·앉은 생존자) → 자기 자신 → 같은 값이면 입력 그대로. 처리기 `applyCandidateVote` 는 입력 그대로면 저장·전송을 하지 않고, 받아들이면 `storage.put` 뒤 `sendViewTo([playerId])` 로 투표자에게만 보낸다(A7). 거부는 `sendRejection`(보낸 소켓에 error + 최신 state).
- 집계 `tallyCandidateVote` 는 `p.candidateVote === undefined` 인 사람을 건너뛴다. 공개 길이는 `phaseDurationOf`(그날 `cand.votes` 길이로 `candidateRevealMs`)다. 취소가 키를 지우기만 하면 무효표·공개 길이 축소는 저절로 맞는다.
- `buildView` 는 `candidateVote` 단계·생존한 본인·`me.candidateVote !== undefined` 일 때만 `me.voteTarget` 을 싣는다. 키를 지우면 voteTarget 이 사라진다.
- `test/unit/vote.test.ts` 의 "대상이 정수가 아니거나…" 테스트는 지금 `null` 을 BAD_MESSAGE 기대에 넣고 있다. null 은 이제 취소이므로 그 목록에서 빼야 한다(의도한 기대 변경, SUMMARY 에 적는다). `undefined` 는 여전히 BAD_MESSAGE 다.
- 하단 패널의 `[data-guide]` 는 `NightPanel` 의 제목 `h2` 에 있다(`처형할 사람을 고르세요`). 안내 줄 `p.mf-claimpanel__guide` 에는 data-guide 가 없다. 새 문장은 이 안내 줄(= `NightPanel` 의 `guide` prop)에 들어가므로 data-guide 수와 guide.test 의 제목 기대가 그대로다.
- 장면 상자 `.mf-dayscene__scene` 안에는 `[테스트]` 앵커(`.mf-tt-anchor`), `DayTable`(`.mf-dt` 루트, 테이블 면 `.mf-dt__felt`, 좌석 `.mf-dt__seat[data-seat]` — 고를 수 있으면 button, 나·탈락자는 div role=group — 이름표 `.mf-dt__tag[data-seat]`)가 있다. 헤더(PhaseBar)·하단 패널·시트(dialog, RoomScreen 이 그림)는 장면 상자 밖이다. 이름표는 `pointer-events: none` 이라 이름표를 탭하면 이벤트 대상이 그 아래 요소(`.mf-dt` 루트·테이블 면 등)가 된다 — 그래서 좌표 판정이 필요하다. 비네팅·아침 빛 층은 pointer-events none 이다.
- React 는 disabled 버튼의 클릭을 부모로도 전달하지 않는다. happy-dom 의 `getBoundingClientRect` 는 0 상자를 돌려준다 — 판정은 너비·높이가 0 인 상자를 건너뛰어야 테스트와 숨은 요소에서 오판하지 않는다.
- E2E vote5 는 테스트 방(방장 시민 + 봇 4, 봇 후보 선택 "other")에서 네 크기 모바일(hasTouch) 문맥으로 돈다. `skipTo` 는 [테스트] 버튼으로 시트를 열어 단계를 넘긴다. 후보 선택은 서버 타이머 15초가 실제로 흐르므로 새 검사는 짧게(약 3초) 넣는다.
- 이전 같은 종류의 작업(261029-t40)에서 배포본 smoke 8명이 이 PC 네트워크로 2회 실패했다(도착 편차 665ms, say error 지연). 한도 500ms 는 바꾸지 않는다.
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1 (tracer): 끝-끝 "선택 취소" 한 경로 — 빈 곳 탭 → target null → 서버가 표를 지우고 투표자에게만 state, 무효표 결과까지</name>
  <files>shared/protocol.ts, shared/schemas.ts, shared/game/vote.ts, shared/game/view.ts, worker/room.ts, src/game/blankTap.ts, src/screens/verdictScene.tsx, src/screens/DayScene.tsx, test/unit/vote.test.ts, test/unit/schemas.test.ts, test/worker/vote.test.ts, test/client/candidateVote.test.tsx, .planning/quick/261029-vvd-candidate-vote-cancel/261029-vvd-PROGRESS.md</files>
  <read_first>shared/protocol.ts (225~265행 ClientMessage·MyInfo), shared/schemas.ts (11~45행), shared/game/vote.ts (78~150행: enterExecVote 의 키째 지우기, castCandidateVote, tallyCandidateVote), shared/game/view.ts (1~10·175~185행), worker/room.ts (210~220·463~485·510~525행), src/net/useViewChoice.ts, src/screens/verdictScene.tsx (43~91·100~226행), src/screens/DayScene.tsx (252~279행), test/unit/vote.test.ts (1~110·240~275·334~430·429~502행), test/worker/vote.test.ts (1~60·186~262행), test/worker/helpers.ts (settle·mark·storedRoom·closePhase·advanceTo·actorsOf), test/client/candidateVote.test.tsx (79~260행), docs/decisions/0036-execution-vote-wire.md (4항·12항)</read_first>
  <behavior>
    - 단위(castCandidateVote): A 가 B 를 고른 상태에서 target null → ok, A 의 candidateVote 키가 없고(Object.hasOwn false) 나머지 플레이어·phaseEndsAt·phase 는 그대로, 결과 상태가 고르기 전 상태와 toEqual. 입력을 깊게 얼려도 예외 없음
    - 단위: 고른 표 없는 null 은 입력 상태 그대로(toBe). 고르기 → 취소 → 다시 고르기 → 취소 반복이 마감까지 된다(마지막 상태만 남음)
    - 단위: candidateVote 가 아닌 단계(discussion·execVote·candidateVoteReveal, 탈락자 포함)의 null 은 WRONG_PHASE, 방에 없는·탈락한 행위자의 null 은 BAD_MESSAGE. 자기 자신 고르기는 그대로 BAD_MESSAGE. 기존 "정수가 아닌 대상" 목록에서 null 을 빼고 undefined 는 남긴다
    - 단위(뷰 익명): 4~8명 × 시드 1~3 에서 S0(안 고름)·S1(A→B)·S2(A 취소) 의 buildView — A 가 아닌 모든 viewer(생존·탈락) view 의 JSON 이 세 상태에서 같고, A 는 S1 에만 voteTarget B 가 있으며 S2 의 A view 는 S0 의 A view 와 같다
    - 단위(결과): X→T·Y→T·A→U 뒤 A 취소, 마감 tick → candidateVoteReveal 의 그날 cand.votes 길이 2·A 줄 없음·candidate T·phaseEndsAt = 마감 + candidateRevealMs(2). A 만 던졌다 취소하면 votes []·candidate 없음·phaseEndsAt = 마감 + candidateRevealMs(0), 그 마감 tick 뒤 night 의 view day.noExecution = { reason: "noVotes" }. 취소 뒤 다시 고른 표는 새 값으로 센다
    - 단위(스키마, test/unit/schemas.test.ts 새 파일): ClientMessageSchema 가 candidateVote target null·0·7 을 받고, target 빠짐·8·-1·1.5·"1"·true·덧붙은 키(target null + seat)를 거부한다. pick 의 target null 은 여전히 거부(nullable 이 다른 메시지로 번지지 않음)
    - 워커: 6명 candidateVote 에서 A 가 B 를 고른 뒤 null → A 소켓만 `[state:candidateVote]`(me 에 voteTarget 키 없음), 나머지 다섯 `[]`, 저장된 A 에 candidateVote 키 없음. 같은 null 한 번 더 → 여섯 모두 `[]`. 안 고른 C 의 null → 여섯 모두 `[]`. execVote 단계의 null → 보낸 소켓 `[error:WRONG_PHASE,state:execVote]`, 나머지 `[]`. `{ t: "candidateVote" }`·`{ t: "candidateVote", target: null, seat: 1 }` → 보낸 소켓 `[error:BAD_MESSAGE]`, 나머지 `[]`
    - 워커(결과): A 가 고른 뒤 취소하고 아무도 안 던진 채 마감 → 여섯 소켓 모두 candidateVoteReveal 의 그날 cand.votes 가 [], phaseDurationMs = candidateRevealMs(0), day.candidate 없음 → 다음 night 에서 모두 day.noExecution.reason "noVotes"
    - 화면(RoomScreen 경로): 민지를 고른 뒤 테이블 면(.mf-dt__felt)을 클릭하면 send 가 `{ t: "candidateVote", target: null }` 로 한 번 더 불리고, 알약 `선택 안 함`·흰 후광 0·민지 aria-pressed false. 아무도 안 고른 상태의 테이블 면 클릭은 send 없음. 고른 뒤 이름표(.mf-dt__tag[data-seat]) 클릭·내 자리(div) 클릭은 send 없음
  </behavior>
  <action>
시작할 때 `git rev-parse HEAD` 를 `261029-vvd-PROGRESS.md` 첫 줄에 plan_head_before 로 적는다(Task 1~3 의 커밋·시험 수·편차를 이 파일에 이어 적고, Task 4 가 읽는다).

이 Task 는 tracer 다: 취소 한 경로를 화면 탭부터 스키마·처리기·규칙·view 전송·집계 결과까지 한 번에 잇는다. 이 Task 의 끝-끝 확인은 실제 DO 소켓을 쓰는 워커 테스트(스키마 → 처리기 → 규칙 → 투표자 전송 → 마감 결과)와 RoomScreen 클릭 테스트(탭 → send → 화면)이고, 브라우저와 서버를 한 번에 도는 확인은 Task 3 의 로컬 E2E vote5 다. 이 Task 의 빈 곳 판정은 대상 요소(closest)만 본다 — 좌표 여유(이름표 통과)는 구조 변경 없이 Task 2 가 채운다.

RED 먼저(커밋 `test(261029-vvd): 후보 선택 취소(target null) 기대`). behavior 의 단위·스키마·워커·화면 기대를 각 테스트 파일에 넣는다:
1. test/unit/vote.test.ts: 기존 "대상이 정수가 아니거나…" 목록에서 null 하나를 빼고 기대 개수를 7 로(이름에 "null 은 취소(결정 0040)" 를 덧붙인다). 새 describe "castCandidateVote 취소 (결정 0040)" 에 behavior 의 단위·뷰 익명·결과 기대를 넣는다. tick 호출 모양과 마감 연쇄는 같은 파일 240~275행 tick 연쇄 테스트를, 공개 길이는 import 된 candidateRevealMs 를 쓴다(리터럴 2000 을 쓰지 않는다). 상태는 같은 파일의 candidateVoteOf·idOf·withDead·deepFreeze 를 쓴다.
2. test/unit/schemas.test.ts 새 파일: shared/schemas 의 ClientMessageSchema.safeParse 로 behavior 의 스키마 사례(it.each 로 받기·거부 표).
3. test/worker/vote.test.ts: 새 describe "후보 선택 취소 (결정 0040, A7)" — 같은 파일의 atCandidateVote·sendAndSettleAll·lines·summary·storedRoom·startedAtExecVote 와 helpers 의 closePhase·advanceTo 로 behavior 의 워커 사례.
4. test/client/candidateVote.test.tsx: "candidateVote 화면 한 경로" describe 에 behavior 의 화면 세 사례(같은 파일의 renderRoom·makeView·voteBtn·whiteHalos·panel·seatEl 도우미).
`npx vitest run --project unit test/unit/vote.test.ts test/unit/schemas.test.ts`, worker vote, client candidateVote 가 새 기대에서 실패하는 것을 확인하고 커밋한다.

GREEN(커밋 `feat(261029-vvd): 후보 선택 취소 — 빈 곳 탭이 target null 을 보내고 서버가 표를 지운다`):
A. shared/protocol.ts: ClientMessage 의 candidateVote 를 `target: number | null` 로, 줄 주석에 "null = 선택 취소, 고른 표가 있으면 서버가 지우고 본인에게만 알림(결정 0040)". MyInfo.voteTarget 주석 끝에 "취소하면 키가 없다(결정 0040)".
B. shared/schemas.ts: candidateVote 항목의 target 만 `.int().min(0).max(7)` 뒤에 `.nullable()` 을 붙인다(say·pick 의 target 은 그대로). 위 주석에 "null = 취소(결정 0040). 빠진 target·문자열·범위 밖·덧붙은 키는 그대로 거부".
C. shared/game/vote.ts castCandidateVote: 매개변수를 `target: number | null` 로. 순서는 단계(WRONG_PHASE) → 행위자(BAD_MESSAGE) 다음에 target 이 null 이면 — 그 사람의 candidateVote 가 undefined 면 입력 상태 그대로 ok(무전송), 있으면 그 사람의 candidateVote 키를 구조 분해로 지운 새 플레이어(enterExecVote 와 같은 방식)로 바꾼 새 상태 ok. phaseEndsAt 은 건드리지 않는다. null 이 아니면 기존 대상 검사 그대로. JSDoc 규칙 줄에 취소 행을 더하고, tallyCandidateVote 주석에 "취소한 사람은 키가 없어 줄이 없다 = 무효표, 공개 길이에서도 빠진다(결정 0040·0039)" 한 줄.
D. shared/game/view.ts: 머리 주석의 voteTarget 줄에 "취소하면 키가 없다(결정 0040)" 만 더한다(로직 변경 없음).
E. worker/room.ts: handleCandidateVote·applyCandidateVote 의 target 타입을 `number | null` 로. applyCandidateVote 위 주석에 "취소(null)도 같은 길: 받아들이면 투표자 본인에게만 state, 고른 표 없는 취소는 입력 그대로라 저장·전송 없음(결정 0040)". 봇 경로(BotAction 의 number)는 바꾸지 않는다.
F. src/game/blankTap.ts 새 파일(머리 주석: 결정 0040 — 후보 선택에서 장면의 빈 곳 탭 = 선택 취소, 사람·버튼·[테스트] 는 빈 곳이 아니다). export: 빈 곳이 아닌 요소 선택자 상수 BLANK_TAP_EXCLUDE = data-seat 속성 요소, button, a, input, textarea, select, role=button, .mf-tt-anchor 를 쉼표로 이은 선택자 문자열. `isBlankSceneTap(target: EventTarget | null, scene: Element): boolean` — target 이 Element 가 아니거나 scene.contains(target) 가 거짓이면(포털·시트에서 React 로 거슬러 온 이벤트) false, target.closest(BLANK_TAP_EXCLUDE) 가 있으면 false, 아니면 true.
G. src/screens/verdictScene.tsx: VerdictScene 에 `onBlankTap?: () => void` 필드(JSDoc: 후보 선택의 살아 있는 viewer 만. 장면의 빈 곳 탭이면 DayScene 이 부른다, 결정 0040). useViewChoice 를 `number | null` 로 부르고 지금 보일 선택을 `chosen ?? null` 하나(이름 picked)로 읽어 후광·알약·pressed·pressPick 의 기존 undefined 비교를 picked 기준으로 바꾼다. pressPick 은 그대로(같은 자리 재탭 무시). 새 cancelPick: picked 가 null 이거나 connection.canSend 가 거짓이면 아무것도 하지 않고, 아니면 choose(null) 뒤 send({ t: "candidateVote", target: null }). candidateVote 분기는 meAlive 일 때만 onBlankTap 에 cancelPick 을 싣는다.
H. src/screens/DayScene.tsx: `.mf-dayscene__scene` div 에 verdict?.onBlankTap 이 있을 때만 onClick 을 단다 — isBlankSceneTap(e.target, e.currentTarget) 가 참이면 onBlankTap 호출. 주석 한 줄(결정 0040: 헤더·하단 패널·시트는 이 상자 밖이라 대상이 아니다).
마지막에 behavior 를 덮는 네 명령과 `npm run typecheck` 를 돌린다. 다른 테스트가 바뀐 타입 때문에 실패하면 원인을 고친다. 기대를 지우거나 느슨하게 하지 않는다(위 null 목록 변경만 예외이고 SUMMARY 에 적는다).
  </action>
  <reversibility rating="costly">와이어 메시지 모양 변경(결정 0036 결과: 메시지 이름·모양은 비쌈) — 사용자가 2026-10-29 에 이 변경과 재배포를 정했으므로 새 확인 지점은 두지 않는다</reversibility>
  <verify>
    <automated>npx vitest run --project unit test/unit/vote.test.ts test/unit/schemas.test.ts</automated>
    <fails_when>취소 규칙표·뷰 익명·tick 결과(공개 길이 축소·noVotes)·스키마 사례 중 하나라도 실패하거나 파일을 찾지 못한다</fails_when>
    <automated>npx vitest run --project worker test/worker/vote.test.ts</automated>
    <fails_when>취소 응답이 투표자 외 소켓에 가거나, 무전송·WRONG_PHASE·BAD_MESSAGE·0표 결과 사례 또는 기존 후보 선택 사례가 실패한다</fails_when>
    <automated>npx vitest run --project client test/client/candidateVote.test.tsx</automated>
    <fails_when>테이블 면 클릭이 target null 을 보내지 않거나, 이름표·내 자리 클릭·안 고른 상태 클릭이 send 를 부르거나, 기존 후보 선택 화면 사례가 실패한다</fails_when>
    <automated>npm run typecheck</automated>
    <fails_when>tsc(app·worker) 오류 — number | null 을 다루지 못한 호출처가 남아 있다</fails_when>
  </verify>
  <acceptance_criteria>
    - `grep -c 't: "candidateVote"; target: number | null' shared/protocol.ts` >= 1 (HEAD 0)
    - `grep -c 'max(7).nullable()' shared/schemas.ts` >= 1 (HEAD 0), 그리고 `grep -n 'nullable()' shared/schemas.ts` 로 읽은 줄이 testRole 줄과 candidateVote 줄 두 개뿐이다(pick·say 의 target 에 번지지 않음)
    - `grep -c 'target: number | null' shared/game/vote.ts` >= 1, `grep -c 'target: number | null' worker/room.ts` >= 1 (HEAD 0·0), 그리고 `grep -n 'target: number | null' worker/room.ts` 로 handleCandidateVote·applyCandidateVote 두 서명이 모두 바뀐 것을 읽는다
    - `grep -c "export function isBlankSceneTap" src/game/blankTap.ts` >= 1 (새 파일)
    - `grep -c "onBlankTap" src/screens/DayScene.tsx` >= 1, `grep -c "onBlankTap" src/screens/verdictScene.tsx` >= 1 (HEAD 0·0)
    - `test -f test/unit/schemas.test.ts` 이고 `grep -c "target: null" test/worker/vote.test.ts` >= 1 (HEAD 0)
    - `git log --oneline -2` 에 test(261029-vvd) 뒤 feat(261029-vvd) 커밋이 있다
  </acceptance_criteria>
  <done>살아 있는 투표자가 고른 뒤 테이블 면을 탭하면 target null 이 가고, 서버가 그 표를 지워 투표자에게만 알리며, 다른 소켓은 아무것도 받지 않는다. 마감 때 남은 표가 없으면 0표 공개(2초)와 noVotes 밤으로 간다. unit·worker·client 대상 테스트와 typecheck 통과, RED/GREEN 커밋 두 개.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: 화면 확장 — 안내 줄 두 문장(무효표·취소), 이름표를 통과한 탭의 좌표 판정(여유 8px), 단계·관전·연결 가드, 결정 0040 과 개정 표기</name>
  <files>src/game/verdict.ts, src/components/CandidateVotePanel.tsx, src/game/blankTap.ts, src/screens/DayScene.tsx, test/client/blankTap.test.ts, test/client/candidateVote.test.tsx, test/client/guide.test.tsx, test/unit/verdict.test.ts, docs/decisions/0040-candidate-vote-cancel.md, docs/decisions/0036-execution-vote-wire.md, .planning/phases/04-execution-verdict/04-CONTEXT.md, .planning/phases/04-execution-verdict/04-UI-SPEC.md, .planning/phases/05-atmosphere-character/05-UI-SPEC.md, docs/product.md, .planning/quick/261029-vvd-candidate-vote-cancel/261029-vvd-PROGRESS.md</files>
  <read_first>src/game/verdict.ts (404~455행 VERDICT_TEXT), src/components/CandidateVotePanel.tsx, src/components/NightPanel.tsx (NightPanel·PickPill — data-guide 는 제목 h2), src/game/blankTap.ts (Task 1), src/screens/DayScene.tsx (252~279행), src/components/DayTable.tsx (290~420행 좌석·이름표 마크업과 data-seat), src/styles/daytable.css (55행 .mf-dt__tag), src/styles/day.css (10·21·35행), src/screens/RoomScreen.tsx (179~232행 [테스트] 버튼·시트), test/client/candidateVote.test.tsx, test/client/guide.test.tsx (1~80·233~260·310~345행 renderCell), test/unit/verdict.test.ts (550~570행 VERDICT_TEXT 기대), docs/decisions/0039-playtest-pacing.md (형식), docs/decisions/0036-execution-vote-wire.md (4·12항), .planning/phases/04-execution-verdict/04-CONTEXT.md (D-03·D-04), .planning/phases/04-execution-verdict/04-UI-SPEC.md (268~280행 §7.2 candidateVote 표, 366~373행 §8.2), .planning/phases/05-atmosphere-character/05-UI-SPEC.md (197행 candidateVote 행), docs/product.md (60행), design/screens/07_B7_Vote.png</read_first>
  <behavior>
    - VERDICT_TEXT 에 candidateGuideNone = "아무도 고르지 않으면 무효표가 돼요", candidateGuidePicked = "빈 곳을 누르면 선택이 취소돼요". 옛 후보 선택 안내 키는 없다(VERDICT_TEXT 전체 기대 객체가 이 모양)
    - CandidateVotePanel(살아 있는 viewer): pick null → 안내 줄 p.mf-claimpanel__guide = candidateGuideNone, pick 있음 → candidateGuidePicked. 두 경우 모두 제목 `처형할 사람을 고르세요` 와 [data-guide] 정확히 하나. 관전(readOnly)은 기존 관전 제목·안내·관전 줄 그대로
    - guide.test: renderCell("candidateVote", vp) 로 mafia·police·doctor·citizen 네 시점의 하단 안내 줄 글자가 모두 candidateGuideNone 으로 같고, spectator 는 기존 관전 안내다. 모든 칸의 [data-guide] 하나 규칙은 그대로 통과
    - isBlankSceneTap(target, point, scene) (test/client/blankTap.test.ts, 손으로 만든 DOM): 장면 밖 대상·Element 아님 → false. button·[data-seat]·.mf-tt-anchor 안·a·input 대상 → false. 대상이 빈 요소(테이블 면)여도 point 가 어떤 [data-seat] 요소 상자를 BLANK_TAP_SLOP_PX(8) 만큼 넓힌 범위 안(경계 포함)이면 false, 그 밖 1px 이면 true. 너비나 높이가 0 인 [data-seat] 상자는 건너뛴다. BLANK_TAP_SLOP_PX === 8
    - RoomScreen 경로: 하윤(1)의 이름표 getBoundingClientRect 를 {left 100, top 200, width 60, height 20} 으로 흉내 내고 민지를 고른 뒤 .mf-dt 루트를 (110, 205) 로 클릭 → send 없음, (100+60+8, 205) → send 없음, (100+60+9, 205) → target null 전송
    - RoomScreen 경로 가드: 고른 뒤 헤더(위쪽 바 제목)·하단 패널 클릭 → send 없음. 테스트 방 방장 view(isHost true, testMode true)에서 고른 뒤 [테스트] 버튼 클릭과 열린 시트(dialog) 안 클릭 → candidateVote 전송 없음. 관전자(내 자리 탈락)의 테이블 면 클릭 → send 없음. execVote·discussion view 의 테이블 면 클릭 → send 없음. 서버 voteTarget 2 이고 canSend false 면 테이블 면 클릭 → send 없음, 알약 그대로
  </behavior>
  <action>
RED 먼저(커밋 `test(261029-vvd): 안내 줄·빈 곳 좌표 판정·가드 기대`): behavior 를 test/unit/verdict.test.ts(VERDICT_TEXT 기대 객체에서 옛 안내 키를 빼고 두 키를 넣는다), test/client/candidateVote.test.tsx(패널 사례의 옛 안내 문장 기대를 두 새 문장으로 바꾸고, RoomScreen 경로·가드 사례를 더한다. 테스트 방 방장 view 를 위해 makeView 옵션에 isHost·testMode 를 더한다), test/client/guide.test.tsx(새 it 하나), test/client/blankTap.test.ts(새 파일)에 넣고 실패를 확인한 뒤 커밋한다.

GREEN(커밋 `feat(261029-vvd): 무효표·취소 안내 줄과 이름표 여유 판정`):
A. src/game/verdict.ts VERDICT_TEXT 의 candidateVote 구역: 옛 안내 키 한 줄을 지우고 candidateGuideNone·candidateGuidePicked 두 키를 둔다(주석: 결정 0040 — 하단 안내 줄 14px, 360폭 한 줄, 네 역할 같은 글자, 고른 뒤 문장은 빈 곳 탭 취소만 알린다). 문장은 objective 표 그대로이고 src 안에서 이 파일 한 곳에만 둔다.
B. src/components/CandidateVotePanel.tsx: 살아 있는 viewer 의 NightPanel guide 를 pick 이 null 이면 candidateGuideNone, 아니면 candidateGuidePicked 로. 머리 주석에 "안내 줄은 고르기 전 무효표 안내, 고른 뒤 빈 곳 탭 취소 안내(결정 0040). data-guide 는 제목 하나 그대로". 관전 분기는 바꾸지 않는다.
C. src/game/blankTap.ts: `BLANK_TAP_SLOP_PX = 8` export(주석: 캐릭터·이름표 상자를 이만큼 넓힌 범위의 탭은 사람 탭 — 손가락 오차로 사람 근처를 눌러 취소되지 않게, 결정 0040). isBlankSceneTap 의 매개변수를 (target, point: { x: number; y: number }, scene) 로 넓히고, closest 검사 뒤 scene 안의 모든 [data-seat] 요소 상자(getBoundingClientRect)를 돌며 너비·높이 0 은 건너뛰고, point 가 상자를 사방 BLANK_TAP_SLOP_PX 넓힌 범위 안(경계 포함)이면 false. 이름표가 pointer-events none 이라 대상이 그 아래 요소로 오는 경우를 이 좌표 판정이 막는다는 주석 한 줄.
D. src/screens/DayScene.tsx: 호출을 isBlankSceneTap(e.target, { x: e.clientX, y: e.clientY }, e.currentTarget) 로.
E. CSS·글자 크기·색·후광 규칙은 바꾸지 않는다(새 스타일 없음).
F. `npx vitest run --project client` 전체·`npx vitest run --project unit test/unit/verdict.test.ts`·`npm run typecheck && npm run build` 를 돌린다.

문서(커밋 `docs(261029-vvd): 결정 0040 과 개정 표기`):
G. docs/decisions/0040-candidate-vote-cancel.md 새로(0039 형식: 제목 한 줄 요약, `- 상태: 채택`, `- 날짜: 2026-10-29`, `## 배경`, `## 결정`, `## 알려진 한계`, `## 바뀔 수 있는 기본값`, `## 개정하는 것`, `## 결과`). 제목: "0040 후보 선택은 고른 뒤 장면의 빈 곳을 눌러 취소할 수 있고(와이어 target null), 마감 때 고른 사람이 없으면 무효표다". 배경: 배포본 실플레이(2026-10-29) 뒤 사용자 결정 — 한 번 고르면 '안 고름' 으로 돌아갈 길이 없었고 무효표 규칙(D-04)이 화면에 안내되지 않았다. 서버·화면 함께 재배포 승인(결정 0036-15). 결정: (1) 와이어 표 — `{ t: "candidateVote", target: number | null }`, 스키마는 strictObject 에 0..7 정수 또는 null. (2) 규칙표 — 단계 아님 WRONG_PHASE / 방에 없음·탈락 BAD_MESSAGE / 고른 표 있음 → 그 키를 지움, 투표자에게만 state / 고른 표 없음 → 상태 그대로·무전송 / 마감 전까지 취소·다시 고르기 반복 가능 / 마감에 고른 것 없음 → 무효표(세지 않음·분모 아님·0표면 처형 없음, D-04) / 공개 길이는 실제 표 수(결정 0039) / 자기 자신 고르기는 그대로 거부. (3) 받는 사람과 누출 — 투표자 본인 한 명, 다른 viewer 프레임은 고르기 전·고른 뒤·취소 뒤 같음, 저장 상태는 취소 뒤 고르기 전과 같음(검사: test/unit/vote.test.ts·test/worker/vote.test.ts·test/worker/leak.test.ts). (4) 화면 — 빈 곳 정의(장면 상자 안, `[data-seat]` 사람 상자를 8px 넓힌 범위 밖, 버튼·[테스트] 밖; 헤더·하단 패널·시트는 대상 아님), 후보 선택의 살아 있는 viewer 만, 보낼 수 없을 때(canSend 거짓) 무시, 같은 자리 재탭은 그대로 무시, 다른 사람 탭은 다시 고르기. 판정 한 곳 src/game/blankTap.ts. (5) 문구 — objective 의 문구 결정 표와 폭 계산, 빠진 옛 안내 문장(04-UI-SPEC §7.2 의 candidateVote 안내 행을 그대로 옮겨 적는다)과 뺀 이유, data-guide 는 제목 하나 그대로, 관전자 문구 그대로. (6) 새 "투표 안 함"·기권 버튼은 없다. 알려진 한계: 키보드·화면 읽기 사용자는 빈 곳 탭으로 취소할 수 없다(다른 사람으로 다시 고르기는 된다), 사람 상자 근처 8px 안은 취소되지 않는다, 낙관적 선택이 서버에 닿기 전 취소하면 잠깐 고른 값이 다시 보였다가 취소 상태가 된다(서버 처리 순서대로). 바뀔 수 있는 기본값: 같은 자리 재탭 무시(verdictScene.tsx 의 pressPick), 여유 8px(src/game/blankTap.ts 의 BLANK_TAP_SLOP_PX), 두 문장(src/game/verdict.ts VERDICT_TEXT), 고른 표 없는 취소 무전송(shared/game/vote.ts). 개정하는 것: 결정 0036 4항·12항 표, 04-CONTEXT D-04, 04-UI-SPEC §7.2·§8.2, 05-UI-SPEC §8 표 candidateVote 행, docs/product.md 후보 선택 행. 결과: 와이어 모양 변경이라 비싼 변경(costly) — 서버·화면 한 배포. 열린 방의 옛 번들(최대 3시간)은 null 을 보내지 않아 취소만 없을 뿐 무해하다. 배포 전환 중 새 화면이 옛 서버에 null 을 보내면 BAD_MESSAGE 토스트(`보내지 못했어요…`)가 뜨고 선택은 남는다(무해). E2E 는 vote5 의 P11(안내 줄 문장·한 줄)·P12(이름표 탭 유지·빈 곳 탭 취소·[테스트] 시트로 넘겨도 내 표 유지), UAT 는 uat-vote 2판의 취소 경우가 지킨다. 실기기 확인 ⑮.
H. 개정 표기(한 줄씩 덧붙임, 본문은 지우지 않는다, 0039 의 "(→ 결정 0039: …)" 방식): docs/decisions/0036 4항 끝에 "(→ 결정 0040: target 은 number | null 이고 null 은 취소다. 고른 표가 있으면 지우고 투표자에게만 state, 없으면 무전송)", 12항 표의 me.voteTarget 행 받는 사람 칸 끝에 "(취소하면 키 없음, 결정 0040)". 04-CONTEXT D-04 끝에 "(→ 결정 0040: 후보 선택은 고른 뒤 장면의 빈 곳을 눌러 취소할 수 있고 마감 때 고른 사람이 없으면 같은 무효표다. 기권 버튼은 여전히 없다)". D-03 은 취소를 막는 문장이 없어 고치지 않는다. 04-UI-SPEC §7.2 candidateVote 표의 안내 행 끝에 "(→ 결정 0040: 고르기 전·고른 뒤 두 문장으로 개정)", §8.2 같은 자리 재탭 줄 끝에 "(→ 결정 0040: 장면의 빈 곳 탭은 선택 취소. 같은 자리 재탭은 그대로 무시)". 05-UI-SPEC §8 표 candidateVote 행 끝 칸에 "(→ 결정 0040: 안내 줄 개정)". docs/product.md 후보 선택 투표 행 내용 끝에 "고른 뒤 빈 곳을 누르면 취소되고, 마감 때 고른 사람이 없으면 무효표다(결정 0040)".
진행 메모(커밋·시험 수·편차)를 PROGRESS 에 더한다.
  </action>
  <verify>
    <automated>npx vitest run --project client</automated>
    <fails_when>client 프로젝트(candidateVote·blankTap·guide·verdictStates·phaseScreens 포함)에 실패가 하나라도 있다</fails_when>
    <automated>npx vitest run --project unit test/unit/verdict.test.ts</automated>
    <fails_when>VERDICT_TEXT 기대 객체(두 새 키, 옛 안내 키 없음)가 다르다</fails_when>
    <automated>npm run typecheck && npm run build</automated>
    <fails_when>tsc 오류(지운 옛 안내 키를 참조하는 곳 포함)나 vite 빌드 실패</fails_when>
  </verify>
  <acceptance_criteria>
    - `grep -c "아무도 고르지 않으면 무효표가 돼요" src/game/verdict.ts` >= 1 (HEAD 0), 그리고 `grep -rln "아무도 고르지 않으면 무효표가 돼요" src` 의 출력이 `src/game/verdict.ts` 한 줄뿐이다(문장 출처 한 곳)
    - `grep -rln "빈 곳을 누르면 선택이 취소돼요" src` 의 출력이 `src/game/verdict.ts` 한 줄뿐이다 (HEAD 출력 없음)
    - `grep -rn "candidateHint" src test | wc -l` == 0 (HEAD 3)
    - `grep -cE 'BLANK_TAP_SLOP_PX[ ]*=[ ]*8;' src/game/blankTap.ts` >= 1, `grep -c "clientX" src/screens/DayScene.tsx` >= 1 (HEAD 없음·0)
    - `git log --oneline --grep=261029-vvd -- src/styles` 가 종료 코드 0 으로 끝나고 출력이 비어 있다(이 작업은 스타일 파일을 바꾸지 않는다)
    - `test -f docs/decisions/0040-candidate-vote-cancel.md` 이고 `grep -c "number | null" docs/decisions/0040-candidate-vote-cancel.md` >= 1
    - `grep -c "0040" docs/decisions/0036-execution-vote-wire.md` >= 1(`grep -n` 으로 4항·12항 두 곳을 읽는다), `grep -c "0040" .planning/phases/04-execution-verdict/04-CONTEXT.md` >= 1, `grep -c "0040" .planning/phases/04-execution-verdict/04-UI-SPEC.md` >= 1(`grep -n` 으로 §7.2·§8.2 두 곳을 읽는다), `grep -c "0040" .planning/phases/05-atmosphere-character/05-UI-SPEC.md` >= 1, `grep -c "0040" docs/product.md` >= 1 (HEAD 모두 0)
    - test(261029-vvd)·feat(261029-vvd)·docs(261029-vvd) 커밋이 Task 1 커밋 뒤에 하나씩 있다
  </acceptance_criteria>
  <done>안내 줄이 고르기 전 무효표 안내, 고른 뒤 취소 안내로 바뀌고 네 역할이 같은 글자를 본다(data-guide 하나 그대로). 이름표를 통과한 탭·사람 근처 8px·헤더·패널·[테스트]·시트·다른 단계·관전·연결 끊김에서는 취소되지 않는다. 결정 0040 과 개정 표기가 코드와 같은 내용이다. client 전체·verdict unit·typecheck·build 통과.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: 검증 확장 — 누출 한 판에 취소, uat-vote 취소 경우, E2E vote5 안내 줄·이름표 탭·빈 곳 탭(네 크기), 그리고 로컬 게이트</name>
  <files>test/worker/leak.test.ts, scripts/uat-vote.mjs, scripts/e2e/lib.mjs, scripts/e2e/lib.test.mjs, scripts/e2e/browser.mjs, scripts/e2e/flows.mjs, test/unit/e2eContract.test.ts, .planning/quick/261029-vvd-candidate-vote-cancel/261029-vvd-PROGRESS.md</files>
  <read_first>test/worker/leak.test.ts (472~560·625~700행 castCandidates·프레임 검사·seen), scripts/uat-vote.mjs (1~60·80~100행 frames·states·requestError, 215~230행 castCandidateVote, 380~415행 2판 후보 선택·공개), scripts/e2e/lib.mjs (1~40행 계약 주석, 286~320행 isOneLine, 1095~1140행 candidateChecks), scripts/e2e/lib.test.mjs (1640~1690행 goodCand 사례 형식), scripts/e2e/browser.mjs (300~330·895~955·1033~1075·1289~1312행), scripts/e2e/flows.mjs (1~30행 import, 871~1010행 vote5 cand-vote·reveal 블록), test/unit/e2eContract.test.ts, src/game/blankTap.ts, src/game/verdict.ts (VERDICT_TEXT 후보 선택 구역)</read_first>
  <behavior>
    - lib CANDIDATE_GUIDE = Object.freeze({ none, picked }) 가 VERDICT_TEXT.candidateGuideNone·candidateGuidePicked 와 같고(e2eContract), BLANK_TAP_E2E_MARGIN(16) ≥ 2 × BLANK_TAP_SLOP_PX
    - lib blankPointsOf({ scene, avoid, margin, step, limit = 200 }): scene 상자를 margin 만큼 줄인 안쪽에서 step 간격 격자를 위→아래·왼→오른 순서로 훑어, 모든 avoid 상자를 margin 만큼 넓힌 범위 밖인 점을 순서대로 limit 개까지 돌려준다. 너비·높이 0 인 avoid 는 무시. 다 덮이면 []. 같은 입력이면 같은 결과
    - lib candidateGuideChecks(v, { picked }) → result "P11": v.bottom.guide 가 CANDIDATE_GUIDE[picked ? "picked" : "none"] 와 같고 isOneLine(v.bottom.guideH, v.bottom.guideLH) 면 통과. 다른 문장은 /무효표|취소/ 를 담은 실패, 두 줄은 /줄/ 실패, guide·guideH·guideLH 가 없으면 `측정값 없음`
    - lib cancelTapChecks({ chosenSeat, afterTag, afterBlank }) → result "P12": afterTag.voteTarget === chosenSeat 이고 afterTag.pill 에 `님에게 투표했어요`, afterBlank.voteTarget 이 undefined·null 이고 afterBlank.pill 에 `선택 안 함`·afterBlank.halos === 0 이면 통과. 이름표 탭에 취소됨 → /이름표/, 빈 곳 탭에 안 풀림 → /빈 곳/ 실패, 값이 없으면 `측정값 없음`
    - leak 한 판: 1일차 첫 투표자가 고른 뒤 취소하면 그 소켓만 `[state:candidateVote]`(voteTarget 키 없음), 다른 모든 소켓(탈락 관전자 포함)은 `[]`, 다시 같은 대상을 고르면 결과 한 판은 예전과 같다. 프레임 검사의 voteTarget 기대는 그날 그 투표자가 고른 값들의 집합이고, 취소 프레임을 실제로 하나 이상 봤다
    - uat-vote 2판(4명): 고르기 전 취소는 어느 클라이언트에도 state·error 가 오지 않음, C 가 고른 뒤 취소하면 C 만 voteTarget 없는 state·나머지는 그 사이 state 없음, 공개 cand.votes 길이 3·C 줄 없음·후보 C·모두 같은 순서, 공개 마감 길이 = 400 + 3×2000 + 600 = 7000ms·마감 1종, 약 7초 뒤 변론
  </behavior>
  <action>
RED 먼저(커밋 `test(261029-vvd): E2E 안내 줄·빈 곳 탭 순수 검사와 사본 대조 기대`): scripts/e2e/lib.test.mjs 에 behavior 의 blankPointsOf·candidateGuideChecks·cancelTapChecks 사례(통과 하나와 실패 사유별 하나씩, 측정값 없음), test/unit/e2eContract.test.ts 에 새 describe "E2E 의 후보 선택 안내·빈 곳 여유 사본 (결정 0040)"(src/game/verdict 의 VERDICT_TEXT, src/game/blankTap 의 BLANK_TAP_SLOP_PX import). 실패 확인 뒤 커밋.

GREEN(커밋 `feat(261029-vvd): 누출·UAT·E2E 에 후보 선택 취소 검사`):
A. scripts/e2e/lib.mjs: CANDIDATE_GUIDE(주석: src/game/verdict.ts 의 두 문장 사본, e2eContract 가 대조), BLANK_TAP_E2E_MARGIN = 16(주석: 앱 여유 8 의 두 배 — 측정 점이 분명히 빈 곳), blankPointsOf, candidateGuideChecks("P11"), cancelTapChecks("P12")를 export 하고 파일 머리 계약 주석의 bottom 필드 목록에 guideH·guideLH 를 더한다. 기존 판정 상수·승인 완화 목록·기존 검사 함수는 건드리지 않는다.
B. scripts/e2e/browser.mjs: readVerdict 의 bottom 에 guideH(안내 줄 요소 높이, 없으면 NaN)·guideLH(그 요소의 계산된 line-height 숫자)를 더한다. 새 export 세 개 — findBlankScenePoint(page): 페이지에서 `.mf-dayscene__scene` 상자와 그 안의 [data-seat]·.mf-tt-anchor·button 상자를 읽고, lib 의 blankPointsOf(margin BLANK_TAP_E2E_MARGIN, step 8)의 후보를 순서대로 elementFromPoint 로 확인해 맨 위 요소가 장면 안이고 [data-seat]·button·.mf-tt-anchor 안이 아닌 첫 점을 돌려준다(없으면 null). findTagPassThroughPoint(page, preferSeat): 장면의 `.mf-dt__tag[data-seat]` 를 preferSeat 먼저 순서로 돌며 상자 안 7×3 격자 점 중 elementFromPoint 의 맨 위 요소가 장면 안이고 [data-seat]·button 안이 아닌 첫 점({ x, y, seat })을 돌려준다(이름표가 pointer-events none 이라 탭이 아래로 빠지는 점, 없으면 null). tapAt(page, pt): page.touchscreen.tap(pt.x, pt.y)(vote5 문맥은 hasTouch).
C. scripts/e2e/flows.mjs vote5 cand-vote 블록: 도착 직후 읽은 값으로 candidateGuideChecks(picked false)를 기록한다. 기존 moved(P3) 앞에 취소 블록을 둔다 — target 을 pickCandidate 로 고르고 읽어 candidateGuideChecks(picked true), findTagPassThroughPoint(page, target) 로 탭한 뒤 600ms 기다려 afterTag = { voteTarget: 추적 마지막 view 의 me.voteTarget, pill }, findBlankScenePoint 로 탭한 뒤 tracker.waitFor(voteTarget 없음, 3000)(시간 초과는 잡아서 판정에 맡긴다) 후 읽어 afterBlank = { voteTarget, pill, halos: 흰 후광 수 }. 점을 못 찾으면 그 측정값을 null 로 넘겨 P12 가 `측정값 없음` 으로 실패하게 한다(건너뛰지 않는다). cancelTapChecks({ chosenSeat: target, afterTag, afterBlank })·취소 뒤 candidateChecks(chosenSeat null)·candidateGuideChecks(picked false)를 기록하고 still("candidateVote", "취소 검사"). 그 뒤 기존 moved 가 second → target 으로 다시 고른다. reveal 블록: 이미 읽은 그날 log 로 rec(sc, "P12", "[테스트] 시트로 넘겨도 내 표가 남음(공개에 내 줄)", votes 에 seat = mySeat·target = target 줄이 있음, 세부에 votes 요약)을 더한다(skipTo 가 [테스트] 버튼과 시트를 누른 뒤의 결과다).
D. test/worker/leak.test.ts castCandidates: 첫 투표자가 targetOf(first) 를 고른 직후(기존 (3) 검사 뒤) target null 을 보내 자기 프레임 `[state:candidateVote]`·voteTarget 키 없음과 다른 모든 소켓 `[]` 을 확인하고, 다시 targetOf(first) 를 고른다(이때도 다른 소켓 `[]`). 그날 투표자별로 고른 값 집합(일차 → seat → Set)을 따로 쌓아 프레임 검사의 voteTarget 기대를 "집합에 있음" 으로 바꾸고, seen 에 취소 프레임(그날 candidateVote 단계에서 voteTarget 이 있던 투표자의 voteTarget 없는 프레임)을 센 cancel 항목을 더해 마지막에 하나 이상인지 본다. 결과 한 판(후보·요약·승패) 기대는 바꾸지 않는다.
E. scripts/uat-vote.mjs: castCandidateCancel(clients, idx) 도우미(castCandidateVote 와 같은 모양 — 보내기 전 state 수, 보낸 뒤 그 클라이언트의 마지막 view 에 voteTarget 이 없고 state 가 하나 늘 때까지 5초, 300ms 뒤 다른 클라이언트의 state 수 변화 목록)와 무전송 확인(state·error 프레임 수가 500ms 동안 그대로). 2판: 후보 선택 도착 뒤 고르기 전 마피아의 취소 → check "고르기 전 취소(target null)는 아무 프레임도 오지 않음"; 기존 표를 모두 보내 반영을 기다린 뒤 C 의 취소 → check "취소: C 만 voteTarget 없는 state, 다른 클라이언트는 그 사이 state 없음"; picks 에서 C 를 뺀다. 공개 check 를 cand.votes 길이 3·C 줄 없음·후보 C 로, 공개 길이 check 를 `400 + 3×2000 + 600 = 7000ms` 로(candidateRevealMs(3) 과 7000 둘 다 확인), 변론 대기와 간격 check 는 그 길이를 따른다. 머리 주석 (b) 에 "후보 선택에서 C 가 고른 뒤 취소해 무효표(결정 0040) → 공개 3표·7초" 를 더한다. 1판은 바꾸지 않는다.
F. 로컬 게이트(이 Task 의 끝, 결과를 PROGRESS 에 적는다): `npm test`(unit·client·worker 파일·시험 수), `npm run typecheck`, `npm run build`, `node --test scripts/e2e/lib.test.mjs`. 그다음 `npm run dev` 를 백그라운드로 띄워 http://localhost:5173 이 응답하면 `node scripts/uat-vote.mjs http://localhost:5173`(새 check 포함 전부 OK), `npm run e2e -- --url http://localhost:5173 --only vote5`(기본 네 크기, 마지막 줄 `E2E OK`, P11·P12 네 크기 통과)를 차례로 돌리고 dev 서버를 끈다. 실패하면 원인을 고친다 — 앱 결함은 실패 테스트를 먼저 쓰고 고친다. 판정 기준·승인 완화 목록은 낮추거나 넓히지 않는다. 로컬 dev 는 CSS 를 압축하지 않으므로 화면 판정의 최종 확인은 Task 4 의 배포본 E2E 다.
  </action>
  <verify>
    <automated>node --test scripts/e2e/lib.test.mjs</automated>
    <fails_when>blankPointsOf·candidateGuideChecks·cancelTapChecks 사례나 기존 E2E 순수 검사 중 하나라도 실패한다</fails_when>
    <automated>npx vitest run --project unit test/unit/e2eContract.test.ts</automated>
    <fails_when>E2E 사본(CANDIDATE_GUIDE·BLANK_TAP_E2E_MARGIN)이 앱 상수와 어긋난다</fails_when>
    <automated>npx vitest run --project worker test/worker/leak.test.ts</automated>
    <fails_when>취소 프레임이 투표자 외 소켓에 가거나, 취소 프레임을 하나도 보지 못했거나, 기존 누출 검사 한 판이 실패한다</fails_when>
    <automated>for f in scripts/uat-vote.mjs scripts/e2e/lib.mjs scripts/e2e/browser.mjs scripts/e2e/flows.mjs; do node --check "$f" || exit 1; done</automated>
    <fails_when>바뀐 스크립트 중 하나라도 문법 오류</fails_when>
    <automated>npm test</automated>
    <fails_when>unit·client·worker 중 하나라도 실패 — 로컬 게이트 첫 단계</fails_when>
  </verify>
  <acceptance_criteria>
    - `grep -c "export function blankPointsOf" scripts/e2e/lib.mjs` >= 1, `grep -c "export function cancelTapChecks" scripts/e2e/lib.mjs` >= 1 (HEAD 0·0)
    - `grep -c '"P11"' scripts/e2e/lib.mjs` >= 1, `grep -c '"P12"' scripts/e2e/flows.mjs` >= 1 (HEAD 0·0)
    - `grep -c "CANDIDATE_GUIDE" test/unit/e2eContract.test.ts` >= 1 (HEAD 0)
    - `grep -c "target: null" scripts/uat-vote.mjs` >= 1, `grep -c "target: null" test/worker/leak.test.ts` >= 1 (HEAD 0·0)
    - `git log -p --grep=261029-vvd -- scripts/e2e/lib.mjs > "$TMPDIR/vvd-lib.diff"` 가 종료 코드 0 이고, `grep -c -e '^[-+]export const ONE_LINE_FACTOR ' -e '^[-+]export const OVERLAP_EPS ' -e '^[-+]export const TAP_MIN ' -e '^[-+]export const D3B_FLOOR_5_PLAYERS ' "$TMPDIR/vvd-lib.diff"` == 0 (판정 상수 줄을 바꾸지 않았다. HEAD 에서는 이 작업 커밋이 없어 diff 가 비어 있으므로, 판정은 Task 3 커밋 뒤에만 의미가 있다)
    - PROGRESS 에 로컬 게이트 결과(npm test 파일·시험 수, typecheck·build 통과, lib.test 통과, 로컬 uat-vote 전부 OK 와 check 수, 로컬 E2E vote5 `E2E OK` 와 네 크기 P11·P12)가 있다
    - test(261029-vvd)·feat(261029-vvd) 커밋이 Task 2 커밋 뒤에 하나씩 있다
  </acceptance_criteria>
  <done>누출 한 판·uat-vote·E2E vote5 가 취소를 실제로 거치고, 이름표 탭과 [테스트] 시트는 표를 지우지 않으며 빈 곳 탭은 지운다는 것을 네 크기 브라우저에서 확인했다. 공개 길이는 실제 표 수(3표 7초)다. 로컬 게이트(npm test·typecheck·build·lib.test·로컬 uat-vote·로컬 E2E vote5)가 통과했고 판정 기준은 그대로다.</done>
</task>

<task type="auto">
  <name>Task 4: 개인 계정에 서버·화면 함께 배포 → 배포본 순차 검증(smoke 시도표) → HANDOFF·SUMMARY·push</name>
  <files>HANDOFF.md, .planning/quick/261029-vvd-candidate-vote-cancel/261029-vvd-SUMMARY.md</files>
  <read_first>.planning/quick/261029-vvd-candidate-vote-cancel/261029-vvd-PROGRESS.md (Task 1~3 결과·로컬 게이트), .planning/quick/261029-t40-3-40-3-13-2/261029-t40-SUMMARY.md (배포 순서·Cache-Control 기대값·시도표 형식·status partial 판단), HANDOFF.md, test/unit/handoff.test.ts, scripts/prod-url.txt, wrangler.jsonc ("name")</read_first>
  <precondition>`npx wrangler whoami` 출력에 dhkim1522@naver.com 이 있고, `wrangler.jsonc` 의 name 이 minifia 이며, `git remote get-url origin` 이 git@github.com:dhkim1522/minifia.git 이다 — 하나라도 아니면 배포하지 말고 멈춰 보고한다(로그인·계정 전환을 스스로 하지 않는다)</precondition>
  <action>
사용자는 2026-10-29 에 이 변경의 서버·화면 함께 재배포를 승인했다(이 한 번의 배포와, 앱 결함 수정 뒤 한 번의 재배포에만 해당). 이 Task 는 별도 실행으로 돌 수 있으므로 PROGRESS 를 먼저 읽는다. 배포본 검사는 한 번에 하나씩 순차로 돌린다(병렬 금지).
(1) 배포 직전 확인: `npm test`, `npm run typecheck` 를 다시 돌려 파일·시험 수를 SUMMARY 에 적는다(로컬 uat-vote·E2E vote5 결과는 PROGRESS 에서 옮긴다).
(2) 정체 확인: precondition 세 가지. 하나라도 다르면 멈추고 보고한다.
(3) OLD_VERSION=`node scripts/smoke.mjs --prod --print-version` 를 적고 `npm run deploy` 한 번(vite build + wrangler deploy — Worker·DO 와 화면 에셋이 함께 올라간다). wrangler deploy 를 단독으로 돌리지 않고 서버만 따로 올리지 않는다. 성공 줄·Version ID 를 적는다(토큰·계정 ID 는 적지 않는다).
(4) `/api/health` 버전이 OLD_VERSION 과 달라질 때까지 5초 간격으로 최대 2분.
(5) Cache-Control(`curl -sI`): `/` = `public, max-age=0, must-revalidate`, index.html 이 부르는 해시 JS·CSS = `public, max-age=31536000, immutable`, `/characters/` 아래 그림 하나 = `public, max-age=86400`(t40 과 같은 기대).
(6) 배포본 순차 검사와 시도표(SUMMARY 표: 검사 | 시도 | 결과 줄 | 종료 코드 | 비고): `node scripts/smoke.mjs --prod --stage full --players 5 --previous-version <OLD_VERSION>`, `--players 8`, `--players 4`, `node scripts/uat-vote.mjs --prod`(취소 경우·공개 7000ms 포함), `node scripts/uat-test-bots.mjs --prod --previous-version <OLD_VERSION>`, `node scripts/uat-test-room.mjs --prod`, `node scripts/uat-day.mjs --prod`, `node scripts/uat-night.mjs --prod`. smoke 8명은 이 PC 네트워크에서 간헐 실패 이력(도착 편차 > 500ms)이 있다 — 실패하면 다른 검사가 돌지 않을 때 단독으로 한 번만 다시 돌리고 두 시도를 모두 표에 적는다. 그래도 실패하면 나머지 검사는 계속하고 SUMMARY status 를 partial 로 두며 보고한다. 다른 검사가 네트워크성 증상(도착 편차·프레임 지연)으로 실패하면 같은 규칙으로 단독 한 번 다시 돌리고, 같은 검사가 두 번 실패하면 멈추고 보고한다. 한도(500ms 등)·check 기준은 바꾸지 않는다.
(7) 배포본 E2E: `npm run e2e`(인자 없음 = 배포본, 360x640·390x664·430x932·360x560 + pc + wakelock)의 마지막 줄 `E2E OK`, 흐름 × 크기 표, 걸린 시간을 적는다. vote5 의 P11(안내 줄 문장·한 줄)·P12(이름표 탭 유지·빈 곳 탭 취소·공개에 내 줄)가 네 크기 모두 통과했는지 따로 적는다. 앱 결함이 나오면 실패 테스트 → 수정 → `npm test`·`npm run typecheck` → `npm run deploy` 한 번 더 → smoke 5명 한 번·영향받은 검사·E2E 다시. E2E 기준 수치·승인 완화 목록은 바꾸지 않는다.
(8) HANDOFF.md(6KB 이하, 해결된 항목은 지운다): 지금 상태 맨 위에 bullet 하나 — "후보 선택 취소·무효표 안내 배포(결정 0040): 고른 뒤 장면 빈 곳 탭 = 취소(와이어 target null, 투표자에게만), 안내 줄 `아무도 고르지 않으면 무효표가 돼요`/`빈 곳을 누르면 선택이 취소돼요`. 서버·화면 함께 배포, 배포본 버전 <새 버전>, 배포본 검사 요약(smoke 8 결과 포함)". 0039 bullet 의 버전·검사 목록과 smoke 간헐 실패 bullet 은 이번 결과로 합쳐 짧게 줄인다(크기 확보, 결정·SUMMARY 에 기록이 있다). 확인 대기 1 의 실기기 목록 끝에 "⑮ 후보 선택 빈 곳 탭 취소 느낌(이름표·사람 근처 오작동 없음)·무효표/취소 안내 줄(360폭 한 줄)" 을 더한다(조정은 `src/game/blankTap.ts`·`src/game/verdict.ts`). 어떤 실기기 항목도 통과 표시하지 않는다. `npx vitest run --project unit test/unit/handoff.test.ts` 통과, HANDOFF 에 32자 이상 16진 문자열 0.
(9) SUMMARY(.planning/quick/261029-vvd-candidate-vote-cancel/261029-vvd-SUMMARY.md, t40 SUMMARY 형식: quick_id·status complete|partial·provides·actuals·plan_head_before/after): 수행한 일(Task 1~3 은 PROGRESS 요약), 로컬 게이트, 계정·배포, Cache-Control, 시도표, E2E 표, 편차(Task 1 의 null 기대 목록 변경 포함), 남은 일, Self-Check. HANDOFF·SUMMARY 커밋(`docs(261029-vvd): 배포·배포본 검증·HANDOFF`) 뒤 `git push`(개인 SSH 원격, 전역 git 설정은 바꾸지 않는다). `.planning/milestone.lock`·`.planning/state.json`·`Claude outputs/`·`design/backgrounds/indoor-draft/` 는 커밋하지 않는다. STATE.md 의 quick 목록 갱신은 오케스트레이터가 한다.
  </action>
  <verify>
    <automated>npx wrangler whoami 2>&1 | grep -q "dhkim1522@naver.com"</automated>
    <fails_when>개인 계정이 아니다(배포 금지, 멈춤)</fails_when>
    <automated>node scripts/smoke.mjs --prod --stage full --players 5</automated>
    <fails_when>배포본 smoke 가 `SMOKE OK full` 이 아니다</fails_when>
    <automated>node scripts/uat-vote.mjs --prod</automated>
    <fails_when>취소 check(무전송·투표자에게만·공개 3표 7000ms)를 포함한 uat-vote 항목이 하나라도 실패한다</fails_when>
    <automated>npm run e2e</automated>
    <fails_when>마지막 줄이 `E2E OK` 가 아니다(vote5 P11·P12 네 크기 포함)</fails_when>
    <automated>npx vitest run --project unit test/unit/handoff.test.ts</automated>
    <fails_when>HANDOFF 가 6KB 를 넘거나 세 구역 규칙을 어긴다</fails_when>
  </verify>
  <acceptance_criteria>
    - SUMMARY 에 OLD_VERSION·새 버전(다름)·`npm run deploy` 성공 줄·Cache-Control 세 줄이 있다
    - SUMMARY 시도표에 smoke 5·8·4, uat-vote·uat-test-bots·uat-test-room·uat-day·uat-night 의 결과 줄과 모든 시도가 있고, smoke 8 이 두 번 실패했으면 status 가 partial 이다
    - SUMMARY 에 배포본 `E2E OK` 와 흐름 × 크기 표(네 크기 + pc + wakelock), vote5 P11·P12 네 크기 결과가 있다
    - `grep -c "0040" HANDOFF.md` >= 1, `grep -c "⑮" HANDOFF.md` >= 1 (HEAD 0·0), `wc -c < HANDOFF.md` <= 6144
    - `grep -Ec "[0-9a-f]{32,}" HANDOFF.md` == 0
    - `git status --porcelain HANDOFF.md` 가 비어 있고 `git log origin/main -1` 에 이 Task 의 docs(261029-vvd) 커밋이 있다(push 됨)
  </acceptance_criteria>
  <done>서버와 화면이 `npm run deploy` 한 번으로 개인 계정 Worker minifia 에 함께 배포됐고 버전이 바뀌었다. 배포본 Cache-Control·smoke(모든 시도 기록)·UAT 5종·E2E 를 차례로 확인했고 결과가 SUMMARY 에 있다. HANDOFF 가 6KB 이하로 갱신·push 됐고 ⑮ 가 더해졌으며 실기기 항목은 통과 표시가 없다.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| 클라이언트 → 방 DO(WebSocket) | 취소 메시지(target null)는 믿을 수 없는 입력이다. 행위자는 소켓 첨부 playerId 로만 정해진다 |
| 방 DO → 클라이언트 view | 진행 중 후보 선택은 투표자 본인에게만 간다. 취소 사실·시각이 남에게 새면 안 된다 |
| 화면 탭 → 사용자 의도 | 빈 곳 탭이 다른 조작(버튼·사람·[테스트])에서 오발하면 사용자가 원치 않는 무효표가 된다 |
| 저장소 문서 → 두 PC·다음 세션 | HANDOFF·SUMMARY 에 비밀 값이 들어가면 안 된다 |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-vvd-01 | Information Disclosure | worker/room.ts applyCandidateVote(취소) | high | mitigate | 취소도 sendViewTo([playerId]) 한 명에게만, 고른 표 없는 취소는 무전송. 워커 테스트(다른 다섯 소켓 `[]`, Task 1), 단위 뷰 차분(투표자 외 viewer view 가 세 상태에서 같음, Task 1), 누출 한 판(취소 프레임이 투표자 외 소켓에 없음, Task 3), uat-vote 배포본 check(Task 4) |
| T-vvd-02 | Tampering | shared/schemas.ts candidateVote | medium | mitigate | strictObject 에 0..7 정수 또는 null 만. 빠진 target·문자열·불리언·범위 밖·덧붙은 키 거부, nullable 은 candidateVote 한 곳(pick 은 null 거부) — test/unit/schemas.test.ts·워커 BAD_MESSAGE 사례(Task 1), acceptance 의 `grep -n 'nullable()'` 두 줄 확인 |
| T-vvd-03 | Elevation of Privilege | shared/game/vote.ts castCandidateVote(null) | medium | mitigate | 단계 검사(WRONG_PHASE)와 행위자 검사(방에 있고 생존, 아니면 BAD_MESSAGE)를 null 분기보다 먼저 한다. 탈락 관전자·다른 단계 취소 사례(Task 1) |
| T-vvd-04 | Repudiation | 집계·공개 길이 | medium | mitigate | 취소는 키를 지우기만 하고 집계는 키가 있는 표만 센다. tick 결과 테스트(2표·0표 2000ms·noVotes, Task 1), uat-vote 공개 3표 7000ms(Task 3·4) |
| T-vvd-05 | Tampering | 화면 빈 곳 판정(사용자 의도) | medium | mitigate | 장면 상자 안·사람 상자 8px 밖·버튼·[테스트] 밖일 때만, 후보 선택 생존 viewer·canSend 일 때만. 클라이언트 가드 테스트(Task 2), E2E P12 네 크기(Task 3·4), 실기기 ⑮(Task 4, 통과 표시 안 함) |
| T-vvd-06 | Denial of Service | 고르기·취소 연타 | low | accept | 한 번에 투표자 한 명에게 state 하나, 방송 없음, 무전송 no-op, 연결당 메시지 한도 그대로. 증폭 없음 |
| T-vvd-08 | Denial of Service | 서버만 배포·낡은 dist | medium | mitigate | `npm run deploy` 한 명령만, wrangler deploy 단독 금지. 옛 번들은 null 을 보내지 않아 무해, 전환 중 새 화면 → 옛 서버는 BAD_MESSAGE 토스트로 끝난다(결정 0040 결과) |
| T-vvd-09 | Repudiation | 배포본 검증 기록 | medium | mitigate | 모든 시도를 시도표에 적고 단독 재실행은 한 번까지. 한도·E2E 기준·승인 완화 목록 불변. smoke 8 두 번 실패면 partial |
| T-vvd-10 | Information Disclosure | HANDOFF·SUMMARY | low | mitigate | 토큰·방 토큰·계정 ID 를 적지 않는다. HANDOFF 32자 이상 16진 문자열 0 검사(Task 4) |
| T-vvd-SC | Tampering | npm/pip/cargo installs | high | accept | 이 계획에 패키지 설치가 없다(새 의존성 0). 설치가 필요해지면 멈추고 패키지 정당성 확인 후 사람 확인을 받는다 |
</threat_model>

<verification>
- Task 1~3 뒤: `npm test`(unit·client·worker), `npm run typecheck`, `npm run build`, `node --test scripts/e2e/lib.test.mjs` 모두 통과
- 로컬 dev: uat-vote 전부 OK(취소 check 포함), E2E `--only vote5` 네 크기 `E2E OK`(P11·P12)
- 배포본: 버전 바뀜, Cache-Control 세 줄, smoke 5·8·4(시도표), uat-vote·uat-test-bots·uat-test-room·uat-day·uat-night, E2E(네 크기 + pc + wakelock) `E2E OK`
- 문서: 결정 0040 존재, 0036·04-CONTEXT·04-UI-SPEC·05-UI-SPEC·product 개정 표기, HANDOFF 6KB 이하·⑮ 추가·실기기 미통과
</verification>

<success_criteria>
- 고른 뒤 장면의 빈 곳을 탭하면 선택이 풀리고(와이어 target null), 서버는 투표자에게만 알리며 다른 사람의 프레임은 같다
- 마감 때 고른 사람이 없으면 무효표이고 공개 길이가 실제 표 수로 줄어든다. 새 버튼은 없다
- 안내 줄이 고르기 전·고른 뒤 두 문장으로 바뀌고 네 역할이 같은 글자를 본다(data-guide 하나, 360폭 한 줄)
- 헤더·패널·[테스트]·사람·이름표 탭과 다른 단계·관전자에서는 취소되지 않는다
- 서버와 화면이 한 번에 개인 계정에 배포되고 배포본 검사 결과가 모든 시도와 함께 기록된다. 판정 기준은 그대로다
</success_criteria>

<output>
Create `.planning/quick/261029-vvd-candidate-vote-cancel/261029-vvd-SUMMARY.md` when done
</output>
