import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";

import { FactSimRuntime } from "../../fact-sim-runtime.js";
import { errorMessage, failure, log, success } from "../tool-helpers.js";

export function registerToolsGroup2(server: McpServer, runtime: FactSimRuntime): void {

  server.registerTool(
    "set_playback_speed",
    {
      description: "Set simulation playback speed. Use speed (number) and/or fastest (boolean).",
      inputSchema: {
        speed: z.number().positive().optional(),
        fastest: z.boolean().optional()
      }
    },
    async ({ speed, fastest }, extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "set_playback_speed called", requestId, {
        speed: typeof speed === "number" ? speed : null,
        fastest: typeof fastest === "boolean" ? fastest : null
      });
      try {
        const result = await runtime.setPlaybackSpeed(speed, fastest);
        log("INFO", "set_playback_speed completed", requestId, result);
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "set_playback_speed failed", requestId, msg);
        return failure(msg);
      }
    }
  );


  server.registerTool(
    "reset_simulation_clock",
    {
      description: "Stop simulation if running and reset simulation time to zero."
    },
    async (extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "reset_simulation_clock called", requestId);
      try {
        const result = await runtime.resetSimulationClock();
        log("INFO", "reset_simulation_clock completed", requestId, result);
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "reset_simulation_clock failed", requestId, msg);
        return failure(msg);
      }
    }
  );


  server.registerTool(
    "clear_graph",
    {
      description: "Clear current graph (all nodes and links) and reset simulation clock."
    },
    async (extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "clear_graph called", requestId);
      try {
        const result = await runtime.clearGraph();
        log("INFO", "clear_graph completed", requestId, result);
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "clear_graph failed", requestId, msg);
        return failure(msg);
      }
    }
  );


  server.registerTool(
    "repair_graph_links",
    {
      description: "Repair link references between graph.links and node input/output ports."
    },
    async (extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "repair_graph_links called", requestId);
      try {
        const result = await runtime.repairGraphLinks();
        log("INFO", "repair_graph_links completed", requestId, result);
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "repair_graph_links failed", requestId, msg);
        return failure(msg);
      }
    }
  );


  server.registerTool(
    "run_simulation_for",
    {
      description: "Run simulation for specified wall-clock milliseconds and return KPI snapshot.",
      inputSchema: {
        wallMs: z.number().int().positive(),
        mode: z.enum(["dt", "event"]).optional(),
        fastest: z.boolean().optional(),
        includeBenchmark: z.boolean().optional(),
        benchmarkWallMs: z.number().int().positive().optional()
      }
    },
    async ({ wallMs, mode, fastest, includeBenchmark, benchmarkWallMs }, extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "run_simulation_for called", requestId, {
        wallMs,
        mode: mode ?? null,
        fastest: typeof fastest === "boolean" ? fastest : null,
        includeBenchmark: typeof includeBenchmark === "boolean" ? includeBenchmark : null,
        benchmarkWallMs: typeof benchmarkWallMs === "number" ? benchmarkWallMs : null
      });
      try {
        const result = await runtime.runSimulationFor(wallMs, mode, fastest, includeBenchmark, benchmarkWallMs);
        log("INFO", "run_simulation_for completed", requestId, {
          simTimeMs: result.simTimeMs,
          advancedSimMs: result.advancedSimMs,
          totalCompleted: result.kpi.totalCompleted,
          throughputPerHourTotal: Number(result.kpi.throughputPerHourTotal.toFixed(3))
        });
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "run_simulation_for failed", requestId, msg);
        return failure(msg);
      }
    }
  );


  server.registerTool(
    "get_bottleneck_report",
    {
      description: "Analyze timeline CSV and return top bottleneck nodes by occupancy/wait profile.",
      inputSchema: {
        topN: z.number().int().positive().optional(),
        minSampleSec: z.number().positive().optional()
      }
    },
    async ({ topN, minSampleSec }, extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "get_bottleneck_report called", requestId, {
        topN: typeof topN === "number" ? topN : null,
        minSampleSec: typeof minSampleSec === "number" ? minSampleSec : null
      });
      try {
        const result = await runtime.getBottleneckReport(topN, minSampleSec);
        log("INFO", "get_bottleneck_report completed", requestId, {
          lineCount: result.lineCount,
          nodeCount: result.nodeCount,
          returnedRows: result.rows.length
        });
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "get_bottleneck_report failed", requestId, msg);
        return failure(msg);
      }
    }
  );


  server.registerTool(
    "capture_snapshot_png",
    {
      description: "Capture current fact_sim viewport as PNG.",
      inputSchema: {
        fileName: z.string().min(1).optional()
      }
    },
    async ({ fileName }, extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "capture_snapshot_png called", requestId, {
        fileName: fileName ?? null
      });
      try {
        const result = await runtime.captureSnapshotPng(fileName);
        log("INFO", "capture_snapshot_png completed", requestId, result);
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "capture_snapshot_png failed", requestId, msg);
        return failure(msg);
      }
    }
  );


  server.registerTool(
    "export_graph_json",
    {
      description: "Export current graph as JSON string.",
      inputSchema: {
        pretty: z.boolean().optional()
      }
    },
    async ({ pretty }, extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "export_graph_json called", requestId, { pretty: !!pretty });
      try {
        const result = await runtime.exportGraphJson(pretty);
        log("INFO", "export_graph_json completed", requestId, {
          nodeCount: result.nodeCount,
          linkCount: result.linkCount,
          bytes: result.json.length
        });
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "export_graph_json failed", requestId, msg);
        return failure(msg);
      }
    }
  );


  server.registerTool(
    "import_graph_json",
    {
      description: "Import graph JSON string into fact_sim and reset sim clock.",
      inputSchema: {
        graphJson: z.string().min(2)
      }
    },
    async ({ graphJson }, extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "import_graph_json called", requestId, { bytes: graphJson.length });
      try {
        const result = await runtime.importGraphJson(graphJson);
        log("INFO", "import_graph_json completed", requestId, {
          nodeCount: result.nodeCount,
          linkCount: result.linkCount,
          running: result.running
        });
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "import_graph_json failed", requestId, msg);
        return failure(msg);
      }
    }
  );


  server.registerTool(
    "set_simulation_time",
    {
      description: "Set simulation clock to specific milliseconds.",
      inputSchema: {
        simTimeMs: z.number().min(0)
      }
    },
    async ({ simTimeMs }, extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "set_simulation_time called", requestId, { simTimeMs });
      try {
        const result = await runtime.setSimulationTime(simTimeMs);
        log("INFO", "set_simulation_time completed", requestId, result);
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "set_simulation_time failed", requestId, msg);
        return failure(msg);
      }
    }
  );


  server.registerTool(
    "get_graph_overview",
    {
      description: "Get graph size and node type summary, optionally node list.",
      inputSchema: {
        includeNodes: z.boolean().optional(),
        maxNodes: z.number().int().positive().optional()
      }
    },
    async ({ includeNodes, maxNodes }, extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "get_graph_overview called", requestId, {
        includeNodes: !!includeNodes,
        maxNodes: typeof maxNodes === "number" ? maxNodes : null
      });
      try {
        const result = await runtime.getGraphOverview(includeNodes, maxNodes);
        log("INFO", "get_graph_overview completed", requestId, {
          nodeCount: result.nodeCount,
          linkCount: result.linkCount,
          typeCount: Object.keys(result.nodeTypeCounts).length,
          truncated: !!result.truncated
        });
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "get_graph_overview failed", requestId, msg);
        return failure(msg);
      }
    }
  );

}
