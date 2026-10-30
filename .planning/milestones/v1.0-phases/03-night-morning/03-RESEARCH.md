# Phase 3: 밤과 아침 - Research

**Researched:** 2026-10-24
**Domain:** 서버 권위(Durable Object) 턴제 파티 게임의 밤 행동·판정·역할별 비공개 뷰, 기존 고정 테이블(DayTable) 위 클라이언트 확장
**Confidence:** HIGH (모든 결론이 이 저장소 코드를 이번 세션에 직접 읽고 얻은 것이다. 새 외부 라이브러리가 없어 외부 문서 조사는 필요하지 않았다. 사용자 확인이 필요한 가정은 `## Assumptions Log` 에 모았다)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**밤 화면**
- **D-01:** 행동 대상은 낮과 같은 **고정 테이블에서 캐릭터를 직접 탭**해 고른다. 2페이즈의 `DayTable`(좌석 좌표·이름표·이모티콘)을 재사용한다(결정 0017, `design/screens/day-v3/SPEC.md`). 목록 방식은 쓰지 않는다.
- **D-02:** 선택 가능한 대상은 **자신을 포함한 모든 생존자**다. 마피아 화면에서는 자신과 동료를 탭할 수 없고(서버도 무효 처리), 같은 대상을 다시 탭하면 무시한다(선택 해제 없음). 의사는 자신을 고를 수 있다(NIGHT-03).
- **D-03:** **마피아에게는 밤에도 동료 표시를 유지한다**(낮의 `allies` 표시 그대로).
- **D-04:** **시민은 밤에 지목 화면 없이 안내 문구만 본다**(의심 표시 없음).
- **D-05 (결정 0018):** 온라인(비대면)을 기준으로 만들되 오프라인에서도 할 수 있는 형태를 목표로 한다. 옆에서 훔쳐보기·캡처 공유 같은 문제는 정책으로 막지 않고 **플레이어 매너**에 맡긴다. 그래서 NIGHT-04·ROADMAP 성공 기준 1은 "밤 화면이 역할별로 달라도 된다"로 정정했다. 서버는 여전히 다른 사람의 역할을 클라이언트로 보내지 않는다(결정 0002) — 마피아 동료 seat 만 마피아에게 간다. 드러날 수밖에 없는 요소가 생기면 나중에 설정(소리 끄기, 화면 가리기 등)으로 확장한다.

**행동 확정·바꾸기**
- **D-06:** 행동은 **마감 전까지 자유롭게 바꿀 수 있다**. 마감 순간의 선택이 적용된다. 일찍 골라도 밤은 30초가 다 지나야 끝난다(NIGHT-05).
- **D-07:** 마피아끼리는 **동료가 현재 고른 대상이 마피아 화면에 보인다**(실시간 합의). 시간이 끝나면 표가 많은 쪽, 같으면 무작위(NIGHT-01).
- **D-08:** 아무도 고르지 않으면 **행동 없음**으로 처리한다(마피아 전원이 지목 없음 → 아침에 "아무 일도 없었습니다").

**경찰 결과**
- **D-09:** 조사 결과는 **밤이 끝날 때(아침 직전)** 경찰 본인에게만 보인다. 고르자마자 보이지 않는다.
- **D-10 (변경):** 조사 결과는 **팝업 없이** 경찰 전용 헤더 [수사 기록] 버튼의 시트 `마피아 수사 기록`에 쌓인다. 밤이 끝나면 버튼에 점과 짧은 알림("수사 기록이 추가됐어요")만 뜬다. 밤과 아침 사이에 추가 시간이 없어 진행이 지연되지 않고 시간 차로 역할이 새지 않는다. 시안 N2·N5·N6.
- **D-11 (변경):** 지난 조사 결과는 [내 역할] 시트가 아니라 **수사 기록 시트**에 일차별로 누적된다(`일차 밤 · 이름 · 마피아/마피아 아님`, 글자만, 도장 없음). 낮 토론 중에도 볼 수 있고 탈락한 경찰도 볼 수 있다. 기록은 본인에게만 간다(결정 0002).

**아침 발표·탈락**
- **D-12:** 아침 5초 화면은 **낮과 같은 테이블 위에 탈락자를 강조**한다(캐릭터 쓰러짐/흐림 + 이름 문구). 아무도 탈락하지 않으면 살아 있는 사람 전원이 보이는 테이블에 "아무 일도 없었습니다".
- **D-13:** 의사가 지켜서 살아난 경우도 **"아무 일도 없었습니다"** 로만 발표한다(의사 존재·구출을 공개하지 않음).
- **D-14:** 탈락한 사람은 **같은 테이블 + "탈락" 표시 띠**를 본다. 메시지는 읽기만 가능하고 남의 역할은 게임이 끝날 때까지 받지 않는다(ELIM-01).
- **D-15:** 탈락자는 테이블에서 **흐림 + 이름표 회색**으로 표시한다. 연결 끊김의 흐림과 구분되도록 탈락은 회색 이름표 표시를 더한다. 탈락자의 직업은 공개하지 않는다(ROADMAP Notes).

**작업 방식**
- **D-16:** 화면이 걸린 부분(밤 화면, 경찰 팝업, 아침 발표, 탈락 화면)은 **코드 전에 Design 캔버스 시안을 먼저 만들고 승인**받는다. 좌석·이름표 겹침은 좌표로 검사한다(사용자 요청, 메모리 `feedback-mockup-before-code`). — (시안은 승인 완료, `03-UI-SPEC.md` approved)

**마피아 밤 채팅·탈락 문구 (결정 0019)**
- **D-17:** 밤에는 **살아 있는 마피아끼리만** 빠른 메시지와 이모티콘을 주고받는다. 서버는 마피아 소켓에만 보내고 다른 플레이어에게는 전달하지 않는다. 서버에 저장하지 않고 밤이 끝나면 비운다. 템플릿은 **밤 전용**("[○○] 지목해요", "동의해요", "다른 사람을 지목해요")이며 자유 텍스트는 없다. 결정 0005 의 "밤·아침·처형 중에는 메시지를 보낼 수 없다"에서 밤의 마피아를 예외로 둔다. 탈락한 마피아는 보낼 수 없다. 시안 N1.
- **D-18:** 아침 탈락 발표 문구는 **여러 개 중 무작위**(서버가 골라 모든 폰이 같은 문구, 같은 판에서 연속 반복 없음, 이름 뒤에 항상 "님이": 서연님이, 지호님이). 8개 초안은 `design/screens/night-v1/SPEC.md`. 의사가 살린 경우는 "아무 일도 없었습니다" 고정. 낮 처형 문구는 4페이즈에서 따로.
- **D-19:** 승인 시안은 `design/screens/night-v1/`(N1~N5·M1·M2·E1, SPEC.md). 낮 화면 `day-v3` 위에 얹은 것이다.

### Claude's Discretion
- 밤 전용 연출의 세부(배경 톤, 전환 애니메이션 길이)는 5페이즈 "분위기와 캐릭터"가 다듬으므로 3페이즈에서는 어두운 배경 + 기존 테이블 수준으로 최소화.
- 서버 단계 표(`PHASE_DEFS`)와 `ON_ENTER` 진입 훅 표에 `night`·`morning` 행을 더하는 구조는 결정 0016을 따른다.

### Deferred Ideas (OUT OF SCOPE)
- 처형·사망 시 직업 공개 여부, 같은 직업 중복 주장 표시(충돌 표시) — 4페이즈(처형과 승패)에서 결정.
- 밤 배경음·효과음·강한 분위기 연출 — 5페이즈(분위기와 캐릭터).
- 두 기종(iPhone Safari·Android Chrome) 실기기 확인 — 6페이즈 플레이테스트.
- 방장이 직업 구성을 조정하는 기능(v2 ROLEX-01).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NIGHT-01 | 밤(30초)에 마피아는 함께 한 명을 지목한다. 의견이 갈리면 표가 많은 쪽, 같으면 무작위 | §3 `resolveNight` 의 마피아 표 집계·동률 추첨(`randInt` 주입), §2 `pick` 메시지·`allyPicks` |
| NIGHT-02 | 경찰은 밤에 한 명을 골라 마피아인지 알아낸다. 결과는 본인 화면에만 | §2 `Player.investigations` → `me.records`(경찰 본인만), §7 점·토스트 |
| NIGHT-03 | 의사는 한 명(자신 포함)을 골라 지킨다. 마피아 지목과 같으면 살아난다 | §3 doctor save 규칙, pick 검증(자신 허용) |
| NIGHT-04 | 밤 화면은 역할에 맞게 구성(마피아 동료·동료 선택, 경찰·의사 대상 선택, 시민 안내) | §2 per-viewer 필드, §8 클라이언트 역할 분기 |
| NIGHT-05 | 행동이 일찍 끝나도 밤은 30초 타이머가 끝날 때까지 이어진다 | §1 `NIGHT_MS`, pick 은 `phaseEndsAt`·알람을 건드리지 않음 |
| NIGHT-06 | 아침(5초)에 지난밤 결과가 모든 화면에 발표된다 | §5 `day.morning`(탈락 seat + 문구 번호), 모든 viewer 동일 |
| ELIM-01 | 탈락자는 투표·밤 행동·메시지를 할 수 없고 탈락 화면과 공개된 진행만 본다 | §6 `isAlive` 검사 4곳, `PublicPlayer.alive`, 탈락자 뷰 규칙 |
| COMM-04 (밤 부분) | 밤에는 살아 있는 마피아끼리만 밤 전용 템플릿·이모티콘, 그 밖은 거부, 아침은 거부 | §4 `senderOf` 확장·마피아 소켓 한정 방송 |
</phase_requirements>

## Summary

3페이즈는 **새 외부 의존성이 없는 순수 확장**이다. 서버는 이미 "단계 표(`PHASE_DEFS`) + 진입 훅 표(`ON_ENTER`) + 플레이어별 뷰(`buildView`) + 소켓별 방송" 구조를 갖췄고, 2페이즈가 `alive?`·`lastSendAt`·`isAlive`·`say/emote` 거부 코드 자리를 미리 비워 뒀다. 이 구조에 (a) `night`·`morning` 두 단계와 `discussion.next` 한 줄 교체, (b) 밤 행동 한 종류의 메시지 `pick`, (c) 아침 진입 훅에서 한 번에 도는 순수 판정 함수 `resolveNight`, (d) 마피아 소켓에만 보내는 밤 채팅 방송, (e) 뷰의 역할별 필드(`me.pick`·`me.allyPicks`·`me.records`)와 공개 필드(`players[].alive`, `day.morning`)를 더하면 서버 쪽은 끝난다.

가장 큰 설계 결정은 두 가지다. **첫째, 난수는 `tick(state, now, randInt)` 의 세 번째 인자로 주입한다.** `startGame`·`assignRoles` 가 이미 같은 방식(서버는 `cryptoRandInt`, 테스트는 `seededRandInt`)이라 일관되고, 동률 추첨·문구 추첨이 모두 순수 함수 안에서 재현 가능해진다. **둘째, 밤 행동 후 state 는 행동한 사람(마피아면 살아 있는 마피아 전원)에게만 보낸다.** 기존 `handleClaim` 처럼 `persistAndBroadcast` 로 모두에게 보내면 "누군가 행동했다"는 프레임 타이밍이 시민에게도 새므로 이 페이즈에서는 쓰면 안 된다.

