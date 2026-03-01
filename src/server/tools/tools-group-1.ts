import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";

import { FactSimRuntime } from "../../fact-sim-runtime.js";
import { errorMessage, failure, log, success } from "../tool-helpers.js";

export function registerToolsGroup1(server: McpServer, runtime: FactSimRuntime): void {

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

}
