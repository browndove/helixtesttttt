'use client';

import { useState } from 'react';
import AskAiPanel, { AskAiButton } from '@/components/AskAiPanel';

export default function AskAiHost() {
    const [open, setOpen] = useState(false);

    return (
        <>
            {!open && (
                <div className="ask-ai-dock">
                    <AskAiButton onClick={() => setOpen(true)} />
                </div>
            )}
            <AskAiPanel open={open} onClose={() => setOpen(false)} />
        </>
    );
}
