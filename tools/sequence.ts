import { executeProbe, validateProbe } from "./client.js";
import type { LabContext, ProbeInput, ProbeResult } from "./types.js";
import { MAX_STEPS } from "./types.js";

export interface SequenceRequest {
  seq: string;
  steps: ProbeInput[];
}

export interface SequenceResult {
  results: ProbeResult[];
  stopped: boolean;
  message: string;
}

export async function executeSequence(request: SequenceRequest, ctx: LabContext): Promise<SequenceResult> {
  if (request.seq.trim().length === 0) {
    return { results: [], stopped: true, message: "seq vacía" };
  }
  if (request.steps.length === 0) {
    return { results: [], stopped: true, message: "la secuencia no tiene pasos" };
  }
  if (request.steps.length > MAX_STEPS) {
    return { results: [], stopped: true, message: `la secuencia supera el máximo de ${MAX_STEPS} pasos` };
  }
  for (const step of request.steps) {
    if (step.seq !== request.seq) {
      return { results: [], stopped: true, message: "todos los pasos deben usar la misma seq" };
    }
    const problem = validateProbe(step, ctx);
    if (problem !== null) {
      return { results: [], stopped: true, message: problem };
    }
  }

  const results: ProbeResult[] = [];
  for (const step of request.steps) {
    const result = await executeProbe(step, ctx);
    results.push(result);
    if (result.duplicate) {
      continue;
    }
    if (!result.sent || !result.usableAsEvidence) {
      return {
        results,
        stopped: true,
        message: result.message,
      };
    }
  }
  return { results, stopped: false, message: "secuencia completada" };
}
