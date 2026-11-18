// 실험방을 만들 수 있는 주소. 화면과 서버가 같은 목록을 사용한다.
const PLAYTEST_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "minifia-v3.dhplay.workers.dev"]);

export function isPlaytestHost(hostname: string): boolean {
  return PLAYTEST_HOSTS.has(hostname);
}
