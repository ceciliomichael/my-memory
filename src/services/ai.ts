import { v4 as uuidv4 } from "uuid";
import { db } from "../db.js";

// Helper for Embeddings (Mode 2 & 3)
export async function getEmbedding(text: string): Promise<number[] | null> {
  const url = process.env.EMBEDDING_BASE_URL;
  const model = process.env.EMBEDDING_MODEL || 'nomic-embed-text';
  const apiKey = process.env.EMBEDDING_API_KEY || 'sk-none';
  if (!url) return null;
  
  try {
    const res = await fetch(`${url}/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model, input: text })
    });
    const data = await res.json() as any;
    if (!data.data || !data.data[0]) {
      console.warn("Embedding API returned unexpected format:", data);
      return null;
    }
    return data.data[0].embedding;
  } catch (e) {
    console.error("Embedding error:", e);
    return null;
  }
}

// Helper for Graph Extraction (Mode 3)
export async function extractGraph(memoryId: string, text: string) {
  const url = process.env.LLM_BASE_URL;
  const model = process.env.LLM_MODEL || 'llama3';
  const apiKey = process.env.LLM_API_KEY || 'sk-none';
  if (!url) return;

  const prompt = `Extract entities and relationships from the following text to build a knowledge graph.
Return ONLY valid JSON in this exact format:
{
  "entities": [ {"id": "unique_str", "name": "Name", "type": "Person/Project/etc"} ],
  "relations": [ {"source_id": "unique_str", "target_id": "unique_str", "relation_type": "likes/uses/etc"} ]
}
Text: ${text}`;

  try {
    const res = await fetch(`${url}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ 
        model, 
        messages: [{ role: 'user', content: prompt }]
      })
    });
    
    if (!res.ok) {
       console.error("LLM API returned error status:", res.status, await res.text());
       return;
    }
    
    const data = await res.json() as any;
    const content = data.choices[0].message.content;
    let graph;
    try {
      // Sometimes local LLMs return markdown blocks like ```json ... ```
      const cleanedContent = content.replace(/```json/g, "").replace(/```/g, "").trim();
      graph = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error("Failed to parse LLM JSON output:", content);
      return;
    }
    
    const insertEntity = db.prepare('INSERT OR IGNORE INTO entities (id, source_memory_id, name, type) VALUES (?, ?, ?, ?)');
    const insertRelation = db.prepare('INSERT OR IGNORE INTO relations (id, source_memory_id, source_id, target_id, relation_type) VALUES (?, ?, ?, ?, ?)');
    
    const runTx = db.transaction(() => {
      for (const e of graph.entities || []) {
        insertEntity.run(e.id, memoryId, e.name, e.type);
      }
      for (const r of graph.relations || []) {
        const relId = uuidv4();
        insertRelation.run(relId, memoryId, r.source_id, r.target_id, r.relation_type);
      }
    });
    runTx();
  } catch (e) {
    console.error("Graph extraction error:", e);
  }
}

// Helper for RAG Synthesis (Mode 3)
export async function synthesizeAnswer(query: string, results: any[]) {
  const url = process.env.LLM_BASE_URL;
  const model = process.env.LLM_MODEL || 'llama3';
  const apiKey = process.env.LLM_API_KEY || 'sk-none';
  if (!url) return null;
  
  const context = results.map(r => `[Scope: ${r.scope}] ${r.content}`).join('\n');
  const prompt = `Based on the following retrieved memories, answer the user's query.\n\nMemories:\n${context}\n\nQuery: ${query}`;
  
  try {
    const res = await fetch(`${url}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ 
        model, 
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await res.json() as any;
    return data.choices[0].message.content;
  } catch (e) {
    console.error("Synthesis error:", e);
    return null;
  }
}
