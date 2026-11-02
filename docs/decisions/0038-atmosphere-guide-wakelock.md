# 0038 5페이즈는 캐릭터 움직임 없이 점검과 보강만 하고, 밤 비네팅·아침 밝아짐·안내 문장·짧은 폰 압축·Wake Lock 을 클라이언트에만 더한다

- 상태: 채택
- 확인: 2026-10-30 사용자가 실기기 확인과 기본값을 모두 승인했다(전체 승인, 항목별 기록 없음).
- 날짜: 2026-10-29

## 배경

- 5페이즈(분위기와 캐릭터)의 논의(`05-CONTEXT.md` D-01~D-13)가 범위를 줄였다. 캐릭터 움직임은 요구사항이 아니라 결정 0008 의 초기 희망이어서 하지 않고, 이 페이즈의 일은 **점검 + 안내 문장 빈칸 + 분위기 보강 두 곳 + 짧은 폰·링크 참가 화면 규격 + Wake Lock** 이다. 서버·와이어·단계 길이·에셋은 바뀌지 않았다. 그래서 이 페이즈는 클라이언트 전용이고 서버만 먼저 배포할 일이 없다(배포는 마지막 계획 05-09 에서 한 번).
- 이 문서는 05-01~05-07 이 **실제로 만든 것**과 UI-SPEC(`05-UI-SPEC.md`)과 코드가 어긋난 곳을 코드 기준으로 한 곳에 적는다. 결정 0036(와이어)·0037(처형 구간 화면)은 건드리지 않는다.
- 입력: UI-SPEC §8~§16, 결정 0008·0030·0034·0037.
- 사용자 결정(2026-10-29): 캐릭터 애니메이션 없음, 새 에셋 없음, **새 진동 없음**(웹 진동은 iPhone Safari 에서 동작하지 않고, 햅틱 같은 앱 전용 기능은 앱으로 전환할 때 붙인다), 비네팅·아침 밝아짐 값은 시안 승인, P5-3 짧은 폰 압축·P5-4 링크 참가 맞춤 승인. 실기기 확인은 모든 개발이 끝난 뒤 한 번에 한다.

## 결정

