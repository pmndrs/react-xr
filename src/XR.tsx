import * as React from 'react'
import * as THREE from 'three'
import create, { EqualityChecker, GetState, SetState, StateSelector } from 'zustand'
import { useThree } from '@react-three/fiber'
import { XRController } from './XRController'
import { InteractionManager, XRInteractionHandler, XRInteractionType } from './Interactions'
import { XREventHandler } from './XREvents'
import { uniq, useIsomorphicLayoutEffect, useCallbackRef } from './utils'
import { XRContext, XRState } from './context'

interface GlobalSessionState {
  set: SetState<GlobalSessionState>
  get: GetState<GlobalSessionState>
  session: XRSession | null
  referenceSpaceType: XRReferenceSpaceType | null
}
const globalSessionStore = create<GlobalSessionState>((set, get) => ({ set, get, session: null, referenceSpaceType: null }))

export type XRManagerEventType = 'sessionstart' | 'sessionend'
export interface XRManagerEvent {
  type: XRManagerEventType
  target: XRSession
}
export interface XRProps {
  /**
   * Enables foveated rendering. `Default is `0`
   * 0 = no foveation, full resolution
   * 1 = maximum foveation, the edges render at lower resolution
   */
  foveation?: number
  /**
   * The target framerate for the XRSystem. Smaller rates give more CPU headroom at the cost of responsiveness.
   * Recommended range is `72`-`120`. Default is unset and left to the device.
   * @note If your experience cannot effectively reach the target framerate, it will be subject to frame reprojection
   * which will halve the effective framerate. Choose a conservative estimate that balances responsiveness and
   * headroom based on your experience.
   * @see https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API/Rendering#refresh_rate_and_frame_rate
   */
  frameRate?: number
  /** Type of WebXR reference space to use. Default is `local-floor` */
  referenceSpace?: XRReferenceSpaceType
  /** Called as an XRSession is requested */
  onSessionStart?: XREventHandler<XRManagerEvent>
  /** Called after an XRSession is terminated */
  onSessionEnd?: XREventHandler<XRManagerEvent>
  /** Called when an XRSession is hidden or unfocused. */
  onVisibilityChange?: XREventHandler<XRSessionEvent>
  /** Called when available inputsources change */
  onInputSourcesChange?: XREventHandler<XRSessionEvent>
  children: React.ReactNode
}
function XRManager({
  foveation = 0,
  frameRate = undefined,
  referenceSpace = 'local-floor',
  onSessionStart,
  onSessionEnd,
  onVisibilityChange,
  onInputSourcesChange,
  children
}: XRProps) {
  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera)
  const player = useXR((state) => state.player)
  const get = useXR((state) => state.get)
  const set = useXR((state) => state.set)
  const session = useXR((state) => state.session)
  const controllers = useXR((state) => state.controllers)

  const onSessionStartRef = useCallbackRef(onSessionStart)
  const onSessionEndRef = useCallbackRef(onSessionEnd)
  const onVisibilityChangeRef = useCallbackRef(onVisibilityChange)
  const onInputSourcesChangeRef = useCallbackRef(onInputSourcesChange)

  useIsomorphicLayoutEffect(() => {
    const handlers = [0, 1].map((id) => {
      const target = new XRController(id, gl)
      const onConnected = () => set((state) => ({ controllers: [...state.controllers, target] }))
      const onDisconnected = () => set((state) => ({ controllers: state.controllers.filter((it) => it !== target) }))

      target.addEventListener('connected', onConnected)
      target.addEventListener('disconnected', onDisconnected)

      return () => {
        target.removeEventListener('connected', onConnected)
        target.removeEventListener('disconnected', onDisconnected)
      }
    })

    return () => handlers.forEach((cleanup) => cleanup())
  }, [gl, set])

  useIsomorphicLayoutEffect(() => globalSessionStore.subscribe(({ session }) => set(() => ({ session }))), [gl.xr, set])

  useIsomorphicLayoutEffect(() => {
    gl.xr.setFoveation(foveation)
    set(() => ({ foveation }))
  }, [gl.xr, foveation, set])

  useIsomorphicLayoutEffect(() => {
    try {
      if (frameRate) session?.updateTargetFrameRate?.(frameRate)
    } catch (_) {
      // Framerate not supported or configurable
    }
    set(() => ({ frameRate }))
  }, [session, frameRate, set])

  useIsomorphicLayoutEffect(() => {
    const globalSessionState = globalSessionStore.getState()
    gl.xr.setReferenceSpaceType(referenceSpace)
    set(() => ({ referenceSpace }))
    globalSessionState.set({ referenceSpaceType: referenceSpace })
  }, [gl.xr, referenceSpace, set])

  useIsomorphicLayoutEffect(() => {
    if (!session) return void gl.xr.setSession(null!)

    const handleSessionStart = (nativeEvent: XRManagerEvent) => {
      set(() => ({ isPresenting: true }))
      onSessionStartRef.current?.({ nativeEvent: { ...nativeEvent, target: session }, target: session })
    }
    const handleSessionEnd = (nativeEvent: XRManagerEvent) => {
      set(() => ({ isPresenting: false, session: null }))
      globalSessionStore.setState(() => ({ session: null }))
      onSessionEndRef.current?.({ nativeEvent: { ...nativeEvent, target: session }, target: session })
    }
    const handleVisibilityChange = (nativeEvent: XRSessionEvent) => {
      onVisibilityChangeRef.current?.({ nativeEvent, target: session })
    }
    const handleInputSourcesChange = (nativeEvent: XRInputSourceChangeEvent) => {
      const isHandTracking = Object.values(session.inputSources).some((source) => source.hand)
      set(() => ({ isHandTracking }))
      onInputSourcesChangeRef.current?.({ nativeEvent, target: session })
    }

    gl.xr.addEventListener('sessionstart', handleSessionStart)
    gl.xr.addEventListener('sessionend', handleSessionEnd)
    session.addEventListener('visibilitychange', handleVisibilityChange)
    session.addEventListener('inputsourceschange', handleInputSourcesChange)

    gl.xr.setSession(session).then(() => {
      // on setSession, three#WebXRManager resets foveation to 1
      // so foveation set needs to happen after it
      gl.xr.setFoveation(get().foveation)
    })

    return () => {
      gl.xr.removeEventListener('sessionstart', handleSessionStart)
      gl.xr.removeEventListener('sessionend', handleSessionEnd)
      session.removeEventListener('visibilitychange', handleVisibilityChange)
      session.removeEventListener('inputsourceschange', handleInputSourcesChange)
    }
  }, [session, gl.xr, set, get])

  return (
    <InteractionManager>
      <primitive object={player}>
        <primitive object={camera} />
        {controllers.map((controller) => (
          <primitive key={controller.index} object={controller} />
        ))}
      </primitive>
      {children}
    </InteractionManager>
  )
}

