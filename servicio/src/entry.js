// Punto de entrada del archivo único: solo exporta el handler (Cloudflare trata otras exportaciones como entrypoints).
import worker from "./worker.js";
export default worker;
