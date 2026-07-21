import { NextRequest, NextResponse } from 'next/server';

const AI_BASE_URL = (process.env.HELIX_AI_BASE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');

export type AskAiQueryResponse = {
    answer: string | null;
    confidence: number | null;
    matched: boolean;
    matched_question?: string | null;
    id?: string | null;
    document_id?: string | null;
    fallback?: string | null;
};

// POST /api/proxy/ask-ai/query — proxy to Helix Retrieval QA (local)
export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const question = typeof body?.question === 'string' ? body.question.trim() : '';

        if (!question) {
            return NextResponse.json({ error: 'question is required' }, { status: 400 });
        }

        const payload = {
            question,
            // Always empty for admin testing — search across all docs
            document_id: '',
            ...(typeof body?.threshold === 'number' ? { threshold: body.threshold } : {}),
        };

        const res = await fetch(`${AI_BASE_URL}/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(payload),
            cache: 'no-store',
        });

        const text = await res.text();
        let data: AskAiQueryResponse | { error?: string; detail?: unknown };
        try {
            data = JSON.parse(text);
        } catch {
            return NextResponse.json(
                { error: 'AI service returned invalid response', details: text.slice(0, 200) },
                { status: 502 },
            );
        }

        if (!res.ok) {
            return NextResponse.json(
                { error: 'AI query failed', details: data },
                { status: res.status },
            );
        }

        return NextResponse.json(data, { status: 200 });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('[ask-ai] Proxy error:', err);
        return NextResponse.json(
            {
                error: 'Unable to reach Helix AI. Is it running on ' + AI_BASE_URL + '?',
                details: message,
            },
            { status: 502 },
        );
    }
}
