# Phase 18: 바로 고칠 것: 증거·조명·튜토리얼 손보기 - Research

**Researched:** 2026-11-09
**Domain:** 서버 순수 규칙(옷 중복 해소) + Three.js 장면 조명 표 + React 튜토리얼 화면(스포트라이트·[다음]·장면 5 선) + 문구 정리 + 로컬 E2E·배포
**Confidence:** HIGH (전부 이 저장소 코드를 직접 열어 확인. 외부 라이브러리·새 패키지 없음. 조명 "렌더 휘도 순서"만 MEDIUM — 첫 렌더 전에는 알 수 없다)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

사용자는 논의할 곳을 따로 고르지 않았다("No preference"). **18-UI-SPEC.md 의 기본값 기록 P18-1~P18-11 이 그대로 이 페이즈의 결정이다.** 아래는 그 요약이고, 값과 세부는 UI-SPEC 이 원천이다.

**옷 중복 (SC-1)**
- **D-01 (P18-1):** 서버가 [시작] 순간(`beginGame`)에 겹친 옷을 푼다. 직접 고른 옷(`look` 있음)이 기본 coat 보다 우선이고, 같은 순위끼리는 좌석 번호가 작은 사람이 옷을 지킨다. 진 사람은 `OUTFIT_IDS` 순서에서 아직 아무도 안 입은 첫 옷으로 바뀐다. 난수는 쓰지 않는다(역할 배정 난수 순서 불변). 바뀐 옷은 `look` 에 저장되어 다음 대기실에도 남는다. 화면 알림은 없다(0051). 해소 규칙은 역할을 읽지 않는다(L25).
- **D-02 (P18-2·3):** 옷장(로비·결과 화면의 `DressSheet`)은 **다른 사람이 직접 고른 옷만** 잠근다. 내 옷과 기본 coat 는 잠그지 않는다. 잠긴 카드는 불투명도 .45 + 자물쇠 16 이고, 눌러도 반응·알림이 없다. 서버 `setLook` 도 이미 남이 입은 옷이면 오류 없이 버린다(거절 문구는 오라클이 된다).
- 입장 때 빈 옷을 자동 배정하는 안은 쓰지 않는다(아래 Discussion Log 참조, 기본값 유지).

**조명 (SC-2)**
- **D-03 (P18-4):** 낮은 흐린 보랏빛 회색 하늘·안개 + 따뜻한 햇빛(새 `moonColor`)으로 바꾸고, 반구광·방향광 세기를 올린다. 밤 값은 바꾸지 않는다. 광장·재즈 바 시작값과 허용 범위 5개(채도 ≤ 0.20, 배경 휘도 8배/바 6배, 색온도 R≥B/B>R, 단계 순서 talk>morning>vote>night, 가독)는 UI-SPEC "조명 계약" 표 그대로다. 시작값이라 허용 범위 안에서 첫 렌더로 조정해도 되고, 최종 값은 SUMMARY 에 적는다. 재질 색은 건드리지 않는다.

**튜토리얼 (SC-3)**
- **D-04 (P18-5):** 스포트라이트는 대상 밖을 `--night-950` 50% 로 덮는다. SVG mask 로 만들고 흐림은 쓰지 않는다. 포커스가 있는 구간에만 켠다. 장면 5·7 과 [다음] 차례에는 켜지 않는다.
- **D-05 (P18-6·11):** [다음]은 아래 가운데 알약 240×56(좁으면 화면 − 48)이고, "다음" 글 + chevron 에 17 의 깜빡이는 램프 테두리를 단다. `data-tutorial-next` 와 접근성 이름은 유지한다. [다음]이 보이면 장면 4 의 심부름 진행 점은 숨긴다.
- **D-06 (P18-7):** 지도 장면 2~6 동안 아래 패널 전부와 [내 역할] 단추를 DOM 에서 뺀다(`panelless` 확장).
- **D-07 (P18-8):** 장면 2·5·6 의 카메라는 광장 가운데 고정, 줌 1 이다. 장면 3·4 는 나를 따라간다. 실제 판의 `cameraModeOf` 는 바꾸지 않는다. 도윤의 `TUTORIAL_SPOTS[1]` 만 안쪽으로 옮긴다. 선 좌표는 화면 안쪽 8 로 clamp 하고, 선 층은 `overflow: hidden` 이다.
- **D-08 (P18-9):** 직업 카드 네 장의 설명은 `ROLE_TEXT[role].desc` 에서 읽는다. 문구를 두 곳에 두지 않는다.

**낡은 문구 (SC-4)**
- **D-09:** `RoleReveal` 의 공개 예고 줄을 삭제한다(`[data-pre-notice]`·4초 타이머 포함). 밤 띠 4개는 "이름표"→"얼굴"로 바꾼다. `nomination.act` 는 그대로 둔다.
- **D-10 (P18-10):** 증거 카드의 목격자 없음은 `eyeOff` 아이콘 24 하나로 보여 준다. 접근성 이름은 "목격자 없음"이고 `data-lastseen-count="0"` 은 유지한다.

**검증·배포 (SC-5)**
- **D-11:** 바뀐 흐름만 로컬 폰 6종으로 E2E 를 돌린다(avatar-dress·tutorial solo/together·errand·witness·emcee-band·night·result). 전체 회귀는 페이즈 끝에 한 번만 돌린다. 실행이 끝나면 Claude 가 minifia-v3 에 배포하고, 배포본 smoke 와 바뀐 흐름으로 확인한다. 실기기 항목은 v3.0 실테스트로 미룬다.

### Claude's Discretion
- 조명 값은 허용 범위 안에서 미세 조정한다. 도윤 자리 좌표, 스포트라이트 z 순서, 튜토리얼 고정 카메라를 주는 경로는 계획 단계가 정한다.

