import { Suspense, useMemo, useRef, useState, useEffect, Component, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, OrbitControls, Html, useProgress } from '@react-three/drei';
import { motion, AnimatePresence } from 'motion/react';
import * as THREE from 'three';

export type FocusArea = 'overview' | 'dining' | 'kitchen' | 'menu';

type Vec3 = [number, number, number];

const MODEL_DIR = '/models/restaurant';

/**
 * Desired real-world size (metres) for each piece. Each model is normalised so its
 * HEIGHT (y) matches this value, keeping Quaternius proportions consistent.
 */
const PIECE_HEIGHT: Record<string, number> = {
  'Table_RoundSmall.glb': 0.72, // → ~1.2 m diameter
  'Table_RoundLarge.glb': 0.7, // → ~2.3 m diameter counter
  'Chair_1.glb': 1.0,
  'Chair_2.glb': 1.0,
  'Stool.glb': 0.75,
  'Couch_Medium1.glb': 0.85,
  'Carpet_Round.glb': 0.02,
  'Kitchen_Oven.glb': 0.95,
  'Kitchen_Sink.glb': 0.95,
  'Kitchen_Cabinet1.glb': 0.95,
  'Kitchen_Cabinet2.glb': 0.95,
  'Kitchen_2Drawers.glb': 0.95,
  'Kitchen_Fridge.glb': 1.85,
  'Shelf_Small1.glb': 0.6,
  'Plate_1.glb': 0.03,
  'Houseplant_1.glb': 0.6,
  'Light_CeilingSingle.glb': 0.4,
  'Door_2.glb': 2.1,
  'Window_Small1.glb': 1.1,
};

for (const name of Object.keys(PIECE_HEIGHT)) useGLTF.preload(`${MODEL_DIR}/${name}`);

/**
 * Loads one furniture glb, measures its bounding box, normalises its scale to the
 * desired real-world size, and sits its base on y=0 centred at the given position.
 */
function Piece({ src, position, rotation = 0 }: { src: string; position: Vec3; rotation?: number }) {
  const { scene } = useGLTF(src) as unknown as { scene: THREE.Group };
  const { object, height } = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        o.frustumCulled = false;
      }
    });
    // Measure bounds (the glb has an internal x100 node scale and a -90° X rotation,
    // so Box3 on the scene gives true world dimensions).
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    box.getSize(size);
    const target = PIECE_HEIGHT[src.split('/').pop() ?? ''] ?? 1;
    const s = target / (size.y || 1);
    clone.scale.setScalar(s);
    // Re-measure after scaling and align: base on y=0, centred on x/z.
    box.setFromObject(clone);
    const centre = new THREE.Vector3();
    box.getCenter(centre);
    clone.position.x = position[0] - centre.x;
    clone.position.y = position[1] - box.min.y;
    clone.position.z = position[2] - centre.z;
    return { object: clone, height: (box.max.y - box.min.y) * 1 };
  }, [scene, position, rotation, src]);

  return <primitive object={object} rotation={[0, rotation, 0]} data-height={height} />;
}

/** Static architecture: floor, entrance step and low cutaway walls. */
function Building({ onPick }: { onPick: (a: FocusArea) => void }) {
  return (
    <group>
      {/* wooden floor slab */}
      <mesh
        position={[0, -0.05, 0]}
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          onPick('overview');
        }}
      >
        <boxGeometry args={[4.6, 0.1, 3.4]} />
        <meshStandardMaterial color="#C89B64" roughness={0.8} />
      </mesh>
      {/* entrance step */}
      <mesh position={[0, -0.08, 1.8]} receiveShadow>
        <boxGeometry args={[1.1, 0.06, 0.35]} />
        <meshStandardMaterial color="#B08A5A" roughness={0.9} />
      </mesh>
      {/* back wall — low so the interior stays visible from any angle */}
      <mesh position={[0, 0.45, -1.68]} castShadow receiveShadow>
        <boxGeometry args={[4.6, 0.9, 0.1]} />
        <meshStandardMaterial color="#F5EEE0" roughness={0.9} />
      </mesh>
      {/* left wall — low */}
      <mesh position={[-2.28, 0.45, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.1, 0.9, 3.4]} />
        <meshStandardMaterial color="#F1E8D7" roughness={0.9} />
      </mesh>
      {/* kitchen / dining partition — low */}
      <mesh position={[0.62, 0.4, -0.5]} castShadow receiveShadow>
        <boxGeometry args={[0.08, 0.8, 2.4]} />
        <meshStandardMaterial color="#EADDC6" roughness={0.9} />
      </mesh>
    </group>
  );
}

