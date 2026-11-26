// Run against the production demo build with Playwright Core and Chrome.
const { chromium } = require('playwright-core')
const { mkdir } = require('node:fs/promises')

async function capture() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' })
    await page.getByRole('heading', { name: 'Signal at Dawn' }).waitFor()
    await mkdir('dist/screenshots', { recursive: true })
    await page.screenshot({ path: 'dist/screenshots/discovery.png', animations: 'disabled' })
    await page.getByRole('button', { name: /Explore film/i }).click()
    await page.getByRole('heading', { name: 'Watch next' }).waitFor()
    await page.screenshot({ path: 'dist/screenshots/film-details.png', animations: 'disabled' })
    await page.getByLabel('Search movies').fill('Lantern')
    await page.getByLabel('Search movies').press('Enter')
    await page.getByRole('button', { name: 'Open Paper Lanterns', exact: true }).waitFor()
    await page.getByRole('navigation').getByRole('button', { name: 'Genres' }).click()
    await page.getByRole('heading', { name: 'Genres', exact: true }).waitFor()
  } finally {
    await browser.close()
  }
}
capture().catch((error) => { console.error(error); process.exitCode = 1 })
