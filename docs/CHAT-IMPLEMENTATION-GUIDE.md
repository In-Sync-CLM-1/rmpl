 # Chat System Implementation Guide
 
 A comprehensive guide for implementing the real-time chat functionality in another project. This system supports 1:1 conversations, group chats, file attachments, emoji reactions, read receipts, task sharing, and push notifications.
 
 ---
 
 ## Table of Contents
 
 1. [Technology Stack](#technology-stack)
 2. [Database Schema](#database-schema)
 3. [Storage Configuration](#storage-configuration)
 4. [Hooks (Business Logic)](#hooks-business-logic)
 5. [UI Components](#ui-components)
6. [Floating Chat Widget](#floating-chat-widget)
7. [Real-time Subscriptions](#real-time-subscriptions)
8. [Notifications System](#notifications-system)
9. [Implementation Checklist](#implementation-checklist)
 
 ---
 
 ## Technology Stack
 
 | Technology | Purpose |
 |------------|---------|
 | **React 18** | UI Framework |
 | **TypeScript** | Type Safety |
 | **Supabase** | Backend (Auth, Database, Storage, Realtime) |
 | **TanStack Query** | Server State Management |
 | **Tailwind CSS** | Styling |
 | **shadcn/ui** | UI Components |
 | **date-fns** | Date Formatting |
 | **emoji-picker-react** | Emoji Selection |
 | **Capacitor** | Native Mobile Push Notifications |
 
 ---
 
 ## Database Schema
 
 ### Tables Required
 
 #### 1. `chat_conversations`
 Stores conversation metadata.
 
 ```sql
 CREATE TABLE public.chat_conversations (
   id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
   conversation_type TEXT NOT NULL DEFAULT 'direct', -- 'direct' or 'group'
   name TEXT, -- Group name (null for direct conversations)
   created_by UUID REFERENCES public.profiles(id),
   last_message_at TIMESTAMPTZ DEFAULT now(),
   created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
   updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
 );
 
 -- Enable RLS
 ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
 
 -- Enable realtime
 ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;
 ```
 
 #### 2. `chat_participants`
 Links users to conversations they belong to.
 
 ```sql
 CREATE TABLE public.chat_participants (
   id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
   conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
   user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
   is_admin BOOLEAN DEFAULT false,
   last_read_at TIMESTAMPTZ DEFAULT now(),
   joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
   UNIQUE(conversation_id, user_id)
 );
 
 -- Enable RLS
 ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
 
 -- Enable realtime
 ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participants;
 ```
 
 #### 3. `chat_messages`
 Stores individual messages.
 
 ```sql
 CREATE TABLE public.chat_messages (
   id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
   conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
   sender_id UUID NOT NULL REFERENCES public.profiles(id),
   content TEXT,
   message_type TEXT NOT NULL DEFAULT 'text', -- 'text', 'file', 'task_share'
   task_id UUID REFERENCES public.general_tasks(id), -- For task sharing
   project_task_id UUID REFERENCES public.project_tasks(id), -- For project task sharing
   file_url TEXT,
   file_name TEXT,
   file_size INTEGER,
   is_edited BOOLEAN DEFAULT false,
   created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
   updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
 );
 
 -- Enable RLS
 ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
 
 -- Enable realtime
 ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
 
 -- Create index for faster queries
 CREATE INDEX idx_chat_messages_conversation_id ON public.chat_messages(conversation_id);
 CREATE INDEX idx_chat_messages_created_at ON public.chat_messages(created_at DESC);
 ```
 
 #### 4. `chat_message_reactions`
 Stores emoji reactions on messages.
 
 ```sql
 CREATE TABLE public.chat_message_reactions (
   id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
   message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
   user_id UUID NOT NULL REFERENCES public.profiles(id),
   emoji TEXT NOT NULL,
   created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
   UNIQUE(message_id, user_id, emoji)
 );
 
 -- Enable RLS
 ALTER TABLE public.chat_message_reactions ENABLE ROW LEVEL SECURITY;
 
 -- Enable realtime
 ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_message_reactions;
 ```
 
 #### 5. `push_subscriptions` (Optional - for native push)
 Stores device tokens for push notifications.
 
 ```sql
 CREATE TABLE public.push_subscriptions (
   id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
   user_id UUID NOT NULL REFERENCES public.profiles(id),
   platform TEXT NOT NULL, -- 'ios', 'android', 'web'
   token TEXT NOT NULL,
   created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
   updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
   UNIQUE(user_id, platform)
 );
 
 -- Enable RLS
 ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
 ```
 
 ### RLS Policies
 
 **CRITICAL**: Use `SECURITY DEFINER` functions to prevent infinite recursion when checking participant status.
 
 ```sql
 -- Helper function to check if user is a participant
 CREATE OR REPLACE FUNCTION public.is_participant_in_conversation(conv_id UUID, check_user_id UUID)
 RETURNS BOOLEAN
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
 AS $$
 BEGIN
   RETURN EXISTS (
     SELECT 1 FROM chat_participants
     WHERE conversation_id = conv_id AND user_id = check_user_id
   );
 END;
 $$;
 
 -- Conversation policies
 CREATE POLICY "Users can view conversations they participate in"
   ON public.chat_conversations FOR SELECT
   USING (is_participant_in_conversation(id, auth.uid()));
 
 CREATE POLICY "Authenticated users can create conversations"
   ON public.chat_conversations FOR INSERT
   WITH CHECK (auth.uid() IS NOT NULL);
 
 -- Participant policies
 CREATE POLICY "Users can view participants in their conversations"
   ON public.chat_participants FOR SELECT
   USING (is_participant_in_conversation(conversation_id, auth.uid()));
 
 CREATE POLICY "Users can add participants to conversations they're in"
   ON public.chat_participants FOR INSERT
   WITH CHECK (is_participant_in_conversation(conversation_id, auth.uid()));
 
 CREATE POLICY "Users can update their own participant record"
   ON public.chat_participants FOR UPDATE
   USING (user_id = auth.uid());
 
 CREATE POLICY "Admins can remove participants"
   ON public.chat_participants FOR DELETE
   USING (
     user_id = auth.uid() -- Can leave themselves
     OR EXISTS (
       SELECT 1 FROM chat_participants
       WHERE conversation_id = chat_participants.conversation_id
         AND user_id = auth.uid()
         AND is_admin = true
     )
   );
 
 -- Message policies
 CREATE POLICY "Users can view messages in their conversations"
   ON public.chat_messages FOR SELECT
   USING (is_participant_in_conversation(conversation_id, auth.uid()));
 
 CREATE POLICY "Users can send messages to their conversations"
   ON public.chat_messages FOR INSERT
   WITH CHECK (
     sender_id = auth.uid() AND
     is_participant_in_conversation(conversation_id, auth.uid())
   );
 
 CREATE POLICY "Users can edit their own messages"
   ON public.chat_messages FOR UPDATE
   USING (sender_id = auth.uid());
 
 -- Reaction policies
 CREATE POLICY "Users can view reactions in their conversations"
   ON public.chat_message_reactions FOR SELECT
   USING (
     EXISTS (
       SELECT 1 FROM chat_messages m
       WHERE m.id = message_id
         AND is_participant_in_conversation(m.conversation_id, auth.uid())
     )
   );
 
 CREATE POLICY "Users can add reactions"
   ON public.chat_message_reactions FOR INSERT
   WITH CHECK (user_id = auth.uid());
 
 CREATE POLICY "Users can remove their reactions"
   ON public.chat_message_reactions FOR DELETE
   USING (user_id = auth.uid());
 ```
 
 ### Trigger: Update `last_message_at`
 
 ```sql
 CREATE OR REPLACE FUNCTION public.update_conversation_last_message_at()
 RETURNS TRIGGER AS $$
 BEGIN
   UPDATE chat_conversations
   SET last_message_at = NEW.created_at, updated_at = now()
   WHERE id = NEW.conversation_id;
   RETURN NEW;
 END;
 $$ LANGUAGE plpgsql SECURITY DEFINER;
 
 CREATE TRIGGER trigger_update_conversation_last_message
   AFTER INSERT ON public.chat_messages
   FOR EACH ROW
   EXECUTE FUNCTION public.update_conversation_last_message_at();
 ```
 
 ---
 
 ## Storage Configuration
 
 Create a private storage bucket for file attachments.
 
 ```sql
 -- Create bucket
 INSERT INTO storage.buckets (id, name, public)
 VALUES ('chat-attachments', 'chat-attachments', false);
 
 -- RLS policies for storage
 CREATE POLICY "Users can upload chat attachments"
   ON storage.objects FOR INSERT
   WITH CHECK (
     bucket_id = 'chat-attachments' AND
     auth.uid()::text = (storage.foldername(name))[1]
   );
 
 CREATE POLICY "Users can view chat attachments in their conversations"
   ON storage.objects FOR SELECT
   USING (bucket_id = 'chat-attachments' AND auth.uid() IS NOT NULL);
 ```
 
 **File Path Structure**: `{user_id}/{conversation_id}/{timestamp}.{extension}`
 
 **Size Limits**:
 - Images: 5MB
 - Other files: 10MB
 
 ---
 
 ## Hooks (Business Logic)
 
 ### 1. `useConversations`
 
 Manages conversation list, creation, and unread counts.
 
 **Key Features**:
 - Fetches all conversations the user participates in
 - Includes last message preview and unread count
 - Real-time subscription for new messages/participants
 - Duplicate detection for direct conversations
 
 **Location**: `src/hooks/useConversations.ts`
 
 ```typescript
 export interface Conversation {
   id: string;
   conversation_type: "direct" | "group";
   name: string | null;
   created_by: string | null;
   last_message_at: string;
   participants: {
     user_id: string;
     is_admin: boolean;
     last_read_at: string;
     profile: {
       id: string;
       full_name: string | null;
       avatar_url: string | null;
     };
   }[];
   last_message?: {
     content: string | null;
     message_type: string;
     sender_id: string;
     created_at: string;
   };
   unread_count?: number;
 }
 
 export function useConversations() {
   // Returns: { conversations, isLoading, error, createConversation }
 }
 
 export function useTotalUnreadCount() {
   // Returns total unread count for floating badge
 }
 ```
 
 ### 2. `useMessages`
 
 Handles message fetching, sending, and real-time updates.
 
 **Key Features**:
 - Optimistic updates for instant message display
 - Real-time subscription for new messages
 - Mark as read functionality
 - Supports text, file, and task_share message types
 
 **Location**: `src/hooks/useMessages.ts`
 
 ```typescript
 export interface ChatMessage {
   id: string;
   conversation_id: string;
   sender_id: string;
   content: string | null;
   message_type: "text" | "task_share" | "file";
   task_id: string | null;
   project_task_id: string | null;
   file_url: string | null;
   file_name: string | null;
   file_size: number | null;
   is_edited: boolean;
   created_at: string;
   sender?: { id: string; full_name: string | null; avatar_url: string | null };
 }
 
 export function useMessages(conversationId: string | null) {
   // Returns: { messages, isLoading, error, sendMessage, markAsRead }
 }
 ```
 
 ### 3. `useChatFileUpload`
 
 Handles file uploads to storage bucket.
 
 **Location**: `src/hooks/useChatFileUpload.ts`
 
 ```typescript
 export function useChatFileUpload() {
   // Returns: { uploadFile, getSignedUrl, isUploading, progress }
 }
 ```
 
 ### 4. `useMessageReactions`
 
 Manages emoji reactions with real-time updates.
 
 **Location**: `src/hooks/useMessageReactions.ts`
 
 ```typescript
 export function useMessageReactions(conversationId: string | null) {
   // Returns: { reactions, toggleReaction, getGroupedReactions }
 }
 ```
 
 ### 5. `useReadReceipts`
 
 Tracks who has read which messages.
 
 **Location**: `src/hooks/useReadReceipts.ts`
 
 ```typescript
 export function useReadReceipts(conversationId: string | null, currentUserId: string) {
   // Returns: { getMessageReadReceipts, isReadByAll }
 }
 ```
 
 ### 6. `useGroupParticipants`
 
 Handles group management (add/remove members, leave group).
 
 **Location**: `src/hooks/useGroupParticipants.ts`
 
 ```typescript
 export function useGroupParticipants(conversationId: string | null) {
   // Returns: { addParticipants, removeParticipant, leaveGroup }
 }
 ```
 
 ### 7. `useChatNotifications`
 
 Global subscription for toast notifications when new messages arrive.
 
 **Location**: `src/hooks/useChatNotifications.ts`
 
 ```typescript
 export function useChatNotifications() {
   // No return - side effect hook
   // Shows toast notifications for messages in non-active conversations
 }
 ```
 
 ---
 
 ## UI Components
 
 ### Component Tree
 
 ```
 Chat (Page)
 ├── ConversationList
 │   ├── Search Input
 │   ├── Conversation Items (with unread badges)
 │   └── NewConversationDialog
 │       ├── Direct Tab (single user selection)
 │       ├── Group Tab (multi-select + name)
 │       └── Teams Tab (broadcast to team)
 │
 ├── ChatHeader
 │   ├── Avatar / Group Icon
 │   ├── Name / Participant Count
 │   └── Dropdown Menu (View Participants, Add Members, Leave)
 │       ├── GroupParticipantsSheet
 │       └── AddParticipantsDialog
 │
 ├── MessageThread
 │   ├── Date Dividers
 │   ├── Message Bubbles
 │   │   ├── Text Content
 │   │   ├── FileAttachment (image/video preview + lightbox)
 │   │   ├── TaskShareCard
 │   │   ├── ReactionPicker (on hover)
 │   │   ├── MessageReactions
 │   │   └── ReadReceipts
 │   └── Auto-scroll to bottom
 │
 └── MessageInput
     ├── File Attachment Button
     ├── Task Picker Button
     ├── Auto-expanding Textarea
     ├── Pending File Preview
     └── Send Button
 
 FloatingChatButton (Global)
 └── Unread Badge
 ```
 
 ### Component Locations
 
 | Component | Path |
 |-----------|------|
 | Chat Page | `src/pages/Chat.tsx` |
 | ConversationList | `src/components/chat/ConversationList.tsx` |
 | NewConversationDialog | `src/components/chat/NewConversationDialog.tsx` |
 | ChatHeader | `src/components/chat/ChatHeader.tsx` |
 | MessageThread | `src/components/chat/MessageThread.tsx` |
 | MessageInput | `src/components/chat/MessageInput.tsx` |
 | FileAttachment | `src/components/chat/FileAttachment.tsx` |
 | TaskShareCard | `src/components/chat/TaskShareCard.tsx` |
 | MessageReactions | `src/components/chat/MessageReactions.tsx` |
 | ReactionPicker | `src/components/chat/ReactionPicker.tsx` |
 | ReadReceipts | `src/components/chat/ReadReceipts.tsx` |
 | FloatingChatButton | `src/components/chat/FloatingChatButton.tsx` |
| FloatingChatWidget | `src/components/chat/FloatingChatWidget.tsx` |
| CompactConversationList | `src/components/chat/CompactConversationList.tsx` |
| CompactChatView | `src/components/chat/CompactChatView.tsx` |
| CompactChatHeader | `src/components/chat/CompactChatHeader.tsx` |
 | GroupParticipantsSheet | `src/components/chat/GroupParticipantsSheet.tsx` |
 | AddParticipantsDialog | `src/components/chat/AddParticipantsDialog.tsx` |
 | TaskPickerDialog | `src/components/chat/TaskPickerDialog.tsx` |
 | PushNotificationPermission | `src/components/chat/PushNotificationPermission.tsx` |
 
 ---
 
## Floating Chat Widget

A LinkedIn-style collapsible chat panel anchored at the bottom-right corner, enabling inline messaging without page navigation.

### Design Pattern

```text
Collapsed (Button Only)
┌──────┐
│  💬  │ ← Unread badge
└──────┘

Expanded (Conversation List)
┌────────────────────────────────────┐
│ Messages               🔗  ─  ×    │
├────────────────────────────────────┤
│ 🔍 Search...                       │
├────────────────────────────────────┤
│ 👤 John Doe           2m ago       │
│    Hey, how's it going?            │
│ 👥 Marketing          5m ago       │
│    📋 Shared a task                │
└────────────────────────────────────┘
│        [+ New Message]             │
└────────────────────────────────────┘

Expanded (Active Conversation)
┌────────────────────────────────────┐
│ ← John Doe             🔗  ─  ×    │
├────────────────────────────────────┤
│                    Hey there! ─┐   │
│                        2:30 PM     │
│  ┌─ Hi! How can I help?            │
│  │  2:31 PM                        │
├────────────────────────────────────┤
│ 📎  Type a message...       [Send] │
└────────────────────────────────────┘
```

### Widget Components

| Component | Purpose |
|-----------|---------|
| `FloatingChatWidget` | Main container with open/close state |
| `CompactConversationList` | Slimmed-down conversation list for widget |
| `CompactChatView` | Thread + input container for widget |
| `CompactChatHeader` | Minimal header with back/minimize/close |

### State Management

```typescript
// FloatingChatWidget.tsx
const [isOpen, setIsOpen] = useState(false);
const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

// Flow:
// isOpen=false → Show FloatingChatButton
// isOpen=true, activeConversationId=null → Show CompactConversationList
// isOpen=true, activeConversationId=set → Show CompactChatView
```

### Sizing and Positioning

```css
.chat-widget {
  position: fixed;
  bottom: 24px;          /* bottom-6 */
  right: 24px;           /* right-6 */
  width: 380px;
  height: 500px;
  max-height: calc(100vh - 120px);
  z-index: 50;
  border-radius: 12px;   /* rounded-xl */
  box-shadow: 0 8px 30px rgba(0,0,0,0.12);
}

/* Mobile responsive */
@media (max-width: 640px) {
  .chat-widget {
    width: calc(100vw - 32px);
    height: calc(100vh - 100px);
    bottom: 16px;
    right: 16px;
  }
}
```

### Animation

Uses framer-motion for smooth expand/collapse:

```typescript
import { motion, AnimatePresence } from "framer-motion";

<AnimatePresence>
  {isOpen && (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {/* Widget content */}
    </motion.div>
  )}
</AnimatePresence>
```

### Integration

Add to main layout (e.g., `AppLayout.tsx`):

```typescript
import { FloatingChatWidget } from "@/components/chat/FloatingChatWidget";

export function AppLayout() {
  return (
    <>
      {/* Page content */}
      <FloatingChatWidget />
    </>
  );
}
```

### Props Interfaces

```typescript
// CompactChatHeader
interface CompactChatHeaderProps {
  conversationName: string;
  conversationType: "direct" | "group";
  avatarUrl?: string | null;
  conversationId?: string | null;
  onBack?: () => void;
  onMinimize: () => void;
  onClose: () => void;
  showBack?: boolean;
}

// CompactConversationList
interface CompactConversationListProps {
  onSelectConversation: (id: string) => void;
}

// CompactChatView
interface CompactChatViewProps {
  conversationId: string;
  onBack: () => void;
  onMinimize: () => void;
  onClose: () => void;
}
```

### Features

1. **Stay on page** - Chat without navigating away from current work
2. **Minimize** - Collapse back to bubble button
3. **Open full view** - Link to `/chat` for extended sessions
4. **Search** - Filter conversations within widget
5. **Unread badges** - Visible on both button and conversation items
6. **New conversation** - Create chats directly from widget
7. **Real-time updates** - Reuses existing hooks for live messages

### Route Exclusion

The widget hides itself on the full chat page to avoid duplication:

```typescript
const location = useLocation();
if (location.pathname.startsWith("/chat")) {
  return null;
}
```

### Widget Component Tree

```text
FloatingChatWidget (Global - replaces FloatingChatButton)
├── Floating Button (when collapsed)
│   └── Unread Badge
│
└── Widget Panel (when open)
    ├── CompactChatHeader
    │   ├── Back button (if in conversation)
    │   ├── Title / Avatar
    │   ├── Open full view link
    │   ├── Minimize button
    │   └── Close button
    │
    ├── [If no active conversation]
    │   └── CompactConversationList
    │       ├── Search input
    │       ├── Conversation items (with unread badges)
    │       └── New Message button
    │
    └── [If active conversation]
        └── CompactChatView
            ├── MessageThread (reused, constrained height)
            └── MessageInput (reused)
```

---

 ## Real-time Subscriptions
 
 ### Channel Structure
 
 ```typescript
 // Conversation list updates (new messages anywhere)
 supabase
   .channel("chat-conversations-changes")
   .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, callback)
   .on("postgres_changes", { event: "*", schema: "public", table: "chat_participants" }, callback)
   .subscribe();
 
 // Messages in specific conversation
 supabase
   .channel(`chat-messages-${conversationId}`)
   .on("postgres_changes", {
     event: "INSERT",
     schema: "public",
     table: "chat_messages",
     filter: `conversation_id=eq.${conversationId}`,
   }, callback)
   .subscribe();
 
 // Reactions in conversation
 supabase
   .channel(`chat-reactions-${conversationId}`)
   .on("postgres_changes", { event: "*", schema: "public", table: "chat_message_reactions" }, callback)
   .subscribe();
 
 // Read receipts (participant updates)
 supabase
   .channel(`read-receipts-${conversationId}`)
   .on("postgres_changes", {
     event: "UPDATE",
     schema: "public",
     table: "chat_participants",
     filter: `conversation_id=eq.${conversationId}`,
   }, callback)
   .subscribe();
 
 // Global toast notifications
 supabase
   .channel("chat-toast-notifications")
   .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, callback)
   .subscribe();
 ```
 
 ### Cleanup Pattern
 
 Always remove channels on component unmount:
 
 ```typescript
 useEffect(() => {
   const channel = supabase.channel("my-channel").subscribe();
   return () => {
     supabase.removeChannel(channel);
   };
 }, []);
 ```
 
 ---
 
 ## Notifications System
 
 ### Layers
 
 1. **In-App Toast**: Using `sonner` for ephemeral notifications
 2. **Tab Badge**: Update document title with unread count `(3) App Name`
 3. **Browser Push**: Web Notification API when app is unfocused
 4. **Native Push**: Capacitor Push Notifications for mobile apps
 
 ### Browser Notifications
 
 **Location**: `src/services/pushNotifications.ts`
 
 ```typescript
 export function showBrowserNotification(payload: {
   title: string;
   body: string;
   data?: { conversation_id: string };
 }): void;
 
 export function isPushAvailable(): boolean;
 export function getNotificationPermission(): NotificationPermission;
 ```
 
 ### Tab Title Badge
 
 **Location**: `src/hooks/useTabNotifications.ts`
 
 ```typescript
 export function useTabNotifications() {
   const unreadCount = useTotalUnreadCount();
   
   useEffect(() => {
     document.title = unreadCount > 0 
       ? `(${unreadCount}) Your App` 
       : "Your App";
   }, [unreadCount]);
 }
 ```
 
 ---
 
 ## Implementation Checklist
 
 ### Phase 1: Database Setup
 
 - [ ] Create `chat_conversations` table
 - [ ] Create `chat_participants` table
 - [ ] Create `chat_messages` table
 - [ ] Create `chat_message_reactions` table
 - [ ] Create `is_participant_in_conversation` function
 - [ ] Apply all RLS policies
 - [ ] Enable realtime on all chat tables
 - [ ] Create `last_message_at` trigger
 
 ### Phase 2: Storage
 
 - [ ] Create `chat-attachments` storage bucket
 - [ ] Apply storage RLS policies
 
 ### Phase 3: Core Hooks
 
 - [ ] Implement `useConversations`
 - [ ] Implement `useMessages`
 - [ ] Implement `useChatFileUpload`
 - [ ] Implement `useMessageReactions`
 - [ ] Implement `useReadReceipts`
 - [ ] Implement `useGroupParticipants`
 
 ### Phase 4: UI Components
 
 - [ ] Create Chat page layout
 - [ ] Create ConversationList
 - [ ] Create MessageThread
 - [ ] Create MessageInput
 - [ ] Create ChatHeader
 - [ ] Create FileAttachment with previews
 - [ ] Create MessageReactions + ReactionPicker
 - [ ] Create ReadReceipts
 - [ ] Create NewConversationDialog
 - [ ] Create FloatingChatButton
 
 ### Phase 5: Notifications
 
 - [ ] Implement `useChatNotifications` hook
 - [ ] Add tab title badge
 - [ ] Request browser notification permission
 - [ ] (Optional) Set up native push with Capacitor
 
 ### Phase 6: Polish
 
 - [ ] Test real-time message delivery
 - [ ] Test file uploads (images, videos, documents)
 - [ ] Test group creation and management
 - [ ] Test read receipts
 - [ ] Test emoji reactions
 - [ ] Responsive design for mobile
 - [ ] Optimize performance with pagination if needed
 
### Phase 7: Floating Chat Widget (Optional)

- [ ] Create `FloatingChatWidget` container component
- [ ] Create `CompactChatHeader` with minimize/close controls
- [ ] Create `CompactConversationList` with search
- [ ] Create `CompactChatView` wrapper
- [ ] Add framer-motion animation
- [ ] Integrate into main layout
- [ ] Add responsive mobile styles
- [ ] Test minimize/expand behavior

 ---
 
 ## Dependencies
 
 ```bash
 npm install @supabase/supabase-js @tanstack/react-query
 npm install date-fns emoji-picker-react sonner
 npm install lucide-react class-variance-authority clsx tailwind-merge
 
 # For native mobile push (optional)
 npm install @capacitor/core @capacitor/push-notifications

# For floating widget animation
npm install framer-motion
 ```
 
 ---
 
 ## Key Architectural Decisions
 
 1. **Security Definer Functions**: Prevents RLS infinite recursion when checking participant status
 2. **Optimistic Updates**: Messages appear instantly before server confirmation
 3. **Signed URLs**: Private bucket access with time-limited URLs for file attachments
 4. **Separate Media Rendering**: Images/videos render outside message bubbles for cleaner previews
 5. **Memoized Hook Functions**: Prevents unnecessary re-renders and useEffect loops
 6. **Channel Per Conversation**: Targeted real-time subscriptions for efficiency
7. **Reusable Compact Components**: Widget components reuse existing hooks and core UI components
8. **Route-Aware Widgets**: Floating widget auto-hides on dedicated chat page to prevent duplication
 
 ---
 
 ## Common Issues & Solutions
 
 ### Issue: Messages not appearing in real-time
 **Solution**: Ensure realtime is enabled on `chat_messages` table and RLS policies allow SELECT.
 
 ### Issue: Infinite loop in useEffect
 **Solution**: Memoize functions with `useCallback` before using in dependency arrays.
 
 ### Issue: File previews not loading
 **Solution**: Verify signed URL generation and check storage bucket RLS policies.
 
 ### Issue: Can't create messages (RLS violation)
 **Solution**: Check that the `is_participant_in_conversation` function exists and has `SECURITY DEFINER`.
 
 ### Issue: Read receipts not updating
 **Solution**: Ensure `chat_participants.last_read_at` column exists and UPDATE policy allows self-updates.
 
 ---
 
 ## File Structure Overview
 
 ```
 src/
 ├── components/
 │   └── chat/
 │       ├── AddParticipantsDialog.tsx
 │       ├── ChatHeader.tsx
 │       ├── ConversationList.tsx
│       ├── CompactChatHeader.tsx
│       ├── CompactChatView.tsx
│       ├── CompactConversationList.tsx
 │       ├── FileAttachment.tsx
 │       ├── FloatingChatButton.tsx
│       ├── FloatingChatWidget.tsx
 │       ├── GroupParticipantsSheet.tsx
 │       ├── MessageInput.tsx
 │       ├── MessageReactions.tsx
 │       ├── MessageThread.tsx
 │       ├── NewConversationDialog.tsx
 │       ├── PushNotificationPermission.tsx
 │       ├── ReactionPicker.tsx
 │       ├── ReadReceipts.tsx
 │       ├── TaskPickerDialog.tsx
 │       └── TaskShareCard.tsx
 │
 ├── hooks/
 │   ├── useChatFileUpload.ts
 │   ├── useChatNotifications.ts
 │   ├── useConversations.ts
 │   ├── useGroupParticipants.ts
 │   ├── useMessageReactions.ts
 │   ├── useMessages.ts
 │   ├── useReadReceipts.ts
 │   └── useTabNotifications.ts
 │
 ├── pages/
 │   └── Chat.tsx
 │
 └── services/
     └── pushNotifications.ts
 ```
 
 ---
 
 *Last Updated: February 2025*