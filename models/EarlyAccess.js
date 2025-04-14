const mongoose = require('mongoose');

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
  }
}, { timestamps: true });

const EarlyAccess = mongoose.model('EarlyAccess', earlyAccessSchema);

module.exports = EarlyAccess;
