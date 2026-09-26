const User = require('./User');
const Admin = require('./Admin');
const SuperAdmin = require('./SuperAdmin');
const OTP = require('./OTP');
const Poll = require('./Poll');
const PollResponse = require('./PollResponse');
const Donation = require('./Donation');
const Feedback = require('./Feedback');
const Tracking = require('./Tracking');
const SyncState = require('./SyncState');
const BroadcastMessage = require('./BroadcastMessage');
const AppSetting = require('./AppSetting');
const ZoneAddress = require('./ZoneAddress');
const MapMarker = require('./MapMarker');
const DeliveryAlert = require('./DeliveryAlert');
const DeliveryRoute = require('./DeliveryRoute');
const DeliveryStop = require('./DeliveryStop');
const ContentReport = require('./ContentReport');
const ProfileEditRequest = require('./ProfileEditRequest');
const ChatGroup = require('./ChatGroup');
const ChatGroupMember = require('./ChatGroupMember');
const ChatMessage = require('./ChatMessage');
const PrayerTiming = require('./PrayerTiming');

// Associations — regular users have poll responses, donations, feedback, profile edits
User.hasMany(PollResponse, { foreignKey: 'user_id' });
PollResponse.belongsTo(User, { foreignKey: 'user_id' });

Poll.hasMany(PollResponse, { foreignKey: 'poll_id' });
PollResponse.belongsTo(Poll, { foreignKey: 'poll_id' });

User.hasMany(Donation, { foreignKey: 'user_id' });
Donation.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(Feedback, { foreignKey: 'user_id' });
Feedback.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(ProfileEditRequest, { foreignKey: 'user_id' });
ProfileEditRequest.belongsTo(User, { foreignKey: 'user_id' });

// Chat associations
ChatGroup.hasMany(ChatGroupMember, { foreignKey: 'group_id', onDelete: 'CASCADE' });
ChatGroupMember.belongsTo(ChatGroup, { foreignKey: 'group_id' });

ChatGroup.hasMany(ChatMessage, { foreignKey: 'group_id', onDelete: 'CASCADE' });
ChatMessage.belongsTo(ChatGroup, { foreignKey: 'group_id' });

module.exports = {
  User,
  Admin,
  SuperAdmin,
  OTP,
  Poll,
  PollResponse,
  Donation,
  Feedback,
  Tracking,
  SyncState,
  BroadcastMessage,
  AppSetting,
  ZoneAddress,
  MapMarker,
  DeliveryAlert,
  DeliveryRoute,
  DeliveryStop,
  ContentReport,
  ProfileEditRequest,
  ChatGroup,
  ChatGroupMember,
  ChatMessage,
  PrayerTiming,
};
