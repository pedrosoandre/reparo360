/**
 * Testa, sem montar o <Canvas>, se o navegador consegue abrir WebGL agora.
 *
 * Por que existe: quando uma página derruba a GPU, o Chrome bloqueia o WebGL
 * daquele site até o navegador ser fechado e aberto de novo ("Web page caused
 * context loss and was blocked"); placa/driver sem suporte dá no mesmo. O r3f
 * cria o renderer de forma assíncrona e esse erro nunca chega no React — o
 * visualizador só ficava vazio, sem aviso nenhum.
 */
export type WebGLProbe = { ok: true } | { ok: false; reason: string };

export function probeWebGL(): WebGLProbe {
  if (typeof document === "undefined") return { ok: true };
  const canvas = document.createElement("canvas");
  let reason = "";
  const onError = (e: Event) => {
    reason = (e as WebGLContextEvent).statusMessage || reason;
  };
  canvas.addEventListener("webglcontextcreationerror", onError);
  let gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
  try {
    gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
  } catch (err) {
    reason = err instanceof Error ? err.message : String(err);
  }
  canvas.removeEventListener("webglcontextcreationerror", onError);
  if (!gl) return { ok: false, reason: reason || "WebGL indisponível neste navegador" };
  // Devolve o contexto de teste na hora: o Chrome mantém só 16 contextos
  // ativos e derruba o mais antigo — poderia ser o do próprio viewer.
  gl.getExtension("WEBGL_lose_context")?.loseContext();
  return { ok: true };
}
