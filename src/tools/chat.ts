/**
 * Chat API v0 tools — messaging, users, groups, meetings, transcripts, app.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { roamGet, roamPost, handleApiError } from "../services/api-client.js";
import { DEFAULT_LIMIT, MAX_LIMIT, CHARACTER_LIMIT } from "../constants.js";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function truncate(text: string): string {
  return text.length > CHARACTER_LIMIT ? text.slice(0, CHARACTER_LIMIT) + "\n…truncated" : text;
}

function json(data: unknown): string {
  return truncate(JSON.stringify(data, null, 2));
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

// Chat
const ChatListSchema = z.object({
  limit: z.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT).describe("Max results"),
  cursor: z.string().optional().describe("Pagination cursor"),
}).strict();

const ChatPostSchema = z.object({
  chat_id: z.string().describe("Chat / group address ID"),
  text: z.string().optional().describe("Markdown message text (exclusive with blocks/poll)"),
  blocks: z.array(z.unknown()).optional().describe("Block Kit blocks array (max 10 blocks, 8 KB)"),
  poll: z.object({
    question: z.string().describe("Poll question"),
    options: z.array(z.string()).min(2).describe("Poll answer options"),
  }).optional().describe("Poll object (exclusive with text/blocks)"),
  thread_timestamp: z.string().optional().describe("Thread timestamp for replies"),
  thread_key: z.string().max(64).optional().describe("External thread key (max 64 chars)"),
}).strict();

const ChatUpdateSchema = z.object({
  chat_id: z.string().describe("Chat / group address ID"),
  message_id: z.string().describe("Message ID to update"),
  text: z.string().optional().describe("Updated text"),
  blocks: z.array(z.unknown()).optional().describe("Updated blocks"),
}).strict();

const ChatDeleteSchema = z.object({
  chat_id: z.string().describe("Chat / group address ID"),
  message_id: z.string().describe("Message ID to delete"),
}).strict();

const ChatTypingSchema = z.object({
  chat_id: z.string().describe("Chat / group address ID"),
}).strict();

const ChatHistorySchema = z.object({
  chat_id: z.string().describe("Chat / group address ID"),
  before: z.string().optional().describe("Fetch messages before this timestamp"),
  after: z.string().optional().describe("Fetch messages after this timestamp"),
  limit: z.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT).describe("Max results"),
  cursor: z.string().optional().describe("Pagination cursor"),
}).strict();

const ReactionAddSchema = z.object({
  chat_id: z.string().describe("Chat / group address ID"),
  message_id: z.string().describe("Message ID"),
  emoji: z.string().describe("Emoji shortcode, e.g. thumbsup"),
}).strict();

// Users
const UserListSchema = z.object({
  limit: z.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT).describe("Max results"),
  cursor: z.string().optional().describe("Pagination cursor"),
}).strict();

const UserInfoSchema = z.object({
  user_id: z.string().describe("User address ID"),
}).strict();

const UserLookupSchema = z.object({
  email: z.string().email().describe("Email to look up"),
}).strict();

const AddrInfoSchema = z.object({
  address_id: z.string().describe("Chat address ID"),
}).strict();

const AuditLogSchema = z.object({
  limit: z.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT).describe("Max results"),
  cursor: z.string().optional().describe("Pagination cursor"),
}).strict();

// Groups
const GroupCreateSchema = z.object({
  name: z.string().min(1).describe("Group name"),
  members: z.array(z.string()).optional().describe("Member address IDs"),
  admins: z.array(z.string()).optional().describe("Admin address IDs"),
}).strict();

const GroupRenameSchema = z.object({
  group_id: z.string().describe("Group address ID"),
  name: z.string().min(1).describe("New group name"),
}).strict();

const GroupArchiveSchema = z.object({
  group_id: z.string().describe("Group address ID"),
}).strict();

const GroupMembersSchema = z.object({
  group_id: z.string().describe("Group address ID"),
  limit: z.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT).describe("Max results"),
  cursor: z.string().optional().describe("Pagination cursor"),
}).strict();

const GroupAddSchema = z.object({
  group_id: z.string().describe("Group address ID"),
  members: z.array(z.string()).optional().describe("Member address IDs to add"),
  admins: z.array(z.string()).optional().describe("Admin address IDs to add"),
}).strict();

const GroupRemoveSchema = z.object({
  group_id: z.string().describe("Group address ID"),
  members: z.array(z.string()).describe("Member address IDs to remove"),
}).strict();

// Meetings & Transcripts
const MeetingListSchema = z.object({
  limit: z.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT).describe("Max results"),
  cursor: z.string().optional().describe("Pagination cursor"),
}).strict();

const MeetingLinkCreateSchema = z.object({
  title: z.string().optional().describe("Meeting link title"),
}).strict();

const MeetingLinkInfoSchema = z.object({
  meeting_link_id: z.string().describe("Meeting link ID"),
}).strict();

const MeetingLinkUpdateSchema = z.object({
  meeting_link_id: z.string().describe("Meeting link ID"),
  title: z.string().optional().describe("Updated title"),
}).strict();

const TranscriptListSchema = z.object({
  after: z.string().optional().describe("Start date filter"),
  before: z.string().optional().describe("End date filter"),
  limit: z.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT).describe("Max results"),
  cursor: z.string().optional().describe("Pagination cursor"),
}).strict();

const TranscriptInfoSchema = z.object({
  transcript_id: z.string().describe("Transcript ID"),
}).strict();

const TranscriptPromptSchema = z.object({
  transcript_id: z.string().describe("Transcript ID"),
  prompt: z.string().describe("AI prompt to query the transcript"),
}).strict();

const LobbyListSchema = z.object({}).strict();

const LobbyBookingListSchema = z.object({
  limit: z.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT).describe("Max results"),
  cursor: z.string().optional().describe("Pagination cursor"),
}).strict();

// App
const TokenInfoSchema = z.object({}).strict();

const AppUninstallSchema = z.object({}).strict();

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerChatTools(server: McpServer): void {
  const V0 = "v0" as const;

  // ─── Chat & Messaging ───

  server.registerTool("roam_chat_list", {
    title: "List Chats",
    description: "List all accessible chats (DMs, MultiDMs, Channels). Requires scope chat:read.",
    inputSchema: ChatListSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const q: Record<string, unknown> = { limit: params.limit };
      if (params.cursor) q.cursor = params.cursor;
      const data = await roamGet<unknown>("/chat.list", q, V0);
      return { content: [{ type: "text" as const, text: json(data) }] };
    } catch (e) { return { content: [{ type: "text" as const, text: handleApiError(e) }] }; }
  });

  server.registerTool("roam_chat_post", {
    title: "Post Chat Message",
    description:
      "Post a message to a chat. Supports markdown text, Block Kit, or polls (mutually exclusive). " +
      "Requires scope chat:write. Use thread_timestamp or thread_key to reply in a thread.",
    inputSchema: ChatPostSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async (params) => {
    try {
      const body: Record<string, unknown> = { chatId: params.chat_id };
      if (params.text) body.text = params.text;
      if (params.blocks) body.blocks = params.blocks;
      if (params.poll) body.poll = params.poll;
      if (params.thread_timestamp) body.threadTimestamp = params.thread_timestamp;
      if (params.thread_key) body.threadKey = params.thread_key;
      const data = await roamPost<unknown>("/chat.post", body, V0);
      return { content: [{ type: "text" as const, text: json(data) }] };
    } catch (e) { return { content: [{ type: "text" as const, text: handleApiError(e) }] }; }
  });

  server.registerTool("roam_chat_update", {
    title: "Update Chat Message",
    description: "Update a previously posted bot message. Requires scope chat:write.",
    inputSchema: ChatUpdateSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const body: Record<string, unknown> = { chatId: params.chat_id, messageId: params.message_id };
      if (params.text) body.text = params.text;
      if (params.blocks) body.blocks = params.blocks;
      const data = await roamPost<unknown>("/chat.update", body, V0);
      return { content: [{ type: "text" as const, text: json(data) }] };
    } catch (e) { return { content: [{ type: "text" as const, text: handleApiError(e) }] }; }
  });

  server.registerTool("roam_chat_delete", {
    title: "Delete Chat Message",
    description: "Delete a bot-authored message. Requires scope chat:write.",
    inputSchema: ChatDeleteSchema,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      await roamPost<unknown>("/chat.delete", { chatId: params.chat_id, messageId: params.message_id }, V0);
      return { content: [{ type: "text" as const, text: `Message ${params.message_id} deleted.` }] };
    } catch (e) { return { content: [{ type: "text" as const, text: handleApiError(e) }] }; }
  });

  server.registerTool("roam_chat_typing", {
    title: "Send Typing Indicator",
    description: "Show a typing indicator in a chat. Requires scope chat:write.",
    inputSchema: ChatTypingSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      await roamPost<unknown>("/chat.typing", { chatId: params.chat_id }, V0);
      return { content: [{ type: "text" as const, text: "Typing indicator sent." }] };
    } catch (e) { return { content: [{ type: "text" as const, text: handleApiError(e) }] }; }
  });

  server.registerTool("roam_chat_history", {
    title: "Get Chat History",
    description: "Retrieve message history for a chat with optional date filtering. Requires scope chat:read.",
    inputSchema: ChatHistorySchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const q: Record<string, unknown> = { chatId: params.chat_id, limit: params.limit };
      if (params.before) q.before = params.before;
      if (params.after) q.after = params.after;
      if (params.cursor) q.cursor = params.cursor;
      const data = await roamGet<unknown>("/chat.history", q, V0);
      return { content: [{ type: "text" as const, text: json(data) }] };
    } catch (e) { return { content: [{ type: "text" as const, text: handleApiError(e) }] }; }
  });

  server.registerTool("roam_reaction_add", {
    title: "Add Reaction",
    description: "Add an emoji reaction to a message. Requires scope chat:write.",
    inputSchema: ReactionAddSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      await roamPost<unknown>("/reaction.add", { chatId: params.chat_id, messageId: params.message_id, emoji: params.emoji }, V0);
      return { content: [{ type: "text" as const, text: `Reaction :${params.emoji}: added.` }] };
    } catch (e) { return { content: [{ type: "text" as const, text: handleApiError(e) }] }; }
  });

  // ─── Users ───

  server.registerTool("roam_user_list", {
    title: "List Users",
    description: "List all users in the account. Requires scope user:read.",
    inputSchema: UserListSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const q: Record<string, unknown> = { limit: params.limit };
      if (params.cursor) q.cursor = params.cursor;
      const data = await roamGet<unknown>("/user.list", q, V0);
      return { content: [{ type: "text" as const, text: json(data) }] };
    } catch (e) { return { content: [{ type: "text" as const, text: handleApiError(e) }] }; }
  });

  server.registerTool("roam_user_info", {
    title: "Get User Info",
    description: "Get details for a single user by address ID. Requires scope user:read.",
    inputSchema: UserInfoSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const data = await roamGet<unknown>("/user.info", { userId: params.user_id }, V0);
      return { content: [{ type: "text" as const, text: json(data) }] };
    } catch (e) { return { content: [{ type: "text" as const, text: handleApiError(e) }] }; }
  });

  server.registerTool("roam_user_lookup", {
    title: "Lookup User by Email",
    description: "Find a user by email address. Requires scope user:read.",
    inputSchema: UserLookupSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const data = await roamGet<unknown>("/user.lookup", { email: params.email }, V0);
      return { content: [{ type: "text" as const, text: json(data) }] };
    } catch (e) { return { content: [{ type: "text" as const, text: handleApiError(e) }] }; }
  });

  server.registerTool("roam_addr_info", {
    title: "Get Address Info",
    description: "Get chat address information. Requires scope user:read.",
    inputSchema: AddrInfoSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const data = await roamGet<unknown>("/addr.info", { addressId: params.address_id }, V0);
      return { content: [{ type: "text" as const, text: json(data) }] };
    } catch (e) { return { content: [{ type: "text" as const, text: handleApiError(e) }] }; }
  });

  server.registerTool("roam_audit_log", {
    title: "List Audit Log",
    description: "Retrieve user audit log entries. Requires scope admin:audit:read.",
    inputSchema: AuditLogSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const q: Record<string, unknown> = { limit: params.limit };
      if (params.cursor) q.cursor = params.cursor;
      const data = await roamGet<unknown>("/userauditlog.list", q, V0);
      return { content: [{ type: "text" as const, text: json(data) }] };
    } catch (e) { return { content: [{ type: "text" as const, text: handleApiError(e) }] }; }
  });

  // ─── Groups ───

  server.registerTool("roam_group_create", {
    title: "Create Group",
    description: "Create a new group with optional initial members and admins. Requires scope group:write.",
    inputSchema: GroupCreateSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async (params) => {
    try {
      const body: Record<string, unknown> = { name: params.name };
      if (params.members) body.members = params.members;
      if (params.admins) body.admins = params.admins;
      const data = await roamPost<unknown>("/group.create", body, V0);
      return { content: [{ type: "text" as const, text: json(data) }] };
    } catch (e) { return { content: [{ type: "text" as const, text: handleApiError(e) }] }; }
  });

  server.registerTool("roam_group_rename", {
    title: "Rename Group",
    description: "Rename an existing group. Requires scope group:write.",
    inputSchema: GroupRenameSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const data = await roamPost<unknown>("/group.rename", { groupId: params.group_id, name: params.name }, V0);
      return { content: [{ type: "text" as const, text: json(data) }] };
    } catch (e) { return { content: [{ type: "text" as const, text: handleApiError(e) }] }; }
  });

  server.registerTool("roam_group_archive", {
    title: "Archive Group",
    description: "Archive a group. This is destructive. Requires scope group:write.",
    inputSchema: GroupArchiveSchema,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      await roamPost<unknown>("/group.archive", { groupId: params.group_id }, V0);
      return { content: [{ type: "text" as const, text: `Group ${params.group_id} archived.` }] };
    } catch (e) { return { content: [{ type: "text" as const, text: handleApiError(e) }] }; }
  });

  server.registerTool("roam_group_members", {
    title: "List Group Members",
    description: "List members of a group. Requires scope group:read or chat:read.",
    inputSchema: GroupMembersSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const q: Record<string, unknown> = { groupId: params.group_id, limit: params.limit };
      if (params.cursor) q.cursor = params.cursor;
      const data = await roamGet<unknown>("/group.members", q, V0);
      return { content: [{ type: "text" as const, text: json(data) }] };
    } catch (e) { return { content: [{ type: "text" as const, text: handleApiError(e) }] }; }
  });

  server.registerTool("roam_group_add_members", {
    title: "Add Group Members",
    description: "Add members or admins to a group. Requires scope group:write.",
    inputSchema: GroupAddSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const body: Record<string, unknown> = { groupId: params.group_id };
      if (params.members) body.members = params.members;
      if (params.admins) body.admins = params.admins;
      const data = await roamPost<unknown>("/group.add", body, V0);
      return { content: [{ type: "text" as const, text: json(data) }] };
    } catch (e) { return { content: [{ type: "text" as const, text: handleApiError(e) }] }; }
  });

  server.registerTool("roam_group_remove_members", {
    title: "Remove Group Members",
    description: "Remove members from a group. Requires scope group:write.",
    inputSchema: GroupRemoveSchema,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const data = await roamPost<unknown>("/group.remove", { groupId: params.group_id, members: params.members }, V0);
      return { content: [{ type: "text" as const, text: json(data) }] };
    } catch (e) { return { content: [{ type: "text" as const, text: handleApiError(e) }] }; }
  });

  // ─── Meetings & Transcripts ───

  server.registerTool("roam_meeting_list", {
    title: "List Meetings",
    description: "List meetings with participant info. Requires scope meeting:read.",
    inputSchema: MeetingListSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const q: Record<string, unknown> = { limit: params.limit };
      if (params.cursor) q.cursor = params.cursor;
      const data = await roamGet<unknown>("/meeting.list", q, V0);
      return { content: [{ type: "text" as const, text: json(data) }] };
    } catch (e) { return { content: [{ type: "text" as const, text: handleApiError(e) }] }; }
  });

  server.registerTool("roam_meetinglink_create", {
    title: "Create Meeting Link",
    description: "Generate a shareable meeting link. Requires scope meeting:write.",
    inputSchema: MeetingLinkCreateSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async (params) => {
    try {
      const body: Record<string, unknown> = {};
      if (params.title) body.title = params.title;
      const data = await roamPost<unknown>("/meetinglink.create", body, V0);
      return { content: [{ type: "text" as const, text: json(data) }] };
    } catch (e) { return { content: [{ type: "text" as const, text: handleApiError(e) }] }; }
  });

  server.registerTool("roam_meetinglink_info", {
    title: "Get Meeting Link Info",
    description: "Retrieve details for a meeting link. Requires scope meeting:read.",
    inputSchema: MeetingLinkInfoSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const data = await roamPost<unknown>("/meetinglink.info", { meetingLinkId: params.meeting_link_id }, V0);
      return { content: [{ type: "text" as const, text: json(data) }] };
    } catch (e) { return { content: [{ type: "text" as const, text: handleApiError(e) }] }; }
  });

  server.registerTool("roam_meetinglink_update", {
    title: "Update Meeting Link",
    description: "Update a meeting link's properties. Requires scope meeting:write.",
    inputSchema: MeetingLinkUpdateSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const body: Record<string, unknown> = { meetingLinkId: params.meeting_link_id };
      if (params.title) body.title = params.title;
      const data = await roamPost<unknown>("/meetinglink.update", body, V0);
      return { content: [{ type: "text" as const, text: json(data) }] };
    } catch (e) { return { content: [{ type: "text" as const, text: handleApiError(e) }] }; }
  });

  server.registerTool("roam_transcript_list", {
    title: "List Transcripts",
    description: "List meeting transcripts with optional date filtering. Requires scope transcript:read.",
    inputSchema: TranscriptListSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const q: Record<string, unknown> = { limit: params.limit };
      if (params.after) q.after = params.after;
      if (params.before) q.before = params.before;
      if (params.cursor) q.cursor = params.cursor;
      const data = await roamGet<unknown>("/transcript.list", q, V0);
      return { content: [{ type: "text" as const, text: json(data) }] };
    } catch (e) { return { content: [{ type: "text" as const, text: handleApiError(e) }] }; }
  });

  server.registerTool("roam_transcript_info", {
    title: "Get Transcript",
    description: "Get the full transcript with summary for a meeting. Requires scope transcript:read.",
    inputSchema: TranscriptInfoSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const data = await roamGet<unknown>("/transcript.info", { transcriptId: params.transcript_id }, V0);
      return { content: [{ type: "text" as const, text: json(data) }] };
    } catch (e) { return { content: [{ type: "text" as const, text: handleApiError(e) }] }; }
  });

  server.registerTool("roam_transcript_prompt", {
    title: "Query Transcript with AI",
    description: "Ask an AI-powered question against a transcript. Requires scope transcript:read.",
    inputSchema: TranscriptPromptSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const data = await roamPost<unknown>("/transcript.prompt", { transcriptId: params.transcript_id, prompt: params.prompt }, V0);
      return { content: [{ type: "text" as const, text: json(data) }] };
    } catch (e) { return { content: [{ type: "text" as const, text: handleApiError(e) }] }; }
  });

  server.registerTool("roam_lobby_list", {
    title: "List Lobbies",
    description: "List active lobby configurations. Requires scope meeting:read.",
    inputSchema: LobbyListSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async () => {
    try {
      const data = await roamGet<unknown>("/lobby.list", {}, V0);
      return { content: [{ type: "text" as const, text: json(data) }] };
    } catch (e) { return { content: [{ type: "text" as const, text: handleApiError(e) }] }; }
  });

  server.registerTool("roam_lobby_booking_list", {
    title: "List Lobby Bookings",
    description: "List lobby reservations. Requires scope meeting:read.",
    inputSchema: LobbyBookingListSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const q: Record<string, unknown> = { limit: params.limit };
      if (params.cursor) q.cursor = params.cursor;
      const data = await roamGet<unknown>("/lobbyBooking.list", q, V0);
      return { content: [{ type: "text" as const, text: json(data) }] };
    } catch (e) { return { content: [{ type: "text" as const, text: handleApiError(e) }] }; }
  });

  // ─── App Management ───

  server.registerTool("roam_token_info", {
    title: "Get Token Info",
    description: "Retrieve metadata and scopes for the current API token.",
    inputSchema: TokenInfoSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async () => {
    try {
      const data = await roamGet<unknown>("/token.info", {}, V0);
      return { content: [{ type: "text" as const, text: json(data) }] };
    } catch (e) { return { content: [{ type: "text" as const, text: handleApiError(e) }] }; }
  });

  server.registerTool("roam_app_uninstall", {
    title: "Uninstall App",
    description: "Revoke access and remove the integration from the Roam organization. This is destructive and irreversible.",
    inputSchema: AppUninstallSchema,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  }, async () => {
    try {
      await roamPost<unknown>("/app.uninstall", {}, V0);
      return { content: [{ type: "text" as const, text: "App uninstalled successfully." }] };
    } catch (e) { return { content: [{ type: "text" as const, text: handleApiError(e) }] }; }
  });
}
