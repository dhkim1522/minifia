# Stack Research

**Domain:** 모바일 웹 소셜 추리 게임 — 걸어 다니는 공유 맵, 파츠 교체 캐릭터 리그, 자유 채팅, 사운드 (v2.0 "같은 공간" 추가분만)
**Researched:** 2026-10-30
**Confidence:** MEDIUM-HIGH (버전·번들 크기는 npm 레지스트리와 직접 빌드로 측정해 HIGH. 모바일 실기기 성능과 iOS 소리 동작은 문서·커뮤니티 근거라 MEDIUM이며 1페이즈 스파이크로 확정해야 한다)

기존 스택(React 19.3.1, TypeScript 7.0.2, Vite 8.3.5, Workers + Durable Objects, zod 4.6.7, vitest 4.1.12, playwright-core 1.64.1, sharp 0.35.5, Capacitor 예정)은 다시 조사하지 않았다.

---

## 결론 (한 줄)

**three.js 는 쓰지 않는다. 렌더링은 지금처럼 React DOM 위에서 한다 — 맵은 CSS transform 으로 움직이는 레이어, 캐릭터는 SVG 파츠를 쌓은 DOM 리그이고, 애니메이션은 우리가 쓰는 작은 순수 함수 샘플러(약 200줄)로 돌린다. v2.0 에 새로 추가하는 런타임 npm 의존성은 0개다.** 소리는 Howler.js 대신 Web Audio 직접 래퍼, 위치 동기화는 "목적지 + 서버 계산 경로" 메시지로 기존 WebSocket 위에서 처리한다.

이 선택이 실패할 때의 탈출구(Pixi + Spine 또는 Rive)와 갈아타는 조건을 아래 "탈출구" 절에 적었다. 렌더러가 바뀌어도 리그 데이터(`RigPose`)는 그대로 쓰도록 설계하는 것이 핵심이다.

---

## Recommended Stack

### Core Technologies (v2.0 에서 새로 정하는 것)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| React DOM + CSS transform (기존) | React 19.3.1 | 맵 월드 레이어, 카메라, 캐릭터, 이름표·말풍선·"…" 표시 | 기존 화면·토큰·E2E 도구를 그대로 쓴다. 이름표, 채팅 말풍선, 지목 화살표, 한글 텍스트가 모두 DOM 이라 선명하고 접근성·테스트가 공짜다. 번들 증가 0KB |
| 자체 리그 런타임 `src/rig/` (신규, 의존성 없음) | — | 파츠 트리 + 포즈 샘플러(`samplePose(clip, t)`) + DOM 렌더러 | 순수 함수라 vitest unit(Node)에서 검증된다. AI 가 키프레임 JSON 을 쓰고 Playwright 로 포즈 스트립을 찍어 눈으로 확인하며 고칠 수 있다. 라이선스·에디터·외부 도구 의존이 없다. 렌더러만 바꿔 끼울 수 있게 `RigPose`(파츠별 x, y, rot, sx, sy, opacity)를 경계로 둔다 |
| SVG 파츠 에셋 (신규, 산출물) | — | 머리·의상·소품 파츠, 맵 레이어 | 기존 `design/characters/source/ghost_svg` 흐름 그대로 디자인 캔버스에서 SVG 로 만든다. 면 색 위주 스타일이라 SVG 가 작고(파츠당 수 KB) 어떤 DPR 에서도 선명하다. 필요하면 이미 devDependency 인 sharp 로 WebP 로 구워 쓴다 |
| 서버 권위 이동 `shared/movement.ts` (신규, 의존성 없음) | — | 목적지 → 경로(그리드 A*) → 시각 기준 위치 계산 | 서버와 브라우저가 같은 순수 함수를 쓴다(`shared/` 규칙에 맞음). 틱 루프가 필요 없고 Durable Object Hibernation 과 충돌하지 않는다 |
| Web Audio API 직접 래퍼 `src/audio/` (신규, 의존성 없음) | 브라우저 내장 | BGM 루프, 효과음, iOS 잠금 해제 | Howler 2.2.4 는 2023-09 이후 npm 릴리스가 없고 iOS 26 관련 열린 이슈가 있다(아래 소리 절). 우리가 필요한 기능은 BGM 1개 + 효과음 수십 개 + 볼륨 3단이라 래퍼가 작다 |

### Supporting Libraries

