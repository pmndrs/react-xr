import { Canvas } from '@react-three/fiber'
import { Sky, PointerLockControls, KeyboardControls } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import { Ground } from './Ground.jsx'
import { Player } from './Player.jsx'
import { Cube, Cubes } from './Cube.jsx'
import { createXRStore, XR } from '@react-three/xr'

// The original was made by Maksim Ivanow: https://www.youtube.com/watch?v=Lc2JvBXMesY&t=124s
// This demo needs pointer-lock, that works only if you open it in a new window
// Controls: WASD + left click

const store = createXRStore()

export default function App() {
  return (
    <>
      <button
        style={{
          position: 'absolute',
          zIndex: 10000,
          background: 'black',
          borderRadius: '0.5rem',
          border: 'none',
          fontWeight: 'bold',
          color: 'white',
          padding: '1rem 2rem',
          cursor: 'pointer',
          fontSize: '1.5rem',
          bottom: '1rem',
          left: '50%',
          boxShadow: '0px 0px 20px rgba(0,0,0,1)',
          transform: 'translate(-50%, 0)',
        }}
        onClick={() => store.enterVR()}
      >
        Enter VR
      </button>
      <KeyboardControls
        map={[
          { name: 'forward', keys: ['ArrowUp', 'w', 'W'] },
          { name: 'backward', keys: ['ArrowDown', 's', 'S'] },
          { name: 'left', keys: ['ArrowLeft', 'a', 'A'] },
          { name: 'right', keys: ['ArrowRight', 'd', 'D'] },
          { name: 'jump', keys: ['Space'] },
        ]}
      >
        <Canvas shadows camera={{ fov: 45 }}>
          <XR store={store}>
            <Sky sunPosition={[100, 20, 100]} />
            <ambientLight intensity={0.8} />
            <directionalLight intensity={5} position={[100, 60, 100]} />
            <Physics gravity={[0, -30, 0]}>
              <Ground />
              <Player />
              <Cube position={[0, 0.5, -10]} />
              <Cubes />
            </Physics>
            <PointerLockControls />
          </XR>
        </Canvas>
      </KeyboardControls>
    </>
  )
}
