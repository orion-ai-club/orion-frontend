import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

/**
 * Procedural celestial gyroscope — no models, external textures or postprocessing.
 * Loaded only when the home compass approaches the viewport.
 */
export function StarCompass3D() {
  const stageRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const bearingRef = useRef<HTMLOutputElement>(null);
  const [noWebGL, setNoWebGL] = useState(false);

  useEffect(() => {
    if (noWebGL) return;
    const stage = stageRef.current;
    const mount = mountRef.current;
    if (!stage || !mount) return;

    let renderer: THREE.WebGLRenderer;
    const canvas = document.createElement('canvas');
    canvas.className = 'orion-gyro-canvas';
    canvas.setAttribute('aria-hidden', 'true');

    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'low-power',
        preserveDrawingBuffer: false
      });
    } catch {
      setNoWebGL(true);
      return;
    }
    mount.appendChild(canvas);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;

    const resources = new Set<{ dispose: () => void }>();
    const track = <T extends { dispose: () => void }>(resource: T): T => {
      resources.add(resource);
      return resource;
    };

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 50);
    camera.position.set(0, 4.85, 7.5);
    camera.lookAt(0, 0.05, 0);

    scene.add(new THREE.AmbientLight(0xf4f3ef, 1.55));
    const warmLight = new THREE.DirectionalLight(0xffba47, 3.0);
    warmLight.position.set(3.5, 6, 4.5);
    scene.add(warmLight);
    const blueLight = new THREE.DirectionalLight(0xe2e0dc, 2.0);
    blueLight.position.set(-4, 2.8, -3.5);
    scene.add(blueLight);

    const rig = new THREE.Group();
    scene.add(rig);

    const metal = track(new THREE.MeshStandardMaterial({
      color: 0x272a30, metalness: 0.68, roughness: 0.4
    }));
    const darkFace = track(new THREE.MeshStandardMaterial({
      color: 0x0b0e14, metalness: 0.42, roughness: 0.54
    }));
    const blueSteel = track(new THREE.MeshStandardMaterial({
      color: 0x62676f, metalness: 0.72, roughness: 0.37
    }));
    const gold = track(new THREE.MeshStandardMaterial({
      color: 0xffaa00, metalness: 0.56, roughness: 0.24,
      emissive: 0x8d4100, emissiveIntensity: 0.28
    }));
    const coolGlow = track(new THREE.MeshBasicMaterial({
      color: 0xffaa00, transparent: true, opacity: 0.65, depthWrite: false
    }));
    const softGold = track(new THREE.MeshBasicMaterial({
      color: 0xffaa00, transparent: true, opacity: 0.48, depthWrite: false
    }));

    const add = (
      parent: THREE.Object3D,
      geometry: THREE.BufferGeometry,
      material: THREE.Material
    ) => {
      const mesh = new THREE.Mesh(track(geometry), material);
      parent.add(mesh);
      return mesh;
    };

    // Machined floating base. The thin stacked discs make the edge
    // feel physical as the camera tilts instead of looking like flat SVG.
    add(rig, new THREE.CylinderGeometry(2.10, 2.07, 0.14, 100), metal)
      .position.y = -0.015;
    add(rig, new THREE.CylinderGeometry(1.99, 1.99, 0.045, 100), darkFace)
      .position.y = 0.084;
    add(rig, new THREE.CylinderGeometry(1.77, 1.77, 0.012, 100), darkFace)
      .position.y = 0.12;

    const placeRing = (
      radius: number,
      thickness: number,
      height: number,
      material: THREE.Material,
      parent = rig
    ) => {
      const ring = add(parent, new THREE.TorusGeometry(radius, thickness, 8, 160), material);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = height;
      return ring;
    };

    placeRing(2.09, 0.032, 0.105, gold);
    placeRing(1.91, 0.011, 0.152, softGold);
    placeRing(1.74, 0.011, 0.158, coolGlow);
    placeRing(0.43, 0.015, 0.168, softGold);

    // Inscribed one-degree-inspired ticks with two instanced meshes.
    const tickGeometry = track(new THREE.BoxGeometry(0.018, 0.013, 0.11));
    const majorGeometry = track(new THREE.BoxGeometry(0.04, 0.019, 0.205));
    const ticks = new THREE.InstancedMesh(tickGeometry, blueSteel, 60);
    const majors = new THREE.InstancedMesh(majorGeometry, gold, 12);
    const placement = new THREE.Object3D();
    let ti = 0, mi = 0;
    for (let index = 0; index < 72; index++) {
      const angle = index / 72 * Math.PI * 2;
      const major = index % 6 === 0;
      const radius = major ? 1.82 : 1.83;
      placement.position.set(Math.sin(angle) * radius, 0.156, -Math.cos(angle) * radius);
      placement.rotation.set(0, -angle, 0);
      placement.updateMatrix();
      if (major) majors.setMatrixAt(mi++, placement.matrix);
      else ticks.setMatrixAt(ti++, placement.matrix);
    }
    ticks.instanceMatrix.needsUpdate = true;
    majors.instanceMatrix.needsUpdate = true;
    rig.add(ticks, majors);

    // Cardinal lettering drawn once into small canvas textures.
    const addLabel = (letter: string, x: number, z: number, primary: boolean) => {
      const surface = document.createElement('canvas');
      surface.width = surface.height = 128;
      const ctx = surface.getContext('2d');
      if (!ctx) return;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '700 73px ui-monospace, Menlo, Consolas, monospace';
      ctx.shadowColor = primary ? '#ffaa00' : '#a4a9b1';
      ctx.shadowBlur = primary ? 18 : 8;
      ctx.fillStyle = primary ? '#ffaa00' : '#b7bcc4';
      ctx.fillText(letter, 64, 65);
      const texture = track(new THREE.CanvasTexture(surface));
      texture.colorSpace = THREE.SRGBColorSpace;
      const material = track(new THREE.SpriteMaterial({
        map: texture, transparent: true, depthWrite: false
      }));
      const sprite = new THREE.Sprite(material);
      sprite.position.set(x, 0.26, z);
      sprite.scale.set(0.43, 0.43, 1);
      rig.add(sprite);
    };
    addLabel('N', 0, -1.54, true);
    addLabel('S', 0, 1.54, false);
    addLabel('E', 1.54, 0, false);
    addLabel('W', -1.54, 0, false);

    // Two polished, bevelled parts of a magnetic needle.
    const needle = new THREE.Group();
    rig.add(needle);
    const makeBlade = (north: boolean, material: THREE.Material) => {
      const shape = new THREE.Shape();
      if (north) {
        shape.moveTo(0, 1.45);
        shape.lineTo(0.23, -0.12);
        shape.lineTo(0, 0.10);
        shape.lineTo(-0.23, -0.12);
      } else {
        shape.moveTo(0, -1.25);
        shape.lineTo(-0.23, 0.11);
        shape.lineTo(0, -0.12);
        shape.lineTo(0.23, 0.11);
      }
      shape.closePath();
      const blade = add(needle, new THREE.ExtrudeGeometry(shape, {
        depth: 0.05, steps: 1, bevelEnabled: true,
        bevelThickness: 0.014, bevelSize: 0.012, bevelSegments: 2
      }), material);
      blade.rotation.x = -Math.PI / 2;
      blade.position.y = 0.28;
    };
    makeBlade(true, gold);
    makeBlade(false, blueSteel);
    const needleSpine = add(
      needle,
      new THREE.CylinderGeometry(0.085, 0.095, 0.15, 20),
      metal
    );
    needleSpine.position.y = 0.38;
    const needleGem = add(
      needle,
      new THREE.IcosahedronGeometry(0.145, 1),
      gold
    );
    needleGem.position.y = 0.49;
    const gemRing = placeRing(0.23, 0.014, 0.41, gold, needle);

    // Orbital gyroscope cages: independent rotational axes around the dial.
    const orbitA = new THREE.Group();
    const orbitB = new THREE.Group();
    rig.add(orbitA, orbitB);
    const orbitMaterial = track(new THREE.MeshBasicMaterial({
      color: 0xffaa00, transparent: true, opacity: 0.35,
      depthWrite: false, side: THREE.DoubleSide
    }));
    const orbitGold = track(new THREE.MeshBasicMaterial({
      color: 0xffaa00, transparent: true, opacity: 0.38,
      depthWrite: false
    }));
    const addOrbit = (parent: THREE.Group, radius: number, material: THREE.Material) => {
      const ring = add(parent, new THREE.TorusGeometry(radius, 0.011, 8, 128), material);
      ring.rotation.y = Math.PI / 7;
      return ring;
    };
    orbitA.rotation.set(0.48, 0.1, -0.46);
    orbitB.rotation.set(-0.38, 0.45, 0.68);
    addOrbit(orbitA, 2.40, orbitMaterial);
    addOrbit(orbitB, 2.30, orbitGold);

    // A small glint traces one outer orbit, adding a sense of navigation.
    const satellite = add(
      orbitA,
      new THREE.SphereGeometry(0.064, 12, 9),
      gold
    );
    satellite.position.set(2.4, 0, 0);

    // Soft starfield. Seeded positions keep visual placement stable on rerenders.
    const points = new Float32Array(180 * 3);
    let seed = 48713;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
    for (let i = 0; i < 180; i++) {
      const theta = rand() * Math.PI * 2;
      const radius = 2.25 + rand() * 1.65;
      points[i * 3] = Math.sin(theta) * radius;
      points[i * 3 + 1] = (rand() - 0.5) * 2.5;
      points[i * 3 + 2] = Math.cos(theta) * radius;
    }
    const starGeometry = track(new THREE.BufferGeometry());
    starGeometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
    const stars = new THREE.Points(starGeometry, track(new THREE.PointsMaterial({
      color: 0xc9cbd0, size: 0.035, transparent: true,
      opacity: 0.55, sizeAttenuation: true, depthWrite: false
    })));
    scene.add(stars);

    const status = { heading: 0, yaw: 0, pitch: 0 };
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    const onMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      const bounds = stage.getBoundingClientRect();
      const x = (event.clientX - bounds.left - bounds.width / 2) / (bounds.width / 2);
      const y = (event.clientY - bounds.top - bounds.height / 2) / (bounds.height / 2);
      status.heading = Math.atan2(-x, -y);
      if (bearingRef.current) {
        const degrees = (Math.round((-status.heading * 180 / Math.PI + 360) % 360));
        bearingRef.current.textContent = String(degrees).padStart(3, '0') + '°';
      }
      if (dragging) {
        status.yaw = THREE.MathUtils.clamp(status.yaw + (event.clientX - lastX) * 0.009, -0.70, 0.70);
        status.pitch = THREE.MathUtils.clamp(status.pitch + (event.clientY - lastY) * 0.007, -0.26, 0.27);
        lastX = event.clientX;
        lastY = event.clientY;
      }
      if (reducedMotion) drawSingleFrame();
    };
    const onDown = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      stage.setPointerCapture(event.pointerId);
    };
    const onUp = (event: PointerEvent) => {
      dragging = false;
      if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
    };
    const onExit = () => {
      if (dragging) return;
      status.heading = 0;
      status.yaw = 0;
      status.pitch = 0;
      if (bearingRef.current) bearingRef.current.textContent = '000°';
    };

    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerdown', onDown);
    stage.addEventListener('pointerup', onUp);
    stage.addEventListener('pointercancel', onUp);
    stage.addEventListener('pointerleave', onExit);

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let inView = false;
    let frame = 0;
    let lastFrame = 0;
    const interval = window.matchMedia('(max-width: 640px)').matches ? 34 : 24;
    const clock = new THREE.Clock();

    const drawSingleFrame = () => {
      needle.rotation.y = status.heading;
      rig.rotation.y = status.yaw;
      rig.rotation.x = status.pitch;
      renderer.render(scene, camera);
    };

    const onFrame = (timestamp: number) => {
      frame = requestAnimationFrame(onFrame);
      if (timestamp - lastFrame < interval) return;
      lastFrame = timestamp;

      const dt = Math.min(clock.getDelta(), 0.05);
      const diff = Math.atan2(
        Math.sin(status.heading - needle.rotation.y),
        Math.cos(status.heading - needle.rotation.y)
      );
      needle.rotation.y += diff * Math.min(1, dt * 8);
      rig.rotation.y += (status.yaw - rig.rotation.y) * Math.min(1, dt * 3.5);
      rig.rotation.x += (status.pitch - rig.rotation.x) * Math.min(1, dt * 3.5);
      orbitA.rotation.y += dt * 0.21;
      orbitB.rotation.z -= dt * 0.17;
      stars.rotation.y += dt * 0.0035;
      gemRing.rotation.y += dt * 0.04;
      renderer.render(scene, camera);
    };

    const updateAnimation = () => {
      const shouldRun = !reducedMotion && inView && !document.hidden;
      if (shouldRun && !frame) {
        clock.getDelta();
        frame = requestAnimationFrame(onFrame);
      } else if (!shouldRun && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    };

    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      updateAnimation();
    }, { threshold: 0.02 });
    observer.observe(stage);

    const resize = () => {
      const bounds = mount.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      camera.aspect = bounds.width / bounds.height;
      camera.updateProjectionMatrix();
      renderer.setSize(bounds.width, bounds.height, false);
      renderer.render(scene, camera);
    };
    const sizeObserver = new ResizeObserver(resize);
    sizeObserver.observe(mount);
    resize();

    const contextLost = (event: Event) => {
      event.preventDefault();
      setNoWebGL(true);
    };
    canvas.addEventListener('webglcontextlost', contextLost);
    document.addEventListener('visibilitychange', updateAnimation);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      sizeObserver.disconnect();
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerdown', onDown);
      stage.removeEventListener('pointerup', onUp);
      stage.removeEventListener('pointercancel', onUp);
      stage.removeEventListener('pointerleave', onExit);
      document.removeEventListener('visibilitychange', updateAnimation);
      canvas.removeEventListener('webglcontextlost', contextLost);
      for (const resource of resources) resource.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    };
  }, [noWebGL]);

  return (
    <div className="orion-gyro-shell bg-[#0b0f19] dark:bg-slate-950/40 rounded-3xl border border-slate-800/80 shadow-2xl relative max-w-sm mx-auto select-none">
      <div className="orion-gyro-meta">
        <span><span className="orion-gyro-twinkle">✦</span> ORION / DEEP SPACE</span>
        <span className="orion-gyro-online"><i /> LIVE</span>
      </div>
      <div
        ref={stageRef}
        className="orion-gyro-stage"
        role="img"
        aria-label="Interactive 3D interstellar compass. Move the pointer to orient the needle, drag to tilt the gyroscope."
      >
        <div className="orion-gyro-ambient" />
        {!noWebGL ? (
          <div ref={mountRef} className="orion-gyro-mount" />
        ) : (
          <div className="orion-gyro-fallback" aria-hidden="true">
            <div className="orion-gyro-fallback-ring">
              <span>N</span><span>E</span><span>S</span><span>W</span>
              <div className="orion-gyro-fallback-needle">✦</div>
            </div>
          </div>
        )}
        <span className="orion-gyro-corner orion-gyro-corner-tl" />
        <span className="orion-gyro-corner orion-gyro-corner-tr" />
        <span className="orion-gyro-corner orion-gyro-corner-bl" />
        <span className="orion-gyro-corner orion-gyro-corner-br" />
      </div>
      <div className="orion-gyro-status">
        <div>
          <span className="orion-gyro-kicker">NAVIGATION INSTRUMENT / 01</span>
          <strong>Interstellar Compass</strong>
        </div>
        <div className="orion-gyro-heading">
          <span>BEARING</span>
          <output ref={bearingRef}>000°</output>
        </div>
      </div>
      <div className="orion-gyro-hint">
        <span>✧ NORTH IS WHERE YOU BEGIN</span>
        <span>DRAG TO ORIENT</span>
      </div>
    </div>
  );
}

export default StarCompass3D;
