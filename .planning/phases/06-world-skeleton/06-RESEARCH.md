# Phase 6: 월드 뼈대 - Research

**Researched:** 2026-10-31
**Domain:** 모바일 웹 three.js 아이소메트릭 맵 + DOM 겹침 2D 캐릭터 + Cloudflare Durable Object 서버 권위 이동 + Worker 이름 분리 배포
**Confidence:** MEDIUM-HIGH (저장소 코드·three 소스·번들 크기·Cloudflare 한도는 이 세션에서 직접 확인해 HIGH. 실기기 fps·발열·iOS 컨텍스트 복구·카카오톡 인앱 동작은 이 환경에서 잴 수 없어 LOW~MEDIUM이고 스파이크가 확정한다)

> ## 개정 (2026-10-31, 결정 0047·0048·0050·0055 반영) — 아래 본문보다 이 절이 우선한다
>
> 본문은 "2D 캐릭터 + 달빛 응접실 + 저가폰 실기기" 전제로 쓰였다. 그 뒤 캐릭터는 3D 조립 인물(0047·0048), 맵은 지하 재즈 바(0050, 로비도 재즈 바 고정 0055), 성능 확인은 사용자 iPhone 16 Pro + 크롬 CPU 4배 스로틀(0055)로 바뀌었다. 연결·재접속(R3 일부, R5, R6), 배포(R8), 키보드 채팅 시안(R7), 서버 권위 이동의 알고리즘·전송 형식(R4 앞부분), 패키지 감사·번들 측정은 그대로 유효하다. 아래 항목만 본문을 대체한다.
>
> **A. 캐릭터는 three 장면 안의 3D 메시다 (R1 대체).** 빌보드 vs DOM 겹치기 질문은 없어졌다(0046-5·6 은 0047 로 대체). 원본 모듈은 `design/v2.0/blockout/character.js`(구·원통 조립, 의상 9종·표정·동작 9종·걷기, `MFChar.create/applyOutfit/playEmote/setFace/animate`), 최신 장면 엔진은 `design/v2.0/screens/blockout.js`(밤 시점·발밑 고리·분필 윤곽·유령·결과/시상식 단계·걷기 포함 — `design/v2.0/blockout/blockout.js` 는 이전 판). 시안은 r128 전역 `THREE` 이므로 제품에서는 ES 모듈(`three@0.186.1`)로 옮긴다.
> - **DOM 으로 남는 것**: 이름표·머리 위 쌓임(`HeadStack`: 입력 중·직업 표시·도장·득표 배지·이름표), 목적지 링 표시 문구, 모든 글자(UI-SPEC "글자는 모두 DOM"). 위치는 시안과 같이 매 프레임 머리 꼭대기 월드 좌표를 `Vector3.project(camera)` 로 투영해 `translate` 로 놓는다(`design/v2.0/screens/blockout.js` 의 `c.sx/c.sy` 계산과 같은 방식). 겹치기 판정은 본문 R1 의 "장치 픽셀 반올림"·Pitfall 8 을 그대로 따른다.
> - **가림 규칙이 바뀐다**: 캐릭터가 3D 라 가구 뒤에서는 가려질 수 있다. 시안은 "앞쪽에 높은 물체를 두지 않는다"(0046-3)와 카메라 쪽 펜던트 등 제거로 해결했다. 이름표(DOM)는 늘 보인다. UI-SPEC 을 다시 쓸 때 이 규칙으로 바꾼다.
> - **컨텍스트 소실**: 캐릭터도 GL 이라 맵과 함께 사라진다. 본문 R3 상태기계는 그대로 쓰되 2번의 "캐릭터는 그대로 움직인다" 는 "이름표·서버 위치는 계속 갱신되고, 복구 첫 프레임에 캐릭터를 `positionAt` 위치로 바로 놓는다" 로 읽는다.
> - **탭 판정**: 바닥 탭은 정사영 레이캐스트로 y=0 평면 교점을 구한다(화면설계서 보드가 쓰는 방식: `Raycaster.setFromCamera` + `ray.intersectPlane`). 이름표를 누르는 조작(지목·마피아 고르기)은 DOM 버튼이다.
>
> **B. 그리기 예산 — 측정값 (R2.4·R2.5 보강).** 이 세션에서 화면설계서 엔진(`design/v2.0/screens/blockout.js` + `bar.js` + `character.js`, r128, SwiftShader, 390×844)으로 잰 값 [VERIFIED: 이 세션 프로브]:
>
> | 장면 | draw call | 삼각형 | 메시 | 재질 | 광원 | 그림자 투사 |
> |---|---|---|---|---|---|---|
> | 재즈 바만(캐릭터 숨김) | 154 | 12,400 | 213 | — | 12 | 98 |
> | 재즈 바 + 캐릭터 8명(토론) | 342 | 69,522 | 1,117 | 851 | 12 | 98 |
> | 같은 장면, 지목 단계 | 419 | 92,396 | 〃 | 〃 | 〃 | 〃 |
>
> 캐릭터 한 명 = 메시 113개(의상·표정 교체용 숨김 메시 포함), 보이는 것만 draw call 약 23. 메시마다 재질을 새로 만든다(재질 851). → **제안 예산 [ASSUMED]: draw call ≤ 120.** 캐릭터는 관절 단위(몸통·머리[머리카락·모자·얼굴 포함]·팔 2·다리 2)로 버텍스 컬러 병합해 1인당 약 6 call(8명 ≈ 48), 맵은 본문 R2.5 대로 재질별·버텍스 컬러 병합(≈ 30~40), 동적 광원 ≤ 3 + 반구광 1(나머지 전구·촛불·벽등은 `emissive` + 빛망울 스프라이트), 정적 그림자는 한 번만 굽기(시안도 `shadowMap.autoUpdate = false`), 캐릭터는 그림자를 던지지 않고 발밑 원판 그림자를 쓴다. 의상·표정 교체용 메시는 병합에서 빼고 바꿀 때 다시 병합한다. 지목 단계가 +77 call 인 이유(무대 전구·빛 무리)도 병합 대상이다.
>
> **C. 성능 게이트 측정 (R2.1·R2.3·R2.4 대체).**
> - 기기: **사용자 iPhone 16 Pro(Safari, 120Hz ProMotion)** 실측 + **데스크톱 Chrome CPU 4배 스로틀**(저가폰 대신). 저가 Android·구형 iPhone·카카오톡 인앱 실측은 9페이즈 팀 테스트 때 팀원 폰으로 한다(0055). adb·삼성 인터넷 항목은 6페이즈에서 뺀다.
> - 합격: 두 조건 모두 재즈 바 토론 장면 + 캐릭터 8명 걷기·동작 2종에서 5분 평균 55fps 이상, 끊김 ≤ 5회. iPhone 16 Pro 는 고사양이라 **이 폰 숫자만으로는 합격 판정을 하지 않는다**. 본문 R2.4 의 교훈(CPU 감속은 GPU 를 못 잰다)은 그대로라, 크롬 스로틀에서는 DPR 을 1.5 로도 함께 재어 GPU 여유를 본다. 본문 HUD(R2.2)의 rAF 주기 표시로 iPhone 이 60Hz 로 묶였는지(≈16.7ms) 120Hz 인지(≈8.3ms) 기록한다.
> - 맵 조합: 재즈 바 `talk`(로비·토론, 가장 오래 머무는 장면)와 `vote`(가장 무거운 장면). 광장·응접실은 6페이즈에서 재지 않는다(광장은 11페이즈 MAP-06).
> - 판정 기록은 다음 번호 결정 기록(지금 기준 0056 이후 — 0047 은 이미 3D 캐릭터 결정에 썼다).
>
> **D. 맵 데이터는 재즈 바 기준 (R4 의 시안 좌표·입장 지점 대체).** 원본 `design/v2.0/blockout/bar.js`(화면설계서 사본 `design/v2.0/screens/bar.js` 와 같음): 방 14×14(바닥 x,z ∈ [−7,7], 벽 면 x=−7.15·z=−7.15, 앞 두 면은 잘려 있음), 가운데 무대 원기둥 반지름 1.18·높이 0.28, 서는 자리 8개 반지름 2.4(`k.ring(8, 2.4, 0)`), 토론 자리 `ctx.talk` 8곳, 바 카운터 `box(1.0, 1.05, 6.2)` @ (−5.7, −2.2), 스툴 4개 x=−4.8, 피아노 (−4.6, −5.0) 회전 0.6, 탁자 5개(반지름 0.5) @ (4.6,1.2)·(1.2,4.6)·(4.4,−3.2)·(−3.2,4.4)·(−2.4,−4.6) 와 각 의자 2개. 카메라: yaw π/4, 거리 17·높이 12.5(본문과 같음), `view 14.5`, `target (−0.4, −0.4)`, 화면설계서는 `setViewOffset` 로 장면을 110px 위로 올린다(아래 패널 자리). 걸을 수 있는 영역이 본문 가정(약 9×9)보다 넓어 카메라 이동 한계 `pan` 은 본문 R4 의 식으로 다시 구한다(390 폭·`view 14.5` 이면 화면 반폭 약 3.35 단위 → 걷는 영역 반폭을 6.0 으로 두면 `pan` ≈ 4.0, 계산값 [ASSUMED]). 앞쪽 잘린 바닥 밖의 빈 배경은 아래 패널이 덮는 범위 안에서만 허용할지 UI-SPEC 에서 정한다.
>
> **E. 결정 번호**: 본문의 "0047-v2-render-gate" 등 0047 예약은 무효. 기록할 때의 다음 번호를 쓴다.

<user_constraints>
## User Constraints (from CONTEXT.md)

CONTEXT.md 없음 — 사용자가 `/gsd-discuss-phase` 없이 리서치를 택했다. 오케스트레이터 지시에 따라 **ROADMAP 6페이즈(계획 메모 포함), 승인된 `06-UI-SPEC.md`, 결정 기록 0042·0043·0044·0046** 을 잠긴 결정으로 취급한다. 아래는 그 원문에서 옮긴 것이다(요약이 아니라 해당 문장).

### Locked Decisions
- **맵 렌더링 (0046-1·3)**: "맵은 three.js 아이소메트릭 3D 로 그린다. 정사영(orthographic) 카메라로 비스듬히 내려다보고, 그림자·안개·점광원을 쓴다." / "맵은 화면보다 크고 빈 배경이 보이지 않는다. … 앞쪽에는 시야를 가리는 높은 물체를 두지 않는다."
- ~~**캐릭터는 2D (0046-5)**~~ *(0047·0048 로 대체: 3D 조립 인물, 개정 A)*: 로우폴리 면 색면 2D 리그, 앞·옆·뒤 3벌, 왼쪽은 옆 그림 반전. 3D 는 맵에만 쓴다.
- **합치는 방식 (0046-6)**: "화면을 향한 판(빌보드)에 그리거나, 투영 좌표로 DOM 을 겹친다. 둘 중 무엇으로 할지는 6페이즈 리서치·스파이크에서 정한다."
- **이동 동기화 (0044-17)**: "클라이언트는 목적지만 보내고 서버가 경로를 정해 구간으로 보낸다. 위치 스트림·서버 틱은 두지 않는다."
- **서버 원칙 (0002, 0044-14, CLAUDE.md)**: 게임 규칙·판정·이동 권한은 서버(방 Durable Object)가 정한다. 클라이언트는 받은 상태를 보여 주고 행동만 보낸다. 화면에서 숨기는 것으로 대신하지 않는다.
- **배포 (0043-3, 0044-24)**: "배포 이름: `minifia-v2` 로 확정한다. 배포 설정과 검사 스크립트의 기본 주소를 같은 커밋에서 바꾸고 v1.0 을 덮어쓰지 않게 막은 뒤 첫 배포를 한다." 계정 확인(0042)은 v2 에도 그대로.
- **성공 기준 4 (ROADMAP)**: 실기기(저가 Android, 구형 iPhone, 카카오톡 인앱)에서 5분 평균 55fps 이상, 카메라 이동 끊김·발열·메모리 경고 없음, 로비 조작 3초 안. 미달이면 그림자·광원·건물 예산을 줄이고, 그래도 모자라면 맵을 시간대별 미리 구운 이미지로 바꾸기로 결정 기록에 남긴다.
- **UI-SPEC 잠금 항목**: 로비 맵 = A 달빛 응접실 · 시간대 저녁 고정 / 제품 로비 캐릭터 = v1.0 인물 그림(자리표시, 교체 가능한 슬롯) / WebGL 불가 = 오류 카드(v1.0 `DayTable` 로 몰래 대체 금지) / 예측 이동 금지(서버 구간만 따름) / 이름표·글자는 모두 DOM / 진홍·앰버·소리·햅틱 없음 / 카메라 손으로 끌기·핀치 없음 / 재접속 띠는 흐름을 밀지 않고 위에 얹음.
- **시작 이후 한 판은 v1.0 흐름 그대로** (성공 기준 3).

### Claude's Discretion
- 빌보드 vs DOM 겹치기의 최종 권고(근거 제시), 스파이크 계측 도구와 기록 방식, WebGL 복구 구현 세부, 이동 가능 영역 데이터 형식, `world` 저장·복원 방식, 하단 채팅 시안 계측 항목, 배포 가드의 구체 구현, 플랜 분할 제안.

### Deferred Ideas (OUT OF SCOPE)
- 채팅 구현·동작(이모트)·의상·유령·밤 연출·소리·햅틱(7~12페이즈). 광장(B) 맵의 제품 사용(8·9페이즈, 6페이즈는 스파이크에서만 측정). 대체 로비(WebGL 불가 기기용)는 스파이크 실패율을 본 뒤 결정. 실제 2D 리그 캐릭터 제품 적용(10페이즈). 맵 위 읽기 전용 위치 낭독(8페이즈 재검토). 방장 이양·재대결(11페이즈).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEPLOY-02 | v2.0 은 `minifia-v2` Worker 에 배포되고 스크립트가 v1.0 주소를 덮어쓰거나 검사하지 않는다 | R8: v1 이름·주소를 박아 둔 파일 전수 목록, 빌드 뒤 `dist/worker/wrangler.json` 이름 검사 가드, 단일 출처 `scripts/deploy-target.mjs`, v1 건드리지 않음 확인 절차(일회성 수동 `curl`) |
| MAP-01 | 방에 들어오면 내 캐릭터가 로비 맵에 생기고 모두가 서로의 캐릭터·닉네임을 본다 | R1(DOM 겹침 + 이름표), R4(입장 지점·`world.snap`), R6(hello 직후 스냅샷) |
| MAP-02 | 터치하면 걸어가고 다른 폰에서도 같은 경로·속도 | R4(서버 A*·구간 `{p,t0,v}`·`positionAt` 순수 함수), 시계 오프셋이 일치 오차에 미치는 영향(Pitfall 5) |
| MAP-03 | 맵은 한 화면보다 조금 넓고 카메라가 따라간다 | R1·R4(카메라 클램프 ↔ 이동 가능 영역 정합 검사), 카메라 감쇠 τ=152ms 환산 |
| MAP-05 | 화면 꺼짐·재접속에도 모든 캐릭터가 지금 위치로 이어진다 | R3(컨텍스트 복구), R5(epoch 규약), R6(`world` 키 복원 + hello snap) |
| CONN-04 | 보류한 연결 계층 경고(WR-01~04)를 고친다 | R5: **WR-01~04 는 v1.0 1페이즈 리뷰의 항목이고 이미 고쳐져 있다**(커밋 4개·테스트 확인). 남은 일은 검증·`DEFERRED-BUGS.md` 줄 정리·새 `world` 프레임이 같은 규약을 지키는 회귀 테스트 |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- 응답·`.planning/` 산출물은 한국어. 코드·명령·파일 이름·요구사항 ID 는 원문.
- **서버가 게임 규칙·판정을 정한다.** 클라이언트는 받은 상태를 보여 주고 행동만 보낸다 (결정 0002). 다른 사람의 역할은 서버가 살아 있는 사람에게 보내지 않는다(탈락자 관전만 예외, 0021). 화면에서 숨기는 것으로 대신하지 않는다.
- 기획·계획은 참여 플레이어의 몰입 기준. 각 페이즈는 자기 구간의 이펙트·액션을 기본형으로 만든다 (0006) → 6페이즈 입장 낙하·목적지 링·걷기 흔들림.
- 새 결정은 `docs/decisions/` 다음 번호(개정 E: 0047 예약은 무효, 기록할 때 `ls docs/decisions` 로 확인).
- 작업을 마칠 때마다 `HANDOFF.md` 갱신(6KB 이하, `test/unit/handoff.test.ts`) 후 push. 브랜치 `v2` 에서 작업, `v1`·`main` 은 건드리지 않는다 (0043).
- 이른 배포: 이 페이즈 검증은 `minifia-v2` 배포본으로 한다. 정식 출시 작업(이름·상표 등)은 범위 밖.
- 화면 페이즈는 `/gsd-ui-phase` 먼저 — **완료됨**(UI-SPEC 승인). 디자인 참고 자료 규칙: `design/v2.0/` 을 열어서 따른다 → 이 리서치에서 `backgrounds/minifia-bg-concepts.html`, `characters/Scene·Rig·Turn·Main·Emotes·Views.dc.html` 을 열어 수치를 확인했다.
- 대체한 v1.0 코드와 그 코드만 검사하던 테스트는 같은 페이즈에서 함께 지운다(`skip` 금지) — 로비의 `DayTable` 계열 (R1 "삭제·교체 범위").
- 누설 검사(`leak.test`)는 지우지 않고 새 메시지 종류에 맞게 확장한다.

