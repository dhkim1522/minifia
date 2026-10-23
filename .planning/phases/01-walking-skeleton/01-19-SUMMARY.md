---
phase: 01-walking-skeleton
plan: 19
subsystem: ui
tags: [gap-closure, G-01-9, superseded]
status: complete
gap_status: closed
gap_closure: true
gap_ids: [G-01-9]
requirements-completed: [ROLE-02, ROOM-01]
note: "01-18 계측 패널 한 장으로 원인이 확정되어 plan 대로가 아니라 한 줄 수정으로 닫았다(대체됨)"
---

# 01-19 요약: 대체됨

- 01-18 의 `?sheetdebug=1` 패널(사용자 iPhone)에서 `vvH`·`inH`·`dlgB` 는 420 으로 일정했고 `shB` 만 `dlgB` 위로 올라갔다 돌아왔다. 뷰포트 단위 불일치(분기 A)가 아니라 **포커스 이동에 의한 다이얼로그 자동 스크롤**이었다.
- 수정: `.mf-dialog` 에 `overflow: clip` 한 줄(e581bd8). 사용자 폰 확인으로 해결.
- 이 plan(분기별 수정 + 실기기 재확인)은 실행하지 않고 대체한다.
