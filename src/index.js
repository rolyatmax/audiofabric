const Alea = require('alea')
const SimplexNoise = require('simplex-noise')
const { GUI } = require('dat-gui')
const Delaunator = require('delaunator')
const createRegl = require('regl')
const glslify = require('glslify')
const fit = require('canvas-fit')
const mat4 = require('gl-mat4')
const vec2 = require('gl-vec2')
// const vec3 = require('gl-vec3')
// const getNormal = require('get-plane-normal')
const createTileManager = require('./create-tile-manager')
const createCamera = require('3d-view-controls')
// const array = require('new-array')

const canvas = document.createElement('canvas')
const camera = createCamera(canvas)
const regl = createRegl({
  extensions: 'OES_texture_float',
  canvas: canvas
})

camera.zoomSpeed = 4
camera.lookAt(
  [2.5, 2.5, 2.5],
  [0, 0, 0],
  [0.52, -0.11, 50]
)

window.camera = camera
window.addEventListener('resize', fit(canvas), false)
document.body.appendChild(canvas)

const settings = guiSettings({
  seed: [442, 0, 1000, 1, true],
  points: [80, 24, 50000, 1, true],
  minPtDistance: [0.5, 0.01, 0.5, 0.01, true],
  maxTileSideLen: [1, 0.001, 1, 0.001, true],
  roam: [false]
}, setup)

let drawTriangles, tileManager
setup()
function setup () {
  const rand = new Alea(settings.seed)
  const simplex = new SimplexNoise(rand)

  // create points
  const points = []
  // let failedTries = 0
  // const squaredMinDist = settings.minPtDistance * settings.minPtDistance
  // while (points.length < settings.points && failedTries < 50) {
  //   const rads = rand() * Math.PI * 2
  //   const mag = Math.pow(rand(), 0.5) / 2
  //   const x = Math.cos(rads) * mag
  //   const y = Math.sin(rads) * mag
  //   let failed = false
  //   for (let pt of points) {
  //     if (vec2.squaredDistance(pt, [x, y]) < squaredMinDist) {
  //       failed = true
  //       break
  //     }
  //   }
  //   if (!failed) {
  //     points.push([x, y])
  //   } else {
  //     failedTries += 1
  //   }
  // }
  const rowCount = Math.ceil(Math.sqrt(settings.points))
  let x = rowCount
  while (x--) {
    let y = rowCount
    while (y--) {
      points.push([
        x / rowCount * 2 - 1,
        y / rowCount * 2 - 1
      ])
    }
  }

  // create tiles from points
  const delaunay = new Delaunator(points)
  const tiles = []
  for (let i = 0; i < delaunay.triangles.length; i += 3) {
    const pt1 = points[delaunay.triangles[i]]
    const pt2 = points[delaunay.triangles[i + 1]]
    const pt3 = points[delaunay.triangles[i + 2]]
    if (
      vec2.distance(pt1, pt2) > settings.maxTileSideLen ||
      vec2.distance(pt2, pt3) > settings.maxTileSideLen ||
      vec2.distance(pt3, pt1) > settings.maxTileSideLen
    ) {
      continue
    }
    const upperCorner = [
      Math.min(pt1[0], pt2[0], pt3[0]),
      Math.min(pt1[1], pt2[1], pt3[1])
    ]
    const height = simplex.noise2D(upperCorner[0], upperCorner[1]) / 5
    if (rand() < 0.4) { continue }
    tiles.push([
      [pt1[0], pt1[1], height],
      [pt2[0], pt2[1], height],
      [pt3[0], pt3[1], height]
    ])
  }

  tileManager = createTileManager(regl, tiles, settings)

  // convert tiles into triangles into vertex attributes
  const attributes = {
    tileIndex: [],
    pointIndex: []
  }
  for (let i = 0; i < tiles.length; i++) {
    // top face
    attributes.tileIndex.push(i, i, i)
    attributes.pointIndex.push(
      0, 1, 2,
      2, 0, 1,
      1, 2, 0
    )

    // side A face
    attributes.tileIndex.push(i, i, i)
    attributes.pointIndex.push(
      0, 5, 3,
      3, 0, 5,
      5, 3, 0
    )

    attributes.tileIndex.push(i, i, i)
    attributes.pointIndex.push(
      0, 2, 5,
      5, 0, 2,
      2, 5, 0
    )

    // side B face
    attributes.tileIndex.push(i, i, i)
    attributes.pointIndex.push(
      2, 4, 5,
      5, 2, 4,
      4, 5, 2
    )
    attributes.tileIndex.push(i, i, i)
    attributes.pointIndex.push(
      2, 1, 4,
      4, 2, 1,
      1, 4, 2
    )

    // side C face
    attributes.tileIndex.push(i, i, i)
    attributes.pointIndex.push(
      1, 3, 4,
      4, 1, 3,
      3, 4, 1
    )
    attributes.tileIndex.push(i, i, i)
    attributes.pointIndex.push(
      1, 0, 3,
      3, 1, 0,
      0, 3, 1
    )
  }

  // debuggggg
  // attributes.position.slice(0, 21).forEach((pos, i) => {
  //   function getPos (p, isBase) {
  //     if (isBase) return [p[0], p[1], 0]
  //     return p
  //   }
  //   pos = getPos(pos, attributes.isBase[i])
  //   const adjPosA = getPos(attributes.adjacentPositionA[i], attributes.adjacentIsBaseA[i])
  //   const adjPosB = getPos(attributes.adjacentPositionB[i], attributes.adjacentIsBaseB[i])
  //   console.log(pos, adjPosA, adjPosB, getNormal([], pos, adjPosA, adjPosB))
  // })

  drawTriangles = regl({
    vert: glslify.file('./tiles.vert'),
    frag: glslify.file('./tiles.frag'),
    attributes: attributes,
    count: attributes.tileIndex.length
  })
}

const drawGlobal = regl({
  uniforms: {
    projection: ({viewportWidth, viewportHeight}) => (
      mat4.perspective([],
        Math.PI / 8,
        viewportWidth / viewportHeight,
        0.01,
        1000)
    ),
    view: () => camera.matrix,
    lightSource: [5, 5, 5],
    tick: ({ tick }) => tick,
    tileState: () => tileManager.getStateTexture(),
    textureSize: () => tileManager.getTextureSize()
  },

  primitive: 'triangles'
})

regl.frame(({ time }) => {
  regl.clear({
    color: [0.95, 0.95, 0.95, 1],
    depth: 1
  })
  camera.tick()
  camera.up = [camera.up[0], camera.up[1], 999]
  tileManager.tick()
  if (settings.roam) {
    camera.center = [
      Math.sin(time / 4) * 2.5 + 2.5,
      Math.cos(time / 4) * 2.5 + 2.5,
      (Math.sin(time / 4) + 1.5) * 2.5
    ]
  }
  drawGlobal(() => drawTriangles())
})

// ------------- helpers -------------

function guiSettings (settings, onChange) {
  const settingsObj = {}
  const gui = new GUI()
  for (let key in settings) {
    settingsObj[key] = settings[key][0]
    const setting = gui
      .add(settingsObj, key, settings[key][1], settings[key][2])
    if (settings[key][3]) {
      setting.step(settings[key][3])
    }
    if (settings[key][4]) {
      setting.onChange(onChange)
    }
  }
  return settingsObj
}
