const express = require('express');
const router = express.Router();

// =======================
// LOGOUT
// =======================
router.post('/', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('LOGOUT ERROR:', err);
      return res.status(500).json({
        status: 'error',
        message: 'Logout failed'
      });
    }

    res.clearCookie('smartschool.sid');
    res.json({
      status: 'success',
      message: 'Logged out successfully'
    });
  });
});

module.exports = router;
