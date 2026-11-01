---
gsd_state_version: "1.0"
milestone: v2.0
milestone_name: 같은 공간
current_phase: 07
current_phase_name: 자유 채팅
status: executing
stopped_at: Phase 7 UI-SPEC approved
last_updated: "2026-11-01T12:13:49.002Z"
last_activity: 2026-11-01
last_activity_desc: Phase 06 complete, transitioned to Phase 7
state_head: dc008fdfa4be6dfaeb71a0f251c8c8dd8dc71e50
progress:
  total_phases: 7
  completed_phases: 1
  total_plans: 45
  completed_plans: 23
  percent: 14
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-11-01)

**Core value:** 링크 하나로 모인 친구들이 설명 없이 정통 마피아 한 판(6~10분)을 끝까지 마치는 것
**Current focus:** Phase 7 — 자유 채팅

## Current Position

Phase: 07 (자유 채팅) — READY TO EXECUTE
Plan: Not started
Status: Ready to execute
Last activity: 2026-11-01 — Phase 06 complete, transitioned to Phase 7

Progress: [█░░░░░░░░░] 14% (1/7 phases)

## Performance Metrics

**Velocity (v2.0):**
- Total plans completed: 23
- Average duration: - min
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 06 | 23 | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion. v1.0 지표(107 plans)는 MILESTONES.md 와 git 기록에 있다*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 06 P01 | 12 min | 3 tasks | 17 files |
| Phase 06 P02 | 12 min | 3 tasks | 2 files |
| Phase 06 P03 | 6min | 3 tasks | 4 files |
| Phase 06 P05 | 8 min | 3 tasks | 5 files |
| Phase 06 P04 | 3 min | 3 tasks | 6 files |
| Phase 06 P06 | 25min | 3 tasks | 13 files |
| Phase 06 P08 | 17 min | 3 tasks | 8 files |
| Phase 06 P09 | 10min | 2 tasks | 15 files |
| Phase 06 P10 | 12 min | 3 tasks | 9 files |
| Phase 06 P11 | 9 min | 3 tasks | 3 files |
| Phase 06 P12 | 10 min | 2 tasks | 8 files |
| Phase 06 P13 | 13 min | 3 tasks | 10 files |
| Phase 06 P14 | 18 min | 3 tasks | 15 files |
| Phase 06 P07 | 3min | 3 tasks | 9 files |
| Phase 06 P15 | 20 min | 3 tasks | 22 files |
| Phase 06 P16 | 12 min | 2 tasks | 6 files |
| Phase 06 P21 | 15min | 3 tasks | 10 files |
| Phase 06 P17 | 55min | 2 tasks | 9 files |
| Phase 06 P18 | 41 min | 2 tasks | 9 files |
| Phase 06 P19 | 50 min | 3 tasks | 16 files |
| Phase 06 P20 | 12 min | 2 tasks | 4 files |
| Phase 06 P22 | 6min | 3 tasks | 12 files |
| Phase 06 P23 | 14 min | 3 tasks | 6 files |

## Accumulated Context

### Decisions

v1.0 의 결정 로그는 `docs/decisions/0001~0043` 과 `.planning/milestones/v1.0-phases/*/*-SUMMARY.md` 에 있다(이 목록은 v1.0 마감 때 비웠다, git 기록 보존). v2.0 범위는 결정 0044(1~24항).

