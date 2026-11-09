# Roadmap: minifia

## Milestones

- ✅ **v1.0 MVP** — Phases 1~5 (3.1 포함, 6 삭제) (shipped 2026-10-30) → [상세](milestones/v1.0-ROADMAP.md)
- ✅ **v2.0 같은 공간** — Phases 6~12 (9.1·9.1.1 포함) (completed 2026-11-07, main 반영은 v3.0 실테스트 뒤) → [상세](milestones/v2.0-ROADMAP.md)
- 🚧 **v3.0 사회자와 증거** — Phases 13~15 (진행 중). `v3` 브랜치, Worker `minifia-v3`. 세 페이즈를 다 만들고 배포한 뒤 한 번에 실테스트
- 📋 **정식 출시** — 정식 이름·상표, 도메인, Capacitor 앱, 스토어 심사, 공개, 수익화 결정. 마지막 별도 마일스톤 (페이즈 미정)

## Phases

**Phase Numbering:**
- Integer phases: Planned milestone work. 이전 마일스톤에서 이어 번호를 매긴다
- Decimal phases: Urgent insertions (marked with INSERTED)

<details>
<summary>✅ v1.0 MVP (Phases 1~5) — SHIPPED 2026-10-30</summary>

- [x] Phase 1: 걷는 뼈대 (19/19 plans) — completed 2026-10-24
- [x] Phase 2: 낮 토론 (18/18 plans) — completed 2026-10-30
- [x] Phase 3: 밤과 아침 (12/12 plans) — completed 2026-10-30
- [x] Phase 3.1: 순차 주장과 역할 카드 (14/14 plans, INSERTED) — completed 2026-10-25
- [x] Phase 4: 처형과 승패 (35/35 plans) — completed 2026-10-28
- [x] Phase 5: 분위기와 캐릭터 (9/9 plans) — completed 2026-10-29
- ~~Phase 6: 플레이테스트~~ — 삭제 (결정 0041)

배포본: https://minifia.dhplay.workers.dev (`v1` 브랜치, 태그 `v1.0`)

</details>

<details>
<summary>✅ v2.0 같은 공간 (Phases 6~12) — COMPLETED 2026-11-07</summary>

- [x] Phase 6: 월드 뼈대 (23/23 plans) — completed 2026-11-01
- [x] Phase 7: 자유 채팅 (27/27 plans) — completed 2026-11-02
- [x] Phase 8: 낮 처형과 유령 (28/28 plans) — completed 2026-11-03
- [x] Phase 9: 밤과 아침 (30/30 plans) — completed 2026-11-04
- [x] Phase 9.1: 묶음 B 연출 (INSERTED)
- [x] Phase 9.1.1: 정치·박진감 장치 (INSERTED, 결정 0066)
- [x] Phase 10: 캐릭터·동작·의상 (9/9 plans)
- [x] Phase 11: 결과 공개와 다시 하기 (14/14 plans)
- [x] Phase 12: 소리와 마무리 (12/12 plans) — completed 2026-11-06

배포본: https://minifia-v2.dhplay.workers.dev (`v2` 브랜치, 태그 `v2.0`). 실기기 확인은 v3.0 실테스트 때 함께.

</details>

### 🚧 v3.0 사회자와 증거 (진행 중)

**Milestone Goal:** 처음 하는 사람도 사회자 안내만 따라 한 판을 끝내고, 게임이 만든 확인할 수 있는 사실로 의심하게 만든다 (`docs/playtest-v2.0-feedback.md`).

**공통 완료 조건:**
- 페이즈 끝에 `minifia-v3` 배포본에 올린다. v1.0·v2.0 주소는 건드리지 않는다.
- 테스트 방 봇이 그 페이즈까지의 흐름으로 한 판을 자동 완주한다.
- 누설 검사는 새 메시지·단계·신분에 맞게 넓힌다. 허용 경로를 초록을 위해 넓히지 않는다.
- 화면이 있으므로 각 페이즈는 `/gsd-plan-phase` 전에 `/gsd-ui-phase` 를 실행한다. 시안은 캔버스 2~3개 + 추천안으로 바로 구현(세부 결정 15).
- E2E 는 바뀐 흐름만 돌리고, 6종 폰 크기 회귀는 페이즈 끝에 한 번.

