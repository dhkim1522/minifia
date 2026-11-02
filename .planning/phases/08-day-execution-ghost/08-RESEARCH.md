# Phase 8: 낮 처형과 유령 - Research

**Researched:** 2026-11-02
**Domain:** Cloudflare Durable Object 서버 권위 단계 머신(지목·찬반·유령 audience) + three.js 맵 위 게임 화면 + v1.0 고정 테이블 삭제
**Confidence:** HIGH (서버·와이어·삭제 범위는 저장소를 직접 읽어 확인) / MEDIUM (클라이언트 런타임 확장·카메라 확대·유령 재질은 설계 제안)

> 이 페이즈는 새 외부 라이브러리가 없다. 연구 대상은 **기존 코드의 어느 지점을 어떻게 바꾸는가**다. 외부 문서 조회(Context7·웹)는 필요한 질문이 없어 하지 않았다(`research-plan` seam 미사용). 모든 코드 사실은 이번 세션에 파일을 열어 확인했고, 그렇지 않은 것은 `[ASSUMED]` 로 표시했다.

<user_constraints>
## User Constraints (from CONTEXT.md)

CONTEXT.md 는 없다(사용자가 discuss-phase 를 건너뜀). 승인된 `08-UI-SPEC.md`(approved 2026-11-02)가 사용자 결정을 담고 있어 잠금으로 취급한다. 아래는 UI-SPEC "결정 현황" 표를 그대로 옮긴 것이다.

### Locked Decisions

| 구분 | 내용 | 출처 |
|------|------|------|
| 잠금 | 지목은 손가락 동작으로만 보이고 바닥 선·머리끼리 잇는 선·맵 위 투표 장치는 없다. 득표 수는 지목받은 사람 머리 위 숫자 배지, 순간 알림은 화면 위 한 줄, 기록은 채팅 시스템 줄 | 결정 0049, 0051 |
| 잠금 | 단계 시간 시작값: 낮 토론 90초 · 지목 15초 · 변론 20초 · 찬반 10초 · 처형 5초 · 밤 30초. 값은 서버 단계 표(`shared/game/phases.ts`) 한 곳에서 정하고 화면은 서버가 보낸 마감 시각으로 시간 링을 그린다 | DAY-07, 결정 0044-13 |
| 잠금 | 토론 끝내기: 산 사람의 과반(`⌊산 사람 ÷ 2⌋ + 1`)이 누르면 바로 지목. 누른 뒤 다시 눌러 취소할 수 있다 | DAY-03 |
| 잠금 | 지목: 모두 가운데로 모여 제자리에 선다. 자기 자신은 못 고른다. 마감 전까지 바꿀 수 있다. 동률·0표면 처형 없이 밤. 과반 표여도 마감까지 이어진다(조기 종료 없음 — A3, 사용자 확정) | DAY-04, DAY-05 |
| 잠금 | 찬반: 변론자는 투표하지 않는다. 과반 = 변론자를 뺀 산 사람의 절반 초과 찬성. 결과는 찬성·반대 **수만** 공개하고 누가 무엇을 골랐는지는 화면·채팅·네트워크 모두 공개하지 않는다(투표했는지 여부 체크는 공개). 처형된 사람의 역할은 그 자리에서 알리지 않는다 | DAY-06, 결정 0053 |
| 잠금 | 지목·변론·찬반·처형 동안 서버가 산 사람의 이동 요청을 막는다. **채팅은 된다** | MAP-04 |
| 잠금 | 유령은 산 사람에게 보이지 않는다(위치·움직임·채팅 모두 네트워크로도 안 감). 유령은 모든 사람의 역할을 본다. 화면은 받은 것만 그리고 거르지 않는다 | GHOST-01·02, 결정 0021, CLAUDE.md |
| 잠금 | 처형 여부 투표 → 후보 선택 → 한 표씩 공개 흐름과 고정 테이블은 화면·코드에서 지운다. 후보 선택 기록 카드(`UserRecordSheet`)도 지운다(공개 기록은 채팅 `vote` 줄이 대신) | DAY-07, ROADMAP 8페이즈 기준 4 |
| 잠금 | 햅틱·진동·소리 없음. 동작(감정표현) 버튼 없음(10페이즈). 유언 깃펜 없음(9페이즈). 입력줄 왼쪽 자리(48 + 8)를 코드 구조에서 막지 않는다 | 메모리, 07 UI-SPEC |
| 잠금 | 낮이든 밤이든 스산한 분위기 유지. 새 밝은 색면을 만들지 않는다 | 메모리(낮도 마피아 분위기) |
| 이월 처리 | 07 UI-SPEC D1 이월: 지목·찬반·처형(·아침)의 채팅 입력줄을 이 페이즈가 붙인다. 서버는 이미 받는다 | HANDOFF, 07 UI-SPEC |
| 이월 처리 | 결정 0056 승인 완화 D9·D3b·G2·D2·P10 은 고정 테이블 삭제와 함께 이 페이즈에서 지운다. 기준 수치(이름표 8자 판, 폭 기준)는 맵 화면에서 직접 확인한다 | HANDOFF, 06-17 |
| **잠금 A1** (사용자 확정 2026-11-02) | 테이블이 지워지므로 밤·아침도 맵 위로 옮긴다. 이 페이즈는 **임시 틀**만 만든다(9페이즈가 대체): 밤 = 맵(밤 조명, 이동 없음) + 이름표 눌러 대상 선택 + v1.0 하단 패널 문구, 아침 = 맵 + 36px 알림 + 채팅. 8·9페이즈를 합치지 않는다 | ROADMAP 계획 메모, 성공 기준 4·5 |
| **잠금 A2** | [역할 카드] 버튼은 PhaseHeader **시간 링 왼쪽의 44×44 아이콘 버튼** | 승인 보드에 자리 없음 |
| **잠금 A3** | 지목은 과반이어도 마감까지 이어지며 바꿀 수 있다(유력 도장·실내등·카메라 연출만) | DAY-04 vs 결정 0049 |
| **잠금 A4** | 유령 이동은 모든 단계에서 자유(벽은 못 지나감, 사람과는 겹침 허용) | GHOST-01 |

### Claude's Discretion (UI-SPEC "플래너가 정함")

서버 단계 이름·표(`point`/`defense`/`verdict` 등)·와이어 메시지, 유령 audience, 이동 차단 방식, 모이는 자리 좌표(디자인 시스템: 반지름 2.4~2.6 원 위 8곳, 서로 2.0 이상, 가운데 무대), 결과 알림 시간, 봇의 지목·찬반.

### Deferred Ideas (OUT OF SCOPE)

지목 때 바닥 선·머리끼리 잇는 선·맵 위 투표 장치·말풍선 / 찬반 내역 공개와 처형 때 역할 공개 / 지목·찬반·토론 끝내기에 진홍·역할 색, 진홍·놋쇠 버튼 / 서버 응답 전에 남의 표·배지·선두를 미리 그리는 낙관적 표시 / 감정표현·동작 목록(10페이즈), 유언 깃펜(9페이즈), 채널 탭·밤별 구분선(11페이즈) / 의사 구출 공개·분필 윤곽·유언·쪽지·마피아가 걷는 밤·시민 편 어둠(9페이즈) / 이모지 아이콘·보라/파랑 그라데이션·앰버 / 햅틱·진동·소리(12페이즈) / 캔버스 크기를 키보드나 패널에 맞춰 바꾸기.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DAY-03 | 낮 토론 중 산 사람 과반이 "토론 끝내기" 를 누르면 바로 지목으로 | 패턴 2(토론 끝내기 순수 규칙)·패턴 1(마감을 now 로 당겨 tick) |
| DAY-04 | 지목 시작 시 가운데 모임, 한 명을 손가락으로 가리킴, 실시간 공개, 마감 전 변경, 자기 자신 불가 | 패턴 2(지목 규칙)·패턴 4(모이기 레이아웃)·패턴 6(view 에 지목 공개) |
| DAY-05 | 최다 지목자 한 명이 최후 변론, 시선 집중, 동률·0표면 처형 없이 밤 | 패턴 1(`ON_DEADLINE.nomination` 분기)·패턴 7(조명·카메라) |
| DAY-06 | 찬반 투표, 변론자 제외 과반 찬성이면 처형, 수만 공개 | 패턴 2(찬반 규칙, 분모=변론자 제외 산 사람 수)·패턴 6(방송 규율)·보안 T-08-02 |
| DAY-07 | 단계 시간 90/15/20/10/30초, v1.0 흐름·고정 테이블 제거 | 패턴 1(단계 표)·삭제 지도·함정 1~3 |
| MAP-04 | 단계마다 이동 가능 여부를 서버가 정함 | 패턴 3(`canMove` + 조용한 거절) |
| GHOST-01 | 반투명 유령, 맵을 떠다님, 산 사람에게 안 보임(네트워크로도) | 패턴 5(mover 기반 audience·viewer 별 snap)·패턴 7(유령 렌더)·보안 T-08-01 |
| GHOST-02 | 유령은 모든 역할·밤 행동을 관전 | 기존 `view.spectate`(seats·picks) 재사용, 유령 RoleChip |
</phase_requirements>

## Summary

이 페이즈의 본질은 세 덩어리다. (1) **서버**: v1.0 `execVote → candidateVote → candidateVoteReveal → defense → execution` 다섯 단계를 `discussion(토론 끝내기 과반 조기 종료) → nomination → defense → verdict → execution` 으로 바꾸고, 마감 훅에서 지목·찬반을 집계한다. (2) **이동·유령 전송**: 6~7페이즈의 `world` 프레임은 지금 **로비 전용**(게임 중 어떤 위치 프레임도 안 나감)이라, 게임 중 이동 프레임·단계별 이동 차단·모이기 레이아웃·"유령 위치는 유령에게만" 전송을 새로 만들어야 한다. 이것이 가장 큰 구조 변경이다. (3) **클라이언트**: 로비 전용이던 `WorldStage` 맵 화면을 낮·밤·아침까지 확대하고 `DayScene`(고정 테이블)과 v1.0 투표 화면 일체를 지운다.

세 가지 구조적 사실을 계획자가 먼저 알아야 한다. 첫째, `worker/room.ts` 의 `applyMove` 는 `room.phase !== "lobby"` 면 버리고(892행), `emitWorld` 는 `audience(room, {k:"world"})` 한 길인데 그 함수가 로비 밖이면 빈 집합을 준다(audience.ts 54행) — 게임 중 이동·유령 분리는 이 두 곳이 정본이다. 둘째, 단계 전환 부수 효과(모이기 이동)는 순수 `tick` 안이 아니라 DO 에서 일어나야 하는데 `tick` 은 알람이 늦으면 여러 단계를 한 번에 따라잡으므로, 레이아웃은 **"지금 단계가 요구하는 배치"를 멱등하게 맞추는 함수**로 만들어야 한다. 셋째, UI-SPEC 삭제 목록 일부가 실제 소비자와 충돌한다(`PhaseBar`·`Timer`·`Backdrop`·`recordsSeen.ts`·`verdict.ts` 일부는 아직 쓰인다) — 삭제 전에 `grep` 으로 확정해야 한다.

