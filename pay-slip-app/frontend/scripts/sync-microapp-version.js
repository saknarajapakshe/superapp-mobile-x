const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const pkgPath = path.join(root, "package.json");
const microPath = path.join(root, "microapp.json");

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

try {
  const pkg = readJson(pkgPath);
  const micro = readJson(microPath);

  if (micro.version !== pkg.version) {
    micro.version = pkg.version;
    writeJson(microPath, micro);
    console.log(`Updated microapp.json version -> ${pkg.version}`);
    process.exitCode = 0;
  } else {
    console.log(`microapp.json version already in sync (${pkg.version})`);
  }
} catch (err) {
  console.error("Failed to sync microapp.json version:", err);
  process.exitCode = 2;
}