1. **캐릭터 움직임 없음·새 에셋 없음(D-01·D-02), CHAR-01 점검 결론(D-03)**: 정지 그림 8종(`public/characters/table/fig1~8`)을 그대로 쓴다. 점검 결과 고칠 것이 없었다 — `figureSrc(seat)` 는 자리 번호만의 함수라(8개 서로 다름, `seat + 8` 은 같은 그림) 외형이 능력·역할과 무관하고, 대기실·낮(주장)·후보 선택·링크 참가 7명에서 인물마다 닉네임 이름표가 붙으며 결과 화면은 카드마다 닉네임·자리 색 점이 붙는다(`test/client/characterAudit.test.tsx` 12건). 결과 화면의 카드 그림은 **직업 그림 4종**이라 같은 직업은 같은 모양이다(P5-8, 바꾸지 않음). 프레임 PNG·Rive·Lottie 도입 결정은 닫고 결정 0008 에 보완을 붙였다. 플레이테스트(6페이즈)에서 밋밋하다는 반응이 나오면 v1.1 후보다.
2. **단계 전환 점검 결론과 보강 두 곳(D-04~D-07)**: UI-SPEC §9.2 점검표 12행 중 보강은 **처형 → 밤**(§9.2 8번)과 **밤 → 아침**(9번) 두 곳이다. 4·6·10번은 같은 시간대 안의 소전환이거나 문구가 이끌어 의도된 밋밋함으로 두었다. 근본 원인은 방 그림이 장면마다 같고 창문 풍경만 다르다는 것(§9.1)이다. 수치는 `src/game/scenes.ts` 한 곳이다.
   - **밤 비네팅**: `NIGHT_VIGNETTE_ELLIPSE = "70% 60% at 50% 44%"`, `NIGHT_VIGNETTE_STOPS = [[0, 0], [45, 0], [75, 0.40], [100, 0.72]]`(타원 위 위치 % → `--night-950` 알파), `NIGHT_VIGNETTE_FADE_MS = SCENE_FADE_MS`(800). `nightVignetteGradient()` 가 `radial-gradient(… color-mix(in srgb, var(--night-950) A%, transparent) P% …)` 를 만들어 인라인 변수 `--mf-vignette` 로 싣고, `Backdrop` 이 **밤 그림 층의 자식** `div.mf-backdrop__vignette`(`atmosphere.css`: absolute·inset 0·`pointer-events: none`·`background: var(--mf-vignette)`)로 그린다. 그림 층의 자식이라 층의 opacity 크로스페이드를 그대로 따르고 별도 전환·애니메이션이 없다. 인물·이름표·헤더·하단 패널은 모두 그림 층 위라 어두워지지 않는다. 낮·투표 구간·대기실·배정·결과(`ResultScreen`)에는 그리지 않는다.
   - **아침 밝아짐**: `MORNING_GLOW_ELLIPSE = "85% 60% at 50% 55%"`, `MORNING_GLOW_ALPHA = 0.38`, `MORNING_GLOW_RISE_MS = 600`. `morningGlowGradient()` 는 `radial-gradient(ellipse …, color-mix(in srgb, var(--dawn) 38%, transparent), transparent)`(끝은 위치 없는 `transparent` 라 선형 감쇠)이고 `DayScene` 이 아침 단계 **장면 상자의 첫 자식**(`DayTable` 뒤, `z-index: -1`) `div.mf-morningglow`(`aria-hidden`)로 그린다. 밤 → 아침을 같은 접속에서 본 렌더만 `--rise`(600ms, `--ease-out`)로 오르고 재접속·중간 입장은 최대치로 시작한다. 퇴장은 아침 카드와 같은 `--mf-morning-exit-delay` 뒤 300ms 이다. 헤더에는 닿지 않아 헤더 글씨 대비(H1)는 불변이다.
   - 두 층 모두 `view.phase` 와 같은 접속의 전환 여부만 읽고 역할·연결 상태를 읽지 않는다(4역할·관전자 마크업 동일). 색은 토큰 한 가지씩이고 앰버·진홍·`#` 색 값이 없다(D-07). **모션 줄이기**는 별도 분기가 없고 `base.css` 전역 규칙(애니메이션·전환 0.01ms)을 따라 정적 상태로 보인다. **전환 진동은 넣지 않는다**(D-05, 위 사용자 결정; 4페이즈에 이미 있는 진동은 그대로).
