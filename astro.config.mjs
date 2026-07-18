import { defineConfig } from "astro/config";
import { readFileSync } from "node:fs";
import yaml from "js-yaml";

const project = yaml.load(readFileSync(new URL("./config/project.yml", import.meta.url), "utf8"));
const repo = project.github_repo || "awesome-autonomous-biology";
const configuredOwner = project.github_owner;
const owner = configuredOwner === "YOUR_GITHUB_OWNER" ? "example" : configuredOwner;

export default defineConfig({
  output: "static",
  site: `https://${owner}.github.io`,
  base: `/${repo}`,
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
