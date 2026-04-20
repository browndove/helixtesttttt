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

export type PhoneCountry = {
    code: string;
    dialCode: string;
    label: string;
    digits: number;
    trunkPrefix?: string;
};

export const PHONE_COUNTRIES: PhoneCountry[] = [
    { code: 'GH', dialCode: '+233', label: 'Ghana (+233)', digits: 9, trunkPrefix: '0' },
    { code: 'NG', dialCode: '+234', label: 'Nigeria (+234)', digits: 10, trunkPrefix: '0' },
    { code: 'KE', dialCode: '+254', label: 'Kenya (+254)', digits: 9, trunkPrefix: '0' },
    { code: 'ZA', dialCode: '+27', label: 'South Africa (+27)', digits: 9, trunkPrefix: '0' },
    { code: 'US', dialCode: '+1', label: 'United States (+1)', digits: 10 },
    { code: 'GB', dialCode: '+44', label: 'United Kingdom (+44)', digits: 10, trunkPrefix: '0' },
];

function digitsOnly(raw: string): string {
    return String(raw || '').replace(/\D/g, '');
}

export function getPhoneCountryByCode(code: string): PhoneCountry {
    return PHONE_COUNTRIES.find(c => c.code === code) || PHONE_COUNTRIES[0];
}

export function detectPhoneCountryFromE164(phone: string): PhoneCountry {
    const cleaned = String(phone || '').trim();
    if (!cleaned) return PHONE_COUNTRIES[0];
    const byDialLen = [...PHONE_COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);
    for (const c of byDialLen) {
        if (cleaned.startsWith(c.dialCode)) return c;
    }
    return PHONE_COUNTRIES[0];
}

export function formatPhoneByCountry(raw: string, countryCode: string): string {
    const country = getPhoneCountryByCode(countryCode);
    const d = digitsOnly(raw);
    const dialDigits = country.dialCode.replace('+', '');

    let local = d;
    if (local.startsWith(dialDigits)) local = local.slice(dialDigits.length);
    if (country.trunkPrefix && local.startsWith(country.trunkPrefix)) {
        local = local.slice(country.trunkPrefix.length);
    }
    local = local.slice(0, country.digits);
    return `${country.dialCode}${local}`;
}

export function isValidPhoneByCountry(phone: string, countryCode: string): boolean {
    const country = getPhoneCountryByCode(countryCode);
    const re = new RegExp(`^\\${country.dialCode}\\d{${country.digits}}$`);
    return re.test(String(phone || '').trim());
}

export function splitPhoneForCountryInput(phone: string): { countryCode: string; local: string } {
    const country = detectPhoneCountryFromE164(phone);
    const dialDigits = country.dialCode.replace('+', '');
    const d = digitsOnly(phone);
    let local = d.startsWith(dialDigits) ? d.slice(dialDigits.length) : d;
    if (country.trunkPrefix && local.startsWith(country.trunkPrefix)) {
        local = local.slice(country.trunkPrefix.length);
    }
    return { countryCode: country.code, local: local.slice(0, country.digits) };
}
