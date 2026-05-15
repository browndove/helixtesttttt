import { getProxyHeaders } from '@/lib/proxy-auth';
import { NextRequest, NextResponse } from 'next/server';
import { buildTenantUpstreamUrl, mergeFacilityIntoBody } from '@/lib/proxy-upstream';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

type AddPatientBody = {
    patient_ids?: string[];
    patient_id?: string;
};

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await req.json() as AddPatientBody;
        const payload = {
            patient_ids: Array.isArray(body.patient_ids)
                ? body.patient_ids
                : (body.patient_id ? [body.patient_id] : []),
        };

        const upstream = await buildTenantUpstreamUrl(req, API_BASE_URL, `/api/v1/patient-folders/${id}/patients`);


        if (upstream instanceof NextResponse) return upstream;


        const { url } = upstream;


        const res = await fetch(url, {
            method: 'POST',
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

