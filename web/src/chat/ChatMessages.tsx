import { useEffect, useRef } from "react";
import type { ChatMessage } from "../api";
import { AssistantMessage, Thinking } from "./AssistantMessage";
import { UserMessage } from "./UserMessage";

interface Props {
  messages: ChatMessage[];
  streaming: string | null;
  fresh: Set<string>;
}

const NEAR_BOTTOM = 96;

/** The only scrolling region of the page. Follows new content unless the reader has scrolled up. */
export function ChatMessages({ messages, streaming, fresh }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const lastCount = useRef(0);

  const onScroll = () => {
    const el = scroller.current;
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM;
  };

  useEffect(() => {
    const last = messages.at(-1);
    if (messages.length > lastCount.current && last?.role === "user") stick.current = true; // the reader just asked something
    lastCount.current = messages.length;
    const el = scroller.current;
    if (el && stick.current) requestAnimationFrame(() => el.scrollTo({ top: el.scrollHeight }));
  }, [messages, streaming]);

  return (
    <div className="messages" ref={scroller} onScroll={onScroll} role="log" aria-live="polite" aria-label="Conversation">
      <div className="thread">
        {messages.map((m) =>
          m.role === "user" ? (
            <UserMessage key={m.id} text={m.content} animate={m.id.startsWith("local-") || fresh.has(m.id)} />
          ) : (
            <AssistantMessage key={m.id} text={m.content} sources={m.citations ?? []} />
          ),
        )}
        {streaming === "" && <Thinking />}
        {!!streaming && <AssistantMessage key="streaming" text={streaming} sources={[]} streaming animate />}
      </div>
    </div>
  );
}
