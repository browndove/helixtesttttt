import { NextRequest } from 'next/server';
import { forwardToApi } from '@/lib/proxy-forward';

// POST /facilities/{id}/directory-reports/{report_id}/dismiss — { "status": "dismissed" }
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; reportId: string }> },
) {
    const { id, reportId } = await params;
    return forwardToApi(req, {
        path: `facilities/${encodeURIComponent(id)}/directory-reports/${encodeURIComponent(reportId)}/dismiss`,
        method: 'POST',
    });
}
