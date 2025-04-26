// models/CricketUser.js

const mongoose = require("mongoose");

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
  referral: { type: String },
});

const CricketUser = mongoose.model("CricketUser", userSchema);
module.exports = CricketUser;
