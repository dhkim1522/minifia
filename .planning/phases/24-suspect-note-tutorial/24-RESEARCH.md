# Phase 24: 의심 포스트잇과 새 튜토리얼 - Research

**Researched:** 2026-11-17
**Domain:** 서버 권위 포스트잇 규칙(공개 상태 `notes`, 거리 판정) + 캐릭터 몸에 붙는 3D 종이 + 기록 카드 일반화 + 서버 없는 혼자 하기 튜토리얼 + 폰 6종 전체 회귀·D1 생성·배포. 새 외부 패키지 없음.
**Confidence:** HIGH (아래 모든 코드 사실은 이 세션에서 파일을 직접 열거나 명령을 실행해 확인). 실행하지 못한 것은 "가정 로그"에 모았다(E2E·perf·전체 vitest·원격 배포·실기기).

> 이 문서는 `24-CONTEXT.md`(D-01~D-24)와 승인된 `24-UI-SPEC.md`(P24-1~33)를 다시 조사하지 않고 그 위에 쌓는다. **UI-SPEC 과 코드가 어긋난 곳 여섯 개**를 찾았다("핵심 결론"의 ⚠ 표시) — 계획자는 그 부분을 UI-SPEC 문언이 아니라 아래 교정 값으로 계획한다.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### 포스트잇 서버 규칙 (0089-10)
- D-01: 새 순수 모듈 `shared/game/postit.ts`(귓속말 `whisper.ts` 와 같은 모양): `stickNote(state, actorId, targetSeat, now)`. 서버 전용 상태 `RoomState.notes?: {n:number, from:number, to:number}[]`(일차 `n`, 붙인 좌석 `from`, 받은 좌석 `to`). 하루 한 사람당 한 장 = 그 `n` 의 `from` 기록이 하나. 같은 `n`·`from` 으로 다시 붙이면 `to` 만 바뀐다(옮기기). 받은 사람이 떼는 메시지는 없다.
- D-02: 허용 단계는 `discussion` 하나(`canMoveIn` 이 걷기를 허용하는 `dayAnnounce` 는 2초라 제외). 산 사람만 붙일 수 있고, 유령·자기 자신·죽은 대상은 거절한다. 거절은 사유 구별 없이 `BAD_MESSAGE` 하나(코드베이스 관례).
- D-03: 가까이 가야 붙일 수 있다. 서버가 월드의 구간(`positionAtFx`)으로 두 사람의 현재 위치를 구해 거리를 잰다. 새 상수 `NOTE_REACH_FX`(서버·클라이언트 공용, 걷는 중 지연을 감안해 넉넉히: 캐릭터 반경 `CHAR_RADIUS` 의 약 6배). 거리 함수는 shared 의 순수 함수이며 클라이언트도 같은 함수로 [붙이기] 활성화를 판단한다.
- D-04: 클라이언트→서버 메시지 이름은 `suspect { target }`(zod strictObject, target 0~7 정수; 서버→클라이언트의 `{t:"note"}` 마피아 쪽지와 이름이 부딪히지 않게). 신원은 소켓의 playerId.
- D-05: 봇은 포스트잇을 붙이지 않는다(봇 계획 변경 없음). 사람이 봇에게 붙이는 것은 허용한다.
- D-06: view: 모든 사람에게 같은 공개 값 `day.suspects: {to, from}[]`(오늘 붙어 있는 것, `n === day` 만)과 본인 값 `me.suspectTo?: number`(오늘 내가 붙인 대상, 옮기기 표시용). 붙은 사람의 좌석(색)은 공개다(역할 누설 경로 없음, 0089-11 "지나치게 드러낼 필요는 없다"는 시각 강조 문제일 뿐). "다음 날 아침에 떨어짐" = 새 일차 진입에서 `n === day` 필터로 자연히 사라진다.
- D-07: 기록은 판 내내 공개 값으로 남는다: `day.suspectLog: {n, from, to}[]`(지난 날 포함, 모두 같은 값). 서버 `notes` 가 단일 원천이고 view 는 둘을 이 필드에서 파생한다. 저장 크기는 일차당 최대 인원 수 줄이라 작다.
- D-08: 다시 하기(`rematch`)·새 판 시작에서 `notes` 를 비운다. `normalizeStoredRoom` 은 `notes` 가 없으면 `[]`로 본다(옛 방 되돌림 목록 `LEGACY_V3_*` 에는 넣지 않는다).
- D-09: D1 `note_count` = 그 판에 붙은 포스트잇 장 수(`notes.length`, 옮긴 것은 한 장으로 센다). `tutorial` 열은 0 그대로(혼자 하는 튜토리얼은 서버를 안 거친다 — D-18).

### 포스트잇 화면·에셋 (0089-11)
- D-10: 조작: 토론 중 아래 입력줄 옆 [의심] 단추 하나(아이콘 단추, 접근성 이름 "의심 붙이기")를 누르면 **내 근처에 있는 산 사람의 이름표만** 선택 가능한 모드가 된다(귓속말의 `WorldPick` 모드 모델 재사용, `src/game/suspectView.ts` 로 상태·라벨 분리). 이름표를 누르면 붙고 모드가 끝난다. 이미 오늘 붙였으면 [의심] 은 "옮기기"로 같은 모드에 들어간다. 걷기 입력과 이름표 탭이 부딪히지 않게 한다. 단추·모드 위치와 문구는 UI-SPEC(글 최소, 결정 0051).
- D-11: 에셋: 작은 "의심" 포스트잇(살짝 기울기, 들린 모서리, 옅은 그림자). 한 장의 캔버스 텍스처(손글씨 펜 글꼴 `penFont` 재사용)를 구워 좌석 색을 옅게 틴트하는 평면 메시 하나로 그린다. 몸통(`body`)의 자식 메시로 붙여 걷기·모션을 따라가고, 얼굴·옷 특징·이름표를 가리지 않는 자리(가슴 옆·어깨 쪽)에 둔다. 머리 위에 띄우지 않는다. 여러 장은 살짝 겹쳐 쌓인다(최대 약 7장). 병합 지오메트리 경로에 넣지 않는다. 같은 텍스처·머티리얼 캐시를 공유해 draw call 을 억제한다. 붙는/떨어지는 모션은 `reducedMotion` 이면 즉시 전환.
- D-12: 성능 합격선(평균 55fps, 끊김 5회 이하, draw call 120, 점광원 3)을 `perf-run` 으로 측정한다(8명 × 여러 장 최악 장면 포함). 초과하면 장 수 표시를 줄여(예: 3장 초과는 숫자 배지) 맞춘다.
- D-13: 기록 카드: 역할 카드 시트의 "첫날 답" 탭을 일반화해 일차별 구역(`mf-answers__day`)마다 그날의 의심 행(붙인 사람 색 점 → 받은 사람)을 더한다. 탭 이름은 UI-SPEC 이 정한다(예: "기록").
- D-14: 시안은 Design 캔버스 2~3개 + 추천안 바로 구현(포스트잇 에셋·[의심] 단추 위치·튜토리얼 장면 틀). 사본은 `design/v3.0/suspect-note/` 에 둔다.

### 새 튜토리얼 (0089-15)
- D-15: **혼자 하기만** 만든다(첫 화면 [혼자 하기], 서버 0, 로컬 가짜 view + 실제 `GameMap`/`PreGame`/`Keyword` 화면, 로컬 send 어댑터, 서버로 아무것도 보내지 않는 정적 가드). 방장 줄의 [튜토리얼 먼저]와 서버 `tutorial` 단계·`tutorialDone`·`start.tutorial` 은 만들지 않는다(옛 방 정규화의 `tutorialPassed`/`tutorialDone`/단계 `tutorial` 표식과 이름 충돌을 피한다).
- D-16: 장면(글 최소, 연출 중심, 한 장면 한 가지): ① 역할 카드 ② 첫날 키워드 문제(시민 화면·마피아 화면 `???` 맛보기) ③ 모두의 답 공개 ④ 토론 ⑤ 찬반 ⑥ 차례 지목 ⑦ 유언 ⑧ 밤(고르기) ⑨ 다음 날 아침 포스트잇 붙이기 ⑩ 마무리. 출연은 옛 튜토리얼 선례(0080-16: 이름 낱말 든 의상 금지, 역할 낱말 금지). 사용자 선호(익사이팅한 튜토리얼 — 단추 연습이 아니라 목적·재미·직업·흐름을 연출로)를 따른다.
- D-17: 옛 구현(`git show 00829164^` 이전 커밋)의 구조를 참고하되 새 `RoomView` 에 맞춰 새로 쓴다: 순수 스크립트·가짜 view 모듈(`src/game/tutorialScript.ts`), 장면 시각표 훅, 알약 부품, 포커스 스포트라이트(`FocusRing`·`OpeningFx` 는 22-03 에서 지웠으니 필요하면 `00829164^` 에서 되살림), 사회자 문구 키, 저장 키 "봤음". 소리는 새로 만들지 않고 기존 `ui.*` 로 대체한다.
- D-18: 튜토리얼은 서버를 거치지 않으므로 D1 행이 없다. 진입점 마운트(`Home.tsx`)와 E2E "튜토리얼 진입 DOM 0건" 단언을 새 상태에 맞게 뒤집는다.

### 페이즈 끝 (0089-25, 0091-18)
- D-19: 순서: 포스트잇·튜토리얼 E2E 부분 회귀(`--only`) → **폰 6종 전체 E2E 회귀를 배치로 나눠 로컬에서 돌린다**(29분 중단 한도 때문에 `--only` 묶음 4~5개, 첫 실행에 섞이는 옛 간헐 실패(basicDay 랜덤 역할, 360x560 world 이동 목적지)는 단독 재실행으로 구분) → 로컬 D1 과 `vite dev` 상태 폴더 공유 확인(23 미확인 항목 0091-23 A1; `npm run games -- --local` 로 한 판 뒤 행 확인, 안 나오면 `--persist-to` 경로 보정) → 배포.
- D-20: 배포 단계는 외부 계정 변경이므로 **개인 Cloudflare 계정이 확인될 때만** 진행한다: `npx wrangler whoami`(= `scripts/check-account.mjs`)가 개인 계정이 아니거나 로그인이 없으면 거기서 멈추고 사용자에게 알린다(자동 로그인 시도 금지). 확인되면 0091-18 순서대로: `npx wrangler d1 create minifia-v3-games --location apac` → `database_id` 를 `wrangler.jsonc` 에 손으로 기입(값을 문서·커밋 메시지에 옮기지 않는다) → `npx wrangler d1 migrations apply DB --remote` → `npm run games -- --remote`(빈 표) → `npm run deploy`(계정·대상 가드 우회 금지) → `npm run smoke`(생성 단계)와 `node scripts/smoke.mjs <주소> --stage full` → `/api/health` 버전 확인. `main` 은 건드리지 않는다.
- D-21: 새 결정 기록 `docs/decisions/0092-v3-suspect-note-tutorial.md`(포스트잇 규칙·메시지 이름·view 모양·에셋 결정·튜토리얼 범위(혼자 하기만)·배포 결과·알려진 한계)와 기획서·구조 문서·화면 지도 갱신, HANDOFF(6KB 이하)에 "v3.0 구현 끝, 실테스트 대기, 사용자가 할 일 목록(키워드 목록 검토·실기기 확인 항목·main 반영 결정)"을 적는다.

### UI 계약 점검 후 보강 (자동 채택)
- D-22: `suspect` 는 **둘째 날부터**(`day ≥ 2`) 서버가 받는다(첫날은 키워드 문제가 근거를 대신하므로 BAD_MESSAGE). 화면의 [의심] 도 같은 조건에서만 보인다(UI-SPEC P24-1). 화면과 서버가 다른 값을 쓰지 않게 한 상수/함수로 맞춘다.
- D-23: 튜토리얼 장면 "≤ 1탭" 규칙의 출처는 UI-SPEC(P24-27)이다. 포스트잇 장면만 [의심] → 이름표 두 번 누름(실제 조작을 거짓 연습으로 만들지 않기 위해).
- D-24: 포스트잇은 새 `V2Icon` `postit` 한 개(폴백 `note`), `palette.ts` 에 좌석 8색 복사(`tokens:check` 로 동기화), 탭 키 `answers`→`records` 개명에 따른 23 의 E2E 표식·`e2eContract` 정정이 이 페이즈 계획에 들어간다. 귓속말 모드(`GameMap` 의 `whisper.mode`)와 [의심] 모드는 동시에 켜지지 않게 서로 끈다.

### Claude's Discretion
- 계획 나누기(조사 권장: 서버 규칙+D1 공유 확인 → 프로토콜·view → [의심] UX·에셋·기록 카드 → 튜토리얼 스크립트·화면 → E2E 부분 회귀 → 전체 회귀·배포), `NOTE_REACH_FX` 정확한 값, 틴트·그림자 수치, 튜토리얼 문구는 계획자·실행자가 정한다.

### Deferred Ideas (OUT OF SCOPE)
- 방장 [튜토리얼 먼저] 함께 진행(서버 단계)
- 봇의 포스트잇
- 시상·억울상, 포스트잇을 시상에 반영
- 포스트잇 떼기·반응 동작
</user_constraints>

<phase_requirements>
## Phase Requirements

요구사항 ID 는 없다(ROADMAP `Requirements: TBD`). 성공 기준 4개를 대신 쓴다.

| ID | 설명 | 조사가 받치는 곳 |
|----|------|------------------|
| SC-1 | 가까이 가서 하루 한 장 붙이기·옮기기·못 뗌·다음 날 떨어짐·기록 카드에 남음·판정 무영향 | P1(서버 규칙·view·누설), P2(거리 수치), P3(클라 모드), P5(기록 카드) |
| SC-2 | 3D 종이: 몸에 붙은 모양·가리지 않음·머리 위 금지·좌석색 틴트·겹침 | P4(부착 수치 교정·텍스처·런타임·성능) |
| SC-3 | 혼자 하기 튜토리얼(서버 0)이 새 흐름을 따름 (ROADMAP 문구는 이미 정정됨: `.planning/ROADMAP.md:627`) | P6(복원·재작성·가짜 view·정적 가드·E2E) |
| SC-4 | 폰 6종 전체 회귀 통과 → 개인 계정 확인 뒤 배포·health·smoke | P7(배치·간헐·D1 경로·배포·정지 조건) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

`/Users/dhkim1522/personal/minifia/CLAUDE.md` 와 `~/personal/CLAUDE.md` 에서 계획이 지켜야 하는 것:
- **언어**: 산출물·응답은 한국어, 코드·명령·파일 이름·ID 는 원문.
- **레포 위생**: 하위 레포에 넣는 모든 것(코드·문서·계획 문서·커밋 메시지)에 소속 기관·계정 격리를 암시하는 표현 금지. 커밋 전에 `~/personal/CLAUDE.md` 의 "원격 레포 위생" 절에 적힌 `git grep` 패턴을 돌려 결과 0건을 확인한다(일반 용례 예외). **이 문서와 모든 PLAN·SUMMARY 도 대상이다.** 기기는 "Mac"·"집 Windows PC" 로 부른다. 계정 확인 문구는 "개인 계정인지 확인한다"만.
- **글 최소(결정 0051)**: 정보는 장면·아이콘·숫자, 읽을 글은 단계 이름과 한 줄 이하. 새 글 단추는 [혼자 하기]·[홈으로] 둘뿐(UI-SPEC).
- **판정은 서버가 한다(결정 0002)**, 다른 사람의 역할은 서버가 보내지 않는다(결정 0021). 포스트잇 값은 역할과 무관한 공개 값이라 이 규칙을 건드리지 않는다.
- **GSD 작업 원칙**: 작은 MVP·이른 배포·디자인 먼저. 이 페이즈의 UI 계약은 승인됨. 사람용 산출물은 캔버스 아티팩트(이 페이즈의 시안 사본 `design/v3.0/suspect-note/` 는 이미 있음).
- **작업 끝나면 HANDOFF 갱신·push**(6KB 이하, `test/unit/handoff.test.ts`), 배포는 Claude 가 끝까지(사용자 메모리 "작업 끝나면 배포까지") — 단 D-20 의 개인 계정 확인이 앞선다.
- **실행기 컨텍스트는 가볍게**(메모리): PLAN 하나가 큰 문서를 통째로 읽히지 않게, 이월 메모로 넘긴다. 계획 하나 ≤ 3 작업.
- 새 결정은 `docs/decisions/` 다음 번호(0092). 브랜치는 `v3`(main 금지).
- `~/personal/CLAUDE.md` 계정 격리: 개인 계정 세션만, `wrangler` 로그인은 이 Mac 에서 다른 세션과 공유되므로 배포 전 `check-account` 판정이 유일한 방어선이다.

