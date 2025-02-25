const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Using _id as the reference to User
  activityDetails: [{
    method: { type: String }, // The action performed by the user (e.g., 'register', 'login')
    deviceInfo: { 
      browser: { type: String }, // Basic browser info
      os: { type: String }, // Operating system
      deviceType: { type: String } // Device type (e.g., desktop, mobile, tablet)
    },
    ipAddress: { type: String }, // Storing user IP address
    timestamp: { type: Date, default: Date.now } // Adding timestamp here
  }]
}, { collection: 'CricketActivities' });

const Activity = mongoose.model('CricketActivity', activitySchema);

module.exports = Activity;

 