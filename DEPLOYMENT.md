# 🚀 Deployment Guide: My Diary (Vercel & Render)

This guide walks you through deploying **My Diary** frontend to **Vercel** and backend to **Render**.

---

## 1. ⚙️ Backend Deployment on Render

### Method A: Deploying manually (Recommended & Simple)
1. Go to [Render Dashboard](https://dashboard.render.com/) and click **New +** → **Web Service**.
2. Connect your GitHub / GitLab repository.
3. Configure the service settings:
   - **Name**: `mydairy-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: `Free`
4. Under **Environment Variables**, add:
   - `NODE_ENV`: `production`
   - `JWT_SECRET`: *(Click "Generate" or enter a secure random secret string)*
   - `DATA_DIR`: `/var/data` *(Optional: if you attach a Persistent Disk)*
5. Click **Create Web Service**.
6. Once deployed, copy your Render Service URL (e.g., `https://mydairy-backend.onrender.com`).
7. Verify health check by opening: `https://mydairy-backend.onrender.com/api/health` in your browser.

---

### Method B: Deploying using Render Blueprint (`render.yaml`)
1. In Render Dashboard, click **New +** → **Blueprint**.
2. Select your repository. Render will automatically detect `render.yaml` and configure the Web Service and Persistent Disk.
3. Click **Apply**.

---

## 2. 🎨 Frontend Deployment on Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard) and click **Add New...** → **Project**.
2. Import your **My Diary** repository.
3. Configure project settings:
   - **Framework Preset**: `Other`
   - **Root Directory**: Select `frontend` (Click Edit → select `frontend` directory).
   - **Build and Output Settings**: Leave as default static.
4. Click **Deploy**.
5. Once deployed, copy your live Vercel URL (e.g., `https://mydairy.vercel.app`).

---

## 3. 🔗 Connecting Frontend to Render Backend

Once both are deployed, you have two simple ways to connect your Frontend to your Render Backend:

### Option A: Via the Web App UI (Instant)
1. Open your live Vercel app (e.g. `https://mydairy.vercel.app`).
2. At the bottom of the login page (or in settings), click **⚙️ Server URL**.
3. Enter your Render backend URL (e.g. `https://mydairy-backend.onrender.com`).
4. The page will reload and start communicating with your Render backend!

### Option B: Automatic Proxy / Preset Rewrite
- If you host the frontend on Vercel with Root Directory set to `frontend`, `frontend/vercel.json` already manages routing cleanly.
- You can also add dynamic backend endpoint overrides via `localStorage.setItem('diary_api_url', 'https://mydairy-backend.onrender.com/api')`.

---

## 🔒 Verification & Troubleshooting

1. **Test Health Endpoint**:
   Visit `https://YOUR_RENDER_APP.onrender.com/api/health`. You should see `{"success": true, "message": "My Diary API is running!"}`.
2. **CORS Issues**:
   Backend is configured with wildcard CORS (`cors({ origin: '*' })`), so cross-origin requests from Vercel work out-of-the-box.
3. **Cold Starts**:
   Render free tier web services spin down after 15 minutes of inactivity. The first request after a sleep period may take 30-50 seconds to boot.
