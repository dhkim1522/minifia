---
phase: 24-suspect-note-tutorial
plan: "03"
subsystem: ui-suspect-mode
tags: [suspect-note, ui, hook, game-map, name-tag-chip, tutorial-props]
status: complete
requires: ["24-01"]
provides:
  - "src/net/useSuspect.ts — { visible, used, mode, targets, disabled, toggleMode, off, pick, said } (서버 구간 근처 판정·250ms 히스테리시스)"
  - "SendKind 에 suspect"
  - "src/components/v2/SuspectButton.tsx — [의심] 48 원 아이콘 단추(data-suspect-btn·data-suspect-stuck)"
  - "V2Icon postit · GamePanel.chatTrailing · NameTag 의심 칩(data-suspect-count)"
  - "GameMap 배선: 오류 분기(배지 앞)·귓속말 배타·이름표 버튼(data-suspect-tag)·data-suspect-mode·data-suspects·붙인 사람 role=status"
  - "GameMap 튜토리얼 prop bottomExtra·timeless (기본값 무영향)"
affects: [24-05, 24-08, 24-09, 24-10]
actuals:
  tokens: 21000
  tasks: 3
  commits: 6
plan_head_before: b934faa72d3ab72867ae4a214bed81748541bac8
plan_head_after: 45e104e3f4c9aaf6c2c07322027c0cf028c54ef1
tech-stack:
  added: []
  patterns:
    - "useWhisper 모양 복제 — 모드 훅은 보내고 모드만 끝낸다(낙관 그림 없음), 서버 view 가 확인"
    - "근처 판정은 store.segOf + Date.now()+offset (서버 구간, 내 예측 위치 아님)"
key-files:
  created:
    - src/net/useSuspect.ts
    - src/components/v2/SuspectButton.tsx
    - test/client/suspectUi.test.tsx
    - test/client/suspectWhisper.test.tsx
  modified:
    - src/net/useSendGuard.ts
    - src/components/v2/V2Icon.tsx
    - src/components/v2/HeadStack.tsx
    - src/components/v2/TopToast.tsx
    - src/components/WorldStage.tsx
    - src/screens/GamePanel.tsx
    - src/screens/GameMap.tsx
    - src/styles/v2.css
    - test/client/icon.test.tsx
    - test/client/gameMap.test.tsx
key-decisions:
  - "표식 data-suspect-tag·data-suspect-notice 를 위해 WorldPick 에 선택 속성 attr, TopToast 에 선택 속성 marker 를 더했다(계획 파일 목록 밖, 기본값 무영향)"
  - "칩 표시 조건(남 4장 이상·나 1장 이상)은 NameTag 가 suspectChipShown 으로도 지키고 GameMap 도 같은 함수로 값을 거른다(이중 방어, 임계는 한 곳)"
  - "timeless 는 GameMap 안의 머리(MapHeader)에만 마감 없는 view 사본을 준다 — 사회자 띠(HostBand)는 RoomScreen 소속이라 튜토리얼 쪽 계획이 맡는다"
metrics:
  completed: 2026-11-17
---

# Phase 24 Plan 03: [의심] 단추·모드 Summary

낮 토론 입력줄 맨 오른쪽에 [의심] 48 원 아이콘 단추를 놓고, 누르면 근처 산 사람 이름표만 깜빡이는 버튼이 되는 모드(`useSuspect`)와 GameMap 배선·이름표 칩을 만들었다. 근처 판정은 서버 구간(`store.segOf`)이고 붙었다는 확인은 서버 view 뿐이다(낙관 그림 없음).

## 수행한 일

| 작업 | 커밋 | 내용 |
|------|------|------|
| T1 RED | 2697f8ad | useSuspect 시험 18건(모듈 없음으로 로드 실패) |
| T1 GREEN | 50a2bd70 | useSuspect + SendKind "suspect" |
| T2 RED | a9bad3d1 | SuspectButton·GamePanel chatTrailing·칩·postit 아이콘 시험 |
| T2 GREEN | 5a4c15fa | SuspectButton, V2Icon postit, GamePanel chatTrailing, NameTag 칩, v2.css |
| T3 RED | 1ef348c7 | GameMap 배선 시험 19건 실패(단추 보임·모드·근처 0명·거절 알림·시트·표식·timeless·bottomExtra) |
| T3 GREEN | 45e104e3 | GameMap 배선, WorldPick.attr, TopToast marker, 귓속말 배타 시험 |

## 구현 요점

