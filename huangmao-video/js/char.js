// 黄毛理论 v2 · flat-vector character rig (front + side views). Units: 100 = body height; origin = between the feet.
import { c, PAL, shade, circ, ell, fillP, strokeP, line, arcLine, heart, path } from './draw.js';
import { clamp, lerp, hs, D2R, spline, heartPts, rot2 } from './lib.js';


const dirV = (a, s) => [s * Math.sin(a * D2R), Math.cos(a * D2R)]; // a=0 down, 90 outward, 180 up
function limb(x0, y0, a1, l1, a2, l2, s, w, col, col2 = null, hand = null, handR = 3.3) {
  const [dx1, dy1] = dirV(a1, s), [dx2, dy2] = dirV(a1 + a2, s);
  const x1 = x0 + dx1 * l1, y1 = y0 + dy1 * l1, x2 = x1 + dx2 * l2, y2 = y1 + dy2 * l2;
  c.lineCap = 'round'; c.lineJoin = 'round';
  if (col2 && col2 !== col) { line(x0, y0, x1, y1, col, w); line(x1, y1, x2, y2, col2, w * 0.92); circ(x1, y1, w * 0.46, col); }
  else { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.lineTo(x2, y2); c.strokeStyle = col; c.lineWidth = w; c.stroke(); }
  if (hand) circ(x2, y2, handR, hand);
  return { x1, y1, x2, y2 };
}
function shoe(x, y, col, dir = 0) { ell(x + dir * 1.6, y - 2.2, 5.6, 3.1, col); }

// ------------------------------------------------------------------ face
function face(o, hx, hy, R) {
  const turn = o.turn ?? 0, lk = o.look ?? [0, 0];
  const ex = 4.7, ey = hy - 0.6 + (o.eyeY ?? 0);
  const ox = hx + turn * 3.2 + lk[0] * 1.2, oy = lk[1] * 1.0;
  const ink = PAL.navy;
  // blush
  if ((o.blush ?? 0.8) > 0) { c.save(); c.globalAlpha *= 0.5 * (o.blush ?? 0.8); ell(ox - 7.6, hy + 3.6, 2.8, 1.7, PAL.blush); ell(ox + 7.6, hy + 3.6, 2.8, 1.7, PAL.blush); c.restore(); }
  const eyes = o.eyes ?? 'dot';
  for (const sx of [-1, 1]) {
    const x = ox + sx * ex, y = ey + oy;
    c.lineCap = 'round';
    if (eyes === 'dot') { ell(x, y, 1.55, (o.blink ? 0.25 : 1.75), ink); }
    else if (eyes === 'wide') { circ(x, y, 2.6, '#fff'); circ(x + lk[0] * 0.8, y + lk[1] * 0.6, 1.5, ink); }
    else if (eyes === 'happy') { arcLine(x, y + 1.2, 2.2, Math.PI * 1.1, Math.PI * 1.9, ink, 1.15); }
    else if (eyes === 'sleep' || eyes === 'closed') { arcLine(x, y - 1.0, 2.0, Math.PI * 0.15, Math.PI * 0.85, ink, 1.1); }
    else if (eyes === 'sad') { ell(x, y + 0.3, 1.45, 1.5, ink); }
    else if (eyes === 'x') { line(x - 1.6, y - 1.6, x + 1.6, y + 1.6, ink, 1.0); line(x - 1.6, y + 1.6, x + 1.6, y - 1.6, ink, 1.0); }
    else if (eyes === 'star') { c.save(); c.translate(x, y); c.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 0.9 : 2.6; c.lineTo(r * Math.cos(a), r * Math.sin(a)); } c.closePath(); c.fillStyle = ink; c.fill(); c.restore(); }
    else if (eyes === 'line') { line(x - 1.7, y, x + 1.7, y, ink, 1.1); }
    else if (eyes === 'cool') { line(x - 1.9, y - 0.2, x + 1.9, y - 0.2, ink, 1.4); }
  }
  // brows
  const br = o.brows ?? 'none';
  if (br !== 'none') {
    for (const sx of [-1, 1]) {
      const x = ox + sx * ex, y = ey - 3.9 + oy * 0.5;
      let a = 0, dy = 0;
      if (br === 'worried') a = sx * -0.38; else if (br === 'angry') a = sx * 0.4; else if (br === 'up') dy = -1.2; else if (br === 'cool') { a = sx * 0.18; }
      c.save(); c.translate(x, y + dy); c.rotate(a); line(-1.9, 0, 1.9, 0, o.browCol ?? ink, 1.0); c.restore();
    }
  }
  // glasses
  if (o.glasses) { const gc = o.glasses === true ? ink : o.glasses; for (const sx of [-1, 1]) { c.beginPath(); c.arc(ox + sx * ex, ey + oy, 3.7, 0, Math.PI * 2); c.lineWidth = 0.95; c.strokeStyle = gc; c.stroke(); } line(ox - ex + 3.7, ey + oy - 0.4, ox + ex - 3.7, ey + oy - 0.4, gc, 0.9); }
  if (o.shades) { for (const sx of [-1, 1]) { c.beginPath(); c.roundRect(ox + sx * ex - 3.4, ey + oy - 2.2, 6.8, 4.6, 1.8); c.fillStyle = PAL.navy; c.fill(); } line(ox - 1.4, ey + oy - 1, ox + 1.4, ey + oy - 1, PAL.navy, 1); }
  // mouth
  const m = o.mouth ?? 'smile', mx = ox + (o.mouthX ?? 0), my = hy + 5.4 + (o.mouthY ?? 0), mo = o.mouthOpen ?? 1;
  c.lineCap = 'round';
  if (m === 'smile') { arcLine(mx, my - 1.6, 2.6, Math.PI * 0.18, Math.PI * 0.82, ink, 1.1); }
  else if (m === 'flat') { line(mx - 1.8, my, mx + 1.8, my, ink, 1.1); }
  else if (m === 'frown') { arcLine(mx, my + 2.0, 2.3, Math.PI * 1.22, Math.PI * 1.78, ink, 1.1); }
  else if (m === 'o') { circ(mx, my + 0.2, 1.25 * mo, ink); }
  else if (m === 'smirk') { c.beginPath(); c.moveTo(mx - 2.3, my + 0.2); c.quadraticCurveTo(mx + 0.6, my + 1.4, mx + 2.6, my - 1.0); c.strokeStyle = ink; c.lineWidth = 1.1; c.stroke(); }
  else if (m === 'wavy') { c.beginPath(); for (let i = 0; i <= 8; i++) { const x = mx - 2.6 + (i / 8) * 5.2, y = my + 0.6 * Math.sin(i * Math.PI * 0.75); i ? c.lineTo(x, y) : c.moveTo(x, y); } c.strokeStyle = ink; c.lineWidth = 1.0; c.stroke(); }
  else if (m === 'grin' || m === 'open' || m === 'shout') {
    const w = m === 'grin' ? 3.6 : m === 'shout' ? 3.4 : 2.6, h = (m === 'grin' ? 3.0 : m === 'shout' ? 4.6 : 3.4) * mo;
    c.beginPath(); c.moveTo(mx - w, my - 1.0); c.quadraticCurveTo(mx, my - 1.6, mx + w, my - 1.0); c.quadraticCurveTo(mx + w * 0.9, my - 1 + h * 1.3, mx, my - 1 + h * 1.25); c.quadraticCurveTo(mx - w * 0.9, my - 1 + h * 1.3, mx - w, my - 1.0); c.closePath();
    c.fillStyle = '#3a1630'; c.fill();
    c.save(); c.clip(); if (m === 'grin') { c.fillStyle = '#fff'; c.fillRect(mx - w, my - 2, w * 2, 1.9); } ell(mx, my - 1 + h * 1.2, w * 0.7, h * 0.45, '#ff6f8a'); c.restore();
  }
  // sweat
  if ((o.sweat ?? 0) > 0) { const s = o.sweat; c.save(); c.translate(hx + 12.4, hy - 6.5 + (1 - s) * -2); c.scale(s, s); c.beginPath(); c.moveTo(0, -4.2); c.quadraticCurveTo(2.9, 0.2, 0, 2.6); c.quadraticCurveTo(-2.9, 0.2, 0, -4.2); c.fillStyle = '#7fd3ff'; c.fill(); circ(-0.6, 0.6, 0.6, '#fff'); c.restore(); }
}

