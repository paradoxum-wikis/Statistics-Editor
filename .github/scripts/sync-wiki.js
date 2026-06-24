import { Glob, sleep } from "bun";
import { fetchTowerWiki } from "../../src/lib/services/fetchTowerWiki";

const towersDir = `${import.meta.dir}/../../src/lib/towerComponents/towers`;
const files = Array.from(
  new Glob("*.wiki").scanSync({ cwd: towersDir, onlyFiles: true }),
).sort();

let updated = 0;
let unchanged = 0;
let failed = 0;

for (let i = 0; i < files.length; i++) {
  const file = files[i];
  const towerName = file.slice(0, -5);
  const path = `${towersDir}/${file}`;
  const existing = (await Bun.file(path).text()).trimEnd();
  const fetched = await fetchTowerWiki(towerName, true);

  if (!fetched) {
    console.warn(`skip: ${towerName} (fetch failed)`);
    failed++;
  } else if (existing === fetched.trimEnd()) {
    unchanged++;
  } else {
    await Bun.write(path, `${fetched.trimEnd()}\n`);
    console.log(`updated: ${towerName}`);
    updated++;
  }

  if (i < files.length - 1) await sleep(1000);
}

console.log(
  `sync complete: ${updated} updated, ${unchanged} unchanged, ${failed} failed`,
);

process.exit(failed === files.length ? 1 : 0);
