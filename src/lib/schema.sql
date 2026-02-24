-- Helix Admin Panel Schema
-- Run this against your Neon PostgreSQL database

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Hospitals
CREATE TABLE IF NOT EXISTS hospitals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    logo_url TEXT,
    license_type VARCHAR(50) DEFAULT 'Enterprise',
    license_expires_at TIMESTAMP,
    max_users INT DEFAULT 500,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Departments
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Floors
CREATE TABLE IF NOT EXISTS floors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL
);

-- 4. Wards
CREATE TABLE IF NOT EXISTS wards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL
);

-- 5. Roles
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    department VARCHAR(255),
    priority VARCHAR(50) DEFAULT 'Standard',
    type VARCHAR(50) DEFAULT 'duty-signin',
    routing VARCHAR(50) DEFAULT 'current-holder',
    alert_mode VARCHAR(50) DEFAULT 'direct',
    enabled BOOLEAN DEFAULT true,
    visible_in_directory BOOLEAN DEFAULT true,
    color VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 6. Role Permissions
CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    label VARCHAR(255) NOT NULL,
    enabled BOOLEAN DEFAULT false
);

-- 7. Staff
CREATE TABLE IF NOT EXISTS staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    role VARCHAR(100),
    department VARCHAR(255),
    access_level VARCHAR(50) DEFAULT 'Standard',
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW()
);

-- 8. Patients
CREATE TABLE IF NOT EXISTS patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    mrn VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    gender VARCHAR(20),
    date_of_birth DATE,
    department VARCHAR(255),
    ward VARCHAR(255),
    admitted_at DATE,
    status VARCHAR(50) DEFAULT 'admitted',
    created_at TIMESTAMP DEFAULT NOW()
);

-- 9. Escalation Config
CREATE TABLE IF NOT EXISTS escalation_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    battery_alerts_enabled BOOLEAN DEFAULT true,
    warning_threshold INT DEFAULT 20,
    critical_threshold INT DEFAULT 5,
    notify_user BOOLEAN DEFAULT true,
    notify_admin BOOLEAN DEFAULT true,
    notify_on_charge BOOLEAN DEFAULT false
);

-- 10. Routing Rules
CREATE TABLE IF NOT EXISTS routing_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    rule_key VARCHAR(50) NOT NULL,
    label VARCHAR(255) NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT false
);

-- 11. Escalation Scope
CREATE TABLE IF NOT EXISTS escalation_scope (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    department_name VARCHAR(255) NOT NULL,
    enabled BOOLEAN DEFAULT false
);

-- 12. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    user_name VARCHAR(255),
    action TEXT NOT NULL,
    category VARCHAR(100),
    ip_address VARCHAR(50),
    timestamp TIMESTAMP DEFAULT NOW()
);

-- 13. Admin Users
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    otp_secret TEXT,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_departments_hospital ON departments(hospital_id);
CREATE INDEX IF NOT EXISTS idx_floors_department ON floors(department_id);
CREATE INDEX IF NOT EXISTS idx_wards_department ON wards(department_id);
CREATE INDEX IF NOT EXISTS idx_roles_hospital ON roles(hospital_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_staff_hospital ON staff(hospital_id);
CREATE INDEX IF NOT EXISTS idx_patients_hospital ON patients(hospital_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_hospital ON audit_logs(hospital_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