// ------------------------------------------------------------------ hair (front)
function hairBack(o, hx, hy, R) {
  const st = o.hair ?? 'neat', col = o.hairCol ?? PAL.hairK;
  if (st === 'long') { c.beginPath(); c.moveTo(hx - R * 1.12, hy - 2); c.quadraticCurveTo(hx - R * 1.35, hy + 16, hx - R * 1.05, hy + 21); c.lineTo(hx + R * 1.05, hy + 21); c.quadraticCurveTo(hx + R * 1.35, hy + 16, hx + R * 1.12, hy - 2); c.closePath(); c.fillStyle = shade(col, -0.12); c.fill(); }
  if (st === 'bun' || st === 'grandma') circ(hx + (st === 'grandma' ? 0 : 0), hy - R - 3.6, st === 'grandma' ? 5.2 : 6.0, shade(col, -0.05));
}
function capPts(hx, hy, R, k = 1.075, a0 = 0.22) { const P = []; for (let i = 0; i <= 18; i++) { const a = Math.PI + a0 + (i / 18) * (Math.PI - 2 * a0); P.push([hx + R * k * Math.cos(a), hy + R * k * Math.sin(a)]); } return P; }
function hairFront(o, hx, hy, R, t) {
  const st = o.hair ?? 'neat', col = o.hairCol ?? PAL.hairK, hi = shade(col, 0.28), lo = shade(col, -0.18);
  const bounce = o.hairBounce ?? 0;
  if (st === 'none' || st === 'bald') { if (st === 'bald') { c.save(); c.globalAlpha *= 0.35; ell(hx - 4, hy - 8.5, 3.6, 1.8, '#fff', -0.5); c.restore(); } return; }
  if (st === 'spiky') {
    // 黄毛: tall flame-free spikes, two-tone + highlight
    const tips = [[-14.6, -3.2], [-15.2, -12.5], [-11.2, -21.5], [-3.6, -26.5], [5.2, -25.2], [12.4, -19.2], [15.6, -9.2], [14.6, -2.6]];
    const P = [[hx - R * 1.02, hy + 0.5]];
    for (let i = 0; i < tips.length; i++) {
      const [tx, ty] = tips[i]; const k = i / (tips.length - 1);
      const sw = Math.sin(t * 6 + i * 1.3) * 0.4 + bounce * (2.6 * Math.sin(i * 2.1 + 1));
      P.push([hx + tx * 1.0 + sw * 0.4, hy + ty - bounce * 1.6 * (1 - Math.abs(k - 0.5))]);
      if (i < tips.length - 1) { const [nx, ny] = tips[i + 1]; const mx = (tx + nx) / 2, my = (ty + ny) / 2; const d = Math.hypot(mx, my); P.push([hx + mx * (12.6 / d) * 1.08, hy + my * (12.6 / d) * 1.08]); }
    }
    P.push([hx + R * 1.02, hy + 0.5]);
    // fringe (jagged)
    const F = [[12.6, -1.2], [10.4, -7.2], [7.6, -5.0], [5.6, -9.6], [2.0, -6.6], [-1.6, -10.6], [-4.6, -6.6], [-7.8, -9.6], [-10.2, -5.0], [-12.6, -1.2]];
    for (const [fx, fy] of F) P.push([hx + fx, hy + fy]);
    fillP(P, col);
    // inner shade on the right side
    c.save(); path(P); c.clip(); ell(hx + 10, hy - 4, 9, 16, lo, 0.4); c.restore();
    // highlight strokes
    c.save(); c.globalAlpha *= 0.85; strokeP([[hx - 8, hy - 14], [hx - 9.6, hy - 18.2]], PAL.yelL, 1.5); strokeP([[hx - 2.2, hy - 17.5], [hx - 2.8, hy - 22.4]], PAL.yelL, 1.5); c.restore();
    return;
  }
  if (st === 'tuft') { // baby/kid: thin light cap + three curly strands
    const P = capPts(hx, hy, R, 1.05, 0.5);
    for (const [fx, fy] of [[10.5, -6.5], [5, -8.8], [0, -7.2], [-5, -9], [-10.5, -6.5]]) P.push([hx + fx, hy + fy]);
    fillP(P, col);
    c.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const bx = hx - 3 + i * 3, by = hy - R * 1.02, sw = Math.sin(t * 5 + i * 2) * 0.9 + bounce * 2 * (i - 1);
      c.beginPath(); c.moveTo(bx, by + 1); c.bezierCurveTo(bx - 1 + sw, by - 5, bx + 4 + sw, by - 8, bx + 1.5 + sw * 1.3, by - 10.5 - i % 2 * 1.2); c.strokeStyle = col; c.lineWidth = 2.1; c.stroke();
    }
    return;
  }
  if (st === 'old') { // receding: side tufts + 3 strands
    for (const sx of [-1, 1]) { c.beginPath(); c.ellipse(hx + sx * R * 0.92, hy - 3, 3.2, 6.2, sx * 0.25, 0, Math.PI * 2); c.fillStyle = col; c.fill(); }
    c.lineCap = 'round'; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(hx - 4 + i * 4, hy - R + 0.6); c.quadraticCurveTo(hx - 3 + i * 4, hy - R - 3.2, hx - 1 + i * 4, hy - R - 2.6); c.strokeStyle = col; c.lineWidth = 0.9; c.stroke(); }
    return;
  }
  const P = capPts(hx, hy, R, st === 'grandma' ? 1.1 : 1.075, st === 'long' || st === 'bob' ? -0.05 : 0.22);
  if (st === 'neat') for (const [fx, fy] of [[12.2, -2.6], [11.0, -6.8], [6.4, -9.8], [0.6, -10.6], [-5.6, -11.6], [-6.4, -9.2], [-10.6, -6.2], [-12.2, -2.6]]) P.push([hx + fx, hy + fy]);
  else if (st === 'bun' || st === 'grandma') for (const [fx, fy] of [[12.2, -2.2], [10.2, -7.8], [4.5, -10.6], [0, -9.4], [-4.5, -10.6], [-10.2, -7.8], [-12.2, -2.2]]) P.push([hx + fx, hy + fy]);
  else if (st === 'short') for (const [fx, fy] of [[12.4, -3], [10.6, -7.6], [6, -9.4], [3.6, -7.8], [-1.6, -10.2], [-6.6, -8.4], [-10.8, -6.8], [-12.4, -3]]) P.push([hx + fx, hy + fy]);
  else if (st === 'long' || st === 'bob') for (const [fx, fy] of [[13.6, 9], [12.6, -1], [9.8, -6.6], [3.5, -8.4], [0.8, -6.8], [-3.2, -9.4], [-9.8, -7.6], [-12.6, -1], [-13.6, 9]]) P.push([hx + fx, hy + fy]);
  else if (st === 'slick') for (const [fx, fy] of [[12.4, -2.8], [11.4, -8.4], [3, -11.2], [-6, -10.4], [-11.4, -6.6], [-12.4, -2.8]]) P.push([hx + fx, hy + fy]);
  fillP(P, col);
  if (st === 'short') { circ(hx + 3, hy - R * 1.1, 3.4, col); circ(hx - 3.5, hy - R * 1.12, 3.0, col); }
  // soft highlight
  c.save(); c.globalAlpha *= 0.45; arcLine(hx - 1, hy - 1, R * 0.94, Math.PI * 1.22, Math.PI * 1.42, hi, 1.4); c.restore();
}

