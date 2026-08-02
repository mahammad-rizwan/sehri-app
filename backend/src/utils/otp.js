/**
 * OTP — MessageCentral VerifyNow
 * Send: POST /verification/v3/send
 * Validate: GET /verification/v3/validateOtp (using fresh token at validate time)
 */

const https  = require('https');
const { OTP } = require('../models');
const logger  = require('./logger');

const MAX_ATTEMPTS       = 5;
const OTP_EXPIRY_MINUTES = 10;

// Simple in-memory token cache — avoids two getMCToken calls per verify
let _cachedToken = null;
let _tokenExpiry = 0;

const apiCall = (method, urlStr, headers = {}, retries = 2) =>
  new Promise((resolve, reject) => {
    const attempt = () => {
      const parsed = new URL(urlStr);
      const req = https.request(
        {
          hostname: parsed.hostname,
          path:     parsed.pathname + parsed.search,
          method,
          headers:  { accept: 'application/json', ...headers },
        },
        (res) => {
          let raw = '';
          res.on('data', (c) => (raw += c));
          res.on('end', () => {
            logger.debug(`MC ${method} ${parsed.pathname} [${res.statusCode}] → ${raw.slice(0, 400)}`);
            if (!raw.trim()) { resolve({ _status: res.statusCode }); return; }
            try { resolve({ ...JSON.parse(raw), _status: res.statusCode }); }
            catch { resolve({ _raw: raw, _status: res.statusCode }); }
          });
        }
      );
      req.on('error', (err) => {
        if (retries > 0) {
          logger.warn(`MC ${method} error, retrying... (${retries} left): ${err.message}`);
          retries--;
          setTimeout(attempt, 1500);
        } else {
          reject(err);
        }
      });
      req.setTimeout(30000, () => {
        req.destroy();
        if (retries > 0) {
          logger.warn(`MC ${method} timeout, retrying... (${retries} left)`);
          retries--;
          setTimeout(attempt, 2000);
        } else {
          reject(new Error('MC request timed out after retries'));
        }
      });
      req.end();
    };
    attempt();
  });

const getMCToken = async () => {
  // Use cached token if still valid (tokens are valid for ~23 hours)
  if (_cachedToken && Date.now() < _tokenExpiry) {
    return _cachedToken;
  }

  const tryGetToken = async (customerId, password, label) => {
    // MC requires password as base64. Do NOT URL-encode the = padding —
    // pass the raw base64 string so = stays as = in the query string.
    const b64 = Buffer.from(password).toString('base64');
    logger.debug(`MC token attempt [${label}] customerId=${customerId} b64=${b64}`);

    return new Promise((resolve) => {
      const rawQuery = `?customerId=${customerId}&key=${b64}&scope=NEW&country=91`;
      const req = require('https').request(
        {
          hostname: 'cpaas.messagecentral.com',
          path: '/auth/v1/authentication/token' + rawQuery,
          method: 'GET',
          headers: { accept: 'application/json' },
        },
        (res) => {
          let raw = '';
          res.on('data', (c) => (raw += c));
          res.on('end', () => {
            logger.debug(`MC token [${label}] HTTP ${res.statusCode} → ${raw.slice(0, 300)}`);
            if (!raw.trim()) { resolve({ _status: res.statusCode }); return; }
            try { resolve({ ...JSON.parse(raw), _status: res.statusCode }); }
            catch { resolve({ _raw: raw, _status: res.statusCode }); }
          });
        }
      );
      req.on('error', (e) => {
        logger.warn(`MC token [${label}] request error: ${e.message}`);
        resolve({ _error: e.message });
      });
      req.setTimeout(20000, () => {
        req.destroy();
        resolve({ _error: 'timeout' });
      });
      req.end();
    });
  };

  const id1  = process.env.MESSAGECENTRAL_CUSTOMER_ID;
  const pwd1 = process.env.MESSAGECENTRAL_PASSWORD;
  const id2  = process.env.MESSAGECENTRAL_CUSTOMER_ID1;
  const pwd2 = process.env.MESSAGECENTRAL_PASSWORD1;

  if (!id1 || !pwd1)
    throw new Error('MESSAGECENTRAL credentials not set in .env');

  // Try primary credentials
  let resp = await tryGetToken(id1, pwd1, 'primary');
  if (resp?.token) {
    _cachedToken = resp.token;
    _tokenExpiry = Date.now() + 22 * 60 * 60 * 1000;
    logger.info('MC token obtained via primary credentials');
    return _cachedToken;
  }
  logger.warn(`MC primary credentials failed: ${JSON.stringify(resp)}`);

  // Try alternate credentials if available
  if (id2 && pwd2) {
    resp = await tryGetToken(id2, pwd2, 'alternate');
    if (resp?.token) {
      _cachedToken = resp.token;
      _tokenExpiry = Date.now() + 22 * 60 * 60 * 1000;
      logger.info('MC token obtained via alternate credentials');
      return _cachedToken;
    }
    logger.warn(`MC alternate credentials also failed: ${JSON.stringify(resp)}`);
  }

  throw new Error(`MC token failed: ${JSON.stringify(resp)}`);
};

