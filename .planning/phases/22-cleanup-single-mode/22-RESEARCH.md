# Phase 22: 정리: 판 하나로, 확장판·시상식 제거, 투표·유언 개편, 유령 수정 - Research

**Researched:** 2026-11-16
**Domain:** 기존 코드 대규모 삭제(판 종류·확장판·시상·튜토리얼) + 낮 투표 흐름 재배선(찬반 → 차례 지목 → 유언 → 처형) + 3D 유령 수정. 새 외부 패키지 없음.
**Confidence:** HIGH (모든 핵심 사실을 이 세션에서 소스를 직접 열어 확인). 단, 삭제 범위의 "컴파일러가 못 잡는 곳"은 grep 점검 목록으로만 정리했고 파일별 전수는 계획자·실행자가 grep 으로 닫는다.

> 이 문서는 `22-CONTEXT.md`(D-01~D-24)와 `22-UI-SPEC.md`(P22-1~19)를 **다시 조사하지 않고 그 위에** 쌓는다. 인벤토리(삭제 파일 목록·위험 10개)는 CONTEXT `<code_context>` 가 이미 갖고 있고, 여기는 인벤토리가 답하지 않는 것(삭제 순서, 규칙 변경의 구체 값, 되살아나는 것, 시험 지도, 계획 쪼개기)만 적는다.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### 판 하나로 (0089-12)
- D-01: 판 종류 개념을 지운다. `GAME_MODES`·`GameMode`·`DEFAULT_MODE`·`RoomView.mode`·`{t:"modePick"}`·`shared/game/mode.ts`·`RULES_BY_MODE`·`CAUSE_MODES`·`MODE_MAPS`·`startMapOf` 의 mode 분기, 방장 줄 [판 종류] 단추·`ModeSheet`·`ModeChip`·`modeText`·`modeToastOf`. 남는 규칙은 상수 하나(`RULES`)이며 `pickTurn: true`, 나머지 정치 장치(badge·whisper·runoff·showdown)는 false 그대로, `errand`·`witness`·`trace`·`cause` 플래그는 지운다.
- D-02: 맵은 재즈 바·시계탑 광장만 남고 방장이 고른다(지금 기본 마피아의 [맵] 그대로). `town` 은 `MapId` 에서 빠진다.
- D-03: 저장된 옛 방(`mode`·`town`·errand 필드가 있는 방)은 `normalizeStoredRoom` 에서 대기실로 되돌린다(진행 중이던 판은 버린다 — 출시 전이라 허용). 모르는 키는 무시한다.

### 확장판 제거 (0089-13·14)
- D-04: 조사 인벤토리의 확장판 전용 코드를 모두 지운다 — 심부름(`errand*`, `PhaseId "errand"`, 장소 `PLACE_IDS`·`placeArt`·`make-placeart`), 등불(`lamps.ts`), 마을(`mapTown.ts`·`zones.ts`·`town.ts`·`cutaway.ts`·문 프레임·zone 동기화·overview 카메라·`houseTagCenters`), 밤 집 고르기 화면(`houseView`·`HouseTag`), 아침 현장(`scene.ts`·inspect·ClueSpot·ClueCard), 의심 보드(`boardView`·`SuspectBoard`·`TutorialEvidence`), 목격 기록(`recordView`·`RecordCard`·`me.record`), 밤 흔적(`trace.ts`·`EvidenceCard`·`traceMark`·`evidence.css`), 건너뛰기(`skip.ts`·`SkipPill`). 각 기능의 단위·worker·client 시험, 누설 시험 허용 목록 항목, E2E 흐름(errand·town-*·cause-*·mode-*), smoke·perf·uat 스크립트의 해당 경로를 함께 지운다.
- D-05: 밤 화면은 지금 기본 마피아의 얼굴 목록 고르기 그대로다(0074 의 "모든 역할 같은 화면"은 유지).
- D-06: 흰 분필 윤곽은 남긴다. `captureHomeNow` 는 cause 분기를 지우고 `captureHome`(토론이 끝난 자리)만 쓴다.
- D-07: `plaza.ts` 의 town 재사용 선택 인자와 `PLAZA_SPAWNS` 의존은 town 을 지우며 정리한다(광장 생김새는 그대로).
- D-08: 튜토리얼은 확장판 부품에 기대므로 **이 페이즈에서 옛 튜토리얼 코드(서버 `tutorial` 단계·`tutorialDone`, `tutorialScript`·`TutorialScreen`·`Tutorial*` 부품·훅·css·소리 `tut.*`·시험·E2E)를 지우고 진입점(첫 화면 [혼자 하기]·방장 줄 [튜토리얼 먼저])을 숨긴다.** 24 에서 새 흐름 기준으로 다시 만든다(0089-15).
- D-09: 시험 장치의 기본 판을 하나로 바꾼다 — `lockCause`·`lockModeMaps`·`openTown`·`SHIPPED_*` 와 setup 의 고정을 지우고, 이를 쓰던 시험은 지울 기능이면 함께 지우고 남는 기능이면 고정 없이 돈다. E2E `openGame` 의 `mode` 인자·`pickModeViaRail`·`pickModeViaUi`·`openExtended` 를 지운다. smoke 기본값은 하나의 흐름.

### 낮 투표 개편 (0089-18)
- D-10: 낮 순서는 `discussion`(90초, 과반 끝내기 그대로) → `verdict`(찬반) → `nomination`(차례 지목) → `defense`(유언, D-15) → `execution` → 밤. **단계 id 는 새로 늘리지 않고 순서와 의미만 바꾼다**(21 의 방식). `nextPhaseOf`·`afterDayOf`·tick 훅이 새 순서를 따른다.
- D-11: 찬반은 후보 없이 "오늘 처형할까?"를 묻는다. 산 사람 전원이 투표한다. 길이 10초(`VERDICT_MS` 그대로), 집계 수(찬성·반대)만 실시간 공개, 마감 전 번복 가능. **던진 표의 과반이 찬성(찬성×2 > 던진 표)이면 지목으로**, 아니면(던진 표 0 포함) 처형 없이 밤으로. `verdictVotersOf` 의 후보 제외와 "못 던진 표도 분모" 규칙을 바꾼다.
- D-12: 지목은 0063-1 순차 지목(`pickTurn`)을 켜서 쓴다 — 산 사람이 한 명씩 차례로 한 명을 고르고(차례 8초 `PICK_TURN_MS`, 시작 사람은 날마다 바뀜 — 지금 코드 그대로), 고르는 순간은 모두가 본다(차례 화면·slide 핀). 자기 지목·지목 불가 규칙은 지금 코드 그대로. 차례 안에 못 고르면 기권.
- D-13: 최다 득표가 정확히 한 명이면 그 사람이 유언(D-15) 후 처형, 동점·0표면 처형 없이 밤(결선 없음).
- D-14: **기록을 남기지 않는다.** 지목 채팅 줄("A → B")·지목 토스트 기록, 찬반 기록 카드(`ballots` 채팅·`ballots.ts`·`BallotReveal` 의 개인 표), 결과 공개의 `ballots` part, 결과 타임라인의 지목·찬반 줄(`timelineView`·`DayDetail`·`TimelineStrip`, 지금도 안 그려짐)을 지운다. `day.points` 는 지목 단계 동안만 화면(차례 연출)에 싣고 단계가 끝나면 비운다. 서버의 `voteLog` 는 판정·종료 요약에 필요한 최소(그날 처형자·처형 없음 이유)만 남긴다. 처형 연출(판결 순간·처형 핀·확대·소리)은 `day.ballots` 대신 처형자 존재로 켠다(조사 위험 5).

### 유언 통일 (0089-19)
- D-15: 최후 변론 단계를 지우고 `defense` id 를 **유언 단계**로 쓴다. 처형자에게 스포트라이트(지금 처형 핀·`trial` 조명을 이 단계로 앞당김)가 비치고 10초 동안 유언을 쓰거나 고친다 — 미리 써 둔 유언이 채워진 채 시작, 50자소 그대로. 다 쓰고 [남기기]를 누르거나 10초가 끝나면 그 글이 모두에게 큰 글로 보이고(`emitDeathCards` 의 유언 카드) 처형으로 넘어간다. 빈 글이면 "말없이 떠났다"(문구는 UI-SPEC).
- D-16: 처형자는 유언 단계 동안 아직 살아 있는 사람이라 `saveWill` 이 이 단계에서도 그 사람의 글을 받는다(다른 사람은 이 단계에 유언을 못 바꾼다). 다른 사람은 채팅을 할 수 없고 지켜본다(조용한 순간).
- D-17: 밤 피해자는 살아 있을 때 미리 쓴 유언이 아침에 같은 생김새(편지 `WillLetter`)로 보인다 — 지금 그대로. 죽은 뒤에는 쓰지 않는다(유령 관전 정보 누설 방지).
- D-18: 봇이 처형되면 지금 `BOT_DEFENSE_LINES` 를 유언 대사로 쓴다.

### 시상 제거 (0089-20)
- D-19: `shared/game/awards.ts`·`stats.ts`·`Player.stats`·`GameResult.awards`·`AWARD_IDS` 와 소리(`award.*`·`awardScript`·`plateCues`·`RESULT_PLATE_KEY`·`step:"plate"`)·사운드랩 항목·시험·helper·E2E 판정(R4/R6 의 award 판정은 지운다)을 지운다.

### 유령 (0089-17)
- D-20: 유령 모형(`sprite.root`) 배율 0.75, 유령 `headY` 도 0.75 배. `GHOST_ART_H`(산 사람 이름표 높이에도 쓰임)는 바꾸지 않는다(조사 위험 8).
- D-21: `sprite.root.rotation.y = CAM_YAW - root.rotation.y` 역회전을 지워 산 캐릭터처럼 이동 방향을 본다. `character.test.ts` 의 "유령은 CAM_YAW 를 본다" 시험을 새 규칙으로 바꾼다. 결정 0084-3 을 개정한다.

### 문서·검증
- D-22: `docs/product.md` 진행 흐름 표·소통·정치 장치 문단을 새 흐름으로 고쳐 쓴다(오래된 빠른 메시지·직업 공개 문단 정리). `docs/architecture.md`·`docs/screen-map.md` 의 확장판·마을 항목을 지운다. 지운 결정(0074·0078·0080·0081·0086·0087·0088)과 개정(0063-1·0066-3·0072-2·3·0084-3)에 "0089 로 폐기/개정" 표시를 붙인다.
- D-23: 사회자 문구(`hostLine`)는 새 순서에 맞춘다: 찬반 "오늘 처형할까요?", 지목 "차례대로 한 명을 골라요", 유언 "마지막 한마디". 글 최소(결정 0051).
- D-24: 검증은 단위·worker·client 시험 전체 통과, 누설 검사 통과, **바뀐 흐름만 로컬 E2E**(기본 한 판 완주·찬반 부결·동점·유언·유령 크기/방향). 폰 6종 전체 회귀와 배포는 24 끝에 한 번(0089-25).

### Claude's Discretion
- 지우는 순서·계획 나누기(서버 규칙 → 화면 → 시험 → 문서), 남는 코드의 이름 정리, 죽은 코드 판단은 계획자가 정한다. 큰 삭제는 컴파일러가 잡지 못하는 Set·문자열 비교(`"errand"` 등)를 grep 으로 확인한다.

### Deferred Ideas (OUT OF SCOPE)
- 첫날 키워드 문제, D1 판 기록 → 23
- 의심 포스트잇, 새 튜토리얼 → 24
- 시상(억울상 등)은 필요해지면 나중에
</user_constraints>

<phase_requirements>
## Phase Requirements

요구사항 ID 가 주어지지 않았다(ROADMAP `**Requirements**: TBD`). 아래는 ROADMAP Phase 22 의 성공 기준 6개를 ID 대신 쓴다. `## Validation Architecture` 가 이 번호로 시험을 묶는다.

