const canvas = document.querySelector("#flowers");
const ctx = canvas.getContext("2d");

let flowers_config = [
  { path: "./flowers/flower1.svg" },
  { path: "./flowers/flower2.svg" },
  { path: "./flowers/flower3.svg" },
  { path: "./flowers/flower4.svg" },
  { path: "./flowers/flower5.svg" },
  { path: "./flowers/flower6.svg" },
  { path: "./flowers/flower7.svg" },
  { path: "./flowers/flower8.svg" },
];
let leaves_config = [{ path: "./flowers/leaf1.svg" }];
const view = { zoom: 1, s: 1, w: 0, h: 0, l: 0, r: 0, t: 0, b: 0 };
let c = {
  r: canvas.width * 0.5,
  b: canvas.height * 0.5,
  l: -canvas.width * 0.5,
  t: -canvas.height * 0.5,
};

async function load_svgs() {
  const load = async (path) => {
    const txt = await (await fetch(path)).text();
    const root = new DOMParser().parseFromString(
      txt,
      "image/svg+xml",
    ).documentElement;
    const marker = root.querySelector("#anchor");
    return {
      anchor: { x: marker.getAttribute("cx"), y: marker.getAttribute("cy") },
      paths: [...root.querySelectorAll("path")].map((p) => {
        return {
          path: new Path2D(p.getAttribute("d")),
          fill: p.getAttribute("fill"),
        };
      }),
    };
  };

  for (var flower of flowers_config) {
    flower.svg = await load(flower.path);
  }

  for (var leaf of leaves_config) {
    leaf.svg = await load(leaf.path);
  }
}

// https://gist.github.com/nicholaswmin/c2661eb11cad5671d816
function catmul_rom(points, alpha = 0.5) {
  if (!Array.isArray(points))
    throw TypeError(`'points' should be an Array. Got: ${typeof points}`);

  if (![0.5, 1].includes(alpha))
    throw RangeError(`'alpha' should be: 1 or 0.5. Got: ${alpha}`);

  let p0, p1, p2, p3, bp1, bp2, d1, d2, d3, A, B, N, M;
  let d3powA, d2powA, d3pow2A, d2pow2A, d1pow2A, d1powA;
  let d =
    "M" + Math.round(points.at(0).x) + "," + Math.round(points.at(0).y) + " ";

  for (let i = 0; i < points.length - 1; i++) {
    p0 = i == 0 ? points[0] : points[i - 1];
    p1 = points[i];
    p2 = points[i + 1];
    p3 = i + 2 < points.length ? points[i + 2] : p2;

    d1 = Math.sqrt(Math.pow(p0.x - p1.x, 2) + Math.pow(p0.y - p1.y, 2));
    d2 = Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    d3 = Math.sqrt(Math.pow(p2.x - p3.x, 2) + Math.pow(p2.y - p3.y, 2));

    d3powA = Math.pow(d3, alpha);
    d3pow2A = Math.pow(d3, 2 * alpha);
    d2powA = Math.pow(d2, alpha);
    d2pow2A = Math.pow(d2, 2 * alpha);
    d1powA = Math.pow(d1, alpha);
    d1pow2A = Math.pow(d1, 2 * alpha);

    A = 2 * d1pow2A + 3 * d1powA * d2powA + d2pow2A;
    B = 2 * d3pow2A + 3 * d3powA * d2powA + d2pow2A;
    N = 3 * d1powA * (d1powA + d2powA);

    if (N > 0) N = 1 / N;

    M = 3 * d3powA * (d3powA + d2powA);

    if (M > 0) M = 1 / M;

    bp1 = {
      x: (-d2pow2A * p0.x + A * p1.x + d1pow2A * p2.x) * N,
      y: (-d2pow2A * p0.y + A * p1.y + d1pow2A * p2.y) * N,
    };

    bp2 = {
      x: (d3pow2A * p1.x + B * p2.x - d2pow2A * p3.x) * M,
      y: (d3pow2A * p1.y + B * p2.y - d2pow2A * p3.y) * M,
    };

    if (bp1.x == 0 && bp1.y == 0) bp1 = p1;

    if (bp2.x == 0 && bp2.y == 0) bp2 = p2;

    d +=
      "C" +
      bp1.x +
      "," +
      bp1.y +
      " " +
      bp2.x +
      "," +
      bp2.y +
      " " +
      p2.x +
      "," +
      p2.y +
      " ";
  }

  return d;
}

const wind = { x: 0, v: 0, s: 0 };
let last_mx = null;
addEventListener("pointermove", (e) => {
  if (last_mx !== null) wind.s += e.clientX - last_mx;
  last_mx = e.clientX;
});

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

function wind_update(dt) {
  wind.v += clamp(wind.s, -60, 60) * 0.0015;
  wind.v += (-15.0 * wind.x - 1.0 * wind.v) * dt;
  wind.x += wind.v * dt;
  wind.s = 0;
}

