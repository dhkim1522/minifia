# Phase 5: 분위기와 캐릭터 - Context

**Gathered:** 2026-10-29
**Status:** Ready for planning (화면이 걸린 페이즈 → `/gsd-ui-phase 5` 를 `/gsd-plan-phase 5` 보다 먼저)

<domain>
## Phase Boundary

화면이 무거운 분위기로 이어지고, 플레이어마다 서로 다른 캐릭터를 받으며, 세로 폰 화면에서 처음 하는 사람도 지금 할 일을 알 수 있게 한다. 요구사항은 LOOK-01, CHAR-01, UX-01, UX-02, CONN-03.

이 논의에서 **범위를 줄였다.** 캐릭터 움직임은 요구사항이 아니라 초기 희망 사항(결정 0008, ROADMAP 노트)이어서 하지 않는다. 대기실·낮·투표·결과 화면의 캐릭터 8종은 이미 구현되어 있어 새로 만들지 않고 점검한다. 이 페이즈의 실제 일은 **점검 + Wake Lock + 안내 문장 빈칸 채우기 + 분위기 보강**이다. 서버 규칙·단계 길이·와이어는 바꾸지 않는다.
</domain>

<decisions>
## Implementation Decisions (사용자 승인: 2026-10-29)

### 캐릭터 (CHAR-01)
- **D-01** 캐릭터 **움직임은 이번 페이즈에서 하지 않는다.** 정지 그림 8종(`public/characters/table/fig1~8`)을 유지한다. 밋밋하다는 반응이 플레이테스트(6페이즈)에서 나오면 v1.1 후보로 올린다. 프레임 PNG·Rive·Lottie 도입 결정(결정 0008의 미룬 부분)은 이 결정으로 닫고, 결정 0008 은 "5페이즈에서 움직임은 하지 않기로 함" 으로 보완한다.
- **D-02** **새 캐릭터 에셋은 만들지 않는다.** CHAR-01 은 이미 충족되어 있다: 테이블 인물 8종이 서로 다르고(넥타이 색 = 자리 색), 대기실(`Lobby`→`DayTable`)·낮·투표(`DayTable`)·결과(`ResultScreen` 의 `Figure` + 닉네임)에 나온다. 이 페이즈는 **8명 방에서 겹침 없이 나오는지, 5~8명 방에서 닉네임이 모든 화면에 붙는지 점검표로 확인**하고 빠진 곳만 고친다.
- **D-03** 캐릭터가 게임 능력에 영향을 주지 않는다는 점과 자리 번호 = 외형 배정(좌석 번호 규칙)은 **바꾸지 않는다**(기존 규칙 유지).

### 단계 전환 분위기 (LOOK-01)
- **D-04** 목표는 "밤·아침·처형 같은 단계가 바뀔 때 분위기가 **눈에 띄게** 달라진다"이다. 기존 것(배경 7장 크로스페이드, 밤·낮 시작 문구, 4페이즈 처형 연출)은 그대로 쓴다. 먼저 **단계별 전환 점검표**(대기실→배정→역할 확인→낮→투표 구간→처형→밤→아침→결과)를 만들어 어느 전환이 밋밋한지 찾고, 밋밋한 곳을 아래 보강으로 채운다.
- **D-05** **보강 후보를 같이 넣는다**(사용자 확정): 밤 화면의 **비네팅**(가장자리 어둡게, CSS), 아침 전환 때 **밝아지는 연출**(CSS), 단계 전환 때 **짧은 진동**(`navigator.vibrate`, 4페이즈 `verdictScene` 에서 이미 쓰는 방식 재사용, 미지원 기기·모션 줄이기에서는 생략). 값은 UI-SPEC 단계에서 정하고 상수는 한 곳에 둔다.
- **D-06** **소리·파티클·Rive/Lottie 는 하지 않는다**(요구사항 밖, 에셋·용량 부담). 모션 줄이기 설정에서는 새 연출도 페이드 또는 생략(기존 `useReducedMotion` 규칙).
- **D-07** 색 규칙은 4페이즈 D-33 을 유지한다: 앰버 = 낮의 공개 투표, 진홍 = 마피아·밤 암살(+마피아 승 결과). 새 연출이 이 규칙을 깨지 않는다. 후광 최대 3개(결정 0030), 글자 크기 14/16/24/36 만.

