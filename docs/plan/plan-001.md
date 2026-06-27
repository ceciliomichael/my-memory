# Memory MCP Server: Architecture & Implementation Plan

## 1. Overview
The Memory MCP Server acts as a "second brain" for AI assistants. It solves the context-amnesia problem by providing a persistent, queryable memory store. The server is designed to be highly adaptive, scaling its intelligence based on the available environment variables. 

## 2. The 3-Tier Architecture

The system gracefully degrades or upgrades across three distinct modes.

### Mode 1: Basic Storage (Offline & Lightweight)
- **Trigger:** No `.env` variables provided.
- **Storage Layer:** SQLite with `FTS5` (Full-Text Search).
- **Behavior:** 
  - `save_memory` inserts raw text into the database.
  - `ask_memory` performs a keyword (BM25) search over the text and returns matching paragraphs.
- **Pros:** Zero configuration, works entirely offline, instant response times.

### Mode 2: Semantic Memory (Vector Search)
- **Trigger:** `EMBEDDING_BASE_URL` and `EMBEDDING_MODEL` are configured.
- **Storage Layer:** SQLite + `sqlite-vec` extension.
- **Behavior:**
  - `save_memory` fetches an embedding for the text and stores both the text and the vector.
  - `ask_memory` embeds the query and performs Cosine Similarity search to return semantically relevant memories.
- **Pros:** Understands context and meaning without the overhead of a full LLM.

### Mode 3: The "Active Brain" (Graph + RAG)
- **Trigger:** Both Embedding variables AND `LLM_BASE_URL` / `LLM_MODEL` are configured.
- **Storage Layer:** SQLite + Vector + Knowledge Graph (Nodes/Edges).
- **Behavior:**
  - `save_memory` saves the text and vector (Mode 2), but *also* triggers a background LLM task. The server's LLM reads the text, extracts entities and relationships, and builds a Knowledge Graph.
  - `ask_memory` performs a vector search AND queries the graph, then uses the server's LLM to synthesize a natural language answer from the retrieved data.
- **Pros:** Zero cognitive load for the front-end AI. The backend does all the heavy lifting of connecting concepts and answering questions.

## 3. The AI Interface (MCP Tools)

To keep things simple for the AI, we expose exactly four tools (and no passive resources):

### Tools

#### 1. `save_memory`
Saves information into the memory system. 
- **Parameters:**
  - `content` (string, required): The actual information to remember.
  - `type` (string, enum `["fact", "note"]`, required): 
    - `"fact"`: Used for rigid rules and configurations (e.g., "Always use Tailwind"). 
    - `"note"`: Used for conversational summaries, ideas, or architectural decisions.
  - `scope` (string, required): A string identifier for the context (e.g., a project name like `"retro-site"`, or `"global"` for universal facts). Paths should be avoided to prevent context loss if a project folder is moved.
  - `tags` (array of strings, optional): Categorical tags to help filter (e.g., `["frontend", "auth"]`).

#### 2. `ask_memory`
The universal recall tool. Depending on the active Mode, this returns either raw keyword matches, raw semantic matches, or a fully synthesized RAG answer.
- **Parameters:**
  - `query` (string, required): The question or topic to search for (e.g., "What auth setup did we agree on?").
  - `scope` (string, optional): Restrict search to a specific scope identifier or `"global"`.
  - `tags` (array of strings, optional): Filter results to only memories with these tags.
  - `type_filter` (string, enum `["fact", "note"]`, optional): Restrict search to only facts or notes.

#### 3. `delete_memory`
Prunes outdated or incorrect information to prevent the AI from getting confused by stale context.
- **Parameters:**
  - `id` (string, required): The exact memory ID to delete (retrieved from `ask_memory` results).

#### 4. `get_identity_summary`
Dynamically queries the database for all `"fact"` type memories matching the provided scope (as well as `"global"` facts). To prevent token waste and ensure precise AI parsing without confusion, it returns the merged facts strictly formatted within an XML structure.
- **Parameters:**
  - `scope` (string, required): The scope identifier (e.g., project name).
- **Return Format Example:**
  ```xml
  <identity_summary description="Merged summary of global and workspace-specific facts. Workspace facts always override global facts in case of conflict.">
    <global_facts>
      - User likes banana
      - Always use spaces instead of tabs
    </global_facts>
    <workspace_facts scope="retro-site">
      - User likes watermelon
      - Do not use Tailwind
    </workspace_facts>
  </identity_summary>
  ```

#### 5. `list_scopes`
Lists all unique scopes currently stored in the database.
- **Parameters:** None.

## 4. Database Schema (SQLite)

```sql
-- Core memories table (used in all modes)
CREATE TABLE memories (
    id TEXT PRIMARY KEY, -- UUID
    type TEXT NOT NULL, -- 'fact' or 'note'
    scope TEXT NOT NULL, -- 'global' or project name
    content TEXT NOT NULL,
    tags TEXT, -- JSON array of tags
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- FTS virtual table for Mode 1 (uses implicit rowid)
CREATE VIRTUAL TABLE memories_fts USING fts5(
    content,
    content='memories'
);

-- Vector table for Mode 2 & 3 (using sqlite-vec)
CREATE VIRTUAL TABLE memories_embeddings USING vec0(
    memory_rowid INTEGER PRIMARY KEY, -- FK to memories.rowid
    embedding float[1536] -- dimension configurable via ENV
);

-- Knowledge Graph tables for Mode 3
CREATE TABLE entities (
    id TEXT PRIMARY KEY,
    source_memory_id TEXT NOT NULL, -- FK to memories.id
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    FOREIGN KEY(source_memory_id) REFERENCES memories(id) ON DELETE CASCADE
);

CREATE TABLE relations (
    id TEXT PRIMARY KEY,
    source_memory_id TEXT NOT NULL, -- FK to memories.id
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    relation_type TEXT NOT NULL,
    FOREIGN KEY(source_memory_id) REFERENCES memories(id) ON DELETE CASCADE,
    FOREIGN KEY(source_id) REFERENCES entities(id) ON DELETE CASCADE,
    FOREIGN KEY(target_id) REFERENCES entities(id) ON DELETE CASCADE
);
```

## 5. Environment Configuration (`.env`)

```env
# ==========================================
# MODE 2 SETTINGS (Semantic Vector Search)
# ==========================================
EMBEDDING_BASE_URL="http://localhost:11434/v1" 
EMBEDDING_API_KEY="sk-..."                     
EMBEDDING_MODEL="nomic-embed-text"

# ==========================================
# MODE 3 SETTINGS (Graph Extraction & RAG)
# (Requires Mode 2 settings to be active)
# ==========================================
LLM_BASE_URL="http://localhost:11434/v1"
LLM_API_KEY="sk-..."
LLM_MODEL="llama3"
```
