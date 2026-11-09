# Phase 17: 튜토리얼 "첫 사건" - Research

**Researched:** 2026-11-09
**Domain:** 클라이언트 로컬 대본 재생(실제 게임 화면·3D 엔진 재사용) + 방 Durable Object 의 "튜토리얼 후 진행" 단계 게이트 + Web Audio 합성 목소리
**Confidence:** HIGH — 핵심 결론은 이 세션에서 저장소 코드를 직접 열어 확인했다. 연출 세부(램프 투영·몸 상자)는 MEDIUM.

> 이 페이즈에는 CONTEXT.md 가 없다. 잠긴 결정은 결정 0078(1~9)과 승인된 `17-UI-SPEC.md` 의 "기본값 기록" T-1~T-23 이다(위임 기본값이라 사용자가 한 줄씩 바꿀 수 있지만, 계획은 이것을 잠금으로 본다). 외부 패키지를 새로 들이지 않아 웹 조사·패키지 검증 도구는 쓰지 않았고, `inert` 지원만 웹으로 확인했다.

<user_constraints>
## User Constraints (from 0078 + 17-UI-SPEC, CONTEXT.md 없음)

### Locked Decisions

결정 0078 "결정" 절 원문(1~9):

1. **"첫 사건" 미니 에피소드**(60~90초 안팎, 고정 제한 아님). 플레이어는 시민으로 작은 사건 하나를 겪는다. (1) 오프닝: 밤이 오고 램프가 꺼지고 비명이 난다. 아침에 빈자리가 보이고 사회자가 "이 중에 마피아가 있습니다"라고 말한다. 기존 3D 맵·캐릭터·조명을 쓴다. (2) 심부름(직접 조작): 장소에 가서 [처리]한다. 가는 길에 수상한 사람을 목격하면 배경이 흐려지고 그 사람에게 조명이 간다. (3) 아침 증거: 흔적 조각이 나오고, 같은 옷을 입은 사람의 이름표가 빛나며, 목격과 이어진다. 이것이 게임의 재미 포인트다. (4) 투표(직접 조작): 이름표를 눌러 지목하면 도장이 찍히고, 정체 공개와 "정답" 축하 연출이 나온다. (5) 직업 카드: 마피아·의사·경찰·시민 카드가 역할 확인처럼 뒤집히고, 직업마다 대표 애니메이션 하나와 한 줄 설명이 나온다. (6) 마무리: 첫 화면에서 들어왔으면 [방 만들기]·[참가]로 돌아가고, 함께 진행이면 본게임으로 들어간다. [건너뛰기]는 늘 누를 수 있다.
2. **포커스 조명**(→ 8 이 수정): 중요한 대상만 남기고 배경을 흐리고 어둡게 한다. 대상에는 램프 빛 링을 둔다. 낮은 명도·채도의 마피아 분위기는 지킨다.
3. **진입로 두 곳**: 첫 화면(방 만들기·참가 전)에서 혼자 한다. 방장이 켜고 끈다. 켜면 모두 한 뒤 본게임이 시작되고, 끄면 생략한다. 기본값은 0077 그대로 첫 판 켜짐, 다시 하기 꺼짐이다. 대기실의 [튜토리얼] 단추(0077)는 첫 화면 진입으로 바꾼다.
4. **소리·목소리**: 사회자 목소리는 글자마다 음절을 합성하는 "웅얼 목소리"로 한다. 지금 Web Audio 합성 체계 안에서 만들고, 외부 파일은 쓰지 않는다. 오프닝·증거 연결·도장·정답·카드 뒤집기에는 새 효과음 레시피를 쓴다. 실제 한국어 낭독(TTS·녹음)은 나중으로 미룬다. 진동은 앱 전환 때 넣는다.
5. **디자인 먼저**: Design 캔버스에서 승인(완료 — `design/v3.0/first-case/`).
6. **페이즈 분리**: 튜토리얼은 17페이즈. 실테스트는 16·17 을 배포한 뒤 한 번에 한다.
7. **실제 게임 화면 그대로**: 3D 맵(시계탑 광장·재즈 바), 실제 3D 캐릭터·의상, 이름표, 심부름 타일, 투표 화면, 역할 확인의 직업 카드 그림 등 실제 부품을 쓴다. 서버 대신 로컬 대본이 가짜 방 상태를 차례로 넣어 장면을 재생한다. 튜토리얼에만 더하는 것은 깜빡이는 테두리, 사회자 말풍선·목소리, [다음], 정답 연출뿐이다.
8. **포커스는 깜빡이는 테두리**: 배경 흐림·어둠·손가락 포인터는 쓰지 않는다. 대상에 램프 빛 테두리(4px)를 두르고 1초 주기로 깜빡인다.
9. **사회자 = C 목소리 파형 + 자막 띠**(인물·확성기 없음, 14페이즈 자막 띠와 같은 모양에 파형 막대 5개). **첫 화면 진입 = A 큰 카드**(한 번 본 뒤 작은 단추로 줄어든다), 문구 "튜토리얼 진행".

결과 절 원문: "함께 진행의 서버 부분(방 설정 켜기·끄기, 모두 끝내거나 시간이 다 되면 시작, 끝 메시지 하나)은 17 에서 다시 정한다."

UI-SPEC "기본값 기록" T-1~T-23(요약 — 원문은 `17-UI-SPEC.md`): T-1 끝까지 보면 마무리 카드·건너뛰기는 곧장 첫 화면 / T-2 큰 카드는 튜토리얼을 한 번 시작했거나 방 만들기·참가를 한 번 누른 뒤 작은 단추(저장소 `minifia.tutorial.seen`) / T-3 큰 카드 강조는 놋쇠 숨 쉬는 번짐(4px 깜빡임 아님) / T-4 방장 스위치 줄 "튜토리얼 후 진행"·보조 "모두 1분 보고 시작", 첫 판 켜짐·다시 하기 꺼짐, 패널 +76 / T-5 [다음] 56 원, 4px 램프 빛 깜빡임 / T-6 혼자 하기에 시간 제한 없음, 함께 진행 `TUTORIAL_MS` = 150초 / T-7 사회자 문장은 시안 그대로 / T-8 오답 첫 번째에 띠 흔들림·두 번째부터 도윤 한 곳만 깜빡임(`WRONG_HINT_AFTER = 2`) / T-9 가짜 인원 서연(피해자)·도윤(`noir`)·민준(`detective`)·지호(`reporter`)·하린·나(`coat`) / T-10 틀 단추는 그리되 누르지 않음(소리 단추만 동작) / T-11 정체 공개 막은 `--scrim` / T-12 램프 꺼짐 개수는 보이는 맵 램프 수 / T-13 소리가 꺼져도 파형은 움직임 / T-14 심부름 3곳 `mail`·`fountain`·`lamp`, 처리 반경 안에서 시작 / T-15 직업 카드 2×2 / T-16 [건너뛰기] 누르는 영역 44 / T-17 기다림 팁 2장(공간 모자라면 숨김) / T-18 진홍 예약은 세 곳만 / T-19 서버 쪽 값(방 설정 `tutorial`, 단계 `tutorial`, `view.tutorial {done,total,endsAt}`, `view.me.tutorialDone`, 끝났음 메시지 한 가지, 봇·끊긴 사람은 끝낸 것으로 셈, 튜토리얼 중 view 에 `me.role` 없음) / T-20 혼자 하기는 저장 안 함, 함께 진행 재접속은 `me.tutorialDone` 으로 분기 / T-21 [처리]·[다음]·[건너뛰기] 소리는 기존 `ui.tap`, 새 id 12 + 음절 1 / T-22 큰 카드는 방 코드 없는 `Home` 에만 / T-23 진행 점 7(장면 1~7).

### Claude's Discretion
- 서버의 정확한 상태 기계(메시지 모양·역할 배정 시점·완료 판정 시점) — 0078 결과·UI-SPEC "남은 위험"이 계획 단계로 넘김.
- 가짜 `RoomView` 주입 경로(입력 통로·액션 어댑터) — UI-SPEC "남은 위험"이 계획 단계로 넘김.
- 램프 꺼짐 연출의 투영 방식(T-12), `tut.fanfare` 5음 처리(4음 축소 또는 2레시피), 목소리 믹스 −24 dB 안팎 조정.
- 테스트·E2E 구성, 요구사항 ID 부여.

### Deferred Ideas (OUT OF SCOPE)
- 실제 한국어 낭독(TTS·녹음), 햅틱·진동(앱 전환 때), 새 외부 소리 파일.
- 사회자 인물 그림(바텐더)·시계탑 확성기·표정·입 움직임, 배경 흐림·어둠·손가락 포인터·스포트라이트 원뿔, 첫 방문 자동 시작(Entry C), 대기실 [튜토리얼] 단추·연습 7단계·코치 막.
- 장면 3 화살표, 투표 단계의 변론·찬반·처형 흐름(튜토리얼은 지목·정체 공개만), 새 글자 크기·새 토큰, 튜토리얼 진행의 서버·브라우저 저장(`minifia.tutorial.seen` 한 값 제외).
</user_constraints>

<phase_requirements>
## Phase Requirements (제안 — 로드맵에 TBD, 계획 단계에서 REQUIREMENTS.md·ROADMAP.md 에 추가)

기존 REQUIREMENTS.md 문체(한 줄, "~한다")와 ID 규칙(`HOST-01`, `ERRAND-08`, `DEPLOY-04`)을 따른다.

| ID | Description | Research Support |
|----|-------------|------------------|
| TUT-01 | 첫 화면(방 코드 없는 화면)의 큰 카드 "튜토리얼 진행"으로 혼자 첫 사건을 시작하고, 끝나거나 [건너뛰기]하면 첫 화면으로 돌아온다. 한 번 본 사람에게는 작은 단추로 줄어든다 | 「Architecture」Home 통합, 로컬 대본 재생, T-1·T-2·T-22 |
| TUT-02 | 방장이 대기실에서 "튜토리얼 후 진행"을 켜고(첫 판 켜짐·다시 하기 꺼짐) 시작하면 모두 튜토리얼을 마친 뒤(또는 150초가 지나면) 역할 배정으로 넘어가고, 끄면 바로 시작한다 | 「Server design」, `tutorial` 단계, `tutorialDone` 메시지, 봇·끊긴 사람 셈 |
| TUT-03 | 첫 사건이 오프닝 → 심부름·목격 → 아침 흔적↔같은 옷↔목격 → 이름표 투표·정답 → 직업 카드 4종 순으로 이어지고, 직접 누르는 곳마다 대상에 램프 빛 4px 깜빡임 테두리가 있으며 사회자는 파형+자막 띠로 말한다(배경 흐림·포인터 없음) | 장면 표, GameMap·WorldStage 재사용, FocusRing, TutorialHostBand |
| TUT-04 | 사회자 웅얼 목소리와 새 효과음이 Web Audio 합성으로만 나고(외부 파일 0), 소리 설정·소리 단추와 모션 줄이기를 따른다 | 「소리」 절, `voice.syl`·`tut.*` 레시피, `runScript` |
| TUT-05 | 튜토리얼은 서버 게임 상태·역할 값을 읽지도 바꾸지도 않는다. 혼자 하기는 네트워크 요청 0건, 함께 진행은 끝났음 메시지 한 가지만 보낸다 | `GameMap` 에 실제 `send` 를 주지 않는 구조, 누설 검사 확장 |
| DEPLOY-05 | 17페이즈가 누설 검사를 새 view 필드(`view.tutorial`·`me.tutorialDone`)·새 단계·새 메시지·새 서버 전용 이름까지 넓힌 채 `minifia-v3` 에 배포된다(DEPLOY-04 와 같은 방식) | `test/worker/leak.test.ts` 확장, 배포 가드 |
</phase_requirements>

## Summary

튜토리얼은 **새 엔진이 아니라 기존 화면 부품을 로컬 대본이 먹이는 얇은 연출 층**이다. `GameMap`(`src/screens/GameMap.tsx:209`)과 `WorldStage`(`src/components/WorldStage.tsx:226`)는 모두 props(`view`·`store`·`chat`·`send`)만 받는 순수 화면이라 소켓 없이도 돈다. 이미 `test/client/errandScreen.test.tsx` 가 가짜 view 로 이 화면들을 렌더하는 선례다. 따라서 가장 깨끗한 이음매는 **`GameMap` 에 실제 연결의 `send` 를 절대 주지 않고, 튜토리얼이 만든 로컬 `send` 어댑터(`errand`·`point` 만 해석해 대본을 전진시키고 나머지는 버림)를 주는 것**이다. 이 구조 하나로 TUT-05 "함께 진행도 끝났음 외 메시지 0건"이 구조적으로 보장된다.

