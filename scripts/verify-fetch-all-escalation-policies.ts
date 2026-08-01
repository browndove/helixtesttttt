/**
 * Standalone checks for escalation policy list extraction + by-role backfill.
 * Run: npx tsx scripts/verify-fetch-all-escalation-policies.ts
 */
import assert from 'node:assert/strict';
import {
    backfillMissingRolePolicies,
    buildPolicyLookup,
    matchPolicyForRole,
    rolesNeedingPolicyBackfill,
} from '../src/lib/escalation-policy-join';
import { extractEscalationPoliciesArray } from '../src/lib/fetch-all-escalation-policies';

const roles = [
    { id: 'r1', name: 'WGH - Doctor On Duty - A&E' },
    { id: 'r2', name: 'WGH - PA On Duty' },
];

const pageOne = [
    { id: 'p2', role_id: 'r2', role_name: 'WGH - PA On Duty', steps: [{ id: 's' }] },
];

const extracted = extractEscalationPoliciesArray({ items: pageOne, total: 40 });
assert.equal(extracted.length, 1);
assert.equal(extracted[0]?.id, 'p2');

const missing = rolesNeedingPolicyBackfill(roles, pageOne);
assert.deepEqual(missing, ['r1']);
assert.equal(!!matchPolicyForRole(roles[1], buildPolicyLookup(pageOne)), true);
assert.equal(!!matchPolicyForRole(roles[0], buildPolicyLookup(pageOne)), false);

async function main() {
    const merged = await backfillMissingRolePolicies(roles, pageOne, async (roleId) => {
        if (roleId !== 'r1') return null;
        return {
            data: {
                id: 'p1',
                role_id: 'other-id',
                role_name: 'WGH - Doctor On Duty - A&E',
                steps: [{ id: 'a' }, { id: 'b' }],
            },
        };
    });

    assert.equal(merged.length, 2);
    const r1 = merged.find((p) => p.role_id === 'r1');
    assert.ok(r1);
    assert.equal(Array.isArray(r1?.steps) ? r1.steps.length : 0, 2);

    // Wrapped list envelope with junk keys still extracts policies.
    const wrapped = extractEscalationPoliciesArray({
        data: {
            policies: [
                { id: 'x', role_id: 'rx', role_name: 'Role X', steps: [] },
                { not: 'a policy' },
            ],
        },
    });
    assert.equal(wrapped.length, 1);
    assert.equal(wrapped[0]?.id, 'x');

    console.log('verify-fetch-all-escalation-policies: OK');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
