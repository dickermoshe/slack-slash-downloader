# A NPM file

# Pull base image.
FROM node:latest

# Set working directory
WORKDIR /usr/src/app

# Copy package.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# RUn node app.js
CMD ["node", "app.js"]