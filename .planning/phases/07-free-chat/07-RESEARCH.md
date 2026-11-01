# Phase 7: 자유 채팅 - Research

**Researched:** 2026-11-01
**Domain:** Cloudflare Durable Object 위의 채널별 실시간 채팅(서버 권위 수신자 함수), 모바일 웹 하단 고정 입력 + 한글 IME, v1.0 템플릿 채팅·순차 주장 제거
**Confidence:** HIGH (서버·와이어·제거 범위는 코드를 직접 읽어 확인) / MEDIUM (iOS·삼성·카톡 키보드 동작은 실기기 전에는 확정 불가)

<user_constraints>
## User Constraints (from CONTEXT.md)

> 이 페이즈에는 CONTEXT.md 가 없다(사용자가 discuss-phase 를 건너뛰고 바로 계획하기로 했다). 사용자 결정은 승인된 `07-UI-SPEC.md`(2026-11-01) 의 「결정 현황」 표에 있고, 그 표를 CONTEXT 의 Decisions 로 취급한다. 아래는 그 표를 그대로 옮긴 것이다.

### Locked Decisions

| 구분 | 내용 | 출처 |
|------|------|------|
| 잠금 | 채팅 본문은 하단 패널 기록에만 나온다. 머리 위에는 "…" 입력 표시만 둔다(말풍선에 본문 표시 금지) | REQUIREMENTS Out of Scope, 사용자 결정 |
| 잠금 | 채널은 서버가 보낸 사람 상태로 정한다. 화면은 받은 줄만 그리고 거르지 않는다(숨기는 것으로 대신하지 않는다) | CLAUDE.md, 0002·0021, ROADMAP 계획 메모 |
| 잠금 | 로비는 모두 `all`, 낮은 산 사람 `all`, 밤은 산 마피아 `mafia`, 탈락자는 `ghost`. 탈락자는 산 사람 채팅과 마피아 밤 채팅을 **읽기만** 한다(승인 `Ghost` 보드와 결정 0021 유지). 산 사람은 유령 채널을 못 본다 | CHAT-02·03, `Ghost.dc.html`, 0021 |
| 잠금 | 서버가 글자 수·도배를 제한하고 막힌 메시지는 보낸 사람에게만 알린다. 단계 번호가 어긋난 메시지는 더 넓은 채널로 돌리지 않고 폐기한다 | CHAT-05, ROADMAP 계획 메모 |
| 잠금 | 순차 직업 주장·빠른 메시지·텍스트 이모티콘은 화면과 서버에서 모두 지운다. 대체 이모티콘은 만들지 않는다. 동작(몸짓)은 10페이즈 | CHAT-06, AVTR-03 |
| 잠금 | 입력 글자 16px, 입력칸 100자, 누르기 44 이상(입력·보내기 48) | 디자인 시스템 README·`ChatPanel` |
| 잠금 | 햅틱·진동·소리 없음 | 메모리(앱 전용은 앱 전환 때), 12페이즈 |
| 잠금 | 낮이든 밤이든 스산한 분위기 유지. 채팅 면에 밝은 색면을 새로 만들지 않는다 | 메모리(낮도 마피아 분위기) |
| 사용자 확정 D1 | 7페이즈에 입력줄이 붙는 v1.0 고정 테이블 화면 = **낮 토론 · 최후 변론 · 밤(마피아 본인 · 탈락자) · 탈락자 관전 화면**. 버튼 중심의 **처형 여부 투표 · 후보 선택 투표 · 공개 연출 · 아침 카드**에는 7페이즈에서 입력줄을 붙이지 않는다(8·9페이즈가 새로 지을 화면이라 임시 틀을 또 만들지 않는다). 서버는 이 단계들의 채팅도 audience 규칙대로 받게 해 두어 8·9페이즈는 화면만 붙이면 된다 | 성공 기준 1, 계획 메모 |
| 사용자 확정 D2 | 재접속·새로 고침하면 내가 볼 수 있는 **최근 30줄이 서버에서 되돌아온다**(같은 audience 규칙). 서버가 줄을 보관해야 하므로 결정 0017-7("저장하지 않는다")을 v2.0 에서 고치는 결정 기록이 필요하다(11페이즈 END-03 도 마피아·유령 채팅을 서버가 판이 끝날 때까지 보관해야 해 어차피 필요). 결정 기록 0058 은 계획 단계에서 쓴다 | 몰입(결정 0006), END-03 |
| 사용자 확정 D3 | 키보드가 열리면 행동 줄을 숨기고 기록 칸을 72 로 줄인다 | "패널과 키보드" |
| 사용자 확정 D4 | 입력칸에 포커스가 있을 때 맵·바깥을 누르면 **키보드만 닫고 걷지 않는다**(실수로 걷는 것 방지) | "로비(맵)에 붙이기" |
| 사용자 확정 D5 | 서버 제한 시작값: 공백 정리 뒤 1~100자, 같은 사람 최소 전송 간격 600ms, 5초에 5줄 초과 거절, 같은 문장 3초 안에 다시 보내기 거절. 값은 서버 상수 한 곳에서 조정 | CHAT-05 |

### Claude's Discretion

UI-SPEC 「결정 현황」 마지막 행: **리서치가 정함(계획에서)** — 서버 채널 함수 `audience`, 입력 중 만료 시간, 단계 번호 전달 방식, 줄 보관 구조. 이 문서가 아래에서 하나씩 정해 권고한다(입력 중 만료 시간은 UI-SPEC 「머리 위 입력 중」 표가 이미 4초·4.5초로 적었으므로 그대로 쓴다).

### Deferred Ideas (OUT OF SCOPE)

UI-SPEC 「쓰지 않을 것」·「이월」 에서:
- 채팅 본문을 머리 위 말풍선·이름표 옆에 띄우기(머리 위는 "…" 만).
- 빠른 메시지 문장 칩, 직업 주장 패널, 텍스트 이모티콘 트레이, 자동 문장, 채팅 내역 모달(`^`).
- 귓속말, 근접 채팅, 음성 채팅, 이미지·링크 미리보기·마크다운, 멘션, 읽음 표시, 시각 표시, 메시지 수정·삭제, 신고·차단·음소거(MODX-01 은 다음 마일스톤).
- 채널 탭([전체][마피아][유령])과 밤별 구분선 — 결과 화면(11페이즈, 결정 0054).
- 감정표현 버튼·동작 목록(10페이즈), 유언 깃펜(9페이즈) — 입력줄 왼쪽 자리만 남긴다.
- 화면에서 채널을 고르거나 "전체로 보내기" 같은 선택지를 두는 것(채널은 서버가 정한다).
- 화면에서 메시지를 거르는 방식의 채널 분리(서버가 안 보낸다).
- 진홍 면·버튼, 놋쇠·앰버·네온·보라 그라데이션, 따뜻한 색의 UI, 의미 없는 유리 효과, 이모지 아이콘.
- 햅틱·진동·소리.
- 서버 응답 전에 내 줄을 미리 보여 주는 낙관적 표시.
- 캔버스 크기를 키보드에 맞춰 바꾸기, `100dvh` 로 키보드를 따라가기, `window.scrollTo` 로 억지 복구.
- 안내 문장을 늘어놓기(이 페이즈의 새 안내 글은 막힘 알림 한 줄과 채널 시작 안내 한 줄뿐).
- 이월: 8페이즈(투표·지목 패널에 ChatPanel 붙이기, `vote`·`hot` 줄), 9페이즈(`card` 줄, 깃펜, 밤 행동 줄), 10페이즈(감정표현 버튼·9칸 트레이), 11페이즈(탭·`divider`·마피아·유령 채팅 공개).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CHAT-01 | 로비와 낮(토론·지목·변론·찬반·처형·아침)에 살아 있는 사람 모두 하단 채팅창으로 자유 채팅한다 | `audience.ts` 채널 표(`all`), `chat` 메시지·`ChatPanel`, 서버 수락 단계 집합 `CHAT_PHASES`(D1: 서버는 모든 낮 단계를 받고 화면은 낮 토론·변론만 붙임) |
| CHAT-02 | 밤에는 살아 있는 마피아끼리만 채팅하고, 그 내용과 입력 중 표시는 시민 편에게 네트워크로도 가지 않는다 | `channelOf`(밤 비마피아는 `null` → 폐기) + `audience({k:"chat"/"typing", ch:"mafia"})` + 채널별 연번(연번 틈 누설 차단) + 누설 검사 확장 |
| CHAT-03 | 탈락자는 탈락자끼리만 채팅하고, 산 사람에게는 네트워크로도 가지 않는다 | 같은 함수의 `ghost` 행, 받는 사람 = 탈락자뿐 |
| CHAT-04 | 입력하는 동안 내 캐릭터 머리 위에 "…" 가 뜬다(같은 채널을 보는 사람에게만) | `typing` 메시지(채널은 서버가 보낸 사람 상태로 결정), 서버 1.5초 무시·수신 4.5초 만료, `HeadStack` 위 칸 |
| CHAT-05 | 서버가 글자 수·도배를 제한하고 막힌 메시지는 보낸 사람에게 알린다. 한글 조합 중 Enter 와 iOS 키보드가 채팅창을 가리지 않는다 | `chatRules.ts`(정리·길이·간격·반복·창), `chatReject` 프레임, IME `<form onSubmit>` 한 길, `visualViewport` lift, 합격 검사 1~7 |
| CHAT-06 | v1.0 의 순차 직업 주장·빠른 메시지·텍스트 이모티콘을 없앤다 | 「삭제 대상 전수」 표(서버·와이어·화면·테스트·스크립트), `claim` 단계 제거와 `normalizeStoredRoom` 저장 방 이전, 컴파일 오류가 곧 체크리스트 |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

`/Users/dhkim1522/personal/minifia/CLAUDE.md` 에서 계획이 지켜야 할 것:

- **서버 권위**: 게임 규칙·판정·채널은 서버(방 Durable Object)가 정한다. 클라이언트는 받은 상태를 보여 주고 행동만 보낸다(결정 0002).
- **다른 사람의 역할은 서버가 살아 있는 사람에게 보내지 않는다**(탈락자 관전만 예외, 0021). 화면에서 숨기는 것으로 대신하지 않는다.
- **화면은 글을 최소로, 보고 누르는 조작 중심(결정 0051, 가장 중요한 UI 지침)**. 이 페이즈의 새 읽을 글은 막힘 알림 한 줄·채널 시작 안내 한 줄뿐.
- 기획·계획은 플레이어 몰입 기준, 각 페이즈가 자기 구간의 이펙트·액션 기본형을 함께 만든다(0006).
- 새 결정은 `docs/decisions/` 에 **다음 번호**로 추가한다 → `0058`(현재 마지막은 `0057-v2-render-gate.md`).
- 작업을 마칠 때마다 `HANDOFF.md` 갱신(6KB 이하, `test/unit/handoff.test.ts`) 후 push. 브랜치는 `v2`.
- GSD 산출물·응답은 한국어, 코드·명령·파일 이름·요구사항 ID 는 원문.
- **작은 MVP**, **이른 배포**(이후 페이즈 검증은 배포본으로, `minifia-v2`), 화면 페이즈는 UI-SPEC 먼저(완료).
- 디자인 참고 자료: 이 페이즈에 사용자가 따로 준 참고 이미지는 없다(UI-SPEC 「참고 자료」). 승인 사본은 `design/v2.0/` 를 기준으로 한다.
- 메모리 규칙: 햅틱·진동은 앱 전환 때(이 페이즈 제외), 진행에 지장 없는 작은 화면 가장자리 문제는 고치지 않고 기록만(UI-SPEC 「알려진 한계」), 낮도 마피아 분위기 유지.

## Summary

이 페이즈는 세 덩어리다. **(1) 서버 계약**: 지금 DO 는 `broadcastEvent`(방의 모든 소켓에 무차별 전송)와 `broadcastEventTo`(밤 마피아 id 집합) 두 길로 이벤트를 보내고, 로비 위치는 `emitWorld` 가 따로 보낸다. 이 셋을 `audience(state, event)` 순수 함수 하나로 합치고, 채널은 "보낸 사람의 서버 상태"로만 정한다. 새 와이어는 `chat`·`typing`(클라→서버), `chat`·`typing`·`chatLog`·`chatReject`(서버→클라)이며 기존 `claim`·`say`·`emoji` 는 사라진다. **(2) 제거**: `claim` 단계는 `PhaseId`·단계 표·진입/마감 훅·`buildView`·봇·저장 방 정규화에 박혀 있어 지우면 타입 오류가 곳곳에서 난다 — 이 오류 목록이 곧 제거 체크리스트다. 테스트 약 2,900줄(파일 단위 삭제 10개)과 E2E 스크립트(`scripts/e2e/*`, `smoke.mjs`, `uat-*.mjs`)가 함께 바뀐다. **(3) 클라이언트**: 하단 `ChatPanel`(+`visualViewport` 키보드 배치), 머리 위 "…", 한글 IME 한 길 제출. 새 npm 의존성은 필요 없다.

