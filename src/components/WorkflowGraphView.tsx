import styles from "./WorkflowGraphView.module.css";

export interface WorkflowGraphNode {
  id: string;
  label: string;
  type?: string;
  capability?: string | null;
  goal?: string | null;
  node_kind?: string | null;
  status?: string | null;
}

export interface WorkflowGraphEdge {
  source: string;
  target: string;
  label?: string | null;
}

const CAPABILITY_LABELS: Record<string, string> = {
  receive_question: "Получение вопроса",
  knowledge_search: "Поиск в БЗ",
  rag_retrieval: "RAG-извлечение",
  llm_answer: "Формирование ответа",
  present_answer: "Показ ответа",
  human_approval: "Согласование"
};

const STATUS_LABELS: Record<string, string> = {
  completed: "Выполнено",
  running: "Выполняется",
  failed: "Ошибка",
  pending: "Ожидание",
  skipped: "Пропущено"
};

function statusClass(status: string | null | undefined, css: Record<string, string>): string {
  switch (status) {
    case "completed":
      return css.nodeOk ?? "";
    case "failed":
      return css.nodeFail ?? "";
    case "running":
      return css.nodeRunning ?? "";
    default:
      return "";
  }
}

interface WorkflowGraphViewProps {
  nodes?: WorkflowGraphNode[] | null;
  edges?: WorkflowGraphEdge[] | null;
}

export default function WorkflowGraphView({ nodes, edges }: WorkflowGraphViewProps) {
  const graphNodes = nodes ?? [];
  const graphEdges = edges ?? [];
  if (!graphNodes.length) {
    return <div className={styles.empty}>Workflow появится после формирования blueprint.</div>;
  }

  const order = buildNodeOrder(graphNodes, graphEdges);

  return (
    <div className={styles.graph}>
      {order.map((node, index) => (
        <div key={node.id} className={styles.item}>
          <div
            className={`${styles.node} ${
              node.type === "start"
                ? styles.nodeStart
                : node.type === "end"
                  ? styles.nodeEnd
                  : styles.nodeStep
            } ${statusClass(node.status, styles)}`}
          >
            <strong>{node.label}</strong>
            {node.status ? (
              <span className={styles.statusBadge}>{STATUS_LABELS[node.status] ?? node.status}</span>
            ) : null}
            {node.capability ? (
              <span className={styles.capabilityBadge}>
                {CAPABILITY_LABELS[node.capability] ?? node.capability}
              </span>
            ) : null}
            {node.goal ? <div className={styles.goal}>{node.goal}</div> : null}
          </div>
          {index < order.length - 1 ? <div className={styles.arrow}>↓</div> : null}
        </div>
      ))}
    </div>
  );
}

function buildNodeOrder(
  nodes: WorkflowGraphNode[],
  edges: WorkflowGraphEdge[]
): WorkflowGraphNode[] {
  if (!edges.length) {
    return nodes;
  }
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const outgoing = new Map<string, string>();
  for (const edge of edges) {
    outgoing.set(edge.source, edge.target);
  }
  const start = nodes.find((node) => node.type === "start") ?? nodes[0];
  const ordered: WorkflowGraphNode[] = [];
  const visited = new Set<string>();
  let current: WorkflowGraphNode | undefined = start;
  while (current && !visited.has(current.id)) {
    ordered.push(current);
    visited.add(current.id);
    const nextId = outgoing.get(current.id);
    current = nextId ? byId.get(nextId) : undefined;
  }
  for (const node of nodes) {
    if (!visited.has(node.id)) {
      ordered.push(node);
    }
  }
  return ordered;
}
