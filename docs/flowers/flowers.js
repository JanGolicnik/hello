const canvas = document.querySelector("#flowers");
const ctx = canvas.getContext("2d");

const setup_orientation_button = document.querySelector("#setup-orientation-btn");

let flowers_config = [];
let leaves_config = [];
let view = { zoom: 1, s: 1, w: 0, h: 0, l: 0, r: 0, t: 0, b: 0 };

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
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

function rngi(min = 0, max = 1) {
  return Math.floor(rng(min, max));
}

function angle_between(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x) + Math.PI * 0.5;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function shuffle(array) {
  for (var i = array.length - 1; i > 0; i--) {
    var j = rngi(0, i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }
}

async function load_svgs() {
  const txt = await (await fetch("/flowers/all.svg")).text();
  const root = new DOMParser().parseFromString(
    txt,
    "image/svg+xml",
  ).documentElement;

  const load = (el) => {
    const marker = el.querySelector('circle');
    return {
      anchor: { x: marker.getAttribute("cx"), y: marker.getAttribute("cy") },
      paths: [...el.querySelectorAll("path")].map((p) => {
        return {
          path: new Path2D(p.getAttribute("d")),
          fill: p.getAttribute("fill"),
        };
      }),
    };
  };

  flowers_config = [...root.querySelectorAll('[id^="flower"]')].map((e) => {
    return { svg: load(e) };
  });
  leaves_config = [...root.querySelectorAll('[id^="leaf"]')].map((e) => {
    return { svg: load(e), nocolor: true };
  });
}

// modified from: https://gist.github.com/nicholaswmin/c2661eb11cad5671d816
function catmul_rom(points) {
  const alpha = 0.5;

  let p0, p1, p2, p3, bp1, bp2, d1, d2, d3, A, B, N, M;
  let d3powA, d2powA, d3pow2A, d2pow2A, d1pow2A, d1powA;
  let d = `M${Math.round(points.at(0).x)},${Math.round(points.at(0).y)} `;

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

    d += `C${bp1.x},${bp1.y} ${bp2.x},${bp2.y} ${p2.x},${p2.y} `;
  }

  return d;
}

const wind = { x: 0, v: 0, s: 0 };
const mouse = { x: null, y: null };
const orient = {};
async function try_setup_input() {
  if (DeviceOrientationEvent) {
    if (DeviceOrientationEvent.requestPermission) {
      const permission = "";
      try {
        permission = await DeviceOrientationEvent.requestPermission();
      } catch { }
      if (permission !== "granted") {
        if (setup_orientation_button.classList.contains("hidden")) {
          setup_orientation_button.classList.remove("hidden");
          return;
        }
      }
      setup_orientation_button.classList.add("hidden");
    }

    window.addEventListener("deviceorientation", (e) => {
      if (orient.alpha) wind.s += -(e.alpha - orient.alpha) * 10;
      orient.alpha = e.alpha;
    });
  }

  addEventListener("pointermove", (e) => {
    if (mouse.x !== null) wind.s += e.clientX - mouse.x;
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });
}

function wind_update(dt) {
  wind.v += clamp(wind.s, -60, 60) * 0.0015;
  wind.v += (-15.0 * wind.x - 1.0 * wind.v) * dt;
  wind.x += wind.v * dt;
  wind.s = 0;
}

const DEG = 180.0 / Math.PI;
function render_svg(o) {
  const m = new DOMMatrix()
    .translateSelf(o.x, o.y)
    .rotateSelf(o.angle * DEG)
    .scaleSelf(o.flip ? -o.scale : o.scale, o.scale)
    .translateSelf(-o.svg.anchor.x, -o.svg.anchor.y);
  for (const { path, fill } of o.svg.paths) {
    const transformed = new Path2D();
    transformed.addPath(path, m);
    if (fill) ctx.fill(transformed, "nonzero");
    ctx.stroke(transformed);
  }
}

let root = null;
function css_var(name) {
  root ??= getComputedStyle(document.querySelector(":root"));
  return root.getPropertyValue(`--${name}`);
}