- **useSuspect:** 보이는 동안만 250ms 마다 `suspectTargets(view, segOf, Date.now()+offset, prev)` 를 다시 재고(모드와 무관 — 단추 비활성 판정도 같은 값), 눌린 순간에는 한 번 더 바로 잰다. `toggleMode()` 는 `"on"|"off"|"deny"|null` 을 돌려준다(근처 0명 → deny, 끊김·안 보임 → null). `pick(seat)` 는 근처 집합에 있을 때만 `suspect` 를 한 번 보내고 `guard.mark("suspect")`·`emitSignal({kind:"tap"})`·모드 끝. 소켓이 닫혀 못 보냈으면(false) 기억도 모드 끝도 없다. 종료: 토론 이탈·내 사망(visible 거짓)·일차 변화·Esc. 대상이 죽으면 `targets` 가 `view.players` 로 즉시 걸러진다. 서버가 `me.suspectTo` 를 새로 확인하면 보내기 기억을 지우고 붙인 사람에게만 `said` 안내를 만든다.
- **SuspectButton:** 글 없음·이모지 없음. 이름 "의심 붙이기"/"의심 옮기기"(`data-suspect-stuck` + `.mv-chat__will-dot`), `aria-pressed`, `aria-disabled`. 근처 0명이면 `onDeny`, 끊김·열린 시트면 무반응. `mousedown` 기본 동작은 막지 않고 클릭에서 포커스된 입력칸을 `blur()`(P24-4, 입력 중 글은 부모가 쥐어 남는다).
- **GameMap:** 오류 분기는 귓속말 바로 뒤, 배지 `take()` 앞(`peek()==="suspect"` 줄 348 < `take()==="badge"` 줄 354). `BAD_MESSAGE` 만 알림("가까이 가야 붙여요", 2.5초, `postit` 아이콘, deny 소리), 다른 코드는 기억만 지운다. 모드 중 `pick`(group "의심 붙이기", label "{닉} 님에게 의심 붙이기", `attr: "data-suspect-tag"`)·`callOn` 꺼짐·이름표 `blink`·`hintOverride`("의심 가는 사람을 눌러요"). 귓속말 단추는 먼저 `suspect.off()`, [의심] 단추는 먼저 `whisper.off()`, 유언·쪽지 시트도 `suspect.off()`.
- **표식:** `[data-game-stage]` 에 `data-suspect-mode="on|off"`, e2e 문맥에서만 `data-suspects="좌석:장수,…"`(0장 생략), 알림에 `data-suspect-notice`, 이름표 버튼에 `data-suspect-tag`, 칩에 `data-suspect-count`, 붙인 사람 안내에 `data-suspect-said`(role=status, 화면 밖).
- **튜토리얼 prop:** `bottomExtra`(스테이지 아래 여백에 더함 — 키보드 높이를 프레임마다 읽는 `bottom` getter 는 보존), `timeless`(머리에 `phaseEndsAt/phaseDurationMs: null` 사본, 스테이지에는 원래 view). 둘 다 안 주면 기존 시험이 그대로 초록.

## 검증 (실제로 돌린 것)

- RED 증거: T1 모듈 없음 로드 실패 / T2 icon 2건 실패·suspectUi 로드 실패 / T3 시험 19건 실패 확인 후 GREEN.
- `npx vitest run --project client`(전체): 78 파일 통과, 2712 통과 / 77 건너뜀.
- `npx vitest run --project unit`(전체): 4405 통과 / 99 건너뜀(한 번 `ruleset.test` 의 옛 모드 낱말 감시가 내 시험 변수명 `modeOf` 를 잡아 `suspectModeAttr` 로 바꿈).
- `npm run typecheck`: 종료 0(GREEN 커밋마다). `npm run tokens:check` 통과. 계획 acceptance grep 충족: `useSuspect(` 1, `bottomExtra` 6, `timeless` 3, `data-suspect-mode` 1, `"suspect"`(useSendGuard) 1, `postit`·`chatTrailing`·`data-suspect-count` 1 이상, SuspectButton 의 hex 0, 분기 순서 348 < 354.
- 커밋 전 위생 grep 결과 없음.

## 계획과 다르게 한 것 / 편차

**1. [Rule 3 - 표식을 위한 선택 속성] `WorldPick.attr`·`TopToast.marker` 추가.** 계획 파일 목록에는 없지만 must_haves 의 `data-suspect-tag`(이름표 버튼)·`data-suspect-notice`(알림)는 이 두 컴포넌트가 속성을 받아야 달 수 있었다. 둘 다 선택 prop 이고 기본값 무영향이다(`WorldStage.tsx` 3줄, `TopToast.tsx`). 24-09 의 `data-suspect-tag` grep 은 GameMap 쪽 문자열로 충족된다.

