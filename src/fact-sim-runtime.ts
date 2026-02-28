import { createReadStream } from "node:fs";
import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { AddressInfo } from "node:net";
import path from "node:path";

import { Browser, BrowserContext, Page, chromium } from "playwright";

type Logger = (message: string, details?: unknown) => void;

const MIME_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp"
};

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] ?? "application/octet-stream";
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return String(error);
}

export type BenchmarkOutput = {
  wallMs: number;
  realStepMs: number;
  results: Array<{
    mode: string;
    modeLabel: string;
    renderCase: string;
    renderLabel: string;
    wallMs: number;
    simMs: number;
    loops: number;
    simSec: number;
    speed: number;
  }>;
};

export type SimulationStatus = {
  running: boolean;
  mode: string | null;
  simTimeMs: number | null;
  fastestMode: boolean | null;
  graphStatus: number | null;
  nodeCount: number;
  linkCount: number;
};

export type SinkKpi = {
  id: string | number | null;
  title: string;
  type: string | null;
  completedCount: number;
  throughputPerHour: number;
  averageCycleTimeSec: number | null;
  recentSamples: number;
};

export type KpiSummary = {
  running: boolean;
  mode: string | null;
  simTimeMs: number | null;
  simHours: number;
  nodeCount: number;
  linkCount: number;
  sinkCount: number;
  totalCompleted: number;
  throughputPerHourTotal: number;
  throughputPerHourAverage: number;
  projectedThroughputPerHour: number | null;
  sinkKpis: SinkKpi[];
  nodeTypeCounts: Record<string, number>;
};

export type ScenarioBenchmarkSummary = {
  bestHeadlessMode: string | null;
  bestHeadlessSpeed: number | null;
  headlessDtSpeed: number | null;
  headlessEventSpeed: number | null;
  renderDtSpeed: number | null;
  renderEventSpeed: number | null;
};

export type ScenarioMatrixItem = {
  example: string;
  ok: boolean;
  nodeCount: number | null;
  benchmark: BenchmarkOutput | null;
  summary: ScenarioBenchmarkSummary | null;
  error?: string;
};

export type ScenarioMatrixOutput = {
  requestedExamples: number;
  executedExamples: number;
  wallMs: number | null;
  scenarios: ScenarioMatrixItem[];
  totals: {
    succeeded: number;
    failed: number;
  };
};

export type ExampleListOutput = {
  examples: string[];
};

export type SetSimulationModeOutput = {
  previousMode: string | null;
  mode: string | null;
  restarted: boolean;
};

export type PlaybackSpeedOutput = {
  fastestMode: boolean | null;
  speedLabel: string | null;
};

export type ResetSimulationClockOutput = {
  running: boolean;
  simTimeMs: number | null;
};

export type SnapshotOutput = {
  savedTo: string;
};

export type ExportGraphJsonOutput = {
  nodeCount: number;
  linkCount: number;
  json: string;
};

export type ImportGraphJsonOutput = {
  nodeCount: number;
  linkCount: number;
  running: boolean;
  simTimeMs: number | null;
};

export type SetSimulationTimeOutput = {
  running: boolean;
  simTimeMs: number | null;
};

export type GraphOverviewNode = {
  id: string | number | null;
  type: string | null;
  title: string;
  pos: [number, number] | null;
};

export type GraphOverviewOutput = {
  nodeCount: number;
  linkCount: number;
  nodeTypeCounts: Record<string, number>;
  nodes?: GraphOverviewNode[];
  truncated?: boolean;
};

export type ExportEmbeddedHtmlOutput = {
  savedTo: string;
  length: number;
};

export type SaveTimelineCsvOutput = {
  savedTo: string;
  lineCount: number;
};

export type SaveGraphJsonOutput = {
  savedTo: string;
  nodeCount: number;
  linkCount: number;
  bytes: number;
};

export type LoadGraphJsonFileOutput = {
  sourcePath: string;
  nodeCount: number;
  linkCount: number;
  running: boolean;
  simTimeMs: number | null;
};

export type SaveScenarioReportOutput = {
  savedTo: string;
  executedExamples: number;
  succeeded: number;
  failed: number;
  bytes: number;
};

export type ValidateGraphJsonOutput = {
  valid: boolean;
  nodeCount: number;
  linkCount: number;
  warnings: string[];
};

export type SaveKpiSummaryOutput = {
  savedTo: string;
  sinkCount: number;
  totalCompleted: number;
  bytes: number;
};

export type SaveGraphOverviewOutput = {
  savedTo: string;
  nodeCount: number;
  linkCount: number;
  includeNodes: boolean;
  bytes: number;
};

export type OptimizationObjective = "throughput" | "throughput_per_node" | "balanced";

export type CandidateEvaluationOutput = {
  objective: OptimizationObjective;
  wallMs: number | null;
  score: number;
  benchmarkSummary: ScenarioBenchmarkSummary;
  graph: {
    nodeCount: number;
    linkCount: number;
  };
  kpi: {
    throughputPerHourTotal: number;
    projectedThroughputPerHour: number | null;
    totalCompleted: number;
    sinkCount: number;
  };
  warnings: string[];
};

export type CandidateRankingItem = {
  index: number;
  ok: boolean;
  score: number | null;
  nodeCount: number | null;
  linkCount: number | null;
  throughputPerHourTotal: number | null;
  bestHeadlessSpeed: number | null;
  error?: string;
};

export type CandidateRankingOutput = {
  objective: OptimizationObjective;
  wallMs: number | null;
  requestedCandidates: number;
  evaluatedCandidates: number;
  succeeded: number;
  failed: number;
  rankings: CandidateRankingItem[];
};

export type TopologySuggestion = {
  severity: "info" | "warn";
  code: string;
  message: string;
};

export type TopologyImprovementOutput = {
  nodeCount: number;
  linkCount: number;
  sourceNodeCount: number;
  sinkNodeCount: number;
  isolatedNodeCount: number;
  unreachableNodeCount: number;
  cycleDetected: boolean;
  linkToNodeRatio: number;
  nodeTypeCounts: Record<string, number>;
  warnings: string[];
  suggestions: TopologySuggestion[];
};

export type NodeTypesOutput = {
  count: number;
  types: string[];
};

export type AddNodeOutput = {
  nodeId: string | number | null;
  nodeType: string;
  title: string;
  pos: [number, number] | null;
  inputCount: number;
  outputCount: number;
  nodeCount: number;
  linkCount: number;
};

export type NodePortInfo = {
  slot: number;
  name: string;
  type: string | null;
  hasLink: boolean;
  linkCount: number;
};

export type NodePortsOutput = {
  nodeId: string | number;
  nodeType: string | null;
  title: string;
  inputCount: number;
  outputCount: number;
  inputs: NodePortInfo[];
  outputs: NodePortInfo[];
};

export type ConnectNodesOutput = {
  created: boolean;
  linkId: number;
  fromNodeId: string | number;
  toNodeId: string | number;
  fromSlot: number;
  toSlot: number;
  nodeCount: number;
  linkCount: number;
};

export type DisconnectNodesOutput = {
  removedCount: number;
  removedLinkIds: number[];
  nodeCount: number;
  linkCount: number;
};

export type RemoveNodeOutput = {
  removedNodeId: string | number;
  removedLinkCount: number;
  nodeCount: number;
  linkCount: number;
};

export type UpdateNodeOutput = {
  nodeId: string | number;
  nodeType: string | null;
  title: string;
  properties: Record<string, unknown>;
  updatedTitle: boolean;
  updatedPropertyKeys: string[];
  mergedProperties: boolean;
  nodeCount: number;
  linkCount: number;
};

export type PortKind = "work" | "signal" | "carrier" | "pallet";

export type PortKindSlot = {
  slot: number;
  name: string;
  type: string | null;
  hasLink: boolean;
  linkCount: number;
};

export type PortKindSlotsOutput = {
  nodeId: string | number;
  nodeType: string | null;
  title: string;
  portKind: PortKind;
  inputs: PortKindSlot[];
  outputs: PortKindSlot[];
};

export type ConnectByPortKindOutput = {
  created: boolean;
  linkId: number;
  fromNodeId: string | number;
  toNodeId: string | number;
  fromSlot: number;
  toSlot: number;
  nodeCount: number;
  linkCount: number;
  portKind: PortKind;
  fromCandidates: number;
  toCandidates: number;
};

export type ClearGraphOutput = {
  removedNodeCount: number;
  removedLinkCount: number;
  nodeCount: number;
  linkCount: number;
};

export type RepairGraphLinksOutput = {
  nodeCount: number;
  linkCount: number;
  repairedInputCount: number;
  repairedOutputCount: number;
  droppedDanglingLinks: number;
  droppedInvalidSlotLinks: number;
  droppedDuplicateInputLinks: number;
  warnings: string[];
};

export type RunSimulationForOutput = {
  wallMs: number;
  running: boolean;
  mode: string | null;
  fastestMode: boolean | null;
  startSimTimeMs: number | null;
  simTimeMs: number | null;
  advancedSimMs: number | null;
  kpi: KpiSummary;
  benchmarkSummary: ScenarioBenchmarkSummary | null;
};

export type BottleneckNodeReport = {
  nodeId: string | number | null;
  title: string;
  type: string | null;
  totalDurationSec: number;
  processSec: number;
  waitSec: number;
  downSec: number;
  idleSec: number;
  processRatio: number;
  waitRatio: number;
  downRatio: number;
  idleRatio: number;
  bottleneckScore: number;
};

export type BottleneckReportOutput = {
  lineCount: number;
  nodeCount: number;
  totalObservedSec: number;
  topN: number;
  rows: BottleneckNodeReport[];
};

export type NodeTypeDescriptionOutput = {
  nodeType: string;
  title: string;
  inputCount: number;
  outputCount: number;
  inputs: NodePortInfo[];
  outputs: NodePortInfo[];
  defaultProperties: Record<string, unknown>;
};

export type BlueprintNodeInput = {
  key: string;
  nodeType: string;
  title?: string;
  x?: number;
  y?: number;
  lane?: number;
  properties?: Record<string, unknown>;
};

export type BlueprintEdgeInput = {
  fromKey: string;
  toKey: string;
  portKind?: PortKind;
  fromSlot?: number;
  toSlot?: number;
  allowDuplicate?: boolean;
};

export type BuildGraphFromBlueprintOutput = {
  createdNodes: Array<{
    key: string;
    nodeId: string | number | null;
    nodeType: string;
    title: string;
    pos: [number, number] | null;
  }>;
  createdLinks: Array<{
    fromKey: string;
    toKey: string;
    created: boolean;
    linkId: number;
    portKind: PortKind | null;
    fromSlot: number;
    toSlot: number;
  }>;
  nodeCount: number;
  linkCount: number;
};

export type LineOptimizationStep = {
  iteration: number;
  changedNodeIds: Array<string | number>;
  throughputPerHourTotal: number;
  totalCompleted: number;
  score: number;
  improved: boolean;
};

export type OptimizeLineByBottleneckOutput = {
  iterations: number;
  runWallMs: number;
  bottleneckTopN: number;
  baseline: {
    throughputPerHourTotal: number;
    totalCompleted: number;
    score: number;
  };
  bestIteration: number;
  best: {
    throughputPerHourTotal: number;
    totalCompleted: number;
    score: number;
  };
  history: LineOptimizationStep[];
  warnings: string[];
};

export type BlueprintBuildOptions = {
  clearExisting?: boolean;
  originX?: number;
  originY?: number;
  xPitch?: number;
  yPitch?: number;
};

export type OptimizeLineOptions = {
  iterations?: number;
  runWallMs?: number;
  bottleneckTopN?: number;
  minSampleSec?: number;
  maxNodesPerIteration?: number;
  processReductionRatio?: number;
  downReductionRatio?: number;
  minProcessTime?: number;
  minDownTime?: number;
};
export class FactSimRuntime {
  private readonly repoRoot: string;
  private readonly preferredPort: number;
  private readonly logger: Logger;

  private staticServer: ReturnType<typeof createServer> | null = null;
  private port = 0;
  private browser: Browser | null = null;
  private browserContext: BrowserContext | null = null;
  private page: Page | null = null;
  private initializing: Promise<void> | null = null;

  constructor(options: { repoRoot: string; preferredPort?: number; logger?: Logger }) {
    this.repoRoot = path.resolve(options.repoRoot);
    this.preferredPort = options.preferredPort ?? 8123;
    this.logger = options.logger ?? (() => undefined);
  }

  async loadExample(example: string): Promise<{ example: string; nodeCount: number }> {
    const page = await this.ensureReady();
    await page.evaluate(async (requestedExample) => {
      const w = window as unknown as Record<string, unknown>;
      const makeExample = w.makeExample as undefined | ((kind: string) => Promise<unknown> | unknown);
      if (typeof makeExample !== "function") {
        throw new Error("makeExample is not available in fact_sim");
      }

      await Promise.resolve(makeExample(requestedExample));
    }, example);

    const repaired = await this.repairGraphLinks();
    return {
      example,
      nodeCount: repaired.nodeCount
    };
  }

