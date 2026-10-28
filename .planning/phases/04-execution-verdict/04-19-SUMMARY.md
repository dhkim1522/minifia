---
phase: 04-execution-verdict
plan: 19
subsystem: verdict-screens-reveal
tags: [candidateVoteReveal, useRevealState, DayTable, chip, halo-amber, verdictScene, tdd]
status: complete

requires:
  - phase: 04-execution-verdict
    provides: "04-13 verdict.ts(revealPlan·revealStateAt·revealCaption·revealResultLine·chipAnchor·capHalos), 04-18 DayTableSeat.halo(앰버 포함)·useVerdictScene·candidateVote 라우팅, 서버 웨이브의 view.day.voteLog(서버가 셔플한 공개 순서)"
provides:
  - "useRevealState(view, offset) — 서버 시각(Date.now()+offset) 기준 공개 상태 훅. 단계가 candidateVoteReveal 이 아니면 null, 맞으면 { plan, state, caption }. 경계 시각(화살표 시작·닿음·사라짐 끝·마지막 슬롯 끝)마다만 setTimeout 하나로 다시 그린다"
  - "DayTableSeat.chip { n, tone: plain|pop|lead|beat } — 머리 위 .mf-vchip(chipAnchor 위치, z 46, aria-hidden, 클릭 통과). key 에 n 이 들어 숫자가 오르면 새 노드라 팝이 다시 돈다"
  - ".mf-vchip CSS(verdict.css) — plain gray-100 / pop 앰버 면 + 220ms 팝 / lead·beat 앰버 면 + 24px + 외곽선 1.4px. 모션 줄이기에서는 팝 없이 색만"
  - "RoomScreen 이 candidateVoteReveal 을 DayScene 으로 라우팅(sceneKey dayScene 유지, 테이블 DOM 노드 그대로), useVerdictScene 의 공개 분기(칩·앰버 후광·하단 caption·좌석 탭 비활성·liveLine)"
  - "VerdictScene.liveLine — DayScene 의 별도 sr-only polite 영역(.mf-dayscene__verdict-live)이 끝 상태 한 문장을 읽는다"
affects: [04-20 — 같은 상태 위에 움직이는 화살표(rAF)와 확정 두근(beat 톤 자리)을 얹는다, 04-21·04-22 — 변론·처형이 같은 훅 분기 패턴을 쓴다]

actuals:
  tokens: 11700
  tasks: 2
  commits: 4
plan_head_before: bd474299ffea9c9b6ddfa46164582a0e57e4e4aa
plan_head_after: 48b84c9f9bafeaff4fb0b2f5952d5fd1a2c8dbf1

tech-stack:
  added: []
  patterns:
    - "순수 시간표(revealPlan)를 서버 시각에 적용하는 훅은 '다음 경계 하나만 기다리는 setTimeout + tick' 이다. setInterval·rAF 없이 경계마다 정확히 한 번 그린다(시험이 렌더 횟수를 단언)"
    - "plan 의 안정 키 = 시작 시각 + `seat>target` 줄. 같은 votes 면 view 객체가 바뀌어도 plan 이 새로 만들어지지 않는다"
    - "투표 구간 후광은 모든 좌석에 capHalos 의 최종 종류를 halo 로 명시(04-18 방식 그대로, 이번에는 앰버)"

key-files:
  created:
    - src/net/useRevealState.ts
    - test/client/reveal.test.tsx
  modified:
    - src/components/DayTable.tsx
    - src/styles/verdict.css
    - src/screens/verdictScene.tsx
    - src/screens/DayScene.tsx
    - src/screens/RoomScreen.tsx
    - src/game/verdict.ts
    - test/client/dayTable.test.tsx

key-decisions:
  - "칩 톤은 `유일한 선두 → lead`, `방금 닿은 대상(선두 아님) → pop`, 그 밖은 `plain`. 선두와 팝이 같은 자리면 lead. 그래서 첫 표가 닿는 순간 그 자리가 이미 유일한 선두라 1표짜리 lead(큰 칩 + 앰버 후광)로 시작하고, 다른 자리가 1표로 동률이 되면 lead 가 plain 으로 돌아간다(브라우저에서 확인한 실제 동작)"
  - "첫 화살표(단계 시작 200ms) 전에만 보이는 기본 하단은 제목 `투표 공개`(VERDICT_TEXT.revealIntroTitle, 단계 안내와 같은 문구)와 안내 `모두 {n}표`(revealIntroHint). 진행 중 안내의 뒷부분과 같은 조각이라 새 문장을 만들지 않았다"
  - "훅은 { state, caption } 외에 plan 도 돌려준다 — 끝 상태 읽기 문장(revealResultLine)이 plan 을 필요로 하고, 시험이 plan 안정성을 직접 본다"

