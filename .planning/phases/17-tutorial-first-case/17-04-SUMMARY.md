---
phase: 17-tutorial-first-case
plan: "04"
subsystem: tutorial
tags: [tutorial, screen, tdd, tracer, focus-ring, host-band, inert, local-adapter]
status: complete

requires:
  - phase: 17-03
    provides: 대본(TUTORIAL_SCENES·TUTORIAL_LINES·tutorialView·tutorialStageView/Look·tutorialSnap·tutorialSuspectWalk·makeTutorialSend)과 정적 가드
  - phase: 17-02
    provides: say·hush·voice.host 목소리와 tut.* 효과음 13개
  - phase: 17-01
    provides: 튜토리얼 단계·메시지(이 화면은 서버 메시지를 쓰지 않는다)
provides:
  - "src/screens/TutorialScreen.tsx: TutorialScreen({ mode, onEnd, initialScene }) — 실제 GameMap(2~6)·WorldStage(1·7) 위에서 장면 1~7 재생, 로컬 어댑터만 사용, 장면 확장 자리 renderSceneLayer 와 장면 6 처리기 onPoint"
  - "src/net/useTutorialDirector.ts: 장면 시각표 예약 훅(효과음·문장·포커스 창·[다음]·자동 넘김, 장면 전환 시 취소 + hush)"
  - "src/net/useFixedRoomHeight.ts: RoomScreen 에서 옮긴 방 높이 훅(동작 동일)"
  - "FocusRing·TutorialHostBand·TutorialProgress·TutorialNext 부품과 src/styles/tutorial.css"
  - "HeadStack 이름표 \"나\" 접미 규칙, V2Icon chevronRight, HostBand useHostMetrics export"
affects: [17-05, 17-06, 17-07, 17-08, 17-09, 17-10]

actuals:
  tokens: 22000
  tasks: 3
  commits: 6
plan_head_before: 537e98e1f6b484f14c3411e664293effb60fd124
plan_head_after: 0e6ccd55209e9b7d35583df7337e3d61ce53d891

tech-stack:
  added: []
  patterns:
    - "가짜 view·위치는 장면에 들어갈 때 한 번만 만든다(tutorialView·tutorialSnap), 지도 장면 2~6 은 한 GameMap 이 view 만 바뀌고 무대 장면 1·7 은 WorldStage 를 직접 쓴다"
    - "허용 목록은 inert 를 DOM 에 직접 붙이는 방식(렌더·MutationObserver 마다 맞춤) — 허용 대상을 품은 컨테이너는 막지 않는 보호막이 있다"
    - "포커스 상자는 대상의 getBoundingClientRect 를 rAF 로 재고 직전과 같으면 상태를 바꾸지 않는다, 깜빡임은 opacity 키프레임 둘뿐이다"
    - "소리 큐는 getEngine() 에 직접 낸다 — 소리 켬·끔은 엔진이 따르고 말하는 시간(say 반환값)은 늘 같다"

key-files:
  created:
    - src/screens/TutorialScreen.tsx
    - src/net/useTutorialDirector.ts
    - src/net/useFixedRoomHeight.ts
    - src/components/v2/FocusRing.tsx
    - src/components/v2/TutorialHostBand.tsx
    - src/components/v2/TutorialProgress.tsx
    - src/components/v2/TutorialNext.tsx
    - src/styles/tutorial.css
    - test/client/tutorialScreen.test.tsx
    - test/client/focusRing.test.tsx
    - test/client/tutorialHostBand.test.tsx
    - test/client/tutorialGate.test.tsx
    - test/helpers/fakeTutorialStage.ts
  modified:
    - src/screens/RoomScreen.tsx
    - src/components/v2/HostBand.tsx
    - src/components/v2/HeadStack.tsx
    - src/components/v2/V2Icon.tsx
    - test/client/v2parts.test.tsx
    - test/client/icon.test.tsx

