import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getSession } from '@/lib/auth';

// DELETE a ward
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; wardId: string }> }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id, wardId } = await params;

    // Verify department belongs to this hospital
    const dept = await sql`SELECT id FROM departments WHERE id = ${id} AND hospital_id = ${session.hospitalId}`;
    if (dept.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await sql`DELETE FROM wards WHERE id = ${wardId} AND department_id = ${id}`;
    return NextResponse.json({ success: true });
}
