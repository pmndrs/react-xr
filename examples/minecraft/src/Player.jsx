import * as THREE from 'three'
import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useKeyboardControls } from '@react-three/drei'
import { CapsuleCollider, RigidBody, useRapier } from '@react-three/rapier'
import { IfInSessionMode } from '@react-three/xr'

import { Axe } from './Axe.jsx'
import { VRPlayerControl } from './VRPlayerControl.jsx'

const SPEED = 5
const direction = new THREE.Vector3()
const frontVector = new THREE.Vector3()
const sideVector = new THREE.Vector3()
const rotation = new THREE.Vector3()

const vectorHelper = new THREE.Vector3()

export function Player({ lerp = THREE.MathUtils.lerp }) {
  const axe = useRef()
  const ref = useRef()
  const { rapier, world } = useRapier()
  const [subscribeKeys, getKeys] = useKeyboardControls()

  const playerMove = ({ forward, backward, left, right, rotation, velocity }) => {
    if (!velocity) {
      velocity = ref.current.linvel()
    }

    frontVector.set(0, 0, backward - forward)
    sideVector.set(left - right, 0, 0)
    direction.subVectors(frontVector, sideVector).normalize().multiplyScalar(SPEED).applyEuler(rotation)
    ref.current.setLinvel({ x: direction.x, y: velocity.y, z: direction.z })
  }

  const playerJump = () => {
    const ray = world.castRay(new rapier.Ray(ref.current.translation(), { x: 0, y: -1, z: 0 }))
    const grounded = ray && ray.collider && Math.abs(ray.timeOfImpact) <= 1.25

    if (grounded) ref.current.setLinvel({ x: 0, y: 7.5, z: 0 })
  }

  useFrame((state) => {
    const { forward, backward, left, right } = getKeys()
    const velocity = ref.current.linvel()

    vectorHelper.set(velocity.x, velocity.y, velocity.z)

    // update camera
    const { x, y, z } = ref.current.translation()
    state.camera.position.set(x, y, z)

    // update axe
    if (axe.current != null) {
      axe.current.children[0].rotation.x = lerp(
        axe.current.children[0].rotation.x,
        Math.sin((vectorHelper.length() > 1) * state.clock.elapsedTime * 10) / 6,
        0.1,
      )
      axe.current.rotation.copy(state.camera.rotation)
      axe.current.position.copy(state.camera.position).add(state.camera.getWorldDirection(rotation).multiplyScalar(1))
    }

    // movement
    if (ref.current) {
      playerMove({
        forward, backward, left, right,
        rotation: state.camera.rotation,
        velocity
      })
    }
  })

  useEffect(() => {
    const cleanupSubscription = subscribeKeys(
      state => state.jump,

      value => {
        if (value) {
          playerJump()
        }
      }
    )

    return () => cleanupSubscription()
  }, [])

  return <>
    <RigidBody
      ref={ref}
      colliders={false}
      mass={1}
      type="dynamic"
      position={[0, 10, 0]}
      enabledRotations={[false, false, false]}
      canSleep={false}
    >
      <CapsuleCollider args={[0.75, 0.5]} />

      <IfInSessionMode allow={'immersive-vr'}>
        <VRPlayerControl
          playerJump={playerJump}
          playerMove={playerMove}
        />
      </IfInSessionMode>
    </RigidBody>

    <IfInSessionMode deny="immersive-vr">
      <group ref={axe} onPointerMissed={(e) => (axe.current.children[0].rotation.x = -0.5)}>
        <Axe position={[0.3, -0.35, 0.5]} />
      </group>
    </IfInSessionMode>
  </>
}
