import { useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useXRControllerState, XROrigin } from '@react-three/xr'

export function VRPlayerControl({ playerJump, playerMove }) {
  const
    controller_left = useXRControllerState('left'),
    controller_right = useXRControllerState('right')

  let gamepad_info = {
    connected_right: false,
    connected_left: false,
    thumbstick: null,
    a_button: null
  }

  useEffect(() => {
    if (controller_left && controller_left.gamepad) {
      gamepad_info.connected_left = true
      gamepad_info.thumbstick = controller_left.gamepad['xr-standard-thumbstick']
    }
    else {
      gamepad_info.connected_left = false
    }

    if (controller_right && controller_right.gamepad) {
      gamepad_info.connected_right = true
      gamepad_info.a_button = controller_right.gamepad['a-button']
    }
    else {
      gamepad_info.connected_right = false
    }
  }, [controller_left, controller_right])

  useFrame(state => {
    if (playerJump && gamepad_info.connected_right && gamepad_info.a_button.state === 'pressed') {
      playerJump()
    }

    if (playerMove && gamepad_info.connected_left) {
      playerMove({
        forward: gamepad_info.thumbstick.yAxis < 0,
        backward: gamepad_info.thumbstick.yAxis > 0,
        left: gamepad_info.thumbstick.xAxis < 0,
        right: gamepad_info.thumbstick.xAxis > 0,
        rotation: state.camera.rotation
      })
    }
  })

  return <XROrigin position={[0, -1.75, 0]} />
}