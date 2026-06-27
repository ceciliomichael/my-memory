import { describe, it, expect } from 'vitest';
import 'dotenv/config';
import { handleAskMemory, handleDeleteMemory, handleSaveMemory } from '../src/tools/memory.js';

describe('Edge Cases', () => {
  let massiveId = '';

  it('should not crash on empty query', async () => {
    // Some models/vector DBs might crash, we expect handled failure or empty return
    const res = await handleAskMemory({ query: "" });
    expect(res.content[0].text).toBeDefined();
  });

  it('should return error gracefully when deleting non-existent ID', async () => {
    const res = await handleDeleteMemory({ id: "non-existent-12345" });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('No memory found');
  });

  it('should handle saving a massive payload', async () => {
    const massiveContent = "Stress test padding. ".repeat(2000);
    const res = await handleSaveMemory({
      content: massiveContent,
      type: "note",
      scope: "global"
    });
    expect(res.content[0].text).toContain('successfully');
    massiveId = res.content[0].text.split(': ')[1];
  });

  it('should clean up the massive payload', async () => {
    if (massiveId) {
      const res = await handleDeleteMemory({ id: massiveId });
      expect(res.content[0].text).toContain('deleted successfully');
    }
  });
});
