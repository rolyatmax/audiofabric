const createRegl = require('regl')
const glsl = require('glslify')
const mat4 = require('gl-mat4')
const createCamera = require('3d-view-controls')
const css = require('dom-css')
const fit = require('canvas-fit')
const { GUI } = require('dat-gui')
const array = require('new-array')
const shuffle = require('shuffle-array')
const Alea = require('alea')
const { createSpring } = require('spring-animator')
const Delaunator = require('delaunator')
const createAnalyser = require('web-audio-analyser')
const createAudioControls = require('./audio-controls')
const createRenderBloom = require('./render-bloom')
const createRenderBlur = require('./render-blur')
const createRenderGrid = require('./render-grid')
const createRenderParticles = require('./render-particles')

const canvas = document.body.appendChild(document.createElement('canvas'))
window.addEventListener('resize', fit(canvas), false)
const camera = createCamera(canvas)
const regl = createRegl(canvas)

camera.zoomSpeed = 4
camera.lookAt(
  [2.5, 2.5, 2.5],
  [0, 0, 0],
  [0.52, -0.11, 50]
)

let analyser, delaunay, points, positions, positionsBuffer, renderFrequencies,
  renderGrid, renderParticles, gridMultiplier, particlesMultiplier
const fbo = regl.framebuffer({
  color: regl.texture({
    shape: [512, 512, 4]
  }),
  depth: false,
  stencil: false
})
const freqMapFBO = regl.framebuffer({
  color: regl.texture({
    shape: [512, 512, 4]
  }),
  depth: false,
  stencil: false
})
const blurredFbo = regl.framebuffer({
  color: regl.texture({
    shape: [canvas.width, canvas.height, 4]
  }),
  depth: false,
  stencil: false
})
const renderToFBO = regl({ framebuffer: fbo })
const renderToFreqMapFBO = regl({ framebuffer: freqMapFBO })
const renderToBlurredFBO = regl({ framebuffer: blurredFbo })
const renderBloom = createRenderBloom(regl, canvas)
const renderBlur = createRenderBlur(regl)

const tracks = [
  {title: 'Another New World', path: 'src/audio/01-Another_New_World.mp3'},
  {title: '715 - CRΣΣKS', path: 'src/audio/03-715-Creeks.mp3'},
  {title: 'The Wilder Sun', path: 'src/audio/01-The_Wilder_Sun.mp3'},
  // 'src/audio/12-Richter_On_The_Nature_Of_Daylight.mp3',
  {title: 'Lost It To Trying', path: 'src/audio/02-Lost_It_To_Trying.mp3'},
  {title: 'Adagio for Strings', path: 'src/audio/08-Adagio_for_Strings.mp3'}

  // these weren't great options
  // 'src/audio/02-Go_out_and_Love_Someone.mp3', // :-(
  // 'src/audio/04-33_GOD_.mp3',
  // 'src/audio/06-666(upsidedowncross).mp3',
  // 'src/audio/09-45.mp3',
  // 'src/audio/01-22(Over_Soon).mp3',
  // 'src/audio/03-715-Creeks.mp3',
  // 'src/audio/05-29Strafford Apts.mp3',
  // 'src/audio/07-21Moon Water.mp3',
  // 'src/audio/re-stacks.mp3',
  // 'src/audio/08-8(circle).mp3',
  // 'src/audio/10-1000000Million.mp3',
  // 'src/audio/02-10Death_Breast.mp3'
]
setupAudio(tracks).then((audioAnalyser) => {
  analyser = audioAnalyser
  analyser.analyser.fftSize = 1024 * 2
  analyser.analyser.minDecibels = -75
  analyser.analyser.maxDecibels = -30
  analyser.analyser.smoothingTimeConstant = 0.5
  setup()
  start()
})

