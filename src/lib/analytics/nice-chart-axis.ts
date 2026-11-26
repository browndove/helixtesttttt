function pickNiceStep(roughStep: number): number {
    if (roughStep <= 0) return 1;
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
    const normalized = roughStep / magnitude;
    const niceUnit =
        normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
    return niceUnit * magnitude;
}

/**
 * Y-axis max slightly above the data peak, with clean integer ticks.
 * Does not force a tall axis when the series only needs a few steps.
 */
export function buildNiceYAxisScale(dataMax: number, targetTickCount = 5) {
    if (dataMax <= 0) {
        return { max: 100, step: 20, tickAmount: 5 };
    }

    const paddedMax = dataMax * 1.12;
    let roughStep = paddedMax / targetTickCount;
    let step = pickNiceStep(roughStep);
    let tickAmount = Math.max(3, Math.ceil(paddedMax / step));
    let max = step * tickAmount;

    // If the scale is still much taller than the data, use a finer step.
    while (max > dataMax * 1.35 && step > 1) {
        const finer = pickNiceStep(step / 2);
        if (finer >= step) break;
        step = finer;
        tickAmount = Math.max(3, Math.ceil(paddedMax / step));
        max = step * tickAmount;
    }

    return { max, step, tickAmount };
}

const NICE_TIME_STEPS_MINUTES = [15, 30, 60, 120, 180, 240, 360, 480, 720] as const;

function pickNiceTimeStep(rangeMinutes: number, targetTickCount = 5): number {
    if (rangeMinutes <= 0) return 60;
    const rough = rangeMinutes / targetTickCount;
    for (const step of NICE_TIME_STEPS_MINUTES) {
        if (rough <= step * 1.25) return step;
    }
    return NICE_TIME_STEPS_MINUTES[NICE_TIME_STEPS_MINUTES.length - 1];
}

/**
 * Y-axis bounds for clock-time charts (minutes since midnight).
 * Snaps to clean intervals like 30m or 1h so labels read 2 PM, 3 PM, etc.
 */
export function buildNiceTimeAxisScale(
    values: number[],
    targetTickCount = 5
): { min: number; max: number; stepSize: number } {
    const defaultDayWindow = { min: 6 * 60, max: 18 * 60, stepSize: 120 };

    if (!values.length) return defaultDayWindow;

    const dataMin = Math.min(...values);
    const dataMax = Math.max(...values);
    const span = Math.max(dataMax - dataMin, 30);
    const padding = Math.max(30, span * 0.1);

    let roughMin = dataMin - padding;
    let roughMax = dataMax + padding;
    const range = Math.max(roughMax - roughMin, 60);
    const stepSize = pickNiceTimeStep(range, targetTickCount);

    const axisMin = Math.max(0, Math.floor(roughMin / stepSize) * stepSize);
    let axisMax = Math.ceil(roughMax / stepSize) * stepSize;

    if (axisMax <= axisMin) axisMax = axisMin + stepSize;

    // Cap tick count by widening step if needed.
    const tickCount = (axisMax - axisMin) / stepSize + 1;
    if (tickCount > targetTickCount + 2) {
        const widerStep = pickNiceTimeStep(range * 1.5, Math.max(4, targetTickCount - 1));
        const widerMin = Math.max(0, Math.floor(roughMin / widerStep) * widerStep);
        let widerMax = Math.ceil(roughMax / widerStep) * widerStep;
        if (widerMax <= widerMin) widerMax = widerMin + widerStep;
        return { min: widerMin, max: widerMax, stepSize: widerStep };
    }

    return { min: axisMin, max: axisMax, stepSize };
}
