import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, Preload, SoftShadows, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { marked } from 'marked'
import { BookOpen, MousePointer2, Sparkles } from 'lucide-react'
import artworks from './artworks.json'
import './App.css'

type Artwork = {
  id: string
  title: string
  model: string
  modelName: string
  style: string
  src: string
  prompt: string
}

type Placement = Artwork & {
  position: [number, number, number]
  rotation: [number, number, number]
  labelPosition: [number, number, number]
  lightPosition: [number, number, number]
}

const ROOM = 15
const HALF = ROOM / 2
const WALL_HEIGHT = 4.2
const WALL_THICKNESS = 0.28
const PLAYER_RADIUS = 0.36

const wallColliders = [
  { x1: -HALF - WALL_THICKNESS, x2: -HALF + WALL_THICKNESS, z1: -HALF, z2: HALF },
  { x1: HALF - WALL_THICKNESS, x2: HALF + WALL_THICKNESS, z1: -HALF, z2: HALF },
  { x1: -HALF, x2: HALF, z1: -HALF - WALL_THICKNESS, z2: -HALF + WALL_THICKNESS },
  { x1: -HALF, x2: HALF, z1: HALF - WALL_THICKNESS, z2: HALF + WALL_THICKNESS },
  { x1: -WALL_THICKNESS, x2: WALL_THICKNESS, z1: -HALF + 1.45, z2: HALF - 1.45 },
]

function clampWalkPosition(next: THREE.Vector3, previous: THREE.Vector3) {
  next.x = THREE.MathUtils.clamp(next.x, -HALF + PLAYER_RADIUS, HALF - PLAYER_RADIUS)
  next.z = THREE.MathUtils.clamp(next.z, -HALF + PLAYER_RADIUS, HALF - PLAYER_RADIUS)

  for (const wall of wallColliders) {
    const hit =
      next.x + PLAYER_RADIUS > wall.x1 &&
      next.x - PLAYER_RADIUS < wall.x2 &&
      next.z + PLAYER_RADIUS > wall.z1 &&
      next.z - PLAYER_RADIUS < wall.z2
    if (!hit) continue

    const tryX = next.clone(); tryX.z = previous.z
    const hitX = tryX.x + PLAYER_RADIUS > wall.x1 && tryX.x - PLAYER_RADIUS < wall.x2 && tryX.z + PLAYER_RADIUS > wall.z1 && tryX.z - PLAYER_RADIUS < wall.z2
    const tryZ = next.clone(); tryZ.x = previous.x
    const hitZ = tryZ.x + PLAYER_RADIUS > wall.x1 && tryZ.x - PLAYER_RADIUS < wall.x2 && tryZ.z + PLAYER_RADIUS > wall.z1 && tryZ.z - PLAYER_RADIUS < wall.z2
    if (!hitX) next.z = previous.z
    else if (!hitZ) next.x = previous.x
    else next.copy(previous)
  }
  next.y = 1.65
  return next
}

function useMuseumTexture(kind: 'floor' | 'wall' | 'ceiling') {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 1024
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = kind === 'floor' ? '#6b4f39' : kind === 'wall' ? '#e8e3d8' : '#d9d5cd'
    ctx.fillRect(0, 0, 1024, 1024)

    if (kind === 'floor') {
      for (let x = 0; x < 1024; x += 128) {
        const hue = 24 + Math.random() * 12
        ctx.fillStyle = `hsl(${hue}, 32%, ${34 + Math.random() * 20}%)`
        ctx.fillRect(x + 2, 0, 124, 1024)
        for (let y = 0; y < 1024; y += 14) {
          ctx.strokeStyle = `rgba(255,255,255,${0.035 + Math.random() * 0.035})`
          ctx.beginPath(); ctx.moveTo(x + 8, y + Math.random() * 5); ctx.lineTo(x + 120, y + Math.random() * 5); ctx.stroke()
        }
      }
    } else {
      for (let y = 0; y < 1024; y += 74) {
        const offset = (Math.floor(y / 74) % 2) * 90
        for (let x = -offset; x < 1024; x += 180) {
          ctx.fillStyle = `rgba(255,255,255,${0.05 + Math.random() * 0.08})`
          ctx.fillRect(x + 2, y + 2, 176, 70)
          ctx.strokeStyle = kind === 'wall' ? 'rgba(120,115,105,.24)' : 'rgba(110,105,100,.12)'
          ctx.strokeRect(x + 2, y + 2, 176, 70)
        }
      }
      for (let i = 0; i < 4500; i++) {
        const a = kind === 'wall' ? 0.05 : 0.035
        ctx.fillStyle = `rgba(55,50,45,${Math.random() * a})`
        ctx.fillRect(Math.random() * 1024, Math.random() * 1024, 1.4, 1.4)
      }
    }
    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(kind === 'floor' ? 5 : 3, kind === 'floor' ? 5 : 2)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 8
    return texture
  }, [kind])
}