## Summary

포스트잇은 **귓속말(`whisper.ts`)의 모양을 빌리되 상태의 공개성이 반대**다. 귓속말 본문은 비공개라 `persistAndBroadcast` 를 부르지 않지만, 포스트잇(누가 누구에게)은 모두에게 같은 공개 값이라 **받아들이면 전원 방송**(`applyPoint` 모양)이다. 새 상태는 `RoomState.notes`(서버 전용 이름) 하나이고 view 가 `day.suspects`·`day.suspectLog`·`me.suspectTo` 로 필드별 복사한다. 다시 하기·대기실 복귀는 **허용 목록 복사**(`REMATCH_ROOM_KEYS`·`resetToLobby` 리터럴)라 `notes` 는 코드 없이 자동으로 빠진다 — 해야 할 일은 카나리 시험을 더하는 것뿐이다. 거리 판정은 서버 `world.segs` 의 구간과 클라이언트 `WorldStore.segOf` 가 **같은 구간·같은 `positionAtFx`** 를 쓰므로, 한 순수 함수(정수 제곱 비교)로 둘이 같은 값을 얻는다.

3D 종이는 `body` 그룹의 자식 메시 한 장이고 캔버스 텍스처 한 장을 공유한다. 캐릭터 지오메트리를 읽어 보니 UI-SPEC 의 부착 좌표(중심 x −0.15, y 0.56, 0.32 정사각)는 **가슴 장식·옷깃과 겹치지 않는다**(수치 대조 완료). 그러나 **UI-SPEC 의 화면 px 추정(19×15)은 `CHAR_SCALE = 0.83` 을 빠뜨려 약 20% 과대**다 — 실제는 약 15.5×12.6px 라서 "14px 미만이면 키운다" 규칙에 걸릴 가능성이 높다. 텍스처 굽기는 happy-dom·node 에 canvas 가 없으므로(실측: `getContext("2d")` → `null`, `document.fonts` → `undefined`) **굽기 함수를 주입식**으로 두고 가짜 컨텍스트 기록기로 시험한다.

튜토리얼은 `git show 00829164^` 에서 FocusRing·정적 가드·가짜 WorldStage 시험 도우미를 되살리고, 가짜 view·장면 표·화면은 새로 쓴다. 가장 큰 위험은 **실제 화면 부품이 `phaseEndsAt`(시계)로 연출을 정한다**는 점이다(역할 카드 자동 뒤집힘, 키워드 읽기 잠금, 처형 순간·막). "시간 표시 없음"은 가짜 view 의 시계 값을 없애는 것이 아니라 **띠·헤더에만 시간 없는 사본을 주는 것**으로 풀어야 한다. 전체 회귀는 49개 기본 흐름·140작업을 5개 `--only` 묶음으로 나눈다(실제 `selectFlows` 로 분할 검증, 겹침 1개). 로컬 D1 상태 공유는 정적 분석과 **실측(33행이 `vite dev` 가 쓴 파일에서 `wrangler d1 execute --local` 로 읽힘)** 두 근거로 확인되어 `scripts/games.mjs` 수정이 필요 없다.

**Primary recommendation:** 서버(1~2계획)를 먼저 끝내 view 모양을 고정하고, 클라이언트 [의심] UX·3D 종이·기록 카드·튜토리얼 기반을 같은 웨이브에서 병렬로 만든 뒤(GameMap·Home 을 건드리는 것만 직렬), E2E 부분 회귀 → 5배치 전체 회귀 → (개인 계정이 확인될 때만) D1 생성·배포 순으로 간다. 마지막 계획은 정지 조건을 첫 작업에 둔다.

## 핵심 결론 (계획자용, UI-SPEC 교정 ⚠ 포함)

1. **서버는 `applyPoint` 모양이다**(전원 방송). 거절은 단계 어긋남 포함 모두 `BAD_MESSAGE` 하나 — `whisper.ts` 는 단계 어긋남에 `WRONG_PHASE` 를 쓰지만 UI-SPEC P24-7 알림은 `BAD_MESSAGE` 만 잡으므로 **`stickNote` 는 `WRONG_PHASE` 를 쓰지 않는다**(D-02 와 일치).
2. **`NOTE_REACH_FX = 240` 권장**(캐릭터 반경의 약 6.9배, 2.4 월드 단위). 켜는 문턱 92% = 220, 끄는 문턱 100%. 근처 집합은 **서버와 같은 서버 구간(`store.segOf`)** 으로 계산한다(내 예측 위치 금지 — 예측은 서버보다 앞서 가서 92% 여유 8%(0.19 단위)를 소진한다). ⚠ UI-SPEC P24-6 의 "내 것은 예측" 을 이 점에서 교정.
3. ⚠ **E2E 표식 `data-record-day` 는 쓰면 안 된다.** `scripts/e2e/lib.mjs` 의 꺼진 장치 속성 접두 `OFF_DEVICE_ATTR_PREFIX` 에 `"data-record"` 가 있고 감시기가 `name.startsWith(pre)` 로 훑는다 → `data-record-day` 가 열린 기록 시트 한 번만 보여도 `basic-off`(OFF1)가 실패한다. **`data-log-day`** 로 쓴다(기존 `data-answer-*` 는 첫날 목록 안에서 그대로 둔다).
4. ⚠ **시트 제목을 "모두의 기록"으로 바꾸면 하네스가 깨진다.** `scripts/e2e/browser.mjs:76` 의 `dismissAnswerSheetInit` 이 `dialog[aria-label="모두의 답"]` 만 닫는다 → 제목이 바뀌면 첫날 토론에 자동으로 열리는 시트가 **키워드 흐름을 뺀 모든 일차 1 흐름의 단추를 가린다**. 같은 계획에서 두 이름을 모두 닫게 고친다(+`roleCardSheet.test.tsx:490-493`·`roomScreen.test.tsx:818` 기대).
5. ⚠ **`gen-tokens.mjs --check` 는 `palette.ts` 를 보지 않는다**(`tokens.css` ↔ `tokens.json` 만 비교). 좌석 8색 동기는 `test/unit/palette.test.ts` 를 늘려서만 지킨다. `gen-tokens.mjs` 는 고치지 않는다(UI-SPEC P24-10 문언 교정).
6. ⚠ **종이 화면 크기: `0.32 × 0.83(CHAR_SCALE) × 58.2(PX_PER_UNIT) ≈ 15.5px` 가로, 세로 ≈ 12.6px**(UI-SPEC 은 19×15). 처음부터 한 변 0.34~0.36 을 후보로 두고 390×844 스크린샷(실측)으로 정한다. 0.36 이면 중심 y 0.56 에서 윗변 0.74 가 별 배지 아랫변(0.745)에 닿으므로 **중심을 y 0.54 로 내리는 안**을 함께 시험한다.
7. **보이는 장 수 3 + 숫자 칩**과 **종이 = 메시 1·draw call 1**이면 최악 +8. 기준선 실측(`.planning/phases/20-map-expansion/perf/nightload-390x844-x4-plaza.json`): 토론 49 calls·지목~처형 70~71 → 최악 ≈ 79 ≤ 120. 최악 장면은 `perf=1` 스파이크에 `notes` 옵션을 더해 만든다(P4).
8. **기록 카드 개명 영향 목록은 닫혀 있다**(P5): 소스 2곳, 단위·클라이언트 시험 2파일, E2E 3곳(+하네스), 문서 2곳. `e2eContract.test.ts` 에는 `rolecard` 참조가 없다(UI-SPEC 의 "e2eContract 정정"은 view 키 사본 때문이다, 결론 9).
9. **view 키 사본 5곳을 같이 고친다**: `test/unit/view.test.ts`(`ME_KEYS`·`DAY_KEYS`·`SERVER_ONLY_KEYS`+`notes`), `scripts/e2e/lib.mjs`(`VIEW_ME_KEYS`·`VIEW_DAY_KEYS`), `test/worker/leak.test.ts`(`SERVER_ONLY_KEYS`+`notes`), `test/unit/soundProtocol.test.ts`(`CLIENT_MESSAGE_KINDS`+`suspect`), 그리고 `e2eContract.test.ts` 의 사본 대조(자동).
10. **로컬 D1 공유는 확인됨**(수정 불필요, P7). 단 기본 `npm run games` 는 봇 판을 빼서 E2E 행(전부 `has_bots=1`)이 안 보인다 — 확인은 `--all`, 또는 사람 소켓만 쓰는 `smoke --stage full` 한 판 뒤 기본 조회로 한다.
11. **배포 후 `smoke --stage full` 은 운영 D1 에 `has_bots=0` 행을 하나 남긴다**(사람 소켓 5개 일반 방). 첫 통계가 오염되므로 0092·HANDOFF 에 "smoke 판 1행"으로 적는다(삭제는 외부 변경이라 하지 않는다).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 붙이기 허용 판정(단계·일차·생존·거리) | API/Backend(방 DO + `shared/game/postit.ts`) | Browser(같은 순수 함수로 [의심]·이름표 활성) | 결정 0002. 화면은 켜 주기만 하고 서버가 거절한다 |
| `notes` 저장·누적 | Database/Storage(DO `room` 키) | — | 서버 전용 이름, 다시 하기는 허용 목록으로 자동 제외 |
| 공개 view(`day.suspects`·`suspectLog`·`me.suspectTo`) | API/Backend(`buildView` 필드별 복사) | Browser(`suspectView.ts` 선택기) | 모든 사람에게 같은 공개 값, 누설 경로 없음 |
| D1 `note_count` | API/Backend(`buildGameRow`) | Database(D1) | 판 끝 전환 한 번 |
| 3D 종이 그리기·붙음/떨어짐 모션 | Browser(three 런타임, `src/world/postit.ts`) | — | 렌더러는 클라이언트, 서버는 좌석 목록만 |
| [의심] 단추·모드·거절 알림 | Browser(GameMap·useSuspect) | — | 표시 전용, 서버가 거절하면 알림만 |
| 기록 카드 일차 구역 | Browser(RoleCardSheet) | API(공개 `suspectLog`) | 판 내내 남는 공개 값 |
| 튜토리얼(가짜 view·장면·소리) | Browser 전용 | — | 서버·소켓·`/api` 0, 정적 가드 |
| 전체 회귀·D1 생성·배포 | CDN/정적+Worker 배포(wrangler) | 개발자 Mac | 계정 가드가 선행 |

## Standard Stack

### Core (모두 기존 — 신규 설치 없음) [VERIFIED: /Users/dhkim1522/personal/minifia/package.json]
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| three | 0.186.1 | 3D 종이(PlaneGeometry·CanvasTexture·MeshStandardMaterial) | 이미 런타임 렌더러. 병합 지오메트리 경로 밖 별도 `Mesh` |
| react / react-dom | 19.3.1 | [의심] 단추·튜토리얼 화면 | 기존 |
| zod | 4.6.7 | `suspect` strictObject | `ClientMessageSchema` 의 기존 방식 |
| vite + @cloudflare/vite-plugin | 8.3.5 + 1.64.0 | 로컬 개발·빌드(상태는 `.wrangler/state/v3`) | 기존 |
| wrangler | 4.151.3 | D1 생성·마이그레이션·배포 | 기존, `scripts/games.mjs` 가 직접 호출 |
| vitest | 4.1.12 | unit(node)·client(happy-dom)·worker 3개 프로젝트 | `vitest.config.ts` |
| playwright-core | 1.64.1 | E2E(시스템 Chrome) | `scripts/e2e/` |
| happy-dom | 21.0.4 | client 시험 | canvas 2D 없음(아래 실측) |

### Supporting
| Library | Purpose | When |
|---------|---------|------|
| `src/styles/penFont.css`(Nanum Pen Script, unicode-range 조각) | 종이 글자 "의심" | 텍스처 굽기 전에 `document.fonts.load('44px "Nanum Pen Script"', '의심')` |
| `node --test`(내장) | `scripts/**/*.test.mjs` | E2E 판정 순수 함수 시험 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 캔버스 텍스처 | SVG→이미지 텍스처 | CSP 는 없으나 비동기 디코드·폰트 타이밍이 더 복잡. D-11 이 캔버스로 확정 |
| `window.__mfWorld.suspectNotes()` | `window.__mfNotes`(`__mfGhosts` 선례) | 둘 다 가능. 기본은 UI-SPEC 대로 `HookRuntime` 확장 |

**Installation:** 없음(`npm install` 불필요).
**Version verification:** 위 버전은 `package.json` 을 이 세션에 열어 확인했다(레지스트리 조회 불필요 — 신규 패키지 없음).

## Package Legitimacy Audit

이 페이즈는 **외부 패키지를 설치하지 않는다**(`package.json` 불변). 해당 없음.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (없음) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
[폰 A: [의심] 탭] ──모드 on──▶ useSuspect(near=250ms, store.segOf×서버시각)
        │  이름표 탭(근처 산 사람만 버튼)
        ▼
 send {t:"suspect",target}  ──WS──▶ worker/room.ts switch "suspect"
                                      │ overRateLimit(20/s) → handleSuspect
                                      │ writeAt 간격(SUSPECT_MIN_GAP_MS, 조용히 버림)
                                      ▼
                         shared/game/postit.ts  stickNote(state, world, actorId, target, now)
                           단계 discussion · day≥2 · 산 사람 · 자기 아님 · positionAtFx 거리 ≤ NOTE_REACH_FX
                           └ 거절 = {ok:false}  → sendRejection(BAD_MESSAGE + 본인 state)
                           └ 같은 대상 = 같은 state 객체 → 저장·방송 없음
                           └ 성공 = notes(제거 후 끝에 추가)  → ctx.storage.put("room") → persistAndBroadcast()
                                      ▼
              buildView(모든 소켓): day.suspects(오늘) · day.suspectLog(전체) · me.suspectTo(본인)
                                      ▼
 폰 A·B·C…: suspectView.ts 선택기 ─▶ ① GameMap: data-suspects·[의심] 점·칩 ② sceneLook.notes ─▶ runtime.setScene
                                      │                                       └ world/postit.ts: 좌석별 종이 메시(body 자식)
                                      └ ③ RoleCardSheet "답과 의심": suspectLog → 일차 구역
 판 끝(ended) 전환 ─▶ buildGameRow: note_count = notes.length ─▶ D1 INSERT OR IGNORE
 rematch / resetToLobby ─▶ 허용 목록 복사 → notes 자동 제외
 [혼자 하기] ─▶ TutorialScreen(서버·소켓 0): tutorialScript 가짜 view → 실제 GameMap/PreGame/Keyword + FocusRing + 알약
```

### Recommended Project Structure
```
shared/game/postit.ts          # 신규: 상수·거리 함수·stickNote·suspectLogOf (순수)
shared/game/room.ts            # notes 필드 + beginGame 에서 비움(벨트)
shared/game/view.ts            # day.suspects·suspectLog·me.suspectTo
shared/game/gameLog.ts         # note_count
shared/protocol.ts · schemas.ts# suspect 메시지·DayView/MyInfo 타입
worker/room.ts                 # case "suspect" · handleSuspect/applySuspect
src/game/suspectView.ts        # 신규: 선택기(시각·난수 없음)
src/net/useSuspect.ts          # 신규: 모드 훅(useWhisper 모양)
src/world/postit.ts            # 신규: 지오메트리·텍스처·재질 캐시·붙음/떨어짐
src/world/{presence,runtime,testHooks}.ts  # SceneLook.notes · setScene 반영 · 훅
src/world/palette.ts           # 좌석 8색 복사
src/components/v2/{V2Icon,ChatPanel,HeadStack}.tsx · src/screens/{GamePanel,GameMap}.tsx
src/components/RoleCardSheet.tsx  # RecordsPanel
src/game/tutorialScript.ts · src/screens/TutorialScreen.tsx · src/components/tutorial/{TutorialFrame,FocusRing}.tsx · src/net/useTutorialScene.ts
src/screens/Home.tsx · src/net/session.ts  # [혼자 하기] · tutorialSeen 키
scripts/e2e/{suspect,tutorial}.mjs(+test) · flows.mjs · lib.mjs · browser.mjs
docs/decisions/0092-v3-suspect-note-tutorial.md
```

### P1. 서버 규칙·프로토콜·view·누설 (조사 1)

**순수 모듈 시그니처.** 거리 때문에 `world` 를 받는다(`fillChalk`/`worker/room.ts:1296-1299` 가 `this.world.segs[id]` 를 같은 방식으로 읽는 선례). `WorldState` 는 `shared/game/world.ts` 에 이미 있다.

```ts
// shared/game/postit.ts (제안 — 값은 아래 P2 표가 근거)
import { CHAR_RADIUS, UNIT } from "./map";                 // CHAR_RADIUS = 0.35, UNIT = 100
import { positionAtFx, type Segment, type WorldState } from "./world";
export const NOTE_PHASES: ReadonlySet<PhaseId> = new Set<PhaseId>(["discussion"]);
export const NOTE_FIRST_DAY = 2;                            // D-22: 서버·화면이 같은 상수
export const NOTE_REACH_FX = 240;                           // 2.4 단위 ≈ CHAR_RADIUS×6.86
export const NOTE_REACH_ON_PCT = 92;                        // 클라이언트가 켜는 문턱(끄는 문턱은 100)
export const NOTE_MAX_VISIBLE = 3;                          // 한 사람에게 보이는 종이(UI-SPEC P24-14)
export const SUSPECT_MIN_GAP_MS = 600;                      // 한 사람 요청 간격, 간격 안은 조용히 버림