서버 쪽은 `mapPick`(방 설정)이 아니라 **`start` 메시지에 `tutorial?: boolean` 을 싣고**, `beginGame` 이 `assigning` 대신 새 단계 `tutorial` 로 보내며, 클라이언트가 끝났음 메시지(`tutorialDone`) 하나를 보내고, 전원 완료 시 `applyEndDiscussion` 과 똑같은 패턴(`tick({...state, phaseEndsAt: now})` + `afterTransition`)으로 조기 종료한다. 서버 기본값은 꺼짐이라 기존 워커 테스트 약 30곳(`send(room.host, { t: "start" })`)과 E2E(`[data-lobby-start]` 클릭)가 그대로 돈다 — 단, **E2E 가 쓰는 테스트 방에서는 클라이언트 스위치 초기값을 꺼짐으로 해야** 모든 게임 흐름이 150초 튜토리얼에 갇히지 않는다.

가장 위험한 곳은 (1) `GameMap` 이 밤 단계에서 밤 얼굴 목록을 그리고 `errand`/`morning` 단계의 시작 카드·흔적 구간이 `phaseEndsAt` 에 묶여 있는 점(장면 1·7 은 `WorldStage` 직접, 장면 3·5 는 가짜 마감 시각 주의), (2) `RoomScreen` 이 `tutorial` 단계에서도 실제 `HostBand`·알림음·소리 감독을 돌리는 점, (3) 소리 테스트가 57/50 개수·버스·간격 규칙을 못 박고 있고 `src/audio/**` 정적 가드가 `chat|mafia|whisper` 낱말과 import 를 제한하는 점, (4) 방장 패널 +76 이 실제 CSS 간격(10px)과 맞지 않는 점(+74)이다.

**Primary recommendation:** `src/game/tutorialScript.ts`(장면 표·`TUTORIAL_CAST`·가짜 `RoomView` 생성) + `TutorialScreen`(solo/together 공통, 장면 2~6 은 `GameMap`·장면 1·7 은 `WorldStage` 에 로컬 `store`·`chat`·`send` 어댑터를 먹임) + 서버 `tutorial` 단계(`start.tutorial` → `tutorialDone` → 전원 완료 시 조기 `tick`)로 가고, 모든 `Record<PhaseId>` 컴파일 오류·소리/누설/E2E 고정 테스트를 Wave 0 에서 먼저 갱신한다.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 첫 사건 장면 재생(대본·타이머·가짜 view) | Browser / Client | — | 0078-7 — 서버는 장면을 모른다. 서버 게임 상태 불변(TUT-05) |
| 3D 맵·캐릭터·이름표·증거 카드 렌더 | Browser / Client | — | 기존 `src/world`·`WorldStage` 재사용 |
| 포커스 테두리·파형 띠·[다음]·정답 연출 | Browser / Client | — | 순수 연출, `transform`·`opacity`·`box-shadow` 만 |
| 웅얼 목소리·`tut.*` 효과음 합성 | Browser / Client | — | Web Audio 합성(외부 파일 0), 기존 엔진·레시피 표에 등록 |
| 첫 화면 큰 카드 ↔ 작은 단추(`minifia.tutorial.seen`) | Browser / Client | — | 브라우저 저장소 한 값, 서버 무관 |
| "튜토리얼 후 진행" 스위치 값 | Browser / Client | API / Backend | 스위치는 호스트 로컬 상태, 값은 `start` 메시지로 서버에 전달(서버는 방장·단계만 판정) |
| `tutorial` 단계 게이트(전원 완료·150초) | API / Backend (방 DO) | — | 규칙·시각은 서버(결정 0002). 끝났음은 본인만 표시, 완료 수는 공개 값 |
| 역할 비공개 유지 | API / Backend | Browser | 서버가 `tutorial` 단계 view 에 역할을 싣지 않고(`revealsOwnRole: false`), 클라이언트 튜토리얼은 역할 값을 읽지 않는 상수만 쓴다 |
| 저장소(DO) 쓰기 | Database / Storage | — | 사람 1명당 `put("room")` 1회(≤8). 결정 0076 쓰기 예산에 영향 거의 없음 |
| 정적 에셋 | CDN / Static | — | 새 에셋 없음 — `public/` 의 의상·역할 카드·배경 재사용 |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react / react-dom | 19.3.1 | 화면·`inert` 속성 | 기존 스택. react-dom 이 `inert` 를 처리함을 확인 |
| three | 0.186.1 (고정, 결정 0055) | 3D 맵·캐릭터(`WorldStage` 경유) | 직접 호출 없음 — `WorldStage`·`WorldStore` 로만 접근 |
| zod | 4.6.7 | `start`·`tutorialDone` 스키마 | `shared/schemas.ts` 의 `strictObject` 패턴 |
| vitest | 4.1.12 | unit / client(happy-dom 21.0.4) / worker(`@cloudflare/vitest-plugin` 1.4.6) 3 프로젝트 | 기존 |
| playwright-core | 1.64.1 + 시스템 Chrome | `scripts/e2e` | 기존 |

[VERIFIED: /Users/dhkim1522/personal/minifia/package.json — dependencies·devDependencies 블록]

### Supporting
| 항목 | 위치 | Purpose | When to Use |
|------|------|---------|-------------|
| `WorldStore` | `src/world/store.ts` | 로컬 위치 사본. `applyFrame(snap/move)` 로 내 위치·도윤 걷기를 넣는다 | 튜토리얼 전용 인스턴스를 새로 만든다(RoomScreen 의 것과 분리) |
| `ChatStore` | `src/net/chatStore` | 장면 6 패널의 시스템 줄("투표 시작") | 로컬 인스턴스 + `addSystem` |
| `getEngine()` / `unlockAudio()` | `src/audio/unlock.ts` | 엔진 싱글턴·카드 탭 동기 잠금 해제 | 목소리·효과음은 `engine.play`/`runScript` |
| `useSound` | `src/audio/useSound.ts` | 소리 단추 상태(`SoundView`)·제스처 resume·가시성 | solo 모드에서 `view: null` 로 쓴다 |
| `useReducedMotion` | `src/net/useReducedMotion.ts` | 모션 줄이기 | FocusRing·연출 분기 |
| `useCountdown` | `src/net/countdown` | 기다림 화면 시간 막대 | `view.tutorial.endsAt` |
| `sameOutfitSeats` / `TRACE_MARK` | `src/game/traceMark.ts` | 같은 옷 표시·조각 색(실제 판정 함수) | 가짜 view 의 `players[].look` + `day.evidence.trace` 로 GameMap 이 알아서 계산 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 로컬 `send` 어댑터 + `GameMap` 재사용 | `GameMap` 을 복제해 튜토리얼 전용 화면을 만든다 | 복제는 실제 화면과 어긋난다(0078-7 위반)·유지 비용. 채택 안 함 |
| `start` 메시지에 `tutorial` 실음 | `mapPick` 같은 별도 설정 메시지 + `view.tutorialOn` 방송 | 별도 메시지는 손님이 값을 볼 수 있으나 UI-SPEC T-4 는 "손님은 값을 보지 않고"라 했고 새 view 키·누설 경로가 늘어난다 |
| 새 단계 `tutorial` | 단계는 그대로 두고 `assigning` 에 머무는 플래그 | UI-SPEC T-19 가 단계 `tutorial` 로 잠갔고 `phaseEndsAt`·알람·재접속이 단계 표 한 곳을 따른다 |

**Installation:** 새 패키지 없음. `npm install` 불필요.

**Version verification:** 위 버전은 `package.json` 에서 직접 읽었다(레지스트리 조회 불필요 — 신규 의존성 0).

## Package Legitimacy Audit

신규 외부 패키지가 없다. `gsd_run query package-legitimacy check` 대상 없음.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (없음) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
[첫 화면 Home] --큰 카드 탭(같은 틱 unlockAudio, seen 저장)--> [TutorialScreen mode="solo"]
                                                                   │  끝/[건너뛰기] → Home 으로(닉네임·코드 상태 유지, T-1 마무리 카드)
[대기실 Lobby(방장)] --[시작] {t:"start", tutorial:true}--> [방 DO]
        │                                                       │ startGame→beginGame: phase "tutorial", phaseEndsAt=now+150s (역할은 서버 상태에만, view 에 없음)
        │                                                       ▼
        │                              state 프레임(view.phase="tutorial", view.tutorial{done,total,endsAt}, me.tutorialDone)
        ▼                                                       │
[RoomScreen renderPhase "tutorial"] ----------------------> [TutorialScreen mode="together"]
                                                                │
          ┌─────────────────────────────────────────────────────┘
          ▼
 tutorialScript(장면 표·TUTORIAL_CAST·타이머·소리 큐) ──> useTutorialDirector
      │  scene n → { fakeView, allow, say(key), sfx cues }
      │  로컬 WorldStore(snap/move 로 내 위치·도윤 걷기) + 로컬 ChatStore("투표 시작")
      ▼
 장면 2~6: <GameMap view=fake store chat send=localSend canSend/>   (실제 헤더·이름표·심부름 타일·증거 카드·투표 이름표)
 장면 1·7: <WorldStage view=fake scene=직접 만든 SceneLook/> + OpeningFx / TutorialRoleCards  (밤 패널·헤더 없음)
 위에 얹는 층: FocusRing(대상 DOM 사각형 4px 깜빡임) · TutorialHostBand(파형 5 + 자막) · TutorialProgress · TutorialNext · TutorialReveal
      │ localSend(msg): {t:"errand"} → 장면 3 완료 / {t:"point"} → 정답·오답 판정 / 그 밖 → 버림(소켓 접근 없음)
      ▼
 장면 7 [다음] 또는 [건너뛰기]
      ├─ solo: onEnd(skipped)  → Home
      └─ together: connection.send({t:"tutorialDone"}) → TutorialWait(view.tutorial) → 서버가 전원 완료/150초에 assigning → roleReveal(기존)
 서버: handleTutorialDone → markDone → 전원 완료? → tick({…phaseEndsAt: now}) + afterTransition (applyEndDiscussion 패턴)
