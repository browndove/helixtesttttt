export default function RadialProgress({
    value,
    color,
    trackColor,
    label,
    size = 40,
    stroke = 4.5,
}: {
    /** 0–100. */
    value: number;
    color: string;
    trackColor: string;
    label: string;
    size?: number;
    stroke?: number;
}) {
    const percent = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const center = size / 2;

    return (
        <div
            role="img"
            aria-label={label}
            className="relative shrink-0 rounded-full bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06),0_4px_10px_-4px_rgba(15,23,42,0.14)]"
            style={{ width: size, height: size }}
        >
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
                <circle cx={center} cy={center} r={radius} fill="none" stroke={trackColor} strokeWidth={stroke} />
                {/* A round cap would still draw a dot at 0%. */}
                {percent > 0 ? (
                    <circle
                        cx={center}
                        cy={center}
                        r={radius}
                        fill="none"
                        stroke={color}
                        strokeWidth={stroke}
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={circumference * (1 - percent / 100)}
                        className="transition-[stroke-dashoffset] duration-700 ease-out"
                    />
                ) : null}
            </svg>
            <span aria-hidden className="absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums text-slate-700">
                {Math.round(percent)}%
            </span>
        </div>
    );
}
