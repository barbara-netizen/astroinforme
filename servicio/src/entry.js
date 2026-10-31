// Punto de entrada del archivo único. Cloudflare trata cada exportación como un entrypoint: además del handler
// se exporta la clase del Durable Object (generación desacoplada, servicio 1.6), que el binding REPORT_JOB necesita.
import worker from "./worker.js";
export { ReportJob } from "./job.js";
export default worker;
