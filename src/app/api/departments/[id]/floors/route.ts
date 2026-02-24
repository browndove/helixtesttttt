import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getSession } from '@/lib/auth';

// POST add a floor to a department
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { name } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });

    // Verify department belongs to this hospital
    const dept = await sql`SELECT id FROM departments WHERE id = ${id} AND hospital_id = ${session.hospitalId}`;
    if (dept.length === 0) return NextResponse.json({ error: 'Department not found' }, { status: 404 });

    const rows = await sql`INSERT INTO floors (department_id, name) VALUES (${id}, ${name.trim()}) RETURNING *`;
    return NextResponse.json(rows[0], { status: 201 });
}
