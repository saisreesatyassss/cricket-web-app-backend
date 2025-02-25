// Import the necessary models and dependencies
const Activity = require('./CricketActivity'); // Assuming Activity is the Mongoose model for activity logs

// Helper function to log activities
const logActivity = async (userId, method, req) => {
  const ipAddress = req.clientIp;
  const userAgent = req.headers['user-agent'];
  const deviceInfo = getDeviceInfo(userAgent);

  const newActivityDetail = {
    method,
    deviceInfo: {
      browser: userAgent.split(' ')[0], // Simplified browser info
      os: deviceInfo.os,
      deviceType: deviceInfo.deviceType
    },
    ipAddress,
    timestamp: new Date()
  };

  try {
    // Find an existing activity document for this user
    let activity = await Activity.findOne({ _id: userId });

    if (activity) {
      // If activity document exists, push new activity to activityDetails array
      activity.activityDetails.push(newActivityDetail);
    } else {
      // If no document exists, create a new one
      activity = new Activity({
        _id: userId,
        activityDetails: [newActivityDetail]
      });
    }

    // Save the updated or new activity document
    await activity.save();
    console.log(`Activity logged for user ${userId}`);
  } catch (err) {
    console.error('Error logging activity:', err);
  }
};

// Helper function to get OS and device type
const getDeviceInfo = (userAgent) => {
  let os = 'Unknown';
  let deviceType = 'Unknown';

  if (/windows/i.test(userAgent)) os = 'Windows';
  else if (/macintosh|mac os x/i.test(userAgent)) os = 'MacOS';
  else if (/linux/i.test(userAgent)) os = 'Linux';
  else if (/android/i.test(userAgent)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(userAgent)) os = 'iOS';

  if (/mobile/i.test(userAgent)) deviceType = 'mobile';
  else if (/tablet/i.test(userAgent)) deviceType = 'tablet';
  else deviceType = 'desktop';

  return { os, deviceType };
};

// Export the logActivity function for use in other files
module.exports = { logActivity };
