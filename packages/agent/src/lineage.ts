/**
 * Lineage tracking: tool execution provenance and session genealogy
 * Enables debugging, outcome learning, session continuity
 */

export interface LineageNode {
  id: string;
  type: 'session' | 'turn' | 'tool_call' | 'tool_result';
  parentId?: string;
  timestamp: number;
  metadata: Record<string, any>;
}

export interface ToolExecutionTrace {
  callId: string;
  resultId?: string;
  toolName: string;
  args: any;
  result?: any;
  success?: boolean;
  duration?: number;
  parentTurnId: string;
  parentSessionId: string;
}

export interface SessionLineage {
  sessionId: string;
  parentSessionId?: string;
  ancestors: string[]; // Ordered from immediate parent to root
  depth: number;
}

export class LineageTracker {
  private lineageGraph: Map<string, LineageNode> = new Map();

  /**
   * Track session creation with parent lineage
   */
  trackSessionCreation(sessionId: string, parentSessionId?: string, memoryStore?: any): SessionLineage {
    const ancestors: string[] = [];
    let depth = 0;

    if (parentSessionId) {
      // Try to get parent from lineage graph first
      let parentNode = this.lineageGraph.get(parentSessionId);

      // If not in graph and we have memory store, reconstruct from memory
      if (!parentNode && memoryStore) {
        const parentSession = memoryStore.getSession(parentSessionId);
        if (parentSession) {
          // Recursively track parent
          this.trackSessionCreation(parentSessionId, parentSession.parentSessionId, memoryStore);
          parentNode = this.lineageGraph.get(parentSessionId);
        }
      }

      if (parentNode) {
        ancestors.push(parentSessionId);
        const parentAncestors = parentNode.metadata.ancestors || [];
        ancestors.push(...parentAncestors);
        depth = (parentNode.metadata.depth || 0) + 1;
      }
    }

    const node: LineageNode = {
      id: sessionId,
      type: 'session',
      parentId: parentSessionId,
      timestamp: Date.now(),
      metadata: {
        ancestors,
        depth
      }
    };

    this.lineageGraph.set(sessionId, node);

    return {
      sessionId,
      parentSessionId,
      ancestors,
      depth
    };
  }

  /**
   * Track agent turn with parent session
   */
  trackTurn(turnId: string, sessionId: string, input: string): void {
    const node: LineageNode = {
      id: turnId,
      type: 'turn',
      parentId: sessionId,
      timestamp: Date.now(),
      metadata: {
        input,
        sessionId
      }
    };

    this.lineageGraph.set(turnId, node);
  }

  /**
   * Track tool execution with full provenance
   */
  trackToolExecution(
    callId: string,
    turnId: string,
    sessionId: string,
    toolName: string,
    args: any
  ): void {
    const node: LineageNode = {
      id: callId,
      type: 'tool_call',
      parentId: turnId,
      timestamp: Date.now(),
      metadata: {
        toolName,
        args,
        turnId,
        sessionId
      }
    };

    this.lineageGraph.set(callId, node);
  }

  /**
   * Track tool result linked to call
   */
  trackToolResult(
    resultId: string,
    callId: string,
    result: any,
    success: boolean,
    duration: number
  ): void {
    const callNode = this.lineageGraph.get(callId);
    if (!callNode) {
      throw new Error(`Tool call ${callId} not found in lineage`);
    }

    const node: LineageNode = {
      id: resultId,
      type: 'tool_result',
      parentId: callId,
      timestamp: Date.now(),
      metadata: {
        result,
        success,
        duration,
        callId,
        toolName: callNode.metadata.toolName
      }
    };

    this.lineageGraph.set(resultId, node);
  }

  /**
   * Get full execution trace for a tool call
   */
  getToolExecutionTrace(callId: string): ToolExecutionTrace | null {
    const callNode = this.lineageGraph.get(callId);
    if (!callNode || callNode.type !== 'tool_call') {
      return null;
    }

    // Find result node
    let resultNode: LineageNode | undefined;
    for (const node of this.lineageGraph.values()) {
      if (node.type === 'tool_result' && node.parentId === callId) {
        resultNode = node;
        break;
      }
    }

    return {
      callId,
      resultId: resultNode?.id,
      toolName: callNode.metadata.toolName,
      args: callNode.metadata.args,
      result: resultNode?.metadata.result,
      success: resultNode?.metadata.success,
      duration: resultNode?.metadata.duration,
      parentTurnId: callNode.metadata.turnId,
      parentSessionId: callNode.metadata.sessionId
    };
  }

  /**
   * Get session lineage (ancestors)
   */
  getSessionLineage(sessionId: string): SessionLineage | null {
    const node = this.lineageGraph.get(sessionId);
    if (!node || node.type !== 'session') {
      return null;
    }

    return {
      sessionId,
      parentSessionId: node.parentId,
      ancestors: node.metadata.ancestors || [],
      depth: node.metadata.depth || 0
    };
  }

  /**
   * Find all tool executions in a session
   */
  getSessionToolExecutions(sessionId: string): ToolExecutionTrace[] {
    const traces: ToolExecutionTrace[] = [];

    for (const node of this.lineageGraph.values()) {
      if (node.type === 'tool_call' && node.metadata.sessionId === sessionId) {
        const trace = this.getToolExecutionTrace(node.id);
        if (trace) {
          traces.push(trace);
        }
      }
    }

    return traces;
  }

  /**
   * Find all descendants of a session
   */
  getSessionDescendants(sessionId: string): string[] {
    const descendants: string[] = [];

    for (const node of this.lineageGraph.values()) {
      if (node.type === 'session' && node.parentId === sessionId) {
        descendants.push(node.id);
        // Recursively get descendants
        const childDescendants = this.getSessionDescendants(node.id);
        descendants.push(...childDescendants);
      }
    }

    return descendants;
  }

  /**
   * Get ancestry path (root to current)
   */
  getAncestryPath(sessionId: string): string[] {
    const lineage = this.getSessionLineage(sessionId);
    if (!lineage) {
      return [];
    }

    // Reverse ancestors to get root-to-current
    return [...lineage.ancestors].reverse().concat(sessionId);
  }

  /**
   * Export lineage as JSON for persistence
   */
  exportLineage(): string {
    const entries = Array.from(this.lineageGraph.entries());
    return JSON.stringify(entries);
  }

  /**
   * Import lineage from JSON
   */
  importLineage(json: string): void {
    const entries = JSON.parse(json) as Array<[string, LineageNode]>;
    this.lineageGraph = new Map(entries);
  }

  /**
   * Clear lineage data
   */
  clear(): void {
    this.lineageGraph.clear();
  }
}
