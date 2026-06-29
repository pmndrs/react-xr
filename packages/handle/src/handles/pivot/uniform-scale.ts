import { BoxGeometry, ColorRepresentation, Mesh, MeshBasicMaterial } from 'three'
import { HandlesContext } from '../context.js'
import { HandlesProperties } from '../index.js'
import { handleXRayMaterialProperties, setupHandlesContextHoverMaterial } from '../material.js'
import { RegisteredHandle } from '../registered.js'
import { extractHandleTransformOptions } from '../utils.js'

export class PivotUniformScaleHandle extends RegisteredHandle {
  constructor(context: HandlesContext, tagPrefix: string) {
    super(context, 'xyz', tagPrefix, () => ({
      scale: { uniform: true, ...this.options },
      rotate: false,
      translate: 'as-scale',
      multitouch: false,
    }))
  }

  bind(defaultColor: ColorRepresentation, config?: HandlesProperties) {
    const { options, disabled } = extractHandleTransformOptions('xyz', config)
    if (options === false) {
      return undefined
    }
    this.options = options
    const material = new MeshBasicMaterial(handleXRayMaterialProperties)
    const cleanupHover = setupHandlesContextHoverMaterial(this.context, material, this.tag, {
      color: defaultColor,
      hoverColor: 0xffff40,
      disabled,
    })

    const mesh = new Mesh(new BoxGeometry(0.08, 0.08, 0.08), material)
    mesh.renderOrder = Infinity
    mesh.pointerEventsOrder = Infinity
    mesh.position.set(0.5, 0.5, 0.5)

    const unregister = disabled ? undefined : this.context.registerHandle(this.store, mesh, this.tag)

    this.add(mesh)

    return () => {
      material.dispose()
      mesh.geometry.dispose()
      unregister?.()
      cleanupHover?.()
      this.remove(mesh)
    }
  }
}
