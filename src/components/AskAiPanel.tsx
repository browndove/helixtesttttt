'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { API_ENDPOINTS } from '@/lib/config';
import './ask-ai.css';

type DocBlock =
    | { type: 'paragraph'; text: string }
    | { type: 'heading'; text: string; level: 1 | 2 }
    | { type: 'list'; items: string[] }
    | { type: 'note'; text: string };

type StructuredAnswer = {
    paragraphs: string[];
    steps: string[];
    tips: string[];
    blocks?: DocBlock[];
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

const SECTION_HEADINGS = [
    'causes',
    'symptoms',
    'signs',
    'investigations',
    'investigation',
    'treatment',
    'treatment objectives',
    'non-pharmacological treatment',
    'pharmacological treatment',
    'referral criteria',
    'treatment algorithm',
    'fluid management for children with diarrhoea',
    'how to prepare ors',
    'box',
    'note',
];

function itemText(item: unknown): string {
    if (typeof item === 'string') return item.trim();
    if (item && typeof item === 'object' && 'text' in item) {
        const text = (item as { text?: unknown }).text;
        return typeof text === 'string' ? text.trim() : '';
    }
    return '';
}

function cleanText(input: string): string {
    return input
        .replace(/\u00ad\s*/g, '') // soft hyphens (consid­ er → consider)
        .replace(/\r\n/g, '\n')
        .replace(/\u00a0/g, ' ')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n[ \t]+/g, '\n')
        .replace(/-(such as|with)\b/gi, ' — $1')
        .trim();
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
    const normalized = cleanText(source);
    const hasStepsLabel = /^steps:\s*/i.test(normalized) || /\n\s*steps:\s*/i.test(normalized);
    const hasNumbered = /\d+\.\s+\S/.test(normalized);
    if (!hasStepsLabel && !hasNumbered) return null;

    // Prefer document parser for long clinical text that merely contains numbered lines.
    const bulletCount = (normalized.match(/[•]/g) || []).length;
    if (bulletCount >= 4 || normalized.length > 1200) return null;

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

function looksLikeHeading(line: string): { text: string; level: 1 | 2 } | null {
    const trimmed = line.trim().replace(/[:.]+$/, '').trim();
    if (!trimmed || trimmed.length > 80) return null;

    const lower = trimmed.toLowerCase();

    // "Box 1-1: Diagnostic clues..." / "Note 1-1 ..."
    if (/^(box|note)\s*\d/i.test(trimmed)) {
        return { text: trimmed, level: 2 };
    }

    // "Treatment Plan A – No dehydration"
    if (/^treatment\s+plan\s+[abc]\b/i.test(trimmed)) {
        return { text: trimmed, level: 2 };
    }

    // "A. Bacterial gastroenteritis..." / "B. Amoebic..."
    if (/^[A-D]\.\s+\S/.test(trimmed)) {
        return { text: trimmed, level: 2 };
    }

    // Known top-level clinical section titles
    if (SECTION_HEADINGS.some((h) => lower === h || lower.startsWith(`${h} `))) {
        return { text: trimmed, level: 1 };
    }

    // Short Title Case / ALL CAPS lines without sentence punctuation
    if (
        trimmed.length <= 48
        && !/[.!?]/.test(trimmed)
        && !/[•]/.test(trimmed)
        && /^[A-Z]/.test(trimmed)
        && (trimmed === trimmed.toUpperCase() || /^[A-Z][a-z]+(?:\s+[A-Za-z][a-z]*)*$/.test(trimmed))
    ) {
        return { text: trimmed, level: 2 };
    }

    return null;
}

function splitBulletItems(text: string): string[] {
    const parts = text
        .split(/\s*[•]\s*/)
        .map((p) => p.replace(/^\s*[-*]\s+/, '').trim())
        .filter(Boolean);
    return parts;
}

function isContinuationLine(line: string): boolean {
    if (!line) return false;
    if (/^[•\-\*]/.test(line)) return false;
    if (looksLikeHeading(line)) return false;
    // Starts lowercase / genus / dosage / fragment → join to previous
    return /^[a-z(]/.test(line) || /^(spp\.|e\.g\.|i\.e\.|or\b|and\b|then\b)/i.test(line);
}

/** Rebuild long clinical / guideline text into structured blocks. */
function parseDocumentText(source: string): DocBlock[] | null {
    const cleaned = cleanText(source);
    const bulletCount = (cleaned.match(/[•]/g) || []).length;
    const hasSections = SECTION_HEADINGS.some((h) => new RegExp(`(?:^|\\n)\\s*${h}\\b`, 'i').test(cleaned));
    if (cleaned.length < 400 && bulletCount < 3 && !hasSections) return null;
    if (cleaned.length < 200) return null;

    // Normalize jammed bullets onto their own lines, then rejoin soft wraps.
    const text = cleaned
        // Pull known section titles onto their own line when glued mid-stream
        .replace(
            /(?:^|[.!?]\s+|\n\s*)(Causes|Symptoms|Signs|Investigations?|Treatment objectives|Non-pharmacological treatment|Pharmacological treatment|Referral Criteria|Treatment algorithm|How to prepare ORS|Fluid management for children with diarrhoea)(?=\s+[A-Z•]|\s*$)/gi,
            '\n$1\n',
        )
        .replace(
            /(?:^|\n\s*)(Treatment Plan [ABC]\b[^\n•]*)/gi,
            '\n$1\n',
        )
        .replace(/\s*[•]\s*/g, '\n• ')
        .replace(/\n{3,}/g, '\n\n');

    const rawLines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const lines: string[] = [];
    for (const line of rawLines) {
        if (lines.length > 0 && isContinuationLine(line) && !lines[lines.length - 1].startsWith('•')) {
            lines[lines.length - 1] = `${lines[lines.length - 1]} ${line}`.replace(/\s+/g, ' ').trim();
        } else if (
            lines.length > 0
            && lines[lines.length - 1].startsWith('•')
            && isContinuationLine(line)
        ) {
            lines[lines.length - 1] = `${lines[lines.length - 1]} ${line}`.replace(/\s+/g, ' ').trim();
        } else {
            lines.push(line);
        }
    }

    const blocks: DocBlock[] = [];
    let listBuf: string[] = [];
    let paraBuf: string[] = [];

    const flushList = () => {
        if (!listBuf.length) return;
        blocks.push({ type: 'list', items: listBuf });
        listBuf = [];
    };
    const flushPara = () => {
        if (!paraBuf.length) return;
        const joined = paraBuf.join(' ').replace(/\s+/g, ' ').trim();
        if (joined) blocks.push({ type: 'paragraph', text: joined });
        paraBuf = [];
    };

    for (const line of lines) {
        // Heading glued to content: "Causes Acute diarrhoea (< 2 weeks) • Infections"
        const glued = line.match(
            /^(Causes|Symptoms|Signs|Investigations?|Treatment(?:\s+objectives)?|Referral Criteria|Non-pharmacological treatment|Pharmacological treatment)\s+(.+)$/i,
        );
        if (glued && !line.startsWith('•')) {
            flushList();
            flushPara();
            blocks.push({ type: 'heading', text: glued[1].trim(), level: 1 });
            const rest = glued[2].trim();
            const subHead = looksLikeHeading(rest.split(/[•]/)[0]?.trim() || '');
            if (subHead && !/[•]/.test(rest.split(/[•]/)[0] || '')) {
                const firstChunk = rest.split(/[•]/)[0].trim();
                blocks.push({ type: 'heading', text: firstChunk.replace(/[:.]+$/, '').trim(), level: 2 });
                const items = splitBulletItems(rest.slice(firstChunk.length));
                if (items.length) listBuf.push(...items);
            } else if (/[•]/.test(rest)) {
                // Maybe "Acute diarrhoea (< 2 weeks)" before bullets
                const beforeBullet = rest.split(/[•]/)[0]?.trim();
                if (beforeBullet && beforeBullet.length < 60 && !/[.!?]/.test(beforeBullet)) {
                    blocks.push({ type: 'heading', text: beforeBullet, level: 2 });
                    listBuf.push(...splitBulletItems(rest.slice(beforeBullet.length)));
                } else {
                    listBuf.push(...splitBulletItems(rest));
                }
            } else {
                paraBuf.push(rest);
            }
            continue;
        }

        const heading = !line.startsWith('•') ? looksLikeHeading(line) : null;
        if (heading) {
            flushList();
            flushPara();
            if (/^note\b/i.test(heading.text)) {
                blocks.push({ type: 'note', text: heading.text });
            } else {
                blocks.push({ type: 'heading', text: heading.text, level: heading.level });
            }
            continue;
        }

        if (line.startsWith('•') || /^[-*]\s+\S/.test(line)) {
            flushPara();
            const item = line.replace(/^[•\-\*]\s*/, '').trim();
            if (item) listBuf.push(item);
            continue;
        }

        // Inline bullets still on one line
        if (/[•]/.test(line) && splitBulletItems(line).length >= 2) {
            flushPara();
            const parts = splitBulletItems(line);
            // If first part looks like a short label/heading, promote it
            if (parts[0] && parts[0].length < 55 && !/[.!?]/.test(parts[0])) {
                flushList();
                blocks.push({ type: 'heading', text: parts[0], level: 2 });
                listBuf.push(...parts.slice(1));
            } else {
                listBuf.push(...parts);
            }
            continue;
        }

        flushList();
        // Sentence-ish paragraph lines: keep separate when they end with . ! ?
        if (/[.!?]"?$/.test(line) && line.length > 40) {
            flushPara();
            blocks.push({ type: 'paragraph', text: line });
        } else {
            paraBuf.push(line);
        }
    }

    flushList();
    flushPara();

    // Not worth structured rendering if we barely found structure
    const structuredCount = blocks.filter((b) => b.type === 'heading' || b.type === 'list').length;
    if (structuredCount < 2 && blocks.length < 4) return null;
    return blocks;
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

    const blocks = parseDocumentText(source);
    if (blocks) {
        return { paragraphs: [], steps: [], tips: [], blocks };
    }

    const paragraphs = cleanText(source)
        .split(/\n{2,}/)
        .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
        .filter(Boolean);

    return {
        paragraphs: paragraphs.length ? paragraphs : [cleanText(source)],
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

    // Long answers without Helix facets: keep readable paragraph blocks (don't sentence-split)
    const fullLen = paragraphs.reduce((n, p) => n + p.length, 0);
    if (fullLen > 600) {
        return (
            <div className="ask-ai-panel__prose-body">
                {paragraphs.map((p, i) => (
                    <p key={i} className="ask-ai-panel__paragraph">{renderInlineText(p)}</p>
                ))}
            </div>
        );
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

function DocumentAnswer({ blocks }: { blocks: DocBlock[] }) {
    // Group into sections: intro paragraphs, then each level-1 heading opens a section card.
    type Section = { heading?: string; blocks: DocBlock[] };
    const sections: Section[] = [];
    let current: Section = { blocks: [] };

    for (const block of blocks) {
        if (block.type === 'heading' && block.level === 1) {
            if (current.heading || current.blocks.length) sections.push(current);
            current = { heading: block.text, blocks: [] };
            continue;
        }
        current.blocks.push(block);
    }
    if (current.heading || current.blocks.length) sections.push(current);

    const renderBlock = (block: DocBlock, key: number) => {
                if (block.type === 'heading') {
                    const isPlan = /^treatment\s+plan\s+[abc]\b/i.test(block.text)
                        || /^[A-D]\.\s+\S/.test(block.text);
                    return (
                        <h5
                            key={key}
                            className={`ask-ai-panel__doc-subhead${isPlan ? ' ask-ai-panel__doc-subhead--plan' : ''}`}
                        >
                            {block.text}
                        </h5>
                    );
                }
        if (block.type === 'list') {
            return (
                <ul key={key} className="ask-ai-panel__doc-list">
                    {block.items.map((item, j) => {
                        const nested = /^(viral|bacterial|protozoal|drug-induced|chronic|functional|inflammatory|adults|children|neonates)\b/i.test(item.trim());
                        return (
                            <li
                                key={j}
                                className={`ask-ai-panel__doc-li${nested ? ' ask-ai-panel__doc-li--nested' : ''}`}
                            >
                                <span className="ask-ai-panel__doc-bullet" aria-hidden />
                                <span>{renderInlineText(item)}</span>
                            </li>
                        );
                    })}
                </ul>
            );
        }
        if (block.type === 'note') {
            return (
                <aside key={key} className="ask-ai-panel__doc-note">
                    <span className="material-icons-round ask-ai-panel__doc-note-icon" aria-hidden>info</span>
                    <span>{renderInlineText(block.text)}</span>
                </aside>
            );
        }
        return (
            <p key={key} className="ask-ai-panel__paragraph ask-ai-panel__doc-p">
                {renderInlineText(block.text)}
            </p>
        );
    };

    const hasSectionCards = sections.some((s) => s.heading);

    return (
        <div className={`ask-ai-panel__doc${hasSectionCards ? ' ask-ai-panel__doc--sectioned' : ''}`}>
            {sections.map((section, si) => {
                if (!section.heading) {
                    // Lead / intro block
                    return (
                        <div key={si} className="ask-ai-panel__doc-intro">
                            {section.blocks.map((b, bi) => renderBlock(b, bi))}
                        </div>
                    );
                }
                return (
                    <section key={si} className="ask-ai-panel__doc-section">
                        <header className="ask-ai-panel__doc-section-head">
                            <span className="ask-ai-panel__doc-section-bar" aria-hidden />
                            <h4 className="ask-ai-panel__doc-section-title">{section.heading}</h4>
                        </header>
                        <div className="ask-ai-panel__doc-section-body">
                            {section.blocks.map((b, bi) => renderBlock(b, bi))}
                        </div>
                    </section>
                );
            })}
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
    // Re-parse flattened howto / long clinical text if stored as plain paragraphs only.
    const needsReparses =
        (!rawContent.blocks || rawContent.blocks.length === 0)
        && rawContent.steps.length === 0
        && (
            rawContent.paragraphs.some((p) => /steps:\s*\d+\./i.test(p) || /^\d+\.\s+/m.test(p) || /[•]/.test(p))
            || rawContent.paragraphs.join(' ').length > 800
        );
    const content = needsReparses
        ? parseAnswer(rawContent.paragraphs.join('\n\n') || message.text)
        : rawContent;

    return (
        <>
            {content.blocks && content.blocks.length > 0 ? (
                <DocumentAnswer blocks={content.blocks} />
            ) : (
                <>
                    {content.paragraphs.length > 0 && content.steps.length === 0 && (
                        <ProseAnswer paragraphs={content.paragraphs} />
                    )}

                    {content.paragraphs.length > 0 && content.steps.length > 0 && (
                        content.paragraphs.map((p, i) => (
                            <p key={`p-${i}`} className="ask-ai-panel__paragraph">{renderInlineText(p)}</p>
                        ))
                    )}
                </>
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
                              text:
                                  (typeof data.answer === 'string' && data.answer.trim())
                                  || (typeof data.fallback === 'string' && data.fallback.trim())
                                  || content.paragraphs.join('\n\n')
                                  || content.steps.join('\n'),
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