3. **안내 문장 3개와 `data-guide` 계약(D-08·D-09)**: 점검표(14단계 × 역할 시점)의 빈 칸은 두 곳이었다. 문장은 `scenes.ts` 의 `PHASE_GUIDE_FILL` 한 곳이다 — 낮 시작 하단 `낮이 되었어요` / `곧 직업 공개가 시작돼요`(생존자·탈락자 모두 같은 두 줄), 낮 토론 헤더 안내줄 `{n}일차 · 의견을 나눠요`(살아 있는 viewer 만, 99일차에서도 14자 이하; 탈락자는 기존 `{n}일차` + 하단 읽기 전용 줄). 상수는 역할을 입력으로 받지 않아 역할이 새지 않는다. 모든 단계 화면의 "지금 할 일 한 문장" 요소에는 값 없는 속성 `data-guide=""` 를 붙이며 **한 화면에 정확히 하나**다(항상 주 안내인 부품은 부품 안에서, 보조 줄로도 쓰이는 `PhaseBar` 안내줄·`ReadOnlyRow` 는 `guide` prop 으로 장면이 켠다). **시간 없음 단계** `TIMELESS_PHASES = [lobby, assigning, ended]` 외 11단계는 `[role="timer"]` 가 있어야 하고, E2E 의 같은 이름 상수와 `test/unit/e2eContract.test.ts` 가 동일성을 지킨다. `assigning`(3초, 시간 표시 없음 유지)을 예외에 넣은 것은 확인 대기 기본값 P5-5 다. → 2026-11-02 개정(07-UAT 8, 07-23): 낮 시작 하단 안내는 곧 토론이 시작돼요.
4. **짧은 폰 테이블 압축(P5-3, UX-02)**: 지원 하한은 **방 높이 516(장면 높이 240)** 이다. 장면 높이 299(`TABLE_FIT_MIN_H`) 이상의 기하는 승인 값 그대로(`fit = 1`)이고, 299 미만에서만 좌석 원 세로 반지름·캐릭터 배율·테이블 면 높이를 같은 배율 `f` 로 줄인다. `tableFitScale(H) = clamp((H − TAG_BOX_H) / TABLE_FIT_SPAN, TABLE_FIT_MIN_SCALE, 1)`, `TAG_BOX_H = 26`, `TABLE_FIT_SPAN = 2·SEAT_RY + FIG_H·DEPTH_K0 = 276.8`, **하한 `TABLE_FIT_MIN_SCALE = 0.77`**(아래 어긋난 곳 참고). `cy = max(ry + 76.8·f, H − 26 − ry)`, 면 `top = cy − 60f`·`height = 108f`. 이름표 글자·높이, 가로 반지름·면 폭은 줄이지 않는다. 장면 240 미만에서는 배율이 하한에서 멈추고 맨 뒤 머리 위가 0 에 닿으며(머리 우선) 맨 앞 이름표가 장면 아래로 넘칠 수 있다 — 지원 밖이다. 변론에서 후보 본인의 하단 패널 변형(높이 236)은 방 516 에서 장면이 약 161 이라 이 구간에 든다(지원 밖의 극단 조합, 머리 우선 동작). 0·음수·NaN·Infinity 높이는 하한 값으로 받아 모든 좌표가 유한하다(`dayTable.test.ts`). 실제 브라우저 8명판 실측에서 맨 앞 이름표 상자 아래끝 − 장면 아래끝은 360x516·375x516·360x560·375x553 모두 0, 360x640 −27.8, 390x664 −51.8 이다.
   - **[테스트] 버튼 좁힘(05-06, 사용자 결정 2026-10-29)**: 360x560(장면 283.8)에서 테스트 방의 [테스트] 버튼이 2번 자리 상자와 가로 16.2·세로 35.9px 겹쳐 D4 가 실패했다. 압축으로는 풀 수 없어(자리 2 의 위를 33px 내리면 맨 앞 이름표가 넘친다) 위치는 두고 **장면 높이 299 미만에서만 버튼 폭을 88 → 44 로 좁힌다**(`testButtonCompact(sceneH)`, `TestTools.tsx` 의 `data-compact`, `testtools.css`; 글자는 시각적으로만 숨기고 접근 이름 `테스트` 유지). 계획 범위 밖 파일을 고쳤고 D4 허용 3px 는 그대로다.