### 안내 문장 (UX-01)
- **D-08** 모든 단계 화면에 **지금 할 일 한 문장 + 남은 시간**이 보여야 한다. `PhaseId` 전체(lobby, assigning, roleReveal, dayAnnounce, claim, discussion, night, morning, execVote, candidateVote, candidateVoteReveal, defense, execution, ended)와 **역할별 시점**(마피아·경찰·의사·시민·관전자)을 곱한 점검표를 만들고, 빠진 칸은 문장을 채운다. 시간이 의미 없는 단계(대기실, 결과)는 "시간 없음"으로 명시해 요구사항에서 예외로 기록한다.
- **D-09** 새 문장은 짧은 존댓말로 쓰고(예: "마피아가 누구일지 골라 주세요"), 다른 사람의 역할이 드러나는 문장은 쓰지 않는다. 문구 상수는 한 곳에 모은다(기존 `PHASE_INTRO` 등과 같은 방식).

### 화면 규격 (UX-02)
- **D-10** 폭 360·390·430 세로에서 **스크롤 없이** 지금 할 일과 메시지 영역이 함께 보여야 한다. 앱 폭은 이미 430px 제한(`base.css`)이고 PC 브라우저에서는 가운데 폰 폭이다. 이 페이즈는 전 단계 × 3폭을 **E2E 로 검사**(스크롤 높이 = 화면 높이, 안내 문장·메시지 영역 가시성)하고 어긋난 단계를 고친다. 결과 화면은 기존대로 내부 스크롤을 허용한다(4페이즈 결정).
- **D-11** PC 브라우저 가운데 폰 폭도 E2E 한 흐름으로 확인한다(예: 1280폭 창에서 앱 폭 ≤ 430, 가운데).

### 화면 꺼짐 방지 (CONN-03)
- **D-12** 게임 중 `navigator.wakeLock.request("screen")` 를 요청한다. **게임 중** = 방에 들어온 뒤부터 결과 화면 전까지(대기실 포함 여부는 구현이 정한다). 탭이 가려지면 시스템이 해제하므로 `visibilitychange` 로 다시 요청한다. 지원하지 않거나 거부되면(iOS 구버전, 저전력 모드) **조용히 생략**하고 게임은 정상이다. 오류를 사용자에게 보이지 않는다.
- **D-13** 클라이언트 전용(서버·와이어 불변). 단위 테스트는 `navigator.wakeLock` 모의(있음·없음·거부·재요청)로, E2E 는 미지원 환경에서 게임이 정상 도는지 확인한다.

### Claude's Discretion
- 비네팅 세기, 아침 밝아짐 길이, 진동 패턴·길이, 안내 문장의 정확한 문구.
- Wake Lock 을 걸고 푸는 정확한 시점과 훅 구조.
- 전환 점검표의 형식과 어느 전환을 보강할지(점검 결과로 정한다).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 요구사항·로드맵
- `.planning/ROADMAP.md` — 5페이즈 목표·성공 기준 5개·노트
- `.planning/REQUIREMENTS.md` — LOOK-01, CHAR-01, UX-01, UX-02, CONN-03

