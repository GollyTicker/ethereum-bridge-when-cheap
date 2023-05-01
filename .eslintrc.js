module.exports = {
  env: {
    browser: true,
    es2021: true,
    jest: true,
  },
  extends: [
    "standard",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  rules: {
    "comma-dangle": "off",
    quotes: "off",
    semi: "off",
    "padded-blocks": "off",
    "no-trailing-spaces": "off",
    "space-before-function-paren": "off",
    "no-multiple-empty-lines": "off",
  },
  settings: {
  },
};
