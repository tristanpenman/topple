#define FOGMODE_NONE 0.
#define FOGMODE_EXP 1.
#define FOGMODE_EXP2 2.
#define FOGMODE_LINEAR 3.
#define E 2.71828

precision highp float;

varying vec2 vUV;
varying vec2 tUV;
varying float fDistance;

uniform sampler2D textureSampler;

uniform vec4 vFogInfos;
uniform vec3 vFogColor;

varying float fFogDistance;

float CalcFogFactor()
{
 float fogCoeff = 1.0;
 float fogStart = vFogInfos.y;
 float fogEnd = vFogInfos.z;
 float fogDensity = vFogInfos.w;

 if (FOGMODE_LINEAR == vFogInfos.x)
 {
  fogCoeff = (fogEnd - fFogDistance) / (fogEnd - fogStart);
 }
 else if (FOGMODE_EXP == vFogInfos.x)
 {
  fogCoeff = 1.0 / pow(E, fFogDistance * fogDensity);
 }
 else if (FOGMODE_EXP2 == vFogInfos.x)
 {
  fogCoeff = 1.0 / pow(E, fFogDistance * fFogDistance * fogDensity * fogDensity);
 }

 return clamp(fogCoeff, 0.0, 1.0);
}

void main(void) {
  gl_FragColor = vec4(0.33, 0.66, 0.99, 1.0);
  gl_FragColor.xyz = 0.25 * texture2D(textureSampler, vUV).xyz + gl_FragColor.xyz * texture2D(textureSampler, tUV).xyz;
  gl_FragColor.a = CalcFogFactor() * 0.6;
}
