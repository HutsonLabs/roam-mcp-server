/**
 * Roam HQ API v1 tools — messages, groups, recordings, message-event exports, magicasts.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { roamGet, roamPost, roamPostRaw, handleApiError } from "../services/api-client.js";
import { DEFAULT_LIMIT, MAX_LIMIT, CHARACTER_LIMIT } from "../constants.js";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const SendMessageSchema = z.object({
  group_id: z.string().uuid().describe("UUID of the target group"),
  text: z.string().min(1).describe("Message text to send"),
  markdown: z.boolean().default(true).describe("Whether to parse text as Markdown"),
  sender_id: z.string().max(16).optional().describe("Custom sender ID (max 16 chars)"),
  sender_name: z.string().optional().describe("Display name for the sender"),
  sender_image_url: z.string().url().optional().describe("Avatar URL for the sender"),
}).strict();

const ListGroupsSchema = z.object({}).strict();

const ListRecordingsSchema = z.object({
  after: z.string().optional().describe("Start date filter (YYYY-MM-DD or RFC-3339)"),
  before: z.string().optional().describe("End date filter (YYYY-MM-DD or RFC-3339, default: now)"),
  limit: z.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT).describe("Max results per page"),
  cursor: z.string().optional().describe("Pagination cursor from a previous response"),
}).strict();

const ExportMessageEventsSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").describe("Date to export (YYYY-MM-DD)"),
}).strict();

const ListMagicastsSchema = z.object({
  limit: z.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT).describe("Max results per page"),
  cursor: z.string().optional().describe("Pagination cursor"),
}).strict();

const GetMagicastSchema = z.object({
  id: z.string().uuid().describe("Magicast UUID"),
}).strict();

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerRoamHqTools(server: McpServer): void {

  // --- Send Message ---
  server.registerTool(
    "roam_send_message",
    {
      title: "Send Message (HQ)",
      description:
        "Send a message to a Roam group via the v1 API. " +
        "Requires scope chat:send_message. Supports Markdown formatting and a custom sender identity.",
      inputSchema: SendMessageSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (params) => {
      try {
        const body: Record<string, unknown> = {
          recipients: [params.group_id],
          text: params.text,
          markdown: params.markdown,
        };
        if (params.sender_id || params.sender_name || params.sender_image_url) {
          body.sender = {
            ...(params.sender_id ? { id: params.sender_id } : {}),
            ...(params.sender_name ? { name: params.sender_name } : {}),
            ...(params.sender_image_url ? { imageUrl: params.sender_image_url } : {}),
          };
        }
        const result = await roamPost<{ chatId: string; status: string }>("/chat.sendMessage", body);
        return { content: [{ type: "text" as const, text: `Message sent — chatId: ${result.chatId}, status: ${result.status}` }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    }
  );

  // --- List Groups ---
  server.registerTool(
    "roam_list_groups",
    {
      title: "List Groups",
      description:
        "List all public, non-archived groups in the Roam organization. " +
        "Requires scope groups:read. Returns group name, ID, type, access mode, and creation date.",
      inputSchema: ListGroupsSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async () => {
      try {
        const groups = await roamGet<unknown[]>("/groups.list");
        const text = JSON.stringify(groups, null, 2);
        return {
          content: [{ type: "text" as const, text: text.length > CHARACTER_LIMIT ? text.slice(0, CHARACTER_LIMIT) + "\n…truncated" : text }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    }
  );

  // --- List Recordings ---
  server.registerTool(
    "roam_list_recordings",
    {
      title: "List Recordings",
      description:
        "List meeting recordings, optionally filtered by date range. " +
        "Requires scope recordings:read. Supports cursor-based pagination.",
      inputSchema: ListRecordingsSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params) => {
      try {
        const query: Record<string, unknown> = { limit: params.limit };
        if (params.after) query.after = params.after;
        if (params.before) query.before = params.before;
        if (params.cursor) query.cursor = params.cursor;
        const data = await roamGet<{ recordings: unknown[]; nextCursor?: string }>("/recording.list", query);
        const output = JSON.stringify(data, null, 2);
        return { content: [{ type: "text" as const, text: output.length > CHARACTER_LIMIT ? output.slice(0, CHARACTER_LIMIT) + "\n…truncated" : output }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    }
  );

  // --- Export Message Events ---
  server.registerTool(
    "roam_export_message_events",
    {
      title: "Export Message Events",
      description:
        "Export a full day's message events (sent, edited, deleted) in NDJSON format. " +
        "Requires scope admin:compliance:read. Returns one JSON object per line.",
      inputSchema: ExportMessageEventsSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params) => {
      try {
        const raw = await roamPostRaw("/messageevent.export", { date: params.date });
        return { content: [{ type: "text" as const, text: raw.length > CHARACTER_LIMIT ? raw.slice(0, CHARACTER_LIMIT) + "\n…truncated" : raw }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    }
  );

  // --- List Magicasts ---
  server.registerTool(
    "roam_list_magicasts",
    {
      title: "List Magicasts",
      description:
        "List all magicasts (paginated). Requires scope magicast:read.",
      inputSchema: ListMagicastsSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params) => {
      try {
        const query: Record<string, unknown> = { limit: params.limit };
        if (params.cursor) query.cursor = params.cursor;
        const data = await roamGet<{ magicasts: unknown[]; nextCursor?: string }>("/magicast.list", query);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    }
  );

  // --- Get Magicast ---
  server.registerTool(
    "roam_get_magicast",
    {
      title: "Get Magicast",
      description:
        "Retrieve details for a single magicast by UUID. Requires scope magicast:read.",
      inputSchema: GetMagicastSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params) => {
      try {
        const data = await roamGet<unknown>("/magicast.info", { id: params.id });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    }
  );
}
