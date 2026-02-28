import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod/v4";

import { FactSimRuntime } from "./fact-sim-runtime.js";

type LogLevel = "INFO" | "ERROR";

function log(level: LogLevel, message: string, requestId?: string, details?: unknown): void {
  const prefix = `[${new Date().toISOString()}] [${level}]${requestId ? ` [req:${requestId}]` : ""} ${message}`;
  if (typeof details === "undefined") {
    console.error(prefix);
    return;
  }

  if (typeof details === "string") {
    console.error(`${prefix} ${details}`);
    return;
  }

  console.error(`${prefix} ${JSON.stringify(details)}`);
}

function success(payload: unknown): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2)
      }
    ]
  };
}

function failure(message: string): CallToolResult {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: message
      }
    ]
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

function getMcpRoot(): string {
  const thisFilePath = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(thisFilePath);

  // dist/index.js => ../ is repo root. Keep a fallback for non-standard execution paths.
  const repoCandidate = path.resolve(currentDir, "..");
  if (existsSync(path.join(repoCandidate, "package.json"))) {
    return repoCandidate;
  }

  return path.resolve(currentDir, "..", "..");
}

function resolveFactSimRoot(mcpRoot: string): string {
  const envPath = (process.env.FACT_SIM_ROOT || "").trim();
  const candidate = envPath ? path.resolve(envPath) : path.resolve(mcpRoot, "..", "fact_sim");
  const marker = path.join(candidate, "index.html");
  if (!existsSync(marker)) {
    throw new Error(
      `fact_sim root not found at "${candidate}". Set FACT_SIM_ROOT to the directory containing index.html.`
    );
  }
  return candidate;
}

