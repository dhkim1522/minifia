# Phase 18: 바로 고칠 것: 증거·조명·튜토리얼 손보기 - Context

**Gathered:** 2026-11-09
**Status:** Ready for planning

<domain>
## Phase Boundary

실테스트 전에, 미션 방향과 무관하게 증거·화면이 제대로 읽히게 고친다(결정 0081-1). 범위는 ROADMAP Phase 18 성공 기준 5개다.

1. 옷 중복 해소: 한 판 안에서 두 사람이 같은 옷을 입지 않는다. 흔적의 같은 옷 표시는 많아야 한 사람에게 붙는다.
2. 낮·밤 조명 대비: 낮(`talk`·`morning`)과 밤이 장면만 보고 구분된다. 채도는 낮게 둔다. 튜토리얼 낮 장면도 같다.
3. 튜토리얼 손보기: 대상 밖 어둡게(흐림 없음), 아래 가운데 넓은 [다음] 글 단추, 채팅 칸·입력줄·[내 역할] 숨김, 장면 5 연결선이 화면 안에서 끝남, 직업 카드 문구가 실제 판과 같음.
4. 낡은 문구 정리: "밤 대화가 공개돼요" 삭제, 밤 띠 "이름표"→"얼굴", 아침 증거 "눈 0"→목격자 없음 아이콘.
5. 바뀐 흐름 E2E 통과, minifia-v3 배포.

새 흐름(저녁 등불·집 찾기·현장 조사), 판 종류 선택, 맵 확장은 19~21페이즈다.

</domain>

<decisions>
## Implementation Decisions

사용자는 논의할 곳을 따로 고르지 않았다("No preference"). **18-UI-SPEC.md 의 기본값 기록 P18-1~P18-11 이 그대로 이 페이즈의 결정이다.** 아래는 그 요약이고, 값과 세부는 UI-SPEC 이 원천이다.

### 옷 중복 (SC-1)
- **D-01 (P18-1):** 서버가 [시작] 순간(`beginGame`)에 겹친 옷을 푼다. 직접 고른 옷(`look` 있음)이 기본 coat 보다 우선이고, 같은 순위끼리는 좌석 번호가 작은 사람이 옷을 지킨다. 진 사람은 `OUTFIT_IDS` 순서에서 아직 아무도 안 입은 첫 옷으로 바뀐다. 난수는 쓰지 않는다(역할 배정 난수 순서 불변). 바뀐 옷은 `look` 에 저장되어 다음 대기실에도 남는다. 화면 알림은 없다(0051). 해소 규칙은 역할을 읽지 않는다(L25).
- **D-02 (P18-2·3):** 옷장(로비·결과 화면의 `DressSheet`)은 **다른 사람이 직접 고른 옷만** 잠근다. 내 옷과 기본 coat 는 잠그지 않는다. 잠긴 카드는 불투명도 .45 + 자물쇠 16 이고, 눌러도 반응·알림이 없다. 서버 `setLook` 도 이미 남이 입은 옷이면 오류 없이 버린다(거절 문구는 오라클이 된다).
- 입장 때 빈 옷을 자동 배정하는 안은 쓰지 않는다(아래 Discussion Log 참조, 기본값 유지).

### 조명 (SC-2)
- **D-03 (P18-4):** 낮은 흐린 보랏빛 회색 하늘·안개 + 따뜻한 햇빛(새 `moonColor`)으로 바꾸고, 반구광·방향광 세기를 올린다. 밤 값은 바꾸지 않는다. 광장·재즈 바 시작값과 허용 범위 5개(채도 ≤ 0.20, 배경 휘도 8배/바 6배, 색온도 R≥B/B>R, 단계 순서 talk>morning>vote>night, 가독)는 UI-SPEC "조명 계약" 표 그대로다. 시작값이라 허용 범위 안에서 첫 렌더로 조정해도 되고, 최종 값은 SUMMARY 에 적는다. 재질 색은 건드리지 않는다.

### 튜토리얼 (SC-3)
- **D-04 (P18-5):** 스포트라이트는 대상 밖을 `--night-950` 50% 로 덮는다. SVG mask 로 만들고 흐림은 쓰지 않는다. 포커스가 있는 구간에만 켠다. 장면 5·7 과 [다음] 차례에는 켜지 않는다.
- **D-05 (P18-6·11):** [다음]은 아래 가운데 알약 240×56(좁으면 화면 − 48)이고, "다음" 글 + chevron 에 17 의 깜빡이는 램프 테두리를 단다. `data-tutorial-next` 와 접근성 이름은 유지한다. [다음]이 보이면 장면 4 의 심부름 진행 점은 숨긴다.
- **D-06 (P18-7):** 지도 장면 2~6 동안 아래 패널 전부와 [내 역할] 단추를 DOM 에서 뺀다(`panelless` 확장).
- **D-07 (P18-8):** 장면 2·5·6 의 카메라는 광장 가운데 고정, 줌 1 이다. 장면 3·4 는 나를 따라간다. 실제 판의 `cameraModeOf` 는 바꾸지 않는다. 도윤의 `TUTORIAL_SPOTS[1]` 만 안쪽으로 옮긴다. 선 좌표는 화면 안쪽 8 로 clamp 하고, 선 층은 `overflow: hidden` 이다.
- **D-08 (P18-9):** 직업 카드 네 장의 설명은 `ROLE_TEXT[role].desc` 에서 읽는다. 문구를 두 곳에 두지 않는다.

