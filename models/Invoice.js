const mongoose = require('mongoose');

const LineItemSchema = new mongoose.Schema({
  id: { type: String, default: () => Math.random().toString(36).substring(2, 9) },
  description: { type: String, required: true, default: 'Service / Item Description' },
  details: { type: String, default: '' },
  quantity: { type: Number, required: true, default: 1, min: 0 },
  rate: { type: Number, required: true, default: 0, min: 0 },
  amount: { type: Number, required: true, default: 0 }
}, { _id: false });

const InvoiceSchema = new mongoose.Schema({
  invoiceNumber: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    index: true 
  },
  title: { 
    type: String, 
    default: 'INVOICE' 
  },
  status: { 
    type: String, 
    enum: ['draft', 'pending', 'paid', 'overdue', 'cancelled'], 
    default: 'pending',
    index: true
  },
  issueDate: { 
    type: String, 
    required: true,
    default: () => new Date().toISOString().split('T')[0]
  },
  dueDate: { 
    type: String, 
    required: true,
    default: () => {
      const d = new Date();
      d.setDate(d.getDate() + 14);
      return d.toISOString().split('T')[0];
    }
  },
  poNumber: { type: String, default: '' },
  
  // Client details ("Bill To")
  client: {
    name: { type: String, required: true, default: 'Client Name' },
    company: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    address: { type: String, default: '' },
    city: { type: String, default: '' },
    country: { type: String, default: '' },
    taxId: { type: String, default: '' }
  },

  // Company / Sender details (Default: Village Coders)
  sender: {
    company: { type: String, default: 'VILLAGE CODERS' },
    tagline: { type: String, default: 'WEB & SOFTWARE DEVELOPERS' },
    email: { type: String, default: 'villagecoders7@gmail.com' },
    website: { type: String, default: 'villagecoders.io' },
    phone: { type: String, default: '+234 808 5742 261' },
    address: { type: String, default: 'Fully Remote | Operating Worldwide' }
  },

  // Currency
  currency: {
    code: { type: String, default: 'NGN' },
    symbol: { type: String, default: '₦' },
    name: { type: String, default: 'Nigerian Naira (NGN)' }
  },

  // Line items
  items: [LineItemSchema],

  // Financial calculations
  pricing: {
    subtotal: { type: Number, default: 0 },
    discountType: { type: String, enum: ['percent', 'fixed'], default: 'percent' },
    discountValue: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    shipping: { type: Number, default: 0 },
    deposit: { type: Number, default: 0 }, // Amount already paid
    total: { type: Number, default: 0 },
    balanceDue: { type: Number, default: 0 }
  },

  // Payment information & Terms
  paymentDetails: {
    bankName: { type: String, default: 'Standard Chartered / Access Bank' },
    accountName: { type: String, default: 'Village Coders Tech Ltd' },
    accountNumber: { type: String, default: '0123456789' },
    swift: { type: String, default: 'SCBLNGLA' },
    routingNumber: { type: String, default: '' },
    paypalEmail: { type: String, default: 'payments@villagecoders.io' },
    cryptoAddress: { type: String, default: '' },
    paymentTerms: { type: String, default: 'Payment is due within 14 days of invoice issue date.' },
    notes: { type: String, default: 'Thank you for choosing Village Coders for your software development needs!' }
  },

  // Digital Signature
  signature: {
    type: { type: String, enum: ['typed', 'drawn', 'none'], default: 'typed' },
    value: { type: String, default: 'Authorized Signature' },
    signerName: { type: String, default: 'Village Coders Management' },
    date: { type: String, default: () => new Date().toISOString().split('T')[0] }
  }
}, { 
  timestamps: true 
});

// Calculate pricing totals before saving
InvoiceSchema.pre('save', function(next) {
  let subtotal = 0;
  if (Array.isArray(this.items)) {
    this.items.forEach(item => {
      item.amount = (Number(item.quantity) || 0) * (Number(item.rate) || 0);
      subtotal += item.amount;
    });
  }
  
  let discountAmount = 0;
  if (this.pricing.discountType === 'percent') {
    discountAmount = (subtotal * (Number(this.pricing.discountValue) || 0)) / 100;
  } else {
    discountAmount = Number(this.pricing.discountValue) || 0;
  }

  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxAmount = (taxableAmount * (Number(this.pricing.taxRate) || 0)) / 100;
  const shipping = Number(this.pricing.shipping) || 0;
  const total = taxableAmount + taxAmount + shipping;
  const deposit = Number(this.pricing.deposit) || 0;
  const balanceDue = Math.max(0, total - deposit);

  this.pricing.subtotal = Number(subtotal.toFixed(2));
  this.pricing.discountAmount = Number(discountAmount.toFixed(2));
  this.pricing.taxAmount = Number(taxAmount.toFixed(2));
  this.pricing.total = Number(total.toFixed(2));
  this.pricing.balanceDue = Number(balanceDue.toFixed(2));

  next();
});

module.exports = mongoose.model('Invoice', InvoiceSchema);
