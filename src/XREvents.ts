import React from 'react'
import { XRController } from './XRController'
import { useXR } from './XR'

export interface XREvent {
  originalEvent: any
  controller: XRController
}

export type XREventType = 'select' | 'selectstart' | 'selectend' | 'squeeze' | 'squeezestart' | 'squeezeend'

export function useXREvent(event: XREventType, handler: (e: XREvent) => any, handedness?: XRHandedness) {
  const handlerRef = React.useRef<(e: XREvent) => any>(handler)
  React.useEffect(() => void (handlerRef.current = handler), [handler])
  const allControllers = useXR((state) => state.controllers)

  React.useEffect(() => {
    const controllers = handedness ? allControllers.filter((it) => it.inputSource.handedness === handedness) : allControllers

    const cleanups: any[] = []

    controllers.forEach((it) => {
      const listener = (e: any) => handlerRef.current({ originalEvent: e, controller: it })
      it.controller.addEventListener(event, listener)
      cleanups.push(() => it.controller.removeEventListener(event, listener))
    })

    return () => cleanups.forEach((fn) => fn())
  }, [event, allControllers, handedness])
}
