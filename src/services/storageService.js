/**
 * Donation proof storage.
 *
 * Railway's filesystem is ephemeral — anything written to local disk is lost on
 * every redeploy, so proofs must go to Cloudinary in production.
 *
 * Once CLOUDINARY_URL is configured there is NO disk fallback: if the upload
 * fails the submission is rejected, because silently writing to a disk that
 * gets wiped would look like success and lose the donor's proof. Disk is used
 * only when Cloudinary is not configured at all (i.e. local development).
 *
 * Configure with either:
 *   CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>
 * or the three parts separately:
 *   CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET
 *
 * Uploaded assets get a UUID public_id and their Cloudinary URL is never sent
 * to a client — getDonationProof streams the bytes back through the
 * authenticated endpoint, so access control stays exactly as it was.
 */

const https  = require('https');
const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

const CLOUDINARY_FOLDER = 'sehri/donations';

/**
 * Reused connection pool for Cloudinary.
 *
 * Every upload otherwise pays a fresh DNS lookup and TLS handshake, which is a
 * meaningful slice of the per-upload cost when the payload itself is small.
 * Keeping sockets warm means back-to-back submissions skip that entirely.
 */
const cloudinaryAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 10,
});

const localUploadDir = path.join(__dirname, '../../uploads/donations');

function getCloudinaryConfig() {
  const url = process.env.CLOUDINARY_URL;
  if (url) {
    // cloudinary://<api_key>:<api_secret>@<cloud_name>
    const m = /^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/.exec(url.trim());
    if (m) return { apiKey: m[1], apiSecret: m[2], cloudName: m[3] };
    logger.warn('CLOUDINARY_URL is set but malformed — falling back to local disk storage');
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey    = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (cloudName && apiKey && apiSecret) return { cloudName, apiKey, apiSecret };

  return null;
}

const isCloudinaryEnabled = () => getCloudinaryConfig() !== null;

/** Cloudinary signs the alphabetically-sorted params, then appends the secret. */
function signParams(params, apiSecret) {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return crypto.createHash('sha1').update(toSign + apiSecret).digest('hex');
}

function buildMultipartBody(fields, file, boundary) {
  const parts = [];

  for (const [name, value] of Object.entries(fields)) {
    parts.push(Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${name}"\r\n\r\n` +
      `${value}\r\n`
    ));
  }

  parts.push(Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${file.filename}"\r\n` +
    `Content-Type: ${file.mimetype}\r\n\r\n`
  ));
  parts.push(file.buffer);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

  return Buffer.concat(parts);
}

function uploadToCloudinary(buffer, mimetype, originalName) {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId  = uuidv4();

  const signed = { folder: CLOUDINARY_FOLDER, public_id: publicId, timestamp };
  const signature = signParams(signed, apiSecret);

  const boundary = `----sehri${crypto.randomBytes(16).toString('hex')}`;
  const body = buildMultipartBody(
    { ...signed, api_key: apiKey, signature },
    { buffer, mimetype: mimetype || 'application/octet-stream', filename: originalName || 'proof.jpg' },
    boundary
  );

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.cloudinary.com',
        path: `/v1_1/${cloudName}/image/upload`,
        method: 'POST',
        agent: cloudinaryAgent,
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length,
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          let parsed = null;
          try { parsed = JSON.parse(raw); } catch { /* handled below */ }

          if (res.statusCode >= 200 && res.statusCode < 300 && parsed?.secure_url) {
            return resolve(parsed.secure_url);
          }
          reject(new Error(
            `Cloudinary upload failed [${res.statusCode}]: ${parsed?.error?.message || raw.slice(0, 200)}`
          ));
        });
      }
    );

    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Cloudinary upload timed out'));
    });
    req.end(body);
  });
}

function saveToLocalDisk(buffer, originalName) {
  if (!fs.existsSync(localUploadDir)) {
    fs.mkdirSync(localUploadDir, { recursive: true });
  }
  const ext = (path.extname(originalName || '').toLowerCase()) || '.jpg';
  const filename = `${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`;
  fs.writeFileSync(path.join(localUploadDir, filename), buffer);
  return `/uploads/donations/${filename}`;
}

/**
 * Persist an uploaded proof image.
 * @returns {Promise<string>} value to store in donations.proof_url —
 *          an https:// URL when Cloudinary is configured, otherwise a
 *          /uploads/... path relative to the backend root.
 */
async function saveDonationProof(file) {
  if (isCloudinaryEnabled()) {
    try {
      const url = await uploadToCloudinary(file.buffer, file.mimetype, file.originalname);
      logger.info('Donation proof uploaded to Cloudinary');
      return url;
    } catch (err) {
      // Deliberately NOT falling back to disk here. Railway's filesystem is
      // wiped on every redeploy, so a silent fallback would look like success
      // and then lose the proof — the one outcome we must never allow. Failing
      // the submission lets the donor retry while they still have the receipt.
      logger.error(`Cloudinary upload failed, rejecting submission: ${err.message}`);
      throw new Error('PROOF_UPLOAD_FAILED');
    }
  }

  // No Cloudinary configured: development, or a deploy that has not been set up
  // yet. Disk keeps things working, but the proof will not survive a restart.
  logger.warn(
    'CLOUDINARY_URL is not set — donation proof written to local disk and WILL BE LOST on restart',
  );
  return saveToLocalDisk(file.buffer, file.originalname);
}