**Primary recommendation:** 서버를 먼저 TDD 로 완성한다(순수 규칙 → DO 통합 → 누설 검사) → 그 위에 클라이언트 `GameMap` 화면을 올리고 → 마지막에 v1.0 코드·테스트·E2E 를 지운다. `PhaseId` 는 `nomination`·`verdict` 두 개를 더하고 `execVote`·`candidateVote`·`candidateVoteReveal` 을 지운다. 유령 위치는 `audience` 에 mover 개념을 넣어(산 사람의 이동은 모두에게, 유령의 이동은 유령에게만) 한 길로 보내고, 접속 `snap` 도 보는 사람별로 만든다.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 단계 진행·마감·분기(지목 집계→변론/밤, 찬반 집계→처형) | 방 Durable Object(`shared/game` 순수 규칙 + `tick`) | — | 결정 0002·0044-14: 규칙·판정은 서버. 순수 함수라 단위 테스트 가능 |
| 토론 끝내기 과반·지목·찬반 입력 검증 | 방 DO(`apply*` 본체 + zod strict 메시지) | 클라이언트(낙관적 내 표시만) | 신원은 소켓 첨부 playerId 뿐, 규칙 함수가 최종 방어선(07 선례) |
| 이동 가능 여부(MAP-04) | 방 DO(`canMove`) | 클라이언트(같은 순수 함수로 탭 입력만 막음, 권위 아님) | 서버가 막고 화면은 링을 안 띄우는 편의일 뿐 |
| 모이기·변론 무대 걷기 | 방 DO(서버가 구간을 만들어 보냄) | 클라이언트(받은 구간을 평소 걷기로 그림) | 클라이언트는 목적지만 보낸다는 6페이즈 원칙의 연장: 서버가 모두에게 목적지를 정해 줌 |
| 유령 위치·움직임·채팅 전달 범위 | 방 DO(`audience` + `deliver`, viewer 별 `snap`) | — | 화면에서 거르지 않는다(결정 0002·0021). 받을 권리 없는 소켓에는 프레임이 안 간다 |
| 역할 공개(유령에게만) | 방 DO(`buildView` 의 `spectate`) | 클라이언트(`RoleChip` 렌더) | 기존 결정 0021 경로 재사용. 처형 알림·이름표에는 역할 없음 |
| 지목 손가락·배지·도장·선두 연출 | 클라이언트(`view.day` 공개 정보에서 파생) | 방 DO(공개 지목 목록 제공) | 연출은 공개 정보의 함수. 재접속 첫 스냅샷은 이펙트 없이 상태만 |
| 처형 유령 떠오름 연출 | 클라이언트(처형 이벤트 하나로 일회성) | — | 서버가 산 사람에게 유령 위치를 보내는 것이 아님(UI-SPEC) |
| 맵·캐릭터·조명·카메라 | 브라우저(three.js 런타임) | CDN(청크) | 6페이즈 렌더 게이트 통과 구조 유지 |
| 이름표 층(배지·도장·RoleChip·체크·입력 중) | 브라우저 DOM(React 내용 + 런타임 위치) | — | 프레임마다 리렌더 없음(6페이즈 규칙) |
| 밤·아침 임시 틀(A1) | 브라우저(맵 + v1.0 문구) | 방 DO(v1.0 밤 규칙 그대로) | 규칙은 그대로, 화면만 맵으로 이동 |

## Project Constraints (from CLAUDE.md)

- 게임 규칙·판정은 서버(방 DO)가 정한다. 클라이언트는 받은 상태를 보여 주고 행동만 보낸다(결정 0002).
- 다른 사람의 역할은 서버가 살아 있는 사람에게 보내지 않는다(탈락자 관전만 예외, 결정 0021). 화면에서 숨기는 것으로 대신하지 않는다.
- **화면은 글을 최소로, 보고 누르는 조작 중심(결정 0051, 가장 중요한 UI 지침)**. 장면 → 숫자·아이콘 → 글 순서, 새 글은 단계 이름 + 한 줄 + 결과 알림 한 줄.
- 기획·계획은 참여 플레이어의 몰입 기준. 각 페이즈는 자기 구간의 이펙트·액션을 기본형으로 함께 만든다(결정 0006).
- 새 결정은 `docs/decisions/` 다음 번호(**0060**)로 파일을 추가한다. 작업 끝에 `HANDOFF.md` 갱신(6KB 이하, `test/unit/handoff.test.ts`) 후 push.
- 브랜치 `v2`(v2.0 작업), 배포는 `minifia-v2` Worker, v1.0 주소는 건드리지 않는다. GSD 산출물·응답은 한국어, 코드·명령·파일 이름·요구사항 ID 는 원문.
- 화면 페이즈는 UI-SPEC 먼저(이미 승인됨). 디자인 참고 이미지는 저장소 사본(`design/`)을 기준으로 한다(아티팩트는 GSD 에이전트가 못 연다).
- 메모리 지침: 햅틱 없음, 실기기 검사는 모든 개발 끝에 몰아서(사용자 결정 2026-11-02), 진행에 지장 없는 작은 화면 문제(가장자리 잘림 등)는 고치지 않고 기록만, 정할 것은 질문 도구로 추천안 + 여러 안을 하나씩.

## Standard Stack

### Core (모두 기존 — 새 패키지 없음)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react / react-dom | 19.3.1 | 화면(이름표 내용·패널·시트) | 기존. `[VERIFIED: package.json]` |
| three | 0.186.1 (정확 고정) | 맵·캐릭터·조명 | 결정 0055 고정, `deps.test.ts` 가 lockfile 무결성 보호. `[VERIFIED: package.json]` |
| zod | 4.6.7 | 서버 전용 ClientMessage 검증(`shared/schemas.ts`, Worker 만 import) | 기존 strictObject 패턴 재사용 |
| vitest | 4.1.12 | 단위·화면·워커 3개 project | 기존. `[VERIFIED: vitest.config.ts]` |
| playwright-core | 1.64.1 | E2E(`npm run e2e`, 시스템 Chrome) | 기존 |
| wrangler / @cloudflare/vitest-plugin | 4.151.3 / 1.4.6 | DO 워커 테스트(workerd) | 기존 |

### Supporting (코드로 옮기는 것, 설치 아님)

| 대상 | 출처 | 용도 |
|------|------|------|
| `VoteBadge`·`SureStamp`·`RoleChip`·`VerdictPicker` | `design/v2.0/design-system/components/*`, `bundle.css`(`.mv-badge`·`.mv-stamp`·`.mv-rolechip`·`.mv-verdict`·`.mv-chat__sys.is-vote/.is-hot`) | `src/components/v2/*.tsx` 로 React 19 이식(6·7페이즈 방식). 런타임에 `bundle.js` 를 불러오지 않는다 |
| 아이콘 5종 `skip`·`thumbUp`·`thumbDown`·`rolePolice`·`roleDoctor` | `bundle.js` ICONS (24·30·31·40·41행에서 확인) | `V2Icon.tsx` 의 `V2IconName` 에 추가 |
| 토큰 `--font-serif` + 글자 스타일 3개 | 승인 `tokens.css` | `design/tokens.json` 에 더하고 `npm run tokens`(생성 파일 직접 수정 금지), `index.html` 의 Google Fonts 링크에 `Gowun+Batang:wght@700` 추가. `test/unit/tokensV2.test.ts` 의 "글꼴은 합치지 않는다" 주석·기대 갱신 필요 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 지목을 `state` 방송에 실음 | 별도 이벤트 프레임 `{t:"point"...}` | 이벤트는 재접속 복원 경로가 따로 필요. state 방송은 6~7페이즈의 `execTally` 선례와 같고 첫 스냅샷이 자동으로 정상 상태 |
| 레이아웃을 `RoomState` 안에서 순수하게 | DO 의 world 쪽에서 멱등 동기화 | 위치는 이미 room 키와 분리된 `world` 키(06-08 결정). `tick` 을 순수하게 두고 DO 가 "지금 단계의 배치"를 맞춘다 |
| 맵을 `assigning`/`roleReveal` 아래에도 계속 마운트 | 낮 시작에서 다시 부팅 | 6페이즈 `Lobby` 는 로비를 떠날 때 렌더러를 일부러 해제(`exiting`). 유지하면 GPU·배터리 비용. 재부팅이 기존 설계이므로 `preloadWorld()` 만 역할 확인 중에 부른다 |

**Installation:** 없음. `npm install` 하지 않는다(UI-SPEC Registry Safety: 새 의존성 없음, `deps.test.ts` 가 보호).

**Version verification:** 위 버전은 `package.json` 을 직접 읽은 값이다. 이 페이즈는 새 패키지를 추가하지 않으므로 registry 조회는 하지 않았다.

## Package Legitimacy Audit

새로 설치하는 외부 패키지가 없다. `gsd-tools query package-legitimacy check` 대상 없음.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none
글꼴은 Google Fonts `<link>` 한 줄 추가뿐이며(이미 `Gowun+Dodum` 을 같은 방식으로 로드 중, `index.html:17`), 6페이즈 E2E 허용 목록 규칙에 따라 "다른 출처 요청 없음" 검사의 허용 목록에 `Gowun Batang` 요청을 이유와 함께 더해야 한다(UI-SPEC 접근성·검사 절).

## Verified In-Repo Values (이번 세션에 파일을 열어 확인, 원문 그대로)

**PhaseId** — `shared/protocol.ts:24-27`
```
export type PhaseId =
  | "lobby" | "assigning" | "roleReveal" | "dayAnnounce" | "discussion"
  | "execVote" | "candidateVote" | "candidateVoteReveal" | "defense" | "execution"
  | "night" | "morning" | "ended";
```

**단계 길이 상수** — `shared/game/phases.ts:21-30`
```
export const ASSIGNING_MS = 3_000;
export const ROLE_REVEAL_MS = 15_000;
export const DAY_ANNOUNCE_MS = 2_000; // D-20
export const DISCUSSION_MS = 40_000; // DAY-01 — 7페이즈 자유 채팅 토론. 90초는 8페이즈 DAY-07 이 바꾼다(사용자 결정 3, 결정 0058 참고 줄)
export const NIGHT_MS = 30_000; // NIGHT-05
export const MORNING_MS = 5_000; // NIGHT-06
export const EXEC_VOTE_MS = 13_000; // …
export const CANDIDATE_VOTE_MS = 15_000; // 후보 선택(D-01, VOTE-02)
export const DEFENSE_MS = 10_000; // 최후 변론(D-01, VOTE-03)
export const EXECUTION_MS = 5_000; // 처형 발표(D-01, VOTE-04)
```

**진입·마감 훅 표** — `shared/game/tick.ts:43-59`
```
const ON_ENTER: Partial<Record<PhaseId, (s: RoomState, randInt: RandInt, at: number) => RoomState>> = {
  dayAnnounce: enterDayAnnounce,
  execVote: enterExecVote,
  candidateVoteReveal: enterCandidateVoteReveal,
  execution: enterExecution,
  night: enterNight,
  morning: enterMorning,
  ended: enterEnded,
};
…
const ON_DEADLINE: Partial<Record<PhaseId, (s: RoomState) => DeadlineResult>> = {
  execVote: resolveExecVote,
  candidateVoteReveal: routeAfterCandidateVote,
  execution: routeAfterExecution,
  morning: routeAfterMorning,
};
```

**후보를 지우는 v1.0 진입 훅(ROADMAP 함정의 실체)** — `shared/game/vote.ts:81-90`
```
export function enterExecVote(state: RoomState): RoomState {
  const { verdict: _verdict, execution: _execution, ...rest } = state;
  return {
    ...rest,
    players: state.players.map((p) => {
      const { execVote: _execVote, candidateVote: _candidateVote, ...kept } = p;
      return kept;
    }),
  };
}
```

**채팅 단계 집합·채널·audience(world)** — `shared/game/audience.ts:16-27, 38-45, 54`
```
export const CHAT_PHASES: ReadonlySet<PhaseId> = new Set<PhaseId>([
  "lobby", "dayAnnounce", "discussion", "execVote", "candidateVote", "candidateVoteReveal", "defense", "execution", "night", "morning",
]);
…
  if (!isAlive(me)) return "ghost";
  if (state.phase === "night") return me.role === "mafia" ? "mafia" : null;
  return "all";
…
  if (ev.k === "world") return state.phase === "lobby" ? pick(() => true) : new Set();
```
(위 CHAT_PHASES 는 실제 파일에서 줄마다 하나씩 쓰여 있다. 값 목록은 같다.)

**이동 차단·전송·스냅이 로비 전용인 지점** — `worker/room.ts`
- 727행: `if (this.room.phase === "lobby") this.sendTo(ws, snapFrame(this.world, this.room.players, Date.now()));`
- 892행: `if (!room || room.phase !== "lobby") return;` (`applyMove` 안)
- 977-981행: `private emitWorld(frame: WorldFrame): void { … this.deliver(audience(room, { k: "world" }), frame); }`
- 372-374행(주석): `// 로비를 떠나는 시작: 위치를 지금 저장하고 그대로 둔다(가정 A1). 이후 world 프레임은 나가지 않는다.`

**이동 상수** — `shared/game/world.ts:14-18`: `MOVE_SPEED = 1.8`, `MOVE_V = 180`, `MOVE_MIN_GAP_MS = 150`. 좌표는 1/100 정수(`UNIT = 100`), 목적지 한계 `MOVE_COORD_LIMIT = 700`(`protocol.ts:258`).