const settings = guiSettings({
  seed: [0, 0, 9999, 1, true],
  points: [2800, 600, 6000, 1, true],
  dampening: [0.35, 0.01, 1, 0.01, true],
  stiffness: [0.55, 0.01, 1, 0.01, true],
  linesDampening: [0.02, 0.01, 1, 0.01, true],
  linesStiffness: [0.9, 0.01, 1, 0.01, true],
  linesAnimationOffset: [20, 0, 100, 1, true],
  freqPow: [1.7, 0.01, 3, 0.01],
  connectedNeighbors: [4, 0, 10, 1, true],
  neighborWeight: [0.99, 0, 1, 0.01],
  connectedBinsStride: [1, 1, 12, 1, true], // make this a numFrequencyNodes setting or something
  blurAngle: [0.25, 0, 1, 0.01],
  blurMag: [7, 0, 20, 1],
  blurRadius: [1, 0, 20, 1],
  blurWeight: [1.1, 0, 2, 0.01],
  originalWeight: [1.2, 0, 2, 0.01],
  gridLines: [100, 1, 200, 1, true],
  gridMaxHeight: [0.28, 0.01, 2, 0.01],
  particles: [30000, 10, 50000, 1, true],
  roam: [true],
  toggleTreatment: [true]
}, setup)

function setup () {
  const rand = new Alea(settings.seed)
  points = []

  renderGrid = createRenderGrid(regl, settings)
  renderParticles = createRenderParticles(regl, settings)

  const damp = 0.05
  const stiff = 0.9
  gridMultiplier = createSpring(damp, stiff, 0)
  particlesMultiplier = createSpring(damp, stiff, 0)

  // fill up the points list with the freqency-tracking nodes
  const frequenciesCount = analyser.frequencies().length // 1024
  for (let q = 0; q < frequenciesCount; q += settings.connectedBinsStride) {
    const mag = Math.pow(rand(), 1 - q / frequenciesCount) * 0.9
    const rads = rand() * Math.PI * 2
    const position = [
      Math.cos(rads) * mag,
      Math.sin(rads) * mag
      // rand() * 2 - 1,
      // rand() * 2 - 1
    ]
    const id = points.length
    const point = createPoint(id, position)
    point.frequencyBin = q
    points.push(point)
  }

  array(Math.max(0, settings.points - points.length)).forEach((_, i) => {
    const id = points.length
    points.push(createPoint(id, [rand() * 2 - 1, rand() * 2 - 1]))
  })

  function createPoint (id, position) {
    return {
      position: position,
      id: id,
      neighbors: new Set(), // gonna fill this up with the results of delaunay
      spring: createSpring(settings.dampening, settings.stiffness, 0)
    }
  }

  delaunay = new Delaunator(points.map((pt) => pt.position))
  for (let j = 0; j < delaunay.triangles.length; j += 3) {
    const pt1 = delaunay.triangles[j]
    const pt2 = delaunay.triangles[j + 1]
    const pt3 = delaunay.triangles[j + 2]

    points[pt1].neighbors.add(pt2)
    points[pt1].neighbors.add(pt3)
    points[pt2].neighbors.add(pt1)
    points[pt2].neighbors.add(pt3)
    points[pt3].neighbors.add(pt1)
    points[pt3].neighbors.add(pt2)
  }

  points.forEach(pt => {
    pt.neighbors = shuffle(Array.from(pt.neighbors)).slice(0, settings.connectedNeighbors)
  })

  positions = new Float32Array(delaunay.triangles.length * 3)
  positionsBuffer = regl.buffer()

  renderFrequencies = regl({
    vert: glsl`
      attribute vec3 position;

      varying vec4 fragColor;

      void main() {
        float actualIntensity = position.z * 1.2;
        fragColor = vec4(vec3(actualIntensity), 1);
        gl_Position = vec4(position.xy, 0, 1);
      }
    `,
    frag: glsl`
      precision highp float;
      varying vec4 fragColor;
      void main() {
        gl_FragColor = fragColor;
      }
    `,
    attributes: {
      position: positionsBuffer
    },
    count: delaunay.triangles.length,
    primitive: 'triangles'
  })
}

