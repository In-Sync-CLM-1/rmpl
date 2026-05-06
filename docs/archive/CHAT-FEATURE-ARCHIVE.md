# Team Chat Feature — Archive

**Status:** Removed from production on 2026-05-06.
**Reason:** Feature decommissioned at owner's request.
**Removal migration:** `20260506120000_drop_chat_feature.sql`.

This document is the complete build record of the in-app team chat (user-to-user messaging) feature. It captures everything needed to rebuild it, in case the feature is ever re-introduced. Source files referenced here have all been deleted; reconstruct by reading this archive together with `git log` history of the listed migrations.

---

## 1. What the feature did

A real-time in-app messaging system between authenticated users of RMPL OPM. Supported:

- **1:1 (direct) conversations** and **group conversations** (with admin/non-admin roles)
- **Text messages**, **file attachments** (images, video, PDFs, etc.), **task shares** (from the unified `tasks` table)
- **Replies / threading** (via `chat_messages.reply_to_id` self-reference)
- **Forwarding** messages to other conversations
- **Emoji reactions** (one user can add multiple distinct emojis per message; reactions de-duplicate on `(message_id, user_id, emoji)`)
- **Read receipts** — each participant has a `last_read_at` timestamp; UI computes who has read which message
- **Unread badges** — per-conversation and global tab-title counter
- **Real-time delivery** via Supabase Realtime postgres_changes channels
- **Browser/web notifications** when tab is unfocused
- **Native push notifications** (Capacitor / FCM) when supplied with `FCM_SERVER_KEY`
- **Floating chat widget** — LinkedIn-style collapsible bottom-right popup on every page (auto-hidden on `/chat`)

---

## 2. Migrations that built it

In chronological order. All applied to production.

| File | What it did |
|------|-------------|
| `20260119022625_04a72c8d-1de4-40f0-855c-ce1c1f069a61.sql` | Created `chat_conversations`, `chat_participants`, `chat_messages`, all indexes and base RLS policies. Created `chat-attachments` storage bucket and storage policies. Enabled realtime on `chat_messages` and `chat_participants`. Created `update_conversation_last_message()` trigger function and trigger; attached `update_updated_at_column` triggers to chat tables. |
| `20260119023244_b1ec2920-31ca-4190-bfd6-7e77c76123ac.sql` | Added `chat_messages.project_task_id` (later removed in the unified-tasks migration). |
| `20260119024045_00e839ae-5888-48b5-a364-69d9924f0a72.sql` | Created `chat_message_reactions` table, indexes, RLS, and realtime publication. |
| `20260119030929_133e7a72-f183-4e37-b6b1-376506b88e6a.sql` | First fix to recursive RLS on `chat_participants`. |
| `20260119031646_75a8dbed-25c3-4e65-a4a4-7e9524827549.sql` | Introduced the `SECURITY DEFINER` helpers `is_participant_in_conversation()` and `get_user_conversation_ids()` to break RLS recursion. Rewrote SELECT/INSERT policies on `chat_participants`, `chat_conversations`, `chat_messages` to use these helpers. |
| `20260119032356_3080b79e-b68f-4eaa-ba0c-3558e4dee31c.sql` | Added DELETE policies for participants, conversations, and messages. Made the conversation creator visible to themselves before they're a participant (resolves a bootstrap RLS gap). |
| `20260120065616_e70eb334-7bed-4a8d-9a2b-2eda470fef12.sql` | Added `notifications.conversation_id` column + index. Created `create_chat_message_notification()` trigger function and the `notify_chat_message_recipients` AFTER INSERT trigger on `chat_messages` that fans out a notification row per non-sender participant. |
| `20260128020628_83c29b37-8b82-4f66-a829-68fabbd421b9.sql` | Added `'chat_message'` to the `notifications.notification_type` CHECK constraint. |
| `20260128022305_a4bf05fa-e332-4380-b3e2-5bd69f389e12.sql` | Created `push_subscriptions` table (used by chat for native FCM tokens). |
| `20260206034215_bbd1ada5-6a1c-4101-ae33-39674f86776a.sql` | `ALTER TABLE chat_messages REPLICA IDENTITY FULL` so realtime UPDATE/DELETE events carry full old-row data. |
| `20260209034157_dda3f57f-3c63-4ade-a842-149ab16ea6f8.sql` | Added `chat_messages.reply_to_id` (self-reference) for thread replies. |
| `20260329100000_chat_performance.sql` | Added composite indexes `idx_chat_messages_conv_created`, `idx_chat_participants_conv_user`. Created `get_conversation_meta(p_user_id)` RPC that returns last-message + unread-count for all of a user's conversations in one round-trip (eliminated N+1 in `useConversations`). |
| `20260329130000_merge_task_tables.sql` | Unified `general_tasks` + `project_tasks` → `tasks`. Dropped `chat_messages.project_task_id` and merged values into `chat_messages.task_id`. Re-pointed `chat_messages.task_id` FK to `tasks.id`. |

