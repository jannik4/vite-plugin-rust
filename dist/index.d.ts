import type { Plugin } from "vite";
export interface Options {
    crates: Crate[];
}
export interface Crate {
    name: string;
    path: string;
    watch?: string[];
}
export default function (options: Options): Plugin;