export function XR(props: XRProps) {
  const store = React.useMemo(
    () =>
      create<XRState>((set, get) => ({
        set,
        get,

        controllers: [],
        isPresenting: false,
        isHandTracking: false,
        player: new THREE.Group(),
        session: null,
        foveation: 0,
        referenceSpace: 'local-floor',

        hoverState: {
          left: new Map(),
          right: new Map(),
          none: new Map()
        },
        interactions: new Map(),
        hasInteraction(object: THREE.Object3D, eventType: XRInteractionType) {
          return !!get()
            .interactions.get(object)
            ?.[eventType].some((handlerRef) => handlerRef.current)
        },
        getInteraction(object: THREE.Object3D, eventType: XRInteractionType) {
          return get()
            .interactions.get(object)
            ?.[eventType].reduce((result, handlerRef) => {
              if (handlerRef.current) {
                result.push(handlerRef.current)
              }
              return result
            }, [] as XRInteractionHandler[])
        },
        addInteraction(object: THREE.Object3D, eventType: XRInteractionType, handlerRef: React.RefObject<XRInteractionHandler>) {
          const interactions = get().interactions
          if (!interactions.has(object)) {
            interactions.set(object, {
              onHover: [],
              onBlur: [],
              onSelect: [],
              onSelectEnd: [],
              onSelectStart: [],
              onSelectMissed: [],
              onSqueeze: [],
              onSqueezeEnd: [],
              onSqueezeStart: [],
              onSqueezeMissed: [],
              onMove: []
            })
          }

          const target = interactions.get(object)!
          target[eventType].push(handlerRef)
        },
        removeInteraction(object: THREE.Object3D, eventType: XRInteractionType, handlerRef: React.RefObject<XRInteractionHandler>) {
          const target = get().interactions.get(object)
          if (target) {
            const interactionIndex = target[eventType].indexOf(handlerRef)
            if (interactionIndex !== -1) target[eventType].splice(interactionIndex, 1)
          }
        }
      })),
    []
  )

  return (
    <XRContext.Provider value={store}>
      <XRManager {...props} />
    </XRContext.Provider>
  )
}

