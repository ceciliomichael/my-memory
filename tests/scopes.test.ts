import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import 'dotenv/config';
import { handleSaveMemory, handleGetIdentitySummary, handleListScopes, handleDeleteMemory } from '../src/tools/memory.js';

describe('Scope & Identity Management', () => {
  let globalId = '';
  let workspaceId = '';

  beforeAll(async () => {
    const r1 = await handleSaveMemory({
      content: "Global rule: use spaces.",
      type: "fact",
      scope: "global"
    });
    globalId = r1.content[0].text.split(': ')[1];

    const r2 = await handleSaveMemory({
      content: "Workspace rule: use tabs.",
      type: "fact",
      scope: "test-workspace"
    });
    workspaceId = r2.content[0].text.split(': ')[1];
  });

  afterAll(async () => {
    if (globalId) await handleDeleteMemory({ id: globalId });
    if (workspaceId) await handleDeleteMemory({ id: workspaceId });
  });

  it('should correctly merge global and workspace facts in get_identity_summary', async () => {
    const res = await handleGetIdentitySummary({ scope: "test-workspace" });
    const xml = res.content[0].text;
    expect(xml).toContain("use spaces");
    expect(xml).toContain("use tabs");
    expect(xml).toContain('<workspace_facts scope="test-workspace">');
  });

  it('should gracefully handle get_identity_summary for empty scope', async () => {
    const res = await handleGetIdentitySummary({ scope: "empty-workspace-999" });
    const xml = res.content[0].text;
    expect(xml).toContain("use spaces"); // Global still exists
    expect(xml).toContain("No workspace facts saved yet.");
  });

  it('should retrieve distinct scopes in list_scopes', async () => {
    const res = await handleListScopes({});
    const json = JSON.parse(res.content[0].text);
    expect(json).toContain("global");
    expect(json).toContain("test-workspace");
  });
});
