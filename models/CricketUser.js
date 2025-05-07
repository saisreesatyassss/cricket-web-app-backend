// models/CricketUser.js

const mongoose = require("mongoose");

function generateReferralId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  phoneNumber: { type: String, required: true, unique: true },
  password: { type: String, required: true }, 
  profilePage: {
    firstName: String,
    lastName: String,
    profilePicture: String,
    education: String,
    gender: { type: String, enum: ["Male", "Female", "Other"] },
    stateOfResidence: String,
    email: String,
    dateOfBirth: Date,
  },
  role: { type: String, enum: ["user", "admin"], default: "user" },
  createdAt: { type: Date, default: Date.now },
  uniqueId: { type: String, unique: true },
  phoneNumberVerified: { type: Boolean, default: false },
  panCardNumber: { type: String, unique: true, sparse: true },
  panCardImages: [{ type: String }],
  panCardVerified: { type: Boolean, default: false },
  referral: {
    type: String,
  },
  referralId: {
    type: String,
    unique: true,
    default: generateReferralId // <-- ✅ auto-generate referralId
  },
    wallet: {
    withdrawable: { type: Number, default: 49 },     
    nonWithdrawable: { type: Number, default: 50 },  
    isWalletFunded: { type: Boolean, default: false },
  }

  
}, { timestamps: true });



// Before saving, ensure referralId is unique
userSchema.pre('save', async function (next) {
  if (!this.referralId) {
    this.referralId = generateReferralId();
  }

  let existing = await mongoose.models.CricketUser.findOne({ referralId: this.referralId });
  while (existing) {
    this.referralId = generateReferralId();
    existing = await mongoose.models.CricketUser.findOne({ referralId: this.referralId });
  }
  next();
});

const CricketUser = mongoose.model("CricketUser", userSchema);
module.exports = CricketUser;
