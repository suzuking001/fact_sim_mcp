import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";

import { FactSimRuntime } from "../../fact-sim-runtime.js";
import { errorMessage, failure, log, success } from "../tool-helpers.js";

export function registerToolsGroup3(server: McpServer, runtime: FactSimRuntime): void {

  server.registerTool(
    "export_embedded_html",
    {
      description: "Export self-contained shareable HTML file.",
      inputSchema: {
        fileName: z.string().min(1).optional()
      }
    },
    async ({ fileName }, extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "export_embedded_html called", requestId, { fileName: fileName ?? null });
      try {
        const result = await runtime.exportEmbeddedHtml(fileName);
        log("INFO", "export_embedded_html completed", requestId, result);
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "export_embedded_html failed", requestId, msg);
        return failure(msg);
      }
    }
  );


  server.registerTool(
    "save_timeline_csv",
    {
      description: "Save current timeline CSV to a file.",
      inputSchema: {
        fileName: z.string().min(1).optional()
      }
    },
    async ({ fileName }, extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "save_timeline_csv called", requestId, { fileName: fileName ?? null });
      try {
        const result = await runtime.saveTimelineCsv(fileName);
        log("INFO", "save_timeline_csv completed", requestId, result);
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "save_timeline_csv failed", requestId, msg);
        return failure(msg);
      }
    }
  );


  server.registerTool(
    "save_graph_json",
    {
      description: "Save current graph JSON to a file.",
      inputSchema: {
        fileName: z.string().min(1).optional(),
        pretty: z.boolean().optional()
      }
    },
    async ({ fileName, pretty }, extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "save_graph_json called", requestId, {
        fileName: fileName ?? null,
        pretty: !!pretty
      });
      try {
        const result = await runtime.saveGraphJson(fileName, pretty);
        log("INFO", "save_graph_json completed", requestId, result);
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "save_graph_json failed", requestId, msg);
        return failure(msg);
      }
    }
  );


  server.registerTool(
    "load_graph_json_file",
    {
      description: "Load graph JSON from a file and apply it.",
      inputSchema: {
        filePath: z.string().min(1)
      }
    },
    async ({ filePath }, extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "load_graph_json_file called", requestId, { filePath });
      try {
        const result = await runtime.loadGraphJsonFile(filePath);
        log("INFO", "load_graph_json_file completed", requestId, {
          sourcePath: result.sourcePath,
          nodeCount: result.nodeCount,
          linkCount: result.linkCount
        });
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "load_graph_json_file failed", requestId, msg);
        return failure(msg);
      }
    }
  );


  server.registerTool(
    "run_matrix_and_save_report",
    {
      description: "Run scenario matrix and save a JSON report file.",
      inputSchema: {
        examples: z.array(z.string().min(1)).min(1),
        wallMs: z.number().int().positive().optional(),
        fileName: z.string().min(1).optional()
      }
    },
    async ({ examples, wallMs, fileName }, extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "run_matrix_and_save_report called", requestId, {
        examples,
        wallMs: wallMs ?? null,
        fileName: fileName ?? null
      });
      try {
        const result = await runtime.runMatrixAndSaveReport(examples, wallMs, fileName);
        log("INFO", "run_matrix_and_save_report completed", requestId, result);
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "run_matrix_and_save_report failed", requestId, msg);
        return failure(msg);
      }
    }
  );


  server.registerTool(
    "validate_graph_json",
    {
      description: "Validate graph JSON structure before import.",
      inputSchema: {
        graphJson: z.string().min(2)
      }
    },
    async ({ graphJson }, extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "validate_graph_json called", requestId, { bytes: graphJson.length });
      try {
        const result = await runtime.validateGraphJson(graphJson);
        log("INFO", "validate_graph_json completed", requestId, {
          valid: result.valid,
          nodeCount: result.nodeCount,
          linkCount: result.linkCount,
          warningCount: result.warnings.length
        });
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "validate_graph_json failed", requestId, msg);
        return failure(msg);
      }
    }
  );


  server.registerTool(
    "save_kpi_summary_json",
    {
      description: "Save current KPI summary to a JSON file.",
      inputSchema: {
        fileName: z.string().min(1).optional(),
        pretty: z.boolean().optional()
      }
    },
    async ({ fileName, pretty }, extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "save_kpi_summary_json called", requestId, {
        fileName: fileName ?? null,
        pretty: typeof pretty === "boolean" ? pretty : null
      });
      try {
        const result = await runtime.saveKpiSummaryJson(fileName, pretty);
        log("INFO", "save_kpi_summary_json completed", requestId, result);
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "save_kpi_summary_json failed", requestId, msg);
        return failure(msg);
      }
    }
  );


  server.registerTool(
    "save_graph_overview_json",
    {
      description: "Save graph overview (counts and optional nodes) to a JSON file.",
      inputSchema: {
        fileName: z.string().min(1).optional(),
        includeNodes: z.boolean().optional(),
        maxNodes: z.number().int().positive().optional(),
        pretty: z.boolean().optional()
      }
    },
    async ({ fileName, includeNodes, maxNodes, pretty }, extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "save_graph_overview_json called", requestId, {
        fileName: fileName ?? null,
        includeNodes: typeof includeNodes === "boolean" ? includeNodes : null,
        maxNodes: typeof maxNodes === "number" ? maxNodes : null,
        pretty: typeof pretty === "boolean" ? pretty : null
      });
      try {
        const result = await runtime.saveGraphOverviewJson(fileName, includeNodes, maxNodes, pretty);
        log("INFO", "save_graph_overview_json completed", requestId, result);
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "save_graph_overview_json failed", requestId, msg);
        return failure(msg);
      }
    }
  );


  server.registerTool(
    "list_node_types",
    {
      description: "List available LiteGraph node types that can be added."
    },
    async (extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "list_node_types called", requestId);
      try {
        const result = await runtime.listNodeTypes();
        log("INFO", "list_node_types completed", requestId, { count: result.count });
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "list_node_types failed", requestId, msg);
        return failure(msg);
      }
    }
  );


  server.registerTool(
    "describe_node_type",
    {
      description: "Describe a node type (ports and default properties) for auto-planning.",
      inputSchema: {
        nodeType: z.string().min(1)
      }
    },
    async ({ nodeType }, extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "describe_node_type called", requestId, { nodeType });
      try {
        const result = await runtime.describeNodeType(nodeType);
        log("INFO", "describe_node_type completed", requestId, {
          nodeType: result.nodeType,
          inputCount: result.inputCount,
          outputCount: result.outputCount
        });
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "describe_node_type failed", requestId, msg);
        return failure(msg);
      }
    }
  );


  server.registerTool(
    "build_graph_from_blueprint",
    {
      description:
        "Build a graph in batch from blueprint nodes/edges. Supports auto layout by lane and port-kind aware connections.",
      inputSchema: {
        nodes: z
          .array(
            z.object({
              key: z.string().min(1),
              nodeType: z.string().min(1),
              title: z.string().optional(),
              x: z.number().optional(),
              y: z.number().optional(),
              lane: z.number().int().optional(),
              properties: z.record(z.string(), z.unknown()).optional()
            })
          )
          .min(1),
        edges: z
          .array(
            z.object({
              fromKey: z.string().min(1),
              toKey: z.string().min(1),
              portKind: z.enum(["work", "signal", "carrier", "pallet"]).optional(),
              fromSlot: z.number().int().nonnegative().optional(),
              toSlot: z.number().int().nonnegative().optional(),
              allowDuplicate: z.boolean().optional()
            })
          )
          .optional(),
        clearExisting: z.boolean().optional(),
        originX: z.number().optional(),
        originY: z.number().optional(),
        xPitch: z.number().positive().optional(),
        yPitch: z.number().positive().optional()
      }
    },
    async ({ nodes, edges, clearExisting, originX, originY, xPitch, yPitch }, extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "build_graph_from_blueprint called", requestId, {
        nodeCount: nodes.length,
        edgeCount: Array.isArray(edges) ? edges.length : 0,
        clearExisting: typeof clearExisting === "boolean" ? clearExisting : null
      });
      try {
        const result = await runtime.buildGraphFromBlueprint(nodes, edges ?? [], {
          clearExisting,
          originX,
          originY,
          xPitch,
          yPitch
        });
        log("INFO", "build_graph_from_blueprint completed", requestId, {
          nodeCount: result.nodeCount,
          linkCount: result.linkCount,
          createdNodes: result.createdNodes.length,
          createdLinks: result.createdLinks.length
        });
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "build_graph_from_blueprint failed", requestId, msg);
        return failure(msg);
      }
    }
  );

}
