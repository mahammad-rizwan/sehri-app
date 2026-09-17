const { Sequelize } = require('sequelize');
const logger = require('../utils/logger');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: (msg) => logger.debug(msg),
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    define: {
      timestamps: true,
      underscored: true,
    },
  }
);

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    logger.info('✅ MySQL connection established successfully.');
  } catch (error) {
    logger.error('❌ Unable to connect to MySQL:', error);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };
