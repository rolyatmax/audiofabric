const glsl = require('glslify')
const { createSpring } = require('spring-animator')

let linesOffsetsLoopToken
let lines = []

module.exports = function createRenderGrid (regl, settings) {
  lines = []

  for (let j = 1; j < settings.gridLines; j++) {
    lines.push({
      axis: 'x',
      offset: createSpring(settings.linesDampening, settings.linesStiffness, j / settings.gridLines * 2 - 1)
    })
    lines.push({
      axis: 'y',
      offset: createSpring(settings.linesDampening, settings.linesStiffness, j / settings.gridLines * 2 - 1)
    })
  }

  function getLinesPositions (linesPositions, lines) {
    const granularity = 50 // settings.gridLines
    linesPositions = linesPositions || new Float32Array(lines.length * granularity * 2)
    let k = 0
    for (let line of lines) {
      const nextOffset = line.offset.tick(1, false)
      for (let q = 0; q < granularity; q++) {
        const t = q / granularity * 2 - 1
        const nextT = (q + 1) / granularity * 2 - 1
        linesPositions[k++] = line.axis === 'x' ? nextOffset : t
        linesPositions[k++] = line.axis === 'y' ? nextOffset : t

        linesPositions[k++] = line.axis === 'x' ? nextOffset : nextT
        linesPositions[k++] = line.axis === 'y' ? nextOffset : nextT
      }
    }
    return linesPositions
  }

  const linesPositions = getLinesPositions([], lines)
  const linesBuffer = regl.buffer(linesPositions)
  const render = regl({
    vert: glsl`
      attribute vec2 position;

      varying vec4 fragColor;

      uniform sampler2D frequencyVals;
      uniform vec2 resolution;
      uniform mat4 projection;
      uniform mat4 view;
      uniform float gridMaxHeight;
      uniform float multiplier;

      void main() {
        vec2 lookup = (position + 1.0) / 2.0;
        float frequencyVal = texture2D(frequencyVals, lookup).x;
        vec3 rgb = clamp(sin((vec3(frequencyVal) + vec3(0.1, 0.3, 0.5)) * 1.9), 0.0, 0.95);
        float opacity = clamp(pow(frequencyVal * 1.5, 2.0), 0.0, 0.95) * multiplier;
        fragColor = vec4(rgb, opacity);
        gl_Position = projection * view * vec4(position.xy, frequencyVal * gridMaxHeight * multiplier, 1);
      }
    `,
    frag: glsl`
      precision highp float;
      varying vec4 fragColor;
      void main() {
        gl_FragColor = fragColor;
      }
    `,
    uniforms: {
      frequencyVals: regl.prop('frequencyVals'),
      gridMaxHeight: regl.prop('gridMaxHeight'),
      multiplier: regl.prop('multiplier')
    },
    blend: {
      enable: true,
      func: {
        srcRGB: 'src alpha',
        srcAlpha: 1,
        dstRGB: 'one minus src alpha',
        dstAlpha: 1
      },
      equation: {
        rgb: 'add',
        alpha: 'add'
      }
    },
    attributes: {
      position: linesBuffer
    },
    count: linesPositions.length / 2,
    primitive: 'lines'
  })

  clearTimeout(linesOffsetsLoopToken)
  linesOffsetsLoopToken = setTimeout(setLinesOffsetsLoop, 15000)

  let calls = 0
  function setLinesOffsets () {
    let xVal = 1
    let yVal = 1
    calls += 1
    calls = calls % 2
    // lines.sort((a, b) => {
    //   return a.offset.tick(1, false) > b.offset.tick(1, false) ? 1 : -1
    // })
    const randomGranularity = ((Math.random() * 10 | 0) + 1) / 5
    lines.forEach((line, i) => {
      let nextVal
      if (calls === 0) {
        nextVal = ((line.axis === 'x' ? xVal++ : yVal++) / settings.gridLines * 2 - 1) * randomGranularity
      } else if (calls === 1) {
        nextVal = Math.random() * 2 - 1
      } else {
        nextVal = (line.axis === 'x' ? xVal++ : yVal++) / settings.gridLines * 2 - 1
      }

      setTimeout(() => {
        line.offset.updateValue(nextVal)
      }, i * settings.linesAnimationOffset)
    })
  }

  function setLinesOffsetsLoop () {
    setTimeout(() => {
      clearTimeout(linesOffsetsLoopToken)
      setLinesOffsets()
      linesOffsetsLoopToken = setLinesOffsetsLoop()
    }, 9500)
  }

  return function ({ frequencyVals, gridMaxHeight, multiplier }) {
    getLinesPositions(linesPositions, lines)
    linesBuffer(linesPositions)
    for (let line of lines) {
      line.offset.tick()
    }
    render({ frequencyVals, gridMaxHeight, multiplier })
  }
}