const sendOTP = async (phone, purpose = 'register') => {
  await OTP.update({ is_used: true }, { where: { phone, purpose, is_used: false } });

  const token = await getMCToken();

  const resp = await apiCall('POST',
    `https://cpaas.messagecentral.com/verification/v3/send` +
    `?countryCode=91&flowType=SMS&mobileNumber=${phone}&otpLength=4`,
    { authToken: token }
  );

  const verificationId = resp?.data?.verificationId ?? resp?.verificationId ?? null;
  if (!verificationId) throw new Error(`MC send failed: ${JSON.stringify(resp)}`);

  // Store only verificationId — get fresh token at validate time
  await OTP.create({
    phone,
    otp:        String(verificationId),
    purpose,
    expires_at: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
  });

  logger.info(`OTP sent via MC to +91${phone} (verificationId: ${verificationId})`);
  return true;
};

const verifyOTP = async (phone, code, purpose) => {
  const record = await OTP.findOne({
    where: { phone, purpose, is_used: false },
    order: [['created_at', 'DESC']],
  });

  if (!record)
    return { valid: false, reason: 'No OTP found. Please request a new OTP.' };
  if (record.attempts >= MAX_ATTEMPTS) {
    await record.update({ is_used: true });
    return { valid: false, reason: 'Maximum attempts exceeded. Please request a new OTP.' };
  }
  if (new Date() > new Date(record.expires_at)) {
    await record.update({ is_used: true });
    return { valid: false, reason: 'OTP has expired. Please request a new OTP.' };
  }

  await record.increment('attempts');

  // Get a fresh token for validation
  const token          = await getMCToken();
  const verificationId = record.otp.includes('::')
    ? record.otp.substring(0, record.otp.indexOf('::'))
    : record.otp;

  logger.info(`Validating verificationId=${verificationId} code=${code}`);

  // Try GET first (as shown in docs curl example), then POST as fallback
  let resp = await apiCall('GET',
    `https://cpaas.messagecentral.com/verification/v3/validateOtp` +
    `?verificationId=${verificationId}&code=${encodeURIComponent(code)}&flowType=SMS`,
    { authToken: token }
  );

  logger.info(`MC validateOtp GET response: ${JSON.stringify(resp)}`);

  // If GET gives 401/405, try POST
  if (resp?._status === 401 || resp?._status === 405) {
    resp = await apiCall('POST',
      `https://cpaas.messagecentral.com/verification/v3/validateOtp` +
      `?verificationId=${verificationId}&code=${encodeURIComponent(code)}&flowType=SMS`,
      { authToken: token }
    );
    logger.info(`MC validateOtp POST response: ${JSON.stringify(resp)}`);
  }

  const status = resp?.data?.verificationStatus ?? resp?.verificationStatus ?? '';
  if (status === 'VERIFICATION_COMPLETED') {
    await record.update({ is_used: true, verified_at: new Date() });
    return { valid: true, reason: 'OTP verified successfully' };
  }

  const mc = String(resp?.responseCode ?? resp?.data?.responseCode ?? resp?._status ?? '');
  let reason = 'Invalid OTP. Please try again.';
  if (mc === '702') reason = 'Wrong OTP. Please try again.';
  if (mc === '703') reason = 'OTP already verified.';
  if (mc === '705') reason = 'OTP expired. Please request a new one.';

  const remaining = MAX_ATTEMPTS - record.attempts;
  if (remaining > 0) reason += ` (${remaining} attempts left)`;
  return { valid: false, reason };
};

const saveOTP = async () => null;
module.exports = { saveOTP, verifyOTP, sendOTP };
