/**
 * Lightweight screen-space labels: DOM nodes positioned every frame from 3D points.
 * Imperative (no React roots per label) — robust and cheap.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export interface LabelItem {
  id: string;
  pos: THREE.Vector3;
  text: string;
  className: string;
  color?: string;
}

const v = new THREE.Vector3();

export function Labels({ items }: { items: LabelItem[] }) {
  const gl = useThree((s) => s.gl);
  const layer = useRef<HTMLDivElement | null>(null);
  const nodes = useRef<{ el: HTMLDivElement; pos: THREE.Vector3 }[]>([]);

  useEffect(() => {
    const parent = gl.domElement.parentElement;
    if (!parent) return;
    const div = document.createElement('div');
    div.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:5';
    parent.appendChild(div);
    layer.current = div;
    return () => {
      div.remove();
      layer.current = null;
    };
  }, [gl]);

  useEffect(() => {
    const div = layer.current;
    if (!div) return;
    div.replaceChildren();
    nodes.current = items.map((it) => {
      const el = document.createElement('div');
      el.className = it.className;
      el.textContent = it.text;
      if (it.color) {
        el.style.color = it.color;
        el.style.borderColor = it.color + '55';
      }
      el.style.position = 'absolute';
      el.style.left = '0';
      el.style.top = '0';
      el.style.willChange = 'transform';
      div.appendChild(el);
      return { el, pos: it.pos };
    });
  }, [items]);

  useFrame(({ camera, size }) => {
    for (const n of nodes.current) {
      v.copy(n.pos).project(camera);
      const visible = v.z < 1 && v.z > -1;
      if (!visible) {
        n.el.style.display = 'none';
        continue;
      }
      n.el.style.display = '';
      const x = (v.x * 0.5 + 0.5) * size.width;
      const y = (-v.y * 0.5 + 0.5) * size.height;
      n.el.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    }
  });

  return null;
}
