import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import * as THREE from "three";

function isMobileViewport() {
  return window.matchMedia("(max-width: 768px)").matches;
}

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl") || c.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

export default function HeroThreeJS({ theme }) {
  const mountRef = useRef(null);
  const themeRef = useRef(theme);
  const [canvasOn, setCanvasOn] = useState(false);
  themeRef.current = theme;

  useLayoutEffect(() => {
    setCanvasOn(!isMobileViewport() && hasWebGL());
  }, []);

  useEffect(() => {
    if (!canvasOn) return;
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(52, Math.max(1, mount.clientWidth) / 300, 0.1, 2500);
    camera.position.set(0, 10, 300);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(Math.max(1, mount.clientWidth), 300);
    renderer.domElement.className = "hero-three__gl";
    mount.appendChild(renderer.domElement);

    const readAccent = () => (themeRef.current === "dark" ? 0x00d4ff : 0x0066cc);
    const readBg = () => (themeRef.current === "dark" ? 0x0a0e1a : 0xe8effe);

    const globeGeo = new THREE.SphereGeometry(58, 30, 30);
    const globeMat = new THREE.MeshBasicMaterial({ color: readAccent(), wireframe: true });
    const globe = new THREE.Mesh(globeGeo, globeMat);
    globe.position.set(0, -22, 0);
    scene.add(globe);

    const pCount = 300;
    const positions = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      const r = 92 + Math.random() * 58;
      const u = Math.random() * Math.PI * 2;
      const v = Math.acos(2 * Math.random() - 1);
      positions[i * 3 + 0] = r * Math.sin(v) * Math.cos(u);
      positions[i * 3 + 1] = r * Math.sin(v) * Math.sin(u);
      positions[i * 3 + 2] = r * Math.cos(v);
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const pMat = new THREE.PointsMaterial({
      color: themeRef.current === "dark" ? 0xffffff : 0x0b3d6d,
      size: themeRef.current === "dark" ? 1.55 : 1.15,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const points = new THREE.Points(pGeo, pMat);
    points.position.set(0, -18, 0);
    scene.add(points);

    const grid = new THREE.GridHelper(560, 48, readAccent(), 0x445566);
    grid.position.set(0, -108, 0);
    scene.add(grid);

    const scanGroup = new THREE.Group();
    const scans = [];
    for (let s = 0; s < 3; s++) {
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-95, 0, 72), new THREE.Vector3(95, 0, 72)]);
      const mat = new THREE.LineBasicMaterial({ color: readAccent(), transparent: true, opacity: 0.6 });
      const line = new THREE.Line(geo, mat);
      line.position.y = -50 + s * 18;
      scans.push({ line, phase: s * 1.1 });
      scanGroup.add(line);
    }
    globe.add(scanGroup);

    let mouseX = 0;
    let mouseY = 0;
    const onMove = (e) => {
      const r = mount.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      mouseX = ((e.clientX - cx) / Math.max(1, r.width)) * 2;
      mouseY = ((e.clientY - cy) / Math.max(1, r.height)) * 2;
    };
    window.addEventListener("mousemove", onMove);

    const clock = new THREE.Clock();
    let raf = 0;
    const animate = () => {
      const t = clock.getElapsedTime();
      const accent = readAccent();
      const bg = readBg();
      scene.background = new THREE.Color(bg);
      globeMat.color.setHex(accent);
      pMat.color.setHex(themeRef.current === "dark" ? 0xffffff : 0x0b3d6d);
      scans.forEach((s) => {
        s.line.material.color.setHex(accent);
        s.line.position.y = Math.sin(t * 1.25 + s.phase) * 72;
      });

      globe.rotation.y = t * 0.33;
      points.rotation.y = t * -0.06;
      grid.position.z = Math.sin(t * 0.5) * 36;

      const maxPx = 15;
      const targetX = -mouseX * maxPx;
      const targetY = mouseY * maxPx * 0.45;
      camera.position.x += (targetX - camera.position.x) * 0.07;
      camera.position.y += (targetY - camera.position.y) * 0.07;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    const onResize = () => {
      const w = Math.max(1, mount.clientWidth);
      camera.aspect = w / 300;
      camera.updateProjectionMatrix();
      renderer.setSize(w, 300);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", onResize);
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
      renderer.dispose();
      globeGeo.dispose();
      globeMat.dispose();
      pGeo.dispose();
      pMat.dispose();
      scans.forEach((s) => {
        s.line.geometry.dispose();
        s.line.material.dispose();
      });
      grid.geometry.dispose();
      const gm = grid.material;
      if (Array.isArray(gm)) gm.forEach((m) => m.dispose());
      else if (gm) gm.dispose();
    };
  }, [canvasOn]);

  return (
    <div className="hero-shell">
      {canvasOn ? <div className="hero-three" ref={mountRef} /> : <div className="hero-gradient" />}
      <div className="hero-overlay">
        <div className="hero-bar">
          <div className="hero-bar__main">
            <h1 className="hero-brand">InfraSight</h1>
            <p className="hero-tagline">Spatial asset intelligence for Indian Railways</p>
          </div>
          <p className="hero-bar__hint">Satellite & drone frames · YOLOv8 + optional SAM</p>
          <div className="hero-bar__status">
            <span className="hero-pulse" aria-hidden="true" />
            <span>System active</span>
          </div>
        </div>
      </div>
    </div>
  );
}
