/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/Backend/src", "<rootDir>/Frontend/src"], // Monorepo: backend + frontend
  testMatch: ["**/?(*.)+(spec|test).ts"],
  testPathIgnorePatterns: ["/node_modules/", "/dist/", "/coverage/"],
  collectCoverage: true,
  collectCoverageFrom: [
    "Backend/src/services/**/*.ts",
    "Backend/src/controllers/**/*.ts",
    "Frontend/src/**/*.ts"
  ],
  coverageDirectory: "coverage",
  moduleFileExtensions: ["ts", "js", "json", "node"],
};
