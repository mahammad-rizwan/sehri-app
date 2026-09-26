/** Report reasons. Keys match ContentReport.REASONS on the server. */
export const REPORT_REASONS = [
  { key: 'inappropriate', label: 'Inappropriate content', hint: 'Offensive, vulgar or not suitable here' },
  { key: 'violence', label: 'Violence or threats', hint: 'Threatens or encourages harm' },
  { key: 'hate', label: 'Hate speech', hint: 'Attacks people for who they are' },
  { key: 'harassment', label: 'Harassment or bullying', hint: 'Targets or insults someone' },
  { key: 'spam', label: 'Spam or misleading', hint: 'Irrelevant, repeated or a scam' },
  { key: 'misinformation', label: 'False information', hint: 'Wrong timings, fake news' },
  { key: 'other', label: 'Something else', hint: 'Explain in the description' },
] as const;

export type ReportReason = typeof REPORT_REASONS[number]['key'];
export type ReportStatus = 'pending' | 'action_taken' | 'dismissed';

export const REPORT_STATUS: Record<ReportStatus, { label: string; color: string; icon: string }> = {
  pending: { label: 'Under review', color: '#FF9800', icon: 'time-outline' },
  action_taken: { label: 'Action taken', color: '#4CAF50', icon: 'checkmark-circle-outline' },
  dismissed: { label: 'No violation found', color: '#8899AA', icon: 'remove-circle-outline' },
};

/** Minimum description length — mirrors the server's check. */
export const REPORT_DESC_MIN = 10;