- [Roadmap v2.0]: 7개 페이즈 6~12 — 월드 뼈대 → 자유 채팅 → 낮 처형과 유령 → 밤과 아침 → 캐릭터·동작·의상 → 결과 공개와 다시 하기 → 소리와 마무리. 자리표시 그림으로 한 판을 먼저 완주시키고 꾸밈 층(실제 아트·소리·시상)을 뒤에 얹는다
- [Roadmap v2.0]: 유령(GHOST)을 낮 처형 페이즈에 묶었다 — 고정 테이블 삭제로 v1.0 관전 화면이 사라져 첫 처형부터 죽은 사람이 지켜볼 곳이 필요하다
- [Roadmap v2.0]: 6페이즈에 렌더 성능 게이트(실기기 5분 평균 55fps 이상)를 둔다. 미달이면 그림자·광원·건물 예산을 줄이고, 그래도 모자라면 맵을 미리 구운 이미지로(결정 0046)
- [Roadmap v2.0]: 9페이즈에서 한 판이 맵 위(낮 + 밤)에서 처음 끝까지 돌고 팀 테스트로 재미 가설을 확인한 뒤 10페이즈 이후 투자를 이어 간다
- [Phase 06]: [06-01] 배포 대상은 scripts/deploy-target.mjs 한 출처(minifia-v2), v1.0 호스트는 리터럴 한 곳 + 정적 검사 허용 목록으로 고정
- [Phase 06]: [06-01] v1.0 가드는 파싱된 url.origin 에 건다(base null 오탐 방지); 우회 플래그·환경 변수 없음
- [Phase 06]: 06-02: TO_CAMERA.y = 12.5 - 0.6 = 11.9 (카메라 위치 - 주시점), 마스크 가려짐 판정 기준
- [Phase 06]: 06-02: 입장 지점에서 닿지 않는 닫힌 구멍 칸 (2,2)(3,2) 는 BAR_MASK 에서 막는다
- [Phase 06]: 06-02: lineWalkable 은 닿기만 해도 검사하는 보수적 슈퍼커버, snapped 는 결과가 입력과 다르면 true
- [Phase 06]: 06-03: PAN_BOX ±4.8 (가시성을 통과하는 가장 좁은 0.1 단위 값, 폭 360 폰이 정함), PLATE_FAR 18.5 (빈 배경 최소 16.5 + 2) — 6개 폰 크기 × 걷는 영역 2304점 검사가 도출. 계획의 '가장 넓은 통과값' 은 방향이 거꾸로(pan 이 넓을수록 가시성은 쉬워짐)라 가장 좁은 통과값으로 정함
- [Phase 06]: 06-03: 맵 상태기계는 소실 3초에 재생성 한 번(shouldRecreate), 5초에 failed. visible 로 소실을 발견하면 숨겨 둔 시간은 세지 않고 그 시각부터 센다. loading 중 소실은 무시(06-13 은 loadError 로 알림) — T-06-06 재생성 폭주 완화, linkReducer visibility 규약과 일치
- [Phase 06]: 06-05: 복원 유효성은 모든 선분(한 점이면 그 점)의 lineWalkable 로 판정, 구간 v 상한 1000, 정수 ±700 밖은 손상
- [Phase 06]: 06-05: planWander 난수 순서 계약 — seat 오름차순, 때가 된 봇 [셀, 간격], 처음 보는 봇 [간격], 안 된 봇은 난수 없음
- [Phase 06]: three 0.186.1 정확 고정(최신 0.187.0 배제), lockfile 무결성은 deps.test.ts 가 지킨다
- [Phase 06]: v2.0 토큰 22개를 design/tokens.json 에 합침(serif 글꼴·글자 스타일은 7~8페이즈), v1.0 토큰 유지
- [Phase 06]: 06-06: 닉네임 상한 8자, 봇 이름 8자 적용, v1.0 고정 테이블 한정 E2E D9·D3b 6자 이상 이름 판을 승인 완화 범위로 (결정 0056, 사용자 선택 a)
- [Phase 06]: 06-08: MoveMessageSchema 를 ClientMessageSchema 앞에 선언(TDZ), move 는 ClientMessage 유니온 멤버
- [Phase 06]: 06-08: world 프레임은 emitWorld 한 곳(로비 전용)으로만 나가고 위치는 별도 world 키에 2초 디바운스 저장, 나가기·내보내기·시작·마지막 연결 끊김·알람에서 즉시 저장
- [Phase 06]: 06-08: 테스트 방 봇 배회는 로비·봇 있음·사람 연결일 때만 알람 하나에 합치고(min), 봇도 applyMove 본체를 지난다
- [Phase 06]: 06-09: world 프레임은 onEvent 로만 흘리고 종료 상태(replaced 포함)에서는 구독자에게 보내지 않는다. WorldStore 는 snap 통째 교체·낡은/새 epoch move 폐기
- [Phase 06]: 06-10: emissive 를 MeshBasicMaterial + 버텍스 컬러로 구현(병합하면 MeshStandardMaterial.emissive 는 색 하나뿐), BarScene.root 는 Scene 자체, 점광원 core 는 세기 0 + visible false, 사다리 LADDER 0~5 는 shadowMap 0 을 포함하지 않는다(사람 결정)
- [Phase 06]: 06-10: 렌더러 인터페이스 뒤에 three 를 가두고 recreate 는 씬 그래프를 재사용, 캐릭터 자원은 만든 쪽이 dispose(렌더러는 장면에서 떼기만)
- [Phase 06]: 06-11: 캐릭터 열린 면(챙·후드)은 DoubleSide 재질 대신 뒤집힌 복사본 지오메트리로 병합 재질 하나를 유지
- [Phase 06]: 06-11: update() 는 자세가 정한 표정이 바뀔 때만 표정 적용 — 바깥 setFace 가 서 있는 동안 유지됨(10페이즈 UI)
- [Phase 06]: 06-12: 이름표·알림은 닉네임을 React 텍스트 노드로만 그려 XSS 를 막고(T-06-26) 말줄임·최대 폭이 없다(nowrap)
- [Phase 06]: 06-12: v2 시간 링의 급함 색 진홍은 옮기지 않았다(UI-SPEC: 진홍·놋쇠는 이 페이즈 UI 에 없음). 시간 링을 쓰는 페이즈가 색을 정한다
- [Phase 06]: 06-12: TopToast 기본 위치는 mv-toast--top(top var(--toast-top)·z var(--z-toast)); 06-15 는 담는 틀을 position: relative 로 준다
- [Phase 06]: 06-12: 내 이름표 + 이모지 8개는 실측 약 202px 로 06-03 NAMETAG_MAX_W 180 을 넘는다(남의 이름표는 약 174px). camera.ts 는 바꾸지 않았고 PAN_BOX 재유도는 06-13/06-17 이 정한다
- [Phase 06]: 06-13: WorldStore.currentEpoch() 읽기 전용 getter 추가 — 새 연결의 첫 프레임에 카메라·캐릭터를 날리지 않고 바로 붙이는 신호
- [Phase 06]: 06-13: 런타임이 DOM 이름표의 transform·opacity·z-index(발 y 순위)를 직접 쓰고 React 는 내용·접근성·내보내기 버튼만 — 프레임마다 리렌더 없음, 나간 사람 이름표는 EXIT_MS 동안 유지
- [Phase 06]: 06-13: E2E 훅(window.__mfWorld)과 소프트웨어 렌더러 허용은 ?e2e=1(세션 저장) 또는 개발 빌드에서만 켠다 — 같은 조건 하나
- [Phase 06]: 06-13: 목적지 링은 렌더러 마커가 하나라 걷는 중 재탭은 새 목적지로 즉시 이동(이전 링 120ms 별도 페이드 없음). 열린 발견: 내 이름표+이모지 8개 약 202px > NAMETAG_MAX_W 180 은 PAN_BOX 건드리지 않고 사용자 결정 대기
- [Phase 06]: 06-14: 5초 동작은 걷는 사람을 먼저 세운 뒤 한다 — 8명이 거의 늘 걷고 있어 '걷지 않는 사람에게만' 을 지키면 5초 간격이 깨진다
- [Phase 06]: 06-14: 프레임 기록 칸은 5분 × 150Hz 로 잡고 가득 차면 truncated 표시 — 기본 19,800칸은 120Hz 폰에서 2분 45초에 찬다
- [Phase 06]: 06-14: 제품 런타임 autoDegrade 기본 true(10초 평균 45fps 미만이면 1~3단계), 스파이크는 false 로 단계 고정
- [Phase 06]: 06-14: LIGHT_TUNE 은 반구·달빛·노출·하늘색만 올림(talk 1.1π·0.85π·1.25, vote 0.7π·0.55π, vote 무대 점광원 8) — 점광원·emissive·빛 무리는 그대로, 최종 읽힘은 06-19 사람 확인
- [Phase 06]: 06-07: 배포 대상 이름은 vite define(__WORKER_NAME__)으로 클라이언트에 넘기고 'v2.0 시험판' 표식은 minifia-v2 빌드에서만 보인다; 첫 배포 뒤 v1 health 는 기준선 2026-10-29T14:52:03Z+cb6979c 와 같았다
- [Phase 06]: 안전 영역(env)을 로비에서 다시 더하지 않는다 — #root 패딩과 .mf-room 높이가 이미 노치를 비켜, 헤더 위 18·패널 아래 22 로 둔다
- [Phase 06]: 맵 안 가림막이 헤더를 덮지 않게 .mf-lobby > .mf-world 에 자기 쌓임 맥락을 준다 — 맵을 불러오는 동안에도 나갈 수 있다
- [Phase 06]: 로비 알림 억제는 서버 view 차이에서 온 입장·방장 알림에만 건다 — 내가 누른 일의 답(나가기 실패 문구)은 띠가 떠 있어도 보인다
- [Phase 06]: EXIT_CURTAIN_MS(420)는 runtime.ts 한 곳에서 WorldStage 가림막과 RoomScreen 단계 전환 지연이 같이 쓴다
- [Phase 06]: 06-16: Icon crown 정의와 DayTableSeat.onPress 는 삭제 목록 밖이라 남김(정리 후보); 자리 전이 훅은 06-15 에서 이미 삭제됨
- [Phase 06]: 06-21: 저장된 토큰으로 바로 들어가는 Home 길은 room-enter 표식을 찍지 않는다(3초 측정은 처음 방문 입장 기준, 테스트로 고정)
- [Phase 06]: 06-17: 결정 0056 개정(2026-11-01, 사용자 선택 1) — 승인 완화를 G2·D2·P10 으로 넓힘(v1.0 고정 테이블 이름표·칩 + 6 그래핌 이상 이름, 기준 수치 불변, 8~9페이즈에 테이블과 함께 삭제)
- [Phase 06]: 06-18: 재접속 콘솔 0건은 앱이 낸 경고·오류 0건으로 읽고, 브라우저 자신의 기록 세 가지(오프라인 네트워크 오류·개발 서버 StrictMode 소켓 경고·v1.0 프리로드 미사용 경고)만 이유와 함께 CONSOLE_ALLOW 로 허용
- [Phase 06]: 06-18: 맵 열고 닫기 메모리는 봇 대신 가만히 선 사람 4명으로 결정적 장면을 만들어 처음 값 이하로 판정(봇 장면은 geometries 29~52 로 비결정적)
- [Phase 06]: 06-18: deployhold 로컬 흉내는 worker/room.ts 파일 시각 갱신만으로 소켓이 끊기지 않아 미확인(가정 A1) — 06-19 의 실제 배포 1회로 확인
- [Phase 06]: 06-19 렌더 성능 게이트 판정 a: 지금 예산(사다리 0단계, 자동 강등 1~3)으로 확정(사용자 선택). 조건 B 4행 통과 + iPhone 16 Pro(iOS용 Chrome) vote 5분 59.98fps·열감 차갑다. 미확인 실기기 항목은 9페이즈, 채팅 확인표는 7페이즈로 이월
- [Phase 06]: 0057: 렌더 게이트 통과, 사다리 0단계(자동 강등 1~3), 3D 맵·캐릭터 유지
- [Phase 06]: 06-22: 내 이름표 맨 위 + 겹친 맨 앞 하나만 overlay-ink-strong (G-06-4 사용자 결정), 가장자리 당기기·카메라 변경 없음
- [Phase 06]: 06-23: dropSockets 는 합성 close(1006)를 먼저 dispatch 한 뒤 ws.close() — 배포 서버의 약 10초 close 지연에 의존하지 않는다 (G-06-6)
- [Phase 06]: 06-23: deployhold 배포 주소는 /api/health version 변화가 있을 때만 판정하고 없으면 DH0 미확인 행(통과로 세지 않음), 6분 띠 대기 제거

