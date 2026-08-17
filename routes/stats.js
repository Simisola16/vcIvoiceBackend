const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');

// GET /api/stats - Aggregated metrics
router.get('/', async (req, res) => {
  try {
    const invoices = await Invoice.find();

    let totalInvoiced = 0;
    let totalPaid = 0;
    let totalPending = 0;
    let totalOverdue = 0;

    const counts = {
      all: invoices.length,
      paid: 0,
      pending: 0,
      overdue: 0,
      draft: 0,
      cancelled: 0
    };

    const today = new Date().toISOString().split('T')[0];

    invoices.forEach(inv => {
      const total = inv.pricing?.total || 0;
      const deposit = inv.pricing?.deposit || 0;
      const balance = inv.pricing?.balanceDue || (total - deposit);

      // Status check
      let status = inv.status;
      if (status === 'pending' && inv.dueDate && inv.dueDate < today) {
        status = 'overdue';
      }

      counts[status] = (counts[status] || 0) + 1;
      totalInvoiced += total;

      if (status === 'paid') {
        totalPaid += total;
      } else if (status === 'overdue') {
        totalPaid += deposit;
        totalOverdue += balance;
      } else if (status === 'pending') {
        totalPaid += deposit;
        totalPending += balance;
      }
    });

    const recentInvoices = await Invoice.find()
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      success: true,
      data: {
        totalInvoiced,
        totalPaid,
        totalPending,
        totalOverdue,
        counts,
        recentInvoices
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
