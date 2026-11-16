// 워커 시험 전용 바인딩 타입(23-02, D-18). DB 는 wrangler types 가 만드는 worker-configuration.d.ts 의 Env 에서 온다.
declare namespace Cloudflare {
  interface Env {
    TEST_MIGRATIONS: import("cloudflare:test").D1Migration[];
  }
}
