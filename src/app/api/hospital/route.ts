import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET hospital profile
export async function GET() {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rows = await sql`SELECT * FROM hospitals WHERE id = ${session.hospitalId}`;
    if (rows.length === 0) return NextResponse.json({ error: 'Hospital not found' }, { status: 404 });

    return NextResponse.json(rows[0]);
}

// PUT update hospital profile
export async function PUT(req: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { name, address, phone, email } = await req.json();

    await sql`
        UPDATE hospitals
        SET name = ${name}, address = ${address}, phone = ${phone}, email = ${email}, updated_at = NOW()
        WHERE id = ${session.hospitalId}
    `;

    return NextResponse.json({ success: true });
}