// ------------------------------------------------------------------ hats
function hat(o, hx, hy, R) {
  if (o.hat === 'top') { const col = PAL.navy; c.save(); c.translate(hx + 1, hy - R * 0.92); c.rotate(o.hatR ?? -0.08); c.beginPath(); c.roundRect(-9.5, -17, 19, 17, 2); c.fillStyle = col; c.fill(); c.fillStyle = PAL.coral; c.fillRect(-9.5, -4.6, 19, 3.2); ell(0, 0.4, 15, 2.6, col); c.restore(); }
  if (o.hat === 'helmet') { c.beginPath(); c.arc(hx, hy - 1, R * 1.2, Math.PI, 0); c.lineTo(hx + R * 1.2, hy + 1.5); c.lineTo(hx - R * 1.2, hy + 1.5); c.closePath(); c.fillStyle = o.hatCol ?? PAL.coral; c.fill(); c.save(); c.globalAlpha *= 0.5; arcLine(hx - 2, hy - 3, R * 0.95, Math.PI * 1.2, Math.PI * 1.45, '#fff', 2); c.restore(); }
  if (o.hat === 'cap') { c.beginPath(); c.arc(hx, hy - 3, R * 1.08, Math.PI, 0); c.closePath(); c.fillStyle = o.hatCol ?? PAL.blue; c.fill(); ell(hx + 7, hy - 3, 9, 2.2, shade(o.hatCol ?? PAL.blue, -0.2)); }
}