v2.0 에서 추가를 권하는 런타임 라이브러리는 없다. 아래는 "필요해지면 쓸 것"과 그 조건이다.

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pixi.js | 8.22.0 (2026-10-27) | WebGL 2D 렌더러 | 스파이크에서 DOM 리그가 중저가 Android 에서 55fps 미만이거나, 파티클·셰이더 연출(손전등 원뿔 등)이 필요해질 때만. 최소 import 기준 gzip 169KB |
| @pixi/react | 8.0.5 | Pixi 의 React 바인딩 | pixi 로 갈아탈 때만. peer: react >=19, pixi.js ^8.2.6 으로 현재 React 19.3.1 과 호환 |
| @esotericsoftware/spine-pixi-v8 | 4.3.13 | Spine 런타임 | pixi 로 가고 전문 애니메이터급 품질(메시 변형)이 필요할 때만. peer: pixi.js ^8.16.0. 에디터 라이선스 필요 |
| @rive-app/canvas-lite | 2.49.0 | Rive 런타임 | 동작(이모트) 레이어만 별도 도구로 만들고 싶을 때. wasm 이 gzip 339KB(풀 버전 891KB)라 가입 후 지연 로드 전제 |
| zzfx | 1.4.0 | 코드로 만드는 레트로 효과음 | 소리 에셋이 준비되기 전 임시 효과음. 분위기(무거움)와 안 맞으면 쓰지 않는다 |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Playwright `page.clock` (playwright-core 1.64.1 에 포함) | rAF·시간을 고정해 포즈·이동을 결정적으로 캡처 | 동작 프레임 스트립(contact sheet)을 PNG 로 찍어 AI 가 눈으로 보고 키프레임을 고치는 루프를 만든다. 별도 설치 없음 |
| `src/debug/` 리그 미리보기 페이지 | 파츠·의상·동작을 단독으로 재생 | 기존 `sheetDebug` 패턴을 따른다. 프로덕션 번들에서는 동적 import 로 분리 |
| sharp 0.35.5 (기존) | SVG 파츠 → WebP 래스터 | 스파이크에서 Safari 의 SVG 래스터 비용이 문제로 나오면 `scripts/` 에 굽기 스크립트를 추가한다(`make-backdrops.mjs` 선례) |

## Installation

```bash
# v2.0 필수 추가 의존성: 없음.

# 탈출구 A (렌더러만 교체) — 스파이크가 실패한 경우에만
npm install pixi.js@8.22.0 @pixi/react@8.0.5

# 탈출구 B (Spine 품질 필요) — 위에 더해서
npm install @esotericsoftware/spine-pixi-v8@4.3.13

# 탈출구 C (Rive, 이모트만) — pixi 없이 단독 사용 가능
npm install @rive-app/canvas-lite@2.49.0
```

---

## 핵심 평가 1: three.js(3D/2.5D) vs 2D

### 번들 크기 (직접 측정)

`esbuild --bundle --minify` 후 `gzip -9`. 비교 기준은 현재 앱 메인 JS 가 gzip 약 108KB(`dist/client/assets/index-*.js`)라는 점이다.

| 구성 | 추가 JS (gzip) | 추가 에셋 | 첫 로드 영향 |
|------|---------------|-----------|--------------|
| DOM 리그 (권장) | 약 5~10KB (자체 코드) | SVG 파츠 수 KB × N | 거의 없음 |
| three 0.186.1 최소 (WebGLRenderer, OrthographicCamera, AnimationMixer 등) | 136KB | — | 앱 JS 가 2.3배 |
| three + GLTFLoader + SkeletonUtils | 158KB | `.glb` 캐릭터 + 의상 + 클립 (Draco 쓰면 디코더 wasm 추가) | 수백 KB~1MB+ 추가 |
| @react-three/fiber 9.8.2 (three 포함) | 248KB | 위와 동일 | 앱 JS 가 3.3배 |
| pixi.js 8.22.0 최소 import | 169KB | 텍스처 | 앱 JS 가 2.6배 |
| pixi.js 전체 import | 261KB | — | — |
| pixi + spine-pixi-v8 4.3.13 | 226KB | `.skel`/`.atlas`/PNG | — |
| phaser 4.2.1 | 360KB | — | 앱 JS 가 4.3배 |
| @rive-app/canvas 2.49.0 | JS 88KB + wasm 891KB | `.riv` | 합계 약 1MB gzip |
| @rive-app/canvas-lite 2.49.0 | wasm 339KB + JS | `.riv` | 합계 약 400KB gzip |
| howler 2.2.4 | 9KB | — | — |

"링크 하나로 바로 들어오는" 게임이므로 첫 로드 예산이 중요하다. 지금 앱은 코드 약 108KB + 배경·캐릭터 이미지 2MB 안팎인데, 3D 나 Pixi 는 코드만으로 그 절반 이상을 더 얹는다.

### 항목별 평가

