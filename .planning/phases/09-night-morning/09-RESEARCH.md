# Phase 9: 밤과 아침 - Research

**Researched:** 2026-11-03
**Domain:** 서버 권위 실시간 방(Cloudflare Durable Object) 위의 "물리적 암살 + 어둠" 밤 규칙, 역할별 누설 차단(메타모픽 증명), 유언·쪽지 보관과 공개, 아침 연출. 새 외부 의존성 없음.
**Confidence:** HIGH (서버 구조·테스트 하네스는 이번 세션에 파일을 열어 확인) / MEDIUM (클라이언트 연출·성능은 실기기 전 추정)

<user_constraints>
## User Constraints (from CONTEXT.md)

> CONTEXT.md 없음(사용자가 discuss-phase 를 생략). 잠긴 결정은 `09-UI-SPEC.md` 의 "결정 현황" 표(A1~A4 사용자 확정 2026-11-03)와 "잠금" 행에서 가져왔다. 아래는 그 원문을 그대로 옮긴 것이다.

### Locked Decisions

- **잠금 — 밤 길이 30초, 조기 종료 없음**(모두 골랐어도 마감까지 간다). 이유: 조기 종료 시각이 "마피아가 합의를 마쳤다"를 시민 편에게 알린다 (DAY-07, 결정 0044-13, ROADMAP 성공 기준 1)
- **잠금 — 밤에는 마피아(산 사람)와 유령만 맵을 움직인다.** 시민 편 화면은 깜깜하고 남이 보이지 않으며 서버가 시민 편에게 밤 동안 남의 위치·움직임·채팅·입력 중·동작·고리·선택을 **한 번도 보내지 않는다**. 시민 편 소켓이 받는 프레임은 마피아가 움직이든 가만히 있든 같다 (NIGHT-07, 결정 0044-2·14)
- **잠금 — 마피아 확정 = 산 마피아 전원이 같은 대상**을 골랐을 때. 못 맞추면 그 밤에는 아무도 죽지 않는다(v1.0 다수결·무작위 동률은 없앤다). 쪽지는 확정된 암살에만 붙는다 (NIGHT-08, NIGHT-12, 결정 0044-20)
- **잠금 — 경찰·의사는 맵이 아니라 얼굴 목록**에서 고른다. 경찰은 자기를 못 고르고 의사는 자기도 고른다. 마감 전까지 바꿀 수 있고 조사 결과는 밤이 끝날 때(아침 진입) 경찰에게만 온다 (NIGHT-09, 결정 0044-4)
- **잠금 — 긴장 연출은 시민 편(시민·경찰·의사 똑같이) 화면에만 있고 클라이언트가 혼자 만든다.** 서버 이벤트·프레임·타이밍에 묶지 않는다 (NIGHT-10)
- **잠금 — 암살 이펙트는 밤 판정이 끝난 뒤(아침 진입 때) 피해자 화면에서만.** 의사가 살렸으면 누구에게도 이펙트·개별 알림이 없다 (NIGHT-11, 결정 0044-22)
- **잠금 — 아침:** 쓰러진 자리의 분필 윤곽은 그날 낮 동안(다음 밤 시작까지) 남는다. 유언·쪽지는 채팅 카드로 남아 낮에 다시 읽는다. 의사가 살렸으면 "누군가 살아났습니다" 만(누구인지·쪽지 비공개). 아침 길이는 서버가 내용에 맞춰 정한다 (MORN-01~04, 결정 0044-5·21·22)
- **잠금 — 유언:** 산 사람이면 역할과 관계없이 언제든(로비 제외) 쓰고 고친다. 100자. 쓰는 동안 어떤 신호(입력 중 "…" 포함)도 다른 사람에게 가지 않는다. **죽을 때(처형·암살) 모두에게 공개**한다 — 처형된 사람의 유언도 처형 단계에서 공개한다. 죽기 전에는 **남에게 가는 어떤 메시지에도** 유언·쪽지 내용이 없다 (WILL-01, 결정 0044-19)
- **잠금 — 8페이즈 틀 재사용:** 게임 맵 화면 틀·36px 결과 알림·`PhaseHeader`·`TopToast`·채팅 패널·유령 분기·[역할 카드] 44×44. 햅틱·진동 없음
- **잠금 — 소리 없음(12페이즈).** 소리로만 알리는 정보도 없다
- **잠금 — 낮에도 밤에도 스산한 분위기 유지.** 아침에도 밝은 색면을 만들지 않는다
- **확정 A1 (사용자 2026-11-03 ①):** 아침에는 모두를 밤이 시작된 자리(= 낮 토론이 끝난 자리)로 되돌린다. 되돌림은 걷기 연출 없이 아침 진입 가림막 뒤에서 한 번에 적용하고(모든 소켓이 같은 내용의 스냅샷을 받음), 분필 윤곽은 피해자의 밤 시작 자리에 그린다. **결정 0044-18 뒷문장("아침에는 밤이 끝난 자리에서 시작")을 바꾸므로 새 결정 기록(다음 번호)이 필요하다.**
- **확정 A2 (사용자 ①):** 마피아 선택이 같으면 확정. 걷기(다가가기)는 의도를 보여 주는 연출이고 도착은 조건이 아니다.
- **확정 A3 (사용자 ①):** 이 페이즈는 화면 연출(진홍 맥박 + 가끔 세게 뛰는 "발소리 큐")만. 소리는 12페이즈가 같은 큐 시각에 얹는다(연출 코드가 큐 이벤트를 내보내는 자리만 둔다).
- **확정 A4 (사용자 ①):** 남에게 가는 메시지에는 없다로 읽고, 본인 소켓에만 자기 유언을 되돌려 준다(재접속·시트 다시 열기에 이어서 고칠 수 있음). 마피아 쪽지는 산 마피아끼리 같은 한 장을 본다.

### Claude's Discretion (UI-SPEC "플래너가 정함" 행)

서버 필드·메시지 이름(`me.will`·`me.note`·`night.sure`·`day.chalk` 등), 마피아 이동 audience 구현, 아침 길이 공식의 정확한 값(UI-SPEC 시작값 5/+2/+2/+2, 상한 15), 위치 되돌림 구현(`home` 기억 키), 채팅 카드의 보관·복원 방식, 밤 봇의 행동, 경찰·의사 선택 갱신 간격, 유언 저장 속도 제한. → 이 문서가 각각 권고안을 낸다.

### Deferred Ideas (OUT OF SCOPE)

캐릭터 몸짓·의상(10페이즈), 결과 화면 탭·밤별 구분선·시상식(11페이즈), 소리·햅틱(12페이즈, 앱 전환), 감정표현 칸, 시민 편 밤 채팅(읽기·쓰기 모두 만들지 않음), 새 장식 효과(안개·별·번개·핏자국), 진홍·놋쇠 행동 버튼, 쪽지·유언 카드 고정(핀) — 11페이즈 재검토.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NIGHT-07 | 밤에 각자 토론이 끝난 자리로 돌아가고 마피아만 움직인다. 시민 편 화면은 깜깜하고, 마피아 위치는 네트워크로도 안 간다 | `audience`/`canMoveIn`/`worldVisibleTo` 의 밤 분기, `home` 기억(world 저장 키 확장), 시민 편 밤 snap = 본인 한 칸, 메타모픽 테스트(아래 Validation) |
| NIGHT-08 | 마피아는 다가가 암살, 산 마피아 전원 일치만 확정, 못 맞추면 무사 | `resolveNight` 재작성(`confirmedTarget`), 난수 제거, `MyInfo` 득표 집계 필드, 봇 협응 |
| NIGHT-09 | 경찰·의사는 얼굴 목록에서 고른다 | 서버 `pickTarget` 유지(검증됨), `FaceList` 신규 이식, 얼굴 PNG 8장 복사 |
| NIGHT-10 | 시민 편 긴장 연출(실제 마피아 움직임과 무관) | 클라이언트 단독 모듈 `tension.ts`(연결·스토어 import 금지, 정적 검사), `Math.random` 계열 |
| NIGHT-11 | 암살당한 사람이 판정 뒤 깜깜한 화면에서 이펙트 | 별도 개인 메시지 없이 `alive` 차이로 화면이 판정(UI-SPEC), 첫 스냅샷 무이펙트 |
| NIGHT-12 | 마피아가 확정된 암살에 익명 쪽지 | `note` 메시지, `RoomState.nightNote`, 확정 때만 저장 허용, 구출 시 폐기 |
| MORN-01 | 분필 윤곽이 그날 낮 동안 남는다 | `RoomState.chalk` → `view.day.chalk`, 다음 밤 진입에서 제거, 재접속 시 이미 그려짐 |
| MORN-02 | 유언·쪽지 공개, 채팅 카드로 남음 | `ChatLineWire.k` 확장, `all` 채널 서버 생성 줄, 재접속 30줄 복원 |
| MORN-03 | 의사가 살렸으면 "누군가 살아났습니다" 만 | `MorningView.saved`(D-13 개정), 구출 시 유언·쪽지·길이 모두 "아무 일 없음"과 동일 |
| MORN-04 | 아침 길이를 서버가 내용에 맞춰 정한다 | `tick` 이 진입 훅 뒤 상태로 길이를 다시 구한다는 점을 활용(`phaseDurationOf` 확장) |
| WILL-01 | 누구나 언제든 유언, 쓰는 동안 신호 없음, 죽을 때 공개 | `will` 메시지(본인 소켓에만 응답), `Player.will`, 사망 감지 시 카드 발행 |
</phase_requirements>

## Summary

이 페이즈는 새 라이브러리가 필요 없고, **기존 방 Durable Object 의 세 가지 구조를 밤에 맞춰 확장**하는 일이다: (1) `audience`/`canMoveIn`/`worldVisibleTo` 표(위치·채팅 프레임의 받는 사람), (2) 단계 진입 훅이 순수 상태를 바꾸고 DO 가 그 뒤에 월드(위치)를 맞추는 "멱등 동기화" 패턴(`syncLayout`), (3) 줄 단위 채팅 보관(`chatLog`)과 재접속 복원. 8페이즈가 밤을 "선 자리 그대로" 로 남겨 둔 곳(`worker/room.ts` 의 `syncLayout` 주석 "밤에는 배치를 바꾸지 않는다 … 9페이즈가 정한다")이 이 페이즈의 정확한 삽입점이다.

