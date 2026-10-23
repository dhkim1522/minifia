---
schema_version: 1
open_count: 3
waived_count: 0
fixed_count: 0
total_count: 3
last_updated: 2026-10-23T17:46:38.278Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 01 | unrun-verify | test/client/entryContrast.test.tsx |  | 01-17 G-01-1b 눈 확인(폰에서 입력 카드가 비활성처럼 느껴지지 않는지)은 단계 끝 UAT 로 미룸 | open |  | 2026-10-23T10:53:22.098Z |  |
| 2 | 02 | stub | src/screens/DayScene.tsx |  | DayScene 하단 패널 section 이 비어 있다 — 02-08(직업 공개 ClaimPanel)·02-09(낮 토론 MessageLog·DiscussionControls)가 채운다 | open |  | 2026-10-23T17:46:29.875Z |  |
| 3 | 02 | todo | scripts/smoke.mjs | 28 | smoke.mjs 가 종착 단계 day 를 가정한다(PHASE_ORDER·모든 클라이언트 day 확인). 02-01 로 day 단계가 사라져 배포 뒤 낮 루프(dayAnnounce 이후) 기준으로 고쳐야 한다 | open |  | 2026-10-23T17:46:38.278Z |  |

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
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-23T17:46:29.875Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 3,
    "kind": "todo",
    "phase": "02",
    "file": "scripts/smoke.mjs",
    "line": 28,
    "description": "smoke.mjs 가 종착 단계 day 를 가정한다(PHASE_ORDER·모든 클라이언트 day 확인). 02-01 로 day 단계가 사라져 배포 뒤 낮 루프(dayAnnounce 이후) 기준으로 고쳐야 한다",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-23T17:46:38.278Z",
    "resolved_at": null,
    "milestone": "v1.0"
  }
]
````
