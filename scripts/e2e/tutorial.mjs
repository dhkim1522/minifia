// 17페이즈 첫 사건(튜토리얼) E2E 흐름 (17-09): tutorial-solo(혼자 하기, 폰 6종)·tutorial-together(함께 진행, 390x844 한 크기).
// 이름 앞머리 tutorial — 다른 흐름 id 와 부분 일치가 겹치지 않는다(`--only tutorial` 하나로 둘 다 돈다). 흐름은 화면을 읽기만 하고 판정은 lib.mjs 의 순수 함수에 맡긴다:
// 판정 문턱은 여기서 낮추지 않는다(T-17-21 — 결과 줄에는 크기·장면 번호·판정 id·사각형만, 닉네임·토큰·view 값은 싣지 않는다).
// 앱에는 E2E 전용 단축(URL 장면 번호 등)이 없다 — 실제 사용자 경로(클릭)로만 간다. 150초 시간 초과 경로는 기다리지 않는다(워커 시험 17-12 가 맡는다, 0080-19).
// helpers 는 flows.mjs 가 넘긴다(errand.mjs·host.mjs 와 같은 모양 — 서로 import 하지 않는다): { recorder, attempt, startHost, openGuest }
import { SetupError, openSoloPage, readTutorial, settle, sleep } from "./browser.mjs";
import { TUTORIAL_CAST_E2E, sentFrameChecks, tutorialEntryChecks } from "./lib.mjs";

const recOne = (rec, scenario, r) => rec(scenario, r.id, r.label, r.ok, r.detail, r.relaxed === true || r.info === true);

export function makeTutorialFlows({ recorder, attempt }) {
  /**
   * tutorial-solo: 방 없이 첫 화면("/", 테스트 방 아님)에서 큰 카드 1개(방 코드 칸·[방 만들기] 와 교차 0) → 눌러 첫 사건 화면(장면 1) → [건너뛰기] → 첫 화면 작은 단추 1개.
   * 혼자 하기 전체에서 앱 소켓은 열리지 않고 보낸 프레임은 0건이다(TUT-01·TUT-05).
   */
  async function tutorialSoloFlow(ctx) {
    const rec = recorder(ctx);
    let solo = null;
    try {
      solo = await openSoloPage(ctx.browser, { origin: ctx.origin, size: ctx.size, needles: TUTORIAL_CAST_E2E.names });
      const { page, sockets } = solo;

      // ① 첫 화면: 처음 카드 1개
      const home = await attempt(async () => {
        await page.waitForSelector("[data-tutorial-entry]");
        await settle(page);
      });
      if (!home.ok) throw new SetupError(`첫 화면 진입 카드가 보이지 않음 (${home.detail})`);
      const t0 = await readTutorial(page);
      for (const l of tutorialEntryChecks({ entry: t0.entry, field: t0.field, create: t0.create, viewport: { w: t0.vw, h: t0.vh } }, { kind: "card" })) recOne(rec, "tutorial-solo/entry", l);

      // ② 카드를 누르면 첫 사건 화면(장면 1)
      const started = await attempt(async () => {
        await page.locator('[data-tutorial-entry="card"]').click();
        await page.waitForSelector('[data-tutorial-screen][data-tutorial-scene="1"]');
      });
      rec("tutorial-solo/entry", "TU1", "카드를 누르면 첫 사건 화면 장면 1", started.ok, started.detail);
      if (!started.ok) return;

      // ③ [건너뛰기] → 첫 화면, 작은 단추 1개(방금 시작했으므로 본 사람), 마무리 카드 없음
      const skipped = await attempt(async () => {
        await page.locator("[data-tutorial-skip]").click();
        await page.waitForSelector('[data-tutorial-entry="button"]');
        await settle(page);
      });
      rec("tutorial-solo/entry", "TU2", "[건너뛰기] 로 첫 화면에 돌아와 작은 단추가 보인다", skipped.ok, skipped.detail);
      if (!skipped.ok) return;
      const t1 = await readTutorial(page);
      for (const l of tutorialEntryChecks({ entry: t1.entry, field: t1.field, create: t1.create, viewport: { w: t1.vw, h: t1.vh } }, { kind: "button" })) recOne(rec, "tutorial-solo/skipped", l);
      rec("tutorial-solo/skipped", "TU3", "건너뛰기 뒤 마무리 카드 0개", t1.entry.ends === 0, `마무리 카드 ${t1.entry.ends}개`);

      // ④ 혼자 하기 동안 앱 소켓 0·보낸 프레임 0
      rec("tutorial-solo/socket", "TS0", "혼자 하기 동안 앱 소켓이 열리지 않는다", sockets.opened === 0, `열린 앱 소켓 ${sockets.opened}개`);
      recOne(rec, "tutorial-solo/socket", sentFrameChecks(sockets.frames, []));
    } finally {
      await solo?.context.close().catch(() => {});
    }
  }

  /** tutorial-together: 17-09 Task 3 에서 채운다 */
  async function tutorialTogetherFlow(ctx) {
    const rec = recorder(ctx);
    rec("tutorial-together/setup", "TT0", "함께 진행 흐름은 Task 3 에서 채운다", true, "", false);
    await sleep(0);
  }

  return { tutorialSoloFlow, tutorialTogetherFlow };
}
