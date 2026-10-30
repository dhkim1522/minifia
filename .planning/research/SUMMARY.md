# Project Research Summary

**Project:** minifia — 마일스톤 v2.0 "같은 공간"
**Domain:** 모바일 웹 실시간 소셜 추리(마피아) 게임에 공유 맵 이동·자유 채팅·동작 캐릭터를 얹기
**Researched:** 2026-10-30
**Confidence:** MEDIUM-HIGH (코드·번들·요금은 HIGH, 실기기 성능·iOS 소리/키보드·경쟁작 세부는 MEDIUM~LOW)

상세 근거는 같은 폴더의 STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md 를 본다. 범위의 기준은 `docs/decisions/0044-v2-same-space.md` 이고, 연구는 이 결정을 뒤집지 않는다. 결정과 어긋나는 제안은 아래 "열린 질문"에 따로 모았다.

## 한 줄 판정: three.js vs 2D

**three.js 는 쓰지 않는다. React DOM + CSS transform 위에 자체 SVG 파츠 리그(약 200줄)를 얹는 2D 로 간다. v2.0 에 새로 추가하는 런타임 npm 의존성은 0개다.**

| 근거 | 내용 |
|---|---|
| 요구가 3D 를 쓰지 않는다 | 카메라는 평행 이동만, 캐릭터는 정면 + 좌우 반전. 회전 카메라·3D 조명·입체 충돌이 없어 3D 의 장점이 쓰이지 않는다 |
| 번들 | 현재 앱 JS 가 gzip 약 108KB. three 최소 +136KB, R3F +248KB, glTF 로더·`.glb` 까지 더하면 수백 KB~1MB. 링크 하나로 들어오는 게임에서 첫 로드 예산을 직접 깎는다. DOM 리그는 +5~10KB |
| 에셋 제작이 병목 | 파츠 분리형 의상 3D 는 같은 스켈레톤에 스키닝된 메시를 따로 모델링해야 하고, AI 3D 생성은 대개 한 덩어리 메시라 파츠 교체에 못 쓴다. 목 긋기·손사래 같은 코믹 이모트는 Mixamo 에 없어 Blender 수작업이다. 솔로 개발자가 가장 약한 구간이다. SVG + JSON 키프레임은 AI 가 직접 쓰고 고칠 수 있다 |
| 승인된 아트와 도구를 버린다 | 둥근 머리·점 눈·면 색 스타일(`ASSET_SPEC.md`)과 DOM 기반 E2E·`screen-map.md` 를 다시 만들어야 한다 |
| 모바일 위험 | iOS 백그라운드 시 WebGL 컨텍스트 소실, 6~10분 발열·배터리, 카카오톡 인앱 브라우저. 재접속이 핵심인 이 게임에 불리하다 |
| 약관 | Mixamo `.glb` 를 브라우저로 내려보내는 것은 재배포 금지 조항과 충돌할 수 있다(원문 미확인, LOW) |

3D 가 이기는 조건은 회전 카메라·실시간 3D 조명이 게임의 핵심이 되는 경우뿐이다. 결정 0008 의 이유(화면 구조 변경, 로딩 부담)가 v2.0 에서도 유효하다.

**탈출구(스파이크가 실패할 때만):** 렌더러만 Pixi 8.22 + `@pixi/react` 8.0.5 로 교체(+169KB gzip). 리그 데이터 `RigPose`(파츠별 x, y, rot, sx, sy, opacity)를 경계로 두어 샘플러·서버 이동·테스트는 그대로 쓴다. 메시 변형이 필요하다는 판정이 나면 Spine(Professional $379) 또는 Rive(canvas-lite, 월 $9)를 그 위에 얹는다. Phaser 와 DragonBones, Lottie 는 제외한다.

**스파이크는 필수 게이트다.** DOM 이 중저가 Android 에서 5분 평균 55fps 이상인지(캐릭터 8명 × 파츠 약 11개, 걷기 + 동작 2개), 맵 카메라 이동이 끊기지 않는지, Safari 의 SVG 파츠 회전 품질, Playwright `page.clock` 으로 포즈 스트립이 결정적으로 찍히는지를 실기기에서 잰다. 이 수치는 MEDIUM 이라 지금은 "DOM 확정"이 아니라 "DOM 을 먼저 검증"이다.

## Executive Summary

v2.0 은 v1.0 의 규칙 진행기를 "같은 공간에 함께 있는 느낌"으로 옮기는 마일스톤이다. 구스구스덕·Among Us·Town of Salem 같은 선례는 이동, 텍스트 채팅, 이모트, 유언·쪽지를 이미 검증했다. 다만 이 게임은 음성이 없고 4~8명이 5~10분에 끝내며, 서버가 받는 사람별로 걸러 보내는 원칙(ADR-0002)이 위치·채팅·동작·유령·밤으로 넓어진다. 그래서 기능의 우선순위는 "재미있는가"보다 "새 정보 통로가 정체를 새게 하지 않는가"가 먼저다.

