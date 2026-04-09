#!/usr/bin/env node
/**
 * Roam MCP Server
 *
 * Provides MCP tools for the full Roam HQ platform:
 *   - Roam HQ API v1: messages, groups, recordings, message-event exports, magicasts
 *   - On-Air API v1: events, guests, attendance
 *   - Chat API v0: messaging, users, groups, meetings, transcripts, lobbies, app management
 *
 * Authentication: set ROAM_API_KEY environment variable with a Bearer token
 * created in Roam Administration > Developer.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getApiKey } from "./services/api-client.js";
import { registerRoamHqTools } from "./tools/roam-hq.js";
import { registerOnAirTools } from "./tools/onair.js";
import { registerChatTools } from "./tools/chat.js";

const server = new McpServer({
  name: "roam-mcp-server",
  version: "1.0.0",
});

// Register all tool families
registerRoamHqTools(server);
registerOnAirTools(server);
registerChatTools(server);

async function main(): Promise<void> {
  // Validate the API key early so users get a clear error
  try {
    getApiKey();
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Roam MCP server running via stdio");
}

main().catch((error) => {
  console.error("Fatal:", error);
  process.exit(1);
});
