FROM node:20-alpine

# Install git (required for some Baileys dependency builds)
RUN apk add --no-cache git

WORKDIR /usr/src/app

# Copy package descriptors first to cache dependencies layer
COPY package*.json ./

RUN npm install --omit=dev

# Copy application source code
COPY . .

EXPOSE 8000

CMD ["npm", "start"]
