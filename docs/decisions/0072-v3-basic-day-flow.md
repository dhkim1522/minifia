# 0072 v3.0 기본판 낮 흐름: 한 곳의 설정으로 정치 장치를 끄고 투표는 동시로

- 상태: 채택
- 날짜: 2026-11-07

## 배경

- 팀 모의 플레이 피드백(`docs/playtest-v2.0-feedback.md` 진행 단순화, 세부 결정 5·6·7)에서 낮이 길고 장치가 많아 "무엇을 해야 하는지"가 흐려진다고 나왔다. v3.0 13페이즈는 낮을 토론 → 투표 → 최후 변론 → 찬반 → 처형으로만 줄인다(`.planning/phases/13-basic-day-flow/13-CONTEXT.md` D-01~D-07).
- 사용자가 자리를 비우며 위임했다(2026-11-07). 화면 값(UI-SPEC 기본값 U-1~U-9)은 추천안으로 정했다.
- 결정 0063-1(순차 지목)·0066-1·2·4·5·6(배지·귓속말·결선·결전·마지막 지목자 조명)은 코드를 남긴 채 이 결정으로 기본판에서 끈다. 각 항목 끝에 개정 표시를 붙였다.

## 결정

0072-1. **기본판 설정은 한 곳이다.** `shared/game/ruleset.ts` 의 `RULESET`(`badge`·`whisper`·`pickTurn`·`runoff`·`showdown`)이 모두 `false` 다.
- 서버 분기(tick 표·지목 마감·낮 시작 분기·저장 방 정규화·메시지 분기·view)와 화면 진입점(`floatVisible`·`whisperVisible`·결과 탭)이 이 값만 읽는다. 투표 화면은 view 의 `day.turn` 유무로 가른다.
- 판 이름·고르기 화면은 없다(D-01). 코드는 지우지 않았다. 값을 켜면 v2.0 장치가 돌아오고 `skipIf(!RULESET.x)` 시험과 `skipByDefault` E2E 가 다시 돈다.

0072-2. **낮 흐름.** 토론 90초(과반이 끝내기를 누르면 당겨짐) → 투표 `nomination` 15초(`NOMINATION_MS`, 모이는 걷기 포함, 서버 단계 id 유지) → 최후 변론 20초 → 찬반 10초 → 처형.
- 득표 최다가 정확히 한 명이면 변론으로 간다. 동점이거나 0표면 처형 없이 밤으로 간다(결선 없음). 산 사람이 셋이어도 보통 토론이다.
- 이것이 0063-1("한 명씩 차례로")을 개정한다. 순차 지목은 `RULESET.pickTurn` 일 때만 돈다.

0072-3. **동시 투표 규칙.**
- `castPoint`: 마감까지 바꿀 수 있고 취소는 없다. 같은 값은 변화 없음.
- 누가 누구를 가리키는지는 `day.points` 로 모두에게 공개한다(지목은 공개 정보, 결정 0064-11).
- 같은 사람이 250ms(`POINT_MIN_INTERVAL_MS`) 안에 다시 지목하면 저장·방송 없이 본인 state 한 프레임만 돌려준다. 마감을 당기지 않는다.
- 봇은 2~8초 안에 한 번 던진다(`POINT_BASE_MS`·`POINT_SPAN_MS`). 테스트 넘기기는 아직 안 던진 봇의 표를 채운다. 그래서 봇 방이 새 흐름으로 한 판을 자동 완주한다(FLOW-05).

0072-4. **꺼진 장치 처리.**
- 꺼진 `badge`·`whisper` 메시지는 보낸 소켓에 `BAD_MESSAGE` 오류 한 프레임으로 거절한다(지원하지 않는 기능과 같은 모양, state·저장·방송 없음).
- view 는 `badge`·`badgeSwapped`·`day.turn`·`day.runoff`·`day.showdown`·`me.whisperUsed`·`me.ballot` 을 싣지 않는다. 누설 검사의 허용 경로는 `politicsPathsFor(ruleset)` 로 좁혔다.
- 결과 화면에 귓속말 탭이 없다. 저장 방 정규화의 옛 지목 재시작은 `RULESET.pickTurn` 일 때만 한다.
- 찬반 기록 카드(`day.verdict.ballots`, 0066-3)와 판결 순간 연출(0066-7)은 그대로다(FLOW-04).