**2. [칩 CSS 위치] `world.css` 대신 `v2.css`.** 칩은 기존 직업 주장 배지(`.mv-claim`)와 같은 이름표 안 절대 위치 요소라 같은 파일에 뒀다. `world.css` 는 바꾸지 않았다. 새 hex·토큰 없음(토큰 변수와 14px 글자 크기만).

**3. [칩 조건 이중 방어] 계획 Task 2 본문은 "칩은 값이 있으면 그린다", behavior 는 NameTag 가 남 3장 이하는 칩 없음으로 적혀 서로 달랐다.** NameTag 도 `suspectChipShown(count, me)` 로 지키고(시험도 그렇게 씀) GameMap 도 같은 함수로 값을 거른다. 임계(4)는 HeadStack 의 한 상수.

**4. [timeless 범위] 사회자 띠는 GameMap 이 아니라 RoomScreen 소속이라** `timeless` 는 GameMap 의 머리에만 적용된다(계획 문구의 "사회자 띠" 부분은 튜토리얼이 자기 띠를 그릴 때 마감 없는 view 를 주면 된다 — 24-08/09 이월).

**5. [추가] `data-suspect-said` role=status 안내**(UI-SPEC P24-8)와 별도 시험 파일 `test/client/suspectWhisper.test.tsx`(기본판은 `RULES.whisper` 꺼짐이라 귓속말 배타를 보려면 규칙을 켠 채 따로 봐야 해서 `vi.mock` 으로 켰다).

**6. RED 커밋은 타입체크가 빨갛다.** RED 시험이 아직 없는 모듈·prop 을 import 하므로(T1·T2·T3) RED 커밋 시점의 `npm run typecheck` 는 실패하고, GREEN 커밋마다 초록이다.

## 돌리지 못한 것 / 다음 계획으로 (이월)

- **360×560 스크린샷 확인(D-31, Pitfall 10)과 입력칸 폭 160 실측**은 하지 않았다(24-10 몫). 계산상 입력줄 안쪽 328 − [동작 48 + 보내기/유언 48 + 의심 48] − 간격 8×3 = 160 이고 보내기가 나타나면 유언 단추가 빠져 입력칸 폭은 그대로다(`onWill && !showSend`). `hintOverride` 때문에 의심 모드 머리가 시간 링 있는 `LegacyMapHeader` 로 바뀌는 점은 귓속말 선례 그대로 두었다 — 어긋나면 24-10 이 안내 한 줄만 바꾸는 경로로 고친다.
- **키보드 포커스 상태에서 [의심] 누르기(backstop)**는 jsdom 에서 `activeElement` 가 입력칸을 놓는 것까지만 봤다. 실기기 키보드 닫힘·패널 복귀는 확인하지 못했다(UAT 몫).
- 3D 종이·`__mfWorld.suspectNotes()`·기록 카드는 24-05/06 몫이다. 칩·`data-suspects` 는 공개 view 값만 쓴다.
- **표식 이름(24-09 E2E 가 쓴다):** `data-suspect-btn`·`data-suspect-stuck`·`data-suspect-mode`·`data-suspect-tag="{seat}"`·`data-suspect-notice`·`data-suspects`·`data-suspect-count="{n}"`·`data-suspect-said`. 모드 이름표 버튼은 기존 `data-pick` 도 함께 달고 있다.
- **GameMap prop 의 뜻(24-08 튜토리얼):** `bottomExtra={60}` = 튜토리얼 띠 묶음만큼 스테이지 아래 여백 가산. `timeless` = 머리 시간 링·시간 행 제거(스테이지·연출은 원래 view). 실제 판(RoomScreen)은 넘기지 않는다.
- 알려진 한계: 서버가 첫날을 막으므로 화면이 켠 대상이 서버에서 거절될 수 있는 틈은 시계 오차·구간 도착 지연뿐이고 92% 문턱이 흡수한다(24-01 이월).

## Known Stubs

없음.

## Threat Flags

없음 — 계획의 T-24-09(화면 판정은 표시용, 서버 `stickNote` 가 재판정)·T-24-10(닉네임은 React 텍스트 노드·aria 값만, innerHTML 없음)·T-24-11(`pick` 이 같은 렌더에 모드를 끄고 `useSendGuard` 가 "suspect" 를 기억, 서버 600ms 간격)을 그대로 따랐다.

## Self-Check: PASSED

- 파일 존재: src/net/useSuspect.ts, src/components/v2/SuspectButton.tsx, test/client/suspectUi.test.tsx, test/client/suspectWhisper.test.tsx 확인.
- 커밋 존재: 2697f8ad, 50a2bd70, a9bad3d1, 5a4c15fa, 1ef348c7, 45e104e3 가 HEAD 의 조상임을 확인.
