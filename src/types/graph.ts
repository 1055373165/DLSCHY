/**
 * 图/拓扑相关类型定义
 * 北极星力导向图（Decision 10）+ 拓扑层级交互（Decision 11）
 */

export interface ProjectGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters: GraphCluster[];
}

export interface GraphNode {
  id: string;
  label: string;
  type: 'file';
  module: string;
  metrics: {
    pageRank: number;
    inDegree: number;
    outDegree: number;
  };
  isHotPath: boolean;
  hotPathRank?: number;
  isCompleted: boolean;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  isHotPathEdge: boolean;
}

export interface GraphCluster {
  id: string;
  label: string;
  nodeIds: string[];
  color: string;
}