export const noteAllowedNow = (phase: PhaseId, day: number | undefined): boolean =>
  NOTE_PHASES.has(phase) && (day ?? 1) >= NOTE_FIRST_DAY;   // suspectVisible 도 이 함수를 쓴다(D-22)

/** 서버·클라이언트 공용: 정수 제곱 비교(삼각함수·sqrt 없음, 서버와 폰이 같은 값). pct 는 켜는 문턱 비율. */
export function withinNoteReach(a: Segment | undefined, b: Segment | undefined, now: number, pct = 100): boolean {
  if (a === undefined || b === undefined) return false;
  const p = positionAtFx(a, now), q = positionAtFx(b, now);
  const dx = p.x - q.x, dz = p.z - q.z;
  return (dx * dx + dz * dz) * 10_000 <= (NOTE_REACH_FX * pct) ** 2;
}

export type StickResult = { ok: true; state: RoomState } | { ok: false; error: "BAD_MESSAGE" };
export function stickNote(state: RoomState, world: Pick<WorldState, "segs">, actorId: string, toSeat: number, now: number): StickResult { /* 아래 순서 */ }
```
검사 순서(계약): ① `noteAllowedNow(state.phase, state.day)` ② 행위자(방에 있고 `isAlive`) ③ `Number.isInteger(toSeat)`·대상(방에 앉은 `isAlive`·자기 아님) ④ `withinNoteReach(world.segs[actor.id], world.segs[target.id], now)` ⑤ 같은 `n`·`from`·`to` 가 이미 있으면 **같은 `state` 객체**(저장·방송 건너뜀의 근거) ⑥ 같은 `n`·`from` 이 있으면 **그 줄을 빼고 끝에 새 줄을 더한다**(옮기기). 모든 실패는 `{ ok:false, error:"BAD_MESSAGE" }` 하나 — 단계 어긋남도 `WRONG_PHASE` 가 아니다(`whisper.ts:36` 은 `WRONG_PHASE` 를 쓰지만 UI-SPEC P24-7 의 알림은 `BAD_MESSAGE` 만 잡는다 — 이 점이 귓속말과 다르다).
- ⑥ "빼고 끝에 더한다"는 D-01("`to` 만 바뀐다")과 관찰상 같지만 **쌓기 순서가 최신이 위**가 된다(제자리 변경이면 옮긴 종이가 새 대상의 맨 아래에 깔린다). `notes.length`·`note_count` 는 그대로다. 기본값으로 권장(Open Question Q5).
- `world.segs` 는 플레이어 **id** 키다. 방 DO 가 `this.world` 를 넘기고 시험은 `{ segs: { [id]: seg } }` 를 직접 만든다(`restSegment`).

**RoomState·rematch·정규화.** `notes?: { n: number; from: number; to: number }[]` 를 `shared/game/room.ts` 에 더한다. [VERIFIED: shared/game/rematch.ts:16] `export const REMATCH_ROOM_KEYS = ["code", "createdAt", "everConnected", "hostId", "nextJoinSeq", "mapChoice", "testMode", "testRole", "testBotVote"] as const;` — 허용 목록에 없으므로 다시 하기는 `notes` 를 **복사하지 않는다**. 같은 구조로 `shared/game/testTools.ts:162-187` `resetToLobby` 도 리터럴(`code`·`createdAt`·…)로 만든다. 따라서 D-08 의 "비운다"는 코드 변경이 아니라 시험이다: `test/unit/rematch.test.ts` 의 카나리 목록(line 74 `whispers: [...]`, line 196-199 키 목록)에 `notes` 를 더하고 `resetToLobby` 시험에도 하나 더한다. 벨트: `beginGame`(`shared/game/room.ts:440-)이 이미 `const { keyword: _prevKeyword, ...rest } = state;` 로 키를 빼므로 `notes` 도 같은 구조 분해에 넣는다. `normalizeStoredRoom` 은 변경 없음 — `notes` 는 읽는 쪽 `state.notes ?? []` 기본값이 받는다(`LEGACY_V3_*` 에 넣지 않는다, D-08).

**메시지·스키마.** `shared/protocol.ts` 의 `ClientMessage` 유니온에 `| { t: "suspect"; target: number }`, `shared/schemas.ts` 에 `z.strictObject({ t: z.literal("suspect"), target: z.number().int().min(0).max(7) })`(`point` 줄 바로 아래가 자연스럽다 — 같은 `target` 모양). 유니온에 더하면 `worker/room.ts` 의 `default: { const unhandled: never = msg; }`(`worker/room.ts:382`)가 컴파일 오류로 빠진 case 를 잡는다. `test/unit/schemas.test.ts` 에 허용·거부(덧붙은 키·`target` 8·실수·문자열) 시험, `test/unit/soundProtocol.test.ts:19-47` `CLIENT_MESSAGE_KINDS` 에 `"suspect"` 추가(알파벳 순서 배열이 정확히 같아야 통과).

**워커 처리기(귓속말·답 모양 + 공개 방송).**
```ts
case "suspect": await this.handleSuspect(ws, msg.target); return;           // RULES 스위치 없음(항상 켜짐)
private async handleSuspect(ws: WebSocket, target: number): Promise<void> {
  const att = this.attachmentOf(ws);
  if (!att || !this.room) { this.sendTo(ws, { t: "error", code: "BAD_MESSAGE" }); return; }
  const error = await this.applySuspect(att.playerId, target, Date.now());
  if (error !== null) this.sendRejection(ws, att.playerId, error);          // [error + 본인 state] 두 프레임, 다른 소켓 0
}
private async applySuspect(playerId: string, target: number, now: number): Promise<WsErrorCode | null> {
  if (!this.room) return "BAD_MESSAGE";
  const key = `suspect:${playerId}`;                                          // applyAnswer 와 같은 writeAt 맵(line 127, rematch 에서 clear)
  const last = this.writeAt.get(key);
  if (last !== undefined && now - last < SUSPECT_MIN_GAP_MS) return null;     // 수락·거절 모두 기록, 간격 안은 오류 없이 버림
  this.writeAt.set(key, now);
  const result = stickNote(this.room, this.world, playerId, target, now);
  if (!result.ok) return result.error;
  if (result.state === this.room) return null;                               // 같은 대상 다시 누름: 저장·방송 없음
  this.room = result.state;
  await this.persistAndBroadcast();                                           // 공개 값이라 전원(applyPoint 선례, line 850). reschedule 불필요(마감 불변)
  return null;
}
```
- **간격을 두는 이유**: 옮기기는 D-01 상 횟수 제한이 없다. 한 번 받아들일 때마다 `storage.put("room")` 1회 + 전원 방송이라(결정 0076 쓰기 예산) 600ms 간격이 하루 쓰기 상한을 묶는다(소켓당 `RATE_MAX_MESSAGES = 20`/초는 이를 못 막는다). 간격 안 요청이 조용히 버려져도 화면은 모드가 이미 끝나 있어 문제없다(600ms 안 재누름은 사람 속도로 드물다).
- 봇은 `BotAct` 에 `suspect` 를 더하지 않는다(D-05). 사람이 봇에게 붙이는 것은 `stickNote` 가 `isAlive(target)` 만 보므로 자동 허용.
- 비연결 대상: 연결이 끊긴 산 사람에게도 붙인다(귓속말 O-5 선례) — 거절 사유로 만들지 않는다.

**view.** `buildDay`(`shared/game/view.ts:71-`)와 `buildView` 의 me 구간에 **필드별 복사**로 더한다(조건을 채울 때만 키를 만든다 — 이 파일의 관례):
```ts
// buildDay 끝(chalk 다음)
const today = state.day ?? 1; const notes = state.notes ?? [];
const todayNotes = notes.filter((x) => x.n === today);
if (todayNotes.length > 0) day.suspects = todayNotes.map((x) => ({ to: x.to, from: x.from }));  // 배열 순서 = 쌓는 순서(아래→위)
if (notes.length > 0) day.suspectLog = notes.map((x) => ({ n: x.n, from: x.from, to: x.to }));
// buildView me 구간(whisperUsed 다음)
if (state.phase === "discussion" && isAlive(me)) { const mine = (state.notes ?? []).find((x) => x.n === (state.day ?? 1) && x.from === me.seat); if (mine) myInfo.suspectTo = mine.to; }
```
`DayView` 에 `suspects?: { to: number; from: number }[]`, `suspectLog?: { n: number; from: number; to: number }[]`, `MyInfo` 에 `suspectTo?: number`(`shared/protocol.ts:139-157`·`300-320` 인접). `me.suspectTo` 는 공개 `day.suspects` 의 `from === me.seat` 줄에서 파생되는 중복 값이다(D-06 으로 고정이라 그대로 두고, 시험이 둘의 일치를 단언한다). `DAY_PHASES` 에 이미 `discussion`·`night`·`morning`·`ended` 가 있어 종이는 낮 시작 발표(새 `day.n`)에서 비어 떨어진다 — 밤·아침에는 `day.n` 이 그대로라 **밤 단계 view 에도 어제의 `day.suspects` 가 남는다**(밤에는 `visibleSeats` 가 산 시민 편에게 남의 좌석을 안 그려 종이도 안 보인다). `buildRestingView`(쉬는 사람)에는 `day` 가 없다.

**누설·허용 경로 시험(시험 갱신 목록).**
- `test/unit/view.test.ts:297-` `SERVER_ONLY_KEYS` 에 `"notes"`, `ME_KEYS`(~line 316)·`DAY_KEYS`(~line 326)에 `suspectTo`·`suspects`·`suspectLog`. `phaseKeyViolations` 가 허용 키 집합만 보므로 조건 시험(오늘 줄만 `suspects`, 둘째 날 이전 `suspectLog` 포함, `suspectTo` 는 토론·산 본인만)은 별도 `it` 로 추가.
- `test/worker/leak.test.ts:116` `SERVER_ONLY_KEYS` 에 `"notes"`. 이 전수 시험은 키워드를 꺼 둔 6명 판이라 포스트잇이 안 나온다 → **전용 `test/worker/suspect.test.ts`**(규칙·방송·거절 프레임)와 **`test/worker/suspectLeak.test.ts`**(`keywordLeak.test.ts` 모양: 마피아 판과 시민 판의 `suspect` 응답 프레임 열·view 키 집합이 같다, 서버 전용 `notes` 이름이 어떤 프레임에도 없다, 거절 응답이 단계·거리·대상 사유에 따라 달라지지 않는다)를 만든다. 허용 와이어 경로를 `leak.test.ts` 에 `SUSPECT_WIRE_PATHS`(`.view.day.suspects`·`.view.day.suspects[].to`·`.view.day.suspects[].from`·`.view.day.suspectLog…`·`.view.me.suspectTo`)로 이유와 함께 적는다.
- `scripts/e2e/lib.mjs:3127-3128` `VIEW_ME_KEYS`·`VIEW_DAY_KEYS` 에 같은 키(사본이 앱과 같은지 `test/unit/e2eContract.test.ts:731-743` 이 `view.test.ts` 의 집합과 **정렬 비교**한다 → view.test.ts 를 먼저 고친다).
- `test/worker/basicOff.test.ts:53` `"whispers" in room` 부재 단언은 그대로.

**D1.** [VERIFIED: shared/game/gameLog.ts:67] `note_count: 0,` → `note_count: state.notes?.length ?? 0,`; `tutorial: 0` 유지. `test/unit/gameLog.test.ts:144` 의 `note_count` 0 기대를 "붙은 장 수(옮김은 한 장)" 시험으로 바꾼다. 워커 쪽은 `test/worker/d1.test.ts`·`gameLog.test.ts`(메모리 D1)가 이미 있어 열 값 시험만 더한다. 마이그레이션 파일은 **바꾸지 않는다**(`note_count` 열이 이미 있다, `migrations/0001_games.sql:17`).

### P2. 거리 수치 (조사 1 — 구체 숫자)

[VERIFIED: shared/game/map.ts:6,16] `export const UNIT = 100;` · `export const CHAR_RADIUS = 0.35;` → 반경 35 fx. [VERIFIED: shared/game/world.ts] `export const MOVE_SPEED = 1.8;`(단위/초) → 두 사람이 마주 걸으면 상대 속도 3.6 단위/초 = 360 fx/초. [VERIFIED: shared/game/gather.ts:15] `export const RING_RADIUS_FX = 265;`(지목 단계 둘레 자리 — 토론 중 거리 기준이 아니다).

| 후보 | fx | 단위 | 반경 배수 | 켜는 문턱(92%) | 여유(8%) | 마주 걸어 소진되는 시간 |
|------|----|------|-----------|----------------|----------|-------------------------|
| 6.0× | 210 | 2.10 | 6.0 | 193 | 17 fx | 47 ms |
| **권장** | **240** | **2.40** | **6.9** | **220** | **20 fx** | **55 ms** |
| 7.1× | 250 | 2.50 | 7.1 | 230 | 20 fx | 56 ms |

[VERIFIED: shared/game/map.ts:145-154 `BAR_SPAWNS`] 바 입장 지점 8곳(`{ x: 3.6, z: 0.4 }`, `{ x: 0.4, z: 3.6 }`, `{ x: 5.4, z: 2.2 … }`, `{ x: -4.2, z: -1.2 … }`, `{ x: 3.4, z: -2.6 }`, `{ x: -2.6, z: 3.4 }`, `{ x: -4.2, z: 0.2 … }`, `{ x: 2.2, z: 5.4 }`)의 쌍 거리를 이 세션에서 계산했다: 가장 가까운 쌍 1.40(좌석 3↔6), 다음 2.55(0↔2, 1↔7), 3.01(0↔4, 1↔5). 240 은 가장 가까운 이웃 쌍(2.55)을 **걷지 않고도 닿지 못하게** 하되(2.4 < 2.55) 한두 걸음이면 닿는다(1.8 단위/초 → 0.1초). 210 이든 240 이든 입장 직후 거의 모든 쌍은 걸어야 한다. 구현 기본값 240 으로 하고 Q1 로 올린다.

**권장 근거 — 서버 구간 기준 계산.** 서버는 `positionAtFx(world.segs[id], now)`, 클라이언트는 `WorldStore.segOf(seat)`(서버가 보낸 같은 구간 `{p,t0,v}`, [VERIFIED: src/world/store.ts] `segOf(seat: number): Segment | undefined`)와 `Date.now() + offset` 이므로 **같은 구간·같은 함수**다 → 차이는 시계 오차(핑 기반 `offset`)와 구간 도착 지연뿐이다. 반면 내 캐릭터의 예측(`runtime.shown(seat)`, 결정 0059·0085 의 "내 움직임 시간 선행")은 서버 구간보다 앞서 있어, 예측으로 "근처"를 켜면 서버가 거절할 확률이 올라간다. → `suspectTargets(view, segOf, serverNow)` 가 **서버 구간만** 읽는다(UI-SPEC P24-6 의 "내 것은 예측" 교정).

### P3. 클라이언트 [의심] 모드·GameMap 직렬 구간 (조사 1·3 일부)

