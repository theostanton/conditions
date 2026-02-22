import type {GeoJSONGeometry} from "@app-types";

/**
 * Ray-casting algorithm: cast a ray from the point to the right (+X)
 * and count how many polygon edges it crosses. Odd = inside, even = outside.
 */
function pointInRing(point: [number, number], ring: number[][]): boolean {
    const [x, y] = point;
    let inside = false;

    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0], yi = ring[i][1];
        const xj = ring[j][0], yj = ring[j][1];

        const intersect = ((yi > y) !== (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

        if (intersect) inside = !inside;
    }

    return inside;
}

/**
 * Check if a point is inside a polygon (with holes).
 * First ring is the outer boundary, subsequent rings are holes.
 */
function pointInPolygon(point: [number, number], coordinates: number[][][]): boolean {
    if (!pointInRing(point, coordinates[0])) return false;

    for (let i = 1; i < coordinates.length; i++) {
        if (pointInRing(point, coordinates[i])) return false;
    }

    return true;
}

/**
 * Check if a point [lng, lat] is inside a GeoJSON geometry.
 * Supports Polygon and MultiPolygon.
 */
export function pointInGeometry(point: [number, number], geometry: GeoJSONGeometry): boolean {
    if (geometry.type === 'Polygon') {
        return pointInPolygon(point, geometry.coordinates);
    }

    if (geometry.type === 'MultiPolygon') {
        return geometry.coordinates.some(polygon => pointInPolygon(point, polygon));
    }

    return false;
}
