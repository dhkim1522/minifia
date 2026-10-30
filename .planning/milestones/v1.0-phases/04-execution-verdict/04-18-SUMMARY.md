---
phase: 04-execution-verdict
plan: 18
subsystem: verdict-screens-candidate-vote
tags: [candidateVote, DayTable, halo, useViewChoice, CandidateVotePanel, verdictScene, tdd]
status: complete

requires:
  - phase: 04-execution-verdict
    provides: "04-13 verdict.ts(capHalos·VERDICT_TEXT), 04-16 useVerdictScene·라우팅·BAD_MESSAGE 토스트, 서버 웨이브의 view.me.voteTarget·candidateVote 메시지"
provides:
  - "DayTableSeat.halo(`white|amber|crimson|none`) — 주면 파생 규칙(차례·밤 선택 흰, 동료 진홍)을 이긴다. none 은 후광만 끄고 동료 마름모는 남긴다. 앰버 후광 변수 --mf-halo-amber 와 끊김 조합(흑백 먼저)"
  - "DayTableSeat.pressed — 머리 위 배지 없이 onPick 버튼의 aria-pressed 만 켠다(후광만 쓰는 투표 구간용)"
  - "useViewChoice(view, serverValue) → [값, choose] — 새 서버 view 객체가 오면 낙관적 선택을 버리는 공용 훅(밤 pressPick 은 건드리지 않음)"
  - "PickPill format=\"vote\" — `●이름님에게 투표했어요`(기본 pick 은 불변), CandidateVotePanel — 안내 + 확정 알약 / 관전 줄"
  - "RoomScreen 이 candidateVote 를 DayScene 으로 라우팅(sceneKey dayScene 유지), useVerdictScene 의 candidateVote 분기(자기 제외 좌석 탭 선택·번복·capHalos 로 후광 명시·관전·끊김)"
affects: [04-19, 04-20, 04-21 — 공개(앰버)·변론(흰)·처형이 같은 halo 와 같은 훅·라우팅을 쓴다]

actuals:
  tokens: 11400
  tasks: 3
  commits: 8
plan_head_before: 8df28c54e3f5c670ca3eba6d1537c9605693f593
plan_head_after: 75d979ead7602e095438114ccf702460d2cb8d3b

tech-stack:
  added: []
  patterns:
    - "투표 구간 후광은 capHalos 로 최종 종류를 계산해 모든 좌석에 halo 로 명시한다(상한 3, 흰 > 앰버 > 진홍). 기존 장면은 halo 를 안 줘서 한 글자도 안 바뀐다"
    - "동료 판정(isAllySeat)을 DayScene 한 곳에 두고 마름모와 verdict 후광이 같이 쓴다"
    - "낙관적 선택 { view, value } 를 훅으로 일반화(useViewChoice) — 새 view 객체가 오면 서버 값이 이긴다"

key-files:
  created:
    - src/components/CandidateVotePanel.tsx
    - src/net/useViewChoice.ts
    - test/client/candidateVote.test.tsx
    - test/client/useViewChoice.test.tsx
  modified:
    - src/components/DayTable.tsx
    - src/components/NightPanel.tsx
    - src/styles/daytable.css
    - src/styles/night.css
    - src/screens/verdictScene.tsx
    - src/screens/DayScene.tsx
    - src/screens/RoomScreen.tsx
    - test/client/dayTable.test.tsx

key-decisions:
  - "후보 선택의 눌림 표시는 `pick.mine` 이 아니라 새 좌석 prop `pressed` 로 만든다. pick.mine 은 머리 위 표적 배지까지 그리는데 UI-SPEC 은 투표 단계에 `후광 외에 머리 위 배지·발밑 링 없음`(결정 0030)이라 정했다"
  - "확정 알약은 `.mf-pk--vote { gap: 0 }` — 이름과 `님에게 투표했어요` 가 한 문장이라 밤의 항목 간격 8px 을 쓰지 않는다"
  - "탈락 viewer 의 후광은 동료(마피아) 진홍만 capHalos 에 넣는다. 흰(내 선택)은 살아 있는 viewer 만"

requirements-completed: []  # VOTE-02·CONN-02 는 04-35 의 배포본 검증 뒤에 체크한다(HANDOFF·사용자 지시)

