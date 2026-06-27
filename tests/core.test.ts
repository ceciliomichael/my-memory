import { describe, it, expect } from 'vitest';
import 'dotenv/config';
import { handleSaveMemory, handleAskMemory, handleDeleteMemory } from '../src/tools/memory.js';

describe('Core Memory Functions', () => {
  let memoryId = '';

  it('should save a fact memory', async () => {
    const res = await handleSaveMemory({
      content: "The main server language is TypeScript.",
      type: "fact",
      scope: "global"
    });
    expect(res.content[0].text).toContain('successfully');
    memoryId = res.content[0].text.split(': ')[1];
    expect(memoryId).toBeDefined();
    expect(memoryId.length).toBeGreaterThan(10);
  });

  it('should retrieve the memory via FTS or Vector search', async () => {
    const res = await handleAskMemory({ query: "TypeScript" });
    const text = res.content[0].text;
    expect(text).toContain('TypeScript');
  });

  it('should successfully delete the memory', async () => {
    const res = await handleDeleteMemory({ id: memoryId });
    expect(res.content[0].text).toContain('deleted successfully');
  });
});
