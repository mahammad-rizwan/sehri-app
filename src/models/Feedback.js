const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const Feedback = sequelize.define('Feedback', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: { len: [5, 1000] },
  },
  category: {
    type: DataTypes.ENUM('general', 'food_quality', 'distribution', 'suggestion', 'complaint'),
    defaultValue: 'general',
  },
  rating: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: { min: 1, max: 5 },
  },
  is_read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  tableName: 'feedbacks',
  indexes: [
    { fields: ['user_id'] },
    { fields: ['is_read'] },
  ],
});

module.exports = Feedback;
