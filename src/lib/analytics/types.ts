/** Facility usage-metrics payload (GET /api/v1/facilities/{id}/usage-metrics). */
export interface AnalyticsData {
    active_users_count: number;
    active_users_rate_percent: number;
    registered_staff_count: number;
    total_messages: number;
    critical_messages: number;
    critical_messages_rate_percent: number;
    standard_messages: number;
    escalation_rate_percent: number;
    escalated_critical_messages: number;
    escalation_rate_of_total_messages_percent: number;
    critical_messages_read_percent?: number;
    critical_messages_acknowledged_percent?: number;
    role_fill_rate_percent: number;
    filled_roles: number;
    total_roles: number;
    critical_role_fill_rate_percent: number;
    critical_filled_roles: number;
    critical_total_roles: number;
    avg_critical_ack_minutes: number;
    avg_first_read_minutes_all: number;
    avg_first_read_minutes_critical: number;
    avg_first_read_minutes_non_critical: number;
    avg_read_minutes_standard?: number;
    total_calls_made: number;
    total_missed_calls?: number;
    call_metrics?: {
        total_calls_made?: number;
        total_answered_calls?: number;
        total_unanswered_calls?: number;
        answer_rate_percent?: number;
        total_missed_calls?: number;
        answered?: {
            answered_calls?: number;
            avg_duration_seconds?: number;
            avg_duration_minutes?: number;
            min_duration_seconds?: number;
            q1_duration_seconds?: number;
            median_duration_seconds?: number;
            q3_duration_seconds?: number;
            max_duration_seconds?: number;
        };
        by_outbound_role?: {
            role_name: string;
            total_calls_made?: number;
            answered_calls?: number;
            unanswered_calls?: number;
        }[];
        by_outbound_department?: {
            department_name: string;
            total_calls_made?: number;
            answered_calls?: number;
            unanswered_calls?: number;
        }[];
        by_inbound_role?: {
            role_name: string;
            answered_calls?: number;
            missed_calls?: number;
        }[];
        by_inbound_department?: {
            department_name: string;
            answered_calls?: number;
            missed_calls?: number;
        }[];
    };
    by_outbound_role?: {
        role_name: string;
        total_calls_made?: number;
        answered_calls?: number;
        unanswered_calls?: number;
    }[];
    by_outbound_department?: {
        department_name: string;
        total_calls_made?: number;
        answered_calls?: number;
        unanswered_calls?: number;
    }[];
    window_days: number;
    avg_sign_in_minutes_since_midnight_utc: number;
    avg_sign_out_minutes_since_midnight_utc: number;
    daily_message_volume: { day: string; total_messages: number; critical_messages: number; standard_messages: number }[];
    department_metrics: {
        department_name: string;
        department_id?: string;
        role_fill_rate_percent: number;
        escalation_rate_vs_dept_critical_messages_percent: number;
        filled_roles: number;
        total_roles: number;
        critical_messages_sent: number;
        avg_critical_ack_minutes: number;
        avg_reply_response_minutes_all?: number;
        avg_reply_response_minutes_critical?: number;
        escalation_notifications: number;
        critical_filled_roles: number;
        critical_total_roles: number;
        critical_role_fill_rate_percent: number;
    }[];
    top_escalated_roles: { role_name: string; role_id: string; escalation_count: number }[];
    least_escalated_roles: { role_name: string; role_id: string; escalation_count: number }[];
    role_metrics?: { role_id: string; role_name: string; department_id: string; department_name: string; priority: string; filled: boolean; role_fill_rate_percent: number; critical_total_roles: number; critical_filled_roles: number; critical_role_fill_rate_percent: number; total_messages: number; total_calls_made: number; critical_messages: number; standard_messages: number; critical_messages_rate_percent: number; escalated_critical_messages: number; escalation_rate_percent: number; escalation_rate_of_total_messages_percent: number; avg_critical_ack_minutes: number; avg_reply_response_minutes_all: number; avg_reply_response_minutes_critical: number; avg_sign_in_minutes_since_midnight_utc?: number; avg_sign_out_minutes_since_midnight_utc?: number }[];
}