---

## 3. Database schema (final shape just before removal)

### 3.1 Tables

#### `chat_conversations`
```sql
CREATE TABLE public.chat_conversations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_type TEXT NOT NULL DEFAULT 'direct'
                    CHECK (conversation_type IN ('direct', 'group')),
  name              TEXT,                  -- NULL for direct conversations
  created_by        UUID REFERENCES public.profiles(id),
  last_message_at   TIMESTAMPTZ DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_chat_conversations_last_message_at
  ON public.chat_conversations(last_message_at DESC);
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
```

#### `chat_participants`
```sql
CREATE TABLE public.chat_participants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_at    TIMESTAMPTZ DEFAULT now(),
  is_admin        BOOLEAN DEFAULT false,
  UNIQUE(conversation_id, user_id)
);
CREATE INDEX idx_chat_participants_user_id          ON public.chat_participants(user_id);
CREATE INDEX idx_chat_participants_conversation_id  ON public.chat_participants(conversation_id);
CREATE INDEX idx_chat_participants_conv_user        ON public.chat_participants(conversation_id, user_id);
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participants;
```

#### `chat_messages`
```sql
CREATE TABLE public.chat_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES public.profiles(id),
  content         TEXT,
  message_type    TEXT NOT NULL DEFAULT 'text'
                  CHECK (message_type IN ('text', 'task_share', 'file')),
  task_id         UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  file_url        TEXT,
  file_name       TEXT,
  file_size       BIGINT,
  reply_to_id     UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  is_edited       BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_chat_messages_conversation_id ON public.chat_messages(conversation_id);
CREATE INDEX idx_chat_messages_sender_id       ON public.chat_messages(sender_id);
CREATE INDEX idx_chat_messages_created_at      ON public.chat_messages(created_at DESC);
CREATE INDEX idx_chat_messages_conv_created    ON public.chat_messages(conversation_id, created_at DESC);
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
```

UI used `message_type = 'gif'` in some preview text, but the CHECK constraint did not include `'gif'` — `gif` was effectively a UI-only display path that was never persisted by the live UI.

#### `chat_message_reactions`
```sql
CREATE TABLE public.chat_message_reactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);
CREATE INDEX idx_chat_reactions_message_id ON public.chat_message_reactions(message_id);
CREATE INDEX idx_chat_reactions_user_id    ON public.chat_message_reactions(user_id);
ALTER TABLE public.chat_message_reactions ENABLE ROW LEVEL SECURITY;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_message_reactions;
```

#### `push_subscriptions` (chat-only at time of removal)
```sql
CREATE TABLE public.push_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform    TEXT NOT NULL CHECK (platform IN ('web', 'ios', 'android')),
  token       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, platform)
);
CREATE INDEX idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
```

### 3.2 Storage bucket

