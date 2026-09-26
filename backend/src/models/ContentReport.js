const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

/** Why something was reported. Keys are stored; labels live in the app. */
const REASONS = [
  'inappropriate', 'violence', 'hate', 'harassment', 'spam', 'misinformation', 'other',
];

/**
 * A report against an announcement or a chat message.
 *
 * The reported text is copied into `content_snapshot` at report time. Without
 * that, a sender could delete the message the moment it was reported and leave
 * the reviewer looking at nothing — and a reviewer who removes content still
 * needs to see what they removed.
 *
 * One report per person per item: the unique index turns a second report of
 * the same thing into a friendly "already reported" rather than a pile-up.
 */
const ContentReport = sequelize.define('ContentReport', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  target_type: {
    type: DataTypes.ENUM('broadcast', 'chat_message'),
    allowNull: false,
  },
  target_id: { type: DataTypes.UUID, allowNull: false },
  /** The chat group, for chat reports — so the reviewer knows where it was said. */
  group_id: { type: DataTypes.UUID, allowNull: true },
  group_name: { type: DataTypes.STRING(120), allowNull: true },

  content_snapshot: { type: DataTypes.TEXT, allowNull: false },
  content_author_id: { type: DataTypes.UUID, allowNull: true },
  content_author_name: { type: DataTypes.STRING(100), allowNull: true },
  content_author_role: { type: DataTypes.STRING(20), allowNull: true },

  reason: { type: DataTypes.ENUM(...REASONS), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: false },

  reporter_id: { type: DataTypes.UUID, allowNull: false },
  reporter_role: { type: DataTypes.ENUM('user', 'admin', 'super_admin'), allowNull: false },
  reporter_name: { type: DataTypes.STRING(100), allowNull: true },
  /** Routes an announcement report to that zone's admin. */
  reporter_zone: { type: DataTypes.STRING(32), allowNull: true },

  status: {
    type: DataTypes.ENUM('pending', 'action_taken', 'dismissed'),
    allowNull: false,
    defaultValue: 'pending',
  },
  content_removed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  /** Shown to the reporter on their My Reports page. */
  reviewer_note: { type: DataTypes.TEXT, allowNull: true },
  reviewed_by_name: { type: DataTypes.STRING(100), allowNull: true },
  reviewed_by_role: { type: DataTypes.STRING(20), allowNull: true },
  reviewed_at: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'content_reports',
  timestamps: true,
  underscored: true,
  indexes: [
    { unique: true, fields: ['target_type', 'target_id', 'reporter_id'], name: 'content_reports_once' },
    { fields: ['status'] },
    { fields: ['target_type', 'status'] },
  ],
});

ContentReport.REASONS = REASONS;

module.exports = ContentReport;
