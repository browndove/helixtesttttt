/** Proxy endpoints the analytics section calls (all served by Helix's /api/proxy routes). */
export const API_ENDPOINTS = {
    AUTH_ME: `/api/proxy/auth/me`,
    LOGOUT: `/api/proxy/auth/logout`,
    FACILITIES: `/api/proxy/facilities`,
    INTERNAL_FACILITIES: `/api/proxy/internal/facilities`,
    INTERNAL_ACT_AS: `/api/proxy/internal/act-as`,
    INTERNAL_EXIT_ACT_AS: `/api/proxy/internal/exit-act-as`,
    USAGE_METRICS: `/api/proxy/usage-metrics`,
    FEATURE_USAGE_METRICS: `/api/proxy/feature-usage-metrics`,
};