`chat-attachments` — **private** bucket. Path layout: `{user_id}/{conversation_id}/{timestamp}.{ext}`. Size caps enforced client-side: 5 MB images, 10 MB other. Signed URLs with 7-day TTL on initial upload, 1-hour TTL on subsequent reads.

Storage policies (on `storage.objects`):
- `Authenticated users can upload chat files` — INSERT, requires authenticated role and `bucket_id = 'chat-attachments'`.
- `Users can view chat files in their conversations` — SELECT, authenticated only.
- `Users can delete their own chat files` — DELETE, only own folder (`auth.uid()::text = (storage.foldername(name))[1]`).

### 3.3 SECURITY DEFINER helper functions

```sql
CREATE OR REPLACE FUNCTION public.is_participant_in_conversation(conv_id uuid, checking_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE conversation_id = conv_id AND user_id = checking_user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_conversation_ids(checking_user_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT conversation_id FROM public.chat_participants WHERE user_id = checking_user_id
$$;
```

These exist specifically to break the RLS recursion when checking participant membership while listing participants.

### 3.4 Trigger functions

#### `update_conversation_last_message()`
Fires AFTER INSERT on `chat_messages`. Updates the parent `chat_conversations.last_message_at` and `updated_at` so conversation lists can sort by recency without scanning the messages table.

```sql
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.chat_conversations
  SET last_message_at = NEW.created_at, updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
CREATE TRIGGER update_conversation_last_message_trigger
AFTER INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.update_conversation_last_message();
```

#### `create_chat_message_notification()`
Fires AFTER INSERT on `chat_messages`. Inserts a `notifications` row for every participant except the sender, populating `notifications.conversation_id` so the bell can deep-link to `/chat/{conversation_id}`.

```sql
CREATE OR REPLACE FUNCTION public.create_chat_message_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_participant         RECORD;
  v_sender_name         TEXT;
  v_conversation_name   TEXT;
  v_preview             TEXT;
BEGIN
  SELECT full_name INTO v_sender_name FROM profiles WHERE id = NEW.sender_id;
  SELECT CASE WHEN conversation_type = 'group' THEN name ELSE NULL END
    INTO v_conversation_name
    FROM chat_conversations WHERE id = NEW.conversation_id;
  v_preview := CASE
    WHEN NEW.message_type = 'file'        THEN 'Sent a file'
    WHEN NEW.message_type = 'task_share'  THEN 'Shared a task'
    WHEN NEW.message_type = 'gif'         THEN 'Sent a GIF'
    ELSE LEFT(COALESCE(NEW.content, 'New message'), 100)
  END;
  FOR v_participant IN
    SELECT user_id FROM chat_participants
    WHERE conversation_id = NEW.conversation_id AND user_id != NEW.sender_id
  LOOP
    INSERT INTO notifications (user_id, notification_type, title, message, conversation_id, is_read)
    VALUES (
      v_participant.user_id, 'chat_message',
      COALESCE(v_sender_name, 'Someone')
        || CASE WHEN v_conversation_name IS NOT NULL THEN ' in ' || v_conversation_name ELSE '' END,
      v_preview, NEW.conversation_id, false
    );
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE TRIGGER notify_chat_message_recipients
AFTER INSERT ON chat_messages
FOR EACH ROW EXECUTE FUNCTION create_chat_message_notification();
```

#### `update_updated_at_column` triggers
Generic trigger from elsewhere in the schema. Wired to `chat_conversations` and `chat_messages`.

### 3.5 RPC

#### `get_conversation_meta(p_user_id uuid)` — performance-critical
Returns one row per conversation the user participates in, with `(conversation_id, last_msg_content, last_msg_type, last_msg_sender_id, last_msg_created_at, unread_count)`. The frontend's `useConversations` calls this once instead of issuing 2 follow-up queries per conversation.

### 3.6 RLS policies (final state)