| ID | Description | Research Support |
|----|-------------|------------------|
| SC1 | 방장 줄에 판 종류 단추·시트가 없고, 모든 판이 한 가지 흐름으로 돈다 | 삭제 순서 5단계, `RULES` 단일 상수, normalizeStoredRoom 재설정 |
| SC2 | 확장판 기능 9가지가 코드·화면에서 제거되고 흰 분필 윤곽은 남는다 | 삭제 순서 2~4단계, 컴파일러가 못 잡는 곳 점검 목록 |
| SC3 | 토론 → 찬반(집계만, 과반 찬성) → 차례 지목(기록 화면 없음) → 최다 득표 처형, 동점은 밤 | verdict-first 규칙표, pickTurn 켜기 |
| SC4 | 처형자 스포트라이트 10초 유언(미리 쓴 글로 시작) → 모두에게 보임 → 처형, 밤 피해자 유언 편지 유지, 최후 변론 없음 | 유언 단계 서버 규칙, 처형 시간표 |
| SC5 | 시상 없음, 유령 75% 크기·이동 방향 회전 | 시상 제거 슬라이스, 유령 슬라이스 |
| SC6 | 기획서·구조 문서가 새 흐름을 따르고 바뀐 흐름의 로컬 E2E·단위 시험·누설 검사 통과 | Validation Architecture |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

프로젝트 지침 중 이 페이즈 계획이 지켜야 하는 것(`/Users/dhkim1522/personal/minifia/CLAUDE.md`, `/Users/dhkim1522/personal/CLAUDE.md`).

- 게임 규칙·판정은 서버(방 Durable Object)가 정한다. 클라이언트는 받은 상태를 보여 주고 행동만 보낸다(결정 0002). **찬반 집계·유언 조기 종료·채팅 잠금 모두 서버가 판정**하고 화면은 따라간다.
- 다른 사람의 역할은 살아 있는 사람에게 보내지 않는다(탈락자 관전만 예외, 결정 0021). 화면에서 숨기는 것으로 대신하지 않는다. 새 view 키(찬반 집계, 처형 유언 글)는 모두 **역할과 무관한 공개 값**이어야 하고 누설 시험 허용 목록에 이유와 함께 추가한다.
- **화면은 글을 최소로, 보고 누르는 조작 중심(결정 0051).** 새 문구는 UI-SPEC 표의 것만 쓴다.
- 새 결정은 `docs/decisions/` 에 다음 번호로 파일을 추가한다(이 페이즈의 화면 계약·유령·흐름 결정 기록은 마지막 계획에서).
- 작업을 마칠 때마다 `HANDOFF.md` 를 갱신하고 push 한다.
- 언어: GSD 산출물·응답은 한국어, 코드·명령·경로는 원문. 사람을 부르는 말은 '참가자'.
- **커밋 전 위생 검사**: 저장소 공통 지침(상위 폴더 CLAUDE.md 의 "원격 레포 위생")에 적힌 금지어 `git grep` 검사 결과가 비어야 한다(계정·환경 표현 금지). 이 RESEARCH.md 와 모든 계획 문서도 같다. 검사 패턴 문자열을 문서에 그대로 옮겨 적지 않는다(그 자체가 검사에 걸린다).
- 한 판 평균 10~15분은 참고 목표이지 제한이 아니다 → 처형 시간표를 늘려도(5.6→6.6초) 괜찮고, 연출을 줄이는 근거로 시간을 쓰지 않는다.
- E2E 는 바뀐 흐름만 돌리고 6종 전체 회귀는 24 끝에 한 번. 실기기 확인은 끝에 몰아서. 진행에 지장 없는 작은 화면 가장자리 문제는 고치지 않는다.
- 실행기 컨텍스트는 가볍게: 계획 문서는 "읽을 파일 목록 + 변경 규칙"으로 쓰고 큰 문서를 통째로 읽히지 않는다(이 문서의 표를 계획에 이월).
- 배포는 이 페이즈에 없다(24 끝에 한 번).

## Summary

이 페이즈는 신기술 조사가 아니라 **의존 방향을 지키며 지우는 일 + 낮 흐름 한 덩어리를 새 순서로 재배선하는 일**이다. 두 일은 성격이 다르다.

**삭제(SC1·SC2·SC5)** 의 핵심 위험은 "무엇을 지우나"가 아니라 "지우는 도중 `npm run typecheck` 와 시험이 계속 초록인가"다. 시험의 기본 판이 확장판(`DEFAULT_MODE = "extended"`)이고 시험 107개 파일이 `lockCause*` 를 쓰며, `typecheck` 스크립트가 `placeart:check`·`tokens:check` 까지 돌려서(package.json:14) 장소 그림 생성 스크립트를 지울 때 스크립트 항목도 같이 지워야 한다. 그래서 **의존을 거슬러 올라가며 지운다**: 튜토리얼(모든 확장판 부품을 쓰는 가장 바깥) → 원인 흐름·마을 → 심부름·목격·흔적 → 판 종류 → (새 흐름). 판 종류를 가장 늦게 지우는 이유는, 그 전까지 확장판 하나만 지워도 두 판이 같은 규칙 객체를 나눠 쓰기 때문에 "한 번에 한 기능" 삭제가 가능해서다.

**재배선(SC3·SC4)** 의 핵심은 세 가지다. (1) 찬반이 후보 없이 앞으로 오므로 `verdict.ts` 의 유권자·판정·voteLog 줄 생성 위치가 바뀐다. 판정식 `찬성×2 > 던진 표` 는 던진 표 = 찬성+반대이므로 **`찬성 > 반대` 와 동치**다(동수는 부결, 0표도 부결) — 시험은 이 동치를 경계값으로 고정하면 된다. (2) `pickTurn` 을 켜면 이미 있던 순차 지목 코드가 되살아나지만, **`resolveNomination` 이 `verdict: { passed: false, candidate }` 로 덮어써서 `enterExecution` 이 처형을 건너뛰는** 함정이 있고(`verdict.passed === true` 가 필요), 누설 시험의 "기본판 꺼진 장치 0건" 구역이 `politicsOn()` 때문에 **조용히 통째로 skip** 된다. (3) 유언 단계는 `defense` id 를 재사용하되 서버 규칙 네 곳이 바뀐다: `saveWill` 의 단계·행위자 조건(처형자만), [남기기] 조기 종료(와이어 `will` 메시지에 선택 필드, 500ms 간격 검사를 우회), 채팅 잠금(`channelOf`), 처형 시간표(`EXECUTION_MS` 6.6초가 핀·줌·소리·알림·스크립트에 흩어진 상수와 함께 움직임).

**유령(SC5)** 은 독립이다: `character.ts:1074` 한 줄 삭제 + 배율/`headY` 0.75 + `__mfGhosts` 에 `scale`·`facing`.

**Primary recommendation:** 10개 계획을 9개 웨이브로 직렬(유령·시상만 병렬)로 돌린다 — 22-01 유령 / 22-02 시상 / 22-03 튜토리얼 / 22-04 원인 흐름+마을 / 22-05 심부름+목격+흔적 / 22-06 판 종류+단일 RULES+시험 장치 / 22-07 서버 낮 순서(찬반→지목) / 22-08 서버 유언·처형 시간표 / 22-09 화면 낮 흐름 / 22-10 E2E·누설·문서. 삭제 계획 사이에는 시험 도우미를 **no-op 껍데기**(`lockCause*`·`lockModeMaps`)로 임시 유지해 계획당 변경 범위를 묶고, 22-06 에서 한 번에 호출부를 걷는다.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 찬반 판정·집계 | API/Backend (`shared/game/verdict.ts` + worker) | Browser(숫자 줄 표시) | 규칙은 서버(0002). 개인 표는 서버 전용, 공개는 집계 수만 |
| 순차 지목 차례·집계 | API/Backend (`nomination.ts`) | Browser(`PickTurnBlock`, 핀) | 차례 마감·기권은 서버 시각 |
| 유언 저장·조기 종료·잠금 | API/Backend (`will.ts`, worker `applyWill`) | Browser(`WillSheet` 자동 열림·자동 전송) | 처형자만 쓰기, [남기기]=단계 마감 당김은 서버 판정 |
| 처형 연출 켜기 | Browser(`pinPlan`·`useVerdictMoment`·audio) | API(`day.candidate`·`day.execution` 공개 값) | 연출은 화면, 키는 공개 값(존재만 읽음, P22-14) |
| 처형 시간표 길이 | API(`EXECUTION_MS`) | Browser·audio(같은 표를 import) | 한 표에서 계산해야 어긋나지 않음 |
| 저장 방 정규화(옛 방 → 대기실) | API/Database(DO 저장소, `normalizeStoredRoom`) | — | 서버 저장 형식 변경 |
| 맵 선택 | API(`pickMap`) | Browser(`Lobby`·`ResultScreen` 방장 줄) | 변경 없음, town 만 빠짐 |
| 유령 크기·방향 | Browser(`character.ts`, three.js) | — | 순수 화면 |
| 시험 장치 기본 판 | 시험 인프라(`test/helpers/playable.ts`, setup) | — | 기본 판 = 단일 규칙 |

## Standard Stack

새 라이브러리를 설치하지 않는다. 기존 스택을 그대로 쓴다.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react / react-dom | 19.3.1 | 화면 | `package.json` dependencies [VERIFIED: package.json:25-28 — `"react": "19.3.1"`] |
| three | 0.186.1 | 3D 월드(유령 모형) | [VERIFIED: package.json — `"three": "0.186.1"`] |
| zod | 4.6.7 | 서버 입력 스키마 | 와이어 `will` 메시지 변경에 쓴다 [VERIFIED: package.json — `"zod": "4.6.7"`] |
| vitest | 4.1.12 | 단위·worker·client 시험 | [VERIFIED: 이 세션 `npx vitest run` 출력 "RUN  v4.1.12"] |

### Supporting
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| Node | v26.13.0 | 스크립트·시험 | [VERIFIED: `node --version`] |
| `scripts/e2e/run.mjs` | 저장소 | 로컬 E2E(시스템 Chrome + playwright-core) | `npm run e2e -- --url http://localhost:5173 --only <id>` [VERIFIED: scripts/e2e/run.mjs:2 사용법 주석] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 조기 종료용 새 메시지 `willDone` | 기존 `will` 메시지에 선택 필드 `final?: true` | 새 메시지는 스키마·타입·핸들러 분기를 늘린다. 필드 하나가 더 작다(권장) |
| 유언 공개 글을 채팅 카드로만 | `day.execution.will` 로도 싣기 | 카드는 빈 유언에서 도착하지 않아 "말없이 떠났어요"를 화면이 구별 못 함. 권장은 view 값 추가(아래 Pattern 6) |

**Installation:** 없음.

**Version verification:** 설치할 패키지가 없어 레지스트리 조회를 하지 않았다. 위 버전은 `package.json` 과 이 세션의 실행 출력에서 읽었다.

## Package Legitimacy Audit

이 페이즈는 외부 패키지를 설치하지 않는다 → 감사 대상 없음. (`npm install` 이 계획에 들어가면 안 된다. 들어가면 계획자가 `package-legitimacy check` 를 먼저 돌린다.)

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (없음) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### 낮 흐름 데이터 흐름 (새 순서)

```
discussion(90s, 과반 끝내기)
   │ tick 마감
   ▼
verdict(10s)  ── 입력: {t:"verdict",agree} 산 사람 전원, 마감 전 번복
   │   서버: verdictVote 저장 → 변할 때마다 day.verdictCount{yes,no} 를 전원 방송
   │ 마감 훅 resolveVerdict: 통과 = 찬성 > 반대 (= 찬성×2 > 던진 표)
   ├─ 부결/0표 ──▶ voteLog 줄 {n, exec:{yes,no,passed:false}} ──▶ night  (처형 없음 알림은 night 의 noExecution)
   ▼ 통과: verdict = {passed:true}
nomination(모이기 3s + 산 사람 수 × (8s+0.9s) + 끝 알림 2s)
   │   enterNomination → pickTurn{order,i:-1}; stepNomination 이 stay 사슬; castTurnPoint = 차례 주인만
   │   마감 훅 끝 알림 뒤 resolveNomination: 최다 정확히 한 명 → verdict.candidate, 동점/0표 → night
   ├─ 동점/0표 ─▶ night
   ▼ 한 명
defense(=유언, 10s, 핀 fixed 처형자 + trial 조명)
   │   처형자만 saveWill 가능, 다른 사람 채팅 잠금(channelOf null), [남기기] = will{text,final:true} → 서버가 phaseEndsAt=now 로 tick
   │   afterTransition: enterExecution 이 alive=false → emitDeathCards 가 will 카드
   ▼
execution(6.6s): 0~3.0 유언 카드(QuoteCard) → 3.0~6.0 "님 처형"+유령 올라옴 → 6.0~6.6 핀 끔
   │ 마감 훅 routeAfterExecution(승패) ─▶ ended | night
   ▼
night
```

