#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = "true";
      continue;
    }

    args[key] = next;
    i += 1;
  }

  return args;
}

function escapeRubyString(value) {
  return value.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"");
}

function normalizeClassName(packageName) {
  const cleaned = packageName.replace(/^@/, "").replaceAll("/", "-");
  return cleaned
    .split(/[^a-zA-Z0-9]/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
}

async function readLocalPackageJson() {
  const packagePath = path.join(workspaceRoot, "package.json");
  const content = await fs.readFile(packagePath, "utf8");
  return JSON.parse(content);
}

async function fetchRegistryPackage(packageName, version) {
  const registryUrl = `https://registry.npmjs.org/${encodeURIComponent(packageName)}/${encodeURIComponent(version)}`;
  const response = await fetch(registryUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch npm metadata from ${registryUrl} (status ${response.status})`);
  }
  return response.json();
}

async function computeTarballSha256(tarballUrl) {
  const response = await fetch(tarballUrl);
  if (!response.ok) {
    throw new Error(`Failed to download tarball from ${tarballUrl} (status ${response.status})`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function buildFormula({
  className,
  description,
  homepage,
  tarballUrl,
  sha256,
  license,
  binaryName,
}) {
  return `class ${className} < Formula
  desc "${escapeRubyString(description)}"
  homepage "${escapeRubyString(homepage)}"
  url "${escapeRubyString(tarballUrl)}"
  sha256 "${sha256}"
  license "${escapeRubyString(license)}"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink libexec/"bin/${escapeRubyString(binaryName)}"
  end

  test do
    output = shell_output("#{bin}/${escapeRubyString(binaryName)} --version")
    assert_match version.to_s, output
  end
end
`;
}

function printHelp() {
  console.log(`Usage:
  node scripts/generate-homebrew-formula.mjs [options]

Options:
  --package <name>    npm package name (default: local package.json name)
  --version <ver>     published npm version (default: local package.json version)
  --output <path>     write formula to file (default: stdout)
  --help              show this help
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === "true") {
    printHelp();
    return;
  }

  const localPackage = await readLocalPackageJson();
  const packageName = args.package ?? localPackage.name;
  const version = args.version ?? localPackage.version;

  if (!packageName || !version) {
    throw new Error("Could not resolve package name/version. Pass --package and --version.");
  }

  const metadata = await fetchRegistryPackage(packageName, version);
  const tarballUrl = metadata?.dist?.tarball;
  if (!tarballUrl) {
    throw new Error(`No dist.tarball found for ${packageName}@${version}. Publish to npm first.`);
  }

  const description = metadata.description ?? localPackage.description ?? packageName;
  const homepage = metadata.homepage ?? localPackage.homepage ?? `https://www.npmjs.com/package/${packageName}`;
  const packageLicense = metadata.license ?? localPackage.license ?? "MIT";
  const bin = metadata.bin ?? localPackage.bin;

  let binaryName = packageName;
  if (typeof bin === "string") {
    binaryName = packageName;
  } else if (bin && typeof bin === "object") {
    const [firstBinName] = Object.keys(bin);
    if (firstBinName) {
      binaryName = firstBinName;
    }
  }

  const sha256 = await computeTarballSha256(tarballUrl);
  const className = normalizeClassName(packageName);

  const formula = buildFormula({
    className,
    description,
    homepage,
    tarballUrl,
    sha256,
    license: packageLicense,
    binaryName,
  });

  if (args.output) {
    const outputPath = path.resolve(process.cwd(), args.output);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, formula, "utf8");
    console.log(`Wrote Homebrew formula to ${outputPath}`);
    return;
  }

  process.stdout.write(formula);
}

main().catch((error) => {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
