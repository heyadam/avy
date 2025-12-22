"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { ReactFlow } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { ArrowLeft, KeyRound, Sparkles, X } from "lucide-react";
import { nodeTypes } from "./nodes";
import { edgeTypes } from "./edges/ColoredEdge";
import { welcomePreviewEdges, welcomePreviewNodes } from "@/lib/welcome-preview-flow";

const STORAGE_KEY = "avy-nux-step";

function HeroPanel({ children }: { children: ReactNode }) {
  return (
    <div className="relative h-full w-full overflow-hidden border bg-muted/40">
      {/* Background polish */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(1200px_circle_at_30%_20%,hsl(var(--primary)/0.20),transparent_55%),radial-gradient(900px_circle_at_70%_80%,hsl(var(--foreground)/0.10),transparent_50%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70 [background-image:linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] [background-size:48px_48px]"
      />
      {children}

      {/* Soft vignette */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-black/10 to-transparent"
      />
    </div>
  );
}

function RoundedTile({
  position,
  size = 1.55,
  children,
}: {
  position: [number, number, number];
  size?: number;
  children?: ReactNode;
}) {
  const geom = useMemo(() => {
    const r = 0.25;
    const w = size;
    const h = size;
    const x = -w / 2;
    const y = -h / 2;
    const shape = new THREE.Shape();
    shape.moveTo(x + r, y);
    shape.lineTo(x + w - r, y);
    shape.quadraticCurveTo(x + w, y, x + w, y + r);
    shape.lineTo(x + w, y + h - r);
    shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    shape.lineTo(x + r, y + h);
    shape.quadraticCurveTo(x, y + h, x, y + h - r);
    shape.lineTo(x, y + r);
    shape.quadraticCurveTo(x, y, x + r, y);
    return new THREE.ShapeGeometry(shape, 24);
  }, [size]);

  return (
    <group position={position}>
      {/* Outer border */}
      <mesh geometry={geom}>
        <meshBasicMaterial color={"#1f1f22"} transparent opacity={0.95} />
      </mesh>
      {/* Inner fill */}
      <mesh scale={[0.96, 0.96, 1]}>
        <primitive object={geom} attach="geometry" />
        <meshBasicMaterial color={"#0B0B0C"} transparent opacity={0.92} />
      </mesh>
      <group position={[0, 0, 0.02]}>{children}</group>
    </group>
  );
}

function GoogleIcon2D() {
  // Gemini sparkle: four-pointed star with gradient colors
  const starShape = useMemo(() => {
    const points = 4;
    const outerRadius = 0.45;
    const innerRadius = 0.16;
    
    const shape = new THREE.Shape();
    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (i * Math.PI) / points - Math.PI / 2; // Start from top
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) {
        shape.moveTo(x, y);
      } else {
        shape.lineTo(x, y);
      }
    }
    shape.closePath();
    return shape;
  }, []);

  return (
    <group>
      {/* Main star with blue gradient effect */}
      <mesh>
        <shapeGeometry args={[starShape]} />
        <meshBasicMaterial color="#4285F4" />
      </mesh>
      {/* Add colored accents for Gemini's multi-color look */}
      <mesh position={[-0.02, 0.02, 0.01]} scale={0.85}>
        <shapeGeometry args={[starShape]} />
        <meshBasicMaterial color="#9C9EFF" opacity={0.6} transparent />
      </mesh>
    </group>
  );
}

function ClaudeIcon2D() {
  const svgData = useLoader(SVGLoader, "/claude.svg");
  
  const shapes = useMemo(() => {
    if (!svgData || !svgData.paths) return [];
    
    const allShapes: { shape: THREE.Shape; color: string }[] = [];
    svgData.paths.forEach((path) => {
      const pathShapes = SVGLoader.createShapes(path);
      pathShapes.forEach((shape) => {
        allShapes.push({
          shape,
          color: path.color ? `#${path.color.getHexString()}` : "#F59E0B",
        });
      });
    });
    return allShapes;
  }, [svgData]);

  const { center, scale } = useMemo(() => {
    if (shapes.length === 0) {
      return { center: new THREE.Vector3(), scale: 1 };
    }
    
    const box = new THREE.Box3();
    shapes.forEach(({ shape }) => {
      const points = shape.getPoints();
      points.forEach((p) => box.expandByPoint(new THREE.Vector3(p.x, p.y, 0)));
    });
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y);
    const targetSize = 0.7;
    const scale = maxDim > 0 ? targetSize / maxDim : 1;
    return { center, scale };
  }, [shapes]);

  if (shapes.length === 0) return null;

  return (
    <group scale={[scale, -scale, 1]} position={[-center.x * scale, center.y * scale, 0]}>
      {shapes.map(({ shape, color }, i) => (
        <mesh key={i}>
          <shapeGeometry args={[shape]} />
          <meshBasicMaterial color={color} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

function OpenAIIcon2D() {
  const svgData = useLoader(SVGLoader, "/openai.svg");
  
  const shapes = useMemo(() => {
    if (!svgData || !svgData.paths) return [];
    
    const allShapes: { shape: THREE.Shape; color: string }[] = [];
    svgData.paths.forEach((path) => {
      const pathShapes = SVGLoader.createShapes(path);
      pathShapes.forEach((shape) => {
        allShapes.push({
          shape,
          color: "#FFFFFF", // Force white since the SVG has black fill
        });
      });
    });
    return allShapes;
  }, [svgData]);

  const { center, scale } = useMemo(() => {
    if (shapes.length === 0) {
      return { center: new THREE.Vector3(), scale: 1 };
    }
    
    const box = new THREE.Box3();
    shapes.forEach(({ shape }) => {
      const points = shape.getPoints();
      points.forEach((p) => box.expandByPoint(new THREE.Vector3(p.x, p.y, 0)));
    });
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y);
    const targetSize = 0.7;
    const scale = maxDim > 0 ? targetSize / maxDim : 1;
    return { center, scale };
  }, [shapes]);

  if (shapes.length === 0) return null;

  return (
    <group scale={[scale, -scale, 1]} position={[-center.x * scale, center.y * scale, 0]}>
      {shapes.map(({ shape, color }, i) => (
        <mesh key={i}>
          <shapeGeometry args={[shape]} />
          <meshBasicMaterial color={color} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

function ComposerIcon2D() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    // Smooth pulsing: scale between 0.95 and 1.05
    const pulse = 1 + Math.sin(clock.getElapsedTime() * 2) * 0.05;
    meshRef.current.scale.setScalar(pulse);
  });

  return (
    <mesh ref={meshRef}>
      <circleGeometry args={[0.48, 64]} />
      <meshBasicMaterial color="#FFFFFF" />
    </mesh>
  );
}

function CurvedLine2D({
  from,
  to,
  color,
}: {
  from: THREE.Vector3;
  to: THREE.Vector3;
  color: string;
}) {
  const particleRef = useRef<THREE.Mesh>(null);
  
  const { curve, tubeGeometry } = useMemo(() => {
    const mid = new THREE.Vector3((from.x + to.x) / 2, (from.y + to.y) / 2, 0);
    mid.y += 0.9;
    const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
    const tubeGeometry = new THREE.TubeGeometry(curve, 48, 0.035, 8, false);
    return { curve, tubeGeometry };
  }, [from, to]);

  useFrame(({ clock }) => {
    if (!particleRef.current) return;
    // Animate particle along the curve from 0 to 1
    const t = (clock.getElapsedTime() * 0.3) % 1;
    const point = curve.getPoint(t);
    particleRef.current.position.copy(point);
    
    // Scale: grow from 0 at start, shrink to 0 at end
    let scale = 1;
    if (t < 0.15) {
      // Grow in first 15%
      scale = t / 0.15;
    } else if (t > 0.85) {
      // Shrink in last 15%
      scale = (1 - t) / 0.15;
    }
    particleRef.current.scale.setScalar(scale);
  });

  return (
    <group>
      {/* Thick line */}
      <mesh geometry={tubeGeometry}>
        <meshBasicMaterial color={color} transparent opacity={0.5} />
      </mesh>
      {/* Animated flow particle */}
      <mesh ref={particleRef}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

function ProvidersToComposerHero() {
  const topY = 1.85;
  const bottomY = -2.05;
  const topX = [-2.25, 0, 2.25] as const;

  const composerPos = new THREE.Vector3(0, bottomY, 0);
  const openaiPos = new THREE.Vector3(topX[0], topY, 0);
  const googlePos = new THREE.Vector3(topX[1], topY, 0);
  const claudePos = new THREE.Vector3(topX[2], topY, 0);

  return (
    <HeroPanel>
      <div className="pointer-events-none absolute inset-0 z-20">
        <Canvas
          orthographic
          camera={{ position: [0, 0, 10], zoom: 40 }}
          dpr={[1, 2]}
          frameloop="always"
          gl={{ antialias: true, alpha: true }}
        >
          {/* Lines (behind) */}
          <CurvedLine2D
            from={new THREE.Vector3(openaiPos.x, openaiPos.y - 0.85, 0)}
            to={new THREE.Vector3(composerPos.x, composerPos.y + 0.9, 0)}
            color="#FFFFFF"
          />
          <CurvedLine2D
            from={new THREE.Vector3(googlePos.x, googlePos.y - 0.85, 0)}
            to={new THREE.Vector3(composerPos.x, composerPos.y + 0.9, 0)}
            color="#4285F4"
          />
          <CurvedLine2D
            from={new THREE.Vector3(claudePos.x, claudePos.y - 0.85, 0)}
            to={new THREE.Vector3(composerPos.x, composerPos.y + 0.9, 0)}
            color="#F97316"
          />

          {/* Provider tiles */}
          <RoundedTile position={[openaiPos.x, openaiPos.y, 0]}>
            <Suspense fallback={null}>
              <OpenAIIcon2D />
            </Suspense>
          </RoundedTile>
          <RoundedTile position={[googlePos.x, googlePos.y, 0]}>
            <GoogleIcon2D />
          </RoundedTile>
          <RoundedTile position={[claudePos.x, claudePos.y, 0]}>
            <Suspense fallback={null}>
              <ClaudeIcon2D />
            </Suspense>
          </RoundedTile>

          {/* Composer tile */}
          <RoundedTile position={[composerPos.x, composerPos.y, 0]} size={1.75}>
            <ComposerIcon2D />
          </RoundedTile>
        </Canvas>
      </div>
    </HeroPanel>
  );
}

function MiniNodeCanvasDemo() {
  return (
    <HeroPanel>
      <div className="pointer-events-none absolute inset-0 z-20">
        <ReactFlow
          nodes={welcomePreviewNodes}
          edges={welcomePreviewEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.05, minZoom: 0.1, maxZoom: 1.0 }}
          minZoom={0.1}
          maxZoom={1.0}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          panOnScroll={false}
          panOnDrag={false}
        />
      </div>

      <div className="pointer-events-none absolute bottom-5 left-5 z-30 max-w-[340px] rounded-xl border bg-background/75 p-4 text-sm text-muted-foreground shadow-sm backdrop-blur-sm">
        <div className="font-medium text-foreground">Build flows visually</div>
        <div className="mt-1">Connect nodes to turn inputs into outputs</div>
      </div>
    </HeroPanel>
  );
}

function StepIndicator({ currentStep }: { currentStep: 1 | 2 }) {
  return (
    <div
      className="inline-flex min-w-[106px] items-center justify-center gap-2 whitespace-nowrap rounded-full border bg-background/60 px-2.5 py-1 text-xs font-medium tabular-nums text-muted-foreground backdrop-blur-sm"
      aria-label={`Step ${currentStep} of 2`}
    >
      <span>Step {currentStep} of 2</span>
      <span aria-hidden className="h-1 w-1 rounded-full bg-muted-foreground/40" />
      <span aria-hidden className="inline-flex items-center gap-1">
        <span
          className={[
            "h-1.5 w-1.5 rounded-full",
            currentStep === 1 ? "bg-foreground" : "bg-muted-foreground/30",
          ].join(" ")}
        />
        <span
          className={[
            "h-1.5 w-1.5 rounded-full",
            currentStep === 2 ? "bg-foreground" : "bg-muted-foreground/30",
          ].join(" ")}
        />
      </span>
    </div>
  );
}

type NuxStep = "1" | "2" | "done";

interface WelcomeDialogProps {
  onOpenSettings: () => void;
}

function DialogShell({
  step,
  title,
  description,
  children,
  onBack,
  hero,
}: {
  step: 1 | 2;
  title: ReactNode;
  description: ReactNode;
  children: ReactNode;
  onBack?: () => void;
  hero: ReactNode;
}) {
  return (
    <DialogContent
      showCloseButton={false}
      className="max-h-[calc(100vh-2rem)] p-0 gap-0 overflow-hidden sm:max-w-[980px]"
    >
      <DialogClose asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute right-4 top-4 z-30 rounded-full border bg-background/70 backdrop-blur-sm hover:bg-background/80"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </Button>
      </DialogClose>
      <div className="grid h-full md:min-h-[560px] grid-rows-[auto_minmax(220px,1fr)] md:grid-cols-[1fr_1.15fr] md:grid-rows-1">
        {/* Left: content */}
        <div className="relative flex min-h-0 flex-col justify-between p-6 sm:p-8">
          <div className="flex h-8 items-center justify-between gap-3 pr-12 md:pr-0">
            <div className="flex h-8 items-center">
              {onBack ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onBack}
                  className="-ml-2 h-8 px-2 text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
              ) : (
                <div className="flex h-8 items-center gap-2">
                  <div
                    aria-hidden
                    className="h-7 w-7 rounded-md border shadow-xs bg-[radial-gradient(120%_120%_at_20%_20%,hsl(var(--primary)/0.55),transparent_55%),radial-gradient(100%_100%_at_80%_80%,hsl(var(--foreground)/0.18),transparent_55%)]"
                  />
                  <span className="text-sm font-medium tracking-tight">Composer</span>
                </div>
              )}
            </div>

            <StepIndicator currentStep={step} />
          </div>

          <div className="mt-10 min-h-0">
            <DialogHeader className="text-left">
              <DialogTitle className="text-3xl font-semibold tracking-tight sm:text-4xl">
                {title}
              </DialogTitle>
              <DialogDescription className="mt-3 text-base sm:text-[15px]">
                {description}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-7">{children}</div>
          </div>

          <div className="mt-10" />
        </div>

        {/* Right: hero */}
        <div className="min-h-[220px] border-t md:min-h-0 md:border-t-0 md:border-l">
          {hero}
        </div>
      </div>
    </DialogContent>
  );
}

export function WelcomeDialog({ onOpenSettings }: WelcomeDialogProps) {
  const { user, isLoading, signInWithGoogle } = useAuth();
  const [nuxStep, setNuxStep] = useState<NuxStep>("1");
  const [isLoaded, setIsLoaded] = useState(false);

  // Load NUX step from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as NuxStep | null;
      if (stored === "1" || stored === "2" || stored === "done") {
        setNuxStep(stored);
      }
    } catch {
      // localStorage unavailable, default to step 1
    }
    setIsLoaded(true);
  }, []);

  const advanceToStep2 = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "2");
    } catch {
      // localStorage unavailable
    }
    setNuxStep("2");
  };

  const completeNux = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "done");
    } catch {
      // localStorage unavailable
    }
    setNuxStep("done");
  };

  // Auto-advance to step 2 when user signs in during step 1
  useEffect(() => {
    if (isLoaded && user && nuxStep === "1") {
      advanceToStep2();
    }
  }, [isLoaded, user, nuxStep]);

  const handleSkipSignIn = () => {
    advanceToStep2();
  };

  const handleSetupApiKeys = () => {
    // Complete NUX first, then open settings to avoid focus flicker
    completeNux();
    onOpenSettings();
  };

  const handleDismissApiKeys = () => {
    completeNux();
  };

  const handleBackToSignIn = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // localStorage unavailable
    }
    setNuxStep("1");
  };

  // Early return before Dialog to avoid portal hydration issues
  if (!isLoaded) return null;

  // NUX complete - show nothing
  if (nuxStep === "done") return null;

  // Still loading auth - wait
  if (isLoading) return null;

  // Step 2: API Keys (show if step is "2" OR if user is signed in and hasn't completed NUX)
  if (nuxStep === "2" || user) {
    return (
      <Dialog
        open={true}
        onOpenChange={(open) => {
          if (!open) handleDismissApiKeys();
        }}
      >
        <DialogShell
          step={2}
          title="Connect Your AI Providers"
          description="Add at least one API key to run nodes"
          onBack={!user ? handleBackToSignIn : undefined}
          hero={<ProvidersToComposerHero />}
        >
          <div className="grid gap-5">
            <div className="grid gap-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 grid h-9 w-9 place-items-center rounded-lg border bg-foreground/5">
                  <KeyRound className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium">Bring your own keys</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Add OpenAI, Anthropic, and more in Settings
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="mt-0.5 grid h-9 w-9 place-items-center rounded-lg border bg-foreground/5">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium">Instant previews</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Run nodes and inspect outputs as you build
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <Button onClick={handleSetupApiKeys} className="h-10 w-full">
                Open API Keys
              </Button>
            </div>
          </div>
        </DialogShell>
      </Dialog>
    );
  }

  // Step 1: Sign in (only shown if not signed in)
  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) handleSkipSignIn();
      }}
    >
      <DialogShell
        step={1}
        title="Welcome to Composer"
        description="Design, run, and iterate on visual AI workflows"
        hero={<MiniNodeCanvasDemo />}
      >
        <div className="grid gap-6">
          <div className="grid gap-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 grid h-9 w-9 place-items-center rounded-lg border bg-foreground/5">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium">Build like a canvas</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Connect nodes to shape prompts, tools, and transforms
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-0.5 grid h-9 w-9 place-items-center rounded-lg border bg-foreground/5">
                <KeyRound className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium">Save work anywhere</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Sign in to sync flows across devices
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-2">
            <Button onClick={signInWithGoogle} className="h-10 w-full">
              Continue with Google
            </Button>
            <Button
              variant="outline"
              onClick={handleSkipSignIn}
              className="mt-2 h-10 w-full"
            >
              Continue Without an Account
            </Button>
            <p className="text-xs text-muted-foreground">
              You can sign in later from the profile menu
            </p>
          </div>
        </div>
      </DialogShell>
    </Dialog>
  );
}
