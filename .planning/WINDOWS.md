---
schema_version: 1
open_count: 1
waived_count: 0
fixed_count: 0
total_count: 1
last_updated: 2026-10-23T10:53:22.098Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 01 | unrun-verify | test/client/entryContrast.test.tsx |  | 01-17 G-01-1b 눈 확인(폰에서 입력 카드가 비활성처럼 느껴지지 않는지)은 단계 끝 UAT 로 미룸 | open |  | 2026-10-23T10:53:22.098Z |  |

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
  }
]
````
