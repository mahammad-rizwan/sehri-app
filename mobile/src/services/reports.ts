import api from './api';
import { ENDPOINTS } from '../constants/api';
import type { ReportReason, ReportStatus } from '../constants/reports';

export type ReportTarget = 'broadcast' | 'chat_message';

export async function submitReport(body: {
  target_type: ReportTarget;
  target_id: string;
  reason: ReportReason;
  description: string;
}) {
  const { data } = await api.post(ENDPOINTS.REPORTS, body);
  return data;
}

export type MyReport = {
  id: string;
  target_type: ReportTarget;
  reason: ReportReason;
  reason_label: string;
  description: string;
  content_snapshot: string;
  status: ReportStatus;
  content_removed: boolean;
  reviewer_note: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export async function fetchMyReports(): Promise<MyReport[]> {
  const { data } = await api.get(ENDPOINTS.MY_REPORTS);
  return data?.data || [];
}

export type ReviewReport = MyReport & {
  target_id: string;
  group_name: string | null;
  content_author_name: string | null;
  content_author_role: string | null;
  content_exists: boolean;
  reporter_name: string | null;
  reporter_role: string;
  reporter_zone: string | null;
  same_item_reports: number;
  reviewed_by_name: string | null;
  can_remove: boolean;
};

export async function fetchReports(type: ReportTarget, status: 'pending' | 'resolved' | 'all'): Promise<ReviewReport[]> {
  const { data } = await api.get(ENDPOINTS.REPORTS, { type, status });
  return data?.data || [];
}

export async function resolveReport(id: string, body: {
  decision: 'action_taken' | 'dismissed';
  remove_content?: boolean;
  note?: string;
}) {
  const { data } = await api.patch(ENDPOINTS.REPORT_ONE(id), body);
  return data;
}

export async function fetchPendingReports(): Promise<{ broadcast: number; chat_message: number; total: number }> {
  const { data } = await api.get(ENDPOINTS.REPORTS_PENDING);
  return data?.data || { broadcast: 0, chat_message: 0, total: 0 };
}
