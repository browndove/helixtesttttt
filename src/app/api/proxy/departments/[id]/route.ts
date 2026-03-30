import { getProxyHeaders } from '@/lib/proxy-auth';
import { DEPARTMENT_DESCRIPTION_MAX_LENGTH, DEPARTMENT_NAME_MAX_LENGTH } from '@/lib/departmentName';
import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

// GET /departments/{id} - Get a department
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const url = `${API_BASE_URL}/api/v1/departments/${id}`;

        console.log('Proxy get department request to:', url);

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

// PUT /departments/{id} - Update a department
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await req.json() as Record<string, unknown>;
        if (typeof body.name === 'string' && body.name.trim().length > DEPARTMENT_NAME_MAX_LENGTH) {
            return NextResponse.json(
                { error: `Department name must be ${DEPARTMENT_NAME_MAX_LENGTH} characters or fewer` },
                { status: 400 }
            );
        }
        if (typeof body.description === 'string' && body.description.length > DEPARTMENT_DESCRIPTION_MAX_LENGTH) {
            return NextResponse.json(
                { error: `Description must be ${DEPARTMENT_DESCRIPTION_MAX_LENGTH} characters or fewer` },
                { status: 400 }
            );
        }
        const url = `${API_BASE_URL}/api/v1/departments/${id}`;

        console.log('Proxy update department request to:', url);

        const res = await fetch(url, {
            method: 'PUT',
            headers: getProxyHeaders(req),
            body: JSON.stringify(body as object),
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

// DELETE /departments/{id} - Delete a department
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const url = `${API_BASE_URL}/api/v1/departments/${id}`;

        console.log('Proxy delete department request to:', url);

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
