import globals from "globals";
import pluginJs from "@eslint/js";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginUnusedImports from "eslint-plugin-unused-imports";

export default [
  {
    files: [
      "src/components/**/*.{js,mjs,cjs,jsx}",
      "src/pages/**/*.{js,mjs,cjs,jsx}",
      "src/Layout.jsx",
    ],
    ignores: ["src/lib/**/*", "src/components/ui/**/*"],
    ...pluginJs.configs.recommended,
    ...pluginReact.configs.flat.recommended,
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    plugins: {
      react: pluginReact,
      "react-hooks": pluginReactHooks,
      "unused-imports": pluginUnusedImports,
    },
    rules: {
      /**
       * A name with nothing behind it.
       *
       * Spreading pluginJs.configs.recommended above sets this, and this
       * `rules` object then replaced the whole thing — so it was off, and a
       * deleted import shipped as a white screen with `getTheme is not
       * defined` behind it. Neither the linter nor the bundler said a word;
       * a browser did.
       */
      "no-undef": "error",
      /**
       * The same hole, one level up. no-undef does not look inside JSX, so
       * <Button /> with no import sailed through even with the rule above on
       * — found when a branch started using Button in a page whose import had
       * been removed. react/recommended sets this one too, and the `rules`
       * object here replaced it the same way.
       */
      "react/jsx-no-undef": "error",
      "no-unused-vars": "off",
      "react/jsx-uses-vars": "error",
      "react/jsx-uses-react": "error",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
      "react/no-unknown-property": [
        "error",
        { ignore: ["cmdk-input-wrapper", "toast-close"] },
      ],
      "react-hooks/rules-of-hooks": "error",
      /**
       * Reading a const before its declaration.
       *
       * This has taken the app down twice: a hook placed above the useState it
       * depends on. The body of a hook runs after render and gets away with it,
       * but the dependency array is evaluated during render, so [mealHistory]
       * above `const [mealHistory] = useState(...)` throws — and the whole page
       * goes white on a binding that reads fine to a human.
       *
       * Functions are exempt: they hoist, and the codebase leans on that for
       * handlers defined below their JSX.
       */
      "no-use-before-define": [
        "error",
        { functions: false, classes: false, variables: true, allowNamedExports: true },
      ],
    },
  },
];