클라이언트는 `DayScene`/`DayTable` 을 단계 사이 재마운트 없이 확장한다. 반드시 알아야 할 사실 하나: **UI-SPEC 이 "이미 있다"고 적은 `PublicPlayer.alive?` 는 와이어에 없다**(아래 §6, `shared/protocol.ts:109-114` 은 네 키뿐이고 `leak.test.ts:134` 가 정확히 네 키를 단언한다). 새로 더하고 네 곳의 키 목록 단언을 함께 고쳐야 한다.

**Primary recommendation:** 서버 로직을 `shared/game/night.ts` 한 파일의 순수 함수(`pickTarget`·`enterNight`·`enterMorning`/`resolveNight`·`nightRecipientIds`)로 모아 RED 테스트부터 쓰고, `worker/room.ts` 는 얇게 배선(핸들러 1개 + 방송 대상 필터 + `tick(..., cryptoRandInt)`)만 한다. 그 뒤 와이어 계약이 굳으면 클라이언트를 붙인다.

## Project Constraints (from CLAUDE.md)

`/Users/dhkim1522/personal/minifia/CLAUDE.md` 에서 추출한 지시(이 연구는 어느 것도 어기지 않는다):
- 게임 규칙과 판정은 서버(방 Durable Object)가 정한다. 클라이언트는 받은 상태를 보여 주고 행동만 보낸다 (결정 0002).
- 다른 사람의 역할은 서버가 클라이언트로 보내지 않는다. 화면에서 숨기는 것으로 대신하지 않는다.
- 기획·계획은 참여 플레이어의 몰입을 기준으로 한다. 각 페이즈는 자기 구간의 이펙트·액션을 기본형으로 함께 만든다 (결정 0006).
- 새 결정은 `docs/decisions/` 에 다음 번호(**0020**)로 파일을 추가한다 — 권장: 밤 와이어 계약·판정 규칙·`alive` 공개 결정.
- 작업을 마칠 때마다 `HANDOFF.md` 를 갱신하고 push 한다.
- GSD 산출물은 한국어. 코드·명령·파일명·요구사항 ID 는 원문.
- 작은 MVP: 요구사항 밖 기능을 넣지 않는다. 화면 페이즈는 UI-SPEC 먼저(이미 승인됨), 디자인 승인본은 `design/` 사본 기준.
- `config.json`: `tdd_mode: true`(정의된 입출력 로직은 RED 커밋 먼저), `nyquist_validation: true`, `security_enforcement: true`(ASVS level 1), `commit_docs: true`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 밤 행동 검증·저장(`pick`) | API / Backend (Room DO, `shared/game/night.ts`) | — | 권한(역할·생존·대상 유효성)은 서버만 판정(결정 0002). 클라이언트는 낙관적 표시만 |
| 밤 판정(마피아 표 집계·동률·의사·경찰) | API / Backend | — | 난수·역할을 쓰므로 서버 전용. `tick` 훅에서 한 번 |
| 아침 문구 선택(번호) | API / Backend | Browser(문장 생성) | 모든 폰이 같은 문구여야 하므로 서버가 번호를 고르고 문장은 화면이 만든다(낮 메시지와 같은 원칙) |
| 역할별 비공개 뷰(`me.pick/allyPicks/records`) | API / Backend (`buildView`) | — | 누출 방지는 서버가 보내지 않는 것으로만 가능 |
| 마피아 밤 채팅 전달 | API / Backend (`worker/room.ts` 방송 필터) | — | "마피아 소켓에만 보낸다"는 서버 방송 단계의 필터 |
| 단계 전환·타이머 | API / Backend (알람 + `tick`) | Browser(남은 시간 표시) | 이미 확립된 구조. 클라이언트는 `phaseEndsAt` 로 표시만 |
| 대상 탭 선택 UI·링/배지 | Browser (`DayTable`) | — | 순수 표시. 서버 값이 오면 서버 값으로 맞춘다 |
| 수사 기록 "새 기록" 점 | Browser(폰 메모리) | API(기록 목록 제공) | §7: 기록은 서버, "봤는지"는 폰 메모리(권장) |
| 탈락 표시·탈락 화면 | Browser | API(`players[].alive`) | 공개 정보라 서버는 `alive` 만 보내고 화면이 그린다 |
| 배경(밤/낮) | CDN / Static | — | `public/backgrounds/bg_game_night.svg`·`bg_game_day.svg` 이미 존재 |

## Standard Stack

### Core
새 패키지 없음. 아래는 이미 고정된 버전이다 [VERIFIED: /Users/dhkim1522/personal/minifia/package.json — dependencies/devDependencies].

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react / react-dom | 19.3.1 | 클라이언트 | 기존 |
| zod | 4.6.7 | 서버 전용 메시지 검증(`shared/schemas.ts`, Worker 만 import) | 기존. `pick` 도 `strictObject` |
| vitest | 4.1.12 | unit(node) / client(happy-dom) / worker(workerd) 3 프로젝트 | 기존 (`vitest.config.ts`) |
| @cloudflare/vitest-plugin | 1.4.6 | 워커 통합 테스트 | 기존 |
| wrangler | 4.151.3 | Durable Object 개발·배포 | 기존 |
| typescript | 7.0.2 | `npm run typecheck`(앱+워커 두 tsconfig) | 기존 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `tick(state, now, randInt)` 주입 | 상태에 `rngSeed` 를 저장하고 순수 PRNG 로 파생 | 시그니처는 안 바뀌지만 PRNG 를 직접 구현·보관해야 하고, 기존 규칙("난수는 인자로만, `Math.random`·시각 시드 금지")과 결이 다르다. **주입 방식 권장** |
| 밤 행동 state 를 행동자에게만 전송 | `persistAndBroadcast`(전원) | 전원 전송은 구현이 가장 쉽지만 시민도 "누군가 행동함" 타이밍을 본다(§10 누출). **행위자 한정 전송 권장** |
| "새 기록 봤는지"를 폰 메모리(localStorage)에 | 서버 `Player.recordsSeen` + `{t:"seen"}` 메시지 | 서버 방식은 기기 교체에도 유지되지만 메시지·스키마·핸들러·테스트가 하나씩 늘어난다. **폰 메모리 권장**(Open Question 1) |

**Installation:** 없음. `npm ci` 로 충분.

**Version verification:** 새 패키지를 설치하지 않으므로 레지스트리 조회 생략. 위 버전은 `package.json` 에서 읽은 값이다.

## Package Legitimacy Audit

이 페이즈는 외부 패키지를 설치하지 않는다(03-UI-SPEC "새 패키지 없음", `package.json` 에 추가 불필요 — 모든 기능이 기존 의존성과 순수 TS 로 구현됨). 감사 대상 없음.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (없음) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
 ┌────────── 폰(마피아/경찰/의사/시민/탈락자) ──────────┐
 │  DayScene ─ DayTable(탭 → onPick) ─ 하단 NightPanel   │
 │   낙관적 표시(pending)   ▲ state(개인 뷰)  ▲ chat/emoji(마피아만) │
 └───────┬──────────────────┼───────────────┼──────────┘
   {t:"pick",target}        │               │
   {t:"say"/"emoji"}        │               │
         ▼                  │               │
  worker/room.ts  webSocketMessage ── 전 메시지 앞에서 advance(now) (만료/tick 선처리)
         │
         ├─ "pick" ─▶ pickTarget(state, actorId, target)  ── 거부: WRONG_PHASE / BAD_MESSAGE (+ 해당 소켓에만 state 재전송)
         │              성공+변경 ─▶ persist ─▶ 행위자(마피아면 생존 마피아 전원)에게만 개인 뷰 전송
         ├─ "say"/"emoji" ─▶ senderOf: discussion=생존자 전원 | night=생존 마피아만 ─▶ 마피아 소켓에만 chat/emoji 이벤트
         │
         └─ 알람/advance ─▶ tick(state, now, cryptoRandInt)
                              discussion ─▶ night   [ON_ENTER.night = enterNight: 선택·이전 아침 결과 비움]
                              night      ─▶ morning [ON_ENTER.morning = enterMorning(state, randInt):
                                                       resolveNight → alive/records/morning/lastPhrase, 선택 폐기]
                              morning    ─▶ dayAnnounce (일차 +1, 기존 훅)
                              ─▶ persistAndBroadcast(전원 개인 뷰: 같은 morning, 경찰만 records)
```

### Recommended Project Structure
```
shared/
├── protocol.ts            # PhaseId += night|morning, ClientMessage += pick, TemplateId += 밤 3개,
│                          #   PublicPlayer.alive, MyInfo += pick/allyPicks/records, DayView.morning
├── schemas.ts             # pick strictObject
└── game/
    ├── phases.ts          # NIGHT_MS/MORNING_MS, night·morning 행, discussion.next = "night"
    ├── tick.ts            # RandInt 인자, ON_ENTER += night, morning
    ├── night.ts   (신규)   # pickTarget, enterNight, enterMorning, resolveNight, nightChatRecipientIds,
    │                      #   MORNING_PHRASE_COUNT, RandInt 타입
    ├── chat.ts            # senderOf 확장(night=생존 마피아), QUICK_TEMPLATES 에 when 칸
    ├── claim.ts           # selectClaim 에 isAlive 거부
    ├── room.ts            # Player += nightPick/investigations, RoomState += morning/lastPhrase
    └── view.ts            # DAY_PHASES += night·morning, claims 를 night·morning 에도, 역할별 필드
worker/room.ts             # case "pick", 방송 대상 필터, tick(..., cryptoRandInt)
src/
├── components/            # NightPanel, PickPill, MorningCard, RecordsButton, RecordsToast, RecordsSheet (신규)
│                          # DayTable/Figure/Icon/MessageLog/QuickMessageSheet/Timer (확장)
├── game/eliminationText.ts (신규, 문구 8개 상수 표)
├── net/recordsSeen.ts      (신규, 폰 메모리 — session.ts 의 StorageLike 패턴)
└── screens/DayScene.tsx, RoomScreen.tsx (확장)
test/unit/night.test.ts, test/worker/night.test.ts (신규)
scripts/uat-night.mjs (신규), smoke.mjs·uat-day.mjs·bots.mjs (수정)
```

### Pattern 1: 단계 표·진입 훅 추가 (질문 1)

현재 코드 [VERIFIED: shared/protocol.ts:18]:
```ts
export type PhaseId = "lobby" | "assigning" | "roleReveal" | "dayAnnounce" | "claim" | "claimReveal" | "discussion";
```
[VERIFIED: shared/game/phases.ts:32]:
```ts
  discussion: Object.freeze({ durationMs: DISCUSSION_MS, next: "dayAnnounce", revealsOwnRole: true }), // 임시 낮 루프(D-19) — 3페이즈가 밤으로 바꾼다
```
[VERIFIED: shared/game/tick.ts:18-22]:
```ts
const ON_ENTER: Partial<Record<PhaseId, (s: RoomState) => RoomState>> = {
  dayAnnounce: enterDayAnnounce,
  claim: enterClaim,
  claimReveal: enterClaimReveal,
};
```
[VERIFIED: shared/game/view.ts:12]:
```ts
const DAY_PHASES: ReadonlySet<PhaseId> = new Set(["dayAnnounce", "claim", "claimReveal", "discussion"]);
```

바꿀 것 (설계):
```ts
// protocol.ts
export type PhaseId = "lobby" | "assigning" | "roleReveal" | "dayAnnounce" | "claim" | "claimReveal" | "discussion" | "night" | "morning";

