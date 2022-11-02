import type { Plugin } from "vite";
import micromatch from "micromatch";
import which from "which";
import { spawn, SpawnOptions } from "child_process";
import path from "path";

export interface Options {
  crates: Crate[];
}

export interface Crate {
  name: string;
  path: string;
  watch?: string[];
}

export default function (options: Options): Plugin {
  let wasmPackBin = "wasm-pack";
  let buildProfile = "--release";

  for (const crate of options.crates) {
    if (crate.watch === undefined) {
      crate.watch = [crate.path + "/src/**", crate.path + "/Cargo.toml"];
    }
  }

  return {
    name: "vite-plugin-rust",
    enforce: "pre",

    async configResolved(config) {
      if (config.command === "serve") buildProfile = "--dev";

      wasmPackBin = await installWasmPack();

      for (const crate of options.crates) {
        try {
          await runWasmPack(wasmPackBin, buildProfile, crate);
        } catch (e) {
          console.log(e);
        }
      }
    },

    config(config) {
      if (!config.optimizeDeps) config.optimizeDeps = {};
      if (!config.optimizeDeps.exclude) config.optimizeDeps.exclude = [];
      config.optimizeDeps.exclude = config.optimizeDeps.exclude.concat(
        options.crates.map((crate) => crate.name)
      );

      if (!config.server) config.server = {};
      if (!config.server.watch) config.server.watch = {};
      config.server.watch.disableGlobbing = false;
    },

    configureServer(server) {
      options.crates.forEach((crate) => server.watcher.add(crate.watch!));
    },

    handleHotUpdate(ctx) {
      for (const crate of options.crates) {
        if (micromatch.isMatch(ctx.file, crate.watch!)) {
          runWasmPack(wasmPackBin, buildProfile, crate)
            .then(() => {
              ctx.server.ws.send({ type: "full-reload" });
            })
            .catch((e) => {
              console.log(e);
            });
        }
      }
    },
  };
}

async function runWasmPack(
  wasmPackBin: string,
  buildProfile: string,
  crate: Crate
) {
  const outDir = path.relative(crate.path, "./node_modules/" + crate.name);

  await runProcess(
    () => new Error("Rust compilation"),
    wasmPackBin,
    ["build", buildProfile, "--target", "web", "--out-dir", outDir],
    { cwd: crate.path, stdio: "inherit" }
  );
}

async function installWasmPack(): Promise<string> {
  try {
    return which.sync("wasm-pack");
  } catch (_) {
    console.log("[INFO]: installing wasm-pack ...");

    const npmBin = which.sync("npm");
    await runProcess(
      () => new Error("could not install wasm-pack"),
      npmBin,
      ["install", "-g", "wasm-pack"],
      { stdio: "inherit" }
    );

    console.log("[INFO]: installed wasm-pack");

    return which.sync("wasm-pack");
  }
}

function runProcess(
  nonZeroError: () => Error,
  command: string,
  args: ReadonlyArray<string>,
  options?: SpawnOptions
): Promise<void> {
  return new Promise((resolve, reject) => {
    const process =
      options === undefined
        ? spawn(command, args)
        : spawn(command, args, options);

    process.on("close", (code) => {
      if (code == 0) {
        resolve();
      } else {
        reject(nonZeroError());
      }
    });
    process.on("error", reject);
  });
}
