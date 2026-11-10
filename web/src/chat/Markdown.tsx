import { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { SourceCitation } from "./SourceCitation";

const CITATION_GROUP = /\[((?:R\d+|J\d+-\d+|S)(?:[,;\s]+(?:R\d+|J\d+-\d+|S))*)\]/gi;

/** Turn "[R2, J1-3]" into one link per label ("cite:R2") so each can be rendered as its own badge. */
export const linkCitations = (text: string) =>
  text.replace(CITATION_GROUP, (_m, group: string) =>
    group.split(/[,;\s]+/).filter(Boolean).map((l) => `[${l.toUpperCase()}](cite:${l.toUpperCase()})`).join(" "),
  );

interface Props {
  text: string;
  knownCites: Set<string>;
  openCite: string | null;
  onCite: (label: string) => void;
}

/**
 * Renders model output as Markdown. Raw HTML is not supported, images are dropped, and ordinary links render as plain text:
 * the text comes from a model that reads untrusted documents, so it must not be able to inject markup, trackers or links.
 */
export const Markdown = memo(function Markdown({ text, knownCites, openCite, onCite }: Props) {
  const components: Components = {
    a: ({ href, children }) => {
      if (href?.startsWith("cite:")) {
        const label = href.slice(5);
        return <SourceCitation label={label} known={knownCites.has(label)} open={openCite === label} onClick={() => onCite(label)} />;
      }
      return <>{children}</>;
    },
    img: () => null,
    table: ({ children }) => <div className="md-table"><table>{children}</table></div>,
  };
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} urlTransform={(url) => (url.startsWith("cite:") ? url : "")}>
        {linkCitations(text)}
      </ReactMarkdown>
    </div>
  );
});
