import { requestXRAnchor, XRAnchorOptions } from '@pmndrs/xr'
import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useXRStore } from './xr.js'

export {
  requestXRAnchor,
  type XRAnchorOptions,
  //requestXRPersistentAnchor,
  //loadXRPersistentAnchor,
  //deleteXRPersistentAnchor,
} from '@pmndrs/xr'

/**
 * Hook that returns a function that allows to request a xr anchor
 */
export function useRequestXRAnchor() {
  const store = useXRStore()
  return useMemo(() => requestXRAnchor.bind(null, store), [store])
}

/**
 * hook that returns a function that allows to request a xr persistent anchor
 *
export function useRequestXRPersistentAnchor() {
  const store = useXRStore()
  return useMemo(() => requestXRPersistentAnchor.bind(null, store), [store])
}*/

/**
 * hook that returns a function that allows to load a xr persistent anchor
 *
export function useLoadXRPersistentAnchor() {
  const session = useXR((xr) => xr.session)
  return useMemo(() => (session != null ? loadXRPersistentAnchor.bind(null, session) : undefined), [session])
}*/

/**
 * hook that returns a function that allows to delete a xr persistent anchor
 *
export function useDeleteXRPersistentAnchor() {
  const store = useXRStore()
  return useMemo(() => deleteXRPersistentAnchor.bind(null, store), [store])
}*/

/*
export function useXRPersistentAnchor(
  id: string,
): [anchor: XRAnchor | undefined, createAnchor: (options: XRAnchorOptions) => Promise<XRAnchor | undefined>] {
  const cleanup = useRef<(() => void) | undefined>(() => {})
  const store = useXRStore()
  const session = useXR((xr) => xr.session)
  const [anchor, setAnchor] = useState<XRAnchor | undefined>(undefined)
  useEffect(() => {
    if (session == null) {
      return
    }
    cleanup.current?.()
    cleanup.current = undefined
    let cancelled = false
    cleanup.current = () => (cancelled = true)
    loadXRPersistentAnchor(session, id).then((anchor) => {
      if (cancelled) {
        anchor?.delete()
        return
      }
      cleanup.current = () => anchor?.delete()
      setAnchor(anchor)
    })
    return () => {
      cleanup.current?.()
      cleanup.current = undefined
    }
  }, [session, id])
  const create = useCallback(
    async (options: XRAnchorOptions) => {
      await deleteXRPersistentAnchor(store, id)
      cleanup.current?.()
      cleanup.current = undefined
      const abortRef = { current: false }
      cleanup.current = () => (abortRef.current = true)
      const anchor = await requestXRPersistentAnchor(store, id, options, abortRef)
      if (abortRef.current) {
        anchor?.delete()
        return undefined
      }
      cleanup.current = () => anchor?.delete()
      setAnchor(anchor)
      return anchor
    },
    [id, store],
  )
  return [anchor, create]
}*/

/**
 * hook for requesting and storing a single xr anchor
 */
export function useXRAnchor(): [
  anchor: XRAnchor | undefined,
  createAnchor: (options: XRAnchorOptions) => Promise<XRAnchor | undefined>,
] {
  const [anchor, setAnchor] = useState<XRAnchor | undefined>(undefined)
  const cleanup = useRef<(() => void) | undefined>(() => {})
  const store = useXRStore()
  const create = useCallback(
    async (options: XRAnchorOptions) => {
      cleanup.current?.()
      cleanup.current = undefined
      let cancelled = false
      cleanup.current = () => (cancelled = true)
      const anchor = await requestXRAnchor(store, options)
      if (cancelled) {
        anchor?.delete()
        return undefined
      }
      cleanup.current = () => anchor?.delete()
      setAnchor(anchor)
      return anchor
    },
    [store],
  )
  useEffect(() => () => void cleanup.current?.(), [])
  useEffect(
    () =>
      store.subscribe((state, prevState) => {
        if (prevState.session == null || state.session != null) {
          return
        }
        //the session already invalidated the anchor; anchor.delete() would throw, so just drop the reference
        cleanup.current = undefined
        setAnchor(undefined)
      }),
    [store],
  )
  return [anchor, create]
}