권장 접근은 세 가지다. 첫째, 위치는 스트림이 아니라 **탭 목적지만 보내고 서버가 경로·속도를 정해 구간 하나로 방송**하며 모두가 같은 `positionAt(seg, serverNow)` 순수 함수로 그린다. 서버 틱 루프가 없어 Durable Object 가 하이버네이션을 유지하고, 속도 조작이 불가능하며, 메시지가 사람당 초당 1개 이하다. 둘째, 권위 상태(`state` 뷰)와 휘발 상태(위치·입력 중·동작·채팅)를 두 길로 나누고, **모든 휘발 전송이 `audience.ts` 한 함수를 통과**하게 하며 무차별 `broadcastEvent` 는 삭제한다. 셋째, 렌더링은 DOM 2D 리그로 하고 규칙 코드와 분리한다.

가장 큰 위험은 (1) 밤·유령 정보 누출(내용뿐 아니라 타이밍·소리·재접속 스냅샷·캐시), (2) 위치를 `RoomState`/`persistAndBroadcast` 에 태우는 설계 실수, (3) 한 마일스톤에 모든 것을 넣어 "한 판이 끝까지 도는 시점"이 늦어지는 범위 확장, (4) iOS 에서만 터지는 키보드·IME·소리, (5) `wrangler.jsonc` 의 `name` 을 바꾸기 전에 배포해 v1.0 을 덮어쓰는 사고다. 완화책은 첫 페이즈에서 Worker 분리와 가드, `audience` 단일 경로, 메타모픽 누출 테스트, 꾸밈 층(실제 아트·소리·시상식)을 뒤로 미룬 얇은 세로 슬라이스 순서다.

## Key Findings

### Recommended Stack

기존 스택(React 19.3.1, TypeScript 7.0.2, Vite 8.3.5, Workers + Durable Objects, zod 4.6.7, vitest, playwright-core 1.64.1, sharp 0.35.5, Capacitor 예정)에 **새 런타임 의존성을 더하지 않는다.** 새로 만드는 것은 모두 우리 코드다. 상세는 STACK.md.

**Core technologies:**
- React DOM + CSS transform (기존): 맵 월드 레이어·카메라·이름표·말풍선. 한글 텍스트와 접근성, 테스트가 공짜
- `src/rig/` 자체 리그 런타임: 파츠 트리 + `samplePose(rig, clip, t)` 순수 함수 + DOM 렌더러. 슬롯·피벗은 `rig.json` 한 곳. 프레임마다 React 상태를 갱신하지 않고 ref + 단일 rAF 로 `style.transform` 만 쓴다
- SVG 파츠 에셋: 기존 `design/characters/source` 흐름 그대로. 정면 + 좌우 반전 한 뷰만 만들고 걷기는 절차적 사인파
- `shared/movement.ts` + `shared/nav.ts`: 목적지 → 그리드 A*(직접 구현 약 80줄) → 시각 기준 위치. 서버·브라우저 공용, vitest unit
- `src/audio/` Web Audio 직접 래퍼: `AudioContext` 하나, `GainNode` 3개(master/bgm/sfx), AAC(`.m4a`) 또는 MP3. Howler 2.2.4 는 2023-09 이후 릴리스가 없고 iOS 26 열린 이슈가 있어 제외
- 채팅 문자열: 새 라이브러리 없음. 서버에서 NFC 정규화 → 제어·방향 제어 문자 제거 → `Intl.Segmenter` 자소 단위 상한 → 결합 문자 축소. `dangerouslySetInnerHTML` 금지 린트, 자동 링크 변환 없음

**제외:** three.js/R3F/drei, Phaser 4.2.1, Howler, DragonBones, Lottie, DOMPurify, 위치 20Hz 스트림·서버 틱, 맵 위 움직이는 요소의 `filter`/`backdrop-filter`/`mix-blend-mode`(Safari 비용).

### Expected Features

상세는 FEATURES.md. 비교 대상은 Among Us, 구스구스덕, Town of Salem, 마피아42, Gather, Fall Guys 이모트.

**Must have (table stakes):**
- 로비·낮에 터치로 걷기 + 카메라 추적 + 이동 금지 단계 자동 집결, 닉네임 항상 표시, 캐릭터끼리 충돌 없음(앞뒤는 y 로 정렬)
- 자유 채팅(낮 전체/밤 마피아/탈락자 채널) + 서버 도배 제한 + 입력 중 "…"
- 동작(이모트) 목록 + 재사용 대기(이동하면 취소), 로비 의상 갈아입기(시작 때 고정)
- 지목(가리키기) → 최후 변론 → 찬반 → 처형, 토론 일찍 끝내기(산 사람 과반)
- 밤: 마피아만 이동·암살, 시민 편은 깜깜한 화면. 아침: 분필 윤곽 + 쪽지 + 유언 + "누군가 살아났습니다"
- 유령 산책·유령 채팅, 방장 이양·이탈자 정리, 같은 멤버로 다시 하기, 소리(배경음·밤/처형·동작·끄기)

