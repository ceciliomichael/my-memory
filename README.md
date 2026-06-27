# Memory MCP Server

A robust, adaptive "second brain" Memory Server built on the Model Context Protocol (MCP). It solves context-amnesia for AI agents by providing a queryable memory store that seamlessly scales based on your environment.

## 🚀 Features & 3-Tier Architecture

This server automatically degrades or upgrades its intelligence based on what is configured in your `.env` file:

### Mode 1: Basic Storage (Offline & Lightweight)
- **Trigger:** No `.env` variables provided.
- **Storage:** Pure SQLite using `FTS5` (Full-Text Search).
- **Behavior:** Instant keyword retrieval of facts and notes. Zero setup required.

### Mode 2: Semantic Memory (Vector Search)
- **Trigger:** `EMBEDDING_BASE_URL` and `EMBEDDING_MODEL` are configured.
- **Storage:** SQLite + `sqlite-vec`.
- **Behavior:** Embeds memories upon saving and performs Cosine Similarity search to return semantically relevant context.

### Mode 3: The "Active Brain" (Graph + RAG)
- **Trigger:** Both Embedding variables AND `LLM_BASE_URL` / `LLM_MODEL` are configured.
- **Storage:** SQLite + Vector + Knowledge Graph (Nodes/Edges).
- **Behavior:** Background LLM extraction automatically builds a Knowledge Graph from your notes. Queries trigger an LLM-synthesized RAG answer instead of just returning raw rows.

## 🛠️ MCP Tools Exposed

1. **`save_memory`**: Save facts (rigid rules) or notes (summaries) with an optional array of tags.
2. **`ask_memory`**: The universal recall tool. Performs a semantic/FTS search and optionally synthesizes an answer via LLM.
3. **`delete_memory`**: Permanently prune outdated context using the memory ID.
4. **`get_identity_summary`**: Dynamically merges "global" facts with facts specific to your current project scope, returning a clean XML structure.
5. **`list_scopes`**: Lists all active scopes in the database.

## 🔧 Installation & Setup

1. Clone this repository.
2. Run \`npm install\` to install dependencies.
3. Copy \`.env.example\` to \`.env\` and configure your models if you want Mode 2 or 3.
4. Run \`npm run build\`.
5. Run \`npm start\` to launch the server on stdio.

### Environment Configuration (.env)

Supports OpenAI API spec endpoints, including local servers like Ollama or LM Studio.

\`\`\`env
# Semantic Vector Search
EMBEDDING_BASE_URL="http://localhost:1234/v1"
EMBEDDING_API_KEY="lm-studio"
EMBEDDING_MODEL="nomic-embed-text"
EMBEDDING_DIMENSION="768"

# Graph Extraction & RAG
LLM_BASE_URL="http://localhost:1234/v1"
LLM_API_KEY="lm-studio"
LLM_MODEL="llama3"
\`\`\`

## 📚 Advanced Concept: Scoping

Memories are not tied to absolute file paths. They use a flexible `scope` identifier. 
- Use `"global"` for universal facts (e.g., "I am visually impaired").
- Use project names like `"retro-site"` for project-specific facts (e.g., "Use standard CSS").
- When requesting an identity summary for `"retro-site"`, the server intelligently merges the global rules with the project rules, prioritizing the project rules in case of conflicts!
