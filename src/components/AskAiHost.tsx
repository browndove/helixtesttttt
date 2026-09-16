'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import AskAiPanel, { AskAiButton } from '@/components/AskAiPanel';

export default function AskAiHost() {
    const [open, setOpen] = useState(false);
    const pathname = usePathname();

    // Dense analytics dashboards — keep the Ask AI dock off these routes.
    if (pathname?.startsWith('/internal/downloads') || pathname?.startsWith('/internal/feature-usage')) {
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
