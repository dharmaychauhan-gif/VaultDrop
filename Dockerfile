FROM node:22-alpine

WORKDIR /app

# Copy root and client package files
COPY package*.json ./
COPY client/package*.json ./client/

# Install dependencies
RUN npm install
RUN npm --prefix client install

# Copy source code
COPY . .

# Build frontend
RUN npm --prefix client run build

# Default Koyeb port
ENV PORT=8000
EXPOSE 8000

# Start production server
CMD ["node", "server/index.js"]
