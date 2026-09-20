import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { CATEGORIES, formatPct, rateFor } from "./data.js";

// ---------------------------------------------------------------------------
// Layout, in world units.
// X runs along a slab: x = 0 is the DeepSeek end (near the camera), x = W is
// the Fable end (far). Z runs through the stack: z = 0 is the back slab
// (highest DeepSeek over-refusal), the front slab is the lowest, and the
// title plinth sits in front of everything, like Fortune's "Federal level".
// ---------------------------------------------------------------------------
const W = 10;
const H_MAX = 11; // world height for 100 %
const H_MIN = 0.09; // so 0 % still reads as a thin plate
const SLAB_DEPTH = 0.5;
const SLAB_GAP = 0.35;
const PITCH = SLAB_DEPTH + SLAB_GAP;
const RAMP_START = 0.28; // left plateau ends here (fraction of W)
const RAMP_END = 0.64; // right plateau starts here
const STACK_DEPTH = CATEGORIES.length * PITCH - SLAB_GAP;
const PLINTH = { width: W * 0.34, depth: 2.8, height: 4.2, gap: 0.02 };
const PLINTH_Z0 = STACK_DEPTH + PLINTH.gap;
const PLINTH_X0 = W + 0.06;
const LABEL_MARGIN = 0.32;
// DeepSeek crest values are printed on the top face of the left plateau
// (any tag hanging off the left end would land on the taller slabs behind).
const CREST_INSET_LEFT = 0.3;

// Back → front: vermilion → amber → butter → cream. Ten stops for ten slabs.
const RAMP = [
  "#e93a17",
  "#ee5619",
  "#f2731d",
  "#f48f25",
  "#f5aa36",
  "#f5c34f",
  "#f4d873",
  "#f1e3a0",
  "#eee6c6",
  "#efeadd",
].map((hex) => new THREE.Color(hex));

const canvas = document.querySelector("#stage");
const labelRoot = document.querySelector("#labels");
const langButtons = [...document.querySelectorAll(".lang-switch button")];

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const labelRenderer = new CSS2DRenderer({ element: labelRoot });

const scene = new THREE.Scene();

// ---------------------------------------------------------------------------
// Camera: orthographic, looking from front-left-above so that +X projects
// up-right and +Z projects down-right, matching the reference composition.
// ---------------------------------------------------------------------------
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 200);
const VIEW_DIR = new THREE.Vector3(-1, 0.8, 1.02).normalize();
const focus = new THREE.Vector3(W * 0.5, H_MAX * 0.4, (PLINTH_Z0 + PLINTH.depth) * 0.5);
camera.position.copy(focus).addScaledVector(VIEW_DIR, 60);
camera.lookAt(focus);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(focus);
controls.enableZoom = false;
controls.enablePan = false;
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.rotateSpeed = 0.28;
const basePolar = controls.getPolarAngle();
const baseAzimuth = controls.getAzimuthalAngle();
controls.minPolarAngle = basePolar - THREE.MathUtils.degToRad(7);
controls.maxPolarAngle = basePolar + THREE.MathUtils.degToRad(7);
controls.minAzimuthAngle = baseAzimuth - THREE.MathUtils.degToRad(9);
controls.maxAzimuthAngle = baseAzimuth + THREE.MathUtils.degToRad(9);
controls.update();

// ---------------------------------------------------------------------------
// Slab geometry: a polyline profile (plateau → ramp → plateau) extruded
// along Z. Faces are shaded by baking colors into vertices, which gives the
// flat, printed look of the reference instead of a lit 3D render.
// ---------------------------------------------------------------------------
function toWorldHeight(pct) {
  return Math.max((pct / 100) * H_MAX, H_MIN);
}

function slabShape(hL, hR) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(W, 0);
  shape.lineTo(W, hR);
  shape.lineTo(W * RAMP_END, hR);
  shape.lineTo(W * RAMP_START, hL);
  shape.lineTo(0, hL);
  shape.closePath();
  return shape;
}

