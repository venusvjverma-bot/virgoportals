import { Suspense, useMemo, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  useGLTF,
  OrbitControls,
  Html,
  ContactShadows,
  useProgress,
} from '@react-three/drei';
import { motion, AnimatePresence } from 'motion/react';
import type { Group, Object3D } from 'three';
import * as THREE from 'three';

export type FocusArea = 'overview' | 'dining' | 'kitchen' | 'menu';

const FOCUS_TARGETS: Record<Exclude<FocusArea, 'overview'>, { position: [number, number, number]; scale: number }> = {
  dining: { position: [-1.7, 0.55, 1.6], scale: 0.9 },
  kitchen: { position: [1.6, 0.6, -0.4], scale: 0.85 },
  menu: { position: [-0.3, 0.45, 1.9], scale: 0.7 },
};

type Vec3 = [number, number, number];

/** Places one furniture glb; s scales the ~0.01-unit Quaternius models up. */
function Piece({ src, position, rotation = 0, s = 10 }: { src: string; position: Vec3; rotation?: number; s?: number }) {
  const { scene } = useGLTF(src) as unknown as { scene: Group };
  const clone = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o: Object3D) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return c;
  }, [scene]);
  return (
    <primitive
      object={clone}
      position={position}
      rotation={[0, rotation, 0]}
      scale={[s, s, s]}
    />
  );
}

function RestaurantModel({ onPick }: { onPick: (a: FocusArea) => void }) {
  return (
    <group>
      {/* floor slab — warm wood-toned plinth (the architectural base) */}
      <mesh
        position={[0, -0.06, 0]}
        receiveShadow
        castShadow
        onClick={(e) => {
          e.stopPropagation();
          onPick('overview');
        }}
      >
        <boxGeometry args={[4.6, 0.12, 3.4]} />
        <meshStandardMaterial color="#B08A5A" roughness={0.85} />
      </mesh>
      {/* entrance step */}
      <mesh position={[0, -0.1, 1.78]} receiveShadow>
        <boxGeometry args={[1.1, 0.05, 0.3]} />
        <meshStandardMaterial color="#9C7A4E" roughness={0.9} />
      </mesh>

      {/* back wall (low, so the interior is always visible from above) */}
      <mesh position={[0, 0.5, -1.68]} castShadow receiveShadow>
        <boxGeometry args={[4.6, 1.1, 0.1]} />
        <meshStandardMaterial color="#F3EBDD" roughness={0.9} />
      </mesh>
      {/* side wall, left */}
      <mesh position={[-2.28, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.1, 1.1, 3.4]} />
        <meshStandardMaterial color="#EFE5D4" roughness={0.9} />
      </mesh>
      {/* partition between kitchen and dining */}
      <mesh position={[0.6, 0.5, -0.55]} castShadow receiveShadow>
        <boxGeometry args={[0.07, 1.0, 2.2]} />
        <meshStandardMaterial color="#E7DBC6" roughness={0.9} />
      </mesh>

      {/* ============ DINING AREA (front-left) ============ */}
      <group onClick={(e) => { e.stopPropagation(); onPick('dining'); }}>
        {/* round tables with chairs */}
        {[[-1.5, 0.9], [-0.7, 1.5], [-1.7, 0.1]].map(([x, z], i) => (
          <group key={i} position={[x, 0, z]}>
            <Piece src="/models/restaurant/Table_RoundSmall.glb" position={[0, 0, 0]} s={13} rotation={i * 0.7} />
            <Piece src="/models/restaurant/Chair_1.glb" position={[0.16, 0, 0]} rotation={-Math.PI / 2} s={13} />
            <Piece src="/models/restaurant/Chair_2.glb" position={[-0.16, 0, 0]} rotation={Math.PI / 2} s={13} />
          </group>
        ))}
        {/* couch corner */}
        <Piece src="/models/restaurant/Couch_Medium1.glb" position={[-1.85, 0, -0.75]} rotation={Math.PI / 2} s={12} />
        {/* carpet */}
        <Piece src="/models/restaurant/Carpet_Round.glb" position={[-1.2, 0.02, 0.9]} s={130} />
        {/* hanging ceiling light over dining */}
        <Piece src="/models/restaurant/Light_CeilingSingle.glb" position={[-1.2, 1.05, 0.8]} s={14} />
      </group>

      {/* ============ GUEST MENU / QR STAND (entrance, front-right) ============ */}
      <group onClick={(e) => { e.stopPropagation(); onPick('menu'); }}>
        <Piece src="/models/restaurant/Shelf_Small1.glb" position={[-0.15, 0.02, 1.45]} rotation={-Math.PI / 2} s={12} />
        {/* the QR menu card on the stand */}
        <mesh position={[-0.15, 0.16, 1.45]} rotation={[-0.25, 0, 0]}>
          <boxGeometry args={[0.16, 0.22, 0.015]} />
          <meshStandardMaterial color="#FBF8F2" emissive="#657554" emissiveIntensity={0.08} />
        </mesh>
        {/* welcome plant at the door */}
        <Piece src="/models/restaurant/Houseplant_1.glb" position={[-0.5, 0, 1.55]} s={13} />
      </group>

      {/* ============ SERVICE COUNTER (middle-right) ============ */}
      <group position={[1.35, 0, 0.9]}>
        <Piece src="/models/restaurant/Table_RoundLarge.glb" position={[0, 0, 0]} s={16} rotation={0} />
        <Piece src="/models/restaurant/Plate_1.glb" position={[-0.1, 0.09, 0]} s={14} />
        <Piece src="/models/restaurant/Stool.glb" position={[0, 0, 0.35]} s={13} />
        <Piece src="/models/restaurant/Stool.glb" position={[0.3, 0, -0.2]} s={13} />
      </group>

      {/* ============ KITCHEN (back-right) ============ */}
      <group onClick={(e) => { e.stopPropagation(); onPick('kitchen'); }}>
        <Piece src="/models/restaurant/Kitchen_Oven.glb" position={[1.7, 0, -1.35]} rotation={0} s={13} />
        <Piece src="/models/restaurant/Kitchen_Sink.glb" position={[1.15, 0, -1.35]} s={13} />
        <Piece src="/models/restaurant/Kitchen_Cabinet1.glb" position={[0.75, 0, -1.35]} s={13} />
        <Piece src="/models/restaurant/Kitchen_Fridge.glb" position={[2.1, 0, -1.0]} rotation={-Math.PI / 2} s={13} />
        <Piece src="/models/restaurant/Kitchen_2Drawers.glb" position={[0.95, 0, -0.95]} rotation={Math.PI / 2} s={13} />
        <Piece src="/models/restaurant/Shelf_Small1.glb" position={[1.6, 0.75, -1.5]} s={12} />
        <Piece src="/models/restaurant/Light_CeilingSingle.glb" position={[1.5, 1.05, -1.1]} s={14} />
      </group>

      {/* entrance door frame */}
      <Piece src="/models/restaurant/Door_2.glb" position={[0, 0, 1.66]} s={12} />
      {/* windows on the left wall */}
      <Piece src="/models/restaurant/Window_Small1.glb" position={[-2.2, 0.55, 0.4]} rotation={Math.PI / 2} s={12} />
      <Piece src="/models/restaurant/Window_Small1.glb" position={[-2.2, 0.55, -0.6]} rotation={Math.PI / 2} s={12} />
    </group>
  );
}

