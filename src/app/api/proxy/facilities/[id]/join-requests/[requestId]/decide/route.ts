import { NextRequest } from 'next/server';
import { forwardToApi } from '@/lib/proxy-forward';

// POST /facilities/{id}/join-requests/{request_id}/decide — { decision: "approve" | "reject" }
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; requestId: string }> },
) {
    const { id, requestId } = await params;
    return forwardToApi(req, {
        path: `facilities/${encodeURIComponent(id)}/join-requests/${encodeURIComponent(requestId)}/decide`,
        method: 'POST',
    });
}