**조명 단계 타입** — `src/world/renderer.ts:6`: `export type LightingPhase = "talk" | "vote";` (UI-SPEC 가 요구하는 `trial`·`night`·`morning` 은 아직 없다 — 확장 대상)

**변론자가 서는 무대 자리(승인 블록아웃)** — `design/v2.0/screens/bar.js:95`: `ctx.center = { x: 0, y: 0.29, z: 0 };`. 이동 마스크에서 무대 둘레(대략 |x|,|z| ≤ 1.5)는 `#`(막힘)이다(`BAR_MASK` 가운데 줄들의 `######` 구간을 직접 읽어 확인; 원통 장애물 반지름 1.18 + 캐릭터 반지름 0.35).

**동작 `point`(지목 손 모양의 재료)** — `src/world/characterData.ts:135-142`: `seg: 0.3, cycles: 1, hold: 1.1` — 1.4초 만에 끝나는 일회성이라 "마감까지 유지"는 새로 만들어야 한다. `deny` 는 90~101행에 있고 `playEmote("deny")` 로 쓸 수 있다.

**캐릭터 재질** — `src/world/character.ts:712, 790`: `const bodyMaterial = new MeshStandardMaterial({ vertexColors: true, … })` 를 모든 캐릭터가 공유하고 관절 메시가 `new Mesh(merged(j).geo, bodyMaterial)` 로 이를 쓴다 → **개별 캐릭터를 반투명하게 하려면 공유 재질을 바꿀 수 없고 그 캐릭터만 재질을 복제해야 한다.** (승인 블록아웃 `design/v2.0/screens/blockout.js:240-247` 의 `setGhost` 는 `transparent=true; opacity=0.35; depthWrite=false` 이지만 UI-SPEC 는 0.6 이다 — UI-SPEC 가 이긴다.)

**테스트 기준선(이번 세션 실행)** — `npx vitest run`: 143 파일 / 3897 통과 / 1 건너뜀(13.9초). `node --test scripts/*.test.mjs scripts/e2e/lib.test.mjs`: 288 통과. `tsc -p tsconfig.app.json --noEmit && tsc -p tsconfig.worker.json --noEmit`: 통과. `[VERIFIED: 실행 결과]`

## Architecture Patterns

### System Architecture Diagram

```
  폰(산 사람)                                       폰(유령)
    │ move{x,z}  point{target}  verdict{agree}        │ move{x,z}  chat(ghost)  typing
    │ endDiscussion{on}  chat/typing                   │
    ▼                                                  ▼
 ┌────────────────────── Room DO (worker/room.ts) ──────────────────────────┐
 │ webSocketMessage → ClientMessageSchema(strict) → handleX → applyX         │
 │   신원 = 소켓 첨부 playerId 뿐                                             │
 │                                                                            │
 │ applyMove:  canMove(room, player)? ──no→ 조용히 버림(프레임·오류 없음)      │
 │             └yes→ requestMove(150ms 간격·경로) → emitWorld(frame, mover)   │
 │                                                                            │
 │ 순수 규칙(shared/game): nomination · verdict · discussion(endDiscussion)  │
 │   castPoint / castVerdict / toggleEnd → RoomState'                         │
 │                                                                            │
 │ tick(now): ON_ENTER / ON_DEADLINE 표                                       │
 │   discussion ──(과반 or 90s)──▶ nomination ──(15s, resolveNomination)─┐    │
 │                                   │ 최다 한 명        │ 동률·0표       │    │
 │                                   ▼                   ▼                 │    │
 │                                defense(20s) ─▶ verdict(10s)         night   │
 │                                              │resolveVerdict            ▲    │
 │                                              ▼                          │    │
 │                                   execution(5s: 통과면 alive=false) ────┘    │
 │                                                                            │
 │ advance()/alarm 뒤:  syncLayout(room, world)   ← 멱등, tick 따라잡기에도 안전│
 │   nomination: 산 사람 → 원 위 슬롯 / defense·verdict: 변론자 → 무대          │
 │   → forceSegment(간격 검사 없음) → emitWorld(move, mover)                   │
 │                                                                            │
 │ 전송 한 길:  deliver( audience(state, event), frame )                        │
 │   world: mover 산 사람 → 방 전원 / mover 유령 → 유령만 (로비는 전원)         │
 │   snap(hello): 산 사람 viewer → 산 사람 ents 만 / 유령 viewer → 전원 ents   │
 │   state(buildView): 사람마다 따로 — day.points(공개)·day.voted(공개)       │
 │      me.verdictVote(본인만)·spectate(탈락자만, 역할·밤 선택)               │
 └────────────────────────────────────────────────────────────────────────────┘
    ▲                                                  ▲
    │ state / world(산 사람) / chat(all)               │ state(+spectate) / world(전원) / chat(all+ghost)
  폰(산 사람)  ── WorldStore · ChatStore · view ──▶ GameMap(맵 화면 + 단계별 패널)
```

### Recommended Project Structure (제안 — 이름은 플래너가 확정)

```
shared/game/
├── phases.ts        # 단계 표 개정(90/15/20/10/5/30), 후보 공개 상수·candidateRevealMs 삭제
├── discussion.ts    # phaseDurationOf 단순화 + 토론 끝내기 순수 규칙(toggleEnd, endCountOf, majorityOf)
├── nomination.ts    # 신규: castPoint, pointLinesOf, tallyPoints, resolveNomination, enterDiscussion(청소)
├── verdict.ts       # 신규: castVerdict, verdictVotersOf, resolveVerdict
├── execution.ts     # enterExecution 단순화(verdict.passed 일 때만 alive=false), noExecutionOf 개정
├── movement.ts      # 신규: canMove(state, player), MAP_PHASES
├── gather.ts        # 신규: ringSlots(n), assignSlots, STAGE_SPOT, layoutFor(state, world)
├── audience.ts      # CHAT_PHASES 개정, AudienceEvent 의 world 에 mover, worldVisibleTo(state, viewerId)
├── view.ts          # DAY_PHASES·buildDay 개정(points·voted·verdict), me.verdictVote·endDiscussion
├── world.ts         # forceSegment(간격 우회), StoredWorld 에 선택 키 lay, 무대 자리 예외(아래 함정 9)
├── bots.ts          # 새 봇 행동(endDiscussion·point·verdict), 계획 단계 목록 개정
└── testTools.ts     # skipPhase 의 봇 투표 일괄을 새 단계로
worker/room.ts      # handleEndDiscussion/Point/Verdict, applyMove 게이트, emitWorld(frame, moverId), hello snap, syncLayout
shared/protocol.ts  # PhaseId, ClientMessage 3종, DayView·MyInfo 개정
shared/schemas.ts   # strictObject 3종
src/screens/GameMap.tsx        # 신규: 낮·밤·아침 맵 화면(DayScene 대체)
src/components/v2/             # VoteBadge, SureStamp, RoleChip, VerdictPicker 신규 + HeadStack·ChatPanel·V2Icon 확장
src/game/dayView.ts            # 신규: view.day 에서 선두·과반·알림·채팅 줄·헤더 문구를 만드는 순수 함수
src/world/presence.ts          # 신규(제안): 좌석별 표시 상태(유령 떠오름 시간표·지목 방향·deny 트리거) 순수 함수
src/world/{runtime,character,threeRenderer,maps/bar,renderer}.ts   # 확장(아래 패턴 8)
```

### Pattern 1: 단계 표와 훅 (서버)

**What:** `PHASE_DEFS` 에 `nomination`·`verdict` 행을 더하고 `execVote`·`candidateVote`·`candidateVoteReveal` 행을 지운다. 분기는 표가 아니라 `ON_DEADLINE` 훅이 `next` 로 정한다(기존 규칙: 표의 next 는 "기본 다음 단계" 데이터일 뿐).

| 단계 | 길이 | 기본 next | 훅 |
|------|------|-----------|----|
| `dayAnnounce` | 2_000 | discussion | ON_ENTER: 일차 +1 (기존) |
| `discussion` | 90_000 | nomination | **ON_ENTER: `enterDiscussion`(청소)**. 과반 토론 끝내기는 마감 당기기 |
| `nomination` | 15_000 | defense | ON_DEADLINE: `resolveNomination` → 최다 한 명이면 기본 next, 동률·0표면 `next: "night"` |
| `defense` | 20_000 | verdict | — |
| `verdict` | 10_000 | execution | ON_DEADLINE: `resolveVerdict`(항상 execution 으로: 부결 알림도 거기서) |
| `execution` | 5_000 | night | ON_ENTER: `enterExecution`(통과일 때만 `alive:false`), ON_DEADLINE: `routeAfterExecution`(승패 → ended, 기존) |
| `night` / `morning` | 30_000 / 5_000 | 기존 | 기존(임시 틀 A1) |

**ROADMAP 함정(확정):** v1.0 은 `ON_ENTER.execVote = enterExecVote` 가 `verdict`·`execution`·모든 플레이어의 `execVote`·`candidateVote` 를 지웠다. 새 흐름에는 `execVote` 진입이 없고, 토론 끝내기 표(`endVote`)는 **토론 중에 쌓이므로** 청소는 `ON_ENTER.discussion` 한 곳에서 해야 한다(그날 시작 전 이전 날의 `verdict`·`execution`·`nominate`·`verdictVote`·`endVote` 를 키째 제거). 이전 날의 `voteLog`·`lastExecPhrase` 류는 판 내내 남긴다(기존 규칙).

**조기 종료:** 토론 끝내기 과반이 되면 서버가 `phaseEndsAt = now` 로 바꾼 뒤 `tick(now, rand)` 를 한 번 부른다(`skipPhase` 와 같은 길). `tick` 이 새 마감을 `이전 마감 + 다음 단계 길이` 로 계산하므로 지목은 정확히 15초를 받는다. 이후 `persistAndBroadcast` + `reschedule`.

**When to use:** 모든 새 단계. **Source:** 기존 `tick.ts` 패턴. `[VERIFIED: shared/game/tick.ts]`

### Pattern 2: 순수 규칙 모듈 (TDD 대상)

시각·난수를 읽지 않고 입력을 바꾸지 않는 모듈(`vote.ts`·`night.ts` 와 같은 계약). **검사 순서가 계약**(단계 → 행위자 → 값 → 같은 값이면 입력 그대로 `ok`)이고, 같은 값이면 *같은 객체*를 돌려줘 DO 가 저장·전송을 건너뛰게 한다(기존 `applyExecVote` 패턴).

- `castPoint(state, actorId, target)`: `WRONG_PHASE`(nomination 아님) → 행위자(방에 있고 산 사람, 아니면 `BAD_MESSAGE`) → 대상(정수·앉은 산 사람) → 자기 자신이면 `BAD_MESSAGE` → 같은 값이면 입력 그대로. **취소(null)는 없다**(UI-SPEC: 바꾸기만).
- `tallyPoints(state)`: 산 사람이 산 사람을 가리킨 표만. `leader` = 최다 득표가 **정확히 한 명**일 때만, `majority` = `⌊산 사람 ÷ 2⌋ + 1`. 탈락한 투표자의 표는 세지 않는다. 난수 불필요(v1.0 의 공개 순서 셔플은 사라진다) → `ON_DEADLINE` 훅이 `randInt` 를 받을 필요가 없다.
- `castVerdict(state, actorId, agree)`: `WRONG_PHASE`(verdict 아님) → 행위자 산 사람이고 **후보(변론자)가 아님** → boolean → 같은 값이면 입력 그대로. 변론자·유령은 `BAD_MESSAGE`.
- `resolveVerdict(state)`: 유권자 = 변론자를 뺀 산 사람 수 `E`. **통과 = `yes * 2 > E`**. 분모가 던진 표가 아니라 `E` 다(v1.0 `resolveExecVote` 의 `찬성×2 > 던진 표` 와 다름 — DAY-06 "변론자를 뺀 살아 있는 사람의 과반", 결정 0053-3 "8명이면 7명 중 4표 이상"). 못 던진 사람은 기권(분모에는 들어 있고 찬성·반대 어디에도 안 세짐). 집계 직후 모든 플레이어에서 `verdictVote` 키를 구조 분해로 지운다(익명을 "데이터가 없다"는 사실로 지키는 v1.0 Pitfall 22 방식).
- `toggleEnd(state, actorId, on)`: discussion 에서 산 사람만, 같은 값이면 입력 그대로. `endCountOf` 는 개수만 view 에 싣고 누가 눌렀는지는 서버 전용(`Player.endVote`).

