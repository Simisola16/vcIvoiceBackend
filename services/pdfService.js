const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { generateInvoiceHtml } = require('./templateService');

let browserInstance = null;

const KNOWN_CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium'
];

async function getBrowser() {
  if (browserInstance && browserInstance.connected) {
    return browserInstance;
  }

  const defaultArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-first-run',
    '--no-zygote',
    '--font-render-hinting=medium'
  ];

  // Strategy 1: Standard puppeteer launch (downloaded chrome from cache)
  try {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: defaultArgs
    });
    return browserInstance;
  } catch (err1) {
    console.warn('Strategy 1 (default Puppeteer launch) failed:', err1.message);
  }

  // Strategy 2: System installed Chrome channel
  try {
    browserInstance = await puppeteer.launch({
      headless: true,
      channel: 'chrome',
      args: defaultArgs
    });
    return browserInstance;
  } catch (err2) {
    console.warn('Strategy 2 (system Chrome channel) failed:', err2.message);
  }

  // Strategy 3: System installed Edge channel
  try {
    browserInstance = await puppeteer.launch({
      headless: true,
      channel: 'msedge',
      args: defaultArgs
    });
    return browserInstance;
  } catch (err3) {
    console.warn('Strategy 3 (system Edge channel) failed:', err3.message);
  }

  // Strategy 4: Known browser executable paths
  for (const exePath of KNOWN_CHROME_PATHS) {
    if (exePath && fs.existsSync(exePath)) {
      try {
        browserInstance = await puppeteer.launch({
          headless: true,
          executablePath: exePath,
          args: defaultArgs
        });
        return browserInstance;
      } catch (err4) {
        console.warn(`Strategy 4 failed for path ${exePath}:`, err4.message);
      }
    }
  }

  throw new Error('Could not launch Chrome/Edge for PDF generation. Please install Chrome or wait for Puppeteer download to finish.');
}

/**
 * Generate PDF buffer from invoice data using Puppeteer
 * @param {Object} invoiceData 
 * @param {Object} options 
 * @returns {Promise<Buffer>}
 */
async function generateInvoicePdf(invoiceData, options = {}) {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    // Generate HTML from template (with embedded base64 logo)
    const htmlContent = generateInvoiceHtml(invoiceData, options);

    // Fast DOM load with short timeout
    await page.setContent(htmlContent, {
      waitUntil: 'domcontentloaded',
      timeout: 10000
    });

    await page.emulateMediaType('screen');

    // Generate A4 PDF buffer
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '0px',
        right: '0px',
        bottom: '0px',
        left: '0px'
      }
    });

    return pdfBuffer;
  } catch (err) {
    console.error('generateInvoicePdf internal error:', err);
    throw err;
  } finally {
    try {
      await page.close();
    } catch (closeErr) {
      // ignore
    }
  }
}

// Cleanup on process termination
process.on('SIGINT', async () => {
  if (browserInstance) {
    await browserInstance.close().catch(() => {});
  }
  process.exit(0);
});

module.exports = {
  generateInvoicePdf,
  generateInvoiceHtml
};
