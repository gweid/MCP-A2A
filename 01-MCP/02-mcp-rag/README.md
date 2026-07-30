# MCP RAG

- Client 固定先调用 MCP 检索，再使用 LLM 生成回答。
- Server 使用阿里云百炼的向量模型生成 1536 维向量。
- 向量索引是纯 TypeScript 内存实现，按精确 L2 距离排序。
- MCP 使用 stdio；Client 会自动启动 Server，不需要先单独运行 Server。

## 环境要求

- Node.js 22 或更高版本
- 任意 LLM API Key
- 任意向量索引

## 安装与配置

```sh
cd 02-mcp-rag/rag-ts

npm install

cp .env.example .env
```

编辑 `.env`：

```dotenv
LLM_API_URL=模型 URL
LLM_API_KEY=模型 KEY
LLM_API_MODEL=模型

EMBED_API_URL=向量索引 URL
EMBED_API_KEY=向量索引 KEY
EMBED_API_MODEL=向量索引模型
```

## 运行

开发模式：

```sh
npm run dev
```

构建后运行：

```sh
npm run build
npm start
```

`npm run server` 仅用于单独启动 stdio Server 进行调试；正常使用时运行 Client
即可。

## 验证

```sh
npm run check
```

该命令执行严格 TypeScript 构建和不访问云 API 的向量检索单元测试。

## 数据流

```text
内置医学文档
  -> MCP index_docs
  -> DashScope Embedding
  -> 内存 L2 向量索引

用户问题
  -> MCP retrieve_docs
  -> 相关文档文本
  -> LLM Chat
  -> 最终回答
```

## 范围

这是用途的最小 MCP-RAG。索引只保存在 Server 进程内存中，重启后会清空；
当前版本不包含文件导入、自动分块、持久化、重排和模型自主工具调用。
