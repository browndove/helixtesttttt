import { getProxyHeaders } from '@/lib/proxy-auth';
import { NextRequest, NextResponse } from 'next/server';
import { buildTenantUpstreamUrl, ensureFacilityOnUrl, mergeFacilityIntoBody } from '@/lib/proxy-upstream';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

// GET /escalation-policies - List escalation policies
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        let url = new URL(`${API_BASE_URL}/api/v1/escalation-policies`);
        const departmentId = searchParams.get('department_id');
        if (departmentId) url.searchParams.set('department_id', departmentId);

        const withFacility = await ensureFacilityOnUrl(req, API_BASE_URL, url);
        if (withFacility instanceof NextResponse) return withFacility;
        url = withFacility;

        console.log('[listPolicies] Request to:', url.toString());

        const res = await fetch(url.toString(), {
            method: 'GET',
            headers: getProxyHeaders(req),
        });

        const text = await res.text();
        console.log('[listPolicies] Response status:', res.status);
        console.log('[listPolicies] Response body (first 500):', text.substring(0, 500));

        let data;
        try {
            data = JSON.parse(text);
        } catch {
            return NextResponse.json(
                { error: 'Backend returned invalid response', details: text.substring(0, 200) },
                { status: 502 }
            );
        }

        // Ensure we always return an array — unwrap if wrapped in an object
        const policies = Array.isArray(data) ? data : (data?.items || data?.data || data?.policies || []);
        return NextResponse.json(policies, { status: res.status });
    } catch (err) {
        console.error('Proxy error:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Proxy error', details: message }, { status: 500 });
    }
}

// POST /escalation-policies - Create escalation policy
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const upstream = await buildTenantUpstreamUrl(req, API_BASE_URL, `/api/v1/escalation-policies`);

        if (upstream instanceof NextResponse) return upstream;

        const { url } = upstream;
        const payload = mergeFacilityIntoBody(
            body as Record<string, unknown>,
            upstream.facilityId,
        );
        console.log('[createPolicy] Payload:', JSON.stringify(body));
        console.log('[createPolicy] Request to:', url);

        const res = await fetch(url, {
            method: 'POST',
            headers: getProxyHeaders(req),
            body: JSON.stringify(payload),
        });

        const text = await res.text();
        console.log('[createPolicy] Response status:', res.status);
        if (!res.ok) console.log('[createPolicy] Error body:', text.substring(0, 500));

        let data;
        try {
            data = JSON.parse(text);
        } catch {
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
