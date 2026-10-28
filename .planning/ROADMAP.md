# Roadmap: minifia

## Milestones

- 🚧 **v1.0 MVP** - Phases 1-6 (진행 중)
- 📋 **v1.1 피드백 확장** - 플레이테스트 후 REQUIREMENTS.md 의 v2 후보(다시 하기, 사운드, 관전 등)에서 골라 올린다 (후보, 페이즈 미정)
- 📋 **v2.0 정식 출시** - 정식 이름·상표, 도메인, Capacitor 앱, 스토어 심사, 공개, 수익화 결정. 마지막 별도 마일스톤 (페이즈 미정)

## Overview

각자 다른 곳에 있는 친구들이 링크로 들어와 앱 안에서만 소통하며 정통 마피아 한 판을 끝까지 하게 만든다 (비대면, 결정 0005). 먼저 Cloudflare 에 배포된 주소에서 폰 여러 대가 같은 방에 들어가 역할을 받는 걷는 뼈대를 세우고(1), 직업 공개와 빠른 메시지·이모티콘으로 하는 낮 토론(2), 밤과 아침(3), 처형과 승패(4)를 게임 순서대로 얹어 한 판이 끝까지 돌아가게 한다. 페이즈마다 게임 흐름의 한 구간을 서버 규칙·화면·소통까지 끝내고, 이어 무거운 분위기와 캐릭터, 세로 폰 화면에 맞춘 안내를 입힌 뒤(5), 실제 친구들과 해 보며 규칙 수치를 조정한다(6). 모든 페이즈의 검증은 배포된 주소에서 한다. v1.0 에는 사운드, 관전, 다시 하기, 자유 채팅을 넣지 않았다. 친구들의 반응을 보고 v1.1 에서 고른다.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: 걷는 뼈대** - 배포된 주소에서 폰 여러 대가 같은 방에 들어가 각자 자기 역할만 받는다 (completed 2026-10-24)
- [ ] **Phase 2: 낮 토론** - 낮마다 직업을 공개하고, 빠른 메시지와 이모티콘으로 의심·직업 주장을 주고받으며 토론한다
- [ ] **Phase 3: 밤과 아침** - 마피아·경찰·의사가 정체를 들키지 않고 밤 행동을 하고 아침에 결과가 발표된다
- [x] **Phase 3.1: 순차 주장과 역할 카드** (INSERTED) - 한 명씩 직업 주장, 평문 채팅, 유저 기록 카드, 역할 카드·역할별 일지 (completed 2026-10-25)
- [ ] **Phase 4: 처형과 승패** - 투표·최후 변론·찬반·처형을 거쳐 한 판이 승패로 끝난다
- [ ] **Phase 5: 분위기와 캐릭터** - 무거운 분위기와 특색 있는 캐릭터, 세로 폰 화면에서 설명 없이 따라올 수 있는 안내
- [ ] **Phase 6: 친구 플레이테스트** - 친구들이 실제로 한 판을 끝까지 하고 다시 하고 싶은지 확인해 규칙을 조정한다

## Phase Details

### Phase 1: 걷는 뼈대

**Goal**: As a 친구 모임의 플레이어, I want to 링크로 방에 모여 내 역할 카드만 받아 보기, so that 서로의 역할을 모른 채 각자 폰으로 한 판을 시작할 수 있다.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: ROOM-01, ROOM-02, ROOM-03, CONN-01, DEPLOY-01, GAME-01, ROLE-01, ROLE-02
**Success Criteria** (what must be TRUE):
  1. Cloudflare에 배포된 주소로 폰 2대 이상이 같은 방에 들어가 역할을 받는다.
  2. 방장이 방을 만들면 4자리 코드와 참가 링크가 나오고 공유 버튼으로 카카오톡 등에 보낼 수 있다. 다른 사람은 링크나 코드로 설치·로그인 없이 닉네임만 입력해 들어와 대기실 목록에 바로 나타난다.
  3. 4명 이상 모인 방에서 방장이 시작하면 인원 구성표대로 역할이 배정되고, 각자 자기 역할 카드만 본다. 마피아는 동료 마피아도 본다. 다른 폰의 화면은 물론 네트워크 메시지에서도 남의 역할은 확인할 수 없다.
  4. 방장이 시작하면 모든 폰에 "직업을 배정하고 있습니다…" 구간(약 3초)이 함께 나온 뒤 역할 확인 15초로 넘어가고, 카운트다운이 모든 폰에서 같은 시각에 끝나면 모든 폰이 "낮이 되었습니다" 화면으로 넘어간다(결정 0007). 폰 화면을 껐다 켜거나 탭을 새로고침해도 같은 자리·같은 역할로 돌아온다.
  5. 코드를 고치고 `wrangler deploy` 를 다시 하면 주소는 그대로이고 새 버전이 보인다.

**Plans**: 19/19 plans complete (01-04~01-14 는 2026-10-23 UI-SPEC 개정 2·결정 0012 기준으로 다시 계획, 01-15 는 검증 GAP-1 갭 클로저, 01-16·01-17 은 UAT 갭 클로저 G-01-9·G-01-1b, 01-18·01-19 는 G-01-9 재진단 갭 클로저)

