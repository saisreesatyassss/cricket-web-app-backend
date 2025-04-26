const mongoose = require('mongoose');

// Helper function to generate random 5-character alphanumeric ID
function generateReferralId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const earlyAccessSchema = new mongoose.Schema({
  phonenumber: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  state: {
    type: String,
    required: true
  },
  paid: {
    type: Boolean,
    default: false
  },
  referral: {
    type: String,
  },
  referralId: {
    type: String,
    unique: true,
    default: generateReferralId // <-- ✅ auto-generate referralId
  }
}, { timestamps: true });

// Before saving, ensure referralId is unique
earlyAccessSchema.pre('save', async function (next) {
  if (!this.referralId) {
    this.referralId = generateReferralId();
  }

  let existing = await mongoose.models.EarlyAccess.findOne({ referralId: this.referralId });
  while (existing) {
    this.referralId = generateReferralId();
    existing = await mongoose.models.EarlyAccess.findOne({ referralId: this.referralId });
  }
  next();
});

const EarlyAccess = mongoose.model('EarlyAccess', earlyAccessSchema);

module.exports = EarlyAccess;
