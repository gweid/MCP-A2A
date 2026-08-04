import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 开发模式：直接运行 TS 源码（tsx），无需先构建
// 生产模式：运行编译产物（dist/server.js）
const srcServer = path.resolve(__dirname, "server.ts");
const distServer = path.resolve(__dirname, "../dist/server.js");

// 优先使用 MCP_SERVER_MODE 环境变量；未设置时自动检测 dist 是否存在
const mode =
  process.env.MCP_SERVER_MODE ?? (existsSync(distServer) ? "prod" : "dev");
const isDev = mode === "dev";

const mcpClient = new Client({
  name: "resource-client",
  version: "1.0.0"
});

const transport = new StdioClientTransport({
  command: process.execPath,
  args: isDev
    ? ["--import", "tsx", srcServer]
    : [distServer]
});

await mcpClient.connect(transport);

try {
  // 列出具体资源
  const resourcePage = await mcpClient.listResources();
  console.log('resources: ', resourcePage.resources);

  // 列出动态模板
  const templatePage = await mcpClient.listResourceTemplates();
  console.log('resourceTemplates: ', templatePage.resourceTemplates);

  // 读取固定资源
  const config = await mcpClient.readResource({
    uri: "config://application"
  });

  console.log('config.contents: ', config.contents);

  // 直接读取模板实例
  const document = await mcpClient.readResource({
    uri: "docs://guide/resources"
  });

  console.log('document.contents: ', document.contents);

  // 请求 URI 变量补全
  const completion = await mcpClient.complete({
    ref: {
      type: "ref/resource",
      uri: "docs://{collection}/{id}"
    },
    argument: {
      name: "id",
      value: "re"
    },
    context: {
      arguments: {
        collection: "guide"
      }
    }
  });

  console.log('completion.completion.values: ', completion.completion.values);
} finally {
  await mcpClient.close();
}