requirements-completed: []  # VOTE-02 는 04-35 의 배포본 검증 뒤에 체크한다(HANDOFF·사용자 지시)

coverage:
  - id: D1
    description: "후보 선택이 끝나면 같은 테이블 위에서 서버가 정한 순서대로 한 표씩 대상의 표수 칩이 오르고, 방금 닿은 대상은 앰버 칩 팝과 앰버 후광, 유일한 최다 득표 후보는 앰버를 유지한다"
    requirement: "VOTE-02"
    verification:
      - kind: unit
        ref: "npx vitest run --project client test/client/reveal.test.tsx (훅 9 + 화면 14 통과)"
        status: pass
      - kind: manual_procedural
        ref: "npm run dev + 테스트 방(봇 3, 봇 투표 yes/other) + 헤드리스 Chrome 390x844·360x640 에서 후보 선택 → 공개를 지나며 20ms 표본으로 칩·후광·문구 기록(아래 본문)"
        status: pass
    human_judgment: true
  - id: D2
    description: "모든 폰이 같은 서버 시각 기준으로 같은 순서·같은 시각에 같은 칩 수를 보고, 중간 합류는 지금 시각 상태로 건너뛴다. 클라이언트는 서버 votes 배열을 다시 섞지 않는다"
    requirement: "VOTE-02"
    verification:
      - kind: unit
        ref: "reveal.test.tsx(시계 = 시작 + t 가 revealStateAt 과 같음·offset·같은 득표 다른 순서·중간 합류 1000/3000ms), useRevealState 훅의 serverNow 한 함수"
        status: pass
    human_judgment: false
  - id: D3
    description: "끝 상태 하단 문구(최다·동률·무표)와 읽기 안내는 끝 상태 한 번만 읽는다"
    requirement: "VOTE-02"
    verification:
      - kind: unit
        ref: "reveal.test.tsx(최다 `{c}님이 가장 많은 표를 받았어요`·동률 `표가 갈렸어요`·0표 `투표한 사람이 없어요`, 끝 전 liveLine 빈 문자열, polite 영역 1개, 하단 래퍼 aria-live=off)"
        status: pass
      - kind: manual_procedural
        ref: "헤드리스 Chrome 표본: 끝 상태에서만 .mf-dayscene__verdict-live 에 `봇가나다라님이 3표로 가장 많은 표를 받았어요`가 들어감(동률·무표는 시험으로만)"
        status: pass
    human_judgment: false
  - id: D4
    description: "한 화면 후광은 최대 3개(흰 > 앰버 > 진홍). 마피아 동료 마름모는 후광이 꺼져도 남고, 공개 중 좌석 탭은 비활성"
    requirement: "VOTE-02"
    verification:
      - kind: unit
        ref: "reveal.test.tsx(동료 [1,2,4] 에서 진홍 큰 번호부터 꺼지고 마름모 3 유지, 좌석 버튼 0·탭해도 기록 카드 없음·전송 없음)"
        status: pass
    human_judgment: false
---

# Phase 4 Plan 19: 후보 선택 공개 화면(상태 쪽) Summary

**`candidateVoteReveal` 단계가 낮 테이블 위에서 서버 시각 기준으로 한 표씩 칩 수를 올리고 앰버 후광·끝 문구까지 보여 준다. 움직이는 화살표와 확정 두근은 04-20 이 이 상태 위에 얹는다.**

## 한 일

**Task 1 — 훅과 표수 칩** — RED `0c1addc` → GREEN `d0eed15`
- `src/net/useRevealState.ts`: `useMemo` 로 `revealPlan` 을 만들고(안정 키), `setTimeout` 하나로 "지금 이후 가장 이른 경계"만 기다린다. 경계는 단계별 시작·닿음·닿음+`REVEAL_FADE_MS`·마지막 슬롯 끝. 서버 시각 계산은 `serverNow(offset)` 한 함수. 단계 이탈·언마운트·경계 소진 때 타이머를 정리한다. `setInterval`·`requestAnimationFrame` 없음.
- `DayTable`: 좌석 `chip { n, tone }` → `chipAnchor` 위치의 `.mf-vchip.mf-vchip--{tone}`(z 46, aria-hidden, `data-seat`, key `c{seat}:{n}`). lead·beat 는 36×32 큰 칩, 나머지 28×24.
- `verdict.css`: 칩 기본(gray-100·night-900·16px 700·모서리 7·그림자 `--shadow`), `--pop`(앰버 면, 220ms 팝), `--lead`·`--beat`(앰버 면, 24px, 외곽선 1.4px), 모션 줄이기에서 팝 없음. 색은 토큰 변수만.

