const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const { generateInvoicePdf } = require('../services/pdfService');

// Helper to generate next invoice number
async function getNextInvoiceNumber() {
  const currentYear = new Date().getFullYear();
  const prefix = `VC-${currentYear}-`;
  
  // Find highest invoice number with current year prefix
  const lastInvoice = await Invoice.findOne({
    invoiceNumber: new RegExp(`^${prefix}`)
  }).sort({ createdAt: -1 });

  if (!lastInvoice) {
    return `${prefix}0001`;
  }

  const matches = lastInvoice.invoiceNumber.match(new RegExp(`^${prefix}(\\d+)`));
  if (matches && matches[1]) {
    const nextNum = parseInt(matches[1], 10) + 1;
    return `${prefix}${String(nextNum).padStart(4, '0')}`;
  }

  const count = await Invoice.countDocuments();
  return `${prefix}${String(count + 1).padStart(4, '0')}`;
}

// GET /api/invoices/next-number
router.get('/next-number', async (req, res) => {
  try {
    const nextNumber = await getNextInvoiceNumber();
    res.json({ success: true, nextNumber });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/invoices - List with search, status filter, pagination
router.get('/', async (req, res) => {
  try {
    const { search, status, page = 1, limit = 50 } = req.query;
    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { invoiceNumber: searchRegex },
        { 'client.name': searchRegex },
        { 'client.company': searchRegex },
        { 'client.email': searchRegex },
        { title: searchRegex }
      ];
    }

    const total = await Invoice.countDocuments(query);
    const invoices = await Invoice.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({
      success: true,
      data: invoices,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/invoices/:id - Get single invoice by ID or invoiceNumber
router.get('/:id', async (req, res) => {
  try {
    let invoice = null;
    if (req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      invoice = await Invoice.findById(req.params.id);
    }
    if (!invoice) {
      invoice = await Invoice.findOne({ invoiceNumber: req.params.id });
    }

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    res.json({ success: true, data: invoice });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/invoices - Create new invoice
router.post('/', async (req, res) => {
  try {
    const invoiceData = { ...req.body };
    if (!invoiceData.invoiceNumber) {
      invoiceData.invoiceNumber = await getNextInvoiceNumber();
    }

    // Check for duplicate invoiceNumber
    const existing = await Invoice.findOne({ invoiceNumber: invoiceData.invoiceNumber });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Invoice with number "${invoiceData.invoiceNumber}" already exists.`
      });
    }

    const invoice = new Invoice(invoiceData);
    await invoice.save();

    res.status(201).json({ success: true, data: invoice });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// PUT /api/invoices/:id - Update existing invoice
router.put('/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    // If invoiceNumber changed, verify uniqueness
    if (req.body.invoiceNumber && req.body.invoiceNumber !== invoice.invoiceNumber) {
      const duplicate = await Invoice.findOne({ 
        invoiceNumber: req.body.invoiceNumber, 
        _id: { $ne: invoice._id } 
      });
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: `Invoice number "${req.body.invoiceNumber}" is already in use.`
        });
      }
    }

    Object.assign(invoice, req.body);
    await invoice.save();

    res.json({ success: true, data: invoice });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// PATCH /api/invoices/:id/status - Quick status update
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['draft', 'pending', 'paid', 'overdue', 'cancelled'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const invoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    res.json({ success: true, data: invoice });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// DELETE /api/invoices/:id - Delete invoice
router.delete('/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndDelete(req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    res.json({ success: true, message: 'Invoice deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/invoices/generate-pdf - Generate PDF from live JSON payload
router.post('/generate-pdf', async (req, res) => {
  try {
    const invoiceData = req.body;
    const pdfBuffer = await generateInvoicePdf(invoiceData);

    const cleanNum = (invoiceData.invoiceNumber || 'VC-INV').replace(/[^a-zA-Z0-9-_]/g, '_');
    const filename = `Invoice-${cleanNum}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.end(pdfBuffer);
  } catch (error) {
    console.error('PDF Generation Error:', error);
    res.status(500).json({ success: false, message: `Failed to generate PDF: ${error.message}` });
  }
});

// GET /api/invoices/:id/pdf - Generate & download PDF for existing saved invoice
router.get('/:id/pdf', async (req, res) => {
  try {
    let invoice = null;
    if (req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      invoice = await Invoice.findById(req.params.id);
    }
    if (!invoice) {
      invoice = await Invoice.findOne({ invoiceNumber: req.params.id });
    }

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const pdfBuffer = await generateInvoicePdf(invoice.toObject());
    const cleanNum = (invoice.invoiceNumber || 'VC-INV').replace(/[^a-zA-Z0-9-_]/g, '_');
    const filename = `Invoice-${cleanNum}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.end(pdfBuffer);
  } catch (error) {
    console.error('PDF Generation Error:', error);
    res.status(500).json({ success: false, message: `Failed to generate PDF: ${error.message}` });
  }
});

module.exports = router;
