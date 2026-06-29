import { Group, Object3D, OrthographicCamera, PerspectiveCamera, Vector3, Vector3Tuple } from 'three'
import { PivotAxisScaleHandle } from './scale.js'
import { HandleOptions, HandleStore } from '../../store.js'
import { HandlesContext } from '../context.js'
import { HandlesProperties } from '../index.js'
import { computeHandlesScale } from '../utils.js'
import { PivotAxisRotationHandle } from './rotate.js'
import { AxisTranslateHandle } from '../translate/axis.js'
import { PlaneTranslateHandle } from '../translate/plane.js'
import { PivotUniformScaleHandle } from './uniform-scale.js'

const vectorHelper = new Vector3()

export class PivotHandlesHandles extends Group {
  public readonly scaleX: PivotAxisScaleHandle
  public readonly scaleY: PivotAxisScaleHandle
  public readonly scaleZ: PivotAxisScaleHandle
  public readonly scaleXYZ: PivotUniformScaleHandle

  public readonly rotationX: PivotAxisRotationHandle
  public readonly rotationY: PivotAxisRotationHandle
  public readonly rotationZ: PivotAxisRotationHandle

  public readonly translationX: AxisTranslateHandle
  public readonly translationY: AxisTranslateHandle
  public readonly translationZ: AxisTranslateHandle

  public readonly translationXY: PlaneTranslateHandle
  public readonly translationYZ: PlaneTranslateHandle
  public readonly translationXZ: PlaneTranslateHandle

  private xAxis = new Vector3()
  private yAxis = new Vector3()
  private zAxis = new Vector3()

  private xRotationAxis = new Vector3()
  private yRotationAxis = new Vector3()
  private zRotationAxis = new Vector3()

  constructor(
    private readonly context: HandlesContext,
    public size?: number,
    public fixed?: boolean,
  ) {
    super()
    this.scaleX = new PivotAxisScaleHandle(context, 'x', 's')
    this.add(this.scaleX)
    this.scaleY = new PivotAxisScaleHandle(context, 'y', 's')
    this.scaleY.rotation.z = Math.PI / 2
    this.add(this.scaleY)
    this.scaleZ = new PivotAxisScaleHandle(context, 'z', 's')
    this.scaleZ.rotation.y = -Math.PI / 2
    this.add(this.scaleZ)
    this.scaleXYZ = new PivotUniformScaleHandle(context, 's')
    this.add(this.scaleXYZ)
    this.rotationX = new PivotAxisRotationHandle(context, 'x', 'r', this.xRotationAxis)
    this.add(this.rotationX)
    this.rotationY = new PivotAxisRotationHandle(context, 'y', 'r', this.yRotationAxis)
    this.rotationY.rotation.z = -Math.PI / 2
    this.add(this.rotationY)
    this.rotationZ = new PivotAxisRotationHandle(context, 'z', 'r', this.zRotationAxis)
    this.rotationZ.rotation.y = Math.PI / 2
    this.add(this.rotationZ)
    this.translationX = new AxisTranslateHandle(context, 'x', 'ta', this.xAxis)
    this.add(this.translationX)
    this.translationY = new AxisTranslateHandle(context, 'y', 'ta', this.yAxis)
    this.translationY.rotation.z = Math.PI / 2
    this.add(this.translationY)
    this.translationZ = new AxisTranslateHandle(context, 'z', 'ta', this.zAxis)
    this.translationZ.rotation.y = -Math.PI / 2
    this.add(this.translationZ)
    this.translationXY = new PlaneTranslateHandle(context, 'xy', 'tp', [this.xAxis, this.yAxis])
    this.add(this.translationXY)
    this.translationYZ = new PlaneTranslateHandle(context, 'yz', 'tp', [this.yAxis, this.zAxis])
    this.translationYZ.rotation.y = -Math.PI / 2
    this.add(this.translationYZ)
    this.translationXZ = new PlaneTranslateHandle(context, 'xz', 'tp', [this.xAxis, this.zAxis])
    this.translationXZ.rotation.x = Math.PI / 2
    this.add(this.translationXZ)
  }

