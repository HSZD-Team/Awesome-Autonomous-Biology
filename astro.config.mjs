import { defineConfig } from "astro/config";
import { readFileSync } from "node:fs";
import yaml from "js-yaml";

const project = yaml.load(readFileSync(new URL("./config/project.yml", import.meta.url), "utf8"));
const [workflowOwner, workflowRepo] = (process.env.GITHUB_REPOSITORY ?? "/").split("/");
const owner = workflowOwner || project.github_owner;
const repo = workflowRepo || project.github_repo;
const configuredSite = process.env.PUBLIC_SITE_URL || (owner ? "https://" + owner + ".github.io" : "http://localhost:4321");
const requestedBase = process.env.PUBLIC_BASE_PATH || (repo ? "/" + repo : "/");
const configuredBase = requestedBase === "/" ? "/" : "/" + requestedBase.replace(/^\/|\/$/g, "");

export default defineConfig({
  output: "static",
  devToolbar: { enabled: false },
  site: configuredSite,
  base: configuredBase,
  trailingSlash: "always",
  build: {
    format: "directory"
  },
  vite: {
    build: {
      sourcemap: true
    }
  }
});
