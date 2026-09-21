require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize } = require('./connection');
const { User, Admin } = require('../models');
const logger = require('../utils/logger');

const seed = async () => {
  try {
    await sequelize.authenticate();
    logger.info('DB connected');

    // Dev-only fixtures. Overridable so the defaults never reach a real deploy.
    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_TEST_SEED) {
      throw new Error('Refusing to seed test users in production. Set ALLOW_TEST_SEED=1 to override.');
    }
    const userPass  = await bcrypt.hash(process.env.TEST_USER_PASSWORD  || 'pass@123',  10);
    const adminPass = await bcrypt.hash(process.env.TEST_ADMIN_PASSWORD || 'Admin@123', 10);

    // ── 8 Test Users (2 per zone, status = approved) ──────────────────────────
    const testUsers = [
      // Masjid Zone
      {
        name: 'Ahmed Siddiqui', phone: '9876100001',
        gender: 'male', occupation: 'student',
        city: 'Bangalore', area: 'kengeri', zone: 'masjid',
        address: 'Maruthi PG',
      },
      {
        name: 'Bilal Hussain', phone: '9876100002',
        gender: 'male', occupation: 'student',
        city: 'Bangalore', area: 'kengeri', zone: 'masjid',
        address: 'Infront of Masjid',
      },
      // Boys Hostel Zone
      {
        name: 'Farhan Khan', phone: '9876100003',
        gender: 'male', occupation: 'student',
        city: 'Bangalore', area: 'kengeri', zone: 'boys_hostel',
        address: 'Cauvery Hostel',
      },
      {
        name: 'Imran Sheikh', phone: '9876100004',
        gender: 'male', occupation: 'student',
        city: 'Bangalore', area: 'kengeri', zone: 'boys_hostel',
        address: 'Sir MV Hostel',
      },
      // Stanza Zone
      {
        name: 'Raza Ali', phone: '9876100005',
        gender: 'male', occupation: 'student',
        city: 'Bangalore', area: 'kengeri', zone: 'stanza',
        address: 'Lasya PG',
      },
      {
        name: 'Zubair Ahmed', phone: '9876100006',
        gender: 'male', occupation: 'student',
        city: 'Bangalore', area: 'kengeri', zone: 'stanza',
        address: 'Stanza Living (Huelva House)',
      },
      // Girls Zone
      {
        name: 'Ayesha Begum', phone: '9876100007',
        gender: 'female', occupation: 'student',
        city: 'Bangalore', area: 'kengeri', zone: 'girls',
        address: 'Chaitrashree Comforts',
      },
      {
        name: 'Fatima Noor', phone: '9876100008',
        gender: 'female', occupation: 'student',
        city: 'Bangalore', area: 'kengeri', zone: 'girls',
        address: 'RVCE Girls DJ Hostel',
      },
    ];

    let usersCreated = 0;
    for (const u of testUsers) {
      const exists = await User.findOne({ where: { phone: u.phone } });
      if (!exists) {
        await User.create({
          ...u,
          password: userPass,
          status: 'approved',
          is_phone_verified: true,
        });
        logger.info(`Created user: ${u.name} (${u.zone})`);
        usersCreated++;
      } else {
        logger.info(`User already exists: ${u.phone}`);
      }
    }

    // ── 4 Zone Admins (1 per zone) ─────────────────────────────────────────────
    const testAdmins = [
      { name: 'Admin Masjid',   phone: '9876200001', zone: 'masjid'       },
      { name: 'Admin Boys Hostel', phone: '9876200002', zone: 'boys_hostel' },
      { name: 'Admin Stanza',      phone: '9876200003', zone: 'stanza'       },
      { name: 'Admin Girls',       phone: '9876200004', zone: 'girls'        },
    ];

    let adminsCreated = 0;
    for (const a of testAdmins) {
      const exists = await Admin.findOne({ where: { phone: a.phone } });
      if (!exists) {
        await Admin.create({
          ...a,
          password: adminPass,
          status: 'approved',
          is_phone_verified: true,
          created_by: null,
        });
        logger.info(`Created admin: ${a.name} (${a.zone})`);
        adminsCreated++;
      } else {
        logger.info(`Admin already exists: ${a.phone}`);
      }
    }

    logger.info(`Done. Users created: ${usersCreated}/8, Admins created: ${adminsCreated}/4`);
    logger.info('');
    logger.info('Test credentials:');
    logger.info('  Users    → password: pass@123');
    logger.info('  Admins   → password: Admin@123');
    logger.info('');
    logger.info('User phones:  9876100001 to 9876100008');
    logger.info('Admin phones: 9876200001 to 9876200004');

    process.exit(0);
  } catch (err) {
    logger.error('Seed failed:', err);
    process.exit(1);
  }
};

seed();
