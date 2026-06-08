import type { NextRequest } from 'next/server';
import { getProxyHeaders } from '@/lib/proxy-auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

export async function resolveDepartmentIdByName(
    req: NextRequest,
    facilityId: string,
    departmentName?: string
): Promise<string | undefined> {
    if (!departmentName?.trim()) {
        return undefined;
    }

    try {
        const url = new URL(`${API_BASE_URL}/api/v1/departments`);
        url.searchParams.set('facility_id', facilityId);

        const res = await fetch(url.toString(), {
            method: 'GET',
            headers: getProxyHeaders(req),
        });
        if (!res.ok) return undefined;

        const data: unknown = await res.json();
        const list = Array.isArray(data)
            ? data
            : (data && typeof data === 'object'
                ? ((data as { items?: unknown; data?: unknown; departments?: unknown }).items
                    || (data as { items?: unknown; data?: unknown; departments?: unknown }).data
                    || (data as { items?: unknown; data?: unknown; departments?: unknown }).departments)
                : []);
        if (!Array.isArray(list)) return undefined;

        const normalizedName = departmentName.trim().toLowerCase();
        const matched = list.find((item: unknown) => {
            if (!item || typeof item !== 'object') return false;
            const rec = item as { name?: string; department_name?: string };
            const name = (rec.name || rec.department_name || '').trim().toLowerCase();
            return name === normalizedName;
        }) as { id?: string; department_id?: string } | undefined;

        return matched?.id || matched?.department_id;
    } catch {
        return undefined;
    }
}
