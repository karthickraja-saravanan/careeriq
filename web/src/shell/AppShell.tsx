import { useEffect, useState, type ReactNode } from "react";
import { Menu, SquarePen } from "lucide-react";
import { useMediaQuery } from "../chat/useMediaQuery";
import { AppSidebar, NAV } from "./AppSidebar";
import type { useChat } from "../chat/useChat";

const COLLAPSED_KEY = "careeriq.sidebar-collapsed";
const readCollapsed = () => { try { return localStorage.getItem(COLLAPSED_KEY) === "1"; } catch { return false; } };

interface Props {
  view: string;
  go: (id: string) => void;
  chat: ReturnType<typeof useChat>;
  children: ReactNode;
}

/** Sidebar plus page area. The sidebar is dark in both themes; each page keeps the site theme. */
export function AppShell({ view, go, chat, children }: Props) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => { try { localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0"); } catch { /* storage unavailable */ } }, [collapsed]);
  useEffect(() => { if (!isMobile) setDrawer(false); }, [isMobile]);

  const navigate = (id: string) => { go(id); setDrawer(false); };
  const label = view === "settings" ? "Settings" : NAV.find((n) => n.id === view)?.label ?? "CareerIQ";

  return (
    <div className="app">
      <AppSidebar
        view={view}
        go={navigate}
        collapsed={collapsed}
        isMobile={isMobile}
        drawerOpen={drawer}
        onToggleCollapsed={() => setCollapsed((c) => !c)}
        onCloseDrawer={() => setDrawer(false)}
        chat={{
          conversations: chat.conversations,
          activeId: chat.activeId,
          onNewChat: () => { chat.select(null); setDrawer(false); },
          onSelect: (id) => { chat.select(id); setDrawer(false); },
          onRename: (id, t) => void chat.rename(id, t),
          onDelete: (id) => void chat.remove(id),
        }}
      />
      <div className="app-body">
        {isMobile && (
          <header className="topbar">
            <button type="button" className="icon-btn" aria-label="Open menu" onClick={() => setDrawer(true)}><Menu size={20} /></button>
            <span className="topbar-title">{label}</span>
            {view === "assistant" ? <button type="button" className="icon-btn" aria-label="New chat" onClick={() => chat.select(null)}><SquarePen size={20} /></button> : <span className="icon-btn" />}
          </header>
        )}
        <div className="app-main">
          <main className={view === "assistant" ? "bleed" : undefined}>{children}</main>
        </div>
      </div>
    </div>
  );
}