| 기준 | three.js / R3F (저폴리 3D, 직교 카메라) | DOM + SVG 리그 (권장) | Pixi v8 + 자체 리그/Spine/Rive |
|------|----------------------------------------|----------------------|-------------------------------|
| 모바일 프레임 (4~8명) | 8개 스킨드 메시 자체는 최근 폰에서 충분. 문제는 프레임이 아니라 iOS 백그라운드 시 WebGL 컨텍스트 소실 복구, 셰이더 컴파일 끊김, 6~10분 플레이 동안의 발열·배터리 | 파츠 약 90개에 transform 만 갱신. 합성 레이어 수와 메모리만 주의(MEDIUM, 스파이크 필요) | 가장 여유 있음. 다만 WebGL 컨텍스트 소실 처리가 필요 |
| 첫 로드 | 최악. 위 표 참조 | 최상 | 중간 |
| 솔로 개발자의 에셋 제작 | 최악. 아래 설명 | 최상. AI 가 SVG·JSON 으로 직접 만든다 | Pixi + 자체 리그는 동일. Spine/Rive 는 사람이 에디터를 조작해야 함 |
| 의상·파츠 교체 | 가능(같은 스켈레톤을 쓰는 분리 메시). 모델링 부담이 큼 | 파츠 이미지 교체. 가장 쉽다 | 텍스처 교체. Spine 은 skin 합성(`Skin.addSkin`) |
| React 연동 | R3F 가 있으나 Canvas 안은 별도 세계. UI 오버레이와 좌표 변환이 필요 | 네이티브 | `@pixi/react` 8.0.5 가능하나 Canvas 안은 별도 세계 |
| Playwright 테스트 | WebGL 스크린샷만 가능. 헤드리스 SwiftShader 로 느리고 불안정 | DOM 쿼리·`getBoundingClientRect`·`page.clock` 모두 가능 | 캔버스 안은 읽을 수 없어 디버그 훅 필요 |
| Capacitor 래핑 | WKWebView 에서 동작하나 WebGL 메모리·컨텍스트 소실 위험이 따라감 | 문제 없음 | 위와 동일 |
| 기존 자산 재사용 | 8종 + 16종 2D 캐릭터와 승인된 디자인 시스템을 버리고 다시 만든다 | 그대로 이어감 | 그대로 이어감 |

### three.js 를 쓰지 않는 이유 (결정 0008 재검토)

0008 이 든 이유("모든 화면 구조를 바꾼다, 로딩 부담")는 v2.0 에서도 대부분 유효하다. v2.0 의 요구가 3D 를 정당화하는지 따져 봤다.

1. **요구가 3D 를 요구하지 않는다.** 걸어 다니는 맵은 2.5D 탑다운이지만, 캐릭터가 정면 + 좌우 반전으로 걷고 카메라는 평행 이동만 한다. 회전 카메라, 실시간 3D 조명, 입체 충돌이 없다. 3D 의 장점이 쓰이지 않는다.
2. **에셋 제작이 병목이고 AI 도구가 약한 곳이다.** 파츠 분리형 의상을 입는 3D 캐릭터는 같은 스켈레톤에 스키닝된 머리·몸·소품 메시를 따로 모델링하고 웨이트를 칠해야 한다. AI 3D 생성 도구는 대개 하나로 붙은 메시를 내놓아 파츠 교체에 쓸 수 없다. "목 긋기", "손사래", "울기", "악수(혼자 하는 버전)" 같은 코믹 이모트는 Mixamo 에 없거나 어색해서 Blender 에서 직접 키프레임을 쳐야 한다. 솔로 개발자가 가장 못 하는 작업이다.
3. **Mixamo 약관 위험.** 커뮤니티가 인용하는 FAQ 는 캐릭터·애니메이션의 상업적 사용을 허용하지만 원본 파일의 재배포를 금지한다고 한다(공식 원문은 확인하지 못함, LOW). 웹 게임은 `.glb` 를 사용자 브라우저로 내려보내므로 회색 지대다. 정식 출시 마일스톤에서 법적 불확실성이 된다.
4. **승인된 아트 방향을 버린다.** 둥근 큰 머리, 점 눈, 윤곽선 없는 면 색 스타일(`design/characters/ASSET_SPEC.md`)은 2D 에서 가장 잘 산다. 3D 로 옮기면 툰 셰이딩·외곽선 패스를 다시 설계해야 한다.
5. **테스트 도구가 무력해진다.** 현재 E2E 와 화면 영역 지도(`docs/screen-map.md`)는 DOM 기반이다.

3D 가 이기는 조건은 "회전하는 카메라와 실시간 3D 조명이 게임의 핵심이 되는 경우"뿐이다. 지금 v2.0 은 해당하지 않는다.

---

## 핵심 평가 2: 2D 렌더 계층과 2D 스켈레탈 런타임

### 렌더 계층: DOM vs Canvas2D vs Pixi vs Phaser

