import * as THREE from 'three'
import * as React from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Interactive, type XRInteractionEvent } from './Interactions'

const _q = /* @__PURE__ */ new THREE.Quaternion()

/**
 * Teleport callback, accepting a world-space target position to teleport to.
 */
export type TeleportCallback = (target: THREE.Vector3 | THREE.Vector3Tuple) => void

/**
 * Returns a {@link TeleportCallback} to teleport the player to a position.
 */
export function useTeleportation(): TeleportCallback {
  const frame = React.useRef<XRFrame>()
  const session = React.useRef<XRSession | null>()
  const baseReferenceSpace = React.useRef<XRReferenceSpace | null>(null)
  const teleportReferenceSpace = React.useRef<XRReferenceSpace | null>(null)

  useFrame((state, _, xrFrame) => {
    frame.current = xrFrame

    const xrSession = state.gl.xr.getSession()
    if (xrSession && session.current !== xrSession) {
      baseReferenceSpace.current = state.gl.xr.getReferenceSpace()
      session.current = xrSession
    }

    const teleportOffset = teleportReferenceSpace.current
    if (teleportOffset && baseReferenceSpace.current !== teleportOffset) {
      state.gl.xr.setReferenceSpace(teleportOffset)
    }
  })

  return React.useCallback((target) => {
    const base = baseReferenceSpace.current
    if (base) {
      const [x, y, z] = Array.from(target as THREE.Vector3Tuple)
      const offsetFromBase = { x: -x, y: -y, z: -z }

      const pose = frame.current?.getViewerPose(base)
      if (pose) {
        offsetFromBase.x += pose.transform.position.x
        offsetFromBase.z += pose.transform.position.z
      }

      const teleportOffset = new XRRigidTransform(offsetFromBase, _q)
      teleportReferenceSpace.current = base.getOffsetReferenceSpace(teleportOffset)
    }
  }, [])
}

export interface TeleportationPlaneProps extends Partial<JSX.IntrinsicElements['group']> {
  /** Whether to allow teleportation from left controller. Default is `false` */
  leftHand?: boolean
  /** Whether to allow teleportation from right controller. Default is `false` */
  rightHand?: boolean
  /** The maximum distance from the camera to the teleportation point. Default is `10` */
  maxDistance?: number
  /** The radial size of the teleportation marker. Default is `0.25` */
  size?: number
}

/**
 * Creates a teleportation plane with a marker that will teleport on interaction.
 */
export const TeleportationPlane = React.forwardRef<THREE.Group, TeleportationPlaneProps>(function TeleportationPlane(
  { leftHand = false, rightHand = false, maxDistance = 10, size = 0.25, ...props },
  ref
) {
  const teleport = useTeleportation()
  const marker = React.useRef<THREE.Mesh>(null!)
  const intersection = React.useRef<THREE.Vector3>()
  const camera = useThree((state) => state.camera)

  const isInteractive = React.useCallback(
    (e: XRInteractionEvent): boolean => {
      const handedness = e.target.inputSource?.handedness
      return !!((handedness !== 'left' || leftHand) && (handedness !== 'right' || rightHand))
    },
    [leftHand, rightHand]
  )

  return (
    <group ref={ref} {...props}>
      <mesh ref={marker} visible={false} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[size, 32]} />
        <meshBasicMaterial color="white" />
      </mesh>
      <Interactive
        onMove={(e) => {
          if (!isInteractive(e) || !e.intersection) return

          const distanceFromCamera = e.intersection.point.distanceTo(camera.position)
          marker.current.visible = distanceFromCamera <= maxDistance
          marker.current.scale.setScalar(1)

          intersection.current = e.intersection.point
          marker.current.position.copy(intersection.current)
        }}
        onHover={(e) => {
          if (!isInteractive(e) || !e.intersection) return

          const distanceFromCamera = e.intersection.point.distanceTo(camera.position)
          marker.current.visible = distanceFromCamera <= maxDistance
          marker.current.scale.setScalar(1)
        }}
        onBlur={(e) => {
          if (!isInteractive(e)) return
          marker.current.visible = false
        }}
        onSelectStart={(e) => {
          if (!isInteractive(e) || !e.intersection) return

          const distanceFromCamera = e.intersection.point.distanceTo(camera.position)
          marker.current.visible = distanceFromCamera <= maxDistance
          marker.current.scale.setScalar(1.1)
        }}
        onSelectEnd={(e) => {
          if (!isInteractive(e) || !intersection.current) return

          marker.current.visible = true
          marker.current.scale.setScalar(1)

          const distanceFromCamera = intersection.current.distanceTo(camera.position)
          if (distanceFromCamera <= maxDistance) {
            teleport(intersection.current)
          }
        }}
      >
        <mesh rotation-x={-Math.PI / 2} visible={false} scale={1000}>
          <planeGeometry />
        </mesh>
      </Interactive>
    </group>
  )
})
