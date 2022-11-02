var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import micromatch from "micromatch";
import which from "which";
import { spawn } from "child_process";
import path from "path";
export default function (options) {
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
        configResolved(config) {
            return __awaiter(this, void 0, void 0, function* () {
                if (config.command === "serve")
                    buildProfile = "--dev";
                wasmPackBin = yield installWasmPack();
                for (const crate of options.crates) {
                    try {
                        yield runWasmPack(wasmPackBin, buildProfile, crate);
                    }
                    catch (e) {
                        console.log(e);
                    }
                }
            });
        },
        config(config) {
            if (!config.optimizeDeps)
                config.optimizeDeps = {};
            if (!config.optimizeDeps.exclude)
                config.optimizeDeps.exclude = [];
            config.optimizeDeps.exclude = config.optimizeDeps.exclude.concat(options.crates.map((crate) => crate.name));
            if (!config.server)
                config.server = {};
            if (!config.server.watch)
                config.server.watch = {};
            config.server.watch.disableGlobbing = false;
        },
        configureServer(server) {
            options.crates.forEach((crate) => server.watcher.add(crate.watch));
        },
        handleHotUpdate(ctx) {
            for (const crate of options.crates) {
                if (micromatch.isMatch(ctx.file, crate.watch)) {
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
function runWasmPack(wasmPackBin, buildProfile, crate) {
    return __awaiter(this, void 0, void 0, function* () {
        const outDir = path.relative(crate.path, "./node_modules/" + crate.name);
        yield runProcess(() => new Error("Rust compilation"), wasmPackBin, ["build", buildProfile, "--target", "web", "--out-dir", outDir], { cwd: crate.path, stdio: "inherit" });
    });
}
function installWasmPack() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            return which.sync("wasm-pack");
        }
        catch (_) {
            console.log("[INFO]: installing wasm-pack ...");
            const npmBin = which.sync("npm");
            yield runProcess(() => new Error("could not install wasm-pack"), npmBin, ["install", "-g", "wasm-pack"], { stdio: "inherit" });
            console.log("[INFO]: installed wasm-pack");
            return which.sync("wasm-pack");
        }
    });
}
function runProcess(nonZeroError, command, args, options) {
    return new Promise((resolve, reject) => {
        const process = options === undefined
            ? spawn(command, args)
            : spawn(command, args, options);
        process.on("close", (code) => {
            if (code == 0) {
                resolve();
            }
            else {
                reject(nonZeroError());
            }
        });
        process.on("error", reject);
    });
}
