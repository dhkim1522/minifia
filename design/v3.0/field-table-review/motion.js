(function () {
  "use strict";

  const active = new WeakMap();
  const furniture = [
    { left: 39, right: 61, top: 53, bottom: 70 },
    { left: 0, right: 33, top: 0, bottom: 40 }
  ];
  const roomBounds = { left: 9, right: 91, top: 30, bottom: 94 };
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

  function inside(point, rect) {
    return point[0] > rect.left && point[0] < rect.right &&
      point[1] > rect.top && point[1] < rect.bottom;
  }

  function accessible(point) {
    return point[0] >= roomBounds.left && point[0] <= roomBounds.right &&
      point[1] >= roomBounds.top && point[1] <= roomBounds.bottom &&
      !furniture.some(rect => inside(point, rect));
  }

  function walkableEnd(target) {
    const [x, y] = [clamp(target[0], 9, 91), clamp(target[1], 30, 94)];
    const obstacle = furniture.find(rect => inside([x, y], rect));
    if (!obstacle) return [x, y];
    return [[obstacle.left, y], [obstacle.right, y], [x, obstacle.top], [x, obstacle.bottom]]
      .filter(accessible)
      .sort((a, b) => Math.hypot(a[0]-x, a[1]-y) - Math.hypot(b[0]-x, b[1]-y))[0];
  }

  // Intersect the open interior only, so two corners along one edge remain connected.
  function crosses(a, b, rect) {
    let enter = 0, leave = 1;
    const ranges = [[rect.left, rect.right], [rect.top, rect.bottom]];
    for (let axis = 0; axis < 2; axis++) {
      const delta = b[axis] - a[axis];
      const [lo, hi] = ranges[axis];
      if (!delta) {
        if (a[axis] <= lo || a[axis] >= hi) return false;
      } else {
        const t1 = (lo - a[axis]) / delta, t2 = (hi - a[axis]) / delta;
        enter = Math.max(enter, Math.min(t1, t2));
        leave = Math.min(leave, Math.max(t1, t2));
      }
    }
    return enter + 1e-8 < leave;
  }

  const corners = furniture.flatMap(r =>
    [[r.left,r.top], [r.right,r.top], [r.right,r.bottom], [r.left,r.bottom]].filter(accessible)
  );

  function route(start, end, size) {
    const length = (a, b) => Math.hypot((b[0]-a[0])*size[0]/100, (b[1]-a[1])*size[1]/100);
    const clear = (a, b) => !furniture.some(rect => crosses(a, b, rect));
    if (clear(start, end)) return [start, end];
    const nodes = [start, end, ...corners];
    const cost = nodes.map(() => Infinity), parent = nodes.map(() => -1), visited = new Set();
    cost[0] = 0;
    while (visited.size < nodes.length) {
      let next = -1;
      for (let i = 0; i < nodes.length; i++) {
        if (!visited.has(i) && Number.isFinite(cost[i]) && (next < 0 || cost[i] < cost[next])) next = i;
      }
      if (next < 0 || next === 1) break;
      visited.add(next);
      nodes.forEach((node, j) => {
        if (visited.has(j) || !clear(nodes[next], node)) return;
        const candidate = cost[next] + length(nodes[next], node);
        if (candidate < cost[j]) { cost[j] = candidate; parent[j] = next; }
      });
    }
    if (parent[1] < 0) return [start, end];
    const path = [];
    for (let i = 1; i >= 0; i = parent[i]) path.unshift(nodes[i]);
    return path;
  }

  function startPosition(actor, size) {
    return ["left", "top"].map((prop, axis) => {
      const value = actor.style[prop];
      return value.endsWith("%") ? parseFloat(value) : parseFloat(getComputedStyle(actor)[prop]) / size[axis] * 100;
    });
  }

  function place(actor, point) {
    actor.style.left = point[0] + "%";
    actor.style.top = point[1] + "%";
  }

  function cancel(world) {
    const stop = active.get(world);
    if (stop) stop();
  }

  function travel(world, actors, targets, done, together) {
    cancel(world);
    const size = [world.clientWidth || 360, world.clientHeight || 300];
    const plans = actors.map((actor, i) => {
      const start = startPosition(actor, size), end = targets[i];
      const points = route(start, end, size), lengths = [];
      let total = 0;
      for (let j = 1; j < points.length; j++) {
        total += Math.hypot((points[j][0]-points[j-1][0])*size[0]/100,
          (points[j][1]-points[j-1][1])*size[1]/100);
        lengths.push(total);
      }
      const previous = actor.style.transitionProperty;
      actor.style.transitionProperty = "none";
      return { actor, end, points, lengths, total, previous };
    });
    const longest = Math.max(0, ...plans.map(p => p.total));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduced || longest < 1 ? 0 :
      (together ? clamp(longest*3.5, 720, 1280) : clamp(longest*5, 180, 1500));
    let frame = 0;
    function stop() {
      cancelAnimationFrame(frame);
      plans.forEach(p => { p.actor.style.transitionProperty = p.previous; });
      active.delete(world);
    }
    active.set(world, stop);
    const began = performance.now();
    function tick(now) {
      const t = duration ? Math.min(1, Math.max(0, (now-began)/duration)) : 1;
      if (t === 1) {
        plans.forEach(p => place(p.actor, p.end));
        stop();
        if (done) done();
        return;
      }
      const eased = t*t*(3-2*t);
      plans.forEach(p => {
        if (!p.total) return;
        const distance = eased*p.total;
        const j = p.lengths.findIndex(offset => offset >= distance);
        const from = p.points[j], to = p.points[j+1], initial = j ? p.lengths[j-1] : 0;
        const fraction = (distance-initial)/(p.lengths[j]-initial || 1);
        place(p.actor, [from[0]+(to[0]-from[0])*fraction, from[1]+(to[1]-from[1])*fraction]);
      });
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
  }

  window.MfWalk = {
    move(world, actor, target, done) {
      travel(world, [actor], [walkableEnd(target)], done, false);
    },
    gather(world, actors, seatCoords, done) {
      travel(world, Array.from(actors), seatCoords, done, true);
    },
    cancel
  };
})();
