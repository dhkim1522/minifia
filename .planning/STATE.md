---
gsd_state_version: "1.0"
milestone: v1.0
milestone_name: MVP
current_phase: 02
current_phase_name: 낮 토론
current_plan: 11
status: verifying
stopped_at: Completed 02-11-PLAN.md
last_updated: "2026-10-23T18:52:10.149Z"
last_activity: 2026-10-24
last_activity_desc: Phase 02 execution started
state_head: fab84a02066f966d5dbc2dd16f1dce0c33d39ddb
progress:
  total_phases: 6
  completed_phases: 1
  total_plans: 30
  completed_plans: 30
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-21)

**Core value:** 링크 하나로 모인 친구들이 설명 없이 정통 마피아 한 판(6~10분)을 끝까지 마치는 것
**Current focus:** Phase 02 — 낮 토론

## Current Position

Phase: 02 (낮 토론) — EXECUTING
Current Plan: 11
Total Plans in Phase: 11
Plan: 11 of 11
Status: Phase complete — ready for verification
Last activity: 2026-10-24 — Phase 02 execution started

Progress: [██░░░░░░░░] 17%

## Performance Metrics

**Velocity:**
- Total plans completed: 19
- Average duration: - min
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 19 | - | - |

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
| Phase 01 P17 | 8 min | 2 tasks | 3 files |
| Phase 02 P01 | 7 min | 3 tasks | 17 files |
| Phase 02 P02 | 5 min | 2 tasks | 4 files |
| Phase 02 P03 | 7min | 3 tasks | 5 files |
| Phase 02 P06 | 3 min | 3 tasks | 8 files |
| Phase 02 P07 | 6 min | 3 tasks | 9 files |
| Phase 02 P04 | 8 min | 3 tasks | 4 files |
| Phase 02 P08 | 6min | 2 tasks | 5 files |
| Phase 02 P10 | 4 min | 2 tasks | 5 files |
| Phase 02 P05 | 5 min | 3 tasks | 4 files |
| Phase 02 P09 | 9 min | 3 tasks | 6 files |
| Phase 02 P11 | 15 min | 2 tasks | 4 files |

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
- [Phase 01]: 01-17: 입력 화면 힌트는 gray-100 이 아니라 gray-300 불투명도 1 로 둔다(입력된 글자와 구분 유지). 구분선 선은 gray-500, 꺼진 버튼은 공통 불투명도 0.6
- [Phase 01]: 01-17: CSS 값 테스트는 ?raw 대신 readFileSync 로 읽는다(vitest 가 CSS 를 처리해 빈 문자열이 됨)
- [Phase 02]: [02-01] claimReveal 을 2초짜리 별도 서버 단계로 분리하고 discussion.next 를 dayAnnounce 로 둔 임시 낮 루프(D-19) — 3페이즈가 밤으로 바꾼다 — 모든 폰이 같은 마감으로 공개 연출을 시작·종료한다. 단계 진입 전이는 tick 루프 안의 ON_ENTER 훅 표에 둔다
- [Phase 02]: 하루 걸러 말 바꿈은 표시하지 않는다(어제 R, 오늘 none, 내일 R' 는 처음 주장으로 본다). claimLast 가 매일 공개 값으로 덮이는 D-08 권장안의 직접 결과이며 결정 0016(02-11)에 기록한다.
- [Phase 02]: 02-03: 쿨다운·형식 위반 거부는 상태 불변(A1), 연장 중복 ALREADY_EXTENDED(A2), 이 페이즈 탈락자 거부는 BAD_MESSAGE(A4) — 3페이즈가 확정
- [Phase 02]: 02-03: skipDiscussion 은 별도 전이 코드 없이 tick 재호출로 진입 훅을 탄다; 마감이 바뀌는 extend·skip 뒤 알람 재설정은 DO(02-05)의 몫
- [Phase 02]: 02-06: discussion 이 아닌 동안 도착한 emoji 이벤트는 SeatFloat 에 넣지 않고, discussion 을 벗어나면 본 seq 를 -1 로 되돌려 다음 토론은 3초 안 줄만 복원한다
- [Phase 02]: 02-07: 공개된 주장의 props 이름은 job — Table 에 역할 키 없음(grep 게이트·타입 테스트)
- [Phase 02]: 02-07: 머리 위 층 가로 위치는 --mf-float-left 변수(clamp)로 전달 — happy-dom 이 인라인 clamp() 를 버림
- [Phase 02]: 02-07: 축소 모션에서는 mf-float-vanish(수명−지난 시간 지연 뒤 순간 전환)로 말풍선 수명을 유지
- [Phase 02]: 02-04: claim 단계 뷰는 claimDone·본인 me.claim 만 — 남의 선택·claimLast 는 어떤 키로도 싣지 않음(A7). me.claim 은 claim 단계에서만, 어제 말 안 함이면 none — D-01 서버 쪽 마지막 관문. 키 자체를 만들지 않아 화면 은닉에 기대지 않는다
- [Phase 02]: 02-04: 누출 검사는 역할·주장 값 문자열의 경로를 허용 목록(me.role, me.claim, day.roles[], day.claims[].claim, day.messages[].claimedRole)과 대조하는 방식으로 교체. normalizeStoredRoom 은 저장 phase 가 day 일 때만 dayAnnounce 로 정규화(호출은 02-05) — 개수 세기는 합법적 공개 값에 깨지고, 느슨하게 만들면 진짜 누출을 못 잡는다(Pitfall 2)
- [Phase 02]: 02-08: 직업 공개 칩 목록은 view.day.roles + 말 안 함, 낙관적 선택은 view 객체가 바뀌면 버리고 서버 값을 따른다 — 클라이언트에 직업 목록을 따로 두지 않고(D-07) 서버 거절 시 state 재전송으로 화면이 서버 값에 맞춰진다(T-02-26)
- [Phase 02]: 02-08: 공개 연출 시작은 이전 단계를 렌더 중 상태 조정(useState)으로 기억해 claim -> claimReveal 에서만 켠다 — 재접속은 알약만 보이고, 효과 없이 첫 커밋부터 말풍선이 보인다
- [Phase 02]: 02-10: 문구를 바꾸면 필요 없는 칸만 버리고 필요한 칸의 기존 선택은 유지한다 — 누르기 횟수가 늘지 않는다
- [Phase 02]: 02-10: 미리보기 흐림은 알약 면이 아니라 안쪽 글자 span 에만 opacity .6 을 준다(UI-SPEC 글자 불투명도)
- [Phase 02]: 02-05: 생성자는 normalizeStoredRoom 이 방을 실제로 바꿨을 때만 저장 + setAlarm(nextWakeAt) — 평소 대기 중 알람을 덮지 않는 규칙 유지
- [Phase 02]: 02-05: 거절 응답 규칙 — claim·extend·skip 거절과 WRONG_PHASE say 는 error+state, RATE_LIMITED·BAD_MESSAGE 와 이모티콘 거절은 error 만
- [Phase 02]: 쿨다운은 보낸 순간 로컬 시각 + 2000ms 단순안(서버 시각 전환은 6페이즈 실기기 오탐을 본 뒤 결정 0016 에 기록)
- [Phase 02]: send 가 false(끊김)면 쿨다운·넘기기 잠금을 걸지 않는다
- [Phase 02]: 낮 토론에서 polite live 영역이 늘어(MessageLog·이모티콘 live 줄) phaseScreens 안내 영역 선택자를 .mf-room 직계 자식으로 좁힘
- [Phase 02]: 02-11: 스모크 순서 검사는 허용 전이 표(PHASE_NEXT)로, 마감 전 누출 검사는 값 문자열 경로(view.me.role·view.me.claim·view.day.roles[])로 한다. 구조 결정 7가지는 결정 0016 에 기록

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

Last session: 2026-10-23T18:52:10.021Z
Stopped at: Completed 02-11-PLAN.md
Resume file: None
