/** Исправление типичных синтаксических ошибок LLM в Mermaid flowchart. */
const NODE_BRACKET_RE = new RegExp(String.raw`(\b[A-Za-z_][\w]*)\s*\[(?!["/])([^\]\n]+)\]`, "g");
const NODE_DOUBLE_BRACKET_RE = new RegExp(String.raw`(\b[A-Za-z_][\w]*)\s*\[\[(?!["/])([^\]\n]+)\]\]`, "g");
const DECISION_NODE_RE = new RegExp(String.raw`(\b[A-Za-z_][\w]*)\{(?!["/])([^}\n]+)\}`, "g");
const ROUND_NODE_RE = new RegExp(String.raw`(\b[A-Za-z_][\w]*)\(\[(?!["])([^\]\n]+)\]\)`, "g");
const SUBGRAPH_BRACKET_RE = new RegExp(String.raw`^\s*subgraph\s+([A-Za-z_][\w]*)\s*\[(?!")([^\]\n]+)\]`, "gm");
const SUBGRAPH_DECL_RE = new RegExp(String.raw`^(\s*subgraph\s+)([^\[\n"]+?)(\s*\[)`, "gm");
const FLOWCHART_HEADER_RE = /^\s*(graph|flowchart)\s+(TD|LR|BT|RL)\b/im;
const NODE_HOP_EDGE_RE = /-->\|([A-Za-z_][\w]*)\|\s*-->/g;
const TRAILING_NODE_HOP_RE = /-->\|([A-Za-z_][\w]*)\|\s*$/;
const SUBGRAPH_END_PLACEHOLDER = "__MERMAID_SUBGRAPH_END__";

function escapeLabel(text: string): string {
  return text.replace(/"/g, "'").trim();
}

function labelNeedsQuotes(label: string): boolean {
  const text = label.trim();
  if (!text || text.startsWith('"')) return false;
  if (/[:;&?/\\]/.test(text)) return true;
  if (/[()]/.test(text)) return true;
  if (/[а-яА-ЯёЁ]/.test(text)) return true;
  if (/\s/.test(text)) return true;
  return false;
}

function hashLabel(raw: string): string {
  let hash = 0;
  for (const ch of raw) {
    hash = (Math.imul(31, hash) + ch.charCodeAt(0)) >>> 0;
  }
  return hash.toString(16).slice(0, 8);
}

function normalizeSubgraphId(raw: string): string {
  const text = raw.trim();
  const asciiSlug = text.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (asciiSlug && /^[A-Za-z_][A-Za-z0-9_]*$/.test(asciiSlug) && !/[^\x00-\x7F]/.test(text)) {
    return asciiSlug.slice(0, 48);
  }
  const prefix = asciiSlug.slice(0, 12).replace(/_+$/, "") || "sg";
  const safePrefix = /^[A-Za-z_]/.test(prefix) ? prefix : "sg";
  return `${safePrefix}_${hashLabel(text)}`;
}

function fixNodeHopEdgeLabels(line: string): string {
  let fixed = line;
  for (let i = 0; i < 20; i += 1) {
    const updated = fixed.replace(NODE_HOP_EDGE_RE, " --> $1 -->");
    if (updated === fixed) break;
    fixed = updated;
  }
  return fixed.replace(TRAILING_NODE_HOP_RE, " --> $1");
}

function ensureFlowchartHeader(text: string): string {
  if (FLOWCHART_HEADER_RE.test(text)) {
    return text.replace(/^\s*graph\s+/im, "flowchart ");
  }
  return `flowchart TD\n${text}`;
}

function fixSubgraphDecl(_: string, prefix: string, id: string, suffix: string): string {
  const trimmed = id.trim();
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed) && !/[^\x00-\x7F]/.test(trimmed)) {
    return `${prefix}${trimmed}${suffix}`;
  }
  return `${prefix}${normalizeSubgraphId(trimmed)}${suffix}`;
}

