import path from "node:path";
import fs from "node:fs";

const sourceDir = "./dist";
const targetDir = "./demo/node_modules/vite-plugin-cesium-engine/.";
const packageJsonFile = "package.json";
const distDir = path.join(targetDir, "dist");

const copyFiles = (sourceDir, targetDir) => {
  const files = fs.readdirSync(sourceDir);

  files.forEach((file) => {
    const sourcePath = path.join(sourceDir, file);
    const targetPath = path.join(targetDir, file);

    const isDirectory = fs.statSync(sourcePath).isDirectory();

    isDirectory
      ? copyFiles(sourcePath, targetPath)
      : fs.copyFileSync(sourcePath, targetPath);
  });
};

if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });
copyFiles(sourceDir, distDir);
fs.copyFileSync(packageJsonFile, path.join(targetDir, packageJsonFile));