## Summary

이 페이즈의 핵심은 세 가지 위험을 순서대로 줄이는 것이다. ① **렌더 방식이 실제 폰에서 버티는가**(성능 게이트 — 맵 렌더러를 교체 가능한 인터페이스 뒤에 두고 스파이크를 가장 먼저 만든다), ② **이동·위치가 서버 권위로 모든 폰에서 일치하는가**(순수 함수 `positionAt` + 서버 A* + 별도 `world` 저장 키), ③ **v2 배포가 v1 을 건드리지 않는가**(v1 이름·주소를 박은 파일이 열 곳 남짓이고, 가드는 빌드 *뒤* `dist/worker/wrangler.json` 을 검사해야 한다).

가장 중요한 발견 다섯 가지. (1) **WR-01~04 는 이미 v1.0 에서 고쳐졌다** — `DEFERRED-BUGS.md` 의 "열림" 줄이 낡았다. 1페이즈 코드 리뷰의 WR-01~04 가 각각 `9b89310`·`2b308f4`·`735ef3a`·`efdf811` 로 고쳐졌고 테스트가 이름을 달고 있으며 이 세션에서 관련 3개 파일 111 테스트가 통과했다. CONN-04 는 "원인 찾기"가 아니라 "검증 + 줄 정리 + 새 프레임 회귀 방지"다. (2) **캐릭터는 DOM 겹치기로 권고한다** — 이름표 8개의 투영 루프가 어차피 필요하고, WebGL 컨텍스트가 끊겨도 캐릭터는 살아 있으며, 10페이즈 SVG 리그(시안은 캐릭터당 폴리곤 약 57개·`<g>` 12개)를 그대로 쓸 수 있다. 빌보드는 스파이크 수치가 DOM 을 이기지 못하게 만들 때만 쓴다. (3) **three 최신판(0.187.0)은 어제(2026-10-30) 나온 패키지라 레지스트리 검사가 SUS(`too-new`)** — 정확히 `three@0.186.1`(2026-09-24)·`@types/three@0.186.0` 을 고정하고 사람 확인 체크포인트를 둔다. 최소 정사영 장면 번들은 측정상 **gzip +133KB**(현재 앱 107.8KB)라 월드 청크를 지연 로드한다. (4) **UI-SPEC 과 시안 원문의 불일치**를 찾았다: 응접실 모이는 링 반지름이 시안에서는 2.5(UI-SPEC 은 1.9), 현재 three 에서는 `PCFSoftShadowMap` 이 제거되어 단계 2 문구가 성립하지 않고, `data-wx` 4Hz 갱신으로는 걷는 중 0.3 단위 일치 검사를 못 한다. (5) 시안 그대로의 응접실은 포인트 라이트 9개·재질 129개(대부분 박스마다 새로 만든 `MeshStandardMaterial`)·그림자 투사 메시 214개·그림자 맵 2048 이라 폰에는 예산 초과일 가능성이 높다. 데스크톱 M3 에서는 CPU 6배 감속에도 60fps 라 **GPU 병목은 데스크톱 프록시로 못 잡는다** — 실기기가 필수다.

**Primary recommendation:** 먼저 `MapRenderer` 인터페이스(three 구현 + 구운 이미지 구현 자리)와 `?perf=1` 스파이크를 만들어 실기기 게이트를 돌리면서, 병행으로 `shared/game/{map,world}.ts` 순수 모듈과 `Room` 의 `move`/`world` 프레임/`world` 저장 키를 TDD 로 만들고, 0번 작업으로 `minifia-v2` 이름·주소 단일 출처와 빌드 후 가드를 넣어 첫 배포한다. 캐릭터는 DOM 겹치기, 맵 데이터는 ASCII 격자 마스크 + 서버 A*, 위치 저장은 1.5~2초 디바운스한 별도 키.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 이동 허용 판정·경로 계산·속도 | API / Backend (Room DO) | — | 0044-17: 클라이언트는 목적지만, 서버가 경로·속도를 정함. 예측 이동 금지 |
| 위치 구간 저장·복원 | Database / Storage (DO storage `world` 키) | API / Backend | 하이버네이션·배포 뒤 복원. `room` 키와 분리 |
| 위치 전송 대상 결정 | API / Backend | — | 6페이즈는 로비 전원이지만 `audience` 단일 경로로 시작해 7·8·9페이즈 누설 방지 토대 |
| `positionAt(seg, t)` 보간 | 순수 모듈(`shared/`) | Browser (렌더), Backend(판정) | 양쪽이 같은 함수를 import — 결정적 결과 |
| 맵 3D 렌더(정사영, 조명, 그림자) | Browser / Client | — | three.js, 지연 로드 청크 |
| 캐릭터·이름표·목적지 링 그리기 | Browser / Client (DOM 겹침 층) | — | 투영 좌표를 DOM transform 으로. 글자는 모두 DOM |
| 탭 → 바닥 좌표 변환·카메라 따라가기 | Browser / Client | — | 정사영 역변환. 서버에는 월드 좌표 정수만 보냄 |
| 컨텍스트 소실 감지·복구 UI | Browser / Client | — | 서버 연결은 별개로 유지(상태 계속 수신) |
| 연결·재접속 상태 | Browser / Client (`useRoomConnection`) | API / Backend(hello 스냅샷) | 이미 있는 토큰 재접속 재사용 |
| 렌더 성능 계측 | Browser / Client (`?perf=1` HUD) | 사람(실기기 조작) | 결과는 문서·결정 기록으로 저장 |
| 배포 대상 가드 | 빌드·배포 스크립트(`scripts/`) | CDN/Static(없음) | 빌드 산출물(`dist/worker/wrangler.json`)을 검사 |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| three | **0.186.1 (정확 고정)** | 아이소메트릭 맵 렌더 | 0046 결정. 런타임 의존성 0개, MIT. 0.187.0 은 2026-10-30 출간이라 SUS(too-new) → 5주 지난 0.186.1 권고 [VERIFIED: npm registry — `npm view three time`, `npm view three@0.186.1 dependencies` 비어 있음] |
| @types/three | **0.186.0 (정확 고정, devDependency)** | 타입 | three 는 타입을 번들하지 않음. 이 저장소의 TS 7.0.2 + `skipLibCheck` 설정으로 `three`·`three/examples/jsm/utils/BufferGeometryUtils.js` import 가 컴파일됨을 scratch 에서 확인 [VERIFIED: 이 세션 `tsc -p` 통과] |
| react 19.3.1 · react-dom · zod 4.6.7 · vite 8.3.5 · wrangler 4.151.3 | 기존 고정 | 앱·서버·빌드 | 변경 없음 [VERIFIED: package.json] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| playwright-core | 1.64.1 (기존) | E2E, 컨텍스트 소실 강제 테스트 | 시스템 Chrome 헤드리스에서 WebGL2(Apple Metal)·`WEBGL_lose_context` 사용 가능을 이 Mac 에서 확인 [VERIFIED: 이 세션 프로브] |
| vitest 4.1.12 (unit/client/worker) · `node --test` | 기존 | 순수 모듈·DO·스크립트 검사 | 새 의존성 없음 |

**새로 추가하는 의존성은 `three` 와 `@types/three` 둘뿐이다.** `@types/three` 의 전이 의존성 6개(fflate, @types/webxr, meshoptimizer, @types/stats.js, @tweenjs/tween.js, @dimforge/rapier3d-compat)는 devDependency 트리에만 들어오고 모두 OK 판정이다.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| three 직접 사용 | react-three-fiber | R3F 는 약 +248KB gzip(마일스톤 리서치 기록)이고 컨텍스트·렌더 루프를 직접 쥐기 어렵다. 렌더 대상이 장면 하나라 React 재조정 이득이 없다 → 쓰지 않는다 [CITED: .planning/research/SUMMARY.md 표 "번들"] |
| DOM 겹침 캐릭터 | 빌보드 판(textured quad) | R1 참고. 컨텍스트 소실 시 캐릭터도 사라지고, 라이브 SVG 리그를 텍스처로 올리려면 프레임마다 래스터 업로드가 든다 |
| 손으로 쓴 소형 A* | `navmesh`·`pathfinding`·recast wasm | 이동 영역이 정적 한 장(약 9×9 단위)이고 `shared/`(DOM·workerd API 금지)에서 결정적으로 돌아야 한다. 패키지 추가는 슬롭스쿼팅 위험과 번들만 늘린다 → 예외로 직접 작성(80줄 안팎, 속성 테스트로 고정) |
| 단일 장면 라이브 3D | 시간대별 구운 이미지 | 성능 게이트 미달 때의 탈출구(단계 6). 같은 정사영 카메라·이동 한계를 쓰면 이름표·이동 데이터는 그대로 |

**Installation:**
```bash
npm install --save-exact three@0.186.1
npm install --save-dev --save-exact @types/three@0.186.0
```
(프로젝트 규칙: 범위 없이 고정. `package.json`·`package-lock.json` 을 같이 커밋하고 이후 `npm ci`.)

**Version verification:** `npm view three version` = 0.187.0 (2026-10-30T08:09Z), 0.186.1 = 2026-09-24T14:42Z, 0.186.0 = 2026-09-08. `npm view @types/three versions` 최신 0.187.0 (2026-10-30T18:05Z), 0.186.0 = 2026-09-11. [VERIFIED: npm registry, 이 세션]

**번들 크기 측정(이 세션, scratch Vite 8 빌드):** `WebGLRenderer, Scene, OrthographicCamera, Mesh, Box/Cylinder/SphereGeometry, MeshStandard/LambertMaterial, Directional/Point/HemisphereLight, Fog, CanvasTexture, Raycaster, Plane` 만 import 한 최소 장면 = 535,314 B raw / **gzip 133.0 KB (Vite 보고) / brotli 약 108KB**. 현재 앱 메인 청크는 349,907 B raw / **gzip 107.8KB** [VERIFIED: `dist/client/assets/index-DgEpuMsZ.js` gzip -9]. → 그대로 합치면 첫 로드 JS 가 약 2.2배다. **월드 모듈은 `import()` 로 분리**하고 방 입장 화면에서 미리 받는다. 맵이 절차적 생성(상자·원기둥·캔버스 텍스처)이라 별도 바이너리 맵 에셋은 없다.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| three | npm | 15년+, 최신판만 1일 | 약 31.7M/주 | github.com/mrdoob/three.js | **SUS** (`too-new`: 최신 0.187.0 이 2026-10-30) | 유지 — **0.186.1 로 고정**, 설치 전 `checkpoint:human-verify` 필수 (아래) |
| @types/three | npm | 최신판만 1일 | 약 20.5M/주 | github.com/DefinitelyTyped/DefinitelyTyped | **SUS** (`too-new`) | 유지 — 0.186.0 고정, 같은 체크포인트 |
| fflate · meshoptimizer · @tweenjs/tween.js · @dimforge/rapier3d-compat · @types/stats.js · @types/webxr | npm | 오래됨 | 16.7M~141M/주 | — | OK | 전이 의존성(@types/three 가 끌어옴), devDependency 만 |

**Packages removed due to [SLOP] verdict:** 없음
**Packages flagged as suspicious [SUS]:** `three`, `@types/three` — 사유는 이름 의심이 아니라 "최신판이 막 나옴"이다. 다운로드·저장소 신호는 정상이고 `scripts.postinstall` 없음(`postinstall: null`). 그래도 플래너는 설치 직전 `checkpoint:human-verify`(사용자가 `npm view three@0.186.1 dist.integrity` = `sha512-blFeqb49wRCSGUGj7gtpfnSGHy2lwDk94RhUmS1c/hTby70kvChbWpkJ4Pm1390LqzzvTmzgXKHPEafJwCb8jA==` 와 `package-lock.json` 의 값을 대조)를 넣는다. 패키지명은 UI-SPEC·결정 0046 이 이미 명시한 것이라 `[ASSUMED]` 대상이 아니다. [VERIFIED: gsd-tools `package-legitimacy check` + npm registry]

## 연구 질문별 결론

### R1. 맵(three)과 2D 캐릭터를 합치는 방식 — **DOM 겹치기 권고** *(개정 A 로 대체: 캐릭터는 3D 메시, 이름표만 DOM)*

**결론:** 캐릭터 그림·그림자 타원·이름표·목적지 링을 모두 **캔버스 위의 한 DOM 층**(`[data-world-stage]`)에 두고, 매 프레임 같은 `requestAnimationFrame` 안에서 `Vector3.project(camera)` 로 월드 → 화면 좌표를 구해 `transform: translate3d()` 로 놓는다. 캐릭터 8명 × (그림 + 그림자) + 이름표 8개 + 링 1개 ≈ 25개 요소다. 빌보드는 예비안이다.

**근거(표):**

