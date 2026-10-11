import { chromium } from 'playwright-core'

const EXEC = '/usr/bin/chromium-browser'
const URL = process.env.URL || 'http://localhost:5174/'
const OUT = process.env.OUT || '/tmp/opencode'

const browser = await chromium.launch({
  executablePath: EXEC,
  args: ['--no-sandbox', '--disable-gpu'],
})

const width = Number(process.env.W || 390)
const page = await browser.newPage({ viewport: { width, height: 900 } })
const consoleErrors = []
const pageErrors = []
const failedRequests = []
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text())
})
page.on('pageerror', (err) => pageErrors.push(String(err)))
page.on('requestfailed', (req) => failedRequests.push(`${req.url()} :: ${req.failure()?.errorText}`))
page.on('response', (res) => {
  if (res.status() >= 400) failedRequests.push(`${res.status()} ${res.url()}`)
})

await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForSelector('.flagged-list-empty, .flagged-item', { timeout: 30000 }).catch(() => {})
await page.waitForTimeout(1500)

const report = await page.evaluate(() => {
  const vw = document.documentElement.clientWidth
  const wide = []
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect()
    if (r.width > vw + 1 && r.width > 0) {
      wide.push({
        tag: el.tagName,
        cls: String(el.className).slice(0, 80),
        id: el.id,
        w: Math.round(r.width),
        vw,
      })
    }
  }
  const text = document.body.innerText
  return {
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: vw,
    wide: wide.slice(0, 12),
    textHas: {
      'modified z (any case)': /modified\s*z/i.test(text),
      'All regions': /All regions \(5,443 flagged\)/.test(text),
    },
    bodyOverflowX: getComputedStyle(document.body).overflowX,
  }
})

console.log(JSON.stringify({ width, report, consoleErrors, pageErrors, failedRequests }, null, 2))
await page.screenshot({ path: `${OUT}/overflow-${width}.png` })
await browser.close()