export type XRButtonStatus = 'unsupported' | 'exited' | 'entered'
export type XRButtonUnsupportedReason = 'unknown' | 'https' | 'security'
export interface XRButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'onError'> {
  /** The type of `XRSession` to create */
  mode: 'AR' | 'VR' | 'inline'
  /**
   * `XRSession` configuration options
   * @see https://immersive-web.github.io/webxr/#feature-dependencies
   */
  sessionInit?: XRSessionInit
  /** Whether this button should only enter an `XRSession`. Default is `false` */
  enterOnly?: boolean
  /** Whether this button should only exit an `XRSession`. Default is `false` */
  exitOnly?: boolean
  /** This callback gets fired if XR initialization fails. */
  onError?: (error: Error) => void
  /** React children, can also accept a callback returning an `XRButtonStatus` */
  children?: React.ReactNode | ((status: XRButtonStatus) => React.ReactNode)
}

const getSessionOptions = (
  globalStateReferenceSpaceType: XRReferenceSpaceType | null,
  sessionInit: XRSessionInit | undefined
): XRSessionInit | undefined => {
  if (!globalStateReferenceSpaceType && !sessionInit) {
    return undefined
  }

  if (globalStateReferenceSpaceType && !sessionInit) {
    return { optionalFeatures: [globalStateReferenceSpaceType] }
  }

  if (globalStateReferenceSpaceType && sessionInit) {
    return { ...sessionInit, optionalFeatures: uniq([...(sessionInit.optionalFeatures ?? []), globalStateReferenceSpaceType]) }
  }

  return sessionInit
}

export const startSession = async (sessionMode: XRSessionMode, sessionInit: XRButtonProps['sessionInit']) => {
  const xrState = globalSessionStore.getState()

  if (xrState.session) {
    console.warn('@react-three/xr: session already started, please stop it first')
    return
  }

  const options = getSessionOptions(xrState.referenceSpaceType, sessionInit)
  const session = await navigator.xr!.requestSession(sessionMode, options)
  xrState.set(() => ({ session }))
  return session
}

export const stopSession = async () => {
  const xrState = globalSessionStore.getState()

  if (!xrState.session) {
    console.warn('@react-three/xr: no session to stop, please start it first')
    return
  }

  await xrState.session.end()
  xrState.set({ session: null })
}

export const toggleSession = async (
  sessionMode: XRSessionMode,
  { sessionInit, enterOnly, exitOnly }: Pick<XRButtonProps, 'sessionInit' | 'enterOnly' | 'exitOnly'> = {}
) => {
  const xrState = globalSessionStore.getState()

  // Bail if certain toggle way is disabled
  if (xrState.session && enterOnly) return
  if (!xrState.session && exitOnly) return

  // Exit/enter session
  if (xrState.session) {
    return await stopSession()
  } else {
    return await startSession(sessionMode, sessionInit)
  }
}

const getLabel = (status: XRButtonStatus, mode: XRButtonProps['mode'], reason: XRButtonUnsupportedReason) => {
  switch (status) {
    case 'entered':
      return `Exit ${mode}`
    case 'exited':
      return `Enter ${mode}`
    case 'unsupported':
    default:
      switch (reason) {
        case 'https':
          return 'HTTPS needed'
        case 'security':
          return `${mode} blocked`
        case 'unknown':
        default:
          return `${mode} unsupported`
      }
  }
}

