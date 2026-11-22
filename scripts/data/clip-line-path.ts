type Point = [number, number];
interface Bounds { left: number; right: number; top: number; bottom: number }

// Clip each segment against a rectangle without joining paths across excluded areas.
export function clipLinePath(path: Point[], bounds: Bounds, normalize: (point: Point) => Point): Point[][] {
  const paths: Point[][] = [];
  let current: Point[] | undefined;
  for (let index = 1; index < path.length; index += 1) {
    const start = path[index - 1];
    const end = path[index];
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    let enter = 0;
    let leave = 1;
    for (const [delta, distance] of [
      [-dx, start[0] - bounds.left], [dx, bounds.right - start[0]],
      [-dy, start[1] - bounds.top], [dy, bounds.bottom - start[1]],
    ]) {
      if (delta < 0) enter = Math.max(enter, distance / delta);
      else if (delta > 0) leave = Math.min(leave, distance / delta);
      else if (distance < 0) { enter = 1; leave = 0; }
    }
    if (enter >= leave) {
      current = undefined;
      continue;
    }
    const a = normalize(enter === 0 ? start : [start[0] + enter * dx, start[1] + enter * dy]);
    const b = normalize(leave === 1 ? end : [start[0] + leave * dx, start[1] + leave * dy]);
    if (a[0] === b[0] && a[1] === b[1]) continue;
    if (current && enter === 0 && current.at(-1)![0] === a[0] && current.at(-1)![1] === a[1]) {
      current.push(b);
    } else {
      current = [a, b];
      paths.push(current);
    }
    if (leave < 1) current = undefined;
  }
  return paths;
}
