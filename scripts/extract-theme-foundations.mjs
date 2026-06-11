import fs from "node:fs";

const css = fs.readFileSync("src/styles/tokens.css", "utf8");

function extractBlock(selector) {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`not found ${selector}`);
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, i).trim();
    }
  }
  throw new Error(`unclosed block ${selector}`);
}

const darkBody = extractBlock('[data-theme="dark"]');
const lightBody = extractBlock('[data-theme="light"]');
const darkThemes = ["cyberpunk", "matrix", "ocean", "amethyst", "sunset"];
const lightThemes = ["glassmorphism", "retro", "sketch", "sakura", "nord"];

const out = `/* Foundation for custom themes only — light/dark defaults stay in tokens.css */

${darkThemes.map((t) => `[data-theme="${t}"]`).join(",\n")} {
${darkBody}
}

${lightThemes.map((t) => `[data-theme="${t}"]`).join(",\n")} {
${lightBody}
}
`;

fs.writeFileSync("src/styles/themes/_foundations.css", out);
console.log("OK", out.length);
