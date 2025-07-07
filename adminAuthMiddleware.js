// adminAuthMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('./user');

async function adminAuthenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication token missing' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    // Crucial check: Is the user an admin?
    if (!user.isAdmin) {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    req.userId = decoded.userId; // Pass user id for logging or other purposes
    req.user = user; // Pass the full user object
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

module.exports = adminAuthenticate;