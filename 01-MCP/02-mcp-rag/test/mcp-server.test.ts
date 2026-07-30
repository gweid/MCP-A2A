import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDirectory, "..");

test("stdio Server 暴露 RAG 工具并安全处理空索引", async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--import", "tsx", resolve(projectRoot, "src/server.ts")],
    cwd: projectRoot,
    env: {
      ...currentEnvironment(),
      DASHSCOPE_API_KEY: "offline-test-key",
    },
    stderr: "pipe",
  });
  const client = new Client({
    name: "rag-ts-offline-test",
    version: "0.1.0",
  });

  try {
    await client.connect(transport);

    const tools = await client.listTools();
    assert.deepEqual(
      tools.tools.map((tool) => tool.name).sort(),
      ["index_docs", "retrieve_docs"],
    );

    const result = await client.callTool({
      name: "retrieve_docs",
      arguments: { query: "测试问题", top_k: 3 },
    });
    const parsedResult = CallToolResultSchema.parse(result);
    const text = parsedResult.content
      .flatMap((item) => (item.type === "text" ? [item.text] : []))
      .join("\n");

    assert.equal(text, "未检索到相关文档。");
  } finally {
    await client.close();
  }
});

function currentEnvironment(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
}
