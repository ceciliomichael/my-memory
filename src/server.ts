import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { registerToolHandlers } from "./handlers/tool.js";

export function createServer(): Server {
  const server = new Server(
    {
      name: "mcp-server",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  registerToolHandlers(server);

  return server;
}