가장 중요한 설계 사실 세 가지. **① 시민 편에게는 밤 동안 프레임이 아예 안 간다.** 마피아의 `pick` 은 이미 `pickRecipientIds`(마피아 + 탈락자)에게만 `state` 를 보내고, 이동·채팅·입력 중은 `audience` 를 지난다. 그래서 밤 규칙은 "audience 의 `world` 분기가 밤에 산 마피아의 이동을 (산 마피아 + 유령)에게만 주도록" 한 줄 고치는 것이 핵심이고, 남는 누설 경로는 **재접속 첫 스냅샷**(`handleHello` 의 `snapFrame` 이 지금 `this.world` 의 실제 위치를 읽는다)과 **밤·아침 진입 때의 위치 스냅샷**이다. **② 위치 되돌림에 필요한 "토론이 끝난 자리" 기억이 현재 없다** — 지목 단계 진입 즉시 `syncLayout` 이 모두를 둘레 자리로 보내므로 그 전에 `home` 을 붙잡아 world 저장 키에 같이 저장해야 한다(저장 디바운스 2초와 `editRoom` 류 DO 퇴거 때문에 즉시 flush 필요). **③ 아침 길이는 `tick` 이 이미 지원한다** — `tick` 은 진입 훅이 만든 상태로 `phaseDurationOf` 를 다시 구해 마감을 정하므로 길이를 상태의 함수로 만들면 된다. 단 구출·무사·마피아 미선택이 **같은 길이, 같은 공개 프레임**이어야 한다(구출은 "누군가 살아났습니다" 라는 공개 플래그 하나만 다르다).

**Primary recommendation:** 서버를 먼저 TDD 로 끝낸다(순수 규칙 `confirmedTarget`·`morningMsOf` → `audience`/`canMoveIn` 밤 분기 → DO 의 `home` 기억·밤/아침 위치 스냅샷·카드 발행·`will`/`note` 핸들러), **메타모픽 누설 테스트(`test/worker/nightLeak.test.ts`)를 같은 웨이브의 첫 RED 로 둔다.** 그 뒤에 클라이언트(`FaceList`·`WillSheet`·카드·가림막·어둠·분필·긴장 모듈)와 8페이즈 임시 틀 삭제, 마지막에 E2E·성능·배포 순으로 간다.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 밤 판정(전원 일치 확정, 구출, 조사 결과) | API / Backend (`shared/game/night.ts` 순수 + DO) | — | 결정 0002: 규칙·판정은 서버. 클라이언트는 받은 상태를 그린다 |
| 마피아 위치·이동·채팅의 받는 사람 | API / Backend (`audience`) | — | 화면에서 숨기는 방식 금지(결정 0002·0021). 서버가 안 보낸다 |
| 토론 끝난 자리(`home`) 기억·복원 | API / Backend (DO world 상태) | Database / Storage (`world` 키) | 서버만 위치를 안다. 하이버네이션·배포 뒤에도 유지돼야 한다 |
| 재접속 첫 스냅샷의 역할별 필터 | API / Backend (`worldVisibleTo` + `handleHello`) | — | 라이브와 같은 뷰 함수를 써야 첫 스냅샷이 우회로가 되지 않는다(L9) |
| 아침 길이 | API / Backend (`phaseDurationOf` 확장) | — | 모든 소켓에 같은 마감을 주려면 서버 값이어야 한다 |
| 유언·쪽지 보관과 죽을 때 공개 | API / Backend (`Player.will`, `nightNote`, 카드 줄) | Database / Storage (`room`·`chat:` 키) | 죽기 전 내용은 남의 소켓에 간 적이 없어야 한다 |
| 시민 편 긴장 맥박·발소리 큐 | Browser / Client (`src/world/tension.ts`) | — | **서버 프레임과 무관**해야 하므로 클라이언트가 혼자 만든다 |
| 암살 이펙트(피해자) | Browser / Client | — | 별도 서버 메시지 없음 — 공개 `alive` 변화로 화면이 판정 |
| 분필 윤곽 위치 | API / Backend (`day.chalk` 값) | Browser (그리기) | 산 사람 스토어에는 죽은 사람 위치가 없으므로 서버가 공개 값으로 준다 |
| 장면 전환 막·위치 되돌림 시각 처리 | Browser / Client | API (스냅샷 시점) | 막은 서버 마감(공개 정보)을 기준으로 클라이언트가 미리 덮는다 |
| 얼굴 목록 UI·유언 시트 | Browser / Client | — | 표현만. 선택·저장은 서버 규칙 |

## Standard Stack

### Core (모두 기존 — 새 패키지 없음)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.3.1 | 화면 | `package.json` 고정 [VERIFIED: package.json dependencies] |
| three | 0.186.1 | 맵·분필·조명 | 결정 0055 고정. 새 의존성 금지 [VERIFIED: package.json dependencies `"three": "0.186.1"`] |
| zod | 4.6.7 | Worker 입력 스키마(`will`·`note` 추가) | `shared/schemas.ts` 가 Worker 에서만 import [VERIFIED: shared/schemas.ts:2] |
| vitest | 4.1.12 | unit(node)·client(happy-dom)·worker(workerd) 3 프로젝트 | [VERIFIED: vitest.config.ts projects] |
| @cloudflare/vitest-plugin | 1.4.6 | worker 프로젝트 | [VERIFIED: package.json devDependencies] |
| playwright-core | 1.64.1 | E2E(`scripts/e2e`) | [VERIFIED: package.json devDependencies] |

### Supporting (코드로 옮기는 것, 설치 아님)

| Item | Source | Purpose | When to Use |
|------|--------|---------|-------------|
| `FaceList`, `WillSheet` | `design/v2.0/design-system/components/` → `src/components/v2/` | 경찰·의사 얼굴 목록, 유언·쪽지 시트 | 신규 이식(React 19 TSX), `bundle.js` 런타임 불러오기 금지 |
| 얼굴 PNG 8장 | `design/v2.0/design-system/assets/Faces/face-0..7.png` → `public/characters/faces/` | 얼굴 칸 그림 | 좌석 번호 `seat` 로 그대로 사용(UI-SPEC) |
| 분필 메시 코드 | `design/v2.0/blockout/blockout.js` 276~284행 `st.chalk` (TubeGeometry 0.022, `#e8e6dc`, opacity 0.85) | 분필 윤곽 | `src/world/maps/bar.ts` 로 이식(메시 1개, draw call +1) |
| 밤 시민 뷰 조명 값 | UI-SPEC "단계 조명" 표 (밤 전용 0.15·반구 0.05·달빛 0.08·노출 0.75) | `LightingPhase` 에 시민 어둠 단계 추가 | 새 광원 만들지 않음 — 아래 "점광원 재컴파일 함정" |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `RoomState.chalk` 를 DO 가 tick 직후 채움 | 분필을 별도 `world` 프레임으로 전송 | 재접속·관전 유령에 분필을 따로 보내야 하고 프레임 종류가 늘어 누설 표면이 커진다. view 값이 재접속 첫 스냅샷에 자동으로 실린다 |
| 카드를 `all` 채널 줄(`k` 필드)로 | 카드를 `view.day.morning.will/note` 에 싣기 | UI-SPEC 가 "채팅 카드로 남는다, 재접속 복원 30줄" 로 못박음. view 에 싣으면 낮 내내 view 가 커지고 "다시 읽기" 가 채팅 100줄 흐름과 분리된다 |
| 시민 편 밤 snap = 본인 한 칸 | 산 사람 전원의 home 위치 | 후자도 누설은 아니지만(낮에 이미 아는 위치) 보낼 이유가 없다. 전자가 "받은 것이 마피아 위치에 의존하지 않음" 증명이 더 단순하다 — 아래 Open Question 2 |

**Installation:** 없음. `npm install` 불필요.

**Version verification:** 새 패키지를 추가하지 않으므로 레지스트리 조회 대상이 없다. 기존 고정 버전은 `package.json` 에서 직접 확인했다 [VERIFIED: package.json].

## Package Legitimacy Audit

이 페이즈는 외부 패키지를 설치하지 않는다(UI-SPEC "Registry Safety": `npm 새 의존성 없음`). `gsd-tools package-legitimacy check` 대상 없음.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (없음) | — | — | — | — | — | 새 설치 없음 |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Project Constraints (from CLAUDE.md)

- 게임 규칙·판정은 서버(방 DO)가 정한다. 클라이언트는 받은 상태를 보여 주고 행동만 보낸다 (결정 0002).
- 다른 사람의 역할은 서버가 살아 있는 사람에게 보내지 않는다(탈락자 관전만 예외, 결정 0021). **화면에서 숨기는 것으로 대신하지 않는다.**
- 화면은 글을 최소로, 보고 누르는 조작 중심(결정 0051, 가장 중요한 UI 지침). 기획·계획은 참여 플레이어의 몰입 기준(결정 0006).
- 새 결정은 `docs/decisions/` 에 다음 번호로 파일을 추가한다 → **0061** (마지막은 `0060-v2-day-execution-ghost.md`) [VERIFIED: ls docs/decisions].
- 작업을 마칠 때마다 `HANDOFF.md` 갱신(6KB 이하, `test/unit/handoff.test.ts`)·push. 브랜치 `v2`.
- GSD 산출물·응답은 한국어. 코드·명령·파일명·요구사항 ID 는 원문.
- 작은 MVP / 이른 배포: 이후 페이즈 검증은 배포본으로. 실기기·팀 테스트는 모든 개발 뒤 몰아서(사용자 결정 2026-11-02).
- 레포 위생(`~/personal/CLAUDE.md`): 커밋되는 모든 문서에 개인 작업과 무관한 소속·계정 관련 표현을 쓰지 않는다. 커밋 전 그 파일이 정한 `git grep` 검사를 돌려 결과 0건을 확인한다.
- `three` 0.186.1 고정, 로비는 재즈 바 고정, 성능 확인은 iPhone 16 Pro + 크롬 CPU 4배 스로틀(결정 0055).
- config: `nyquist_validation: true`, `tdd_mode: true`, `security_enforcement: true`(ASVS 1, `block_on: high`), `code_review: true`.

## Architecture Patterns

### 현재 코드가 이미 주는 것 (이번 세션에 읽음)

