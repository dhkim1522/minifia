# 소리 (audio)

> 미니피아의 모든 소리는 브라우저 안에서 Web Audio 로 합성한다. 외부 소리 파일도 소리 라이브러리도 없다. 결정은 `docs/decisions/0070-v2-sound-polish.md`, 구조는 `docs/architecture.md` 의 `src/audio/` 절.

## 출처 기록

- 외부 소리 자산: **0** (git 이 추적하는 `public/`·`src/` 에 mp3·ogg·wav·m4a·aac·flac·opus 파일이 없다).
- 소리 라이브러리: **0** (`package.json` 에 howler·tone·zzfx 등이 없다. 소리는 브라우저 기본 Web Audio 만 쓴다).
- 레시피(발진기·필터링한 잡음·엔벨로프)는 이 저장소에서 직접 작성했다. 알려진 곡의 선율을 인용하지 않았다. 코드 진행은 일반적인 재즈 화성(Dm9·Gm9·A7♭9)이고 음높이·리듬 배치는 직접 정했다.
- 작성일: 2026-11-06 (12페이즈).
- 정적 시험: `test/unit/soundProvenance.test.ts` (오디오 파일·소리 라이브러리가 생기면 아래 표에 행이 있어야 통과), `test/unit/soundProtocol.test.ts` (이 문서의 레시피 지도가 소리 id 70개를 모두 담는지, 서버가 소리를 모르는지), `test/unit/soundStaticGuard.test.ts` (`src/audio/` 가 허용된 입력만 읽는지).

## 샘플을 들일 때 필수 항목

합성 소리가 마음에 들지 않아 특정 id 만 녹음 샘플로 바꾸게 되면(결정 0070 의 열린 것, 하이브리드) 다음 칸을 모두 채운 행이 있어야 한다. 지금은 행이 없다.

| id | 출처 URL | 라이선스 | 증빙(저장소 안 파일·스크린샷 경로) | 받은 날짜 | 수정 여부 | 상업 이용 가능 |
|----|----------|----------|--------------------------------------|-----------|-----------|----------------|
| (없음) | | | | | | |

## 레시피 지도

소리 id 70개(배경음 7 + 효과음 63). 레시피는 `src/audio/recipes.ts` 한 표(`RECIPES`·`BEDS`)가 단일 정의라서 id 하나를 바꾸려면 그 줄만 고치면 된다. 감독 규칙은 `src/audio/director.ts`(공개 view 차이·닫힌 로컬 신호), 시간표 대본은 `src/audio/script.ts` 에 있다. 값(레벨·길이·음높이)은 모두 첫 초안이고 폰으로 듣고 조정한다.

