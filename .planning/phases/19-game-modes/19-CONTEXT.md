# Phase 19: 방장이 고르는 기본 마피아·확장판 - Context

**Gathered:** 2026-11-12
**Status:** Ready for planning

> 자동 진행(`/gsd-autonomous --from 19`). 사용자가 2026-11-12 에 "21페이즈까지 멈춤 없이, 새 결정은 추천안으로 진행하고 기록, 시안은 캔버스 2~3개 + 추천안 바로 구현"을 확정했다. 아래 결정은 모두 추천안 자동 채택이고, 사용자가 돌아와 한 줄씩 바꿀 수 있다.

<domain>
## Phase Boundary

방장이 대기실에서 판 종류("기본 마피아" / "확장판")를 고른다(결정 0081-6). 판 규칙은 전역 상수 `RULESET` 이 아니라 방 상태의 값이고 서버가 그 값을 읽는다. 기본 마피아는 심부름·목격 기록·밤 흔적 없이 역할 → 낮 토론·투표·처형 → 밤 얼굴 고르기 → 아침 발표만 있다. 확장판은 지금 v3.0 흐름 그대로다(새 하루 흐름은 21페이즈). 방장 전용 조작을 화면 왼쪽 세로 줄에 모으고 색으로 구별한다(ROADMAP 성공 기준 6).

이 페이즈에 넣지 않는 것: 실내 방·집(20), 등불·집 찾기·현장 조사(21), "정통 판"(배지·귓속말·결선 등 정치 장치 켜기, 0072 예약분).

</domain>

<decisions>
## Implementation Decisions

### 판 종류 모델과 규칙 값
- D-01: 판 종류는 `GameMode = "basic" | "extended"` 두 값이다. 기본값은 `"extended"`(0081-6). 화면 이름은 "기본 마피아", "확장판".
- D-02: `Ruleset` 에 할 일·증거 플래그를 더한다: `errand`(낮 심부름 단계), `witness`(목격 기록), `trace`(아침 밤 흔적). `basic` 은 셋 다 false, `extended` 는 셋 다 true. 기존 정치 장치 플래그(badge·whisper·pickTurn·runoff·showdown)는 두 판 모두 false 그대로다.
- D-03: 전역 `RULESET` 상수를 없앤다. `rulesetOf(mode)` 순수 함수 하나가 규칙을 만들고, 서버 흐름(tick·nomination·phases·room·view·bots)은 방 상태의 `mode` 에서 얻은 규칙을 인자로 받는다. 클라이언트는 `view.mode`(모두에게 같은 공개 값)에서 `rulesetOf` 로 얻는다. `RULESET` 을 읽던 곳(12개 파일)은 하나도 남기지 않는다(`grep RULESET` 0, 타입·함수 이름 제외).
- D-04: 저장된 방(mode 없음)은 불러올 때 `"extended"` 로 정규화한다(지금 흐름과 같다).

### 고르기·전달 규칙
- D-05: 고르기는 맵 선택(`mapPick`)과 같은 방식이다: `{ t: "modePick", mode }` 를 방장이 대기실·결과 단계에서만 보내고, 서버가 방장·단계·허용 값을 판정해 방 상태에 저장하며 모두에게 방송한다. 거절은 오류 프레임 없이 최신 state 한 프레임. (ROADMAP 성공 기준 1 의 "[시작] 때 서버로 간다"보다 이쪽이 낫다 — 참가자가 시작 전에 어떤 판인지 볼 수 있고, 다시 하기에서도 유지된다. 성공 기준 문구를 이 결정에 맞춘다.)
- D-06: 판이 진행 중에는 바꿀 수 없다. 다시 하기(rematch)는 지금 값으로 시작하고, 결과 단계에서 방장이 바꿀 수 있다.
- D-07: 참가자(방장 아님)는 대기실에서 판 종류를 읽기 전용 칩 하나로 본다. 고를 수 없다.

### 기본 마피아 판의 흐름과 화면
- D-08: `basic` 이면 `errand` 단계에 들어가지 않는다(낮 발표 → 바로 토론). 목격 기록·가짜 장소·흔적↔옷 표시·마지막 목격이 생기지 않고, 뷰에 관련 키가 실리지 않는다(값이 비어 있는 것이 아니라 키가 없다).
- D-09: `basic` 화면에는 [목격 기록] 단추, 심부름 표시·점, 아침의 흔적 표시가 없다. 자막 띠 문구는 심부름을 말하지 않는다.
- D-10: 튜토리얼은 확장판을 가르친다(0081-6). `basic` 을 고르면 방장 튜토리얼 스위치를 숨기고 서버도 `basic` + `tutorial: true` 시작을 튜토리얼 없이 처리한다. 첫 화면의 혼자 하기 튜토리얼은 그대로다.
- D-11: 봇은 방의 판 규칙을 따른다(`basic` 에서 심부름 행동 없음).
- D-12: 판 종류는 역할과 무관한 공개 값이다. 누설 검사는 두 판 모두에서 돈다(산 사람에게 남의 역할이 어떤 응답 모양으로도 가지 않는다).

