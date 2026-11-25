'use client';

import type { ReactNode } from 'react';
import CustomSelect, { type CustomSelectOption } from '@/components/CustomSelect';
import DatePicker from '@/components/DatePicker';
import './add-staff-form.css';

export type PatientAccessChoice = 'yes' | 'no';

export type DirectoryConflict = { reviewId: string; kind: string; name: string; problem: string };

type Props = {
    firstName: string;
    middleName: string;
    lastName: string;
    dob: string;
    employeeId: string;
    canManageSchedule: boolean | null;
    patientAccess: PatientAccessChoice | null;
    primaryWorkstation: string;
    onFirstName: (v: string) => void;
    onMiddleName: (v: string) => void;
    onLastName: (v: string) => void;
    onDob: (v: string) => void;
    onEmployeeId: (v: string) => void;
    onCanManageSchedule: (v: boolean) => void;
    onPatientAccess: (v: PatientAccessChoice) => void;
    onPrimaryWorkstation: (v: string) => void;
    workstationOptions: CustomSelectOption[];
    workstationsLoading: boolean;
    conflict: DirectoryConflict | null;
    onOpenReview?: () => void;
    missingFields: string[];
    adding: boolean;
    onSubmit: () => void;
    onCancel: () => void;
};

function Segmented<T extends string>({
    value,
    options,
    onChange,
    label,
}: {
    value: T | null;
    options: { value: T; label: string; icon?: string }[];
    onChange: (v: T) => void;
    label: string;
}) {
    return (
        <div className="sa-seg" role="radiogroup" aria-label={label}>
            {options.map(o => (
                <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={value === o.value}
                    className={`sa-seg__opt${value === o.value ? ' is-on' : ''}`}
                    onClick={() => onChange(o.value)}
                >
                    {o.icon && <span className="material-icons-round" aria-hidden>{o.icon}</span>}
                    {o.label}
                </button>
            ))}
        </div>
    );
}

function Field({ label, required, hint, children, span }: {
    label: string;
    required?: boolean;
    hint?: ReactNode;
    children: ReactNode;
    span?: 2 | 3;
}) {
    return (
        <div className={`sa-field${span ? ` sa-span-${span}` : ''}`}>
            <label className="sa-label">
                {label}
                {required ? <em aria-hidden>*</em> : <span className="sa-optional">Optional</span>}
            </label>
            {children}
            {hint && <p className="sa-hint">{hint}</p>}
        </div>
    );
}