가장 중요한 설계 판단 다섯 가지. ① **연번은 채널별로 따로 센다** — 전역 연번이면 시민이 `all` 줄 번호의 틈으로 마피아·유령 채팅 횟수를 알 수 있다(과거에 `nextNightSeq` 를 따로 둔 이유와 같다). ② **재접속 복원은 "보낼 때의 수신자 비트마스크"를 줄과 함께 저장**해, 복원도 라이브 전송과 같은 `audience` 결과를 쓰게 한다(결정 0021-2 "탈락 시점부터"를 지키면서 유지 비용이 없다). ③ **단계 번호는 새 카운터를 만들지 않고 파생 키 `${일차}:${단계}`** 를 클라이언트가 보내 서버가 대조한다(전이 경로를 빠뜨릴 위험이 없다). ④ **줄 저장은 `room` 키가 아니라 `chat:` 접두어 줄 단위 키**(world 키 분리와 같은 이유). ⑤ **`view.me.chat`(서버가 정한 내 채널)을 뷰에 싣는다** — 패널의 placeholder·아이콘·`data-chat-channel` 이 서버 함수와 어긋날 수 없다.

키보드·IME 쪽에서 이 세션이 직접 확인한 사실: 시스템 Chrome 의 CDP `Input.imeSetComposition` 으로 한글 조합을 재현할 수 있고, 조합 중 Enter 는 `isComposing=true, keyCode=229` 이며 `submit` 은 발생하지 않는다(실행 결과 아래). 반대로 조합이 끝나기 전에 입력칸을 `value=""` 로 비운 뒤 IME 가 이어서 확정하면 글자가 되살아난다 — 합격 검사 4 를 자동화할 근거다. iOS 26.0 에는 `visualViewport.height` 가 키보드가 닫힌 뒤에도 `innerHeight` 보다 작게 남는 보고된 버그(26.1 에서 수정 보고)가 있어, `lift` 식은 "입력칸 포커스 중일 때만, 임계값 이상일 때만" 적용해야 한다(기존 `Sheet.tsx` 와 같은 방식).

**Primary recommendation:** `shared/game/audience.ts`(채널·수신자 단일 함수) + `chatRules.ts`(정리·제한) + `chatLog.ts`(보관·복원 마스크) 세 순수 모듈을 먼저 TDD 로 만들고(Wave 1), 그 위에서 `worker/room.ts` 의 전송 길을 `deliver(audience(...))` 하나로 줄이며 `say/emoji/claim` 을 지운 뒤(Wave 2~3), 클라이언트 `ChatStore`·`ChatPanel`·키보드 훅을 붙이고(Wave 4), E2E·실기기 검사를 마지막에 한다(Wave 5). 결정 0058 은 Wave 1 첫 작업에서 쓴다. 실기기 `?chat-mock=1` 확인(6페이즈 이월 5줄)은 사용자 한 번의 작업이므로 **Wave 0 체크포인트**로 앞당긴다.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 채널 결정(보낸 사람 → `all`/`mafia`/`ghost`/폐기) | API / Backend (Room DO, `shared/game/audience.ts`) | — | 결정 0002·0021: 채널은 서버가 보낸 사람 상태로 정한다. 클라이언트가 채널을 고르는 경로가 와이어에 없다 |
| 수신자 결정(chat·typing·emote·world) | API / Backend | — | 화면 필터 금지. `deliver(audience(...))` 외 전송 길을 두지 않는다 |
| 글자 정리·길이·도배 제한 | API / Backend (`chatRules.ts`) | Browser(`maxlength` 100, 표시용 사전 거름) | 판정은 서버, 클라이언트 검사는 편의일 뿐 |
| 줄 보관·재접속 복원 | Database / Storage (DO storage `chat:` 키) | API(복원 프레임 조립) | 서버가 보관(결정 0058). 복원 대상은 같은 audience 규칙(마스크) |
| 입력 중 신호 중계 | API / Backend(상태 없는 중계 + 사람별 간격 제한) | Browser(켜짐/갱신/4초 후 끄기, 수신 4.5초 만료) | 서버는 타이머를 두지 않는다(하이버네이션을 막지 않음). 만료는 수신 쪽 |
| 채팅 기록 표시·자동 스크롤·새 줄 점 | Browser / Client (`ChatStore` + `ChatPanel`) | — | 서버가 보낸 줄만 그린다. 낙관적 표시 없음 |
| 머리 위 "…" | Browser (WorldStage 이름표 층, v1.0 DayTable) | — | 로비는 DOM 이름표 층, 테이블은 DayTable 이름표 위 |
| 키보드 위 패널 배치·카메라 중심 이동 | Browser (`visualViewport`) | — | 캔버스 px 고정 + 카메라 `offsetY` 만 이동(6페이즈 규칙) |
| 한글 조합 중 제출 | Browser (`<form onSubmit>` 한 길) | — | OS IME 와 DOM 이벤트 순서가 브라우저마다 달라 실기기 확인이 필요 |
| 단계 어긋남 폐기 | API / Backend | Browser(보낼 때 단계 키 동봉) | 넓은 채널로 돌리지 않고 폐기 |
| 순차 주장·템플릿 제거 | API + Browser + Tests | CDN/정적(없음) | 단계 표·뷰·봇·화면·테스트 동시 제거 |

## Standard Stack

### Core

이 페이즈는 **새 패키지가 없다**(UI-SPEC 「Registry Safety」: "npm 새 의존성 없음"). 아래는 이미 쓰는 것이다.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | 4.6.7 | `ClientMessageSchema` 에 `chat`·`typing` strictObject 추가 | 기존 입력 검증 길(`shared/schemas.ts`) 그대로 [VERIFIED: package.json] |
| React | 19.3.1 | `ChatPanel`·`HeadStack` 입력 중 칸·키보드 훅 | 기존 [VERIFIED: package.json] |
| Intl.Segmenter(내장) | — | 글자 수 = 자소(grapheme) 수 | `shared/nickname.ts:32 countGraphemes` 가 이미 Worker·앱 양쪽에서 쓴다 [VERIFIED: shared/nickname.ts:32] |
| vitest | 4.1.12 | unit / client / worker 세 프로젝트 | 기존 [VERIFIED: package.json, vitest.config.ts] |
| playwright-core | 1.64.1 | 화면 E2E(시스템 Chrome) + CDP IME 재현 | 기존 devDependency [VERIFIED: package.json] |
| @cloudflare/vitest-plugin | 1.4.6 | workerd 안의 DO 테스트 | 기존 [VERIFIED: package.json] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `shared/nickname.ts` 의 `FORBIDDEN` 정규식 계열 | — | 채팅 본문의 제어(Cc)·줄(Zl/Zp)·서식(Cf, ZWJ 예외) 문자 제거 | 본문 정리. 닉네임용 상수는 그대로 두고 채팅용 함수를 새로 만들되 같은 유니코드 범주 기준을 쓴다 |
| `visualViewport` API(브라우저 내장) | — | 키보드 높이(`lift`) | `src/components/Sheet.tsx:134-160` 에 같은 패턴이 이미 있다 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 파생 단계 키 `${일차}:${단계}` | `RoomState.phaseSeq` 카운터 | 카운터는 `tick` 루프·`startGame`·`resetToLobby`·`normalizeStoredRoom` 4곳에서 모두 올려야 하고, 한 곳을 빠뜨리면 조용히 넓은 채널로 샐 수 있다. 파생 키는 상태·마이그레이션이 없다 |
| 줄 단위 `chat:` 키 | 단일 `"chat"` 배열 키 | SQLite 기반 DO 는 키+값 2 MB 까지라 한 키도 되지만 줄마다 전체를 다시 쓴다. 줄 단위가 쓰기량·복원 계산이 낫다 |
| 서버가 `me.chat` 을 싣기 | 클라이언트가 alive·role·phase 로 채널을 다시 계산 | 같은 규칙이 두 곳에 있으면 어긋난다. 서버 값 하나를 그대로 표시한다 |

**Installation:** 없음.

**Version verification:** 신규 패키지 없음 → `npm view` 대상 없음. 기존 버전은 `package.json`·`npm test` 로 확인(기준선: 139 파일 3,733 통과 1 건너뜀, 약 16초; `tsc -p tsconfig.app.json`·`tsconfig.worker.json` 통과, 약 1.2초) [VERIFIED: 이 세션에서 `npx vitest run`·`tsc` 실행].

## Package Legitimacy Audit

신규 외부 패키지를 설치하지 않는다 → 감사 대상 없음.

**Packages removed due to [SLOP] verdict:** 없음
**Packages flagged as suspicious [SUS]:** 없음
**검증 방식:** `gsd_run query package-legitimacy check` 는 설치 대상이 있을 때만 필요해 실행하지 않았다. 새 의존성이 필요해 보이면(예: 클립보드·가상 키보드 라이브러리) 계획에서 막고 사용자에게 묻는다.

## 현재 코드 조사 결과 (코드를 직접 읽은 사실)

### 서버 전송 길 전수

[VERIFIED: worker/room.ts 전체 Read] 소켓으로 나가는 모든 것은 `sendTo`(980행) 한 함수로 끝나고, 그 위에 다음 길이 있다.

| 함수 | 수신자 | 호출처 | 7페이즈 처리 |
|------|--------|--------|--------------|
| `broadcast()` (820행) | 방의 모든 소켓에 **각자의 view** | `persistAndBroadcast` | 그대로(채팅은 state 를 방송하지 않는다) |
| `sendViewTo(ids)` (833행) | ids 의 소켓에 각자의 view | `applyPick`, `applyCandidateVote`, 테스트 도구 | 그대로 |
| `broadcastEvent(msg)` (846행) | **무차별**: `room.players` 에 있는 모든 소켓 | `applySay`(낮), `applyEmoji`(낮) | **삭제** |
| `broadcastEventTo(msg, ids)` (857행) | ids 집합 | `applySay`·`applyEmoji`(밤, `nightChatRecipientIds`) | **삭제**, `deliver(ids, msg)` 로 대체 |
| `emitWorld(frame)` (970행) | 로비일 때 방의 모든 소켓 | `applyMove`, `join`, `handleTestReset`, `handleTestBots` | 내부를 `deliver(audience(room,{k:"world"}), frame)` 로 교체(동작 동일) |
| hello 직후 `sendTo(ws, snapFrame(...))` (791행) | 그 소켓 하나 | `handleHello` | 그 뒤에 `chatLog` 한 프레임을 더한다 |

원문 인용(수정 대상):

```ts
// worker/room.ts:846-854 — 삭제 대상. 단계·역할을 가리지 않는 무차별 전송이다.
  private broadcastEvent(msg: ServerMessage): void {
    const room = this.room;
    if (!room) return;
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as SocketAttachment | null;
      if (!att || !room.players.some((p) => p.id === att.playerId)) continue;
      this.sendTo(ws, msg);
    }
  }
```

```ts
// worker/room.ts:968-978 — world 프레임의 유일한 전송 경로(6페이즈). 7페이즈에서 audience 로 교체.
  // world 프레임의 유일한 전송 경로. 6페이즈 수신자 = 로비의 연결된 전원. 7~9페이즈의 audience 함수가 이 자리로 들어온다(RESEARCH R6).
  private emitWorld(frame: WorldFrame): void {
    const room = this.room;
    if (!room || room.phase !== "lobby") return;
```

기존 밤 수신자 규칙(재사용할 의미): [VERIFIED: shared/game/night.ts:203-205]

```ts
export function nightChatRecipientIds(state: RoomState): ReadonlySet<string> {
  return new Set(state.players.filter((p) => !isAlive(p) || p.role === "mafia").map((p) => p.id));
}
```

> 계획 메모(ROADMAP)의 "무차별 `broadcastEvent` 는 지운다"는 **정적 가드 테스트**로 고정한다: `worker/room.ts` 에 `broadcastEvent` 문자열이 없고, `ws.send(` 가 `sendTo` 안에만 있고, `sendTo(` 로 `t: "chat"|"typing"` 을 보내는 곳이 `deliver`/복원 프레임 조립부뿐임을 확인하는 `readFileSync` 테스트(06페이즈 `scripts/deploy-target.test.mjs` 의 정적 회귀 테스트와 같은 방식).

### 와이어·스키마의 현재 값

[VERIFIED: shared/protocol.ts, shared/schemas.ts, worker/room.ts] — 아래 값들을 새 계약이 바꾸거나 지운다.