**VoteLog 모양은 유지한다:** `VoteLogEntry {n, exec:{yes,no,passed}, cand?:{votes, candidate?}}` 와 `SummaryRow` 는 `ResultScreen`(11페이즈 몫)이 `summaryLines`·`endedSubtitle` 로 읽는다. 의미만 바꾼다 — `exec.yes/no/passed` = 찬반 결과(찬반이 열리지 않았으면 0/0/false), `cand.votes` = 지목 마감 때의 최종 지목 목록, `cand.candidate` = 변론자. 줄은 **`resolveNomination` 이 항상 만든다**(v1.0 은 여부 투표 마감 훅이 만들었다).

### Pattern 3: 이동 권한 (MAP-04)

**What:** `shared/game/movement.ts` 에 순수 함수 한 개.

```ts
// 제안(이름은 플래너 확정). 단계 이름 중 nomination 은 이 문서의 제안이다.
const MAP_PHASES: ReadonlySet<PhaseId> = new Set(["dayAnnounce", "discussion", "nomination", "defense", "verdict", "execution", "night", "morning"]);
export function canMove(state: RoomState, p: Player): boolean {
  if (state.phase === "lobby") return true;
  if (!MAP_PHASES.has(state.phase)) return false;       // assigning·roleReveal·ended
  if (!isAlive(p)) return true;                          // A4: 유령은 모든 단계에서 자유
  return state.phase === "dayAnnounce" || state.phase === "discussion";
}
```

`applyMove` 의 `room.phase !== "lobby"` 한 줄을 `!canMove(room, me)` 로 바꾼다. **거절은 기존 규칙대로 조용히 버린다**(오류 프레임·state 없음 — "서버가 막은 탭에 문구 없음"). 같은 함수를 `src/` 에서도 import 해 맵 탭에 링을 띄우지 않는 입력 면 비활성에 쓰되, 권위는 서버다. 채팅은 `channelOf`/`CHAT_PHASES` 가 따로 정하므로 이동 차단과 무관하게 된다.

### Pattern 4: 모이기·무대 레이아웃은 "멱등 동기화"

**문제:** `tick` 은 알람이 늦으면 여러 단계를 한 번에 따라잡는다(`tick.ts` 주석). 순수 `tick` 은 world 를 모른다(world 는 DO 의 별도 상태). 단계 *전환* 이벤트에 걸어 이동을 시키면 따라잡기·퇴거·재시작에서 빠진다.

**해법:** DO 에 `syncLayout(now)` 를 둔다. 입력은 `(room, world)` 뿐이고 "지금 단계가 요구하는 배치"를 계산해 이미 맞으면 아무것도 안 한다. `advance()` 에서 tick 이 상태를 바꾼 뒤, `testSkip` 뒤, 알람 뒤에 부른다. 현재 적용된 레이아웃 키(`${day}:${그룹}`)를 world 와 함께 저장해(`StoredWorld` 에 선택 키 하나 `lay`; `parseStoredSegment` 처럼 모르는 모양은 무시) 퇴거 뒤에도 같은 판단을 한다.

| 단계 | 요구 배치 |
|------|-----------|
| nomination | 산 사람 N명 → `ringSlots(N)` 의 슬롯(각자 가장 가까운 슬롯 쪽 sweep 배정) |
| defense·verdict | 변론자 → 무대 자리(`STAGE_SPOT`), 나머지는 그대로 |
| execution | 통과: 변론자는 무대에 남음(유령이 되어 떠오름) / 부결: 변론자 → 자기 슬롯으로 복귀 |
| 그 밖 | 아무것도 안 함(밤은 서 있던 자리 그대로 — A1 임시 틀) |

**슬롯 좌표(계산 결과):** 반지름 R=2.65 원 위 N곳, 시작 각 90°, 반시계. N=8 이면 서로 거리 `2·R·sin(π/8) = 2.03`. 반지름 2.5 에서는 1.913 이라 **UI-SPEC 의 "서로 2.0 이상" 을 만족하려면 R ≥ 2.613 이 필요**하다(계산). 고정소수점 8곳: `[0,265] [-187,187] [-265,0] [-187,-187] [0,-265] [187,-187] [265,0] [187,187]`. 8방향 45° 배수 점은 R=2.4~3.0 에서 모두 걷기 가능(BAR_MASK 직접 확인 스크립트). **N=2~8 전부와 슬롯 사이 경로의 걷기 가능은 단위 테스트가 확정**해야 한다.

슬롯 좌표는 서버만 계산하므로 삼각함수를 써도 되지만, 결정성·테스트 편의를 위해 N=2..8 상수 표로 두는 것을 권한다(`world.ts` 의 "삼각함수 없이" 규칙은 서버·클라이언트가 같은 값을 재계산해야 하는 `positionAt` 류에 해당하며, 슬롯은 클라이언트가 재계산하지 않는다).

**서버가 구간을 만드는 길:** `planMoveSegment(cur, dest, now, BAR_MAP)`(07-24 에서 추출된 공용 본체)로 경로를 만들고, 150ms 간격 검사를 우회하는 `forceSegment(world, playerId, seg)` 를 `world.ts` 에 더해 `segs` 에 넣는다(`requestMove` 는 간격 검사 때문에 쓸 수 없다). 만든 구간마다 `emitWorld(moveFrame(seat, seg), moverId)`.

### Pattern 5: world 전송을 mover 기준으로 (GHOST-01)

현재: `audience(state,{k:"world"})` = 로비면 방 전원, 아니면 빈 집합. 개정(제안):

```ts
export type AudienceEvent = { k: "chat" | "typing" | "emote"; ch: ChatChannel } | { k: "world"; mover?: string };
// world: 로비 → 전원. 지도 단계 → mover 가 산 사람이면 전원(산 사람 + 유령), 유령이면 유령만. 그 밖 단계 → 빈 집합.
```

- `emitWorld(frame, moverId)` 로 mover 를 넘긴다. `deliver` 는 그대로(소켓 첨부 playerId 가 집합에 든 소켓에만 전송). **무차별 방송 길이 없다는 정적 가드(`chatStaticGuard.test.ts`: `broadcastEvent` 등 금지)를 유지**한다.
- **접속 `snap` 도 보는 사람별이다.** `handleHello` 727행을 "로비일 때만" 에서 "지도 단계(+로비)"로 넓히되 ents 를 `worldVisibleTo(state, viewerId)` 로 거른다: 산 사람 viewer → 산 사람의 구간만, 유령 viewer → 모두. `snapFrame(w, players, now)` 가 이미 `players` 인자로 거르므로 호출부에서 걸러진 목록을 넘기면 된다.
- 유령이 된 순간의 위치는 world 에 그대로 남는다(무대 위 등). 산 사람 쪽 WorldStore 에는 처형 전의 마지막 구간이 남아 있으므로 **화면이 공개 정보(`players[].alive`)로 그 좌석을 그리지 않는다**(처형 연출 후 제거). 산 사람 viewer 가 재접속하면 새 snap 에 그 좌석이 없다.
- Phase 9 대비: 같은 함수에 "밤의 마피아 mover 는 마피아 + 유령에게만" 한 줄을 더하면 된다. 8페이즈에서 만들지 않는다.

### Pattern 6: view 에 싣는 것과 방송 규율

**DayView 추가(제안):** `points?: {seat:number; target:number}[]`(nomination 중 공개 지목), `endCount?: number`(discussion), `voted?: number[]`(verdict 중 투표를 마친 좌석 — 값은 없음), `verdict?: {yes:number; no:number; passed:boolean}`(execution 단계), 기존 `candidate`·`execution`(`phrase` 는 UI-SPEC 문구 "{닉네임} 님 처형" 뿐이라 삭제 후보). **MyInfo 추가:** `endDiscussion?: true`, `verdictVote?: boolean`(본인·산 사람·verdict 단계만). **삭제:** `execTally`·`voteAgree`·`voteTarget`·`ExecTally` 등.

**방송 규율(누설 방지, 필수):**
- 지목은 공개 정보라 바뀔 때마다 `persistAndBroadcast`(모든 소켓이 각자 view). 
- 찬반은 **"투표를 마친 사람" 집합이 바뀔 때(처음 던질 때)만** 전원 방송하고, 이미 던진 사람이 찬성↔반대를 바꿀 때는 **본인에게만** `sendViewTo([id])` 한다(v1.0 `applyCandidateVote` 와 같은 패턴). 바꿀 때마다 전원 프레임이 나가면 "누군가 마음을 바꿨다"는 타이밍이 샌다.
- 토론 끝내기는 개수(`endCount`)만 공개하고 누가 눌렀는지는 서버 전용. 개수가 바뀔 때만 방송한다.
- 찬반 집계 수는 **마감 훅 이후에만** view 에 나타난다(`execution` 단계). 진행 중 `voted` 는 좌석 목록과 개수뿐.

### Pattern 7: 클라이언트 — 지속되는 맵 화면과 런타임 확장

**지속 맵 화면:** 지금 `Lobby` 가 `WorldStage` 를 소유하고, 로비를 떠날 때 `EXIT_CURTAIN_MS`(420ms) 가림막 뒤 해제한다. `RoomScreen.sceneKey` 는 `dayAnnounce…execution` 을 `"dayScene"` 한 장면으로 묶는다. 새 `GameMap` 이 `dayAnnounce · discussion · nomination · defense · verdict · execution · night · morning` 을 **한 마운트로** 받아야 단계 사이에 three 렌더러가 다시 만들어지지 않는다(`sceneKey` 를 새 장면 키로 바꾸고 `renderPhase` 의 `DayScene` 분기를 교체). `assigning`/`roleReveal` 뒤 낮 시작에서 맵이 새로 열리므로 `preloadWorld()` 를 역할 확인 동안 불러 청크 로딩이 단계 시간을 먹지 않게 한다(UI-SPEC UI-Considerations 32).

`Lobby` 의 스테이지 사각형 측정(헤더/패널 `ResizeObserver` → `stageInsets`)·`useKeyboardLift`·`useChatLogHeight`·`TopToast` 배선을 `GameMap` 이 그대로 필요로 한다. 복사하지 말고 작은 훅(`useMapInsets`)으로 뽑아 두 화면이 쓰게 하는 것을 권한다(로비 회귀는 기존 `lobby.test.tsx`·E2E 가 지킨다).

**런타임(`src/world/runtime.ts`)에 필요한 추가:**
1. **보이는 좌석 필터**: 산 사람 viewer 는 `alive:false` 좌석을 그리지 않는다(단 처형 이벤트가 난 좌석은 연출 동안만). 유령 viewer 는 모두 그린다(죽은 좌석은 반투명·떠다님). 이름표 roster·`syncPlayers`·`createActor` 가 같은 헬퍼 한 곳을 쓴다.
2. **카메라 모드**: 지금은 `drawFrame` 의 카메라 블록이 `clampTarget(mine.pos)` 만 따른다. 지목·변론·찬반·처형은 모이는 자리 가운데 고정(`dur-slow` 800ms 이동). `deps.camera(): {mode:"follow"} | {mode:"fixed"; at}` 를 읽게 한다. 8% 다가감은 `LightingPhase` 와 별개로 렌더러에 줌 한 값이 필요하다(정사영 카메라의 `zoom`; `[ASSUMED]` — three 정사영 카메라 `zoom` 이 `project()`·그림자에 영향 없이 동작함은 이번 세션에서 확인하지 못했다). 스테이지 높이 ≥ 360 일 때만(UI-SPEC).
3. **조명 단계**: `LightingPhase = "talk" | "vote"` 를 `trial`(실내등 5% + 무대 조명 하나 + 원뿔), `night`, `morning` 으로 확장(`maps/bar.ts` 의 `LIGHT_TUNE` 행 추가). 새 광원은 만들지 않는다(UI-SPEC). `deps.lighting` 은 지금 부팅 때 한 번만 읽으므로 단계 변화마다 호출하는 `runtime.setLighting(phase)` 가 필요하다.
4. **캐릭터 표현**(`character.ts`): `setGhost(on)`(공유 `bodyMaterial` 대신 그 캐릭터 전용 재질 복제 + `transparent`·`opacity 0.6`·`depthWrite false`; 해제 시 공유 재질로 복귀, 복제 재질 dispose), 지속 지목 자세(`point` 동작은 hold 1.1초뿐 — "마감까지 유지"용 `holdPose("point")` 필요), 대상 쪽으로 몸 돌리기(`setYaw`), 떠다님(`y = 0.35 + sin(2t)*0.08`, 모션 줄이기면 띄우기만), 선두 시 `playEmote("deny")` 한 번.
5. **무대 위 서기**: 변론자는 `y = 0.29`(블록아웃 `ctx.center.y`)로 선다 — 위치가 `STAGE_SPOT` 안이면 높이를 올리는 클라이언트 규칙 한 곳.
6. **이름표 쌓임**: `HeadStack` 확장(`role`·`count`·`lead`·`sure`·`mine`·`done`·`blink`). 위치·z 는 런타임이 매 프레임 쓰고 React 는 내용만 — 배지 숫자·`data-*` 는 view 변화 때만 바뀐다. 지목 단계의 이름표 버튼은 `.mf-world__tags { pointer-events: none }` 안에서 버튼만 `pointer-events: auto`(기존 `.mf-world__kick` 과 같은 11/-11 방식).
7. **탭 차단**: `WorldStage.onTap` 이 `canMove(view)`(shared 순수 함수)가 거짓이면 링을 띄우지 않는다. 키보드 닫기(D4)는 그대로.

