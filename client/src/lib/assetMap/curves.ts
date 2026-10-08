/** Quadratic curve between two points (lat/lng), bowed sideways by `bow` of the distance. */
export type LatLng = { lat: number; lng: number };

export function quadraticCurve(a: LatLng, b: LatLng, bow = 0.14, samples = 16): LatLng[] {
  const mx = (a.lng + b.lng) / 2;
  const my = (a.lat + b.lat) / 2;
  const dx = b.lng - a.lng;
  const dy = b.lat - a.lat;
  // Perpendicular offset; length = bow × distance.
  const cx = mx - dy * bow;
  const cy = my + dx * bow;
  const out: LatLng[] = [];
  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;
    const u = 1 - t;
    out.push({
      lng: u * u * a.lng + 2 * u * t * cx + t * t * b.lng,
      lat: u * u * a.lat + 2 * u * t * cy + t * t * b.lat,
    });
  }
  return out;
}
