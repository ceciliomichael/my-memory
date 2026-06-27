import './env.js';
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { sync } from "./sync.js";

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  
  await server.connect(transport);
  console.error("mcp-server running on stdio");
  
  // Run synchronization asynchronously in the background
  sync().catch(e => console.error("Sync failed:", e));
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
