# Installation with Docker Compose (Recommended)

This guide covers the recommended installation method using Docker Compose. This ensures a consistent environment across different platforms (Linux, macOS, Windows).

## Prerequisites
*   [Git](https://git-scm.com/downloads) installed.
*   [Docker](https://docs.docker.com/get-docker/) installed and running.
*   [Docker Compose](https://docs.docker.com/compose/install/) (usually included with Docker Desktop).

## Step-by-Step Installation

### 1. Clone the Repository

Clone the Doppelganger repository to your local machine:

```bash
git clone https://github.com/mnemosynestack/doppelganger.git
cd doppelganger
```

### 2. Configure Environment (Optional)

By default, Doppelganger works out of the box. However, you can create a `.env` file to customize settings like ports or security keys.

Create a `.env` file in the root directory:

```bash
touch .env
```

Add your custom configuration (see [Configuration Guide](../02-installation/03-configuration.md) for details):

```env
# Example .env
PORT=11345
SESSION_SECRET=your_secure_random_string
```

### 3. Start with Docker Compose

Run the following command to build and start the application in detached mode:

```bash
docker compose up --build -d
```

This command will:
1.  Build the Doppelganger Docker image.
2.  Start the container and map port `11345` (default) to your host.
3.  Mount the `data/` directory to persist your tasks and settings.

### 4. Access the Application

Once the container is running, open your browser and navigate to:

[http://localhost:11345](http://localhost:11345)

You should see the Doppelganger dashboard or setup screen.

## Managing the Container

### View Logs
To view the application logs:

```bash
docker compose logs -f
```

### Stop the Application
To stop the container:

```bash
docker compose down
```

### Update the Application
To update to the latest version, pull the changes and rebuild:

```bash
git pull
docker compose up --build -d
```

## Volume Persistence

Doppelganger uses a `data/` volume mount to ensure your tasks, proxies, and settings persist even if you delete the container.

*   `./data`: Stores `tasks.json`, `proxies.json`, `settings.json`, and execution logs.
*   `./public/captures`: Stores screenshots and recordings.

If you need to backup your data, simply copy the `data/` folder.
