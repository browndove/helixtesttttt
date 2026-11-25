export type ReportLogo = {
    dataUrl: string;
    width: number;
    height: number;
};

const LOGO_PATH = "/assets/images/helix-logo.png";

let cached: ReportLogo | null | undefined;

function toDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error ?? new Error("Failed to read logo"));
        reader.readAsDataURL(blob);
    });
}

function measure(dataUrl: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => reject(new Error("Failed to decode logo"));
        img.src = dataUrl;
    });
}

/**
 * Load the Helix mark for embedding in the PDF. jsPDF needs raster data, not a URL.
 * Resolves to null when unavailable so report generation still succeeds without it.
 */
export async function loadReportLogo(): Promise<ReportLogo | null> {
    if (cached !== undefined) return cached;
    try {
        const res = await fetch(LOGO_PATH, { cache: "force-cache" });
        if (!res.ok) throw new Error(`Logo request failed: ${res.status}`);
        const dataUrl = await toDataUrl(await res.blob());
        const { width, height } = await measure(dataUrl);
        cached = width > 0 && height > 0 ? { dataUrl, width, height } : null;
    } catch {
        cached = null;
    }
    return cached;
}