**Should have (differentiators):**
- 입력 중 "…" 가 떴다 사라지는 순간(내용 없이 고정), 머리 위 말풍선(최근 1줄 4~5초)
- 가리키기 연출, 찬반 결과를 엄지로 동시 공개, 변론 확대, 암살은 대상을 눌러 자동 접근
- 익명 마피아 쪽지(40자 안팎, 수정 불가), 유언, 분필 윤곽, 끝난 뒤 마피아 밤·유령 채팅 공개, 시상식 칭호

**Defer (v2.x 이후):** 투표형 칭호, 유령 전용 동작, 신고·차단·필터, 햅틱(앱 전환 때), 의상 해금·수집, 영매·기자 등 새 역할.

**하지 않는 것(Anti-features):** 근접 채팅, 플레이어 충돌, 가상 조이스틱, 상대에게 가는/수락형 동작, 유령↔산 사람 상호작용, 게임 중 의상 변경, 시체 신고형 즉시 회의, 과제·미니게임, 채팅 서식·링크·이미지, 위치 연동 심장 소리.

### Architecture Approach

상세는 ARCHITECTURE.md. 권위 길(`room` 키 즉시 저장 → `buildView` 방송)과 휘발 길(메모리 `World`·`ChatLog` → `audience` 필터 → 이벤트 프레임, 저장은 2초 지연)을 분리한다. 위치 구간은 `world` 키로 지연 저장하고 생성자 `blockConcurrencyWhile` 에서 복원해 하이버네이션을 견딘다. 판정(근접 암살)은 서버 메모리 `World` 를 직접 읽고 클라이언트 좌표는 믿지 않는다.

**Major components:**
1. `shared/game/map.ts`·`world.ts` — 맵 상수, `Segment`, `positionAt`, `findPath`, `applyMove`, 집결·흩어짐(시각은 인자, 멱등 "표준 배치" 함수)
2. `shared/game/audience.ts` — 단계×신분(`town`/`mafia`/`ghost`) 표에서 받는 사람을 한 곳에서 계산. `visibleSubjects` ↔ `worldAudience` 가 서로 역이어야 하며 속성 테스트로 고정. Room 의 모든 휘발 전송은 `emit(kind, payload, audience)` 하나
3. `shared/game/chat.ts`·`emotes.ts`·`accuse.ts`·`awards.ts`·`rematch.ts`·`host.ts` — 순수 규칙. 채널은 서버가 보낸 사람 상태로 결정
4. 단계 표 `PHASE_DEFS` 에 `world`·`chat` 정책 열 추가, `claim`/`candidateVote`/`candidateVoteReveal` 삭제, `accuse` 추가, `execVote` 를 변론 뒤 찬반으로 재배치
5. 클라이언트 `useWorld`(React 밖 가변 스토어, rAF 보간, 서버 시계 `offset`) + `MapStage` + `ChatDock`
6. 방장 부재는 `hostAwayAt` + `nextWakeAt` 항목 추가(알람은 DO 당 하나라 min 으로 묶음)

**v1 코드와의 접점에서 먼저 알아야 할 함정:** `enterExecVote` 가 `verdict` 를 지우므로 v2 흐름(지목 후 찬반)에서는 후보가 날아간다. 지우는 시점을 `discussion` 진입으로 옮긴다. `parseServerMessage` 는 모르는 `t` 를 조용히 버리므로 새 프레임 종류를 반드시 추가한다.

### Critical Pitfalls

상세는 PITFALLS.md (Pitfall 1~16, A~H).