function paintVertices(geometry, base, crest) {
  const pos = geometry.attributes.position;
  const nor = geometry.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i += 1) {
    const nx = nor.getX(i);
    const ny = nor.getY(i);
    const nz = nor.getZ(i);
    const y = pos.getY(i);

    let facet;
    if (ny > 0.35) facet = 1.0 + 0.18 * ny; // top and ramp catch the light
    else if (nz > 0.9) facet = 0.93; // big front face
    else if (nx < -0.9) facet = 0.64; // left end, in shade
    else if (nz < -0.9) facet = 0.8; // back (hidden)
    else if (nx > 0.9) facet = 0.74; // right end (hidden)
    else facet = 0.5; // underside

    const t = crest > 0 ? THREE.MathUtils.clamp(y / crest, 0, 1) : 1;
    const gradient = 0.7 + 0.3 * t ** 0.75; // darker toward the ground
    c.copy(base).multiplyScalar(facet * gradient);
    colors[i * 3] = Math.min(c.r, 1);
    colors[i * 3 + 1] = Math.min(c.g, 1);
    colors[i * 3 + 2] = Math.min(c.b, 1);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

function slabGeometry(hL, hR, base) {
  const geometry = new THREE.ExtrudeGeometry(slabShape(hL, hR), {
    depth: SLAB_DEPTH,
    bevelEnabled: false,
    steps: 1,
  });
  paintVertices(geometry, base, Math.max(hL, hR));
  return geometry;
}

const slabMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });

// ---------------------------------------------------------------------------
// Labels: HTML tags anchored to 3D points and rotated to follow the projected
// X axis, so category names and percentages run along the slabs like the
// reference. `anchor` is "end" (text extends toward -X) or "start" (+X).
// ---------------------------------------------------------------------------
const tags = [];

function makeTag(className, text, anchor) {
  const wrap = document.createElement("div");
  wrap.className = "tag-wrap";
  const span = document.createElement("span");
  span.className = `tag ${className} ${anchor}`;
  span.textContent = text;
  wrap.appendChild(span);
  const object = new CSS2DObject(wrap);
  object.userData.span = span;
  object.userData.anchor = anchor;
  tags.push(object);
  return object;
}

let lastAngle = Number.NaN;
const v0 = new THREE.Vector3();
const v1 = new THREE.Vector3();
const screenAxis = { angle: 0, ux: 1, uy: 0, pxPerWorldY: 1 };

function toPixels(world, out) {
  out.copy(world).project(camera);
  out.x = ((out.x + 1) / 2) * window.innerWidth;
  out.y = ((1 - out.y) / 2) * window.innerHeight;
  return out;
}

function updateTagRotation() {
  toPixels(v0.set(0, 0, 0), v0);
  toPixels(v1.set(1, 0, 0), v1);
  const dx = v1.x - v0.x;
  const dy = v1.y - v0.y;
  const angle = THREE.MathUtils.radToDeg(Math.atan2(dy, dx));
  const len = Math.hypot(dx, dy) || 1;
  screenAxis.angle = angle;
  screenAxis.ux = dx / len;
  screenAxis.uy = dy / len;
  toPixels(v1.set(0, 1, 0), v1);
  screenAxis.pxPerWorldY = Math.abs(v1.y - v0.y) || 1;

  if (Math.abs(angle - lastAngle) < 0.05) return;
  lastAngle = angle;
  for (const tag of tags) {
    const shift = tag.userData.anchor === "end" ? "translate(-100%, -50%)" : "translate(0, -50%)";
    tag.userData.span.style.transform = `rotate(${angle.toFixed(2)}deg) ${shift}`;
  }
}

// ---------------------------------------------------------------------------
// Slabs
// ---------------------------------------------------------------------------
const stack = new THREE.Group();
scene.add(stack);

const slabs = [];
let lang = "mean";
const guideMaterial = new THREE.LineBasicMaterial({
  color: 0xe8e1d4,
  transparent: true,
  opacity: 0.42,
});

function makeGuide(points) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.Line(geometry, guideMaterial);
}

function updateGuide(line, points) {
  line.geometry.dispose();
  line.geometry = new THREE.BufferGeometry().setFromPoints(points);
}

function heightsFor(category, language) {
  return {
    left: rateFor(category.deepseek, language),
    right: rateFor(category.fable, language),
  };
}