function DiningRoom({ onPick }: { onPick: (a: FocusArea) => void }) {
  return (
    <group
      onClick={(e) => {
        e.stopPropagation();
        onPick('dining');
      }}
    >
      {/* three dining tables, each with two chairs */}
      {(
        [
          [-1.55, 1.15, 0.3],
          [-0.75, 1.6, 1.4],
          [-1.75, 0.35, 2.2],
        ] as const
      ).map(([x, z, r], i) => (
        <group key={i} position={[x, 0, z]}>
          <Piece src={`${MODEL_DIR}/Table_RoundSmall.glb`} position={[0, 0, 0]} rotation={r} />
          <Piece src={`${MODEL_DIR}/Chair_1.glb`} position={[0.34, 0, 0]} rotation={-Math.PI / 2} />
          <Piece src={`${MODEL_DIR}/Chair_2.glb`} position={[-0.34, 0, 0]} rotation={Math.PI / 2} />
          <Piece src={`${MODEL_DIR}/Plate_1.glb`} position={[0.05, 0.76, 0]} />
        </group>
      ))}
      {/* lounge corner */}
      <Piece src={`${MODEL_DIR}/Couch_Medium1.glb`} position={[-1.85, 0, -0.7]} rotation={Math.PI / 2} />
      <Piece src={`${MODEL_DIR}/Carpet_Round.glb`} position={[-1.2, 0.02, 0.8]} />
      {/* plant decoration */}
      <Piece src={`${MODEL_DIR}/Houseplant_1.glb`} position={[-0.9, 0, -0.2]} />
      {/* hanging light over the dining room */}
      <Piece src={`${MODEL_DIR}/Light_CeilingSingle.glb`} position={[-1.2, 1.35, 0.9]} />
    </group>
  );
}

function Kitchen({ onPick }: { onPick: (a: FocusArea) => void }) {
  return (
    <group
      onClick={(e) => {
        e.stopPropagation();
        onPick('kitchen');
      }}
    >
      {/* cooking line along the back wall */}
      <Piece src={`${MODEL_DIR}/Kitchen_Cabinet1.glb`} position={[0.95, 0, -1.4]} />
      <Piece src={`${MODEL_DIR}/Kitchen_Oven.glb`} position={[1.5, 0, -1.4]} />
      <Piece src={`${MODEL_DIR}/Kitchen_Sink.glb`} position={[2.0, 0, -1.4]} />
      {/* refrigerator */}
      <Piece src={`${MODEL_DIR}/Kitchen_Fridge.glb`} position={[2.1, 0, -0.55]} rotation={-Math.PI / 2} />
      {/* prep counter + drawers */}
      <Piece src={`${MODEL_DIR}/Kitchen_2Drawers.glb`} position={[1.35, 0, -0.75]} rotation={Math.PI / 2} />
      {/* wall shelf */}
      <Piece src={`${MODEL_DIR}/Shelf_Small1.glb`} position={[1.5, 0.95, -1.55]} />
      {/* kitchen light */}
      <Piece src={`${MODEL_DIR}/Light_CeilingSingle.glb`} position={[1.5, 1.35, -1.0]} />
    </group>
  );
}

function ServiceCounter() {
  return (
    <group position={[1.35, 0, 0.85]}>
      <Piece src={`${MODEL_DIR}/Table_RoundLarge.glb`} position={[0, 0, 0]} />
      <Piece src={`${MODEL_DIR}/Plate_1.glb`} position={[-0.35, 0.95, 0]} />
      <Piece src={`${MODEL_DIR}/Stool.glb`} position={[0, 0, 0.45]} />
      <Piece src={`${MODEL_DIR}/Stool.glb`} position={[0.45, 0, -0.15]} />
    </group>
  );
}

