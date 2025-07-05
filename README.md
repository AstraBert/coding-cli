# coding-cli

The coding assistant that lives in your terminal and helps you make your projects better! ✨

## Features

🎯 **Smart Code Analysis**: Get in-depth explanations of your code files, tailored for the programming language and your expertise level

💡 **Intelligent Code Editing**: Iteratively improve your code by adding new features following your implementation ideas

🐛 **Error Fixing Assistant**: Debug and fix errors in your code files by following error traces and detailed diagnostics

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- [pnpm](https://pnpm.io/) package manager
- An [OpenAI API key](https://platform.openai.com/api-keys)


### Installation

> [!IMPORTANT]
>
> _Make sure to always make `OPENAI_API_KEY` available in your environment before running the tool_

**Pre-compiled package**

```bash
export OPENAI_API_KEY="sk-***"
npx @cle-does-things/coding-cli info
```

You can run all the other command in the same way, take a look below :)

**Developer mode**

Clone the repository and install dependencies:

```bash
export OPENAI_API_KEY="sk-***"
git clone https://github.com/AstraBert/coding-cli.git
cd coding-cli
pnpm install
```

### Usage

Run the CLI with:

```bash
pnpm start <command>
# or 
npx @cle-does-things/coding-cli <command>
```

See commands below!

### 📚 `explain` (alias: `x`)

Get comprehensive explanations of your code files, adapted to your programming language and skill level.

```bash
pnpm start explain
# or
pnpm start x
# or 
npx @cle-does-things/coding-cli explain
```

### ✏️ `edit` (alias: `e`)

Iteratively enhance your code by adding new features and implementing your ideas.

```bash
pnpm start edit
# or
pnpm start e
```

### 🔧 `fix` (alias: `f`)

Debug and resolve errors in your code using error traces and detailed diagnostics.

```bash
pnpm start fix
# or
pnpm start f
# or 
npx @cle-does-things/coding-cli fix
```

### 🎉 `info` (alias: `i`)

Display information about coding-cli and available commands.

```bash
pnpm start info
# or
pnpm start i
# or 
npx @cle-does-things/coding-cli info
```

## Project Structure

- `src/commands/` — CLI command implementations (e.g., `info.ts`, `explain.ts`, `edit.ts`, `fix.ts`)
- `src/utils/` — Utility functions and helpers
- `src/logger.ts` — Logging utilities with colored output
- `src/index.ts` — CLI entry point and command registration

## Contributing

Contribute to this project following the [guidelines](./CONTRIBUTING.md).

## License

This project is provided under an [MIT License](LICENSE)
