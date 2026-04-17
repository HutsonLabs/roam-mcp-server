/**
 * On-Air API v1 tools — events, guests, attendance.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { roamGet, roamPost, handleApiError } from "../services/api-client.js";
import { CHARACTER_LIMIT } from "../constants.js";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const EventInfoSchema = z.object({
  event_id: z.string().describe("On-Air event ID"),
}).strict();

const EventListSchema = z.object({
  limit: z.number().int().min(1).max(100).default(50).describe("Max results per page"),
  cursor: z.string().optional().describe("Pagination cursor"),
}).strict();

const EventCreateSchema = z.object({
  title: z.string().min(1).describe("Event title"),
  description: z.string().optional().describe("Event description"),
  start: z.string().describe("Start date-time (ISO-8601)"),
  end: z.string().describe("End date-time (ISO-8601)"),
  time_zone: z.string().optional().describe("IANA time zone, e.g. America/New_York"),
  enable_seo: z.boolean().optional().describe("Enable SEO for the event page"),
  auto_admit: z.boolean().optional().describe("Auto-admit guests on join"),
  disable_rsvp: z.boolean().optional().describe("Disable RSVP requirement"),
}).strict();

const EventUpdateSchema = z.object({
  event_id: z.string().describe("Event ID to update"),
  title: z.string().optional().describe("Updated title"),
  description: z.string().optional().describe("Updated description"),
  start: z.string().optional().describe("Updated start (ISO-8601)"),
  end: z.string().optional().describe("Updated end (ISO-8601)"),
  time_zone: z.string().optional().describe("Updated IANA time zone"),
  enable_seo: z.boolean().optional(),
  auto_admit: z.boolean().optional(),
  disable_rsvp: z.boolean().optional(),
}).strict();

const EventCancelSchema = z.object({
  event_id: z.string().describe("Event ID to cancel"),
}).strict();

const GuestInfoSchema = z.object({
  guest_id: z.string().describe("Guest ID"),
}).strict();

const GuestListSchema = z.object({
  event_id: z.string().describe("Event ID"),
  status: z.enum(["invited", "going", "maybe", "notGoing"]).optional().describe("Filter by RSVP status"),
  limit: z.number().int().min(1).max(100).default(100).describe("Max results"),
  cursor: z.string().optional().describe("Pagination cursor"),
}).strict();

const GuestAddSchema = z.object({
  event_id: z.string().describe("Event ID"),
  guests: z.array(z.object({
    email: z.string().email().describe("Guest email"),
    name: z.string().optional().describe("Guest display name"),
    phone: z.string().optional().describe("Guest phone number"),
  })).min(1).describe("Guests to add"),
}).strict();

const GuestUpdateSchema = z.object({
  guest_id: z.string().describe("Guest ID to update"),
  status: z.enum(["invited", "going", "maybe", "notGoing"]).describe("New RSVP status"),
}).strict();

const GuestRemoveSchema = z.object({
  guest_id: z.string().describe("Guest ID to remove"),
}).strict();

const AttendanceListSchema = z.object({
  event_id: z.string().describe("Event ID"),
}).strict();

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerOnAirTools(server: McpServer): void {

  server.registerTool("roam_onair_event_info", {
    title: "Get On-Air Event",
    description: "Get details for a single On-Air event. Requires scope onair:read.",
    inputSchema: EventInfoSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const data = await roamGet<unknown>("/onair.event.info", { id: params.event_id });
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    } catch (error) { return { content: [{ type: "text" as const, text: handleApiError(error) }] }; }
  });

  server.registerTool("roam_onair_event_list", {
    title: "List On-Air Events",
    description: "List On-Air events in the organization (paginated). Requires scope onair:read.",
    inputSchema: EventListSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const query: Record<string, unknown> = { limit: params.limit };
      if (params.cursor) query.cursor = params.cursor;
      const data = await roamGet<unknown>("/onair.event.list", query);
      const text = JSON.stringify(data, null, 2);
      return { content: [{ type: "text" as const, text: text.length > CHARACTER_LIMIT ? text.slice(0, CHARACTER_LIMIT) + "\n…truncated" : text }] };
    } catch (error) { return { content: [{ type: "text" as const, text: handleApiError(error) }] }; }
  });

  server.registerTool("roam_onair_event_create", {
    title: "Create On-Air Event",
    description: "Create a new On-Air event. Requires scope onair:write.",
    inputSchema: EventCreateSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async (params) => {
    try {
      const body: Record<string, unknown> = {
        title: params.title,
        start: params.start,
        end: params.end,
      };
      if (params.description) body.description = params.description;
      if (params.time_zone) body.timeZone = params.time_zone;
      if (params.enable_seo !== undefined) body.enableSEO = params.enable_seo;
      if (params.auto_admit !== undefined) body.autoAdmit = params.auto_admit;
      if (params.disable_rsvp !== undefined) body.disableRSVP = params.disable_rsvp;
      const data = await roamPost<unknown>("/onair.event.create", body);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    } catch (error) { return { content: [{ type: "text" as const, text: handleApiError(error) }] }; }
  });

  server.registerTool("roam_onair_event_update", {
    title: "Update On-Air Event",
    description: "Update an existing On-Air event. Requires scope onair:write.",
    inputSchema: EventUpdateSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const body: Record<string, unknown> = { id: params.event_id };
      if (params.title) body.title = params.title;
      if (params.description) body.description = params.description;
      if (params.start) body.start = params.start;
      if (params.end) body.end = params.end;
      if (params.time_zone) body.timeZone = params.time_zone;
      if (params.enable_seo !== undefined) body.enableSEO = params.enable_seo;
      if (params.auto_admit !== undefined) body.autoAdmit = params.auto_admit;
      if (params.disable_rsvp !== undefined) body.disableRSVP = params.disable_rsvp;
      const data = await roamPost<unknown>("/onair.event.update", body);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    } catch (error) { return { content: [{ type: "text" as const, text: handleApiError(error) }] }; }
  });

  server.registerTool("roam_onair_event_cancel", {
    title: "Cancel On-Air Event",
    description: "Cancel an On-Air event. This is destructive — the event cannot be restored. Requires scope onair:write.",
    inputSchema: EventCancelSchema,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      await roamPost<unknown>("/onair.event.cancel", { id: params.event_id });
      return { content: [{ type: "text" as const, text: `Event ${params.event_id} cancelled.` }] };
    } catch (error) { return { content: [{ type: "text" as const, text: handleApiError(error) }] }; }
  });

  // --- Guests ---

  server.registerTool("roam_onair_guest_info", {
    title: "Get On-Air Guest",
    description: "Get details for a single event guest. Requires scope onair:read.",
    inputSchema: GuestInfoSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const data = await roamGet<unknown>("/onair.guest.info", { id: params.guest_id });
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    } catch (error) { return { content: [{ type: "text" as const, text: handleApiError(error) }] }; }
  });

  server.registerTool("roam_onair_guest_list", {
    title: "List On-Air Guests",
    description: "List guests for an On-Air event with optional status filter. Requires scope onair:read.",
    inputSchema: GuestListSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const query: Record<string, unknown> = { eventId: params.event_id, limit: params.limit };
      if (params.status) query.status = params.status;
      if (params.cursor) query.cursor = params.cursor;
      const data = await roamGet<unknown>("/onair.guest.list", query);
      const text = JSON.stringify(data, null, 2);
      return { content: [{ type: "text" as const, text: text.length > CHARACTER_LIMIT ? text.slice(0, CHARACTER_LIMIT) + "\n…truncated" : text }] };
    } catch (error) { return { content: [{ type: "text" as const, text: handleApiError(error) }] }; }
  });

  server.registerTool("roam_onair_guest_add", {
    title: "Add Guests to On-Air Event",
    description: "Add one or more guests to an On-Air event by email. Requires scope onair:write.",
    inputSchema: GuestAddSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async (params) => {
    try {
      const data = await roamPost<unknown>("/onair.guest.add", {
        eventId: params.event_id,
        guests: params.guests,
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    } catch (error) { return { content: [{ type: "text" as const, text: handleApiError(error) }] }; }
  });

  server.registerTool("roam_onair_guest_update", {
    title: "Update Guest RSVP",
    description: "Update the RSVP status of an event guest. Requires scope onair:write.",
    inputSchema: GuestUpdateSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const data = await roamPost<unknown>("/onair.guest.update", {
        id: params.guest_id,
        status: params.status,
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    } catch (error) { return { content: [{ type: "text" as const, text: handleApiError(error) }] }; }
  });

  server.registerTool("roam_onair_guest_remove", {
    title: "Remove Guest from On-Air Event",
    description: "Remove a guest from an On-Air event. Requires scope onair:write.",
    inputSchema: GuestRemoveSchema,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      await roamPost<unknown>("/onair.guest.remove", { id: params.guest_id });
      return { content: [{ type: "text" as const, text: `Guest ${params.guest_id} removed.` }] };
    } catch (error) { return { content: [{ type: "text" as const, text: handleApiError(error) }] }; }
  });

  // --- Attendance ---

  server.registerTool("roam_onair_attendance_list", {
    title: "List On-Air Attendance",
    description: "Get the attendance report for an On-Air event, combining RSVP status and actual join data. Requires scope onair:read.",
    inputSchema: AttendanceListSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const data = await roamGet<unknown>("/onair.attendance.list", { eventId: params.event_id });
      const text = JSON.stringify(data, null, 2);
      return { content: [{ type: "text" as const, text: text.length > CHARACTER_LIMIT ? text.slice(0, CHARACTER_LIMIT) + "\n…truncated" : text }] };
    } catch (error) { return { content: [{ type: "text" as const, text: handleApiError(error) }] }; }
  });
}
