import * as React from 'react'
import * as THREE from 'three'
import { useThree, useFrame } from '@react-three/fiber'
import { useXR } from './XR'
import { XRController } from './XRController'
import { useXREvent, XREvent, XRControllerEvent } from './XREvents'

export interface XRInteractionEvent {
  intersection?: THREE.Intersection
  intersections: THREE.Intersection[]
  target: XRController
}

export type XRInteractionType =
  | 'onHover'
  | 'onBlur'
  | 'onSelect'
  | 'onSelectEnd'
  | 'onSelectStart'
  | 'onSelectMissed'
  | 'onSqueeze'
  | 'onSqueezeEnd'
  | 'onSqueezeStart'

export type XRInteractionHandler = (event: XRInteractionEvent) => any

const tempMatrix = new THREE.Matrix4()

export function InteractionManager({ children }: { children: React.ReactNode }) {
  const events = useThree((state) => state.events)
  const get = useThree((state) => state.get)
  const raycaster = useThree((state) => state.raycaster)
  const controllers = useXR((state) => state.controllers)
  const interactions = useXR((state) => state.interactions)
  const hoverState = useXR((state) => state.hoverState)
  const hasInteraction = useXR((state) => state.hasInteraction)
  const getInteraction = useXR((state) => state.getInteraction)

  const intersect = React.useCallback(
    (controller: THREE.Object3D) => {
      const objects = Array.from(interactions.keys())
      tempMatrix.identity().extractRotation(controller.matrixWorld)
      raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld)
      raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix)

      return raycaster.intersectObjects(objects, true)
    },
    [interactions, raycaster]
  )

  // Trigger hover and blur events
  useFrame(() => {
    if (interactions.size === 0) return

    for (const target of controllers) {
      const hovering = hoverState[target.inputSource.handedness]
      const hits = new Set()
      let intersections = intersect(target.controller)

      if (events.filter) {
        // https://github.com/mrdoob/three.js/issues/16031
        // Allow custom userland intersect sort order
        intersections = events.filter(intersections, get())
      } else {
        // Otherwise, filter to first hit
        const hit = intersections.find((i) => i?.object)
        if (hit) intersections = [hit]
      }

      for (const intersection of intersections) {
        let eventObject: THREE.Object3D | null = intersection.object

        while (eventObject) {
          if (hasInteraction(eventObject, 'onHover') && !hovering.has(eventObject)) {
            const handlers = getInteraction(eventObject, 'onHover')!
            for (const handler of handlers) {
              handler({ target, intersection, intersections })
            }
          }

          hovering.set(eventObject, intersection)
          hits.add(eventObject.id)
          eventObject = eventObject.parent
        }
      }

      // Trigger blur on all the object that were hovered in the previous frame
      // but missed in this one
      for (const eventObject of hovering.keys()) {
        if (!hits.has(eventObject.id)) {
          hovering.delete(eventObject)

          const handlers = getInteraction(eventObject, 'onBlur')
          if (!handlers) continue

          for (const handler of handlers) {
            handler({ target, intersections })
          }
        }
      }
    }
  })

  const triggerEvent = React.useCallback(
    (interaction: XRInteractionType) => (e: XREvent<XRControllerEvent>) => {
      const hovering = hoverState[e.target.inputSource.handedness]
      const intersections = Array.from(hovering.values())

      interactions.forEach((handlers, object) => {
        if (hovering.has(object)) {
          if (!handlers[interaction]) return

          for (const handler of handlers[interaction]) {
            handler({ target: e.target, intersections })
          }
        } else {
          if (interaction === 'onSelect' && handlers['onSelectMissed']) {
            for (const handler of handlers['onSelectMissed']) {
              handler({ target: e.target, intersections })
            }
          }
        }
      })
    },
    [hoverState, getInteraction]
  )

  useXREvent('select', triggerEvent('onSelect'))
  useXREvent('selectstart', triggerEvent('onSelectStart'))
  useXREvent('selectend', triggerEvent('onSelectEnd'))
  useXREvent('squeeze', triggerEvent('onSqueeze'))
  useXREvent('squeezeend', triggerEvent('onSqueezeEnd'))
  useXREvent('squeezestart', triggerEvent('onSqueezeStart'))

  return <>{children}</>
}

export function useInteraction(ref: React.RefObject<THREE.Object3D>, type: XRInteractionType, handler?: XRInteractionHandler) {
  const addInteraction = useXR((state) => state.addInteraction)
  const removeInteraction = useXR((state) => state.removeInteraction)

  const isPresent = handler !== undefined
  const handlerRef = React.useRef(handler)
  React.useEffect(() => void (handlerRef.current = handler), [handler])

  React.useEffect(() => {
    if (!isPresent || !ref.current) return

    const handlerFn = (e: XRInteractionEvent) => handlerRef.current?.(e)
    const target = ref.current
    addInteraction(target, type, handlerFn)

    return () => removeInteraction(target, type, handlerFn)
  }, [type, addInteraction, removeInteraction, isPresent, ref])
}

export interface InteractiveProps {
  onHover?: XRInteractionHandler
  onBlur?: XRInteractionHandler
  onSelectStart?: XRInteractionHandler
  onSelectEnd?: XRInteractionHandler
  onSelect?: XRInteractionHandler
  onSqueezeStart?: XRInteractionHandler
  onSqueezeEnd?: XRInteractionHandler
  onSqueeze?: XRInteractionHandler
  children: React.ReactNode
}
export const Interactive = React.forwardRef(function Interactive(
  { onHover, onBlur, onSelectStart, onSelectEnd, onSelect, onSqueezeStart, onSqueezeEnd, onSqueeze, children }: InteractiveProps,
  passedRef
) {
  const ref = React.useRef<THREE.Group>(null!)
  React.useImperativeHandle(passedRef, () => ref.current)

  useInteraction(ref, 'onHover', onHover)
  useInteraction(ref, 'onBlur', onBlur)
  useInteraction(ref, 'onSelectStart', onSelectStart)
  useInteraction(ref, 'onSelectEnd', onSelectEnd)
  useInteraction(ref, 'onSelect', onSelect)
  useInteraction(ref, 'onSqueezeStart', onSqueezeStart)
  useInteraction(ref, 'onSqueezeEnd', onSqueezeEnd)
  useInteraction(ref, 'onSqueeze', onSqueeze)

  return <group ref={ref}>{children}</group>
})

export function RayGrab({ children }: { children: React.ReactNode }) {
  const grabbingController = React.useRef<THREE.Object3D>()
  const groupRef = React.useRef<THREE.Group>()
  const previousTransform = React.useRef<THREE.Matrix4 | undefined>(undefined)

  useXREvent('selectend', ({ target }) => {
    if (target.controller === grabbingController.current) {
      grabbingController.current = undefined
      previousTransform.current = undefined
    }
  })

  useFrame(() => {
    if (!grabbingController.current || !previousTransform.current || !groupRef.current) return

    const controller = grabbingController.current
    const group = groupRef.current

    group.applyMatrix4(previousTransform.current)
    group.applyMatrix4(controller.matrixWorld)
    group.updateWorldMatrix(false, true)

    previousTransform.current.copy(controller.matrixWorld).invert()
  })

  return (
    <Interactive
      ref={groupRef}
      onSelectStart={(e) => {
        grabbingController.current = e.target.controller
        previousTransform.current = e.target.controller.matrixWorld.clone().invert()
      }}
    >
      {children}
    </Interactive>
  )
}
