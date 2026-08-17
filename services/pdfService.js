const puppeteer = require('puppeteer');
const { generateInvoiceHtml } = require('./templateService');

let browserInstance = null;

async function getBrowser() {
  if (browserInstance && browserInstance.connected) {
    return browserInstance;
  }

  try {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--font-render-hinting=medium'
      ]
    });
    return browserInstance;
  } catch (err) {
    console.error('Puppeteer launch fallback error:', err.message);
    browserInstance = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    return browserInstance;
  }
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
