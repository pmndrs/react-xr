import ReactDOM from 'react-dom'
import React, { useState, useEffect, useRef, Suspense, useMemo, useCallback } from 'react'
import {
  XRCanvas,
  useXREvent,
  Hands,
  Select,
  Hover,
  useXR,
  Interactive,
  RayGrab,
  useHitTest,
  DefaultXRControllers,
  XRSessionManager,
  XRButton,
  useAvailableXRSessionModes,
} from '@react-three/xr'
// import { OrbitControls, Sky, Text, Plane, Box } from '@react-three/drei'
import { Box, Sky, Text } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { Group } from 'three'

function Button(props) {
  const [hover, setHover] = useState(false)
  const [color, setColor] = useState(0x123456)

  return (
    <Interactive
      onSelect={() => setColor((Math.random() * 0xffffff) | 0)}
      onHover={() => setHover(true)}
      onBlur={() => setHover(false)}>
      <Box scale={hover ? [1.5, 1.5, 1.5] : [1, 1, 1]} args={[0.4, 0.1, 0.1]} {...props}>
        <meshStandardMaterial attach="material" color={color} />
        {/* <Text position={[0, 0, 0.06]} fontSize={0.05} color="#000" anchorX="center" anchorY="middle">
          Hello react-xr!
        </Text> */}
      </Box>
    </Interactive>
  )
}

function PlayerExample() {
  const { player } = useXR()

  useFrame(() => {
    player.rotation.x = player.rotation.y += 0.01
  })

  return null
}

function HitTestExample() {
  const ref = useRef()

  useHitTest((hit) => {
    hit.decompose(ref.current.position, ref.current.rotation, ref.current.scale)
  })

  return <Box ref={ref} args={[0.1, 0.1, 0.1]} />
}

function App() {
  return (
    <XRSessionManager>
      <XRCanvas>
        <ambientLight intensity={0.5} />
        <pointLight position={[5, 5, 5]} />

        <Hands
        // modelLeft={"https://vazxmixjsiawhamofees.supabase.co/storage/v1/object/public/models/left-hand-black-webxr-tracking-ready/model.gltf"}
        // modelRight={"https://vazxmixjsiawhamofees.supabase.co/storage/v1/object/public/models/right-hand-black-webxr-tracking-ready/model.gltf"}
        />
        <Button position={[0, 0.8, -1]} />
        <DefaultXRControllers />
        {/* <HitTestExample /> */}
      </XRCanvas>
      <EnterButton />
    </XRSessionManager>
  )
}

const interestedSessions = ['immersive-ar', 'immersive-vr']

function EnterButton() {
  const availableXRSessionModes = useAvailableXRSessionModes(interestedSessions)

  const sessionMode = useMemo(
    () => (availableXRSessionModes != null ? availableXRSessionModes[0] : undefined),
    [availableXRSessionModes]
  )

  if (sessionMode == null) {
    return null
  }

  return (
    <XRButton
      style={{
        cursor: 'pointer',
        background: '#fff',
        color: '#000',
        padding: '1rem 1.5rem',
        borderRadius: '1rem',
        position: 'absolute',
        left: '50%',
        transform: 'translate(-50%, 0)',
        bottom: '10vh',
        zIndex: 1,
      }}
      sessionMode={sessionMode}
      sessionInit={{
        optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'],
      }}>
      ENTER {sessionMode.toUpperCase()}
    </XRButton>
  )
}

ReactDOM.render(<App />, document.querySelector('#root'))
