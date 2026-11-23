'use client';

import '@/components/glass/glass-kit.css';
import { DotGrid, Gauge, KpiTile, LadderBars, PulseLine } from '@/components/glass/kpi';

/* ── Strip ───────────────────────────────────────────────────── */

export function HomeKpiStrip({
    loading,
    patientCount,
    staff,
    twoFactor,
    escalation,
    go,
}: {
    loading: boolean;
    patientCount: number;
    staff: { active: number; total: number; percent: number };
    twoFactor: { enabled: number; total: number; percent: number };
    escalation: { missing: number; total: number };
    go: (href: string) => void;
}) {
    const dash = '—';
    const needsLadders = escalation.missing > 0;
    return (
        <section className="hx-kpis dash-reveal" aria-label="Key metrics">
            <KpiTile
                tone="sky"
                icon="personal_injury"
                watermark="monitor_heart"
                label="Active patients"
                value={loading ? dash : patientCount.toLocaleString()}
                foot="Net enrolled"
                chart={<PulseLine />}
                onClick={() => go('/patients')}
            />
            <KpiTile
                tone="indigo"
                icon="groups"
                watermark="badge"
                label="Active staff"
                value={loading ? dash : `${staff.percent}%`}
                foot={loading ? dash : `${staff.active.toLocaleString()} of ${staff.total.toLocaleString()} accounts`}
                chart={<DotGrid pct={loading ? 0 : staff.percent} />}
                onClick={() => go('/staff')}
            />
            <KpiTile
                tone="mint"
                icon="verified_user"
                watermark="fingerprint"
                label="2FA adoption"
                value={loading ? dash : `${twoFactor.percent}%`}
                foot={loading ? dash : `${twoFactor.enabled} of ${twoFactor.total} · target 80%`}
                chart={<Gauge pct={loading ? 0 : twoFactor.percent} />}
                onClick={() => go('/staff')}
            />
            <KpiTile
                tone={needsLadders ? 'rose' : 'amber'}
                alert={needsLadders}
                icon={needsLadders ? 'warning' : 'notifications_active'}
                watermark="stairs"
                label="Escalation ladders"
                value={loading ? dash : needsLadders ? `${escalation.missing} missing` : escalation.total > 0 ? 'All set' : 'None'}
                foot={loading
                    ? dash
                    : escalation.total > 0
                        ? `${escalation.total - escalation.missing} of ${escalation.total} critical roles covered`
                        : 'No critical roles configured'}
                chart={<LadderBars total={loading ? 0 : escalation.total} missing={escalation.missing} />}
                onClick={() => go('/escalation')}
            />
        </section>
    );
}
