const glsl = require('glslify')

module.exports = function createRenderBlur (regl) {
  return regl({
    vert: glsl`
      precision highp float;

      attribute vec2 position;

      void main() {
        gl_Position = vec4(position, 0, 1);
      }
    `,
    frag: glsl`
      precision highp float;

      uniform vec2 iResolution;
      uniform sampler2D iChannel0;
      uniform vec2 direction;

      #pragma glslify: blur = require(glsl-fast-gaussian-blur/13)

      void main() {
        vec2 uv = vec2(gl_FragCoord.xy / iResolution.xy);
        vec2 perpendicularDirection = vec2(direction.x * -1.0, direction.y);
        vec4 pixel1 = blur(iChannel0, uv, iResolution.xy, direction);
        vec4 pixel2 = blur(iChannel0, uv, iResolution.xy, perpendicularDirection);
        gl_FragColor = mix(pixel1, pixel2, 0.5);
      }
    `,
    uniforms: {
      iResolution: ({viewportWidth, viewportHeight}) => [viewportWidth, viewportHeight],
      iChannel0: regl.prop('iChannel0'), // sampler2D
      direction: regl.prop('direction')
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
}
