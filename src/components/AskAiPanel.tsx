'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { API_ENDPOINTS } from '@/lib/config';
import './ask-ai.css';

type StructuredAnswer = {
    paragraphs: string[];
    steps: string[];
    tips: string[];
};

type Message = {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    content?: StructuredAnswer;
    matchedQuestion?: string;
    confidence?: number;
    pending?: boolean;
    error?: boolean;
};

type AskAiResponse = {
    answer?: string | null;
    confidence?: number | null;
    matched?: boolean;
    matched_question?: string | null;
    fallback?: string | null;
    error?: string;
    details?: unknown;
};

function itemText(item: unknown): string {
    if (typeof item === 'string') return item.trim();
    if (item && typeof item === 'object' && 'text' in item) {
        const text = (item as { text?: unknown }).text;
        return typeof text === 'string' ? text.trim() : '';
    }
    return '';
}

function parseHowtoObject(value: unknown): StructuredAnswer | null {
    if (!value || typeof value !== 'object') return null;
    const obj = value as { steps?: unknown; tips?: unknown };
    const steps = Array.isArray(obj.steps) ? obj.steps.map(itemText).filter(Boolean) : [];
    const tips = Array.isArray(obj.tips) ? obj.tips.map(itemText).filter(Boolean) : [];
    if (!steps.length && !tips.length) return null;
    return { paragraphs: [], steps, tips };
}

/** Recover lists from "Steps: 1. ... 2. ... Tips: • ..." text (including jammed one-liners). */
function parseHowtoPlainText(source: string): StructuredAnswer | null {
    const normalized = source.replace(/\r\n/g, '\n').trim();
    const hasStepsLabel = /^steps:\s*/i.test(normalized) || /\n\s*steps:\s*/i.test(normalized);
    const hasNumbered = /\d+\.\s+\S/.test(normalized);
    if (!hasStepsLabel && !hasNumbered) return null;

    let stepsBlock = normalized;
    let tipsBlock = '';

    const tipsSplit = normalized.split(/\n\s*Tips:\s*/i);
    if (tipsSplit.length > 1) {
        stepsBlock = tipsSplit[0];
        tipsBlock = tipsSplit.slice(1).join('\n');
    } else {
        const inlineTips = normalized.match(/\bTips:\s*([•\-\*].*)$/i);
        if (inlineTips) {
            stepsBlock = normalized.slice(0, inlineTips.index);
            tipsBlock = inlineTips[1];
        }
    }

    stepsBlock = stepsBlock.replace(/^\s*Steps:\s*/i, '').trim();

    let steps = [...stepsBlock.matchAll(/(?:^|\n)\s*\d+\.\s+([^\n]+)/g)]
        .map((m) => m[1].trim())
        .filter(Boolean);

    if (steps.length <= 1) {
        steps = [...stepsBlock.matchAll(/\d+\.\s+(.+?)(?=\s+\d+\.|$)/g)]
            .map((m) => m[1].trim())
            .filter(Boolean);
    }

    const tips: string[] = [];
    if (tipsBlock.trim()) {
        const tipLines = tipsBlock
            .split(/\n|(?=•)/)
            .map((line) => line.replace(/^\s*[•\-\*]\s*/, '').trim())
            .filter(Boolean);
        tips.push(...tipLines);
    }

    if (!steps.length && !tips.length) return null;
    return { paragraphs: [], steps, tips };
}

function parseAnswer(raw: unknown, fallback?: unknown): StructuredAnswer {
    const asHowto = parseHowtoObject(raw);
    if (asHowto) return asHowto;

    const source =
        (typeof raw === 'string' && raw.trim()) ||
        (typeof fallback === 'string' && fallback.trim()) ||
        '';
    if (!source) {
        return { paragraphs: ["I don't have an answer for that yet."], steps: [], tips: [] };
    }

    if (source.startsWith('{') || source.startsWith('[')) {
        try {
            const parsed = JSON.parse(source) as unknown;
            const howto = parseHowtoObject(parsed);
            if (howto) return howto;
        } catch {
            // fall through
        }
    }

    const fromPlain = parseHowtoPlainText(source);
    if (fromPlain) return fromPlain;

    const paragraphs = source
        .split(/\n{2,}/)
        .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
        // Fix awkward FAQ punctuation like "tools-such as" / "SMS-with"
        .map((p) => p.replace(/-(such as|with)\b/gi, ' — $1'))
        .filter(Boolean);

    return {
        paragraphs: paragraphs.length ? paragraphs : [source],
        steps: [],
        tips: [],
    };
}