// ------------------------------------------------------------------ torso
function torso(o, hunch) {
  const top = o.top ?? PAL.blue2, sty = o.topStyle ?? 'tee';
  const sw = o.shoulderW ?? 13.4, ww = o.waistW ?? 10.8, sy = -72.5 + hunch * 2.2, wy = -41;
  const P = spline([[-sw * 0.55, sy - 0.8], [-sw * 0.94, sy + 0.9], [-sw, sy + 6.5], [-ww - 0.6, wy - 9], [-ww, wy], [ww, wy], [ww + 0.6, wy - 9], [sw, sy + 6.5], [sw * 0.94, sy + 0.9], [sw * 0.55, sy - 0.8]], true, 6);
  fillP(P, top);
  c.save(); path(P); c.clip();
  // one-tone side shade
  c.fillStyle = shade(top, -0.1); c.fillRect(ww * 0.45, sy - 4, 20, 40);
  if (sty === 'stripe') { c.fillStyle = o.stripeCol ?? '#fff'; for (let y = sy + 6; y < wy; y += 6.5) c.fillRect(-20, y, 40, 2.6); }
  if (sty === 'jacket') { // open jacket over a tee
    c.fillStyle = o.inner ?? '#fff'; c.beginPath(); c.moveTo(-4.6, sy - 1); c.lineTo(4.6, sy - 1); c.lineTo(3.6, wy + 1); c.lineTo(-3.6, wy + 1); c.closePath(); c.fill();
    c.fillStyle = shade(top, -0.2); c.beginPath(); c.moveTo(-4.6, sy - 1); c.lineTo(-8.2, sy + 1); c.lineTo(-3.2, sy + 11); c.closePath(); c.fill(); c.beginPath(); c.moveTo(4.6, sy - 1); c.lineTo(8.2, sy + 1); c.lineTo(3.2, sy + 11); c.closePath(); c.fill();
  }
  if (sty === 'shirt') { c.fillStyle = '#fff'; c.beginPath(); c.moveTo(-4.8, sy - 1); c.lineTo(0, sy + 4.5); c.lineTo(4.8, sy - 1); c.lineTo(3.2, sy - 1.8); c.lineTo(0, sy + 1.6); c.lineTo(-3.2, sy - 1.8); c.closePath(); c.fill(); for (let y = sy + 9; y < wy - 2; y += 6.5) circ(0.2, y, 0.65, shade(top, -0.3)); }
  if (sty === 'apron') { c.fillStyle = o.apron ?? PAL.mint; c.beginPath(); c.roundRect(-7.6, sy + 7, 15.2, 30, 2.4); c.fill(); line(-4.5, sy + 7, -6.5, sy - 0.5, o.apron ?? PAL.mint, 1.5); line(4.5, sy + 7, 6.5, sy - 0.5, o.apron ?? PAL.mint, 1.5); c.fillStyle = shade(o.apron ?? PAL.mint, -0.15); c.fillRect(-4.6, sy + 17, 9.2, 5.4); }
  if (sty === 'overall') { c.fillStyle = o.overall ?? PAL.blue; c.beginPath(); c.roundRect(-8.4, sy + 12, 16.8, 30, 2); c.fill(); line(-5.4, sy + 12.5, -6.8, sy - 0.5, o.overall ?? PAL.blue, 2); line(5.4, sy + 12.5, 6.8, sy - 0.5, o.overall ?? PAL.blue, 2); circ(-5.2, sy + 13.5, 0.9, PAL.yel); circ(5.2, sy + 13.5, 0.9, PAL.yel); }
  if (sty === 'suit') { c.fillStyle = '#fff'; c.beginPath(); c.moveTo(-4.4, sy - 1); c.lineTo(4.4, sy - 1); c.lineTo(0, sy + 14); c.closePath(); c.fill(); c.fillStyle = shade(top, -0.25); c.beginPath(); c.moveTo(-4.4, sy - 1); c.lineTo(-6.8, sy + 1); c.lineTo(-1, sy + 15); c.closePath(); c.fill(); c.beginPath(); c.moveTo(4.4, sy - 1); c.lineTo(6.8, sy + 1); c.lineTo(1, sy + 15); c.closePath(); c.fill(); }
  c.restore();
  if (o.tie) { c.beginPath(); c.moveTo(-1.3, sy + 1.6); c.lineTo(1.3, sy + 1.6); c.lineTo(1.9, sy + 13); c.lineTo(0, sy + 15.8); c.lineTo(-1.9, sy + 13); c.closePath(); c.fillStyle = o.tie; c.fill(); }
  if (o.collar && sty !== 'shirt') { c.fillStyle = shade(top, -0.18); c.beginPath(); c.ellipse(0, sy - 0.2, 4.6, 1.6, 0, 0, Math.PI); c.fill(); }
  return { sy, wy };
}

