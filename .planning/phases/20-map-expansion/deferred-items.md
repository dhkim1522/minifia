# 20페이즈 — 범위 밖으로 미룬 것

## test/worker/bots.test.ts 간헐 실패 (20-02 실행 중 관찰)

- **무엇**: `npm test` 전체 실행에서 `test/worker/bots.test.ts` 의 시험 하나가 가끔 실패한다. 따로 돌리면 통과한다.
  - "기본판 봇 방 자동 완주 …" — `forceBotsDue` 의 `expect(await runDurableObjectAlarm(stub)).toBe(true)` 가 false.
  - "discussion: 봇 셋이 모두 토론 끝내기를 누르면 …" — `planKinds` 의 끝내기 수가 3이 아니라 2.
- **얼마나**: 20-02 의 코드로 `npm test` 8번 가운데 3번 실패(그중 2번이 위 두 시험, 1번은 시험 이름을 남기지 못했다). 20-02 전 커밋(`20e0d42c`)은 4번 모두 통과. 표본이 작아 빈도가 달라졌는지는 가리지 못했다.
- **이미 있던 것인가**: 같은 모양이 이전 기록에 있다 — 09-VERIFICATION(부하에서 `planKinds` 2), 10-09-SUMMARY, 16-10-SUMMARY, 19-VERIFICATION("봇 계획을 세운 알람과 읽기 사이의 경합을 먼저 본다").
- **20-02 와의 관계**: 두 시험 모두 재즈 바 판이다. 20-02 의 서버 코드는 방이 없는 맵에서 모두 바로 돌아가는 분기라 동작이 같다. 원인은 확정하지 않았다.
- **볼 곳**: 시험 도우미가 저장된 봇 계획을 읽거나 evict 한 직후, 실제 시간에 깨어난 봇 알람과 겹치는 경합(`forceBotsDue` 의 evict ↔ 알람, `armBots` ↔ `planKinds`).
- **하지 않은 것**: 시험·서버를 고치지 않았다(20-02 의 범위 밖).