key-decisions:
  - "[다음]의 4px 램프 빛 깜빡임은 .tut-next 자기 테두리(::before, 같은 tut-ring 키프레임)가 맡고 FocusRing 묶음에는 넣지 않았다 — 같은 곳에 상자 둘이 겹쳐 깜빡이는 것을 막고 UI-SPEC T-5 의 '.tut-next 애니메이션 한 줄'을 그대로 따랐다"
  - "모션 줄이기의 정지 모양은 UI-SPEC 대로 테두리 불투명(1) + 번짐 중간값(.5)이다(계획 본문의 opacity .6 보다 UI-SPEC 계약을 따름)"
  - "장면 6 아래 패널(채팅 입력줄 포함)은 숨기지 않고 그리되 inert 로 눌림만 막는다(17-03 에서 넘어온 열린 항목 — 실제 게임 화면과 같은 틀 유지, T-10 '눌림 없음')"
  - "도윤은 화면 오른쪽 밖에서 들어온다 — 카메라가 나를 따라가는 follow 모드이고 PX_PER_UNIT 58.2·RIGHT=(0.707,0,−0.707) 로 투영하면 시작점이 화면 가운데에서 오른쪽 251px(폭 390 의 가운데 195 기준 x≈446)이라 화면 밖이다"
  - "사회자 띠는 DOM 에서 본문과 [다음] 뒤에 두었다(Tab 순서 [건너뛰기] → 허용 단추 → [다음] → 소리 단추). 위치는 absolute 와 z-index 가 정하므로 시각 순서는 같다"
  - "무대 장면(1·7)의 시계는 WorldStage 의 onReady 뒤에 시작한다. 지도 장면은 GameMap 이 onReady 를 내보내지 않아 장면에 들어간 시각부터 센다"

requirements-completed: []

duration: 16 min
completed: 2026-11-09
---

# Phase 17 Plan 04: 첫 사건 화면 Summary

TutorialScreen 하나가 대본을 읽어 실제 GameMap·WorldStage 위에서 장면 1~7 을 끝까지 재생하고(서버·소켓 요청 0건), 그 위에 깜빡이는 4px 포커스 상자·파형+자막 사회자 띠·진행 점과 [건너뛰기]·[다음]을 얹고, 허용 목록 밖은 inert 로 막았다.

## Accomplishments

- **트레이서(Task 1)**: 장면 3 [처리] → 로컬 어댑터(`makeTutorialSend`) → 0.7초 뒤 장면 4. 같은 틀로 1(4600ms 자동)·2(2600ms [다음])·4(3400ms [다음])·5·7 은 [다음], 6 은 도윤 이름표(정답만 다음으로, 오답은 아무 일 없음), 7 [다음] → `onEnd("done")`, [건너뛰기] → `onEnd("skipped")`. 시험이 재생 전체 동안 `useRoomConnection`·`fetch`·`WebSocket` 호출 0 을 단언한다.
- **FocusRing**: 대상 사각형을 rAF 로 재서 사방 8 키운 상자, 화면 안쪽 8 로 밀기, 0×0 이면 안 그림, selectors 여럿은 합집합, `extendDown`(이름표 + 몸)·`pill`. 키프레임 `tut-ring`·`tut-glow` 는 opacity 만, 1s, 모션 줄이기면 animation none.
- **사회자 띠(Task 2)**: `TutorialHostBand` — 막대 5개(aria-hidden)·한 줄(role=status)·시간 행 없음, 말하는 동안(`sayItems` totalMs) `data-speaking`, 소리가 꺼져도 같은 시간, 소리 단추는 띠 독. `useTutorialDirector` 가 장면 표대로 효과음·문장·포커스 창·[다음]·자동 넘김을 예약하고 장면이 바뀌면 예약 취소 + `hush` 한 번.
- **차단·포커스 이동(Task 3)**: 장면마다 머리·맵 입력면·심부름 타일 층·아래 패널·시트 층·(장면 6 밖) 이름표 층에 `inert`, [처리] 층(장면 3 밖은 차단)·이름표(장면 6)·[다음]·[건너뛰기]·소리 단추는 열림. 장면이 바뀌면 포커스가 [다음] / [처리] / 첫 이름표로 간다. `.is-call::before` 맥박은 튜토리얼 안에서 꺼진다.
- **부수 변경**: `useFixedRoomHeight` 를 RoomScreen 에서 옮김(RoomScreen 시험 그대로 초록), HeadStack 은 이름이 "나" 인 내 이름표에 접미를 붙이지 않음, `V2Icon` chevronRight, `HostBand` 머리 측정 훅 export.

## 17-03 에서 넘어온 열린 항목 결과

- **도윤이 화면 오른쪽 밖에서 들어오는가**: 코드·좌표 계산으로 확인했다. 장면 3·4 의 카메라는 follow(나 (4.4, 3.0) 중심)이고 도윤 시작점 (5.6, −1.9)은 상대 (+1.2, −4.9) → 화면 오른쪽 성분 ≈ 4.31 단위 × 58.2 = 251px. 폭 390 의 가운데 195 에 더하면 x≈446 으로 화면 밖(폭 360 에서도 밖)이다. 끝점은 내 오른쪽 약 66px. 실제 화면의 눈 확인은 17-09 E2E·끝 실테스트 몫으로 남긴다.
- **장면 6 채팅 입력**: 숨기지 않고 그리되 아래 패널 전체를 inert(눌림 없음)로 둔다. 가짜 view 에 `me.chat` 이 없어 입력줄은 말할 수 없는 모양으로 그려진다.

