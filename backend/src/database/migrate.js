/**
 * Database Migration Script - Schema Updates
 *
 * Adds new columns: password, city, area, occupation to users table (old)
 * Creates: admins and super_admins tables for 3-table architecture
 * Updates enums: zone (add girls_hostel), gender (remove other)
 * Updates tracking and poll_responses zone enums
 */
require('dotenv').config();
const { sequelize } = require('./connection');
const { DataTypes } = require('sequelize');
const logger = require('../utils/logger');

const migrate = async () => {
  try {
    await sequelize.authenticate();
    logger.info('✅ DB connection for migration established');

    const queryInterface = sequelize.getQueryInterface();

    // 1. Add password column to users
    try {
      await queryInterface.addColumn('users', 'password', {
        type: require('sequelize').DataTypes.STRING(255),
        allowNull: true,
      });
      logger.info('✅ Added password column to users');
    } catch (err) {
      if (err.name === 'SequelizeDatabaseError' && (err.parent?.code === 'ER_DUP_FIELDNAME' || err.parent?.code === 'ER_DUP_FIELD_NAME')) {
        logger.info('ℹ️ password column already exists');
      } else throw err;
    }

    // 2. Add city column to users
    try {
      await queryInterface.addColumn('users', 'city', {
        type: require('sequelize').DataTypes.STRING(100),
        allowNull: true,
        defaultValue: 'Bangalore',
      });
      logger.info('✅ Added city column to users');
    } catch (err) {
      if (err.name === 'SequelizeDatabaseError' && (err.parent?.code === 'ER_DUP_FIELDNAME' || err.parent?.code === 'ER_DUP_FIELD_NAME')) {
        logger.info('ℹ️ city column already exists');
      } else throw err;
    }

    // 3. Add area column to users
    try {
      await queryInterface.addColumn('users', 'area', {
        type: require('sequelize').DataTypes.STRING(50),
        allowNull: true,
        defaultValue: 'kengeri',
      });
      logger.info('✅ Added area column to users');
    } catch (err) {
      if (err.name === 'SequelizeDatabaseError' && (err.parent?.code === 'ER_DUP_FIELDNAME' || err.parent?.code === 'ER_DUP_FIELD_NAME')) {
        logger.info('ℹ️ area column already exists');
      } else throw err;
    }

    // 4. Add occupation column to users
    try {
      await queryInterface.addColumn('users', 'occupation', {
        type: require('sequelize').DataTypes.STRING(50),
        allowNull: true,
        defaultValue: 'student',
      });
      logger.info('✅ Added occupation column to users');
    } catch (err) {
      if (err.name === 'SequelizeDatabaseError' && (err.parent?.code === 'ER_DUP_FIELDNAME' || err.parent?.code === 'ER_DUP_FIELD_NAME')) {
        logger.info('ℹ️ occupation column already exists');
      } else throw err;
    }

    // 5. Update zone ENUM for users - MySQL can't alter ENUM directly in Sequelize easily
    try {
      await sequelize.query(
        "ALTER TABLE `users` MODIFY COLUMN `zone` ENUM('masjid', 'boys_hostel', 'stanza', 'girls') NOT NULL;"
      );
      logger.info('✅ Updated users zone ENUM');
    } catch (err) {
      logger.warn('⚠️ Could not update users zone ENUM (might already be updated):', err.message);
    }

    // 6. Update zone ENUM for poll_responses
    try {
      await sequelize.query(
        "ALTER TABLE `poll_responses` MODIFY COLUMN `zone` ENUM('masjid', 'boys_hostel', 'stanza', 'girls') NOT NULL;"
      );
      logger.info('✅ Updated poll_responses zone ENUM');
    } catch (err) {
      logger.warn('⚠️ Could not update poll_responses zone ENUM:', err.message);
    }

    // 7. Update zone ENUM for tracking
    try {
      await sequelize.query(
        "ALTER TABLE `tracking` MODIFY COLUMN `zone` ENUM('masjid', 'boys_hostel', 'stanza', 'girls', 'all') DEFAULT 'all';"
      );
      logger.info('✅ Updated tracking zone ENUM');
    } catch (err) {
      logger.warn('⚠️ Could not update tracking zone ENUM:', err.message);
    }

    // 8. Update gender ENUM - remove 'other'
    try {
      await sequelize.query(
        "ALTER TABLE `users` MODIFY COLUMN `gender` ENUM('male', 'female') NOT NULL;"
      );
      logger.info('✅ Updated users gender ENUM');
    } catch (err) {
      logger.warn('⚠️ Could not update users gender ENUM (may have existing other values):', err.message);
    }

    // 9. Add map_url and track_date to tracking
    try {
      await queryInterface.addColumn('tracking', 'map_url', {
        type: require('sequelize').DataTypes.TEXT,
        allowNull: true,
      });
      logger.info('✅ Added map_url column to tracking');
    } catch (err) {
      if (err.name === 'SequelizeDatabaseError' && (err.parent?.code === 'ER_DUP_FIELDNAME' || err.parent?.code === 'ER_DUP_FIELD_NAME')) {
        logger.info('ℹ️ map_url column already exists');
      } else throw err;
    }

    try {
      await queryInterface.addColumn('tracking', 'track_date', {
        type: require('sequelize').DataTypes.DATEONLY,
        allowNull: true,
      });
      logger.info('✅ Added track_date column to tracking');
    } catch (err) {
      if (err.name === 'SequelizeDatabaseError' && (err.parent?.code === 'ER_DUP_FIELDNAME' || err.parent?.code === 'ER_DUP_FIELD_NAME')) {
        logger.info('ℹ️ track_date column already exists');
      } else throw err;
    }

    // 10. Update existing users to have default area if null
    await sequelize.query(
      "UPDATE `users` SET `city` = 'Bangalore' WHERE `city` IS NULL;"
    );
    await sequelize.query(
      "UPDATE `users` SET `area` = 'kengeri' WHERE `area` IS NULL;"
    );
    await sequelize.query(
      "UPDATE `users` SET `occupation` = 'student' WHERE `occupation` IS NULL;"
    );
    logger.info('✅ Set default values for existing users');

    // 9b. Add special case columns to poll_responses
    try {
      await queryInterface.addColumn('poll_responses', 'is_special_case', {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      });
      logger.info('✅ Added is_special_case to poll_responses');
    } catch (err) {
      if (err.parent?.code === 'ER_DUP_FIELDNAME' || err.parent?.code === 'ER_DUP_FIELD_NAME') {
        logger.info('ℹ️ is_special_case already exists');
      } else logger.warn('⚠️ is_special_case:', err.message);
    }

    try {
      await sequelize.query(
        "ALTER TABLE `poll_responses` ADD COLUMN IF NOT EXISTS `special_case_type` ENUM('want','dont_want') NULL;"
      );
      logger.info('✅ Added special_case_type to poll_responses');
    } catch (err) {
      logger.warn('⚠️ special_case_type:', err.message);
    }

    try {
      await queryInterface.addColumn('poll_responses', 'special_case_at', {
        type: DataTypes.DATE,
        allowNull: true,
      });
      logger.info('✅ Added special_case_at to poll_responses');
    } catch (err) {
      if (err.parent?.code === 'ER_DUP_FIELDNAME' || err.parent?.code === 'ER_DUP_FIELD_NAME') {
        logger.info('ℹ️ special_case_at already exists');
      } else logger.warn('⚠️ special_case_at:', err.message);
    }

    // 11. Handle old 'girls' and 'hostel' zone values - map to new keys
    try {
      await sequelize.query(
        "UPDATE `users` SET `zone` = 'girls' WHERE `zone` IN ('girls_hostel', 'girls');"
      );
      await sequelize.query(
        "UPDATE `poll_responses` SET `zone` = 'girls' WHERE `zone` IN ('girls_hostel', 'girls');"
      );
      await sequelize.query(
        "UPDATE `tracking` SET `zone` = 'girls' WHERE `zone` IN ('girls_hostel', 'girls');"
      );
      await sequelize.query(
        "UPDATE `users` SET `zone` = 'boys_hostel' WHERE `zone` = 'hostel';"
      );
      await sequelize.query(
        "UPDATE `poll_responses` SET `zone` = 'boys_hostel' WHERE `zone` = 'hostel';"
      );
      await sequelize.query(
        "UPDATE `tracking` SET `zone` = 'boys_hostel' WHERE `zone` = 'hostel';"
      );
      logger.info('✅ Migrated old zone values to new keys (girls_hostel→girls, hostel→boys_hostel)');
    } catch (err) {
      logger.warn('⚠️ Could not migrate old zone values:', err.message);
    }

    // 12. Create admins table
    try {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS \`admins\` (
          \`id\` CHAR(36) BINARY NOT NULL,
          \`name\` VARCHAR(100) NOT NULL,
          \`phone\` VARCHAR(15) NOT NULL UNIQUE,
          \`password\` VARCHAR(255) NOT NULL,
          \`zone\` ENUM('masjid', 'boys_hostel', 'stanza', 'girls') NOT NULL,
          \`status\` ENUM('approved', 'rejected') DEFAULT 'approved',
          \`created_by\` CHAR(36) BINARY DEFAULT NULL COMMENT 'Super admin who created this admin',
          \`is_phone_verified\` TINYINT(1) DEFAULT TRUE,
          \`fcm_token\` TEXT DEFAULT NULL,
          \`last_login_at\` DATETIME DEFAULT NULL,
          \`created_at\` DATETIME NOT NULL,
          \`updated_at\` DATETIME NOT NULL,
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
      `);
      logger.info('✅ Created admins table');
    } catch (err) {
      if (err.name === 'SequelizeDatabaseError' && err.parent?.code === 'ER_TABLE_EXISTS_ERROR') {
        logger.info('ℹ️ admins table already exists');
      } else throw err;
    }

    // 13. Create super_admins table
    try {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS \`super_admins\` (
          \`id\` CHAR(36) BINARY NOT NULL,
          \`name\` VARCHAR(100) NOT NULL,
          \`phone\` VARCHAR(15) NOT NULL UNIQUE,
          \`password\` VARCHAR(255) NOT NULL,
          \`created_by\` CHAR(36) BINARY DEFAULT NULL COMMENT 'Super admin who created this super admin',
          \`is_phone_verified\` TINYINT(1) DEFAULT TRUE,
          \`fcm_token\` TEXT DEFAULT NULL,
          \`last_login_at\` DATETIME DEFAULT NULL,
          \`created_at\` DATETIME NOT NULL,
          \`updated_at\` DATETIME NOT NULL,
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
      `);
      logger.info('✅ Created super_admins table');
    } catch (err) {
      if (err.name === 'SequelizeDatabaseError' && err.parent?.code === 'ER_TABLE_EXISTS_ERROR') {
        logger.info('ℹ️ super_admins table already exists');
      } else throw err;
    }

    // 14. Migrate existing super_admin from users table to super_admins table
    try {
      const [existingSuperAdmins] = await sequelize.query(
        "SELECT id, name, phone, password, fcm_token, last_login_at FROM users WHERE role = 'super_admin' LIMIT 1;"
      );
      if (existingSuperAdmins.length > 0) {
        const sa = existingSuperAdmins[0];
        const [checkExisting] = await sequelize.query(
          "SELECT id FROM super_admins WHERE phone = ?;",
          { replacements: [sa.phone] }
        );
        if (checkExisting.length === 0) {
          await sequelize.query(
            `INSERT INTO super_admins (id, name, phone, password, created_by, is_phone_verified, fcm_token, last_login_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, NULL, TRUE, ?, ?, NOW(), NOW());`,
            { replacements: [sa.id, sa.name, sa.phone, sa.password, sa.fcm_token, sa.last_login_at] }
          );
          logger.info('✅ Migrated existing super_admin to super_admins table');
        } else {
          logger.info('ℹ️ Super admin already exists in super_admins table, skipping migration');
        }
      } else {
        logger.info('ℹ️ No legacy super_admin found in users table to migrate');
      }
    } catch (err) {
      logger.warn('⚠️ Could not migrate super_admin data:', err.message);
    }

    // 15. Create chat tables
    try {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS \`chat_groups\` (
          \`id\` CHAR(36) BINARY NOT NULL,
          \`name\` VARCHAR(200) NOT NULL,
          \`created_by\` CHAR(36) BINARY NOT NULL COMMENT 'Super admin who created this group',
          \`created_at\` DATETIME NOT NULL,
          \`updated_at\` DATETIME NOT NULL,
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
      `);
      logger.info('✅ Created chat_groups table');
    } catch (err) {
      if (err.parent?.code === 'ER_TABLE_EXISTS_ERROR') {
        logger.info('ℹ️ chat_groups table already exists');
      } else throw err;
    }

    try {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS \`chat_group_members\` (
          \`id\` CHAR(36) BINARY NOT NULL,
          \`group_id\` CHAR(36) BINARY NOT NULL,
          \`user_id\` CHAR(36) BINARY NOT NULL,
          \`user_type\` ENUM('super_admin','admin','user') NOT NULL,
          \`name\` VARCHAR(100) NOT NULL,
          \`created_at\` DATETIME NOT NULL,
          \`updated_at\` DATETIME NOT NULL,
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`uq_group_member\` (\`group_id\`,\`user_id\`,\`user_type\`),
          KEY \`idx_member_user\` (\`user_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
      `);
      logger.info('✅ Created chat_group_members table');
    } catch (err) {
      if (err.parent?.code === 'ER_TABLE_EXISTS_ERROR') {
        logger.info('ℹ️ chat_group_members table already exists');
      } else throw err;
    }

    try {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS \`chat_messages\` (
          \`id\` CHAR(36) BINARY NOT NULL,
          \`group_id\` CHAR(36) BINARY NOT NULL,
          \`sender_id\` CHAR(36) BINARY NOT NULL,
          \`sender_name\` VARCHAR(100) NOT NULL,
          \`sender_type\` ENUM('super_admin','admin','user') NOT NULL,
          \`message\` TEXT NOT NULL,
          \`created_at\` DATETIME NOT NULL,
          \`updated_at\` DATETIME NOT NULL,
          PRIMARY KEY (\`id\`),
          KEY \`idx_message_group\` (\`group_id\`),
          KEY \`idx_message_created\` (\`created_at\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
      `);
      logger.info('✅ Created chat_messages table');
    } catch (err) {
      if (err.parent?.code === 'ER_TABLE_EXISTS_ERROR') {
        logger.info('ℹ️ chat_messages table already exists');
      } else throw err;
    }

    // 16. Add reply_to columns to chat_messages
    try {
      await queryInterface.addColumn('chat_messages', 'reply_to_id', {
        type: DataTypes.UUID,
        allowNull: true,
      });
      logger.info('✅ Added reply_to_id to chat_messages');
    } catch (err) {
      if (err.parent?.code === 'ER_DUP_FIELDNAME' || err.parent?.code === 'ER_DUP_FIELD_NAME') {
        logger.info('ℹ️ reply_to_id already exists');
      } else throw err;
    }
    try {
      await queryInterface.addColumn('chat_messages', 'reply_to_message', {
        type: DataTypes.TEXT,
        allowNull: true,
      });
      logger.info('✅ Added reply_to_message to chat_messages');
    } catch (err) {
      if (err.parent?.code === 'ER_DUP_FIELDNAME' || err.parent?.code === 'ER_DUP_FIELD_NAME') {
        logger.info('ℹ️ reply_to_message already exists');
      } else throw err;
    }
    try {
      await queryInterface.addColumn('chat_messages', 'reply_to_sender', {
        type: DataTypes.STRING(100),
        allowNull: true,
      });
      logger.info('✅ Added reply_to_sender to chat_messages');
    } catch (err) {
      if (err.parent?.code === 'ER_DUP_FIELDNAME' || err.parent?.code === 'ER_DUP_FIELD_NAME') {
        logger.info('ℹ️ reply_to_sender already exists');
      } else throw err;
    }

    // 17. Add last_read_at to chat_group_members
    try {
      await queryInterface.addColumn('chat_group_members', 'last_read_at', {
        type: DataTypes.DATE,
        allowNull: true,
      });
      logger.info('✅ Added last_read_at to chat_group_members');
    } catch (err) {
      if (err.parent?.code === 'ER_DUP_FIELDNAME' || err.parent?.code === 'ER_DUP_FIELD_NAME') {
        logger.info('ℹ️ last_read_at already exists');
      } else throw err;
    }

    // 18. Drop role column from users table (if it exists)
    try {
      await queryInterface.removeColumn('users', 'role');
      logger.info('✅ Dropped role column from users table');
    } catch (err) {
      if (err.parent?.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
        logger.info('ℹ️ role column already removed from users table');
      } else {
        logger.warn('⚠️ Could not drop role column:', err.message);
      }
    }

    logger.info('✅ Migration completed successfully');
  } catch (err) {
    logger.error('❌ Migration failed:', err);
    throw err;
  }
};

migrate()
  .then(() => {
    logger.info('Migration script finished');
    process.exit(0);
  })
  .catch((err) => {
    logger.error('Migration script failed:', err);
    process.exit(1);
  });
