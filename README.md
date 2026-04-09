# roam-mcp-server

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that connects AI assistants to the full [Roam HQ](https://ro.am) platform — messaging, groups, recordings, on-air events, chat, transcripts, and more.

Built with TypeScript using the official [MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk). Ships 46 tools covering three Roam API families.

---

## Prerequisites

- **Node.js 18+**
- A **Roam API key** (Bearer token) — create one in **Roam Administration → Developer → Add ApiClient**
  - Select the scopes your workflows require (see [Scopes reference](#scopes-reference) below)

## Installation

```bash
git clone https://github.com/HutsonLabs/roam-mcp-server.git
cd roam-mcp-server
npm install
npm run build
```

## Quick start

```bash
ROAM_API_KEY=your-key-here npm start
```

The server communicates over **stdio** by default, which is the standard transport for local MCP integrations.

---

## Connecting to an AI client

### Claude Desktop

Open **Settings → Developer → Edit Config** and add:

```json
{
  "mcpServers": {
    "roam": {
      "command": "node",
      "args": ["/absolute/path/to/roam-mcp-server/dist/index.js"],
      "env": {
        "ROAM_API_KEY": "your-key-here"
      }
    }
  }
}
```

### Claude Code (CLI)

Add to your project's `.mcp.json` or global config:

```json
{
  "mcpServers": {
    "roam": {
      "command": "node",
      "args": ["/absolute/path/to/roam-mcp-server/dist/index.js"],
      "env": {
        "ROAM_API_KEY": "your-key-here"
      }
    }
  }
}
```

> **Tip:** Use the full absolute path — `~` and `$HOME` are not expanded when MCP servers spawn processes.

### Other MCP clients

Any MCP-compatible client that supports stdio transport will work. Point it at `dist/index.js` and pass the `ROAM_API_KEY` environment variable.

---

## Available tools

### Roam HQ API v1

| Tool | Description |
|------|-------------|
| `roam_send_message` | Send a message to a group (supports Markdown, custom sender identity) |
| `roam_list_groups` | List all public, non-archived groups in the organization |
| `roam_list_recordings` | List meeting recordings with date filtering and pagination |
| `roam_export_message_events` | Export a full day's message events (sent/edited/deleted) as NDJSON |
| `roam_list_magicasts` | List all magicasts with pagination |
| `roam_get_magicast` | Get details for a single magicast by ID |

### On-Air API v1

| Tool | Description |
|------|-------------|
| `roam_onair_event_list` | List On-Air events in the organization |
| `roam_onair_event_info` | Get details for a single event |
| `roam_onair_event_create` | Create a new On-Air event |
| `roam_onair_event_update` | Update an existing event |
| `roam_onair_event_cancel` | Cancel an event (destructive) |
| `roam_onair_guest_list` | List guests for an event with optional status filter |
| `roam_onair_guest_info` | Get details for a single guest |
| `roam_onair_guest_add` | Add guests to an event by email |
| `roam_onair_guest_update` | Update a guest's RSVP status |
| `roam_onair_guest_remove` | Remove a guest from an event |
| `roam_onair_attendance_list` | Get attendance report (RSVP + actual join data) |

### Chat API v0

#### Messaging

| Tool | Description |
|------|-------------|
| `roam_chat_list` | List all accessible chats (DMs, MultiDMs, Channels) |
| `roam_chat_post` | Post a message — supports Markdown, Block Kit, and polls |
| `roam_chat_update` | Update a previously posted bot message |
| `roam_chat_delete` | Delete a bot-authored message |
| `roam_chat_typing` | Show a typing indicator |
| `roam_chat_history` | Retrieve message history with date filtering |
| `roam_reaction_add` | Add an emoji reaction to a message |

#### Users

| Tool | Description |
|------|-------------|
| `roam_user_list` | List all users in the account |
| `roam_user_info` | Get details for a user by address ID |
| `roam_user_lookup` | Find a user by email address |
| `roam_addr_info` | Get chat address information |
| `roam_audit_log` | Retrieve user audit log entries |

#### Groups

| Tool | Description |
|------|-------------|
| `roam_group_create` | Create a new group with optional members and admins |
| `roam_group_rename` | Rename an existing group |
| `roam_group_archive` | Archive a group (destructive) |
| `roam_group_members` | List members of a group |
| `roam_group_add_members` | Add members or admins to a group |
| `roam_group_remove_members` | Remove members from a group |

#### Meetings & Transcripts

| Tool | Description |
|------|-------------|
| `roam_meeting_list` | List meetings with participant info |
| `roam_meetinglink_create` | Generate a shareable meeting link |
| `roam_meetinglink_info` | Get meeting link details |
| `roam_meetinglink_update` | Update a meeting link's properties |
| `roam_transcript_list` | List meeting transcripts with date filtering |
| `roam_transcript_info` | Get full transcript with summary |
| `roam_transcript_prompt` | Ask an AI-powered question against a transcript |
| `roam_lobby_list` | List active lobby configurations |
| `roam_lobby_booking_list` | List lobby reservations |

#### App Management

| Tool | Description |
|------|-------------|
| `roam_token_info` | Retrieve metadata and scopes for the current API token |
| `roam_app_uninstall` | Revoke access and remove the integration (destructive, irreversible) |

---

## Scopes reference

When creating your API key in Roam Administration, select the scopes needed for your use case:

| Scope | Required for |
|-------|-------------|
| `chat:send_message` | `roam_send_message` |
| `groups:read` | `roam_list_groups` |
| `recordings:read` | `roam_list_recordings` |
| `admin:compliance:read` | `roam_export_message_events` |
| `magicast:read` | `roam_list_magicasts`, `roam_get_magicast` |
| `onair:read` | All `roam_onair_*` read tools |
| `onair:write` | `roam_onair_event_create/update/cancel`, `roam_onair_guest_add/update/remove` |
| `chat:read` | `roam_chat_list`, `roam_chat_history` |
| `chat:write` | `roam_chat_post/update/delete`, `roam_chat_typing`, `roam_reaction_add` |
| `user:read` | `roam_user_list/info/lookup`, `roam_addr_info` |
| `group:write` | `roam_group_create/rename/archive`, `roam_group_add/remove_members` |
| `meeting:read` | `roam_meeting_list`, `roam_meetinglink_info`, `roam_lobby_*` |
| `meeting:write` | `roam_meetinglink_create/update` |
| `transcript:read` | `roam_transcript_list/info/prompt` |
| `userauditlog:read` | `roam_audit_log` |

---

## Rate limits

Roam enforces **10-request burst capacity** with a sustained rate of **1 request per second**. If you exceed this, the API returns HTTP 429 with a `Retry-After` header. The server surfaces this information in error messages automatically.

## Project structure

```
roam-mcp-server/
├── src/
│   ├── index.ts              # Entry point — server init and transport
│   ├── constants.ts          # API base URLs, limits
│   ├── services/
│   │   └── api-client.ts     # Shared HTTP client with auth and error handling
│   └── tools/
│       ├── roam-hq.ts        # Roam HQ API v1 tools
│       ├── onair.ts          # On-Air API v1 tools
│       └── chat.ts           # Chat API v0 tools
├── dist/                     # Compiled JavaScript (after build)
├── package.json
└── tsconfig.json
```

## Development

```bash
npm run dev      # Watch mode with auto-reload
npm run build    # Compile TypeScript to dist/
npm run clean    # Remove dist/
```

## License

MIT