// ------------------------------------------------------------------ heart mascot 「黄毛心」: a rosy heart wearing 黄毛's spiky yellow hairdo
// (sticker look: white border; hair = cap + spikes + jagged fringe so it reads as hair, never as fire)
const MH_TIPS = [[-12.2, -6.6], [-9.0, -11.6], [-3.6, -14.4], [2.4, -15.0], [8.0, -12.4], [12.0, -7.2]];
const MH_VAL = [[-8.8, -7.4], [-5.2, -9.4], [-0.6, -10.0], [4.6, -9.8], [8.4, -8.2]];
const MH_FRINGE = [[8.2, -2.6], [7.0, -0.8], [5.4, -3.0], [3.6, -0.9], [1.6, -3.4], [-0.4, -1.2], [-2.4, -3.4], [-4.4, -0.9], [-6.2, -3.0], [-7.8, -0.9]];
function mascotHair(t, k, bounce) {
  const P = [[-9.4, -1.6], [-10.6, -4.2]];
  for (let i = 0; i < MH_TIPS.length; i++) {
    const [tx, ty] = MH_TIPS[i];
    const sw = Math.sin(t * 6.5 + i * 1.4) * 0.35 + bounce * Math.sin(i * 1.9 + 0.5) * 1.4;
    const bx = tx * 0.6, by = -6 + (ty + 6) * 0.2; // tip grows out of the cap
    P.push([lerp(bx, tx, k) + sw * 0.6, lerp(by, ty, k) - Math.abs(sw) * 0.2]);
    if (i < MH_VAL.length) P.push(MH_VAL[i].slice());
  }
  P.push([10.6, -4.2], [9.4, -1.6]);
  for (const p of MH_FRINGE) P.push(p.slice());
  return P;
}
export function heartMascot(x, y, s, t, o = {}) {
  const glow = o.glow ?? 0, k = o.tuft ?? 1, bounce = o.bounce ?? 0, col = o.col ?? '#ff5c7a';
  if (glow > 0) { // soft white halo + ring (no fire colours)
    c.save(); c.globalAlpha *= glow;
    const g = c.createRadialGradient(x, y, s * 0.5, x, y, s * 2.3); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.55, 'rgba(255,252,240,0.4)'); g.addColorStop(1, 'rgba(255,252,240,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, s * 2.3, 0, Math.PI * 2); c.fill(); c.restore();
  }
  c.save(); c.translate(x, y); c.rotate(o.r ?? 0); c.scale(s / 10 * (o.sx ?? 1), s / 10 * (o.sy ?? 1));
  const Hh = heartPts(0, 1.2, 10.5, 72);
  const Hr = k > 0.01 ? mascotHair(t, k, bounce) : null;
  // sticker border
  c.lineJoin = 'round';
  if (o.border !== false) { c.lineWidth = o.borderW ?? 3.2; c.strokeStyle = o.borderCol ?? '#ffffff'; path(Hh); c.stroke(); if (Hr) { path(Hr); c.stroke(); c.fillStyle = c.strokeStyle; c.fill(); } }
  fillP(Hh, col);
  c.save(); path(Hh); c.clip(); ell(5.5, 7.5, 9, 9, shade(col, -0.12)); ell(-5.6, -2.8, 2.4, 1.5, 'rgba(255,255,255,0.7)', -0.6); c.restore();
  if (o.face !== false) {
    const ey = 2.6 + (o.eyeY ?? 0), ex = 3.4;
    if (o.eyes === 'happy') { arcLine(-ex, ey + 1, 1.3, Math.PI * 1.1, Math.PI * 1.9, PAL.navy, 0.85); arcLine(ex, ey + 1, 1.3, Math.PI * 1.1, Math.PI * 1.9, PAL.navy, 0.85); }
    else if (o.eyes === 'closed') { arcLine(-ex, ey - 0.6, 1.2, Math.PI * 0.15, Math.PI * 0.85, PAL.navy, 0.8); arcLine(ex, ey - 0.6, 1.2, Math.PI * 0.15, Math.PI * 0.85, PAL.navy, 0.8); }
    else if (o.eyes === 'star') { for (const sx of [-1, 1]) { c.save(); c.translate(sx * ex, ey); c.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 0.55 : 1.7; c.lineTo(r * Math.cos(a), r * Math.sin(a)); } c.closePath(); c.fillStyle = PAL.navy; c.fill(); c.restore(); } }
    else { ell(-ex, ey, 0.95, o.blink ? 0.2 : 1.15, PAL.navy); ell(ex, ey, 0.95, o.blink ? 0.2 : 1.15, PAL.navy); circ(-ex + 0.35, ey - 0.4, 0.33, '#fff'); circ(ex + 0.35, ey - 0.4, 0.33, '#fff'); }
    c.save(); c.globalAlpha *= 0.6; ell(-6.0, ey + 2.4, 1.5, 0.9, '#ffb0c0'); ell(6.0, ey + 2.4, 1.5, 0.9, '#ffb0c0'); c.restore();
    if (o.mouth === 'open') ell(0, ey + 3.2, 1.5, 1.4 * (o.mo ?? 1), '#3a1630');
    else arcLine(0, ey + 1.9, 1.5, Math.PI * 0.18, Math.PI * 0.82, PAL.navy, 0.85);
  }
  if (Hr) {
    fillP(Hr, PAL.yel);
    c.save(); path(Hr); c.clip(); ell(9.5, -6, 5.5, 11, PAL.yelD, 0.35); c.restore();
    c.save(); c.globalAlpha *= 0.9; strokeP([[-6.6, -6.6], [-7.4, -9.2]], PAL.yelL, 0.9); strokeP([[-1.8, -7.4], [-2.2, -10.8]], PAL.yelL, 0.9); c.restore();
  }
  c.restore();
}

