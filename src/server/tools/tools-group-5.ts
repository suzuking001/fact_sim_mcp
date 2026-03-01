import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";

import { FactSimRuntime } from "../../fact-sim-runtime.js";
import { errorMessage, failure, log, success } from "../tool-helpers.js";

export function registerToolsGroup5(server: McpServer, runtime: FactSimRuntime): void {

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

}