## Task Commits

1. **Task 1 RED:** `91915576` — `test(17-04): 첫 사건 화면 트레이서 실패 시험`
2. **Task 1 GREEN (tracer):** `1ee3680c` — `feat(17-04): 첫 사건 화면 트레이서 — 장면 재생·포커스 상자·진행 점`
3. **Task 2 RED:** `21129f0a` — `test(17-04): 사회자 파형 띠·장면 시각표 실패 시험`
4. **Task 2 GREEN:** `c96ee6e7` — `feat(17-04): 사회자 파형 띠·장면 시각표·웅얼 목소리`
5. **Task 3 RED:** `d81240bd` — `test(17-04): 허용 목록 밖 차단 실패 시험`
6. **Task 3 GREEN:** `0e6ccd55` — `feat(17-04): 허용 목록 밖 차단·포커스 이동`

## TDD Gate Compliance

- **Task 1 RED** (`91915576`): `npx vitest run test/client/tutorialScreen.test.tsx test/client/focusRing.test.tsx test/client/v2parts.test.tsx test/client/icon.test.tsx` — 35개 실패. 실패 이유는 `"src/screens/TutorialScreen.tsx 모듈이 있어야 한다: expected null not to be null"`·`"src/components/v2/FocusRing.tsx 모듈이 있어야 한다"`·`"src/styles/tutorial.css 가 있어야 한다"`, 이름표는 `expected '나 (나)' to be '나'`, 아이콘은 `ICONS[name]` 없음. (동적 import 경로를 변수 + `@vite-ignore` 로 두어 모듈 부재가 파일 전체 오류가 아닌 단언 실패가 되게 했다.)
- **Task 1 GREEN:** 7파일 256개 통과, `npm run typecheck` 종료 코드 0.
- **트레이서 게이트:** Task 1 `<verify>` 는 자동 항목뿐(`HUMAN_VERIFY_MODE` 기본 end-of-phase, 자동 모드 아님)이라 재실행해 통과를 확인하고 `Tracer verified end-to-end — expanding` 으로 Task 2 에 들어갔다.
- **Task 2 RED** (`21129f0a`): `tutorialHostBand.test.tsx`·`tutorialScreen.test.tsx` 에서 19개 실패(`TutorialHostBand.tsx 모듈이 있어야 한다`, 장면 2·3·4·1 의 소리·문장 시각, 장면 전환 hush, 말하는 시간 3개). 이미 통과한 항목은 Task 1 의 [다음] 시각 1개뿐.
- **Task 2 GREEN:** 4파일 80개 통과(hostBand 회귀 포함), typecheck 0. 중간에 `ui.tap` 시험이 실패했다 — 화면이 `useSound` 로 신호 처리기를 걸어 시험 처리기를 덮었기 때문(시험을 마운트 뒤 바인딩으로 고침, 생산 코드 문제 아님).
- **Task 3 RED** (`d81240bd`): `tutorialGate.test.tsx` 19개 중 9개 실패(inert 대상 4묶음, 장면 6 이름표 층, 포커스 이동 5개).
- **Task 3 GREEN:** 2파일 49개 통과, typecheck 0, `npm test` 전체 통과(273 파일 통과·6 건너뜀, 7820 시험).
- REFACTOR: 없음.

## Acceptance Criteria

| 기준 | 결과 |
|------|------|
| Task 1: TutorialScreen·FocusRing·tutorial.css 존재 | PASS |
| Task 1: `grep -c makeTutorialSend src/screens/TutorialScreen.tsx` ≥ 1 | PASS (3) |
| Task 1: `useFixedRoomHeight` 가 새 파일에 있고 RoomScreen 에 `function useFixedRoomHeight` 가 0 | PASS (1, 0) |
| Task 1: `tutorialScreen`·`focusRing` 시험 통과 | PASS |
| Task 2: TutorialHostBand·useTutorialDirector 존재, `grep -c data-tutorial-host` ≥ 1 | PASS (1) |
| Task 2: `hostBand.test.tsx` 그대로 통과 | PASS |
| Task 3: `tutorialGate.test.tsx` 존재, `grep -c inert src/screens/TutorialScreen.tsx` ≥ 1 | PASS (7) |
| Task 3: `npm test` 전체 통과 | PASS |
| 계획 `<verification>`: Task 1~3 automated 초록, typecheck·전체 시험 | PASS |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 시험의 `ui.tap` 신호 처리기가 화면의 소리 훅에 덮임**
- **Found during:** Task 2 GREEN
- **Issue:** `bindSignals` 는 처리기가 하나뿐이라, 화면이 `useSound` 로 건 처리기가 시험이 먼저 건 것을 대체했다(생산 동작은 맞다 — 화면이 소리를 받는다).
- **Fix:** 시험이 화면을 마운트한 뒤에 `bindSignals` 를 건다.
- **Files modified:** test/client/tutorialScreen.test.tsx
- **Commit:** c96ee6e7

