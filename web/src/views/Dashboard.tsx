import { jobs, resume, bestJob } from "../sampleData";
import { PageHead, Ring, scoreTone } from "../ui";

export function Dashboard({ go }: { go: (v: string) => void }) {
  const ranked = [...jobs].sort((a, b) => b.score - a.score);
  const gaps = new Map<string, number>();
  jobs.forEach((j) => j.required.filter((r) => !r.met).forEach((r) => gaps.set(r.skill, (gaps.get(r.skill) ?? 0) + 1)));
  const topGaps = [...gaps.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  return (
    <>
      <PageHead title="Where you stand" lead={`${resume.name} against ${jobs.length} roles. ${bestJob.label} at ${bestJob.company} is your closest fit.`} />
      <section className="grid cols-3" aria-label="Summary">
        <div className="card tight"><span className="label">Resume</span><h2>{resume.headline}</h2><span className="caption">{resume.skills.length} skills parsed</span></div>
        <div className="card tight"><span className="label">Roles tracked</span><h2 className="num">{jobs.length}</h2><span className="caption">Add more any time</span></div>
        <div className="card tight"><span className="label">Best match</span><h2 className="num">{bestJob.score} / 100</h2><span className="caption">{bestJob.title}, {bestJob.company}</span></div>
      </section>
      <section className="grid cols-2">
        <div className="card">
          <h2>Roles ranked by fit</h2>
          <div>
            {ranked.map((j) => (
              <div className="rank" key={j.id}>
                <Ring score={j.score} />
                <div className="grow">
                  <h3>{j.title}</h3>
                  <p className="caption">{j.label} · {j.company} · {scoreTone(j.score).label}</p>
                </div>
                <button className="btn secondary" onClick={() => go("compare")}>Details</button>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h2>Skills missing across roles</h2>
          <p className="caption">Required skills you have no evidence for. More roles asking means more payoff.</p>
          <div className="chips">
            {topGaps.map(([s, n]) => (<span className="chip bad" key={s}>{s} · {n} {n === 1 ? "role" : "roles"}</span>))}
          </div>
          <div className="row"><button className="btn" onClick={() => go("assistant")}>Ask what to improve</button></div>
        </div>
      </section>
    </>
  );
}
