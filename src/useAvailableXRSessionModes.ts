import { useEffect, useState } from "react"
import { XRSessionMode } from "three"
import { Navigator } from "webxr"

declare let navigator: Navigator

export const AllXRSessionModes: Array<XRSessionMode> = ["immersive-ar", "immersive-vr", "inline"]

export function useAvailableXRSessionModes(
    interestedXRSessionModes?: Array<XRSessionMode>
): undefined | Array<XRSessionMode> {
    const [availableXrSessionModes, setAvailableXrSessionModes] = useState<undefined | Array<XRSessionMode>>(undefined)

    useEffect(() => {
        getAvalailableXRSessionModes(interestedXRSessionModes).then(setAvailableXrSessionModes).catch(console.error)
    }, [interestedXRSessionModes])
    return availableXrSessionModes
}

export function getAvalailableXRSessionModes(
    interestedXRSessionModes?: Array<XRSessionMode>
): Promise<Array<XRSessionMode>> {
    return Promise.all(
        (interestedXRSessionModes ?? AllXRSessionModes).map((sessionType) =>
            isXRSessionModeSupported(sessionType).then((result) => [sessionType, result] as [XRSessionMode, boolean])
        )
    ).then((results) => results.filter(([_, supported]) => supported).map(([xrSessionMode]) => xrSessionMode))
}

export function isXRSessionModeSupported(sessionMode: XRSessionMode): Promise<boolean> {
    if ("xr" in navigator) {
        return navigator.xr
            .isSessionSupported(sessionMode)
            .then((supported: boolean) => supported)
            .catch(() => false)
    }
    return Promise.resolve(false)
}