| 항목 | 원문(인용) | 의미 |
|------|-----------|------|
| 밤·아침 길이 | `phases.ts:24-25` `export const NIGHT_MS = 30_000; // NIGHT-05` / `export const MORNING_MS = 5_000; // NIGHT-06` | 아침 5초가 새 공식의 기본값이 된다 |
| 이동 권한 | `movement.ts:27-32` `if (!alive) return true; // 유령은 모든 지도 단계에서 자유(A4)` / `return phase === "dayAnnounce" \|\| phase === "discussion";` | 산 사람은 낮 시작·토론만. **산 마피아의 밤**을 더해야 한다(시그니처에 역할 필요) |
| 이동 받는 사람 | `audience.ts:63-64` `if (mover === undefined) return new Set(); return isAlive(mover) ? pick(() => true) : pick((p) => !isAlive(p));` | 산 사람 mover 는 **방 전원**. 밤에는 이 줄이 마피아 이동을 시민에게 보낸다 — 가장 먼저 고칠 곳 |
| 접속 스냅샷 | `audience.ts:89` `return isAlive(viewer) ? pick(isAlive) : pick(() => true);` | 산 viewer 는 산 사람 전원. 밤에 시민 viewer 가 이걸 받고 `snapFrame(this.world …)` 가 **마피아의 실제 위치**를 싣는다 — 두 번째로 고칠 곳 |
| 밤 선택 전송 | `worker/room.ts:417` `this.sendViewTo(pickRecipientIds(this.room, playerId));` | 선택은 이미 마피아 + 탈락자에게만. 유지 |
| 밤 채팅 채널 | `audience.ts:46` `if (state.phase === "night") return me.role === "mafia" ? "mafia" : null;` | 시민 편은 밤에 채널이 없다 — 유지 |
| 밤 배치 없음 | `worker/room.ts:710` `// 밤에는 배치를 바꾸지 않는다(layoutKey 가 null, 선 자리 그대로 — 9페이즈가 정한다, A4).` | 삽입점 |
| 길이 재계산 | `tick.ts:93-95` `// 진입 훅이 만든 상태(공개 단계의 표)로 길이를 구해 마감을 다시 정한다.` / `const length = phaseDurationOf(hooked);` | 상태 기반 아침 길이 가능 |
| 진입 훅 표 | `tick.ts:44-51` `night: enterNight, morning: enterMorning,` | 순수 훅. **월드(위치)에 접근 못 한다** → 위치 작업은 DO |
| 선택 필드 | `view.ts:177-179` `if (state.phase === "night" && isAlive(me) && me.nightPick !== undefined) { myInfo.pick = me.nightPick; }` | 얼굴 목록 선택에 그대로 쓴다 |
| 동료 선택 | `view.ts:191-198` `allyPicks` = 동료가 고른 **대상 seat 집합**(누가·몇 명인지 없음) | 득표 수 배지(1·2…)와 "전원 일치" 판정에는 부족 → 새 집계 필드 필요 |
| snap 적용 | `store.ts:27-35` `if (frame.k === "snap") { this.segs = new Map(frame.ents.map(…))` | snap 은 구간을 **통째로 교체**하고 등장 연출 없이 바로 맞춘다 → 순간이동·본인 한 칸 snap 에 적합 |
| 점광원 생성 | `bar.ts:494-495` `const point = (…): PointLight => { const l = new PointLight(TOKEN_COLORS.lamp, 0, c.distance, T.point.decay);` | 광원은 처음부터 만들고 세기만 바꾼다 |
| 프레임 상한 | `protocol.ts:18` `export const MAX_FRAME_BYTES = 1024;` / `:324` `export const CHAT_TEXT_MAX_UTF16 = 300;` | `will`·`note` 도 같은 상한 |
| 채팅 보관 | `chatLog.ts:14` `export const CHAT_KEEP … = { all: 100, mafia: 300, ghost: 300 };` / `:12` `CHAT_REPLAY_PER_CHANNEL = 30` | 카드가 `all` 100줄·재접속 30줄에 섞인다(UI-SPEC 남은 위험 9) |
| 이동 간격 | `world.ts:18` `export const MOVE_MIN_GAP_MS = 150;` | 마피아 `move` 도 같은 간격 제한 |

### System Architecture Diagram

```
 낮 토론 끝(과반 또는 90초)
        │ tick: discussion → nomination (또는 분기로 night 직행)
        ▼
 ┌─ DO.advance / applyEndDiscussion / handleTestSkip (세 경로 → 한 함수로 합칠 것: afterTransition) ─────────┐
 │ 1 tick(room) → next                                                                                     │
 │ 2 captureHome(world)   ← 토론이 끝난 자리 = 각자 구간의 끝점. 지목 배치가 덮어쓰기 전에, 즉시 flush     │
 │ 3 chalk 채움(next.morning.eliminated 가 있으면 victim.home)  ← persistAndBroadcast 전에                  │
 │ 4 persistAndBroadcast (모든 소켓이 각자의 buildView)                                                    │
 │ 5 월드 동기화(멱등, lay.key):  night 키 → 산 사람 home 순간이동(restSegment) → viewer 별 snap            │
 │                                morning 키 → 산 사람 전원 home 순간이동 → viewer 별 snap                │
 │ 6 snapNewGhosts, 사망자 카드 발행(will / note → all 채널 줄, k 필드)                                    │
 └─────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                 │
   viewer 별 snap (worldVisibleTo — 보는 사람별 한 함수, 라이브·재접속 공용)
     산 마피아(밤)  : 산 사람 전원 (시민 = home, 마피아 = 현재 구간)
     산 시민 편(밤) : 본인 한 칸만                           ← 마피아가 뭘 하든 같은 내용
     유령           : 전원
     아침(모두)     : 산 사람 전원 = home (유령은 전원)       ← 모든 산 소켓에 같은 내용(L5)

 밤 30초 동안 (조기 종료 없음)
   마피아 move  ──audience(world, mover=산 마피아, night)──► {산 마피아, 유령}     시민: 0 프레임
   마피아 pick  ──pickRecipientIds (기존)────────────────────► {산 마피아, 탈락자}
   마피아 chat/typing ──audience(chat/typing, ch=mafia)─────► {산 마피아, 탈락자}
   경찰·의사 pick ──────────────────────────────────────────► 본인 + 탈락자
   will / note 저장 ────────────────────────────────────────► 본인(note 는 산 마피아 전원)에게만 state
                 │ 마감
                 ▼
 tick: night → morning  (enterMorning: confirmedTarget → 의사 보호 → 탈락, nightLog, morning{eliminated?,saved?,…}, 길이 = f(공개 내용))
        │  체감: 클라이언트는 서버 마감(공개 정보) 420ms 전부터 가림막을 미리 덮어 두어 스냅샷 적용이 가려진다
        ▼
 아침 (5~11초) → dayAnnounce (분필은 다음 밤 진입까지 view.day.chalk 로 유지)
```

### Recommended Project Structure (이름은 플래너가 확정 — 권고안)

```
shared/game/
├── night.ts          # confirmedTarget(), resolveNight 재작성(난수·phrase 제거), saveNote()/saveWill 규칙, enterNight 가 nightNote·chalk 정리
├── will.ts (선택)    # saveWill(state, actorId, text) 순수 규칙 — night.ts 가 커지면 분리
├── discussion.ts     # phaseDurationOf: morning 은 morningMsOf(state.morning)
├── movement.ts       # canMoveIn(phase, alive, isMafia?) 밤 마피아 허용
├── audience.ts       # world 분기: 밤 + 산 마피아 mover → {산 마피아, 유령}; worldVisibleTo: 밤 viewer 분기
├── world.ts          # WorldState.home?: HomeMemo, StoredWorld.home, parseStoredHome, captureHome(), teleportAll()
└── bots.ts           # 마피아 봇 협응 + (선택) will 봇 행동
worker/room.ts        # afterTransition 합치기, 월드 동기화(밤/아침), handleWill/handleNote, 카드 발행
shared/protocol.ts    # ClientMessage will/note, MyInfo.will/note/득표 집계, MorningView.saved(phrase 삭제), DayView.chalk, ChatLineWire.k
shared/schemas.ts     # will/note strictObject
src/world/tension.ts  # 시민 편 긴장 스케줄러(순수, 연결·스토어 import 금지)
src/components/v2/    # FaceList.tsx, WillSheet.tsx 신규; ChatPanel 카드·깃펜; HeadStack sureLabel; V2Icon 5종
```

### Pattern 1: 밤 audience 분기 (서버가 안 보낸다)

**What:** `audience(state, {k:"world", mover})` 에서 `state.phase === "night"` 이고 mover 가 산 마피아면 받는 사람 = (산 마피아 + 탈락자). mover 가 유령이면 기존대로 탈락자. 밤에 산 비마피아 mover 는 `canMove` 가 먼저 거절하지만 audience 도 fail-closed(빈 집합)로 둔다.
**When to use:** 이동 프레임 전송(`emitWorld`) 한 길.
**Example:**
```typescript
// 권고안 (audience.ts 의 world 분기). 실제 코드 줄은 audience.ts:59-64 를 대체한다.
if (ev.k === "world") {
  if (state.phase === "lobby") return pick(() => true);
  if (!MAP_PHASES.has(state.phase)) return new Set();
  const mover = ev.mover === undefined ? undefined : state.players.find((p) => p.id === ev.mover);
  if (mover === undefined) return new Set();
  if (!isAlive(mover)) return pick((p) => !isAlive(p));                    // 유령: 유령만 (GHOST-01)
  if (state.phase === "night") {
    return mover.role === "mafia" ? pick((p) => !isAlive(p) || (isAlive(p) && p.role === "mafia")) : new Set(); // NIGHT-07
  }
  return pick(() => true);
}
```

### Pattern 2: 보는 사람별 스냅샷 한 함수 (라이브·재접속·전환 공용, L9)

**What:** `worldVisibleTo(state, viewerId)` 가 밤 분기를 갖는다 — 산 마피아·유령은 (산 사람 전원 / 전원), 산 시민 편은 `{본인}`. 그리고 **좌표 자체도 viewer 별**이어야 한다: 산 마피아 viewer 에게는 시민 편의 위치가 곧 home 이고 마피아 구간은 현재 값이다(시민 편 구간은 안 움직였으므로 `this.world.segs` 그대로가 맞다). 시민 편 viewer 는 본인 한 칸이라 마피아 위치가 애초에 입력에 들어가지 않는다.
**핵심:** `handleHello`·밤 진입·아침 진입이 모두 `deliver(new Set([viewerId]), snapFrame(world, players.filter(visible)))` **같은 호출 모양**을 쓴다. 새 길(전체 방송)을 만들지 않는다.