### Pattern 8: 파생 연출은 "공개 정보 차이"에서 (지목 알림·채팅 줄·선두/과반)

`src/game/dayView.ts`(순수)에 연속된 두 `view` 의 `day.points` 차이에서 이벤트를 만든다: `{kind:"point", from, to, changed}`, 선두 변경, 과반 달성, 연결 직후 첫 스냅샷(= 이전 view 없음 또는 epoch 변경)은 **이벤트를 만들지 않고 정상 상태만** 계산(UI-SPEC "재접속 첫 스냅샷은 이펙트 없이"). `Lobby` 의 `diffRoomViews`/`toastForDiff` 와 같은 구조(07-13 선례). 토스트 합치기(400ms 안 같은 대상 → "지호·민준 → 도윤")·줄 세우기는 이 모듈의 순수 큐로 만들어 가짜 시계로 테스트한다. 채팅 시스템 줄은 `chat.addSystem(text, {scope:"all", icon, at})` 로 넣고(7페이즈 API), `vote`·`hot` 종류는 `ChatStoreLine`/`ChatPanel` 에 추가한다.

### Pattern 9: 밤·아침 임시 틀 (A1)

규칙은 v1.0 그대로(`pickTarget`·`enterMorning`). 화면만 맵으로: 밤 = 이름표 누르기로 `pick`(지목 때의 이름표 버튼 컴포넌트를 재사용), 발밑 고리는 런타임 마커 확장(`setMarker` 는 지금 `ring`·`cue` 두 종류 — 좌석별 고리 종류가 필요), 하단은 `NightPanel` 문구(`NIGHT_PANEL_TEXT`·`morningCardText` 는 유지). 유령에게는 `view.spectate.picks`(기존)만큼 고리. **임시 틀은 커지지 않게 한다**(UI-SPEC 남은 위험 1): 9페이즈가 갈아엎는다.

### Anti-Patterns to Avoid

- **유령 위치를 화면에서 거르기**: 산 사람 소켓에 보냈다가 숨기면 결정 0002·0021·CLAUDE.md 위반이다. 서버가 안 보낸다.
- **단계 *전환* 이벤트에 이동을 거는 것**: 따라잡기·퇴거에서 빠진다. 멱등 동기화(패턴 4).
- **찬반 값 변경을 전원에게 방송**: 타이밍 누설(패턴 6).
- **`requestMove` 로 서버 주도 이동**: 150ms 간격 검사에 걸린다. 별도 `forceSegment`.
- **지목 이름표를 캔버스 안(three 오브젝트)에 두기**: 누르기·접근성은 DOM 이름표 층의 버튼이어야 한다(UI-SPEC).
- **`bodyMaterial` 의 `opacity` 를 직접 바꾸기**: 공유 재질이라 모든 캐릭터가 반투명해진다(`character.ts:712`).
- **`tick` 을 비순수하게 만들어 world 를 넣기**: 순수 단계 머신이 단위 테스트의 근간이다.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 모이기 경로 | 새 길찾기·직선 이동 | `planMoveSegment`(공용 본체, 결정 0059) + `routeFx` | 벽·가구 회피·정수 좌표·서버/클라이언트 같은 보간(`positionAt`)이 이미 검증됨 |
| 받는 사람 계산 | `ws` 순회로 직접 조건 | `audience()` + `deliver()` 한 길 | 07 정적 가드(`chatStaticGuard`)가 무차별 방송 재도입을 막는다 |
| 채팅 줄·입력 중·재접속 복원 | 단계별 새 채널 코드 | 7페이즈 `channelOf`·`appendLine`·`replayFor`·`ChatStore` | `CHAT_PHASES` 단계 이름만 새 것으로 바꾸면 된다 |
| 시간 링·남은 초 | 새 타이머 | `useCountdown`(`src/net/countdown.ts`) + v2 `PhaseHeader`(`time`·`total` 초) | 서버 마감 시각 기준, 탭 복귀 처리 포함 |
| 유령/역할 관전 데이터 | 새 관전 프레임 | 기존 `view.spectate.seats`(역할)·`picks`(밤 선택) | 결정 0021 경로, 이미 탈락자 viewer 에게만 실림(`view.ts:222-240`) |
| 이름표 겹침 순위 | 지목용 z-index 로직 | `rankTags`(6페이즈 `tagOrder.ts`) + 선두 `z-tags + 10` | 이미 내 이름표 최상위·앞 하나만 진한 면 규칙 보유 |
| 키보드·한글 입력·패널 높이 | 새 입력 레이아웃 | `ChatPanel`·`useKeyboardLift`·`useChatLogHeight`·`chatUi` 상수 | 07-19 에서 iOS·IME 까지 해결. 찬반 줄 숨김 규칙만 더한다 |
| 낙관적 내 선택 표시 | 새 상태 | `useViewChoice`(`src/net/useViewChoice.ts`) | "새 서버 view 가 오면 서버 값이 이긴다" |
| 메시지 검증 | 손 파싱 | `shared/schemas.ts` 의 `z.strictObject` | 덧붙은 키(seat·id·ch)는 거부 — 신원 위조 차단 |
| 봇 행동 | DO 안 특권 경로 | `applyX` 본체를 봇 id 로 호출(결정 0024 "특권 없음") | 사람과 같은 검증 |

**Key insight:** 이 페이즈의 위험은 새 알고리즘이 아니라 *전송 경로*다. 위치·채팅·찬반 값이 어느 소켓에 가는지를 한 함수(`audience`/`buildView`)에 가두면 누설 검사를 한 곳에서 증명할 수 있다.

## Runtime State Inventory

이 페이즈는 단계 이름 변경과 필드 삭제(데이터 모양 마이그레이션)를 포함한다. 코드 grep 으로 안 보이는 런타임 상태를 점검했다.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | DO storage `room` 키의 `RoomState`(`phase` 가 `execVote`/`candidateVote`/`candidateVoteReveal` 일 수 있음, `Player.execVote`·`candidateVote`, `verdict`, `execution`, `voteLog`). `world` 키(`{v:1, segs}`). `chat:` 키들 | `normalizeStoredRoom` 에 옛 세 단계를 `discussion`(+새 90초 마감, 일차 유지)으로 옮기고 옛 Player 키·`verdict`/`execution` 을 뺀다 — 07-08 의 `claim` 정규화와 같은 패턴. `world` 키는 호환(선택 키 `lay` 추가만) |
| Live service config | 없음 — 배포본 설정은 `wrangler.jsonc`/코드. 알람은 DO 당 하나(`reschedule`) | 없음(확인: `worker/room.ts` 알람은 코드로만 설정) |
| OS-registered state | 없음 | 없음 |
| Secrets/env vars | 없음 (토큰은 방/플레이어 단위, 새 비밀 없음) | 없음 |
| Browser storage | `localStorage` `mf-hint-walk`(6페이즈), `minifia:records:{code}`(role journal 읽음 수, `recordsSeen.ts`), 새 `mf-hint-point` | `mf-hint-point` 추가(깨짐·저장 불가 시 보임). `recordsSeen` 은 **지우지 않는다**(아래 삭제 지도) |
| Build artifacts / installed | `src/styles/tokens.css` 는 `design/tokens.json` 에서 생성(`npm run tokens`), `dist/` 빌드 | `tokens.json` 을 고친 뒤 `npm run tokens` 재실행(typecheck 가 `tokens:check` 로 검사) |
| 진행 중인 방 | 배포 순간 지목/투표 중인 방 | 위 정규화로 흡수. 옛 번들 클라이언트가 보내는 `execVote`/`candidateVote` 는 스키마에서 사라져 `BAD_MESSAGE` (07 `claim`/`say` 선례) |

## 삭제 지도 (UI-SPEC 삭제 목록을 grep 으로 확정 — 충돌 5건)

UI-SPEC 는 "플래너가 `grep` 으로 확정"하라고 했다. 소비자를 직접 확인한 결과:

| 대상 | 판정 | 근거 |
|------|------|------|
| `DayTable`·`DayTableSeat`·`DayScene`·`ExecVotePanel`·`CandidateVotePanel`·`ExecIntroCard`·`NoExecutionCard`·`RevealLayer`·`UserRecordSheet`·`ReadOnlyRow`·`verdictScene.tsx`·`useRevealState.ts`·`recordRows.ts`·`dayTable.ts`·`blankTap.ts`(DayScene 전용이면) | **삭제** | 소비자가 `DayScene`/`verdictScene` 뿐(import 확인). `blankTap.ts` 는 DayScene 만 쓰는지 grep 필요 |
| `SceneIntro`·`MorningCard` 컴포넌트 | 삭제(알림은 36px 결과 알림으로 대체). `morningCardText`·`eliminationTitle` 문구 표는 **유지**(아침 알림이 쓴다) | `DayScene.tsx`·`verdictScene.tsx` 만 import |
| `PhaseBar` | **유지** | `RoleReveal.tsx:5` 가 `import { PhaseBar } from "../components/PhaseBar";` 로 쓴다(역할 확인은 이 페이즈 밖, UI-SPEC "지금 모양 그대로") |
| `Timer` | **유지** | `RoleReveal.tsx` 가 같이 import |
| `Backdrop`·`src/game/scenes.ts`(`SCENES`·`PHASE_SCENE`·`sceneOfPhase`) | **유지, 행만 정리** | `Home`·`Assigning`·`RoleReveal`·`ResultScreen`·`JoinByLink`·`ErrorScreen` 이 쓴다. 지울 단계(`execVote` 등)와 `PHASE_INTRO`/`SceneIntro` 관련 행만 제거. `PHASE_SCENE: Record<PhaseId, SceneId>` 는 새 PhaseId 로 타입 오류가 알려 준다 |
| **`src/net/recordsSeen.ts`** | **유지 (UI-SPEC 목록 오류)** | `RoomScreen.tsx:17` `import { loadSeenCount, saveSeenCount, unseenCount } from "../net/recordsSeen";` — 역할 카드 일지의 "새 기록 점"이다. `UserRecordSheet` 와 무관. 지우면 `roleCardFlow` 등이 깨진다 |
| `src/game/verdict.ts` (606행) | **부분 삭제** | `ResultScreen.tsx:11` 이 `RESULT_FLIP_AT_MS, RESULT_SUMMARY_AT_MS, UNKNOWN_NAME, VERDICT_TEXT, endedSubtitle, summaryLines, winnerText` 를 import, `NightPanel.tsx` 가 `VERDICT_TEXT.candidateNone`·`votedSuffix` 를 import. 처형 여부·후보 선택·공개 시간표·`candidateReveal*`·`introCardGeometry`·`arrowEndpoints` 등만 지운다 |
| `PHASE_ANNOUNCE`(`RoomScreen.tsx:41-56`)의 옛 세 단계 행, `nightAnnounce`의 `noExecutionPrefix` | 개정 | `Record<PhaseId,…>` 라 컴파일러가 알려 준다 |
| 서버: `execVote`·`candidateVote`·`candidateVoteReveal`·`enterExecVote`·`castExecVote`·`castCandidateVote`·`tallyCandidateVote`·`execTallyOf`·`candidateRevealMs` 및 관련 상수, 메시지 2종, `MyInfo.voteAgree/voteTarget`, `DayView.execTally`, `Player.execVote/candidateVote`, `bots` 의 해당 계획, `testTools.botsVoteNow` | **삭제/치환** | 참조 파일 전수는 `grep -rl "execVote\|candidateVote" shared worker src scripts test` (현재 약 60개 파일: 소스 20, 테스트 약 25, 스크립트 11) |
| 테스트 | 위를 검사하던 것 삭제·치환, **`skip` 금지**(07 규칙) | `test/client/{candidateVote,execVote,execIntro,noExecution,reveal,revealLayer,defense,dayTable,verdictStates,userRecordSheet,sceneIntro,morning,dayScene,phaseScreens …}.test.tsx`, `test/unit/{dayTable,verdict,recordRows,scenes,vote,execution,discussion …}.test.ts`, `test/worker/vote.test.ts` 등 |
| E2E | `scripts/e2e/flows.mjs` 의 `police5·citizen4·mafia8·doctor5·spec4·vote5·noexec·result-c·result-m·chat-table·chat-ghost`, `lib.mjs` 의 D*/P*/G2 검사와 `APPROVED_RELAXATIONS` 의 `D9-8ch·D3b-8ch·G2-8ch·D2-8ch·P10-8ch`(+ `WIDE_NAME_GRAPHEMES`·`isWide*`) | 새 흐름으로 다시 짓는다(아래 검증 절). `scripts/{smoke,bots,uat-*,gallery}.mjs` 도 v1.0 투표 메시지를 쓴다 |

