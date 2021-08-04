import React, { ButtonHTMLAttributes } from 'react'
import { forwardRef } from 'react'
import { XRSessionMode } from 'webxr'
import { useRequestXRSession } from '.'

export const XRButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { sessionMode: XRSessionMode; sessionInit?: any }
>(({ sessionMode, sessionInit, ...props }, ref) => {
  const enterSession = useRequestXRSession()
  return <button ref={ref} {...props} onClick={() => enterSession(sessionMode, sessionInit)} />
})