function GuestMenuArea({ onPick }: { onPick: (a: FocusArea) => void }) {
  return (
    <group
      onClick={(e) => {
        e.stopPropagation();
        onPick('menu');
      }}
    >
      {/* QR menu stand by the entrance */}
      <Piece src={`${MODEL_DIR}/Shelf_Small1.glb`} position={[-0.25, 0, 1.5]} rotation={-Math.PI / 2} />
      {/* the QR menu card on the stand */}
      <mesh position={[-0.25, 0.62, 1.5]} rotation={[-0.3, 0, 0]} castShadow>
        <boxGeometry args={[0.2, 0.26, 0.02]} />
        <meshStandardMaterial color="#FBF8F2" emissive="#657554" emissiveIntensity={0.15} />
      </mesh>
      {/* welcome plant at the door */}
      <Piece src={`${MODEL_DIR}/Houseplant_1.glb`} position={[-0.7, 0, 1.55]} />
      {/* entrance door + windows on the wall */}
      <Piece src={`${MODEL_DIR}/Door_2.glb`} position={[0.35, 0, 1.64]} />
      <Piece src={`${MODEL_DIR}/Window_Small1.glb`} position={[-2.2, 0.55, 0.6]} rotation={Math.PI / 2} />
      <Piece src={`${MODEL_DIR}/Window_Small1.glb`} position={[-2.2, 0.55, -0.4]} rotation={Math.PI / 2} />
    </group>
  );
}

function RestaurantModel({ onPick }: { onPick: (a: FocusArea) => void }) {
  return (
    <group>
      <Building onPick={onPick} />
      <DiningRoom onPick={onPick} />
      <Kitchen onPick={onPick} />
      <ServiceCounter />
      <GuestMenuArea onPick={onPick} />
    </group>
  );
}

/** Glides the camera between the overview and the three focus areas. */
function CameraRig({ focus, controls }: { focus: FocusArea; controls: React.MutableRefObject<any> }) {
  const VIEWS: Record<FocusArea, { pos: Vec3; look: Vec3 }> = {
    overview: { pos: [4.6, 3.8, 4.8], look: [0, 0.35, 0] },
    dining: { pos: [-2.4, 1.7, 3.3], look: [-1.2, 0.4, 0.9] },
    kitchen: { pos: [3.1, 1.9, 0.8], look: [1.5, 0.45, -1.0] },
    menu: { pos: [0.8, 1.5, 3.4], look: [-0.25, 0.45, 1.5] },
  };
  const t = useRef(1);
  const from = useRef({ pos: new THREE.Vector3(...VIEWS.overview.pos), look: new THREE.Vector3(...VIEWS.overview.look) });
  const to = useRef({ pos: new THREE.Vector3(), look: new THREE.Vector3() });

  useEffect(() => {
    to.current.pos.set(...VIEWS[focus].pos);
    to.current.look.set(...VIEWS[focus].look);
    if (controls.current) {
      from.current.pos.copy(controls.current.object.position);
      from.current.look.copy(controls.current.target);
    }
    t.current = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

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
    if (!controls.current || t.current >= 1) return;
    t.current = Math.min(1, t.current + delta * 2.0);
    const e = 1 - Math.pow(1 - t.current, 3);
    controls.current.object.position.lerpVectors(from.current.pos, to.current.pos, e);
    controls.current.target.lerpVectors(from.current.look, to.current.look, e);
    controls.current.update();
  });
}

function LoadingOverlay() {
  const { progress } = useProgress();
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-cream-100">
      <div className="rounded-full bg-white px-5 py-2 text-sm font-medium text-olive-700 shadow-soft ring-1 ring-cream-200">
        Preparing restaurant… {Math.round(progress)}%
      </div>
    </div>
  );
}

/** Shows a meaningful message instead of an empty black scene if models fail to load. */
class ModelErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="flex h-full w-full items-center justify-center">
          <p className="max-w-xs px-6 text-center text-sm text-ink-soft">
            The 3D restaurant could not be loaded right now. Everything else on this page works as usual.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

