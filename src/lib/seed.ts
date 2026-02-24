import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { join } from 'path';

async function seed() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        console.error('DATABASE_URL not set');
        process.exit(1);
    }

    const sql = neon(databaseUrl);
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');

    // Strip comments and split into individual statements
    const cleaned = schema.replace(/--.*$/gm, '');
    const statements = cleaned
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

    console.log(`Running ${statements.length} schema statements...`);
    for (const statement of statements) {
        try {
            await sql.query(statement);
            const preview = statement.substring(0, 60).replace(/\n/g, ' ');
            console.log(`  ✓ ${preview}...`);
        } catch (stmtErr: unknown) {
            const msg = stmtErr instanceof Error ? stmtErr.message : String(stmtErr);
            console.error(`  ✗ Failed: ${statement.substring(0, 60)}...`);
            console.error(`    ${msg}`);
        }
    }

    // Seed default hospital
    console.log('\nSeeding default data...');

    const existing = await sql`SELECT id FROM hospitals WHERE name = 'Accra Medical Center'`;
    let hospitalId: string;

    if (existing.length > 0) {
        hospitalId = existing[0].id;
        console.log('  ✓ Hospital already exists');
    } else {
        const result = await sql`
            INSERT INTO hospitals (name, address, phone, email, license_type, license_expires_at, max_users)
            VALUES ('Accra Medical Center', 'Ridge, Accra, Greater Accra Region, Ghana', '+233 30 266 1111', 'admin@accramedical.com.gh', 'Enterprise', '2027-03-15', 500)
            RETURNING id
        `;
        hospitalId = result[0].id;
        console.log('  ✓ Hospital created');
    }

    // Seed departments
    const depts = [
        { name: 'Emergency Medicine', floors: ['Ground Floor'], wards: ['Emergency Bay A', 'Emergency Bay B', 'Triage'] },
        { name: 'ICU', floors: ['Floor 2'], wards: ['ICU A', 'ICU B', 'Neuro ICU'] },
        { name: 'Cardiology', floors: ['Floor 3'], wards: ['Cardiac Ward', 'Cath Lab'] },
        { name: 'Pediatrics', floors: ['Floor 1'], wards: ['Peds General', 'NICU'] },
        { name: 'Surgery', floors: ['Floor 2', 'Floor 3'], wards: ['Surgical Suite A', 'Surgical Suite B', 'Recovery'] },
    ];

    for (const dept of depts) {
        const existingDept = await sql`SELECT id FROM departments WHERE hospital_id = ${hospitalId} AND name = ${dept.name}`;
        let deptId: string;
        if (existingDept.length > 0) {
            deptId = existingDept[0].id;
        } else {
            const result = await sql`INSERT INTO departments (hospital_id, name) VALUES (${hospitalId}, ${dept.name}) RETURNING id`;
            deptId = result[0].id;
        }
        for (const floor of dept.floors) {
            const ef = await sql`SELECT id FROM floors WHERE department_id = ${deptId} AND name = ${floor}`;
            if (ef.length === 0) await sql`INSERT INTO floors (department_id, name) VALUES (${deptId}, ${floor})`;
        }
        for (const ward of dept.wards) {
            const ew = await sql`SELECT id FROM wards WHERE department_id = ${deptId} AND name = ${ward}`;
            if (ew.length === 0) await sql`INSERT INTO wards (department_id, name) VALUES (${deptId}, ${ward})`;
        }
        console.log(`  ✓ Department: ${dept.name}`);
    }

    // Seed escalation config
    const existingConfig = await sql`SELECT id FROM escalation_config WHERE hospital_id = ${hospitalId}`;
    if (existingConfig.length === 0) {
        await sql`INSERT INTO escalation_config (hospital_id) VALUES (${hospitalId})`;
        console.log('  ✓ Escalation config created');
    }

    // Seed routing rules
    const rules = [
        { key: 'by-dept', label: 'By Department', desc: 'Messages are escalated to staff within the same department.', enabled: true },
        { key: 'by-floor', label: 'By Floor', desc: 'Messages are escalated to the nearest available staff on the same floor.', enabled: false },
        { key: 'by-ward', label: 'By Ward / Unit', desc: 'Messages are routed to staff assigned to the same ward or unit.', enabled: true },
        { key: 'by-role', label: 'By Role Hierarchy', desc: 'Messages escalate up the role hierarchy (e.g. Nurse → Charge Nurse → Attending).', enabled: true },
    ];
    for (const rule of rules) {
        const er = await sql`SELECT id FROM routing_rules WHERE hospital_id = ${hospitalId} AND rule_key = ${rule.key}`;
        if (er.length === 0) {
            await sql`INSERT INTO routing_rules (hospital_id, rule_key, label, description, enabled) VALUES (${hospitalId}, ${rule.key}, ${rule.label}, ${rule.desc}, ${rule.enabled})`;
        }
    }
    console.log('  ✓ Routing rules seeded');

    // Seed escalation scope
    const scopeDepts = ['Emergency Dept', 'ICU', 'Cardiology', 'Pediatrics', 'Surgery', 'Neurology', 'Radiology'];
    const enabledScope = ['Emergency Dept', 'ICU', 'Surgery'];
    for (const dept of scopeDepts) {
        const es = await sql`SELECT id FROM escalation_scope WHERE hospital_id = ${hospitalId} AND department_name = ${dept}`;
        if (es.length === 0) {
            await sql`INSERT INTO escalation_scope (hospital_id, department_name, enabled) VALUES (${hospitalId}, ${dept}, ${enabledScope.includes(dept)})`;
        }
    }
    console.log('  ✓ Escalation scope seeded');

    // Seed sample staff
    const staffMembers = [
        { name: 'Dr. Ama Mensah', email: 'ama.mensah@accramedical.com.gh', role: 'Doctor', department: 'Cardiology', access_level: 'Full' },
        { name: 'Nurse Kofi Boateng', email: 'kofi.boateng@accramedical.com.gh', role: 'Nurse', department: 'ICU', access_level: 'Standard' },
        { name: 'Dr. Kwame Asante', email: 'kwame.asante@accramedical.com.gh', role: 'Doctor', department: 'Emergency Medicine', access_level: 'Full' },
        { name: 'Dr. Efua Adjei', email: 'efua.adjei@accramedical.com.gh', role: 'Doctor', department: 'Pediatrics', access_level: 'Full' },
        { name: 'Nurse Adwoa Tetteh', email: 'adwoa.tetteh@accramedical.com.gh', role: 'Nurse', department: 'Surgery', access_level: 'Standard' },
        { name: 'Yaw Darko', email: 'yaw.darko@accramedical.com.gh', role: 'Nurse', department: 'Cardiology', access_level: 'Limited' },
    ];
    for (const s of staffMembers) {
        const es = await sql`SELECT id FROM staff WHERE email = ${s.email}`;
        if (es.length === 0) {
            await sql`INSERT INTO staff (hospital_id, name, email, role, department, access_level) VALUES (${hospitalId}, ${s.name}, ${s.email}, ${s.role}, ${s.department}, ${s.access_level})`;
        }
    }
    console.log('  ✓ Staff seeded');

    // Seed sample patients
    const patientsList = [
        { mrn: 'MRN-001', name: 'Kweku Mensah', gender: 'Male', dob: '1985-03-12', department: 'Cardiology', ward: 'Cardiac Ward', admitted: '2026-02-10' },
        { mrn: 'MRN-002', name: 'Akua Boateng', gender: 'Female', dob: '1992-07-24', department: 'ICU', ward: 'ICU A', admitted: '2026-02-18' },
        { mrn: 'MRN-003', name: 'Yaw Frimpong', gender: 'Male', dob: '1978-11-05', department: 'Surgery', ward: 'Recovery', admitted: '2026-02-20' },
        { mrn: 'MRN-004', name: 'Esi Owusu', gender: 'Female', dob: '2020-01-15', department: 'Pediatrics', ward: 'Peds General', admitted: '2026-02-22' },
        { mrn: 'MRN-005', name: 'Kofi Agyeman', gender: 'Male', dob: '1965-08-30', department: 'Emergency Medicine', ward: 'Emergency Bay A', admitted: '2026-02-23' },
    ];
    for (const p of patientsList) {
        const ep = await sql`SELECT id FROM patients WHERE mrn = ${p.mrn}`;
        if (ep.length === 0) {
            await sql`INSERT INTO patients (hospital_id, mrn, name, gender, date_of_birth, department, ward, admitted_at) VALUES (${hospitalId}, ${p.mrn}, ${p.name}, ${p.gender}, ${p.dob}, ${p.department}, ${p.ward}, ${p.admitted})`;
        }
    }
    console.log('  ✓ Patients seeded');

    // Seed roles
    const rolesList = [
        { name: 'Trauma Surgeon', dept: 'Emergency Medicine', priority: 'Critical', type: 'duty-signin', routing: 'current-holder', alert_mode: 'direct', color: '#8c5a5e' },
        { name: 'ICU Charge Nurse', dept: 'ICU', priority: 'Critical', type: 'duty-signin', routing: 'current-holder', alert_mode: 'direct', color: '#4a6fa5' },
        { name: 'On-Call Cardiologist', dept: 'Cardiology', priority: 'High', type: 'role-pool', routing: 'all-members', alert_mode: 'round-robin', color: '#5a7d8c' },
        { name: 'Pediatrics Resident', dept: 'Pediatrics', priority: 'Standard', type: 'role-pool', routing: 'all-members', alert_mode: 'broadcast', color: '#5c8a6e' },
        { name: 'Radiology Tech Lead', dept: 'Radiology', priority: 'Standard', type: 'duty-signin', routing: 'current-holder', alert_mode: 'direct', color: '#8a7d5c' },
    ];
    const defaultPerms = [
        { label: 'View Patient Records', enabled: true },
        { label: 'Edit Care Plans', enabled: true },
        { label: 'Administer Medication', enabled: false },
        { label: 'Discharge Patients', enabled: false },
        { label: 'Access Lab Results', enabled: true },
        { label: 'View Billing Info', enabled: false },
    ];
    for (const r of rolesList) {
        const er = await sql`SELECT id FROM roles WHERE hospital_id = ${hospitalId} AND name = ${r.name}`;
        let roleId: string;
        if (er.length > 0) {
            roleId = er[0].id;
        } else {
            const result = await sql`INSERT INTO roles (hospital_id, name, department, priority, type, routing, alert_mode, color) VALUES (${hospitalId}, ${r.name}, ${r.dept}, ${r.priority}, ${r.type}, ${r.routing}, ${r.alert_mode}, ${r.color}) RETURNING id`;
            roleId = result[0].id;
        }
        for (const p of defaultPerms) {
            const ep = await sql`SELECT id FROM role_permissions WHERE role_id = ${roleId} AND label = ${p.label}`;
            if (ep.length === 0) {
                await sql`INSERT INTO role_permissions (role_id, label, enabled) VALUES (${roleId}, ${p.label}, ${p.enabled})`;
            }
        }
    }
    console.log('  ✓ Roles & permissions seeded');

    // Seed admin user
    const adminExists = await sql`SELECT id FROM admin_users WHERE email = 'admin@accramedical.com.gh'`;
    if (adminExists.length === 0) {
        await sql`INSERT INTO admin_users (hospital_id, name, email, password_hash, status) VALUES (${hospitalId}, 'Kwame Asante', 'admin@accramedical.com.gh', 'placeholder_hash', 'active')`;
        console.log('  ✓ Admin user seeded');
    }

    console.log('\n✅ Database seeded successfully!');
}

seed().catch(console.error);
