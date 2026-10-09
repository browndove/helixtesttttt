import { NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

function jsonWithSessionCleared(body: unknown, init: { status: number }) {
    const response = NextResponse.json(body, init);
    response.cookies.delete('helix-session');
    response.cookies.delete('helix-facility');
    return response;
}

export async function POST() {
    try {
        const url = `${API_BASE_URL}/api/v1/auth/logout`;
        
        console.log('Proxy logout request to:', url);
        
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });

        const text = await res.text();
        console.log('Backend response status:', res.status);
        
        let data;
        try {
            data = JSON.parse(text);
        } catch {
            console.error('Failed to parse backend response as JSON');
            return jsonWithSessionCleared(
                { error: 'Backend returned invalid response', details: text.substring(0, 200) },
                { status: 502 },
            );
        }
        
        return jsonWithSessionCleared(data, { status: res.status });
    } catch (err) {
        console.error('Proxy error:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        return jsonWithSessionCleared({ error: 'Proxy error', details: message }, { status: 500 });
    }
}