  update(camera: PerspectiveCamera | OrthographicCamera) {
    this.updateWorldMatrix(true, false)
    const target = this.context.getTarget()
    if (target != null) {
      computeLocalAxis(this.xAxis, target, undefined, 1, 0, 0)
      computeLocalAxis(this.yAxis, target, undefined, 0, 1, 0)
      computeLocalAxis(this.zAxis, target, undefined, 0, 0, 1)

      computeLocalAxis(this.xRotationAxis, target, this.rotationX.store, 1, 0, 0)
      computeLocalAxis(this.yRotationAxis, target, this.rotationY.store, 0, 1, 0)
      computeLocalAxis(this.zRotationAxis, target, this.rotationZ.store, 0, 0, 1)
    }

    this.scale.setScalar(1)
    if (target != null) {
      target.getWorldScale(vectorHelper)
      this.scale.divide(vectorHelper)
    }
    this.scale.multiplyScalar(computeHandlesScale(this, camera, this.fixed ?? true, this.size ?? 1))
  }

  bind(translation?: HandlesProperties, rotation?: HandlesProperties, scale?: HandlesProperties) {
    const unbindScaleX = this.scaleX.bind(0xff2060, scale)
    const unbindScaleY = this.scaleY.bind(0x20df80, scale)
    const unbindScaleZ = this.scaleZ.bind(0x2080ff, scale)
    const unbindScaleXYZ = this.scaleXYZ.bind(0xffffff, scale)
    const unbindRotationX = this.rotationX.bind(0xff2060, rotation)
    const unbindRotationY = this.rotationY.bind(0x20df80, rotation)
    const unbindRotationZ = this.rotationZ.bind(0x2080ff, rotation)
    const unbindTranslationX = this.translationX.bind(0xff2060, 0xffff40, translation)
    const unbindTranslationY = this.translationY.bind(0x20df80, 0xffff40, translation)
    const unbindTranslationZ = this.translationZ.bind(0x2080ff, 0xffff40, translation)
    const unbindTranslationXY = this.translationXY.bind(0xff2060, 0xffff40, translation)
    const unbindTranslationYZ = this.translationYZ.bind(0x2080ff, 0xffff40, translation)
    const unbindTranslationXZ = this.translationXZ.bind(0x20df80, 0xffff40, translation)
    return () => {
      unbindScaleX?.()
      unbindScaleY?.()
      unbindScaleZ?.()
      unbindScaleXYZ?.()
      unbindRotationX?.()
      unbindRotationY?.()
      unbindRotationZ?.()
      unbindTranslationX?.()
      unbindTranslationY?.()
      unbindTranslationZ?.()
      unbindTranslationXY?.()
      unbindTranslationYZ?.()
      unbindTranslationXZ?.()
    }
  }
}

export class PivotHandles extends Group {
  public readonly handles: PivotHandlesHandles
  private readonly context: HandlesContext

  constructor(getOptions?: () => HandleOptions<unknown>) {
    super()
    this.context = new HandlesContext(this, getOptions)
    this.handles = new PivotHandlesHandles(this.context)
    this.add(this.handles)
  }

  update(time: number, camera: PerspectiveCamera | OrthographicCamera) {
    this.context.update(time)
    this.handles.update(camera)
  }

  bind(translation?: HandlesProperties, rotation?: HandlesProperties, scale?: HandlesProperties) {
    return this.handles.bind(translation, rotation, scale)
  }
}

function computeLocalAxis(
  target: Vector3,
  object: Object3D,
  handleStore: HandleStore<unknown> | undefined,
  ...[x, y, z]: Vector3Tuple
) {
  if (handleStore?.getState() != null) {
    return
  }

  target.set(x, y, z)
  target.applyQuaternion(object.quaternion)
}

export * from './rotate.js'
export * from './scale.js'
export * from './uniform-scale.js'