type ProseEnrichment = {
    lead: string;
    rest: string[];
    audiences: string[];
    replaces: string[];
    traits: string[];
};

function splitList(chunk: string): string[] {
    return chunk
        .split(/,|\band\b/i)
        .map((part) => part.replace(/^[\s—\-]+|[\s—.]+$/g, '').trim())
        .filter((part) => part.length > 1 && part.length < 48);
}

function enrichProse(paragraphs: string[]): ProseEnrichment {
    const full = paragraphs.join(' ').replace(/\s+/g, ' ').trim();
    const sentenceMatch = full.match(/^(.+?[.!?])(?:\s+|$)/);
    const lead = sentenceMatch?.[1]?.trim() || paragraphs[0] || '';
    const restText = full.slice(lead.length).trim();
    const rest = restText
        ? restText.split(/(?<=[.!?])\s+(?=[A-Z])/).map((s) => s.trim()).filter(Boolean)
        : paragraphs.slice(1);

    const audiences: string[] = [];
    const enables = full.match(/enables\s+(.+?)\s+to\s+/i);
    if (enables?.[1]) audiences.push(...splitList(enables[1]));

    const replaces: string[] = [];
    const suchAs = full.match(/(?:tools?\s*(?:—|-)?\s*such as|such as)\s+(.+?)(?:\s*(?:—|-)\s*with|\s+with\b)/i);
    if (suchAs?.[1]) replaces.push(...splitList(suchAs[1].replace(/^personal\s+/i, 'personal ')));

    const traits: string[] = [];
    const traitMatch = full.match(/that is\s+(.+?)(?:,?\s+and designed|,?\s+and is designed|\.|$)/i);
    if (traitMatch?.[1]) {
        traits.push(
            ...splitList(traitMatch[1]).filter((t) =>
                /encrypt|role|audit|secure|compliant|hipaa|private/i.test(t),
            ),
        );
    }

    return {
        lead,
        rest: rest.filter((s) => s && s !== lead),
        audiences: [...new Set(audiences)].slice(0, 6),
        replaces: [...new Set(replaces)].slice(0, 6),
        traits: [...new Set(traits)].slice(0, 6),
    };
}

function renderInlineText(text: string) {
    const parts = text.split(/(HELIX|Helix)/g);
    return parts.map((part, i) =>
        part.toUpperCase() === 'HELIX' ? (
            <strong key={i} className="ask-ai-panel__brand-word">{part}</strong>
        ) : (
            <React.Fragment key={i}>{part}</React.Fragment>
        ),
    );
}

