import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";

const documents = [
  {
    collection: "guide",
    id: "intro",
    title: "入门介绍",
    body: "# 入门介绍\n\n这是 MCP Resources 示例。"
  },
  {
    collection: "guide",
    id: "resources",
    title: "Resources 说明",
    body: "# Resources\n\nResource 是 URI 标识的只读上下文。"
  }
];

function scalar(value: string | string[] | undefined): string {
  if (value === undefined) {
    throw new McpError(-32602, "缺少 URI 模板变量");
  }

  const result =  Array.isArray(value) ? value[0] : value;
  return result as string;
}



const server = new McpServer(
  {
    name: "resource-demo",
    version: "1.0.0"
  },
  {
    capabilities: {
      resources: {
        subscribe: true
      }
    }
  }
);

// 静态资源
server.registerResource(
  "application-config",
  "config://application",
  {
    title: "应用配置",
    description: "当前应用的只读运行配置",
    mimeType: "application/json",
    annotations: {
      audience: ["assistant"],
      priority: 0.8
    }
  },
  async uri => ({
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(
          {
            environment: "production",
            region: "cn-east"
          },
          null,
          2
        )
      }
    ]
  })
);

// 动态资源模板
const documentTemplate = new ResourceTemplate(
  "docs://{collection}/{id}",
  {
    list: async () => ({
      resources: documents.map(document => ({
        uri:
          `docs://${encodeURIComponent(document.collection)}/` +
          encodeURIComponent(document.id),
        name: `${document.collection}/${document.id}`,
        title: document.title,
        description: "知识库文档",
        mimeType: "text/markdown"
      }))
    }),

    complete: {
      collection: value => {
        const collections = [...new Set(
          documents.map(document => document.collection)
        )];

        return collections.filter(collection =>
          collection.startsWith(value)
        );
      },

      id: (value, context) => {
        const collection = context?.arguments?.collection;

        return documents
          .filter(document =>
            (!collection || document.collection === collection) &&
            document.id.startsWith(value)
          )
          .map(document => document.id);
      }
    }
  }
);

server.registerResource(
  "knowledge-document",
  documentTemplate,
  {
    title: "知识库文档",
    description: "根据 collection 和 id 读取知识库文档",
    mimeType: "text/markdown"
  },
  async (uri, variables) => {
    // 1.30.0 的 URI 模板匹配结果不会自动 percent-decode
    const collection = decodeURIComponent(
      scalar(variables.collection)
    );
    const id = decodeURIComponent(
      scalar(variables.id)
    );

    const document = documents.find(
      item => item.collection === collection && item.id === id
    );

    if (!document) {
      throw new McpError(
        -32002,
        "Resource not found",
        { uri: uri.href }
      );
    }

    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "text/markdown",
          text: document.body
        }
      ]
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Server start...");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`MCP Server 启动失败：${message}`);
  process.exitCode = 1;
});
