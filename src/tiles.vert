attribute float tileIndex;
attribute vec3 pointIndex;

varying vec4 fragColor;

uniform mat4 projection;
uniform mat4 view;
uniform vec3 lightSource;
uniform float tick;
uniform float textureSize;
uniform sampler2D tileState;

vec3 getNormal(vec3 pt1, vec3 pt2, vec3 pt3) {
  vec3 normal = cross(pt1 - pt2, pt2 - pt3);
  return normalize(normal);
}

vec3 calculatePosition(vec3 position, bool isBase) {
  float z;
  if (isBase) {
    z = 0.0;
  } else {
    z = clamp(position.z, 0.0, 1.0);
    // z = sin(position.z * 10.0 + tick / 200.0) * 0.1 + 0.02;
    // z = clamp(z, 0.0, 1.0);
  }
  return vec3(position.xy, z);
}

// should prob use ints in here?
vec3 getPositionFromTexture (float tileNumber, float pointNumber) {
  float index = tileNumber * 3.0 + mod(pointNumber, 3.0);
  float xLookup = mod(index, textureSize);
  float yLookup = floor(index / textureSize);
  vec2 lookup = vec2(
    xLookup / textureSize,
    yLookup / textureSize
  );
  vec4 point = texture2D(tileState, lookup);
  return point.xyz;
}

void main() {
  vec3 position = getPositionFromTexture(tileIndex, pointIndex.x);
  vec3 adjacentPositionA = getPositionFromTexture(tileIndex, pointIndex.y);
  vec3 adjacentPositionB = getPositionFromTexture(tileIndex, pointIndex.z);

  vec3 computedPosition = calculatePosition(position, pointIndex.x > 2.0);
  vec3 computedAdjacentA = calculatePosition(adjacentPositionA, pointIndex.y > 2.0);
  vec3 computedAdjacentB = calculatePosition(adjacentPositionB, pointIndex.z > 2.0);
  // if all zs are 0, let's throw this triangle away
  if (computedPosition.z == 0.0 && computedAdjacentA.z == 0.0 && computedAdjacentB.z == 0.0) {
    computedPosition = vec3(0);
  }

  vec3 normal = getNormal(computedPosition, computedAdjacentA, computedAdjacentB);
  vec3 lightDirection = normalize(lightSource - position);

  // do something with the dotProduct to figure out shading
  vec3 color = vec3(0.95, 0.95, 0.95);
  if (abs(normal.z) < 0.0001) {
    vec3 blue = vec3(0.67, 0.76, 0.9);
    // vec3 green = vec3(0.52, 0.8, 0.56);
    vec3 purple = vec3(0.55, 0.51, 0.8);
    vec3 white = vec3(0.95);
    float a = smoothstep(0.0, 1.0, abs(dot(vec2(0, 1), normal.xy)));
    color = mix(purple, blue, a);
    color = mix(color, white, computedPosition.z);
  }
  fragColor = vec4(color, 1.0);
  gl_Position = projection * view * vec4(computedPosition, 1.0);
}