핵심 표 값(소스 확인):
- 지금의 단계 표 `discussion.next = "nomination"`, `defense.next = "verdict"`, `verdict.next = "execution"`, `nomination.next = "defense"` [VERIFIED: shared/game/phases.ts:86-87,94,97 — `discussion: ... next: "nomination"`, `defense: ... next: "verdict"`, `nomination: ... next: "defense"`, `verdict: ... next: "execution"`]. 새 표는 `discussion→verdict`, `verdict→nomination`, `nomination→defense`, `defense→execution`, `execution→night`.
- `DEFENSE_MS = 20_000`(phases.ts:35) → 10_000, `EXECUTION_MS = 5_000 + VERDICT_LEAD_MS`(phases.ts:38, `VERDICT_LEAD_MS = 600` 37행) → 6_600 [VERIFIED: phases.ts:35-38].
- 순차 지목 길이: `NOMINATION_GATHER_MS`·`PICK_TURN_MS=8_000`·`PICK_GAP_MS=900`·`NOMINATION_END_MS=2_000`, 최악 `nominationMaxMs(8) = 76200ms`(phases.ts 주석) [VERIFIED: phases.ts:41-50].

### Recommended Project Structure
구조 변경 없음. 삭제만 있고 새 파일은 최소(시험 파일·결정 기록 문서). 새 코드 파일을 만든다면 `shared/game/` 안 기존 모듈에 합친다.

### Pattern 1: 삭제는 의존을 거슬러 올라간다 (importers first)
**What:** 지우려는 모듈 M 을 가져다 쓰는 파일(importer)을 먼저 정리하고 M 을 마지막에 지운다. 같은 계획 안 작업 순서도 이 규칙.
**When to use:** 모든 삭제 계획.
**근거:** 튜토리얼이 확장판 부품을 가장 많이 쓰는 importer 이므로(CONTEXT 위험 2) 가장 먼저, 판 종류(rules 가 모든 곳에 읽힘)가 가장 마지막 삭제 대상이다.

### Pattern 2: 시험 도우미 no-op 껍데기로 계획당 변경 묶기
**What:** `lockCause`·`lockCauseInFile`·`underCauseLock`·`lockModeMaps`·`openCause`·`openTown` 의 내용물만 비우고 export 는 유지(예: `lockCause = () => () => {}`, `underCauseLock = (body) => body`)해 두면, 그 기능을 지우는 계획(22-04)이 107개 파일의 import 줄을 건드리지 않는다. 호출부 제거는 22-06 에서 정규식 치환 한 번(`^import … playable.*$`·`lockCauseInFile\(\);` 줄 삭제)으로 한다.
**Why:** `lockCause*` 가 걸린 시험 파일이 107개(`grep -rlE "openCause|underCauseLock|lockCauseInFile|lockCause" test` = 107)이고 `openTown` 은 20개 파일이다 [VERIFIED: 이 세션 grep]. 한 계획에서 다 건드리면 diff 가 실행기 컨텍스트를 터뜨린다.

### Pattern 3: 판정식은 `찬성 > 반대`
**What:** D-11 의 `찬성×2 > 던진 표` 에서 던진 표 = 찬성 + 반대(미투표는 세지 않음)이므로 `2·yes > yes + no ⟺ yes > no`. 구현은 읽기 쉬운 쪽 하나로 쓰고 주석에 동치를 적는다.
**Example:**
```typescript
// shared/game/verdict.ts (새 모양 스케치 — 현재 코드는 verdict.ts:68-70 의 `const passed = yes * 2 > voters;`)
export function verdictVotersOf(state: RoomState): Player[] {
  return state.players.filter(isAlive); // 후보 제외 없음(D-11)
}
export function verdictTallyOf(state: RoomState): { yes: number; no: number } {
  let yes = 0, no = 0;
  for (const p of verdictVotersOf(state)) { if (p.verdictVote === true) yes += 1; else if (p.verdictVote === false) no += 1; }
  return { yes, no };
}
// resolveVerdict: const passed = yes * 2 > yes + no; // 던진 표의 과반 찬성 (= yes > no). 0표·동수는 부결
```
경계 시험: (찬성,반대) = (1,0)→통과, (1,1)→부결, (0,0)→부결, (4,3)→통과, (3,4)→부결, 8명 중 3명만 던져 (2,1)→통과(못 던진 사람은 분모에 없다 — 옛 "못 던진 표도 분모" 규칙과 반대, D-11 이 명시).

### Pattern 4: 단계 id 재사용 = 의미 이동을 표 한 곳과 소비자 grep 으로
`defense` 와 `verdict` 의 **의미**가 바뀌므로 id 로 분기하는 곳 전부가 의미 변경 대상이다. 컴파일러는 못 잡는다. 점검 목록(이 세션 grep 으로 확인한 것):
`src/world/presence.ts:111`(FIXED_PHASES) · `presence.ts:139-141`(lightingOf) · `presence.ts:174`(tensionOf verdict+candidate) · `src/game/dayView.ts`(titles, phaseEntry 286/307, headerFor 472/475) · `src/game/hostLine.ts:170-173` · `src/screens/GamePanel.tsx:124` · `src/screens/GameMap.tsx:589-590` · `src/screens/RoomScreen.tsx:140,563` · `src/audio/director.ts:54`(TICK_PHASES) · `shared/game/gather.ts:140-161`(layoutKey) · `shared/game/audience.ts:20`(CHAT_PHASES) · `shared/game/movement.ts:21`(MAP_PHASES) · `shared/game/bots.ts:216`(planned 목록) · `shared/game/view.ts:54,80,119`(DAY_PHASES·EVIDENCE_PHASES·candidate).

### Pattern 5: `gather.ts` 배치 규칙 변경
**What:** 지금 `layoutKey`: `defense`·`verdict` → `${day}:stage`, `nomination` → `${day}:ring`, `execution` → `${day}:exec`; 변론자는 무대(`STAGE_SPOT`)로, 통과 처형은 무대에 남는다 [VERIFIED: shared/game/gather.ts:141-161, 191-243]. 새 규칙: **`verdict` 는 `null`**(P22-3: 토론 장면 그대로·모이기는 지목부터 — 걷기는 `canMoveIn` 이 이미 막음), `nomination` 은 둘레 그대로, `defense`·`execution` 은 `${day}:stage`/`${day}:exec` 유지(처형자 = `state.verdict?.candidate`). `verdictPassed()`(163-169)는 처형 단계가 통과일 때만 존재하므로 **삭제** — `passed` 는 늘 참(통과면 무대 유지). `trial` 변수(`state.phase !== "nomination" && !== "discussion"`)는 `verdict` 가 이제 배치 단계가 아니므로 `defense`·`execution` 만으로 좁힌다. 기억 재사용 키 `memo.key.startsWith(`${day}:`)` 는 지목 둘레 자리를 유언·처형이 이어 쓰는 데 그대로 맞다.
**집(captureHome):** `worker/room.ts:1464-1477` `captureHomeNow` 는 "걷기 단계(dayAnnounce·errand·discussion)를 벗어난 첫 지도 단계" 에서 자리를 기억한다. 새 순서에서 그 첫 단계는 `verdict` 이고 걷기가 막혀 있어 같은 자리다 — 동작 동일. cause 분기(`houseHome`)만 지운다(D-06).

### Pattern 6: 처형 유언 글을 view 값으로 (권장)
`day.execution` 은 지금 `{ seat }` 뿐이다(view.ts:125-127, protocol.ts `ExecutionView { seat: number }`). 유언 카드(QuoteCard)가 처형 단계 0~3.0초에 보이려면 화면이 글을 알아야 하는데, 채팅 카드(`emitDeathCards` → `appendCard`)는 **빈 유언일 때 아예 오지 않고**(worker/room.ts:1435-1445 `if (will !== undefined && will !== "")`), 상태 프레임과 카드 프레임의 도착 순서가 보장되지 않는다. **권장:** 서버가 처형 단계 view 의 `day.execution` 에 `will?: string`(비어 있지 않을 때만)을 싣는다. 값은 이 순간 모두에게 공개되는 글이고(카드와 동일) 역할과 무관하다. 누설 허용 경로에 `.view.day.execution.will` 을 이유와 함께 추가. 재접속(처형 중 새로고침)에서도 같은 카드가 선다. 빈 글 → 키 없음 → 화면이 "말없이 떠났어요"를 그린다(P22-12).

### Pattern 7: 찬반 실시간 집계는 `day.verdictCount`
UI-SPEC P22-2/E2E 표식 `data-verdict-count`. **새 공개 키 이름은 서버 전용 이름 목록(SERVER_ONLY_KEYS)과 겹치지 않아야 한다**: 그 목록에 `"verdict"`·`"verdictVote"` 가 있고 `.view.day.verdict`·`.view.me.verdictVote` 만 허용 예외다 [VERIFIED: test/worker/leak.test.ts:119,125]. 따라서 `day.verdict`({yes,no,passed})를 재사용하지 말고 새 이름 `day.verdictCount?: { yes: number; no: number }`(verdict 단계에서만, 모두에게 같은 값)로 싣는다. 옛 `day.verdict`·`day.ballots`·`verdict.last` 는 삭제하고 `ALLOWED_WIRE_PATHS` 에서 `.view.day.verdict` 예외도 뺀다. `day.voted`(던진 좌석 목록, 값 없음)는 이름표 체크(`data-done`) 때문에 유지한다(UI-SPEC "기존 규칙").

**방송 규율 함정:** 지금 `applyVerdict` 는 "첫 투표만 전원 방송, 번복은 본인에게만"이다(worker/room.ts:939-965 주석·본문). 집계 수가 실시간 공개가 되면 **번복도 숫자를 바꾸므로 집계 수가 바뀌는 모든 투표는 `persistAndBroadcast`**. 같은 값 재전송은 같은 객체라 전송 없음(기존). `votedSeatsOf`+집계 수를 함께 공개하면 "아직 한 사람만 던졌을 때 그 사람의 표가 보이는" 추론이 가능하다 — D-11 이 감수한 것(집계 실시간 공개)의 귀결이므로 막지 않고 Open Question Q2 에 적었다.