| 위치 | 원문(verbatim) |
|------|----------------|
| `protocol.ts:17` | `export const MAX_FRAME_BYTES = 1024; // WebSocket 프레임 상한` |
| `protocol.ts:25-28` | `export type PhaseId = \| "lobby" \| "assigning" \| "roleReveal" \| "dayAnnounce" \| "claim" \| "discussion" \| "execVote" \| "candidateVote" \| "candidateVoteReveal" \| "defense" \| "execution" \| "night" \| "morning" \| "ended";` (줄바꿈 생략) |
| `protocol.ts:229-231` | `\| { t: "claim"; claim: Claim }` / `\| { t: "say"; template: TemplateId; target?: number; claimedRole?: RoleId }` / `\| { t: "emoji"; icon: EmojiId }` |
| `protocol.ts:288-294` | `WsErrorCode = "BAD_MESSAGE" \| "NOT_HOST" \| "NOT_ENOUGH_PLAYERS" \| "WRONG_PHASE" \| "CANNOT_KICK" \| "RATE_LIMITED"` |
| `protocol.ts:319-325` | `ServerMessage = { t: "state"; view: RoomView } \| { t: "pong"; ... } \| { t: "error"; code: WsErrorCode } \| { t: "emoji"; seat: number; icon: EmojiId; at: number } \| ChatEvent \| WorldFrame` |
| `room.ts:56-57` | `const RATE_WINDOW_MS = 1000;` / `const RATE_MAX_MESSAGES = 20;` (전송 계층 한도: 소켓당 1초 20개 — 채팅 제한과 별개로 남는다) |
| `chat.ts:45,47` | `SEND_COOLDOWN_MS = 2_000` / `SERVER_MIN_SEND_GAP_MS = 1_800` (삭제 → D5 로 대체) |
| `phases.ts:26` | `export const DISCUSSION_MS = 40_000; // DAY-01 — 자유 채팅 없이 빠른 메시지·이모티콘뿐이라 짧게(결정 0039)` |
| `phases.ts:58-59` | `dayAnnounce: ... next: "claim"` / `claim: ... next: "discussion"` |
| `wrangler.jsonc:18` | `"Room": { "type": "durable-object", "storage": "sqlite" }` |
| `leak.test.ts:45` | `const FORBIDDEN_KEYS = ["token", "id", "playerId", "connId", "nicknameKey", "joinSeq", "hostId"];` |
| `leak.test.ts:77` | `const ROLE_WORDS = new Set(["mafia", "police", "doctor", "citizen", "none"]);` |
| `leak.test.ts:79` | `const ROLE_PATHS_ALIVE = [".view.me.role", ".view.day.roles[]", ".view.day.claimLog[].claim"];` |

**누설 검사와 새 와이어의 충돌 두 가지** (계획이 놓치기 쉬움):
1. 새 프레임 키에 `id`·`role`·`playerId` 를 쓰면 `FORBIDDEN_KEYS` 가 막는다 → 키 이름은 `ch`, `seat`, `seq`, `text`, `at`, `on`, `why` 로 한다.
2. 마피아 채널 표식 `ch: "mafia"` 와 `me.chat: "mafia"` 는 값이 `ROLE_WORDS` 에 걸린다. 이 문자열은 **마피아 본인과 탈락자 소켓에만** 나가므로 정보가 늘지 않는다. 검사 쪽 허용 경로(`.ch`, `.lines[].ch`, `.view.me.chat`)를 "받을 권리가 있는 소켓에만"이라는 조건과 함께 더하고, 시민 편 소켓에서는 이 경로 자체가 0건임을 단언한다("허용 목록을 초록을 만들려고 넓히지 않는다" — UI-SPEC).

### 저장 상태에 박힌 claim 관련 필드

[VERIFIED: shared/game/room.ts:95-105, 313-356, shared/game/tick.ts:44-62, shared/game/view.ts:39-51, 64-94]

- `RoomState`: `claimOrder`, `claimIdx`, `claimStart`, `claimPick`, `claimLog`, `nextMessageSeq`, `nextNightSeq`; `Player.lastSendAt`.
- `tick.ts` `ON_ENTER.claim = enterClaim`, `ON_DEADLINE.claim = resolveClaimTurn`.
- `view.ts` `DAY_PHASES` 에 `"claim"`, `buildDay` 가 `claimLog`·`turn` 을 싣는다.
- `normalizeStoredRoom` 이 옛 `claim` 방 정규화(`needsClaimOrder`)를 이미 갖고 있다 — 이 함수에 **`claim` 단계로 저장된 방을 `discussion` 으로 옮기는 줄**을 더한다(`claimReveal` 을 옮기는 기존 줄과 같은 방식, `LEGACY_PHASES` 에 `claim: "claim"` 추가). 배포 시점에 `claim` 단계 방이 있으면 `buildView` 가 `PHASE_DEFS[claim]` 을 조회하다 터지기 때문이다(기존 주석 313~316행이 같은 위험을 설명).

### 삭제 대상 전수 (grep 으로 확정한 목록)

`grep -rlE "claim|Claim"` / `"say"|template|TEMPLATE` / `emoji|Emoji|EMOJI|emote` 를 `src shared worker test scripts` 에 돌린 결과(이 세션 실행). **컴파일 오류가 가장 믿을 만한 체크리스트**다: `PhaseId` 에서 `"claim"` 을 빼면 `Record<PhaseId, ...>` 를 쓰는 곳(`PHASE_DEFS`, `RoomScreen.PHASE_ANNOUNCE`, `scenes.ts`)이 모두 오류를 낸다.

| 구분 | 파일 | 처리 |
|------|------|------|
| 서버 규칙(파일째) | `shared/game/claim.ts`(94줄) | 삭제 |
| 서버 규칙(재작성) | `shared/game/chat.ts`(165줄: `QUICK_TEMPLATES`·`say`·`emote`·쿨다운) | 삭제 후 `chatRules.ts` 로 대체 |
| 서버(수정) | `shared/game/{phases,tick,view,room,bots,night,testTools}.ts`, `shared/protocol.ts`, `shared/schemas.ts`, `worker/room.ts` | `claim` 단계·훅·필드·핸들러 제거, `nightChatRecipientIds` 는 `audience` 로 흡수 |
| 화면(파일째) | `ClaimPanel`·`TurnPanel`·`QuickMessageSheet`·`EmojiTraySheet`·`DefenseChips`·`DiscussionControls`·`MessageLog`·`ChatHistorySheet` (`src/components/*.tsx`), `src/net/{claimLines,seatFloats,useSendLock}.ts`, `src/game/messageText.ts` | 삭제 (`DefensePanel`·`DayScene`·`verdictScene`·`DayTable`·`UserRecordSheet`·`recordRows`·`scenes.ts`·`RoomScreen`·`Icon.tsx`·`TestTools.tsx`·`NightPanel.tsx`·`ExecVotePanel.tsx`·`useViewChoice.ts`·`roleText.ts` 는 수정) |
| 화면 부수 효과 | `UserRecordSheet`·`recordRows` 는 `view.day.claimLog` 를 읽는다. `claimLog` 가 뷰에서 사라지면 "주장했어요" 행이 없어지고 투표 행(exec·cand)만 남긴다. UI-SPEC 「지울 것」 표에 없는 항목이므로 **계획이 명시적으로 챙길 것** | 수정 |
| CSS | `src/styles/{day,talk,daytable,night,verdict,urecord,result,rolecard}.css` 중 `.mf-claimpanel`·`.mf-discuss`·`.mf-msglog`·말풍선 계열 | 해당 규칙만 삭제 |
| 테스트(파일째) | `test/unit/{chat,claim,claimLines,messageText}.test.ts`, `test/client/{claimPanel,defenseChips,emojiTraySheet,quickMessageSheet,turnPanel,seatFloats}.test.tsx` | 삭제 (약 2,900줄) |
| 테스트(수정) | `test/unit/{view,bots,tick,gameRoom,discussion,night,endgame,execution,recordRows,scenes,testTools,preview,nyquist-02,nyquist-03.1,e2eContract}`, `test/client/{dayScene,dayTable,discussion,defense,nightScene,phaseScreens,userRecordSheet,guide,candidateVote,execVote,execution,morning,noExecution,reveal,roleCardFlow,roomScreen,sceneIntro,useRoomConnection,testTools,atmosphere,characterAudit,icon,journal,resultScreen,verdictStates,roleCardSheet,nightChat}`, `test/worker/{day,bots,night,vote,leak,alarm,endgame,testTools,helpers}`, `test/helpers/verdictViews.ts` | 주장·say·emoji 단계를 건너뛰도록 고치거나 새 채팅 검사로 교체. **`skip` 금지**(UI-SPEC) |
| 스크립트 | `scripts/e2e/{flows,lib,browser,lib.test}.mjs`(`claimMine/claimOther/claimDone` 흐름·`PANEL_H=157`·`.mf-claimpanel` 선택자), `scripts/{smoke,bots,uat-day,uat-night,uat-vote,uat-test-room,uat-test-bots,gallery}.mjs`, `scripts/tsc-scoped.test.mjs` | 주장 단계 제거·채팅 흐름 추가. `smoke.mjs` 는 981줄 중 85곳이 걸린다 — 계획에서 따로 한 묶음으로 잡는다 |

> 집계: `claim` 계열이 걸리는 파일 약 100개, 그중 `test/` 가 가장 크다(`chat.test.ts` 191곳/713줄, `claim.test.ts` 141곳/420줄, `view.test.ts` 109곳/1649줄, `dayScene.test.tsx` 91곳/766줄, `bots.test.ts` 89곳/1013줄, `day.test.ts` 86곳/499줄, `smoke.mjs` 85곳/981줄).

**봇(결정 0024)**: `shared/game/bots.ts` 의 `BotAct` 에서 `claim`/`say`/`emoji` 를 빼고 `{ t: "chat"; text }` 를 더한다. 봇은 고정 문구 목록(8~10개, UI-SPEC)에서 고르고 **사람과 같은 `applyChat` 본체**를 지난다(특권 없음). 난수 호출 순서가 시드 테스트의 계약이므로(`bots.ts` 머리말) 낮 토론·밤 계획의 난수 호출 수가 바뀐다 — `test/unit/bots.test.ts`·`test/worker/bots.test.ts` 의 기대값을 새 순서로 다시 고정한다.

## Architecture Patterns

### System Architecture Diagram

```
 [폰 A 입력칸]                                                      [폰 B ... 소켓]
   │  <form onSubmit> 한 길 (조합 끝난 값)                                ▲
   ▼                                                                      │ sendTo(ws, frame)
 ClientMessage  {t:"chat", text, pk}   {t:"typing", on, pk}               │
   │  (채널 필드 없음)                                                    │
   ▼                                                                      │
┌─────────────────────────── Room DO (worker/room.ts) ───────────────────┴──────────────┐
│ webSocketMessage → zod strictObject → advance(now)  (만료·tick 먼저)                    │
│   │                                                                                    │
│   ├─ handleChat(att.playerId, msg)                                                      │
│   │    1) pk ≠ phaseKey(room)                → chatReject{why:"phase"}  (폐기, 넓히지 않음)│
│   │    2) ch = channelOf(room, sender)       → null이면 chatReject{"phase"}              │
│   │         lobby/낮: alive→all, dead→ghost │ 밤: alive 마피아→mafia, dead→ghost, 그 외 null│
│   │    3) sanitize + 길이/간격/반복/창        → 실패면 chatReject{"length"|"rate"|"repeat"} │
│   │    4) ids = audience(room,{k:"chat",ch}) ← 이 한 번만 계산해 둔다 (await 앞)         │
│   │    5) 줄 만들기: ch별 seq++, mask(ids→좌석 비트), storage.put("chat:<g>")           │
│   │    6) deliver(ids, {t:"chat", ch, seat, seq, text, at})                             │
│   │                                                                                    │
│   ├─ handleTyping: pk·channelOf 같은 검사 → 사람별 1.5초 무시 → deliver(audience(typing))│
│   │                                                                                    │
│   └─ handleHello: state → (로비) world.snap → chatLog(replay: 내 비트가 켜진 줄만)       │
│                                                                                        │
│  audience(room, ev)  ◀── 위치(world)·채팅·입력 중·(10페이즈)동작 모두 이 함수 하나       │
│  deliver(ids, msg)   ◀── 이벤트 전송의 유일한 길 (broadcastEvent 삭제)                  │
└────────────────────────────────────────────────────────────────────────────────────────┘
        │ storage                                  ▲ 생성자(blockConcurrencyWhile)
        ▼                                          │ list({prefix:"chat:"}) → 메모리 사본
  "room" "world" "chat:000001".."chat:000NNN"  ────┘
```

### Recommended Project Structure

```
shared/
├── protocol.ts            # 수정: chat/typing/chatLog/chatReject, me.chat, PhaseId 에서 claim 제거, EMOTE_IDS(10페이즈용 표만)
├── schemas.ts             # 수정: chat/typing strictObject, say/emoji/claim 제거
└── game/
    ├── audience.ts        # 신규: CHAT_PHASES, phaseKey, channelOf, audience (순수)
    ├── chatRules.ts       # 신규: 상수(D5 한 곳), sanitizeChatText, 사람별 제한 판정 (순수)
    ├── chatLog.ts         # 신규: 줄 보관·연번·마스크·복원 조립·상한 정리 (순수, 저장 I/O 없음)
    ├── claim.ts           # 삭제
    └── chat.ts            # 삭제
worker/room.ts             # handleChat/handleTyping/deliver, hello 복원, 저장 키 chat:*
src/
├── net/chatStore.ts       # 신규: WorldStore 와 같은 형태(React 밖, subscribe), epoch 규칙
├── net/useKeyboardLift.ts # 신규: visualViewport lift·열림 판정·헤더 오프셋
├── components/v2/ChatPanel.tsx   # 신규(승인 부품 이식)
├── components/v2/HeadStack.tsx   # 수정: typing 칸
└── components/v2/V2Icon.tsx      # 수정: send·ghost·roleMafia 추가
```