### 결정 기록
- `docs/decisions/0008-2-5d-look.md` — 2.5D, 캐릭터 움직임 미룸(이 페이즈 D-01 로 닫음)
- `docs/decisions/0003-classic-rules-dark-mood.md` — 어두운 분위기
- `docs/decisions/0029-background-set-v2.md`, `0031-background-v3-and-assets.md`, `0032-indoor-background-v4.md`, `0033-indoor-v2-dim-halo.md` — 배경 세트·장면
- `docs/decisions/0030-visual-bundle.md` — 후광·말풍선·왕관·단계→장면 규칙
- `docs/decisions/0037-execution-screens.md` — 4페이즈 화면 결정(색 규칙 D-33, 글자 크기, 모션 줄이기)
- `docs/decisions/0006-player-immersion.md` — 몰입 기준
- `docs/decisions/0018-online-first-offline-capable.md` — 온라인 기준

### 디자인
- `design/characters/README.md`, `design/characters/ASSET_SPEC.md`, `design/characters/manifest.json` — 캐릭터 규격
- `design/backgrounds/README.md`, `BACKGROUND_SPEC.md` — 배경 규격
- `design/references/notes.md` — 방향 참고(어둡지만 경쾌한 밤, 진홍 포인트)
- `.planning/phases/04-execution-verdict/04-UI-SPEC.md` — 현재 화면 규격(글자 크기·간격·색 규칙)
- `docs/product.md`, `docs/architecture.md`

### 코드
- `src/game/scenes.ts` — `PHASE_SCENE`, `PHASE_INTRO`, 장면 크로스페이드 상수
- `src/net/useReducedMotion.ts`, `src/screens/verdictScene.tsx` — 모션 줄이기·진동 사용 예
- `src/components/DayTable.tsx`, `src/components/Figure.tsx`, `src/screens/ResultScreen.tsx`, `src/screens/Lobby.tsx` — 캐릭터 노출 위치
- `src/styles/base.css`(앱 폭 430), `src/styles/tokens.css`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Figure`/`DayTable`: 캐릭터 8종을 이미 모든 주요 화면에서 그린다. 새 컴포넌트가 필요 없다.
- `PHASE_SCENE`/`PHASE_INTRO`/`SceneIntro`: 단계→배경 규칙과 시작 문구. 분위기 보강은 이 표와 CSS 에 붙인다.
- `useReducedMotion`, 진동 호출(`verdictScene.tsx`): 새 연출의 모션 줄이기·진동 규칙에 재사용.
- E2E(`scripts/e2e/`): 3폭 × 흐름 구조에 스크롤·안내 문장 검사를 더한다.

### Established Patterns
- 단계별 분기를 화면에 흩뿌리지 않고 상수 표 한 곳(`scenes.ts`)에 둔다.
- 글자 14/16/24/36, 간격 4의 배수, 앰버/진홍 색 규칙, 후광 최대 3개.
- 화면 변경은 시안(승인) → UI-SPEC → 구현 순서(메모리: 시안은 물어보고 만든다).

### Integration Points
- Wake Lock 은 방 화면 루트(`RoomScreen`)의 단계 수명에 연결한다. 서버·와이어 변경 없음.
- 안내 문장은 각 단계 화면의 헤더/안내 줄에 연결된다.

</code_context>

<specifics>
## Specific Ideas

- 사용자는 "추가하면 좋은 것도 같이 넣어 달라"고 했다 → D-05 의 비네팅·아침 밝아짐·전환 진동을 이 페이즈에 포함한다.
- 사용자는 임의로 논의 영역이나 범위를 부풀리는 것을 원하지 않는다. 요구사항·성공 기준에 없는 것은 먼저 필요성을 설명하고 묻는다.

</specifics>

<deferred>
## Deferred Ideas

- 캐릭터 움직임(숨쉬기·말하기·프레임 PNG·Rive/Lottie) — 플레이테스트 후 v1.1 후보
- 소리·효과음·파티클 — 요구사항 밖
- 실기기 확인(모션·iOS `backdrop-filter`·Wake Lock 동작)은 모든 개발이 끝난 뒤 한 번에 진행(사용자 결정 2026-10-29)

</deferred>

---

*Phase: 05-atmosphere-character*
*Context gathered: 2026-10-29*