**Task 2 — 단계 연결** — RED `53210d0` → GREEN `48b84c9`
- `RoomScreen`: `candidateVoteReveal` 을 DayScene 묶음·`sceneKey` 에 추가, 단계 안내를 `VERDICT_TEXT.announce.candidateVoteReveal`(`투표 공개`)로.
- `verdictScene`: 공개 분기. 헤더 `낮 · 투표 공개`/`{n}일차`, calm, 칩(선두 lead·팝 pop·그 밖 plain), 후광은 팝 대상·유일한 선두 앰버 + 마피아 동료 진홍을 `capHalos` 로 계산해 모든 좌석에 `halo` 로 명시. `onPick`·`onInspect` 없음. 하단은 `aria-live="off"` 래퍼 안의 `NightPanel`(caption). 끝 상태에서만 `liveLine`(`revealResultLine`).
- `DayScene`: `liveLine` 이 있으면 별도 `<p class="mf-sr-only mf-dayscene__verdict-live" aria-live="polite">`. 그 밖은 그대로.
- `verdict.ts`: `VERDICT_TEXT.revealIntroTitle`·`revealIntroHint(total)` 추가(첫 화살표 전 기본 하단).

## 검증

- `npm test`: 92 파일 2362 통과(04-18 직후 2334 → 새 시험 28개). `npm run typecheck`(토큰 검사 + 두 tsc): 통과(종료 코드 0). `npm run build`: 통과. `node scripts/tsc-scoped.mjs tsconfig.app.json …`: 통과.
- 새 시험: `reveal.test.tsx` 23개(훅 9: 비공개 단계 null·`시작 + t` 상태 일치·offset·경계마다 한 번만 다시 그림·닿는 시각과 팝 해제·중간 합류·순서 보존·안정 plan·그날 줄만 사용·단계 이탈/언마운트 타이머 정리 / 화면 14), `dayTable.test.tsx` 5개(칩 렌더·aria-hidden·z 46·폰 폭 320·360·390·430 × 4~8명 위치·key 갱신·CSS).
- 수용 기준: `mf-vchip` DayTable.tsx 1·verdict.css 6, `setInterval|requestAnimationFrame` useRevealState.ts 0, `case "candidateVoteReveal"` RoomScreen 1, `useRevealState` verdictScene 2, 기존 candidateVote·execVote 시험은 한 줄도 고치지 않고 통과.

### 브라우저에서 실제로 그려지는지 (정직한 보고)

**확인했다(살아 있는 방장 viewer, 봇 3 + 방장 = 4표 한 판).** `vite dev`(내가 띄운 npm exec PID 68718 과 vite PID 68765 만 종료함)를 켜고 스크래치패드의 일회용 스크립트(`verify-reveal.mjs`, 저장소에 넣지 않음)로 했다.
1. Node 소켓으로 테스트 방을 만들고 봇 3 + `testBotVote {exec: yes, pick: other}`(대기실에서만 가능) 뒤 discussion 까지 넘기고 소켓을 닫았다.
2. 헤드리스 Chrome 을 방장으로 붙이고 [테스트] → `다음 단계로 넘기기`로 execVote → [찬성] → 후보 선택 → 첫 좌석 선택 → 다시 넘기기로 공개에 들어갔다. 페이지 안에서 20ms 마다 화면 상태를 읽어 바뀔 때만 기록했다.
3. 관찰(390×844 와 360×640 모두 같은 전개): 헤더 `낮 · 투표 공개`/`1일차` → 첫 표 전 하단 `투표 공개`/`모두 4표` → 표마다 `{투표자}님이 {대상}님을 골랐어요`/`{k}번째 표 · 모두 4표`, 닿는 순간 칩 +1(1표씩 오르고 팝 칩은 앰버 후광, 다음 화살표 시작에 pop 이 plain 으로, 후광도 꺼짐), 유일한 선두는 lead 칩 + 앰버 후광 유지, 선두가 동률이 되면 후광 0·모두 plain, 끝 상태에서 하단 `봇가나다라님이 가장 많은 표를 받았어요`/`3표 · 곧 최후 변론이 시작돼요`와 sr-only polite 영역에 `…님이 3표로 가장 많은 표를 받았어요`(끝 전에는 빈 문자열). 좌석 버튼 0·하단 버튼 0·하단 래퍼 `aria-live=off`, 콘솔 오류 0. 스크린샷 4장(중간·끝 × 2 폭)을 눈으로 읽었다: 칩이 머리 위 가운데, 맨 뒤 자리 칩도 헤더 타이머 아래에 머물고, lead 칩은 앰버 면 + 큰 글자, 후광은 앰버, 두 줄로 접힌 하단 제목도 패널 안에 든다.