```

### Recommended Project Structure
```
shared/game/
├── tutorial.ts            # 순수: tutorialProgress(state)·markTutorialDone·allTutorialDone·TUTORIAL_MS
├── phases.ts              # PHASE_DEFS 에 tutorial 행(+ TUTORIAL_MS)
├── room.ts                # RoomState.tutorialPassed?, beginGame(opts.tutorial)
├── view.ts                # view.tutorial, me.tutorialDone (tutorial 단계에서만)
shared/protocol.ts, schemas.ts   # PhaseId +"tutorial", start.tutorial?, {t:"tutorialDone"}, RoomView.tutorial?, MyInfo.tutorialDone?
worker/room.ts            # handleStart(tutorial) / handleTutorialDone / 연결 변화 시 전원 완료 재검사
src/game/tutorialScript.ts   # 장면 표·TUTORIAL_CAST·사회자 문구 키·가짜 RoomView 빌더 (역할 낱말·실제 닉네임 금지)
src/screens/TutorialScreen.tsx (+ src/components/v2/Tutorial*.tsx)   # 위 인벤토리 부품들
src/audio/voice.ts        # say(text): runScript('voice.host', 글자별 voice.syl 항목) — 문구는 인자로만 받는다
src/audio/recipes.ts      # SFX_IDS +13, RECIPES·SCREEN_COUNTERPART 행
src/styles/tutorial.css   # 새 파일(진홍 예약 확대를 이 파일 안에서만, 기존 no-crimson 스캔을 건드리지 않음)
test/…                    # 아래 Validation Architecture
```

### Pattern 1: 로컬 `send` 어댑터 (SC-5 의 구조적 보증)
**What:** `GameMap` 의 `send` prop 으로 튜토리얼이 만든 함수만 준다. 실제 `connection.send` 는 `TutorialScreen` 의 끝났음 호출 한 곳에서만 쓴다.
**When to use:** 장면 2~6 의 모든 `GameMap` 렌더.
**Example:**
```typescript
// 구조 예시(저장소 값은 아래 「검증된 값 인용」). GameMap 이 보내는 것은 {t:"errand"}(GameMap.tsx:747)와 {t:"point",target}(GameMap.tsx:543) 둘이 전부가 아니라
// 이동 {t:"move"}·채팅·typing 등도 있다 — 어댑터는 알아듣는 둘만 해석하고 나머지는 true 를 돌려주되 아무 일도 하지 않는다.
function makeLocalSend(onErrand: () => void, onPoint: (seat: number) => void) {
  return (msg: ClientMessage): boolean => {
    if (msg.t === "errand") onErrand();
    else if (msg.t === "point") onPoint(msg.target);
    return true; // false 를 주면 WorldStage 가 cancelMove 등 "못 보냄" 분기를 탄다 — 조용히 삼키려면 true
  };
}
```
**주의:** 걷기 입력은 어댑터가 아니라 **CSS/`inert` 로 먼저 막는다**(Pitfall 7). 어댑터의 `move` 무시는 이중 방어선이다.

### Pattern 2: 가짜 `RoomView` 빌더 + 장면별 `phaseEndsAt`
**What:** 장면마다 `RoomView` 한 벌을 순수 함수로 만든다. 필드는 `GameMap`·`useErrandPos`·`sameOutfitSeats`·`traceWindowOf` 가 읽는 것만 채운다.
**Example:**
```typescript
// 장면 3: me.errand = { places: ["mail","fountain","lamp"], done: [] }, map: "plaza", phase: "errand", phaseEndsAt: null  ← startCardOn 이 false(ErrandStartCard 억제)
// 장면 5: phase "morning", day.morning = { eliminated: 서연좌석, trace: "redCloth", seen: { seat: 도윤좌석, place: "lamp" } },
//         day.evidence = { trace: "redCloth", seen: { seat: 도윤좌석, place: "lamp" } }, phaseEndsAt = Date.now() + 4000 (흔적 구간 MORNING_TRACE_MS 5000 안 → traceOn 즉시 참)
// 같은 옷 표시는 서버가 아니라 players[].look(noir) 와 trace(redCloth) 의 함수 — 도윤만 같은 옷(TRACE_OF_OUTFIT noir→redCloth)
```

### Pattern 3: 서버 조기 종료는 `applyEndDiscussion` 을 그대로 본뜬다
```typescript
// worker/room.ts:915-926 패턴(원문은 「검증된 값 인용」): 순수 규칙 함수가 상태를 바꾸고, 완료 조건이 서면
// this.room = tick({ ...next, phaseEndsAt: now }, now, cryptoRandInt); await this.afterTransition(prev, now);
// 아니면 this.room = next; await this.persistAndBroadcast();   // 같은 값이면 같은 객체 → 저장·전송 없음
```

### Pattern 4: 목소리는 새 엔진이 아니라 `runScript` + 레시피 하나
`voice.host` 키로 글자마다 `{ at, id: "voice.syl", cents }` 항목 배열을 만들어 `engine.runScript("voice.host", items)` 한 번 호출한다. 같은 key 는 이전 예약을 취소하므로 UI-SPEC "새 문장 우선"이 공짜로 맞다. 음높이 이동은 `PlayOpts.cents`(= 1200·log2(배율))로 준다. `src/audio/voice.ts` 는 문구를 **인자로만** 받는다(Pitfall 11).

### Anti-Patterns to Avoid
- **`GameMap` 에 실제 연결의 `send`/`canSend` 를 넘기는 것:** 튜토리얼 중 걷기·채팅이 서버로 간다(TUT-05 위반).
- **장면 1·7 을 `night` 단계 `GameMap` 으로 그리는 것:** `GamePanel` 이 밤 얼굴 목록(`FaceList`)과 `[유언]` 줄을 그린다(`GamePanel.tsx` night 분기). 빈 패널·헤더 없는 연출이 필요한 장면은 `WorldStage` 를 직접 쓴다.
- **튜토리얼 대본에 실제 닉네임·실제 의상·`view.me.role` 을 섞는 것:** T-9·SC-5 위반, 누설 시험 실패.
- **`.is-call` 과 FocusRing 이중 깜빡임을 그대로 두는 것:** 같은 대상에 두 신호가 겹친다(Pitfall 9).
- **`RoomScreen` 의 `useSound`/`HostBand` 를 `tutorial` 단계에도 그대로 돌리는 것:** 띠 두 개·알림음 중복(Pitfall 4).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 3D 맵·캐릭터·걷기 | 새 canvas/애니메이션 | `WorldStage` + 로컬 `WorldStore.applyFrame({k:"snap"/"move"})` | 실제 런타임이 걷기·등장을 그린다. 도윤 걷기는 `move` 구간(`MOVE_SPEED` 1.8 단위/초)으로 충분 |
| 같은 옷 표시·조각 색 | 하드코딩 이름표 테두리 | `GameMap` 의 `sameOutfitSeats`·`TRACE_MARK` 경로(가짜 `look`+`evidence`) | 실제 판정 함수라 이후 규칙이 바뀌어도 어긋나지 않는다 |
| 증거 카드·득표 배지·위 알림·진행 점 | 새 마크업 | `EvidenceCard`(GameMap 이 흔적 구간에 그림)·`VoteBadge`·`TopToast`·`ErrandDots` | UI-SPEC 인벤토리: 수정 없음 |
| 목격 기록 카드 | 새 카드 | `RecordCard`(단독 컴포넌트)를 TutorialScreen 이 `.mf-game__record` 자리에 직접 렌더 | `GameMap` 은 `discussion` 에서만 그린다(Pitfall 3) |
| 목소리 스케줄·취소 | `setTimeout` 체인 | `engine.runScript(key, items)` | 같은 key 취소·동시 노드 예산(`NODE_BUDGET`)·소리 끔·잠금이 엔진에서 처리된다 |
| 소리 켬/끔·잠금 | 새 저장·UI | `useSound`·`SoundButton`·`prefs` | 사용자 설정 한 곳 |
| 깜빡임·모션 줄이기 판정 | 직접 matchMedia | `useReducedMotion` + CSS `@media (prefers-reduced-motion)` | 기존 훅 |
| 눌림·포커스 차단 | 투명 가림막 div 로 클릭 가로채기 | `inert` 속성(컨테이너 단위) + `pointer-events` | 키보드 포커스까지 막는다. react 19·`@types/react` 가 `inert` 를 지원 |
| 브라우저 저장 | 새 `localStorage` 코드 | `src/net/session.ts` 의 `read/write/remove`(메모리 대체 포함) | 사파리 개인 모드 예외 처리가 이미 있다 |

**Key insight:** 이 페이즈의 코드량 대부분은 "연출 층 + 서버 게이트 + 레시피 13개"이고, 화면 부품은 거의 새로 그리지 않는다. 새로 그리는 것은 UI-SPEC 인벤토리의 `FocusRing`·`TutorialHostBand`·`TutorialProgress`·`TutorialNext`·`OpeningFx`·`TutorialReveal`·`TutorialRoleCards`·`TutorialToggle`·`TutorialWait`·`TutorialEntry` 뿐이다.

## Seams · 핵심 질문별 조사 결과

### Q1. 로컬 가짜 상태로 실제 화면을 돌리는 이음매

**읽는 값(확인함):** `GameMap` 은 `view`·`store`·`chat`·`send`·`canSend`·`offset`(+선택 prop)만 받는다(`GameMap.tsx:209`). 소켓·`useRoomConnection` 을 직접 부르지 않고, 거절 알림은 선택 prop `onEvent` 로만 받는다. 위치는 `store.positionOf(seat, serverNow)` 로 읽고(`useErrandPos.ts`), 장소 좌표는 `placeCentersOf(view)` 가 `view.map`+`me.errand` 로 `mapOf(view.map).places` 에서 읽는다(`errandView.ts`). 같은 옷은 `players[].look` + `day.evidence.trace` 의 함수다(`traceMark.ts`). 그래서 **가짜 `RoomView` + 로컬 `WorldStore`/`ChatStore` + 로컬 `send`** 면 소켓 없이 돈다. `WorldStage` 는 더 낮은 층으로 `scene?: SceneLook`(`WorldStage.tsx:238`)을 직접 받는다 — `SceneLook`·`SeatLook`(`show`·`ghost`·`opacity`…)은 순수 타입이라 튜토리얼이 직접 만들 수 있다.

**장면별 권장 렌더:**

| 장면 | 렌더 | 이유 |
|------|------|------|
| 1 오프닝 | `WorldStage`(직접) + `OpeningFx` | 밤 `GameMap` 은 밤 패널·긴장 비네트·`data-night-dark` 를 그린다. 서연이 사라지는 연출은 `SeatLook.opacity`(직접 만든 `scene`)로 가능 |
| 2 아침 | `GameMap`(phase `morning`) | 실제 헤더 "아침"·패널. 서연 `alive:false` → 일반 viewer 에게는 좌석이 안 그려진다(`visibleSeats`) |
| 3 심부름 | `GameMap`(phase `errand`, `phaseEndsAt: null`) | `panelless`(패널 없음)·`ErrandDots`·타일·[처리] 가 실제 부품. `phaseEndsAt:null` 이면 `startCardOn` 이 false 라 2초 시작 카드가 안 뜬다 |
| 4 목격 | `GameMap`(errand) + TutorialScreen 이 `RecordCard` 를 직접 | `GameMap` 은 기록 카드를 `discussion` 에서만 그린다 |
| 5 증거 | `GameMap`(morning, `phaseEndsAt = Date.now()+4000`) | `traceWindowOf` 가 `phaseEndsAt − MORNING_TRACE_MS` 부터 `on` — 이미 구간 안이라 `EvidenceCard`·이름표 표시가 즉시 켜진다 |
| 6 투표 | `GameMap`(phase `nomination`, `day.points` 비어 있음) | `voting`(=`day.turn` 없음)·`pick` 이름표·`TopToast`(`toast` prop)·`VoteBadge`(`day.points` 로 득표) |
| 7 직업 카드 | `WorldStage`(밤 배경 `scene`) + `TutorialRoleCards` | 헤더 없음(띠만) |

**위치 시드:** 장면 3 은 처리 반경 안(`ERRAND_ACT_R` 1.2)에서 시작해야 한다. `mail` 중심 (5.0, 3.4) 에서 1.0 안쪽(예: (4.4, 3.0))에 `snap` 으로 세운다. 도윤은 다른 좌석의 `move` 프레임(`store` 가 "처음 보는 좌석의 move = 등장 대상"으로 취급)으로 걸어 들어오게 한다 — 실제 3D 걷기이므로 시안의 `walk` 키프레임은 필요 없다. 장소 id 는 위치가 아니라 데이터라서 `lamp` 근처에 도윤이 실제로 서 있을 필요는 없다.

**위험(확인됨):** (a) `GameMap` 내부 `emitSignal`(`tap`/`deny`/`tensionCue`/`card`)은 전역 바인딩(`bindSignals`)이 있으면 소리로 간다 — solo 에는 바인딩이 없어 무음, together 에는 `RoomScreen` 의 `useSound` 가 받는다(Pitfall 4). (b) `useMapInsets` 는 `.mf-room` 조상과 `[data-host-band] .mv-host__band` 를 찾는다 → `TutorialScreen` 은 `.mf-root.mf-room` 래퍼와 같은 클래스의 띠를 렌더해야 한다. (c) 로컬 위치·`Date.now()` 기반 가짜 마감은 `useDayFx`·소리 감독에 연결하지 않는다(그 훅들은 `RoomScreen` 소유라 solo 에서는 아예 없다).

### Q2. 목소리·효과음·소리 규칙

- 엔진 API: `engine.play(id, { cents, gainDb })`(`engine.ts:33-37` PlayOpts), `engine.runScript(key, items, duck?)`(`engine.ts:71`). 항목은 `{ at, id, gainDb?, cents? }`(`script.ts` ScriptItem).
- 레시피 한계: `MAX_LAYERS = 4`, `MAX_RECIPE_MS = 3000`, `NODE_BUDGET = 48`, `SFX_VOICE_MAX = 8`(`recipes.ts:9,10,24,26`). `voice.syl` 은 레이어 2(삼각 `[205, 192.7]` 75ms·사인 `[412, 389.5]` 50ms, 이득비 0.15:0.035), 같은 id `max 2`, `gapMs 0`. 글자 간격 85ms 라 동시 1~2 개.
- **새 id 13개(`tut.*` 12 + `voice.syl`)** 로 `SFX_IDS` 50 → 63, `SOUND_IDS` 57 → 70. `tut.fanfare` 는 **4음(D·F·A·E, 옥타브 겹침 사인 제외)** 한 레시피를 권장(2레시피 분할은 id 가 14개로 늘고 같은 순간 호출 규칙이 필요).
- 소리 꺼짐 규칙: `engine.isOn()` 거짓이면 엔진이 소리를 내지 않는다(`canSound`). T-13 의 "파형·글 드러남은 소리와 무관하게 같은 시간 동안 움직인다"는 **엔진 상태를 보지 않고 글자 수 × 85ms + 80ms 타이머**로 `speaking` 을 켜는 것으로 충족된다.
- 오디오 잠금 해제: 카드 탭 핸들러 **맨 앞 동기 `unlockAudio()`**(`Home` 이 방 만들기·참가에서 쓰는 규칙, `Home.tsx` handleCreate 첫 줄).
- 소리 단추: solo 는 `TutorialScreen` 이 `useSound({ active: true, view: null })` 를 쓰고 `SoundButton` 을 띠 독에 둔다. together 는 Pitfall 4 의 소유권 규칙을 따른다.
- 믹스: 목소리는 `ui` 버스(`BUS_GAIN.ui 0.45`)·효과음 `sfx`(0.7). `tableDb` 는 소리 시험(`peakDbEstimate ≤ −6`)을 통과하는 선에서 시작값 −16~−24 로 두고 듣고 조정한다 `[ASSUMED]`.

### Q3. 포커스 깜빡임 테두리 vs 기존 `.is-call`

기존 HOST-03 빛남(`.is-call`, `v2.css:206-209`)은 **대상 요소 안의** `::after`(테두리 1.5px `--light-lamp` + `--glow-ring`)와 `::before`(`--glow-ring-peak`, `opacity` 맥박 `animation: mv-call-pulse var(--dur-pulse) ease-in-out 5`) 의사 요소이고 **5회만** 깜빡이며 모션 줄이기에서 `animation: none`(`v2.css:231`)이다. 튜토리얼 포커스는 4px·1초·**무한**·대상 밖 8px 키운 상자라 **새 클래스·새 부품(`FocusRing`)** 이 맞다. 재사용 가능한 것은 토큰뿐(`--light-lamp`, `color-mix`).

권장 구현: 상자 `div`(테두리 4px) 의 `opacity` 를 1 ↔ .2 로, 번짐은 정적 `box-shadow` 를 가진 의사 요소의 `opacity` 를 1 ↔ 0 으로 — **둘 다 `opacity` 애니메이션(합성기 처리)** 이라 3D 위 55fps 게이트에 안전하다. 대상 위치는 `getBoundingClientRect` 를 `requestAnimationFrame` 에서 재서(이름표·타일·[처리]는 런타임이 프레임마다 DOM 에 직접 쓴다) 직전 값과 같으면 갱신하지 않는다. 실제 대상 표식: `button[data-errand-place="mail"]`·`[data-errand-act]`(심부름), `.mf-world__tag[data-seat="N"]`·`button[data-pick="N"]`(이름표) — `WorldStage.tsx` 가 이미 단다.

**겹침 처리:** 튜토리얼 장면 3·6 에서는 `GameMap` 이 자연스럽게 `.is-call`(심부름 타일·[처리], 투표 이름표 `callTagSeats`)을 켠다. UI-SPEC T-14 는 장면 3 우체통 타일의 `is-call` 램프 빛을 그대로 두라고 적었다. 권장: `[data-tutorial-screen] .is-call::before { animation: none; opacity: 0; }` 로 **5회 맥박만 끄고**(깜빡임 한 규칙 — 0078-8) 정적 테두리는 둔다 `[ASSUMED]`(계획 단계 확인 항목).

몸 상자(장면 4 도윤): 이름표 사각형만 DOM 으로 재고 몸 쪽은 "이름표 중심 ±…, 아래로 고정 길이" 합성 사각형으로 합친다. `WorldStage` 는 발끝 투영(`onProject`)을 `WorldStageProps` 로 내보내지 않는다 — 정확한 몸 상자가 필요하면 `onProject?` prop 을 추가하는 작은 수정이 필요하다 `[ASSUMED]`.

### Q4. 첫 화면 큰 카드·`minifia.tutorial.seen`

- 첫 화면은 `src/screens/Home.tsx`, `<div className="mf-entry__actions">`(`Home.tsx:142`)가 방 코드 폼 + [방 만들기]를 담는다. `App.tsx` 의 `Screen` 이 `home` 일 때 `<Home onEnterRoom>` 를 그린다.
- 닉네임·방 코드 상태는 `Home` 의 `useState`(`nickname`, `code`)다. **`Home` 이 튜토리얼 열림 상태를 쥐고 `TutorialScreen` 으로 화면을 바꿔 그리면(같은 컴포넌트 인스턴스) 두 값이 자동 보존된다** — App 에 새 `Screen` 을 만들면 `Home` 이 언마운트돼 값이 사라진다. 따라서 `Home` 안에서 `tutorial` 상태로 분기하는 것을 권장.
- 저장 키: 코드베이스는 콜론 규칙(`minifia:session`, `minifia:lastNickname`, `minifia:sound`, `session.ts:6-7`)인데 T-2 는 `minifia.tutorial.seen`(점)이다. 위임 기본값을 존중해 **T-2 문자열 그대로** 쓰되 `session.ts` 의 `read/write` 헬퍼에 얹어 메모리 대체를 얻는다. 표기 불일치는 Assumptions A6 에 적었다.
- 쓰는 때: 튜토리얼 시작 시점 + `onEnterRoom` 직전(방 만들기·참가 성공 경로)에 `seen` 을 켠다("누른" 과 "성공"의 차이는 작지만, 닉네임 검증 실패로 켜지는 일을 피한다 `[ASSUMED]`).
- 카드 탭: `unlockAudio()` 를 같은 틱 맨 앞 → `seen` 저장 → `setTutorial(true)`. 맵 청크는 `Home` 이 이미 `preloadEntryAssets()`·`preloadWorld()`(`Home.tsx` useEffect)로 받는다.

### Q5. 함께 진행 — 서버 설계 (SC-2)

**확인한 구조:** 시작은 `handleStart`(`worker/room.ts:477`) → `startGame`(`room.ts`) → `beginGame`(`room.ts:420`)이 `phase: "assigning"`(`room.ts:434`)·역할 배정·맵 결정을 한다. 단계 표는 `PHASE_DEFS`(`phases.ts:74`)이고 `tick` 이 `next` 로 넘긴다. 조기 종료는 `applyEndDiscussion` 이 `tick({ ...result.state, phaseEndsAt: now }, …)`(`room.ts:922`)로 정상 마감과 같은 경로를 탄다. 방 설정 선례 `mapPick`(`schemas.ts:83`, `handleMapPick` `worker/room.ts:593`)은 방송 필드 `view.mapChoice` 를 쓴다. 메시지 유니온에 새 `t` 를 더하고 `handleMessage` switch 를 빠뜨리면 `const unhandled: never = msg;`(`worker/room.ts:367`)가 컴파일 오류로 알린다.

**권장 설계(계획이 확정):**
1. `ClientMessage` `{ t: "start"; tutorial?: boolean }` — 스키마 `z.strictObject({ t: z.literal("start"), tutorial: z.boolean().optional() })`(현재 `schemas.ts:62` 는 `z.object` 라 알 수 없는 키를 조용히 버린다 → 새 키를 실으려면 스키마 변경이 필수). **서버 기본은 꺼짐**이라 `{t:"start"}` 를 보내는 워커 테스트·`scripts/bots.mjs`·E2E 서버 쪽은 그대로다.
2. `PhaseId` 에 `"tutorial"`, `PHASE_DEFS.tutorial = { durationMs: TUTORIAL_MS(150_000), next: "assigning", revealsOwnRole: false }`. `beginGame(state, now, randInt, opts?: { tutorial?: boolean })` 는 `opts.tutorial === true` 이면 `phase: "tutorial"`, `phaseEndsAt: now + TUTORIAL_MS`. 역할은 **지금처럼 `beginGame` 안에서 배정**한다(서버 상태에만 있고 `revealsOwnRole:false` 라 view 에 `me.role` 이 없다). 이렇게 하면 `assignRoles`·`testRole`·맵 결정의 난수 호출 순서(시드 시험)가 그대로고, 튜토리얼 뒤 `assigning`(3초 "역할을 나누고 있습니다")이 기존대로 이어진다. UI-SPEC T-19 의 "역할은 튜토리얼이 끝난 뒤에 정해진다"는 **관측 가능한 계약**(튜토리얼 중 view 에 역할 없음)으로 충족되며 내부 배정 시점은 구현 선택이다 — 사용자 확인 항목 A2.
3. `RoomState.tutorialPassed?: string[]`(끝났음을 보낸 player id, **서버 전용 이름** — view 의 `me.tutorialDone` 과 이름이 달라야 누설 검사의 서버 전용 키 목록에 넣을 수 있다). 튜토리얼을 떠나는 전환·`resetToLobby`(허용 목록 재구성이라 자동 소멸)·다시 하기에서 지운다.
4. 새 클라이언트 메시지 `{ t: "tutorialDone" }`(`z.strictObject`, 필드 없음). 규칙 함수 `markTutorialDone(state, actorId)`: 단계가 `tutorial` 이 아니면 `WRONG_PHASE`, 방에 없으면 `BAD_MESSAGE`, 이미 표시됐으면 같은 객체(저장·전송 없음). 신원은 소켓 첨부 playerId 뿐.
5. 공개 값 `view.tutorial = { done, total, endsAt }`(숫자 셋, 모두에게 같음)와 `me.tutorialDone`(본인에게만, 불리언)을 **`tutorial` 단계에서만** 싣는다. `total` = 앉은 사람(봇 제외) 수, `done` = 그 중 끝냈거나 연결이 끊긴 사람 수. 봇(`isBot`, `bots.ts:141`)은 사람 수에 넣지 않는다(= 끝낸 것으로 셈과 동치). 기다림 화면의 "사람 원 줄"이 그리는 N 이 사람 수라는 UI-SPEC 문장과 맞는다.
6. 전원 완료 판정 `allTutorialDone(state)` = 연결된 비봇 사람 모두가 `tutorialPassed` 에 있음(연결된 사람이 0명이어도 참 → 즉시 넘어가 150초를 버리지 않는다). 호출 지점: `handleTutorialDone` 직후, **`handleDisconnect`(연결 변화) 직후**(마지막 미완료자가 끊기면 기다릴 이유가 없다 — D-05·D-18 "끊긴 사람을 기다리지 않는다"). 안전망은 150초 마감 `tick`.
7. `worldVisibleTo`(`audience.ts:98-102`)와 위치 snap 에 `tutorial` 을 `lobby`/`assigning`/`roleReveal` 과 같은 "방 전원" 집합에 넣는다(Pitfall 8).
8. 봇 계획은 `botPlanKey`(`bots.ts:214`)의 목록에 `tutorial` 이 없어 `null` → 봇은 아무것도 하지 않는다(수정 불필요). 테스트 방 `testSkip`(`skipPhase`)은 `tick({phaseEndsAt:now})` 라 `tutorial → assigning` 이 그대로 된다.
9. **저장소 쓰기(결정 0076):** `tutorialDone` 하나당 `persistAndBroadcast`(= `put("room")` 1회 + 모두에게 view). 사람 ≤ 8명이라 판당 ≤ 8회 + 전환 1회. 심부름 표본(40초 × 변경 시)보다 훨씬 작고, 새 알람은 기존 단계 마감 알람 하나(`nextWakeAt`)에 합쳐진다. `tutorial` 단계에서 모두가 5분 넘게 끊기면 기존 `emptyGameCloseAt`(`EMPTY_GAME_CLOSE_MS`)이 방을 닫는다 — 변경 없음.
10. 클라이언트 스위치: `Lobby` 가 방장에게만 `TutorialToggle` 을 그리고 상태는 `useState`(초기값 = `(view.round ?? 1) === 1 && view.me.testMode !== true`)로 쥔다. `pressStart` 가 `send({ t: "start", tutorial: on })`. **테스트 방(`me.testMode`)은 초기값 꺼짐**이어야 E2E 가 쓰는 `startGame`(`scripts/e2e/browser.mjs:1199` `await page.locator("[data-lobby-start]").click();`)이 튜토리얼에 안 걸린다 — 스위치 줄 자체는 테스트 방에도 보여 수동 시험을 가능하게 한다 `[ASSUMED]`(A3). UI-SPEC "서버가 방송한 값만 따른다"(#25)는 `mapPick` 방식을 가정한 문장이고 T-4 는 "값은 [시작] 메시지에 실린다"이므로 후자를 따른다.

**방장 패널 높이:** `.mf-lobby__panel` 은 `display:flex; flex-direction:column; gap: 10px`(`lobby.css:29`)다. 스위치 줄 64px 를 자식으로 더하면 **+74** 이고 UI-SPEC 의 +76(64+12)과 2px 어긋난다. 선택: 줄 위 `margin-top: 2px` 로 +76 을 맞추거나 UI-SPEC 숫자를 +74 로 고친다(계획 결정, 숫자는 `lobbyPanelHeight`/E2E 기대값/`screen-map.md` 가 따라온다). 영향 받는 기존 고정 값: `scripts/e2e/flows.mjs:572 const CHAT_LOBBY_EXTRA = 154;`(`chat-lobby` 의 방장 패널 CP1 — 방장만 +74/76), `lobbyPanelHeight`(`chatUi.ts`, 손님 기본은 154 유지). `PANEL_HEIGHT`(`camera.ts:42`)는 측정 전 기본값이라 손님 기준을 유지한다. 오른쪽 열 `sideMaxH` 가 줄어 낮은 폰에서 방장 열이 두 열로 접히는 기존 한계(HANDOFF 0079)가 더 일찍 걸린다.

### Q6. E2E 와 시간 줄이기

- 실행 구조: `scripts/e2e/run.mjs` — `--url http://localhost:5173 --only <부분 문자열>`, 흐름 표 `FLOWS`(`flows.mjs:3792`). 크기 6종은 `extraSizes: LOBBY_EXTRA_SIZES`. 순수 도우미 단위 시험은 `node --test scripts/e2e/lib.test.mjs`(386개, 이 세션 0.3초), 앱 상수와의 동일성은 `test/unit/e2eContract.test.ts`.
- 새 흐름(이름 앞머리 `tutorial` — `--only tutorial` 하나로 둘 다 돈다. `trace`·`lobby` 와 부분 일치가 겹치지 않는다):
  - `tutorial-solo`: 방 없이 첫 화면에서 큰 카드(폰 6종 기하·교차 0)·장면 1~8 순서/시각·포커스 상자 개수/위치·허용 밖 터치 무반응·오답 후 상자 1개·[건너뛰기]·마무리 카드·**소켓 프레임 0건**(`page.on("websocket")`).
  - `tutorial-together`: 방장+손님 2~3 페이지(+봇), 스위치 기본 켬(첫 판)/끔(테스트 방)·시작 → 모두 `tutorial` 장면·일부만 끝내면 n/N·끝났음 외 프레임 0·전원 완료 또는 150초 → 역할 확인·끄고 시작 → 곧장 역할 확인·재접속.
  - 묶음 G·H 를 새 요소에 적용(글자 14px 이상·가로 넘침·콘솔 오류).
