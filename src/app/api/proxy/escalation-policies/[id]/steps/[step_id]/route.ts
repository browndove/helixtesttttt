import { getProxyHeaders } from '@/lib/proxy-auth';
import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

// DELETE /escalation-policies/{id}/steps/{step_id} - Remove a step
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; step_id: string }> }
) {
    try {
        const { id, step_id } = await params;
        const url = `${API_BASE_URL}/api/v1/escalation-policies/${id}/steps/${step_id}`;

        console.log('Proxy delete escalation step request to:', url);

        const res = await fetch(url, {
            method: 'DELETE',
            headers: getProxyHeaders(req),
        });

        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch {
            return NextResponse.json({ error: 'Backend returned invalid response', details: text.substring(0, 200) }, { status: 502 });
        }
        return NextResponse.json(data, { status: res.status });
    } catch (err) {
        console.error('Proxy error:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Proxy error', details: message }, { status: 500 });
    }
}
