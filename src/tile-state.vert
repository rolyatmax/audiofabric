precision mediump float;

attribute vec2 position;

varying vec2 tileStateIndex;

void main() {
  // map bottom left -1,-1 (normalized device coords) to 0,0 (particle texture index)
  // and 1,1 (ndc) to 1,1 (texture)
  tileStateIndex = 0.5 * (1.0 + position);
  gl_Position = vec4(position, 0, 1);
}
