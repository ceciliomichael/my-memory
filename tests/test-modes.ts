import 'dotenv/config';
import { 
  handleSaveMemory, 
  handleAskMemory, 
  handleGetIdentitySummary, 
  handleListScopes, 
  handleDeleteMemory 
} from '../src/tools/memory.js';

async function runTests() {
  console.log("=== Thorough Memory Server Testing ===");
  let failed = 0;
  const ids: string[] = [];

  function assert(condition: boolean, msg: string) {
    if (!condition) {
      console.error(`❌ FAILED: ${msg}`);
      failed++;
    } else {
      console.log(`✅ PASSED: ${msg}`);
    }
  }

  try {
    // 1. Edge Case: Empty query for ask_memory (Zod should fail or we should handle it)
    console.log("\n--- Testing Edge Cases ---");
    try {
      await handleAskMemory({ query: "" }); // Zod schema allows empty strings, but let's see if FTS breaks
      assert(true, "ask_memory handled empty query without crashing.");
    } catch(e) {
      assert(false, "ask_memory crashed on empty query!");
    }

    // 2. Edge Case: Delete non-existent ID
    const delRes = await handleDeleteMemory({ id: "does-not-exist-12345" });
    assert(delRes.isError === true, "delete_memory correctly returned an error for non-existent ID.");

    // 3. Normal Insertion (Global)
    const saveRes1 = await handleSaveMemory({
      content: "The system runs on port 8080.",
      type: "fact",
      scope: "global"
    });
    const id1 = saveRes1.content[0].text.split(": ")[1];
    ids.push(id1);
    assert(id1.length > 10, "Successfully saved global fact memory.");

    // 4. Normal Insertion (Workspace)
    const saveRes2 = await handleSaveMemory({
      content: "This project uses React 19.",
      type: "fact",
      scope: "project-x"
    });
    const id2 = saveRes2.content[0].text.split(": ")[1];
    ids.push(id2);
    assert(id2.length > 10, "Successfully saved workspace fact memory.");

    // 5. Edge Case: Massive Memory Insertion (Stress testing length)
    const massiveContent = "Stress test. ".repeat(1000);
    const saveRes3 = await handleSaveMemory({
      content: massiveContent,
      type: "note",
      scope: "project-x",
      tags: ["stress-test"]
    });
    const id3 = saveRes3.content[0].text.split(": ")[1];
    ids.push(id3);
    assert(id3.length > 10, "Successfully saved a massive memory payload.");

    // 6. Test Identity Summary Override (Global + Workspace)
    const identityRes = await handleGetIdentitySummary({ scope: "project-x" });
    const identityXml = identityRes.content[0].text;
    assert(
      identityXml.includes("port 8080") && identityXml.includes("React 19"),
      "get_identity_summary correctly merged global and workspace facts."
    );

    // 7. Test Identity Summary Empty Scope
    const emptyIdentityRes = await handleGetIdentitySummary({ scope: "empty-project-xyz" });
    assert(emptyIdentityRes.content[0].text.includes("No workspace facts saved yet."), "get_identity_summary handled empty scope gracefully.");

    // 8. Test Search (Tags & Type filters)
    const searchRes = await handleAskMemory({ query: "Stress test", scope: "project-x", type_filter: "note" });
    assert(
      searchRes.content[0].text.includes("Stress test") || searchRes.content[0].text.includes("Synthesized Answer"), 
      "ask_memory successfully found the memory using filters."
    );

    // 9. Test Scopes List
    const listRes = await handleListScopes({});
    const listStr = listRes.content[0].text;
    assert(listStr.includes("project-x") && listStr.includes("global"), "list_scopes successfully retrieved distinct scopes.");

  } catch (e: any) {
    console.error("UNEXPECTED CRASH DURING TESTS:", e);
    failed++;
  } finally {
    // Cleanup
    console.log("\n--- Cleaning Up ---");
    for (const id of ids) {
      await handleDeleteMemory({ id });
      console.log(`Cleaned up memory ${id}`);
    }
  }

  console.log(`\n=== TESTS FINISHED: ${failed > 0 ? failed + ' FAILED' : 'ALL PASSED'} ===`);
  if (failed > 0) process.exit(1);
}

runTests().catch(console.error);
