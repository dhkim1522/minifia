# 18.1 이월 항목

## 18.1-04 에서 발견

- `scripts/e2e/browser.mjs` 838행: 행동 버튼 수를 `button:not([data-chat-send]):not([data-chat-newdot]):not([data-emote-button]):not([data-emote])` 로 센다. 18.1-04 가 기록 칸에 `button[data-chat-open]` 을 더해 이 수가 하나 늘어난다. E2E 를 손보는 계획(18.1-06·18.1-09)에서 `:not([data-chat-open])` 을 더한다. 18.1-04 의 files_modified 밖이라 고치지 않았다.

## 18.1-05 에서 발견

- `scripts/e2e/flows.mjs` 의 결과 화면 탭 단언·클릭(1983·2963·3025·3057 줄 근처, `[data-result-tab]`·`[data-result-tab="mafia"]`)은 결과 화면이 탭 행을 그리지 않게 되어 맞지 않는다. 18.1-05 의 files_modified 밖이다. 계획대로 18.1-08 이 바꾼다(result-reveal·result-awards·basic-off).
