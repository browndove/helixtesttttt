import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

/**
 * Lazy Neon client. Calling `neon()` at module load breaks `next build` when
 * DATABASE_URL is unset (e.g. Vercel Preview). Proxy routes do not use this.
 */
function createSql(): NeonQueryFunction<false, false> {
    const url = process.env.DATABASE_URL;
    if (!url) {
        throw new Error('DATABASE_URL is not set');
    }
    return neon(url);
}

let _sql: NeonQueryFunction<false, false> | undefined;

const sql = new Proxy(function sqlProxy() {} as unknown as NeonQueryFunction<false, false>, {
    apply(_target, _thisArg, argArray) {
        _sql ??= createSql();
        return (_sql as unknown as (...args: unknown[]) => unknown)(...argArray);
    },
    get(_target, prop, receiver) {
        _sql ??= createSql();
        const value = Reflect.get(_sql as object, prop, receiver);
        return typeof value === 'function' ? value.bind(_sql) : value;
    },
});

export default sql;