## Common Pitfalls

### Pitfall 1: 청소 시점을 지목 진입으로 옮기면 토론 끝내기 표가 사라진다
**What goes wrong:** 새 `endVote` 는 토론 중에 쌓인다. 청소를 `nomination` 진입에 두면 마감 직전 눌린 표가 다음 날에도 남거나(청소 안 됨), 반대로 너무 일찍 지워진다.
**How to avoid:** `ON_ENTER.discussion` 에서 한 번에 지운다(ROADMAP 계획 메모와 일치). `enterDayAnnounce` 가 아니라 `discussion` 인 이유: 일차 +1 직후 같은 날 표를 이미 받을 수 있는 첫 단계.
**Warning signs:** 둘째 날 토론이 시작하자마자 과반이 되어 바로 지목으로 넘어감.

### Pitfall 2: `verdict`·`execution` 상태가 밤·아침 뷰까지 새거나 `noExecutionOf` 가 틀어짐
**What goes wrong:** `noExecutionOf` 는 `night` 일 때만 `voteLog` 그날 줄에서 이유(noVotes/notMajority/tie)를 파생했다. 새 흐름에서 부결은 `execution` 단계에서 알리므로 night 의 이유는 `tie`·`noVotes` 만 남는다. 기존 함수를 그대로 두면 `exec.passed=false`(찬반이 열리지 않은 날)가 `notMajority` 로 오판된다.
**How to avoid:** 지목 마감 훅이 만든 줄의 `exec` 는 `{yes:0,no:0,passed:false}` 이고, 이유 파생은 `cand.candidate === undefined` 로 판정하도록 개정한다. 단위 테스트(`execution.test.ts`)를 먼저 고친다.

### Pitfall 3: 유령이 된 직후 산 사람 화면에 죽은 캐릭터가 남는다
**What goes wrong:** 산 사람 WorldStore 에는 처형 직전 마지막 구간이 남아 있고 서버는 더 안 보내므로 캐릭터가 영원히 서 있는다. 반대로 `retainSeats(view.players)` 는 죽은 좌석을 view 에 있다고 보아 유지한다.
**How to avoid:** 런타임/이름표 roster 가 공개 정보 `players[].alive` 로 viewer 별 보임 규칙을 적용한다(패턴 7-1). 처형 연출 이벤트가 난 좌석만 연출 동안 유지. **재접속 첫 스냅샷에는 연출을 만들지 않는다.**

### Pitfall 4: 알람이 늦어 지목 단계를 통째로 건너뛰면 모이기가 안 일어난다
**How to avoid:** 패턴 4 의 멱등 동기화. `syncLayout` 은 "지금 단계" 기준이므로 건너뛴 단계의 이동은 의도적으로 생략된다(관찰할 이유가 없다). 테스트: `forceDue` 로 `discussion` 마감을 과거로 → 알람 → 상태는 nomination 이고 모든 산 사람이 슬롯에 있다.

### Pitfall 5: 서버 주도 이동이 150ms 간격 검사·`lastMoveAt` 에 걸린다 / 걸린 상태로 남는다
**How to avoid:** `forceSegment` 는 `lastMoveAt` 을 건드리지 않거나 비운다(직후 사람이 탭해도 막히지 않게, 그리고 막히는 단계라 의미가 없음). 걷는 중이던 사람의 출발점은 `positionAtFx(cur, now)` 이므로 `planMoveSegment` 가 자연히 처리한다.

### Pitfall 6: 변론자 무대 위치가 이동 마스크 밖이라 저장 복원이 입장 지점으로 돌려보낸다
**What goes wrong:** 무대 둘레는 막힌 칸이다. `world.ts:217` `parseStoredSegment` 는 모든 선분(한 점이면 그 점)이 `lineWalkable` 이어야 복원하고, 아니면 그 사람을 입장 지점에 세운다. 무대 `(0,0)` 한 점 구간은 복원 때 거부되고, `routeFx` 도 도착점을 걷기 가능한 곳으로 보정한다.
**How to avoid:** Open Question 1 의 결정에 따라 (a) 무대 위 서기를 허용하는 단일 예외(`STAGE_SPOT`)를 `lineWalkable`/`parseStoredSegment`/`snapToWalkable` 이 한 함수로 공유하게 하거나 (b) 걷기 가능한 앞 자리로 정한다. (a) 를 택하면 처형 뒤 유령이 무대에서 걸어 나올 때 `routeFx` 의 출발점 보정(막힌 칸이면 가장 가까운 걷기 점)이 자연스러운지 단위 테스트로 확인.

### Pitfall 7: 지목 이름표 버튼이 `aria-hidden` 이름표 층 안에 있다
UI-SPEC 남은 위험 9. 낭독기에서 버튼이 안 읽힌다. `.mf-world__sr`(시각 비표시 목록)에 같은 8개 버튼을 `role="group" aria-label="지목"` 으로 이중 노출하는 안과, 이름표 층의 버튼만 `aria-hidden` 예외로 두는 안 중 플래너가 고른다. 어느 쪽이든 키보드 순서(역할 카드 → 이름표 8개 → 입력)를 E2E 로 확인.

### Pitfall 8: 클라이언트가 단계 시간을 스스로 센다
UI-SPEC 4번: 승인 보드의 `reset()` 순환은 시연용이다. 제품은 서버 단계·마감 시각만 따른다. 결과 알림 시간(1.4초 등)은 *표시 시간*이며 단계를 넘기지 않는다. 알림 시각 합이 `EXECUTION_MS` 안에 들어야 한다 — 상수를 한 곳에 두고 단위 테스트로 `tally + 처형 알림 ≤ EXECUTION_MS` 를 고정한다(UI-SPEC 남은 위험 8).

### Pitfall 9: 선두 이름표가 8명 모일 때 가려지고 누를 수 없다
UI-SPEC 남은 위험 2. 4자 이름 기준 8개 버튼이 각각 44×44 이상이고 서로 가려지지 않는지를 E2E 가 폰 크기 6종으로 검사한다. 안 되면 캐릭터 몸 탭 허용은 9페이즈로 미룬다(UI-SPEC 결정).

### Pitfall 10: 테스트 방 봇이 새 단계에서 멈춰 한 판 자동 완주가 깨진다
ROADMAP 공통 완료 조건("테스트 방 봇이 새로 만든 흐름을 수행해 한 판을 자동 완주"). `botPlanKey` 의 계획 단계 목록(`discussion·night·execVote·candidateVote·defense`)을 `discussion·nomination·defense·verdict·night` 로 바꾸고, 봇 행동 3종(토론 끝내기·지목·찬반)을 `BotAct` 와 `actAsBot` 의 `never` 검사에 더한다. `testBotVote`(방장이 봇 표를 고정) 의 의미를 새 흐름에 대응시켜야 한다(Open Question 4). `skipPhase` 의 `botsVoteNow` 도 새 단계로.

### Pitfall 11: 옛 번들·옛 방
배포 직후 옛 번들이 `execVote`/`candidateVote` 를 보내면 `BAD_MESSAGE`. 진행 중이던 방은 정규화로 `discussion` 에 들어간다. 사용자에게 영향 없는 일회성이므로 정규화 테스트(`gameRoom.test.ts`·`alarm.test.ts`)만 추가.

### Pitfall 12: `ResultScreen` 가 읽는 `voteLog`/`SummaryRow` 모양을 깨면 11페이즈 이전에 빌드가 깨진다
`summaryLines(result.summary, view.day?.voteLog ?? [], nicknameOf)` 가 `exec.yes/no/passed/candidate`·`cand.votes` 를 읽는다. 타입 모양은 유지하고(패턴 2) 문구가 어색해지는 것은 11페이즈 몫으로 기록한다.

### Pitfall 13: 토큰·글꼴 추가는 생성 파일 규칙을 따른다
`src/styles/tokens.css` 직접 수정 금지. `design/tokens.json` → `npm run tokens`, `tokensV2.test.ts` 가 "글꼴·글자 스타일은 합치지 않는다" 를 단언하고 있어 같이 갱신한다. `typecheck` 가 `tokens:check` 를 포함한다.

## Code Examples

모두 **제안 스켈레톤**이다(새 이름은 플래너가 확정). 저장소 기존 값은 "Verified In-Repo Values" 절의 원문만 썼다.

### 마감 훅과 분기 (tick 표 개정)
```ts
// shared/game/tick.ts — 기존 표(원문은 위 인용)에서 execVote·candidateVote* 행을 이렇게 바꾼다.
const ON_ENTER = {
  dayAnnounce: enterDayAnnounce,
  discussion: enterDiscussion,        // 청소: verdict·execution, 모든 플레이어의 nominate·verdictVote·endVote
  execution: enterExecution,          // verdict.passed 일 때만 alive:false
  night: enterNight, morning: enterMorning, ended: enterEnded,
};
const ON_DEADLINE = {
  nomination: resolveNomination,      // { state, stay:false } | { …, next: "night" }  — 최다 한 명이 아니면 night
  verdict: resolveVerdict,            // 항상 기본 next(execution)
  execution: routeAfterExecution, morning: routeAfterMorning,
};
```

### 이동 게이트 + mover 기반 전송 (worker/room.ts)
```ts
private applyMove(playerId: string, dest: { x: number; z: number }, now: number): void {
  const room = this.room;
  if (!room) return;
  const me = room.players.find((p) => p.id === playerId);
  if (!me || !canMove(room, me)) return;                    // 조용한 거절
  const result = requestMove(this.world, playerId, dest, now, BAR_MAP);
  if (!result.ok) return;
  this.world = result.world;
  this.emitWorld(moveFrame(me.seat, result.seg), playerId); // mover 를 넘긴다
  this.markWorldDirty();
}
private emitWorld(frame: WorldFrame, moverId: string): void {
  const room = this.room;
  if (!room) return;
  this.deliver(audience(room, { k: "world", mover: moverId }), frame);
}
```

### 토론 끝내기 조기 종료 (순수 + DO)
```ts
// 과반이면 마감을 지금으로 당겨 정상 마감과 같은 경로(tick)를 탄다 — 새 마감 = 이전 마감 + 다음 단계 길이
function endDiscussionNow(state: RoomState, now: number, rand: RandInt): RoomState {
  return tick({ ...state, phaseEndsAt: now }, now, rand);
}
```

### 찬반 분모
```ts
// 유권자 E = 변론자를 뺀 산 사람. 통과 = 찬성 * 2 > E (던진 표가 아니라 E 가 분모, DAY-06)
const passed = yes * 2 > voters;
```

