import { attachRealtime, buildApp } from "./app.js";
import { assertProductionReadiness, readAppConfig } from "./shared/config.js";
import { shutdownPersistence } from "./shared/persistence.js";

const appConfig = readAppConfig();
assertProductionReadiness(appConfig);

const app = await buildApp();
attachRealtime(app);

await app.listen({
  port: appConfig.port,
  host: "0.0.0.0"
});

app.log.info({ port: appConfig.port, env: appConfig.env }, "MOVY backend running");

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await app.close();
    await shutdownPersistence();
    process.exit(0);
  });
}