// phases.ts
export const NIGHT_MS = 30_000;   // NIGHT-05
export const MORNING_MS = 5_000;  // NIGHT-06
discussion: Object.freeze({ durationMs: DISCUSSION_MS, next: "night", revealsOwnRole: true }),
night:      Object.freeze({ durationMs: NIGHT_MS,      next: "morning", revealsOwnRole: true }),
morning:    Object.freeze({ durationMs: MORNING_MS,    next: "dayAnnounce", revealsOwnRole: true }), // 4페이즈 전 임시 루프

// tick.ts — 훅이 난수를 받는다
export type RandInt = (n: number) => number;
const ON_ENTER: Partial<Record<PhaseId, (s: RoomState, randInt: RandInt) => RoomState>> = {
  dayAnnounce: enterDayAnnounce, claim: enterClaim, claimReveal: enterClaimReveal,
  night: enterNight, morning: enterMorning,
};
export function tick(state: RoomState, now: number, randInt: RandInt = NO_RANDOM): RoomState
```
- `NO_RANDOM = () => { throw new Error("tick: randInt required to enter morning") }` — 기존 테스트(낮만 건드리는 tick 호출)는 그대로 통과하고, 아침 진입이 필요한 호출이 난수를 안 주면 조용히 틀리지 않고 즉시 터진다. 운영 코드(`worker/room.ts:373` `const next = tick(room, now);`)는 반드시 `cryptoRandInt` 를 넘긴다.
- `DAY_PHASES` 에 `night`·`morning` 추가(`view.day` 가 생긴다 — `day.n`, `day.roles`, 아래 `claims`/`morning` 이 모두 여기 매달린다).
- **`PhaseId` 는 와이어 계약이다**(결정 0016-1). `RoomScreen.PHASE_ANNOUNCE: Record<PhaseId, …>` 는 항목이 빠지면 컴파일 에러가 나므로 누락 방지 장치가 된다. 반면 `renderPhase` 의 `switch` 는 default 가 없어 누락해도 컴파일이 안 막을 수 있으니 `night`·`morning` case 를 명시한다.
- 일차 규칙: `day` 는 `dayAnnounce` 진입 훅에서만 증가한다. 따라서 **밤·아침 내내 `view.day.n` 은 N**, 아침 헤더의 `N+1일차` 는 화면이 `n + 1` 로 만든다. 수사 기록의 "N일차 밤" 도 `day.n`.
- 늦은 알람 따라잡기: `tick` 은 새 마감을 `이전 마감 + 다음 단계 길이` 로 연쇄 계산하므로 `discussion → night → morning → dayAnnounce` 를 한 번에 건너도 훅이 각각 한 번씩, 순서대로 돈다. 단, **밤 구간 전체를 건너뛴 따라잡기(아무 메시지도 안 와서 알람이 30초 넘게 늦은 경우)는 행동 없음 = "아무 일도 없었습니다"** 로 처리된다(선택이 없었으니 정상). 실제로는 모든 메시지 처리 앞에 `advance(Date.now())` 가 먼저 돌므로(`worker/room.ts` `webSocketMessage`) 마감 이후 도착한 `pick` 은 먼저 단계를 넘긴 뒤 `WRONG_PHASE` 가 된다 — 마감 뒤 선택이 끼어들 틈이 없다.
- 저장된 방 호환(질문 10): `PhaseId` 새 값은 이 배포 전에 저장된 적이 없고 새 `Player`/`RoomState` 필드는 모두 optional 이라 `normalizeStoredRoom` 변경은 필요 없다. `discussion` 에 있던 방은 다음 마감에 `night` 으로 간다(`enterNight` 가 비울 것이 없어도 안전). 옛 번들을 연 탭이 `night` 뷰를 받으면 `PHASE_ANNOUNCE[view.phase]` 가 `undefined` 라 터지므로 `RoomScreen` 에 `PHASE_ANNOUNCE[view.phase]?.(view) ?? ""` 와 `renderPhase` default 폴백을 두는 것을 권장(방 수명 3시간이라 배포 중 열려 있는 방이 있을 수 있다).

### Pattern 2: 밤 행동 데이터 모델과 pick 메시지 (질문 2)

**저장(서버 내부, 모두 optional):**
```ts
// shared/game/room.ts — Player
nightPick?: number;                       // 이번 밤 내가 고른 대상 seat. 이번 밤에만 의미. enterNight 가 비우고 enterMorning 이 소비 후 지운다.
investigations?: InvestigationRecord[];   // 경찰만. 누적. 뷰에는 경찰 본인에게만 me.records 로.
// RoomState
morning?: { eliminated?: number; phrase?: number };  // 지난밤 결과(아침 뷰의 원천). enterMorning 이 쓰고 enterNight 가 지운다.
lastPhrase?: number;                      // 마지막으로 쓴 탈락 문구 번호(연속 반복 방지). 판 내내 유지.
```
`nightPick` 을 `Player` 에 두는 이유: 2페이즈 `claimChoice` 와 같은 모양(`enterClaim` 이 모두 비우는 패턴)이고 `seat` 로 저장하면 판 중 자리가 안 바뀌어(퇴장은 대기실뿐 — `leaveRoom`/`kickPlayer` 가 `lobby` 만 허용) 안전하다.

**클라이언트 → 서버 (신규 1종):**
```ts
// protocol.ts ClientMessage 에 추가 — 현재는 [VERIFIED: shared/protocol.ts:97-105] 8종
| { t: "pick"; target: number }
// schemas.ts — 2페이즈 변형과 같은 strictObject (알 수 없는 키 거부)
z.strictObject({ t: z.literal("pick"), target: z.number().int().min(0).max(7) }),
```
행동 종류(지목/조사/보호)는 메시지가 아니라 **보낸 사람의 서버 저장 역할**이 정한다. 클라이언트가 행동 종류를 보내게 하지 않는다(위조 불가).

**`pickTarget(state, actorId, target)` 검사 순서(계약, 거부 코드는 §6 참조):**
1. `state.phase !== "night"` → `WRONG_PHASE`
2. 보낸 사람이 방에 없다/탈락(`!isAlive`) → `BAD_MESSAGE`
3. 역할이 `mafia|police|doctor` 가 아니다(시민) → `BAD_MESSAGE`
4. `target` 이 정수이고 앉은 사람이며 생존이 아니면 → `BAD_MESSAGE`
5. 마피아이면 대상이 마피아(자신·동료)이면 → `BAD_MESSAGE` (D-02, UI 는 막아 두지만 서버가 방어선)
6. 같은 값을 다시 고르면 입력 상태를 그대로 돌려준다(`handleClaim` 의 "같은 객체면 저장·전송 없음" 선례)
7. 아니면 그 사람의 `nightPick` 만 바꾼 새 상태

쿨다운은 쓰지 않는다(채팅 `lastSendAt` 과 무관). 연결당 1초 20개 속도 제한(`overRateLimit`)이 이미 폭주를 막는다.

**뷰 필드 (질문 2, 5, 7):** 모두 `허용 목록 리터럴` 방식(`view.ts` 가 `Player` 를 펼쳐 복사하지 않는 기존 규칙)으로 조건을 채울 때만 키를 만든다.
```ts
// protocol.ts
export interface InvestigationRecord { n: number; target: number; isMafia: boolean }
export interface MorningView { eliminated?: number; phrase?: number }   // 1..MORNING_PHRASE_COUNT
interface MyInfo { …; pick?: number; allyPicks?: number[]; records?: InvestigationRecord[] }
interface DayView { …; morning?: MorningView }
interface PublicPlayer { …; alive: boolean }       // §6
```
| 필드 | 누구에게 | 언제 | 값 |
|------|----------|------|----|
| `me.pick` | 본인(행동 역할·생존) | `phase==="night"` 에서 선택이 있을 때만 | 내가 고른 seat |
| `me.allyPicks` | **생존한 마피아**에게만 | `night` 에서 | 생존 동료들이 현재 고른 대상 seat 의 **중복 제거·오름차순 배열**(누가 골랐는지는 보내지 않음 — UI 는 동료 배지를 "한 개"로만 그린다) |
| `me.records` | **경찰 본인**(탈락 후에도) | `revealsOwnRole` 단계 전체 | `Player.investigations` (n 오름차순, 화면이 뒤집어 최신 위) |
| `day.morning` | 모두(같은 값) | `phase==="morning"` 에서만 | `{eliminated?, phrase?}`; 탈락자 없으면 `{}` (키 있음 = "아침 결과가 있고 무사") |
| `day.claims` | 모두 | `claimReveal`·`discussion` **+ `night`·`morning`** | 지금 `buildDay` 는 앞 두 단계에서만 싣는다 [VERIFIED: shared/game/view.ts:25-29]. UI-SPEC C6(밤·아침에도 낮 주장 줄 유지) 때문에 조건을 넓힌다 |
| `players[].alive` | 모두 | 항상 | 공개 정보 |

키 이름 주의(누출 테스트 불변식): `role`·`allies` 는 `view.me` 밖에 있으면 실패하고 `id`·`token` 등은 어디에도 금지다 [VERIFIED: test/worker/leak.test.ts:21 `const FORBIDDEN_KEYS = ["token", "id", "playerId", "connId", "nicknameKey", "joinSeq", "hostId"];`, 같은 파일 `if (key === "role" || key === "allies") expect(path).toBe(`.view.me.${key}`);`]. 위 이름들(`pick`·`allyPicks`·`records`·`isMafia`·`eliminated`·`phrase`·`alive`)은 모두 이 불변식과 충돌하지 않는다. `isMafia` 는 boolean 이라 `view.test.ts` 의 `ROLE_LIKE_VALUES` 문자열 검사에도 걸리지 않는다. **경찰의 `records[].isMafia` 가 이 페이즈에서 허용되는 유일한 "남의 역할 관련 정보"이며 불리언 한 비트뿐이다**(역할 문자열 아님).

### Pattern 3: 밤 판정 `resolveNight` (질문 3)

`enterMorning(state, randInt)` 가 `morning` 진입 훅이다. 판정 자체는 입력(상태, `randInt`)→출력(결과)의 순수 함수로 분리해 RED 테스트부터 쓴다.

**규칙표 (확정 권장 — 대부분 CONTEXT 에서 파생, 마지막 두 행만 가정 A1·A2):**

| 상황 | 결과 |
|------|------|
| 마피아가 아무도 고르지 않음(전원 `nightPick` 없음) | 지목 없음 → 탈락 없음 (D-08) |
| 마피아 일부만 고름 | **고른 사람들의 표만** 집계 (예: 2명 중 1명만 고르면 그 대상이 지목) |
| 표가 가장 많은 대상이 하나 | 그 대상 |
| 최다 득표가 동률 | 동률 seat 를 **오름차순 정렬**해 `tied[randInt(tied.length)]` |
| 지목 대상이 탈락자·마피아(무효 선택이 어떻게든 저장됨) | 집계에서 제외(방어적 재검증) |
| 의사 보호 대상 == 최종 지목 대상 | 탈락 없음 (구출은 비공개, D-13) |
| 의사 자기 보호 | 허용(대상이 자신) — 지목이 의사 본인이면 살아남음 |
| 의사/경찰이 고르지 않음 | 해당 행동 없음 |
| 경찰 조사 | 대상이 `role==="mafia"` 인지 `isMafia` 불리언을 경찰의 `investigations` 에 `{n: day, target, isMafia}` 로 추가. 자기 조사 가능(`false`) |
| 경찰·의사가 같은 밤에 마피아에게 지목됨 | **동시 해결**: 조사·보호 효과는 그대로 적용(순서 의존 없음) — 가정 A1 |
| 탈락 처리 | 대상 `alive=false`. 직업 비공개(`morning` 에 역할 없음) |

**난수 순서(재현성 계약):** 같은 시드가 같은 결과를 내도록 `randInt` 호출은 (1) 동률일 때만 1회 `randInt(tied.length)`, (2) 탈락자가 있을 때만 1회 문구 `randInt(candidates.length)` 순서이고, **필요 없으면 호출하지 않는다**(`cryptoRandInt(0)` 은 `RangeError` — [VERIFIED: worker/random.ts] `n must be an integer in 1..2^32`). 동률 목록이 1개이거나 후보 문구가 0개인 경로는 호출 자체를 하지 않는다.

**문구 선택(질문 5):** `MORNING_PHRASE_COUNT = 8`(shared, 서버가 번호를 고르려면 개수가 필요). 후보 = `1..8` 에서 `state.lastPhrase` 를 뺀 목록(첫 탈락이면 8개, 이후 7개) → `candidates[randInt(candidates.length)]`, 그 뒤 `lastPhrase = phrase`. "연속 반복 없음"은 *직전에 쓴 문구와 같지 않음*으로 구현(탈락 없는 밤을 사이에 두어도 `lastPhrase` 는 유지). 문장 표는 클라이언트 `src/game/eliminationText.ts` 한 곳, 서버는 번호만. 두 곳의 개수가 어긋나지 않게 클라이언트 단위 테스트가 `PHRASES.length === MORNING_PHRASE_COUNT` 를 단언한다.

**결과 쓰기(`enterMorning`):** 한 번의 새 상태로 — 탈락자 `alive=false`, 경찰 `investigations` 추가, `morning = { eliminated?, phrase? }`(키 없는 객체 = 무사), `lastPhrase`, **모든 플레이어의 `nightPick` 삭제**. 선택을 아침 시작에 지우면 재접속해도 아침 뷰에 선택 흔적이 나올 수 없고 UI-SPEC "아침 시작에 링·배지 소멸"과도 일치한다.

**테스트 가능성:** `randInt` 를 `(n) => 0`, `(n) => n - 1`, `seededRandInt(seed)` 로 바꿔 끼운다(`test/helpers/seededRandom.ts` 가 이미 있다 [VERIFIED: 이 세션에 읽음, mulberry32 구현]). 속성 테스트: 시드 1..200 에서 (a) 동률 결과는 항상 동률 집합의 원소이고 두 값이 모두 한 번 이상 나온다, (b) 연속 두 번 탈락의 문구 번호가 같지 않다.

### Pattern 4: 마피아 밤 채팅 (질문 4)

현재 방송은 앉은 모든 소켓에 보낸다 [VERIFIED: worker/room.ts:472-480 `private broadcastEvent(msg: ServerMessage): void { … for (const ws of this.ctx.getWebSockets()) { … if (!att || !room.players.some((p) => p.id === att.playerId)) continue; this.sendTo(ws, msg);`]. 보낸 사람 검사는 [VERIFIED: shared/game/chat.ts:36-41]:
```ts
function senderOf(state: RoomState, actorId: string): ChatError | Player {
  if (state.phase !== "discussion") return "WRONG_PHASE";
  const sender = state.players.find((p) => p.id === actorId);
  if (!sender || !isAlive(sender)) return "BAD_MESSAGE";
  return sender;
}
```
설계:
1. `senderOf` 를 단계별 규칙으로: `discussion` = 생존자 누구나, `night` = **생존한 마피아만**, 그 밖의 단계 = `WRONG_PHASE`(아침 포함). 밤에 보낸 사람이 탈락자면 `BAD_MESSAGE`(ELIM-01), 생존 비마피아면 `WRONG_PHASE`(그 단계에서는 보낼 수 없는 사람 — 어느 쪽이든 자기 역할 외의 정보를 주지 않는다).
2. `QUICK_TEMPLATES` 에 `when: "day" | "night"` 칸을 더한다. 템플릿 ID 는 `TEMPLATE_IDS` 에 밤 3개를 더한다(예: `nightPick`·`nightAgree`·`nightOther`, 이름은 계획 재량). `say` 는 *현재 단계의 종류와 템플릿의 `when` 이 같을 때만* 통과(낮 문구를 밤에, 밤 문구를 낮에 보내면 `BAD_MESSAGE`). `z.enum(TEMPLATE_IDS)` 스키마는 자동으로 따라온다. 대상 칸 규칙은 기존 `target`/`role` 표 그대로(밤 `지목해요` 는 `target` 필요, 다른 둘은 없음; 직업 칸 없음). 기존 대상 검사(본인 아님·생존)를 그대로 쓴다 — 동료도 대상으로 허용(UI-SPEC "나를 뺀 생존자(동료 포함)").
3. 쿨다운은 `lastSendAt`·`SERVER_MIN_SEND_GAP_MS` 를 그대로 재사용한다(낮·밤 합산, 별도 코드 없음).
4. 방송 필터: 새 `broadcastEventTo(msg, recipientIds: ReadonlySet<string>)`. 밤 `say`/`emoji` 는 `recipients = 생존한 마피아 id 집합`(보낸 사람 포함 — 낮과 같이 자기 에코로 로그가 만들어진다). 낮은 기존 `broadcastEvent`. `ctx.getWebSockets(tag)` 는 쓰지 않는다(태그는 `acceptWebSocket` 시점에 정해지는데 그때는 역할이 소켓에 안 붙어 있다 — hello 뒤에야 신원이 정해진다) → 기존처럼 첨부(`playerId`)로 걸러낸다.
5. "서버에 저장하지 않고 밤이 끝나면 비운다": 서버가 저장하는 것은 이미 낮에도 저장하던 `lastSendAt`·`nextMessageSeq` 뿐이고 메시지 내용은 저장하지 않으므로 서버 쪽에서 "비울 것"이 없다. 비우는 일은 **클라이언트 훅**이 한다(단계가 `night` 를 벗어나면 줄 비움). 워커 테스트로 `storedRoom` 에 메시지 내용이 없음을 확인한다.

클라이언트 훅 주의: 기존 `useDayChat` 는 일차(`day.n`)가 바뀔 때만 비우고 `discussion` 중에만 받는다 [VERIFIED: src/net/seatFloats.ts `inDiscussionRef`, `useDayChat`]. 밤은 같은 `day.n` 이라 그대로 두면 낮 줄과 섞인다. **채팅 훅을 "수집 단계(discussion | night)"를 인자로 받는 하나로 일반화**하고, 단계가 바뀌면 비우는 규칙으로 바꾼다. `useSeatFloats` 의 `inDiscussion` 게이트도 같은 방식으로 `night`(마피아)를 허용한다. `seq` 는 방 수명 동안 단조 증가(`nextMessageSeq`)이므로 `maxSeq` 중복 제거가 그대로 동작한다.

### Pattern 5: 탈락 처리 (질문 6)

[VERIFIED: shared/game/room.ts:26-27] `/** 3페이즈가 탈락 때 false 로 만든다. 없으면 생존으로 본다. */ alive?: boolean;` — `enterMorning` 이 `alive: false` 를 쓴다. `isAlive`(`shared/game/alive.ts`)는 구조적 최소 타입이라 서버 `Player` 와 뷰 `PublicPlayer` 모두 받는다.

| 곳 | 현재 | 3페이즈 결정 |
|----|------|--------------|
| `say`/`emote` (`senderOf`) | 탈락자 `BAD_MESSAGE` (이미 구현) | 그대로 확정(A4 확정). 문서(결정 0016 결과·`chat.ts` 주석 "3페이즈가 확정")만 갱신 |
| `selectClaim` | 탈락 검사 없음 [VERIFIED: shared/game/claim.ts 주석 "탈락자 거부는 3페이즈(ELIM-01)가 이 함수에 isAlive 검사를 더한다"] | `actor` 찾은 직후 `!isAlive(actor)` → `BAD_MESSAGE`. `claim` 단계 밖이면 여전히 `WRONG_PHASE` 가 먼저 |
| `pickTarget` | 신규 | 탈락 → `BAD_MESSAGE` |
| 밤 채팅 수신 | 신규 | 방송 대상 = 생존 마피아만(탈락 마피아는 안 받음) |
| `QuickMessageSheet` 대상 칩 | 이미 `isAlive(p)` 로 거름 [VERIFIED: src/components/QuickMessageSheet.tsx:38] | `PublicPlayer.alive` 가 와이어에 실리면 자동으로 동작 (지금은 항상 생존으로 읽힘) |

**`PublicPlayer.alive` 는 새로 더해야 한다.** [VERIFIED: shared/protocol.ts:109-114]
```ts
export interface PublicPlayer {
  seat: number;
  nickname: string;
  connected: boolean;
  isHost: boolean;
}
```
`grep -rn "alive" src shared worker` 결과 클라이언트가 `.alive` 를 읽는 곳은 `QuickMessageSheet`(`isAlive(p)`) 뿐이고, 와이어에는 키가 없다. 권장: 타입은 `alive?: boolean` 으로(기존 픽스처 호환), **서버는 항상 `alive: boolean` 을 실어** 키 집합을 모든 플레이어에서 균일하게 한다. 이 때문에 키 목록을 정확히 비교하는 아래 4곳을 같은 커밋에서 고친다:
- [VERIFIED: test/worker/leak.test.ts:134] `expect(Object.keys(pl).sort()).toEqual(["connected", "isHost", "nickname", "seat"]);`
- [VERIFIED: test/worker/http.test.ts:116] `expect(Object.keys(msg.view.players[0]!).sort()).toEqual(["connected", "isHost", "nickname", "seat"]);`
- [VERIFIED: test/unit/gameRoom.test.ts:455] `expect(Object.keys(view.players[0]!).sort()).toEqual(["connected", "isHost", "nickname", "seat"]);`
- [VERIFIED: scripts/smoke.mjs:23] `const ALLOWED_PLAYER_KEYS = ["connected", "isHost", "nickname", "seat"];` (사용처: stageCreate `players[0]` 키 집합 검사 ~180행, stageFull 각 state 프레임 ~496행)

탈락자 뷰(ELIM-01): 서버는 *공개된 진행*만 보낸다 — 탈락자에게도 `me.role`(본인 정보)·마피아면 `me.allies` 는 그대로 가지만 `me.pick`·`me.allyPicks`·밤 채팅은 오지 않는다. 남의 역할은 어느 쪽도 오지 않는다. 탈락자의 마지막 주장(`claimShown`/`claimLast`)은 `day.claims` 에 남아도 무해하다(공개된 값). 화면은 `alive===false` 이면 주장 대신 `탈락` 을 그린다.

### Pattern 6: 클라이언트 배선 (질문 7, 8)

**RoomScreen**
- `sceneKey`: `night`·`morning` 도 `"dayScene"` — 낮 3단계와 같은 키라 래퍼·`DayScene`·`DayTable` 이 다시 마운트되지 않는다(C5). `renderPhase` 에 `case "night": case "morning":` 를 `DayScene` 쪽에 합친다.
- `PHASE_ANNOUNCE.night/morning`: UI-SPEC 접근성 절의 문구(밤은 역할별, 아침은 카드 제목 포함).
- `RoomScreen` 이 [수사 기록] 시트 열림 상태와 헤더 슬롯을 쥔다(UI-SPEC: 단계가 바뀌어도 열린 채). 경찰이면 `headerExtra = <>{recordsButton}{myRoleButton}</>`, 아니면 `myRoleButton` 그대로. `PhaseBar.extra` 는 이미 `ReactNode` 라 마크업 변경이 없다. `Day`(dayAnnounce)에도 같은 노드를 넘길지는 계획 재량(UI-SPEC C7 은 "밤·낮 모든 단계").

**DayScene**
- `Backdrop variant`: `view.phase === "night" ? "night" : "day"`. `Backdrop` 는 `variant` 로 이미지 URL 만 바꾸므로 `mf-dayscene__backdrop` 래퍼는 유지된다. [VERIFIED: src/net/assets.ts `backdropUrl(layout, variant)` → `/backgrounds/bg_${layout}_${variant}.svg`] 밤 이미지는 `public/backgrounds/bg_game_night.svg` 가 이미 있다(`ls` 확인). `rolePreloadList` 에 밤 배경 preload 추가를 권장(첫 밤 전환 깜빡임 방지) — 어떤 역할이든 같은 목록이라 요청 패턴으로 역할이 드러나지 않는다.
- 타이틀: `밤` / `아침`. 지시문: 마피아 `N일차 · 함께 지목하세요`, 그 외 밤 `N일차`, 아침 `{n+1}일차`.
- `Timer`: 아침(5초 전체가 "마지막 5초")은 `urgent` 를 꺼야 한다(UI-SPEC 확인필요 7). `countdown()` 은 `URGENT_MS = 5_000` 고정이므로 `Timer` 에 `calm?: boolean`(또는 `urgentDisabled`) 속성을 더한다. 밤은 마지막 5초 진홍 그대로.
- 하단 패널(`mf-dayscene__panel`, 높이 157 그대로)은 `(phase, role, alive)` 로 고른다:

| 상황 | 하단 |
|------|------|
| night, 탈락자(역할 무관) | `NightPanel` 탈락 안내 (채팅·알약 없음) |
| night, 마피아(생존) | `MessageLog`(첫 줄 `마피아끼리만 보여요` 안내) + `DiscussionControls`(밤 템플릿 3개) |
| night, 경찰·의사(생존) | `NightPanel` + `PickPill` |
| night, 시민(생존) | `NightPanel` + 안내 알약 |
| morning, 모두 | `NightPanel`(`아침이 밝았습니다` / `곧 낮 토론이 시작돼요`) |
| discussion, 탈락자 | `MessageLog` 만 (보내기 줄 없음) |
| claim·claimReveal, 탈락자 | `NightPanel` 탈락 안내 (가정 — UI-SPEC 확인필요 6) |

- `DayTable` 확장(좌표·이름표 마크업은 한 글자도 바꾸지 않는다): `DayTableSeat` 에 `dead?: boolean`, `pick?: { mine?: boolean; ally?: boolean }`, `onPick?: () => void` 를 더한다. `onPick` 이 있는 자리만 `<div role="group">` 대신 `<button type="button" aria-pressed aria-label="{닉네임}{ (나)}, {동사} 대상">` 로 그린다. 기존 `DayTable` 단위 테스트가 마크업을 단언하므로(`.mf-dt__seat[data-seat]` 의 `role=group`) **`onPick` 이 없을 때의 출력은 바이트 그대로**여야 한다. 버튼 안에 `Figure` 가 있어도 되고, 기존 이름표는 `pointer-events: none`(daytable.css) 이라 클릭을 가로채지 않는다.
  - `DayTagRow` 에 `{ kind: "dead" }` → 아랫줄 `탈락`, 윗줄 회색은 `dead` 로 CSS 클래스(`mf-dt__tag--dead`). `Figure` 에 `dead` 속성(grayscale(1)+opacity .55, 끊김 스타일과 겹치면 탈락만).
  - `seatLabel` 에 `, 탈락`.
- 낙관적 선택: `ClaimPanel` 의 `pending: { view, claim }` 방식 그대로 — 눌림 즉시 표시, 새 서버 view(다른 객체)가 오면 버리고 서버 값(`view.me.pick`)을 따른다. 서버가 거부하면 `sendRejection` 이 오류 뒤에 최신 state 를 같은 소켓에 다시 보내므로(`worker/room.ts` `sendRejection`) 자연스럽게 복원된다. 같은 대상 재탭은 보내지 않는다(D-02).
- `connection.canSend` 가 false 면 `disabled`(끊긴 동안 입력 꺼짐).

**수사 기록 (질문 7):**
- 서버: 경찰 본인 `me.records`(전체). 화면 파생(순수 함수, TDD 대상): `unseenCount = max(0, records.length - seenCount)`, 점 = `unseenCount > 0`, 시트 `NEW` = 맨 위 줄 1개(`unseenCount > 0`일 때). 시트를 열면 `seenCount = records.length` 를 저장한다.
- `seenCount` 저장은 폰 메모리(권장): 키 `minifia:records:{방코드}` 형태, `session.ts` 의 `StorageLike`·메모리 폴백 패턴을 재사용(`test/helpers/memoryStorage.ts` 가 이미 있다). 서버 메시지가 하나도 늘지 않는다. 단점: 다른 기기·브라우저로 같은 토큰을 이어받으면 이미 본 기록도 "새 기록" 점이 켜진다(수용 가능, Open Question 1).
- 알림(토스트): 같은 연결(`epoch`) 안에서 직전 view 대비 `records.length` 가 늘었을 때만 2초. 첫 view(재접속 직후)에는 직전 값이 없으므로 띄우지 않는다("이미 지난 알림은 다시 띄우지 않는다"). 밤을 놓쳤다가(백그라운드) 아침 이후에 돌아오면 토스트는 없고 점만 있다 — 허용.

### Anti-Patterns to Avoid
- **밤 `pick` 후 `persistAndBroadcast`(전원 전송):** 행동하는 사람이 있다는 프레임 타이밍이 시민에게 새어 나간다. 행위자(+생존 마피아)에게만 보낸다.
- **마피아 밤 채팅을 `broadcastEvent` 로 보내고 클라이언트에서 거르기:** 결정 0002/0019 위반(화면에서 숨기는 것으로 대신하지 않는다).
- **`resolveNight` 안에서 `Math.random`·`crypto` 호출:** 재현 불가. 난수는 항상 인자.
- **클라이언트가 행동 종류(지목/조사/보호)나 자기 역할을 서버로 보내기:** 서버 저장 역할만 신뢰.
- **아침 결과를 `Player` 마다 흩어 저장:** 한 곳 `RoomState.morning` 에 모아야 모든 폰이 같은 값을 받는다.
- **`DayTable` 좌표/마크업 수정:** 승인 시안 보호 규칙. 확장만.
- **밤 문구를 클라이언트에서 하드코딩 위치 분산:** `eliminationText.ts` 한 곳(UI-SPEC), 밤 템플릿 문구/칩은 `messageText.ts` 한 곳.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 균일 난수·동률 추첨·문구 추첨 | 직접 PRNG / `Math.random` | 기존 `cryptoRandInt`(서버) + `seededRandInt`(테스트) 를 `randInt` 로 주입 | 모듈로 편향 제거(거부 샘플링)가 이미 구현·테스트됨 [VERIFIED: worker/random.ts] |
| 연결별 개인 뷰 | 새 직렬화 경로 | `buildView` 허용 목록 리터럴에 필드 추가 | 누출 불변식·전수 누출 테스트가 이 경로에 걸려 있다 |
| 메시지 검증 | 수동 파싱 | `ClientMessageSchema`(zod `strictObject`) | 알 수 없는 키 거부(T-02-15) |
| 시트(수사 기록)·토스트 | 새 모달/타이머 | `Sheet`(`<dialog>`), `useToast` 로직 | 포커스 가두기·Esc·드래그 닫기·타이머 정리가 검증됨 |
| 생존 판정 | `alive !== false` 를 곳곳에 | `isAlive` | 서버·화면 공용 한 곳(`shared/game/alive.ts`) |
| 단계 길이/전이 | 코드 분기 | `PHASE_DEFS`·`ON_ENTER` 행 | 결정 0016, 알람 따라잡기가 이미 안전 |
| 낮/밤 문구 생성 | 서버가 문장 생성 | 템플릿/문구 **ID 만** 서버, 문장은 `messageText.ts`/`eliminationText.ts` | 서버는 문자열을 만들지 않는다(T-02-07) |
| localStorage 접근 | 직접 호출 | `session.ts` 의 `StorageLike`+메모리 폴백 패턴 | 사파리 개인 모드 예외 처리 포함 |

**Key insight:** 이 페이즈의 위험은 새 기술이 아니라 *비공개 정보 경계*다. 새 코드는 전부 기존 "허용 목록 뷰 + 소켓별 전송 + 순수 함수 판정" 경로 위에 올려야 기존 누출 불변식과 테스트가 그대로 지켜 준다.

## Common Pitfalls

### Pitfall 1: 밤 행동 프레임 타이밍 누출
**What goes wrong:** `pick` 처리 뒤 모든 소켓에 state 를 보내면 시민이 "지금 누군가 행동했다"를 알고, 행동 횟수·간격으로 역할 수·생존 여부를 추정한다.
**Why it happens:** `handleClaim` 이 `persistAndBroadcast` 를 쓰는 선례(낮 선택은 공개 진행이라 괜찮았다).
**How to avoid:** `persistAndSendTo(playerIds)` 헬퍼: 행위자, 마피아면 생존 마피아 전원. 같은 값 재선택은 전송도 저장도 없음.
**Warning signs:** 워커 테스트에서 시민 소켓의 프레임 수가 `pick` 전후로 변한다.

### Pitfall 2: `tick` 시그니처 변경이 기존 테스트를 연쇄로 깨뜨린다
**What goes wrong:** `discussion.next` 가 `night` 로 바뀌면 낮 루프를 가정한 테스트가 줄줄이 실패한다.
**깨지는 곳 (이번 세션 확인):** `test/unit/tick.test.ts` — "단계는 … 일곱 개" (`7:assigning,…`), 행 표(`discussion` → `90000/dayAnnounce/true`), "토론 마감에 다음 낮 시작 발표로 돌아가…", "한 바퀴를 한 번에 따라잡아도 …" (마감 연쇄 `T+2000 / T+17000 / T+19000 / T+109000`). `test/unit/view.test.ts` — `PHASES` 배열, `phaseDurationMs` 문자열, 마감 연쇄 단언. `test/worker/*` 중 `advanceTo`·`forceDue` 로 낮 루프를 돌리는 곳. `scripts/smoke.mjs` `PHASE_NEXT`·`iDisc` 검사.
**How to avoid:** 계약 변경 커밋을 RED 로 먼저(기존 테스트를 새 계약으로 고쳐 실패시킨 뒤) 구현. `tick` 의 `randInt` 는 기본값 `NO_RANDOM`(호출 시 throw)이라 낮만 도는 기존 테스트는 영향 없다.

### Pitfall 3: `claims` 가 밤·아침 뷰에 없어 이름표 아랫줄이 사라진다
**What goes wrong:** C6(밤·아침에 낮 주장 줄 유지)을 구현하려는데 `buildDay` 가 `claimReveal`·`discussion` 에서만 `claims` 를 싣는다 [VERIFIED: shared/game/view.ts:25-29 `if (state.phase === "claimReveal" || state.phase === "discussion") {`].
**How to avoid:** 조건에 `night`·`morning` 추가. `dayAnnounce`·`claim` 에는 여전히 싣지 않는다(다음 낮 마감 전 누출 불변식: "claim 단계에서 `claims` 키 없음"). 기존 view 테스트의 "dayAnnounce 뷰의 day 는 {n, roles} 뿐" 은 그대로 유지된다.

### Pitfall 4: 채팅 훅이 낮 줄과 밤 줄을 섞는다 / 밤이 끝나도 남는다
**What goes wrong:** `useDayChat` 는 `day.n` 이 바뀔 때만 비운다. 밤은 같은 `n`.
**How to avoid:** 훅 일반화(Pattern 4) + 단계가 `night` 를 벗어나면 비움 + 테스트("night → morning 에서 로그가 빈다", "discussion 줄이 night 로그에 안 섞인다").

### Pitfall 5: 아침 타이머가 5초 내내 진홍
**What goes wrong:** `urgent` 는 남은 시간 ≤ 5000ms 라 5초짜리 아침은 시작부터 끝까지 진홍.
**How to avoid:** `Timer` 에 `calm` 속성(UI-SPEC 확인필요 7 가정). 단위 테스트로 아침 `Timer` 에 `mf-timer--urgent` 가 없음을 단언.

### Pitfall 6: `cryptoRandInt(0)` 예외로 알람이 반복 실패
**What goes wrong:** 동률/문구 후보 길이가 0 일 때 호출하면 `RangeError` → `alarm()` 이 1초 뒤 재시도를 반복(상태는 morning 에 못 들어감).
**How to avoid:** 호출 조건 가드(Pattern 3). 단위 테스트: 마피아 지목 없음/단일 최다/탈락 없음 경로에서 `randInt` 가 호출되지 않는다(스파이로 호출 횟수 0 단언).

### Pitfall 7: 의사가 죽는 밤의 보호, 경찰이 죽는 밤의 조사
**What goes wrong:** 구현이 "지목 → 탈락 → 그다음 조사/보호"를 순차로 해서, 같은 밤에 죽는 경찰의 조사가 사라지거나 의사의 보호가 무시된다.
**How to avoid:** 모든 행동을 *밤 시작 시점의 선택*으로 한 번에 해결(탈락 적용은 마지막). 가정 A1 로 기록하고 단위 테스트로 못 박는다.

### Pitfall 8: 4명판에는 의사가 없다 / 마피아가 1명
**What goes wrong:** [VERIFIED: shared/game/roles.ts `4: Object.freeze({ mafia: 1, police: 1, doctor: 0, citizen: 2 })`] — 의사 화면·의사 호출 코드가 없는 판, 마피아가 혼자(`allies: []`, `allyPicks` 항상 빈 배열).
**How to avoid:** 8인(마피아 2) 동률 테스트와 4인 의사 없음 테스트를 둘 다. `allyPicks` 는 마피아가 혼자여도 빈 배열 `[]`(키 있음)로 일관.

### Pitfall 9: 4페이즈 전에는 승패가 없어 판이 끝나지 않는다
**What goes wrong:** 임시 루프(낮→밤→아침→낮)에서 시민이 모두 죽어도 계속 돈다. 마피아 입장에서 지목 가능한 대상이 0명이 될 수 있다.
**How to avoid:** 정상(4페이즈가 승패 판정). 단 크래시가 없게: 대상 후보가 없으면 `pick` 은 모두 `BAD_MESSAGE`, 판정은 "지목 없음". 계획에 "승패 없음은 의도된 상태" 한 줄을 남긴다.

### Pitfall 10: 옛 번들 탭이 새 단계 뷰를 받아 흰 화면
**What goes wrong:** 배포 직후 열려 있던 방의 옛 번들이 `night` 를 모른다.
**How to avoid:** `PHASE_ANNOUNCE` 옵셔널 호출, `renderPhase` default → "연결 중…"류 폴백(또는 새로고침 안내). 배포는 방이 없는 때(또는 사용자가 알 때) 하고, 6페이즈 플레이테스트 전이라 영향 작음.

### Pitfall 11: 테스트 개수·기준선
기준선: **56 파일, 1052 테스트, 약 6초** [VERIFIED: `npx vitest run` 이번 세션 실행]. `npm run typecheck` 는 `wrangler types` 를 포함한다. 새 테스트는 대략 서버 unit 60~90개, 워커 통합 10~15개, 클라이언트 40~60개로 추정(계획이 확정) [ASSUMED].

## Code Examples

설계 스케치다 — 이름은 계획 재량이고, 기존 값(`ROLE_IDS`, `isAlive`, 에러 코드)은 위 인용에서 가져왔다.

### night.ts — 선택 검증
```ts
// Source: 설계. 검사 순서는 claim.ts selectClaim 의 "단계 → 방에 있는 사람 → 값" 순서를 따른다.
export type NightError = "WRONG_PHASE" | "BAD_MESSAGE";

export function pickTarget(
  state: RoomState,
  actorId: string,
  target: number,
): { ok: true; state: RoomState } | { ok: false; error: NightError } {
  if (state.phase !== "night") return { ok: false, error: "WRONG_PHASE" };
  const actor = state.players.find((p) => p.id === actorId);
  if (!actor || !isAlive(actor)) return { ok: false, error: "BAD_MESSAGE" };
  if (actor.role !== "mafia" && actor.role !== "police" && actor.role !== "doctor") return { ok: false, error: "BAD_MESSAGE" };
  const t = Number.isInteger(target) ? state.players.find((p) => p.seat === target) : undefined;
  if (!t || !isAlive(t)) return { ok: false, error: "BAD_MESSAGE" };
  if (actor.role === "mafia" && t.role === "mafia") return { ok: false, error: "BAD_MESSAGE" }; // 자신·동료
  if (actor.nightPick === target) return { ok: true, state };
  return { ok: true, state: { ...state, players: state.players.map((p) => (p.id === actorId ? { ...p, nightPick: target } : p)) } };
}
```

### night.ts — 판정 골격
```ts
// Source: 설계. 난수는 필요할 때만, 정해진 순서로 호출한다.
export function enterMorning(state: RoomState, randInt: RandInt): RoomState {
  const alive = state.players.filter(isAlive);
  const votes = new Map<number, number>();
  for (const p of alive) {
    if (p.role !== "mafia" || p.nightPick === undefined) continue;
    const t = state.players.find((q) => q.seat === p.nightPick);
    if (!t || !isAlive(t) || t.role === "mafia") continue;     // 방어적 재검증
    votes.set(t.seat, (votes.get(t.seat) ?? 0) + 1);
  }
  const top = Math.max(0, ...votes.values());
  const tied = [...votes].filter(([, c]) => c === top && top > 0).map(([seat]) => seat).sort((a, b) => a - b);
  const target = tied.length === 0 ? undefined : tied.length === 1 ? tied[0] : tied[randInt(tied.length)];
  const saved = alive.some((p) => p.role === "doctor" && p.nightPick === target && target !== undefined);
  const eliminated = target !== undefined && !saved ? target : undefined;
  // phrase: eliminated 가 있을 때만, lastPhrase 를 뺀 1..MORNING_PHRASE_COUNT 에서 randInt
  // 경찰: alive 중 role==="police" && nightPick !== undefined → investigations 에 {n: state.day ?? 1, target, isMafia}
  // 마무리: alive=false 적용, 모든 nightPick 삭제, state.morning = { ...(eliminated !== undefined ? { eliminated, phrase } : {}) }
  return /* … */ state;
}
```

### view.ts — 역할별 필드 (허용 목록)
```ts
// Source: 설계. 기존 myInfo 조립(shared/game/view.ts)에 이어서 조건부로 키를 만든다.
const meAlive = isAlive(me);
if (state.phase === "night" && meAlive && me.nightPick !== undefined) myInfo.pick = me.nightPick;
if (state.phase === "night" && meAlive && me.role === "mafia") {
  myInfo.allyPicks = [...new Set(state.players.filter((p) => p.role === "mafia" && p.id !== me.id && isAlive(p) && p.nightPick !== undefined).map((p) => p.nightPick!))].sort((a, b) => a - b);
}
if (def.revealsOwnRole && me.role === "police") myInfo.records = (me.investigations ?? []).map((r) => ({ n: r.n, target: r.target, isMafia: r.isMafia }));
```

### worker/room.ts — 행위자 한정 전송과 마피아 한정 방송
```ts
// Source: 설계. handleClaim(사용자 선택 → persist → 방송) 구조를 따르되 방송 대상을 줄인다.
case "pick": await this.handlePick(ws, msg.target); return;
// handlePick: pickTarget → 실패면 sendRejection(ws, playerId, code)  // 오류 + 해당 소켓에만 state
//             성공이고 state !== this.room 이면 this.room = result.state; storage.put;
//             const ids = actor.role === "mafia" ? 생존 마피아 id 전부 : [actor.id]; this.sendViewTo(ids)
const next = tick(room, now, cryptoRandInt);   // 현재 worker/room.ts:373 `const next = tick(room, now);` 를 교체
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 낮 루프 임시 종착(`discussion → dayAnnounce`) | `discussion → night → morning → dayAnnounce` (4페이즈 전 임시) | 이 페이즈 | 4페이즈가 투표·처형을 `discussion` 과 `night` 사이에 끼운다 — `night` 행은 그대로 재사용 |
| 밤 메시지 전면 금지(결정 0005) | 밤의 마피아만 예외(결정 0019) | 2026-10-24 | `senderOf` 가 단계×역할 규칙으로 커짐 |
| 조사 결과 팝업(초안) | [수사 기록] 시트 + 점 + 토스트(D-10 변경) | 2026-10-24 | 밤·아침 사이 추가 시간 없음 → 경찰 생사로 인한 시간 차 누출 없음 |

**Deprecated/outdated:** `InvestigationResult` 팝업 부품(만들지 않음), `claims` 가 `claimReveal`·`discussion` 에만 실린다는 가정, `PublicPlayer` 의 네 키 고정.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 같은 밤 안의 모든 행동은 **동시 해결**한다 — 그 밤에 지목되어 죽는 경찰의 조사는 기록되고, 죽는 의사의 보호도 적용된다 | Pattern 3, Pitfall 7 | 사용자가 "죽으면 행동 무효"를 원하면 `resolveNight` 규칙표와 테스트가 바뀐다. 요구사항 원문에는 순서 규정이 없다 |
| A2 | 마피아 일부만 고르면 **고른 사람들의 표만** 집계한다(2명 중 1명만 고르면 그 표로 지목) | Pattern 3 | 반대로 "전원 합의 없으면 지목 없음"을 원하면 규칙 변경. D-08 은 "아무도 안 고르면 행동 없음"만 규정 |
| A3 | 탈락한 마피아도 `me.allies`(자기 역할 정보)는 계속 받고, `allyPicks` 와 밤 채팅은 받지 않는다 | Pattern 2·5 | UI-SPEC "탈락 동료 링 유지(가정)"와 같은 결. 반대면 view 조건 한 줄 |
| A4 | "새 기록 봤는지"는 폰 메모리(localStorage)로 둔다 | Pattern 6 | UI-SPEC 이 "서버 값 또는 폰 메모리, 계획이 정함"으로 위임. 기기 교체 시 점이 다시 켜지는 정도 |
| A5 | 새 테스트 수 추정(서버 unit 60~90, 워커 10~15, 클라이언트 40~60) | Pitfall 11 | 일정 추정 오차뿐 |
| A6 | 옛 번들 폴백(`PHASE_ANNOUNCE?.()`·default)이 필요하다 | Pattern 1, Pitfall 10 | 없으면 배포 중 열린 방에서 흰 화면. 비용 낮아 넣는 것을 권장 |
| A7 | `PublicPlayer.alive` 는 서버가 항상 실어 키 집합을 균일하게 하고 타입은 optional | Pattern 5 | 조건부(탈락자만) 방식을 택하면 키 단언 4곳의 수정 내용이 달라질 뿐 |
| A8 | 아침 `Timer` 의 `urgent` 를 끈다(UI-SPEC 확인필요 7 그대로) | Pitfall 5 | 디자인 세션 확인 대상 |

사용자 확정이 필요한 것은 A1·A2(게임 규칙)다. 나머지는 구현 재량이다.

## Open Questions (RESOLVED)

> 2026-10-24 계획 단계에서 네 질문 모두 정리했다. 각 질문 아래 **RESOLVED** 줄이 결론과 근거다.

1. **"새 기록" 점 상태를 폰이 쥘지 서버가 쥘지**
   - What we know: 두 방식 모두 UI-SPEC 허용. 폰 메모리는 서버 변경 0, 서버는 `seen` 메시지 필요.
   - What's unclear: 사용자가 기기 간 이어받기를 중요하게 여기는지.
   - Recommendation: 폰 메모리(A4). 6페이즈 플레이테스트에서 문제로 보이면 서버로 옮긴다.
   - **RESOLVED:** 폰 메모리로 정했다 — `minifia:records:{방코드}` 에 본 개수만 저장하고(기록 내용·토큰은 저장하지 않음) 대기실·배정에서 0 으로 되돌린다(03-11). 근거: 서버 메시지·스키마·핸들러가 하나도 늘지 않고, 기기를 바꿨을 때 점이 다시 켜지는 정도는 수용 가능. 결정 0020 ⑦ 에 기록(03-09).

2. **죽는 경찰·의사의 같은 밤 행동 처리(A1)와 일부 마피아만 고른 경우(A2)**
   - Recommendation: 계획 단계에서 한 줄로 사용자 확인(체크포인트 아님 — 기본값을 A1·A2 로 두고 진행해도 되지만 `docs/decisions/0020` 에 기록).
   - **RESOLVED:** A1(같은 밤 동시 해결)·A2(고른 마피아 표만)를 기본값으로 채택했다 — 03-03 판정 규칙표와 테스트에 고정, 결정 0020(03-09)에 기록, HANDOFF 다음 할 일에 사용자 확인 항목으로 남긴다(03-12). 근거: 요구사항 원문에 순서·일부 선택 규정이 없고, 바꿔도 규칙표와 테스트만 고치면 되는 기본값이라 체크포인트로 막지 않는다.

3. **탈락자의 낮 직업 공개 하단(UI-SPEC 확인필요 6)**
   - Recommendation: `탈락했어요` 패널 사용(가정). 실기기 확인 목록에 넣는다.
   - **RESOLVED:** 결정 0021(탈락자 관전)로 대체됐다 — 탈락자는 옛 `탈락했어요` 패널이 아니라 낮 단계(직업 공개·공개 연출·토론)에서 낮 채팅 세 줄 읽기 전용 + `.ro` 줄 `탈락했어요 · 볼 수만 있어요`, 밤에는 관전 마피아 채팅 + `.ro` 를 본다(03-UI-SPEC N-6, 03-06·03-08). 근거: 사용자 승인 결정 0021·시안 E1 개정본.

4. **봇 UAT 길이**: 서버 단계 시간을 줄이는 스위치가 없어 밤 시나리오는 첫 밤까지 약 2분 + 밤 30초 + 아침 5초, 두 밤이면 약 5분이다. 허용 범위로 보고 시간 단축 스위치는 만들지 않는다(요구 밖).
   - **RESOLVED:** 그대로 받아들였다 — uat-night 는 두 밤 약 5분, 스모크 한도는 300초로 늘린다(03-12). 근거: 시간 단축 스위치는 요구 밖이고 운영 코드에 시험용 분기를 넣지 않는다.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | 전체 | ✓ | v26.0.0 (`engines >=22.12`) | — |
| npm | 전체 | ✓ | 11.12.1 | — |
| wrangler | 워커 통합 테스트·배포·`typecheck` | ✓ | 4.151.3 | — |
| vitest / tsc | 테스트·타입 검사 | ✓ (`node_modules/.bin`) | vitest 4.1.12, TS 7.0.2 | — |
| Cloudflare 계정(개인) | 배포 후 스모크·봇 UAT | 이번 세션 미확인 | — | 로컬 `vite dev` 에서 `node scripts/smoke.mjs http://localhost:5173`(캐시 헤더 단언 하나 실패는 알려진 현상 — HANDOFF) |

**Missing dependencies with no fallback:** 없음
**Missing dependencies with fallback:** 없음

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.12, 3 프로젝트: `unit`(node) · `client`(happy-dom + React plugin) · `worker`(workerd, `@cloudflare/vitest-plugin`) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run test/unit` (서버 규칙) · `npx vitest run test/client/dayScene.test.tsx` 같은 파일 단위 |
| Full suite command | `npx vitest run` (현재 56 파일·1052 테스트, 약 6초) + `npm run typecheck` |
| 배포본 확인 | `node scripts/smoke.mjs --prod --stage full [--players N]`, `node scripts/uat-night.mjs --prod [--players 5]` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NIGHT-01 | 마피아 표 최다 지목 / 동률은 `randInt` 로 동률 집합 안에서 / 일부만 고른 표 / 지목 없음=탈락 없음 / 동료·자신 지목 거부 | unit | `npx vitest run test/unit/night.test.ts` | ❌ Wave 0 |
| NIGHT-01 | 동료 현재 선택이 마피아 뷰 `me.allyPicks` 로만 간다(비마피아·탈락 마피아에게 없음) | unit(view) + worker | `npx vitest run test/unit/view.test.ts test/worker/night.test.ts` | ✅ view.test(확장) / ❌ night.test |
| NIGHT-02 | 조사 결과 `isMafia` 가 경찰 `investigations` 에만 쌓이고 `me.records` 로 경찰 본인에게만 | unit + worker leak | `npx vitest run test/unit/night.test.ts test/worker/leak.test.ts` | ❌ / ✅(확장) |
| NIGHT-03 | 의사 보호=지목이면 탈락 없음, 자기 보호, 의사 미선택 | unit | `npx vitest run test/unit/night.test.ts` | ❌ Wave 0 |
| NIGHT-04 | 역할별 밤 화면: 마피아(동료 링+배지+채팅), 경찰·의사(알약), 시민(안내), 탈락자(E1), 자신·동료 탭 불가, `aria-pressed` | client | `npx vitest run test/client/nightScene.test.tsx test/client/dayTable.test.tsx` | ❌ / ✅(확장) |
| NIGHT-05 | 밤은 `NIGHT_MS` 30000 고정; `pick` 이 `phaseEndsAt`·알람을 바꾸지 않음; 모두가 골라도 마감 전엔 `night` | unit(tick/phases) + worker | `npx vitest run test/unit/tick.test.ts test/worker/night.test.ts` | ✅(수정) / ❌ |
| NIGHT-06 | 아침 5초, 모든 viewer 의 `day.morning` 동일, 문구 번호 1..8, 연속 반복 없음(속성 테스트), 무사 시 `{}`; 화면 카드 문장 8개 + `님이` | unit + client | `npx vitest run test/unit/night.test.ts test/client/morning.test.tsx` | ❌ Wave 0 |
| ELIM-01 | 탈락자 `pick`/`claim`/`say`/`emoji` 모두 `BAD_MESSAGE`; 탈락자 뷰에 `pick`·`allyPicks`·밤 채팅 없음; `players[].alive`; 남의 역할 미전송 | unit + worker leak | `npx vitest run test/unit/night.test.ts test/unit/claim.test.ts test/unit/chat.test.ts test/worker/leak.test.ts` | ❌ / ✅(확장) |
| COMM-04(밤) | 밤: 생존 마피아만 통과, 템플릿 `when` 불일치 `BAD_MESSAGE`, 생존 비마피아 `WRONG_PHASE`, 아침 `WRONG_PHASE`; chat/emoji 프레임이 비마피아 소켓에 0개 | unit + worker | `npx vitest run test/unit/chat.test.ts test/worker/night.test.ts` | ✅(확장) / ❌ |
| 공통 | 늦은 알람 따라잡기: `discussion` 에서 한 번에 `dayAnnounce` 까지 넘어가도 훅이 night→morning→dayAnnounce 로 한 번씩, 일차 +1 한 번 | unit | `npx vitest run test/unit/tick.test.ts` | ✅(수정) |
| 공통 | 단계 순서·arrival 편차·역할/동료/records 누출을 배포본에서 | smoke / UAT 스크립트 | `node scripts/smoke.mjs --prod --stage full` / `node scripts/uat-night.mjs --prod` | ✅(수정) / ❌ |

### Sampling Rate
- **Per task commit:** 해당 영역 파일 단위 `npx vitest run <file>` (서버 규칙은 `test/unit/night.test.ts` 등, 수 초 이내).
- **Per wave merge:** `npx vitest run` 전체 + `npm run typecheck`.
- **Phase gate:** 전체 green + 배포 후 `smoke.mjs --prod --stage full`(5명·8명) + `uat-night.mjs --prod` 종료 코드 0 → `/gsd-verify-work 3`.

### Wave 0 Gaps
- [ ] `test/unit/night.test.ts` — `pickTarget` 검사 순서 전 경로, `resolveNight`/`enterMorning` 규칙표 전 행, 난수 호출 횟수/순서, 문구 번호 속성 테스트(NIGHT-01·02·03·06, ELIM-01)
- [ ] `test/worker/night.test.ts` — workerd 에서 실제 소켓: 역할별 `pick`, 마피아 한정 `allyPicks`/chat/emoji, 비마피아 프레임 0, 마감 후 `pick` → `WRONG_PHASE`, 밤 종료 시 탈락·records·morning 동일성, 알람 `phaseEndsAt` 일치(NIGHT-04·05·06, COMM-04)
- [ ] `test/client/nightScene.test.tsx`(역할별 밤 하단·DayTable 탭·낙관적 선택 복원·마피아 로그 첫 줄·단계 이탈 시 로그 비움), `test/client/morning.test.tsx`(카드 문구·무사·calm 타이머·탈락 표시), `test/client/records.test.tsx`(버튼·점·토스트 규칙·시트 NEW/빈 상태/`aria-label`) — 파일 분할은 계획 재량
- [ ] 기존 테스트의 계약 갱신 커밋(RED): `tick.test.ts`, `view.test.ts`, `gameRoom.test.ts:455`, `http.test.ts:116`, `leak.test.ts`(밤·아침까지 진행 + 새 불변식), `chat.test.ts`(밤 규칙), `claim.test.ts`(탈락 거부), `test/client/*` 의 `PhaseId` 픽스처
- [ ] `leak.test.ts` 확장 항목(UI-SPEC 계획): "마피아가 아닌 소켓은 밤 `chat`·`emoji` 프레임을 받지 않는다", "비경찰은 `records` 키가 있는 프레임을 받지 않는다", "동료 선택(`allyPicks`)은 생존 마피아에게만 간다", "탈락자 뷰에 `pick`·`allyPicks` 없음"; 6명 판을 `morning` 까지 진행(기존 코드는 `dayAnnounce` 까지) — 진행에는 `advanceTo(code, sockets, "night"|"morning")` 도우미를 그대로 쓴다 [VERIFIED: test/worker/helpers.ts `advanceTo(code, sockets, phase: PhaseId)`]
- 프레임워크 설치: 없음(기존)

## Security Domain

### Applicable ASVS Categories (level 1, `security_enforcement: true`)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (신규 인증 없음) | 기존 토큰 hello — 변경 없음 |
| V3 Session Management | no | 기존 소켓 첨부 `playerId`/`connId` — 신원은 메시지가 아니라 첨부에서만 |
| V4 Access Control | **yes** | 서버가 역할·생존·단계로 모든 행동을 인가(`pickTarget`, `senderOf`); 클라이언트가 보낸 seat/역할/행동 종류를 신뢰하지 않음 |
| V5 Input Validation | **yes** | `ClientMessageSchema` `strictObject` + `target` `int().min(0).max(7)`, 서버 도메인 검증(앉은 생존자) |
| V6 Cryptography | yes(난수) | `cryptoRandInt` 만 사용, `Math.random`·시각 시드 금지 |
| V7/V8 Data protection | **yes(핵심)** | 역할별 뷰 허용 목록, 마피아 소켓 한정 이벤트, 누출 테스트 전수 |

### Known Threat Patterns for {Cloudflare DO + WebSocket 파티 게임}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 위조 `pick`(남의 역할 흉내, 남 대신 행동) | Spoofing / Elevation | 신원은 소켓 첨부 `playerId`, 행동 종류는 서버 저장 역할로 결정 |
| 시민이 `pick` 을 보내 역할 탐색 | Info disclosure | 시민의 `pick` 은 `BAD_MESSAGE`(자기 역할 외 정보 없음); 응답 코드가 남의 역할을 드러내지 않음 |
| 마감 직후 `pick` 끼워넣기 | Tampering | 모든 메시지 앞에서 `advance(Date.now())` — 마감 뒤는 `WRONG_PHASE` |
| 밤 채팅 도청(비마피아 소켓이 chat 수신) | Info disclosure | `broadcastEventTo(생존 마피아 id)` — 클라이언트 필터 금지; 워커 테스트로 프레임 0 확인 |
| 행동 타이밍으로 역할 추정 | Info disclosure | 행위자(+생존 마피아)에게만 state 전송, 밤·아침 사이 추가 단계 없음(경찰 생사에 따른 시간 차 없음) |
| 탈락자의 정보 수집/발언 | Elevation | `isAlive` 검사(`pick`·`claim`·`say`·`emote`), 탈락자 뷰에서 비공개 필드 제외 |
| 메시지 폭주 | DoS | 연결당 1초 20개(`overRateLimit`) + 채팅 `lastSendAt` 1.8초; `pick` 은 같은 값 재선택 시 무저장 |
| 알 수 없는 키 주입(`text` 등) | Tampering | `strictObject` |
| 약한 난수로 동률/문구 예측 | Tampering | `cryptoRandInt` (거부 샘플링) |

## Sources

### Primary (HIGH confidence — 이번 세션에 파일을 직접 읽음)
- `/Users/dhkim1522/personal/minifia/.planning/phases/03-night-morning/03-CONTEXT.md`, `03-UI-SPEC.md` (전체)
- `design/screens/night-v1/SPEC.md`, `docs/decisions/0016`·`0018`·`0019`, `.planning/REQUIREMENTS.md`·`ROADMAP.md`(Phase 3)·`STATE.md`, `HANDOFF.md`
- 서버: `shared/protocol.ts`, `shared/schemas.ts`, `shared/game/{phases,tick,alive,discussion,chat,claim,room,roles,view}.ts`, `worker/room.ts`, `worker/random.ts`
- 클라이언트: `src/net/{useRoomConnection,seatFloats,assets,countdown,session,roomDiff}.ts`, `src/screens/{RoomScreen,DayScene,Day}.tsx`, `src/components/{DayTable,Figure,ClaimPanel,DiscussionControls,QuickMessageSheet,MessageLog,PhaseBar,Timer,MyRoleSheet,Backdrop,Toast,Sheet,Icon}.tsx`, `src/game/{dayTable,messageText,roleText}.ts`, `src/styles/day.css`
- 테스트·스크립트: `test/worker/{leak.test.ts,day.test.ts,helpers.ts}`, `test/unit/{tick,view,chat}.test.ts`(구조), `test/client/{dayScene,dayTable}.test.tsx`(구조·CSS 단언), `test/helpers/seededRandom.ts`, `scripts/{smoke,uat-day,bots}.mjs`
- `vitest run` 실행 결과: 56 파일 / 1052 테스트 통과

### Secondary / Tertiary
- 없음. 외부 문서 조회가 필요한 새 API/라이브러리가 없다 (Durable Object 하이버네이션 소켓·알람은 기존 코드가 이미 쓰는 범위).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 새 패키지 없음, 버전은 `package.json` 확인.
- Architecture: HIGH — 단계 표/훅/뷰/방송 구조와 계약을 코드에서 직접 확인.
- Pitfalls: HIGH — 깨지는 기존 테스트와 누출 경로를 파일 단위로 확인. 추정 개수(A5)만 MEDIUM.
- 규칙 해석(A1·A2): MEDIUM — 요구사항 원문에 순서·일부 선택 규정이 없어 가정으로 명시.

**Research date:** 2026-10-24
**Valid until:** 2026-11-23 (저장소 내부 구조 기반이라 코드가 바뀌기 전까지 유효. 4페이즈 계획 전에 `ON_ENTER`/`PHASE_DEFS` 변경 여부를 다시 확인)

---

## 부록 A. 질문 9 — 스크립트 갱신

**`scripts/smoke.mjs`** (현재 낮 한 바퀴를 서버 타이머로 돈다):
1. `PHASE_NEXT`: `discussion: ["night"]`, `night: ["morning"]`, `morning: ["dayAnnounce"]` 추가 [VERIFIED: scripts/smoke.mjs `const PHASE_NEXT = { … discussion: ["dayAnnounce"] }`].
2. 낮 루프 단언 `seq[iDisc + 1] !== "dayAnnounce"` → `night`, 그리고 `night → morning → dayAnnounce` 확인.
3. `DAY_PHASES`(미리보기 phase 검사)에 `night`·`morning` 추가.
4. 대기 상한: `DISCUSSION_WAIT_MS = 90_000 + STATE_LIMIT_MS` → `90_000 + 30_000 + 5_000 + STATE_LIMIT_MS`. 타임라인: 시작 후 assigning 3 + roleReveal 15 + dayAnnounce 2 + claim 15 + claimReveal 2 + discussion 90 + night 30 + morning 5 = **약 162초** 에 2일차 `dayAnnounce` 도달. `FULL_TOTAL_LIMIT_MS = 240_000` 안이지만 여유 약 78초 — 늘리기를 권장(예 300_000).
5. `ALLOWED_PLAYER_KEYS` 에 `alive` 추가(정렬된 문자열 비교이므로 `["alive","connected","isHost","nickname","seat"]`).
6. 밤 단언 추가(배포본에서): 밤에 각 클라이언트가 자기 `view.me.role` 로 행동(마피아 `pick` 비마피아 seat, 경찰 `pick`, 의사 `pick`), 그리고 (a) 마피아만 `me.allies`/`me.allyPicks`, (b) 비마피아 소켓이 밤 `chat`/`emoji` 프레임 0개(마피아가 보낸 것이 있을 때), (c) 경찰만 `me.records` 키, (d) 아침 `day.morning` 이 모든 클라이언트에서 같은 값(JSON 비교), (e) `players[].alive` 와 `morning.eliminated` 일치, (f) `view.me.role` 밖의 `role` 키 없음 불변식 유지(`collectKeyPaths`).
   - 의사 없는 4명판은 의사 단언 생략(`EXPECTED_ROLES` 사용).

**`scripts/uat-day.mjs`**: `waitUntil(... "2일차 claim")` 130초 상한 → 낮 토론 이후 밤 30 + 아침 5 + 낮 시작 2 가 더해지므로 **약 175초 이상**으로. 이 스크립트의 클라이언트는 밤 행동을 하지 않으므로 탈락자가 없어 이후 기대(2일차 말 바꿈 등)는 그대로 성립한다. `phases` 도착 편차 표(`dayAnnounce 1…discussion 2`)에 `night`·`morning` 열을 더할 수 있다(선택).

**`scripts/bots.mjs`**(수동 시험용): `onState` 에 `night` 분기 — 생존 봇만, 역할이 있는 봇은 `pick`(마피아는 비동료 생존자 무작위, 경찰·의사는 생존자 무작위), 마피아 봇은 가끔 밤 `say`/`emoji`. 자신이 탈락(`players` 에서 `alive===false`)이면 모든 행동 중단. `discussion` 의 기존 `talkTimer` 정리 로직(`else if (bot.talkTimer)`)은 `night` 에서도 타이머를 지우므로 그대로 둔다.

**신규 `scripts/uat-night.mjs`** (봇 밤 시나리오, `uat-day.mjs` 구조를 따른다: `connect`/`waitUntil`/`check` 표):
- 방 만들기(기본 5명: 의사 포함) → 시작 → 각 클라이언트의 `me.role` 로 역할 파악(스크립트는 전지적).
- **1일차 밤**: 마피아들이 (의사가 고르지 않을) 같은 시민 X 를 지목, 경찰이 마피아 한 명 조사, 의사는 다른 사람 Y. → 아침: 모든 클라이언트 `morning.eliminated === X`, `phrase ∈ 1..8`, 모든 `players[X].alive === false`, 경찰 `records` 길이 1 / `isMafia true`, 비경찰에는 `records` 키 없음, 비마피아 소켓에서 밤 `chat` 프레임 0.
- **2일차 밤**: 마피아 지목 Z, 의사가 Z 보호 → 아침 `morning` 이 `{}`(탈락 없음), 모든 폰 동일, 경찰 records 길이 2. 탈락자(X)가 `pick`/`say`/`claim` 시도 → `BAD_MESSAGE`.
- 마피아 둘이 서로 다른 대상 지목(8명판 `--players 8` 옵션) 시 결과가 두 후보 중 하나임(동률 추첨 사후 확인).
- 마감 직후 `pick` → `WRONG_PHASE`.
- 전체 약 5분. 표 형식은 `uat-day.mjs` 의 `check(test, label, ok, detail)`.

## 부록 B. 권장 계획 분할 (참고)

| Wave | 내용 | 비고 |
|------|------|------|
| 1 (TDD, 서버 순수) | 와이어 계약 변경(RED로 기존 테스트 갱신) · `phases/tick/night.ts` · `chat.ts` 밤 규칙 · `claim.ts` 탈락 거부 · `view.ts` 필드 | 이 계약이 클라이언트의 전제 |
| 2 | `worker/room.ts` 배선(`pick`·행위자 한정 전송·마피아 한정 방송·`tick(..., cryptoRandInt)`) · 워커 통합·누출 테스트 | wave 1 선행 |
| 3 (클라이언트) | `DayTable`/`Figure`/`Icon` 확장 · `DayScene` 밤·아침 · `NightPanel`·`PickPill`·`MorningCard` · 마피아 채팅 훅 일반화·밤 템플릿 | 와이어 계약 확정 후, 일부는 wave 2 와 병렬 가능 |
| 4 | `RecordsButton/Toast/Sheet` · `RoomScreen` 헤더 슬롯 · `recordsSeen` | |
| 5 | 스크립트(smoke·uat-day·bots·uat-night) · 배포 · 배포본 스모크·UAT · `docs/decisions/0020` · HANDOFF/ROADMAP/REQUIREMENTS 갱신 | 실기기 확인 목록은 6페이즈로(결정 CONTEXT deferred) |
