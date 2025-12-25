"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface CurvedLineProps {
  from: THREE.Vector3;
  to: THREE.Vector3;
  color: string;
  /** Step for particle visibility animation (particles only visible in step 3) */
  step?: 2 | 3;
}

/**
 * Animated curved line with flowing particle effect.
 * Draws a bezier curve between two points with a glowing particle that travels along it.
 * Particles animate in only on step 3.
 */
export function CurvedLine({ from, to, color, step = 3 }: CurvedLineProps) {
  const particleRef = useRef<THREE.Mesh>(null);
  const particleVisibilityRef = useRef(step === 3 ? 1 : 0);

  const { curve, tubeGeometry } = useMemo(() => {
    const mid = new THREE.Vector3((from.x + to.x) / 2, (from.y + to.y) / 2, 0);
    mid.y += 0.9;
    const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
    const tubeGeometry = new THREE.TubeGeometry(curve, 48, 0.035, 8, false);
    return { curve, tubeGeometry };
  }, [from, to]);

  useFrame(({ clock }) => {
    if (!particleRef.current) return;

    // Animate particle visibility based on step
    const targetVisibility = step === 3 ? 1 : 0;
    particleVisibilityRef.current += (targetVisibility - particleVisibilityRef.current) * 0.1;

    // Animate particle along the curve from 0 to 1
    const t = (clock.getElapsedTime() * 0.3) % 1;
    const point = curve.getPoint(t);
    particleRef.current.position.copy(point);

    // Scale: grow from 0 at start, shrink to 0 at end
    let baseScale = 1;
    if (t < 0.15) {
      baseScale = t / 0.15;
    } else if (t > 0.85) {
      baseScale = (1 - t) / 0.15;
    }

    // Apply visibility animation
    particleRef.current.scale.setScalar(baseScale * particleVisibilityRef.current);
    particleRef.current.visible = particleVisibilityRef.current > 0.01;
  });

  return (
    <group>
      {/* Main line */}
      <mesh geometry={tubeGeometry}>
        <meshBasicMaterial color={color} transparent opacity={0.6} />
      </mesh>
      {/* Animated flow particle with glow */}
      <mesh ref={particleRef}>
        {/* Outer glow */}
        <mesh>
          <sphereGeometry args={[0.14, 16, 16]} />
          <meshBasicMaterial color={color} transparent opacity={0.25} />
        </mesh>
        {/* Main particle */}
        <mesh>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshBasicMaterial color={color} />
        </mesh>
      </mesh>
    </group>
  );
}
