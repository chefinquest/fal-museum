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

const BASE_PATH = import.meta.env.BASE_URL
const assetUrl = (path: string) => `${BASE_PATH}${path.replace(/^\//, '')}`

const ROOM = 22
const HALF = ROOM / 2
// 15.5 world units reads as ~50+ ft at human eye scale.
const WALL_HEIGHT = 15.5
const WALL_THICKNESS = 0.32
const PLAYER_RADIUS = 0.36
const START_POSITION: [number, number, number] = [-5.15, 1.65, 4.85]
const START_YAW = -0.72

const wallColliders = [
  { x1: -HALF - WALL_THICKNESS, x2: -HALF + WALL_THICKNESS, z1: -HALF, z2: HALF },
  { x1: HALF - WALL_THICKNESS, x2: HALF + WALL_THICKNESS, z1: -HALF, z2: HALF },
  { x1: -HALF, x2: HALF, z1: -HALF - WALL_THICKNESS, z2: -HALF + WALL_THICKNESS },
  { x1: -HALF, x2: HALF, z1: HALF - WALL_THICKNESS, z2: HALF + WALL_THICKNESS },
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

    if (kind === 'floor') {
      const gradient = ctx.createLinearGradient(0, 1024, 1024, 0)
      gradient.addColorStop(0, '#dde8ff')
      gradient.addColorStop(.22, '#f6f0ff')
      gradient.addColorStop(.48, '#e9fff7')
      gradient.addColorStop(.72, '#fff3df')
      gradient.addColorStop(1, '#dce7ff')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, 1024, 1024)

      for (let i = 0; i < 34; i++) {
        const y = 80 + i * 27 + Math.sin(i * 1.7) * 18
        const ribbon = ctx.createLinearGradient(0, y - 70, 1024, y + 70)
        ribbon.addColorStop(0, `rgba(90, 160, 255, ${0.02 + (i % 5) * 0.006})`)
        ribbon.addColorStop(.5, `rgba(255, 255, 255, ${0.08 + (i % 4) * 0.012})`)
        ribbon.addColorStop(1, `rgba(195, 120, 255, ${0.025 + (i % 3) * 0.008})`)
        ctx.strokeStyle = ribbon
        ctx.lineWidth = 18 + (i % 6) * 4
        ctx.beginPath()
        ctx.moveTo(-80, y)
        for (let x = -80; x <= 1100; x += 90) {
          ctx.lineTo(x, y + Math.sin((x + i * 45) * 0.009) * 42)
        }
        ctx.stroke()
      }

      for (let i = 0; i < 1600; i++) {
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * .18})`
        ctx.fillRect(Math.random() * 1024, Math.random() * 1024, 1.2, 1.2)
      }
    } else if (kind === 'wall') {
      ctx.fillStyle = '#f8f8f4'
      ctx.fillRect(0, 0, 1024, 1024)
      const glow = ctx.createRadialGradient(512, 210, 80, 512, 420, 850)
      glow.addColorStop(0, 'rgba(255,255,255,.9)')
      glow.addColorStop(1, 'rgba(222,226,228,.22)')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, 1024, 1024)

      for (let i = 0; i < 70; i++) {
        ctx.strokeStyle = `rgba(${150 + Math.random() * 45}, ${156 + Math.random() * 45}, ${165 + Math.random() * 50}, ${0.08 + Math.random() * 0.12})`
        ctx.lineWidth = .7 + Math.random() * 2.2
        ctx.beginPath()
        const startX = Math.random() * 1024
        ctx.moveTo(startX, -40)
        for (let y = -40; y < 1100; y += 72) {
          ctx.lineTo(startX + Math.sin(y * 0.012 + i) * 42 + (Math.random() - .5) * 42, y)
        }
        ctx.stroke()
      }
      for (let i = 0; i < 4200; i++) {
        ctx.fillStyle = `rgba(70,76,86,${Math.random() * .045})`
        ctx.fillRect(Math.random() * 1024, Math.random() * 1024, 1.1, 1.1)
      }
    } else {
      const gradient = ctx.createRadialGradient(512, 512, 20, 512, 512, 720)
      gradient.addColorStop(0, '#ffffff')
      gradient.addColorStop(.2, '#fbfdff')
      gradient.addColorStop(.58, '#e8f2ff')
      gradient.addColorStop(1, '#cfdff0')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, 1024, 1024)
      for (let i = 0; i < 26; i++) {
        ctx.strokeStyle = `rgba(255,255,255,${0.13 + Math.random() * .18})`
        ctx.lineWidth = 12 + Math.random() * 42
        ctx.beginPath()
        const y = Math.random() * 1024
        ctx.moveTo(-120, y)
        ctx.bezierCurveTo(220, y - 140 + Math.random() * 280, 760, y - 180 + Math.random() * 360, 1140, y + Math.random() * 160)
        ctx.stroke()
      }
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(kind === 'floor' ? 1.25 : kind === 'wall' ? 2.2 : 1, kind === 'floor' ? 1.25 : kind === 'wall' ? 3.4 : 1)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 12
    return texture
  }, [kind])
}

function PlayerControls({ active }: { active: boolean }) {
  const { camera, gl } = useThree()
  const keys = useRef<Record<string, boolean>>({})
  const yaw = useRef(START_YAW)
  const pitch = useRef(-0.03)
  const velocity = useRef(new THREE.Vector3())
  const dragging = useRef(false)

  useEffect(() => {
    camera.position.set(...START_POSITION)
    camera.rotation.order = 'YXZ'
    camera.rotation.set(pitch.current, yaw.current, 0)

    const onKey = (e: KeyboardEvent) => {
      keys.current[e.code] = e.type === 'keydown'
      if (active && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault()
    }
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) dragging.current = true
    }
    const onMouseUp = () => { dragging.current = false }
    const onMouse = (e: MouseEvent) => {
      const pointerLocked = document.pointerLockElement === gl.domElement
      if (!pointerLocked && !(active && dragging.current)) return
      yaw.current -= e.movementX * 0.0022
      pitch.current = THREE.MathUtils.clamp(pitch.current - e.movementY * 0.002, -1.2, 1.2)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('mousemove', onMouse)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('mousemove', onMouse)
    }
  }, [active, camera, gl.domElement])

  useFrame((_, delta) => {
    camera.rotation.set(pitch.current, yaw.current, 0)
    if (!active) {
      velocity.current.set(0, 0, 0)
      return
    }
    const forward = Number(Boolean(keys.current.KeyW || keys.current.ArrowUp)) - Number(Boolean(keys.current.KeyS || keys.current.ArrowDown))
    const right = Number(Boolean(keys.current.KeyD || keys.current.ArrowRight)) - Number(Boolean(keys.current.KeyA || keys.current.ArrowLeft))
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
  const wallMat = <meshPhysicalMaterial map={wallMap} roughness={0.36} metalness={0.02} clearcoat={0.55} clearcoatRoughness={0.22} color="#ffffff" />
  return (
    <group>
      <mesh receiveShadow rotation-x={-Math.PI / 2} position={[0, 0, 0]}>
        <planeGeometry args={[ROOM, ROOM, 128, 128]} />
        <meshPhysicalMaterial map={floorMap} roughness={0.28} metalness={0.04} clearcoat={0.82} clearcoatRoughness={0.18} color="#ffffff" />
      </mesh>
      <mesh receiveShadow position={[0, WALL_HEIGHT, 0]} rotation-x={Math.PI / 2}>
        <planeGeometry args={[ROOM, ROOM, 96, 96]} />
        <meshStandardMaterial map={ceilingMap} color="#f8fbff" roughness={0.74} emissive="#dcecff" emissiveIntensity={0.55} toneMapped={false} />
      </mesh>
      <HeavenCeiling />
      <Wall position={[0, WALL_HEIGHT / 2, -HALF]} size={[ROOM, WALL_HEIGHT, WALL_THICKNESS]}>{wallMat}</Wall>
      <Wall position={[0, WALL_HEIGHT / 2, HALF]} size={[ROOM, WALL_HEIGHT, WALL_THICKNESS]}>{wallMat}</Wall>
      <Wall position={[-HALF, WALL_HEIGHT / 2, 0]} size={[WALL_THICKNESS, WALL_HEIGHT, ROOM]}>{wallMat}</Wall>
      <Wall position={[HALF, WALL_HEIGHT / 2, 0]} size={[WALL_THICKNESS, WALL_HEIGHT, ROOM]}>{wallMat}</Wall>
      <FutureTrim />
    </group>
  )
}

function Wall({ position, size, children }: { position: [number, number, number], size: [number, number, number], children: React.ReactNode }) {
  return <mesh castShadow receiveShadow position={position}><boxGeometry args={size} />{children}</mesh>
}

function HeavenCeiling() {
  const beams = [
    [-5.8, -4.8, 2.4], [-2.2, -5.4, 2.1], [1.9, -4.9, 2.7], [5.7, -4.6, 2.2],
    [-4.6, 0, 2.6], [0, 0, 3.2], [4.7, 0, 2.6],
    [-5.6, 4.9, 2.2], [-1.8, 5.3, 2.8], [2.4, 4.9, 2.3], [6.0, 4.4, 2.0],
  ] as const
  return (
    <group>
      <mesh position={[0, WALL_HEIGHT - .035, 0]} rotation-x={Math.PI / 2}>
        <circleGeometry args={[6.4, 96]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.62} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[0, WALL_HEIGHT - .05, 0]} rotation-x={Math.PI / 2}>
        <ringGeometry args={[3.8, 9.6, 128]} />
        <meshBasicMaterial color="#dcecff" transparent opacity={0.24} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      {beams.map(([x, z, radius], i) => (
        <mesh key={i} position={[x, WALL_HEIGHT - .08, z]} rotation-x={Math.PI / 2}>
          <circleGeometry args={[radius, 48]} />
          <meshBasicMaterial color={i % 3 === 0 ? '#fff8e8' : '#eff8ff'} transparent opacity={0.28} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

function FutureTrim() {
  const mat = <meshStandardMaterial color="#d7eaff" emissive="#9ccfff" emissiveIntensity={0.55} roughness={0.28} toneMapped={false} />
  const darkMat = <meshPhysicalMaterial color="#ffffff" roughness={0.24} metalness={0.05} clearcoat={0.8} clearcoatRoughness={0.18} />
  const lightRails: Array<[[number, number, number], [number, number, number]]> = [
    [[0, .08, -HALF + .09], [ROOM, .05, .08]], [[0, .08, HALF - .09], [ROOM, .05, .08]],
    [[-HALF + .09, .08, 0], [.08, .05, ROOM]], [[HALF - .09, .08, 0], [.08, .05, ROOM]],
    [[0, 3.8, -HALF + .1], [ROOM, .035, .05]], [[0, 3.8, HALF - .1], [ROOM, .035, .05]],
    [[-HALF + .1, 3.8, 0], [.05, .035, ROOM]], [[HALF - .1, 3.8, 0], [.05, .035, ROOM]],
  ]
  return <>{lightRails.map(([p, s], i) => <mesh key={`rail-${i}`} position={p} castShadow receiveShadow><boxGeometry args={s}/>{i < 4 ? mat : darkMat}</mesh>)}</>
}

function ArtworkFrame({ art }: { art: Placement }) {
  const texture = useTexture(assetUrl(art.src))
  texture.colorSpace = THREE.SRGBColorSpace
  return (
    <group position={art.position} rotation={art.rotation}>
      <mesh castShadow position={[0, 0, -0.045]}>
        <boxGeometry args={[2.82, 2.14, .09]} />
        <meshPhysicalMaterial color="#f9fcff" roughness={0.2} metalness={0.18} clearcoat={0.9} clearcoatRoughness={0.12} />
      </mesh>
      <mesh castShadow position={[0, 0, .02]}>
        <boxGeometry args={[2.46, 1.82, .045]} />
        <meshStandardMaterial color="#edf7ff" emissive="#bde8ff" emissiveIntensity={0.18} roughness={0.28} toneMapped={false} />
      </mesh>
      <mesh castShadow position={[0, 0, .078]}>
        <planeGeometry args={[2.22, 1.58]} />
        <meshStandardMaterial map={texture} roughness={0.32} toneMapped={false} />
      </mesh>
      <mesh position={[0, -1.24, .07]} castShadow>
        <boxGeometry args={[2.22, .28, .025]} />
        <meshPhysicalMaterial color="#fbfdff" roughness={0.24} metalness={0.06} clearcoat={0.7} />
      </mesh>
      <Html position={art.labelPosition} transform occlude distanceFactor={3.2} className="art-label">
        <strong>{art.title}</strong>
        <span>{art.modelName}</span>
      </Html>
    </group>
  )
}

function MuseumLighting({ placements }: { placements: Placement[] }) {
  return (
    <>
      <ambientLight intensity={0.62} />
      <hemisphereLight args={['#ffffff', '#c9d9ee', 0.82]} />
      <directionalLight position={[0, WALL_HEIGHT - 1.2, 2]} intensity={2.2} castShadow shadow-mapSize={[2048, 2048]} color="#fff8ea" />
      <rectAreaLight position={[0, WALL_HEIGHT - .35, 0]} rotation={[-Math.PI / 2, 0, 0]} width={15} height={15} intensity={7.5} color="#f5fbff" />
      {[-7.2, -2.4, 2.4, 7.2].map((x) => <pointLight key={x} position={[x, 8.8, -7.2]} intensity={1.6} distance={14} color="#e8f6ff" castShadow />)}
      {[-7.2, -2.4, 2.4, 7.2].map((x) => <pointLight key={'b'+x} position={[x, 8.8, 7.2]} intensity={1.45} distance={14} color="#fff4df" />)}
      {placements.map((art) => <spotLight key={art.id} position={art.lightPosition} target-position={art.position} angle={0.44} penumbra={0.78} intensity={2.35} distance={8} color="#f4fbff" castShadow />)}
    </>
  )
}

function SculpturalDetails() {
  return (
    <group>
      <mesh castShadow receiveShadow position={[-3.3, .18, -.7]}><cylinderGeometry args={[.66, .9, .36, 48]} /><meshPhysicalMaterial color="#f7faff" roughness={.18} metalness={.04} clearcoat={.85} /></mesh>
      <mesh castShadow position={[-3.3, 1.06, -.7]}><icosahedronGeometry args={[.62, 3]} /><meshPhysicalMaterial color="#dcecff" roughness={.24} metalness={.18} clearcoat={.7} transmission={0.15} /></mesh>
      <mesh castShadow position={[-3.0, 1.7, -.42]} rotation={[.2,0,.35]}><sphereGeometry args={[.22, 32, 16]} /><meshStandardMaterial color="#ffffff" emissive="#bde8ff" emissiveIntensity={0.35} toneMapped={false} roughness={.25} /></mesh>
      <mesh castShadow receiveShadow position={[3.9, .22, 2.2]}><boxGeometry args={[1.8,.44,.72]} /><meshPhysicalMaterial color="#f9fcff" roughness={.18} metalness={.06} clearcoat={.75} /></mesh>
      <mesh castShadow receiveShadow position={[3.9,.64,2.2]}><boxGeometry args={[1.65,.1,.64]} /><meshStandardMaterial color="#dcecff" emissive="#9fd6ff" emissiveIntensity={0.18} toneMapped={false} roughness={.28} /></mesh>
      <mesh receiveShadow position={[0, .016, 0]} rotation-x={-Math.PI / 2}><circleGeometry args={[3.25, 96]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.22} side={THREE.DoubleSide} toneMapped={false} /></mesh>
    </group>
  )
}

function MuseumScene({ active }: { active: boolean }) {
  const placements = useMemo<Placement[]>(() => {
    const a = artworks as Artwork[]
    return [
      { ...a[0], position: [-5.2, 3.25, -HALF + .22], rotation: [0, 0, 0], labelPosition: [0, -1.28, .13], lightPosition: [-5.2, 5.35, -7.65] },
      { ...a[1], position: [HALF - .22, 3.25, -4.8], rotation: [0, -Math.PI / 2, 0], labelPosition: [0, -1.28, .13], lightPosition: [7.65, 5.35, -4.8] },
      { ...a[2], position: [5.2, 3.25, HALF - .22], rotation: [0, Math.PI, 0], labelPosition: [0, -1.28, .13], lightPosition: [5.2, 5.35, 7.65] },
      { ...a[3], position: [-HALF + .22, 3.25, 4.8], rotation: [0, Math.PI / 2, 0], labelPosition: [0, -1.28, .13], lightPosition: [-7.65, 5.35, 4.8] },
      { ...a[4], position: [5.2, 3.25, -HALF + .22], rotation: [0, 0, 0], labelPosition: [0, -1.28, .13], lightPosition: [5.2, 5.35, -7.65] },
      { ...a[5], position: [-5.2, 3.25, HALF - .22], rotation: [0, Math.PI, 0], labelPosition: [0, -1.28, .13], lightPosition: [-5.2, 5.35, 7.65] },
    ]
  }, [])
  return (
    <>
      <color attach="background" args={["#f4f8ff"]} />
      <fog attach="fog" args={["#f4f8ff", 22, 48]} />
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
  const [started, setStarted] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const enterMuseum = () => {
    const canvas = canvasRef.current ?? document.querySelector('canvas')
    setStarted(true)
    canvas?.focus()
    canvas?.requestPointerLock?.()?.catch((error) => {
      console.warn('Pointer lock was not granted; using click-drag mouse look fallback.', error)
    })
  }

  useEffect(() => {
    const sync = () => {
      const isLocked = document.pointerLockElement === canvasRef.current
      setLocked(isLocked)
      if (!document.pointerLockElement) setStarted(false)
    }
    document.addEventListener('pointerlockchange', sync)
    return () => document.removeEventListener('pointerlockchange', sync)
  }, [])

  const controlsActive = started || locked
  return (
    <main className="museum-shell">
      <div className="hud">
        <div><Sparkles size={16}/> FAL Museum</div>
        <div>Click start · WASD move · mouse/drag look · Shift sprint · Esc unlock</div>
        <a href={`${BASE_PATH}?docs`}>Docs</a>
      </div>
      {!controlsActive && <button className="enter" onClick={enterMuseum}><MousePointer2/> Click to walk the museum</button>}
      {controlsActive && <div className="crosshair" aria-hidden="true" />}
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: START_POSITION, rotation: [-0.03, START_YAW, 0], fov: 67, near: .05, far: 70 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          canvasRef.current = gl.domElement
          gl.domElement.tabIndex = 0
          gl.domElement.addEventListener('click', () => gl.domElement.focus())
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.05
        }}>
        <Suspense fallback={null}><MuseumScene active={controlsActive} /></Suspense>
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
    fetch(assetUrl(`docs/${doc}`)).then(r => r.text()).then(t => setHtml(marked.parse(t) as string))
  }, [doc])
  return (
    <main className="docs-shell">
      <aside>
        <a className="back" href={BASE_PATH}><BookOpen size={17}/> Museum</a>
        <h1>Docs</h1>
        {docLinks.map(([file, title]) => <button key={file} className={doc === file ? 'active' : ''} onClick={() => setDoc(file)}>{title}</button>)}
      </aside>
      <article dangerouslySetInnerHTML={{ __html: html }} />
    </main>
  )
}

export default function App() {
  return location.search === '?docs' || location.pathname === '/docs' ? <DocsApp /> : <MuseumApp />
}