5. **링크 참가 화면 광장 축소(P5-4, UX-02)**: 앉은 사람 `SEATED_COMPACT_FROM = 5` 명 이상이면 `JoinByLink` 가 `ul.mf-join__seated--many` 와(입력 카드가 보일 때) `main.mf-join--many` 수정자를 붙인다. `ds.css` 값: 인물 **48×64**(3:4 유지), `ul` row-gap 4, 광장 gap 4·아래 여백 8, 머리글 아래 24, 카드 위 16, 위 여백 32 — 모두 `var(--space-*)`(4의 배수), 닉네임 글자 14px·최대 폭·4열 줄바꿈은 그대로. 7명이 앉았을 때 문서 높이는 360x640 에서 640(내용 621; 이전 733), 390x664 에서 664 로 스크롤이 없고 `참가하기` 아래끝은 532·556, 430x932 는 932·824 이다. 360x560·375x553 에서는 7명이 61~68px, 4명 이하도 48~55px 넘친다(원래부터; E2E `UX2-J` 는 화면 높이 640 이상(`JOIN_FIT_MIN_H`)에서만 판정한다).
6. **Wake Lock(CONN-03, D-12·D-13, P5-7)**: `src/net/useWakeLock.ts` 의 `useWakeLock(active)`. `RoomScreen` 이 `view !== null && view.phase !== "ended" && status` 가 `replaced`·`failed`·`removed` 가 아닐 때 `active` 로 부른다 — **대기실부터 `ended` 전까지**(reconnecting 중에는 유지). `active` 가 참이 되면 `navigator.wakeLock.request("screen")` 을 한 번(진행 중이거나 살아 있는 sentinel 이 있으면 겹쳐 요청하지 않음), 재요청 경로는 **`visibilitychange` 가 visible 일 때 하나뿐**이다(sentinel 의 `release` 이벤트는 참조를 비우는 표시일 뿐 재요청하지 않아 저전력 모드의 반복 거부 루프가 없다). `active` 가 꺼지거나 언마운트되면 release 와 리스너 제거, 요청 도중 비활성이 되면 받자마자 release 한다. `navigator.wakeLock` 이 없음·`request` 동기 예외·거부·release 거부는 **조용히 생략**한다(화면·토스트·콘솔 없음, 코드에 `console.` 없음). 상태는 effect 한 번의 수명에 갇힌 지역 값이다. 클라이언트 전용이고 서버·와이어·마크업은 불변이다. 시험은 `test/client/useWakeLock.test.tsx` 13건과 `roomScreen.test.tsx`, 모의 도우미는 `test/helpers/wakeLockFake.ts`.
7. **E2E 변경(기준 수치 불변)**: 기본 크기에 단 높이 probe **`360x560`** 이 넷째로 들어갔다(폭 360·390·430 기준 유지). 새 검사는 `UX1`(`[data-guide]` 정확히 하나·한 줄·타이머, `TIMELESS_PHASES` 예외)·`UX2`(문서 높이)·`UX2-J`(링크 참가 7명이 한 화면, 높이 640 이상)·`UX2-PC`(1280x800 에서 `#root` 폭 ≤ 430 이고 가운데)·`AT1`(밤 비네팅: 밤에만 1개, `pointer-events: none`, 탭 통과, 인물 위로 올라오지 않음)·`AT2`(아침 밝아짐, 헤더 대비 불변)·`WL1`(미지원 환경에서 낮 토론까지 콘솔 오류 없이 진행)·`WL2`(요청 스파이: 대기실 요청 ≥ 1, 가림 → 보임 복귀 재요청 정확히 1회)이고, 순수 판정은 `scripts/e2e/lib.mjs`·`lib.test.mjs`(168건)가 지킨다. **크기 고정 흐름**(FLOWS 의 선택 속성 `size`): `pc`(1280x800, 모바일 아님)와 `wakelock`(360x640)은 크기 목록과 곱하지 않고 한 번만 돈다. 흐름 열 개 × 기본 네 크기 + `pc` + `wakelock` 이다. `OVERLAP_EPS`·`TAP_MIN`·`ONE_LINE_FACTOR`·`FACE_RATIO`·`PANEL_H`·`HEADER_CONTRAST_MIN` 과 `APPROVED_RELAXATIONS`(다섯 개)는 건드리지 않았다. AT2 첫 실패는 측정 결함(이름표가 평소 `pointer-events: none` 이라 프로브가 건너뜀)이어서 프로브가 이름표도 잠시 `auto` 로 두고 찍도록 고쳤다.

### 코드와 UI-SPEC 이 어긋난 곳(코드가 맞다)

