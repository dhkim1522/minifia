---
phase: 02-day-discussion
plan: 10
subsystem: client-ui
tags: [quick-message, emoji-tray, sheet, chips, tdd, client]
status: complete

requires:
  - phase: 02-day-discussion
    provides: 02-03 의 isAlive·QUICK_TEMPLATES(chat.ts), 02-06 의 messageText·TEMPLATE_ORDER·TEMPLATE_CHIP·EMOJI_TEXT, 02-07 의 Chip·Icon 이모티콘 여덟 이름
provides:
  - QuickMessageSheet — 문구 → 대상 → (직업) → 보내기 시트, SayPayload 타입
  - EmojiTraySheet — 이모티콘 4×2 트레이(한 번 누르면 바로 전송, 열린 채 유지)
  - talk.css — 두 시트의 라벨·미리보기 알약·트레이 격자
affects: [02-09, 02-11]

tech-stack:
  added: []
  patterns:
    - "시트의 고른 값은 부품 지역 상태 — Sheet 가 닫히며 언마운트되면 버려진다(재오픈 시 첫 칩 재선택)"
    - "필요한 칸은 QUICK_TEMPLATES 표를 그대로 읽는다 — 칸 규칙을 화면에 다시 적지 않는다"
    - "payload 는 필요한 키만 담은 리터럴 — 입력 객체를 펼치지 않는다"
    - "쿨다운 시계는 부모가 쥐고 트레이는 coolingDown prop 으로만 받는다(타이머 없음)"

key-files:
  created:
    - src/components/QuickMessageSheet.tsx
    - src/components/EmojiTraySheet.tsx
    - src/styles/talk.css
    - test/client/quickMessageSheet.test.tsx
    - test/client/emojiTraySheet.test.tsx
  modified: []

key-decisions:
  - "문구를 바꾸면 필요 없는 칸(대상·직업)만 버리고 필요한 칸에 이미 고른 값은 유지한다(계획 가정대로) — 누르기 횟수가 늘지 않는다"
  - "미리보기의 흐림은 알약 면이 아니라 안쪽 글자 span(.mf-qm__text)에만 opacity .6 을 준다 — UI-SPEC 의 '글자 불투명도 .6' 을 그대로 지킨다"
  - "닫는 중(closing)에도 [보내기]를 끈다 — 닫히는 240ms 동안 두 번 보내지 않게 한다"
  - "CSS 규칙 테스트는 ?raw 대신 readFileSync 로 읽는다(vitest 가 CSS 를 처리하지 않아 ?raw 가 빈 문자열)"

requirements-completed: [COMM-01, COMM-02]

actuals:
  tokens: 6670
  tasks: 2
  commits: 4
plan_head_before: 69776a7e1dad927ea64692145991ddd422d26c3b
plan_head_after: ccb79d9dd217cf9bf425130a5a7e6e7a5e10dad3
commits: 4

coverage:
  - id: G1
    description: "빠른 메시지 시트가 문구 칩 다섯 개(첫 칩 선택·해제 불가)와 나를 뺀 생존자 대상 칩(seat 순, 끊긴 사람 포함, 4명판 3·8명판 7)을 보이고, '저 아니에요' 는 대상 줄이 사라지며, '[○○]는 [직업]이었어요' 는 이번 판 직업 칩을 대상 아래에 보인다"
    requirement: "COMM-01"
    verification:
      - kind: unit
        ref: "test/client/quickMessageSheet.test.tsx#QuickMessageSheet"
        status: pass
    human_judgment: false
  - id: G2
    description: "미리보기가 빈칸을 글자 그대로 흐리게 보이고, [보내기] 는 필요한 칸이 모두 차고 canSend 일 때만 켜지며, 누르면 필요한 키만 담은 {template,target?,claimedRole?} 를 보내고 시트가 닫힌다. 누르기 횟수 suspect 2·trust 3·innocent 2·claimed 4. 닫고 다시 열면 고른 내용이 없다. 입력칸이 없다"
    requirement: "COMM-01"
    verification:
      - kind: unit
        ref: "test/client/quickMessageSheet.test.tsx#QuickMessageSheet"
        status: pass
    human_judgment: false
  - id: G3
    description: "이모티콘 트레이가 4열 × 2행 칸(EMOJI_IDS 순서·칸 글자·읽기 이름 '크게 웃음')과 '2초에 한 번 보낼 수 있어요' 를 보이고, 칸을 누르면 그 ID 를 바로 보내며 닫히지 않고, 쿨다운·끊김 동안 여덟 칸이 모두 꺼진다"
    requirement: "COMM-02"
    verification:
      - kind: unit
        ref: "test/client/emojiTraySheet.test.tsx#EmojiTraySheet"
        status: pass
    human_judgment: false
  - id: G4
    description: "실기기 폰 세로 화면에서 시트가 한 화면에 들어오고(8명판 대상 칩 줄바꿈·닉네임 8자·미리보기 알약이 시트 폭까지) 설계서 그림(06_B6_Day.png S-08)과 같은 모양으로 보이는지"
    requirement: "COMM-01"
    verification: []
    human_judgment: true
    rationale: "시각 배치(줄바꿈 높이·알약 폭·칸 모양)는 happy-dom 테스트가 단정하지 못한다. 02-09 가 낮 화면에 붙인 뒤 배포본에서 확인한다"