### Pattern 3: `home` 기억은 world 저장 키의 확장 (기존 `lay` 와 같은 모양)

**What:** `WorldState.home?: { day: number; pos: Record<playerId, [x, z]> }`, `StoredWorld.home?` 를 `lay` 와 같은 방식(`compactWorld` 에 포함, `restoreWorld` 에서 `parseStoredHome` 으로 형태 검사, `despawnPlayer` 에서 슬롯 제거, `respawnAll` 에서 초기화)으로 둔다.
**캡처 시점:** `syncLayout` 맨 앞에서 "단계가 걷기 단계(dayAnnounce·discussion)가 아니고 `home.day !== room.day`" 일 때 현재 구간의 **끝점**(`p[p.length-2], p[p.length-1]`)을 기록한다. 이렇게 하면 (a) 알람이 늦어 `discussion → nomination → night` 를 한 번에 건너뛰어도(월드는 아직 토론 끝 자리) 맞고, (b) 시계(`now`)에 의존하지 않아 테스트가 결정적이며, (c) 걷던 사람은 "가던 곳"이 home 이 된다.
**flush:** 캡처·순간이동 직후 `flushWorld()` 를 부른다 — 8페이즈 테스트 도우미 `editRoom`/`toPhase`/`killSeats` 가 DO 를 퇴거시키고 생성자가 `world` 키에서 복원하는데, 디바운스(2초) 안에 퇴거되면 `home` 이 사라진다. **home 이 없으면 순간이동하지 않고 현재 자리 유지(fail-safe)**.

### Pattern 4: 밤·아침 위치 동기화는 `syncLayout` 과 같은 멱등 키

**What:** `lay.key` 에 `{일차}:night`, `{일차}:morning` 을 더한다. 키가 같으면 아무것도 안 한다(알람 따라잡기·퇴거에도 안전). 이동은 걷기 경로(`planMoveSegment`)가 아니라 `restSegment(home.x, home.z, now)` + `forceSegment`(150ms 간격·`lastMoveAt` 건드리지 않음). 프레임은 `move` 가 아니라 **viewer 별 snap** 으로 보낸다(`move` 는 `audience` 가 mover 기준이라 시민 편 밤 스냅샷을 못 만든다).
- `night` 키: 산 사람 전원 home 으로. (유령은 건드리지 않는다.)
- `morning` 키: 산 사람 전원 home 으로(마피아가 걸은 구간 폐기, A1). **피해자도 포함** — 피해자는 이미 탈락했으니 `isAlive` 가 아니라 "morning 진입 시 탈락한 사람" 이 되므로 home 순간이동 대상에 넣어 유령 시작 자리 = 분필 자리로 맞춘다.
- 기억 슬롯(`lay.slots`)은 건드리지 않는다. 다음 낮 지목 키(`{일차+1}:ring`)와 겹치지 않는다.

### Pattern 5: 분필은 "공개 위치"로 view 에 싣는다

**What:** `RoomState.chalk?: { x: number; z: number }`(고정소수점) 를 DO 가 `afterTransition` 에서 tick 직후·`persistAndBroadcast` 직전에 채우고(`next.morning?.eliminated` 의 home), `buildDay` 가 `day.chalk` 로 복사한다. `enterNight` 가 키째 지운다(다음 밤 시작까지 유지 = UI-SPEC). 처형에는 분필이 없다. 유령·재접속 첫 스냅샷에서도 view 가 곧 진실이다.
**왜 RoomState 인가:** 진입 훅은 순수라 world 에 접근할 수 없다. 대안(분필 전용 world 프레임)은 프레임 종류·누설 표면이 늘어 기각.

### Pattern 6: 카드는 서버가 만든 `all` 채널 줄 (kind 필드)

**What:** `ChatRecord`/`ChatLineWire` 에 선택 필드 `k?: "will" | "note"` 를 더한다. `seat` 는 유언·쪽지 모두 **피해자 seat**(쪽지에 작성자 seat 가 없다 — 익명). 제목 "{닉네임} 님의 유언" / "쪽지" 는 화면이 `k` 와 seat 로 만든다. 발행은 DO 가 tick 전후 비교로 "방금 탈락한 사람" 을 찾아 `appendLine` + `storage.put(chatKey)` + `deliver(audience(all))` 한다(`applyChat` 와 같은 본체 모양, `chatRates` 우회). 처형(`enterExecution`)과 암살(`enterMorning`) 둘 다 이 한 길이다.
**표시 시각:** 서버는 진입 즉시 발행하고, 클라이언트가 라이브로 받은 `k` 줄을 아침 2.8초(처형 2.4초)까지 보류한다(UI-SPEC). 재접속 `chatLog` 로 받은 카드는 바로 보인다. 화면 보류는 비밀 유지와 무관(내용은 이미 공개).
**주의:** 죽기 전에는 카드 줄이 존재하지 않는다 — 유언은 `Player.will` 에만 있다.

### Pattern 7: 유언·쪽지 메시지 = 응답은 본인에게만

**What:** `{t:"will", text}`·`{t:"note", text}` (`z.strictObject`, `text ≤ CHAT_TEXT_MAX_UTF16`). 신원은 소켓 첨부 playerId 뿐. 규칙 함수(순수)가 검사: 단계(MAP_PHASES 중 로비·역할확인 제외) → 산 사람 → 본문 정리(`sanitizeChatText` 재사용, **빈 문자열은 "지움" 으로 허용**) → 같은 값이면 같은 객체. `will` 성공은 저장 + **저장한 본인 소켓에만** `sendViewTo([playerId])`(A4: `me.will`). `note` 는 산 마피아 전원에게(`pickRecipientIds` 와 같은 모양, 단 관전자 제외 가능). **절대 `persistAndBroadcast` 를 부르지 않는다**(전원 방송은 "누군가 썼다" 타이밍을 흘린다).
**속도 제한:** DO 인메모리 `Map<playerId, lastAt>`(`pointAt` 선례), 초과는 조용히 폐기(오류 프레임 없음). 시작값 제안: 최소 간격 500ms. [ASSUMED]

### Pattern 8: 마피아 확정은 순수 함수 하나

```typescript
// 권고안 — shared/game/night.ts. 보기·판정·쪽지 허용이 모두 이 한 함수를 쓴다.
/** 산 마피아가 1명 이상이고 전원이 같은 산 비마피아 대상을 골랐을 때만 그 seat, 아니면 undefined. 연결 상태는 보지 않는다. */
export function confirmedTarget(state: RoomState): number | undefined {
  const mafia = state.players.filter((p) => isAlive(p) && p.role === "mafia");
  if (mafia.length === 0) return undefined;
  const first = mafia[0]!.nightPick;
  if (first === undefined) return undefined;
  if (!mafia.every((p) => p.nightPick === first)) return undefined;
  const t = state.players.find((p) => p.seat === first);
  return t !== undefined && isAlive(t) && t.role !== "mafia" ? first : undefined;
}
```
`resolveNight` 는 이 값 하나로 `target` 을 정하고 **`randInt` 를 부르지 않는다**(동률 추첨·문구 추첨 삭제). 의사 보호·경찰 조사·암살일지·치료일지·`nightLog` 는 그대로 유지한다(검증: night.ts:109-138).

### Pattern 9: 마피아 득표 집계 필드 (보기용, 마피아 + 유령에게만)

현재 `allyPicks`(집합)로는 "마피아 2명 중 몇이 이 대상을 골랐나" 와 "전원 일치" 를 알 수 없다. 권고: 산 마피아 view 에 `me.nightTally?: Array<{ seat: number; n: number }>`(마피아가 고른 대상별 인원수, 본인 포함, seat 오름차순) 와 `me.sure?: number`(= `confirmedTarget`) 를 싣고, 유령 `spectate.picks` 는 그대로 둔다. 시민 편·경찰·의사 view 에는 키 자체가 없다. 누가 골랐는지(개인 단위)는 싣지 않는다(기존 D-07 유지). 이름은 플래너 재량.

### Pattern 10: 클라이언트 연출은 받은 프레임과 단절 (L3)

`src/world/tension.ts`: 입력은 `rng: () => number`, 시계 `now: () => number`, `reducedMotion` 뿐인 **순수 스케줄러**(2~4회, 4~9초 간격, 첫 큐는 밤 시작 5초 뒤 이후). 큐는 이벤트 이미터로 내보내 12페이즈가 같은 시각에 소리를 얹는다. `connection`·`store`·`useRoomConnection`·`world/store` 를 import 하지 않는다 → **정적 검사 테스트**(`chatStaticGuard.test.ts` 선례)로 import 줄을 고정한다. 밤 시작/종료는 부모가 마운트/언마운트로 알리고(마운트 시각 = 로컬 시계), 서버 시각·프레임 필드는 전달하지 않는다.

### Anti-Patterns to Avoid

