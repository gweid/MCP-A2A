# MCP Resources

MCP Resources 发现机制的完整示例：展示固定资源、动态资源模板与 URI 变量补全。

- Server 使用 `@modelcontextprotocol/sdk` 注册资源，通过 stdio 与 Client 通信。
- Client 自动启动 Server，演示资源发现、读取与补全的完整流程。

## 覆盖的协议方法

| 协议方法 | 说明 |
| --- | --- |
| `resources/list` | 列出固定资源与模板可枚举出的资源 |
| `resources/templates/list` | 列出动态资源模板 |
| `resources/read` | 读取固定资源或模板实例 |
| `completion/complete` | 补全模板 URI 变量（支持上下文关联） |

## 资源清单

- `config://application`：固定资源，当前应用的只读运行配置（JSON）。
- `docs://{collection}/{id}`：动态资源模板，按 `collection` 和 `id` 读取知识库文档（Markdown），支持模板枚举与变量补全。

## 环境要求

- Node.js 22 或更高版本

## 安装与构建

```sh
cd 03-mcp-resources

npm install
npm run build
```

## 运行

开发模式直接运行（无需先构建，通过 `tsx` 直接执行 TS 源码）：

```sh
npm run dev
```

生产模式（先构建，再运行编译产物）：

```sh
npm run build

npm start
```

两种模式通过 `MCP_SERVER_MODE` 环境变量区分：

- `MCP_SERVER_MODE=dev`：Client 启动 `node --import tsx src/server.ts`
- `MCP_SERVER_MODE=prod`：Client 启动 `node dist/server.js`

未设置该变量时，Client 会自动检测 `dist/server.js` 是否存在：存在则走生产模式，否则走开发模式。

`npm run server` 仅用于单独启动 stdio Server 进行调试；正常使用时运行 Client 即可。

## 验证

```sh
npm run build

npm start
```

Client 依次输出：资源列表、资源模板列表、固定资源内容、模板实例内容、URI 变量补全结果。

## 说明

- 资源是只读上下文，由 URI 唯一标识；Server 声明了 `resources.subscribe` 能力，但本示例不包含资源变更通知演示。