- [x] **Phase 13: 기본판 낮 흐름** - 낮이 토론 → 투표 → 최후 변론 → 찬반 → 처형 하나로 줄고, 정치 장치는 설정으로 꺼진다 (completed 2026-11-07, 배포 `5d855a5f`, 실기기 확인 3건은 v3.0 끝 실테스트)
- [x] **Phase 14: 사회자 진행과 도구 이름표** - 자막 띠 한 줄 + 알림음 + 빛나는 대상이 매 단계 할 일을 알리고, 모든 도구에 이름표·숫자 시간·역할 목표가 붙는다 (completed 2026-11-07, 배포 `d77e3dbf`, 결정 0073, 실기기 확인은 v3.0 끝 실테스트)
- [x] **Phase 15: 낮 심부름·목격 기록·밤 흔적** - 토론 전 40초 심부름과 목격 기록, 아침의 밤 흔적 하나가 게임이 만든 증거가 된다. 끝나면 v3.0 전체를 `minifia-v3` 에 배포 (completed 2026-11-07, 배포 `f882224e`)
- [x] **Phase 16: 단추 정리·심부름 증거** - 실테스트 피드백(결정 0077): 이름표 삭제, 단추 오른쪽 한 줄, 심부름 화면·컬러 에셋, 마피아 가짜 장소·흔적↔옷·마지막 목격 (completed 2026-11-08, 배포 `49b1ad57`, 결정 0079, 실기기 확인은 v3.0 끝 실테스트)
- [ ] **Phase 17: 튜토리얼 "첫 사건"** - 결정 0078: 처음 온 사람을 붙잡는 60~90초 미니 에피소드(목적·재미·흐름·직업), 포커스 조명, 웅얼 목소리, 첫 화면·방장 켜기 두 진입로

## Phase Details

### Phase 13: 기본판 낮 흐름

**Goal**: 처음 하는 사람이 따라가기 쉬운 단순한 낮 흐름 하나로 판이 돈다
**Depends on**: v2.0 (Phase 12)
**Requirements**: FLOW-01, FLOW-02, FLOW-03, FLOW-04, FLOW-05
**UI hint**: yes
**Success Criteria**:
  1. 낮 토론 다음은 모두 동시 투표이고, 최다 득표 1명이 최후 변론 → 찬반 → 처형으로 간다
  2. 투표가 동점이거나 0표면 처형 없이 밤으로 넘어간다
  3. 직업 주장 배지·귓속말·순차 지목·결선·3인 결전이 어느 화면·프레임에도 나타나지 않고, 한 곳의 설정값으로 끈다
  4. 찬반 기록 카드는 그대로 공개되고, 봇 방이 새 흐름으로 한 판을 완주한다

**Plans:** 6/6 plans executed (5 waves)

Plans:
**Wave 1**
- [x] 13-01-PLAN.md — 트레이서: 기본판 설정(RULESET) 한 곳 + 동시 투표 서버 흐름(15초, 동점·0표 → 밤, 산 셋도 토론) + 규칙 영역 시험 정리

**Wave 2**
- [x] 13-02-PLAN.md — 봇·넘기기·smoke·소켓 봇을 동시 투표로, 봇 방 자동 완주(FLOW-05)
- [x] 13-03-PLAN.md — 투표 화면 복원: 제목 "투표"·이름표 직접 누르기·선두·과반·위 알림·3초 깜빡임

**Wave 3**
- [x] 13-04-PLAN.md — 꺼진 장치 차단: 메시지 조용한 거절·view 게이트·누설 전수 검사·화면 진입점 끄기

**Wave 4**
- [x] 13-05-PLAN.md — E2E 동시 투표판 + basic-off(한 판 부재)·basic-vote(8명 기하), 장치 흐름 skipByDefault

**Wave 5**
- [x] 13-06-PLAN.md — 결정 0072·문서·폰 6종 회귀·성능·minifia-v3 배포·HANDOFF·push

### Phase 14: 사회자 진행과 도구 이름표

