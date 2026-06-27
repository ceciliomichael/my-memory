# Memory MCP Server

A persistent memory store for AI agents via the Model Context Protocol (MCP). It provides semantic search, graph extraction, and strict scope isolation.

## Architecture

The server adapts dynamically based on your `.env` configuration:

1. **Mode 1: FTS (Default)**
   - Triggers when no `.env` is configured.
   - Uses pure SQLite with `FTS5` for text search.

2. **Mode 2: Vector Search**
   - Triggers when `EMBEDDING_BASE_URL` and `EMBEDDING_MODEL` are set.
   - Uses `sqlite-vec` for cosine similarity semantic search.

3. **Mode 3: Graph RAG**
   - Triggers when both embedding and `LLM_BASE_URL` variables are set.
   - Extracts knowledge graphs in the background and synthesizes query answers via LLM.

## Setup

1. `npm install`
2. `npm run build`
3. (Optional) Copy `.env.example` to `.env` to configure endpoints (supports OpenAI-compatible APIs like LM Studio).
4. `npm start`

### Client Configuration (`mcp_config.json`)

You can control which Mode the server runs in directly from your MCP client configuration (like Claude Desktop or Antigravity) without needing a `.env` file. Just add the following to your `mcp_config.json` and replace the path with wherever you cloned this repository:

**Mode 1: FTS (Default)**
```json
{
  "mcpServers": {
    "my-memory": {
      "command": "node",
      "args": ["C:/absolute/path/to/my-memory/build/index.js"],
      "env": {}
    }
  }
}
```

**Mode 2: Vector Search**
```json
{
  "mcpServers": {
    "my-memory": {
      "command": "node",
      "args": ["C:/absolute/path/to/my-memory/build/index.js"],
      "env": {
        "EMBEDDING_BASE_URL": "http://localhost:1234/v1",
        "EMBEDDING_API_KEY": "lm-studio",
        "EMBEDDING_MODEL": "nomic-embed-text"
      }
    }
  }
}
```

**Mode 3: Graph RAG**
```json
{
  "mcpServers": {
    "my-memory": {
      "command": "node",
      "args": ["C:/absolute/path/to/my-memory/build/index.js"],
      "env": {
        "EMBEDDING_BASE_URL": "http://localhost:1234/v1",
        "EMBEDDING_API_KEY": "lm-studio",
        "EMBEDDING_MODEL": "nomic-embed-text",
        "LLM_BASE_URL": "http://localhost:1234/v1",
        "LLM_API_KEY": "lm-studio",
        "LLM_MODEL": "llama3"
      }
    }
  }
}
```

*Optional Global Settings:*
You can also pass `"DB_PATH": "C:/custom/path/memory.db"` in the `env` object to override the default SQLite database location.

### Upgrading Modes
If you save memories in Mode 1 and later configure your `.env` to enable Mode 2 or 3, your old memories will automatically be backfilled with embeddings and graph nodes in the background the next time the server starts!

## Tools

- `save_memory`: Store facts or notes with tags.
- `ask_memory`: Retrieve information using semantic/FTS search and optional LLM synthesis.
- `delete_memory`: Remove outdated records by ID.
- `get_identity_summary`: Return merged "global" and project-specific facts in an XML structure.
- `list_scopes`: List all active scope identifiers.

## Scoping

Data is isolated using a `scope` string rather than absolute paths.
- `global`: Used for universal preferences.
- `<workspace-name>`: Used for project-specific rules.

The `get_identity_summary` tool automatically merges global facts with the requested project scope.
