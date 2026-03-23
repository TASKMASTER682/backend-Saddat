# Render Cron Configuration
# Add this to your Render dashboard or as render.yaml

# In Render Dashboard:
# 1. Go to your backend service
# 2. Go to "Cron Jobs" tab
# 3. Add a new cron job:
#    - Schedule: Every 10 minutes */10 * * * *
#    - Command: curl https://your-backend-url.onrender.com/api/cron
#    - Region: Free tier supports 1 cron job

# Or use render.yaml (requires paid plan):
# routes:
#   - type: cron
#     name: keep-alive
#     schedule: "*/10 * * * *"
#     command: "curl https://your-backend-url.onrender.com/api/cron"