#### `chat_conversations`
- SELECT `Users can view their conversations`: `created_by = auth.uid() OR id IN (SELECT public.get_user_conversation_ids(auth.uid()))`
- INSERT `Users can create conversations`: `auth.uid() = created_by`
- UPDATE `Admins can update their conversations`: requires participant row with `is_admin = true`
- DELETE `Admins can delete conversations`: `created_by = auth.uid()` OR admin-participant

#### `chat_participants`
- SELECT `Users can view participants of their conversations`: `conversation_id IN (SELECT public.get_user_conversation_ids(auth.uid()))`
- INSERT `Users can add participants to conversations`: `user_id = auth.uid()` OR creator of conversation
- UPDATE `Users can update their own participation`: `user_id = auth.uid()`
- DELETE `Admins can remove participants`: admin-participant OR `user_id = auth.uid()` (self-leave)

#### `chat_messages`
- SELECT `Users can view messages in their conversations`: `conversation_id IN (SELECT public.get_user_conversation_ids(auth.uid()))`
- INSERT `Users can send messages to their conversations`: `auth.uid() = sender_id AND public.is_participant_in_conversation(conversation_id, auth.uid())`
- UPDATE `Users can update their own messages`: `sender_id = auth.uid()`
- DELETE `Users can delete their own messages`: `sender_id = auth.uid()`

#### `chat_message_reactions`
- SELECT `Users can view reactions in their conversations`: join via `chat_messages` → `chat_participants`
- INSERT `Users can add reactions`: `auth.uid() = user_id AND` participant in the message's conversation
- DELETE `Users can remove their own reactions`: `user_id = auth.uid()`

#### `push_subscriptions`
- All four (SELECT/INSERT/UPDATE/DELETE) restricted to `auth.uid() = user_id`.

### 3.7 Cross-table integration with `notifications`

- `notifications.conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE`
- `idx_notifications_conversation` index on that column
- `notifications.notification_type` CHECK includes `'chat_message'`

When chat is removed, the column is dropped (notifications produced by chat are deleted via FK CASCADE). The CHECK constraint is rebuilt without `'chat_message'`.

---

## 4. Frontend architecture

### 4.1 File map

```
src/
├── pages/
│   └── Chat.tsx                                  ← route /chat and /chat/:conversationId
│
├── components/chat/
│   ├── ChatHeader.tsx                            ← full-page header
│   ├── CompactChatHeader.tsx                     ← floating-widget header
│   ├── ConversationList.tsx                      ← full-page sidebar
│   ├── CompactConversationList.tsx               ← widget conversation list
│   ├── CompactChatView.tsx                       ← widget thread+input
│   ├── MessageThread.tsx                         ← scrollable message list with date dividers, reply/forward menus, pagination via fetchOlderMessages()
│   ├── MessageInput.tsx                          ← textarea + file attach + task picker + reply-to chip
│   ├── MessageReactions.tsx                      ← rendered grouped reactions under a message
│   ├── ReactionPicker.tsx                        ← emoji-picker-react popover
│   ├── ReadReceipts.tsx                          ← avatar stack of who-has-read
│   ├── FileAttachment.tsx                        ← image/video lightbox + generic file card
│   ├── ForwardMessageDialog.tsx                  ← pick destination conversation
│   ├── NewConversationDialog.tsx                 ← Direct/Group/Teams tabs
│   ├── AddParticipantsDialog.tsx                 ← add users to existing group
│   ├── GroupParticipantsSheet.tsx                ← view/manage group members
│   ├── TaskPickerDialog.tsx                      ← pick a row from `tasks` to share
│   ├── TaskShareCard.tsx                         ← rendered card for a task_share message
│   ├── FloatingChatButton.tsx                    ← simple jump-to-/chat button (older)
│   ├── FloatingChatWidget.tsx                    ← LinkedIn-style collapsible widget (newer; mounted in AppLayout)
│   └── PushNotificationPermission.tsx            ← in-app banner that asks for browser notification permission
│
├── hooks/
│   ├── useConversations.ts                       ← list, create, total-unread; calls get_conversation_meta RPC
│   ├── useMessages.ts                            ← messages query, send mutation with optimistic update, realtime channel, fetchOlderMessages pagination
│   ├── useChatFileUpload.ts                      ← uploads to chat-attachments bucket; signed URL helpers
│   ├── useMessageReactions.ts                    ← reactions query + add/remove/toggle + grouping helpers
│   ├── useReadReceipts.ts                        ← computes read-receipt avatars from chat_participants.last_read_at
│   ├── useGroupParticipants.ts                   ← add/remove participants, leave group
│   ├── useChatNotifications.ts                   ← global toast + browser push for incoming messages
│   └── useTabNotifications.ts                    ← updates document.title with unread count
│
└── services/
    └── pushNotifications.ts                      ← Capacitor PushNotifications init + Browser Notification API helpers
```