## State of the Art (v1.0 → 이 페이즈)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 처형 여부(과반 던진 표) → 후보 선택(한 표씩 공개 연출) → 변론 → 처형 | 지목(공개·실시간) → 변론 → 찬반(분모=변론자 제외 산 사람) → 처형 | 결정 0044-3, 0049, 0053 | 공개 순서 셔플·공개 길이 공식 불필요, `randInt` 가 tick 훅에서 빠진다 |
| 고정 테이블(`DayTable`) | 맵 위 서기 + 이름표 층 | 6페이즈(로비), 8페이즈(낮) | `PhaseHeader`(v2)·`ChatPanel` 만 위에 얹는다 |
| 탈락자 = 테이블 위 유령 그림 + 읽기 전용 줄 | 맵을 걷는 반투명 유령 + 유령 채널 입력 | GHOST-01 | 서버 전송 분리가 핵심 |
| `world` 프레임 = 로비 전용 | 지도 단계 전반, mover/viewer 별 | 이 페이즈 | `audience` 시그니처·hello snap 개정 |
| 토론 40초(방장 넘기기 없음) | 90초 + 과반 조기 종료 | DAY-07, DAY-03 | `DISCUSSION_MS` 주석이 이미 "8페이즈가 바꾼다" 로 예고 |

**Deprecated/outdated:** `execVote`·`candidateVote`·`candidateVoteReveal` 단계, `ExecTally`, `voteAgree`·`voteTarget`, 후보 공개 상수(`CANDIDATE_REVEAL_*`)와 `candidateRevealMs`, 처형 문구 번호(`EXECUTION_PHRASE_COUNT`·`lastExecPhrase` — UI-SPEC 의 처형 알림이 "{닉네임} 님 처형" 한 가지라 `[ASSUMED]`: 소비자 grep 후 함께 삭제 권장).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | three 정사영 카메라의 `zoom` 을 8% 올려도 `project()`·`groundAt`·그림자가 이름표 투영과 어긋나지 않는다 | 패턴 7-2 | 과반 연출 때 이름표가 캐릭터 머리에서 벗어남 → `camera.ts` 투영식에 줌 반영 필요. 구현 전 작은 스파이크 |
| A2 | 유령 캐릭터 8명 이하의 재질 복제가 6페이즈 드로우콜 예산(120)·55fps 게이트를 해치지 않는다(복제해도 메시 수는 같고 투명 정렬만 늘어남) | 패턴 7-4 | 성능 미달 → 사다리 3단계(점광원 core) 이전에 선두 점광부터 끄는 규칙(결정 0057)으로 흡수. `perf-run.mjs` 재측정 |
| A3 | 찬반을 "마감까지 고정"으로 두어도(전원 투표 시 조기 종료 없음) 사용자 의도에 맞다 | Open Question 2 | UI-SPEC 문구 "모두 투표했거나 마감이 되면" 해석 차이 → 조기 종료를 원하면 verdict 도 마감 당기기 한 줄 추가 |
| A4 | 처형 알림 문구가 "{닉네임} 님 처형" 하나뿐이라 `phrase`(문구 번호)·`lastExecPhrase` 를 삭제해도 된다 | State of the Art | 문구 변주를 원하면 유지 |
| A5 | 찬반 값 변경 시 본인에게만 state 를 보내는 규율이 "누가 무엇을 골랐는지" 비공개 요건의 타이밍 부분을 충족한다 | 패턴 6, T-08-02 | 더 엄격한 요건이면 투표 마친 집합 변경도 지연/배치 방송 필요 |
| A6 | `hello` 에서 `assigning`/`roleReveal` 단계에도 snap 을 보내는 것이 무해하다(화면이 없음) | 패턴 5 | 불필요한 프레임만. 지도 단계로 한정하면 재접속이 `dayAnnounce` 전에 일어날 때 로비 위치 snap 이 없을 수 있어 이쪽이 안전 |
| A7 | 서버 주도 이동의 슬롯 배정을 "현재 위치 각도 순 sweep"으로 하면 경로 교차가 충분히 적다(별도 최적화 불필요) | 패턴 4 | 시각적으로 엇갈려 걷는 정도 — 진행 지장 없음(작은 화면 문제는 기록만) |
| A8 | 지목 변경에 서버 측 최소 간격(제안 250ms)을 두어도 UI-SPEC 의 "400ms 합치기" 연출과 충돌하지 않는다 | 보안 T-08-08 | 간격이 너무 길면 빠르게 바꾸는 사람이 막혀 보임 → 값만 조정 |
| A9 | 옛 저장 방을 `discussion`(새 90초 마감)으로 옮기는 것이 허용 가능한 마이그레이션이다 | Runtime State Inventory | 진행 중인 판이 토론으로 되돌아감(배포 순간 한정) |

## Open Questions

> **사용자 확정(2026-11-02, plan-phase 컨펌 게이트):** Q1 = **무대 위 서기 + 단일 예외 `STAGE_SPOT`** (추천안). Q2 = **찬반은 마감까지 고정, 조기 종료 없음** (추천안). 나머지(Q3~Q7)는 아래 추천안을 플래너가 따른다.

1. **변론자가 서는 "가운데 무대" 자리를 어떻게 이동 마스크와 맞출 것인가?**
   - 알려진 것: 승인 블록아웃은 `y=0.29` 무대 위(0,0)이고(`bar.js:95`), 이동 마스크는 그 둘레를 막음. 복원은 막힌 점을 거부(함정 6).
   - 불확실: 사용자가 "무대 위 서기"를 필수로 보는가, 걷기 가능한 앞자리도 허용하는가.
   - 추천: **무대 위 서기 + 단일 예외 `STAGE_SPOT`**(캐릭터가 지목 때 모인 원의 한가운데에 서야 "시선이 변론자에게 모인다"가 성립). 예외는 `world.ts` 한 곳(`lineWalkable`/`snapToWalkable`/`parseStoredSegment` 가 공유하는 함수)에 두고 단위 테스트로 복원·유령 이탈을 고정. 사용자 확인이 필요하면 컨펌 게이트로 한 건만 묻는다.

2. **찬반은 전원이 던지면 일찍 끝나는가?**
   - 알려진 것: UI-SPEC 는 "모두 투표했거나 마감이 되면 결과 알림". A3(지목은 마감까지)와 v1.0 D-28("일찍 던져도 시간을 다 채움")은 타이밍 누설 방지 취지.
   - 추천: **조기 종료 없음**(마감에 결과 계산, 결과 알림은 `execution` 단계 앞부분). 필요하면 한 줄(`phaseEndsAt = now`)로 바꿀 수 있다.

3. **결과 알림 시간표.** 추천: `execution`(5초) = [0~2.0초 "찬성 n · 반대 m"] → [통과: 2.0~5.0초 "{닉네임} 님 처형" + 유령 떠오름 / 부결: 2.0~3.4초 "처형 없음"]; 지목 동률·0표는 `night` 시작 1.4초 "처형 없음" 겹침(UI-SPEC 허용 안). 시간 상수는 shared 한 곳 + `≤ EXECUTION_MS` 단위 테스트.

4. **`testBotVote` 메시지의 의미.** 와이어 `{exec, pick}` 를 그대로 두고 `exec` = 봇 찬반 고정, `pick` = 봇 지목 대상 고정(host/other)으로 재해석하는 안이 변경이 가장 작다. `TestTools.tsx`(177~181행 부근 "봇 처형 투표" 라벨)와 `scripts/uat-test-bots.mjs` 라벨을 맞춘다.

5. **밤으로 갈 때 위치.** 결정 0044-18("밤이 되면 각자 토론이 끝난 자리로 돌아간다")과 STATE 기록(9페이즈에서 확정)은 9페이즈 몫이다. 8페이즈는 **서 있던 슬롯 그대로 밤을 맞는다**(UI-SPEC A1). 선택 사항: 9페이즈를 위해 모이기 직전 위치를 DO 메모리/world 키에 보관(비용 작음).

6. **지목 이름표 버튼의 접근성 이중 노출(함정 7)** — 플래너 선택.

7. **아침 길이.** 결정 0044-13 은 8초, UI-SPEC 표는 5초("9페이즈가 정함"). 현재 상수(5초) 유지를 권한다.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | 전부 | 예 | v26.13.0 (`engines >=22.12`) | — |
| npm / npx | 테스트·빌드 | 예 | (node 동봉) | — |
| 시스템 Chrome | `npm run e2e` | 예 | `/Applications/Google Chrome.app` 존재 | `CHROME_PATH` 환경 변수 |
| vitest / tsc | 단위·타입 | 예 | 4.1.12 / 이번 세션 실행 통과 | — |
| workerd (`@cloudflare/vitest-plugin`) | 워커 테스트 | 예 | 이번 세션 `vitest run` 의 worker project 통과 | — |
| Cloudflare 계정(개인) 배포 | 배포본 검증·E2E 기본 주소 | 미확인 | `scripts/check-account.mjs` 가드 | 로컬 `npm run dev` 후 `npm run e2e -- --url http://localhost:5173` |
| 실기기(iPhone 16 Pro 등) | 성능·키보드·조명 읽힘 | 해당 없음 | — | **모든 개발이 끝난 뒤 한꺼번에**(사용자 결정 2026-11-02) — ROADMAP 백로그 999.x 에 이월 |

**Missing dependencies with no fallback:** 없음. **Missing with fallback:** 실기기(자동 검사 + Chrome CPU 4배 스로틀로 대체, 합격선은 낮추지 않음).

## Validation Architecture

> `workflow.nyquist_validation: true` (`.planning/config.json`). `tdd_mode: true`.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.12 — projects `unit`(node) · `client`(happy-dom) · `worker`(workerd), `node --test`(scripts), playwright-core 1.64.1(E2E, 시스템 Chrome) |
| Config file | `vitest.config.ts` (기존, 변경 없음) |
| Quick run command | `npx vitest run <바꾼 테스트 파일>` |
| Full suite command | `npx vitest run && node --test scripts/*.test.mjs scripts/e2e/lib.test.mjs && npx tsc -p tsconfig.app.json --noEmit && npx tsc -p tsconfig.worker.json --noEmit` |
| 화면 E2E | `npm run dev` 후 `npm run e2e -- --url http://localhost:5173 --only <흐름>` (인자 없으면 배포본) |
| 기준선 | vitest 143 파일 / 3897 통과 / 1 건너뜀; node --test 288 통과; 두 tsc 통과 (이번 세션) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DAY-03 | 과반 토론 끝내기 → 즉시 지목, 취소 가능, 유령은 불가, 청소 시점(함정 1) | unit + worker | `npx vitest run test/unit/discussion.test.ts test/worker/day.test.ts` | 개정 필요 |
| DAY-04 | 지목 규칙(자기 불가·산 사람만·바꾸기·취소 없음), 공개 목록, 모이기 슬롯 | unit + worker | `npx vitest run test/unit/nomination.test.ts test/unit/gather.test.ts test/worker/vote.test.ts` | ❌ Wave 0 (nomination·gather) |
| DAY-05 | 최다 한 명 → defense, 동률·0표 → night(+`voteLog` 줄), A3(과반이어도 마감까지) | unit | `npx vitest run test/unit/nomination.test.ts test/unit/tick.test.ts` | ❌ / 개정 |
| DAY-06 | 분모=변론자 제외 산 사람, 변론자·유령 투표 불가, 기권, 익명(집계 직후 키 삭제), 처형 시 역할 비공개 | unit + worker | `npx vitest run test/unit/verdict.test.ts test/worker/leak.test.ts` | ❌ Wave 0 |
| DAY-07 | 단계 길이 90/15/20/10/5/30, v1.0 흐름 부재(정적 가드), 고정 테이블 부재 | unit(정적) + client | `npx vitest run test/unit/phases.test.ts test/unit/dayStaticGuard.test.ts` | ❌ Wave 0 |
| MAP-04 | 지목·변론·찬반·처형·밤·아침에 산 사람 `move` 는 어느 소켓에도 프레임 없음, 토론·낮 시작은 가능, 채팅은 통과 | worker | `npx vitest run test/worker/world.test.ts -t "단계별 이동"` | 개정 + 신규 |
| GHOST-01 | 유령 이동·입력 중·채팅이 산 사람 소켓에 0건(직접 불변식 + 메타모픽 프레임 열 비교), 산 사람 snap 에 유령 ents 없음, 유령 snap 은 전원 | worker(누설) | `npx vitest run test/worker/ghostLeak.test.ts test/worker/chatLeak.test.ts` | ❌ Wave 0 |
| GHOST-02 | 유령 view 에 `spectate.seats`(모든 직업)·밤 `picks`, 산 사람 view 에는 키 없음, DOM 에 `[data-role-chip]`/`[data-ghost-view]` 산 사람 0건 | unit + client + E2E | `npx vitest run test/unit/view.test.ts test/client/gameMap.test.tsx` | 개정 + ❌ |
| (공통) | 화면: 지목 버튼 44×44·가림 없음·배지/도장/선두·찬반 줄·키보드 시 줄 숨김·첫 스냅샷 무이펙트·결과 알림 | client + E2E | `npx vitest run --project client` ; `npm run e2e -- --url http://localhost:5173 --only day` | ❌ Wave 0 |
| (공통) | 테스트 방 봇이 새 흐름으로 한 판 자동 완주 | worker + script | `npx vitest run test/worker/bots.test.ts` ; `node scripts/smoke.mjs http://localhost:5173 --stage full --players 5` | 개정 |
| (공통) | 렌더 게이트 낮 전체 흐름 55fps | script(크롬 4× 스로틀) | `node scripts/perf-run.mjs …` (낮 흐름 시나리오 추가) | 개정 |

