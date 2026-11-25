/** Nested objects a staff row may carry its profile fields on. */
const STAFF_PHOTO_NEST_KEYS = ['user', 'profile', 'staff', 'staff_member', 'account', 'person'] as const;

const STAFF_PHOTO_KEYS = [
    'profile_url', 'avatar_url', 'photo_url', 'profile_picture', 'profile_picture_url', 'profile_photo',
    'profile_photo_url', 'profile_image', 'profile_image_url', 'picture', 'picture_url', 'image_url', 'avatar', 'photo', 'image',
] as const;

function asRecord(v: unknown): Record<string, unknown> | null {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
    return v as Record<string, unknown>;
}

/** Usable image URL (http(s), protocol-relative, root-relative or data:image), else ''. */
function asPhotoUrl(v: unknown): string {
    if (typeof v === 'string') {
        const s = v.trim();
        return /^(https?:)?\/\/|^\/(?!\/)|^data:image\//i.test(s) ? s : '';
    }
    const rec = asRecord(v);
    return rec ? asPhotoUrl(rec.url ?? rec.src ?? rec.href) : '';
}

/** Profile picture from a staff row: known keys first, on the row and its nested user/profile objects. */
export function pickStaffPhotoUrl(r: Record<string, unknown>): string {
    const sources = [r, ...STAFF_PHOTO_NEST_KEYS.map(k => asRecord(r[k])).filter((x): x is Record<string, unknown> => !!x)];
    for (const src of sources) {
        for (const k of STAFF_PHOTO_KEYS) {
            const url = asPhotoUrl(src[k]);
            if (url) return url;
        }
    }
    return '';
}