### 4.2 Hook contracts (TypeScript signatures)

```ts
// useConversations
export interface Conversation {
  id: string;
  conversation_type: "direct" | "group";
  name: string | null;
  created_by: string | null;
  last_message_at: string;
  created_at: string;
  updated_at: string;
  participants: {
    user_id: string;
    is_admin: boolean;
    last_read_at: string;
    profile: { id: string; full_name: string | null; avatar_url: string | null };
  }[];
  last_message?: {
    content: string | null;
    message_type: string;
    sender_id: string;
    created_at: string;
  };
  unread_count?: number;
}
export function useConversations(): {
  conversations: Conversation[];
  isLoading: boolean;
  error: unknown;
  createConversation: UseMutationResult<string, Error,
    { participantIds: string[]; name?: string; type?: "direct" | "group" }
  >;
};
export function useTotalUnreadCount(): number;

// useMessages
export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  message_type: "text" | "task_share" | "file";
  task_id: string | null;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  is_edited: boolean;
  reply_to_id: string | null;
  created_at: string;
  updated_at: string;
  sender?: { id: string; full_name: string | null; avatar_url: string | null };
  reply_to?: {
    id: string; content: string | null; message_type: string;
    sender: { full_name: string | null } | null;
  } | null;
  task?: {
    id: string; task_name: string; description: string | null;
    status: string; due_date: string; priority: string | null;
    project_id?: string | null;
    project?: { project_name: string | null };
  };
}
export function useMessages(conversationId: string | null): {
  messages: ChatMessage[];
  isLoading: boolean;
  error: unknown;
  sendMessage: UseMutationResult<ChatMessage, Error, {
    content?: string;
    messageType?: "text" | "task_share" | "file";
    taskId?: string;
    fileUrl?: string;
    fileName?: string;
    fileSize?: number;
    replyToId?: string;
  }>;
  markAsRead: () => Promise<void>;
  fetchOlderMessages: () => Promise<void>;
  hasMore: boolean;
  isFetchingMore: boolean;
};

// Other hooks (sketched)
export function useChatFileUpload(): {
  uploadFile: (file: File, conversationId: string) =>
    Promise<{ url: string; path: string; name: string; size: number } | null>;
  getSignedUrl: (path: string) => Promise<string | undefined>;
  isUploading: boolean;
  progress: number;
};
export function useMessageReactions(conversationId: string | null): {
  reactions: MessageReaction[];
  isLoading: boolean;
  addReaction: UseMutationResult<void, Error, { messageId: string; emoji: string }>;
  removeReaction: UseMutationResult<void, Error, { messageId: string; emoji: string }>;
  toggleReaction: (messageId: string, emoji: string, currentUserId: string) => Promise<void>;
  getGroupedReactions: (messageId: string, currentUserId: string) => GroupedReaction[];
};
export function useReadReceipts(conversationId: string | null, currentUserId: string): {
  participants: Participant[];
  isLoading: boolean;
  getReadByUsers: (...) => ReadReceiptUser[];
  getMessageReadReceipts: (...) => ReadReceiptUser[];
  isReadByAll: (...) => boolean;
};
export function useGroupParticipants(conversationId: string | null): {
  addParticipants: UseMutationResult<void, Error, string[]>;
  removeParticipant: UseMutationResult<void, Error, string>;
  leaveGroup:        UseMutationResult<void, Error, void>;
};
export function useChatNotifications(): void;            // side-effect only
export function useTabNotifications(): number;
```