// ------------------------------------------------------------------ person (front view)
// o: x, y (feet), h (px height), flip, lean, hunch, jump, sx/sy squash, armL/armR [a1,a2], legL/legR [h1,h2],
//    headTilt, headDy, turn, look, eyes, mouth, brows, blush, sweat, glasses, hair, hairCol, hairBounce, hat,
//    skin, top, topStyle, tie, bottom, skirt, shoes, sleeves ('long'|'short'), badge (0..1 glow) , handsFront
export function person(o, t = 0) {
  if (o.view === 'side') return personSide(o, t);
  const s = o.h / 100, f = o.flip ? -1 : 1;
  const J = {};
  c.save();
  c.translate(o.x, o.y - (o.jump ?? 0));
  if (o.shadow !== false) { c.save(); const k = 1 / (1 + (o.jump ?? 0) / (o.h * 0.6)); c.translate(0, o.jump ?? 0); c.globalAlpha *= 0.16 * k; ell(0, 0, 24 * s * k, 4.2 * s * k, PAL.navy); c.restore(); }
  c.scale(s * f * (o.sx ?? 1), s * (o.sy ?? 1));
  if (o.rot) c.rotate(o.rot);
  const skin = o.skin ?? PAL.skin, top = o.top ?? PAL.blue2, bot = o.bottom ?? PAL.navy, shoes = o.shoes ?? PAL.navy;
  const hunch = o.hunch ?? 0;
  const legL = o.legL ?? [4, 0], legR = o.legR ?? [4, 0];
  // legs
  const hipY = -44;
  if (o.skirt) { /* legs below skirt */ }
  const lw = o.legW ?? 8.4;
  const legC = o.skirt ? skin : bot, legC2 = o.skirt ? shade(skin, -0.05) : shade(bot, -0.06);
  const lL = limb(-5.2, hipY, legL[0], 21.5, legL[1], 21, -1, o.skirt ? lw * 0.8 : lw, legC, legC);
  const lR = limb(5.2, hipY, legR[0], 21.5, legR[1], 21, 1, o.skirt ? lw * 0.8 : lw, legC2, legC2);
  shoe(lL.x2, lL.y2 + 2.6, shoes, -0.6); shoe(lR.x2, lR.y2 + 2.6, shoes, 0.6);
  // upper body (lean about hips)
  c.save();
  c.translate(0, hipY); c.rotate((o.lean ?? 0) * D2R); c.translate(0, -hipY);
  if (o.skirt) { c.beginPath(); c.moveTo(-10.6, -45); c.lineTo(10.6, -45); c.lineTo(14.5, -27); c.quadraticCurveTo(0, -24.5, -14.5, -27); c.closePath(); c.fillStyle = o.skirt === true ? bot : o.skirt; c.fill(); }
  else { c.fillStyle = bot; c.beginPath(); c.roundRect(-10.6, -46, 21.2, 8, 3); c.fill(); }
  const R = o.headR ?? 13.8, hx = (o.headDx ?? 0), hy = -85 - (R - 12.6) * 0.8 + hunch * 4.5 + (o.headDy ?? 0);
  hairBack(o, hx, hy, R);
  const armCol = o.sleeves === 'short' ? skin : top;
  const armL = o.armL ?? [8, 4], armR = o.armR ?? [8, 4];
  const shY = -69.5 + hunch * 2.4;
  const drawArm = (side) => {
    const a = side < 0 ? armL : armR;
    const col = side < 0 ? armCol : shade(armCol, -0.04);
    const L = limb(side * 11.6, shY, a[0], 15.5, a[1], 14.5, side, 6.4, o.sleeves === 'short' ? top : col, o.sleeves === 'short' ? skin : col, skin, 3.3);
    if (o.sleeves === 'short') { /* short sleeve cap */ circ(side * 11.6, shY + 1.5, 4.0, top); }
    J[side < 0 ? 'handL' : 'handR'] = [L.x2, L.y2];
  };
  const front = o.armsFront ?? '';
  if (!front.includes('L')) drawArm(-1);
  if (!front.includes('R')) drawArm(1);
  torso(o, hunch);
  // neck + head
  c.fillStyle = shade(skin, -0.12); c.fillRect(hx - 2.6, hy + 9, 5.2, 6);
  c.save(); c.translate(hx, hy + 8); c.rotate((o.headTilt ?? 0) * D2R); c.translate(-hx, -(hy + 8));
  circ(hx - R * 0.98, hy + 0.8, 2.8, skin); circ(hx + R * 0.98, hy + 0.8, 2.8, skin);
  circ(hx, hy, R, skin);
  c.save(); c.beginPath(); c.arc(hx, hy, R, 0, Math.PI * 2); c.clip(); ell(hx + R * 0.75, hy + 2, R * 0.5, R * 1.1, shade(skin, -0.06)); c.restore();
  face(o, hx, hy, R);
  hairFront(o, hx, hy, R, t);
  hat(o, hx, hy, R);
  c.restore();
  if (front.includes('L')) drawArm(-1);
  if (front.includes('R')) drawArm(1);
  // badge: heart mascot on the chest
  if ((o.badge ?? 0) > 0) heartMascot(-5.2, -58.5 + hunch * 2, 5.6 * (o.badgeS ?? 1) * Math.min(1, o.badge), t, { glow: (o.badgeGlow ?? 0.7) * Math.min(1, o.badge), tuft: o.badgeTuft ?? 1, eyes: o.badgeEyes, borderW: 4.2 });
  c.restore();
  c.restore();
  // world joints (approx, ignores lean/rot) for props
  const wx = (lx) => o.x + lx * s * f * (o.sx ?? 1), wy = (ly) => o.y - (o.jump ?? 0) + ly * s * (o.sy ?? 1);
  const out = {};
  for (const k in J) out[k] = [wx(J[k][0]), wy(J[k][1])];
  out.head = [wx(hx), wy(hy)]; out.chest = [wx(-4.6), wy(-60)]; out.top = [wx(0), wy(hy - R)];
  return out;
}