**Goal**: 화면이 사회자처럼 매 단계 무슨 일이 일어나고 내가 무엇을 하는지 알려 준다
**Depends on**: Phase 13
**Requirements**: HOST-01, HOST-02, HOST-03, HOST-04, HOST-05, TOOL-01, TOOL-02, TOOL-03
**UI hint**: yes
**Success Criteria**:
  1. 모든 단계 전환에 헤더 아래 자막 띠(존댓말)가 바뀌고 합성 알림음이 나온다(2초 낮 시작 → 토론 전환은 한 번으로 합침). 소리 끄기를 따른다
  2. 할 일이 있는 사람은 누를 대상이 빛나고, 할 일이 없는 사람은 지금 무슨 시간인지 안다
  3. 모든 도구에 한 단어 이름표가 있고 남은 시간은 막대 + 숫자로 보인다
  4. 역할 확인·역할 카드에 목표 한 줄이 있고, 자막·빛남이 다른 사람의 역할을 드러내지 않는다(누설 검사)

**Plans:** 9/9 plans executed (7 waves)

Plans:
**Wave 1**
- [x] 14-01-PLAN.md — 트레이서: 사회자 문구 표(hostLine.ts 순수)·자막 띠(HostBand)·방 화면 연결·시간 막대 + 초·띠 아래 자리 정리, HOST-05 읽기 경로 시험

**Wave 2**
- [x] 14-02-PLAN.md — 띠 하나로: data-guide 를 띠 문장으로, 기본판 헤더 안내 줄·시간 링 끄기(꺼진 장치 화면은 그대로), HOST-05 DOM 시험
- [x] 14-03-PLAN.md — 알림음 ui.host: 신호 host·감독·합성 레시피·시험 페이지·문서, 단계 전환마다 한 번(첫 프레임·재접속·낮 시작→토론 제외)

**Wave 3**
- [x] 14-04-PLAN.md — 빛남: 토큰 glow-ring·.is-call, 토론 입력칸·투표 이름표·[유언]·찬반·밤 얼굴 칸, 투표 깜빡임 대체(U-7), 36px 낮/밤 알림 끄기(U-5)

**Wave 4**
- [x] 14-05-PLAN.md — 역할 확인·목표 한 줄(TOOL-03)·카드 빛남·[내 역할] 이름표·대기실 [시작] 빛남
- [x] 14-06-PLAN.md — 이름표: 채팅 입력줄(동작·보내기·유언·새 글)·시트 닫기·결과 탭·결과 머리 [나가기]

**Wave 5**
- [x] 14-07-PLAN.md — 이름표: 소리·맵·옷장·넘기기·대기실 머리·옷장 시트 + 방 화면 전수 검사

**Wave 6**
- [x] 14-08-PLAN.md — E2E emcee-band·emcee-tools·emcee-leak·emcee-sound + 기존 흐름 기대 갱신 + 바뀐 흐름 로컬 실행

**Wave 7**
- [x] 14-09-PLAN.md — 결정 0073(0051 보완)·문서·폰 6종 회귀·nightload·minifia-v3 배포·HANDOFF·push

### Phase 15: 낮 심부름·목격 기록·밤 흔적

**Goal**: 말솜씨가 없어도 관찰로 참여할 수 있게, 게임이 확인할 수 있는 사실을 만든다
**Depends on**: Phase 14
**Requirements**: ERRAND-01, ERRAND-02, ERRAND-03, ERRAND-04, ERRAND-05, TRACE-01, TRACE-02, TRACE-03, DEPLOY-03
**UI hint**: yes
**Success Criteria**:
  1. 토론 전 40초 동안 각자 장소 3곳을 찾아 처리하고, 다른 사람은 근처에 있을 때만 보인다
  2. 마피아도 겉보기 같은 가짜 목록을 받고, 3곳을 마친 사람만 토론 때 자기 목격 기록(장소·순서)을 본다
  3. 밤에 모든 산 사람이 같은 방식으로 한 명을 고르고, 피해자가 나온 아침에 사회자가 흔적 하나를 공개한다(확정 아님)
  4. v3.0 전체가 `minifia-v3` 에 배포되고 봇 방이 심부름·흔적을 포함한 한 판을 완주한다

**Plans:** 10/10 plans executed (7 waves)

Plans:
**Wave 1**
- [x] 15-01-PLAN.md — 트레이서: 심부름 단계(errand 40초)·장소 3곳 배정(마피아도 같은 모양)·{t:"errand"} 처리·view.me.errand·봇 errandGo/errandAct, 봇 방 완주 + PhaseId 확장 따라가기

**Wave 2**
- [x] 15-02-PLAN.md — 근처 사람만 보이는 위치(받는 사람 집합·근처 snap·잘린 구간)·1초 표본 목격 기록·me.record(3곳 완료만, 본인에게만)
- [x] 15-04-PLAN.md — 심부름 부품: 장소 아이콘 18개·낱말 표·진행/다음 장소 판정·표지 배치 계획·ErrandMarker/ErrandDock·사회자 errand 문구와 빛남

