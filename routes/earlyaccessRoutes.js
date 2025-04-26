const express = require('express');
const router = express.Router();
const EarlyAccess = require('../models/EarlyAccess'); 





router.post('/', async (req, res) => {
  const { phonenumber, name, state, paid, referral } = req.body; // <-- ✅ Added referral here too

  try {
    const entry = new EarlyAccess({ phonenumber, name, state, paid, referral }); // <-- ✅ Save referral
    await entry.save();
    res.status(201).json({ message: 'Early access registered', data: entry });
  } catch (error) {
    res.status(400).json({ message: 'Error saving entry', error: error.message });
  }
});


module.exports = router;
