'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './ask-ai.css';

type Message = {
    id: string;
    role: 'user' | 'assistant';
    text: string;
};

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
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

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

    const send = () => {
        const text = input.trim();
        if (!text) return;
        const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', text };
        setMessages((prev) => [...prev, userMsg]);
        setInput('');
        window.setTimeout(() => {
            setMessages((prev) => [
                ...prev,
                {
                    id: `a-${Date.now()}`,
                    role: 'assistant',
                    text: 'Thanks for your question. Helix AI will be connected to your facility data soon — for now this is a preview of the assistant.',
                },
            ]);
        }, 450);
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
                            <p className="ask-ai-panel__empty-text">Ask anything about your facility</p>
                        </div>
                    ) : (
                        <div className="ask-ai-panel__messages">
                            {messages.map((m) => (
                                <div
                                    key={m.id}
                                    className={`ask-ai-panel__msg ask-ai-panel__msg--${m.role}`}
                                >
                                    {m.text}
                                </div>
                            ))}
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
                            placeholder="Ask anything about your facility..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            aria-label="Ask Helix Assistant"
                        />
                        <button
                            type="submit"
                            className="ask-ai-panel__send"
                            disabled={!input.trim()}
                            aria-label="Send"
                        >
                            <span className="material-icons-round">send</span>
                        </button>
                    </form>
                </footer>
            </aside>
        </div>,
        document.body,
    );
}
