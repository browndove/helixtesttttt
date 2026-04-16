import { redirect } from 'next/navigation';

/** Canonical login URL is `/login`; root redirects so `/` and `/login` are not duplicate pages. */
export default function RootPage() {
    redirect('/login');
}
