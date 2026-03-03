export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

export const API_ENDPOINTS = {
  // Auth endpoints - use local proxy to avoid CORS
  LOGIN: `/api/proxy/auth/login`,
  LOGOUT: `/api/proxy/auth/logout`,
  CHANGE_PASSWORD: `/api/proxy/auth/change-password`,
  RENEW: `/api/proxy/auth/renew`,
  REQUEST_RESET: `/api/proxy/auth/request-reset`,
  RESET_PASSWORD: `/api/proxy/auth/reset-password`,
  SEND_OTP: `/api/proxy/auth/send-otp`,
  VERIFY_OTP: `/api/proxy/auth/verify-otp`,
  SETUP: `/api/proxy/auth/setup`,
  ADMIN_RESET: (staffId: string) => `/api/proxy/auth/admin-reset/${staffId}`,

  // Departments
  DEPARTMENTS: `/api/proxy/departments`,
  DEPARTMENT: (id: string) => `/api/proxy/departments/${id}`,
  DEPARTMENT_FLOORS: (id: string) => `/api/proxy/departments/${id}/floors`,
  DEPARTMENT_WARDS: (id: string) => `/api/proxy/departments/${id}/wards`,

  // Hospital
  HOSPITAL: `/api/proxy/hospital`,

  // Roles
  ROLES: `/api/proxy/roles`,
  ROLE: (id: string) => `/api/proxy/roles/${id}`,

  // Escalation Policies
  ESCALATION_POLICIES: `/api/proxy/escalation-policies`,
  ESCALATION_POLICY: (id: string) => `/api/proxy/escalation-policies/${id}`,
  ESCALATION_POLICY_BY_ROLE: (roleId: string) => `/api/proxy/escalation-policies/by-role/${roleId}`,
  ESCALATION_POLICY_STEPS: (id: string) => `/api/proxy/escalation-policies/${id}/steps`,
  ESCALATION_POLICY_STEPS_BULK: (id: string) => `/api/proxy/escalation-policies/${id}/steps/bulk`,
  ESCALATION_POLICY_STEP: (id: string, stepId: string) => `/api/proxy/escalation-policies/${id}/steps/${stepId}`,
};
