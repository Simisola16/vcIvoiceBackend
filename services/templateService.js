const fs = require('fs');
const path = require('path');

/**
 * Village Coders Invoice HTML Template Generator for Puppeteer
 */

// Load logo as base64 once
let logoBase64 = '';
try {
  const logoPath = path.join(__dirname, '..', 'assets', 'logo.png');
  if (fs.existsSync(logoPath)) {
    const fileBuffer = fs.readFileSync(logoPath);
    logoBase64 = `data:image/png;base64,${fileBuffer.toString('base64')}`;
  }
} catch (err) {
  console.warn('Could not load logo as base64:', err.message);
}

function formatCurrency(amount, currencySymbol = '₦') {
  const val = Number(amount) || 0;
  return `${currencySymbol}${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function generateInvoiceHtml(invoice, options = {}) {
  const {
    invoiceNumber = 'VC-INV-0001',
    title = 'INVOICE',
    status = 'pending',
    issueDate = new Date().toISOString().split('T')[0],
    dueDate = '',
    poNumber = '',
    client = {},
    sender = {},
    currency = { code: 'NGN', symbol: '₦', name: 'Nigerian Naira (NGN)' },
    items = [],
    pricing = {},
    paymentDetails = {},
    signature = {},
  } = invoice;

  const symbol = currency?.symbol || '₦';
  const subtotal = pricing?.subtotal || 0;
  const discountAmount = pricing?.discountAmount || 0;
  const taxRate = pricing?.taxRate || 0;
  const taxAmount = pricing?.taxAmount || 0;
  const shipping = pricing?.shipping || 0;
  const deposit = pricing?.deposit || 0;
  const total = pricing?.total || 0;
  const balanceDue = pricing?.balanceDue || total;

  const statusColors = {
    paid: { bg: '#E6F4EA', text: '#137333', border: '#CEEAD6', label: 'PAID' },
    pending: { bg: '#FEF7E0', text: '#B06000', border: '#FEEFC3', label: 'PENDING' },
    overdue: { bg: '#FCE8E6', text: '#C5221F', border: '#FAD2CF', label: 'OVERDUE' },
    draft: { bg: '#F1F3F4', text: '#5F6368', border: '#DADCE0', label: 'DRAFT' },
    cancelled: { bg: '#F1F3F4', text: '#80868B', border: '#E8EAED', label: 'CANCELLED' }
  };
  const currentStatus = statusColors[status.toLowerCase()] || statusColors.pending;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice - ${invoiceNumber}</title>
  <style>
    @page {
      size: A4;
      margin: 0;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #ffffff;
      color: #1e293b;
      font-size: 12px;
      line-height: 1.45;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page-container {
      position: relative;
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      background: #ffffff;
      padding: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    /* Watermark */
    .watermark-bg {
      position: absolute;
      top: 52%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 490px;
      opacity: 0.055;
      pointer-events: none;
      z-index: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .watermark-bg img {
      width: 400px;
      height: auto;
      object-fit: contain;
    }

    /* Letterhead Header */
    .header-wrapper {
      position: relative;
      z-index: 10;
      padding: 24px 40px 14px 40px;
    }
    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .brand-section {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .brand-logo-img {
      height: 90px;
      max-width: 300px;
      object-fit: contain;
    }
    .header-divider-vertical {
      width: 2px;
      height: 65px;
      background-color: #8c725c;
      margin: 0 10px;
      border-radius: 2px;
    }
    .contact-section {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 10.5px;
      color: #2d3748;
      font-weight: 500;
    }
    .contact-item {
      display: flex;
      align-items: center;
      gap: 7px;
    }
    .contact-icon {
      font-size: 11px;
      color: #0f172a;
    }
    .header-teal-bar {
      margin-top: 14px;
      height: 3.5px;
      background: linear-gradient(90deg, #1097a8 0%, #15b0c4 60%, #44cadc 100%);
      border-radius: 2px;
      width: 100%;
    }

    /* Content Area */
    .invoice-body {
      position: relative;
      z-index: 10;
      padding: 6px 40px 20px 40px;
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    /* Invoice Meta Top Bar */
    .meta-banner {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 18px;
      padding-bottom: 12px;
      border-bottom: 1px solid #f1f5f9;
    }
    .meta-title-col {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .doc-title {
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: 0.5px;
      line-height: 1;
    }
    .doc-number {
      font-size: 13px;
      font-weight: 700;
      color: #028090;
      letter-spacing: 0.5px;
    }
    .meta-status-col {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 5px;
    }
    .status-badge {
      display: inline-block;
      padding: 3px 12px;
      border-radius: 20px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      background-color: ${currentStatus.bg};
      color: ${currentStatus.text};
      border: 1px solid ${currentStatus.border};
    }
    .doc-po {
      font-size: 10.5px;
      color: #64748b;
      font-weight: 500;
    }

    /* Address & Details Grid */
    .parties-grid {
      display: grid;
      grid-template-columns: 1.2fr 1fr;
      gap: 20px;
      margin-bottom: 18px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 18px;
    }
    .party-col-title {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #028090;
      margin-bottom: 6px;
    }
    .client-name {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 2px;
    }
    .client-company {
      font-size: 11.5px;
      font-weight: 600;
      color: #334155;
      margin-bottom: 3px;
    }
    .party-info-line {
      font-size: 11px;
      color: #475569;
      line-height: 1.4;
    }
    .details-list {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .details-row {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
    }
    .details-label {
      color: #64748b;
      font-weight: 500;
    }
    .details-val {
      font-weight: 700;
      color: #1e293b;
    }

    /* Items Table */
    .table-container {
      margin-bottom: 16px;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
    }
    .items-table th {
      background: #0f172a;
      color: #ffffff;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      padding: 8px 12px;
      text-align: left;
    }
    .items-table th.col-num { width: 30px; text-align: center; }
    .items-table th.col-qty { width: 55px; text-align: center; }
    .items-table th.col-rate { width: 110px; text-align: right; }
    .items-table th.col-amount { width: 120px; text-align: right; }
    
    .items-table th:first-child {
      border-top-left-radius: 6px;
    }
    .items-table th:last-child {
      border-top-right-radius: 6px;
    }

    .items-table td {
      padding: 9px 12px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 11.5px;
      vertical-align: top;
    }
    .items-table tr:nth-child(even) td {
      background-color: #fafbfc;
    }
    .item-desc-title {
      font-weight: 600;
      color: #0f172a;
    }
    .item-desc-details {
      font-size: 10px;
      color: #64748b;
      margin-top: 2px;
      line-height: 1.3;
      white-space: pre-line;
    }
    .col-num-val { text-align: center; color: #64748b; font-weight: 500; font-size: 10.5px; }
    .col-qty-val { text-align: center; font-weight: 600; color: #334155; }
    .col-rate-val { text-align: right; font-weight: 500; color: #334155; }
    .col-amount-val { text-align: right; font-weight: 700; color: #0f172a; }

    /* Summary & Bank Details Section */
    .bottom-split {
      display: grid;
      grid-template-columns: 1.15fr 1fr;
      gap: 20px;
      align-items: start;
    }

    /* Left Box: Payment Details */
    .bank-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 14px;
    }
    .bank-card-title {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      color: #028090;
      margin-bottom: 8px;
    }
    .bank-info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
      font-size: 10.5px;
    }
    .bank-label {
      color: #64748b;
      font-weight: 500;
    }
    .bank-val {
      color: #0f172a;
      font-weight: 600;
    }
    .terms-box {
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px dashed #cbd5e1;
    }
    .terms-label {
      font-size: 9.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #64748b;
      margin-bottom: 2px;
    }
    .terms-text {
      font-size: 10px;
      color: #475569;
      line-height: 1.3;
    }

    /* Right Box: Totals */
    .totals-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 7px 14px;
      font-size: 11px;
      border-bottom: 1px solid #f1f5f9;
    }
    .totals-row.discount {
      color: #16a34a;
    }
    .totals-label {
      color: #64748b;
      font-weight: 500;
    }
    .totals-val {
      font-weight: 600;
      color: #1e293b;
    }
    .totals-row.grand-total {
      background: #f8fafc;
      font-size: 12.5px;
      font-weight: 700;
      border-top: 1px solid #cbd5e1;
      border-bottom: 1px solid #cbd5e1;
      padding: 8px 14px;
      color: #0f172a;
    }
    .balance-due-row {
      background: #0f172a;
      color: #ffffff;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 14px;
    }
    .balance-due-label {
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      color: #38bdf8;
    }
    .balance-due-val {
      font-size: 16px;
      font-weight: 800;
      color: #ffffff;
    }

    /* Signature & Closing */
    .bottom-closing {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: auto;
      padding-top: 14px;
      border-top: 1px solid #f1f5f9;
    }
    .note-to-client {
      max-width: 320px;
    }
    .note-title {
      font-size: 9.5px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 3px;
    }
    .note-text {
      font-size: 10.5px;
      color: #475569;
      font-style: italic;
      line-height: 1.35;
    }
    .signature-container {
      text-align: center;
      min-width: 160px;
    }
    .signature-display {
      height: 38px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 3px;
    }
    .signature-typed {
      font-size: 20px;
      color: #0f172a;
      font-style: italic;
      font-weight: 600;
      font-family: Georgia, 'Times New Roman', serif;
    }
    .signature-drawn img {
      max-height: 36px;
      max-width: 140px;
    }
    .signature-line {
      width: 100%;
      height: 1px;
      background: #94a3b8;
      margin-bottom: 4px;
    }
    .signature-name {
      font-size: 10.5px;
      font-weight: 700;
      color: #1e293b;
    }
    .signature-title {
      font-size: 9px;
      color: #64748b;
    }

    /* Footer Strip */
    .footer-strip {
      position: relative;
      z-index: 10;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      padding: 8px 40px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 9px;
      color: #64748b;
    }
    .footer-highlight {
      color: #028090;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="page-container">
    
    <!-- Watermark Background -->
    <div class="watermark-bg">
      ${logoBase64 ? `<img src="${logoBase64}" alt="Watermark" />` : ''}
    </div>

    <!-- Letterhead Header -->
    <div class="header-wrapper">
      <div class="header-content">
        
        <!-- Left: Brand Logo -->
        <div class="brand-section">
          ${logoBase64 ? (
            `<img src="${logoBase64}" alt="Village Coders Logo" class="brand-logo-img" />`
          ) : (
            `<div style="font-size: 18px; font-weight: 800; color: #2b3a4a;">VILLAGE CODERS</div>`
          )}
        </div>

        <!-- Center Divider -->
        <div class="header-divider-vertical"></div>

        <!-- Right: Contact Information -->
        <div class="contact-section">
          <div class="contact-item">
            <span class="contact-icon">📍</span>
            <span>${sender.address || 'Fully Remote | Operating Worldwide'}</span>
          </div>
          <div class="contact-item">
            <span class="contact-icon">📞</span>
            <span>${sender.phone || '+234 808 5742 261'}</span>
          </div>
          <div class="contact-item">
            <span class="contact-icon">✉️</span>
            <span>${sender.email || 'villagecoders7@gmail.com'}</span>
          </div>
          <div class="contact-item">
            <span class="contact-icon">🌐</span>
            <span>${sender.website || 'villagecoders.io'}</span>
          </div>
        </div>

      </div>

      <!-- Teal Line Bar -->
      <div class="header-teal-bar"></div>
    </div>

    <!-- Invoice Main Body -->
    <div class="invoice-body">
      
      <!-- Top Title & Badge Banner -->
      <div class="meta-banner">
        <div class="meta-title-col">
          <h1 class="doc-title">${title}</h1>
          <span class="doc-number"># ${invoiceNumber}</span>
        </div>
        <div class="meta-status-col">
          <span class="status-badge">${currentStatus.label}</span>
          ${poNumber ? `<span class="doc-po">PO Number: <strong>${poNumber}</strong></span>` : ''}
        </div>
      </div>

      <!-- Parties Grid (Billed To vs Invoice Details) -->
      <div class="parties-grid">
        <div>
          <div class="party-col-title">Billed To:</div>
          <div class="client-name">${client.name || 'Valued Client'}</div>
          ${client.company ? `<div class="client-company">${client.company}</div>` : ''}
          ${client.address ? `<div class="party-info-line">${client.address}${client.city ? `, ${client.city}` : ''}${client.country ? `, ${client.country}` : ''}</div>` : ''}
          ${client.email ? `<div class="party-info-line">Email: ${client.email}</div>` : ''}
          ${client.phone ? `<div class="party-info-line">Phone: ${client.phone}</div>` : ''}
          ${client.taxId ? `<div class="party-info-line">Tax/VAT ID: ${client.taxId}</div>` : ''}
        </div>

        <div class="details-list">
          <div class="party-col-title">Invoice Details:</div>
          <div class="details-row">
            <span class="details-label">Invoice Date:</span>
            <span class="details-val">${formatDate(issueDate)}</span>
          </div>
          <div class="details-row">
            <span class="details-label">Payment Due Date:</span>
            <span class="details-val">${formatDate(dueDate) || 'Upon Receipt'}</span>
          </div>
          <div class="details-row">
            <span class="details-label">Currency:</span>
            <span class="details-val">${currency.code} (${currency.symbol})</span>
          </div>
        </div>
      </div>

      <!-- Line Items Table -->
      <div class="table-container">
        <table class="items-table">
          <thead>
            <tr>
              <th class="col-num">#</th>
              <th>Item & Description</th>
              <th class="col-qty">Qty</th>
              <th class="col-rate">Unit Price</th>
              <th class="col-amount">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${items && items.length > 0 ? items.map((item, idx) => `
              <tr>
                <td class="col-num-val">${idx + 1}</td>
                <td>
                  <div class="item-desc-title">${item.description || 'Service'}</div>
                  ${item.details ? `<div class="item-desc-details">${item.details}</div>` : ''}
                </td>
                <td class="col-qty-val">${item.quantity || 1}</td>
                <td class="col-rate-val">${formatCurrency(item.rate, symbol)}</td>
                <td class="col-amount-val">${formatCurrency(item.amount || ((item.quantity || 1) * (item.rate || 0)), symbol)}</td>
              </tr>
            `).join('') : `
              <tr>
                <td colspan="5" style="text-align: center; color: #94a3b8; padding: 20px;">No items added to this invoice.</td>
              </tr>
            `}
          </tbody>
        </table>
      </div>

      <!-- Bottom Split: Payment Info & Totals -->
      <div class="bottom-split">
        
        <!-- Left: Payment Instructions & Notes -->
        <div class="bank-card">
          <div class="bank-card-title">Payment Instructions</div>
          ${paymentDetails.bankName ? `
            <div class="bank-info-row">
              <span class="bank-label">Bank Name:</span>
              <span class="bank-val">${paymentDetails.bankName}</span>
            </div>
          ` : ''}
          ${paymentDetails.accountName ? `
            <div class="bank-info-row">
              <span class="bank-label">Account Name:</span>
              <span class="bank-val">${paymentDetails.accountName}</span>
            </div>
          ` : ''}
          ${paymentDetails.accountNumber ? `
            <div class="bank-info-row">
              <span class="bank-label">Account Number:</span>
              <span class="bank-val">${paymentDetails.accountNumber}</span>
            </div>
          ` : ''}
          ${paymentDetails.swift ? `
            <div class="bank-info-row">
              <span class="bank-label">SWIFT / BIC:</span>
              <span class="bank-val">${paymentDetails.swift}</span>
            </div>
          ` : ''}
          ${paymentDetails.paypalEmail ? `
            <div class="bank-info-row">
              <span class="bank-label">PayPal:</span>
              <span class="bank-val">${paymentDetails.paypalEmail}</span>
            </div>
          ` : ''}
          ${paymentDetails.cryptoAddress ? `
            <div class="bank-info-row">
              <span class="bank-label">Crypto (USDT/ETH):</span>
              <span class="bank-val" style="font-size: 9px;">${paymentDetails.cryptoAddress}</span>
            </div>
          ` : ''}

          ${paymentDetails.paymentTerms ? `
            <div class="terms-box">
              <div class="terms-label">Payment Terms</div>
              <div class="terms-text">${paymentDetails.paymentTerms}</div>
            </div>
          ` : ''}
        </div>

        <!-- Right: Pricing Calculations -->
        <div class="totals-card">
          <div class="totals-row">
            <span class="totals-label">Subtotal</span>
            <span class="totals-val">${formatCurrency(subtotal, symbol)}</span>
          </div>

          ${discountAmount > 0 ? `
            <div class="totals-row discount">
              <span class="totals-label">Discount ${pricing.discountType === 'percent' ? `(${pricing.discountValue}%)` : ''}</span>
              <span class="totals-val">-${formatCurrency(discountAmount, symbol)}</span>
            </div>
          ` : ''}

          ${taxAmount > 0 ? `
            <div class="totals-row">
              <span class="totals-label">Tax / VAT (${taxRate}%)</span>
              <span class="totals-val">+${formatCurrency(taxAmount, symbol)}</span>
            </div>
          ` : ''}

          ${shipping > 0 ? `
            <div class="totals-row">
              <span class="totals-label">Extra / Fee</span>
              <span class="totals-val">+${formatCurrency(shipping, symbol)}</span>
            </div>
          ` : ''}

          <div class="totals-row grand-total">
            <span class="totals-label">Total</span>
            <span class="totals-val">${formatCurrency(total, symbol)}</span>
          </div>

          ${deposit > 0 ? `
            <div class="totals-row" style="color: #028090;">
              <span class="totals-label">Paid / Deposit</span>
              <span class="totals-val">-${formatCurrency(deposit, symbol)}</span>
            </div>
          ` : ''}

          <div class="balance-due-row">
            <span class="balance-due-label">Balance Due</span>
            <span class="balance-due-val">${formatCurrency(balanceDue, symbol)}</span>
          </div>
        </div>

      </div>

      <!-- Closing & Signature -->
      <div class="bottom-closing">
        <div class="note-to-client">
          ${paymentDetails.notes ? `
            <div class="note-title">Notes / Remarks:</div>
            <div class="note-text">${paymentDetails.notes}</div>
          ` : ''}
        </div>

        <div class="signature-container">
          <div class="signature-display">
            ${signature.type === 'drawn' && signature.value ? `
              <div class="signature-drawn"><img src="${signature.value}" alt="Signature" /></div>
            ` : signature.type === 'typed' && signature.value ? `
              <div class="signature-typed">${signature.value}</div>
            ` : `
              <div class="signature-typed">Village Coders</div>
            `}
          </div>
          <div class="signature-line"></div>
          <div class="signature-name">${signature.signerName || 'Authorized Signatory'}</div>
          <div class="signature-title">${signature.date ? `Signed: ${formatDate(signature.date)}` : 'Village Coders Ltd'}</div>
        </div>
      </div>

    </div>

    <!-- Footer Strip -->
    <div class="footer-strip">
      <div>Village Coders &bull; Web & Software Developers</div>
      <div>Questions? <span class="footer-highlight">villagecoders7@gmail.com</span></div>
      <div>Page 1 of 1</div>
    </div>

  </div>
</body>
</html>`;
}

module.exports = {
  generateInvoiceHtml,
  formatCurrency,
  formatDate
};