### Pattern 8: 유언 단계 서버 규칙 네 가지
1. **`saveWill` (shared/game/will.ts:39-63)**: 지금 `MAP_PHASES` 단계(44행 `if (!MAP_PHASES.has(state.phase)) return { ok: false, error: "WRONG_PHASE" };`)에서 모든 산 사람이 쓸 수 있다. 추가: `state.phase === "defense" && actor.seat !== state.verdict?.candidate` → `WRONG_PHASE`(D-16: 다른 사람은 이 단계에 못 바꿈). 죽은 사람은 이미 `isAlive` 로 거절.
2. **조기 종료(`final`)**: `WillSendMessage { t:"will"; text }`·`WillMessageSchema`(strictObject) 에 `final?: true` 추가. `worker/room.ts` `applyWill`(820-835)에서 `final === true && room.phase === "defense" && 그 사람이 처형자`일 때: **WILL_MIN_GAP 검사를 건너뛰고**(자동 저장 직후 [남기기]가 `return null` 로 버려지는 함정) 글을 저장한 뒤 `applyEndDiscussion`(방 DO) 과 같은 길로 `this.room = tick({...room, phaseEndsAt: now}, now, cryptoRandInt); await this.afterTransition(prev, now);` — `afterTransition` 이 `captureHomeNow`·`persistAndBroadcast`·`syncPositions`·`emitDeathCards`·`reschedule` 을 모두 한다. 처형자 아니면 `final` 은 무시하고 일반 저장만(오류 응답 같게).
3. **시간 초과 시 쓰던 글**: 서버는 `will` 에 저장된 마지막 값을 쓴다. 클라이언트는 입력이 바뀔 때 **디바운스 자동 전송**(≥ 600ms, `WILL_MIN_GAP_MS = 500` 위; will.ts:13)과 마감 약 700ms 전 마지막 전송을 한다. 마지막 0.5초에 친 글자는 못 나갈 수 있다 — 허용(Open Question Q4).
4. **채팅 잠금**: `channelOf`(audience.ts:47-54)는 `CHAT_PHASES` 에 `defense` 가 있어 산 사람에게 `"all"`, 유령에게 `"ghost"` 를 준다. D-16·P22-9 는 모두 조용히 지켜본다 → `defense` 를 `CHAT_PHASES` 에서 빼거나 `channelOf` 가 defense 에서 `null` 을 주게 한다. 화면의 `aria-disabled` 입력줄만으로는 안 된다(서버 권위).

### Pattern 9: 처형자 존재로 연출 켜기 (P22-14, 위험 5)
지금 연출은 `day.ballots !== undefined && verdict.last !== true` 로 켜진다. 소비자(이 세션 grep): `src/net/useVerdictMoment.ts:28` · `src/world/pinPlan.ts:44-51`(`executionPin`) · `src/audio/audioView.ts:50,87`(`hasBallots`)와 `AUDIO_VIEW_FIELDS`(59행) · `src/audio/director.ts:208-216`(판결 대본, T0 = endsAt − `EXECUTION_MS`) · `src/audio/script.ts:89-115`(`verdictScript`) · `src/game/hostLine.ts:~176`(`day.verdict?.passed` → `execution.passed/failed`) · `src/game/dayView.ts:310-334`(처형 알림이 `day.verdict` 의 tally·passed 를 읽음) · `view.ts:128-139`(day.verdict·day.ballots 생성) · `worker/room.ts:1390-1398`(`emitBallotsCard`) · `ChatLines.tsx:14`·`BallotReveal`·`ballotsView.ts`·`timelineView.ts:126`. 새 키: 처형 단계에서 `day.execution !== undefined`(= 처형자 좌석), 유언 단계에서 `day.candidate`. 부결이면 처형 단계가 없으므로 켜질 일이 없다.

**처형 시간표는 한 표에서 계산한다.** 새 상수 후보(phases.ts 에 모은다): `WILL_REVEAL_MS = 3_000`(유언 카드), `EXEC_ANNOUNCE_MS = 3_000`(처형 큰 글), `EXEC_TAIL_MS = 600`(핀 끔) → `EXECUTION_MS = 6_600`, `PIN_OFF_EXEC_AT = EXECUTION_MS - EXEC_TAIL_MS = 6_000`(pinPlan.ts:20 은 현재 `5000`). 같이 움직이는 곳: `pinPlan.ts:19-20`(`PIN_OFF_NO_EXEC_AT = 4000` 은 부결 처형 단계가 없어져 삭제) · `verdictMoment.ts`(`BALLOT_YES_AT/NO_AT/END_AT`·`yes/no/end` 필드 삭제, `darken`/`zoom`/`pin` 시각을 새 창으로) · `dayView.ts:92-104`(`ANNOUNCE_LEAD_MS`·`ANNOUNCE_TALLY_MS`·`ANNOUNCE_EXEC_MS`·`ANNOUNCE_NOEXEC_MS`) · `audio/script.ts`(`HEART_AT`·`verdictScript` 의 announceAt 2600 → 3000, `ballot.*` 항목 삭제) · `scripts/smoke.mjs:49,64`(`DEFENSE_MS = 20_000`, `EXECUTION_MS = 5_600` 사본) · `test/unit/e2eContract.test.ts`(사본 대조) · 단위 시험 `verdictMoment`·`soundVerdict`("마지막 소리의 시각 + 길이가 EXECUTION_MS 안")·`soundScript`·`dayView`("처형 단계 길이 안")·`testTools`(`defense → verdict … execution` 단계 사슬 단언, 641행).

### Pattern 10: 핀은 유언 단계에서 `turn`, 처형 단계에서 `fixed`
조기 종료로 `phaseEndsAt` 이 앞당겨지므로 유언 단계의 `fixed` 창을 `phaseEndsAt − DEFENSE_MS` 로 계산하면 시작이 어긋난다. 유언 단계는 `{ mode: "turn", seat: candidate }`(늘 켜짐)로, 처형 단계는 기존 `fixed`(`startAt = phaseEndsAt − EXECUTION_MS`, `endAt = startAt + PIN_OFF_EXEC_AT`; 처형 단계 길이는 고정이라 안전)로 두면 경계에서 `pinLevel` 이 끊기지 않는다. `pinOf`(pinPlan.ts:62-78)에 `defense` 분기를 더한다. 조명은 `lightingOf` 가 이미 `defense`·`execution` → `trial` 이고(presence.ts:141-143), 지목은 `vote` 라 지목→유언 전환이 곧 "스포트라이트로 전환" 이다(추가 작업 없음). 줌(`cameraModeOf`)은 `execution` 에서만 유지(P22-10) — 현행 그대로.

### Anti-Patterns to Avoid
- **`resolveNomination` 이 `passed:false` 로 덮는 것을 방치**: 아래 Pitfall 1.
- **두 판이 공존하는 중간 단계에서 `RULES` 를 만들지 않기**: 22-06 전에는 `rulesetOf(mode)` 가 두 판 값을 계속 준다. `RULES` 단일 상수는 22-06 에서 만들고 `rulesetOf(modeOf(x))` 호출부 전체를 치환한다(src/shared/worker 약 50개 파일 + test 48개 파일).
- **유령 `GHOST_ART_H` 상수를 바꾸기**: 산 사람 이름표에도 쓰임(character.ts:783, 1118). `update` 의 유령 분기 반환값에만 0.75 를 곱한다.
- **단계 id 를 새로 만들기**: D-10 금지. `verdict`·`defense` 의미만 바꾼다.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 순차 지목 | 새 지목 로직 | 기존 `enterNomination`·`stepNomination`·`castTurnPoint`·`turnViewOf`(nomination.ts:133-233), `PickTurnBlock`, `useTurnLook`, `pinPlan` slide | 켜기만 하면 된다. 이미 시험(worker `pickTurn.test.ts`)과 E2E(`politics-pin`)가 있다 |
| 조기 단계 종료 | 새 타이머·알람 | `applyEndDiscussion` 의 `tick({...state, phaseEndsAt: now}, now, cryptoRandInt)` + `afterTransition` | 토론 끝내기와 테스트 넘기기가 쓰는 검증된 길(worker/room.ts:~1000, 1335~1378) |
| 유언 카드 | 새 카드 컴포넌트 | `QuoteCard` + 수정자 `mv-quote--will`(UI-SPEC P22-11) | 인용 카드가 이미 "한마디 공개" 일을 한다 |
| 유언 입력 | 새 입력창 | `WillSheet`(+ prop `saveLabel`·`savedLabel`·`secondsLeft`), `useWill`, `useComposedText` | 한글 조합 저장·닫기 규칙이 이미 있다 |
| 찬반 투표 | 새 투표 UI | `VerdictPicker` 부품 그대로 | 변경 없음, 숫자 줄 내용만 |
| 시간 신호 색 | 새 긴박 색 | `timerTone`(5초 이하 `crimson-400`) | 기존 한 호출 |
| 옛 방 변환 | 단계별 마이그레이션 | `normalizeStoredRoom` 에 "대기실로 되돌림" 한 분기 | 출시 전이라 진행 중 판을 버려도 된다(D-03) |
| 이동 방향 | 새 회전 로직 | 산 캐릭터의 `travelYaw`·`stepYaw`(runtime.ts:1340-1356)가 `root.rotation.y` 를 이미 돌린다 | 유령은 역회전 한 줄만 지우면 자식이라 따라 돈다 |

**Key insight:** 이 페이즈의 새 로직은 거의 없다 — 켜기(pickTurn), 순서 바꾸기, 판정식 수정, 조건 한 줄(saveWill), 필드 한 개(`final`)가 전부이고, 나머지는 삭제다. 삭제에서 시간이 새므로 계획 쪼개기가 핵심.

## Runtime State Inventory

이 페이즈는 판 종류·확장판 필드가 저장된 방을 대기실로 되돌리는 마이그레이션을 포함한다(D-03). 다섯 범주를 모두 답한다.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Durable Object 저장소의 방 상태 `room`: `mode`, `map: "town"`, `phase: "errand"\|"tutorial"`, 개인 키(`errandPlaces`·`errandDone`·`errandNear`·`errandSeen`·`errandFake`·`errandCut`·`skipVote`·`sceneSeen`), 방 키(`errandTickAt`·`lamps`·`scene`·`errandLast`·`tutorialPassed`), `Player.stats`, `GameResult.awards` 는 저장되지 않음(종료 때 계산) [VERIFIED: shared/game/room.ts:192-217,250-251 선언 주석] | **코드 편집 + 정규화 분기**: `normalizeStoredRoom` 이 (a) `mode` 키 제거, (b) 게임 중(`lobby` 아님)이면서 `Object.hasOwn(stored,"mode")` 이거나 `map ∉ {bar,plaza}` 이거나 `phase ∈ {errand,tutorial}` 이면 **대기실로 되돌림**(`testTools.ts` 의 대기실 복귀 도우미와 같은 "키만 남기는" 방식 — 방 식별·수명·방장·가입 순번·앉은 사람·mapChoice·testMode·testRole·testBotVote 유지), (c) 죽은 개인·방 키 제거. 주의: **새 방은 `mode` 키가 없으므로** `mode` 유무만으로는 "옛 방" 을 구별하지 못한다 — 기본값이 extended 였으므로 `mode` 없는 옛 진행 방은 `map === "town"` 으로 잡힌다(확장판은 늘 마을이었음: maps.ts:57 `MODE_MAPS = { extended: "town" }`). 마을이 아닌 옛 basic/무모드 방(맵 bar·plaza)이 진행 중이면 **단계 순서(옛 nomination→defense→verdict)가 달라 새 코드가 어긋난다** → 계획자는 "게임 중인 방 전부 대기실로" 를 택하는 게 안전(출시 전이라 허용). 이 경우 새 필드를 두지 않고 `pickTurn`/`verdict` 상태 모양으로 판별하지 말고 단순하게 일괄 재설정 |
| Live service config | 없음 — 방은 DO 저장소 하나뿐이고 외부 서비스 설정에 판 종류·확장판 문자열이 없다(배포 이름 `minifia-v3` 는 변경 없음). 확인: `wrangler.jsonc` 에 mode/errand 없음을 계획자가 grep 으로 1회 확인 | 없음(확인만) |
| OS-registered state | 없음 — 이 프로젝트는 OS 등록 작업·서비스를 쓰지 않는다 | 없음 |
| Secrets/env vars | 없음 — 판 종류·확장판과 연관된 시크릿/환경변수 이름이 없다(배포 가드 `scripts/check-account.mjs` 는 계정 확인용) | 없음 |
| Build artifacts | `public/places/*`(장소 그림, `make-placeart` 산출물)·`src/world/placeArt*` 생성물, `public/characters`·`backgrounds` 는 유지. `package.json` 의 `placeart`·`placeart:check` 가 `typecheck` 체인에 걸림(package.json:14,20-21). `scripts/perf-run.mjs`·`scripts/uat-test-room.mjs`·`scripts/smoke.mjs` 의 확장판 경로 | **코드 편집**: 장소 그림 삭제 시 `placeart*` 스크립트 항목과 `typecheck` 체인을 **같은 계획에서** 고친다(그렇지 않으면 typecheck 가 실패). 생성 폰트/토큰(`tokens:check`)은 무관 |

