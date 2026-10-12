// Copies the generated pipeline outputs the browser is allowed to read into
// the Vite `public/` directory, and refuses to touch the 130 MB projects.json.
//
// The pipeline runs in Python and writes to `data/processed/`. Vite only
// serves files under `frontend/public/`, so this one-way copy bridges the two.
// The resulting public/data/ files are committed so Vercel can deploy from Git
// without running the Python pipeline (which needs the git-ignored raw data).
//
// Run automatically before `npm run dev` and `npm run build` (see package.json
// `predev`/`prebuild`). When the pipeline output is absent but a committed copy
// already exists, the copy is skipped instead of failing the build.

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

async function exists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function main() {
  await mkdir(targetDir, { recursive: true })

  for (const name of FILES) {
    const from = resolve(sourceDir, name)
    const to = resolve(targetDir, name)

    if (!(await exists(from))) {
      // On CI/Vercel the pipeline output is absent, but the committed copy in
      // public/data/ is what actually gets deployed. Only fail when neither is
      // available (e.g. a fresh clone that never ran the pipeline).
      if (await exists(to)) {
        console.warn(
          `No pipeline output for ${name}; using the committed copy at ` +
            `public/data/${name}.`,
        )
        continue
      }
      console.error(
        `Missing ${from} and no committed copy at ${to}. Run the pipeline ` +
          `first:\n  .venv/bin/python -m pipeline.export_json`,
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
