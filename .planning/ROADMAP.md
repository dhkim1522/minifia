# Roadmap: minifia

## Milestones

- ✅ **v1.0 MVP** — Phases 1~5 (3.1 포함, 6 삭제) (shipped 2026-10-30) → [상세](milestones/v1.0-ROADMAP.md)
- 🚧 **v2.0 같은 공간** — Phases 6~12 (진행 중). `v2` 브랜치에서 진행하고 `minifia-v2` Worker 에 배포한다(결정 0043·0044)
- 📋 **정식 출시** — 정식 이름·상표, 도메인, Capacitor 앱, 스토어 심사, 공개, 수익화 결정. 마지막 별도 마일스톤 (페이즈 미정)

## Overview

v2.0 은 규칙 진행기였던 게임을, 친구들이 한 공간에서 움직이고 떠들고 몸짓하며 서로를 의심하는 게임으로 바꾼다(결정 0044). 역할 구성과 승패 규칙은 그대로이고 표현 방식만 바뀐다. 순서는 "추가 → 교체 → 삭제" 다. 먼저 `minifia-v2` 배포와 로비 맵 이동, 렌더링 성능 게이트를 세우고(6), 자유 채팅과 채널별 누설 차단을 깔고(7), 낮 토론·지목·변론·찬반 처형과 유령으로 정통 처형 흐름을 맵 위로 옮기고(8), 가장 위험한 밤·아침·유언을 한 묶음으로 만들어 한 판이 맵 위에서 처음 끝까지 도는 지점에서 팀 테스트를 한다(9). 그 뒤 자리표시 그림을 실제 캐릭터 리그·동작·의상으로 바꾸고(10), 결과 공개·시상식·다시 하기·방장 이양을 얹고(11), 마지막으로 소리를 붙여 마무리한다(12). 꾸밈 층(실제 아트·소리·시상)은 한 판이 도는 것을 확인한 뒤에 얹는다.

**선행 조건 (페이즈 아님):** 화면 페이즈를 계획하기 전에, 메인 세션에서 v2.0 디자인 시스템·화면설계서·맵·캐릭터 리그/의상/동작 디자인을 클로드 아티팩트(캔버스)로 만들어 승인받고 승인본 사본을 `design/` 에 둔다(CLAUDE.md "디자인 먼저"). 이를 위한 GSD 페이즈는 만들지 않는다. 화면이 있는 모든 페이즈(6~12)는 `/gsd-plan-phase` 전에 `/gsd-ui-phase` 를 실행한다. 자동 감지에 기대지 않아 각 페이즈에 `UI hint` 를 직접 적었다. 에셋(의상·동작·소리) 제작은 코드 페이즈와 병행하며, 자리표시 그림이 먼저 돌고 있으므로 규격이 확정된 뒤 교체한다.

**모든 페이즈 공통 완료 조건:**
- 페이즈 끝에 `minifia-v2` 배포본에 올라가고, 검증은 배포본에서 한다(작업 원칙: 이른 배포). v1.0 주소는 건드리지 않는다.
- 한 판이 끝까지 도는 상태가 깨지지 않는다. 테스트 방 봇이 새로 만든 흐름을 수행해 한 판을 자동 완주한다.
- 누설 검사(`leak.test` 등)는 삭제하지 않고 새 메시지 종류와 신분(시민 편·마피아·유령)에 맞게 확장한다. 허용 경로를 "초록을 만들려고" 넓히지 않는다.
- 화면은 폰 폭 3종에서 확인하고, 대체한 v1.0 코드와 그 코드만 검사하던 테스트는 같은 페이즈에서 함께 지운다(`skip` 금지).

## Phases