function buildSlabs() {
  CATEGORIES.forEach((category, index) => {
    const target = heightsFor(category, lang);
    const mesh = new THREE.Mesh(slabGeometry(H_MIN, H_MIN, RAMP[index]), slabMaterial);
    mesh.position.set(0, 0, index * PITCH);
    stack.add(mesh);

    const zc = SLAB_DEPTH + 0.008;
    const categoryGuide = makeGuide([
      new THREE.Vector3(-0.55, 0.035, zc),
      new THREE.Vector3(0, 0.035, zc),
    ]);
    const leftGuide = makeGuide([
      new THREE.Vector3(0, toWorldHeight(target.left) + 0.025, zc),
      new THREE.Vector3(CREST_INSET_LEFT, toWorldHeight(target.left) + 0.025, zc),
    ]);
    const rightGuide = makeGuide([
      new THREE.Vector3(W, toWorldHeight(target.right) + 0.025, zc),
      new THREE.Vector3(W + LABEL_MARGIN, toWorldHeight(target.right) + 0.025, zc),
    ]);
    mesh.add(categoryGuide, leftGuide, rightGuide);

    const catTag = makeTag("tag-cat", category.label, "end");
    catTag.position.set(-0.55, 0.035, zc);
    mesh.add(catTag);

    const leftTag = makeTag("tag-pct ds", formatPct(target.left), "start");
    leftTag.position.set(CREST_INSET_LEFT, toWorldHeight(target.left) + 0.025, zc);
    mesh.add(leftTag);

    const rightTag = makeTag("tag-pct fable", formatPct(target.right), "start");
    rightTag.position.set(W + LABEL_MARGIN, toWorldHeight(target.right) + 0.025, zc);
    mesh.add(rightTag);

    slabs.push({
      category,
      base: RAMP[index],
      mesh,
      leftGuide,
      rightGuide,
      leftTag,
      rightTag,
      currentLeft: 0,
      currentRight: 0,
      targetLeft: target.left,
      targetRight: target.right,
      delay: index * 0.05,
    });
  });
}

function updateSlab(slab, leftPct, rightPct) {
  const next = slabGeometry(toWorldHeight(leftPct), toWorldHeight(rightPct), slab.base);
  slab.mesh.geometry.dispose();
  slab.mesh.geometry = next;
  const leftY = toWorldHeight(leftPct) + 0.025;
  const rightY = toWorldHeight(rightPct) + 0.025;
  slab.leftTag.position.y = leftY;
  slab.rightTag.position.y = rightY;
  updateGuide(slab.leftGuide, [
    new THREE.Vector3(0, leftY, SLAB_DEPTH + 0.008),
    new THREE.Vector3(CREST_INSET_LEFT, leftY, SLAB_DEPTH + 0.008),
  ]);
  updateGuide(slab.rightGuide, [
    new THREE.Vector3(W, rightY, SLAB_DEPTH + 0.008),
    new THREE.Vector3(W + LABEL_MARGIN, rightY, SLAB_DEPTH + 0.008),
  ]);
  slab.leftTag.userData.span.textContent = formatPct(leftPct);
  slab.rightTag.userData.span.textContent = formatPct(rightPct);
}

// ---------------------------------------------------------------------------
// Title plinth: a cream block in front of the stack with the title printed on
// its front face, echoing the "Federal level" block in the reference.
// ---------------------------------------------------------------------------
const LANG_LINE = {
  mean: "MEAN OF ENGLISH · CHINESE · HEBREW",
  en: "ENGLISH PROMPTS",
  zh: "CHINESE PROMPTS",
  he: "HEBREW PROMPTS",
};

const faceCanvas = document.createElement("canvas");
faceCanvas.width = 2048;
faceCanvas.height = Math.round(2048 * (PLINTH.height / PLINTH.width));
const faceTexture = new THREE.CanvasTexture(faceCanvas);
faceTexture.colorSpace = THREE.SRGBColorSpace;
faceTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

