# Phase 24: 의심 포스트잇과 새 튜토리얼 - Context

**Gathered:** 2026-11-17
**Status:** Ready for planning

> 자동 진행(`/gsd-autonomous --from 22 --to 24`). 방향과 규칙은 사용자와 확정한 결정 0089(0089-10·11·15·24·25), 0091(D1·배포 순서)이다. 아래 D-* 중 0089 에 없는 세부는 추천안 자동 채택이고 사용자가 돌아와 한 줄씩 바꿀 수 있다. **대전제: 장치를 늘리지 않고 심플하게.**

<domain>
## Phase Boundary

둘째 날 이후 낮 토론 중 "의심" 포스트잇(가까이 가서 한 사람에게 하루 한 장, 캐릭터 몸에 붙은 모양, 투표·판정에는 영향 없음)을 넣고, 새 시나리오(첫날 키워드 → 낮 토론 → 찬반 → 차례 지목 → 유언 → 밤 → 다음 날 포스트잇)를 가르치는 **혼자 하는 튜토리얼**을 다시 만든다. 페이즈 끝에 폰 6종 전체 회귀, D1 생성, 한 번 배포(0089-25).

넣지 않는 것: 시상, 함께 진행하는(방 단위) 튜토리얼, 봇의 포스트잇, 키워드 목록 검토(사용자), 새 소리 큐 대량 제작.

</domain>

<decisions>
## Implementation Decisions

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

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- 귓속말 선례: `shared/game/whisper.ts`(`WHISPER_PHASES`·`sendWhisper`·`whisperUsedToday`), `worker/room.ts` `handleWhisper`/`applyWhisper`, `src/game/whisperView.ts`, `GameMap.tsx` 의 `whisper.mode ? {...}` → `WorldPick`(이름표가 버튼이 되는 패턴).
- 위치·거리: `shared/game/world.ts` `positionAt`/`positionAtFx`, `worker/room.ts` `fillChalk` 가 `this.world.segs[id]` 를 읽는 선례, `map.ts` `CHAR_RADIUS`.
- 캐릭터: `src/world/character.ts` 관절 `torso|head|armA|armB|legA|legB`, `body` 그룹, 얼굴/모자는 `head`, 병합 지오메트리 경로와 별개로 동적 메시를 `WorldCharacter.root` 쪽에 둔다. 좌석 색 `--seat-1..8`, 3D 색표 `src/world/palette.ts`(`npm run tokens:check` 동기화).
- 손글씨 글꼴: `src/styles/penFont.css`, `scripts/fetch-pen-font.mjs`.
- 기록 카드: `RoleCardSheet.tsx` `AnswersPanel`(1일차 하드코딩 → 일차별 일반화), `day.keyword.answers` 가 "판 내내 남는 공개 값" 선례.
- 옛 튜토리얼 구조: 커밋 `00829164^`(화면·훅·부품), `2bde5f7c`(서버 단계 삭제), 결정 0078·0080(폐기, 재사용 대목: 0080-5·7·12·14·16).
- 부분/전체 E2E: `npm run e2e -- --url … --only <ids>`, `--sizes`, `MAX_PARALLEL=3`, `OVERALL_LIMIT_MS` 29분.

### Established Patterns
- 순수 규칙은 `shared/game`, 서버 전용 상태는 `SERVER_ONLY_KEYS`, 공개 값은 모든 view 에 같은 모양, 거절은 `BAD_MESSAGE` 하나.
- 새 PhaseId 는 이번 페이즈에 없다(포스트잇은 `discussion` 안, 튜토리얼은 로컬).
- 병합 지오메트리 캐릭터에 동적 파츠는 별도 `Mesh`, draw call 예산 120.

### Integration Points
- `protocol.ts` `ClientMessage` 유니온·`schemas.ts`·worker 메시지 switch·`view.ts`(`day.suspects`·`day.suspectLog`·`me.suspectTo`)·`gameLog.ts`(`note_count`)·`rematch.ts`/`normalizeStoredRoom`.
- 클라이언트: `GameMap.tsx`·`WorldStage.tsx`(포스트잇 3D 상태 전달)·`runtime.ts`·`character.ts`·`ChatPanel`/입력줄 옆 단추·`RoleCardSheet.tsx`·`Home.tsx`(혼자 하기 진입)·`src/net/session.ts`("봤음" 키).
- 위험한 얽힘: ① 새 메시지 이름(`note` 충돌) ② 옛 방 정규화 이름 충돌 회피(튜토리얼 서버 상태를 안 만듦) ③ 튜토리얼 가짜 view 가 `RoomView` 에 종속(웨이브 뒤쪽) ④ 3D 성능·병합 지오메트리 ⑤ 기록 데이터 보존·저장 크기 ⑥ 전체 회귀 첫 실행의 옛 간헐 실패 ⑦ 배포의 계정 확인·외부 리소스 생성.

</code_context>

<specifics>
## Specific Ideas

- 사용자: "포스트잇 형태로 실제 캐릭터에 붙이도록 에셋을 만들어서 (디테일이 좋아야 함), 색상은 붙이는 유저의 색이어도 괜찮을 듯, 누가 붙였는지 너무 잘 보여야 될 필요는 없음." 얼굴·옷 특징·이름표를 가리면 안 되고 머리 위에 띄우지 않는다.
- 사용자: 튜토리얼은 익사이팅하게 — 목적·재미·직업·흐름을 연출로(저장된 선호).
- 사용자: 마지막에 한 번만 배포(0089-25).

</specifics>

<deferred>
## Deferred Ideas

- 방장 [튜토리얼 먼저] 함께 진행(서버 단계)
- 봇의 포스트잇
- 시상·억울상, 포스트잇을 시상에 반영
- 포스트잇 떼기·반응 동작

</deferred>
