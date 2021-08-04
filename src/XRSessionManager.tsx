import React from "react"
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { WebXRManager, XRSession } from "three"
import { XRSessionMode, Navigator } from "webxr"

declare let navigator: Navigator

export type XRSessionManagerFunctions = {
    registerWebXRManager: (xr: WebXRManager) => () => void
    requestXRSession: (sessionMode: XRSessionMode, sessionInit?: any) => Promise<void>
    exitXRSession: () => Promise<void>
}

export const XRSessionFunctionsContext = createContext<XRSessionManagerFunctions>(null as any)

function useXRSessionFunctions() {
    const xrSessionFunctions = useContext(XRSessionFunctionsContext)
    if (xrSessionFunctions == null) {
        throw "can only be used inside a XRSessionManager"
    }
    return xrSessionFunctions
}

export function useRegisterWebXRManager() {
    return useXRSessionFunctions().registerWebXRManager
}

export function useRequestXRSession() {
    return useXRSessionFunctions().requestXRSession
}

export function useExitXRSession() {
    return useXRSessionFunctions().exitXRSession
}

export const XRSessionInfoContext = createContext<XRSessionInfo | undefined>(null as any)

export type XRSessionInfo = { session: XRSession; sessionMode: XRSessionMode; sessionInit?: any }

export type ImmersiveXRSessionMode = "immersive-vr" | "immersive-ar"

export function useXRSessionInfo() {
    return useContext(XRSessionInfoContext)
}

export function XRSessionManager({ children }: PropsWithChildren<any>) {
    const xrManagerRef = useRef<WebXRManager | undefined>(undefined)

    const [xrSessionInfo, setXRSessionInfo] = useState<XRSessionInfo | undefined>(undefined)

    const setSession = useCallback((session: XRSession | undefined) => {
        if (xrManagerRef.current && session) {
            xrManagerRef.current.setSession(session)
        }
    }, [])

    const xrSessionFunctions: XRSessionManagerFunctions = useMemo(
        () => ({
            exitXRSession: () => xrSessionInfo?.session.end() ?? Promise.reject("no xr session present"),
            registerWebXRManager: (manager) => {
                if (xrManagerRef.current != null) {
                    throw "cant have multiple WebXRManager in one XRSession"
                }
                xrManagerRef.current = manager
                setSession(xrSessionInfo?.session)
                return () => {
                    xrManagerRef.current = undefined
                }
            },
            requestXRSession: async (sessionMode, sessionInit) => {
                const session = (await navigator.xr.requestSession(sessionMode, sessionInit)) as any
                setSession(session)
                setXRSessionInfo({ session, sessionMode, sessionInit })
            },
        }),
        [setSession, xrSessionInfo]
    )

    const onExitXR = useCallback(() => setXRSessionInfo(undefined), [setXRSessionInfo])

    useEffect(() => {
        if (xrSessionInfo == null) {
            return
        }
        xrSessionInfo.session.addEventListener("end", onExitXR)
        return () => xrSessionInfo.session.removeEventListener("end", onExitXR)
    }, [xrSessionInfo, onExitXR])

    return (
        <XRSessionFunctionsContext.Provider value={xrSessionFunctions}>
            <XRSessionInfoContext.Provider value={xrSessionInfo}>{children}</XRSessionInfoContext.Provider>
        </XRSessionFunctionsContext.Provider>
    )
}
