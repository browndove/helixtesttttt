import { NextRequest, NextResponse } from 'next/server';
import { getInternalTokenFromCookie, getTokenFromCookie } from '@/lib/proxy-auth';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');

const ALLOWED_DOCUMENT_IDS = new Set([
    'helix-faq',
    'helix-howto',
    'helix-glossary',
    'ghana-eml-2017',
    'ghana-stg-2017',
]);

export type AskAiQueryResponse = {
    answer: string | null;
    confidence: number | null;
    matched: boolean;
    matched_question?: string | null;
    id?: string | null;
    document_id?: string | null;
    fallback?: string | null;
    intent?: string | null;
};

// POST /api/proxy/ask-ai/query → POST /api/v1/documentation/query (Go Retrieval QA proxy)
export async function POST(req: NextRequest) {
    try {
        const token = getTokenFromCookie(req) || getInternalTokenFromCookie(req);
        if (!token) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const body = await req.json().catch(() => ({}));
        const question = typeof body?.question === 'string' ? body.question.trim() : '';

        if (!question) {
            return NextResponse.json({ error: 'question is required' }, { status: 400 });
        }

        const payload: Record<string, unknown> = { question };

        const rawDocId = typeof body?.document_id === 'string' ? body.document_id.trim() : '';
        if (rawDocId) {
            if (!ALLOWED_DOCUMENT_IDS.has(rawDocId)) {
                return NextResponse.json({ error: 'Invalid document_id' }, { status: 400 });
            }
            payload.document_id = rawDocId;
        }

        if (typeof body?.threshold === 'number' && Number.isFinite(body.threshold)) {
            payload.threshold = body.threshold;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15_000);

        let res: Response;
        try {
            res = await fetch(`${API_BASE_URL}/api/v1/documentation/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
                cache: 'no-store',
                signal: controller.signal,
            });
        } finally {
            clearTimeout(timeout);
        }

        const text = await res.text();
        let data: AskAiQueryResponse | { error?: string; message?: string; detail?: unknown };
        try {
            data = text ? JSON.parse(text) : {};
        } catch {
            return NextResponse.json(
                { error: 'Documentation query returned invalid response', details: text.slice(0, 200) },
                { status: 502 },
            );
        }

        if (!res.ok) {
            const errMsg =
                (typeof data === 'object' && data && 'error' in data && data.error) ||
                (typeof data === 'object' && data && 'message' in data && data.message) ||
                (res.status === 503
                    ? 'Retrieval QA is not configured or still starting. Retry shortly.'
                    : 'Documentation query failed');
            return NextResponse.json(
                { error: String(errMsg), details: data },
                { status: res.status },
            );
        }

        return NextResponse.json(data, { status: 200 });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        const aborted = err instanceof Error && err.name === 'AbortError';
        console.error('[ask-ai] Proxy error:', err);
        return NextResponse.json(
            {
                error: aborted
                    ? 'Documentation query timed out. Please try again.'
                    : 'Unable to reach documentation query API.',
                details: message,
            },
            { status: 502 },
        );
    }
}
