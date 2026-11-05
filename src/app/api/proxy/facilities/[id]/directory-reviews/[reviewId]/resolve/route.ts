import { NextRequest } from 'next/server';
import { forwardToApi } from '@/lib/proxy-forward';

// POST /facilities/{id}/directory-reviews/{review_id}/resolve
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; reviewId: string }> },
) {
    const { id, reviewId } = await params;
    return forwardToApi(req, {
        path: `facilities/${encodeURIComponent(id)}/directory-reviews/${encodeURIComponent(reviewId)}/resolve`,
        method: 'POST',
    });
}