coverage:
  - id: D1
    description: "후보 선택에서 살아 있는 viewer 가 자기 아닌 살아 있는 좌석을 `{닉네임}, 투표 대상` 버튼으로 탭해 고르고, 내가 고른 자리에만 흰 후광 하나·알약 `{이름}님에게 투표했어요`. 나·탈락자는 버튼이 아니고 끊긴 살아 있는 자리는 고를 수 있다"
    requirement: "VOTE-02"
    verification:
      - kind: unit
        ref: "npx vitest run --project client test/client/candidateVote.test.tsx (16 통과)"
        status: pass
      - kind: manual_procedural
        ref: "npm run dev + 테스트 방(봇 3, 봇 투표 yes/other) + 헤드리스 Chrome 390x844·360x640 에서 execVote → candidateVote 진입, 좌석 선택·번복 확인(스크린샷 판독, 아래 본문)"
        status: pass
    human_judgment: true
  - id: D2
    description: "마감 전 다른 좌석 탭으로 번복, 같은 좌석 재탭은 무전송, 새 서버 view 의 me.voteTarget 이 낙관적 선택을 이기고 남의 선택은 후광·배지 모두 없다"
    requirement: "VOTE-02"
    verification:
      - kind: unit
        ref: "test/client/candidateVote.test.tsx(번복·재탭·새 서버 view·거절 뒤 view·남의 좌석 표시 0), test/client/useViewChoice.test.tsx"
        status: pass
      - kind: manual_procedural
        ref: "헤드리스 Chrome 에서 좌석 1 → 2 번복, 봇 표가 오가는 몇 초 뒤에도 선택이 유지됨(서버가 받아들였다는 증거: 새 view 가 와도 me.voteTarget 이 같은 좌석)"
        status: pass
    human_judgment: false
  - id: D3
    description: "탈락 viewer 는 투표 버튼 없이 좌석이 기록 카드 버튼이고 하단은 `처형할 사람을 고르는 중이에요` + 안내 + `관전 중 · 볼 수만 있어요`"
    requirement: "CONN-02"
    verification:
      - kind: unit
        ref: "test/client/candidateVote.test.tsx(탈락한 viewer)"
        status: pass
    human_judgment: false
  - id: D4
    description: "마피아 동료의 진홍 마름모·후광이 후보 선택 중에도 남고 내 선택과 겹치면 흰이 이긴다. 후광은 한 화면 최대 3개(capHalos)"
    requirement: "VOTE-02"
    verification:
      - kind: unit
        ref: "test/client/candidateVote.test.tsx(마피아 동료), test/client/dayTable.test.tsx(halo 네 값·기본 파생·끊김·앰버 CSS·pressed)"
        status: pass
    human_judgment: false
---

# Phase 4 Plan 18: 후보 선택 투표 화면 Summary

**서버가 보내는 `candidateVote` 단계가 방 화면 → 낮 장면 → 좌석 탭 → 소켓 `candidateVote` 메시지까지 이어져, 폰에서 자기 제외 선택·번복·흰 후광·확정 문구·관전이 실제로 동작한다. 이 계획이 `DayTable` 에 만든 `halo` 종류(앰버 포함)는 이후 공개·변론·처형 화면이 같이 쓴다.**

## 한 일

**Task 1 — halo 종류·앰버 후광·useViewChoice** — RED `e743502` → GREEN `531f686`, 정리 `8be0d58`
- `DayTableSeat.halo`: 주면 그 값(`white|amber|crimson|none`)이 파생 규칙을 이기고, 안 주면 기존(차례·밤 선택 흰, 동료 진홍, 둘이면 흰)이 한 글자도 바뀌지 않는다. `none` 은 후광만 끄고 마름모(`isAlly`)는 남긴다. 클래스는 `HALO_CLASS` 표 한 곳.
- `daytable.css`: `--mf-halo-amber`(UI-SPEC 6.2, `--amber-400` 변수만, 번짐 9px)와 `.mf-figure--halo-amber`·끊김 조합(`grayscale(1)` 먼저).
- `src/net/useViewChoice.ts`: `[값, choose]`. 값이 view 객체 동일성에 묶여, 서버가 거절해 state 를 다시 보내면 서버 값으로 돌아온다.

**Task 2 — 후보 선택 하단** — RED `d2b507b` → GREEN `3f35cab`
- `PickPill` 에 `format?: "pick" | "vote"`. `vote` 는 자리 색 점 + 굵은 이름 + `VERDICT_TEXT.votedSuffix`. 기본(밤)은 불변.
- `CandidateVotePanel`: 살아 있으면 제목·안내·알약 한 줄, 탈락이면 관전 제목·안내 + `ReadOnlyRow text`. 문구는 모두 `VERDICT_TEXT`(컴포넌트 안에 직접 쓴 문구 0).