| 선택 | 판정 | 이유 |
|------|------|------|
| **React DOM + CSS transform (권장)** | 채택 | 4~8 캐릭터는 스프라이트 수가 매우 적다. UI(이름표, 말풍선, 입력 중 "…", 지목선)가 많은 소셜 게임이라 DOM 이 오히려 단순하다. 카메라는 월드 컨테이너의 `translate3d`, 깊이 정렬은 y 값으로 `z-index` |
| 평범한 `<canvas>` 2D | 보류 | 번들은 0이지만 텍스트·접근성·테스트를 직접 다 만들어야 한다. 파티클이 필요한 시상식 색종이 정도에만 보조로 쓴다 |
| Pixi v8 | 탈출구 | 성능 여유는 크지만 +169KB, WebGL 컨텍스트 소실, 한글 텍스트 처리, 캔버스 내부 테스트 불가가 비용이다. 필요가 생기면 렌더러만 교체 |
| Phaser 4.2.1 | 제외 | gzip 360KB, 자체 게임 루프·씬·입력이 React 와 맞지 않고 DOM UI 가 없다. 이 게임은 "게임 엔진"이 필요한 게임이 아니다 |

한계도 적는다. DOM 은 수백 개의 입자, 셰이더 연출, 동적 조명에는 맞지 않는다. 밤 연출은 미리 구운 방사형 그라디언트 PNG 를 `transform` 으로 옮기는 방식(마피아 시야)과 검은 `div`(시민 편 암전)로 충분하다고 본다. `mix-blend-mode` 와 큰 `filter`·`backdrop-filter` 는 Safari 에서 비싸므로 맵 위에서 움직이는 요소에 쓰지 않는다. 유령은 CSS `filter` 가 아니라 이미 있는 ghost 스프라이트나 미리 만든 반투명 파츠를 쓴다.

### 2D 스켈레탈 런타임 비교

| 선택 | 비용·크기 | 파츠 교체 | 누가 만드나 | 판정 |
|------|-----------|-----------|-------------|------|
| **자체 리그 (권장)** | 코드 약 200줄, 라이선스 없음 | 파츠 이미지 교체가 곧 의상 교체 | AI 가 JSON 키프레임, 사람은 미리보기로 승인 | 채택 |
| Rive (`@rive-app/canvas` 2.49.0) | wasm 2.2MB(gzip 891KB), lite 판 gzip 339KB. 런타임 MIT. 에디터 무료 플랜은 프로젝트 1개·파일 3개이고 내보낸 `.riv` 에 Rive 스플래시가 붙는다. Cadet 은 월 $9(스플래시 제거) | ViewModel 이미지 속성 + `rive.decodeImage()` 로 런타임 교체 가능. 단 에디터에서 속성을 미리 노출해야 함 | 사람이 에디터에서 직접 애니메이션 제작 | 탈출구 C |
| Spine (`spine-pixi-v8` 4.3.13) | Essential $69(메시·IK 없음), Professional $379, 영구 라이선스, 연 매출 $50만 초과 시 Enterprise. 에디터 구매 필요 | skin 합성으로 의상 교체. 가장 성숙 | 사람이 에디터에서 제작 | 탈출구 B |
| DragonBones (`dragonbones-pixijs` 1.0.5) | 무료이나 사실상 방치(마지막 릴리스 2025-05, 에디터 지원 종료 추세) | 가능 | 사람 | 제외 |
| Lottie (`lottie-web` 5.13.0, `@lottiefiles/dotlottie-react` 0.21.0) | 가벼움 | 런타임 파츠 교체가 어렵고 이동 + 동작 합성에 맞지 않음. 래스터 이미지 교체는 JSON 에셋 편집 필요 | After Effects 필요 | 제외 |

**자체 리그를 고르는 가장 큰 이유는 "누가 만드느냐"다.** Rive 와 Spine 은 사람이 시각 에디터에서 한 프레임씩 만들어야 하고, 그 결과물(`.riv`, `.skel`)은 AI 가 읽고 고칠 수 없는 이진/전용 포맷이다. 반면 우리 리그는 텍스트(JSON)와 SVG 라서 이 프로젝트의 작업 방식(AI 가 만들고 사람이 승인, 캔버스 → `design/` 사본 → 코드)과 정확히 맞는다. 코믹한 동작(목 긋기, 손사래, 박수, 울기, 악수 흉내)은 관절 회전 + 스케일 찌그러짐 + 이징으로 충분히 표현된다. 메시 변형(살 늘어남)이 없다는 점이 품질 한계이고, 이 한계가 실제로 문제인지는 디자인 승인 단계에서 판단한다.

### 리그 설계 지침 (STACK 수준의 결정만)