function PlayerControls({ active }: { active: boolean }) {
  const { camera, gl } = useThree()
  const keys = useRef<Record<string, boolean>>({})
  const yaw = useRef(0)
  const pitch = useRef(0)
  const velocity = useRef(new THREE.Vector3())

  useEffect(() => {
    camera.position.set(-4.8, 1.65, 5.2)
    camera.rotation.order = 'YXZ'
    const onKey = (e: KeyboardEvent) => { keys.current[e.code] = e.type === 'keydown' }
    const onMouse = (e: MouseEvent) => {
      if (document.pointerLockElement !== gl.domElement) return
      yaw.current -= e.movementX * 0.0022
      pitch.current = THREE.MathUtils.clamp(pitch.current - e.movementY * 0.002, -1.2, 1.2)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    window.addEventListener('mousemove', onMouse)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
      window.removeEventListener('mousemove', onMouse)
    }
  }, [camera, gl.domElement])

  useFrame((_, delta) => {
    camera.rotation.set(pitch.current, yaw.current, 0)
    if (!active) return
    const forward = Number(keys.current.KeyW || keys.current.ArrowUp) - Number(keys.current.KeyS || keys.current.ArrowDown)
    const right = Number(keys.current.KeyD || keys.current.ArrowRight) - Number(keys.current.KeyA || keys.current.ArrowLeft)
    const sprint = keys.current.ShiftLeft || keys.current.ShiftRight ? 1.7 : 1
    const dir = new THREE.Vector3(right, 0, -forward)
    if (dir.lengthSq() > 0) dir.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw.current)
    const target = dir.multiplyScalar(4.2 * sprint)
    velocity.current.lerp(target, 1 - Math.exp(-12 * delta))
    const prev = camera.position.clone()
    const next = camera.position.clone().addScaledVector(velocity.current, delta)
    camera.position.copy(clampWalkPosition(next, prev))
  })
  return null
}

function GalleryWalls() {
  const floorMap = useMuseumTexture('floor')
  const wallMap = useMuseumTexture('wall')
  const ceilingMap = useMuseumTexture('ceiling')
  const wallMat = <meshStandardMaterial map={wallMap} roughness={0.82} color="#f3efe6" />
  return (
    <group>
      <mesh receiveShadow rotation-x={-Math.PI / 2} position={[0, 0, 0]}>
        <planeGeometry args={[ROOM, ROOM, 96, 96]} />
        <meshStandardMaterial map={floorMap} roughness={0.64} metalness={0.02} />
      </mesh>
      <mesh receiveShadow position={[0, WALL_HEIGHT, 0]} rotation-x={Math.PI / 2}>
        <planeGeometry args={[ROOM, ROOM, 64, 64]} />
        <meshStandardMaterial map={ceilingMap} color="#ebe8e1" roughness={0.9} />
      </mesh>
      <Wall position={[0, WALL_HEIGHT / 2, -HALF]} size={[ROOM, WALL_HEIGHT, WALL_THICKNESS]}>{wallMat}</Wall>
      <Wall position={[0, WALL_HEIGHT / 2, HALF]} size={[ROOM, WALL_HEIGHT, WALL_THICKNESS]}>{wallMat}</Wall>
      <Wall position={[-HALF, WALL_HEIGHT / 2, 0]} size={[WALL_THICKNESS, WALL_HEIGHT, ROOM]}>{wallMat}</Wall>
      <Wall position={[HALF, WALL_HEIGHT / 2, 0]} size={[WALL_THICKNESS, WALL_HEIGHT, ROOM]}>{wallMat}</Wall>
      <Wall position={[0, WALL_HEIGHT / 2, 0]} size={[WALL_THICKNESS, WALL_HEIGHT, ROOM - 2.9]}>{wallMat}</Wall>
      <Baseboards />
    </group>
  )
}

