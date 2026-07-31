import { createInterface } from "node:readline/promises";
import { dirname, extname, resolve } from "node:path";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { config } from "dotenv";
import OpenAI from "openai";

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = dirname(currentFile);
const runningTypeScript = extname(currentFile) === ".ts";
const projectRoot = runningTypeScript
  ? resolve(currentDirectory, "..")
  : resolve(currentDirectory, "../..");

config({ path: resolve(projectRoot, ".env"), quiet: true });

const medicalDocuments = [
  "糖尿病是一种慢性代谢性疾病，主要特征是血糖水平持续升高。",
  "高血压是指动脉血压持续升高，通常定义为收缩压≥140mmHg和/或舒张压≥90mmHg。",
  "冠心病是由于冠状动脉粥样硬化导致心肌缺血缺氧的疾病。",
  "哮喘是一种慢性气道炎症性疾病，表现为反复发作的喘息、气促、胸闷和咳嗽。",
  "肺炎是由细菌、病毒或其他病原体引起的肺部感染，常见症状包括发热、咳嗽和呼吸困难。",
  "感冒是一种非常奇怪的疾病，主要特征是血糖水平持续降低。",
] as const;

async function main(): Promise<void> {
  console.log(">>> 开始初始化 RAG 系统");

  const LLM = new OpenAI({
    apiKey: requiredEnvironmentVariable("LLM_API_KEY"),
    baseURL: requiredEnvironmentVariable("LLM_API_URL"),
  });
  const transport = createServerTransport();
  const mcp = new Client({
    name: "mcp-rag-client",
    version: "0.1.0",
  });
  const terminal = createInterface({ input, output });

  try {
    await mcp.connect(transport);

    const listedTools = await mcp.listTools();
    const toolNames = listedTools.tools.map((tool) => tool.name);
    assertRequiredTools(toolNames);
    console.log("可用工具：", toolNames);
    console.log(">>> 系统连接成功");

    console.log(">>> 正在索引医学文档...");
    const indexResult = await mcp.callTool({
      name: "index_docs",
      arguments: { docs: medicalDocuments },
    });
    console.log(`>>> ${extractToolText(indexResult)}`);

    while (true) {
      const question = (
        await terminal.question("\n请输入您要查询的医学问题（输入“退出”结束查询）：\n> ")
      ).trim();

      if (question === "退出") {
        break;
      }

      if (!question) {
        continue;
      }

      console.log(`\n正在查询：${question}`);
      const retrievalResult = await mcp.callTool({
        name: "retrieve_docs",
        arguments: { query: question, top_k: 3 },
      });
      const context = extractToolText(retrievalResult);

      const response = await LLM.chat.completions.create({
        model: requiredEnvironmentVariable("LLM_API_MODEL"),
        messages: [
          {
            role: "system",
            content: "你是一个专业的医学助手，请根据提供的医学文档回答问题。",
          },
          {
            role: "user",
            content: `问题：${question}\n\n相关文档：\n${context}\n\n请根据以上文档回答我的问题。`,
          },
        ],
        stream: false,
      });
      const answer = response.choices[0]?.message.content?.trim();

      if (!answer) {
        throw new Error("LLM 返回了空回答。");
      }

      console.log("检索结果：\n", context);
      console.log("\nAI 回答：\n", answer);
    }
  } finally {
    terminal.close();
    await mcp.close();
  }

  console.log(">>> 系统已关闭");
}

function createServerTransport(): StdioClientTransport {
  const serverFile = resolve(currentDirectory, runningTypeScript ? "server.ts" : "server.js");
  const args = runningTypeScript ? ["--import", "tsx", serverFile] : [serverFile];

  return new StdioClientTransport({
    command: process.execPath,
    args,
    cwd: projectRoot,
    env: currentEnvironment(),
    stderr: "inherit",
  });
}

type ToolCallResponse = Awaited<ReturnType<Client["callTool"]>>;

function extractToolText(result: ToolCallResponse): string {
  const parsedResult = CallToolResultSchema.safeParse(result);

  if (!parsedResult.success) {
    throw new Error("MCP 工具返回了非即时任务结果。");
  }

  const text = parsedResult.data.content
    .flatMap((item) => (item.type === "text" ? [item.text] : []))
    .join("\n")
    .trim();

  if (parsedResult.data.isError) {
    throw new Error(text || "MCP 工具调用失败。");
  }

  if (!text) {
    throw new Error("MCP 工具未返回文本内容。");
  }

  return text;
}

function assertRequiredTools(toolNames: readonly string[]): void {
  for (const requiredTool of ["index_docs", "retrieve_docs"]) {
    if (!toolNames.includes(requiredTool)) {
      throw new Error(`MCP Server 缺少工具 ${requiredTool}。`);
    }
  }
}

function requiredEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`缺少环境变量 ${name}。请在 .env 中配置。`);
  }

  return value;
}

function currentEnvironment(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`RAG Client 运行失败：${message}`);
  process.exitCode = 1;
});