### Pattern 1: 채널 표 = 한 함수 (`shared/game/audience.ts`)

**What:** 위치·채팅·입력 중·동작의 수신자를 한 순수 함수가 정한다. 호출하는 쪽(DO)은 결과 집합에 든 소켓에만 보낸다. 입력은 `RoomState` 와 이벤트 종류·채널뿐이다(클라이언트가 보낸 값 없음).
**When to use:** 이벤트 프레임(상태 `state` 가 아닌 것) 전부.

| 이벤트 | 채널 | 로비 | 낮(알림~아침) | 밤 | 받는 사람 |
|--------|------|------|----------------|-----|------------|
| `chat`·`typing`·(`emote`) | `all` | 허용 | 허용 | 없음 | 방의 모든 사람(산 사람 + 탈락자) |
| 〃 | `mafia` | 없음 | 없음 | 허용 | **산 마피아 + 탈락자** |
| 〃 | `ghost` | 없음 | 허용 | 허용 | **탈락자만** |
| `world` | — | 허용 | (8페이즈) | (9페이즈) | 로비일 때 방의 모든 사람, 그 밖엔 빈 집합 |

방어 장치(호출부 버그에도 안전하도록 audience 자체가 막는다): 채팅 계열 이벤트인데 단계가 `CHAT_PHASES` 밖이면 빈 집합, `mafia` 인데 `night` 가 아니면 빈 집합, `ghost` 는 단계와 무관하게 탈락자만.

`CHAT_PHASES` 권고: `lobby, dayAnnounce, discussion, execVote, candidateVote, candidateVoteReveal, defense, execution, night, morning`. 제외: `assigning`·`roleReveal`(패널 자체가 없음, UI-SPEC)·`ended`(11페이즈). 결정 0044-23("처형·아침에도 채팅 허용")·D1("서버는 이 단계들의 채팅도 받게")과 일치 [VERIFIED: docs/decisions/0044-v2-same-space.md:46 의 23항, 07-UI-SPEC D1].

`channelOf(state, senderId)`: 단계가 `CHAT_PHASES` 밖이면 `null`; 보낸 사람이 방에 없으면 `null`; 탈락자면 `"ghost"`; 밤이면 `role === "mafia"` 일 때만 `"mafia"`, 아니면 `null`; 그 밖은 `"all"`. 보낸 사람 상태는 한 단계(phase instance) 안에서 바뀌지 않는다 — 탈락은 `execution`·`morning` **진입 훅**에서만 일어나므로(`shared/game/night.ts:enterMorning`, 처형 진입 훅) 단계 키가 같으면 채널도 같다. 이 불변식이 "단계 키 일치 ⇒ 보낸 사람 채널 확정"의 근거다.

**단계 키(권고)** — `phaseKey(state) = \`${state.day ?? 0}:${state.phase}\``. `view` 에는 이미 `phase` 와 `day.n` 이 있어 클라이언트가 같은 함수로 계산해 `pk` 로 보낸다(와이어에 새 상태 필드 없음). 밤은 `n:night`, 아침은 `n:morning`, 다음 낮은 `n+1:dayAnnounce` 라 단계마다 유일하다. 서버는 `msg.pk !== phaseKey(room)` 이면 `chatReject{why:"phase"}` 로 **폐기**한다(재분류하지 않는다).

### Pattern 2: 연번은 채널별로, 마스크는 줄과 함께 (`chatLog.ts`)

**What:** 줄 하나 = 서버 저장 레코드 `{ g, ch, seq, seat, text, at, n, r }`. `g` 는 방 전체 쓰기 순서(저장 키 `chat:<g 6자리 0패딩>`, 클라이언트로 안 나감), `seq` 는 **채널별 카운터**, `r` 는 **보낼 때의 수신자 좌석 비트마스크**(좌석 0~7 → 8비트), `n` 은 일차(11페이즈 밤별 구분선용).
**왜 채널별 연번인가:** 전역 연번이면 시민이 받는 `all` 줄의 `seq` 가 마피아 밤 채팅·유령 채팅 때문에 건너뛴다 → 횟수가 샌다. 과거 코드가 밤 줄 번호(`nextNightSeq`)를 낮과 따로 센 이유가 이것이다 [VERIFIED: shared/game/room.ts:90-94 주석 "낮 번호를 밤에 쓰면 살아 있는 사람이 낮 chat 프레임 seq 간격으로 밤 메시지 수를 알 수 있다"]. 채널별로 세면 `all` 은 `all` 수신자 전원에게 틈 없이 가고, `mafia` 틈은 이미 권리가 있는 사람에게만 보인다.
**복원(`chatLog`)**: 접속한 사람의 좌석 비트가 켜진 줄만, **채널별 최근 30줄**을 시간 순으로 한 프레임에 담아 보낸다. 마스크는 와이어에 없다. 복원이 `audience` 결과의 기록이므로 "복원 줄도 같은 audience 를 지난다"(UI-SPEC 누설 검사 (d))가 구조로 보장된다.
**결정 0021-2 와의 관계:** "탈락 시점부터 보내며 이미 끝난 밤의 지난 정보는 보내지 않는다" — 마스크 방식은 새로 탈락한 사람에게 탈락 이전의 마피아 줄을 복원하지 않는다. 이를 바꾸려면(탈락자에게 지난 마피아 줄도 보이기) 정책 결정이 필요하다 → Open Question 2.
**상한:** 줄 보관 상한은 채널별(`all` 100, `mafia` 300, `ghost` 300 권고 — 가정 A4)로 두고 넘치면 오래된 것부터 지운다(지울 때는 한 번에 20줄씩 묶어 삭제 행 수를 줄인다). 11페이즈 END-03 이 판 끝까지 마피아·유령 줄을 필요로 하므로 `mafia`·`ghost` 는 `all` 보다 넉넉히 둔다. 방이 지워지면(`deleteAll`) 같이 사라지고, `testReset`(`handleTestReset`)은 `chat:` 키를 직접 지운다.
**생성자 복원:** `blockConcurrencyWhile` 안의 기존 `ctx.storage.get(["room","world"])` 옆에서 `ctx.storage.list({ prefix: "chat:" })` 로 읽어 메모리 사본과 채널별 다음 `seq` 를 되살린다.

### Pattern 3: 보내기 한 길 — "한 번 계산하고, 저장하고, 보낸다" (`handleChat`)

DO 에서 `await` 사이에 다른 이벤트(알람 → `advance`)가 끼어들 수 있다. 그래서 **채널·수신자·마스크를 `await` 앞에서 한 번만 계산해 지역 변수로 들고**, `storage.put` 후 그 집합으로 전송한다(다시 `audience` 를 부르지 않는다). 쓰기 뒤 전송은 output gate 가 쓰기 완료까지 붙잡는다 [CITED: 06-RESEARCH R6 → developers.cloudflare.com/durable-objects/api/legacy-kv-storage-api/]. 거절 프레임은 `chatReject` 만 보내고 `state` 를 다시 보내지 않는다(기존 `sendRejection` 은 단계 어긋남에 state 를 다시 보내 화면을 서버 값으로 돌리지만, 채팅 폐기는 화면 전환이 필요 없다 — 단, 단계 어긋남이 반복되면 클라이언트 view 가 낡았다는 신호이므로 `chatReject{"phase"}` 뒤에 그 소켓에만 최신 `state` 를 한 번 보내는 선택지도 있다; 권고: **보낸다** — `handleStart` 거절 선례와 같고 입력칸 복원 후 재시도가 바로 맞는 단계로 간다).

### Pattern 4: 입력 중 중계 (`typing`)

서버는 상태 없는 중계다. 사람별 `{ on, lastRelayAt }` 를 **메모리 Map**(playerId 키)에 두고: `on:true` 는 직전 중계 후 1500ms 안이면 조용히 버린다(오류 프레임 없음, UI-SPEC), `on:false` 는 켜져 있을 때만 중계(항상 통과). 단계 키·채널 결정은 `chat` 과 같다 — 불일치면 **조용히** 버린다(입력 중은 알릴 필요가 없다). 서버 타이머를 두지 않는다 → 하이버네이션을 막지 않는다. 만료는 수신 쪽(4.5초)과 보낸 쪽(4초 무입력 시 끄기)이 맡는다.

### Pattern 5: 클라이언트 `ChatStore` (React 밖, `WorldStore` 와 같은 형태)

연결과 같은 수명으로 `RoomScreen` 에서 한 번 만든다(로비 줄이 게임 시작 뒤에도 이어져야 하므로 `Lobby`/`DayScene` 에 두지 않는다 — UI-SPEC "방 한 번 들어오면 …"). `connection.onEvent` 로 `chat`/`typing`/`chatLog`/`chatReject` 를 구독한다. **새 서버 메시지 `t` 는 `useRoomConnection.parseServerMessage` 의 화이트리스트에 반드시 더해야 한다** — 6페이즈에서 같은 함정이 있었다 [VERIFIED: src/net/useRoomConnection.ts:64 `if (v && (v.t === "state" || ... || v.t === "world")) return v as ServerMessage;`, 06-RESEARCH R5]. 규칙:
- `chat`: `(ch, seq)` 로 중복 제거. 기록은 최근 100줄까지(넘치면 오래된 것부터 버림).
- `chatLog`: **합집합 병합**(같은 `(ch,seq)` 는 건너뜀) 후 `at`·`ch` 순 정렬. 복원 때 새 줄 점·토스트를 만들지 않는다.
- `typing`: 좌석별 만료 시각 맵(수신 시각 + 4500ms). 단계 키 변경·채널(`me.chat`) 변경·epoch 변경에서 비운다.
- 시스템 줄(입장·퇴장·채널 시작·변론 시작)은 **클라이언트가 view 변화에서 만든다**(서버 프레임 아님, 저장·복원 안 함). 입장·퇴장은 이미 있는 `diffRoomViews`/`toastForDiff` 를 재사용한다. 재접속 첫 state(epoch 변화)에서는 만들지 않는다.
- 막힘 알림은 기록과 별도 필드(2.5초 후 만료, 새 알림이 이전 것을 바꿈).

### Pattern 6: 키보드 배치 훅 (`useKeyboardLift`)

[VERIFIED: src/debug/chatMock.ts:230-243, src/components/Sheet.tsx:134-160] 6페이즈 시안과 기존 시트에 같은 식이 있다. 제품화 시 지킬 것:
- **입력칸 포커스 중에만** `lift` 를 적용하고 임계값 이상일 때만 "열림"으로 본다. `Sheet.tsx` 는 `KEYBOARD_MIN_PX = 120`(주소창 접힘으로 시트가 떠오르던 G-01-9 대응, `Sheet.tsx:19`), UI-SPEC 은 `lift > 80`. 두 값이 달라 보이지만 UI-SPEC 값이 잠금이므로 80 을 쓰되 "포커스 게이트"는 `Sheet` 와 같게 둔다.
- 값은 `visualViewport` 의 `resize`/`scroll` 에서 읽되 **한 프레임에 한 번만(rAF)**, 포커스·블러 뒤 +100/+300/+1000ms 에 한 번씩 더 읽는다. WebKit 은 이벤트 직후 값이 잘못 나오고 지연 뒤 맞는 경우가 보고돼 있다 [CITED: bugs.webkit.org/show_bug.cgi?id=237851 (검색 요약)].
- 값은 React 상태가 아니라 CSS 변수(`--mf-kb-lift`, `--mf-vv-top`)로 쓴다(프레임마다 리렌더 방지). `data-kb-open` 만 상태.
- 로비의 `stageInsets.bottom` 은 `패널 높이 + lift` 여야 한다 — `WorldStage` 의 `stageRect` 가 `h - ins.bottom` 으로 계산하기 때문이다 [VERIFIED: src/components/WorldStage.tsx:110-114]. 캔버스는 `ResizeObserver` 호출이 0 이어야 하므로(합격 검사 2) 컨테이너 높이를 `100dvh` 에 묶지 말고 처음 px 로 고정한다. 현재 `.mf-room` 은 `height: calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom))` 이다 [VERIFIED: src/styles/room.css:10].

### Anti-Patterns to Avoid

