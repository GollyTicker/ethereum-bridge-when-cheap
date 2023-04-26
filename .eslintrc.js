module.exports = {
  env: {
    browser: true,
    es2021: true,
    jest: true,
  },
  extends: [
    "plugin:react/recommended",
    "standard",
    "plugin:react-hooks/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: ["react", "@typescript-eslint"],
  rules: {
    "comma-dangle": "off",
    quotes: "off",
    semi: "off",
    "padded-blocks": "off",
    "no-trailing-spaces": "off",
    indent: "off",
    "space-before-function-paren": "off",
  },
  settings: {
    react: {
      version: "detect",
    },
  },
};
