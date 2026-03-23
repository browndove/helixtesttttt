import { getProxyHeaders } from '@/lib/proxy-auth';
import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

type RoleUpdateBody = {
    priority?: string;
    mandatory?: boolean;
    department_id?: string;
    [key: string]: unknown;
};

function normalizePriority(priority?: string): 'critical' | 'standard' {
    return priority?.trim().toLowerCase() === 'critical' ? 'critical' : 'standard';
}

function resolvePriority(body: RoleUpdateBody): 'critical' | 'standard' {
    if (typeof body.mandatory === 'boolean') {
        return body.mandatory ? 'critical' : 'standard';
    }
    return normalizePriority(body.priority);
}

// GET /roles/{id} - Get a role
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const url = `${API_BASE_URL}/api/v1/roles/${id}`;

        console.log('Proxy get role request to:', url);

        const res = await fetch(url, {
            method: 'GET',
            headers: getProxyHeaders(req),
        });

        const text = await res.text();
        console.log('Backend response status:', res.status);

        let data;
        try {
            data = JSON.parse(text);
        } catch {
            console.error('Failed to parse backend response as JSON');
            return NextResponse.json(
                { error: 'Backend returned invalid response', details: text.substring(0, 200) },
                { status: 502 }
            );
        }

        return NextResponse.json(data, { status: res.status });
    } catch (err) {
        console.error('Proxy error:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Proxy error', details: message }, { status: 500 });
    }
}

// PUT /roles/{id} - Update a role
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await req.json() as RoleUpdateBody;
        // Forward supported editable fields for role updates.
        const payload: Record<string, unknown> = {};
        if (body.name !== undefined) payload.name = body.name;
        if (body.description !== undefined) payload.description = body.description;
        if (body.department_id !== undefined) payload.department_id = body.department_id;
        if (Object.prototype.hasOwnProperty.call(body, 'mandatory') || Object.prototype.hasOwnProperty.call(body, 'priority')) {
            payload.priority = resolvePriority(body);
        }
        const url = `${API_BASE_URL}/api/v1/roles/${id}`;

        console.log('Proxy update role request to:', url);

        const res = await fetch(url, {
            method: 'PUT',
            headers: getProxyHeaders(req),
            body: JSON.stringify(payload),
        });

        const text = await res.text();
        console.log('Backend response status:', res.status);

        let data;
        try {
            data = JSON.parse(text);
        } catch {
            console.error('Failed to parse backend response as JSON');
            return NextResponse.json(
                { error: 'Backend returned invalid response', details: text.substring(0, 200) },
                { status: 502 }
            );
        }

        return NextResponse.json(data, { status: res.status });
    } catch (err) {
        console.error('Proxy error:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Proxy error', details: message }, { status: 500 });
    }
}

// DELETE /roles/{id} - Delete a role
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const url = `${API_BASE_URL}/api/v1/roles/${id}`;

        console.log('Proxy delete role request to:', url);

        const res = await fetch(url, {
            method: 'DELETE',
            headers: getProxyHeaders(req),
        });

        const text = await res.text();
        console.log('Backend response status:', res.status);

        let data;
        try {
            data = JSON.parse(text);
        } catch {
            console.error('Failed to parse backend response as JSON');
            return NextResponse.json(
                { error: 'Backend returned invalid response', details: text.substring(0, 200) },
                { status: 502 }
            );
        }

        return NextResponse.json(data, { status: res.status });
    } catch (err) {
        console.error('Proxy error:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Proxy error', details: message }, { status: 500 });
    }
}
