import { APP_VERSION } from "../shared/version";

export function App() {
  return (
    <>
      <main style={{ padding: "48px 20px 0" }}>
        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, letterSpacing: "0.02em" }}>minifia</h1>
      </main>
      <footer className="app-version">v{APP_VERSION}</footer>
    </>
  );
}
