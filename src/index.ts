import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

type LogLevel = "INFO" | "ERROR";

function log(level: LogLevel, message: string, requestId?: string, error?: unknown): void {
  const prefix = `[${new Date().toISOString()}] [${level}]${requestId ? ` [req:${requestId}]` : ""} ${message}`;

  // MCP stdio transport uses stdout, so logs must go to stderr.
  if (error !== undefined) {
    console.error(prefix, error);
    return;
  }

  console.error(prefix);
}

function createServer(): McpServer {
  const server = new McpServer(
    {
      name: "hello-mcp",
      version: "0.1.0"
    },
    {
      capabilities: {
        logging: {}
      }
    }
  );

  server.registerTool(
    "ping",
    {
      description: 'Returns "pong" with the current server time.'
    },
    async (extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "ping called", requestId);

      try {
        const now = new Date().toISOString();
        const payload = { message: "pong", time: now };

        log("INFO", "ping completed", requestId);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(payload)
            }
          ]
        };
      } catch (error) {
        log("ERROR", "ping failed", requestId, error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: "Internal error while executing ping."
            }
          ]
        };
      }
    }
  );

  return server;
}

function setupProcessHandlers(): void {
  process.on("uncaughtException", (error) => {
    log("ERROR", "uncaughtException", undefined, error);
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    log("ERROR", "unhandledRejection", undefined, reason);
    process.exit(1);
  });
}

async function main(): Promise<void> {
  setupProcessHandlers();

  const server = createServer();
  const transport = new StdioServerTransport();

  log("INFO", "starting MCP server");
  await server.connect(transport);
  log("INFO", "MCP server connected over stdio");
}

main().catch((error) => {
  log("ERROR", "fatal startup error", undefined, error);
  process.exit(1);
});
