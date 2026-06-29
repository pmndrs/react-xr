import {
  HandleOptions,
  HandlesContext as HandlesContextImpl,
  PivotHandlesHandles as PivotHandlesHandlesImpl,
  HandlesProperties,
} from '@pmndrs/handle'
import { ThreeElements, useFrame } from '@react-three/fiber'
import { createContext, forwardRef, useContext, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { Group } from 'three'
import { disableProperties, useApplyThatDisablesDefaultControls } from './utils.js'

export type PivotHandlesProperties = PivotHandlesContextProperties & PivotHandlesHandlesProperties

export const PivotHandles = forwardRef<Group, PivotHandlesProperties>(
  ({ children, scale, translation, rotation, size, fixed, disabled, hidden, ...props }, ref) => {
    return (
      <PivotHandlesContext {...props} ref={ref}>
        <PivotHandlesHandles
          scale={scale}
          translation={translation}
          rotation={rotation}
          size={size}
          fixed={fixed}
          hidden={hidden}
          disabled={disabled}
        />
        {children}
      </PivotHandlesContext>
    )
  },
)

const HandlesContext = createContext<HandlesContextImpl | undefined>(undefined)

export type PivotHandlesContextProperties = Omit<ThreeElements['group'], 'scale'> &
  Pick<HandleOptions<any>, 'alwaysUpdate' | 'apply' | 'stopPropagation'>

export const PivotHandlesContext = forwardRef<Group, PivotHandlesContextProperties>(
  ({ alwaysUpdate, apply, stopPropagation, children, ...props }, ref) => {
    const internalRef = useRef<Group>(null)
    useImperativeHandle(ref, () => internalRef.current!, [])
    const applyThatDisablesControls = useApplyThatDisablesDefaultControls(apply)
    const options: HandleOptions<any> = {
      alwaysUpdate,
      apply: applyThatDisablesControls,
      stopPropagation,
    }
    const optionsRef = useRef(options)
    optionsRef.current = options
    const context = useMemo(() => new HandlesContextImpl(internalRef, () => optionsRef.current), [])
    useFrame((state) => context.update(state.clock.getElapsedTime()), -1)
    return (
      <group {...props} ref={internalRef}>
        <HandlesContext.Provider value={context}>{children}</HandlesContext.Provider>
      </group>
    )
  },
)

export type PivotHandlesHandlesProperties = {
  scale?: HandlesProperties
  translation?: HandlesProperties
  rotation?: HandlesProperties
  size?: number | null
  fixed?: boolean | null
  disabled?: boolean
  hidden?: boolean
}

export const PivotHandlesHandles = forwardRef<PivotHandlesHandlesImpl, PivotHandlesHandlesProperties>(
  ({ size, fixed, scale, rotation, translation, disabled, hidden }, ref) => {
    const context = useContext(HandlesContext)
    if (context == null) {
      throw new Error('PivotHandlesHandles can only be used inside PivotHandlesContext')
    }
    const handles = useMemo(() => new PivotHandlesHandlesImpl(context), [context])
    useImperativeHandle(ref, () => handles, [handles])
    if (size !== null) {
      handles.size = size
    }
    if (fixed !== null) {
      handles.fixed = fixed
    }
    useEffect(
      () => (hidden ? undefined : handles.scaleX.bind(0xff2060, disabled ? disableProperties(scale) : scale)),
      [disabled, scale, handles, hidden],
    )
    useEffect(
      () => (hidden ? undefined : handles.scaleY.bind(0x20df80, disabled ? disableProperties(scale) : scale)),
      [disabled, scale, handles, hidden],
    )
    useEffect(
      () => (hidden ? undefined : handles.scaleZ.bind(0x2080ff, disabled ? disableProperties(scale) : scale)),
      [disabled, scale, handles, hidden],
    )
    useEffect(
      () => (hidden ? undefined : handles.scaleXYZ.bind(0xffffff, disabled ? disableProperties(scale) : scale)),
      [disabled, scale, handles, hidden],
    )
    useEffect(
      () => (hidden ? undefined : handles.rotationX.bind(0xff2060, disabled ? disableProperties(rotation) : rotation)),
      [disabled, rotation, handles, hidden],
    )
    useEffect(
      () => (hidden ? undefined : handles.rotationY.bind(0x20df80, disabled ? disableProperties(rotation) : rotation)),
      [disabled, rotation, handles, hidden],
    )
    useEffect(
      () => (hidden ? undefined : handles.rotationZ.bind(0x2080ff, disabled ? disableProperties(rotation) : rotation)),
      [disabled, rotation, handles, hidden],
    )
    useEffect(
      () =>
        hidden
          ? undefined
          : handles.translationX.bind(0xff2060, 0xffff40, disabled ? disableProperties(translation) : translation),
      [disabled, translation, handles, hidden],
    )
    useEffect(
      () =>
        hidden
          ? undefined
          : handles.translationY.bind(0x20df80, 0xffff40, disabled ? disableProperties(translation) : translation),
      [disabled, translation, handles, hidden],
    )
    useEffect(
      () =>
        hidden
          ? undefined
          : handles.translationZ.bind(0x2080ff, 0xffff40, disabled ? disableProperties(translation) : translation),
      [disabled, translation, handles, hidden],
    )
    useEffect(
      () =>
        hidden
          ? undefined
          : handles.translationXY.bind(0xff2060, 0xffff40, disabled ? disableProperties(translation) : translation),
      [disabled, translation, handles, hidden],
    )
    useEffect(
      () =>
        hidden
          ? undefined
          : handles.translationYZ.bind(0x2080ff, 0xffff40, disabled ? disableProperties(translation) : translation),
      [disabled, translation, handles, hidden],
    )
    useEffect(
      () =>
        hidden
          ? undefined
          : handles.translationXZ.bind(0x20df80, 0xffff40, disabled ? disableProperties(translation) : translation),
      [disabled, translation, handles, hidden],
    )
    useFrame((state) => handles.update(state.camera))
    return <primitive object={handles} />
  },
)
