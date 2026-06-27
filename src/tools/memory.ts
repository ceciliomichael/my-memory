import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db.js";
import { getEmbedding, extractGraph, synthesizeAnswer } from "../services/ai.js";

// Schemas
export const saveMemorySchema = z.object({
  content: z.string(),
  type: z.enum(["fact", "note"]),
  scope: z.string(),
  tags: z.array(z.string()).optional(),
});
export const askMemorySchema = z.object({
  query: z.string(),
  scope: z.string().optional(),
  type_filter: z.enum(["fact", "note"]).optional(),
});
export const deleteMemorySchema = z.object({ id: z.string() });
export const getIdentitySummarySchema = z.object({ scope: z.string() });

// Definitions
export const toolsDefinition = [
  {
    name: "save_memory",
    description: "Saves information into the memory system.",
    inputSchema: {
      type: "object",
      properties: {
        content: { type: "string" },
        type: { type: "string", enum: ["fact", "note"] },
        scope: { type: "string" },
        tags: { type: "array", items: { type: "string" } }
      },
      required: ["content", "type", "scope"]
    }
  },
  {
    name: "ask_memory",
    description: "The universal recall tool. Performs a search. Returns memory IDs, scopes, and content.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        scope: { type: "string" },
        type_filter: { type: "string", enum: ["fact", "note"] }
      },
      required: ["query"]
    }
  },
  {
    name: "delete_memory",
    description: "Prunes outdated or incorrect information by ID.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"]
    }
  },
  {
    name: "get_identity_summary",
    description: "Dynamically queries for all facts for the provided scope and global, returning XML.",
    inputSchema: {
      type: "object",
      properties: { scope: { type: "string" } },
      required: ["scope"]
    }
  },
  {
    name: "list_scopes",
    description: "Lists all unique scopes currently stored in the database.",
    inputSchema: { type: "object", properties: {} }
  }
];

// Handlers
export async function handleSaveMemory(args: any) {
  const parsed = saveMemorySchema.parse(args);
  const id = uuidv4();
  const tagsStr = parsed.tags ? JSON.stringify(parsed.tags) : null;
  
  const stmt = db.prepare('INSERT INTO memories (id, type, scope, content, tags) VALUES (?, ?, ?, ?, ?)');
  const info = stmt.run(id, parsed.type, parsed.scope, parsed.content, tagsStr);
  const rowid = info.lastInsertRowid;
  
  // Mode 2: Try embedding
  const emb = await getEmbedding(parsed.content);
  if (emb) {
    try {
       const float32 = new Float32Array(emb);
       const buf = Buffer.from(float32.buffer);
       db.prepare('INSERT INTO memories_embeddings (memory_rowid, embedding) VALUES (?, ?)').run(rowid, buf);
    } catch(e) {
       console.error("Failed to insert embedding", e);
    }
  }

  // Mode 3: Try LLM extraction
  if (process.env.LLM_BASE_URL) {
    await extractGraph(id, parsed.content);
  }
  
  return {
    content: [{ type: "text", text: `Memory saved successfully. ID: ${id}` }],
  };
}

export async function handleAskMemory(args: any) {
  const parsed = askMemorySchema.parse(args);
  const emb = await getEmbedding(parsed.query);
  let results: any[] = [];
  
  // Mode 2: Semantic Vector Search
  if (emb) {
    try {
      const float32 = new Float32Array(emb);
      const buf = Buffer.from(float32.buffer);
      
      let sql = `
        SELECT m.id, m.type, m.scope, m.content, m.tags
        FROM memories_embeddings v
        JOIN memories m ON v.memory_rowid = m.rowid
        WHERE v.embedding MATCH ? AND k = 10
      `;
      const params: any[] = [buf];
      if (parsed.scope) { sql += ` AND m.scope = ?`; params.push(parsed.scope); }
      if (parsed.type_filter) { sql += ` AND m.type = ?`; params.push(parsed.type_filter); }
      
      const stmt = db.prepare(sql);
      results = stmt.all(...params);
    } catch (e) {
      console.error("Vector search failed, falling back to FTS");
    }
  }
  
  // Mode 1: Fallback FTS Search
  if (results.length === 0) {
    let sql = `
      SELECT m.id, m.type, m.scope, m.content, m.tags
      FROM memories_fts fts
      JOIN memories m ON fts.rowid = m.rowid
      WHERE memories_fts MATCH ?
    `;
    const params: any[] = [parsed.query];
    if (parsed.scope) { sql += ` AND m.scope = ?`; params.push(parsed.scope); }
    if (parsed.type_filter) { sql += ` AND m.type = ?`; params.push(parsed.type_filter); }
    sql += ` ORDER BY rank LIMIT 10`;
    
    try {
      results = db.prepare(sql).all(...params);
    } catch(e: any) {
      return { content: [{ type: "text", text: `Search Error: ${e.message}` }], isError: true };
    }
  }
  
  // Mode 3: Synthesize Answer via LLM
  if (process.env.LLM_BASE_URL && results.length > 0) {
    const answer = await synthesizeAnswer(parsed.query, results);
    if (answer) {
      return {
        content: [{ type: "text", text: `Synthesized Answer:\n${answer}\n\nSources:\n${JSON.stringify(results, null, 2)}` }]
      };
    }
  }
  
  return {
    content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
  };
}

export async function handleDeleteMemory(args: any) {
  const parsed = deleteMemorySchema.parse(args);
  const stmt = db.prepare('DELETE FROM memories WHERE id = ?');
  const result = stmt.run(parsed.id);
  
  if (result.changes === 0) {
    return { content: [{ type: "text", text: `No memory found with ID: ${parsed.id}` }], isError: true };
  }
  
  return { content: [{ type: "text", text: `Memory ${parsed.id} deleted successfully.` }] };
}

export async function handleGetIdentitySummary(args: any) {
  const parsed = getIdentitySummarySchema.parse(args);
  const stmt = db.prepare('SELECT scope, content FROM memories WHERE type = ? AND (scope = ? OR scope = ?)');
  const results = stmt.all('fact', 'global', parsed.scope) as {scope: string, content: string}[];
  
  const globalFacts = results.filter(r => r.scope === 'global').map(r => r.content);
  const workspaceFacts = results.filter(r => r.scope === parsed.scope).map(r => r.content);
  
  const xml = `
<identity_summary description="Merged summary of global and workspace-specific facts. Workspace facts always override global facts in case of conflict.">
  <global_facts>
    ${globalFacts.length > 0 ? globalFacts.map(f => '- ' + f).join('\n    ') : 'No global facts saved yet.'}
  </global_facts>
  <workspace_facts scope="${parsed.scope}">
    ${workspaceFacts.length > 0 ? workspaceFacts.map(f => '- ' + f).join('\n    ') : 'No workspace facts saved yet.'}
  </workspace_facts>
</identity_summary>`.trim();
  
  return { content: [{ type: "text", text: xml }] };
}

export async function handleListScopes(args: any) {
  const stmt = db.prepare('SELECT DISTINCT scope FROM memories ORDER BY scope');
  const results = stmt.all() as {scope: string}[];
  const scopes = results.map(r => r.scope);
  return { content: [{ type: "text", text: JSON.stringify(scopes, null, 2) }] };
}
