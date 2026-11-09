import { NextRequest, NextResponse } from 'next/server';
import { getProxyHeaders } from '@/lib/proxy-auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

/** GET /facilities/critical-alert-sounds — facility critical alert tone choices */
export async function GET(req: NextRequest) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/v1/facilities/critical-alert-sounds`, {
            method: 'GET',
            headers: getProxyHeaders(req),
            cache: 'no-store',
        });
        const text = await res.text();
        let data: unknown;
        try {
            data = text ? JSON.parse(text) : [];
        } catch {
            return NextResponse.json(
                { error: 'Backend returned invalid response', details: text.substring(0, 200) },
                { status: 502 },
            );
        }
        return NextResponse.json(data, { status: res.status });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Proxy error', details: message }, { status: 500 });
    }
}