**The canonical question:** 모든 파일을 고친 뒤에도 옛 키를 가진 방이 DO 저장소에 남는다 → 정규화가 깨지지 않게(옛 `map:"town"` 을 `MAPS[...]` 로 조회해 죽지 않게) **정규화가 맵·모드 조회보다 먼저** 돌아야 한다. DO 생성자에서 `normalizeStoredRoom` 을 부르는 위치는 worker/room.ts:141 [VERIFIED: grep `const normalized = normalizeStoredRoom(stored, Date.now())`] — `roomMapId`(maps.ts:65-67)가 `state.map ?? "bar"` 를 그대로 읽으므로 정규화 후에만 안전하다.

## Common Pitfalls

### Pitfall 1: 통과한 찬반이 지목 마감에서 `passed:false` 로 덮여 처형이 없어진다
**What goes wrong:** `resolveNomination` 이 `verdict: leader === undefined ? { passed: false } : { passed: false, candidate: leader }` 를 쓴다(nomination.ts:82-87). 새 순서에서는 찬반이 **먼저** 통과로 정해지는데 지목 마감이 `passed:false` 로 바꾸면 `enterExecution`(`state.verdict?.passed !== true` 이면 입력 그대로, execution.ts)이 아무도 탈락시키지 않는다. 시험은 "처형 단계가 왔는데 아무도 안 죽음" 으로 뜬다.
**How to avoid:** `resolveNomination` 이 기존 `state.verdict`(통과 표시)를 **보존**하고 `candidate` 만 더한다: `verdict: { passed: true, candidate: leader }`. 동점/0표면 `verdict` 키를 지우거나 `{passed:true}` 로 두고 `next: "night"`.
**Warning signs:** 워커 시험에서 `execution` 단계에서 `players.filter(alive)` 수가 그대로.

### Pitfall 2: 누설 시험 "기본판 꺼진 장치 키 0건" 구역이 조용히 통째로 skip 된다
**What goes wrong:** `describe.skipIf(politicsOn(GAME_RULES))`(leak.test.ts:~2007)가 "다섯 장치가 모두 꺼진 기본판에서만 뜻이 있다" 이고 `politicsOn`(ruleset.ts)은 `pickTurn` 을 포함한다. D-01 이 `pickTurn: true` 로 바꾸면 이 구역이 skip 되어 **badge·whisper·runoff·showdown 누설 점검이 사라진다**(초록인데 안 돈다).
**How to avoid:** 조건을 `badge||whisper||runoff||showdown` 의 켜짐(= 계속 false)으로 바꾸고, `OFF_KEY_PATHS`(leak.test.ts:2011-2020)에서 `.view.day.turn` 을 뺀다. `basicOff.test.ts`·`modeBasic` 류도 같은 `GAME_RULES = rulesetOf("extended")` 선언을 쓴다(test/worker/badge·basicOff·bots·emotePhases 등에서 확인) — 모두 `RULES` 로 치환. `ruleset.ts` 의 `politicsOn` 자체도 정의를 "순차 지목 제외 네 장치" 로 좁히거나 이름을 바꾼다.
**Warning signs:** 누설 시험 수가 줄어든 채 통과.

### Pitfall 3: 시험 기본 판이 바뀌면서 "errand 를 지나는" 시험이 일제히 어긋난다
**What goes wrong:** 지금 기본 방은 확장판이고 `startedGame` 이 `advanceTo(..., cause ? "errand" : "dayAnnounce")` 로 진입한다(test/worker/helpers.ts:729). 확장판 단계 사슬(`dayAnnounce → errand(40초) → discussion`)에 기대는 시험이 43(unit)+23(worker)+16(client)개 파일에서 "errand" 를 언급한다 [VERIFIED: 이 세션 grep -rlE "errand" test]. 
**How to avoid:** 22-05(심부름 제거)에서 도우미(`startedGame`·`lobbyOf`·`startedAt`)가 `dayAnnounce → discussion` 사슬을 쓰게 바꾸고, 사슬에 errand 가 있던 시험은 기능 시험이면 삭제, 부수 단계면 한 단계를 뺀다. `mode` 인자(`startedGame(phase, guests, mode?)`·`lobbyOf(n, mode?)`·`startedAt(..., mode?)`)는 22-06 에서 제거(그 전엔 `"basic"` 을 주던 호출이 그대로 돈다).

### Pitfall 4: 컴파일러가 못 잡는 문자열·집합
**점검 grep 목록(계획의 "확인" 단계에 그대로 넣는다):**
`grep -rnE '"errand"|\berrand' src shared worker scripts test` · `grep -rnE '"tutorial"|tutorialDone|Tutorial' src shared worker scripts test` · `grep -rnE '"basic"|"extended"|GAME_MODES|DEFAULT_MODE|modeOf|rulesetOf|view\.mode|\.mode\b' src shared worker scripts test` · `grep -rnE 'rules\.(errand|cause|trace|witness)|\.cause\b|\.errand\b|\.trace\b|\.witness\b' …` · `grep -rnE 'town|houseFronts|PLAZA_SPAWNS|zone' …` · `grep -rnE 'lamp|clue|scene\b|skip(Vote|Count)|inspect' …` · `grep -rnE 'data-(errand|house-tag|clue|skip|board|record|mode|tutorial)' src test scripts` · CSS: `evidence.css` 등 선택자와 `@import` · 집합 리터럴: `DAY_PHASES`·`EVIDENCE_PHASES`(view.ts:54,80) `MAP_PHASES`(movement.ts:21) `CHAT_PHASES`(audience.ts:20) `FIXED_PHASES`(presence.ts:111) `TICK_PHASES`(director.ts:54) `planned`(bots.ts:216) `TIMELESS_PHASES`(scenes.ts) · `AUDIO_VIEW_FIELDS`(audioView.ts:59) · 소리 표 `SOUND_IDS`·`soundLabTable.ts`·`soundLab.ts`(tut.*·award.*·ballot.* 항목) · `hostLine.ts` 키 목록(errand.*·scene.*·discussion.board·witness·trace·night.*.house) · `e2eContract.test.ts` 의 import 목록(errand·mapTown·ErrandAct·town 등 삭제 대상을 직접 import — 삭제 계획마다 이 파일을 같이 고친다).

### Pitfall 5: `typecheck` 체인의 부수 검사
`npm run typecheck` = `tokens:check && placeart:check && wrangler types && tsc app && tsc worker`(package.json:14). `placeart:check` 는 장소 그림 목록을 대조한다 → 장소 삭제(22-05)와 스크립트 삭제가 한 계획이어야 한다. `wrangler types` 는 `worker-configuration.d.ts` 를 갱신하는데 변경 없음. `tsc` 가 `scripts/*.mjs` 를 포함하지 않으므로(`scripts/tsc-scoped.mjs` 존재) E2E 삭제 누락은 typecheck 가 못 잡는다 → `node --test scripts/e2e/*.test.mjs` 와 `--only` 실행으로 별도 확인.

### Pitfall 6: 봇 시드·호출 순서
`planFor` 는 `randInt` 호출 순서가 계약이다(bots.ts 주석 11-39행). 새 흐름: 찬반은 **후보 없이 모든 산 봇**이 `randInt(100)`→`randInt(5000)`(VERDICT_BASE 1000 + SPAN 5000; bots.ts:73-74), 지목은 `pickTurn` 이라 `turnPointSteps`(차례 봇만 `randInt(후보 수)` 1번), 유언은 처형자 봇이 `randInt(3)`→`randInt(4000)` 후 **채팅 대신 `{t:"will", text}`**(D-18, `DEFENSE_SAY_BASE_MS = 1_000`·`DEFENSE_SAY_SPAN_MS = 4_000` 이므로 유언 단계 10초 안에 든다 [VERIFIED: bots.ts:85-86]). 난수 호출 **수·순서를 바꾸지 않으면** 시드 고정 시험 값이 덜 흔들린다(채팅→will 행위 종류만 바꿈). 찬반 후보 제외 `state.verdict?.candidate !== bot.seat` 분기는 삭제. `botPlanKey` 의 `planned` 목록은 errand 제거 + defense 유지.

### Pitfall 7: `noExecution` 이유와 밤 도착 알림
`noExecutionOf`(execution.ts)는 voteLog `cand` 로 `tie`·`noVotes` 를 파생한다. 새 흐름에서 처형 없음 경로는 셋: 찬반 부결(→ night), 지목 동점(→ night), 지목 0표(→ night). 모두 **밤으로** 오므로 `noExecutionOf` 는 `night` 단계에서 voteLog 줄(`exec.passed === false` 이면 `"rejected"`, `passed` 인데 `cand.candidate` 가 없으면 `votes` 유무로 `tie`/`noVotes`)에서 파생한다. 이유 코드 유니온(protocol.ts `NoExecutionReason = "tie" | "noVotes"`)에 `"rejected"` 를 더한다(또는 화면이 이유를 안 쓰므로 하나로 합쳐도 되지만 voteLog·요약이 이유를 쓰므로 3값 권장). 화면 `dayView.ts:335-345` 는 `prev.phase` 가 `nomination|runoff|showdown` 일 때만 알림을 낸다 → `verdict` 를 추가(찬반 부결은 verdict 에서 바로 night).

### Pitfall 8: 유언 시트 자동 열림과 `useWill`
지금 `useWill` 은 `[유언]` 단추로 열고 `[저장]` 시 즉시 닫는다(src/net/useWill.ts 주석 "저장 뒤: 유언은 [저장]을 누르면 보내고 곧바로 창이 닫힌다"). 필요한 변경: 처형자(`candidate === me.seat`) + `defense` 에서 **자동 열기** 효과, `[남기기]` = `save` + `final:true`, 시간 초과 직전 자동 전송, `[닫기]` 는 글 저장 + 시트만 접기(`close`). `willAllowed = meAlive && MAP_PHASES.has(view.phase)` 는 defense 에서 처형자만 참이 되게 좁힌다(서버 조건과 일치, 그렇지 않으면 다른 사람이 [유언]을 눌러 서버에서 `WRONG_PHASE`). 아래 패널은 처형자에게 시트가 대신하고, 나머지는 채팅 입력줄 비활성(`data-chat-locked`).

### Pitfall 9: `day.candidate` 단계 목록
view.ts:119-124 는 `defense|verdict|execution` 에서 후보를 싣는다. 새 흐름에서 `verdict` 는 후보가 없고(실리지 않음), 후보는 `defense`·`execution` 에서만 있다. `presence.ts:174` `tensionOf` 의 `verdict` 분기(후보 초점 긴장 1)는 후보가 없으므로 죽은 분기 → `defense`(처형자 초점) 로 옮기거나 삭제(UI-SPEC 은 긴장 새 값을 두지 않음 → 삭제 권장).

### Pitfall 10: 유령 시험·E2E 훅
`test/unit/character.test.ts:807-820` 의 두 시험("유령일 때 headY 는 … 2.45 * CHAR_SCALE", "…유령은 카메라(CAM_YAW)를 본다")를 새 규칙으로: headY = `GHOST_ART_H * CHAR_SCALE * 0.75`, 회전은 `setYaw(y)` 후 `ghostOf(root).rotation.y` 가 0(자식은 부모 회전을 따름) 또는 `root.rotation.y` 가 yaw 그대로. `window.__mfGhosts` 는 지금 `{ seats: number[]; ready: boolean }`(testHooks.ts:38) — UI-SPEC 의 `scale`·`facing` 은 **새 필드**다: 런타임(`runtime.ts`)이 유령 좌석별 `yaw` 를 훅 갱신 함수로 넘겨야 한다(WorldStage.tsx:521 이 훅 갱신을 호출). 직업·의상은 싣지 않는다.

## Code Examples

