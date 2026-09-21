const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const generateTokens = (userId, role) => {
  const accessToken = jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  const refreshToken = jwt.sign(
    { userId, role },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
  );

  return { accessToken, refreshToken };
};

const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

/**
 * Short-lived token that authorises editing a still-pending registration.
 *
 * It is signed with a secret *derived* from JWT_SECRET rather than JWT_SECRET
 * itself, so it cannot be presented as an access token (or as a refresh token)
 * anywhere else in the API — it only verifies through verifyPendingEditToken.
 */
const pendingEditSecret = () =>
  crypto.createHash('sha256').update(`${process.env.JWT_SECRET}|pending-edit`).digest('hex');

const generatePendingEditToken = (userId) =>
  jwt.sign({ userId, purpose: 'pending_edit' }, pendingEditSecret(), { expiresIn: '30m' });

const verifyPendingEditToken = (token) => {
  const decoded = jwt.verify(token, pendingEditSecret());
  if (decoded.purpose !== 'pending_edit') throw new Error('Wrong token purpose');
  return decoded;
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};

module.exports = {
  generateTokens, verifyToken, verifyRefreshToken,
  generatePendingEditToken, verifyPendingEditToken,
};