- **받은 뒤 화면에서 거르기:** 시민 편 소켓에 마피아 프레임을 보내고 `scene.seats` 로 숨기는 것. 금지(결정 0002·0021).
- **밤 판정에 `randInt`:** 확정 조건이 전원 일치이므로 난수가 필요 없다. 난수를 남기면 메타모픽 테스트의 결정성이 깨진다.
- **세 경로에 복제된 전환 후처리:** 현재 `advance`·`applyEndDiscussion`·`handleTestSkip` 가 각각 `persistAndBroadcast → snapNewGhosts → syncLayout` 를 반복한다. 여기에 home/chalk/카드까지 세 번 복붙하면 한 경로(테스트 skip)만 빠지는 버그가 난다. **한 함수로 합친다.**
- **구출을 "무사" 와 다른 길이/다른 부수 프레임으로 처리:** 공개 차이는 `saved` 플래그 하나뿐이어야 한다(아래 Pitfall 4).
- **유언을 `view` 의 공개 키에 싣기:** `me.will` 은 본인 view 에만. 서버 전용 `Player.will`·`nightNote` 는 `SERVER_ONLY_KEYS` 목록에 추가해 어떤 프레임에도 없음을 검사한다.
- **긴장 연출을 서버 `phaseEndsAt`/`serverNow` 에 맞추기:** 밤 시작·마감 같은 공개 시각조차 큐 시각의 함수로 쓰지 않는다(큐는 로컬 마운트 시각 기준).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 받는 사람 계산 | 밤 전용 전송 함수·소켓 순회 | `audience()`·`worldVisibleTo()`·`deliver()`·`sendViewTo()` 에 분기 추가 | 이벤트 프레임의 유일한 길. 새 길은 누설 표면(`deliver` 주석) |
| 유언 본문 정리 | 자체 정규식·길이 판정 | `sanitizeChatText`(NFC·제어문자·자소 100) | 이미 닉네임·채팅과 같은 기준, 보이는 글자 없음 처리 포함 |
| 카드 보관·복원 | 새 저장소 키·새 복원 코드 | `appendLine`/`chatKey`/`replayFor`(`r` 마스크) + `k` 필드 | 보관 상한·재접속 복원·누설 검사가 이미 있다 |
| 위치 저장 | 별도 storage 키 | `world` 키(`compactWorld`/`restoreWorld`)에 `home` 추가 | 한 번에 읽히고 `parseStored*` 형태 검사 선례(`parseStoredLay`) |
| 순간이동 | 클라이언트 보간 꼼수 | `forceSegment` + `restSegment` + `snap` 프레임 | store 가 snap 에 연출 없이 즉시 맞춘다 |
| 타이머 기반 아침 카드 지연(서버) | 알람 새로 걸기 | 클라이언트 보류 + 서버는 진입 즉시 발행 | 알람 하나(단계 마감·봇·배회)에 새 종류를 얹지 않는다. 재접속은 어차피 즉시 표시 |
| 누설 증명 | 수작업 프레임 눈검사 | `ghostLeak.test.ts` 의 `observe`/`settle`/`stable` + 저장소 스냅샷·복원 | 같은 방·같은 상태에서 두 번 돌리는 메타모픽 방식이 이미 증명됨 |
| 얼굴 그림 | 새로 그리기 | 승인 에셋 `Faces/face-{seat}.png` 복사 | 에셋이 주어짐 |

**Key insight:** 이 페이즈의 위험은 "새로 만드는 것" 보다 "기존 길(audience/snapshot/broadcast)을 우회하는 새 길을 무심코 만드는 것" 이다. 새 전송 경로가 하나라도 생기면 L1~L9 증명이 깨진다.

## Common Pitfalls

### Pitfall 1: 재접속 첫 스냅샷이 마피아 위치를 시민에게 준다
**What goes wrong:** `handleHello` 는 `worldVisibleTo(room, id)` 의 좌석들을 `snapFrame(this.world, …)` 로 보낸다. 지금 밤에 산 시민 viewer 의 visible = 산 사람 전원이라 **마피아가 걸은 현재 위치**가 간다.
**Why:** 라이브 이동 프레임은 audience 로 막혀도 접속 스냅샷은 다른 함수(`worldVisibleTo`)다.
**How to avoid:** 밤 분기를 `worldVisibleTo` 에 넣고(산 시민 편 → `{본인}`), `handleHello`·전환 스냅샷이 모두 이 함수를 쓰게 한다. 테스트: 마피아 걷기 전/후 시민 재접속 첫 프레임 열이 같음(L9).
**Warning signs:** 시민 소켓 snap 의 `ents[].s` 가 본인 하나가 아니다.

### Pitfall 2: `home` 이 지목 단계에 덮여 사라진다 / 저장 전에 DO 가 퇴거된다
**What goes wrong:** 지목 진입 즉시 `syncLayout` 이 둘레 자리로 보내므로 "토론이 끝난 자리" 정보가 없다. 또 `world` 저장은 2초 디바운스라 `editRoom` 식 퇴거나 배포 직후 복원에서 `home` 이 비어 있을 수 있다.
**How to avoid:** `syncLayout` 첫 줄에서 캡처, 즉시 `flushWorld()`. `home` 이 없는 사람은 순간이동 대상에서 빼고 현재 자리 유지.
**Warning signs:** 밤 진입 뒤 모두가 둘레 자리/무대에 서 있다.

### Pitfall 3: 알람 지연으로 밤을 건너뛰어도 아침 위치가 맞아야 한다
**What goes wrong:** `tick` 이 한 번에 `execution → night → morning` 을 따라잡으면 night 키가 적용되지 않은 채 morning 만 온다.
**How to avoid:** 월드 동기화는 "지금 단계가 요구하는 모습" 의 멱등 키 비교(`syncLayout` 선례)로 하고 단계 전환 이벤트에 걸지 않는다. 밤 키를 건너뛰어도 morning 키가 같은 home 으로 맞춘다.

### Pitfall 4: 구출·무사·미선택의 공개 프레임이 달라진다
**What goes wrong:** 길이가 `phaseDurationMs`(모든 view 에 실림)로 새면 "마피아가 누군가를 골랐고 의사가 막았다" 가 시민에게 새거나, 반대로 쪽지 존재 여부가 구출 때 길이로 새어 나간다.
**How to avoid:** 길이는 **공개되는 내용**의 함수: 기본 5초, 피해자가 **실제로 탈락**해야 +2, 그 피해자에게 유언이 있을 때 +2, 쪽지가 있을 때 +2(쪽지는 탈락 때만 공개). 구출 시 쪽지·유언을 길이에서 뺀다 → 구출 = 무사 = 5초. 공개 차이는 `day.morning.saved` 하나뿐(이건 의도된 공개 정보, 결정 0044-22). 테스트: {의사 구출, 마피아 미선택, 마피아 불일치} 세 밤의 `phaseDurationMs` 가 같고, 구출만 `saved` 가 다르다.
**Warning signs:** 구출 때 `nightLog.died` 로 길이를 정하는 코드.

### Pitfall 5: 마피아 협응이 안 되면 테스트 방에서 아무도 안 죽는다
**What goes wrong:** 전원 일치 규칙에서 마피아 봇이 각자 무작위로 고르면 2명일 때 확정 확률이 낮아 한 판 자동 완주(E2E·smoke)가 영원히 안 끝난다. `skipPhase` 의 `botsPickNow` 도 같은 문제.
**How to avoid:** 마피아 봇은 (a) 동료가 이미 고른 산 비마피아가 있으면 그 대상, (b) 없으면 산 비마피아 중 가장 낮은 seat 를 고른다(역할 특권 아님 — 마피아 본인의 정보). 난수 호출 순서 계약(시드 고정 값)이 바뀌므로 `bots.test.ts`·`testTools.test.ts` 의 고정 값을 다시 고정한다.

### Pitfall 6: 끊긴 마피아 한 명이 암살을 영원히 막는다
**What goes wrong:** "산 마피아 전원 일치" 는 연결이 끊겨 선택이 없는 동료 때문에 확정되지 않는다.
**How to avoid:** 이 페이즈는 연결 상태를 판정에 쓰지 않는다(권고, 단순·결정적, 연결 시각이 판정에 안 새므로 누설 없음). 위험은 팀 테스트 관찰 항목으로 넘긴다. **사용자 확인 필요**(Open Question 1).

### Pitfall 7: three.js 점광원 개수 변화는 셰이더 재컴파일
**What goes wrong:** "내 캐릭터에만 작은 빛(1.4)" 을 밤 진입 때 `scene.add(new PointLight())` 로 만들면 광원 개수가 바뀌어 재질이 재컴파일되고 프레임이 끊긴다 [CITED: threejs.org/manual/en/materials — `material.needsUpdate`; discourse "Adding and removing three.js lights at run time"].
**How to avoid:** 광원을 `bar.ts` 에서 처음부터 만들어 두고(세기 0) 시민 편 밤에만 세기를 올린다 — 기존 광원이 이미 이 방식(`bar.ts:494-495`). `RendererStats.pointLights` 단위 테스트가 개수 불변을 고정한다. 추가 광원 1개의 fps 비용은 실측 필요(결정 0055 게이트) [ASSUMED].

### Pitfall 8: 장면 전환 막과 스냅샷의 순서
**What goes wrong:** 서버는 `state` + `snap` 을 마감 시각에 보낸다. 클라이언트가 막을 그 시점에 덮기 시작하면 420ms 동안 순간이동·조명 전환이 그대로 보인다(UI-SPEC 는 "막이 가장 진할 때 적용" 이라고만 한다).
**How to avoid:** 막은 서버가 이미 준 공개 마감(`view.phaseEndsAt`)의 420ms 전에 덮기 시작한다(모든 역할 같은 규칙 → 새 정보 없음). 스냅샷은 도착 즉시 적용해도 이미 불투명하다. 재접속 첫 스냅샷은 막 없음(UI-SPEC). `prefers-reduced-motion` 은 즉시 덮고 즉시 걷음.

### Pitfall 9: 카드 줄이 `chat` 렌더 규칙에 섞인다
**What goes wrong:** 서버 생성 카드는 `seat`(피해자)를 갖지만 사람이 보낸 말이 아니다. `playerLine()`/`ChatStore` 는 `player` 줄로 만들어 이름 말풍선·입력 중 해제(`typing.delete(frame.seat)`)를 일으킨다.
**How to avoid:** `k` 가 있으면 별도 `kind: "card"` 줄로 변환하고 `typing` 정리 로직에서 제외. 누설 검사의 키 허용 목록(`CHAT_KEY_PATHS`, `CHATLOG_KEY_PATHS`)에 `.k` 를 이유와 함께 더한다.

### Pitfall 10: 저장된 옛 방 호환
**What goes wrong:** 배포 시점에 진행 중인 방에 `lastPhrase`·`morning.phrase` 가 남아 있다. 타입에서 지워도 런타임 잔재는 해롭지 않지만(`buildDay` 는 필드별 복사), 정적 가드와 `normalizeStoredRoom` 의 "옛 키" 목록에서 일관되게 다뤄야 한다.
**How to avoid:** `lastPhrase`·`MORNING_PHRASE_COUNT`·`ELIMINATION_TAILS` 를 `dayStaticGuard.test.ts` 의 `SERVER_REMOVED_IDENTIFIERS`/`REMOVED_DAY_IDENTIFIERS` 에 추가. 진행 중 방은 밤 규칙이 바뀌는 순간 이전된다(수용 가능 — 8페이즈도 같은 선례).