**선택기 `src/game/suspectView.ts`**(시각·난수·입력 변형 없음, `whisperView.ts` 와 같은 규칙):
`suspectVisible(view)`=`noteAllowedNow(view.phase, view.day?.n)`+내가 산 사람+나 아닌 산 사람 ≥1, `suspectUsed(view)`=`view.me.suspectTo !== undefined`, `suspectTargets(view, segOf, serverNow, prev?)`(히스테리시스: 이전 집합에 있던 좌석은 100%, 없던 좌석은 92%로 판정), `suspectStacks(view)`(받은 좌석 → 붙인 좌석 배열, **죽은 받은 좌석 제외**, 보이는 `NOTE_MAX_VISIBLE`=마지막 3개), `suspectCountOf`, `suspectLogByDay`(최신 일차 먼저, 일차 안 붙인 좌석 오름차순).

**훅 `src/net/useSuspect.ts`**(`useWhisper.ts` 모양): `mode`·`toggleMode`·`off`·`targets`·`pick(seat)`. 이름표를 누르면 `send({t:"suspect", target})`·`guard.mark("suspect")`·`emitSignal({kind:"tap"})`·모드 종료(같은 프레임, 낙관 그림 없음). 250ms 간격 재계산, 단계·일차·대상 사망·내 사망이면 모드 종료, Esc 종료. **`src/net/useSendGuard.ts:7` `export type SendKind = "badge" | "whisper";` 에 `"suspect"` 를 더한다**(`mark`·`clear` 가 이 유니온을 받는다).

**GameMap.tsx 변경 지점(직렬로 한 계획이 한꺼번에).** [VERIFIED: src/screens/GameMap.tsx 줄 번호는 이 세션 기준]
1. 오류 구독(line 296-331): 귓속말 분기(`sendGuard.peek() === "whisper"`, line 301) 바로 뒤, 배지 분기(`take() === "badge"`, line 309) **앞**에 `suspect` 분기를 둔다 — `take()` 는 종류와 무관하게 기억을 지우므로 배지 분기가 먼저면 suspect 거절이 삼켜진다. 거절은 `e.code === "BAD_MESSAGE"` 일 때만(`WRONG_PHASE` 는 오지 않는다): `show("가까이 가야 붙여요", "postit")` + `emitSignal({kind:"deny"})`, 모드는 되돌리지 않는다. 채팅 속도 제한(`RATE_LIMITED`)은 알림 없음.
2. 모드 배타(line 416-428·589·595-601·650): `whisper.mode`(기본판 `RULES.whisper = false` — [VERIFIED: shared/game/ruleset.ts:20] `Object.freeze({ badge: false, whisper: false, pickTurn: true, runoff: false, showdown: false })` 라 사실상 항상 꺼짐)를 읽던 변수 네 곳(`pick`·`callOn`·`stageTagProps`·`hintOverride`)에 `suspect.mode` 를 같이 걸고, `suspect.toggleMode` 가 `whisper.off()`, `whisper.toggleMode` 가 `suspect.off()` 를 부른다.
3. `MapHeader`(line 158-165): `hintOverride !== undefined` 이면 **`LegacyMapHeader`(시간 링 포함)로 바뀐다**. 귓속말 선례가 그렇지만 [의심] 모드에서는 헤더 모양이 바뀌므로 360×560·390×664 스크린샷으로 레이아웃 이동이 없는지 확인한다(UI-SPEC 은 "머리 안내만 바뀐다"를 가정).
4. `GamePanel` → `ChatPanel.trailing`(`src/components/v2/ChatPanel.tsx:96,473-477` `data-chat-trailing`)에 [의심] 48 원 단추. **`onMouseDown preventDefault` 를 달지 않고** 클릭에서 `inputRef.current?.blur()` 후 모드 켬(P24-4). 단추 면은 기존 `.mv-tool.mv-chat__send`, 아이콘 `postit`(신규), 점은 `.mv-chat__will-dot` 재사용. 열린 시트(`layerKind !== null`)에서는 무반응.
5. 이름표: `HeadStack.tsx` `NameTag` 에 칩 한 요소(`suspectCount`)와 `stageTagProps`/`baseTagProps` 가 좌석별 `{ suspect: n }` 을 넘기는 한 줄. 모드 중 이름표 깜빡임은 기존 `blink`(귓속말 선례 `stageTagProps` line 595-601).
6. `[data-game-stage]` 에 `data-suspect-mode`·`data-suspects="seat:n,…"`(E2E 표식, `?e2e=1` 문맥에서만 — `GameMap.tsx:96-105` 의 `worldTestHooksEnabled` 선례).
7. `useMapInsets(…, panelless)`(`src/net/useMapInsets.ts:66`)에 **튜토리얼의 `stageInsets.bottom` 보정(+60)** 을 넣을 자리가 없다 → P6 에서 `GameMap` 에 선택 prop 하나(예: `bottomExtra`)를 더한다. 같은 계획에서 한 번에 하면 GameMap 을 한 번만 건드린다.

**WorldPick 이름표 규칙**: `WorldStage.tsx:69-80` `interface WorldPick { seats; mine?; label(nickname); onPick(seat); group; disabled? }` 를 그대로 쓴다. 모드가 걷기와 부딪히지 않는 근거는 기존 `WorldPick`·`stopPropagation`(땅 탭은 계속 걷게 하고 이름표가 이긴다).

### P4. 3D 종이 (조사 2)

**부착 좌표 검증(수치 대조).** [VERIFIED: src/world/character.ts:33] `export const CHAR_SCALE = 0.83;`(`root.scale.setScalar(CHAR_SCALE)`, line 858) — 몸통 좌표는 모델 공간(키 약 2.03)이고 화면에는 ×0.83. 몸통·가슴 장식(원문):
- 코트 원통: `part(body, new CylinderGeometry(0.29, 0.39, 0.6, 24), "coat").position.y = 0.66;`(line 384) → y 0.36~0.96, 반지름 `r(y) = 0.39 − 0.1·(y−0.36)/0.6` ⇒ r(0.40)=0.383, r(0.56)=0.357, r(0.72)=0.330(이 세션 계산).
- 어깨: `shoulder.scale.set(1.18, 0.55, 1); shoulder.position.y = 0.94;`(line 390-392) → y 0.775~1.105.
- 옷깃: `lap.position.set(s * 0.085, 0.88, 0.29);`(line 398), 상자 높이 0.32 → 아랫끝 y ≈ 0.72.
- 단추: `for (const y of [0.68, 0.55]) part(body, new SphereGeometry(0.025, 8, 6), "#22252e").position.set(0.07, y, 0.33);`(line 400) → x 0.045~0.095.
- 별: `star.position.set(0.17, 0.8, 0.29);`(line 404); 십자 `cross.position.set(0.17, 0.8, 0.3);`(406); 기자 `press.position.set(0.16, 0.78, 0.3);`(411) → 모두 y ≥ 0.745.
- 넥타이: `tie.position.set(0, 0.8, 0.305);`(394), 높이 0.24 → 아랫끝 ≈ 0.68이나 코트 표면(r(0.68)=0.337)보다 안쪽 z 라 y<0.72 구간은 보이지 않는다.
- 팔 피벗 `armA: ["armA", 0.37, 0.9],` `armB: ["armB", -0.37, 0.9],`(character.ts:871-872).

UI-SPEC 의 중심 (x −0.15, y 0.56), 0.32 정사각, 원통 감쌈(반지름 `r(y)+0.012`, 중심 yaw = −asin(0.15/r(0.56)) ≈ **−24.9°**, 반호 25.7°) 은 위 값과 **겹치지 않는다**(y 0.40~0.72 < 별 0.745, x −0.31~+0.01 은 단추 0.045 왼쪽, 옷깃 아랫끝 0.72 아래). 오른쪽 끝 x≈+0.01 이 넥타이 상자(x ±0.03)와 닿지만 그 y 구간은 코트가 가려 보이지 않는다 → **"가리지 않음" 단위 시험은 보이는 장식 상자만(넥타이 y ≥ 0.72 부분, 옷깃, 별·십자·기자, 단추, 머리, 모자) 대조한다**. 왼쪽 끝 −0.31 은 팔(피벗 x −0.37)의 안쪽 가장자리에 걸칠 수 있으므로 스크린샷에서 걷는 중 겹침을 본다(UI-SPEC 허용 범위).

**⚠ 크기 교정.** 화면 가로 = `0.32 × 0.83 × 58.2` = **15.5px**([VERIFIED: src/world/camera.ts:24] `export const PX_PER_UNIT = 58.2;`), 세로 ≈ 12.6px(UI-SPEC 의 cos 36° ≈ 0.81 가정 그대로). "14px 미만이면 0.36 까지 키운다" 규칙에 세로가 걸린다. 0.36 은 윗변 0.74(중심 0.56) 로 별 배지 0.745 에 닿으므로 **중심 y 0.54 / 크기 0.36 → y 0.36~0.72** 안을 실측 후보로 둔다(원통 아랫끝 0.36 에 걸치므로 아래 가장자리가 코트 끝에 걸리는지 스크린샷으로 확인). 최종값은 390×844 실측으로 정한다.

**텍스처·재질(happy-dom·node 시험 가능성).** [VERIFIED: 이 세션 실행 — happy-dom 21.0.4] `createElement("canvas").getContext("2d")` → `null`, `document.fonts` → `undefined`. `vitest.config.ts` 의 `unit`(node)·`client`(happy-dom) 모두 canvas 2D 가 없고, 기존 `src/world` 코드에는 `CanvasTexture`·캔버스 그리기가 **하나도 없다**(`rg` 결과: `threeRenderer.ts` 의 WebGL 캔버스와 디버그 `poseStrip.ts` 뿐). 그래서 `src/world/postit.ts` 는 **주입식 굽기**로 만든다:
```ts
export interface NoteBakeEnv { makeCanvas(w: number, h: number): { canvas: unknown; ctx: Note2D | null } | null; loadFont(): Promise<boolean> }
export function createNoteKit(env: NoteBakeEnv): NoteKit   // 지오메트리 1·재질 8(좌석별 캐시)·텍스처 1
```
`makeCanvas` 가 `null` 이면 1×1 `DataTexture`(종이색)로 폴백하고 `baked: false`; 제품은 `document.createElement("canvas")`. **시험**은 `ctx` 가짜 기록기로 `fillText("의심")`·`font` 문자열·밑줄·접힘 삼각 호출을 단언하고(픽셀 시험 아님), 지오메트리·정점 변위·재질 캐시(좌석 8개)·`dispose` 는 node 에서 three 객체 그대로 시험한다(`test/unit/character.test.ts` 가 이미 node 에서 `createCharacter` 를 시험한다). 글꼴: `document.fonts.load('44px "Nanum Pen Script"', '의심')`(unicode-range 조각을 불러오려면 글자를 넘겨야 한다)를 기다린 뒤 굽고, 실패하면 `--font-ui` 700 으로 굽고 글꼴이 오면 **같은 텍스처 객체를 `needsUpdate` 로 한 번 다시 굽는다**. CSP 는 이 레포에 없다([VERIFIED: `rg -i "content-security-policy|font-src|img-src"` 무결과]).
- 색 공간: three r186 은 `ColorManagement` 기본 켜짐 — `texture.colorSpace = SRGBColorSpace`, 재질 `color` 는 `new Color(hex)`(자동 선형 변환). 재질은 `MeshStandardMaterial`(조명 받음, 밤에 혼자 빛나지 않음), `transparent: true`·`depthWrite: false`·`polygonOffset`(층마다 0.004 앞으로 + 벨트) — 투명 정렬 때문에 메시 1·draw call 1 이어도 불투명 뒤에 그려진다.
- 좌석 8색: `src/world/palette.ts` 에 `SEAT_COLORS`(좌석 0~7 = 토큰 `seat-1..8`) 복사. [VERIFIED: src/styles/tokens.css:43-50] `--seat-1: #7a8fb8;` `--seat-2: #8e7ab8;` `--seat-3: #6fa59a;` `--seat-4: #b89a6f;` `--seat-5: #6f8fa8;` `--seat-6: #9aa86f;` `--seat-7: #b87a5c;` `--seat-8: #a9aebb;`, 종이 바탕 `gray-50` `#f1f2f5`, 글자 `night-950` `#0a0e1c`(`palette.ts` `TOKEN_COLORS.ring`·`ringOutline` 과 같은 값). **동기 시험은 `test/unit/palette.test.ts` 를 늘리는 것뿐이다**(`design/tokens.json` 의 `seat-1..8` 이름을 읽어 대조; `gen-tokens.mjs --check` 는 이 파일을 보지 않는다 — 결론 5).

**런타임 배선(GameMap 을 건드리지 않는 경로).** `SceneLook`(`src/world/presence.ts:52-`)에 `notes?: Readonly<Record<number, readonly number[]>>`(받은 좌석 → 붙인 좌석 쌓기, 최대 3) 를 더하고 `sceneLook(view, …)`(GameMap 이 이미 부름, `GameMap.tsx:633-639`)이 `suspectStacks(view)` 에서 채운다 → **GameMap 수정 없이** `runtime.setScene(look)`(`runtime.ts:247,1498`)이 받는다. 런타임은 좌석별 `NoteRig`(자식 메시들)를 `handle.root.getObjectByName("body")` 에 붙이고(시험용 가짜 캐릭터에는 `body` 가 없으면 무동작), 처음 받은 프레임(`fresh`)은 모션 없이 상태만 맞추고 이후 차이에서 붙음 280ms·떨어짐 600ms(+80ms 간격)·`reducedMotion()`(`WorldRuntimeDeps.reducedMotion`, `runtime.ts:179`) 즉시 전환을 한다. 유령(`SeatLook.ghost`)·죽은 좌석은 `suspectStacks` 가 제외하고 런타임이 ghost 전환 순간 종이를 모션 없이 뺀다 — **`setGhost(true)` 는 관절 메시만 숨기고 `body` 의 자식 종이는 그대로 남기 때문**이다. 결과·쉬는 사람 장면(`ResultScreen`·`BenchView` 의 `SceneLook`)에는 `notes` 를 넣지 않는다(기본값 종이 없음). 가짜 캐릭터·`dispose`: 종이 지오메트리·텍스처·재질은 모듈 공유(캐릭터가 `dispose` 로 해제하지 않는다) — 액터 제거 시 `rig.detach()` 로 메시만 뗀다. E2E 훅: `HookRuntime`(`testHooks.ts:70`)에 `suspectNotes()`(좌석별 `{ total, visible }`, 공개 값만)를 더해 `__mfWorld.suspectNotes()` 로 노출(UI-SPEC 문언 그대로, Q4).

**성능 측정(명령).** 기준선 [VERIFIED: .planning/phases/20-map-expansion/perf/nightload-390x844-x4-plaza.json 읽음]: 광장 `discussion` calls 49, `nomination`·`defense`·`verdict`·`execution` 70~71, 점광원 3, 평균 59.7fps·끊김 2. 바 맵은 같은 단계별 값이 기록돼 있지 않다(18.1 의 `before.calls` 34 만). 종이 최악(8장) 측정은 현재 스크립트가 못 한다 — `src/debug/perf/perfScene.ts` 가 실제 `createWorldRuntime` 으로 캐릭터를 올리므로(`mount`, line 41-) `parsePerfParams` 에 `notes=N`(0~8) 을 더하고 `runtime.setScene` 에 종이를 넘기게 한 뒤 `scripts/perf-run.mjs` 에 `--notes N` 을 더한다. 측정 명령: `node scripts/perf-run.mjs --url http://localhost:5173 --scene talk --minutes 1 --throttle 4 --size 390x844 --outfits mix --notes 8 --file notes8` 와 `--notes 0 --file notes0`(같은 조건 대조), 결과 JSON `renderer.callsMax`·`frames.avgFps`·`frames.jank`·`renderer.pointLights` 를 합격선(120·55·5·3)과 대조. `perfbudget` E2E 흐름(`flows.mjs:1271-`)의 `B1` 은 `callsMax ≤ 120` 판정이 이미 있다. 알려진 이월: `perfbudget` `B2`(점광원)·`M1` 은 13페이즈 전부터 실패(HANDOFF) — 종이가 원인이 아님을 notes0 대조로 가른다.

### P5. 기록 카드 일반화 — 개명 영향 목록 (조사 3)

