import js from "@eslint/js";
import securityPlugin from "eslint-plugin-security";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import globals from "globals";

export default [
    js.configs.recommended,
    {
        files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.cjs"],
        plugins: {
            "@typescript-eslint": tsPlugin,
            "security": securityPlugin,
        },
        languageOptions: {
            parser: tsParser,
            ecmaVersion: "latest",
            sourceType: "module",
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.electron,
                chrome: "readonly",
            },
        },
        rules: {
            ...tsPlugin.configs.recommended.rules,
            ...securityPlugin.configs.recommended.rules,
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-unused-vars": "warn",
            "security/detect-object-injection": "off",
            "security/detect-non-literal-fs-filename": "warn",
            "security/detect-unsafe-regex": "error",
            "no-undef": "warn",
        },
    },
];