### 유령 수정 (character.ts)
```typescript
// 현재 [VERIFIED: src/world/character.ts:1073-1075]
//   sprite.update(t);
//   sprite.root.rotation.y = CAM_YAW - root.rotation.y; // 늘 카메라를 본다
//   return { headY: GHOST_ART_H * CHAR_SCALE };
// 새 모양:
const GHOST_SCALE = 0.75; // D-20, 결정 0089-17
// applyGhost() 에서 sprite 를 만든 직후: sprite.root.scale.setScalar(GHOST_SCALE);
// update(): 역회전 줄 삭제(자식이라 root.rotation.y 를 그대로 따라 산 캐릭터처럼 돈다)
//   sprite.update(t);
//   return { headY: GHOST_ART_H * CHAR_SCALE * GHOST_SCALE };
// GHOST_ART_H (character.ts:783 `const GHOST_ART_H = 2.45;`) 는 바꾸지 않는다 — 산 사람 이름표 높이에도 쓰인다(1118행).
```
유령 `CAM_YAW` import 가 character.ts 에서 다른 용도로 남는지 확인 후 미사용이면 import 제거(`noUnusedLocals`).

### 처형자 판별과 연출 키 (pinPlan.ts)
```typescript
// 새 pinOf 에 defense 분기 + execution 분기를 후보 존재로 (현재 executionPin: pinPlan.ts:44-51)
function condemnedPin(view: RoomView): PinDesc | null {
  const seat = view.day?.candidate; // defense·execution 에서만 실림, 값만 읽는다(P22-14)
  if (typeof seat !== "number") return null;
  if (view.phase === "defense") return { mode: "turn", seat };
  if (view.phase === "execution" && view.phaseEndsAt !== null) {
    const startAt = view.phaseEndsAt - EXECUTION_MS;
    return { mode: "fixed", seat, startAt, endAt: startAt + PIN_OFF_EXEC_AT };
  }
  return null;
}
```

### 방 DO 의 [남기기] 조기 종료 (worker/room.ts, 스케치)
```typescript
// applyWill 앞머리 — 간격 검사보다 먼저 final 을 처리한다(자동 저장 직후 [남기기]가 버려지지 않게)
private async applyWillFinal(playerId: string, text: string, now: number): Promise<WsErrorCode | null> {
  if (!this.room) return "BAD_MESSAGE";
  const saved = saveWill(this.room, playerId, text); // defense 에서는 처형자만 ok (Pattern 8-1)
  if (!saved.ok) return saved.error;
  const prev = this.room;
  const actor = prev.players.find((p) => p.id === playerId);
  if (prev.phase !== "defense" || actor?.seat !== prev.verdict?.candidate) { /* 일반 저장 경로로 */ }
  this.room = tick({ ...saved.state, phaseEndsAt: now }, now, cryptoRandInt);
  await this.afterTransition(prev, now); // captureHome·방송·위치·사망 카드(유언)·알람까지
  return null;
}
```

### 가장 작은 누설 시험 갱신 (leak.test.ts)
```typescript
// SERVER_ONLY_KEYS 는 그대로("verdict"·"verdictVote"·"nominate" 포함). 허용 예외에서 .view.day.verdict 를 뺀다.
const ALLOWED_WIRE_PATHS: ReadonlySet<string> = new Set([".view.me.verdictVote"]);
// 새 공개 경로 두 개를 이유와 함께: .view.day.verdictCount(.yes·.no, verdict 단계, 모두 같음), .view.day.execution.will(execution 단계, 모두 같음)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 지목(15s 동시) → 변론(20s) → 찬반(10s, 변론자 제외) → 처형(5.6s) | 찬반(10s, 후보 없음) → 순차 지목 → 유언(10s) → 처형(6.6s) | 0089-18·19 (이 페이즈) | 단계 표 `next`·tick 훅·`resolveNomination`·view·화면 전부 |
| 판 종류 2개(basic·extended) + 원인 흐름(cause) | 단일 `RULES` | 0089-12 | `rulesetOf(modeOf(x))` 호출부 전부 치환 |
| 시상 칭호(서버 계산) | 없음 | 0089-20 | `computeAwards`·`stats.ts` 삭제 |
| 유령 늘 카메라 응시, 크기 100% | 이동 방향 응시, 75% | 0089-17 | character.ts 한 줄 + 배율 |

**Deprecated/outdated:** 결정 0074·0078·0080·0081·0086·0087·0088 폐기, 0063-1·0066-3·0072-2·3·0084-3 개정(D-22 가 문서에 표시). `shared/game/ballots.ts`(찬반 기록 카드 본문 형식)·`runoff`/`showdown` 의 voteLog `votes` 필드는 D-14 에 따라 정리 대상.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `voteLog` 의 `cand.votes`(누가 누구를 골랐는지)를 서버에서도 저장하지 않아도 된다 — 0089-18 의 "각자 기억한다" 는 서버 기록이 아니라 사람이 기억한다는 뜻 | Pattern 7 / voteLog | 사용자 의도가 "서버가 기억해 둠"이면 D1 판 기록(23)에서 필요. 저장만 두고 view 에 안 싣는 선택이 되돌리기 쉬움 → Open Question Q1 |
| A2 | `final` 플래그를 기존 `will` 메시지에 두는 설계 | Pattern 8 | 스키마 선택 문제일 뿐. 새 메시지로 바꿔도 동일 규칙 |
| A3 | 클라이언트 디바운스 자동 전송(≥600ms) + 마감 700ms 전 마지막 전송이 "시간 초과 시 쓰던 글이 나간다"를 충분히 만족 | Pattern 8-3 | 마지막 약 0.5초 입력 손실 가능 → UI-SPEC 의 "자동 제출" 의도와 약간 차이 (Open Question Q4) |
| A4 | 처형 시간표 세부(`WILL_REVEAL_MS`·`EXEC_ANNOUNCE_MS`·`EXEC_TAIL_MS` 이름·`PIN_OFF_EXEC_AT = 6000`) | Pattern 9 | UI-SPEC P22-13 이 "계획이 정확한 상수를 정한다" 라고 위임. 합 6.6초만 지키면 됨 |
| A5 | `tensionOf` verdict 분기는 새 흐름에서 죽은 코드라 삭제 | Pitfall 9 | UI-SPEC 에 새 긴장 값이 없다는 해석. 긴장 연출을 유지하고 싶으면 defense 로 이동 |
| A6 | 게임 중인 옛 방은 전부 대기실로 되돌린다(`mode` 유무로 구별 불가) | Runtime State Inventory | 사용자가 진행 중 방을 살리고 싶다면 불가능(단계 순서가 달라짐). 출시 전이라 D-03 이 허용 |
| A7 | 로컬 단위 시험 전체 시간은 수 분 수준(시험 파일 156+99+72=327개) | Validation | 정확한 소요는 계획 실행 전에 한 번 `npm test` 로 잰다(이 세션에서 일부만 실행: 3개 파일 257ms) |

## Open Questions

1. **서버가 "누가 누구를 골랐는지"를 voteLog 에 남겨 두는가?**
   - What we know: D-14 는 "voteLog 는 판정·종료 요약에 필요한 최소(그날 처형자·처형 없음 이유)만". 0089-18 원문 "고르는 순간은 모두 보지만 기록으로 남기지 않는다 — 각자 기억한다". 사용자 말 "알아서 기억해 두기"는 모호.
   - What's unclear: 23 의 D1 판 기록이 지목 이력을 쓰는가(0089-21 열 목록에는 없음 → 안 씀).
   - Recommendation: **D-14 대로 `cand.votes` 를 저장·공개 모두에서 삭제**(`VoteLogEntry.cand?: { candidate?: number }`, runoff.ts·showdown.ts 의 줄 쓰기와 `view.ts voteLogLine` 수정). `day.voteLog` 자체를 view 에서 빼면(소비자: dayView.ts:219·229·300, timelineView.ts:9·120, ResultPanel.tsx:54, GameMap.tsx:597 는 모두 지울 대상) 누설 표면이 더 줄어든다. 사용자가 서버 기억을 원하면 저장만 남기는 변경이 작다.

2. **찬반 집계 실시간 공개 + `day.voted`(던진 좌석)의 조합이 개인 표를 추론하게 하는가?**
   - What we know: D-11 이 집계 수 실시간 공개를 확정했다. `day.voted` 는 UI-SPEC 이 유지(`data-done`).
   - What's unclear: 첫 투표자 한 명이 던진 순간 (좌석=voted, 집계 +1) 로 그 사람의 표가 드러난다.
   - Recommendation: 막지 않는다(0051 담백, D-11 확정). 계획자는 누설 시험에 "집계 수·던진 좌석 외 개인 값 없음"만 단언한다. 우려가 있으면 `day.voted` 를 지우고 이름표 체크를 포기하는 선택지를 사용자에게 돌려준다.

3. **판결 순간 `darken`(어두운 막)·`zoom` 을 새 처형 단계에서 유지하는가?**
   - What we know: UI-SPEC P22-10/13 은 "줌은 처형 단계 시작에서만, 핀·콘 유지" 만 말하고 어두운 막은 언급이 없다. 현재 `momentAt` 은 `darken` 을 `t < BALLOT_END_AT(4600)` 로 둔다.
   - Recommendation: `darken`·`zoom`·`pin` 을 `[0, PIN_OFF_EXEC_AT)` 창으로 재시각하고 `yes/no/end`·`BALLOT_*` 는 삭제. 시각 새 값 없음(0.6초 줌 인/아웃 기존).

4. **"시간 초과 시 쓰던 글" 확실성**
   - What we know: 서버는 저장된 마지막 `will` 만 안다. 클라이언트 디바운스·마감 직전 전송으로 대부분 해결.
   - What's unclear: 마지막 ~0.5초 입력 손실, 네트워크 지연.
   - Recommendation: 위 방식으로 가고 UI-SPEC 문구("쓰던 글이 자동으로 나간다")는 "마감 약 0.7초 전까지 쓴 글"로 해석. 시험은 "마감 직전 전송이 저장됨" 을 fake timer 로 단언.

5. **`rules.pickTurn` 플래그를 지우는가, `true` 로 두는가?**
   - What we know: D-01 은 `RULES` 에 `pickTurn: true` 를 남긴다고 명시.
   - Recommendation: 필드를 유지(시험·`politicsOn`·누설 허용 경로 조건이 읽음)하되 `enterVote`·`castPoint`·`resolveNomination` 의 "동시 투표" 경로(`rules.pickTurn ? … : …` 분기의 false 쪽)는 죽은 코드이므로 22-07 에서 삭제하고, `test/helpers/voteState.ts castPoints` 의 `pickTurn === undefined` 분기도 지운다.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | 시험·스크립트 | ✓ | v26.13.0 | — |
| npm | 스크립트 | ✓ | 11.20.0 | — |
| vitest | 단위·worker·client 시험 | ✓ | 4.1.12 | — |
| 로컬 dev 서버 | E2E(`--url http://localhost:5173`) | ✓ (이 세션에 이미 떠 있음, `/api/health` 응답) | 버전 문자열 `2026-11-13T13:32:57Z+63e57a44` — **현재 체크아웃과 다를 수 있다. 계획 실행 전 `npm run dev` 재시작 확인** | `npm run dev` |
| 시스템 Chrome | E2E(`findChrome`) | ✓ (`/Applications/Google Chrome.app`) | — | — |
| `wrangler` | `typecheck`(`wrangler types`)·dev 서버 | 미확인(typecheck 체인이 부름, 이 세션에서 typecheck 는 실행하지 않음) | — | 계획 1 의 검증에서 한 번 `npm run typecheck` 로 확인 |

**Missing dependencies with no fallback:** 없음.
**Missing dependencies with fallback:** dev 서버 버전 불일치 가능성 — 코드 변경 뒤 E2E 전에 재기동.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.12 (프로젝트 3개: `unit`(node)·`client`(happy-dom)·`worker`(`@cloudflare/vitest-plugin`)) [VERIFIED: vitest.config.ts] |
| Config file | `/Users/dhkim1522/personal/minifia/vitest.config.ts` (unit setup `test/unit/setup.ts`, worker setup `test/worker/setup.ts`, client setup 없음) |
| Quick run command | `npx vitest run <파일들> && npm run typecheck` |
| Full suite command | `npm test` (= `vitest run`) 그리고 `npm run typecheck` |
| E2E | `npm run e2e -- --url http://localhost:5173 --only <흐름 id 부분 문자열(쉼표 가능)>` [VERIFIED: scripts/e2e/lib.mjs:1879-1880 `--only 는 쉼표로 여러 개`] |