Plans:
**Wave 1**
- [x] 01-01-PLAN.md — 배포 정체성 결정(Worker 이름·DO 선언)·패키지 확인·고정 버전 스캐폴드 (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 01-02-PLAN.md — 트레이서: [방 만들기] → Room DO → WebSocket → 대기실, 개인 계정 첫 배포 (wave 2)
- [x] 01-03-PLAN.md — 순수 규칙: 닉네임·역할 배정·자리 배치·시계 오프셋·공유 (TDD, wave 2)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 01-04-PLAN.md — 서버 대기실 규칙 코어: 참가·나가기·내보내기·연결자 4명 시작 조건·미리보기 앉은 사람·와이어 타입 (TDD, wave 3)
- [x] 01-05-PLAN.md — 새 첫 화면(S-01)에서 방 만들기: 디자인 시스템 기본 부품·문구 매핑·그림 URL 헬퍼 (wave 3)

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 01-06-PLAN.md — 코드·링크로 참가: S-01 코드 줄·S-02 링크 참가(미리보기 폴링)·입장 정보 이어받기·오류 화면 (wave 4)
- [x] 01-07-PLAN.md — 서버 단계 코어: 단계 표·tick·시작(끊긴 사람 포함 배정)·플레이어별 역할 뷰 (TDD, wave 4)
- [x] 01-08-PLAN.md — 역할 확인 부품: 공통 타이머(m:ss)·카드 면 전이·역할 카드·아이콘 (wave 4)

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 01-09-PLAN.md — Room DO·HTTP 배선: 미리보기·참가·나가기·내보내기·재접속·시작·알람 다중화·프레임 누출 검사 (wave 5)
- [x] 01-10-PLAN.md — 대기실 S-03: 원근 테이블·연결자 기준 시작·입장/방장 토스트·등장 애니메이션 (wave 5)
- [x] 01-11-PLAN.md — 연결 끊김·재접속: 상태기계·52px 띠·30초 포기 화면·핑 표본 오프셋 (wave 5)

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 01-12-PLAN.md — 대기실 시트: 나가기·내보내기 확인 시트·공유 시트(C-03)·임시 스타일 정리 (wave 6)

**Wave 7** *(blocked on Wave 6 completion)*
- [x] 01-13-PLAN.md — 배정 연출(S-04)·역할 확인(S-05)·낮 시작(S-06)·내 역할 시트(C-01) (wave 7)

**Wave 8** *(blocked on Wave 7 completion)*
- [x] 01-14-PLAN.md — 배포본 full 스모크·OG·캐시·토큰 검사·재배포·HANDOFF·push·실기기 UAT (wave 8)

**Gap closure** *(01-VERIFICATION.md GAP-1)*
- [x] 01-15-PLAN.md — CR-01·IN-07: 닉네임 비교 키에서 보이지 않는 문자(ZWJ·변형 선택자·결합 문자) 무시, 채움 문자·빈 키 거부, 서버 참가 우회 차단 (TDD, gap_closure, wave 1)

**Gap closure** *(01-UAT.md 갭 G-01-9·G-01-1b — G-01-1a·G-01-2·G-01-5 는 디자인 세션 몫)*
- [x] 01-16-PLAN.md — G-01-9: 폰에서 [내 역할]·공유·나가기 시트가 위에 떴다 내려가는 모션 — 진입 전 초기 위치 CSS 고정 + 두 프레임 뒤 열림 클래스 + 60ms 폴백 + preventScroll, 실기기 확인 checkpoint (TDD, gap_closure, wave 1)
- [x] 01-17-PLAN.md — G-01-1b: 입력 라벨·힌트·구분선·꺼진 버튼 글자 대비 올리기(기존 토큰만, 대비 계산 테스트, UI-SPEC R19 기록) (TDD, gap_closure, wave 1)

**Gap closure** *(01-VERIFICATION.md G-01-9 재진단 — 01-16 실기기 FAILED 뒤. G-01-1a·G-01-2·G-01-5 는 디자인 세션 몫)*
- [x] 01-18-PLAN.md — G-01-9 진단: `?sheetdebug=1` 지연 로드 계측(뷰포트·dvh/svh/lvh·다이얼로그/시트 위치, 판정 규칙 classifyTrace) → iPhone Safari 세 시트 실기기 계측 → 01-UAT.md diagnosis.branch 기록 (TDD, gap_closure, wave 2)
- [x] 01-19-PLAN.md — G-01-9 수정: diagnosis.branch 에 묶인 수정만(A 뷰포트 단위 통일 / B 그림 자리 예약 / C 합성 힌트 / D 열린 동안 스크롤 잠금 / none 재계획) → 세 시트 실기기 재확인 → 재배포·push 사용자 결정 (TDD, gap_closure, wave 3)

**Notes**: 화면은 실시간 3D 없이 2.5D(원근 타원 테이블, 그림자·조명 레이어)로 만든다(결정 0008). 패키지와 버전은 계획에서 확정한다. 이탈 플레이어 처리(CONN-02)는 1페이즈 논의에서 확정했다. 화면 구성은 단순하게 두되, 이 구간의 몰입 요소(참가자 등장 액션, 배정 대기 연출, 카운트다운 강조)는 기본형으로 넣는다 (결정 0006). 전체 톤·캐릭터·연출 통일은 5페이즈.

### Phase 2: 낮 토론

**Goal**: 역할 확인(이후로는 아침) 뒤 낮이 되면 각자 직업을 공개하고, 낮 토론 동안 각자 다른 곳에 있는 생존자들이 빠른 메시지와 이모티콘으로 의심·직업 주장을 주고받아, 앱만으로 토론이 성립한다.
**Depends on**: Phase 1
**Requirements**: DAY-01, DAY-02, COMM-01, COMM-02, COMM-04
**Success Criteria** (what must be TRUE):
  1. 낮이 시작되면 생존자가 자리 순서대로 한 명씩(8초) 직업 선택지와 [말 안 함] 중 하나를 주장한다. 주장은 채팅에 말로 올라오고, 낮에 캐릭터를 탭하면 유저 기록 카드에서 날짜별 주장을 본다(결정 0023).
  2. 낮 토론 90초 동안 생존자 목록과 남은 시간이 보이고, 토론은 서버 타이머대로 끝난다(방장 연장·넘기기 없음, 결정 0017).
  3. 생존자가 템플릿을 골라 대상 플레이어·직업을 채워 보내면(예: "[○○] 의심돼요", "[○○]는 [경찰]이었어요"), 모든 폰의 채팅(최근 세 줄·채팅 내역)에 바로 보이고 보낸 사람 이름표가 잠깐 반전된다. 거짓 주장도 그대로 보내진다.
  4. 이모티콘을 누르면 보낸 사람 캐릭터 위에 잠깐 떴다 사라진다.
  5. 토론 단계가 아닐 때(직업 공개 중 등) 보낸 메시지, 자유 텍스트, 2초 안에 다시 보낸 메시지(화면은 2초 잠금, 서버는 1.8초 한도 — 결정 0016-6)는 서버가 거부해 다른 폰에 나타나지 않는다. 탈락자·아침 중 메시지 거부와 밤의 마피아 전용 채팅(마피아가 아닌 소켓에는 전달 안 됨, 결정 0019)은 탈락과 밤이 생기는 3페이즈에서 확인한다.
  6. 폰 세로 화면에서 메시지를 고르고 보내는 데 세 번 이하로 누른다(템플릿 → 대상·직업 → 보내기). 단 대상과 직업이 모두 필요한 '[○○]는 [직업]이었어요' 만 네 번(템플릿 → 대상 → 직업 → 보내기, 사용자 확정).

**Plans:** 18/18 plans executed (02-12~02-18 은 UAT 갭 클로저 G-02-1·G-02-2, 결정 0017 승인 시안 `design/screens/day-v3/SPEC.md` 기준)

Plans:
**Wave 1**
- [x] 02-01-PLAN.md — 낮 루프 트레이서: 와이어 계약 전체·낮 네 단계(dayAnnounce·claim·claimReveal·discussion)·tick 진입 훅·임시 루프·rolesInPlay·기존 테스트 이전·낮 시작 발표 개정·DayScene 장면 뼈대 (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 02-02-PLAN.md — 직업 공개 규칙: 선택지·선택·이번 낮 초기화·마감 확정·말 바꿈(규칙표) (TDD, wave 2)
- [x] 02-03-PLAN.md — 낮 토론 규칙: 빠른 메시지 5종 검증·보관 20·이모티콘·합산 2초 쿨다운·방장 연장/넘기기·isAlive (TDD, wave 2)
- [x] 02-06-PLAN.md — 클라이언트 net·문장: emoji 수신·onEvent·useSeatFloats(말풍선 3초·이모티콘 2초·재접속 복원)·messageText(은/는) (wave 2)
- [x] 02-07-PLAN.md — 테이블 위 표시 부품: 아이콘 11개·SeatFloat·ClaimTag(말 바꿈)·완료 알약·Chip (wave 2)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 02-04-PLAN.md — 플레이어별 낮 뷰(claim 단계 비공개·공개 주장·메시지·연장 길이)·허용 경로 전수 누출 검사·옛 방 정규화 (TDD, wave 3)
- [x] 02-08-PLAN.md — 직업 공개 화면: ClaimPanel(낙관적 선택·어제 선택)·완료 알약·공개 연출(동시 팝·흔들림)·주장 알약 (wave 3)
- [x] 02-10-PLAN.md — 빠른 메시지 시트(문구→대상→직업→보내기, 미리보기)·이모티콘 4×2 트레이 (wave 3)

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 02-05-PLAN.md — Room DO 배선: strict 스키마·claim/say/emoji/extend/skip 핸들러·이모티콘 방송·알람 재설정·생성자 정규화·워커 통합 테스트 (wave 4)
- [x] 02-09-PLAN.md — 낮 토론 화면: MessageLog·DiscussionControls(합산 쿨다운·오류 이벤트·방장 연장/넘기기·토스트)·말풍선/이모티콘 배선 (wave 4)

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 02-11-PLAN.md — 배포본 full 스모크(낮 한 바퀴·누출·거부)·재배포·결정 0016·ROADMAP 성공 기준 정정·HANDOFF·push·실기기 확인 모음 (wave 5)

**Gap closure** *(02-UAT.md 갭 G-02-1 낮 화면 재설계·결정 0017, G-02-2 RATE_LIMITED 오탐)*

**Wave 1**
- [x] 02-12-PLAN.md — 빠른 메시지는 서버에 보관하지 않고 chat 이벤트로 방송만(state 방송 없음·뷰에 messages 없음·옛 저장 방 정리), 서버 전송 한도 1800ms(클라이언트 잠금 2000ms 유지) (TDD, gap_closure, wave 1)
- [x] 02-13-PLAN.md — 닉네임 최대 5자(NICKNAME_MAX_GRAPHEMES, 서버 API 거부)와 "1~5자" 안내 문구 (TDD, gap_closure, wave 1)
- [x] 02-14-PLAN.md — 고정 테이블 배치 함수(280×108·rx132/124·ry100·캐릭터 72, 같은 픽셀 좌표, 짧은 장면은 높이에 맞춰 위로)와 자동 배치 검사(폭 352~406·높이 300~460), DayTable 부품(2줄 이름표·…/✓ 완료/주장/-·↺·왕관·반전·이모티콘) (TDD, gap_closure, wave 1)

**Wave 2** *(blocked on 02-12)*
- [x] 02-15-PLAN.md — 방장 +30초 연장·넘기기 제거: 화면 방장 줄·서버 extend/skip(BAD_MESSAGE)·extendUsed·ALREADY_EXTENDED·진입 훅 정리 (TDD, gap_closure, wave 2)

**Wave 3** *(blocked on 02-12, 02-14, 02-15)*
- [x] 02-16-PLAN.md — 낮 세 단계 장면을 DayTable 로 교체(머리 위는 이모티콘만·보낸 사람 반전·아랫줄 공개 연출), 채팅 줄은 폰 메모리(useDayChat, 복원 없음), 옛 낮 전용 층·SeatFloat·ClaimTag·seat.css 삭제 (TDD, gap_closure, wave 3)

**Wave 4** *(blocked on 02-16)*
- [x] 02-17-PLAN.md — 하단 패널 세 단계 같은 높이 157, 직업 공개 한 줄 칩(체크 배지), 채팅 세 줄 + ^ "채팅 내역" 모달, [빠른 메시지][이모티콘] 한 줄 (TDD, gap_closure, wave 4)

**Wave 5** *(blocked on 02-13, 02-17)*
- [x] 02-18-PLAN.md — 스모크·봇 시나리오를 chat 이벤트·타이머 대기로 고치고 배포, 배포본 full 스모크 5·8명·봇 UAT 5·8명(2000ms 오탐 0), ROADMAP·REQUIREMENTS·결정 0016·UI-SPEC 정정, UAT 메모·HANDOFF·push, 실기기 확인 목록 (gap_closure, wave 5)

**Notes**: 3페이즈가 생기기 전까지는 토론이 끝나면 다음 낮(직업 공개)으로 돌려 말 바꿈 표시를 검증한다. 직업 공개 방식(실시간·동시 공개), 선택지 범위(이번 판에 있는 직업만?), 단계 시간, 빠른 메시지 "저는 [직업]이에요" 템플릿과의 관계는 논의 단계에서 정한다(결정 0007). 템플릿 목록과 문구는 논의 단계에서 정한다. 자유 채팅은 v2 COMMX-01 (플레이테스트 피드백으로 결정), 마피아 밤 비밀 메시지는 v2 COMMX-02.
**UI hint**: yes

### Phase 3: 밤과 아침

**Goal**: 낮 다음 밤이 되면 각 폰이 역할에 맞는 선택 화면을 보이고(마피아는 전용 채팅 포함), 마피아·경찰·의사의 행동이 서로 모르게 처리되어 아침에 결과가 발표된다.
**Depends on**: Phase 2
**Requirements**: NIGHT-01, NIGHT-02, NIGHT-03, NIGHT-04, NIGHT-05, NIGHT-06, ELIM-01
**Success Criteria** (what must be TRUE):
  1. 밤 30초 동안 역할에 맞는 화면이 보인다: 마피아는 동료 표시와 동료의 현재 선택, 경찰·의사는 대상 선택, 시민은 안내 문구. 다른 사람의 역할은 서버가 보내지 않는다. 옆에서 보는 것·캡처 공유는 매너에 맡긴다(결정 0018).
  2. 마피아가 함께 한 명을 지목한다(의견이 갈리면 다수, 같으면 무작위). 경찰은 조사한 사람이 마피아인지 자기 화면에서만 본다. 의사가 지킨 사람이 마피아 지목과 같으면 그 사람은 살아난다.
  3. 모두가 일찍 골라도 밤은 30초가 다 지나야 끝난다.
  4. 아침 5초 동안 모든 화면에 탈락자 이름 또는 "아무 일도 없었습니다"가 나온다. 탈락한 사람은 유령이 되어 아무 행동·메시지도 못 하지만 게임 전체(모든 실제 직업·밤 행동·마피아 밤 채팅)를 관전한다 — 서버는 이를 탈락자에게만 보내고 살아 있는 사람에게는 보내지 않는다(결정 0021).

**Plans:** 12/12 plans executed (결정 0018·0019·0021 승인 시안 `design/screens/night-v1/` 기준)

Plans:
**Wave 1**
- [x] 03-01-PLAN.md — 트레이서: 단계 night 30초·morning 5초와 낮 토론 → 밤 → 아침 → 다음 낮 루프(tick 난수 주입), 3페이즈 와이어 타입(pick·alive·pick/allyPicks/records·morning·spectate), 방 화면 라우팅·밤 안내, 기존 회귀 이전 (TDD, wave 1)
- [x] 03-02-PLAN.md — 고정 테이블 밤 확장: 캐릭터 직접 탭 버튼·내 선택 링/배지, 유령 그림 탈락 표시, 관전 실제 직업 줄, 역할별 표적 배지 (TDD, wave 1)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 03-03-PLAN.md — 밤 판정 규칙 night.ts: pickTarget 검사 순서, 다수·동률 무작위·고른 표만(A2)·의사 보호·경찰 기록·동시 해결(A1)·문구 번호 연속 반복 없음, 받는 사람(행위자·관전자) (TDD, wave 2)
- [x] 03-04-PLAN.md — 밤 채팅·탈락자 거부 규칙: 생존 마피아만 밤 문구 3개, 밤 비마피아 WRONG_PHASE, 탈락자 BAD_MESSAGE(직업 공개 포함), 화면 문장 표 (TDD, wave 2)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 03-05-PLAN.md — 플레이어별 밤·아침 뷰: players[].alive, me.pick·allyPicks·records, day.morning, 탈락자 전용 spectate, 아홉 단계 전수 누출 검사 (TDD, wave 3)
- [x] 03-06-PLAN.md — 채팅 부품 밤·관전 모드: 수집 단계 일반화·단계가 바뀌면 비움, 안내 줄·로그 이름·^ 끄기, 밤 문구 시트, 읽기 전용 줄 (TDD, wave 3)

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 03-07-PLAN.md — Room DO 배선: pick 핸들러, 행위자·관전자 한정 state 전송, 마피아·관전자 한정 밤 chat·emoji, 마감·탈락 거부, workerd 통합 테스트 (TDD, wave 4)
- [x] 03-08-PLAN.md — 밤 화면: 역할별 하단(마피아 채팅·경찰/의사 선택 알약·시민 안내), 테이블 직접 탭·낙관적 선택, 관전 화면(E1), 밤 배경·유령 미리 받기 (TDD, wave 4)

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 03-09-PLAN.md — 두 밤·두 아침·관전 전수 누출 검사, 결정 0020(밤·아침 와이어 계약·판정 규칙), ROADMAP·REQUIREMENTS·기획서 탈락자 문장을 결정 0021 에 맞춤 (wave 5)
- [x] 03-10-PLAN.md — 아침 발표: 테이블 위 카드·탈락 문구 8개('님이')·무사 문구, 아침 헤더·하단, 진홍 없는 5초 타이머, 아침 안내 (TDD, wave 5)

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 03-11-PLAN.md — 경찰 수사 기록: [수사 기록] 버튼·새 기록 점(폰 메모리)·밤 끝 알림·시트(NEW·빈 상태) (TDD, wave 6)

**Wave 7** *(blocked on Wave 6 completion)*
- [x] 03-12-PLAN.md — 스모크·봇 스크립트(밤·아침·관전, uat-night 신설) → 개인 계정 배포 → 배포본 스모크 4·5·8명·봇 밤 시나리오 5·8명·낮 회귀 → HANDOFF·push·실기기 확인 목록 (wave 7)

**Notes**: 4페이즈가 생기기 전까지는 낮 토론 다음 바로 밤, 아침 다음 다시 낮(직업 공개)으로 돌린다. 4페이즈가 낮 토론과 밤 사이에 투표·처형을 끼운다. 아침 중 메시지 거부와 밤의 마피아 전용 채팅(COMM-04, 결정 0019)은 이 페이즈에서 확인한다. 살아 있는 사람에게는 아침에 탈락자의 역할을 공개하지 않는다(탈락자 본인은 관전, 결정 0021).
**UI hint**: yes

### Phase 03.1: 순차 주장과 역할 카드 (INSERTED)

**Goal**: 직업 주장을 한 명씩 차례로 평문 채팅으로 하고(결정 0023), 역할 카드의 활동 기록 탭에서 역할별 일지(수사·암살·치료)를 본다(결정 0026). 실제 폰 화면에서 겹침과 줄바꿈 없이 읽힌다.
**Depends on**: Phase 3
**Requirements**: DAY-02, NIGHT-04, ELIM-01
**Success Criteria** (what must be TRUE):
  1. 직업 공개 단계가 자리 순서(시계 방향, 시작 자리는 날마다 한 칸 이동)로 한 명당 8초 진행되고, 탈락자는 건너뛰며, 시간 초과는 "말 안 함"이고 어제 주장은 이어지지 않는다.
  2. 주장은 채팅에 "저는 경찰이에요"처럼 올라오고, 이름표는 이름 한 줄이며, 낮에 캐릭터를 탭하면 날짜별 주장 기록 카드가 열린다.
  3. [역할 카드] 시트에 `내 역할 | 활동 기록` 탭이 있고, 경찰은 수사일지, 마피아는 암살일지(사망/생존), 의사는 치료일지를 본인에게만 받아 본다. 안 읽은 기록은 앰버 점으로 알리고 탭을 열면 사라진다.
  4. 360×640·390×664·430×932 에서 헤더 제목 줄바꿈, [테스트] 버튼·아침 카드가 좌석을 가리는 문제, 이름표 겹침이 없고 `npm run e2e` 가 모두 통과한다.
  5. 봇이 차례 진행에 맞게 주장하고, 배포본에서 봇 시나리오와 E2E 가 통과한다.

**Plans:** 14/14 plans executed (결정 0023·0026·0027, 승인 시안 `design/screens/claim-turns-v1/`·`role-card-v1/`, UI 계약 `03.1-UI-SPEC.md`)
**UI hint**: yes

Plans:
**Wave 1**
- [x] 03.1-01-PLAN.md — 트레이서: 서버 순수 규칙 — 차례 순서·시작 자리 이동·8초 차례(tick ON_DEADLINE)·일찍 고르기·시간 초과 = 말 안 함(이월 없음)·claimLog·옛 방 정규화·claim 중 이모티콘, 공개 연출 단계 삭제, 범위 좁힌 타입 검사 도구 `scripts/tsc-scoped.mjs` (TDD, wave 1)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 03.1-02-PLAN.md — 방 DO 배선(일찍 고르기 → tick → 방송 → 알람)·봇이 자기 차례에만 주장·6명 전수 누출 검사 경로 갱신·결정 0027(와이어 계약) (TDD, wave 2)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 03.1-03-PLAN.md — 클라이언트 트레이서: 내 차례 칩 / 남의 차례 "…님이 주장하는 중 · N초"·차례 안내·장면 키, 전체 typecheck·테스트·build 초록 (TDD, wave 3)

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 03.1-04-PLAN.md — 역할별 일지 서버: 마피아 암살일지(died)·의사 치료일지·me.records 일반화, unit 전수 + workerd 6명 한 판 누출 검사 확장 (TDD, wave 4)
- [x] 03.1-05-PLAN.md — DayTable 개편: 이름표 한 줄·캐릭터 아래 층(z 1~11 < 12~22)·차례 링/배지/반전·낮 기록 카드 버튼·관전자 roleArt·아침 dim/spotlit (TDD, wave 4)

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 03.1-06-PLAN.md — 역할 카드 부품: 새 토큰 12개·journalArt, 일지 SVG 9종(별도 태스크), Journal 3종 + RoleCardSheet(탭·앰버 탭 점) (TDD, wave 5)
- [x] 03.1-07-PLAN.md — 순차 주장 화면(앞): 주장 채팅 줄(claimLog, 표시 전용 템플릿)·남의 차례 하단(채팅 세 줄 + 이모티콘)·차례 강조 연결 (TDD, wave 5)
- [x] 03.1-09-PLAN.md — E2E 규칙·스냅숏: D3a/D3b·D4/M1 완화(승인 3건)·D9·M3·M4·K/X/R/V/G7 순수 규칙과 브라우저 도우미 (TDD, wave 5)
- [x] 03.1-13-PLAN.md — 소켓 스크립트(smoke·uat-day·uat-night·bots·uat-test-bots·uat-test-room)를 차례 주장·claimLog·역할별 일지에 맞춰 로컬 통과 (wave 5)

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 03.1-08-PLAN.md — 순차 주장 화면(뒤): 낮 캐릭터 탭 → 유저 기록 카드(UserRecordSheet), 밤에는 열리지 않음 (TDD, wave 6)

**Wave 7** *(blocked on Wave 6 completion)*
- [x] 03.1-10-PLAN.md — 아침 카드 팝/퇴장·어둡게 층·유령 맥동, 관전자 테이블(직업 캐릭터), 헤더 nowrap·패널 여백·칩 간격 (TDD, wave 7)

**Wave 8** *(blocked on Wave 7 completion)*
- [x] 03.1-11-PLAN.md — 역할 카드 통합: 헤더 [역할 카드] 하나·앰버 점·읽음 개수(폰 메모리)·눌리는 밤 끝 알림, 옛 [내 역할]/[수사 기록] 제거 (TDD, wave 8)

**Wave 9** *(blocked on Wave 8 completion)*
- [x] 03.1-12-PLAN.md — E2E 흐름 6개(spec4 관전자 신설)를 새 계약으로 다시 쓰고 로컬 서버에서 `npm run e2e` 전부 통과 (wave 9)

**Wave 10** *(blocked on Wave 9 completion)*
- [x] 03.1-14-PLAN.md — 개인 계정 배포 → 배포본 스모크 4·5·8명·봇 UAT·E2E → HANDOFF·ROADMAP·REQUIREMENTS·push·실기기 확인 목록 (wave 10)

### Phase 4: 처형과 승패

**Goal**: 낮 토론 뒤 처형 여부 투표, 후보 선택 투표, 최후 변론, 처형을 거치고 승패가 나면 모든 역할이 공개되는 결과 화면으로 가서, 한 판이 끝까지 돌아간다 (결정 0034).
**Depends on**: Phase 3
**Requirements**: VOTE-01, VOTE-02, VOTE-03, VOTE-04, COMM-03, CONN-02, END-01, END-02
**Success Criteria** (what must be TRUE):
  1. 처형 여부 투표 10초에 생존자가 찬성·반대를 고르고(집계 수 실시간 표시, 번복 가능, 개인별 선택은 비공개), 던진 표 중 찬성이 과반일 때만 후보 선택 15초로 넘어간다. 아니면 밤으로 간다. 기권 버튼은 없고 못 보낸 표는 무효표다.
  2. 후보 선택에서 자기 자신을 뺀 한 명을 고르고, 최다 득표자가 후보가 된다(동률이면 처형 없이 밤). 마감 뒤 누가 누구를 골랐는지 화살표와 표수로 한 명씩 공개된다.
  3. 최후 변론 10초 동안 후보가 가운데로 이동해 스포트라이트를 받고, 후보만 변론 메시지를 보내며 다른 생존자는 이모티콘만 보낸다. 여부·후보 선택 중 생존자는 빠른 메시지·이모티콘을 보낼 수 있다.
  4. 처형 5초에 후보가 탈락하고 직업은 비공개다. 폰을 꺼 둔 사람이 있어도 각 단계는 제때 마감된다. 처형 중에는 메시지를 보낼 수 없다.
  5. 마피아가 모두 탈락하면 시민 팀 승리, 마피아 수가 나머지 생존자 수와 같거나 많아지면 마피아 팀 승리로 처형·아침 직후 즉시 판이 끝난다. 아직 아니면 다음 밤으로 이어진다.
  6. 결과 화면에 승리 팀, 모든 사람의 역할, 판 요약이 공개되고, 처음 화면으로 돌아가 새 방을 만들 수 있다.

**Plans:** 26/35 plans executed (04-01~04-12 서버·공유 로직 웨이브 완료·미배포, 결정 0036 / 04-13~04-35 화면 웨이브 추가 — UI-SPEC 승인 2026-10-28. 배포는 마지막 계획 04-35 에서만, 사용자 go-ahead 뒤 한 단위로(D-26). 웨이브마다 마지막 계획이 HANDOFF 진행 줄 갱신·개인 원격 push)

Plans:
**Wave 1**
- [x] 04-01-PLAN.md — 트레이서: 여부 투표 한 경로(투표 → 전원 같은 익명 집계 → 마감 분기 후보 선택/밤)를 단계 표·tick next 분기·vote.ts·view·스키마·방 DO·실제 소켓까지, 4페이즈 와이어 타입 전체 (TDD, wave 1)

**Wave 2** *(blocked on 04-01)*
- [x] 04-02-PLAN.md — 화면 쪽 단계 표 최소 대응(PHASE_SCENE·TEST_PHASE_LABEL·PHASE_ANNOUNCE·EXPECTED_SCENE)과 discussion→night 직결 회귀 이전 — 타입 검사·전체 테스트 초록 (wave 2)
- [x] 04-03-PLAN.md — 결정 0036(와이어 계약·규칙표·알려진 한계·바뀔 수 있는 기본값·되돌리기 비용), REQUIREMENTS CONN-02·GAME-01·COMM-01·architecture·product 문장 정정 (wave 2)

**Wave 3** *(blocked on 04-02, 04-03)*
- [x] 04-04-PLAN.md — 후보 선택(자기 제외·번복)·서버 셔플 공개·동률은 후보 없음·변론·처형 진입(탈락·문구)·처형 무효 이유 day.noExecution(D-34)·투표 상태 도우미 (TDD, wave 3)
- [x] 04-05-PLAN.md — 변론 템플릿 6개·변론은 후보만·투표 중 메시지·공개/처형/종료 거부, 아침 문구 7개·처형 문구 4개 (TDD, wave 3)

**Wave 4** *(blocked on 04-04)*
- [x] 04-06-PLAN.md — 승패 판정(처형·아침 마감)·종단 단계 ended(winner·30분 만료)·밤 기록·판 요약·ended 전용 result (TDD, wave 4)

**Wave 5** *(blocked on 04-03, 04-05, 04-06)*
- [x] 04-07-PLAN.md — 방 DO: 후보 선택은 투표자에게만, 공개·변론·처형·처형 무효 프레임, 두 종료 경로·30분 정리 workerd 통합 (TDD, wave 5)

**Wave 6** *(blocked on 04-07)*
- [x] 04-08-PLAN.md — 서버 봇 투표·변론, 테스트 방 넘기기 분기·대기실 복귀 정리, DO 봇 실행 (TDD, wave 6)
- [x] 04-09-PLAN.md — 열네 단계 view 허용 키 전수·익명 차분(4~8명 × 시드)·처형·처형 무효·종료 한 판 프레임 전수 누출 검사 (TDD, wave 6)
- [x] 04-10-PLAN.md — 스모크·uat-day·uat-night 새 단계·분기, 새 uat-vote(처형·두 종료) 로컬 통과 (wave 6)

**Wave 7** *(blocked on 04-08, 04-10)*
- [x] 04-11-PLAN.md — 수동 봇·uat-test-room·uat-test-bots 투표 단계·분기형 넘기기 로컬 통과 (wave 7)

**Wave 8** *(blocked on 04-03, 04-09, 04-10, 04-11)*
- [x] 04-12-PLAN.md — 결정 0036 코드 대조·전체 게이트·검증 표·HANDOFF(배포 금지 경고)·push (wave 8)

**화면 웨이브** *(04-UI-SPEC.md 승인 2026-10-28, 서버 웨이브 뒤 Add more plans. 화면 계획은 04-13 부터이며 순차 실행, 배포는 04-35 에서만)*

**Wave 9** *(blocked on 04-12)*
- [x] 04-13-PLAN.md — 순수 모듈 `src/game/verdict.ts`: 연출 상수·공개 시간표·확정 판정·후보 가운데 기하·후광 상한·문구 정본과 단위 시험 (TDD, wave 9)
- [x] 04-14-PLAN.md — 토큰 3종(amber-700·amber-900·cone-light)·장면 매핑(투표 다섯 단계 dusk, ended night — P-1·P-2)·E2E 기대 표·dusk 미리 받기 (TDD, wave 9)
- [x] 04-15-PLAN.md — 테스트 방 `testBotVote`(봇 처형 투표·후보 선택 고정, P-13): 봇 규칙·와이어·방 DO·소켓 시험 (TDD, wave 9)

**Wave 10** *(blocked on 04-13, 04-14, 04-15)*
- [x] 04-16-PLAN.md — 트레이서: 처형 여부 투표 한 경로(방 화면 → useVerdictScene → ExecVotePanel → execVote 메시지)·관전·오류·기록 카드 입구 (TDD, wave 10)
- [x] 04-17-PLAN.md — 테스트 시트에 `봇 처형 투표`·`봇 후보 선택` 칩 그룹 (TDD, wave 10)

**Wave 11–13** *(순차)*
- [x] 04-18-PLAN.md — 후보 선택 화면: DayTable 후광 종류(halo)·낙관적 선택 훅·CandidateVotePanel·좌석 탭 투표·관전 (TDD, wave 11)
- [x] 04-19-PLAN.md — 선택 공개 1: useRevealState(서버 시각)·표수 칩·앰버 후광·끝 문구·후광 상한 (TDD, wave 12)
- [x] 04-20-PLAN.md — 선택 공개 2: 화살표 층(프레임 보간)·과반 확정 두근·진동·모션 줄이기 (TDD, wave 13)

**Wave 14–16** *(순차)*
- [x] 04-21-PLAN.md — 최후 변론 1: 후보 가운데 이동·어둡게+흐림+원뿔·남의 변론 하단·끊김·관전 (TDD, wave 14)
- [x] 04-22-PLAN.md — 최후 변론 2: 후보 본인 패널 236·변론 칩 6개·대상/직업 시트 재사용·보냈어요 표시 (TDD, wave 15)
- [x] 04-23-PLAN.md — 처형: 앰버 처형 카드·사람 → 유령 전환·직업 비노출·하단 (TDD, wave 16)

**Wave 17–20** *(순차)*
- [x] 04-24-PLAN.md — `처형 투표` 인트로 카드와 회색 `처형 무효` 카드, 밤 시작 문구 지연·읽기 안내 접두 (TDD, wave 17)
- [x] 04-25-PLAN.md — 결과 화면 ResultScreen: 배너·직업 카드 격자·판 요약·처음으로·ended 라우팅 (TDD, wave 18)
- [x] 04-26-PLAN.md — 결과 공개 연출(neutral → flip → done)과 도착 정보 연결 (TDD, wave 19)
- [ ] 04-27-PLAN.md — 유저 기록 카드 투표 줄(날짜별 여부 집계·후보 선택)과 기록 카드 열림 규칙 (TDD, wave 20)

**Wave 21** *(blocked on 04-27)*
- [ ] 04-28-PLAN.md — 단계 × 보는 사람 상태 표 시험(관전·끊김·재접속·동료·인원)과 새 CSS 정적 게이트, 결함 수정 (TDD, wave 21)

**Wave 22–26 — E2E 갱신** *(순차, 결정성은 04-15·04-17 훅)*
- [ ] 04-29-PLAN.md — E2E 순수 검사 P1·P2·P3·P4·P9와 앰버/진홍 후광 규칙, 스냅숏 계약 (TDD, wave 22)
- [ ] 04-30-PLAN.md — E2E 순수 검사 P5·P6·P7·P8·P10, 승인 완화 P-PANEL-236 (TDD, wave 23)
- [ ] 04-31-PLAN.md — E2E 브라우저 도우미: readVerdict·토큰 색·봇 투표 고정·투표/후보 조작·관찰자·표본 (wave 24)
- [ ] 04-32-PLAN.md — 기존 여섯 흐름을 새 낮 루프에 적응(deferred 해소)·vote5 흐름 (wave 25)
- [ ] 04-33-PLAN.md — noexec·result-c·result-m 흐름, spec4 투표 화면, 로컬 전체 E2E (wave 26)

**Wave 27–28 — 마감과 배포** *(순차)*
- [ ] 04-34-PLAN.md — 결정 0037·시안 사본·검증 표·로컬 전체 게이트·HANDOFF·push (배포 없음, wave 27)
- [ ] 04-35-PLAN.md — 사용자 go-ahead(체크포인트) → 개인 계정 배포 → 배포본 스모크·uat-vote·uat-test-bots·E2E → VOTE·COMM-03·CONN-02·END 요구사항 완료 표시 → push (autonomous: false, wave 28)

**Notes**: 4페이즈 논의(`04-CONTEXT.md`)로 결정 0034 가 확정됐다. 화면은 승인 시안(`design/screens/execution-v1/`) → UI-SPEC(`04-UI-SPEC.md`, 승인 2026-10-28) 순서로 만들었고 화면 웨이브(04-13~04-35)는 UI-SPEC 를 기준으로 한다. 옛 화면설계서 보드 07·08·10 은 옛 순서 기준이라 대체된다. 서버 웨이브와 화면 웨이브는 한 단위로 04-35 에서만 배포한다.
**UI hint**: yes

### Phase 5: 분위기와 캐릭터

**Goal**: 화면이 무거운 분위기로 바뀌고, 플레이어마다 외형이 다른 캐릭터를 받으며, 세로 폰 화면에서 처음 하는 사람도 설명 없이 지금 할 일을 알 수 있다.
**Depends on**: Phase 4
**Requirements**: LOOK-01, CHAR-01, UX-01, UX-02, CONN-03
**Success Criteria** (what must be TRUE):
  1. 어두운 배경과 긴장감 있는 연출이 대기실부터 결과까지 이어지고, 밤·아침·처형 같은 단계가 바뀔 때 분위기가 눈에 띄게 달라진다.
  2. 8명이 한 방에 있어도 모두 서로 다른 외형의 캐릭터를 하나씩 받고, 대기실·투표·결과 화면에서 닉네임과 함께 보인다. 캐릭터에 따라 게임 능력이 달라지지는 않는다.
  3. 모든 단계 화면에 지금 할 일이 한 문장과 남은 시간으로 보인다.
  4. 폰 폭 360~430px 세로 화면에서 스크롤 없이 지금 할 일과 메시지 영역이 함께 보이고, PC 브라우저에서는 가운데에 폰 폭으로 보인다.
  5. 지원하는 기기에서는 게임 중 폰 화면이 저절로 꺼지지 않고, 지원하지 않는 기기에서도 게임은 정상적으로 돈다.

**Plans**: TBD
**Notes**: 사용자는 정적 2D 보다 완성도 높은 캐릭터(캐릭터별 프레임 PNG 애니메이션, 또는 가벼운 3D)를 원한다. 실시간 3D 는 쓰지 않고 2.5D 로 간다(결정 0008). 캐릭터는 프레임 PNG 로 움직이며, 일러스트로 그릴지 3D 로 렌더링한 그림을 쓸지와 공개된 캐릭터 에셋 도구는 이 페이즈 논의에서 정한다. 캐릭터 수·외형은 8종 이상이면 된다. 직접 고르기·성격 문구·애니메이션 라이브러리(Rive 또는 Lottie)는 v2 로 미뤘다. 정적 2D 로 시작하고, 애니메이션 도입은 디자인 방향을 정한 뒤에 결정한다.
**UI hint**: yes
**참고 자료**: `design/references/character/` (main.jpeg, mafia_character.jpeg, Mortis Brawl Stars Spooky Graveyard Wallpaper.jpeg, Coin Master mobile game , a little Halloween quest in collaboration with Moon Active games_, Sheri Amouzad.jpeg, Crime Coast Character Designs 2 - Sanjay Charlton.jpeg, PATH OF GANGSTER _ slot game - Inkration Studio.jpeg, Wild Heist Cashout - PGSOFT.jpeg). 이미지별 메모는 `design/references/notes.md`. 1페이즈 논의에서 색 방향(밤 남색 + 회색 + 진홍)과 임시 정장 실루엣을 정했다 (01-CONTEXT D-20, D-21).

### Phase 6: 친구 플레이테스트

**Goal**: 각자 다른 곳에 있는 친구들이 폰으로 배포된 주소에 들어와 앱만으로 한 판을 끝까지 하고, 다시 하고 싶은지와 불편한 점을 확인해 규칙 수치를 조정한다.
**Depends on**: Phase 5
**Requirements**: PLAY-01, PLAY-02, PLAY-03
**Success Criteria** (what must be TRUE):
  1. 친구 4명 이상이 각자 폰(iPhone Safari와 Android Chrome 모두 포함)으로 배포된 주소에 들어와 한 판을 끝까지 마친다.
  2. 기본 타이머로 한 판이 6~10분 안에 끝난다 (실제 소요 시간을 기록한다).
  3. 마피아를 처음 하는 사람이 사회자의 말로 된 설명 없이 화면 안내만으로 한 판을 따라온다.
  4. 참가자가 "다시 하고 싶은지", 빠른 메시지만으로 하고 싶은 말을 할 수 있었는지, 불편한 점을 남기고, 그에 따른 규칙 수치(타이머·역할 구성) 조정이 배포본에 반영된다. v1.1 에 올릴 후보도 정해진다.

**Plans**: TBD
**Notes**: 이 페이즈의 변경 범위는 플레이테스트 피드백으로 정한다. 새 기능은 피드백이나 결정 기록을 근거로만 더한다. "다시 하고 싶어 한다"는 응답이 나오면 REMATCH-01(다시 하기)을, "말하고 싶은데 못 했다"는 응답이 나오면 COMMX-01(자유 채팅)을 v1.1 의 첫 후보로 본다.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 (decimal phases, if inserted: 2 → 2.1 → 2.2 → 3)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. 걷는 뼈대 | v1.0 | 19/19 | Complete    | 2026-10-24 |
| 2. 낮 토론 | v1.0 | 18/18 | In Progress | - |
| 3. 밤과 아침 | v1.0 | 12/12 | In Progress | - |
| 3.1. 순차 주장과 역할 카드 | v1.0 | 14/14 | Complete | 2026-10-25 |
| 4. 처형과 승패 | v1.0 | 26/35 | In Progress (서버 웨이브 완료·미배포, 화면 웨이브 04-13~04-35 계획됨) | - |
| 5. 분위기와 캐릭터 | v1.0 | 0/TBD | Not started | - |
| 6. 친구 플레이테스트 | v1.0 | 0/TBD | Not started | - |
