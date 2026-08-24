export async function resolve(specifier, context, next) {
  if (specifier === "three" || specifier.startsWith("three/")) {
    const url = new URL("../vendor/three.module.js", import.meta.url).href;
    return { shortCircuit: true, url };
  }
  return next(specifier, context);
}