0072-5. **화면(UI-SPEC U-1~U-9).**
- 제목 "투표", 15초 링, 마감까지 바꾸기, 선두·과반 연출 복원(`data-lead`·`data-sure`).
- 위 알림은 표마다 한 줄이고 새 표가 이전 것을 바꾼다(대기열 없음). 내가 던지면 이름표가 3초 깜빡인다(저장 키 없음, 재접속에는 남은 시간만, 이미 골랐으면 켜지 않음).
- 동점·0표는 "처형 없음". 꺼진 장치의 흔적(떠 있는 버튼·시트·귓속말 탭·`[data-badge-live]`)은 화면에 없다.
- 마지막 지목자 조명은 없다(0066-6 은 동시 투표에 해당 없음). 판결 순간 연출은 유지.
- 끊긴 동안 이름표 버튼은 `aria-disabled`(`WorldPick` `disabled`). 역할 확인 화면은 "끝나면 밤 대화가 공개돼요" 예고를 보인다.

0072-6. **검사.**
- 꺼진 장치 시험은 `skipIf(!RULESET.x)`(flakeGuard 는 RULESET 에 묶인 `skipIf` 만 허용). E2E 장치 흐름 일곱(`politics-badge`·`whisper`·`pin`·`runoff`·`runoff-tie`·`showdown`·`showdown-tie`)은 `skipByDefault`, `--only` 로만 돈다.
- 새 E2E `basic-off`(한 판 전체에서 꺼진 장치 부재)와 `basic-vote`(방장 + 4자 이름 손님 7, 8명 투표 기하). smoke 허용 경로를 좁혔고 누설 검사는 기본판 전수다.

## 계획이 실행 중 달라진 곳

- 13-01: 저장 방 정규화 게이트(`isLegacyNomination` 에 `RULESET.pickTurn &&`)를 시험 도우미가 마감마다 방을 evict 하는 탓에 Task 2 에서 Task 1 로 앞당겼다. 정적 검사의 "지운 이름" 목록에서 되살린 상수(`NOMINATION_MS`·`POINT_MIN_INTERVAL_MS`, 13-02 의 `POINT_BASE_MS`·`POINT_SPAN_MS`)를 뺐다.
- 13-02: flakeGuard 가 계획이 요구한 `skipIf(!RULESET.x)` 를 막아, RULESET 에 묶인 것만 허용하도록 좁혔다(간헐 실패를 덮는 우회는 여전히 금지).
- 13-03: 3초 깜빡임은 재접속에서 지난 투표에 다시 뜨지 않도록 단계 시작 기준 남은 시간만 켠다(UI#10 재접속 무이펙트).
- 13-04: 계획 목록 밖 시험(`badge`·`whisper`·`resultLog`·`gameMap`·`resultScreen`·`phaseScreens`)이 꺼진 장치를 전제해 실패하여 기본판 계약으로 정리했다.
- 13-05: 기본판에서 `[data-badge-live]` 빈 스크린리더 줄이 남아 있어 `RULESET.badge` 일 때만 그린다. `basic-vote` 는 계획의 봇 7 대신 4자 이름 손님 7 로 만들었다(아래 알려진 한계).

## 알려진 한계

- 첫 봇 이름이 8자 고정(0052-3·0062-8)이라 8자 이름 8명판은 투표에서 이름표 버튼이 겹칠 수 있다(PK3: 모이는 도중과 표가 쌓인 뒤 관측, 멈춘 뒤 별도 재측정은 안 함). UI-SPEC 의 기존 미결 항목(360px·8자 이름, #16)과 같은 계열이다. 진행에 지장이 없는 가장자리 문제라 고치지 않고 남긴다.
- 기존 간헐 실패: `continuity` "옛 방장이 돌아오면" 5초, `test/worker/bots.test.ts` 시각·난수 두 건, `perfbudget` B2 점광원 4>3, `night-sizes` 360×640 PK3, `ghost` G2.

## 이 결정이 정하지 않는 것

- 정통 판(장치 켜기) 고르기 화면과 그 판의 이름. Future Requirements 에 둔다.
- 투표 15초 체감. v3.0 끝 실테스트 뒤 `shared/game/phases.ts` 한 줄로 바꾼다.
- 사회자 자막·빛남이 3초 깜빡임(U-6)을 대체하는 방식. 14페이즈에서 정한다.