탭 키 `answers`→`records`, 라벨 "첫날 답"→"답과 의심", 시트 제목 "모두의 답"→(탭 선택 시) "모두의 기록", 구역 클래스·표식은 `data-log-day`(결론 3). 바꿔야 할 모든 곳(이 세션 `rg` 로 수집):
- `src/components/RoleCardSheet.tsx`: line 15 `RoleCardTab`, 31 `TAB_LABEL`, 49-53 `tabRefs`, 54-64 `tabOrder`·`selectedTab`·`showingAnswers`, 120-121 패널 분기, 133 제목, 153-195 `AnswersPanel`→`RecordsPanel`(일차 구역 배열: `days = [{ n:1, rows }]` 하드코딩을 `suspectLogByDay` 로 일반화 — 최신 일차 위·구역 머리 sticky). 탭 존재 조건: `keywordAnswersOf(view) !== undefined || (view.day?.suspectLog?.length ?? 0) > 0`.
- `src/screens/RoomScreen.tsx:348-359`: 자동 열림 `setRoleCard({ open: true, tab: "answers" })` → `"records"`(조건 `dayNumber !== 1` 그대로 — 둘째 날 이후 자동 열지 않음, P24-19).
- `test/client/roleCardSheet.test.tsx`: line 448(`tab: RoleCardTab = "answers"`), 465-474·504-521(탭 이름·`onTab` 인자 `"answers"`), 490-493(제목), 526-575(구역 목록), 594-597(`.mf-answers` 클래스 존재). `test/client/roomScreen.test.tsx`: 792(`[data-rolecard-tab="answers"]`), 810, 818(`"모두의 답"`).
- `scripts/e2e/keyword.mjs`: 181-201·386·549-556·580(`[data-rolecard-tab="answers"]`, 라벨 "첫날 답") + 표식 읽기(`[data-answer-list]`·`data-answer-row` 는 첫날 구역 안에 **그대로 둔다**).
- `scripts/e2e/browser.mjs:73-79`(`dismissAnswerSheetInit`): `dialog[aria-label="모두의 답"]` → `"모두의 기록"` 도 닫게(두 이름 모두; 결론 4).
- `docs/screen-map.md:203,212,227,228`. `scripts/uat-test-room.mjs:226` 의 "첫날 답" 은 데이터 설명 문구라 그대로.
- `src/styles/rolecard.css:103-123` `.mf-answers*` 는 구역 머리 sticky·의심 줄 클래스를 더하고 기존 규칙은 그대로(`rolecard.css` 시험 `roleCardSheet.test.tsx:594-597` 가 `.mf-answers` 존재·hex 없음을 본다).
- `src/net/recordsSeen.ts`(활동 기록 안 읽음 점)는 탭 이름과 무관(`activity` 탭만) — 변경 없음.

### P6. 튜토리얼 (조사 4)

**옛 구현 구조(`git show 00829164^`, 파일·핵심 API만).** 삭제 커밋 `00829164`(화면·부품·소리 64파일), 서버 단계 삭제 `2bde5f7c`, E2E 흐름 삭제 `e11274cd`(원 흐름 `83d2d2ff test(17-09): tutorial-solo 트레이서`).
- 대본: `src/game/tutorialScript.ts`(417줄) — `TutorialSceneNo`·`TutorialLineKey`·`TutorialBeat`·`TutorialFocusWindow`·`TutorialAdvance`·`TutorialScene`, `TUTORIAL_CAST`(출연 상수만으로 가짜 방 구성), `TUTORIAL_SCENES`(표), `tutorialView(n, at)`·`tutorialStageView`·`tutorialStageLook`(장면별 가짜 `RoomView`/`SceneLook`), `tutorialSnap(n, now)`(가짜 월드 스냅), `makeTutorialSend({onErrand,onInspect,onPoint})`(로컬 send 어댑터), `tutorialCameraOf`.
- 화면: `src/screens/TutorialScreen.tsx`(435줄) — 실제 `GameMap`(가짜 view·로컬 `WorldStore`/`ChatStore`·로컬 send)과 `WorldStage`, `applyInert(root, n, marked)` 로 **허용 대상 밖에 `inert`**(허용 대상은 차단 컨테이너 밖에 둬야 한다는 규칙: "inert 는 자손이 풀 수 없다"), `useTutorialDirector`(소리), `FocusRing`, 진행 점·건너뛰기·다음.
- 부품: `FocusRing.tsx`(173줄 — `FocusGroup{key,selectors,extendDown?,pill?,lit?}`, DOM 사각형을 rAF 로 재서 사방 8 키운 상자, svg mask 스포트라이트, 화면 가장자리 8 안으로 밀기, `TUTORIAL_DIM_ALPHA = 0.5`), `OpeningFx`·`TutorialRoleCards`·`TutorialReveal`·`TutorialEvidence`·`TutorialHostBand`·`TutorialNext`·`TutorialProgress`·`TutorialWait`·`TutorialEndCard`·`TutorialEntry`, 스타일 `tutorial.css`(387)·`tutorialEntry.css`·`tutorialRoom.css`.
- 시험: `test/unit/tutorialStaticGuard.test.ts`(228줄, 금지 정규식 `useRoomConnection|useDayFx`·`me.role`·`allies`·`loadLastNickname`·`innerHTML`·`fetch(|new WebSocket`), `test/client/focusRing.test.tsx`(370), `tutorialScreen/Scenes/Entry/Gate/Together/Opening/Wait/HostBand` 8파일, `test/helpers/fakeTutorialStage.ts`(97 — `vi.mock("../../src/components/WorldStage")` 로 받은 props 를 기억하는 가짜 스테이지), `test/unit/tutorialScript.test.ts`(620).
- 저장 키: 옛 `TUTORIAL_SEEN_KEY = "minifia.tutorial.seen"`(session.ts, 점 표기). 새 키는 UI-SPEC 대로 **`minifia:tutorialSeen` = `"1"`**(콜론, 현재 `SESSION_KEY = "minifia:session"`·`NICKNAME_KEY = "minifia:lastNickname"` 와 같은 표기; `read/write` 는 모듈 안 비공개 도우미를 써 메모리 대체까지 얻는다).

**되살릴 것 vs 새로 쓸 것.**
| 구분 | 항목 | 방법 |
|------|------|------|
| 되살림 | `FocusRing.tsx` 논리(측정·사방 8·가장자리 밀기·구멍 마스크) | `git show 00829164^:src/components/v2/FocusRing.tsx` 를 `src/components/tutorial/FocusRing.tsx` 로, **CSS 는 새로**(옛 `tutorial.css` 는 `brass-400`·`night-950` 반투명 — 새 계약은 `--scrim`·`light-lamp` 4px·정지 중간 번짐, 새 토큰 0) |
| 되살림 | `focusRing.test.tsx` 핵심(대상 못 쟀으면 안 그림·rAF 직전과 같으면 상태 불변·사방 8) | 같은 방식으로 이름만 바꿔 복사 |
| 되살림 | `tutorialStaticGuard.test.ts` 골격 + `fakeTutorialStage.ts` 패턴 | 아래 정적 가드 설계로 확장(모듈 그래프) |
| 되살림 | `applyInert` 아이디어(대상만 열고 나머지 `inert`) | 새 대상 표(`send`·`endDiscussion`·`yes`·`tag-4`·`face-0`·`suspect-btn`)로 다시 |
| 새로 | `tutorialScript.ts`(열 장면 표·출연 6명·가짜 view 생성기·대본 글) | 아래 입력 목록 |
| 새로 | `TutorialScreen`·`TutorialFrame`(진행 점·알약·[그만두기])·`useTutorialScene` | 시각표 훅 |
| 새로 | 사회자 띠 | **실제 `HostBand` 그대로**(옛 `TutorialHostBand`·파형·웅얼 목소리 쓰지 않음) |
| 버림 | `OpeningFx`·`TutorialRoleCards`·`TutorialEvidence`·`tut.*` 소리 | UI-SPEC "쓰지 않는 참고" |

**새 `RoomView` 에 맞춘 가짜 view 입력(`satisfies RoomView` 로 만든다 — 타입이 바뀌면 컴파일러가 잡는다).** 코드로 확인한 화면 부품의 읽는 값:
- 공통: `code`("" 방 아님)·`phase`·`round`·`serverNow`·`minPlayers`·`maxPlayers`·`players`(6명, 좌석 0~5, 좌석 5 = 나/`coat`)·`me.seat=5`·`me.role="citizen"`(장면 2b 마피아 `???` 는 **`me.role="mafia"` 별도 view**, `me.keyword` 키 없음)·`map`("bar" 또는 "plaza").
- `day`(`DayView`): `n`, `roles`, `keyword?: {genre:"동물", answers?, answer?}`(장면 3 의 답 목록 — `answers` 6줄, 하린 `text:null`), `endCount`(토론), `verdictCount`(`{yes, no}` 찬반 줄), `turn`(`PickTurnView`, 장면 6 차례 지목 블록), `points`, `candidate`(유언·처형), `execution`(`{seat, will}`), `suspects`·`suspectLog`(장면 9), `morning`(장면 8 아침 막간).
- `me.answer`(장면 2c 입력칸 선채움: **초안 복원 경로** `useKeywordAnswer` 의 `serverText` → 입력값, [VERIFIED: src/net/useKeywordAnswer.ts:72-90] `endsAt === null` 이면 `locked` 가 거짓이라 잠금 없음, `secondsLeft` 0), 확정 뒤 `{text, final:true}`.
- `me.suspectTo`(장면 9b 이후 "옮기기" 점), `me.verdictVote`(장면 5), `me.pick`(장면 8), `me.endDiscussion`(장면 4).
- **시계 값**: `phaseEndsAt`/`phaseDurationMs`. [VERIFIED: src/components/v2/HostBand.tsx:114-148] 시간 행은 `showTime && endsAt !== null && durationMs !== null` 일 때만 그려지므로 **`null` 이 이미 "시간 없음" 표현**이다(로비도 `null`). 그러나 **연출은 시계로 돈다**: `RoleReveal`(`autoFlipDelayMs(endsAt, durationMs, offset, Date.now())`, [VERIFIED: src/net/cardFace.ts] `AUTO_FLIP_MS = 5_000`, `t0 = phaseEndsAt − phaseDurationMs`), `Keyword`(카드 등장 모션 `CARD_ENTER_MS`), 처형 순간(`useVerdictMoment(view, offset)`, 처형 진입 시각 기준 0~3.0초 막·핀·카드), `SceneCurtain`·낮 시작 발표. → **해결: 장면 시작 시각 기준의 실제 `phaseEndsAt/phaseDurationMs` 를 가진 view 를 화면 부품에 주고, `HostBand`·헤더에는 시계를 `null` 로 지운 사본을 준다**(UI-SPEC "시간 링·시간 행은 `data-tutorial` 이 있으면 그리지 않는 분기"를 부품 수정 없이 얻는다). `Keyword.tsx` 의 `{secs}초` 메타(`KEYWORD_COPY.secs(answer.secondsLeft)`, `Keyword.tsx:140`)는 `endsAt === null` 일 때도 "0초" 를 그리므로 **그 한 줄만 `timeless` 분기**가 필요하다(시간 없는 view 를 줄 때).
- 로컬 `WorldStore`: `applyFrame({t:"world",k:"snap",at,ents},0)` 로 좌석 6의 구간 설정, `{k:"move"}` 로 장면 연출 이동, `applyEmote`(`deny`·`point`·`clap` 은 [VERIFIED: shared/protocol.ts:448] `EMOTE_IDS = ["throat", "deny", "clap", "cry", "handshake", "point", "praise", "surprise", "dance"]` 에 있다). `ChatStore.apply(frame, epoch, now)`/`addSystem` 으로 장면 4 채팅 줄 세 개.
- 카메라·막: `GameMap` 의 `panelless`·`camera`·`tod={false}`·`roleCard` prop 은 옛 튜토리얼용으로 **남아 있다**([VERIFIED: GameMap.tsx:123-128]). 처형 연출 `fading`·`announce`(RoomScreen 이 `useDayFx` 로 만드는 값)는 정적 가드가 `useDayFx` 를 금지하므로 **스크립트가 값을 직접 만들어 prop 으로** 준다(장면 7·8).
- 튜토리얼 전용 GameMap 보정: 아래 막대(진행 점+알약 60)용 `stageInsets.bottom` 가산(`bottomExtra`) 한 prop.

**정적 가드(T-17-10 스타일, 모듈 그래프 확장).** [VERIFIED: 이 세션 `rg`] 네트워크를 쓰는 소스는 **`src/net/api.ts`(`fetch(`)와 `src/net/useRoomConnection.ts`(`new WebSocket`) 두 파일뿐**이다. [VERIFIED: 이 세션 실행 — 값 import 폐포 계산] `GameMap`·`PreGame`·`Keyword`·`RoleReveal`·`RoleCardSheet`·`HostBand` 에서 시작한 비타입 import 폐포(134 파일)에 `net/api.ts`·`net/useRoomConnection.ts`·`net/session.ts` 가 **없다**. 그러므로 가드는 ① `src/screens/TutorialScreen.tsx` 와 `src/game/tutorialScript.ts`·`src/net/useTutorialScene.ts`·`src/components/tutorial/*` 에서 시작해 `import type` 과 `type` 한정 import 를 건너뛰고 상대 경로를 따라 **폐포를 구한 뒤**, 폐포에 위 세 파일이 하나도 없음과 금지 정규식(`innerHTML` 계열·`me.role` 읽기·`useDayFx`·저장 닉네임·`sendBeacon`)을 단언하고 ② E2E 가 진입 후 `/api` 요청·WebSocket 0건을 본다. 가드가 그래프를 계산하는 코드는 이 세션의 스크래치 스크립트(`graph.mjs`)와 같은 20줄이다.

**Home 진입.** `Home.tsx` 의 `.mf-entry__actions` 는 현재 `FORM`(방 코드+[참가]) → `[방 만들기]` 순서이고 [VERIFIED: test/client/screens.test.tsx:58-59] 시험이 `FORM,BUTTON` 을 단언한다. **뒤집을 시험**: `screens.test.tsx:55-59`("튜토리얼 진입 … DOM 0건"은 `[data-tutorial], [data-tutorial-entry], [data-tutorial-end], [data-tutorial-toggle]` 0건 + `FORM,BUTTON`)을 "[혼자 하기] 있음·`data-tutorial-entry` 1건·`FORM,BUTTON,BUTTON`·저장 키 없으면 `data-call`" 로 바꾼다. 그대로 두는 시험: `joinByLink.test.tsx:96-101`(링크 참가 화면에는 `[data-tutorial-entry]` 0건 — 진입은 `Home` 에만), `lobby.test.tsx:1204-1248`(방장 [튜토리얼 먼저]·`start` 에 tutorial 키 없음), `resultScreen.test.tsx:1471-1477`. E2E 의 꺼진 장치 감시(`OFF_DEVICE_SELECTORS` 의 `[data-tutorial]` 정확 속성)는 새 표식 `data-tutorial-screen`·`data-tutorial-entry` 와 이름이 달라 그대로 통과한다 — 단 **새 속성 이름이 `OFF_DEVICE_ATTR_PREFIX`(`data-errand`·`data-clue`·`data-board`·`data-record`)로 시작하면 안 된다**(결론 3, `e2eContract` 에 "새 표식이 접두로 시작하지 않음" 시험 추가 권장). `[혼자 하기]` 를 누르면 `unlockAudio()` 를 같은 틱에서 먼저 부르고(Home 의 다른 단추 규칙, `Home.tsx:74·84·109`), `markTutorialSeen()`, `setTutorial(true)` 로 `TutorialScreen` 이 첫 화면을 덮는다(`Home` 이 닉네임·코드 상태를 쥔 채 — 그만두기·끝은 `setTutorial(false)` 만). `pushState` 없음.

**튜토리얼 E2E 흐름 설계(`tutorial` 흐름, 폰 6종 가능·한 크기 약 34초로 옛 선례).** 소스 `scripts/e2e/tutorial.mjs`(+`tutorial.test.mjs`)에 순수 판정 함수 + 얇은 흐름. 순서: 첫 화면 → [혼자 하기] 존재·`data-call`(저장 없음) → 누름 → 이후 **`page.on("request")`·`page.on("websocket")` 로 `/api` 요청·WS 0건** → `window.__mfTutorial.scene()` 이 `roles→…→end` 순서로 도는지(하기 장면은 링 대상 누름, 12초 대행 경로 1회는 `skipTo` 대신 실제 대기가 비싸므로 **단위 시험이 대행 타이머를 가짜 시계로 시험**하고 E2E 는 `skipTo`+링 누름) → 알약 `scrollWidth ≤ clientWidth`·17자 이하 → 장면 9 [의심]→하린 이름표 `data-suspects` 1→0(`__mfWorld.suspectNotes()`) → [그만두기]·[홈으로] 가 첫 화면으로·닉네임 유지 → [다시 보기] = 장면 1. 하네스 훅 `window.__mfTutorial = { scene(), skipTo(id) }` 는 `?e2e=1` 문맥에서만 설치(`worldTestHooksEnabled` 규칙).

