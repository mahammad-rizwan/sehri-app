require('dotenv').config();
const { Sequelize } = require('sequelize');
const bcrypt = require('bcryptjs');

const sequelize = new Sequelize(
  process.env.DB_NAME || 'sehri_connect',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    dialect: 'mysql',
    logging: console.log,
  }
);

const run = async () => {
  try {
    await sequelize.authenticate();
    const hashedPassword = await bcrypt.hash('Rizwan@2004', 10);
    const [result] = await sequelize.query(
      `UPDATE users SET password = :password, city = 'Bangalore', area = 'kengeri', occupation = 'employee', role = 'super_admin' WHERE phone = '9483384972'`,
      {
        replacements: { password: hashedPassword },
        type: Sequelize.QueryTypes.UPDATE,
      }
    );
    console.log('✅ Password updated for super admin. Rows affected:', result);
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed:', err);
    process.exit(1);
  }
};

run();