### 메타모픽 누설 검사 설계 (GHOST-01 의 증명 방식)
같은 방, 같은 산 사람 행동 대본으로 두 번 돌린다. (A) 유령이 가만히 있음 (B) 유령이 걷고·입력 중을 켜고·유령 채팅을 보냄. 산 사람 소켓들이 받은 프레임을 **휘발 필드(`serverNow`·`phaseEndsAt`·`t0`·`at`·`c`)를 지우고** 비교해 A 와 B 가 같아야 한다. 더해 직접 불변식: (a) 산 사람 소켓의 `world` 프레임 `s` 에 유령 좌석이 없음, (b) `typing.seat`·`chat.seat`·`chat.ch === "ghost"` 에 유령 관련 0건, (c) 산 사람 hello `snap.ents` 에 유령 좌석 없음, (d) `state` 프레임 개수가 같음. 기존 `leak.test.ts` 의 `FORBIDDEN_KEYS`·`ROLE_WORDS` 스캔은 지우지 않고 새 필드(`points`·`voted`·`verdict`·`endCount`)를 허용 목록에 이유와 함께 추가한다("초록을 만들려고 넓히지 않는다").

### Sampling Rate
- **Per task commit:** 바꾼 파일의 테스트 + 해당 쪽 `tsc`(앱 또는 워커)
- **Per wave merge:** `npx vitest run` + 두 `tsc` + `node --test`
- **Phase gate:** 위 전체 + 로컬 E2E(`--only` 새 흐름들) + 배포본 smoke/E2E + 렌더 게이트(크롬 4× 스로틀) 초록. 실기기 항목은 Manual-Only 로 이월.

### Wave 0 Gaps
- [ ] `test/unit/nomination.test.ts`, `test/unit/verdict.test.ts`(개정/신규), `test/unit/gather.test.ts`(N=2..8 슬롯 걷기 가능·간격 ≥ 2.0·경로), `test/unit/movement.test.ts`(canMove 단계×신분 표 전수), `test/unit/audience.test.ts` 개정(world mover·`worldVisibleTo`)
- [ ] `test/worker/ghostLeak.test.ts`(위 메타모픽), `test/worker/helpers.ts` 에 지목/찬반/토론 끝내기/유령 만들기 도우미(`killSeats` 선례) — `voteExec`·`voteCandidate`·`votesIn` 대체
- [ ] `test/unit/dayStaticGuard.test.ts`(07 `chatStaticGuard` 형식): 삭제한 이름(`DayTable`·`ExecVotePanel`·`execVote`·`candidateVote`·`UserRecordSheet`·`RevealLayer` …)이 코드에 다시 나타나지 않음
- [ ] `test/client/gameMap.test.tsx`, `test/client/{voteBadge,verdictPicker,headStackV2}.test.tsx`, `test/unit/dayView.test.ts`(차이 → 이벤트, 합치기 큐, 첫 스냅샷 무이펙트)
- [ ] `scripts/e2e` 새 흐름(`day`: 토론→지목→변론→찬반→처형→밤, `ghost`) 및 `lib.test.mjs` 동기화, `e2eContract.test.ts`(PANEL_H 등 상수 사본: UI-SPEC 표의 새 스테이지 값으로)
- [ ] 프레임워크 설치: 없음

### Manual-Only
| Behavior | Why Manual | 이월 |
|----------|-----------|------|
| iPhone 실기기 5분 평균 55fps(지목 8명 동시·배지 맥박·유령 반투명), 조명 읽힘, 유령 이름표 글자 대비(4.5:1 미달 시 면만 0.8) | 실기기·눈 | 사용자 결정(2026-11-02)에 따라 모든 개발 뒤 한꺼번에, ROADMAP 백로그 |
| 8·9 페이즈 팀 확인(이동·채팅·긴장) | 사람 | 9페이즈 성공 기준 5 |

## Security Domain

> `security_enforcement` 활성(config 에 `false` 없음), ASVS 레벨 1, `block_on: high`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | 기존 | 방 토큰(hello). 이 페이즈 변경 없음 |
| V3 Session Management | 기존 | 소켓 첨부 playerId·connId·교체 소켓 처리. 변경 없음 |
| V4 Access Control | **예** | 서버 `canMove`·`audience`·`buildView` 허용 목록. 신원은 소켓 첨부만 |
| V5 Input Validation | **예** | `z.strictObject` 신규 메시지 3종(덧붙은 키 거부), 규칙 함수 2차 방어, 클라이언트 문자열은 React 텍스트 노드 |
| V6 Cryptography | 아니오 | 새 암호 사용 없음 |
| V7/V8 Data Protection(정보 노출) | **예(핵심)** | 유령 위치/채팅, 찬반 값, 처형 시 역할, 토론 끝내기 개별 값이 해당 소켓에만 |

### Known Threat Patterns (제안 ID — 계획의 `threat_model` 이 확정)

| ID | Pattern | STRIDE | Standard Mitigation |
|----|---------|--------|---------------------|
| T-08-01 | 유령 위치·움직임·채팅·입력 중이 산 사람 소켓에 샘 | Information Disclosure | mover 기반 `audience` + viewer 별 `snap` + `deliver` 한 길 + 메타모픽 누설 검사 + 정적 가드(무차별 방송 이름 금지 유지) |
| T-08-02 | 찬반에서 누가 무엇을 골랐는지 샘(값 또는 방송 타이밍) | Information Disclosure | 개인 값은 view 허용 목록에 본인(`me.verdictVote`)만, 집계 직후 `verdictVote` 키 삭제, 값 변경은 본인에게만 전송, 수는 마감 후 |
| T-08-03 | 처형 알림/이름표/채팅/네트워크에 역할이 실림 | Information Disclosure | `execution` view 에 `seat` 만(직업 키 없음), 클라이언트 알림 문구 "{닉네임} 님 처형", `leak.test` 의 ROLE_WORDS 스캔 유지 |
| T-08-04 | 위조된 지목·찬반(타인 대신, 자기 자신, 죽은 대상, 변론자의 찬반) | Spoofing/Tampering | 행위자는 소켓 첨부 playerId, 규칙 함수가 단계·생존·자기·변론자 검사, strictObject |
| T-08-05 | 막힌 단계에서 이동 요청으로 위치 조작 | Tampering | 서버 `canMove`, 목적지 두 정수뿐(속도·경로·시각은 서버), 조용한 거절 |
| T-08-06 | 산 사람이 유령 채널/유령 정보를 요청 | Elevation of Privilege | `channelOf` 는 서버 상태로만 채널 결정(클라이언트 입력 없음), `spectate` 는 `!isAlive(me)` 일 때만 키 생성 |
| T-08-07 | 토론 끝내기 토글 스팸/개별 표 노출 | DoS/Info | idempotent boolean, 개수만 공개, 연결당 20 msg/s 제한(기존 `overRateLimit`) |
| T-08-08 | 지목 연타로 토스트·채팅 줄 도배 | DoS | 서버 per-player 최소 간격(제안 250ms, 조용한 무시) + 클라이언트 토스트 큐 상한 4(UI-SPEC) |
| T-08-09 | 닉네임/채팅 문자열을 통한 XSS | Tampering | 위 알림·시스템 줄·`aria-label` 포함 React 텍스트 노드 + `aria-label` 만, `innerHTML`·`dangerouslySetInnerHTML` 금지(T-06-26) |
| T-08-10 | 옛 저장 방·옛 번들이 새 서버에서 터지거나 새로움 | Tampering | `normalizeStoredRoom` + 스키마가 옛 메시지 거부 |
| T-08-11 | 재접속 첫 스냅샷/복원이 라이브보다 넓은 정보를 줌 | Info | 첫 hello 의 snap·state·chatLog 모두 viewer 별 규칙(복원은 보낼 때 마스크, 07 결정 0058) |
| T-08-12 | 유령과 산 사람 사이 앱 밖 공모(채팅 앱 등) | — | 수용(온라인 기준 결정 0018: 엿보기·외부 소통은 설계 제약 아님) |

## Sources

### Primary (HIGH confidence — 이번 세션에 직접 읽음)
- `.planning/phases/08-day-execution-ghost/08-UI-SPEC.md` (전체 616행) — 잠금 결정·화면 계약·삭제 목록·검사 규칙
- `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`(DAY-03~07, MAP-04, GHOST-01·02), `.planning/STATE.md`, `.planning/config.json`, `HANDOFF.md`, `CLAUDE.md`
- `docs/decisions/0044`, `0049`, `0053`(전문), 결정 목록(0030~0059)
- 서버: `shared/protocol.ts`, `shared/schemas.ts`, `shared/game/{phases,vote,execution,tick,audience,discussion,alive,room,night,endgame,view,world,map,bots,testTools,win}.ts`, `worker/room.ts`(전체)
- 클라이언트: `src/screens/{RoomScreen,DayScene,Lobby}.tsx`, `src/components/{WorldStage,v2/*,NightPanel}.tsx`, `src/world/{runtime,renderer,camera,store,tagOrder,status,character(발췌),characterData(발췌),maps/bar(발췌)}.ts`, `src/game/{chatUi,chatText,scenes(발췌)}.ts`, `src/net/{useRoomConnection,chatStore,countdown,recordsSeen}.ts`
- 디자인 사본: `design/v2.0/screens/{bar.js,blockout.js}`, `design/v2.0/blockout/VoteHand.dc.html`, `design/v2.0/design-system/components/bundle.{css,js}`
- 테스트·스크립트: `vitest.config.ts`, `test/worker/{helpers,world,day,leak}.test.ts`(발췌), `test/unit/{chatStaticGuard,tokensV2}.test.ts`(발췌), `scripts/e2e/{flows,run,lib}.mjs`(발췌), `package.json`
- 실행 확인: `npx vitest run`(143/3897/1), `node --test …`(288), 두 `tsc`
- 계산: BAR_MASK 걷기 가능 스크립트(링 R=2.4~3.0), 슬롯 표·현 간격 계산(Node 스크립트)

### Secondary (MEDIUM)
- `.planning/phases/07-free-chat/07-VALIDATION.md`, `07-SECURITY.md` — 검증·위협 표 형식 선례

### Tertiary (LOW)
- 정사영 카메라 `zoom` 동작·투명 재질 정렬 비용 — three.js 일반 지식(`[ASSUMED]`, 가정 A1·A2)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 새 패키지 없음, `package.json` 직접 확인
- 서버 아키텍처(단계 표·순수 규칙·audience·이동 게이트): HIGH — 해당 파일 전부 읽음, 변경 지점이 코드 줄로 특정됨
- 모이기/무대 레이아웃: MEDIUM — 마스크·슬롯 계산은 검증했으나 무대 위 서기와 복원 예외는 설계 결정 대기(Open Question 1)
- 클라이언트 런타임 확장: MEDIUM — 구조는 명확하나 카메라 줌·유령 재질은 구현 중 스파이크 필요
- 삭제 범위: HIGH — 소비자 import 를 직접 확인(UI-SPEC 목록 오류 5건 발견)
- 보안: HIGH — 전송 경로가 `audience`/`buildView` 두 곳에 모여 있음을 코드로 확인

**Research date:** 2026-11-02
**Valid until:** 2026-12-02 (코드베이스 기준이라 8페이즈 계획·실행 동안 유효; 그 사이 9페이즈 설계가 바뀌면 패턴 5·9 재확인)