### P7. 페이즈 끝 — 회귀·D1·배포 (조사 5)

**전체 회귀 배치(실제 `selectFlows` 로 분할 검증).** [VERIFIED: scripts/e2e/lib.mjs:26,31] `export const MAX_PARALLEL = 3;` · `export const OVERALL_LIMIT_MS = 1_740_000;`. [VERIFIED: lib.mjs:1865-1868] `selectFlows` 는 `keys.some((k) => f.id.includes(k) || k.startsWith(f.id))` — **부분 일치 + 키가 흐름 id 로 시작해도 선택**(예: `night-sizes` 는 `night` 도, `keyword_` 는 `keyword` 만 고른다). 기본 폰 크기 4종(360x640·390x664·430x932·360x560) + 흐름별 추가 2종(390x844·402x874)으로 **기본 실행 49개 흐름·140작업**(skipByDefault 7개 제외, 이 세션 계산). 속도 실측 기준: 22-13 `실행 1` 21작업 209초, `실행 2` 24작업 349초, 23-12 `keyword,keyword-sizes,early` 8작업 65초 → 평균 약 8~15초/작업(병렬 3 기준) → 전체 140작업 ≈ 19~35분, 29분 한도에 걸릴 수 있어 **5배치**로 나눈다(배치당 5~9분 예상, 한도의 1/3 이하 — 추정 [ASSUMED]).

| 배치 | `--only` | 흐름 수·작업 | 비고 |
|------|----------|--------------|------|
| B1 로비·월드·채팅·맵 | `lobby,world,chat-ime,chat-keyboard,map-select,host-handoff,pc,wakelock` | 10흐름·35작업 | `lobby` 가 `chat-lobby` 포함, `chat-ime` 가 `chat-ime-360x560` 포함 |
| B2 낮 핵심 | `day,ghost,vote-count,will-flow,noexec,basic-off,basic-vote,chat-game` | 9·29 | `will-flow` 가 `will-flow-sizes` 포함. `basic-off` 에 OFF1 |
| B3 키워드·밤·결과·정치 | `keyword,early,night-sizes,result,politics-pin,politics-verdict` | 11·36 | `result` 가 `result-reveal`·`result-rematch`·`sound-result` 포함, `night-sizes` 가 `night` 포함 |
| B4 아바타·소리·사회자 | `avatar,sound,emcee` | 13·33 | `sound` 가 `sound-result`(B3 와 겹침 1) |
| B5 나머지 + 새 흐름 | `polish,reconnect,perfbudget,suspect,tutorial` | 3·8 + 새 흐름 | 새 흐름 이름은 `suspect`·`suspect-sizes`·`tutorial` 로 하면 다른 배치 키(`day`·`night`·`early`…)와 겹치지 않는다 |

검증: 5개 키 묶음을 실제 `selectFlows(FLOWS, only)` 로 돌려 **기본 흐름 49개 모두 포함·누락 0·겹침 `sound-result` 1개·skipByDefault 선택 0** 확인(이 세션 실행). 배치는 **순차 실행**(한 번에 하나, Chrome·DO 쓰기 부하). 명령: `npm run dev`(이미 5173 에서 떠 있을 수 있으나 낡은 코드일 수 있으니 새로 띄운다) 후 `npm run e2e -- --url http://localhost:5173 --only <키 묶음>`. 새 흐름 이름이 정해지면 위 분할 검증을 스크립트로 다시 돌린다(Wave 0 에 `scripts/e2e/` 시험으로 고정 권장: "기본 흐름 전부가 5배치 중 하나에 든다").

**알려진 간헐과 구분법.**
| 간헐 | 어디 | 증상 | 구분 |
|------|------|------|------|
| `test/worker/basicDay.test.ts`(vitest worker) | 전체 `npx vitest run` | 처형자가 무작위로 마지막 마피아면 판이 끝나 `night` 기대가 어긋남(0091-24) | `npx vitest run --project worker test/worker/basicDay.test.ts` 단독 재실행 통과 |
| E2E `world` @360x560 | B1 | "이동 목적지를 못 찾음" — STATE.md 미룬 항목(07-13 이후 기존 실패, `acknowledged`) | `--only world --sizes 360x560` 재실행에서 **같은 증상(목적지 탐색)** 이고 이 페이즈 변경과 무관(포스트잇은 로비 단계가 아님) |
| `reconnect` RC1 | B5 | 병렬 부하에서 한 번 실패(미룬 항목) | 단독 재실행 통과 |
| `ghost` GH13 @390x664 | B2 | 유령 이름표 대비 4.5:1 한 이름표 1.19:1(22-13 기록) | `--only ghost --sizes 390x664` 재실행 |
| `perfbudget` B2·M1 | B5 | 13페이즈부터 지속(HANDOFF) | 종이 0장 대조(`--notes 0`)와 같으면 비회귀 |
규칙: **알려진 목록에 있고 실패 항목 id·증상이 같을 때만** 간헐로 본다. 그 밖 실패는 회귀로 조사한다. 간헐을 `retry`·skip 으로 덮지 않는다(`flakeGuard.test.ts`).

**로컬 D1 상태 공유(A1) — 확인됨, `scripts/games.mjs` 수정 불필요.**
- 정적 근거 1: [VERIFIED: node_modules/@cloudflare/vite-plugin/dist/index.mjs:95469] `return path.resolve(root, typeof persistState === "object" ? persistState.path : ".wrangler/state", "v3");` 기본 `persistState ?? true`(line 71957). 로컬 D1 id: [VERIFIED: node_modules/wrangler/wrangler-dist/cli.js:183878] `const id = getRemoteId(preview_database_id ?? database_id) ?? binding;` → `database_id` 가 없으면 `"DB"`.
- 정적 근거 2: [VERIFIED: wrangler/wrangler-dist/cli.js:238177-238186] `d1 execute --local` 은 `const id = localDB.previewDatabaseUuid ?? localDB.uuid ?? localDB.binding;` 와 `resourcePersistencePath = path.join(persistencePath, "v3")` 를 쓰고 `persistencePath` 는 `getLocalPersistencePath` 가 wrangler 설정 파일 기준 `.wrangler/state` 로 푼다 → **같은 폴더 `.wrangler/state/v3/d1`·같은 id → 같은 sqlite 파일**.
- 실측: [VERIFIED: 이 세션 실행] `node scripts/games.mjs --all` → "판 33", `wrangler d1 execute DB --local --json …` → `n 33, with_bots 33, note_count 0, tutorial 0`, 첫·끝 `ended_at` = 2026-11-17 04:18·04:39 KST(23-12 E2E 가 `vite dev` 로 돌린 시각). 이 행들을 쓴 프로세스는 `vite dev` 워커뿐(워커 시험은 메모리 D1)이므로 두 도구가 같은 DB 를 본다. 기본 `npm run games` 는 `has_bots = 0` 만 세서 "아직 기록이 없어요"가 나온다(E2E 판은 모두 봇/테스트 방).
- **주의**: 배포 첫 단계에서 `wrangler.jsonc` 에 `database_id` 를 쓰면 로컬 id 도 uuid 로 바뀌어(두 도구 모두 같은 규칙) 로컬 D1 은 새 빈 DB 가 되고 `d1 migrations apply DB --local` 을 다시 해야 `vite dev` 가 행을 쓴다(쓰기 실패는 삼켜지므로 조용히 안 보인다). 그래서 로컬 확인은 **id 를 쓰기 전**(배포 순서의 앞)에 끝낸다. 사람 판 확인: `node scripts/smoke.mjs http://localhost:5173 --stage full --players 4`(`has_bots=0`) 뒤 `npm run games`.

**배포 순서와 정지 조건(0091-18 + D-20).** [VERIFIED: scripts/check-account.mjs] `judgeWhoami` 는 `wrangler whoami` 출력의 이메일을 `EXPECTED_EMAIL`(개인 계정)과 비교해 로그아웃·다른 계정·wrangler 실패면 종료 상태 1. 이 세션 실행 결과: `node scripts/check-account.mjs` → "배포 계정 확인: …"(통과) — **실행 시점에 다시 확인**해야 한다.
0. **사전 점검(읽기 전용)**: `node scripts/check-account.mjs`(실패면 **즉시 정지**), `npx wrangler d1 list`(이미 `minifia-v3-games` 가 있으면 정지·보고 — 중복 생성 금지), 배포 전 버전 기록 `node scripts/smoke.mjs --prod --print-version`(HANDOFF 기록: `2026-11-15T13:03:01Z+e3cb26fa`).
1. **정지 조건(고정)**: 위 0 의 `check-account` 가 통과하지 못하면(로그아웃·다른 계정·실행 실패) **로그인 시도(`wrangler login`)·`--force`·가드 우회 없이** 배포 단계 전체를 건너뛰고, HANDOFF·0092 에 "배포 보류 — 개인 계정 로그인 필요, 남은 명령 6개"를 적고 오케스트레이터에 정지·보고한다. 로컬 부분(회귀·문서)은 완료로 둔다.
2. `npx wrangler d1 create minifia-v3-games --location apac` → 출력의 `database_id` 를 `wrangler.jsonc` `d1_databases[0]` 에 **손으로** 기입(`--update-config` 금지 — 주석 있는 jsonc 를 다시 쓸 수 있음). id 값을 문서·커밋 메시지·SUMMARY 에 옮기지 않는다(`wrangler.jsonc` 파일 자체는 커밋 대상 — Q6).
3. `npx wrangler d1 migrations apply DB --remote`(대화형 확인을 물으면 **멈추고 보고** — 비대화형 기본값은 [ASSUMED]) → `npm run games -- --remote`(`judgeWhoami` 를 한 번 더 거침, 기대 "아직 기록이 없어요").
4. `npm run deploy`(= `check-account → vite build → check-deploy-target → wrangler deploy`; [VERIFIED: package.json] `"deploy": "node scripts/check-account.mjs && vite build && node scripts/check-deploy-target.mjs && node scripts/deploy.mjs"`). 추가 인자·`--name` 금지(`deploy.mjs` 가 인자를 받으면 멈춘다). `check-deploy-target` 은 `database_id` 없는 D1 항목이 있으면 멈춘다(2 를 건너뛰면 여기서 막힘).
5. 배포 후: `curl <주소>/api/health`(또는 `smoke --print-version`)로 새 버전 확인 → `npm run smoke -- --prod`(생성 단계) → `node scripts/smoke.mjs --prod --stage full --previous-version "<배포 전 버전>"` → `npm run games -- --remote`(smoke 판 1행: `players 5, has_bots 0, tutorial 0` — 결론 11). **배포본에 전체 E2E 를 돌리지 않는다**(결정 0076 쓰기 예산, `npm run e2e` 는 인자 없으면 배포본을 검사하므로 `--url` 없이 부르지 않는다).
6. `main` 은 건드리지 않는다. 브랜치 `v3` 만 push.

**문서 산출물(D-21).** ① `docs/decisions/0092-v3-suspect-note-tutorial.md`: 규칙(둘째 날부터·단계·거리 240·간격 600ms·옮기기 제거후추가)·메시지 `suspect`·view 모양 세 개·종이 치수(교정 후 실측값)·쌓기 3장+칩·기록 탭 "답과 의심"·튜토리얼 열 장면(혼자 하기만)·저장 키·배포 결과(또는 보류)·알려진 한계(등 쪽 종이 안 보임·종이 글자 가독성·튜토리얼 장면 1→2·7→8 무대 재생성·smoke 판 1행·UI-SPEC 교정 여섯). ② `docs/product.md`(포스트잇·튜토리얼 문단), `docs/architecture.md`(상태 `notes`·메시지·view·D1 `note_count`·종이 렌더·튜토리얼 로컬), `docs/screen-map.md`(입력줄 [의심]·종이·기록 탭·튜토리얼 절·표식 표 — 기존 line 203·227·228 정정, 표식은 `data-log-day`). ③ HANDOFF(6KB 이하, 현재 5,564바이트로 여유 약 580바이트 → **23·22 의 해결된 문장을 지우며 쓴다**, 구역은 세 개만 — `test/unit/handoff.test.ts`): "v3.0 구현 끝·배포 여부·실테스트 대기", 사용자 할 일(키워드 목록 306개 검토, 실기기 확인 항목 — 22·23·24 모음, main 반영 결정, smoke 판 1행 확인). ④ 위생 `git grep`(위 Project Constraints 의 절 참조) 0건 확인 후 커밋.

### Anti-Patterns to Avoid
- **귓속말처럼 방송을 건너뛰기**: 포스트잇은 공개 값이라 전원이 새 view 를 받아야 종이가 모든 폰에 나타난다. `sendViewTo([playerId])` 만 하면 다른 폰에는 종이가 안 생긴다.
- **내 예측 위치로 "근처" 판정**: 서버 구간과 달라 거절 알림이 늘어난다(P2).
- **UI-SPEC 의 `data-record-day`·"모두의 기록" 문언을 그대로**: 하네스·OFF1 이 깨진다(결론 3·4).
- **튜토리얼에서 실제 `useRoomConnection`·`useDayFx`·`session` 을 부르기**: 정적 가드와 D-15 위반.
- **종이를 병합 지오메트리 경로·`character.ts` 몸통 병합에 넣기**: 옷 교체·표정 병합 캐시가 종이를 지우거나 남긴다. `body` 의 별도 `Mesh` 자식으로만.
- **`take()` 가 기억을 지운다는 점을 놓치고 suspect 분기를 배지 분기 뒤에 두기**(P3-1).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 두 사람 거리 | 새 거리 계산 | `shared/game/world.ts` `positionAtFx`(+ 정수 제곱 비교) | 서버·폰이 같은 반올림·같은 구간. `fillChalk` 선례 |
| 이름표를 눌러 고르는 모드 | 새 오버레이 | `WorldStage.tsx` `WorldPick` + `stageTagProps` `blink` | 걷기·`stopPropagation`·접근성이 이미 해결 |
| 거절 알림 | 새 토스트 | `useTopToast`(`show(text, icon)`) + `emitSignal({kind:"deny"})` | 2.5초·소리 규칙 |
| 모드 훅 | 새 상태기계 | `useWhisper` 구조 복제(`useSendGuard` 종류만 추가) | Esc·단계 이탈·연타 막이 |
| 정렬·sticky 구역 | 새 시트 | 기존 `Sheet`/`RoleCardSheet` 탭 구조 | 탭 키보드·초점 이미 있음 |
| 손글씨 글꼴 | 새 글꼴 파일 | `penFont.css`(Nanum Pen Script, 이미 서빙) + `document.fonts.load(…, "의심")` | unicode-range 조각 로딩 |
| 알약·진행 점·링 | 새 애니메이션 | 되살린 `FocusRing` + CSS `transform`·`opacity` | 승인된 포커스 규칙(0078-8·0081) |
| 튜토리얼 소리 | 새 레시피 | `emitSignal`(`tap`·`card`·`host`) | D-17, 새 소리 금지 |
| 판 단계 재생 | 튜토리얼 전용 단계 | 실제 `GameMap`/`PreGame`/`Keyword` + 가짜 view | UI-SPEC "가짜 단추를 만들지 않는다" |

**Key insight:** 이 페이즈의 "새 기능"은 대부분 이미 있는 패턴의 재배선이다. 새로 만드는 진짜 신규는 (1) 종이 3D 한 장과 텍스처, (2) 튜토리얼 장면 표·시계 처리, (3) 5배치 회귀 운영뿐이다.

## Runtime State Inventory

이름 바꾸기·마이그레이션 페이즈가 아니다. 다만 새 저장 상태가 있어 확인했다:
| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | DO `room` 키의 `notes`(선택 필드). 옛 방은 키가 없어 읽는 쪽 기본값 `[]` | 코드 변경 없음(`LEGACY_V3_*` 에 넣지 않는다, D-08) |
| Stored data | D1 `games.note_count` 열은 이미 존재(0 고정이던 값) | 마이그레이션 없음, `buildGameRow` 값만 바꿈 |
| Live service config | 원격 D1 `minifia-v3-games` 없음(`wrangler.jsonc` 에 `database_id` 없음) | P7 순서대로 생성(개인 계정 확인 뒤) |
| OS-registered state | 없음 | — |
| Secrets/env vars | 없음(토큰은 `wrangler` 로그인) | — |
| Build artifacts | `dist/`·`.wrangler/state`(gitignored) | 로컬 D1 은 `database_id` 기입 시 새 id 로 바뀜(P7 주의) |

