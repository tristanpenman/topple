precision highp float;

// Attributes
attribute vec3 position;
attribute vec2 uv;

// Uniforms
uniform mat4 view;
uniform mat4 world;
uniform mat4 worldViewProjection;
uniform float time;
uniform float uSpeed;
uniform float vSpeed;
uniform float uScale;
uniform float vScale;

// Varying
varying vec2 vUV;
varying vec2 tUV;
varying float fFogDistance;

void main(void) {
  vec4 worldPosition = world * vec4(position, 1.0);
  gl_Position = worldViewProjection * vec4(position, 1.0);
  vUV.x = (uv.x * uScale + uSpeed * -time);
  vUV.y = (uv.y * vScale + vSpeed * time);
  tUV.x = (uv.x * uScale + sin(uSpeed * -time));
  tUV.y = (uv.y * vScale + cos(vSpeed * time));
  fFogDistance = (view * worldPosition).z;
}
