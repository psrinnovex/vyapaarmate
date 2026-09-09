module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  watchman: false,
  testPathIgnorePatterns: ["/node_modules/", "/.expo/"],
  collectCoverageFrom: ["src/**/*.{ts,tsx}", "!src/app/**"],
};
