import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import bcrypt from 'bcryptjs';
import { createSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
    try {
        const { email, password } = await req.json();

        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
        }

        const users = await sql`
            SELECT id, hospital_id, name, email, password_hash, status
            FROM admin_users
            WHERE email = ${email}
        `;

        if (users.length === 0) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        const user = users[0];

        if (user.status !== 'active') {
            return NextResponse.json({ error: 'Account disabled' }, { status: 403 });
        }

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        await createSession({
            userId: user.id,
            hospitalId: user.hospital_id,
            email: user.email,
            name: user.name,
        });

        return NextResponse.json({
            success: true,
            user: { id: user.id, name: user.name, email: user.email },
        });
    } catch (err) {
        console.error('Login error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
