precision mediump float;

uniform sampler2D curTileStateTexture;
uniform sampler2D prevTileStateTexture;
// uniform sampler2D tripMetaDataTexture;

uniform float dampening;
uniform float stiffness;
uniform float height;

varying vec2 tileStateIndex;

float getNextValue(float cur, float prev, float dest, float s, float d) {
  float velocity = clamp(0.0, 0.02, cur - prev);
  float delta = dest - cur;
  float spring = delta * s;
  float damper = velocity * -1.0 * d;
  return spring + damper + velocity + cur;
}

void main() {
  vec4 curState = texture2D(curTileStateTexture, tileStateIndex);
  vec4 prevState = texture2D(prevTileStateTexture, tileStateIndex);

  // float i = cos(height * 20.0 + tileStateIndex.y * 2.0) / 5.0;
  // float j = sin(height * 50.0 + tileStateIndex.y * 3.0) / 5.0;
  float h = sin(height * 30.0 + tileStateIndex.y * 3.0) + 1.0;

  float x = getNextValue(curState.x, prevState.x, curState.x, stiffness, dampening);
  float y = getNextValue(curState.y, prevState.y, curState.y, stiffness, dampening);
  float z = getNextValue(curState.z, prevState.z, h / 5.0, stiffness, dampening * pow(length(curState.xy), 1.1));

  gl_FragColor = vec4(x, y, z, 0.0);
}
