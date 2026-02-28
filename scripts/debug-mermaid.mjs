const res = await fetch("http://localhost:3006/api/bottleneck/flow?projectId=bnp-1772284137101-acf36988");
const d = await res.json();
const code = d.flow?.mermaidCode || "";
const lines = code.split("\n");
lines.forEach((l, i) => {
  // Look for problematic patterns: parentheses in edge labels or node text
  if (l.includes("(") && !l.trim().startsWith("style") && !l.trim().startsWith("%%")) {
    console.log(`${i + 1}: ${l}`);
  }
});
