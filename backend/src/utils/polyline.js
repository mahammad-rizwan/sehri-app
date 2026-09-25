/**
 * Google's encoded polyline format, precision 5.
 *
 * Hand-rolled rather than pulled in as a dependency: it is ~40 lines, and the
 * app decodes the same string with a matching TypeScript copy
 * (mobile/src/utils/polyline.ts). Keep the two in step.
 */

function encodeValue(v) {
  let value = v < 0 ? ~(v << 1) : v << 1;
  let out = '';
  while (value >= 0x20) {
    out += String.fromCharCode((0x20 | (value & 0x1f)) + 63);
    value >>= 5;
  }
  return out + String.fromCharCode(value + 63);
}

/** @param {{latitude:number, longitude:number}[]} points */
function encode(points) {
  let lastLat = 0;
  let lastLng = 0;
  let out = '';
  for (const p of points) {
    const lat = Math.round(p.latitude * 1e5);
    const lng = Math.round(p.longitude * 1e5);
    out += encodeValue(lat - lastLat) + encodeValue(lng - lastLng);
    lastLat = lat;
    lastLng = lng;
  }
  return out;
}

/** @returns {{latitude:number, longitude:number}[]} */
function decode(str) {
  const points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < str.length) {
    for (const axis of [0, 1]) {
      let result = 0;
      let shift = 0;
      let b;
      do {
        b = str.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 0) lat += delta;
      else lng += delta;
    }
    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

module.exports = { encode, decode };