### Pitfall 11: 한글 조합 중 저장·닫기
**What goes wrong:** 유언 시트 [저장]/닫기 시 조합 꼬리(`compositionend` 전 값)가 서버로 간다.
**How to avoid:** 7페이즈 IME 규칙(`useChat`)을 재사용하는 훅으로 조합 종료 값을 확정한 뒤 보낸다. 서버는 `sanitizeChatText` 로 한 번 더 정리.

## Code Examples

### 아침 길이 (순수, 공개 내용만의 함수)
```typescript
// 권고안 — shared/game/phases.ts 또는 discussion.ts. UI-SPEC 시작값(5/+2/+2/+2, 상한 15) — 한 곳에서만 고친다.
export const MORNING_BASE_MS = 5_000;
export const MORNING_VICTIM_MS = 2_000;
export const MORNING_WILL_MS = 2_000;
export const MORNING_NOTE_MS = 2_000;
export const MORNING_MAX_MS = 15_000;

export function morningMsOf(m: { eliminated?: number; hasWill?: boolean; hasNote?: boolean } | undefined): number {
  if (m?.eliminated === undefined) return MORNING_BASE_MS; // 무사·구출·미선택은 모두 같다
  const ms = MORNING_BASE_MS + MORNING_VICTIM_MS + (m.hasWill ? MORNING_WILL_MS : 0) + (m.hasNote ? MORNING_NOTE_MS : 0);
  return Math.min(ms, MORNING_MAX_MS);
}
// phaseDurationOf(state): phase === "morning" 이면 morningMsOf(state.morning), 그 밖은 PHASE_DEFS[phase].durationMs
```
`state.morning` 의 `hasWill/hasNote` 는 서버 전용 키로 두고 `buildDay` 는 `eliminated`·`saved` 만 복사한다(허용 목록 리터럴, view.ts:98-107 와 같은 방식). `tick.ts:93-95` 가 훅 뒤 상태로 마감을 다시 정하므로 별도 알람 로직이 필요 없다.

### 메타모픽 누설 테스트 골격 (worker 프로젝트)
```typescript
// 권고안 — test/worker/nightLeak.test.ts. ghostLeak.test.ts 의 observe/stable 패턴(휘발 필드 제거)을 helpers.ts 로 옮겨 공유한다.
// 1) 직접 불변식: 마피아가 움직이고 고르고 말하는 동안 순수 시민 소켓 프레임은 0개 — settle() 이 "[]" 를 돌려준다.
// 2) 메타모픽: 밤 진입 직후 storage 전체(room·world·chat:*)를 스냅샷 → 구간 A(마피아 가만히) 실행 → 스냅샷 복원 + DO 퇴거 → 구간 B(마피아 걷기·선택·채팅·입력 중) 실행.
//    같은 결과(둘 다 무사 또는 둘 다 같은 피해자)가 나오게 대본을 짜고, 시민 편 소켓의 [밤 진입 ~ 아침 진입 ~ 낮 시작] 프레임 열을 stable()로 비교.
// 3) 재접속(L9): 두 구간 모두에서 시민 소켓을 새로 hello → 첫 프레임 열 [state, world snap(본인 한 칸), chatLog] 이 같음.
const VOLATILE = new Set(["serverNow", "phaseEndsAt", "t0", "at", "c", "seq"]); // ghostLeak.test.ts 와 같은 목록
```
복원 도구가 없으므로 helpers 에 `snapshotStorage(code)`/`restoreStorage(code, snap)`(`runInDurableObject` + `state.storage.list()`/`deleteAll`/`put`, 이후 `evictDurableObject`)를 더한다 — `forceDue` 가 이미 같은 퇴거 방식을 쓴다 [VERIFIED: test/worker/helpers.ts `forceDue`].

### 밤 진입 월드 동기화 (DO, 개요)
```typescript
// 권고안 — worker/room.ts. 단계 전환 이벤트가 아니라 "지금 단계가 요구하는 모습"의 멱등 동기화.
private syncHome(now: number): void {
  const room = this.room; if (!room) return;
  const key = room.phase === "night" ? `${room.day ?? 0}:night` : room.phase === "morning" ? `${room.day ?? 0}:morning` : null;
  if (key === null || key === this.world.lay?.key) return;
  // home 이 있는 산 사람(아침이면 방금 탈락한 피해자 포함)을 restSegment 로 순간이동 (forceSegment: 150ms 간격·lastMoveAt 무관)
  // lay: { key, slots: this.world.lay?.slots ?? {} } 로 키만 갱신 → flushWorld()
  // 그 뒤 viewer 별 snap: for each 연결된 사람 v → deliver(new Set([v.id]), snapFrame(this.world, players.filter(worldVisibleTo(room, v.id).has)))
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 마피아 다수결·동률 무작위, 아침 문구 7종 | 산 마피아 전원 일치만 확정, 난수 없음, 문구 없음 | 이 페이즈(결정 0044-20, UI-SPEC) | `resolveNight`·`night.test.ts`(784줄)·`eliminationText` 재작성/삭제 |
| 의사 구출 비공개(4페이즈 D-13) | "누군가 살아났습니다" 공개 플래그 | 결정 0044-22 | `MorningView.saved`, 요약·`nightLog` 는 그대로 서버 전용 |
| 밤 = 선 자리 그대로 + 이름표 선택 임시 틀(8페이즈 A1) | 마피아 보행 + 얼굴 목록 + 시민 어둠 | 이 페이즈 | 삭제 목록(UI-SPEC "삭제 목록") |
| 아침 시작 = 밤이 끝난 자리(0044-18 뒷문장) | 밤 시작 자리로 되돌림(A1) | 이 페이즈, 새 결정 0061 | 정체 누설 차단 |
| 고정 `MORNING_MS` 5초 | 내용 함수(5~11초) | 이 페이즈 | `tick` 의 길이 재계산 활용 |

**Deprecated/outdated (이 페이즈가 지운다):** `NightPanel`·`PickPill`·`NoticePill`·`NIGHT_PANEL_TEXT`, `GamePanel` 의 `nightPill`, `GameMap` 의 밤 이름표 선택(`PICK_VERB` 경찰·의사), `ELIMINATION_TAILS`·`morningCardText` 의 번호 문구, `MORNING_PHRASE_COUNT`, `lastPhrase`, `DAY_COPY.mafiaNightHint`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `home` = 토론 끝 시점 구간의 **끝점**(걷던 사람은 가던 곳). 시각 기준 위치(`positionAtFx`)가 아님 | Pattern 3 | 걷던 사람이 목적지가 아닌 중간 지점으로 돌아가기를 원하면 의미가 달라짐(영향 작음) |
| A2 | 시민 편 밤 snap = 본인 한 칸. UI-SPEC L5 문구("모든 소켓에 같은 내용")는 아침 스냅샷에만 엄밀히 적용 | Pattern 2, Open Q2 | 사용자가 "밤 진입도 전원 같은 내용" 을 원하면 시민 편에도 산 사람 home 전원을 보냄(누설은 아님) |
| A3 | 마피아 확정 판정에 연결 상태를 쓰지 않는다 | Pitfall 6, Open Q1 | 끊긴 마피아 1명이 암살을 막음 — 팀 테스트에서 드러날 수 있음 |
| A4 | 카드는 서버가 진입 즉시 발행하고 클라이언트가 2.8초(처형 2.4초)까지 표시를 보류 | Pattern 6 | 보류 구현이 복잡하면 서버 지연 발행(알람)으로 바꿔야 함 |
| A5 | `will`/`note` 저장 최소 간격 500ms, 초과는 조용히 폐기 | Pattern 7 | 너무 느슨/빡빡하면 조정(서버 한 곳) |
| A6 | `RoomState.chalk` 를 DO 가 tick 직후·방송 직전에 채우는 방식이 `RoomState` 저장 1회로 끝남 | Pattern 5 | 방송과 저장 순서를 어기면 morning 첫 view 에 분필이 빠짐 |
| A7 | 시민 편 어둠용 "내 캐릭터 작은 빛(1.4)" 광원 1개를 상시 생성(세기 0)해도 55fps 게이트를 통과 | Pitfall 7 | 미달 시 emissive 보정 등 대체(결정 0055 사다리) |
| A8 | UI-SPEC 의 아침 길이 시작값(5/+2/+2/+2, 상한 15)은 사용자 승인 문서의 값이라 그대로 쓴다 | Code Examples | 팀 테스트 후 서버 한 곳에서 조정 |
| A9 | 마피아 봇 협응(동료 선택 따라가기 → 최저 seat)과 `skipPhase` 의 `botsPickNow` 동일 처리 | Pitfall 5 | 시드 고정 테스트 재고정 범위 |
| A10 | 얼굴 PNG 8장 복사본은 앱에서 같은 출처로 서빙(외부 로드 없음) | Standard Stack | `public/` 에셋 테스트(`assets.test.ts`) 갱신 필요 |

## Open Questions

1. **끊긴 마피아가 확정을 막는 문제 (A3)**
   - What we know: 판정은 서버 값(선택 유무)만 보면 결정적이고 연결 시각이 새지 않는다. `view.players[].connected` 는 이미 공개 정보다.
   - What's unclear: 사용자가 "끊긴 동료는 기권으로 쳐 준다" 를 원하는지.
   - Recommendation: 이 페이즈는 연결을 무시(권고). 팀 테스트 관찰 항목에 "확정 실패 원인(끊김 포함)" 를 더한다.

2. **밤 진입 스냅샷의 시민 편 내용 (A2)**
   - What we know: UI-SPEC L5 는 "아침·밤 진입의 위치 스냅샷은 모든 소켓에 같은 내용" 이라 쓰지만, 같은 문서의 L1·장면 표는 "시민 편 이름표 층에는 내 이름표 하나뿐" 이라 쓴다.
   - What's unclear: 시민 편에게 산 사람 home 전원을 줄지, 본인만 줄지.
   - Recommendation: 본인만. L5 는 "마피아의 밤 위치가 담기지 않는다" 로 읽는다(아침 스냅샷은 모든 산 소켓 동일). 결정 0061 에 한 줄로 못박는다.

3. **마피아 봇이 밤에 걷는가**
   - What we know: 유령 관전·분필·E2E 의 "마피아 이동이 유령에게만 간다" 검증에 봇의 이동이 있으면 편하다.
   - Recommendation: 봇 계획에 `move` 한 번(대상 옆 점)을 선택 사항으로 추가하되 필수 아님. 사람 E2E 는 실제 마피아 페이지가 걷는다.

4. **`note` 저장 허용 시점**
   - Recommendation: 저장 시점에 `confirmedTarget` 이 있을 때만 수락(UI-SPEC 와 동일). 확정이 풀려도 저장된 글은 임시로 남고(`nightNote`), 판정 때 확정+실제 탈락이 아니면 버린다. 마피아 둘 이상의 동시 편집은 "마지막 저장이 이김"(UI-SPEC 남은 위험 10).

5. **결정 0061 의 내용**
   - Recommendation: (a) 0044-18 뒷문장 개정(A1), (b) 0044-22 의 공개 플래그 `saved`(D-13 개정), (c) 확정 조건 구체화(A2, 연결 무시), (d) 시민 편 밤 스냅샷 규칙(Q2). 첫 계획의 첫 작업으로 넣는다(UI-SPEC 남은 위험 1).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | 모든 테스트·스크립트 | ✓ | v26.13.0 (`engines >=22.12` 충족) | — |
| vitest 3 프로젝트 | 검증 | ✓ | 4.1.12 (`package.json`) | — |
| 시스템 Chrome | E2E(`scripts/e2e`) | ✓ | `/Applications/Google Chrome.app` 존재 | — |
| wrangler + 배포 가드 | 배포본 E2E·smoke | ✓(스크립트 존재) | 4.151.3 | 로컬 `npm run dev` 후 `--url http://localhost:5173` |
| 실기기(iPhone 16 Pro 등) | 성능·어둠 가독 | ✗(이 환경) | — | 사용자 결정: 모든 개발 뒤 한꺼번에(백로그 999.x) |