### Pending Todos

None yet.

### Blockers/Concerns

- [v2.0 전체] 디자인 선행: 맵·캐릭터는 승인 완료(결정 0046, `design/v2.0/`). 남은 것은 v2.0 디자인 시스템과 화면설계서(채팅창·동작 목록·지목·변론·찬반·밤·아침·결과). 승인 전에는 화면 페이즈(6~12)를 계획하지 않는다
- [6페이즈] WR-01~04 의 내용이 `DEFERRED-BUGS.md` 에 없다 — 연결 계층 코드(`useRoomConnection`·`linkReducer`·`worker/room.ts`)에서 원인을 확인해야 한다
- [6페이즈] three.js 맵 + 2D 캐릭터 합치는 방식(빌보드 vs DOM 겹치기)과 성능 게이트 결과로 렌더 예산을 정한다(결정 0046)
- [6페이즈] `wrangler.jsonc` 이름 변경 전에 배포하면 v1.0 을 덮어쓴다 — 이름·`prod-url.txt`·E2E/smoke 기본 주소·계정 확인 스크립트를 같은 커밋에서 바꾸고 가드 뒤에 첫 배포
- [9페이즈] 아침 시작 위치: 결정 0044-18 은 "밤이 끝난 자리" 이지만 리서치는 정체 누설을 우려해 낮 시작 대형 초기화를 권한다 — 9페이즈 논의에서 확정
- [12페이즈] iOS 무음 스위치·소리 에셋 상업 이용 약관은 실기기·출시 마일스톤에서 확인한다
- [출시 전] 수익화는 출시 전에 따로 정한다

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|

