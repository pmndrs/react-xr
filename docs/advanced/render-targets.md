---
title: Render Targets
description: How to render offscreen content to a render target while an XR session is active
nav: 23
---

Rendering to a `WebGLRenderTarget` during an immersive XR session needs one extra step compared to a non-XR render loop. Three.js replaces the active camera and framebuffer while `gl.xr.enabled` and `gl.xr.isPresenting` are active, so an offscreen pass should temporarily disable XR rendering, render into the target, and then restore the previous renderer state.

The important part is to save and restore the render target, viewport, and XR flags around the offscreen render:

```tsx
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo } from 'react'
import { PerspectiveCamera, Scene, Vector4, WebGLRenderTarget } from 'three'

const viewport = new Vector4()

function RenderTargetPass() {
  const { gl } = useThree()

  const target = useMemo(() => new WebGLRenderTarget(1024, 1024), [])
  const scene = useMemo(() => new Scene(), [])
  const camera = useMemo(() => new PerspectiveCamera(50, 1, 0.1, 100), [])

  useFrame(() => {
    const previousTarget = gl.getRenderTarget()
    const previousXrEnabled = gl.xr.enabled
    const previousIsPresenting = gl.xr.isPresenting

    gl.getViewport(viewport)

    gl.xr.enabled = false
    gl.xr.isPresenting = false
    gl.setRenderTarget(target)
    gl.setViewport(0, 0, target.width, target.height)
    gl.render(scene, camera)

    gl.setRenderTarget(previousTarget)
    gl.setViewport(viewport)
    gl.xr.enabled = previousXrEnabled
    gl.xr.isPresenting = previousIsPresenting
  })

  return null
}
```

If you are rendering content for an `XRLayer`, prefer the layer API instead of wiring this manually. `XRLayer` accepts children for dynamic content and uses the same state-preserving offscreen render pattern internally.

```tsx
<XRLayer position={[0, 1.5, -0.5]} scale={0.5}>
  <mesh>
    <boxGeometry />
    <meshBasicMaterial color="red" />
  </mesh>
</XRLayer>
```

Use a manual render target when you need the resulting texture for a material, post-processing pass, portal, minimap, or another non-layer effect. Use `XRLayer` when the goal is to display high-quality flat, cylinder, or equirect content in XR.