**Task 3 — 단계 연결** — RED `4fad79b` → GREEN `b786f55`
- `RoomScreen`: `candidateVote` 를 DayScene 묶음·`sceneKey` 에 추가, 단계 안내를 `VERDICT_TEXT.announce.candidateVote` 로.
- `verdictScene`: candidateVote 분기. 내 선택은 `useViewChoice(view, me.voteTarget)`, 살아 있는 viewer 의 자기 아닌 살아 있는 좌석에만 `onPick`(같은 자리 재탭 무시), 후광은 흰(내 선택)·진홍(동료)을 `capHalos` 로 계산해 모든 좌석에 `halo` 로 명시. 탈락 viewer 는 모든 좌석 `onInspect`. `pickVerb: "투표"`.
- `DayScene`: 동료 판정을 `isAllySeat` 한 곳으로 모아 마름모(`isAlly`)와 verdict 후광이 같이 쓰게 했다. 이 때문에 `useVerdictScene` 호출을 `spectate`·`allies` 정의 뒤로 옮겼다(훅 순서는 렌더마다 같다). `pickVerb` 는 verdict 값이 있으면 그것을 쓴다.

**실제 렌더 확인 후 수정** — `75d979e`
- 브라우저에서 보니 `.mf-pk` 의 항목 간격 8px 때문에 `봇마바사아  님에게 투표했어요` 로 이름과 `님에게` 가 벌어졌다. `.mf-pk--vote { gap: 0 }`.

## 검증

- `npm test`: 91 파일 2334 통과(04-17 직후 대비 새 시험 파일 2개·dayTable 확장). `npm run typecheck`(토큰 검사 + 두 tsc): 통과. `npm run build`: 통과.
- 새 시험: `candidateVote.test.tsx` 16개(PickPill 2·CandidateVotePanel 4·RoomScreen 한 경로 10), `useViewChoice.test.tsx` 2개, `dayTable.test.tsx` 6개 추가. 기존 낮·밤·아침·execVote 시험은 한 줄도 고치지 않고 통과.
- 수용 기준 grep: `mf-figure--halo-amber` DayTable.tsx 1·daytable.css 2, `mf-halo-amber` 3, `case "candidateVote"` RoomScreen 1, `candidateVote` verdictScene 3, `format` NightPanel 3, `처형할 사람을 고르세요` CandidateVotePanel 0, `useViewChoice.ts` 존재.

### 브라우저에서 실제로 그려지는지 (정직한 보고)

**확인했다(살아 있는 방장 viewer 한정).** `vite dev`(내가 띄운 PID 98110 만 종료함)를 켜고 스크래치패드의 일회용 스크립트(`verify-candvote.mjs`, 저장소에 넣지 않음)로 다음을 했다.
1. Node 소켓으로 테스트 방을 만들고 봇 3 + `testBotVote {exec: yes, pick: other}`(대기실에서만 가능) 뒤 discussion 까지 넘기고 소켓을 닫았다.
2. 헤드리스 Chrome(Google Chrome, playwright-core)을 방장으로 붙이고 [테스트] → `다음 단계로 넘기기`로 execVote → [찬성] → 다시 넘기기로 candidateVote 에 들어갔다.
3. 관찰: 헤더 `낮 · 후보 선택`/`1일차`, 하단 `처형할 사람을 고르세요` + 안내, 알약 `선택 안 함`, 좌석 버튼은 봇 3 명만(`…, 투표 대상`, 내 좌석은 버튼 아님), 후광 0·머리 위 배지 0, 타이머 진홍 아님. 좌석 1 클릭 → aria-pressed true·그 자리에만 흰 후광(계산된 filter 에 drop-shadow 있음)·알약 `봇가나다라님에게 투표했어요`. 좌석 2 로 번복 → 후광이 옮겨 가고 하나만 남음. 봇 표가 오가는 3.5초 뒤에도 선택이 유지됨(서버가 받아들인 증거). 알약 줄 scrollWidth = clientWidth(390: 358, 360: 328), 높이 44. 콘솔 오류 0. 390×844 와 360×640 스크린샷을 눈으로 읽었고, 간격 문제는 이때 발견해 고쳤다.

**확인하지 못한 것:** 탈락 viewer(관전 알약) 화면, 마피아 동료 진홍 마름모·후광이 투표 장면에 남는 모습, 연결이 끊긴 자리의 흐림 + 후광 조합, 서버의 BAD_MESSAGE 거절 토스트는 브라우저에서 보지 않았다(방장이 첫 낮에 탈락하거나 마피아 시점을 만들기 어렵다). 단위 시험으로만 검증했다. 실제 폰·iOS 사파리, 후보 선택 배경(dusk 등)이 구워져 있는지는 이 계획 범위가 아니다. 앰버 후광은 이 계획에서 아무 장면도 쓰지 않아 화면으로는 못 봤고 CSS 규칙만 시험으로 고정했다.

## Deviations from Plan

### 자동 수정

