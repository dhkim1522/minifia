# 0080 튜토리얼 "첫 사건" — 계획 단계 결정과 위임 기본값

- 상태: 채택(계획 단계 추천안 — 사용자가 돌아와 한 줄씩 바꿀 수 있다)
- 날짜: 2026-11-09
- 바꾸는 것: 0078 결과 절의 "함께 진행의 서버 부분은 17 에서 다시 정한다"를 확정, 0077-2 의 대기실 기본값 문장은 유지

## 배경

0078 이 튜토리얼을 "첫 사건" 미니 에피소드로 정하고 17페이즈로 뗐다. 17-UI-SPEC 은 사용자가 승인했고(시안 캔버스 선택 포함), 17-RESEARCH 의 Assumptions A1~A12 는 사용자가 자리를 비운 사이 모두 추천안으로 진행했다. 이 문서는 계획 단계에서 그 추천안을 번호로 고정한 것이다. 17-02~17-09·17-12 계획이 아래 번호(0080-1~0080-19)로 가리킨다. 실행 중 달라진 곳과 한계는 17-10 이 이 문서에 더해 완성한다.

## 결정

0080-1. (A1) 스위치 값은 `start` 메시지의 `tutorial?: boolean` 으로만 서버에 간다. 서버 기본은 꺼짐. 별도 설정 메시지·`view.tutorialOn` 방송은 없다. 스위치는 방장 화면의 로컬 상태이고 [시작] 순간의 값이 실린다(UI-SPEC T-4 를 따르고, UI Considerations #25 의 "서버가 방송한 값만 따른다" 문장은 이 결정으로 바뀐다).
0080-2. (A2) 역할은 지금처럼 beginGame 이 시작 때 배정한다(assignRoles·testRole·decideMap 난수 순서 그대로). tutorial 단계는 revealsOwnRole:false 라 view 에 역할이 없다. T-19 의 "역할은 튜토리얼이 끝난 뒤에 정해진다"는 관측 계약(튜토리얼 중 어떤 view 에도 역할 없음)으로 지킨다.
0080-3. (A3) 테스트 방(me.testMode) 방장의 스위치 초기값은 꺼짐(줄은 보인다). 일반 방은 첫 판 켜짐, 다시 하기(rematch 는 대기실을 거치지 않음)는 늘 꺼짐.
0080-4. 방장 패널 증분은 UI-SPEC 숫자 +76 을 지킨다: 스위치 줄 64 + 패널 간격 10 + 줄 위 margin-top 2 → 326/382. 앱 상수 `LOBBY_HOST_TUTORIAL_EXTRA = 76`.
0080-5. (A6) 저장 키는 T-2 문자열 `minifia.tutorial.seen` 그대로(코드베이스의 콜론 표기와 다름 — 위임 기본값 존중). 값은 "1". session.ts 의 read/write(메모리 대체)에 얹는다.
0080-6. (A12) 튜토리얼 화면 안에서는 기존 호출 빛남(.is-call)의 5회 맥박(::before 애니메이션)만 끄고 정적 테두리(::after)는 둔다. 깜빡이는 것은 FocusRing 하나다(0078-8 한 규칙, T-14 의 우체통 램프 빛은 정적으로 남음).
0080-7. (T-20, Open Q1) 혼자 하기는 history.pushState 를 쓰지 않는다. 뒤로 가기는 앱을 떠나고 다시 열면 첫 화면이다.
0080-8. (A7·A8) 새 소리 id 13개: tut.lampOff·tut.scream·tut.whoosh·tut.sting·tut.step·tut.eye·tut.link·tut.buzz·tut.stamp·tut.fanfare·tut.flip·tut.warm + voice.syl. SOUND_IDS 57→70, 효과음 50→63. tut.fanfare 는 4음(D·F·A·E) 한 레시피(옥타브 사인 없음). voice.syl 은 ui 버스·prio 2·max 2·gapMs 0. 목소리 모듈은 문구를 인자로만 받는다. 시험 페이지 묶음에 "튜토리얼" 하나를 더한다(일곱 묶음).
0080-9. (A9·T-12) 램프 꺼짐은 시안 두 곳(왼쪽·오른쪽 가장자리, 390×844 기준 높이 225) 화면 위 번짐이고 tut.lampOff 도 2번이다. WorldStage 에 투영 통과 prop 을 더하지 않는다. 장면 4 도윤의 포커스 상자는 이름표 사각형 기준 합성 상자(아래로 고정 길이)다.
0080-10. (Open Q2) view.tutorial.total = 앉은 사람(봇 제외) 수, done = 그중 끝났음을 보냈거나 연결이 끊긴 사람 수. 연결된 사람이 0명이어도 전원 완료다. 끊김이 생길 때마다 서버가 전원 완료를 다시 본다.
0080-11. 이름: 서버 전용 `RoomState.tutorialPassed?: string[]`(player id), 공개 `view.tutorial = { done, total, endsAt }`(tutorial 단계에서만, 모두 같은 값), 본인 `me.tutorialDone?: true`(보낸 본인에게만, 거짓은 키 없음 — 코드베이스의 `endDiscussion?: true` 관례). assigning 에 들어갈 때 tutorialPassed 를 지운다.
0080-12. 화면 구조: TutorialScreen 하나가 장면 1~7 을 그린다. 장면 2~6 은 실제 GameMap 에 가짜 view·로컬 WorldStore/ChatStore·로컬 send 어댑터를 주고, 장면 1·7 은 WorldStage 를 직접 쓴다(장면 1→2·6→7 사이에 3D 무대를 다시 만드는 순간은 어둠·막 아래라 보이지 않는다). 장면 8 은 첫 화면(Home)의 마무리 카드다.
0080-13. CSS 는 세 파일: `src/styles/tutorial.css`(첫 사건 화면·장면), `src/styles/tutorialEntry.css`(첫 화면 카드·마무리 카드), `src/styles/tutorialRoom.css`(방장 스위치 줄·기다림 화면). 진홍은 tutorial*.css 에서 T-18 의 두 연출 자리(.tut-opening·.tut-reveal·.tut-role 선택자)에만.
0080-14. 소리 소유: TutorialScreen 이 자기 useSound·소리 단추를 쓴다(혼자·함께 같음). RoomScreen 은 tutorial 단계에서 자막 띠·독·자기 소리 훅·알림음을 끈다(hostChimeOf 는 tutorial 진입·이탈에 거짓).
0080-15. 재접속(T-20): me.tutorialDone 이면 기다림 화면, 아니면 장면 1 부터. 끝났음을 보낸 뒤 연결 번호(epoch)가 바뀌면 화면의 로컬 끝남 표시도 비운다(서버 값만 따른다).
0080-16. 출연(T-9 보완): 좌석 0 민준(detective)·1 도윤(noir)·2 서연(elder, 피해자)·3 지호(reporter)·4 하린(hood)·5 나(coat). 좌석색은 좌석 번호에서 나오므로 T-9 의 "하린 seat-3"(서연과 같은 색)은 seat-5 가 된다. 역할 낱말이 든 의상(police·doctor·mafia)은 쓰지 않는다. 내 이름표는 "나" 한 글자 — 이름표 부품이 닉네임이 이미 "나"이면 접미 " (나)" 를 붙이지 않는다.
0080-17. 장면 4 의 [다음]은 눈 표시 + 1.5초(3.4초)에 나온다. 그때 도윤 포커스는 꺼지고 [다음]이 깜빡인다(UI-SPEC 포커스 표 "꺼지는 때: [다음] 등장"). 장면 5·7 의 [다음]은 시안대로 장면 시작부터 보인다.
0080-18. 개발용 손님 봇 스크립트(scripts/bots.mjs)는 tutorial 단계에서 끝났음을 한 번 보낸다(실제 방 부하 시험이 150초에 묶이지 않게).
0080-19. E2E 새 흐름은 tutorial-solo·tutorial-together(--only tutorial 로 둘 다). 150초 시간 초과 경로는 E2E 가 기다리지 않고 워커 시험(알람)이 맡는다. 튜토리얼 장면 3~6 fps 는 E2E 가 보고만 하고 판정은 v3.0 끝 실기기(VALIDATION 수동 항목)다.

## 위임 기본값

17-UI-SPEC 기본값 기록 T-1~T-23 이 원문이다. 이 문서가 바꾼 줄은 넷이다.

- T-9(하린 좌석색): 하린은 seat-3 이 아니라 seat-5 다(0080-16).
- T-12(램프 꺼짐): 시안 두 곳 화면 위 번짐, tut.lampOff 2번(0080-9).
- T-19(me.tutorialDone): 참일 때만 키가 있다(0080-11).
- UI Considerations #25: 스위치는 방장 로컬 상태이고 [시작] 순간의 값이 실린다(0080-1).

값을 바꿀 곳은 다음과 같다. 사용자가 돌아와 값을 바꾸고 싶으면 이 상수만 고치면 된다.

- 튜토리얼 제한 시간 150초: `shared/game/phases.ts` 의 `TUTORIAL_MS`
- 오답 도움이 나오는 오답 횟수: `src/game/tutorialScript.ts` 의 `WRONG_HINT_AFTER`
- [건너뛰기] 뒤에 마무리 카드를 보일지: `TUTORIAL_END_CARD_ON_SKIP`
- 방장 패널 증분 76: `src/game/chatUi.ts` 의 `LOBBY_HOST_TUTORIAL_EXTRA`
- 저장 키 `minifia.tutorial.seen`: `src/game/session.ts` 의 튜토리얼 읽기·쓰기

## 실행 중 달라진 곳

17-10 이 실행 결과로 채운다.

## 알려진 한계

17-10 이 실행 결과로 채운다.

## 정하지 않은 것

17-10 이 실행 결과로 채운다.

## 근거

- `docs/decisions/0077-*.md` — 단추 정리와 튜토리얼 방향(0077-2 대기실 기본값)
- `docs/decisions/0078-tutorial-first-case.md` — "첫 사건" 미니 에피소드, 진입로 둘, 사회자·첫 화면 선택
- `.planning/phases/17-tutorial-first-case/17-UI-SPEC.md` — 승인된 화면 계약과 위임 기본값 T-1~T-23
- `.planning/phases/17-tutorial-first-case/17-RESEARCH.md` — 구조 조사와 Assumptions A1~A12, Open Questions