- **압축 하한 0.77, 식 `(H − 26)/276.8`**: UI-SPEC §11.3(a) 는 "장면 높이 / 299 비율, 하한 0.8" 을 권장했다. 05-04 의 첫 판은 이름표를 높이 22 로 보고 하한 0.78 이었으나, 실제 DOM 의 `.mf-dt__tag` 상자는 26(알약 22 + 인라인 줄 상자 4, 알약이 아래쪽)이라 지원 하한 장면 240 에서 맨 앞 이름표가 4px 넘쳤다. 상자 26 기준으로 (240 − 26)/276.8 = 0.7731 보다 작은 값이어야 넘침이 0 이라 하한을 **0.77**(권장 0.8·첫 판 0.78 과 다름)로 정했다(오케스트레이터 결정). E2E D2(`rectInside`, 허용 0.5)가 이 상자를 재므로 `360x560` probe 의 통과 조건이기도 하다.
- **299 경계 불연속 약 2.6px**: 299 이상은 승인 기하 그대로라 H = 299 에서 `cy` 177, H = 298.99 에서 압축 식 174.4 로 약 2.6px 어긋난다(계획 예상 약 4px 보다 작다). H = 299~302 에서는 승인 기하 때문에 맨 앞 이름표 상자가 최대 4px 장면 아래로 넘친다(승인값이라 건드리지 않음, 현재 E2E 크기에는 걸리지 않음).
- **5글자 이름표 상자 겹침 약 3px**: 이름표 겹침 검사는 알약(22) 기준(폭 100 × 높이 22, 허용 0.5)이고 압축 하한 0.77 에서도 통과한다. 실제 상자(26)끼리는 폭 99 인 5글자 이름표가 세로로 약 3px 겹칠 수 있다. 알약끼리는 겹치지 않고 E2E 봇 이름은 3글자라 걸리지 않는다.
- **비네팅 층 위치**: UI-SPEC §9.3 은 `z-index: -1` 로 `Backdrop` 안에 둔다고 했으나 코드는 밤 그림 층의 자식이다(그림 층의 opacity 크로스페이드를 그대로 따르게 하려는 것; 인물·글자 위에 올라오지 않는다는 결과는 같다).
- **링크 참가 7명의 짧은 화면**: 계획의 목표 크기(360x640·390x664)만 한 화면이고 360x560·375x553 은 그대로 넘친다(UI-SPEC §11.2 측정 173·180 에서는 줄어 61·68).
- **낮 시작 하단은 탈락자에게도 같은 두 줄**이다(아침 하단과 같은 규칙; UI-SPEC 의 탈락자 읽기 전용 줄 분기보다 `dayAnnounce` 분기가 앞이다).
- **[테스트] 버튼 폭 44**: UI-SPEC 에 없는 사용자 결정(위 4번).

## 알려진 한계

- **체감은 실기기 몫**: 비네팅 0.40/0.72 가 충분히 무거운지, 아침 밝아짐이 탈락자 강조 어둡게 층(`night-900` 45%) 뒤에서 보일 만큼 되는지는 E2E 로 알 수 없다. 약하면 `scenes.ts` 의 `MORNING_GLOW_ALPHA`(또는 색 `--morning`)·`NIGHT_VIGNETTE_STOPS` 만 고친다.
- **Wake Lock 의 실제 효과**: iOS Safari·저전력 모드·Android Chrome·탭 전환 뒤의 화면 꺼짐 방지는 모의와 요청 스파이로만 확인했다.
- **로컬 dev 는 CSS 를 압축하지 않는다**: 결정 0037 에 적은 `backdrop-filter` 선례처럼 CSS 에 기대는 검사(`.mf-tt[data-compact]`, 두 층 규칙)의 최종 판정은 배포본 E2E(05-09)가 한다. 빌드 CSS 에는 `.mf-backdrop__vignette`·`.mf-morningglow` 규칙과 `var(--mf-vignette)`·`var(--mf-glow)`·`pointer-events:none` 이 선언 그대로 남았음을 확인했다.
- **링크 참가 화면 이름 알약 말줄임**: 7명이 앉으면 이름 알약이 `화면검…` 처럼 말줄임되고 `7 / 8명이 모였어요` 줄이 아랫줄 인물 발·시계 그림과 가깝게 붙어 보인다(05-06 사진 검토). 실기기 목록에 올린다.

## 바뀔 수 있는 기본값

UI-SPEC §14 의 P5-5~P5-8 과 체감 backstop 두 개다. 고칠 곳은 한 곳이다.