- **화면에서 줄을 거르는 채널 분리**: 서버가 보내지 않는다(0002·0021). `ChatPanel` 에 채널 필터 props 를 만들지 않는다. (밤 마피아가 낮 줄을 "숨기는" 표시는 **받은 줄의 표시 흐름 선택**이지 보안 경계가 아니다 — 서버가 이미 권리 있는 줄만 보냈다.)
- **재분류**: `pk` 가 어긋났을 때 "그럼 `all` 로" 처리 금지. 폐기만.
- **전역 연번**: 위 Pattern 2.
- **`room` 키에 줄 쓰기**: `room` 은 입장·시작마다 통째로 다시 쓰인다. 줄은 `chat:` 키.
- **서버 타이머로 입력 중 만료**: 하이버네이션을 막는다. 수신 쪽 만료.
- **`keydown` 에서 Enter 직접 제출**: UI-SPEC 이 `<form onSubmit>` 한 길로 잠갔다.
- **입력칸 값을 `onChange` 안에서 가공**(자르기·공백 접기·정규식): IME 조합 중 값을 덮어 글자를 깨뜨리는 고전적 원인. 가공은 제출 시점에만.
- **전송 직후 낙관적 표시**: 잠겼다(서버 권위).
- **`window.scrollTo` 복구·`100dvh` 로 키보드 따라가기**: 잠겼다.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 글자 수(자소) 세기 | `str.length` / 코드포인트 순회 | `countGraphemes` (`shared/nickname.ts:32`, `Intl.Segmenter`) | 이모지 가족·결합 문자. 이미 Worker 번들에서 쓰는 중 |
| 제어·서식 문자 걸러내기 | 문자별 if | `\p{Cc}\p{Zl}\p{Zp}\p{Cf}` 유니코드 범주 정규식(ZWJ 예외) — `nickname.ts` 와 같은 기준 | 방향 제어(U+202E)·영폭 공백으로 줄을 위장하는 것을 막는다 |
| 키보드 높이 | 사용자 에이전트 문자열 분기 | `visualViewport` + 포커스 게이트 | 기기 목록을 코드에 두지 않는다 |
| IME 상태기계 | 자체 조합 추적 플래그 | 네이티브 `compositionstart/end` + form `submit` | 브라우저가 조합 중 Enter 의 암묵 제출을 막는다(아래 실측). 지연 창(grace window)은 정당한 빠른 Enter 를 삼킨 사례가 있다 |
| 도배 제한 | 외부 rate-limit 라이브러리 | 사람별 `{마지막 시각, 최근 수락 시각 배열, 마지막 문장}` 순수 함수(D5 상수 한 곳) | 규칙이 4개뿐. 순수 함수여야 단위 테스트가 시각을 주입한다 |
| 수신자 필터 | 소켓마다 `if (role...)` 흩어진 검사 | `audience()` | ROADMAP 계획 메모의 핵심 |
| 위치 저장 방식 | — | 6페이즈 `world` 키 분리·디바운스 패턴 참고(줄은 디바운스 없이 즉시) | 채팅은 소량이고 유실이 눈에 띈다 |

**Key insight:** 이 도메인의 위험은 기능이 아니라 "누가 무엇을 받는가"다. 수신자 결정이 코드 한 곳에 있어야 누설 검사 한 벌이 모든 경로를 덮는다.

## Runtime State Inventory

> 이 페이즈는 이름 바꾸기가 아니라 **저장 모양을 바꾸고 단계 하나를 없애는 마이그레이션**이다. 5개 범주를 모두 답한다.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | 배포본(`minifia-v2`) DO 저장소 `room` 키에: `phase:"claim"` 인 방(진행 중이면), `claimOrder/claimIdx/claimStart/claimPick/claimLog`, `nextMessageSeq/nextNightSeq`, 각 `Player.lastSendAt`. 방 수명은 최대 3시간(`ROOM_TTL_MS`) [VERIFIED: shared/game/room.ts:23] | **코드 편집 + 읽을 때 이전**: `normalizeStoredRoom` 에 ① `claim` 단계 → `discussion` ② 위 키들을 구조 분해로 제거를 더한다. 데이터 마이그레이션 작업은 필요 없다(방이 수 시간 안에 사라짐) |
| Live service config | 없음 — 외부 서비스에 이 문자열을 저장한 곳 없음(Cloudflare 설정은 `wrangler.jsonc` 한 파일) | 없음 |
| OS-registered state | 없음 — 이 프로젝트는 OS 작업 스케줄러·systemd 를 쓰지 않는다 | 없음 |
| Secrets/env vars | 없음 — 채팅은 새 시크릿·환경 변수가 없다 | 없음 |
| Build artifacts | `dist/`(Vite 빌드 산출물, 배포 전 `npm run deploy` 가 다시 빌드) · `worker-configuration.d.ts`(`wrangler types` 생성, 바인딩 변경 없음) | 배포 가드가 `dist/worker/wrangler.json` 을 검사하므로 `npm run deploy` 경로를 그대로 쓴다 |

**배포 시 호환:** 새 와이어(`chat`/`typing`)를 모르는 옛 번들 클라이언트는 새 서버에서 `parseServerMessage` 가 모르는 `t` 를 버린다(안전). 옛 서버에 새 클라이언트가 `chat` 을 보내면 `BAD_MESSAGE`. v2 는 단일 배포라 문제 없다.

## Common Pitfalls

### Pitfall 1: 연번 틈으로 새는 비공개 채널 횟수
**What goes wrong:** 전역 `seq` 를 쓰면 시민이 받은 `all` 줄 번호가 1,2,5 로 건너뛴다 → 마피아가 3,4 를 말했다는 걸 안다.
**Why it happens:** 단순 카운터 하나가 가장 쉽다.
**How to avoid:** 채널별 카운터. 누설 검사에 "마피아가 말해도/안 말해도 시민 프레임 열이 같다"를 넣는다(UI-SPEC 이미 요구).
**Warning signs:** `seq` 가 `nextMessageSeq` 하나에서 나온다.

### Pitfall 2: 새 서버 메시지 `t` 가 클라이언트에서 조용히 사라짐
**What goes wrong:** `parseServerMessage` 화이트리스트에 없으면 프레임을 버려 "서버는 보냈는데 화면에 안 나온다".
**How to avoid:** `chat`·`typing`·`chatLog`·`chatReject` 를 더하고 `emoji` 를 뺀다. `RoomEvent` 타입의 `Extract<..., { t: "emoji"|"error"|"chat"|"world" }>` 도 같이 고친다. "모르는 `t` 는 여전히 버린다" 테스트 유지(06-RESEARCH R5).

### Pitfall 3: `ch:"mafia"` 가 누설 검사에 걸림 / 시민 DOM 에 마피아 문구
**What goes wrong:** 검사가 `ROLE_WORDS` 를 막는다. 또 시민 번들·DOM 에 "마피아 채팅 입력" 문자열이 미리 들어 있으면 UI-SPEC 누설 검사(시민 편 DOM 에 "마피아 채팅" 0건)에서 실패.
**How to avoid:** 허용 경로를 "받을 권리 있는 소켓 한정"으로만 확장. 라벨은 `me.chat === "mafia"` 분기 안에서만 만든다(상수는 번들에 있어도 DOM 에 안 나오면 통과이나, 접근성 이름·placeholder 를 분기 밖에서 렌더하지 않는다).

### Pitfall 4: 단계 경계의 경쟁 (밤 → 아침 직전의 마피아 메시지)
**What goes wrong:** 마피아가 밤 끝 직전에 보낸 줄이 아침 직후에 서버에 닿으면, 채널을 지금 상태로 다시 계산하면 `all`(공개)로 샌다.
**How to avoid:** `pk` 대조 → 불일치면 폐기 + `chatReject{"phase"}`. 클라이언트는 입력칸이 비어 있으면 보낸 글을 되돌려 둔다(UI-SPEC 입력 상태표). `webSocketMessage` 는 `advance(Date.now())` 를 먼저 부르므로(`worker/room.ts:200`) 알람이 늦어도 단계가 따라잡힌 뒤 대조된다.

### Pitfall 5: 복원 프레임이 라이브 경로와 다른 규칙을 씀
**What goes wrong:** 재접속 시 `ch` 별로 "내가 볼 수 있는 것"을 다시 계산하면(예: 지금 `role`/`alive` 로) 탈락 직후 사람에게 지난 마피아 줄이 가거나 시민이 아닌 쪽에게 빠지는 등 라이브와 어긋난다.
**How to avoid:** 마스크(보낼 때 결정)로만 복원. 단위 테스트: "라이브로 받은 줄 집합 == 재접속 후 복원 집합(최근 30 제한 내)".

### Pitfall 6: 한글 조합 중 제출·비우기 (잔여 글자 되살아남)
**What goes wrong:** 조합이 끝나기 전에 `value=""` 로 비우면 IME 가 이어서 확정할 때 마지막 글자가 다시 들어간다. **이 세션 실측(시스템 Chrome 헤드리스 + CDP)**: 조합 중 `submit` 핸들러가 `input.value=""` 한 뒤 IME 가 이어서 새 조합/확정을 하면 입력칸에 글자가 다시 나타난다(`compositionstart` 가 새로 시작하고 값 `"안"`). [VERIFIED: 로컬 CDP 실행, 아래 Code Examples]
**How to avoid:** 제출은 `<form onSubmit>` 하나. 조합 중이면 `compositionend` 를 기다린 뒤(최대 100ms) 값을 읽어 보내고, 비운 뒤에도 조합이 이어졌다면 `compositionend` 에서 한 번 더 비운다("보낸 직후 플래그"). 이 보정이 충분한지는 **iPhone 실기기에서만** 확정된다(합격 검사 4).
**Warning signs:** 보낸 뒤 입력칸에 한 글자가 남음; 같은 문장이 두 번 전송됨.

### Pitfall 7: 조합 중 Enter 의 이벤트 순서가 브라우저마다 다르다
Chrome: 조합 중 Enter 의 `keydown` 은 `isComposing=true`, `keyCode=229` 이고 **암묵 제출이 일어나지 않는다**(실측). Safari(WebKit 버그 165004): `compositionend` 가 확정용 Enter `keydown` 보다 **먼저** 와서 그 시점 `isComposing` 이 이미 false 일 수 있다 [CITED: developer.chrome.com/docs/modern-web-guidance/guides/forms/ime-safe-enter-submit]. 그래서 Enter 를 `keydown` 에서 직접 처리하는 구현이 Safari 에서만 조합 확정 Enter 로 한 번 더 제출한다. UI-SPEC 의 form 한 길은 이 문제를 피하지만, "브라우저는 IME 가 소비한 Enter 의 암묵 제출을 막는다"는 보장은 Chrome 문서 문장이고 iOS 는 실기기 확인이 필요하다. **방어선:** 제출 때는 React 상태가 아니라 `input.value`(DOM 의 현재 값)를 읽고, 직전 전송과 같은 문장이 300ms 안에 다시 제출되면(클라이언트) 무시한다 — 서버의 "같은 문장 3초" 규칙이 최종 방어다.

### Pitfall 8: iOS 26.0 의 `visualViewport` 불일치
키보드가 닫힌 뒤에도 `visualViewport.height` 가 `innerHeight` 보다 작게 남고(한 보고자는 24px 차이 측정) `position: fixed; bottom: 0` 요소가 어긋난다. iOS 26.1 베타·공개 베타에서 수정 보고가 있으나 26.0.1 에서 재현했다는 보고도 있다 [CITED: developer.apple.com/forums/thread/800125, WebKit bug 297779]. 단 DTS 는 iPhone 16 Pro Max(iOS 26.0 23A5318c)에서 재현되지 않았다고 했다 — 사용자 기기(iPhone 16 Pro)는 재현 여부가 불확실.
**How to avoid:** `lift` 를 포커스 중에만, 임계값 이상일 때만 적용하고, 블러 시 즉시 0 으로 돌린다. 합격 검사 5(닫을 때 튐 0)를 실기기로 확인한다. `lift` 대신 `innerHeight` 변화로 대체하는 것이 UI-SPEC 「검사 실패 때 내리는 순서」 1단계다.

### Pitfall 9: 네이티브 탭 포커스의 스크롤은 막을 수 없다
`focus({ preventScroll: true })` 는 **프로그램이 부르는** `focus()` 에만 먹는다. 사용자가 입력칸을 탭해 생기는 포커스에는 iOS 가 화면을 위로 미는 동작(`vv.offsetTop > 0`)이 따라온다. UI-SPEC 의 대응(헤더 계열을 `vv.offsetTop` 만큼 내려 보이는 영역 맨 위에 맞춤)이 그래서 필요하다. 이 밀림 자체를 없애려면 입력칸을 탭할 때 `touchstart` 에서 기본 동작을 막고 `focus({preventScroll:true})` 를 직접 부르는 우회가 알려져 있으나 이 세션에서 검증하지 못했다 [ASSUMED] — 합격 검사 1·5 가 실패할 때의 후보로만 둔다.

### Pitfall 10: D4(포커스 중 맵 탭은 키보드만 닫고 걷지 않음) 구현 지점
iOS 와 Android 는 입력칸 바깥의 비포커스 영역을 탭해도 입력칸이 자동으로 블러되지 않는다. 데스크톱은 `mousedown` 에서 먼저 블러한다. `WorldStage` 의 `onTap` 은 `pointerup` 에서 불리므로 **`pointerdown` 시점에 "채팅 입력칸이 포커스였는가"를 기록**하고, `pointerup` 에서 그 값이 참이면 `blur()` 만 하고 걷기 전송을 하지 않는다. 헤더 버튼은 기존대로.

### Pitfall 11: 마스크 비트와 좌석 재사용
로비에서 사람이 나가고 새 사람이 같은 좌석을 받으면, 이전 사람 몫의 비트가 켜진 로비 `all` 줄을 새 사람도 복원으로 받는다. 로비 `all` 줄이라 공개 정보이고 무해하다. 게임 중에는 입장이 없어 좌석 재사용이 없다.

