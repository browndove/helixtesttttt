'use client';

import { FaApple, FaDownload, FaGooglePlay } from 'react-icons/fa6';
import { IoPeople } from 'react-icons/io5';
import { MdInsights, MdSpaceDashboard } from 'react-icons/md';

const SECTIONS = [
    {
        icon: MdSpaceDashboard,
        iconClass: 'text-accent-primary',
        bgClass: 'bg-[rgba(36,132,199,0.1)]',
        title: 'Overview',
        body: 'Installs, store conversion, discovery, and updates across both stores at a glance.',
    },
    {
        icon: FaDownload,
        iconClass: 'text-accent-green',
        bgClass: 'bg-[rgba(0,200,179,0.1)]',
        title: 'Acquisition',
        body: 'Where installs come from — country, traffic source, device, and store listing performance.',
    },
    {
        icon: IoPeople,
        iconClass: 'text-accent-violet',
        bgClass: 'bg-[rgba(105,116,247,0.1)]',
        title: 'Retention',
        body: 'What happens after the install: active devices, uninstalls, crashes, and ANRs.',
    },
    {
        icon: MdInsights,
        iconClass: 'text-accent-orange',
        bgClass: 'bg-[rgba(232,155,0,0.1)]',
        title: 'Metrics',
        body: 'Every App Store and Play metric, broken down by the dimension you choose.',
    },
];

export default function DownloadsComingSoon() {
    return (
        <main className="internal-dash__main">
            <div className="mx-auto flex w-full max-w-[860px] flex-col items-center py-10 text-center sm:py-16">
                <span className="inline-flex items-center gap-2 rounded-full bg-[rgba(36,132,199,0.1)] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-accent-primary">
                    Coming soon
                </span>

                <h1 className="mt-5 text-3xl font-extrabold leading-tight text-text-primary sm:text-4xl">
                    Downloads Analytics
                </h1>
                <p className="mt-3 max-w-[560px] text-sm leading-6 text-text-secondary sm:text-base">
                    App Store Connect and Google Play reporting, side by side in one dashboard.
                    We are still validating the numbers against both consoles, so the pages are
                    switched off until the figures can be trusted.
                </p>

                <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-text-secondary">
                        <FaApple className="h-3.5 w-3.5" />
                        App Store Connect
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-text-secondary">
                        <FaGooglePlay className="h-3 w-3" />
                        Google Play Console
                    </span>
                </div>

                <div className="mt-10 grid w-full grid-cols-1 gap-4 text-left sm:grid-cols-2">
                    {SECTIONS.map((section) => {
                        const Icon = section.icon;
                        return (
                            <div key={section.title} className="bg-primary rounded-[15px] shadow-soft p-5">
                                <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-[10px] ${section.bgClass}`}>
                                    <Icon className={`h-[18px] w-[18px] ${section.iconClass}`} />
                                </div>
                                <h2 className="text-sm font-bold text-text-primary">{section.title}</h2>
                                <p className="mt-1 text-xs leading-5 text-text-secondary">{section.body}</p>
                            </div>
                        );
                    })}
                </div>

                <a
                    href="/internal/dashboard"
                    className="mt-10 inline-flex items-center gap-2 rounded-lg bg-accent-primary px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
                >
                    <span className="material-icons-round" style={{ fontSize: 16 }}>arrow_back</span>
                    Back to Facilities
                </a>
            </div>
        </main>
    );
}