| 소리 id | 일어나는 일 | 정의 → 규칙이 있는 파일 |
|---------|-------------|--------------------------|
| `bed.lobby` | 대기실(로비) | recipes.ts → director.ts (`BED_OF`) |
| `bed.reveal` | 역할 확인 무대 | recipes.ts → director.ts (`BED_OF`) |
| `bed.day` | 낮 알림·토론 | recipes.ts → director.ts (`BED_OF`) |
| `bed.vote` | 지목·결선·마지막 3인·변론·찬반·판결(처형 중에는 덕킹) | recipes.ts → director.ts (`BED_OF`) |
| `bed.night` | 밤(모든 역할이 같은 소리) | recipes.ts → director.ts (`BED_OF`) |
| `bed.dawn` | 아침 | recipes.ts → director.ts (`BED_OF`) · script.ts |
| `bed.result` | 결과·시상 | recipes.ts → director.ts (`BED_OF`) |
| `ui.tap` | 주요 버튼을 누름(밤에는 무음) | recipes.ts → director.ts |
| `ui.toggle` | 소리 단추를 누름(켬·끔 변형) | recipes.ts → engine.ts (`setOn`) |
| `ui.deny` | 서버가 요청을 거절해 토스트가 뜸 | recipes.ts → director.ts |
| `ui.card` | 카드·편지 도착(종류 구분 없음) | recipes.ts → script.ts · director.ts |
| `ui.host` | 자막 띠가 바뀜(단계 전환), 밤 진입도 모든 역할 같음 | recipes.ts → director.ts |
| `lobby.join` | 사람이 입장함 | recipes.ts → director.ts |
| `game.start` | 시작해 배정 3초가 열림 | recipes.ts → director.ts |
| `role.flip` | 역할 카드 공개·결과의 직업 뒤집기(직업별 차이 없음) | recipes.ts → script.ts · director.ts |
| `day.start` | 낮 알림 진입 | recipes.ts → director.ts |
| `timer.tick` | 공개 카운트다운 마지막 5초 초마다(낮 토론·변론·찬반만) | recipes.ts → director.ts |
| `phase.vote` | 지목 단계 진입 | recipes.ts → director.ts |
| `pin.on` | 핀 조명이 켜짐 | recipes.ts → director.ts |
| `pin.move` | 핀 조명이 다음 사람으로 이동 | recipes.ts → director.ts |
| `pick.turn` | 내 지목 차례 시작(차례인 사람만) | recipes.ts → director.ts |
| `pick.tick` | 내 차례 마지막 3초(차례인 사람만) | recipes.ts → director.ts |
| `pick.point` | 지목이 확정됨 | recipes.ts → director.ts |
| `pick.skip` | 기권(시간 초과) | recipes.ts → director.ts |
| `runoff.intro` | 결선 진입 | recipes.ts → director.ts |
| `runoff.reveal` | 결선 득표 수 공개 | recipes.ts → director.ts |
| `showdown.reveal` | 마지막 3인 지목 공개 | recipes.ts → director.ts |
| `vote.cast` | 찬반을 고르거나 바꿈(찬성·반대 같은 소리) | recipes.ts → director.ts |
| `verdict.heart` | 처형 진입 앞머리 심장 박동 5쌍(결과 무관) | recipes.ts → script.ts |
| `ballot.yes` | 찬성 묶음 등장 | recipes.ts → script.ts |
| `ballot.no` | 반대 묶음 등장 | recipes.ts → script.ts |
| `execution.gavel` | 처형 확정 알림(의사봉) | recipes.ts → script.ts |
| `execution.rise` | 유령이 떠오름 | recipes.ts → script.ts |
| `verdict.reject` | 부결(처형 없음) | recipes.ts → script.ts |
| `night.fall` | 밤 진입(모두 같다) | recipes.ts → script.ts · director.ts |
| `night.cue` | 밤 로컬 큐(각자 난수, 서버 입력 0) | recipes.ts → script.ts · director.ts |
| `kill.slash` | 암살당한 본인만, 아침 도착 기준 | recipes.ts → script.ts · director.ts |
| `morning.dawn` | 아침 진입(결과 무관) | recipes.ts → script.ts |
| `morning.calm` | 평화로운 밤 알림 | recipes.ts → script.ts |
| `chalk.draw` | 분필 윤곽·희생자 알림 | recipes.ts → script.ts |
| `morning.saved` | 의사가 살렸다는 알림 | recipes.ts → script.ts |
| `will.quill` | 유언 편지 쓰는 동안 | recipes.ts → script.ts |
| `will.seal` | 편지 인장 | recipes.ts → script.ts |
| `will.fold` | 편지 접힘 | recipes.ts → script.ts |
| `emote.clap` | 박수 동작을 받음 | recipes.ts → script.ts |
| `emote.praise` | 최고 동작을 받음 | recipes.ts → script.ts · director.ts (`emote.*`) |
| `emote.handshake` | 악수 동작을 받음 | recipes.ts → script.ts · director.ts (`emote.*`) |
| `emote.dance` | 춤 동작을 받음 | recipes.ts → script.ts · director.ts (`emote.*`) |
| `emote.surprise` | 깜짝 동작을 받음 | recipes.ts → script.ts · director.ts (`emote.*`) |
| `emote.cry` | 엉엉 동작을 받음 | recipes.ts → script.ts · director.ts (`emote.*`) |
| `emote.deny` | 손사래 동작을 받음 | recipes.ts → script.ts · director.ts (`emote.*`) |
| `emote.point` | 손가락 동작을 받음 | recipes.ts → script.ts · director.ts (`emote.*`) |
| `emote.throat` | 목긋기 동작을 받음 | recipes.ts → script.ts · director.ts (`emote.*`) |
| `result.win` | 내 팀이 이김(결과 조명) | recipes.ts → script.ts |
| `result.lose` | 내 팀이 짐(결과 조명) | recipes.ts → script.ts |
| `award.plate` | 시상 패 등장 | recipes.ts → script.ts |
| `award.final` | 마지막 패 | recipes.ts → script.ts |
| `tut.lampOff` | 튜토리얼 오프닝: 램프 번짐이 하나 어두워짐(램프 수만큼 대본이 부름) | recipes.ts → src/game/tutorialScript.ts 의 장면 표 |
| `tut.scream` | 튜토리얼 오프닝: 한 사람이 사라지며 진홍빛이 번쩍임 | recipes.ts → src/game/tutorialScript.ts 의 장면 표 |
| `tut.whoosh` | 튜토리얼 장면 2·3·6 시작 | recipes.ts → src/game/tutorialScript.ts 의 장면 표 |
| `tut.sting` | 튜토리얼 장면 2: 무거운 줄이 나옴 | recipes.ts → src/game/tutorialScript.ts 의 장면 표 |
| `tut.step` | 튜토리얼 장면 4: 발자국이 찍힘(0.32초 간격으로 여러 번) | recipes.ts → src/game/tutorialScript.ts 의 장면 표 |
| `tut.eye` | 튜토리얼 장면 4: 눈 표시가 켜짐 | recipes.ts → src/game/tutorialScript.ts 의 장면 표 |
| `tut.link` | 튜토리얼 장면 5: 연결선이 그어짐(두 번) | recipes.ts → src/game/tutorialScript.ts 의 장면 표 |
| `tut.buzz` | 튜토리얼 장면 6: 오답 지목 | recipes.ts → src/game/tutorialScript.ts 의 장면 표 |
| `tut.stamp` | 튜토리얼 장면 6: 정답 지목 도장 | recipes.ts → src/game/tutorialScript.ts 의 장면 표 |
| `tut.fanfare` | 튜토리얼 장면 6: 정체 카드가 뜸(D·F·A·E 네 음) | recipes.ts → src/game/tutorialScript.ts 의 장면 표 |
| `tut.flip` | 튜토리얼 장면 7: 직업 카드가 뒤집힘(네 장, 0.35초 간격) | recipes.ts → src/game/tutorialScript.ts 의 장면 표 |
| `tut.warm` | 튜토리얼 장면 8: 따뜻한 조명 | recipes.ts → src/game/tutorialScript.ts 의 장면 표 |
| `voice.syl` | 튜토리얼 사회자 띠의 웅얼 목소리(글자마다 한 음절, 음높이는 대본 cents) | recipes.ts → voice.ts |