### Pitfall 12: 프레임 크기 한도가 연결을 끊는다
`webSocketMessage` 는 1024바이트 초과 프레임에 `ws.close(1009, "too_large")` — 연결 자체를 닫는다 [VERIFIED: worker/room.ts:180-182]. 입력칸 `maxlength=100`(UTF-16 단위)이면 클라이언트 입력은 문제없다. 우회 클라이언트가 이 한도를 넘기면 연결이 끊기는 건 의도된 방어이나, 서버 길이 거절(`why:"length"`)을 시험하려면 한도 안(1024B 미만)에서 100자보다 긴 문자열이 가능해야 한다(한글 3바이트 × 101자 ≈ 303B). 스키마의 `text` 상한은 UTF-16 길이 약 300 정도로 두고 정확한 판정은 `sanitizeChatText` 가 한다.

### Pitfall 13: 봇 계획의 난수 호출 순서
`bots.ts` 머리말: "난수 호출 순서가 계약이다(시드 테스트가 고정한다)". `claim` 계획을 지우고 discussion/night 의 `say`·`emoji` 를 `chat` 으로 바꾸면 같은 시드의 호출 수가 달라진다. 의도된 변경이므로 기대값을 새 순서로 다시 고정하되, **다른 단계(execVote·candidateVote·defense)의 난수 호출은 그대로**여야 한다.

### Pitfall 14: `D1` 때문에 서버는 받는데 화면이 없는 단계
`execVote`~`candidateVoteReveal`·`execution`·`morning` 에서 서버는 채팅을 받지만 패널이 없어, 이 단계에서 온 줄은 `ChatStore` 에 쌓이되(권리 있는 줄) 보여 주지 않는다. 다음에 패널이 붙는 단계(`night` 마피아/탈락자, 다음 `discussion`)에서 보이는 흐름을 규칙으로 정해야 한다(예: 한 흐름으로 쌓아 두면 단계 사이에 온 줄도 다음 패널에서 보인다). 8·9페이즈가 이 흐름 위에 화면을 붙이므로 "화면 유무와 무관하게 저장소는 받는다"를 단위 테스트로 고정한다.

## Code Examples

> 새 식별자(`audience`, `channelOf`, `phaseKey`, `sanitizeChatText` 등)는 이 문서가 제안하는 이름이다. 기존 코드에서 가져온 값은 위 「와이어의 현재 값」 표의 원문과 같다.

### 채널·수신자 단일 함수 (제안)

```ts
// shared/game/audience.ts — 순수. DOM·workerd API 없음(앱·워커 두 tsconfig 에 들어간다).
import type { PhaseId } from "../protocol";
import { isAlive } from "./alive";
import type { RoomState } from "./room";

export type ChatChannel = "all" | "mafia" | "ghost";
export type AudienceEvent =
  | { k: "chat" | "typing" | "emote"; ch: ChatChannel }
  | { k: "world" };

export const CHAT_PHASES: ReadonlySet<PhaseId> = new Set<PhaseId>([
  "lobby", "dayAnnounce", "discussion", "execVote", "candidateVote", "candidateVoteReveal",
  "defense", "execution", "night", "morning",
]);

/** 단계 한 번(instance)을 가리키는 키. 클라이언트도 같은 함수로 view 에서 만든다. */
export const phaseKey = (s: { phase: PhaseId; day?: number }): string => `${s.day ?? 0}:${s.phase}`;

/** 보낸 사람의 서버 상태로 정한 채널. 말할 수 없으면 null (호출부는 폐기). */
export function channelOf(state: RoomState, senderId: string): ChatChannel | null {
  if (!CHAT_PHASES.has(state.phase)) return null;
  const me = state.players.find((p) => p.id === senderId);
  if (!me) return null;
  if (!isAlive(me)) return "ghost";
  if (state.phase === "night") return me.role === "mafia" ? "mafia" : null;
  return "all";
}

export function audience(state: RoomState, ev: AudienceEvent): ReadonlySet<string> {
  const pick = (pred: (p: RoomState["players"][number]) => boolean) => new Set(state.players.filter(pred).map((p) => p.id));
  if (ev.k === "world") return state.phase === "lobby" ? pick(() => true) : new Set();
  if (!CHAT_PHASES.has(state.phase)) return new Set();
  switch (ev.ch) {
    case "all":   return pick(() => true);
    case "mafia": return state.phase === "night" ? pick((p) => !isAlive(p) || p.role === "mafia") : new Set();
    case "ghost": return pick((p) => !isAlive(p));
  }
}
```

### 제한 규칙 상수와 정리 (제안, D5 값)

```ts
// shared/game/chatRules.ts — D5 값을 상수 한 곳에. 단위 테스트는 now 를 주입한다.
import { countGraphemes } from "../nickname";

export const CHAT_MAX_GRAPHEMES = 100;      // D5: 공백 정리 뒤 1~100자
export const CHAT_MIN_GAP_MS = 600;         // D5: 같은 사람 최소 전송 간격
export const CHAT_BURST_WINDOW_MS = 5_000;  // D5: 5초에
export const CHAT_BURST_MAX = 5;            //     5줄 초과 거절
export const CHAT_REPEAT_MS = 3_000;        // D5: 같은 문장 3초 안에 다시 보내기 거절
export const TYPING_MIN_GAP_MS = 1_500;     // UI-SPEC: 한 사람당 1.5초에 한 번 이상의 신호 무시

export type ChatRejectWhy = "rate" | "repeat" | "length" | "phase" | "other"; // UI-SPEC 오류표의 5문구

// 제어(Cc)·줄(Zl)·문단(Zp) 구분과, 이모지를 잇는 ZWJ(U+200D) 를 뺀 서식(Cf) 문자를 공백으로 바꾼다.
// 방향 제어(U+202E 등)·영폭 공백으로 줄을 위장하는 것을 막는 기준은 shared/nickname.ts 의 FORBIDDEN 과 같다.
const BAD = /[\p{Cc}\p{Zl}\p{Zp}]|(?!\u200D)\p{Cf}/gu;

export function sanitizeChatText(raw: string): { ok: true; text: string } | { ok: false; why: ChatRejectWhy } {
  // 스키마가 UTF-16 길이 상한을 이미 걸었다. 그래서 Intl.Segmenter 비용도 그 상한 안에 묶인다.
  const text = raw.normalize("NFC").replace(BAD, " ").replace(/\p{Zs}+/gu, " ").trim();
  if (text.length === 0 || !/[\p{L}\p{N}\p{S}\p{P}]/u.test(text)) return { ok: false, why: "other" };
  if (countGraphemes(text) > CHAT_MAX_GRAPHEMES) return { ok: false, why: "length" };
  return { ok: true, text };
}
```

(탭·줄바꿈 같은 `Cc` 는 공백으로 바꿔 한 줄로 만든다 — UI-SPEC 「여러 줄 입력·붙여넣기 줄바꿈은 공백으로」. 정규식은 Node 에서 탭·U+202E·영폭 공백(U+200B)이 공백으로 바뀌고 ZWJ 가족 이모지는 보존됨을 이 세션에서 실행해 확인했다 [VERIFIED: 로컬 node 실행]. 단위 테스트가 같은 표를 고정한다.)

### 와이어 계약 (제안)

```ts
// shared/protocol.ts 추가분 — 키 이름에 id·role·playerId 를 쓰지 않는다(leak.test.ts:45 FORBIDDEN_KEYS)
export type ChatChannel = "all" | "mafia" | "ghost";
export interface ChatLineWire { ch: ChatChannel; seat: number; seq: number; text: string; at: number }

// ClientMessage
  | { t: "chat"; text: string; pk: string }            // 채널 필드 없음
  | { t: "typing"; on: boolean; pk: string }
// ServerMessage
  | ({ t: "chat" } & ChatLineWire)
  | { t: "typing"; seat: number; on: boolean }
  | { t: "chatLog"; lines: ChatLineWire[] }            // hello 직후 한 번(비어 있어도 보낸다)
  | { t: "chatReject"; why: "rate" | "repeat" | "length" | "phase" | "other" }
// MyInfo (본인에게만, 말할 수 없으면 키가 없다)
  chat?: ChatChannel;

// shared/schemas.ts
z.strictObject({ t: z.literal("chat"), text: z.string().max(300), pk: z.string().max(32) }),
z.strictObject({ t: z.literal("typing"), on: z.boolean(), pk: z.string().max(32) }),
```

`chatLog` 를 비어 있어도 보내는 이유: 클라이언트가 "복원 끝"을 명시적으로 알고 기록 칸 로딩 상태를 끝낼 수 있다. 프레임 순서는 `[state, (로비) world.snap, chatLog]` 라 기존 `test/worker/world.test.ts` 의 `frames.slice(0,2)` 단언은 그대로 통과한다 [VERIFIED: test/worker/world.test.ts:46-58].

### 전송 길 하나 (제안)

```ts
// worker/room.ts
private deliver(ids: ReadonlySet<string>, msg: ServerMessage): void {
  for (const ws of this.ctx.getWebSockets()) {
    const att = ws.deserializeAttachment() as SocketAttachment | null;
    if (att && ids.has(att.playerId)) this.sendTo(ws, msg);
  }
}
// emitWorld(frame) → this.deliver(audience(room, { k: "world" }), frame)  (로비가 아니면 빈 집합 = 기존과 같다)
```

### 한글 조합 CDP 재현 (이 세션에서 실행해 확인)

```js
// scripts/e2e 에 둘 IME 시나리오의 뼈대. 시스템 Chrome 헤드리스 + playwright-core 에서 동작함을 확인했다.
const cdp = await page.context().newCDPSession(page);          // scripts/e2e/browser.mjs:1130 에 같은 방식이 이미 있다
await cdp.send("Input.imeSetComposition", { text: "ㅇ", selectionStart: 1, selectionEnd: 1 });
await cdp.send("Input.imeSetComposition", { text: "아", selectionStart: 1, selectionEnd: 1 });
await cdp.send("Input.imeSetComposition", { text: "안", selectionStart: 1, selectionEnd: 1 });
await cdp.send("Input.insertText", { text: "안" });             // 확정
await cdp.send("Input.imeSetComposition", { text: "녀", selectionStart: 1, selectionEnd: 1 });
await cdp.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 229 });
```

실행 결과(발췌): `composition*`·`input` 이벤트가 순서대로 발생, 확정 Enter 의 `keydown Enter isComposing=true kc=229`, **`submit` 이벤트 없음**, 입력값 `"안녀"`. 조합 중 `form` 의 보내기 버튼을 `click()` 하면 `submit` 이 발생해 `value="아"`(조합 중 글자 포함)를 읽고, 핸들러가 `input.value=""` 한 뒤 IME 가 이어서 확정하면 값이 `"안"` 으로 되살아났다. [VERIFIED: 이 세션 로컬 실행, 시스템 Chrome 헤드리스]

### 누설 검사 확장 뼈대 (제안, 기존 `helpers.ts` 도우미 사용)