### Deferred Ideas (OUT OF SCOPE)
- 입장 때 빈 옷을 자동 배정해 대기실에서도 모두 다르게 보이게 하는 안. 지금은 시작 때 푸는 방식으로 충분하다. 필요하면 실테스트 뒤 검토한다.
- 튜토리얼을 실제 판의 축소판으로 다시 짜는 것(조사 4-4 #6, 0081 "정하지 않은 것")은 21페이즈 새 흐름 뒤에 한다.
</user_constraints>

<phase_requirements>
## Phase Requirements

이 페이즈에는 REQUIREMENTS.md 에 매핑된 요구사항 ID 가 없다(로드맵 "Requirements: TBD"). 성공 기준 5개와 결정 D-01~D-11 을 ID 대신 쓴다. 계획 단계가 PLAN 의 `requirements` 칸에 임시 ID(`QF-01`~`QF-05` 등)를 붙이면 된다.

| ID | Description | Research Support |
|----|-------------|------------------|
| SC-1 | 한 판 안에서 같은 옷 없음(시작 때 해소 + 옷장 잠금), 흔적 같은 옷 표시 ≤ 1명 | "옷 중복" 절 — `look.ts`·`beginGame`·`DressSheet`·`traceMark.ts` 의 실제 줄 번호와 코드 예 |
| SC-2 | 낮·밤 조명이 장면만 보고 구분(낮 채도 낮게), 튜토리얼 낮 장면 포함 | "조명" 절 — `PhaseTune.moonColor`, 허용 범위 계산 결과(UI-SPEC 시작값 3곳이 자기 범위를 어김), 깨지는 기존 시험 |
| SC-3 | 스포트라이트·아래 가운데 [다음]·채팅/입력줄/[내 역할] 숨김·장면 5 선 안쪽·시민 문구 | "튜토리얼" 절 — `FocusRing`·`TutorialScreen`·`GameMap`·`TutorialEvidence`·`tutorial.css` 구조와 접근 경로 |
| SC-4 | "밤 대화가 공개돼요" 삭제, "이름표"→"얼굴", "눈 0"→`eyeOff` | "낡은 문구" 절 — 바꿀 파일·시험·E2E 표 전부 |
| SC-5 | 바뀐 흐름 E2E 통과 + minifia-v3 배포 | "Validation Architecture"·"Environment Availability" |
</phase_requirements>

## Summary

이 페이즈는 새 라이브러리도 새 화면도 없는 **기존 코드 수술**이다. 다섯 갈래(옷·조명·튜토리얼·문구·검증)가 서로 거의 독립이라 병렬 계획이 가능하다. 가장 위험한 곳은 (1) 옷 해소를 `beginGame` 에 넣을 때 기존 시험 몇 개(특히 `test/worker/leak.test.ts:1077`)가 "look 은 대본에 있는 좌석에만 있다"를 가정한다는 점, (2) 조명 허용 범위를 UI-SPEC 시작값이 스스로 어긴다는 점, (3) 튜토리얼 [다음]을 아래 가운데로 옮길 때 `tut-fadeup` 애니메이션의 `transform` 과 가운데 정렬 `translateX(-50%)` 이 충돌한다는 점, (4) E2E `tutorial.mjs` 의 TT1 이 머리 단추([내 역할])가 있다고 가정한다는 점이다.

조명은 코드 구조상 간단하다. `PhaseTune`(bar.ts:51~72)에 `moonColor` 한 칸을 더하고 `applyLook`(plaza.ts:~459, bar.ts 같은 이름)이 `moon.color.set(t.moonColor)` 를 호출하면 된다. 그러나 **UI-SPEC 의 시작값 3곳이 UI-SPEC 의 허용 범위를 어긴다**(광장 `vote` sky[0] 채도 0.333, 바 `morning` sky[0] 채도 0.211, 광장 `morning` `moonColor` `#dcd8e0` 은 R<B). 허용 범위 시험이 곧 계약이므로 시험을 통과하는 값으로 시작해야 한다(아래 계산표). 또 기존 시험 `plazaScene.test.ts:179-191`(낮 하늘 휘도 ≤ 0.3, 배경 ≤ 0.1, `#8a8496` 근처)과 `barScene.test.ts:163-164`·`:83` 은 새 값과 모순되어 **계획이 이 시험들을 새 허용 범위 시험으로 교체해야 한다**.

튜토리얼은 `GameMap` 에 prop 두 개(`panelless`, `camera`)를 더하는 것이 가장 작은 변경이다. `cameraModeOf`(presence.ts)와 `sceneLook` 은 건드리지 않고 `GameMap` 의 `scene` useMemo 에서 카메라만 덮어쓰면 실제 판 영향이 0 이다. 스포트라이트는 `FocusRing` 이 이미 쥐고 있는 측정 상자(`Box`)를 재사용한다.

**Primary recommendation:** 서버 쪽 순수 함수 두 개(`resolveLookConflicts`·`lockedOutfits`)를 `shared/game/look.ts` 한 곳에 두고 서버(`beginGame`·`setLook`)와 클라이언트(`Lobby`·`ResultScreen` → `DressSheet`)가 같이 쓴다. 조명은 값 표 + 단위 시험(허용 범위 1~3)을 **먼저** 만들고 렌더 휘도 순서(4·5)는 갤러리 촬영 백스톱으로 첫 계획에서 한 번 재서 값을 확정한다. 튜토리얼은 `GameMap` prop 2개 + `FocusRing` 확장 + CSS 로 끝낸다.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 시작 때 겹친 옷 해소 | API / Backend (방 DO, `shared/game`) | — | 규칙은 서버가 정한다(결정 0002). 클라이언트가 정하면 접속자마다 달라진다. 난수·역할을 읽지 않는 순수 함수 |
| `setLook` 이 남이 입은 옷 거절 | API / Backend | Browser (`useDress` 되돌림 1.2초) | 서버가 진실. 거절은 오류 없이 `state` 한 프레임(L30, 오라클 금지) |
| 옷장 잠금 표시 | Browser / Client | — | 방송된 `players[].look` 에서 매 렌더 계산(서버에 새 값 없음). 서버가 최종 거절하므로 표시는 편의다 |
| 낮·밤 조명 값 | Browser / Client (3D 장면 빌더) | — | 3D 는 전부 클라이언트. 서버는 단계만 보낸다 |
| 튜토리얼 스포트라이트·[다음]·숨김·선 | Browser / Client | — | 혼자 하기는 서버 0(정적 가드 `tutorialStaticGuard`). 함께 진행도 화면은 같은 클라이언트 부품 |
| 낡은 문구·`eyeOff` | Browser / Client (+ `src/game/hostLine.ts` 표) | E2E 표(`scripts/e2e/lib.mjs`) | 문구는 클라이언트 표 한 곳이고 시험·E2E 가 사본을 쥔다(`e2eContract` 가 일치를 고정) |
| E2E·배포 | 로컬 Chrome + Cloudflare Worker `minifia-v3` | — | 계정 게이트 `scripts/check-account.mjs` |

## Standard Stack

### Core (모두 이미 설치됨 — 새 패키지 없음)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react / react-dom | 19.3.1 | 화면 | `package.json` 고정 버전 [VERIFIED: package.json:26-27] |
| three | 0.186.1 | 3D 조명 (`DirectionalLight.color`, `HemisphereLight`) | `moon.color.set()` 는 표준 API, 셰이더 재컴파일 없음 [VERIFIED: package.json:28] |
| vitest | 4.1.12 | 단위·클라이언트·워커 시험 (projects `unit`·`client`·`worker`) | 17페이즈 검증과 같음 [VERIFIED: package.json:44, .planning/phases/17-tutorial-first-case/17-VALIDATION.md:19-26] |
| playwright-core | 1.64.1 | 로컬 E2E | 기존 `scripts/e2e/` [VERIFIED: package.json:41] |
| sharp | 0.35.5 | (선택) 갤러리 촬영 평균 휘도 계산 | 이미 devDependency, `scripts/make-og.mjs` 가 씀 [VERIFIED: package.json:42] |

### Supporting
해당 없음 — 이 페이즈에 새 외부 의존이 없다. 시험 도구는 기존 `test/helpers/*`, `scripts/e2e/lib.mjs` 의 순수 검사 함수 패턴을 따른다.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SVG `<mask>` 스포트라이트 | CSS `clip-path: path(evenodd …)` / 큰 `box-shadow` | 구멍이 겹치면(장면 6 이름표) evenodd 는 겹친 곳이 어두워진다 — UI-SPEC 이 mask 를 못박음 [CITED: 18-UI-SPEC.md "스포트라이트"] |
| `beginGame` 에서 해소 | 입장 때 자동 배정 | CONTEXT 가 Deferred 로 못박음 |

**Installation:** 없음.

**Version verification:** 새 패키지가 없어 레지스트리 조회 생략. 버전은 `package.json` 에서 직접 읽었다.

## Package Legitimacy Audit

이 페이즈는 외부 패키지를 설치하지 않는다 → 감사 표 해당 없음.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
[SC-1 옷]
 로비/결과 화면 ─(dress 메시지)→ 방 DO.applyDress ─→ setLook(state, actor, look)
      ▲                                 │  ├ 값·단계·같은 값 검사(기존)
      │ view.players[].look             │  └ NEW: 남이 "직접 고른" 옷이면 { ok:false } → 보낸 소켓에 state 한 프레임(오류 없음)
      │                                 ▼
 DressSheet(taken)  ←──────── lockedOutfits(view.players − 나)     [클라이언트 계산, 서버 값 추가 없음]

 [시작] → startGame / rematch / tutorial ─→ beginGame ─→ NEW resolveLookConflicts(players)  ─→ players[].role 부여
                                                         (직접 고른 옷 우선 → 좌석 오름차순 → 진 사람은 OUTFIT_IDS 첫 빈 옷, 난수 0)
 판 중: 흔적 조각 = TRACE_OF_OUTFIT[picker.look ?? coat]  ──→ sameOutfitSeats(players, piece) ≤ 1명

[SC-2 조명]
 view.phase ─ lightingFor(view) ─→ runtime.ts setLighting(phase) ─→ plaza|bar.applyLook()
                                       └ NEW: PhaseTune.moonColor → moon.color.set(...)   (hemi·moon 세기·sky 값은 표만 바뀜)
 튜토리얼 지도 장면 2~6 = 실제 GameMap + 가짜 view → 같은 표를 지난다 / 무대 장면 1·7 = tutorialStageLook(night 여부)

[SC-3 튜토리얼]
 TutorialScreen ─ scene n ─┬ GameMap(view, roleCard=undefined, panelless, camera=고정[n=2,5,6])
                           ├ renderSceneLayer: 눈 표시·기록 카드 / 선+수식 / 정체 공개 / 직업 카드
                           ├ FocusRing(groups, lit) ─ 측정 Box ─┬ 포커스 상자(깜빡 4px)
                           │                                    └ NEW 스포트라이트 SVG mask (구멍 = Box 합집합)
                           └ TutorialNext (아래 가운데 알약 240×56)
```

### Recommended Project Structure (변경 파일만)
```
shared/game/look.ts            # + lockedOutfits, resolveLookConflicts, setLook 잠금 거절
shared/game/room.ts            # beginGame: players 에 resolveLookConflicts 적용
src/components/v2/DressSheet.tsx, V2Icon.tsx(lock, eyeOff), EvidenceCard.tsx, FocusRing.tsx, TutorialNext.tsx, TutorialRoleCards.tsx, TutorialEvidence.tsx
src/screens/Lobby.tsx, ResultScreen.tsx, GameMap.tsx(prop 2개), TutorialScreen.tsx, RoleReveal.tsx
src/game/tutorialScript.ts(TUTORIAL_SPOTS[1], 고정 카메라 상수), hostLine.ts, resultText.ts(PRE_NOTICE_MS 삭제), dressText.ts
src/world/maps/plaza.ts, bar.ts                  # PhaseTune.moonColor + 값 표 + applyLook
src/styles/tutorial.css, v2.css(.mv-dress-card[data-taken]), evidence.css, phase.css(.mf-reveal__pre 삭제)
scripts/e2e/lib.mjs(+lib.test.mjs), tutorial.mjs, avatar.mjs, browser.mjs(읽기 함수 필드)
docs/screen-map.md, HANDOFF.md, (필요 시) docs/decisions/0081 끝 한 줄
```

### Pattern 1: 옷 중복 해소 — 순수 함수를 `look.ts` 한 곳에 (SC-1)

**What:** 해소·잠금 계산을 `shared/game/look.ts` 에 둔다. 이 모듈은 "`.role` 속성 접근이 없다"는 소스 시험이 걸려 있다(`test/unit/look.test.ts` 마지막 describe). 입력은 `seat`·`look` 뿐이다.

**검증한 현재 코드:**
- `look.ts:10` `export const DEFAULT_LOOK: OutfitId = "coat";` [VERIFIED: shared/game/look.ts:10]
- `look.ts:28` `if ((actor.look ?? DEFAULT_LOOK) === look) return { ok: true, state };` — 같은 값은 입력 그대로(저장·전송 0). 그래서 **look 이 없는 사람이 coat 를 눌러도 "직접 고른 coat"가 되지 않는다**(look 키가 계속 없음). 반대로 hood 를 입었다가 coat 를 고르면 `look: "coat"` 가 저장된다(look.test.ts 가 고정). 이 비대칭이 P18-1 의 "직접 고른 옷 우선"이 쓰는 신호다. [VERIFIED: shared/game/look.ts:19-31, test/unit/look.test.ts "다른 의상을 고른 사람이 coat 로 돌아가면 look 이 coat 로 저장된다"]
- `OUTFIT_IDS`: `export const OUTFIT_IDS = ["coat", "police", "doctor", "mafia", "detective", "reporter", "elder", "hood", "noir"] as const;` — 9벌, 최대 8명이라 항상 풀린다. [VERIFIED: shared/protocol.ts:483]
- `TRACE_OF_OUTFIT` 은 9벌이 9개 서로 다른 조각에 일대일(`coat:"button"` … `noir:"redCloth"`)이라 **옷이 유일하면 같은 옷 표시도 많아야 1명**이다. [VERIFIED: shared/game/trace.ts:16-26]
- `beginGame` 은 `shared/game/room.ts:423` 에서 시작하고 `players: state.players.map((p) => ({ ...p, role: roles.get(p.id) })),`(room.ts:446)로 끝난다. `startGame`(room.ts:405~414)·`rematch`(rematch.ts 끝 `beginGame(fresh, …)`)·튜토리얼 시작(`opts.tutorial`)이 모두 이 함수를 지난다. 테스트 방 봇은 `look` 키 없이 만들어지므로(testTools.ts:~289-297) 8명 모두 coat 가 되는 경우가 실제로 있다. [VERIFIED: shared/game/room.ts:405-446, shared/game/rematch.ts, shared/game/testTools.ts:289-297]
- 난수 순서: `assignRoles` → 테스트 방 맞바꿈 → `decideMap`. 해소 함수는 `randInt` 를 받지 않으므로 순서가 불변이다. [VERIFIED: shared/game/room.ts:423-440]
- `REMATCH_PLAYER_KEYS` 에 `"look"` 이 있어(`rematch.ts:17`) 바뀐 옷이 다음 대기실에 남는다. 쉬는 사람(bench)도 `look` 을 가진 채 쉬다가 다음 `rematch` 의 참가자가 되므로 **대기실 잠금만으로는 겹침이 못 막힌다 — 시작 때 해소가 필수**다. [VERIFIED: shared/game/rematch.ts:17-22]

**Example (제안 구현, 2-pass로 결정적):**
```ts
// shared/game/look.ts — seat·look 만 읽는다(L25). 난수·시각·역할 없음.
/** 다른 사람이 직접 고른(look 값이 있는) 옷의 집합. 호출 쪽이 "나"를 뺀 목록을 넘긴다. */
export function lockedOutfits(others: ReadonlyArray<{ look?: OutfitId }>): ReadonlySet<OutfitId> {
  return new Set(others.flatMap((p) => (p.look === undefined ? [] : [p.look])));
}

/** 시작 순간 겹친 옷 풀기. 바뀐 사람이 없으면 같은 배열을 돌려준다(동일성). */
export function resolveLookConflicts<P extends { seat: number; look?: OutfitId }>(players: readonly P[]): readonly P[] {
  const ranked = [...players].sort((a, b) => Number(a.look === undefined) - Number(b.look === undefined) || a.seat - b.seat);
  const keeper = new Map<OutfitId, number>(); // 옷 → 지키는 좌석(1패스: 모든 승자를 먼저 정한다)
  for (const p of ranked) {
    const o = p.look ?? DEFAULT_LOOK;
    if (!keeper.has(o)) keeper.set(o, p.seat);
  }
  const used = new Set(keeper.keys());
  const swap = new Map<number, OutfitId>();
  for (const p of ranked) { // 2패스: 진 사람에게 OUTFIT_IDS 순서의 첫 빈 옷
    if (keeper.get(p.look ?? DEFAULT_LOOK) === p.seat) continue;
    const free = OUTFIT_IDS.find((id) => !used.has(id));
    if (free === undefined) continue; // 최대 8명 < 9벌이라 오지 않는다
    used.add(free);
    swap.set(p.seat, free);
  }
  return swap.size === 0 ? players : players.map((p) => (swap.has(p.seat) ? { ...p, look: swap.get(p.seat)! } : p));
}
// room.ts beginGame: players: resolveLookConflicts(state.players).map((p) => ({ ...p, role: roles.get(p.id) })),
```
**왜 2패스인가:** 1패스(순서대로 보며 빈 옷 배정)는 "겹친 직접 고른 옷"이 옛 상태에 있을 때 진 사람이 뒤 좌석이 직접 고른 옷을 가로채 연쇄 변경을 만든다. 승자를 먼저 모두 정하면 결과가 입력 순서·역할과 무관하다.

**`setLook` 잠금(서버):** 같은 값 검사(look.ts:28) **뒤**에 `lockedOutfits(state.players.filter((p) => p.id !== actorId)).has(look)` 이면 `{ ok: false, error: "BAD_MESSAGE" }`. DO 의 `applyDress`(worker/room.ts:580~)는 `!result.ok` 이면 이유와 무관하게 "보낸 소켓에 자기 state 한 프레임"만 보내므로 오류 프레임·거절 문구가 없다(L30 충족). 이 응답은 250ms 간격 위반과 같은 응답이다. [VERIFIED: worker/room.ts:580-592 — `if (result === null || !result.ok) { this.sendTo(ws, { t: "state", view: buildView(this.room, playerId, now) }); return; }`]
- 대안: `{ ok: true, state }`(무변화)로 돌려 프레임 0 으로 버리는 길. 클라이언트 되돌림이 1.2초(`DRESS_REVERT_MS`) 타이머뿐이라 첫 길(state 한 프레임)이 더 빨리 맞춘다. **권고: `ok:false`.**

**클라이언트:** `Lobby.tsx:243`·`ResultScreen.tsx:603` 의 `<DressSheet … />` 에 `taken={lockedOutfits(view.players.filter(p => p.seat !== view.me.seat))}` 를 `useMemo` 로 넘긴다. 서버 `view.players` 를 쓰고 `useDress` 의 미리 보기(`stageView`)는 쓰지 않는다(내 미리 보기가 잠금에 섞이지 않게). `DressSheet` 는 `taken?: ReadonlySet<OutfitId>` prop, 카드에 `data-taken`·`aria-disabled="true"`·`onClick` 가드·접근성 이름 `"{옷 이름}, 다른 참가자가 입고 있음"`(→ `dressText.ts` 에 조각 상수)·자물쇠 `V2Icon name="lock" size={16}`(선택 체크와 같은 자리 `top:4px; right:4px`)를 더한다. CSS 는 `.mv-dress-card[aria-disabled="true"]{opacity:.45}` 가 이미 있다(v2.css:398). [VERIFIED: src/styles/v2.css:393-398]
- 결과 단계(`ended`)에서 `left:true` 로 표시된 나간 사람은 `players` 에 남아(room.ts leaveRoom, `ended` 분기) 다음 `rematch` 가 걷어 갈 때까지 옷을 잠근다. UI-SPEC "좌석이 있는 동안 잠근다"와 같고 서버·클라이언트가 같은 `state.players`/`view.players` 를 읽어 일치한다. [VERIFIED: shared/game/room.ts:335-352, shared/game/view.ts:216-231]

### Pattern 2: `PhaseTune.moonColor` + 허용 범위 시험 (SC-2)

**What:** `PhaseTune`(bar.ts:51~72)에 `moonColor: string` 을 **필수** 칸으로 더한다(타입이 모든 행 갱신을 강제). 밤 계열 4행(`trial`·`night`·`nightCitizen`·`nightGhost`)은 `TOKEN_COLORS.moon`(`#c9d4ff`, palette.ts:16)과 같은 값. `applyLook` 에 `moon.color.set(t.moonColor);` 한 줄. 새 광원이 아니라 색만 바뀌므로 셰이더 재컴파일 없다(`light` 개수 불변). [VERIFIED: src/world/maps/plaza.ts:395-398 `const moon = new DirectionalLight(TOKEN_COLORS.moon, T.talk.moon);`, bar.ts:567 같음, plaza.ts `applyLook` 에 `moon.intensity = t.moon;`]

**주의:** `applyLook()` 은 장면 생성 때가 아니라 `setLighting`/`setTension`/`applyBudget` 에서만 불린다(plaza.ts:512·530, bar.ts:669·687). 생성 직후 광원 색은 `TOKEN_COLORS.moon` 이다. 첫 프레임에 `runtime.ts:1249-1252` 가 `lightSent`(null)와 달라 `setLighting` 을 부르므로 실사용에서는 곧 맞춰지지만, 시험·일관성을 위해 생성자를 `new DirectionalLight(T.talk.moonColor, T.talk.moon)` 로 바꾸고 `barScene.test.ts:83`(`expect("#" + moon.color.getHexString()).toBe(TOKEN_COLORS.moon)`)을 새 talk 값으로 갱신한다.

**UI-SPEC 시작값이 UI-SPEC 허용 범위를 어기는 곳 (직접 계산, `[VERIFIED: node 계산]`):**

| 칸 | UI-SPEC 시작값 | 계산 | 범위 | 권고 시작값(계산 통과) |
|----|---------------|------|------|------------------------|
| 광장 `vote` sky[0] | `#5c5078` | 채도 **0.333** | ≤ 0.20 | `#625e72` (0.175) |
| 바 `morning` sky[0] | `#7c7898` | 채도 **0.211** | ≤ 0.20 | `#7e7a96` (0.187) |
| 광장 `morning` moonColor | `#dcd8e0` | R=220 < B=224 | R ≥ B | `#e0dad8` (R≥B) |
| 광장 `talk` sky[0] / sky[2] | `#aaa4b8` / `#807a8e` | 채도 0.109 / 배경 휘도비 **56.6배** | ≤0.20 / ≥8배 | 그대로 OK |
| 광장 `morning` sky[0] / sky[2] | `#9a96ae` / `#6a6680` | 0.138 / 39.0배 | 〃 | 그대로 OK |
| 바 `talk` sky[0] / sky[2] | `#908aa4` / `#38324a` | 0.159 / **10.0배** | ≤0.20 / ≥6배 | 그대로 OK |
| 바 `morning` sky[2] | `#322c40` | 7.9배 | ≥6배 | OK |
| `moonColor` 따뜻함 `#eadfd0`·`#d8b48a` | — | R≥B | — | OK |

(휘도비 = 밤 `sky[2]` `#0a0b16` 대비 sRGB 상대 휘도. 현재 광장 `talk` 하늘 `#8a8496` 채도 0.120, 배경비는 이미 8.9배 — 원래 문제는 `moonColor` 남색과 낮은 세기였고, 배경색은 부차적이다.)

**깨지는 기존 시험 (계획이 같이 고쳐야 함):**
- `test/unit/plazaScene.test.ts:179-191` — `talk` 하늘이 `#8a8496` 근처(합 거리 < 0.2), `lum(sky) ≤ 0.3`, `lum(bg) ≤ 0.1`, 파랑 비지배. 새 `#aaa4b8`: 거리 **0.463**, 휘도 **0.386**; 새 배경 `#807a8e` 휘도 **0.205** → 세 단언이 실패한다 [VERIFIED: node + three Color 계산]. 이 `it` 를 허용 범위 1~3 시험으로 **교체**한다.
- `test/unit/plazaScene.test.ts:175`·`:195` — 키 집합이 bar 와 같아야 함(`moonColor` 를 양쪽에 같이 더하면 통과), "모든 단계 sky ≤ talk" 는 새 값에서도 성립(talk 가 가장 밝음).
- `test/unit/barScene.test.ts:163-164` — `LIGHT_TUNE.talk.sky toEqual ["#524b84", "#2a2034", "#15111f"]` 등 정확값 2줄, `:83` moon.color. 새 값으로 갱신. `:309` "새 단계 하늘 ≤ talk"는 `trial`·`night`·`morning` 만 보므로 통과.
- 시험이 읽는 값 상수: `PLAZA_CLOCK_HOURS`(plaza.ts:163)·emissive·fog·exposure 는 안 바뀐다.

**허용 범위 4번(렌더 휘도 순서)의 위험 `[ASSUMED]`:** `vote` 는 가로등(`pendant LAMP_ON = 4`)·무대 점광원(8)·가로등 빛 무리(additive glow)가 켜져 있어, 반구·달빛 세기를 UI-SPEC 대로 올린 `morning` 보다 **렌더 평균 휘도가 높게 나올 수 있다**(`talk > morning > vote > night` 와 `morning ≥ 1.6×night` 중 `morning > vote` 가 가장 위험). 계획의 첫 작업이 갤러리 촬영으로 이 순서를 재고(`talk`·`morning`·`vote`·`night` 같은 카메라), 어기면 `vote` 의 `hemi`/`moon`/sky 를 낮추는 쪽으로 값을 조정한다(밤 값은 불변). `sharp` 의 `stats().channels` 로 평균 휘도를 낼 수 있다.

**튜토리얼 낮 장면:** `lightingFor`(presence.ts:147)·`lightingOf`(presence.ts:123)가 `morning`→morning, `nomination`→vote, `night`→night, 그 외(`errand` 포함)→talk 를 정한다. 장면 2·5(가짜 view 단계 `morning`)=morning, 3·4(`errand`)=talk, 6(`nomination`)=vote 라 **별도 튜토리얼 조명 코드가 없다**. 무대 장면(1·7)은 `tutorialStageLook` 이 `lighting: s.night ? "night" : "talk"`(tutorialScript.ts:296)로 정한다. [VERIFIED: src/world/presence.ts:123-148, src/game/tutorialScript.ts:296]

### Pattern 3: 튜토리얼 — `GameMap` prop 두 개 + `FocusRing` 확장 (SC-3)

**panelless 확장 (D-06):** `GameMap.tsx:215` `const panelless = view.phase === "errand";` 와 `:216` `useMapInsets(blockModeOf(view) !== null, panelless)`. 패널 렌더는 `{view.phase === "errand" ? (<>ErrandStartCard/ErrandDots</>) : (<GamePanel …/>)}`(GameMap 약 :910~). 권고: `GameMapProps` 에 `panelless?: boolean` 를 더해 `const noPanel = view.phase === "errand" || panelless === true;` 로 `useMapInsets` 와 분기를 같이 바꾸고, 패널 분기는 `errand` 는 점·카드를 그리고 그 외 `noPanel` 은 `null`. `useMapInsets` 는 이미 `panel === null && panelless` 를 처리한다(useMapInsets.ts:82-86·112, `mapInsetsPanelless.test.tsx` 가 고정). [VERIFIED: src/screens/GameMap.tsx:215-216, src/net/useMapInsets.ts:56-121]
- `[내 역할]` 단추: `GameMap.tsx:856` `{roleCard ? <RoleCardButton iconOnly … /> : null}` — `TutorialScreen.tsx:417,425` 가 `roleCard` 를 넘기므로 **그 prop 을 빼기만 하면** 사라진다(`roleCard` memo·`noop` 정리). 머리의 기록 단추(`witnessRows !== null` 때)는 별개다(장면 4 에서 나올 수 있음 — 숨김 범위에 넣을지 계획이 `data-record-button` E2E 기대와 함께 결정, UI-SPEC 은 "채팅 칸·입력줄·내 역할"만 요구).
- 허용 목록 `ALWAYS_BLOCKED`(TutorialScreen.tsx:109)는 없는 요소 선택자를 무해하게 둔다(UI-SPEC). `tutorialGate.test.tsx` 의 `.mf-game__header`·`.mf-world__input`·`[data-world-panel]`·`[data-side-column]` 기대는 그대로 통과한다(패널 선택자는 이 시험에 없음 — grep 확인).

**고정 카메라 (D-07):** `cameraModeOf`(presence.ts, `FIXED_PHASES` 밖이면 `follow`)는 **건드리지 않는다**. `GameMap.tsx:833` 의 `scene` useMemo 에 `camera?: CameraMode` prop 을 받아 `{ ...sceneLook(...), ...(camera ? { camera } : {}) }` 로 덮는다. 튜토리얼 상수는 `tutorialScript.ts` 에 `TUTORIAL_FIXED_CAMERA: CameraMode = { mode: "fixed", target: GATHER_CENTER 값 또는 {x,z}, zoom: 1 }` 로 두고(`CameraMode` 는 type-only import 라 정적 가드 통과), `TutorialScreen` 이 `cur.n` 이 2·5·6 일 때만 넘긴다. 지목(`nomination`)이 이미 쓰는 구도가 `GATHER_CENTER`(camera.ts:70)다. 장면 3·4 는 `undefined` → 지금처럼 나를 따라간다. [VERIFIED: src/world/presence.ts:19-20 `CameraMode`, :105-113, :168-186 `sceneLook`, src/world/camera.ts:70]

**스포트라이트 (D-04):** `FocusRing.tsx` 의 `measure()` 는 이미 대상 사각형 + 사방 8 + 화면 안쪽 8 clamp 를 구해 `Box { left, top, width, height, radius }` 를 만든다(`radius` 는 문자열 `"var(--radius-pill)"` 또는 `"{n}px"`). 구멍을 같은 `Box` 로 뚫으면 "포커스 상자 사각형과 같다"가 자동 성립하고 대상 미측정이면 구멍·막도 없다(Pitfall 11 규칙). 구현 순서:
1. `FocusGroup` 에 `lit?: readonly string[]`(구멍만, 상자 없음)·`Box` 에 숫자 반지름(`rx`)을 더한다(pill 은 `height/2`).
2. `FocusRing` 이 `groups` 가 하나라도 있고 `boxes` 가 하나라도 측정됐을 때만 `<svg className="tut-dim" data-tutorial-dim="" aria-hidden="true">` 를 렌더(상자들과 함께). `lit` 요소 사각형은 같은 `measure` 로 따로 잰다.
3. 마스크 id 는 **상수 하나**(`tut-dim-mask`)로 둔다(`useId()` 는 `:r1:` 처럼 콜론이 들어가 `url(#…)` 참조가 불안정하고, 이 층은 화면에 하나뿐이다).
4. 장면 5·7·[다음] 차례·정체 공개에서는 `focusGroups` 가 비어 있으므로(TutorialScreen.tsx:~358 `const focusGroups = …`) 자동으로 꺼진다. 단 **[다음] 구간에 포커스 창이 남아 있는 장면**(장면 2 는 띠 창이 2.6초에 끝나 [다음] 이 그 뒤에 나온다, 장면 4 도 1.9~3.4초 창 뒤 [다음])은 창 종료 시점과 [다음] 표시 시점이 일치하는지 시험이 확인해야 한다(UI-SPEC "[다음] 구간에는 0개").
```tsx
// 구멍은 mask 안의 검은 사각형들(겹쳐도 밝게 남는다 — evenodd 불가). 층은 pointer-events:none·aria-hidden
<svg className="tut-dim" data-tutorial-dim="" aria-hidden="true" focusable="false">
  <defs>
    <mask id="tut-dim-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
      <rect x="0" y="0" width="100%" height="100%" fill="white" />
      {holes.map((h) => <rect key={h.key} x={h.left} y={h.top} width={h.width} height={h.height} rx={h.rx} fill="black" />)}
    </mask>
  </defs>
  <rect className="tut-dim__fill" x="0" y="0" width="100%" height="100%" fillOpacity={TUTORIAL_DIM_ALPHA} mask="url(#tut-dim-mask)" />
</svg>
/* tutorial.css: .tut-dim{position:fixed;inset:0;width:100%;height:100%;z-index:var(--z-overlay);pointer-events:none}
   .tut-dim__fill{fill:var(--night-950)}  — hex 금지, 애니메이션은 opacity 만 */
```
- 쌓임(z): 기존 값 — 헤더 `--z-toast`(40, game.css:15), 증거 카드 45(`calc(var(--z-toast)+5)`, game.css:60), 목격 기록 카드 `--z-overlay`(50, game.css:57), 사회자 띠 51(v2.css:165), 포커스 상자 52(tutorial.css:21), 진행 점·[다음] 53(tutorial.css:47·71), 눈 표시·선·수식·직업 카드 `--z-overlay`(50). 스포트라이트를 `--z-overlay`(50)로 두고 DOM 에서 `renderSceneLayer` 뒤·`FocusRing` 안에 두면(현재 순서 그대로) 띠(51)·포커스(52)·[다음](53) 아래, 맵·이름표·헤더·증거(45) 위가 된다. 장면 4 의 눈 표시(50)·기록 카드(50)는 같은 z 라 DOM 순서로 스포트라이트가 위에 오므로 **`lit` 구멍이 필요하다**(UI-SPEC 과 일치). **`.mf-room__body`·`main.mf-game` 이 쌓임 맥락을 만드는지는 코드로 확정하지 못했다 `[ASSUMED]` — 첫 렌더 갤러리로 헤더(40)가 어두워지는지 확인한다.**
- 모션 줄이기: 켜짐·꺼짐 전환 없음(마운트/언마운트 즉시). 평상시는 `opacity` 페이드 인만(애니메이션 `transform`·`opacity` 한정, 정적 가드 CSS 규칙은 진홍 한정이라 문제 없음).
- 성능: 측정은 이미 rAF 루프이고 `same()` 이면 상태를 안 바꾼다(FocusRing.tsx `same`, T-17-11). 마스크는 `boxes` 가 바뀔 때만 다시 그려진다.

**[다음] 글 단추 (D-05):** `TutorialNext.tsx` 는 지금 `<V2Icon chevronRight size={24}>` 만 담은 56 원이다. 알약 240×56 으로 바꾸고 안에 `<span>다음</span>` + `chevronRight 20`. `.tut-next`(tutorial.css:67~84)에서 `right:20px; width:56px; border-radius:50%` → 가운데 정렬 알약. **함정:** 중앙 정렬을 `left:50%; transform:translateX(-50%)` 로 하면 `tut-fadeup`(tutorial.css:162, `transform: translateY(8px)→0`)과 충돌한다 — `left:0; right:0; margin-inline:auto; width:min(240px, calc(100% - 48px))` 로 정렬한다. 기존 시험 `tutorialScenes.test.tsx:362-368` 은 `.tut-next` 규칙에서 `bottom:` 과 `height:` 를 `\d+px` 로 읽어 수식 줄 `bottom: 96px` 과 비교하므로 **`bottom: 28px; height: 56px` 리터럴을 유지**한다. `.tut-next::before` 는 `border-radius: inherit`(알약)로 바꾸고 `tut-ring` 애니메이션 유지, 모션 줄이기 규칙(tutorial.css:391)은 그대로. 접근성 이름 "다음"(`aria-label="다음"`)과 `data-tutorial-next` 유지(E2E·`tutorialGate` 가 읽음).
- P18-11: `[data-tutorial-screen]:has([data-tutorial-next]) .mv-errand-dots { display: none; }` 한 줄. `:has()` 는 이미 저장소에서 쓴다(v2.css:131·436·437). 점은 `z-index: var(--z-tags)`·`bottom: calc(40px + safe-area)`(v2.css:470)라 [다음](53) 아래에서 겹치므로 숨김이 맞다.
- 장면 7 직업 카드: `.tut-roles` 아래 예약 96(`padding-bottom`)을 더한다(tutorial.css:298~).

**장면 5 선 (D-07):** `TutorialEvidence.tsx` `measureLines`(약 :112~)가 `to: [tag.left + tag.width*at, tag.top - 2]` 를 화면 좌표로 그린다. 계약: 시작·끝·제어점을 `[8, innerWidth-8] × [8, innerHeight-8]` 로 clamp 하고(순수 함수 `clampPoint`로 분리해 단위 시험) `.tut-links{overflow:visible}`(tutorial.css:139)를 `hidden` 으로. `curve()`는 제어점이 두 끝점의 x 와 같으므로 끝점이 안에 있으면 곡선도 안에 있다. **도윤 자리**: `TUTORIAL_SPOTS[1] = { x: 1.3, z: -2.3 }`(tutorialScript.ts:302-309)만 안쪽으로. 값은 폰 6종 측정으로 정한다(UI-SPEC). 이 표는 장면 1·2·5·6·7 이 공유하고 `tutorialScript.test.ts:466` "모든 snap 자리는 광장 맵에서 걸을 수 있는 곳이다"가 걸러 준다. 도윤을 안쪽으로 옮기면 좌석 4 `(2.6, 0)`·좌석 5(나) `(1.3, 2.3)` 이름표와 겹칠 수 있어 **E2E TD(겹침) 측정이 필수**다. [VERIFIED: src/components/v2/TutorialEvidence.tsx, src/styles/tutorial.css:139, src/game/tutorialScript.ts:302-309]

**직업 카드 문구 (D-08):** `TutorialRoleCards.tsx:28-33` 의 `CARDS` 네 줄의 `line` 을 `ROLE_TEXT[kind].desc` 로 읽는다(`kind` 가 `"citizen"|"mafia"|"doctor"|"police"` 로 `RoleId` 와 같은 값). `src/game/roleText.ts` 의 `ROLE_TEXT`(roleText.ts:5-10)는 이렇다: `mafia: { name: "마피아", desc: "밤에 함께 한 명을 지목해요", … }`, `police: … desc: "밤마다 한 명을 조사해요"`, `doctor: … desc: "밤에 한 명을 살려요"`, `citizen: … desc: "대화와 투표로 마피아를 찾아요"`. 이 모듈은 타입만 import(`RoleId`, `RoomView`)하므로 정적 가드 `FORBIDDEN` 의 어느 정규식(`me.role`·`p.role`·`players…role` 등)에도 걸리지 않는다. 기존 시험 `tutorialOpening.test.tsx:261` 의 `LINES` 4개를 `ROLE_TEXT` 에서 계산하도록 바꾼다. [VERIFIED: src/game/roleText.ts:5-10, src/components/v2/TutorialRoleCards.tsx:28-33, test/unit/tutorialStaticGuard.test.ts:52-61]

### Pattern 4: 낡은 문구 정리 (SC-4)

| 대상 | 현재 위치 | 변경 | 같이 바꿀 시험·E2E |
|------|-----------|------|-------------------|
| 공개 예고 줄 | `src/screens/RoleReveal.tsx:66-70`(타이머)·`:86-90`(`<p data-pre-notice>`), `src/game/resultText.ts:30` `PRE_NOTICE_MS = 4000`, `src/styles/phase.css:70-72`(`.mf-reveal__pre`) | `<p>`·`noticeShown` 상태·`useEffect`·import(`PRE_NOTICE_MS`) 삭제. **`<div className="mf-reveal__hints">`는 빈 채로 유지**(padding 이 레이아웃을 지킴). `RESULT_PANEL_TEXT.preNotice`(resultText.ts:21)는 `LineSheet.tsx:92`가 쓰므로 **남긴다** | `test/client/phaseScreens.test.tsx:177`(`[data-pre-notice]` length 1 → 0), `:818~` "공개 예고" describe 전체(삭제 또는 "0개"로 교체). `whisperUi.test.tsx:622`(LineSheet)는 그대로 |
| 밤 띠 4문장 | `src/game/hostLine.ts:76-79` | "이름표를" → "얼굴을" (`nomination.act` hostLine.ts:66 은 그대로) | `test/unit/hostLine.test.ts:138-141`, `scripts/e2e/lib.mjs:2886-2888`(`HOST_ACT_LINES` mafia·police·doctor 3개 — citizen 은 없음), `test/unit/e2eContract.test.ts:683`(두 표 일치) |
| 눈 0 | `src/components/v2/EvidenceCard.tsx:45` `<span className="mv-evidence__zero">0</span>`, `src/styles/evidence.css:19` | `<V2Icon name="eyeOff" size={24} role="img" aria-label="목격자 없음">`(이미 앞에 `.mv-evidence__eye` 가 24 눈 아이콘을 그리므로 **"눈 + 0" 이 "눈 하나"**가 아니라 **"`eyeOff` 하나"**가 되도록 `mv-evidence__eye` 스팬 자체를 witness 유무로 분기). `.mv-evidence__zero` CSS 삭제 | `test/client/evidenceCard.test.tsx:59-60`, `test/client/recordTrace.test.tsx:434-435`, `scripts/e2e/browser.mjs:2104`(`.mv-evidence__zero` 선택자를 `.mv-evidence__eye` 등으로) |

- `V2Icon` 에 `lock`·`eyeOff` 추가: `V2IconName` 유니온(V2Icon.tsx:10)·`ICONS` 표에 UI-SPEC 경로 그대로(`lock`: `M6 11h12v9H6z` + `M8.5 11V8a3.5 3.5 0 0 1 7 0v3`; `eyeOff`: 기존 `eye` 경로 + `M4 4l16 16`). `eye` 경로는 `M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z` + 원(12,12,r3) [VERIFIED: src/components/v2/V2Icon.tsx:91-94]. `test/client/icon.test.tsx:176~` 의 `chevronRight` 같은 `describe` 패턴으로 두 아이콘 시험을 더한다(24×24 svg, 선 2, 둥근 끝, 다른 아이콘과 모양 구별).
- `role="img"` 를 `V2Icon` 에 직접 줄 수 있는지는 `V2Icon` props 를 확인해야 한다(계획 작업에서 `aria-label` 전달 방식을 `V2Icon` 시그니처로 확인; 안 되면 감싸는 `<span role="img" aria-label>`).

### Anti-Patterns to Avoid
- **`cameraModeOf` 수정**: 실제 판의 모든 단계 카메라가 바뀐다. 덮어쓰기는 `GameMap` prop 으로만.
- **`tut-next` 를 `transform` 으로 가운데 정렬**: `tut-fadeup` 과 충돌(위 함정).
- **스포트라이트에 `backdrop-filter`/`filter: blur`**: 0081·정적 규칙이 금지(흐림).
- **evenodd 한 경로 구멍**: 장면 6 이름표 겹침에서 구멍이 어두워진다.
- **옷 해소를 클라이언트에서**: 접속자마다 달라진다.
- **옷 잠금에서 기본 coat 포함**: 두 번째 입장자부터 옷이 없어진다.
- **`setLook` 거절에 오류 코드·문구 노출**: L30 오라클.
- **조명에서 재질(바닥·건물) 색 수정**: 밤 장면도 바뀐다.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 옷 해소·잠금 계산을 서버/클라이언트 각자 | 두 벌 구현 | `shared/game/look.ts` 순수 함수 하나를 import (서버 `beginGame`·`setLook`, 클라이언트 `Lobby`·`ResultScreen`) | 일치가 곧 "거절이 오라클 아님"의 전제 |
| 포커스 구멍 좌표 재측정 | 스포트라이트용 새 rAF·새 getBoundingClientRect | `FocusRing.measure()` 의 `Box` 재사용 | 같은 측정이라 "구멍 = 상자"가 구조적으로 보장, 측정 루프 하나 |
| 직업 카드 문구 | `TutorialRoleCards` 안 상수 | `ROLE_TEXT[role].desc` | 문구 두 곳 금지(D-08) |
| 밝기·채도·색온도 판정 | 눈대중 | 조명 표 단위 시험(`three` `Color` 로 휘도, 채도 `(max−min)/max`) + 갤러리 촬영 평균 휘도 | 허용 범위가 곧 계약 |
| 닫힌 아이콘 | 이모지·이미지 | `V2Icon` 에 선 경로 2개 추가 | 이모지 금지, 24 격자 일관 |

**Key insight:** 이 페이즈의 모든 변경은 "이미 있는 한 곳의 값이나 측정을 재사용"하는 것이다. 새 상태·새 측정·새 토큰·새 메시지가 거의 없다.

## Runtime State Inventory

이 페이즈는 리네임·마이그레이션이 아니다. 다만 **저장된 방 상태에 옛 형태가 남아 있는지**는 확인했다.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | 대기실에 저장된 방 상태(DO storage)는 `players[].look` 중복을 가질 수 있다(옛 판·봇). 해소는 시작 순간 읽는 쪽 규칙이라 **데이터 마이그레이션 불필요** | code edit 만 (`beginGame`). `normalizeStoredRoom` 무변경 |
| Live service config | 없음 — 이 페이즈는 외부 서비스 설정을 쓰지 않는다 | 없음 |
| OS-registered state | 없음 | 없음 |
| Secrets/env vars | 없음 | 없음 |
| Build artifacts | `dist/` 는 배포 때 `vite build` 가 다시 만든다 | 없음 |

## Common Pitfalls

### Pitfall 1: `leak.test.ts` 가 "look 은 대본 좌석에만 있다"를 가정
**What goes wrong:** `test/worker/leak.test.ts:1076-1077` 은 `if (pl.look !== undefined) expect(`${pl.seat}:${pl.look}`).toBe(`${pl.seat}:${dressScript.get(pl.seat)}`)` 로 **판 내내 look 이 대본(대기실에서 일부 좌석이 직접 고른 값)과 같다**고 단언한다. 해소가 default-coat 진 사람에게 `look` 을 새로 쓰면 이 단언이 실패한다. `:1080` 의 `base` 키 목록도 look 유무에 따라 달라진다.
**Why:** 해소는 `beginGame` 이 `look` 을 쓰는 첫 경로다.
**How to avoid:** 시험을 "해소 규칙으로 계산한 기대값과 같다"로 고친다(대본 + `resolveLookConflicts` 의 결과). 누설 증명 의도(역할과 무관)는 **역할 배정만 다른 두 판의 look 열이 같다**(`dress.test.ts` L25)로 유지되며 해소가 역할을 안 읽어 보존된다 — 이것을 해소 후 look 열에도 적용하는 시험을 더한다.
**Warning signs:** worker 시험 `leak.test.ts`·`view.test.ts` 실패.

### Pitfall 2: 허용 범위 시험이 UI-SPEC 시작값에서 바로 실패
**What goes wrong:** 위 표의 3곳(광장 vote 채도, 바 morning 채도, 광장 morning moonColor).
**How to avoid:** 계산표의 권고값으로 시작하고 `test/unit/lighting.test.ts`(신규)가 `PLAZA_LIGHT_TUNE`·`LIGHT_TUNE` 에 허용 범위 1~3 을 건다.

### Pitfall 3: 스포트라이트가 `lit` 요소를 어둡게 덮음
**What goes wrong:** 목격 기록 카드·눈 표시는 `--z-overlay`(50)라 같은 z 의 스포트라이트가 DOM 순서상 위에 온다.
**How to avoid:** `FocusGroup.lit`(구멍만)에 `.mf-game__record`·`[data-tutorial-eye]` 를 넣고, 시험으로 구멍이 상자 사각형 + lit 사각형 합집합을 덮는지(오차 2px) 확인.

### Pitfall 4: `tut-next` 가운데 정렬 vs `tut-fadeup`
위 Pattern 3. 가운데 정렬은 `margin-inline:auto` 로.

### Pitfall 5: E2E `tutorial.mjs` TT1 이 머리 단추를 필요로 함
**What goes wrong:** `scripts/e2e/tutorial.mjs:~232-250` 이 `document.querySelector(".mf-game__header button")` 를 눌러 보고 `taps.header !== null` 을 판정 조건에 넣는다(TT1: `stillScene3 && taps.empty !== null && taps.header !== null`). 지금 그 단추는 [내 역할]이라 **숨기면 `taps.header` 가 null → TT1 이 실패**한다.
**How to avoid:** 머리 단추가 없으면 "머리 영역(제목)의 좌표를 누른다"로 바꾸거나 TT1 의 머리 조건을 "[내 역할] 0개 확인"(TH1 신규)으로 바꾼다. [VERIFIED: scripts/e2e/tutorial.mjs:236-250 `taps.header`·TT1 판정]

### Pitfall 6: 도윤을 옮기면 다른 이름표와 겹침
`TUTORIAL_SPOTS` 는 장면 1·2·5·6·7 공유. 도윤만 옮기고 좌석 4·5 와의 거리를 E2E 가 재야 한다. `tutorialScript.test.ts:466` 걸을 수 있는 칸 시험 통과 필수.

### Pitfall 7: `AVATAR_MARKERS`·튜토리얼 표식 목록 동기화
`data-taken`·`data-tutorial-dim` 을 E2E 가 읽으려면 `scripts/e2e/lib.mjs` 의 표식 상수에 더하고 `lib.test.mjs:2680`(`deepEqual` 7개)·`test/unit/e2eContract.test.ts:359-362`(`length 7`, git 추적 src 에 문자열 존재)를 **같이** 고친다(안 그러면 "알 수 없는 표식" 판정이 실패).

### Pitfall 8: 광장 `morning` 의 `moonColor` 가 `vote` 보다 차가워 보이는 역전
UI-SPEC 의 순서 talk(`#eadfd0`) → morning(`#dcd8e0`) → vote(`#d8b48a`)는 색온도가 "따뜻 → 약간 차갑게 → 해질녘"이다. 권고 `#e0dad8` 도 같은 의도(R≥B 유지). 렌더로 최종 확인.

### Pitfall 9: `beginGame` 결과 identity
`resolveLookConflicts` 가 바뀐 사람이 없을 때 같은 배열을 돌려주면 `players.map(role)` 은 어차피 새 배열을 만든다 — 동일성은 이 함수 단위 시험용이다. `startGame` 의 `expiresAt` 계산(`room.ts:414`)과 무관.

## Code Examples

### 시험 예 — 해소 규칙 표 (단위)
```ts
// test/unit/look.test.ts 에 추가. 결과는 한 줄 문자열로 비교(TAP 증거 규칙, 기존 파일 관례)
it("8명 전원 기본: 좌석 0 이 coat 를 지키고 나머지는 OUTFIT_IDS 순서로 police,doctor,…", () => {
  const players = Array.from({ length: 8 }, (_, seat) => ({ seat }));
  const r = resolveLookConflicts(players);
  expect(r.map((p) => p.look ?? "-").join(",")).toBe("-,police,doctor,mafia,detective,reporter,elder,hood");
});
it("직접 고른 coat(좌석 3)가 기본 coat(좌석 0)보다 우선: 좌석 0 이 바뀐다", () => { /* … */ });
it("난수·역할을 읽지 않는다: 입력 좌석·look 만 같으면 결과가 같다", () => { /* 두 입력(역할만 다름) 동일 결과 */ });
```

### 시험 예 — 조명 허용 범위 (단위, `three` 설치됨)
```ts
// test/unit/lighting.test.ts (신규). Color 는 three 의 sRGB→선형 변환을 쓰므로 plazaScene.test.ts 의 lum 과 같은 식.
const sat = (hex: string) => { const c = new Color(hex).getHex(); const v = [(c >> 16) & 255, (c >> 8) & 255, c & 255]; return (Math.max(...v) - Math.min(...v)) / Math.max(...v); };
for (const [name, T, ratio] of [["plaza", PLAZA_LIGHT_TUNE, 8], ["bar", LIGHT_TUNE, 6]] as const) {
  it(`${name}: 낮·아침·저녁 sky[0] 채도 ≤ 0.20`, () => { for (const ph of ["talk", "morning", "vote"] as const) expect(sat(T[ph].sky[0])).toBeLessThanOrEqual(0.2); });
  it(`${name}: talk·morning 배경 휘도 ≥ night 의 ${ratio}배`, () => { /* lum(T.talk.sky[2]) / lum(T.night.sky[2]) */ });
  it(`${name}: moonColor 따뜻/차가움`, () => { /* talk·morning·vote R≥B, night·nightGhost B>R */ });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 낮에도 방향광이 달빛 남색 `#c9d4ff` 한 색 | 단계별 `PhaseTune.moonColor` | 이 페이즈 | 낮이 "밝은 남색"이 아니라 따뜻한 회색으로 읽힘 |
| 튜토리얼 배경 흐림·어둠 없음(0078-8) | 대상 밖 어둡게(흐림만 금지) | 0081 | 스포트라이트 SVG mask |
| 튜토리얼 [다음] 56 원 오른쪽 아래 | 아래 가운데 240×56 글 알약 | 이 페이즈 | 입력줄 보내기 단추와 구별 |

**Deprecated/outdated:** `PRE_NOTICE_MS`·`.mf-reveal__pre`·`.mv-evidence__zero` (삭제 대상).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 스포트라이트 z=`--z-overlay`(50)를 `FocusRing` 위치에 두면 헤더(40)·맵·이름표 위, 띠(51)·포커스(52)·[다음](53) 아래가 된다. `.mf-room__body`/`main.mf-game` 쌓임 맥락 여부는 코드로 확정 못 함 | Pattern 3 | 헤더가 안 어두워지거나 띠가 어두워질 수 있음 → 첫 렌더 갤러리에서 조정(z 값만) |
| A2 | UI-SPEC 시작값(채도·moonColor 보정 후)으로도 렌더 평균 휘도가 `talk > morning > vote > night` 와 2.0×·1.6× 를 만족한다. 특히 `vote`(가로등·무대 점광원 켜짐)가 `morning` 보다 어두운지 | Pattern 2 | 허용 범위 4 를 어김 → `vote` 의 hemi/moon/sky 를 낮춤(밤 값 불변). 첫 계획 작업에서 측정 |
| A3 | 낮 장면 머리 제목 gray-50 의 4.5:1 가독(규칙 5)은 기존 `mf-game__scrim` 그라데이션과 E2E H1(`headerContrastChecks`, flows.mjs:1420·tutorial.mjs:112)이 새 밝기에서도 통과한다 | Pattern 2 | H1 실패 → scrim 불투명도 또는 sky 조정(UI-SPEC 은 scrim 유지라고 못박음, 값 조정은 조명 쪽) |
| A3b | 숨김 범위에 장면 4 의 머리 [기록] 단추를 넣을지(UI-SPEC 은 "채팅 칸·입력줄·내 역할"만) | Pattern 3 | 범위 밖 해석 — 계획이 UI-SPEC 문구대로 [내 역할]만 뺀다고 정하면 됨 |
| A4 | `setLook` 거절에 `BAD_MESSAGE` 코드를 쓰는 것이 DO 가 오류 프레임으로 바꾸지 않는다(applyDress 가 `!result.ok` 를 모두 state 프레임으로 돌림) | Pattern 1 | 확인됨(`worker/room.ts:584-588`) — 위험 낮음, 워커 시험으로 고정 |
| A5 | `V2Icon` 이 `role`/`aria-label` 을 받는지 | Pattern 4 | 안 받으면 감싸는 `<span role="img">` |

## Open Questions

1. **UI-SPEC 시작값 3곳이 UI-SPEC 허용 범위를 어긴다 — 어느 쪽이 이기는가?**
   - What we know: CONTEXT D-03 은 "허용 범위 5개는 UI-SPEC 표 그대로, 시작값은 범위 안에서 조정 가능"이라 했다 — 범위가 이긴다.
   - What's unclear: 사용자가 vote 의 보랏빛(채도 0.33)을 의도했을 가능성(현재 vote 도 0.346).
   - Recommendation: 범위 우선. 권고 대체값을 쓰고 SUMMARY 에 "UI-SPEC 시작값 대비 조정 3건" 으로 적는다(위임 결정이라 사용자가 한 줄로 바꿀 수 있음).
2. **광장 `vote` 단계는 저녁 분위기라 채도 한도를 면제해야 하나?** UI-SPEC 규칙 1 은 vote 를 명시 포함. 권고: 포함 유지(현재 코드는 이미 0.346 이라 한도를 새로 어기는 변경이 아니라 기존 값을 수정하는 것).
3. **`setLook` 거절을 `ok:false`(state 프레임) vs `ok:true`(무변화, 프레임 0)?** 권고 `ok:false`(Pattern 1). 어느 쪽도 비밀 누설 없음(look 은 공개 값).
4. **장면 4 머리 [기록] 단추** 숨길지 — UI-SPEC 문구상 유지. E2E `data-record-button` 기대와 함께 계획이 확정.
5. **렌더 휘도 측정 방식**: 갤러리 촬영(`scripts/gallery.mjs`, 테스트 방+봇) + `sharp` 평균 휘도. 같은 카메라·배치를 맞추려면 `talk/morning/vote/night` 가 같은 시각 구도여야 하는데 실제 판의 카메라는 단계마다 다르다(지목·변론 고정, 그 밖 따라가기). 대안으로 `scripts/gallery.mjs` 가 아니라 튜토리얼 지도 장면 2(morning)·6(vote)(고정 카메라, 같은 사람 배치)을 비교 기준으로 쓸 수 있다 — 계획 작업이 결정.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | 시험·빌드·E2E | ✓ | v26.13.0 | — |
| Chrome (시스템) | 로컬 E2E | ✓ | `/Applications/Google Chrome.app` | — |
| `npx wrangler` (개인 계정 로그인) | 배포 `npm run deploy` | ✓ | 4.151.3, 개인 계정 이메일로 로그인(`check-account.mjs` 가 같은 이메일을 요구) | — |
| `rg` | 코드 검색(개발 편의) | ✓ | /opt/homebrew/bin/rg | grep |
| 로컬 dev 서버 `:5173` | E2E `--url http://localhost:5173` | ✗ (지금 안 떠 있음) | — | `npm run dev` 로 띄운다(계획/실행 때) |
| Cloudflare 무료 한도 | 배포본 E2E | ⚠ 하루 DO 쓰기 10만 행 | — | 큰 회귀는 로컬, 배포본은 smoke + 바뀐 흐름만(HANDOFF) |

**Missing dependencies with no fallback:** 없음.
**Missing dependencies with fallback:** 로컬 dev 서버(실행 때 `npm run dev`).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.12 (projects `unit`·`client`·`worker`) + `node --test`(E2E 순수 도우미) + playwright-core 1.64.1(E2E) |
| Config file | `vitest.config.ts`, `wrangler.jsonc`, `scripts/e2e/run.mjs` |
| Quick run command | `npx vitest run --project <unit\|client\|worker> <바꾼 파일>` (베이스라인 확인: `npx vitest run test/unit/look.test.ts test/unit/plazaScene.test.ts test/unit/barScene.test.ts test/unit/hostLine.test.ts` → 4 파일 186 통과, 0.5초) |
| Full suite command | `npm run typecheck && npm test && node --test scripts/e2e/lib.test.mjs` |

### Phase Requirements → Test Map

| SC | Behavior | Test Type | Automated Command | File Exists? |
|----|----------|-----------|-------------------|-------------|
| SC-1 | `resolveLookConflicts` 표(전원 coat, 직접 고른 우선, 좌석 순, OUTFIT_IDS 대체, 난수·역할 무관, 바뀐 것 없으면 동일 객체) | unit | `npx vitest run --project unit test/unit/look.test.ts` | ✅ 확장 |
| SC-1 | `setLook` 이 남이 직접 고른 옷 거절·기본 coat 는 안 잠금·`.role` 소스 가드 | unit | 같은 파일 | ✅ |
| SC-1 | `beginGame` 이 해소를 부르고 `randInt` 호출 수 불변(`startGame`·`rematch`·tutorial) | unit | `npx vitest run --project unit test/unit/gameRoom.test.ts test/unit/rematch.test.ts` | ✅ 확장 |
| SC-1 | 워커: 잠긴 옷 요청 → 보낸 소켓 state 한 프레임·다른 소켓 0, 시작 뒤 `players[].look` 전원 서로 다름, 역할 무관 | worker | `npx vitest run --project worker test/worker/dress.test.ts test/worker/start.test.ts test/worker/leak.test.ts` | ✅ (leak 수정 필요 — Pitfall 1) |
| SC-1 | `DressSheet` `data-taken` 개수·클릭 무반응·접근성 이름·내 옷 안 잠금 | client | `npx vitest run --project client test/client/dressSheet.test.tsx test/client/lobby.test.tsx test/client/resultScreen.test.tsx` | ✅ 확장 |
| SC-1 | E2E 흔적 같은 옷 표시 ≤ 1 이름표 | e2e | `npm run e2e -- --url http://localhost:5173 --only avatar-dress,errand,witness,trace` | ✅ 흐름 있음, 판정 추가 |
| SC-2 | 허용 범위 1~3(채도·배경 비·색온도) | unit | `npx vitest run --project unit test/unit/lighting.test.ts` | ❌ Wave 0 신규 |
| SC-2 | 기존 조명 시험 갱신(`plazaScene` 179-191, `barScene` 83·163·164) | unit | `npx vitest run --project unit test/unit/plazaScene.test.ts test/unit/barScene.test.ts` | ✅ 수정 |
| SC-2 | 허용 범위 4(렌더 평균 휘도 순서·배율)·5(가독) | 백스톱 | 갤러리 촬영 + `sharp` 평균, E2E H1(`headerContrastChecks`) | ❌ Wave 0 (측정 스크립트) |
| SC-3 | 스포트라이트: 포커스 있을 때만 `[data-tutorial-dim]` 1개, 구멍 = 상자 + lit 합집합(오차 2px), 장면 5·7·[다음]에 0개 | client + e2e | `npx vitest run --project client test/client/focusRing.test.tsx test/client/tutorialScenes.test.tsx` / `--only tutorial` | ✅ 확장 |
| SC-3 | [다음] 알약: 폭·높이·가운데·`bottom:28px;height:56px` 리터럴, 장면 4 진행 점 숨김 | client + e2e | `test/client/tutorialScenes.test.tsx` / `--only tutorial-solo` | ✅ |
| SC-3 | 장면 2~6 에 `.mf-game__panel`·채팅 입력·[내 역할] 0개, 고정 카메라 2·5·6 / 따라가기 3·4 | client | `npx vitest run --project client test/client/tutorialScreen.test.tsx test/client/tutorialGate.test.tsx test/client/mapInsetsPanelless.test.tsx` | ✅ 확장 |
| SC-3 | 장면 5 선 좌표 clamp(`clampPoint` 순수 시험)·도윤 이름표·카드·띠·수식·[다음] 교차 0 | unit + e2e | `test/client/tutorialScenes.test.tsx` / `--only tutorial-solo` (폰 6종) | ✅ 확장 |
| SC-3 | 직업 카드 한 줄 4개 = `ROLE_TEXT[role].desc`, 정적 가드 통과 | client + unit | `test/client/tutorialOpening.test.tsx` `test/unit/tutorialStaticGuard.test.ts` | ✅ 수정 |
| SC-3 | `TUTORIAL_SPOTS[1]` 걸을 수 있는 칸 | unit | `npx vitest run --project unit test/unit/tutorialScript.test.ts` | ✅ |
| SC-3 | 실제 판 카메라 불변(`cameraModeOf`) | unit | `test/unit/camera.test.ts`(기존 통과 유지) | ✅ |
| SC-4 | 밤 띠 4문장, `[data-pre-notice]` 0개, `.mv-evidence__zero` 0개·`eyeOff` 이름 "목격자 없음"·`data-lastseen-count="0"` | unit + client | `test/unit/hostLine.test.ts test/unit/e2eContract.test.ts test/client/phaseScreens.test.tsx test/client/evidenceCard.test.tsx test/client/recordTrace.test.tsx test/client/icon.test.tsx` | ✅ 수정 |
| SC-4 | E2E 문구 표 일치 | node | `node --test scripts/e2e/lib.test.mjs` | ✅ |
| SC-5 | 바뀐 흐름 E2E(폰 6종) → 전체 회귀 1회 → 배포 → smoke | e2e | `npm run e2e -- --url http://localhost:5173 --only avatar-dress,tutorial-solo,tutorial-together,errand,witness,trace,emcee-band,night,result` / 최종 `npm run e2e -- --url http://localhost:5173` (≈26분, 제한 29분) / `npm run deploy` → `npm run smoke` | ✅ |

### Sampling Rate
- **Per task commit:** 바꾼 파일의 단일 quick run (10초 이내) + 서버·타입 변경 때 `npm run typecheck`
- **Per wave merge:** `npx vitest run --project unit --project client` + 바뀐 워커 파일 + `node --test scripts/e2e/lib.test.mjs`
- **Phase gate:** `npm run typecheck && npm test` 초록 → 로컬 `npm run dev` 후 바뀐 흐름만(위 `--only`) → 전체 회귀 한 번 → 배포 → 배포본 smoke + `--only tutorial-solo,avatar-dress`(DO 쓰기 한도 주의)

### Wave 0 Gaps
- [ ] `test/unit/lighting.test.ts` — 허용 범위 1~3(두 맵), 낮에도 moonColor 따뜻함, 밤 값 불변(스냅숏 비교)
- [ ] 갤러리 촬영 휘도 측정 스크립트(또는 `scripts/gallery.mjs` 옵션) — 허용 범위 4·5
- [ ] `scripts/e2e/lib.mjs` 순수 검사 함수 신규(스포트라이트 `TD1~`, [다음] 기하 `TN3~`, 숨김 `TH1`, 장면 5 선 안쪽 `EV6`, 흔적 같은 옷 ≤ 1) + `lib.test.mjs` 단위 시험, `browser.mjs` `readTutorialStable`·`readTrace` 필드 추가
- [ ] 표식 상수 `AVATAR_MARKERS`(+`data-taken`)·튜토리얼 표식(+`data-tutorial-dim`) 동기화(lib.mjs·lib.test.mjs:2680·e2eContract.test.ts:359-362)
- [ ] 프레임워크 설치 없음(전부 설치됨)

## Security Domain

`security_enforcement` 는 `.planning/config.json` 에서 `true`, ASVS 레벨 1 [VERIFIED: .planning/config.json].

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no — 이 페이즈는 인증 경로를 안 건드림 | — |
| V3 Session Management | no — 소켓 첨부의 playerId 신원 불변 | — |
| V4 Access Control | yes | 서버가 신원을 소켓 첨부에서만 얻음(`worker/room.ts:handleDress` — 메시지에 seat·id 없음). 옷 해소·잠금은 서버 권한(결정 0002) |
| V5 Input Validation | yes | `dress` 메시지는 zod 스키마 + `OUTFIT_IDS` 포함 검사(기존 `look.ts:25` `BAD_MESSAGE`). 새 입력 없음 |
| V6 Cryptography | no | — |

### Known Threat Patterns for 이 스택 (Cloudflare Worker DO + React)

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 옷 해소/잠금이 역할 정보를 흘림(L25) | Information Disclosure | 해소는 `seat`·`look`·`OUTFIT_IDS` 만 읽는다. `look.ts` 소스 가드(`.role` 접근 0)가 시험으로 고정. 역할만 다른 두 판의 해소 결과가 같음을 시험 |
| 잠금 거절 응답이 오라클 | Information Disclosure | 거절은 사유 없이 보낸 소켓에 state 한 프레임(`!result.ok` 단일 경로). look 은 공개 값이라 추가 누설 없음 |
| 동시 선택 경합(두 사람이 같은 옷) | Tampering | DO 는 직렬 처리 — 먼저 도착한 쪽이 이김, 나중은 거절. 시작 때 해소가 마지막 안전망 |
| 요청 폭주 | Denial of Service | 기존 `LOOK_MIN_GAP_MS = 250` 간격 제한이 그대로 |
| 닉네임 XSS | Tampering | 새 DOM 은 닉네임을 쓰지 않고 `data-taken`·접근성 이름은 옷 이름(고정 표) |
| 튜토리얼이 서버에 새 요청 | Information Disclosure / 한도 | 혼자 하기 서버 0 — `tutorialStaticGuard` 가 `fetch`·`WebSocket`·`useRoomConnection` 금지. `ROLE_TEXT` 정적 표 읽기는 허용 |

## Project Constraints (from CLAUDE.md)

`/Users/dhkim1522/personal/minifia/CLAUDE.md` 와 `~/personal/CLAUDE.md` 에서 추려 낸 지침(계획·실행이 지킨다):

- **언어**: `.planning/` 산출물과 응답은 한국어, 코드·명령·파일 이름·ID 는 원문.
- **작은 MVP**: 이 페이즈 범위 밖(저녁 등불·집 찾기·판 종류·맵 확장·모이기 카메라)을 끌어들이지 않는다.
- **결정 0051**: 화면은 글 최소·보고 누르기. 새 보이는 글은 [다음] 한 낱말뿐. 이 페이즈는 글을 줄인다.
- **결정 0002·L25**: 규칙·판정은 서버(방 DO). 다른 사람의 역할은 살아 있는 사람에게 안 보냄. 옷 규칙은 역할을 안 읽는다.
- **"참가자"** 로 부른다(손님 금지). 이모지 금지.
- **원격 레포 위생**: `~/personal/CLAUDE.md` 의 "원격 레포 위생" 절을 따른다 — 코드·문서·계획·커밋 메시지에 그 절이 금지한 표현을 쓰지 않는다. 기기는 "Mac" 으로만 부른다. **커밋 전** 그 절에 적힌 `git grep` 검사를 돌려 결과가 없어야 한다(이 문서·SUMMARY 에도 적용).
- **HANDOFF.md**: 작업을 마칠 때마다 갱신하고 push. 6KB 이하(`test/unit/handoff.test.ts`), 해결된 항목은 지움.
- **E2E 시간**: 바뀐 흐름만 돌리고 6종 전체 회귀는 페이즈 끝에 한 번(사용자 메모). 실기기 항목은 끝에 몰아서.
- **배포**: 계획 실행이 끝나면 **Claude 가** 배포까지(계획에 "사용자가 배포" 가정 금지). `npm run deploy`(계정·배포 대상 가드 우회 금지). 개인 계정 확인 `wrangler whoami`.
- **실행기 컨텍스트**: 큰 문서(`docs/research-v3-missions-ux.md` 등) 통째로 읽히지 않고 이월 메모로 넘긴다.
- **강조**: 깜빡이는 램프 테두리(17), 흐림·손가락 포인터 금지. 낮도 마피아 분위기(낮은 채도), 작은 화면 가장자리 잘림은 진행에 지장 없으면 고치지 않음.
- **문서 갱신**: `docs/screen-map.md`(튜토리얼 장면 표 패널·[내 역할]·[다음] 줄, 옷장 잠금 줄), 달라진 값은 `docs/decisions/0081` 끝에 "실행 중 달라진 곳" 한 줄.
- **design-refs**: 이 페이즈에 사용자 참고 이미지 없음(UI-SPEC 확인) — 자체 판단 진행.

## Sources

### Primary (HIGH confidence — 이 세션에서 직접 열어 확인한 저장소 파일)
- `shared/game/look.ts`, `shared/game/room.ts`(beginGame/startGame/leaveRoom), `shared/game/rematch.ts`, `shared/game/trace.ts`, `shared/game/view.ts`, `shared/game/testTools.ts`, `shared/protocol.ts`(OUTFIT_IDS, PublicPlayer)
- `worker/room.ts`(applyDress/handleDress), `src/components/v2/DressSheet.tsx`, `src/net/useDress.ts`, `src/game/traceMark.ts`, `src/game/dressText.ts`
- `src/world/maps/plaza.ts`, `bar.ts`, `src/world/palette.ts`, `src/world/presence.ts`, `src/world/runtime.ts`(setLighting 호출)
- `src/screens/TutorialScreen.tsx`, `GameMap.tsx`, `RoleReveal.tsx`, `src/components/v2/FocusRing.tsx`, `TutorialNext.tsx`, `TutorialRoleCards.tsx`, `TutorialEvidence.tsx`, `EvidenceCard.tsx`, `V2Icon.tsx`, `src/game/tutorialScript.ts`, `roleText.ts`, `hostLine.ts`, `resultText.ts`, `src/styles/tutorial.css`, `game.css`, `v2.css`, `evidence.css`, `phase.css`, `src/net/useMapInsets.ts`
- 시험: `test/unit/look.test.ts`, `plazaScene.test.ts`, `barScene.test.ts`, `hostLine.test.ts`, `tutorialStaticGuard.test.ts`, `test/client/tutorialScreen·tutorialGate·tutorialScenes·tutorialOpening·phaseScreens` 일부, `test/worker/dress.test.ts`·`leak.test.ts` 일부
- E2E: `scripts/e2e/run.mjs`, `lib.mjs`(HOST_ACT_LINES, AVATAR_MARKERS, tutorial*Checks, headerContrastChecks), `tutorial.mjs`, `flows.mjs`(FLOWS), `scripts/check-account.mjs`, `deploy-target.mjs`, `package.json`, `.planning/config.json`
- `18-CONTEXT.md`, `18-UI-SPEC.md`, `docs/decisions/0081-v3-missions-flow-and-modes.md`, `docs/research-v3-missions-ux.md` §4-2~4-4, `HANDOFF.md`, `docs/screen-map.md`(튜토리얼 절)
- 계산: node 로 UI-SPEC 조명 시작값의 채도·휘도비·색온도, `three` `Color` 로 `plazaScene.test.ts` 단언 실패 여부 확인(`/private/tmp/…/scratchpad/lum.mjs`, `lum2.mjs`)

### Secondary (MEDIUM)
- 없음(외부 문서 조회 불필요 — 모든 질문이 이 저장소 코드에 관한 것)

### Tertiary (LOW)
- 없음

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 새 의존 없음, 버전은 `package.json` 직접 확인
- Architecture: HIGH — 모든 변경점의 파일·줄을 열어 확인. 단 스포트라이트 z 쌓임 맥락(A1)은 첫 렌더 확인 필요
- Pitfalls: HIGH — 깨지는 시험·E2E 판정을 소스에서 직접 확인(leak.test.ts:1077, plazaScene.test.ts:179-191, tutorial.mjs TT1, 조명 계산)
- 조명 렌더 순서: MEDIUM — `vote` 점광원 영향은 렌더로만 확인 가능(A2)

**Research date:** 2026-11-09
**Valid until:** 2026-12-09 (저장소 내부 변경 외 외부 의존 없음; 17→18 사이 파일이 바뀌면 줄 번호만 재확인)