  async startSimulation(): Promise<{ running: boolean; mode: string | null; simTimeMs: number | null }> {
    const page = await this.ensureReady();
    return page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>;
      const startSimulation = w.startSimulation as undefined | (() => void);
      if (typeof startSimulation !== "function") {
        throw new Error("startSimulation is not available");
      }

      startSimulation();

      const isSimRunning = w.isSimRunning as undefined | (() => boolean);
      const app = w.App as { getSimMode?: () => string; simMode?: string } | undefined;
      const simNow = w.simNow as undefined | (() => number);
      return {
        running: typeof isSimRunning === "function" ? !!isSimRunning() : false,
        mode: app?.getSimMode?.() ?? app?.simMode ?? null,
        simTimeMs: typeof simNow === "function" ? Number(simNow()) : null
      };
    });
  }

  async stopSimulation(): Promise<{ running: boolean; simTimeMs: number | null }> {
    const page = await this.ensureReady();
    return page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>;
      const stopSimulation = w.stopSimulation as undefined | (() => void);
      if (typeof stopSimulation !== "function") {
        throw new Error("stopSimulation is not available");
      }

      stopSimulation();

      const isSimRunning = w.isSimRunning as undefined | (() => boolean);
      const simNow = w.simNow as undefined | (() => number);
      return {
        running: typeof isSimRunning === "function" ? !!isSimRunning() : false,
        simTimeMs: typeof simNow === "function" ? Number(simNow()) : null
      };
    });
  }

  async runBenchmark(wallMs?: number): Promise<BenchmarkOutput> {
    const page = await this.ensureReady();
    return page.evaluate(async (requestedWallMs) => {
      const w = window as unknown as Record<string, unknown>;
      const app = w.App as { runEngineBenchmarkAsync?: (options: Record<string, unknown>) => Promise<BenchmarkOutput> } | undefined;

      if (!app || typeof app.runEngineBenchmarkAsync !== "function") {
        throw new Error("App.runEngineBenchmarkAsync is not available");
      }

      const options: Record<string, unknown> = {};
      if (typeof requestedWallMs === "number" && Number.isFinite(requestedWallMs)) {
        options.wallMs = Math.max(100, Math.floor(requestedWallMs));
      }

      return app.runEngineBenchmarkAsync(options);
    }, wallMs);
  }

  async exportTimelineCsv(): Promise<{ lineCount: number; csv: string }> {
    const page = await this.ensureReady();
    return page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>;
      const app = w.App as { timelineChart?: unknown; graph?: unknown } | undefined;
      const chart = app?.timelineChart as Record<string, unknown> | undefined;
      if (!chart) {
        throw new Error("timelineChart is not available");
      }
      const graph = app?.graph;
      if (!chart.graph && graph) {
        const attachGraph = chart.attachGraph as undefined | ((g: unknown) => void);
        if (typeof attachGraph === "function") {
          attachGraph(graph);
        } else {
          chart.graph = graph;
        }
      }

      const nowSec = Number((chart._lastNow as number) ?? 0) || Number((chart._nowSec as (() => number) | undefined)?.());
      const historySec = Number(chart.historySec) || 0;
      const cutoff = nowSec - historySec;

      const getNodeList = chart._nodeList as undefined | (() => unknown[]);
      const getNodeKey = chart._nodeKey as undefined | ((node: unknown) => string | number);
      const entries = chart.entries as undefined | Map<string | number, { label?: string; segments?: Array<Record<string, unknown>> }>;
      if (typeof getNodeList !== "function" || typeof getNodeKey !== "function" || !(entries instanceof Map)) {
        throw new Error("timelineChart internals are unavailable");
      }

      const esc = (value: unknown): string => {
        if (value === null || typeof value === "undefined") return "";
        const text = String(value);
        if (/[,"\n]/.test(text)) return `"${text.replace(/"/g, "\"\"")}"`;
        return text;
      };

      const rows: string[][] = [];
      rows.push(["node", "nodeId", "nodeOrder", "start", "end", "duration", "state", "workId", "agvId"]);

      const nodes = getNodeList.call(chart);
      const orderMap = new Map<string | number, number>();
      nodes.forEach((node, index) => {
        orderMap.set(getNodeKey.call(chart, node), index + 1);
      });

      for (const node of nodes) {
        const key = getNodeKey.call(chart, node);
        const entry = entries.get(key);
        if (!entry || !Array.isArray(entry.segments) || !entry.segments.length) {
          continue;
        }

        const nodeId = (node as { id?: unknown }).id ?? "";
        const nodeOrder = orderMap.get(key) ?? "";
        for (const seg of entry.segments) {
          const start = Math.max(Number(seg.start) || 0, cutoff);
          const end = Math.min(Number(seg.end) || 0, nowSec);
          if (end <= cutoff || end <= start) continue;
          const duration = Math.max(0, end - start);
          rows.push([
            esc(entry.label ?? ""),
            esc(nodeId),
            String(nodeOrder),
            start.toFixed(3),
            end.toFixed(3),
            duration.toFixed(3),
            String(seg.state ?? "other"),
            esc(seg.workId ?? ""),
            esc(seg.agvId ?? "")
          ]);
        }
      }

      const csv = rows.map((row) => row.join(",")).join("\n");
      return {
        lineCount: rows.length,
        csv
      };
    });
  }

  async buildShareUrl(): Promise<{ url: string; length: number }> {
    const page = await this.ensureReady();
    return page.evaluate(async () => {
      const w = window as unknown as Record<string, unknown>;
      const app = w.App as { buildEmbeddedShareUrl?: () => Promise<string> } | undefined;
      if (!app || typeof app.buildEmbeddedShareUrl !== "function") {
        throw new Error("App.buildEmbeddedShareUrl is not available");
      }

      const url = await app.buildEmbeddedShareUrl();
      return {
        url,
        length: url.length
      };
    });
  }

  async getSimulationStatus(): Promise<SimulationStatus> {
    const page = await this.ensureReady();
    return page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>;
      const isSimRunning = w.isSimRunning as undefined | (() => boolean);
      const simNow = w.simNow as undefined | (() => number);
      const isFastestMode = w.isFastestMode as undefined | (() => boolean);
      const app = w.App as
        | {
            graph?: { _nodes?: unknown[]; links?: Record<string, unknown>; status?: number };
            getSimMode?: () => string;
            simMode?: string;
          }
        | undefined;

      const nodes = Array.isArray(app?.graph?._nodes) ? app.graph._nodes : [];
      const linkMap =
        app?.graph?.links && typeof app.graph.links === "object"
          ? (app.graph.links as Record<string, unknown>)
          : {};

      return {
        running: typeof isSimRunning === "function" ? !!isSimRunning() : false,
        mode: app?.getSimMode?.() ?? app?.simMode ?? null,
        simTimeMs: typeof simNow === "function" ? Number(simNow()) : null,
        fastestMode: typeof isFastestMode === "function" ? !!isFastestMode() : null,
        graphStatus: typeof app?.graph?.status === "number" ? Number(app.graph.status) : null,
        nodeCount: nodes.length,
        linkCount: Object.keys(linkMap).length
      };
    });
  }

  async getKpiSummary(): Promise<KpiSummary> {
    const page = await this.ensureReady();
    return page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>;
      const isSimRunning = w.isSimRunning as undefined | (() => boolean);
      const simNow = w.simNow as undefined | (() => number);
      const app = w.App as
        | {
            graph?: { _nodes?: unknown[]; links?: Record<string, unknown> };
            getSimMode?: () => string;
            simMode?: string;
          }
        | undefined;

      const nodes = Array.isArray(app?.graph?._nodes) ? app.graph._nodes : [];
      const linkMap =
        app?.graph?.links && typeof app.graph.links === "object"
          ? (app.graph.links as Record<string, unknown>)
          : {};

      const nodeTypeCounts: Record<string, number> = {};
      const sinkKpis: SinkKpi[] = [];

      for (const node of nodes) {
        const asNode = node as {
          id?: unknown;
          title?: unknown;
          type?: unknown;
          _recv?: unknown[];
          _history?: Array<{ cycle?: unknown }>;
          getThroughputPerHour?: () => number;
        };

        const rawType = String(asNode.type ?? "").trim();
        const typeKey = rawType || "unknown";
        nodeTypeCounts[typeKey] = (nodeTypeCounts[typeKey] ?? 0) + 1;

        const title = String(asNode.title ?? "").trim();
        const recv = Array.isArray(asNode._recv) ? asNode._recv : [];
        const hasRecv = Array.isArray(asNode._recv);
        const lowerType = rawType.toLowerCase();
        const lowerTitle = title.toLowerCase();
        const isLikelySink =
          lowerType.includes("sink") ||
          lowerTitle.includes("sink") ||
          (hasRecv && typeof asNode.getThroughputPerHour === "function");

        if (!isLikelySink) continue;

        let throughput = 0;
        if (typeof asNode.getThroughputPerHour === "function") {
          try {
            const current = Number(asNode.getThroughputPerHour());
            throughput = Number.isFinite(current) && current > 0 ? current : 0;
          } catch (_error) {
            throughput = 0;
          }
        }

        const cyclesSec = (Array.isArray(asNode._history) ? asNode._history : [])
          .map((x) => Number(x?.cycle))
          .filter((v) => Number.isFinite(v) && v > 0)
          .map((ms) => ms / 1000);

        const avgCycleTimeSec =
          cyclesSec.length > 0
            ? cyclesSec.reduce((sum, value) => sum + value, 0) / cyclesSec.length
            : null;

        sinkKpis.push({
          id:
            typeof asNode.id === "string" || typeof asNode.id === "number"
              ? asNode.id
              : null,
          title,
          type: rawType || null,
          completedCount: recv.length,
          throughputPerHour: throughput,
          averageCycleTimeSec: avgCycleTimeSec,
          recentSamples: cyclesSec.length
        });
      }

      const simTimeMsRaw = typeof simNow === "function" ? Number(simNow()) : Number.NaN;
      const simTimeMs = Number.isFinite(simTimeMsRaw) ? simTimeMsRaw : null;
      const simHours = simTimeMs !== null && simTimeMs > 0 ? simTimeMs / (1000 * 60 * 60) : 0;

      const totalCompleted = sinkKpis.reduce((sum, sink) => sum + sink.completedCount, 0);
      const throughputPerHourTotal = sinkKpis.reduce((sum, sink) => sum + sink.throughputPerHour, 0);
      const throughputPerHourAverage = sinkKpis.length > 0 ? throughputPerHourTotal / sinkKpis.length : 0;
      const projectedThroughputPerHour = simHours > 0 ? totalCompleted / simHours : null;

      return {
        running: typeof isSimRunning === "function" ? !!isSimRunning() : false,
        mode: app?.getSimMode?.() ?? app?.simMode ?? null,
        simTimeMs,
        simHours,
        nodeCount: nodes.length,
        linkCount: Object.keys(linkMap).length,
        sinkCount: sinkKpis.length,
        totalCompleted,
        throughputPerHourTotal,
        throughputPerHourAverage,
        projectedThroughputPerHour,
        sinkKpis,
        nodeTypeCounts
      };
    });
  }

  async runScenarioMatrix(examples: string[], wallMs?: number): Promise<ScenarioMatrixOutput> {
    const normalizedExamples = examples.map((example) => String(example).trim()).filter((example) => example.length > 0);
    const uniqueExamples = [...new Set(normalizedExamples)];
    if (!uniqueExamples.length) {
      throw new Error("run_scenario_matrix requires at least one valid example name");
    }

    const scenarioRows: ScenarioMatrixItem[] = [];
    const sanitizedWallMs =
      typeof wallMs === "number" && Number.isFinite(wallMs) ? Math.max(100, Math.floor(wallMs)) : undefined;

    for (const example of uniqueExamples) {
      try {
        await this.stopSimulation();
      } catch (_error) {
        // Ignore stop failures when simulation is not active.
      }

      try {
        const load = await this.loadExample(example);
        const benchmark = await this.runBenchmark(sanitizedWallMs);
        scenarioRows.push({
          example,
          ok: true,
          nodeCount: load.nodeCount,
          benchmark,
          summary: this.summarizeBenchmark(benchmark)
        });
      } catch (error) {
        scenarioRows.push({
          example,
          ok: false,
          nodeCount: null,
          benchmark: null,
          summary: null,
          error: toErrorMessage(error)
        });
      }
    }

    const succeeded = scenarioRows.filter((row) => row.ok).length;

    return {
      requestedExamples: examples.length,
      executedExamples: uniqueExamples.length,
      wallMs: sanitizedWallMs ?? null,
      scenarios: scenarioRows,
      totals: {
        succeeded,
        failed: scenarioRows.length - succeeded
      }
    };
  }

  async listExamples(): Promise<ExampleListOutput> {
    const page = await this.ensureReady();
    return page.evaluate(() => {
      const fallback = [
        "simple",
        "branch",
        "shuttle_line5",
        "carrier_config",
        "pallet_station_demo",
        "sample_line1"
      ];

      const select = document.getElementById("exampleSelect") as
        | { options?: ArrayLike<{ value?: unknown }> }
        | null;
      const fromSelect = select?.options
        ? Array.from(select.options)
            .map((opt) => String(opt?.value ?? "").trim())
            .filter((value) => value.length > 0)
        : [];

      const examples = [...new Set([...fromSelect, ...fallback])];
      return { examples };
    });
  }

  async setSimulationMode(mode: string): Promise<SetSimulationModeOutput> {
    const page = await this.ensureReady();
    return page.evaluate((requestedMode) => {
      const w = window as unknown as Record<string, unknown>;
      const app = w.App as
        | {
            setSimMode?: (mode: string) => string;
            getSimMode?: () => string;
            simMode?: string;
          }
        | undefined;
      if (!app || typeof app.setSimMode !== "function") {
        throw new Error("App.setSimMode is not available");
      }

      const target = String(requestedMode ?? "").trim();
      if (!target) {
        throw new Error("mode is required");
      }

      const isSimRunning = w.isSimRunning as undefined | (() => boolean);
      const stopSimulation = w.stopSimulation as undefined | (() => void);
      const startSimulation = w.startSimulation as undefined | (() => void);

      const running = typeof isSimRunning === "function" ? !!isSimRunning() : false;
      const canRestart = typeof stopSimulation === "function" && typeof startSimulation === "function";
      const restarted = running && canRestart;

      const previousMode = app.getSimMode?.() ?? app.simMode ?? null;
      if (restarted) {
        stopSimulation();
      }

      const nextMode = app.setSimMode(target);

      if (restarted) {
        startSimulation();
      }

      return {
        previousMode,
        mode: nextMode ?? app.getSimMode?.() ?? app.simMode ?? null,
        restarted
      };
    }, mode);
  }

  async setPlaybackSpeed(speed?: number, fastest?: boolean): Promise<PlaybackSpeedOutput> {
    const page = await this.ensureReady();
    return page.evaluate(
      ({ requestedSpeed, requestedFastest }: { requestedSpeed: number | null; requestedFastest: boolean | null }) => {
        const w = window as unknown as Record<string, unknown>;
        const setSpeed = w.setSpeed as undefined | ((value: number) => void);
        const setFastestMode = w.setFastestMode as undefined | ((enabled: boolean) => void);
        const isFastestMode = w.isFastestMode as undefined | (() => boolean);

        const hasSpeed = typeof requestedSpeed === "number" && Number.isFinite(requestedSpeed);
        const hasFastest = typeof requestedFastest === "boolean";
        if (!hasSpeed && !hasFastest) {
          throw new Error("either speed or fastest must be provided");
        }

        if (hasSpeed) {
          if (typeof setSpeed !== "function") {
            throw new Error("setSpeed is not available");
          }
          setSpeed(Number(requestedSpeed));
        }

        if (hasFastest) {
          if (typeof setFastestMode !== "function") {
            throw new Error("setFastestMode is not available");
          }
          setFastestMode(Boolean(requestedFastest));
        }

        const fastestMode = typeof isFastestMode === "function" ? !!isFastestMode() : null;
        const speedEl = document.getElementById("speedFactor") as { textContent?: unknown } | null;
        const speedLabelRaw = speedEl?.textContent;

        return {
          fastestMode,
          speedLabel: typeof speedLabelRaw === "string" ? speedLabelRaw.trim() : null
        };
      },
      {
        requestedSpeed: typeof speed === "number" && Number.isFinite(speed) ? speed : null,
        requestedFastest: typeof fastest === "boolean" ? fastest : null
      }
    );
  }

  async resetSimulationClock(): Promise<ResetSimulationClockOutput> {
    const page = await this.ensureReady();
    return page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>;
      const isSimRunning = w.isSimRunning as undefined | (() => boolean);
      const stopSimulation = w.stopSimulation as undefined | (() => void);
      const resetSimClock = w.resetSimClock as undefined | (() => void);
      const simNow = w.simNow as undefined | (() => number);

      if (typeof resetSimClock !== "function") {
        throw new Error("resetSimClock is not available");
      }

      if (typeof isSimRunning === "function" && isSimRunning() && typeof stopSimulation === "function") {
        stopSimulation();
      }

      resetSimClock();

      return {
        running: typeof isSimRunning === "function" ? !!isSimRunning() : false,
        simTimeMs: typeof simNow === "function" ? Number(simNow()) : null
      };
    });
  }

  async clearGraph(): Promise<ClearGraphOutput> {
    const page = await this.ensureReady();
    return page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>;
      const app = w.App as
        | {
            graph?: {
              clear?: () => void;
              _nodes?: unknown[];
              links?: Record<string, unknown>;
            };
            canvas?: { draw?: (a?: boolean, b?: boolean) => void };
          }
        | undefined;

      const graph = app?.graph;
      if (!graph || typeof graph.clear !== "function") {
        throw new Error("App.graph.clear is not available");
      }

      const nodes = Array.isArray(graph._nodes) ? graph._nodes : [];
      const links = graph.links && typeof graph.links === "object" ? graph.links : {};
      const removedNodeCount = nodes.length;
      const removedLinkCount = Object.keys(links).length;

      const isSimRunning = w.isSimRunning as undefined | (() => boolean);
      const stopSimulation = w.stopSimulation as undefined | (() => void);
      const resetSimClock = w.resetSimClock as undefined | (() => void);

      if (typeof isSimRunning === "function" && isSimRunning() && typeof stopSimulation === "function") {
        stopSimulation();
      }

      graph.clear();
      if (typeof resetSimClock === "function") {
        resetSimClock();
      }

      if (app?.canvas && typeof app.canvas.draw === "function") {
        app.canvas.draw(true, true);
      }

      const afterNodes = Array.isArray(graph._nodes) ? graph._nodes.length : 0;
      const afterLinks = graph.links && typeof graph.links === "object" ? Object.keys(graph.links).length : 0;

      return {
        removedNodeCount,
        removedLinkCount,
        nodeCount: afterNodes,
        linkCount: afterLinks
      };
    });
  }

  async repairGraphLinks(): Promise<RepairGraphLinksOutput> {
    const page = await this.ensureReady();
    return page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>;
      const app = w.App as
        | {
            graph?: {
              _nodes?: unknown[];
              links?: Record<string, unknown>;
              last_link_id?: number;
            };
            canvas?: { draw?: (a?: boolean, b?: boolean) => void };
            repairGraphLinks?: (graph?: unknown) => Record<string, unknown>;
          }
        | undefined;

      const graph = app?.graph;
      if (!graph) {
        throw new Error("App.graph is not available");
      }

      const fallbackRepair = () => {
        const nodes = Array.isArray(graph._nodes) ? graph._nodes : [];
        const sourceLinks = graph.links && typeof graph.links === "object" ? graph.links : {};

        const nodeById = new Map<string, Record<string, unknown>>();
        for (const node of nodes) {
          const nodeAs = node as { id?: unknown };
          if (typeof nodeAs.id === "string" || typeof nodeAs.id === "number") {
            nodeById.set(String(nodeAs.id), node as Record<string, unknown>);
          }
        }

        for (const node of nodes) {
          const nodeAs = node as {
            inputs?: Array<Record<string, unknown>>;
            outputs?: Array<Record<string, unknown>>;
          };

          if (Array.isArray(nodeAs.inputs)) {
            for (const input of nodeAs.inputs) {
              input.link = null;
            }
          }
          if (Array.isArray(nodeAs.outputs)) {
            for (const output of nodeAs.outputs) {
              output.links = null;
            }
          }
        }

        let repairedInputCount = 0;
        let repairedOutputCount = 0;
        let droppedDanglingLinks = 0;
        let droppedInvalidSlotLinks = 0;
        let droppedDuplicateInputLinks = 0;

        const repairedLinks: Record<string, unknown> = {};
        let maxLinkId = 0;

        for (const [rawKey, rawLink] of Object.entries(sourceLinks)) {
          if (!rawLink || typeof rawLink !== "object") {
            droppedInvalidSlotLinks += 1;
            continue;
          }

          const link = rawLink as {
            id?: unknown;
            origin_id?: unknown;
            target_id?: unknown;
            origin_slot?: unknown;
            target_slot?: unknown;
          };

          let linkId = Number(link.id);
          if (!Number.isFinite(linkId) || linkId <= 0) {
            const fromKey = Number(rawKey);
            if (!Number.isFinite(fromKey) || fromKey <= 0) {
              droppedInvalidSlotLinks += 1;
              continue;
            }
            linkId = Math.floor(fromKey);
          } else {
            linkId = Math.floor(linkId);
          }

          const originId = link.origin_id;
          const targetId = link.target_id;
          const originSlot = Number(link.origin_slot);
          const targetSlot = Number(link.target_slot);

          if (
            (typeof originId !== "string" && typeof originId !== "number") ||
            (typeof targetId !== "string" && typeof targetId !== "number") ||
            !Number.isFinite(originSlot) ||
            !Number.isFinite(targetSlot)
          ) {
            droppedInvalidSlotLinks += 1;
            continue;
          }

          const originNode = nodeById.get(String(originId)) as
            | { outputs?: Array<Record<string, unknown>> }
            | undefined;
          const targetNode = nodeById.get(String(targetId)) as
            | { inputs?: Array<Record<string, unknown>> }
            | undefined;

          if (!originNode || !targetNode) {
            droppedDanglingLinks += 1;
            continue;
          }

          const os = Math.floor(originSlot);
          const ts = Math.floor(targetSlot);

          if (
            !Array.isArray(originNode.outputs) ||
            !Array.isArray(targetNode.inputs) ||
            os < 0 ||
            ts < 0 ||
            os >= originNode.outputs.length ||
            ts >= targetNode.inputs.length
          ) {
            droppedInvalidSlotLinks += 1;
            continue;
          }

          const outputPort = originNode.outputs[os] as { links?: unknown };
          const inputPort = targetNode.inputs[ts] as { link?: unknown };

          if (
            inputPort.link !== null &&
            typeof inputPort.link !== "undefined" &&
            Number(inputPort.link) !== linkId
          ) {
            droppedDuplicateInputLinks += 1;
            continue;
          }

          if (!Array.isArray(outputPort.links)) {
            outputPort.links = [];
          }
          const outputLinks = outputPort.links as number[];
          if (!outputLinks.includes(linkId)) {
            outputLinks.push(linkId);
            repairedOutputCount += 1;
          }

          if (inputPort.link === null || typeof inputPort.link === "undefined") {
            inputPort.link = linkId;
            repairedInputCount += 1;
          }

          link.id = linkId;
          link.origin_slot = os;
          link.target_slot = ts;
          repairedLinks[String(linkId)] = link;
          if (linkId > maxLinkId) maxLinkId = linkId;
        }

        for (const node of nodes) {
          const nodeAs = node as { outputs?: Array<{ links?: unknown }> };
          if (!Array.isArray(nodeAs.outputs)) continue;
          for (const output of nodeAs.outputs) {
            if (!Array.isArray(output.links)) continue;
            if (!output.links.length) {
              output.links = null;
              continue;
            }
            output.links.sort((a, b) => Number(a) - Number(b));
          }
        }

        graph.links = repairedLinks;
        if (typeof graph.last_link_id === "number") {
          graph.last_link_id = Math.max(graph.last_link_id, maxLinkId);
        } else {
          graph.last_link_id = maxLinkId;
        }

        return {
          nodeCount: nodes.length,
          linkCount: Object.keys(repairedLinks).length,
          repairedInputCount,
          repairedOutputCount,
          droppedDanglingLinks,
          droppedInvalidSlotLinks,
          droppedDuplicateInputLinks
        };
      };

      let summary: Record<string, unknown>;
      if (app && typeof app.repairGraphLinks === "function") {
        summary = app.repairGraphLinks(graph) as Record<string, unknown>;
      } else {
        summary = fallbackRepair();
      }

      if (app?.canvas && typeof app.canvas.draw === "function") {
        app.canvas.draw(true, true);
      }

      const output: RepairGraphLinksOutput = {
        nodeCount: Number(summary.nodeCount ?? 0) || 0,
        linkCount: Number(summary.linkCount ?? 0) || 0,
        repairedInputCount: Number(summary.repairedInputCount ?? 0) || 0,
        repairedOutputCount: Number(summary.repairedOutputCount ?? 0) || 0,
        droppedDanglingLinks: Number(summary.droppedDanglingLinks ?? 0) || 0,
        droppedInvalidSlotLinks: Number(summary.droppedInvalidSlotLinks ?? 0) || 0,
        droppedDuplicateInputLinks: Number(summary.droppedDuplicateInputLinks ?? 0) || 0,
        warnings: []
      };

      if (output.droppedDanglingLinks > 0) {
        output.warnings.push(String(output.droppedDanglingLinks) + " dangling links were removed.");
      }
      if (output.droppedInvalidSlotLinks > 0) {
        output.warnings.push(String(output.droppedInvalidSlotLinks) + " invalid-slot links were removed.");
      }
      if (output.droppedDuplicateInputLinks > 0) {
        output.warnings.push(String(output.droppedDuplicateInputLinks) + " duplicate input links were removed.");
      }

      return output;
    });
  }

  async runSimulationFor(
    wallMs: number,
    mode?: "dt" | "event",
    fastest?: boolean,
    includeBenchmark?: boolean,
    benchmarkWallMs?: number
  ): Promise<RunSimulationForOutput> {
    const waitMs = Math.max(100, Math.min(10 * 60 * 1000, Math.floor(Number(wallMs) || 0)));
    if (!Number.isFinite(waitMs)) {
      throw new Error("wallMs must be a finite number");
    }

    if (mode === "dt" || mode === "event") {
      await this.setSimulationMode(mode);
    }

    if (typeof fastest === "boolean") {
      await this.setPlaybackSpeed(undefined, fastest);
    }

    const started = await this.startSimulation();
    await new Promise<void>((resolve) => {
      setTimeout(() => resolve(), waitMs);
    });
    const stopped = await this.stopSimulation();
    const status = await this.getSimulationStatus();
    const kpi = await this.getKpiSummary();

    let benchmarkSummary: ScenarioBenchmarkSummary | null = null;
    if (includeBenchmark) {
      const bench = await this.runBenchmark(benchmarkWallMs);
      benchmarkSummary = this.summarizeBenchmark(bench);
    }

    const startTime = typeof started.simTimeMs === "number" ? started.simTimeMs : null;
    const endTime = typeof stopped.simTimeMs === "number" ? stopped.simTimeMs : null;

    return {
      wallMs: waitMs,
      running: stopped.running,
      mode: status.mode,
      fastestMode: status.fastestMode,
      startSimTimeMs: startTime,
      simTimeMs: endTime,
      advancedSimMs: startTime !== null && endTime !== null ? Math.max(0, endTime - startTime) : null,
      kpi,
      benchmarkSummary
    };
  }

  async getBottleneckReport(topN?: number, minSampleSec?: number): Promise<BottleneckReportOutput> {
    const timeline = await this.exportTimelineCsv();
    const rows = this.parseTimelineCsv(timeline.csv);
    const normalizedTopN = Math.max(1, Math.min(50, Math.floor(Number(topN) || 5)));
    const minDuration = Number.isFinite(Number(minSampleSec)) ? Math.max(0, Number(minSampleSec)) : 1;

    const buckets = new Map<
      string,
      {
        nodeId: string | number | null;
        title: string;
        type: string | null;
        processSec: number;
        waitSec: number;
        downSec: number;
        idleSec: number;
      }
    >();

    for (const row of rows) {
      const duration = Number(row.duration);
      if (!Number.isFinite(duration) || duration <= 0) continue;

      const title = String(row.node ?? "").trim();
      const nodeIdRaw = String(row.nodeId ?? "").trim();
      const nodeIdNumber = Number(nodeIdRaw);
      const nodeId: string | number | null = nodeIdRaw.length
        ? Number.isFinite(nodeIdNumber)
          ? nodeIdNumber
          : nodeIdRaw
        : null;

      const key = (title || "(unknown)") + "|" + String(nodeId ?? "");
      const state = String(row.state ?? "").trim().toLowerCase();
      const bucket =
        buckets.get(key) ??
        {
          nodeId,
          title: title || "(unknown)",
          type: null,
          processSec: 0,
          waitSec: 0,
          downSec: 0,
          idleSec: 0
        };

      if (state.includes("process")) {
        bucket.processSec += duration;
      } else if (state.includes("wait")) {
        bucket.waitSec += duration;
      } else if (state.includes("down")) {
        bucket.downSec += duration;
      } else {
        bucket.idleSec += duration;
      }

      buckets.set(key, bucket);
    }

    const mapped: BottleneckNodeReport[] = [];
    let totalObservedSec = 0;

    for (const bucket of buckets.values()) {
      const total = bucket.processSec + bucket.waitSec + bucket.downSec + bucket.idleSec;
      if (total < minDuration) continue;
      totalObservedSec += total;

      const processRatio = total > 0 ? bucket.processSec / total : 0;
      const waitRatio = total > 0 ? bucket.waitSec / total : 0;
      const downRatio = total > 0 ? bucket.downSec / total : 0;
      const idleRatio = total > 0 ? bucket.idleSec / total : 0;

      const bottleneckScore = total * (processRatio * 1.0 + waitRatio * 0.8 + downRatio * 0.45);

      mapped.push({
        nodeId: bucket.nodeId,
        title: bucket.title,
        type: bucket.type,
        totalDurationSec: Number(total.toFixed(3)),
        processSec: Number(bucket.processSec.toFixed(3)),
        waitSec: Number(bucket.waitSec.toFixed(3)),
        downSec: Number(bucket.downSec.toFixed(3)),
        idleSec: Number(bucket.idleSec.toFixed(3)),
        processRatio: Number(processRatio.toFixed(4)),
        waitRatio: Number(waitRatio.toFixed(4)),
        downRatio: Number(downRatio.toFixed(4)),
        idleRatio: Number(idleRatio.toFixed(4)),
        bottleneckScore: Number(bottleneckScore.toFixed(3))
      });
    }

    mapped.sort((a, b) => b.bottleneckScore - a.bottleneckScore);

    return {
      lineCount: timeline.lineCount,
      nodeCount: mapped.length,
      totalObservedSec: Number(totalObservedSec.toFixed(3)),
      topN: normalizedTopN,
      rows: mapped.slice(0, normalizedTopN)
    };
  }

  async captureSnapshotPng(fileName?: string): Promise<SnapshotOutput> {
    const page = await this.ensureReady();
    const targetPath = this.resolveSnapshotPath(fileName);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await page.screenshot({
      path: targetPath,
      type: "png",
      fullPage: true
    });

    return {
      savedTo: targetPath
    };
  }

  async exportGraphJson(pretty?: boolean): Promise<ExportGraphJsonOutput> {
    const page = await this.ensureReady();
    return page.evaluate((requestedPretty) => {
      const w = window as unknown as Record<string, unknown>;
      const app = w.App as { graph?: { serialize?: () => unknown } } | undefined;
      const graph = app?.graph as { serialize?: () => unknown } | undefined;
      if (!graph || typeof graph.serialize !== "function") {
        throw new Error("App.graph.serialize is not available");
      }

      const data = graph.serialize();
      const nodeCount = Array.isArray((data as { nodes?: unknown[] } | null)?.nodes)
        ? ((data as { nodes?: unknown[] }).nodes?.length ?? 0)
        : 0;
      const linkRaw = (data as { links?: Record<string, unknown> } | null)?.links;
      const linkCount = linkRaw && typeof linkRaw === "object" ? Object.keys(linkRaw).length : 0;

      const usePretty = !!requestedPretty;
      const json = usePretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);

      return {
        nodeCount,
        linkCount,
        json
      };
    }, !!pretty);
  }

  async importGraphJson(graphJson: string): Promise<ImportGraphJsonOutput> {
    const page = await this.ensureReady();
    const imported = await page.evaluate((rawJson) => {
      const w = window as unknown as Record<string, unknown>;
      const app = w.App as
        | {
            graph?: {
              clear?: () => void;
              configure?: (data: unknown) => void;
              fixedtime_lapse?: number;
              fixedtime?: number;
              globaltime?: number;
              elapsed_time?: number;
              iteration?: number;
              status?: number;
            };
            timelineChart?: { attachGraph?: (graph: unknown) => void };
            canvas?: { draw?: (a?: boolean, b?: boolean) => void };
          }
        | undefined;

      const graph = app?.graph;
      if (!graph || typeof graph.clear !== "function" || typeof graph.configure !== "function") {
        throw new Error("App.graph.configure is not available");
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawJson);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new Error("Invalid graphJson: " + msg);
      }

      const isSimRunning = w.isSimRunning as undefined | (() => boolean);
      const stopSimulation = w.stopSimulation as undefined | (() => void);
      const setSimTime = w.setSimTime as undefined | ((ms: number) => void);
      const updateSimTime = w.updateSimTime as undefined | (() => void);
      const simNow = w.simNow as undefined | (() => number);
      const getSimDtSec = w.getSimDtSec as undefined | (() => number);
      const liteGraph = w.LGraph as undefined | { STATUS_STOPPED?: number };

      if (typeof isSimRunning === "function" && isSimRunning() && typeof stopSimulation === "function") {
        stopSimulation();
      }

      graph.clear();
      graph.configure(parsed);

      const dtSec = typeof getSimDtSec === "function" ? Number(getSimDtSec()) : 0.1;
      graph.fixedtime_lapse = Number.isFinite(dtSec) && dtSec > 0 ? dtSec : 0.1;
      graph.fixedtime = 0;
      graph.globaltime = 0;
      graph.elapsed_time = 0;
      graph.iteration = 0;
      graph.status = typeof liteGraph?.STATUS_STOPPED === "number" ? liteGraph.STATUS_STOPPED : 1;

      if (typeof setSimTime === "function") {
        setSimTime(0);
      }
      if (typeof updateSimTime === "function") {
        updateSimTime();
      }

      if (app.timelineChart && typeof app.timelineChart.attachGraph === "function") {
        app.timelineChart.attachGraph(graph);
      }
      if (app.canvas && typeof app.canvas.draw === "function") {
        app.canvas.draw(true, true);
      }

      return {
        running: typeof isSimRunning === "function" ? !!isSimRunning() : false,
        simTimeMs: typeof simNow === "function" ? Number(simNow()) : null
      };
    }, graphJson);

    const repaired = await this.repairGraphLinks();
    return {
      nodeCount: repaired.nodeCount,
      linkCount: repaired.linkCount,
      running: imported.running,
      simTimeMs: imported.simTimeMs
    };
  }

  async setSimulationTime(simTimeMs: number): Promise<SetSimulationTimeOutput> {
    const page = await this.ensureReady();
    return page.evaluate((requestedTimeMs) => {
      const w = window as unknown as Record<string, unknown>;
      const setSimTime = w.setSimTime as undefined | ((ms: number) => void);
      const updateSimTime = w.updateSimTime as undefined | (() => void);
      const simNow = w.simNow as undefined | (() => number);
      const isSimRunning = w.isSimRunning as undefined | (() => boolean);

      if (typeof setSimTime !== "function") {
        throw new Error("setSimTime is not available");
      }

      const next = Number(requestedTimeMs);
      if (!Number.isFinite(next) || next < 0) {
        throw new Error("simTimeMs must be a non-negative finite number");
      }

      setSimTime(next);
      if (typeof updateSimTime === "function") {
        updateSimTime();
      }

      return {
        running: typeof isSimRunning === "function" ? !!isSimRunning() : false,
        simTimeMs: typeof simNow === "function" ? Number(simNow()) : next
      };
    }, simTimeMs);
  }

  async getGraphOverview(includeNodes?: boolean, maxNodes?: number): Promise<GraphOverviewOutput> {
    const page = await this.ensureReady();
    return page.evaluate(
      ({ requestedIncludeNodes, requestedMaxNodes }: { requestedIncludeNodes: boolean; requestedMaxNodes: number | null }) => {
        const w = window as unknown as Record<string, unknown>;
        const app = w.App as
          | {
              graph?: { _nodes?: unknown[]; links?: Record<string, unknown> };
            }
          | undefined;

        const graph = app?.graph;
        if (!graph) {
          throw new Error("App.graph is not available");
        }

        const nodes = Array.isArray(graph._nodes) ? graph._nodes : [];
        const links = graph.links && typeof graph.links === "object" ? graph.links : {};
        const nodeTypeCounts: Record<string, number> = {};

        for (const node of nodes) {
          const type = String((node as { type?: unknown })?.type ?? "").trim() || "unknown";
          nodeTypeCounts[type] = (nodeTypeCounts[type] ?? 0) + 1;
        }

        if (!requestedIncludeNodes) {
          return {
            nodeCount: nodes.length,
            linkCount: Object.keys(links).length,
            nodeTypeCounts
          };
        }

        const limitRaw = requestedMaxNodes ?? 200;
        const limit = Math.max(1, Math.min(1000, Math.floor(limitRaw)));
        const mapped: GraphOverviewNode[] = nodes.slice(0, limit).map((node) => {
          const asNode = node as { id?: unknown; type?: unknown; title?: unknown; pos?: unknown };
          const rawPos = Array.isArray(asNode.pos) ? asNode.pos : null;
          const x = rawPos && rawPos.length > 0 ? Number(rawPos[0]) : Number.NaN;
          const y = rawPos && rawPos.length > 1 ? Number(rawPos[1]) : Number.NaN;

          return {
            id: typeof asNode.id === "string" || typeof asNode.id === "number" ? asNode.id : null,
            type: typeof asNode.type === "string" ? asNode.type : null,
            title: String(asNode.title ?? ""),
            pos: Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null
          };
        });

        return {
          nodeCount: nodes.length,
          linkCount: Object.keys(links).length,
          nodeTypeCounts,
          nodes: mapped,
          truncated: nodes.length > limit
        };
      },
      {
        requestedIncludeNodes: !!includeNodes,
        requestedMaxNodes: typeof maxNodes === "number" && Number.isFinite(maxNodes) ? maxNodes : null
      }
    );
  }

  async exportEmbeddedHtml(fileName?: string): Promise<ExportEmbeddedHtmlOutput> {
    const page = await this.ensureReady();
    const result = await page.evaluate(async () => {
      const w = window as unknown as Record<string, unknown>;
      const app = w.App as { buildEmbeddedExportHtml?: () => Promise<string> } | undefined;
      if (!app || typeof app.buildEmbeddedExportHtml !== "function") {
        throw new Error("App.buildEmbeddedExportHtml is not available");
      }

      const html = await app.buildEmbeddedExportHtml();
      return {
        html,
        length: html.length
      };
    });

    const targetPath = this.resolveHtmlPath(fileName);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, result.html, "utf8");

    return {
      savedTo: targetPath,
      length: result.length
    };
  }

  async saveTimelineCsv(fileName?: string): Promise<SaveTimelineCsvOutput> {
    const result = await this.exportTimelineCsv();
    const targetPath = this.resolveCsvPath(fileName);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, result.csv, "utf8");

    return {
      savedTo: targetPath,
      lineCount: result.lineCount
    };
  }

  async saveGraphJson(fileName?: string, pretty?: boolean): Promise<SaveGraphJsonOutput> {
    const result = await this.exportGraphJson(pretty);
    const targetPath = this.resolveJsonPath(fileName);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, result.json, "utf8");

    return {
      savedTo: targetPath,
      nodeCount: result.nodeCount,
      linkCount: result.linkCount,
      bytes: result.json.length
    };
  }

  async loadGraphJsonFile(filePath: string): Promise<LoadGraphJsonFileOutput> {
    const sourcePath = this.resolveAbsolutePath(filePath);
    const raw = await readFile(sourcePath, "utf8");
    const imported = await this.importGraphJson(raw);

    return {
      sourcePath,
      nodeCount: imported.nodeCount,
      linkCount: imported.linkCount,
      running: imported.running,
      simTimeMs: imported.simTimeMs
    };
  }

  async runMatrixAndSaveReport(examples: string[], wallMs?: number, fileName?: string): Promise<SaveScenarioReportOutput> {
    const matrix = await this.runScenarioMatrix(examples, wallMs);
    const status = await this.getSimulationStatus();
    const kpi = await this.getKpiSummary();

    const report = {
      generatedAt: new Date().toISOString(),
      matrix,
      status,
      kpi
    };

    const json = JSON.stringify(report, null, 2);
    const targetPath = this.resolveReportPath(fileName);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, json, "utf8");

    return {
      savedTo: targetPath,
      executedExamples: matrix.executedExamples,
      succeeded: matrix.totals.succeeded,
      failed: matrix.totals.failed,
      bytes: json.length
    };
  }


  async validateGraphJson(graphJson: string): Promise<ValidateGraphJsonOutput> {
    const raw = String(graphJson ?? "").trim();
    if (!raw) {
      throw new Error("graphJson is required");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error("Invalid graphJson: " + toErrorMessage(error));
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("graphJson root must be a JSON object");
    }

    const candidate = parsed as {
      nodes?: unknown;
      _nodes?: unknown;
      links?: unknown;
    };

    const warnings: string[] = [];
    const nodesRaw = Array.isArray(candidate.nodes)
      ? candidate.nodes
      : Array.isArray(candidate._nodes)
        ? candidate._nodes
        : null;

    if (!Array.isArray(candidate.nodes)) {
      warnings.push('"nodes" array is missing (used fallback check).');
    }

    let linkCount = 0;
    let hasValidLinks = false;
    if (Array.isArray(candidate.links)) {
      linkCount = candidate.links.length;
      hasValidLinks = true;
    } else if (candidate.links && typeof candidate.links === "object") {
      linkCount = Object.keys(candidate.links as Record<string, unknown>).length;
      hasValidLinks = true;
    } else {
      warnings.push('"links" should be an object or array.');
    }

    const nodeCount = nodesRaw ? nodesRaw.length : 0;
    if (!nodesRaw) {
      warnings.push("No node list found in graph JSON.");
    } else {
      const nonObjectNodes = nodesRaw.filter((node) => !node || typeof node !== "object").length;
      if (nonObjectNodes > 0) {
        warnings.push(String(nonObjectNodes) + " node entries are not JSON objects.");
      }
    }

    return {
      valid: !!nodesRaw && hasValidLinks,
      nodeCount,
      linkCount,
      warnings
    };
  }

  async saveKpiSummaryJson(fileName?: string, pretty?: boolean): Promise<SaveKpiSummaryOutput> {
    const summary = await this.getKpiSummary();
    const targetPath = fileName
      ? this.resolveJsonPath(fileName)
      : path.resolve(process.cwd(), "artifacts", "fact-sim-kpi-" + Date.now() + ".json");
    const usePretty = typeof pretty === "boolean" ? pretty : true;
    const json = usePretty ? JSON.stringify(summary, null, 2) : JSON.stringify(summary);

    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, json, "utf8");

    return {
      savedTo: targetPath,
      sinkCount: summary.sinkCount,
      totalCompleted: summary.totalCompleted,
      bytes: Buffer.byteLength(json, "utf8")
    };
  }

  async saveGraphOverviewJson(
    fileName?: string,
    includeNodes?: boolean,
    maxNodes?: number,
    pretty?: boolean
  ): Promise<SaveGraphOverviewOutput> {
    const overview = await this.getGraphOverview(includeNodes, maxNodes);
    const targetPath = fileName
      ? this.resolveJsonPath(fileName)
      : path.resolve(process.cwd(), "artifacts", "fact-sim-overview-" + Date.now() + ".json");
    const usePretty = typeof pretty === "boolean" ? pretty : true;
    const json = usePretty ? JSON.stringify(overview, null, 2) : JSON.stringify(overview);

    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, json, "utf8");

    return {
      savedTo: targetPath,
      nodeCount: overview.nodeCount,
      linkCount: overview.linkCount,
      includeNodes: !!includeNodes,
      bytes: Buffer.byteLength(json, "utf8")
    };
  }

  async listNodeTypes(): Promise<NodeTypesOutput> {
    const page = await this.ensureReady();
    return page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>;
      const liteGraph = w.LiteGraph as { registered_node_types?: Record<string, unknown> } | undefined;
      const registered =
        liteGraph?.registered_node_types && typeof liteGraph.registered_node_types === "object"
          ? Object.keys(liteGraph.registered_node_types)
          : [];
      const types = [...new Set(registered.map((x) => String(x).trim()).filter((x) => x.length > 0))].sort((a, b) =>
        a.localeCompare(b)
      );
      return {
        count: types.length,
        types
      };
    });
  }

  async describeNodeType(nodeType: string): Promise<NodeTypeDescriptionOutput> {
    const page = await this.ensureReady();
    return page.evaluate((requestedNodeType) => {
      const w = window as unknown as Record<string, unknown>;
      const liteGraph = w.LiteGraph as { createNode?: (type: string) => unknown; registered_node_types?: Record<string, unknown> } | undefined;
      if (!liteGraph || typeof liteGraph.createNode !== "function") {
        throw new Error("LiteGraph.createNode is not available");
      }

      const typeRaw = String(requestedNodeType ?? "").trim();
      if (!typeRaw) {
        throw new Error("nodeType is required");
      }

      const node = liteGraph.createNode(typeRaw) as
        | {
            type?: unknown;
            title?: unknown;
            properties?: Record<string, unknown>;
            inputs?: Array<{ name?: unknown; type?: unknown; link?: unknown }>;
            outputs?: Array<{ name?: unknown; type?: unknown; links?: unknown }>;
          }
        | null;

      if (!node) {
        const knownTypes =
          liteGraph.registered_node_types && typeof liteGraph.registered_node_types === "object"
            ? Object.keys(liteGraph.registered_node_types).slice(0, 30)
            : [];
        throw new Error("Unknown nodeType: " + typeRaw + (knownTypes.length ? " (examples: " + knownTypes.join(", ") + ")" : ""));
      }

      const inputs = Array.isArray(node.inputs)
        ? node.inputs.map((input, index) => {
            const hasLink = typeof input?.link === "number" || typeof input?.link === "string";
            return {
              slot: index,
              name: String(input?.name ?? ""),
              type: typeof input?.type === "string" ? input.type : input?.type === null ? null : String(input?.type ?? ""),
              hasLink,
              linkCount: hasLink ? 1 : 0
            };
          })
        : [];

      const outputs = Array.isArray(node.outputs)
        ? node.outputs.map((output, index) => {
            const links = Array.isArray(output?.links) ? output.links : [];
            return {
              slot: index,
              name: String(output?.name ?? ""),
              type: typeof output?.type === "string" ? output.type : output?.type === null ? null : String(output?.type ?? ""),
              hasLink: links.length > 0,
              linkCount: links.length
            };
          })
        : [];

      const defaultProperties =
        node.properties && typeof node.properties === "object" && !Array.isArray(node.properties)
          ? JSON.parse(JSON.stringify(node.properties))
          : {};

      return {
        nodeType: typeof node.type === "string" ? node.type : typeRaw,
        title: String(node.title ?? ""),
        inputCount: inputs.length,
        outputCount: outputs.length,
        inputs,
        outputs,
        defaultProperties
      };
    }, nodeType);
  }


  async buildGraphFromBlueprint(
    nodes: BlueprintNodeInput[],
    edges: BlueprintEdgeInput[],
    options?: BlueprintBuildOptions
  ): Promise<BuildGraphFromBlueprintOutput> {
    const nodeSpecs = Array.isArray(nodes) ? nodes : [];
    if (!nodeSpecs.length) {
      throw new Error("nodes must contain at least one blueprint node");
    }

    const edgeSpecs = Array.isArray(edges) ? edges : [];
    const clearExisting = options?.clearExisting ?? true;
    const originX = this.sanitizeNumberOption(options?.originX, 120);
    const originY = this.sanitizeNumberOption(options?.originY, 120);
    const xPitch = this.sanitizeNumberOption(options?.xPitch, 320, 40);
    const yPitch = this.sanitizeNumberOption(options?.yPitch, 220, 40);

    if (clearExisting) {
      await this.clearGraph();
    }

    const keyToNodeId = new Map<string, string | number>();
    const laneCursor = new Map<number, number>();
    const createdNodes: BuildGraphFromBlueprintOutput["createdNodes"] = [];

    for (const rawNode of nodeSpecs) {
      const key = String(rawNode?.key ?? "").trim();
      const nodeType = String(rawNode?.nodeType ?? "").trim();
      if (!key) {
        throw new Error("blueprint node key is required");
      }
      if (!nodeType) {
        throw new Error('blueprint node "' + key + '" is missing nodeType');
      }
      if (keyToNodeId.has(key)) {
        throw new Error('duplicate blueprint node key: ' + key);
      }

      const lane = this.sanitizeIntegerOption(rawNode?.lane, 0);
      const laneIndex = laneCursor.get(lane) ?? 0;
      laneCursor.set(lane, laneIndex + 1);

      const posX = this.sanitizeNumberOption(rawNode?.x, originX + laneIndex * xPitch);
      const posY = this.sanitizeNumberOption(rawNode?.y, originY + lane * yPitch);
      const title = typeof rawNode?.title === "string" ? rawNode.title : undefined;
      const properties =
        rawNode?.properties && typeof rawNode.properties === "object" && !Array.isArray(rawNode.properties)
          ? rawNode.properties
          : undefined;

      const added = await this.addNode(nodeType, title, posX, posY, properties);
      if (typeof added.nodeId !== "string" && typeof added.nodeId !== "number") {
        throw new Error('failed to create node "' + key + '" (nodeType=' + nodeType + ')');
      }

      keyToNodeId.set(key, added.nodeId);
      createdNodes.push({
        key,
        nodeId: added.nodeId,
        nodeType: added.nodeType,
        title: added.title,
        pos: added.pos
      });
    }

    const createdLinks: BuildGraphFromBlueprintOutput["createdLinks"] = [];
    for (const rawEdge of edgeSpecs) {
      const fromKey = String(rawEdge?.fromKey ?? "").trim();
      const toKey = String(rawEdge?.toKey ?? "").trim();
      if (!fromKey || !toKey) {
        throw new Error("edge requires fromKey and toKey");
      }

      const fromNodeId = keyToNodeId.get(fromKey);
      const toNodeId = keyToNodeId.get(toKey);
      if (typeof fromNodeId === "undefined") {
        throw new Error('edge.fromKey not found in blueprint nodes: ' + fromKey);
      }
      if (typeof toNodeId === "undefined") {
        throw new Error('edge.toKey not found in blueprint nodes: ' + toKey);
      }

      const fromSlot = this.readOptionalNonNegativeInt(rawEdge?.fromSlot);
      const toSlot = this.readOptionalNonNegativeInt(rawEdge?.toSlot);
      const allowDuplicate = !!rawEdge?.allowDuplicate;
      const rawKind = typeof rawEdge?.portKind === "string" ? rawEdge.portKind.trim() : "";

      if (rawKind) {
        const portKind = this.normalizePortKind(rawKind as PortKind);
        const connected = await this.connectNodesByPortKind(fromNodeId, toNodeId, portKind, fromSlot, toSlot, allowDuplicate);
        createdLinks.push({
          fromKey,
          toKey,
          created: connected.created,
          linkId: connected.linkId,
          portKind,
          fromSlot: connected.fromSlot,
          toSlot: connected.toSlot
        });
        continue;
      }

      const connected = await this.connectNodes(fromNodeId, toNodeId, fromSlot, toSlot, allowDuplicate);
      createdLinks.push({
        fromKey,
        toKey,
        created: connected.created,
        linkId: connected.linkId,
        portKind: null,
        fromSlot: connected.fromSlot,
        toSlot: connected.toSlot
      });
    }

    const repaired = await this.repairGraphLinks();
    return {
      createdNodes,
      createdLinks,
      nodeCount: repaired.nodeCount,
      linkCount: repaired.linkCount
    };
  }

  async optimizeLineByBottleneck(options?: OptimizeLineOptions): Promise<OptimizeLineByBottleneckOutput> {
    const normalizedIterations = this.sanitizeIntegerOption(options?.iterations, 3, 1, 20);
    const normalizedRunWallMs = this.sanitizeIntegerOption(options?.runWallMs, 2500, 200, 60000);
    const normalizedBottleneckTopN = this.sanitizeIntegerOption(options?.bottleneckTopN, 5, 1, 50);
    const normalizedMinSampleSec = this.sanitizeNumberOption(options?.minSampleSec, 1, 0);
    const normalizedMaxNodesPerIteration = this.sanitizeIntegerOption(options?.maxNodesPerIteration, 2, 1, 10);
    const normalizedProcessReductionRatio = this.sanitizeNumberOption(options?.processReductionRatio, 0.12, 0.01, 0.8);
    const normalizedDownReductionRatio = this.sanitizeNumberOption(options?.downReductionRatio, 0.2, 0.01, 0.8);
    const normalizedMinProcessTime = this.sanitizeNumberOption(options?.minProcessTime, 0.2, 0);
    const normalizedMinDownTime = this.sanitizeNumberOption(options?.minDownTime, 0.1, 0);

    const warnings: string[] = [];
    const baselineRun = await this.runSimulationFor(normalizedRunWallMs, undefined, true, false);
    const baselineScore = this.computeLineOptimizationScore(
      baselineRun.kpi.throughputPerHourTotal,
      baselineRun.kpi.totalCompleted
    );

    let bestIteration = 0;
    let bestThroughput = baselineRun.kpi.throughputPerHourTotal;
    let bestCompleted = baselineRun.kpi.totalCompleted;
    let bestScore = baselineScore;
    let bestGraphJson = (await this.exportGraphJson(false)).json;

    const history: LineOptimizationStep[] = [];

    for (let iteration = 1; iteration <= normalizedIterations; iteration += 1) {
      await this.importGraphJson(bestGraphJson);
      await this.runSimulationFor(normalizedRunWallMs, undefined, true, false);

      const exported = await this.exportGraphJson(false);
      const graph = this.parseGraphJsonObject(exported.json);
      const serializedNodes = this.getSerializedNodes(graph);

      const titleToNodeIds = new Map<string, Array<string | number>>();
      for (const node of serializedNodes) {
        const nodeAs = node as { id?: unknown; title?: unknown };
        if (typeof nodeAs.id !== "string" && typeof nodeAs.id !== "number") continue;
        const title = String(nodeAs.title ?? "").trim().toLowerCase();
        if (!title) continue;
        const rows = titleToNodeIds.get(title) ?? [];
        rows.push(nodeAs.id);
        titleToNodeIds.set(title, rows);
      }

      const bottlenecks = await this.getBottleneckReport(normalizedBottleneckTopN, normalizedMinSampleSec);
      const targetNodeIds: Array<string | number> = [];
      for (const row of bottlenecks.rows) {
        let resolvedId: string | number | null = null;
        if (typeof row.nodeId === "string" || typeof row.nodeId === "number") {
          resolvedId = row.nodeId;
        } else {
          const titleKey = String(row.title ?? "").trim().toLowerCase();
          if (titleKey) {
            const ids = titleToNodeIds.get(titleKey) ?? [];
            if (ids.length === 1) {
              resolvedId = ids[0];
            }
          }
        }

        if (resolvedId === null) continue;
        if (targetNodeIds.some((id) => this.normalizeNodeId(id) === this.normalizeNodeId(resolvedId as string | number))) {
          continue;
        }
        targetNodeIds.push(resolvedId);
        if (targetNodeIds.length >= normalizedMaxNodesPerIteration) {
          break;
        }
      }

      if (!targetNodeIds.length) {
        warnings.push('iteration ' + iteration + ': no adjustable bottleneck node found.');
        break;
      }

      const changedNodeIds: Array<string | number> = [];
      for (const nodeId of targetNodeIds) {
        const node = this.findSerializedNode(serializedNodes, nodeId);
        if (!node) continue;

        const nodeAs = node as { properties?: unknown };
        const props =
          nodeAs.properties && typeof nodeAs.properties === "object" && !Array.isArray(nodeAs.properties)
            ? (nodeAs.properties as Record<string, unknown>)
            : {};

        const patch: Record<string, unknown> = {};
        const processKeys = ["processTime", "processTime2"];
        for (const key of processKeys) {
          const current = Number(props[key]);
          if (!Number.isFinite(current) || current <= normalizedMinProcessTime) continue;
          const nextValue = this.roundNumber(
            Math.max(normalizedMinProcessTime, current * (1 - normalizedProcessReductionRatio)),
            4
          );
          if (nextValue < current) {
            patch[key] = nextValue;
          }
        }

        const downCurrent = Number(props.downTime);
        if (Number.isFinite(downCurrent) && downCurrent > normalizedMinDownTime) {
          const nextDown = this.roundNumber(
            Math.max(normalizedMinDownTime, downCurrent * (1 - normalizedDownReductionRatio)),
            4
          );
          if (nextDown < downCurrent) {
            patch.downTime = nextDown;
          }
        }

        if (!Object.keys(patch).length) continue;
        await this.updateNode(nodeId, undefined, patch, true);
        changedNodeIds.push(nodeId);
      }

      if (!changedNodeIds.length) {
        warnings.push('iteration ' + iteration + ': candidate nodes had no tunable properties (processTime/processTime2/downTime).');
        break;
      }

      const run = await this.runSimulationFor(normalizedRunWallMs, undefined, true, false);
      const score = this.computeLineOptimizationScore(run.kpi.throughputPerHourTotal, run.kpi.totalCompleted);
      const improved = score > bestScore + 1e-9;

      history.push({
        iteration,
        changedNodeIds,
        throughputPerHourTotal: this.roundNumber(run.kpi.throughputPerHourTotal, 6),
        totalCompleted: run.kpi.totalCompleted,
        score: this.roundNumber(score, 6),
        improved
      });

      if (improved) {
        bestIteration = iteration;
        bestThroughput = run.kpi.throughputPerHourTotal;
        bestCompleted = run.kpi.totalCompleted;
        bestScore = score;
        bestGraphJson = (await this.exportGraphJson(false)).json;
      }
    }

    await this.importGraphJson(bestGraphJson);

    return {
      iterations: normalizedIterations,
      runWallMs: normalizedRunWallMs,
      bottleneckTopN: normalizedBottleneckTopN,
      baseline: {
        throughputPerHourTotal: this.roundNumber(baselineRun.kpi.throughputPerHourTotal, 6),
        totalCompleted: baselineRun.kpi.totalCompleted,
        score: this.roundNumber(baselineScore, 6)
      },
      bestIteration,
      best: {
        throughputPerHourTotal: this.roundNumber(bestThroughput, 6),
        totalCompleted: bestCompleted,
        score: this.roundNumber(bestScore, 6)
      },
      history,
      warnings
    };
  }

  async addNode(
    nodeType: string,
    title?: string,
    x?: number,
    y?: number,
    properties?: Record<string, unknown>
  ): Promise<AddNodeOutput> {
    const page = await this.ensureReady();
    return page.evaluate(
      ({ requestedNodeType, requestedTitle, requestedX, requestedY, requestedProperties }) => {
        const w = window as unknown as Record<string, unknown>;
        const app = w.App as
          | {
              graph?: { add?: (node: unknown) => void; _nodes?: unknown[]; links?: Record<string, unknown> | unknown[] };
              canvas?: { draw?: (a?: boolean, b?: boolean) => void };
            }
          | undefined;
        const liteGraph = w.LiteGraph as { createNode?: (type: string) => unknown; registered_node_types?: Record<string, unknown> } | undefined;

        if (!app?.graph || typeof app.graph.add !== "function") {
          throw new Error("App.graph.add is not available");
        }
        if (!liteGraph || typeof liteGraph.createNode !== "function") {
          throw new Error("LiteGraph.createNode is not available");
        }

        const typeRaw = String(requestedNodeType ?? "").trim();
        if (!typeRaw) {
          throw new Error("nodeType is required");
        }

        const node = liteGraph.createNode(typeRaw) as
          | {
              id?: unknown;
              type?: unknown;
              title?: unknown;
              pos?: unknown;
              properties?: Record<string, unknown>;
              inputs?: unknown[];
              outputs?: unknown[];
            }
          | null;

        if (!node) {
          const knownTypes =
            liteGraph.registered_node_types && typeof liteGraph.registered_node_types === "object"
              ? Object.keys(liteGraph.registered_node_types).slice(0, 20)
              : [];
          throw new Error("Unknown nodeType: " + typeRaw + (knownTypes.length ? " (examples: " + knownTypes.join(", ") + ")" : ""));
        }

        const xNum = typeof requestedX === "number" && Number.isFinite(requestedX) ? requestedX : 120;
        const yNum = typeof requestedY === "number" && Number.isFinite(requestedY) ? requestedY : 120;
        node.pos = [xNum, yNum];

        const titleRaw = String(requestedTitle ?? "").trim();
        if (titleRaw) {
          node.title = titleRaw;
        }

        if (requestedProperties && typeof requestedProperties === "object" && !Array.isArray(requestedProperties)) {
          node.properties = {
            ...(node.properties ?? {}),
            ...(requestedProperties as Record<string, unknown>)
          };
        }

        app.graph.add(node);
        if (app.canvas && typeof app.canvas.draw === "function") {
          app.canvas.draw(true, true);
        }

        const nodes = Array.isArray(app.graph._nodes) ? app.graph._nodes : [];
        const linkMap = app.graph.links;
        const linkCount = Array.isArray(linkMap)
          ? linkMap.length
          : linkMap && typeof linkMap === "object"
            ? Object.keys(linkMap).length
            : 0;

        const rawPos = Array.isArray(node.pos) ? node.pos : null;
        const px = rawPos && rawPos.length > 0 ? Number(rawPos[0]) : Number.NaN;
        const py = rawPos && rawPos.length > 1 ? Number(rawPos[1]) : Number.NaN;

        return {
          nodeId: typeof node.id === "string" || typeof node.id === "number" ? node.id : null,
          nodeType: typeof node.type === "string" ? node.type : typeRaw,
          title: String(node.title ?? ""),
          pos: Number.isFinite(px) && Number.isFinite(py) ? [px, py] : null,
          inputCount: Array.isArray(node.inputs) ? node.inputs.length : 0,
          outputCount: Array.isArray(node.outputs) ? node.outputs.length : 0,
          nodeCount: nodes.length,
          linkCount
        };
      },
      {
        requestedNodeType: nodeType,
        requestedTitle: title,
        requestedX: typeof x === "number" && Number.isFinite(x) ? x : null,
        requestedY: typeof y === "number" && Number.isFinite(y) ? y : null,
        requestedProperties: properties ?? null
      }
    );
  }

  async getNodePorts(nodeId: string | number): Promise<NodePortsOutput> {
    const exported = await this.exportGraphJson(false);
    const graph = this.parseGraphJsonObject(exported.json);
    const nodes = this.getSerializedNodes(graph);
    const node = this.findSerializedNode(nodes, nodeId);
    if (!node) {
      throw new Error("nodeId not found: " + String(nodeId));
    }

    const nodeAs = node as {
      id?: unknown;
      type?: unknown;
      title?: unknown;
      inputs?: Array<{ name?: unknown; type?: unknown; link?: unknown }>;
      outputs?: Array<{ name?: unknown; type?: unknown; links?: unknown }>;
    };

    const inputs = Array.isArray(nodeAs.inputs)
      ? nodeAs.inputs.map((input, index) => {
          const hasLink = typeof input?.link === "number" || typeof input?.link === "string";
          return {
            slot: index,
            name: String(input?.name ?? ""),
            type: typeof input?.type === "string" ? input.type : input?.type === null ? null : String(input?.type ?? ""),
            hasLink,
            linkCount: hasLink ? 1 : 0
          };
        })
      : [];

    const outputs = Array.isArray(nodeAs.outputs)
      ? nodeAs.outputs.map((output, index) => {
          const links = Array.isArray(output?.links) ? output.links : [];
          return {
            slot: index,
            name: String(output?.name ?? ""),
            type: typeof output?.type === "string" ? output.type : output?.type === null ? null : String(output?.type ?? ""),
            hasLink: links.length > 0,
            linkCount: links.length
          };
        })
      : [];

    const resolvedId = nodeAs.id;
    if (typeof resolvedId !== "string" && typeof resolvedId !== "number") {
      throw new Error("selected node has invalid id");
    }

    return {
      nodeId: resolvedId,
      nodeType: typeof nodeAs.type === "string" ? nodeAs.type : null,
      title: String(nodeAs.title ?? ""),
      inputCount: inputs.length,
      outputCount: outputs.length,
      inputs,
      outputs
    };
  }
  async getNodePortsByKind(nodeId: string | number, portKind: PortKind): Promise<PortKindSlotsOutput> {
    const ports = await this.getNodePorts(nodeId);
    const normalizedKind = this.normalizePortKind(portKind);
    const inputs = ports.inputs.filter((slot) => this.isPortSlotOfKind(slot, normalizedKind));
    const outputs = ports.outputs.filter((slot) => this.isPortSlotOfKind(slot, normalizedKind));

    return {
      nodeId: ports.nodeId,
      nodeType: ports.nodeType,
      title: ports.title,
      portKind: normalizedKind,
      inputs,
      outputs
    };
  }

  async connectNodesByPortKind(
    fromNodeId: string | number,
    toNodeId: string | number,
    portKind: PortKind,
    fromSlot?: number,
    toSlot?: number,
    allowDuplicate?: boolean
  ): Promise<ConnectByPortKindOutput> {
    const normalizedKind = this.normalizePortKind(portKind);
    const fromPorts = await this.getNodePortsByKind(fromNodeId, normalizedKind);
    const toPorts = await this.getNodePortsByKind(toNodeId, normalizedKind);
    const fromCandidates = fromPorts.outputs;
    const toCandidates = toPorts.inputs;

    if (!fromCandidates.length) {
      throw new Error(
        `fromNodeId ${String(fromNodeId)} has no output ports compatible with portKind "${normalizedKind}".`
      );
    }
    if (!toCandidates.length) {
      throw new Error(
        `toNodeId ${String(toNodeId)} has no input ports compatible with portKind "${normalizedKind}".`
      );
    }

    const selectedFrom = this.selectPortSlot(fromCandidates, fromSlot, "fromSlot");
    const selectedTo = this.selectPortSlot(toCandidates, toSlot, "toSlot");
    const connected = await this.connectNodes(
      fromPorts.nodeId,
      toPorts.nodeId,
      selectedFrom.slot,
      selectedTo.slot,
      allowDuplicate
    );

    return {
      ...connected,
      portKind: normalizedKind,
      fromCandidates: fromCandidates.length,
      toCandidates: toCandidates.length
    };
  }

  async connectWorkPorts(
    fromNodeId: string | number,
    toNodeId: string | number,
    fromSlot?: number,
    toSlot?: number,
    allowDuplicate?: boolean
  ): Promise<ConnectByPortKindOutput> {
    return this.connectNodesByPortKind(fromNodeId, toNodeId, "work", fromSlot, toSlot, allowDuplicate);
  }

  async connectSignalPorts(
    fromNodeId: string | number,
    toNodeId: string | number,
    fromSlot?: number,
    toSlot?: number,
    allowDuplicate?: boolean
  ): Promise<ConnectByPortKindOutput> {
    return this.connectNodesByPortKind(fromNodeId, toNodeId, "signal", fromSlot, toSlot, allowDuplicate);
  }

  async connectCarrierPorts(
    fromNodeId: string | number,
    toNodeId: string | number,
    fromSlot?: number,
    toSlot?: number,
    allowDuplicate?: boolean
  ): Promise<ConnectByPortKindOutput> {
    return this.connectNodesByPortKind(fromNodeId, toNodeId, "carrier", fromSlot, toSlot, allowDuplicate);
  }

  async connectPalletPorts(
    fromNodeId: string | number,
    toNodeId: string | number,
    fromSlot?: number,
    toSlot?: number,
    allowDuplicate?: boolean
  ): Promise<ConnectByPortKindOutput> {
    return this.connectNodesByPortKind(fromNodeId, toNodeId, "pallet", fromSlot, toSlot, allowDuplicate);
  }

  async updateNode(
    nodeId: string | number,
    title?: string,
    properties?: Record<string, unknown>,
    mergeProperties?: boolean
  ): Promise<UpdateNodeOutput> {
    const hasTitle = typeof title === "string";
    const hasProperties = !!properties && typeof properties === "object" && !Array.isArray(properties);
    if (!hasTitle && !hasProperties) {
      throw new Error("update_node requires title and/or properties");
    }

    const exported = await this.exportGraphJson(false);
    const graph = this.parseGraphJsonObject(exported.json);
    const nodes = this.getSerializedNodes(graph);
    const node = this.findSerializedNode(nodes, nodeId);
    if (!node) {
      throw new Error("nodeId not found: " + String(nodeId));
    }

    const nodeAs = node as {
      id?: unknown;
      type?: unknown;
      title?: unknown;
      properties?: Record<string, unknown>;
    };

    const resolvedId = nodeAs.id;
    if (typeof resolvedId !== "string" && typeof resolvedId !== "number") {
      throw new Error("selected node has invalid id");
    }

    let updatedTitle = false;
    if (hasTitle) {
      const normalizedTitle = String(title ?? "");
      nodeAs.title = normalizedTitle;
      updatedTitle = true;
    }

    const merged = typeof mergeProperties === "boolean" ? mergeProperties : true;
    const updatedPropertyKeys: string[] = [];
    if (hasProperties) {
      const incoming = properties as Record<string, unknown>;
      const source = merged
        ? nodeAs.properties && typeof nodeAs.properties === "object" && !Array.isArray(nodeAs.properties)
          ? nodeAs.properties
          : {}
        : {};
      nodeAs.properties = {
        ...source,
        ...incoming
      };
      updatedPropertyKeys.push(...Object.keys(incoming));
    }

    graph.nodes = nodes;
    await this.importGraphJson(JSON.stringify(graph));

    const links = this.canonicalizeSerializedLinks(graph.links);
    return {
      nodeId: resolvedId,
      nodeType: typeof nodeAs.type === "string" ? nodeAs.type : null,
      title: String(nodeAs.title ?? ""),
      properties:
        nodeAs.properties && typeof nodeAs.properties === "object" && !Array.isArray(nodeAs.properties)
          ? nodeAs.properties
          : {},
      updatedTitle,
      updatedPropertyKeys: [...new Set(updatedPropertyKeys)],
      mergedProperties: merged,
      nodeCount: nodes.length,
      linkCount: links.length
    };
  }

  async connectNodes(
    fromNodeId: string | number,
    toNodeId: string | number,
    fromSlot?: number,
    toSlot?: number,
    allowDuplicate?: boolean
  ): Promise<ConnectNodesOutput> {
    const exported = await this.exportGraphJson(false);
    const graph = this.parseGraphJsonObject(exported.json);
    const nodes = this.getSerializedNodes(graph);
    const fromNode = this.findSerializedNode(nodes, fromNodeId);
    const toNode = this.findSerializedNode(nodes, toNodeId);

    if (!fromNode) {
      throw new Error("fromNodeId not found: " + String(fromNodeId));
    }
    if (!toNode) {
      throw new Error("toNodeId not found: " + String(toNodeId));
    }

    const fromNodeAs = fromNode as { id?: unknown; outputs?: unknown[] };
    const toNodeAs = toNode as { id?: unknown; inputs?: unknown[] };
    const safeFromSlot = this.normalizeSlot(fromSlot, 0);
    const safeToSlot = this.normalizeSlot(toSlot, 0);
    const outputCount = Array.isArray(fromNodeAs.outputs) ? fromNodeAs.outputs.length : 0;
    const inputCount = Array.isArray(toNodeAs.inputs) ? toNodeAs.inputs.length : 0;

    if (outputCount <= safeFromSlot) {
      throw new Error("fromSlot out of range: " + safeFromSlot + " (outputs: " + outputCount + ")");
    }
    if (inputCount <= safeToSlot) {
      throw new Error("toSlot out of range: " + safeToSlot + " (inputs: " + inputCount + ")");
    }

    const fromIdRaw = fromNodeAs.id;
    const toIdRaw = toNodeAs.id;
    if ((typeof fromIdRaw !== "string" && typeof fromIdRaw !== "number") || (typeof toIdRaw !== "string" && typeof toIdRaw !== "number")) {
      throw new Error("node id is invalid in graph JSON");
    }

    const links = this.canonicalizeSerializedLinks(graph.links);
    const fromKey = this.normalizeNodeId(fromIdRaw);
    const toKey = this.normalizeNodeId(toIdRaw);

    const existing = links.find(
      (link) =>
        this.normalizeNodeId(link[1]) === fromKey &&
        this.normalizeNodeId(link[3]) === toKey &&
        link[2] === safeFromSlot &&
        link[4] === safeToSlot
    );

    if (existing && !allowDuplicate) {
      return {
        created: false,
        linkId: existing[0],
        fromNodeId: fromIdRaw,
        toNodeId: toIdRaw,
        fromSlot: safeFromSlot,
        toSlot: safeToSlot,
        nodeCount: nodes.length,
        linkCount: links.length
      };
    }

    const nextId = links.reduce((max, link) => Math.max(max, link[0]), 0) + 1;
    links.push([nextId, fromIdRaw, safeFromSlot, toIdRaw, safeToSlot, 0]);
    graph.links = links;
    await this.importGraphJson(JSON.stringify(graph));

    return {
      created: true,
      linkId: nextId,
      fromNodeId: fromIdRaw,
      toNodeId: toIdRaw,
      fromSlot: safeFromSlot,
      toSlot: safeToSlot,
      nodeCount: nodes.length,
      linkCount: links.length
    };
  }

  async disconnectNodes(options: {
    linkId?: number;
    fromNodeId?: string | number;
    toNodeId?: string | number;
    fromSlot?: number;
    toSlot?: number;
    removeAllMatches?: boolean;
  }): Promise<DisconnectNodesOutput> {
    const exported = await this.exportGraphJson(false);
    const graph = this.parseGraphJsonObject(exported.json);
    const links = this.canonicalizeSerializedLinks(graph.links);
    const nodes = this.getSerializedNodes(graph);

    const hasAnyCriteria =
      typeof options.linkId === "number" ||
      typeof options.fromNodeId === "string" ||
      typeof options.fromNodeId === "number" ||
      typeof options.toNodeId === "string" ||
      typeof options.toNodeId === "number" ||
      typeof options.fromSlot === "number" ||
      typeof options.toSlot === "number";

    if (!hasAnyCriteria) {
      throw new Error("disconnect requires linkId or endpoint criteria");
    }

    const matchIds: number[] = [];
    const fromNodeKey =
      typeof options.fromNodeId === "string" || typeof options.fromNodeId === "number"
        ? this.normalizeNodeId(options.fromNodeId)
        : null;
    const toNodeKey =
      typeof options.toNodeId === "string" || typeof options.toNodeId === "number"
        ? this.normalizeNodeId(options.toNodeId)
        : null;

    for (const link of links) {
      if (typeof options.linkId === "number" && link[0] !== options.linkId) {
        continue;
      }
      if (fromNodeKey !== null && this.normalizeNodeId(link[1]) !== fromNodeKey) {
        continue;
      }
      if (toNodeKey !== null && this.normalizeNodeId(link[3]) !== toNodeKey) {
        continue;
      }
      if (typeof options.fromSlot === "number" && link[2] !== this.normalizeSlot(options.fromSlot, 0)) {
        continue;
      }
      if (typeof options.toSlot === "number" && link[4] !== this.normalizeSlot(options.toSlot, 0)) {
        continue;
      }
      matchIds.push(link[0]);
    }

    if (!matchIds.length) {
      return {
        removedCount: 0,
        removedLinkIds: [],
        nodeCount: nodes.length,
        linkCount: links.length
      };
    }

    const removeAll = !!options.removeAllMatches;
    const removeSet = new Set<number>(removeAll ? matchIds : [matchIds[0]]);
    const nextLinks = links.filter((link) => !removeSet.has(link[0]));

    graph.links = nextLinks;
    await this.importGraphJson(JSON.stringify(graph));

    return {
      removedCount: removeSet.size,
      removedLinkIds: [...removeSet],
      nodeCount: nodes.length,
      linkCount: nextLinks.length
    };
  }

  async removeNode(nodeId: string | number): Promise<RemoveNodeOutput> {
    const exported = await this.exportGraphJson(false);
    const graph = this.parseGraphJsonObject(exported.json);
    const nodes = this.getSerializedNodes(graph);
    const nodeKey = this.normalizeNodeId(nodeId);

    const remainingNodes: Record<string, unknown>[] = [];
    let removedNodeId: string | number | null = null;

    for (const node of nodes) {
      const currentId = (node as { id?: unknown }).id;
      if ((typeof currentId === "string" || typeof currentId === "number") && this.normalizeNodeId(currentId) === nodeKey) {
        removedNodeId = currentId;
        continue;
      }
      remainingNodes.push(node);
    }

    if (removedNodeId === null) {
      throw new Error("nodeId not found: " + String(nodeId));
    }

    const links = this.canonicalizeSerializedLinks(graph.links);
    const nextLinks = links.filter(
      (link) => this.normalizeNodeId(link[1]) !== nodeKey && this.normalizeNodeId(link[3]) !== nodeKey
    );

    graph.nodes = remainingNodes;
    graph.links = nextLinks;
    await this.importGraphJson(JSON.stringify(graph));

    return {
      removedNodeId,
      removedLinkCount: links.length - nextLinks.length,
      nodeCount: remainingNodes.length,
      linkCount: nextLinks.length
    };
  }

  async evaluateCandidateGraph(
    graphJson: string,
    wallMs?: number,
    objective?: OptimizationObjective
  ): Promise<CandidateEvaluationOutput> {
    const normalizedObjective = this.normalizeObjective(objective);
    const validation = await this.validateGraphJson(graphJson);
    if (!validation.valid) {
      throw new Error("graphJson validation failed: " + (validation.warnings.join(" ") || "invalid graph structure"));
    }

    const imported = await this.importGraphJson(graphJson);
    const benchmark = await this.runBenchmark(wallMs);
    const benchmarkSummary = this.summarizeBenchmark(benchmark);
    const kpi = await this.getKpiSummary();

    const throughputPerHourTotal = Number.isFinite(kpi.throughputPerHourTotal) ? kpi.throughputPerHourTotal : 0;
    const bestHeadlessSpeed = Number.isFinite(benchmarkSummary.bestHeadlessSpeed ?? Number.NaN)
      ? Number(benchmarkSummary.bestHeadlessSpeed)
      : 0;

    const score = this.computeObjectiveScore(normalizedObjective, {
      throughputPerHourTotal,
      bestHeadlessSpeed,
      nodeCount: imported.nodeCount,
      linkCount: imported.linkCount
    });

    const warnings = [...validation.warnings];
    if (kpi.sinkCount === 0) {
      warnings.push("No sink-like node detected in KPI summary.");
    }

    return {
      objective: normalizedObjective,
      wallMs: this.sanitizeWallMs(wallMs),
      score,
      benchmarkSummary,
      graph: {
        nodeCount: imported.nodeCount,
        linkCount: imported.linkCount
      },
      kpi: {
        throughputPerHourTotal,
        projectedThroughputPerHour: kpi.projectedThroughputPerHour,
        totalCompleted: kpi.totalCompleted,
        sinkCount: kpi.sinkCount
      },
      warnings
    };
  }

  async rankCandidateGraphs(
    candidates: string[],
    wallMs?: number,
    objective?: OptimizationObjective,
    topK?: number
  ): Promise<CandidateRankingOutput> {
    const normalizedObjective = this.normalizeObjective(objective);
    const rows: CandidateRankingItem[] = [];

    for (let index = 0; index < candidates.length; index += 1) {
      const graphJson = String(candidates[index] ?? "").trim();
      if (!graphJson) {
        rows.push({
          index,
          ok: false,
          score: null,
          nodeCount: null,
          linkCount: null,
          throughputPerHourTotal: null,
          bestHeadlessSpeed: null,
          error: "graphJson is empty"
        });
        continue;
      }

      try {
        const result = await this.evaluateCandidateGraph(graphJson, wallMs, normalizedObjective);
        rows.push({
          index,
          ok: true,
          score: result.score,
          nodeCount: result.graph.nodeCount,
          linkCount: result.graph.linkCount,
          throughputPerHourTotal: result.kpi.throughputPerHourTotal,
          bestHeadlessSpeed: result.benchmarkSummary.bestHeadlessSpeed
        });
      } catch (error) {
        rows.push({
          index,
          ok: false,
          score: null,
          nodeCount: null,
          linkCount: null,
          throughputPerHourTotal: null,
          bestHeadlessSpeed: null,
          error: toErrorMessage(error)
        });
      }
    }

    const okRows = rows
      .filter((row) => row.ok)
      .sort((a, b) => Number(b.score ?? Number.NEGATIVE_INFINITY) - Number(a.score ?? Number.NEGATIVE_INFINITY));
    const failedRows = rows.filter((row) => !row.ok);
    const topKLimit = this.sanitizeTopK(topK);
    const rankedOk = topKLimit === null ? okRows : okRows.slice(0, topKLimit);

    return {
      objective: normalizedObjective,
      wallMs: this.sanitizeWallMs(wallMs),
      requestedCandidates: candidates.length,
      evaluatedCandidates: rows.length,
      succeeded: okRows.length,
      failed: failedRows.length,
      rankings: [...rankedOk, ...failedRows]
    };
  }

  async suggestTopologyImprovements(graphJson: string, maxSuggestions?: number): Promise<TopologyImprovementOutput> {
    const analysis = this.parseGraphForAnalysis(graphJson);
    const suggestions: TopologySuggestion[] = [];

    if (analysis.nodeCount === 0) {
      suggestions.push({
        severity: "warn",
        code: "graph.empty",
        message: "Graph has no nodes. Start from at least one source and one sink node."
      });
    }

    if (analysis.nodeCount > 1 && analysis.linkCount === 0) {
      suggestions.push({
        severity: "warn",
        code: "graph.no_links",
        message: "Graph has multiple nodes but no links. Connect process flow from source to sink."
      });
    }

    if (analysis.sourceNodeCount === 0 && analysis.nodeCount > 0) {
      suggestions.push({
        severity: "warn",
        code: "graph.no_source",
        message: "No source-like node detected. Add at least one source/start node."
      });
    }

    if (analysis.sinkNodeCount === 0 && analysis.nodeCount > 0) {
      suggestions.push({
        severity: "warn",
        code: "graph.no_sink",
        message: "No sink-like node detected. Add at least one sink/end node for throughput KPIs."
      });
    }

    if (analysis.isolatedNodeCount > 0) {
      suggestions.push({
        severity: "warn",
        code: "graph.isolated_nodes",
        message: String(analysis.isolatedNodeCount) + " isolated node(s) detected. Connect or remove them."
      });
    }

    if (analysis.unreachableNodeCount > 0) {
      suggestions.push({
        severity: "warn",
        code: "graph.unreachable_nodes",
        message: String(analysis.unreachableNodeCount) + " node(s) are unreachable from source side. Check link direction."
      });
    }

    if (analysis.cycleDetected) {
      suggestions.push({
        severity: "warn",
        code: "graph.cycle_detected",
        message: "Directed cycle detected. Verify loops do not create deadlocks or infinite circulation."
      });
    }

    if (analysis.nodeCount > 0 && analysis.linkToNodeRatio < 0.8) {
      suggestions.push({
        severity: "info",
        code: "graph.low_connectivity",
        message: "Connectivity is sparse. Consider adding buffers/transport links between stages."
      });
    }

    if (analysis.nodeCount > 0 && analysis.linkToNodeRatio > 3.0) {
      suggestions.push({
        severity: "info",
        code: "graph.high_complexity",
        message: "Topology is dense. Simplifying branches may improve maintainability and tuning speed."
      });
    }

    if (!suggestions.length) {
      suggestions.push({
        severity: "info",
        code: "graph.topology_balanced",
        message: "No major structural issues detected. Proceed with parameter tuning and benchmark search."
      });
    }

    return {
      nodeCount: analysis.nodeCount,
      linkCount: analysis.linkCount,
      sourceNodeCount: analysis.sourceNodeCount,
      sinkNodeCount: analysis.sinkNodeCount,
      isolatedNodeCount: analysis.isolatedNodeCount,
      unreachableNodeCount: analysis.unreachableNodeCount,
      cycleDetected: analysis.cycleDetected,
      linkToNodeRatio: analysis.linkToNodeRatio,
      nodeTypeCounts: analysis.nodeTypeCounts,
      warnings: analysis.warnings,
      suggestions: suggestions.slice(0, this.sanitizeSuggestionLimit(maxSuggestions))
    };
  }

  async close(): Promise<void> {
    const errors: string[] = [];

    if (this.page) {
      try {
        await this.page.close();
      } catch (error) {
        errors.push(`page.close failed: ${toErrorMessage(error)}`);
      }
      this.page = null;
    }

    if (this.browserContext) {
      try {
        await this.browserContext.close();
      } catch (error) {
        errors.push(`context.close failed: ${toErrorMessage(error)}`);
      }
      this.browserContext = null;
    }

    if (this.browser) {
      try {
        await this.browser.close();
      } catch (error) {
        errors.push(`browser.close failed: ${toErrorMessage(error)}`);
      }
      this.browser = null;
    }

    if (this.staticServer) {
      const server = this.staticServer;
      this.staticServer = null;
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }

    this.port = 0;
    this.initializing = null;

    if (errors.length) {
      this.logger("runtime close completed with warnings", errors);
    }
  }

  private parseTimelineCsv(csv: string): Array<Record<string, string>> {
    const text = String(csv ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines = text.split("\n").filter((line) => line.trim().length > 0);
    if (!lines.length) {
      return [];
    }

    const headers = this.parseCsvLine(lines[0]);
    const rows: Array<Record<string, string>> = [];

    for (let i = 1; i < lines.length; i += 1) {
      const values = this.parseCsvLine(lines[i]);
      if (!values.length) continue;
      const row: Record<string, string> = {};
      for (let c = 0; c < headers.length; c += 1) {
        row[String(headers[c] ?? `c${c}`)] = String(values[c] ?? "");
      }
      rows.push(row);
    }

    return rows;
  }

  private parseCsvLine(line: string): string[] {
    const out: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i += 1;
          continue;
        }
        inQuotes = !inQuotes;
        continue;
      }

      if (ch === "," && !inQuotes) {
        out.push(current);
        current = "";
        continue;
      }

      current += ch;
    }

    out.push(current);
    return out;
  }

  private parseGraphJsonObject(graphJson: string): Record<string, unknown> {
    const raw = String(graphJson ?? "").trim();
    if (!raw) {
      throw new Error("graphJson is required");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error("Invalid graphJson: " + toErrorMessage(error));
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("graphJson root must be a JSON object");
    }

    return parsed as Record<string, unknown>;
  }

  private getSerializedNodes(graph: Record<string, unknown>): Record<string, unknown>[] {
    const nodes = Array.isArray(graph.nodes) ? graph.nodes : Array.isArray(graph._nodes) ? graph._nodes : null;
    if (!Array.isArray(nodes)) {
      throw new Error("graph JSON does not contain nodes array");
    }
    return nodes.filter((node) => !!node && typeof node === "object") as Record<string, unknown>[];
  }

  private findSerializedNode(nodes: Record<string, unknown>[], nodeId: string | number): Record<string, unknown> | null {
    const targetKey = this.normalizeNodeId(nodeId);
    for (const node of nodes) {
      const currentId = (node as { id?: unknown }).id;
      if ((typeof currentId === "string" || typeof currentId === "number") && this.normalizeNodeId(currentId) === targetKey) {
        return node;
      }
    }
    return null;
  }

  private normalizeNodeId(nodeId: string | number): string {
    return String(nodeId);
  }
  private normalizePortKind(portKind: PortKind): PortKind {
    const value = String(portKind ?? "").trim().toLowerCase();
    if (value === "work" || value === "signal" || value === "carrier" || value === "pallet") {
      return value;
    }
    throw new Error('portKind must be one of: "work", "signal", "carrier", "pallet"');
  }

  private isPortSlotOfKind(slot: { name: string; type: string | null }, portKind: PortKind): boolean {
    const name = String(slot.name ?? "").trim().toLowerCase();
    const type = String(slot.type ?? "").trim().toLowerCase();
    const isSignal = name.includes("signal") || name.startsWith("sig") || type.includes("signal") || type === "string";
    const isCarrier = name.includes("carrier") || type.includes("carrier") || type.includes("agv");
    const isPallet = name.includes("pallet") || type.includes("pallet");

    if (portKind === "signal") {
      return isSignal;
    }
    if (portKind === "carrier") {
      return isCarrier;
    }
    if (portKind === "pallet") {
      return isPallet;
    }

    // work ports are usually typed as "0" or "work" and should exclude other special channels.
    if (isSignal || isCarrier || isPallet) {
      return false;
    }
    return type === "0" || type === "work" || name.includes("work");
  }

  private selectPortSlot(slots: PortKindSlot[], explicitSlot: number | undefined, argName: string): PortKindSlot {
    if (!slots.length) {
      throw new Error(`${argName}: no candidate slots are available`);
    }

    if (typeof explicitSlot === "number" && Number.isFinite(explicitSlot)) {
      const normalized = this.normalizeSlot(explicitSlot, 0);
      const matched = slots.find((slot) => slot.slot === normalized);
      if (!matched) {
        const candidates = slots.map((slot) => slot.slot).sort((a, b) => a - b);
        throw new Error(`${argName} ${normalized} is not compatible with selected port kind. candidates=[${candidates.join(", ")}]`);
      }
      return matched;
    }

    const ranked = [...slots].sort((a, b) => {
      if (a.linkCount !== b.linkCount) {
        return a.linkCount - b.linkCount;
      }
      return a.slot - b.slot;
    });
    return ranked[0];
  }

  private normalizeSlot(slot: number | undefined, fallback: number): number {
    if (typeof slot !== "number" || !Number.isFinite(slot)) {
      return fallback;
    }
    return Math.max(0, Math.floor(slot));
  }

  private parseSerializedLinkRecord(rawEntry: unknown): {
    id: number | null;
    fromId: string | number;
    fromSlot: number;
    toId: string | number;
    toSlot: number;
    type: number;
  } | null {
    if (Array.isArray(rawEntry)) {
      const fromRaw = rawEntry.length > 1 ? rawEntry[1] : null;
      const toRaw = rawEntry.length > 3 ? rawEntry[3] : null;
      if ((typeof fromRaw !== "string" && typeof fromRaw !== "number") || (typeof toRaw !== "string" && typeof toRaw !== "number")) {
        return null;
      }

      const idRaw = rawEntry.length > 0 ? Number(rawEntry[0]) : Number.NaN;
      const fromSlotRaw = rawEntry.length > 2 ? Number(rawEntry[2]) : Number.NaN;
      const toSlotRaw = rawEntry.length > 4 ? Number(rawEntry[4]) : Number.NaN;
      const typeRaw = rawEntry.length > 5 ? Number(rawEntry[5]) : Number.NaN;

      return {
        id: Number.isFinite(idRaw) && idRaw > 0 ? Math.floor(idRaw) : null,
        fromId: fromRaw,
        fromSlot: Number.isFinite(fromSlotRaw) && fromSlotRaw >= 0 ? Math.floor(fromSlotRaw) : 0,
        toId: toRaw,
        toSlot: Number.isFinite(toSlotRaw) && toSlotRaw >= 0 ? Math.floor(toSlotRaw) : 0,
        type: Number.isFinite(typeRaw) ? typeRaw : 0
      };
    }

    if (!rawEntry || typeof rawEntry !== "object") {
      return null;
    }

    const entry = rawEntry as Record<string, unknown>;
    const fromRaw = entry.origin_id ?? entry.from ?? entry.from_id ?? entry["1"];
    const toRaw = entry.target_id ?? entry.to ?? entry.to_id ?? entry["3"];
    if ((typeof fromRaw !== "string" && typeof fromRaw !== "number") || (typeof toRaw !== "string" && typeof toRaw !== "number")) {
      return null;
    }

    const idRaw = Number(entry.id ?? entry[0] ?? Number.NaN);
    const fromSlotRaw = Number(entry.origin_slot ?? entry.from_slot ?? entry[2] ?? Number.NaN);
    const toSlotRaw = Number(entry.target_slot ?? entry.to_slot ?? entry[4] ?? Number.NaN);
    const typeRaw = Number(entry.type ?? entry[5] ?? Number.NaN);

    return {
      id: Number.isFinite(idRaw) && idRaw > 0 ? Math.floor(idRaw) : null,
      fromId: fromRaw,
      fromSlot: Number.isFinite(fromSlotRaw) && fromSlotRaw >= 0 ? Math.floor(fromSlotRaw) : 0,
      toId: toRaw,
      toSlot: Number.isFinite(toSlotRaw) && toSlotRaw >= 0 ? Math.floor(toSlotRaw) : 0,
      type: Number.isFinite(typeRaw) ? typeRaw : 0
    };
  }

  private canonicalizeSerializedLinks(rawLinks: unknown): Array<[number, string | number, number, string | number, number, number]> {
    const entries = Array.isArray(rawLinks)
      ? rawLinks
      : rawLinks && typeof rawLinks === "object"
        ? Object.values(rawLinks as Record<string, unknown>)
        : [];

    const result: Array<[number, string | number, number, string | number, number, number]> = [];
    const usedIds = new Set<number>();
    let nextId = 1;

    for (const entry of entries) {
      const parsed = this.parseSerializedLinkRecord(entry);
      if (!parsed) continue;

      let linkId = parsed.id;
      if (linkId === null || usedIds.has(linkId)) {
        while (usedIds.has(nextId)) {
          nextId += 1;
        }
        linkId = nextId;
      }

      usedIds.add(linkId);
      if (linkId >= nextId) {
        nextId = linkId + 1;
      }

      result.push([linkId, parsed.fromId, parsed.fromSlot, parsed.toId, parsed.toSlot, parsed.type]);
    }

    return result;
  }


  private sanitizeNumberOption(value: unknown, fallback: number, min?: number, max?: number): number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return fallback;
    }

    let result = value;
    if (typeof min === "number" && Number.isFinite(min)) {
      result = Math.max(min, result);
    }
    if (typeof max === "number" && Number.isFinite(max)) {
      result = Math.min(max, result);
    }
    return result;
  }

  private sanitizeIntegerOption(value: unknown, fallback: number, min?: number, max?: number): number {
    const sanitized = this.sanitizeNumberOption(value, fallback, min, max);
    return Math.floor(sanitized);
  }

  private readOptionalNonNegativeInt(value: unknown): number | undefined {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return undefined;
    }
    const normalized = Math.floor(value);
    if (normalized < 0) {
      throw new Error("slot must be a non-negative integer");
    }
    return normalized;
  }

  private computeLineOptimizationScore(throughputPerHourTotal: number, totalCompleted: number): number {
    const throughput = Number.isFinite(throughputPerHourTotal) ? Math.max(0, throughputPerHourTotal) : 0;
    const completed = Number.isFinite(totalCompleted) ? Math.max(0, totalCompleted) : 0;
    return throughput + Math.sqrt(completed) * 0.05;
  }

  private roundNumber(value: number, digits: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }
    const safeDigits = Math.max(0, Math.min(12, Math.floor(digits)));
    const factor = 10 ** safeDigits;
    return Math.round(value * factor) / factor;
  }  private normalizeObjective(objective?: OptimizationObjective): OptimizationObjective {
    const value = String(objective ?? "throughput").trim().toLowerCase();
    if (value === "throughput" || value === "throughput_per_node" || value === "balanced") {
      return value;
    }
    throw new Error("objective must be one of: throughput, throughput_per_node, balanced");
  }

  private computeObjectiveScore(
    objective: OptimizationObjective,
    metrics: { throughputPerHourTotal: number; bestHeadlessSpeed: number; nodeCount: number; linkCount: number }
  ): number {
    const throughput = Number.isFinite(metrics.throughputPerHourTotal) ? Math.max(0, metrics.throughputPerHourTotal) : 0;
    const bestHeadlessSpeed = Number.isFinite(metrics.bestHeadlessSpeed) ? Math.max(0, metrics.bestHeadlessSpeed) : 0;
    const nodeCount = Number.isFinite(metrics.nodeCount) ? Math.max(0, metrics.nodeCount) : 0;
    const linkCount = Number.isFinite(metrics.linkCount) ? Math.max(0, metrics.linkCount) : 0;

    switch (objective) {
      case "throughput":
        return throughput;
      case "throughput_per_node":
        return throughput / Math.max(1, nodeCount);
      case "balanced": {
        const densityPenalty = Math.max(0, nodeCount * 1.5 - linkCount);
        return throughput + bestHeadlessSpeed * 0.35 - nodeCount * 0.25 - densityPenalty * 0.1;
      }
      default:
        return throughput;
    }
  }

  private sanitizeWallMs(wallMs?: number): number | null {
    if (typeof wallMs !== "number" || !Number.isFinite(wallMs)) {
      return null;
    }
    return Math.max(100, Math.floor(wallMs));
  }

  private sanitizeTopK(topK?: number): number | null {
    if (typeof topK !== "number" || !Number.isFinite(topK)) {
      return null;
    }
    return Math.max(1, Math.min(1000, Math.floor(topK)));
  }

  private sanitizeSuggestionLimit(maxSuggestions?: number): number {
    if (typeof maxSuggestions !== "number" || !Number.isFinite(maxSuggestions)) {
      return 10;
    }
    return Math.max(1, Math.min(50, Math.floor(maxSuggestions)));
  }

  private parseGraphForAnalysis(graphJson: string): {
    nodeCount: number;
    linkCount: number;
    sourceNodeCount: number;
    sinkNodeCount: number;
    isolatedNodeCount: number;
    unreachableNodeCount: number;
    cycleDetected: boolean;
    linkToNodeRatio: number;
    nodeTypeCounts: Record<string, number>;
    warnings: string[];
  } {
    const raw = String(graphJson ?? "").trim();
    if (!raw) {
      throw new Error("graphJson is required");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error("Invalid graphJson: " + toErrorMessage(error));
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("graphJson root must be a JSON object");
    }

    const candidate = parsed as {
      nodes?: unknown;
      _nodes?: unknown;
      links?: unknown;
    };

    const warnings: string[] = [];
    const nodesRaw = Array.isArray(candidate.nodes)
      ? candidate.nodes
      : Array.isArray(candidate._nodes)
        ? candidate._nodes
        : [];

    if (!Array.isArray(candidate.nodes)) {
      warnings.push('"nodes" array is missing (used fallback check).');
    }

    const nodeTypeCounts: Record<string, number> = {};
    const idToKey = new Map<string, string>();
    const nodeInfos = nodesRaw.map((node, index) => {
      const asNode = node as { id?: unknown; type?: unknown; title?: unknown };
      const nodeId = typeof asNode.id === "string" || typeof asNode.id === "number" ? asNode.id : null;
      const key = this.toNodeKey(nodeId, index);
      const type = String(asNode.type ?? "").trim();
      const title = String(asNode.title ?? "").trim();
      const typeKey = type || "unknown";
      nodeTypeCounts[typeKey] = (nodeTypeCounts[typeKey] ?? 0) + 1;
      if (nodeId !== null) {
        idToKey.set(String(nodeId), key);
      }
      return { key, type, title };
    });

    const incoming = new Map<string, number>();
    const outgoing = new Map<string, number>();
    const adjacency = new Map<string, Set<string>>();

    for (const node of nodeInfos) {
      incoming.set(node.key, 0);
      outgoing.set(node.key, 0);
      adjacency.set(node.key, new Set<string>());
    }

    const linkEntries = Array.isArray(candidate.links)
      ? candidate.links
      : candidate.links && typeof candidate.links === "object"
        ? Object.values(candidate.links as Record<string, unknown>)
        : [];

    if (!candidate.links || (typeof candidate.links !== "object" && !Array.isArray(candidate.links))) {
      warnings.push('"links" is missing or not an object/array.');
    }

    let validLinkCount = 0;
    let invalidLinkCount = 0;

    for (const entry of linkEntries) {
      const endpoints = this.extractLinkEndpoints(entry);
      if (!endpoints) {
        invalidLinkCount += 1;
        continue;
      }

      const fromKey = endpoints.fromId !== null ? idToKey.get(String(endpoints.fromId)) ?? null : null;
      const toKey = endpoints.toId !== null ? idToKey.get(String(endpoints.toId)) ?? null : null;
      if (!fromKey || !toKey) {
        invalidLinkCount += 1;
        continue;
      }

      validLinkCount += 1;
      outgoing.set(fromKey, (outgoing.get(fromKey) ?? 0) + 1);
      incoming.set(toKey, (incoming.get(toKey) ?? 0) + 1);
      adjacency.get(fromKey)?.add(toKey);
    }

    if (invalidLinkCount > 0) {
      warnings.push(String(invalidLinkCount) + " link(s) could not be resolved to known node ids.");
    }

    let sourceNodeCount = 0;
    let sinkNodeCount = 0;
    let isolatedNodeCount = 0;

    for (const node of nodeInfos) {
      const inCount = incoming.get(node.key) ?? 0;
      const outCount = outgoing.get(node.key) ?? 0;
      const lowerType = node.type.toLowerCase();
      const lowerTitle = node.title.toLowerCase();
      const sourceHint = lowerType.includes("source") || lowerTitle.includes("source");
      const sinkHint = lowerType.includes("sink") || lowerTitle.includes("sink");

      if (sourceHint || inCount === 0) {
        sourceNodeCount += 1;
      }
      if (sinkHint || outCount === 0) {
        sinkNodeCount += 1;
      }
      if (inCount === 0 && outCount === 0) {
        isolatedNodeCount += 1;
      }
    }

    const traversalStarts = nodeInfos.filter((node) => (incoming.get(node.key) ?? 0) === 0).map((node) => node.key);
    if (!traversalStarts.length && nodeInfos.length > 0) {
      traversalStarts.push(nodeInfos[0].key);
    }

    const visited = new Set<string>();
    const queue = [...traversalStarts];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || visited.has(current)) continue;
      visited.add(current);
      for (const next of adjacency.get(current) ?? []) {
        if (!visited.has(next)) {
          queue.push(next);
        }
      }
    }

    const unreachableNodeCount = nodeInfos.filter((node) => !visited.has(node.key)).length;
    const cycleDetected = this.hasDirectedCycle(adjacency);
    const nodeCount = nodeInfos.length;
    const linkCount = linkEntries.length;

    return {
      nodeCount,
      linkCount,
      sourceNodeCount,
      sinkNodeCount,
      isolatedNodeCount,
      unreachableNodeCount,
      cycleDetected,
      linkToNodeRatio: nodeCount > 0 ? validLinkCount / nodeCount : 0,
      nodeTypeCounts,
      warnings
    };
  }

  private toNodeKey(nodeId: string | number | null, index: number): string {
    if (nodeId === null) {
      return `__idx_${index}`;
    }
    return String(nodeId);
  }

  private extractLinkEndpoints(linkEntry: unknown): { fromId: string | number | null; toId: string | number | null } | null {
    if (Array.isArray(linkEntry)) {
      const fromId = linkEntry.length > 1 ? linkEntry[1] : null;
      const toId = linkEntry.length > 3 ? linkEntry[3] : null;
      const fromValid = typeof fromId === "string" || typeof fromId === "number";
      const toValid = typeof toId === "string" || typeof toId === "number";
      if (fromValid && toValid) {
        return { fromId, toId };
      }
      return null;
    }

    if (!linkEntry || typeof linkEntry !== "object") {
      return null;
    }

    const raw = linkEntry as Record<string, unknown>;
    const fromId = raw.origin_id ?? raw.from ?? raw.from_id ?? raw["1"] ?? null;
    const toId = raw.target_id ?? raw.to ?? raw.to_id ?? raw["3"] ?? null;
    const fromValid = typeof fromId === "string" || typeof fromId === "number";
    const toValid = typeof toId === "string" || typeof toId === "number";
    if (!fromValid || !toValid) {
      return null;
    }

    return {
      fromId,
      toId
    };
  }

  private hasDirectedCycle(adjacency: Map<string, Set<string>>): boolean {
    const state = new Map<string, 0 | 1 | 2>();

    const visit = (node: string): boolean => {
      const currentState = state.get(node) ?? 0;
      if (currentState === 1) return true;
      if (currentState === 2) return false;

      state.set(node, 1);
      for (const next of adjacency.get(node) ?? []) {
        if (visit(next)) {
          return true;
        }
      }
      state.set(node, 2);
      return false;
    };

    for (const key of adjacency.keys()) {
      if ((state.get(key) ?? 0) === 0 && visit(key)) {
        return true;
      }
    }

    return false;
  }

  private summarizeBenchmark(result: BenchmarkOutput): ScenarioBenchmarkSummary {
    const speedFor = (mode: string, renderCase: string): number | null => {
      const row = result.results.find((item) => item.mode === mode && item.renderCase === renderCase);
      if (!row || !Number.isFinite(row.speed)) return null;
      return Number(row.speed);
    };

    const headlessDtSpeed = speedFor("dt", "headless");
    const headlessEventSpeed = speedFor("event", "headless");
    const renderDtSpeed = speedFor("dt", "render");
    const renderEventSpeed = speedFor("event", "render");

    const headlessCandidates = [
      { mode: "dt", speed: headlessDtSpeed },
      { mode: "event", speed: headlessEventSpeed }
    ].filter((item) => typeof item.speed === "number") as Array<{ mode: string; speed: number }>;

    const bestHeadless =
      headlessCandidates.length > 0
        ? headlessCandidates.reduce((best, current) => (current.speed > best.speed ? current : best))
        : null;

    return {
      bestHeadlessMode: bestHeadless?.mode ?? null,
      bestHeadlessSpeed: bestHeadless?.speed ?? null,
      headlessDtSpeed,
      headlessEventSpeed,
      renderDtSpeed,
      renderEventSpeed
    };
  }

  private resolveSnapshotPath(fileName?: string): string {
    const trimmed = String(fileName ?? "").trim();
    if (!trimmed) {
      return path.resolve(process.cwd(), "artifacts", "fact-sim-snapshot-" + Date.now() + ".png");
    }

    const normalized = trimmed.replace(/\\/g, "/");
    const hasPngExt = normalized.toLowerCase().endsWith(".png");
    const withExt = hasPngExt ? normalized : normalized + ".png";
    if (path.isAbsolute(withExt)) {
      return path.normalize(withExt);
    }

    return path.resolve(process.cwd(), withExt);
  }

  private resolveHtmlPath(fileName?: string): string {
    const trimmed = String(fileName ?? "").trim();
    if (!trimmed) {
      return path.resolve(process.cwd(), "artifacts", "fact-sim-export-" + Date.now() + ".html");
    }

    const normalized = trimmed.replace(/\\/g, "/");
    const hasHtmlExt = normalized.toLowerCase().endsWith(".html");
    const withExt = hasHtmlExt ? normalized : normalized + ".html";
    if (path.isAbsolute(withExt)) {
      return path.normalize(withExt);
    }

    return path.resolve(process.cwd(), withExt);
  }

  private resolveAbsolutePath(filePath: string): string {
    const trimmed = String(filePath ?? "").trim();
    if (!trimmed) {
      throw new Error("filePath is required");
    }

    if (path.isAbsolute(trimmed)) {
      return path.normalize(trimmed);
    }

    return path.resolve(process.cwd(), trimmed);
  }

  private resolveCsvPath(fileName?: string): string {
    const trimmed = String(fileName ?? "").trim();
    if (!trimmed) {
      return path.resolve(process.cwd(), "artifacts", "fact-sim-timeline-" + Date.now() + ".csv");
    }

    const normalized = trimmed.replace(/\\/g, "/");
    const withExt = normalized.toLowerCase().endsWith(".csv") ? normalized : normalized + ".csv";
    return this.resolveAbsolutePath(withExt);
  }

  private resolveJsonPath(fileName?: string): string {
    const trimmed = String(fileName ?? "").trim();
    if (!trimmed) {
      return path.resolve(process.cwd(), "artifacts", "fact-sim-graph-" + Date.now() + ".json");
    }

    const normalized = trimmed.replace(/\\/g, "/");
    const withExt = normalized.toLowerCase().endsWith(".json") ? normalized : normalized + ".json";
    return this.resolveAbsolutePath(withExt);
  }

  private resolveReportPath(fileName?: string): string {
    const trimmed = String(fileName ?? "").trim();
    if (!trimmed) {
      return path.resolve(process.cwd(), "artifacts", "fact-sim-report-" + Date.now() + ".json");
    }

    const normalized = trimmed.replace(/\\/g, "/");
    const withExt = normalized.toLowerCase().endsWith(".json") ? normalized : normalized + ".json";
    return this.resolveAbsolutePath(withExt);
  }

  private async ensureReady(): Promise<Page> {
    if (this.page) return this.page;

    if (!this.initializing) {
      this.initializing = this.initialize();
    }
    await this.initializing;

    if (!this.page) {
      throw new Error("fact_sim page failed to initialize");
    }
    return this.page;
  }

  private async initialize(): Promise<void> {
    try {
      await this.ensureStaticServer();
      this.browser = await chromium.launch({
        headless: true
      });
      this.browserContext = await this.browser.newContext({
        viewport: { width: 1440, height: 900 }
      });
      this.page = await this.browserContext.newPage();

      const appUrl = `http://127.0.0.1:${this.port}/index.html`;
      await this.page.goto(appUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
      await this.page.waitForFunction(() => {
        const w = window as unknown as Record<string, unknown>;
        const app = w.App as { graph?: unknown } | undefined;
        return !!app?.graph;
      }, undefined, { timeout: 30000 });
    } catch (error) {
      await this.close();
      const message = toErrorMessage(error);
      throw new Error(
        `Failed to initialize fact_sim runtime: ${message}. If Chromium is missing, run "npx playwright install chromium" in fact_sim_mcp.`
      );
    }
  }

  private async ensureStaticServer(): Promise<void> {
    if (this.staticServer) return;

    this.staticServer = createServer((req, res) => {
      void this.handleStaticRequest(req, res);
    });

    try {
      this.port = await this.listenServer(this.staticServer, this.preferredPort);
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== "EADDRINUSE") {
        throw error;
      }
      this.port = await this.listenServer(this.staticServer, 0);
    }

    this.logger("local static server is ready", { port: this.port, root: this.repoRoot });
  }

  private async listenServer(server: ReturnType<typeof createServer>, port: number): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      const onError = (error: Error) => {
        server.off("listening", onListening);
        reject(error);
      };
      const onListening = () => {
        server.off("error", onError);
        const address = server.address() as AddressInfo | null;
        if (!address) {
          reject(new Error("Static server failed to bind"));
          return;
        }
        resolve(address.port);
      };

      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(port, "127.0.0.1");
    });
  }

  private async handleStaticRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const method = req.method ?? "GET";
    if (method !== "GET" && method !== "HEAD") {
      res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Method Not Allowed");
      return;
    }

    let pathname = "/";
    try {
      const requestUrl = new URL(req.url ?? "/", "http://127.0.0.1");
      pathname = decodeURIComponent(requestUrl.pathname || "/");
    } catch (_error) {
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Bad Request");
      return;
    }

    if (pathname === "/") pathname = "/index.html";
    const candidatePath = path.resolve(this.repoRoot, `.${pathname}`);
    const relative = path.relative(this.repoRoot, candidatePath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Forbidden");
      return;
    }

    let finalPath = candidatePath;
    try {
      const st = await stat(finalPath);
      if (st.isDirectory()) {
        finalPath = path.join(finalPath, "index.html");
      }
      await access(finalPath);
    } catch (_error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not Found");
      return;
    }

    const headers = { "Content-Type": getMimeType(finalPath) };
    if (method === "HEAD") {
      res.writeHead(200, headers);
      res.end();
      return;
    }

    res.writeHead(200, headers);
    const stream = createReadStream(finalPath);
    stream.on("error", (error) => {
      this.logger("static file stream error", toErrorMessage(error));
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      }
      res.end("Internal Server Error");
    });
    stream.pipe(res);
  }
}

