/** Smoothly moves the OrbitControls target + camera distance when a focus area is picked. */
function CameraRig({ focus, controls }: { focus: FocusArea; controls: React.MutableRefObject<any> }) {
  const target = focus === 'overview' ? { position: [4.2, 3.4, 4.6] as Vec3, look: [0, 0.3, 0] as Vec3 } : {
    position: FOCUS_TARGETS[focus].position,
    look: FOCUS_TARGETS[focus].position.map((v, i) => (i === 1 ? v * 0.4 : v * 0.6)) as Vec3,
  };
  const t = useRef(0);
  const from = useRef({ pos: new THREE.Vector3(4.2, 3.4, 4.6), look: new THREE.Vector3(0, 0.3, 0) });
  const to = useRef({ pos: new THREE.Vector3(), look: new THREE.Vector3() });

  useEffect(() => {
    to.current.pos.set(...target.position);
    to.current.look.set(...target.look);
    if (controls.current) {
      from.current.pos.copy(controls.current.object.position);
      from.current.look.copy(controls.current.target);
    }
    t.current = 0;
  }, [focus, target.position, target.look]);

  useFrameLerp(t, from, to, controls);
  return null;
}

function useFrameLerp(
  t: React.MutableRefObject<number>,
  from: React.MutableRefObject<{ pos: THREE.Vector3; look: THREE.Vector3 }>,
  to: React.MutableRefObject<{ pos: THREE.Vector3; look: THREE.Vector3 }>,
  controls: React.MutableRefObject<any>,
) {
  useFrame((_, delta) => {
    if (!controls.current) return;
    if (t.current < 1) {
      t.current = Math.min(1, t.current + delta * 2.2);
      const e = 1 - Math.pow(1 - t.current, 3); // easeOutCubic
      controls.current.object.position.lerpVectors(from.current.pos, to.current.pos, e);
      controls.current.target.lerpVectors(from.current.look, to.current.look, e);
      controls.current.update();
    }
  });
}

