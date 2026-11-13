---
phase: 20-map-expansion
plan: "06"
subsystem: world-runtime
tags: [map, town, door-fade, nametag-veil, tap-target, runtime, e2e-hook, tdd]
status: complete

requires:
  - phase: 20-map-expansion
    provides: "20-02 — store.takeDoor / 20-05 — __mfTown 훅·townOpen 입력(구역·열린 방)·cutawayOf / 20-01 — TOWN_OBSTACLES·TOWN_ROOMS·TOWN_HOUSES"
provides:
  - "런타임 문 연출: DOOR_FADE_MS 200, takeDoor 를 읽어 사라짐·나타남·zone snap 을 0.2초 불투명도로(크기·높이 변화 없음), 태그 data-door"
  - "src/world/cutaway.ts — headVeiled(x, z, open)·tapTarget(ray, me, open)·V3·Ray"
  - "WorldRenderer 선택 메서드 rayAt?(sx, sy) (threeRenderer 구현)"
  - "런타임: 남의 이름표 벽 뒤 숨김(data-veiled)·건물 누르기 → 목적지, __mfTown.door·veiled 채움"
affects: [20-08, 20-09, 20-10]

actuals:
  tokens: 13300
  tasks: 2
  commits: 4

plan_head_before: 832e42acf6ad27c7b3bfba5c9009f0090b3c3a15
plan_head_after: 5146f33a30a6620f0635887ebbe0d1e465b880e5
commits: 4

tech-stack:
  added: []
  patterns:
    - "문 연출은 입·퇴장 연출과 따로 Actor.door 한 필드로 둔다: 불투명도 하나가 몸(setOpacity)·이름표 알파·핀 조명 판정(vis < 0.5)에 곱해진다. 구간이 없어진 좌석을 퇴장시키는 판정은 문 사라짐 중이면 건너뛴다"
    - "벽 뒤 숨김과 건물 누르기는 three 없는 순수 모듈(cutaway.ts)의 슬랩 시험이고, 마스크를 만든 시험(test/helpers/mapRaster rayHitsAnalytic)과 모든 격자 칸·열린 방 다섯 경우로 대조해 같은 판정임을 고정했다"
    - "건물 누르기 광선은 렌더러가 준다(rayAt, groundAt 과 같은 카메라 입력). 맞는 건물이 없으면 호출한 쪽이 바닥 교점으로 간다"

key-files:
  created: []
  modified:
    - src/world/cutaway.ts
    - src/world/runtime.ts
    - src/world/renderer.ts
    - src/world/threeRenderer.ts
    - test/unit/cutaway.test.ts
    - test/client/worldStage.test.tsx

key-decisions:
  - "문 사라짐은 서버가 보낸 마지막 점(문턱)에서 그 자리 그대로 옅어진다 — UI-SPEC F 의 '문 중심 바깥 0.5' 로 몸을 옮기지 않는다(서버는 문턱 너머 좌표를 보내지 않는다)"
  - "술집·진료소는 문이 카메라 반대쪽이라 'UI-SPEC G 의 문 안 바닥 누르기' 를 할 수 없다 — 문 앞에 선 채(front 에서 1.0 안) 그 방을 다시 누르면 방 안 자리로 들어간다. 두 번 눌러 들어가는 규칙은 같다"
  - "렌더러 rayAt 은 camera.ts screenRay 가 아니라 three 의 ray.setFromCamera(groundAt 과 같은 입력)로 구현했다 — 확대·오프셋·목표를 따로 되풀이하지 않고 groundAt 과 어긋날 수 없다"

requirements-completed: [D-11, D-15, D-19]

