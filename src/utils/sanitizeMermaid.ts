/** Исправление типичных синтаксических ошибок LLM в Mermaid flowchart. */
const NODE_BRACKET_RE = new RegExp(String.raw`(\b[A-Za-z_][\w]*)\s*\[(?!["/])([^\]\n]+)\]`, "g");
const SUBGRAPH_BRACKET_RE = new RegExp(String.raw`^\s*subgraph\s+([A-Za-z_][\w]*)\s*\[(?!")([^\]\n]+)\]`, "gm");

export function sanitizeMermaidCode(code: string): string {
  const text = (code || "").trim();
  if (!text) return text;

  let subgraphCounter = 0;
  const lines = text.split("\n").map((line) => {
    const stripped = line.trim();
    if (!stripped || stripped.startsWith("%%")) return line;

    let fixed = line.replace(/(?<![->])-{3,}(?!>)/g, "-->");
    fixed = fixed.replace(/(\s*-->\s+)([^|>\-\n][^>\n]*?)(\s+-->)/g, (_, _arrow, label, _end) => {
      const safe = String(label).replace(/"/g, "'").trim();
      return `-->|${safe}|-->`;
    });

    fixed = fixed.replace(NODE_BRACKET_RE, (match, nodeId, label) => {
      const trimmed = String(label).trim();
      if (trimmed.includes('"')) return match;
      if (/[()/:&]/.test(trimmed)) {
        return `${nodeId}["${trimmed.replace(/"/g, "'")}"]`;
      }
      return match;
    });

    fixed = fixed.replace(
      SUBGRAPH_BRACKET_RE,
      (_, id, title) => `subgraph ${id}["${String(title).replace(/"/g, "'").trim()}"]`
    );

    if (/^\s*subgraph\s+/.test(fixed) && !fixed.includes("[")) {
      subgraphCounter += 1;
      const title = fixed.replace(/^\s*subgraph\s+/, "").trim();
      fixed = `  subgraph sg_${subgraphCounter}["${title.replace(/"/g, "'")}"]`;
    }

    return fixed;
  });

  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}
