# Phase 7 — UI Review

**Audited:** 2026-11-02
**Baseline:** 07-UI-SPEC.md (승인 2026-11-01)
**Screenshots:** 새로 찍지 않음(개발 서버 없음, 코드 감사). 기존 측정 캡처 `perf/chatload-prod-390x844-x4-dpr2.png`(배포본 로비 390×844) 한 장만 눈으로 확인했다.
**Interaction captures:** off (workflow.ui_interaction_capture 가 false)
**iPhone 실기기:** 07-DEVICE-CHECKS.md 표 A·B 의 자동 항목만 근거로 썼고, 표 C·D 사람 확인(검사 1~7·IME)은 전부 대기이며 통과로 세지 않았다.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | 계약 문구가 `chatText.ts` 한 곳에 그대로 있다. 역할 단어는 채널 분기 안에서만 나온다 |
| 2. Visuals | 3/4 | 아이콘 중심·입력 중 알약·채널 아이콘은 계약대로다. 캡처상 이름표끼리 겹침과 알약 미확인 |
| 3. Color | 3/4 | 토큰만 쓴다. 입력칸 placeholder 색 규칙이 없다 |
| 4. Typography | 4/4 | 16/14px, 굵기 400 만, 입력칸 16px 지킴 |
| 5. Spacing | 3/4 | 승인 예외값 외 이탈 없음. 채널 아이콘 padding 40 은 보드 대조 미확인, 알려진 한계 3개 폰 |
| 6. Experience Design | 3/4 | 상태 커버리지는 넓다. 실기기 검사 1~7·IME 가 전부 미확인이라 4점을 줄 수 없다 |

**Overall: 20/24**

---

## Top 3 Priority Fixes

1. **입력칸 placeholder 색이 계약(`gray-300`)대로 정해지지 않았다** (WARNING) — "마피아끼리만 보여요"·"유령끼리만 보여요"가 브라우저 기본 색으로 `night-900` 면 위에 나와 대비가 보장되지 않는다. 마피아·탈락자가 입력칸을 처음 볼 때 채널을 알려 주는 유일한 글인데 흐릴 수 있다 — `src/styles/v2.css` 에 `.mv-chat__input::placeholder { color: var(--gray-300); opacity: 1; }` 를 더한다(`ds.css:46` 의 `.mf-field__input` 규칙과 같은 값).
2. **iPhone 16 Pro 실기기 합격 검사 1~7 + 한글 IME 가 전부 미확인이다** (WARNING, 합격 선언 차단) — 키보드가 입력줄을 가리거나 조합 중 Enter 가 깨지는지는 가상 키보드 주입으로 확인할 수 없다. 자동 E2E(`chat-keyboard`·`chat-ime`)는 초록이지만 계약상 사람 확인 몫이다 — `/gsd-verify-work 7` 에서 07-DEVICE-CHECKS.md 표 C 를 사용자가 채운다. 카카오톡·Android 행은 이월 여부를 사용자에게 묻는다.
3. **캡처에서 이름표끼리 겹치고 입력 중 알약은 보이지 않는다** (WARNING) — 위 로비 캡처(봇 7명이 2초마다 입력 중을 보내는 부하 상태)에서 "측정봇나" 이름표가 내 캐릭터 머리 위에 걸리고, 입력 중 알약은 한 개도 안 보였다. 순간 캡처일 수 있어 결함으로 단정하지 않는다 — 입력 중 켜짐 직후 상태를 로비·테이블에서 눈으로 확인하고, 겹침이 이름표 순위 규칙(6페이즈) 밖이면 고친다.

