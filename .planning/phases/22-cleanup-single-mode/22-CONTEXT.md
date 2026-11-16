# Phase 22: 정리: 판 하나로, 확장판·시상식 제거, 투표·유언 개편, 유령 수정 - Context

**Gathered:** 2026-11-16
**Status:** Ready for planning

> 자동 진행(`/gsd-autonomous --from 22 --to 24`). 방향과 규칙은 사용자와 하나씩 확정한 결정 0089(`docs/decisions/0089-v3-question-card-pivot.md`)이고 다시 묻지 않는다. 아래 D-* 중 0089 에 없는 세부는 추천안 자동 채택이며 사용자가 돌아와 한 줄씩 바꿀 수 있다. **대전제: 장치를 늘리지 않고 심플하게.** 마피아 본질(밤 처치·낮 투표·승리 조건)은 그대로다.

<domain>
## Phase Boundary

판 종류를 하나로 고정하고 확장판(심부름·등불·마을·밤 집 찾기·아침 현장·의심 보드·목격·밤 흔적·건너뛰기)과 시상을 코드에서 걷어 낸다. 낮 투표를 **토론 → 찬반 → 차례 지목 → 유언 → 처형**으로 바꾸고, 누가 무엇을 골랐는지 정리해 보여 주는 화면을 없앤다. 최후 변론은 유언 하나로 합친다. 유령은 작게, 이동 방향으로 돈다.

넣지 않는 것(다음 페이즈): 첫날 키워드 문제·D1 판 기록(23), 의심 포스트잇·새 튜토리얼·전체 회귀·배포(24).

</domain>

<decisions>
## Implementation Decisions

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

### 리서치 열린 질문 자동 채택 (22-RESEARCH Q1~Q5)
- D-25 (Q1): 서버 voteLog 에 누가 누구를 골랐는지(`cand.votes`)를 저장하지 않는다. 0089-18 "각자 기억한다"는 사람이 기억한다는 뜻이다. 판정에 필요한 그날 처형자·처형 없음 이유만 남긴다.
- D-26 (Q2): 찬반 중 `day.voted`(누가 던졌는지)를 싣지 않는다. 실시간 찬성·반대 수(`day.verdictCount{yes,no}`)만 싣는다 — 던진 좌석과 수가 함께 보이면 첫 투표자의 표가 추론되므로(사용자: "누가 뭐 뽑았는지 보여주기 없앰"). 내 표는 `me` 쪽으로만 안다.
- D-27 (Q3): 판결 순간의 어두운 막(`darken`)·확대(`zoom`)·핀(`pin`)은 유지하고 새 처형 시간표 창 `[0, 6.0초)` 로 다시 맞춘다.
- D-28 (Q4): 유언 시간 초과 시 "쓰던 글"은 마감 직전 클라이언트 자동 전송까지의 저장 글이다(마지막 ~0.5초 손실 허용).
- D-29 (Q5): 진행 중이던 옛 방은 모두 대기실로 되돌린다(D-03), `normalizeStoredRoom` 은 맵·모드 조회보다 먼저 돈다.

### 계획 점검 경고 처리 (자동 채택)
- D-30: 정규화는 옛 표식(tutorial 단계·mode·errand·lamps·town 키)이 있는 방만 대기실로 되돌린다(DO 재기동마다 새 판이 지워지는 것을 막기 위해 D-29 를 좁힌 것). 표식 없는 옛 기본 규칙 방이 새 단계 순서로 읽힐 수 있는 틈은 알려진 한계 — 배포 직전 방은 어차피 비어 있고 출시 전이라 허용.
- D-31: 22-09 에서 깨지는 client 시험은 22-10 으로 이월하고 22-09 SUMMARY 에 목록으로 적는다.
- D-32: 22-12 가 무거우면 실행기가 판단해 "시간표·유언 카드"와 "기록 삭제"로 나눠 커밋한다.

- D-33: 유언 단계(10초)에는 몸동작·입력 중 표시도 서버가 막는다(조용히 지켜보는 장면, 추천안). 22-11 의 채팅 잠금 그대로.
- D-34: P22-3(찬반 장면을 토론 장면 그대로)과 `sure`/`SureStamp`/`VoteBadge`/lead 배관 정리, e2e 스크립트의 옛 변론·찬반 가정 정리는 22-13 이 맡는다.

### Claude's Discretion
- 지우는 순서·계획 나누기(서버 규칙 → 화면 → 시험 → 문서), 남는 코드의 이름 정리, 죽은 코드 판단은 계획자가 정한다. 큰 삭제는 컴파일러가 잡지 못하는 Set·문자열 비교(`"errand"` 등)를 grep 으로 확인한다.