function fixReservedNodeIds(text: string): string {
  const lines: string[] = [];
  for (const line of text.split("\n")) {
    if (line.trim() === "end") {
      lines.push(SUBGRAPH_END_PLACEHOLDER);
      continue;
    }
    let fixed = line.replace(/\bstart\s*\(\[/g, "start_node([");
    fixed = fixed.replace(/\bend\s*\(\[/g, "end_node([");
    lines.push(fixed);
  }
  return lines
    .join("\n")
    .replace(/\bstart\b/g, "start_node")
    .replace(/\bend\b/g, "end_node")
    .replaceAll(SUBGRAPH_END_PLACEHOLDER, "end");
}

function sanitizeLine(line: string, subgraphCounter: { value: number }): string {
  const stripped = line.trim();
  if (!stripped || stripped.startsWith("%%") || stripped === "end") return line;

  let fixed = fixNodeHopEdgeLabels(line);
  fixed = fixed.replace(/(?<![->])-{3,}(?!>)/g, "-->");
  fixed = fixed.replace(/(?<![->])--(?![->])/g, "-->");
  fixed = fixed.replace(/(\s*-->\s+)([^|>\-\n][^>\n]*?)(\s+-->)/g, (_, _arrow, label) => {
    const safe = escapeLabel(String(label));
    if (/^[A-Za-z_][\w]*$/.test(safe)) return `--> ${safe} -->`;
    return `-->|${safe}|-->`;
  });
  fixed = fixNodeHopEdgeLabels(fixed);

  const quoteRect = (match: string, nodeId: string, label: string) =>
    labelNeedsQuotes(label) ? `${nodeId}["${escapeLabel(label)}"]` : match;
  const quoteDoubleRect = (match: string, nodeId: string, label: string) =>
    labelNeedsQuotes(label) ? `${nodeId}[["${escapeLabel(label)}"]]` : match;
  const quoteDecision = (match: string, nodeId: string, label: string) =>
    labelNeedsQuotes(label) ? `${nodeId}{"${escapeLabel(label)}"}` : match;
  const quoteRound = (_match: string, nodeId: string, label: string) => {
    const escaped = escapeLabel(label);
    if (/["\]()]/u.test(escaped)) return `${nodeId}["${escaped}"]`;
    return `${nodeId}([${escaped}])`;
  };

  fixed = fixed.replace(NODE_BRACKET_RE, quoteRect);
  fixed = fixed.replace(NODE_DOUBLE_BRACKET_RE, quoteDoubleRect);
  fixed = fixed.replace(DECISION_NODE_RE, quoteDecision);
  fixed = fixed.replace(ROUND_NODE_RE, quoteRound);
  fixed = fixed.replace(
    SUBGRAPH_BRACKET_RE,
    (_, id, title) => `subgraph ${id}["${escapeLabel(String(title))}"]`
  );
  fixed = fixed.replace(SUBGRAPH_DECL_RE, fixSubgraphDecl);

  if (/^\s*subgraph\s+/.test(fixed) && !fixed.includes("[")) {
    subgraphCounter.value += 1;
    const title = fixed.replace(/^\s*subgraph\s+/, "").trim();
    fixed = `  subgraph sg_${subgraphCounter.value}["${escapeLabel(title)}"]`;
  }

  return fixed;
}

export function repairMermaidCode(code: string, options: { aggressive?: boolean } = {}): string {
  let text = (code || "").trim();
  if (!text) return text;

  text = text.replace(/```(?:mermaid)?\s*/gi, "").replace(/```/g, "").trim();
  text = ensureFlowchartHeader(text);

  const subgraphCounter = { value: 0 };
  let lines = text.split("\n").map((line) => sanitizeLine(line, subgraphCounter));

  if (options.aggressive) {
    lines = lines.filter((line) => {
      const stripped = line.trim();
      if (!stripped) return true;
      return !/^(style|classDef|linkStyle)\s/.test(stripped);
    });
  }

  return fixReservedNodeIds(lines.join("\n").replace(/\n{3,}/g, "\n\n").trim());
}

export function sanitizeMermaidCode(code: string): string {
  return repairMermaidCode(code);
}
