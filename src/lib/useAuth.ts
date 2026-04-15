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

            const data = await res.json();
            if (!res.ok) {
                onToast?.(data.message || 'Logout failed', 'error');
                return false;
            }

            onToast?.(data.message || 'Logged out successfully', 'success');
            clearAdminSidebarSession();
            router.replace('/login');
            return true;
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : 'Network error';
            onToast?.(errMsg, 'error');
            return false;
        }
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
