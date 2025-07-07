const express = require('express');
const router = express.Router();
const User = require('./user');
const authenticate = require('./authMiddleware');

router.get('/profile', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password -privateKey');
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      message: '✅ Profile fetched successfully',
      user
    });
  } catch (err) {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;