</decisions>

<code_context>
## Existing Code Insights

조사 인벤토리 요약(경로는 저장소 기준).

### Reusable Assets
- 순차 지목: `shared/game/nomination.ts`(`enterNomination`·`stepNomination`·`castTurnPoint`·`turnViewOf`), `src/game/pickTurn.ts`, `PickTurnBlock.tsx`, `useTurnLook`, `pinPlan.ts` slide 핀, 소리 `pick.*`. `RULESET.pickTurn` 으로만 꺼져 있다 — 켜면 worker `pickTurn.test.ts`(`skipIf`)·E2E `politics-pin`(`skipByDefault`)이 다시 돈다.
- 유언: `shared/game/will.ts` `saveWill`(산 사람·지도 단계·50자소), worker `handleWill`, `emitDeathCards`(처형·밤 공용 카드), `WillSheet`·`useWill`, 아침 `WillLetter`·`useWillLetter`.
- 스포트라이트: `pinPlan.ts` `executionPin` → `renderer.setPin` → `bar.ts`·`plaza.ts`, `presence.ts` `trial` 조명(`bar.ts:733` `trialCone`, `plaza.ts:586`).
- 유령: `src/world/ghost3d.ts`, `character.ts` `applyGhost`(986~1030)·1074 역회전, 산 사람 이동 방향 `runtime.ts:1340~1356` `travelYaw`·`stepYaw`.

### Established Patterns
- 규칙 분기는 한 곳(`ruleset.ts`), 단계 순서는 데이터(`phases.ts` `next`)와 `nextPhaseOf`. 순수 모듈은 `shared/game`(시각·난수 인자), 서버 판정만, 누설 검사(`test/worker/leak.test.ts` `SERVER_ONLY_KEYS`·허용 경로).
- 단계 id 를 늘리지 않고 의미·자리만 바꾸는 방식(21 D-01).

### Integration Points
- mode 분기 파일 전체 목록은 조사 §1(서버 `view.ts`·`night.ts`·`movement.ts`·`gather.ts`·`bots.ts`·`tick.ts`·worker `rulesNow`·`captureHomeNow`, 화면 `GameMap.tsx`·`Lobby.tsx`·`ResultScreen.tsx`·`presence.ts` 등).
- 위험한 얽힘: ① 시험 기본 판이 extended(`lockCause` 77 파일·`openTown` 20 파일) ② 튜토리얼이 확장판 부품 사용 ③ `"errand"` 문자열이 Set·비교에 퍼짐 ④ worker 위치 동기화(`nearPhaseOf`·`errandTickAt`·zones·`nextWakeAt`·`reschedule`·`normalizeStoredRoom`) ⑤ 처형 연출이 `day.ballots` 에 기댐 ⑥ 찬반이 후보 존재 전제(`verdictVotersOf`·`enterExecution`·`noExecutionOf`·`buildSummary`·voteLog 모양) ⑦ pickTurn 켜면 누설 허용 경로 기대가 바뀜 ⑧ `GHOST_ART_H` 가 산 사람 이름표에도 쓰임 ⑨ `plaza.ts`·`PLAZA_SPAWNS`·`placeArt` 생성 스크립트 ⑩ 유언 저장 조건·`MORNING_WILL_MS`·defense 관련 집합(audience·stats·movement·`TICK_PHASES`·RoomScreen 알림·봇 대사).

</code_context>

<specifics>
## Specific Ideas

- 사용자: "누가 골랐는지를 아예 빼고 아주 심플하게 찬반 집계해서 과반 찬성이면 진행하고 각자 뽑고 득표수 1등 처형. 단 기존 한 명씩 돌아가면서 선택하는 건 그대로 유지(나름 재미 포인트). 이때 누가 누굴 골랐는지 알아서 기억해 두기."
- 사용자: "처형자가 스포트라이트되면서 마지막 멘트를 입력하면 모두에게 비춰지고 처형당함 형태로(유언과 비슷한 메커니즘)" → 유언 하나로 통일.
- 사용자: "유령 크기 너무 크고 이동 시 3D 형태로 측면 뒷면 안 보인다."

</specifics>

<deferred>
## Deferred Ideas

- 첫날 키워드 문제, D1 판 기록 → 23
- 의심 포스트잇, 새 튜토리얼 → 24
- 시상(억울상 등)은 필요해지면 나중에

</deferred>