function Scene({ focus, controls, onPick }: { focus: FocusArea; controls: React.MutableRefObject<any>; onPick: (a: FocusArea) => void }) {
  return (
    <>
      {/* warm, bright lighting so the dark wood furniture reads clearly */}
      <hemisphereLight intensity={1.1} color="#FFF6E8" groundColor="#D8C8A8" />
      <ambientLight intensity={0.7} />
      <directionalLight position={[4, 7, 3]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]}>
        <orthographicCamera attach="shadow-camera" args={[-6, 6, 6, -6, 0.1, 25]} />
      </directionalLight>
      <directionalLight position={[-4, 5, -3]} intensity={0.5} />

      <RestaurantModel onPick={onPick} />

      <Html position={[-1.2, 1.65, 0.9]} center distanceFactor={9} zIndexRange={[20, 0]}>
        <button
          onClick={() => onPick('dining')}
          className={`whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold shadow-soft ring-1 transition-colors ${
            focus === 'dining' ? 'bg-olive-700 text-white ring-olive-700' : 'bg-white/95 text-ink ring-cream-200 hover:bg-olive-50'
          }`}
        >
          Dining room
        </button>
      </Html>
      <Html position={[1.5, 1.65, -1.0]} center distanceFactor={9} zIndexRange={[20, 0]}>
        <button
          onClick={() => onPick('kitchen')}
          className={`whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold shadow-soft ring-1 transition-colors ${
            focus === 'kitchen' ? 'bg-olive-700 text-white ring-olive-700' : 'bg-white/95 text-ink ring-cream-200 hover:bg-olive-50'
          }`}
        >
          Kitchen
        </button>
      </Html>
      <Html position={[-0.25, 1.0, 1.5]} center distanceFactor={9} zIndexRange={[20, 0]}>
        <button
          onClick={() => onPick('menu')}
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
        minDistance={2.4}
        maxDistance={10}
        maxPolarAngle={Math.PI / 2.15}
        minPolarAngle={0.45}
        makeDefault
      />
      <CameraRig focus={focus} controls={controls} />
    </>
  );
}

export function RestaurantShowcase() {
  const [focus, setFocus] = useState<FocusArea>('overview');
  const controls = useRef<any>(null);
  const [webglOk, setWebglOk] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const c = document.createElement('canvas');
      setWebglOk(!!(c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch {
      setWebglOk(false);
    }
  }, []);

  if (webglOk === false) {
    return (
      <div className="flex h-[420px] w-full items-center justify-center rounded-3xl bg-white shadow-soft ring-1 ring-cream-200 sm:h-[520px]">
        <p className="max-w-xs px-6 text-center text-sm text-ink-soft">
          Your browser cannot display the 3D restaurant model. Everything else on this page works as usual.
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-[420px] w-full overflow-hidden rounded-3xl bg-cream-100 shadow-lift ring-1 ring-cream-200 sm:h-[520px]">
      {webglOk === null ? null : (
        <Canvas
          shadows
          dpr={[1, 1.75]}
          camera={{ position: [4.6, 3.8, 4.8], fov: 42, near: 0.1, far: 80 }}
          gl={{ antialias: true, alpha: false }}
          onCreated={({ gl }) => {
            gl.setClearColor('#F5EFE3');
          }}
        >
          <ModelErrorBoundary>
            <Suspense fallback={null}>
              <Scene focus={focus} controls={controls} onPick={setFocus} />
            </Suspense>
          </ModelErrorBoundary>
        </Canvas>
      )}

      <LoadingOverlayWithProgress />

      {/* instruction hint */}
      <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-white/85 px-4 py-1.5 text-xs font-medium text-ink-soft shadow-soft ring-1 ring-cream-200 backdrop-blur-sm">
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
            className="absolute right-3 top-3 z-10 rounded-full bg-olive-700 px-4 py-2 text-xs font-semibold text-white shadow-lift transition-colors hover:bg-olive-800"
          >
            Show full restaurant
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Loading veil that disappears once every glb has loaded. */
function LoadingOverlayWithProgress() {
  const { progress, item } = useProgress((s) => s);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (progress >= 100 && !item) {
      const t = window.setTimeout(() => setHidden(true), 350);
      return () => window.clearTimeout(t);
    }
  }, [progress, item]);
  if (hidden) return null;
  return <LoadingOverlay />;
}