coverage:
  - id: D1
    description: "문 사라짐이 오면 그 사람의 몸·이름표·입력 중 칸이 지금 그려진 자리에서 불투명도만 1 → 0 으로 0.2초에 옅어진 뒤 없어지고, 나타남이 오면 0 → 1 로 나타난다. 크기·높이 변화·퇴장 커튼이 없다"
    requirement: "D-15"
    verification:
      - kind: unit
        ref: "test/client/worldStage.test.tsx#마을 문 연출 (20-06, D-15·P20-9)"
        status: pass
      - kind: e2e
        ref: "로컬 스크래치(저장소 밖): 방에서 나올 때 door appear 5건이 __mfTown.door 에 잡히고 스크린샷에 옅은 사람·이름표가 보임"
        status: pass
    human_judgment: false
  - id: D2
    description: "내가 구역을 넘으면(zone snap) 옛 구역 사람들은 제자리에서 옅어져 사라지고 새 구역 사람들은 옅게 나타난다. 재접속 snap 은 연출 없이 바로, 모션 줄이기는 모든 문 연출이 바로"
    requirement: "D-15"
    verification:
      - kind: unit
        ref: "test/client/worldStage.test.tsx#내가 구역을 넘어 받은 zone snap · 재접속 snap · 모션 줄이기면 사라짐은 같은 프레임에"
        status: pass
      - kind: e2e
        ref: "로컬 스크래치: 술집 안으로 들어가는 zone snap 에서 door vanish 5건(seat 1~5)"
        status: pass
    human_judgment: false
  - id: D3
    description: "연출 도중 반대 방향 프레임이 오면 지금 불투명도에서 새 목표로 이어간다(튀지 않음)"
    requirement: "D-15"
    verification:
      - kind: unit
        ref: "test/client/worldStage.test.tsx#옅어지는 도중 같은 좌석의 나타남이 오면 지금 불투명도에서 1 로 이어간다"
        status: pass
    human_judgment: false
  - id: D4
    description: "누가 어느 방에 있는지 알리는 새 표시가 없다 — 문 연출 중·뒤 태그 층의 자식 수 불변, 사라진 사람의 이름표는 연출이 끝나면 숨는다"
    requirement: "D-15"
    verification:
      - kind: unit
        ref: "test/client/worldStage.test.tsx#문 연출 중·뒤 어느 때도 방 안 사람 수·좌석을 알리는 새 DOM 이 생기지 않는다"
        status: pass
    human_judgment: false
  - id: D5
    description: "닫힌 방에 머리가 가려지는 칸에 선 남의 이름표·입력 중 칸·핀 조명은 0.2초에 옅어져 숨고(data-veiled) 내 이름표는 늘 보인다. 판정은 마스크와 같은 머리 광선이고 열린 방의 지붕·앞벽은 뺀다. 유령·결과(roomsOpen)는 숨김이 없다"
    requirement: "D-11"
    verification:
      - kind: unit
        ref: "test/unit/cutaway.test.ts#headVeiled (마스크와 같은 판정 대조 5×48×48) · test/client/worldStage.test.tsx#마을 벽 뒤 이름표 숨김·건물 누르기"
        status: pass
    human_judgment: false
  - id: D6
    description: "닫힌 방의 지붕·벽을 누르면 그 방 문 앞으로 걷고, 문 앞(1.0 안)에서 다시 누르면 방 안 자리로 들어간다. 집을 누르면 그 집 문 앞, 열린 방 뒷벽은 벽 바로 안쪽 바닥. 안내 글 없음"
    requirement: "D-19"
    verification:
      - kind: unit
        ref: "test/unit/cutaway.test.ts#tapTarget · test/client/worldStage.test.tsx#지붕을 지나는 광선을 주는 탭 · 문 앞…다시 누르면 · 열린 방 뒷벽"
        status: pass
      - kind: e2e
        ref: "로컬 스크래치: 술집 지붕 탭 → 링 5.75,-0.25(front), 다시 탭 → 8.25,-0.25(inside) zone pub·roofs.pub 0, 집 좌석 3 탭 → 6.25,4.75(front)"
        status: pass
    human_judgment: false
  - id: D7
    description: "이름표·입력 중 칸이 지붕·간판 판 위에 겹쳐 보이는 것은 DOM 층이라 받아들인다 — 폰 6종 겹침 판정(TM9, 20-08)이 참고 줄로 본다"
    verification:
      - kind: backstop
        ref: "20-08 마을 E2E 의 TM9 겹침 판정"
        status: deferred
    human_judgment: false
---

# Phase 20 Plan 06: 문 연출·벽 뒤 이름표·지붕/집 누르기 Summary

**서버의 문 사라짐·나타남과 내 구역 바뀜을 0.2초 불투명도 연출(크기·높이 변화 없음)로 그리고, 닫힌 방에 머리가 가려지는 남의 이름표를 같이 옅게 숨기며, 지붕·집·열린 방 뒷벽을 누르면 문 앞·방 안·집 문 앞·벽 안쪽 바닥으로 걷게 했다.**

## Performance

- Duration: 약 1시간 (시험·실브라우저 확인 포함)
- Tasks: 2 (TDD, 시험·구현 커밋 한 쌍씩)
- Commits: 4 (아래), 문서 커밋은 별도

