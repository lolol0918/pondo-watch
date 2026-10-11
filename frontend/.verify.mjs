import { chromium } from 'playwright-core'

const EXEC = '/usr/bin/chromium-browser'
const URL = process.env.URL || 'http://localhost:5174/'
const OUT = process.env.OUT || '/tmp/opencode'

const browser = await chromium.launch({
  executablePath: EXEC,
  args: ['--no-sandbox', '--disable-gpu'],
})

for (const width of [1440, 1024, 390]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } })
  const consoleErrors = []
  const pageErrors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => pageErrors.push(String(err)))

  await page.goto(URL, { waitUntil: 'networkidle' })
  // wait for the flagged list data to arrive
  await page.waitForSelector('.flagged-item, .flagged-list-empty', { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(1200)

  const metrics = await page.evaluate(() => {
    const doc = document.documentElement
    const body = document.body
    return {
      scrollWidth: Math.max(doc.scrollWidth, body.scrollWidth),
      clientWidth: doc.clientWidth,
      overflowX: getComputedStyle(body).overflowX,
      mapHeight: document.querySelector('.region-map')?.getBoundingClientRect().height ?? null,
    }
  })

  const text = await page.evaluate(() => document.body.innerText)
  const checks = {
    'All regions (5,443 flagged)': text.includes('All regions (5,443 flagged)'),
    'modified z label': text.includes('modified z'),
    '1-decimal ratio (381.5×)': text.includes('381.5×'),
    'eligible share (2.4%)': text.includes('2.4%'),
    'eligible caption': text.includes('229,628'),
  }

  await page.screenshot({ path: `${OUT}/w${width}.png`, fullPage: false })
  console.log(JSON.stringify({ width, metrics, checks, consoleErrors, pageErrors }, null, 2))
  await page.close()
}

await browser.close()