**확인하지 못한 것:** 동률·던진 표 0 상태의 브라우저 화면(봇 투표가 결정적이지 않아 만들지 못했다 — 단위 시험으로만 검증), 탈락 viewer·마피아 viewer·관전자 화면의 앰버·진홍 후광 합산(시험으로만), 모션 줄이기 설정에서의 팝 제거(CSS 규칙을 시험으로 고정했을 뿐 브라우저로 켜 보지 않음), 칩 팝 220ms 의 실제 시각 느낌(표본은 클래스 전환만 봄), 두 대의 폰이 정말 같은 순간에 같은 칩을 보는지(서버 시각 오프셋 계산은 단위 시험으로만 검증, 단말 두 대 비교는 안 함), 실제 폰·iOS 사파리. 이 단계의 배경(dusk 등)이 구워져 있는지는 이 계획 범위가 아니다(낮 장면 그대로 보인다).

## Deviations from Plan

### 자동 수정

없음 — 계획대로 진행했다. 아래는 계획 문구와 다르게 한 점이다.

### 계획과 다르게 한 것

- 훅 반환값에 계획의 `{ state, caption }` 외에 `plan` 을 더했다(끝 상태 읽기 문장과 plan 안정성 시험에 필요).
- `files_modified` 에 없던 `src/game/verdict.ts` 에 기본 하단용 문구(`revealIntroTitle`·`revealIntroHint`)를 더했다. 계획이 "첫 화살표 전엔 화면이 기본 제목을 쓴다"고만 했고 문구가 없어서, 새 문장을 만들지 않고 단계 안내(`투표 공개`)와 진행 안내의 `모두 {n}표` 조각을 재사용했다.
- 칩 위치는 `chipAnchor` 결과(left·top·width·height)를 인라인으로 주고, CSS 의 `min-width: 28px` 는 안전망으로 남겼다.

## 알려진 미해결

- **확인 대기(디자인 판단):** 유일한 선두를 "표 1개 이상이면 lead" 로 읽는 계획·UI-SPEC 규칙대로 구현하니, 첫 표가 닿는 순간 그 자리가 1표짜리 큰 칩(lead) + 앰버 후광이 되고, 다른 자리가 1표로 동률이 되면 lead 가 사라진다(브라우저에서 확인). 처음 한두 표에서 큰 칩이 깜빡이는 모습이 의도인지 사용자 확인이 필요하다. 바꾼다면 `useVerdictScene` 의 tone 규칙에 `표 ≥ 2` 같은 조건 한 줄이다(P-14 와 같은 묶음으로 묻는 것을 권한다).
- 화살표(움직이는 선·rAF)와 확정 두근(`beat` 톤·캐릭터 박동·진동)은 04-20 범위다. `beat` 는 지금 `lead` 와 같은 모양이다.
- `scripts/e2e/flows.mjs`·`browser.mjs`, `scripts/uat-test-bots.mjs` 는 여전히 4페이즈 흐름에 맞춰지지 않았다(`deferred-items.md`). 이 계획은 건드리지 않았다.

## Known Stubs

없음. 새 파일에 하드코딩된 빈 값·자리표시 문구가 없다. (defense·execution·ended 화면은 04-21~04-22 범위라 여전히 `연결 중…` 이다. 공개 4초가 끝나 defense 로 넘어가면 지금은 `연결 중…` 이 보인다 — 배포 금지 상태 유지.)

## Threat Flags

없음. 새 네트워크 경로·권한 경로·스키마 변경이 없다. T-04-53(공개 순서 재정렬)은 훅이 받은 배열 순서만 쓰고, 같은 득표 분포·다른 순서 입력이 다른 문구를 주는 시험으로, T-04-54(타이머 누수·과도한 재그리기)는 경계마다 정확히 한 번 그리고 단계 이탈·언마운트 때 타이머 수가 0 임을 단언하는 시험으로 완화를 확인했다.

## Self-Check: PASSED

- 파일: `src/net/useRevealState.ts`, `test/client/reveal.test.tsx` 존재. `mf-vchip` 가 DayTable.tsx·verdict.css 에 있다.
- 커밋: `0c1addc`, `d0eed15`, `53210d0`, `48b84c9` 모두 HEAD 의 조상.