## Accomplishments

- **문 연출**: `store.takeDoor()` 를 구간 없어진 좌석 퇴장 판정보다 먼저 읽는다. 사라짐은 마지막으로 그린 자리(문턱)에서 `DOOR_FADE_MS`(200ms) 동안 1 → 0 으로 옅어진 뒤 지워지고(커튼·크기 줄임 없음), 나타남은 몸을 0 에서 시작해 0 → 1. 불투명도는 몸(`setOpacity`, 처형 연출과 곱), 이름표 알파(안의 입력 중 칸 포함), 핀 조명 판정(0.5 미만이면 비추지 않음)에 같이 곱해진다. 연출 동안 태그 `data-door="vanish|appear"`.
- **이어가기·예외**: 사라지던 좌석에 나타남이 오거나 구간이 다시 오면 지금 값에서 1 로 이어간다. 아직 구간이 있는 좌석(탈락자 유령)의 사라짐은 무시한다. 모션 줄이기는 사라짐을 같은 프레임에 지우고 나타남은 바로 1. 재접속 snap(zone·near 없음)은 store 가 문 목록을 비워 연출이 없다.
- **벽 뒤 이름표**: `headVeiled(x, z, open)` 이 방 장애물 원문(room 키가 있는 회전 없는 상자)과 머리 꼭대기(HEAD_TOP_Y)·`TO_CAMERA` 광선의 슬랩 시험을 한다. 열린 방의 cut(지붕·앞벽)은 뺀다. 런타임은 남(내 좌석 제외, `roomsOpen` 이면 늘 false)마다 판정해 숨김 보임 정도(`veil`)를 0.2초로 따라가고 `data-veiled="true"`·`__mfTown.veiled`·핀 조명에 반영한다.
- **건물 누르기**: `tapTarget(ray, me, open)` 이 닫힌 방 몸통·집 몸통·지붕판·열린 방 뒷벽 상자 중 광선 매개변수가 가장 작은 것을 고른다. 렌더러에 선택 메서드 `rayAt` 을 더했고, 런타임 `tap` 은 방이 있는 맵이고 `rayAt` 이 있을 때만 `tapTarget` 을 먼저 본다(`walkTo` 는 그대로).
- **훅**: `__mfTown.door`(진행 중 `[{seat, kind}]`, 좌석 오름차순)·`veiled`(숨는 좌석 오름차순)를 `onTown` 상태로 채웠다.

## 탭 결과 표 (누른 곳 → 목적지, 월드 단위)

| 누른 곳 | 내 자리 | 목적지 |
|---|---|---|
| 닫힌 방의 지붕·벽·이마 | 그 방 front 에서 1.0 보다 멂 | 그 방 `front` (우체국 −0.25,−5.75 · 술집 5.75,−0.25 · 진료소 −0.25,5.75 · 경찰서 −5.75,−0.25) |
| 닫힌 방의 지붕·벽·이마 | 그 방 front 에서 1.0 안 | 그 방 `inside` (−0.25,−8.25 · 8.25,−0.25 · −0.25,8.25 · −8.25,−0.25) |
| 집 몸통·지붕판 | 어디든 | 그 집 `front` (좌석 3 → 6.25,4.75) |
| 열린 방의 뒷벽(북·서, 문 위 이마 포함) | 방 안 | 맞은 점을 바닥으로 내려 그 방 안쪽 사각형을 0.4 줄인 사각형 안으로 자른 점 |
| 열린 방의 걷힌 지붕·앞벽·바닥, 광장 바닥 | — | null → 지금처럼 `groundAt` 바닥 교점 |
| 한 광선에 방과 집이 겹침 | — | 광선 매개변수가 작은(카메라에 가까운) 쪽 |

서버가 스키마·걷기 한계·경로로 다시 정한다(T-20-21). 방 안 자리를 보내도 서버가 문을 지나는 길을 만든다.

## 검증 결과

| 명령 | 결과 |
|---|---|
| Task 1 verify (`vitest run worldStage gameMap ghostView nightMap worldStore` + typecheck) | 5 파일 · 514 통과 · 2 건너뜀 · 실패 0, typecheck 종료 0 |
| Task 2 verify (`vitest run cutaway camera worldStage gameMap` + typecheck) | 통과, 종료 0 |
| `npx vitest run --project unit --project client` | 234 파일 통과 · 1 건너뜀 / 시험 7937 통과 · 184 건너뜀 · 실패 0 |
| `npm run typecheck` | 종료 0 |
| 원격 레포 위생 git grep (바뀐 파일) | 결과 0 |

