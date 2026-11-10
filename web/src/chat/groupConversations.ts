import type { Conversation } from "../api";

export interface ConversationGroup { label: "Today" | "Yesterday" | "Previous 7 Days" | "Older"; items: Conversation[] }

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Group conversations by how long ago they were started, newest first, omitting empty groups. */
export function groupConversations(list: Conversation[], now = new Date()): ConversationGroup[] {
  const today = startOfDay(now);
  const day = 86_400_000;
  const groups: ConversationGroup[] = [
    { label: "Today", items: [] }, { label: "Yesterday", items: [] }, { label: "Previous 7 Days", items: [] }, { label: "Older", items: [] },
  ];
  for (const c of [...list].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))) {
    const age = today - startOfDay(new Date(c.createdAt));
    groups[age < day ? 0 : age < 2 * day ? 1 : age < 7 * day ? 2 : 3]!.items.push(c);
  }
  return groups.filter((g) => g.items.length > 0);
}
