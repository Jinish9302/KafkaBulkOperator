import fs from "fs";
import path from "path";

describe("NPM Package Readiness", () => {
  const packageJsonPath = path.join(__dirname, "../package.json");
  const distPath = path.join(__dirname, "../dist");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

  test("package.json should have required fields", () => {
    const requiredFields = ["name", "version", "main", "license"];
    for (const field of requiredFields) {
      expect(packageJson[field]).toBeDefined();
      expect(packageJson[field]).not.toBe("");
    }
  });

  test("build directory (dist/) should exist", () => {
    const exists = fs.existsSync(distPath);
    expect(exists).toBe(true);
  });

  test("main entry file should exist", () => {
    const mainFile = path.join(__dirname, "../", packageJson.main);
    const exists = fs.existsSync(mainFile);
    expect(exists).toBe(true);
  });

  test("package should be importable", async () => {
    const pkg = await import(path.join(__dirname, "../", packageJson.main));
    expect(pkg).toBeDefined();
  });

  test("package.json should not have private:true (ready for publish)", () => {
    expect(packageJson.private).not.toBe(true);
  });
});
