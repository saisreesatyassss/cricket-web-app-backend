const jwt = require('jsonwebtoken');
const PintudeUser = require('../models/PintudeUser'); // Adjust the path to your User model
require('dotenv').config();

const adminAuthMiddleware = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  try {
    // Verify the token and decode user ID
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded JWT:', decoded); // Debug log
    req.user = decoded;

    const userId = req.user.userId; // Corrected variable declaration
    console.log('Extracted User ID:', userId); // Debug log

    // Fetch user from the database to check the role
    const user = await PintudeUser.findOne({ userId }); // Use findOne if `userId` is not `_id`

    // If your database uses `_id` for the user ID, use findById instead:
    // const user = await PintudeUser.findById(userId);

    if (!user) {
      console.error('User not found'); // Debug log
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role !== 'admin') {
      console.error('Access denied: User is not an admin'); // Debug log
      return res.status(403).json({ message: 'Access denied: You are not an admin' });
    }

    // Attach the user object to the request for further processing if needed
    req.user = user;

    next();
  } catch (err) {
    console.error('Error in adminAuthMiddleware:', err.message); // Debug log
    res.status(401).json({ message: 'Token is not valid', error: err.message });
  }
};

module.exports = adminAuthMiddleware;
