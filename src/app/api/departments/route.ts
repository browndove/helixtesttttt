import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getSession } from '@/lib/auth';
import { DEPARTMENT_NAME_MAX_LENGTH } from '@/lib/departmentName';

// GET all departments with floors and wards
export async function GET() {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const departments = await sql`
        SELECT id, name, created_at FROM departments WHERE hospital_id = ${session.hospitalId} ORDER BY created_at ASC
    `;

    const result = [];
    for (const dept of departments) {
        const floors = await sql`SELECT id, name FROM floors WHERE department_id = ${dept.id} ORDER BY name`;
        const wards = await sql`SELECT id, name FROM wards WHERE department_id = ${dept.id} ORDER BY name`;
        result.push({
            ...dept,
            floors: floors.map(f => ({ id: f.id, name: f.name })),
            wards: wards.map(w => ({ id: w.id, name: w.name })),
        });
    }

    return NextResponse.json(result);
}

// POST create a new department
export async function POST(req: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { name } = await req.json();
    const trimmed = typeof name === 'string' ? name.trim() : '';
    if (!trimmed) return NextResponse.json({ error: 'Name required' }, { status: 400 });
    if (trimmed.length > DEPARTMENT_NAME_MAX_LENGTH) {
        return NextResponse.json(
            { error: `Name must be ${DEPARTMENT_NAME_MAX_LENGTH} characters or fewer` },
            { status: 400 }
        );
    }

    const rows = await sql`
        INSERT INTO departments (hospital_id, name) VALUES (${session.hospitalId}, ${trimmed}) RETURNING *
    `;

    return NextResponse.json({ ...rows[0], floors: [], wards: [] }, { status: 201 });
}