/**
 * Verifies the credentials against Cloudinary's Admin API.
 * Read-only — it lists at most one asset purely to check the cloud name and key
 * actually belong together.
 */
function verifyCloudinary() {
  const cfg = getCloudinaryConfig();
  if (!cfg) return Promise.resolve({ ok: false, reason: 'not configured' });

  return new Promise((resolve) => {
    const auth = Buffer.from(`${cfg.apiKey}:${cfg.apiSecret}`).toString('base64');
    const req = https.request({
      hostname: 'api.cloudinary.com',
      path: `/v1_1/${cfg.cloudName}/resources/image?max_results=1`,
      method: 'GET',
      headers: { Authorization: `Basic ${auth}` },
    }, (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => {
        if (res.statusCode === 200) return resolve({ ok: true });
        let reason = raw.slice(0, 150);
        try { reason = JSON.parse(raw)?.error?.message || reason; } catch { /* keep raw */ }
        resolve({ ok: false, reason, status: res.statusCode });
      });
    });
    req.on('error', (e) => resolve({ ok: false, reason: e.message }));
    req.setTimeout(10000, () => { req.destroy(); resolve({ ok: false, reason: 'timed out' }); });
    req.end();
  });
}

/**
 * Logged once at boot so a misconfigured deploy is obvious from the logs rather
 * than from a donor hitting a failed submission.
 */
async function reportStorageMode() {
  const cfg = getCloudinaryConfig();

  if (!cfg) {
    if (process.env.CLOUDINARY_URL) {
      logger.error('🗂️  CLOUDINARY_URL is set but malformed. Expected: cloudinary://<api_key>:<api_secret>@<cloud_name>');
    } else {
      logger.warn('🗂️  CLOUDINARY_URL not set — donation proofs go to local disk and are LOST on restart');
    }
    return;
  }

  const check = await verifyCloudinary();
  if (check.ok) {
    logger.info(`🗂️  Donation proofs → Cloudinary OK (cloud: ${cfg.cloudName})`);
    return;
  }

  logger.error(`🗂️  Cloudinary REJECTED the credentials: ${check.reason}`);
  if (/cloud_name mismatch/i.test(check.reason || '')) {
    logger.error(
      `🗂️  The api_key is valid but does not belong to cloud "${cfg.cloudName}". ` +
      'Copy the exact Cloud Name from Cloudinary Dashboard → Product Environment Credentials.',
    );
  } else if (/unknown api_key/i.test(check.reason || '')) {
    logger.error('🗂️  The api_key itself is not recognised — re-copy the whole CLOUDINARY_URL from the dashboard.');
  }
  logger.error('🗂️  Donation submissions will be REJECTED until this is fixed (proofs are never written to disk when Cloudinary is configured).');
}

/**
 * Asks Cloudinary for a display-sized copy instead of the original.
 *
 * A phone camera screenshot is often ~1MB; an admin working through a queue
 * would pull that every time. `w_1400,q_auto` is still comfortably readable for
 * verifying a UPI reference. Left untouched for non-Cloudinary URLs, and for
 * URLs that already carry a transformation.
 */
function displaySizedUrl(url) {
  if (!/^https:\/\/res\.cloudinary\.com\//.test(url)) return url;
  const marker = '/image/upload/';
  const i = url.indexOf(marker);
  if (i === -1) return url;

  const rest = url.slice(i + marker.length);
  // A version segment (v123456) or a folder means no transformation is present.
  if (!/^v\d+\//.test(rest) && rest.includes(',')) return url;

  return `${url.slice(0, i + marker.length)}w_1400,q_auto/${rest}`;
}

/** Streams a remote proof image back through the caller's response. */
function streamRemoteProof(rawUrl, res) {
  const url = displaySizedUrl(rawUrl);
  return new Promise((resolve, reject) => {
    const req = https.get(url, (upstream) => {
      if (upstream.statusCode !== 200) {
        upstream.resume();
        return reject(new Error(`Upstream returned ${upstream.statusCode}`));
      }
      res.setHeader('Content-Type', upstream.headers['content-type'] || 'image/jpeg');
      if (upstream.headers['content-length']) {
        res.setHeader('Content-Length', upstream.headers['content-length']);
      }
      upstream.pipe(res);
      upstream.on('end', resolve);
      upstream.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(20000, () => {
      req.destroy();
      reject(new Error('Proof fetch timed out'));
    });
  });
}

module.exports = {
  saveDonationProof,
  reportStorageMode,
  displaySizedUrl,
  verifyCloudinary,
  streamRemoteProof,
  isCloudinaryEnabled,
  localUploadDir,
};
