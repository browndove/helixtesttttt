import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getSession } from '@/lib/auth';

// PUT update a role
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { name, department, mandatory, priority, enabled, visible_in_directory, escalation_routing, escalation_levels } = await req.json();

    const existing = await sql`SELECT id FROM roles WHERE id = ${id} AND hospital_id = ${session.hospitalId}`;
    if (existing.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const rows = await sql`
        UPDATE roles
        SET name = ${name}, department = ${department || ''}, mandatory = ${mandatory || false},
            priority = ${priority || 'Standard'},
            enabled = ${enabled ?? true}, visible_in_directory = ${visible_in_directory ?? true},
            escalation_routing = ${JSON.stringify(escalation_routing || [])},
            escalation_levels = ${JSON.stringify(escalation_levels || [])}
        WHERE id = ${id}
        RETURNING id, name, department, mandatory, enabled, priority, visible_in_directory, escalation_routing, escalation_levels, created_at
    `;

    return NextResponse.json(rows[0]);
}

// DELETE a role
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    const existing = await sql`SELECT id FROM roles WHERE id = ${id} AND hospital_id = ${session.hospitalId}`;
    if (existing.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await sql`DELETE FROM roles WHERE id = ${id}`;
    return NextResponse.json({ success: true });
}