function flower_render(flower, time, t) {
  const ambient = Math.sin(flower.phase + time) * 0.1;
  const angle = ambient + wind.x * flower.sway;

  ctx.save();
  ctx.translate(flower.origin.x, flower.origin.y);
  ctx.rotate(angle);
  ctx.translate(-flower.origin.x, -flower.origin.y);

  if (!view.small) ctx.globalAlpha = lerp(0.75, 1.0, flower.t);
  ctx.setLineDash([t * flower.len, flower.len]);
  ctx.stroke(flower.path);
  ctx.setLineDash([]);

  ctx.fillStyle = css_var("bg");
  for (const leaf of flower.leaves) {
    const p = flower.sample(leaf.t * t);
    render_svg({
      ...leaf,
      x: p.x,
      y: p.y,
      angle: angle * leaf.lag,
    });
  }

  if (!flower.config.nocolor) ctx.fillStyle = css_var("flower");
  const p1 = flower.sample(t);
  const p2 = flower.sample(t + 0.1);
  render_svg({
    svg: flower.config.svg,
    scale: flower.scale,
    flip: flower.flip,
    x: p1.x,
    y: p1.y,
    angle: angle_between(p1, p2) + angle * 0.5,
  });

  ctx.restore();
}

let flowers = [];
let last_time = 0;
let flower_t = 0;
function render(time) {
  time /= 1000;
  const dt = Math.min(0.05, time - last_time);
  last_time = time;

  wind_update(dt);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(view.s, 0, 0, view.s, canvas.width / 2, canvas.height / 2);
  ctx.lineWidth = 8;
  ctx.strokeStyle = css_var("flower-line");
  ctx.lineJoin = ctx.lineCap = "round";

  seed = initial_seed;
  time += rng(0.0, 100.0);

  const target_t = view.small
    ? 0.95
    : clamp(1.0 - mouse.y / canvas.height, 0.4, 0.95);
  flower_t += (target_t - flower_t) * (1.0 - Math.exp(-dt));
  for (const flower of flowers) {
    flower_render(flower, time, flower_t);
  }

  requestAnimationFrame(render);
}

function flower_generate(config, flower_t) {
  const { start, end } = (() => {
    const height = rng(view.b, canvas.height - 200);
    if (view.small) {
      const x = lerp(-1, 1, flower_t) * view.r * 0.75; // so they go a little offscreen :D
      console.log(x);
      const start = {
        x: x + 100 * rng(-1, 1),
        y: view.b,
      };
      const end = {
        x: start.x + 100 * rng(-1, 1),
        y: view.b - height,
      };
      return { start, end };
    }
    const x = view.r - 300 + rng(-30, 30);
    const start = { x: x, y: view.b };
    const end = {
      x: x - lerp(-1, 1, flower_t) * 200,
      y: view.b - height,
    };
    return { start, end };
  })();

  const points = [];
  const leaves = [];
  const n_points = 5;
  const dir = { x: end.x - start.x, y: end.y - start.y };
  for (let i = 0; i < n_points; i++) {
    const t = i / (n_points - 1);
    const offset = rng(-t, t) * 50.0;
    points.push({
      x: start.x + dir.x * t + offset,
      y: start.y + dir.y * t,
      t,
    });
  }

  for (const { t } of points) {
    if (rng() > 0.25 || t < 0.3 || t > 0.8) continue;
    const svg = leaves_config[rngi(0, leaves_config.length - 1)].svg;
    const flip = rng() > 0.5;
    const leaf = { svg, t, flip, lag: rng(1.0, 2.0), scale: rng(0.5, 1.0) };
    leaves.push(leaf);
    if (rng() > 0.9) leaves.push({ ...leaf, flip: !flip });
  }

  const catmul = catmul_rom(points);
  const el = document.createElementNS("http://www.w3.org/2000/svg", "path");
  el.setAttribute("d", catmul);
  const len = el.getTotalLength();

  return {
    path: new Path2D(catmul),
    sample: (t) => el.getPointAtLength(t * len),
    len,
    leaves,
    config,
    origin: { x: points[0].x, y: points[0].y + 100 },
    flip: rng() > 0.5,
    phase: rng(-0.5, 0.5),
    scale: rng(0.75, 1.0),
  };
}

function generate_flowers() {
  const n_flowers = 6;

  const indices = [];
  for (let i = 0; i < n_flowers; i++) indices.push(i);
  shuffle(indices);

  flowers = [];
  for (let i = 0; i < n_flowers; i++) {
    const configs = rng() > 0.3 ? leaves_config : flowers_config;
    const t = i / (n_flowers - 1);
    flowers.push({
      t,
      sway: lerp(0.3, 0.6, t),
      ...flower_generate(
        configs[rngi(0, configs.length)],
        indices[i] / (n_flowers - 1),
      ),
    });
  }
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
  view.small = css_var("small") === "true";

  seed = initial_seed;
  generate_flowers();
}

addEventListener("resize", resize);

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await try_setup_input();
    await load_svgs();
    resize();
    requestAnimationFrame(render);
  } catch (e) {
    console.log(e);
  }
});
