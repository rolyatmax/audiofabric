const createCamera = require('3d-view-controls')

module.exports = function createRoamingCamera (canvas, center, eye) {
  let isRoaming = false
  // let timeout

  const camera = createCamera(canvas, {
    zoomSpeed: 4
  })

  camera.lookAt(
    center,
    eye,
    [0.52, -0.11, 50]
  )

  function getPositionFromRads (position, rads) {
    position[0] = Math.sin(rads) * 1.5
    position[1] = Math.cos(rads) * 2.7
    position[2] = (Math.sin(rads) * 0.5 + 0.5) * 3 + 0.5
    return position
  }

  // one revolution (6.28 rads) takes 75 seconds (or 4500 frames)
  // or 0.0014 rads per frame
  const startingSpeed = 0.0014 // rads per frame
  let currentRads = 0
  let cameraUp = new Float32Array(3)
  let currentPosition = getPositionFromRads(new Float32Array(3), currentRads)

  function start () {
    // temporarily disabling these until I figure out how to make the camera
    // gently start moving after an interaction - i think the gentle motion
    // of the camera is an important part of the visualization
    // canvas.addEventListener('mousedown', stopRoaming)
    // window.addEventListener('wheel', stopRoaming)
    isRoaming = true
  }

  function tick () {
    camera.tick()
    // very minor performance improvement by minimizing array creation in loop
    cameraUp[0] = camera.up[0]
    cameraUp[1] = camera.up[1]
    cameraUp[2] = 999
    camera.up = cameraUp

    if (isRoaming) {
      currentPosition = getPositionFromRads(currentPosition, currentRads)
      camera.center = currentPosition
      currentRads += startingSpeed
      currentRads %= (Math.PI * 2)
    }
  }
  function getMatrix () {
    return camera.matrix
  }
  function getCenter () {
    return camera.center
  }
  // function stopRoaming () {
  //   clearTimeout(timeout)
  //   timeout = null
  //   isRoaming = false
  // }

  window.camera = camera
  return {
    tick,
    start,
    getMatrix,
    getCenter
  }
}