워커 시험·저장소 E2E(`npm run e2e`)는 돌리지 않았다(서버를 건드리지 않았고 마을 E2E 는 20-08).

## RED 증거

- **Task 1 RED** (`aea5c7fb`): `npx vitest run test/client/worldStage.test.tsx -t "마을 문 연출" --reporter=tap-flat` → **not ok 6**, `expected null to be 'vanish'`(런타임이 `takeDoor` 를 읽지 않아 data-door 가 없음). 처음부터 통과한 단언(모션 줄이기·재접속 snap·DOM 수 불변)은 현재 동작이 이미 같은 쪽이라 회귀 고정용이다.
- **Task 2 RED** (`4bc0ada1`): `npx vitest run test/unit/cutaway.test.ts test/client/worldStage.test.tsx --reporter=tap-flat` → **not ok 19**, `headVeiled is not a function`(cutaway 13) · `expected "vi.fn()" to be called with arguments: [ { t: 'move', x: -25, z: -575 } ]`(worldStage 6).

## Task Commits

1. `aea5c7fb` test(20-06): 문 연출 실패 시험
2. `610f8c63` feat(20-06): 문 사라짐·나타남 0.2초 연출
3. `4bc0ada1` test(20-06): 벽 뒤 이름표·건물 누르기 실패 시험
4. `5146f33a` feat(20-06): 벽 뒤 이름표 숨김·지붕/집 누르기 목적지

## 화면에서 본 것

저장소 밖 스크래치 스크립트(playwright, `scripts/e2e/browser.mjs` 도우미)로 로컬 dev(`http://localhost:5173`)에 방을 만들고 봇 5명 + 방장으로 390x844 에서 낮 토론을 열어 확인했다. 배포본은 쓰지 않았다. 헤드리스(소프트웨어 GL)라 프레임 끊김은 판단할 수 없다.

- **지붕 누르기**: 화면에 보이는 술집 지붕 점을 누르면 링이 술집 문 앞 5.75,−0.25. 도착 뒤 같은 지붕을 다시 누르면 8.25,−0.25 로 들어가 `zone pub`·`open [pub]`·`roofs.pub 0`. 집 좌석 3 몸통을 누르면 링 6.25,4.75(그 집 문 앞).
- **방에 들어갈 때·나올 때**: 들어갈 때 zone snap 으로 `door` 에 `1v … 5v`(옛 구역 5명 사라짐), 나올 때 `1a … 5a`(나타남)가 잡혔고, 나오는 순간 스크린샷에서 지붕이 덮이는 동안 광장 사람과 이름표가 반투명하게 보였다(옅어지는 중).
- **열린 방 뒷벽 누르기**: 링이 걷는 영역의 가장 북쪽 걷는 칸(바 카운터·소품이 막는 칸을 뺀 −0.75)으로 갔다 — 벽 안쪽 바닥으로 자른 점을 서버가 가장 가까운 걷는 칸으로 맞춘 결과다.
- **보지 못한 것**: 남의 이름표가 벽 뒤에서 숨는 모습은 실브라우저에서 보지 못했다(봇을 문 칸에 세울 수 없다) — 단위·컴포넌트 시험으로 고정했다. 실기기 프레임 끊김도 보지 못했다.

## Deviations from Plan (계획과 달라진 점)

### 구현이 정한 것