**Missing dependencies with no fallback:** 없음(실기기는 사용자 결정으로 미룸).
**Missing dependencies with fallback:** 실기기 → 자동 검사 + 크롬 CPU 4× 스로틀(`scripts/perf-run.mjs`).

## Validation Architecture

> `workflow.nyquist_validation: true`, `tdd_mode: true` (`.planning/config.json`) [VERIFIED: config.json].

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.12 — projects `unit`(node, `test/unit/**`)·`client`(happy-dom, `test/client/**`)·`worker`(workerd, `test/worker/**`); `node --test`(scripts); playwright-core 1.64.1 E2E |
| Config file | `vitest.config.ts` (변경 없음) |
| Quick run command | `npx vitest run <바꾼 테스트 파일>` |
| Full suite command | `npx vitest run && node --test scripts/*.test.mjs scripts/e2e/lib.test.mjs && npm run typecheck` |
| 화면 E2E | `npm run dev` 후 `npm run e2e -- --url http://localhost:5173 --only <흐름>` (인자 없으면 배포본) |
| 기준선 | 8페이즈 종료 시 vitest 143 파일 / 3897 통과 / 1 건너뜀, node --test 288 [CITED: 08-RESEARCH.md Validation — 이번 세션에 재측정하지 않음] |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NIGHT-07 | 마피아 이동은 {산 마피아, 유령}에게만, 시민 편 소켓 0프레임, 산 시민 move 거절, 시민 snap 본인 한 칸 | worker + unit | `npx vitest run test/worker/nightLeak.test.ts test/unit/audience.test.ts test/unit/movement.test.ts` | ❌ Wave 0 (nightLeak 신규) / 개정 |
| NIGHT-07 | **메타모픽**: 마피아 가만히(A) vs 걷기·선택·채팅·입력 중(B) 시민 프레임 열 동일 + 재접속 첫 프레임 열 동일 | worker | `npx vitest run test/worker/nightLeak.test.ts -t "메타모픽"` | ❌ Wave 0 |
| NIGHT-07 | 토론 끝 자리 `home` 캡처·저장·복원·순간이동(걷던 사람, 알람 지연, 퇴거) | unit + worker | `npx vitest run test/unit/world.test.ts test/worker/world.test.ts -t home` | 개정 + ❌ |
| NIGHT-08 | `confirmedTarget` 표(1~3마피아, 일부 미선택, 불일치, 탈락 대상, 마피아 대상), 난수 호출 0회 | unit | `npx vitest run test/unit/night.test.ts` | 개정(784줄) |
| NIGHT-08 | 불일치 밤 무사, 일치 밤 사망, 의사 보호, 경찰 조사 동시 해결 유지 | worker | `npx vitest run test/worker/night.test.ts` | 개정 |
| NIGHT-09 | 경찰 자기 선택 거절·의사 자기 선택 허용(기존), 선택은 본인(+관전)에게만 | unit + worker | `npx vitest run test/unit/night.test.ts test/worker/night.test.ts` | 기존 유지 |
| NIGHT-09 | `FaceList` 4열·선택 표시·`aria-pressed`·진홍 없음·8자 이름 줄바꿈·그림 실패 대체 | client | `npx vitest run test/client/faceList.test.tsx` | ❌ Wave 0 |
| NIGHT-10 | 긴장 스케줄러(2~4회, 4~9초, 첫 큐 ≥5초, 난수·시계 주입, 모션 줄이기) | unit | `npx vitest run test/unit/tension.test.ts` | ❌ Wave 0 |
| NIGHT-10 | **정적 검사**: `tension.ts` 가 연결·스토어·world 프레임 모듈을 import 하지 않음, 서버 시각 필드 미사용 | unit(정적) | `npx vitest run test/unit/tensionStaticGuard.test.ts` | ❌ Wave 0 |
| NIGHT-10 | 시민·경찰·의사 DOM 이 같은 어둠·맥박(`data-night-dark`, `data-tension-pulse`), 시민 편 DOM 에 내 이름표 외 이름표·`[data-role-chip]` 0 | client | `npx vitest run test/client/nightMap.test.tsx` | 개정 |
| NIGHT-11 | `alive` 차이로 피해자만 이펙트(`data-kill-fx`), 구출·재접속 첫 스냅샷은 무이펙트, 모션 줄이기 | client + unit | `npx vitest run test/client/killFx.test.tsx test/unit/dayView.test.ts` | ❌ Wave 0 / 개정 |
| NIGHT-12 | 쪽지: 마피아만·확정 때만 저장, 산 마피아 전원 동일 글, 확정 아니면 폐기, 구출이면 비공개 | unit + worker | `npx vitest run test/unit/night.test.ts test/worker/will.test.ts` | ❌ Wave 0 |
| MORN-01 | 피해자 `home` → `day.chalk`, 다음 밤 진입에서 제거, 처형엔 없음, 재접속 view 에 있음, 유령에도 같은 값 | unit + worker | `npx vitest run test/unit/view.test.ts test/worker/night.test.ts -t 분필` | 개정 |
| MORN-02 | 암살·처형 사망 시 `all` 채널 카드 줄(k=will/note, seat=피해자), 비어 있으면 없음, 재접속 `chatLog` 복원, 프레임 키 허용 목록 | worker | `npx vitest run test/worker/morningCards.test.ts test/worker/chatReplay.test.ts` | ❌ Wave 0 / 개정 |
| MORN-02 | 카드 렌더(제목·아이콘·쪽지 진홍 테두리·긴 본문 줄바꿈·React 텍스트 노드) | client | `npx vitest run test/client/chatPanel.test.tsx` | 개정 |
| MORN-03 | `saved` 공개, 구출 시 유언·쪽지·카드·길이가 "무사" 와 동일, 보호받은 사람에게 개별 프레임 0 | worker + unit | `npx vitest run test/worker/nightLeak.test.ts test/unit/view.test.ts` | ❌ / 개정 |
| MORN-04 | `morningMsOf` 표(무사 5s, 피해자 7s, +유언 9s, +쪽지 11s, 상한), `tick` 이 훅 뒤 상태로 마감을 정함, **구출·미선택·불일치 길이 동일(L6)** | unit + worker | `npx vitest run test/unit/phases.test.ts test/unit/tick.test.ts test/worker/nightLeak.test.ts` | 개정 |
| WILL-01 | 유언 규칙(산 사람·단계·100자·빈 값=지움·죽은 뒤 수정 불가), 본인 소켓에만 `me.will`, 쓰는 동안 타인 소켓 0프레임·입력 중 없음, **죽기 전 남의 어떤 프레임에도 canary 문자열 없음** | unit + worker | `npx vitest run test/unit/will.test.ts test/worker/will.test.ts test/worker/leak.test.ts` | ❌ Wave 0 / 개정 |
| WILL-01 | `WillSheet`(100자 카운터·저장됨·IME 조합 중 저장·실패 시 시트 유지·`role="dialog"` 초점) | client | `npx vitest run test/client/willSheet.test.tsx` | ❌ Wave 0 |
| (공통) | 허용 목록을 넓히지 않고 새 필드(`me.will`·`me.note`·집계·`day.chalk`·`morning.saved`·`k`)를 이유와 함께 추가, 신분 행렬(시민·경찰·의사·마피아·유령·피해자)에 행 추가 | worker(누설) | `npx vitest run test/worker/leak.test.ts test/worker/ghostLeak.test.ts` | 개정 |
| (공통) | 지운 이름 재등장 방지(`NightPanel`·`PickPill`·`ELIMINATION_TAILS`·`lastPhrase`…) | unit(정적) | `npx vitest run test/unit/dayStaticGuard.test.ts` | 개정 |
| (공통) | 테스트 방 봇이 새 밤 규칙으로 한 판 자동 완주(마피아 협응) | worker + script | `npx vitest run test/worker/bots.test.ts test/unit/bots.test.ts test/unit/testTools.test.ts` ; `node scripts/smoke.mjs http://localhost:5173 --stage full --players 5` | 개정 |
| (공통) | 밤·아침 화면 G(글자 14px·누르기 44px·가로 넘침 없음)·H(헤더 대비 4.5:1)·6 폰 크기에서 내 이름표가 스테이지 안에 완전히 들어옴·이름표 버튼 44×44·얼굴 칸 8자 이름 넘침 없음, 흐름 E2E(암살→분필·카드, 구출, 불일치 무사, 처형 유언, 경찰 결과) | E2E | `npm run e2e -- --url http://localhost:5173 --only night` | 개정(`night-roles` 재작성) |
| (공통) | 낮+밤+아침 전체 흐름 5분 평균 55fps | script | `node scripts/perf-run.mjs …`(밤·아침 시나리오 추가) | 개정 |