**Wave 3**
- [x] 15-03-PLAN.md — 밤 선택 통일(모든 역할 같은 메시지·응답, 나 포함 전원, 마피아 접근 걷기·밤 위치 차이 삭제)·아침 흔적(피해자를 고른 사람 중 한 명의 의상 조각, 없으면 없음)·봇의 밤 선택
- [x] 15-05-PLAN.md — 심부름 화면 통합: near snap 등장·퇴장·런타임 투영 콜백·WorldStage errand 층(표지·화살표·근처 링)·GameMap 독·[처리]·빛남·유령·역할 무관 DOM

**Wave 4**
- [x] 15-06-PLAN.md — 누설 검사 확장(역할 다섯 시점 프레임 전수·공유 view 비교·leak 허용 경로)과 smoke·소켓 봇·UAT 방 스크립트의 새 단계 반영
- [x] 15-07-PLAN.md — 목격 기록 카드·[기록] 이름표·witness 문구/빛남, 아침 흔적 카드·trace 띠·도착 소리 한 번

**Wave 5**
- [x] 15-08-PLAN.md — 밤 화면 통일: 모든 역할 같은 얼굴 목록·마피아 전용 밤 화면(이름표 선택·접근·고리·밤 채팅) 삭제·마피아 선택 수 배지·밤 사회자 줄(night.citizen)

**Wave 6**
- [x] 15-09-PLAN.md — E2E errand·witness·trace 흐름(폰 6종 영역 검사)·판정 함수·옛 흐름 기대 갱신·바뀐 흐름 로컬 실행

**Wave 7**
- [x] 15-10-PLAN.md — 결정 0074·지도 문서·폰 6종 회귀 한 번·성능(nightload 심부름 장면)·minifia-v3 배포(계정 가드)·HANDOFF·push

### Phase 16: 단추 정리·심부름 증거

**Goal:** 2026-11-08 실테스트 피드백(결정 0077)으로, 단추가 글 이름표 없이 한 모양으로 정리되고, 심부름과 아침 흔적이 실제로 의심의 근거가 된다. 튜토리얼은 17페이즈(결정 0078).
**Requirements**: TOOL-04, BTN-01, BTN-02, ERRAND-06, ERRAND-07, ERRAND-08, ASSET-01, EVID-01, EVID-02, EVID-03, DEPLOY-04
**Depends on:** Phase 15
**Plans:** 10/10 plans executed (8 waves)

**Success Criteria:**
1. 아이콘 단추 아래 글 이름표가 없다(접근성 이름은 남는다)
2. 소리·맵·봇·옷장 단추가 오른쪽 한 줄 같은 크기 원으로 모이고 머리에는 나가기·공유만 있다
3. 심부름 시작 카드·장소 빛·방향 화살표·장소 [처리]가 있고, 장소·아이템 아이콘이 컬러 에셋(Design 캔버스 승인본 A)이다
4. 마피아는 처리되지 않는 가짜 장소 하나를 받고(겉보기·네트워크로 역할이 드러나지 않음), 아침 흔적은 같은 옷을 입은 사람을 표시하며, 피해자를 마지막으로 본 사람이 공개된다

Plans:
**Wave 1**
- [x] 16-01-PLAN.md — 트레이서: 마지막 목격 공개(심부름 표본 errandLast → 아침 morning.seen → 낮 끝까지 day.evidence → 증거 카드 2행)·아침 흔적 5초/상한 16초·누설 시험 확장
- [x] 16-02-PLAN.md — 컬러 에셋 A 25개 이식(변환 스크립트·design/v3.0/assets 사본·placeArt.tsx·--check)

**Wave 2**
- [x] 16-03-PLAN.md — (TDD) 마피아 가짜 장소: errandFake 배정·처리 제외·응답 동일·봇 목표 순서·누설
- [x] 16-04-PLAN.md — 아이콘 단추 이름표 삭제(이름표 속성·라벨 span, 접근성 이름 필수), 시험·E2E 이름표 판정 뒤집기

**Wave 3**
- [x] 16-05-PLAN.md — 단추 크기 규칙: 머리 44 정사각·입력줄 48 원·닫기 × 44, E2E 높이 판정에서 이름표 보정 삭제

