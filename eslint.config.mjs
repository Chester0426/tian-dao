import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  { ignores: [".next/", "out/", "node_modules/"] },
  {
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXAttribute[name.name='asChild']",
          message:
            "asChild is removed in shadcn v4. Use className={buttonVariants()} on the element directly. See .claude/stacks/ui/shadcn.md v4 Breaking Changes.",
        },
      ],
    },
  }
);
