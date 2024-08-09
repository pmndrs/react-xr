import { WebXRManager } from 'three'
import { createHandPoseState, updateXRHandPoseState } from './pose.js'
import { XRHandLoaderOptions, getXRHandAssetPath } from './model.js'
import type { XRHandState } from '../input.js'

export type XRHandInputSource = XRInputSource & { hand: XRHand }

export function isXRHandInputSource(inputSource: XRInputSource): inputSource is XRHandInputSource {
  return inputSource.hand != null
}

export function createXRHandState(
  inputSource: XRInputSource,
  options: XRHandLoaderOptions | undefined,
  events: ReadonlyArray<XRInputSourceEvent>,
): XRHandState {
  return {
    type: 'hand',
    inputSource: inputSource as XRHandInputSource,
    pose: createHandPoseState(inputSource.hand!),
    assetPath: getXRHandAssetPath(inputSource.handedness, options),
    events,
  }
}

export function updateXRHandState(
  { inputSource, pose }: XRHandState,
  frame: XRFrame | undefined,
  manager: WebXRManager,
): void {
  updateXRHandPoseState(pose, frame, inputSource.hand, manager, inputSource.handedness)
}