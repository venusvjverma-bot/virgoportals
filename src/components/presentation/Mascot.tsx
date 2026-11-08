import { useEffect, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, useAnimations, ContactShadows } from '@react-three/drei';
import { motion } from 'motion/react';
import type { Group, AnimationClip } from 'three';
import { LoopRepeat } from 'three';
import { SkeletonUtils } from 'three-stdlib';

export type MascotPose = 'enter' | 'idle' | 'waving' | 'pointing' | 'presenting' | 'celebrating';

const POSE_ANIMATION: Record<MascotPose, string> = {
  enter: 'Walk_Formal_Loop',
  idle: 'Idle_Loop',
  waving: 'Idle_Talking_Loop',
  pointing: 'Interact',
  presenting: 'Idle_Talking_Loop',
  celebrating: 'Punch_Cross',
};

/** Real animation clip names available in the CC0 Quaternius Universal Animation Library file. */
export const AVAILABLE_CLIPS = [
  'A_TPose', 'Crouch_Idle_Loop', 'Death01', 'Driving_Loop', 'Fixing_Kneeling', 'Hit_Chest',
  'Hit_Head', 'Idle_Loop', 'Idle_Talking_Loop', 'Idle_Torch_Loop', 'Interact', 'Jog_Fwd_Loop',
  'PickUp_Table', 'Pistol_Aim_Down', 'Pistol_Aim_Neutral', 'Pistol_Aim_Up', 'Pistol_Idle_Loop',
  'Pistol_Reload', 'Pistol_Shoot', 'Punch_Cross', 'Punch_Jab', 'Push_Loop', 'Sitting_Idle_Loop',
  'Sitting_Talking_Loop', 'Sprint_Loop', 'Sword_Attack', 'Sword_Idle', 'Walk_Formal_Loop', 'Walk_Loop',
];

useGLTF.preload('/models/char.gltf');
useGLTF.preload('/models/anims.glb');

interface MascotProps {
  pose?: MascotPose;
  say?: string;
  className?: string;
  bubbleSide?: 'right' | 'left';
}

/**
 * Real rigged 3D character (Quaternius Universal Base Character, CC0) driven by
 * real animation clips (Universal Animation Library, CC0) through useAnimations.
 */
export function Mascot({ pose = 'idle', say, className, bubbleSide = 'right' }: MascotProps) {
  return (
    <div className={`relative inline-flex items-start gap-3 ${className ?? ''}`}>
      {say && bubbleSide === 'left' ? <SpeechBubble text={say} /> : null}
      <div className="h-52 w-36 sm:h-64 sm:w-44">
        <Canvas
          shadows
          dpr={[1, 1.5]}
          frameloop="always"
          camera={{ position: [0, 1.2, 3.2], fov: 40 }}
          gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
        >
          <ambientLight intensity={1.1} />
          <directionalLight position={[2, 4, 3]} intensity={1.6} castShadow />
          <CharacterMesh pose={pose} />
          <ContactShadows position={[0, -0.02, 0]} opacity={0.3} scale={4} blur={2.4} far={1.5} />
        </Canvas>
      </div>
      {say && bubbleSide === 'right' ? <SpeechBubble text={say} /> : null}
    </div>
  );
}

function CharacterMesh({ pose }: { pose: MascotPose }) {
  const charRef = useRef<Group>(null);

  const charScene = useGLTF('/models/char.gltf') as unknown as { scene: Group };
  const animsGltf = useGLTF('/models/anims.glb') as unknown as { animations: AnimationClip[] };

  // Skinned meshes must be cloned with SkeletonUtils or the clone loses its skeleton.
  const clone = useMemo(() => SkeletonUtils.clone(charScene.scene) as Group, [charScene.scene]);

  // Retarget the animation clips onto the character rig via useAnimations.
  const { actions, mixer } = useAnimations(animsGltf.animations, charRef);

  // Some retargeted clips include root motion; force in-place looping playback.
  useEffect(() => {
    mixer.timeScale = 1;
    return () => {
      mixer.stopAllAction();
    };
  }, [mixer]);

  const clipName = POSE_ANIMATION[pose] ?? 'Idle_Loop';

  useEffect(() => {
    const next = actions[clipName];
    if (!next) return;
    next.reset().setLoop(LoopRepeat, Infinity).fadeIn(0.3).play();
    Object.entries(actions).forEach(([name, action]) => {
      if (name !== clipName && action && action.isRunning()) action.fadeOut(0.3);
    });
    return () => {
      next.fadeOut(0.3);
    };
  }, [actions, clipName]);

  return (
    <group ref={charRef}>
      <primitive
        object={clone}
        scale={1.15}
        position={[0, 0, 0]}
        rotation={[0, pose === 'pointing' ? -0.4 : 0.2, 0]}
      />
    </group>
  );
}

function SpeechBubble({ text }: { text: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 8 }}
      whileInView={{ opacity: 1, scale: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ delay: 0.5, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="max-w-[240px] rounded-2xl rounded-bl-sm bg-white px-4 py-3 text-sm font-medium leading-relaxed text-ink shadow-lift ring-1 ring-cream-200"
    >
      {text}
    </motion.div>
  );
}
