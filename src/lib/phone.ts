export function formatGhanaPhoneInput(raw: string): string {
    const trimmed = String(raw || '').trim();
    if (!trimmed) return '+233';

    const digits = trimmed.replace(/\D/g, '');
    let local = '';

    if (trimmed.startsWith('+233') || digits.startsWith('233')) {
        local = digits.slice(3);
    } else if (digits.startsWith('0')) {
        local = digits.slice(1);
    } else {
        local = digits;
    }

    // Ghana local mobile number segment is 9 digits after +233.
    return `+233${local.slice(0, 9)}`;
}

export function isValidGhanaPhone(phone: string): boolean {
    return /^\+233\d{9}$/.test(String(phone || '').trim());
}