```ts
// test/worker/chatLeak.test.ts — mark/settle 로 "오지 않았음"을 증명하는 기존 방식
const before = citizens.map((c) => mark(c.sock));
send(mafiaA.sock, { t: "chat", text: "오늘밤 철수", pk });          // 밤
send(mafiaA.sock, { t: "typing", on: true, pk });
for (let i = 0; i < citizens.length; i += 1) {
  const got = await settle(citizens[i]!.sock, before[i]!);          // helpers.ts:262
  expect(got.filter((m) => m.t === "chat" || m.t === "typing" || m.t === "chatLog")).toEqual([]);
}
// 마피아가 가만히 있을 때와 움직일 때 시민 프레임 열이 같다: 두 구간 summary() 를 비교
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Android Chrome: 키보드가 레이아웃 뷰포트도 줄임 | 108 부터 기본 `resizes-visual` (Safari/iOS Chrome 과 같음) | Chrome 108 (2022-10) | 같은 `visualViewport` 코드가 iOS·Android Chrome 에서 통한다 [CITED: developer.chrome.com/blog/viewport-resize-behavior] |
| iOS: 레이아웃 뷰포트 불변, 비주얼 뷰포트만 축소 | 동일하나 iOS 26.0 에서 닫힌 뒤 높이가 안 돌아오는 버그 보고 | iOS 26.0 (2025) | `lift` 는 포커스 게이트 + 즉시 0 복귀(Pitfall 8) |
| 카카오톡 인앱·삼성 인터넷 | 이 세션에서 공식 문서를 찾지 못함. 삼성 인터넷은 caniuse 에서 `interactive-widget=resizes-visual` 21~30 지원, 20 이하 미지원으로 요약됨 | — | 실기기 미확인으로 기록·이월 [ASSUMED] |
| v1.0 템플릿 채팅 + 합산 2초 쿨다운 | 자유 텍스트 + D5 4규칙 | 7페이즈 | 클라이언트 잠금(`useSendLock`)이 사라지고 서버 판정만 남음 |

**Deprecated/outdated (이 코드베이스 안):**
- `ChatEvent`/`ChatLine`(템플릿 기반) — 새 `ChatLineWire` 로 대체.
- 결정 0017-7·0016-7·0019-1 의 "저장하지 않는다" — 0058 로 개정(채팅은 방 수명 동안 서버 보관).
- `DISCUSSION_MS` 주석의 "자유 채팅 없이 … 짧게" — 의미가 사라진다. 값 자체는 Open Question 3.

## Assumptions Log

> 이 표의 항목은 검증되지 않았다. 계획은 `checkpoint:human-verify` 또는 사용자 확인 뒤 잠근다.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `DISCUSSION_MS` 는 7페이즈에서 40초 그대로 두고 90초는 8페이즈(DAY-07)에서 바꾼다 | Open Questions 3 | 자유 채팅 낮 토론이 40초로 너무 짧아 7페이즈 UAT 에서 불만 |
| A2 | 복원은 **채널별 최근 30줄**(최대 90줄)로 한다. UI-SPEC D2 문구는 "최근 30줄" | Pattern 2 | 한 흐름 전체 30줄로 해석하면 마피아 밤에 낮 줄이 30줄을 다 채워 기록이 비어 보임 — 또는 반대로 90줄이 과하다는 지적 |
| A3 | 새로 탈락한 사람에게 탈락 이전의 마피아 줄은 복원하지 않는다(결정 0021-2 유지) | Pattern 2 | 사용자가 "유령이 되면 지난 마피아 채팅도 보여야 관전 재미"를 원하면 마스크 정책을 바꿔야 함 |
| A4 | 보관 상한 `all` 100 / `mafia` 300 / `ghost` 300 줄 | Pattern 2 | 너무 작으면 11페이즈 공개가 잘림, 너무 크면 쓰기·복원 비용 |
| A5 | `CHAT_PHASES` 에 `dayAnnounce` 포함, `assigning`·`roleReveal`·`ended` 제외 | Pattern 1 | 포함/제외 판단이 틀리면 UX 틈(2초짜리 단계라 영향 작음) |
| A6 | HTML `maxlength` 는 UTF-16 코드 단위를 센다(이모지 1개 = 2) | Pitfall 12 | 클라이언트 입력 제한과 서버 자소 100 사이 차이는 이모지에서만 생기고 서버가 최종 판정 |
| A7 | `enterkeyhint="send"` 가 iOS 13.4+·Android Chrome 에서 보내기 키 모양을 바꾼다 | UI-SPEC 입력칸 속성 | 키 모양만 다를 뿐 동작은 form 제출이라 영향 작음 |
| A8 | 카카오톡 인앱(iOS/Android)·삼성 인터넷의 `visualViewport` 동작은 공식 문서를 못 찾았다 | State of the Art | 실기기 확인 전까지 성공 기준 3 중 해당 환경은 "미확인"으로 기록(합격으로 세지 않음) |
| A9 | 조합 중 `value=""` 후 글자 되살아남이 실제 iOS 에서도 같다 | Pitfall 6 | Chromium CDP 합성 이벤트로만 확인. iOS 는 다른 방식일 수 있어 보정이 불필요하거나 불충분할 수 있음 → 합격 검사 4 |
| A10 | `ctx.storage.delete(keys[])` 가 키 128개 상한이 있어 묶음 삭제를 128개 단위로 나눠야 한다 | 상한 정리·`testReset` | 상한이 다르면 단순해질 뿐. 실행 때 오류가 나면 바로 드러남 |
| A11 | 네이티브 탭 포커스의 iOS 스크롤은 `touchstart` 기본 동작 취소 + `focus({preventScroll:true})` 로 피할 수 있다 | Pitfall 9 | 실기기에서 안 먹으면 UI-SPEC 의 헤더 오프셋 대응만으로 간다 |
| A12 | 서버 `chatReject{"phase"}` 뒤에 그 소켓에만 최신 `state` 를 한 번 보낸다 | Pattern 3 | 보내지 않아도 기능은 동작하나 낡은 화면이 오래 갈 수 있음 |
| A13 | 봇은 로비에서 채팅하지 않는다(계획이 `phaseEndsAt === null` 이면 비어 있음). 채팅 부하 하의 fps 확인은 별도 소켓 스크립트(`scripts/bots.mjs` 확장)로 한다 | Validation | 로비 채팅 부하 시나리오가 없으면 UI-SPEC 의 "채팅 부하 하 5분 평균 55fps" 확인 항목을 못 채움 |

## Open Questions (RESOLVED)

> 2026-11-01 사용자 결정으로 다섯 질문이 모두 닫혔다. 각 질문 끝의 RESOLVED 줄이 결론이고, 계획(07-*-PLAN.md)은 이 결론대로 짰다.

1. **복원 범위: 채널별 30줄 vs 전체 30줄 (D2 해석)**
   - 아는 것: UI-SPEC D2 는 "내가 볼 수 있는 최근 30줄". 화면은 채널 구분 없이 한 흐름 100줄을 든다.
   - 불확실: 마피아가 밤에 새로 고침하면 표시 흐름은 마피아 줄만 보이는데 전체 30줄이 낮 줄로 채워질 수 있다.
   - 권고: 채널별 30줄(최대 90). 한 줄 바꾸면 전체 30으로 되돌릴 수 있다(상수 한 곳). 계획 단계에서 사용자에게 한 번 확인.
   - RESOLVED: 사용자 결정 1 (2026-11-01) — 채널별 최근 30줄(all·mafia·ghost, 최대 90줄), 상수 하나(`CHAT_REPLAY_PER_CHANNEL = 30`). 결정 0058-3.

2. **새 탈락자가 탈락 이전의 마피아 채팅을 복원받는가**
   - 아는 것: 결정 0021-2 는 "탈락 시점부터"; UI-SPEC 은 탈락자가 마피아 줄을 읽는다고만 적음. 11페이즈에서 판 종료 시 전부 공개.
   - 권고: 마스크 방식(받지 않음)으로 시작. 바꾸려면 0058 에 명시.
   - RESOLVED: 사용자 결정 2 (2026-11-01) — 새로 탈락한 사람은 탈락 이전의 마피아 줄을 받지 않는다(결정 0021-2 유지). 복원은 보낼 때의 수신자 마스크로만 한다. 결정 0058-2.

3. **`DISCUSSION_MS` (40초) 를 7페이즈에서 늘릴까**
   - 아는 것: 8페이즈 DAY-07 이 토론 90초를 정한다. 7페이즈는 v1.0 단계 흐름 위에 입력줄만 붙인다.
   - 권고: 7페이즈에서는 그대로 두고 주석만 고친다. 늘리면 `bots`·`alarm`·`nyquist` 테스트 시간 상수가 연쇄로 바뀐다.
   - RESOLVED: 사용자 결정 3 (2026-11-01) — `DISCUSSION_MS` 는 7페이즈에서 40초 그대로 두고 주석만 고친다. 90초는 8페이즈 DAY-07.

4. **성공 기준 3 의 Android·삼성 인터넷·카톡 실기기**
   - 아는 것: 확인된 기기는 iPhone 16 Pro 뿐(결정 0055). UI-SPEC 은 미확인을 합격으로 세지 않고 이월을 허용한다.
   - 권고: 검증 단계에서 사용자에게 이월 여부를 묻는다(HANDOFF 에 이미 적힘). 계획은 이월 항목을 `07-VERIFICATION` 의 표로 남기는 작업을 넣는다.
   - RESOLVED: 사용자 결정 5 (2026-11-01) — Android Chrome·삼성 인터넷·카카오톡 인앱 실기기는 합격으로 세지 않고 9페이즈 팀 테스트 이월 후보로 기록한다. 이월 여부는 검증 때 사용자에게 묻는다. iPhone 확인은 사람 작업이고 서버 작업을 막지 않는다(사용자 결정 6).

5. **결정 0058 의 범위**
   - 아는 것: 0017-7 개정이 필요(D2). 0016-7, 0019-1, 0020 의 "밤 줄은 저장하지 않는다", 0023-5 도 같은 문장을 갖는다.
   - 권고: 0058 한 장이 위 네 곳을 한 번에 개정하고, 각 옛 결정에 폐기 표시(기존 `0016-7` 이 `(… 결정 0017-7 로 폐기했다)` 로 표시한 방식)를 덧붙인다. 보관 대상·수신자 마스크·상한·삭제 시점·END-03 연결을 적는다.
   - RESOLVED: 사용자 결정 4 (2026-11-01) — 결정 0058 을 웨이브 1 첫 작업(07-01)으로 먼저 쓰고, 0017-7 을 개정하며 0016-7·0019-1·0020·0023-5 에 폐기·개정 표시를 단다.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | 모든 스크립트·vitest | ✓ | v26.0.0 (`engines >=22.12`) | — |
| 시스템 Chrome | 화면 E2E, CDP IME 재현 | ✓ | `/Applications/Google Chrome.app` | — |
| playwright-core | E2E | ✓ | 1.64.1 | — |
| vitest / tsc / wrangler / vite | 검증 명령 | ✓ | 4.1.12 / 7.0.2 / 4.151.3 / 8.3.5 (`node_modules/.bin`) | — |
| 로컬 `npm run dev` (vite + 로컬 workerd) | `npm run e2e -- --url http://localhost:5173` | 가정 ✓ (HANDOFF 도구 메모) | — | 배포본 `minifia-v2` 로 E2E |
| iPhone 16 Pro (iOS용 Chrome/Safari) | 합격 검사 1~7, IME | ✓ (사용자 기기, 결정 0055) | — | — (필수) |
| Android Chrome / 삼성 인터넷 / 카카오톡 인앱 실기기 | 성공 기준 3 전체 | ✗ 불명 | — | Chromium 가상 키보드 값 주입 + **미확인으로 기록해 9페이즈 팀 테스트로 이월** |
| 인터넷(폰트 CDN 등) | E2E 외부 요청 검사 | 가정 ✓ | — | — |

**Missing dependencies with no fallback:** iPhone 실기기 확인은 사람 작업이라 에이전트가 대신할 수 없다 → `checkpoint:human-verify`(end-of-phase 모드).
**Missing dependencies with fallback:** Android·삼성·카톡 → 이월 기록(합격으로 세지 않음).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.12 (projects: `unit`(node) · `client`(happy-dom 21) · `worker`(workerd, `cloudflareTest`)) + `node --test`(scripts) + playwright-core 1.64.1(E2E, 시스템 Chrome) |
| Config file | `vitest.config.ts` (기존) |
| Quick run command | `npx vitest run test/unit/audience.test.ts test/unit/chatRules.test.ts test/unit/chatLog.test.ts` (변경한 파일만) |
| Full suite command | `npx vitest run && node --test scripts/*.test.mjs scripts/e2e/lib.test.mjs && npx tsc -p tsconfig.app.json --noEmit && npx tsc -p tsconfig.worker.json --noEmit` |
| 기준선 | 139 파일 / 3,733 통과 · 1 건너뜀 · 약 16초; 스크립트 `node --test` 280 통과; 두 `tsc` 통과 (모두 이 세션 실행) |
| 화면 E2E | `npm run dev` 후 `npm run e2e -- --url http://localhost:5173 --only chat` (`scripts/e2e/run.mjs` 가 `--only <시나리오 부분 문자열>` 지원) |