**1. [Rule 2 - 누락된 필수 기능] 배지 없이 눌림만 켜는 `pressed` 좌석 prop**
- **발견:** Task 3 설계 중 `DayTable` 의 `aria-pressed` 가 `pick.mine` 에만 묶여 있고, `pick.mine` 은 머리 위 표적 배지도 그리는 것을 확인
- **문제:** UI-SPEC 은 투표 단계에 `후광 외에 머리 위 배지·발밑 링 없음`(결정 0030). 계획 문구대로 `pick.mine` 을 쓰면 후보 선택에서 배지가 생긴다
- **수정:** `DayTableSeat.pressed?: boolean`(안 주면 `!!pick.mine`, 기존 동작 불변)을 더하고 후보 선택은 `pressed` 로 눌림만 켠다. 시험이 배지 0 을 단언한다
- **파일:** `src/components/DayTable.tsx`, `test/client/dayTable.test.tsx`, `test/client/candidateVote.test.tsx`
- **커밋:** `b786f55`

**2. [Rule 1 - Bug] 확정 알약에서 이름과 `님에게` 사이가 벌어짐**
- **발견:** 브라우저 스크린샷 확인 중(Task 3 GREEN 뒤)
- **문제:** `.mf-pk` 가 flex + gap 8 이라 `선택 ●이름` 과 달리 한 문장인 `●이름님에게 투표했어요` 가 벌어져 보임
- **수정:** vote 알약에만 `.mf-pk--vote { gap: 0 }`
- **파일:** `src/components/NightPanel.tsx`, `src/styles/night.css`, `test/client/candidateVote.test.tsx`
- **커밋:** `75d979e`

**3. [Rule 3 - 막힌 일] 후광 계산에 동료 판정이 필요해 DayScene 호출 순서를 바꿈**
- **문제:** `useVerdictScene` 이 `capHalos` 에 진홍(동료)을 넣으려면 `spectate`·`allies` 가 먼저 있어야 한다(관전자는 모든 마피아가 동료)
- **수정:** 동료 규칙을 `isAllySeat` 하나로 모아 `isAlly` 와 verdict 가 같이 쓰고, `useVerdictScene` 호출을 그 정의 뒤로 옮겼다. 훅 호출 순서는 매 렌더 같다. `VerdictSceneCtx` 에 `isAllySeat` 추가
- **파일:** `src/screens/DayScene.tsx`, `src/screens/verdictScene.tsx`
- **커밋:** `b786f55`

### 계획과 다르게 한 것

- `files_modified` 에 있던 `src/styles/verdict.css` 는 고치지 않았다(알약은 `.mf-pk` 기본으로 충분). 대신 `src/styles/night.css`(`.mf-pk--vote`)와 `test/client/useViewChoice.test.tsx`(훅 단독 시험)를 더했다.
- 계획은 `PickPill` 을 `format` 으로, UI-SPEC 은 `text` 변형으로 적었다. 계획(`format`)을 따랐다.
- 후보 선택 중인 execVote 는 `halo` 를 주지 않는다(투표 장면에 흰 후광이 없고 동료 진홍은 기존 파생으로 같은 결과). 계획의 "투표 구간은 항상 명시"는 candidateVote 에 적용했고, execVote 는 04-16 동작을 그대로 두었다.

## 알려진 미해결

- `DayTableSeat.halo` 의 `amber` 는 아직 쓰는 화면이 없다(04-19 공개·04-20 변론이 쓴다).
- `scripts/e2e/flows.mjs`·`browser.mjs`, `scripts/uat-test-bots.mjs` 는 여전히 4페이즈 흐름에 맞춰지지 않았다(`deferred-items.md`). 이 계획은 건드리지 않았다.

## Known Stubs

없음. 이 계획이 새로 쓴 파일에 하드코딩된 빈 값·자리표시 문구가 없다. (candidateVoteReveal·defense·execution·ended 화면은 04-19~04-21 범위라 여전히 `연결 중…` 이다.)

## Threat Flags

없음. 새 네트워크 경로·권한 경로·스키마 변경이 없다. 위협 표 T-04-51(남의 선택 노출)은 남의 좌석 후광 0·배지 0 시험으로, T-04-52(자기·탈락자 선택)는 버튼을 만들지 않는 화면 규칙과 BAD_MESSAGE 토스트·서버 state 복귀 시험으로 완화를 확인했다.

## Self-Check: PASSED

- 파일: `src/components/CandidateVotePanel.tsx`, `src/net/useViewChoice.ts`, `test/client/candidateVote.test.tsx`, `test/client/useViewChoice.test.tsx` 존재.
- 커밋: `e743502`, `531f686`, `8be0d58`, `d2b507b`, `3f35cab`, `4fad79b`, `b786f55`, `75d979e` 모두 HEAD 의 조상.
