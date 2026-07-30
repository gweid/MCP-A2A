import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { config } from "dotenv";
import OpenAI from "openai";
import { z } from "zod";

import { InMemoryVectorStore } from "./vector-store.js";

const EMBEDDING_DIMENSION = 1536;
const EMBEDDING_MODEL = requiredEnvironmentVariable("EMBED_API_MODEL");

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = dirname(currentFile);
const projectRoot =
  extname(currentFile) === ".ts"
    ? resolve(currentDirectory, "..")
    : resolve(currentDirectory, "../..");

config({ path: resolve(projectRoot, ".env"), quiet: true });

async function main(): Promise<void> {
  const embeddingClient = new OpenAI({
    apiKey: requiredEnvironmentVariable("EMBED_API_KEY"),
    baseURL: requiredEnvironmentVariable("EMBED_API_URL"),
  });
  const vectorStore = new InMemoryVectorStore(EMBEDDING_DIMENSION);
  const server = new McpServer({
    name: "rag-ts",
    version: "0.1.0",
  });

  async function embedTexts(texts: readonly string[]): Promise<number[][]> {
    const response = await embeddingClient.embeddings.create({
      model: EMBEDDING_MODEL,
      input: [...texts],
      dimensions: EMBEDDING_DIMENSION,
      encoding_format: "float",
    });

    return response.data.map((item) => item.embedding);
  }

  server.registerTool(
    "index_docs",
    {
      description: "将一批文档加入内存向量索引。",
      inputSchema: {
        docs: z.array(z.string().trim().min(1)).min(1),
      },
    },
    async ({ docs }) => {
      const embeddings = await embedTexts(docs);
      const total = vectorStore.add(docs, embeddings);

      return {
        content: [
          {
            type: "text",
            text: `已索引 ${docs.length} 篇文档，总文档数：${total}`,
          },
        ],
      };
    },
  );

  server.registerTool(
    "retrieve_docs",
    {
      description: "检索与查询最相关的文档片段。",
      inputSchema: {
        query: z.string().trim().min(1),
        top_k: z.number().int().positive().max(100).default(3),
      },
    },
    async ({ query, top_k: topK }) => {
      if (vectorStore.size === 0) {
        return {
          content: [{ type: "text", text: "未检索到相关文档。" }],
        };
      }

      const [queryEmbedding] = await embedTexts([query]);
      const results = vectorStore.search(queryEmbedding!, topK);
      const text =
        results.length > 0
          ? results.map((result) => `[${result.index}] ${result.document}`).join("\n\n")
          : "未检索到相关文档。";

      return {
        content: [{ type: "text", text }],
      };
    },
  );

  await server.connect(new StdioServerTransport());
}

function requiredEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`缺少环境变量 ${name}。请在 .env 中配置。`);
  }

  return value;
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`MCP Server 启动失败：${message}`);
  process.exitCode = 1;
});