- 기존 흐름 수정: `chat-lobby`(방장 패널 높이), `lobby`·`world`·`map-select`(오른쪽 열 높이·시작 단추 눌림), `sound-render`(57→70 개), `emcee-leak`(튜토리얼 화면의 다섯 시점 동일성은 새 흐름이 맡음), `e2eContract.test.ts`/`lib.mjs` 의 상수 사본(`LOBBY_PANEL_EXTRA` 방장 변형, SOUND_IDS 개수).
- 시간 정책(사용자 메모): 변경된 흐름만 로컬(`npm run dev` + `-- --url http://localhost:5173 --only tutorial,chat-lobby,sound-render`)로 돌리고, 6종 전체 회귀(약 21분)는 **페이즈 끝에 한 번**. `tutorial-together` 의 150초 시간 초과 경로는 실제로 기다리지 말고 테스트 방 `testSkip`·워커 테스트의 `runDurableObjectAlarm` 로 검증한다. 배포본에는 smoke 와 바뀐 흐름만(결정 0076 쓰기 예산).

### Q7. Validation Architecture → 아래 별도 절.

## Common Pitfalls

### Pitfall 1: `Record<PhaseId, …>` 컴파일 오류 연쇄
**What goes wrong:** `PhaseId` 에 `"tutorial"` 을 더하면 `PHASE_DEFS`(`phases.ts:74`), `PHASE_SCENE`(`scenes.ts:35`), `PHASE_ANNOUNCE`(`RoomScreen.tsx:55`), `TEST_PHASE_LABEL`(`TestTools.tsx:21`), `BED_OF`(`director.ts:25`), 시험 `emotePhases.test.ts` 의 `KIND`, `phaseScreens.test.tsx:401` 이 한꺼번에 깨진다(`ON_ENTER`·`ENTER_SOUND` 는 `Partial` 이라 안 깨진다).
**Why it happens:** 단계 이름을 키로 강제하는 의도된 안전장치.
**How to avoid:** Wave 0 한 계획에서 `PhaseId`+모든 표를 함께 고친다: `PHASE_SCENE.tutorial = "lobby"`(배경은 쓰이지 않음), `BED_OF.tutorial = null`(튜토리얼은 자기 소리), `PHASE_ANNOUNCE.tutorial = () => "튜토리얼"`, 라벨 "튜토리얼". `nyquist-02-phase-matrix`·`phases.test` 는 `Object.keys(PHASE_DEFS)` 로 돌아 자동 포함되며 `tutorial` 은 채팅 단계가 아니라 기대값이 맞다(`CHAT_PHASES` 에 넣지 않는다).
**Warning signs:** `npm run typecheck` 실패.