기준선: 이 세션에서 `npx vitest run test/unit/gather.test.ts test/unit/verdict.test.ts test/unit/dayView.test.ts` → 3 파일·192 테스트 통과(257ms). 전체 기준선은 계획 22-01 시작 전에 `npm test` 와 `npm run typecheck` 로 한 번 잰다(이 세션에서 안 돌림).

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SC1 | 방장 줄에 [판 종류] 없음 · 판 종류 상태·메시지 없음 | client | `npx vitest run test/client/hostRail.test.tsx test/client/lobby.test.tsx test/client/resultScreen.test.tsx` | ✅(수정) · 삭제: `modeChip`/`mapChip` 의 mode 부분, `test/worker/modePick.test.ts` |
| SC1 | 낡은 방(mode·town·errand 필드)이 대기실로 되돌아감 | unit | `npx vitest run test/unit/normalizeStoredRoom.test.ts`(이름은 계획자가 정함) | ❌ Wave 0 (기존 정규화 시험 파일을 찾아 확장해도 됨: `grep -l normalizeStoredRoom test/unit`) |
| SC1 | 단일 `RULES`, `pickTurn:true`·나머지 정치 장치 false | unit | `npx vitest run test/unit/ruleset.test.ts` | ✅ 있으면 수정, 없으면 ❌ Wave 0 |
| SC2 | 확장판 키·DOM·와이어 0건(누설·DOM) | worker+e2e | `npx vitest run test/worker/leak.test.ts` · `npm run e2e -- --url http://localhost:5173 --only basic-off` | ✅(수정) |
| SC2 | 분필 윤곽은 남음(피해자 자리) | worker | `npx vitest run test/worker/morningCards.test.ts test/worker/night.test.ts` | ✅ |
| SC3 | 찬반 판정 경계 `(1,0)(1,1)(0,0)(4,3)(3,4)`, 후보·분모 없음 | unit | `npx vitest run test/unit/verdict.test.ts` | ✅(수정) |
| SC3 | 찬반→지목→처형 사슬·동점/0표→밤·부결→밤(지목 건너뜀) | worker | `npx vitest run test/worker/basicDay.test.ts test/worker/day.test.ts test/worker/pickTurn.test.ts test/worker/trial.test.ts` | ✅(수정; `pickTurn.test` 는 `skipIf` 가 풀려 새로 돎) |
| SC3 | 번복·집계 수가 모든 소켓에 방송(개인 값 없음) | worker | `npx vitest run test/worker/leak.test.ts`(verdictCount 구간) | ✅(수정) |
| SC3 | 지목 차례 화면(알약·핀·빛남), 기록 줄/토스트 0건 | client+unit | `npx vitest run test/client/nominationScreen.test.tsx test/unit/dayView.test.ts test/unit/pickTurn.test.ts test/unit/hostLine.test.ts` | ✅(수정) |
| SC3 | 배치 규칙(verdict 배치 없음, 유언·처형 무대) | unit | `npx vitest run test/unit/gather.test.ts` | ✅(수정) |
| SC4 | 처형자만 쓰기, 미리 쓴 글 시작, 조기 종료, 시간 초과 저장본, 채팅 잠금, 처형 카드(빈 글 포함) | worker+unit | `npx vitest run test/worker/will.test.ts test/unit/will.test.ts` | ✅(수정) · `final`·잠금 시험은 ❌ Wave 0 추가 |
| SC4 | 유언 시트 자동 열림·[남기기]·남은 초·접기 | client | `npx vitest run test/client/willSheet.test.tsx test/client/willFlow.test.tsx test/client/verdictScreen.test.tsx` | ✅(수정) |
| SC4 | 처형 시간표(핀·줌·소리·알림 합 ≤ 6.6초) | unit | `npx vitest run test/unit/verdictMoment.test.ts test/unit/soundVerdict.test.ts test/unit/soundScript.test.ts test/unit/dayView.test.ts test/unit/pinPlan.test.ts` | ✅(수정; `pinPlan.test` 이름 확인) |
| SC4 | 밤 피해자 유언 편지 그대로 | client | `npx vitest run test/client/willLetter.test.tsx test/client/useWillLetter.test.tsx` | ✅ |
| SC5 | 시상 없음(서버·화면·소리) | worker+client+unit | `npx vitest run test/worker/endgame.test.ts test/client/resultScreen.test.tsx test/unit/soundScript.test.ts`(awards 시험 파일 삭제 확인: `test/unit/awards*.test.ts`, `test/worker/awards.test.ts`, `test/worker/stats.test.ts`) | ✅(수정·삭제) |
| SC5 | 유령 배율 0.75·headY·회전 | unit | `npx vitest run test/unit/character.test.ts test/client/ghostView.test.tsx` | ✅(수정) |
| SC6 | 와이어 상수 사본 대조 | unit | `npx vitest run test/unit/e2eContract.test.ts` | ✅(삭제 계획마다 수정) |
| SC1~SC5 | 로컬 E2E | e2e | 아래 표 | 일부 ✅ 일부 ❌ Wave 0 |

**로컬 E2E 흐름(바뀐 흐름만, D-24)** — 모두 `npm run e2e -- --url http://localhost:5173 --only <id>`:

| 증명 대상 | 흐름 id | 상태 |
|-----------|---------|------|
| 기본 한 판 완주(단계 id 순서·확장판/판 종류 선택자 0건, SC1·SC2) | `basic-off`(+ `day`) | ✅ 있음 — 단계 순서 기대값 수정(토론→찬반→지목→유언→처형→밤) |
| 처형 없음 분기(부결·동점·0표) | `noexec` | ✅ 있음 — 부결·동점 케이스 보강, "처형 단계·유언 시트 없음" 단언 |
| 지목 차례 핀·slide | `politics-pin` | ✅ 있음, **`skipByDefault: true` 해제** + 유언 단계 핀(`__mfPin` = 처형자) 단언 추가 |
| 처형 시간표·유언 카드 3.0초(`data-will-reveal`) | `politics-verdict` | ✅ 있음 — 찬성/반대 묶음 단언 삭제, 유언 카드·시간표로 교체(id 는 `verdict-moment` 등으로 바꿔도 됨) |
| 찬반 숫자 줄·번복 | 새 `vote-count` | ❌ Wave 0 |
| 유언(조기·시간 초과·빈 글·나머지 잠금), 폰 6종 시트 기하(P22-8) | 새 `will-flow` | ❌ Wave 0 |
| 유령 크기·방향(`__mfGhosts`.scale/facing) | `ghost`(보강) | ✅ 있음 |
| 소리 순서 | `sound-script` | ✅ 있음 — 단계 사슬 기대값 수정, award·ballot 소리 단언 삭제 |
| 누설(역할 다섯 시점) | `emcee-leak` | ✅ 있음 |
| 결과·다시 하기 | `result`·`result-rematch` | ✅ 있음 — award 판정(R4/R6) 삭제 |

삭제 대상 흐름(registry `scripts/e2e/flows.mjs:3834-3892` 와 import 줄): `errand`, `tutorial-solo`, `tutorial-together`, `mode-rail`, `mode-pick`, `mode-basic`, `mode-leak`, `town-walk/room/sight/ghost/reduced`, `cause-evening/night/morning/skip/basic/phones`. 파일: `errand.mjs`·`tutorial.mjs`·`modes.mjs`·`town.mjs`·`cause.mjs`(와 `host.mjs`·`mapselect.mjs`·`lib.mjs` 의 해당 도우미 `pickModeViaRail`·`pickModeViaUi`·`openExtended`, `lib.test.mjs` 의 해당 단위 시험 — lib.test.mjs 는 6008줄이라 grep 으로 해당 describe 만 지운다).

### Sampling Rate
- **Per task commit:** 바뀐 영역의 `npx vitest run <그 파일들>` + `npm run typecheck`
- **Per wave merge:** 해당 프로젝트 전체(`npx vitest run --project unit`/`worker`/`client`) + `npm run typecheck`
- **Phase gate:** `npm test` 전체 초록 + `npm run typecheck` + 위 E2E 표의 흐름 + 저장소 위생 `git grep` 금지어 검사 빈 결과(상위 CLAUDE.md 참조), 그 뒤 `/gsd-verify-work`

### Wave 0 Gaps
- [ ] 정규화 시험(옛 방 → 대기실): `normalizeStoredRoom` — SC1
- [ ] `final` 조기 종료·처형자 전용 `saveWill`·defense 채팅 잠금 시험 — SC4
- [ ] `verdictCount` 방송(번복 포함)·누설 허용 경로 갱신 — SC3
- [ ] E2E `vote-count`, `will-flow`(폰 6종 시트 기하 + 키보드 열림 `K` 336) — SC3·SC4
- [ ] 기준선 측정: `npm test`·`npm run typecheck` 한 번(실패가 이미 있는지 먼저 기록)

## Security Domain

`security_enforcement` 는 `.planning/config.json` 에서 명시적으로 꺼져 있지 않다(키 없음) → 포함.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | 변경 없음 (토큰·소켓 첨부 playerId) |
| V3 Session Management | no | 변경 없음 |
| V4 Access Control | **yes** | 행위자는 소켓 첨부 playerId 로만. `saveWill` 은 defense 에서 처형자만, `final` 은 처형자만 의미, 채팅은 서버 `channelOf` 가 defense 에서 막음 |
| V5 Input Validation | **yes** | zod `strictObject`(`will` 에 `final: z.literal(true).optional()` 만 추가, 덧붙은 키 거부) + `saveWill` 의 `sanitizeChatText`·50자소 |
| V6 Cryptography | no | 해당 없음 |
| V8 Data Protection(정보 누설) | **yes** | 새 view 키 `day.verdictCount`·`day.execution.will` 는 역할과 무관한 공개 값, 누설 허용 목록에 이유와 함께 추가. 개인 표(`verdictVote`·`nominate`)는 서버 전용 유지 |

### Known Threat Patterns for 이 스택(Cloudflare Worker DO + React)

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 처형자가 아닌 사람이 `final:true` 로 단계를 앞당김 | Tampering / Elevation | 서버가 단계·행위자(처형자) 확인, 아니면 일반 저장만·같은 응답(오라클 방지) |
| 유언 단계에서 다른 사람이 채팅·유언 쓰기 | Tampering | `channelOf`→null, `saveWill` 행위자 조건 |
| 유언 글을 통한 스크립트 삽입 | Tampering(XSS) | React 텍스트 노드만, `innerHTML` 금지(UI-SPEC), 서버 `sanitizeChatText` |
| 찬반 번복 연타로 방송 폭주 | DoS | 같은 값 재전송은 같은 객체라 전송 없음(기존). 값이 바뀔 때만 전원 방송이므로 사람당 ≤ 2값 — 별도 간격 제한은 `POINT_MIN_INTERVAL_MS` 와 같은 패턴을 쓰려면 계획자가 판단(기존 verdict 에는 간격 제한이 없음) |
| 집계 수 + 던진 좌석으로 개인 표 추론 | Information Disclosure | D-11 이 감수. Open Question Q2 |
| 옛 저장 방의 죽은 키가 새 코드에서 깨짐 | Tampering(저장 데이터) | `normalizeStoredRoom` 이 키 제거 + 대기실 복귀 |

## Recommended Plan Breakdown

원칙: 계획 하나 = 한 가지 슬라이스(서버+와이어+화면+시험+E2E 삭제를 **의존 방향을 지켜** 한 계획 안에서 끝냄), 작업 ≤ 3, 실행기가 읽을 것은 "이 문서의 해당 표 + 지울/고칠 파일 목록". 각 계획의 완료 조건은 **`npx vitest run <전체>` 와 `npm run typecheck` 초록**(E2E 는 마지막 계획 + 계획마다 영향받는 흐름 1~2개만).