function Wall({ position, size, children }: { position: [number, number, number], size: [number, number, number], children: React.ReactNode }) {
  return <mesh castShadow receiveShadow position={position}><boxGeometry args={size} />{children}</mesh>
}

function Baseboards() {
  const mat = <meshStandardMaterial color="#b69a76" roughness={0.55} />
  const pieces: Array<[[number, number, number], [number, number, number]]> = [
    [[0, .17, -HALF + .08], [ROOM, .18, .12]], [[0, .17, HALF - .08], [ROOM, .18, .12]],
    [[-HALF + .08, .17, 0], [.12, .18, ROOM]], [[HALF - .08, .17, 0], [.12, .18, ROOM]],
    [[-.19, .17, 0], [.12, .18, ROOM - 2.8]], [[.19, .17, 0], [.12, .18, ROOM - 2.8]],
  ]
  return <>{pieces.map(([p, s], i) => <mesh key={i} position={p} castShadow receiveShadow><boxGeometry args={s}/>{mat}</mesh>)}</>
}

function ArtworkFrame({ art }: { art: Placement }) {
  const texture = useTexture(art.src)
  texture.colorSpace = THREE.SRGBColorSpace
  return (
    <group position={art.position} rotation={art.rotation}>
      <mesh castShadow position={[0, 0, -0.035]}>
        <boxGeometry args={[2.68, 2.04, .12]} />
        <meshStandardMaterial color="#b99762" roughness={0.38} metalness={0.18} />
      </mesh>
      <mesh castShadow position={[0, 0, .03]}>
        <boxGeometry args={[2.36, 1.72, .06]} />
        <meshStandardMaterial color="#171514" roughness={0.35} />
      </mesh>
      <mesh castShadow position={[0, 0, .075]}>
        <planeGeometry args={[2.18, 1.54]} />
        <meshStandardMaterial map={texture} roughness={0.46} toneMapped={false} />
      </mesh>
      <mesh position={[0, -1.23, .06]} castShadow>
        <boxGeometry args={[2.3, .38, .035]} />
        <meshStandardMaterial color="#f7f0df" roughness={0.58} />
      </mesh>
      <Html position={art.labelPosition} transform occlude distanceFactor={5.5} className="art-label">
        <strong>{art.title}</strong>
        <span>{art.modelName}</span>
      </Html>
    </group>
  )
}

function MuseumLighting({ placements }: { placements: Placement[] }) {
  return (
    <>
      <ambientLight intensity={0.34} />
      <hemisphereLight args={['#fff4df', '#7d8794', 0.42]} />
      <directionalLight position={[4, 8, 6]} intensity={1.25} castShadow shadow-mapSize={[2048, 2048]} />
      {[-4.6, 0, 4.6].map((x) => <pointLight key={x} position={[x, 3.72, -3.3]} intensity={1.2} distance={8.5} color="#fff1d4" castShadow />)}
      {[-4.6, 0, 4.6].map((x) => <pointLight key={'b'+x} position={[x, 3.72, 3.3]} intensity={1.1} distance={8.5} color="#fff1d4" />)}
      {placements.map((art) => <spotLight key={art.id} position={art.lightPosition} target-position={art.position} angle={0.48} penumbra={0.62} intensity={1.9} distance={5.2} color="#ffe6bd" castShadow />)}
    </>
  )
}

function SculpturalDetails() {
  return (
    <group>
      <mesh castShadow receiveShadow position={[-3.3, .16, -.7]}><cylinderGeometry args={[.7, .82, .32, 32]} /><meshStandardMaterial color="#c7c2b8" roughness={.72} /></mesh>
      <mesh castShadow position={[-3.3, 1.03, -.7]}><icosahedronGeometry args={[.62, 3]} /><meshStandardMaterial color="#bfc5c9" roughness={.48} metalness={.04} /></mesh>
      <mesh castShadow position={[-3.0, 1.66, -.42]} rotation={[.2,0,.35]}><sphereGeometry args={[.22, 32, 16]} /><meshStandardMaterial color="#d0d4d5" roughness={.5} /></mesh>
      <mesh castShadow receiveShadow position={[3.9, .22, 2.2]}><boxGeometry args={[1.8,.44,.72]} /><meshStandardMaterial color="#8d6746" roughness={.48} /></mesh>
      <mesh castShadow receiveShadow position={[3.9,.64,2.2]}><boxGeometry args={[1.65,.12,.64]} /><meshStandardMaterial color="#c7aa83" roughness={.5} /></mesh>
      <mesh castShadow receiveShadow position={[0, .03, 0]}><circleGeometry args={[2.35, 64]} /><meshStandardMaterial color="#d8c8a6" roughness={.8} /></mesh>
    </group>
  )
}

