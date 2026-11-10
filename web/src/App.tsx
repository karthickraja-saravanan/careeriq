import { useEffect, useState } from "react";

type Status = "checking" | "ready" | "down";

export function App() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    fetch("/api/v1/ready")
      .then((r) => setStatus(r.ok ? "ready" : "down"))
      .catch(() => setStatus("down"));
  }, []);

  return (
    <main style={{ fontFamily: "system-ui", maxWidth: 640, margin: "4rem auto", padding: "0 1rem" }}>
      <h1>CareerIQ</h1>
      <p>Career Intelligence Assistant. API status: <strong>{status}</strong></p>
    </main>
  );
}