| 기준 | DOM 겹치기 | 빌보드 판 | 판정 |
|------|-----------|-----------|------|
| 이름표는 DOM(UI-SPEC "글자는 모두 DOM") → 월드→화면 투영 루프가 **어차피 필요** | 캐릭터도 같은 루프에서 처리, 추가 비용 거의 0 | 이름표용 투영 + 판 위치 갱신 두 갈래 | DOM |
| "캐릭터는 3D 물체에 가려지지 않는다"(UI-SPEC 가림 규칙) | DOM 이 캔버스 위라 자동 충족 | `depthTest:false` + `renderOrder` 필요(가능) | DOM(약간) |
| **WebGL 컨텍스트 소실(iOS)** | 맵만 사라지고 캐릭터·이름표는 정상. 복구 카드 40% 가림막만 얹으면 됨 | 판의 텍스처·지오메트리도 같이 사라져 재업로드 필요 | **DOM** |
| 10페이즈 SVG 리그(앞·옆·뒤 3벌, 파츠 회전, 손 6종) | SVG 를 DOM 에 그대로, 파츠 `transform` 으로 구동. 시안 `Scene.dc.html` 8명 = 폴리곤 456개·`<g>` 96개(캐릭터당 약 57·12) 수준 [VERIFIED: `grep -o "<polygon" design/v2.0/characters/Scene.dc.html`] | 라이브 리그면 프레임마다 SVG → 캔버스 → 텍스처 업로드. 사전에 구운 스프라이트 아틀라스로만 효율적 | DOM(개발 속도) |
| 최고 성능 | 25 DOM 요소 transform 갱신 + SVG 파츠 리페인트(Safari 는 `<g>` 변환 변경 시 SVG 레이어 CPU 래스터) | GPU 쿼드 8개, UV 교체만 | 빌보드(+아틀라스일 때) |
| 접지 그림자 | DOM 타원 `shadow-foot` (UI-SPEC) | 판 아래 쿼드 | 동등 |
| 선명도 | 소수 픽셀 `translate3d` 는 흐려질 수 있음 → `Math.round(x*dpr)/dpr` 로 장치 픽셀에 맞춤 | 텍스처 필터링 흐림(밉맵) | 동등 |
| 탭 판정 | 입력 면 `div` 하나가 `pointerdown/up` 을 받고 캐릭터는 `pointer-events:none`(끊긴 사람 내보내기 44×44 영역만 예외) | 레이캐스트 | DOM(단순) |

**스파이크에서 확인할 사항(결정 규칙):** `?perf=1&chars=dom` 이 기본이고 `&chars=billboard`(자리표시 PNG 를 `MeshBasicMaterial` 판으로)를 **가장 무거운 조합 1개 × 최악 기기 2대**에서만 1분씩 A/B 로 잰다. **DOM 을 유지**하는 조건: DOM 갱신 시간(HUD `domUpdateMs` p95)이 3ms 이하이고 평균 fps 차이가 8fps 미만. 이 숫자(3ms·8fps)는 제안값이다 [ASSUMED]. 빌보드로 가면 같은 `WorldCharacter` 슬롯 인터페이스(위치·이동 방향·상태·의상)는 그대로 두고 구현만 바꾼다.

**삭제·교체 범위(로비 `DayTable` 계열):** `Lobby.tsx` 는 `DayTable`+`useSeatTransitions` 를 `WorldStage` 로 바꾼다. `useSeatTransitions` 는 `Lobby.tsx` 에서만 쓰인다 [VERIFIED: `grep -rn useSeatTransitions src` → `src/screens/Lobby.tsx:14,55` 와 정의 파일뿐] → 로비 교체와 함께 지울 수 있다. `DayTable`·`Figure` 는 낮·밤·투표 화면이 계속 쓴다. 로비만 검사하던 테스트·E2E: `test/client/lobby.test.tsx`(좌석 퇴장 320ms, `.mf-dt__seat--leave` 등), E2E `lobbyFlow`(`crownChecks`·`feltGapChecks`·`lobbyShapeChecks`·`stageStable`·`L1~L6`), 다른 흐름 도입부의 `grabLobbyStage` — 교체 범위가 크므로 **별도 웨이브**로 계획한다. 로비 장면 교체 시 `scripts/e2e/lib.mjs` 의 `DEFAULT_SIZES` 네 크기와 `test/unit/e2eContract.test.ts` 계약이 같이 움직인다.

**렌더러 구조:** 맵은 `MapRenderer` 인터페이스 뒤에 둔다(Code Examples 1). three 구현과 "구운 이미지" 구현이 같은 정사영 카메라·이동 한계·`groundToScreen/screenToGround` 를 공유하면, 성능 게이트가 실패해도 이름표·캐릭터·이동 데이터·서버는 그대로다. R3F 는 쓰지 않는다.

**렌더러 설정 권고(시안 → 제품 이식):**
- 시안은 `alpha:true` 투명 캔버스 + CSS 배경이다. 제품은 `alpha:false`, `scene.background`·`fog` 같은 색으로 한다(캔버스가 화면 전체를 덮고 DOM 합성 비용이 준다 — 효과 크기는 스파이크로 확인 [ASSUMED]).
- `setPixelRatio(Math.min(devicePixelRatio, 2))` 는 시안 값 그대로 시작해 사다리(2 → 1.5 → 1.25)를 쿼리 파라미터로 노출한다. 390×664 화면 기준 캔버스 픽셀은 DPR 2 = 1.04MP, 1.5 = 0.58MP, 1.25 = 0.40MP, 430×932 DPR 2 = 1.60MP (계산값).
- **정적 장면의 그림자는 한 번만 그린다**: 캐릭터가 DOM 이라 그림자를 던지는 동적 물체가 없다. `renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true`(시간대 변경·컨텍스트 복구 때만 다시) — 세 속성 모두 0.186.1 소스에 있다 [VERIFIED: three@0.186.1 `src/renderers/webgl/WebGLShadowMap.js:86-95` `this.autoUpdate = true; this.needsUpdate = false;` … `if ( scope.autoUpdate === false && scope.needsUpdate === false ) return;`]. 시안은 매 프레임 2048² 그림자 맵에 214개 메시를 다시 그린다.
- 시안의 `THREE.PCFSoftShadowMap` 은 현재 three 에서 **제거**되었다 — "WebGLShadowMap: PCFSoftShadowMap has been removed. Using PCFShadowMap instead." [VERIFIED: three@0.186.1 `src/renderers/webgl/WebGLShadowMap.js:99-102`]. UI-SPEC 사다리 단계 2 의 "부드러운 그림자 → 기본" 문구는 "그림자 맵 2048 → 1024 → 512, 정적 갱신 → 그림자 끔" 으로 바꿔 읽는다.
- 시안의 `THREE.Clock` 은 r183 부터 deprecated(`Clock: This module has been deprecated. Please use THREE.Timer instead.`) [VERIFIED: three@0.186.1 `src/core/Clock.js:61`]. 제품은 rAF 콜백의 `time` 인자와 자체 `dt` 클램프(0.05초)를 쓰고 `Clock`/`Timer` 를 쓰지 않아도 된다.
- 조명 단위 변경(r155): 앰비언트·반구·방향광은 `PI` 를 곱하면 복원되고, 포인트·스폿광은 cd 단위·`decay` 2·"훨씬 큰 값"이 필요하며 **고정 환산식이 없다**(공식 안내) [CITED: discourse.threejs.org/t/updates-to-lighting-in-three-js-r155/53733]. 시안 포인트 라이트는 `new THREE.PointLight(c, k, dist, 2)` (`decay=2`) 이고 r128 레거시 방식은 거리 창 기반 감쇠라 모양이 다르다. → 조명 상수를 `LIGHT_TUNE` 한 객체로 모으고 **시안 스크린샷과 나란히 놓고 눈으로 맞춘다**(UI-SPEC 확정 필요 1번의 절차화: Playwright 가 시안 HTML(r128, CDN)과 제품 `?perf=1&shot=1` 을 같은 뷰포트·카메라·시간대로 찍어 나란히 저장).
- 시안 상수(원문): `var CAM_R = 17, CAM_H = 12.5, SIN_E = CAM_H / Math.sqrt(CAM_H * CAM_H + CAM_R * CAM_R);` (line 123), `camYaw = Math.PI / 4` (line 121), 응접실 `view: 8.4, pan: 3.2 … fog: [16, 40]` (line 687), 광장 `view: 9.6, pan: 3.6 … fog: [17, 46]` (line 706) [VERIFIED: design/v2.0/backgrounds/minifia-bg-concepts.html]. `SIN_E` ≈ 0.592(계산값).
- 크기 상수: 시안 무대는 `aspect-ratio: 390 / 560`, `view: 8.4` → **세로 1단위 = 560/8.4 ≈ 66.7px**(계산값). 자리표시 캐릭터 높이 96px ↔ 약 1.44단위 ↔ 시안 말(몸 0.75 + 머리 구)의 높이 약 1.5. UI-SPEC 의 "카메라 배율은 상수(`CHAR_PX`)" 를 **`PX_PER_UNIT = 66.7` 시작값**으로 두고, 정사영 프러스텀 높이를 `canvasHeight / PX_PER_UNIT` 로 정한다(시안처럼 `VIEW` 고정이면 폰 높이마다 캐릭터가 커졌다 작아진다) [ASSUMED: 시작값].

### R2. 스파이크 실측 방법 *(기기·조합·예산은 개정 B·C 가 우선)*

**전제(이 환경에서 확인):** 이 에이전트는 실기기를 만질 수 없다. `adb` 미설치, Xcode·iOS 시뮬레이터(18.6)·시스템 Chrome 있음. 카카오톡 인앱 브라우저는 앱이 디버깅을 켜야 원격 검사가 되는데(Android `setWebContentsDebuggingEnabled`, iOS 16.4+ `isInspectable`) 카카오톡이 켰다는 근거가 없다 [CITED: learn.microsoft.com/microsoft-edge/devtools/remote-debugging/webviews — 앱 코드에서 플래그를 켜야 함]. **그러므로 모든 기기에서 동일하게 쓸 수 있는 유일한 수단은 페이지 안 HUD 다.**

**R2.1 스파이크 구성 (`?perf=1`, 지연 로드 청크)** — `src/main.tsx` 의 `void initSheetDebug()` 와 같은 패턴(쿼리일 때만 `import()`)으로 일반 사용자 번들에는 영향이 없다 [VERIFIED: src/main.tsx `void initSheetDebug();` 주석 "?sheetdebug=1 탭에서만 시트 계측 본체를 지연 로드"].
- 맵: 응접실·광장 × 시간대(`night`=가장 무거움, `day`=가장 밝음), 쿼리 `map`, `time`, `budget`(사다리 0~6), `dpr`, `shadow`, `lights`, `chars=dom|billboard`, `seed`, `minutes`.
- 캐릭터 8명: 시험용 2D 리그(시안 `Scene.dc.html` SVG 를 정적 조각으로 추출 — 앞·옆·뒤 + 걷기 프레임 교체 + 손사래·박수 2종). 3~6초마다 시드 고정 난수로 무작위 지점. 서버 없이 클라이언트만(순수 렌더 비용 분리).
- 카메라: 한 명 추적(감쇠 τ), 1분에 한 번 이상 탭 입력.
- **시나리오는 결정적이어야 한다**: 같은 `seed` 면 모든 기기가 같은 이동 경로를 돈다(mulberry32 같은 소형 시드 난수 — 외부 패키지 없이).

**R2.2 HUD 지표 정의(매 프레임 rAF `time` 인자 델타를 `Float32Array` 링 버퍼에 기록 — 5분 × 60fps ≈ 18,000개 ≈ 72KB):**

| 지표 | 계산 | 합격선(UI-SPEC) |
|------|------|-----------------|
| 평균 fps | `프레임 수 ÷ 경과 초` (순간 fps 평균이 아님) | ≥ 55 (5분) |
| 끊김 | 델타 > 50ms 횟수 | ≤ 5회/5분 |
| p50/p95/p99 프레임 시간, 최장 | 정렬 백분위 | 기록 |
| 첫 1분 대비 마지막 1분 평균 fps | 비율 | < 0.85 이면 "열 스로틀 의심" 표시 |
| rAF 주기 추정 | 델타 중앙값 | ≈ 33ms 이면 "저전력 모드(30fps 제한) 의심" 경고, ≈ 8.3ms 이면 120Hz 표시 |
| 월드 갱신 시간 | 프레임당 투영 + DOM transform 쓰기 `performance.now()` 차 | p95 기록(R1 결정 규칙) |
| 렌더 호출 시간 | `renderer.render` 전후 CPU 시간 (GPU 시간은 아님) | 기록 |
| 맵 생성 시간 | 지오메트리·텍스처 생성 `performance.now()` 차 | 기록(저가 폰 메인 스레드 점유) |
| `renderer.info.render.{calls,triangles}` · `info.memory.{geometries,textures}` | three 내장 카운터 | 기록(예산 확인) |
| JS 힙 | `performance.memory`(Chrome 계열만 — 비표준·Safari/Firefox 없음 [CITED: developer.mozilla.org/en-US/docs/Web/API/Performance/memory]) | 시작·1분마다·끝. GPU 메모리는 못 잼 |
| **탭 재로딩 감지** | `sessionStorage` 에 5초마다 하트비트(`running`, 시각), 끝나면 `finished`. 로드 때 `running` 이 남아 있으면 "이전 실행이 도중에 죽음(메모리 압박/탭 폐기)" 기록 | 0회 |
| 탭 → 링 지연 | `pointerdown` 의 `event.timeStamp` → 링 요소가 처음 그려진 rAF `time` | ≤ 100ms |
| 입장 → 조작 가능 | `performance.mark('room-enter')`(참가 응답 직후) → `mark('map-interactive')`(첫 프레임 + 입력 핸들러 부착) | ≤ 3초 (LTE, 처음 방문) |
| 기기 정보 | UA, `devicePixelRatio`, `screen`, `hardwareConcurrency`, `deviceMemory`(Chrome만), GL 렌더러 문자열(`WEBGL_debug_renderer_info`, Safari 는 가려질 수 있음), UA 의 `KAKAOTALK` 토큰 유무 | 결과표 머리 |

**HUD 자체 비용을 지킨다**: 텍스트는 1Hz 로만 갱신, 접어 둘 수 있게, 측정 중에는 DOM 이 하나뿐. 델타 샘플링은 HUD 가 켜져 있든 아니든 같은 코드.

**R2.3 측정 절차(체크리스트 — 결과 신뢰도를 좌우한다):**
1. **iOS 저전력 모드를 끈다.** WebKit 은 저전력 모드에서 rAF 를 약 30fps 로 제한하며 의도된 동작이다 [CITED: bugs.webkit.org/show_bug.cgi?id=215745]. 켜 둔 채 재면 항상 미달이다(HUD 가 33ms 주기를 경고). Android 배터리 절약 모드도 끈다 [ASSUMED].
2. 충전기 분리·배터리 50% 이상·밝기 고정·다른 앱 종료·측정 전 5분 식히기. 화면 녹화·원격 디버거는 성능을 바꾸므로 측정 중에는 끈다.
3. **인앱 측정은 실제 유입 경로로**: 카카오톡 대화방에 `https://minifia-v2.dhplay.workers.dev/?perf=1&…` 링크를 보내 그 안에서 연다(Safari 에서 연 것과 엔진 제한이 다를 수 있다).
4. 기기당: 가장 무거운 조합(응접실 저녁, 광장 저녁 중 더 무거운 것) 5분 + 나머지 조합 각 1분. 사다리 단계는 한 번에 한 단계씩 낮추며 다시 잰다.
5. 5분 뒤 기기를 만져 열감을 기록(차갑다/미지근/뜨겁다) + Android 는 가능하면 `adb shell dumpsys battery` 의 `temperature`(0.1°C 단위) 전·후 [ASSUMED: adb 미설치 → 선택 항목].
6. 맵 열고 닫기 5회 뒤 메모리 증가: `info.memory.geometries/textures` 가 처음 값으로 돌아와야 한다(누수 검사 — 이것은 기기 없이 Playwright 로도 자동 검사 가능). iOS 는 탭 재로딩 감지로 갈음.
7. 읽힘: 8명 모임 + 360 폭 스크린샷을 시안과 나란히 저장.

