const LABEL = /^(?:R\d+|J\d+-\d+|S)$/i;

export interface SanitizedAnswer {
  text: string;
  /** Valid labels the answer relies on, in first-use order. */
  cited: string[];
  /** Labels the model wrote that were not in the context it was given. */
  invalid: string[];
}

/**
 * Keep only citations that point at context the model was actually given.
 * "[R3, J2-1]" is handled as two labels; an unknown label is removed and, if nothing is left, so are the brackets.
 */
export function sanitizeCitations(text: string, allowed: Set<string>): SanitizedAnswer {
  const cited: string[] = [];
  const invalid: string[] = [];
  const out = text.replace(/\[([^[\]\n]{1,60})\]/g, (whole, inner: string) => {
    const parts = inner.split(/[,;\s]+/).filter(Boolean);
    if (parts.length === 0 || !parts.every((p) => LABEL.test(p))) return whole; // not a citation, e.g. "[optional]"
    const keep: string[] = [];
    for (const p of parts) {
      const label = p.toUpperCase();
      if (allowed.has(label)) {
        keep.push(label);
        if (!cited.includes(label)) cited.push(label);
      } else if (!invalid.includes(label)) invalid.push(label);
    }
    return keep.length ? `[${keep.join(", ")}]` : "";
  });
  return { text: out.replace(/[ \t]+([.,;:!?])/g, "$1").replace(/ {2,}/g, " ").trim(), cited, invalid };
}
