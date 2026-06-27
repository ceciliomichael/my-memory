import './env.js';
import { db } from './db.js';
import { getEmbedding, extractGraph } from './services/ai.js';

async function sync() {
  console.log("Starting memory synchronization...");

  // 1. Sync Embeddings (Mode 1 -> Mode 2)
  if (process.env.EMBEDDING_BASE_URL) {
    console.log("Checking for missing embeddings...");
    const missingEmbeddings = db.prepare(`
      SELECT m.id, m.content 
      FROM memories m
      LEFT JOIN memories_embeddings me ON m.id = me.rowid
      WHERE me.rowid IS NULL
    `).all() as { id: string, content: string }[];

    if (missingEmbeddings.length > 0) {
      console.log(`Found ${missingEmbeddings.length} memories missing embeddings. Generating...`);
      const insertEmbedding = db.prepare(`
        INSERT INTO memories_embeddings(rowid, embedding)
        VALUES (?, ?)
      `);

      for (const row of missingEmbeddings) {
        try {
          const emb = await getEmbedding(row.content);
          if (emb) {
            insertEmbedding.run(row.id, new Float32Array(emb));
            console.log(`[OK] Embedded: ${row.id}`);
          } else {
            console.error(`[ERROR] Failed to embed ${row.id}: API returned null`);
          }
        } catch (e: any) {
          console.error(`[ERROR] Failed to embed ${row.id}: ${e.message}`);
        }
      }
    } else {
      console.log("All embeddings are up to date.");
    }
  }

  // 2. Sync Knowledge Graph (Mode 2 -> Mode 3)
  if (process.env.LLM_BASE_URL) {
    console.log("Checking for missing Knowledge Graph entries...");
    const missingGraphs = db.prepare(`
      SELECT m.id, m.content 
      FROM memories m
      LEFT JOIN entities e ON m.id = e.source_memory_id
      WHERE e.id IS NULL
    `).all() as { id: string, content: string }[];
    
    const distinctMissingGraphs = [...new Map(missingGraphs.map(item => [item.id, item])).values()];

    if (distinctMissingGraphs.length > 0) {
      console.log(`Found ${distinctMissingGraphs.length} memories potentially missing graph nodes. Extracting...`);
      
      for (const row of distinctMissingGraphs) {
        try {
          await extractGraph(row.id, row.content);
          console.log(`[OK] Extracted graph for: ${row.id}`);
        } catch (e: any) {
          console.error(`[ERROR] Failed to extract graph for ${row.id}: ${e.message}`);
        }
      }
    } else {
      console.log("Knowledge graph is up to date.");
    }
  }

  console.log("Sync complete!");
}

sync().catch(console.error);