### Pitfall 2: 오프닝·직업 카드 장면을 밤 `GameMap` 으로 그림
**What goes wrong:** `GamePanel` 의 밤 분기가 얼굴 목록과 `[유언]` 줄을 그리고 `nightDarkOf` 가 비네트·긴장 큐를 켠다(`view.me.role` 이 없으면 `!== "mafia"` 라 참).
**How to avoid:** 장면 1·7 은 `WorldStage` 를 직접 쓴다(Q1 표). 배경 연출(어둠 번짐·진홍 번쩍임·소리 링)은 그 위 오버레이.

### Pitfall 3: 심부름 시작 카드·흔적 구간·목격 기록 카드가 `view` 시각/단계에 묶임
**What goes wrong:** (a) `phaseEndsAt` 가 `now + ERRAND_MS` 근처면 `startCardOn` 이 2초 막+카드를 띄운다. (b) `morning` 에서 `phaseEndsAt` 가 `null` 이면 `traceWindowOf` 가 `null` 이라 증거 카드가 영영 안 뜬다(`GameMap.tsx:465-476`). (c) `RecordCard` 는 `discussion`(`GameMap.tsx:394`)에서만 그려진다.
**How to avoid:** 장면 3 은 `phaseEndsAt: null`, 장면 5 는 `Date.now() + 4000`(장면 시작 시 한 번 고정 — 틱마다 새 view 를 만들지 않는다), 장면 4 의 기록 카드는 `TutorialScreen` 이 직접 렌더.

### Pitfall 4: `RoomScreen` 이 `tutorial` 단계에서도 띠·알림음·소리 감독을 돌림
**What goes wrong:** `RoomScreen.tsx:450` 이 모든 단계에서 `HostBand` 를 그리고(→ 띠 두 개), `:313` 이 `hostChimeOf(...)` 로 `ui.host` 를 낸다(`lobby→tutorial` 에서 울림). 또 `bindSignals` 는 **전역 단일 처리기**이고 부모 효과가 자식 효과 뒤에 실행돼 `RoomScreen` 의 `useSound` 바인딩이 `TutorialScreen` 의 것을 덮는다. `useSound` 정리는 `engine.stopAll()`(침대·예약 대본 중지)을 부른다.
**How to avoid:** (1) `RoomScreen` 이 `view.phase === "tutorial"` 이면 `HostBand`/`HostDock` 을 그리지 않는다(소리 단추는 `TutorialScreen` 독). (2) `hostChimeOf` 는 `prev`/`cur` 가 `tutorial` 이면 `false`(진입·이탈 모두 — 이탈 `tutorial→assigning` 은 `game.start` 가 이미 울린다) + `hostChime` 단위 시험 갱신. (3) 소리 소유권을 한쪽으로: together 모드에서는 `RoomScreen` 의 `useSound({active})` 를 `view.phase !== "tutorial"` 일 때만 켜고 `TutorialScreen` 이 자기 `useSound` 를 쓴다. `director.BED_OF.tutorial = null` 이면 `lobby→tutorial` 에서 로비 침대가 페이드아웃한다(원하는 동작). (4) `GameMap` 의 `emitSignal({kind:"tap"})`(`[처리]`) 은 튜토리얼 핸들러가 `ui.tap` 으로 매핑한다(T-21).

### Pitfall 5: solo 모드에 `.mf-room` 래퍼와 방 높이 고정이 없음
**What goes wrong:** `useHostMetrics`·`useMapInsets` 가 `.closest(".mf-room")` 에 CSS 변수(`--mf-host-top/bottom/dock`, `--mf-room-h`)를 쓴다. `useFixedRoomHeight` 는 `RoomScreen.tsx` 안 비공개 함수다. solo(`Home` 에서 열림)에는 `RoomScreen` 이 없어 변수·높이가 비고 `TutorialHostBand` 가 안 맞는다.
**How to avoid:** `useFixedRoomHeight` 를 `src/net/` 로 옮겨 export 하고 `TutorialScreen` 이 `div.mf-root.mf-room` + 이 훅 + `HEADER_SELECTOR` 에 맞는 헤더(`.mf-game__header` 는 GameMap 이 그림)를 갖춘다. 장면 1·7 은 헤더가 없어 변수가 지워져 CSS 기본값(70/62/80)으로 돌아간다 — 그 장면의 띠 위치를 E2E 가 본다.

### Pitfall 6: 위치 snap 이 튜토리얼 단계에서 사라져 배정 화면이 어긋남
**What goes wrong:** 광장 시작은 `handleStart` 가 모두를 광장 입장 지점으로 옮기고 snap 을 보낸다(`worker/room.ts:490-` 주석). `worldVisibleTo`(`audience.ts:102`)가 `tutorial` 을 모르면 빈 집합 → 그 snap 이 아무에게도 안 가고, `tutorial → assigning` 전환에는 별도 snap 이 없어 `PreGame` 이 로비 위치로 그려진다.
**How to avoid:** `worldVisibleTo` 의 방 전원 조건에 `tutorial` 추가 + `audience.test`/`nyquist` 시험 + 워커 시험(광장 시작·튜토리얼 켬 → 배정 시 store 가 광장 좌표). 튜토리얼 화면은 자기 로컬 `WorldStore` 를 쓰므로 방 `store` 가 받은 snap 은 무해하다.

### Pitfall 7: 허용 목록 밖 터치·포커스 차단
**What goes wrong:** `WorldStage` 의 `.mf-world__input` 이 탭을 `{t:"move"}` 로 보내고, 심부름 표지 `ErrandMarker` 는 걷기 버튼, 헤더·패널은 실제 버튼이다.
**How to avoid:** 컨테이너 단위로 `inert` + `pointer-events:none` — `.mf-game__header`, `.mf-world__input`, `[data-errand-layer]`, `[data-world-panel]`(장면 6 의 입력줄), 필요 시 `.mf-world__tags` 안 비허용 이름표. **`inert` 는 자손이 해제할 수 없으므로** 허용 대상(`[data-errand-act-layer]`, 장면 6 `button[data-pick]` 이 든 `.mf-world__tags`)은 inert 컨테이너 밖에 있어야 한다 — `WorldStage` 의 DOM 구조(`mf-world__errand-act` 가 별도 층, 이름표 층이 별도)가 이를 허용한다. `inert` 는 저장소에 선례가 없다(검색 0건). react-dom·`@types/react` 는 지원하고(`react-dom-client.development.js:3244`·`@types/react/index.d.ts:2948`) iOS Safari 15.5+ 에서 동작한다([CITED: caniuse.com/mdn-html_global_attributes_inert, webkit.org/blog/12669]). happy-dom 은 의미를 구현하지 않을 수 있어 **시험은 속성 존재·허용 대상 사각형이 inert 조상 밖임**을 단언한다 `[ASSUMED]`.

### Pitfall 8: 소리 시험의 고정값
**What goes wrong:** `soundRecipes.test.ts` 가 `SOUND_IDS` 57·효과음 50·`EXPECTED_SFX` 목록·"서로 다른 해시 50"·"같은 id 간격 규칙(`ui.host` 등 special 만 `gapMs≠0`, 모든 id `max === 2`)"·"버스: `uiIds` 만 ui, 나머지 sfx"·`SCREEN_COUNTERPART` 57 행·`PRIO0` 여섯을 못 박고, `e2eContract` 가 `SOUND_IDS` 를, `sound-render` 흐름이 57 개를 센다. `docs/audio.md` 레시피 지도와 `src/debug/soundLabTable.ts` 도 있다.
**How to avoid:** Wave 0 에서 한 번에: `SFX_IDS`+13, `RECIPES`, `SCREEN_COUNTERPART`(각 id 한 줄·개행 없음·`ambient` 로 시작하지 않음), 시험의 개수·목록·버스 집합(`voice.syl` 을 ui 버스에 두면 `uiIds` 에 추가)·special 집합, 레시피 규칙(`max 2`, `gapMs 0`, `prio 2`), `docs/audio.md`, 소리 시험 페이지, E2E 개수. 모든 새 레시피는 `peakDbEstimate ≤ −6`·층 ≤ 4·길이 ≤ 3000ms·노드 ≤ 8·주파수 40~9000.

### Pitfall 9: `src/audio/**` 정적 가드
**What goes wrong:** `soundStaticGuard.test.ts` 는 `src/audio/**` 의 import 를 `./…`·`react`·`protocol`(타입)·`phases`·`../game/(dayView|verdictMoment|willLetter)` 로만 허용하고(`:12-18`), 주석을 뺀 소스에서 `/\bchat/i`·`/\b(mafia|whisper)\b/i` 등을 금지한다(`:25-26`).
**How to avoid:** `voice.ts` 는 문구·키를 인자로 받고 `src/game/tutorialScript.ts` 를 import 하지 않는다(문구 키 → 문자열 해석은 화면 쪽). 식별자·주석에 `chat`·`mafia` 영문을 쓰지 않는다(한글은 무관). `voice.ts` 가 새 import 가 필요하면 가드 허용 목록을 같이 고치고 이유를 적는다.