**R2.4 사전 게이트(기기 없이, 경향 확인용 — 합격 판정에 쓰지 않는다):** Playwright + CDP `Emulation.setCPUThrottlingRate`. 이 세션에서 **시안 그대로**(응접실·광장 저녁)를 시스템 Chrome 헤드리스(Apple M3 Pro, ANGLE Metal)에서 390×664 DPR 3 으로 돌린 결과: 응접실 draw call 159·삼각형 6,750·지오메트리 266·재질 129·포인트 라이트 9·그림자 투사 메시 214·프로그램 6, 광장 draw call 321·삼각형 10,558·메시 2,199·재질 1,045·포인트 라이트 4. 둘 다 **CPU 6배 감속에서도 4초 평균 60fps(광장 6배에서 최장 프레임 33ms 1회)** [VERIFIED: 이 세션 프로브]. 교훈: ① 삼각형 수는 문제가 아니고, ② CPU 감속은 GPU(프래그먼트 조명 9개 × PBR, 2048² 그림자 패스)를 못 재므로 **데스크톱 숫자는 합격 근거가 될 수 없다**, ③ 광장은 메시 2,199·재질 1,045 라 병합(R2.5) 없이는 위험하다.

**R2.5 예산 제안(스파이크에서 검증할 목표 — 제안값 [ASSUMED]):** draw call ≤ 100, 동적(실시간 연산) 광원 ≤ 3 + 반구광 1(나머지 벽등·벽난로·스탠드는 재질 `emissive`/버텍스 컬러에 굽기 — UI-SPEC 단계 3), 정적 지오메트리는 `mergeGeometries`(`three/examples/jsm/utils/BufferGeometryUtils.js:133` `function mergeGeometries( geometries, useGroups = false )`)로 재질별 병합하고 팔레트는 버텍스 컬러 한 재질로, 애니메이션하는 것(벽난로 불꽃·괘종시계 추·빛망울)만 개별 메시. 시안은 박스마다 `M(color)` 로 새 `MeshStandardMaterial` 을 만든다(재질 129개).

**R2.6 결과 기록:**
- `.planning/phases/06-world-skeleton/06-PERF-RESULTS.md`(신규): 기기별 행(모델·OS·브라우저 버전·UA 카카오 여부·rAF Hz·조합·사다리 단계·평균 fps·끊김 수·p95·열감·재로딩·복구 시간·"3초 조작"·메모리 증감·HUD 결과 카드 스크린샷 경로). 스크린샷은 `.planning/phases/06-world-skeleton/perf/` 에 둔다.
- 판정은 결정 기록 `docs/decisions/0047-v2-render-gate.md`(번호는 다음 번호 규칙) — 통과/강등 단계/구운 이미지 전환 중 하나와 숫자 근거, 빌보드 vs DOM A/B 결과.
- 결과 전송을 위한 서버 엔드포인트는 만들지 않는다(무인증 쓰기 면 추가 + 다른 출처 요청 금지 규칙과 충돌) — HUD 결과 카드를 스크린샷으로 저장한다. 복사 버튼은 인앱 브라우저에서 클립보드가 막힐 수 있어 보조일 뿐 [ASSUMED].

**R2.7 iOS 시뮬레이터(선택, 기능 사전 점검):** Xcode·iOS 18.6 시뮬레이터가 있다. Mac Safari 웹 인스펙터로 시뮬레이터 페이지에 붙어 콘솔 오류·WebGL 컨텍스트 이벤트 흐름을 **기능적으로** 점검할 수 있다. 시뮬레이터는 호스트 GPU 를 쓰므로 fps·메모리 압박 재현에는 쓰지 않는다 [ASSUMED].

### R3. iOS WebGL 컨텍스트 끊김 복구

**사실:**
- three.js 는 컨텍스트 소실·복구를 이미 처리한다. 소실 시 `event.preventDefault()`(복구를 허용) + 내부 플래그를 세우고 `render()` 가 일찍 반환하며, 복구 시 `initGLContext()` 로 GL 상태를 다시 만든다 [VERIFIED: three@0.186.1 `src/renderers/WebGLRenderer.js:1113-1143` — `function onContextLost( event ) { event.preventDefault(); … _isContextLost = true;` / `function onContextRestore( /* event */ ) { … _isContextLost = false; … initGLContext();` / `render` 안 `if ( _isContextLost === true ) return;` (line 1646)]. 강제 테스트용 `renderer.forceContextLoss()` / `forceContextRestore()` 도 있다 (line 607-621).
- iOS 17 베타에서 Safari 를 백그라운드로 보내면 "Context Lost" 가 나는 사례가 보고되었고, 메모리 부족으로 컨텍스트를 잃은 뒤 새로 고침해도 새 컨텍스트를 못 만드는 WebKit 버그 보고(iOS 18)도 있다. 앱 쪽에서 `webglcontextrestored` 를 직접 처리하라는 조언뿐 확정된 three.js 쪽 수정은 못 찾았다 [CITED: discourse.threejs.org/t/context-lost-when-backgrounding-safari-on-ios-17-developer-beta-8/55772 , bugs.webkit.org/show_bug.cgi?id=289601 — 포럼·버그 트래커, 비공식 [LOW]].
- 이 Mac 의 시스템 Chrome 헤드리스에서 `WEBGL_lose_context` 확장이 있어 소실·복구를 **결정적으로 재현**할 수 있다 [VERIFIED: 이 세션 프로브 `lose:true`].

**권고 상태기계 (`MapStatus`: loading → ready ⇄ lost → (restored → ready | recreate → ready | failed), unsupported):**

1. 생성: `new WebGLRenderer({ antialias:false, alpha:false, powerPreference:"high-performance" })`. `failIfMajorPerformanceCaveat` 는 켜지 않는다(소프트웨어 렌더링 기기를 일괄 거절하면 접속 못 하는 친구가 생긴다 — 대신 `WEBGL_debug_renderer_info` 렌더러 문자열이 `SwiftShader`·`llvmpipe`·`Software` 를 포함하면 `unsupported` 카드, 그리고 자동 강등 사다리). 컨텍스트 생성 예외 → `unsupported`(UI-SPEC "이 기기에서는 맵을 열 수 없어요").
2. `webglcontextlost`: three 가 `preventDefault` 를 이미 하므로 우리 리스너는 **상태만 `lost` 로** 바꾸고 UI-SPEC 의 가림막(40%)+"화면을 다시 그리는 중…" 카드를 띄우며 입력을 막는다. 서버 연결·`world` 프레임 수신·캐릭터 DOM 갱신은 계속한다(DOM 겹침이라 캐릭터는 그대로 움직인다 → 카드 뒤에서 위치가 최신으로 유지되어 복구 즉시 맞는다).
3. `webglcontextrestored`: three 가 상태를 다시 세운 뒤 우리가 `shadowMap.needsUpdate = true` 로 정적 그림자를 다시 굽고, 렌더 1프레임 + 카메라·캐릭터를 서버 위치로 **즉시 맞춘 다음** 가림막을 `dur-fast` 로 걷는다.
4. **복구 이벤트가 안 오는 경우(WebKit 버그 사례 대비):** 소실 후 3초 안에 `restored` 가 없으면 **렌더러 재생성 1회** — `renderer.dispose()` + `renderer.forceContextLoss()` + 옛 `<canvas>` 제거, 새 `<canvas>` + 새 `WebGLRenderer` 를 만들고 **씬 그래프는 그대로 재사용**(three 는 자원 상태를 렌더러별로 들고 있어 새 렌더러가 다시 올린다 — 일반 지식 [ASSUMED], 소스로 확인 필요 항목으로 Wave 0 스모크에 포함). 재생성이 첫 프레임을 못 그리거나 총 5초가 지나면 UI-SPEC 의 "화면을 다시 그리지 못했어요 [새로 고침]" 카드(`location.reload()` — 토큰 재접속이 이미 있어 가장 값싼 안전망).
5. `visibilitychange` → visible 일 때 `renderer.getContext().isContextLost()` 를 확인해 조용히 소실된 경우도 2번 경로로 진입한다. 숨겨진 동안 rAF 는 브라우저가 멈추므로 우리 쪽에서 별도 일시정지는 필요 없다. 복귀 첫 프레임 `dt` 는 0.05초로 클램프하고 **위치는 항상 `positionAt(seg, serverNow)`** 로 계산해 따라잡기 계산을 없앤다.
6. **정리(teardown)**: 로비 → 게임 시작, 언마운트, React StrictMode 이중 마운트(개발)에서 `dispose()` + `forceContextLoss()` + 캔버스 제거를 항상 한다. 컨텍스트를 즉시 반납하지 않으면 "컨텍스트 한도" 경고로 오래된 컨텍스트가 죽는다 [ASSUMED: 마일스톤 PITFALLS Pitfall 9 의 일반 설명].

**검증:** (a) 자동(Playwright 헤드리스): `WEBGL_lose_context.loseContext()` → 카드 표시 → `restoreContext()` → 카드 사라짐·캐릭터 위치 일치; `loseContext()` 만 하고 방치 → 3초 뒤 재생성 또는 5초 실패 카드; 복구 중에도 `world` 프레임이 DOM 위치를 갱신. (b) 실기기: iPhone 에서 5분 스파이크 중 ① 잠금 후 30초 ② 카카오톡 채팅방으로 전환 후 복귀 ③ 카메라 앱 등 무거운 앱을 연 뒤 복귀 — 각 복구 시간과 흰/검은 화면 잔존 여부 기록(성공 기준 4 "WebGL 복구" 행). 테스트 훅(`window.__mfWorld.debug.loseContext()`)은 `?e2e=1`/개발 빌드에서만 노출.

### R4. 이동 가능 영역 데이터 형식과 서버 권위 이동 *(시안 좌표·입장 지점·`pan` 은 개정 D 가 우선)*

**권고: 0.5 월드 단위 격자의 ASCII 마스크 + 서버 A* + 시선(LOS) 스무딩. 클라이언트는 경로를 만들지 않는다.**

- **형식(`shared/game/map.ts`)**: 사람이 읽는 문자열 행 배열(`#` 막힘, `.` 걷기). 24×24 셀 = 576자 정도라 PR diff 로 검토 가능하고, 장애물은 **캐릭터 반지름(약 0.35)만큼 미리 부풀려** 그린다. 모듈 로드 시 `Uint8Array` 로 변환(결정적). 격자 원점·셀 크기·모이는 링(중심 `[0,0]`, 입장 지점 8곳)을 함께 둔다. 광장용 마스크는 8·9페이즈에서 같은 형식으로 추가.
- **왜 폴리곤 navmesh 가 아닌가**: 장애물이 소수의 정적 직사각형·원(원탁+의자 원형, 피아노, 소파, 안락의자 2, 협탁, 스탠드, 화분)이고 정수 격자라 서버·테스트에서 결정적이며 디버그 오버레이(`?perf=1&nav=1`)로 3D 장면 위에 마스크를 겹쳐 눈으로 맞추기 쉽다.
- **알고리즘(순수, `shared/`)**: ① `snapToWalkable(p)` — 막힌 셀·범위 밖은 가장 가까운 걸을 수 있는 셀로(거리 → 행 → 열 순 결정적 타이브레이크). UI-SPEC "서버가 보정하고 링이 미끄러짐" 이 이 결과(보정된 목적지)를 구간 마지막 점으로 돌려주면 된다. ② 8방향 A*(대각 모서리 끼어들기 금지, 휴리스틱 octile, 우선순위 큐 타이브레이크 고정). ③ 경로를 그리디 LOS(Bresenham 슈퍼커버)로 스무딩해 꼭짓점을 줄인다. ④ **`Math.hypot` 과 삼각함수를 쓰지 않고 `Math.sqrt` 와 사칙연산만** 쓴다 — 엔진마다 결과가 다를 수 있는 함수를 피해 서버·클라이언트가 같은 값을 얻게 한다 [ASSUMED: ECMAScript 가 일부 Math 함수를 implementation-approximated 로 둔다는 일반 지식].
- **전송 형식(고정소수점 정수)**: 좌표는 1/100 월드 단위 정수. 서버 → 클라이언트 `{ t:"world", k:"move", s:seat, p:[x0,z0,x1,z1,…], t0:serverMs, v:speed×100 }` (꼭짓점 최대 약 12), 스냅샷 `{ t:"world", k:"snap", at, ents:[{ s, p, t0, v }] }`. 클라이언트 → 서버 `{ t:"move", x:int, z:int }`. 축은 three 와 같게 **x,z**(y 는 위쪽)로 못 박는다(마일스톤 리서치는 x,y 로 썼다 — 혼동 방지).
- **`positionAt(seg, t)`**: 누적 길이로 구간을 찾아 선형 보간, `t < t0` → 시작점, 끝 이후 → 끝점. 속도는 서버 상수(`MOVE_SPEED = 2.2` 시작값, UI-SPEC)이고 프레임에 `v` 를 함께 실어 튜닝 후 옛 구간이 어긋나지 않게 한다.
- **서버 검사 순서**: 단계 허용(6페이즈는 `lobby` 만; 그 밖에는 **조용히 버림**) → 보낸 사람이 방에 있는지(소켓 첨부 `playerId` 만 신뢰) → zod `strictObject({t:"move", x:int, z:int})` 범위 → 최소 간격 150ms(넘치면 오류 없이 버림, UI-SPEC "서버가 막은 탭에 문구 없음") → 현재 위치 = `positionAt(기존 구간, now)` → `snapToWalkable` + 경로 → 새 구간 교체 → `emitWorld` → `markWorldDirty`.
- **카메라 한계 ↔ 이동 가능 영역 정합(순수 함수 검사로 고정)**: 카메라 추적은 `target = clamp(p, ±pan)`(응접실 3.2)이므로 캐릭터의 화면 어긋남은 `d = p − clamp(p)` 뿐이다. 정사영 yaw 45° 에서 화면 가로 단위벡터 `R=(0.707, −0.707)`, 세로 `F=(−0.707,−0.707)`, 세로는 `SIN_E ≈ 0.592` 로 눌린다. 가장 불리한 스테이지 360×284(짧은 폰) @ `PX_PER_UNIT 66.7` 에서 화면 반폭 2.70·반높이 2.13 단위이므로 이름표 여백 0.5 를 빼면 `|R·d| ≤ 2.2`, `|F·d|·0.592 ≤ 1.6` 이어야 한다. 정사각 이동 영역 `[−H,H]²` 의 모서리 `d=(H−3.2)(1,−1)` 에서 `|R·d|=1.414(H−3.2) ≤ 2.2` → **H ≲ 4.7**. 따라서 이동 가능 영역은 대략 9×9 단위 정사각형 안(UI-SPEC "한 끝에서 반대 끝 약 8 단위"와 일치)이어야 하며, 이 계산을 **모든 걸을 수 있는 셀 × 4개 폰 크기**에 대해 돌리는 단위 테스트를 둔다(수치는 위 가정에서 나온 계산이고 `PX_PER_UNIT`·여백이 바뀌면 테스트가 바뀐다).
- **시안 가구 좌표(마스크 작성 입력, 원문)**: 원탁 반지름 0.95(원점), 의자 8개 `Math.cos(a) * 1.55` / `a = c / 8 * Math.PI * 2`, 피아노 `pn.position.set(4.6, 0, -4.4)` 회전 −0.6, 소파 `so.position.set(-6.4, 0, 4.4)`, 안락의자 `-5.0, 0, 0.2 + z (z = −1.4, 1.8)`, 협탁 `-4.9, 0.2, 4.4`, 책장 `shelf(-4.9, -6.72, 0)`·`shelf(-6.72, -4.4, π/2)`, 괘종시계 `ck.position.set(1.4, 0, -6.72)`, 화분 `[-6.4,-6.4]`·`[6.2,-6.4]`, 스탠드 `fl.position.set(-5.9, 0, 6.0)`, 벽 면 `x=-7.15`·`z=-7.15` [VERIFIED: minifia-bg-concepts.html buildParlor]. 실제 마스크는 디자인과 맞춰 정하되 위 좌표 중 이동 영역 안에 드는 것(원탁+의자 원, 피아노 모서리, 안락의자)만 장애물이 된다.
- **자동 검사(마스크 속성 테스트)**: 입장 지점 8곳이 모두 걸을 수 있고 서로 연결, 원탁·의자 중심이 막힘, 임의 걸을 수 있는 두 셀 사이 경로가 있으면 경로의 모든 선분이 막힌 셀을 지나지 않음(슈퍼커버로 검증), 경로가 결정적(같은 입력 → 같은 출력), 막힌 목적지는 걸을 수 있는 셀로 보정, 총 길이/`v` 로 도착 시각이 단조.
- **UI-SPEC 불일치 하나**: 입장 지점 반지름이 UI-SPEC 에는 "시안 `pawnR` = 1.9" 인데 시안 코드는 **응접실 `ctx.pawnR = 2.5;` (line 410)**, 광장 `ctx.pawnR = 1.9;` (line 682) 이다 [VERIFIED]. 응접실 의자 반지름이 1.55 라 1.9 는 의자 등받이 바로 뒤라 겹치고 2.5 가 의자 바깥이다 → **응접실은 2.5 를 쓰고 UI-SPEC 을 고친다**(플래너가 디자인 소유자에게 확인).