function ProseAnswer({ paragraphs }: { paragraphs: string[] }) {
    if (paragraphs.length === 0) return null;

    // Short / error-like answers: keep simple
    if (paragraphs.length === 1 && paragraphs[0].length < 120) {
        return <p className="ask-ai-panel__paragraph">{renderInlineText(paragraphs[0])}</p>;
    }

    const prose = enrichProse(paragraphs);
    const hasExtras = prose.audiences.length > 0 || prose.replaces.length > 0 || prose.traits.length > 0;

    return (
        <div className="ask-ai-panel__prose">
            <div className="ask-ai-panel__lead">
                <span className="ask-ai-panel__lead-mark" aria-hidden />
                <p className="ask-ai-panel__lead-text">{renderInlineText(prose.lead)}</p>
            </div>

            {prose.rest.length > 0 && (
                <div className="ask-ai-panel__prose-body">
                    {prose.rest.map((sentence, i) => (
                        <p key={i} className="ask-ai-panel__paragraph">
                            {renderInlineText(sentence)}
                        </p>
                    ))}
                </div>
            )}

            {hasExtras && (
                <div className="ask-ai-panel__prose-extras">
                    {prose.audiences.length > 0 && (
                        <div className="ask-ai-panel__facet">
                            <div className="ask-ai-panel__facet-label">Built for</div>
                            <div className="ask-ai-panel__facet-chips">
                                {prose.audiences.map((item) => (
                                    <span key={item} className="ask-ai-panel__facet-chip">{item}</span>
                                ))}
                            </div>
                        </div>
                    )}
                    {prose.replaces.length > 0 && (
                        <div className="ask-ai-panel__facet">
                            <div className="ask-ai-panel__facet-label">Replaces</div>
                            <div className="ask-ai-panel__facet-chips">
                                {prose.replaces.map((item) => (
                                    <span key={item} className="ask-ai-panel__facet-chip ask-ai-panel__facet-chip--muted">
                                        {item}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                    {prose.traits.length > 0 && (
                        <div className="ask-ai-panel__facet">
                            <div className="ask-ai-panel__facet-label">Capabilities</div>
                            <div className="ask-ai-panel__facet-chips">
                                {prose.traits.map((item) => (
                                    <span key={item} className="ask-ai-panel__facet-chip ask-ai-panel__facet-chip--dark">
                                        {item}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function AssistantBody({
    message,
}: {
    message: Message;
}) {
    if (message.pending) {
        return (
            <div className="ask-ai-panel__thinking">
                <span className="ask-ai-panel__thinking-dot" />
                <span className="ask-ai-panel__thinking-dot" />
                <span className="ask-ai-panel__thinking-dot" />
            </div>
        );
    }

    const rawContent = message.content || parseAnswer(message.text);
    // If we somehow stored a flattened "Steps: 1. ..." paragraph, re-parse it.
    const content =
        rawContent.steps.length === 0 &&
        rawContent.paragraphs.some((p) => /steps:\s*\d+\./i.test(p) || /^\d+\.\s+/m.test(p))
            ? parseAnswer(rawContent.paragraphs.join('\n\n'))
            : rawContent;

    return (
        <>
            {content.paragraphs.length > 0 && content.steps.length === 0 && (
                <ProseAnswer paragraphs={content.paragraphs} />
            )}

            {content.paragraphs.length > 0 && content.steps.length > 0 && (
                content.paragraphs.map((p, i) => (
                    <p key={`p-${i}`} className="ask-ai-panel__paragraph">{renderInlineText(p)}</p>
                ))
            )}

            {content.steps.length > 0 && (
                <div className="ask-ai-panel__section">
                    <div className="ask-ai-panel__section-label">Steps</div>
                    <ol className="ask-ai-panel__steps">
                        {content.steps.map((step, i) => (
                            <li key={`s-${i}`} className="ask-ai-panel__step">
                                <span className="ask-ai-panel__step-num" aria-hidden>{i + 1}</span>
                                <span className="ask-ai-panel__step-text">{step}</span>
                            </li>
                        ))}
                    </ol>
                </div>
            )}

            {content.tips.length > 0 && (
                <div className="ask-ai-panel__section ask-ai-panel__section--tips">
                    <div className="ask-ai-panel__section-label">Tips</div>
                    <ul className="ask-ai-panel__tips-list">
                        {content.tips.map((tip, i) => (
                            <li key={`t-${i}`} className="ask-ai-panel__tip">
                                <span className="ask-ai-panel__tip-icon material-icons-round" aria-hidden>lightbulb</span>
                                <span>{tip}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {(message.matchedQuestion || typeof message.confidence === 'number') && (
                <div className="ask-ai-panel__meta-row">
                    {message.matchedQuestion && (
                        <span className="ask-ai-panel__chip">{message.matchedQuestion}</span>
                    )}
                    {typeof message.confidence === 'number' && (
                        <span className="ask-ai-panel__chip ask-ai-panel__chip--muted">
                            {Math.round(message.confidence * 100)}% match
                        </span>
                    )}
                </div>
            )}
        </>
    );
}

export function AskAiButton({ onClick }: { onClick: () => void }) {
    return (
        <button type="button" className="ask-ai-btn" onClick={onClick}>
            <span className="material-icons-round ask-ai-btn__icon">auto_awesome</span>
            Ask AI
        </button>
    );
}

export default function AskAiPanel({
    open,
    onClose,
}: {
    open: boolean;
    onClose: () => void;
}) {
    const [mounted, setMounted] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [sending, setSending] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!open) return undefined;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const t = window.setTimeout(() => inputRef.current?.focus(), 180);
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => {
            document.body.style.overflow = prev;
            window.clearTimeout(t);
            document.removeEventListener('keydown', onKey);
        };
    }, [open, onClose]);

    useEffect(() => {
        if (!open) return;
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages, open]);

    useEffect(() => {
        return () => {
            abortRef.current?.abort();
        };
    }, []);

    const sendQuestion = async (question: string) => {
        const text = question.trim();
        if (!text || sending) return;

        const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', text };
        const pendingId = `a-${Date.now()}`;
        setMessages((prev) => [
            ...prev,
            userMsg,
            { id: pendingId, role: 'assistant', text: '', pending: true },
        ]);
        setInput('');
        setSending(true);

        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        try {
            const res = await fetch(API_ENDPOINTS.ASK_AI_QUERY, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: text, document_id: '' }),
                signal: controller.signal,
            });
            const data = (await res.json().catch(() => ({}))) as AskAiResponse;

            if (!res.ok) {
                const errText =
                    data.error ||
                    (typeof data.details === 'string' ? data.details : null) ||
                    'Something went wrong talking to Helix AI.';
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === pendingId
                            ? {
                                  ...m,
                                  text: errText,
                                  content: { paragraphs: [errText], steps: [], tips: [] },
                                  pending: false,
                                  error: true,
                              }
                            : m,
                    ),
                );
                return;
            }

            const content = parseAnswer(data.answer, data.fallback);
            setMessages((prev) =>
                prev.map((m) =>
                    m.id === pendingId
                        ? {
                              ...m,
                              text: content.paragraphs.join('\n\n') || content.steps.join('\n'),
                              content,
                              pending: false,
                              matchedQuestion: data.matched ? data.matched_question || undefined : undefined,
                              confidence: typeof data.confidence === 'number' ? data.confidence : undefined,
                          }
                        : m,
                ),
            );
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') return;
            const errText = 'Unable to reach Helix AI. Make sure it is running on http://127.0.0.1:8000.';
            setMessages((prev) =>
                prev.map((m) =>
                    m.id === pendingId
                        ? {
                              ...m,
                              text: errText,
                              content: { paragraphs: [errText], steps: [], tips: [] },
                              pending: false,
                              error: true,
                          }
                        : m,
                ),
            );
        } finally {
            setSending(false);
            inputRef.current?.focus();
        }
    };

    const send = () => {
        void sendQuestion(input);
    };

    if (!mounted || !open) return null;

    return createPortal(
        <div className="ask-ai-root" role="dialog" aria-modal="true" aria-label="Helix Assistant">
            <button type="button" className="ask-ai-backdrop" aria-label="Close assistant" onClick={onClose} />
            <aside className="ask-ai-panel">
                <header className="ask-ai-panel__header">
                    <div className="ask-ai-panel__brand">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/helix-logo.png" alt="" width={22} height={22} className="ask-ai-panel__logo" />
                        <span className="ask-ai-panel__title">Helix Assistant</span>
                    </div>
                    <button type="button" className="ask-ai-panel__close" onClick={onClose} aria-label="Close">
                        <span className="material-icons-round">close</span>
                    </button>
                </header>

                <div className="ask-ai-panel__body" ref={listRef}>
                    {messages.length === 0 ? (
                        <div className="ask-ai-panel__empty">
                            <div className="ask-ai-panel__empty-icon" aria-hidden>
                                <span className="material-icons-round">auto_awesome</span>
                            </div>
                            <p className="ask-ai-panel__empty-text">Ask anything about Helix</p>
                            <div className="ask-ai-panel__suggestions">
                                {['What is Helix?', 'How do I sign in to a role?', 'Search for staff'].map((q) => (
                                    <button
                                        key={q}
                                        type="button"
                                        className="ask-ai-panel__suggestion"
                                        disabled={sending}
                                        onClick={() => void sendQuestion(q)}
                                    >
                                        {q}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="ask-ai-panel__messages">
                            {messages.map((m) =>
                                m.role === 'user' ? (
                                    <div key={m.id} className="ask-ai-panel__msg ask-ai-panel__msg--user">
                                        {m.text}
                                    </div>
                                ) : (
                                    <div
                                        key={m.id}
                                        className={`ask-ai-panel__answer${m.error ? ' ask-ai-panel__answer--error' : ''}${m.pending ? ' ask-ai-panel__answer--pending' : ''}`}
                                    >
                                        <AssistantBody message={m} />
                                    </div>
                                ),
                            )}
                        </div>
                    )}
                </div>

                <footer className="ask-ai-panel__footer">
                    <form
                        className="ask-ai-panel__form"
                        onSubmit={(e) => {
                            e.preventDefault();
                            send();
                        }}
                    >
                        <input
                            ref={inputRef}
                            className="ask-ai-panel__input"
                            placeholder="Ask anything about Helix..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            aria-label="Ask Helix Assistant"
                            disabled={sending}
                        />
                        <button
                            type="submit"
                            className="ask-ai-panel__send"
                            disabled={!input.trim() || sending}
                            aria-label="Send"
                        >
                            <span className="material-icons-round">{sending ? 'hourglass_empty' : 'send'}</span>
                        </button>
                    </form>
                </footer>
            </aside>
        </div>,
        document.body,
    );
}