### Pitfall 10: 누설 검사 확장 누락
**What goes wrong:** `test/worker/leak.test.ts` 의 `SERVER_ONLY_KEYS`(`:113`)·허용 경로 목록(`ROLE_PATHS_ALIVE` `:97` 등)은 새 키를 모른다. 새 공개 경로 `.view.tutorial.{done,total,endsAt}`·`.view.me.tutorialDone` 와 서버 전용 이름 `tutorialPassed` 를 등록하지 않으면 실패한다. 반대로 서버 전용 이름을 view 이름(`tutorialDone`)과 같게 하면 이름 충돌로 검사가 무력해진다.
**How to avoid:** 서버 전용 이름은 `tutorialPassed`(view 와 다름). 새 허용 경로는 "받을 권리 조건"과 함께만 추가(기존 주석 규칙). 튜토리얼 중 모든 역할 시점의 `tutorial` 단계 view 가 **키·값이 동일**(역할 5종)하고 `me.role`·`me.allies`·`players[].role` 이 없음을 단언하는 시험을 더한다. 튜토리얼 밖(본게임·대기실) DOM·프레임에 `data-tutorial-role-card`·가짜 이름(서연·도윤…)이 0건인지는 E2E.

### Pitfall 11: 클라이언트 `inert`·FocusRing 대상이 프레임마다 움직임
**What goes wrong:** 이름표·타일·[처리]는 런타임이 프레임마다 DOM `style` 에 직접 쓴다. FocusRing 이 한 번만 재면 첫 투영 전 사각형(0×0)·카메라 이동 뒤 위치에 남는다.
**How to avoid:** UI Considerations #8(대상 못 쟀으면 안 그림) + rAF 재측정, 사각형이 직전과 같으면 갱신 생략, 대상이 사라지면 같이 사라짐. 사각형이 화면 안쪽 8 밖이면 안으로 민다.

### Pitfall 12: 램프 꺼짐 투영 API 없음
`WorldStage` 는 런타임의 `onProject`(`runtime.ts:220`)를 심부름 층에만 연결하고 외부로 내보내지 않는다. 가로등 4개 좌표는 `PLAZA_OBSTACLES` 에 있지만(`mapPlaza.ts`) 화면 좌표로 바꿀 공개 길이 없다. UI-SPEC 의 대체(왼쪽·오른쪽 가장자리 높이 225 두 곳 + 소리 2번)를 기본으로 하고, 정확한 투영이 필요하면 `WorldStage` 에 `onProject?` 통과 prop 을 더하는 작은 수정을 한다(성능 게이트 영향 없음).

### Pitfall 13: 테스트 방에서 튜토리얼 기본값이 켜짐
앞서 Q5-10. E2E·`uat-test-room` 이 전부 `testMode` 방이고 `startGame` 이 [시작] 단추를 누른다. 기본 켬이면 모든 게임 흐름이 `tutorial` 단계에 걸려 시간 초과/실패한다.

### Pitfall 14: 브라우저 뒤로 가기(solo)
T-20 은 "뒤로 가기 → 첫 화면"이라 했지만 solo 는 URL 을 바꾸지 않아 뒤로 가기가 앱을 떠난다. `pushState` 를 쓰면 `App` 의 `popstate` 처리(`screenFromLocation`)와 상호작용한다 → Open Question 1.

## Code Examples

### 서버 순수 규칙(제안 골격)
```typescript
// shared/game/tutorial.ts — 시각·난수 없는 순수 모듈(다른 shared/game 규칙 함수와 같은 모양)
export const TUTORIAL_MS = 150_000; // T-6
export function tutorialProgress(state: RoomState): { done: number; total: number } {
  const humans = state.players.filter((p) => !isBot(p));
  const passed = new Set(state.tutorialPassed ?? []);
  return { total: humans.length, done: humans.filter((p) => passed.has(p.id) || !p.connected).length };
}
export function markTutorialDone(state: RoomState, actorId: string): { ok: true; state: RoomState } | { ok: false; error: "WRONG_PHASE" | "BAD_MESSAGE" } {
  if (state.phase !== "tutorial") return { ok: false, error: "WRONG_PHASE" };
  if (!state.players.some((p) => p.id === actorId)) return { ok: false, error: "BAD_MESSAGE" };
  if ((state.tutorialPassed ?? []).includes(actorId)) return { ok: true, state }; // 같은 객체 → 저장·전송 없음
  return { ok: true, state: { ...state, tutorialPassed: [...(state.tutorialPassed ?? []), actorId] } };
}
export const allTutorialDone = (s: RoomState): boolean => { const { done, total } = tutorialProgress(s); return done >= total; };
```

### 워커 처리기(제안 골격 — `applyEndDiscussion` 패턴)
```typescript
private async applyTutorialDone(playerId: string, now: number): Promise<WsErrorCode | null> {
  if (!this.room) return "BAD_MESSAGE";
  const result = markTutorialDone(this.room, playerId);
  if (!result.ok) return result.error;
  if (result.state === this.room) return null;
  if (allTutorialDone(result.state)) {
    const prev = this.room;
    this.room = tick({ ...result.state, phaseEndsAt: now }, now, cryptoRandInt); // tutorial → assigning
    await this.afterTransition(prev, now);
    return null;
  }
  this.room = result.state;
  await this.persistAndBroadcast();
  return null;
}
```

### 스키마
```typescript
// shared/schemas.ts — 기존 62행 `z.object({ t: z.literal("start") })` 대체
z.strictObject({ t: z.literal("start"), tutorial: z.boolean().optional() }),
z.strictObject({ t: z.literal("tutorialDone") }),
```

### 목소리(제안 골격 — `src/audio/voice.ts`)
```typescript
// 문구는 인자. 글자마다 voice.syl 항목, 같은 key 는 새 문장이 이전 예약을 취소한다.
const STEPS = [1, 1.12, 1.26, 1.06, 1.19, 0.94] as const; // Sound.dc.html 목소리 식 (UI-SPEC 「소리」)
export function sayItems(text: string): { items: ScriptItem[]; totalMs: number } {
  const items: ScriptItem[] = [];
  let at = 50; let n = 0;
  for (const ch of text) {
    if (ch === " ") { at += 50; continue; }
    const ratio = STEPS[n % STEPS.length]! * (n % 7 === 6 ? 0.88 : 1);
    items.push({ at, id: "voice.syl", cents: Math.round(1200 * Math.log2(ratio)) });
    at += 85; n += 1;
  }
  return { items, totalMs: at + 80 };
}
// 호출: engine.runScript("voice.host", items); 파형·글 드러남은 totalMs 동안 speaking(엔진 상태와 무관)
```

### FocusRing CSS(opacity 만 애니메이션)
```css
/* src/styles/tutorial.css — 새 토큰·hex 없음. 4px = --space-xs, 1s 주기 */
.tut-focus { position: absolute; box-sizing: border-box; pointer-events: none; border: 4px solid var(--light-lamp); animation: tut-ring 1s ease-in-out infinite; }
.tut-focus::before { content: ""; position: absolute; inset: -4px; border-radius: inherit; box-shadow: 0 0 22px 6px color-mix(in srgb, var(--light-lamp) 55%, transparent); animation: tut-glow 1s ease-in-out infinite; }
@keyframes tut-ring { 0%, 100% { opacity: 1; } 50% { opacity: .2; } }
@keyframes tut-glow { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .tut-focus, .tut-focus::before { animation: none; opacity: .6; } } /* 테두리는 항상 보인다 */
```

### 검증된 값 인용 (in-repo discrete values — 이 세션에서 열어 읽음)

| 값 | 출처:줄 | 원문(verbatim) |
|----|---------|----------------|
| 단계 표 행 형식 | `shared/game/phases.ts:76` | `assigning: Object.freeze({ durationMs: ASSIGNING_MS, next: "roleReveal", revealsOwnRole: false }),` |
| 대기실 행 | `shared/game/phases.ts:75` | `lobby: Object.freeze({ durationMs: null, next: null, revealsOwnRole: false }), // start 로만 나간다` |
| 시작 메시지(현재) | `shared/protocol.ts:275` | `  \| { t: "start" }` |
| 시작 스키마(현재) | `shared/schemas.ts:62` | `  z.object({ t: z.literal("start") }),` |
| 맵 선택 스키마 | `shared/schemas.ts:83` | `  z.strictObject({ t: z.literal("mapPick"), map: z.enum(MAP_CHOICES) }),` |
| 단계 id 합집합 | `shared/protocol.ts:30-34` | `export type PhaseId = \| "lobby" \| "assigning" \| "roleReveal" \| "dayAnnounce" \| "errand" \| "discussion" \| "nomination" \| "runoff" \| "showdown" \| "defense" \| "verdict" \| "execution" \| "night" \| "morning" \| "ended";` |
| 시작 때 단계 | `shared/game/room.ts:434` | `    phase: "assigning",` |
| 방 전원 위치 가시 조건 | `shared/game/audience.ts:102` | `  if (state.phase === "lobby" \|\| state.phase === "assigning" \|\| state.phase === "roleReveal") return pick(() => true);` |
| 조기 종료 패턴 | `worker/room.ts:922` | `      this.room = tick({ ...result.state, phaseEndsAt: now }, now, cryptoRandInt);` |
| 새 메시지 누락 방지 | `worker/room.ts:367` | `        const unhandled: never = msg;` |
| 봇 판정 | `shared/game/bots.ts:141` | `export const isBot = (p: { isBot?: true }): boolean => p.isBot === true;` |
| 봇 계획 단계 목록 | `shared/game/bots.ts:214` | `  const planned: readonly string[] = ["errand", "discussion", "nomination", "runoff", "showdown", "verdict", "night", "defense"];` |
| 심부름 보내기 | `src/screens/GameMap.tsx:747` | `    send({ t: "errand" });` |
| 지목 보내기 | `src/screens/GameMap.tsx:543` | `          if (send({ t: "point", target: seat }) === false) return; // 소켓이 닫혀 못 보냈으면 표시도 바꾸지 않는다` |
| 심부름 패널 없음 | `src/screens/GameMap.tsx:215` | `  const panelless = view.phase === "errand";` |
| 기록 카드는 토론에서만 | `src/screens/GameMap.tsx:394` | `  const witnessRows = useMemo(() => (view.phase === "discussion" && meAlive ? recordRowsOf(view) : null), [view, meAlive]);` |
| 흔적 조각 읽기 | `src/screens/GameMap.tsx:465` | `  const tracePiece = view.phase === "morning" ? view.day?.evidence?.trace : undefined;` |
| 장면 직접 주입 | `src/components/WorldStage.tsx:238` | `  scene?: SceneLook;` |
| 걷기 허용 prop | `src/components/WorldStage.tsx:244` | `  canWalk?: boolean;` |
| 재생 옵션 | `src/audio/engine.ts:37` | `  cents?: number;` |
| 대본 예약 | `src/audio/engine.ts:71` | `  runScript(key: string, items: readonly ScriptItem[], duck?: DuckSpan \| null): void;` |
| 레시피 한계 | `src/audio/recipes.ts:9,10,24,26` | `export const MAX_LAYERS = 4;` · `export const MAX_RECIPE_MS = 3000;` · `export const NODE_BUDGET = 48;` · `export const SFX_VOICE_MAX = 8;` |
| 버스 이득 | `src/audio/recipes.ts:29` | `export const BUS_GAIN: Readonly<Record<Bus, number>> = { bgm: 0.3, sfx: 0.7, ui: 0.45 };` |
| 정적 가드 금지 낱말 | `test/unit/soundStaticGuard.test.ts:25-26` | `{ label: "마피아 채널·귓속말", re: /\b(mafia\|whisper)\b/i },` · `{ label: "채팅", re: /\bchat/i },` |
| 서버 전용 키 목록 | `test/worker/leak.test.ts:113` | `const SERVER_ONLY_KEYS = ["claimPick", … "nightPick", "errandFake"];` (끝 두 원소) |
| 저장 키 규칙 | `src/net/session.ts:6-7` | `export const SESSION_KEY = "minifia:session";` · `export const NICKNAME_KEY = "minifia:lastNickname";` |
| 같은 옷 | `shared/game/trace.ts:25` | `  noir: "redCloth",` |
| 광장 장소 | `shared/game/mapPlaza.ts:87,89,90` | `{ id: "fountain", x: 1.6, z: 1.6 },` · `{ id: "lamp", x: -3.0, z: -0.3 },` · `{ id: "mail", x: 5.0, z: 3.4 },` |
| 걷는 속도 | `shared/game/world.ts:14` | `export const MOVE_SPEED = 1.8;` |
| 의상 id | `shared/protocol.ts:473` | `export const OUTFIT_IDS = ["coat", "police", "doctor", "mafia", "detective", "reporter", "elder", "hood", "noir"] as const;` |
| 맵 id | `shared/protocol.ts:477` | `export type MapId = "bar" \| "plaza";` |
| 대기실 패널 간격 | `src/styles/lobby.css:29` | `…display: flex; flex-direction: column; gap: 10px; padding: 14px var(--space-md) 22px;…` |
| 방장 패널 E2E 사본 | `scripts/e2e/flows.mjs:572` | `const CHAT_LOBBY_EXTRA = 154;` |
| E2E 시작 단추 | `scripts/e2e/browser.mjs:1199` | `  await page.locator("[data-lobby-start]").click();` |
| 소리 전역 바인딩 | `src/audio/signals.ts:64,72` | `export function bindSignals(handler: Handler): () => void {` · `export function emitSignal(signal: LocalSignal): void {` |
| 심부름 시간 | `shared/game/phases.ts:62` | `export const ERRAND_MS = 40_000;`(주석 생략) |
| 흔적 구간 | `shared/game/phases.ts:70` | `export const MORNING_TRACE_MS = 5_000;`(주석 생략) |
| 기본 알림 묶음 | `src/screens/RoomScreen.tsx:313,450` | `    if (hostChimeOf(prev.phase, shownPhase, prev.epoch !== connection.epoch)) emitSignal({ kind: "host" });` · `        <HostBand view={shown} offset={connection.offset} cardSeen={seenFront} local={hostLocal} sound={sound.supported ? sound : null} />` |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 대기실 [튜토리얼] 알약 + 연습 7단계 + 코치 막(0077) | 첫 화면 큰 카드 + "첫 사건" 미니 에피소드(0078) | 2026-11-08 | 16-UI-SPEC 의 튜토리얼 계약·`TutorialButton`·`CoachMark` 계획은 폐기. 16 은 구현하지 않았다(`grep tutorial src` 0건) |
| 포커스 = 배경 흐림 + 링(0078-2) | 4px 램프 빛 깜빡임 테두리(0078-8) | 2026-11-08 | `FocusRing` 하나, 어둠 막 없음 |
| 사회자 인물·말풍선 | 파형 + 자막 띠(0078-9 C) | 2026-11-09 | `HostBand` 변형, 인물 에셋 0 |
| 심부름 `.is-call` 5회 맥박 | 튜토리얼은 무한 4px 깜빡임 | 17 | 별도 클래스 |

