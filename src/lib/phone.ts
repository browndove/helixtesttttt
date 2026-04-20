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
    { code: 'AF', dialCode: '+93', label: 'Afghanistan (+93)', digits: 9, trunkPrefix: '0' },
    { code: 'AL', dialCode: '+355', label: 'Albania (+355)', digits: 9, trunkPrefix: '0' },
    { code: 'DZ', dialCode: '+213', label: 'Algeria (+213)', digits: 9, trunkPrefix: '0' },
    { code: 'AS', dialCode: '+1684', label: 'American Samoa (+1684)', digits: 7 },
    { code: 'AD', dialCode: '+376', label: 'Andorra (+376)', digits: 6 },
    { code: 'AO', dialCode: '+244', label: 'Angola (+244)', digits: 9 },
    { code: 'AI', dialCode: '+1264', label: 'Anguilla (+1264)', digits: 7 },
    { code: 'AG', dialCode: '+1268', label: 'Antigua and Barbuda (+1268)', digits: 7 },
    { code: 'AR', dialCode: '+54', label: 'Argentina (+54)', digits: 10, trunkPrefix: '0' },
    { code: 'AM', dialCode: '+374', label: 'Armenia (+374)', digits: 8, trunkPrefix: '0' },
    { code: 'AW', dialCode: '+297', label: 'Aruba (+297)', digits: 7 },
    { code: 'AU', dialCode: '+61', label: 'Australia (+61)', digits: 9, trunkPrefix: '0' },
    { code: 'AT', dialCode: '+43', label: 'Austria (+43)', digits: 10, trunkPrefix: '0' },
    { code: 'AZ', dialCode: '+994', label: 'Azerbaijan (+994)', digits: 9, trunkPrefix: '0' },
    { code: 'BS', dialCode: '+1242', label: 'Bahamas (+1242)', digits: 7 },
    { code: 'BH', dialCode: '+973', label: 'Bahrain (+973)', digits: 8 },
    { code: 'BD', dialCode: '+880', label: 'Bangladesh (+880)', digits: 10, trunkPrefix: '0' },
    { code: 'BB', dialCode: '+1246', label: 'Barbados (+1246)', digits: 7 },
    { code: 'BY', dialCode: '+375', label: 'Belarus (+375)', digits: 9, trunkPrefix: '0' },
    { code: 'BE', dialCode: '+32', label: 'Belgium (+32)', digits: 9, trunkPrefix: '0' },
    { code: 'BZ', dialCode: '+501', label: 'Belize (+501)', digits: 7 },
    { code: 'BJ', dialCode: '+229', label: 'Benin (+229)', digits: 8 },
    { code: 'BM', dialCode: '+1441', label: 'Bermuda (+1441)', digits: 7 },
    { code: 'BT', dialCode: '+975', label: 'Bhutan (+975)', digits: 8 },
    { code: 'BO', dialCode: '+591', label: 'Bolivia (+591)', digits: 8 },
    { code: 'BA', dialCode: '+387', label: 'Bosnia and Herzegovina (+387)', digits: 8, trunkPrefix: '0' },
    { code: 'BW', dialCode: '+267', label: 'Botswana (+267)', digits: 8 },
    { code: 'BR', dialCode: '+55', label: 'Brazil (+55)', digits: 11, trunkPrefix: '0' },
    { code: 'IO', dialCode: '+246', label: 'British Indian Ocean Territory (+246)', digits: 7 },
    { code: 'VG', dialCode: '+1284', label: 'British Virgin Islands (+1284)', digits: 7 },
    { code: 'BN', dialCode: '+673', label: 'Brunei (+673)', digits: 7 },
    { code: 'BG', dialCode: '+359', label: 'Bulgaria (+359)', digits: 9, trunkPrefix: '0' },
    { code: 'BF', dialCode: '+226', label: 'Burkina Faso (+226)', digits: 8 },
    { code: 'BI', dialCode: '+257', label: 'Burundi (+257)', digits: 8 },
    { code: 'KH', dialCode: '+855', label: 'Cambodia (+855)', digits: 9, trunkPrefix: '0' },
    { code: 'CM', dialCode: '+237', label: 'Cameroon (+237)', digits: 9 },
    { code: 'CA', dialCode: '+1', label: 'Canada (+1)', digits: 10 },
    { code: 'CV', dialCode: '+238', label: 'Cape Verde (+238)', digits: 7 },
    { code: 'KY', dialCode: '+1345', label: 'Cayman Islands (+1345)', digits: 7 },
    { code: 'CF', dialCode: '+236', label: 'Central African Republic (+236)', digits: 8 },
    { code: 'TD', dialCode: '+235', label: 'Chad (+235)', digits: 8 },
    { code: 'CL', dialCode: '+56', label: 'Chile (+56)', digits: 9 },
    { code: 'CN', dialCode: '+86', label: 'China (+86)', digits: 11, trunkPrefix: '0' },
    { code: 'CO', dialCode: '+57', label: 'Colombia (+57)', digits: 10 },
    { code: 'KM', dialCode: '+269', label: 'Comoros (+269)', digits: 7 },
    { code: 'CG', dialCode: '+242', label: 'Congo (+242)', digits: 9 },
    { code: 'CD', dialCode: '+243', label: 'Congo (DRC) (+243)', digits: 9, trunkPrefix: '0' },
    { code: 'CK', dialCode: '+682', label: 'Cook Islands (+682)', digits: 5 },
    { code: 'CR', dialCode: '+506', label: 'Costa Rica (+506)', digits: 8 },
    { code: 'CI', dialCode: '+225', label: "Côte d'Ivoire (+225)", digits: 10 },
    { code: 'HR', dialCode: '+385', label: 'Croatia (+385)', digits: 9, trunkPrefix: '0' },
    { code: 'CU', dialCode: '+53', label: 'Cuba (+53)', digits: 8 },
    { code: 'CW', dialCode: '+599', label: 'Curaçao (+599)', digits: 7 },
    { code: 'CY', dialCode: '+357', label: 'Cyprus (+357)', digits: 8 },
    { code: 'CZ', dialCode: '+420', label: 'Czech Republic (+420)', digits: 9 },
    { code: 'DK', dialCode: '+45', label: 'Denmark (+45)', digits: 8 },
    { code: 'DJ', dialCode: '+253', label: 'Djibouti (+253)', digits: 8 },
    { code: 'DM', dialCode: '+1767', label: 'Dominica (+1767)', digits: 7 },
    { code: 'DO', dialCode: '+1809', label: 'Dominican Republic (+1809)', digits: 7 },
    { code: 'EC', dialCode: '+593', label: 'Ecuador (+593)', digits: 9, trunkPrefix: '0' },
    { code: 'EG', dialCode: '+20', label: 'Egypt (+20)', digits: 10, trunkPrefix: '0' },
    { code: 'SV', dialCode: '+503', label: 'El Salvador (+503)', digits: 8 },
    { code: 'GQ', dialCode: '+240', label: 'Equatorial Guinea (+240)', digits: 9 },
    { code: 'ER', dialCode: '+291', label: 'Eritrea (+291)', digits: 7 },
    { code: 'EE', dialCode: '+372', label: 'Estonia (+372)', digits: 8 },
    { code: 'SZ', dialCode: '+268', label: 'Eswatini (+268)', digits: 8 },
    { code: 'ET', dialCode: '+251', label: 'Ethiopia (+251)', digits: 9, trunkPrefix: '0' },
    { code: 'FK', dialCode: '+500', label: 'Falkland Islands (+500)', digits: 5 },
    { code: 'FO', dialCode: '+298', label: 'Faroe Islands (+298)', digits: 6 },
    { code: 'FJ', dialCode: '+679', label: 'Fiji (+679)', digits: 7 },
    { code: 'FI', dialCode: '+358', label: 'Finland (+358)', digits: 9, trunkPrefix: '0' },
    { code: 'FR', dialCode: '+33', label: 'France (+33)', digits: 9, trunkPrefix: '0' },
    { code: 'GF', dialCode: '+594', label: 'French Guiana (+594)', digits: 9 },
    { code: 'PF', dialCode: '+689', label: 'French Polynesia (+689)', digits: 8 },
    { code: 'GA', dialCode: '+241', label: 'Gabon (+241)', digits: 8 },
    { code: 'GM', dialCode: '+220', label: 'Gambia (+220)', digits: 7 },
    { code: 'GE', dialCode: '+995', label: 'Georgia (+995)', digits: 9 },
    { code: 'DE', dialCode: '+49', label: 'Germany (+49)', digits: 11, trunkPrefix: '0' },
    { code: 'GH', dialCode: '+233', label: 'Ghana (+233)', digits: 9, trunkPrefix: '0' },
    { code: 'GI', dialCode: '+350', label: 'Gibraltar (+350)', digits: 8 },
    { code: 'GR', dialCode: '+30', label: 'Greece (+30)', digits: 10 },
    { code: 'GL', dialCode: '+299', label: 'Greenland (+299)', digits: 6 },
    { code: 'GD', dialCode: '+1473', label: 'Grenada (+1473)', digits: 7 },
    { code: 'GP', dialCode: '+590', label: 'Guadeloupe (+590)', digits: 9 },
    { code: 'GU', dialCode: '+1671', label: 'Guam (+1671)', digits: 7 },
    { code: 'GT', dialCode: '+502', label: 'Guatemala (+502)', digits: 8 },
    { code: 'GN', dialCode: '+224', label: 'Guinea (+224)', digits: 9 },
    { code: 'GW', dialCode: '+245', label: 'Guinea-Bissau (+245)', digits: 7 },
    { code: 'GY', dialCode: '+592', label: 'Guyana (+592)', digits: 7 },
    { code: 'HT', dialCode: '+509', label: 'Haiti (+509)', digits: 8 },
    { code: 'HN', dialCode: '+504', label: 'Honduras (+504)', digits: 8 },
    { code: 'HK', dialCode: '+852', label: 'Hong Kong (+852)', digits: 8 },
    { code: 'HU', dialCode: '+36', label: 'Hungary (+36)', digits: 9, trunkPrefix: '06' },
    { code: 'IS', dialCode: '+354', label: 'Iceland (+354)', digits: 7 },
    { code: 'IN', dialCode: '+91', label: 'India (+91)', digits: 10, trunkPrefix: '0' },
    { code: 'ID', dialCode: '+62', label: 'Indonesia (+62)', digits: 11, trunkPrefix: '0' },
    { code: 'IR', dialCode: '+98', label: 'Iran (+98)', digits: 10, trunkPrefix: '0' },
    { code: 'IQ', dialCode: '+964', label: 'Iraq (+964)', digits: 10, trunkPrefix: '0' },
    { code: 'IE', dialCode: '+353', label: 'Ireland (+353)', digits: 9, trunkPrefix: '0' },
    { code: 'IL', dialCode: '+972', label: 'Israel (+972)', digits: 9, trunkPrefix: '0' },
    { code: 'IT', dialCode: '+39', label: 'Italy (+39)', digits: 10 },
    { code: 'JM', dialCode: '+1876', label: 'Jamaica (+1876)', digits: 7 },
    { code: 'JP', dialCode: '+81', label: 'Japan (+81)', digits: 10, trunkPrefix: '0' },
    { code: 'JO', dialCode: '+962', label: 'Jordan (+962)', digits: 9, trunkPrefix: '0' },
    { code: 'KZ', dialCode: '+7', label: 'Kazakhstan (+7)', digits: 10, trunkPrefix: '8' },
    { code: 'KE', dialCode: '+254', label: 'Kenya (+254)', digits: 9, trunkPrefix: '0' },
    { code: 'KI', dialCode: '+686', label: 'Kiribati (+686)', digits: 5 },
    { code: 'KP', dialCode: '+850', label: 'North Korea (+850)', digits: 10 },
    { code: 'KR', dialCode: '+82', label: 'South Korea (+82)', digits: 10, trunkPrefix: '0' },
    { code: 'KW', dialCode: '+965', label: 'Kuwait (+965)', digits: 8 },
    { code: 'KG', dialCode: '+996', label: 'Kyrgyzstan (+996)', digits: 9, trunkPrefix: '0' },
    { code: 'LA', dialCode: '+856', label: 'Laos (+856)', digits: 10, trunkPrefix: '0' },
    { code: 'LV', dialCode: '+371', label: 'Latvia (+371)', digits: 8 },
    { code: 'LB', dialCode: '+961', label: 'Lebanon (+961)', digits: 8, trunkPrefix: '0' },
    { code: 'LS', dialCode: '+266', label: 'Lesotho (+266)', digits: 8 },
    { code: 'LR', dialCode: '+231', label: 'Liberia (+231)', digits: 8 },
    { code: 'LY', dialCode: '+218', label: 'Libya (+218)', digits: 9, trunkPrefix: '0' },
    { code: 'LI', dialCode: '+423', label: 'Liechtenstein (+423)', digits: 7 },
    { code: 'LT', dialCode: '+370', label: 'Lithuania (+370)', digits: 8, trunkPrefix: '8' },
    { code: 'LU', dialCode: '+352', label: 'Luxembourg (+352)', digits: 9 },
    { code: 'MO', dialCode: '+853', label: 'Macau (+853)', digits: 8 },
    { code: 'MG', dialCode: '+261', label: 'Madagascar (+261)', digits: 9, trunkPrefix: '0' },
    { code: 'MW', dialCode: '+265', label: 'Malawi (+265)', digits: 9 },
    { code: 'MY', dialCode: '+60', label: 'Malaysia (+60)', digits: 9, trunkPrefix: '0' },
    { code: 'MV', dialCode: '+960', label: 'Maldives (+960)', digits: 7 },
    { code: 'ML', dialCode: '+223', label: 'Mali (+223)', digits: 8 },
    { code: 'MT', dialCode: '+356', label: 'Malta (+356)', digits: 8 },
    { code: 'MH', dialCode: '+692', label: 'Marshall Islands (+692)', digits: 7 },
    { code: 'MQ', dialCode: '+596', label: 'Martinique (+596)', digits: 9 },
    { code: 'MR', dialCode: '+222', label: 'Mauritania (+222)', digits: 8 },
    { code: 'MU', dialCode: '+230', label: 'Mauritius (+230)', digits: 8 },
    { code: 'MX', dialCode: '+52', label: 'Mexico (+52)', digits: 10 },
    { code: 'FM', dialCode: '+691', label: 'Micronesia (+691)', digits: 7 },
    { code: 'MD', dialCode: '+373', label: 'Moldova (+373)', digits: 8, trunkPrefix: '0' },
    { code: 'MC', dialCode: '+377', label: 'Monaco (+377)', digits: 8 },
    { code: 'MN', dialCode: '+976', label: 'Mongolia (+976)', digits: 8 },
    { code: 'ME', dialCode: '+382', label: 'Montenegro (+382)', digits: 8, trunkPrefix: '0' },
    { code: 'MS', dialCode: '+1664', label: 'Montserrat (+1664)', digits: 7 },
    { code: 'MA', dialCode: '+212', label: 'Morocco (+212)', digits: 9, trunkPrefix: '0' },
    { code: 'MZ', dialCode: '+258', label: 'Mozambique (+258)', digits: 9 },
    { code: 'MM', dialCode: '+95', label: 'Myanmar (+95)', digits: 9, trunkPrefix: '0' },
    { code: 'NA', dialCode: '+264', label: 'Namibia (+264)', digits: 9, trunkPrefix: '0' },
    { code: 'NR', dialCode: '+674', label: 'Nauru (+674)', digits: 7 },
    { code: 'NP', dialCode: '+977', label: 'Nepal (+977)', digits: 10 },
    { code: 'NL', dialCode: '+31', label: 'Netherlands (+31)', digits: 9, trunkPrefix: '0' },
    { code: 'NC', dialCode: '+687', label: 'New Caledonia (+687)', digits: 6 },
    { code: 'NZ', dialCode: '+64', label: 'New Zealand (+64)', digits: 9, trunkPrefix: '0' },
    { code: 'NI', dialCode: '+505', label: 'Nicaragua (+505)', digits: 8 },
    { code: 'NE', dialCode: '+227', label: 'Niger (+227)', digits: 8 },
    { code: 'NG', dialCode: '+234', label: 'Nigeria (+234)', digits: 10, trunkPrefix: '0' },
    { code: 'NU', dialCode: '+683', label: 'Niue (+683)', digits: 4 },
    { code: 'MK', dialCode: '+389', label: 'North Macedonia (+389)', digits: 8, trunkPrefix: '0' },
    { code: 'MP', dialCode: '+1670', label: 'Northern Mariana Islands (+1670)', digits: 7 },
    { code: 'NO', dialCode: '+47', label: 'Norway (+47)', digits: 8 },
    { code: 'OM', dialCode: '+968', label: 'Oman (+968)', digits: 8 },
    { code: 'PK', dialCode: '+92', label: 'Pakistan (+92)', digits: 10, trunkPrefix: '0' },
    { code: 'PW', dialCode: '+680', label: 'Palau (+680)', digits: 7 },
    { code: 'PS', dialCode: '+970', label: 'Palestine (+970)', digits: 9, trunkPrefix: '0' },
    { code: 'PA', dialCode: '+507', label: 'Panama (+507)', digits: 8 },
    { code: 'PG', dialCode: '+675', label: 'Papua New Guinea (+675)', digits: 8 },
    { code: 'PY', dialCode: '+595', label: 'Paraguay (+595)', digits: 9, trunkPrefix: '0' },
    { code: 'PE', dialCode: '+51', label: 'Peru (+51)', digits: 9 },
    { code: 'PH', dialCode: '+63', label: 'Philippines (+63)', digits: 10, trunkPrefix: '0' },
    { code: 'PL', dialCode: '+48', label: 'Poland (+48)', digits: 9 },
    { code: 'PT', dialCode: '+351', label: 'Portugal (+351)', digits: 9 },
    { code: 'PR', dialCode: '+1787', label: 'Puerto Rico (+1787)', digits: 7 },
    { code: 'QA', dialCode: '+974', label: 'Qatar (+974)', digits: 8 },
    { code: 'RE', dialCode: '+262', label: 'Réunion (+262)', digits: 9 },
    { code: 'RO', dialCode: '+40', label: 'Romania (+40)', digits: 9, trunkPrefix: '0' },
    { code: 'RU', dialCode: '+7', label: 'Russia (+7)', digits: 10, trunkPrefix: '8' },
    { code: 'RW', dialCode: '+250', label: 'Rwanda (+250)', digits: 9, trunkPrefix: '0' },
    { code: 'SH', dialCode: '+290', label: 'Saint Helena (+290)', digits: 4 },
    { code: 'KN', dialCode: '+1869', label: 'Saint Kitts and Nevis (+1869)', digits: 7 },
    { code: 'LC', dialCode: '+1758', label: 'Saint Lucia (+1758)', digits: 7 },
    { code: 'VC', dialCode: '+1784', label: 'Saint Vincent and the Grenadines (+1784)', digits: 7 },
    { code: 'WS', dialCode: '+685', label: 'Samoa (+685)', digits: 7 },
    { code: 'SM', dialCode: '+378', label: 'San Marino (+378)', digits: 10 },
    { code: 'ST', dialCode: '+239', label: 'São Tomé and Príncipe (+239)', digits: 7 },
    { code: 'SA', dialCode: '+966', label: 'Saudi Arabia (+966)', digits: 9, trunkPrefix: '0' },
    { code: 'SN', dialCode: '+221', label: 'Senegal (+221)', digits: 9 },
    { code: 'RS', dialCode: '+381', label: 'Serbia (+381)', digits: 9, trunkPrefix: '0' },
    { code: 'SC', dialCode: '+248', label: 'Seychelles (+248)', digits: 7 },
    { code: 'SL', dialCode: '+232', label: 'Sierra Leone (+232)', digits: 8, trunkPrefix: '0' },
    { code: 'SG', dialCode: '+65', label: 'Singapore (+65)', digits: 8 },
    { code: 'SX', dialCode: '+1721', label: 'Sint Maarten (+1721)', digits: 7 },
    { code: 'SK', dialCode: '+421', label: 'Slovakia (+421)', digits: 9, trunkPrefix: '0' },
    { code: 'SI', dialCode: '+386', label: 'Slovenia (+386)', digits: 8, trunkPrefix: '0' },
    { code: 'SB', dialCode: '+677', label: 'Solomon Islands (+677)', digits: 5 },
    { code: 'SO', dialCode: '+252', label: 'Somalia (+252)', digits: 8 },
    { code: 'ZA', dialCode: '+27', label: 'South Africa (+27)', digits: 9, trunkPrefix: '0' },
    { code: 'SS', dialCode: '+211', label: 'South Sudan (+211)', digits: 9, trunkPrefix: '0' },
    { code: 'ES', dialCode: '+34', label: 'Spain (+34)', digits: 9 },
    { code: 'LK', dialCode: '+94', label: 'Sri Lanka (+94)', digits: 9, trunkPrefix: '0' },
    { code: 'SD', dialCode: '+249', label: 'Sudan (+249)', digits: 9, trunkPrefix: '0' },
    { code: 'SR', dialCode: '+597', label: 'Suriname (+597)', digits: 7 },
    { code: 'SE', dialCode: '+46', label: 'Sweden (+46)', digits: 9, trunkPrefix: '0' },
    { code: 'CH', dialCode: '+41', label: 'Switzerland (+41)', digits: 9, trunkPrefix: '0' },
    { code: 'SY', dialCode: '+963', label: 'Syria (+963)', digits: 9, trunkPrefix: '0' },
    { code: 'TW', dialCode: '+886', label: 'Taiwan (+886)', digits: 9, trunkPrefix: '0' },
    { code: 'TJ', dialCode: '+992', label: 'Tajikistan (+992)', digits: 9 },
    { code: 'TZ', dialCode: '+255', label: 'Tanzania (+255)', digits: 9, trunkPrefix: '0' },
    { code: 'TH', dialCode: '+66', label: 'Thailand (+66)', digits: 9, trunkPrefix: '0' },
    { code: 'TL', dialCode: '+670', label: 'Timor-Leste (+670)', digits: 7 },
    { code: 'TG', dialCode: '+228', label: 'Togo (+228)', digits: 8 },
    { code: 'TK', dialCode: '+690', label: 'Tokelau (+690)', digits: 4 },
    { code: 'TO', dialCode: '+676', label: 'Tonga (+676)', digits: 5 },
    { code: 'TT', dialCode: '+1868', label: 'Trinidad and Tobago (+1868)', digits: 7 },
    { code: 'TN', dialCode: '+216', label: 'Tunisia (+216)', digits: 8 },
    { code: 'TR', dialCode: '+90', label: 'Turkey (+90)', digits: 10, trunkPrefix: '0' },
    { code: 'TM', dialCode: '+993', label: 'Turkmenistan (+993)', digits: 8, trunkPrefix: '8' },
    { code: 'TC', dialCode: '+1649', label: 'Turks and Caicos Islands (+1649)', digits: 7 },
    { code: 'TV', dialCode: '+688', label: 'Tuvalu (+688)', digits: 5 },
    { code: 'UG', dialCode: '+256', label: 'Uganda (+256)', digits: 9, trunkPrefix: '0' },
    { code: 'UA', dialCode: '+380', label: 'Ukraine (+380)', digits: 9, trunkPrefix: '0' },
    { code: 'AE', dialCode: '+971', label: 'United Arab Emirates (+971)', digits: 9, trunkPrefix: '0' },
    { code: 'GB', dialCode: '+44', label: 'United Kingdom (+44)', digits: 10, trunkPrefix: '0' },
    { code: 'US', dialCode: '+1', label: 'United States (+1)', digits: 10 },
    { code: 'UY', dialCode: '+598', label: 'Uruguay (+598)', digits: 8 },
    { code: 'UZ', dialCode: '+998', label: 'Uzbekistan (+998)', digits: 9 },
    { code: 'VU', dialCode: '+678', label: 'Vanuatu (+678)', digits: 7 },
    { code: 'VA', dialCode: '+379', label: 'Vatican City (+379)', digits: 10 },
    { code: 'VE', dialCode: '+58', label: 'Venezuela (+58)', digits: 10, trunkPrefix: '0' },
    { code: 'VN', dialCode: '+84', label: 'Vietnam (+84)', digits: 9, trunkPrefix: '0' },
    { code: 'WF', dialCode: '+681', label: 'Wallis and Futuna (+681)', digits: 6 },
    { code: 'YE', dialCode: '+967', label: 'Yemen (+967)', digits: 9, trunkPrefix: '0' },
    { code: 'ZM', dialCode: '+260', label: 'Zambia (+260)', digits: 9, trunkPrefix: '0' },
    { code: 'ZW', dialCode: '+263', label: 'Zimbabwe (+263)', digits: 9, trunkPrefix: '0' },
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