**Wave 4**
- [x] 16-06-PLAN.md — 오른쪽 한 줄(SideColumn): 소리·맵(방장)·봇(방장)·옷장 52 원, 두 열 접기, 독 아랫변 B+64

**Wave 5**
- [x] 16-07-PLAN.md — 심부름 64 컬러 타일·후광·발밑 방향 화살표·장소 위 [처리], errand.act 문구

**Wave 6**
- [x] 16-08-PLAN.md — 심부름 시작 카드 2초·진행 점 3·아래 독 삭제(패널 없는 스테이지)

**Wave 7**
- [x] 16-09-PLAN.md — 아침 증거: 같은 옷·마지막 목격 이름표 표시(낮 끝까지)·최종 증거 카드·근거 문구·옛 선 그림 삭제

**Wave 8**
- [x] 16-10-PLAN.md — 네 단계(재개 지점 포함): 로컬 전체 검증(폰 6종 회귀·성능) → 결정 0079·지도 문서 → minifia-v3 배포(계정 가드)·배포본 확인 → HANDOFF·push

### Phase 17: 튜토리얼 "첫 사건"

**Goal:** 처음 온 사람이 60~90초 미니 에피소드로 이 게임의 목적·재미·한 판 흐름·직업별 할 일을 겪어 알고, 흥미를 느껴 첫 판으로 이어진다(결정 0078).
**Requirements**: TUT-01, TUT-02, TUT-03, TUT-04, TUT-05, DEPLOY-05
**Depends on:** Phase 16
**Plans:** 4/12 plans executed (6 waves)

**Success Criteria:**
1. 첫 화면(방 만들기·참가 전)에서 튜토리얼을 혼자 시작할 수 있고, 끝나거나 [건너뛰기]하면 첫 화면으로 돌아온다
2. 방장이 '튜토리얼 후 진행'을 켜고 시작하면 모두 튜토리얼을 마친 뒤(또는 시간이 다 되면) 본게임이 시작되고, 끄면 바로 시작한다
3. 에피소드가 오프닝(밤·비명·빈자리) → 심부름 [처리]·목격 → 아침 흔적↔같은 옷↔목격 연결 → 이름표 투표·정답 연출 → 직업 카드 4종 순으로 이어지고, 직접 누르는 순간마다 대상에 램프 빛 테두리가 깜빡인다(배경 흐림·포인터 없음, 0078-8). 사회자는 파형+자막 띠, 첫 화면 진입은 큰 카드 "튜토리얼 진행"(0078-9)
4. 사회자 웅얼 목소리와 새 효과음·애니메이션이 Design 캔버스 승인본대로 들어가고, 외부 소리 파일 없이 Web Audio 합성으로 난다
5. 튜토리얼은 서버 게임 상태를 바꾸지 않고(함께 진행의 끝 신호만 보냄) 역할 정보를 읽거나 보내지 않는다

Plans:
**Wave 1**
- [x] 17-01-PLAN.md — 트레이서: 함께 진행 서버 게이트(start.tutorial → tutorial 단계 → tutorialDone → assigning, tutorialPassed 지움)·PhaseId 연쇄(Record 표·시험 표 한 커밋)
- [x] 17-02-PLAN.md — 사회자 웅얼 목소리(voice.syl·voice.ts)와 효과음 tut.* 12개, 소리 고정값 70
- [x] 17-03-PLAN.md — (TDD) 첫 사건 대본: 장면 표·문구·출연·가짜 view·로컬 send 어댑터·정적 가드
- [x] 17-11-PLAN.md — 문서: 17페이즈 요구사항 6개 등록(TUT-01~05·DEPLOY-05)·ROADMAP 요구사항 줄·결정 0080 계획 단계 기록

**Wave 2**
- [ ] 17-04-PLAN.md — 트레이서: TutorialScreen(실제 GameMap·WorldStage + 로컬 어댑터)·포커스 깜빡임 테두리·파형 자막 띠·진행 점·[건너뛰기]·[다음]·허용 목록 밖 차단
- [ ] 17-12-PLAN.md — 공개 진행 값 view.tutorial·me.tutorialDone·끊김 재검사·광장 snap·경계 시험·누설 검사 확장(DEPLOY-05)

