import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";

import { FactSimRuntime } from "../../fact-sim-runtime.js";
import { errorMessage, failure, log, success } from "../tool-helpers.js";

export function registerToolsGroup4(server: McpServer, runtime: FactSimRuntime): void {

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
  );


  server.registerTool(
    "set_takt_target_and_objective",
    {
      description: "Set takt target (sec/unit) and DOE objective weights.",
      inputSchema: {
        taktSec: z.number().positive(),
        objectiveWeights: z
          .object({
            throughput: z.number().nonnegative().optional(),
            taktGap: z.number().nonnegative().optional(),
            cycleTime: z.number().nonnegative().optional(),
            nodeCount: z.number().nonnegative().optional(),
            linkCount: z.number().nonnegative().optional(),
            completion: z.number().nonnegative().optional()
          })
          .optional()
      }
    },
    async ({ taktSec, objectiveWeights }, extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "set_takt_target_and_objective called", requestId, {
        taktSec,
        objectiveWeights: objectiveWeights ?? null
      });
      try {
        const result = await runtime.setTaktTargetAndObjective(taktSec, objectiveWeights);
        log("INFO", "set_takt_target_and_objective completed", requestId, result);
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "set_takt_target_and_objective failed", requestId, msg);
        return failure(msg);
      }
    }
  );


  server.registerTool(
    "validate_layout_rules",
    {
      description: "Validate graph layout rules (minimum node distance and forbidden adjacency patterns).",
      inputSchema: {
        minDistance: z.number().positive().optional(),
        forbiddenAdjacency: z.array(z.string().min(1)).optional()
      }
    },
    async ({ minDistance, forbiddenAdjacency }, extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "validate_layout_rules called", requestId, {
        minDistance: typeof minDistance === "number" ? minDistance : null,
        forbiddenAdjacencyCount: Array.isArray(forbiddenAdjacency) ? forbiddenAdjacency.length : 0
      });
      try {
        const result = await runtime.validateLayoutRules(minDistance, forbiddenAdjacency);
        log("INFO", "validate_layout_rules completed", requestId, {
          ok: result.ok,
          distanceViolationCount: result.distanceViolationCount,
          forbiddenAdjacencyViolationCount: result.forbiddenAdjacencyViolationCount
        });
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "validate_layout_rules failed", requestId, msg);
        return failure(msg);
      }
    }
  );


  server.registerTool(
    "run_design_of_experiments",
    {
      description:
        "Run DOE on current graph by sweeping parameter grid and ranking experiments by takt-aware objective.",
      inputSchema: {
        paramGrid: z.object({
          parameters: z
            .array(
              z.object({
                key: z.string().min(1),
                values: z.array(z.number()).min(1),
                nodeTypeIncludes: z.array(z.string().min(1)).optional(),
                titleIncludes: z.array(z.string().min(1)).optional(),
                nodeIds: z.array(z.union([z.string().min(1), z.number()])).optional()
              })
            )
            .min(1),
          topK: z.number().int().positive().optional(),
          maxExperiments: z.number().int().positive().optional(),
          mode: z.enum(["dt", "event"]).optional(),
          fastest: z.boolean().optional(),
          includeBenchmark: z.boolean().optional(),
          benchmarkWallMs: z.number().int().positive().optional(),
          applyBest: z.boolean().optional()
        }),
        wallMs: z.number().int().positive().optional()
      }
    },
    async ({ paramGrid, wallMs }, extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "run_design_of_experiments called", requestId, {
        parameterCount: paramGrid.parameters.length,
        wallMs: typeof wallMs === "number" ? wallMs : null,
        topK: typeof paramGrid.topK === "number" ? paramGrid.topK : null,
        maxExperiments: typeof paramGrid.maxExperiments === "number" ? paramGrid.maxExperiments : null
      });
      try {
        const result = await runtime.runDesignOfExperiments(paramGrid, wallMs);
        log("INFO", "run_design_of_experiments completed", requestId, {
          requestedExperiments: result.requestedExperiments,
          executedExperiments: result.executedExperiments,
          bestExperiment: result.bestExperiment,
          bestScore: result.bestScore
        });
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "run_design_of_experiments failed", requestId, msg);
        return failure(msg);
      }
    }
  );


  server.registerTool(
    "set_random_seed",
    {
      description: "Set deterministic random seed used by fact_sim (overrides Math.random in page context).",
      inputSchema: {
        seed: z.number().int()
      }
    },
    async ({ seed }, extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "set_random_seed called", requestId, { seed });
      try {
        const result = await runtime.setRandomSeed(seed);
        log("INFO", "set_random_seed completed", requestId, result);
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "set_random_seed failed", requestId, msg);
        return failure(msg);
      }
    }
  );


  server.registerTool(
    "get_random_seed",
    {
      description: "Get current deterministic random seed/state for fact_sim page context."
    },
    async (extra) => {
      const requestId = String(extra.requestId);
      log("INFO", "get_random_seed called", requestId);
      try {
        const result = await runtime.getRandomSeed();
        log("INFO", "get_random_seed completed", requestId, result);
        return success(result);
      } catch (error) {
        const msg = errorMessage(error);
        log("ERROR", "get_random_seed failed", requestId, msg);
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

}
