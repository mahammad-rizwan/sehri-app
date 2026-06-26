const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const Poll = sequelize.define('Poll', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    unique: true,
    comment: 'One poll per day',
  },
  question: {
    type: DataTypes.STRING(300),
    defaultValue: 'Will you be having Sehri food today?',
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  deadline_time: {
    type: DataTypes.TIME,
    allowNull: true,
    comment: 'Time after which poll closes (e.g. 01:00:00 for 1 AM)',
  },
}, {
  tableName: 'polls',
  indexes: [{ fields: ['date'] }],
});

module.exports = Poll;
