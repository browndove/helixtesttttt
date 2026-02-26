import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET all roles
export async function GET() {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const roles = await sql`
        SELECT id, name, description, department, mandatory, enabled, priority, visible_in_directory, escalation_routing, escalation_levels, created_at
        FROM roles
        WHERE hospital_id = ${session.hospitalId}
        ORDER BY name ASC
    `;

    return NextResponse.json(roles);
}

// POST create a new role
export async function POST(req: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { name, description, department, mandatory, priority, escalation_routing, escalation_levels } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Role name required' }, { status: 400 });

    const rows = await sql`
        INSERT INTO roles (hospital_id, name, description, department, mandatory, enabled, priority, escalation_routing, escalation_levels)
        VALUES (
            ${session.hospitalId},
            ${name.trim()},
            ${description || ''},
            ${department || ''},
            ${mandatory || false},
            true,
            ${priority || 'Standard'},
            ${JSON.stringify(escalation_routing || [])},
            ${JSON.stringify(escalation_levels || [])}
        )
        RETURNING id, name, description, department, mandatory, enabled, priority, visible_in_directory, escalation_routing, escalation_levels, created_at
    `;

    return NextResponse.json(rows[0], { status: 201 });
}