### Sampling Rate
- **Per task commit:** 바꾼 파일의 테스트 + 해당 쪽 `tsc`(앱: `npx tsc -p tsconfig.app.json --noEmit`, 워커: `npx tsc -p tsconfig.worker.json --noEmit`)
- **Per wave merge:** `npx vitest run` + 두 `tsc` + `node --test scripts/*.test.mjs scripts/e2e/lib.test.mjs` + `npm run tokens:check`
- **Phase gate:** 위 전체 + 로컬 E2E(`--only` 밤·아침 흐름) + 배포(`npm run deploy`) 뒤 배포본 smoke/E2E + 렌더 게이트(크롬 4× 스로틀). 실기기·팀 테스트(성공 기준 5)는 Manual-Only 로 이월.

### 메타모픽 누설 검사 설계 (NIGHT-07·MORN-03/04 의 증명 방식)
1. **직접 불변식(단일 밤):** `startedGame("night")`(6명: 마피아 2·경찰·의사·시민 2)에서 마피아 두 명이 `move`×3·`pick`·`chat`·`typing`·(확정 후)`note` 를 보내는 동안, **순수 시민 두 소켓**의 `settle(sock, mark)` 결과가 `[]`(요약 문자열 `"[]"`). 경찰·의사는 자기 선택으로 본인 `state` 1프레임만(대본 동일). 이것이 "받는 메시지가 같다" 의 가장 강한 형태다 — 구간 중 프레임이 0개.
2. **메타모픽(경계 포함):** 밤 진입 직후 `room`·`world`·`chat:*` 저장소를 `snapshotStorage` 로 떠 두고, 구간 A(마피아 무행동) 실행 → 복원+퇴거 → 구간 B(마피아 활동) 실행. 시민 소켓별로 `[밤 진입 snap … 아침 state/snap … 낮 시작]` 프레임 열을 `stable()`(휘발 필드 제거)로 비교. 두 변형: (i) A=미선택 vs B=서로 다른 대상 선택+걷기+채팅 → 둘 다 "무사", (ii) A=일치 선택(가만히) vs B=일치 선택+걷기+채팅 → 같은 피해자. `resolveNight` 에 난수가 없으므로 결정적이다.
3. **재접속(L9):** 구간 중간에 시민 소켓을 새로 `hello` — 첫 프레임 열 `[state, world snap(본인 한 칸), chatLog([])]` 이 A·B 에서 같다.
4. **L6:** {구출, 미선택, 불일치} 세 밤의 `view.phaseDurationMs`·`phaseEndsAt - 진입` 이 같다(`saved` 외 모든 공개 필드 동일).
5. **한계(문서화):** 벽시계 타이밍(알람 정밀도)은 단언하지 않는다. 마피아가 접속을 끊고 다시 붙는 행동은 `connected` 공개 플래그를 바꾸므로 대본에서 제외한다.

### Wave 0 Gaps
- [ ] `test/worker/nightLeak.test.ts` — 위 설계 전부
- [ ] `test/worker/helpers.ts`: `observe`/`stable` 공유로 이동, `snapshotStorage`/`restoreStorage`, `will`·`note`·`moveAs`·`pickAs` 도우미
- [ ] `test/worker/will.test.ts`, `test/worker/morningCards.test.ts`
- [ ] `test/unit/will.test.ts`(규칙), `test/unit/tension.test.ts`, `test/unit/tensionStaticGuard.test.ts`
- [ ] `test/client/{faceList,willSheet,killFx}.test.tsx`
- [ ] `test/unit/night.test.ts`·`audience.test.ts`·`movement.test.ts`·`world.test.ts`·`view.test.ts`·`phases.test.ts`·`tick.test.ts`·`dayStaticGuard.test.ts` 개정
- [ ] `test/unit/e2eContract.test.ts`·`scripts/e2e/lib.test.mjs`: 새 패널 높이(UI-SPEC "아래 패널 종류와 높이")와 새 표식(`data-night-dark`, `data-face-list`, `data-will-sheet`, `data-chalk`, `data-kill-fx`, `data-curtain`) 동기화
- [ ] 프레임워크 설치: 없음

### Manual-Only
| Behavior | Why Manual | 이월 |
|----------|-----------|------|
| iPhone 실기기 5분 55fps(마피아 이동·고리·맥박·분필), 시민 편 어둠 가독, 아침 가독, 유언 시트+iOS 키보드, 얼굴 칸 누르기 | 실기기·눈 | 사용자 결정(2026-11-02) — ROADMAP 백로그 999.x |
| 팀(4명 이상) 한 판 느낌 기록(성공 기준 5, UI-SPEC 관찰 항목 ①~⑥) | 사람 | 배포본에서 모든 개발 뒤 |

## Security Domain

> `security_enforcement` 활성(config 에 false 없음), ASVS 레벨 1, `block_on: high` [VERIFIED: .planning/config.json].

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | 기존 | 방 토큰(hello). 변경 없음 |
| V3 Session Management | 기존 | 소켓 첨부 playerId·connId. `will`/`note` 도 첨부 신원만 사용 |
| V4 Access Control | **예(핵심)** | `audience`·`worldVisibleTo`·`buildView` 허용 목록·규칙 함수의 역할 검사(`note` 는 산 마피아 + 확정 때만). 클라이언트가 채널·역할을 보내지 않는다 |
| V5 Input Validation | **예** | `z.strictObject` `will`/`note`(덧붙은 키 거부), `sanitizeChatText`, 프레임 1024B 상한, 사용자 문자열은 React 텍스트 노드만(`innerHTML` 금지, T-06-26) |
| V6 Cryptography | 아니오 | 새 암호 사용 없음 |
| V7/V8 데이터 보호(정보 노출) | **예(핵심)** | 마피아 위치·움직임·채팅·선택·확정, 죽기 전 유언·쪽지, 경찰 결과가 해당 소켓에만 |

### Known Threat Patterns (제안 ID — 계획의 threat_model 이 확정)

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 시민 소켓이 밤에 마피아 위치를 받음(라이브 `move`) | Information Disclosure | `audience` 밤 분기 + 메타모픽/직접 불변식 테스트 |
| 재접속·밤/아침 진입 스냅샷으로 마피아 위치 노출 | Information Disclosure | `worldVisibleTo` 밤 분기를 모든 스냅샷이 공유, 시민 snap 본인 한 칸, L9 테스트 |
| 아침 위치가 밤 위치를 그대로 보여 정체 추론 | Information Disclosure | A1: 아침 전원 home 으로(마피아 구간 폐기) — 모든 산 소켓 같은 스냅샷 |
| 구출/미선택/쪽지 유무가 아침 길이·프레임 수로 새어 나감 | Information Disclosure | 길이 = 공개 내용의 함수, 구출 시 쪽지·유언 폐기·불공개, L6 테스트 |
| 죽기 전 유언·쪽지 내용이 남의 프레임에 실림 | Information Disclosure | `Player.will`·`nightNote` 서버 전용(허용 목록 리터럴로만 view 생성), canary 문자열 전수 검사(leak.test 확장) |
| 쪽지 작성자 식별(누가 썼나) | Information Disclosure | 쪽지는 팀 한 장, 카드 `seat` 는 피해자, 작성자 정보 비저장 |
| 비마피아/유령/죽은 사람이 `note`·`will` 로 상태 변경 | Tampering / Elevation | 규칙 함수가 서버 저장 역할·생존으로 거절, 거절은 본인에게만 |
| `will` 저장 연타로 `room` 키 쓰기 증폭(DoS) | Denial of Service | 최소 간격(인메모리 `Map`, 조용한 폐기) + 기존 연결당 20msg/s 제한 |
| 유언·닉네임·쪽지 XSS | Tampering | React 텍스트 노드·`aria-label` 만 |
| 긴장 연출이 서버 신호에 묶여 마피아 활동을 간접 노출 | Information Disclosure | 로컬 난수·시계만, 정적 import 검사 |
| 낡은 `pk`/단계 어긋난 `pick`·`move` | Tampering | 기존 단계 검사(`WRONG_PHASE`)·`canMove` 유지 |

## Sources

### Primary (HIGH confidence)
- 이 저장소의 파일(이번 세션에 `Read`): `shared/game/{night,phases,audience,movement,gather,world,view,room,tick,bots,discussion,endgame,execution,chatLog,chatRules,roles,testTools,alive,win}.ts`, `shared/{protocol,schemas}.ts`, `worker/room.ts`, `src/{screens/GameMap,screens/GamePanel,net/useDayFx,net/chatStore,world/presence,world/store,world/renderer,world/maps/bar,game/dayView,game/eliminationText}`, `test/worker/{helpers,leak,ghostLeak}.test.ts`, `vitest.config.ts`, `package.json`, `.planning/config.json`
- `.planning/phases/09-night-morning/09-UI-SPEC.md`(전문 대부분), `.planning/{REQUIREMENTS,ROADMAP,STATE}.md`, `HANDOFF.md`, `docs/decisions/0044`, `08-RESEARCH.md`(Validation 구역)
- `design/v2.0/blockout/blockout.js`(분필 메시·단계 조명 코드)

### Secondary (MEDIUM confidence)
- three.js 공식 매뉴얼 Materials 페이지(`material.needsUpdate`) 및 three.js 포럼 "Adding and removing three.js lights at run time" — 광원 개수 변화는 재컴파일 [CITED: threejs.org/manual/en/materials, discourse.threejs.org/t/adding-and-removing-three-js-lights-at-run-time/3303]

### Tertiary (LOW confidence)
- 추가 광원 1개의 실제 fps 비용·분필 draw call 영향: 측정 전 추정 [ASSUMED]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 새 의존성 없음, 고정 버전을 `package.json` 에서 직접 확인
- Architecture(서버 audience·스냅샷·home·카드): HIGH — 실제 코드 경로를 줄 단위로 읽고 우회로를 식별
- Pitfalls: HIGH(서버 누설·길이·home) / MEDIUM(three 광원·막 타이밍은 실측 필요)
- Validation: HIGH — 기존 하네스(`observe`/`stable`/`forceDue` 퇴거)에 맞춰 설계, 저장소 스냅샷·복원 도우미만 신규

**Research date:** 2026-11-03
**Valid until:** 2026-12-03 (코드 기반 연구 — 8페이즈 리뷰 수정 CR-01·WR-01~03 이 아직 미배포이므로 `worker/room.ts` 가 바뀌면 삽입점 줄 번호를 다시 확인)
