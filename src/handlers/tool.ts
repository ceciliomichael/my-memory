import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { 
  toolsDefinition, 
  handleSaveMemory, 
  handleAskMemory, 
  handleDeleteMemory, 
  handleGetIdentitySummary,
  handleListScopes
} from "../tools/memory.js";

export function registerToolHandlers(server: Server) {
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: toolsDefinition,
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      switch (request.params.name) {
        case "save_memory":
          return handleSaveMemory(request.params.arguments);
        case "ask_memory":
          return handleAskMemory(request.params.arguments);
        case "delete_memory":
          return handleDeleteMemory(request.params.arguments);
        case "get_identity_summary":
          return handleGetIdentitySummary(request.params.arguments);
        case "list_scopes":
          return handleListScopes(request.params.arguments);
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  });
}
