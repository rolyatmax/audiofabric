const glslify = require('glslify')

module.exports = function createTileManager (regl, tiles, settings) {
  // each tile in tiles is an array of 3 vec3 positions (each tile is a triangle)
  const tileStateTextureSize = Math.ceil(Math.sqrt(tiles.length * 3))
  console.log(`texture size: ${tileStateTextureSize} x ${tileStateTextureSize} for ${tiles.length} tiles`)
  const tileStateTextureLength = tileStateTextureSize * tileStateTextureSize
  const initialTileState = new Float32Array(tileStateTextureLength * 4)
  for (let i = 0; i < tiles.length; ++i) {
    const [point1, point2, point3] = tiles[i]
    // point 1
    initialTileState[i * 12] = point1[0] // x
    initialTileState[i * 12 + 1] = point1[1] // y
    initialTileState[i * 12 + 2] = point1[2] // z
    initialTileState[i * 12 + 3] = 0 // nothing

    // point 2
    initialTileState[i * 12 + 4] = point2[0] // x
    initialTileState[i * 12 + 5] = point2[1] // y
    initialTileState[i * 12 + 6] = point2[2] // z
    initialTileState[i * 12 + 7] = 0 // nothing

    // point 3
    initialTileState[i * 12 + 8] = point3[0] // x
    initialTileState[i * 12 + 9] = point3[1] // y
    initialTileState[i * 12 + 10] = point3[2] // z
    initialTileState[i * 12 + 11] = 0 // nothing
  }

  let prevTileStateTexture = createStateBuffer(initialTileState, tileStateTextureSize)
  let curTileStateTexture = createStateBuffer(initialTileState, tileStateTextureSize)
  let nextTileStateTexture = createStateBuffer(initialTileState, tileStateTextureSize)

  const dampening = 1.0
  const stiffness = 0.1

  let height = 0.5
  document.body.addEventListener('click', e => { height = Math.random() })

  const updateState = regl({
    framebuffer: () => nextTileStateTexture,

    vert: glslify.file('./tile-state.vert'),
    frag: glslify.file('./tile-state.frag'),

    attributes: {
      position: [
        -1, -1,
        1, -1,
        -1, 1,
        1, 1
      ]
    },

    uniforms: {
      curTileStateTexture: () => curTileStateTexture,
      prevTileStateTexture: () => prevTileStateTexture,
      // tileMetaDataTexture: tileMetaDataTexture,
      dampening: dampening,
      stiffness: stiffness,
      height: () => height
    },

    count: 4,
    primitive: 'triangle strip'
  })

  function tick (context) {
    cycleStates()
    updateState()
  }

  function getStateTexture () {
    return curTileStateTexture
  }

  function getTextureSize () {
    return tileStateTextureSize
  }

  return {
    tick,
    getTextureSize,
    getStateTexture
  }

  function createStateBuffer (initialState, textureSize) {
    console.log(initialState)
    const initialTexture = regl.texture({
      data: initialState,
      shape: [textureSize, textureSize, 4],
      type: 'float'
    })
    return regl.framebuffer({
      color: initialTexture,
      depth: false,
      stencil: false
    })
  }

  function cycleStates () {
    const tmp = prevTileStateTexture
    prevTileStateTexture = curTileStateTexture
    curTileStateTexture = nextTileStateTexture
    nextTileStateTexture = tmp
  }
}