function drawPlinthFace() {
  const ctx = faceCanvas.getContext("2d");
  const w = faceCanvas.width;
  const h = faceCanvas.height;
  ctx.fillStyle = "#f3efe6";
  ctx.fillRect(0, 0, w, h);

  const pad = w * 0.075;
  const display = '"Barlow Condensed", "Arial Narrow", sans-serif';
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#1b1b1d";

  const big = h * 0.145;
  ctx.font = `700 ${big}px ${display}`;
  ctx.letterSpacing = "0.01em";
  ["OVER-REFUSAL", "ON BENIGN", "PROMPTS"].forEach((line, i) => {
    ctx.fillText(line, pad, pad + big * 0.88 + i * big * 0.92);
  });

  ctx.font = `600 ${h * 0.06}px ${display}`;
  ctx.letterSpacing = "0.14em";
  ctx.fillStyle = "#5f594f";
  ctx.fillText("BY TEST-CORPUS CATEGORY", pad, pad + big * 4.25);
  ctx.fillText(LANG_LINE[lang], pad, pad + big * 4.25 + h * 0.085);
  ctx.fillText("LEFT: DEEPSEEK   /   RIGHT: FABLE", pad, pad + big * 4.25 + h * 0.17);

  ctx.strokeStyle = "#1b1b1d";
  ctx.lineWidth = h * 0.006;
  ctx.beginPath();
  ctx.moveTo(pad, h - pad * 1.55);
  ctx.lineTo(w - pad, h - pad * 1.55);
  ctx.stroke();

  ctx.fillStyle = "#1b1b1d";
  ctx.font = `700 ${h * 0.072}px ${display}`;
  ctx.letterSpacing = "0.18em";
  ctx.fillText("THE 71ST LANGUAGE BENCH", pad, h - pad * 0.7);

  faceTexture.needsUpdate = true;
}

function buildPlinth() {
  const geometry = new THREE.BoxGeometry(PLINTH.width, PLINTH.height, PLINTH.depth);
  const flat = (hex) => new THREE.MeshBasicMaterial({ color: hex });
  const materials = [
    flat("#d9d4c8"), // +x (hidden)
    flat("#cfc9bc"), // -x, left end in shade
    flat("#faf8f2"), // +y, top
    flat("#8a857a"), // -y
    new THREE.MeshBasicMaterial({ map: faceTexture }), // +z, front
    flat("#d9d4c8"), // -z
  ];
  const mesh = new THREE.Mesh(geometry, materials);
  mesh.position.set(PLINTH_X0 + PLINTH.width / 2, PLINTH.height / 2, PLINTH_Z0 + PLINTH.depth / 2);
  stack.add(mesh);

  // A low cream rail joins the right endpoint of the final slab to the
  // editorial title block, keeping both parts on the same Fable axis.
  const railWidth = PLINTH_X0 - W + 0.8;
  const rail = new THREE.Mesh(
    new THREE.BoxGeometry(railWidth, 0.14, PLINTH.depth),
    [
      flat("#ddd8cc"),
      flat("#c9c3b7"),
      flat("#f7f3ea"),
      flat("#8a857a"),
      flat("#eee9df"),
      flat("#d2ccbf"),
    ],
  );
  rail.position.set(W - 0.4 + railWidth / 2, 0.07, PLINTH_Z0 + PLINTH.depth / 2);
  stack.add(rail);
}

// ---------------------------------------------------------------------------
// Framing: fit the projected bounding box of the whole composition into the
// space between masthead and footer, whatever the viewport aspect.
// ---------------------------------------------------------------------------
const REGION = { top: 0.17, bottom: 0.13, side: 0.05 };
const LABEL_REACH_LEFT = 3.6; // world-unit allowance for rotated left labels
const LABEL_REACH_RIGHT = 2.4;

// Points that must stay on screen: the real crest of every slab (at its
// tallest across languages, so switching does not reframe), the plinth, and
// room for the labels hanging off both ends.
function contentPoints() {
  const points = [];
  const langs = ["en", "zh", "he"];
  CATEGORIES.forEach((category, index) => {
    const z0 = index * PITCH;
    const hL = toWorldHeight(Math.max(...langs.map((l) => category.deepseek[l])));
    const hR = toWorldHeight(Math.max(...langs.map((l) => category.fable[l])));
    points.push(
      new THREE.Vector3(-LABEL_REACH_LEFT, 0, z0),
      new THREE.Vector3(-LABEL_REACH_LEFT * 0.4, hL + 0.5, z0),
      new THREE.Vector3(0, hL, z0),
      new THREE.Vector3(0, hL, z0 + SLAB_DEPTH),
      new THREE.Vector3(W, hR, z0),
      new THREE.Vector3(W + LABEL_REACH_RIGHT, hR + 0.4, z0 + SLAB_DEPTH),
      new THREE.Vector3(W, 0, z0 + SLAB_DEPTH),
    );
  });
  const zEnd = PLINTH_Z0 + PLINTH.depth;
  points.push(
    new THREE.Vector3(-LABEL_REACH_LEFT, 0, PLINTH_Z0),
    new THREE.Vector3(PLINTH_X0, PLINTH.height, zEnd),
    new THREE.Vector3(PLINTH_X0 + PLINTH.width, PLINTH.height, zEnd),
    new THREE.Vector3(PLINTH_X0, 0, zEnd),
    new THREE.Vector3(PLINTH_X0 + PLINTH.width, 0, zEnd),
    new THREE.Vector3(W + LABEL_REACH_RIGHT, 0, STACK_DEPTH),
  );
  return points;
}