### 방장 전용 조작의 자리 (성공 기준 6, 2026-11-12 사용자 요청)
- D-13: 대기실의 방장 전용 조작(판 종류, 맵 고르기, 봇, 튜토리얼 스위치)을 화면 왼쪽 세로 줄에 모은다. 참가자 공용 단추(오른쪽 열, 결정 0079)와 좌우로 나뉜다.
- D-14: 방장 전용 단추는 공용 단추와 색이 다르다. 디자인 토큰 안에서 램프 금빛 계열 테두리·아이콘으로 "방장 전용"을 나타내고 채도는 낮게 유지한다(낮도 마피아 분위기, 깔끔 담백한 UI).
- D-15: 글은 최소다(결정 0051). 단추는 아이콘 + 한 낱말 이하, 판 종류는 누르면 두 칸 선택(이름 + 한 줄 설명)이 뜬다.
- D-16: 시안은 Design 캔버스에 2~3개를 만들고 추천안을 바로 구현한다(사용자 확정). 오케스트레이터가 캔버스를 만들고 사본을 `design/v3.0/host-rail/` 에 둔다. 실행 에이전트는 사본을 본다.
- D-17: [시작] 단추의 자리와 모양은 바꾸지 않는다(가장 중요한 한 단추라 방장 줄에 넣지 않는다).

### 검증·배포
- D-18: 두 판 모두 E2E 한 판 완주(봇 포함) + 누설 검사. 바뀐 흐름만 돌리고, 6종 전체 회귀는 페이즈 끝에 한 번(로컬).
- D-19: 실행이 끝나면 minifia-v3 에 배포한다(`npm run deploy`, 계정 가드 우회 금지). 실기기 확인은 v3.0 끝 실테스트로 미룬다.

### Claude's Discretion
- 규칙을 인자로 넘기는 구체적 시그니처, 파일 나누기, 시험 이름.
- 방장 줄의 정확한 치수·순서(UI-SPEC 에서 정한다).
- 판 종류 한 줄 설명 문구(짧고 담백하게).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `shared/game/ruleset.ts` — `Ruleset` 인터페이스와 `BASIC_RULESET`, 전역 `RULESET`. 여기에 플래그·`rulesetOf` 를 더한다.
- `mapPick` 메시지(shared/protocol.ts, worker/room.ts, `src/components/v2/MapChip.tsx`) — 방장 전용 선택의 서버 판정·방송·거절 모양의 본보기.
- `src/components/v2/TutorialToggle.tsx`, `BotSheet.tsx`·`BotStepper.tsx`, `SideColumn.tsx`(오른쪽 열) — 방장 줄로 옮길 조작과 세로 열 본보기.
- `shared/game/errand.ts`·`errandFake.ts`, `tick.ts` 의 단계 표 — errand 진입 분기 지점.

### Established Patterns
- 게임 규칙·판정은 서버(방 Durable Object)가 정한다. 클라이언트는 받은 상태를 보여 주고 행동만 보낸다(결정 0002).
- 뷰는 역할별로 걸러 보낸다. 없는 값은 키를 싣지 않는다.
- E2E 사본 상수는 `test/unit/e2eContract.test.ts` 가 앱 값과 대조한다.

### Integration Points
- `RULESET` 을 읽는 곳: `src/game/whisperView.ts`, `badgeView.ts`, `resultText.ts`, `src/screens/GameMap.tsx`, `shared/game/nomination.ts`, `tick.ts`, `room.ts`, `phases.ts`, `view.ts`, `testTools.ts`, `bots.ts`, `worker/room.ts`.
- 대기실: `src/screens/Lobby.tsx`. 결과 단계 방장 조작: `src/screens/ResultScreen.tsx`.

</code_context>

<specifics>
## Specific Ideas

- 사용자 원문(2026-11-12): "봇 기능 버튼과 같은 방장 전용 기능은 좌측 세로에 놓는 게 구별도 되고 UI/UX 가 더 좋지 않을까요? (버튼 색도 방장 전용이라는 의미로 조금 다르게)"
- 원칙: 기능을 얹을 때 UI 는 깔끔·담백하게, 참가자라고 부른다('손님' 아님), 강조는 램프 빛 테두리.

</specifics>

<deferred>
## Deferred Ideas

- "정통 판"(배지·귓속말·순차 지목·결선·결전 켜기) — 0072 예약분, 이 선택과 별개.
- 판 종류별 튜토리얼(기본 마피아용 튜토리얼).

</deferred>