export const XRButton = React.forwardRef<HTMLButtonElement, XRButtonProps>(function XRButton(
  { mode, sessionInit, enterOnly = false, exitOnly = false, onClick, onError, children, ...props },
  ref
) {
  const [status, setStatus] = React.useState<XRButtonStatus>('exited')
  const [reason, setReason] = React.useState<XRButtonUnsupportedReason>('unknown')
  const label = getLabel(status, mode, reason)
  const sessionMode = (mode === 'inline' ? mode : `immersive-${mode.toLowerCase()}`) as XRSessionMode
  const onErrorRef = useCallbackRef(onError)

  useIsomorphicLayoutEffect(() => {
    if (!navigator?.xr) return void setStatus('unsupported')
    navigator.xr
      .isSessionSupported(sessionMode)
      .then((supported) => {
        if (!supported) {
          const isHttps = location.protocol === 'https:'
          setStatus('unsupported')
          setReason(isHttps ? 'unknown' : 'https')
        } else {
          setStatus('exited')
        }
      })
      .catch((error) => {
        setStatus('unsupported')
        // https://developer.mozilla.org/en-US/docs/Web/API/XRSystem/isSessionSupported#exceptions
        if ('name' in error && error.name === 'SecurityError') {
          setReason('security')
        } else {
          setReason('unknown')
        }
      })
  }, [sessionMode])

  useIsomorphicLayoutEffect(
    () =>
      globalSessionStore.subscribe((state) => {
        if (state.session) {
          setStatus('entered')
        } else if (status !== 'unsupported') {
          setStatus('exited')
        }
      }),
    [status]
  )

  const handleButtonClick = React.useCallback(
    async (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      onClick?.(event)

      try {
        toggleSession(sessionMode, { sessionInit, enterOnly, exitOnly })
      } catch (e) {
        const onError = onErrorRef.current
        if (onError && e instanceof Error) onError(e)
        else throw e
      }
    },
    [onClick, sessionMode, sessionInit, enterOnly, exitOnly, onErrorRef]
  )

  return (
    <button {...props} ref={ref} onClick={status === 'unsupported' ? onClick : handleButtonClick}>
      {(typeof children === 'function' ? children(status) : children) ?? label}
    </button>
  )
})

const buttonStyles: any = {
  position: 'absolute',
  bottom: '24px',
  left: '50%',
  transform: 'translateX(-50%)',
  padding: '12px 24px',
  border: '1px solid white',
  borderRadius: '4px',
  background: 'rgba(0, 0, 0, 0.1)',
  color: 'white',
  font: 'normal 0.8125rem sans-serif',
  outline: 'none',
  zIndex: 99999,
  cursor: 'pointer'
}

export const ARButton = React.forwardRef<HTMLButtonElement, Omit<XRButtonProps, 'mode'>>(
  (
    {
      style = buttonStyles,
      sessionInit = {
        // @ts-ignore
        domOverlay: typeof document !== 'undefined' ? { root: document.body } : undefined,
        optionalFeatures: ['hit-test', 'dom-overlay']
      },
      children,
      ...rest
    },
    ref
  ) => (
    <XRButton {...rest} ref={ref} mode="AR" style={style} sessionInit={sessionInit}>
      {children}
    </XRButton>
  )
)

export const VRButton = React.forwardRef<HTMLButtonElement, Omit<XRButtonProps, 'mode'>>(
  (
    {
      style = buttonStyles,
      sessionInit = { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking', 'layers'] },
      children,
      ...rest
    },
    ref
  ) => (
    <XRButton {...rest} ref={ref} mode="VR" style={style} sessionInit={sessionInit}>
      {children}
    </XRButton>
  )
)

export function useXR<T = XRState>(
  selector: StateSelector<XRState, T> = (state) => state as unknown as T,
  equalityFn?: EqualityChecker<T>
) {
  const store = React.useContext(XRContext)
  if (!store) throw new Error('useXR must be used within an <XR /> component!')
  return store(selector, equalityFn)
}

export function useController(handedness: XRHandedness) {
  const controllers = useXR((state) => state.controllers)
  const controller = React.useMemo(
    () => controllers.find(({ inputSource }) => inputSource?.handedness && inputSource.handedness === handedness),
    [handedness, controllers]
  )

  return controller
}
