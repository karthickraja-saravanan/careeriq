import { useState } from "react";
import { PageHead } from "../ui";

const suggestions = ["What skills am I missing for Job #2?", "Which job is the best match for my profile?", "Which projects should I highlight?"];

export function Assistant() {
  const [draft, setDraft] = useState("");
  return (
    <>
      <PageHead title="Ask about your fit" lead="Answers come from your resume and the job descriptions you added, with sources. If something is not in your documents, the assistant says so." />
      <div className="card">
        <div className="chat" aria-live="polite">
          <div className="msg user">What skills am I missing for Job #2?</div>
          <div className="msg ai">
            <p>For Lumen Health you are missing two required skills: <strong>GraphQL</strong> and <strong>accessibility</strong>. Neither appears in your resume. Your React experience from the expense splitter covers the frontend requirement.</p>
            <p>I cannot tell from your documents whether you have used Next.js, which they list as preferred.</p>
            <div className="chips"><button className="chip cite">R4 · Projects</button><button className="chip cite">J2-2 · Requirements</button></div>
          </div>
        </div>
        <div className="chips">{suggestions.map((s) => (<button key={s} className="pill" onClick={() => setDraft(s)}>{s}</button>))}</div>
        <form className="composer" onSubmit={(e) => e.preventDefault()}>
          <input id="chat-input" className="input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask about a role or your resume" aria-label="Your question" />
          <button className="btn" type="submit" disabled title="Chat arrives in a later milestone">Send</button>
        </form>
      </div>
    </>
  );
}