**Wave 3**
- [ ] 17-05-PLAN.md — 장면 4 목격·장면 5 증거 연결(선·수식)·장면 6 지목과 정체 공개·오답 도움
- [ ] 17-06-PLAN.md — 첫 화면 큰 카드 "튜토리얼 진행"·혼자 하기·마무리 카드·작은 단추(minifia.tutorial.seen)
- [ ] 17-07-PLAN.md — 함께 진행 화면: 방장 스위치(+76)·RoomScreen tutorial 분기·끝났음 하나·기다림 화면·재접속·띠/알림음 정리

**Wave 4**
- [ ] 17-08-PLAN.md — 장면 1 오프닝(램프·비명·밤)·장면 7 직업 카드 4종

**Wave 5**
- [ ] 17-09-PLAN.md — E2E tutorial-solo(폰 6종)·tutorial-together, 판정 함수, 로컬 실행

**Wave 6**
- [ ] 17-10-PLAN.md — 네 단계(재개 지점 포함): 로컬 전체 검증(폰 6종 회귀·성능) → 결정 0080 완성·지도 문서 → minifia-v3 배포(계정 가드)·배포본 확인 → HANDOFF·push

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 13. 기본판 낮 흐름 | v3.0 | 6/6 | Complete (실기기 확인은 v3.0 끝) | 2026-11-07 |
| 14. 사회자 진행과 도구 이름표 | v3.0 | 9/9 | Complete (실기기 확인은 v3.0 끝) | 2026-11-07 |
| 15. 낮 심부름·목격 기록·밤 흔적 | v3.0 | 10/10 | Complete (배포 `f882224e`) | 2026-11-07 |
| 16. 단추 정리·심부름 증거 | v3.0 | 10/10 | Complete (배포 `49b1ad57`, 실기기 확인은 v3.0 끝) | 2026-11-08 |
| 17. 튜토리얼 "첫 사건" | v3.0 | 4/12 | In Progress | - |

## Backlog

### Phase 999.1: Follow-up — Phase 07 deferred UAT follow-up: Test 5 (BACKLOG)

**Goal:** Resolve the UAT checkpoint deferred during Phase 07 verification
**Source phase:** 07
**Deferred at:** 2026-11-02 during /gsd-verify-work 7 session completion
**Follow-ups:**
- [ ] Test 5: iPhone 로비 5분 채팅 부하 체감·열감 (bots.mjs --count 7 --prod --chat 2) — 모든 개발 뒤 실기기 플레이테스트 (deferred 2026-11-02)

### Phase 999.2: Follow-up — Phase 07 deferred UAT follow-up: Test 6 (BACKLOG)

**Goal:** Resolve the UAT checkpoint deferred during Phase 07 verification
**Source phase:** 07
**Deferred at:** 2026-11-02 during /gsd-verify-work 7 session completion
**Follow-ups:**
- [ ] Test 6: ?chat-mock=1 다섯 줄 iPhone 실기기 확인(6페이즈 이월 표 D) — 모든 개발 뒤 실기기 플레이테스트 (deferred 2026-11-02)

### Phase 999.3: Follow-up — Phase 07 deferred UAT follow-up: Test 7 (BACKLOG)

**Goal:** Resolve the UAT checkpoint deferred during Phase 07 verification
**Source phase:** 07
**Deferred at:** 2026-11-02 during /gsd-verify-work 7 session completion
**Follow-ups:**
- [ ] Test 7: Android Chrome·삼성 인터넷·카카오톡 인앱(iOS·Android) 입력칸 검사 1·2·4 (CHAT-05, 로드맵 성공 기준 3) — 모든 개발 뒤 실기기 플레이테스트 (deferred 2026-11-02)

### Phase 999.4: Follow-up — Phase 07 deferred UAT follow-up: Test 9 (BACKLOG)

**Goal:** Resolve the UAT checkpoint deferred during Phase 07 verification
**Source phase:** 07
**Deferred at:** 2026-11-02 during /gsd-verify-work 7 session completion
**Follow-ups:**
- [ ] Test 9: 로비 이동 체감 재확인(결정 0059 예측 이동·섞기, 자동 W11·W12 통과) — 모든 개발 뒤 실기기 플레이테스트 (deferred 2026-11-02)

### Phase 999.5: Follow-up — Phase 08 device checks (BACKLOG)

