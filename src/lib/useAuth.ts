import { useRouter } from 'next/navigation';
import { API_ENDPOINTS } from '@/lib/config';
import { clearAdminSidebarSession } from '@/lib/facilityDisplayCache';

export function useAuth() {
    const router = useRouter();

    const logout = async (onToast?: (message: string, type: 'success' | 'error') => void) => {
        try {
            const res = await fetch(API_ENDPOINTS.LOGOUT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });

            let data: { message?: string; error?: string } = {};
            try {
                data = await res.json();
            } catch {
                /* ignore non-JSON */
            }
            if (res.ok) {
                onToast?.(data.message || 'Logged out successfully', 'success');
            } else {
                onToast?.(data.message || data.error || 'Session cleared', 'error');
            }
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : 'Network error';
            onToast?.(errMsg, 'error');
        } finally {
            clearAdminSidebarSession();
            // Full navigation so we always leave the admin shell and land on login, even if the API errored.
            if (typeof window !== 'undefined') {
                window.location.assign('/login');
            } else {
                router.replace('/login');
            }
        }
        return true;
    };

    const changePassword = async (
        currentPassword: string,
        newPassword: string,
        onToast?: (message: string, type: 'success' | 'error') => void
    ) => {
        try {
            const res = await fetch(API_ENDPOINTS.CHANGE_PASSWORD, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
            });

            const data = await res.json();
            if (!res.ok) {
                onToast?.(data.message || 'Failed to change password', 'error');
                return false;
            }

            onToast?.(data.message || 'Password changed successfully', 'success');
            return true;
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : 'Network error';
            onToast?.(errMsg, 'error');
            return false;
        }
    };

    const renewToken = async (onToast?: (message: string, type: 'success' | 'error') => void) => {
        try {
            const res = await fetch(API_ENDPOINTS.RENEW, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });

            const data = await res.json();
            if (!res.ok) {
                onToast?.(data.message || 'Failed to renew token', 'error');
                return false;
            }

            onToast?.(data.message || 'Token renewed', 'success');
            return true;
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : 'Network error';
            onToast?.(errMsg, 'error');
            return false;
        }
    };

    return { logout, changePassword, renewToken };
}
