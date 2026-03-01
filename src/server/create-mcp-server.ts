import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { FactSimRuntime } from "../fact-sim-runtime.js";
import { registerToolsGroup1 } from "./tools/tools-group-1.js";
import { registerToolsGroup2 } from "./tools/tools-group-2.js";
import { registerToolsGroup3 } from "./tools/tools-group-3.js";
import { registerToolsGroup4 } from "./tools/tools-group-4.js";
import { registerToolsGroup5 } from "./tools/tools-group-5.js";

export function createMcpServer(runtime: FactSimRuntime): McpServer {
  const server = new McpServer(
    {
      name: "fact-sim-mcp",
      version: "0.2.0"
    },
    {
      capabilities: {
        logging: {}
      }
    }
  );

  registerToolsGroup1(server, runtime);
  registerToolsGroup2(server, runtime);
  registerToolsGroup3(server, runtime);
  registerToolsGroup4(server, runtime);
  registerToolsGroup5(server, runtime);

  return server;
}