- **정면 + 좌우 반전 하나의 뷰**만 만든다. 4방향 아트는 만들지 않는다. 걷기는 몸통 상하 흔들림 + 다리·팔 위상 회전(절차적 사인파)이고 별도 클립 에셋이 필요 없다.
- 파츠 슬롯 예: `legs`, `torso/outfit`, `arm(상완·전완 × 좌우)`, `head-base`, `hair/hat`, `prop`. 의상 = 슬롯별 SVG 세트 + 팔레트 변수. 슬롯 이름과 피벗은 `rig.json` 한 곳에서만 정의한다.
- 포즈 샘플러는 `samplePose(rig, clip, t): RigPose` 순수 함수. 구동은 `requestAnimationFrame` 하나(움직이는 것이 있을 때만 돌림), 파츠에는 `style.transform` 만 쓴다. React 상태로 프레임마다 렌더하지 않는다.
- 동작 목록은 `shared/` 에 ID 와 (서버가 알아야 하는) 길이만 두고, 키프레임 데이터는 `src/rig/` 에 둔다. 서버는 "서 있을 때만 실행 가능", "동작 쿨다운" 같은 규칙만 검증한다.
- `useReducedMotion`(기존 훅)을 따른다.

---

## 위치 동기화 (기존 DO WebSocket, 새 인프라 없음)

**권장: 위치를 스트리밍하지 말고 "목적지"만 보낸다. 서버가 경로를 만들고, 모두가 같은 시각 기준으로 보간한다.**

| 항목 | 설계 |
|------|------|
| 클라이언트 → 서버 | `{ t: 'move', x, y }` (맵 좌표를 정수로 양자화). 탭할 때만, 초당 5회 이하로 제한. 현재 단계가 이동 허용인지는 서버가 판단 |
| 서버 처리 | zod 로 범위 검증 → 이동 가능 셀인지 확인 → `shared/` 의 그리드 A* 로 경로 계산 → 플레이어마다 `{ waypoints, t0(서버 ms), speed }` 구간 저장 |
| 서버 → 클라이언트 | 구간 하나를 받는 사람별로 걸러 전송. 밤에 마피아 이동은 마피아와 유령에게만(`docs 0044` 14항), 유령 이동은 산 사람에게 보내지 않는다 |
| 클라이언트 렌더 | 기존 `src/net/clock.ts` 의 서버 시계 오프셋으로 `positionAt(segment, serverNow)` 를 계산해 다각선을 따라 이동. 도착하면 정지 |
| 서버의 위치 사용 | 암살 거리 판정 등은 `positionAt(player, now)` 를 그 순간 계산한다. 틱 루프나 알람 불필요 |
| 지목 집결·변론 정지 | 서버가 모든 플레이어에게 슬롯 좌표로의 이동 구간을 한꺼번에 발급한다. 같은 메커니즘이라 별도 코드가 없다 |
| 재접속 | 스냅샷에 현재 구간이 들어 있어 이어서 그린다 |
| 입력 중 표시 | `{ t: 'typing', on }`을 채널 구성원에게만 중계. 클라이언트 TTL(약 4초)로 만료시켜 서버 타이머가 없다. 한글 IME 조합 중에도 `input` 이벤트가 오므로 조합 이벤트에 별도로 기대지 않는다 |

**이유:**
- 탭 이동은 본질적으로 이산 이벤트다. 20Hz 위치 스트림은 방당 초당 수백 메시지를 만들고, Cloudflare 문서가 경고하는 "작은 메시지 다수가 Durable Object 를 압도" 상황과 Hibernation 불가 상태를 일부러 만드는 일이다.
- 요금 면에서도 이득이다. 수신 WebSocket 메시지는 20:1 로 요청에 합산되고(발신은 무료), 무료 플랜은 하루 10만 요청이다. 탭 이동은 사람당 몇 초에 한 번이라 한 판이 수십~수백 요청 수준이다(확인된 요금 규칙 기준의 추정).
- 모두가 같은 곡선을 보므로 지연이 달라도 화면이 어긋나지 않는다. 서버가 판정 위치의 유일한 기준이라 클라이언트 조작으로 순간이동할 수 없다(ADR-0002 원칙).
- 길찾기는 직접 쓴다. `easystarjs` 0.4.4(2022), `pathfinding` 0.4.18(2022), `navmesh` 2.3.1(2022)은 모두 3~4년 정체돼 있고, 8명 × 작은 격자에서 A* 는 약 80줄이다. `shared/` 에 두면 서버·클라이언트가 같은 코드를 쓰고 vitest unit 으로 시험한다.
- 캐릭터끼리의 충돌은 두지 않는다(겹쳐 지나감). 복잡도 대비 가치가 없다.

**하지 않는 것:** WebRTC, 별도 실시간 서비스(PartyKit·Realtime 등), 클라이언트 예측 후 서버 교정(movement 가 서버 확정 구간이라 불필요).

---

## 소리

**권장: 의존성 없이 Web Audio 직접 래퍼.**

