'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import AskAiPanel, { AskAiButton } from '@/components/AskAiPanel';

export default function AskAiHost() {
    const [open, setOpen] = useState(false);
    const pathname = usePathname();

    // Downloads Analytics is a dense dashboard — keep the Ask AI dock off that route.
    if (pathname?.startsWith('/internal/downloads')) {
        return null;
    }

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