**Phase Numbering:**
- Integer phases (6, 7, 8): Planned milestone work. v1.0 에서 이어 6부터 시작한다
- Decimal phases (6.1, 6.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

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

### 🚧 v2.0 같은 공간 (진행 중)

**Milestone Goal:** 친구들이 한 공간에서 움직이고 떠들고 몸짓하며 서로를 의심하는 게임으로 바꿔 대면 마피아의 사교와 정치질을 옮긴다(결정 0044). 배포는 `minifia-v2` Worker.

- [x] **Phase 6: 월드 뼈대** - `minifia-v2` 에 배포하고, 로비 맵에서 서로의 캐릭터가 걸어 다니며, 이 방식이 실제 폰에서 버티는지 게이트로 확인한다 (completed 2026-11-01)
- [x] **Phase 7: 자유 채팅** - 로비부터 자유롭게 떠들고, 밤 마피아 채팅과 탈락자 채팅은 다른 편에게 네트워크로도 새지 않는다 (completed 2026-11-02)
- [x] **Phase 8: 낮 처형과 유령** - 토론 → 지목 → 변론 → 찬반 → 처형이 맵 위에서 돌고, 처형된 사람은 유령이 되어 끝까지 지켜본다 (completed 2026-11-03)
- [ ] **Phase 9: 밤과 아침** - 마피아만 맵에서 움직여 암살하고 시민 편은 어둠 속에 있으며, 아침에 현장·유언·쪽지가 공개되어 한 판이 처음으로 맵 위에서 끝까지 돈다
- [ ] **Phase 10: 캐릭터·동작·의상** - 자리표시 그림이 관절 리그 캐릭터로 바뀌어 걷고, 동작으로 반응하고, 로비에서 의상을 갈아입는다
- [ ] **Phase 11: 결과 공개와 다시 하기** - 판이 끝나면 숨겨졌던 채팅이 공개되고 시상식을 하고, 같은 멤버로 바로 다시 하며, 방장이 사라져도 방이 이어진다
- [ ] **Phase 12: 소리와 마무리** - 배경음과 효과음이 분위기를 만들고 각자 끄고 켤 수 있으며, v2.0 전체를 팀 테스트로 마무리한다

## Phase Details

### Phase 6: 월드 뼈대

**Goal**: 친구들이 `minifia-v2` 주소로 들어와 로비 맵에서 서로의 캐릭터가 걷는 모습을 보고, 이 렌더링 방식이 실제 폰에서 버틴다는 것이 숫자로 확인된다
**Depends on**: Nothing (v2.0 첫 페이즈). 선행 조건: 맵과 캐릭터 몸체 규격 디자인 승인(화면설계서 승인 2026-10-31), three `0.186.1`(결정 0055)
**Requirements**: DEPLOY-02, MAP-01, MAP-02, MAP-03, MAP-05, CONN-04, MAP-07
**Success Criteria** (what must be TRUE):
  1. v2.0 이 `minifia-v2` Worker 에 배포되어, 다른 기기(폰)에서 주소로 들어와 방을 만들고 참가할 수 있다. v1.0 주소(`minifia.dhplay.workers.dev`)는 그대로 동작하고, 배포·검사 스크립트는 v1.0 주소를 덮어쓰거나 검사하지 않는다 (DEPLOY-02)
  2. 폰 2대 이상이 같은 방 로비(지하 재즈 바, 결정 0055)에서 서로의 캐릭터와 닉네임을 본다. 맵을 터치하면 내 캐릭터가 그곳까지 걸어가고 다른 폰에서도 같은 경로·속도로 움직여 보인다. 맵은 폰 한 화면보다 조금 넓고 카메라가 내 캐릭터를 따라간다 (MAP-01, MAP-02, MAP-03)
  3. 화면을 껐다 켜거나 새로 고치거나 배포로 연결이 끊겼다 돌아와도 모든 캐릭터가 지금 위치로 이어지고, 보류했던 연결 계층 경고(WR-01~04)가 더는 나지 않는다. 시작 이후 한 판은 v1.0 흐름 그대로 끝까지 돈다 (MAP-05, CONN-04)
  4. 렌더 성능 게이트: three.js 아이소메트릭 맵(지하 재즈 바, 블록아웃 `design/v2.0/blockout/`, 결정 0050) 위에서 3D 조립 캐릭터 8명(원본 `design/v2.0/blockout/character.js`, 결정 0048)이 걷고 동작 2개를 하는 스파이크가 사용자 폰과 크롬 CPU 4배 스로틀(저가폰 대신, 결정 0055)에서 5분 평균 55fps 이상, 카메라 이동 끊김·발열·메모리 경고 없이 돌고 로비 조작이 3초 안에 반응한다. 미달이면 그림자·광원·건물 예산을 줄이고, 그래도 모자라면 맵을 시간대별 미리 구운 이미지로 바꾸기로 결정 기록에 남긴다 (MAP-01~03 의 렌더 방식 확정, 결정 0046)

**Plans:** 23/23 plans complete (10 waves + 갭 닫기 2)

Plans:
**Wave 1**
- [x] 06-01-PLAN.md — 배포 대상 가드: minifia-v2 단일 출처·빌드 산출물 검사·스크립트 v1 거부 (W1)
- [x] 06-02-PLAN.md — 재즈 바 이동 격자·입장 지점·경로 탐색 map.ts (TDD, W1)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 06-03-PLAN.md — 카메라 수학·이동 한계·WebGL 상태기계 (TDD, W2)
- [x] 06-04-PLAN.md — three 0.186.1 설치(사람 확인)·v2 토큰 합치기 (W2)
- [x] 06-05-PLAN.md — 구간·보간·이동 요청·저장/복원·봇 배회 world.ts + 와이어 계약 (TDD, W2)
- [x] 06-06-PLAN.md — 닉네임 8자·봇 이름·v1 테이블 E2E 충돌 결정 (TDD, W2)
- [x] 06-07-PLAN.md — v2 첫 배포·시험판 표식·사람 확인 (W2)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 06-08-PLAN.md — 방 DO world: move·snap·지연 저장·퇴거 복원·봇 배회·누설 검사 (TDD, W3)
- [x] 06-09-PLAN.md — 클라이언트 WorldStore·연결 훅·WR-01~04 정리 (TDD, W3)
- [x] 06-10-PLAN.md — three 렌더러·재즈 바 장면 병합·사다리 (TDD, W3)
- [x] 06-11-PLAN.md — 3D 조립 캐릭터 이식·관절 병합 (TDD, W3)
- [x] 06-12-PLAN.md — v2 부품 이식: 이름표·단계 머리·위 알림·점·행동 버튼 (W3)

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 06-13-PLAN.md — WorldStage·월드 런타임: 탭→걷기→카메라·이름표·상태 카드 (W4)

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 06-14-PLAN.md — 성능 스파이크 ?perf=1·크롬 스로틀 측정·조명 맞추기·?chat-mock=1 (W5)
- [x] 06-15-PLAN.md — 로비를 맵으로 교체·RoomScreen 스토어·떠 있는 재접속 띠·깨진 client 테스트 정리 (W5)

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 06-16-PLAN.md — 대체된 v1 로비 코드 삭제·화면 지도·구조 문서 (W6)
- [x] 06-21-PLAN.md — 로비 알림 v2 문구·방장 왕관·입장 화면 월드 청크 미리 받기·room-enter 표식 (06-15 에서 나눔, W6)

**Wave 7** *(blocked on Wave 6 completion)*
- [x] 06-17-PLAN.md — E2E 1: world 흐름·새 lobby 흐름·로비 크기 6종·v1.0 게임 흐름 (W7)

**Wave 8** *(blocked on Wave 7 completion)*
- [x] 06-18-PLAN.md — E2E 2: reconnect 5종×10회·deployhold·perfbudget·전체 초록 (W8)

**Wave 9** *(blocked on Wave 8 completion)*
- [x] 06-19-PLAN.md — 배포(배포 직후 재접속)·크롬 4× 측정·iPhone 16 Pro 실측·게이트 판정 (W9)

**Wave 10** *(blocked on Wave 9 completion)*
- [x] 06-20-PLAN.md — 게이트 결정 기록·결과 마무리·HANDOFF·push (W10)

**Gap closure** *(06-UAT.md 갭 G-06-4 — 이름표 겹침, 사용자 결정 2026-11-01)*
- [x] 06-22-PLAN.md — G-06-4: 내 이름표 맨 위(z)·겹친 맨 앞 이름표만 면 overlay-ink-strong(rankTags→writeTags→data-front→CSS), E2E NT3 확장, UI-SPEC·화면 지도 개정. 가장자리 잘림·[테스트]·카메라는 범위 밖 (TDD, gap_closure, wave 1)

**Gap closure** *(06-UAT.md 갭 G-06-6 — 배포본 재접속 띠, E2E 하네스)* *(blocked on 06-22: scripts/e2e 파일 소유 순서)*
- [x] 06-23-PLAN.md — G-06-6: dropSockets 합성 close(1006) 먼저, deployhold 배포 주소 '띠 없음·소켓 유지' 통과(6분 대기 폐지), (선택) 서버 webSocketClose 맞받아치는 close (TDD, gap_closure, wave 2)

**UI hint**: yes
**계획 메모**: 연구 필수(`--research-phase`) — three.js 맵과 2D 캐릭터를 합치는 방식(빌보드 판 vs DOM 겹치기, 결정 0046-6)과 스파이크 실측 방법, iOS WebGL 컨텍스트 끊김 복구, 맵 이동 가능 영역 데이터 형식, WR-01~04 원인 코드(`DEFERRED-BUGS.md` 에 내용 없음, 연결 처리 코드에서 확인), 위치 구간 `world` 키 지연 저장·하이버네이션 복원. 같은 스파이크에서 iOS 키보드가 열린 하단 채팅 레이아웃 시안도 실기기로 확인해 7페이즈 입력으로 쓴다. `wrangler.jsonc` 이름·`prod-url.txt`·E2E/smoke 기본 주소·계정 확인 스크립트를 같은 커밋에서 바꾸고 가드를 둔 뒤 첫 배포한다.

### Phase 7: 자유 채팅

**Goal**: 로비부터 자유롭게 채팅하고, 밤 마피아 채팅과 탈락자 채팅이 다른 편 폰으로는 네트워크로도 가지 않는다
**Depends on**: Phase 6
**Requirements**: CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-05, CHAT-06
**Success Criteria** (what must be TRUE):
  1. 로비와 낮에서 살아 있는 사람 모두 하단 채팅창으로 자유롭게 글을 보내고 같은 방 모두의 폰에 보인다. 입력하는 동안 내 캐릭터 머리 위에 "…" 가 뜨고, 같은 채널을 보는 사람에게만 보인다 (CHAT-01, CHAT-04)
  2. 밤에는 살아 있는 마피아끼리만 채팅하고 그 내용과 입력 중 표시는 시민 편 폰으로 오가는 메시지에 한 번도 없다. 탈락자끼리의 채팅도 산 사람 폰에는 가지 않는다 (CHAT-02, CHAT-03)
  3. 글자 수나 도배 한도를 넘기면 서버가 막고 보낸 사람에게 알린다. 한글 입력(조합 중 Enter)이 깨지지 않고 iOS 키보드가 채팅창을 가리지 않는다 — iPhone·Android·삼성 인터넷·카카오톡 인앱에서 확인 (CHAT-05)
  4. 순차 직업 주장·빠른 메시지·텍스트 이모티콘이 화면과 서버에서 모두 사라지고, 낮 토론은 자유 채팅으로 진행된다 (CHAT-06)

**Plans:** 27/27 plans complete (14 waves + 갭 닫기 5)

Plans:
**Wave 1** *(같은 웨이브도 번호 순서로 하나씩 돈다 — use_worktrees false)*
- [x] 07-01-PLAN.md — 결정 0058(채팅 서버 보관·재접속 채널별 30줄, 0017-7 개정)·옛 결정 폐기 표시 (W1 첫 작업)
- [x] 07-02-PLAN.md — 순수 규칙 audience·chatRules·chatLog + 새 와이어 타입 (TDD, W1)
- [x] 07-03-PLAN.md — 화면 부품 ChatPanel(IME 안전 제출)·HeadStack 입력 중·V2Icon·chatUi·chatText (W1)
- [x] 07-04-PLAN.md — 화면에서 순차 주장 걷어내기(ClaimPanel·TurnPanel·claimLines·기록 카드) (W1)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 07-05-PLAN.md — ChatStore·useKeyboardLift·동작 라벨 표 (TDD, W2)
- [x] 07-06-PLAN.md — 화면에서 변론 칩·236 패널·변론 채팅 줄·이모티콘 걷어내기 (W2)

**Wave 3**
- [x] 07-07-PLAN.md — 화면에서 빠른 메시지·이모티콘·말풍선·채팅 로그 부품 걷어내기 (W3)

**Wave 4**
- [x] 07-08-PLAN.md — 서버·와이어에서 claim 단계 제거·저장 방 이전·화면 단계 이름 표 (TDD, W4)

**Wave 5**
- [x] 07-09-PLAN.md — 와이어에서 claimLog 제거·시험 픽스처 정리 (W5)

**Wave 6**
- [x] 07-10-PLAN.md — 서버 트레이서: 입력 중 typing 한 길·deliver(audience)·me.chat·world 전환 (TDD, W6)

**Wave 7**
- [x] 07-11-PLAN.md — 서버 자유 채팅 줄·D5 거절·단계 키 폐기·봇 고정 문구·say 제거·연결 훅 (TDD, W7)

**Wave 8**
- [x] 07-12-PLAN.md — emoji·무차별 전송·옛 번호 필드 제거 (TDD, W8)
- [x] 07-13-PLAN.md — 화면 트레이서: 로비 채팅(RoomScreen ChatStore·useChat·Lobby 패널)·E2E chat-lobby (W8)

**Wave 9**
- [x] 07-14-PLAN.md — chat: 보관·hello chatLog 복원·상한·누설 검사 (a)~(d)·정적 가드 (TDD, W9)
- [x] 07-15-PLAN.md — 테이블 화면 채팅(토론·변론·밤 마피아·탈락자)·E2E chat-table (W9)

**Wave 10**
- [x] 07-16-PLAN.md — smoke·손 봇 자유 채팅·perf-run --mode chatload (W10, 로컬 서버 07-16~07-18 공유)
- [x] 07-17-PLAN.md — uat-* 스크립트 자유 채팅 기준 (W10)
- [x] 07-18-PLAN.md — 머리 위 "…"(보내기 규칙·로비·테이블 알약)·카메라 가시성 +22 (W10)

**Wave 11**
- [x] 07-19-PLAN.md — 키보드·한글 입력(lift·D3·D4·방 높이 고정)·E2E chat-ime·chat-keyboard (W11)

**Wave 12**
- [x] 07-20-PLAN.md — E2E 하네스 정리(주장·빠른 메시지 판정 삭제·패널 높이)·갤러리·전체 E2E 초록 (W12)

**Wave 13**
- [x] 07-21-PLAN.md — 화면 지도·구조 문서·기기 확인 문서·가드 체인 배포·배포본 확인·iPhone 사람 확인 (W13, 사람 확인)

**Wave 14**
- [x] 07-22-PLAN.md — 사람 확인 결과 기록·HANDOFF(D1 이월 포함)·push (W14)

**Gap closure** *(07-UAT.md 갭 G-07-9 — 로비 이동 멈칫·튐, 결정 0059 / WR-03 낮 시작 문구, 07-UAT 8 사용자 결정 2026-11-02)*
- [x] 07-23-PLAN.md — WR-03: 낮 시작 보조줄 삭제·하단 안내 '곧 토론이 시작돼요', 시험·E2E N8·결정 0030/0038 개정 표시·WR-03 resolved (TDD, gap_closure, wave 1)
- [x] 07-24-PLAN.md — G-07-9 순수 핵심: 공용 경로 본체 planMoveSegment·predictSegment·섞기/방향/응답 추적기(motion.ts)·moveSeqOf (TDD, gap_closure, wave 1)
- [x] 07-25-PLAN.md — G-07-9 런타임: 탭 즉시 예측 출발·서버 구간 150ms 섞어 맞춤·응답 없음 되돌림·남 섞기·둘째 탭·방향/자세 섞기 (TDD, gap_closure, wave 2)
- [x] 07-26-PLAN.md — G-07-9 E2E W11·W12(__mfWorld.shown)·06-UI-SPEC 0059 개정 표시·화면 지도·구조 문서 (TDD, gap_closure, wave 3 — 07-23 과 scripts/e2e 파일 소유 순서)
- [x] 07-27-PLAN.md — 가드 체인 배포·배포본 smoke·전체 E2E(W11·W12·N8)·HANDOFF·push (gap_closure, wave 4)

**UI hint**: yes
**계획 메모**: 연구 권장 — iOS 키보드 + 하단 고정 채팅 + 한글 IME 실기기. 위치·채팅·입력 중이 모두 `audience` 한 함수를 지나게 하고 무차별 `broadcastEvent` 는 지운다. 채널은 서버가 보낸 사람 상태로 정하고 단계 번호가 어긋나면 넓은 채널로 돌리지 말고 폐기한다. 이 표에 동작(이모트) 종류도 같이 정의해 10페이즈가 재사용한다.

### Phase 8: 낮 처형과 유령

**Goal**: 낮 토론이 맵 위에서 열리고 지목 → 변론 → 찬반 → 처형이 정통 순서로 돌며, 처형된 사람은 유령이 되어 끝까지 지켜본다
**Depends on**: Phase 6, Phase 7
**Requirements**: DAY-03, DAY-04, DAY-05, DAY-06, DAY-07, MAP-04, GHOST-01, GHOST-02
**Success Criteria** (what must be TRUE):
  1. 낮 토론이 맵 위에서 열려 자유롭게 움직이며 채팅하고(입력 중 "…" 포함), 살아 있는 사람의 과반이 "토론 끝내기" 를 누르면 바로 지목으로 넘어간다 (DAY-03, MAP-04)
  2. 지목이 시작되면 모두 가운데로 모여 제자리에 서고, 각자 자기 자신을 뺀 한 명을 손가락으로 가리킨다. 누가 누구를 가리키는지 모두에게 실시간으로 보이고 마감 전까지 바꿀 수 있다 (DAY-04, MAP-04)
  3. 최다 지목자 한 명이 최후 변론을 하고 시선이 변론자에게 모인다. 동률·0표면 처형 없이 밤으로 간다. 변론 뒤 찬반 투표에서 찬성이 과반이면 처형된다. 지목·변론·찬반 동안 서버가 이동 요청을 막는다(채팅은 된다) (DAY-05, DAY-06, MAP-04)
  4. 단계 시간이 토론 90초·지목 15초·변론 20초·찬반 10초·밤 30초로 돌고, v1.0 의 처형 여부 → 후보 선택 → 한 표씩 공개 흐름과 고정 테이블은 화면에 없다 (DAY-07)
  5. 처형된 사람은 반투명 유령이 되어 맵을 떠다니며 모든 사람의 역할을 본다. 산 사람 폰으로 오가는 메시지에는 유령의 위치·움직임·채팅이 한 번도 없다 (GHOST-01, GHOST-02)

**Plans:** 28/28 plans complete (19 waves)

Plans:
**Wave 1** *(같은 웨이브도 번호 순서로 하나씩 돈다 — use_worktrees false)*
- [x] 08-01-PLAN.md — 결정 0060(낮 처형·유령 규칙 14항)·옛 결정 일곱 곳 개정 표시 (W1)
- [x] 08-02-PLAN.md — 순수 규칙: 지목·찬반·토론 끝내기·청소 + PhaseId nomination·verdict (TDD, W1)
- [x] 08-03-PLAN.md — v2 부품 VoteBadge·SureStamp·RoleChip·VerdictPicker·아이콘 다섯 (W1)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 08-04-PLAN.md — 순수 규칙: canMove·world mover/worldVisibleTo·STAGE_SPOT 예외·forceSegment·모이는 자리 (TDD, W2)
- [x] 08-05-PLAN.md — HeadStack 쌓임 확장·채팅 vote/hot 줄·명조 토큰 (W2)
- [x] 08-06-PLAN.md — dayView: 공개 정보 차이 → 기록 줄·위 알림 큐·결과 알림 시간표·머리 문구 (TDD, W2)

**Wave 3**
- [x] 08-07-PLAN.md — DO: endDiscussion·point·verdict 핸들러·방송 규율·view 필드·봇/테스트 도구 (TDD, W3)
- [x] 08-08-PLAN.md — presence 장면 상태·고정 카메라 zoom·gatherView (TDD, W3)

**Wave 4**
- [x] 08-09-PLAN.md — DO: 단계별 이동 차단·유령 위치는 유령에게만·viewer 별 snap·syncLayout·메타모픽 누설 검사 (TDD, W4)
- [x] 08-10-PLAN.md — 캐릭터 유령 재질·손가락 유지·발밑 고리·조명 다섯·긴장·확대 (TDD, W4)
- [x] 08-28-PLAN.md — 흐름 전환 전 옛 흐름 전용 unit 시험 정리(vote.test 대응표·삭제) (W4)

**Wave 5**
- [x] 08-11-PLAN.md — 흐름 전환: 토론 → 지목 → 변론 → 찬반 → 처형 → 밤, 상태 도우미 새 흐름화·시험 이전 (TDD, W5)
- [x] 08-12-PLAN.md — 런타임 setScene·이름표 지목 버튼·canWalk (W5)

**Wave 6**
- [x] 08-13-PLAN.md — GameMap 틀·낮 토론(토론 끝내기)·useMapInsets·[역할 카드] A2·결과 알림 (W6)
- [x] 08-14-PLAN.md — smoke·손 봇·uat 스크립트 새 흐름 (W6)

**Wave 7~10** *(GameMap 을 차례로 넓힌다)*
- [x] 08-15-PLAN.md — 지목 화면: 이름표 누르기·배지·선두·과반·위 알림·손가락 (W7)
- [x] 08-16-PLAN.md — 최후 변론·찬반·처형 화면 (W8)
- [x] 08-17-PLAN.md — 유령 화면·산 사람 DOM 0건 (W9)
- [x] 08-18-PLAN.md — 밤·아침 임시 틀(A1) (W10)

**Wave 11~15** *(대체한 v1.0 코드와 그 시험 삭제 — skip 금지, 시험 일을 코드 삭제 앞에 두어 웨이브마다 초록)*
- [x] 08-27-PLAN.md — 화면 시험 먼저: 남길 뜻을 게임 맵 시험으로, 남는 화면 시험 GameMap 기준, 지운 화면만 보던 시험 삭제 (W11)
- [x] 08-19-PLAN.md — v1.0 고정 테이블·처형 화면 13파일 삭제, 역할 배정은 테이블만 뺌(사용자 확정) (W12)
- [x] 08-20-PLAN.md — 테이블 로직·CSS·아이콘 정리·정적 가드 dayStaticGuard (W13)
- [x] 08-21-PLAN.md — 서버 옛 투표 메시지·규칙·핸들러·봇 삭제 (TDD, W14)
- [x] 08-22-PLAN.md — 옛 단계 이름·처형 문구 번호 삭제·옛 저장 방 정규화 (TDD, W15)

**Wave 16~19**
- [x] 08-23-PLAN.md — E2E: 결정 0056 완화·테이블 판정·옛 흐름 삭제, 게임 맵 판정 (W16)
- [x] 08-24-PLAN.md — E2E 새 흐름 day·ghost·noexec·night-roles·result·chat-game (W17)
- [x] 08-25-PLAN.md — 낮 흐름 렌더 측정(dayload)·갤러리·로컬 전체 초록 (W18)
- [x] 08-26-PLAN.md — 문서·실기기 이월(999.5)·배포·배포본 검증·HANDOFF·push (W19)

**UI hint**: yes
**계획 메모**: 표준 패턴이라 연구 생략 가능(v1.0 `vote.ts`·단계 표 재사용). 함정: v1.0 `enterExecVote` 가 후보를 지우므로 지우는 시점을 `discussion` 진입으로 옮긴다. 고정 테이블 삭제로 v1.0 탈락자 관전 화면도 사라지므로 유령을 같은 페이즈에 둔다 — 첫 처형부터 죽은 사람이 지켜볼 곳이 있어야 8·9페이즈 팀 확인이 의미 있다. GHOST-02 의 밤 행동 관전은 이 페이즈에서는 v1.0 밤 방식 기준이고, 9페이즈에서 맵 위 밤으로 다시 확인한다.

### Phase 9: 밤과 아침

**Goal**: 밤에는 마피아만 맵에서 움직여 암살하고 시민 편은 어둠 속에 있으며, 아침에 현장·유언·쪽지가 공개되어 한 판이 처음으로 맵 위(낮 + 밤)에서 끝까지 돈다
**Depends on**: Phase 8
**Requirements**: NIGHT-07, NIGHT-08, NIGHT-09, NIGHT-10, NIGHT-11, NIGHT-12, MORN-01, MORN-02, MORN-03, MORN-04, WILL-01
**Success Criteria** (what must be TRUE):
  1. 밤이 되면 각자 토론이 끝난 자리(가운데로 모이기 전)로 돌아가고 마피아만 맵을 움직인다. 시민 편 화면은 깜깜하고 다른 사람이 보이지 않으며, 시민 편 폰으로 오가는 메시지에는 마피아의 위치·움직임·채팅·동작이 한 번도 없다 — 마피아가 움직여도 가만히 있어도 시민 편이 받는 메시지는 같다. 유령은 밤에도 마피아의 이동과 암살을 관전한다 (NIGHT-07, GHOST-02 유지)
  2. 마피아는 대상에게 다가가 암살하고, 살아 있는 마피아가 모두 같은 대상을 골라야 확정된다(맞추지 못하면 그 밤에는 아무도 죽지 않는다). 경찰·의사는 깜깜한 화면에 비친 얼굴 목록에서 대상을 고르고, 마피아는 확정된 암살에 익명 쪽지를 남길 수 있다 (NIGHT-08, NIGHT-09, NIGHT-12)
  3. 시민 편 깜깜한 화면에 발소리·심장 소리 같은 긴장 연출이 나오되 실제 마피아 움직임과 무관하고, 암살당한 사람은 밤 판정이 끝난 뒤 깜깜한 화면에서 암살 이펙트를 본다 (NIGHT-10, NIGHT-11)
  4. 아침에 희생자가 쓰러진 자리에 분필 윤곽이 그날 낮 동안 남고, 희생자의 유언과 마피아 쪽지가 공개되어 채팅창에 카드로 남는다. 의사가 살렸으면 "누군가 살아났습니다" 만 나오고 누구인지는 알리지 않는다. 아침 길이는 내용에 맞춰 서버가 정한다. 유언은 누구나 역할과 관계없이 언제든 쓰고 고칠 수 있고, 쓰는 동안 다른 사람에게 아무 신호도 가지 않으며, 유언과 쪽지는 죽기 전에는 어떤 메시지에도 담기지 않는다 (MORN-01, MORN-02, MORN-03, MORN-04, WILL-01)
  5. 팀(4명 이상)이 배포본에서 낮과 밤이 맵 위에서 이어지는 한 판을 끝까지 하고, 이동·채팅·밤 긴장이 대면 마피아 같은 느낌을 주는지 기록한다. 이 결과로 실제 아트·소리 투자를 이어 갈지 정한다 (마일스톤 핵심 가치)

**Plans:** 30/30 plans executed (11 waves + 보완 7, 갭 닫기 웨이브 G1~G4)

Plans:
**Wave 1** *(같은 웨이브도 번호 순서로 하나씩 돈다 — use_worktrees false)*
- [x] 09-01-PLAN.md — 결정 0061(밤·아침 규칙 19항)·옛 결정 여섯 곳 개정 표시 (W1)
- [x] 09-02-PLAN.md — 마피아 봇 협응 botMafiaTarget(계획·DO 실행·넘기기) (TDD, W1)
- [x] 09-03-PLAN.md — 밤 받는 사람: canMoveIn isMafia·audience 밤 분기·worldVisibleTo 시민 편 본인 한 칸 (TDD, W1)
- [x] 09-04-PLAN.md — home 기억(captureHome·teleportHome·저장 복원)·approachPoint (TDD, W1)
- [x] 09-05-PLAN.md — 얼굴 그림 8장·faceSrc·아이콘 다섯·FaceList 부품 (TDD, W1)
- [x] 09-06-PLAN.md — 긴장 큐 스케줄러 tension.ts·L3 정적 검사 (TDD, W1)

**Wave 2**
- [x] 09-07-PLAN.md — 전원 일치 판정·saved 공개·아침 길이 공식·마피아 집계 view·9페이즈 와이어 타입 (TDD, W2)
- [x] 09-08-PLAN.md — WillSheet 부품·조합 종료 값 훅 (TDD, W2)

**Wave 3**
- [x] 09-09-PLAN.md — afterTransition·home 기록·밤/아침 위치 동기화·nightLeak 트레이서 (TDD, W3)
- [x] 09-10-PLAN.md — 분필 메시·시민 편 어둠 조명·내 캐릭터 빛·동료 고리 색 (TDD, W3)
- [x] 09-11-PLAN.md — 채팅 카드(보류·경찰 로컬 카드)·입력줄 깃펜 (TDD, W3)

**Wave 4**
- [x] 09-12-PLAN.md — will·note 메시지·saveWill·saveNote·본인/산 마피아 응답·봇 유언·다가가기 (TDD, W4)
- [x] 09-13-PLAN.md — 밤 마피아 화면: 다가가기·고리·배지·'확정' 도장·확정 줄 (TDD, W4)

**Wave 5**
- [x] 09-14-PLAN.md — 사망 카드(유언·쪽지)·분필 좌표·chatLog k (TDD, W5)
- [x] 09-15-PLAN.md — 경찰·의사 얼굴 목록 패널·8페이즈 밤 임시 틀 삭제·시민 편 어둠·긴장 비네트 (TDD, W5)

**Wave 6**
- [x] 09-16-PLAN.md — 메타모픽 누설 증명 (i)(ii)·L9·L6·신분 행렬·유언 canary (TDD, W6)
- [x] 09-17-PLAN.md — 유언·쪽지 화면 흐름: [유언]·[쪽지]·깃펜·시트·키보드 (TDD, W6)

**Wave 7**
- [x] 09-18-PLAN.md — 밤·아침 알림(세 문장·피해자·경찰 순서)·v1.0 아침 문구 번호 삭제 (TDD, W7)
- [x] 09-19-PLAN.md — smoke 새 규칙(전원 일치·시민 편 무프레임·유언 카드·아침 길이) (W7)

**Wave 8**
- [x] 09-20-PLAN.md — 장면 전환 막·암살 이펙트·경찰 결과 카드 (TDD, W8)

**Wave 9**
- [x] 09-21-PLAN.md — E2E 도우미: 밤 패널 높이·표식·판정 함수·앱 동기화 (TDD, W9)

**Wave 10**
- [x] 09-22-PLAN.md — E2E night 흐름 전체·폰 6종·G/H·nightload 렌더 측정 (W10)

**Wave 11**
- [x] 09-23-PLAN.md — 배포·배포본 smoke/E2E·architecture·실기기·팀 테스트 이월(999.6)·HANDOFF (W11)

**보완(갭 닫기) — 사용자 피드백 묶음 A + 코드 리뷰 WR-01·WR-02·IN-01** *(묶음 B 5·8·9·12 는 시안 뒤 별도 페이즈)*
- [x] 09-24-PLAN.md — 서버: 알람 따라잡기 home 되돌림(WR-01)·봇 입력 중 신호·봇 이름 길이 무작위 (TDD, G1)
- [x] 09-25-PLAN.md — 깃펜 입력줄 오른쪽 끝·쓰기 시트 저장→닫기(IN-01)·경찰 카드 좌석 색(WR-02) (TDD, G1)
- [x] 09-26-PLAN.md — 역할 배정·역할 확인 배경 v2.0 3D 무대·역할 카드 시트 내용 높이 (TDD, G1)
- [x] 09-27-PLAN.md — 인원·진행 숫자 '현재 / 최대'·[시작] 최소 인원 비활성/활성·E2E 측정 (TDD, G2)
- [x] 09-28-PLAN.md — 모든 단계 타이머 임박 색 규칙 하나(timerTone) (TDD, G3)
- [x] 09-29-PLAN.md — 결과 화면 [처음으로] 아래 고정·E2E 폰 6종 RS-FIT (TDD, G3)
- [x] 09-30-PLAN.md — 결정 0062·문서·HANDOFF·로컬 E2E·전체 시험 한 번·push(배포 없음) (G4)

**UI hint**: yes
**계획 메모**: 연구 권장 — 밤 규칙(선례가 약한 "물리적 암살 + 어둠"), 메타모픽 누설 테스트 설계(마피아가 움직일 때/가만히 있을 때 시민 소켓 프레임 열 비교), 재접속 첫 스냅샷도 같은 뷰 함수를 쓰는지. 이 페이즈 계획(discuss) 때 확정할 것: 아침 시작 위치 — 결정 0044-18 은 "밤이 끝난 자리" 이지만 리서치는 마피아가 시체 옆에 서 있으면 낮 위치로 정체가 샌다며 산 사람을 낮 시작 대형으로 되돌리고 분필만 남기라고 권한다. 유언 공개 대상과 "누군가 살아났습니다" 는 v1.0 D-13(구출 비공개)을 바꾸는 결정 0044-22 를 따른다.

### Phase 09.1: 묶음 B 연출: 낮 순차 지목, 직업 의상 유령, 유언 편지 공개 (INSERTED)

**Goal**: 낮 지목이 한 명씩 차례로 진행되고, 탈락자는 직업 의상을 입은 옅은 안개 유령이 되며, 암살 유언은 화면 가운데 편지로 한 줄씩 써지며 공개된다 (결정 0063, 시안 `design/v2.0/mockups-b/`)
**Requirements**: 사용자 피드백 5·8·9·12 (`.planning/phases/09-night-morning/09-USER-FEEDBACK.md` 묶음 B)
**Depends on:** Phase 9
**Success Criteria** (what must be TRUE):
  1. 지목 단계에서 살아 있는 사람이 가운데 모이고 순서대로 한 명씩 지목한다. 한 명당 8초(기본값)이고 못 고르면 기권, 봇은 즉시 고르며, 서버가 차례인 사람의 지목만 받는다
  2. 탈락자가 직업 의상(마피아·경찰·의사·시민)을 입은 옅은 안개 유령이 된다. 직업 의상은 유령 시점과 판 종료 후에만 보이고 산 사람에게는 직업이 새지 않는다(누설 시험 통과)
  3. 암살 유언이 아침에 화면 가운데 편지로 올라와 첫 줄이 쓰이고 다음 줄이 쓰이며, 실링왁스 인장이 찍히고, 5초 뒤 접혀 채팅에도 남는다
  4. 기존 자동 시험(빌드·단위·워커·E2E)이 통과하고 배포본에서 한 판이 돈다

**UI hint**: yes
**계획 메모**: UI-SPEC 먼저(`/gsd-ui-phase 09.1`).
**Plans:** 12/12 plans executed

Plans:

**Wave 1**
- [x] 09.1-01-PLAN.md — 순차 지목 엔진(순수)·day.turn 와이어 타입·시간 상수, 미결 M 결정 표 (TDD, W1)

**Wave 2**
- [x] 09.1-02-PLAN.md — 봇 차례 즉시 지목·넘기기 지목 마무리(차례 있을 때만 타는 경로) (TDD, W2)
- [x] 09.1-03-PLAN.md — 지목을 지나가는 시험 도우미를 지목 방식과 무관하게 (W2)

**Wave 3**
- [x] 09.1-04-PLAN.md — 전환: tick 표·방 DO applyPoint 배선, 옛 지목 방 정규화, 시험 기대값 (TDD, W3)

**Wave 4**
- [x] 09.1-05-PLAN.md — 끊긴 차례·재접속 DO 통합, 누설 L12·L14·L15, 옛 경로 삭제, 스모크·봇 스크립트 (TDD, W4)

**Wave 5**
- [x] 09.1-06-PLAN.md — 화면 순수 모델 turnLook·채팅 줄·헤더 안내, 지목 위 알림·선두·과반 연출 삭제 (TDD, W5)

**Wave 6**
- [x] 09.1-07-PLAN.md — 차례 알약·막대·위 한 줄, 내 차례 버튼·계속 깜빡임, 차례 고리 (TDD, W6)

**Wave 7**
- [x] 09.1-08-PLAN.md — 지목 스테이지 윗변·압축형, E2E 순차 지목(폰 6종) (TDD, W7)

**Wave 8**
- [x] 09.1-09-PLAN.md — 직업 의상 안개 유령·불투명 이름표·L13·E2E ghost (TDD, W8)

**Wave 9**
- [x] 09.1-10-PLAN.md — 손글씨 글꼴 자체 호스팅(OFL)·편지 시간표·카드 보류·편지 훅 (TDD, W9)

**Wave 10**
- [x] 09.1-11-PLAN.md — 유언 편지 부품·아침 알림 위로·E2E 편지(폰 6종 100자) (TDD, W10)

**Wave 11**
- [x] 09.1-12-PLAN.md — 결정 0064·문서·HANDOFF·실기기 목록·로컬 전체 검증·push(배포 없음) (W11)

### Phase 09.1.1: 정치·박진감 장치: 직업 주장 배지, 귓속말, 찬반 기록 공개, 동점 결선, 마지막 3인 결전, 마지막 지목자 조명, 판결 순간 연출 (결정 0066) (INSERTED)

**Goal**: 낮에 말할 거리와 편 가르기 재료가 생겨 정치로 몰아가는 플레이가 되고, 지목·판결 순간이 박진감 있다 (결정 0066)
**Requirements**: POL-01 직업 주장 배지 · POL-02 귓속말 · POL-03 찬반 기록 공개 · POL-04 동점 결선 · POL-05 마지막 3인 결전 · POL-06 마지막 지목자 조명 · POL-07 판결 순간 연출 (사용자 피드백 게임성 개선, 결정 0066 — ID 는 계획 단계에서 부여)
**Depends on:** Phase 9.1
**Success Criteria** (what must be TRUE):
  1. 낮에 이름표에 직업 배지(이번 판 구성 직업 + 말 안 함)를 걸고 바꿀 수 있고 모두에게 공개된다. 거짓 주장이 가능하고 실제 역할은 새지 않는다
  2. 하루 1번 다른 산 사람에게 30자 귓속말을 보낼 수 있고, 내용은 보낸·받은 소켓에만 가고 모두에게는 "A → B 귓속말" 사실만 보인다
  3. 찬반 결과가 나오면 누가 찬성·반대했는지 얼굴 두 묶음으로 공개된다
  4. 득표 최다가 정확히 둘로 동점이면 5초 결선이 열리고, 산 사람이 셋이 되면 마지막 3인 결전(8초 한마디 후 동시 지목)이 열린다
  5. 순차 지목 중 지금 지목하는 사람에게 핀 조명이, 판결 순간 변론자에게 핀 조명과 느린 확대가 있다
  6. 누설 시험(귓속말 본문)과 폰 6종 E2E가 통과하고 배포본에서 한 판이 돈다

**Plans:** 17/17 plans executed
**UI hint**: yes
**계획 메모**: UI-SPEC 먼저(`09.1.1-UI-SPEC.md`, 사용자 위임으로 승인 간주). 서버(01~07) → 화면(08~16) → 마무리(17) 순차 웨이브, 화면 조각마다 끝에 E2E 폰 6종. 새 와이어 메시지는 `badge`·`whisper` 둘뿐(결선·마지막 3인은 기존 `point`·`chat` 재사용). 배포는 계획에 없다 — 모든 계획이 끝난 뒤 오케스트레이터가 한다.

Plans:

**Wave 1**
- [x] 09.1.1-01-PLAN.md — 서버: 직업 주장 배지(badge 메시지·말 바꿈·이력 서버 전용·L18 메타모픽) (TDD, W1)

**Wave 2**
- [x] 09.1.1-02-PLAN.md — 서버: 귓속말(whisper·본문/사실 두 줄 같은 seq·하루 1번·L17 신분 행렬) (TDD, W2)

**Wave 3**
- [x] 09.1.1-03-PLAN.md — 서버: 찬반 기록 공개(verdict.ballots·처형 5.6초·ballots 카드 보관/복원·L19, 0053 개정 전환) (TDD, W3)

**Wave 4**
- [x] 09.1.1-04-PLAN.md — 서버: 동점 결선 엔진·전환(runoff 단계·point 분기·L20, 2자 동점 시험 교체) (TDD, W4)

**Wave 5**
- [x] 09.1.1-05-PLAN.md — 서버: 결선 걷기 배치·봇 투표·넘기기 (TDD, W5)

**Wave 6**
- [x] 09.1.1-06-PLAN.md — 서버: 마지막 3인 엔진·전환(showdown 단계·chat 한마디·point 지목·L21, 3명 낮 시험 교체) (TDD, W6)

**Wave 7**
- [x] 09.1.1-07-PLAN.md — 서버: 마지막 3인 걷기 배치·봇·넘기기·smoke full/소켓 봇 전환 (TDD, W7)

**Wave 8**
- [x] 09.1.1-08-PLAN.md — 화면: 직업 주장 배지(이름표 모서리·떠 있는 버튼·칩 시트·새 아이콘 3개) (TDD, W8)

**Wave 9**
- [x] 09.1.1-09-PLAN.md — 화면: 귓속말(모드·한 줄 시트·채팅 줄 세 가지·받음 토스트) (TDD, W9)

**Wave 10**
- [x] 09.1.1-10-PLAN.md — E2E: 배지·귓속말 폰 6종·키보드·기존 흐름 회귀 (W10)

**Wave 11**
- [x] 09.1.1-11-PLAN.md — 화면: 핀 조명 장치 setPin·지목 차례 핀·__mfPin 훅·E2E (TDD, W11)

**Wave 12**
- [x] 09.1.1-12-PLAN.md — 화면: 판결 순간 시간표·찬반 기록 부품(BallotReveal)·알림 +0.6초·ballots 카드 (TDD, W12)

**Wave 13**
- [x] 09.1.1-13-PLAN.md — 화면: 판결 순간 연결(막·핀 윈도우·느린 확대)·E2E 폰 6종 (TDD, W13)

**Wave 14**
- [x] 09.1.1-14-PLAN.md — 화면: 동점 결선(blockLook 일반화·이름표 투표·가운데 핀)·E2E 폰 6종 (TDD, W14)

**Wave 15**
- [x] 09.1.1-15-PLAN.md — 화면: 마지막 3인(한마디 칩 시트·인용 카드·동시 지목·공개) (TDD, W15)

**Wave 16**
- [x] 09.1.1-16-PLAN.md — E2E: 마지막 3인 폰 6종·기존 흐름 전체 회귀·성능 기록 (W16)

**Wave 17**
- [x] 09.1.1-17-PLAN.md — 결정 0067·문서·HANDOFF·실기기 목록·로컬 전체 검증·push(배포 없음) (W17)

### Phase 10: 캐릭터·동작·의상

**Goal**: 자리표시 그림이 관절 리그 캐릭터로 바뀌어 걷고, 동작으로 반응하고, 로비에서 의상을 갈아입는다
**Depends on**: Phase 9 (한 판이 자리표시 그림으로 돌고 있음), Phase 6 (렌더 게이트 결과). 선행 조건: 공통 몸체·의상·동작 디자인 승인과 `ASSET_SPEC.md` v2 규격
**Requirements**: AVTR-01, AVTR-02, AVTR-03, AVTR-04, AVTR-05
**Success Criteria** (what must be TRUE):
  1. 1번 시안의 3D 조립 인물(`design/v2.0/3d/`, 결정 0047)에 의상·소품을 입힌 캐릭터가 걸을 때 걷는 동작을 하고 이동 방향으로 돈다. 캐릭터 8명이 걸어도 6페이즈 성능 게이트 기준을 실제 아트로 다시 통과한다 (AVTR-01, AVTR-02)
  2. 동작 목록(목 긋기·손사래·칭찬/박수·울기·악수 등 8개 이상)에서 고르면 내 캐릭터가 제자리에서 동작하고 같은 공간을 보는 모두에게 보인다. 이동하면 동작이 끊기고 서버가 연타를 막는다. 밤 마피아의 동작과 유령의 동작은 같은 채널을 보는 사람 폰에만 간다 (AVTR-03)
  3. 지목·변론·찬반처럼 이동이 막힌 구간에서도 제자리 동작과 채팅이 된다 (AVTR-05)
  4. 로비에서 여러 직업 의상을 눌러 갈아입으면 다른 폰에서도 바로 바뀌어 보이고, 고른 외형은 게임 중에도 유지된다. 의상은 실제 역할과 관계없이 고른 대로 나온다 (AVTR-04)

**Plans**: 2/9 plans executed
**UI hint**: yes
**계획 메모**: 캐릭터는 1번 시안의 구·원통 조립 3D 인물이다(결정 0047) — 관절별 메시 합치기로 드로우콜 예산 지키기, 동작 키프레임 품질(손 4종·표정 10종), 시안 `design/v2.0/3d/mf3d.js` 를 출발점으로 쓴다. 에셋 출처·약관을 `manifest.json` 에 기록하고 에셋 검증 스크립트와 포즈 스트립 디버그 페이지를 둔다. 동시 재생 상한을 명시한다. 감정표현은 몸 동작만이고 머리 위 표시는 전혀 두지 않는다(사용자 결정 2026-11-05, 결정 0064-16).
**계획 확정 메모(10-UI-SPEC 기준)**: 현재 코드가 3D 조립 인물·의상 9종·동작 9종을 이미 가져 이 페이즈는 연결과 검증이 주 일이다. 출발점은 `mf3d.js` 가 아니라 `src/world/character.ts` 이고 새 부품·표정·손 모양은 만들지 않는다. 서버(01·02) → 장면(03·04) → 화면(05·07) → 에셋 검사(06)·막힌 구간(08) → 마무리(09). 폰 6종 전체 회귀와 성능 측정은 마지막 계획에서만 한 번(사용자 요청: 실행 시간 단축), 앞 계획은 단위·워커 시험과 바꾼 E2E 흐름 하나 × 1~2개 폰 크기만. 새 와이어 메시지는 `emote`·`dress` 둘. 배포는 계획에 없다 — 모든 계획이 끝난 뒤 오케스트레이터가 한다.

Plans:

**Wave 1**
- [x] 10-01-PLAN.md — 서버: 동작(emote 메시지·채널별 수신·연타 방지·단계 키·이동 중 버림·재접속 무재생·L27~L30) (TDD, W1)

**Wave 2**
- [x] 10-02-PLAN.md — 서버: 의상(dress 메시지·Player.look 공개·로비에서만·250ms·L25·L26 메타모픽) (TDD, W2)
- [ ] 10-03-PLAN.md — 장면: emote 프레임 재생(동시 상한 4·stopEmote·단계 전환 정리·모션 줄이기·표정 병합 선행·__mfEmotes) (TDD, W2)

**Wave 3**
- [ ] 10-04-PLAN.md — 장면: 좌석별 의상(유령 직업 의상 안개 우선·복원·이전 지오메트리 해제·__mfLooks·머리 위 표시 없음 L31) (TDD, W3)
- [ ] 10-05-PLAN.md — 화면: 입력줄 동작 버튼·5+4 아이콘 판·비활성 규칙·E2E avatar-emote 폰 2종 (TDD, W3)

**Wave 4**
- [ ] 10-06-PLAN.md — 에셋: check:character 45조합 예산·manifest·포즈 스트립 디버그 화면·성능 시나리오 확장 (TDD, W4)
- [ ] 10-07-PLAN.md — 화면: 로비 꾸미기 hanger 버튼·한 줄 카드 띠 시트·미리 보기/되돌림·E2E avatar-dress 폰 2종 (TDD, W4)

**Wave 5**
- [ ] 10-08-PLAN.md — 막힌 구간·밤·유령: 단계 × 신분 수신자 표·지목 유지 자세 위 동작·E2E avatar-phases (TDD, W5)

**Wave 6**
- [ ] 10-09-PLAN.md — 결정 0068·문서·HANDOFF·실기기 목록·폰 6종 회귀·성능 한 번·위생 검사·push(배포 없음) (W6)

### Phase 11: 결과 공개와 다시 하기

**Goal**: 판이 끝나면 숨겨졌던 채팅이 공개되고 시상식이 열리며, 같은 멤버로 바로 다시 하고, 방장이 사라져도 방이 이어진다
**Depends on**: Phase 10 (의상 유지, 동작 통계), Phase 8, Phase 9
**Requirements**: END-03, END-04, REMATCH-01, CONNX-01, CONNX-02, MAP-06
**Success Criteria** (what must be TRUE):
  1. 결과 화면에서 마피아 밤 채팅과 유령 채팅이 모두에게 공개된다. 판이 도는 동안에는 어떤 메시지로도 새지 않았다 (END-03)
  2. 판이 끝나면 서버 기록으로 정한 재미있는 칭호를 주는 시상식이 열리고, 모든 플레이어가 하나 이상 받는다 (END-04)
  3. 결과 화면에서 "준비" 한 사람들이 같은 방에서 바로 다음 판을 시작한다. 의상은 유지되고, 이전 판의 역할·밤 행동·채팅 같은 비공개 정보는 새 판에 남지 않는다 (REMATCH-01)
  4. 방장이 나가거나 30~60초 넘게 돌아오지 않으면 가장 먼저 들어온 연결자에게 방장이 넘어가 방이 이어지고, 로비에서 오래 돌아오지 않는 사람은 자동으로 정리된다 (CONNX-01, CONNX-02)
  5. 방장이 로비에서 지하 재즈 바 · 시계탑 광장 · 랜덤(기본값) 가운데 맵을 고르고, 랜덤이면 서버가 게임 시작 때 정한 같은 맵이 모두에게 열린다. 두 맵 모두에서 한 판이 끝까지 돈다 (MAP-06, 결정 0050)

**Plans**: 0/14 plans executed
**UI hint**: yes
**계획 메모**: 결과 화면에 귓속말 내용·직업 주장 이력 공개(결정 0066)와 칭호(연기대상·헛다리왕 등)를 더한다. 표준 패턴이라 연구 생략 가능(순수 함수 `rematch`·`awards`, v1.0 `testReset` 길 일반화). 통계 카운터는 7~10페이즈 구현 때 훅을 같이 심어 둔다. 판 번호(`round`)로 이전 판 메시지를 거부해 동시 클릭·늦은 메시지에도 안 꼬이게 한다. 시상 칭호 최종 목록과 채팅 공개 사전 안내 문구는 디자인 단계에서 정한다.
**계획 확정 메모(11-UI-SPEC 기준)**: 서버 규칙(01·02·03·04·06·08)과 화면(05·07·09·11·12·13)을 번갈아 두어 서로 다른 파일을 쓰는 계획은 같은 웨이브에서 나란히 돈다(W4 04‖05, W5 06‖07, W6 08‖09‖10). 광장은 데이터 표(06)와 3D 장면(10)과 선택 화면(13)으로 나눠 `PLAYABLE_MAPS` 한 곳으로 노출을 잠갔다 — 10·13 한 쌍이 빠져도 나머지는 재즈 바 하나로 온전하다(13 이 E2E 통과 뒤에만 연다). 폰 6종 전체 회귀·재즈 바와 광장 성능·결정 0069·문서·HANDOFF·위생 검사·push 는 마지막 계획(14)에서만 한 번(사용자 요청: 실행 시간 단축), 앞 계획은 단위·워커 시험과 바꾼 E2E 흐름 × 1~2개 폰 크기만. 새 와이어: 메시지 `ready`·`rematch`·`mapPick`, 프레임 `resultLog`. 배포는 계획에 없다 — 모든 계획이 끝난 뒤 오케스트레이터가 한다.

Plans:

**Wave 1**
- [ ] 11-01-PLAN.md — 서버: 판 번호 round·세 부분 단계 키(이전 판 폐기)·판 통계 카운터 stats (TDD, W1)

**Wave 2**
- [ ] 11-02-PLAN.md — 서버: 칭호 computeAwards(열 개 + 대체 둘, 서버 정렬)·result.awards·L35~L37 (TDD, W2)

**Wave 3**
- [ ] 11-03-PLAN.md — 서버: 결과 단계 한 줄 채팅·resultLog 프레임(ended 진입 + hello 재전송)·L35·L36 (TDD, W3)

**Wave 4**
- [ ] 11-04-PLAN.md — 서버: 방장 이양 45초·대기실 정리 3분·결과 단계 leave·L43 (TDD, W4)
- [ ] 11-05-PLAN.md — 화면: 결과 3D 무대(모임·뒤집기·직업 의상·조명·박수·승리 알림)·건너뛰기·E2E result (TDD, W4)

**Wave 5**
- [ ] 11-06-PLAN.md — 서버: 맵 표·광장 이동 마스크·mapPick·시작 때 map 결정·PLAYABLE_MAPS 잠금·L40·L42 (TDD, W5)
- [ ] 11-07-PLAN.md — 화면: 탭 패널(전체·마피아·유령·귓속말·기록)·ResultLogStore·사전 안내·E2E result-reveal 폰 2종 (TDD, W5)

**Wave 6**
- [ ] 11-08-PLAN.md — 서버: ready·rematch·허용 목록 리터럴·쉬는 사람 bench/sat·결과 꾸미기·L38~L41 (TDD, W6)
- [ ] 11-09-PLAN.md — 화면: 시상식(AwardPlate·2.5초 연출·넘기기·일시정지)·E2E result-awards 폰 2종 (TDD, W6)
- [ ] 11-10-PLAN.md — 광장 3D 장면·단계 조명 표·시계·맵 id 로 렌더러·런타임 선택·광장 성능 측정 입구 (TDD, W6, 11-13 과 한 쌍)

**Wave 7**
- [ ] 11-11-PLAN.md — 화면: 기록 타임라인(일차 카드 띠·하루 상세)·E2E result-awards 기록 검사 (TDD, W7)

**Wave 8**
- [ ] 11-12-PLAN.md — 화면: 준비/시작 알약·쉬게 될 사람 시트·BenchView·sat 표시·결과 꾸미기·E2E result-rematch·host-handoff (TDD, W8)

**Wave 9**
- [ ] 11-13-PLAN.md — 화면: 지도 칩·꾸미기 시트 맵 탭·맵 카드 그림·PLAYABLE_MAPS 개방·E2E map-select (TDD, W9, 11-10 과 한 쌍)

**Wave 10**
- [ ] 11-14-PLAN.md — 결정 0069·문서·HANDOFF·실기기 목록·폰 6종 회귀·성능(재즈 바·광장)·위생 검사·push(배포 없음) (W10)

### Phase 12: 소리와 마무리

**Goal**: 배경음과 효과음이 분위기를 만들고 각자 폰에서 끄고 켤 수 있으며, v2.0 전체를 팀 테스트로 마무리한다
**Depends on**: Phase 11 (소리를 붙일 이벤트가 모두 확정된 뒤)
**Requirements**: SOUND-01, SOUND-02, SOUND-03
**Success Criteria** (what must be TRUE):
  1. 로비·낮·밤·결과에 분위기에 맞는 배경음이 나온다 (SOUND-01)
  2. 밤·아침 전환, 지목·찬반, 처형, 암살, 승패, 동작에 효과음이 나온다. 밤 중 소리는 시민 편에게 마피아의 움직임이나 암살 결과를 미리 알려 주지 않는다(암살 효과음은 판정 뒤 암살당한 사람에게만) (SOUND-02)
  3. 각자 폰에서 소리를 끄고 켤 수 있다. iOS 는 참가 버튼(재접속 때는 "소리 켜기")에서 오디오가 깨어나고, 소리로만 알리는 정보는 없다 (SOUND-03)
  4. 팀(4명 이상)이 배포본에서 소리·동작·의상·시상·다시 하기까지 모두 켜고 연속으로 판을 하고, 다시 하고 싶어 하는지 확인한다 (개발자 성공 지표)

**Plans**: TBD
**UI hint**: yes
**계획 메모**: 연구 권장 — iOS 소리(무음 스위치 기본 존중, 중단 복구, `audioSession`), 소리 에셋 출처·상업 이용 약관 기록. 화면은 소리 끄기/켜기와 "소리 켜기" 안내에 한정된다. 소리는 서버 이벤트에 직접 묶지 않고 낮 공개 이벤트와 클라이언트 로컬 대본에만 쓴다(밤 누설 방지). 남은 v1.0 코드·테스트 잔재를 삭제 표 기준으로 일괄 점검하고 보류 항목을 정리한다.

## Progress

**Execution Order:**
Phases execute in numeric order: 6 → 7 → 8 → 9 → 10 → 11 → 12 (소수점 페이즈는 사이에 끼워 넣는다)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 6. 월드 뼈대 | v2.0 | 23/23 | Complete    | 2026-11-01 |
| 7. 자유 채팅 | v2.0 | 27/27 | Complete    | 2026-11-02 |
| 8. 낮 처형과 유령 | v2.0 | 28/28 | Complete    | 2026-11-03 |
| 9. 밤과 아침 | v2.0 | 30/30 | In Progress | - |
| 10. 캐릭터·동작·의상 | v2.0 | 2/9 | In Progress | - |
| 11. 결과 공개와 다시 하기 | v2.0 | 0/14 | Not started | - |
| 12. 소리와 마무리 | v2.0 | 0/TBD | Not started | - |

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
**Follow-ups:** (절차와 칸은 `.planning/phases/08-day-execution-ghost/08-DEVICE-CHECKS.md`)
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
**Follow-ups:** (절차와 칸은 `.planning/phases/09-night-morning/09-DEVICE-CHECKS.md`)
- [ ] iPhone 16 Pro 낮 + 밤 + 아침 5분 평균 55fps·끊김 5회 이하·열감 — 크롬 4× 스로틀 nightload 숫자(평균 59.99fps, 끊김 0)와 나란히 대조, 기준은 낮추지 않는다
- [ ] 시민 편 어둠 가독·헤더 글자 대비 4.5:1, 아침 가독(분필·36px 알림·유언 카드·쪽지 카드), 밤 이름표 위치가 9페이즈 카메라로 해소됐는지(8페이즈 B8)
- [ ] 유언 시트 + iOS 키보드, 얼굴 칸 누르기(4자·8자 이름), 마피아 이름표 버튼 누르기·확정 도장
- [ ] 맥박·번쩍임 체감(모션 줄이기 포함), 막 타이밍과 분필 순서, 카드 시간순 겹침, 360×560 경찰 밤 8자 이름 한계
- [ ] Android Chrome·삼성 인터넷·카카오톡 인앱에서 밤·아침 흐름(유언 시트 입력칸·얼굴 칸)
- [ ] 팀(4명 이상) 한 판 관찰 ①~⑥(시민 30초 긴장, 확정 걸리는 시간·실패 원인, 아침 화제성, 위치 되돌림, 소리 없는 긴장 연출, 대면 마피아 느낌) — 결과로 10페이즈 이후 투자를 정한다