// ------------------------------------------------------------------ person (side view, dir = +1 faces right)
export function personSide(o, t = 0) {
  const s = o.h / 100, d = o.dir ?? 1;
  c.save();
  c.translate(o.x, o.y - (o.jump ?? 0));
  if (o.shadow !== false) { c.save(); const k = 1 / (1 + (o.jump ?? 0) / (o.h * 0.6)); c.translate(0, o.jump ?? 0); c.globalAlpha *= 0.16 * k; ell(0, 0, 20 * s * k, 3.8 * s * k, PAL.navy); c.restore(); }
  c.scale(s * d * (o.sx ?? 1), s * (o.sy ?? 1));
  if (o.rot) c.rotate(o.rot * d);
  const skin = o.skin ?? PAL.skin, top = o.top ?? PAL.blue2, bot = o.bottom ?? PAL.navy, shoes = o.shoes ?? PAL.navy;
  const hipY = -44, lean = o.lean ?? 0;
  const legF = o.legF ?? [10, 0], legB = o.legB ?? [-10, 0];  // angles: + = forward
  const armF = o.armF ?? [10, 10], armB = o.armB ?? [-10, 10];
  const fl = (a) => [Math.sin(a * D2R), Math.cos(a * D2R)];
  const leg = (a, col) => { const [x1d, y1d] = fl(a[0]), [x2d, y2d] = fl(a[0] - a[1]); const x1 = x1d * 21.5, y1 = hipY + y1d * 21.5, x2 = x1 + x2d * 21, y2 = y1 + y2d * 21; c.beginPath(); c.moveTo(0, hipY); c.lineTo(x1, y1); c.lineTo(x2, y2); c.strokeStyle = col; c.lineWidth = 8.4; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(); ell(x2 + 2.4, y2 + 0.6, 5.8, 3.1, shoes); };
  const shY = -69.5;
  const arm = (a, col) => { const [x1d, y1d] = fl(a[0]), [x2d, y2d] = fl(a[0] + a[1]); const x0 = 0, x1 = x0 + x1d * 15.5, y1 = shY + y1d * 15.5, x2 = x1 + x2d * 14.5, y2 = y1 + y2d * 14.5; c.beginPath(); c.moveTo(x0, shY); c.lineTo(x1, y1); c.lineTo(x2, y2); c.strokeStyle = col; c.lineWidth = 6.4; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(); circ(x2, y2, 3.3, skin); return [x2, y2]; };
  leg(legB, shade(bot, -0.14));
  c.save(); c.translate(0, hipY); c.rotate(lean * D2R); c.translate(0, -hipY);
  arm(armB, shade(top, -0.16));
  c.restore();
  leg(legF, bot);
  c.save(); c.translate(0, hipY); c.rotate(lean * D2R); c.translate(0, -hipY);
  // torso (side)
  const P = spline([[-6.5, -73], [5.5, -73], [8.2, -66], [7.4, -44], [-7.4, -44], [-8.2, -66]], true, 6);
  fillP(P, top); c.save(); path(P); c.clip(); c.fillStyle = shade(top, -0.1); c.fillRect(-10, -60, 20, 20); if (o.topStyle === 'stripe') { c.fillStyle = o.stripeCol ?? '#fff'; for (let y = -67; y < -44; y += 6.5) c.fillRect(-12, y, 24, 2.6); } c.restore();
  c.fillStyle = bot; c.beginPath(); c.roundRect(-7.6, -47, 15.2, 7, 3); c.fill();
  // head
  const hx = 1.2 + (o.headDx ?? 0), hy = -86 + (o.headDy ?? 0), R = 12.6;
  c.fillStyle = shade(skin, -0.12); c.fillRect(-2.4, -76, 5, 5);
  c.save(); c.translate(hx, hy + 8); c.rotate((o.headTilt ?? 0) * D2R); c.translate(-hx, -(hy + 8));
  const hair = o.hair ?? 'short', hc = o.hairCol ?? PAL.hairK;
  if (hair === 'long') { c.beginPath(); c.moveTo(hx - 2, hy - 8); c.quadraticCurveTo(hx - 17, hy + 4, hx - 13, hy + 20); c.lineTo(hx - 3, hy + 16); c.closePath(); c.fillStyle = shade(hc, -0.12); c.fill(); }
  if (hair === 'bun' || hair === 'grandma') circ(hx - 10.5, hy - 8.5, 5.2, hc);
  circ(hx, hy, R, skin);
  circ(hx + R * 0.95, hy + 1.6, 2.3, skin); // nose
  // eye + mouth + blush
  const ex = hx + 6.2;
  if (o.eyes === 'happy') arcLine(ex, hy, 1.9, Math.PI * 1.1, Math.PI * 1.9, PAL.navy, 1.1); else if (o.eyes === 'closed') arcLine(ex, hy - 1.6, 1.8, Math.PI * 0.15, Math.PI * 0.85, PAL.navy, 1.0); else if (o.eyes === 'sad') { ell(ex, hy - 0.2, 1.3, 1.45, PAL.navy); line(ex - 2.4, hy - 3.6, ex + 1.8, hy - 5.0, PAL.navy, 0.95); } else ell(ex, hy - 0.8, 1.4, 1.7, PAL.navy);
  c.save(); c.globalAlpha *= 0.5; ell(hx + 5, hy + 4.2, 2.4, 1.5, PAL.blush); c.restore();
  if (o.mouth === 'open' || o.mouth === 'grin') { ell(hx + 7.6, hy + 6.2, 1.9, 1.7, '#3a1630'); } else if (o.mouth === 'frown') arcLine(hx + 7.4, hy + 8.0, 1.9, Math.PI * 1.2, Math.PI * 1.75, PAL.navy, 1.0); else arcLine(hx + 7.8, hy + 4.3, 1.9, Math.PI * 0.2, Math.PI * 0.7, PAL.navy, 1.0);
  if (o.glasses) { c.beginPath(); c.arc(ex, hy - 0.8, 3.4, 0, Math.PI * 2); c.lineWidth = 0.9; c.strokeStyle = PAL.navy; c.stroke(); line(ex - 3.4, hy - 1.4, hx - 5, hy - 2.4, PAL.navy, 0.9); }
  circ(hx - 3.6, hy + 0.8, 2.6, skin); // ear
  // hair (side)
  if (hair === 'spiky') {
    const sw = Math.sin(t * 8) * 0.6;
    const Pp = [[hx + 9.5, hy - 6.5], [hx + 11, hy - 13], [hx + 4, hy - 13.6], [hx + 3 + sw, hy - 23], [hx - 2.5, hy - 14.5], [hx - 9 + sw, hy - 21.5], [hx - 9.2, hy - 11.2], [hx - 18 + sw, hy - 13.6], [hx - 12.4, hy - 4.8], [hx - 19 + sw, hy - 3], [hx - 11.6, hy + 3], [hx - 6.2, hy + 1], [hx - 4.6, hy - 5.4], [hx + 2, hy - 6.2]];
    fillP(Pp, hc); c.save(); path(Pp); c.clip(); ell(hx - 9, hy - 2, 7, 9, PAL.yelD); c.restore();
  } else if (hair === 'tuft') { c.beginPath(); c.arc(hx, hy, R * 1.04, Math.PI * 0.95, Math.PI * 1.85); c.lineTo(hx + 2, hy - 6); c.closePath(); c.fillStyle = hc; c.fill(); for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(hx - 3 + i * 3, hy - R); c.quadraticCurveTo(hx - 5 + i * 3, hy - R - 7, hx - 1 + i * 3, hy - R - 9); c.strokeStyle = hc; c.lineWidth = 2; c.lineCap = 'round'; c.stroke(); } }
  else if (hair !== 'none') { c.beginPath(); c.arc(hx, hy, R * 1.07, Math.PI * 0.92, Math.PI * 1.9); c.lineTo(hx + 9.6, hy - 5.4); c.quadraticCurveTo(hx + 1, hy - 4, hx - 3.5, hy - 1); c.lineTo(hx - 8, hy + 7); c.closePath(); c.fillStyle = hc; c.fill(); }
  hat(o, hx, hy, R);
  c.restore();
  if ((o.badge ?? 0) > 0) heartMascot(4.4, -59.5, 5.2 * (o.badgeS ?? 1) * Math.min(1, o.badge), t, { glow: (o.badgeGlow ?? 0.7) * Math.min(1, o.badge), borderW: 4.2, eyes: o.badgeEyes });
  const hand = arm(armF, top);
  c.restore();
  c.restore();
  return { hand: [o.x + hand[0] * s * d, o.y - (o.jump ?? 0) + hand[1] * s] };
}

// presets
export const LAOSHI = { hair: 'neat', hairCol: PAL.hairK, glasses: true, top: '#a9c1ff', topStyle: 'shirt', tie: PAL.navy, bottom: '#3b3f72', shoes: PAL.navy, skin: PAL.skin };
export const HUANGMAO = { hair: 'spiky', hairCol: PAL.yel, top: PAL.coral, topStyle: 'jacket', inner: '#fff', bottom: PAL.navy, shoes: '#fff', skin: PAL.skin };
export const KID = { hair: 'tuft', hairCol: '#ffd75e', top: PAL.mint, topStyle: 'stripe', stripeCol: '#fff', bottom: PAL.blue, shoes: PAL.coral, skin: PAL.skin, headR: 15.5, legW: 7.4 };
