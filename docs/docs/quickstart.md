# Quick Start

## Setup Berth (Central Instance)

1. **Download files**
   ```bash
   mkdir berth
   cd berth
   wget https://raw.githubusercontent.com/Tech-Arch1tect/berth/refs/heads/main/docker-compose.yml
   wget https://raw.githubusercontent.com/Tech-Arch1tect/berth/refs/heads/main/.env.example
   ```
   
2. **Configure environment**
   ```bash
   cp .env.example .env
   # Generate encryption secret and edit .env
   openssl rand -base64 32
   # Set ENCRYPTION_SECRET= to the generated value
   openssl rand -base64 32
   # Set JWT_SECRET_KEY= to the generated value
   ```

3. Make any other .env changes as you see fit

4. **Start with Docker Compose**
   ```bash
   docker compose up -d
   ```

5. **Access Berth**
   - Web UI: https://localhost:8080

6. Create the first admin user at https://localhost:8080/setup/admin

## Setup Berth-Agent (On Docker Servers)

1. **Download files**
   ```bash
   mkdir berth-agent
   cd berth-agent
   wget https://raw.githubusercontent.com/Tech-Arch1tect/berth-agent/refs/heads/main/docker-compose.yml
   wget https://raw.githubusercontent.com/Tech-Arch1tect/berth-agent/refs/heads/main/.env.example
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Generate access token and edit .env
   openssl rand -base64 32
   # Set ACCESS_TOKEN= to the generated value
   # Set STACK_LOCATION= to your compose stacks directory
   ```

3. **Start with Docker Compose**
   ```bash
   docker compose up -d
   ```

4. Add the server to Berth at https://localhost:8080/admin/servers
