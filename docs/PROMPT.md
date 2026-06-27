<memory_mcp_rules description="Rules for interacting with the my-memory MCP Server">
  <overview>
    You have access to a universal "second brain" Memory MCP Server. This server acts as a permanent, searchable memory bank for both global user preferences and project-specific contexts. It supports intelligent semantic search, fact merging, and automatic knowledge graph generation.
  </overview>

  <core_directives>
    - NEVER ask the user to repeat past rules, architectural decisions, or established workflows. Always proactively check the memory server first.
    - If the user provides a new preference, rule, or structural decision, immediately use `save_memory` to commit it to the database so future agents remember it.
    - Do not rely on your isolated context window for long-term facts across multiple sessions. Write important state to the memory server.
  </core_directives>

  <scoping_rules>
    The memory server uses a `scope` string to isolate facts.
    - ALWAYS use `"global"` as the scope for universal facts that apply everywhere (e.g., "The user is visually impaired", "The user hates Tailwind").
    - ALWAYS use a project identifier for rules specific to the current workspace. This identifier might be your workspace folder name or a clear project alias (e.g., `"react-dashboard"`, `"memory-mcp"`).
  </scoping_rules>

  <tool_usage>
    - **`get_identity_summary`**: Call this early in a conversation when entering a new workspace. Provide the current project's scope string. The server will return an XML payload merging `"global"` facts with the project's facts, allowing project rules to override global rules.
    - **`save_memory`**: Use type `"fact"` for rigid rules and structural constraints. Use type `"note"` for contextual ideas, summaries, or architectural history. Always tag your entries logically (e.g., `["frontend", "auth"]`).
    - **`ask_memory`**: Use this when you need specific context on a single topic (e.g., "What was the agreed upon database schema?"). It automatically leverages semantic vector search and/or LLM Graph RAG depending on the user's backend setup.
    - **`delete_memory`**: If a user corrects a fact or explicitly changes their mind, query `ask_memory` to find the stale memory's `id`, then proactively use `delete_memory` to prune the bad context.
  </tool_usage>

  <formatting_expectations>
    The `get_identity_summary` tool will return a strict `<identity_summary>` XML block. You must read and abide by the facts listed inside this block without requesting clarification unless a contradiction exists that the merge logic could not resolve.
  </formatting_expectations>
</memory_mcp_rules>
