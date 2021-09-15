import React, { useRef, useEffect, ReactNode, useMemo, useContext, forwardRef } from 'react'
import { useXR } from './XR'
import { Object3D, Group, Matrix4, Raycaster, Intersection, XRHandedness } from 'three'
import { useFrame } from '@react-three/fiber'
import { XRController } from './XRController'
import { ObjectsState } from './ObjectsState'
import mergeRefs from 'react-merge-refs'
import { useXREvent, XREvent } from './XREvents'

export interface XRInteractionEvent {
  intersection?: Intersection
  controller: XRController
}

export type XRInteractionType =
  | 'onHover'
  | 'onBlur'
  | 'onSelectStart'
  | 'onSelectEnd'
  | 'onSelect'
  | 'onSqueeze'
  | 'onSqueezeEnd'
  | 'onSqueezeStart'

export type XRInteractionHandler = (event: XRInteractionEvent) => any

const warnAboutVRARCanvas = () => console.warn('You must provide a ARCanvas or VRCanvas as a wrapper to use interactions')

export const InteractionsContext = React.createContext<{
  hoverState: Record<XRHandedness, Map<Object3D, Intersection>>
  addInteraction: (object: Object3D, eventType: XRInteractionType, handler: XRInteractionHandler) => any
  removeInteraction: (object: Object3D, eventType: XRInteractionType, handler: XRInteractionHandler) => any
}>({
  hoverState: {} as any,
  addInteraction: warnAboutVRARCanvas,
  removeInteraction: warnAboutVRARCanvas
})
export function InteractionManager({ children }: { children: any }) {
  const { controllers } = useXR()

  const [hoverState] = React.useState<Record<XRHandedness, Map<Object3D, Intersection>>>(() => ({
    left: new Map(),
    right: new Map(),
    none: new Map()
  }))

  const [interactions] = React.useState(() => ObjectsState.make<XRInteractionType, XRInteractionHandler>())

  const addInteraction = React.useCallback(
    (object: Object3D, eventType: XRInteractionType, handler: XRInteractionHandler) => {
      ObjectsState.add(interactions, object, eventType, handler)
    },
    [interactions]
  )

  const removeInteraction = React.useCallback(
    (object: Object3D, eventType: XRInteractionType, handler: XRInteractionHandler) => {
      ObjectsState.delete(interactions, object, eventType, handler)
    },
    [interactions]
  )
  const [raycaster] = React.useState(() => new Raycaster())

  const intersect = React.useCallback(
    (controller: Object3D) => {
      const objects = Array.from(interactions.keys())
      const tempMatrix = new Matrix4()
      tempMatrix.identity().extractRotation(controller.matrixWorld)
      raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld)
      raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix)

      return raycaster.intersectObjects(objects, true)
    },
    [interactions, raycaster]
  )

  // Trigger hover and blur events
  useFrame(() => {
    if (interactions.size === 0) {
      return
    }

    controllers.forEach((it) => {
      const { controller } = it
      const handedness = it.inputSource.handedness
      const hovering = hoverState[handedness]
      const hits = new Set()
      const intersections = intersect(controller)

      intersections.forEach((intersection) => {
        let eventObject: Object3D | null = intersection.object

        while (eventObject) {
          if (ObjectsState.has(interactions, eventObject, 'onHover') && !hovering.has(eventObject)) {
            ObjectsState.get(interactions, eventObject, 'onHover')?.forEach((handler) => handler({ controller: it, intersection }))
          }

          hovering.set(eventObject, intersection)
          hits.add(eventObject.id)
          eventObject = eventObject.parent
        }
      })

      // Trigger blur on all the object that were hovered in the previous frame
      // but missed in this one
      for (const eventObject of hovering.keys()) {
        if (!hits.has(eventObject.id)) {
          ObjectsState.get(interactions, eventObject, 'onBlur')?.forEach((handler) => handler({ controller: it }))
          hovering.delete(eventObject)
        }
      }
    })
  })

  const triggerEvent = (interaction: XRInteractionType) => (e: XREvent) => {
    const hovering = hoverState[e.controller.inputSource.handedness]
    for (const hovered of hovering.keys()) {
      ObjectsState.get(interactions, hovered, interaction)?.forEach((handler) => handler({ controller: e.controller }))
    }
  }

  useXREvent('select', triggerEvent('onSelect'))
  useXREvent('selectstart', triggerEvent('onSelectStart'))
  useXREvent('selectend', triggerEvent('onSelectEnd'))
  useXREvent('squeeze', triggerEvent('onSqueeze'))
  useXREvent('squeezeend', triggerEvent('onSqueezeEnd'))
  useXREvent('squeezestart', triggerEvent('onSqueezeStart'))

  const contextValue = useMemo(() => ({ addInteraction, removeInteraction, hoverState }), [addInteraction, removeInteraction, hoverState])

  return <InteractionsContext.Provider value={contextValue}>{children}</InteractionsContext.Provider>
}

