interface range {
    start?: number,
    end?: number,
    size?: number,
}

export const RANGE_TYPE = "bytes";
const DEFAULT_RANGE:range = { start: 0, end: null };

export function getRange(range:string) {
    if (!range) return DEFAULT_RANGE;
    const match = String(range).match(RANGE_TYPE + "\\=(\\d+)\\-(\\d+)?");
    if (!match) return DEFAULT_RANGE;
    if (match.length < 2) return DEFAULT_RANGE;

    return { start: Number(match[1]), end: match[2] ? Number(match[2]) : null };
};

export function formatRange(options:range) {
    const { start, end, size } = options || {};
    if (
        typeof start !== "number" ||
        typeof end !== "number" ||
        typeof size !== "number" ||
        start < 0 ||
        end <= 0 ||
        size <= 0
    )
        return null;

    return `${RANGE_TYPE} ${start}-${end}/${size}`;
};