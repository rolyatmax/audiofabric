const glsl = require('glslify')

module.exports = function createRenderBloom (regl, canvas) {
  const blueTextureBuffer = new Uint8Array(canvas.width * canvas.height * 4)
  for (let i = 0; i < blueTextureBuffer.length; i += 4) {
    const x = i / 4 % canvas.width
    const y = i / 4 / canvas.width | 0
    if (x > 100 && y > 100) {
      blueTextureBuffer[i] = blueTextureBuffer[i + 1] = 0
      blueTextureBuffer[i + 2] = blueTextureBuffer[i + 3] = 255
    } else {
      blueTextureBuffer[i] = blueTextureBuffer[i + 1] = blueTextureBuffer[i + 2] = Math.random() * 255 | 0
      blueTextureBuffer[i + 3] = 255
    }
  }
  const tempFbo = regl.framebuffer({
    color: regl.texture({
      shape: [canvas.width, canvas.height, 4],
      data: blueTextureBuffer
    }),
    depth: true,
    stencil: false
  })

  const renderBloomBlur = regl({
    vert: glsl`
      precision highp float;

      attribute vec2 position;

      varying vec2 uv;

      void main() {
        uv = position / 2.0 + 0.5;
        gl_Position = vec4(position, 0, 1);
      }
    `,
    frag: glsl`
      precision highp float;

      varying vec2 uv;

      uniform vec2 iResolution;
      uniform sampler2D iChannel0;
      uniform float blurMag;

      vec3 tex(vec2 uv);

      #pragma glslify: blur = require('glsl-hash-blur', sample=tex, iterations=20);

      vec3 tex(vec2 uv) {
        vec3 rgb = texture2D(iChannel0, uv).rgb;
        return rgb;
      }

      void main() {
        float aspect = iResolution.x / iResolution.y;
        vec3 blurred = blur(uv, blurMag / 200.0, 1.0 / aspect);
        gl_FragColor = vec4(blurred, 0.8);
      }
    `,
    uniforms: {
      iResolution: () => [canvas.width, canvas.height],
      iChannel0: regl.prop('iChannel0'), // sampler2D
      blurMag: regl.prop('blurMag')
    },
    attributes: {
      position: [
        -1, -1,
        -1, 4,
        4, -1
      ]
    },
    count: 3,
    primitive: 'triangles'
  })

  const renderBloomCombine = regl({
    vert: glsl`
      precision highp float;

      attribute vec2 position;

      varying vec2 uv;

      void main() {
        uv = position / 2.0 + 0.5;
        gl_Position = vec4(position, 0, 1);
      }
    `,
    frag: glsl`
      precision highp float;

      varying vec2 uv;

      uniform sampler2D iChannel0;
      uniform sampler2D blurredFrame;
      uniform float blurWeight;
      uniform float originalWeight;

      void main () {
        vec4 blurred = texture2D(blurredFrame, uv);
        vec4 original = texture2D(iChannel0, uv);
        if (blurred.r < 0.2 && original.r < 0.2) {
          gl_FragColor = original;
        } else {
          blurred.r = pow(blurred.r, 1.9);
          blurred.g = pow(blurred.g, 2.0);
          blurred.b = pow(blurred.b, 1.5);
          vec4 weightedOriginal = originalWeight * original;
          vec4 weightedBlur = blurWeight * blurred;
          // gl_FragColor = vec4(
          //   max(weightedOriginal.r, weightedBlur.r),
          //   max(weightedOriginal.g, weightedBlur.g),
          //   max(weightedOriginal.b, weightedBlur.b),
          //   original.a
          // );
          vec4 result = weightedOriginal + weightedBlur;
          gl_FragColor = vec4(result.rgb / 1.5, result.a);
        }
      }
    `,
    uniforms: {
      iChannel0: regl.prop('iChannel0'), // sampler2D
      blurredFrame: () => tempFbo, // sampler2D
      blurWeight: regl.prop('blurWeight'),
      originalWeight: regl.prop('originalWeight')
    },
    attributes: {
      position: [
        -1, -1,
        -1, 4,
        4, -1
      ]
    },
    count: 3,
    primitive: 'triangles'
  })

  return function render ({ iChannel0, blurMag, blurWeight, originalWeight }) {
    regl({ framebuffer: tempFbo })(() => {
      renderBloomBlur({ iChannel0, blurMag })
    })
    renderBloomCombine({
      iChannel0,
      blurWeight,
      originalWeight,
      blurredFrame: tempFbo
    })
  }
}