---

# Phase 2 Plan 10: 빠른 메시지 시트·이모티콘 트레이 Summary

**Sheet 틀 위에 문구 → 대상 → (직업) → 보내기 칩 시트와 4×2 이모티콘 트레이를 소켓을 모르는 독립 부품으로 만들어, 보낼 값(템플릿 ID·seat·직업·아이콘 ID)만 부모 콜백으로 넘긴다.**

## 성과

- **QuickMessageSheet**: 첫 문구("[○○] 의심돼요")가 미리 선택되고 해제되지 않는다. 대상 칩은 `isAlive` 로 거른 나를 뺀 사람들을 seat 오름차순으로 보인다(끊긴 사람 포함). 필요한 칸은 `QUICK_TEMPLATES` 를 그대로 읽어 정하고, 미리보기는 `messageText` 로 만든다(빈칸이면 글자 흐림). [보내기]는 필요한 칸이 모두 차고 `canSend` 이며 닫히는 중이 아닐 때만 켜진다. 누르면 필요한 키만 담은 payload 를 `onSend` 로 보내고 시트를 닫는다.
- **EmojiTraySheet**: `EMOJI_IDS` 순서 8칸(위 아이콘 22px, 아래 칸 글자, aria-label 은 화면 읽기 이름). 누르면 `onSend(icon)` 만 부르고 닫지 않는다. `canSend` false 또는 `coolingDown` 이면 8칸 모두 꺼진다. 타이머 없음.
- **talk.css**: 라벨·미리보기 알약(`max-width: none`)·흐린 글자(.6)·4열 격자·칸 스타일. tokens.css 변수만 사용.
- 누르기 횟수(D-17)를 테스트로 고정: suspect 2번, trust 3번, innocent 2번, claimed 4번.
- 입력칸 금지(T-02-27)는 DOM 검사와 소스 grep 두 곳에서 지킨다.

## 태스크 커밋

| 태스크 | 커밋 | 내용 |
| --- | --- | --- |
| 1 RED | 78cb898 | test(02-10): QuickMessageSheet 실패 테스트 |
| 1 GREEN | 26df4a2 | feat(02-10): QuickMessageSheet + talk.css |
| 2 RED | f7d8c79 | test(02-10): EmojiTraySheet 실패 테스트 |
| 2 GREEN | ccb79d9 | feat(02-10): EmojiTraySheet |

트레이서(태스크 1) 검증: `npx vitest run test/client/quickMessageSheet.test.tsx` 통과를 확인한 뒤 확장(태스크 2)으로 넘어갔다(⚡ Tracer verified end-to-end — expanding).

## 검증

- `npx vitest run test/client/quickMessageSheet.test.tsx test/client/emojiTraySheet.test.tsx` — 27 통과
- `npm run typecheck` — 통과
- `npx vitest run --project client` — 19 파일 422 테스트 통과
- 태스크 acceptance_criteria 모두 PASS(파일·문구·`QUICK_TEMPLATES`/`isAlive(`/`messageText(` grep, 입력칸 없음, `repeat(4`, `test(02-10)` 커밋 존재)

## Deviations from Plan

None - plan executed exactly as written.

(테스트 파일이 CSS 를 읽는 방식만 `?raw` 대신 `readFileSync` 로 정했다 — 기존 `sheet.test.tsx` 가 같은 이유로 쓰는 방식이며 계획 범위 안의 구현 선택이다.)

## Known Stubs

없음. 이모티콘 아이콘 그림은 02-07 의 Icon 이 가진 임시 형태 시안(D-16, 캐릭터 톤에 맞춰 나중에 교체)이며 이 계획이 만든 스텁이 아니다.

## Threat Flags

없음. 새 네트워크 경로·인증·스키마 경계 없음. T-02-27(입력칸 없음·필요한 키만 담은 payload)은 완화 완료, T-02-28(공개 정보만 사용)·T-02-SC(새 패키지 없음) 해당 사항 없음.

## 다음 단계

- 02-09 의 DiscussionControls 가 열림 상태·합산 쿨다운(`coolingDown`)·전송(`send({t:"say", ...payload})`, `send({t:"emoji", icon})`)을 쥐고 두 시트를 붙인다. `roles` 는 `view.day.roles`, `canSend` 는 연결 상태에서 받는다.
- 02-11 에서 배포본 실기기 확인(coverage G4).

## Self-Check: PASSED

- FOUND: src/components/QuickMessageSheet.tsx, src/components/EmojiTraySheet.tsx, src/styles/talk.css, test/client/quickMessageSheet.test.tsx, test/client/emojiTraySheet.test.tsx
- FOUND commits: 78cb898, 26df4a2, f7d8c79, ccb79d9 (git rev-list 69776a7..HEAD = 4)