| 번호 | 기본값 | 상태 | 바꾸려면 고칠 곳 한 곳 |
|---|---|---|---|
| P5-1 | 밤 비네팅 타원·알파·페이드 | **사용자 확정**(시안 승인), 체감은 실기기 확인 대기 | `scenes.ts` `NIGHT_VIGNETTE_STOPS`·`NIGHT_VIGNETTE_ELLIPSE` |
| P5-2 | 아침 밝아짐 알파 0.38·상승 600ms | **사용자 확정**(시안 승인), 체감은 실기기 확인 대기 | `scenes.ts` `MORNING_GLOW_ALPHA`(약하면 색 `--morning`, 층 위치) |
| P5-3 | 짧은 폰 압축, 지원 하한 516, 하한 0.77 | **사용자 확정**(압축), 하한 값은 오케스트레이터 결정 | `dayTable.ts` `TABLE_FIT_MIN_SCALE`, 되돌리려면 하한 높이 575 문서화 |
| P5-4 | 링크 참가 5명 이상 광장 축소(48×64 등) | **사용자 확정** | `ds.css` `.mf-join--many`·`.mf-join__seated--many` |
| P5-5 | `assigning` 시간 표시 없음(`TIMELESS_PHASES`) | 확인 대기 | 타이머를 `.mf-assign__bar` 에 더하고 상수에서 뺀다 |
| P5-6 | 새 문장 3개(`PHASE_GUIDE_FILL`) | 확인 대기 | `scenes.ts` `PHASE_GUIDE_FILL` |
| P5-7 | Wake Lock 은 대기실부터 `ended` 직전까지 | 확인 대기 | `RoomScreen` 의 `useWakeLock(…)` active 조건 한 줄 |
| P5-8 | 결과 화면 카드 그림은 직업 4종(같은 직업은 같은 모양) | 확인 대기 | 새 결정 |
| — | 비네팅 세기 체감 | 실기기 확인 대기 | `NIGHT_VIGNETTE_STOPS` |
| — | 아침 밝아짐 세기 체감 | 실기기 확인 대기 | `MORNING_GLOW_ALPHA` |
| — | 짧은 폰(SE 급)의 압축된 테이블 모습, [테스트] 버튼 44 폭 | 실기기 확인 대기 | `TABLE_FIT_MIN_SCALE`, `testButtonCompact` |
| — | 링크 참가 7명 화면 이름 말줄임·`모였어요` 줄 간격 | 실기기 확인 대기 | `ds.css` 광장 값 |

## 결과

- **되돌리기 비용**
  - 문구(`PHASE_GUIDE_FILL`)·두 층의 수치(`scenes.ts`)·압축 하한(`dayTable.ts`)·광장 값(`ds.css`)은 **쉬운 변경**(reversible)이다. 한 파일을 고치고 단위 시험의 기대값을 맞춘다.
  - `data-guide` 계약은 속성만 지우면 되지만 E2E `UX1` 과 `guide.test.tsx` 가 이것을 읽으므로 함께 바꾼다(**중간 비용**).
  - `useWakeLock` 은 `RoomScreen` 의 한 줄과 훅 파일이라 되돌리기 쉽다. 새 의존성·에셋·토큰·서버·와이어 변경이 없다.
  - 크기 고정 흐름(`size`)과 `360x560` probe 는 E2E 실행 시간을 늘린다(기본 실행 크기 넷 + 고정 흐름 둘).
- 시험: `test/client/guide.test.tsx`(87건)·`atmosphere.test.tsx`·`characterAudit.test.tsx`·`useWakeLock.test.tsx`·`testToolsCompact.test.tsx`, `test/unit/scenes.test.ts`·`atmosphereCss.test.ts`·`dayTable.test.ts`·`e2eContract.test.ts`, E2E 흐름 열 개(`scripts/e2e/flows.mjs`) × 폰 크기 넷 + `pc` + `wakelock`.
- 배포: 05-08 이 배포 전 로컬 게이트(전체 시험·타입·빌드·빌드 CSS·로컬 전체 E2E)를 통과시켜 두고, 05-09 가 사용자 go-ahead 뒤 한 번 배포해 배포본 E2E 로 확인한다. 요구사항 LOOK-01·UX-01·UX-02·CONN-03 의 체크는 그 뒤에 한다. 실기기 확인은 모든 개발이 끝난 뒤 사용자가 한 번에 한다.
