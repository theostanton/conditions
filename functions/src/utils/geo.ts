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
 * Compute the centroid of a GeoJSON geometry as [lng, lat].
 * Uses the arithmetic mean of all coordinates in the outer ring(s).
 */
export function getCentroid(geometry: GeoJSONGeometry): [number, number] {
    const points: number[][] = [];

    if (geometry.type === 'Polygon') {
        points.push(...geometry.coordinates[0]);
    } else if (geometry.type === 'MultiPolygon') {
        for (const polygon of geometry.coordinates) {
            points.push(...polygon[0]);
        }
    }

    if (points.length === 0) {
        throw new Error('Cannot compute centroid of empty geometry');
    }

    let sumLng = 0;
    let sumLat = 0;
    for (const [lng, lat] of points) {
        sumLng += lng;
        sumLat += lat;
    }

    return [sumLng / points.length, sumLat / points.length];
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
