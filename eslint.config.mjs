import { FlatCompat } from "@eslint/eslintrc"
import eslintPluginImport from "eslint-plugin-import"
import prettier from "eslint-plugin-prettier"
import eslintPluginReactRefresh from "eslint-plugin-react-refresh"
import { dirname } from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)

const __dirname = dirname(__filename)

const defineConfig = (config) => config

const globalIgnores = (ignores) => ({ ignores })

const compat = new FlatCompat({
	baseDirectory: __dirname,
	recommendedConfig: { eslint: { recommended: true } }
})

const eslintConfig = defineConfig([
	...compat.extends(
		"next/core-web-vitals",
		"next/typescript",
		"prettier",
		"plugin:prettier/recommended",
		"plugin:import/errors",
		"plugin:import/typescript",
		"plugin:import/warnings"
	),
	{
		languageOptions: {
			globals: {
				JSX: true,
				module: true,
				React: true,
				window: true
			}
		},
		plugins: {
			import: eslintPluginImport,
			prettier,
			"react-refresh": eslintPluginReactRefresh
		},
		rules: {
			"import/default": "off",
			"import/extensions": ["error", "never", { json: "always", svg: "always" }],
			"import/no-named-as-default": "off",
			"import/no-named-as-default-member": "off",
			"import/no-unresolved": [2, { amd: true, commonjs: true }],
			"import/prefer-default-export": "off",
			"no-else-return": "error",
			"no-unused-vars": "off",
			"padding-line-between-statements": [
				"error",
				{ blankLine: "always", next: "return", prev: "*" },
				{ blankLine: "always", next: "*", prev: ["const", "let", "function"] },
				{ blankLine: "always", next: ["if", "switch", "while", "try", "function"], prev: ["*"] },
				{ blankLine: "always", next: ["*"], prev: ["if", "switch", "while", "try", "function"] },
				{ blankLine: "always", next: ["*"], prev: ["export"] }
			],
			"prettier/prettier": ["error", { endOfLine: "auto" }],
			"react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
			"react/jsx-key": "off",
			"react/jsx-no-useless-fragment": [2, { allowExpressions: true }],
			"react/jsx-props-no-spreading": "off",
			"react/prop-types": "off",
			"react/react-in-jsx-scope": "off",
			"react/require-default-props": ["off"]
		}
	},
	globalIgnores([".next", "node_modules", "dist", "build", "public", "src/app/(payload)/*"])
])

export default eslintConfig