1. **위치를 스트림으로 설계해 `persistAndBroadcast` 에 태운다** — 목적지 + 서버 구간 방식, 위치는 `RoomState` 에 넣지 않고 별도 `world` 프레임. 틱 루프 금지
2. **밤·유령 누출(타이밍·크기·소리·재접속 스냅샷·캐시 포함)** — 시민용 밤 상태에는 위치 필드 자체가 없다. 재접속 첫 스냅샷도 같은 뷰 함수. 긴장 연출 소리는 서버 이벤트와 무관한 클라이언트 로컬 대본. **메타모픽 누출 테스트**(마피아가 움직일 때/가만히 있을 때 시민 소켓 프레임 열이 같아야 함)를 밤 페이즈 완료 조건에 넣는다. `leak.test.ts` 허용 경로를 "초록 만들려고" 넓히는 것이 가장 위험한 지름길
3. **자유 채팅을 템플릿 채팅 가정 위에 올린다** — 채널은 서버가 결정, `phaseSeq` 불일치면 넓은 채널로 폴백하지 말고 폐기, 종류별 토큰 버킷, 채팅 기록은 `RoomState` 와 분리
4. **iOS 에서만 터지는 입력·소리** — 한글 IME 는 `<form onSubmit>`(Enter keydown 금지), 키보드는 `visualViewport` + 고정 캔버스 + 카메라 오프셋, 소리는 재접속 경로에도 "소리 켜기" 배너. 카카오톡 인앱 브라우저를 필수 실기기 대상으로
5. **배포 혼동으로 v1.0 덮어쓰기** — `wrangler.jsonc`·`prod-url.txt`·e2e/smoke/gallery 기본 주소·`check-account.mjs` 를 같은 커밋에서 바꾸고 첫 배포 전에 `npm run deploy` 가드를 둔다
6. **범위 확장으로 "한 판이 끝까지 도는 시점"이 늦어진다** — 사각형/자리표시 캐릭터로 낮·밤 한 판을 먼저 완주시키고 실제 아트·소리·시상식을 얹는다. 페이즈마다 팀 플레이 확인 1회, 동작·의상 개수 상한 명시

## 열린 규칙 질문 (통합 목록)

세 문서에 흩어진 질문을 한 곳에 모았다. 요구사항 정의 단계에서 확정하고, 팀 테스트로 조정할 값은 시작값으로 둔다. **[결정 충돌]** 표시는 0044 의 문구와 연구 권장이 다른 항목이라 사용자 확인이 필요하다.

