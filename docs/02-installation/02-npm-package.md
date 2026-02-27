# Installation via NPM (Package)

This guide covers installing Doppelganger as a standalone NPM package. This is ideal for quickly testing Doppelganger without cloning the repository or using Docker.

## Prerequisites
*   [Node.js](https://nodejs.org/) (LTS recommended, v18+).
*   [NPM](https://docs.npmjs.com/) or Yarn installed.

## Global Installation (Recommended)

To install Doppelganger globally:

```bash
npm install -g @doppelgangerdev/doppelganger
```

### Running the CLI

Once installed, you can start the application using:

```bash
doppelganger
```

This will launch the Doppelganger server on the default port (11345).

### Access the Application

Open your browser and navigate to:

[http://localhost:11345](http://localhost:11345)

## Running with NPX (Temporary/One-Off)

If you don't want to install Doppelganger globally, you can run it directly using `npx`:

```bash
npx @doppelgangerdev/doppelganger
```

This will execute the latest version of Doppelganger without a global installation.

## Customizing Configuration

You can customize the environment variables by passing them before the command:

```bash
PORT=8080 SESSION_SECRET=mysecret doppelganger
```

Or with `npx`:

```bash
PORT=8080 SESSION_SECRET=mysecret npx @doppelgangerdev/doppelganger
```

## Running Scripts (Advanced)

The NPM package also exposes specific scripts for different modes:

*   **Scraper Mode**: `doppelganger --scrape` (Runs the high-performance scraper).
*   **Headful Mode**: `doppelganger --headful` (Runs the interactive browser).
*   **Agent Mode**: `doppelganger --agent` (Runs the full automation agent).

For more details on CLI usage, see [CLI Tool Documentation](../06-api/02-cli-tool.md).