**Deprecated/outdated:** 17-UI-SPEC 의 "시안의 `nextpulse`·바텐더·말풍선 4개·화살표·막 .9" 는 쓰지 않는다(UI-SPEC "다르게 한 곳").

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 스위치 값은 `start` 메시지의 `tutorial?: boolean` 으로 전달(별도 설정 메시지·`view.tutorialOn` 방송 없음) | Q5 | 손님이 설정을 미리 보고 싶다면 `mapPick` 방식으로 바꿔야 한다(UI-SPEC #25 와 T-4 가 서로 다른 문장) — 계획 단계에서 사용자 확인 |
| A2 | 역할은 `beginGame` 에서 시작 때 배정하고 `tutorial` 단계 view 에서만 숨긴다(UI-SPEC T-19 "튜토리얼이 끝난 뒤에 정해진다"는 관측 계약으로 해석) | Q5 | 사용자가 실제 배정 시점 지연을 원하면 `beginGame` 분리·시드 시험 갱신이 필요 |
| A3 | 테스트 방(`me.testMode`)은 스위치 초기값 꺼짐(줄은 보임) | Q5, Pitfall 13 | 켜면 E2E·UAT 가 150초에 갇힘 — 반대로 정하면 `startGame` 도우미가 스위치를 꺼야 한다 |
| A4 | `inert` 는 컨테이너 단위 차단에 충분하고 happy-dom 시험은 속성·구조만 본다 | Pitfall 7 | happy-dom 이 의미를 구현하면 시험이 더 강해질 뿐 |
| A5 | 방장 패널 증분은 실제로 +74(gap 10)이며 UI-SPEC 의 +76 은 `margin-top: 2px` 로 맞추거나 숫자를 +74 로 고친다 | Q5 | E2E 기대값·`screen-map.md` 숫자 불일치 |
| A6 | 저장 키는 T-2 문자열(`minifia.tutorial.seen`)을 따른다(코드베이스는 콜론 규칙) | Q4 | 일관성 문제뿐, 기능 영향 없음. 바꾸려면 T-2 한 줄 |
| A7 | `tut.fanfare` 는 4음(D·F·A·E) 한 레시피 | 소리 | 5음 원안을 원하면 레시피 2개·id 14개 |
| A8 | `voice.syl` 은 `ui` 버스·`prio 2`·`max 2`·`gapMs 0` | 소리 | 소리 시험의 버스 집합 갱신 필요(Wave 0) |
| A9 | 정확한 몸 상자·램프 투영에는 `WorldStage` 에 `onProject?` 통과 prop 이 필요(없으면 이름표 사각형 + 고정 길이, 램프는 가장자리 두 곳) | Q3, Pitfall 12 | 연출 정밀도만 영향 |
| A10 | 목소리·효과음 시작 `gainDb`(−16~−24)는 듣고 조정 | 소리 | 믹스만 영향(시험은 −6 dBFS 이하만 강제) |
| A11 | `TutorialScreen` 은 정적 import(코드 분할 없음) | 구조 | 번들 크기 — 이미 `RoomScreen` 이 같은 청크라 영향 작음 |
| A12 | `.is-call` 5회 맥박은 `[data-tutorial-screen]` 안에서 끄고 FocusRing 하나만 신호로 쓴다 | Q3 | T-14 가 장면 3 우체통 `is-call` 을 남기라고 한 문장과 충돌 가능 — 계획 단계 확인 |

## Open Questions

1. **혼자 하기와 브라우저 뒤로 가기**
   - What we know: solo 는 URL 을 바꾸지 않는다(`App.tsx` 의 `popstate` → `screenFromLocation`).
   - What's unclear: T-20 "뒤로 가기 → 첫 화면"을 만족하려면 `pushState('/')` 같은 빈 항목이 필요한데 `App` 의 `resume`/`goHome` 로직과 부딪힐 수 있다.
   - Recommendation: 기본은 `pushState` 없음(뒤로 가기 = 앱 이탈, 손해 작음, 사용자 메모 "진행에 지장 없는 가장자리는 고치지 않음"). 필요하면 후속.
2. **`done`/`total` 정의** — 이 문서는 total = 비봇 앉은 사람, done = 끝냈거나 끊긴 사람으로 제안(UI-SPEC 문장 "사람 원 수 = 연결된 사람 수, 봇·끊긴 사람은 끝낸 것으로 셈"과 모순 없게). 끊김이 total 에서 빠지는지 done 에 들어가는지는 화면(원 줄·`n / N`)에서 동일하게 보이므로 시험으로 고정만 하면 된다.
3. **+74 vs +76** — A5.
4. **램프·몸 상자의 정확한 투영** — A9. 먼저 가장자리 두 곳 + 이름표 기반 상자로 구현하고 시각 확인 뒤 필요 시 통과 prop 을 추가.
5. **(사용자 확인 후보)** A1·A2·A3 은 위임 기본값이 서로 어긋난 곳이라 계획 시작 때 한 줄 확인을 권한다(진행은 추천안으로 가능).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | 전체(`engines >=22.12`) | ✓ | v26.13.0 | — |
| npm | 스크립트 | ✓ | 11.20.0 | — |
| 시스템 Chrome | `scripts/e2e` (playwright-core) | ✓ | `/Applications/Google Chrome.app` 존재 | — |
| vitest 3 프로젝트(unit/client/worker) | 시험 | ✓ | 이 세션 실행 확인(unit 0.2s·client 0.9s·worker 1.5s 단일 파일) | — |
| `node --test scripts/e2e/lib.test.mjs` | E2E 도우미 시험 | ✓ | 386 pass, 0.3s | — |
| `npm run dev`(vite + cloudflare 플러그인, :5173) | 로컬 E2E | 미실행(정의만 확인) | — | 배포본 E2E(결정 0076 때문에 바뀐 흐름만) |
| 실기기(iOS 소리 잠금·성능) | 소리·성능 | ✗ (이 세션 불가) | — | v3.0 끝 한 번에(사용자 결정) |

**Missing dependencies with no fallback:** 없음(실기기는 사용자 결정으로 미룸).
**Missing dependencies with fallback:** 실기기 → v3.0 실테스트.

## Validation Architecture

> `workflow.nyquist_validation: true`(`.planning/config.json`), `tdd_mode: true`.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.12 — projects `unit`(node) · `client`(happy-dom 21.0.4) · `worker`(`@cloudflare/vitest-plugin`) / `node --test`(E2E 도우미) / playwright-core 1.64.1(E2E) |
| Config file | `vitest.config.ts`(projects 3), `wrangler.jsonc`, `scripts/e2e/run.mjs` |
| Quick run command | 영역별 아래 표(단일 파일 1~2초) |
| Full suite command | `npm run typecheck && npm test`, 그 뒤 `node --test scripts/e2e/lib.test.mjs` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TUT-01 | 큰 카드↔작은 단추(`minifia.tutorial.seen`), 같은 틱 `unlockAudio`, `Home` 에만, 닉네임·코드 보존 | client | `npx vitest run --project client test/client/tutorialEntry.test.tsx` | ❌ Wave 0 |
| TUT-01 | solo 8장면 흐름·[건너뛰기]·마무리 카드·다시 보기 | client(가짜 타이머) | `npx vitest run --project client test/client/tutorialScreen.test.tsx` | ❌ Wave 0 |
| TUT-01·03 | 폰 6종 기하·장면 순서/시각·소켓 프레임 0 | E2E | `npm run e2e -- --url http://localhost:5173 --only tutorial-solo` | ❌ Wave 0 |
| TUT-02 | `start.tutorial` → `tutorial` 단계·`tutorialDone`·전원 완료 조기 종료·150초 알람·봇/끊김 셈·기본 꺼짐 불변 | worker | `npx vitest run --project worker test/worker/tutorial.test.ts` | ❌ Wave 0 |
| TUT-02 | 순수 규칙(`tutorialProgress`·`markTutorialDone`·`allTutorialDone`)·`PHASE_DEFS.tutorial`·`beginGame` 옵션 | unit | `npx vitest run --project unit test/unit/tutorial.test.ts` | ❌ Wave 0 |
| TUT-02 | 대기실 스위치 줄(방장만·초기값·`start` 메시지)·기다림 화면(n/N·팁 숨김) | client | `npx vitest run --project client test/client/lobby.test.tsx test/client/tutorialWait.test.tsx` | lobby ✅ 수정 / wait ❌ |
| TUT-02 | 함께 진행 실제 흐름·재접속 | E2E | `… --only tutorial-together` | ❌ Wave 0 |
| TUT-03 | 장면 표(장면 순서·사회자 문구 키)·가짜 view 가 같은 옷 = 도윤만(`sameOutfitSeats`)·`traceWindowOf` 켜짐 | unit | `npx vitest run --project unit test/unit/tutorialScript.test.ts` | ❌ Wave 0 |
| TUT-03 | FocusRing(사각형 측정·모션 줄이기·1Hz)·허용 목록 inert·오답 두 번 뒤 상자 1개 | client | `npx vitest run --project client test/client/focusRing.test.tsx test/client/tutorialGate.test.tsx` | ❌ Wave 0 |
| TUT-03 | 사회자 띠(파형 5·`data-speaking`·시간 행 없음·소리 단추 독·교차 0) | client+E2E | `npx vitest run --project client test/client/tutorialHostBand.test.tsx` | ❌ Wave 0 |
| TUT-04 | 새 id 13 개의 레시피 한계·해시·버스·간격, 화면 대응 표, `docs/audio.md` | unit | `npx vitest run --project unit test/unit/soundRecipes.test.ts test/unit/soundProvenance.test.ts` | ✅ 수정 |
| TUT-04 | 목소리 항목(글자 수·85ms·띄어쓰기 +50·음높이 6단계·7번째 ×0.88·새 문장이 이전 예약 취소) | unit | `npx vitest run --project unit test/unit/voice.test.ts` | ❌ Wave 0 |
| TUT-04 | 정적 가드(`src/audio/**` import·금지 낱말) | unit | `npx vitest run --project unit test/unit/soundStaticGuard.test.ts` | ✅ (voice.ts 자동 포함) |
| TUT-04 | 소리 꺼짐에서도 막대 움직임·소리 0번 | client | `…/tutorialHostBand.test.tsx` | ❌ Wave 0 |
| TUT-05 | `GameMap` 에 준 `send` 가 로컬 어댑터이고 실제 `send` 는 끝났음 한 번뿐 | client | `npx vitest run --project client test/client/tutorialScreen.test.tsx` | ❌ Wave 0 |
| TUT-05 | 튜토리얼 소스에 `me.role`·실제 역할 낱말·실제 닉네임 경로 없음(정적) | unit | `npx vitest run --project unit test/unit/tutorialStaticGuard.test.ts` | ❌ Wave 0 |
| DEPLOY-05 | 누설 전수(`tutorial` 단계 view 가 역할 5종 시점에서 동일, 새 경로 허용·서버 전용 `tutorialPassed` 키 없음) | worker | `npx vitest run --project worker test/worker/leak.test.ts test/worker/tutorialLeak.test.ts` | leak ✅ 수정 / ❌ |
| 회귀 | 모든 `Record<PhaseId>`·매트릭스·방 틀 | typecheck+unit | `npm run typecheck && npx vitest run --project unit test/unit/nyquist-02-phase-matrix.test.ts test/unit/phases.test.ts test/unit/emotePhases.test.ts test/unit/hostLine.test.ts` | ✅ 수정 |
| 회귀 | E2E 고정값 사본 | unit+node | `npx vitest run --project unit test/unit/e2eContract.test.ts && node --test scripts/e2e/lib.test.mjs` | ✅ 수정 |

### Sampling Rate
- **Per task commit:** 바꾼 영역의 단일 파일 quick run(위 표) + `npm run typecheck`(서버·타입 변경 때).
- **Per wave merge:** `npx vitest run --project unit --project client` + 바뀐 워커 파일 + `node --test scripts/e2e/lib.test.mjs`.
- **Phase gate:** `npm run typecheck && npm test` 전체 초록 → 로컬 `npm run dev` 후 바뀐 흐름만 `--only tutorial,chat-lobby,sound-render,lobby` → **6종 전체 회귀는 페이즈 끝에 한 번**(약 21분) → 배포(`npm run deploy` 가드) → 배포본 `smoke` + `tutorial` 흐름 → `/gsd-verify-work`.
- 성능: 장면 3~6(3D 광장 + 오버레이)을 6페이즈 게이트(5분 평균 55fps)로 다시 잰다(실기기는 v3.0 끝).

### Wave 0 Gaps
- [ ] `PhaseId`+모든 `Record<PhaseId>` 표 + `worldVisibleTo` 갱신(Pitfall 1·6) — 컴파일 먼저.
- [ ] 소리 고정 시험 갱신: `soundRecipes.test.ts`(57/50·목록·해시·버스·간격·`SCREEN_COUNTERPART`), `soundProvenance`, `soundLab`/`soundLabTable`, `e2eContract`, `sound-render` 개수, `docs/audio.md`(Pitfall 8).
- [ ] 신규 시험 파일: `test/unit/tutorial.test.ts`·`tutorialScript.test.ts`·`voice.test.ts`·`tutorialStaticGuard.test.ts`, `test/client/tutorialEntry|tutorialScreen|tutorialGate|focusRing|tutorialHostBand|tutorialWait.test.tsx`, `test/worker/tutorial.test.ts`·`tutorialLeak.test.ts`.
- [ ] `test/worker/leak.test.ts` 확장: 새 공개 경로·서버 전용 키(`tutorialPassed`)·튜토리얼 중 역할 5종 시점 동일성.
- [ ] 진홍 예약: 튜토리얼 CSS 를 `src/styles/tutorial.css` 새 파일에만 두고(기존 `no crimson` 스캔을 건드리지 않음) 그 파일의 `crimson` 사용처가 UI-SPEC T-18 세 곳뿐임을 정적 시험으로 고정. `phase.css` 머리 주석에 두 항목 추가.
- [ ] E2E: `tutorial-solo`·`tutorial-together` 흐름, `lib.mjs`/`e2eContract` 의 방장 패널 상수, `chat-lobby` CP1 방장 변형.
- 프레임워크 설치 불필요(기존 3 프로젝트·playwright 사용).

## Security Domain

> `security_enforcement` 활성(`security_asvs_level: 1`, `security_block_on: high`).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | 기존 토큰 hello(변경 없음). 신원은 소켓 첨부 `playerId` 뿐 |
| V3 Session Management | no | 기존. 튜토리얼 진행은 저장하지 않음(T-20) |
| V4 Access Control | yes | `tutorialDone` 은 `tutorial` 단계의 방 안 사람만(`WRONG_PHASE`/`BAD_MESSAGE`), `start.tutorial` 은 기존 방장 검사(`checkStart`) 뒤에만. 남의 완료를 표시할 수 없다 |
| V5 Input Validation | yes | zod `strictObject`: `{t:"start", tutorial?: boolean}`·`{t:"tutorialDone"}`(덧붙은 키 거부), 1024B 프레임·속도 제한(기존 `overRateLimit`) |
| V6 Cryptography | no | 해당 없음(난수는 기존 `cryptoRandInt`) |
| V8 Data Protection(정보 누설) | yes | `tutorial` 단계 `revealsOwnRole:false`, view 에 `me.role`·`allies` 없음. 공개 값은 숫자 셋과 본인 불리언뿐. 서버 전용 이름 `tutorialPassed` 는 어떤 프레임에도 키로 없음 |

### Known Threat Patterns for 이 스택(Cloudflare DO + React 클라이언트)

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 클라이언트가 `tutorialDone` 을 범람시켜 DO 쓰기 증폭 | Denial of Service | 같은 값은 같은 객체라 저장·전송 없음 + 기존 속도 제한. 판당 쓰기 ≤ 인원수 |
| 튜토리얼 단계에서 역할 정보 노출 | Information Disclosure | `PHASE_DEFS.tutorial.revealsOwnRole=false` + `leak.test.ts` 역할 5종 시점 동일성 |
| 가짜 `start.tutorial` 로 방을 150초 붙잡음 | Denial of Service | 방장만 시작 가능(기존), 각자 [건너뛰기]로 즉시 완료, 150초 상한 |
| 튜토리얼 대본 닉네임 → DOM XSS | Tampering | 가짜 인원 이름은 상수, 모두 React 텍스트 노드(`innerHTML` 금지) — 실제 닉네임은 어디에도 섞지 않음 |
| `localStorage` 값 위조 | Tampering | `minifia.tutorial.seen` 은 참/없음 한 값이고 위조해도 카드 모양만 바뀐다 |
| 튜토리얼 화면에서 서버로 게임 메시지 유출 | Elevation of Privilege | `GameMap` 에 실제 `send` 를 주지 않는 구조 + 시험 |

## Project Constraints (from CLAUDE.md)

- 게임 규칙·판정은 서버가 정하고 클라이언트는 받은 상태를 보여 주며 행동만 보낸다(0002) — 튜토리얼 로컬 판정(정답/오답)은 **게임 규칙이 아니라 연출**이므로 서버 상태와 무관해야 한다.
- 다른 사람의 역할은 살아 있는 사람에게 보내지 않는다(0021). 화면에서 숨기는 것으로 대신하지 않는다 → `tutorial` 단계 view 에 역할을 싣지 않는다.
- **글 최소·보고 누르기 중심(0051, 가장 중요한 UI 지침)**: 3초 규칙, 설명 문단 없음.
- 몰입 기준(0006): 각 페이즈는 자기 구간 이펙트·액션을 기본형으로 함께 만든다.
- 새 결정은 `docs/decisions/` 에 **다음 번호**(0080)로 추가하고, `docs/screen-map.md`(첫 화면 카드 줄·방장 패널 숫자·튜토리얼 장면 표)와 `docs/audio.md`(새 레시피 지도)를 갱신한다.
- 작업 끝에 `HANDOFF.md` 갱신(≤ 6KB, `test/unit/handoff.test.ts`) 후 push. 작업이 끝나면 배포까지(계획에 "사용자가 배포"라고 가정하지 않는다).
- GSD 산출물·응답은 한국어, 코드·명령·경로·ID 는 원문. 화면 페이즈는 UI-SPEC 먼저(완료). 참고 이미지는 저장소 사본(`design/v3.0/first-case/`).
- 레포 위생: 커밋·푸시되는 모든 내용(코드·문서·커밋 메시지)에 소속·계정 관련 표현을 쓰지 않고, 커밋 전 위생 grep 결과가 0건인지 확인한다(명령은 개인 작업 공통 지침).
- 사용자 메모: 실기기 검사는 끝에 몰아서, E2E 는 바뀐 흐름만(전체 6종은 끝에 한 번), 실행기 컨텍스트는 가볍게(큰 문서 통째로 읽히지 않고 이월 메모), 작은 화면 가장자리 문제는 고치지 않음, 감정표현은 몸동작만(10페이즈), 강조는 깜빡이는 테두리, 튜토리얼은 익사이팅하게(목적·재미·직업·흐름), 시간은 참고 목표(연출을 줄이는 근거로 쓰지 않음).
- 프로젝트 스킬: `.claude/skills`·`.agents/skills` 없음. `gsd-addons:design-refs`(planner·executor 에 구성됨) — 디자인 참고 경로가 있으면 직접 열어 따른다.

## Sources

### Primary (HIGH confidence — 이 세션에서 저장소 파일을 직접 열어 확인)
- `.planning/phases/17-tutorial-first-case/17-UI-SPEC.md`(전체), `docs/decisions/0077-tutorial-and-evidence.md`, `0078-tutorial-first-case.md`, `0076-storage-writes.md`, `HANDOFF.md`
- `shared/protocol.ts`, `shared/schemas.ts`, `shared/game/{phases,room,tick,view,audience,movement,bots,trace,mapPlaza,maps,testTools,world,discussion}.ts`, `worker/room.ts`(handleStart·handleMapPick·applyEndDiscussion·afterTransition·advance·reschedule·handleDisconnect·syncHome·snapEachViewer)
- `src/App.tsx`, `src/screens/{Home,Lobby,RoomScreen,GameMap,GamePanel}.tsx`, `src/components/{WorldStage,TestTools}.tsx`, `src/components/v2/{HostBand,RecordCard,SoundButton}.tsx`, `src/world/{store,presence}.ts`, `src/net/{session,useMapInsets,useErrandPos,useErrandStartCard,useReducedMotion}.ts`, `src/game/{hostLine,errandView,recordView,traceMark,scenes,nightDark,chatUi}.ts`, `src/audio/{engine,recipes,script,signals,unlock,useSound,director,audioView,prefs}.ts`, `src/styles/{lobby,v2,phase}.css`
- 시험·스크립트: `test/unit/{soundRecipes,soundStaticGuard,phases,nyquist-02-phase-matrix,e2eContract}.test.ts`, `test/client/errandScreen.test.tsx`, `test/helpers/*`, `test/worker/leak.test.ts`·`start.test.ts`, `scripts/e2e/{run,flows,lib,browser}.mjs`, `vitest.config.ts`, `package.json`, `.planning/{config.json,REQUIREMENTS.md,ROADMAP.md}`
- `design/v3.0/first-case/Main.dc.html`(`say`·`sfx` 합성식), `Sound.dc.html`
- 실행 확인: `node --version`(v26.13.0), 단일 파일 vitest(unit/client/worker), `node --test scripts/e2e/lib.test.mjs`(386 pass)
- `node_modules/react-dom/cjs/react-dom-client.development.js:3244`(`inert` 처리), `node_modules/@types/react/index.d.ts:2948`(`inert?: boolean | undefined`)

### Secondary (MEDIUM confidence)
- [caniuse — HTML attribute: inert](https://caniuse.com/mdn-html_global_attributes_inert) · [WebKit — New WebKit Features in Safari 15.5](https://www.webkit.org/blog/12669/new-webkit-features-in-safari-15-5) · [MDN — inert](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/inert): iOS Safari 15.5+ 지원, Baseline 2023-04.

### Tertiary (LOW confidence)
- 없음(웹 단독 근거 없음). 믹스 수치(A10)·몸 상자(A9)는 `[ASSUMED]`.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 신규 의존성 0, 버전은 `package.json` 직접.
- Architecture: HIGH — `GameMap`/`WorldStage` 순수 props 구조·서버 조기 종료 패턴·단계 표를 직접 확인. 장면별 렌더 선택은 코드 분기 읽기 기반(실행 시각 검증은 계획의 시험이 맡음).
- Pitfalls: HIGH(1·2·3·4·5·6·8·9·10·13) / MEDIUM(7 `inert` 시험 방식·11·12 연출 정밀도).

**Research date:** 2026-11-09
**Valid until:** 2026-12-09 (저장소 내부 구조 기준 — 14~16 페이즈 부품이 이 사이에 바뀌면 재확인)
