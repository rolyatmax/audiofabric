const glsl = require('glslify')
const array = require('new-array')

module.exports = function createRenderParticles (regl, settings) {
  let particleTexture
  let tick = () => {}
  const image = new window.Image()
  image.src = 'src/images/particle.png'
  image.onload = function () {
    particleTexture = regl.texture(image)
    setup()
  }

  return (args) => tick(args)

  function setup () {
    const curParticleState = []
    const lastParticleState = []
    for (let j = 0; j < settings.particles; j++) {
      createParticleState(j)
    }

    const particlesBuffer = regl.buffer(curParticleState)

    const entropies = new Float32Array(settings.particles)
    array(settings.particles).forEach((_, i) => {
      entropies[i] = Math.random()
    })

    const render = regl({
      vert: glsl`
        attribute vec4 particleState;
        attribute float entropy;

        uniform mat4 projection;
        uniform mat4 view;
        uniform vec3 eye;
        uniform float pointSize;
        uniform float time;
        uniform float multiplier;
        uniform sampler2D frequencyVals;

        varying vec4 fragColor;

        void main() {
          float gridSize = 1.0;
          vec3 position = particleState.xyz * gridSize;
          vec2 lookupPair = particleState.xy;
          // if (entropy < 0.25) {
          //   lookupPair = particleState.yz;
          // } else if (entropy < 0.5) {
          //   lookupPair = particleState.zx;
          // } else if (entropy < 0.75) {
          //   lookupPair = particleState.xz;
          // }
          vec2 lookup = (lookupPair + 1.0) / 2.0;
          float frequencyVal = texture2D(frequencyVals, lookup).x;
          position.z = frequencyVal * 0.5 * multiplier;

          float size = particleState.w;
          // float intensity = clamp((sin(entropy * 3.1415 * 1.85 + time * 0.1) - 0.8) * 5.0, 0.18, 1.0);
          float intensity = frequencyVal * frequencyVal * 5.0;
          float distToCamera = distance(eye, position);
          gl_PointSize = (pointSize - distToCamera) * size;
          // float opacity = (1.0 - distToCamera / pointSize) * intensity;
          float opacity = clamp(pow(frequencyVal * 1.5, 2.0), 0.0, 0.95) * multiplier;
          if (intensity < 0.18) {
            opacity = 0.0;
          }
          fragColor = vec4(vec3(intensity), opacity);

          gl_Position = projection * view * vec4(position, 1);
        }
      `,
      frag: glsl`
        precision highp float;
        varying vec4 fragColor;
        uniform sampler2D particleTexture;

        void main(){
          vec4 particle = texture2D(particleTexture, gl_PointCoord);
          gl_FragColor = fragColor;
          gl_FragColor.a = min(fragColor.a, particle.a);
        }
      `,
      uniforms: {
        particleTexture: particleTexture,
        frequencyVals: regl.prop('frequencyVals'),
        multiplier: regl.prop('multiplier'),
        pointSize: 10
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
        particleState: particlesBuffer,
        entropy: entropies
      },
      count: settings.particles,
      primitive: 'points'
    })

    tick = function ({ frequencyVals, multiplier }) {
      updateParticlesPositions()
      particlesBuffer(curParticleState)
      render({ frequencyVals, multiplier })
    }

    function updateParticlesPositions () {
      const decay = 0.998
      for (let j = 0; j < settings.particles; j++) {
        const startIdx = j * 4

        // TODO: add noise here
        const velX = curParticleState[startIdx] - lastParticleState[startIdx]
        const velY = curParticleState[startIdx + 1] - lastParticleState[startIdx + 1]
        const velZ = curParticleState[startIdx + 2] - lastParticleState[startIdx + 2]
        const size = curParticleState[startIdx + 3]

        lastParticleState[startIdx] = curParticleState[startIdx]
        lastParticleState[startIdx + 1] = curParticleState[startIdx + 1]
        lastParticleState[startIdx + 2] = curParticleState[startIdx + 2]
        lastParticleState[startIdx + 3] = curParticleState[startIdx + 3]

        curParticleState[startIdx] = velX * decay + curParticleState[startIdx]
        curParticleState[startIdx + 1] = velY * decay + curParticleState[startIdx + 1]
        curParticleState[startIdx + 2] = velZ * decay + curParticleState[startIdx + 2]
        curParticleState[startIdx + 3] = size * decay

        if (
          curParticleState[startIdx + 3] < 0.1 ||
          Math.abs(curParticleState[startIdx]) > 1.2 ||
          Math.abs(curParticleState[startIdx + 1]) > 1.2
        ) {
          createParticleState(j)
        }
      }
    }

    function createParticleState (particleNum) {
      const x = (Math.random() * 2 - 1)
      const y = (Math.random() * 2 - 1)
      const z = (Math.random() * 2 - 1)
      const size = Math.random()
      const lastX = x + (Math.random() * 2 - 1) * 0.0005
      const lastY = y + (Math.random() * 2 - 1) * 0.0005
      const lastZ = z + (Math.random() * 2 - 1) * 0.0005
      const lastSize = 0 // not used because size just decays over time - no velocity calc needed

      const startIdx = particleNum * 4
      curParticleState[startIdx] = x
      curParticleState[startIdx + 1] = y
      curParticleState[startIdx + 2] = z
      curParticleState[startIdx + 3] = size
      lastParticleState[startIdx] = lastX
      lastParticleState[startIdx + 1] = lastY
      lastParticleState[startIdx + 2] = lastZ
      lastParticleState[startIdx + 3] = lastSize
    }
  }
}