export function RestaurantShowcase() {
  const [focus, setFocus] = useState<FocusArea>('overview');
  const controls = useRef<any>(null);
  const [webglOk, setWebglOk] = useState(true);

  useEffect(() => {
    try {
      const c = document.createElement('canvas');
      setWebglOk(!!(c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch {
      setWebglOk(false);
    }
  }, []);

  if (!webglOk) {
    return (
      <div className="flex h-[420px] w-full items-center justify-center rounded-3xl bg-white shadow-soft ring-1 ring-cream-200 sm:h-[480px]">
        <p className="max-w-xs px-6 text-center text-sm text-ink-soft">
          Your browser cannot display the 3D restaurant model. Everything else on this page works as usual.
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-[420px] w-full overflow-hidden rounded-3xl bg-gradient-to-b from-cream-100 to-cream-200 shadow-lift ring-1 ring-cream-200 sm:h-[520px]">
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [4.2, 3.4, 4.6], fov: 42, near: 0.1, far: 60 }}
        gl={{ antialias: true, alpha: true }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.85} />
          <directionalLight position={[4, 6, 3]} intensity={1.5} castShadow shadow-mapSize={[1024, 1024]}>
            <orthographicCamera attach="shadow-camera" args={[-5, 5, 5, -5, 0.1, 20]} />
          </directionalLight>
          <directionalLight position={[-3, 4, -4]} intensity={0.4} />

          <RestaurantModel onPick={setFocus} />
          <ContactShadows position={[0, -0.13, 0]} opacity={0.25} scale={9} blur={2.5} far={3} color="#7A6A4F" />

          <Html position={[-1.2, 1.3, 0.8]} center distanceFactor={8} zIndexRange={[20, 0]}>
            <button
              onClick={() => setFocus('dining')}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold shadow-soft ring-1 transition-colors ${
                focus === 'dining' ? 'bg-olive-700 text-white ring-olive-700' : 'bg-white/95 text-ink ring-cream-200 hover:bg-olive-50'
              }`}
            >
              Dining room
            </button>
          </Html>
          <Html position={[1.5, 1.3, -1.1]} center distanceFactor={8} zIndexRange={[20, 0]}>
            <button
              onClick={() => setFocus('kitchen')}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold shadow-soft ring-1 transition-colors ${
                focus === 'kitchen' ? 'bg-olive-700 text-white ring-olive-700' : 'bg-white/95 text-ink ring-cream-200 hover:bg-olive-50'
              }`}
            >
              Kitchen
            </button>
          </Html>
          <Html position={[-0.15, 0.55, 1.45]} center distanceFactor={8} zIndexRange={[20, 0]}>
            <button
              onClick={() => setFocus('menu')}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold shadow-soft ring-1 transition-colors ${
                focus === 'menu' ? 'bg-olive-700 text-white ring-olive-700' : 'bg-white/95 text-ink ring-cream-200 hover:bg-olive-50'
              }`}
            >
              Guest menu
            </button>
          </Html>

          <OrbitControls
            ref={controls}
            enablePan={false}
            minDistance={2.2}
            maxDistance={9}
            maxPolarAngle={Math.PI / 2.1}
            minPolarAngle={0.5}
            makeDefault
          />
          <CameraRig focus={focus} controls={controls} />
        </Suspense>
      </Canvas>

      {/* instruction hint */}
      <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white/85 px-4 py-1.5 text-xs font-medium text-ink-soft shadow-soft ring-1 ring-cream-200 backdrop-blur-sm">
        Drag to explore · Pinch to zoom
      </div>

      {/* reset control */}
      <AnimatePresence>
        {focus !== 'overview' && (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            onClick={() => setFocus('overview')}
            className="absolute right-3 top-3 rounded-full bg-olive-700 px-4 py-2 text-xs font-semibold text-white shadow-lift transition-colors hover:bg-olive-800"
          >
            Show full restaurant
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

useGLTF.preload('/models/restaurant/Table_RoundSmall.glb');
