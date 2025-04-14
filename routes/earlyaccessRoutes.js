const express = require('express');
const router = express.Router();
const EarlyAccess = require('../models/EarlyAccess'); 

router.post('/', async (req, res) => {
  const { phonenumber, name, state, paid } = req.body;

  try {
    const entry = new EarlyAccess({ phonenumber, name, state, paid });
    await entry.save();
    res.status(201).json({ message: 'Early access registered', data: entry });
  } catch (error) {
    res.status(400).json({ message: 'Error saving entry', error: error.message });
  }
});

module.exports = router;
