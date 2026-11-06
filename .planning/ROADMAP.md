# Roadmap: minifia

## Milestones

- ✅ **v1.0 MVP** — Phases 1~5 (3.1 포함, 6 삭제) (shipped 2026-10-30) → [상세](milestones/v1.0-ROADMAP.md)
- ✅ **v2.0 같은 공간** — Phases 6~12 (9.1·9.1.1 포함) (completed 2026-11-07, main 반영은 v3.0 실테스트 뒤) → [상세](milestones/v2.0-ROADMAP.md)
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
