export function SmokeTestScene() {
  return (
    <group name="phase-1-smoke-test-scene">
      <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.4, 0.3, 1.4]} />
        <meshStandardMaterial color="#38bdf8" metalness={0.15} roughness={0.35} />
      </mesh>
      <mesh position={[-1.55, 0.45, 0]} castShadow>
        <boxGeometry args={[0.22, 0.9, 1.8]} />
        <meshStandardMaterial color="#f97316" />
      </mesh>
      <mesh position={[1.55, 0.45, 0]} castShadow>
        <boxGeometry args={[0.22, 0.9, 1.8]} />
        <meshStandardMaterial color="#22c55e" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[7, 5]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
    </group>
  );
}