**Goal:** 8페이즈 낮 처형·유령 화면의 실기기 확인을 모든 개발 뒤 한꺼번에 처리한다(사용자 결정 2026-11-02·2026-11-03). 8페이즈 완료를 막지 않는다.
**Source phase:** 08
**Deferred at:** 2026-11-03 during 08-26 (docs, deploy, hand-off)
**Follow-ups:** (절차와 칸은 `.planning/milestones/v2.0-phases/08-day-execution-ghost/08-DEVICE-CHECKS.md`)
- [ ] iPhone 16 Pro 낮 흐름 5분 평균 55fps·끊김·열감 (dayload 렌더 측정은 08-25 에서 미룸, 사용자 결정 2026-11-03) — 기준(55fps, 끊김 5회)은 낮추지 않는다
- [ ] 단계 조명 읽힘(지목 무대 조명·변론 스포트라이트·밤 달빛·아침), 유령 이름표 글자 대비(불투명도 0.6에서 약 1.9~2.5:1, 픽셀 근사), 밤 이름표 위치(-144~12, 대부분 화면 밖 — 9페이즈 밤 개편 전에 확인)
- [ ] 지목 이름표 버튼 손가락 누르기, 키보드 열림에서 찬반 줄 숨김, 8자 이름표 가장자리 잘림(E8 #29), 밤 알약 패널 144.8px 대 UI-SPEC 157
- [ ] 사람 눈 확인 연출: 지목 손가락·거부·선두 맥박·도장·알림 타이밍, 찬반 패널 높이 207/299, 유령 떠오름·부유, 36px 알림 줄바꿈(360px), 역할 칩 등장, 3D 발밑 고리 색, 밤 조명, 아침 36px 알림 가독, 밤 알약 높이, 아이콘 버튼과 시간 링 간격, 역할 배정과 낮 시작 사이 가림막 타이밍
- [ ] Android Chrome·삼성 인터넷·카카오톡 인앱에서 낮 흐름(입력칸·지목 버튼)
- [ ] 정리 후보(코드): `scripts/uat-vote.mjs`(옛 처형 여부 투표 시나리오, `EXECUTION_PHRASE_COUNT` 복사본 포함)·`scripts/uat-night.mjs` 의 `EXEC_VOTE_MS` 복사본, `src/styles/day.css` 의 `.mf-dayscene`·`.mf-sceneintro` 규칙 — 12페이즈 v1.0 잔재 일괄 점검 때 함께 지운다

### Phase 999.6: Follow-up — Phase 09 device checks and team test (BACKLOG)

**Goal:** 9페이즈 밤·아침의 실기기 확인과 팀(4명 이상) 한 판 관찰(ROADMAP 성공 기준 5)을 모든 개발 뒤 한꺼번에 처리한다(사용자 결정 2026-11-02). 9페이즈 완료를 막지 않는다.
**Source phase:** 09
**Deferred at:** 2026-11-03 during 09-23 (docs, deploy check, hand-off)
**Follow-ups:** (절차와 칸은 `.planning/milestones/v2.0-phases/09-night-morning/09-DEVICE-CHECKS.md`)
- [ ] iPhone 16 Pro 낮 + 밤 + 아침 5분 평균 55fps·끊김 5회 이하·열감 — 크롬 4× 스로틀 nightload 숫자(평균 59.99fps, 끊김 0)와 나란히 대조, 기준은 낮추지 않는다
- [ ] 시민 편 어둠 가독·헤더 글자 대비 4.5:1, 아침 가독(분필·36px 알림·유언 카드·쪽지 카드), 밤 이름표 위치가 9페이즈 카메라로 해소됐는지(8페이즈 B8)
- [ ] 유언 시트 + iOS 키보드, 얼굴 칸 누르기(4자·8자 이름), 마피아 이름표 버튼 누르기·확정 도장
- [ ] 맥박·번쩍임 체감(모션 줄이기 포함), 막 타이밍과 분필 순서, 카드 시간순 겹침, 360×560 경찰 밤 8자 이름 한계
- [ ] Android Chrome·삼성 인터넷·카카오톡 인앱에서 밤·아침 흐름(유언 시트 입력칸·얼굴 칸)
- [ ] 팀(4명 이상) 한 판 관찰 ①~⑥(시민 30초 긴장, 확정 걸리는 시간·실패 원인, 아침 화제성, 위치 되돌림, 소리 없는 긴장 연출, 대면 마피아 느낌) — 결과로 10페이즈 이후 투자를 정한다
