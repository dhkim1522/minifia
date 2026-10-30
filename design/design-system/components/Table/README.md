# Table

모든 게임 화면의 중심인 2.5D 원근 타원 테이블과 최대 8자리다. 화면에서는 항상 `Backdrop` 위에 `bare` 로 놓는다. 앱의 실제 기하는 `src/game/dayTable.ts`(고정 테이블, 결정 0017 · 시안 P2: 390폭 면 216×108, 좌석 원 rx 146 · ry 100)이고, 이 번들의 `Table` 은 같은 규칙을 단순화한 시안용 부품이다.

- 층: 이름표(z 1~11) → 캐릭터(z 12~22) → 어둡게 층 → 유령 → 이모티콘. 이름표는 어떤 얼굴도 덮지 않는다.
- 이름표는 자리 크기와 상관없이 14px. 내 자리는 이름표 테두리(`gray-100`)로만 표시한다.
- 빈 자리는 빈 의자만 그린다. 방장 배지는 대기실에서만, 마피아 동료는 진홍 후광과 마름모.
- 발밑 링은 쓰지 않는다. 고른 자리 · 차례 · 공개 대상은 캐릭터 후광으로 표시한다(`halo`, `selected`).
- 공개 중 표수 칩: 흰 = 이미 오른 표, `votesTone: 'new'` = 방금 +1 앰버, `'final'` = 과반 확정 큰 앰버.
- 최후 변론 후보는 `candidate` 로 위에서 빛을 받는다. 앱에서는 후보가 가운데로 ×1.7 이동하고 나머지는 어둡게 45% · 흐림 3px 이다.
- 짧은 폰(장면 높이 299 미만)은 세로를 최대 0.77배 압축한다(이름표 글자는 줄이지 않는다).

| seat 항목 | 값 |
|---|---|
| `name`, `variant`, `me`, `host`, `mate` | 기본 정보 |
| `state` | `default` · `disconnected` · `dead` |
| `halo` | `white` · `amber` · `crimson` (없으면 `selected` → 흰, `mate` → 진홍) |
| `claim`, `changed` | 직업 주장과 말 바꿈 |
| `bubble` | 말풍선 |
| `reaction` | 이모티콘 이름 |
| `votes`, `votesTone` | 공개 중 표수와 색. 투표 중에는 남의 표를 보여 주지 않는다 |
| `selectable`, `selected`, `candidate`, `pressable` | 고르기 상태 |

테이블 prop: `seats`(8칸, 빈 자리는 null), `mySeat`, `bare`, `dimmed`, `morning`, `center`, `onSeatPress`.
