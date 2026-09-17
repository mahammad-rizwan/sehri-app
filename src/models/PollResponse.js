const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const PollResponse = sequelize.define('PollResponse', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  poll_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  response: {
    type: DataTypes.ENUM('yes', 'no'),
    allowNull: false,
  },
  zone: {
    type: DataTypes.ENUM('masjid', 'boys_hostel', 'stanza', 'girls'),
    allowNull: false,
  },
  // Special case fields — set AFTER poll window closes
  // is_special_case = true when user changes their mind outside the normal window
  // special_case_type:
  //   'dont_want' = voted yes but now doesn't want Sehri
  //   'want'      = voted no / didn't vote but now wants Sehri
  is_special_case: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  special_case_type: {
    type: DataTypes.ENUM('want', 'dont_want'),
    allowNull: true,
  },
  special_case_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  // Sehri allotment — set by super admin during 5–6 PM allotment window
  // true  = Sehri allotted (confirmed)
  // false = not allotted (no Sehri)
  // null  = not decided yet (pending)
  sehri_allowed: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
  },
  sehri_allotted_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'poll_responses',
  indexes: [
    { unique: true, fields: ['poll_id', 'user_id'] },
    { fields: ['zone'] },
    { fields: ['is_special_case'] },
  ],
});

module.exports = PollResponse;
