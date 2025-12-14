"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface AvyLogoProps {
  isPanning?: boolean;
  panDelta?: { x: number; y: number };
}

const vertexShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vViewPosition;

  uniform float uTime;
  uniform float uIntensity;

  void main() {
    vNormal = normalize(normalMatrix * normal);

    // Speed and amplitude based on pan intensity
    float speed = 1.0 + uIntensity * 0.3;
    float amp = 0.08 + uIntensity * 0.03;

    // Simple layered sine displacement for organic movement
    float wave1 = sin(position.x * 3.0 + uTime * speed) * sin(position.y * 2.0 + uTime * 0.8 * speed);
    float wave2 = sin(position.z * 2.5 - uTime * 0.7 * speed) * 0.5;
    float pulse = sin(uTime * 2.0 * speed) * 0.02 + 1.0;

    vec3 displaced = position * pulse + normal * (wave1 + wave2) * amp;
    vPosition = displaced;

    vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vViewPosition;

  uniform float uTime;
  uniform float uIntensity;

  void main() {
    vec3 viewDir = normalize(vViewPosition);
    vec3 normal = normalize(vNormal);
    float speed = 1.0 + uIntensity * 0.3;

    // Fresnel for edge glow
    float fresnel = 1.0 - abs(dot(viewDir, normal));
    float edge = smoothstep(0.2, 0.7, fresnel);

    // App theme colors
    vec3 cyan = vec3(0.133, 0.827, 0.933);    // #22d3ee
    vec3 purple = vec3(0.659, 0.333, 0.969);  // #a855f7
    vec3 amber = vec3(0.961, 0.620, 0.043);   // #f59e0b

    // Gradient based on position + time
    float gradient = sin(vPosition.y * 2.0 + vPosition.x + uTime * 0.5 * speed) * 0.5 + 0.5;
    vec3 baseColor = mix(cyan, purple, gradient);

    // Subtle amber accent
    float accentMix = sin(vPosition.z * 3.0 + uTime * 0.3 * speed) * 0.5 + 0.5;
    baseColor = mix(baseColor, amber, accentMix * 0.15);

    // White edge with color tint
    vec3 edgeColor = mix(vec3(1.0), baseColor, 0.2);
    vec3 finalColor = mix(baseColor, edgeColor, edge);

    // Alpha with pulsing glow
    float interiorAlpha = (1.0 - fresnel * 0.6) * 0.6;
    float glowPulse = sin(uTime * 3.0 * speed) * 0.1 + 0.9;
    float finalAlpha = clamp(max(interiorAlpha, edge) * glowPulse + edge * 0.3, 0.0, 1.0);

    // Brightness boost when panning
    finalColor *= 1.0 + uIntensity * 0.1;

    gl_FragColor = vec4(finalColor, finalAlpha);
  }
`;

function FluidSphere({ isPanning, panDelta }: { isPanning?: boolean; panDelta?: { x: number; y: number } }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const intensity = useRef(0);
  const panRotation = useRef({ x: 0, y: 0 });

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uIntensity: { value: 0 },
  }), []);

  useFrame((state, delta) => {
    if (!meshRef.current || !materialRef.current) return;

    const t = state.clock.elapsedTime;
    materialRef.current.uniforms.uTime.value = t;

    // Smooth intensity interpolation
    const target = isPanning ? 1 : 0;
    const lerpSpeed = isPanning ? 8 : 4;
    intensity.current += (target - intensity.current) * Math.min(delta * lerpSpeed, 1);
    materialRef.current.uniforms.uIntensity.value = intensity.current;

    // Pan-induced rotation
    if (isPanning && panDelta) {
      panRotation.current.y += panDelta.x * 0.008;
      panRotation.current.x += panDelta.y * 0.008;
    }
    panRotation.current.x *= 0.98;
    panRotation.current.y *= 0.98;

    // Apply rotation
    meshRef.current.rotation.y = t * 0.3 + panRotation.current.y;
    meshRef.current.rotation.x = Math.sin(t * 0.2) * 0.3 + panRotation.current.x;
    meshRef.current.rotation.z = Math.cos(t * 0.15) * 0.1;
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1, 64, 64]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export function AvyLogo({ isPanning, panDelta }: AvyLogoProps) {
  return (
    <div className="flex items-center gap-2 pointer-events-none select-none">
      <div style={{ width: 48, height: 48 }}>
        <Canvas
          camera={{ position: [0, 0, 3.5], fov: 45 }}
          gl={{ antialias: true, alpha: true }}
          dpr={[2, 4]}
          style={{ background: "transparent" }}
        >
          <FluidSphere isPanning={isPanning} panDelta={panDelta} />
        </Canvas>
      </div>
      <span className="text-white font-medium text-xl tracking-wide">avy</span>
    </div>
  );
}