### 계획과 다르게 정한 곳(결정으로 기록)

- [다음]의 깜빡임을 FocusRing 묶음이 아니라 `.tut-next` 자기 테두리로 했다(위 key-decisions). 계획 본문은 둘 다 적었는데 같은 곳에 이중으로 깜빡이는 것을 피했다. 시험 영향 없음.
- 모션 줄이기의 정지 모양을 UI-SPEC 대로 테두리 불투명 + 번짐 .5 로 했다(계획 본문 `opacity .6`).
- 시험용 가짜 무대를 `test/helpers/fakeTutorialStage.ts` 로 뺐다(게이트 시험이 같은 DOM 을 씀). 계획 파일 목록 밖의 보조 파일 하나.

**Total deviations:** 1 auto-fixed (Rule 1, 시험 코드) + 설계 정리 3. **Impact:** 범위 확장 없음.

## Issues Encountered

- 전체 `npm test` 첫 실행에서 `v2Marker.test.tsx` 의 홈 화면 빌드 표식 시험 1개가 실패했다. 그 파일을 단독·관련 파일과 함께 돌리면 통과하고, 전체를 다시 돌리자 273 파일 모두 통과했다 — 부하 아래 비동기 렌더 타이밍 흔들림으로 보이고 이 계획의 변경과 무관하다(홈 화면을 건드리지 않음).
- `npx tsx` 등 새 도구는 쓰지 않았다.
- `git grep` 위생 검사: 이 계획이 건드린 파일에서 새 히트 없음.

## Known Stubs

- `renderSceneLayer(scene)` 는 아직 `null` 을 돌려준다 — 17-05·17-08 이 장면별 겹침 층(목격·증거·투표·정체 공개, 오프닝·직업 카드)을 채우는 계획된 확장 자리다(이 계획의 목표를 막지 않음). 장면 6 오답 처리(`onPoint` 의 오답 분기)도 같다 — 지금은 아무 일도 하지 않고 17-05 가 연출을 채운다.

## Threat Flags

없음. 새 표면은 로컬 상태와 DOM 뿐이고 계획의 위협 모델 안이다: T-17-10(실제 연결로 새는 send)은 로컬 어댑터만 주는 구조 + 재생 전체 동안 `useRoomConnection`·`fetch`·`WebSocket` 호출 0 시험 + 정적 가드로 닫았다. T-17-11(FocusRing rAF)은 직전과 같으면 상태를 바꾸지 않고 애니메이션이 opacity 뿐이라 닫았다(장면 3~6 fps 는 17-09 가 잰다). T-17-SC 는 설치 없음.

## Next Phase Readiness

17-05·17-08 은 `TutorialScreen` 의 `renderSceneLayer(scene)`·`onPoint(seat)`·`TutorialHostBand` 의 `shake`(오답 흔들림)·`useTutorialDirector` 의 `onCue` 만으로 장면 연출을 얹을 수 있다. 17-06(첫 화면 진입)·17-07(함께 진행)은 `TutorialScreen({ mode, onEnd, initialScene })` 계약만 쓴다. 요구사항 TUT-03·04·05 는 같은 ID 를 선언한 뒤 계획(17-05·07·08·09·10)이 남아 있어 아직 완료 표시하지 않았다(`requirements.ready-ids` 가 모두 blocked).

## Self-Check: PASSED

- 파일 존재: TutorialScreen.tsx·useTutorialDirector.ts·useFixedRoomHeight.ts·FocusRing.tsx·TutorialHostBand.tsx·TutorialProgress.tsx·TutorialNext.tsx·tutorial.css·시험 4개·fakeTutorialStage.ts — FOUND
- 커밋: 91915576, 1ee3680c, 21129f0a, c96ee6e7, d81240bd, 0e6ccd55 — 현재 브랜치(v3) 조상으로 확인
