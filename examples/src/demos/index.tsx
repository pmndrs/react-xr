import { lazy } from 'react'

const Interactive = { Component: lazy(() => import('./Interactive')) }
const HitTest = { Component: lazy(() => import('./HitTest')) }
const Player = { Component: lazy(() => import('./Player')) }
const Text = { Component: lazy(() => import('./Text')) }
const Hands = { Component: lazy(() => import('./Hands')) }
const Teleport = { Component: lazy(() => import('./Teleport')) }

export { Interactive, HitTest, Player, Text, Hands, Teleport }