`config.json` 의 `workflow.tdd_mode: true` → 순수 모듈(audience·chatRules·chatLog)은 **테스트 먼저**. `nyquist_validation` 기본 켜짐.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CHAT-01 | 로비·낮 `all` 이 방의 모두에게 가고 내 줄도 서버 방송으로 돌아온다 | worker | `npx vitest run test/worker/chat.test.ts` | ❌ Wave 0 |
| CHAT-01 | `audience` 채널 표 전수(로비/낮 단계 × 산/탈락) | unit | `npx vitest run test/unit/audience.test.ts` | ❌ Wave 0 |
| CHAT-01 | 로비 패널 기록·입력·행동 줄, 낮 토론·변론 패널 | client | `npx vitest run test/client/chatPanel.test.tsx test/client/lobby.test.tsx` | ❌ / ✅ 수정 |
| CHAT-02 | 밤 마피아 채팅·입력 중이 시민 편 소켓에 0건, 마피아가 가만/움직일 때 시민 프레임 열 동일 | worker(누설) | `npx vitest run test/worker/leak.test.ts test/worker/chatLeak.test.ts` | ✅ 확장 / ❌ |
| CHAT-02 | 밤 단계 키 어긋난 메시지는 `all` 로 안 가고 `chatReject{"phase"}` | worker | `npx vitest run test/worker/chat.test.ts -t "단계 어긋남"` | ❌ Wave 0 |
| CHAT-03 | 탈락자 채팅·입력 중이 산 사람 소켓에 0건 | worker(누설) | `npx vitest run test/worker/chatLeak.test.ts` | ❌ Wave 0 |
| CHAT-03 | 재접속 `chatLog` 도 같은 규칙(시민에 마피아·유령 0건, 신규 탈락자에 이전 마피아 줄 0건) | worker | `npx vitest run test/worker/chatReplay.test.ts` | ❌ Wave 0 |
| CHAT-04 | 입력 중 중계 1.5초 무시·끄기 통과·채널별 수신 | worker | `npx vitest run test/worker/chat.test.ts -t "입력 중"` | ❌ Wave 0 |
| CHAT-04 | 수신 4.5초 만료·단계 변경 시 비움·내 화면 즉시 켬 | client | `npx vitest run test/client/chatStore.test.ts` | ❌ Wave 0 |
| CHAT-04 | 이름표 `data-typing`, 알약 22px 를 더한 카메라 가시성 | unit/E2E | `npx vitest run test/unit/camera.test.ts` / `npm run e2e -- --only chat` | ✅ 수정 / ❌ |
| CHAT-05 | 정리·길이(자소)·600ms·5초 5줄·같은 문장 3초 | unit | `npx vitest run test/unit/chatRules.test.ts` | ❌ Wave 0 |
| CHAT-05 | 서버가 막고 보낸 사람에게만 `chatReject` | worker | `npx vitest run test/worker/chat.test.ts -t "거절"` | ❌ Wave 0 |
| CHAT-05 | 한글 조합 중 Enter/보내기: 한 번만 전송, 잔여 글자 없음 | E2E(CDP IME) + 사람(iPhone) | `npm run e2e -- --url http://localhost:5173 --only chat-ime` | ❌ Wave 0 |
| CHAT-05 | 키보드 가림·캔버스 불변·튐 (합격 검사 1~7) | E2E(가상 `visualViewport` 주입) + 사람(실기기) | `npm run e2e -- --only chat-keyboard` + `07-VERIFICATION` 표 | ❌ Wave 0 / 수동 |
| CHAT-06 | `claim` 단계가 없다: `dayAnnounce` → `discussion` | unit | `npx vitest run test/unit/tick.test.ts test/unit/nyquist-02-phase-matrix.test.ts` | ✅ 수정 |
| CHAT-06 | `claim`/`say`/`emoji` 메시지는 스키마가 거부(BAD_MESSAGE) | unit+worker | `npx vitest run test/unit/schemas.test.ts` | ✅ 수정 |
| CHAT-06 | 옛 저장 방(`phase:"claim"`·`claimLog`)이 정규화로 열린다 | unit+worker | `npx vitest run test/unit/gameRoom.test.ts test/worker/alarm.test.ts` | ✅ 수정 |
| CHAT-06 | `broadcastEvent` 부재·삭제 식별자 부재 정적 가드 | unit(정적) | `npx vitest run test/unit/chatStaticGuard.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** 바꾼 파일의 테스트만 + 해당 쪽 `tsc`(앱 또는 워커). 순수 모듈은 1초 안.
- **Per wave merge:** `npx vitest run` (약 16초) + 두 `tsc`.
- **Phase gate:** 위 Full suite + 로컬 E2E `--only chat` + 합격 검사 1~7 사람 표(iPhone) + 채팅 부하 fps 확인(6페이즈 기준 5분 평균 55 이상) 기록 → `/gsd-verify-work` 전.

### Wave 0 Gaps

- [ ] `docs/decisions/0058-v2-chat-retention.md` — 계획 단계에서 쓴다(D2). 0017-7·0016-7·0019-1·0020·0023-5 폐기 표시.
- [ ] **iPhone `?chat-mock=1` 5줄 확인**(6페이즈 이월) — 사용자 작업. 제품 패널을 짓기 전에 `lift` 식과 iOS 26 동작을 먼저 본다. 결과로 「검사 실패 때 내리는 순서」 어느 단계까지 필요한지 알게 된다.
- [ ] `test/unit/audience.test.ts`, `chatRules.test.ts`, `chatLog.test.ts` — 순수 규칙 표.
- [ ] `test/worker/chat.test.ts`, `chatLeak.test.ts`, `chatReplay.test.ts` + `helpers.ts` 에 `chatSend`/`chatsOf(sock)` 도우미, `claim` 을 건너뛰도록 `advanceTo`/`skipThrough` 정리.
- [ ] `test/client/chatStore.test.ts`, `chatPanel.test.tsx`(happy-dom 은 IME 를 재현하지 못한다 — 제출 로직은 `compositionstart/end` 이벤트를 직접 발생시켜 시험하되 실제 IME 는 E2E/사람).
- [ ] `test/unit/chatStaticGuard.test.ts` — `worker/room.ts` 에 `broadcastEvent`·`ws.send(`(sendTo 밖) 없음, 삭제 식별자(`QUICK_TEMPLATES`, `selectClaim`, `EMOJI_IDS`, `TEMPLATE_IDS`) 가 `src shared worker` 에 없음.
- [ ] `scripts/e2e/` 에 `chat-*` 시나리오 3종(로비 채팅·키보드(가상 주입)·IME(CDP)) 과 `PANEL_H` 상수(157 → 로비 `LOG_H+154`, 테이블 `LOG_H+92`) 갱신 + `test/unit/e2eContract.test.ts` 동기화.
- [ ] 채팅 부하 소켓 스크립트(`scripts/bots.mjs` 확장 또는 별도) — 로비에서 사람 소켓처럼 주기적으로 `chat` 을 보낸다(서버 봇은 로비에서 말하지 않는다).
- [ ] 프레임워크 설치: 없음(모두 기존).

## Security Domain

> `security_enforcement` 는 `config.json` 에서 켜져 있고(`security_asvs_level: 1`, `security_block_on: "high"`) 이 페이즈는 정보 누설이 핵심 위협이다.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | 부분 | 신원은 hello 토큰으로 서버가 소켓 첨부 `playerId` 에 묶는다(기존). 채팅 메시지에 seat·id 를 싣지 않는다 — 보낸 사람은 첨부 playerId 로만 정해진다 |
| V3 Session Management | 아니오(기존 토큰 방식 유지) | — |
| V4 Access Control | **예** | `audience()` 가 읽기 권한의 단일 출처. 채널은 서버가 보낸 사람 상태로 결정, 클라이언트 채널 선택 없음 |
| V5 Input Validation | **예** | zod `strictObject`(덧붙은 키 거부) + `sanitizeChatText`(제어·서식 문자 제거, 자소 100자) + 프레임 1024B 한도 |
| V6 Cryptography | 아니오 | 새 암호 사용 없음 |
| V7 Error Handling & Logging | 부분 | 거절은 `chatReject{why}` 한 코드로만, 상대 정보·사람 이름 없음. 서버 로그에 본문을 남기지 않는다(기존 `room alarm failed` 로그 스타일: 토큰 없는 짧은 이름만) |
| V8 Data Protection | 예 | 보관 줄은 방 삭제 시 `deleteAll`, `testReset` 시 삭제. 마스크·`g`·`n` 은 와이어에 안 나감 |
| V11 Business Logic | 예 | 도배 제한(D5), 단계 키 대조, 사람별 입력 중 간격 |
| V13 API / WebSocket | 예 | 알 수 없는 `t` 는 `BAD_MESSAGE`, 소켓당 20메시지/초 기존 한도 유지 |

### Known Threat Patterns for 이 스택 (Cloudflare DO + WebSocket + React)

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 마피아·유령 채팅이 시민 소켓으로 샘 (`broadcastEvent` 잔존, `audience` 우회) | Information Disclosure | 전송 길 `deliver(audience())` 하나 + 정적 가드 테스트 + 누설 검사 확장(a)(b)(d) |
| 단계 경계 경쟁으로 비공개 메시지가 공개 채널로 재분류 | Information Disclosure | `pk` 대조, 어긋나면 폐기(`chatReject{"phase"}`), 재분류 금지 |
| 연번·프레임 수·크기의 틈으로 비공개 활동 추정 (부채널) | Information Disclosure | 채널별 연번, 시민 프레임 열 동일성 테스트, `chat`/`typing` 이 `state` 방송을 만들지 않음 |
| 입력 중 신호가 비공개 채널 활동을 흘림 | Information Disclosure | `typing` 도 같은 `audience`, 다른 채널은 네트워크로 안 감(CHAT-02/04) |
| 재접속 복원이 라이브보다 넓게 보냄 | Information Disclosure | 보낼 때 마스크로 복원(Pitfall 5), 복원 누설 테스트 |
| 채팅 본문 XSS (`<script>`·`javascript:`·이름 위장) | Tampering/Spoofing | React 텍스트 노드·`aria-label` 로만 그림, `innerHTML`·마크다운·링크 변환 없음(UI-SPEC), 서버 정리에서 방향 제어(U+202E) 등 `Cf` 제거 |
| 유니코드로 닉네임/시스템 줄 위장 | Spoofing | `Cc/Zl/Zp/Cf` 제거, 보이는 글자 1자 이상 요구(닉네임 규칙과 같은 기준) |
| 도배·거대 입력으로 DO CPU/쓰기 소진 | Denial of Service | 600ms/5초5줄/같은 문장, 스키마 길이 상한 후 `Intl.Segmenter`, 줄 단위 쓰기 + 상한 정리, 기존 1024B 프레임 한도 |
| 저장소 무한 증가 | Denial of Service | 채널별 보관 상한 + 방 수명(3시간) + `deleteAll` |
| 우회 클라이언트가 `ph`/채널을 위조 | Tampering | 채널 필드가 와이어에 없음. `pk` 는 일치 검사 대상일 뿐 권한을 주지 않음 |
| 거절 이유가 역할을 알려 줌 | Information Disclosure | 시민의 밤 전송은 `"phase"` 와 같은 문구("지금은 보낼 수 없어요") — 마피아 여부를 직접 말하지 않는다(애초에 시민은 밤 패널이 없다) |

## Sources

### Primary (HIGH confidence)
- 이 저장소 코드·문서를 이 세션에서 직접 Read: `worker/room.ts`, `shared/protocol.ts`, `shared/schemas.ts`, `shared/game/{chat,claim,room,night,phases,tick,view,bots,discussion,alive,testTools,endgame}.ts`, `shared/nickname.ts`, `src/net/{useRoomConnection,linkReducer,seatFloats,useSendLock}.ts`, `src/screens/{RoomScreen,Lobby,DayScene}.tsx`, `src/components/{WorldStage,DiscussionControls,Sheet}.tsx`, `src/components/v2/{HeadStack,V2Icon}.tsx`, `src/world/{store,camera}.ts`, `src/debug/chatMock.ts`, `test/worker/{helpers,leak,world}.test.ts`, `vitest.config.ts`, `package.json`, `wrangler.jsonc`, `index.html`, `src/styles/room.css`
- `.planning/phases/07-free-chat/07-UI-SPEC.md` 전문, `.planning/{REQUIREMENTS,ROADMAP,STATE}.md`, `HANDOFF.md`, `docs/decisions/{0017,0019,0021,0044}`, `.planning/phases/06-world-skeleton/{06-RESEARCH R5~R8,06-PERF-RESULTS,06-VALIDATION}.md`, `design/v2.0/design-system/components/{ChatPanel/README.md,bundle.css,index.d.ts}`
- 이 세션 실행: `npx vitest run`(139 파일 3,733 통과), `tsc` 두 개, `node --test scripts/...`, Chrome CDP IME 실험 두 개
- developers.cloudflare.com/durable-objects/platform/limits/ — SQLite 기반 DO "Key and value combined cannot exceed 2 MB", KV 기반 128 KiB
- developer.chrome.com/blog/viewport-resize-behavior — `interactive-widget` 값 세 가지, Chrome 108 기본 `resizes-visual`, Safari/iOS Chrome 은 비주얼 뷰포트만 줄임
- developer.chrome.com/docs/modern-web-guidance/guides/forms/ime-safe-enter-submit — `isComposing`·`keyCode 229`·Safari 의 `compositionend` 순서(WebKit 165004)·"브라우저는 IME 가 소비한 Enter 의 암묵 제출을 막는다"

### Secondary (MEDIUM confidence)
- developer.apple.com/forums/thread/800125 — iOS 26.0 `visualViewport` 복원 버그와 수정 보고, WebKit bug 297779
- bugs.webkit.org/show_bug.cgi?id=237851 — 이벤트 직후 `visualViewport` 값 오류, 지연 뒤 정상(검색 결과 요약)
- caniuse.com 검색 요약 — 삼성 인터넷 `interactive-widget` 지원 범위(21 이상)

### Tertiary (LOW confidence — 검증 필요)
- 카카오톡 인앱 브라우저 키보드 동작: 공식 문서를 못 찾았다(검색 결과에 해당 자료 없음) → A8
- iOS 에서 조합 중 비우기 후 글자 되살아남(A9), `touchstart` 우회(A11)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 새 패키지 없음, 기존 도구를 이 세션에서 실행해 확인
- Architecture(audience·마스크·단계 키·저장): HIGH — 코드 구조·누설 검사 규칙을 직접 읽고 설계, 단 구현 세부(상한 값)는 A4
- 제거 범위: HIGH — grep 으로 전수, 컴파일 오류가 보증
- 키보드·IME: MEDIUM — Chromium 은 실측, iOS/Android/삼성/카톡은 실기기 전 미확인
- Pitfalls: HIGH(서버·누설) / MEDIUM(모바일 브라우저)

**Research date:** 2026-11-01
**Valid until:** 서버·와이어 설계는 코드가 바뀌기 전까지(30일). iOS 키보드 항목은 iOS 26.x 패치에 따라 7일 안에도 달라질 수 있다.
