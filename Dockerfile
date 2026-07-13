# Base image: lightweight Node.js runtime
FROM node:22-alpine

# Working directory inside the container
WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm install --omit=dev

# Copy the application source
COPY . .

# Run the simulation
CMD ["node", "index.js"]