## Common Pitfalls

### Pitfall 1: 거절 응답이 사유별로 갈라진다
**What goes wrong:** `whisper.ts` 모양을 따라 단계 어긋남에 `WRONG_PHASE` 를 쓰면 화면의 "가까이 가야 붙여요" 알림이 안 뜨고(P24-5 판정 실패) 귓속말과 달리 사유가 드러난다.
**How to avoid:** `stickNote` 는 `BAD_MESSAGE` 한 가지, `GameMap` 분기는 `BAD_MESSAGE` 만 처리. 시험: 마감된 단계·첫날·죽은 대상·멀리 있음·자기 자신이 **같은 두 프레임**.

### Pitfall 2: 거리 판정이 서버와 폰에서 갈린다
**What goes wrong:** 폰이 예측 위치·보간 위치로 켜서 서버가 거절 → 모드가 이미 끝난 채 알림만 뜬다.
**How to avoid:** 둘 다 서버 구간(`segOf`) + 같은 함수 + 92% 켜는 문턱·100% 끄는 문턱(히스테리시스). 단위 시험: 같은 구간·같은 시각이면 서버·클라이언트 판정이 항상 같음(켜는 문턱 ⊂ 서버 허용).

### Pitfall 3: 시트 제목·마커 개명이 E2E 를 줄줄이 깬다
**What goes wrong:** `dismissAnswerSheetInit` 의 `aria-label` 이 안 맞아 자동으로 열린 시트가 모든 낮 흐름의 클릭을 가린다(23-12 에서 이미 한 번 겪은 증상). `data-record-day` 는 OFF1 접두 감시에 걸린다.
**How to avoid:** 결론 3·4 대로 한 계획에서 하네스까지 고치고, `lib.test.mjs`/`e2eContract` 에 "새 표식은 `OFF_DEVICE_ATTR_PREFIX` 로 시작하지 않는다"·"하네스가 현재 시트 이름을 닫는다" 시험.

### Pitfall 4: 종이가 유령에게 남는다
**What goes wrong:** `setGhost(true)` 는 관절 메시만 숨겨서 `body` 자식 종이가 유령 위에 떠 있다.
**How to avoid:** `suspectStacks` 가 죽은 받은 좌석을 제외하고 런타임이 ghost 전환에서 `rig.clear()`; 시험: 산→유령 전환 프레임에 종이 메시 0, 모션 없음.

### Pitfall 5: 튜토리얼 화면 부품이 시계에 묶여 "시간 없음"이 연출을 죽인다
**What goes wrong:** 가짜 view 의 `phaseEndsAt` 를 `null` 로 두면 역할 카드가 자동으로 안 뒤집히고, 처형 순간(`useVerdictMoment`)·낮 시작 막이 안 돈다.
**How to avoid:** 화면 부품에는 장면 시작 기준 실제 시계를, `HostBand`/헤더에는 시계를 지운 사본을(P6). `Keyword` 의 "0초" 메타만 `timeless` 분기.

### Pitfall 6: 화면 크기 추정이 `CHAR_SCALE` 을 빠뜨린다
**What goes wrong:** 0.32 단위가 19px 로 계산돼 14px 규칙을 놓친다(실제 15.5×12.6).
**How to avoid:** 모든 px 환산에 `CHAR_SCALE 0.83` 포함. 스크린샷 판정을 계획 완료 조건에 넣는다.

### Pitfall 7: 로컬 D1 이 새 id 로 갈아타면서 행이 조용히 사라진다
**What goes wrong:** `database_id` 기입 뒤 `vite dev` 가 마이그레이션 없는 새 DB 에 쓰려다 실패(삼켜짐)해 "행이 안 나옴"으로 오진.
**How to avoid:** 로컬 확인을 id 기입 전에 끝내고, 기입 뒤 로컬 확인이 필요하면 `npx wrangler d1 migrations apply DB --local` 부터.

### Pitfall 8: 전체 회귀가 한도·부하로 중단
**What goes wrong:** 폰 6종 흐름을 한 묶음에 몰아 부하 간헐(HANDOFF), 29분 한도 초과(`중단: 전체 1740초 제한 초과`, 종료 코드 2).
**How to avoid:** 5배치 순차, 실패는 그 흐름·그 크기만 단독 재실행.

### Pitfall 9: smoke full 이 첫 통계를 오염
**What goes wrong:** 배포본 `smoke --stage full` 이 `has_bots=0` 행을 만든다(사람 소켓 5개).
**How to avoid:** 0092·HANDOFF 에 "초기 1행은 smoke" 로 적는다. 원격 행 삭제는 하지 않는다.

### Pitfall 10: `MapHeader` 가 [의심] 모드에서 `LegacyMapHeader` 로 바뀐다
**What goes wrong:** `hintOverride` 를 주면 헤더에 시간 링이 생겨 레이아웃이 움직일 수 있다(귓속말 선례는 기본판에서 꺼져 있어 한 번도 실화면에서 검증되지 않았다).
**How to avoid:** 360×560·390×664 스크린샷으로 확인, 어긋나면 안내만 바꾸는 별도 경로.

## Code Examples

### 거절·옮기기 순수 함수의 시험 뼈대(단위)
```ts
// test/unit/postit.test.ts (Wave 0)
const world = { segs: { a: restSegment(0, 0, T0), b: restSegment(200, 0, T0), c: restSegment(300, 0, T0) } };
it("거리 240: 200 은 붙고 300 은 BAD_MESSAGE, 둘째 날 미만·토론 아님·죽은 대상·자기 자신도 같은 결과", () => {
  expect(stickNote(day2("discussion"), world, "a", seatOf("b"), T0).ok).toBe(true);
  for (const bad of [stick(day2("discussion"), "a", seatOf("c")), stick({ ...day2("discussion"), day: 1 }, "a", seatOf("b")), stick(day2("verdict"), "a", seatOf("b"))])
    expect(bad).toEqual({ ok: false, error: "BAD_MESSAGE" });
});
it("같은 n·from 으로 다른 대상: 길이 그대로·to 만 바뀜·끝으로 이동 / 같은 대상: 같은 state 객체", () => { /* … */ });
```

### 가짜 캔버스 컨텍스트로 굽기 시험(node)
```ts
const calls: string[] = [];
const ctx = new Proxy({}, { get: (_, k) => (...a: unknown[]) => { calls.push(String(k)); }, set: (_, k, v) => { calls.push(`${String(k)}=${v}`); return true; } });
const kit = createNoteKit({ makeCanvas: () => ({ canvas: { width: 128, height: 128 }, ctx: ctx as never }), loadFont: async () => true });
await kit.ready; expect(calls).toContain("fillText");   // "의심" 한 번, 폰트는 '44px "Nanum Pen Script"'
```

