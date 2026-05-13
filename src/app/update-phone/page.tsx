import { Suspense } from 'react';
import UpdatePhoneFlow from '@/components/UpdatePhoneFlow';

export default function UpdatePhonePage() {
    return (
        <Suspense fallback={(
            <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#E8EDF4' }}>
                <p style={{ fontSize: 14, color: '#64748b' }}>Loading…</p>
            </div>
        )}
        >
            <UpdatePhoneFlow />
        </Suspense>
    );
}