### R5. WR-01~04 — 원인·수정 상태

**찾은 곳:** `DEFERRED-BUGS.md` 의 줄은 `| WR-01~04 | 연결 계층 경고 | 열림 | 2페이즈 전에 고치는 것이 좋음 |`(2026-10-23 22:36 커밋 `6e632a0` 에서 추가). 이 ID 는 **1페이즈 코드 리뷰**(`.planning/milestones/v1.0-phases/01-walking-skeleton/01-REVIEW.md` 의 `### WR-01` … `### WR-04`)의 것이다. 같은 날 뒤이어 모두 고쳐졌고(`01-REVIEW-DISPOSITION.md`: `| WR-01 | WARNING | fixed (9b89310) |` … `WR-04 … fixed (efdf811)`), 네 커밋이 `main`·`v1`·`v2` 모두에 포함되어 있다 [VERIFIED: `git branch --contains`]. (2페이즈 리뷰 `02-REVIEW.md` 에도 번호만 같은 별개의 WR-01~05 가 있다 — 직업 enum 복사본, 쿨다운 지터 등 다른 내용이다. `DEFERRED-BUGS.md` 줄은 1페이즈 중(`docs(01):` 커밋)에 만들어졌고 설명이 "연결 계층 경고"이므로 1페이즈 항목이 맞다. 2페이즈 쪽 처리 여부는 이 요구사항의 대상이 아니라 확인하지 않았다.)

| ID | 원인(리뷰 원문 요지) | 현재 코드에서 고쳐진 모습 | 회귀 테스트 |
|----|---------------------|--------------------------|-------------|
| WR-01 | 연결이 끊긴 채 [나가기] 확인 → `leave` 가 버려지는데 입장 정보는 지워져 서버에 유령이 남음 | `src/screens/Lobby.tsx:177` `if (send({ t: "leave" }) === false) show("연결이 불안정해요. 다시 시도해 주세요");` 와 `send` 가 boolean 반환 | `lobby.test.tsx:464,477`, `useRoomConnection.test.tsx:181` |
| WR-02 | pong 대기 타이머가 종료 상태(replaced/removed)에서 새 연결을 열어 두 창이 서로 쫓아냄 | `useRoomConnection.ts:210` `if (isTerminal(next.status)) clearPongWait();` 와 `:223` `… \|\| isTerminal(linkRef.current.status)) return;` | `useRoomConnection.test.tsx:258` |
| WR-03 | epoch 가 소켓 open 에서 올라 재연결 직후 낡은 view 가 기준선이 되어 지난 입장 토스트·전이가 다시 나옴 | `linkReducer.ts:68` `...(s.awaitingState ? { awaitingState: false, epoch: s.epoch + 1 } : {})` — 첫 `state` 에서 올림 | `linkReducer.test.ts:21,42`, `useRoomConnection.test.tsx:139,426`, `lobby.test.tsx:338` |
| WR-04 | 첫 pong 전 시계 오프셋 0 → 폰 시계가 빠르면 역할 카드가 눌리기 전에 앞면으로 열림 | `useRoomConnection.ts:193` `if (samples.length === 0) setOffset(msg.view.serverNow - Date.now());` | `useRoomConnection.test.tsx:114,129` |

이 세션에서 `npx vitest run test/unit/linkReducer.test.ts test/client/useRoomConnection.test.tsx test/client/lobby.test.tsx` → 3 파일 111 테스트 통과, 전체 `npx vitest run` → 117 파일 **3,094 테스트 통과(12.4초)** [VERIFIED].

**따라서 CONN-04 계획은:** (1) 위 표를 근거로 `DEFERRED-BUGS.md` 의 WR 줄을 지우고 커밋 해시 4개를 남긴다(파일 머리말의 처리 규칙). (2) "더는 나지 않는다"를 증명하는 새 검사 — UI-SPEC 의 "끊김·복귀·화면 껐다 켜기·새로 고침·배포 직후 각 10회 반복에 콘솔 경고·오류 0건, 띠 잔류 0건, 위치 어긋남 0건" 을 Playwright 흐름(`WEBGL_lose_context` 와 소켓 강제 종료 포함)으로 자동화. (3) **새 `world` 프레임이 같은 규약을 지키는 회귀 테스트**: (a) `parseServerMessage` 화이트리스트에 `world` 를 추가하지 않으면 조용히 버려진다 — 반드시 추가하고 알 수 없는 `t` 는 여전히 버리는 테스트 유지 [VERIFIED: `useRoomConnection.ts:62` `if (v && (v.t === "state" || v.t === "pong" || v.t === "error" || v.t === "emoji" || v.t === "chat")) return v as ServerMessage;`], (b) `snap` 은 새 연결의 첫 `state` **다음**에 적용되며 이전 연결의 월드 스토어를 병합하지 않고 통째로 교체, (c) 종료 상태(replaced/removed)에서 월드 스토어가 새 연결을 열지 않음, (d) 첫 스냅샷에 있던 사람은 입장 연출 없음(WR-03 과 같은 기준선 논리). 미해결로 남은 연결 쪽 항목은 1페이즈 `IN-01`(hello 하지 않는 소켓 수명 제한 없음)뿐이며 CONN-04 범위가 아니다.

### R6. 위치 구간 `world` 키 지연 저장·하이버네이션 복원

**사실(공식 문서):**
- 하이버네이션은 "No `setTimeout`/`setInterval` scheduled callbacks are set" 등 조건이 모두 맞아야 하고, 유휴 10초 뒤 들어가며, 그때 "the in-memory state is discarded" 되지만 "Hibernated WebSocket connections stay connected." 코드 업데이트(배포) 시 종료되면 "WebSocket connections are terminated automatically." (종료 코드는 문서에 없음 → 클라이언트는 일반 close 로 보고 기존 재접속 경로를 탄다) [CITED: developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/].
- 소켓 첨부(`serializeAttachment`)는 연결 단위라 위치를 넣지 않는다 (마일스톤 ARCHITECTURE 4.6 결론 유지).
- `storage.get` 은 키 배열(최대 128)을 받아 `Map` 으로 돌려주고, `put` 값 한도는 128 KiB, `await` 없이 이어진 `put` 은 원자적으로 묶이며, **쓰기가 끝나기 전에는 나가는 네트워크 메시지가 보류된다(output gate)** [CITED: developers.cloudflare.com/durable-objects/api/legacy-kv-storage-api/].
- SQLite 기반 DO 의 무료 한도: 쓴 행 **하루 100,000**, 읽은 행 하루 5백만, 요청 하루 100,000(수신 WebSocket 메시지는 20:1 로 환산), 요금제는 쓴 행 50M/월 포함 후 $1/백만 [CITED: developers.cloudflare.com/durable-objects/platform/pricing/]. 사용자의 요금제는 알 수 없다 → 보수적으로 **무료 한도 기준으로 설계**한다.

**현재 코드(원문)**: `Room` 은 상태를 `private room: RoomState | null = null;` (worker/room.ts:65) 로 들고, 생성자에서 `ctx.blockConcurrencyWhile(async () => {` (line 72) 안에서 `"room"` 키 하나를 읽어 소켓 첨부 `connId` 로 `connected` 를 다시 계산한다. 변경은 `await this.ctx.storage.put("room", this.room);`(line 119 등)로 저장한다.

**권고 설계:**

| 항목 | 결정 | 이유 |
|------|------|------|
| 저장 키 | **별도 `"world"` 키**(플레이어 id → `{ p, t0, v }` 또는 정지 지점) | `room` 은 입장·시작 등마다 통째로 다시 쓰인다. 이동마다 `room` 을 쓰면 전체 뷰 직렬화+쓰기가 따라온다(마일스톤 PITFALLS "위치를 RoomState 에 넣고 persistAndBroadcast 재사용 — 절대 안 됨") |
| 쓰기 빈도 | `markWorldDirty()` 가 **1.5~2초 디바운스** `setTimeout` 하나를 걸고 만료 시 `put("world", …)` 1회. 추가 즉시 플러시: 단계 전환(`advance`), `webSocketClose` 로 마지막 소켓이 닫힐 때, `leave`/`kick`, 알람 | 8명이 1.5초마다 탭해도 한 방당 초당 ≤ 0.5행. 즉시 쓰기였다면 연속 이동 5분 ≈ 1,500+행 → 무료 한도(10만/일)를 몇 방으로 소진. 지연 타이머가 있는 동안은 하이버네이션이 막히지만 길이가 2초 이하라 영향이 없다 |
| 잃는 범위 | 배포·크래시 직전 마지막 ≤2초의 탭 | 복원 후 모든 클라이언트가 같은 서버 상태의 스냅샷을 받으므로 서로는 일치한다. 개인 입장에서는 위치가 약간 되돌아갈 수 있고 UI-SPEC "서버 위치로 걷지 않고 바로 맞춤" 과 같다 |
| 정지 지점 압축 | 끝난 구간은 `{ rest:[x,z] }` 로 접어 저장 | 저장 크기·행 수 감소, 복원 계산 단순 |
| 복원 | 생성자 `blockConcurrencyWhile` 에서 `ctx.storage.get(["room","world"])` 한 번(Map). 방에 없는 플레이어·범위 밖/막힌 지점은 정리, 없으면 입장 지점으로 | 하이버네이션·퇴거·배포 모두 같은 경로 |
| hello 직후 | `handleHello` 에서 `state` 를 보낸 **다음** 그 소켓에게만 `world.snap`(현재 로비라면) | 클라이언트 epoch 는 첫 `state` 에서 오른다(WR-03). 같은 연결에서 순서 `state → snap` |
| 전송 순서 | `applyMove` 는 **프레임을 먼저 보내고 그다음** `markWorldDirty()` | output gate 가 쓰기 뒤 전송을 붙잡으므로 지연을 피한다. 플러시 자체는 다른 이벤트에서 일어나 입력 응답을 막지 않는다 |
| 입장/퇴장/킥 | 입장(`create`/`join`/봇 추가) 때 입장 지점 부여 후 `emitWorld(move)`; `leave`/`kick` 때 삭제 | `room.ts` 의 `join`·`handleLeave`·`handleKick`·`handleTestBots` 4곳 |
| 대기실 복귀 | `testReset` (`resetToLobby`) 로 대기실로 돌아오면 전원 입장 지점으로 재배치 후 `snap` 방송 | 11페이즈 재대결의 자리표시 |

`emitWorld(kind, payload)` 를 **월드 프레임의 유일한 전송 경로**로 만들고 `broadcastEvent`(무차별 전송, worker/room.ts:777)를 월드에는 쓰지 않는다 — 6페이즈에는 수신자가 "로비의 연결된 전원"이지만, 7~9페이즈의 `audience` 함수가 이 자리로 들어온다. 로비 밖(`phase !== "lobby"`)에서는 어떤 월드 프레임도 보내지 않는다(게임 시작 이후 v1.0 흐름 보존, 누설 표면 0).

**테스트 가능한 형태:** `test/worker/helpers.ts` 의 `evictDurableObject`(이미 사용 중)로 이동 → 플러시 → 퇴거 → 재접속 후 스냅샷 위치 일치 검증. 플러시는 `runInDurableObject(stub, inst => inst["flushWorld"]())` 같은 테스트 문을 두거나 디바운스 시간을 주입 가능하게 한다(타이머 의존 테스트를 피함).

### R7. iOS 키보드가 열린 하단 채팅 레이아웃 시안 (`?chat-mock=1`) — 무엇을 잴 것인가

**사실:** iOS Safari 는 키보드가 올라와도 **레이아웃 뷰포트를 바꾸지 않고** 비주얼 뷰포트만 줄인다. `visualViewport` 의 `height`/`offsetTop` 이 줄고 `resize`·`scroll` 이 발생한다 [CITED: developer.mozilla.org/en-US/docs/Web/API/VisualViewport]. `interactive-widget=resizes-content` 는 Safari(iOS) 미지원이고 Chrome Android 만 지원한다 [CITED: caniuse.com/mdn-html_elements_meta_name_viewport_interactive-widget_resizes-content]. 입력 글자가 16px 미만이면 iOS 가 포커스 때 확대한다(UI-SPEC 이미 16px).

**시안이 기록할 값(이벤트마다 타임스탬프 로그, 화면 하단 접이식 패널로 표시 + 스크린샷):** 포커스·블러 시점의 `visualViewport.{height,offsetTop,pageTop,scale}`, `window.innerHeight`, `document.documentElement.clientHeight`, `window.scrollY`, 채팅 독 하단 `getBoundingClientRect().bottom` 대 `visualViewport.height + offsetTop` 차(가려짐 여부), **캔버스 `ResizeObserver` 호출 횟수(0 이어야 함 — "캔버스 크기 불변")**, 포커스부터 독이 정착하기까지 시간, 닫을 때 `window.scrollY`·`visualViewport.pageTop` 점프. 한글 조합: `compositionstart/update/end` 와 Enter `keydown` 의 `isComposing`·`keyCode`(229)·`event.timeStamp - compositionend 시각`.
**IME 주의(7페이즈 입력):** WebKit 은 Enter `keydown` 보다 `compositionend` 를 **먼저** 전달하는 순서라 `isComposing` 이 이미 false 일 수 있다. 크롬 개발자 가이드는 `event.isComposing || event.keyCode === 229` 검사와 짧은 시간창 폴백을 권한다 [CITED: developer.chrome.com/docs/modern-web-guidance/guides/forms/ime-safe-enter-submit , bugs.webkit.org/show_bug.cgi?id=165004]. → 시안은 `<form onSubmit>` + `[보내기]` 버튼 + `enterkeyhint="send"` 로 만들고, Enter 키 핸들러는 7페이즈 몫이지만 위 로그로 실기기 순서를 확인한다.
**6페이즈 필수 칸:** iPhone Safari 열(UI-SPEC 확인표). 나머지 열은 가능한 만큼 채우고 "미확인"을 남긴다. **계산 원칙:** 캔버스는 재할당하지 않고(크기 고정) 카메라 중심만 남은 영역 가운데로 옮긴다 — 카메라 목표 이동은 `PX_PER_UNIT` 상수와 정사영 역변환으로 계산(Code Examples 6).

### R8. DEPLOY-02 — `minifia-v2` 이름·주소를 박은 파일 전수 목록과 가드

**v1 이름·주소(`minifia` / `minifia.dhplay.workers.dev`)를 박은 곳 [VERIFIED: grep + 파일 열람]:**

