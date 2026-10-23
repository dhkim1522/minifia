---
gsd_state_version: "1.0"
milestone: v1.0
milestone_name: MVP
current_phase: 01
current_phase_name: 걷는 뼈대
current_plan: 16
status: executing
stopped_at: 01-16 Task 3 실기기 확인 FAILED, G-01-9 open, 재진단 대기
last_updated: "2026-10-23T10:49:09.457Z"
last_activity: 2026-10-23
last_activity_desc: Phase 01 execution started
state_head: f7b4258e689fa131f4906268f2e9d37a380bd22c
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 17
  completed_plans: 16
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-21)

**Core value:** 링크 하나로 모인 친구들이 설명 없이 정통 마피아 한 판(6~10분)을 끝까지 마치는 것
**Current focus:** Phase 01 — 걷는 뼈대

## Current Position

Phase: 01 (걷는 뼈대) — EXECUTING
Current Plan: 16
Total Plans in Phase: 17
Plan: 16 of 17
Status: Executing Phase 01
Last activity: 2026-10-23 — Phase 01 execution started

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: - min
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 3 min | 3 tasks | 21 files |
| Phase 01 P03 | 3 min | 3 tasks | 11 files |
| Phase 01 P02 | 52 min | 3 tasks | 28 files |
| Phase 01 P15 | 15min | 2 tasks | 4 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: ADR-0001~0004 는 잠김. 서버(방 Durable Object)가 규칙·타이머·판정의 기준이고 다른 사람의 역할은 클라이언트로 보내지 않는다
- [Roadmap]: 기본 재접속(토큰으로 자리·역할 복구)은 v1, 방장 이양·이탈자 정리는 v2. 폰 화면이 잠기면 WebSocket 이 끊기기 때문
- [Roadmap]: 관전, 다시 하기, 사운드 전체, 캐릭터 성격 문구는 v2. v1 탈락자는 공개된 진행만 보고, 결과 화면에서 새 방을 만든다
- [결정 0005]: 비대면 게임. v1 소통은 빠른 메시지·이모티콘(2페이즈 낮 토론, 변론 메시지는 4페이즈), 자유 채팅은 플레이테스트 후. 세로 폰 폭 화면, 링크 공유 참가(QR 제외)
- [결정 0007]: 역할 확인 다음은 낮부터, 매 낮 시작에 직업 공개 단계(말 안 함 가능, 말 바꿈 표시, DAY-02). 로드맵 2 낮 토론 ↔ 3 밤과 아침 교체
- [결정 0008]: 실시간 3D 없이 2.5D(원근 타원 테이블, 그림자·조명 레이어), 5페이즈에서 프레임 PNG 캐릭터
- [Phase 1 논의]: CONN-02 확정(서버 타이머 진행, 기권·행동 없음·말 안 함, 끊긴 사람 흐릿하게). 1페이즈는 "낮이 되었습니다" 화면에서 멈춘다
- [Roadmap]: 1페이즈 성공 기준에 배포 주소에서 폰 2대 이상이 같은 방에 들어가 역할을 받는 것을 넣었다. 정식 출시는 마지막 별도 마일스톤(v2.0)
- [Phase 01]: Worker 이름 minifia + Durable Object exports 선언 (사용자 결정, 결정 0009). compatibility_date 2026-10-12 고정, 패키지는 정확한 버전으로 고정
- [Phase 01]: [01-03] 닉네임 공백 압축은 \p{Zs}+ 만 — \s+ 면 줄바꿈이 통과함. assignRoles 는 중복 ID 도 RangeError
- [Phase 01]: 공개 주소는 Worker minifia + 계정 서브도메인 dhplay = https://minifia.dhplay.workers.dev (01-02)
- [Phase 01]: 방 코드 충돌은 DO createRoom 이 CODE_TAKEN 거부, Worker 가 최대 8번 재시도 후 503 CODE_EXHAUSTED (01-02)
- [Phase 01]: [01-15] 채움 문자 5개는 위치와 무관하게 INVALID_CHARS, ZWJ·변형 선택자·결합 문자는 표시 이름에 남기고 비교 키에서만 제거
- [Phase 01]: 01-16: 실기기(iPhone Safari)에서 시트가 바닥보다 약 60px 위에 멈췄다가 0.2초 뒤 내려옴. 가설(첫 프레임) 일부만 일치, G-01-9 open, dvh/하단 기준선 변화로 재진단 필요

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1] 패키지와 버전은 1페이즈 구현 계획에서 확정한다. 시작 전에 Node.js LTS, Cloudflare 계정, `wrangler` 로그인이 필요하다 (HANDOFF.md 환경 메모)
- [Phase 4] 투표 결과 공개 범위(누가 누구에게 투표했는지 vs 집계만)와 처형된 사람의 역할 공개 시점이 원천에 없다. 현재는 역할을 게임이 끝날 때까지 비공개로 둔다
- [Phase 2] 빠른 메시지 템플릿 목록과 문구, 직업 공개 방식(실시간·동시)·선택지·시간은 논의 단계에서 정한다
- [Phase 5] 캐릭터 수·성격·선택 방식은 미결정이다. v1 은 무작위 배정, 8종 이상. 결정 0008 로 실시간 3D 없이 2.5D, 캐릭터는 프레임 PNG. 일러스트 vs 3D 렌더링과 공개된 캐릭터 에셋 도구는 5페이즈 논의에서 정한다. 참고 자료는 `design/references/character/`
- [v1.1] 사운드는 각자 폰에서 낸다(결정 0005). 무거운 분위기가 소리 없이 약하면 사운드를 앞당긴다. 자유 채팅(COMMX-01)은 플레이테스트 피드백으로 정한다
- [v2.0] 수익화는 출시 전에 따로 정한다
- G-01-9 열림: 01-16 실기기 확인 FAILED. 재진단 필요(1순위 dvh/하단 기준선 변화). 01-16-SUMMARY.md 참조

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-10-23T10:49:09.381Z
Stopped at: 01-16 Task 3 실기기 확인 FAILED, G-01-9 open, 재진단 대기
Resume file: .planning/phases/01-walking-skeleton/01-16-SUMMARY.md