그 밖의 개선(우선순위 낮음)
4. 보내기 버튼이 비활성이어도 `type="submit"` 이라 포커스를 받고 누를 수 있다. `send()` 안에서 빈 값을 걸러 동작은 맞다. 다만 `sendDisabled`(연결 끊김) 때 누르면 아무 반응·알림이 없다 — 계약("보내기만 비활성, 새 문구 없음")과 같으니 결함은 아니고 사람 확인에서 어색한지만 본다.
5. 로비·테이블 모두 100줄 한 흐름이고 새 메시지 점은 `quiet` 일 때 꺼진다. 위로 읽다 복원된 줄이 와도 점이 안 뜨는 것은 계약대로다. 단 `.mv-chat__newdot i` 맥박이 reduced-motion 에서 꺼지는 것(v2.css:98-100)은 확인했다.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)
- `src/game/chatText.ts` 의 문구가 UI-SPEC Copywriting Contract 와 한 글자씩 일치한다: 입력 접근성 이름 3종, placeholder 2종, 막힘 5종("조금 천천히 보내요"·"같은 말은 잠시 뒤에 보내요"·"100자까지 보낼 수 있어요"·"지금은 보낼 수 없어요"·"보내지 못했어요. 다시 해 보세요"), 채널 시작 2종, 입장·퇴장.
- 보내기는 아이콘만(`ChatPanel.tsx` `V2Icon name="send"` + `aria-label`), 빈 상태 글 없음 — 결정 0051 을 지켰다.
- 마피아·유령 문구는 `channelUi()` 분기 안에서만 읽힌다(`ChatPanel.tsx`). 시민 편 DOM 누설 경로가 코드상 없다.
- 지울 것으로 정한 `QuickMessageSheet`·`EmojiTraySheet`·`ClaimPanel`·`TurnPanel`·`DefenseChips`·`DiscussionControls`·`MessageLog`·`ChatHistorySheet`, `seatFloats.ts`·`claimLines.ts`·`messageText.ts` 는 파일이 없다. 남은 언급은 `useViewChoice.ts`·`ExecVotePanel.tsx`·`TestTools.tsx` 의 주석(옛 이름 인용)뿐이라 죽은 코드가 아니다.
- 사소한 점: UI-SPEC 체커가 지적한 "지금은 보낼 수 없어요"에 다음 할 일이 없는 것은 그대로 남아 있다(수용된 FLAG).

### Pillar 2: Visuals (3/4)
- 구조가 계약대로다: 기록 칸 `night-900` 면(`.mv-chat__log` radius-badge, 안쪽 `8 12`, 줄 간격 4) → 입력줄 48 → (로비) 행동 줄. 캡처에서 기록 5줄·입력줄·보내기(비활성 `night-700`)·[시작] 활성 면이 확인된다. 시선은 [시작] 흰 면과 맵 캐릭터로 나뉘고 채팅 패널은 조용하다.
- 아이콘: 채널 아이콘은 입력칸 안 왼쪽 20px(`.mv-chat__chan`, `pointer-events: none`), 유령 기록의 `roleMafia`/`ghost` 14px 표식과 진홍 이름이 색 외 단서를 함께 준다(`ChatPanel.tsx` `mark`). 이모지 없음.
- 결함 후보: 캡처에서 이름표 "측정봇나"가 내 캐릭터 머리 위로 올라와 서로 겹치고 입력 중 알약이 없다(Top 3 의 3번). 이름표 순위 규칙 범위인지 확인이 필요하다.
- 기록 칸 맨 위 줄이 잘려 보이는 것은 고정 높이 96 안에서 스크롤되는 의도된 모양이다.
- 시안이 아닌 실제 입력 중 알약·새 메시지 점은 이번 감사에서 눈으로 본 적이 없다(캡처 없음).

### Pillar 3: Color (3/4)
- `v2.css` 채팅·입력 중 규칙은 hex·rgb 를 쓰지 않고 토큰만 쓴다(`--night-900/700/600`, `--gray-50/100/300/500`, `--crimson-300`). 진홍은 마피아 이름·마피아 채널 아이콘·막힘 알림 문장에만 있고 진홍 면은 없다. Accent(gray-100)는 보내기 활성·입력 중 알약·새 메시지 점·포커스 링에만 쓰였다.
- **WARNING**: `.mv-chat__input` 에 `::placeholder` 규칙이 없다(`grep` 결과 `ds.css:46` 의 `.mf-field__input` 뿐). 계약은 `gray-300`. 기본 placeholder 색은 브라우저마다 달라 어두운 면 위 대비가 보장되지 않는다.
- 막힘 알림 `crimson-300` 14px 은 `night-900` 위 5.5:1 로 계약에 적혀 있고 코드가 그 값을 쓴다.

### Pillar 4: Typography (4/4)
- 크기: 채팅 본문·이름·입력 16px, 시스템·막힘 14px 만 쓴다(`v2.css:64,69,73,86`). 굵기는 `.mv-chat__name` 을 `font-weight: 400` 으로 명시했다.
- `word-break: keep-all` + `overflow-wrap: anywhere` 가 줄·알림에 적용됐다. 입력칸 16px 로 iOS 확대를 막았다.