| 파일:줄 | 원문 | 처리 |
|---------|------|------|
| `wrangler.jsonc:3` | `"name": "minifia",` | `minifia-v2` (**이것이 v1 덮어쓰기의 원인 지점**) |
| `dist/worker/wrangler.json` | `"name":"minifia"` (Vite 플러그인이 빌드마다 생성, `.wrangler/deploy/config.json` = `{"configPath":"../../dist/worker/wrangler.json","auxiliaryWorkers":[]}` 가 `wrangler deploy` 의 실제 입력) | 가드는 **이 파일**을 검사 |
| `scripts/prod-url.txt:1` | `https://minifia.dhplay.workers.dev` | `https://minifia-v2.dhplay.workers.dev` (파생 URL: `docs/setup.md` 가 "workers.dev 하위 도메인 `dhplay` … Worker 이름 `minifia` 를 바꾸면 주소가 바뀐다" 로 규칙을 적음. 첫 배포 출력으로 확인 [ASSUMED]) |
| `scripts/e2e/run.mjs:73` | `target = resolveTarget(args.url, readFileSync(…"../prod-url.txt"…))` (기본 대상 = prod-url) | 코드 변경 불필요(파일만 바뀜). 사용법 주석 `:2` 갱신 |
| `scripts/e2e/lib.mjs:140` | USAGE 문자열 `--url https://minifia.dhplay.workers.dev` | 문구 갱신 + `resolveTarget` 에 v1 거부 |
| `scripts/e2e/lib.test.mjs:93` | `const PROD = "https://minifia.dhplay.workers.dev\n";` 등 | v2 로 교체 + v1 거부 테스트 |
| `scripts/smoke.mjs:121` | `--prod` 가 `prod-url.txt` 읽음, 위치 인자 주소도 받음 | 공통 가드 import |
| `scripts/bots.mjs:41`, `uat-day/night/vote/test-room/test-bots.mjs` | `if (args.prod) base = readFileSync(… "./prod-url.txt" …)` | 공통 가드 import |
| `scripts/gallery.mjs:7` | `const ORIGIN = "https://minifia.dhplay.workers.dev";` | `prod-url.txt` 를 읽도록 바꾸거나 삭제(v1.0 화면설계서용 스크립트) |
| `index.html:12` | `og:image` = `https://minifia.dhplay.workers.dev/og.png` | **UI-SPEC: "링크 미리보기(og:*)는 이 페이즈에서 바꾸지 않는다"** → 가드 검사의 허용 목록에 이유와 함께 등록. `index.html:7` `<title>Minifia</title>` 는 `Minifia v2` 로 |
| `README.md:25` | `- 배포 주소: https://minifia.dhplay.workers.dev` | v2 주소 + v1 보존 안내 |
| `docs/setup.md:12`, `HANDOFF.md:10` | v1 이름 설명·경고 | 첫 배포 뒤 갱신(HANDOFF 6KB 제한) |
| 역사 문서(`docs/decisions/*`, `.planning/milestones/*`) | 과거 사실 | 가드 검사 대상 아님(허용 목록: `docs/`, `.planning/`) |

