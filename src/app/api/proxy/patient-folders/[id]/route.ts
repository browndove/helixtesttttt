import { getProxyHeaders } from '@/lib/proxy-auth';
import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

type UpdateFolderBody = {
    name?: string;
    description?: string;
};

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const res = await fetch(`${API_BASE_URL}/api/v1/patient-folders/${id}`, {
            method: 'GET',
            headers: getProxyHeaders(req),
        });
        const text = await res.text();
        let data: unknown;
        try {
            data = JSON.parse(text);
        } catch {
            return NextResponse.json({ error: 'Backend returned invalid response', details: text.substring(0, 200) }, { status: 502 });
        }
        return NextResponse.json(data, { status: res.status });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Proxy error', details: message }, { status: 500 });
    }
}

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await req.json() as UpdateFolderBody;
        const payload = {
            name: body.name?.trim(),
            description: body.description?.trim() || undefined,
        };
        const res = await fetch(`${API_BASE_URL}/api/v1/patient-folders/${id}`, {
            method: 'PUT',
            headers: getProxyHeaders(req),
            body: JSON.stringify(payload),
        });
        const text = await res.text();
        let data: unknown;
        try {
            data = JSON.parse(text);
        } catch {
            return NextResponse.json({ error: 'Backend returned invalid response', details: text.substring(0, 200) }, { status: 502 });
        }
        return NextResponse.json(data, { status: res.status });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Proxy error', details: message }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const res = await fetch(`${API_BASE_URL}/api/v1/patient-folders/${id}`, {
            method: 'DELETE',
            headers: getProxyHeaders(req),
        });
        // 204 must not include a body; NextResponse.json would error and surface as 500.
        if (res.status === 204 || res.status === 205) {
            return new NextResponse(null, { status: res.status });
        }
        const text = await res.text();
        let data: unknown = {};
        if (text.trim()) {
            try {
                data = JSON.parse(text);
            } catch {
                return NextResponse.json({ error: 'Backend returned invalid response', details: text.substring(0, 200) }, { status: 502 });
            }
        }
        return NextResponse.json(data, { status: res.status });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Proxy error', details: message }, { status: 500 });
    }
}