### 낡은 문구 (SC-4)
- **D-09:** `RoleReveal` 의 공개 예고 줄을 삭제한다(`[data-pre-notice]`·4초 타이머 포함). 밤 띠 4개는 "이름표"→"얼굴"로 바꾼다. `nomination.act` 는 그대로 둔다.
- **D-10 (P18-10):** 증거 카드의 목격자 없음은 `eyeOff` 아이콘 24 하나로 보여 준다. 접근성 이름은 "목격자 없음"이고 `data-lastseen-count="0"` 은 유지한다.

### 검증·배포 (SC-5)
- **D-11:** 바뀐 흐름만 로컬 폰 6종으로 E2E 를 돌린다(avatar-dress·tutorial solo/together·errand·witness·emcee-band·night·result). 전체 회귀는 페이즈 끝에 한 번만 돌린다. 실행이 끝나면 Claude 가 minifia-v3 에 배포하고, 배포본 smoke 와 바뀐 흐름으로 확인한다. 실기기 항목은 v3.0 실테스트로 미룬다.

### Claude's Discretion
- 조명 값은 허용 범위 안에서 미세 조정한다. 도윤 자리 좌표, 스포트라이트 z 순서, 튜토리얼 고정 카메라를 주는 경로는 계획 단계가 정한다.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 이 페이즈의 계약
- `.planning/phases/18-quick-fixes/18-UI-SPEC.md` — 값·선택자·허용 범위·위험 목록의 원천(P18-1~11, 조명 계약, 튜토리얼 계약, 옷장 계약, 문구 표)
- `docs/decisions/0081-v3-missions-flow-and-modes.md` — 0081-1 네 가지와 0078-8 개정
- `.planning/ROADMAP.md` §Phase 18 — 성공 기준 5개

### 배경
- `docs/research-v3-missions-ux.md` §4-2·4-3·4-4 — 튜토리얼·증거 문제 진단(조사 문서. 큰 문서라 해당 절만 읽는다)
- `docs/decisions/0078-*.md`·`0080-v3-tutorial-first-case.md` — 17 튜토리얼 구조(장면 1~7, 포커스 상자, 깜빡이는 테두리)
- `.planning/phases/17-tutorial-first-case/` — 17 SUMMARY 와 알려진 한계
- `design/v2.0/README.md` — 조명·분위기 방향
- `docs/screen-map.md` — 실행 뒤 튜토리얼 장면 표·옷장 줄을 갱신한다

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `shared/game/look.ts` (`setLook`, `DEFAULT_LOOK`): 해소 함수와 잠금 검사를 넣을 곳이다. 순수 모듈이다.
- `src/components/v2/DressSheet.tsx`: 기존 비활성 카드 규칙이 있어 `taken` 계산만 바꾸면 된다.
- `src/game/roleText.ts` (`ROLE_TEXT`): 직업 카드 문구의 출처다.
- `src/game/tutorialScript.ts` (`TUTORIAL_SPOTS`, 장면 대본): 카메라 덮어쓰기와 도윤 자리를 바꿀 곳이다.
- `src/world/maps/plaza.ts`·`bar.ts` (`PLAZA_LIGHT_TUNE`·`LIGHT_TUNE`): 조명 표가 있는 곳이다.
- 17 의 `FocusRing`·`.tut-next`·`tut-ring` 애니메이션: 스포트라이트와 [다음]이 재사용한다.

### Established Patterns
- 규칙은 서버(방 DO)가 정하고, 거절은 오류 없이 버린다(결정 0002, L30).
- 튜토리얼 혼자 하기는 서버 0 이다. `tutorialStaticGuard` 가 정적 표 읽기를 허용해야 한다.
- 화면 글은 최소로 둔다(0051). 아이콘이 말한다.

### Integration Points
- `beginGame` 이 옷 해소를 부르는 곳이다. rematch(`REMATCH_PLAYER_KEYS`)·테스트 방 봇도 같은 경로를 지난다.
- 장면 빌더 `applyLook` 이 단계 전환 때 `moon.color` 를 갱신한다.
- 갱신할 시험: `hostLine.test.ts`, `scripts/e2e/lib.mjs`(밤 띠 문구 표), `evidenceCard.test.tsx`·`recordTrace.test.tsx`, `[data-pre-notice]` 검사.

</code_context>

<specifics>
## Specific Ideas

- 낮은 "흐린 오후"이고, 밤은 지금의 남색 + 램프 빛이다. 낮도 마피아 분위기를 지킨다(사용자 메모).
- 강조는 17 의 깜빡이는 램프 테두리를 그대로 쓰고, 0081 로 대상 밖 어둡게가 더해졌다. 흐림과 손가락 포인터는 여전히 쓰지 않는다.
- 360×560 같은 작은 화면의 가장자리 잘림은 진행에 지장이 없으면 고치지 않는다(17 알려진 한계 유지).

</specifics>

<deferred>
## Deferred Ideas

- 입장 때 빈 옷을 자동 배정해 대기실에서도 모두 다르게 보이게 하는 안. 지금은 시작 때 푸는 방식으로 충분하다. 필요하면 실테스트 뒤 검토한다.
- 튜토리얼을 실제 판의 축소판으로 다시 짜는 것(조사 4-4 #6, 0081 "정하지 않은 것")은 21페이즈 새 흐름 뒤에 한다.

</deferred>

---

*Phase: 18-바로 고칠 것: 증거·조명·튜토리얼 손보기*
*Context gathered: 2026-11-09*