**가드 설계 (단일 출처 + 두 겹):**
1. `scripts/deploy-target.mjs`(신규, Node 내장만): `export const WORKER_NAME = "minifia-v2"`, `export const V1_ORIGIN`(금지 목록), `assertNotV1(urlOrOrigin)`, `expectedOrigin()`. **모든 스크립트가 이것만 import** 한다.
2. **배포 가드**: `npm run deploy` 를 `node scripts/check-account.mjs && vite build && node scripts/check-deploy-target.mjs && wrangler deploy` 로. `check-deploy-target.mjs` 는 **빌드 산출물 `dist/worker/wrangler.json` 의 `name`** 이 `WORKER_NAME` 인지, `wrangler.jsonc` 의 `name` 과 일치하는지, `scripts/prod-url.txt` 의 호스트가 `${WORKER_NAME}.` 로 시작하는지, `preview_urls === false` 인지를 검사하고 어긋나면 종료 상태 1. (소스 `wrangler.jsonc` 만 보면 오래된 `dist` 나 설정 불일치를 놓친다 — 실제 배포 입력은 `dist/worker/wrangler.json`.)
3. **검사 가드**: `resolveTarget`(E2E)·`smoke`·`bots`·`uat-*` 의 기준 주소 해석 지점에 `assertNotV1`. `--url` 로 명시해도 v1 이면 거부(옵션으로 푸는 길을 만들지 않는다 — "검사하지 않는다" 요구).
4. **정적 회귀 테스트**(`node --test scripts/deploy-target.test.mjs`): `wrangler.jsonc`(주석 있는 JSONC → 주석 제거 후 파싱) `name`, `prod-url.txt`, `package.json` 의 `deploy` 스크립트 문자열에 `check-deploy-target` 포함, 그리고 `scripts/`·`src/`·`index.html`·`README.md` 에서 V1_ORIGIN 문자열 전수 검색(허용 목록: `index.html` og:image, 사유 명시).
5. **v1 이 그대로임을 확인**: 스크립트가 v1 주소를 검사하면 요구와 충돌하므로 **일회성 수동 확인**으로 한다. 이 세션이 기준선을 남겼다: `curl https://minifia.dhplay.workers.dev/api/health` → `{"ok":true,"version":"2026-10-29T14:52:03Z+cb6979c"}` (2026-10-31 관측), `https://minifia-v2.dhplay.workers.dev/api/health` → HTTP 404(아직 없음). 첫 배포 뒤 사람이 같은 `curl` 로 v1 버전 문자열이 그대로인지 확인하고 결과를 SUMMARY 에 적는다(`checkpoint:human-verify`).
6. 새 Worker 이름 = 새 DO 네임스페이스라 v1 저장 방과 섞이지 않는다(마일스톤 SUMMARY #9). `exports` 선언(`"Room": { "type": "durable-object", "storage": "sqlite" }`)이 있어 `migrations` 불필요 [VERIFIED: wrangler.jsonc, 결정 0009]. 계정 확인(`check-account.mjs`)은 이 Mac 에서 `배포 계정 확인: dhkim1522@naver.com` 으로 통과 [VERIFIED: 실행].

## Architecture Patterns

### System Architecture Diagram

```
 [폰 A]                                                     [폰 B ...]
  터치(pointer) ──탭 판정(10px/350ms)──▶ screenToGround(정사영 역변환)
        │                                        │ {t:"move", x,z (1/100 단위 정수)}
        ▼                                        ▼
  ┌──────────────── Room Durable Object (worker/room.ts) ────────────────┐
  │ webSocketMessage → zod strictObject → advance(tick)                  │
  │   move → [phase==="lobby"?] → 150ms 간격 → positionAt(현재 구간,now)  │
  │          → snapToWalkable → A*(ASCII 격자) → 새 구간 {p,t0,v}         │
  │          → emitWorld("move") ──▶ 로비 연결 전원 (audience 자리)        │
  │          → markWorldDirty() ──(1.5~2s 디바운스)──▶ storage "world"    │
  │ hello → state(+epoch↑) → world.snap(그 소켓만)                       │
  │ 생성자 blockConcurrencyWhile ← storage.get(["room","world"])          │
  └──────────────────────────────────────────────────────────────────────┘
        │ world.move / world.snap                          ▲
        ▼                                                  │ (배포·하이버네이션 뒤 복원)
  useRoomConnection ──onEvent──▶ WorldStore(React 밖: Map<seat, Segment>)
        │ state(players: 닉네임·connected·isHost)             │
        ▼                                                      ▼
  ┌──────────── WorldStage (React 부품, 지연 로드 청크) ───────────────┐
  │ rAF 한 루프:                                                       │
  │   serverNow = Date.now()+offset                                    │
  │   pos[seat] = positionAt(seg, serverNow)   ← 서버와 같은 순수 함수  │
  │   camera.target ← follow(clamp(myPos,±pan), τ=152ms)               │
  │   MapRenderer.render()  ← three: 정사영, 정적 그림자, 조명 예산       │
  │   Vector3.project → DOM 층(캐릭터·그림자·이름표·링) transform 쓰기     │
  │ 컨텍스트 소실 → MapStatus 상태기계(카드·가림막) / 서버 연결은 유지    │
  └────────────────────────────────────────────────────────────────────┘
  보조: ?perf=1 (PerfScene + HUD → 결과 카드 → 06-PERF-RESULTS.md → 결정 0047)
        ?chat-mock=1 (visualViewport·ResizeObserver·IME 로그)
```

### Recommended Project Structure
```
shared/game/
├── map.ts          # MapDef(ASCII 마스크, 입장 지점 8곳, 모이는 링), snapToWalkable, findPath, smooth (순수)
├── world.ts        # Segment, positionAt, applyMove(순수), 고정소수점 변환, MOVE_SPEED, MOVE_MIN_GAP_MS
└── (audience.ts)   # 7페이즈에서 확장 — 6페이즈는 emitWorld 한 경로만
shared/protocol.ts  # ClientMessage "move", ServerMessage "world"(move|snap)  (값 import 금지 규칙 유지)
shared/schemas.ts   # z.strictObject move
worker/room.ts      # world 저장/복원/디바운스, apply move, hello snap, spawn/despawn
src/world/
├── camera.ts       # PX_PER_UNIT, groundToScreen/screenToGround, clampTarget, followStep (three 없이 테스트 가능한 순수 수학)
├── store.ts        # WorldStore (React 밖), snap/move 적용, positionsAt(t)
├── mapRenderer.ts  # MapRenderer 인터페이스 + three 구현(지연 로드)
├── maps/parlor.ts  # 시안 이식(절차적 지오메트리, 병합, LIGHT_TUNE, 시간대 데이터)
├── status.ts       # MapStatus 상태기계(순수) + 컨텍스트 복구 타이머 로직
src/components/
├── WorldStage.tsx, WorldCharacter.tsx, Nameplate.tsx, DestinationRing.tsx, WalkHint.tsx, MapStatusCard.tsx
src/debug/perf/     # ?perf=1 (HUD, 시나리오, 결과 카드), ?chat-mock=1  — 쿼리일 때만 import()
scripts/
├── deploy-target.mjs, check-deploy-target.mjs, deploy-target.test.mjs
test/unit/{map,world,camera,status}.test.ts, test/worker/world.test.ts, test/client/worldStage.test.tsx
```

### Pattern 1: 서버 권위 구간 이동 (예측 없음)
**What:** 클라이언트는 목적지만 보내고 서버가 만든 구간 `{p, t0, v}` 만 따라 걷는다. 위치는 항상 `positionAt(seg, serverNow)`. **When:** 모든 캐릭터(내 캐릭터 포함). UI-SPEC "탭 → 링 100ms, 출발은 서버 구간 수신 후(보통 300ms, 최대 500ms)".
(Code Examples 2)

### Pattern 2: 로비 밖에서는 월드 프레임 없음
**What:** `phase === "lobby"` 일 때만 `move` 처리·`world` 방송·hello `snap`. 게임 시작 이후 v1.0 흐름과 누설 표면이 그대로다.

### Pattern 3: 맵 렌더러 교체 가능성
**What:** `MapRenderer`(mount, resize, setCameraTarget, render, groundToScreen, screenToGround, setBudget, dispose) 뒤에 three 구현. 구운 이미지 구현은 성능 게이트 실패 때 추가한다(지금 만들지 않는다).

### Anti-Patterns to Avoid
- **위치를 React 상태에 넣기**: 프레임마다 리렌더. 외부 스토어 + ref 로 직접 transform 쓰기.
- **`room` 키에 위치 넣기 / 이동마다 `persistAndBroadcast`**: 전체 뷰 직렬화·쓰기·무료 한도 소진.
- **시안 코드를 그대로 이식**: 박스마다 새 재질·메시, 매 프레임 2048² 그림자, 포인트 라이트 9개 — R2.5 예산으로 줄여서 이식.
- **캔버스를 키보드·바 높이에 맞춰 리사이즈**: WebGL 재할당·카메라 튐. 캔버스는 고정, 카메라 중심만 이동.
- **재접속 띠로 흐름 밀기**: 캔버스 크기 변화(UI-SPEC 이미 위에 얹기로 결정).
- **서버 이동 거절마다 `sendRejection`(오류+전체 state)**: 거절은 조용히 버림(UI-SPEC).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebGL 컨텍스트 소실/복구 내부 처리 | 자체 GL 상태 복원 | three 내장 `onContextLost/Restore` + `forceContextLoss()` 테스트 | 소스 확인됨. 우리는 UI 상태기계·재생성 폴백만 |
| 정적 지오메트리 병합 | 직접 버퍼 합치기 | `mergeGeometries` (BufferGeometryUtils) | draw call 감소 표준 도구 |
| 월드 → 화면 투영 | 수동 행렬 곱 | `Vector3.project(camera)` (또는 `camera.ts` 순수 수학 + three 와 일치 테스트) | 두 방법이 같은 값임을 단위 테스트로 증명 |
| 바닥 좌표 찍기 | 임의 삼각법 | `Raycaster.setFromCamera` + 바닥 `Plane` (정사영 지원) 또는 `camera.ts` 역변환(테스트로 일치 확인) | 정사영 카메라의 레이 시작점이 다름 |
| 재접속/에포크/시계 보정 | 월드 전용 재접속 | 기존 `useRoomConnection`·`linkReducer`·`estimateOffset` | WR-01~04 가 고쳐진 검증된 경로 |
| 하이버네이션 복원 시험 | 가짜 시간 장난 | `evictDurableObject`·`runInDurableObject` | 이미 test/worker 에서 사용 |
| fps 표시 | stats.js 같은 패키지 | 자체 소형 HUD(링 버퍼 + 백분위) | 5분 평균·50ms 초과 횟수·p95·재로딩 감지가 필요한데 stats.js 는 라이브 fps 만 보여 줌. 새 패키지 없음 |
| 경로 탐색 | (예외) 직접 작성 | 80줄 격자 A* + LOS + 속성 테스트 | 정적 한 장·`shared/` 제약·결정성. 외부 패키지는 위험만 큼 |

**Key insight:** 이 페이즈의 새 코드 대부분은 "얇은 접착제"다 — 렌더링·투영·컨텍스트·재접속·저장은 라이브러리/기존 모듈이 하고, 우리는 *순수 수학 모듈(통과를 증명하기 쉬움)*과 *측정*에 코드를 쓴다.

## Runtime State Inventory (Worker 이름 변경 `minifia` → `minifia-v2`)

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | v1 방 데이터는 v1 Worker 의 DO 네임스페이스에 있다. 새 Worker 이름은 새 DO 네임스페이스라 v2 는 빈 상태로 시작한다. 브라우저 `localStorage` 키(`minifia:session` 등)는 출처(origin)별이라 v1·v2 주소 사이에 섞이지 않는다 | 없음 (확인: 데이터 이전 없음, 코드 변경 없음) |
| Live service config | Cloudflare 에 새 Worker `minifia-v2` 가 생긴다. v1 Worker 는 건드리지 않는다. workers.dev 하위 도메인 `dhplay` 는 계정 공용 | 첫 배포 뒤 v1 `/api/health` 버전 문자열 불변 확인(R8-5) |
| OS-registered state | 없음 — 이 프로젝트에 OS 작업·서비스 등록 없음 | 없음 |
| Secrets/env vars | 없음 — `wrangler.jsonc` 에 시크릿 이름 없음, `.dev.vars` 는 gitignore | 없음 |
| Build artifacts | `dist/worker/wrangler.json`(이름이 `minifia`, 빌드마다 재생성), `.wrangler/deploy/config.json`, `worker-configuration.d.ts`(typegen 생성) | 이름 변경 뒤 `vite build` 필수 → 가드가 `dist` 이름을 검사. `package.json` 의 `name: "minifia"` 는 npm 패키지명이라 그대로 둔다 |

## Common Pitfalls

### Pitfall 1: 가드가 소스 `wrangler.jsonc` 만 검사한다
**What goes wrong:** 설정을 고쳤는데 오래된 `dist/worker/wrangler.json`(이름 `minifia`)으로 `wrangler deploy` 가 v1 을 덮어쓴다. **Why:** Vite Cloudflare 플러그인이 빌드 산출물에 설정을 만들고 `.wrangler/deploy/config.json` 이 그것을 가리킨다 [VERIFIED]. **How to avoid:** 가드를 `vite build` *뒤*, `wrangler deploy` *앞*에 두고 `dist` 파일을 검사. **Warning signs:** `npm run deploy` 출력의 Worker 이름·URL.

### Pitfall 2: three 최신판 즉시 채택 / 시안 상수 그대로 이식
**What goes wrong:** 0.187.0(출간 1일)을 쓰면 SUS 경고 무시. r128 조명 값이 r155+ 에서 다르게 보임. **How to avoid:** 0.186.1 고정+체크포인트, `LIGHT_TUNE` 으로 시안과 나란히 비교. 제거된 API(`PCFSoftShadowMap`, `Clock`, `outputEncoding`→`outputColorSpace`/`colorSpace`) 점검.

### Pitfall 3: 데스크톱 숫자로 합격 선언
**What goes wrong:** 이 세션 실측(시안, M3, CPU 6배 감속)은 60fps 였다. GPU 프래그먼트·그림자 패스·타일 메모리 한계는 폰에서만 드러난다. **How to avoid:** 합격 판정은 실기기 HUD 결과로만. 데스크톱은 회귀·예산 확인용.

### Pitfall 4: iOS 저전력 모드/열 스로틀을 모르고 재서 오판
**What goes wrong:** 저전력 모드 rAF 30fps 제한을 "렌더가 느림"으로 오인 [CITED: bugs.webkit.org/show_bug.cgi?id=215745]. **How to avoid:** HUD 의 rAF 주기 경고, 체크리스트 1번, 첫 1분 대비 마지막 1분 비율.

### Pitfall 5: 시계 오프셋 오차가 "같은 위치" 허용 오차를 먹는다
**What goes wrong:** 걷기 속도 2.2 단위/초에서 0.3 단위 = 약 136ms. `estimateOffset` 은 왕복이 가장 짧은 표본의 `RTT/2` 보정이라 LTE 에서 비대칭 지연 ±수십~100ms 가 남을 수 있어(계산) 두 폰이 서로 다른 시각 기준으로 같은 구간을 그리면 UI-SPEC 의 "어느 시점에도 0.3 이하"를 실기기에서 못 맞출 수 있다. **How to avoid:** 0.3 기준은 **같은 머신 E2E**(클록 공유)에만 적용하고 실기기는 0.5 로 완화하거나 오프셋 잔차를 같이 기록. 구간 시작에 가속 램프(약 150ms)를 두는 완화는 팀 확인 뒤 판단. 오프셋 재표본은 접속 직후 3개+복귀 때뿐이라(`INITIAL_PINGS`) 긴 로비 대기 중 시계 드리프트는 복귀 때 갱신된다 [VERIFIED: useRoomConnection.ts 구조]. 가능하면 월드 시계는 `performance.now()` 기반으로 두어 시스템 시간 조정에 안 흔들리게 한다 [ASSUMED].

### Pitfall 6: E2E `data-wx` 4Hz 갱신으로 걷는 중 위치를 비교
**What goes wrong:** UI-SPEC 은 `data-wx/wz` 를 초당 4회 이하로 갱신하게 하면서 같은 캐릭터의 두 폰 좌표 차 ≤ 0.3 을 요구한다. 걷는 중 속도 2.2 × 최대 250ms 낡음 = 최대 0.55 단위로 검사 자체가 흔들린다. **How to avoid:** 정지한 캐릭터만 `data-wx` 로 비교하거나, `data-wt`(샘플 서버 시각)를 같이 달아 테스트가 같은 시각으로 외삽하거나, `window.__mfWorld.sample(seat, t)` 테스트 훅으로 같은 `t` 에서 `positionAt` 을 직접 읽는다.

### Pitfall 7: StrictMode·언마운트에서 컨텍스트 누수
**What goes wrong:** 개발 이중 마운트/로비 재진입마다 컨텍스트가 쌓여 오래된 것이 죽는다. **How to avoid:** `dispose()` + `forceContextLoss()` + 캔버스 제거를 한 함수에서, 마운트 효과를 멱등으로. 열고 닫기 5회 뒤 `info.memory` 원복 테스트.

### Pitfall 8: 이름표 DOM 의 소수 픽셀 흔들림·z-순서
**What goes wrong:** 카메라 감쇠 중 소수 픽셀 transform 으로 글자가 흐려지거나 떨림. **How to avoid:** 장치 픽셀에 맞춰 반올림, 캐릭터 z-index 는 발끝 y(정수 반올림)로 한 번 계산, 이름표는 캐릭터와 같은 z 그룹.

### Pitfall 9: 로비 교체로 E2E·테스트가 대량 깨짐
**What goes wrong:** `lobbyFlow`·`grabLobbyStage`·`crownChecks` 등 `DayTable` 전제 검사가 모두 실패. **How to avoid:** 로비 화면 교체와 E2E/테스트 교체를 같은 웨이브에 넣고 `skip` 금지(ROADMAP 공통 완료 조건). 새 검사는 `[data-world-stage]`·`data-seat` 기반.

### Pitfall 10: 방 코드·토큰 흐름 회귀
**What goes wrong:** `Lobby` 가 `RoomScreen` 의 `key={sceneKey(view.phase)}` 로 단계마다 리마운트된다 [VERIFIED: RoomScreen.tsx:273] → 맵이 로비 ↔ 배정 사이에서 파괴/재생성. **How to avoid:** UI-SPEC 대로 시작 시 420ms 가림 후 dispose, 복귀 시 재생성. 8페이즈에서 맵이 단계에 걸쳐 살아야 하므로 `WorldStage` 소유자를 `RoomScreen` 위로 올릴 수 있게 렌더러 수명 관리를 부품 안에 가두지 말고 훅/모듈로 분리해 둔다.

## Code Examples

### 1. `MapRenderer` 인터페이스 (three 구현 / 구운 이미지 구현이 공유)
```ts
// src/world/mapRenderer.ts (three import 는 이 모듈과 maps/* 뿐 — 동적 import 청크)
export type MapStatus = "loading" | "ready" | "lost" | "failed" | "unsupported";
export interface Budget { dpr: number; shadow: 0 | 512 | 1024 | 2048; lights: "full" | "core"; props: "full" | "reduced"; fog: boolean; motes: boolean }
export interface MapRenderer {
  mount(host: HTMLElement): Promise<void>;           // 에셋·첫 프레임 준비까지 resolve
  resize(w: number, h: number): void;                // 150ms 디바운스 뒤 호출
  setCameraTarget(x: number, z: number): void;       // 월드 단위
  render(dt: number): void;
  groundToScreen(x: number, z: number): { sx: number; sy: number };
  screenToGround(sx: number, sy: number): { x: number; z: number };
  setBudget(b: Budget): void;
  onStatus(cb: (s: MapStatus) => void): () => void;  // 컨텍스트 소실/복구/실패
  dispose(): void;                                   // renderer.dispose() + forceContextLoss() + 캔버스 제거
}
```

### 2. 서버 구간과 `positionAt` (순수, `shared/game/world.ts`)
```ts
// Source: 설계 제안 — 마일스톤 ARCHITECTURE 4.1 을 (x,z)·고정소수점·sqrt 전용으로 정리
export const UNIT = 100; // 1 월드 단위 = 100
export interface Segment { p: number[]; t0: number; v: number } // p=[x0,z0,x1,z1,…]/UNIT 정수, t0=서버 ms, v=단위/초×UNIT
export function positionAt(seg: Segment, t: number): { x: number; z: number } {
  const { p, t0, v } = seg;
  let rest = Math.max(0, ((t - t0) / 1000) * (v / UNIT)) * UNIT; // 남은 이동 거리(고정소수점)
  for (let i = 0; i + 3 < p.length; i += 2) {
    const dx = p[i + 2]! - p[i]!, dz = p[i + 3]! - p[i + 1]!;
    const len = Math.sqrt(dx * dx + dz * dz); // Math.hypot 금지
    if (rest <= len) { const k = len === 0 ? 0 : rest / len; return { x: (p[i]! + dx * k) / UNIT, z: (p[i + 1]! + dz * k) / UNIT }; }
    rest -= len;
  }
  return { x: p[p.length - 2]! / UNIT, z: p[p.length - 1]! / UNIT };
}
```

### 3. 컨텍스트 소실 처리 (three 는 `preventDefault` 를 이미 한다)
```ts
// Source: three@0.186.1 WebGLRenderer.js:1113-1143 (내장 처리) + UI-SPEC 연결·복귀 상태 표
canvas.addEventListener("webglcontextlost", () => { status = "lost"; showVeil(); restoreTimer = setTimeout(recreateOnce, 3000); failTimer = setTimeout(fail, 5000); });
canvas.addEventListener("webglcontextrestored", () => {
  clearTimeout(restoreTimer); clearTimeout(failTimer);
  renderer.shadowMap.needsUpdate = true;   // 정적 그림자 다시 굽기
  snapCameraAndCharacters(); render(0); hideVeil(); status = "ready";
});
```

### 4. 배포 가드 (빌드 뒤 `dist` 검사)
```js
// scripts/check-deploy-target.mjs  — npm run deploy: check-account → vite build → 이 스크립트 → wrangler deploy
import { readFileSync } from "node:fs";
import { WORKER_NAME } from "./deploy-target.mjs";
const built = JSON.parse(readFileSync(new URL("../dist/worker/wrangler.json", import.meta.url), "utf8"));
if (built.name !== WORKER_NAME) { console.error(`배포 중단 — dist/worker/wrangler.json 의 name 이 ${built.name} (기대 ${WORKER_NAME})`); process.exit(1); }
```

### 5. rAF 루프의 프레임 기록 (HUD 공통, 샘플링 비용 최소)
```ts
const deltas = new Float32Array(60 * 330); let n = 0, last = 0;
function frame(now: number) {
  if (last) { if (n < deltas.length) deltas[n++] = now - last; }
  last = now;
  update(Math.min((now - (prev || now)) / 1000, 0.05)); // dt 클램프(복귀 첫 프레임 보호)
  requestAnimationFrame(frame);
}
// 결과: avgFps = n / ((Σdeltas)/1000), jank = deltas.filter(d => d > 50).length, 백분위는 정렬 복사본에서
```

### 6. 카메라 감쇠(프레임 독립)와 키보드 보정
```ts
// "거리의 90%를 350ms 에 줄임" → 1 − e^(−350/τ) = 0.9 → τ = 350 / ln(10) ≈ 152ms
const TAU_MS = 350 / Math.LN10;
cam = cam + (target - cam) * (1 - Math.exp(-dtMs / TAU_MS));
// 키보드(채팅 시안): 캔버스 재할당 없이, 남은 영역 높이로 카메라 중심 y 만 이동
const dockTop = visualViewport.height + visualViewport.offsetTop - dockHeight;
```

### 7. `Room` 연결 지점 (기존 구조 위)
```ts
// worker/room.ts — 생성자: await ctx.storage.get(["room","world"]) → this.world 복원
// handleHello 끝: await this.persistAndBroadcast(); this.sendWorldSnap(ws)   // state 다음, 그 소켓만
// applyMove: this.emitWorld(frame)  →  this.markWorldDirty()   // 전송 먼저, 저장은 디바운스
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `THREE.Clock` | `THREE.Timer` (또는 rAF `time` 인자) | r183 | 시안의 `new THREE.Clock()` 사용 금지 |
| `PCFSoftShadowMap` | 제거됨(`PCFShadowMap` 으로 대체 경고) | 0.186 이전 | 사다리 단계 2 문구 수정 |
| 레거시 조명 단위 | 물리 기반(cd, `decay` 2) 기본 | r155 | 조명 상수 전부 재조정 |
| `renderer.outputEncoding`, `texture.encoding` | `outputColorSpace`, `colorSpace` | r152+ | 시안 이식 시 이름 교체 |
| 0044-16 "three.js 안 씀" | 0046: 맵은 three | 2026-10-31 | 마일스톤 리서치의 DOM 확정 결론은 맵에 대해 폐기 |

**Deprecated/outdated:** `design/v2.0/backgrounds/minifia-bg-concepts.html` 은 CDN `three r128` 스크립트를 쓴다 — 제품에는 CDN 금지(UI-SPEC E2E "다른 출처 요청 없음").

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 카카오톡 인앱 브라우저는 iOS=WKWebView, Android=시스템 WebView 이고 원격 디버깅이 꺼져 있다 | R2 | 켜져 있으면 더 정밀한 계측이 가능(손해 없음). 엔진이 다르면 측정 해석이 달라짐 |
| A2 | `PX_PER_UNIT = 66.7` 시작값(시안 560÷8.4) | R1 | 캐릭터가 너무 크거나 작음 → 카메라/이동 영역 정합 테스트 값 변경 |
| A3 | 구운 이미지 탈출구의 크기·메모리 추정(약 1.9k×2.0k px, 시간대 5장) | R1 | 탈출구 구현 비용 오판 — 지금은 만들지 않으므로 낮음 |
| A4 | draw call ≤100, 동적 광원 ≤3, DOM 갱신 p95 ≤3ms, A/B 8fps 같은 예산·임계값은 제안값 | R1·R2.5 | 스파이크가 실제 기준을 정함 — 기록으로 수정 |
| A5 | `Math.hypot`·삼각함수는 엔진 간 결과가 달라질 수 있다 | R4 | 안 써도 손해 없는 예방 규칙 |
| A6 | 사용자 Cloudflare 요금제 불명 → 무료 한도 기준 설계 | R6 | 유료면 디바운스를 줄일 수 있음 |
| A7 | `https://minifia-v2.dhplay.workers.dev` 가 파생 URL 이다 | R8 | 첫 배포 출력으로 확정 |
| A8 | iOS 시뮬레이터는 기능 점검용으로만 유효 | R2.7 | 낮음 |
| A9 | 새 렌더러에 기존 씬 그래프를 다시 쓰면 자원이 자동 재업로드된다 | R3 | 틀리면 복구 폴백 구현 변경 — Wave 0 스모크로 확인 |
| A10 | `alpha:false`·정적 그림자 갱신·병합이 폰 fps 를 실제로 개선한다 | R1·R2.5 | 개선이 작으면 사다리 단계가 더 필요 |
| A11 | Android 배터리 절약 모드도 프레임 제한이 있다 / `adb dumpsys battery` 로 온도 확인 | R2.3 | 선택 항목 |
| A12 | 인앱 브라우저에서 클립보드 복사가 막힐 수 있다 | R2.6 | 스크린샷이 주 수단이라 영향 작음 |
| A13 | 헤드리스 Chrome 의 WebGL 은 집 Windows PC 에서도 동작한다 | Validation | 안 되면 `--use-angle=swiftshader --enable-unsafe-swiftshader` 인자 필요(이 Mac 프로브는 둘 다 OK) |
| A14 | 월드 시계를 `performance.now()` 기반으로 두는 것이 시스템 시간 변경에 더 안전하다 | Pitfall 5 | 낮음 |

## Open Questions

1. **UI-SPEC 의 응접실 모이는 링 반지름(1.9)을 시안 값(2.5)으로 고칠까?**
   - 알고 있는 것: 시안 코드는 응접실 2.5·광장 1.9, 의자 반지름 1.55.
   - 불명확: 디자인 의도가 의자 바깥인지.
   - 권고: 2.5 로 계획하고 UI-SPEC 한 줄을 수정(`gsd-ui-phase` 후속).
2. **three 0.186.1 vs 0.187.0** — 사용자 선택 사항. 권고 0.186.1(5주 경과), UI-SPEC 은 0.187.0 으로 적음.
3. **사용자의 실기기 목록**(저가 Android 램 3GB 이하, A11~A13급 iPhone, 갤럭시)과 `adb`(platform-tools) 설치 여부 — 사람 확인 체크포인트가 필요. 기기가 부족하면 어떤 열을 "미확인"으로 둘지.
4. **로비 테스트 방 서버 봇 배회**(UI-SPEC "권장, 플래너 판단") — 구현하면 `takeDueBotSteps`/`syncBotPlan` 에 `wander` 단계가 들어가고 봇도 같은 `applyMove` 를 쓴다. 실기기 1대로도 이동을 볼 수 있어 권고하지만 범위는 플래너 몫.
5. **`WorldStage` 소유 위치**: 6페이즈는 `Lobby` 안(UI-SPEC "시작 시 dispose"), 8페이즈는 단계에 걸쳐 유지. 훅/모듈 분리로 두 경우를 모두 지원할지.
6. **E2E 0.3 단위 일치 검사 방식**(Pitfall 6) — 정지 상태 비교 + 테스트 훅 vs `data-wt`. 플래너가 UI-SPEC 문구와 맞춘다.
7. **무료 요금제 여부**와 `world` 디바운스 길이(1.5 vs 2초).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | 빌드·테스트·스크립트 | ✓ | v26.0.0 (engines ≥22.12) | — |
| npm / registry 접근 | three 설치 | ✓ | — | — |
| wrangler | 배포 | ✓ | 4.151.3, 개인 계정 로그인(`check-account` 통과) | — |
| 시스템 Chrome + playwright-core | E2E, 컨텍스트 소실 테스트, 번들/시안 프로브 | ✓ (Mac) | playwright-core 1.64.1, WebGL2 Metal·`WEBGL_lose_context` ✓ | 집 Windows PC 는 `CHROME_PATH`·SwiftShader 인자(A13) |
| Xcode / iOS Simulator | 기능 사전 점검(선택) | ✓ | iOS 18.6 시뮬레이터 | 실기기만 |
| Android `adb` | 온도·`dumpsys` 보조(선택) | ✗ | — | HUD 만 + 손으로 열감 기록 (`brew install android-platform-tools` 는 사람이) |
| 실기기(저가 Android, 구형 iPhone, 카카오톡 인앱) | 성공 기준 4 | ✗ (에이전트가 접근 불가) | — | **차단 아님·사람 체크포인트**: 스파이크 빌드를 배포하고 사용자가 측정, 결과를 `06-PERF-RESULTS.md` 에 기록 |
| curl / 인터넷 | v1 기준선 확인 | ✓ | — | — |

**Missing dependencies with no fallback:** 없음 (실기기는 사람 단계).
**Missing dependencies with fallback:** adb → HUD + 수동 열감.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.12 (projects: `unit`(node) · `client`(happy-dom) · `worker`(workerd)) + `node --test`(scripts) + playwright-core 1.64.1(E2E) |
| Config file | `vitest.config.ts` (기존), `scripts/e2e/` |
| Quick run command | `npx vitest run test/unit/map.test.ts test/unit/world.test.ts test/unit/camera.test.ts` (신규, 약 1초) / 해당 파일만 |
| Full suite command | `npx vitest run && node --test scripts/*.test.mjs scripts/e2e/lib.test.mjs && npm run typecheck` (기준선: 117 파일 3,094 테스트 12.4초 통과) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEPLOY-02 | `dist/worker/wrangler.json` 이름 가드·v1 주소 문자열 검색·`resolveTarget`/스크립트의 v1 거부 | node:test | `node --test scripts/deploy-target.test.mjs scripts/e2e/lib.test.mjs` | ❌ Wave 0 |
| DEPLOY-02 | v2 첫 배포 후 모바일에서 방 만들기·참가, v1 `/api/health` 버전 불변 | manual (human-verify) + `node scripts/smoke.mjs --prod` (v2) | `node scripts/smoke.mjs --prod --stage create` | 스크립트 ✅ / 확인 수동 |
| MAP-02 | `positionAt` 단조·도착 시각·`t<t0`·끝 이후, 직선/꺾임 | unit | `npx vitest run test/unit/world.test.ts` | ❌ Wave 0 |
| MAP-02 | 마스크 속성(입장 지점 연결, 경로가 막힌 셀 미통과, 결정성, 보정) | unit | `npx vitest run test/unit/map.test.ts` | ❌ Wave 0 |
| MAP-02 | `move` 스키마(strictObject, 정수 범위), 로비 밖 무시, 150ms 간격 버림, 두 소켓에 같은 `world.move` | worker | `npx vitest run test/worker/world.test.ts` | ❌ Wave 0 |
| MAP-02 | 같은 캐릭터가 두 페이지에서 같은 경로(정지 후 위치 일치 ≤0.3, 걷는 중은 `sample(seat,t)` 훅) | E2E(playwright) | `npm run e2e -- --url http://localhost:5173 --only world` | ❌ Wave 0 |
| MAP-03 | 카메라 투영/역투영이 three 와 일치, 클램프, 이동 영역 ↔ 스테이지 사각형 정합(4개 폰 크기) | unit | `npx vitest run test/unit/camera.test.ts` | ❌ Wave 0 |
| MAP-01 | 닉네임·방장·끊김 표시 DOM(`data-seat`), 접근성 목록, 입장 낙하·첫 스냅샷 무연출 | client (fake `MapRenderer`) | `npx vitest run test/client/worldStage.test.tsx` | ❌ Wave 0 |
| MAP-05 | 퇴거 후 재접속에서 위치 복원, hello `snap` 순서(state→snap), 디바운스 플러시 | worker | `npx vitest run test/worker/world.test.ts` | ❌ Wave 0 |
| MAP-05 | 컨텍스트 소실/복구/방치(재생성·실패 카드) 상태기계 | unit(순수 `status.ts`) + E2E(`WEBGL_lose_context`) | `npx vitest run test/unit/status.test.ts` | ❌ Wave 0 |
| MAP-05 | iOS 화면 잠금·앱 전환 복구 | **manual-only** (실기기, 정당화: iOS 가 그래픽 자원을 회수하는 조건은 시뮬레이션 불가) | HUD/`06-PERF-RESULTS.md` | — |
| CONN-04 | WR-01~04 회귀(기존 테스트) + `world` 프레임이 화이트리스트·epoch·종료 상태 규약을 지킴 | client/unit | `npx vitest run test/client/useRoomConnection.test.tsx test/unit/linkReducer.test.ts test/client/lobby.test.tsx` | ✅(기존) + ❌ 신규 케이스 |
| CONN-04 | 끊김·복귀·화면 껐다 켜기·새로 고침·배포 직후 10회 반복 콘솔 경고/오류 0 | E2E | `npm run e2e -- --url … --only reconnect` | ❌ Wave 0 |
| 성공 기준 4 | 5분 평균 ≥55fps, 끊김 ≤5, 발열, 메모리, 3초 조작 | **manual-only** (실기기) + HUD | `?perf=1` 결과 카드 → `06-PERF-RESULTS.md` | ❌ Wave 0 |
| 렌더 예산 회귀 | 병합 후 draw call·광원 수가 예산 이하, 열고 닫기 5회 후 `info.memory` 원복 | E2E(헤드리스, `renderer.info`) | `npm run e2e -- --only perf-budget` | ❌ Wave 0 |
| 누설 | `world` 프레임 키 허용 목록(seat·숫자뿐), 로비 밖 프레임 0 | worker | `npx vitest run test/worker/leak.test.ts` | ✅ 확장 |

### Sampling Rate
- **Per task commit:** 해당 순수 모듈 테스트(1~3초) + `npm run typecheck`(tokens:check 포함).
- **Per wave merge:** `npx vitest run` 전체 + `node --test scripts/*.test.mjs scripts/e2e/lib.test.mjs`.
- **Phase gate:** 전체 green + 로컬 `npm run e2e -- --url http://localhost:5173` + 실기기 게이트 기록 + `minifia-v2` 배포본 `smoke --prod` 후 `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `test/unit/map.test.ts`, `world.test.ts`, `camera.test.ts`, `status.test.ts` — 순수 모듈(TDD 먼저)
- [ ] `test/worker/world.test.ts` — move/세그먼트/디바운스/퇴거 복원/hello 순서/로비 밖 무시; `leak.test.ts` 월드 프레임 항목 확장
- [ ] `test/client/worldStage.test.tsx` — 가짜 `MapRenderer` 주입(기존 `createSocket` 주입 패턴과 동일)
- [ ] `scripts/deploy-target.mjs`, `check-deploy-target.mjs`, `deploy-target.test.mjs`
- [ ] E2E 흐름 신규(`world`, `reconnect`, `perf-budget`) + `lobbyFlow` 재작성 (Pitfall 9)
- [ ] `src/debug/perf/` HUD·시나리오(시드 고정)·결과 카드 — 지표 계산 순수 함수(`avgFps`, `jank`, `percentile`, 하트비트 판정)는 단위 테스트
- [ ] 의존성: `npm install --save-exact three@0.186.1` / `-D @types/three@0.186.0` (체크포인트 뒤)
- [ ] 소규모 스모크: "새 렌더러로 기존 씬 재사용 시 재업로드" (A9) — 헤드리스에서 `loseContext` 후 재생성 경로를 실제로 돌려 본다

## Security Domain

(`security_enforcement` 켜짐, ASVS 수준 1)

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | 기존 | 토큰 hello(변경 없음). 새 인증 면 없음 |
| V3 Session Management | 기존 | 소켓 첨부 `playerId` 만 신원. `move` 메시지에 seat/id 없음 |
| V4 Access Control | yes | 이동 권한은 서버가 단계로 판정(`phase==="lobby"`), 본인 캐릭터만 이동 |
| V5 Input Validation | yes | zod `strictObject({t:"move", x:int, z:int})` + 범위·`snapToWalkable` 서버 보정. 클라이언트 값 불신 |
| V6 Cryptography | no | 새 암호 사용 없음 |
| V13 API / 서비스 | yes | 연결당 20/s 한도(기존 `RATE_MAX_MESSAGES`) + 이동 150ms 간격 조용한 버림 |
| V14 Configuration | yes | 배포 대상 가드, `preview_urls:false` 유지, CDN 로드 금지(번들 고정), 의존성 정확 고정+lockfile |

### Known Threat Patterns for {Cloudflare Worker + DO + three.js 클라이언트}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 클라이언트가 조작된 좌표·속도를 보냄(순간이동/가속) | Tampering | 서버 상수 속도, 서버 A*, 좌표는 목적지뿐, 범위·막힘 보정 |
| `move` 폭주 | DoS | 연결당 20/s + 150ms 버림, 경로 계산은 576셀 A* 라 요청당 비용 작음 |
| 타인 위치 위조 | Spoofing | 신원은 소켓 첨부 playerId 만 |
| 로비 밖 월드 정보 노출(게임 중 위치 누설) | Information Disclosure | `emitWorld` 가 로비에서만 전송, `leak.test` 확장, 프레임에 seat·숫자 외 키 없음 |
| 닉네임을 통한 DOM 주입 | Tampering/XSS | React 텍스트·`aria-label`·`title` 로만 렌더(이름표도 DOM 텍스트, 캔버스에 글자 없음) |
| 무인증 쓰기 엔드포인트(성능 결과 수집) 추가 | Tampering/DoS | **만들지 않는다**(스크린샷+문서 기록) |
| 잘못된 배포 대상(v1 덮어쓰기)/잘못된 계정 | Tampering | `check-account` + `check-deploy-target` + v1 거부 테스트 |
| 공급망(새 npm 패키지) | Tampering | 정확 고정, 무결성 해시 대조 체크포인트, devDependency 전이 의존성 OK 판정 |
| `?perf=1`/`?chat-mock=1` 디버그 면 | Information Disclosure | 화면 로컬 계측만, 네트워크 전송 없음, 제품 흐름과 분리된 지연 청크 |

## Sources

### Primary (HIGH confidence)
- 이 저장소(이 세션에서 직접 열람): `worker/room.ts`, `worker/index.ts`, `shared/protocol.ts`, `shared/schemas.ts`, `shared/game/room.ts`, `src/net/{useRoomConnection,linkReducer,clock,assets}.ts`, `src/screens/{Lobby,RoomScreen}.tsx`, `src/main.tsx`, `wrangler.jsonc`, `package.json`, `scripts/*`, `dist/worker/wrangler.json`, `.wrangler/deploy/config.json`, `docs/setup.md`, `docs/decisions/0042·0043·0044·0046`, `.planning/{ROADMAP,REQUIREMENTS,DEFERRED-BUGS}.md`, `06-UI-SPEC.md`, `.planning/research/{SUMMARY,ARCHITECTURE,PITFALLS}.md`, `.planning/milestones/v1.0-phases/01-walking-skeleton/{01-REVIEW,01-REVIEW-DISPOSITION}.md`
- `design/v2.0/backgrounds/minifia-bg-concepts.html` (카메라·조명·시간대·가구 좌표·`pawnR`), `design/v2.0/characters/*.dc.html` (폴리곤·그룹 수)
- three@0.186.1 소스(npm 패키지, scratch 설치): `WebGLRenderer.js`, `webgl/WebGLShadowMap.js`, `core/Clock.js`, `examples/jsm/utils/BufferGeometryUtils.js`
- npm registry: `three`, `@types/three`, 전이 의존성 (`npm view`), `gsd-tools query package-legitimacy check`
- 실행 확인: `npx vitest run`(117 파일 3,094 통과), 최소 장면 Vite 빌드 크기, 헤드리스 Chrome WebGL/`WEBGL_lose_context` 프로브, 시안 렌더 통계(M3), `tsc` + `@types/three`, `check-account`, v1 `/api/health`
- Cloudflare 공식 문서: durable-object-lifecycle, legacy-kv-storage-api, pricing (WebFetch)

### Secondary (MEDIUM confidence)
- MDN: VisualViewport, Performance.memory (WebFetch)
- three.js 포럼 공식 안내: r155 조명 변경 (discourse.threejs.org/t/updates-to-lighting-in-three-js-r155/53733)
- caniuse/MDN 호환성: `interactive-widget` (검색 결과)
- Chrome 개발자 가이드 ime-safe-enter-submit, WebKit bug 165004, 215745

### Tertiary (LOW confidence)
- iOS WebGL 컨텍스트 소실 포럼·버그 트래커(three.js 포럼, WebKit 289601) — 현재 상태 미확인
- 카카오톡 인앱 브라우저 엔진·디버깅 가능 여부 — 근거 없음(A1)
- Microsoft Edge WebView 디버깅 문서(일반 원리)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 버전·크기·타입 호환·legitimacy 직접 확인. 단 최신판 SUS 라 사용자 체크포인트 필요
- Architecture: MEDIUM-HIGH — 서버·저장·프로토콜은 기존 구조를 읽고 정함. 렌더 방식 결정은 스파이크 확정 대기
- Pitfalls: MEDIUM — 코드로 확인된 항목(HIGH)과 플랫폼 보고(LOW)가 섞임
- 실기기 성능·iOS 복구·카카오톡: LOW — 이 환경에서 측정 불가, 계획이 사람 측정 단계를 포함해야 함

**Research date:** 2026-10-31
**Valid until:** 2026-11-30 (three 월간 릴리스 주기·Safari/WebKit 동작은 빠르게 바뀜 — 스파이크 시점에 three 최신판·iOS 버전을 기록)