const CONTENT_POINTS = contentPoints();
const corner = new THREE.Vector3();

function fitCamera() {
  camera.updateMatrixWorld();
  const view = camera.matrixWorldInverse;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const point of CONTENT_POINTS) {
    corner.copy(point).applyMatrix4(view);
    minX = Math.min(minX, corner.x);
    maxX = Math.max(maxX, corner.x);
    minY = Math.min(minY, corner.y);
    maxY = Math.max(maxY, corner.y);
  }

  const aspect = window.innerWidth / window.innerHeight;
  const availW = 1 - REGION.side * 2;
  const availH = 1 - REGION.top - REGION.bottom;
  const byWidth = (maxX - minX) / availW;
  const byHeight = (maxY - minY) / availH;
  let viewW;
  let viewH;
  if (byWidth / aspect > byHeight) {
    viewW = byWidth;
    viewH = viewW / aspect;
  } else {
    viewH = byHeight;
    viewW = viewH * aspect;
  }

  const regionCenterNdcY = (1 - REGION.top + REGION.bottom) - 1; // in [-1, 1]
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2 - regionCenterNdcY * (viewH / 2);
  camera.left = cx - viewW / 2;
  camera.right = cx + viewW / 2;
  camera.top = cy + viewH / 2;
  camera.bottom = cy - viewH / 2;
  camera.updateProjectionMatrix();
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  labelRenderer.setSize(w, h);
  fitCamera();
  lastAngle = Number.NaN;
}

// ---------------------------------------------------------------------------
// Language switch
// ---------------------------------------------------------------------------
function setLanguage(next) {
  lang = next;
  langButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.lang === next));
  });
  slabs.forEach((slab) => {
    const target = heightsFor(slab.category, lang);
    slab.targetLeft = target.left;
    slab.targetRight = target.right;
  });
  drawPlinthFace();
}

langButtons.forEach((button) => {
  button.addEventListener("click", () => setLanguage(button.dataset.lang));
});
window.addEventListener("resize", resize);

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
buildSlabs();
buildPlinth();
resize();
drawPlinthFace();

const fontsReady = document.fonts
  ? Promise.all([
      document.fonts.load('700 100px "Barlow Condensed"'),
      document.fonts.load('600 100px "Barlow Condensed"'),
    ]).catch(() => undefined)
  : Promise.resolve();
fontsReady.then(drawPlinthFace);

const clock = new THREE.Clock();
let elapsed = 0;

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;
  controls.update();

  for (const slab of slabs) {
    const reveal = easeOutCubic(THREE.MathUtils.clamp((elapsed - 0.15 - slab.delay) / 1.2, 0, 1));
    const goalLeft = slab.targetLeft * reveal;
    const goalRight = slab.targetRight * reveal;
    let left = THREE.MathUtils.damp(slab.currentLeft, goalLeft, 8, dt);
    let right = THREE.MathUtils.damp(slab.currentRight, goalRight, 8, dt);
    // Snap once close so the printed percentages match the report exactly.
    if (Math.abs(left - goalLeft) < 0.02) left = goalLeft;
    if (Math.abs(right - goalRight) < 0.02) right = goalRight;
    if (left !== slab.currentLeft || right !== slab.currentRight) {
      slab.currentLeft = left;
      slab.currentRight = right;
      updateSlab(slab, left, right);
    }
  }

  updateTagRotation();
  stack.updateMatrixWorld(true);
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
  requestAnimationFrame(tick);
}

tick();