| 계획 | 웨이브 | 내용 | 작업(≤3) | 선행 |
|------|--------|------|----------|------|
| **22-01 유령** | 1 | `character.ts` 배율·`headY`·역회전 삭제, `__mfGhosts` 에 `scale`·`facing`(runtime→WorldStage→testHooks), `character.test`·`ghostView` 수정, E2E `ghost` 단언 | ① character+hook ② 단위/클라 시험 ③ E2E ghost | 없음(독립 — 22-02 와 병렬 가능) |
| **22-02 시상 제거** | 1 | `awards.ts`·`stats.ts`·`Player.stats`·`GameResult.awards`·`AWARD_IDS`·`computeAwards`, 결과 화면 시상 UI, 소리 `award.*`·`awardScript`·`plateCues`·`RESULT_PLATE_KEY`·`step:"plate"`·`soundLab*` 항목, helper `awardsState`, 시험·E2E R4/R6 | ① 서버·와이어·view ② 화면·소리 ③ 시험·E2E | 22-01 과 파일 겹침 거의 없음(protocol.ts·view.ts 한두 줄은 병합 주의) |
| **22-03 튜토리얼 제거** | 2 | 서버 `tutorial` 단계·`tutorialDone`·`TUTORIAL_MS`·`clearTutorial`·`tutorial.ts`·`start.tutorial` 필드, 클라이언트 `tutorialScript`·`TutorialScreen`·`Tutorial*` 8개·훅·css·소리 `tut.*`·진입점(Home [혼자 하기]·Lobby [튜토리얼 먼저] — **마운트 제거, CSS 로 숨기지 않음**), 시험·E2E `tutorial.mjs` | ① 서버·와이어 ② 클라 부품·진입점 ③ 시험·E2E | 22-02 후(같은 view.ts/protocol.ts) |
| **22-04 원인 흐름 + 마을 제거** | 3 | `rules.cause` 분기(`nextPhaseOf`·`afterDayOf`·`noExecutionOf`·`morningMsOf`·tick 훅), `lamps.ts`·`scene.ts`·`skip.ts`·인스펙트·의심 보드·`houseView`·`HouseTag`·`ClueSpot`·`ClueCard`·`SuspectBoard`·`mapTown.ts`·`zones.ts`·`town.ts`·`cutaway.ts`·문 프레임·zone 동기화·overview 카메라·`MapId "town"`·`MODE_MAPS`·`PLAZA_SPAWNS`·`plaza.ts` town 인자, `captureHomeNow` cause 분기(D-06), 시험·E2E `cause.mjs`·`town.mjs`. **`lockCause*`·`openCause`·`openTown`·`lockModeMaps` 는 no-op 껍데기로 유지(Pattern 2)** | ① 서버·와이어·맵 ② 클라(화면·카메라·부품) ③ 시험·E2E | 22-03 |
| **22-05 심부름 + 목격 + 흔적 제거** | 4 | `errand*`·`errandFake`·`PhaseId "errand"`·`ERRAND_*`·`rules.errand/witness/trace`·`PLACE_IDS`·`placeArt`·`make-placeart`(+ **`package.json` `placeart*` 와 `typecheck` 체인 수정**)·`trace.ts`·`EvidenceCard`·`traceMark`·`evidence.css`·`recordView`·`RecordCard`·`me.record`·`day.evidence`·`morning.trace/seen`·`ErrandMarker/Act/Dots/StartCard`, `nearPhaseOf`·`errandTickAt`·`nextWakeAt` errand 항·worker 근처 snap, `hostLine` errand/witness/trace 키, `canMoveIn` errand, 시험 도우미 `startedGame/lobbyOf/startedAt` 사슬 `dayAnnounce→discussion`, E2E `errand.mjs` | ① 서버·worker ② 클라·placeart·스크립트 ③ 시험·E2E | 22-04 |
| **22-06 판 종류 제거 + 단일 RULES + 시험 장치** | 5 | `GAME_MODES`·`GameMode`·`DEFAULT_MODE`·`RoomView.mode`·`modePick`(스키마·핸들러·`mode.ts`)·`RULES_BY_MODE`·`startMapOf`·`modeOf`/`rulesetOf` 호출부 전체를 `RULES` 로 치환(src·shared·worker·test), `pickTurn:true`, `ModeSheet`·`ModeChip`·`modeText`·`modeToastOf`·방장 줄 [판 종류], `Lobby`/`ResultScreen` 방장 줄(P22-15), `normalizeStoredRoom` 재설정(D-03·Runtime State Inventory), `rematch.ts REMATCH_ROOM_KEYS`·`testTools` 의 `mode`, **시험 껍데기 호출부 일괄 제거(D-09)**·setup 정리·`SHIPPED_*` 삭제·`lobbyOf/startedGame/startedAt` 의 `mode` 인자 삭제, E2E `openGame mode`·`pickModeVia*`·`openExtended`·smoke 기본 흐름. 누설 시험 `skipIf(politicsOn…)` 교정(Pitfall 2) | ① shared·worker·RULES 치환 ② 화면·방장 줄·정규화 ③ 시험 장치·E2E 도우미·smoke | 22-05 |
| **22-07 서버 낮 순서: 찬반 → 지목** | 6 | `phases.ts` `next` 표·`nextPhaseOf`·`afterDayOf`(→ `"night"`), `verdict.ts`(유권자 전원·판정·voteLog 줄 생성·`verdict:{passed}`), `nomination.ts`(`resolveNomination` 이 `passed:true` 보존·동점/0표→night, `enterVote`·`castPoint` 삭제), tick 훅 정리, `gather.ts`(Pattern 5), `view.ts`(`verdictCount`·`candidate` 단계·`voteLog`/`ballots`/`verdict` 삭제), `execution.ts noExecutionOf`(Pitfall 7), `bots.ts`(찬반 후보 제외 삭제), worker `applyVerdict` 전원 방송·`emitBallotsCard` 삭제, `testTools` skip, 시험(verdict·nomination·gather·basicDay·pickTurn·trial·day·bots·leak) | ① 규칙(verdict·nomination·phases·gather) ② view·worker·봇 ③ 시험 | 22-06 |
| **22-08 서버 유언 단계 + 처형 시간표** | 7 | `DEFENSE_MS` 10s·`EXECUTION_MS` 6.6s·`PIN_OFF_*`·새 시간표 상수 한 곳, `saveWill` 처형자 조건, `final` 와이어(`will` 스키마·타입·`applyWill`/조기 종료), 채팅 잠금(`CHAT_PHASES`/`channelOf`), `day.execution.will`, `emitDeathCards` 확인, 봇 유언(D-18), `smoke.mjs` 사본, `e2eContract.test`, 시험(will·trial·testTools 사슬·endgame) | ① 규칙·와이어 ② worker·봇·시간표 ③ 시험 | 22-07 |
| **22-09 화면: 낮 흐름** | 8 | 찬반 숫자 줄(`VerdictPicker` 주변 `GamePanel`)·접근성·`data-verdict-count`, `PickTurnBlock` 켜짐·동시 투표 UI(`pointToast`·`leadLine`·`majorityLine`·득표 배지·"유력" 도장·과반 줌) 삭제, `dayView`(제목 P22-1·찬반/유언/처형 알림·"처형 없음" 한 가지·옛 변론/찬반 문구 삭제)·`hostLine`(D-23 문구·빛남 P22-17)·`headerFor` 힌트 정리, `pinPlan`(Pattern 10)·`verdictMoment`·`useVerdictMoment`·audio(`audioView`·`script`·`director`)의 키/시각, `WillSheet`(+ prop 3)·`useWill`(자동 열림·자동 전송·[남기기])·`GameMap`·`GamePanel` 채팅 잠금(`data-chat-locked`)·`QuoteCard` `mv-quote--will`·`BallotReveal`·`ballotsView`·`ChatLines` ballots 카드·`timelineView`·`DayDetail`·`TimelineStrip`·`resultLog` ballots part 삭제, 소리 표, 클라 시험 | ① 찬반·지목 화면 ② 유언·처형 화면·연출 ③ 기록 화면 삭제·시험 | 22-08 |
| **22-10 E2E·누설·문서·결정 기록** | 9 | E2E 흐름 수정·신규(`vote-count`·`will-flow`)·`politics-pin` 해제, 누설 시험 최종 점검, `docs/product.md`·`docs/architecture.md`·`docs/screen-map.md` 새 흐름(D-22), 폐기·개정 표시(0074·0078·0080·0081·0086·0087·0088 / 0063-1·0066-3·0072-2·3·0084-3), 새 결정 기록 1건(`docs/decisions/` 다음 번호: 화면 계약·유령·처형 시간표), `HANDOFF.md` 갱신, 위생 grep | ① E2E ② 문서·결정 ③ 전체 검증 | 22-09 |

웨이브 병렬성: **22-01·22-02 만 서로 독립**(같은 웨이브에서 병렬 가능, `protocol.ts`/`view.ts` 충돌만 병합 주의). 나머지는 공유 파일(`protocol.ts`·`room.ts`·`view.ts`·`tick.ts`·`worker/room.ts`·`GameMap.tsx`·`RoomScreen.tsx`)이 겹치므로 직렬이다.

각 계획의 "읽을 것"(컨텍스트 이월 메모): 해당 계획 행 + Pattern·Pitfall 해당 항 + 삭제 목록은 CONTEXT D-04 와 `git grep` 결과. UI 값은 UI-SPEC P22-n 만(전체 413줄을 읽히지 않는다).

## Sources

### Primary (HIGH confidence — 이 세션에서 소스를 직접 열어 확인)
- `/Users/dhkim1522/personal/minifia/shared/game/{phases,tick,verdict,nomination,execution,will,gather,movement,discussion,room(정규화·RoomState),maps,ruleset,mode,endgame,view,bots,audience,chatRules}.ts`
- `/Users/dhkim1522/personal/minifia/worker/room.ts` (handleWill·applyWill·applyPoint·applyVerdict·applyEndDiscussion·afterTransition·emitDeathCards·captureHomeNow·rulesNow)
- `/Users/dhkim1522/personal/minifia/shared/{protocol,schemas}.ts`
- `/Users/dhkim1522/personal/minifia/src/world/{pinPlan,presence,character}.ts`, `src/game/{dayView,verdictMoment,hostLine}.ts`, `src/audio/script.ts`, `src/net/useWill.ts`, `src/screens/GameMap.tsx`(일부)
- `/Users/dhkim1522/personal/minifia/test/{helpers/playable.ts,helpers/voteState.ts,worker/helpers.ts,worker/leak.test.ts,worker/setup.ts,unit/setup.ts,unit/character.test.ts,unit/e2eContract.test.ts}`, `vitest.config.ts`, `package.json`
- `/Users/dhkim1522/personal/minifia/scripts/e2e/{flows.mjs,run.mjs}` (registry·사용법)
- `/Users/dhkim1522/personal/minifia/.planning/ROADMAP.md` Phase 22, `docs/decisions/0089-v3-question-card-pivot.md`, `22-CONTEXT.md`, `22-UI-SPEC.md`

### Secondary (MEDIUM confidence)
- 파일 개수·언급 수(`grep -rlE`) — 이 세션 실행 결과(정확하나 시간이 지나면 변함)

### Tertiary (LOW confidence)
- 없음(웹 검색을 하지 않았다 — 순수 저장소 내부 변경)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 새 패키지 없음, 버전은 package.json·실행 출력.
- Architecture(규칙 변경 값·함정): HIGH — 변경 대상 소스를 모두 직접 읽었다.
- 삭제 범위의 완전성: MEDIUM — 파일 목록은 CONTEXT 인벤토리에 의존하고 "컴파일러가 못 잡는 곳" 은 grep 목록으로만 제공(전수 실행은 계획 단계).
- Pitfalls: HIGH(1·2·3·5·7 은 코드에서 직접 확인), MEDIUM(8·10 의 훅 확장 세부).

**Research date:** 2026-11-16
**Valid until:** 2026-11-30 (코드가 빠르게 바뀌는 저장소 — 22-04 시작 전에 `git log` 로 CONTEXT 이후 변경 확인)
