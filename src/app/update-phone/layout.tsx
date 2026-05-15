import type { Viewport } from 'next';

/** Lets `env(safe-area-inset-*)` apply on notched phones when the OS uses edge-to-edge chrome. */
export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
};

export default function UpdatePhoneLayout({ children }: { children: React.ReactNode }) {
    return children;
}
