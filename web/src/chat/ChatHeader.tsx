import { Menu, SquarePen } from "lucide-react";

interface Props {
  title: string | null;
  isMobile: boolean;
  onOpenSidebar: () => void;
  onNewChat: () => void;
}

export function ChatHeader({ title, isMobile, onOpenSidebar, onNewChat }: Props) {
  return (
    <header className="chat-header">
      {isMobile && <button type="button" className="icon-btn" aria-label="Open chat history" onClick={onOpenSidebar}><Menu size={20} /></button>}
      <h1 className="chat-title">{title ?? "CareerIQ Assistant"}</h1>
      {isMobile && <button type="button" className="icon-btn" aria-label="New chat" onClick={onNewChat}><SquarePen size={20} /></button>}
    </header>
  );
}
