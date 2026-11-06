# Phase 08 — UI Review (낮 처형과 유령)

**Audited:** 2026-11-03
**Baseline:** 08-UI-SPEC.md (승인 계약서)
**Screenshots:** not captured (localhost 3000·5173·8080 에 개발 서버 없음 — 코드 감사만 함)
**Interaction captures:** off (workflow.ui_interaction_capture 가 꺼져 있음). 상호작용 판단은 모두 코드에서 뽑았다.

실기기에서 확인하기로 미룬 항목(08-DEVICE-CHECKS.md B1~B14, 표 C)은 감점하지 않고 "이월"로만 적는다. 사용자가 이미 정한 사항(표 12px 유지, 유령 이름표 대비 이월, 낮 시작·처형·아침의 [data-guide] 없음)도 감점하지 않았다.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | 계약 문구와 거의 일치. 위 알림이 한 줄 nowrap 이라 긴 이름에서 넘칠 위험 |
| 2. Visuals | 3/4 | 부품 접근성 이름·초점 링 양호. 처형 단계의 눌리지 않는 찬반 줄이 계약 밖 |
| 3. Color | 3/4 | 60/30/10 지킴. 낮 화면 CSS 에 하드코딩 rgba 2곳, 낮 채팅 막힘 알림이 진홍 |
| 4. Typography | 3/4 | 승인 예외(12·15·22) 외 크기 모두 계약 안. 15px 도장은 승인 예외 |
| 5. Spacing | 3/4 | 4의 배수 토큰과 승인 예외 값 위주. 패널 높이 표와 처형 패널이 어긋남 |
| 6. Experience Design | 3/4 | 재접속·거절·키보드 규칙 갖춤. 로딩 상태 없음, 처형 단계 패널 높이 미계약 |

**Overall: 18/24**

1점(BLOCKER)에 해당하는 결함은 코드에서 찾지 못했다. 단 화면 확인 없이 코드만 본 점수라 4점은 주지 않았다(시각 확인 불가).

---

## Top 3 Priority Fixes

1. **처형 단계의 비활성 찬반 줄(84px)이 계약 밖** — UI-SPEC 은 처형을 "채팅 188·244" 패널로 정했는데 `src/screens/GamePanel.tsx` 의 `showExecPicker` 가 눌리지 않는 큰 버튼 두 개를 더 그려 패널이 약 92px 커지고 맵 스테이지가 줄어든다. 결정 0051(글 최소·누르는 조작 중심)에서도 눌리지 않는 버튼이 5초 동안 화면을 차지한다. 조치: 계약대로 채팅만 두거나, 남기려면 UI-SPEC 패널 표에 "처형 = 찬반 보기 변형"과 높이를 명시하고 스테이지 표를 고친다.
2. **낮 화면 CSS 의 하드코딩 색** — `src/styles/v2.css` 14행(`rgba(230, 232, 238, 0.6)`, 깜빡임 글로)과 108행(`rgba(255, 224, 176, 0.75)`, 선두 배지 글로)이 토큰 변수가 아니다. `src/styles/game.css` 상단 규칙("값은 tokens.css 변수만")과 어긋난다. 조치: `--glow-blink`, `--glow-lead` 같은 토큰으로 옮기거나 `color-mix(in srgb, var(--gray-100) 60%, transparent)`, `color-mix(in srgb, var(--cream-100) 75%, transparent)` 로 쓴다.
3. **낮 채팅 막힘 알림이 진홍** — `src/styles/v2.css` 의 `.mv-chat__notice` 는 `crimson-300` 인데 UI-SPEC Color 는 낮 화면의 진홍을 시간 링 마지막 5초·마피아 채널·유령 마피아 칩·밤 발밑 고리로 한정했다. 지목·찬반처럼 역할마다 같아야 하는 화면에서 진홍 사용은 계약 위반 소지다. 조치: 막힘 알림 색을 `gray-100`(또는 `gray-300`)로 바꾸고 아이콘으로 구분하거나, 7페이즈 예외를 UI-SPEC 목록에 올린다.

그 밖의 권고 3건: 위 알림(`.mv-toast__text`, nowrap)이 360px 폭에서 "{닉}·{닉} → {닉}" 8자 이름이면 잘리거나 넘칠 수 있다(계약 문구 자체는 일치) — 말줄임 없이 `keep-all` 두 줄 허용을 검토. 낮 흐름에 맵 로딩/지연 상태가 없다. 거절 문구 "지금은 고를 수 없어요"가 지목·토론 끝내기·찬반 어디서 났는지 구분되지 않는다.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)
- `src/screens/GameMap.tsx` 34·36행: 거절 "지금은 고를 수 없어요", 전송 실패 "보내지 못했어요. 다시 해 보세요" — 계약표와 글자까지 일치. 해요체, 마침표 없음.
- 토론 끝내기 `aria-label="토론 끝내기"`(GamePanel), 지목 `"{닉네임} 님 가리키기"`(GameMap 247행), 찬성·반대 한 단어씩(VerdictPicker) — 계약 일치.
- 역할 단어는 `RoleChip` 이 `role` 을 받은 유령 분기에서만 만들어짐(RoleChip.tsx 주석·T-08-16). 산 사람 DOM 에 미리 없음.
- 약점: 밤 알약은 v1.0 `NIGHT_PANEL_TEXT` 를 가져와 쓰는데 이 임시 틀 문구가 9페이즈에서 바뀐다(이월). 위 알림 줄바꿈 정책이 없다.
- 열린 질문(08-DEVICE-CHECKS): 밤 시작 알림 부재는 UI-SPEC 대로이며 감점 아님.

