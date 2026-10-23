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
  1. 낮이 시작되면 모두 직업 선택지와 [말 안 함] 중 하나를 고르고, 시간이 넘으면 말 안 함이 된다. 고른 주장이 그 사람 자리에 표시되고, 다음 낮에 바꾸면 "말 바꿈" 이 모두에게 보인다.
  2. 낮 토론 90초 동안 생존자 목록과 남은 시간이 보이고, 방장만 한 번 +30초 연장하거나 토론을 넘길 수 있다. 다른 사람이 누르면 아무 일도 없다.
  3. 생존자가 템플릿을 골라 대상 플레이어·직업을 채워 보내면(예: "[○○] 의심돼요", "[○○]는 [경찰]이었어요"), 모든 폰에 보낸 사람 말풍선과 최근 메시지 목록으로 바로 보인다. 거짓 주장도 그대로 보내진다.
  4. 이모티콘을 누르면 보낸 사람 캐릭터 위에 잠깐 떴다 사라진다.
  5. 토론 단계가 아닐 때(직업 공개 중 등) 보낸 메시지, 자유 텍스트, 2초 안에 다시 보낸 메시지는 서버가 거부해 다른 폰에 나타나지 않는다. 탈락자·밤·아침 중 메시지 거부는 탈락과 밤이 생기는 3페이즈에서 확인한다.
  6. 폰 세로 화면에서 메시지를 고르고 보내는 데 세 번 이하로 누른다(템플릿 → 대상·직업 → 보내기). 단 대상과 직업이 모두 필요한 '[○○]는 [직업]이었어요' 만 네 번(템플릿 → 대상 → 직업 → 보내기, 사용자 확정).

**Plans:** 10/11 plans executed

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
- [ ] 02-11-PLAN.md — 배포본 full 스모크(낮 한 바퀴·누출·거부)·재배포·결정 0016·ROADMAP 성공 기준 정정·HANDOFF·push·실기기 확인 모음 (wave 5)

**Notes**: 3페이즈가 생기기 전까지는 토론이 끝나면 다음 낮(직업 공개)으로 돌려 말 바꿈 표시를 검증한다. 직업 공개 방식(실시간·동시 공개), 선택지 범위(이번 판에 있는 직업만?), 단계 시간, 빠른 메시지 "저는 [직업]이에요" 템플릿과의 관계는 논의 단계에서 정한다(결정 0007). 템플릿 목록과 문구는 논의 단계에서 정한다. 자유 채팅은 v2 COMMX-01 (플레이테스트 피드백으로 결정), 마피아 밤 비밀 메시지는 v2 COMMX-02.
**UI hint**: yes

### Phase 3: 밤과 아침

**Goal**: 낮 다음 밤이 되면 모든 폰이 같은 모양의 선택 화면을 보이고, 마피아·경찰·의사의 행동이 서로 모르게 처리되어 아침에 결과가 발표된다.
**Depends on**: Phase 2
**Requirements**: NIGHT-01, NIGHT-02, NIGHT-03, NIGHT-04, NIGHT-05, NIGHT-06, ELIM-01
**Success Criteria** (what must be TRUE):
  1. 밤 30초 동안 역할과 관계없이 모든 생존자의 화면 구성이 같아, 화면 캡처를 공유해도 누가 어떤 역할인지 알 수 없다. 시민은 의심 가는 사람을 표시할 수 있지만 결과는 없다.
  2. 마피아가 함께 한 명을 지목한다(의견이 갈리면 다수, 같으면 무작위). 경찰은 조사한 사람이 마피아인지 자기 화면에서만 본다. 의사가 지킨 사람이 마피아 지목과 같으면 그 사람은 살아난다.
  3. 모두가 일찍 골라도 밤은 30초가 다 지나야 끝난다.
  4. 아침 5초 동안 모든 화면에 탈락자 이름 또는 "아무 일도 없었습니다"가 나온다. 탈락한 사람은 선택 화면 대신 "탈락" 화면과 공개된 진행만 본다.

**Plans**: TBD
**Notes**: 4페이즈가 생기기 전까지는 낮 토론 다음 바로 밤, 아침 다음 다시 낮(직업 공개)으로 돌린다. 4페이즈가 낮 토론과 밤 사이에 투표·처형을 끼운다. 밤·아침 중 메시지 거부(COMM-04 의 밤·아침 부분)는 이 페이즈에서 확인한다. 아침에 탈락자의 역할을 공개하는지는 원천에 없어서 비공개로 둔다.
**UI hint**: yes

### Phase 4: 처형과 승패

**Goal**: 낮 토론 뒤 처형 투표, 최후 변론, 찬반 투표, 처형을 거치고 승패가 나면 모든 역할이 공개되는 결과 화면으로 가서, 한 판이 끝까지 돌아간다.
**Depends on**: Phase 3
**Requirements**: VOTE-01, VOTE-02, VOTE-03, VOTE-04, COMM-03, CONN-02, END-01, END-02
**Success Criteria** (what must be TRUE):
  1. 투표 20초에 생존자가 후보 한 명을 고르거나 기권한다. 동률이거나 기권이 최다면 후보 없이 밤으로 넘어가고, 아니면 최다 득표자가 최후 변론 20초 동안 모든 화면에 크게 보인다.
  2. 최후 변론 중에는 후보만 변론 메시지("저 아니에요" 등)를 보낼 수 있고, 다른 생존자는 이모티콘만 보낼 수 있다. 찬반 투표 중에는 생존자가 빠른 메시지·이모티콘을 보낼 수 있다.
  3. 찬반 10초는 후보를 뺀 생존자만 고르고, 처형 5초에 찬성이 반대보다 많으면 탈락, 같거나 적으면 생존이 모든 화면에 발표된다. 시간 안에 고르지 않으면 기권이며, 폰을 꺼 둔 사람이 있어도 각 단계는 제때 마감된다. 처형 중에는 메시지를 보낼 수 없다.
  4. 마피아가 모두 탈락하면 시민 팀 승리, 마피아 수가 나머지 생존자 수와 같거나 많아지면 마피아 팀 승리로 판이 끝난다. 아직 아니면 다음 밤으로 이어진다.
  5. 결과 화면에 승리 팀과 모든 사람의 역할이 공개되고, 처음 화면으로 돌아가 새 방을 만들 수 있다.

**Plans**: TBD
**Notes**: 계획·논의 때 정할 것 — 투표 결과를 누가 누구에게 투표했는지까지 공개할지 집계만 공개할지, 처형된 사람의 역할을 그 자리에서 공개할지(원천에 없음, 지금은 게임이 끝날 때까지 비공개).
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
| 2. 낮 토론 | v1.0 | 10/11 | In Progress | - |
| 3. 밤과 아침 | v1.0 | 0/TBD | Not started | - |
| 4. 처형과 승패 | v1.0 | 0/TBD | Not started | - |
| 5. 분위기와 캐릭터 | v1.0 | 0/TBD | Not started | - |
| 6. 친구 플레이테스트 | v1.0 | 0/TBD | Not started | - |