function MuseumScene({ active }: { active: boolean }) {
  const placements = useMemo<Placement[]>(() => {
    const a = artworks as Artwork[]
    return [
      { ...a[0], position: [0, 2.18, -HALF + .19], rotation: [0, 0, 0], labelPosition: [0, -1.23, .13], lightPosition: [0, 3.45, -5.35] },
      { ...a[1], position: [HALF - .19, 2.18, -2.7], rotation: [0, -Math.PI / 2, 0], labelPosition: [0, -1.23, .13], lightPosition: [5.45, 3.45, -2.7] },
      { ...a[2], position: [0, 2.18, HALF - .19], rotation: [0, Math.PI, 0], labelPosition: [0, -1.23, .13], lightPosition: [0, 3.45, 5.35] },
      { ...a[3], position: [-HALF + .19, 2.18, 2.7], rotation: [0, Math.PI / 2, 0], labelPosition: [0, -1.23, .13], lightPosition: [-5.45, 3.45, 2.7] },
      { ...a[4], position: [-.19, 2.18, -3.15], rotation: [0, -Math.PI / 2, 0], labelPosition: [0, -1.23, .13], lightPosition: [-2.4, 3.45, -3.15] },
      { ...a[5], position: [.19, 2.18, 3.15], rotation: [0, Math.PI / 2, 0], labelPosition: [0, -1.23, .13], lightPosition: [2.4, 3.45, 3.15] },
    ]
  }, [])
  return (
    <>
      <color attach="background" args={["#e7e1d6"]} />
      <fog attach="fog" args={["#e7e1d6", 13, 25]} />
      <SoftShadows size={24} samples={12} />
      <MuseumLighting placements={placements} />
      <GalleryWalls />
      {placements.map((art) => <ArtworkFrame key={art.id} art={art} />)}
      <SculpturalDetails />
      <PlayerControls active={active} />
      <Preload all />
    </>
  )
}

function MuseumApp() {
  const [locked, setLocked] = useState(false)
  useEffect(() => {
    const sync = () => setLocked(Boolean(document.pointerLockElement))
    document.addEventListener('pointerlockchange', sync)
    return () => document.removeEventListener('pointerlockchange', sync)
  }, [])
  return (
    <main className="museum-shell">
      <div className="hud">
        <div><Sparkles size={16}/> FAL Museum</div>
        <div>WASD move · mouse look · Shift sprint · Esc unlock</div>
        <a href="/docs">Docs</a>
      </div>
      {!locked && <button className="enter" onClick={() => document.querySelector('canvas')?.requestPointerLock()}><MousePointer2/> Click to walk the museum</button>}
      <Canvas shadows dpr={[1, 1.75]} camera={{ fov: 67, near: .05, far: 70 }} gl={{ antialias: true, powerPreference: 'high-performance' }} onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.05; }}>
        <Suspense fallback={null}><MuseumScene active={locked} /></Suspense>
      </Canvas>
    </main>
  )
}

const docLinks = [
  ['1.1-overview.md', 'Overview'],
  ['2.1-user-guide.md', 'User Guide'],
  ['3.1-scene-architecture.md', 'Scene Architecture'],
  ['4.1-fal-artwork-pipeline.md', 'FAL Artwork Pipeline'],
  ['5.1-performance-and-navigation.md', 'Performance and Navigation'],
]

function DocsApp() {
  const [doc, setDoc] = useState(docLinks[0][0])
  const [html, setHtml] = useState('')
  useEffect(() => {
    fetch(`/docs/${doc}`).then(r => r.text()).then(t => setHtml(marked.parse(t) as string))
  }, [doc])
  return (
    <main className="docs-shell">
      <aside>
        <a className="back" href="/"><BookOpen size={17}/> Museum</a>
        <h1>Docs</h1>
        {docLinks.map(([file, title]) => <button key={file} className={doc === file ? 'active' : ''} onClick={() => setDoc(file)}>{title}</button>)}
      </aside>
      <article dangerouslySetInnerHTML={{ __html: html }} />
    </main>
  )
}

export default function App() {
  return location.pathname.startsWith('/docs') ? <DocsApp /> : <MuseumApp />
}