### Pillar 2: Visuals (3/4)
- 아이콘 전용 버튼 `RoleChip` 은 `role="img"` + `aria-label`, 지목 이름표는 `aria-label` + `aria-pressed`, 찬반 `aria-pressed`, 시간 링 `role="timer"` — 계약 충족.
- 초점 링 `gray-100` 2px/오프셋 2px 가 `.mf-act`, `.mv-verdict__btn`, 채팅 입력·보내기에 있음.
- 결과 알림은 36px 700 한 줄, 뒤 62% 어둡게 — 화면 중심이 분명함. 유령 `is-ghost` 0.6 불투명도의 이름표 대비는 이월(B3).
- 감점: 처형 단계 눌리지 않는 찬반 줄(위 Top 1). 사진 확인 불가로 초점 계층은 CSS 에서만 판단.

### Pillar 3: Color (3/4)
- 승인 토큰 변수 사용이 일관됨. `src/styles/game.css` 에는 hex·rgb 0건. 버튼 눌림 면 `gray-100`+`night-900` 글자, 놋쇠는 배지·도장·`is-hot` 줄에만(v2.css) — 계약 목록과 일치.
- 하드코딩: `v2.css` 14행·108행의 rgba 2건(Top 2). `src/world/characterData.ts`·`character.ts` 의 hex 는 3D 캐릭터 도안 색이라 화면 UI 색이 아니므로 제외.
- 진홍 사용: `.mv-chat__notice`, `.mv-chat__msg.is-mafia .mv-chat__name`, `.mv-rolechip.is-mafia` — 앞의 둘 중 마피아 채널은 계약 예외이고 막힘 알림은 예외 목록에 없음(Top 3).
- 지목·찬반·토론 끝내기에는 진홍·놋쇠 버튼 없음(확인됨).

### Pillar 4: Typography (3/4)
- 파일별 크기 분포(game.css + v2.css): 12px 1, 14px 4, 15px 1, 16px 6, 22px 1, 24px 1, 36px 1. 12(표)·15(유력 도장)·22(명조 득표 숫자)는 계약이 명시한 승인 예외이며 각자 한 요소에만 쓰임. 나머지 14·16·24·36 은 계약 4개 크기와 같음.
- 굵기는 400·700 만(결과/버튼/이름표). `tabular-nums` 가 배지·링에 있음, 한글 `keep-all` 적용.
- 감점 이유: 4개 크기 표 밖의 값이 3개(승인 예외라 정당하지만 규모는 큼). 실제 렌더 화면 없이 확인 못 함.

### Pillar 5: Spacing (3/4)
- 패널 안쪽 `14 16 22`, 간격 10, 찬반 줄 간격 8, 행동 버튼 52, 입력 48, 찬반 84 — 계약 예외 목록과 일치.
- 임의 값(`[..px]`)은 이 화면 파일에 없음.
- 어긋남: 처형 패널 높이가 계약 표에 없는 값(Top 1). 밤 알약 144.8 vs 157 은 이월(B7).

### Pillar 6: Experience Design (3/4)
- 재접속/연결 끊김: `canSend` 가 `aria-disabled`/`disabled` 로 이어짐. 거절 시 `rejected` 증가로 낙관적 눌림을 서버 값으로 되돌림(GamePanel) — 좋음.
- 키보드: `kbOpen` 일 때 행동 줄·찬반 줄을 그리지 않고 패널 `--kb` 클래스로 올림. 실제 키보드 동작은 이월(B5).
- 모션 줄이기: `prefers-reduced-motion` 이 game.css·v2.css 에 있고 `ghostFloatY`·`executionFade`·`followStep` 이 `reduced` 를 받음 — 계약 충족.
- 약점: 맵/드로 로딩 상태 없음(`mf-game` 은 `night-950` 바탕만), 파괴 동작은 계약상 없음(정상), 낮 채팅이 `me.chat` 없이도 그려지는 것은 열린 질문으로 이월.
- 누설 방지는 서버 분기(`spectate`가 있을 때만 유령 화면)로 설계되어 있음. E2E 보고서상 day·ghost·noexec 통과(코드/문서 근거, 이 감사에서 재실행 안 함).
- Registry audit: components.json 없음 — 건너뜀.

---

## 이월(감점 안 함)
B1~B14 전부(성능 55fps, 조명 읽힘, 유령 이름표 대비, 이름표 44px 손가락 확인, 키보드 찬반 줄, 8자 이름 잘림, 밤 알약 높이, 연출 눈 확인). 표 C 다른 기기·브라우저.

## 참고 자료
| 경로 | 가져온 요소 |
|------|-------------|
| 08-UI-SPEC.md 참고 자료 절 | 승인 보드/디자인 시스템 토큰 — 이 감사는 CSS·컴포넌트 값을 계약과 대조했고 원본 이미지는 열지 않음 |

## Files Audited
src/screens/GameMap.tsx, src/screens/GamePanel.tsx, src/components/v2/{VerdictPicker,RoleChip,TopToast,VoteBadge,SureStamp}.tsx, src/styles/game.css, src/styles/v2.css, src/world/presence.ts(일부), 08-UI-SPEC.md, 08-DEVICE-CHECKS.md, 08-16-SUMMARY.md
(미열람 또는 일부만 열람: ChatPanel.tsx, HeadStack.tsx, useDayFx.ts, dayView.ts, runtime.ts, RoomScreen.tsx, 나머지 SUMMARY — 컨텍스트 예산 규칙)