- 소리 없음으로 정한 것: 채팅 수신·보내기, 귓속말 도착, 직업 주장 배지 도장, 준비 토글, 방장 이양, 로비 퇴장, 밤의 모든 UI 조작, 칭호별 개별 소리.
- 밤 소리(`night.fall`·`night.cue`·`bed.night`)는 모든 역할이 같은 대본을 듣는다. 암살음(`kill.slash`)은 당한 본인만 듣는다.

## 시험 페이지

- 열기: `npm run dev` (`--host` 포함) 후 폰에서 `http://<Mac IP>:5173/?sound-lab=1`. 개발 문맥 전용이고 배포본 번들에는 들어가지 않는다.
- 70개를 ▶ 로 하나씩 듣고, [전부 계산] 으로 오프라인 렌더 검사(피크·NaN·무음·길이)를 헤드리스에서도 돌릴 수 있다.
- 마음에 들지 않는 id 를 알려 주면 `src/audio/recipes.ts` 의 레시피 한 줄만 고친다. 레벨이 문제면 `gainDb`, 길이면 `dur`, 음높이면 `f0`·`f1`.

## iOS 메모

- 무음 스위치를 존중한다(`audioSession.type = "ambient"`, 우회하지 않음). 다른 앱 음악과 섞인다. 앱 안에 무음 스위치 안내 글은 없다 — 소리가 안 나면 먼저 옆면 무음 스위치를 확인한다.
- 잠금 해제는 참가·만들기 제출 탭의 핸들러 맨 앞에서 동기 호출한다(비동기 뒤는 제스처로 치지 않는다). 재접속은 알약 또는 아무 탭에서 되살린다.
- 숨김(visibilitychange)에서는 suspend, 복귀에서는 resume 하며 놓친 일회성 소리는 틀지 않는다.
- 무음 스위치·잠금 화면 복귀·`interrupted` 복구·`audioSession` 의 실제 동작은 실기기에서만 확정할 수 있다 (`.planning/phases/12-sound-polish/12-TEAM-TEST.md`).
