// Example data used while the API milestones land. Shown with a "Sample data" badge in the UI.
export interface Job {
  id: string; label: string; title: string; company: string; score: number;
  required: { skill: string; met: boolean; evidence?: string }[];
  preferred: { skill: string; met: boolean }[];
  experience: { need: string; have: string; score: number };
  skillScore: number; preferredScore: number;
  strengths: string[]; concerns: string[]; recommendations: string[];
  questions: { q: string; why: string; structure: string; basedOn: string }[];
}

export const resume = {
  name: "Priya Nair",
  headline: "Backend engineer, 5 years",
  years: 5,
  skills: ["TypeScript", "Node.js", "PostgreSQL", "REST APIs", "Docker", "AWS (EC2, S3)", "React", "Jest"],
  experience: [
    { id: "R2", role: "Backend Engineer", org: "Finlytics", dates: "2022 to now", bullets: ["Built billing APIs handling 2M requests per day", "Cut p95 latency 40% by adding query indexes and caching"] },
    { id: "R3", role: "Software Engineer", org: "Cartwheel", dates: "2019 to 2022", bullets: ["Shipped order tracking service in Node.js and PostgreSQL", "Introduced Jest test suite, coverage from 20% to 78%"] },
  ],
  projects: ["Open-source CSV validator (1.2k stars)", "Side project: expense splitter with React and Express"],
  education: "B.Tech Computer Science, 2019",
  certifications: ["AWS Cloud Practitioner"],
};

export const jobs: Job[] = [
  {
    id: "j1", label: "Job #1", title: "Senior Backend Engineer", company: "Northwind Pay", score: 82,
    skillScore: 86, preferredScore: 50,
    required: [
      { skill: "TypeScript", met: true, evidence: "R2" }, { skill: "Node.js", met: true, evidence: "R3" },
      { skill: "PostgreSQL", met: true, evidence: "R3" }, { skill: "Kafka", met: false },
      { skill: "System design", met: true, evidence: "R2" }, { skill: "Mentoring", met: false },
    ],
    preferred: [{ skill: "AWS", met: true }, { skill: "Kubernetes", met: false }],
    experience: { need: "5+ years backend", have: "5 years backend", score: 80 },
    strengths: ["Direct match on TypeScript, Node.js and PostgreSQL", "Measured latency work maps to their scale requirements [R2]"],
    concerns: ["No streaming or Kafka experience in the resume", "No mention of mentoring or leading engineers"],
    recommendations: ["Learn Kafka basics and build a small producer/consumer project", "Add any informal mentoring you did, only if it happened"],
    questions: [
      { q: "How did you reduce p95 latency by 40% at Finlytics?", why: "Your strongest quantified result and central to this role.", structure: "Situation, measurement, change, result, what you would do next.", basedOn: "R2" },
      { q: "Design an event-driven payments pipeline.", why: "Kafka is required and missing from your resume.", structure: "State the gap honestly, then reason from queues you have used and trade-offs.", basedOn: "J1-3" },
    ],
  },
  {
    id: "j2", label: "Job #2", title: "Full Stack Engineer", company: "Lumen Health", score: 68,
    skillScore: 70, preferredScore: 33,
    required: [
      { skill: "React", met: true, evidence: "R4" }, { skill: "TypeScript", met: true, evidence: "R2" },
      { skill: "GraphQL", met: false }, { skill: "Node.js", met: true, evidence: "R3" }, { skill: "Accessibility", met: false },
    ],
    preferred: [{ skill: "Next.js", met: false }, { skill: "Playwright", met: false }, { skill: "Docker", met: true }],
    experience: { need: "3+ years full stack", have: "5 years, mostly backend", score: 60 },
    strengths: ["React project shows frontend capability [R4]"],
    concerns: ["Experience is backend-heavy; the role is half frontend", "GraphQL and accessibility not evidenced"],
    recommendations: ["Highlight the React expense splitter and put it near the top", "Build a small GraphQL layer over an existing project"],
    questions: [
      { q: "Walk me through the frontend of your expense splitter.", why: "Your only frontend evidence.", structure: "Component structure, state management, one problem you solved.", basedOn: "R4" },
      { q: "How do you make a form accessible?", why: "Accessibility is required and not in your resume.", structure: "Be candid about experience, then explain what you know and how you would test it.", basedOn: "J2-2" },
    ],
  },
  {
    id: "j3", label: "Job #3", title: "Platform Engineer", company: "Orbital Cloud", score: 49,
    skillScore: 45, preferredScore: 25,
    required: [
      { skill: "Kubernetes", met: false }, { skill: "Terraform", met: false }, { skill: "AWS", met: true, evidence: "R1" },
      { skill: "Go or Python", met: false }, { skill: "CI/CD", met: false },
    ],
    preferred: [{ skill: "Prometheus", met: false }, { skill: "Docker", met: true }],
    experience: { need: "4+ years infrastructure", have: "No dedicated infrastructure role", score: 35 },
    strengths: ["Docker and basic AWS exposure"],
    concerns: ["Most required skills are not evidenced", "Role is infrastructure-focused, resume is application-focused"],
    recommendations: ["Treat this as a stretch role; build a Terraform and Kubernetes project before applying"],
    questions: [
      { q: "Describe how you deploy the services you build today.", why: "Closest bridge from your experience to this role.", structure: "Walk the pipeline end to end, then name what you did not own.", basedOn: "R2" },
    ],
  },
];

export const bestJob = [...jobs].sort((a, b) => b.score - a.score)[0]!;