function formatDob(dob: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob.trim());
    if (!m) return dob.trim();
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AddStaffForm(p: Props) {
    const fullName = [p.firstName, p.middleName, p.lastName].map(s => s.trim()).filter(Boolean).join(' ');
    const initials = `${p.firstName.trim()[0] || ''}${p.lastName.trim()[0] || ''}`.toUpperCase();
    const workstation = p.primaryWorkstation === 'not_applicable'
        ? 'No workstation'
        : p.workstationOptions.find(o => o.value === p.primaryWorkstation)?.triggerLabel || '';
    const requiredTotal = 5;
    const requiredDone = requiredTotal - p.missingFields.length;
    const ready = p.missingFields.length === 0;

    return (
        <section className="sa fade-in" aria-labelledby="sa-title">
            <span className="material-icons-round sa__mark" aria-hidden>person_add</span>

            <header className="sa__head">
                <span className="sa__chip"><span className="material-icons-round">person_add</span></span>
                <div className="sa__titles">
                    <h3 id="sa-title">Add staff member</h3>
                    <p>Adds them to the directory. They set their email and password when they join with the facility code or an invite.</p>
                </div>
            </header>

            {p.conflict && (
                <div className="sa-alert" role="alert">
                    <span className="material-icons-round" aria-hidden>error_outline</span>
                    <div>
                        <b>Already in the directory{p.conflict.name ? ` — ${p.conflict.name}` : ''}</b>
                        <p>{p.conflict.problem}</p>
                        {p.onOpenReview && (
                            <button type="button" className="sa-link" onClick={p.onOpenReview}>Open Directory Review</button>
                        )}
                    </div>
                </div>
            )}

            <div className="sa__body">
                <div className="sa__form">
                    <fieldset className="sa-group">
                        <legend><span className="sa-num">1</span>Who they are</legend>
                        <div className="sa-grid">
                            <Field label="First name" required>
                                <input className="input sa-input" value={p.firstName} onChange={e => p.onFirstName(e.target.value)} placeholder="e.g. Ama" autoFocus />
                            </Field>
                            <Field label="Middle name">
                                <input className="input sa-input" value={p.middleName} onChange={e => p.onMiddleName(e.target.value)} placeholder="—" />
                            </Field>
                            <Field label="Last name" required>
                                <input className="input sa-input" value={p.lastName} onChange={e => p.onLastName(e.target.value)} placeholder="e.g. Mensah" />
                            </Field>
                            <Field label="Date of birth" required hint="Used to match them when they join.">
                                <div className="sa-date"><DatePicker value={p.dob} onChange={p.onDob} placeholder="Pick a date" /></div>
                            </Field>
                            <Field label="Employee ID" hint="Helps match them when they join.">
                                <input className="input sa-input" value={p.employeeId} onChange={e => p.onEmployeeId(e.target.value)} placeholder="e.g. HH-0142" />
                            </Field>
                        </div>
                    </fieldset>

                    <fieldset className="sa-group">
                        <legend><span className="sa-num">2</span>Work &amp; access</legend>
                        <div className="sa-grid">
                            <Field label="Primary workstation" span={2} hint="The unit they mainly work in. Units are managed under Departments.">
                                <CustomSelect
                                    value={p.primaryWorkstation}
                                    onChange={p.onPrimaryWorkstation}
                                    options={p.workstationOptions}
                                    placeholder={p.workstationsLoading ? 'Loading units…' : 'Select a unit'}
                                    searchPlaceholder="Search units"
                                    allowClear
                                    clearLabel="Not set"
                                    disabled={p.workstationsLoading}
                                />
                            </Field>
                            <Field label="Can manage schedule" required>
                                <Segmented
                                    label="Can manage schedule"
                                    value={p.canManageSchedule === null ? null : p.canManageSchedule ? 'yes' : 'no'}
                                    onChange={v => p.onCanManageSchedule(v === 'yes')}
                                    options={[
                                        { value: 'yes', label: 'Yes', icon: 'event_available' },
                                        { value: 'no', label: 'No', icon: 'event_busy' },
                                    ]}
                                />
                            </Field>
                            <Field label="Patient access" required span={3} hint="Whether they can see patient records in the app.">
                                <Segmented
                                    label="Patient access"
                                    value={p.patientAccess}
                                    onChange={p.onPatientAccess}
                                    options={[
                                        { value: 'yes', label: 'Allow', icon: 'lock_open' },
                                        { value: 'no', label: 'Block', icon: 'lock' },
                                    ]}
                                />
                            </Field>
                        </div>
                    </fieldset>
                </div>

                <aside className="sa__side" aria-label="Preview">
                    <div className="sa-preview">
                        <span className="material-icons-round sa-preview__mark" aria-hidden>badge</span>
                        <span className="sa-preview__eyebrow">Directory card</span>
                        <div className="sa-preview__id">
                            <span className={`sa-avatar${initials ? '' : ' is-empty'}`}>
                                {initials || <span className="material-icons-round">person</span>}
                            </span>
                            <div>
                                <b>{fullName || 'New staff member'}</b>
                                <span>{p.employeeId.trim() || 'No employee ID'}</span>
                            </div>
                        </div>
                        <dl className="sa-preview__facts">
                            <div><dt>Born</dt><dd>{p.dob.trim() ? formatDob(p.dob) : '—'}</dd></div>
                            <div><dt>Workstation</dt><dd>{workstation || '—'}</dd></div>
                            <div><dt>Scheduler</dt><dd>{p.canManageSchedule === null ? '—' : p.canManageSchedule ? 'Yes' : 'No'}</dd></div>
                            <div><dt>Patients</dt><dd>{p.patientAccess === null ? '—' : p.patientAccess === 'yes' ? 'Allowed' : 'Blocked'}</dd></div>
                        </dl>
                    </div>

                    <ol className="sa-next">
                        <li><span className="material-icons-round">how_to_reg</span>They join from the Helix app using the facility code.</li>
                        <li><span className="material-icons-round">verified</span>We match them by name and date of birth, or employee ID.</li>
                        <li><span className="material-icons-round">mail</span>Or send them an invite from the directory later.</li>
                    </ol>
                </aside>
            </div>

            <footer className="sa__foot">
                <div className="sa-progress" aria-live="polite">
                    <span className="sa-progress__bar"><i style={{ width: `${(requiredDone / requiredTotal) * 100}%` }} /></span>
                    {ready ? 'Ready to add' : `${requiredDone} of ${requiredTotal} required · ${p.missingFields.join(', ')}`}
                </div>
                <div className="sa__actions">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={p.onCancel}>Cancel</button>
                    <button type="button" className="btn btn-primary btn-sm" onClick={p.onSubmit} disabled={p.adding || !ready}>
                        <span className="material-icons-round" style={{ fontSize: 15 }}>{p.adding ? 'hourglass_empty' : 'person_add'}</span>
                        {p.adding ? 'Adding…' : 'Add to directory'}
                    </button>
                </div>
            </footer>
        </section>
    );
}
