'use client';

import { useState, useEffect, useMemo } from 'react';
import Text from '@/components/text';
import InfoTooltip from '@/components/info-tooltip';
import { tailwindTextColors } from '@/lib/theme-colors';
import clsx from 'clsx';

const infoText =
    'Escalation index, critical message volume, and reply time by role. ' +
    'Bar = escalation rate index for that role (normalized across the four roles shown). ' +
    'The pill matches that index. Details: average first reply on critical threads, critical message count, and escalated critical count.';

function fmtCriticalReplyMin(minutes: unknown): string | null {
    if (minutes === undefined || minutes === null || minutes === '') return null;
    const n = typeof minutes === 'string' ? parseFloat(minutes) : Number(minutes);
    if (!Number.isFinite(n) || n < 0) return null;
    if (n === 0) return '0 min reply';
    if (n < 60) return `${Math.round(n)} min reply`;
    const h = Math.floor(n / 60);
    const m = Math.round(n % 60);
    return m > 0 ? `${h}h ${m}m reply` : `${h}h reply`;
}

function num(v: unknown): number {
    if (v === null || v === undefined || v === '') return 0;
    const n = typeof v === 'string' ? parseFloat(v) : Number(v);
    return Number.isFinite(n) ? n : 0;
}

export interface RoleMetricTrafficItem {
    role_id?: string;
    role_name: string;
    department_name?: string;
    escalation_rate_percent?: number;
    critical_messages?: number;
    standard_messages?: number;
    escalated_critical_messages?: number;
    avg_reply_response_minutes_critical?: number;
}

const COLORS: { color: string; bgColor: string; textColor: keyof typeof tailwindTextColors }[] = [
    { color: 'bg-[#6974f7]', bgColor: 'bg-[rgba(105,116,247,0.15)]', textColor: 'accent-violet' },
    { color: 'bg-[#e89b00]', bgColor: 'bg-[#E89B0026]', textColor: 'accent-orange' },
    { color: 'bg-accent-green', bgColor: 'bg-[rgba(0,200,179,0.15)]', textColor: 'accent-green' },
    { color: 'bg-accent-primary', bgColor: 'bg-[rgba(36,132,199,0.15)]', textColor: 'accent-primary' },
    { color: 'bg-accent-red', bgColor: 'bg-[rgba(255,95,87,0.15)]', textColor: 'accent-red' },
];

interface RoleCriticalTrafficProps {
    roles?: RoleMetricTrafficItem[];
}

const RoleCriticalTraffic = ({ roles = [] }: RoleCriticalTrafficProps) => {
    const [isHovered, setIsHovered] = useState(false);
    const [animatedPercentages, setAnimatedPercentages] = useState<number[]>([]);
    const [isVisible, setIsVisible] = useState(false);

    const rolesKey = JSON.stringify(roles);
    const topRoles = useMemo(() => {
        const list = Array.isArray(roles) ? [...roles] : [];
        return list
            .map((r) => ({
                ...r,
                _rate: num(r.escalation_rate_percent),
                _esc: num(r.escalated_critical_messages),
            }))
            .sort((a, b) => b._rate - a._rate || b._esc - a._esc)
            .slice(0, 4);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rolesKey]);

    const maxRate = useMemo(
        () => Math.max(...topRoles.map((r) => r._rate), 1),
        [topRoles]
    );

    useEffect(() => {
        setTimeout(() => setIsVisible(true), 100);

        setAnimatedPercentages(new Array(topRoles.length).fill(0));
        topRoles.forEach((role, index) => {
            setTimeout(() => {
                const targetRate = role._rate;
                const targetBarPercent = maxRate > 0 ? Math.min(100, (targetRate / maxRate) * 100) : 0;
                const duration = 1000;
                const startTime = Date.now();
                const animate = () => {
                    const elapsed = Date.now() - startTime;
                    const progress = Math.min(elapsed / duration, 1);
                    const eased = 1 - Math.pow(1 - progress, 3);

                    setAnimatedPercentages((prev) => {
                        const next = [...prev];
                        next[index] = Math.round(targetBarPercent * eased);
                        return next;
                    });

                    if (progress < 1) requestAnimationFrame(animate);
                };
                requestAnimationFrame(animate);
            }, 200 * (index + 1));
        });
    }, [topRoles, maxRate]);

    return (
        <div
            className={clsx(
                'bg-primary rounded-[15px] shadow-soft flex flex-col justify-between h-full min-h-[250px] w-full',
                'transition-all duration-500',
                isHovered && 'shadow-[0_8px_30px_rgba(0,0,0,0.1)]'
            )}
            style={{ padding: '20px 22px' }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="flex items-center justify-between gap-2">
                <Text variant="body-md-semibold" color="text-primary" className="min-w-0 truncate">
                    Role critical traffic
                </Text>
                <InfoTooltip text={infoText} show={isHovered} />
            </div>

            <div className="mt-4 flex flex-col gap-4">
                {topRoles.length === 0 && (
                    <Text variant="body-sm" color="text-secondary" className="text-center py-4">
                        No role messaging data available
                    </Text>
                )}
                {topRoles.map((role, index) => {
                    const style = COLORS[index % COLORS.length];
                    const badgeRate = Math.round(role._rate);
                    const criticalCount = Math.round(num(role.critical_messages));
                    const esc = Math.round(num(role.escalated_critical_messages));
                    const replyLabel = fmtCriticalReplyMin(role.avg_reply_response_minutes_critical);
                    const dept = String(role.department_name || '').trim();
                    const criticalLabel =
                        criticalCount === 1
                            ? '1 critical message'
                            : `${criticalCount.toLocaleString()} critical messages`;
                    const escalatedLabel =
                        esc === 1 ? '1 escalated critical' : `${esc.toLocaleString()} escalated critical`;
                    const detailParts = [replyLabel, criticalLabel, escalatedLabel].filter(Boolean);
                    const key = String(role.role_id || '').trim() || `${role.role_name}-${index}`;
                    return (
                        <div
                            key={key}
                            className={clsx(
                                'flex flex-col gap-2 transition-all duration-500',
                                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                            )}
                            style={{ transitionDelay: `${index * 150}ms` }}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <p className="min-w-0 flex-1 truncate text-[13px] leading-snug text-text-primary">
                                    <span className="font-semibold">{role.role_name || 'Role'}</span>
                                    {dept ? (
                                        <span className="font-normal text-text-secondary"> · {dept}</span>
                                    ) : null}
                                </p>
                                <div
                                    className={clsx(
                                        `${style.bgColor} shrink-0 rounded-full px-3.5 py-1.5`,
                                        'transition-transform duration-300',
                                        isHovered && 'scale-105'
                                    )}
                                >
                                    <Text variant="body-sm-semibold" color={style.textColor} className="whitespace-nowrap">
                                        {badgeRate}% index
                                    </Text>
                                </div>
                            </div>
                            {detailParts.length > 0 && (
                                <Text variant="body-xs" color="text-secondary" className="leading-relaxed line-clamp-2">
                                    {detailParts.join(' · ')}
                                </Text>
                            )}

                            <div className={`${style.bgColor} h-[7px] rounded-full w-full overflow-hidden`}>
                                <div
                                    className={clsx(`${style.color} h-full rounded-full`, 'transition-all duration-1000 ease-out')}
                                    style={{ width: `${animatedPercentages[index] ?? 0}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default RoleCriticalTraffic;
