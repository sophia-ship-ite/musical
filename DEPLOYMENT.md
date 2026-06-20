# Deployment Guide - Musical Archive

This guide explains how to run the Musical Archive application locally and deploy it to cloud platforms like **Render** and **Railway**.

---

## 1. Local Execution

To run the application locally on your computer:

1. Open your terminal in the project directory.
2. Run the start command:
   ```bash
   npm start
   ```
   *Alternatively, you can run:*
   ```bash
   node server.js
   ```
3. The server will start and listen on port `3000` (or the port specified in your `PORT` environment variable).
4. Open your browser and navigate to:
   [http://localhost:3000](http://localhost:3000)

---

## 2. Render Deployment

To deploy this project to [Render](https://render.com/):

1. **Push your code to a Git repository** (GitHub or GitLab).
2. **Sign in** to Render and click **New > Web Service**.
3. **Connect your repository** to Render.
4. Set the following configuration details:
   - **Name**: `musical-archive` (or any preferred name)
   - **Runtime**: `Node`
   - **Build Command**: *(Leave empty, as there are no build steps or dependencies)*
   - **Start Command**: `node server.js` or `npm start`
5. Click **Create Web Service**.
6. Render will automatically detect the port configuration (`process.env.PORT`) and assign a public URL for your application.

---

## 3. Railway Deployment

To deploy this project to [Railway](https://railway.app/):

1. **Push your code to a GitHub repository**.
2. **Sign in** to Railway and click **New Project > Deploy from GitHub repo**.
3. **Select your repository**.
4. Railway will automatically analyze the repository, detect `package.json`, and set the start command to `npm start`.
5. Railway automatically provides the `PORT` environment variable, which our server binds to on the `0.0.0.0` interface.
6. Once the deployment is complete, go to the **Settings** tab in your Railway service, find the **Domains** section, and click **Generate Domain** to get your public URL.
