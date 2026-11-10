/** Title of the open conversation. Hidden on mobile, where the top bar already shows the page name. */
export function ChatHeader({ title }: { title: string | null }) {
  return (
    <header className="chat-header">
      <h1 className="chat-title">{title ?? "CareerIQ Assistant"}</h1>
    </header>
  );
}
