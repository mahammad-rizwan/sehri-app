require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize } = require('./connection');
const { SuperAdmin, Admin, User, Tracking } = require('../models');
const logger = require('../utils/logger');

const seed = async () => {
  try {
    // Step 1: Fix NULL passwords in users table before sync tries to make it NOT NULL
    logger.info('🔧 Fixing NULL passwords in users table...');
    await sequelize.query(
      `UPDATE users SET password = ? WHERE password IS NULL`,
      {
        replacements: [await bcrypt.hash('reset@123', 10)],
      }
    );
    logger.info('✅ NULL passwords fixed.');

    // Step 2: Sync all models (alter safely now that NULL passwords are fixed)
    await sequelize.sync({ alter: true });
    logger.info('✅ Database synced successfully — new columns (rider_password etc.) added.');

    // Step 3: Create Super Admin (stored in super_admins table)
    const existing = await SuperAdmin.findOne({
      where: { phone: process.env.SUPER_ADMIN_PHONE },
    });

    if (!existing) {
      const hashedPassword = await bcrypt.hash(
        process.env.SUPER_ADMIN_PASSWORD || 'Rizwan@2004',
        10
      );
      await SuperAdmin.create({
        name: process.env.SUPER_ADMIN_NAME || 'Rizwan',
        phone: process.env.SUPER_ADMIN_PHONE || '9483384972',
        password: hashedPassword,
        is_phone_verified: true,
      });
      logger.info('✅ Super admin seeded successfully in super_admins table.');
    } else {
      logger.info('ℹ️  Super admin already exists in super_admins table.');
    }

    // Step 4: Clear ALL existing tracking/rider records so super admin starts fresh
    logger.info('🧹 Clearing all existing tracking records...');
    await sequelize.query('DELETE FROM tracking');
    logger.info('✅ All tracking records removed. Super admin can now add riders fresh.');

    process.exit(0);
  } catch (error) {
    logger.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

seed();