const DEG = 180.0 / Math.PI;
function render_svg(svg, x, y, s, a, flip) {
  const m = new DOMMatrix()
    .translateSelf(x, y)
    .rotateSelf(a * DEG)
    .scaleSelf(flip ? -s : s, s)
    .translateSelf(-svg.anchor.x, -svg.anchor.y);
  for (const { path, fill } of svg.paths) {
    const transformed = new Path2D();
    transformed.addPath(path, m);
    if (fill) ctx.fill(transformed, "nonzero");
    ctx.stroke(transformed);
  }
}

const initial_seed = new Date();
let seed = initial_seed;
function rng(min = 0, max = 1) {
  seed = (Math.imul(seed, 747796405) + 2891336453) >>> 0;
  const state = seed;
  let word = (state >> ((state >> 28) + 4)) ^ state;
  word = Math.imul(word, 277803737);
  const val = (((word >>> 22) ^ word) >>> 0) / 0xffffffff;
  return min + val * (max - min);
}

function angle(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

function flower_generate(config) {
  const points = [];
  const leaves = [];

  const n = 5;
  const height = rng(c.b, canvas.height - 200);
  const x = c.r - 300 - rng(-20, 20);
  const start = { x: x, y: c.b };
  const end = { x: x + rng(-200, 200), y: c.b - height };
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const offset = t * rng(-1, 1) * 50.0;
    const x = start.x + (end.x - start.x) * t + offset;
    const y = start.y + (end.y - start.y) * t;
    points.push({ x, y });
    if (i > 1 && i < n - 1 && rng() > 0.5) {
      const flip = rng() > 0.5;
      const leaf = {
        svg: leaves_config[0].svg,
        x,
        y,
        lag: rng(0, 1),
        scale: rng(0.5, 1.0),
        flip,
        angle: angle(points.last(2), points.last()) + Math.PI * 0.5,
      };
      leaves.push(leaf);
      if (rng() > 0.9) leaves.push({ ...leaf, flip: !flip });
    }
  }

  return {
    path: new Path2D(catmul_rom(points)),
    origin: { x: points[0].x, y: points[0].y + 100 },
    leaves,
    sway: rng(0.6, 1.4),
    phase: rng(-0.5, 0.5),
    flower: {
      svg: config.svg,
      scale: rng(0.5, 1.0),
      x: points.last().x,
      y: points.last().y,
      angle: angle(points.last(2), points.last()) + Math.PI * 0.5,
    },
  };
}

function flower_render(flower, time) {
  const ambient = Math.sin(flower.phase + time) * 0.1;
  const angle = ambient + wind.x * flower.sway;

  ctx.save();
  ctx.translate(flower.origin.x, flower.origin.y);
  ctx.rotate(angle);
  ctx.translate(-flower.origin.x, -flower.origin.y);

  ctx.stroke(flower.path);
  for (const leaf of flower.leaves) {
    render_svg(
      leaf.svg,
      leaf.x,
      leaf.y,
      leaf.scale,
      leaf.angle + angle * 5.0 * leaf.lag,
      leaf.flip,
    );
  }
  render_svg(
    flower.flower.svg,
    flower.flower.x,
    flower.flower.y,
    flower.flower.scale,
    flower.flower.angle + angle * 0.5,
  );

  ctx.restore();
}

let last_time = 0;
function render(time) {
  time /= 1000;
  const dt = Math.min(0.05, time - last_time);
  last_time = time;

  wind_update(dt);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(view.s, 0, 0, view.s, canvas.width / 2, canvas.height / 2);
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#030308";
  ctx.fillStyle = "#FF7770";
  ctx.lineJoin = ctx.lineCap = "round";

  seed = initial_seed;
  time += rng(0.0, 100.0);

  const n_flowers = 5;
  const indices = [];
  for (let i = 0; i < n_flowers; i++) {
    indices.push(Math.floor(rng(0, flowers_config.length)));
  }

  const flowers = [];
  for (const i of indices) {
    flowers.push(flower_generate(flowers_config[i]));
  }

  // render stem
  for (const flower of flowers) {
    flower_render(flower, time);
  }

  requestAnimationFrame(render);
}

function resize() {
  const dpr = devicePixelRatio || 1;
  canvas.width = Math.round(canvas.clientWidth * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);

  view.s = view.zoom;
  view.w = canvas.width / view.s;
  view.h = canvas.height / view.s;
  view.l = -view.w / 2;
  view.r = view.w / 2;
  view.t = -view.h / 2;
  view.b = view.h / 2;

  c = {
    r: canvas.width * 0.5,
    b: canvas.height * 0.5,
    l: -canvas.width * 0.5,
    t: -canvas.height * 0.5,
  };
}

if (!Array.prototype.last) {
  Array.prototype.last = function (i = 1) {
    return this[this.length - i];
  };
}

addEventListener("resize", resize);

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await load_svgs();
    resize();
    requestAnimationFrame(render);
  } catch (e) {
    console.log(e);
  }
});