function createMcpServer(runtime: FactSimRuntime): McpServer {
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

  server.registerTool(
    "load_example",
    {
      description: "Load one of fact_sim examples (simple, branch, shuttle_line5, carrier_config, pallet_station_demo, sample_line1).",
      inputSchema: {
        example: z.string().min(1)
      }
    },
    async ({ example }, extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "load_example called", requestId, { example });
      try {
        const result = await runtime.loadExample(example);
        log("INFO", "load_example completed", requestId, { nodeCount: result.nodeCount });
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "load_example failed", requestId, msg);
        return failure(msg);
      }
    }
  );

  server.registerTool(
    "start_simulation",
    {
      description: "Start the simulation loop in the current fact_sim graph."
    },
    async (extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "start_simulation called", requestId);
      try {
        const result = await runtime.startSimulation();
        log("INFO", "start_simulation completed", requestId, result);
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "start_simulation failed", requestId, msg);
        return failure(msg);
      }
    }
  );

  server.registerTool(
    "stop_simulation",
    {
      description: "Stop the simulation loop."
    },
    async (extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "stop_simulation called", requestId);
      try {
        const result = await runtime.stopSimulation();
        log("INFO", "stop_simulation completed", requestId, result);
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "stop_simulation failed", requestId, msg);
        return failure(msg);
      }
    }
  );

  server.registerTool(
    "run_benchmark",
    {
      description: "Run fact_sim engine benchmark (dt/event).",
      inputSchema: {
        wallMs: z.number().int().positive().optional()
      }
    },
    async ({ wallMs }, extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "run_benchmark called", requestId, { wallMs: wallMs ?? null });
      try {
        const result = await runtime.runBenchmark(wallMs);
        const summary = result.results.map((row) => ({
          mode: row.mode,
          renderCase: row.renderCase,
          speed: Number(row.speed.toFixed(3))
        }));
        log("INFO", "run_benchmark completed", requestId, { runs: result.results.length });
        return success({
          wallMs: result.wallMs,
          realStepMs: result.realStepMs,
          results: result.results,
          summary
        });
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "run_benchmark failed", requestId, msg);
        return failure(msg);
      }
    }
  );

  server.registerTool(
    "export_timeline_csv",
    {
      description: "Export current timeline data as CSV string."
    },
    async (extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "export_timeline_csv called", requestId);
      try {
        const result = await runtime.exportTimelineCsv();
        log("INFO", "export_timeline_csv completed", requestId, { lineCount: result.lineCount });
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "export_timeline_csv failed", requestId, msg);
        return failure(msg);
      }
    }
  );

  server.registerTool(
    "build_share_url",
    {
      description: "Build share URL for the current graph."
    },
    async (extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "build_share_url called", requestId);
      try {
        const result = await runtime.buildShareUrl();
        log("INFO", "build_share_url completed", requestId, { length: result.length });
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "build_share_url failed", requestId, msg);
        return failure(msg);
      }
    }
  );

  server.registerTool(
    "get_simulation_status",
    {
      description: "Get current simulation status (running, mode, sim time, graph size)."
    },
    async (extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "get_simulation_status called", requestId);
      try {
        const result = await runtime.getSimulationStatus();
        log("INFO", "get_simulation_status completed", requestId, {
          running: result.running,
          mode: result.mode,
          nodeCount: result.nodeCount
        });
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "get_simulation_status failed", requestId, msg);
        return failure(msg);
      }
    }
  );

  server.registerTool(
    "get_kpi_summary",
    {
      description: "Get KPI summary (sink throughput, completed count, node type breakdown)."
    },
    async (extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "get_kpi_summary called", requestId);
      try {
        const result = await runtime.getKpiSummary();
        log("INFO", "get_kpi_summary completed", requestId, {
          sinkCount: result.sinkCount,
          totalCompleted: result.totalCompleted,
          throughputPerHourTotal: Number(result.throughputPerHourTotal.toFixed(3))
        });
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "get_kpi_summary failed", requestId, msg);
        return failure(msg);
      }
    }
  );

  server.registerTool(
    "run_scenario_matrix",
    {
      description: "Run benchmark across multiple examples and return per-scenario summaries.",
      inputSchema: {
        examples: z.array(z.string().min(1)).min(1),
        wallMs: z.number().int().positive().optional()
      }
    },
    async ({ examples, wallMs }, extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "run_scenario_matrix called", requestId, {
        examples,
        wallMs: wallMs ?? null
      });
      try {
        const result = await runtime.runScenarioMatrix(examples, wallMs);
        log("INFO", "run_scenario_matrix completed", requestId, {
          executedExamples: result.executedExamples,
          succeeded: result.totals.succeeded,
          failed: result.totals.failed
        });
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "run_scenario_matrix failed", requestId, msg);
        return failure(msg);
      }
    }
  );

  server.registerTool(
    "list_examples",
    {
      description: "List available built-in examples."
    },
    async (extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "list_examples called", requestId);
      try {
        const result = await runtime.listExamples();
        log("INFO", "list_examples completed", requestId, { count: result.examples.length });
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "list_examples failed", requestId, msg);
        return failure(msg);
      }
    }
  );

  server.registerTool(
    "set_simulation_mode",
    {
      description: "Set simulation mode (dt or event). If running, simulation is restarted.",
      inputSchema: {
        mode: z.enum(["dt", "event"])
      }
    },
    async ({ mode }, extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "set_simulation_mode called", requestId, { mode });
      try {
        const result = await runtime.setSimulationMode(mode);
        log("INFO", "set_simulation_mode completed", requestId, result);
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "set_simulation_mode failed", requestId, msg);
        return failure(msg);
      }
    }
  );

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

  server.registerTool(
    "optimize_line_by_bottleneck",
    {
      description:
        "Run iterative bottleneck-driven tuning (processTime/processTime2/downTime) and keep the best-performing line.",
      inputSchema: {
        iterations: z.number().int().positive().optional(),
        runWallMs: z.number().int().positive().optional(),
        bottleneckTopN: z.number().int().positive().optional(),
        minSampleSec: z.number().nonnegative().optional(),
        maxNodesPerIteration: z.number().int().positive().optional(),
        processReductionRatio: z.number().positive().optional(),
        downReductionRatio: z.number().positive().optional(),
        minProcessTime: z.number().nonnegative().optional(),
        minDownTime: z.number().nonnegative().optional()
      }
    },
    async (
      {
        iterations,
        runWallMs,
        bottleneckTopN,
        minSampleSec,
        maxNodesPerIteration,
        processReductionRatio,
        downReductionRatio,
        minProcessTime,
        minDownTime
      },
      extra
    ) => {
      const requestId = String(extra.requestId);
      log("INFO", "optimize_line_by_bottleneck called", requestId, {
        iterations: typeof iterations === "number" ? iterations : null,
        runWallMs: typeof runWallMs === "number" ? runWallMs : null,
        bottleneckTopN: typeof bottleneckTopN === "number" ? bottleneckTopN : null
      });
      try {
        const result = await runtime.optimizeLineByBottleneck({
          iterations,
          runWallMs,
          bottleneckTopN,
          minSampleSec,
          maxNodesPerIteration,
          processReductionRatio,
          downReductionRatio,
          minProcessTime,
          minDownTime
        });
        log("INFO", "optimize_line_by_bottleneck completed", requestId, {
          bestIteration: result.bestIteration,
          baseline: result.baseline,
          best: result.best,
          historyLength: result.history.length
        });
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "optimize_line_by_bottleneck failed", requestId, msg);
        return failure(msg);
      }
    }
  );  server.registerTool(
    "add_node",
    {
      description: "Add a node to current graph.",
      inputSchema: {
        nodeType: z.string().min(1),
        title: z.string().min(1).optional(),
        x: z.number().optional(),
        y: z.number().optional(),
        properties: z.record(z.string(), z.unknown()).optional()
      }
    },
    async ({ nodeType, title, x, y, properties }, extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "add_node called", requestId, {
        nodeType,
        title: title ?? null,
        x: typeof x === "number" ? x : null,
        y: typeof y === "number" ? y : null
      });
      try {
        const result = await runtime.addNode(nodeType, title, x, y, properties);
        log("INFO", "add_node completed", requestId, {
          nodeId: result.nodeId,
          nodeType: result.nodeType,
          nodeCount: result.nodeCount,
          linkCount: result.linkCount
        });
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "add_node failed", requestId, msg);
        return failure(msg);
      }
    }
  );

  server.registerTool(
    "get_node_ports",
    {
      description: "Get node input/output ports for connection planning.",
      inputSchema: {
        nodeId: z.union([z.string().min(1), z.number()])
      }
    },
    async ({ nodeId }, extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "get_node_ports called", requestId, { nodeId });
      try {
        const result = await runtime.getNodePorts(nodeId);
        log("INFO", "get_node_ports completed", requestId, {
          nodeId: result.nodeId,
          inputCount: result.inputCount,
          outputCount: result.outputCount
        });
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "get_node_ports failed", requestId, msg);
        return failure(msg);
      }
    }
  );
  server.registerTool(
    "get_node_ports_by_kind",
    {
      description: "Get node ports filtered by port kind (work, signal, carrier, pallet).",
      inputSchema: {
        nodeId: z.union([z.string().min(1), z.number()]),
        portKind: z.enum(["work", "signal", "carrier", "pallet"])
      }
    },
    async ({ nodeId, portKind }, extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "get_node_ports_by_kind called", requestId, { nodeId, portKind });
      try {
        const result = await runtime.getNodePortsByKind(nodeId, portKind);
        log("INFO", "get_node_ports_by_kind completed", requestId, {
          nodeId: result.nodeId,
          portKind: result.portKind,
          inputCount: result.inputs.length,
          outputCount: result.outputs.length
        });
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "get_node_ports_by_kind failed", requestId, msg);
        return failure(msg);
      }
    }
  );

  server.registerTool(
    "connect_nodes_by_port_kind",
    {
      description: "Connect two nodes using compatible ports for a specific port kind.",
      inputSchema: {
        fromNodeId: z.union([z.string().min(1), z.number()]),
        toNodeId: z.union([z.string().min(1), z.number()]),
        portKind: z.enum(["work", "signal", "carrier", "pallet"]),
        fromSlot: z.number().int().nonnegative().optional(),
        toSlot: z.number().int().nonnegative().optional(),
        allowDuplicate: z.boolean().optional()
      }
    },
    async ({ fromNodeId, toNodeId, portKind, fromSlot, toSlot, allowDuplicate }, extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "connect_nodes_by_port_kind called", requestId, {
        fromNodeId,
        toNodeId,
        portKind,
        fromSlot: typeof fromSlot === "number" ? fromSlot : null,
        toSlot: typeof toSlot === "number" ? toSlot : null,
        allowDuplicate: typeof allowDuplicate === "boolean" ? allowDuplicate : null
      });
      try {
        const result = await runtime.connectNodesByPortKind(fromNodeId, toNodeId, portKind, fromSlot, toSlot, allowDuplicate);
        log("INFO", "connect_nodes_by_port_kind completed", requestId, result);
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "connect_nodes_by_port_kind failed", requestId, msg);
        return failure(msg);
      }
    }
  );

  server.registerTool(
    "connect_work_ports",
    {
      description: "Connect work ports between two nodes (auto-select compatible slots).",
      inputSchema: {
        fromNodeId: z.union([z.string().min(1), z.number()]),
        toNodeId: z.union([z.string().min(1), z.number()]),
        fromSlot: z.number().int().nonnegative().optional(),
        toSlot: z.number().int().nonnegative().optional(),
        allowDuplicate: z.boolean().optional()
      }
    },
    async ({ fromNodeId, toNodeId, fromSlot, toSlot, allowDuplicate }, extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "connect_work_ports called", requestId, {
        fromNodeId,
        toNodeId,
        fromSlot: typeof fromSlot === "number" ? fromSlot : null,
        toSlot: typeof toSlot === "number" ? toSlot : null,
        allowDuplicate: typeof allowDuplicate === "boolean" ? allowDuplicate : null
      });
      try {
        const result = await runtime.connectWorkPorts(fromNodeId, toNodeId, fromSlot, toSlot, allowDuplicate);
        log("INFO", "connect_work_ports completed", requestId, result);
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "connect_work_ports failed", requestId, msg);
        return failure(msg);
      }
    }
  );

  server.registerTool(
    "connect_signal_ports",
    {
      description: "Connect signal ports between two nodes (auto-select compatible slots).",
      inputSchema: {
        fromNodeId: z.union([z.string().min(1), z.number()]),
        toNodeId: z.union([z.string().min(1), z.number()]),
        fromSlot: z.number().int().nonnegative().optional(),
        toSlot: z.number().int().nonnegative().optional(),
        allowDuplicate: z.boolean().optional()
      }
    },
    async ({ fromNodeId, toNodeId, fromSlot, toSlot, allowDuplicate }, extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "connect_signal_ports called", requestId, {
        fromNodeId,
        toNodeId,
        fromSlot: typeof fromSlot === "number" ? fromSlot : null,
        toSlot: typeof toSlot === "number" ? toSlot : null,
        allowDuplicate: typeof allowDuplicate === "boolean" ? allowDuplicate : null
      });
      try {
        const result = await runtime.connectSignalPorts(fromNodeId, toNodeId, fromSlot, toSlot, allowDuplicate);
        log("INFO", "connect_signal_ports completed", requestId, result);
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "connect_signal_ports failed", requestId, msg);
        return failure(msg);
      }
    }
  );

  server.registerTool(
    "connect_carrier_ports",
    {
      description: "Connect carrier ports between two nodes (auto-select compatible slots).",
      inputSchema: {
        fromNodeId: z.union([z.string().min(1), z.number()]),
        toNodeId: z.union([z.string().min(1), z.number()]),
        fromSlot: z.number().int().nonnegative().optional(),
        toSlot: z.number().int().nonnegative().optional(),
        allowDuplicate: z.boolean().optional()
      }
    },
    async ({ fromNodeId, toNodeId, fromSlot, toSlot, allowDuplicate }, extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "connect_carrier_ports called", requestId, {
        fromNodeId,
        toNodeId,
        fromSlot: typeof fromSlot === "number" ? fromSlot : null,
        toSlot: typeof toSlot === "number" ? toSlot : null,
        allowDuplicate: typeof allowDuplicate === "boolean" ? allowDuplicate : null
      });
      try {
        const result = await runtime.connectCarrierPorts(fromNodeId, toNodeId, fromSlot, toSlot, allowDuplicate);
        log("INFO", "connect_carrier_ports completed", requestId, result);
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "connect_carrier_ports failed", requestId, msg);
        return failure(msg);
      }
    }
  );

  server.registerTool(
    "connect_pallet_ports",
    {
      description: "Connect pallet ports between two nodes (auto-select compatible slots).",
      inputSchema: {
        fromNodeId: z.union([z.string().min(1), z.number()]),
        toNodeId: z.union([z.string().min(1), z.number()]),
        fromSlot: z.number().int().nonnegative().optional(),
        toSlot: z.number().int().nonnegative().optional(),
        allowDuplicate: z.boolean().optional()
      }
    },
    async ({ fromNodeId, toNodeId, fromSlot, toSlot, allowDuplicate }, extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "connect_pallet_ports called", requestId, {
        fromNodeId,
        toNodeId,
        fromSlot: typeof fromSlot === "number" ? fromSlot : null,
        toSlot: typeof toSlot === "number" ? toSlot : null,
        allowDuplicate: typeof allowDuplicate === "boolean" ? allowDuplicate : null
      });
      try {
        const result = await runtime.connectPalletPorts(fromNodeId, toNodeId, fromSlot, toSlot, allowDuplicate);
        log("INFO", "connect_pallet_ports completed", requestId, result);
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "connect_pallet_ports failed", requestId, msg);
        return failure(msg);
      }
    }
  );

  server.registerTool(
    "update_node",
    {
      description: "Update node title and/or properties.",
      inputSchema: {
        nodeId: z.union([z.string().min(1), z.number()]),
        title: z.string().optional(),
        properties: z.record(z.string(), z.unknown()).optional(),
        mergeProperties: z.boolean().optional()
      }
    },
    async ({ nodeId, title, properties, mergeProperties }, extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "update_node called", requestId, {
        nodeId,
        hasTitle: typeof title === "string",
        propertyKeys: properties ? Object.keys(properties) : [],
        mergeProperties: typeof mergeProperties === "boolean" ? mergeProperties : null
      });
      try {
        const result = await runtime.updateNode(nodeId, title, properties, mergeProperties);
        log("INFO", "update_node completed", requestId, {
          nodeId: result.nodeId,
          updatedTitle: result.updatedTitle,
          updatedPropertyKeys: result.updatedPropertyKeys,
          mergedProperties: result.mergedProperties
        });
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "update_node failed", requestId, msg);
        return failure(msg);
      }
    }
  );

  server.registerTool(
    "connect_nodes",
    {
      description: "Create a directed link between two nodes.",
      inputSchema: {
        fromNodeId: z.union([z.string().min(1), z.number()]),
        toNodeId: z.union([z.string().min(1), z.number()]),
        fromSlot: z.number().int().nonnegative().optional(),
        toSlot: z.number().int().nonnegative().optional(),
        allowDuplicate: z.boolean().optional()
      }
    },
    async ({ fromNodeId, toNodeId, fromSlot, toSlot, allowDuplicate }, extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "connect_nodes called", requestId, {
        fromNodeId,
        toNodeId,
        fromSlot: typeof fromSlot === "number" ? fromSlot : null,
        toSlot: typeof toSlot === "number" ? toSlot : null,
        allowDuplicate: typeof allowDuplicate === "boolean" ? allowDuplicate : null
      });
      try {
        const result = await runtime.connectNodes(fromNodeId, toNodeId, fromSlot, toSlot, allowDuplicate);
        log("INFO", "connect_nodes completed", requestId, result);
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "connect_nodes failed", requestId, msg);
        return failure(msg);
      }
    }
  );

  server.registerTool(
    "disconnect_nodes",
    {
      description: "Remove link(s) by linkId or endpoint criteria.",
      inputSchema: {
        linkId: z.number().int().positive().optional(),
        fromNodeId: z.union([z.string().min(1), z.number()]).optional(),
        toNodeId: z.union([z.string().min(1), z.number()]).optional(),
        fromSlot: z.number().int().nonnegative().optional(),
        toSlot: z.number().int().nonnegative().optional(),
        removeAllMatches: z.boolean().optional()
      }
    },
    async ({ linkId, fromNodeId, toNodeId, fromSlot, toSlot, removeAllMatches }, extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "disconnect_nodes called", requestId, {
        linkId: typeof linkId === "number" ? linkId : null,
        fromNodeId: typeof fromNodeId === "string" || typeof fromNodeId === "number" ? fromNodeId : null,
        toNodeId: typeof toNodeId === "string" || typeof toNodeId === "number" ? toNodeId : null,
        fromSlot: typeof fromSlot === "number" ? fromSlot : null,
        toSlot: typeof toSlot === "number" ? toSlot : null,
        removeAllMatches: typeof removeAllMatches === "boolean" ? removeAllMatches : null
      });
      try {
        const result = await runtime.disconnectNodes({
          linkId,
          fromNodeId,
          toNodeId,
          fromSlot,
          toSlot,
          removeAllMatches
        });
        log("INFO", "disconnect_nodes completed", requestId, result);
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "disconnect_nodes failed", requestId, msg);
        return failure(msg);
      }
    }
  );

  server.registerTool(
    "remove_node",
    {
      description: "Remove a node and all related links from current graph.",
      inputSchema: {
        nodeId: z.union([z.string().min(1), z.number()])
      }
    },
    async ({ nodeId }, extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "remove_node called", requestId, { nodeId });
      try {
        const result = await runtime.removeNode(nodeId);
        log("INFO", "remove_node completed", requestId, result);
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "remove_node failed", requestId, msg);
        return failure(msg);
      }
    }
  );

  server.registerTool(
    "evaluate_candidate_graph",
    {
      description: "Import candidate graph JSON, run benchmark + KPI, and return objective score.",
      inputSchema: {
        graphJson: z.string().min(2),
        wallMs: z.number().int().positive().optional(),
        objective: z.enum(["throughput", "throughput_per_node", "balanced"]).optional()
      }
    },
    async ({ graphJson, wallMs, objective }, extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "evaluate_candidate_graph called", requestId, {
        bytes: graphJson.length,
        wallMs: wallMs ?? null,
        objective: objective ?? null
      });
      try {
        const result = await runtime.evaluateCandidateGraph(graphJson, wallMs, objective);
        log("INFO", "evaluate_candidate_graph completed", requestId, {
          score: result.score,
          objective: result.objective,
          nodeCount: result.graph.nodeCount,
          linkCount: result.graph.linkCount
        });
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "evaluate_candidate_graph failed", requestId, msg);
        return failure(msg);
      }
    }
  );

  server.registerTool(
    "rank_candidate_graphs",
    {
      description: "Evaluate multiple candidate graph JSONs and return score ranking.",
      inputSchema: {
        candidates: z.array(z.string().min(2)).min(1),
        wallMs: z.number().int().positive().optional(),
        objective: z.enum(["throughput", "throughput_per_node", "balanced"]).optional(),
        topK: z.number().int().positive().optional()
      }
    },
    async ({ candidates, wallMs, objective, topK }, extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "rank_candidate_graphs called", requestId, {
        candidateCount: candidates.length,
        wallMs: wallMs ?? null,
        objective: objective ?? null,
        topK: topK ?? null
      });
      try {
        const result = await runtime.rankCandidateGraphs(candidates, wallMs, objective, topK);
        log("INFO", "rank_candidate_graphs completed", requestId, {
          succeeded: result.succeeded,
          failed: result.failed,
          returnedRankings: result.rankings.length
        });
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "rank_candidate_graphs failed", requestId, msg);
        return failure(msg);
      }
    }
  );

  server.registerTool(
    "suggest_topology_improvements",
    {
      description: "Analyze graph topology and return structural improvement suggestions.",
      inputSchema: {
        graphJson: z.string().min(2),
        maxSuggestions: z.number().int().positive().optional()
      }
    },
    async ({ graphJson, maxSuggestions }, extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "suggest_topology_improvements called", requestId, {
        bytes: graphJson.length,
        maxSuggestions: maxSuggestions ?? null
      });
      try {
        const result = await runtime.suggestTopologyImprovements(graphJson, maxSuggestions);
        log("INFO", "suggest_topology_improvements completed", requestId, {
          nodeCount: result.nodeCount,
          linkCount: result.linkCount,
          suggestionCount: result.suggestions.length
        });
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "suggest_topology_improvements failed", requestId, msg);
        return failure(msg);
      }
    }
  );

  return server;
}

async function main(): Promise<void> {
  const mcpRoot = getMcpRoot();
  const factSimRoot = resolveFactSimRoot(mcpRoot);
  const runtime = new FactSimRuntime({
    repoRoot: factSimRoot,
    preferredPort: 8123,
    logger: (message, details) => log("INFO", message, undefined, details)
  });
  const server = createMcpServer(runtime);
  const transport = new StdioServerTransport();

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    log("INFO", `shutdown requested (${signal})`);
    try {
      await runtime.close();
      await server.close();
    } finally {
      process.exit(0);
    }
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
  process.on("uncaughtException", (error) => {
    log("ERROR", "uncaughtException", undefined, errorMessage(error));
    void shutdown("uncaughtException");
  });
  process.on("unhandledRejection", (reason) => {
    log("ERROR", "unhandledRejection", undefined, errorMessage(reason));
    void shutdown("unhandledRejection");
  });

  log("INFO", "starting fact-sim MCP server", undefined, {
    mcpRoot,
    factSimRoot
  });
  await server.connect(transport);
  log("INFO", "fact-sim MCP server connected over stdio");
}

main().catch((error) => {
  log("ERROR", "fatal startup error", undefined, errorMessage(error));
  process.exit(1);
});







