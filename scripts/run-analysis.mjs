// Run analysis for all draft projects
const BASE = "http://localhost:3006";

const projectIds = [
  { id: "bnp-1772284136797-d95c144c", name: "船員配乗・交代管理フロー" },
  { id: "bnp-1772284137101-acf36988", name: "新造船検査・引渡しフロー" },
  { id: "bnp-1772284137146-1c3360c0", name: "操船シミュレータ訓練運営フロー" },
  { id: "bnp-1772284137186-6890bcba", name: "船舶メンテナンス・入渠管理フロー" },
  { id: "bnp-1772284137227-be6ea61d", name: "海事コンサルティング案件管理フロー" },
  { id: "bnp-1772284137274-cb016969", name: "安全管理・事故対応フロー" },
  { id: "bnp-1772284137317-3b5d707d", name: "購買・調達管理フロー" },
];

async function runOne(proj) {
  console.log(`\nStarting: ${proj.name}`);
  const res = await fetch(`${BASE}/api/bottleneck/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId: proj.id }),
  });
  const data = await res.json();
  if (data.error) {
    console.log(`  Error: ${data.error}`);
    return false;
  }

  // Poll until done
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const sRes = await fetch(`${BASE}/api/bottleneck/analyze?projectId=${proj.id}`);
    const sData = await sRes.json();

    if (sData.status === "completed") {
      console.log(`  DONE: ${proj.name} (${sData.progress}%)`);
      return true;
    }
    if (sData.status === "failed") {
      console.log(`  FAILED: ${proj.name} - ${sData.error}`);
      return false;
    }
    if (i % 4 === 0) {
      console.log(`  ...${sData.status} (${sData.progress}%)`);
    }
  }
  return false;
}

async function main() {
  for (const proj of projectIds) {
    const ok = await runOne(proj);
    if (!ok) {
      console.log(`  Retrying ${proj.name}...`);
      await runOne(proj);
    }
  }
  console.log("\n=== ALL DONE ===");
}

main().catch(console.error);
