'use client';

import { useEffect, useState } from 'react';

/**
 * "Signup" card on staff detail: how the person joined and the details they gave
 * (GET /staff/{id}). The `signup` object only exists for people who used the
 * self-join form; everyone else still gets the job and workstation fields.
 */

type Workstation = { id: string; name: string; is_primary: boolean };

type SignupInfo = {
    source: string;
    outcome: string;
    requestedAt: string;
    completedAt: string;
    emailVerifiedAt: string;
    departmentGiven: string;
    departments: string[];
    jobCategory: string;
    jobType: string;
    appointmentEnd: string;
    workstations: Workstation[];
    roomCubicle: string;
};

const SOURCE_LABELS: Record<string, string> = {
    admin_created: 'Added by an admin',
    directory: 'From a staff list upload',
    self_join: 'Signed up themselves in the app',
};

const OUTCOME_LABELS: Record<string, string> = {
    verify_identity: 'Already on the staff list, confirmed with an emailed code',
    pending_approval: 'New to the facility, approved by an admin',
};

const JOB_CATEGORY_LABELS: Record<string, string> = { clinical: 'Clinical', non_clinical: 'Non-clinical' };
const JOB_TYPE_LABELS: Record<string, string> = { permanent: 'Permanent', temporary: 'Temporary' };

function rec(v: unknown): Record<string, unknown> | null {
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function str(v: unknown): string {
    return typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '';
}

function nameOf(v: unknown): string {
    const r = rec(v);
    return r ? str(r.name || r.department_name || r.title) : str(v);
}

function parseSignupInfo(raw: unknown): SignupInfo {
    const top = rec(raw) || {};
    const r = rec(top.data) || rec(top.staff) || top;
    const signup = rec(r.signup) || {};
    const primary = rec(r.primary_workstation);
    const primaryId = primary ? str(primary.id) : str(r.primary_workstation_id || r.primary_workstation);
    const workstations: Workstation[] = (Array.isArray(r.workstations) ? r.workstations : [])
        .map((w): Workstation | null => {
            const wr = rec(w);
            if (!wr) return null;
            const id = str(wr.id);
            const name = str(wr.name) || id;
            if (!name) return null;
            return { id, name, is_primary: Boolean(wr.is_primary) || (!!id && id === primaryId) };
        })
        .filter((w): w is Workstation => Boolean(w));
    if (primary && !workstations.some(w => w.is_primary) && str(primary.name)) {
        workstations.unshift({ id: str(primary.id), name: str(primary.name), is_primary: true });
    }
    const departments = (Array.isArray(r.departments) ? r.departments : []).map(nameOf).filter(Boolean);
    return {
        source: str(r.source),
        outcome: str(signup.outcome),
        requestedAt: str(signup.requested_at),
        completedAt: str(signup.completed_at),
        emailVerifiedAt: str(signup.email_verified_at),
        departmentGiven: str(signup.department_name),
        departments,
        jobCategory: str(r.job_category),
        jobType: str(r.job_type),
        appointmentEnd: str(r.account_expires_on),
        workstations,
        roomCubicle: str(r.room_cubicle),
    };
}

function formatDate(iso: string, withTime = false): string {
    if (!iso) return '';
    const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    });
}

function Row({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
    return (
        <div className="staff-detail-field-row">
            <span className="material-icons-round staff-detail-field-icon" aria-hidden>{icon}</span>
            <span className="staff-detail-field-label">{label}</span>
            <span className="staff-detail-field-value" style={{ whiteSpace: 'normal' }}>{children}</span>
        </div>
    );
}

const normalize = (s: string) => s.trim().toLowerCase();

export default function StaffSignupCard({ staffId, detailUrl }: { staffId: string; detailUrl: string }) {
    const [info, setInfo] = useState<SignupInfo | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let canceled = false;
        setInfo(null);
        setFailed(false);
        (async () => {
            try {
                const res = await fetch(detailUrl, { credentials: 'include' });
                if (!res.ok) throw new Error(String(res.status));
                const data = await res.json();
                if (!canceled) setInfo(parseSignupInfo(data));
            } catch {
                if (!canceled) setFailed(true);
            }
        })();
        return () => { canceled = true; };
    }, [staffId, detailUrl]);

    const departmentMismatch = Boolean(
        info?.departmentGiven
        && !info.departments.some(d => normalize(d) === normalize(info.departmentGiven)),
    );

    return (
        <div style={{ background: '#FFFFFF', borderRadius: 14, border: '1px solid #E4E7EC', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)', padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span className="material-icons-round" style={{ fontSize: 16, color: '#94A3B8' }}>how_to_reg</span>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#9CA3AF' }}>SIGNUP</span>
            </div>
            <div style={{ fontSize: 11.5, color: '#9CA3AF', marginBottom: 6 }}>How this person joined and the details they gave.</div>
            {failed ? (
                <div style={{ fontSize: 12, color: '#9CA3AF' }}>Couldn’t load signup details. Close and reopen this person to try again.</div>
            ) : !info ? (
                <div style={{ fontSize: 12, color: '#9CA3AF' }}>Loading…</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Row icon="login" label="How they joined">{SOURCE_LABELS[info.source] || info.source || 'Not known'}</Row>
                    {info.outcome && (
                        <Row icon="verified" label="How it was checked">{OUTCOME_LABELS[info.outcome] || info.outcome}</Row>
                    )}
                    {info.requestedAt && <Row icon="schedule_send" label="Asked to join">{formatDate(info.requestedAt, true)}</Row>}
                    {info.completedAt && (
                        <Row icon="task_alt" label={info.outcome === 'pending_approval' ? 'Approved on' : 'Confirmed on'}>
                            {formatDate(info.completedAt, true)}
                        </Row>
                    )}
                    {info.outcome && (
                        <Row icon="mark_email_read" label="Email checked">
                            {info.emailVerifiedAt
                                ? `Yes, ${formatDate(info.emailVerifiedAt, true)}`
                                : info.outcome === 'verify_identity'
                                    ? 'Yes, with the emailed code'
                                    : 'Not yet'}
                        </Row>
                    )}
                    {info.departmentGiven && (
                        <Row icon="apartment" label="Department typed">
                            {info.departmentGiven}
                            {departmentMismatch && (
                                <span
                                    title="The department they typed at signup is different from the one they were put in. Check they were matched to the right person."
                                    style={{ display: 'inline-block', marginLeft: 6, fontSize: 10.5, fontWeight: 600, padding: '1px 7px', borderRadius: 999, background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' }}
                                >
                                    {info.departments.length ? `Put in ${info.departments.join(', ')} instead` : 'Not put in any department'}
                                </span>
                            )}
                        </Row>
                    )}
                    <Row icon="medical_services" label="Job category">{JOB_CATEGORY_LABELS[info.jobCategory] || info.jobCategory || 'Not set'}</Row>
                    <Row icon="work_history" label="Job type">{JOB_TYPE_LABELS[info.jobType] || info.jobType || 'Not set'}</Row>
                    <Row icon="event_busy" label="Job ends on">{formatDate(info.appointmentEnd) || 'No end date'}</Row>
                    <Row icon="place" label="Workstations">
                        {info.workstations.length
                            ? info.workstations.map((w, i) => (
                                <span key={w.id || w.name}>
                                    {i > 0 ? ', ' : ''}{w.name}{w.is_primary && info.workstations.length > 1 ? ' (main)' : ''}
                                </span>
                            ))
                            : 'Not set'}
                    </Row>
                    <Row icon="meeting_room" label="Room / cubicle">{info.roomCubicle || 'Not set'}</Row>
                </div>
            )}
        </div>
    );
}