1. **렌더러 `rayAt` 을 `screenRay` 대신 three 의 `setFromCamera` 로** — 계획은 camera.ts `screenRay` 를 지금 목표·오프셋·확대로 부른다고 했으나 threeRenderer 의 `groundAt` 이 이미 같은 카메라로 `ray.setFromCamera` 를 쓴다. 같은 입력을 따로 되풀이하지 않고 `rayAt` 이 `groundAt` 과 어긋나지 않게 했다. 인터페이스·tapTarget 계약은 같다.
2. **문 사라짐을 서버가 보낸 문턱에서 옅어지게** — 계획이 이미 UI-SPEC F 의 "문 중심 바깥 0.5" 와 다르게 정했다. 서버는 문턱 너머 좌표를 보내지 않으므로 몸을 다른 점으로 옮기지 않는다.
3. **문 앞에서 다시 누르면 방 안** — 계획이 이미 UI-SPEC G 의 "문 안 바닥 누르기" 와 다르게 정했다(술집·진료소는 문이 카메라 반대쪽이라 문 안 바닥이 화면에 보이지 않는다).
4. **벽 뒤 숨김 판정의 `open`** — 이번 프레임이 아니라 `updateTown` 이 마지막으로 정한 열린 방 목표 집합(`townOpen`)을 쓴다. 구역이 바뀌는 프레임에서 숨김 반영이 한 프레임 늦을 수 있으나 0.2초 연출 안에서는 보이지 않는다.
5. **`data-veiled`·`__mfTown.veiled` 는 숨김 목표가 참인 좌석**(보임 정도가 0 에 닿기 전 연출 시작부터). E2E 는 시작 후 0.2초 뒤에 읽는다.
6. **새로 만들어지는 몸의 첫 숨김은 연출 없이 목표로 바로** — 이미 가려진 칸에 선 사람이 나타날 때 이름표가 깜빡이지 않게 한다.

### 시험 수정

- Task 1 의 핀 조명 시험은 RED 커밋 뒤 판별력을 높이려고(몸이 아직 있는 120~150ms 에 핀이 꺼지기 시작하는가를 보도록) 구현 커밋에서 고쳤다. 구현에서 `vis < 0.5` 조건을 빼 보면 이 시험이 실패하는 것을 확인했다.
- `makeFakeRenderer` 에 `rayAt`(기본은 그 점 바로 위의 수직 광선)을 더했다 — 다른 시험의 탭은 건물에 닿지 않아 영향이 없다(전체 통과).

## 20-08(마을 E2E)이 알아야 할 것

- **표식**: 태그 래퍼 `[data-seat]` 의 `data-door="vanish|appear"`(연출 동안만)·`data-veiled="true"`(숨는 동안). 숨은 사람의 `style.opacity` 는 `"0"`, 사라진 사람의 태그는 연출 뒤 `"0"` 으로 남는다(DOM 에서 지워지지 않는다).
- **훅**: `window.__mfTown` 에 `door: [{ seat, kind }]`(진행 중, 좌석 오름차순, 끝나면 `[]`)·`veiled: number[]`(오름차순). 마을 판 + `?e2e=1`(또는 개발 빌드)에서만 있다. 시간은 사라짐·나타남 0.2초, 방 안 사람이 벽 뒤에 숨는 것도 0.2초.
- **방에 들어가는 두 번 누르기**: 화면에서 닫힌 방 지붕·벽을 누른다 → 링이 그 방 front(우체국 −0.25,−5.75 · 술집 5.75,−0.25 · 진료소 −0.25,5.75 · 경찰서 −5.75,−0.25). 도착한 뒤 같은 방을 다시 누르면 inside. 지붕 점의 화면 좌표는 바닥 점 `screenOf(x − 12.0208153·k, z − 12.0208153·k)`(k = 높이/11.9)로 구한다(`__mfWorld.screenOf` 는 y = 0 만 안다). 카메라가 내 몸을 따라가므로 광장 한복판에서는 방 지붕이 화면 밖이다 — 방 가장자리 지붕 점은 보이는 것을 고르거나 먼저 걸어가야 한다.
- **나오는 길**: 방에서 광장으로 나오면 같은 사람들이 `appear` 로, 들어가면 `vanish` 로 `__mfTown.door` 에 잡힌다(내 zone snap — `d` 없음). 다른 사람이 문을 지나는 것(`d` 있음)은 서버 프레임 도착 시 같은 연출이다.
- 이름표가 지붕 위에 겹쳐 보이는 것은 DOM 층이라 받아들였다(TM9 참고 줄).

## Threat Flags

없음 — T-20-20(목적지는 서버가 다시 정함)·T-20-21(숨김은 이미 받은 같은 구역 사람의 이름표에만 쓰임, 정보 차단 수단이 아님)·T-20-22(문 연출은 방 id 로 몸을 옮기지 않음)를 그대로 지켰다. 새 끝점·인증 경로·파일 접근 없음.

## Known Stubs

없음.

## Self-Check: PASSED

- `src/world/cutaway.ts`·`src/world/runtime.ts`·`src/world/renderer.ts`·`src/world/threeRenderer.ts`·`test/unit/cutaway.test.ts`·`test/client/worldStage.test.tsx` 존재 확인, 커밋 4개 모두 HEAD 의 조상.