| # | 질문 | 연구 권장 | 비고 |
|---|---|---|---|
| 1 | **[결정 충돌] 밤 시작 위치.** 0044-4 는 "시민 캐릭터는 낮이 끝난 자리에 있다". 낮이 가운데 집결로 끝나면 마피아가 한 걸음에 암살한다 | 처형 뒤 밤 진입 때 전원을 집결 전 위치 또는 서버가 정한 흩어진 자리로 되돌린다(`disperse`) | 0044-4 의 "낮이 끝난 자리"를 "토론이 끝난 위치(집결 전)"로 해석하면 충돌이 없다. 해석을 확정해야 한다 |
| 2 | **아침 위치 초기화.** 밤이 끝난 뒤 마피아가 시체 옆에 서 있으면 낮 위치로 정체가 샌다 | 산 사람 전원을 낮 시작 대형으로 옮기고 분필 윤곽만 사망 지점에 남긴다 | FEATURES 가 "중요"로 표시. 0044 에 명시 없음 |
| 3 | **마피아 둘일 때 암살 확정.** 한 밤에 한 명만 죽는다 | 선착순(먼저 성공한 암살이 대상 확정, 밤 타이머는 끝까지 대기) 또는 마피아 채팅 합의 대상 하나에만 암살 가능 | 어느 쪽이 재미있는지는 플레이테스트 필요. 시작값은 선착순 |
| 4 | **[결정 충돌] 유언은 누가 쓰나.** 0044-4 는 "시민은 유언을 쓴다". 시민만 쓰면 "유언 없음"이 곧 경찰·의사라는 단서가 된다 | 역할 무관 전원이 언제든 편집하는 저장 초안으로 두고 죽을 때 그 초안을 공개(ToS 방식). 쓰는 동안 어떤 프레임도 나가지 않음 | 0044 문구 보정 필요. 마피아 쪽지는 최종 대상에 투표한 사람 것 하나만, 작성자 seat 없음 |
| 5 | **지목 최소 득표와 동률.** 1표로도 후보가 되나 | 최다 1명이면 후보, 동률·0표는 처형 없이 밤(v1 규칙 계승). 자기 지목 불가, 마감까지 변경 가능 | 팀 테스트 후 조정 |
| 6 | **[결정 충돌] 아침 길이.** 0044-13 의 8초에 사망자 공개·유언(최대 80~120자)·쪽지(40자)·"살아났습니다"를 읽기 어렵다 | 12~15초로 시작하거나 유언·쪽지 길이에 맞춰 서버가 정한다. 공개된 유언·쪽지는 낮 채팅 로그에 시스템 카드로 남긴다 | 0044-13 은 "팀 테스트 뒤 조정"이라 8초 시작도 허용. 기본값을 8초로 둘지 확정 필요 |
| 7 | **[결정 충돌] "누군가 살아났습니다" vs v1 D-13.** 0044-5 가 v1 의 의사 구출 비공개(D-13)를 바꾼다 | 문구만 발표하고 보호받은 본인에게는 밤에 아무것도 알리지 않는다. 마피아 쪽지는 공개하지 않는다 | ARCHITECTURE 도 "v1 D-13 변경"으로 표시. 변경을 결정 기록에 남길 것 |
| 8 | **무음 스위치 정책.** iOS Web Audio 는 무음 스위치에서 막힌다 | 기본은 존중. 설정에서 "소리 켜기"를 명시적으로 누른 사람에게만 `navigator.audioSession.type='playback'`(`'audioSession' in navigator` 확인 후). 소리에 의존하지 않는 설계 | 제품 결정. iOS 18 보고가 엇갈려 실기기 확인 필요 |
| 9 | **배포 이름·URL 함정.** `wrangler.jsonc` `name` 이 아직 `minifia` | `minifia-v2` 로 바꾸고 `prod-url.txt`·e2e 기본 주소·`check-account.mjs` 를 같은 커밋에서 변경, 가드 후 첫 배포. 새 Worker 이름 = 새 DO 네임스페이스라 v1 저장 방과 섞이지 않음 | 0044-15 의 "제안"을 확정으로 올려야 한다 |
| 10 | 처형 뒤 흩어짐 (#1 과 같은 장치) | 있음 | |
| 11 | 처형·아침 단계 채팅 허용 | 허용(`chat:"all"`) | |
| 12 | 게임 중 영구 이탈(`leave`) 허용 | 허용하지 않음, 끊김은 v1 처리(서버 타이머대로 진행) | 허용하면 승패 분모에 영향 |
| 13 | 다시 하기 참여자 | "준비" 표시한 사람만 새 판 멤버, 연결 끊긴 사람은 정리. `epoch`/`round` 번호로 이전 판 메시지 거부 | 방장 이양은 유예 30~60초 후 `joinSeq` 가장 작은 연결자 |
| 14 | 채팅 공개 사전 안내 문구와 시점, 시상식 칭호 최종 목록 | 칭호는 서버가 결정론적으로, 모두가 하나 이상 받도록 예비 칭호 | 디자인 단계에서 확정 |
| 15 | 맵 크기·격자·이동 속도·이동 가능 영역 데이터 형식 | 디자인 승인 후 상수로 확정(사각형 목록 vs 마스크) | |

## Implications for Roadmap

연구자마다 임시 페이즈 번호가 달랐다(ARCHITECTURE P1~P7, PITFALLS P0~P8). 아래는 하나로 합친 **권장 빌드 순서**다. 원칙은 "추가 → 교체 → 삭제"의 교살자 순서, 자리표시 그림으로 먼저 한 판을 완주시키고 꾸밈 층을 나중에 얹기, 각 페이즈 끝에 `minifia-v2` 배포와 팀 확인 1회다. 단 프로젝트 규칙(디자인 먼저)에 따라 맵·몸체·의상·동작 디자인 승인이 화면 페이즈 앞에 오며, 에셋 제작은 코드 페이즈와 병행한다.

### Phase 1: 게이트 + 월드 뼈대 (배포 분리·이동·가시성 기반)
**Rationale:** 모든 것이 위치 구간·`audience`·휘발 길 분리에 기대고, 하이버네이션 복원은 늦게 발견될수록 비싸다. 엔진과 키보드 시안은 가장 바꾸기 비싼 결정이라 맨 앞에서 실측한다.
**Delivers:** `minifia-v2` Worker 와 배포 가드, 리그 스파이크 결과(DOM 확정 또는 Pixi 전환), 키보드 열림 채팅 시안, `map.ts`·`world.ts`·`audience.ts` 골격, `move`/`world` 프레임, hello 스냅샷, `world` 키 지연 저장·생성자 복원, 로비 맵 + 탭 이동 + 카메라, 의상 슬롯 필드(자리표시), `epoch`/`hostSeq` 와이어 계약, 소리 모듈 뼈대(참가 버튼에서 unlock), `screenToWorld`, WR-01~04 중 위치·채팅이 건드리는 경로. 시작 이후 흐름은 v1 그대로
**Addresses:** 걷기·카메라·닉네임·충돌 없음, 로비 이동
**Avoids:** Pitfall 1(위치 스트림), 3(서버 판정·시계), 8(엔진 늦은 결정), 13(v1.0 덮어쓰기), A(WR-01~04), C(저장 3층), 7(터치 제스처)
**Verification:** `world.test`(경로·보간·속도), `evictDurableObject` 후 위치 복원, 이동 간격 버림, 2~8탭 E2E, 실기기(iPhone·저가 Android·카카오톡 인앱)

### Phase 2: 자유 채팅·채널·입력 중 (+ 동작 프로토콜)
**Rationale:** 누설 행렬이 낮 흐름의 채팅 허용 범위를 고정하고, 템플릿 UI 를 지워야 낮 화면을 다시 짜기 쉽다.
**Delivers:** `chat`/`typing`/`emote` + `audience` 행렬 + `emit`, `broadcastEvent` 삭제, 채널별 `seq`, 채팅 로그(별도 키), 하단 `ChatDock`(form submit, `visualViewport`), 말풍선, 동작 ID·쿨다운 프로토콜(자리표시 애니메이션), `claim`/`say`/`emoji`/빠른 메시지 삭제와 그 테스트 동반 삭제
**Uses:** 서버 문자열 정규화 + 토큰 버킷
**Avoids:** Pitfall 4(채널 위조·위상 경계), 5(한글 IME), 6(키보드), D(동작 남발), b(안전 영역)
**Verification:** 누설 행렬 테스트(신분×단계×종류), `worldAudience`↔`visibleSubjects` 속성 테스트, 채널 위조·`phaseSeq` 경계 테스트, IME 실기기 체크표(iOS/Android/삼성/카톡)

### Phase 3: 낮 흐름 (토론 → 지목 → 변론 → 찬반 → 처형)
**Rationale:** 밤은 낮이 끝난 자리(집결·흩어짐)를 입력으로 쓰고, 처형 흐름이 먼저 돌아야 승패가 난다.
**Delivers:** 맵 위 낮 토론, `accuse`(서버 슬롯 집결 + 실시간 `point`), `defense`, `execVote`(찬반), `candidateVote*` 삭제, `enterExecVote` 의 `verdict` 이동, `skipDay`(과반), 시작값 90/15/20/10초, 고정 테이블 삭제, 봇이 이동·채팅·지목을 함
**Addresses:** 정통 처형 순서, 실시간 지목, 일찍 끝내기
**Avoids:** Pitfall 7(걸어서 모이기 실패), H(과반·알람 경쟁), 13(`skip` 금지, 단계 매트릭스 테스트 자동 생성)
**Verification:** `tick`/`vote`/`nyquist-*` 갱신, 봇 한 판 자동 완주(`scripts/bots.mjs`), 배포본 smoke

### Phase 4: 밤·아침 (v2.0 의 핵심 연출)
**Rationale:** 가장 위험한 정보 유출 구간이므로 낮 흐름이 안정된 뒤 한 묶음(이동 + 암살 + 유언 + 쪽지 + 아침 위치)으로 설계·검증한다.
**Delivers:** 마피아 이동 + `pickTarget` 근접 검사(관용 반경), 시민 편 깜깜 화면(최소 UI: 타이머 고리·은은한 문구), 경찰·의사 얼굴 목록, 유언·쪽지, 분필 윤곽, 아침 공개, "누군가 살아났습니다", 흩어짐/아침 위치 초기화, 클라이언트 난수 긴장 연출, 마피아 봇 암살
**Avoids:** Pitfall 2(밤 누출), 3(사거리), 11(결과는 마감 판정 뒤에만)
**Verification:** **메타모픽 누출 테스트**, 밤 재접속 테스트, 시민 프레임에 위치·채팅·동작·쪽지 작성자 없음, 쪽지·유언은 죽기 전 어떤 프레임에도 없음
**여기서 "한 판이 끝까지 도는 첫 지점"이 생긴다.** 이 시점에 팀 플레이 테스트를 하고 재미 가설을 확인한 뒤 꾸밈 층 투자를 결정한다.

### Phase 5: 유령
**Rationale:** 시상 통계와 끝 공개가 유령 채팅·동작 데이터를 쓴다.
**Delivers:** 사망 시 유령 전환(스냅샷 재전송, `isGhost` 단일 함수), 유령 이동·채팅·동작, 전체 관전(0021)
**Avoids:** Pitfall F(유령 가시성, 전환 시점의 한 프레임)
**Verification:** 산 사람 소켓이 유령의 위치/채팅/입력 중/동작을 한 번도 받지 않는 시나리오

### Phase 6: 캐릭터 리그·의상·동작 (실제 아트 교체)
**Rationale:** 자리표시 그림으로 한 판이 돌고 있으므로 규격이 확정된 뒤 대량 제작해도 재작업이 없다. 단 에셋 규격과 디자인 승인은 Phase 1 부터 병행해 둔다.
**Delivers:** `src/rig/` 런타임·`rig.json`·클립 JSON, SVG 파츠 의상, 동작 8~10개, 로비 의상 UI(시작 때 고정, 역할과 무관), `ASSET_SPEC.md` v2(피벗·슬롯·팔레트 변수), 에셋 검증 스크립트와 `manifest.json`(출처·약관), 포즈 스트립 디버그 페이지
**Avoids:** Pitfall 10(규격 없는 대량 생성), E(의상-역할 연결), D(동시 재생 상한)
**Verification:** 파츠 × 동작 관통 스냅샷, 크기 예산, 역할 배정과 의상 독립 테스트

### Phase 7: 끝 (공개·시상·다시 하기)
**Delivers:** `reveal` 프레임(마피아 밤·유령 채팅 공개), 통계 카운터(Phase 2~5 구현 때 훅을 같이 심어 둠), `awards`, `rematch`(`epoch`/`round`, 이탈자 정리, `expiresAt` 갱신), 클라이언트 단계 역행 처리(`usePhaseArrival`, `roomDiff`)
**Avoids:** Pitfall 12(다시 하기 경쟁 상태), d(좌석 번호 의미 변화)
**Verification:** 재대결 후 비공개 필드 잔재 없음(키 전수), 동시 클릭·늦은 메시지 테스트

### Phase 8: 안정성·소리·v1 정리
**Delivers:** 방장 부재 자동 이양(`nextWakeAt`), `passHost`, 로비 자동 제거, 소리(배경음·밤/처형·동작 효과음, 재접속 "소리 켜기" 배너, 중단 복구, 무음 정책), 남은 v1 코드·테스트 일괄 삭제(삭제 표 기반, `skip` 금지), 남은 WR 항목
**Avoids:** Pitfall 14(iOS 소리), 12(방장 깜빡임), 13(테스트 약화)

### Phase Ordering Rationale

- 의존성: 가시성 함수와 이동 시뮬레이션 → 채널 → 낮 → 밤 → 유령 → 끝. 통계 카운터는 처음부터 세어야 시상식이 쉬우므로 Phase 2~5 구현 때 훅만 같이 심는다.
- 꾸밈 층(실제 아트, 소리, 시상 칭호)을 뒤로 미루는 이유는 PITFALLS 16: 재미 가설을 한 판이 도는 Phase 4 에서 처음 확인하고, 그 전에 에셋을 대량 제작하지 않기 위해서다. 단 팀 피드백 3·4번(동작, 의상)은 Phase 2 의 프로토콜과 Phase 6 의 제작으로 반드시 해결한다.
- 삭제 정책 절충: ARCHITECTURE 는 대체와 같은 페이즈에서 삭제(`claim` 은 Phase 2, `candidateVote*` 는 Phase 3), PITFALLS 는 전용 삭제 페이즈를 권한다. 권장은 **대체 코드가 완성된 같은 페이즈에서 그 코드와 그것만 검사하던 테스트를 함께 지우고, 남는 잔재는 Phase 8 에서 일괄 점검**한다. `leak.test.ts`·`view.test.ts`·재접속·알람 테스트는 삭제 대상이 아니라 확장 대상이다.
- 소리는 Phase 8 이지만 unlock 뼈대는 Phase 1 에 심는다. 소리는 서버 이벤트에 직접 연결하지 않고(밤 누출) 낮 공개 이벤트와 로컬 대본에만 쓴다.
- 반복 규칙: 화면이 있는 페이즈는 `/gsd-plan-phase` 전에 `/gsd-ui-phase`, 완료 조건에 폰 폭 3종 실기기 확인, 모든 페이즈에 봇이 새 흐름을 수행하는 항목을 포함한다.

### Research Flags

**추가 연구가 필요한 페이즈 (`/gsd-plan-phase --research-phase`):**
- **Phase 1:** 필수. 리그 스파이크 실측(저가 Android·구형 iPhone·카카오톡 인앱), 맵 충돌 데이터 형식, WR-01~04 원인 코드, DO 출력 게이트(`put` 경로 vs 비경로 송신 지연) 측정
- **Phase 2:** iOS 키보드 + 하단 고정 채팅 + 한글 IME 실기기(WebKit 이슈 LOW~MEDIUM)
- **Phase 4:** 밤 규칙 질문(#1~#4, #7) 확정, 메타모픽 테스트 설계. 선례가 약한 "물리적 암살 + 어둠"
- **Phase 6:** SVG 파츠 규격과 Safari 래스터 품질, 필요하면 sharp WebP 굽기, 코믹 동작 키프레임 품질 판정(메시 변형 필요 여부)
- **Phase 8:** iOS 소리(무음 스위치, `interrupted` 복구, `audioSession`), 소리 에셋 출처·상업 이용 약관

**표준 패턴이라 연구 생략 가능:**
- **Phase 3:** v1 의 `vote.ts`·단계 표 재사용, 변경 지점이 ARCHITECTURE 에 특정되어 있음
- **Phase 5:** `audience` 표 확장과 `isGhost` 단일 함수, 선례(Among Us) 확인됨
- **Phase 7:** 순수 함수 `rematch.ts`·`awards.ts`, v1 `testReset` 길 일반화

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | 버전·번들 크기는 npm 레지스트리와 직접 빌드로 측정(HIGH). 모바일 실기기 fps·발열, iOS 소리 동작은 문서·커뮤니티 근거(MEDIUM). Rive/Spine 가격은 공식 페이지 기준, Spine Essential 의 skin 합성 지원 여부와 Mixamo 약관 원문은 미확인(LOW) |
| Features | MEDIUM | Among Us 유령 규칙·ToS 유언/Death Note 는 팬 위키로 확인(MEDIUM). 구스구스덕 이모트 목록, 마피아42 세부, Fall Guys 이모트 방식, Gather 충돌은 사전 지식(LOW~MEDIUM). 도배 수치·칭호는 설계 판단 |
| Architecture | HIGH | v1 코드를 직접 읽고 통합점을 파일 단위로 짚음. Cloudflare 한도·요금은 공식 문서. 이동 주기·수치와 출력 게이트 동작은 설계 제안/MEDIUM이라 측정 필요 |
| Pitfalls | MEDIUM | 저장소 코드 기반 항목은 HIGH. iOS 키보드·IME·소리·WebGL 은 웹 검색(LOW~MEDIUM), 카카오톡 인앱 동작은 일반 지식(LOW) |

**Overall confidence:** MEDIUM-HIGH. 방향(2D DOM, 목적지 + 서버 구간, `audience` 단일 경로)은 세 문서가 독립적으로 같은 결론에 닿았다. 불확실성은 방향이 아니라 수치와 실기기 동작에 있다.

### Gaps to Address

- **DOM 리그 실기기 성능 (MEDIUM):** Phase 1 스파이크의 통과 기준을 미리 쓴다. 통과 기준은 저가 Android 5분 평균 55fps 이상, 메모리 경고·발열 없음, 로비 상호작용 3초 이내. 미달 시 렌더러만 Pixi 로 교체
- **iOS 소리 무음 스위치 (LOW~MEDIUM):** 실기기 확인 전에는 소리에 의존하는 기능 설계 금지. 정책은 열린 질문 #8
- **카카오톡 인앱 브라우저 동작 (LOW):** Wake Lock·`audioSession`·키보드·백그라운드 종료를 Phase 1 첫 배포 직후부터 체크표에 넣는다
- **WR-01~04 내용:** `DEFERRED-BUGS.md` 에 내용이 없다. Phase 1 시작 때 `useRoomConnection`/`linkReducer`/`worker/room.ts` 연결 처리 코드를 열어 확인
- **동작 품질 한계:** 관절 회전 + 스케일 찌그러짐 + 이징만으로 코믹함이 충분한지는 디자인 승인 단계에서 판단. 반려되면 Spine/Rive 경로
- **소리 에셋 상업 이용 약관:** CC0(Kenney 등)나 AI 생성 도구별로 에셋마다 `manifest.json` 에 기록(출시 마일스톤에서 한 번에 확인)
- **게임 중 영구 이탈, 시상 칭호 최종 목록, 맵 상수:** 열린 질문 #12, #14, #15
- **Cloudflare 요금 추정:** 목적지 방식에서 한 판 수십~수백 요청이라는 추정은 규칙 기반이다. 팀 테스트 후 실측

## Sources

### Primary (HIGH confidence)
- 저장소 코드: `worker/room.ts`, `shared/protocol.ts`, `shared/schemas.ts`, `shared/game/*.ts`, `src/net/useRoomConnection.ts`, `test/worker/leak.test.ts`, `wrangler.jsonc`, `public/_headers`, `scripts/e2e/run.mjs` — 통합점과 함정
- `docs/decisions/0044-v2-same-space.md`, `docs/architecture.md`, `.planning/PROJECT.md` — 범위와 제약
- npm 레지스트리 직접 조회(2026-10-30)와 `esbuild --bundle --minify` + `gzip -9` 로 직접 측정한 번들 크기 — 후보 라이브러리 버전·크기
- Cloudflare Durable Objects 공식 문서(WebSockets 모범 사례, 한도, 요금) — 하이버네이션 조건, 첨부 16KB, 수신 WebSocket 20:1 과금, 객체당 초당 1000 요청

### Secondary (MEDIUM confidence)
- Rive 가격·데이터 바인딩 문서, Spine 구매 페이지 — 탈출구 비용
- Among Us 유령 규칙(팬 위키), Town of Salem 유언·Death Note 위키 — 유령 채널, 유언·쪽지 공개 방식
- MDN AudioSession(experimental) — `playback` 타입
- Howler GitHub 열린 이슈(iOS 26) — 개별 재현은 미검증

### Tertiary (LOW confidence — 실기기로 검증 필요)
- WebKit Bugzilla 및 커뮤니티 글: iOS 키보드 `visualViewport`, 무음 스위치, WebGL 컨텍스트 소실, Safari IME 이벤트 순서
- 구스구스덕 이모트·마피아42·Fall Guys·Gather 세부, 모바일 탭 이동 플레이테스트 일화
- Mixamo 약관 요약(Adobe 포럼 인용), 카카오톡 인앱 브라우저 구체 동작

---
*Research completed: 2026-10-30*
*Ready for roadmap: yes*
