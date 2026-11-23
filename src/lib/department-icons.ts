/** Material Icons Round glyph for a department / unit name (keyword match). */
export function deptIcon(label: string): string {
    const l = label.toLowerCase();
    if (/(a&e|emergenc|accident|casualty|trauma)/.test(l)) return 'emergency';
    if (/(matern|obstet|labou?r|antenatal|gyn)/.test(l)) return 'pregnant_woman';
    if (/(surg|theat)/.test(l)) return 'medical_services';
    if (/(paed|pediat|child|neonat|nicu)/.test(l)) return 'child_care';
    if (/(icu|intensive|critical)/.test(l)) return 'monitor_heart';
    if (/(lab|patholog)/.test(l)) return 'biotech';
    if (/(pharm)/.test(l)) return 'medication';
    if (/(radiol|imaging|x-ray|scan)/.test(l)) return 'center_focus_strong';
    if (/(cardio|heart)/.test(l)) return 'favorite';
    if (/(medic|ward|opd|outpatient)/.test(l)) return 'local_hospital';
    if (/(other|unassigned)/.test(l)) return 'more_horiz';
    return 'apartment';
}

/** Icon for a unit by its ward type, falling back to its name. */
export function unitIcon(type: string | undefined, name: string, hasInpatientBeds = true): string {
    if (!hasInpatientBeds) return 'desktop_windows';
    const fromType = deptIcon(type || '');
    if (fromType !== 'apartment') return fromType;
    const fromName = deptIcon(name);
    return fromName !== 'apartment' ? fromName : 'bed';
}
