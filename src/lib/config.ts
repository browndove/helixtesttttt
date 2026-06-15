export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');

export const API_ENDPOINTS = {
  // Auth endpoints - use local proxy to avoid CORS
  LOGIN: `/api/proxy/auth/login`,
  ADMIN_LOGIN: `/api/proxy/auth/admin/login`,
  INTERNAL_LOGIN: `/api/proxy/auth/internal/login`,
  INTERNAL_VERIFY_OTP: `/api/proxy/auth/internal/verify-otp`,
  LOGOUT: `/api/proxy/auth/logout`,
  CHANGE_PASSWORD: `/api/proxy/auth/change-password`,
  RENEW: `/api/proxy/auth/renew`,
  REQUEST_RESET: `/api/proxy/auth/request-reset`,
  VERIFY_RESET_OTP: `/api/proxy/auth/verify-reset-otp`,
  RESET_PASSWORD: `/api/proxy/auth/reset-password`,
  SEND_OTP: `/api/proxy/auth/send-otp`,
  VERIFY_OTP: `/api/proxy/auth/admin/verify-otp`,
  ADMIN_VERIFY_OTP: `/api/proxy/auth/admin/verify-otp`,
  SETUP: `/api/proxy/auth/setup`,
  SETUP_PREFILL: `/api/proxy/auth/setup-prefill`,
  SETUP_PHONE_REQUEST_OTP: `/api/proxy/auth/setup/phone/request-otp`,
  SETUP_PHONE_VERIFY: `/api/proxy/auth/setup/phone/verify`,
  /** Magic-link staff phone update (public; token in query/body). */
  STAFF_PHONE_UPDATE_PREFILL: `/api/proxy/auth/staff-phone-update/prefill`,
  STAFF_PHONE_UPDATE_REQUEST_OTP: `/api/proxy/auth/staff-phone-update/request-otp`,
  STAFF_PHONE_UPDATE_CONFIRM: `/api/proxy/auth/staff-phone-update/confirm`,
  /** Facility admin: notify staff to update phone via magic link. */
  STAFF_REQUEST_PHONE_UPDATE: (staffId: string) => `/api/proxy/staff/${staffId}/request-phone-update`,
  /** Facility admin: remote wipe Helix mobile app data on all user devices. */
  STAFF_REMOTE_WIPE: (staffId: string) => `/api/proxy/staff/${staffId}/remote-wipe`,
  /** Facility admin: send account-setup invite emails (explicit; not sent on create/bulk). */
  STAFF_SEND_INVITE_EMAILS: `/api/proxy/staff/send-invite-emails`,
  ADMIN_RESET: (staffId: string) => `/api/proxy/auth/admin-reset/${staffId}`,
  AUTH_ME: `/api/proxy/auth/me`,
  AUTH_USER: `/api/proxy/auth/user`,
  AUTH_SETTINGS: `/api/proxy/auth/settings`,
  AUTH_SESSIONS: `/api/proxy/auth/sessions`,
  AUTH_SESSION: (sessionId: string) => `/api/proxy/auth/sessions/${sessionId}`,
  INTERNAL_FACILITIES: `/api/proxy/internal/facilities`,
  INTERNAL_ACT_AS: `/api/proxy/internal/act-as`,
  INTERNAL_EXIT_ACT_AS: `/api/proxy/internal/exit-act-as`,
  INTERNAL_AUDIT: `/api/proxy/internal/audit`,

  // Departments
  DEPARTMENTS: `/api/proxy/departments`,
  DEPARTMENT: (id: string) => `/api/proxy/departments/${id}`,
  DEPARTMENT_WARDS: (id: string) => `/api/proxy/departments/${id}/wards`,

  // Hospital
  HOSPITAL: `/api/proxy/hospital`,
  FACILITIES: `/api/proxy/facilities`,
  FACILITY: (id: string) => `/api/proxy/facilities/${id}`,

  // Presence
  /** Proxies GET /api/v1/presence/online — pass ?client=admin|app. */
  PRESENCE_ONLINE: `/api/proxy/presence/online`,
  /** Returns WebSocket URL for GET /api/v1/ws (session token from cookie). */
  PRESENCE_WS_URL: `/api/proxy/presence/ws-url`,

  // Roles
  ROLES: `/api/proxy/roles`,
  ROLE: (id: string) => `/api/proxy/roles/${id}`,
  ROLE_SIGN_IN_USER: (id: string) => `/api/proxy/roles/${id}/sign-in-user`,

  // Escalation Policies
  // Staff Invites
  STAFF_INVITES: `/api/proxy/staff/invites`,
  STAFF_INVITE_ACTIONS: `/api/proxy/staff/invites/actions`,

  ESCALATION_POLICIES: `/api/proxy/escalation-policies`,
  ESCALATION_POLICY: (id: string) => `/api/proxy/escalation-policies/${id}`,
  ESCALATION_POLICY_BY_ROLE: (roleId: string) => `/api/proxy/escalation-policies/by-role/${roleId}`,
  ESCALATION_POLICY_STEPS: (id: string) => `/api/proxy/escalation-policies/${id}/steps`,
  ESCALATION_POLICY_STEPS_BULK: (id: string) => `/api/proxy/escalation-policies/${id}/steps/bulk`,
  ESCALATION_POLICY_STEP: (id: string, stepId: string) => `/api/proxy/escalation-policies/${id}/steps/${stepId}`,
};