### 4.3 Realtime channels

| Channel                                        | Purpose                              |
|-------------------------------------------------|--------------------------------------|
| `chat-conversations-changes`                    | INSERT/UPDATE/DELETE on `chat_messages` and `chat_participants`; invalidates the conversation list query. |
| `chat-messages-${conversationId}`               | INSERT/UPDATE/DELETE filtered by `conversation_id`; updates message cache. |
| `chat-reactions-${conversationId}`              | * on `chat_message_reactions`; refetches reactions. |
| `read-receipts-${conversationId}`               | UPDATE on `chat_participants` filtered by conv id; refetches participant `last_read_at`. |
| `chat-toast-notifications`                      | Global INSERT on `chat_messages`; produces toast + browser notification. |

All channels are gated on `useBusinessHours().liveUpdatesActive` so realtime is silent during quiet hours (9:30 AM – 8:00 PM IST) per the cost-reduction work shipped 2026-05-04.

### 4.4 Routing

```tsx
<Route path="/chat" element={<Chat />} />
<Route path="/chat/:conversationId" element={<Chat />} />
```

### 4.5 Sidebar entry (fallback navigation)

`AppSidebar.tsx` had this in the TASKS section:
```ts
{ title: "Team Chat", url: "/chat", icon: MessageCircle }
```
plus a matching row in the DB-driven `navigation_items` table.

### 4.6 AppLayout integration

```tsx
import { FloatingChatWidget } from "@/components/chat/FloatingChatWidget";
import { PushNotificationPermission } from "@/components/chat/PushNotificationPermission";
import { useChatNotifications } from "@/hooks/useChatNotifications";
import { useTabNotifications } from "@/hooks/useTabNotifications";

export function AppLayout() {
  useChatNotifications();
  useTabNotifications();
  // ...
  return (
    <>
      {/* main shell */}
      <FloatingChatWidget />
      <PushNotificationPermission />
    </>
  );
}
```

### 4.7 NotificationBell deep-link

```ts
if (notification.conversation_id) {
  navigate(`/chat/${notification.conversation_id}`);
}
```

---

## 5. Edge functions

### `send-push-notification`
Path: `supabase/functions/send-push-notification/`. Accepts `{ user_id, title, body, data? }`, looks up rows in `push_subscriptions`, and forwards to FCM (using `FCM_SERVER_KEY`) for `ios`/`android` tokens. Web platform falls back to client-side realtime. Removed entirely with chat.

### `export-backup`
Modified to drop `'chat_conversations'`, `'chat_message_reactions'`, `'chat_messages'`, `'chat_participants'`, and `'push_subscriptions'` from its table list (`TABLES_WITH_UPDATED_AT` and the fallback `tableNames`).

---

## 6. Other touchpoints

- **`src/pages/DataExport.tsx`** — `ALL_TABLES` array included the four chat tables and `push_subscriptions`.
- **`supabase/import_data.sql`** — historical seed import had four `\copy` lines for the chat tables.
- **`src/integrations/supabase/types.ts`** — auto-generated; regenerated on next `supabase gen types`.

---

## 7. Removal manifest (what was deleted)