| 항목 | 결정 |
|------|------|
| 라이브러리 | 사용 안 함. Howler.js 2.2.4 는 마지막 npm 릴리스가 2023-09-19 이고, GitHub 열린 이슈에 iOS 26 "소리 안 남"(#1767), "Howler.volume 이 iOS 26 에서 효과 없음"(#1774), 화면 잠금 후 mute 해제 실패(#1674), 오디오 컨텍스트 중단(#1702) 등이 있다. 래퍼 크기 차이(9KB)는 이유가 아니다. 유지보수 상태와 iOS 대응이 이유다 |
| Tone.js 15.1.22 | 합성·시퀀서가 필요 없다. 제외 |
| 구조 | `AudioContext` 하나, `GainNode` 3개(master, bgm, sfx). 효과음은 `AudioBufferSourceNode`(필요하면 `detune` 로 약간의 변주), BGM 은 짧은 루프(30초 안팎 스테레오, 디코딩 메모리 약 10MB 이하)를 `loop = true` 로 재생하고 단계 전환은 게인 램프로 크로스페이드 |
| 포맷 | AAC(`.m4a`) 또는 MP3. 모든 대상 브라우저가 디코딩한다. Opus/Ogg 는 쓰지 않는다 |
| iOS 잠금 해제 | 방 참가·방 만들기 버튼의 `pointerdown`/`touchend` 안에서 `ctx.resume()` + 무음 버퍼 1회 재생(기존 설계서의 "참가 버튼에서 오디오를 깨운다"와 일치). 이후 버퍼 디코딩은 지연 로드 |
| 중단 복구 | iOS 는 `ctx.state` 가 `"interrupted"` 가 될 수 있다. `visibilitychange`/`pageshow` 에서 상태를 보고 사용자 제스처 안에서 `resume()`을 다시 시도한다. 기존 재접속 흐름(`useRoomConnection`, `useWakeLock`)과 같은 자리에서 다룬다 |
| 무음 스위치 | 기본은 **존중**한다. iOS 의 Web Audio 는 무음 스위치에서 소리가 막히는 것이 역사적 동작이고, `navigator.audioSession.type = 'playback'`(iOS 17+, MDN 상 experimental, `'audioSession' in navigator` 확인 후 사용)은 이를 우회한다. 점심시간에 공공장소에서 하는 게임이라 사용자의 무음 의사를 기본으로 뒤집지 않고, 설정에서 "소리 켜기"를 명시적으로 누른 사람에게만 `playback` 을 적용하는 안을 제안한다. 제품 결정이므로 로드맵 단계에서 확정 |
| 앱 전환 | Capacitor 에서는 같은 Web Audio 코드가 동작하되 오디오 세션 카테고리는 네이티브에서 다시 정한다(앱 전환 마일스톤) |
| 임시 효과음 | 에셋 확보 전에는 `zzfx` 1.4.0 로 대체 가능. 최종 에셋은 CC0 라이브러리(Kenney 등)나 AI 생성 도구를 쓰되 **도구별 상업 이용 약관을 에셋마다 기록**한다(미확인, 로드맵 조사 항목) |

---

## 채팅 문자열 처리

**권장: 새 라이브러리 없음(DOMPurify 3.4.17 도 불필요).**

- 채팅은 HTML 이 아니라 **문자열**이다. React 가 텍스트 노드로 렌더하므로 이스케이프된다. `dangerouslySetInnerHTML` 을 금지하는 린트 규칙 하나가 방어의 대부분이다. 자동 링크 변환은 하지 않는다(피싱 방지, 구현 단순).
- 서버(`shared/` 의 zod 스키마 + Room DO)에서:
  - `z.string()` → NFC 정규화(맥/모바일의 분해형 한글 자모 정리) → 제어 문자(`\p{Cc}`)와 방향 제어 문자(U+202A–202E, U+2066–2069) 제거 → 길이를 `Intl.Segmenter` 로 센 자소 단위(grapheme) 상한(예: 100) → 연속 결합 문자(`\p{M}{3,}`) 축소(Zalgo 방지)
  - 플레이어별 토큰 버킷 속도 제한(예: 10초에 5개)
  - 채널 규칙(낮 전체, 밤 마피아, 탈락자)은 보낼 때 서버가 수신자를 걸러 전송. 게임 끝 공개용 기록은 서버가 메모리·스토리지에 상한을 두고 보관
- 욕설 필터·신고·차단은 범위 밖(0044, 정식 출시 마일스톤).
- 입력 UI 주의: iOS Safari 는 `interactive-widget` 메타를 지원하지 않아 하단 고정 채팅창이 키보드에 가려질 수 있다. `visualViewport` 리스너로 위치를 보정해야 한다(페이즈 조사 필요, MEDIUM).

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| DOM + 자체 SVG 리그 | Pixi 8.22 + `@pixi/react` 8.0.5 + 자체 리그 | 스파이크에서 중저가 Android 55fps 미만, 또는 파티클·조명 셰이더가 요구될 때. 리그 데이터는 그대로 재사용 |
| DOM + 자체 SVG 리그 | Pixi + Spine 4.3.13 | 디자인 승인에서 "관절 회전만으로는 퀄리티 부족, 메시 변형 필요" 판정이 났고 $379(Professional) 지출과 에디터 작업 시간을 감수할 때 |
| DOM + 자체 SVG 리그 | Rive canvas-lite | 동작 애니메이션을 사람이 에디터에서 직접 만들고 싶고(비주얼 도구 선호) 지연 로드되는 gzip 약 340KB wasm 과 월 $9 를 감수할 때 |
| DOM + 자체 SVG 리그 | three.js + glTF | 카메라 회전·실시간 3D 조명이 핵심 기능으로 바뀔 때만. 현재 요구에서는 해당 없음 |
| Web Audio 직접 래퍼 | Howler 2.2.4 | iOS 26 이슈가 해결돼 유지보수가 재개되고, 오디오 스프라이트 같은 기능이 필요할 때 |
| 직접 쓴 A* | easystarjs 0.4.4 | 장애물 지형이 매우 복잡해져 직접 구현이 부담될 때(단 2022년 이후 정체) |
| 목적지 + 서버 계산 경로 | 20Hz 위치 스트림 | 충돌·물리·실시간 조작(방향키 이동)이 필요한 게임으로 바뀔 때 |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| three.js / R3F / drei | 번들 +136~248KB, 에셋 제작 병목, 약관·아트 방향·테스트 문제(위 평가) | DOM 리그 |
| Phaser 4.2.1 | 번들 gzip 360KB, 자체 루프·입력, DOM UI 없음 | React DOM |
| Howler.js 2.2.4 | 3년째 릴리스 없음, iOS 26 열린 이슈 | `src/audio/` Web Audio 래퍼 |
| DragonBones | 사실상 방치 | 자체 리그 |
| Lottie | 파츠 교체·합성에 부적합 | 자체 리그 |
| Mixamo `.glb` 를 웹 에셋으로 배포 | 원본 재배포 금지 조항과의 충돌 가능성(LOW, 원문 미확인) | 직접 제작한 SVG 파츠 + JSON 키프레임 |
| DOMPurify, 마크다운 렌더러 | 채팅에 HTML 이 없다 | React 텍스트 렌더 + 서버 문자열 정리 |
| 프레임마다 React 상태 갱신 | 8명 × 60fps 리렌더로 폰이 느려진다 | ref + 단일 rAF 루프로 `style.transform` 직접 쓰기 |
| 맵 위 움직이는 요소의 `filter`·`backdrop-filter`·`mix-blend-mode` | Safari 에서 재래스터·합성 비용이 크다 | 미리 구운 이미지·불투명도·transform |
| `position` 서버 틱 루프, 위치 20Hz 스트림 | Hibernation 방해, 메시지 과다 | 목적지 + 구간 방식 |

## Stack Patterns by Variant

**스파이크 통과(권장 경로): DOM 리그**
- `src/world/`(맵·카메라·월드 루프), `src/rig/`(샘플러·렌더러·`rig.json`·`clips/*.json`), `shared/movement.ts`, `shared/nav.ts`(그리드 A*), `src/audio/`
- 이유: 새 의존성 없이 현재 도구 체인과 테스트 문화(순수 함수 → unit)를 그대로 쓴다.

**스파이크가 55fps 미만이거나 파티클·조명이 필요해지면: Pixi 렌더러만 교체**
- `RigPose` 경계 아래의 렌더러를 `PixiRigRenderer` 로 바꾼다. 이름표·말풍선은 DOM 오버레이로 남긴다.
- 이유: 샘플러·서버 이동·테스트는 변하지 않는다.

**동작 품질이 승인에서 반려되면: Spine(Pixi 위) 또는 Rive(단독)**
- 위치·채팅·동기화는 그대로, 캐릭터 뷰 컴포넌트만 교체한다.

**스파이크 체크리스트 (1페이즈 첫 작업, 1~2일):**
1. 캐릭터 8명 × 파츠 약 11개, 걷기 + 동작 2개 동시 재생을 실제 기기에서 측정: 구형 iPhone(SE 2세대 급)과 중저가 Android(Galaxy A 계열 급)에서 5분간 평균 55fps 이상, 메모리 경고·발열 없음.
2. 맵 배경 약 1.5~2 화면 크기 WebP 의 카메라 이동이 끊기지 않는지.
3. Safari 의 SVG `<img>` 파츠 래스터 품질(회전 시 흐려짐)과 비용. 문제가 있으면 sharp 로 WebP 를 굽는다.
4. Playwright `page.clock` 으로 포즈 스트립이 결정적으로 찍히는지.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| @pixi/react@8.0.5 | react >=19, pixi.js ^8.2.6 | 현재 React 19.3.1 과 호환. 탈출구 A 에서만 사용 |
| @esotericsoftware/spine-pixi-v8@4.3.13 | pixi.js ^8.16.0 | 에디터와 런타임의 minor 버전(4.3)을 맞춰야 한다 |
| @react-three/fiber@9.8.2 | react >=19 <19.4 | 사용하지 않지만 호환 범위 확인용. React 19.4 가 나오면 막힘 |
| @rive-app/canvas@2.49.0, @rive-app/canvas-lite@2.49.0 | 프레임워크 무관 | canvas-lite 는 Rive Text·Layout·Scripting·Audio 를 쓰지 않는 파일용 |
| playwright-core@1.64.1 | `page.clock` | 기존 시스템 Chrome 방식 그대로 사용 |
| Cloudflare Workers Free | SQLite 기반 DO 만 생성 가능, 하루 10만 요청, 수신 WebSocket 20:1 | 목적지 방식에서는 한도에 거의 닿지 않음 |

## 로드맵에 넘기는 연구 플래그

| 주제 | 필요한 추가 조사 |
|------|-----------------|
| 리그 스파이크 (렌더링 성능) | 필수. 실기기 측정 결과로 DOM 확정 또는 Pixi 전환 |
| iOS 소리 | 실기기에서 무음 스위치, `interrupted` 복구, `audioSession` 동작 확인 |
| 채팅 입력 UI | iOS 키보드와 하단 고정 입력창, 한글 IME |
| 소리 에셋 출처 | 도구별 상업 이용 약관 기록 |
| 맵 충돌 데이터 | 디자인 승인된 맵에서 이동 가능 영역을 어떻게 정의할지(사각형 목록 vs 마스크) |
| 에셋 제작 | SVG 파츠 규격(`ASSET_SPEC.md` 의 v2 판: 피벗, 슬롯, 팔레트 변수) |

## Sources

- npm 레지스트리 직접 조회(2026-10-30): pixi.js 8.22.0, @pixi/react 8.0.5, three 0.186.1, @react-three/fiber 9.8.2, @react-three/drei 10.7.9, phaser 4.2.1, @rive-app/canvas(-lite) 2.49.0, @rive-app/react-canvas 4.38.0, @esotericsoftware/spine-pixi-v8 4.3.13, dragonbones-pixijs 1.0.5, lottie-web 5.13.0, @lottiefiles/dotlottie-react 0.21.0, howler 2.2.4, tone 15.1.22, zzfx 1.4.0, dompurify 3.4.17, easystarjs 0.4.4, @capacitor/core 8.6.0 — HIGH
- 번들 크기: 임시 디렉토리에서 위 패키지를 설치해 `esbuild --bundle --minify` + `gzip -9` 로 직접 측정, Rive wasm 은 파일을 직접 gzip — HIGH (트리셰이킹 import 범위에 따라 달라질 수 있음)
- 현재 앱 번들: `dist/client/assets/index-*.js` gzip 약 108KB — HIGH
- https://rive.app/pricing — 무료 플랜 한도, Cadet $9, 스플래시, MIT 런타임, 로열티 없음 (공식, MEDIUM)
- https://rive.app/docs/runtimes/web/data-binding.md — 이미지 속성 런타임 교체 API (공식, MEDIUM)
- https://rive.app/docs/runtimes/web/web-js.md — 패키지 종류(webgl2, canvas, canvas-lite) (공식, MEDIUM)
- https://esotericsoftware.com/spine-purchase — Essential $69 / Professional $379, 매출 $50만 기준, Essential 의 메시·IK 제외 (공식, MEDIUM). Spine skin 합성의 Essential 지원 여부는 확인하지 못함(LOW) — 구매 전 체험판으로 확인
- https://developers.cloudflare.com/durable-objects/platform/pricing/ — 수신 WebSocket 20:1, 무료 플랜 한도, 무료 플랜은 SQLite DO 만, Hibernation 과 duration 과금 (공식, MEDIUM-HIGH)
- https://developers.cloudflare.com/durable-objects/best-practices/websockets/ — 작은 메시지 다수 경고, 50~100ms 배치 권고, serializeAttachment 16KB (공식, MEDIUM-HIGH)
- https://github.com/goldfire/howler.js/issues — iOS 26 관련 열린 이슈 목록 (MEDIUM, 개별 재현 여부는 미검증)
- https://developer.mozilla.org/en-US/docs/Web/API/AudioSession — audioSession 은 experimental, `playback` 타입 (MEDIUM). 무음 스위치와의 관계는 WebKit Bugzilla 237322 및 커뮤니티 글 기반이라 LOW-MEDIUM, 실기기 검증 필요
- Mixamo 약관: Adobe 커뮤니티 포럼이 인용한 FAQ 요약(원문 미확인) — LOW
- 프로젝트 문서: `docs/architecture.md`, `docs/decisions/0044-v2-same-space.md`, `docs/decisions/0008-2-5d-look.md`, `design/characters/ASSET_SPEC.md`, `src/net/clock.ts`

---
*Stack research for: 모바일 웹 소셜 추리 게임 v2.0 "같은 공간"*
*Researched: 2026-10-30*
