/* 3D 流体背景：WebGL 域扭曲 fbm 高度场 + 法线光照（丝绸 / 液态玻璃质感）*/
(function () {
  const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const FS = `precision highp float;
uniform vec2 uRes;uniform float uTime;uniform vec2 uMouse;uniform float uMouseStr;
uniform vec3 uC0;uniform vec3 uC1;uniform vec3 uC2;uniform vec3 uC3;
uniform float uScale;uniform float uWarp;uniform float uGrain;uniform float uGloss;uniform float uPulse;uniform vec2 uPulseAt;
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x),u.y);}
float fbm(vec2 p){float v=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<5;i++){v+=a*noise(p);p=m*p;a*=.5;}return v;}
vec2 Q;vec2 R;
float field(vec2 p,float t){
  vec2 q=vec2(fbm(p+vec2(0.,t*.12)),fbm(p+vec2(5.2,1.3)-t*.1));
  vec2 r=vec2(fbm(p+3.*q+vec2(1.7,9.2)+t*.15),fbm(p+3.*q+vec2(8.3,2.8)-t*.126));
  Q=q;R=r;return fbm(p+uWarp*r);
}
void main(){
  vec2 p=(gl_FragCoord.xy-.5*uRes)/min(uRes.x,uRes.y);
  vec2 m=(uMouse-.5*uRes)/min(uRes.x,uRes.y);vec2 d=p-m;float md=dot(d,d);
  float sw=uMouseStr*exp(-md*5.);p+=vec2(-d.y,d.x)*sw*.55;
  vec2 pp=(uPulseAt-.5*uRes)/min(uRes.x,uRes.y);float pd=length(p-pp);
  float ring=uPulse*exp(-pow(pd-(1.-uPulse)*1.6,2.)*30.);
  p+=normalize(p-pp+1e-4)*ring*.06;
  p*=uScale;float t=uTime;
  float h=field(p,t);vec2 q=Q;vec2 r=R;
  float e=.035;
  float hx=field(p+vec2(e,0.),t);float hy=field(p+vec2(0.,e),t);
  vec3 n=normalize(vec3((h-hx)/e,(h-hy)/e,2.2));
  vec3 col=mix(uC0,uC1,clamp(h*h*3.2,0.,1.));
  col=mix(col,uC2,clamp(length(q)*.9-.15,0.,1.));
  col=mix(col,uC3,clamp(abs(r.x)*.9-.1,0.,1.)*.85);
  vec3 L=normalize(vec3(-.45,.55,.75));
  float diff=.78+.3*dot(n,L);
  float spec=pow(max(dot(reflect(-L,n),vec3(0.,0.,1.)),0.),18.)*uGloss;
  float rim=pow(1.-n.z,2.)*.35*uGloss;
  col=col*diff+vec3(1.)*(spec*.55+rim)+ring*.25;
  vec2 uv=gl_FragCoord.xy/uRes;col*=.94+.06*smoothstep(1.2,.2,length(uv-.5));
  col+=(hash(gl_FragCoord.xy+fract(t*7.)*91.)-.5)*uGrain*.22;
  gl_FragColor=vec4(clamp(col,0.,1.),1.);
}`;
  let gl, prog, cv, U = {}, raf = 0, simT = 0, last = performance.now();
  const S = { colors: [[.6, .7, .74], [.79, .83, .85], [.9, .88, .85], [.49, .56, .6]], scale: 1.8, warp: 3.6, grain: .12, gloss: .5, speed: .3, mouse: [0, 0], mouseStr: 0, targetStr: 0, pulse: 0, pulseAt: [0, 0], res: .5, k: .5 };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function sh(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
  function init(canvas) {
    cv = canvas;
    gl = cv.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: false, powerPreference: 'low-power' });
    if (!gl) { document.documentElement.classList.add('no-webgl'); return false; }
    try {
      prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    } catch (e) { console.warn(e); document.documentElement.classList.add('no-webgl'); gl = null; return false; }
    gl.useProgram(prog);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    ['uRes', 'uTime', 'uMouse', 'uMouseStr', 'uC0', 'uC1', 'uC2', 'uC3', 'uScale', 'uWarp', 'uGrain', 'uGloss', 'uPulse', 'uPulseAt'].forEach((k) => { U[k] = gl.getUniformLocation(prog, k); });
    resize(); addEventListener('resize', resize);
    addEventListener('pointermove', (e) => { S.mouse = [e.clientX, innerHeight - e.clientY]; S.targetStr = 1; clearTimeout(S.mt); S.mt = setTimeout(() => { S.targetStr = 0; }, 900); }, { passive: true });
    document.addEventListener('visibilitychange', () => { if (document.hidden) cancelAnimationFrame(raf); else { last = performance.now(); loop(); } });
    loop();
    return true;
  }
  function resize() {
    if (!gl) return;
    S.k = Math.max(.3, Math.min(S.res, 960 / Math.max(innerWidth, 1)));
    cv.width = Math.round(innerWidth * S.k); cv.height = Math.round(innerHeight * S.k);
    gl.viewport(0, 0, cv.width, cv.height);
  }
  function loop() {
    const now = performance.now(), dt = Math.min(.05, (now - last) / 1000); last = now;
    simT += dt * (reduce ? S.speed * .15 : S.speed) * 1.6;
    S.mouseStr += (S.targetStr - S.mouseStr) * .04;
    if (S.pulse > 0) S.pulse = Math.max(0, S.pulse - dt * .55);
    draw();
    raf = requestAnimationFrame(loop);
  }
  function draw() {
    if (!gl) return;
    gl.uniform2f(U.uRes, cv.width, cv.height); gl.uniform1f(U.uTime, simT + 12.3);
    const k = S.k;
    gl.uniform2f(U.uMouse, S.mouse[0] * k, S.mouse[1] * k); gl.uniform1f(U.uMouseStr, S.mouseStr);
    S.colors.forEach((c, i) => gl.uniform3f(U['uC' + i], c[0], c[1], c[2]));
    gl.uniform1f(U.uScale, S.scale); gl.uniform1f(U.uWarp, S.warp); gl.uniform1f(U.uGrain, S.grain); gl.uniform1f(U.uGloss, S.gloss);
    gl.uniform1f(U.uPulse, S.pulse); gl.uniform2f(U.uPulseAt, S.pulseAt[0] * k, S.pulseAt[1] * k);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function set(o) { Object.assign(S, o); }
  function pulse(x, y) { S.pulse = 1; S.pulseAt = [x ?? innerWidth / 2, innerHeight - (y ?? innerHeight / 2)]; }
  window.Fluid = { init, set, pulse, state: S };
})();