### Frontend files removed
- `src/pages/Chat.tsx`
- All of `src/components/chat/` (20 files)
- `src/hooks/useConversations.ts`
- `src/hooks/useMessages.ts`
- `src/hooks/useChatFileUpload.ts`
- `src/hooks/useMessageReactions.ts`
- `src/hooks/useReadReceipts.ts`
- `src/hooks/useGroupParticipants.ts`
- `src/hooks/useChatNotifications.ts`
- `src/hooks/useTabNotifications.ts`
- `src/services/pushNotifications.ts`
- `docs/CHAT-IMPLEMENTATION-GUIDE.md` (superseded by this archive)

### Frontend files edited
- `src/App.tsx` — removed `Chat` import and the two `/chat` routes.
- `src/components/AppLayout.tsx` — removed `FloatingChatWidget`, `PushNotificationPermission`, `useChatNotifications`, `useTabNotifications`.
- `src/components/AppSidebar.tsx` — removed `"Team Chat"` row from the TASKS section in `fallbackNavigationSections`.
- `src/components/NotificationBell.tsx` — removed the `conversation_id` deep-link branch.
- `src/pages/DataExport.tsx` — removed chat tables and `push_subscriptions` from `ALL_TABLES`.

### Backend objects dropped (via removal migration)
- Tables: `chat_message_reactions`, `chat_messages`, `chat_participants`, `chat_conversations`, `push_subscriptions` (all CASCADE).
- Functions: `is_participant_in_conversation`, `get_user_conversation_ids`, `update_conversation_last_message`, `create_chat_message_notification`, `get_conversation_meta`.
- Trigger functions cascade with their tables. Standalone `update_updated_at_column` is shared and is left in place.
- Storage: bucket `chat-attachments` and its three storage policies.
- Realtime publications drop with their parent tables.
- `notifications.conversation_id` column dropped; `idx_notifications_conversation` dropped.
- `notifications.notification_type` CHECK rebuilt without `'chat_message'`.
- `navigation_items` rows where `item_url IN ('/chat', '/chat/:conversationId')` deleted.

### Backend files edited
- `supabase/functions/export-backup/index.ts` — removed five table names.
- `supabase/import_data.sql` — removed four `\copy` lines.

### Backend files removed
- `supabase/functions/send-push-notification/` (entire function).

---

## 8. Rebuild guide

To re-introduce chat in the future:

1. **Apply schema** — re-create the five tables, indexes, RLS, helper functions, triggers, storage bucket, and realtime publications from §3.
2. **Restore the `get_conversation_meta` RPC** from §3.5 — it is the load-bearing performance optimization for the conversation list.
3. **Re-add `notifications.conversation_id`** column + index, and re-add `'chat_message'` to the type CHECK.
4. **Recreate the frontend** per the file map and hook contracts in §4. Key gotchas:
   - Use the SECURITY DEFINER helpers in RLS — recursive policies cause infinite-recursion errors that look like RLS denials.
   - Set `REPLICA IDENTITY FULL` on `chat_messages` for realtime UPDATE/DELETE payloads.
   - Optimistic message updates need a temporary `id` (`temp-${Date.now()}`) which is replaced when the INSERT returns the real row.
   - The conversation list and the message thread are separate queries with different invalidation rules — keep them separated.
   - Quiet-hours: the existing project gates realtime via `useBusinessHours().liveUpdatesActive`; chat hooks must respect this to keep the cost-reduction work intact.
5. **Restore the deploy hooks** — re-add chat tables to `export-backup` and `DataExport.tsx`. Re-deploy `send-push-notification` if native push is needed.
6. **Re-add navigation** — both the sidebar fallback row and the DB-driven `navigation_items` row.

The original implementation guide (now archived) had additional design notes on the floating widget animation, sizing, and component tree. Those were preserved verbatim above as much as practical; if rebuilding, also consult the git history of `docs/CHAT-IMPLEMENTATION-GUIDE.md` for the pre-removal text.

---

*Archive written 2026-05-06 by the team in the same session that performed the removal.*