function update () {
  const frequencies = analyser.frequencies()
  points.forEach(pt => {
    let value = 0
    if (pt.frequencyBin || pt.frequencyBin === 0) {
      value = Math.pow(frequencies[pt.frequencyBin] / 255, settings.freqPow) // max bin value
    }
    const neighbors = pt.neighbors
    const neighborSum = neighbors.reduce((total, ptID) => {
      return total + points[ptID].spring.tick(1, false)
    }, 0)
    const neighborAverage = neighbors.length ? neighborSum / neighbors.length : 0
    value = Math.max(value, neighborAverage * settings.neighborWeight)

    pt.spring.updateValue(value)
    pt.spring.tick()
  })

  for (let j = 0; j < delaunay.triangles.length; j++) {
    const ptIndex = delaunay.triangles[j]
    const point = points[ptIndex]
    positions[j * 3] = point.position[0]
    positions[j * 3 + 1] = point.position[1]
    positions[j * 3 + 2] = point.spring.tick(1, false)
  }

  positionsBuffer(positions)
}

const renderGlobals = regl({
  uniforms: {
    projection: ({viewportWidth, viewportHeight}) => mat4.perspective(
      [],
      Math.PI / 4,
      viewportWidth / viewportHeight,
      0.01,
      1000
    ),
    view: () => camera.matrix,
    eye: () => camera.eye,
    time: ({ time }) => time
  }
})

function start () {
  regl.frame(({ time }) => {
    camera.tick()
    camera.up = [camera.up[0], camera.up[1], 999]
    if (settings.roam) {
      camera.center = [
        Math.sin(time / 12) * 2.5,
        Math.cos(time / 12) * 4.5,
        (Math.sin(time / 12) * 0.5 + 0.5) * 3 + 0.5
      ]
    }
    update()
    renderToFBO(() => {
      regl.clear({
        color: [0, 0, 0, 1],
        depth: 1
      })
      renderFrequencies()
    })
    renderToFreqMapFBO(() => {
      regl.clear({
        color: [0, 0, 0, 1],
        depth: 1
      })
      const rads = settings.blurAngle * Math.PI
      const direction = [
        Math.cos(rads) * settings.blurMag,
        Math.sin(rads) * settings.blurMag
      ]
      renderBlur({
        iChannel0: fbo,
        direction: direction
      })
    })
    renderToBlurredFBO(() => {
      regl.clear({
        color: [0.18, 0.18, 0.18, 0.99],
        depth: 1
      })
      renderGlobals(() => {
        gridMultiplier.updateValue(settings.toggleTreatment ? 1 : 0)
        particlesMultiplier.updateValue(settings.toggleTreatment ? 0 : 1)
        renderGrid({
          frequencyVals: freqMapFBO,
          gridMaxHeight: settings.gridMaxHeight,
          multiplier: gridMultiplier.tick()
        })
        renderParticles({
          frequencyVals: freqMapFBO,
          multiplier: particlesMultiplier.tick()
        })
      })
    })

    renderBloom({
      iChannel0: blurredFbo,
      blurMag: settings.blurRadius,
      blurWeight: settings.blurWeight,
      originalWeight: settings.originalWeight
    })
  })
}

// ///// helpers (to abstract down the line?) //////

function setupAudio (tracks) {
  const audio = new window.Audio()
  audio.crossOrigin = 'Anonymous'
  const audioControls = createAudioControls(audio, tracks)

  document.body.appendChild(audioControls.el)

  window.requestAnimationFrame(loop)
  function loop () {
    window.requestAnimationFrame(loop)
    audioControls.tick()
  }

  return new Promise((resolve, reject) => {
    audio.addEventListener('canplay', function onLoad () {
      audio.removeEventListener('canplay', onLoad)
      const analyser = createAnalyser(audio, { audible: true, stereo: false })
      resolve(analyser)
    })
  })
}

function guiSettings (settings, onChange) {
  const settingsObj = {}
  const gui = new GUI()
  css(gui.domElement.parentElement, { zIndex: 11 })
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