### Roadmap Evolution

- Phase 03.1 inserted after Phase 3 (v1.0): 순차 주장(결정 0023)과 역할 카드·일지(결정 0026) 구현, E2E 결함 해소
- v2.0 로드맵 생성 2026-10-30: 6~12페이즈 7개 (연구 SUMMARY 의 8단계에서 유령을 낮 처형에, 방장 이양·로비 정리를 결과 공개에 병합)

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| deferred_items | 04/deferred-items.md: 남은 무작위 — 방장 첫 밤 탈락 시 살아 있는 방장 E2E 흐름 재시도(설계대로의 확률, 04-34) | acknowledged | 2026-10-30 | v1.0 |
| deferred_items | 04/deferred-items.md: E2E 로 직접 못 본 것 — 모션 줄이기 결과 화면·관전 변론·처형·진홍 번짐 품질·iOS (실기기 승인으로 대신) | acknowledged | 2026-10-30 | v1.0 |

## Session Continuity

Last session: 2026-11-01T09:51:39.798Z
Stopped at: Phase 7 UI-SPEC approved
Resume file: .planning/phases/07-free-chat/07-UI-SPEC.md

## Operator Next Steps

- 메인 세션에서 v2.0 디자인(디자인 시스템·화면설계서·맵·캐릭터 리그/의상/동작)을 캔버스로 만들어 승인받고, 승인본 사본을 `design/` 에 둔다 (GSD 페이즈 아님)
- 6페이즈: `/gsd-ui-phase 6` → `/gsd-plan-phase 6 --research-phase` (연구 필수)
