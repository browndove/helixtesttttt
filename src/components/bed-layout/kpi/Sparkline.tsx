const WIDTH = 88;
const HEIGHT = 32;
const PAD = 3;

/** Catmull-Rom through every point, converted to cubic Béziers so the line stays smooth without overshooting much. */
function smoothPath(points: { x: number; y: number }[]): string {
    if (points.length < 2) return '';
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i += 1) {
        const p0 = points[i - 1] ?? points[i];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[i + 2] ?? p2;
        const c1x = p1.x + (p2.x - p0.x) / 6;
        const c1y = p1.y + (p2.y - p0.y) / 6;
        const c2x = p2.x - (p3.x - p1.x) / 6;
        const c2y = p2.y - (p3.y - p1.y) / 6;
        d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
    }
    return d;
}

export default function Sparkline({ points, color, label }: { points: number[]; color: string; label: string }) {
    if (points.length < 2) return null;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const span = max - min || 1;
    const coords = points.map((value, index) => ({
        x: PAD + (index / (points.length - 1)) * (WIDTH - PAD * 2),
        y: PAD + (1 - (value - min) / span) * (HEIGHT - PAD * 2),
    }));
    const last = coords[coords.length - 1];

    return (
        <svg
            role="img"
            aria-label={label}
            width={WIDTH}
            height={HEIGHT}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="shrink-0 overflow-visible"
        >
            <path d={smoothPath(coords)} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={last.x} cy={last.y} r={4.5} fill={color} opacity={0.18} />
            <circle cx={last.x} cy={last.y} r={2.5} fill={color} stroke="#fff" strokeWidth={1} />
        </svg>
    );
}
