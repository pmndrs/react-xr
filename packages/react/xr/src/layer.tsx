import { forwardObjectEvents } from '@pmndrs/pointer-events'
import {
  createXRLayer,
  createXRLayerGeometry,
  createXRLayerRenderTarget,
  getXRLayerSrcTexture,
  setupXRImageLayer,
  setXRLayerRenderTarget,
  updateXRLayerProperties,
  updateXRLayerTransform,
  waitForXRLayerSrcSize,
  XRLayerProperties as XRLayerDynamicProperties,
  XRLayerEntry,
  XRLayerOptions,
  XRLayerSrc,
} from '@pmndrs/xr'
import {
  addEffect,
  context,
  InjectState,
  reconciler,
  RootState,
  ThreeElements,
  useFrame,
  useStore,
  useThree,
} from '@react-three/fiber'
import {
  forwardRef,
  MutableRefObject,
  ReactNode,
  RefObject,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  BufferGeometry,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three'
import { create, StoreApi, UseBoundStore } from 'zustand'
import { useXRSessionFeatureEnabled } from './hooks.js'
import { useXR, useXRStore } from './xr.js'

export type XRLayerProperties = XRLayerOptions &
  XRLayerDynamicProperties &
  Omit<ThreeElements['mesh'], 'geometry'> & {
    renderPriority?: number
    children?: ReactNode
    pixelWidth?: number
    pixelHeight?: number
    dpr?: number
    src?: Exclude<XRLayerSrc, WebGLRenderTarget>
    customRender?: (target: WebGLRenderTarget, state: RootState, delta: number, frame: XRFrame | undefined) => void
  }

/**
 * Component for rendering high quality quad, cylinder, or equirect layers inside supported sessions. Also includes a fallback for non-supported sessions.
 *
 * @param props
 * #### `src` - Property for displaying images and videos onto the layer. For rendering dynamic content to the layer, leave the `src` empty and put the dynamic (3D) content into the children, so that the layer acts as a render target.
 * #### `shape` - Property to configure the shape of the layer ("quad", "cylinder", "equirect").
 * #### `layout` - Property to configure the layout of the display content for stereo content ("default", "mono", "stereo-left-right", "stereo-top-bottom").
 * #### `centralAngle` - Property to configure the central angle in case the layer shape is a "cylinder".
 * #### `centralHorizontalAngle` - Property to configure the central horizontal angle in case the layer shape is "equirect".
 * #### `upperVerticalAngle` - Property to configure the upper vertical angle in case the layer shape is "equirect".
 * #### `lowerVerticalAngle` - Property to configure the lower vertical angle in case the layer shape is "equirect".
 * #### `chromaticAberrationCorrection` - Property to configure whether chromatic abberration should be corrected by the layer.
 * #### `quality` - Property to configure for what type of content the layer should be optimized ("default", "text-optimized", "graphics-optimized").
 */
export const XRLayer = forwardRef<Mesh, XRLayerProperties>(function XRLayer(
  { src, pixelWidth = 1024, pixelHeight = 1024, dpr = 1, renderPriority = 0, children, customRender, ...props },
  forwardedRef,
) {
  const [hasSize, setHasSize] = useState(false)
  const ref = useRef<Mesh>(null)
  const renderTargetRef = useRef<WebGLRenderTarget | undefined>(undefined)
  const layerEntryRef = useRef<XRLayerEntry | undefined>(undefined)
  useEffect(() => {
    setHasSize(false)
    let aborted = false
    waitForXRLayerSrcSize(src).then(() => !aborted && setHasSize(true))
    return () => void (aborted = true)
  }, [src])
  const layersEnabled = useXRSessionFeatureEnabled('layers')
  const geometry = useMemo(
    () =>
      createXRLayerGeometry(props.shape ?? 'quad', {
        centralAngle: props.centralAngle,
        centralHorizontalAngle: props.centralHorizontalAngle,
        lowerVerticalAngle: props.lowerVerticalAngle,
        upperVerticalAngle: props.upperVerticalAngle,
      }),
    [props.centralAngle, props.centralHorizontalAngle, props.lowerVerticalAngle, props.shape, props.upperVerticalAngle],
  )
  const store = useLayerStore(pixelWidth, pixelHeight, dpr)
  useForwardEvents(store, ref, [hasSize, layersEnabled])
  // hasSize and layersEnabled are deps because ref.current is only populated after children render
  useImperativeHandle(forwardedRef, () => ref.current!, [hasSize, layersEnabled])
  if (!hasSize) {
    return null
  }
  return (
    <>
      {src == null && (
        <ChildrenToRenderTarget
          customRender={customRender}
          store={store}
          renderPriority={renderPriority}
          renderTargetRef={renderTargetRef}
          layerEntryRef={layersEnabled ? layerEntryRef : undefined}
        >
          {children}
        </ChildrenToRenderTarget>
      )}
      {layersEnabled ? (
        <XRLayerImplementation
          renderTargetRef={renderTargetRef}
          layerEntryRef={layerEntryRef}
          pixelWidth={pixelWidth}
          pixelHeight={pixelHeight}
          dpr={dpr}
          ref={ref}
          {...props}
          src={src}
          geometry={geometry}
        />
      ) : (
        <FallbackXRLayerImplementation
          renderTargetRef={renderTargetRef}
          ref={ref}
          {...props}
          src={src}
          pixelWidth={pixelWidth}
          pixelHeight={pixelHeight}
          dpr={dpr}
          geometry={geometry}
        />
      )}
    </>
  )
})

export const XRLayerImplementation = forwardRef<
  Mesh,
  Omit<XRLayerProperties, 'src'> & {
    src?: Exclude<XRLayerSrc, WebGLRenderTarget>
    geometry?: BufferGeometry
    pixelWidth: number
    pixelHeight: number
    dpr: number
    renderTargetRef: MutableRefObject<WebGLRenderTarget | undefined | null>
    layerEntryRef: MutableRefObject<XRLayerEntry | undefined | null>
  }
>(
  (
    {
      src,
      shape,
      colorFormat,
      depthFormat,
      layout,
      mipLevels,
      renderOrder = 0,
      blendTextureSourceAlpha,
      centralAngle,
      centralHorizontalAngle,
      chromaticAberrationCorrection,
      lowerVerticalAngle,
      quality,
      upperVerticalAngle,
      invertStereo,
      pixelWidth,
      pixelHeight,
      dpr,
      renderTargetRef,
      layerEntryRef,
      ...props
    },
    ref,
  ) => {
    const internalRef = useRef<Mesh>(null)
    const renderer = useThree((state) => state.gl)
    const store = useXRStore()
    const layerProperties = {
      blendTextureSourceAlpha,
      centralAngle,
      centralHorizontalAngle,
      chromaticAberrationCorrection,
      lowerVerticalAngle,
      quality,
      upperVerticalAngle,
    }
    const layerPropertiesRef = useRef(layerProperties)
    layerPropertiesRef.current = layerProperties
    const renderOrderRef = useRef(renderOrder)
    renderOrderRef.current = renderOrder

    const originReferenceSpace = useXR((s) => s.originReferenceSpace)

    //create layer
    useEffect(() => {
      if (internalRef.current == null || originReferenceSpace == null) {
        return
      }
      const resolvedSrc = src ?? (renderTargetRef.current = createXRLayerRenderTarget(pixelWidth, pixelHeight, dpr))
      const layer = createXRLayer(
        resolvedSrc,
        store.getState(),
        originReferenceSpace,
        renderer.xr,
        internalRef.current,
        {
          colorFormat,
          depthFormat,
          invertStereo,
          layout,
          mipLevels,
          shape,
        },
        layerPropertiesRef.current,
      )
      if (layer == null) {
        return
      }
      const layerEntry = (layerEntryRef.current = {
        layer,
        renderOrder: renderOrderRef.current,
        object3D: internalRef.current!,
      })
      store.addLayerEntry(layerEntry)
      if (resolvedSrc instanceof HTMLVideoElement || resolvedSrc instanceof WebGLRenderTarget) {
        return () => {
          store.removeLayerEntry(layerEntry)
          //the session already invalidated the layer; layer.destroy() would throw, so just drop the reference
          if (store.getState().session != null) {
            layer.destroy()
          }
        }
      }
      const cleanupXRImageLayer = setupXRImageLayer(renderer, store, layer, resolvedSrc)
      return () => {
        store.removeLayerEntry(layerEntry)
        cleanupXRImageLayer()
        //the session already invalidated the layer; layer.destroy() would throw, so just drop the reference
        if (store.getState().session != null) {
          layer.destroy()
        }
      }
    }, [
      originReferenceSpace,
      colorFormat,
      depthFormat,
      invertStereo,
      layerEntryRef,
      layout,
      mipLevels,
      pixelHeight,
      pixelWidth,
      dpr,
      renderTargetRef,
      renderer,
      shape,
      src,
      store,
    ])
    useEffect(
      () =>
        store.subscribe((state, prevState) => {
          if (prevState.session == null || state.session != null) {
            return
          }
          //the session already invalidated the layer; drop the stale reference before it gets read again
          if (layerEntryRef.current != null) {
            store.removeLayerEntry(layerEntryRef.current)
            layerEntryRef.current = undefined
          }
        }),
      [store, layerEntryRef],
    )

    //update render order
    if (layerEntryRef.current != null) {
      layerEntryRef.current.renderOrder = renderOrder
    }

    //update layer properties
    if (layerEntryRef.current != null) {
      updateXRLayerProperties(layerEntryRef.current.layer, layerPropertiesRef.current)
    }

    //update layer transform
    useFrame(() => {
      if (layerEntryRef.current == null || internalRef.current == null) {
        return
      }
      updateXRLayerTransform(
        store.getState(),
        layerEntryRef.current.layer,
        layerPropertiesRef.current.centralAngle,
        internalRef.current,
      )
    })

    useImperativeHandle(ref, () => internalRef.current!, [])
    return (
      <mesh {...props} renderOrder={-Infinity} ref={internalRef}>
        <meshBasicMaterial colorWrite={false} />
      </mesh>
    )
  },
)

export const FallbackXRLayerImplementation = forwardRef<
  Mesh,
  Omit<XRLayerProperties, 'src'> & {
    src?: Exclude<XRLayerSrc, WebGLRenderTarget>
    geometry?: BufferGeometry
    pixelWidth: number
    pixelHeight: number
    dpr: number
    renderTargetRef: MutableRefObject<WebGLRenderTarget | undefined>
  }
>(({ src, renderTargetRef, dpr, renderOrder, pixelWidth, pixelHeight, ...props }, ref) => {
  const materialRef = useRef<MeshBasicMaterial>(null)
  useEffect(() => {
    if (materialRef.current == null) {
      return
    }
    const resolvedSrc = src ?? (renderTargetRef.current = createXRLayerRenderTarget(pixelWidth, pixelHeight, dpr))
    const texture = getXRLayerSrcTexture(resolvedSrc)
    materialRef.current.map = texture
    materialRef.current.needsUpdate = true
    return () => {
      if (resolvedSrc instanceof WebGLRenderTarget) {
        resolvedSrc.dispose()
        return
      }
      texture.dispose()
    }
  }, [src, pixelWidth, pixelHeight, dpr, renderTargetRef])
  return (
    <mesh ref={ref} {...props}>
      <meshBasicMaterial ref={materialRef} toneMapped={false} />
    </mesh>
  )
})

function useForwardEvents(store: UseBoundStore<StoreApi<RootState>>, ref: RefObject<Mesh | null>, deps: Array<any>) {
  useEffect(() => {
    const { current } = ref
    if (current == null) {
      return
    }
    let cleanup: (() => void) | undefined
    const update = (state: RootState, prevState?: RootState) => {
      if (state.camera === prevState?.camera && state.scene === prevState.scene) {
        return
      }
      cleanup?.()
      const { destroy, update } = forwardObjectEvents(current, () => state.camera, state.scene)
      const cleanupUpdate = addEffect(update)
      cleanup = () => {
        destroy()
        cleanupUpdate()
      }
    }
    update(store.getState())
    const unsubscribe = store.subscribe(update)
    return () => {
      unsubscribe()
      cleanup?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, ref, ...deps])
}

// Keys that shouldn't be copied between R3F stores
export const privateKeys = [
  'set',
  'get',
  'setSize',
  'setFrameloop',
  'setDpr',
  'events',
  'invalidate',
  'advance',
  'size',
  'viewport',
]

export function useLayerStore(width: number, height: number, dpr: number) {
  const previousRoot = useStore()
  const layerStore = useMemo(() => {
    let previousState = previousRoot.getState()
    // We have our own camera in here, separate from the main scene.
    const camera = new PerspectiveCamera(50, 1, 0.1, 1000)
    camera.position.set(0, 0, 5)
    const pointer = new Vector2()
    let ownState: Partial<RootState> = {
      events: { enabled: false, priority: 0 },
      size: { width: 1, height: 1, left: 0, top: 0 },
      camera,
      scene: new Scene(),
      raycaster: new Raycaster(),
      pointer: pointer,
      mouse: pointer,
      previousRoot,
    }
    //we now merge in order previousState, injectState, ownState
    const store = create<RootState & { setPreviousState: (prevState: RootState) => void }>((innerSet, get) => {
      const merge = () => {
        const result = {} as any
        for (const key in previousState) {
          if (privateKeys.includes(key)) {
            continue
          }
          result[key as keyof RootState] = previousState[key as keyof RootState] as never
        }
        return Object.assign(result, ownState, {
          events: { ...previousState.events, ...ownState.events },
          viewport: Object.assign(
            {},
            previousState.viewport,
            previousState.viewport.getCurrentViewport(camera, new Vector3(), ownState.size),
          ),
        })
      }
      const update = () => innerSet(merge())
      return {
        ...previousState,
        // Set and get refer to this root-state
        set(newOwnState: Partial<InjectState> | ((s: InjectState) => Partial<InjectState>)) {
          if (typeof newOwnState === 'function') {
            newOwnState = newOwnState(get())
          }
          Object.assign(ownState, newOwnState)
          update()
        },
        setPreviousState(prevState: RootState) {
          previousState = prevState
          update()
        },
        get,
        setEvents() {},
        ...merge(),
      }
    })
    return Object.assign(store, {
      setState(state: Partial<RootState>) {
        store.getState().set(state as any)
      },
    })
  }, [previousRoot])
  //syncing up previous store with the current store
  useEffect(() => previousRoot.subscribe(layerStore.getState().setPreviousState), [previousRoot, layerStore])
  useEffect(() => {
    const viewport: RootState['viewport'] = {
      factor: 1,
      distance: 0,
      dpr,
      initialDpr: dpr,
      left: 0,
      top: 0,
      getCurrentViewport: () => viewport,
      width,
      height,
      aspect: width / height,
    }

    layerStore.setState({
      size: { width, height, top: 0, left: 0 },
      viewport,
    })
  }, [width, height, dpr, layerStore, previousRoot])
  return layerStore
}

const v4Helper = new Vector4()

//required hack to support pmndrs/postprocessing
function getSize(this: WebGLRenderer, target: Vector2) {
  this.getViewport(v4Helper)
  target.x = v4Helper.z - v4Helper.x
  target.y = v4Helper.w - v4Helper.y
  return target
}

const viewportHelper = new Vector4()

function ChildrenToRenderTarget({
  renderPriority,
  children,
  layerEntryRef,
  renderTargetRef,
  store,
  customRender,
}: {
  renderPriority: number
  children: ReactNode
  layerEntryRef: RefObject<XRLayerEntry | undefined | null> | undefined
  renderTargetRef: RefObject<WebGLRenderTarget | undefined | null>
  store: UseBoundStore<StoreApi<RootState>>
  customRender?: (target: WebGLRenderTarget, state: RootState, delta: number, frame: XRFrame | undefined) => void
}) {
  useEffect(() => {
    const update = (state: RootState, prevState?: RootState) => {
      const { size, camera } = state
      if (camera instanceof OrthographicCamera) {
        camera.left = size.width / -2
        camera.right = size.width / 2
        camera.top = size.height / 2
        camera.bottom = size.height / -2
      } else {
        camera.aspect = size.width / size.height
      }
      if (size !== prevState?.size || camera !== prevState.camera) {
        camera.updateProjectionMatrix()
        // https://github.com/pmndrs/react-three-fiber/issues/178
        // Update matrix world since the renderer is a frame late
        camera.updateMatrixWorld()
      }
    }
    update(store.getState())
    return store.subscribe(update)
  }, [store])

  let oldAutoClear
  let oldXrEnabled
  let oldIsPresenting
  let oldRenderTarget
  let oldGetDrawingBufferSize: WebGLRenderer['getDrawingBufferSize']
  let oldGetSize: WebGLRenderer['getSize']
  //TODO: support frameloop="demand"
  useFrame((_, delta, frame: XRFrame | undefined) => {
    if (
      renderTargetRef.current == null ||
      (layerEntryRef != null && (layerEntryRef.current == null || frame == null))
    ) {
      return
    }
    const state = store.getState()
    const { gl, scene, camera } = state
    oldAutoClear = gl.autoClear
    oldXrEnabled = gl.xr.enabled
    oldIsPresenting = gl.xr.isPresenting
    oldRenderTarget = gl.getRenderTarget()
    oldGetSize = gl.getSize
    oldGetDrawingBufferSize = gl.getDrawingBufferSize
    gl.getViewport(viewportHelper)
    gl.autoClear = true
    gl.xr.enabled = false
    gl.xr.isPresenting = false
    const renderTarget = renderTargetRef.current
    gl.setViewport(0, 0, renderTarget.width, renderTarget.height)
    gl.getSize = getSize
    gl.getDrawingBufferSize = getSize
    setXRLayerRenderTarget(gl, renderTarget, layerEntryRef?.current, frame)
    if (customRender != null) {
      customRender(renderTarget, state, delta, frame)
    } else {
      gl.render(scene, camera)
    }
    gl.setRenderTarget(oldRenderTarget)
    gl.setViewport(viewportHelper)
    gl.autoClear = oldAutoClear
    gl.xr.enabled = oldXrEnabled
    gl.xr.isPresenting = oldIsPresenting
    gl.getSize = oldGetSize
    gl.getDrawingBufferSize = oldGetDrawingBufferSize
  }, renderPriority)
  return <>{reconciler.createPortal(<context.Provider value={store}>{children}</context.Provider>, store, null)}</>
}