### 모듈 그래프 정적 가드(요지)
```ts
function closure(entry: string): Set<string> { /* import/export … from 와 import() 를 정규식으로 잡고, `import type`·전부 type 인 중괄호는 건너뛰고, 상대 경로만 .ts/.tsx/index 로 풀어 따라간다 */ }
for (const f of closure("src/screens/TutorialScreen.tsx")) expect(/src\/net\/(api|useRoomConnection|session)\.ts$/.test(f)).toBe(false);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 서버 `tutorial` 단계·`tutorialDone`·방장 [튜토리얼 먼저] | 서버 0 로컬 혼자 하기 | 22-03 삭제, 24 재작성(D-15) | 옛 방 정규화 표식과 이름 충돌 없음 |
| 확장판 등불·의심 보드 | 키워드 + 포스트잇 | 0089 | 보드 UI 없이 몸에 붙는 종이 |
| 귓속말(비공개 본문) | 포스트잇(공개 값) | 0089-10 | 방송 규율이 반대 |
| 튜토리얼이 서버 단계(0078) | 로컬 가짜 view + 실제 화면(0080-12) | 17 | 서버 부하 0, D1 `tutorial` 열 0 |

**Deprecated/outdated:** `OpeningFx`·`TutorialRoleCards`·`tut.*` 소리 13개·사회자 파형 띠(UI-SPEC "쓰지 않는 참고").

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 5배치 각각 5~9분·전체 약 27~35분이라는 시간 추정(22-13·23-12 기록에서 외삽, 이 세션에 E2E 를 돌리지 않음) | P7 | 배치가 한도에 근접하면 6배치로 더 쪼갠다(한도 중단 종료 코드 2 로 알 수 있음) |
| A2 | `wrangler d1 migrations apply DB --remote` 가 비대화형(Claude Bash)에서 확인 질문을 자동 수락한다 | P7 | 질문에서 멈추면 사용자에게 보고하고 대화형으로 한 줄 승인받는다 |
| A3 | D1 `database_id` 는 비밀이 아니라 식별자라 `wrangler.jsonc` 에 커밋해도 된다(공개 레포) | P7·Q6 | 사용자가 커밋을 원치 않으면 로컬 전용 처리·다른 PC 는 손으로 기입(HANDOFF 에 적음) |
| A4 | 종이 `transparent`+`depthWrite:false` 가 메시 1·draw call 1 로 처리된다(three 투명 목록 정렬만 영향) | P4 | `perf-run` `--notes 8` 의 `callsMax` 로 즉시 드러남 |
| A5 | 카메라 세로 투영 계수 cos 36° ≈ 0.81(UI-SPEC 가정 그대로, 이 세션에 재유도하지 않음) | P4 | 종이 세로 px 가 달라지면 실측 스크린샷으로 크기를 정한다 |
| A6 | 둘째 날 일반 판에서 마피아·시민 모두에게 `suspect` 응답이 같다는 것은 코드 구조로만 확인(전용 누설 시험이 아직 없음) | P1 | `suspectLeak.test.ts` 가 Wave 0 로 이를 고정 |
| A7 | 튜토리얼 장면 1→2·7→8 의 3D 무대 재생성이 어두운 막 아래라 안 보인다 | P6 | 실기기에서만 알 수 있음(UI-SPEC unresolved) |

## Open Questions

1. **`NOTE_REACH_FX` 값 (Q1)**
   - 알려진 것: CONTEXT "약 6배"(210), 구간 기준 계산으로 8% 여유는 약 55ms 의 마주 걷기.
   - 불확실: 실플레이 체감.
   - **Recommendation: 240(6.9×)·켜는 문턱 220·끄는 문턱 240.** 실테스트에서 바꾸기 쉽게 상수 한 곳.
2. **옮기기 연타 간격 (Q2)** — 기본 `SUSPECT_MIN_GAP_MS = 600`, 일일 옮김 횟수 상한은 두지 않는다(D-01). **Recommendation: 간격만.** 상한이 필요하면 사용자 결정.
3. **E2E 표식 `data-record-day` (Q3)** — **Recommendation: `data-log-day` 로 교정**(OFF1 접두 충돌). UI-SPEC 문서도 같은 계획에서 한 줄 정정.
4. **E2E 훅 이름 (Q4)** — **Recommendation: UI-SPEC 대로 `__mfWorld.suspectNotes()`**(`HookRuntime` 확장). 대안 `window.__mfNotes` 는 이 레포의 `__mfGhosts` 선례와 더 닮았으나 UI-SPEC 과 e2eContract 를 둘 다 바꿔야 한다.
5. **옮기기 시 쌓기 순서 (Q5)** — **Recommendation: 빼고 끝에 더함**(최신이 위). D-01 의 관찰 행동은 같다.
6. **`wrangler.jsonc` 에 쓴 `database_id` 커밋 (Q6)** — **Recommendation: 커밋한다**(두 PC·이후 배포에 필요, 값은 문서·메시지에 옮기지 않음). A3 참조.
7. **[의심] 모드 헤더 (Q7)** — `hintOverride` 가 `LegacyMapHeader`(시간 링)로 바꾼다. **Recommendation: 귓속말 선례대로 두되 스크린샷으로 확인**, 어긋나면 안내 한 줄만 바꾸는 경로.
8. **종이 크기·자리 (Q8)** — **Recommendation: 0.34~0.36·중심 y 0.54~0.56 두 안을 스크린샷 비교로 계획 말미에 확정**(UI-SPEC 의 px 가정이 틀림).
9. **배포본 smoke 판 1행 (Q9)** — **Recommendation: 지우지 않고 0092·HANDOFF 에 표시.**
10. **튜토리얼에서 `Keyword` 의 `timeless` 분기 (Q10)** — 부품 수정은 "0초" 메타 한 줄. **Recommendation: `Keyword` 에 선택 prop `timeless` 하나**(기본 거짓, 실게임 무영향).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | 전부 | ✓ | v26.13.0 (`engines >=22.12`) | — |
| npm | 스크립트 | ✓ | 11.20.0 | — |
| Chrome(시스템) | E2E·perf | ✓ | `/Applications/Google Chrome.app` | — |
| wrangler | D1·배포·`games` | ✓ | 4.151.3 | — |
| `vite dev` 5173 | 로컬 E2E | ✓(이미 떠 있음, 코드는 낡을 수 있음) | `/api/health` → `2026-11-16T18:56:39Z+62d0dc26` | 새로 `npm run dev` |
| 로컬 D1 | `games` 확인 | ✓ | `.wrangler/state/v3/d1`, `games` 표·33행 | `d1 migrations apply DB --local` |
| 개인 Cloudflare 로그인 | 배포 | ✓(이 세션 `check-account` 통과, 실행 시점에 재확인) | — | **없으면 배포 정지**(P7-1) |
| git(`v3`) | 커밋·push | ✓ | 브랜치 `v3` | — |

**Missing dependencies with no fallback:** 없음(단 개인 계정 로그인은 실행 시점 확인이 필요 — 없으면 배포 단계만 보류).
**Missing dependencies with fallback:** 없음.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.12(3 프로젝트: `unit` node · `client` happy-dom · `worker` @cloudflare/vitest-plugin) + `node --test`(scripts) + 자체 E2E(playwright-core, 시스템 Chrome) |
| Config file | `/Users/dhkim1522/personal/minifia/vitest.config.ts` |
| Quick run command | `npx vitest run --project unit test/unit/<파일>` / `--project client test/client/<파일>` / `--project worker test/worker/<파일>` |
| Full suite command | `npm run typecheck && npx vitest run && node --test scripts/*.test.mjs scripts/e2e/*.test.mjs` (이후 E2E 5배치) |

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|-------------|
| SC-1 | 단계·일차·생존·거리·옮기기·같은 대상·거절 같은 응답 | unit | `npx vitest run --project unit test/unit/postit.test.ts` | ❌ Wave 0 |
| SC-1 | 메시지 스키마(strict·0~7) | unit | `npx vitest run --project unit test/unit/schemas.test.ts` | ✅ 확장 |
| SC-1 | view 세 값·조건·키 집합 | unit | `npx vitest run --project unit test/unit/view.test.ts` | ✅ 확장 |
| SC-1 | 워커: 방송·거절 프레임·간격·rematch 비움·D1 `note_count` | worker | `npx vitest run --project worker test/worker/suspect.test.ts test/worker/gameLog.test.ts` | ❌ Wave 0(suspect) / ✅ 확장 |
| SC-1 | 마피아·시민 응답 동일·`notes` 이름 부재 | worker | `npx vitest run --project worker test/worker/suspectLeak.test.ts test/worker/leak.test.ts` | ❌ / ✅ |
| SC-1 | rematch·resetToLobby 가 `notes` 를 안 넘김 | unit | `npx vitest run --project unit test/unit/rematch.test.ts test/unit/testTools.test.ts` | ✅ 확장 |
| SC-1 | 선택기·모드 훅·[의심] 단추·모드 배타·거절 알림 | client | `npx vitest run --project client test/client/suspectUi.test.tsx test/client/gameMap.test.tsx` | ❌ / ✅ 확장 |
| SC-1 | 기록 카드 일차 구역·개명 | client | `npx vitest run --project client test/client/roleCardSheet.test.tsx test/client/roomScreen.test.tsx` | ✅ 수정 |
| SC-1 | UI 흐름(P24-1~6·11) | e2e | `npm run e2e -- --url http://localhost:5173 --only suspect` | ❌ Wave 0 |
| SC-2 | 지오메트리·정점 변위·재질 8·텍스처 굽기 호출·`dispose`·가리지 않음 상자 대조 | unit | `npx vitest run --project unit test/unit/postit3d.test.ts test/unit/palette.test.ts` | ❌ / ✅ 확장 |
| SC-2 | `SceneLook.notes` 파생·ghost 제외·fresh 규칙 | unit | `npx vitest run --project unit test/unit/presence.test.ts test/unit/suspectView.test.ts` | ✅ 확장 / ❌ |
| SC-2 | 성능(draw call·fps·끊김·점광원) | perf | `node scripts/perf-run.mjs --url http://localhost:5173 --scene talk --minutes 1 --throttle 4 --size 390x844 --outfits mix --notes 8 --file notes8`(+`--notes 0`) | ❌ 옵션 Wave 0 |
| SC-2 | 종이 가독·가림·밤 조명(스크린샷) | manual(`--shots`) | `npm run e2e -- --url … --only suspect --shots` | ❌ |
| SC-3 | 장면 표·가짜 view(`satisfies RoomView`)·알약 17자·대행 타이머 | unit | `npx vitest run --project unit test/unit/tutorialScript.test.ts` | ❌ Wave 0 |
| SC-3 | 정적 가드(모듈 그래프) | unit | `npx vitest run --project unit test/unit/tutorialStaticGuard.test.ts` | ❌ Wave 0(옛 파일 되살림) |
| SC-3 | FocusRing·TutorialScreen·Home 진입(뒤집기)·저장 키 | client | `npx vitest run --project client test/client/focusRing.test.tsx test/client/tutorialScreen.test.tsx test/client/screens.test.tsx test/unit/session.test.ts` | ❌ / ✅ 수정 |
| SC-3 | 열 장면 완주·네트워크 0·그만두기 | e2e | `npm run e2e -- --url … --only tutorial` | ❌ Wave 0 |
| SC-4 | 전체 회귀 5배치 | e2e | 위 P7 표의 `--only` 5개 | ✅ 흐름 / 새 흐름 ❌ |
| SC-4 | 판정 순수 함수·분할 | node:test | `node --test scripts/e2e/suspect.test.mjs scripts/e2e/tutorial.test.mjs scripts/e2e/lib.test.mjs` | ❌ / ✅ |
| SC-4 | 로컬 D1 확인 | cmd | `node scripts/smoke.mjs http://localhost:5173 --stage full --players 4` 후 `npm run games` | ✅ |
| SC-4 | 배포 가드·smoke | cmd | `node scripts/check-account.mjs`; `npm run deploy`; `npm run smoke -- --prod`; `node scripts/smoke.mjs --prod --stage full --previous-version "<이전>"` | ✅ |
| 공통 | 타입·토큰·HANDOFF 크기 | cmd | `npm run typecheck`; `npx vitest run --project unit test/unit/handoff.test.ts test/unit/e2eContract.test.ts test/unit/soundProtocol.test.ts` | ✅ |

### Sampling Rate
- **Per task commit:** 바뀐 파일의 단일 시험(`npx vitest run --project <p> <file>`) + `npm run typecheck`(서버·protocol 을 건드린 작업).
- **Per wave merge:** `npx vitest run`(전체, worker 부하 간헐은 파일 단독 재실행으로 구분) + `node --test scripts/*.test.mjs scripts/e2e/*.test.mjs`.
- **Phase gate:** 위 전체 + E2E 5배치 + D1 로컬 확인 + (개인 계정 확인 시) 배포·smoke 가 초록이어야 `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `test/unit/postit.test.ts` — SC-1 규칙·거리(`restSegment` 로 세그먼트 구성)
- [ ] `test/unit/suspectView.test.ts` — 선택기(히스테리시스·스택 3장·죽은 좌석 제외·일차 정렬)
- [ ] `test/unit/postit3d.test.ts` — 지오메트리·재질 캐시·가짜 캔버스 굽기·가리지 않음 상자 대조(P4 좌표 표 고정)
- [ ] `test/worker/suspect.test.ts`·`suspectLeak.test.ts` — 방송·거절·간격·rematch·누설(`keywordLeak.test.ts` 모양)
- [ ] `test/client/suspectUi.test.tsx` — [의심] 단추·모드·배타·알림(WorldStage 가짜는 `gameMap.test.tsx:20-31` 패턴)
- [ ] `test/unit/tutorialScript.test.ts`·`tutorialStaticGuard.test.ts`·`test/client/focusRing.test.tsx`·`tutorialScreen.test.tsx` — `git show 00829164^:<경로>` 로 골격 복원 후 새 계약에 맞게
- [ ] `scripts/e2e/suspect.mjs`·`tutorial.mjs`(+`.test.mjs`)·`flows.mjs` 등록·`perf-run.mjs --notes`·`src/debug/perf` `notes` 파라미터
- [ ] 분할 불변식 시험: 기본 흐름 전부가 5배치 `--only` 중 하나에 든다(`selectFlows`)
- [ ] 프레임워크 설치: 불필요

## Security Domain

### Applicable ASVS Categories (레벨 1, `security_enforcement` 켜짐)
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no(변경 없음) | 기존 토큰·`hello` |
| V3 Session Management | no | 기존 소켓 첨부 `playerId` |
| V4 Access Control | yes | 행위자 신원은 소켓 첨부 `playerId` 만(메시지에 seat·id 없음), 판정은 서버(`stickNote`), 거절 응답이 사유를 드러내지 않음 |
| V5 Input Validation | yes | `z.strictObject({t:"suspect", target:int 0..7})`(덧붙은 키 거부) + `stickNote` 가 정수·존재·생존 재검사 |
| V6 Cryptography | no | — |
| V7·V8 Logging/Data | yes | D1 `note_count` 는 장 수만(닉네임·내용 없음), 오류 로그에 토큰·내용 없음 |

### Known Threat Patterns for 이 스택
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 먼 사람에게 붙이는 위조 메시지(클라이언트 거리 신뢰) | Tampering | 서버가 `world.segs` 로 거리 판정(클라이언트 판정은 표시용) |
| 거절 사유로 역할·위치·생사 추론(오라클) | Information Disclosure | 모든 거절 `BAD_MESSAGE` 한 가지, 마피아·시민 응답 동일(시험) |
| 옮기기 연타로 DO 쓰기·전원 방송 폭주 | Denial of Service | `SUSPECT_MIN_GAP_MS` 600ms(조용히 버림) + 기존 20/초 한도 + 같은 대상은 쓰기 없음 |
| 서버 전용 `notes` 이름 누설 | Information Disclosure | `SERVER_ONLY_KEYS` 두 시험 목록에 `notes`, 필드별 복사로만 view 구성 |
| 튜토리얼이 실제 서버·토큰을 건드림 | Spoofing/Tampering | 모듈 그래프 정적 가드 + E2E 네트워크 0건 |
| 사용자 닉네임을 DOM 에 HTML 로 | XSS | 이름은 React 텍스트 노드만(`innerHTML` 금지 가드 유지) |
| 배포를 다른 계정에 | Elevation | `check-account`(`judgeWhoami`)·`check-deploy-target`·`deploy.mjs` 고정 인자 — 우회·`login` 자동화 금지 |

## Recommended Plan Breakdown (10계획, 계획당 ≤ 3작업, 린 실행기)

직렬 파일(`worker/room.ts`·`shared/protocol.ts`·`shared/game/view.ts`·`GameMap.tsx`)을 건드리는 계획은 같은 웨이브에 두지 않는다.

| 웨이브 | 계획 | 내용(작업 ≤ 3) | 직렬 파일 | 선행 |
|--------|------|----------------|-----------|------|
| 1 | **24-01 서버 규칙** | ① `shared/game/postit.ts`(상수·거리·`stickNote`) + `postit.test.ts`(RED→GREEN) ② `room.ts` `notes` 필드 + `beginGame` 비움 + `rematch.test`·`testTools.test` 카나리 ③ `gameLog.ts` `note_count` + `gameLog.test` | — | — |
| 1 | **24-02 프로토콜·view·워커** | ① `protocol.ts`·`schemas.ts`·`view.ts` + `schemas`/`view` 시험(+`soundProtocol`·`view.test` 키 목록·`e2eContract`·`lib.mjs` 사본) ② `worker/room.ts` `suspect` case·`applySuspect` + `test/worker/suspect.test.ts` ③ 누설: `leak.test` 목록 + `suspectLeak.test.ts` | `worker/room.ts`, `protocol.ts`, `view.ts` | 24-01 |
| 2 | **24-03 [의심] UX** | ① `suspectView.ts`·`useSuspect.ts`·`useSendGuard`+`V2Icon postit`+단위·훅 시험 ② `ChatPanel`/`GamePanel` [의심] 단추·CSS·칩(`HeadStack`) ③ `GameMap` 배선(오류 분기 순서·모드 배타·`bottomExtra` prop·표식·소리) + `gameMap.test`/`suspectUi.test` | `GameMap.tsx` | 24-02 |
| 2 | **24-04 3D 종이** | ① `palette.ts` 좌석 8색 + `palette.test` ② `src/world/postit.ts`(주입식 굽기·지오메트리·재질·붙음/떨어짐) + `postit3d.test` ③ `presence.ts` `SceneLook.notes`·`runtime.ts` 배선·`testHooks` + `perfScene` `notes`·`perf-run --notes` | (GameMap 건드리지 않음) | 24-02 |
| 2 | **24-05 기록 카드** | ① `RoleCardSheet` `RecordsPanel`·`records` 개명·`RoomScreen` ② 시험·E2E 사본 개명 일괄(`roleCardSheet`·`roomScreen`·`keyword.mjs`·`browser.mjs` 하네스·문서 표식 `data-log-day`) ③ CSS(`rolecard.css` sticky 구역·의심 줄) | — | 24-02 |
| 2 | **24-06 튜토리얼 기반** | ① `tutorialScript.ts`(출연·가짜 view·장면 표·대행 로직) + 시험 ② `FocusRing`·`TutorialFrame` 복원/신설 + CSS + `focusRing.test` ③ `session.ts` 저장 키 + 정적 가드(모듈 그래프) | — | 24-02 |
| 3 | **24-07 튜토리얼 화면 1~5** | ① `useTutorialScene`·`TutorialScreen` 뼈대(가짜 `WorldStore`/`ChatStore`/send·`inert` 층·소리) ② 장면 1~3(`PreGame`·`Keyword` `timeless`·시트) ③ 장면 4~5 + 시험 | `GameMap.tsx`(prop 사용만) | 24-03·06 |
| 3 | **24-08 튜토리얼 화면 6~10 + 진입** | ① 장면 6~8(지목·유언·밤) ② 장면 9(실제 [의심]·종이)·10 + 그만두기·다시 보기 ③ `Home.tsx` [혼자 하기]·`screens.test` 뒤집기·`preload` | `Home.tsx` | 24-07 |
| 4 | **24-09 E2E 새 흐름 + 부분 회귀** | ① `suspect.mjs`(+`suspect-sizes`) 순수 판정+흐름 ② `tutorial.mjs` + 하네스 `__mfTutorial` ③ 부분 회귀 `--only suspect,tutorial,keyword,day,basic-off` + perf `--notes 8/0` 기록 + 스크린샷 크기 확정 | — | 24-03~08 |
| 5 | **24-10 전체 회귀·D1·배포·문서** | ① (정지 조건 없음) 5배치 전체 회귀 + 로컬 D1 확인(`smoke full` 후 `games`) ② **정지 조건 먼저**: `check-account` 통과 시에만 D1 생성→`database_id`→원격 마이그레이션→`games --remote`→`deploy`→smoke·health, 아니면 보류 기록 ③ 0092·`product`·`architecture`·`screen-map`·HANDOFF(≤6KB)·위생 grep·커밋 | — | 24-09 |

- **병렬성**: 웨이브 2 의 03~06 은 서로 다른 파일 집합(03 만 `GameMap`/`ChatPanel`/`GamePanel`)이라 병렬 가능. 24-04 가 `GameMap` 을 건드리지 않게 `sceneLook` 내부에서 종이 파생(P4).
- **린 실행기 이월 메모**: 각 계획 SUMMARY 에 (a) 확정된 상수·마커 이름, (b) 바뀐 시험 목록, (c) 다음 계획이 알아야 할 한 줄만 남긴다. 큰 문서(이 RESEARCH·UI-SPEC)를 통째로 읽히지 말고 해당 절만 인용.
- **24-10 의 정지 조건 문구**(계획 본문에 그대로): "`node scripts/check-account.mjs` 가 통과하지 못하면 `wrangler login` 시도 없이 ② 전체를 건너뛰고 HANDOFF·0092 에 '배포 보류' 와 남은 명령을 적은 뒤 오케스트레이터에 정지를 보고한다."

## Sources

### Primary (HIGH — 이 세션에 직접 열거나 실행)
- `/Users/dhkim1522/personal/minifia/.planning/phases/24-suspect-note-tutorial/24-CONTEXT.md`, `24-UI-SPEC.md` — 결정·계약
- `docs/decisions/0089·0091`, `HANDOFF.md`, `.planning/ROADMAP.md:617-631`, `.planning/STATE.md`(미룬 항목 표)
- 서버: `shared/game/{whisper,world,map,gather,rematch,room,view,gameLog,testTools,movement,ruleset}.ts`, `shared/{protocol,schemas}.ts`, `worker/room.ts`(`handleWhisper`·`applyPoint`·`applyAnswer`·`fillChalk`·`afterTransition`), `migrations/0001_games.sql`, `wrangler.jsonc`
- 클라이언트: `src/screens/{GameMap,Home,RoomScreen,Keyword,RoleReveal}.tsx`, `src/components/{RoleCardSheet,WorldStage}.tsx`, `src/components/v2/{ChatPanel,HeadStack,HostBand,V2Icon}.tsx`, `src/world/{character,camera,palette,presence,runtime,store,testHooks}.ts`, `src/net/{useWhisper,useSendGuard,useKeywordAnswer,cardFace,session,useMapInsets}.ts`, `src/game/{whisperView,keywordView}.ts`, `src/debug/perf/*`
- 시험·스크립트: `test/{unit,client,worker}/…`(`view`·`leak`·`soundProtocol`·`e2eContract`·`rematch`·`gameLog`·`screens`·`roleCardSheet`·`roomScreen`·`whisper`·`flakeGuard`·`handoff`), `scripts/e2e/{lib,browser,flows,keyword,run}.mjs`, `scripts/{games,check-account,check-deploy-target,deploy,smoke,perf-run}.mjs`
- 실행으로 확인: happy-dom 21.0.4 `getContext("2d")`→`null`·`document.fonts`→`undefined`; `selectFlows` 5배치 분할(누락 0·겹침 1); 값 import 폐포 134파일(네트워크 모듈 0); `node scripts/games.mjs --all`→판 33, `wrangler d1 execute DB --local`→33행·`has_bots` 33; `node scripts/check-account.mjs` 통과; 바 입장 지점 쌍 거리·원통 반지름 계산
- 의존 코드: `node_modules/wrangler/wrangler-dist/cli.js:183878·238177`, `node_modules/@cloudflare/vite-plugin/dist/index.mjs:95467-95469`
- 옛 튜토리얼: `git show 00829164^:src/{game/tutorialScript.ts,screens/TutorialScreen.tsx,components/v2/FocusRing.tsx,styles/tutorial.css}`, `git show 00829164 --stat`, `test/unit/tutorialStaticGuard.test.ts`, `test/helpers/fakeTutorialStage.ts`
- 성능 기록: `.planning/phases/20-map-expansion/perf/nightload-390x844-x4-plaza.json`, `18.1-screen-polish/perf/…`
- 회귀 시간 기록: `22-13-SUMMARY.md`(실행 1·2), `23-12-SUMMARY.md`

### Secondary / Tertiary
- 없음(외부 문서·웹 검색은 쓰지 않았다 — 모두 레포 코드·의존 패키지 소스 확인).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 신규 설치 없음, `package.json` 직접 확인.
- Architecture(서버·view·클라 배선): HIGH — 선례 코드(귓속말·답·지목) 줄 번호까지 대조.
- 3D 수치: HIGH(좌표·반지름 원문 확인) / MEDIUM(화면 px — 카메라 세로 계수는 UI-SPEC 가정, 실측 필요).
- 튜토리얼 통합: MEDIUM — 부품의 시계 의존은 코드로 확인했으나 장면별 실제 동작은 구현 중 확인 필요.
- 회귀 시간·배포 비대화형 동작: MEDIUM(추정, 가정 로그 A1·A2).
- Pitfalls: HIGH — 대부분 이 세션에 재현·코드로 확인.

**Research date:** 2026-11-17
**Valid until:** 2026-11-24(코드가 빠르게 바뀌는 v3 브랜치 — 계획 직전에 `git log` 로 새 커밋 확인)
