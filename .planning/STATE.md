---
gsd_state_version: "1.0"
milestone: v2.0
milestone_name: 같은 공간
status: planning
last_updated: "2026-10-30T09:12:09.000Z"
last_activity: 2026-10-30
progress:
  total_phases: 7
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-30)

**Core value:** 링크 하나로 모인 친구들이 설명 없이 정통 마피아 한 판(6~10분)을 끝까지 마치는 것
**Current focus:** v2.0 같은 공간 — 6페이즈(월드 뼈대) 계획 전. 먼저 메인 세션에서 v2.0 디자인을 캔버스로 승인받는다

## Current Position

Phase: 6 of 12 (월드 뼈대) — v2.0 은 6~12페이즈 7개
Plan: —
Status: 로드맵 완료. 디자인 승인(캔버스) 후 `/gsd-ui-phase 6` → `/gsd-plan-phase 6 --research-phase`
Last activity: 2026-10-30 — v2.0 로드맵 생성 (페이즈 6~12, 요구사항 44/44 매핑)

Progress: [░░░░░░░░░░] 0% (0/7 phases)

## Performance Metrics

**Velocity (v2.0):**
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

*Updated after each plan completion. v1.0 지표(107 plans)는 MILESTONES.md 와 git 기록에 있다*

## Accumulated Context

### Decisions

v1.0 의 결정 로그는 `docs/decisions/0001~0043` 과 `.planning/milestones/v1.0-phases/*/*-SUMMARY.md` 에 있다(이 목록은 v1.0 마감 때 비웠다, git 기록 보존). v2.0 범위는 결정 0044(1~24항).

- [Roadmap v2.0]: 7개 페이즈 6~12 — 월드 뼈대 → 자유 채팅 → 낮 처형과 유령 → 밤과 아침 → 캐릭터·동작·의상 → 결과 공개와 다시 하기 → 소리와 마무리. 자리표시 그림으로 한 판을 먼저 완주시키고 꾸밈 층(실제 아트·소리·시상)을 뒤에 얹는다
- [Roadmap v2.0]: 유령(GHOST)을 낮 처형 페이즈에 묶었다 — 고정 테이블 삭제로 v1.0 관전 화면이 사라져 첫 처형부터 죽은 사람이 지켜볼 곳이 필요하다
- [Roadmap v2.0]: 6페이즈에 렌더 성능 게이트(실기기 5분 평균 55fps 이상)를 둔다. 미달이면 그림자·광원·건물 예산을 줄이고, 그래도 모자라면 맵을 미리 구운 이미지로(결정 0046)
- [Roadmap v2.0]: 9페이즈에서 한 판이 맵 위(낮 + 밤)에서 처음 끝까지 돌고 팀 테스트로 재미 가설을 확인한 뒤 10페이즈 이후 투자를 이어 간다

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

Last session: 2026-10-30
Stopped at: v2.0 로드맵 작성 완료 (ROADMAP.md, STATE.md, REQUIREMENTS.md 추적표)
Resume file: None

## Operator Next Steps

- 메인 세션에서 v2.0 디자인(디자인 시스템·화면설계서·맵·캐릭터 리그/의상/동작)을 캔버스로 만들어 승인받고, 승인본 사본을 `design/` 에 둔다 (GSD 페이즈 아님)
- 6페이즈: `/gsd-ui-phase 6` → `/gsd-plan-phase 6 --research-phase` (연구 필수)
