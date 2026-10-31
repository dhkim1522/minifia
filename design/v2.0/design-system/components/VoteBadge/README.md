# VoteBadge

득표 배지: 지목받은 사람 머리 위에 받은 표 수를 숫자로 보여 준다(결정 0049).

- 남색 `overlay-ink-strong` 바탕, `brass-400` 테두리 2px, `radius-badge`, 명조 숫자 `badge-number`(`cream-100`) + `badge-unit` "표"(`brass-400`).
- 표가 0 이면 그리지 않는다. 처음 나타날 때 `dur-pop` 로 튀어나온다.
- `lead`: 최다 득표가 한 명일 때만. 1.18↔1.34 로 `dur-pulse` 마다 뛰고 크림 빛이 번진다.
