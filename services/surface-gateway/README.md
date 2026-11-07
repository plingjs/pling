# Surface Gateway deployment wrapper

The implementation and public API live in
[`@plingjs/surface-gateway`](../../packages/surface-gateway). This directory is a
thin container/deployment entry point so existing `node
services/surface-gateway/src/index.mjs` commands and Docker images keep working.

Configure the process through the environment variables documented in the
package README. The bundled config example is
[`packages/surface-gateway/config.example.json`](../../packages/surface-gateway/config.example.json).
