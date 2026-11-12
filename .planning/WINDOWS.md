---
schema_version: 1
open_count: 4
waived_count: 0
fixed_count: 3
total_count: 7
last_updated: 2026-11-12T15:35:35.300Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 01 | unrun-verify | test/client/entryContrast.test.tsx |  | 01-17 G-01-1b 눈 확인(폰에서 입력 카드가 비활성처럼 느껴지지 않는지)은 단계 끝 UAT 로 미룸 | open |  | 2026-10-23T10:53:22.098Z |  |
| 2 | 02 | stub | src/screens/DayScene.tsx |  | DayScene 하단 패널 section 이 비어 있다 — 02-08(직업 공개 ClaimPanel)·02-09(낮 토론 MessageLog·DiscussionControls)가 채운다 | fixed |  | 2026-10-23T17:46:29.875Z | 2026-10-23T18:52:20.198Z |
| 3 | 02 | todo | scripts/smoke.mjs | 28 | smoke.mjs 가 종착 단계 day 를 가정한다(PHASE_ORDER·모든 클라이언트 day 확인). 02-01 로 day 단계가 사라져 배포 뒤 낮 루프(dayAnnounce 이후) 기준으로 고쳐야 한다 | fixed |  | 2026-10-23T17:46:38.278Z | 2026-10-23T18:52:19.977Z |
| 4 | 03.1 | deviation | scripts/smoke.mjs |  | 로컬 개발 서버(no-cache)에서는 스모크 마지막 에셋 캐시 헤더 단언이 실패한다 — 배포본에서만 통과(기존 한계, 03.1-14 가 배포본으로 확인) | open |  | 2026-10-25T07:46:32.367Z |  |
| 5 | 07 | todo | scripts/smoke.mjs |  | 07-11 이 say·옛 chat 프레임을 지워 smoke/bots/uat 스크립트가 옛 와이어를 쓴다 (deferred-items.md) | open |  | 2026-11-01T14:21:55.348Z |  |
| 6 | 09 | skipped-test | test/client/nightMap.test.tsx |  | 8페이즈 밤 임시 틀(지도 이름표로 경찰·의사 대상 선택) 시험 6건 skip — 밤 시민 편 장면 표가 내 좌석뿐이라 성립 안 함, 09-15 가 얼굴 목록으로 바꿔 씀 | fixed |  | 2026-11-03T05:05:44.565Z | 2026-11-03T05:50:49.979Z |
| 7 | 19 | deviation | scripts/e2e/lib.mjs |  | 19-06: 360x560 방장 대기실에서 두 열로 접힌 방장 줄의 둘째 열 단추와 위 알림(1.5초, 눌림 통과)이 겹친다 — E2E HR3 은 알려진 한계로 두고 판정하지 않는다(HOST_RAIL_KNOWN_LIMITS fold-toast). 고칠지는 사용자 확인 필요 | open |  | 2026-11-12T15:35:35.300Z |  |

````json
[
  {
    "id": 1,
    "kind": "unrun-verify",
    "phase": "01",
    "file": "test/client/entryContrast.test.tsx",
    "line": null,
    "description": "01-17 G-01-1b 눈 확인(폰에서 입력 카드가 비활성처럼 느껴지지 않는지)은 단계 끝 UAT 로 미룸",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-23T10:53:22.098Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 2,
    "kind": "stub",
    "phase": "02",
    "file": "src/screens/DayScene.tsx",
    "line": null,
    "description": "DayScene 하단 패널 section 이 비어 있다 — 02-08(직업 공개 ClaimPanel)·02-09(낮 토론 MessageLog·DiscussionControls)가 채운다",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-23T17:46:29.875Z",
    "resolved_at": "2026-10-23T18:52:20.198Z",
    "milestone": "v1.0"
  },
  {
    "id": 3,
    "kind": "todo",
    "phase": "02",
    "file": "scripts/smoke.mjs",
    "line": 28,
    "description": "smoke.mjs 가 종착 단계 day 를 가정한다(PHASE_ORDER·모든 클라이언트 day 확인). 02-01 로 day 단계가 사라져 배포 뒤 낮 루프(dayAnnounce 이후) 기준으로 고쳐야 한다",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-23T17:46:38.278Z",
    "resolved_at": "2026-10-23T18:52:19.977Z",
    "milestone": "v1.0"
  },
  {
    "id": 4,
    "kind": "deviation",
    "phase": "03.1",
    "file": "scripts/smoke.mjs",
    "line": null,
    "description": "로컬 개발 서버(no-cache)에서는 스모크 마지막 에셋 캐시 헤더 단언이 실패한다 — 배포본에서만 통과(기존 한계, 03.1-14 가 배포본으로 확인)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-25T07:46:32.367Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 5,
    "kind": "todo",
    "phase": "07",
    "file": "scripts/smoke.mjs",
    "line": null,
    "description": "07-11 이 say·옛 chat 프레임을 지워 smoke/bots/uat 스크립트가 옛 와이어를 쓴다 (deferred-items.md)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-01T14:21:55.348Z",
    "resolved_at": null,
    "milestone": "v2.0"
  },
  {
    "id": 6,
    "kind": "skipped-test",
    "phase": "09",
    "file": "test/client/nightMap.test.tsx",
    "line": null,
    "description": "8페이즈 밤 임시 틀(지도 이름표로 경찰·의사 대상 선택) 시험 6건 skip — 밤 시민 편 장면 표가 내 좌석뿐이라 성립 안 함, 09-15 가 얼굴 목록으로 바꿔 씀",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-11-03T05:05:44.565Z",
    "resolved_at": "2026-11-03T05:50:49.979Z",
    "milestone": "v2.0"
  },
  {
    "id": 7,
    "kind": "deviation",
    "phase": "19",
    "file": "scripts/e2e/lib.mjs",
    "line": null,
    "description": "19-06: 360x560 방장 대기실에서 두 열로 접힌 방장 줄의 둘째 열 단추와 위 알림(1.5초, 눌림 통과)이 겹친다 — E2E HR3 은 알려진 한계로 두고 판정하지 않는다(HOST_RAIL_KNOWN_LIMITS fold-toast). 고칠지는 사용자 확인 필요",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-12T15:35:35.300Z",
    "resolved_at": null,
    "milestone": "v3.0"
  }
]
````