### Pillar 5: Spacing (3/4)
- `.mv-chat` 은 `--space-sm`(8) 간격, 기록 칸 `--space-xs`(4) 줄 간격, 입력칸 `--control-input`(48), 새 메시지 점 `--tap-min`(44) 로 계약 값 그대로다. 예외 12·6·4·40 은 승인 보드·계약에 적힌 값이다.
- 패널 높이는 `day.css:25,30` 이 `--mf-chat-panel-h`(`chatUi.tablePanelHeight`)로 넣고 키보드 열림 150·아래 여백 8·`bottom: var(--mf-kb-lift)` 로 계약식(14+72+8+48+8)과 맞는다. 로비 패널 로직은 `Lobby.tsx`/`WorldStage.tsx` 쪽이고 이번에는 읽지 않았다.
- 감점 이유: 채널 아이콘 있을 때 입력 왼쪽 padding 40 은 체커가 "새 값, 구현 때 보드와 대조"로 남긴 항목인데 대조 기록이 없다. 또 키보드가 열린 360×640·390×664·360×560 에서 내 이름표가 잘리는 것은 계약이 "알려진 한계"로 받아들인 것으로 새 결함으로 세지 않았다. 다만 위 세 폰에서 이 상태가 실제로 어떻게 보이는지는 실기기에서 확인되지 않았다.

### Pillar 6: Experience Design (3/4)
- 상태 커버리지(코드 근거): 빈 입력·공백만 비활성(`sendOff`), 쿨다운 흐림(`sendDim`), 연결 끊김 `sendDisabled`, 막힘 알림 `role="status"` + 바닥 스크롤(`notice` 효과), 위로 읽는 중 새 메시지 점(`atBottomRef`·`newDot`, 24px 여유), 100줄 한 흐름, Esc 는 blur 만, `role="log"` `aria-live="polite"`.
- IME: `<form onSubmit>` 한 길, 조합 중 제출은 `compositionend` 까지 `IME_WAIT_MS` 대기, 중복 제출·꼬리 글자 방어(`DUP_SUBMIT_MS`·`TAIL_WINDOW_MS`)가 있다. 보내기 `onMouseDown` preventDefault 와 `focus({ preventScroll: true })` 로 키보드가 닫히지 않는다(07-19).
- 자동 확인 결과(07-DEVICE-CHECKS 표 A·B, 배포본): E2E chat-lobby 6종 23/23, chat-table 6종 33/33, chat-ime 10/10, chat-keyboard 6종 22~23/22~23, smoke full 통과, 채팅 부하 5분 평균 60.00fps·끊김 0(조건 B, 데스크톱 Chrome CPU 4×). 이는 가상 키보드 주입과 데스크톱 측정이며 실기기를 대신하지 않는다(결정 0055).
- **감점 사유(WARNING)**: 계약이 합격 선언에 필수로 정한 iPhone 16 Pro Safari·iOS용 Chrome 검사 1~7 과 IME, 5분 체감 fps 가 모두 "대기"다. Android·삼성 인터넷·카카오톡 인앱도 미확인이라 9페이즈 이월 후보다. 이 감사에서는 어느 것도 통과로 세지 않았다.
- D1 한계(처형 여부 투표·후보 선택·아침에 입력 없음)와 테이블 화면에서 키보드가 장면을 다시 배치하지 않는 것은 받아들인 한계로 결함에서 제외했다.
- 레지스트리 감사: shadcn 미사용(`components.json` 없음), 제3자 블록 없음 — 건너뜀.

---

## Files Audited
- `src/components/v2/ChatPanel.tsx`, `src/game/chatText.ts`, `src/game/chatUi.ts`(길이만), `src/styles/v2.css`, `src/styles/day.css`, `src/styles/daytable.css`(주석), `src/styles/ds.css`(placeholder 비교)
- 존재·사용처 확인: `src/net/useChat.ts`, `src/screens/Lobby.tsx`, `src/screens/DayScene.tsx`, `src/components/WorldStage.tsx`
- 삭제 확인(grep): v1.0 빠른 메시지·이모티콘·주장·변론 칩·`MessageLog`·`ChatHistorySheet` 및 관련 net·game 모듈
- `.planning/phases/07-free-chat/07-UI-SPEC.md`, `07-DEVICE-CHECKS.md`, `perf/chatload-prod-390x844-x4-dpr2.png`
