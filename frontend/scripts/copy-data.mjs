// Copies the generated pipeline outputs the browser is allowed to read into
// the Vite `public/` directory, and refuses to touch the 130 MB projects.json.
//
// The pipeline runs in Python and writes to `data/processed/`. Vite only
// serves files under `frontend/public/`, so this one-way copy bridges the two.
// Generated copies are git-ignored; the pipeline remains the source of truth.
//
// Run automatically before `npm run dev` and `npm run build` (see package.json
// `predev`/`prebuild`).

import { copyFile, mkdir, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..', '..')
const sourceDir = resolve(repoRoot, 'data', 'processed')
const targetDir = resolve(here, '..', 'public', 'data')

// Only these files may cross into the browser. projects.json is deliberately
// excluded: it is ~134 MB and must never be requested by the frontend.
const FILES = ['region_summary.json', 'cost_anomalies.json']

async function main() {
  await mkdir(targetDir, { recursive: true })

  for (const name of FILES) {
    const from = resolve(sourceDir, name)
    const to = resolve(targetDir, name)
    try {
      await stat(from)
    } catch {
      console.error(
        `Missing ${from}. Run the pipeline first:\n` +
          `  .venv/bin/python -m pipeline.export_json`,
      )
      process.exit(1)
    }
    await copyFile(from, to)
    console.log(`copied ${name} -> public/data/${name}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