export const useInteraction = (ref: any, type: XRInteractionType, handler?: XRInteractionHandler) => {
  const { addInteraction, removeInteraction } = useContext(InteractionsContext)

  const isPresent = handler !== undefined
  const handlerRef = useRef(handler)
  useEffect(() => {
    handlerRef.current = handler
  }, [handler])

  useEffect(() => {
    if (!isPresent) return

    const handlerFn = (e: XRInteractionEvent) => {
      // @ts-ignore
      handlerRef.current(e)
    }

    addInteraction(ref.current, type, handlerFn)
    const maybeRef = ref.current

    return () => removeInteraction(maybeRef, type, handlerFn)
  }, [type, addInteraction, removeInteraction, isPresent, ref])
}

export const Interactive = forwardRef(
  (
    props: {
      children: ReactNode
      onHover?: XRInteractionHandler
      onBlur?: XRInteractionHandler
      onSelectStart?: XRInteractionHandler
      onSelectEnd?: XRInteractionHandler
      onSelect?: XRInteractionHandler
      onSqueezeStart?: XRInteractionHandler
      onSqueezeEnd?: XRInteractionHandler
      onSqueeze?: XRInteractionHandler
    },
    passedRef
  ) => {
    const ref = useRef<Object3D>()

    useInteraction(ref, 'onHover', props.onHover)
    useInteraction(ref, 'onBlur', props.onBlur)
    useInteraction(ref, 'onSelectStart', props.onSelectStart)
    useInteraction(ref, 'onSelectEnd', props.onSelectEnd)
    useInteraction(ref, 'onSelect', props.onSelect)
    useInteraction(ref, 'onSqueezeStart', props.onSqueezeStart)
    useInteraction(ref, 'onSqueezeEnd', props.onSqueezeEnd)
    useInteraction(ref, 'onSqueeze', props.onSqueeze)

    return <group ref={mergeRefs([passedRef, ref])}>{props.children}</group>
  }
)

export function RayGrab({ children }: { children: ReactNode }) {
  const grabbingController = useRef<Object3D>()
  const groupRef = useRef<Group>()
  const previousTransform = useRef<Matrix4 | undefined>(undefined)

  useXREvent('selectend', (e) => {
    if (e.controller.controller === grabbingController.current) {
      grabbingController.current = undefined
      previousTransform.current = undefined
    }
  })

  useFrame(() => {
    if (!grabbingController.current || !previousTransform.current || !groupRef.current) {
      return
    }

    const controller = grabbingController.current
    const group = groupRef.current

    group.applyMatrix4(previousTransform.current)
    group.applyMatrix4(controller.matrixWorld)
    group.updateWorldMatrix(false, true)

    previousTransform.current = controller.matrixWorld.clone().invert()
  })

  return (
    <Interactive
      ref={groupRef}
      onSelectStart={(e) => {
        grabbingController.current = e.controller.controller
        previousTransform.current = e.controller.controller.matrixWorld.clone().invert()
      }}>
      {children}
    </Interactive>
  )
}
